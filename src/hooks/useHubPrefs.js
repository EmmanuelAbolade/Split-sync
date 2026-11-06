// src/hooks/useHubPrefs.js
// Which spaces the user hid from Home ("Customise Home"). Stored in the
// owner-only private profile area (users/{uid}/private/hubPrefs), so it
// follows the user across devices and nobody else can read it. Hiding a space
// never touches its data. Expenses can never be hidden.

import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

export function cleanHidden(list) {
  return [...new Set((Array.isArray(list) ? list : []).filter((id) => typeof id === 'string' && id !== 'expenses'))];
}

export default function useHubPrefs(uid) {
  const [hidden, setHidden] = useState([]);

  useEffect(() => {
    if (!uid) { setHidden([]); return undefined; }
    const unsubscribe = onSnapshot(
      doc(db, 'users', uid, 'private', 'hubPrefs'),
      (snap) => setHidden(cleanHidden(snap.exists() ? snap.data().hiddenSpaces : [])),
      () => setHidden([])
    );
    return unsubscribe;
  }, [uid]);

  const saveHidden = useCallback(async (list) => {
    const next = cleanHidden(list);
    await setDoc(doc(db, 'users', uid, 'private', 'hubPrefs'), { hiddenSpaces: next, updatedAt: serverTimestamp() }, { merge: true });
    setHidden(next);
  }, [uid]);

  return { hidden, saveHidden };
}
