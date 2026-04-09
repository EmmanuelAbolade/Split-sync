// src/components/BalanceBreakdownModal.test.jsx
// Tests for BalanceBreakdownModal component

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import BalanceBreakdownModal from './BalanceBreakdownModal';

const mockOnClose = jest.fn();

const defaultProps = {
  isOpen:      true,
  onClose:     mockOnClose,
  type:        'owed',
  breakdowns:  [],
  totalAmount: 0,
};

describe('BalanceBreakdownModal', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Renders nothing when isOpen is false', () => {
    render(<BalanceBreakdownModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Owed to You')).not.toBeInTheDocument();
  });

  test('Renders Owed to You title when type is owed', () => {
    render(<BalanceBreakdownModal {...defaultProps} type="owed" />);
    expect(screen.getByText('Owed to You')).toBeInTheDocument();
  });

  test('Renders You Owe title when type is owing', () => {
    render(<BalanceBreakdownModal {...defaultProps} type="owing" />);
    expect(screen.getByText('You Owe')).toBeInTheDocument();
  });

  test('Displays formatted total amount', () => {
    render(<BalanceBreakdownModal {...defaultProps} amountsByCurrency={{ EUR: 75.5 }} />);
    expect(screen.getByText('EUR 75.50')).toBeInTheDocument();
  });

  test('Shows empty state for owed type when no breakdowns', () => {
    render(<BalanceBreakdownModal {...defaultProps} type="owed" breakdowns={[]} />);
    expect(screen.getByText('Nobody owes you money')).toBeInTheDocument();
  });

  test('Shows empty state for owing type when no breakdowns', () => {
    render(<BalanceBreakdownModal {...defaultProps} type="owing" breakdowns={[]} />);
    expect(screen.getByText("You don't owe anyone")).toBeInTheDocument();
  });

  test('Renders breakdown entry with person name', () => {
    const breakdowns = [{
      name:     'Bob',
      amount:   30,
      photoURL: null,
      groups:   [],
    }];
    render(<BalanceBreakdownModal {...defaultProps} type="owed" breakdowns={breakdowns} />);
    expect(screen.getByText('Bob owes you')).toBeInTheDocument();
  });

  test('Renders owing breakdown with correct label', () => {
    const breakdowns = [{
      name:     'Alice',
      amount:   20,
      photoURL: null,
      groups:   [],
    }];
    render(<BalanceBreakdownModal {...defaultProps} type="owing" breakdowns={breakdowns} />);
    expect(screen.getByText('You owe Alice')).toBeInTheDocument();
  });

  test('Renders group button inside breakdown entry', () => {
    const breakdowns = [{
      name:    'Bob',
      amount:  30,
      photoURL: null,
      groups:  [{ groupId: 'g1', groupName: 'House', amount: 30 }],
    }];
    render(<BalanceBreakdownModal {...defaultProps} breakdowns={breakdowns} />);
    expect(screen.getByText('House')).toBeInTheDocument();
  });

  test('Navigates to group when group button is clicked', () => {
    const breakdowns = [{
      name:    'Bob',
      amount:  30,
      photoURL: null,
      groups:  [{ groupId: 'g1', groupName: 'House', amount: 30 }],
    }];
    render(<BalanceBreakdownModal {...defaultProps} breakdowns={breakdowns} />);
    fireEvent.click(screen.getByText('House'));
    expect(mockOnClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/group/g1');
  });

  test('Calls onClose when Close button is clicked', () => {
    render(<BalanceBreakdownModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('Calls onClose when backdrop is clicked', () => {
    render(<BalanceBreakdownModal {...defaultProps} />);
    // Click the outer backdrop div (first fixed div)
    const backdrop = screen.getByText('Owed to You').closest('[class*="fixed"]');
    fireEvent.click(backdrop);
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('Renders photo when breakdown has photoURL', () => {
    const breakdowns = [{
      name:     'Carol',
      amount:   15,
      photoURL: 'https://example.com/photo.jpg',
      groups:   [],
    }];
    render(<BalanceBreakdownModal {...defaultProps} breakdowns={breakdowns} />);
    expect(screen.getByAltText('Carol')).toBeInTheDocument();
  });
});
