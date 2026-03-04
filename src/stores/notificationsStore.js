// src/stores/notificationsStore.js
import { create } from 'zustand';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export const useNotificationsStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  
  // Subscribe to user's notifications
  subscribeToNotifications: (userId) => {
    if (!userId) return () => {};
    
    set({ loading: true });
    
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId)
    );
    
    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      // Sort by newest first
      notifs.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB - dateA;
      });
      
      const unreadCount = notifs.filter(n => !n.read).length;
      
      set({ notifications: notifs, unreadCount, loading: false });
    });
    
    return unsubscribe;
  },
  
  // Mark notification as read
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
  
  // Mark all as read
  markAllAsRead: async (userId) => {
    const { notifications } = get();
    const unreadNotifs = notifications.filter(n => !n.read);
    
    if (unreadNotifs.length === 0) return;
    
    try {
      const batch = writeBatch(db);
      
      unreadNotifs.forEach(notif => {
        const notifRef = doc(db, 'notifications', notif.id);
        batch.update(notifRef, {
          read: true,
          readAt: serverTimestamp(),
        });
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  },
  
  // Clear all notifications
  clearAll: async (userId) => {
    const { notifications } = get();
    
    try {
      const batch = writeBatch(db);
      
      notifications.forEach(notif => {
        const notifRef = doc(db, 'notifications', notif.id);
        batch.delete(notifRef);
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  },
}));

// Helper function to create notifications
// requiresAction: if true, the notification shows confirm/decline buttons in the UI
export const createNotification = async ({ userId, type, title, message, data, requiresAction = false }) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      type,
      title,
      message,
      data,
      requiresAction,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

// Confirm a pending payment - payee confirms they received the money
// Writes the expense (updates balance) and notifies the payer
export const confirmPaymentReceived = async (pendingSettlementId) => {
  try {
    const pendingRef = doc(db, 'pendingSettlements', pendingSettlementId);
    const pendingDoc = await getDoc(pendingRef);

    if (!pendingDoc.exists()) {
      throw new Error('Pending settlement record not found');
    }

    const payment = pendingDoc.data();

    // Record as a confirmed expense - this updates the group balance
    await addDoc(collection(db, 'expenses'), {
      groupId: payment.groupId,
      title: `Settlement: ${payment.fromName} to ${payment.toName}`,
      amount: payment.amount,
      currency: payment.currency,
      paidBy: payment.fromUserId,
      category: 'settlement',
      description: `${payment.method.toUpperCase()} Payment - Confirmed by ${payment.toName}`,
      date: new Date(),
      splitMethod: 'exact',
      splits: { [payment.toUserId]: payment.amount },
      participants: [payment.fromUserId, payment.toUserId],
      createdAt: serverTimestamp(),
      isSettlement: true,
      paymentMethod: payment.method,
      confirmedAt: serverTimestamp(),
      pendingSettlementId,
    });

    // Mark pending settlement as confirmed
    await updateDoc(pendingRef, {
      status: 'confirmed',
      confirmedAt: serverTimestamp(),
    });

    // Notify payer that their payment was confirmed
    await addDoc(collection(db, 'notifications'), {
      userId: payment.fromUserId,
      type: 'payment_confirmed',
      title: 'Payment Confirmed',
      message: `${payment.toName} confirmed receiving ${payment.currency} ${payment.amount.toFixed(2)} in ${payment.groupName}. Balance has been updated.`,
      data: {
        groupId: payment.groupId,
        amount: payment.amount,
        currency: payment.currency,
        toUserId: payment.toUserId,
        toName: payment.toName,
      },
      requiresAction: false,
      read: false,
      createdAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error confirming payment:', error);
    throw error;
  }
};

// Decline a pending payment - payee indicates they did not receive the money
// Notifies the payer to retry without touching the balance
export const declinePaymentReceived = async (pendingSettlementId) => {
  try {
    const pendingRef = doc(db, 'pendingSettlements', pendingSettlementId);
    const pendingDoc = await getDoc(pendingRef);

    if (!pendingDoc.exists()) {
      throw new Error('Pending settlement record not found');
    }

    const payment = pendingDoc.data();

    // Mark pending settlement as declined
    await updateDoc(pendingRef, {
      status: 'declined',
      declinedAt: serverTimestamp(),
    });

    // Notify payer that their payment was not confirmed
    await addDoc(collection(db, 'notifications'), {
      userId: payment.fromUserId,
      type: 'payment_declined',
      title: 'Payment Not Confirmed',
      message: `${payment.toName} could not confirm your ${payment.currency} ${payment.amount.toFixed(2)} ${payment.method.toUpperCase()} payment in ${payment.groupName}. Please check and retry.`,
      data: {
        groupId: payment.groupId,
        amount: payment.amount,
        currency: payment.currency,
        toUserId: payment.toUserId,
        toName: payment.toName,
      },
      requiresAction: false,
      read: false,
      createdAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error declining payment:', error);
    throw error;
  }
};