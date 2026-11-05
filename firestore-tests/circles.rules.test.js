// Security rules tests for the `circles` database (firestore.circles.rules).
//
// @firebase/rules-unit-testing only addresses the emulator's default
// database, so this file loads the circles rules there. The rules never refer
// to the database name, so the logic tested is exactly what is deployed to
// `circles`. Files run one at a time (see package.json) because each loads its
// own rules.

const { test, before, after, beforeEach } = require('node:test');
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs } = require('firebase/firestore');

let env;
const ALICE = 'alice', BOB = 'bob', CAROL = 'carol', MALLORY = 'mallory', ADMIN = 'admin';

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-splitsync',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.circles.rules'), 'utf8') },
  });
});
after(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const put = (p, d) => setDoc(doc(db, p), d);
    await put('circles/c1', { name: 'Ajo', memberUids: [ALICE, BOB], status: 'active', currency: 'EUR' });
    await put('circles/c1/cycles/1', { recipientUid: ALICE, status: 'open' });
    await put('circleInvites/i1', { circleId: 'c1', circleName: 'Ajo', createdBy: ALICE });
    await put('loanRequests/lr1', { borrowerUid: ALICE, lenderUid: BOB, amountMinor: 5000, status: 'pending' });
    await put('loans/l1', { borrowerUid: ALICE, lenderUid: BOB, partyUids: [ALICE, BOB], status: 'active' });
    await put('aidRequests/a1', { requesterUid: ALICE, adminUid: CAROL, memberUids: [ALICE, BOB, CAROL], status: 'pending-review' });
    await put('aidRequests/a2', { requesterUid: ALICE, adminUid: CAROL, memberUids: [ALICE, BOB, CAROL], status: 'open' });
    await put('aidRequests/a2/pledges/p1', { uid: BOB, amountMinor: 1000, anonymous: true });
    await put('aidPrivate/a2', { note: 'private', readerUids: [ALICE, CAROL] });
    await put('requests/q1', { recipientUid: BOB, senderUid: ALICE, kind: 'loan', delivery: 'held', status: 'new' });
    await put('privacy/bob', { loans: 'trusted', aid: 'trusted', direct: 'groups', holdOthers: true });
    await put('trust/alice', { score: 80 });
    await put('ledger/e1', { containerId: 'c1', memberUids: [ALICE, BOB], amountMinor: 5000, currency: 'EUR' });
    await put('locks/k1', { uid: ALICE, entryId: 'e1' });
    await put('idempotency/alice_k', { fn: 'x' });
    await put('rateLimits/r1', { count: 1 });
    await put('auditLog/z1', { actorUid: ALICE, action: 'x' });
  });
});

const as = (uid, claims = {}) => env.authenticatedContext(uid, claims).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const admin = () => as(ADMIN, { admin: true });

// ---- reads ----------------------------------------------------------------------
test('circles: members read the circle and its cycles; others do not', async () => {
  await assertSucceeds(getDoc(doc(as(ALICE), 'circles/c1')));
  await assertSucceeds(getDoc(doc(as(BOB), 'circles/c1/cycles/1')));
  await assertFails(getDoc(doc(as(MALLORY), 'circles/c1')));
  await assertFails(getDoc(doc(as(MALLORY), 'circles/c1/cycles/1')));
  await assertFails(getDoc(doc(anon(), 'circles/c1')));
  await assertFails(getDoc(doc(admin(), 'circles/c1')));
});

test('circles: "my circles" query works; a broad read does not', async () => {
  await assertSucceeds(getDocs(query(collection(as(ALICE), 'circles'), where('memberUids', 'array-contains', ALICE))));
  await assertFails(getDocs(collection(as(ALICE), 'circles')));
});

test('circle invites: get by id only, never list', async () => {
  await assertSucceeds(getDoc(doc(as(MALLORY), 'circleInvites/i1')));
  await assertFails(getDocs(collection(as(MALLORY), 'circleInvites')));
  await assertFails(getDoc(doc(anon(), 'circleInvites/i1')));
});

test('loan requests: borrower only (the lender reads their inbox item instead)', async () => {
  await assertSucceeds(getDoc(doc(as(ALICE), 'loanRequests/lr1')));
  await assertFails(getDoc(doc(as(BOB), 'loanRequests/lr1')));
  await assertFails(getDoc(doc(admin(), 'loanRequests/lr1')));
});

test('loans: the two parties only', async () => {
  await assertSucceeds(getDoc(doc(as(ALICE), 'loans/l1')));
  await assertSucceeds(getDoc(doc(as(BOB), 'loans/l1')));
  await assertFails(getDoc(doc(as(CAROL), 'loans/l1')));
});

test('aid: members see it only once open; requester and admin always', async () => {
  await assertSucceeds(getDoc(doc(as(ALICE), 'aidRequests/a1')));
  await assertSucceeds(getDoc(doc(as(CAROL), 'aidRequests/a1')));
  await assertFails(getDoc(doc(as(BOB), 'aidRequests/a1')));
  await assertSucceeds(getDoc(doc(as(BOB), 'aidRequests/a2')));
  await assertFails(getDoc(doc(as(MALLORY), 'aidRequests/a2')));
});

test('aid pledges: the giver and the requester only', async () => {
  await assertSucceeds(getDoc(doc(as(BOB), 'aidRequests/a2/pledges/p1')));
  await assertSucceeds(getDoc(doc(as(ALICE), 'aidRequests/a2/pledges/p1')));
  await assertFails(getDoc(doc(as(CAROL), 'aidRequests/a2/pledges/p1')));
});

test('aid private notes: listed readers only, not platform admins', async () => {
  await assertSucceeds(getDoc(doc(as(ALICE), 'aidPrivate/a2')));
  await assertSucceeds(getDoc(doc(as(CAROL), 'aidPrivate/a2')));
  await assertFails(getDoc(doc(as(BOB), 'aidPrivate/a2')));
  await assertFails(getDoc(doc(admin(), 'aidPrivate/a2')));
});

test('inbox: recipient only; the sender cannot see a held request', async () => {
  await assertSucceeds(getDoc(doc(as(BOB), 'requests/q1')));
  await assertFails(getDoc(doc(as(ALICE), 'requests/q1')));
  await assertFails(getDoc(doc(admin(), 'requests/q1')));
  await assertSucceeds(getDocs(query(collection(as(BOB), 'requests'), where('recipientUid', '==', BOB))));
  await assertFails(getDocs(query(collection(as(ALICE), 'requests'), where('senderUid', '==', ALICE))));
});

test('trust score, ledger and locks', async () => {
  await assertSucceeds(getDoc(doc(as(ALICE), 'trust/alice')));
  await assertFails(getDoc(doc(as(BOB), 'trust/alice')));
  await assertSucceeds(getDoc(doc(as(BOB), 'ledger/e1')));
  await assertFails(getDoc(doc(as(CAROL), 'ledger/e1')));
  await assertSucceeds(getDoc(doc(as(ALICE), 'locks/k1')));
  await assertFails(getDoc(doc(as(BOB), 'locks/k1')));
});

test('server-only collections are closed; admins may read the audit log only', async () => {
  for (const p of ['idempotency/alice_k', 'rateLimits/r1', 'auditLog/z1']) {
    await assertFails(getDoc(doc(as(ALICE), p)));
  }
  await assertFails(getDoc(doc(admin(), 'idempotency/alice_k')));
  await assertSucceeds(getDoc(doc(admin(), 'auditLog/z1')));
  await assertFails(getDoc(doc(as(ALICE), 'somethingElse/x')));
});

// ---- writes ----------------------------------------------------------------------
test('every client write to money data is denied, for members and admins too', async () => {
  const targets = [
    ['circles/c1', ALICE], ['circles/c1/cycles/1', ALICE], ['circles/new', ALICE], ['circleInvites/i2', ALICE],
    ['loanRequests/lr2', ALICE], ['loans/l1', BOB], ['aidRequests/a2', ALICE], ['aidRequests/a2/pledges/p2', BOB],
    ['aidPrivate/a2', ALICE], ['requests/q2', ALICE], ['trust/alice', ALICE], ['ledger/e2', ALICE],
    ['locks/k2', ALICE], ['idempotency/alice_x', ALICE], ['rateLimits/r2', ALICE], ['auditLog/z2', ALICE],
  ];
  for (const [p, who] of targets) {
    await assertFails(setDoc(doc(as(who), p), { amountMinor: 1, memberUids: [who], uid: who }));
    await assertFails(setDoc(doc(admin(), p), { amountMinor: 1 }));
  }
  await assertFails(updateDoc(doc(as(ALICE), 'ledger/e1'), { amountMinor: 1 }));
  await assertFails(deleteDoc(doc(as(ALICE), 'ledger/e1')));
  await assertFails(updateDoc(doc(as(ALICE), 'circles/c1'), { status: 'completed' }));
});

// ---- owner-managed settings --------------------------------------------------------
test('privacy: the owner writes valid values only', async () => {
  const ok = { loans: 'nobody', aid: 'groups', direct: 'trusted', holdOthers: false };
  await assertSucceeds(setDoc(doc(as(BOB), 'privacy/bob'), ok));
  await assertSucceeds(getDoc(doc(as(BOB), 'privacy/bob')));
  await assertFails(getDoc(doc(as(ALICE), 'privacy/bob')));
  await assertFails(getDoc(doc(admin(), 'privacy/bob')));
  await assertFails(setDoc(doc(as(ALICE), 'privacy/bob'), ok));
  await assertFails(setDoc(doc(as(BOB), 'privacy/bob'), { ...ok, loans: 'everyone' }));
  await assertFails(setDoc(doc(as(BOB), 'privacy/bob'), { ...ok, holdOthers: 'no' }));
  await assertFails(setDoc(doc(as(BOB), 'privacy/bob'), { ...ok, extra: 1 }));
  await assertFails(setDoc(doc(as(BOB), 'privacy/bob'), { loans: 'nobody', aid: 'groups', direct: 'trusted' }));
  await assertFails(deleteDoc(doc(as(BOB), 'privacy/bob')));
});

test('trusted and blocked lists: owner only, not yourself, timestamp only', async () => {
  for (const list of ['trusted', 'blocked']) {
    await assertSucceeds(setDoc(doc(as(BOB), `${list}/bob/people/alice`), { addedAt: new Date() }));
    await assertSucceeds(getDoc(doc(as(BOB), `${list}/bob/people/alice`)));
    await assertSucceeds(deleteDoc(doc(as(BOB), `${list}/bob/people/alice`)));
    await assertFails(setDoc(doc(as(BOB), `${list}/bob/people/bob`), { addedAt: new Date() }));
    await assertFails(setDoc(doc(as(ALICE), `${list}/bob/people/carol`), { addedAt: new Date() }));
    await assertFails(setDoc(doc(as(BOB), `${list}/bob/people/carol`), { addedAt: new Date(), note: 'x' }));
    await assertFails(getDoc(doc(as(ALICE), `${list}/bob/people/alice`)));
  }
});
