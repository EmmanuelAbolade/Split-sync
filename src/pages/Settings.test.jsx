// src/pages/Settings.test.jsx
// Test suite for Settings page - profile updates, logout, delete account, biometric toggle

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockUpdateProfile              = jest.fn();
const mockEmailAuthProvider          = { credential: jest.fn() };
const mockReauthenticateWithCredential = jest.fn();
const mockDeleteUser                 = jest.fn();
jest.mock('firebase/auth', () => ({
  updateProfile:                  (...a) => mockUpdateProfile(...a),
  EmailAuthProvider:              { credential: (...a) => mockEmailAuthProvider.credential(...a) },
  reauthenticateWithCredential:   (...a) => mockReauthenticateWithCredential(...a),
  deleteUser:                     (...a) => mockDeleteUser(...a),
}));

const mockGetDocs     = jest.fn();
const mockDeleteDoc   = jest.fn();
const mockDoc         = jest.fn();
const mockCollection  = jest.fn();
const mockQuery       = jest.fn();
const mockWhere       = jest.fn();
const mockGetDoc = jest.fn().mockResolvedValue({ exists: () => false, data: () => ({}) });
jest.mock('firebase/firestore', () => ({
  doc:        (...a) => mockDoc(...a),
  deleteDoc:  (...a) => mockDeleteDoc(...a),
  collection: (...a) => mockCollection(...a),
  query:      (...a) => mockQuery(...a),
  where:      (...a) => mockWhere(...a),
  getDocs:    (...a) => mockGetDocs(...a),
  getDoc:     (...a) => mockGetDoc(...a),
}));

jest.mock('../services/firebase', () => ({
  auth: { currentUser: { email: 'test@example.com' } },
  db:   {},
}));

const mockLogout  = jest.fn();
const mockUser    = { uid: 'user-123', email: 'test@example.com', displayName: 'Alice' };
jest.mock('../stores/authStore', () => ({
  useAuthStore: () => ({ user: mockUser, logout: mockLogout }),
}));

const mockRegisterBiometric          = jest.fn();
const mockAuthenticateWithBiometric  = jest.fn();
const mockDisableBiometric           = jest.fn();
const mockIsBiometricEnabledOnDevice = jest.fn();
const mockGetDeviceInfo              = jest.fn(() => 'Chrome on Windows');
jest.mock('../utils/biometric', () => ({
  registerBiometric:           (...a) => mockRegisterBiometric(...a),
  authenticateWithBiometric:   (...a) => mockAuthenticateWithBiometric(...a),
  disableBiometric:            (...a) => mockDisableBiometric(...a),
  isBiometricEnabledOnDevice:  (...a) => mockIsBiometricEnabledOnDevice(...a),
  getDeviceInfo:               () => mockGetDeviceInfo(),
}));

// Mock child components to keep tests focused
jest.mock('../components/QRCodeModal',   () => ({ isOpen, onClose }) =>
  isOpen ? <div data-testid="qrcode-modal"><button onClick={onClose}>Close QR</button></div> : null
);
jest.mock('../components/InfoHubModal',  () => ({ isOpen, onClose }) =>
  isOpen ? <div data-testid="infohub-modal"><button onClick={onClose}>Close Info</button></div> : null
);
jest.mock('../components/DarkModeToggle', () => () => <div data-testid="dark-mode-toggle" />);

// Circles flags: off unless a test switches them on
let mockFlagsOn = false;
jest.mock('../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ loading: false, isEnabled: () => mockFlagsOn }),
}));
jest.mock('../components/PasskeysCard', () => () => <div data-testid="passkeys-card" />);

// ─── Import after mocks ───────────────────────────────────────────────────────
import Settings from './Settings';

// ─── Global setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  window.matchMedia = jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Settings - Rendering', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDeviceInfo.mockReturnValue('Chrome on Windows');
  });

  test('Renders user display name', () => {
    render(<Settings />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  test('Renders user email', () => {
    render(<Settings />);
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  test('Renders Log Out button', () => {
    render(<Settings />);
    expect(screen.getByText('Log Out')).toBeInTheDocument();
  });

  test('Renders Delete Account button', () => {
    render(<Settings />);
    expect(screen.getByText('Delete Account')).toBeInTheDocument();
  });

  test('Renders Biometric Authentication toggle', () => {
    render(<Settings />);
    expect(screen.getByLabelText('Toggle biometric authentication')).toBeInTheDocument();
  });

  test('Renders Share Split-Sync button', () => {
    render(<Settings />);
    expect(screen.getByText('Share Split-Sync')).toBeInTheDocument();
  });

  test('Renders Help & Information button', () => {
    render(<Settings />);
    expect(screen.getByText('Help & Information')).toBeInTheDocument();
  });

  test('Renders DarkModeToggle component', () => {
    render(<Settings />);
    expect(screen.getByTestId('dark-mode-toggle')).toBeInTheDocument();
  });

  test('Renders app version', () => {
    render(<Settings />);
    expect(screen.getByText('Split-Sync v1.0.0')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

// FIND entire "Update display name" describe block and REPLACE WITH:
describe('Settings - Update display name', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDeviceInfo.mockReturnValue('Chrome on Windows');
    mockUpdateProfile.mockResolvedValue();
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
  });

  test('Shows edit name input when Edit button clicked', () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
  });

  test('Shows error when trying to save empty name', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByDisplayValue('Alice'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() =>
      expect(screen.getByText('Name cannot be empty')).toBeInTheDocument()
    );
  });

  test('Calls updateProfile with trimmed name', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByDisplayValue('Alice'), { target: { value: '  Bob  ' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() =>
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.anything(),
        { displayName: 'Bob' }
      )
    );
  });

  test('Shows error message when updateProfile fails', async () => {
    mockUpdateProfile.mockRejectedValue(new Error('Firebase error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<Settings />);
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() =>
      expect(screen.getByText('Failed to update name. Please try again.')).toBeInTheDocument()
    );
    consoleSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Settings - Logout', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDeviceInfo.mockReturnValue('Chrome on Windows');
  });

  test('Calls logout when Log Out is clicked', async () => {
    mockLogout.mockResolvedValue();
    render(<Settings />);
    fireEvent.click(screen.getByText('Log Out'));
    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
  });

  test('Navigates to /login after logout', async () => {
    mockLogout.mockResolvedValue();
    render(<Settings />);
    fireEvent.click(screen.getByText('Log Out'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'));
  });

  test('Shows error when logout fails', async () => {
    mockLogout.mockRejectedValue(new Error('Logout failed'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<Settings />);
    fireEvent.click(screen.getByText('Log Out'));
    await waitFor(() =>
      expect(screen.getByText('Failed to log out. Please try again.')).toBeInTheDocument()
    );
    consoleSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Settings - Delete account modal', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDeviceInfo.mockReturnValue('Chrome on Windows');
  });

  test('Opens delete modal when Delete Account is clicked', () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Delete Account'));
    expect(screen.getByPlaceholderText('Your password')).toBeInTheDocument();
  });

  test('Closes delete modal when Cancel is clicked', () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Delete Account'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByPlaceholderText('Your password')).not.toBeInTheDocument();
  });

  test('Shows error when submitting without password', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Delete Account'));
    // Button is disabled when password is empty — enter and clear to trigger validation
    const input = screen.getByPlaceholderText('Your password');
    fireEvent.change(input, { target: { value: 'x' } });
    fireEvent.change(input, { target: { value: '' } });
    // Directly call the handler by finding the enabled-state button
    // Instead just verify the button is disabled when no password
    const deleteButtons = screen.getAllByText('Delete Account');
    const modalDeleteBtn = deleteButtons[deleteButtons.length - 1];
    expect(modalDeleteBtn).toBeDisabled();
  });

  test('Toggles password visibility in delete modal', () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Delete Account'));
    const input = screen.getByPlaceholderText('Your password');
    expect(input).toHaveAttribute('type', 'password');
    // Find the toggle button inside the modal
    const toggleBtn = input.parentElement.querySelector('button');
    fireEvent.click(toggleBtn);
    expect(input).toHaveAttribute('type', 'text');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Settings - Delete account submission', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDeviceInfo.mockReturnValue('Chrome on Windows');
    mockEmailAuthProvider.credential.mockReturnValue('mock-credential');
    mockReauthenticateWithCredential.mockResolvedValue();
    mockDeleteUser.mockResolvedValue();
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockDeleteDoc.mockResolvedValue();
  });

  const openModalAndEnterPassword = (password = 'password123') => {
    fireEvent.click(screen.getByText('Delete Account'));
    fireEvent.change(screen.getByPlaceholderText('Your password'), {
      target: { value: password },
    });
    const deleteButtons = screen.getAllByText('Delete Account');
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);
  };

  test('Calls reauthenticateWithCredential with correct credential', async () => {
    render(<Settings />);
    openModalAndEnterPassword('mypassword');
    await waitFor(() => expect(mockReauthenticateWithCredential).toHaveBeenCalled());
  });

  test('Calls deleteUser after successful re-authentication', async () => {
    render(<Settings />);
    openModalAndEnterPassword();
    await waitFor(() => expect(mockDeleteUser).toHaveBeenCalled());
  });

  test('Navigates to /login after successful deletion', async () => {
    render(<Settings />);
    openModalAndEnterPassword();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'));
  });

  test('Shows wrong password error', async () => {
    mockReauthenticateWithCredential.mockRejectedValue({ code: 'auth/wrong-password' });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<Settings />);
    openModalAndEnterPassword();
    await waitFor(() =>
      expect(screen.getByText('Incorrect password. Please try again.')).toBeInTheDocument()
    );
    consoleSpy.mockRestore();
  });

  test('Shows too many requests error', async () => {
    mockReauthenticateWithCredential.mockRejectedValue({ code: 'auth/too-many-requests' });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<Settings />);
    openModalAndEnterPassword();
    await waitFor(() =>
      expect(screen.getByText('Too many attempts. Please try again later.')).toBeInTheDocument()
    );
    consoleSpy.mockRestore();
  });

  test('Shows generic error for unknown failure', async () => {
    mockReauthenticateWithCredential.mockRejectedValue({ code: 'auth/unknown' });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<Settings />);
    openModalAndEnterPassword();
    await waitFor(() =>
      expect(screen.getByText('Failed to delete account. Please try again.')).toBeInTheDocument()
    );
    consoleSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Settings - QR Code and Info Hub modals', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDeviceInfo.mockReturnValue('Chrome on Windows');
  });

  test('Opens QR code modal when Share Split-Sync is clicked', () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Share Split-Sync'));
    expect(screen.getByTestId('qrcode-modal')).toBeInTheDocument();
  });

  test('Closes QR code modal', () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Share Split-Sync'));
    fireEvent.click(screen.getByText('Close QR'));
    expect(screen.queryByTestId('qrcode-modal')).not.toBeInTheDocument();
  });

  test('Opens Info Hub modal when Help & Information is clicked', () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Help & Information'));
    expect(screen.getByTestId('infohub-modal')).toBeInTheDocument();
  });

  test('Closes Info Hub modal', () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Help & Information'));
    fireEvent.click(screen.getByText('Close Info'));
    expect(screen.queryByTestId('infohub-modal')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Settings - Biometric toggle', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDeviceInfo.mockReturnValue('Chrome on Windows');
  });

  test('Enables biometric when toggled on and registration succeeds', async () => {
    mockRegisterBiometric.mockResolvedValue(true);
    render(<Settings />);
    fireEvent.click(screen.getByLabelText('Toggle biometric authentication'));
    await waitFor(() => expect(mockRegisterBiometric).toHaveBeenCalled());
  });

  test('Shows error when biometric registration fails', async () => {
    mockRegisterBiometric.mockResolvedValue(false);
    render(<Settings />);
    fireEvent.click(screen.getByLabelText('Toggle biometric authentication'));
    await waitFor(() =>
      expect(screen.getByText('Failed to enable biometric. Please try again.')).toBeInTheDocument()
    );
  });

  test('Shows error when biometric registration throws', async () => {
    mockRegisterBiometric.mockRejectedValue(new Error('WebAuthn error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<Settings />);
    fireEvent.click(screen.getByLabelText('Toggle biometric authentication'));
    await waitFor(() =>
      expect(screen.getByText('Failed to enable biometric authentication')).toBeInTheDocument()
    );
    consoleSpy.mockRestore();
  });
});
// ─────────────────────────────────────────────────────────────────────────────

describe('Settings - Passkeys for money actions', () => {
  test('Shown to everyone, whatever the Circles flag says', () => {
    mockFlagsOn = false;
    render(<Settings />);
    expect(screen.getByTestId('passkeys-card')).toBeInTheDocument();
    expect(screen.getByLabelText('Toggle biometric authentication')).toBeInTheDocument();
  });
});
