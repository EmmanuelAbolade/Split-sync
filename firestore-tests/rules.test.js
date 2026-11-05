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
test('member adds an expense; the app can no longer write a settlement (Phase 1B)', async () => {
  await assertSucceeds(addDoc(collection(as(BOB), 'expenses'), expense('g1', { createdBy: BOB })));
  await assertSucceeds(addDoc(collection(as(BOB), 'expenses'), expense('g1', { isSettlement: false })));
  await assertFails(addDoc(collection(as(BOB), 'expenses'), expense('g1', { isSettlement: true })));
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
// Since Phase 1B confirm and decline run on the server, so the other party to
// a payment can no longer edit its notifications.
test('the payer can no longer edit the payee notification', async () => {
  await assertFails(updateDoc(doc(as(ALICE), 'notifications/n-payee'), { 'data.payerLogNotifId': 'n-log' }));
});
test('the payee can no longer edit the payer log', async () => {
  await assertFails(updateDoc(doc(as(BOB), 'notifications/n-log'), { status: 'confirmed', title: 'Payment Confirmed', message: 'ok', read: false }));
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
test('owner cannot change the type or owner of their own notification', async () => {
  await assertFails(updateDoc(doc(as(BOB), 'notifications/n-payee'), { type: 'expense' }));
  await assertFails(updateDoc(doc(as(BOB), 'notifications/n-payee'), { userId: ALICE }));
});
test('payment notifications can only come from the server; other types still from the app', async () => {
  for (const type of ['payment_confirmation_needed', 'payment_log', 'payment']) {
    await assertFails(addDoc(collection(as(ALICE), 'notifications'), { userId: BOB, type, data: { payerId: ALICE, payeeId: BOB, amount: 50 } }));
  }
  await assertSucceeds(addDoc(collection(as(ALICE), 'notifications'), { userId: BOB, type: 'expense', read: false }));
});

// ── Settlements (Phase 1B: written by the settlements Functions) ──────────────
async function seedSettlement() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'expenses/s1'), expense('g1', { isSettlement: true, paidBy: BOB, splits: { [ALICE]: 10 }, participants: [BOB, ALICE] }));
    await setDoc(doc(db, 'pendingPayments/g1_bob_alice'), { groupId: 'g1', fromUserId: BOB, toUserId: ALICE, status: 'started' });
    await setDoc(doc(db, 'pendingPayments/g1_alice_bob'), { groupId: 'g1', fromUserId: ALICE, toUserId: BOB, status: 'claimed', claimId: 'c1' });
    await setDoc(doc(db, 'pendingPayments/old_bob_alice'), { groupId: 'old', fromUserId: BOB, toUserId: ALICE });
    await setDoc(doc(db, 'settlementClaims/c1'), { fromUid: ALICE, toUid: BOB, status: 'pending' });
  });
}
test('a settlement entry cannot be edited by members, and an expense cannot become one', async () => {
  await seedSettlement();
  await assertFails(updateDoc(doc(as(ALICE), 'expenses/s1'), { amount: 999 }));
  await assertFails(updateDoc(doc(as(BOB), 'expenses/s1'), { isSettlement: false }));
  await assertFails(updateDoc(doc(as(ALICE), 'expenses/e1'), { isSettlement: true }));
  await assertSucceeds(updateDoc(doc(as(ADMIN, { admin: true }), 'expenses/s1'), { status: 'deleted', deletedAt: new Date(), deletedBy: ADMIN, moderated: true }));
});
test('a settlement entry is still deleted with its group (group and account deletion)', async () => {
  await seedSettlement();
  await assertFails(deleteDoc(doc(as(MALLORY), 'expenses/s1')));
  await assertSucceeds(deleteDoc(doc(as(ALICE), 'expenses/s1')));
});
test('payment locks: the app cannot create or change them', async () => {
  await seedSettlement();
  await assertFails(setDoc(doc(as(ALICE), 'pendingPayments/g1_alice_carol'), { groupId: 'g1', fromUserId: ALICE, toUserId: CAROL, amount: 5 }));
  await assertFails(updateDoc(doc(as(BOB), 'pendingPayments/g1_bob_alice'), { amount: 1 }));
  await assertFails(updateDoc(doc(as(ALICE), 'pendingPayments/g1_alice_bob'), { status: 'started' }));
});
test('payment locks: both parties read; only the payer deletes, and never a claimed one', async () => {
  await seedSettlement();
  await assertSucceeds(getDoc(doc(as(BOB), 'pendingPayments/g1_bob_alice')));
  await assertSucceeds(getDoc(doc(as(ALICE), 'pendingPayments/g1_bob_alice')));
  await assertSucceeds(getDocs(query(collection(as(BOB), 'pendingPayments'), where('groupId', '==', 'g1'), where('fromUserId', '==', BOB))));
  await assertFails(getDoc(doc(as(MALLORY), 'pendingPayments/g1_bob_alice')));
  await assertFails(deleteDoc(doc(as(ALICE), 'pendingPayments/g1_bob_alice')), 'the payee may not drop it');
  await assertFails(deleteDoc(doc(as(ALICE), 'pendingPayments/g1_alice_bob')), 'a claimed lock waits for the payee');
  await assertSucceeds(deleteDoc(doc(as(BOB), 'pendingPayments/g1_bob_alice')));
  await assertSucceeds(deleteDoc(doc(as(BOB), 'pendingPayments/old_bob_alice')), 'older locks without a status count as started');
});
test('settlement claims are server-only', async () => {
  await seedSettlement();
  await assertFails(getDoc(doc(as(ALICE), 'settlementClaims/c1')));
  await assertFails(getDoc(doc(as(BOB), 'settlementClaims/c1')));
  await assertFails(setDoc(doc(as(ALICE), 'settlementClaims/c2'), { fromUid: ALICE, toUid: BOB, status: 'pending' }));
});

// ── Private profile details (payment methods, phone number) ──────────────────
test('private details: owner only — not other users, not even admins', async () => {
  await assertSucceeds(setDoc(doc(as(BOB), 'users/bob/private/details'), { paymentMethods: { paypalUsername: 'bob' }, phoneNumber: '+353' }));
  await assertSucceeds(getDoc(doc(as(BOB), 'users/bob/private/details')));
  await assertFails(getDoc(doc(as(ALICE), 'users/bob/private/details')));
  await assertFails(getDoc(doc(as(ADMIN, { admin: true }), 'users/bob/private/details')));
  await assertFails(setDoc(doc(as(ALICE), 'users/bob/private/details'), { phoneNumber: 'x' }));
});
test('public profile cannot store payment details or a plain phone number', async () => {
  await assertFails(setDoc(doc(as(CAROL), 'users/carol'), { displayName: 'C', paymentMethods: {} }));
  await assertSucceeds(setDoc(doc(as(CAROL), 'users/carol'), { displayName: 'C', phoneHash: 'abc' }));
  await assertFails(updateDoc(doc(as(BOB), 'users/bob'), { phoneNumber: '+353' }));
  await assertFails(updateDoc(doc(as(BOB), 'users/bob'), { paymentMethods: { paypalUsername: 'bob' } }));
});
test('legacy public profile: fields can be removed, other edits still work', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users/carol'), { displayName: 'C', phoneNumber: '+1', paymentMethods: { paypalUsername: 'c' } });
  });
  await assertSucceeds(updateDoc(doc(as(CAROL), 'users/carol'), { displayName: 'Carol' })); // untouched legacy fields OK
  await assertFails(updateDoc(doc(as(CAROL), 'users/carol'), { phoneNumber: '+2' }));        // cannot change them
  const { deleteField } = require('firebase/firestore');
  await assertSucceeds(updateDoc(doc(as(CAROL), 'users/carol'), { phoneNumber: deleteField(), paymentMethods: deleteField() }));
});

// ── Admin moderation (Taskmaster) ────────────────────────────────────────────
test('admin may rename a group but not change its members', async () => {
  const admin = as(ADMIN, { admin: true });
  await assertSucceeds(updateDoc(doc(admin, 'groups/g1'), { name: '[Removed by moderator]', moderatedAt: new Date(), moderatedBy: ADMIN }));
  await assertFails(updateDoc(doc(admin, 'groups/g1'), { createdBy: ADMIN }));
});
test('admin may only soft-remove an expense', async () => {
  const admin = as(ADMIN, { admin: true });
  await assertSucceeds(updateDoc(doc(admin, 'expenses/e1'), { status: 'deleted', deletedAt: new Date(), deletedBy: ADMIN, moderated: true }));
  await assertFails(updateDoc(doc(admin, 'expenses/e2'), { amount: 0 }));
  await assertFails(updateDoc(doc(admin, 'expenses/e2'), { status: 'archived' }));
});
test('admin may delete invitations; other non-senders may not', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'invitations/i1'), { fromUserId: ALICE, toUserId: BOB, status: 'pending' });
  });
  await assertFails(deleteDoc(doc(as(MALLORY), 'invitations/i1')));
  await assertSucceeds(deleteDoc(doc(as(ADMIN, { admin: true }), 'invitations/i1')));
});

test('joining cannot be combined with other changes', async () => {
  // A non-member "joins" but also renames the group / takes ownership / removes members
  await assertFails(updateDoc(doc(as(MALLORY), 'groups/g1'), { memberIds: arrayUnion(MALLORY), members: arrayUnion({ userId: MALLORY }), name: 'Hijacked' }));
  await assertFails(updateDoc(doc(as(MALLORY), 'groups/g1'), { memberIds: arrayUnion(MALLORY), members: arrayUnion({ userId: MALLORY }), createdBy: MALLORY }));
  await assertFails(updateDoc(doc(as(MALLORY), 'groups/g1'), { memberIds: [MALLORY], members: [{ userId: MALLORY }] }));
  // Adding someone else instead of yourself
  await assertFails(updateDoc(doc(as(CAROL), 'groups/g1'), { memberIds: arrayUnion(CAROL), members: arrayUnion({ userId: MALLORY }) }));
});
test('rejoin via invitation acceptance (with updatedAt and formerMembers cleanup) is allowed', async () => {
  await assertSucceeds(updateDoc(doc(as(CAROL), 'groups/g1'), {
    memberIds: arrayUnion(CAROL), members: arrayUnion({ userId: CAROL, name: 'Carol' }), formerMembers: [], updatedAt: new Date(),
  }));
});
