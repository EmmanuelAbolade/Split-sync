// src/hooks/useSpaces.js
// The spaces this user can see right now, from the live feature flags.
// With circlesEnabled off (the production default) only Expenses is visible
// and circlesOn is false, so every caller keeps today's behaviour.

import { useMemo } from 'react';
import useFeatureFlags from './useFeatureFlags';
import { SPACES } from '../config/spaces';

export default function useSpaces() {
  const { loading, isEnabled } = useFeatureFlags();
  const circlesOn = isEnabled('circlesEnabled');
  const spaces = useMemo(
    () => SPACES.filter((s) => !s.flag || (circlesOn && isEnabled(s.flag))),
    [circlesOn, isEnabled]
  );
  const isSpaceOn = (id) => spaces.some((s) => s.id === id);
  return { loading, circlesOn, spaces, isSpaceOn };
}
