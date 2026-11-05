// src/pages/GroupDetails.new.test.jsx
// Covers: InlineCalculator in AddExpenseModal, dismiss/restore in My Payment Activity,
// settlement status badge in Settlement Summary, settlement visual distinction in Recent Expenses

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mocks — reuse same pattern as GroupDetails.extra.test.jsx
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useParams:   () => ({ groupId: 'group-123' }),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null }),
}));

const mockGetDoc     = jest.fn();
const mockOnSnapshot = jest.fn();
const mockDoc        = jest.fn(() => ({}));
const mockCollection = jest.fn();
const mockQuery      = jest.fn();
const mockWhere      = jest.fn();
const mockUpdateDoc  = jest.fn(() => Promise.resolve());
const mockDeleteDoc  = jest.fn(() => Promise.resolve());
const mockArrayRemove = jest.fn((val) => val);
const mockBatch = {
  delete: jest.fn(),
  commit: jest.fn(() => Promise.resolve()),
};
const mockWriteBatch = jest.fn(() => mockBatch);
const mockGetDocs    = jest.fn(() => Promise.resolve({ docs: [] }));

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

jest.mock('../services/firebase', () => ({ db: {}, auth: {} }));

jest.mock('../utils/biometric', () => ({
  authenticateWithBiometric:  jest.fn(),
  isBiometricEnabledOnDevice: jest.fn(() => false),
}));

jest.mock('firebase/auth', () => ({
  reauthenticateWithCredential: jest.fn(),
  EmailAuthProvider: { credential: jest.fn(() => 'mock-credential') },
}));

jest.mock('../stores/authStore', () => {
  const stableUser = {
    uid: 'user-123',
    email: 'alice@example.com',
    displayName: 'Alice',
    providerData: [{ providerId: 'password' }],
  };
  return { useAuthStore: () => ({ user: stableUser }) };
});

const mockNotificationsStore = { notifications: [] };
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
  useNotificationsStore:  () => mockNotificationsStore,
  confirmPaymentReceived: jest.fn(() => Promise.resolve()),
  declinePaymentReceived: jest.fn(() => Promise.resolve()),
  recordPaymentSent:        () => Promise.resolve(),
  createNotification:     jest.fn(() => Promise.resolve()),
}));

jest.mock('../utils/invitationSystem', () => ({
  getMySentInvitations: jest.fn(() => Promise.resolve([])),
  cancelInvitation:     jest.fn(() => Promise.resolve({ success: true })),
  sendInvitation:       jest.fn(() => Promise.resolve()),
}));

const mockCalculateBalances    = jest.fn();
const mockCalculateSettlements = jest.fn();
const mockGetUserBalanceSummary = jest.fn();
jest.mock('../utils/balanceCalculator', () => ({
  calculateBalances:     (...a) => mockCalculateBalances(...a),
  calculateSettlements:  (...a) => mockCalculateSettlements(...a),
  getUserBalanceSummary: (...a) => mockGetUserBalanceSummary(...a),
}));

jest.mock('../components/AddExpenseModal', () => ({ isOpen, onClose }) =>
  isOpen ? <div data-testid="add-expense-modal"><button onClick={onClose}>Close Add</button></div> : null
);
jest.mock('../components/SettleUpModal', () => ({ isOpen, onClose }) =>
  isOpen ? <div data-testid="settle-up-modal"><button onClick={onClose}>Close Settle</button></div> : null
);
jest.mock('../components/ExpenseDetailsModal', () =>
  function MockExpenseDetailsModal({ isOpen, onClose, onEdit, expense }) {
    if (!isOpen) return null;
    return (
      <div data-testid="expense-details-modal">
        <button onClick={onClose}>Close Details</button>
        <button onClick={() => onEdit && onEdit(expense)}>Edit Expense</button>
      </div>
    );
  }
);
jest.mock('../components/ShareInviteModal', () => ({ isOpen, onClose }) =>
  isOpen ? <div data-testid="share-invite-modal"><button onClick={onClose}>Close Share</button></div> : null
);

jest.mock('../utils/encryption', () => ({
  decryptData: jest.fn((v) => `DECRYPTED-${v}`),
  encryptData: jest.fn((v) => `ENCRYPTED-${v}`),
}));

import GroupDetails from './GroupDetails';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockGroup = {
  id:        'group-123',
  name:      'Weekend Trip',
  currency:  'EUR',
  icon:      'plane',
  createdBy: 'user-123',
  members: [
    { userId: 'user-123', name: 'Alice', email: 'alice@example.com', role: 'owner' },
    { userId: 'user-456', name: 'Bob',   email: 'bob@example.com',   role: 'member' },
  ],
};

const mockExpenses = [
  {
    id: 'exp-1', title: 'Hotel', amount: 200, currency: 'EUR',
    groupId: 'group-123', paidBy: 'user-123',
    participants: ['user-123', 'user-456'],
    splits: { 'user-123': 100, 'user-456': 100 },
    splitMethod: 'equal', category: 'accommodation', date: '2024-01-15',
    isSettlement: false,
  },
];

const mockSettlementExpense = {
  id: 'set-1', title: 'Settlement: Bob to Alice', amount: 30, currency: 'EUR',
  groupId: 'group-123', paidBy: 'user-456',
  participants: ['user-456', 'user-123'],
  splits: { 'user-123': 30 },
  splitMethod: 'exact', category: 'settlement', date: '2024-01-16',
  isSettlement: true,
};

const mockUserDoc = { exists: () => false, data: () => ({}) };

// ---------------------------------------------------------------------------
// Setup helper
// ---------------------------------------------------------------------------

const setupWithGroup = (
  group = mockGroup,
  expenses = mockExpenses,
  notifications = []
) => {
  mockNotificationsStore.notifications = notifications;
  mockCalculateBalances.mockReturnValue({ 'user-123': 30, 'user-456': -30 });
  mockCalculateSettlements.mockReturnValue([
    { from: 'user-456', to: 'user-123', amount: 30 },
  ]);
  mockGetUserBalanceSummary.mockReturnValue({
    status: 'owed', amount: 30, message: 'You are owed',
  });
  mockGetDoc
    .mockResolvedValueOnce({ exists: () => true, id: group.id, data: () => group })
    .mockResolvedValue(mockUserDoc);

  let callCount = 0;
  mockOnSnapshot.mockImplementation((q, cb) => {
    callCount++;
    if (callCount === 1) {
      cb({ exists: () => true, id: group.id, data: () => group });
    } else if (callCount === 2) {
      cb({ docs: expenses.map(e => ({ id: e.id, data: () => e })) });
    } else {
      if (typeof cb === 'function') cb({ empty: true, docs: [] });
    }
    return jest.fn();
  });
};

// ---------------------------------------------------------------------------
// 1. My Payment Activity — Dismiss and Restore
// ---------------------------------------------------------------------------

describe('GroupDetails - My Payment Activity dismiss and restore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotificationsStore.notifications = [];
  });

  test('Dismiss button appears only on confirmed entries', async () => {
    setupWithGroup(mockGroup, mockExpenses, [
      {
        id: 'log-confirmed',
        type: 'payment_log',
        status: 'confirmed',
        dismissed: false,
        data: { groupId: 'group-123', amount: 30, currency: 'EUR', method: 'paypal', payeeName: 'Bob', payeeId: 'user-456' },
      },
    ]);
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('My Payment Activity'));
    expect(screen.getByText('Dismiss')).toBeInTheDocument();
  });

  test('Dismiss button does not appear on pending entries', async () => {
    setupWithGroup(mockGroup, mockExpenses, [
      {
        id: 'log-pending',
        type: 'payment_log',
        status: 'pending_confirmation',
        dismissed: false,
        data: { groupId: 'group-123', amount: 30, currency: 'EUR', method: 'paypal', payeeName: 'Bob', payeeId: 'user-456' },
      },
    ]);
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('My Payment Activity'));
    expect(screen.queryByText('Dismiss')).not.toBeInTheDocument();
  });

  test('Dismiss button does not appear on declined entries', async () => {
    setupWithGroup(mockGroup, mockExpenses, [
      {
        id: 'log-declined',
        type: 'payment_log',
        status: 'declined',
        dismissed: false,
        data: { groupId: 'group-123', amount: 30, currency: 'EUR', method: 'paypal', payeeName: 'Bob', payeeId: 'user-456' },
      },
    ]);
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('My Payment Activity'));
    expect(screen.queryByText('Dismiss')).not.toBeInTheDocument();
  });

  test('Clicking Dismiss calls updateDoc with dismissed: true', async () => {
    setupWithGroup(mockGroup, mockExpenses, [
      {
        id: 'log-confirmed',
        type: 'payment_log',
        status: 'confirmed',
        dismissed: false,
        data: { groupId: 'group-123', amount: 30, currency: 'EUR', method: 'paypal', payeeName: 'Bob', payeeId: 'user-456' },
      },
    ]);
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Dismiss'));
    await act(async () => { fireEvent.click(screen.getByText('Dismiss')); });
    expect(mockUpdateDoc.mock.calls[0][1]).toEqual({ dismissed: true });
  });

  test('Dismissed tab appears when there are dismissed entries', async () => {
    setupWithGroup(mockGroup, mockExpenses, [
      {
        id: 'log-dismissed',
        type: 'payment_log',
        status: 'confirmed',
        dismissed: true,
        data: { groupId: 'group-123', amount: 30, currency: 'EUR', method: 'paypal', payeeName: 'Bob', payeeId: 'user-456' },
      },
    ]);
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('My Payment Activity'));
    expect(screen.getByText(/Dismissed/)).toBeInTheDocument();
  });

  test('Dismissed tab does not appear when no dismissed entries', async () => {
    setupWithGroup(mockGroup, mockExpenses, [
      {
        id: 'log-confirmed',
        type: 'payment_log',
        status: 'confirmed',
        dismissed: false,
        data: { groupId: 'group-123', amount: 30, currency: 'EUR', method: 'paypal', payeeName: 'Bob', payeeId: 'user-456' },
      },
    ]);
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('My Payment Activity'));
    expect(screen.queryByText(/^Dismissed \(/)).not.toBeInTheDocument();
  });

  test('Clicking Dismissed tab shows Restore button', async () => {
    setupWithGroup(mockGroup, mockExpenses, [
      {
        id: 'log-dismissed',
        type: 'payment_log',
        status: 'confirmed',
        dismissed: true,
        data: { groupId: 'group-123', amount: 30, currency: 'EUR', method: 'paypal', payeeName: 'Bob', payeeId: 'user-456' },
      },
    ]);
    render(<GroupDetails />);
    await waitFor(() => screen.getByText(/Dismissed/));
    fireEvent.click(screen.getByText(/Dismissed/));
    expect(screen.getByText('Restore')).toBeInTheDocument();
  });

  test('Clicking Restore calls updateDoc with dismissed: false', async () => {
    setupWithGroup(mockGroup, mockExpenses, [
      {
        id: 'log-dismissed',
        type: 'payment_log',
        status: 'confirmed',
        dismissed: true,
        data: { groupId: 'group-123', amount: 30, currency: 'EUR', method: 'paypal', payeeName: 'Bob', payeeId: 'user-456' },
      },
    ]);
    render(<GroupDetails />);
    await waitFor(() => screen.getByText(/Dismissed/));
    fireEvent.click(screen.getByText(/Dismissed/));
    await waitFor(() => screen.getByText('Restore'));
    await act(async () => { fireEvent.click(screen.getByText('Restore')); });
    expect(mockUpdateDoc.mock.calls[0][1]).toEqual({ dismissed: false });
  });

  test('Active tab count excludes dismissed entries', async () => {
    setupWithGroup(mockGroup, mockExpenses, [
      {
        id: 'log-active',
        type: 'payment_log',
        status: 'confirmed',
        dismissed: false,
        data: { groupId: 'group-123', amount: 30, currency: 'EUR', method: 'paypal', payeeName: 'Bob', payeeId: 'user-456' },
      },
      {
        id: 'log-dismissed',
        type: 'payment_log',
        status: 'confirmed',
        dismissed: true,
        data: { groupId: 'group-123', amount: 20, currency: 'EUR', method: 'revolut', payeeName: 'Bob', payeeId: 'user-456' },
      },
    ]);
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('My Payment Activity'));
    expect(screen.getByText('Active (1)')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Settlement Summary — payment status badge
// ---------------------------------------------------------------------------

describe('GroupDetails - Settlement Summary payment status badge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotificationsStore.notifications = [];
  });

  test('Amber awaiting badge appears when payer has pending payment log for settlement', async () => {
    setupWithGroup(mockGroup, mockExpenses, [
      {
        id: 'log-pending',
        type: 'payment_log',
        status: 'pending_confirmation',
        dismissed: false,
        data: {
          groupId: 'group-123', amount: 30, currency: 'EUR',
          method: 'paypal', payeeName: 'Alice', payeeId: 'user-456',
        },
      },
    ]);
    // Override so user-123 is the payer (from) — settlement from user-123 to user-456
    mockCalculateSettlements.mockReturnValue([
      { from: 'user-123', to: 'user-456', amount: 30 },
    ]);
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Settlement Summary'));
    expect(screen.getByText('Awaiting confirmation — tap to view')).toBeInTheDocument();
  });

  test('Red declined badge appears when payer has declined payment log for settlement', async () => {
    setupWithGroup(mockGroup, mockExpenses, [
      {
        id: 'log-declined',
        type: 'payment_log',
        status: 'declined',
        dismissed: false,
        data: {
          groupId: 'group-123', amount: 30, currency: 'EUR',
          method: 'paypal', payeeName: 'Alice', payeeId: 'user-123',
        },
      },
    ]);
    mockCalculateSettlements.mockReturnValue([
      { from: 'user-123', to: 'user-456', amount: 30 },
    ]);
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Settlement Summary'));
    expect(screen.getByText(/Declined/i)).toBeInTheDocument();
  });

  test('No badge when payment log status is confirmed', async () => {
    setupWithGroup(mockGroup, mockExpenses, [
      {
        id: 'log-confirmed',
        type: 'payment_log',
        status: 'confirmed',
        dismissed: false,
        data: {
          groupId: 'group-123', amount: 30, currency: 'EUR',
          method: 'paypal', payeeName: 'Alice', payeeId: 'user-123',
        },
      },
    ]);
    mockCalculateSettlements.mockReturnValue([
      { from: 'user-123', to: 'user-456', amount: 30 },
    ]);
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Settlement Summary'));
    expect(screen.queryByText('Awaiting confirmation — tap to view')).not.toBeInTheDocument();
    expect(screen.queryByText('Declined — tap to retry')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Recent Expenses — settlement visual distinction
// ---------------------------------------------------------------------------

describe('GroupDetails - Recent Expenses settlement distinction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotificationsStore.notifications = [];
  });

  test('Settlement badge appears on settlement entries', async () => {
    setupWithGroup(mockGroup, [mockSettlementExpense]);
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Recent Expenses'));
    expect(screen.getByText('Settlement')).toBeInTheDocument();
  });

  test('Cannot be archived note appears on settlement entries', async () => {
    setupWithGroup(mockGroup, [mockSettlementExpense]);
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Recent Expenses'));
    expect(screen.getByText('Cannot be archived')).toBeInTheDocument();
  });

  test('Payment settlement record label appears instead of split info', async () => {
    setupWithGroup(mockGroup, [mockSettlementExpense]);
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Recent Expenses'));
    expect(screen.getByText('Payment settlement record')).toBeInTheDocument();
  });

  test('Settlement badge does not appear on regular expense entries', async () => {
    setupWithGroup(mockGroup, mockExpenses);
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Recent Expenses'));
    expect(screen.queryByText('Settlement')).not.toBeInTheDocument();
  });

  test('Cannot be archived note does not appear on regular expenses', async () => {
    setupWithGroup(mockGroup, mockExpenses);
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Recent Expenses'));
    expect(screen.queryByText('Cannot be archived')).not.toBeInTheDocument();
  });

  test('Regular expense shows split method info not settlement record', async () => {
    setupWithGroup(mockGroup, mockExpenses);
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Recent Expenses'));
    expect(screen.queryByText('Payment settlement record')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 4. Archived expenses hint in Recent Expenses header
// ---------------------------------------------------------------------------

describe('GroupDetails - Archived expenses hint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotificationsStore.notifications = [];
  });

  test('Hint about archived expenses visible on Activity page is shown', async () => {
    setupWithGroup();
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Recent Expenses'));
    expect(
      screen.getByText(/Archived expenses are visible on the Activity page/i)
    ).toBeInTheDocument();
  });

  test('Hint about archiving own expenses only is shown', async () => {
    setupWithGroup();
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Recent Expenses'));
    expect(
      screen.getByText(/You can only archive expenses you added/i)
    ).toBeInTheDocument();
  });
});
