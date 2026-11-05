// src/stores/notificationsStore.js
import { create } from 'zustand';
import {
  collection, query, where, onSnapshot,
  doc, updateDoc, writeBatch, addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { claimSettlement, confirmSettlement, declineSettlement } from '../utils/settlements';

export const useNotificationsStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  // Subscribe to all of this user's notifications in real time
  subscribeToNotifications: (userId) => {
    if (!userId) return () => {};
    set({ loading: true });

    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      notifs.sort((a, b) => {
        const dA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dB - dA;
      });

      // payment_log entries are silent records - exclude from badge count
      const unreadCount = notifs.filter(n => !n.read && n.type !== 'payment_log').length;

      set({ notifications: notifs, unreadCount, loading: false });
    });

    return unsubscribe;
  },

  markAsRead: async (notificationId) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
        readAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  },

  markAllAsRead: async () => {
    const { notifications } = get();
    const unread = notifications.filter(n => !n.read && n.type !== 'payment_log');
    if (unread.length === 0) return;
    try {
      const batch = writeBatch(db);
      unread.forEach(n => {
        batch.update(doc(db, 'notifications', n.id), {
          read: true,
          readAt: serverTimestamp(),
        });
      });
      await batch.commit();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  },

  clearAll: async () => {
    const { notifications } = get();
    try {
      const batch = writeBatch(db);
      notifications.forEach(n => batch.delete(doc(db, 'notifications', n.id)));
      await batch.commit();
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  },
}));

// ---------------------------------------------------------------------------
// Standalone helpers called from components
// ---------------------------------------------------------------------------

/**
 * createNotification - generic helper for one-off notification writes.
 */
export const createNotification = async ({
  userId, type, title, message, data, requiresAction = false,
}) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId, type, title, message, data,
      requiresAction,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

/**
 * recordPaymentSent
 * Called when the PAYER says they paid (after a PayPal / Revolut / bank link,
 * Paid Offline, or a demo). Since Phase 1B this is done by the
 * settlements-claim Function: it writes the payee's actionable notification
 * (payment_confirmation_needed), the payer's log entry (payment_log) and the
 * pending-payment lock in one transaction. Balances change only when the payee
 * confirms. The payer is always the signed-in user, so no payer id is sent.
 */
export const recordPaymentSent = async ({
  payeeId, groupId, amount, method, idempotencyKey, paypalOrderId,
}) => {
  try {
    return await claimSettlement({
      groupId, toUid: payeeId, amount, method, idempotencyKey, paypalOrderId,
    });
  } catch (error) {
    console.error('Error recording payment sent:', error?.code);
    throw error;
  }
};

/**
 * confirmPaymentReceived
 * Called by the PAYEE via their notification action button, after the
 * "Confirm it's you" step (useStepUp) has produced a token for
 * confirmParams(payeeNotifId). The settlements-confirm Function writes the
 * settlement entry, updates both notifications and releases the lock.
 */
export const confirmPaymentReceived = async (payeeNotifId, stepUpToken) => {
  try {
    return await confirmSettlement(payeeNotifId, stepUpToken);
  } catch (error) {
    console.error('Error confirming payment:', error?.code);
    throw error;
  }
};

/**
 * declinePaymentReceived
 * Called by the PAYEE when they did not receive the money.
 * Balance is NOT updated. The payer's log entry tells them to check and retry.
 */
export const declinePaymentReceived = async (payeeNotifId) => {
  try {
    return await declineSettlement(payeeNotifId);
  } catch (error) {
    console.error('Error declining payment:', error?.code);
    throw error;
  }
};
