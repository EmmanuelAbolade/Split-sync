// src/stores/authStore.test.js
// Test suite for authStore - authentication state management with Zustand

import { act } from '@testing-library/react';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock Firebase auth
const mockSignOut = jest.fn();
jest.mock('firebase/auth', () => ({
  signOut: (...args) => mockSignOut(...args),
}));

jest.mock('../services/firebase', () => ({ auth: {} }));

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem:    (key)        => store[key] ?? null,
    setItem:    (key, value) => { store[key] = String(value); },
    removeItem: (key)        => { delete store[key]; },
    clear:      ()           => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock sessionStorage
const sessionStorageMock = { clear: jest.fn() };
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

// Mock window.location
delete window.location;
window.location = { href: '' };

// Mock caches API
global.caches = {
  keys:   jest.fn().mockResolvedValue([]),
  delete: jest.fn().mockResolvedValue(true),
};

// ─────────────────────────────────────────────────────────────────────────────

// Import AFTER mocks are set up
const getStore = () => require('./authStore').useAuthStore;

describe('authStore - Initial state', () => {

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  test('Initial user is null', () => {
    const useAuthStore = getStore();
    expect(useAuthStore.getState().user).toBeNull();
  });

  test('Initial isAuthenticated is false', () => {
    const useAuthStore = getStore();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  test('Initial loading is true', () => {
    const useAuthStore = getStore();
    expect(useAuthStore.getState().loading).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('authStore - setUser action', () => {

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  test('Sets user correctly', () => {
    const useAuthStore = getStore();
    const mockUser = { uid: 'user-123', email: 'test@example.com' };
    act(() => useAuthStore.getState().setUser(mockUser));
    expect(useAuthStore.getState().user).toEqual(mockUser);
  });

  test('Sets isAuthenticated to true when user is provided', () => {
    const useAuthStore = getStore();
    act(() => useAuthStore.getState().setUser({ uid: 'user-123' }));
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  test('Sets isAuthenticated to false when user is null', () => {
    const useAuthStore = getStore();
    act(() => useAuthStore.getState().setUser(null));
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  test('Sets loading to false after setUser', () => {
    const useAuthStore = getStore();
    act(() => useAuthStore.getState().setUser({ uid: 'user-123' }));
    expect(useAuthStore.getState().loading).toBe(false);
  });

  test('Clears user when called with null', () => {
    const useAuthStore = getStore();
    act(() => useAuthStore.getState().setUser({ uid: 'user-123' }));
    act(() => useAuthStore.getState().setUser(null));
    expect(useAuthStore.getState().user).toBeNull();
  });

  test('Updates user when called again with new user', () => {
    const useAuthStore = getStore();
    act(() => useAuthStore.getState().setUser({ uid: 'user-1' }));
    act(() => useAuthStore.getState().setUser({ uid: 'user-2' }));
    expect(useAuthStore.getState().user.uid).toBe('user-2');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('authStore - setLoading action', () => {

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  test('Sets loading to false', () => {
    const useAuthStore = getStore();
    act(() => useAuthStore.getState().setLoading(false));
    expect(useAuthStore.getState().loading).toBe(false);
  });

  test('Sets loading to true', () => {
    const useAuthStore = getStore();
    act(() => useAuthStore.getState().setLoading(false));
    act(() => useAuthStore.getState().setLoading(true));
    expect(useAuthStore.getState().loading).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('authStore - updateUserPhoto action', () => {

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  test('Updates photoURL on current user', () => {
    const useAuthStore = getStore();
    act(() => useAuthStore.getState().setUser({ uid: 'user-123', displayName: 'Alice' }));
    act(() => useAuthStore.getState().updateUserPhoto('https://example.com/photo.jpg'));
    expect(useAuthStore.getState().user.photoURL).toBe('https://example.com/photo.jpg');
  });

  test('Preserves other user fields when updating photo', () => {
    const useAuthStore = getStore();
    act(() => useAuthStore.getState().setUser({ uid: 'user-123', email: 'alice@example.com' }));
    act(() => useAuthStore.getState().updateUserPhoto('https://example.com/photo.jpg'));
    expect(useAuthStore.getState().user.uid).toBe('user-123');
    expect(useAuthStore.getState().user.email).toBe('alice@example.com');
  });

  test('Does nothing when user is null', () => {
    const useAuthStore = getStore();
    // user is null by default
    expect(() => {
      act(() => useAuthStore.getState().updateUserPhoto('https://example.com/photo.jpg'));
    }).not.toThrow();
    expect(useAuthStore.getState().user).toBeNull();
  });

  test('Updates photoURL to null', () => {
    const useAuthStore = getStore();
    act(() => useAuthStore.getState().setUser({ uid: 'user-123', photoURL: 'old.jpg' }));
    act(() => useAuthStore.getState().updateUserPhoto(null));
    expect(useAuthStore.getState().user.photoURL).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('authStore - logout action', () => {

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    localStorageMock.clear();
    window.location.href = '';
    global.caches.keys.mockResolvedValue([]);
  });

  test('Clears user state on logout', async () => {
    const useAuthStore = getStore();
    mockSignOut.mockResolvedValue();
    act(() => useAuthStore.getState().setUser({ uid: 'user-123' }));
    await act(async () => useAuthStore.getState().logout());
    expect(useAuthStore.getState().user).toBeNull();
  });

  test('Sets isAuthenticated to false on logout', async () => {
    const useAuthStore = getStore();
    mockSignOut.mockResolvedValue();
    act(() => useAuthStore.getState().setUser({ uid: 'user-123' }));
    await act(async () => useAuthStore.getState().logout());
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  test('Sets loading to false on logout', async () => {
    const useAuthStore = getStore();
    mockSignOut.mockResolvedValue();
    await act(async () => useAuthStore.getState().logout());
    expect(useAuthStore.getState().loading).toBe(false);
  });

  test('Calls Firebase signOut on logout', async () => {
    const useAuthStore = getStore();
    mockSignOut.mockResolvedValue();
    await act(async () => useAuthStore.getState().logout());
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  test('Removes auth-storage from localStorage on logout', async () => {
    const useAuthStore = getStore();
    mockSignOut.mockResolvedValue();
    localStorageMock.setItem('auth-storage', '{"user":{"uid":"123"}}');
    await act(async () => useAuthStore.getState().logout());
    expect(localStorageMock.getItem('auth-storage')).toBeNull();
  });

  test('Clears sessionStorage on logout', async () => {
    const useAuthStore = getStore();
    mockSignOut.mockResolvedValue();
    await act(async () => useAuthStore.getState().logout());
    expect(sessionStorageMock.clear).toHaveBeenCalled();
  });

  test('Redirects to /login on successful logout', async () => {
    const useAuthStore = getStore();
    mockSignOut.mockResolvedValue();
    await act(async () => useAuthStore.getState().logout());
    expect(window.location.href).toBe('/login');
  });

  test('Still redirects to /login even when signOut throws', async () => {
    const useAuthStore = getStore();
    mockSignOut.mockRejectedValue(new Error('Firebase error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => useAuthStore.getState().logout());
    expect(window.location.href).toBe('/login');
    consoleSpy.mockRestore();
  });

  test('Logs error when logout fails', async () => {
    const useAuthStore = getStore();
    mockSignOut.mockRejectedValue(new Error('Firebase error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => useAuthStore.getState().logout());
    expect(consoleSpy).toHaveBeenCalledWith('Logout error:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  test('Clears caches on logout when caches API is available', async () => {
    const useAuthStore = getStore();
    mockSignOut.mockResolvedValue();
    global.caches.keys.mockResolvedValue(['cache-1', 'cache-2']);
    global.caches.delete.mockResolvedValue(true);
    await act(async () => useAuthStore.getState().logout());
    expect(global.caches.delete).toHaveBeenCalledWith('cache-1');
    expect(global.caches.delete).toHaveBeenCalledWith('cache-2');
  });
});