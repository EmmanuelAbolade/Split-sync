// src/pages/spaces/ExpensesSpace.jsx
// The Expenses space: today's Home (Dashboard), unchanged. The shared top bar
// shows "Expenses" in its Spaces menu. Group pages opened from here come back
// here (see utils/spaceNav.js).

import { useEffect } from 'react';
import Dashboard from '../Dashboard';
import { rememberExpensesHome } from '../../utils/spaceNav';

export default function ExpensesSpace() {
  useEffect(() => { rememberExpensesHome('/spaces/expenses'); }, []);
  return <Dashboard />;
}
