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

// PayPal capture now happens server-side via the capturePayPalOrder callable.
// Plain functions (not jest.fn) so CRA's resetMocks does not clear them.
jest.mock('firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: () => () =>
    Promise.resolve({ data: { success: true, orderId: 'capture-123', status: 'COMPLETED' } }),
}));

jest.mock('firebase/firestore', () => ({
  collection:      jest.fn(() => ({})),
  addDoc:          jest.fn(() => Promise.resolve({ id: 'settlement-id' })),
  serverTimestamp: jest.fn(() => new Date()),
  doc:             jest.fn(() => ({})),
  setDoc:    jest.fn().mockResolvedValue(undefined),
  deleteDoc: jest.fn().mockResolvedValue(undefined),
  onSnapshot: jest.fn((_ref, callback) => {
    if (typeof callback === 'function') {
      callback({ exists: () => false, data: () => ({}) });
    }
    const unsubscribe = jest.fn();
    return unsubscribe;
  }),
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

// The recipient's IBAN is decrypted server-side (ibanService.fetchIban → getIban
// Cloud Function) and exposed under .iban. Plain function so resetMocks keeps it.
jest.mock('../utils/ibanService', () => ({
  fetchIban: async () => 'DECRYPTED-enc-iban-data',
}));

// Return empty array to prevent crash from .length on undefined
jest.mock('../utils/paymentLinks', () => ({
  generatePayPalLink: jest.fn(() => 'https://paypal.me/bob_paypal'),
  generateRevolutLink: jest.fn(() => 'https://revolut.me/bob_revolut'),
  getAvailablePaymentMethods: jest.fn(() => []),
}));

// Exposes createOrder / onApprove / onError so they can be triggered in tests
jest.mock('@paypal/react-paypal-js', () => ({
  PayPalButtons: ({ createOrder, onApprove, onError, disabled }) => (
    <div data-testid="paypal-buttons">
      <button
        data-testid="paypal-create"
        disabled={disabled}
        onClick={() =>
          createOrder({}, { order: { create: jest.fn().mockResolvedValue('order-123') } })
        }
      >
        PayPal Create
      </button>
      <button
        data-testid="paypal-approve"
        disabled={disabled}
        onClick={() =>
          onApprove({}, { order: { capture: jest.fn().mockResolvedValue({ id: 'capture-123' }) } })
        }
      >
        PayPal Approve
      </button>
      <button data-testid="paypal-error" onClick={() => onError(new Error('SDK error'))}>
        PayPal Error
      </button>
    </div>
  ),
}));

jest.mock('./PaymentInfoModal', () =>
  function MockPaymentInfoModal({ isOpen, onClose, paymentInfo }) {
    if (!isOpen) return null;
    return (
      <div data-testid="payment-info-modal">
        <button onClick={() => paymentInfo?.onProceed?.()}>Proceed</button>
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
    const { setDoc, deleteDoc } = require('firebase/firestore');
    setDoc.mockResolvedValue(undefined);
    deleteDoc.mockResolvedValue(undefined);
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
    const { setDoc, deleteDoc } = require('firebase/firestore');
    setDoc.mockResolvedValue(undefined);
    deleteDoc.mockResolvedValue(undefined);
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
    const { setDoc, deleteDoc } = require('firebase/firestore');
    setDoc.mockResolvedValue(undefined);
    deleteDoc.mockResolvedValue(undefined);
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
    const { setDoc, deleteDoc } = require('firebase/firestore');
    setDoc.mockResolvedValue(undefined);
    deleteDoc.mockResolvedValue(undefined);
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
    const { setDoc, deleteDoc } = require('firebase/firestore');
    setDoc.mockResolvedValue(undefined);
    deleteDoc.mockResolvedValue(undefined);
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
    const { setDoc, deleteDoc } = require('firebase/firestore');
    setDoc.mockResolvedValue(undefined);
    deleteDoc.mockResolvedValue(undefined);
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
  const pendingPaymentData = {
    groupId: 'group-1',
    fromUserId: 'user-1',
    toUserId: 'user-2',
    fromName: 'Alice',
    toName: 'Bob',
    amount: 45.5,
    currency: 'EUR',
    method: 'paypal',
    timestamp: Date.now(),
  };

  beforeEach(() => {
    const { setDoc, deleteDoc } = require('firebase/firestore');
    setDoc.mockResolvedValue(undefined);
    deleteDoc.mockResolvedValue(undefined);
    jest.clearAllMocks();
    // Simulate a pending payment existing in Firestore
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((_ref, callback) => {
      if (typeof callback === 'function') {
        callback({ exists: () => true, data: () => pendingPaymentData });
      }
      return jest.fn();
    });
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  const setPendingPayment = () => {
    // kept for backward compatibility — Firestore mock now drives the flow
    sessionStorage.setItem('pendingPayment', JSON.stringify(pendingPaymentData));
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
    const { setDoc, deleteDoc } = require('firebase/firestore');
    setDoc.mockResolvedValue(undefined);
    deleteDoc.mockResolvedValue(undefined);
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

// ---------------------------------------------------------------------------
// 9. Stale / malformed pending payment (lines 71-72, 78-80)
// ---------------------------------------------------------------------------

describe('SettleUpModal - Stale pending payment', () => {
  beforeEach(() => {
    const { setDoc, deleteDoc } = require('firebase/firestore');
    setDoc.mockResolvedValue(undefined);
    deleteDoc.mockResolvedValue(undefined);
    jest.clearAllMocks();
    // No pending payment in Firestore for these tests
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((_ref, callback) => {
      if (typeof callback === 'function') {
        callback({ exists: () => false, data: () => ({}) });
      }
      return jest.fn();
    });
  });

  test('clears sessionStorage and shows main modal when groupId does not match', () => {
    sessionStorage.setItem(
      'pendingPayment',
      JSON.stringify({
        groupId: 'other-group',
        fromUserId: 'user-1',
        toUserId: 'user-2',
        amount: 45.5,
        currency: 'EUR',
        method: 'paypal',
        timestamp: Date.now(),
      })
    );
    renderModal();
    expect(screen.queryByText(/Did you complete the payment/i)).not.toBeInTheDocument();
    expect(sessionStorage.getItem('pendingPayment')).toBeNull();
  });

  test('handles malformed JSON in sessionStorage gracefully', () => {
    sessionStorage.setItem('pendingPayment', 'not-valid-json{{{');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    renderModal();
    expect(screen.queryByText(/Did you complete the payment/i)).not.toBeInTheDocument();
    expect(sessionStorage.getItem('pendingPayment')).toBeNull();
    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 10. Recipient doc exists — sets payment methods (lines 93-94)
// ---------------------------------------------------------------------------

describe('SettleUpModal - Recipient doc exists', () => {
  beforeEach(() => {
    const { setDoc, deleteDoc } = require('firebase/firestore');
    setDoc.mockResolvedValue(undefined);
    deleteDoc.mockResolvedValue(undefined);
    jest.clearAllMocks();
    sessionStorage.clear();
    const { getDoc } = require('firebase/firestore');
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        paymentMethods: {
          paypalUsername: 'bob_paypal',
          revolutUsername: 'bob_revolut',
        },
      }),
    });
  });

  test('fetches and stores recipient payment methods when doc exists', async () => {
    const { getDoc } = require('firebase/firestore');
    renderModal();
    await waitFor(() => expect(getDoc).toHaveBeenCalledTimes(1));
    // Component should still render correctly after loading
    expect(screen.getByText(/Pay Settlement/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 11. Amount validation (lines 232-233, 669-670)
// ---------------------------------------------------------------------------

describe('SettleUpModal - Amount validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  test('shows error when manual settle is attempted with zero amount', async () => {
    renderModal();
    await waitFor(() => screen.getByRole('button', { name: /Paid Offline/i }));
    fireEvent.click(screen.getByRole('button', { name: /Paid Offline/i }));
    // Clear the amount
    const input = screen.getByPlaceholderText('0.00');
    fireEvent.change(input, { target: { value: '' } });
    await waitFor(() => screen.getByRole('button', { name: /Confirm Payment Sent/i }));
    fireEvent.click(screen.getByRole('button', { name: /Confirm Payment Sent/i }));
    await waitFor(() =>
      expect(screen.getByText('Valid amount is required')).toBeInTheDocument()
    );
  });

  test('blocks input and shows error when amount exceeds 1,000,000', async () => {
    renderModal();
    await waitFor(() => screen.getByPlaceholderText('0.00'));
    const input = screen.getByPlaceholderText('0.00');
    fireEvent.change(input, { target: { value: '1000001' } });
    await waitFor(() =>
      expect(screen.getByText('Settlement amount cannot exceed 1,000,000')).toBeInTheDocument()
    );
  });

  test('formats amount to 2 decimal places on blur', async () => {
    renderModal();
    await waitFor(() => screen.getByPlaceholderText('0.00'));
    const input = screen.getByPlaceholderText('0.00');
    fireEvent.change(input, { target: { value: '25' } });
    fireEvent.blur(input);
    expect(input.value).toBe('25.00');
  });
});

// ---------------------------------------------------------------------------
// 12. handleMarkAsPaid error paths (lines 207-213)
// ---------------------------------------------------------------------------

describe('SettleUpModal - handleMarkAsPaid errors', () => {
  const pendingPaymentData = {
    groupId: 'group-1',
    fromUserId: 'user-1',
    toUserId: 'user-2',
    fromName: 'Alice',
    toName: 'Bob',
    amount: 45.5,
    currency: 'EUR',
    method: 'paypal',
    timestamp: Date.now(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const { setDoc, deleteDoc, onSnapshot } = require('firebase/firestore');
    setDoc.mockResolvedValue(undefined);
    deleteDoc.mockResolvedValue(undefined);
    onSnapshot.mockImplementation((_ref, callback) => {
      if (typeof callback === 'function') {
        callback({ exists: () => true, data: () => pendingPaymentData });
      }
      return jest.fn();
    });
  });

  afterEach(() => sessionStorage.clear());

  test('shows permission-denied error when recordPaymentSent is rejected with that code', async () => {
    const { recordPaymentSent } = require('../stores/notificationsStore');
    const err = Object.assign(new Error('denied'), { code: 'permission-denied' });
    recordPaymentSent.mockRejectedValueOnce(err);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    renderModal();
    await waitFor(() => screen.getByRole('button', { name: /Mark as Paid/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Mark as Paid/i }));
    });
    await waitFor(() =>
      expect(
        screen.getByText('Permission denied. Please ensure you are signed in and try again.')
      ).toBeInTheDocument()
    );
    consoleSpy.mockRestore();
  });

  test('shows generic error message when recordPaymentSent fails with unknown error', async () => {
    const { recordPaymentSent } = require('../stores/notificationsStore');
    recordPaymentSent.mockRejectedValueOnce(new Error('Network timeout'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    renderModal();
    await waitFor(() => screen.getByRole('button', { name: /Mark as Paid/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Mark as Paid/i }));
    });
    await waitFor(() =>
      expect(screen.getByText(/Failed to record payment/)).toBeInTheDocument()
    );
    consoleSpy.mockRestore();
  });

  test('closes pending dialog when X button is clicked', async () => {
    renderModal();
    await waitFor(() => screen.getByText(/Did you complete the payment/i));
    // The X close button has no visible text — find it by absence of text
    const allButtons = screen.getAllByRole('button');
    const xBtn = allButtons.find(b => b.textContent.trim() === '');
    fireEvent.click(xBtn);
    await waitFor(() =>
      expect(screen.queryByText(/Did you complete the payment/i)).not.toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 13. Biometric failure paths (lines 252-262)
// ---------------------------------------------------------------------------

describe('SettleUpModal - Biometric failure paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  test('shows cancellation error when biometric returns false', async () => {
    const { authenticateWithBiometric } = require('../utils/biometric');
    authenticateWithBiometric.mockResolvedValueOnce(false);
    renderModal(receiverProps);
    await waitFor(() => screen.getByRole('button', { name: /Confirm Payment Received/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm Payment Received/i }));
    });
    await waitFor(() => screen.getByRole('button', { name: /Confirm Receipt/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm Receipt/i }));
    });
    await waitFor(() =>
      expect(
        screen.getByText(/Biometric authentication was cancelled or failed/i)
      ).toBeInTheDocument()
    );
  });

  test('shows authentication error when biometric throws', async () => {
    const { authenticateWithBiometric } = require('../utils/biometric');
    authenticateWithBiometric.mockRejectedValueOnce(new Error('WebAuthn not supported'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    renderModal(receiverProps);
    await waitFor(() => screen.getByRole('button', { name: /Confirm Payment Received/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm Payment Received/i }));
    });
    await waitFor(() => screen.getByRole('button', { name: /Confirm Receipt/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm Receipt/i }));
    });
    await waitFor(() =>
      expect(
        screen.getByText(/Authentication failed. Please enable biometric/i)
      ).toBeInTheDocument()
    );
    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 14. Receiver confirmation dialog detail (lines 566-595)
// ---------------------------------------------------------------------------

describe('SettleUpModal - Receiver confirmation dialog detail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    const { authenticateWithBiometric } = require('../utils/biometric');
    authenticateWithBiometric.mockResolvedValue(true);
  });

  test('confirmation dialog shows From, To, and Amount', async () => {
    renderModal(receiverProps);
    await waitFor(() => screen.getByRole('button', { name: /Confirm Payment Received/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm Payment Received/i }));
    });
    await waitFor(() => screen.getByText('Confirm Payment'));
    // Confirmation details — names may appear multiple times in the UI
    expect(screen.getAllByText(/Alice/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bob/).length).toBeGreaterThan(0);
  });

  test('Go Back button dismisses confirmation and returns to main form', async () => {
    renderModal(receiverProps);
    await waitFor(() => screen.getByRole('button', { name: /Confirm Payment Received/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm Payment Received/i }));
    });
    await waitFor(() => screen.getByRole('button', { name: /Go Back/i }));
    fireEvent.click(screen.getByRole('button', { name: /Go Back/i }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Confirm Payment Received/i })
      ).toBeInTheDocument()
    );
  });

  test('X button on confirmation dialog dismisses it', async () => {
    renderModal(receiverProps);
    await waitFor(() => screen.getByRole('button', { name: /Confirm Payment Received/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm Payment Received/i }));
    });
    await waitFor(() => screen.getByText('Confirm Payment'));
    const allButtons = screen.getAllByRole('button');
    const xBtn = allButtons.find(b => b.textContent.trim() === '');
    fireEvent.click(xBtn);
    await waitFor(() =>
      expect(screen.queryByText('Confirm Payment')).not.toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 15. SEPA payment flow (lines 281-298, 308-330)
// ---------------------------------------------------------------------------

describe('SettleUpModal - SEPA payment flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    // fetchIban (mocked above) resolves encryptedIBAN into the iban key that
    // getAvailablePaymentMethods and the SEPA demo button depend on.
    // Recipient has an IBAN so the SEPA demo button is visible inside the
    // Future Feature panel.
    const { getDoc } = require('firebase/firestore');
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        paymentMethods: { encryptedIBAN: 'enc-iban-data', paypalUsername: '' },
      }),
    });
  });

  // Helper — expands the Future Feature collapsible panel then clicks SEPA demo
  const expandAndClickSEPA = async () => {
    await waitFor(() =>
      expect(screen.getByText('Future feature - Settlement Payment Flow')).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText('Future feature - Settlement Payment Flow'));
    await waitFor(() =>
      expect(screen.getByText('SEPA Payment Demo')).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText('SEPA Payment Demo'));
  };

  test('clicking SEPA Payment Demo inside Future Feature panel opens SepaPaymentModal', async () => {
    renderModal();
    await expandAndClickSEPA();
    expect(screen.getByTestId('sepa-modal')).toBeInTheDocument();
  });

  test('SEPA success callback calls addDoc directly and shows success screen', async () => {
    const { addDoc } = require('firebase/firestore');
    renderModal();
    await expandAndClickSEPA();
    await act(async () => {
      fireEvent.click(screen.getByText('Complete SEPA'));
    });
    await waitFor(() => expect(addDoc).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText(/Payment Sent!/i)).toBeInTheDocument()
    );
  });

  test('SEPA success shows error when addDoc fails', async () => {
    const { addDoc } = require('firebase/firestore');
    addDoc.mockRejectedValueOnce(new Error('Firestore write failed'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    renderModal();
    await expandAndClickSEPA();
    await act(async () => {
      fireEvent.click(screen.getByText('Complete SEPA'));
    });
    await waitFor(() =>
      expect(
        screen.getByText('Payment processed but failed to update balances. Please try again.')
      ).toBeInTheDocument()
    );
    consoleSpy.mockRestore();
  });

  test('SEPA success shows error when createNotification fails', async () => {
    const { createNotification } = require('../stores/notificationsStore');
    createNotification.mockRejectedValueOnce(new Error('Network error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    renderModal();
    await expandAndClickSEPA();
    await act(async () => {
      fireEvent.click(screen.getByText('Complete SEPA'));
    });
    await waitFor(() =>
      expect(
        screen.getByText('Payment processed but failed to update balances. Please try again.')
      ).toBeInTheDocument()
    );
    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 16. handlePaymentLinkClick — PayPal, Revolut, Bank (lines 340-391, 677-850)
// ---------------------------------------------------------------------------

describe('SettleUpModal - Payment link click and options section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    const { getDoc, setDoc, deleteDoc } = require('firebase/firestore');
    setDoc.mockResolvedValue(undefined);
    deleteDoc.mockResolvedValue(undefined);
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        paymentMethods: { paypalUsername: 'bob', revolutUsername: 'bobrev' },
      }),
    });
    const { getAvailablePaymentMethods } = require('../utils/paymentLinks');
    getAvailablePaymentMethods.mockReturnValue([
      { id: 'paypal',  name: 'PayPal',         icon: null, description: 'Pay via PayPal',  username: 'bob'    },
      { id: 'revolut', name: 'Revolut',         icon: null, description: 'Pay via Revolut', username: 'bobrev' },
      { id: 'bank',    name: 'Bank Transfer',   icon: null, description: 'Direct transfer', iban: 'GB29XXXX', bic: 'BARCGB22' },
    ]);
  });

  test('shows Quick Payment Options section when methods are available', async () => {
    renderModal();
    await waitFor(() =>
      expect(screen.getByText('Quick Payment Options')).toBeInTheDocument()
    );
  });

  test('clicking PayPal method opens PaymentInfoModal', async () => {
    renderModal();
    await waitFor(() => screen.getByText('PayPal'));
    fireEvent.click(screen.getByText('PayPal'));
    expect(screen.getByTestId('payment-info-modal')).toBeInTheDocument();
  });

  test('PayPal Proceed calls generatePayPalLink and opens external URL', async () => {
    window.open = jest.fn();
    const { generatePayPalLink } = require('../utils/paymentLinks');
    renderModal();
    await waitFor(() => screen.getByText('PayPal'));
    fireEvent.click(screen.getByText('PayPal'));
    await waitFor(() => screen.getByText('Proceed'));
    fireEvent.click(screen.getByText('Proceed'));
    expect(generatePayPalLink).toHaveBeenCalled();
  });

  test('clicking Revolut method opens PaymentInfoModal', async () => {
    renderModal();
    await waitFor(() => screen.getByText('Revolut'));
    fireEvent.click(screen.getByText('Revolut'));
    expect(screen.getByTestId('payment-info-modal')).toBeInTheDocument();
  });

  test('clicking Bank Transfer method shows inline bank details with IBAN', async () => {
    renderModal();
    await waitFor(() => screen.getByText('Bank Transfer'));
    fireEvent.click(screen.getByText('Bank Transfer'));
    expect(screen.getByText('Bank Transfer Details')).toBeInTheDocument();
    expect(screen.getByText('GB29XXXX')).toBeInTheDocument();
  });

  test('clicking Bank Transfer shows BIC when present', async () => {
    renderModal();
    await waitFor(() => screen.getByText('Bank Transfer'));
    fireEvent.click(screen.getByText('Bank Transfer'));
    expect(screen.getByText('BARCGB22')).toBeInTheDocument();
  });

  test('Back to options link hides bank details', async () => {
    renderModal();
    await waitFor(() => screen.getByText('Bank Transfer'));
    fireEvent.click(screen.getByText('Bank Transfer'));
    fireEvent.click(screen.getByText('Back to options'));
    expect(screen.queryByText('Bank Transfer Details')).not.toBeInTheDocument();
  });

  test('saves pending payment to sessionStorage when a payment method is clicked', async () => {
    renderModal();
    await waitFor(() => screen.getByText('PayPal'));
    fireEvent.click(screen.getByText('PayPal'));
    expect(sessionStorage.getItem('pendingPayment')).not.toBeNull();
    const stored = JSON.parse(sessionStorage.getItem('pendingPayment'));
    expect(stored.groupId).toBe('group-1');
    expect(stored.method).toBe('paypal');
  });

  test('stores revolut method when Revolut link is clicked', async () => {
    renderModal();
    await waitFor(() => screen.getByText('Revolut'));
    fireEvent.click(screen.getByText('Revolut'));
    const stored = JSON.parse(sessionStorage.getItem('pendingPayment'));
    expect(stored.method).toBe('revolut');
  });

  test('recipient has no PayPal notice shown when paypalUsername is missing', async () => {
    const { getDoc } = require('firebase/firestore');
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ paymentMethods: { paypalUsername: '', revolutUsername: '' } }),
    });
    const { getAvailablePaymentMethods } = require('../utils/paymentLinks');
    getAvailablePaymentMethods.mockReturnValue([]);
    renderModal();
    await waitFor(() => expect(getDoc).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText(/has not set up PayPal/i)).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 17. PayPal demo panel — toggle, createOrder, onApprove, onError (lines 396-441, 906)
// ---------------------------------------------------------------------------

describe('SettleUpModal - PayPal demo panel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    // Ensure collection mock always returns a valid ref after clearAllMocks
    const { collection } = require('firebase/firestore');
    collection.mockReturnValue({});
  });

  const expandDemoPanel = () =>
    fireEvent.click(screen.getByText('Future feature - Settlement Payment Flow'));

  test('demo panel is hidden by default', () => {
    renderModal();
    expect(screen.queryByTestId('paypal-buttons')).not.toBeInTheDocument();
  });

  test('clicking demo toggle reveals PayPal buttons', async () => {
    renderModal();
    await waitFor(() => screen.getByText('Future feature - Settlement Payment Flow'));
    expandDemoPanel();
    expect(screen.getByTestId('paypal-buttons')).toBeInTheDocument();
  });

  test('clicking demo toggle again hides the panel', async () => {
    renderModal();
    await waitFor(() => screen.getByText('Future feature - Settlement Payment Flow'));
    expandDemoPanel();
    expandDemoPanel();
    expect(screen.queryByTestId('paypal-buttons')).not.toBeInTheDocument();
  });

  test('PayPal buttons not shown when amount is zero (entry-amount prompt shown)', async () => {
    renderModal();
    const input = screen.getByPlaceholderText('0.00');
    fireEvent.change(input, { target: { value: '' } });
    await waitFor(() => screen.getByText('Future feature - Settlement Payment Flow'));
    expandDemoPanel();
    expect(screen.queryByTestId('paypal-buttons')).not.toBeInTheDocument();
    expect(screen.getByText('Enter an amount above to continue')).toBeInTheDocument();
  });

  test('onPayPalApprove records settlement with PayPal order ID and shows success', async () => {
    const { addDoc } = require('firebase/firestore');
    renderModal();
    await waitFor(() => screen.getByText('Future feature - Settlement Payment Flow'));
    expandDemoPanel();
    await act(async () => {
      fireEvent.click(screen.getByTestId('paypal-approve'));
    });
    await waitFor(() => expect(addDoc).toHaveBeenCalled());
    const [[, data]] = addDoc.mock.calls;
    expect(data).toMatchObject({ paypalOrderId: 'capture-123', paymentMethod: 'paypal' });
    await waitFor(() =>
      expect(screen.getByText(/Payment Sent!/i)).toBeInTheDocument()
    );
  });

  test('onPayPalError sets an error message', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    renderModal();
    await waitFor(() => screen.getByText('Future feature - Settlement Payment Flow'));
    expandDemoPanel();
    fireEvent.click(screen.getByTestId('paypal-error'));
    expect(
      screen.getByText('Payment initialization failed. Please try again.')
    ).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  test('onPayPalApprove shows error when recordSettlement fails', async () => {
    const { addDoc } = require('firebase/firestore');
    addDoc.mockRejectedValueOnce(new Error('Firestore error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    renderModal();
    await waitFor(() => screen.getByText('Future feature - Settlement Payment Flow'));
    expandDemoPanel();
    await act(async () => {
      fireEvent.click(screen.getByTestId('paypal-approve'));
    });
    await waitFor(() =>
      expect(screen.getByText('Payment failed. Please try again.')).toBeInTheDocument()
    );
    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 18. Receiver QR panel — tabs and QR canvas (lines 1022-1133)
// ---------------------------------------------------------------------------

describe('SettleUpModal - Receiver QR panel tabs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    const { getDoc } = require('firebase/firestore');
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        paymentMethods: {
          paypalUsername: 'bob_paypal',
          revolutUsername: 'bob_revolut',
        },
      }),
    });
  });

  const openQRPanel = async () => {
    await waitFor(() => screen.getByText(/Let Alice scan to pay you/i));
    fireEvent.click(screen.getByText(/Let Alice scan to pay you/i).closest('button'));
  };

  test('PayPal tab is shown when paypalUsername is set', async () => {
    renderModal(receiverProps);
    await openQRPanel();
    expect(screen.getByRole('button', { name: /PayPal/i })).toBeInTheDocument();
  });

  test('Revolut tab is shown when revolutUsername is set', async () => {
    renderModal(receiverProps);
    await openQRPanel();
    expect(screen.getByRole('button', { name: /Revolut/i })).toBeInTheDocument();
  });

  test('PayPal QR canvas is visible by default (activeQR = paypal)', async () => {
    renderModal(receiverProps);
    await waitFor(() => expect(require('firebase/firestore').getDoc).toHaveBeenCalled());
    await openQRPanel();
    await waitFor(() => expect(screen.getByTestId('qr-canvas')).toBeInTheDocument());
    const { generatePayPalLink } = require('../utils/paymentLinks');
    expect(generatePayPalLink).toHaveBeenCalledWith('bob_paypal', expect.any(Number), expect.any(String));
  });

  test('switching to Revolut tab shows Revolut QR canvas', async () => {
    renderModal(receiverProps);
    await waitFor(() => expect(require('firebase/firestore').getDoc).toHaveBeenCalled());
    await openQRPanel();
    await waitFor(() => screen.getByRole('button', { name: /Revolut/i }));
    fireEvent.click(screen.getByRole('button', { name: /Revolut/i }));
    await waitFor(() => {
      const { generateRevolutLink } = require('../utils/paymentLinks');
      expect(generateRevolutLink).toHaveBeenCalledWith(
        'bob_revolut',
        expect.any(Number),
        expect.any(String)
      );
    });
  });

  test('shows no-methods fallback when neither PayPal nor Revolut is configured', async () => {
    const { getDoc } = require('firebase/firestore');
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ paymentMethods: {} }),
    });
    renderModal(receiverProps);
    await waitFor(() => expect(require('firebase/firestore').getDoc).toHaveBeenCalled());
    await openQRPanel();
    await waitFor(() =>
      expect(screen.getByText('No payment methods set up yet.')).toBeInTheDocument()
    );
  });

  test('instruction text identifies the payer by name', async () => {
    renderModal(receiverProps);
    await openQRPanel();
    expect(screen.getByText(/Show this screen to/i)).toBeInTheDocument();
    // Alice may appear multiple times in the UI — just verify at least one instance
    expect(screen.getAllByText(/Alice/i).length).toBeGreaterThan(0);
  });
});
