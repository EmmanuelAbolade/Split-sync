// src/utils/spaceNav.js
// Where "back" goes from a screen inside the Expenses space. With the hub on,
// the Expenses space (/spaces/expenses) remembers itself here so a group page
// returns to it; otherwise back goes to /dashboard exactly as before.

const KEY = 'splitsync:expensesHome';

export function rememberExpensesHome(path) {
  try { sessionStorage.setItem(KEY, path); } catch { /* storage blocked */ }
}

export function forgetExpensesHome() {
  try { sessionStorage.removeItem(KEY); } catch { /* storage blocked */ }
}

export function expensesHome() {
  try { return sessionStorage.getItem(KEY) || '/dashboard'; } catch { return '/dashboard'; }
}
