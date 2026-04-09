// src/pages/Activity.test.jsx
// Test suite for Activity page - rendering, filters, expense list, stats, modal

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/activity' }),
}));

const mockOnSnapshot = jest.fn();
const mockCollection  = jest.fn();
const mockQuery       = jest.fn();
const mockWhere       = jest.fn();
jest.mock('firebase/firestore', () => ({
  collection:  (...a) => mockCollection(...a),
  query:       (...a) => mockQuery(...a),
  where:       (...a) => mockWhere(...a),
  onSnapshot:  (...a) => mockOnSnapshot(...a),
}));

jest.mock('../services/firebase', () => ({ db: {} }));

// Stable user reference — prevents infinite useEffect loop
jest.mock('../stores/authStore', () => {
  const stableUser = { uid: 'user-123', email: 'alice@example.com', displayName: 'Alice' };
  return {
    useAuthStore: () => ({ user: stableUser }),
  };
});

jest.mock('../components/ExpenseDetailsModal', () => ({ isOpen, onClose, expense }) =>
  isOpen ? (
    <div data-testid="expense-details-modal">
      <span data-testid="modal-expense-title">{expense?.title}</span>
      <button onClick={onClose}>Close Details</button>
    </div>
  ) : null
);

// ─── Import after mocks ───────────────────────────────────────────────────────
import Activity from './Activity';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockGroups = [
  { id: 'g1', name: 'Trip to Rome', currency: 'EUR', memberIds: ['user-123'] },
];

const mockExpenses = [
  {
    id: 'e1',
    title: 'Dinner',
    amount: 60,
    currency: 'EUR',
    groupId: 'g1',
    paidBy: 'user-123',
    participants: ['user-123', 'user-456'],
    splits: { 'user-123': 30, 'user-456': 30 },
    date: '2024-01-15',
    isSettlement: false,
  },
  {
    id: 'e2',
    title: 'Hotel',
    amount: 200,
    currency: 'EUR',
    groupId: 'g1',
    paidBy: 'user-456',
    participants: ['user-123', 'user-456'],
    splits: { 'user-123': 100, 'user-456': 100 },
    date: '2024-01-14',
    isSettlement: false,
  },
];

const setupActivity = (groups = mockGroups, expenses = mockExpenses) => {
  let callCount = 0;
  mockOnSnapshot.mockImplementation((query, callback) => {
    callCount++;
    if (callCount === 1) {
      callback({ docs: groups.map(g => ({ id: g.id, data: () => g })) });
    } else {
      callback({ docs: expenses.map(e => ({ id: e.id, data: () => e })) });
    }
    return jest.fn();
  });
};

const setupNoGroups = () => {
  mockOnSnapshot.mockImplementation(() => jest.fn());
};

// Groups exist but no expenses — loading resolves to empty state
const setupEmptyExpenses = () => {
  let callCount = 0;
  mockOnSnapshot.mockImplementation((query, callback) => {
    callCount++;
    if (callCount === 1) {
      callback({ docs: mockGroups.map(g => ({ id: g.id, data: () => g })) });
    } else {
      callback({ docs: [] }); // no expenses
    }
    return jest.fn();
  });
};

// ─────────────────────────────────────────────────────────────────────────────

describe('Activity - Rendering', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupNoGroups();
  });

  test('Renders Activity heading', () => {
    render(<Activity />);
    expect(screen.getByText('Activity')).toBeInTheDocument();
  });

  test('Renders You Paid stat card', () => {
    render(<Activity />);
    expect(screen.getByText('You Paid')).toBeInTheDocument();
  });

  test('Renders You Owe stat card', () => {
    render(<Activity />);
    expect(screen.getByText('You Owe')).toBeInTheDocument();
  });

  test('Renders All filter tab', () => {
    render(<Activity />);
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  test('Renders I Paid filter tab', () => {
    render(<Activity />);
    expect(screen.getByText('I Paid')).toBeInTheDocument();
  });

  test('Renders I Owe filter tab', () => {
    render(<Activity />);
    expect(screen.getByText('I Owe')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Activity - Loading & Empty states', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Shows loading spinner while fetching', () => {
    setupNoGroups(); // never fires callback → stays loading
    render(<Activity />);
    expect(screen.getByText('Loading activity...')).toBeInTheDocument();
  });

  test('Shows no activity message when no expenses', async () => {
    setupEmptyExpenses();
    render(<Activity />);
    await waitFor(() =>
      expect(screen.getByText('No activity yet')).toBeInTheDocument()
    );
  });

  test('Shows correct empty message for All filter', async () => {
    setupEmptyExpenses();
    render(<Activity />);
    await waitFor(() =>
      expect(screen.getByText('Start adding expenses to see activity here')).toBeInTheDocument()
    );
  });

  test('Shows correct empty message for I Paid filter', async () => {
    setupEmptyExpenses();
    render(<Activity />);
    await waitFor(() => screen.getByText('No activity yet'));
    fireEvent.click(screen.getByText('I Paid'));
    await waitFor(() =>
      expect(screen.getByText("You haven't paid for any expenses yet")).toBeInTheDocument()
    );
  });

  test('Shows correct empty message for I Owe filter', async () => {
    setupEmptyExpenses();
    render(<Activity />);
    await waitFor(() => screen.getByText('No activity yet'));
    fireEvent.click(screen.getByText('I Owe'));
    await waitFor(() =>
      expect(screen.getByText("You don't owe anyone yet")).toBeInTheDocument()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Activity - Expenses list', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupActivity();
  });

  test('Renders expense titles', async () => {
    render(<Activity />);
    await waitFor(() => expect(screen.getByText('Dinner')).toBeInTheDocument());
    expect(screen.getByText('Hotel')).toBeInTheDocument();
  });

  test('Renders group name for expenses', async () => {
    render(<Activity />);
    await waitFor(() =>
      expect(screen.getAllByText('Trip to Rome').length).toBeGreaterThan(0)
    );
  });

  test('Shows You paid label for expenses user paid', async () => {
    render(<Activity />);
    await waitFor(() =>
      expect(screen.getByText('You paid')).toBeInTheDocument()
    );
  });

  test('Shows You owe label for expenses user owes', async () => {
    render(<Activity />);
    await waitFor(() =>
      expect(screen.getByText(/You owe/)).toBeInTheDocument()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Activity - Filter tabs', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupActivity();
  });

  test('Shows all expenses when All tab is active', async () => {
    render(<Activity />);
    await waitFor(() => screen.getByText('Dinner'));
    expect(screen.getByText('Hotel')).toBeInTheDocument();
  });

  test('Shows only user-paid expenses when I Paid is clicked', async () => {
    render(<Activity />);
    await waitFor(() => screen.getByText('Dinner'));
    fireEvent.click(screen.getByText('I Paid'));
    await waitFor(() =>
      expect(screen.queryByText('Hotel')).not.toBeInTheDocument()
    );
    expect(screen.getByText('Dinner')).toBeInTheDocument();
  });

  test('Switches back to all when All tab is clicked', async () => {
    render(<Activity />);
    await waitFor(() => screen.getByText('Dinner'));
    fireEvent.click(screen.getByText('I Paid'));
    fireEvent.click(screen.getByText('All'));
    await waitFor(() =>
      expect(screen.getByText('Hotel')).toBeInTheDocument()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Activity - Expense details modal', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupActivity();
  });

  test('Opens expense details modal when expense is clicked', async () => {
    render(<Activity />);
    await waitFor(() => screen.getByText('Dinner'));
    fireEvent.click(screen.getByText('Dinner'));
    expect(screen.getByTestId('expense-details-modal')).toBeInTheDocument();
  });

  test('Passes selected expense title to modal', async () => {
    render(<Activity />);
    await waitFor(() => screen.getByText('Dinner'));
    fireEvent.click(screen.getByText('Dinner'));
    expect(screen.getByTestId('modal-expense-title').textContent).toBe('Dinner');
  });

  test('Closes expense details modal', async () => {
    render(<Activity />);
    await waitFor(() => screen.getByText('Dinner'));
    fireEvent.click(screen.getByText('Dinner'));
    fireEvent.click(screen.getByText('Close Details'));
    expect(screen.queryByTestId('expense-details-modal')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Activity - Navigation', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupEmptyExpenses();
  });

  test('Navigates to /dashboard when back arrow is clicked', async () => {
    render(<Activity />);
    const backBtn = screen.getAllByRole('button')[0];
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});