// src/hooks/useFormerMemberNames.js
// Looks up display names for users referenced by a group's expenses who are no
// longer in group.members and have no formerMembers snapshot (people who left
// before formerMembers existed). Returns { [userId]: name }.

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { unresolvedUserIds } from '../utils/memberDirectory';

const cache = {}; // userId -> name, shared across components for the session

export default function useFormerMemberNames(group, expenses) {
  const [names, setNames] = useState({});
  // Wait for the group: without it every id would look unresolved.
  const missing = group ? unresolvedUserIds(group, expenses || []) : [];
  const key = missing.sort().join(',');

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const ids = key.split(',');

    (async () => {
      const result = {};
      await Promise.all(ids.map(async (uid) => {
        if (cache[uid] !== undefined) { result[uid] = cache[uid]; return; }
        try {
          const snap = await getDoc(doc(db, 'users', uid));
          const d = snap.exists() ? snap.data() : null;
          cache[uid] = d?.displayName || d?.fullName || d?.email || null;
        } catch {
          cache[uid] = null;
        }
        result[uid] = cache[uid];
      }));
      if (!cancelled) {
        const clean = Object.fromEntries(Object.entries(result).filter(([, v]) => v));
        setNames(clean);
      }
    })();

    return () => { cancelled = true; };
  }, [key]);

  return names;
}
