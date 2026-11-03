import {
  isActiveMember, isPersonalGroup, findMember, getMemberName, unresolvedUserIds,
} from './memberDirectory';

const group = {
  members: [
    { userId: 'u1', name: 'Alice', email: 'alice@x.com' },
    { userId: 'u2', name: 'Bob',   email: 'bob@x.com' },
  ],
  formerMembers: [
    { userId: 'u3', name: 'Carol', email: 'carol@x.com', reason: 'left' },
  ],
  // u4 is a legacy leaver: still in memberIds but not in members
  memberIds: ['u1', 'u2', 'u4'],
};

describe('memberDirectory', () => {
  test('isActiveMember uses members, not memberIds', () => {
    expect(isActiveMember(group, 'u1')).toBe(true);
    expect(isActiveMember(group, 'u3')).toBe(false);
    expect(isActiveMember(group, 'u4')).toBe(false); // legacy leaver
    expect(isActiveMember(null, 'u1')).toBe(false);
  });

  test('isPersonalGroup', () => {
    expect(isPersonalGroup({ type: 'personal' })).toBe(true);
    expect(isPersonalGroup({ type: 'shared' })).toBe(false);
    expect(isPersonalGroup({})).toBe(false);
  });

  test('findMember prefers current members and flags former ones', () => {
    expect(findMember(group, 'u1')).toMatchObject({ name: 'Alice', former: false });
    expect(findMember(group, 'u3')).toMatchObject({ name: 'Carol', former: true });
    expect(findMember(group, 'nope')).toBeNull();
  });

  test('getMemberName resolves former members instead of "Unknown"', () => {
    expect(getMemberName(group, 'u1')).toBe('Alice');
    expect(getMemberName(group, 'u3')).toBe('Carol');
    expect(getMemberName(group, 'u3', {}, { markFormer: true })).toBe('Carol (left)');
    expect(getMemberName(group, 'u1', {}, { markFormer: true })).toBe('Alice');
  });

  test('getMemberName falls back to looked-up names, then "Former member"', () => {
    expect(getMemberName(group, 'u4', { u4: 'Dave' })).toBe('Dave');
    expect(getMemberName(group, 'u4', { u4: 'Dave' }, { markFormer: true })).toBe('Dave (left)');
    expect(getMemberName(group, 'u4')).toBe('Former member');
  });

  test('unresolvedUserIds lists ids referenced by expenses but unknown to the group', () => {
    const expenses = [
      { paidBy: 'u1', participants: ['u1', 'u3', 'u4'] },
      { paidBy: 'u5', participants: ['u5', 'u2'] },
    ];
    expect(unresolvedUserIds(group, expenses).sort()).toEqual(['u4', 'u5']);
  });
});
