// src/utils/memberDirectory.js
// Resolves member names for a group, including people who have since left.
//
// Groups keep two lists:
//   members        — current members (drives permissions, splits, invites)
//   formerMembers  — snapshot { userId, name, email, leftAt } written when a
//                    member leaves or deletes their account, so historical
//                    expenses and settlements keep showing a real name.

/** True when userId is a current member of the group. */
export function isActiveMember(group, userId) {
  return !!group?.members?.some(m => m.userId === userId);
}

/** True for personal (self-tracking) groups that never need other members. */
export function isPersonalGroup(group) {
  return group?.type === 'personal';
}

/**
 * Finds a member record (current first, then former) for a userId.
 * Returns { userId, name, email, former: boolean } or null.
 */
export function findMember(group, userId) {
  if (!group || !userId) return null;
  const current = group.members?.find(m => m.userId === userId);
  if (current) return { ...current, former: false };
  const former = group.formerMembers?.find(m => m.userId === userId);
  if (former) return { ...former, former: true };
  return null;
}

/**
 * Display name for a userId in a group.
 * @param {object} group
 * @param {string} userId
 * @param {object} [extraNames] optional { [userId]: name } map (e.g. looked up from users docs)
 * @param {object} [opts] { markFormer: boolean } — append " (left)" for former members
 */
export function getMemberName(group, userId, extraNames = {}, opts = {}) {
  const m = findMember(group, userId);
  const name = m?.name || m?.email || extraNames[userId];
  if (!name) return 'Former member';
  const isFormer = m ? m.former : !!extraNames[userId];
  return opts.markFormer && isFormer ? `${name} (left)` : name;
}

/** All userIds referenced by expenses that are not in members or formerMembers. */
export function unresolvedUserIds(group, expenses = []) {
  const ids = new Set();
  expenses.forEach(e => {
    if (e.paidBy) ids.add(e.paidBy);
    (e.participants || []).forEach(id => ids.add(id));
  });
  return [...ids].filter(id => !findMember(group, id));
}
