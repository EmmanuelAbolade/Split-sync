// src/components/PaymentInfoModal.test.jsx
// Tests for PaymentInfoModal component

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PaymentInfoModal from './PaymentInfoModal';

const mockOnClose   = jest.fn();
const mockOnProceed = jest.fn();

const baseInfo = {
  method:   'paypal',
  amount:   50,
  currency: 'EUR',
  username: 'alice',
  onProceed: mockOnProceed,
};

const renderModal = (props = {}) =>
  render(
    <PaymentInfoModal
      isOpen={true}
      onClose={mockOnClose}
      paymentInfo={{ ...baseInfo, ...props }}
    />
  );

describe('PaymentInfoModal', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Renders nothing when isOpen is false', () => {
    render(<PaymentInfoModal isOpen={false} onClose={mockOnClose} paymentInfo={baseInfo} />);
    expect(screen.queryByText('Opening PayPal')).not.toBeInTheDocument();
  });

  test('Renders nothing when paymentInfo is null', () => {
    render(<PaymentInfoModal isOpen={true} onClose={mockOnClose} paymentInfo={null} />);
    expect(screen.queryByText('Payment Instructions')).not.toBeInTheDocument();
  });

  test('Renders modal title for PayPal', () => {
    renderModal();
    expect(screen.getByText('Opening PayPal')).toBeInTheDocument();
  });

  test('Renders modal title for Revolut', () => {
    renderModal({ method: 'revolut' });
    expect(screen.getByText('Opening Revolut')).toBeInTheDocument();
  });

  test('Renders default title for unknown method', () => {
    renderModal({ method: 'other' });
    expect(screen.getByText('Opening Payment')).toBeInTheDocument();
  });

  test('Displays formatted amount', () => {
    renderModal({ amount: 42.5 });
    expect(screen.getAllByText(/42\.50/).length).toBeGreaterThan(0);
  });

  test('Displays recipient username', () => {
    renderModal({ username: 'bob' });
    expect(screen.getByText('@bob')).toBeInTheDocument();
  });

  test('Renders Cancel button', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  test('Calls onClose when Cancel is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('Calls onProceed and onClose when Open PayPal is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Open PayPal/i }));
    expect(mockOnProceed).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('Shows Revolut mobile tip for revolut method', () => {
    renderModal({ method: 'revolut' });
    expect(screen.getByText(/Using mobile/)).toBeInTheDocument();
  });

  test('Does not show Revolut mobile tip for PayPal method', () => {
    renderModal({ method: 'paypal' });
    expect(screen.queryByText(/Using mobile/)).not.toBeInTheDocument();
  });

  test('Shows PayPal-specific login instruction', () => {
    renderModal({ method: 'paypal' });
    expect(screen.getByText(/Securely Login to your PayPal account/)).toBeInTheDocument();
  });

  test('Shows Revolut-specific instruction', () => {
    renderModal({ method: 'revolut' });
    expect(screen.getAllByText(/Pay with Card/).length).toBeGreaterThan(0);
  });
});
