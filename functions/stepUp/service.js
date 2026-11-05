// functions/stepUp/service.js
// Step-up ceremonies (09-sequence-diagrams.md §1). Plain async functions that
// take their dependencies, so tests can run them against the emulator with a
// fake passkey verifier. functions/stepUp/index.js wraps them as callables.
//
// Collections (default database, server only):
//   stepUpChallenges/{id}  { uid, purpose: 'assert'|'register', actionHash, challenge, origin, rpID, used, expiresAt }
//   stepUpCredentials/{sha256(credentialId)} { uid, credentialId, publicKey (bytes), counter, transports, rpID, label, createdAt, lastUsedAt }
//   stepUpTokens/{sha256(token)} (see core/stepUp.js)

const { fail } = require('../core/errors');
const { parse, z, sha256Hex: sha256HexSchema, docId } = require('../core/schemas');
const { signedInRecently } = require('../core/authz');
const { sha256Hex } = require('../core/canonical');
const core = require('../core/stepUp');
const audit = require('../core/audit');

const RP_NAME = 'SplitSync';
const MAX_CREDENTIALS = 10;

const beginSchema = z.object({ actionHash: sha256HexSchema }).strict();
const completeSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('webauthn'), challengeId: docId, response: z.record(z.string(), z.unknown()) }).strict(),
  z.object({ method: z.literal('recentLogin'), challengeId: docId }).strict(),
]);
const registerCompleteSchema = z.object({
  challengeId: docId,
  response: z.record(z.string(), z.unknown()),
  label: z.string().trim().min(1).max(40).optional(),
}).strict();
const removeSchema = z.object({ id: sha256HexSchema }).strict();

function originOf(rawRequest) {
  const origin = rawRequest && rawRequest.headers && rawRequest.headers.origin;
  if (!core.isAllowedOrigin(origin)) throw fail('permission-denied');
  return origin;
}

function millis(v) {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  return new Date(v).getTime();
}

async function credentialsFor(db, uid, rpID) {
  const snap = await db.collection('stepUpCredentials').where('uid', '==', uid).get();
  return snap.docs.map((d) => ({ docId: d.id, ...d.data() })).filter((c) => !rpID || c.rpID === rpID);
}

/** Loads an unexpired, unused challenge that belongs to the caller. */
async function loadChallenge(db, { uid, challengeId, purpose, nowMs }) {
  const snap = await db.collection('stepUpChallenges').doc(challengeId).get();
  const c = snap.exists ? snap.data() : null;
  if (!c || c.uid !== uid || c.purpose !== purpose || c.used || !(millis(c.expiresAt) > nowMs)) {
    throw fail('unauthenticated', 'This confirmation has expired. Please try again.', { stepUp: 'expired' });
  }
  return { ref: snap.ref, ...c };
}

// ---------------------------------------------------------------------------

/**
 * stepUp-begin: creates a challenge for one action. Returns passkey options
 * when the caller has a passkey for this site, and the methods they can use.
 */
async function begin({ db, webauthn, uid, data, rawRequest, nowMs = Date.now() }) {
  const { actionHash } = parse(beginSchema, data);
  const origin = originOf(rawRequest);
  const rpID = core.rpIdFor(origin);
  const creds = await credentialsFor(db, uid, rpID);

  let options = null;
  if (creds.length > 0) {
    options = await webauthn.generateAuthenticationOptions({
      rpID,
      allowCredentials: creds.map((c) => ({ id: c.credentialId, transports: c.transports || undefined })),
      userVerification: 'required',
      timeout: core.CHALLENGE_TTL_MS,
    });
  }
  const ref = db.collection('stepUpChallenges').doc(core.randomId(24));
  await ref.create({
    uid, purpose: 'assert', actionHash, origin, rpID,
    challenge: options ? options.challenge : null,
    used: false, createdAt: new Date(nowMs), expiresAt: new Date(nowMs + core.CHALLENGE_TTL_MS),
  });
  return {
    challengeId: ref.id,
    methods: options ? ['webauthn', 'recentLogin'] : ['recentLogin'],
    webauthn: options,
  };
}

/**
 * stepUp-complete: verifies the passkey assertion (or a sign-in less than five
 * minutes old) and returns a single-use token bound to the challenge's action.
 */
async function complete({ db, webauthn, uid, data, request, nowMs = Date.now() }) {
  const input = parse(completeSchema, data);
  const challenge = await loadChallenge(db, { uid, challengeId: input.challengeId, purpose: 'assert', nowMs });

  let credentialUpdate = null;
  if (input.method === 'recentLogin') {
    if (!signedInRecently(request, nowMs)) {
      throw fail('unauthenticated', 'Please sign in again to confirm.', { stepUp: 'reauth' });
    }
  } else {
    if (!challenge.challenge) throw fail('unauthenticated', undefined, { stepUp: 'required' });
    const credId = typeof input.response.id === 'string' ? input.response.id : '';
    const credSnap = credId ? await db.collection('stepUpCredentials').doc(sha256Hex(credId)).get() : null;
    const cred = credSnap && credSnap.exists ? credSnap.data() : null;
    if (!cred || cred.uid !== uid || cred.rpID !== challenge.rpID) {
      throw fail('unauthenticated', 'This passkey is not set up for confirmations.', { stepUp: 'required' });
    }
    let verification;
    try {
      verification = await webauthn.verifyAuthenticationResponse({
        response: input.response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: challenge.origin,
        expectedRPID: challenge.rpID,
        credential: { id: cred.credentialId, publicKey: new Uint8Array(cred.publicKey), counter: cred.counter || 0, transports: cred.transports || undefined },
        requireUserVerification: true,
      });
    } catch (err) {
      verification = { verified: false };
    }
    if (!verification.verified) throw fail('unauthenticated', 'That confirmation did not work. Please try again.', { stepUp: 'required' });
    credentialUpdate = { ref: credSnap.ref, counter: verification.authenticationInfo.newCounter };
  }

  // Burn the challenge, update the passkey counter and issue the token atomically
  return db.runTransaction(async (tx) => {
    const fresh = await tx.get(challenge.ref);
    if (!fresh.exists || fresh.data().used) {
      throw fail('unauthenticated', 'This confirmation has expired. Please try again.', { stepUp: 'expired' });
    }
    tx.update(challenge.ref, { used: true, usedAt: new Date(nowMs) });
    if (credentialUpdate) {
      tx.update(credentialUpdate.ref, { counter: credentialUpdate.counter, lastUsedAt: new Date(nowMs) });
    }
    const token = core.issueToken(tx, db, { uid, hash: challenge.actionHash, method: input.method, nowMs });
    return { stepUpToken: token, expiresInSeconds: core.TOKEN_TTL_MS / 1000 };
  });
}

/**
 * stepUp-registerBegin: passkey registration options. Requires a sign-in less
 * than five minutes old, so a stolen session cannot add its own passkey and
 * bypass step-up.
 */
async function registerBegin({ db, webauthn, uid, request, rawRequest, nowMs = Date.now() }) {
  if (!signedInRecently(request, nowMs)) {
    throw fail('unauthenticated', 'Please sign in again to add a passkey.', { stepUp: 'reauth' });
  }
  const origin = originOf(rawRequest);
  const rpID = core.rpIdFor(origin);
  const existing = await credentialsFor(db, uid, null);
  if (existing.length >= MAX_CREDENTIALS) throw fail('resource-exhausted', 'You have reached the maximum number of passkeys.');

  const email = request.auth.token && request.auth.token.email;
  const options = await webauthn.generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: email || uid,
    userID: new TextEncoder().encode(uid),
    attestationType: 'none',
    excludeCredentials: existing.filter((c) => c.rpID === rpID).map((c) => ({ id: c.credentialId, transports: c.transports || undefined })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
    timeout: core.CHALLENGE_TTL_MS,
  });
  const ref = db.collection('stepUpChallenges').doc(core.randomId(24));
  await ref.create({
    uid, purpose: 'register', actionHash: null, origin, rpID, challenge: options.challenge,
    used: false, createdAt: new Date(nowMs), expiresAt: new Date(nowMs + core.CHALLENGE_TTL_MS),
  });
  return { challengeId: ref.id, webauthn: options };
}

/** stepUp-registerComplete: verifies the new passkey and stores its public key. */
async function registerComplete({ db, webauthn, uid, data, request, nowMs = Date.now() }) {
  const input = parse(registerCompleteSchema, data);
  if (!signedInRecently(request, nowMs)) {
    throw fail('unauthenticated', 'Please sign in again to add a passkey.', { stepUp: 'reauth' });
  }
  const challenge = await loadChallenge(db, { uid, challengeId: input.challengeId, purpose: 'register', nowMs });
  let verification;
  try {
    verification = await webauthn.verifyRegistrationResponse({
      response: input.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: challenge.origin,
      expectedRPID: challenge.rpID,
      requireUserVerification: true,
    });
  } catch (err) {
    verification = { verified: false };
  }
  if (!verification.verified || !verification.registrationInfo) {
    throw fail('invalid-argument', 'The passkey could not be added. Please try again.');
  }
  const { credential } = verification.registrationInfo;
  const credRef = db.collection('stepUpCredentials').doc(sha256Hex(credential.id));

  await db.runTransaction(async (tx) => {
    const [fresh, existingCred] = await Promise.all([tx.get(challenge.ref), tx.get(credRef)]);
    if (!fresh.exists || fresh.data().used) throw fail('unauthenticated', 'This confirmation has expired. Please try again.', { stepUp: 'expired' });
    if (existingCred.exists) throw fail('already-exists', 'This passkey is already added.');
    tx.update(challenge.ref, { used: true, usedAt: new Date(nowMs) });
    tx.create(credRef, {
      uid,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter || 0,
      transports: Array.isArray(credential.transports) ? credential.transports.slice(0, 8) : [],
      rpID: challenge.rpID,
      label: input.label || 'Passkey',
      createdAt: new Date(nowMs),
      lastUsedAt: null,
    });
    await audit.record(db, { actorUid: uid, action: 'stepUp.registerPasskey', targetPath: `stepUpCredentials/${credRef.id}`, meta: { rpID: challenge.rpID } }, { tx, at: new Date(nowMs) });
  });
  return { id: credRef.id };
}

/** stepUp-listCredentials: the caller's passkeys, without key material. */
async function listCredentials({ db, uid }) {
  const creds = await credentialsFor(db, uid, null);
  return {
    credentials: creds.map((c) => ({
      id: c.docId, label: c.label || 'Passkey', rpID: c.rpID,
      createdAt: millis(c.createdAt) || null, lastUsedAt: millis(c.lastUsedAt) || null,
    })),
  };
}

/** stepUp-removeCredential: owner only, after a recent sign-in. */
async function removeCredential({ db, uid, data, request, nowMs = Date.now() }) {
  const { id } = parse(removeSchema, data);
  if (!signedInRecently(request, nowMs)) {
    throw fail('unauthenticated', 'Please sign in again to remove a passkey.', { stepUp: 'reauth' });
  }
  const ref = db.collection('stepUpCredentials').doc(id);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data().uid !== uid) throw fail('not-found');
    tx.delete(ref);
    await audit.record(db, { actorUid: uid, action: 'stepUp.removePasskey', targetPath: `stepUpCredentials/${id}` }, { tx, at: new Date(nowMs) });
  });
  return { removed: true };
}

module.exports = { begin, complete, registerBegin, registerComplete, listCredentials, removeCredential, MAX_CREDENTIALS };
