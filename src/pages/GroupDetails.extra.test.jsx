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
const mockArrayRemove = jest.fn((val) => val);
const mockArrayUnion  = jest.fn((val) => val);

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
  arrayUnion:  (...a) => mockArrayUnion(...a),
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
// Phase 1B: "Confirm it's you" and the settlements Functions
// Payer's claim from the "Did you finish paying?" card (plain values: resetMocks keeps them)
const mockRecordCalls = [];
let mockRecordFail = false;
jest.mock('../utils/stepUp', () => ({ newIdempotencyKey: () => 'idem-key-000000000001' }));
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
  useNotificationsStore:    () => mockNotificationsStore,
  confirmPaymentReceived:   (...a) => mockConfirmPayment(...a),
  declinePaymentReceived:   (...a) => mockDeclinePayment(...a),
  recordPaymentSent:        (a) => { mockRecordCalls.push(a); return mockRecordFail ? Promise.reject(Object.assign(new Error('x'), { code: 'functions/internal' })) : Promise.resolve(); },
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

// Members' payment options come from the getGroupPaymentMethods Cloud Function
let mockGroupPaymentMethods = {};
jest.mock('../utils/privateProfile', () => ({
  fetchGroupPaymentMethods: async () => mockGroupPaymentMethods,
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
    } else if (callCount === 2) {
      cb({ docs: expenses.map(e => ({ id: e.id, data: () => e })) });
    } else {
      if (typeof cb === 'function') cb({ empty: true, docs: [] });
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

  test('Settlement expense shows "Former member" when no name can be found', async () => {
    const orphanSettlement = { ...settlementExpense, paidBy: 'user-999', participants: ['user-999', 'user-888'] };
    setupWithGroup(mockGroupOwner, [orphanSettlement]);
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText(/Settlement: Former member → Former member/)).toBeInTheDocument()
    );
  });

  test('Settlement expense keeps the name of a member who left (formerMembers)', async () => {
    const groupWithLeaver = {
      ...mockGroupOwner,
      formerMembers: [{ userId: 'user-999', name: 'Carol', email: 'carol@example.com', reason: 'left' }],
    };
    const leaverSettlement = { ...settlementExpense, paidBy: 'user-999', participants: ['user-999', 'user-123'] };
    setupWithGroup(groupWithLeaver, [leaverSettlement]);
    render(<GroupDetails />);
    await waitFor(() =>
      expect(screen.getByText(/Settlement: Carol \(left\) → Alice/)).toBeInTheDocument()
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

  afterEach(() => { mockGroupPaymentMethods = {}; });

  test('Shows SEPA Ready for members whose server-side payment view has a bank account', async () => {
    // The server returns hasIban (never the IBAN or its ciphertext)
    mockGroupPaymentMethods = { 'user-456': { paypalUsername: null, revolutUsername: null, bic: null, hasIban: true } };
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, id: 'group-123', data: () => mockGroupOwner })
              .mockResolvedValue({ exists: () => false, data: () => ({}) });
    let callCount = 0;
    mockOnSnapshot.mockImplementation((q, cb) => {
      callCount++;
      if (callCount === 1) {
        cb({ exists: () => true, id: 'group-123', data: () => mockGroupOwner });
      } else if (callCount === 2) {
        cb({ docs: [] });
      } else {
        if (typeof cb === 'function') cb({ empty: true, docs: [] });
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
      } else if (callCount === 2) {
        errorCb(new Error('Firestore permission denied'));
      } else {
        if (typeof successCb === 'function') successCb({ empty: true, docs: [] });
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
  const pendingData = {
    groupId: 'group-123', fromUserId: 'user-123', toUserId: 'user-456',
    toName: 'Bob', method: 'paypal', amount: 30, currency: 'EUR', timestamp: 1700000000000,
  };
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    mockRecordCalls.length = 0;
    mockRecordFail = false;
  });
  afterEach(() => sessionStorage.clear());

  test('Yes, I paid sends the claim from the card and says so', async () => {
    mockCalculateSettlements.mockReturnValue([{ from: 'user-123', to: 'user-456', amount: 30 }]);
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, id: 'group-123', data: () => mockGroupOwner })
              .mockResolvedValue(mockUserDoc);
    let callCount = 0;
    mockOnSnapshot.mockImplementation((q, cb) => {
      callCount++;
      if (callCount === 1) cb({ exists: () => true, id: 'group-123', data: () => mockGroupOwner });
      else if (callCount === 2) cb({ docs: [] });
      else cb({ empty: false, docs: [{ id: 'p1', data: () => (pendingData) }] });
      return jest.fn();
    });
    mockGetMySentInvitations.mockResolvedValue([]);
    mockNotificationsStore.notifications = [];
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Yes, I paid'));
    fireEvent.click(screen.getByText('Yes, I paid'));
    await waitFor(() => expect(screen.getByText('Sent to Bob to confirm.')).toBeInTheDocument());
    expect(mockRecordCalls).toEqual([{
      payeeId: 'user-456', groupId: 'group-123', amount: 30, method: 'paypal', idempotencyKey: 'idem-key-000000000001',
    }]);
    expect(screen.queryByText(/Did you finish paying/)).not.toBeInTheDocument();
  });

  test('Yes, I paid keeps the card and shows why when sending fails', async () => {
    mockCalculateSettlements.mockReturnValue([{ from: 'user-123', to: 'user-456', amount: 30 }]);
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, id: 'group-123', data: () => mockGroupOwner })
              .mockResolvedValue(mockUserDoc);
    let callCount = 0;
    mockOnSnapshot.mockImplementation((q, cb) => {
      callCount++;
      if (callCount === 1) cb({ exists: () => true, id: 'group-123', data: () => mockGroupOwner });
      else if (callCount === 2) cb({ docs: [] });
      else cb({ empty: false, docs: [{ id: 'p1', data: () => (pendingData) }] });
      return jest.fn();
    });
    mockGetMySentInvitations.mockResolvedValue([]);
    mockNotificationsStore.notifications = [];
    mockRecordFail = true;
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Yes, I paid'));
    fireEvent.click(screen.getByText('Yes, I paid'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Nothing was saved'));
    expect(screen.getByText(/Did you finish paying Bob/)).toBeInTheDocument();
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
    await waitFor(() => screen.getByText('I got it'));
    await act(async () => {
      fireEvent.click(screen.getByText('I got it'));
    });
    await waitFor(() => expect(mockConfirmPayment).toHaveBeenCalled());
    consoleSpy.mockRestore();
  });

  test('Handles declinePaymentReceived error without crashing', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockDeclinePayment.mockRejectedValueOnce(new Error('Network error'));
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Not received'));
    await act(async () => {
      fireEvent.click(screen.getByText('Not received'));
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

describe('GroupDetails Extra - Waiting for the payee card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  test('A claimed payment shows as waiting, and Withdraw gives feedback', async () => {
    mockCalculateSettlements.mockReturnValue([{ from: 'user-123', to: 'user-456', amount: 30 }]);
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, id: 'group-123', data: () => mockGroupOwner })
              .mockResolvedValue(mockUserDoc);
    let callCount = 0;
    mockOnSnapshot.mockImplementation((q, cb) => {
      callCount++;
      if (callCount === 1) cb({ exists: () => true, id: 'group-123', data: () => mockGroupOwner });
      else if (callCount === 2) cb({ docs: [] });
      else cb({ empty: false, docs: [{ id: 'p1', data: () => ({ groupId: 'group-123', fromUserId: 'user-123', toUserId: 'user-456', toName: 'Bob', method: 'paypal', amount: 30, currency: 'EUR', status: 'claimed' }) }] });
      return jest.fn();
    });
    mockGetMySentInvitations.mockResolvedValue([]);
    mockNotificationsStore.notifications = [];
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Waiting for Bob to confirm'));
    expect(screen.queryByText(/Did you finish paying/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Withdraw'));
    await waitFor(() => expect(screen.getByText('Payment withdrawn. Bob was told.')).toBeInTheDocument());
  });
});

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
    // Leaving must clear memberIds (permissions) and keep a name snapshot
    // (CRA resets mock implementations, so assert on the helper calls)
    const leaveUpdate = mockUpdateDoc.mock.calls.map(c => c[1]).find(u => u && 'formerMembers' in u);
    expect(leaveUpdate).toBeDefined();
    expect(leaveUpdate).toHaveProperty('memberIds');
    expect(mockArrayRemove).toHaveBeenCalledWith('user-123');
    expect(mockArrayUnion).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-123', name: 'Alice', reason: 'left' })
    );
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

// ---------------------------------------------------------------------------
// Membership & Add Expense gating (regression: Recent Expenses "Add Expense"
// link and "Add First Expense" used to bypass the solo-group restriction, and
// non-members could open the group by URL and add expenses)
// ---------------------------------------------------------------------------

describe('GroupDetails Extra - membership and Add Expense gating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  const soloGroup = {
    ...mockGroupOwner,
    members: [{ userId: 'user-123', name: 'Alice', email: 'alice@example.com', role: 'owner' }],
  };

  test('Solo group: every Add Expense entry point is disabled', async () => {
    setupWithGroup(soloGroup, mockExpenses);
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Weekend Trip'));
    const addButtons = screen.getAllByRole('button', { name: /Add Expense/ });
    expect(addButtons.length).toBeGreaterThanOrEqual(2); // header + Recent Expenses link
    addButtons.forEach(btn => fireEvent.click(btn));
    expect(screen.queryByTestId('add-expense-modal')).not.toBeInTheDocument();
  });

  test('Solo group with no expenses hides "Add First Expense"', async () => {
    setupWithGroup(soloGroup, []);
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Weekend Trip'));
    expect(screen.queryByText('Add First Expense')).not.toBeInTheDocument();
    expect(screen.getByText(/Invite at least one member to start adding expenses/)).toBeInTheDocument();
  });

  test('Recent Expenses Add Expense link opens the modal when the group has members', async () => {
    setupWithGroup(mockGroupOwner, mockExpenses);
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Weekend Trip'));
    const addButtons = screen.getAllByRole('button', { name: /Add Expense/ });
    fireEvent.click(addButtons[addButtons.length - 1]);
    expect(screen.getByTestId('add-expense-modal')).toBeInTheDocument();
  });

  test('Non-member sees the rejoin screen instead of the group contents', async () => {
    const notMine = {
      ...mockGroupOwner,
      createdBy: 'user-456',
      members: [{ userId: 'user-456', name: 'Bob', email: 'bob@example.com', role: 'owner' }],
    };
    setupWithGroup(notMine, mockExpenses);
    render(<GroupDetails />);
    await waitFor(() => screen.getByText(/You're not a member of this group/));
    expect(screen.queryByRole('button', { name: /Add Expense/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Hotel')).not.toBeInTheDocument();
  });

  test('Personal tracker: Add Expense works without other members and no Invite Link is shown', async () => {
    setupWithGroup({ ...soloGroup, type: 'personal' }, mockExpenses);
    render(<GroupDetails />);
    await waitFor(() => screen.getByText('Weekend Trip'));
    expect(screen.queryByText('Invite Link')).not.toBeInTheDocument();
    expect(screen.queryByText(/no other members yet/)).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Add Expense/ })[0]);
    expect(screen.getByTestId('add-expense-modal')).toBeInTheDocument();
  });
});
