// src/pages/QuickAdd.test.jsx
// Test suite for QuickAdd page - group selection, expense modal, navigation

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
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

jest.mock('../stores/authStore', () => {
  const stableUser = { uid: 'user-123', email: 'alice@example.com', displayName: 'Alice' };
  return {
    useAuthStore: () => ({ user: stableUser }),
  };
});

jest.mock('../components/AddExpenseModal', () => ({ isOpen, onClose, group }) =>
  isOpen ? (
    <div data-testid="add-expense-modal">
      <span data-testid="modal-group-name">{group?.name}</span>
      <button onClick={onClose}>Close Expense Modal</button>
    </div>
  ) : null
);

// ─── Import after mocks ───────────────────────────────────────────────────────
import QuickAdd from './QuickAdd';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const setupGroups = (groups = []) => {
  mockOnSnapshot.mockImplementation((query, callback) => {
    callback({ docs: groups.map(g => ({ id: g.id, data: () => g })) });
    return jest.fn();
  });
};

const mockGroups = [
  { id: 'g1', name: 'Trip to Rome', currency: 'EUR', icon: 'plane', members: [{ userId: 'user-123' }, { userId: 'user-456' }] },
  { id: 'g2', name: 'House Bills',  currency: 'GBP', icon: 'home',  members: [{ userId: 'user-123' }] },
];

// ─────────────────────────────────────────────────────────────────────────────

describe('QuickAdd - Rendering', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupGroups();
  });

  test('Renders page heading', () => {
    render(<QuickAdd />);
    expect(screen.getByText('Quick Add Expense')).toBeInTheDocument();
  });

  test('Renders instruction text', () => {
    render(<QuickAdd />);
    expect(screen.getByText('Select a group to add an expense')).toBeInTheDocument();
  });

  test('Renders back button', () => {
    render(<QuickAdd />);
    // ArrowLeft button is the first button
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('QuickAdd - Empty state', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupGroups([]); // no groups
  });

  test('Shows no groups message when no groups exist', () => {
    render(<QuickAdd />);
    expect(screen.getByText('No groups yet')).toBeInTheDocument();
  });

  test('Shows create group prompt', () => {
    render(<QuickAdd />);
    expect(screen.getByText('Create a group first to add expenses')).toBeInTheDocument();
  });

  test('Shows Go to Dashboard button in empty state', () => {
    render(<QuickAdd />);
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
  });

  test('Navigates to /dashboard when Go to Dashboard clicked', () => {
    render(<QuickAdd />);
    fireEvent.click(screen.getByText('Go to Dashboard'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('QuickAdd - Groups list', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupGroups(mockGroups);
  });

  test('Renders group names', async () => {
    render(<QuickAdd />);
    await waitFor(() =>
      expect(screen.getByText('Trip to Rome')).toBeInTheDocument()
    );
    expect(screen.getByText('House Bills')).toBeInTheDocument();
  });

  test('Renders group member counts', async () => {
    render(<QuickAdd />);
    await waitFor(() =>
      expect(screen.getByText(/2 members/)).toBeInTheDocument()
    );
    expect(screen.getByText(/1 member/)).toBeInTheDocument();
  });

  test('Renders group currencies', async () => {
    render(<QuickAdd />);
    await waitFor(() =>
      expect(screen.getByText(/EUR/)).toBeInTheDocument()
    );
    expect(screen.getByText(/GBP/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('QuickAdd - Group selection and modal', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupGroups(mockGroups);
  });

  test('Opens AddExpenseModal when a group is clicked', async () => {
    render(<QuickAdd />);
    await waitFor(() => screen.getByText('Trip to Rome'));
    fireEvent.click(screen.getByText('Trip to Rome'));
    expect(screen.getByTestId('add-expense-modal')).toBeInTheDocument();
  });

  test('Passes selected group to AddExpenseModal', async () => {
    render(<QuickAdd />);
    await waitFor(() => screen.getByText('Trip to Rome'));
    fireEvent.click(screen.getByText('Trip to Rome'));
    expect(screen.getByTestId('modal-group-name').textContent).toBe('Trip to Rome');
  });

  test('Closes modal and navigates to /dashboard when modal is closed', async () => {
    render(<QuickAdd />);
    await waitFor(() => screen.getByText('Trip to Rome'));
    fireEvent.click(screen.getByText('Trip to Rome'));
    fireEvent.click(screen.getByText('Close Expense Modal'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    expect(screen.queryByTestId('add-expense-modal')).not.toBeInTheDocument();
  });

  test('Modal not shown before group is selected', async () => {
    render(<QuickAdd />);
    await waitFor(() => screen.getByText('Trip to Rome'));
    expect(screen.queryByTestId('add-expense-modal')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('QuickAdd - Navigation', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupGroups();
  });

  test('Navigates to /dashboard when back arrow is clicked', () => {
    render(<QuickAdd />);
    const backBtn = screen.getAllByRole('button')[0];
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});