// src/pages/Settings_extra.test.jsx
// Covers uncovered lines in Settings.jsx:
// 42 (Section toggle), 78 (ToggleRow), 173-188 (handleUpdateName batch),
// 259-273 (biometric disable), 287 (back nav), 340 (cancel edit), 450 (timeout buttons)

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockUpdateProfile = jest.fn();
jest.mock('firebase/auth', () => ({
  updateProfile:                (...a) => mockUpdateProfile(...a),
  EmailAuthProvider:            { credential: jest.fn() },
  reauthenticateWithCredential: jest.fn().mockResolvedValue(),
  deleteUser:                   jest.fn().mockResolvedValue(),
}));

const mockUpdateDoc   = jest.fn();
const mockWriteBatch  = jest.fn();
const mockGetDocs     = jest.fn();
const mockDeleteDoc   = jest.fn();
const mockDoc         = jest.fn();
const mockCollection  = jest.fn();
const mockQuery       = jest.fn();
const mockWhere       = jest.fn();
const mockGetDoc      = jest.fn().mockResolvedValue({ exists: () => false, data: () => ({}) });
const mockServerTimestamp = jest.fn(() => 'SERVER_TIMESTAMP');

const mockBatch = {
  update: jest.fn(),
  commit: jest.fn().mockResolvedValue(),
};

jest.mock('firebase/firestore', () => ({
  doc:             (...a) => mockDoc(...a),
  updateDoc:       (...a) => mockUpdateDoc(...a),
  deleteDoc:       (...a) => mockDeleteDoc(...a),
  collection:      (...a) => mockCollection(...a),
  query:           (...a) => mockQuery(...a),
  where:           (...a) => mockWhere(...a),
  getDocs:         (...a) => mockGetDocs(...a),
  getDoc:          (...a) => mockGetDoc(...a),
  writeBatch:      (...a) => mockWriteBatch(...a),
  serverTimestamp: () => mockServerTimestamp(),
}));

jest.mock('../services/firebase', () => ({
  auth: { currentUser: { email: 'test@example.com' } },
  db:   {},
}));

const mockLogout = jest.fn();
const mockUser   = { uid: 'user-123', email: 'test@example.com', displayName: 'Alice' };
jest.mock('../stores/authStore', () => ({
  useAuthStore: () => ({ user: mockUser, logout: mockLogout }),
}));

const mockRegisterBiometric          = jest.fn();
const mockAuthenticateWithBiometric  = jest.fn();
const mockDisableBiometric           = jest.fn();
const mockIsBiometricEnabledOnDevice = jest.fn(() => false);
const mockGetDeviceInfo              = jest.fn(() => 'Chrome on Windows');

jest.mock('../utils/biometric', () => ({
  registerBiometric:          (...a) => mockRegisterBiometric(...a),
  authenticateWithBiometric:  (...a) => mockAuthenticateWithBiometric(...a),
  disableBiometric:           (...a) => mockDisableBiometric(...a),
  isBiometricEnabledOnDevice: (...a) => mockIsBiometricEnabledOnDevice(...a),
  getDeviceInfo:              () => mockGetDeviceInfo(),
}));

jest.mock('../components/QRCodeModal',    () => () => null);
jest.mock('../components/InfoHubModal',   () => () => null);
jest.mock('../components/DarkModeToggle', () => () => <div data-testid="dark-mode-toggle" />);

jest.mock('../hooks/useSessionTimeout', () => ({
  useSessionTimeout: () => ({ timeoutSetting: 15, updateTimeoutSetting: jest.fn() }),
}));

import Settings from './Settings';

// ─── Setup ────────────────────────────────────────────────────────────────────

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
  jest.clearAllMocks();
  mockGetDeviceInfo.mockReturnValue('Chrome on Windows');
  mockIsBiometricEnabledOnDevice.mockReturnValue(false);
  mockWriteBatch.mockReturnValue(mockBatch);
  mockBatch.update.mockClear();
  mockBatch.commit.mockClear().mockResolvedValue();
  mockUpdateProfile.mockResolvedValue();
  mockUpdateDoc.mockResolvedValue();
  // getDocs returns one group with one member
  mockGetDocs.mockResolvedValue({
    forEach: (cb) => cb({
      ref: 'group-ref',
      data: () => ({
        members: [{ userId: 'user-123', name: 'Alice' }],
      }),
    }),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Back navigation (line 287)
// ─────────────────────────────────────────────────────────────────────────────

describe('Settings extra - Back navigation', () => {

  test('Navigates to /dashboard when back arrow is clicked', () => {
    render(<Settings />);
    fireEvent.click(screen.getByLabelText('Back to dashboard'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section toggle (line 42)
// ─────────────────────────────────────────────────────────────────────────────

describe('Settings extra - Section collapsible toggle', () => {

  test('Clicking a section header toggles its content open', () => {
    render(<Settings />);
    // Notifications section is closed by default — click to open
    fireEvent.click(screen.getByText('Notifications'));
    // After clicking the section opens — verify no crash and section heading is still present
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  test('Clicking an open section header closes it again', () => {
    render(<Settings />);
    // Profile section is open by default (defaultOpen=true)
    // Clicking it should toggle it closed
    fireEvent.click(screen.getByText('Profile'));
    fireEvent.click(screen.getByText('Profile'));
    expect(screen.getByText('Profile')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cancel edit name (line 340)
// ─────────────────────────────────────────────────────────────────────────────

describe('Settings extra - Cancel edit name', () => {

  test('Cancel button hides the name input', () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByDisplayValue('Alice')).not.toBeInTheDocument();
  });

  test('Cancel restores original name display', () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByDisplayValue('Alice'), { target: { value: 'Bob' } });
    fireEvent.click(screen.getByText('Cancel'));
    // Name field should be gone; Alice should be displayed again as a span
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleUpdateName — batch (lines 173-188)
// ─────────────────────────────────────────────────────────────────────────────

describe('Settings extra - handleUpdateName batch update', () => {

  test('Calls getDocs to fetch all groups the user belongs to', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByDisplayValue('Alice'), { target: { value: 'Emmano' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(mockGetDocs).toHaveBeenCalled());
  });

  test('Calls writeBatch to batch the group member updates', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByDisplayValue('Alice'), { target: { value: 'Emmano' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(mockWriteBatch).toHaveBeenCalled());
  });

  test('Calls batch.update for each group returned', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByDisplayValue('Alice'), { target: { value: 'Emmano' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(mockBatch.update).toHaveBeenCalledWith(
      'group-ref',
      { members: [{ userId: 'user-123', name: 'Emmano' }] }
    ));
  });

  test('Calls batch.commit after updating all groups', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByDisplayValue('Alice'), { target: { value: 'Emmano' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(mockBatch.commit).toHaveBeenCalled());
  });

  test('Shows success message after name update completes', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByDisplayValue('Alice'), { target: { value: 'Emmano' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() =>
      expect(screen.getByText('Name updated successfully!')).toBeInTheDocument()
    );
  });

  test('Hides edit input after successful save', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByDisplayValue('Alice'), { target: { value: 'Emmano' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() =>
      expect(screen.queryByDisplayValue('Emmano')).not.toBeInTheDocument()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Biometric disable (lines 259-273)
// ─────────────────────────────────────────────────────────────────────────────

describe('Settings extra - Biometric disable flow', () => {

  // To test disabling, biometric must already be enabled
  // We simulate this by making isBiometricEnabledOnDevice return true initially
  // then toggling off
  beforeEach(() => {
    mockIsBiometricEnabledOnDevice.mockReturnValue(true);
    mockAuthenticateWithBiometric.mockResolvedValue(true);
    mockDisableBiometric.mockReturnValue();
  });

  test('Calls authenticateWithBiometric when disabling biometric', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByLabelText('Toggle biometric authentication'));
    await waitFor(() =>
      expect(mockAuthenticateWithBiometric).toHaveBeenCalledWith(
        'user-123',
        expect.stringContaining('disable')
      )
    );
  });

  test('Calls disableBiometric after successful authentication', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByLabelText('Toggle biometric authentication'));
    await waitFor(() => expect(mockDisableBiometric).toHaveBeenCalledWith('user-123'));
  });

  test('Shows disabled success message after disabling biometric', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByLabelText('Toggle biometric authentication'));
    await waitFor(() =>
      expect(
        screen.getByText(/Biometric authentication disabled/i)
      ).toBeInTheDocument()
    );
  });

  test('Does not disable if authentication fails', async () => {
    mockAuthenticateWithBiometric.mockResolvedValue(false);
    render(<Settings />);
    fireEvent.click(screen.getByLabelText('Toggle biometric authentication'));
    await waitFor(() => expect(mockAuthenticateWithBiometric).toHaveBeenCalled());
    expect(mockDisableBiometric).not.toHaveBeenCalled();
  });

  test('Shows error when biometric disable throws', async () => {
    mockAuthenticateWithBiometric.mockRejectedValue(new Error('Auth error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<Settings />);
    fireEvent.click(screen.getByLabelText('Toggle biometric authentication'));
    await waitFor(() =>
      expect(screen.getByText('Failed to disable biometric authentication')).toBeInTheDocument()
    );
    consoleSpy.mockRestore();
  });
});
