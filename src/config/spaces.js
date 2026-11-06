// src/config/spaces.js
// The space registry: one entry per kind of money in SplitSync. Each space
// keeps its money separate (balances are never added across spaces or
// currencies). The Hub, the + action sheet, Activity chips and Stats tabs are
// all built from this list. Expenses is the existing app and is always on.
//
// `flag` names a feature flag (src/config/featureFlags.js); null means always on.
// `accent` picks the space's colours (src/components/hub/spaceStyle.js),
// matching the approved hub mockup.

import { isEnabledFor } from './featureFlags';

export const SPACES = [
  { id: 'expenses', name: 'Expenses', icon: 'Receipt',        accent: 'blue',   route: '/spaces/expenses', flag: null,                  database: 'default', blurb: 'Split bills with your groups' },
  { id: 'events',   name: 'Events',   icon: 'PartyPopper',    accent: 'pink',   route: '/spaces/events',   flag: 'eventsEnabled',       database: 'default', blurb: 'Budgets and pledges for occasions' },
  { id: 'circles',  name: 'Circles',  icon: 'RefreshCcw',     accent: 'violet', route: '/spaces/circles',  flag: 'circlesSpaceEnabled', database: 'circles', blurb: 'Rotating savings (ajo / susu)' },
  { id: 'loans',    name: 'Loans',    icon: 'HandCoins',      accent: 'amber',  route: '/spaces/loans',    flag: 'loansEnabled',        database: 'circles', blurb: 'Interest-free loans between people' },
  { id: 'aid',      name: 'Aid',      icon: 'HeartHandshake', accent: 'teal',   route: '/spaces/aid',      flag: 'aidEnabled',          database: 'circles', blurb: 'Help someone in your community' },
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

/**
 * The space a path belongs to, for the + sheet's ordering. Group pages, the
 * Quick Add page and invites are inside Expenses. Elsewhere: null (no space).
 */
export function spaceOfPath(pathname = '') {
  const m = pathname.match(/^\/spaces\/([^/]+)/);
  if (m) return getSpace(m[1]) ? m[1] : null;
  if (pathname.startsWith('/group/') || pathname.startsWith('/invite/') || pathname === '/add') return 'expenses';
  return null;
}
