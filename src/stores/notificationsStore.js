// src/stores/notificationsStore.js
import { create } from 'zustand';
import {
  collection, query, where, onSnapshot,
  doc, updateDoc, writeBatch, addDoc,
  serverTimestamp, getDoc,
} from 'firebase/firestore';
import { db } from '../services/firebase';

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
 * Called when the PAYER marks a payment as sent via an external link (PayPal / Revolut).
 * Uses ONLY the existing notifications collection - no new Firestore collection needed.
 *
 * Creates two notification documents:
 *   1. payee notification  - type: payment_confirmation_needed, requiresAction: true
 *   2. payer log entry     - type: payment_log, auto-read, tracks status changes
 *
 * Both documents cross-reference each other via payeeNotifId / payerLogNotifId
 * so that confirm / decline can update both in one operation.
 */
export const recordPaymentSent = async ({
  payerId, payerName,
  payeeId, payeeName,
  groupId, groupName,
  amount, currency, method,
}) => {
  try {
    const amountFixed = Number(amount).toFixed(2);

    // 1 - Create the payee's actionable notification
    const payeeNotifRef = await addDoc(collection(db, 'notifications'), {
      userId: payeeId,
      type: 'payment_confirmation_needed',
      title: 'Payment Confirmation Needed',
      message: `${payerName} claims to have paid you ${currency} ${amountFixed} via ${method.toUpperCase()} in ${groupName}. Did you receive it?`,
      requiresAction: true,
      actionStatus: 'pending',
      data: {
        groupId, groupName,
        payerId, payerName,
        payeeId, payeeName,
        amount: Number(amount),
        currency, method,
        // payerLogNotifId is backfilled in step 3
      },
      read: false,
      createdAt: serverTimestamp(),
    });

    // 2 - Create the payer's personal log entry
    const payerLogRef = await addDoc(collection(db, 'notifications'), {
      userId: payerId,
      type: 'payment_log',
      title: 'Payment Sent — Awaiting Confirmation',
      message: `You paid ${currency} ${amountFixed} via ${method.toUpperCase()} to ${payeeName} in ${groupName}. Waiting for ${payeeName} to confirm.`,
      requiresAction: false,
      status: 'pending_confirmation',
      data: {
        groupId, groupName,
        payerId, payerName,
        payeeId, payeeName,
        amount: Number(amount),
        currency, method,
        payeeNotifId: payeeNotifRef.id,
      },
      read: true, // Auto-read: payer initiated this, no badge increment
      createdAt: serverTimestamp(),
    });

    // 3 - Backfill the payee notification with the payer log ID
    await updateDoc(payeeNotifRef, {
      'data.payerLogNotifId': payerLogRef.id,
    });

    return { success: true };
  } catch (error) {
    console.error('Error recording payment sent:', error);
    throw error;
  }
};

/**
 * confirmPaymentReceived
 * Called by the PAYEE via their notification action button.
 * - Writes the expense (triggers balance recalculation)
 * - Removes the action buttons from the payee notification
 * - Updates the payer log so the payer sees the confirmed status
 */
export const confirmPaymentReceived = async (payeeNotifId) => {
  try {
    const payeeNotifRef = doc(db, 'notifications', payeeNotifId);
    const payeeNotifDoc = await getDoc(payeeNotifRef);

    if (!payeeNotifDoc.exists()) throw new Error('Payment notification not found');

    const { data } = payeeNotifDoc.data();

    // Write the expense - this is the only thing that updates the balance
    await addDoc(collection(db, 'expenses'), {
      groupId: data.groupId,
      title: `Settlement: ${data.payerName} to ${data.payeeName}`,
      amount: data.amount,
      currency: data.currency,
      paidBy: data.payerId,
      category: 'settlement',
      description: `${data.method.toUpperCase()} Payment — confirmed by ${data.payeeName}`,
      date: new Date(),
      splitMethod: 'exact',
      splits: { [data.payeeId]: data.amount },
      participants: [data.payerId, data.payeeId],
      createdAt: serverTimestamp(),
      isSettlement: true,
      paymentMethod: data.method,
      confirmedAt: serverTimestamp(),
    });

    // Remove action buttons from payee notification
    await updateDoc(payeeNotifRef, {
      requiresAction: false,
      actionStatus: 'confirmed',
      read: true,
      readAt: serverTimestamp(),
    });

    // Update payer log so payer sees confirmed status (unread so they notice)
    if (data.payerLogNotifId) {
      await updateDoc(doc(db, 'notifications', data.payerLogNotifId), {
        status: 'confirmed',
        title: 'Payment Confirmed',
        message: `${data.payeeName} confirmed receiving ${data.currency} ${Number(data.amount).toFixed(2)} in ${data.groupName}. Your balance has been updated.`,
        read: false,
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error confirming payment:', error);
    throw error;
  }
};

/**
 * declinePaymentReceived
 * Called by the PAYEE when they did not receive the money.
 * Balance is NOT updated. Payer log is updated so payer knows to retry.
 */
export const declinePaymentReceived = async (payeeNotifId) => {
  try {
    const payeeNotifRef = doc(db, 'notifications', payeeNotifId);
    const payeeNotifDoc = await getDoc(payeeNotifRef);

    if (!payeeNotifDoc.exists()) throw new Error('Payment notification not found');

    const { data } = payeeNotifDoc.data();

    // Remove action buttons from payee notification
    await updateDoc(payeeNotifRef, {
      requiresAction: false,
      actionStatus: 'declined',
      read: true,
      readAt: serverTimestamp(),
    });

    // Update payer log — declined status, make unread so payer notices
    if (data.payerLogNotifId) {
      await updateDoc(doc(db, 'notifications', data.payerLogNotifId), {
        status: 'declined',
        title: 'Payment Not Confirmed',
        message: `${data.payeeName} could not confirm your ${data.currency} ${Number(data.amount).toFixed(2)} ${data.method.toUpperCase()} payment in ${data.groupName}. Please check and retry.`,
        read: false,
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error declining payment:', error);
    throw error;
  }
};
