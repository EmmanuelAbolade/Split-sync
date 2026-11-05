// src/hooks/useFeatureFlags.js
// Live feature flags from config/features (read-only for clients).
// While loading, or if the read fails, every flag is OFF, so the app looks and
// behaves exactly as it does today.

import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuthStore } from '../stores/authStore';
import { isEnabledFor } from '../config/featureFlags';

export function useFeatureFlags() {
  const user = useAuthStore((s) => s.user);
  const uid = user ? user.uid : null;
  const [features, setFeatures] = useState(null);
  const [loading, setLoading] = useState(Boolean(uid));

  useEffect(() => {
    if (!uid) {
      setFeatures(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      doc(db, 'config', 'features'),
      (snap) => {
        setFeatures(snap.exists() ? snap.data() : {});
        setLoading(false);
      },
      () => {
        // Fail closed: no flags if the document cannot be read
        setFeatures({});
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [uid]);

  const isEnabled = useCallback((flagName) => isEnabledFor(features, flagName, uid), [features, uid]);

  return { loading, isEnabled };
}

export default useFeatureFlags;
