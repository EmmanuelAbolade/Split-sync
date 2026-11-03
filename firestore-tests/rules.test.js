// Firestore security rules tests — exercise the same reads/writes the app makes.
// Run from the repo root:
//   firebase emulators:exec --only firestore --project demo-splitsync "npm --prefix firestore-tests test"

const { test, before, after, beforeEach } = require('node:test');
const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment, assertSucceeds, assertFails,
} = require('@firebase/rules-unit-testing');
const {
  doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, getDocs,
  arrayUnion, arrayRemove,
} = require('firebase/firestore');

let env;

const ALICE = 'alice', BOB = 'bob', CAROL = 'carol', MALLORY = 'mallory', ADMIN = 'admin';

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-splitsync',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') },
  });
});
after(async () => { await env.cleanup(); });

// Seed: g1 shared (alice owner, bob member; carol left → removed from both lists),
//       g2 shared (alice only), p1 personal (alice), g3 (mallory only)
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const m = (id, role = 'member') => ({ userId: id, name: id, email: `${id}@x.com`, role });
    await setDoc(doc(db, 'groups/g1'), { name: 'Trip', type: 'shared', createdBy: ALICE, memberIds: [ALICE, BOB], members: [m(ALICE, 'owner'), m(BOB)], formerMembers: [{ userId: CAROL, name: 'Carol' }] });
    await setDoc(doc(db, 'groups/g2'), { name: 'Solo', type: 'shared', createdBy: ALICE, memberIds: [ALICE], members: [m(ALICE, 'owner')] });
    await setDoc(doc(db, 'groups/p1'), { name: 'Me', type: 'personal', createdBy: ALICE, memberIds: [ALICE], members: [m(ALICE, 'owner')] });
    await setDoc(doc(db, 'groups/g3'), { name: 'Other', createdBy: MALLORY, memberIds: [MALLORY], members: [m(MALLORY, 'owner')] });
    await setDoc(doc(db, 'expenses/e1'), { groupId: 'g1', title: 'Hotel', amount: 100, paidBy: ALICE, participants: [ALICE, BOB], splits: { [ALICE]: 50, [BOB]: 50 }, createdBy: ALICE });
    await setDoc(doc(db, 'expenses/e2'), { groupId: 'g2', title: 'Solo exp', amount: 5, paidBy: ALICE, participants: [ALICE], splits: { [ALICE]: 5 }, createdBy: ALICE });
    await setDoc(doc(db, 'users/alice'), { displayName: 'Alice', isActive: true });
    await setDoc(doc(db, 'users/bob'), { displayName: 'Bob' });
    await setDoc(doc(db, 'users/mallory'), { displayName: 'Mallory', isActive: false });
    await setDoc(doc(db, 'notifications/n-payee'), { userId: BOB, type: 'payment_confirmation_needed', read: false, data: { groupId: 'g1', payerId: ALICE, payeeId: BOB, amount: 50 } });
    await setDoc(doc(db, 'notifications/n-log'), { userId: ALICE, type: 'payment_log', read: true, status: 'pending_confirmation', data: { groupId: 'g1', payerId: ALICE, payeeId: BOB, amount: 50 } });
  });
});

const as = (uid, claims) => env.authenticatedContext(uid, claims).firestore();
const expense = (groupId, extra = {}) => ({ groupId, title: 't', amount: 10, paidBy: ALICE, participants: [ALICE], splits: { [ALICE]: 10 }, ...extra });

// ── Expense reads ────────────────────────────────────────────────────────────
test('member can query their group expenses (GroupDetails/Dashboard ==)', async () => {
  await assertSucceeds(getDocs(query(collection(as(BOB), 'expenses'), where('groupId', '==', 'g1'))));
});
test('member can query several groups with `in` (Activity/Profile)', async () => {
  await assertSucceeds(getDocs(query(collection(as(ALICE), 'expenses'), where('groupId', 'in', ['g1', 'g2']))));
});
test('non-member cannot query or read another group\'s expenses', async () => {
  await assertFails(getDocs(query(collection(as(MALLORY), 'expenses'), where('groupId', '==', 'g1'))));
  await assertFails(getDoc(doc(as(MALLORY), 'expenses/e1')));
});
test('`in` query including a group the user is not in is rejected', async () => {
  await assertFails(getDocs(query(collection(as(BOB), 'expenses'), where('groupId', 'in', ['g1', 'g2']))));
});
test('nobody can list the whole expenses collection except an admin', async () => {
  await assertFails(getDocs(collection(as(ALICE), 'expenses')));
  await assertSucceeds(getDocs(collection(as(ADMIN, { admin: true }), 'expenses')));
});
test('a former member (left) cannot read the group expenses', async () => {
  await assertFails(getDocs(query(collection(as(CAROL), 'expenses'), where('groupId', '==', 'g1'))));
});

// ── Expense writes ───────────────────────────────────────────────────────────
test('member adds an expense; settlement without createdBy is allowed', async () => {
  await assertSucceeds(addDoc(collection(as(BOB), 'expenses'), expense('g1', { createdBy: BOB })));
  await assertSucceeds(addDoc(collection(as(BOB), 'expenses'), expense('g1', { isSettlement: true })));
});
test('non-member / former member cannot add an expense', async () => {
  await assertFails(addDoc(collection(as(MALLORY), 'expenses'), expense('g1', { createdBy: MALLORY })));
  await assertFails(addDoc(collection(as(CAROL), 'expenses'), expense('g1', { createdBy: CAROL })));
});
test('cannot create an expense as someone else', async () => {
  await assertFails(addDoc(collection(as(BOB), 'expenses'), expense('g1', { createdBy: ALICE })));
});
test('suspended user cannot add expenses even in their own group', async () => {
  await assertFails(addDoc(collection(as(MALLORY), 'expenses'), expense('g3', { createdBy: MALLORY })));
});
test('member edits/archives but cannot move an expense to another group', async () => {
  await assertSucceeds(updateDoc(doc(as(BOB), 'expenses/e1'), { status: 'archived' }));
  await assertFails(updateDoc(doc(as(ALICE), 'expenses/e1'), { groupId: 'g2' }));
});
test('non-member cannot edit or delete an expense', async () => {
  await assertFails(updateDoc(doc(as(MALLORY), 'expenses/e1'), { amount: 1 }));
  await assertFails(deleteDoc(doc(as(MALLORY), 'expenses/e1')));
});

// ── Groups ───────────────────────────────────────────────────────────────────
test('create group only as sole initial member and owner', async () => {
  await assertSucceeds(setDoc(doc(as(BOB), 'groups/new1'), { name: 'B', createdBy: BOB, memberIds: [BOB], members: [{ userId: BOB }] }));
  await assertFails(setDoc(doc(as(BOB), 'groups/new2'), { name: 'B', createdBy: ALICE, memberIds: [BOB], members: [] }));
  await assertFails(setDoc(doc(as(BOB), 'groups/new3'), { name: 'B', createdBy: BOB, memberIds: [BOB, ALICE], members: [] }));
});
test('anyone signed in can preview a group (invite link)', async () => {
  await assertSucceeds(getDoc(doc(as(MALLORY), 'groups/g1')));
});
test('joining via invite link: allowed for shared, blocked for personal', async () => {
  await assertSucceeds(updateDoc(doc(as(CAROL), 'groups/g1'), { memberIds: arrayUnion(CAROL), members: arrayUnion({ userId: CAROL, name: 'Carol' }) }));
  await assertFails(updateDoc(doc(as(BOB), 'groups/p1'), { memberIds: arrayUnion(BOB) }));
});
test('member can leave (remove self from both lists, add formerMembers)', async () => {
  await assertSucceeds(updateDoc(doc(as(BOB), 'groups/g1'), {
    memberIds: arrayRemove(BOB),
    members: [{ userId: ALICE, name: ALICE, email: 'alice@x.com', role: 'owner' }],
    formerMembers: arrayUnion({ userId: BOB, name: 'Bob', reason: 'left' }),
  }));
});
test('only the owner deletes a group; a sole member may delete (account deletion)', async () => {
  await assertFails(deleteDoc(doc(as(BOB), 'groups/g1')));
  await assertSucceeds(deleteDoc(doc(as(ALICE), 'groups/g1')));
  await assertSucceeds(deleteDoc(doc(as(ALICE), 'groups/g2')));
});

// ── Users ────────────────────────────────────────────────────────────────────
test('admin can only toggle isActive on another user', async () => {
  const admin = as(ADMIN, { admin: true });
  await assertSucceeds(updateDoc(doc(admin, 'users/bob'), { isActive: false }));
  await assertFails(updateDoc(doc(admin, 'users/bob'), { displayName: 'Hacked' }));
  await assertFails(updateDoc(doc(as(ALICE), 'users/bob'), { isActive: false }));
});

// ── Notifications (payment confirm/decline flow) ─────────────────────────────
test('payer backfills payerLogNotifId on the payee notification', async () => {
  await assertSucceeds(updateDoc(doc(as(ALICE), 'notifications/n-payee'), { 'data.payerLogNotifId': 'n-log' }));
});
test('payee updates the payer log on confirm/decline', async () => {
  await assertSucceeds(updateDoc(doc(as(BOB), 'notifications/n-log'), { status: 'confirmed', title: 'Payment Confirmed', message: 'ok', read: false }));
});
test('a party cannot change the payment amount or owner of the other\'s notification', async () => {
  await assertFails(updateDoc(doc(as(ALICE), 'notifications/n-payee'), { 'data.amount': 1 }));
  await assertFails(updateDoc(doc(as(BOB), 'notifications/n-log'), { userId: BOB }));
});
test('an unrelated user cannot update someone else\'s notification', async () => {
  await assertFails(updateDoc(doc(as(MALLORY), 'notifications/n-log'), { read: true }));
});
test('owner marks own notification read', async () => {
  await assertSucceeds(updateDoc(doc(as(BOB), 'notifications/n-payee'), { read: true }));
});
