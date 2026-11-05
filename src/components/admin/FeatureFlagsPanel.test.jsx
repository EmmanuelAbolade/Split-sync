// src/components/admin/FeatureFlagsPanel.test.jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

let mockFeatures = {};
let mockGetDocFails = false;
jest.mock('firebase/firestore', () => ({
  doc: (...a) => a.slice(1).join('/'),
  getDoc: () => (mockGetDocFails ? Promise.reject(new Error('denied')) : Promise.resolve({ exists: () => true, data: () => mockFeatures })),
}));
const mockSetFlag = jest.fn();
jest.mock('firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: (_f, name) => (data) => mockSetFlag(name, data),
}));
jest.mock('../../services/firebase', () => ({ __esModule: true, default: {}, db: {} }));

// eslint-disable-next-line import/first
import FeatureFlagsPanel, { parseUidList } from './FeatureFlagsPanel';

beforeEach(() => {
  mockFeatures = { circlesEnabled: { enabled: false, allowUids: ['tester1'] } };
  mockGetDocFails = false;
  mockSetFlag.mockReset().mockImplementation((_n, d) => Promise.resolve({ data: d }));
});

test('parseUidList trims, splits and de-duplicates', () => {
  expect(parseUidList(' a, b\n\nb  c ')).toEqual(['a', 'b', 'c']);
  expect(parseUidList('')).toEqual([]);
});

test('lists every flag with its current state', async () => {
  render(<FeatureFlagsPanel />);
  expect(await screen.findByText('circlesEnabled')).toBeInTheDocument();
  expect(screen.getByText('Testers only (1)')).toBeInTheDocument();
  expect(screen.getAllByText('Off').length).toBe(6);
  expect(screen.getByLabelText('Testers (user IDs, one per line, up to 50)', { selector: '#uids-circlesEnabled' })).toHaveValue('tester1');
});

test('saving calls the admin Function with the parsed tester list', async () => {
  render(<FeatureFlagsPanel />);
  await screen.findByText('aidEnabled');
  fireEvent.change(screen.getByLabelText('Testers (user IDs, one per line, up to 50)', { selector: '#uids-aidEnabled' }), { target: { value: 'u1\nu2, u1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save aidEnabled' }));
  await waitFor(() => expect(mockSetFlag).toHaveBeenCalledWith('admin-setFlag', { flag: 'aidEnabled', enabled: false, allowUids: ['u1', 'u2'] }));
  expect(await screen.findByRole('status')).toHaveTextContent('aidEnabled saved.');
  expect(screen.getByText('Testers only (2)')).toBeInTheDocument();
});

test('turning a flag on for everyone', async () => {
  render(<FeatureFlagsPanel />);
  await screen.findByText('loansEnabled');
  fireEvent.click(screen.getByLabelText('loansEnabled on for everyone'));
  fireEvent.click(screen.getByRole('button', { name: 'Save loansEnabled' }));
  await waitFor(() => expect(mockSetFlag).toHaveBeenCalledWith('admin-setFlag', { flag: 'loansEnabled', enabled: true, allowUids: [] }));
  expect(await screen.findByText('On for everyone', { selector: 'span' })).toBeInTheDocument();
});

test('server refusals are explained', async () => {
  mockSetFlag.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'functions/permission-denied' }));
  render(<FeatureFlagsPanel />);
  await screen.findByText('aidEnabled');
  fireEvent.click(screen.getByRole('button', { name: 'Save aidEnabled' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Only platform admins');
  mockSetFlag.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'functions/invalid-argument' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save aidEnabled' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Check the tester list');
  mockSetFlag.mockRejectedValueOnce(new Error('network'));
  fireEvent.click(screen.getByRole('button', { name: 'Save aidEnabled' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the flag.');
});

test('a load failure is shown and the flags read as off', async () => {
  mockGetDocFails = true;
  render(<FeatureFlagsPanel />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the flags.');
  expect(screen.getAllByText('Off').length).toBe(7);
  mockGetDocFails = false;
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(await screen.findByText('Testers only (1)')).toBeInTheDocument();
});
