// src/pages/Hub.test.jsx
// Home as a hub of spaces (Phase 2). Data hooks are replaced with plain
// values so each test states exactly what the user has.

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockNavigate = [];
jest.mock('react-router-dom', () => ({ useNavigate: () => (to) => mockNavigate.push(to) }));

let mockSpaceIds = ['expenses'];
jest.mock('../hooks/useSpaces', () => ({
  __esModule: true,
  default: () => {
    const { SPACES } = jest.requireActual('../config/spaces');
    return { loading: false, circlesOn: true, spaces: SPACES.filter((s) => mockSpaceIds.includes(s.id)), isSpaceOn: (id) => mockSpaceIds.includes(id) };
  },
}));

let mockSummary = { loading: false, groupCount: 0, owe: {}, owed: {}, highestDebt: null };
jest.mock('../hooks/useExpensesSummary', () => ({ __esModule: true, default: () => mockSummary }));

let mockHidden = [];
const mockSaved = [];
let mockSaveFails = false;
jest.mock('../hooks/useHubPrefs', () => ({
  __esModule: true,
  default: () => ({
    hidden: mockHidden,
    saveHidden: (list) => { mockSaved.push(list); return mockSaveFails ? Promise.reject(new Error('offline')) : Promise.resolve(); },
  }),
}));

let mockNotifications = [];
jest.mock('../stores/notificationsStore', () => ({
  useNotificationsStore: () => ({ unreadCount: mockNotifications.length, notifications: mockNotifications }),
}));
jest.mock('../components/AppTopBar', () => () => <div data-testid="app-top-bar" />);
jest.mock('./Dashboard', () => ({ CyclingTagline: () => <p>Any shared expense to split?</p> }));
jest.mock('../services/firebase', () => ({ db: {} }));
let mockPhoto = null;
jest.mock('firebase/firestore', () => ({
  doc: () => ({}),
  getDoc: () => Promise.resolve({ exists: () => true, data: () => ({ photoURL: mockPhoto }) }),
}));

// eslint-disable-next-line import/first
import Hub, { expensesTileText } from './Hub';
// eslint-disable-next-line import/first
import { useAuthStore } from '../stores/authStore';

beforeEach(() => {
  mockNavigate.length = 0;
  mockSpaceIds = ['expenses'];
  mockSummary = { loading: false, groupCount: 3, owe: { EUR: 60.49 }, owed: {}, highestDebt: { amount: 37.5, currency: 'EUR', groupId: 'g1', groupName: 'My Group' } };
  mockHidden = [];
  mockSaved.length = 0;
  mockSaveFails = false;
  mockNotifications = [];
  mockPhoto = null;
  act(() => { useAuthStore.setState({ user: { uid: 'u1', displayName: 'Hymzie Test' }, isAuthenticated: true }); });
});

test('welcomes the user and shows the Expenses tile with its own summary', () => {
  render(<Hub />);
  expect(screen.getByRole('heading', { name: 'Welcome back, Hymzie!' })).toBeInTheDocument();
  expect(screen.getByText('Your spaces')).toBeInTheDocument();
  expect(screen.getByText('3 groups')).toBeInTheDocument();
  expect(screen.getByText('You owe EUR 60.49')).toBeInTheDocument();
  expect(screen.getByText(/Each space keeps its own ledger/)).toBeInTheDocument();
});

test('the Expenses tile opens the Expenses space', () => {
  render(<Hub />);
  fireEvent.click(screen.getByRole('button', { name: /^Expenses/ }));
  expect(mockNavigate).toEqual(['/spaces/expenses']);
});

test('Needs attention lists tasks with their space and opens them', () => {
  mockNotifications = [{
    id: 'n1', type: 'payment_confirmation_needed', requiresAction: true, actionStatus: 'pending',
    data: { payerName: 'Alice', groupName: 'Flat', groupId: 'g2', currency: 'EUR', amount: 30 },
  }];
  render(<Hub />);
  expect(screen.getByText('Confirm a payment from Alice')).toBeInTheDocument();
  expect(screen.getByText('Settle EUR 37.50')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Confirm a payment from Alice'));
  fireEvent.click(screen.getByText('Settle EUR 37.50'));
  expect(mockNavigate).toEqual(['/group/g2', '/group/g1']);
});

test('nothing to do says so', () => {
  mockSummary = { loading: false, groupCount: 1, owe: {}, owed: {}, highestDebt: null };
  render(<Hub />);
  expect(screen.getByText('Nothing needs you right now.')).toBeInTheDocument();
  expect(screen.getByText('All settled up')).toBeInTheDocument();
});

test('enabled spaces get tiles; hidden ones are offered back', () => {
  mockSpaceIds = ['expenses', 'events', 'loans'];
  mockHidden = ['loans'];
  render(<Hub />);
  expect(screen.getByRole('button', { name: /^Events/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Loans/ })).not.toBeInTheDocument();
  expect(screen.getByText('1 hidden')).toBeInTheDocument();
});

test('Customise Home saves the hidden spaces and confirms', async () => {
  mockSpaceIds = ['expenses', 'events'];
  render(<Hub />);
  fireEvent.click(screen.getByText('Customise'));
  const dialog = screen.getByRole('dialog', { name: 'Customise Home' });
  expect(dialog).toBeInTheDocument();
  const expensesBox = screen.getByRole('checkbox', { name: /Expenses/ });
  expect(expensesBox).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: /Events/ }));
  fireEvent.click(screen.getByText('Done'));
  expect(await screen.findByRole('status')).toHaveTextContent('Home updated');
  expect(mockSaved).toEqual([['events']]);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('a failed save keeps the sheet open and explains', async () => {
  mockSaveFails = true;
  mockSpaceIds = ['expenses', 'events'];
  render(<Hub />);
  fireEvent.click(screen.getByText('Customise'));
  fireEvent.click(screen.getByText('Done'));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not save'));
  expect(screen.getByRole('dialog', { name: 'Customise Home' })).toBeInTheDocument();
});

test('keeps the original top bar and welcome: shared bar, tagline, profile photo', async () => {
  mockPhoto = 'https://example.com/me.png';
  render(<Hub />);
  expect(screen.getByTestId('app-top-bar')).toBeInTheDocument();
  expect(screen.getByText('Any shared expense to split?')).toBeInTheDocument();
  expect(await screen.findByAltText('Profile')).toHaveAttribute('src', 'https://example.com/me.png');
  fireEvent.click(screen.getByLabelText('Go to your profile'));
  expect(mockNavigate).toContain('/profile');
});

test('the tile text lists currencies separately and never adds them', () => {
  expect(expensesTileText({ loading: false, owe: { EUR: 10, GBP: 5 }, owed: {} }).lines).toEqual(['You owe EUR 10.00', 'You owe GBP 5.00']);
  expect(expensesTileText({ loading: false, owe: {}, owed: { USD: 3 } })).toEqual({ lines: ['Owed USD 3.00'], tone: 'owed' });
  expect(expensesTileText({ loading: true, owe: {}, owed: {} }).lines).toEqual(['Loading…']);
});
