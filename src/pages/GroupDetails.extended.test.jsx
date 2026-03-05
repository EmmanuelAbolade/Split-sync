// src/pages/GroupDetails.extended.test.jsx
// Extended tests for GroupDetails — covers previously uncovered sections:
// payment confirmation banners, payment history, settled balance state,
// pending invitations, and sessionStorage-based pending payment banner.

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useParams:   () => ({ groupId: 'group-123' }),
  useNavigate: () => mockNavigate,
}));

const mockGetDoc     = jest.fn();
const mockOnSnapshot = jest.fn();
const mockDoc        = jest.fn();
const mockCollection = jest.fn();
const mockQuery      = jest.fn();
const mockWhere      = jest.fn();
jest.mock('firebase/firestore', () => ({
  doc:        (...a) => mockDoc(...a),
  getDoc:     (...a) => mockGetDoc(...a),
  collection: (...a) => mockCollection(...a),
  query:      (...a) => mockQuery(...a),
  where:      (...a) => mockWhere(...a),
  onSnapshot: (...a) => mockOnSnapshot(...a),
}));

jest.mock('../services/firebase', () => ({ db: {} }));

jest.mock('../stores/authStore', () => {
  const stableUser = { uid: 'user-123', email: 'alice@example.com', displayName: 'Alice' };
  return { useAuthStore: () => ({ user: stableUser }) };
});

// Notifications store — controllable from tests
const mockNotificationsStore = { notifications: [] };
const mockConfirmPayment = jest.fn();
const mockDeclinePayment = jest.fn();
jest.mock('../stores/notificationsStore', () => ({
  useNotificationsStore:    () => mockNotificationsStore,
  confirmPaymentReceived:   (...a) => mockConfirmPayment(...a),
  declinePaymentReceived:   (...a) => mockDeclinePayment(...a),
}));

// Invitation system
const mockGetMySentInvitations = jest.fn();
const mockCancelInvitation     = jest.fn();
const mockSendInvitation       = jest.fn();
jest.mock('../utils/invitationSystem', () => ({
  getMySentInvitations: (...a) => mockGetMySentInvitations(...a),
  cancelInvitation:     (...a) => mockCancelInvitation(...a),
  sendInvitation:       (...a) => mockSendInvitation(...a),
}));

// Balance utilities — controllable from tests
const mockCalculateBalances    = jest.fn();
const mockCalculateSettlements = jest.fn();
const mockGetUserBalanceSummary = jest.fn();
jest.mock('../utils/balanceCalculator', () => ({
  calculateBalances:     (...a) => mockCalculateBalances(...a),
  calculateSettlements:  (...a) => mockCalculateSettlements(...a),
  getUserBalanceSummary: (...a) => mockGetUserBalanceSummary(...a),
}));

// Child modals — simple stubs
jest.mock('../components/AddExpenseModal',     () => ({ isOpen, onClose }) =>
  isOpen ? <div data-testid="add-expense-modal"><button onClick={onClose}>Close Add</button></div> : null
);
jest.mock('../components/SettleUpModal',       () => ({ isOpen, onClose }) =>
  isOpen ? <div data-testid="settle-up-modal"><button onClick={onClose}>Close Settle</button></div> : null
);
jest.mock('../components/ExpenseDetailsModal', () => ({ isOpen, onClose }) =>
  isOpen ? <div data-testid="expense-details-modal"><button onClick={onClose}>Close Details</button></div> : null
);
jest.mock('../components/ShareInviteModal',    () => ({ isOpen, onClose }) =>
  isOpen ? <div data-testid="share-invite-modal"><button onClick={onClose}>Close Share</button></div> : null
);

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import GroupDetails from './GroupDetails';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockGroup = {
  id:       'group-123',
  name:     'Weekend Trip',
  currency: 'EUR',
  icon:     'plane',
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
  },
];

const mockGroupDoc = { exists: () => true, id: 'group-123', data: () => mockGroup };
const mockUserDoc  = { exists: () => false, data: () => ({}) };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const resetBalanceMocks = (overrides = {}) => {
  mockCalculateBalances.mockReturnValue(
    overrides.balances ?? { 'user-123': 30, 'user-456': -30 }
  );
  mockCalculateSettlements.mockReturnValue(
    overrides.settlements ?? [{ from: 'user-456', to: 'user-123', amount: 30 }]
  );
  mockGetUserBalanceSummary.mockReturnValue(
    overrides.summary ?? { status: 'owed', amount: 30, message: 'You are owed' }
  );
};

const setupWithGroup = (expenses = mockExpenses) => {
  resetBalanceMocks();
  mockGetDoc.mockResolvedValueOnce(mockGroupDoc).mockResolvedValue(mockUserDoc);
  mockOnSnapshot.mockImplementation((q, cb) => {
    cb({ docs: expenses.map(e => ({ id: e.id, data: () => e })) });
    return jest.fn();
  });
  mockGetMySentInvitations.mockResolvedValue([]);
  mockNotificationsStore.notifications = [];
};

// ---------------------------------------------------------------------------
// 1. Settled balance state
// ---------------------------------------------------------------------------

describe('GroupDetails Extended - Settled balance state', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockNotificationsStore.notifications = [];
    mockGetMySentInvitations.mockResolvedValue([]);
    resetBalanceMocks({
      summary: { status: 'settled', amount: 0, message: 'All settled up!' },
    });
    mockGetDoc.mockResolvedValueOnce(mockGroupDoc).mockResolvedValue(mockUserDoc);
    mockOnSnapshot.mockImplementation((q, cb) => {
      cb({ docs: mockExpenses.map(e => ({ id: e.id, data: () => e })) });
      return jest.fn();
    });
  });

  test('Shows All settled up message when balance is settled', async () => {
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getAllByText('All settled up!').length).toBeGreaterThan(0)
    );
  });
});

// ---------------------------------------------------------------------------
// 2. Payment confirmation banners (notifications store)
// ---------------------------------------------------------------------------

describe('GroupDetails Extended - Payment confirmation banners', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupWithGroup();
  });

  test('Shows payment confirmation banner when notification exists', async () => {
    mockNotificationsStore.notifications = [{
      id:             'notif-1',
      userId:         'user-123',
      type:           'payment_confirmation_needed',
      requiresAction: true,
      read:           false,
      data: {
        groupId:   'group-123',
        payerName: 'Bob',
        amount:    30,
        currency:  'EUR',
        method:    'paypal',
      },
    }];

    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('Payment Confirmation Required')).toBeInTheDocument()
    );
  });

  test('Shows payer name and amount in confirmation banner', async () => {
    mockNotificationsStore.notifications = [{
      id:             'notif-1',
      userId:         'user-123',
      type:           'payment_confirmation_needed',
      requiresAction: true,
      read:           false,
      data: {
        groupId:   'group-123',
        payerName: 'Bob',
        amount:    30,
        currency:  'EUR',
        method:    'paypal',
      },
    }];

    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('Payment Confirmation Required')).toBeInTheDocument()
    );
    expect(screen.getAllByText(/30\.00/).length).toBeGreaterThan(0);
  });

  test('Shows Confirm Received button in banner', async () => {
    mockNotificationsStore.notifications = [{
      id:             'notif-1',
      userId:         'user-123',
      type:           'payment_confirmation_needed',
      requiresAction: true,
      read:           false,
      data: {
        groupId: 'group-123', payerName: 'Bob',
        amount: 30, currency: 'EUR', method: 'paypal',
      },
    }];

    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('Confirm Received')).toBeInTheDocument()
    );
  });

  test('Shows Did Not Receive button in banner', async () => {
    mockNotificationsStore.notifications = [{
      id:             'notif-1',
      userId:         'user-123',
      type:           'payment_confirmation_needed',
      requiresAction: true,
      read:           false,
      data: {
        groupId: 'group-123', payerName: 'Bob',
        amount: 30, currency: 'EUR', method: 'paypal',
      },
    }];

    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('Did Not Receive')).toBeInTheDocument()
    );
  });

  test('Calls confirmPaymentReceived when Confirm Received is clicked', async () => {
    mockConfirmPayment.mockResolvedValue({});
    mockNotificationsStore.notifications = [{
      id:             'notif-1',
      userId:         'user-123',
      type:           'payment_confirmation_needed',
      requiresAction: true,
      read:           false,
      data: {
        groupId: 'group-123', payerName: 'Bob',
        amount: 30, currency: 'EUR', method: 'paypal',
      },
    }];

    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Confirm Received'));
    await act(async () => {
      fireEvent.click(screen.getByText('Confirm Received'));
    });
    expect(mockConfirmPayment).toHaveBeenCalledWith('notif-1');
  });

  test('Calls declinePaymentReceived when Did Not Receive is clicked', async () => {
    mockDeclinePayment.mockResolvedValue({});
    mockNotificationsStore.notifications = [{
      id:             'notif-1',
      userId:         'user-123',
      type:           'payment_confirmation_needed',
      requiresAction: true,
      read:           false,
      data: {
        groupId: 'group-123', payerName: 'Bob',
        amount: 30, currency: 'EUR', method: 'paypal',
      },
    }];

    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Did Not Receive'));
    await act(async () => {
      fireEvent.click(screen.getByText('Did Not Receive'));
    });
    expect(mockDeclinePayment).toHaveBeenCalledWith('notif-1');
  });

  test('Does not show banner for notifications from other groups', async () => {
    mockNotificationsStore.notifications = [{
      id:             'notif-2',
      userId:         'user-123',
      type:           'payment_confirmation_needed',
      requiresAction: true,
      read:           false,
      data: {
        groupId: 'other-group', payerName: 'Bob',
        amount: 30, currency: 'EUR', method: 'paypal',
      },
    }];

    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Weekend Trip'));
    expect(screen.queryByText('Payment Confirmation Required')).not.toBeInTheDocument();
  });

  test('Does not show banner for already-read notifications', async () => {
    mockNotificationsStore.notifications = [{
      id:             'notif-3',
      userId:         'user-123',
      type:           'payment_confirmation_needed',
      requiresAction: true,
      read:           true, // already read
      data: {
        groupId: 'group-123', payerName: 'Bob',
        amount: 30, currency: 'EUR', method: 'paypal',
      },
    }];

    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Weekend Trip'));
    expect(screen.queryByText('Payment Confirmation Required')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Pending invitations section
// ---------------------------------------------------------------------------

describe('GroupDetails Extended - Pending invitations', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupWithGroup();
  });

  test('Shows pending invitations section when invitations exist', async () => {
    mockGetMySentInvitations.mockResolvedValue([{
      id:          'inv-1',
      status:      'pending',
      toUserName:  'Charlie',
      toUserEmail: 'charlie@example.com',
      toUserId:    'user-789',
      createdAt:   new Date().toISOString(),
    }]);

    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText(/Pending Invitations/)).toBeInTheDocument()
    );
  });

  test('Shows invited person name in pending invitations', async () => {
    mockGetMySentInvitations.mockResolvedValue([{
      id:          'inv-1',
      status:      'pending',
      toUserName:  'Charlie',
      toUserEmail: 'charlie@example.com',
      toUserId:    'user-789',
      createdAt:   new Date().toISOString(),
    }]);

    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('Charlie')).toBeInTheDocument()
    );
  });

  test('Shows invited person email in pending invitations', async () => {
    mockGetMySentInvitations.mockResolvedValue([{
      id:          'inv-1',
      status:      'pending',
      toUserName:  'Charlie',
      toUserEmail: 'charlie@example.com',
      toUserId:    'user-789',
      createdAt:   new Date().toISOString(),
    }]);

    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('charlie@example.com')).toBeInTheDocument()
    );
  });

  test('Shows Resend button for pending invitation', async () => {
    mockGetMySentInvitations.mockResolvedValue([{
      id:          'inv-1',
      status:      'pending',
      toUserName:  'Charlie',
      toUserEmail: 'charlie@example.com',
      toUserId:    'user-789',
      createdAt:   new Date().toISOString(),
    }]);

    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Resend' })).toBeInTheDocument()
    );
  });

  test('Shows Cancel button for pending invitation', async () => {
    mockGetMySentInvitations.mockResolvedValue([{
      id:          'inv-1',
      status:      'pending',
      toUserName:  'Charlie',
      toUserEmail: 'charlie@example.com',
      toUserId:    'user-789',
      createdAt:   new Date().toISOString(),
    }]);

    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    );
  });

  test('Does not show pending invitations section when list is empty', async () => {
    mockGetMySentInvitations.mockResolvedValue([]);
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Weekend Trip'));
    expect(screen.queryByText(/Pending Invitations/)).not.toBeInTheDocument();
  });

  test('Filters out non-pending invitations', async () => {
    mockGetMySentInvitations.mockResolvedValue([{
      id:          'inv-2',
      status:      'accepted', // not pending
      toUserName:  'Dave',
      toUserEmail: 'dave@example.com',
      toUserId:    'user-999',
      createdAt:   new Date().toISOString(),
    }]);

    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Weekend Trip'));
    expect(screen.queryByText(/Pending Invitations/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 4. Pending payment banner (sessionStorage)
// ---------------------------------------------------------------------------

describe('GroupDetails Extended - Pending payment banner (sessionStorage)', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupWithGroup();
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  test('Shows pending payment banner when sessionStorage has matching payment', async () => {
    sessionStorage.setItem('pendingPayment', JSON.stringify({
      groupId:     'group-123',
      fromUserId:  'user-123',
      toUserId:    'user-456',
      toName:      'Bob',
      method:      'paypal',
      amount:      30,
      currency:    'EUR',
    }));

    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('Payment Confirmation Needed')).toBeInTheDocument()
    );
  });

  test('Shows payment amount in pending banner', async () => {
    sessionStorage.setItem('pendingPayment', JSON.stringify({
      groupId:    'group-123',
      fromUserId: 'user-123',
      toUserId:   'user-456',
      toName:     'Bob',
      method:     'paypal',
      amount:     30,
      currency:   'EUR',
    }));

    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('Payment Confirmation Needed')).toBeInTheDocument()
    );
    expect(screen.getAllByText(/30\.00/).length).toBeGreaterThan(0);
  });

  test('Does not show banner for payment in different group', async () => {
    sessionStorage.setItem('pendingPayment', JSON.stringify({
      groupId:    'other-group',
      fromUserId: 'user-123',
      toUserId:   'user-456',
      toName:     'Bob',
      method:     'paypal',
      amount:     30,
      currency:   'EUR',
    }));

    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Weekend Trip'));
    expect(screen.queryByText('Payment Confirmation Needed')).not.toBeInTheDocument();
  });

  test('Clicking Not Yet removes pending payment banner', async () => {
    sessionStorage.setItem('pendingPayment', JSON.stringify({
      groupId:    'group-123',
      fromUserId: 'user-123',
      toUserId:   'user-456',
      toName:     'Bob',
      method:     'paypal',
      amount:     30,
      currency:   'EUR',
    }));

    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Not Yet'));
    fireEvent.click(screen.getByText('Not Yet'));
    await waitFor(() =>
      expect(screen.queryByText('Payment Confirmation Needed')).not.toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 5. Payment history section (payment_log notifications)
// ---------------------------------------------------------------------------

describe('GroupDetails Extended - Payment history section', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupWithGroup();
  });

  test('Shows My Payment Activity section when payment logs exist', async () => {
    mockNotificationsStore.notifications = [{
      id:   'log-1',
      type: 'payment_log',
      data: { groupId: 'group-123', amount: 30, currency: 'EUR', method: 'paypal', toName: 'Bob' },
    }];

    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('My Payment Activity')).toBeInTheDocument()
    );
  });

  test('Does not show payment activity section when no logs exist', async () => {
    mockNotificationsStore.notifications = [];
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Weekend Trip'));
    expect(screen.queryByText('My Payment Activity')).not.toBeInTheDocument();
  });
});
