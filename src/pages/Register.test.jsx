// src/pages/Register.test.jsx
// Test suite for Register page - form validation, account creation, and error handling

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockCreateUserWithEmailAndPassword = jest.fn();
const mockUpdateProfile                  = jest.fn();
jest.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: (...a) => mockCreateUserWithEmailAndPassword(...a),
  updateProfile:                  (...a) => mockUpdateProfile(...a),
}));

const mockSetDoc = jest.fn();
const mockDoc    = jest.fn();
jest.mock('firebase/firestore', () => ({
  doc:    (...a) => mockDoc(...a),
  setDoc: (...a) => mockSetDoc(...a),
}));

jest.mock('../services/firebase', () => ({ auth: {}, db: {} }));

const mockSetUser = jest.fn();
jest.mock('../stores/authStore', () => ({
  useAuthStore: (selector) => selector({ setUser: mockSetUser }),
}));

// Mock PasswordStrength to keep tests focused on Register logic
jest.mock('../components/PasswordStrength', () =>
  ({ password, onPasswordGenerate }) => (
    <div data-testid="password-strength">
      <button
        data-testid="generate-password"
        onClick={() => onPasswordGenerate('Generated@123')}
      >
        Generate
      </button>
    </div>
  )
);

// ─── Import after mocks ───────────────────────────────────────────────────────
import Register from './Register';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fillForm = ({
  name     = 'John Smith',
  email    = 'john@example.com',
  password = 'password123',
  confirm  = 'password123',
} = {}) => {
  fireEvent.change(screen.getByPlaceholderText('John Smith'),         { target: { value: name } });
  fireEvent.change(screen.getByPlaceholderText('john@example.com'),   { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText('Minimum 8 characters'), { target: { value: password } });
  fireEvent.change(screen.getByPlaceholderText('Re-enter password'),  { target: { value: confirm } });
};

const submitForm = () => fireEvent.click(screen.getByText('CREATE ACCOUNT'));

// ─────────────────────────────────────────────────────────────────────────────

describe('Register - Rendering', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Renders Full Name input', () => {
    render(<Register />);
    expect(screen.getByPlaceholderText('John Smith')).toBeInTheDocument();
  });

  test('Renders Email input', () => {
    render(<Register />);
    expect(screen.getByPlaceholderText('john@example.com')).toBeInTheDocument();
  });

  test('Renders Password input', () => {
    render(<Register />);
    expect(screen.getByPlaceholderText('Minimum 8 characters')).toBeInTheDocument();
  });

  test('Renders Confirm Password input', () => {
    render(<Register />);
    expect(screen.getByPlaceholderText('Re-enter password')).toBeInTheDocument();
  });

  test('Renders CREATE ACCOUNT button', () => {
    render(<Register />);
    expect(screen.getByText('CREATE ACCOUNT')).toBeInTheDocument();
  });

  test('Renders Log In link', () => {
    render(<Register />);
    expect(screen.getByText('Log In')).toBeInTheDocument();
  });

  test('Renders page heading', () => {
    render(<Register />);
    expect(screen.getByText('Create Your Account')).toBeInTheDocument();
  });

  test('Password field is hidden by default', () => {
    render(<Register />);
    expect(screen.getByPlaceholderText('Minimum 8 characters')).toHaveAttribute('type', 'password');
  });

  test('Confirm password field is hidden by default', () => {
    render(<Register />);
    expect(screen.getByPlaceholderText('Re-enter password')).toHaveAttribute('type', 'password');
  });

  test('Renders PasswordStrength component', () => {
    render(<Register />);
    expect(screen.getByTestId('password-strength')).toBeInTheDocument();
  });

  test('Does not show error message initially', () => {
    render(<Register />);
    expect(screen.queryByText(/passwords do not match/i)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Register - Password visibility toggles', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Toggles password field to text', () => {
    render(<Register />);
    const [togglePassword] = screen.getAllByLabelText(/toggle.*password visibility/i);
    fireEvent.click(togglePassword);
    expect(screen.getByPlaceholderText('Minimum 8 characters')).toHaveAttribute('type', 'text');
  });

  test('Toggles confirm password field to text', () => {
    render(<Register />);
    const toggles = screen.getAllByLabelText(/toggle.*password visibility/i);
    fireEvent.click(toggles[1]);
    expect(screen.getByPlaceholderText('Re-enter password')).toHaveAttribute('type', 'text');
  });

  test('Toggles password back to hidden', () => {
    render(<Register />);
    const [toggle] = screen.getAllByLabelText(/toggle.*password visibility/i);
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(screen.getByPlaceholderText('Minimum 8 characters')).toHaveAttribute('type', 'password');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Register - Form validation', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Shows error when passwords do not match', async () => {
    render(<Register />);
    fillForm({ password: 'password123', confirm: 'different123' });
    submitForm();
    await waitFor(() =>
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    );
  });

  test('Does not call Firebase when passwords do not match', async () => {
    render(<Register />);
    fillForm({ password: 'password123', confirm: 'different123' });
    submitForm();
    await waitFor(() => expect(mockCreateUserWithEmailAndPassword).not.toHaveBeenCalled());
  });

  test('Shows error when password is less than 8 characters', async () => {
    render(<Register />);
    fillForm({ password: 'short', confirm: 'short' });
    submitForm();
    await waitFor(() =>
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Register - Successful registration', () => {

  const mockUser = { uid: 'user-123', email: 'john@example.com' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
    mockUpdateProfile.mockResolvedValue();
    mockSetDoc.mockResolvedValue();
    mockDoc.mockReturnValue('mock-doc-ref');
  });

  test('Calls createUserWithEmailAndPassword with correct args', async () => {
    render(<Register />);
    fillForm();
    submitForm();
    await waitFor(() =>
      expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(), 'john@example.com', 'password123'
      )
    );
  });

  test('Calls updateProfile with correct display name', async () => {
    render(<Register />);
    fillForm();
    submitForm();
    await waitFor(() =>
      expect(mockUpdateProfile).toHaveBeenCalledWith(mockUser, { displayName: 'John Smith' })
    );
  });

  test('Creates Firestore user document', async () => {
    render(<Register />);
    fillForm();
    submitForm();
    await waitFor(() => expect(mockSetDoc).toHaveBeenCalled());
  });

  test('Firestore document includes isFirstLogin flag', async () => {
    render(<Register />);
    fillForm();
    submitForm();
    await waitFor(() =>
      expect(mockSetDoc).toHaveBeenCalledWith(
        'mock-doc-ref',
        expect.objectContaining({ isFirstLogin: true })
      )
    );
  });

  test('Calls setUser after successful registration', async () => {
    render(<Register />);
    fillForm();
    submitForm();
    await waitFor(() => expect(mockSetUser).toHaveBeenCalledWith(mockUser));
  });

  test('Navigates to /dashboard after registration', async () => {
    render(<Register />);
    fillForm();
    submitForm();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
  });

  test('Shows loading state while registering', async () => {
    mockCreateUserWithEmailAndPassword.mockImplementation(() => new Promise(() => {}));
    render(<Register />);
    fillForm();
    submitForm();
    await waitFor(() =>
      expect(screen.getByText('Creating account...')).toBeInTheDocument()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Register - Error handling', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Shows email already in use error', async () => {
    mockCreateUserWithEmailAndPassword.mockRejectedValue({ code: 'auth/email-already-in-use' });
    render(<Register />);
    fillForm();
    submitForm();
    await waitFor(() =>
      expect(screen.getByText('Email already in use')).toBeInTheDocument()
    );
  });

  test('Shows invalid email error', async () => {
    mockCreateUserWithEmailAndPassword.mockRejectedValue({ code: 'auth/invalid-email' });
    render(<Register />);
    fillForm();
    submitForm();
    await waitFor(() =>
      expect(screen.getByText('Invalid email address')).toBeInTheDocument()
    );
  });

  test('Shows weak password error', async () => {
    mockCreateUserWithEmailAndPassword.mockRejectedValue({ code: 'auth/weak-password' });
    render(<Register />);
    fillForm();
    submitForm();
    await waitFor(() =>
      expect(screen.getByText('Password is too weak')).toBeInTheDocument()
    );
  });

  test('Shows generic error for unknown error code', async () => {
    mockCreateUserWithEmailAndPassword.mockRejectedValue({ code: 'auth/unknown' });
    render(<Register />);
    fillForm();
    submitForm();
    await waitFor(() =>
      expect(screen.getByText('Failed to create account. Please try again.')).toBeInTheDocument()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Register - Navigation', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Navigates to /login when Log In is clicked', () => {
    render(<Register />);
    fireEvent.click(screen.getByText('Log In'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Register - Password generation', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Auto-fills both password fields when password is generated', () => {
    render(<Register />);
    fireEvent.click(screen.getByTestId('generate-password'));
    expect(screen.getByPlaceholderText('Minimum 8 characters').value).toBe('Generated@123');
    expect(screen.getByPlaceholderText('Re-enter password').value).toBe('Generated@123');
  });

  test('Hides both password fields after generation', () => {
    render(<Register />);
    // First show them
    const [togglePass, toggleConfirm] = screen.getAllByLabelText(/toggle.*password visibility/i);
    fireEvent.click(togglePass);
    fireEvent.click(toggleConfirm);
    // Generate should hide them again
    fireEvent.click(screen.getByTestId('generate-password'));
    expect(screen.getByPlaceholderText('Minimum 8 characters')).toHaveAttribute('type', 'password');
    expect(screen.getByPlaceholderText('Re-enter password')).toHaveAttribute('type', 'password');
  });
});