import {
  computeFinancials, summariseGroups, scanContent, monthlyGrowth,
  findExpiredInvitations, countActiveUsers, sortByCreatedDesc,
} from './adminStats';

const members = [{ userId: 'a', name: 'Alice' }, { userId: 'b', name: 'Bob' }];
const groups = [
  { id: 'g1', name: 'Trip', currency: 'EUR', createdBy: 'a', members },
  { id: 'g2', name: 'Flat', currency: 'GBP', createdBy: 'b', members, type: 'shared' },
  { id: 'p1', name: 'Me', currency: 'EUR', createdBy: 'a', members: [members[0]], type: 'personal' },
];
const expenses = [
  // g1: Alice paid 100 split equally → Bob owes 50 (outstanding)
  { id: 'e1', groupId: 'g1', amount: 100, currency: 'EUR', paidBy: 'a', participants: ['a', 'b'], splits: { a: 50, b: 50 }, title: 'Hotel' },
  // g2: Bob paid 40, then Alice settled 20 → settled
  { id: 'e2', groupId: 'g2', amount: 40, currency: 'GBP', paidBy: 'b', participants: ['a', 'b'], splits: { a: 20, b: 20 }, title: 'Scam electricity', description: 'bill' },
  { id: 's1', groupId: 'g2', amount: 20, currency: 'GBP', paidBy: 'a', participants: ['a', 'b'], splits: { b: 20 }, isSettlement: true },
  // removed expense — ignored everywhere
  { id: 'e3', groupId: 'g1', amount: 999, currency: 'EUR', paidBy: 'b', participants: ['a', 'b'], splits: { a: 999 }, status: 'deleted', title: 'scam' },
  // personal
  { id: 'e4', groupId: 'p1', amount: 7, currency: 'EUR', paidBy: 'a', participants: ['a'], splits: { a: 7 }, title: 'Coffee' },
];

describe('computeFinancials', () => {
  const f = computeFinancials(groups, expenses);
  test('separates spending, settlements and removed expenses', () => {
    expect(f.expenseCount).toBe(3);
    expect(f.settlementCount).toBe(1);
    expect(f.removedCount).toBe(1);
    expect(f.spendingByCurrency).toEqual({ EUR: 107, GBP: 40 });
    expect(f.settlementsByCurrency).toEqual({ GBP: 20 });
  });
  test('counts outstanding vs settled groups and what is still owed', () => {
    expect(f.outstandingGroups).toBe(1);   // g1
    expect(f.settledGroups).toBe(2);       // g2 (settled), p1 (personal, nothing owed)
    expect(f.outstandingByCurrency).toEqual({ EUR: 50 });
  });
});

test('summariseGroups adds owner, type, expense count and balance status', () => {
  const [g1, g2, p1] = summariseGroups(groups, expenses);
  expect(g1).toMatchObject({ ownerName: 'Alice', expenseCount: 1, balanceStatus: 'outstanding', typeLabel: 'Shared' });
  expect(g2).toMatchObject({ ownerName: 'Bob', expenseCount: 1, balanceStatus: 'settled' });
  expect(p1).toMatchObject({ typeLabel: 'Personal', balanceStatus: 'settled' });
  expect(summariseGroups([{ id: 'x', members: [] }], [])[0].balanceStatus).toBe('empty');
});

test('scanContent finds keywords in group names and expense text, skipping removed expenses', () => {
  const r = scanContent(['SCAM', ' trip '], groups, expenses);
  expect(r.map(x => `${x.kind}:${x.id}`).sort()).toEqual(['expense:e2', 'group:g1']);
  expect(r.find(x => x.id === 'e2')).toMatchObject({ keyword: 'scam', groupName: 'Flat' });
  expect(scanContent([], groups, expenses)).toEqual([]);
});

test('monthlyGrowth buckets by creation month (oldest first)', () => {
  const now = new Date(2026, 10, 15); // Nov 2026
  const out = monthlyGrowth({
    users: [{ createdAt: new Date(2026, 10, 1) }, { createdAt: new Date(2026, 9, 3) }, { createdAt: new Date(2025, 0, 1) }, {}],
    groups: [{ createdAt: { toDate: () => new Date(2026, 10, 2) } }],
    expenses: [{ createdAt: new Date(2026, 10, 2) }, { createdAt: new Date(2026, 10, 2), isSettlement: true }],
  }, 3, now);
  expect(out).toHaveLength(3);
  expect(out[2]).toMatchObject({ users: 1, groups: 1, expenses: 1 });
  expect(out[1].users).toBe(1);
  expect(out[0].users).toBe(0);
});

test('findExpiredInvitations returns only pending invitations past expiry', () => {
  const now = Date.now();
  const inv = [
    { id: 1, status: 'pending', expiresAt: { toDate: () => new Date(now - 1000) } },
    { id: 2, status: 'pending', expiresAt: new Date(now + 100000) },
    { id: 3, status: 'accepted', expiresAt: new Date(now - 1000) },
    { id: 4, status: 'pending' },
  ];
  expect(findExpiredInvitations(inv, now).map(i => i.id)).toEqual([1]);
});

test('countActiveUsers and sortByCreatedDesc', () => {
  const now = Date.now();
  const users = [
    { id: 'old', lastActive: new Date(now - 10 * 864e5), createdAt: new Date(2025, 0, 1) },
    { id: 'new', lastActive: { toDate: () => new Date(now - 864e5) }, createdAt: new Date(2026, 0, 1) },
    { id: 'none' },
  ];
  expect(countActiveUsers(users, 7, now)).toBe(1);
  expect(sortByCreatedDesc(users).map(u => u.id)).toEqual(['new', 'old', 'none']);
});
