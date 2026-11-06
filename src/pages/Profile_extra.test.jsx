// src/pages/Profile_extra.test.jsx
// Covers uncovered lines in Profile.jsx:
// - handleSavePaymentMethods: success, BIC error, Revolut error,
//   network error, permission-denied error, setDoc path
// - handleShowPaymentSettings: biometric enabled, biometric failure
// - handleEditPayment: biometric enabled, biometric failure
// - handleLogout: error path
// - paidByCurrency calculation
// - phone save success path

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.alert = jest.fn();
global.crypto = {
  subtle: {
    digest: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer),
  },
};

const mockNavigate = jest.fn();
// Spaces (Phase 2): only Expenses unless a test switches more on
let mockSpaceIds = ['expenses'];
jest.mock('../components/AppTopBar', () => () => <div data-testid="app-top-bar" />);
jest.mock('../hooks/useSpaces', () => ({
  __esModule: true,
  default: () => {
    const { SPACES } = jest.requireActual('../config/spaces');
    const spaces = SPACES.filter((s) => mockSpaceIds.includes(s.id));
    return { loading: false, circlesOn: mockSpaceIds.length > 1, spaces, isSpaceOn: (id) => mockSpaceIds.includes(id) };
  },
}));
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

const mockSignOut = jest.fn();
jest.mock('firebase/auth', () => ({ signOut: (...a) => mockSignOut(...a) }));

const mockOnSnapshot = jest.fn();
const mockGetDoc     = jest.fn();
const mockUpdateDoc  = jest.fn();
const mockSetDoc     = jest.fn();
const mockDoc        = jest.fn(() => 'mock-doc-ref');
const mockCollection = jest.fn();
const mockQuery      = jest.fn();
const mockWhere      = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection:  (...a) => mockCollection(...a),
  query:       (...a) => mockQuery(...a),
  where:       (...a) => mockWhere(...a),
  onSnapshot:  (...a) => mockOnSnapshot(...a),
  getDoc:      (...a) => mockGetDoc(...a),
  updateDoc:   (...a) => mockUpdateDoc(...a),
  setDoc:      (...a) => mockSetDoc(...a),
  doc:         (...a) => mockDoc(...a),
}));

jest.mock('../services/firebase', () => ({ auth: {}, db: {} }));

const mockLogout          = jest.fn();
const mockUpdateUserPhoto = jest.fn();
const mockUser = {
  uid: 'user-123', email: 'alice@example.com', displayName: 'Alice',
  photoURL: null, metadata: { creationTime: '2024-01-15T00:00:00.000Z' },
};

jest.mock('../stores/authStore', () => ({
  useAuthStore: (selector) => {
    const store = { user: mockUser, logout: mockLogout, updateUserPhoto: mockUpdateUserPhoto };
    return selector ? selector(store) : store;
  },
}));

jest.mock('../components/CloudinaryUpload', () => () => <div data-testid="cloudinary-upload" />);
jest.mock('../components/BalanceBreakdownModal', () => ({ isOpen, onClose }) =>
  isOpen ? <div data-testid="balance-breakdown-modal"><button onClick={onClose}>Close</button></div> : null
);

const mockEncryptData  = jest.fn((v) => `encrypted-${v}`);
const mockDecryptData  = jest.fn((v) => v?.replace?.('encrypted-', '') ?? v);
const mockValidateIBAN = jest.fn(() => true);

jest.mock('../utils/encryption', () => ({
  encryptData:  (...a) => mockEncryptData(...a),
  decryptData:  (...a) => mockDecryptData(...a),
  validateIBAN: (...a) => mockValidateIBAN(...a),
}));

// IBAN encryption is server-side (utils/ibanService → Cloud Functions)
jest.mock('../utils/ibanService', () => ({
  fetchIban:   async () => '',
  encryptIban: async (v) => `encrypted-${v}`,
}));

// Payment methods are saved to the owner-only private profile doc. The save
// is routed through mockUpdateDoc so the success/error-path tests below keep
// exercising the real Profile error handling.
jest.mock('../utils/privateProfile', () => ({
  loadMyPrivateDetails: async () => ({ paymentMethods: {}, phoneNumber: '' }),
  saveMyPaymentMethods: (...a) => mockUpdateDoc(...a),
  saveMyPhoneNumber:    async () => {},
}));

const mockAuthenticateWithBiometric  = jest.fn();
const mockIsBiometricAvailable       = jest.fn(() => false);
const mockIsBiometricEnabledOnDevice = jest.fn(() => false);

jest.mock('../utils/biometric', () => ({
  authenticateWithBiometric:  (...a) => mockAuthenticateWithBiometric(...a),
  isBiometricAvailable:       ()     => mockIsBiometricAvailable(),
  isBiometricEnabledOnDevice: (...a) => mockIsBiometricEnabledOnDevice(...a),
}));

jest.mock('../utils/balanceCalculator', () => ({
  calculateBalances:    jest.fn(() => ({ 'user-123': 0 })),
  calculateSettlements: jest.fn(() => []),
}));
import Profile from './Profile';

// ── Helpers ───────────────────────────────────────────────────────────────────
const setupSnapshots = (groups = [], expenses = []) => {
  let callCount = 0;
  mockOnSnapshot.mockImplementation((q, cb) => {
    callCount++;
    if (typeof cb === 'function') {
      if (callCount === 1) cb({ docs: groups.map(g => ({ id: g.id, data: () => g })) });
      else cb({ docs: expenses.map(e => ({ id: e.id, data: () => e })) });
    }
    return jest.fn();
  });
};

const setupUserDoc = (data = {}) => {
  mockGetDoc.mockResolvedValue({
    exists: () => true,
    data:   () => ({ phoneNumber: '', paymentMethods: {}, ...data }),
  });
};

const defaultSetup = () => {
  setupSnapshots();
  setupUserDoc();
  mockUpdateDoc.mockResolvedValue();
  mockSetDoc.mockResolvedValue();
  mockSignOut.mockResolvedValue();
  mockValidateIBAN.mockReturnValue(true);
  mockEncryptData.mockImplementation(v => `encrypted-${v}`);
  mockDecryptData.mockImplementation(v => v?.replace?.('encrypted-', '') ?? v);
  mockIsBiometricEnabledOnDevice.mockReturnValue(false);
  mockAuthenticateWithBiometric.mockResolvedValue(true);
  // Restore balanceCalculator mocks after clearAllMocks
  const { calculateBalances, calculateSettlements } = require('../utils/balanceCalculator');
  calculateBalances.mockReturnValue({ 'user-123': 0 });
  calculateSettlements.mockReturnValue([]);
};

const openPaymentEditing = async () => {
  fireEvent.click(screen.getByText('Payment Settings'));
  await waitFor(() => screen.getByText('Edit Payment Methods'));
  fireEvent.click(screen.getByText('Edit Payment Methods'));
  await waitFor(() => screen.getByText('Save Payment Settings'));
};

// ── 1. Success path ───────────────────────────────────────────────────────────
describe('Profile extra - handleSavePaymentMethods success', () => {
  beforeEach(() => { jest.clearAllMocks(); defaultSetup(); mockDecryptData.mockReturnValue(''); });

  test('Saves payment methods to the private profile on valid PayPal save', async () => {
    render(<Profile />);
    await openPaymentEditing();
    const inputs = screen.getAllByPlaceholderText('username');
    fireEvent.change(inputs[0], { target: { value: 'alice123' } });
    fireEvent.click(screen.getByText('Save Payment Settings'));
    await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
  });

  test('Shows success message after valid save', async () => {
    render(<Profile />);
    await openPaymentEditing();
    const inputs = screen.getAllByPlaceholderText('username');
    fireEvent.change(inputs[0], { target: { value: 'alice123' } });
    fireEvent.click(screen.getByText('Save Payment Settings'));
    await waitFor(() =>
      expect(screen.getByText(/payment settings saved successfully/i)).toBeInTheDocument()
    );
  });

  test('Calls setDoc when user document does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
    render(<Profile />);
    await openPaymentEditing();
    const inputs = screen.getAllByPlaceholderText('username');
    fireEvent.change(inputs[0], { target: { value: 'alice123' } });
    fireEvent.click(screen.getByText('Save Payment Settings'));
    await waitFor(() => expect(mockSetDoc).toHaveBeenCalled());
  });
});

// ── 2. BIC validation ─────────────────────────────────────────────────────────
describe('Profile extra - BIC validation', () => {
  beforeEach(() => { jest.clearAllMocks(); defaultSetup(); mockDecryptData.mockReturnValue(''); });

  test('Shows BIC error for invalid BIC code', async () => {
    render(<Profile />);
    await openPaymentEditing();
    fireEvent.change(screen.getByPlaceholderText('AIBKIE2D'), { target: { value: 'INVALID!!!' } });
    fireEvent.click(screen.getByText('Save Payment Settings'));
    await waitFor(() =>
      expect(screen.getByText(/invalid BIC\/SWIFT/i)).toBeInTheDocument()
    );
  });
});

// ── 3. Revolut validation ─────────────────────────────────────────────────────
describe('Profile extra - Revolut validation', () => {
  beforeEach(() => { jest.clearAllMocks(); defaultSetup(); mockDecryptData.mockReturnValue(''); });

  test('Shows Revolut error for invalid username', async () => {
    render(<Profile />);
    await openPaymentEditing();
    const inputs = screen.getAllByPlaceholderText('username');
    fireEvent.change(inputs[1], { target: { value: 'bad username!!!' } });
    fireEvent.click(screen.getByText('Save Payment Settings'));
    await waitFor(() =>
      expect(screen.getByText(/revolut username must be/i)).toBeInTheDocument()
    );
  });
});

// ── 4. Error paths ────────────────────────────────────────────────────────────
describe('Profile extra - handleSavePaymentMethods error paths', () => {
  beforeEach(() => { jest.clearAllMocks(); defaultSetup(); mockDecryptData.mockReturnValue(''); });

  test('Shows network error when updateDoc throws unavailable', async () => {
    const err = new Error('unavailable'); err.code = 'unavailable';
    mockUpdateDoc.mockRejectedValue(err);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<Profile />);
    await openPaymentEditing();
    const inputs = screen.getAllByPlaceholderText('username');
    fireEvent.change(inputs[0], { target: { value: 'alice123' } });
    fireEvent.click(screen.getByText('Save Payment Settings'));
    await waitFor(() => expect(screen.getByText(/network error/i)).toBeInTheDocument());
    spy.mockRestore();
  });

  test('Shows permission error when updateDoc throws permission-denied', async () => {
    const err = new Error('permission-denied'); err.code = 'permission-denied';
    mockUpdateDoc.mockRejectedValue(err);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<Profile />);
    await openPaymentEditing();
    const inputs = screen.getAllByPlaceholderText('username');
    fireEvent.change(inputs[0], { target: { value: 'alice123' } });
    fireEvent.click(screen.getByText('Save Payment Settings'));
    await waitFor(() => expect(screen.getByText(/do not have permission to save/i)).toBeInTheDocument());
    spy.mockRestore();
  });
});

// ── 5. Biometric show payment settings ───────────────────────────────────────
describe('Profile extra - handleShowPaymentSettings biometric', () => {
  beforeEach(() => {
    jest.clearAllMocks(); defaultSetup();
    mockIsBiometricEnabledOnDevice.mockReturnValue(true);
    mockDecryptData.mockReturnValue('');
  });

  test('Calls authenticateWithBiometric when biometric is enabled', async () => {
    mockAuthenticateWithBiometric.mockResolvedValue(true);
    render(<Profile />);
    await waitFor(() => screen.getByText('Payment Settings'));
    fireEvent.click(screen.getByText('Payment Settings'));
    await waitFor(() =>
      expect(mockAuthenticateWithBiometric).toHaveBeenCalledWith('user-123', expect.any(String))
    );
  });

  test('Shows alert when biometric fails', async () => {
    mockAuthenticateWithBiometric.mockResolvedValue(false);
    render(<Profile />);
    fireEvent.click(screen.getByText('Payment Settings'));
    await waitFor(() => expect(global.alert).toHaveBeenCalled());
  });

  test('Shows Edit Payment Methods when biometric succeeds', async () => {
    mockAuthenticateWithBiometric.mockResolvedValue(true);
    render(<Profile />);
    fireEvent.click(screen.getByText('Payment Settings'));
    await waitFor(() =>
      expect(screen.getByText('Edit Payment Methods')).toBeInTheDocument()
    );
  });
});

// ── 6. Biometric edit payment ─────────────────────────────────────────────────
describe('Profile extra - handleEditPayment biometric', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    defaultSetup();
    mockIsBiometricEnabledOnDevice.mockReturnValue(true);
    mockDecryptData.mockReturnValue('');
    mockAuthenticateWithBiometric.mockResolvedValue(true);
  });

  test('Shows Save button after successful biometric edit authentication', async () => {
    mockAuthenticateWithBiometric.mockResolvedValue(true);
    render(<Profile />);
    fireEvent.click(screen.getByText('Payment Settings'));
    await waitFor(() => screen.getByText('Edit Payment Methods'));
    fireEvent.click(screen.getByText('Edit Payment Methods'));
    await waitFor(() =>
      expect(screen.getByText('Save Payment Settings')).toBeInTheDocument()
    );
  });

 test('Shows alert when biometric fails on payment settings open', async () => {
    mockAuthenticateWithBiometric.mockReset().mockResolvedValue(false);
    render(<Profile />);
    await waitFor(() => screen.getByText('Payment Settings'));
    fireEvent.click(screen.getByText('Payment Settings'));
    await waitFor(() => expect(global.alert).toHaveBeenCalledTimes(1));
  });
});

// ── 7. Logout error ───────────────────────────────────────────────────────────
describe('Profile extra - handleLogout error path', () => {
  beforeEach(() => { jest.clearAllMocks(); defaultSetup(); });

  test('Logs error when signOut throws', async () => {
    mockSignOut.mockRejectedValue(new Error('Sign out failed'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<Profile />);
    await waitFor(() => screen.getByText('Log Out'));
    fireEvent.click(screen.getByText('Log Out'));
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith('Logout error:', expect.any(Error))
    );
    spy.mockRestore();
  });
});

// ── 8. paidByCurrency ─────────────────────────────────────────────────────────
describe('Profile extra - paidByCurrency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    defaultSetup();
  });

  test('Renders Total Paid label', async () => {
    const group   = { id: 'g1', name: 'Flat', currency: 'EUR', members: [], memberIds: ['user-123'] };
    const expense = { id: 'e1', groupId: 'g1', paidBy: 'user-123', amount: 50 };
    let callCount = 0;
    mockOnSnapshot.mockImplementation((q, cb) => {
      callCount++;
      if (typeof cb === 'function') {
        if (callCount === 1) cb({ docs: [{ id: group.id, data: () => group }] });
        else cb({ docs: [{ id: expense.id, data: () => expense }] });
      }
      return jest.fn();
    });
    render(<Profile />);
    await waitFor(() => expect(screen.getByText('Total Paid')).toBeInTheDocument());
  });
});

// ── 9. Toggle payment settings closed ─────────────────────────────────────────
describe('Profile extra - toggle payment settings closed', () => {
  beforeEach(() => { jest.clearAllMocks(); defaultSetup(); mockDecryptData.mockReturnValue(''); });

  test('Closes payment settings when header is clicked again', async () => {
    render(<Profile />);
    fireEvent.click(screen.getByText('Payment Settings'));
    await waitFor(() => screen.getByText('Edit Payment Methods'));
    fireEvent.click(screen.getByText('Payment Settings'));
    await waitFor(() =>
      expect(screen.queryByText('Edit Payment Methods')).not.toBeInTheDocument()
    );
  });
});

// ── 10. Phone save ────────────────────────────────────────────────────────────
describe('Profile extra - phone save', () => {
  beforeEach(() => { jest.clearAllMocks(); defaultSetup(); setupUserDoc({ phoneNumber: '' }); });

  test('Shows error when phone is empty on save', async () => {
    render(<Profile />);
    fireEvent.click(screen.getByText('Contact Discovery'));
    await waitFor(() =>
      screen.getAllByRole('button').some(
        b => b.textContent.trim() === 'Add' || b.textContent.trim() === 'Edit'
      )
    );
    const addEditBtn = screen.getAllByRole('button').find(
      b => b.textContent.trim() === 'Add' || b.textContent.trim() === 'Edit'
    );
    fireEvent.click(addEditBtn);
    await waitFor(() => screen.getByPlaceholderText('+353871234567'));
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() =>
      expect(screen.getByText(/phone number cannot be empty/i)).toBeInTheDocument()
    );
  });

 test('Calls updateDoc on valid phone save', async () => {
    render(<Profile />);
    fireEvent.click(screen.getByText('Contact Discovery'));
    await waitFor(() => {
      const btns = screen.getAllByRole('button');
      return btns.some(b => b.textContent.trim() === 'Add' || b.textContent.trim() === 'Edit');
    });
    const addEditBtn = screen.getAllByRole('button').find(
      b => b.textContent.trim() === 'Add' || b.textContent.trim() === 'Edit'
    );
    fireEvent.click(addEditBtn);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('+353871234567')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText('+353871234567'), {
      target: { value: '+353871234567' },
    });
    await waitFor(() => {
      fireEvent.click(screen.getByText('Save'));
    });
    await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
  });
});
