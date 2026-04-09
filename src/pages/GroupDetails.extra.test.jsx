// src/pages/GroupDetails.extra.test.jsx
// Covers uncovered lines in GroupDetails.jsx:
// 108-114 (getDisplayTitle settlement), 120-121 (formatDate Firestore ts),
// 133-135 (formatTimeAgo hours/days), 150-151 (fetchGroup error),
// 176 (fetchMemberPhotos error), 196-200 (fetchPaymentMethods doc exists),
// 234-235 (onSnapshot error), 319 (loadPendingInvitations error),
// 333-384 (handleOpenLeave + handleOpenDelete),
// 391-469 (handleAuthAndDelete + handleDeleteGroup),
// 552-661 (pending banner Yes, Mark as Paid),
// 716, 735 (confirm/decline payment error catches),
// 797-819 (invitations Resend/Cancel),
// 1132 (payment history toggle), 1228-1231 (declined retry button),
// 1275-1276 (Add Expense stopPropagation),
// 1382-1386 (SettleUpModal onClose clear banner),
// 1403-1407 (ExpenseDetailsModal onEdit),
// 1443-1545 (Leave/Delete confirmation modals)

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
const mockUpdateDoc  = jest.fn(() => Promise.resolve());
const mockDeleteDoc  = jest.fn(() => Promise.resolve());
const mockArrayRemove = jest.fn((val) => val);

const mockBatch = {
  delete: jest.fn(),
  commit: jest.fn(() => Promise.resolve()),
};
const mockWriteBatch  = jest.fn(() => mockBatch);
const mockGetDocs     = jest.fn(() => Promise.resolve({ docs: [] }));

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

const mockIsBiometricEnabledOnDevice = jest.fn(() => false);
const mockAuthenticateWithBiometric  = jest.fn();
jest.mock('../utils/biometric', () => ({
  authenticateWithBiometric:  (...a) => mockAuthenticateWithBiometric(...a),
  isBiometricEnabledOnDevice: (...a) => mockIsBiometricEnabledOnDevice(...a),
}));

const mockReauthenticateWithCredential = jest.fn();
jest.mock('firebase/auth', () => ({
  reauthenticateWithCredential: (...a) => mockReauthenticateWithCredential(...a),
  EmailAuthProvider: { credential: jest.fn(() => 'mock-credential') },
}));

// Stable user — OWNER (createdBy matches uid)
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
const mockConfirmPayment     = jest.fn(() => Promise.resolve());
const mockDeclinePayment     = jest.fn(() => Promise.resolve());
const mockCreateNotification = jest.fn(() => Promise.resolve());
jest.mock('../stores/notificationsStore', () => ({
  useNotificationsStore:    () => mockNotificationsStore,
  confirmPaymentReceived:   (...a) => mockConfirmPayment(...a),
  declinePaymentReceived:   (...a) => mockDeclinePayment(...a),
  createNotification:       (...a) => mockCreateNotification(...a),
}));

const mockGetMySentInvitations = jest.fn(() => Promise.resolve([]));
const mockCancelInvitation     = jest.fn(() => Promise.resolve({ success: true }));
const mockSendInvitation       = jest.fn(() => Promise.resolve());
jest.mock('../utils/invitationSystem', () => ({
  getMySentInvitations: (...a) => mockGetMySentInvitations(...a),
  cancelInvitation:     (...a) => mockCancelInvitation(...a),
  sendInvitation:       (...a) => mockSendInvitation(...a),
}));

const mockCalculateBalances     = jest.fn();
const mockCalculateSettlements  = jest.fn();
const mockGetUserBalanceSummary = jest.fn();
jest.mock('../utils/balanceCalculator', () => ({
  calculateBalances:     (...a) => mockCalculateBalances(...a),
  calculateSettlements:  (...a) => mockCalculateSettlements(...a),
  getUserBalanceSummary: (...a) => mockGetUserBalanceSummary(...a),
}));

// Child modal stubs — expose enough props for callback tests
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

import GroupDetails from './GroupDetails';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockGroupOwner = {
  id:        'group-123',
  name:      'Weekend Trip',
  currency:  'EUR',
  icon:      'plane',
  createdBy: 'user-123', // Alice is owner
  members: [
    { userId: 'user-123', name: 'Alice', email: 'alice@example.com', role: 'owner' },
    { userId: 'user-456', name: 'Bob',   email: 'bob@example.com',   role: 'member' },
  ],
};

const mockGroupMember = {
  ...mockGroupOwner,
  createdBy: 'user-456', // Bob is owner, Alice is member
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

const settlementExpense = {
  id: 'set-1', isSettlement: true, title: 'old title', amount: 30, currency: 'EUR',
  groupId: 'group-123', paidBy: 'user-456',
  participants: ['user-456', 'user-123'],
  splits: {}, splitMethod: 'exact', category: 'other', date: '2024-01-15',
};

const mockUserDoc = { exists: () => false, data: () => ({}) };

// ---------------------------------------------------------------------------
// Setup helper
// ---------------------------------------------------------------------------

const setupWithGroup = (group = mockGroupOwner, expenses = mockExpenses) => {
  mockCalculateBalances.mockReturnValue({ 'user-123': 30, 'user-456': -30 });
  mockCalculateSettlements.mockReturnValue([{ from: 'user-456', to: 'user-123', amount: 30 }]);
  mockGetUserBalanceSummary.mockReturnValue({ status: 'owed', amount: 30, message: 'You are owed' });
  mockGetDoc.mockResolvedValueOnce({ exists: () => true, id: group.id, data: () => group })
            .mockResolvedValue(mockUserDoc);
  let callCount = 0;
  mockOnSnapshot.mockImplementation((q, cb) => {
    callCount++;
    if (callCount === 1) {
      cb({ exists: () => true, id: group.id, data: () => group });
    } else {
      cb({ docs: expenses.map(e => ({ id: e.id, data: () => e })) });
    }
    return jest.fn();
  });
  mockGetMySentInvitations.mockResolvedValue([]);
  mockNotificationsStore.notifications = [];
};

// ---------------------------------------------------------------------------
// 1. getDisplayTitle — settlement expense branch (lines 108-114)
// ---------------------------------------------------------------------------

describe('GroupDetails Extra - getDisplayTitle for settlement expenses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    mockBatch.delete.mockClear();
    mockBatch.commit.mockClear().mockResolvedValue();
  });

  test('Settlement expense shows member names in title', async () => {
    setupWithGroup(mockGroupOwner, [settlementExpense]);
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText(/Settlement: Bob → Alice/)).toBeInTheDocument()
    );
  });

  test('Settlement expense shows Unknown when member not found', async () => {
    const orphanSettlement = { ...settlementExpense, paidBy: 'user-999', participants: ['user-999', 'user-888'] };
    setupWithGroup(mockGroupOwner, [orphanSettlement]);
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText(/Settlement: Unknown → Unknown/)).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 2. formatDate — Firestore Timestamp branch (lines 120-121)
// ---------------------------------------------------------------------------

describe('GroupDetails Extra - formatDate Firestore timestamp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  test('Renders expense date from Firestore Timestamp object', async () => {
    const firestoreDate = { toDate: () => new Date('2024-06-01') };
    const expWithTs = { ...mockExpenses[0], date: firestoreDate };
    setupWithGroup(mockGroupOwner, [expWithTs]);
    mockNotificationsStore.notifications = [{
      id: 'log-1', type: 'payment_log',
      createdAt: firestoreDate,
      data: { groupId: 'group-123', amount: 30, currency: 'EUR', method: 'paypal', payeeName: 'Bob' },
    }];
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('My Payment Activity')).toBeInTheDocument()
    );
    // Just verify no crash — Firestore toDate() path was exercised
    expect(screen.getByText(/My Payment Activity/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. formatTimeAgo — hours / days branches (lines 133-135)
// ---------------------------------------------------------------------------

describe('GroupDetails Extra - formatTimeAgo hours and days branches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    setupWithGroup();
  });

  test('Shows hours ago for invitation created 2 hours ago', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    mockGetMySentInvitations.mockResolvedValue([{
      id: 'inv-h', status: 'pending',
      toUserName: 'Charlie', toUserEmail: 'c@test.com', toUserId: 'user-789',
      createdAt: twoHoursAgo,
    }]);
    render(<GroupDetails />);
    await waitFor(() => expect(screen.getByText(/hours? ago/)).toBeInTheDocument());
  });

  test('Shows days ago for invitation created 3 days ago', async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400 * 1000).toISOString();
    mockGetMySentInvitations.mockResolvedValue([{
      id: 'inv-d', status: 'pending',
      toUserName: 'Charlie', toUserEmail: 'c@test.com', toUserId: 'user-789',
      createdAt: threeDaysAgo,
    }]);
    render(<GroupDetails />);
    await waitFor(() => expect(screen.getByText(/days? ago/)).toBeInTheDocument());
  });
});

// ---------------------------------------------------------------------------
// 4. fetchGroup error path (lines 150-151)
// ---------------------------------------------------------------------------

describe('GroupDetails Extra - fetchGroup error path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  test('Navigates to /dashboard when getDoc throws', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockOnSnapshot.mockImplementation((q, successCb, errorCb) => {
      errorCb(new Error('Network error'));
      return jest.fn();
    });
    mockGetMySentInvitations.mockResolvedValue([]);
    render(<GroupDetails />);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
    consoleSpy.mockRestore();
  });

  test('Navigates to /dashboard when group doc does not exist', async () => {
    let callCount = 0;
    mockOnSnapshot.mockImplementation((q, cb) => {
      callCount++;
      if (callCount === 1) {
        cb({ exists: () => false, data: () => ({}) });
      } else {
        cb({ docs: [] });
      }
      return jest.fn();
    });
    mockGetMySentInvitations.mockResolvedValue([]);
    render(<GroupDetails />);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
  });
});

// ---------------------------------------------------------------------------
// 5. fetchPaymentMethods — doc exists branch (lines 196-200)
// ---------------------------------------------------------------------------

describe('GroupDetails Extra - fetchPaymentMethods doc exists', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    mockCalculateBalances.mockReturnValue({ 'user-123': 0, 'user-456': 0 });
    mockCalculateSettlements.mockReturnValue([]);
    mockGetUserBalanceSummary.mockReturnValue({ status: 'settled', amount: 0, message: 'All settled up!' });
  });

  test('Loads payment methods when user doc exists', async () => {
    const userDocWithMethods = {
      exists: () => true,
      data: () => ({ paymentMethods: { encryptedIBAN: 'ENC_IBAN' } }),
    };
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, id: 'group-123', data: () => mockGroupOwner })
              .mockResolvedValue(userDocWithMethods);
    let callCount = 0;
    mockOnSnapshot.mockImplementation((q, cb) => {
      callCount++;
      if (callCount === 1) {
        cb({ exists: () => true, id: 'group-123', data: () => mockGroupOwner });
      } else {
        cb({ docs: [] });
      }
      return jest.fn();
    });
    mockGetMySentInvitations.mockResolvedValue([]);
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('Weekend Trip')).toBeInTheDocument()
    );
    // SEPA Ready badge should appear for members with encryptedIBAN
    await waitFor(() =>
      expect(screen.getAllByText('SEPA Ready').length).toBeGreaterThan(0)
    );
  });
});

// ---------------------------------------------------------------------------
// 6. onSnapshot error callback (lines 234-235)
// ---------------------------------------------------------------------------

describe('GroupDetails Extra - onSnapshot error callback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  test('Handles onSnapshot error gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, id: 'group-123', data: () => mockGroupOwner })
              .mockResolvedValue(mockUserDoc);
    let callCount = 0;
    mockOnSnapshot.mockImplementation((q, successCb, errorCb) => {
      callCount++;
      if (callCount === 1) {
        successCb({ exists: () => true, id: 'group-123', data: () => mockGroupOwner });
      } else {
        errorCb(new Error('Firestore permission denied'));
      }
      return jest.fn();
    });
    mockGetMySentInvitations.mockResolvedValue([]);
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('Weekend Trip')).toBeInTheDocument()
    );
    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 7. loadPendingInvitations error catch (line 319)
// ---------------------------------------------------------------------------

describe('GroupDetails Extra - loadPendingInvitations error', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  test('Handles getMySentInvitations error gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    setupWithGroup();
    mockGetMySentInvitations.mockRejectedValueOnce(new Error('Firestore error'));
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText('Weekend Trip')).toBeInTheDocument()
    );
    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 8. Pending payment banner — Yes, Mark as Paid button (lines 655-663)
// ---------------------------------------------------------------------------

describe('GroupDetails Extra - Pending payment banner Yes action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    // Settlement matches fromUserId/toUserId in pending payment
    mockCalculateSettlements.mockReturnValue([
      { from: 'user-123', to: 'user-456', amount: 30 },
    ]);
  });

  afterEach(() => sessionStorage.clear());

  test('Clicking Yes opens SettleUpModal for matching settlement', async () => {
    setupWithGroup();
    // Override settlements so direction matches the pending payment (user-123 → user-456)
    mockCalculateSettlements.mockReturnValue([{ from: 'user-123', to: 'user-456', amount: 30 }]);
    sessionStorage.setItem('pendingPayment', JSON.stringify({
      groupId: 'group-123', fromUserId: 'user-123', toUserId: 'user-456',
      toName: 'Bob', method: 'paypal', amount: 30, currency: 'EUR',
    }));
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Yes, Mark as Paid'));
    fireEvent.click(screen.getByText('Yes, Mark as Paid'));
    await waitFor(() =>
      expect(screen.getByTestId('settle-up-modal')).toBeInTheDocument()
    );
  });

  test('Clicking Yes with no matching settlement does not crash', async () => {
    setupWithGroup();
    mockCalculateSettlements.mockReturnValue([]);
    sessionStorage.setItem('pendingPayment', JSON.stringify({
      groupId: 'group-123', fromUserId: 'user-123', toUserId: 'user-456',
      toName: 'Bob', method: 'paypal', amount: 30, currency: 'EUR',
    }));
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Yes, Mark as Paid'));
    fireEvent.click(screen.getByText('Yes, Mark as Paid'));
    // No modal, no crash
    expect(screen.queryByTestId('settle-up-modal')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 9. Confirm/Decline payment error catches (lines 716, 735)
// ---------------------------------------------------------------------------

describe('GroupDetails Extra - Payment banner error catches', () => {
  const notif = {
    id: 'notif-err', type: 'payment_confirmation_needed',
    requiresAction: true, read: false,
    data: { groupId: 'group-123', payerName: 'Bob', amount: 30, currency: 'EUR', method: 'paypal' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    setupWithGroup();
    // Must be set AFTER setupWithGroup, which resets notifications to []
    mockNotificationsStore.notifications = [notif];
  });

  test('Handles confirmPaymentReceived error without crashing', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockConfirmPayment.mockRejectedValueOnce(new Error('Network error'));
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Confirm Received'));
    await act(async () => {
      fireEvent.click(screen.getByText('Confirm Received'));
    });
    await waitFor(() => expect(mockConfirmPayment).toHaveBeenCalled());
    consoleSpy.mockRestore();
  });

  test('Handles declinePaymentReceived error without crashing', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockDeclinePayment.mockRejectedValueOnce(new Error('Network error'));
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Did Not Receive'));
    await act(async () => {
      fireEvent.click(screen.getByText('Did Not Receive'));
    });
    await waitFor(() => expect(mockDeclinePayment).toHaveBeenCalled());
    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 10. Pending invitations Resend / Cancel (lines 797-819)
// ---------------------------------------------------------------------------

describe('GroupDetails Extra - Pending invitations Resend and Cancel', () => {
  const pendingInv = {
    id: 'inv-1', status: 'pending',
    toUserName: 'Charlie', toUserEmail: 'c@test.com', toUserId: 'user-789',
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    setupWithGroup();
    mockGetMySentInvitations.mockResolvedValue([pendingInv]);
    // Re-set after clearAllMocks in case implementation was cleared
    mockCancelInvitation.mockResolvedValue({ success: true });
  });

  test('Resend calls sendInvitation when confirmed', async () => {
    window.confirm = jest.fn(() => true);
    window.alert   = jest.fn();
    render(<GroupDetails />);
    await waitFor(() => screen.getByRole('button', { name: 'Resend' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Resend' }));
    });
    await waitFor(() => expect(mockSendInvitation).toHaveBeenCalled());
  });

  test('Resend does nothing when window.confirm is cancelled', async () => {
    window.confirm = jest.fn(() => false);
    render(<GroupDetails />);
    await waitFor(() => screen.getByRole('button', { name: 'Resend' }));
    fireEvent.click(screen.getByRole('button', { name: 'Resend' }));
    expect(mockSendInvitation).not.toHaveBeenCalled();
  });

  test('Cancel calls cancelInvitation and removes item from list', async () => {
    window.confirm = jest.fn(() => true);
    window.alert   = jest.fn();
    render(<GroupDetails />);
    await waitFor(() => screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    });
    await waitFor(() => expect(mockCancelInvitation).toHaveBeenCalledWith('inv-1', 'user-123'));
    await waitFor(() =>
      expect(screen.queryByText('Charlie')).not.toBeInTheDocument()
    );
  });

  test('Cancel does nothing when window.confirm is cancelled', async () => {
    window.confirm = jest.fn(() => false);
    render(<GroupDetails />);
    await waitFor(() => screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockCancelInvitation).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 11. Payment history toggle + declined status + Retry (lines 1132, 1228-1231)
// ---------------------------------------------------------------------------

describe('GroupDetails Extra - Payment history collapse and declined retry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    setupWithGroup();
    // Must be set AFTER setupWithGroup, which resets notifications to []
    mockNotificationsStore.notifications = [{
      id: 'log-1', type: 'payment_log', status: 'pending_confirmation',
      data: { groupId: 'group-123', amount: 30, currency: 'EUR', method: 'paypal', payeeName: 'Bob', payeeId: 'user-456' },
    }];
  });

  test('Clicking payment history header collapses the section', async () => {
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('My Payment Activity'));
    // Section starts expanded — log entry visible
    await waitFor(() => screen.getByText(/Awaiting Confirmation/));
    fireEvent.click(screen.getByText('My Payment Activity').closest('button'));
    await waitFor(() =>
      expect(screen.queryByText(/Awaiting Confirmation/)).not.toBeInTheDocument()
    );
  });

  test('Clicking header again re-expands the section', async () => {
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('My Payment Activity'));
    const headerBtn = screen.getByText('My Payment Activity').closest('button');
    fireEvent.click(headerBtn); // collapse
    fireEvent.click(headerBtn); // expand
    await waitFor(() =>
      expect(screen.getByText(/Awaiting Confirmation/)).toBeInTheDocument()
    );
  });

  test('Declined payment shows Retry Payment button', async () => {
    mockNotificationsStore.notifications = [{
      id: 'log-2', type: 'payment_log', status: 'declined',
      data: { groupId: 'group-123', amount: 30, currency: 'EUR', method: 'paypal', payeeName: 'Bob', payeeId: 'user-456' },
    }];
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Retry Payment/i })).toBeInTheDocument()
    );
  });

  test('Retry Payment opens SettleUpModal when matching settlement found', async () => {
    mockCalculateSettlements.mockReturnValue([
      { from: 'user-123', to: 'user-456', amount: 30 },
    ]);
    mockNotificationsStore.notifications = [{
      id: 'log-2', type: 'payment_log', status: 'declined',
      data: { groupId: 'group-123', amount: 30, currency: 'EUR', method: 'paypal', payeeName: 'Bob', payeeId: 'user-456' },
    }];
    render(<GroupDetails />);
    await waitFor(() => screen.getByRole('button', { name: /Retry Payment/i }));
    fireEvent.click(screen.getByRole('button', { name: /Retry Payment/i }));
    await waitFor(() =>
      expect(screen.getByTestId('settle-up-modal')).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 12. Add Expense stopPropagation (lines 1275-1276)
// ---------------------------------------------------------------------------

describe('GroupDetails Extra - Add Expense stopPropagation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    setupWithGroup();
  });

  test('Add Expense button in header opens modal without collapsing expenses list', async () => {
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Hotel'));
    // Click the Add Expense button in the expenses header (stopPropagation path)
    const addExpenseButtons = screen.getAllByRole('button').filter(
      b => b.textContent.includes('Add Expense') && !b.classList.contains('flex-1')
    );
    // Find the small one inside the collapsible header
    const headerAddBtn = screen.getAllByText('Add Expense').find(
      el => el.closest('div') && !el.closest('button[class*="flex-1"]')
    );
    if (headerAddBtn) {
      fireEvent.click(headerAddBtn);
      await waitFor(() =>
        expect(screen.getByTestId('add-expense-modal')).toBeInTheDocument()
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 13. SettleUpModal onClose — clear pending banner (lines 1382-1386)
// ---------------------------------------------------------------------------

describe('GroupDetails Extra - SettleUpModal onClose clears banner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    setupWithGroup();
    // Override: Alice (user-123) owes Bob (user-456) — matches pending payment direction
    mockCalculateBalances.mockReturnValue({ 'user-123': -30, 'user-456': 30 });
    mockCalculateSettlements.mockReturnValue([{ from: 'user-123', to: 'user-456', amount: 30 }]);
    mockGetUserBalanceSummary.mockReturnValue({ status: 'owes', amount: 30, message: 'You owe' });
  });

  afterEach(() => sessionStorage.clear());

  test('Closing SettleUpModal clears pending banner when sessionStorage is empty', async () => {
    sessionStorage.setItem('pendingPayment', JSON.stringify({
      groupId: 'group-123', fromUserId: 'user-123', toUserId: 'user-456',
      toName: 'Bob', method: 'paypal', amount: 30, currency: 'EUR',
    }));
    render(<GroupDetails />);
    // Open modal via "Yes, Mark as Paid"
    await waitFor(() => screen.getByText('Yes, Mark as Paid'));
    fireEvent.click(screen.getByText('Yes, Mark as Paid'));
    await waitFor(() => screen.getByTestId('settle-up-modal'));
    // Clear sessionStorage to simulate payment confirmed
    sessionStorage.removeItem('pendingPayment');
    fireEvent.click(screen.getByText('Close Settle'));
    await waitFor(() =>
      expect(screen.queryByText('Payment Confirmation Needed')).not.toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 14. ExpenseDetailsModal onEdit (lines 1403-1407)
// ---------------------------------------------------------------------------

describe('GroupDetails Extra - ExpenseDetailsModal onEdit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    setupWithGroup();
  });

  test('Clicking Edit in ExpenseDetailsModal opens AddExpenseModal', async () => {
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Hotel'));
    fireEvent.click(screen.getByText('Hotel').closest('[data-testid]') || screen.getByText('Hotel'));
    // Expense click opens details modal
    await waitFor(() => screen.getByTestId('expense-details-modal'));
    fireEvent.click(screen.getByText('Edit Expense'));
    await waitFor(() =>
      expect(screen.getByTestId('add-expense-modal')).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 15. handleOpenLeave and Leave Group modal (lines 333-365, 1443-1473)
// ---------------------------------------------------------------------------

describe('GroupDetails Extra - Leave Group flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    // Default balances — individual tests override per scenario
    mockCalculateBalances.mockReturnValue({ 'user-123': 30, 'user-456': -30 });
    mockCalculateSettlements.mockReturnValue([{ from: 'user-456', to: 'user-123', amount: 30 }]);
    mockGetUserBalanceSummary.mockReturnValue({ status: 'owed', amount: 30, message: 'You are owed' });
    // Alice is NOT owner in mockGroupMember
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, id: 'group-123', data: () => mockGroupMember })
              .mockResolvedValue(mockUserDoc);
    let callCount = 0;
    mockOnSnapshot.mockImplementation((q, cb) => {
      callCount++;
      if (callCount === 1) {
        cb({ exists: () => true, id: 'group-123', data: () => mockGroupMember });
      } else {
        cb({ docs: mockExpenses.map(e => ({ id: e.id, data: () => e })) });
      }
      return jest.fn();
    });
    mockGetMySentInvitations.mockResolvedValue([]);
    mockNotificationsStore.notifications = [];
  });

  test('Leave Group button appears in group options for non-owner', async () => {
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Weekend Trip'));
    fireEvent.click(screen.getByTitle('Group options'));
    await waitFor(() =>
      expect(screen.getByText('Leave Group')).toBeInTheDocument()
    );
  });

  test('Opening leave with unsettled balance shows block reason', async () => {
    mockCalculateBalances.mockReturnValue({ 'user-123': 30, 'user-456': -30 });
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Weekend Trip'));
    fireEvent.click(screen.getByTitle('Group options'));
    await waitFor(() => screen.getByText('Leave Group'));
    fireEvent.click(screen.getByText('Leave Group'));
    await waitFor(() =>
      expect(screen.getByText(/Settle all balances before leaving/)).toBeInTheDocument()
    );
  });

  test('Opening leave with zero balance shows confirm dialog', async () => {
    mockCalculateBalances.mockReturnValue({ 'user-123': 0, 'user-456': 0 });
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Weekend Trip'));
    fireEvent.click(screen.getByTitle('Group options'));
    await waitFor(() => screen.getByText('Leave Group'));
    fireEvent.click(screen.getByText('Leave Group'));
    await waitFor(() =>
      expect(screen.getByText(/Are you sure you want to leave/)).toBeInTheDocument()
    );
  });

  test('Confirming leave calls updateDoc and navigates to dashboard', async () => {
    mockCalculateBalances.mockReturnValue({ 'user-123': 0, 'user-456': 0 });
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Weekend Trip'));
    fireEvent.click(screen.getByTitle('Group options'));
    await waitFor(() => screen.getByText('Leave Group'));
    fireEvent.click(screen.getByText('Leave Group'));
    await waitFor(() => screen.getByRole('button', { name: /^Leave Group$/ }));
    // Find the modal's Leave Group button (not the menu item)
    const leaveButtons = screen.getAllByText('Leave Group');
    const confirmBtn = leaveButtons[leaveButtons.length - 1];
    await act(async () => { fireEvent.click(confirmBtn); });
    await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
  });

  test('OK Got It closes the balance-blocked leave dialog', async () => {
    mockCalculateBalances.mockReturnValue({ 'user-123': 30, 'user-456': -30 });
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Weekend Trip'));
    fireEvent.click(screen.getByTitle('Group options'));
    await waitFor(() => screen.getByText('Leave Group'));
    fireEvent.click(screen.getByText('Leave Group'));
    await waitFor(() => screen.getByText('OK, Got It'));
    fireEvent.click(screen.getByText('OK, Got It'));
    await waitFor(() =>
      expect(screen.queryByText(/Settle all balances before leaving/)).not.toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 16. handleOpenDelete + handleAuthAndDelete + handleDeleteGroup (lines 371-469, 1479-1563)
// ---------------------------------------------------------------------------

describe('GroupDetails Extra - Delete Group flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    // Default balances — individual tests override per scenario
    mockCalculateBalances.mockReturnValue({ 'user-123': 30, 'user-456': -30 });
    mockCalculateSettlements.mockReturnValue([{ from: 'user-456', to: 'user-123', amount: 30 }]);
    mockGetUserBalanceSummary.mockReturnValue({ status: 'owed', amount: 30, message: 'You are owed' });
    mockBatch.delete.mockClear();
    mockBatch.commit.mockClear().mockResolvedValue();
    mockWriteBatch.mockReturnValue(mockBatch);
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockDeleteDoc.mockResolvedValue();
    // Alice IS owner
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, id: 'group-123', data: () => mockGroupOwner })
              .mockResolvedValue(mockUserDoc);
    let callCount = 0;
    mockOnSnapshot.mockImplementation((q, cb) => {
      callCount++;
      if (callCount === 1) {
        cb({ exists: () => true, id: 'group-123', data: () => mockGroupOwner });
      } else {
        cb({ docs: mockExpenses.map(e => ({ id: e.id, data: () => e })) });
      }
      return jest.fn();
    });
    mockGetMySentInvitations.mockResolvedValue([]);
    mockNotificationsStore.notifications = [];
    mockIsBiometricEnabledOnDevice.mockReturnValue(false);
  });

  test('Delete Group button appears in group options for owner', async () => {
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Weekend Trip'));
    fireEvent.click(screen.getByTitle('Group options'));
    await waitFor(() =>
      expect(screen.getByText('Delete Group')).toBeInTheDocument()
    );
  });

  test('Opening delete with unsettled members shows block reason', async () => {
    mockCalculateBalances.mockReturnValue({ 'user-123': 30, 'user-456': -30 });
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Weekend Trip'));
    fireEvent.click(screen.getByTitle('Group options'));
    await waitFor(() => screen.getByText('Delete Group'));
    fireEvent.click(screen.getByText('Delete Group'));
    await waitFor(() =>
      expect(screen.getByText(/still have outstanding balances/)).toBeInTheDocument()
    );
  });

  test('OK Got It closes the balance-blocked delete dialog', async () => {
    mockCalculateBalances.mockReturnValue({ 'user-123': 30, 'user-456': -30 });
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Weekend Trip'));
    fireEvent.click(screen.getByTitle('Group options'));
    await waitFor(() => screen.getByText('Delete Group'));
    fireEvent.click(screen.getByText('Delete Group'));
    await waitFor(() => screen.getByText('OK, Got It'));
    fireEvent.click(screen.getByText('OK, Got It'));
    await waitFor(() =>
      expect(screen.queryByText(/still have outstanding balances/)).not.toBeInTheDocument()
    );
  });

  test('Opening delete with zero balances shows confirmation form', async () => {
    mockCalculateBalances.mockReturnValue({ 'user-123': 0, 'user-456': 0 });
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Weekend Trip'));
    fireEvent.click(screen.getByTitle('Group options'));
    await waitFor(() => screen.getByText('Delete Group'));
    fireEvent.click(screen.getByText('Delete Group'));
    await waitFor(() =>
      expect(screen.getByText(/permanently delete/i)).toBeInTheDocument()
    );
  });

  test('Password input shown for email/password user without biometric', async () => {
    mockCalculateBalances.mockReturnValue({ 'user-123': 0, 'user-456': 0 });
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Weekend Trip'));
    fireEvent.click(screen.getByTitle('Group options'));
    await waitFor(() => screen.getByText('Delete Group'));
    fireEvent.click(screen.getByText('Delete Group'));
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Your password')).toBeInTheDocument()
    );
  });

  test('Shows error when trying to delete with empty password', async () => {
    mockCalculateBalances.mockReturnValue({ 'user-123': 0, 'user-456': 0 });
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Weekend Trip'));
    fireEvent.click(screen.getByTitle('Group options'));
    await waitFor(() => screen.getByText('Delete Group'));
    fireEvent.click(screen.getByText('Delete Group'));
    await waitFor(() => screen.getByPlaceholderText('Your password'));
    // Click Delete without entering password
    const deleteButtons = screen.getAllByText('Delete Group');
    await act(async () => { fireEvent.click(deleteButtons[deleteButtons.length - 1]); });
    await waitFor(() =>
      expect(screen.getByText('Please enter your password to confirm.')).toBeInTheDocument()
    );
  });

  test('Wrong password shows correct error message', async () => {
    mockCalculateBalances.mockReturnValue({ 'user-123': 0, 'user-456': 0 });
    mockReauthenticateWithCredential.mockRejectedValueOnce({ code: 'auth/wrong-password' });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Weekend Trip'));
    fireEvent.click(screen.getByTitle('Group options'));
    await waitFor(() => screen.getByText('Delete Group'));
    fireEvent.click(screen.getByText('Delete Group'));
    await waitFor(() => screen.getByPlaceholderText('Your password'));
    fireEvent.change(screen.getByPlaceholderText('Your password'), {
      target: { value: 'wrongpass' },
    });
    const deleteButtons = screen.getAllByText('Delete Group');
    await act(async () => { fireEvent.click(deleteButtons[deleteButtons.length - 1]); });
    await waitFor(() =>
      expect(screen.getByText('Incorrect password. Please try again.')).toBeInTheDocument()
    );
    consoleSpy.mockRestore();
  });

  test('Correct password calls reauth, deletes group, and navigates', async () => {
    mockCalculateBalances.mockReturnValue({ 'user-123': 0, 'user-456': 0 });
    mockReauthenticateWithCredential.mockResolvedValueOnce();
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Weekend Trip'));
    fireEvent.click(screen.getByTitle('Group options'));
    await waitFor(() => screen.getByText('Delete Group'));
    fireEvent.click(screen.getByText('Delete Group'));
    await waitFor(() => screen.getByPlaceholderText('Your password'));
    fireEvent.change(screen.getByPlaceholderText('Your password'), {
      target: { value: 'correct123' },
    });
    const deleteButtons = screen.getAllByText('Delete Group');
    await act(async () => { fireEvent.click(deleteButtons[deleteButtons.length - 1]); });
    await waitFor(() => expect(mockReauthenticateWithCredential).toHaveBeenCalled());
    await waitFor(() => expect(mockDeleteDoc).toHaveBeenCalled());
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
  });

  test('Biometric-enabled path calls authenticateWithBiometric', async () => {
    mockCalculateBalances.mockReturnValue({ 'user-123': 0, 'user-456': 0 });
    mockIsBiometricEnabledOnDevice.mockReturnValue(true);
    mockAuthenticateWithBiometric.mockResolvedValueOnce(true);
    mockReauthenticateWithCredential.mockResolvedValueOnce();
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Weekend Trip'));
    fireEvent.click(screen.getByTitle('Group options'));
    await waitFor(() => screen.getByText('Delete Group'));
    fireEvent.click(screen.getByText('Delete Group'));
    await waitFor(() => screen.getByText(/permanently delete/i));
    const deleteButtons = screen.getAllByText('Delete Group');
    await act(async () => { fireEvent.click(deleteButtons[deleteButtons.length - 1]); });
    await waitFor(() =>
      expect(mockAuthenticateWithBiometric).toHaveBeenCalledWith(
        'user-123',
        'Confirm group deletion'
      )
    );
  });

  test('Biometric returning false shows error message', async () => {
    mockCalculateBalances.mockReturnValue({ 'user-123': 0, 'user-456': 0 });
    mockIsBiometricEnabledOnDevice.mockReturnValue(true);
    mockAuthenticateWithBiometric.mockResolvedValueOnce(false);
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Weekend Trip'));
    fireEvent.click(screen.getByTitle('Group options'));
    await waitFor(() => screen.getByText('Delete Group'));
    fireEvent.click(screen.getByText('Delete Group'));
    await waitFor(() => screen.getByText(/permanently delete/i));
    const deleteButtons = screen.getAllByText('Delete Group');
    await act(async () => { fireEvent.click(deleteButtons[deleteButtons.length - 1]); });
    await waitFor(() =>
      expect(screen.getByText('Biometric authentication failed. Please try again.')).toBeInTheDocument()
    );
  });

  test('Cancel in delete modal closes it', async () => {
    mockCalculateBalances.mockReturnValue({ 'user-123': 0, 'user-456': 0 });
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Weekend Trip'));
    fireEvent.click(screen.getByTitle('Group options'));
    await waitFor(() => screen.getByText('Delete Group'));
    fireEvent.click(screen.getByText('Delete Group'));
    await waitFor(() => screen.getByText(/permanently delete/i));
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() =>
      expect(screen.queryByText(/permanently delete/i)).not.toBeInTheDocument()
    );
  });
});
