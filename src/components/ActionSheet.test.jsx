// src/components/ActionSheet.test.jsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockNavigate = [];
let mockPath = '/dashboard';
jest.mock('react-router-dom', () => ({
  useNavigate: () => (to) => mockNavigate.push(to),
  useLocation: () => ({ pathname: mockPath }),
}));

let mockSpaceIds = ['expenses', 'events', 'loans'];
jest.mock('../hooks/useSpaces', () => ({
  __esModule: true,
  default: () => {
    const { SPACES } = jest.requireActual('../config/spaces');
    return { loading: false, circlesOn: true, spaces: SPACES.filter((s) => mockSpaceIds.includes(s.id)) };
  },
}));

// eslint-disable-next-line import/first
import ActionSheet, { orderedActions } from './ActionSheet';
// eslint-disable-next-line import/first
import { SPACES } from '../config/spaces';

let closed = 0;
beforeEach(() => {
  mockNavigate.length = 0;
  mockPath = '/dashboard';
  mockSpaceIds = ['expenses', 'events', 'loans'];
  closed = 0;
});

const titles = () => screen.getAllByRole('button').map((b) => b.textContent).filter((t) => t !== '');

test('on the Hub, every enabled space has one action, with no "Other spaces" heading', () => {
  render(<ActionSheet open onClose={() => { closed += 1; }} />);
  expect(screen.getByRole('dialog', { name: 'What do you want to do?' })).toBeInTheDocument();
  expect(screen.getByText('Add an expense')).toBeInTheDocument();
  expect(screen.getByText('Log event spending')).toBeInTheDocument();
  expect(screen.getByText('Request or offer a loan')).toBeInTheDocument();
  expect(screen.queryByText('Circles')).not.toBeInTheDocument();
  expect(screen.queryByText('Other spaces')).not.toBeInTheDocument();
});

test('inside a space, its action comes first, then Other spaces', () => {
  mockPath = '/spaces/loans';
  render(<ActionSheet open onClose={() => {}} />);
  const list = titles();
  expect(list.findIndex((t) => t.includes('Request or offer a loan'))).toBeLessThan(list.findIndex((t) => t.includes('Add an expense')));
  expect(screen.getByText('Other spaces')).toBeInTheDocument();
});

test('Add an expense closes the sheet and opens Quick Add', () => {
  render(<ActionSheet open onClose={() => { closed += 1; }} />);
  fireEvent.click(screen.getByText('Add an expense'));
  expect(closed).toBe(1);
  expect(mockNavigate).toEqual(['/add']);
});

test('Escape and the close button close it', () => {
  render(<ActionSheet open onClose={() => { closed += 1; }} />);
  fireEvent.keyDown(document, { key: 'Escape' });
  fireEvent.click(screen.getByLabelText('Close'));
  expect(closed).toBe(2);
});

test('renders nothing while closed', () => {
  render(<ActionSheet open={false} onClose={() => {}} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('orderedActions puts a group page under Expenses', () => {
  const spaces = SPACES.filter((s) => ['expenses', 'aid'].includes(s.id));
  expect(orderedActions(spaces, 'expenses')).toEqual({ current: [spaces[0]], others: [spaces[1]] });
  expect(orderedActions(spaces, null)).toEqual({ current: [], others: spaces });
});
