// src/hooks/useFeatureFlags.test.js
import { renderHook, act } from '@testing-library/react';
import { isEnabledFor, FLAG_NAMES } from '../config/featureFlags';
import { visibleSpaces, spaceIdOf, getSpace, SPACES } from '../config/spaces';

let mockSnapshotHandlers = null;
const mockUnsubscribe = jest.fn();
jest.mock('firebase/firestore', () => ({
  doc: (...a) => a.slice(1).join('/'),
  onSnapshot: (_ref, onNext, onError) => { mockSnapshotHandlers = { onNext, onError }; return mockUnsubscribe; },
}));
jest.mock('../services/firebase', () => ({ db: {} }));
let mockUser = null;
jest.mock('../stores/authStore', () => ({
  useAuthStore: (selector) => selector({ user: mockUser }),
}));

// eslint-disable-next-line import/first
import { useFeatureFlags } from './useFeatureFlags';

beforeEach(() => {
  mockSnapshotHandlers = null;
  mockUnsubscribe.mockClear();
  mockUser = null;
});

describe('isEnabledFor (client copy of the server rule)', () => {
  test('fails closed and honours allow-lists', () => {
    const f = { aidEnabled: { enabled: false, allowUids: ['t'] }, loansEnabled: { enabled: true } };
    expect(isEnabledFor(f, 'aidEnabled', 't')).toBe(true);
    expect(isEnabledFor(f, 'aidEnabled', 'x')).toBe(false);
    expect(isEnabledFor(f, 'loansEnabled', null)).toBe(true);
    expect(isEnabledFor(f, 'trustEnabled', 't')).toBe(false);
    expect(isEnabledFor(f, 'unknown', 't')).toBe(false);
    expect(isEnabledFor(null, 'aidEnabled', 't')).toBe(false);
    expect(isEnabledFor({ aidEnabled: { enabled: 1 } }, 'aidEnabled', 't')).toBe(false);
  });

  test('client and server know the same flags', () => {
    // Read the server list from source (the server module needs Cloud Functions packages)
    // eslint-disable-next-line global-require
    const src = require('fs').readFileSync(require('path').join(__dirname, '../../functions/core/flags.js'), 'utf8');
    const block = src.match(/const FLAG_NAMES = \[([\s\S]*?)\];/)[1];
    const server = [...block.matchAll(/^\s*'([A-Za-z]+)'/gm)].map((m) => m[1]);
    expect(FLAG_NAMES).toEqual(server);
  });
});

describe('space registry', () => {
  test('only Expenses is visible with flags off', () => {
    expect(visibleSpaces({}, 'u').map((s) => s.id)).toEqual(['expenses']);
  });

  test('a space needs both the master switch and its own flag', () => {
    const on = { enabled: true };
    expect(visibleSpaces({ loansEnabled: on }, 'u').map((s) => s.id)).toEqual(['expenses']);
    expect(visibleSpaces({ circlesEnabled: on, loansEnabled: on }, 'u').map((s) => s.id)).toEqual(['expenses', 'loans']);
  });

  test('old records without spaceId belong to Expenses', () => {
    expect(spaceIdOf({})).toBe('expenses');
    expect(spaceIdOf(null)).toBe('expenses');
    expect(spaceIdOf({ spaceId: 'events' })).toBe('events');
    expect(getSpace('aid').database).toBe('circles');
    expect(getSpace('nope')).toBeNull();
    expect(new Set(SPACES.map((s) => s.id)).size).toBe(SPACES.length);
  });
});

describe('useFeatureFlags', () => {
  test('signed out: everything off, no subscription', () => {
    const { result } = renderHook(() => useFeatureFlags());
    expect(result.current.loading).toBe(false);
    expect(result.current.isEnabled('circlesEnabled')).toBe(false);
    expect(mockSnapshotHandlers).toBeNull();
  });

  test('signed in: off while loading, then follows the live document', () => {
    mockUser = { uid: 'tester' };
    const { result, unmount } = renderHook(() => useFeatureFlags());
    expect(result.current.loading).toBe(true);
    expect(result.current.isEnabled('circlesEnabled')).toBe(false);

    act(() => mockSnapshotHandlers.onNext({ exists: () => true, data: () => ({ circlesEnabled: { enabled: false, allowUids: ['tester'] } }) }));
    expect(result.current.loading).toBe(false);
    expect(result.current.isEnabled('circlesEnabled')).toBe(true);
    expect(result.current.isEnabled('aidEnabled')).toBe(false);

    act(() => mockSnapshotHandlers.onNext({ exists: () => false, data: () => ({}) }));
    expect(result.current.isEnabled('circlesEnabled')).toBe(false);

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  test('a read error leaves every flag off', () => {
    mockUser = { uid: 'tester' };
    const { result } = renderHook(() => useFeatureFlags());
    act(() => mockSnapshotHandlers.onError(new Error('denied')));
    expect(result.current.loading).toBe(false);
    expect(result.current.isEnabled('circlesEnabled')).toBe(false);
  });
});
