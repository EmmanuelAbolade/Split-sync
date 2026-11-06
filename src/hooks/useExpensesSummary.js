// src/hooks/useExpensesSummary.js
// Read-only summary of the Expenses space for the Hub tile and Needs attention:
// how many groups, what the user owes and is owed per currency (never added
// across currencies), and their largest single debt. Uses the same balance
// calculator as the Dashboard. Does nothing unless `enabled`.

import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { calculateBalances, getUserBalanceSummary } from '../utils/balanceCalculator';
import { isActiveMember } from '../utils/memberDirectory';

const EMPTY = { loading: false, groupCount: 0, owe: {}, owed: {}, highestDebt: null };

export function summarise(groups, balanceByGroup) {
  const owe = {};
  const owed = {};
  let highestDebt = null;
  groups.forEach((g) => {
    const b = balanceByGroup[g.id];
    if (!b || !b.amount) return;
    const cur = g.currency || 'EUR';
    if (b.status === 'owes') {
      owe[cur] = (owe[cur] || 0) + b.amount;
      if (!highestDebt || b.amount > highestDebt.amount) {
        highestDebt = { amount: b.amount, currency: cur, groupId: g.id, groupName: g.name || '' };
      }
    } else if (b.status === 'owed') {
      owed[cur] = (owed[cur] || 0) + b.amount;
    }
  });
  return { groupCount: groups.length, owe, owed, highestDebt };
}

export default function useExpensesSummary(uid, enabled = true) {
  const [state, setState] = useState(() => ({ ...EMPTY, loading: Boolean(uid && enabled) }));

  useEffect(() => {
    if (!uid || !enabled) {
      setState(EMPTY);
      return undefined;
    }
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    const unsubscribe = onSnapshot(
      query(collection(db, 'groups'), where('memberIds', 'array-contains', uid)),
      async (snapshot) => {
        const groups = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((g) => isActiveMember(g, uid));
        const balanceByGroup = {};
        await Promise.all(groups.map(async (g) => {
          try {
            const snap = await getDocs(query(collection(db, 'expenses'), where('groupId', '==', g.id)));
            const expenses = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            const balances = calculateBalances(expenses, g.members || []);
            balanceByGroup[g.id] = getUserBalanceSummary(balances, uid, g.members || []);
          } catch (err) {
            console.error('[Hub] balance read failed', err?.code);
          }
        }));
        if (live) setState({ loading: false, ...summarise(groups, balanceByGroup) });
      },
      (err) => {
        console.error('[Hub] groups read failed', err?.code);
        if (live) setState(EMPTY);
      }
    );
    return () => { live = false; unsubscribe(); };
  }, [uid, enabled]);

  return state;
}
