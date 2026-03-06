// src/components/SepaPaymentModal.test.jsx
// Tests for SepaPaymentModal - loading state, confirm step, processing step,
// success step, error step, IBAN missing states, close behaviour

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetDoc = jest.fn();
const mockDoc    = jest.fn();
jest.mock('firebase/firestore', () => ({
  doc:    (...a) => mockDoc(...a),
  getDoc: (...a) => mockGetDoc(...a),
}));
jest.mock('../services/firebase', () => ({ db: {} }));

// sepaPayment utils
const mockProcessSepaPayment      = jest.fn();
const mockGeneratePaymentReference = jest.fn(() => 'REF-123');
const mockFormatIBAN              = jest.fn(v => v);
const mockMaskIBAN                = jest.fn(v => `****${v.slice(-4)}`);
const mockValidatePaymentAmount   = jest.fn(() => ({ valid: true }));
const mockCreatePaymentDescription = jest.fn(() => 'SplitSync payment');
const mockCalculatePaymentFee     = jest.fn(() => 0);

jest.mock('../utils/sepaPayment', () => ({
  processSepaPayment:       (...a) => mockProcessSepaPayment(...a),
  generatePaymentReference: (...a) => mockGeneratePaymentReference(...a),
  formatIBAN:               (...a) => mockFormatIBAN(...a),
  maskIBAN:                 (...a) => mockMaskIBAN(...a),
  validatePaymentAmount:    (...a) => mockValidatePaymentAmount(...a),
  createPaymentDescription: (...a) => mockCreatePaymentDescription(...a),
  calculatePaymentFee:      (...a) => mockCalculatePaymentFee(...a),
}));

// encryption
const mockDecryptData = jest.fn(v => `DECRYPTED-${v}`);
jest.mock('../utils/encryption', () => ({
  decryptData: (...a) => mockDecryptData(...a),
}));

// biometric auth
const mockAuthenticateWithBiometric = jest.fn();
jest.mock('../utils/biometric', () => ({
  authenticateWithBiometric: (...a) => mockAuthenticateWithBiometric(...a),
}));

import SepaPaymentModal from './SepaPaymentModal';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockPayment = {
  amount:    30,
  groupName: 'Weekend Trip',
  groupId:   'group-123',
  fromUser:  { id: 'user-123', name: 'Alice' },
  toUser:    { id: 'user-456', name: 'Bob'   },
  toUserPaymentMethods: {
    encryptedIBAN: 'encrypted-bob-iban',
  },
};

const mockCurrentUser = { uid: 'user-123' };

const defaultProps = {
  isOpen:           true,
  onClose:          jest.fn(),
  payment:          mockPayment,
  currentUser:      mockCurrentUser,
  onPaymentSuccess: jest.fn(),
};

// User doc with IBAN
const mockUserDocWithIBAN = {
  exists: () => true,
  data:   () => ({ paymentMethods: { encryptedIBAN: 'encrypted-alice-iban' } }),
};

// User doc without IBAN
const mockUserDocNoIBAN = {
  exists: () => true,
  data:   () => ({ paymentMethods: null }),
};

beforeEach(() => {
  jest.clearAllMocks();
  // Restore implementations cleared by clearAllMocks
  mockDecryptData.mockImplementation(v => `DECRYPTED-${v}`);
  mockCalculatePaymentFee.mockReturnValue(0);
  mockValidatePaymentAmount.mockReturnValue({ valid: true });
  mockGeneratePaymentReference.mockReturnValue('REF-123');
  mockCreatePaymentDescription.mockReturnValue('SplitSync payment');
  mockMaskIBAN.mockImplementation(v => `****${v.slice(-4)}`);
});

// ---------------------------------------------------------------------------
// 1. Visibility
// ---------------------------------------------------------------------------

describe('SepaPaymentModal - Visibility', () => {

  test('Does not render when isOpen is false', () => {
    mockGetDoc.mockResolvedValue(mockUserDocWithIBAN);
    render(<SepaPaymentModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('SEPA Payment')).not.toBeInTheDocument();
  });

  test('Does not render when payment is null', () => {
    mockGetDoc.mockResolvedValue(mockUserDocWithIBAN);
    render(<SepaPaymentModal {...defaultProps} payment={null} />);
    expect(screen.queryByText('SEPA Payment')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Loading state
// ---------------------------------------------------------------------------

describe('SepaPaymentModal - Loading state', () => {

  test('Shows loading payment information while fetching', () => {
    // Never resolves — keeps loading state
    mockGetDoc.mockReturnValue(new Promise(() => {}));
    render(<SepaPaymentModal {...defaultProps} />);
    expect(screen.getByText('Loading payment information...')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Confirm step
// ---------------------------------------------------------------------------

describe('SepaPaymentModal - Confirm step', () => {

  beforeEach(() => {
    mockGetDoc.mockResolvedValue(mockUserDocWithIBAN);
  });

  test('Shows SEPA Payment heading', async () => {
    render(<SepaPaymentModal {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getByText('SEPA Payment')).toBeInTheDocument()
    );
  });

  test('Shows Demo Mode notice', async () => {
    render(<SepaPaymentModal {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getByText('Demo Mode')).toBeInTheDocument()
    );
  });

  test('Shows From label with sender name', async () => {
    render(<SepaPaymentModal {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getByText('Alice')).toBeInTheDocument()
    );
  });

  test('Shows To label with recipient name', async () => {
    render(<SepaPaymentModal {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getByText('Bob')).toBeInTheDocument()
    );
  });

  test('Shows payment amount', async () => {
    render(<SepaPaymentModal {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getAllByText(/30\.00/).length).toBeGreaterThan(0)
    );
  });

  test('Shows Payment Fee as FREE', async () => {
    render(<SepaPaymentModal {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getByText('FREE')).toBeInTheDocument()
    );
  });

  test('Shows Secure Payment notice', async () => {
    render(<SepaPaymentModal {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getByText('Secure Payment')).toBeInTheDocument()
    );
  });

  test('Shows Cancel button', async () => {
    render(<SepaPaymentModal {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    );
  });

  test('Shows Confirm Payment button when IBANs are available', async () => {
    render(<SepaPaymentModal {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getByText('Confirm Payment')).toBeInTheDocument()
    );
  });

  test('Shows IBAN not set warning when sender has no IBAN', async () => {
    mockGetDoc.mockResolvedValue(mockUserDocNoIBAN);
    render(<SepaPaymentModal {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getByText(/Set up your IBAN in Profile Settings first/)).toBeInTheDocument()
    );
  });

  test('Shows recipient IBAN not set warning when toUser has no IBAN', async () => {
    mockGetDoc.mockResolvedValue(mockUserDocWithIBAN);
    const paymentNoRecipientIBAN = {
      ...mockPayment,
      toUserPaymentMethods: null,
    };
    render(<SepaPaymentModal {...defaultProps} payment={paymentNoRecipientIBAN} />);
    await waitFor(() =>
      expect(screen.getByText(/Recipient hasn't set up their IBAN yet/)).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Close behaviour
// ---------------------------------------------------------------------------

describe('SepaPaymentModal - Close behaviour', () => {

  test('Calls onClose when Cancel is clicked', async () => {
    mockGetDoc.mockResolvedValue(mockUserDocWithIBAN);
    const onClose = jest.fn();
    render(<SepaPaymentModal {...defaultProps} onClose={onClose} />);
    await waitFor(() => screen.getByText('Cancel'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('Calls onClose when X button is clicked', async () => {
    mockGetDoc.mockResolvedValue(mockUserDocWithIBAN);
    const onClose = jest.fn();
    render(<SepaPaymentModal {...defaultProps} onClose={onClose} />);
    await waitFor(() => screen.getByText('SEPA Payment'));
    const xButton = screen.getAllByRole('button')[0];
    fireEvent.click(xButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 5. Payment flow — authentication failure
// ---------------------------------------------------------------------------

describe('SepaPaymentModal - Authentication failure', () => {

  test('Shows error when biometric authentication fails', async () => {
    mockGetDoc.mockResolvedValue(mockUserDocWithIBAN);
    mockAuthenticateWithBiometric.mockResolvedValue(false);

    render(<SepaPaymentModal {...defaultProps} />);
    await waitFor(() => {
      const btn = screen.getByText('Confirm Payment').closest('button');
      expect(btn).not.toBeDisabled();
    });
    fireEvent.click(screen.getByText('Confirm Payment').closest('button'));
    expect(await screen.findByText('Authentication failed. Payment cancelled.', {}, { timeout: 3000 })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 6. Payment flow — success
// ---------------------------------------------------------------------------

describe('SepaPaymentModal - Success step', () => {

  test('Shows Payment Successful after successful payment', async () => {
    mockGetDoc.mockResolvedValue(mockUserDocWithIBAN);
    mockAuthenticateWithBiometric.mockResolvedValue(true);
    mockProcessSepaPayment.mockResolvedValue({
      reference:        'REF-123',
      estimatedArrival: new Date().toISOString(),
      status:           'completed',
    });

    render(<SepaPaymentModal {...defaultProps} />);
    await waitFor(() => {
      const btn = screen.getByText('Confirm Payment').closest('button');
      expect(btn).not.toBeDisabled();
    });
    fireEvent.click(screen.getByText('Confirm Payment').closest('button'));
    expect(await screen.findByText('Payment Successful!', {}, { timeout: 5000 })).toBeInTheDocument();
  });

  test('Shows payment reference in success step', async () => {
    mockGetDoc.mockResolvedValue(mockUserDocWithIBAN);
    mockAuthenticateWithBiometric.mockResolvedValue(true);
    mockProcessSepaPayment.mockResolvedValue({
      reference:        'REF-123',
      estimatedArrival: new Date().toISOString(),
      status:           'completed',
    });

    render(<SepaPaymentModal {...defaultProps} />);
    await waitFor(() => {
      const btn = screen.getByText('Confirm Payment').closest('button');
      expect(btn).not.toBeDisabled();
    });
    fireEvent.click(screen.getByText('Confirm Payment').closest('button'));
    expect(await screen.findByText('REF-123', {}, { timeout: 5000 })).toBeInTheDocument();
  });

  test('Calls onPaymentSuccess callback after successful payment', async () => {
    const onPaymentSuccess = jest.fn().mockResolvedValue(undefined);
    mockGetDoc.mockResolvedValue(mockUserDocWithIBAN);
    mockAuthenticateWithBiometric.mockResolvedValue(true);
    mockProcessSepaPayment.mockResolvedValue({
      reference:        'REF-123',
      estimatedArrival: new Date().toISOString(),
      status:           'completed',
    });

    render(<SepaPaymentModal {...defaultProps} onPaymentSuccess={onPaymentSuccess} />);
    await waitFor(() => {
      const btn = screen.getByText('Confirm Payment').closest('button');
      expect(btn).not.toBeDisabled();
    });
    fireEvent.click(screen.getByText('Confirm Payment').closest('button'));
    await screen.findByText('Payment Successful!', {}, { timeout: 5000 });
    expect(onPaymentSuccess).toHaveBeenCalledTimes(1);
  });

  test('Shows Done button in success step', async () => {
    mockGetDoc.mockResolvedValue(mockUserDocWithIBAN);
    mockAuthenticateWithBiometric.mockResolvedValue(true);
    mockProcessSepaPayment.mockResolvedValue({
      reference:        'REF-123',
      estimatedArrival: new Date().toISOString(),
      status:           'completed',
    });

    render(<SepaPaymentModal {...defaultProps} />);
    await waitFor(() => {
      const btn = screen.getByText('Confirm Payment').closest('button');
      expect(btn).not.toBeDisabled();
    });
    fireEvent.click(screen.getByText('Confirm Payment').closest('button'));
    expect(await screen.findByText('Done', {}, { timeout: 5000 })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 7. Payment flow — error
// ---------------------------------------------------------------------------

describe('SepaPaymentModal - Error step', () => {

  test('Shows Payment Failed when processSepaPayment throws', async () => {
    mockGetDoc.mockResolvedValue(mockUserDocWithIBAN);
    mockAuthenticateWithBiometric.mockResolvedValue(true);
    mockProcessSepaPayment.mockRejectedValue(new Error('Bank rejected'));

    render(<SepaPaymentModal {...defaultProps} />);
    await waitFor(() => {
      const btn = screen.getByText('Confirm Payment').closest('button');
      expect(btn).not.toBeDisabled();
    });
    fireEvent.click(screen.getByText('Confirm Payment').closest('button'));
    expect(await screen.findByText('Payment Failed', {}, { timeout: 5000 })).toBeInTheDocument();
  });

  test('Shows error message in error step', async () => {
    mockGetDoc.mockResolvedValue(mockUserDocWithIBAN);
    mockAuthenticateWithBiometric.mockResolvedValue(true);
    mockProcessSepaPayment.mockRejectedValue(new Error('Bank rejected'));

    render(<SepaPaymentModal {...defaultProps} />);
    await waitFor(() => {
      const btn = screen.getByText('Confirm Payment').closest('button');
      expect(btn).not.toBeDisabled();
    });
    fireEvent.click(screen.getByText('Confirm Payment').closest('button'));
    expect(await screen.findByText('Bank rejected', {}, { timeout: 5000 })).toBeInTheDocument();
  });

  test('Shows Try Again button in error step', async () => {
    mockGetDoc.mockResolvedValue(mockUserDocWithIBAN);
    mockAuthenticateWithBiometric.mockResolvedValue(true);
    mockProcessSepaPayment.mockRejectedValue(new Error('Bank rejected'));

    render(<SepaPaymentModal {...defaultProps} />);
    await waitFor(() => {
      const btn = screen.getByText('Confirm Payment').closest('button');
      expect(btn).not.toBeDisabled();
    });
    fireEvent.click(screen.getByText('Confirm Payment').closest('button'));
    const tryAgain = await screen.findByText('Try Again', {}, { timeout: 5000 });
    fireEvent.click(tryAgain);
    expect(await screen.findByText('Confirm Payment', {}, { timeout: 3000 })).toBeInTheDocument();
  });
});
