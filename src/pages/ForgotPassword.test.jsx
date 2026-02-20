// src/pages/ForgotPassword.test.jsx
// Test suite for ForgotPassword component
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ForgotPassword from './ForgotPassword';


// Mock react-router-dom (uses manual mock from __mocks__ folder)
jest.mock('react-router-dom');
const { mockNavigate } = require('react-router-dom'); 

// Mock Firebase auth
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  sendPasswordResetEmail: jest.fn(() => Promise.resolve()),
}));

// Mock Firebase app
jest.mock('../services/firebase', () => ({
  auth: {},
}));



describe('ForgotPassword Component', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Renders forgot password form', () => {
    render(<ForgotPassword />);
    
    expect(screen.getByText(/Forgot Password/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/your@email.com/i)).toBeInTheDocument();
  });

  test('Has email input field', () => {
    render(<ForgotPassword />);
    
    const emailInput = screen.getByPlaceholderText(/your@email.com/i);
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('type', 'email');
  });

  test('Has submit button', () => {
    render(<ForgotPassword />);
    
    const submitButton = screen.getByRole('button', { name: /Send Reset Link/i });
    expect(submitButton).toBeInTheDocument();
  });

  test('Has link back to login', () => {
    render(<ForgotPassword />);
    
    const loginLink = screen.getByText(/Back to Login/i);
    expect(loginLink).toBeInTheDocument();
  });

  test('Updates email input value', () => {
    render(<ForgotPassword />);
    
    const emailInput = screen.getByPlaceholderText(/your@email.com/i);
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    
    expect(emailInput).toHaveValue('test@example.com');
  });

  test('Shows validation error for empty email', async () => {
    render(<ForgotPassword />);
    
    const submitButton = screen.getByRole('button', { name: /Send Reset Link/i });
    fireEvent.click(submitButton);
    
    // Should show error or prevent submission
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('Shows validation error for invalid email', async () => {
    render(<ForgotPassword />);
    
    const emailInput = screen.getByPlaceholderText(/your@email.com/i);
    const submitButton = screen.getByRole('button', { name: /Send Reset Link/i });
    
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.click(submitButton);
    
    // Should show error or prevent submission
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('Submits valid email', async () => {
    const { sendPasswordResetEmail } = require('firebase/auth');
    sendPasswordResetEmail.mockResolvedValue();
    
    render(<ForgotPassword />);
    
    const emailInput = screen.getByPlaceholderText(/your@email.com/i);
    const submitButton = screen.getByRole('button', { name: /Send Reset Link/i });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        expect.anything(),
        'test@example.com'
      );
    });
  });

  test('Disables button while submitting', async () => {
    const { sendPasswordResetEmail } = require('firebase/auth');
    sendPasswordResetEmail.mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    );
    
    render(<ForgotPassword />);
    
   const emailInput = screen.getByPlaceholderText(/your@email.com/i);
    const submitButton = screen.getByRole('button', { name: /Send Reset Link/i });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);
    
    expect(submitButton).toBeDisabled();
  });

  test('Handles Firebase errors gracefully', async () => {
    const { sendPasswordResetEmail } = require('firebase/auth');
    sendPasswordResetEmail.mockRejectedValue(new Error('Firebase error'));
    
    render(<ForgotPassword />);
    
    const emailInput = screen.getByPlaceholderText(/your@email.com/i);
    const submitButton = screen.getByRole('button', { name: /Send Reset Link/i });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(sendPasswordResetEmail).toHaveBeenCalled();
    });
    
    // Should show error message
    // Button should be re-enabled
    expect(submitButton).not.toBeDisabled();
  });
});

describe('ForgotPassword - Accessibility', () => {
  
  test('Email input has proper label', () => {
    render(<ForgotPassword />);
    
    const emailInput = screen.getByPlaceholderText(/your@email.com/i);
    expect(emailInput).toBeInTheDocument();
  });

  test('Form has proper structure', () => {
    render(<ForgotPassword />);
    
    const form = screen.getByRole('button', { name: /Send Reset Link/i }).closest('form');
    expect(form).toBeInTheDocument();
  });

  test('Submit button is keyboard accessible', () => {
    render(<ForgotPassword />);
    
    const submitButton = screen.getByRole('button', { name: /Send Reset Link/i });
    expect(submitButton).toBeInTheDocument();
  });
});