/**
 * @file balanceCalculator.js
 * @brief Utility functions for calculating group expense balances and settlement suggestions.
 *
 * @details This module is the financial core of Split-Sync. It implements a greedy
 * two-pointer algorithm to minimise the number of transactions required to settle
 * all debts within a group. It also provides helpers for per-user balance summaries
 * and multi-currency grouping.
 *
 * Spaces (Circles extension): everything here belongs to the Expenses space.
 * Expense documents written before spaces existed have no `spaceId`; a
 * missing `spaceId` means 'expenses' (see spaceIdOf in src/config/spaces.js).
 * These functions are only ever given one group's expenses, so they never mix
 * spaces; their behaviour is unchanged.
 *
 * @author Emmanuel Abolade (C00288657)
 * @date 2025-2026
 * @version 1.0.0
 * @copyright SETU Carlow — Final Year Project 2025/2026
 */

// src/utils/balanceCalculator.js

/**
 * @brief Calculates the net balance for every member of a group.
 *
 * @details Iterates over all non-deleted expenses. For each expense the payer is
 * credited the full amount and each participant is debited their individual split
 * share. A positive balance means the member is owed money; a negative balance
 * means the member owes money.
 *
 * @param {Array<Object>} expenses - Array of expense documents from Firestore.
 *   Each expense must contain:
 *   - {string}   paidBy       - UID of the member who paid.
 *   - {number}   amount       - Total expense amount.
 *   - {Object}   splits       - Map of { [userId]: shareAmount }.
 *   - {Array}    participants - Array of participant UIDs.
 *   - {string}   [status]     - Expenses with status 'deleted' are excluded.
 * @param {Array<Object>} members - Array of group member objects, each with a `userId` field.
 *
 * @returns {Object} A map of { [userId]: netBalance } where positive = owed, negative = owes.
 *
 * @example
 * const balances = calculateBalances(expenses, group.members);
 * // { 'uid-alice': 30.00, 'uid-bob': -30.00 }
 */
export function calculateBalances(expenses, members) {
  const balances = {};
  members.forEach(member => {
    balances[member.userId] = 0;
  });

  const activeExpenses = expenses.filter(e => !e.status || e.status !== 'deleted');

  activeExpenses.forEach(expense => {
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
 * @brief Computes the minimum set of transactions to settle all debts in a group.
 *
 * @details Implements a greedy two-pointer algorithm:
 * 1. Separate members into creditors (positive balance) and debtors (negative balance).
 * 2. Sort both lists in descending order of amount.
 * 3. At each step, match the largest creditor with the largest debtor.
 * 4. Create a settlement for min(creditor.amount, debtor.amount).
 * 5. Advance the pointer whose balance reaches zero.
 *
 * This minimises the total number of transactions to at most n-1,
 * where n is the number of members with non-zero balances.
 *
 * @param {Object} balances - Output of calculateBalances(). Map of { [userId]: netBalance }.
 *
 * @returns {Array<Object>} Array of settlement objects, each containing:
 *   - {string} from   - UID of the member who must pay.
 *   - {string} to     - UID of the member who must receive.
 *   - {number} amount - Amount to transfer, rounded to 2 decimal places.
 *
 * @example
 * const settlements = calculateSettlements(balances);
 * // [{ from: 'uid-bob', to: 'uid-alice', amount: 30.00 }]
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
 * @brief Returns a human-readable balance summary for a specific user.
 *
 * @details Classifies the user's net balance into one of three states:
 * - settled: balance is within +/-0.01 (floating-point safe zero).
 * - owed:    balance is positive; the user is owed money.
 * - owes:    balance is negative; the user owes money.
 *
 * @param {Object} balances - Map of { [userId]: netBalance } from calculateBalances().
 * @param {string} userId   - UID of the user whose summary is required.
 * @param {Array}  members  - Array of group member objects (reserved for future use).
 *
 * @returns {Object} Summary object:
 *   - {string} status  - One of 'settled' | 'owed' | 'owes'.
 *   - {string} message - Display string for the UI.
 *   - {number} amount  - Absolute balance amount (always non-negative).
 */
export function getUserBalanceSummary(balances, userId, members) {
  const balance = balances[userId] || 0;
  if (Math.abs(balance) < 0.01) return { status: 'settled', message: 'All settled up!', amount: 0 };
  if (balance > 0) return { status: 'owed', message: 'You are owed', amount: balance };
  return { status: 'owes', message: 'You owe', amount: Math.abs(balance) };
}

/**
 * @brief Groups an array of amount/currency pairs by currency code.
 *
 * @details Prevents cross-currency summation. EUR and GBP amounts are kept
 * as separate entries rather than being combined into a single total.
 * Used across Profile, Activity, and Analytics pages.
 *
 * @param {Array<Object>} items - Array of objects each with:
 *   - {number} amount   - Monetary value.
 *   - {string} currency - ISO 4217 currency code (e.g. 'EUR', 'GBP', 'USD').
 *
 * @returns {Object} Map of { [currencyCode]: totalAmount }.
 *
 * @example
 * groupByCurrency([{ amount: 18.33, currency: 'EUR' }, { amount: 258.33, currency: 'GBP' }]);
 * // { EUR: 18.33, GBP: 258.33 }
 */
export function groupByCurrency(items) {
  return items.reduce((acc, { amount, currency }) => {
    if (!currency || !amount) return acc;
    acc[currency] = (acc[currency] || 0) + amount;
    return acc;
  }, {});
}
