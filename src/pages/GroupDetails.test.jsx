// src/pages/GroupDetails.test.jsx
// Test suite for GroupDetails page - rendering, members, expenses, modals, navigation

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useParams:   () => ({ groupId: 'group-123' }),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null }),
}));

const mockGetDoc     = jest.fn();
const mockOnSnapshot = jest.fn();
const mockDoc        = jest.fn();
const mockCollection = jest.fn();
const mockQuery      = jest.fn();
const mockWhere      = jest.fn();
const mockUpdateDoc  = jest.fn(() => Promise.resolve());
const mockDeleteDoc  = jest.fn(() => Promise.resolve());
const mockGetDocs    = jest.fn(() => Promise.resolve({ docs: [], forEach: () => {} }));
const mockWriteBatch = jest.fn(() => ({
  delete: jest.fn(),
  commit: jest.fn(() => Promise.resolve()),
}));
const mockArrayRemove = jest.fn((val) => val);

jest.mock('firebase/firestore', () => ({
  doc:         (...a) => mockDoc(...a),
  getDoc:      (...a) => mockGetDoc(...a),
  collection:  (...a) => mockCollection(...a),
  query:       (...a) => mockQuery(...a),
  where:       (...a) => mockWhere(...a),
  onSnapshot:  (...a) => mockOnSnapshot(...a),
  updateDoc:   (...a) => mockUpdateDoc(...a),
  deleteDoc:   (...a) => mockDeleteDoc(...a),
  getDocs:     (...a) => mockGetDocs(...a),
  writeBatch:  (...a) => mockWriteBatch(...a),
  arrayRemove: (...a) => mockArrayRemove(...a),
}));

jest.mock('../services/firebase', () => ({ db: {} }));

// Mock invitationSystem — prevents getDocs calls leaking into firestore mock
jest.mock('../utils/invitationSystem', () => ({
  getMySentInvitations: jest.fn(() => Promise.resolve([])),
  cancelInvitation:     jest.fn(() => Promise.resolve()),
  sendInvitation:       jest.fn(() => Promise.resolve()),
}));

// Mock notificationsStore — prevents Firestore calls and provides stable state
// Phase 1B: "Confirm it's you" and the settlements Functions
jest.mock('../hooks/useStepUp', () => ({
  __esModule: true,
  default: () => ({ requestStepUp: () => Promise.resolve('tok'), stepUpSheet: null }),
}));
jest.mock('../utils/settlements', () => ({
  cancelSettlement: () => Promise.resolve({ status: 'cancelled' }),
  confirmParams: (id) => ({ notificationId: id }),
  settlementErrorMessage: (_e, fallback) => fallback || 'That did not work. Please try again.',
  methodLabel: (m) => (m === 'paypal' ? 'PayPal' : m),
}));

jest.mock('../stores/notificationsStore', () => ({
  useNotificationsStore:    jest.fn(() => ({ notifications: [] })),
  confirmPaymentReceived:   jest.fn(() => Promise.resolve()),
  declinePaymentReceived:   jest.fn(() => Promise.resolve()),
  recordPaymentSent:        () => Promise.resolve(),
  createNotification:       jest.fn(() => Promise.resolve()),
}));

// Stable user reference — prevents infinite useEffect loop
jest.mock('../stores/authStore', () => {
  const stableUser = { uid: 'user-123', email: 'alice@example.com', displayName: 'Alice' };
  return { useAuthStore: () => ({ user: stableUser }) };
});

// Mock balance utilities
jest.mock('../utils/balanceCalculator', () => ({
  calculateBalances:      jest.fn(() => ({ 'user-123': 30, 'user-456': -30 })),
  calculateSettlements:   jest.fn(() => [{ from: 'user-456', to: 'user-123', amount: 30 }]),
  getUserBalanceSummary:  jest.fn(() => ({
    status: 'owed', amount: 30, message: 'You are owed',
  })),
}));

// Mock child modals — simple stubs
jest.mock('../components/AddExpenseModal', () => ({ isOpen, onClose }) =>
  isOpen ? <div data-testid="add-expense-modal"><button onClick={onClose}>Close Add</button></div> : null
);
jest.mock('../components/SettleUpModal', () => ({ isOpen, onClose }) =>
  isOpen ? <div data-testid="settle-up-modal"><button onClick={onClose}>Close Settle</button></div> : null
);
jest.mock('../components/ExpenseDetailsModal', () => ({ isOpen, onClose, expense }) =>
  isOpen ? (
    <div data-testid="expense-details-modal">
      <span data-testid="modal-expense-title">{expense?.title}</span>
      <button onClick={onClose}>Close Details</button>
    </div>
  ) : null
);
jest.mock('../components/ShareInviteModal', () => ({ isOpen, onClose }) =>
  isOpen ? <div data-testid="share-invite-modal"><button onClick={onClose}>Close Share</button></div> : null
);

// ─── Import after mocks ───────────────────────────────────────────────────────
import GroupDetails from './GroupDetails';

// ─── Test data ────────────────────────────────────────────────────────────────

const mockGroup = {
  id: 'group-123',
  name: 'Weekend Trip',
  currency: 'EUR',
  icon: 'plane',
  members: [
    { userId: 'user-123', name: 'Alice', email: 'alice@example.com', role: 'owner' },
    { userId: 'user-456', name: 'Bob',   email: 'bob@example.com',   role: 'member' },
  ],
};

const mockExpenses = [
  {
    id: 'exp-1',
    title: 'Hotel',
    amount: 200,
    currency: 'EUR',
    groupId: 'group-123',
    paidBy: 'user-123',
    participants: ['user-123', 'user-456'],
    splits: { 'user-123': 100, 'user-456': 100 },
    splitMethod: 'equal',
    category: 'accommodation',
    date: '2024-01-15',
    description: 'Shared hotel room',
  },
  {
    id: 'exp-2',
    title: 'Dinner',
    amount: 60,
    currency: 'EUR',
    groupId: 'group-123',
    paidBy: 'user-456',
    participants: ['user-123', 'user-456'],
    splits: { 'user-123': 30, 'user-456': 30 },
    splitMethod: 'equal',
    category: 'food',
    date: '2024-01-14',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Setup: group found, expenses loaded
// Restore balance calculator mocks after jest.clearAllMocks() resets them
const { calculateBalances, calculateSettlements, getUserBalanceSummary } = require('../utils/balanceCalculator');

const resetBalanceMocks = () => {
  calculateBalances.mockReturnValue({ 'user-123': 30, 'user-456': -30 });
  calculateSettlements.mockReturnValue([{ from: 'user-456', to: 'user-123', amount: 30 }]);
  getUserBalanceSummary.mockReturnValue({ status: 'owed', amount: 30, message: 'You are owed' });

  // Restore mocks that jest.clearAllMocks() wipes on every beforeEach
  const { useNotificationsStore } = require('../stores/notificationsStore');
  useNotificationsStore.mockReturnValue({ notifications: [] });

  const { getMySentInvitations } = require('../utils/invitationSystem');
  getMySentInvitations.mockResolvedValue([]);

  mockGetDocs.mockResolvedValue({ docs: [], forEach: () => {} });
  mockWriteBatch.mockReturnValue({
    delete: jest.fn(),
    commit: jest.fn(() => Promise.resolve()),
  });
};

// getDoc: first call = group doc, subsequent calls = empty user docs (photos/payments)
const mockUserDoc = { exists: () => false, data: () => ({}) };
const mockGroupDoc = { exists: () => true, id: 'group-123', data: () => mockGroup };

const setupWithGroup = (expenses = mockExpenses) => {
  resetBalanceMocks();
  mockGetDoc.mockResolvedValueOnce(mockGroupDoc)   // group fetch
             .mockResolvedValue(mockUserDoc);       // member photo/payment fetches

  let callCount = 0;
  mockOnSnapshot.mockImplementation((query, callback) => {
    callCount++;
    if (callCount === 1) {
      callback(mockGroupDoc);
    } else if (callCount === 2) {
      callback({ docs: expenses.map(e => ({ id: e.id, data: () => e })) });
    } else {
      // pendingPayments listener — always empty
      if (typeof callback === 'function') callback({ empty: true, docs: [] });
    }
    return jest.fn();
  });
};

const setupWithNoExpenses = () => {
  resetBalanceMocks();
  mockGetDoc.mockResolvedValueOnce(mockGroupDoc)
             .mockResolvedValue(mockUserDoc);

  let callCount = 0;
  mockOnSnapshot.mockImplementation((query, callback) => {
    callCount++;
    if (callCount === 1) {
      callback(mockGroupDoc);
    } else if (callCount === 2) {
      callback({ docs: [] });
    } else {
      if (typeof callback === 'function') callback({ empty: true, docs: [] });
    }
    return jest.fn();
  });
};

const setupGroupNotFound = () => {
  mockGetDoc.mockResolvedValue({ exists: () => false });
  let callCount = 0;
  mockOnSnapshot.mockImplementation((q, cb) => {
    callCount++;
    if (typeof cb === 'function') {
      if (callCount === 1) {
        cb({ exists: () => false, data: () => ({}) });
      } else {
        cb({ docs: [] });
      }
    }
    return jest.fn();
  });
};

// ─────────────────────────────────────────────────────────────────────────────

describe('GroupDetails - Loading state', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    resetBalanceMocks();
    // Slow fetch — never resolves
    mockGetDoc.mockReturnValue(new Promise(() => {}));
    mockOnSnapshot.mockImplementation(() => jest.fn());
  });

  test('Shows loading spinner before group data arrives', () => {
    render(<GroupDetails />);
    expect(screen.getByText('Loading group...')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GroupDetails - Group not found', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    resetBalanceMocks();
    setupGroupNotFound();
  });

  test('Navigates to /dashboard when group does not exist', async () => {
    render(<GroupDetails />);
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GroupDetails - Rendering', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupWithGroup();
  });

  test('Renders SplitSync branding in header', async () => {
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('SplitSync')).toBeInTheDocument()
    );
  });

  test('Renders group name', async () => {
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('Weekend Trip')).toBeInTheDocument()
    );
  });

  test('Renders group currency', async () => {
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getAllByText(/EUR/).length).toBeGreaterThan(0)
    );
  });

  test('Renders member count', async () => {
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getAllByText(/2 members/).length).toBeGreaterThan(0)
    );
  });

  test('Renders Invite Link button', async () => {
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('Invite Link')).toBeInTheDocument()
    );
  });

  test('Renders Add Expense button in header', async () => {
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getAllByText('Add Expense').length).toBeGreaterThan(0)
    );
  });

  test('Renders Recent Expenses section', async () => {
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('Recent Expenses')).toBeInTheDocument()
    );
  });

  test('Renders Members section heading', async () => {
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getAllByText('Members').length).toBeGreaterThan(0)
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GroupDetails - Members section', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupWithGroup();
  });

  test('Renders member names', async () => {
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getAllByText('Alice').length).toBeGreaterThan(0)
    );
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
  });

  test('Renders member emails', async () => {
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    );
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
  });

  test('Shows Owner badge for owner member', async () => {
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('Owner')).toBeInTheDocument()
    );
  });

  test('Shows Invite button in members section', async () => {
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('Invite')).toBeInTheDocument()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GroupDetails - Expenses section', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupWithGroup();
  });

  test('Renders expense titles', async () => {
    render(<GroupDetails />);
    await waitFor(() => expect(screen.getByText('Hotel')).toBeInTheDocument());
    expect(screen.getByText('Dinner')).toBeInTheDocument();
  });

  test('Renders expense amounts', async () => {
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText(/200\.00/)).toBeInTheDocument()
    );
  });

  test('Renders payer name', async () => {
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('Paid by Alice')).toBeInTheDocument()
    );
  });

  test('Renders expense description', async () => {
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('Shared hotel room')).toBeInTheDocument()
    );
  });

  test('Renders split method info', async () => {
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getAllByText(/Split equal/).length).toBeGreaterThan(0)
    );
  });

  test('Shows total amount summary', async () => {
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText(/Total:/)).toBeInTheDocument()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GroupDetails - Empty expenses state', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupWithNoExpenses();
  });

  test('Shows No expenses yet message', async () => {
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('No expenses yet')).toBeInTheDocument()
    );
  });

  test('Shows Add First Expense button', async () => {
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('Add First Expense')).toBeInTheDocument()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GroupDetails - Navigation', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupWithGroup();
  });

  test('Navigates to /dashboard when back arrow is clicked', async () => {
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('SplitSync'));
    const backBtn = screen.getAllByRole('button')[0];
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GroupDetails - Modals', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupWithGroup();
  });

  test('Opens AddExpenseModal when Add Expense button is clicked', async () => {
    render(<GroupDetails />);
    await waitFor(() => screen.getAllByText('Add Expense'));
    fireEvent.click(screen.getAllByText('Add Expense')[0]);
    expect(screen.getByTestId('add-expense-modal')).toBeInTheDocument();
  });

  test('Closes AddExpenseModal when close is clicked', async () => {
    render(<GroupDetails />);
    await waitFor(() => screen.getAllByText('Add Expense'));
    fireEvent.click(screen.getAllByText('Add Expense')[0]);
    fireEvent.click(screen.getByText('Close Add'));
    expect(screen.queryByTestId('add-expense-modal')).not.toBeInTheDocument();
  });

  test('Opens ShareInviteModal when Invite Link is clicked', async () => {
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Invite Link'));
    fireEvent.click(screen.getByText('Invite Link'));
    expect(screen.getByTestId('share-invite-modal')).toBeInTheDocument();
  });

  test('Closes ShareInviteModal when close is clicked', async () => {
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Invite Link'));
    fireEvent.click(screen.getByText('Invite Link'));
    fireEvent.click(screen.getByText('Close Share'));
    expect(screen.queryByTestId('share-invite-modal')).not.toBeInTheDocument();
  });

  test('Opens ShareInviteModal when Invite button in members section is clicked', async () => {
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Invite'));
    fireEvent.click(screen.getByText('Invite'));
    expect(screen.getByTestId('share-invite-modal')).toBeInTheDocument();
  });

  test('Opens ExpenseDetailsModal when an expense is clicked', async () => {
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Hotel'));
    fireEvent.click(screen.getByText('Hotel'));
    expect(screen.getByTestId('expense-details-modal')).toBeInTheDocument();
  });

  test('Passes expense title to ExpenseDetailsModal', async () => {
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Hotel'));
    fireEvent.click(screen.getByText('Hotel'));
    expect(screen.getByTestId('modal-expense-title').textContent).toBe('Hotel');
  });

  test('Closes ExpenseDetailsModal when close is clicked', async () => {
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Hotel'));
    fireEvent.click(screen.getByText('Hotel'));
    fireEvent.click(screen.getByText('Close Details'));
    expect(screen.queryByTestId('expense-details-modal')).not.toBeInTheDocument();
  });

  test('Opens AddExpenseModal from Add First Expense button in empty state', async () => {
    setupWithNoExpenses();
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Add First Expense'));
    fireEvent.click(screen.getByText('Add First Expense'));
    expect(screen.getByTestId('add-expense-modal')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GroupDetails - Balance and settlement sections', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupWithGroup();
  });

  test('Shows balance summary section when expenses exist', async () => {
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('You are owed')).toBeInTheDocument()
    );
  });

  test('Shows Settlement Summary section when expenses exist', async () => {
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('Settlement Summary')).toBeInTheDocument()
    );
  });

  test('Shows Individual Balances section when expenses exist', async () => {
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('Individual Balances')).toBeInTheDocument()
    );
  });

  test('Shows Pay button for user who owes', async () => {
    const { calculateSettlements } = require('../utils/balanceCalculator');
    calculateSettlements.mockReturnValue([
      { from: 'user-123', to: 'user-456', amount: 30 },
    ]);
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText(/Pay EUR/)).toBeInTheDocument()
    );
  });

  test('Opens SettleUpModal when Pay button is clicked', async () => {
    const { calculateSettlements } = require('../utils/balanceCalculator');
    calculateSettlements.mockReturnValue([
      { from: 'user-123', to: 'user-456', amount: 30 },
    ]);
    render(<GroupDetails />);
    await waitFor(() => screen.getByText(/Pay EUR/));
    fireEvent.click(screen.getByText(/Pay EUR/));
    expect(screen.getByTestId('settle-up-modal')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GroupDetails - Collapsible expenses section', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupWithGroup();
  });

  test('Expenses are visible by default', async () => {
    render(<GroupDetails />);
    await waitFor(() => expect(screen.getByText('Hotel')).toBeInTheDocument());
  });

  test('Hides expenses when Recent Expenses header is clicked', async () => {
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Hotel'));
    fireEvent.click(screen.getByText('Recent Expenses'));
    expect(screen.queryByText('Hotel')).not.toBeInTheDocument();
  });

  test('Shows expenses again when header is clicked a second time', async () => {
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Hotel'));
    fireEvent.click(screen.getByText('Recent Expenses'));
    fireEvent.click(screen.getByText('Recent Expenses'));
    await waitFor(() =>
      expect(screen.getByText('Hotel')).toBeInTheDocument()
    );
  });
});
