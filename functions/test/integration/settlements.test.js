// Integration tests for settle-up on the server (Phase 1B), against the
// Firestore emulator. Run from the repo root: npm run test:functions:emulator

const { test, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run through `npm run test:functions:emulator` (needs the Firestore emulator).');
}

const admin = require('firebase-admin');
const app = admin.apps.length ? admin.app() : admin.initializeApp({ projectId: 'demo-splitsync' });
const db = admin.firestore(app);

const s = require('../../settlements/service');
const { owedMinor, netBalancesMinor } = require('../../settlements/balances');
const { issueToken } = require('../../core/stepUp');
const { actionHash } = require('../../core/canonical');
const flags = require('../../core/flags');

const KEY = (c) => c.repeat(20);

async function clear() {
  const res = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-splitsync/databases/(default)/documents`, { method: 'DELETE' });
  assert.ok(res.ok);
}

// Group g1: Bob paid 60.00 split with Alice, so Alice owes Bob 30.00.
async function seed() {
  await db.doc('groups/g1').set({
    name: 'Flat', currency: 'EUR', type: 'shared', memberIds: ['alice', 'bob', 'carol'],
    members: [{ userId: 'alice', name: 'Alice' }, { userId: 'bob', name: 'Bob' }, { userId: 'carol', name: 'Carol' }],
  });
  await db.doc('groups/other').set({ name: 'Other', currency: 'EUR', memberIds: ['dave', 'bob'], members: [] });
  await db.doc('expenses/e1').set({
    groupId: 'g1', amount: 60, paidBy: 'bob', participants: ['alice', 'bob'], splits: { alice: 30, bob: 30 },
  });
}

before(clear);
beforeEach(async () => { await clear(); await seed(); });

/** A valid step-up token for exactly this action and data. */
async function token(uid, action, data) {
  const hash = actionHash(action, data);
  return db.runTransaction(async (tx) => issueToken(tx, db, { uid, hash, method: 'recentLogin' }));
}

async function expensesIn(groupId = 'g1') {
  return (await db.collection('expenses').where('groupId', '==', groupId).get()).docs.map((d) => d.data());
}

const lock = (from = 'alice', to = 'bob') => db.doc(`pendingPayments/g1_${from}_${to}`).get();
const claimData = (over = {}) => ({ groupId: 'g1', toUid: 'bob', amountMinor: 3000, method: 'revolut', idempotencyKey: KEY('a'), ...over });

async function confirmAs(uid, notificationId) {
  const data = { notificationId };
  return s.confirm({ db, uid, data: { ...data, stepUpToken: await token(uid, 'settlements.confirm', data) } });
}

async function payeeNotif(claimId) {
  const qs = await db.collection('notifications').where('data.claimId', '==', claimId).get();
  return qs.docs.find((d) => d.data().type === 'payment_confirmation_needed');
}

// ---- balances --------------------------------------------------------------------
test('server balances match the client calculator and ignore deleted expenses', async () => {
  const ex = await expensesIn();
  assert.deepEqual(netBalancesMinor(ex), { bob: 3000, alice: -3000 });
  assert.equal(owedMinor(ex, 'alice'), 3000);
  assert.equal(owedMinor(ex, 'bob'), 0);
  assert.equal(owedMinor([...ex, { ...ex[0], status: 'deleted', amount: 999 }], 'alice'), 3000);
});

// ---- claim ---------------------------------------------------------------------------
test('claim: records the claim and both notifications, locks the pair, changes no balance', async () => {
  const r = await s.claim({ db, uid: 'alice', data: claimData() });
  assert.equal(r.status, 'pending');

  const c = (await db.doc(`settlementClaims/${r.claimId}`).get()).data();
  assert.equal(c.fromUid, 'alice');
  assert.equal(c.toUid, 'bob');
  assert.equal(c.amountMinor, 3000);
  assert.equal(c.currency, 'EUR');
  assert.equal(c.status, 'pending');

  const payee = (await db.doc(`notifications/${c.payeeNotifId}`).get()).data();
  assert.equal(payee.userId, 'bob');
  assert.equal(payee.type, 'payment_confirmation_needed');
  assert.equal(payee.actionStatus, 'pending');
  assert.equal(payee.data.amount, 30);
  assert.match(payee.message, /Alice claims to have paid you EUR 30\.00 via REVOLUT in Flat/);
  const log = (await db.doc(`notifications/${c.payerLogNotifId}`).get()).data();
  assert.equal(log.userId, 'alice');
  assert.equal(log.type, 'payment_log');

  const l = (await lock()).data();
  assert.equal(l.status, 'claimed');
  assert.equal(l.claimId, r.claimId);
  assert.equal((await expensesIn()).length, 1, 'no settlement until the payee confirms');
  assert.equal((await db.collection('auditLog').where('action', '==', 'settlements.claim').get()).size, 1);
});

test('claim: a retry with the same key returns the same claim; a second claim is refused', async () => {
  const a = await s.claim({ db, uid: 'alice', data: claimData() });
  const b = await s.claim({ db, uid: 'alice', data: claimData() });
  assert.equal(a.claimId, b.claimId);
  assert.equal((await db.collection('settlementClaims').get()).size, 1);
  await assert.rejects(s.claim({ db, uid: 'alice', data: claimData({ idempotencyKey: KEY('b') }) }), { code: 'failed-precondition' });
});

test('claim: only the debtor, only within what they owe, only between members', async () => {
  await assert.rejects(s.claim({ db, uid: 'bob', data: claimData({ toUid: 'alice' }) }), { code: 'failed-precondition' }, 'Bob owes nothing');
  await assert.rejects(s.claim({ db, uid: 'alice', data: claimData({ amountMinor: 3100 }) }), { code: 'invalid-argument' });
  await assert.rejects(s.claim({ db, uid: 'alice', data: claimData({ toUid: 'alice' }) }), { code: 'invalid-argument' });
  await assert.rejects(s.claim({ db, uid: 'alice', data: claimData({ toUid: 'dave' }) }), { code: 'failed-precondition' });
  await assert.rejects(s.claim({ db, uid: 'dave', data: claimData() }), { code: 'permission-denied' });
  await assert.rejects(s.claim({ db, uid: 'alice', data: claimData({ groupId: 'nope' }) }), { code: 'not-found' });
  await assert.rejects(s.claim({ db, uid: 'alice', data: { ...claimData(), payerUid: 'carol' } }), { code: 'invalid-argument' }, 'unknown keys refused');
  await assert.rejects(s.claim({ db, uid: 'alice', data: claimData({ amountMinor: 10.5 }) }), { code: 'invalid-argument' });
  await db.doc('users/alice').set({ isActive: false });
  await assert.rejects(s.claim({ db, uid: 'alice', data: claimData() }), { code: 'permission-denied' }, 'suspended');
});

test('claim: the SEPA simulation only works while paymentDemosEnabled is on for the payer', async () => {
  flags.clearCache();
  await assert.rejects(s.claim({ db, uid: 'alice', data: claimData({ method: 'sepa' }) }), { code: 'failed-precondition' });
  await db.doc('config/features').set({ paymentDemosEnabled: { enabled: false, allowUids: ['alice'] } });
  flags.clearCache();
  const r = await s.claim({ db, uid: 'alice', data: claimData({ method: 'sepa' }) });
  assert.equal(r.status, 'pending');
  flags.clearCache();
});

// ---- confirm ---------------------------------------------------------------------------
test('confirm: needs step-up and the payee; writes the settlement entry once', async () => {
  const { claimId } = await s.claim({ db, uid: 'alice', data: claimData() });
  const notif = await payeeNotif(claimId);

  await assert.rejects(s.confirm({ db, uid: 'bob', data: { notificationId: notif.id } }), { code: 'invalid-argument' });
  await assert.rejects(s.confirm({ db, uid: 'bob', data: { notificationId: notif.id, stepUpToken: 'x'.repeat(40) } }), (e) => e.details && e.details.stepUp === 'required');
  await assert.rejects(confirmAs('alice', notif.id), { code: 'permission-denied' }, 'the payer cannot confirm their own claim');
  await assert.rejects(confirmAs('carol', notif.id), { code: 'permission-denied' });

  const r = await confirmAs('bob', notif.id);
  assert.equal(r.status, 'confirmed');
  const entry = (await db.doc(`expenses/${r.expenseId}`).get()).data();
  assert.equal(entry.isSettlement, true);
  assert.equal(entry.paidBy, 'alice');
  assert.equal(entry.amount, 30);
  assert.deepEqual(entry.splits, { bob: 30 });
  assert.deepEqual(entry.participants, ['alice', 'bob']);
  assert.equal(entry.currency, 'EUR');
  assert.equal(entry.claimId, claimId);
  assert.equal(entry.recordedBy, 'bob');
  assert.equal(owedMinor(await expensesIn(), 'alice'), 0, 'Alice is settled');

  assert.equal((await db.doc(`notifications/${notif.id}`).get()).data().actionStatus, 'confirmed');
  const c = (await db.doc(`settlementClaims/${claimId}`).get()).data();
  assert.equal(c.status, 'confirmed');
  assert.equal((await db.doc(`notifications/${c.payerLogNotifId}`).get()).data().status, 'confirmed');
  assert.equal((await lock()).exists, false, 'lock released');

  const again = await confirmAs('bob', notif.id);
  assert.equal(again.replayed, true);
  assert.equal((await expensesIn()).length, 2, 'still only one settlement');
  await assert.rejects(s.decline({ db, uid: 'bob', data: { notificationId: notif.id } }), { code: 'failed-precondition' });
});

test('confirm: a token for another notification is refused', async () => {
  const { claimId } = await s.claim({ db, uid: 'alice', data: claimData() });
  const notif = await payeeNotif(claimId);
  const wrong = await token('bob', 'settlements.confirm', { notificationId: 'someOtherId' });
  await assert.rejects(s.confirm({ db, uid: 'bob', data: { notificationId: notif.id, stepUpToken: wrong } }), (e) => e.details && e.details.stepUp === 'required');
});

test('confirm: older notifications without a claim still work, and are checked against the group', async () => {
  const legacy = {
    userId: 'bob', type: 'payment_confirmation_needed', requiresAction: true, actionStatus: 'pending',
    data: { groupId: 'g1', groupName: 'Flat', payerId: 'alice', payerName: 'Alice', payeeId: 'bob', payeeName: 'Bob', amount: 12.5, currency: 'EUR', method: 'paypal', payerLogNotifId: 'log1' },
  };
  await db.doc('notifications/old1').set(legacy);
  await db.doc('notifications/log1').set({ userId: 'alice', type: 'payment_log', status: 'pending_confirmation' });
  await db.doc('notifications/old2').set({ ...legacy, data: { ...legacy.data, currency: 'USD' } });

  const r = await confirmAs('bob', 'old1');
  const entry = (await db.doc(`expenses/${r.expenseId}`).get()).data();
  assert.equal(entry.amount, 12.5);
  assert.equal(entry.paymentMethod, 'paypal');
  assert.equal((await db.doc('notifications/log1').get()).data().status, 'confirmed');
  await assert.rejects(confirmAs('bob', 'old2'), { code: 'failed-precondition' }, 'currency must match the group');
});

// ---- decline ----------------------------------------------------------------------------
test('decline: nothing is recorded, the payer is told, and they can claim again', async () => {
  const { claimId } = await s.claim({ db, uid: 'alice', data: claimData() });
  const notif = await payeeNotif(claimId);
  await assert.rejects(s.decline({ db, uid: 'alice', data: { notificationId: notif.id } }), { code: 'permission-denied' });

  assert.deepEqual(await s.decline({ db, uid: 'bob', data: { notificationId: notif.id } }), { status: 'declined' });
  assert.equal((await expensesIn()).length, 1);
  const c = (await db.doc(`settlementClaims/${claimId}`).get()).data();
  assert.equal(c.status, 'declined');
  assert.equal((await db.doc(`notifications/${c.payerLogNotifId}`).get()).data().status, 'declined');
  assert.equal((await lock()).exists, false);
  await assert.rejects(confirmAs('bob', notif.id), { code: 'failed-precondition' });
  const again = await s.claim({ db, uid: 'alice', data: claimData({ idempotencyKey: KEY('c') }) });
  assert.equal(again.status, 'pending');
});

// ---- receive -------------------------------------------------------------------------------
test('receive: the payee records a payment with step-up; the payer is notified', async () => {
  const data = { groupId: 'g1', fromUid: 'alice', amountMinor: 1000, idempotencyKey: KEY('r') };
  await assert.rejects(s.receive({ db, uid: 'bob', data: { ...data, stepUpToken: 'y'.repeat(40) } }), (e) => e.details && e.details.stepUp === 'required');

  await s.start({ db, uid: 'alice', data: { groupId: 'g1', toUid: 'bob', amountMinor: 3000, method: 'revolut' } });
  const r = await s.receive({ db, uid: 'bob', data: { ...data, stepUpToken: await token('bob', 'settlements.receive', data) } });
  const entry = (await db.doc(`expenses/${r.expenseId}`).get()).data();
  assert.equal(entry.isSettlement, true);
  assert.equal(entry.paidBy, 'alice');
  assert.equal(entry.amount, 10);
  assert.equal(entry.description, 'Manual payment received');
  assert.equal(owedMinor(await expensesIn(), 'alice'), 2000);
  const n = (await db.collection('notifications').where('userId', '==', 'alice').get()).docs.map((d) => d.data());
  assert.equal(n.length, 1);
  assert.equal(n[0].title, 'Payment Confirmed');
  assert.equal((await lock()).exists, false, 'the started payment is cleared');
});

test('receive: refused beyond what is owed, for non-members, and while a claim waits', async () => {
  const mk = async (uid, over) => {
    const data = { groupId: 'g1', fromUid: 'alice', amountMinor: 1000, idempotencyKey: KEY('q'), ...over };
    return s.receive({ db, uid, data: { ...data, stepUpToken: await token(uid, 'settlements.receive', data) } });
  };
  await assert.rejects(mk('bob', { amountMinor: 5000 }), { code: 'invalid-argument' });
  await assert.rejects(mk('dave', {}), { code: 'permission-denied' });
  await assert.rejects(mk('alice', { fromUid: 'bob' }), { code: 'failed-precondition' }, 'Bob owes nothing');
  await s.claim({ db, uid: 'alice', data: claimData() });
  await assert.rejects(mk('bob', { idempotencyKey: KEY('z') }), { code: 'failed-precondition' });
});

// ---- start / cancel / stale locks -----------------------------------------------------------
test('start and cancel: a started payment can be dropped; a claim is withdrawn', async () => {
  await s.start({ db, uid: 'alice', data: { groupId: 'g1', toUid: 'bob', amountMinor: 3000, method: 'paypal' } });
  const l = (await lock()).data();
  assert.equal(l.status, 'started');
  assert.equal(l.toName, 'Bob');
  assert.equal(l.amount, 30);
  assert.deepEqual(await s.cancel({ db, uid: 'alice', data: { groupId: 'g1', toUid: 'bob' } }), { status: 'cancelled' });
  assert.equal((await lock()).exists, false);
  assert.deepEqual(await s.cancel({ db, uid: 'alice', data: { groupId: 'g1', toUid: 'bob' } }), { status: 'none' });

  const { claimId } = await s.claim({ db, uid: 'alice', data: claimData() });
  await assert.rejects(s.start({ db, uid: 'alice', data: { groupId: 'g1', toUid: 'bob', amountMinor: 3000, method: 'paypal' } }), { code: 'failed-precondition' });
  assert.deepEqual(await s.cancel({ db, uid: 'alice', data: { groupId: 'g1', toUid: 'bob' } }), { status: 'withdrawn' });
  assert.equal((await db.doc(`settlementClaims/${claimId}`).get()).data().status, 'withdrawn');
  const notif = await payeeNotif(claimId);
  assert.equal(notif.data().actionStatus, 'withdrawn');
  await assert.rejects(confirmAs('bob', notif.id), { code: 'failed-precondition' });
});

test('a new expense clears started payments but keeps claims', async () => {
  await s.start({ db, uid: 'alice', data: { groupId: 'g1', toUid: 'bob', amountMinor: 3000, method: 'paypal' } });
  await db.doc('pendingPayments/g1_carol_bob').set({ groupId: 'g1', fromUserId: 'carol', toUserId: 'bob' }); // older doc, no status
  await db.doc('pendingPayments/g1_x_y').set({ groupId: 'g1', fromUserId: 'x', toUserId: 'y', status: 'claimed' });
  assert.equal(await s.clearStartedLocks(db, 'g1'), 2);
  const left = (await db.collection('pendingPayments').get()).docs.map((d) => d.id);
  assert.deepEqual(left, ['g1_x_y']);
});
