// src/components/StepUpSheet.test.jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockBegin = jest.fn();
const mockPasskey = jest.fn();
const mockRecent = jest.fn();
const mockReauth = jest.fn();
let mockMethod = 'password';
jest.mock('../utils/stepUp', () => ({
  beginStepUp: (...a) => mockBegin(...a),
  completeWithPasskey: (...a) => mockPasskey(...a),
  completeWithRecentLogin: (...a) => mockRecent(...a),
  reauthenticate: (...a) => mockReauth(...a),
  reauthMethod: () => mockMethod,
  stepUpHint: (e) => (e && e.details && e.details.stepUp) || null,
}));

// eslint-disable-next-line import/first
import StepUpSheet from './StepUpSheet';

const PARAMS = { circleId: 'c1', cycle: 1, idempotencyKey: 'k'.repeat(20) };
const reauthErr = Object.assign(new Error('old'), { details: { stepUp: 'reauth' } });

function renderSheet(props = {}) {
  const onConfirmed = jest.fn();
  const onCancel = jest.fn();
  render(<StepUpSheet open action="circles.claimContribution" params={PARAMS} onConfirmed={onConfirmed} onCancel={onCancel} {...props} />);
  return { onConfirmed, onCancel };
}

beforeEach(() => {
  mockMethod = 'password';
  mockBegin.mockReset().mockResolvedValue({ challengeId: 'ch1', methods: ['recentLogin'], webauthn: null });
  mockPasskey.mockReset().mockResolvedValue({ stepUpToken: 'tok-passkey' });
  mockRecent.mockReset().mockResolvedValue({ stepUpToken: 'tok-recent' });
  mockReauth.mockReset().mockResolvedValue();
});

test('renders nothing when closed', () => {
  render(<StepUpSheet open={false} action="a" params={{}} onConfirmed={jest.fn()} onCancel={jest.fn()} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(mockBegin).not.toHaveBeenCalled();
});

test('asks the server for a challenge for this exact action', async () => {
  renderSheet();
  expect(screen.getByRole('dialog', { name: "Confirm it's you" })).toBeInTheDocument();
  await screen.findByRole('button', { name: 'Continue' });
  expect(mockBegin).toHaveBeenCalledWith('circles.claimContribution', PARAMS);
});

test('a recent sign-in confirms without asking for anything', async () => {
  const { onConfirmed } = renderSheet();
  fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(onConfirmed).toHaveBeenCalledWith('tok-recent'));
  expect(mockRecent).toHaveBeenCalledWith('ch1');
});

test('an old sign-in asks for the password, then confirms', async () => {
  mockRecent.mockRejectedValueOnce(reauthErr);
  const { onConfirmed } = renderSheet();
  fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
  const pw = await screen.findByLabelText('Enter your password');
  fireEvent.change(pw, { target: { value: 'secret123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(onConfirmed).toHaveBeenCalledWith('tok-recent'));
  expect(mockReauth).toHaveBeenCalledWith('secret123');
});

test('a wrong password shows a message and does not confirm', async () => {
  mockRecent.mockRejectedValueOnce(reauthErr);
  mockReauth.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'auth/invalid-credential' }));
  const { onConfirmed } = renderSheet();
  fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
  fireEvent.change(await screen.findByLabelText('Enter your password'), { target: { value: 'nope' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('That password is not right.');
  expect(onConfirmed).not.toHaveBeenCalled();
});

test('Google accounts confirm with Google instead of a password', async () => {
  mockMethod = 'google';
  mockRecent.mockRejectedValueOnce(reauthErr);
  const { onConfirmed } = renderSheet();
  fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Continue with Google' }));
  await waitFor(() => expect(onConfirmed).toHaveBeenCalledWith('tok-recent'));
});

test('with a passkey, it is offered first and used', async () => {
  mockBegin.mockResolvedValue({ challengeId: 'ch2', methods: ['webauthn', 'recentLogin'], webauthn: { challenge: 'c' } });
  const { onConfirmed } = renderSheet();
  const passkeyButton = await screen.findByRole('button', { name: 'Use passkey' });
  expect(screen.getByRole('button', { name: 'Sign in again instead' })).toBeInTheDocument();
  fireEvent.click(passkeyButton);
  await waitFor(() => expect(onConfirmed).toHaveBeenCalledWith('tok-passkey'));
  expect(mockPasskey).toHaveBeenCalledWith('ch2', { challenge: 'c' });
});

test('a cancelled passkey prompt can be retried', async () => {
  mockBegin.mockResolvedValue({ challengeId: 'ch2', methods: ['webauthn', 'recentLogin'], webauthn: {} });
  mockPasskey.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
  const { onConfirmed } = renderSheet();
  fireEvent.click(await screen.findByRole('button', { name: 'Use passkey' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Confirmation was cancelled.');
  fireEvent.click(screen.getByRole('button', { name: 'Use passkey' }));
  await waitFor(() => expect(onConfirmed).toHaveBeenCalledWith('tok-passkey'));
});

test('if the challenge cannot be created, it explains and can be closed', async () => {
  mockBegin.mockRejectedValue(Object.assign(new Error('x'), { code: 'functions/resource-exhausted' }));
  const { onCancel } = renderSheet();
  expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts');
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(onCancel).toHaveBeenCalled();
});

test('cancel button and backdrop cancel', async () => {
  const { onCancel } = renderSheet();
  await screen.findByRole('button', { name: 'Continue' });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onCancel).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('dialog'));
  expect(onCancel).toHaveBeenCalledTimes(1);
});
