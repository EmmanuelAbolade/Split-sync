// src/components/PasskeysCard.test.jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockList = jest.fn();
const mockRegister = jest.fn();
const mockRemove = jest.fn();
const mockReauth = jest.fn();
let mockSupported = true;
jest.mock('../utils/stepUp', () => ({
  listPasskeys: (...a) => mockList(...a),
  registerPasskey: (...a) => mockRegister(...a),
  removePasskey: (...a) => mockRemove(...a),
  passkeysSupported: () => mockSupported,
  stepUpHint: (e) => (e && e.details && e.details.stepUp) || null,
  reauthenticate: (...a) => mockReauth(...a),
  reauthMethod: () => 'password',
  beginStepUp: jest.fn(),
  completeWithPasskey: jest.fn(),
  completeWithRecentLogin: jest.fn(),
}));

// eslint-disable-next-line import/first
import PasskeysCard from './PasskeysCard';

const reauthErr = Object.assign(new Error('old'), { details: { stepUp: 'reauth' } });

beforeEach(() => {
  mockSupported = true;
  mockList.mockReset().mockResolvedValue([]);
  mockRegister.mockReset().mockResolvedValue({ id: 'new' });
  mockRemove.mockReset().mockResolvedValue({ removed: true });
  mockReauth.mockReset().mockResolvedValue();
});

test('shows an empty state, then adds a passkey', async () => {
  render(<PasskeysCard />);
  expect(await screen.findByText('No passkeys yet.')).toBeInTheDocument();
  mockList.mockResolvedValueOnce([{ id: 'p1', label: 'Passkey', createdAt: Date.UTC(2026, 10, 5), lastUsedAt: null }]);
  fireEvent.click(screen.getByRole('button', { name: 'Add a passkey on this device' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Passkey added.');
  expect(screen.getByText('Passkey')).toBeInTheDocument();
  expect(screen.getByText(/last used never/)).toBeInTheDocument();
});

test('asks for a fresh sign-in when the server requires it, then retries', async () => {
  mockRegister.mockRejectedValueOnce(reauthErr);
  render(<PasskeysCard />);
  await screen.findByText('No passkeys yet.');
  fireEvent.click(screen.getByRole('button', { name: 'Add a passkey on this device' }));
  fireEvent.change(await screen.findByLabelText('Enter your password'), { target: { value: 'pw' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(2));
  expect(await screen.findByRole('status')).toHaveTextContent('Passkey added.');
});

test('removing a passkey needs a second, explicit confirmation', async () => {
  mockList.mockResolvedValueOnce([{ id: 'p1', label: 'Laptop', createdAt: 1, lastUsedAt: 2 }]).mockResolvedValueOnce([]);
  render(<PasskeysCard />);
  fireEvent.click(await screen.findByRole('button', { name: 'Remove passkey Laptop' }));
  expect(mockRemove).not.toHaveBeenCalled();
  expect(screen.getByText(/Remove this passkey\?/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }));
  await waitFor(() => expect(mockRemove).toHaveBeenCalledWith('p1'));
  expect(await screen.findByText('No passkeys yet.')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Passkey removed.');
});

test('"Keep it" cancels the removal', async () => {
  mockList.mockResolvedValueOnce([{ id: 'p1', label: 'Laptop', createdAt: 1, lastUsedAt: 2 }]);
  render(<PasskeysCard />);
  fireEvent.click(await screen.findByRole('button', { name: 'Remove passkey Laptop' }));
  fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
  expect(screen.queryByText(/Remove this passkey\?/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Remove passkey Laptop' })).toBeInTheDocument();
  expect(mockRemove).not.toHaveBeenCalled();
});

test('errors are shown, cancellations are gentle', async () => {
  mockRegister.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
  render(<PasskeysCard />);
  await screen.findByText('No passkeys yet.');
  fireEvent.click(screen.getByRole('button', { name: 'Add a passkey on this device' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Cancelled.');
  mockRegister.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'functions/already-exists' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add a passkey on this device' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('already added');
});

test('a list failure and an unsupported browser are explained', async () => {
  mockSupported = false;
  mockList.mockRejectedValueOnce(new Error('offline'));
  render(<PasskeysCard />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your passkeys.');
  expect(screen.getByText('This browser does not support passkeys.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add a passkey on this device' })).not.toBeInTheDocument();
});
