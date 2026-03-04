// src/pages/ForgotPassword.test.jsx
// Test suite for ForgotPassword page
// Covers: rendering, navigation, successful reset, loading state, error handling, Google account screen

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockSendPasswordResetEmail = jest.fn();
const mockFetchSignInMethodsForEmail = jest.fn();

jest.mock('firebase/auth', () => ({
  sendPasswordResetEmail: (...a) => mockSendPasswordResetEmail(...a),
  fetchSignInMethodsForEmail: (...a) => mockFetchSignInMethodsForEmail(...a),
}));

jest.mock('../services/firebase', () => ({ auth: {} }));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import ForgotPassword from './ForgotPassword';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fillAndSubmit = (email = 'test@example.com') => {
  fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
    target: { value: email },
  });
  fireEvent.click(screen.getByText('Send Reset Link'));
};

// ---------------------------------------------------------------------------
// 1. Rendering
// ---------------------------------------------------------------------------

describe('ForgotPassword - Rendering', () => {
  beforeEach(() => jest.clearAllMocks());

  test('renders page heading', () => {
    render(<ForgotPassword />);
    expect(screen.getByText('Forgot Password?')).toBeInTheDocument();
  });

  test('renders email input', () => {
    render(<ForgotPassword />);
    expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
  });

  test('renders Send Reset Link button', () => {
    render(<ForgotPassword />);
    expect(screen.getByText('Send Reset Link')).toBeInTheDocument();
  });

  test('renders Back to Login button', () => {
    render(<ForgotPassword />);
    expect(screen.getByText('Back to Login')).toBeInTheDocument();
  });

  test('renders Log In link', () => {
    render(<ForgotPassword />);
    expect(screen.getByText('Log In')).toBeInTheDocument();
  });

  test('does not show error initially', () => {
    render(<ForgotPassword />);
    expect(screen.queryByText(/Failed to send/i)).not.toBeInTheDocument();
  });

  test('does not show success screen initially', () => {
    render(<ForgotPassword />);
    expect(screen.queryByText('Check Your Email')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Navigation
// ---------------------------------------------------------------------------

describe('ForgotPassword - Navigation', () => {
  beforeEach(() => jest.clearAllMocks());

  test('navigates to /login when Back to Login is clicked', () => {
    render(<ForgotPassword />);
    fireEvent.click(screen.getByText('Back to Login'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  test('navigates to /login when Log In link is clicked', () => {
    render(<ForgotPassword />);
    fireEvent.click(screen.getByText('Log In'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});

// ---------------------------------------------------------------------------
// 3. Successful reset
// ---------------------------------------------------------------------------

describe('ForgotPassword - Successful reset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // fetchSignInMethodsForEmail must return [] (no methods) so the password flow proceeds
    mockFetchSignInMethodsForEmail.mockResolvedValue([]);
    mockSendPasswordResetEmail.mockResolvedValue();
  });

  test('calls sendPasswordResetEmail with entered email', async () => {
    render(<ForgotPassword />);
    fillAndSubmit('test@example.com');
    await waitFor(() =>
      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
        expect.anything(),
        'test@example.com'
      )
    );
  });

  test('shows success screen after successful reset', async () => {
    render(<ForgotPassword />);
    fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByText('Check Your Email')).toBeInTheDocument()
    );
  });

  test('shows entered email on success screen', async () => {
    render(<ForgotPassword />);
    fillAndSubmit('alice@example.com');
    await waitFor(() =>
      expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    );
  });

  test('shows loading state while sending', async () => {
    // fetchSignInMethods resolves immediately, sendPasswordResetEmail never resolves
    mockSendPasswordResetEmail.mockImplementation(() => new Promise(() => {}));
    render(<ForgotPassword />);
    fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByText('Sending...')).toBeInTheDocument()
    );
  });

  test('navigates to /login from success screen Back to Login button', async () => {
    render(<ForgotPassword />);
    fillAndSubmit();
    await waitFor(() => screen.getByText('Check Your Email'));
    fireEvent.click(screen.getByText('Back to Login'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  test('returns to form when Resend button is clicked on success screen', async () => {
    render(<ForgotPassword />);
    fillAndSubmit();
    await waitFor(() => screen.getByText('Check Your Email'));
    fireEvent.click(screen.getByText("Didn't receive it? Send again"));
    expect(screen.getByText('Forgot Password?')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 4. Google account screen
// ---------------------------------------------------------------------------

describe('ForgotPassword - Google Account Detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Return google.com method only — no password method
    mockFetchSignInMethodsForEmail.mockResolvedValue(['google.com']);
  });

  test('shows Google account detected screen', async () => {
    render(<ForgotPassword />);
    fillAndSubmit('google-user@example.com');
    await waitFor(() =>
      expect(screen.getByText('Google Account Detected')).toBeInTheDocument()
    );
  });

  test('does not call sendPasswordResetEmail for Google accounts', async () => {
    render(<ForgotPassword />);
    fillAndSubmit();
    await waitFor(() => screen.getByText('Google Account Detected'));
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test('navigates to /login when Back to Login is clicked on Google screen', async () => {
    render(<ForgotPassword />);
    fillAndSubmit();
    await waitFor(() => screen.getByText('Google Account Detected'));
    fireEvent.click(screen.getByText('Back to Login'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  test('returns to form when Try a different email is clicked', async () => {
    render(<ForgotPassword />);
    fillAndSubmit();
    await waitFor(() => screen.getByText('Google Account Detected'));
    fireEvent.click(screen.getByText('Try a different email'));
    expect(screen.getByText('Forgot Password?')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 5. Error handling
// ---------------------------------------------------------------------------

describe('ForgotPassword - Error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // fetchSignInMethodsForEmail returns [] so password flow runs
    mockFetchSignInMethodsForEmail.mockResolvedValue([]);
  });

  test('shows success screen for auth/user-not-found (security: no email enumeration)', async () => {
    // Component intentionally shows success for user-not-found to prevent email enumeration
    mockSendPasswordResetEmail.mockRejectedValue({ code: 'auth/user-not-found' });
    render(<ForgotPassword />);
    fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByText('Check Your Email')).toBeInTheDocument()
    );
  });

  test('shows valid email address error for auth/invalid-email', async () => {
    mockSendPasswordResetEmail.mockRejectedValue({ code: 'auth/invalid-email' });
    render(<ForgotPassword />);
    fillAndSubmit();
    await waitFor(() =>
      expect(
        screen.getByText('Please enter a valid email address.')
      ).toBeInTheDocument()
    );
  });

  test('shows too many attempts error for auth/too-many-requests', async () => {
    mockSendPasswordResetEmail.mockRejectedValue({ code: 'auth/too-many-requests' });
    render(<ForgotPassword />);
    fillAndSubmit();
    await waitFor(() =>
      expect(
        screen.getByText('Too many attempts. Please wait a few minutes and try again.')
      ).toBeInTheDocument()
    );
  });

  test('shows network error for auth/network-request-failed', async () => {
    mockSendPasswordResetEmail.mockRejectedValue({ code: 'auth/network-request-failed' });
    render(<ForgotPassword />);
    fillAndSubmit();
    await waitFor(() =>
      expect(
        screen.getByText('Network error. Please check your connection and try again.')
      ).toBeInTheDocument()
    );
  });

  test('shows generic error for unknown error code', async () => {
    mockSendPasswordResetEmail.mockRejectedValue({ code: 'auth/unknown' });
    render(<ForgotPassword />);
    fillAndSubmit();
    await waitFor(() =>
      expect(
        screen.getByText('Failed to send reset email. Please try again.')
      ).toBeInTheDocument()
    );
  });

  test('does not show success screen when a real error occurs', async () => {
    mockSendPasswordResetEmail.mockRejectedValue({ code: 'auth/unknown' });
    render(<ForgotPassword />);
    fillAndSubmit();
    await waitFor(() =>
      screen.getByText('Failed to send reset email. Please try again.')
    );
    expect(screen.queryByText('Check Your Email')).not.toBeInTheDocument();
  });
});
