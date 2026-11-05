// Integration tests for the money pipeline helpers and step-up, against the
// Firestore emulator (real transactions). Run from the repo root:
//   npm run test:functions:emulator

const { test, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run through `npm run test:functions:emulator` (needs the Firestore emulator).');
}

const admin = require('firebase-admin');
const app = admin.apps.length ? admin.app() : admin.initializeApp({ projectId: 'demo-splitsync' });
const db = admin.firestore(app);

const { runIdempotent, peek } = require('../../core/idempotency');
const { checkRateLimit, LIMITS } = require('../../core/rateLimit');
const { requireStepUp } = require('../../core/stepUp');
const { actionHash } = require('../../core/canonical');
const service = require('../../stepUp/service');
const { setFlag } = require('../../admin/setFlag');
const flags = require('../../core/flags');

const ORIGIN = 'https://splitsync-dev.web.app';
const raw = (origin = ORIGIN) => ({ headers: { origin } });
const NOW = Date.now();
const fresh = (uid, secAgo = 30) => ({ auth: { uid, token: { auth_time: Math.floor(NOW / 1000) - secAgo, email: `${uid}@x.com` } } });
const stale = (uid) => fresh(uid, 3600);

async function clear() {
  const res = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-splitsync/databases/(default)/documents`, { method: 'DELETE' });
  assert.ok(res.ok);
}

before(clear);
beforeEach(clear);

// Fake passkey verifier: behaviour chosen per test
function fakeWebauthn(over = {}) {
  return {
    generateAuthenticationOptions: async (o) => ({ challenge: 'chal-auth', rpId: o.rpID, allowCredentials: o.allowCredentials }),
    generateRegistrationOptions: async (o) => ({ challenge: 'chal-reg', rp: { id: o.rpID }, excludeCredentials: o.excludeCredentials }),
    verifyAuthenticationResponse: async () => ({ verified: true, authenticationInfo: { newCounter: 7 } }),
    verifyRegistrationResponse: async () => ({ verified: true, registrationInfo: { credential: { id: 'cred-1', publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ['internal'] } } }),
    ...over,
  };
}

// ---- idempotency --------------------------------------------------------------
test('idempotency: first call works, replay returns the stored result, other request refused', async () => {
  let runs = 0;
  const work = async (tx) => { runs += 1; tx.set(db.doc(`things/t${runs}`), { n: runs }); return { n: runs }; };
  const req = { uid: 'alice', key: 'k'.repeat(20), fn: 'demo', data: { amountMinor: 100 } };

  const a = await runIdempotent(db, req, work);
  const b = await runIdempotent(db, { ...req, data: { amountMinor: 100, stepUpToken: 'different-token-ignored' } }, work);
  assert.deepEqual(a, { result: { n: 1 }, replayed: false });
  assert.deepEqual(b, { result: { n: 1 }, replayed: true });
  assert.equal(runs, 1);
  assert.equal((await db.collection('things').get()).size, 1);

  await assert.rejects(runIdempotent(db, { ...req, data: { amountMinor: 999 } }, work), { code: 'already-exists' });
  await assert.rejects(runIdempotent(db, { ...req, fn: 'other' }, work), { code: 'already-exists' });
  assert.deepEqual(await peek(db, req), { found: true, result: { n: 1 } });
  // A different user may use the same key
  const c = await runIdempotent(db, { ...req, uid: 'bob' }, work);
  assert.equal(c.replayed, false);
});

test('idempotency: concurrent duplicates commit the work once', async () => {
  // Firestore may re-run a transaction's function under contention, so this
  // checks what was committed: exactly one first result, the rest replays.
  const req = { uid: 'alice', key: 'c'.repeat(20), fn: 'demo', data: { x: 1 } };
  const work = async (tx) => { tx.set(db.doc('things/one'), { at: Date.now() }); return { ok: true }; };
  const results = await Promise.all(Array.from({ length: 5 }, () => runIdempotent(db, req, work)));
  assert.equal(results.filter((r) => !r.replayed).length, 1);
  assert.ok(results.every((r) => r.result.ok === true));
});

test('idempotency: a failing work function stores nothing', async () => {
  const req = { uid: 'alice', key: 'f'.repeat(20), fn: 'demo', data: {} };
  await assert.rejects(runIdempotent(db, req, async () => { throw new Error('boom'); }), /boom/);
  assert.deepEqual(await peek(db, req), { found: false });
});

// ---- rate limit ---------------------------------------------------------------
test('rate limit allows up to the limit per window, then refuses', async () => {
  const { max } = LIMITS.stepUpRegister;
  const t = 1_800_000_000_000;
  for (let i = 0; i < max; i += 1) await checkRateLimit(db, 'alice', 'stepUpRegister', t);
  await assert.rejects(checkRateLimit(db, 'alice', 'stepUpRegister', t), { code: 'resource-exhausted' });
  await checkRateLimit(db, 'bob', 'stepUpRegister', t); // per user
  await checkRateLimit(db, 'alice', 'stepUpRegister', t + LIMITS.stepUpRegister.windowSec * 1000); // next window
});

// ---- step-up: recent sign-in path ----------------------------------------------
const ACTION = 'circles.claimContribution';
const PARAMS = { circleId: 'c1', cycle: 1, method: 'revolut', idempotencyKey: 'i'.repeat(20) };

async function tokenViaRecentLogin(uid = 'alice', params = PARAMS) {
  const hash = actionHash(ACTION, params);
  const b = await service.begin({ db, webauthn: fakeWebauthn(), uid, data: { actionHash: hash }, rawRequest: raw(), nowMs: NOW });
  const c = await service.complete({ db, webauthn: fakeWebauthn(), uid, data: { method: 'recentLogin', challengeId: b.challengeId }, request: fresh(uid), nowMs: NOW });
  return { begin: b, token: c.stepUpToken };
}

test('step-up: no passkey offers only the recent sign-in method', async () => {
  const { begin } = await tokenViaRecentLogin();
  assert.deepEqual(begin.methods, ['recentLogin']);
  assert.equal(begin.webauthn, null);
});

test('step-up token works once, for this user and this exact action', async () => {
  const { token } = await tokenViaRecentLogin();
  // wrong user, wrong amount/params, wrong action: all refused, token still unused
  await assert.rejects(requireStepUp(db, 'bob', ACTION, { ...PARAMS, stepUpToken: token }, NOW), (e) => e.details.stepUp === 'required');
  await assert.rejects(requireStepUp(db, 'alice', ACTION, { ...PARAMS, cycle: 2, stepUpToken: token }, NOW), { code: 'unauthenticated' });
  await assert.rejects(requireStepUp(db, 'alice', 'loans.respond', { ...PARAMS, stepUpToken: token }, NOW), { code: 'unauthenticated' });
  // right one succeeds once
  await requireStepUp(db, 'alice', ACTION, { ...PARAMS, stepUpToken: token }, NOW);
  await assert.rejects(requireStepUp(db, 'alice', ACTION, { ...PARAMS, stepUpToken: token }, NOW), { code: 'unauthenticated' });
});

test('step-up token expires after five minutes', async () => {
  const { token } = await tokenViaRecentLogin();
  await assert.rejects(requireStepUp(db, 'alice', ACTION, { ...PARAMS, stepUpToken: token }, NOW + 5 * 60 * 1000 + 1), { code: 'unauthenticated' });
});

test('step-up: the database never holds the token itself', async () => {
  const { token } = await tokenViaRecentLogin();
  const all = await db.collection('stepUpTokens').get();
  assert.equal(all.size, 1);
  assert.notEqual(all.docs[0].id, token);
  assert.ok(!JSON.stringify(all.docs[0].data()).includes(token));
});

test('step-up: an old sign-in is refused with a re-auth hint', async () => {
  const b = await service.begin({ db, webauthn: fakeWebauthn(), uid: 'alice', data: { actionHash: actionHash(ACTION, PARAMS) }, rawRequest: raw(), nowMs: NOW });
  await assert.rejects(
    service.complete({ db, webauthn: fakeWebauthn(), uid: 'alice', data: { method: 'recentLogin', challengeId: b.challengeId }, request: stale('alice'), nowMs: NOW }),
    (e) => e.code === 'unauthenticated' && e.details.stepUp === 'reauth'
  );
});

test('step-up challenge: single use, owner only, expires after two minutes', async () => {
  const hash = actionHash(ACTION, PARAMS);
  const b = await service.begin({ db, webauthn: fakeWebauthn(), uid: 'alice', data: { actionHash: hash }, rawRequest: raw(), nowMs: NOW });
  const done = (uid, nowMs = NOW) => service.complete({ db, webauthn: fakeWebauthn(), uid, data: { method: 'recentLogin', challengeId: b.challengeId }, request: fresh(uid), nowMs });

  await assert.rejects(done('bob'), (e) => e.details.stepUp === 'expired');
  await assert.rejects(done('alice', NOW + 2 * 60 * 1000 + 1), (e) => e.details.stepUp === 'expired');
  await done('alice');
  await assert.rejects(done('alice'), (e) => e.details.stepUp === 'expired');
});

test('step-up begin: rejects other origins and malformed hashes', async () => {
  await assert.rejects(service.begin({ db, webauthn: fakeWebauthn(), uid: 'alice', data: { actionHash: actionHash(ACTION, PARAMS) }, rawRequest: raw('https://evil.example'), nowMs: NOW }), { code: 'permission-denied' });
  await assert.rejects(service.begin({ db, webauthn: fakeWebauthn(), uid: 'alice', data: { actionHash: 'nothex' }, rawRequest: raw(), nowMs: NOW }), { code: 'invalid-argument' });
});

// ---- step-up: passkeys ------------------------------------------------------------
async function registerPasskey(uid = 'alice', webauthn = fakeWebauthn()) {
  const r = await service.registerBegin({ db, webauthn, uid, request: fresh(uid), rawRequest: raw(), nowMs: NOW });
  return service.registerComplete({ db, webauthn, uid, data: { challengeId: r.challengeId, response: { id: 'cred-1' }, label: 'Phone' }, request: fresh(uid), nowMs: NOW });
}

test('passkey registration needs a recent sign-in', async () => {
  await assert.rejects(service.registerBegin({ db, webauthn: fakeWebauthn(), uid: 'alice', request: stale('alice'), rawRequest: raw(), nowMs: NOW }), (e) => e.details.stepUp === 'reauth');
});

test('passkey registration stores the public key, audit-logs, and refuses duplicates', async () => {
  const { id } = await registerPasskey();
  const cred = (await db.doc(`stepUpCredentials/${id}`).get()).data();
  assert.equal(cred.uid, 'alice');
  assert.equal(cred.rpID, 'splitsync-dev.web.app');
  assert.deepEqual([...cred.publicKey], [1, 2, 3]);
  assert.equal(cred.label, 'Phone');
  const logs = await db.collection('auditLog').where('action', '==', 'stepUp.registerPasskey').get();
  assert.equal(logs.size, 1);
  await assert.rejects(registerPasskey(), { code: 'already-exists' });
});

test('a failed registration verification adds nothing', async () => {
  const wa = fakeWebauthn({ verifyRegistrationResponse: async () => { throw new Error('bad attestation'); } });
  await assert.rejects(registerPasskey('alice', wa), { code: 'invalid-argument' });
  assert.equal((await db.collection('stepUpCredentials').get()).size, 0);
});

test('step-up with a passkey: verified assertion gives a token and updates the counter', async () => {
  const { id } = await registerPasskey();
  const hash = actionHash(ACTION, PARAMS);
  const b = await service.begin({ db, webauthn: fakeWebauthn(), uid: 'alice', data: { actionHash: hash }, rawRequest: raw(), nowMs: NOW });
  assert.deepEqual(b.methods, ['webauthn', 'recentLogin']);
  assert.deepEqual(b.webauthn.allowCredentials.map((c) => c.id), ['cred-1']);

  let seen;
  const wa = fakeWebauthn({ verifyAuthenticationResponse: async (opts) => { seen = opts; return { verified: true, authenticationInfo: { newCounter: 7 } }; } });
  const c = await service.complete({ db, webauthn: wa, uid: 'alice', data: { method: 'webauthn', challengeId: b.challengeId, response: { id: 'cred-1' } }, request: stale('alice'), nowMs: NOW });
  assert.equal(seen.expectedChallenge, 'chal-auth');
  assert.equal(seen.expectedOrigin, ORIGIN);
  assert.equal(seen.expectedRPID, 'splitsync-dev.web.app');
  assert.equal(seen.requireUserVerification, true);
  assert.equal((await db.doc(`stepUpCredentials/${id}`).get()).data().counter, 7);
  await requireStepUp(db, 'alice', ACTION, { ...PARAMS, stepUpToken: c.stepUpToken }, NOW);
});

test('step-up with a passkey: failed verification or someone else\'s passkey gives no token', async () => {
  await registerPasskey('alice');
  const hash = actionHash(ACTION, PARAMS);
  const b = await service.begin({ db, webauthn: fakeWebauthn(), uid: 'alice', data: { actionHash: hash }, rawRequest: raw(), nowMs: NOW });
  const no = fakeWebauthn({ verifyAuthenticationResponse: async () => ({ verified: false }) });
  await assert.rejects(service.complete({ db, webauthn: no, uid: 'alice', data: { method: 'webauthn', challengeId: b.challengeId, response: { id: 'cred-1' } }, request: fresh('alice'), nowMs: NOW }), { code: 'unauthenticated' });
  const throws = fakeWebauthn({ verifyAuthenticationResponse: async () => { throw new Error('sig'); } });
  await assert.rejects(service.complete({ db, webauthn: throws, uid: 'alice', data: { method: 'webauthn', challengeId: b.challengeId, response: { id: 'cred-1' } }, request: fresh('alice'), nowMs: NOW }), { code: 'unauthenticated' });

  // Bob tries to use Alice's credential id on his own challenge
  const bb = await service.begin({ db, webauthn: fakeWebauthn(), uid: 'bob', data: { actionHash: hash }, rawRequest: raw(), nowMs: NOW });
  await assert.rejects(service.complete({ db, webauthn: fakeWebauthn(), uid: 'bob', data: { method: 'webauthn', challengeId: bb.challengeId, response: { id: 'cred-1' } }, request: fresh('bob'), nowMs: NOW }), { code: 'unauthenticated' });
  assert.equal((await db.collection('stepUpTokens').get()).size, 0);
});

test('a passkey made on one site is not offered on another', async () => {
  await registerPasskey('alice');
  const b = await service.begin({ db, webauthn: fakeWebauthn(), uid: 'alice', data: { actionHash: actionHash(ACTION, PARAMS) }, rawRequest: raw('http://localhost:3000'), nowMs: NOW });
  assert.deepEqual(b.methods, ['recentLogin']);
});

test('list and remove passkeys: owner only, recent sign-in, no key material listed', async () => {
  const { id } = await registerPasskey('alice');
  const list = await service.listCredentials({ db, uid: 'alice' });
  assert.equal(list.credentials.length, 1);
  assert.equal(list.credentials[0].id, id);
  assert.ok(!('publicKey' in list.credentials[0]));
  assert.equal((await service.listCredentials({ db, uid: 'bob' })).credentials.length, 0);

  await assert.rejects(service.removeCredential({ db, uid: 'bob', data: { id }, request: fresh('bob'), nowMs: NOW }), { code: 'not-found' });
  await assert.rejects(service.removeCredential({ db, uid: 'alice', data: { id }, request: stale('alice'), nowMs: NOW }), (e) => e.details.stepUp === 'reauth');
  await service.removeCredential({ db, uid: 'alice', data: { id }, request: fresh('alice'), nowMs: NOW });
  assert.equal((await db.collection('stepUpCredentials').get()).size, 0);
});

// ---- admin flags ------------------------------------------------------------------
test('setFlag writes the flag with an audit record and validates input', async () => {
  await setFlag({ db, actorUid: 'admin1', data: { flag: 'circlesEnabled', enabled: false, allowUids: ['tester', 'tester'] } });
  const f = (await db.doc('config/features').get()).data();
  assert.deepEqual(f.circlesEnabled, { enabled: false, allowUids: ['tester'] });
  assert.equal(f.updatedBy, 'admin1');
  const logs = await db.collection('auditLog').where('action', '==', 'admin.setFlag').get();
  assert.equal(logs.size, 1);
  assert.equal(logs.docs[0].data().meta.flag, 'circlesEnabled');

  flags.clearCache();
  await flags.requireFlag(db, 'circlesEnabled', 'tester');
  await assert.rejects(flags.requireFlag(db, 'circlesEnabled', 'someoneElse'), { code: 'failed-precondition' });

  await assert.rejects(setFlag({ db, actorUid: 'admin1', data: { flag: 'nope', enabled: true } }), { code: 'invalid-argument' });
  await assert.rejects(setFlag({ db, actorUid: 'admin1', data: { flag: 'aidEnabled', enabled: 'yes' } }), { code: 'invalid-argument' });
  await assert.rejects(setFlag({ db, actorUid: 'admin1', data: { flag: 'aidEnabled', enabled: true, allowUids: Array.from({ length: 51 }, (_, i) => `u${i}`) } }), { code: 'invalid-argument' });
  flags.clearCache();
});

// ---- the real passkey library -----------------------------------------------------
test('real SimpleWebAuthn: options are generated, and a forged response is rejected', async () => {
  const real = require('@simplewebauthn/server');
  const r = await service.registerBegin({ db, webauthn: real, uid: 'alice', request: fresh('alice'), rawRequest: raw(), nowMs: NOW });
  assert.equal(r.webauthn.rp.id, 'splitsync-dev.web.app');
  assert.equal(r.webauthn.authenticatorSelection.userVerification, 'required');
  assert.match(r.webauthn.challenge, /^[A-Za-z0-9_-]{20,}$/);
  const forged = { id: 'AAAA', rawId: 'AAAA', type: 'public-key', response: { clientDataJSON: 'AAAA', attestationObject: 'AAAA' }, clientExtensionResults: {} };
  await assert.rejects(
    service.registerComplete({ db, webauthn: real, uid: 'alice', data: { challengeId: r.challengeId, response: forged }, request: fresh('alice'), nowMs: NOW }),
    { code: 'invalid-argument' }
  );
  assert.equal((await db.collection('stepUpCredentials').get()).size, 0);
});
