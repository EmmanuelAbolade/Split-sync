// functions/settlements/service.js
// Settle-up in the Expenses space, done on the server (decision D1, Phase 1B).
//
//   start    payer opened a payment link: lock the pair ("did you pay?")
//   claim    payer says "I paid": claim + notifications, lock stays until answered
//   confirm  payee confirms a claim (step-up): the settlement entry is written
//   decline  payee did not receive it: nothing changes, payer is told
//   receive  payee records a payment themselves (step-up): entry written at once
//   cancel   payer drops a started payment, or withdraws an unanswered claim
//
// Balances change only on confirm or receive, and only the payee can do
// either (FR-SET-02). Settlement entries keep the existing expense shape so
// every screen and the balance calculator read them unchanged (FR-SET-03).
//
// Documents (default database):
//   pendingPayments/{groupId}_{from}_{to}  lock; status 'started' | 'claimed'
//                                          (missing status = 'started', older docs)
//   settlementClaims/{claimId}             server only; the authoritative claim
//   notifications/{id}                     payee action + payer log (existing types)
//   expenses/{id}                          the settlement entry (isSettlement: true)

const { FieldValue } = require('firebase-admin/firestore');
const { z, parse, uid: uidSchema, docId, idempotencyKey, stepUpToken } = require('../core/schemas');
const { fail } = require('../core/errors');
const { runIdempotent } = require('../core/idempotency');
const { requireStepUp } = require('../core/stepUp');
const { requireFlag } = require('../core/flags');
const audit = require('../core/audit');
const { owedMinor } = require('./balances');

const METHODS = ['paypal', 'revolut', 'bank', 'manual', 'sepa'];
const MAX_MINOR = 100000000; // 1,000,000.00, the limit SettleUpModal shows
const ROUNDING_SLACK_MINOR = 2; // client sums floats; allow a cent or two
const PENDING_TYPE = 'payment_confirmation_needed';

const amountMinor = z.number().int().positive().max(MAX_MINOR);
const method = z.enum(METHODS);

const schemas = {
  start: z.object({ groupId: docId, toUid: uidSchema, amountMinor, method }).strict(),
  claim: z.object({
    groupId: docId, toUid: uidSchema, amountMinor, method, idempotencyKey,
    paypalOrderId: z.string().min(1).max(64).regex(/^[A-Za-z0-9-]+$/).optional(),
  }).strict(),
  confirm: z.object({ notificationId: docId, stepUpToken }).strict(),
  decline: z.object({ notificationId: docId }).strict(),
  receive: z.object({ groupId: docId, fromUid: uidSchema, amountMinor, idempotencyKey, stepUpToken }).strict(),
  cancel: z.object({ groupId: docId, toUid: uidSchema }).strict(),
};

const lockId = (groupId, from, to) => `${groupId}_${from}_${to}`;
const fmt = (minor) => (minor / 100).toFixed(2);
const toAmount = (minor) => Number(fmt(minor));
const methodLabel = (m) => String(m || 'manual').toUpperCase();

function memberName(group, uid) {
  const m = (group.members || []).find((x) => x && x.userId === uid);
  return (m && m.name) || 'A member';
}

/** Loads the group and checks that both people are current members. */
async function loadPair(db, { groupId, caller, other }) {
  if (caller === other) throw fail('invalid-argument', 'You cannot settle up with yourself.');
  const snap = await db.collection('groups').doc(groupId).get();
  if (!snap.exists) throw fail('not-found');
  const group = snap.data();
  const ids = group.memberIds || [];
  if (!ids.includes(caller)) throw fail('permission-denied');
  if (!ids.includes(other)) throw fail('failed-precondition', 'That person is no longer in this group.');
  if (group.type === 'personal') throw fail('failed-precondition', 'Personal trackers have no one to settle up with.');
  const user = await db.collection('users').doc(caller).get();
  if (user.exists && user.data().isActive === false) throw fail('permission-denied');
  return group;
}

async function groupExpenses(db, groupId) {
  const qs = await db.collection('expenses').where('groupId', '==', groupId).get();
  return qs.docs.map((d) => d.data());
}

/** A payer may claim at most what they owe; a payee may record at most what the payer owes. */
async function checkOwed(db, groupId, payerUid, amount) {
  const owed = owedMinor(await groupExpenses(db, groupId), payerUid);
  if (owed === 0) throw fail('failed-precondition', 'There is nothing to settle here right now.');
  if (amount > owed + ROUNDING_SLACK_MINOR) {
    throw fail('invalid-argument', 'That is more than is owed. Please check the amount.');
  }
}

function settlementEntry({ groupId, group, payer, payee, amount, title, description, paymentMethod, extra }) {
  const value = toAmount(amount);
  return {
    groupId,
    title,
    amount: value,
    currency: group.currency,
    paidBy: payer,
    category: 'settlement',
    description,
    date: new Date(),
    splitMethod: 'exact',
    splits: { [payee]: value },
    participants: [payer, payee],
    createdAt: FieldValue.serverTimestamp(),
    isSettlement: true,
    paymentMethod,
    recordedVia: 'server',
    ...extra,
  };
}

// ---- start --------------------------------------------------------------------

async function start({ db, uid, data }) {
  const d = parse(schemas.start, data);
  const group = await loadPair(db, { groupId: d.groupId, caller: uid, other: d.toUid });
  await checkOwed(db, d.groupId, uid, d.amountMinor);
  const ref = db.collection('pendingPayments').doc(lockId(d.groupId, uid, d.toUid));
  await db.runTransaction(async (tx) => {
    const lock = await tx.get(ref);
    if (lock.exists && lock.data().status === 'claimed') {
      throw fail('failed-precondition', 'A payment to this person is already waiting for confirmation.');
    }
    tx.set(ref, {
      groupId: d.groupId,
      fromUserId: uid,
      toUserId: d.toUid,
      fromName: memberName(group, uid),
      toName: memberName(group, d.toUid),
      amount: toAmount(d.amountMinor),
      currency: group.currency,
      method: d.method,
      status: 'started',
      timestamp: Date.now(),
      createdAt: new Date(),
    });
  });
  return { status: 'started' };
}

// ---- claim ----------------------------------------------------------------------

async function claim({ db, uid, data }) {
  const d = parse(schemas.claim, data);
  // SEPA is only a simulation; it follows the demo switch.
  if (d.method === 'sepa') await requireFlag(db, 'paymentDemosEnabled', uid);
  const group = await loadPair(db, { groupId: d.groupId, caller: uid, other: d.toUid });
  await checkOwed(db, d.groupId, uid, d.amountMinor);

  const payerName = memberName(group, uid);
  const payeeName = memberName(group, d.toUid);
  const amountFixed = fmt(d.amountMinor);
  const label = methodLabel(d.method);
  const lockRef = db.collection('pendingPayments').doc(lockId(d.groupId, uid, d.toUid));

  const { result } = await runIdempotent(db, { uid, key: d.idempotencyKey, fn: 'settlements.claim', data: d }, async (tx) => {
    const lock = await tx.get(lockRef);
    if (lock.exists && lock.data().status === 'claimed') {
      throw fail('failed-precondition', 'A payment to this person is already waiting for confirmation.');
    }
    const claimRef = db.collection('settlementClaims').doc();
    const payeeRef = db.collection('notifications').doc();
    const payerRef = db.collection('notifications').doc();
    const shared = {
      groupId: d.groupId, groupName: group.name || '',
      payerId: uid, payerName, payeeId: d.toUid, payeeName,
      amount: toAmount(d.amountMinor), currency: group.currency, method: d.method,
      claimId: claimRef.id,
    };
    const now = FieldValue.serverTimestamp();

    tx.create(claimRef, {
      groupId: d.groupId, fromUid: uid, toUid: d.toUid,
      amountMinor: d.amountMinor, currency: group.currency, method: d.method,
      paypalOrderId: d.paypalOrderId || null,
      status: 'pending', payeeNotifId: payeeRef.id, payerLogNotifId: payerRef.id,
      createdAt: now,
    });
    tx.create(payeeRef, {
      userId: d.toUid,
      type: PENDING_TYPE,
      title: 'Payment Confirmation Needed',
      message: `${payerName} claims to have paid you ${group.currency} ${amountFixed} via ${label} in ${group.name}. Did you receive it?`,
      requiresAction: true,
      actionStatus: 'pending',
      data: { ...shared, payerLogNotifId: payerRef.id },
      read: false,
      createdAt: now,
    });
    tx.create(payerRef, {
      userId: uid,
      type: 'payment_log',
      title: 'Payment Sent — Awaiting Confirmation',
      message: `You paid ${group.currency} ${amountFixed} via ${label} to ${payeeName} in ${group.name}. Waiting for ${payeeName} to confirm.`,
      requiresAction: false,
      status: 'pending_confirmation',
      data: { ...shared, payeeNotifId: payeeRef.id },
      read: true,
      createdAt: now,
    });
    tx.set(lockRef, {
      groupId: d.groupId, fromUserId: uid, toUserId: d.toUid,
      fromName: payerName, toName: payeeName,
      amount: toAmount(d.amountMinor), currency: group.currency, method: d.method,
      status: 'claimed', claimId: claimRef.id,
      timestamp: Date.now(), createdAt: new Date(),
    });
    await audit.record(db, {
      actorUid: uid, action: 'settlements.claim', spaceId: 'expenses',
      targetPath: `settlementClaims/${claimRef.id}`,
      meta: { groupId: d.groupId, toUid: d.toUid, amountMinor: d.amountMinor, currency: group.currency, method: d.method },
    }, { tx });
    return { claimId: claimRef.id, status: 'pending' };
  });
  return result;
}

// ---- confirm / decline (payee answers a claim) ----------------------------------

/**
 * Reads everything a payee's answer needs inside `tx`. Claims made through
 * claim() carry data.claimId; older notifications (written by the app before
 * this phase) do not, and are checked against the group instead.
 */
async function readClaimForAnswer(tx, db, uid, notificationId) {
  const notifRef = db.collection('notifications').doc(notificationId);
  const notif = await tx.get(notifRef);
  if (!notif.exists) throw fail('not-found');
  const n = notif.data();
  const nd = n.data || {};
  if (n.userId !== uid || n.type !== PENDING_TYPE || nd.payeeId !== uid) throw fail('permission-denied');

  let claimRef = null;
  let claimDoc = null;
  if (nd.claimId) {
    claimRef = db.collection('settlementClaims').doc(String(nd.claimId));
    const c = await tx.get(claimRef);
    if (!c.exists) throw fail('not-found');
    claimDoc = c.data();
    if (claimDoc.toUid !== uid) throw fail('permission-denied');
  }

  const payer = claimDoc ? claimDoc.fromUid : nd.payerId;
  const groupId = claimDoc ? claimDoc.groupId : nd.groupId;
  if (typeof payer !== 'string' || typeof groupId !== 'string' || !payer || !groupId) throw fail('not-found');

  const groupSnap = await tx.get(db.collection('groups').doc(groupId));
  if (!groupSnap.exists) throw fail('not-found');
  const group = groupSnap.data();
  const ids = group.memberIds || [];
  if (!ids.includes(uid)) throw fail('permission-denied');

  let amount;
  if (claimDoc) {
    amount = claimDoc.amountMinor;
  } else {
    amount = Math.round(Number(nd.amount) * 100);
    if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_MINOR || nd.currency !== group.currency) {
      throw fail('failed-precondition', 'This payment cannot be confirmed. Please ask for it to be sent again.');
    }
  }

  const payerLogId = (claimDoc && claimDoc.payerLogNotifId) || nd.payerLogNotifId || null;
  const payerLogRef = payerLogId ? db.collection('notifications').doc(String(payerLogId)) : null;
  const payerLog = payerLogRef ? await tx.get(payerLogRef) : null;
  const lockRef = db.collection('pendingPayments').doc(lockId(groupId, payer, uid));
  const lock = await tx.get(lockRef);

  const status = claimDoc ? claimDoc.status : (n.actionStatus || 'pending');
  return {
    notifRef, n, nd, claimRef, claimDoc, payer, groupId, group, amount, status,
    payerStillMember: ids.includes(payer),
    payerLogRef: payerLog && payerLog.exists ? payerLogRef : null,
    lockRef, lock: lock.exists ? lock.data() : null,
  };
}

/** The lock belongs to this claim (or is an older lock with no claim attached). */
function lockMatches(c) {
  if (!c.lock) return false;
  if (c.lock.status !== 'claimed') return false;
  return !c.claimDoc || c.lock.claimId === c.claimRef.id;
}

async function confirm({ db, uid, data, nowMs = Date.now() }) {
  const d = parse(schemas.confirm, data);
  await requireStepUp(db, uid, 'settlements.confirm', d, nowMs);

  return db.runTransaction(async (tx) => {
    const c = await readClaimForAnswer(tx, db, uid, d.notificationId);
    if (c.status === 'confirmed') return { status: 'confirmed', replayed: true };
    if (c.status !== 'pending') throw fail('failed-precondition', 'This payment has already been answered.');
    if (!c.payerStillMember) throw fail('failed-precondition', 'That person is no longer in this group.');

    const payerName = c.nd.payerName || memberName(c.group, c.payer);
    const payeeName = c.nd.payeeName || memberName(c.group, uid);
    const paymentMethod = (c.claimDoc && c.claimDoc.method) || c.nd.method || 'manual';
    const expenseRef = db.collection('expenses').doc();
    const now = FieldValue.serverTimestamp();

    tx.create(expenseRef, settlementEntry({
      groupId: c.groupId, group: c.group, payer: c.payer, payee: uid, amount: c.amount,
      title: `Settlement: ${payerName} to ${payeeName}`,
      description: `${methodLabel(paymentMethod)} Payment — confirmed by ${payeeName}`,
      paymentMethod,
      extra: {
        confirmedAt: now, recordedBy: uid,
        ...(c.claimRef ? { claimId: c.claimRef.id } : {}),
        ...(c.claimDoc && c.claimDoc.paypalOrderId ? { paypalOrderId: c.claimDoc.paypalOrderId } : {}),
      },
    }));
    tx.update(c.notifRef, { requiresAction: false, actionStatus: 'confirmed', read: true, readAt: now });
    if (c.payerLogRef) {
      tx.update(c.payerLogRef, {
        status: 'confirmed',
        title: 'Payment Confirmed',
        message: `${payeeName} confirmed receiving ${c.group.currency} ${fmt(c.amount)} in ${c.group.name}. Your balance has been updated.`,
        read: false,
      });
    }
    if (c.claimRef) tx.update(c.claimRef, { status: 'confirmed', decidedAt: now, expenseId: expenseRef.id });
    if (lockMatches(c)) tx.delete(c.lockRef);
    await audit.record(db, {
      actorUid: uid, action: 'settlements.confirm', spaceId: 'expenses',
      targetPath: `expenses/${expenseRef.id}`,
      meta: { groupId: c.groupId, fromUid: c.payer, amountMinor: c.amount, currency: c.group.currency, legacy: !c.claimRef },
    }, { tx });
    return { status: 'confirmed', expenseId: expenseRef.id };
  });
}

async function decline({ db, uid, data }) {
  const d = parse(schemas.decline, data);
  return db.runTransaction(async (tx) => {
    const c = await readClaimForAnswer(tx, db, uid, d.notificationId);
    if (c.status === 'declined') return { status: 'declined', replayed: true };
    if (c.status !== 'pending') throw fail('failed-precondition', 'This payment has already been answered.');

    const payeeName = c.nd.payeeName || memberName(c.group, uid);
    const paymentMethod = (c.claimDoc && c.claimDoc.method) || c.nd.method || 'manual';
    const now = FieldValue.serverTimestamp();

    tx.update(c.notifRef, { requiresAction: false, actionStatus: 'declined', read: true, readAt: now });
    if (c.payerLogRef) {
      tx.update(c.payerLogRef, {
        status: 'declined',
        title: 'Payment Not Confirmed',
        message: `${payeeName} could not confirm your ${c.group.currency} ${fmt(c.amount)} ${methodLabel(paymentMethod)} payment in ${c.group.name}. Please check and retry.`,
        read: false,
      });
    }
    if (c.claimRef) tx.update(c.claimRef, { status: 'declined', decidedAt: now });
    if (lockMatches(c)) tx.delete(c.lockRef);
    await audit.record(db, {
      actorUid: uid, action: 'settlements.decline', spaceId: 'expenses',
      targetPath: c.claimRef ? `settlementClaims/${c.claimRef.id}` : `notifications/${d.notificationId}`,
      meta: { groupId: c.groupId, fromUid: c.payer, amountMinor: c.amount, legacy: !c.claimRef },
    }, { tx });
    return { status: 'declined' };
  });
}

// ---- receive (payee records a payment without a claim) ---------------------------

async function receive({ db, uid, data, nowMs = Date.now() }) {
  const d = parse(schemas.receive, data);
  await requireStepUp(db, uid, 'settlements.receive', d, nowMs);
  const group = await loadPair(db, { groupId: d.groupId, caller: uid, other: d.fromUid });
  await checkOwed(db, d.groupId, d.fromUid, d.amountMinor);

  const payerName = memberName(group, d.fromUid);
  const payeeName = memberName(group, uid);
  const lockRef = db.collection('pendingPayments').doc(lockId(d.groupId, d.fromUid, uid));

  const { result } = await runIdempotent(db, { uid, key: d.idempotencyKey, fn: 'settlements.receive', data: d }, async (tx) => {
    const lock = await tx.get(lockRef);
    if (lock.exists && lock.data().status === 'claimed') {
      throw fail('failed-precondition', 'This person has already told us they paid. Please confirm that payment instead.');
    }
    const expenseRef = db.collection('expenses').doc();
    const now = FieldValue.serverTimestamp();
    tx.create(expenseRef, settlementEntry({
      groupId: d.groupId, group, payer: d.fromUid, payee: uid, amount: d.amountMinor,
      title: `Settlement: ${payerName} → ${payeeName}`,
      description: 'Manual payment received',
      paymentMethod: 'manual',
      extra: { recordedBy: uid, confirmedAt: now },
    }));
    tx.create(db.collection('notifications').doc(), {
      userId: d.fromUid,
      type: 'payment',
      title: 'Payment Confirmed',
      message: `${payeeName} confirmed receiving ${group.currency} ${fmt(d.amountMinor)} from you in ${group.name}`,
      data: {
        groupId: d.groupId, amount: toAmount(d.amountMinor), currency: group.currency,
        toUserId: uid, toName: payeeName,
      },
      requiresAction: false,
      read: false,
      createdAt: now,
    });
    if (lock.exists) tx.delete(lockRef); // a started payment is now settled
    await audit.record(db, {
      actorUid: uid, action: 'settlements.receive', spaceId: 'expenses',
      targetPath: `expenses/${expenseRef.id}`,
      meta: { groupId: d.groupId, fromUid: d.fromUid, amountMinor: d.amountMinor, currency: group.currency },
    }, { tx });
    return { status: 'confirmed', expenseId: expenseRef.id };
  });
  return result;
}

// ---- cancel -----------------------------------------------------------------------

async function cancel({ db, uid, data }) {
  const d = parse(schemas.cancel, data);
  const lockRef = db.collection('pendingPayments').doc(lockId(d.groupId, uid, d.toUid));
  return db.runTransaction(async (tx) => {
    const lock = await tx.get(lockRef);
    if (!lock.exists) return { status: 'none' };
    const l = lock.data();
    if (l.status !== 'claimed') {
      tx.delete(lockRef);
      return { status: 'cancelled' };
    }
    // Withdraw an unanswered claim.
    const claimRef = l.claimId ? db.collection('settlementClaims').doc(String(l.claimId)) : null;
    const claimSnap = claimRef ? await tx.get(claimRef) : null;
    const c = claimSnap && claimSnap.exists ? claimSnap.data() : null;
    if (c && c.status !== 'pending') {
      tx.delete(lockRef);
      return { status: 'cancelled' };
    }
    const payeeRef = c && c.payeeNotifId ? db.collection('notifications').doc(c.payeeNotifId) : null;
    const payerRef = c && c.payerLogNotifId ? db.collection('notifications').doc(c.payerLogNotifId) : null;
    const payee = payeeRef ? await tx.get(payeeRef) : null;
    const payerLog = payerRef ? await tx.get(payerRef) : null;
    const now = FieldValue.serverTimestamp();
    if (c) tx.update(claimRef, { status: 'withdrawn', decidedAt: now });
    if (payee && payee.exists) tx.update(payeeRef, { requiresAction: false, actionStatus: 'withdrawn' });
    if (payerLog && payerLog.exists) {
      tx.update(payerRef, { status: 'withdrawn', title: 'Payment Withdrawn', message: 'You withdrew this payment claim.' });
    }
    tx.delete(lockRef);
    await audit.record(db, {
      actorUid: uid, action: 'settlements.cancel', spaceId: 'expenses',
      targetPath: claimRef ? `settlementClaims/${claimRef.id}` : `pendingPayments/${lockRef.id}`,
      meta: { groupId: d.groupId, toUid: d.toUid, withdrawn: true },
    }, { tx });
    return { status: 'withdrawn' };
  });
}

// ---- stale locks when balances change ---------------------------------------------

/**
 * A new ordinary expense changes what is owed, so payments that were only
 * started (not yet claimed) are dropped. Claims stay: the payer said they
 * paid, and the payee must still answer. Replaces the client-side clean-up
 * that AddExpenseModal used to do.
 */
async function clearStartedLocks(db, groupId) {
  const qs = await db.collection('pendingPayments').where('groupId', '==', groupId).get();
  const stale = qs.docs.filter((doc) => doc.data().status !== 'claimed');
  if (stale.length === 0) return 0;
  const batch = db.batch();
  stale.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return stale.length;
}

module.exports = {
  start, claim, confirm, decline, receive, cancel, clearStartedLocks,
  schemas, METHODS, lockId,
};
