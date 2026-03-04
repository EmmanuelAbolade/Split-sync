// src/components/SettleUpModal.test.jsx
// Tests for SettleUpModal component
// Covers: rendering, payer view, receiver view, manual settlement,
//         pending payment confirmation, payment success, and error handling

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import SettleUpModal from './SettleUpModal';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../services/firebase', () => ({ db: {} }));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({})),
  addDoc: jest.fn(() => Promise.resolve({ id: 'settlement-id' })),
  serverTimestamp: jest.fn(() => new Date()),
  doc: jest.fn(() => ({})),
  getDoc: jest.fn(() =>
    Promise.resolve({
      exists: () => true,
      data: () => ({
        paymentMethods: {
          paypalUsername: 'bob_paypal',
          revolutUsername: 'bob_revolut',
        },
      }),
    })
  ),
}));

jest.mock('../stores/notificationsStore', () => ({
  createNotification: jest.fn(() => Promise.resolve()),
  recordPaymentSent: jest.fn(() => Promise.resolve()),
}));

jest.mock('../utils/biometric', () => ({
  authenticateWithBiometric: jest.fn(() => Promise.resolve(true)),
}));

// Return empty array to prevent crash from .length on undefined
jest.mock('../utils/paymentLinks', () => ({
  generatePayPalLink: jest.fn(() => 'https://paypal.me/bob_paypal'),
  generateRevolutLink: jest.fn(() => 'https://revolut.me/bob_revolut'),
  getAvailablePaymentMethods: jest.fn(() => []),
}));

jest.mock('@paypal/react-paypal-js', () => ({
  PayPalButtons: () => <div data-testid="paypal-buttons">PayPal Buttons</div>,
}));

jest.mock('./PaymentInfoModal', () =>
  function MockPaymentInfoModal({ isOpen, onClose }) {
    if (!isOpen) return null;
    return (
      <div data-testid="payment-info-modal">
        <button onClick={onClose}>Close Payment Info</button>
      </div>
    );
  }
);

jest.mock('./SepaPaymentModal', () =>
  function MockSepaPaymentModal({ isOpen, onClose, onPaymentSuccess }) {
    if (!isOpen) return null;
    return (
      <div data-testid="sepa-modal">
        <button onClick={onClose}>Close SEPA</button>
        <button
          onClick={() =>
            onPaymentSuccess({ amount: 50, reference: 'REF123', paymentId: 'PID123' })
          }
        >
          Complete SEPA
        </button>
      </div>
    );
  }
);

jest.mock('./QRCodeCanvas', () =>
  function MockQRCodeCanvas({ value }) {
    return <canvas data-testid="qr-canvas" data-value={value} />;
  }
);

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockGroup = {
  id: 'group-1',
  name: 'Trip to Lisbon',
  currency: 'EUR',
  members: [
    { userId: 'user-1', name: 'Alice', email: 'alice@test.com' },
    { userId: 'user-2', name: 'Bob', email: 'bob@test.com' },
  ],
};

const mockSettlement = {
  from: 'user-1',
  to: 'user-2',
  amount: 45.5,
};

// Alice is the current user (payer)
const payerProps = {
  isOpen: true,
  onClose: jest.fn(),
  settlement: mockSettlement,
  group: mockGroup,
  currentUserId: 'user-1',
};

// Bob is the current user (receiver)
const receiverProps = {
  ...payerProps,
  onClose: jest.fn(),
  currentUserId: 'user-2',
};

const renderModal = (props = {}) =>
  render(<SettleUpModal {...payerProps} {...props} />);

// ---------------------------------------------------------------------------
// 1. Closed state
// ---------------------------------------------------------------------------

describe('SettleUpModal - Closed State', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  test('renders nothing when isOpen is false', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByText(/Settle Up/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Payer view
// ---------------------------------------------------------------------------

describe('SettleUpModal - Payer View', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  test('renders the Pay Settlement heading for payer', async () => {
    renderModal();
    await waitFor(() =>
      expect(screen.getByText(/Pay Settlement/i)).toBeInTheDocument()
    );
  });

  test('renders the settlement amount pre-filled', async () => {
    renderModal();
    await waitFor(() =>
      expect(screen.getByDisplayValue('45.50')).toBeInTheDocument()
    );
  });

  test('renders payer and receiver member names', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getAllByText(/Alice/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Bob/i).length).toBeGreaterThan(0);
    });
  });

  test('calls onClose when Cancel is clicked', async () => {
    renderModal();
    await waitFor(() => screen.getByRole('button', { name: /cancel/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(payerProps.onClose).toHaveBeenCalledTimes(1);
  });

  test('renders Confirm Payment Sent button after selecting Paid Offline', async () => {
    renderModal();
    // Default tab is PayPal — switch to Paid Offline to show the manual confirm button
    await waitFor(() => screen.getByRole('button', { name: /Paid Offline/i }));
    fireEvent.click(screen.getByRole('button', { name: /Paid Offline/i }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Confirm Payment Sent/i })
      ).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Receiver view
// ---------------------------------------------------------------------------

describe('SettleUpModal - Receiver View', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  test('renders Mark as Received heading for receiver', async () => {
    renderModal(receiverProps);
    await waitFor(() =>
      expect(screen.getByText(/Mark as Received/i)).toBeInTheDocument()
    );
  });

  test('renders Confirm Payment Received button for receiver', async () => {
    renderModal(receiverProps);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Confirm Payment Received/i })
      ).toBeInTheDocument()
    );
  });

  test('renders QR toggle button for receiver', async () => {
    renderModal(receiverProps);
    await waitFor(() =>
      expect(screen.getByText(/Let Alice scan to pay you/i)).toBeInTheDocument()
    );
  });

  test('reveals QR panel text when toggle button is clicked', async () => {
    renderModal(receiverProps);
    await waitFor(() => screen.getByText(/Let Alice scan to pay you/i));

    // Initially shows "Tap to show" text
    expect(screen.getByText(/Tap to show PayPal or Revolut QR code/i)).toBeInTheDocument();

    // Click to reveal
    fireEvent.click(
      screen.getByText(/Let Alice scan to pay you/i).closest('button')
    );

    await waitFor(() =>
      expect(screen.getByText(/Tap to hide QR code/i)).toBeInTheDocument()
    );
  });

  test('hides QR panel when toggle button is clicked a second time', async () => {
    renderModal(receiverProps);
    await waitFor(() => screen.getByText(/Let Alice scan to pay you/i));
    const toggleBtn = screen
      .getByText(/Let Alice scan to pay you/i)
      .closest('button');

    fireEvent.click(toggleBtn); // show
    await waitFor(() => screen.getByText(/Tap to hide QR code/i));

    fireEvent.click(toggleBtn); // hide
    await waitFor(() =>
      expect(
        screen.queryByText(/Tap to hide QR code/i)
      ).not.toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Amount editing
// ---------------------------------------------------------------------------

describe('SettleUpModal - Amount Editing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  test('allows the amount to be changed', async () => {
    renderModal();
    await waitFor(() => screen.getByDisplayValue('45.50'));
    const amountInput = screen.getByDisplayValue('45.50');
    fireEvent.change(amountInput, { target: { value: '60' } });
    expect(amountInput).toHaveValue(60);
  });
});

// ---------------------------------------------------------------------------
// 5. Manual settlement — payer
// ---------------------------------------------------------------------------

describe('SettleUpModal - Manual Settlement (Payer)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  test('calls addDoc and shows success screen when payer confirms payment sent', async () => {
    const { addDoc } = require('firebase/firestore');
    renderModal();
    // Switch to Paid Offline mode to reveal the manual confirm button
    await waitFor(() => screen.getByRole('button', { name: /Paid Offline/i }));
    fireEvent.click(screen.getByRole('button', { name: /Paid Offline/i }));
    await waitFor(() =>
      screen.getByRole('button', { name: /Confirm Payment Sent/i })
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /Confirm Payment Sent/i })
      );
    });

    await waitFor(() => expect(addDoc).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByText(/Payment Sent!/i)).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 6. Manual settlement — receiver
// ---------------------------------------------------------------------------

describe('SettleUpModal - Manual Settlement (Receiver)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    // Ensure biometric mock always resolves true for this suite
    const { authenticateWithBiometric } = require('../utils/biometric');
    authenticateWithBiometric.mockResolvedValue(true);
  });

  test('shows confirmation dialog on first click', async () => {
    renderModal(receiverProps);
    await waitFor(() =>
      screen.getByRole('button', { name: /Confirm Payment Received/i })
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /Confirm Payment Received/i })
      );
    });

    // Confirmation dialog with Confirm Receipt button appears
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Confirm Receipt/i })
      ).toBeInTheDocument()
    );
  });

  test('calls addDoc after receiver clicks Confirm Receipt', async () => {
    const { addDoc } = require('firebase/firestore');
    renderModal(receiverProps);
    await waitFor(() =>
      screen.getByRole('button', { name: /Confirm Payment Received/i })
    );

    // First click — shows confirmation dialog
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /Confirm Payment Received/i })
      );
    });

    await waitFor(() =>
      screen.getByRole('button', { name: /Confirm Receipt/i })
    );

    // Second click — triggers biometric then records
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm Receipt/i }));
    });

    await waitFor(() => expect(addDoc).toHaveBeenCalledTimes(1), {
      timeout: 3000,
    });
  });
});

// ---------------------------------------------------------------------------
// 7. Pending payment confirmation flow
// ---------------------------------------------------------------------------

describe('SettleUpModal - Pending Payment Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  const setPendingPayment = () => {
    sessionStorage.setItem(
      'pendingPayment',
      JSON.stringify({
        groupId: 'group-1',
        fromUserId: 'user-1',
        toUserId: 'user-2',
        fromName: 'Alice',
        toName: 'Bob',
        amount: 45.5,
        currency: 'EUR',
        method: 'paypal',
        timestamp: Date.now(),
      })
    );
  };

  test('shows pending confirmation dialog when a matching pending payment exists', async () => {
    setPendingPayment();
    renderModal();
    await waitFor(() =>
      expect(
        screen.getByText(/Did you complete the payment/i)
      ).toBeInTheDocument()
    );
  });

  test('shows Not Yet and Mark as Paid buttons in pending dialog', async () => {
    setPendingPayment();
    renderModal();
    await waitFor(() => screen.getByText(/Did you complete the payment/i));
    expect(
      screen.getByRole('button', { name: /Not Yet/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Mark as Paid/i })
    ).toBeInTheDocument();
  });

  test('dismisses pending dialog when Not Yet is clicked', async () => {
    setPendingPayment();
    renderModal();
    await waitFor(() => screen.getByText(/Did you complete the payment/i));
    fireEvent.click(screen.getByRole('button', { name: /Not Yet/i }));
    await waitFor(() =>
      expect(
        screen.queryByText(/Did you complete the payment/i)
      ).not.toBeInTheDocument()
    );
  });

  test('calls recordPaymentSent and shows success when Mark as Paid is clicked', async () => {
    const { recordPaymentSent } = require('../stores/notificationsStore');
    setPendingPayment();
    renderModal();
    await waitFor(() => screen.getByText(/Did you complete the payment/i));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Mark as Paid/i }));
    });

    await waitFor(() =>
      expect(recordPaymentSent).toHaveBeenCalledTimes(1)
    );
    // Success screen shows Payment Sent! heading
    await waitFor(() =>
      expect(screen.getByText(/Payment Sent!/i)).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 8. Error handling
// ---------------------------------------------------------------------------

describe('SettleUpModal - Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  test('shows error message when addDoc fails during settlement', async () => {
    const { addDoc } = require('firebase/firestore');
    addDoc.mockRejectedValueOnce(new Error('Firestore write failed'));

    renderModal();
    // Switch to Paid Offline mode to reveal the manual confirm button
    await waitFor(() => screen.getByRole('button', { name: /Paid Offline/i }));
    fireEvent.click(screen.getByRole('button', { name: /Paid Offline/i }));
    await waitFor(() =>
      screen.getByRole('button', { name: /Confirm Payment Sent/i })
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /Confirm Payment Sent/i })
      );
    });

    await waitFor(() =>
      expect(
        screen.getByText(/failed to record settlement/i)
      ).toBeInTheDocument()
    );
  });
});
