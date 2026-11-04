// Tests for safe account deletion against a small in-memory Firestore.

const mockStore = {};
const mockNotify = jest.fn(() => Promise.resolve());

jest.mock('../services/firebase', () => ({ db: {} }));
jest.mock('../stores/notificationsStore', () => ({
  createNotification: (...a) => mockNotify(...a),
}));

jest.mock('firebase/firestore', () => {
  const path = (parts) => parts.join('/');
  const docsIn = (coll) => Object.entries(mockStore)
    .filter(([p]) => p.startsWith(coll + '/') && !p.slice(coll.length + 1).includes('/'))
    .map(([p, data]) => ({ id: p.split('/').pop(), ref: { path: p }, data: () => data }));
  const matches = (data, [field, op, val]) =>
    op === '==' ? data[field] === val
    : op === 'array-contains' ? (data[field] || []).includes(val)
    : false;
  const apply = (p, update) => {
    const cur = { ...mockStore[p] };
    Object.entries(update).forEach(([k, v]) => {
      if (v && v.__arrayRemove !== undefined) cur[k] = (cur[k] || []).filter(x => x !== v.__arrayRemove);
      else cur[k] = v;
    });
    mockStore[p] = cur;
  };
  return {
    collection: (_db, ...parts) => ({ coll: path(parts) }),
    doc: (_db, ...parts) => ({ path: path(parts) }),
    where: (f, op, v) => [f, op, v],
    query: (c, ...filters) => ({ coll: c.coll, filters }),
    getDocs: async (q) => {
      const docs = docsIn(q.coll).filter(d => (q.filters || []).every(f => matches(d.data(), f)));
      return { docs, empty: docs.length === 0 };
    },
    updateDoc: async (ref, data) => apply(ref.path, data),
    deleteDoc: async (ref) => { delete mockStore[ref.path]; },
    writeBatch: () => {
      const ops = [];
      return { delete: (ref) => ops.push(ref.path), commit: async () => ops.forEach(p => delete mockStore[p]) };
    },
    arrayRemove: (v) => ({ __arrayRemove: v }),
  };
});

import { findUnsettledGroups, deleteAccountData } from './accountDeletion';

const ALICE = { uid: 'alice', displayName: 'Alice', email: 'alice@x.com' };
const m = (userId, name, role = 'member', joined = '2026-01-01') => ({ userId, name, email: `${userId}@x.com`, role, joinedAt: new Date(joined) });
const exp = (groupId, paidBy, amount, splits) => ({ groupId, paidBy, amount, splits, participants: Object.keys(splits) });

function seed() {
  Object.keys(mockStore).forEach(k => delete mockStore[k]);
  Object.assign(mockStore, {
    // Shared group Alice owns, with Bob (joined first) and Carol
    'groups/owned': { name: 'Trip', createdBy: 'alice', memberIds: ['alice', 'bob', 'carol'],
      members: [m('alice', 'Alice', 'owner'), m('carol', 'Carol', 'member', '2026-03-01'), m('bob', 'Bob', 'member', '2026-02-01')] },
    // Shared group owned by Bob
    'groups/shared': { name: 'Flat', createdBy: 'bob', memberIds: ['bob', 'alice'], members: [m('bob', 'Bob', 'owner'), m('alice', 'Alice')] },
    // Personal tracker and a solo shared group
    'groups/personal': { name: 'Me', type: 'personal', createdBy: 'alice', memberIds: ['alice'], members: [m('alice', 'Alice', 'owner')] },
    'groups/solo': { name: 'Solo', createdBy: 'alice', memberIds: ['alice'], members: [m('alice', 'Alice', 'owner')] },
    // Settled expenses in shared groups (Alice paid 20 for Bob, Bob paid 20 back)
    'expenses/e1': exp('shared', 'alice', 20, { bob: 20 }),
    'expenses/e2': exp('shared', 'bob', 20, { alice: 20 }),
    'expenses/e3': exp('owned', 'alice', 30, { alice: 10, bob: 10, carol: 10 }),
    'expenses/e4': exp('owned', 'bob', 10, { alice: 10 }),
    'expenses/e5': exp('owned', 'carol', 10, { alice: 10 }),
    'expenses/p1': exp('personal', 'alice', 7, { alice: 7 }),
    'expenses/s1': exp('solo', 'alice', 5, { alice: 5 }),
    // Private records
    'users/alice': { displayName: 'Alice' },
    'users/alice/private/details': { paymentMethods: { paypalUsername: 'alice' }, phoneNumber: '+353' },
    'users/bob': { displayName: 'Bob' },
    'notifications/n1': { userId: 'alice' },
    'notifications/n2': { userId: 'bob' },
    'invitations/i1': { fromUserId: 'alice', toUserId: 'dave', status: 'pending' },
    'invitations/i2': { fromUserId: 'erin', toUserId: 'alice', status: 'pending' },
    'phoneNumbers/h1': { userId: 'alice' },
    'connections/alice/connectedUsers/bob': { name: 'Bob' },
  });
}

beforeEach(() => { seed(); mockNotify.mockClear(); });

describe('findUnsettledGroups', () => {
  test('returns nothing when every balance is settled', async () => {
    expect(await findUnsettledGroups('alice')).toEqual([]);
  });

  test('reports groups where the user owes or is owed, ignoring personal trackers', async () => {
    mockStore['expenses/e6'] = exp('shared', 'bob', 50, { alice: 50 });
    mockStore['expenses/p2'] = exp('personal', 'alice', 99, { bob: 99 }); // nonsense but must be ignored
    const out = await findUnsettledGroups('alice');
    expect(out).toEqual([expect.objectContaining({ groupId: 'shared', name: 'Flat', amount: '50.00', direction: 'owe' })]);
  });
});

describe('deleteAccountData', () => {
  beforeEach(async () => { await deleteAccountData(ALICE); });

  test('leaves shared groups but keeps every shared expense', () => {
    expect(mockStore['groups/shared'].memberIds).toEqual(['bob']);
    expect(mockStore['groups/shared'].members.map(x => x.userId)).toEqual(['bob']);
    expect(mockStore['groups/shared'].formerMembers).toEqual([
      expect.objectContaining({ userId: 'alice', name: 'Alice', reason: 'account_deleted' }),
    ]);
    ['e1', 'e2', 'e3', 'e4', 'e5'].forEach(id => expect(mockStore[`expenses/${id}`]).toBeDefined());
  });

  test('hands an owned shared group to the longest-standing member and notifies them', () => {
    const g = mockStore['groups/owned'];
    expect(g.createdBy).toBe('bob'); // joined before Carol
    expect(g.members.find(x => x.userId === 'bob').role).toBe('owner');
    expect(g.memberIds).toEqual(['bob', 'carol']);
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ userId: 'bob', type: 'group_ownership' }));
  });

  test('deletes personal trackers and solo groups with their expenses', () => {
    expect(mockStore['groups/personal']).toBeUndefined();
    expect(mockStore['groups/solo']).toBeUndefined();
    expect(mockStore['expenses/p1']).toBeUndefined();
    expect(mockStore['expenses/s1']).toBeUndefined();
  });

  test('erases private data and declines invitations sent to the user', () => {
    expect(mockStore['users/alice']).toBeUndefined();
    expect(mockStore['users/alice/private/details']).toBeUndefined();
    expect(mockStore['notifications/n1']).toBeUndefined();
    expect(mockStore['invitations/i1']).toBeUndefined();
    expect(mockStore['phoneNumbers/h1']).toBeUndefined();
    expect(mockStore['connections/alice/connectedUsers/bob']).toBeUndefined();
    expect(mockStore['invitations/i2'].status).toBe('declined');
    // Other people's data is untouched
    expect(mockStore['users/bob']).toBeDefined();
    expect(mockStore['notifications/n2']).toBeDefined();
  });
});
