// src/utils/balanceCalculator.js

/**
 * Calculate balances for all members in a group.
 * Expenses with status === 'deleted' are excluded from calculations.
 * Expenses with status === 'archived' are still counted — archiving is for
 * list management only and does not affect financial history.
 */
export function calculateBalances(expenses, members) {
  const balances = {};
  members.forEach(member => {
    balances[member.userId] = 0;
  });

  expenses
    .filter(expense => expense.status !== 'deleted')
    .forEach(expense => {
      const { paidBy, splits, participants } = expense;
      balances[paidBy] = (balances[paidBy] || 0) + expense.amount;
      participants?.forEach(userId => {
        const share = splits[userId] || 0;
        balances[userId] = (balances[userId] || 0) - share;
      });
    });

  return balances;
}

/**
 * Calculate simplified settlements using a greedy two-pointer algorithm.
 * Minimises the total number of transactions required to settle the group.
 */
export function calculateSettlements(balances) {
  const creditors = [];
  const debtors = [];

  Object.entries(balances).forEach(([userId, balance]) => {
    if (balance > 0.01) creditors.push({ userId, amount: balance });
    else if (balance < -0.01) debtors.push({ userId, amount: Math.abs(balance) });
  });

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const settlements = [];
  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor   = debtors[j];
    const amount   = Math.min(creditor.amount, debtor.amount);

    settlements.push({
      from:   debtor.userId,
      to:     creditor.userId,
      amount: parseFloat(amount.toFixed(2)),
    });

    creditor.amount -= amount;
    debtor.amount   -= amount;

    if (creditor.amount < 0.01) i++;
    if (debtor.amount  < 0.01) j++;
  }

  return settlements;
}

/**
 * Get balance summary for a specific user.
 */
export function getUserBalanceSummary(balances, userId) {
  const balance = balances[userId] || 0;

  if (Math.abs(balance) < 0.01) {
    return { status: 'settled', message: 'All settled up!', amount: 0 };
  }
  if (balance > 0) {
    return { status: 'owed', message: 'You are owed', amount: balance };
  }
  return { status: 'owes', message: 'You owe', amount: Math.abs(balance) };
}

/**
 * Groups an array of { amount, currency } items by currency code.
 * Returns an object like { EUR: 258.33, GBP: 18.33 }.
 * Never sums amounts across different currencies.
 */
export function groupByCurrency(items) {
  return items.reduce((acc, { amount, currency }) => {
    if (!currency || !amount) return acc;
    acc[currency] = (acc[currency] || 0) + amount;
    return acc;
  }, {});
}
