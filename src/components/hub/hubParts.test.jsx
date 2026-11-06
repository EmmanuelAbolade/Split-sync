// src/components/hub/hubParts.test.jsx
// The small, pure pieces behind the Hub, plus SpaceChips.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { moneyLines } from './SpaceTile';
import { attentionItems } from './NeedsAttention';
import { summarise } from '../../hooks/useExpensesSummary';
import { cleanHidden } from '../../hooks/useHubPrefs';
import { spaceOfPath, SPACES } from '../../config/spaces';
import { rememberExpensesHome, forgetExpensesHome, expensesHome } from '../../utils/spaceNav';
import SpaceChips from '../SpaceChips';

jest.mock('../../services/firebase', () => ({ db: {} }));

test('moneyLines keeps currencies apart, largest first, and drops zeros', () => {
  expect(moneyLines({ EUR: 5, GBP: 12.5, USD: 0 })).toEqual(['GBP 12.50', 'EUR 5.00']);
  expect(moneyLines(undefined)).toEqual([]);
});

test('summarise totals per currency only and finds the largest debt', () => {
  const groups = [
    { id: 'a', name: 'A', currency: 'EUR' },
    { id: 'b', name: 'B', currency: 'EUR' },
    { id: 'c', name: 'C', currency: 'GBP' },
    { id: 'd', name: 'D', currency: 'USD' },
  ];
  const r = summarise(groups, {
    a: { status: 'owes', amount: 10 },
    b: { status: 'owes', amount: 25 },
    c: { status: 'owed', amount: 7 },
    d: { status: 'settled', amount: 0 },
  });
  expect(r).toEqual({
    groupCount: 4,
    owe: { EUR: 35 },
    owed: { GBP: 7 },
    highestDebt: { amount: 25, currency: 'EUR', groupId: 'b', groupName: 'B' },
  });
});

test('attentionItems only takes payments still waiting for this user', () => {
  const items = attentionItems({
    notifications: [
      { id: '1', type: 'payment_confirmation_needed', requiresAction: true, actionStatus: 'pending', data: { payerName: 'A', groupId: 'g', amount: 2, currency: 'EUR' } },
      { id: '2', type: 'payment_confirmation_needed', requiresAction: true, actionStatus: 'confirmed', data: {} },
      { id: '3', type: 'payment_log', requiresAction: false, data: {} },
    ],
    highestDebt: null,
  });
  expect(items.map((i) => i.key)).toEqual(['confirm-1']);
  expect(items[0]).toMatchObject({ spaceId: 'expenses', to: '/group/g' });
});

test('cleanHidden never hides Expenses and drops junk', () => {
  expect(cleanHidden(['expenses', 'loans', 'loans', 3, null])).toEqual(['loans']);
  expect(cleanHidden('nope')).toEqual([]);
});

test('spaceOfPath knows which space a screen is in', () => {
  expect(spaceOfPath('/spaces/loans')).toBe('loans');
  expect(spaceOfPath('/spaces/unknown')).toBeNull();
  expect(spaceOfPath('/group/g1')).toBe('expenses');
  expect(spaceOfPath('/add')).toBe('expenses');
  expect(spaceOfPath('/dashboard')).toBeNull();
});

test('every space has its own route under /spaces', () => {
  SPACES.forEach((s) => expect(s.route).toBe(`/spaces/${s.id}`));
});

test('expensesHome is /dashboard unless the Expenses space remembered itself', () => {
  forgetExpensesHome();
  expect(expensesHome()).toBe('/dashboard');
  rememberExpensesHome('/spaces/expenses');
  expect(expensesHome()).toBe('/spaces/expenses');
  forgetExpensesHome();
  expect(expensesHome()).toBe('/dashboard');
});

test('SpaceChips as a filter: All plus each space, pressed state, onChange', () => {
  const picked = [];
  render(<SpaceChips spaces={SPACES.slice(0, 2)} value="all" includeAll onChange={(id) => picked.push(id)} />);
  expect(screen.getByRole('group', { name: 'Filter by space' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Events' }));
  expect(picked).toEqual(['events']);
});

test('SpaceChips as tabs', () => {
  render(<SpaceChips spaces={SPACES.slice(0, 2)} value="expenses" asTabs label="Stats by space" onChange={() => {}} />);
  expect(screen.getByRole('tablist', { name: 'Stats by space' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Expenses' })).toHaveAttribute('aria-selected', 'true');
});
