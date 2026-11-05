// functions/settlements/balances.js
// Server copy of src/utils/balanceCalculator.js calculateBalances, working in
// integer cents so comparisons are exact. Used to check that a payer never
// claims more than they owe. Keep the two in step.

function toMinor(x) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/**
 * Net balance per member in cents: positive = is owed, negative = owes.
 * Deleted expenses are ignored, exactly as on the client.
 */
function netBalancesMinor(expenses) {
  const bal = {};
  for (const e of expenses) {
    if (!e || e.status === 'deleted') continue;
    if (e.paidBy) bal[e.paidBy] = (bal[e.paidBy] || 0) + toMinor(e.amount);
    const splits = e.splits || {};
    for (const p of e.participants || []) {
      bal[p] = (bal[p] || 0) - toMinor(splits[p] || 0);
    }
  }
  return bal;
}

/** How much `uid` owes the group overall, in cents (0 when they owe nothing). */
function owedMinor(expenses, uid) {
  const b = netBalancesMinor(expenses)[uid] || 0;
  return b < 0 ? -b : 0;
}

module.exports = { toMinor, netBalancesMinor, owedMinor };
