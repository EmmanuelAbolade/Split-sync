// src/components/SettleUpModal.test.jsx
// Settle Up in short steps (approved design, 2026-11-05):
//   payer: How are you settling? -> Pay now -> app step | I already paid
//          plus "Did you finish paying?" and the waiting-for-confirmation card
//   payee: I received a payment (after "Confirm it's you")
// Mocks are plain functions and values, not jest.fn, so CRA's resetMocks
// does not clear them between tests.

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SettleUpModal from './SettleUpModal';

jest.mock('../services/firebase', () => ({ db: {} }));

jest.mock('firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: () => () =>
    Promise.resolve({ data: { success: true, orderId: 'capture-123', status: 'COMPLETED' } }),
}));

// The pair's payment lock: null, { status: 'started', ... } or { status: 'claimed', ... }
let mockLock = null;
jest.mock('firebase/firestore', () => ({
  doc: () => ({}),
  onSnapshot: (_ref, cb) => {
    cb(mockLock ? { exists: () => true, data: () => mockLock } : { exists: () => false, data: () => ({}) });
    return () => {};
  },
}));

// Payer's claims
const mockClaims = [];
let mockClaimResult = () => Promise.resolve();
jest.mock('../stores/notificationsStore', () => ({
  recordPaymentSent: (data) => { mockClaims.push(data); return mockClaimResult(); },
}));

let mockStepUpToken = 'tok';
const mockStepUpCalls = [];
jest.mock('../hooks/useStepUp', () => ({
  __esModule: true,
  default: () => ({
    requestStepUp: (action, params) => { mockStepUpCalls.push([action, params]); return Promise.resolve(mockStepUpToken); },
    stepUpSheet: null,
  }),
}));

let mockDemosOn = false;
jest.mock('../hooks/useFeatureFlags', () => ({
  __esModule: true,
  default: () => ({ loading: false, isEnabled: (name) => name === 'paymentDemosEnabled' && mockDemosOn }),
}));

const mockCalls = [];
let mockReceiveResult = () => Promise.resolve({ status: 'confirmed' });
let mockCancelResult = () => Promise.resolve({ status: 'cancelled' });
jest.mock('../utils/settlements', () => {
  const actual = jest.requireActual('../utils/settlements');
  return {
    receiveParams: actual.receiveParams,
    settlementErrorMessage: actual.settlementErrorMessage,
    methodLabel: actual.methodLabel,
    startSettlement: (data) => { mockCalls.push(['start', data]); return Promise.resolve({ status: 'started' }); },
    receiveSettlement: (data, token) => { mockCalls.push(['receive', data, token]); return mockReceiveResult(); },
    cancelSettlement: (data) => { mockCalls.push(['cancel', data]); return mockCancelResult(); },
  };
});
jest.mock('../utils/stepUp', () => ({ newIdempotencyKey: () => 'idem-key-0000000001' }));

// The payee's payment options, as the server returns them
let mockMethods = null;
jest.mock('../utils/privateProfile', () => ({
  fetchGroupPaymentMethods: async () => (mockMethods ? new Proxy({}, { get: () => mockMethods }) : {}),
}));
jest.mock('../utils/ibanService', () => ({ fetchIban: async () => 'IE29AIBK93115212345678' }));

jest.mock('@paypal/react-paypal-js', () => ({
  PayPalButtons: ({ onApprove }) => (
    <button type="button" data-testid="paypal-approve" onClick={() => onApprove({ orderID: 'order-123' })}>PayPal Approve</button>
  ),
}));

jest.mock('./SepaPaymentModal', () =>
  function MockSepaPaymentModal({ isOpen, onPaymentSuccess }) {
    if (!isOpen) return null;
    return <button type="button" onClick={() => onPaymentSuccess({ amount: 20 })}>Complete SEPA</button>;
  }
);

jest.mock('./QRCodeCanvas', () =>
  function MockQRCodeCanvas({ value }) {
    return <canvas data-testid="qr-canvas" data-value={value} />;
  }
);

const group = {
  id: 'group-1',
  name: 'Flat',
  currency: 'EUR',
  members: [
    { userId: 'alice', name: 'Alice' },
    { userId: 'bob', name: 'Bob' },
  ],
};
const settlement = { from: 'alice', to: 'bob', amount: 45.5 };
let closed = 0;
const onClose = () => { closed += 1; };

const asPayer = (props = {}) =>
  render(<SettleUpModal isOpen onClose={onClose} settlement={settlement} group={group} currentUserId="alice" {...props} />);
const asPayee = () =>
  render(<SettleUpModal isOpen onClose={onClose} settlement={settlement} group={group} currentUserId="bob" />);

const copies = [];
let copyWorks = true;
let opened = [];

beforeEach(() => {
  mockLock = null;
  mockClaims.length = 0;
  mockClaimResult = () => Promise.resolve();
  mockStepUpToken = 'tok';
  mockStepUpCalls.length = 0;
  mockDemosOn = false;
  mockCalls.length = 0;
  mockReceiveResult = () => Promise.resolve({ status: 'confirmed' });
  mockCancelResult = () => Promise.resolve({ status: 'cancelled' });
  mockMethods = { paypalUsername: 'bobpaypal', revolutUsername: 'bobrev', bic: 'AIBKIE2D', hasIban: true };
  closed = 0;
  copies.length = 0;
  copyWorks = true;
  opened = [];
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (t) => { if (!copyWorks) return Promise.reject(new Error('no')); copies.push(t); return Promise.resolve(); } },
  });
  window.open = (url, target) => { opened.push([url, target]); return null; };
  sessionStorage.clear();
});

const serverError = (code, message) => Object.assign(new Error(message), { code });

// ---------------------------------------------------------------------------

describe('Settle Up - opening', () => {
  test('renders nothing while closed', () => {
    render(<SettleUpModal isOpen={false} onClose={onClose} settlement={settlement} group={group} currentUserId="alice" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('renders nothing for someone who is neither paying nor receiving', () => {
    render(<SettleUpModal isOpen onClose={onClose} settlement={settlement} group={group} currentUserId="carol" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('the payer is asked how they are settling', () => {
    asPayer();
    expect(screen.getByText('You owe Bob in Flat')).toBeInTheDocument();
    expect(screen.getByText('EUR 45.50')).toBeInTheDocument();
    expect(screen.getByText('How are you settling?')).toBeInTheDocument();
    expect(screen.getByText('Pay now')).toBeInTheDocument();
    expect(screen.getByText('I already paid')).toBeInTheDocument();
    expect(screen.getByText('Bob confirms each payment before your balances change.')).toBeInTheDocument();
  });

  test('Close calls onClose', () => {
    asPayer();
    fireEvent.click(screen.getByLabelText('Close'));
    expect(closed).toBe(1);
  });
});

describe('Settle Up - Pay now', () => {
  test('lists only the ways the payee has set up, with what each one does', async () => {
    asPayer();
    fireEvent.click(screen.getByText('Pay now'));
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    expect(await screen.findByText('Revolut')).toBeInTheDocument();
    expect(screen.getByText('@bobrev · you paste the amount')).toBeInTheDocument();
    expect(screen.getByText('@bobpaypal · amount filled in for you')).toBeInTheDocument();
    expect(screen.getByText('Bank transfer')).toBeInTheDocument();
    expect(screen.getByText('You owe EUR 45.50. You can pay part of it.')).toBeInTheDocument();
  });

  test('says so when the payee has set nothing up', async () => {
    mockMethods = null;
    asPayer();
    fireEvent.click(screen.getByText('Pay now'));
    expect(await screen.findByText(/Bob has not added PayPal, Revolut or bank details yet/)).toBeInTheDocument();
  });

  test('Back returns to the first question', async () => {
    asPayer();
    fireEvent.click(screen.getByText('Pay now'));
    fireEvent.click(screen.getByLabelText('Back'));
    expect(screen.getByText('How are you settling?')).toBeInTheDocument();
  });

  test('an empty amount is refused before choosing an app', async () => {
    asPayer();
    fireEvent.click(screen.getByText('Pay now'));
    await screen.findByText('Revolut');
    fireEvent.change(screen.getByLabelText('Amount to pay Bob'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Revolut'));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount above zero.');
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
  });

  test('letters are not accepted in the amount', () => {
    asPayer();
    fireEvent.click(screen.getByText('Pay now'));
    const input = screen.getByLabelText('Amount to pay Bob');
    fireEvent.change(input, { target: { value: '12a' } });
    expect(input).toHaveValue('45.50');
    fireEvent.change(input, { target: { value: '12.3' } });
    expect(input).toHaveValue('12.3');
  });
});

describe('Settle Up - Revolut step', () => {
  const toRevolut = async () => {
    asPayer();
    fireEvent.click(screen.getByText('Pay now'));
    await screen.findByText('Revolut');
    fireEvent.click(screen.getByText('Revolut'));
  };

  test('shows the amount large, explains pasting, and offers a QR code for laptops', async () => {
    await toRevolut();
    expect(screen.getByText('Pay Bob with Revolut')).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('EUR 45.50')).toBeInTheDocument();
    expect(screen.getByText('Revolut cannot fill in the amount for you. Paste it when the app opens.')).toBeInTheDocument();
    expect(screen.getByText('On a laptop?')).toBeInTheDocument();
    expect(screen.getByTestId('qr-canvas')).toHaveAttribute('data-value', 'https://revolut.me/bobrev');
  });

  test('Copy amount copies it and says Copied', async () => {
    await toRevolut();
    fireEvent.click(screen.getByText('Copy amount'));
    expect(await screen.findByText(/Copied 45\.50/)).toBeInTheDocument();
    expect(copies).toEqual(['45.50']);
  });

  test('when copying is blocked, the amount is shown to remember instead', async () => {
    copyWorks = false;
    await toRevolut();
    fireEvent.click(screen.getByText('Copy amount'));
    expect(await screen.findByText('Copying is not available here. Remember EUR 45.50.')).toBeInTheDocument();
  });

  test('Open Revolut opens the link, copies the amount, remembers the started payment, and closes', async () => {
    await toRevolut();
    fireEvent.click(screen.getByText('Open Revolut'));
    expect(opened).toEqual([['https://revolut.me/bobrev', '_blank']]);
    expect(copies).toEqual(['45.50']);
    expect(mockCalls).toEqual([['start', { groupId: 'group-1', toUid: 'bob', amount: 45.5, method: 'revolut' }]]);
    expect(JSON.parse(sessionStorage.getItem('pendingPayment'))).toMatchObject({ method: 'revolut', amount: 45.5, toName: 'Bob' });
    expect(closed).toBe(1);
    expect(mockClaims).toEqual([]);
  });

  test('a part payment carries the changed amount', async () => {
    asPayer();
    fireEvent.click(screen.getByText('Pay now'));
    await screen.findByText('Revolut');
    fireEvent.change(screen.getByLabelText('Amount to pay Bob'), { target: { value: '20' } });
    fireEvent.click(screen.getByText('Revolut'));
    expect(screen.getByText('EUR 20.00')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Open Revolut'));
    expect(mockCalls[0][1].amount).toBe(20);
  });
});

describe('Settle Up - PayPal and bank steps', () => {
  test('PayPal says it fills in the amount, and opens the PayPal.me link with it', async () => {
    asPayer();
    fireEvent.click(screen.getByText('Pay now'));
    await screen.findByText('PayPal');
    fireEvent.click(screen.getByText('PayPal'));
    expect(screen.getByText('PayPal fills in the amount for you.')).toBeInTheDocument();
    expect(screen.queryByText('On a laptop?')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Open PayPal'));
    expect(opened).toEqual([['https://paypal.me/bobpaypal/45.5EUR', '_blank']]);
    expect(mockCalls[0]).toEqual(['start', { groupId: 'group-1', toUid: 'bob', amount: 45.5, method: 'paypal' }]);
  });

  test('bank transfer shows the details to copy, then sends a claim once sent', async () => {
    asPayer();
    fireEvent.click(screen.getByText('Pay now'));
    await screen.findByText('Bank transfer');
    fireEvent.click(screen.getByText('Bank transfer'));
    expect(screen.getByText('IE29AIBK93115212345678')).toBeInTheDocument();
    expect(screen.getByText('AIBKIE2D')).toBeInTheDocument();
    expect(screen.getByText('SplitSync Settlement')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Copy IBAN'));
    await waitFor(() => expect(copies).toEqual(['IE29AIBK93115212345678']));
    fireEvent.click(screen.getByText('I have sent it'));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Sent to Bob'));
    expect(mockClaims).toEqual([{ payeeId: 'bob', groupId: 'group-1', amount: 45.5, method: 'bank', idempotencyKey: 'idem-key-0000000001' }]);
  });
});

describe('Settle Up - I already paid', () => {
  test('sends a cash claim to the payee and says what happens next', async () => {
    asPayer();
    fireEvent.click(screen.getByText('I already paid'));
    expect(screen.getByRole('button', { name: 'Cash' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByText('Send to Bob to confirm'));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Sent to Bob'));
    expect(screen.getByText(/EUR 45\.50 by cash or other\. Your balance updates when Bob confirms/)).toBeInTheDocument();
    expect(mockClaims).toEqual([{ payeeId: 'bob', groupId: 'group-1', amount: 45.5, method: 'manual', idempotencyKey: 'idem-key-0000000001' }]);
    fireEvent.click(screen.getByText('Done'));
    expect(closed).toBe(1);
  });

  test('the chosen method and a part amount are sent', async () => {
    asPayer();
    fireEvent.click(screen.getByText('I already paid'));
    fireEvent.click(screen.getByRole('button', { name: 'Revolut' }));
    expect(screen.getByRole('button', { name: 'Revolut' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByLabelText('How much did you pay?'), { target: { value: '20' } });
    fireEvent.click(screen.getByText('Send to Bob to confirm'));
    await waitFor(() => expect(mockClaims).toHaveLength(1));
    expect(mockClaims[0]).toMatchObject({ amount: 20, method: 'revolut' });
  });

  test('while sending, the button shows a spinner label and cannot be pressed again', async () => {
    let release;
    mockClaimResult = () => new Promise((r) => { release = r; });
    asPayer();
    fireEvent.click(screen.getByText('I already paid'));
    fireEvent.click(screen.getByText('Send to Bob to confirm'));
    const button = await screen.findByRole('button', { name: 'Sending to Bob…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(mockClaims).toHaveLength(1);
    release();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Sent to Bob'));
  });

  test('a server refusal is shown and nothing is lost', async () => {
    mockClaimResult = () => Promise.reject(serverError('functions/invalid-argument', 'That is more than you owe.'));
    asPayer();
    fireEvent.click(screen.getByText('I already paid'));
    fireEvent.click(screen.getByText('Send to Bob to confirm'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('That is more than you owe.'));
    expect(screen.getByText('Send to Bob to confirm')).toBeInTheDocument();
  });

  test('an unexpected failure says nothing was saved', async () => {
    mockClaimResult = () => Promise.reject(serverError('functions/internal', 'stack'));
    asPayer();
    fireEvent.click(screen.getByText('I already paid'));
    fireEvent.click(screen.getByText('Send to Bob to confirm'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('That did not work. Nothing was saved, please try again.'));
  });
});

describe('Settle Up - a payment app was opened earlier', () => {
  beforeEach(() => {
    mockLock = { status: 'started', method: 'revolut', amount: 30, currency: 'EUR', toName: 'Bob', timestamp: Date.now() };
  });

  test('asks whether they finished paying', () => {
    asPayer();
    expect(screen.getByText('Did you finish paying Bob?')).toBeInTheDocument();
    expect(screen.getByText('EUR 30.00')).toBeInTheDocument();
    expect(screen.getByText(/You opened Revolut/)).toBeInTheDocument();
  });

  test('Yes, I paid sends a claim for that payment', async () => {
    asPayer();
    fireEvent.click(screen.getByText('Yes, I paid'));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Sent to Bob'));
    expect(mockClaims).toEqual([{ payeeId: 'bob', groupId: 'group-1', amount: 30, method: 'revolut', idempotencyKey: 'idem-key-0000000001' }]);
  });

  test('Not yet drops the started payment and says nothing was recorded', async () => {
    asPayer();
    fireEvent.click(screen.getByText('Not yet'));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Nothing was recorded'));
    expect(mockCalls).toEqual([['cancel', { groupId: 'group-1', toUid: 'bob' }]]);
    expect(mockClaims).toEqual([]);
  });

  test('Not yet shows Saving while it works', async () => {
    let release;
    mockCancelResult = () => new Promise((r) => { release = r; });
    asPayer();
    fireEvent.click(screen.getByText('Not yet'));
    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Yes, I paid' })).toBeDisabled();
    release({ status: 'cancelled' });
    expect(await screen.findByRole('status')).toBeInTheDocument();
  });
});

describe('Settle Up - a payment waiting for the payee', () => {
  beforeEach(() => {
    mockLock = { status: 'claimed', method: 'bank', amount: 30, currency: 'EUR', toName: 'Bob' };
  });

  test('shows the waiting card and blocks a second payment', () => {
    asPayer();
    expect(screen.getByText('Waiting for Bob to confirm')).toBeInTheDocument();
    expect(screen.getByText(/EUR 30\.00 by bank transfer/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pay now/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /I already paid/ })).toBeDisabled();
  });

  test('Withdraw takes the claim back and says so', async () => {
    asPayer();
    fireEvent.click(screen.getByText('Withdraw'));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Payment withdrawn'));
    expect(mockCalls).toEqual([['cancel', { groupId: 'group-1', toUid: 'bob' }]]);
  });

  test('a failed withdraw is explained', async () => {
    mockCancelResult = () => Promise.reject(serverError('functions/failed-precondition', 'Bob already answered.'));
    asPayer();
    fireEvent.click(screen.getByText('Withdraw'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Bob already answered.'));
  });
});

describe('Settle Up - the payee records a payment', () => {
  test('confirming it is you, then recording, settles the debt', async () => {
    asPayee();
    expect(screen.getByText('Alice owes you in Flat')).toBeInTheDocument();
    fireEvent.click(screen.getByText('I received a payment'));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Payment recorded'));
    expect(mockStepUpCalls).toEqual([['settlements.receive', { groupId: 'group-1', fromUid: 'alice', amountMinor: 4550, idempotencyKey: 'idem-key-0000000001' }]]);
    expect(mockCalls).toEqual([['receive', { groupId: 'group-1', fromUid: 'alice', amount: 45.5, idempotencyKey: 'idem-key-0000000001' }, 'tok']]);
  });

  test('cancelling "Confirm it is you" records nothing and says why', async () => {
    mockStepUpToken = null;
    asPayee();
    fireEvent.click(screen.getByText('I received a payment'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Not recorded: confirming it is you was cancelled.'));
    expect(mockCalls).toEqual([]);
  });

  test('a server refusal is shown', async () => {
    mockReceiveResult = () => Promise.reject(serverError('functions/failed-precondition', 'A payment from Alice is waiting for you to answer.'));
    asPayee();
    fireEvent.click(screen.getByText('I received a payment'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('A payment from Alice is waiting for you to answer.'));
  });

  test('the QR panel shows PayPal and Revolut codes', async () => {
    asPayee();
    fireEvent.click(screen.getByText('Let Alice scan to pay you'));
    await waitFor(() => expect(screen.getByTestId('qr-canvas')).toHaveAttribute('data-value', 'https://paypal.me/bobpaypal/45.5EUR'));
    fireEvent.click(screen.getByRole('button', { name: 'Revolut' }));
    expect(screen.getByTestId('qr-canvas')).toHaveAttribute('data-value', 'https://revolut.me/bobrev');
  });
});

describe('Settle Up - payment demos switch', () => {
  test('the demo panel is hidden while paymentDemosEnabled is off', async () => {
    asPayer();
    fireEvent.click(screen.getByText('Pay now'));
    await screen.findByText('Revolut');
    expect(screen.queryByText('Future feature - Settlement Payment Flow')).not.toBeInTheDocument();
  });

  test('with the switch on, the PayPal sandbox demo sends a claim with the order id', async () => {
    mockDemosOn = true;
    asPayer();
    fireEvent.click(screen.getByText('Pay now'));
    fireEvent.click(screen.getByText('Future feature - Settlement Payment Flow'));
    fireEvent.click(screen.getByTestId('paypal-approve'));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Sent to Bob'));
    expect(mockClaims[0]).toMatchObject({ method: 'paypal', amount: 45.5, paypalOrderId: 'capture-123' });
  });

  test('with the switch on, the SEPA simulation sends a SEPA claim', async () => {
    mockDemosOn = true;
    asPayer();
    fireEvent.click(screen.getByText('Pay now'));
    fireEvent.click(screen.getByText('Future feature - Settlement Payment Flow'));
    await screen.findByText('SEPA Payment Demo');
    fireEvent.click(screen.getByText('SEPA Payment Demo'));
    fireEvent.click(screen.getByText('Complete SEPA'));
    await waitFor(() => expect(mockClaims).toHaveLength(1));
    expect(mockClaims[0]).toMatchObject({ method: 'sepa', amount: 20 });
  });
});
