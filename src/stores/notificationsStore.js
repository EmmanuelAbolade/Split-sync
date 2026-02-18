// src/stores/notificationsStore.js
import { create } from 'zustand';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
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
export const createNotification = async ({ userId, type, title, message, data }) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      type, // 'payment', 'expense', 'settlement', 'invitation'
      title,
      message,
      data, // Additional data (groupId, amount, etc.)
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};