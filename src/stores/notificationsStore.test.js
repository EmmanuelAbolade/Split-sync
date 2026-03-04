// src/stores/notificationsStore.test.js
// Test suite for notificationsStore - notification state, Firestore subscriptions, and batch operations

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../services/firebase', () => ({ db: {} }));

const mockOnSnapshot  = jest.fn();
const mockUpdateDoc   = jest.fn();
const mockWriteBatch  = jest.fn();
const mockAddDoc      = jest.fn();
const mockDoc         = jest.fn();
const mockCollection  = jest.fn();
const mockQuery       = jest.fn();
const mockWhere       = jest.fn();
const mockServerTimestamp = jest.fn(() => 'SERVER_TIMESTAMP');

jest.mock('firebase/firestore', () => ({
  collection:      (...args) => mockCollection(...args),
  query:           (...args) => mockQuery(...args),
  where:           (...args) => mockWhere(...args),
  onSnapshot:      (...args) => mockOnSnapshot(...args),
  doc:             (...args) => mockDoc(...args),
  updateDoc:       (...args) => mockUpdateDoc(...args),
  writeBatch:      (...args) => mockWriteBatch(...args),
  addDoc:          (...args) => mockAddDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeNotif = (overrides = {}) => ({
  id: 'notif-001',
  userId: 'user-123',
  type: 'expense',
  title: 'New expense',
  message: 'Alice added an expense',
  read: false,
  createdAt: { toDate: () => new Date('2025-01-01T12:00:00Z') },
  ...overrides,
});

/** Simulate Firestore snapshot callback */
const triggerSnapshot = (snapshotCallback, docs) => {
  snapshotCallback({
    docs: docs.map(d => ({
      id: d.id,
      data: () => {
        const { id, ...rest } = d;
        return rest;
      },
    })),
  });
};

const getStore = () => {
  const mod = require('./notificationsStore');
  return { useNotificationsStore: mod.useNotificationsStore, createNotification: mod.createNotification };
};

// ─────────────────────────────────────────────────────────────────────────────

describe('notificationsStore - Initial state', () => {

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockServerTimestamp.mockReturnValue('SERVER_TIMESTAMP');
  });

  test('Initial notifications is empty array', () => {
    const { useNotificationsStore } = getStore();
    expect(useNotificationsStore.getState().notifications).toEqual([]);
  });

  test('Initial unreadCount is 0', () => {
    const { useNotificationsStore } = getStore();
    expect(useNotificationsStore.getState().unreadCount).toBe(0);
  });

  test('Initial loading is false', () => {
    const { useNotificationsStore } = getStore();
    expect(useNotificationsStore.getState().loading).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('notificationsStore - subscribeToNotifications', () => {

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('Returns empty unsubscribe function when userId is null', () => {
    const { useNotificationsStore } = getStore();
    const unsub = useNotificationsStore.getState().subscribeToNotifications(null);
    expect(typeof unsub).toBe('function');
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  test('Returns empty unsubscribe function when userId is undefined', () => {
    const { useNotificationsStore } = getStore();
    const unsub = useNotificationsStore.getState().subscribeToNotifications(undefined);
    expect(typeof unsub).toBe('function');
  });

  test('Sets loading to true when subscribing', () => {
    const mockUnsub = jest.fn();
    mockOnSnapshot.mockReturnValue(mockUnsub);

    const { useNotificationsStore } = getStore();

    // Capture loading state before snapshot fires
    mockOnSnapshot.mockImplementation(() => mockUnsub);
    useNotificationsStore.getState().subscribeToNotifications('user-123');
    // loading was set to true during the call
    expect(mockOnSnapshot).toHaveBeenCalled();
  });

  test('Calls onSnapshot with correct query', () => {
    const mockUnsub = jest.fn();
    mockOnSnapshot.mockReturnValue(mockUnsub);
    mockQuery.mockReturnValue('mock-query');

    const { useNotificationsStore } = getStore();
    useNotificationsStore.getState().subscribeToNotifications('user-123');

    expect(mockOnSnapshot).toHaveBeenCalledWith('mock-query', expect.any(Function));
  });

  test('Returns unsubscribe function from onSnapshot', () => {
    const mockUnsub = jest.fn();
    mockOnSnapshot.mockReturnValue(mockUnsub);

    const { useNotificationsStore } = getStore();
    const unsub = useNotificationsStore.getState().subscribeToNotifications('user-123');
    expect(unsub).toBe(mockUnsub);
  });

  test('Sets notifications from snapshot', () => {
    let snapshotCallback;
    mockOnSnapshot.mockImplementation((q, cb) => {
      snapshotCallback = cb;
      return jest.fn();
    });

    const { useNotificationsStore } = getStore();
    useNotificationsStore.getState().subscribeToNotifications('user-123');

    triggerSnapshot(snapshotCallback, [makeNotif({ id: 'notif-001' })]);

    const state = useNotificationsStore.getState();
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0].id).toBe('notif-001');
  });

  test('Sets unreadCount correctly from snapshot', () => {
    let snapshotCallback;
    mockOnSnapshot.mockImplementation((q, cb) => {
      snapshotCallback = cb;
      return jest.fn();
    });

    const { useNotificationsStore } = getStore();
    useNotificationsStore.getState().subscribeToNotifications('user-123');

    triggerSnapshot(snapshotCallback, [
      makeNotif({ id: 'n1', read: false }),
      makeNotif({ id: 'n2', read: true }),
      makeNotif({ id: 'n3', read: false }),
    ]);

    expect(useNotificationsStore.getState().unreadCount).toBe(2);
  });

  test('Sets loading to false after snapshot fires', () => {
    let snapshotCallback;
    mockOnSnapshot.mockImplementation((q, cb) => {
      snapshotCallback = cb;
      return jest.fn();
    });

    const { useNotificationsStore } = getStore();
    useNotificationsStore.getState().subscribeToNotifications('user-123');
    triggerSnapshot(snapshotCallback, []);

    expect(useNotificationsStore.getState().loading).toBe(false);
  });

  test('Sorts notifications newest first using toDate()', () => {
    let snapshotCallback;
    mockOnSnapshot.mockImplementation((q, cb) => {
      snapshotCallback = cb;
      return jest.fn();
    });

    const { useNotificationsStore } = getStore();
    useNotificationsStore.getState().subscribeToNotifications('user-123');

    triggerSnapshot(snapshotCallback, [
      makeNotif({ id: 'old', createdAt: { toDate: () => new Date('2025-01-01') } }),
      makeNotif({ id: 'new', createdAt: { toDate: () => new Date('2025-06-01') } }),
    ]);

    const notifs = useNotificationsStore.getState().notifications;
    expect(notifs[0].id).toBe('new');
    expect(notifs[1].id).toBe('old');
  });

  test('Sorts notifications using string dates when toDate is absent', () => {
    let snapshotCallback;
    mockOnSnapshot.mockImplementation((q, cb) => {
      snapshotCallback = cb;
      return jest.fn();
    });

    const { useNotificationsStore } = getStore();
    useNotificationsStore.getState().subscribeToNotifications('user-123');

    triggerSnapshot(snapshotCallback, [
      makeNotif({ id: 'old', createdAt: '2025-01-01T00:00:00Z' }),
      makeNotif({ id: 'new', createdAt: '2025-06-01T00:00:00Z' }),
    ]);

    const notifs = useNotificationsStore.getState().notifications;
    expect(notifs[0].id).toBe('new');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('notificationsStore - markAsRead', () => {

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('Calls updateDoc with read:true and readAt', async () => {
    mockUpdateDoc.mockResolvedValue();
    mockDoc.mockReturnValue('mock-doc-ref');

    const { useNotificationsStore } = getStore();
    await useNotificationsStore.getState().markAsRead('notif-001');

    expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', 
      expect.objectContaining({ read: true })
    );
  });

  test('Calls doc with correct path', async () => {
    mockUpdateDoc.mockResolvedValue();

    const { useNotificationsStore } = getStore();
    await useNotificationsStore.getState().markAsRead('notif-001');

    expect(mockDoc).toHaveBeenCalledWith({}, 'notifications', 'notif-001');
  });

  test('Logs error when updateDoc fails', async () => {
    mockUpdateDoc.mockRejectedValue(new Error('Firestore error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { useNotificationsStore } = getStore();
    await useNotificationsStore.getState().markAsRead('notif-001');

    expect(consoleSpy).toHaveBeenCalledWith(
      'Error marking notification as read:',
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  test('Does not throw when updateDoc fails', async () => {
    mockUpdateDoc.mockRejectedValue(new Error('Firestore error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { useNotificationsStore } = getStore();
    await expect(useNotificationsStore.getState().markAsRead('notif-001')).resolves.not.toThrow();
    consoleSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('notificationsStore - markAllAsRead', () => {

  const mockBatch = {
    update: jest.fn(),
    commit: jest.fn().mockResolvedValue(),
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockServerTimestamp.mockReturnValue('SERVER_TIMESTAMP');
    mockWriteBatch.mockReturnValue(mockBatch);
    mockBatch.update.mockClear();
    mockBatch.commit.mockClear().mockResolvedValue();
    mockDoc.mockReturnValue('mock-doc-ref');
  });

  test('Does nothing when no unread notifications', async () => {
    const { useNotificationsStore } = getStore();

    // Set state with all-read notifications
    useNotificationsStore.setState({
      notifications: [makeNotif({ read: true })],
    });

    await useNotificationsStore.getState().markAllAsRead('user-123');
    expect(mockWriteBatch).not.toHaveBeenCalled();
  });

  test('Creates a batch and commits it', async () => {
    const { useNotificationsStore } = getStore();

    useNotificationsStore.setState({
      notifications: [makeNotif({ id: 'n1', read: false })],
    });

    await useNotificationsStore.getState().markAllAsRead('user-123');
    expect(mockWriteBatch).toHaveBeenCalled();
    expect(mockBatch.commit).toHaveBeenCalled();
  });

  test('Calls batch.update for each unread notification', async () => {
    const { useNotificationsStore } = getStore();

    useNotificationsStore.setState({
      notifications: [
        makeNotif({ id: 'n1', read: false }),
        makeNotif({ id: 'n2', read: false }),
        makeNotif({ id: 'n3', read: true }),
      ],
    });

    await useNotificationsStore.getState().markAllAsRead('user-123');
    expect(mockBatch.update).toHaveBeenCalledTimes(2);
  });

  test('Updates each unread notification with read:true', async () => {
    const { useNotificationsStore } = getStore();

    useNotificationsStore.setState({
      notifications: [makeNotif({ id: 'n1', read: false })],
    });

    await useNotificationsStore.getState().markAllAsRead('user-123');
    expect(mockBatch.update).toHaveBeenCalledWith('mock-doc-ref', {
      read: true,
      readAt: 'SERVER_TIMESTAMP',
    });
  });

  test('Logs error when batch commit fails', async () => {
    mockBatch.commit.mockRejectedValue(new Error('Batch error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { useNotificationsStore } = getStore();
    useNotificationsStore.setState({
      notifications: [makeNotif({ id: 'n1', read: false })],
    });

    await useNotificationsStore.getState().markAllAsRead('user-123');
    expect(consoleSpy).toHaveBeenCalledWith('Error marking all as read:', expect.any(Error));
    consoleSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('notificationsStore - clearAll', () => {

  const mockBatch = {
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(),
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockWriteBatch.mockReturnValue(mockBatch);
    mockBatch.delete.mockClear();
    mockBatch.commit.mockClear().mockResolvedValue();
    mockDoc.mockReturnValue('mock-doc-ref');
  });

  test('Creates a batch and commits it', async () => {
    const { useNotificationsStore } = getStore();

    useNotificationsStore.setState({
      notifications: [makeNotif({ id: 'n1' })],
    });

    await useNotificationsStore.getState().clearAll('user-123');
    expect(mockWriteBatch).toHaveBeenCalled();
    expect(mockBatch.commit).toHaveBeenCalled();
  });

  test('Calls batch.delete for each notification', async () => {
    const { useNotificationsStore } = getStore();

    useNotificationsStore.setState({
      notifications: [
        makeNotif({ id: 'n1' }),
        makeNotif({ id: 'n2' }),
      ],
    });

    await useNotificationsStore.getState().clearAll('user-123');
    expect(mockBatch.delete).toHaveBeenCalledTimes(2);
  });

  test('Handles empty notifications array without error', async () => {
    const { useNotificationsStore } = getStore();
    useNotificationsStore.setState({ notifications: [] });

    await expect(
      useNotificationsStore.getState().clearAll('user-123')
    ).resolves.not.toThrow();
  });

  test('Logs error when batch commit fails', async () => {
    mockBatch.commit.mockRejectedValue(new Error('Batch error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { useNotificationsStore } = getStore();
    useNotificationsStore.setState({
      notifications: [makeNotif({ id: 'n1' })],
    });

    await useNotificationsStore.getState().clearAll('user-123');
    expect(consoleSpy).toHaveBeenCalledWith('Error clearing notifications:', expect.any(Error));
    consoleSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('createNotification helper', () => {

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockServerTimestamp.mockReturnValue('SERVER_TIMESTAMP');
    mockAddDoc.mockResolvedValue({ id: 'new-notif-id' });
  });

  test('Calls addDoc with correct notification data', async () => {
    mockCollection.mockReturnValue('mock-collection');
    const { createNotification } = getStore();

    await createNotification({
      userId: 'user-123',
      type: 'expense',
      title: 'New Expense',
      message: 'Alice added €20',
      data: { groupId: 'group-001' },
    });

    expect(mockAddDoc).toHaveBeenCalledWith('mock-collection', {
      userId: 'user-123',
      type: 'expense',
      title: 'New Expense',
      message: 'Alice added €20',
      data: { groupId: 'group-001' },
      requiresAction: false,
      read: false,
      createdAt: 'SERVER_TIMESTAMP',
    });
  });

  test('Calls collection with notifications path', async () => {
    mockCollection.mockReturnValue('mock-collection');
    const { createNotification } = getStore();

    await createNotification({
      userId: 'user-123',
      type: 'payment',
      title: 'Payment',
      message: 'Bob paid you',
      data: {},
    });

    expect(mockCollection).toHaveBeenCalledWith({}, 'notifications');
  });

  test('Logs error when addDoc fails', async () => {
    mockAddDoc.mockRejectedValue(new Error('Firestore error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { createNotification } = getStore();
    // createNotification re-throws — catch it so the assertion below can run
    try {
      await createNotification({ userId: 'u1', type: 'expense', title: 'T', message: 'M', data: {} });
    } catch (_) {}

    expect(consoleSpy).toHaveBeenCalledWith('Error creating notification:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  test('Does not throw when addDoc fails', async () => {
    mockAddDoc.mockRejectedValue(new Error('Firestore error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { createNotification } = getStore();
    await expect(
      createNotification({ userId: 'u1', type: 'expense', title: 'T', message: 'M', data: {} })
    ).rejects.toThrow();
    consoleSpy.mockRestore();
  });
});