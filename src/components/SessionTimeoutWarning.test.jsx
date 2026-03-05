// src/components/SessionTimeoutWarning.test.jsx
// Tests for SessionTimeoutWarning modal component

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SessionTimeoutWarning from './SessionTimeoutWarning';

const defaultProps = {
  isOpen:         true,
  countdown:      30,
  onStayLoggedIn: jest.fn(),
  onLogoutNow:    jest.fn(),
};

describe('SessionTimeoutWarning', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Renders nothing when isOpen is false', () => {
    render(<SessionTimeoutWarning {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Session Timeout')).not.toBeInTheDocument();
  });

  test('Renders modal when isOpen is true', () => {
    render(<SessionTimeoutWarning {...defaultProps} />);
    expect(screen.getByText('Session Timeout')).toBeInTheDocument();
  });

  test('Displays the countdown value', () => {
    render(<SessionTimeoutWarning {...defaultProps} countdown={15} />);
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  test('Displays seconds label', () => {
    render(<SessionTimeoutWarning {...defaultProps} />);
    expect(screen.getByText('seconds')).toBeInTheDocument();
  });

  test('Renders Stay Logged In button', () => {
    render(<SessionTimeoutWarning {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Stay Logged In' })).toBeInTheDocument();
  });

  test('Renders Logout Now button', () => {
    render(<SessionTimeoutWarning {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Logout Now' })).toBeInTheDocument();
  });

  test('Calls onStayLoggedIn when Stay Logged In is clicked', () => {
    render(<SessionTimeoutWarning {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Stay Logged In' }));
    expect(defaultProps.onStayLoggedIn).toHaveBeenCalledTimes(1);
  });

  test('Calls onLogoutNow when Logout Now is clicked', () => {
    render(<SessionTimeoutWarning {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Logout Now' }));
    expect(defaultProps.onLogoutNow).toHaveBeenCalledTimes(1);
  });

  test('Shows inactivity message', () => {
    render(<SessionTimeoutWarning {...defaultProps} />);
    expect(screen.getByText("You've been inactive")).toBeInTheDocument();
  });

  test('Shows settings hint text', () => {
    render(<SessionTimeoutWarning {...defaultProps} />);
    expect(screen.getByText(/Settings.*Security/)).toBeInTheDocument();
  });
});
