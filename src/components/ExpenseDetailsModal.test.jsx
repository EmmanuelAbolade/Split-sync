// src/components/ExpenseDetailsModal.test.jsx
// Tests for ExpenseDetailsModal - rendering, expense details, split breakdown,
// settlement display, receipt section, payment method info, close behaviour

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import ExpenseDetailsModal from './ExpenseDetailsModal';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockGroup = {
  id:       'group-123',
  name:     'Weekend Trip',
  currency: 'EUR',
  members: [
    { userId: 'user-123', name: 'Alice', email: 'alice@example.com' },
    { userId: 'user-456', name: 'Bob',   email: 'bob@example.com'   },
  ],
};

const mockExpense = {
  id:           'exp-1',
  title:        'Hotel Stay',
  amount:       200,
  currency:     'EUR',
  groupId:      'group-123',
  paidBy:       'user-123',
  participants: ['user-123', 'user-456'],
  splits:       { 'user-123': 100, 'user-456': 100 },
  splitMethod:  'equal',
  category:     'accommodation',
  date:         '2024-01-15T12:00:00.000Z',
  description:  'Shared hotel room for two nights',
  isSettlement: false,
};

const defaultProps = {
  isOpen:  true,
  onClose: jest.fn(),
  expense: mockExpense,
  group:   mockGroup,
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Visibility
// ---------------------------------------------------------------------------

describe('ExpenseDetailsModal - Visibility', () => {

  test('Renders when isOpen is true and expense is provided', () => {
    render(<ExpenseDetailsModal {...defaultProps} />);
    expect(screen.getByText('Hotel Stay')).toBeInTheDocument();
  });

  test('Does not render when isOpen is false', () => {
    render(<ExpenseDetailsModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Hotel Stay')).not.toBeInTheDocument();
  });

  test('Does not render when expense is null', () => {
    render(<ExpenseDetailsModal {...defaultProps} expense={null} />);
    expect(screen.queryByText('Hotel Stay')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Expense header and amount
// ---------------------------------------------------------------------------

describe('ExpenseDetailsModal - Header and amount', () => {

  test('Shows expense title in header', () => {
    render(<ExpenseDetailsModal {...defaultProps} />);
    expect(screen.getByText('Hotel Stay')).toBeInTheDocument();
  });

  test('Shows Total Amount label', () => {
    render(<ExpenseDetailsModal {...defaultProps} />);
    expect(screen.getByText('Total Amount')).toBeInTheDocument();
  });

  test('Shows formatted expense amount', () => {
    render(<ExpenseDetailsModal {...defaultProps} />);
    expect(screen.getByText('EUR 200.00')).toBeInTheDocument();
  });

  test('Does not show Settlement badge for regular expense', () => {
    render(<ExpenseDetailsModal {...defaultProps} />);
    expect(screen.queryByText('Settlement')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Details grid
// ---------------------------------------------------------------------------

describe('ExpenseDetailsModal - Details grid', () => {

  test('Shows Paid by label', () => {
    render(<ExpenseDetailsModal {...defaultProps} />);
    expect(screen.getByText('Paid by')).toBeInTheDocument();
  });

  test('Shows payer name', () => {
    render(<ExpenseDetailsModal {...defaultProps} />);
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
  });

  test('Shows payer email', () => {
    render(<ExpenseDetailsModal {...defaultProps} />);
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  test('Shows Date label', () => {
    render(<ExpenseDetailsModal {...defaultProps} />);
    expect(screen.getByText('Date')).toBeInTheDocument();
  });

  test('Shows Category label', () => {
    render(<ExpenseDetailsModal {...defaultProps} />);
    expect(screen.getByText('Category')).toBeInTheDocument();
  });

  test('Shows expense category', () => {
    render(<ExpenseDetailsModal {...defaultProps} />);
    expect(screen.getByText('accommodation')).toBeInTheDocument();
  });

  test('Shows Split Method label', () => {
    render(<ExpenseDetailsModal {...defaultProps} />);
    expect(screen.getByText('Split Method')).toBeInTheDocument();
  });

  test('Shows Split Equally for equal split method', () => {
    render(<ExpenseDetailsModal {...defaultProps} />);
    expect(screen.getByText('Split Equally')).toBeInTheDocument();
  });

  test('Shows Split by Percentage for percentage split method', () => {
    render(<ExpenseDetailsModal {...defaultProps}
      expense={{ ...mockExpense, splitMethod: 'percentage' }} />);
    expect(screen.getByText('Split by Percentage')).toBeInTheDocument();
  });

  test('Shows Exact Amounts for exact split method', () => {
    render(<ExpenseDetailsModal {...defaultProps}
      expense={{ ...mockExpense, splitMethod: 'exact' }} />);
    expect(screen.getByText('Exact Amounts')).toBeInTheDocument();
  });

  test('Shows Split by Shares for shares split method', () => {
    render(<ExpenseDetailsModal {...defaultProps}
      expense={{ ...mockExpense, splitMethod: 'shares' }} />);
    expect(screen.getByText('Split by Shares')).toBeInTheDocument();
  });

  test('Shows participant count', () => {
    render(<ExpenseDetailsModal {...defaultProps} />);
    expect(screen.getByText('2 participants')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 4. Description
// ---------------------------------------------------------------------------

describe('ExpenseDetailsModal - Description', () => {

  test('Shows description when present', () => {
    render(<ExpenseDetailsModal {...defaultProps} />);
    expect(screen.getByText('Shared hotel room for two nights')).toBeInTheDocument();
  });

  test('Does not show description section when absent', () => {
    const expenseNoDesc = { ...mockExpense, description: undefined };
    render(<ExpenseDetailsModal {...defaultProps} expense={expenseNoDesc} />);
    expect(screen.queryByText('Description')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 5. Split breakdown
// ---------------------------------------------------------------------------

describe('ExpenseDetailsModal - Split breakdown', () => {

  test('Shows Split Breakdown heading', () => {
    render(<ExpenseDetailsModal {...defaultProps} />);
    expect(screen.getByText('Split Breakdown')).toBeInTheDocument();
  });

  test('Shows each participant name in breakdown', () => {
    render(<ExpenseDetailsModal {...defaultProps} />);
    // Alice and Bob should both appear in split breakdown
    const aliceElements = screen.getAllByText('Alice');
    const bobElements   = screen.getAllByText('Bob');
    expect(aliceElements.length).toBeGreaterThan(0);
    expect(bobElements.length).toBeGreaterThan(0);
  });

  test('Shows participant share amounts', () => {
    render(<ExpenseDetailsModal {...defaultProps} />);
    // Both shares are EUR 100.00
    const amounts = screen.getAllByText('EUR 100.00');
    expect(amounts.length).toBeGreaterThan(0);
  });

  test('Shows Paid badge for expense payer in breakdown', () => {
    render(<ExpenseDetailsModal {...defaultProps} />);
    expect(screen.getByText('Paid')).toBeInTheDocument();
  });

  test('Shows percentage of total for each participant', () => {
    render(<ExpenseDetailsModal {...defaultProps} />);
    expect(screen.getAllByText(/50\.0% of total/).length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 6. Settlement expense
// ---------------------------------------------------------------------------

describe('ExpenseDetailsModal - Settlement expense', () => {

  const settlementExpense = {
    ...mockExpense,
    title:        'Settlement',
    isSettlement: true,
    participants: ['user-123', 'user-456'],
    paidBy:       'user-123',
  };

  test('Shows Settlement badge for settlement expense', () => {
    render(<ExpenseDetailsModal {...defaultProps} expense={settlementExpense} />);
    expect(screen.getByText('Settlement')).toBeInTheDocument();
  });

  test('Shows settlement title with arrow for settlement expense', () => {
    render(<ExpenseDetailsModal {...defaultProps} expense={settlementExpense} />);
    expect(screen.getByText(/Settlement:.*Alice.*Bob/)).toBeInTheDocument();
  });

  test('Shows payment method info for settlement with paymentMethod', () => {
    const settleWithMethod = {
      ...settlementExpense,
      paymentMethod: 'paypal',
      paypalOrderId: 'ORDER-123',
    };
    render(<ExpenseDetailsModal {...defaultProps} expense={settleWithMethod} />);
    expect(screen.getByText(/Payment Method/)).toBeInTheDocument();
    expect(screen.getByText(/PayPal/)).toBeInTheDocument();
  });

  test('Shows PayPal order ID when present', () => {
    const settleWithMethod = {
      ...settlementExpense,
      paymentMethod: 'paypal',
      paypalOrderId: 'ORDER-123',
    };
    render(<ExpenseDetailsModal {...defaultProps} expense={settleWithMethod} />);
    expect(screen.getByText(/ORDER-123/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 7. Receipt section
// ---------------------------------------------------------------------------

describe('ExpenseDetailsModal - Receipt section', () => {

  test('Shows receipt section when receiptURL is present', () => {
    const expenseWithReceipt = {
      ...mockExpense,
      receiptURL: 'https://cloudinary.com/receipt.jpg',
    };
    render(<ExpenseDetailsModal {...defaultProps} expense={expenseWithReceipt} />);
    expect(screen.getByText('Scanned Receipt')).toBeInTheDocument();
  });

  test('Shows receipt image when receiptURL is present', () => {
    const expenseWithReceipt = {
      ...mockExpense,
      receiptURL: 'https://cloudinary.com/receipt.jpg',
    };
    render(<ExpenseDetailsModal {...defaultProps} expense={expenseWithReceipt} />);
    expect(screen.getByAltText('Receipt')).toBeInTheDocument();
  });

  test('Shows View Full Size link for receipt', () => {
    const expenseWithReceipt = {
      ...mockExpense,
      receiptURL: 'https://cloudinary.com/receipt.jpg',
    };
    render(<ExpenseDetailsModal {...defaultProps} expense={expenseWithReceipt} />);
    expect(screen.getByText('View Full Size')).toBeInTheDocument();
  });

  test('Shows Download link for receipt', () => {
    const expenseWithReceipt = {
      ...mockExpense,
      receiptURL: 'https://cloudinary.com/receipt.jpg',
    };
    render(<ExpenseDetailsModal {...defaultProps} expense={expenseWithReceipt} />);
    expect(screen.getByText('Download')).toBeInTheDocument();
  });

  test('Does not show receipt section when receiptURL is absent', () => {
    render(<ExpenseDetailsModal {...defaultProps} />);
    expect(screen.queryByText('Scanned Receipt')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 8. Close behaviour
// ---------------------------------------------------------------------------

describe('ExpenseDetailsModal - Close', () => {

  test('Calls onClose when Close button is clicked', () => {
    const onClose = jest.fn();
    render(<ExpenseDetailsModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('Calls onClose when X icon button is clicked', () => {
    const onClose = jest.fn();
    render(<ExpenseDetailsModal {...defaultProps} onClose={onClose} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
