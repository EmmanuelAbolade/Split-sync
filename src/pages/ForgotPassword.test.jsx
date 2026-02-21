// src/pages/ForgotPassword.test.jsx
// Test suite for ForgotPassword page - form rendering, reset email, success/error states

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockSendPasswordResetEmail = jest.fn();
jest.mock('firebase/auth', () => ({
  sendPasswordResetEmail: (...a) => mockSendPasswordResetEmail(...a),
}));

jest.mock('../services/firebase', () => ({ auth: {} }));

// ─── Import after mocks ───────────────────────────────────────────────────────
import ForgotPassword from './ForgotPassword';

// ─────────────────────────────────────────────────────────────────────────────

describe('ForgotPassword - Rendering', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Renders page heading', () => {
    render(<ForgotPassword />);
    expect(screen.getByText('Forgot Password?')).toBeInTheDocument();
  });

  test('Renders email input', () => {
    render(<ForgotPassword />);
    expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
  });

  test('Renders Send Reset Link button', () => {
    render(<ForgotPassword />);
    expect(screen.getByText('Send Reset Link')).toBeInTheDocument();
  });

  test('Renders Back to Login button', () => {
    render(<ForgotPassword />);
    expect(screen.getByText('Back to Login')).toBeInTheDocument();
  });

  test('Renders Log In link', () => {
    render(<ForgotPassword />);
    expect(screen.getByText('Log In')).toBeInTheDocument();
  });

  test('Does not show error initially', () => {
    render(<ForgotPassword />);
    expect(screen.queryByText(/No account found/i)).not.toBeInTheDocument();
  });

  test('Does not show success screen initially', () => {
    render(<ForgotPassword />);
    expect(screen.queryByText('Check Your Email')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('ForgotPassword - Navigation', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Navigates to /login when Back to Login is clicked', () => {
    render(<ForgotPassword />);
    fireEvent.click(screen.getByText('Back to Login'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  test('Navigates to /login when Log In link is clicked', () => {
    render(<ForgotPassword />);
    fireEvent.click(screen.getByText('Log In'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('ForgotPassword - Successful reset', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendPasswordResetEmail.mockResolvedValue();
  });

  test('Calls sendPasswordResetEmail with entered email', async () => {
    render(<ForgotPassword />);
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('Send Reset Link'));
    await waitFor(() =>
      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
        expect.anything(), 'test@example.com'
      )
    );
  });

  test('Shows success screen after successful reset', async () => {
    render(<ForgotPassword />);
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('Send Reset Link'));
    await waitFor(() =>
      expect(screen.getByText('Check Your Email')).toBeInTheDocument()
    );
  });

  test('Shows entered email on success screen', async () => {
    render(<ForgotPassword />);
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'alice@example.com' },
    });
    fireEvent.click(screen.getByText('Send Reset Link'));
    await waitFor(() =>
      expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    );
  });

  test('Shows loading state while sending', async () => {
    mockSendPasswordResetEmail.mockImplementation(() => new Promise(() => {}));
    render(<ForgotPassword />);
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('Send Reset Link'));
    await waitFor(() =>
      expect(screen.getByText('Sending...')).toBeInTheDocument()
    );
  });

  test('Navigates to /login from success screen', async () => {
    render(<ForgotPassword />);
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('Send Reset Link'));
    await waitFor(() => screen.getByText('Check Your Email'));
    fireEvent.click(screen.getByText('Back to Login'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('ForgotPassword - Error handling', () => {

  beforeEach(() => jest.clearAllMocks());

  const submit = () => {
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByText('Send Reset Link'));
  };

  test('Shows user not found error', async () => {
    mockSendPasswordResetEmail.mockRejectedValue({ code: 'auth/user-not-found' });
    render(<ForgotPassword />);
    submit();
    await waitFor(() =>
      expect(screen.getByText('No account found with this email address')).toBeInTheDocument()
    );
  });

  test('Shows invalid email error', async () => {
    mockSendPasswordResetEmail.mockRejectedValue({ code: 'auth/invalid-email' });
    render(<ForgotPassword />);
    submit();
    await waitFor(() =>
      expect(screen.getByText('Invalid email address')).toBeInTheDocument()
    );
  });

  test('Shows too many requests error', async () => {
    mockSendPasswordResetEmail.mockRejectedValue({ code: 'auth/too-many-requests' });
    render(<ForgotPassword />);
    submit();
    await waitFor(() =>
      expect(screen.getByText('Too many attempts. Please try again later')).toBeInTheDocument()
    );
  });

  test('Shows generic error for unknown code', async () => {
    mockSendPasswordResetEmail.mockRejectedValue({ code: 'auth/unknown' });
    render(<ForgotPassword />);
    submit();
    await waitFor(() =>
      expect(screen.getByText('Failed to send reset email. Please try again.')).toBeInTheDocument()
    );
  });

  test('Does not show success screen on error', async () => {
    mockSendPasswordResetEmail.mockRejectedValue({ code: 'auth/unknown' });
    render(<ForgotPassword />);
    submit();
    await waitFor(() => screen.getByText('Failed to send reset email. Please try again.'));
    expect(screen.queryByText('Check Your Email')).not.toBeInTheDocument();
  });
});