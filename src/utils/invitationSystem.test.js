// src/utils/invitationSystem.test.js
// Test suite for invitationSystem utility
// Covers: getMyInvitations, getMySentInvitations, acceptInvitation,
//         declineInvitation, cancelInvitation, cleanupExpiredInvitations,
//         getInvitationCount, sendBulkInvitations (error paths)

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSetDoc          = jest.fn();
const mockGetDoc          = jest.fn();
const mockUpdateDoc       = jest.fn();
const mockDeleteDoc       = jest.fn();
const mockGetDocs         = jest.fn();
const mockServerTimestamp = jest.fn(() => 'TIMESTAMP');
const mockArrayUnion      = jest.fn(val => val);
const mockWhere           = jest.fn();
const mockQuery           = jest.fn(q => q);
const mockCollection      = jest.fn(() => ({ _collectionPath: 'mock-collection' }));
const mockDoc             = jest.fn(() => ({ id: 'mock-ref-id' }));

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
  sendInvitation,
  sendBulkInvitations,
  getMyInvitations,
  getMySentInvitations,
  acceptInvitation,
  declineInvitation,
  cancelInvitation,
  cleanupExpiredInvitations,
  getInvitationCount,
} from './invitationSystem';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const mockFromUser = {
  uid: 'user-1',
  displayName: 'Alice',
  email: 'alice@test.com',
  photoURL: null,
};

const futureExpiry = { toMillis: () => Date.now() + 86400000 }; // 1 day ahead
const pastExpiry   = { toMillis: () => Date.now() - 86400000 }; // 1 day ago

// ─────────────────────────────────────────────────────────────────────────────

describe('sendInvitation', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Returns failure when user is already in the group', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ memberIds: ['user-2'] }) })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({}) });
    const result = await sendInvitation(mockFromUser, 'user-2', 'group-1', 'Trip');
    expect(result.success).toBe(false);
    expect(result.message).toBe('User is already in this group');
  });

  test('Returns failure when recipient user not found', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ memberIds: [] }) })
      .mockResolvedValueOnce({ exists: () => false });
    const result = await sendInvitation(mockFromUser, 'user-2', 'group-1', 'Trip');
    expect(result.success).toBe(false);
    expect(result.message).toBe('User not found');
  });

  test('Returns failure on Firebase error', async () => {
    mockGetDocs.mockRejectedValue(new Error('Firebase error'));
    const result = await sendInvitation(mockFromUser, 'user-2', 'group-1', 'Trip');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Failed to send invitation');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('sendBulkInvitations', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Returns empty arrays when no user IDs are provided', async () => {
    const result = await sendBulkInvitations(mockFromUser, [], 'group-1', 'Trip');
    expect(result.successful).toEqual([]);
    expect(result.failed).toEqual([]);
  });

  test('Fails all users when Firebase throws on getDocs', async () => {
    mockGetDocs.mockRejectedValue(new Error('Firebase error'));
    const result = await sendBulkInvitations(mockFromUser, ['user-2', 'user-3'], 'group-1', 'Trip');
    expect(result.successful).toEqual([]);
    expect(result.failed).toHaveLength(2);
  });

  test('Fails specific users who are already members', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ memberIds: ['user-2', 'user-3'] }), // both already in group
    });
    const result = await sendBulkInvitations(mockFromUser, ['user-2', 'user-3'], 'group-1', 'Trip');
    expect(result.failed).toHaveLength(2);
    expect(result.successful).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('getMyInvitations', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Returns empty array on Firebase error', async () => {
    mockGetDocs.mockRejectedValue(new Error('Firebase error'));
    const result = await getMyInvitations('user-1');
    expect(result).toEqual([]);
  });

  test('Returns empty array when user has no invitations', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    const result = await getMyInvitations('user-1');
    expect(result).toEqual([]);
  });

  test('Returns valid non-expired invitations', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{
        id: 'inv-1',
        data: () => ({ groupName: 'Trip', expiresAt: futureExpiry, createdAt: { toMillis: () => Date.now() } }),
      }],
    });
    const result = await getMyInvitations('user-1');
    expect(result).toHaveLength(1);
    expect(result[0].groupName).toBe('Trip');
  });

  test('Skips expired invitations and marks them via updateDoc', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{
        id: 'inv-expired',
        data: () => ({ groupName: 'Old Trip', expiresAt: pastExpiry, createdAt: { toMillis: () => 0 } }),
      }],
    });
    mockUpdateDoc.mockResolvedValue(undefined);
    const result = await getMyInvitations('user-1');
    expect(result).toHaveLength(0);
    expect(mockUpdateDoc).toHaveBeenCalled();
  });

  test('Sorts invitations by most recent createdAt', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'inv-1', data: () => ({ groupName: 'Old', expiresAt: futureExpiry, createdAt: { toMillis: () => 1000 } }) },
        { id: 'inv-2', data: () => ({ groupName: 'New', expiresAt: futureExpiry, createdAt: { toMillis: () => 5000 } }) },
      ],
    });
    const result = await getMyInvitations('user-1');
    expect(result[0].groupName).toBe('New');
  });

  test('Handles invitations with null createdAt without crashing', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'inv-1', data: () => ({ groupName: 'Trip', expiresAt: futureExpiry, createdAt: null }) }],
    });
    const result = await getMyInvitations('user-1');
    expect(result).toHaveLength(1);
  });

  test('Returns correct id on each invitation', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'inv-abc', data: () => ({ groupName: 'Trip', expiresAt: futureExpiry, createdAt: null }) }],
    });
    const result = await getMyInvitations('user-1');
    expect(result[0].id).toBe('inv-abc');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('getMySentInvitations', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Returns empty array on Firebase error', async () => {
    mockGetDocs.mockRejectedValue(new Error('Firebase error'));
    const result = await getMySentInvitations('user-1');
    expect(result).toEqual([]);
  });

  test('Returns invitations sent by the user', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'inv-1', data: () => ({ groupName: 'Trip', fromUserId: 'user-1' }) }],
    });
    const result = await getMySentInvitations('user-1');
    expect(result).toHaveLength(1);
    expect(result[0].groupName).toBe('Trip');
  });

  test('Returns empty array when user has sent no invitations', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    const result = await getMySentInvitations('user-1');
    expect(result).toEqual([]);
  });

  test('Applies groupId filter when provided', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    await getMySentInvitations('user-1', 'group-1');
    expect(mockQuery).toHaveBeenCalled();
  });

  test('Returns multiple invitations sent by user', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'inv-1', data: () => ({ groupName: 'Trip', fromUserId: 'user-1' }) },
        { id: 'inv-2', data: () => ({ groupName: 'Dinner', fromUserId: 'user-1' }) },
      ],
    });
    const result = await getMySentInvitations('user-1');
    expect(result).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('acceptInvitation', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Returns failure when invitation not found', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await acceptInvitation('inv-1', 'user-2');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Invitation not found');
  });

  test('Returns failure when invitation is for a different user', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ toUserId: 'user-99', expiresAt: futureExpiry }),
    });
    const result = await acceptInvitation('inv-1', 'user-2');
    expect(result.success).toBe(false);
    expect(result.message).toBe('This invitation is not for you');
  });

  test('Returns failure when invitation is expired', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ toUserId: 'user-2', expiresAt: pastExpiry }),
    });
    mockUpdateDoc.mockResolvedValue(undefined);
    const result = await acceptInvitation('inv-1', 'user-2');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Invitation has expired');
  });

  test('Marks invitation as expired via updateDoc when expired', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ toUserId: 'user-2', expiresAt: pastExpiry }),
    });
    mockUpdateDoc.mockResolvedValue(undefined);
    await acceptInvitation('inv-1', 'user-2');
    expect(mockUpdateDoc).toHaveBeenCalled();
  });

  test('Returns failure when group not found', async () => {
    mockGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ toUserId: 'user-2', expiresAt: futureExpiry, groupId: 'group-1' }),
      })
      .mockResolvedValueOnce({ exists: () => false });
    const result = await acceptInvitation('inv-1', 'user-2');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Group not found');
  });

  test('Returns failure when user is already a group member', async () => {
    mockGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ toUserId: 'user-2', expiresAt: futureExpiry, groupId: 'group-1' }),
      })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ memberIds: ['user-2'] }) });
    mockUpdateDoc.mockResolvedValue(undefined);
    const result = await acceptInvitation('inv-1', 'user-2');
    expect(result.success).toBe(false);
    expect(result.message).toBe('You are already a member of this group');
  });

  test('Returns success and correct groupId when accepted', async () => {
    mockGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ toUserId: 'user-2', expiresAt: futureExpiry, groupId: 'group-1', groupName: 'Trip' }),
      })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ memberIds: [] }) })
      .mockResolvedValueOnce({ data: () => ({ fullName: 'Bob', email: 'bob@test.com', photoURL: null }) });
    mockUpdateDoc.mockResolvedValue(undefined);
    const result = await acceptInvitation('inv-1', 'user-2');
    expect(result.success).toBe(true);
    expect(result.groupId).toBe('group-1');
  });

  test('Returns failure on Firebase error', async () => {
    mockGetDoc.mockRejectedValue(new Error('Firebase error'));
    const result = await acceptInvitation('inv-1', 'user-2');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Failed to accept invitation');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('declineInvitation', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Returns failure when invitation not found', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await declineInvitation('inv-1', 'user-2');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Invitation not found');
  });

  test('Returns failure when invitation is for a different user', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ toUserId: 'user-99' }) });
    const result = await declineInvitation('inv-1', 'user-2');
    expect(result.success).toBe(false);
    expect(result.message).toBe('This invitation is not for you');
  });

  test('Returns success when invitation is declined', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ toUserId: 'user-2' }) });
    mockUpdateDoc.mockResolvedValue(undefined);
    const result = await declineInvitation('inv-1', 'user-2');
    expect(result.success).toBe(true);
    expect(result.message).toBe('Invitation declined');
  });

  test('Calls updateDoc when declining', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ toUserId: 'user-2' }) });
    mockUpdateDoc.mockResolvedValue(undefined);
    await declineInvitation('inv-1', 'user-2');
    expect(mockUpdateDoc).toHaveBeenCalled();
  });

  test('Does not call updateDoc when invitation not found', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    await declineInvitation('inv-1', 'user-2');
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  test('Returns failure on Firebase error', async () => {
    mockGetDoc.mockRejectedValue(new Error('Firebase error'));
    const result = await declineInvitation('inv-1', 'user-2');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Failed to decline invitation');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('cancelInvitation', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Returns failure when invitation not found', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await cancelInvitation('inv-1', 'user-1');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Invitation not found');
  });

  test('Returns failure when user is not the original sender', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ fromUserId: 'user-99' }) });
    const result = await cancelInvitation('inv-1', 'user-1');
    expect(result.success).toBe(false);
    expect(result.message).toBe('You can only cancel invitations you sent');
  });

  test('Returns success when invitation is cancelled', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ fromUserId: 'user-1' }) });
    mockDeleteDoc.mockResolvedValue(undefined);
    const result = await cancelInvitation('inv-1', 'user-1');
    expect(result.success).toBe(true);
    expect(result.message).toBe('Invitation cancelled');
  });

  test('Calls deleteDoc when cancelling', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ fromUserId: 'user-1' }) });
    mockDeleteDoc.mockResolvedValue(undefined);
    await cancelInvitation('inv-1', 'user-1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });

  test('Does not call deleteDoc when user is not the sender', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ fromUserId: 'user-99' }) });
    await cancelInvitation('inv-1', 'user-1');
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  test('Returns failure on Firebase error', async () => {
    mockGetDoc.mockRejectedValue(new Error('Firebase error'));
    const result = await cancelInvitation('inv-1', 'user-1');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Failed to cancel invitation');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('cleanupExpiredInvitations', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Returns 0 when there are no pending invitations', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    const count = await cleanupExpiredInvitations();
    expect(count).toBe(0);
  });

  test('Returns 0 when all invitations are still valid', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'inv-1', data: () => ({ expiresAt: futureExpiry }) }],
    });
    const count = await cleanupExpiredInvitations();
    expect(count).toBe(0);
  });

  test('Returns count of expired invitations cleaned up', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'inv-1', data: () => ({ expiresAt: pastExpiry }) },
        { id: 'inv-2', data: () => ({ expiresAt: pastExpiry }) },
      ],
    });
    mockUpdateDoc.mockResolvedValue(undefined);
    const count = await cleanupExpiredInvitations();
    expect(count).toBe(2);
  });

  test('Calls updateDoc once per expired invitation', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'inv-1', data: () => ({ expiresAt: pastExpiry }) }],
    });
    mockUpdateDoc.mockResolvedValue(undefined);
    await cleanupExpiredInvitations();
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
  });

  test('Does not call updateDoc for valid invitations', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'inv-1', data: () => ({ expiresAt: futureExpiry }) }],
    });
    await cleanupExpiredInvitations();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  test('Returns 0 on Firebase error', async () => {
    mockGetDocs.mockRejectedValue(new Error('Firebase error'));
    const count = await cleanupExpiredInvitations();
    expect(count).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('getInvitationCount', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Returns 0 when user has no pending invitations', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    const count = await getInvitationCount('user-1');
    expect(count).toBe(0);
  });

  test('Returns correct count for multiple pending invitations', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'inv-1', data: () => ({ groupName: 'Trip',   expiresAt: futureExpiry, createdAt: null }) },
        { id: 'inv-2', data: () => ({ groupName: 'Dinner', expiresAt: futureExpiry, createdAt: null }) },
      ],
    });
    const count = await getInvitationCount('user-1');
    expect(count).toBe(2);
  });

  test('Returns 0 on Firebase error', async () => {
    mockGetDocs.mockRejectedValue(new Error('Firebase error'));
    const count = await getInvitationCount('user-1');
    expect(count).toBe(0);
  });
});
