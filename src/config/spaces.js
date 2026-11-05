// src/config/spaces.js
// The space registry: one entry per kind of money in SplitSync. Each space
// keeps its money separate (balances are never added across spaces or
// currencies). Phase 2 builds the Hub and navigation from this list; Phase 1
// only defines it. Expenses is the existing app and is always on.
//
// `flag` names a feature flag (src/config/featureFlags.js); null means always on.
// `accent` is a Tailwind colour name used for the space's tile and header.

import { isEnabledFor } from './featureFlags';

export const SPACES = [
  { id: 'expenses', name: 'Expenses', icon: 'Receipt',   accent: 'indigo',  route: '/dashboard', flag: null,                  database: 'default' },
  { id: 'events',   name: 'Events',   icon: 'CalendarDays', accent: 'amber', route: '/events',   flag: 'eventsEnabled',       database: 'default' },
  { id: 'circles',  name: 'Circles',  icon: 'RefreshCcw', accent: 'emerald', route: '/circles',  flag: 'circlesSpaceEnabled', database: 'circles' },
  { id: 'loans',    name: 'Loans',    icon: 'HandCoins',  accent: 'sky',     route: '/loans',    flag: 'loansEnabled',        database: 'circles' },
  { id: 'aid',      name: 'Aid',      icon: 'HeartHandshake', accent: 'rose', route: '/aid',     flag: 'aidEnabled',          database: 'circles' },
];

export function getSpace(id) {
  return SPACES.find((s) => s.id === id) || null;
}

/**
 * Spaces this user can see. Every space except Expenses also needs the master
 * switch `circlesEnabled`.
 */
export function visibleSpaces(features, uid) {
  return SPACES.filter((s) => {
    if (!s.flag) return true;
    return isEnabledFor(features, 'circlesEnabled', uid) && isEnabledFor(features, s.flag, uid);
  });
}

/** Documents written before spaces existed belong to Expenses. */
export function spaceIdOf(record) {
  return (record && record.spaceId) || 'expenses';
}
