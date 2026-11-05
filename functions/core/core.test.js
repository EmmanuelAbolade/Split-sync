// Unit tests for the pure parts of functions/core (no emulator needed).
// Run: npm run test:functions (from the repo root)

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { canonicalJson, sha256Hex, actionHash } = require('./canonical');
const flags = require('./flags');
const schemas = require('./schemas');
const authz = require('./authz');
const ledger = require('./ledger');
const audit = require('./audit');
const stepUp = require('./stepUp');
const errors = require('./errors');

// ---- canonical JSON / hashes --------------------------------------------------
// FIXTURES are shared with src/utils/stepUp.test.js: the browser must produce
// exactly the same hashes.
const FIXTURES = require('./canonical.fixtures.json');

test('canonical JSON sorts keys at every level and drops undefined', () => {
  assert.equal(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null }, u: undefined }),
    '{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}');
  assert.throws(() => canonicalJson({ x: NaN }));
});

test('actionHash matches the shared fixtures and ignores only stepUpToken', () => {
  for (const f of FIXTURES) {
    assert.equal(actionHash(f.action, f.params), f.hash, f.action);
  }
  // Independent check of the exact bytes being hashed
  const crypto = require('crypto');
  assert.equal(actionHash('empty', {}), crypto.createHash('sha256').update('{"action":"empty","params":{}}').digest('hex'));
  const p = { amountMinor: 500, idempotencyKey: 'k'.repeat(20) };
  assert.equal(actionHash('x', p), actionHash('x', { ...p, stepUpToken: 'anything' }));
  assert.notEqual(actionHash('x', p), actionHash('x', { ...p, amountMinor: 501 }));
  assert.notEqual(actionHash('x', p), actionHash('x', { ...p, idempotencyKey: 'j'.repeat(20) }));
  assert.notEqual(actionHash('x', p), actionHash('y', p));
  assert.match(sha256Hex('a'), /^[0-9a-f]{64}$/);
});

// ---- flags -------------------------------------------------------------------
test('flags fail closed and honour the allow-list', () => {
  const f = { circlesEnabled: { enabled: false, allowUids: ['tester'] }, loansEnabled: { enabled: true } };
  assert.equal(flags.isEnabledFor(f, 'circlesEnabled', 'tester'), true);
  assert.equal(flags.isEnabledFor(f, 'circlesEnabled', 'other'), false);
  assert.equal(flags.isEnabledFor(f, 'circlesEnabled', null), false);
  assert.equal(flags.isEnabledFor(f, 'loansEnabled', 'anyone'), true);
  assert.equal(flags.isEnabledFor(f, 'aidEnabled', 'tester'), false, 'missing flag is off');
  assert.equal(flags.isEnabledFor(f, 'madeUpFlag', 'tester'), false, 'unknown flag is off');
  assert.equal(flags.isEnabledFor({ aidEnabled: { enabled: 'true' } }, 'aidEnabled', 'x'), false, 'non-boolean is off');
  assert.equal(flags.isEnabledFor(null, 'aidEnabled', 'x'), false);
});

test('requireFlag reads config/features once per cache window', async () => {
  flags.clearCache();
  let reads = 0;
  const db = { doc: () => ({ get: async () => { reads += 1; return { exists: true, data: () => ({ aidEnabled: { enabled: true } }) }; } }) };
  await flags.requireFlag(db, 'aidEnabled', 'u');
  await flags.requireFlag(db, 'aidEnabled', 'u');
  assert.equal(reads, 1);
  await assert.rejects(flags.requireFlag(db, 'loansEnabled', 'u'), { code: 'failed-precondition' });
  flags.clearCache();
});

// ---- schemas -----------------------------------------------------------------
test('parse rejects bad input without echoing values', () => {
  const s = schemas.z.object({ amountMinor: schemas.amountMinor, currency: schemas.currency }).strict();
  assert.deepEqual(schemas.parse(s, { amountMinor: 1234, currency: 'EUR' }), { amountMinor: 1234, currency: 'EUR' });
  for (const bad of [
    { amountMinor: 12.5, currency: 'EUR' },
    { amountMinor: -1, currency: 'EUR' },
    { amountMinor: 0, currency: 'EUR' },
    { amountMinor: 1e12, currency: 'EUR' },
    { amountMinor: 100, currency: 'XYZ' },
    { amountMinor: '100', currency: 'EUR' },
    { amountMinor: 100, currency: 'EUR', extra: true },
  ]) {
    assert.throws(() => schemas.parse(s, bad), (e) => {
      assert.equal(e.code, 'invalid-argument');
      assert.ok(!JSON.stringify(e.details).includes('XYZ'));
      return true;
    });
  }
  assert.throws(() => schemas.parse(s, undefined), { code: 'invalid-argument' });
});

test('ids, keys and tokens only allow safe characters', () => {
  assert.equal(schemas.idempotencyKey.safeParse('3f2b6c1e-9a4d-4c2e-8b1a-0f6d2e7c9a10').success, true);
  assert.equal(schemas.idempotencyKey.safeParse('short').success, false);
  assert.equal(schemas.docId.safeParse('../users/x').success, false);
  assert.equal(schemas.uid.safeParse('a/b').success, false);
  assert.equal(schemas.stepUpToken.safeParse('x'.repeat(43)).success, true);
});

// ---- authz -------------------------------------------------------------------
test('requireAuth and requireAdmin', () => {
  assert.throws(() => authz.requireAuth({}), { code: 'unauthenticated' });
  assert.equal(authz.requireAuth({ auth: { uid: 'u1' } }), 'u1');
  assert.throws(() => authz.requireAdmin({ auth: { uid: 'u1', token: {} } }), { code: 'permission-denied' });
  assert.throws(() => authz.requireAdmin({ auth: { uid: 'u1', token: { admin: 'true' } } }), { code: 'permission-denied' });
  assert.equal(authz.requireAdmin({ auth: { uid: 'a', token: { admin: true } } }), 'a');
});

test('recent sign-in uses auth_time and fails closed', () => {
  const now = 1_800_000_000_000;
  const at = (secAgo) => ({ auth: { uid: 'u', token: { auth_time: now / 1000 - secAgo } } });
  assert.equal(authz.signedInRecently(at(10), now), true);
  assert.equal(authz.signedInRecently(at(300), now), true);
  assert.equal(authz.signedInRecently(at(301), now), false);
  assert.equal(authz.signedInRecently({ auth: { uid: 'u', token: {} } }, now), false);
  assert.throws(() => authz.requireListed({ memberUids: ['a'] }, 'memberUids', 'b'), { code: 'permission-denied' });
  authz.requireListed({ memberUids: ['a'] }, 'memberUids', 'a');
});

// ---- ledger ------------------------------------------------------------------
const baseEntry = {
  spaceId: 'circles', containerType: 'circle', containerId: 'c1', kind: 'contribution', status: 'claimed',
  fromUid: 'alice', toUid: 'bob', amountMinor: 5000, currency: 'EUR', method: 'revolut', cycle: 1,
  memberUids: ['alice', 'bob', 'carol'], idempotencyKey: 'k'.repeat(20), createdBy: 'alice',
};

test('buildEntry accepts a valid entry and stamps the schema version', () => {
  const e = ledger.buildEntry(baseEntry);
  assert.equal(e.schemaVersion, 1);
  assert.equal(e.refEntryId, null);
  assert.equal(e.reversesEntryId, null);
});

test('buildEntry rejects inconsistent entries', () => {
  const bad = [
    { ...baseEntry, containerType: 'loan' },
    { ...baseEntry, amountMinor: 0 },
    { ...baseEntry, amountMinor: 10.5 },
    { ...baseEntry, currency: 'NGN' },
    { ...baseEntry, toUid: 'alice' },
    { ...baseEntry, memberUids: ['bob'] },
    { ...baseEntry, status: 'confirmed' },
    { ...baseEntry, kind: 'reversal' },
    { ...baseEntry, reversesEntryId: 'e9' },
    { ...baseEntry, spaceId: 'expenses' },
    { ...baseEntry, surprise: 1 },
  ];
  for (const b of bad) assert.throws(() => ledger.buildEntry(b), /invalid ledger entry/);
});

test('post refuses a currency that differs from the container', () => {
  const created = [];
  const tx = { create: (ref, data) => created.push({ ref, data }) };
  const db = { collection: (name) => ({ doc: () => ({ id: `${name}-1` }) }) };
  assert.throws(() => ledger.post(tx, db, baseEntry, { containerCurrency: 'GBP', createdAt: 'T' }), /currency/);
  const id = ledger.post(tx, db, baseEntry, { containerCurrency: 'EUR', createdAt: 'T' });
  assert.equal(id, 'ledger-1');
  assert.equal(created[0].data.createdAt, 'T');
  assert.equal(ledger.collectionFor('events'), 'ledgerEntries');
  assert.throws(() => ledger.collectionFor('expenses'));
});

test('sumConfirmed separates containers and currencies and applies reversals', () => {
  const E = (o) => ({ spaceId: 'aid', containerId: 'a1', currency: 'EUR', kind: 'pledgePayment', ...o });
  const entries = [
    E({ entryId: 'c1', status: 'claimed', amountMinor: 1000 }),
    E({ entryId: 'k1', status: 'confirmed', refEntryId: 'c1', amountMinor: 1000 }),
    E({ entryId: 'c2', status: 'claimed', amountMinor: 700 }),               // not confirmed
    E({ entryId: 'c3', status: 'claimed', amountMinor: 300 }),
    E({ entryId: 'k3', status: 'declined', refEntryId: 'c3', amountMinor: 300 }),
    E({ entryId: 'c4', status: 'claimed', amountMinor: 200, currency: 'GBP' }),
    E({ entryId: 'k4', status: 'confirmed', refEntryId: 'c4', amountMinor: 200, currency: 'GBP' }),
    E({ entryId: 'x1', containerId: 'a2', status: 'confirmed', refEntryId: 'zz', amountMinor: 9999 }),
    E({ entryId: 'r1', kind: 'reversal', status: 'posted', reversesEntryId: 'c1', amountMinor: 250 }),
  ];
  assert.equal(ledger.sumConfirmed(entries, { spaceId: 'aid', containerId: 'a1', currency: 'EUR', kind: 'pledgePayment' }), 750);
  assert.equal(ledger.sumConfirmed(entries, { spaceId: 'aid', containerId: 'a1', currency: 'GBP', kind: 'pledgePayment' }), 200);
  assert.equal(ledger.sumConfirmed(entries, { spaceId: 'loans', containerId: 'a1', currency: 'EUR', kind: 'pledgePayment' }), 0);
});

// ---- audit -------------------------------------------------------------------
test('audit meta keeps short scalars and drops personal fields', () => {
  const m = audit.sanitiseMeta({
    flag: 'aidEnabled', enabled: true, count: 3, displayName: 'Alice', email: 'a@x', iban: 'IE..', note: 'hi',
    stepUpToken: 'secret', nested: { a: 1 }, long: 'x'.repeat(500), nan: NaN,
  });
  assert.deepEqual(Object.keys(m).sort(), ['count', 'enabled', 'flag', 'long']);
  assert.equal(m.long.length, 120);
  assert.throws(() => audit.auditRecord({ action: 'x' }, new Date()));
});

// ---- step-up origins ---------------------------------------------------------
test('only this project\'s origins may run the passkey ceremony', () => {
  assert.equal(stepUp.rpIdFor('https://splitsync-dev.web.app'), 'splitsync-dev.web.app');
  assert.equal(stepUp.rpIdFor('https://splitsync-dev--circles-review-ab12cd34.web.app'), 'splitsync-dev--circles-review-ab12cd34.web.app');
  assert.equal(stepUp.rpIdFor('http://localhost:3000'), 'localhost');
  for (const o of [
    'https://evil.web.app', 'https://splitsync-dev.web.app.evil.com', 'http://splitsync-dev.web.app',
    'https://other--x.web.app', 'https://splitsync-dev--x.web.app/path', undefined, null, '',
  ]) assert.equal(stepUp.rpIdFor(o), null, String(o));
});

test('consumeToken rejects malformed tokens before touching the database', async () => {
  const db = { collection: () => { throw new Error('should not be called'); } };
  await assert.rejects(stepUp.consumeToken(db, { uid: 'u', token: 'short', hash: 'h' }), (e) => e.details.stepUp === 'required');
  await assert.rejects(stepUp.consumeToken(db, { uid: 'u', token: undefined, hash: 'h' }), { code: 'unauthenticated' });
});

// ---- errors ------------------------------------------------------------------
test('unexpected errors become a generic internal error', () => {
  const orig = console.error; console.error = () => {};
  try {
    const e = errors.toHttpsError(new Error('db password in message'));
    assert.equal(e.code, 'internal');
    assert.ok(!e.message.includes('password'));
    const keep = errors.fail('not-found');
    assert.equal(errors.toHttpsError(keep), keep);
  } finally { console.error = orig; }
});
