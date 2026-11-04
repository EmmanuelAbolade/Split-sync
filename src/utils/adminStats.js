// src/utils/adminStats.js
// Pure calculations behind the Taskmaster admin panel (unit-tested).

import { calculateBalances } from './balanceCalculator';

const toDate = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null);

/**
 * Financial overview from raw groups and expenses.
 * - Removed (status 'deleted') expenses are excluded from all totals.
 * - Settlements are counted separately from spending.
 * - A group is "outstanding" when any member's balance is non-zero.
 */
export function computeFinancials(groups = [], expenses = []) {
  const live = expenses.filter(e => e.status !== 'deleted');
  const spending = live.filter(e => !e.isSettlement);
  const settlements = live.filter(e => e.isSettlement);

  const sumByCurrency = (list) => list.reduce((acc, e) => {
    const cur = e.currency || 'EUR';
    acc[cur] = (acc[cur] || 0) + (e.amount || 0);
    return acc;
  }, {});

  const byGroup = {};
  live.forEach(e => { (byGroup[e.groupId] = byGroup[e.groupId] || []).push(e); });

  let outstandingGroups = 0;
  let settledGroups = 0;
  const outstandingByCurrency = {};
  groups.forEach(g => {
    const list = byGroup[g.id] || [];
    if (list.length === 0) return;
    const balances = calculateBalances(list, g.members || []);
    const owed = Object.values(balances).filter(b => b > 0.01).reduce((s, b) => s + b, 0);
    if (owed > 0.01) {
      outstandingGroups++;
      const cur = g.currency || 'EUR';
      outstandingByCurrency[cur] = (outstandingByCurrency[cur] || 0) + owed;
    } else {
      settledGroups++;
    }
  });

  return {
    expenseCount:     spending.length,
    settlementCount:  settlements.length,
    removedCount:     expenses.length - live.length,
    spendingByCurrency:   sumByCurrency(spending),
    settlementsByCurrency: sumByCurrency(settlements),
    outstandingGroups,
    settledGroups,
    outstandingByCurrency,
  };
}

/** Per-group summary for the Group Management table. */
export function summariseGroups(groups = [], expenses = []) {
  const byGroup = {};
  expenses.filter(e => e.status !== 'deleted').forEach(e => {
    (byGroup[e.groupId] = byGroup[e.groupId] || []).push(e);
  });
  return groups.map(g => {
    const list = byGroup[g.id] || [];
    const balances = calculateBalances(list, g.members || []);
    const outstanding = Object.values(balances).some(b => Math.abs(b) > 0.01);
    const owner = (g.members || []).find(m => m.userId === g.createdBy);
    return {
      ...g,
      ownerName: owner?.name || owner?.email || '—',
      expenseCount: list.filter(e => !e.isSettlement).length,
      balanceStatus: list.length === 0 ? 'empty' : outstanding ? 'outstanding' : 'settled',
      typeLabel: g.type === 'personal' ? 'Personal' : 'Shared',
    };
  });
}

/**
 * Finds expenses (title/description) and group names containing any keyword.
 * Case-insensitive whole-substring match. Removed expenses are skipped.
 */
export function scanContent(keywords = [], groups = [], expenses = []) {
  const words = keywords.map(k => k.trim().toLowerCase()).filter(Boolean);
  if (words.length === 0) return [];
  const hit = (text) => {
    const t = (text || '').toLowerCase();
    return words.find(w => t.includes(w)) || null;
  };
  const groupName = Object.fromEntries(groups.map(g => [g.id, g.name]));
  const results = [];
  groups.forEach(g => {
    const w = hit(g.name);
    if (w) results.push({ kind: 'group', id: g.id, text: g.name, keyword: w, groupName: g.name });
  });
  expenses.filter(e => e.status !== 'deleted').forEach(e => {
    const w = hit(e.title) || hit(e.description);
    if (w) results.push({
      kind: 'expense', id: e.id, text: [e.title, e.description].filter(Boolean).join(' — '),
      keyword: w, groupName: groupName[e.groupId] || 'Unknown group',
    });
  });
  return results;
}

/** Counts of items created per month for the last `months` months (oldest first). */
export function monthlyGrowth({ users = [], groups = [], expenses = [] }, months = 6, now = new Date()) {
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-IE', { month: 'short', year: 'numeric' }), users: 0, groups: 0, expenses: 0 });
  }
  const index = Object.fromEntries(buckets.map((b, i) => [b.key, i]));
  const add = (list, field, dateField = 'createdAt') => list.forEach(item => {
    const d = toDate(item[dateField]);
    if (!d || isNaN(d)) return;
    const i = index[`${d.getFullYear()}-${d.getMonth()}`];
    if (i !== undefined) buckets[i][field]++;
  });
  add(users, 'users');
  add(groups, 'groups');
  add(expenses.filter(e => !e.isSettlement && e.status !== 'deleted'), 'expenses');
  return buckets;
}

/** Pending invitations whose expiresAt is in the past. */
export function findExpiredInvitations(invitations = [], now = Date.now()) {
  return invitations.filter(inv => {
    if (inv.status !== 'pending') return false;
    const exp = toDate(inv.expiresAt);
    return exp && exp.getTime() < now;
  });
}

/** Users active (lastActive) within the last `days` days. */
export function countActiveUsers(users = [], days = 7, now = Date.now()) {
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  return users.filter(u => {
    const d = toDate(u.lastActive);
    return d && d.getTime() > cutoff;
  }).length;
}

/** Newest first; users without createdAt go last instead of being dropped. */
export function sortByCreatedDesc(list = []) {
  return [...list].sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
}
