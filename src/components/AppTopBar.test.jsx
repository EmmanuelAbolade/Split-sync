// src/components/AppTopBar.test.jsx
// The shared top bar: everything the original Dashboard bar had (logo to
// Taskmaster for admins, name, bell, Settings, Logout), plus the Spaces menu
// and sticky position only while circlesEnabled is on.

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockNavigate = [];
let mockPath = '/dashboard';
jest.mock('react-router-dom', () => ({
  useNavigate: () => (to) => mockNavigate.push(to),
  useLocation: () => ({ pathname: mockPath }),
}));

let mockIsAdmin = false;
jest.mock('../services/firebase', () => ({
  auth: { currentUser: { getIdTokenResult: () => Promise.resolve({ claims: { admin: mockIsAdmin } }) } },
}));
let mockSignedOut = 0;
jest.mock('firebase/auth', () => ({ signOut: () => { mockSignedOut += 1; return Promise.resolve(); } }));
jest.mock('../stores/notificationsStore', () => ({ useNotificationsStore: () => ({ unreadCount: 2 }) }));
jest.mock('./NotificationsDropdown', () => ({ isOpen }) => (isOpen ? <div>Notifications open</div> : null));

let mockSpaceIds = ['expenses'];
jest.mock('../hooks/useSpaces', () => ({
  __esModule: true,
  default: () => {
    const { SPACES } = jest.requireActual('../config/spaces');
    return { loading: false, circlesOn: mockSpaceIds.length > 1, spaces: SPACES.filter((s) => mockSpaceIds.includes(s.id)) };
  },
}));

// eslint-disable-next-line import/first
import AppTopBar from './AppTopBar';
// eslint-disable-next-line import/first
import { useAuthStore } from '../stores/authStore';

beforeEach(() => {
  mockNavigate.length = 0;
  mockPath = '/dashboard';
  mockIsAdmin = false;
  mockSignedOut = 0;
  mockSpaceIds = ['expenses'];
  act(() => { useAuthStore.setState({ user: { uid: 'u1', displayName: 'Hymzie Test' }, isAuthenticated: true }); });
});

test('shows the logo, the user name, bell, Settings and Logout', () => {
  render(<AppTopBar />);
  expect(screen.getByAltText('Split-Sync')).toBeInTheDocument();
  expect(screen.getByText('Hymzie Test')).toBeInTheDocument();
  expect(screen.getByLabelText('Notifications')).toHaveTextContent('2');
  expect(screen.getByLabelText('Settings')).toBeInTheDocument();
  expect(screen.getByText('Logout')).toBeInTheDocument();
});

test('the logo opens Taskmaster for an admin', async () => {
  mockIsAdmin = true;
  render(<AppTopBar />);
  await waitFor(() => expect(screen.getByAltText('Split-Sync')).toHaveAttribute('title', 'Open Taskmaster'));
  fireEvent.click(screen.getByAltText('Split-Sync'));
  expect(mockNavigate).toEqual(['/taskmaster']);
});

test('the logo goes Home for everyone else', async () => {
  render(<AppTopBar />);
  await act(async () => { await Promise.resolve(); });
  fireEvent.click(screen.getByAltText('Split-Sync'));
  expect(mockNavigate).toEqual(['/dashboard']);
});

test('Logout signs out and goes to Login', async () => {
  render(<AppTopBar />);
  fireEvent.click(screen.getByText('Logout'));
  await waitFor(() => expect(mockNavigate).toEqual(['/login']));
  // Same as the original Dashboard: signOut here, then the store's logout (which signs out too)
  expect(mockSignedOut).toBeGreaterThan(0);
});

test('the bell opens notifications; Settings opens Settings', () => {
  render(<AppTopBar />);
  fireEvent.click(screen.getByLabelText('Notifications'));
  expect(screen.getByText('Notifications open')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Settings'));
  expect(mockNavigate).toEqual(['/settings']);
});

test('a caller can manage the bell, admin and logout itself (Dashboard)', () => {
  let bells = 0;
  let logouts = 0;
  render(<AppTopBar isAdmin unreadCount={5} onBell={() => { bells += 1; }} onLogout={() => { logouts += 1; }} />);
  expect(screen.getByLabelText('Notifications')).toHaveTextContent('5');
  fireEvent.click(screen.getByLabelText('Notifications'));
  fireEvent.click(screen.getByText('Logout'));
  fireEvent.click(screen.getByAltText('Split-Sync'));
  expect([bells, logouts]).toEqual([1, 1]);
  expect(mockNavigate).toEqual(['/taskmaster']);
  expect(screen.queryByText('Notifications open')).not.toBeInTheDocument();
});

test('with circlesEnabled off: no Spaces menu and not sticky (as today)', () => {
  const { container } = render(<AppTopBar />);
  expect(screen.queryByRole('button', { name: /Spaces/ })).not.toBeInTheDocument();
  // eslint-disable-next-line testing-library/no-node-access, testing-library/no-container
  expect(container.firstChild.className).not.toMatch(/sticky/);
});

test('with circlesEnabled on: sticky, and the Spaces menu jumps to any space', () => {
  mockSpaceIds = ['expenses', 'events'];
  const { container } = render(<AppTopBar />);
  // eslint-disable-next-line testing-library/no-node-access, testing-library/no-container
  expect(container.firstChild.className).toMatch(/sticky/);
  fireEvent.click(screen.getByRole('button', { name: /Spaces/ }));
  const menu = screen.getByRole('menu', { name: 'Spaces' });
  expect(menu).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: /Home/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('menuitem', { name: /Events/ }));
  expect(mockNavigate).toEqual(['/spaces/events']);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

test('inside a space, the menu button names it', () => {
  mockSpaceIds = ['expenses', 'events'];
  mockPath = '/spaces/expenses';
  render(<AppTopBar />);
  expect(screen.getByRole('button', { name: /Expenses/ })).toHaveAttribute('aria-haspopup', 'menu');
});
