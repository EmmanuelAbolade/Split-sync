// src/App.test.js
// Routing and app-shell tests for src/App.js (previously 0 % covered).
// Uses the REAL react-router-dom (the repo-wide manual mock in
// src/__mocks__/react-router-dom.js is bypassed here) so route guards,
// redirects and the post-sign-in return-to-invite behaviour are exercised
// end to end. Pages and heavy components are stubbed.

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('react-router-dom', () => jest.requireActual('react-router-dom'));

// ---- Firebase -----------------------------------------------------------------
let mockAuthUser = null; // what onAuthStateChanged reports
const mockSignOut = jest.fn(() => Promise.resolve());
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => { cb(mockAuthUser); return () => {}; },
  signOut: (...a) => mockSignOut(...a),
}));

let mockUserDoc = { exists: () => true, data: () => ({ isActive: true }) };
const mockUpdateDoc = jest.fn(() => Promise.resolve());
jest.mock('firebase/firestore', () => ({
  doc: (...a) => ({ path: a.slice(1).join('/') }),
  getDoc: () => Promise.resolve(mockUserDoc),
  updateDoc: (...a) => mockUpdateDoc(...a),
  serverTimestamp: () => 'SERVER_TS',
}));
jest.mock('./services/firebase', () => ({ auth: {}, db: {} }));

// ---- Stores, hooks, shell components -------------------------------------------
jest.mock('./stores/notificationsStore', () => ({
  useNotificationsStore: () => ({ subscribeToNotifications: () => () => {} }),
}));
jest.mock('./hooks/useSessionTimeout', () => ({
  useSessionTimeout: () => ({ showWarning: false, countdown: 0, stayLoggedIn: () => {}, logoutNow: () => {} }),
}));
jest.mock('./components/BottomNav', () => () => <nav data-testid="bottom-nav" />);
jest.mock('./components/SplitSyncChat', () => () => <div data-testid="chat" />);
jest.mock('./components/SessionTimeoutWarning', () => () => null);

// ---- Pages (stubs that announce themselves) -----------------------------------
const stub = (name) => () => <h1>{name} page</h1>;
jest.mock('./pages/Login', () => stub('Login'));
jest.mock('./pages/Register', () => stub('Register'));
jest.mock('./pages/ForgotPassword', () => stub('ForgotPassword'));
jest.mock('./pages/Dashboard', () => stub('Dashboard'));
jest.mock('./pages/Activity', () => stub('Activity'));
jest.mock('./pages/Analytics', () => stub('Analytics'));
jest.mock('./pages/QuickAdd', () => stub('QuickAdd'));
jest.mock('./pages/Profile', () => stub('Profile'));
jest.mock('./pages/Settings', () => stub('Settings'));
jest.mock('./pages/GroupDetails', () => stub('GroupDetails'));
jest.mock('./pages/JoinGroup', () => stub('JoinGroup'));
jest.mock('./pages/Taskmaster', () => stub('Taskmaster'));
jest.mock('./pages/Hub', () => stub('Hub'));
jest.mock('./pages/spaces/ExpensesSpace', () => stub('ExpensesSpace'));
jest.mock('./pages/spaces/SpaceHome', () => ({ space }) => <h1>{space.name} space page</h1>);

// Circles flags (useSpaces): off unless a test switches them on
let mockSpaces = { loading: false, circlesOn: false, ids: ['expenses'] };
jest.mock('./hooks/useSpaces', () => ({
  __esModule: true,
  default: () => ({
    loading: mockSpaces.loading,
    circlesOn: mockSpaces.circlesOn,
    spaces: mockSpaces.ids.map((id) => ({ id })),
    isSpaceOn: (id) => mockSpaces.ids.includes(id),
  }),
}));

// eslint-disable-next-line import/first
import App from './App';
// eslint-disable-next-line import/first
import { useAuthStore } from './stores/authStore';

const REDIRECT_KEY = 'splitsync.postAuthRedirect';
const SIGNED_IN = { uid: 'user-1', email: 'a@example.com', displayName: 'Alice' };

/** Renders App at a path with a given auth state. */
function renderAt(path, user = null) {
  mockAuthUser = user;
  window.history.pushState({}, '', path);
  return render(<App />);
}

beforeEach(() => {
  mockAuthUser = null;
  mockUserDoc = { exists: () => true, data: () => ({ isActive: true }) };
  mockSignOut.mockClear();
  mockUpdateDoc.mockClear().mockImplementation(() => Promise.resolve());
  sessionStorage.clear();
  localStorage.clear();
  mockSpaces = { loading: false, circlesOn: false, ids: ['expenses'] };
  act(() => { useAuthStore.setState({ user: null, isAuthenticated: false, loading: true }); });
});

// ---------------------------------------------------------------------------
describe('Route guards', () => {
  test.each([
    '/dashboard', '/activity', '/analytics', '/add', '/profile', '/settings',
    '/group/g1', '/invite/g1', '/taskmaster',
  ])('signed-out visit to %s goes to Login', async (path) => {
    renderAt(path);
    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });

  test.each([
    ['/dashboard', 'Dashboard'], ['/activity', 'Activity'], ['/analytics', 'Analytics'],
    ['/add', 'QuickAdd'], ['/profile', 'Profile'], ['/settings', 'Settings'],
    ['/group/g1', 'GroupDetails'], ['/invite/g1', 'JoinGroup'], ['/taskmaster', 'Taskmaster'],
  ])('signed-in visit to %s renders %s', async (path, page) => {
    renderAt(path, SIGNED_IN);
    expect(await screen.findByText(`${page} page`)).toBeInTheDocument();
  });

  test.each(['/login', '/register', '/forgot-password'])(
    'signed-in visit to %s goes to the Dashboard', async (path) => {
      renderAt(path, SIGNED_IN);
      expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    });

  test('root and unknown paths redirect by auth state', async () => {
    renderAt('/');
    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });

  test('unknown path while signed in goes to the Dashboard', async () => {
    renderAt('/no-such-page', SIGNED_IN);
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
describe('Return to the intended page after sign-in (invite-link fix)', () => {
  test('a signed-out invite visit is remembered', async () => {
    renderAt('/invite/group-42');
    await screen.findByText('Login page');
    expect(sessionStorage.getItem(REDIRECT_KEY)).toBe('/invite/group-42');
  });

  test('the root path is not remembered as a target', async () => {
    renderAt('/');
    await screen.findByText('Login page');
    expect(sessionStorage.getItem(REDIRECT_KEY)).toBeNull();
  });

  test('once signed in on /login, the remembered invite opens and is then cleared', async () => {
    sessionStorage.setItem(REDIRECT_KEY, '/invite/group-42');
    renderAt('/login', SIGNED_IN);
    expect(await screen.findByText('JoinGroup page')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/invite/group-42');
    await waitFor(() => expect(sessionStorage.getItem(REDIRECT_KEY)).toBeNull());
  });

  test('an unsafe remembered value is ignored', async () => {
    sessionStorage.setItem(REDIRECT_KEY, '//evil.example');
    renderAt('/login', SIGNED_IN);
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
  });

  test('entering the app normally clears any stale target', async () => {
    sessionStorage.setItem(REDIRECT_KEY, '/invite/old');
    renderAt('/activity', SIGNED_IN);
    await screen.findByText('Activity page');
    await waitFor(() => expect(sessionStorage.getItem(REDIRECT_KEY)).toBeNull());
  });
});

// ---------------------------------------------------------------------------
describe('App shell (ProtectedLayout)', () => {
  test('shows bottom nav and assistant on main pages', async () => {
    renderAt('/dashboard', SIGNED_IN);
    await screen.findByText('Dashboard page');
    expect(screen.getByTestId('bottom-nav')).toBeInTheDocument();
    expect(screen.getByTestId('chat')).toBeInTheDocument();
  });

  test.each(['/group/g1', '/invite/g1'])('hides bottom nav on %s', async (path) => {
    renderAt(path, SIGNED_IN);
    await screen.findByText(/page$/);
    expect(screen.queryByTestId('bottom-nav')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat')).toBeInTheDocument();
  });

  test('Taskmaster renders without the app shell', async () => {
    renderAt('/taskmaster', SIGNED_IN);
    await screen.findByText('Taskmaster page');
    expect(screen.queryByTestId('bottom-nav')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chat')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
describe('Sign-in side effects', () => {
  test('a suspended account is signed out with a message flag', async () => {
    mockUserDoc = { exists: () => true, data: () => ({ isActive: false }) };
    renderAt('/dashboard', SIGNED_IN);
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    expect(sessionStorage.getItem('accountSuspended')).toBe('1');
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  test('records lastActive once per day per device', async () => {
    renderAt('/dashboard', SIGNED_IN);
    await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith(
      { path: 'users/user-1' }, { lastActive: 'SERVER_TS' }
    ));
    const today = new Date().toISOString().slice(0, 10);
    await waitFor(() => expect(localStorage.getItem('lastActive:user-1')).toBe(today));
  });

  test('does not write lastActive again the same day', async () => {
    localStorage.setItem('lastActive:user-1', new Date().toISOString().slice(0, 10));
    renderAt('/dashboard', SIGNED_IN);
    await screen.findByText('Dashboard page');
    await act(async () => { await Promise.resolve(); });
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  test('a lookup failure never blocks sign-in', async () => {
    mockUserDoc = { exists: () => { throw new Error('offline'); } };
    renderAt('/dashboard', SIGNED_IN);
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe('Hub and spaces (Phase 2)', () => {
  test('with circlesEnabled off, /dashboard is the current Dashboard and spaces redirect to it', async () => {
    renderAt('/spaces/expenses', SIGNED_IN);
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/dashboard');
  });

  test('with circlesEnabled off, a remembered Expenses back target is cleared', async () => {
    sessionStorage.setItem('splitsync:expensesHome', '/spaces/expenses');
    renderAt('/dashboard', SIGNED_IN);
    await screen.findByText('Dashboard page');
    await waitFor(() => expect(sessionStorage.getItem('splitsync:expensesHome')).toBeNull());
  });

  test('with circlesEnabled on, /dashboard is the Hub', async () => {
    mockSpaces = { loading: false, circlesOn: true, ids: ['expenses'] };
    renderAt('/dashboard', SIGNED_IN);
    expect(await screen.findByText('Hub page')).toBeInTheDocument();
  });

  test('with circlesEnabled on, /spaces/expenses is the Expenses space', async () => {
    mockSpaces = { loading: false, circlesOn: true, ids: ['expenses'] };
    renderAt('/spaces/expenses', SIGNED_IN);
    expect(await screen.findByText('ExpensesSpace page')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav')).toBeInTheDocument();
  });

  test('an enabled space opens its page; a switched-off or unknown space goes to the Hub', async () => {
    mockSpaces = { loading: false, circlesOn: true, ids: ['expenses', 'events'] };
    renderAt('/spaces/events', SIGNED_IN);
    expect(await screen.findByText('Events space page')).toBeInTheDocument();
  });

  test.each(['/spaces/loans', '/spaces/nope'])('%s redirects to the Hub when not enabled', async (path) => {
    mockSpaces = { loading: false, circlesOn: true, ids: ['expenses', 'events'] };
    renderAt(path, SIGNED_IN);
    expect(await screen.findByText('Hub page')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/dashboard');
  });

  test('while flags load, Home shows a spinner rather than guessing', async () => {
    mockSpaces = { loading: true, circlesOn: false, ids: ['expenses'] };
    renderAt('/dashboard', SIGNED_IN);
    expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.queryByText('Dashboard page')).not.toBeInTheDocument();
  });
});
