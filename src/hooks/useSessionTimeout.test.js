// src/hooks/useSessionTimeout.test.js
// Test suite for useSessionTimeout hook
// Covers: initial state, timeout loading, updateTimeoutSetting, logoutNow, stayLoggedIn

import { renderHook, act } from '@testing-library/react';

// ─── Firebase Mocks ───────────────────────────────────────────────────────────

const mockGetDoc    = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDoc       = jest.fn(() => ({}));

jest.mock('firebase/firestore', () => ({
  doc:       (...a) => mockDoc(...a),
  getDoc:    (...a) => mockGetDoc(...a),
  updateDoc: (...a) => mockUpdateDoc(...a),
}));

jest.mock('../services/firebase', () => ({ db: {} }));

// ─── Auth Store Mock ──────────────────────────────────────────────────────────

const mockLogout = jest.fn();
const mockUser   = { uid: 'user-1' };

jest.mock('../stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

import { useAuthStore } from '../stores/authStore';

// ─── Timer setup ──────────────────────────────────────────────────────────────

beforeAll(() => jest.useFakeTimers());
afterAll(()  => jest.useRealTimers());

// ─── Import hook after mocks ──────────────────────────────────────────────────

import { useSessionTimeout } from './useSessionTimeout';

// ─────────────────────────────────────────────────────────────────────────────

describe('useSessionTimeout - Initial state', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.mockReturnValue({ user: mockUser, logout: mockLogout });
    mockGetDoc.mockResolvedValue({ exists: () => false });
  });

  test('Returns showWarning as false by default', async () => {
    const { result } = renderHook(() => useSessionTimeout());
    await act(async () => {});
    expect(result.current.showWarning).toBe(false);
  });

  test('Returns timeoutSetting as "never" by default when doc missing', async () => {
    const { result } = renderHook(() => useSessionTimeout());
    await act(async () => {});
    expect(result.current.timeoutSetting).toBe('never');
  });

  test('Returns countdown as 30 by default', async () => {
    const { result } = renderHook(() => useSessionTimeout());
    await act(async () => {});
    expect(result.current.countdown).toBe(30);
  });

  test('Exposes stayLoggedIn as a function', async () => {
    const { result } = renderHook(() => useSessionTimeout());
    await act(async () => {});
    expect(typeof result.current.stayLoggedIn).toBe('function');
  });

  test('Exposes logoutNow as a function', async () => {
    const { result } = renderHook(() => useSessionTimeout());
    await act(async () => {});
    expect(typeof result.current.logoutNow).toBe('function');
  });

  test('Exposes updateTimeoutSetting as a function', async () => {
    const { result } = renderHook(() => useSessionTimeout());
    await act(async () => {});
    expect(typeof result.current.updateTimeoutSetting).toBe('function');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('useSessionTimeout - Loading timeout setting from Firestore', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.mockReturnValue({ user: mockUser, logout: mockLogout });
  });

  test('Loads timeoutSetting from Firestore when user doc exists', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ sessionTimeout: '10min' }),
    });
    const { result } = renderHook(() => useSessionTimeout());
    await act(async () => {});
    expect(result.current.timeoutSetting).toBe('10min');
  });

  test('Defaults to "never" when doc has no sessionTimeout field', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({}) });
    const { result } = renderHook(() => useSessionTimeout());
    await act(async () => {});
    expect(result.current.timeoutSetting).toBe('never');
  });

  test('Defaults to "never" when user doc does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const { result } = renderHook(() => useSessionTimeout());
    await act(async () => {});
    expect(result.current.timeoutSetting).toBe('never');
  });

  test('Does not call getDoc when there is no logged-in user', async () => {
    useAuthStore.mockReturnValue({ user: null, logout: mockLogout });
    mockGetDoc.mockResolvedValue({ exists: () => false });
    renderHook(() => useSessionTimeout());
    await act(async () => {});
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  test('Handles Firestore error gracefully without crashing', async () => {
    mockGetDoc.mockRejectedValue(new Error('Firestore error'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useSessionTimeout());
    await act(async () => {});
    expect(result.current.timeoutSetting).toBe('never');
    console.error.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('useSessionTimeout - updateTimeoutSetting', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.mockReturnValue({ user: mockUser, logout: mockLogout });
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  test('Calls updateDoc with the new setting', async () => {
    const { result } = renderHook(() => useSessionTimeout());
    await act(async () => {});
    await act(async () => { await result.current.updateTimeoutSetting('10min'); });
    expect(mockUpdateDoc).toHaveBeenCalledWith(undefined, { sessionTimeout: '10min' });
  });

  test('Updates timeoutSetting state after successful Firestore update', async () => {
    const { result } = renderHook(() => useSessionTimeout());
    await act(async () => {});
    await act(async () => { await result.current.updateTimeoutSetting('30min'); });
    expect(result.current.timeoutSetting).toBe('30min');
  });

  test('Does not call updateDoc when no user is logged in', async () => {
    useAuthStore.mockReturnValue({ user: null, logout: mockLogout });
    const { result } = renderHook(() => useSessionTimeout());
    await act(async () => {});
    await act(async () => { await result.current.updateTimeoutSetting('10min'); });
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  test('Handles updateDoc error gracefully without crashing', async () => {
    mockUpdateDoc.mockRejectedValue(new Error('Update failed'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useSessionTimeout());
    await act(async () => {});
    await act(async () => { await result.current.updateTimeoutSetting('5min'); });
    expect(console.error).toHaveBeenCalled();
    console.error.mockRestore();
  });

  test('Can set to "never" to disable session timeout', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ sessionTimeout: '10min' }) });
    const { result } = renderHook(() => useSessionTimeout());
    await act(async () => {});
    await act(async () => { await result.current.updateTimeoutSetting('never'); });
    expect(result.current.timeoutSetting).toBe('never');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('useSessionTimeout - logoutNow', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.mockReturnValue({ user: mockUser, logout: mockLogout });
    mockGetDoc.mockResolvedValue({ exists: () => false });
  });

  test('Calls logout when logoutNow is invoked', async () => {
    const { result } = renderHook(() => useSessionTimeout());
    await act(async () => {});
    act(() => { result.current.logoutNow(); });
    expect(mockLogout).toHaveBeenCalled();
  });

  test('Sets showWarning to false when logoutNow is invoked', async () => {
    const { result } = renderHook(() => useSessionTimeout());
    await act(async () => {});
    act(() => { result.current.logoutNow(); });
    expect(result.current.showWarning).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('useSessionTimeout - stayLoggedIn', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.mockReturnValue({ user: mockUser, logout: mockLogout });
    mockGetDoc.mockResolvedValue({ exists: () => false });
  });

  test('Does not throw when stayLoggedIn is called', async () => {
    const { result } = renderHook(() => useSessionTimeout());
    await act(async () => {});
    expect(() => { act(() => { result.current.stayLoggedIn(); }); }).not.toThrow();
  });

  test('Sets showWarning to false when stayLoggedIn is called', async () => {
    const { result } = renderHook(() => useSessionTimeout());
    await act(async () => {});
    act(() => { result.current.stayLoggedIn(); });
    expect(result.current.showWarning).toBe(false);
  });

  test('Does not call logout when stayLoggedIn is called', async () => {
    const { result } = renderHook(() => useSessionTimeout());
    await act(async () => {});
    act(() => { result.current.stayLoggedIn(); });
    expect(mockLogout).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('useSessionTimeout - Timer behaviour', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.mockReturnValue({ user: mockUser, logout: mockLogout });
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ sessionTimeout: '5min' }) });
  });

  test('Does not show warning immediately after mount', async () => {
    const { result } = renderHook(() => useSessionTimeout());
    await act(async () => {});
    expect(result.current.showWarning).toBe(false);
  });

  test('Shows warning modal after 4.5 minutes (timeout - warning period)', async () => {
    const { result } = renderHook(() => useSessionTimeout());
    await act(async () => {});
    act(() => { jest.advanceTimersByTime(4.5 * 60 * 1000); });
    expect(result.current.showWarning).toBe(true);
  });

  test('Calls logout after full 5 minute timeout', async () => {
    renderHook(() => useSessionTimeout());
    await act(async () => {});
    act(() => { jest.advanceTimersByTime(5 * 60 * 1000 + 1000); });
    expect(mockLogout).toHaveBeenCalled();
  });

  test('Does not set timers when timeoutSetting is "never"', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const { result } = renderHook(() => useSessionTimeout());
    await act(async () => {});
    act(() => { jest.advanceTimersByTime(60 * 60 * 1000); });
    expect(result.current.showWarning).toBe(false);
    expect(mockLogout).not.toHaveBeenCalled();
  });
});
