// src/utils/userConnectionsManager.test.js
// Test suite for userConnectionsManager - connection tracking, retrieval, removal

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSetDoc    = jest.fn();
const mockGetDoc    = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockGetDocs   = jest.fn();
const mockDoc       = jest.fn((...args) => args.join('/'));
const mockCollection= jest.fn((...args) => args.join('/'));
const mockQuery     = jest.fn(q => q);
const mockWhere     = jest.fn();
const mockArrayUnion= jest.fn(val => val);
const mockServerTimestamp = jest.fn(() => 'TIMESTAMP');

jest.mock('firebase/firestore', () => ({
  doc:             (...a) => mockDoc(...a),
  getDoc:          (...a) => mockGetDoc(...a),
  setDoc:          (...a) => mockSetDoc(...a),
  updateDoc:       (...a) => mockUpdateDoc(...a),
  deleteDoc:       (...a) => mockDeleteDoc(...a),
  getDocs:         (...a) => mockGetDocs(...a),
  collection:      (...a) => mockCollection(...a),
  query:           (...a) => mockQuery(...a),
  where:           (...a) => mockWhere(...a),
  arrayUnion:      (...a) => mockArrayUnion(...a),
  serverTimestamp: ()     => mockServerTimestamp(),
}));

jest.mock('../services/firebase', () => ({ db: {} }));

// ─── Import after mocks ───────────────────────────────────────────────────────
import {
  trackConnection,
  getConnections,
  getConnectionDetails,
  removeConnection,
  updateConnectionOnLeaveGroup,
  updateGroupConnections,
  syncMyConnectionsFromGroups,
} from './userConnectionsManager';

// ─────────────────────────────────────────────────────────────────────────────

describe('trackConnection', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Does nothing when userId equals otherUserId (self-connection)', async () => {
    await trackConnection('user-1', 'user-1', 'group-1', 'Trip');
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  test('Returns early when other user doc does not exist', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    await trackConnection('user-1', 'user-2', 'group-1', 'Trip');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  test('Creates new connection when none exists', async () => {
    mockGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ fullName: 'Bob', email: 'bob@test.com', photoURL: null }),
      })
      .mockResolvedValueOnce({ exists: () => false }); // no existing connection

    await trackConnection('user-1', 'user-2', 'group-1', 'Trip');
    expect(mockSetDoc).toHaveBeenCalled();
  });

  test('Updates existing connection when one exists', async () => {
    mockGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ fullName: 'Bob', email: 'bob@test.com', photoURL: null }),
      })
      .mockResolvedValueOnce({ exists: () => true }); // existing connection

    await trackConnection('user-1', 'user-2', 'group-1', 'Trip');
    expect(mockUpdateDoc).toHaveBeenCalled();
  });

  test('Does not throw on Firebase error', async () => {
    mockGetDoc.mockRejectedValue(new Error('Firebase error'));
    await expect(trackConnection('user-1', 'user-2', 'group-1', 'Trip')).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('getConnections', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Returns empty array on Firebase error', async () => {
    mockGetDocs.mockRejectedValue(new Error('Firebase error'));
    const result = await getConnections('user-1');
    expect(result).toEqual([]);
  });

  test('Returns empty array when no connections exist', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    const result = await getConnections('user-1');
    expect(result).toEqual([]);
  });

  test('Returns connections array with correct data', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'user-2', data: () => ({ userId: 'user-2', name: 'Bob', updatedAt: null }) },
        { id: 'user-3', data: () => ({ userId: 'user-3', name: 'Carol', updatedAt: null }) },
      ],
    });
    const result = await getConnections('user-1');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBeDefined();
  });

  test('Sorts connections by most recent updatedAt', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'user-2', data: () => ({ userId: 'user-2', name: 'Bob',   updatedAt: { toMillis: () => 1000 } }) },
        { id: 'user-3', data: () => ({ userId: 'user-3', name: 'Carol', updatedAt: { toMillis: () => 5000 } }) },
      ],
    });
    const result = await getConnections('user-1');
    expect(result[0].name).toBe('Carol'); // most recent first
  });

  test('Handles connections with null updatedAt', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'user-2', data: () => ({ userId: 'user-2', name: 'Bob', updatedAt: null }) },
      ],
    });
    const result = await getConnections('user-1');
    expect(result).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('getConnectionDetails', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Returns connection data when it exists', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'user-2',
      data: () => ({ userId: 'user-2', name: 'Bob' }),
    });
    const result = await getConnectionDetails('user-1', 'user-2');
    expect(result).not.toBeNull();
    expect(result.name).toBe('Bob');
  });

  test('Returns null when connection does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getConnectionDetails('user-1', 'user-2');
    expect(result).toBeNull();
  });

  test('Returns null on Firebase error', async () => {
    mockGetDoc.mockRejectedValue(new Error('Firebase error'));
    const result = await getConnectionDetails('user-1', 'user-2');
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('removeConnection', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Does nothing when connection does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    await removeConnection('user-1', 'user-2');
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  test('Removes connection when sharedGroups is empty', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ sharedGroups: [] }),
    });
    await removeConnection('user-1', 'user-2');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });

  test('Does not remove connection when shared groups remain', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ sharedGroups: [{ groupId: 'g1', groupName: 'Trip' }] }),
    });
    await removeConnection('user-1', 'user-2');
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  test('Does not throw on Firebase error', async () => {
    mockGetDoc.mockRejectedValue(new Error('Firebase error'));
    await expect(removeConnection('user-1', 'user-2')).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('updateConnectionOnLeaveGroup', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Does nothing when connection does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    await updateConnectionOnLeaveGroup('user-1', 'user-2', 'group-1');
    expect(mockDeleteDoc).not.toHaveBeenCalled();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  test('Deletes connection when no shared groups remain after removal', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ sharedGroups: [{ groupId: 'group-1', groupName: 'Trip' }] }),
    });
    await updateConnectionOnLeaveGroup('user-1', 'user-2', 'group-1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });

  test('Updates connection when other shared groups remain', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        sharedGroups: [
          { groupId: 'group-1', groupName: 'Trip' },
          { groupId: 'group-2', groupName: 'Dinner' },
        ],
      }),
    });
    await updateConnectionOnLeaveGroup('user-1', 'user-2', 'group-1');
    expect(mockUpdateDoc).toHaveBeenCalled();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  test('Does not throw on Firebase error', async () => {
    mockGetDoc.mockRejectedValue(new Error('Firebase error'));
    await expect(
      updateConnectionOnLeaveGroup('user-1', 'user-2', 'group-1')
    ).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('updateGroupConnections', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Does nothing with empty member list', async () => {
    await updateGroupConnections('group-1', 'Trip', []);
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  test('Does nothing with single member', async () => {
    await updateGroupConnections('group-1', 'Trip', ['user-1']);
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  test('Does not throw on Firebase error', async () => {
    mockGetDoc.mockRejectedValue(new Error('Firebase error'));
    await expect(
      updateGroupConnections('group-1', 'Trip', ['user-1', 'user-2'])
    ).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('syncMyConnectionsFromGroups', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Returns failure when userId is null', async () => {
    const result = await syncMyConnectionsFromGroups(null);
    expect(result.success).toBe(false);
  });

  test('Returns failure when userId is undefined', async () => {
    const result = await syncMyConnectionsFromGroups(undefined);
    expect(result.success).toBe(false);
  });

  test('Returns success with 0 when user has no groups', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    const result = await syncMyConnectionsFromGroups('user-1');
    expect(result.success).toBe(true);
    expect(result.synced).toBe(0);
  });

  test('Returns failure on Firebase error', async () => {
    mockGetDocs.mockRejectedValue(new Error('Firebase error'));
    const result = await syncMyConnectionsFromGroups('user-1');
    expect(result.success).toBe(false);
  });

  test('Syncs connections for group members', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{
        id: 'group-1',
        data: () => ({ name: 'Trip', memberIds: ['user-1', 'user-2', 'user-3'] }),
      }],
    });
    // trackConnection calls getDoc for each other member
    mockGetDoc.mockResolvedValue({ exists: () => false });

    const result = await syncMyConnectionsFromGroups('user-1');
    expect(result.success).toBe(true);
    expect(result.synced).toBe(2); // user-2 and user-3
  });
});