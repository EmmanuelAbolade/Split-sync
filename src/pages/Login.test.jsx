// src/pages/Login.test.jsx
// Test suite for Login page - email/password auth, Google sign-in, biometric, and form validation

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockSignInWithEmailAndPassword = jest.fn();
const mockSignInWithPopup             = jest.fn();
const mockSignOut                     = jest.fn();
jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: (...a) => mockSignInWithEmailAndPassword(...a),
  signInWithPopup:             (...a) => mockSignInWithPopup(...a),
  GoogleAuthProvider:          jest.fn().mockImplementation(() => ({})),
}));

const mockGetDoc  = jest.fn();
const mockSetDoc  = jest.fn();
const mockDoc     = jest.fn();
jest.mock('firebase/firestore', () => ({
  doc:             (...a) => mockDoc(...a),
  getDoc:          (...a) => mockGetDoc(...a),
  setDoc:          (...a) => mockSetDoc(...a),
  serverTimestamp: () => 'SERVER_TIMESTAMP',
}));

jest.mock('../services/firebase', () => ({
  auth: { signOut: (...a) => mockSignOut(...a) },
  db:   {},
}));

const mockSetUser = jest.fn();
jest.mock('../stores/authStore', () => ({
  useAuthStore: (selector) => selector({ setUser: mockSetUser }),
}));

const mockIsBiometricEnabled   = jest.fn();
const mockAuthenticateWithBiometric = jest.fn();
jest.mock('../utils/biometric', () => ({
  isBiometricEnabledOnDevice:  (...a) => mockIsBiometricEnabled(...a),
  authenticateWithBiometric:   (...a) => mockAuthenticateWithBiometric(...a),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────
import Login from './Login';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fillAndSubmit = (email = 'test@example.com', password = 'password123') => {
  fireEvent.change(screen.getByPlaceholderText('john@example.com'), {
    target: { value: email },
  });
  fireEvent.change(screen.getByPlaceholderText('••••••••'), {
    target: { value: password },
  });
  fireEvent.click(screen.getByText('LOGIN'));
};

// ─────────────────────────────────────────────────────────────────────────────

describe('Login - Rendering', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsBiometricEnabled.mockReturnValue(false);
  });

  test('Renders email input', () => {
    render(<Login />);
    expect(screen.getByPlaceholderText('john@example.com')).toBeInTheDocument();
  });

  test('Renders password input', () => {
    render(<Login />);
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });

  test('Renders LOGIN button', () => {
    render(<Login />);
    expect(screen.getByText('LOGIN')).toBeInTheDocument();
  });

  test('Renders Continue with Google button', () => {
    render(<Login />);
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
  });

  test('Renders Forgot Password link', () => {
    render(<Login />);
    expect(screen.getByText('Forgot Password?')).toBeInTheDocument();
  });

  test('Renders Sign Up link', () => {
    render(<Login />);
    expect(screen.getByText('Sign Up')).toBeInTheDocument();
  });

  test('Password input is hidden by default', () => {
    render(<Login />);
    expect(screen.getByPlaceholderText('••••••••')).toHaveAttribute('type', 'password');
  });

  test('Does not show error message initially', () => {
    render(<Login />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Login - Password visibility toggle', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsBiometricEnabled.mockReturnValue(false);
  });

  test('Toggles password to text when eye button clicked', () => {
    render(<Login />);
    fireEvent.click(screen.getByLabelText('Toggle password visibility'));
    expect(screen.getByPlaceholderText('••••••••')).toHaveAttribute('type', 'text');
  });

  test('Toggles password back to hidden on second click', () => {
    render(<Login />);
    const toggle = screen.getByLabelText('Toggle password visibility');
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(screen.getByPlaceholderText('••••••••')).toHaveAttribute('type', 'password');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Login - Navigation', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsBiometricEnabled.mockReturnValue(false);
  });

  test('Navigates to /forgot-password when Forgot Password is clicked', () => {
    render(<Login />);
    fireEvent.click(screen.getByText('Forgot Password?'));
    expect(mockNavigate).toHaveBeenCalledWith('/forgot-password');
  });

  test('Navigates to /register when Sign Up is clicked', () => {
    render(<Login />);
    fireEvent.click(screen.getByText('Sign Up'));
    expect(mockNavigate).toHaveBeenCalledWith('/register');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Login - Email/password successful login', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsBiometricEnabled.mockReturnValue(false);
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: { uid: 'user-123', email: 'test@example.com' },
    });
  });

  test('Calls signInWithEmailAndPassword with correct credentials', async () => {
    render(<Login />);
    fillAndSubmit('test@example.com', 'password123');
    await waitFor(() => expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(), 'test@example.com', 'password123'
    ));
  });

  test('Calls setUser after successful login', async () => {
    render(<Login />);
    fillAndSubmit();
    await waitFor(() => expect(mockSetUser).toHaveBeenCalled());
  });

  test('Navigates to /dashboard after successful login', async () => {
    render(<Login />);
    fillAndSubmit();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
  });

  test('Shows loading state while logging in', async () => {
    mockSignInWithEmailAndPassword.mockImplementation(() => new Promise(() => {}));
    render(<Login />);
    fillAndSubmit();
    await waitFor(() => expect(screen.getByText('Logging in...')).toBeInTheDocument());
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Login - Email/password error handling', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsBiometricEnabled.mockReturnValue(false);
  });

  test('Shows invalid credential error', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue({ code: 'auth/invalid-credential' });
    render(<Login />);
    fillAndSubmit();
    await waitFor(() => expect(screen.getByText('Invalid email or password')).toBeInTheDocument());
  });

  test('Shows user not found error', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue({ code: 'auth/user-not-found' });
    render(<Login />);
    fillAndSubmit();
    await waitFor(() => expect(screen.getByText('No account found with this email')).toBeInTheDocument());
  });

  test('Shows wrong password error', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue({ code: 'auth/wrong-password' });
    render(<Login />);
    fillAndSubmit();
    await waitFor(() => expect(screen.getByText('Incorrect password')).toBeInTheDocument());
  });

  test('Shows generic error for unknown error code', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue({ code: 'auth/unknown' });
    render(<Login />);
    fillAndSubmit();
    await waitFor(() => expect(screen.getByText('Failed to login. Please try again.')).toBeInTheDocument());
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Login - Biometric authentication', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: { uid: 'user-123', email: 'test@example.com' },
    });
  });

  test('Calls authenticateWithBiometric when biometric is enabled', async () => {
    mockIsBiometricEnabled.mockReturnValue(true);
    mockAuthenticateWithBiometric.mockResolvedValue(true);
    render(<Login />);
    fillAndSubmit();
    await waitFor(() => expect(mockAuthenticateWithBiometric).toHaveBeenCalled());
  });

  test('Navigates to dashboard when biometric passes', async () => {
    mockIsBiometricEnabled.mockReturnValue(true);
    mockAuthenticateWithBiometric.mockResolvedValue(true);
    render(<Login />);
    fillAndSubmit();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
  });

  test('Shows biometric error when biometric fails', async () => {
    mockIsBiometricEnabled.mockReturnValue(true);
    mockAuthenticateWithBiometric.mockResolvedValue(false);
    mockSignOut.mockResolvedValue();
    render(<Login />);
    fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByText('Biometric authentication required to login on this device')).toBeInTheDocument()
    );
  });

  test('Does not call biometric when not enabled', async () => {
    mockIsBiometricEnabled.mockReturnValue(false);
    render(<Login />);
    fillAndSubmit();
    await waitFor(() => expect(mockAuthenticateWithBiometric).not.toHaveBeenCalled());
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Login - Google sign-in', () => {

  const mockUser = {
    uid: 'google-user-123',
    email: 'alice@gmail.com',
    displayName: 'Alice',
    photoURL: 'https://example.com/photo.jpg',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsBiometricEnabled.mockReturnValue(false);
    mockSignInWithPopup.mockResolvedValue({ user: mockUser });
    mockDoc.mockReturnValue('mock-doc-ref');
    mockSetDoc.mockResolvedValue();
  });

  test('Calls signInWithPopup when Google button clicked', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    render(<Login />);
    fireEvent.click(screen.getByText('Continue with Google'));
    await waitFor(() => expect(mockSignInWithPopup).toHaveBeenCalled());
  });

  test('Creates Firestore document for new Google user', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    render(<Login />);
    fireEvent.click(screen.getByText('Continue with Google'));
    await waitFor(() => expect(mockSetDoc).toHaveBeenCalled());
  });

  test('Does not create document for existing Google user without new photo', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ customPhotoURL: 'custom.jpg', displayName: 'Alice' }),
    });
    render(<Login />);
    fireEvent.click(screen.getByText('Continue with Google'));
    await waitFor(() => expect(mockSetDoc).not.toHaveBeenCalled());
  });

  test('Navigates to /dashboard after successful Google sign-in', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    render(<Login />);
    fireEvent.click(screen.getByText('Continue with Google'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
  });

  test('Shows popup-closed error', async () => {
    mockSignInWithPopup.mockRejectedValue({ code: 'auth/popup-closed-by-user' });
    render(<Login />);
    fireEvent.click(screen.getByText('Continue with Google'));
    await waitFor(() => expect(screen.getByText('Sign-in cancelled')).toBeInTheDocument());
  });

  test('Shows popup-blocked error', async () => {
    mockSignInWithPopup.mockRejectedValue({ code: 'auth/popup-blocked' });
    render(<Login />);
    fireEvent.click(screen.getByText('Continue with Google'));
    await waitFor(() =>
      expect(screen.getByText('Pop-up blocked. Please allow pop-ups for this site.')).toBeInTheDocument()
    );
  });

  test('Shows generic error for unknown Google sign-in error', async () => {
    mockSignInWithPopup.mockRejectedValue({ code: 'auth/unknown' });
    render(<Login />);
    fireEvent.click(screen.getByText('Continue with Google'));
    await waitFor(() =>
      expect(screen.getByText('Failed to sign in with Google. Please try again.')).toBeInTheDocument()
    );
  });

  test('Updates photo for existing user when Google has a new photo', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ displayName: 'Alice', customPhotoURL: null }),
    });
    render(<Login />);
    fireEvent.click(screen.getByText('Continue with Google'));
    await waitFor(() => expect(mockSetDoc).toHaveBeenCalled());
  });
});