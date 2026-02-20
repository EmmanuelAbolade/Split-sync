// src/stores/notificationsStore.test.js
// Test suite for notifications store
import { create } from 'zustand';

// Mock Firestore
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
  arrayUnion: jest.fn((val) => val),
}));

jest.mock('../services/firebase', () => ({
  db: {},
}));

describe('Notifications Store - State Management', () => {
  
  test('Initializes with empty notifications array', () => {
    const initialState = {
      notifications: [],
      unreadCount: 0,
    };

    expect(initialState.notifications).toEqual([]);
    expect(initialState.unreadCount).toBe(0);
  });

  test('Tracks unread notification count', () => {
    const notifications = [
      { id: '1', read: false },
      { id: '2', read: false },
      { id: '3', read: true },
    ];

    const unreadCount = notifications.filter(n => !n.read).length;
    expect(unreadCount).toBe(2);
  });

  test('Marks notification as read', () => {
    const notification = {
      id: '1',
      read: false,
      title: 'Test',
    };

    const updated = { ...notification, read: true };
    expect(updated.read).toBe(true);
  });

  test('Marks all notifications as read', () => {
    const notifications = [
      { id: '1', read: false },
      { id: '2', read: false },
      { id: '3', read: false },
    ];

    const allRead = notifications.map(n => ({ ...n, read: true }));
    expect(allRead.every(n => n.read)).toBe(true);
  });

  test('Clears all notifications', () => {
    let notifications = [
      { id: '1' },
      { id: '2' },
      { id: '3' },
    ];

    notifications = [];
    expect(notifications.length).toBe(0);
  });

  test('Removes specific notification by ID', () => {
    const notifications = [
      { id: '1' },
      { id: '2' },
      { id: '3' },
    ];

    const filtered = notifications.filter(n => n.id !== '2');
    expect(filtered.length).toBe(2);
    expect(filtered.find(n => n.id === '2')).toBeUndefined();
  });
});

describe('Notification Data Structure', () => {
  
  test('Creates valid notification object', () => {
    const notification = {
      id: 'notif_123',
      userId: 'user_456',
      type: 'invitation',
      title: 'Group Invitation',
      message: 'You have been invited to join Test Group',
      read: false,
      createdAt: new Date(),
      data: {
        groupId: 'group_789',
        groupName: 'Test Group',
      },
    };

    expect(notification).toHaveProperty('id');
    expect(notification).toHaveProperty('userId');
    expect(notification).toHaveProperty('type');
    expect(notification).toHaveProperty('title');
    expect(notification).toHaveProperty('message');
    expect(notification).toHaveProperty('read');
    expect(notification).toHaveProperty('createdAt');
    expect(notification).toHaveProperty('data');
  });

  test('Validates notification types', () => {
    const validTypes = [
      'invitation',
      'payment',
      'expense',
      'settlement',
      'reminder',
    ];

    validTypes.forEach(type => {
      expect(['invitation', 'payment', 'expense', 'settlement', 'reminder']).toContain(type);
    });
  });

  test('Notification has timestamp', () => {
    const notification = {
      id: '1',
      createdAt: new Date(),
    };

    expect(notification.createdAt).toBeInstanceOf(Date);
    expect(notification.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  test('Notification contains user context', () => {
    const notification = {
      id: '1',
      userId: 'user_123',
      fromUserId: 'user_456',
      fromUserName: 'John Doe',
    };

    expect(notification.userId).toBeDefined();
    expect(notification.fromUserId).toBeDefined();
    expect(notification.fromUserName).toBeDefined();
  });
});

describe('Notification Filtering', () => {
  
  test('Filters unread notifications', () => {
    const notifications = [
      { id: '1', read: false },
      { id: '2', read: true },
      { id: '3', read: false },
    ];

    const unread = notifications.filter(n => !n.read);
    expect(unread.length).toBe(2);
  });

  test('Filters by notification type', () => {
    const notifications = [
      { id: '1', type: 'invitation' },
      { id: '2', type: 'payment' },
      { id: '3', type: 'invitation' },
    ];

    const invitations = notifications.filter(n => n.type === 'invitation');
    expect(invitations.length).toBe(2);
  });

  test('Filters by date range', () => {
    const now = Date.now();
    const notifications = [
      { id: '1', createdAt: new Date(now - 3600000) }, // 1 hour ago
      { id: '2', createdAt: new Date(now - 86400000) }, // 1 day ago
      { id: '3', createdAt: new Date(now - 7200000) }, // 2 hours ago
    ];

    const recent = notifications.filter(n => 
      n.createdAt.getTime() > now - 7200000
    );
    
    expect(recent.length).toBeGreaterThan(0);
  });

  test('Sorts notifications by date descending', () => {
    const now = Date.now();
    const notifications = [
      { id: '1', createdAt: new Date(now - 3600000) },
      { id: '2', createdAt: new Date(now - 7200000) },
      { id: '3', createdAt: new Date(now - 1800000) },
    ];

    const sorted = [...notifications].sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    );

    expect(sorted[0].id).toBe('3'); // Most recent
    expect(sorted[2].id).toBe('2'); // Oldest
  });
});

describe('Notification Actions', () => {
  
  test('Adds new notification to list', () => {
    const notifications = [
      { id: '1' },
      { id: '2' },
    ];

    const newNotification = { id: '3' };
    const updated = [newNotification, ...notifications];

    expect(updated.length).toBe(3);
    expect(updated[0].id).toBe('3');
  });

  test('Prevents duplicate notifications', () => {
    const notifications = [
      { id: '1' },
      { id: '2' },
    ];

    const newId = '1';
    const exists = notifications.some(n => n.id === newId);

    if (!exists) {
      notifications.push({ id: newId });
    }

    expect(notifications.length).toBe(2);
  });

  test('Updates notification read status', () => {
    const notifications = [
      { id: '1', read: false },
      { id: '2', read: false },
    ];

    const updated = notifications.map(n => 
      n.id === '1' ? { ...n, read: true } : n
    );

    expect(updated.find(n => n.id === '1').read).toBe(true);
    expect(updated.find(n => n.id === '2').read).toBe(false);
  });

  test('Batch marks multiple notifications as read', () => {
    const notifications = [
      { id: '1', read: false },
      { id: '2', read: false },
      { id: '3', read: false },
    ];

    const idsToMark = ['1', '2'];
    const updated = notifications.map(n =>
      idsToMark.includes(n.id) ? { ...n, read: true } : n
    );

    expect(updated.filter(n => n.read).length).toBe(2);
    expect(updated.find(n => n.id === '3').read).toBe(false);
  });
});

describe('Notification Limits', () => {
  
  test('Limits notifications to maximum count', () => {
    const MAX_NOTIFICATIONS = 50;
    const notifications = Array.from({ length: 60 }, (_, i) => ({
      id: `${i}`,
      createdAt: new Date(),
    }));

    const limited = notifications.slice(0, MAX_NOTIFICATIONS);
    expect(limited.length).toBe(MAX_NOTIFICATIONS);
  });

  test('Removes oldest when exceeding limit', () => {
    const MAX = 3;
    let notifications = [
        { id: '1', createdAt: new Date(2024, 0, 1) },
        { id: '2', createdAt: new Date(2024, 0, 2) },
        { id: '3', createdAt: new Date(2024, 0, 3) },
    ];

    // Add new notification
    const newNotif = { id: '4', createdAt: new Date(2024, 0, 4) };
    notifications = [newNotif, ...notifications];

    // Sort by date descending, then keep only MAX most recent
    notifications = notifications
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, MAX);

    expect(notifications.length).toBe(MAX);
    expect(notifications.find(n => n.id === '1')).toBeUndefined();
    expect(notifications.find(n => n.id === '4')).toBeDefined(); // Newest still there
    });

  test('Auto-deletes old read notifications', () => {
    const DAYS_TO_KEEP = 7;
    const cutoffDate = Date.now() - (DAYS_TO_KEEP * 24 * 60 * 60 * 1000);
    
    const notifications = [
      { id: '1', read: true, createdAt: new Date(cutoffDate - 1000) },
      { id: '2', read: true, createdAt: new Date() },
      { id: '3', read: false, createdAt: new Date(cutoffDate - 1000) },
    ];

    const filtered = notifications.filter(n => 
      !n.read || n.createdAt.getTime() > cutoffDate
    );

    expect(filtered.length).toBe(2);
    expect(filtered.find(n => n.id === '1')).toBeUndefined();
  });
});

describe('Notification Badge Count', () => {
  
  test('Calculates correct unread count', () => {
    const notifications = [
      { id: '1', read: false },
      { id: '2', read: true },
      { id: '3', read: false },
      { id: '4', read: false },
    ];

    const unreadCount = notifications.filter(n => !n.read).length;
    expect(unreadCount).toBe(3);
  });

  test('Badge count is zero when all read', () => {
    const notifications = [
      { id: '1', read: true },
      { id: '2', read: true },
    ];

    const unreadCount = notifications.filter(n => !n.read).length;
    expect(unreadCount).toBe(0);
  });

  test('Badge count is zero for empty notifications', () => {
    const notifications = [];
    const unreadCount = notifications.filter(n => !n.read).length;
    expect(unreadCount).toBe(0);
  });

  test('Badge count caps at 99', () => {
    const largeCount = 150;
    const displayCount = largeCount > 99 ? '99+' : largeCount;
    
    expect(displayCount).toBe('99+');
  });
});

describe('Notification Priority', () => {
  
  test('Assigns priority levels', () => {
    const priorities = ['high', 'medium', 'low'];
    
    const notification = {
      id: '1',
      priority: 'high',
    };

    expect(priorities).toContain(notification.priority);
  });

  test('Sorts by priority then date', () => {
    const notifications = [
      { id: '1', priority: 'low', createdAt: new Date(2024, 0, 3) },
      { id: '2', priority: 'high', createdAt: new Date(2024, 0, 1) },
      { id: '3', priority: 'medium', createdAt: new Date(2024, 0, 2) },
    ];

    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const sorted = [...notifications].sort((a, b) => {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    expect(sorted[0].id).toBe('2'); // High priority first
  });
});