// src/pages/Profile.test.jsx
// Test suite for Profile page - rendering, logout, phone number, balance display

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockSignOut = jest.fn();
jest.mock('firebase/auth', () => ({
  signOut: (...a) => mockSignOut(...a),
}));

const mockOnSnapshot  = jest.fn(() => jest.fn()); // returns unsubscribe fn
const mockGetDoc      = jest.fn();
const mockUpdateDoc   = jest.fn();
const mockSetDoc      = jest.fn();
const mockDoc         = jest.fn(() => 'mock-doc-ref');
const mockCollection  = jest.fn();
const mockQuery       = jest.fn();
const mockWhere       = jest.fn();
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

const mockLogout         = jest.fn();
const mockUpdateUserPhoto = jest.fn();
const mockUser = {
  uid:         'user-123',
  email:       'alice@example.com',
  displayName: 'Alice',
  photoURL:    null,
  metadata:    { creationTime: '2024-01-01T00:00:00Z' },
};
jest.mock('../stores/authStore', () => ({
  useAuthStore: (selector) => {
    const store = {
      user:            mockUser,
      logout:          mockLogout,
      updateUserPhoto: mockUpdateUserPhoto,
    };
    return selector ? selector(store) : store;
  },
}));

const mockCalculateBalances = jest.fn(() => ({}));
jest.mock('../utils/balanceCalculator', () => ({
  calculateBalances: (...a) => mockCalculateBalances(...a),
}));

jest.mock('../utils/encryption', () => ({
  encryptData:  jest.fn(() => 'encrypted'),
  decryptData:  jest.fn(() => 'IE29AIBK12345678'),
  validateIBAN: jest.fn(() => true),
}));

jest.mock('../utils/biometric', () => ({
  authenticateWithBiometric:  jest.fn().mockResolvedValue(true),
  isBiometricAvailable:       jest.fn(() => false),
  isBiometricEnabledOnDevice: jest.fn(() => false),
}));

// Mock child components
jest.mock('../components/CloudinaryUpload', () => ({ onPhotoUpdated }) => (
  <button data-testid="cloudinary-upload" onClick={() => onPhotoUpdated('new-photo.jpg')}>
    Upload Photo
  </button>
));
jest.mock('../components/BalanceBreakdownModal', () => ({ isOpen, onClose }) =>
  isOpen ? <div data-testid="breakdown-modal"><button onClick={onClose}>Close</button></div> : null
);

// ─── Import after mocks ───────────────────────────────────────────────────────
import Profile from './Profile';

// ─── Setup ────────────────────────────────────────────────────────────────────
const setupDefaultMocks = () => {
  mockOnSnapshot.mockImplementation((query, callback) => {
    callback({ docs: [] });
    return jest.fn();
  });
  mockGetDoc.mockResolvedValue({
    exists: () => true,
    data:   () => ({ phoneNumber: '+353871234567', paymentMethods: {} }),
  });
  mockUpdateDoc.mockResolvedValue();
};

// ─────────────────────────────────────────────────────────────────────────────

describe('Profile - Rendering', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  test('Renders user display name', async () => {
    render(<Profile />);
    await waitFor(() =>
      expect(screen.getAllByText('Alice').length).toBeGreaterThan(0)
    );
  });

  test('Renders user email', async () => {
    render(<Profile />);
    await waitFor(() =>
      expect(screen.getAllByText('alice@example.com').length).toBeGreaterThan(0)
    );
  });

  test('Renders Overall Balance section', async () => {
    render(<Profile />);
    await waitFor(() =>
      expect(screen.getByText('Overall Balance')).toBeInTheDocument()
    );
  });

  test('Renders Account Information section', async () => {
    render(<Profile />);
    await waitFor(() =>
      expect(screen.getByText('Account Information')).toBeInTheDocument()
    );
  });

  test('Renders Contact Discovery section', async () => {
    render(<Profile />);
    await waitFor(() =>
      expect(screen.getByText('Contact Discovery')).toBeInTheDocument()
    );
  });

  test('Renders Payment Settings section', async () => {
    render(<Profile />);
    await waitFor(() =>
      expect(screen.getByText('Payment Settings')).toBeInTheDocument()
    );
  });

  test('Renders Log Out button', async () => {
    render(<Profile />);
    await waitFor(() =>
      expect(screen.getByText('Log Out')).toBeInTheDocument()
    );
  });

  test('Renders upload photo button', async () => {
    render(<Profile />);
    await waitFor(() =>
      expect(screen.getByTestId('cloudinary-upload')).toBeInTheDocument()
    );
  });

  test('Shows All settled up when balances are zero', async () => {
    render(<Profile />);
    await waitFor(() =>
      expect(screen.getByText('All settled up!')).toBeInTheDocument()
    );
  });

  test('Shows groups count', async () => {
    render(<Profile />);
    await waitFor(() =>
      expect(screen.getByText('Groups')).toBeInTheDocument()
    );
  });

  test('Shows total paid amount', async () => {
    render(<Profile />);
    await waitFor(() =>
      expect(screen.getByText('Total Paid')).toBeInTheDocument()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Profile - Navigation', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  test('Navigates to /dashboard when back arrow clicked', async () => {
    render(<Profile />);
    const backBtn = screen.getByRole('button', { name: '' });
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Profile - Logout', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
    mockSignOut.mockResolvedValue();
  });

  test('Calls signOut when Log Out is clicked', async () => {
    render(<Profile />);
    await waitFor(() => screen.getByText('Log Out'));
    fireEvent.click(screen.getByText('Log Out'));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  });

  test('Calls logout store action after sign out', async () => {
    render(<Profile />);
    await waitFor(() => screen.getByText('Log Out'));
    fireEvent.click(screen.getByText('Log Out'));
    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
  });

  test('Navigates to /login after logout', async () => {
    render(<Profile />);
    await waitFor(() => screen.getByText('Log Out'));
    fireEvent.click(screen.getByText('Log Out'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Profile - Phone number', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  test('Shows phone number loaded from Firestore', async () => {
    render(<Profile />);
    await waitFor(() =>
      expect(screen.getByText('+353871234567')).toBeInTheDocument()
    );
  });

  test('Shows Add button when no phone number set', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data:   () => ({ paymentMethods: {} }),
    });
    render(<Profile />);
    await waitFor(() =>
      expect(screen.getByText('Add')).toBeInTheDocument()
    );
  });

  test('Shows phone input when Add/Edit is clicked', async () => {
    render(<Profile />);
    await waitFor(() => screen.getByText('Edit'));
    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);
    expect(screen.getByPlaceholderText('+353871234567')).toBeInTheDocument();
  });

  test('Shows error for invalid phone number', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data:   () => ({ paymentMethods: {} }),
    });
    render(<Profile />);
    await waitFor(() => screen.getByText('Add'));
    fireEvent.click(screen.getByText('Add'));
    fireEvent.change(screen.getByPlaceholderText('+353871234567'), {
      target: { value: 'invalid' },
    });
    fireEvent.click(screen.getAllByText('Save')[0]);
    await waitFor(() =>
      expect(screen.getByText(/valid phone number/i)).toBeInTheDocument()
    );
  });

  test('Shows error when phone number is empty', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data:   () => ({ paymentMethods: {} }),
    });
    render(<Profile />);
    await waitFor(() => screen.getByText('Add'));
    fireEvent.click(screen.getByText('Add'));
    fireEvent.click(screen.getAllByText('Save')[0]);
    await waitFor(() =>
      expect(screen.getByText('Phone number cannot be empty')).toBeInTheDocument()
    );
  });

  test('Shows error when phone save fails', async () => {
    global.TextEncoder = class { encode() { return new Uint8Array(); } };
    global.crypto = { subtle: { digest: jest.fn().mockRejectedValue(new Error('crypto error')) } };
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data:   () => ({ paymentMethods: {} }),
    });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<Profile />);
    await waitFor(() => screen.getByText('Add'));
    fireEvent.click(screen.getByText('Add'));
    fireEvent.change(screen.getByPlaceholderText('+353871234567'), {
      target: { value: '+353871234567' },
    });
    fireEvent.click(screen.getAllByText('Save')[0]);
    await waitFor(() =>
      expect(screen.getByText('Failed to save phone number. Please try again.')).toBeInTheDocument()
    );
    consoleSpy.mockRestore();
  });

  test('Hides phone input when Cancel is clicked', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data:   () => ({ paymentMethods: {} }),
    });
    render(<Profile />);
    await waitFor(() => screen.getByText('Add'));
    fireEvent.click(screen.getByText('Add'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByPlaceholderText('+353871234567')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Profile - Balance breakdown modal', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  test('Opens breakdown modal when Owed to You is clicked', async () => {
    render(<Profile />);
    await waitFor(() => screen.getByText('Owed to You'));
    fireEvent.click(screen.getByText('Owed to You'));
    expect(screen.getByTestId('breakdown-modal')).toBeInTheDocument();
  });

  test('Opens breakdown modal when You Owe is clicked', async () => {
    render(<Profile />);
    await waitFor(() => screen.getByText('You Owe'));
    fireEvent.click(screen.getByText('You Owe'));
    expect(screen.getByTestId('breakdown-modal')).toBeInTheDocument();
  });

  test('Closes breakdown modal', async () => {
    render(<Profile />);
    await waitFor(() => screen.getByText('Owed to You'));
    fireEvent.click(screen.getByText('Owed to You'));
    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByTestId('breakdown-modal')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Profile - Payment settings', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  test('Opens payment settings when clicked', async () => {
    render(<Profile />);
    await waitFor(() => screen.getByText('Payment Settings'));
    fireEvent.click(screen.getByText('Payment Settings'));
    await waitFor(() =>
      expect(screen.getByText('Edit Payment Methods')).toBeInTheDocument()
    );
  });

  test('Shows payment inputs when Edit Payment Methods is clicked', async () => {
    render(<Profile />);
    await waitFor(() => screen.getByText('Payment Settings'));
    fireEvent.click(screen.getByText('Payment Settings'));
    await waitFor(() => screen.getByText('Edit Payment Methods'));
    fireEvent.click(screen.getByText('Edit Payment Methods'));
    expect(screen.getAllByPlaceholderText('username').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Profile - Photo upload', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  test('Calls updateUserPhoto when photo is uploaded', async () => {
    render(<Profile />);
    await waitFor(() => screen.getByTestId('cloudinary-upload'));
    fireEvent.click(screen.getByTestId('cloudinary-upload'));
    await waitFor(() =>
      expect(mockUpdateUserPhoto).toHaveBeenCalledWith('new-photo.jpg')
    );
  });
});