// src/utils/accountDeletion.js
// Safe account deletion.
//
// Policy (what happens to a deleted user's data):
//   • Deletion is BLOCKED while the user has an unsettled balance in any group.
//   • Shared groups are never deleted because of one person leaving. The user is
//     removed from members/memberIds and a name snapshot is written to
//     formerMembers, so their past expenses and settlements keep showing their
//     name. Their expenses in shared groups are KEPT — deleting them would
//     silently change everyone else's balances and history.
//   • If the user owns a shared group that still has other members, ownership
//     passes to the longest-standing remaining member.
//   • Personal trackers, and groups where the user is the only member, are
//     deleted together with their expenses.
//   • The user's own private records are deleted: users doc, notifications,
//     sent invitations, phone-number index, connections, pending payments.

import {
  collection, query, where, getDocs, doc, updateDoc, deleteDoc, writeBatch, arrayRemove,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { calculateBalances } from './balanceCalculator';
import { isPersonalGroup } from './memberDirectory';
import { createNotification } from '../stores/notificationsStore';

const BATCH_LIMIT = 450; // Firestore batch max is 500 writes

async function deleteDocsInBatches(refs) {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    refs.slice(i, i + BATCH_LIMIT).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
}

async function getGroupExpenses(groupId) {
  const snap = await getDocs(query(collection(db, 'expenses'), where('groupId', '==', groupId)));
  return snap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
}

/** All groups that list the user (current members, plus legacy memberIds entries). */
async function getUserGroups(uid) {
  const snap = await getDocs(query(collection(db, 'groups'), where('memberIds', 'array-contains', uid)));
  return snap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
}

/**
 * Returns groups where the user still owes or is owed money.
 * @returns {Promise<Array<{groupId, name, currency, amount, direction}>>}
 */
export async function findUnsettledGroups(uid) {
  const groups = await getUserGroups(uid);
  const result = [];
  for (const g of groups) {
    if (isPersonalGroup(g)) continue;
    const expenses = await getGroupExpenses(g.id);
    const balance = calculateBalances(expenses, g.members || [])[uid] || 0;
    if (Math.abs(balance) > 0.01) {
      result.push({
        groupId: g.id,
        name: g.name,
        currency: g.currency,
        amount: Math.abs(balance).toFixed(2),
        direction: balance < 0 ? 'owe' : 'are owed',
      });
    }
  }
  return result;
}

/**
 * Removes the user from every group and deletes their private data.
 * Call only after re-authentication and after findUnsettledGroups() is empty.
 * Does NOT delete the Firebase Auth user — the caller does that last.
 */
export async function deleteAccountData(user) {
  const uid = user.uid;
  const groups = await getUserGroups(uid);

  for (const g of groups) {
    const me = (g.members || []).find(m => m.userId === uid);
    const others = (g.members || []).filter(m => m.userId !== uid);

    // Personal trackers and groups with no one else: remove completely
    if (isPersonalGroup(g) || others.length === 0) {
      const expenses = await getGroupExpenses(g.id);
      await deleteDocsInBatches(expenses.map(e => e.ref));
      await deleteDoc(g.ref);
      continue;
    }

    // Shared group: leave it, keep history, hand over ownership if needed
    const update = {
      members: others,
      memberIds: arrayRemove(uid),
      formerMembers: [
        ...(g.formerMembers || []).filter(m => m.userId !== uid),
        {
          userId: uid,
          name: me?.name || user.displayName || user.email || 'Former member',
          email: me?.email || user.email || '',
          leftAt: new Date(),
          reason: 'account_deleted',
        },
      ],
    };

    let newOwner = null;
    if (g.createdBy === uid) {
      const byJoinDate = [...others].sort((a, b) => {
        const ta = a.joinedAt?.toDate ? a.joinedAt.toDate() : new Date(a.joinedAt || 0);
        const tb = b.joinedAt?.toDate ? b.joinedAt.toDate() : new Date(b.joinedAt || 0);
        return ta - tb;
      });
      newOwner = byJoinDate[0];
      update.createdBy = newOwner.userId;
      update.members = others.map(m => m.userId === newOwner.userId ? { ...m, role: 'owner' } : m);
    }

    await updateDoc(g.ref, update);

    if (newOwner) {
      try {
        await createNotification({
          userId: newOwner.userId,
          type: 'group_ownership',
          title: 'You are now the group owner',
          message: `${me?.name || 'The previous owner'} deleted their account. You now own "${g.name}".`,
          data: { groupId: g.id, groupName: g.name },
        });
      } catch (err) {
        console.warn('[accountDeletion] owner notification failed:', err?.message);
      }
    }
  }

  // Private records — each step is best-effort so one failure doesn't strand the rest
  const cleanup = async (label, fn) => {
    try { await fn(); } catch (err) { console.warn(`[accountDeletion] ${label} cleanup failed:`, err?.message); }
  };

  await cleanup('notifications', async () => {
    const s = await getDocs(query(collection(db, 'notifications'), where('userId', '==', uid)));
    await deleteDocsInBatches(s.docs.map(d => d.ref));
  });
  await cleanup('sent invitations', async () => {
    const s = await getDocs(query(collection(db, 'invitations'), where('fromUserId', '==', uid)));
    await deleteDocsInBatches(s.docs.map(d => d.ref));
  });
  await cleanup('received invitations', async () => {
    const s = await getDocs(query(collection(db, 'invitations'), where('toUserId', '==', uid)));
    await Promise.all(s.docs
      .filter(d => d.data().status === 'pending')
      .map(d => updateDoc(d.ref, { status: 'declined' })));
  });
  await cleanup('phone numbers', async () => {
    const s = await getDocs(query(collection(db, 'phoneNumbers'), where('userId', '==', uid)));
    await deleteDocsInBatches(s.docs.map(d => d.ref));
  });
  await cleanup('connections', async () => {
    const s = await getDocs(collection(db, 'connections', uid, 'connectedUsers'));
    await deleteDocsInBatches(s.docs.map(d => d.ref));
  });
  await cleanup('pending payments', async () => {
    const s = await getDocs(query(collection(db, 'pendingPayments'), where('fromUserId', '==', uid)));
    await deleteDocsInBatches(s.docs.map(d => d.ref));
  });
  await cleanup('private details', () => deleteDoc(doc(db, 'users', uid, 'private', 'details')));
  await cleanup('user profile', () => deleteDoc(doc(db, 'users', uid)));
}
