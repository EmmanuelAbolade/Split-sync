// src/utils/balanceCalculator.js

/**
 * Calculate balances for all members in a group
 * Returns object with net balances and settlement suggestions
 */
export function calculateBalances(expenses, members) {
  // Initialize balances (positive = owed money, negative = owes money)
  const balances = {};
  members.forEach(member => {
    balances[member.userId] = 0;
  });

  // Process each expense
  expenses.forEach(expense => {
    const { paidBy, splits, participants } = expense;

    // The payer gets credited the full amount
    balances[paidBy] = (balances[paidBy] || 0) + expense.amount;

    // Each participant's share is deducted
    participants?.forEach(userId => {
      const share = splits[userId] || 0;
      balances[userId] = (balances[userId] || 0) - share;
    });
  });

  return balances;
}

/**
 * Calculate simplified settlements (who should pay whom)
 * Uses greedy algorithm to minimize number of transactions
 */
export function calculateSettlements(balances) {
  // Separate creditors (owed money) and debtors (owe money)
  const creditors = [];
  const debtors = [];

  Object.entries(balances).forEach(([userId, balance]) => {
    if (balance > 0.01) {
      creditors.push({ userId, amount: balance });
    } else if (balance < -0.01) {
      debtors.push({ userId, amount: Math.abs(balance) });
    }
  });

  // Sort by amount (largest first)
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  // Calculate settlements
  const settlements = [];
  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];

    const amount = Math.min(creditor.amount, debtor.amount);

    settlements.push({
      from: debtor.userId,
      to: creditor.userId,
      amount: parseFloat(amount.toFixed(2)),
    });

    creditor.amount -= amount;
    debtor.amount -= amount;

    if (creditor.amount < 0.01) i++;
    if (debtor.amount < 0.01) j++;
  }

  return settlements;
}

/**
 * Get balance summary for a specific user
 */
export function getUserBalanceSummary(balances, userId, members) {
  const balance = balances[userId] || 0;
  
  if (Math.abs(balance) < 0.01) {
    return {
      status: 'settled',
      message: 'All settled up!',
      amount: 0,
    };
  }

  if (balance > 0) {
    return {
      status: 'owed',
      message: `You are owed`,
      amount: balance,
    };
  }

  return {
    status: 'owes',
    message: `You owe`,
    amount: Math.abs(balance),
  };
}