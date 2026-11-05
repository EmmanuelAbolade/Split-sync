// src/components/NotificationsDropdown.test.jsx
// Tests for NotificationsDropdown - visibility, empty state, notification list,
// unread badges, mark all read, clear all, confirm/decline payment actions

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockMarkAsRead    = jest.fn();
const mockMarkAllAsRead = jest.fn();
const mockClearAll      = jest.fn();
const mockConfirmPayment = jest.fn();
const mockDeclinePayment = jest.fn();

const mockStore = {
  notifications: [],
  unreadCount:   0,
  markAsRead:    mockMarkAsRead,
  markAllAsRead: mockMarkAllAsRead,
  clearAll:      mockClearAll,
};

jest.mock('../stores/notificationsStore', () => ({
  useNotificationsStore:    () => mockStore,
  confirmPaymentReceived:   (...a) => mockConfirmPayment(...a),
  declinePaymentReceived:   (...a) => mockDeclinePayment(...a),
}));

// "Confirm it's you": resolves with a token unless a test says otherwise
let mockStepUpToken = 'tok';
const mockStepUpCalls = [];
jest.mock('../hooks/useStepUp', () => ({
  __esModule: true,
  default: () => ({
    requestStepUp: (action, params) => { mockStepUpCalls.push([action, params]); return Promise.resolve(mockStepUpToken); },
    stepUpSheet: null,
  }),
}));
jest.mock('../utils/settlements', () => ({
  confirmParams: (id) => ({ notificationId: id }),
  settlementErrorMessage: jest.requireActual('../utils/settlements').settlementErrorMessage,
}));
jest.mock('../services/firebase', () => ({ __esModule: true, default: {}, db: {} }));

beforeEach(() => { mockStepUpToken = 'tok'; mockStepUpCalls.length = 0; });

import NotificationsDropdown from './NotificationsDropdown';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseNotification = {
  id:             'notif-1',
  type:           'expense',
  title:          'New Expense',
  message:        'Alice added Hotel for EUR 200',
  read:           false,
  requiresAction: false,
  createdAt:      null,
  data:           { groupId: 'group-123' },
};

const paymentNotification = {
  id:             'notif-pay',
  type:           'payment_confirmation_needed',
  title:          'Payment Confirmation',
  message:        'Bob claims to have paid you EUR 30',
  read:           false,
  requiresAction: true,
  createdAt:      null,
  data:           { groupId: 'group-123' },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.notifications = [];
  mockStore.unreadCount   = 0;
});

// ---------------------------------------------------------------------------
// 1. Visibility
// ---------------------------------------------------------------------------

describe('NotificationsDropdown - Visibility', () => {

  test('Renders when isOpen is true', () => {
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  test('Does not render when isOpen is false', () => {
    render(<NotificationsDropdown isOpen={false} onClose={jest.fn()} />);
    expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Empty state
// ---------------------------------------------------------------------------

describe('NotificationsDropdown - Empty state', () => {

  test('Shows No notifications yet when list is empty', () => {
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByText('No notifications yet')).toBeInTheDocument();
  });

  test('Does not show Mark all read when list is empty', () => {
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    expect(screen.queryByText('Mark all read')).not.toBeInTheDocument();
  });

  test('Does not show Clear all when list is empty', () => {
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    expect(screen.queryByText('Clear all')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Close behaviour
// ---------------------------------------------------------------------------

describe('NotificationsDropdown - Close', () => {

  test('Calls onClose when X button is clicked', () => {
    const onClose = jest.fn();
    render(<NotificationsDropdown isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('Calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn();
    const { container } = render(<NotificationsDropdown isOpen={true} onClose={onClose} />);
    // The backdrop is the first fixed div (z-40)
    const backdrop = container.querySelector('.fixed.inset-0.z-40');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 4. Notification list rendering
// ---------------------------------------------------------------------------

describe('NotificationsDropdown - Notification list', () => {

  beforeEach(() => {
    mockStore.notifications = [baseNotification];
    mockStore.unreadCount   = 1;
  });

  test('Renders notification title', () => {
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByText('New Expense')).toBeInTheDocument();
  });

  test('Renders notification message', () => {
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByText('Alice added Hotel for EUR 200')).toBeInTheDocument();
  });

  test('Shows unread count badge in header', () => {
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  test('Shows Mark all read button when unread notifications exist', () => {
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByText('Mark all read')).toBeInTheDocument();
  });

  test('Shows Clear all button when notifications exist', () => {
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByText('Clear all')).toBeInTheDocument();
  });

  test('Shows Just now for null timestamp', () => {
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByText('Just now')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 5. Bulk actions
// ---------------------------------------------------------------------------

describe('NotificationsDropdown - Bulk actions', () => {

  beforeEach(() => {
    mockStore.notifications = [baseNotification];
    mockStore.unreadCount   = 1;
  });

  test('Calls markAllAsRead when Mark all read is clicked', () => {
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Mark all read'));
    expect(mockMarkAllAsRead).toHaveBeenCalledTimes(1);
  });

  test('Calls clearAll when Clear all is confirmed', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Clear all'));
    expect(mockClearAll).toHaveBeenCalledTimes(1);
    window.confirm.mockRestore();
  });

  test('Does not call clearAll when Clear all is cancelled', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Clear all'));
    expect(mockClearAll).not.toHaveBeenCalled();
    window.confirm.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 6. Notification click navigation
// ---------------------------------------------------------------------------

describe('NotificationsDropdown - Navigation on click', () => {

  test('Navigates to group page when notification with groupId is clicked', () => {
    mockStore.notifications = [{ ...baseNotification, read: true }];
    const onClose = jest.fn();
    render(<NotificationsDropdown isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('New Expense'));
    expect(mockNavigate).toHaveBeenCalledWith('/group/group-123');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('Marks unread notification as read when clicked', () => {
    mockStore.notifications = [baseNotification];
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('New Expense'));
    expect(mockMarkAsRead).toHaveBeenCalledWith('notif-1');
  });

  test('Does not navigate for action-required notification when clicked', () => {
    mockStore.notifications = [paymentNotification];
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Payment Confirmation'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 7. Payment action buttons
// ---------------------------------------------------------------------------

describe('NotificationsDropdown - Payment action buttons', () => {

  beforeEach(() => {
    mockStore.notifications = [paymentNotification];
    mockStore.unreadCount   = 1;
  });

  test('Shows Confirm Received button for actionable notification', () => {
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByText('Confirm Received')).toBeInTheDocument();
  });

  test('Shows Did Not Receive button for actionable notification', () => {
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByText('Did Not Receive')).toBeInTheDocument();
  });

  test('Calls confirmPaymentReceived when Confirm Received is clicked', async () => {
    mockConfirmPayment.mockResolvedValue({});
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Confirm Received'));
    });
    expect(mockStepUpCalls).toEqual([['settlements.confirm', { notificationId: 'notif-pay' }]]);
    expect(mockConfirmPayment).toHaveBeenCalledWith('notif-pay', 'tok');
  });

  test('Does not confirm when the step-up is cancelled', async () => {
    mockStepUpToken = null;
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Confirm Received'));
    await waitFor(() => expect(mockStepUpCalls).toHaveLength(1));
    expect(mockConfirmPayment).not.toHaveBeenCalled();
    expect(screen.getByText('Confirm Received')).toBeInTheDocument();
  });

  test('Declining needs no step-up', async () => {
    mockDeclinePayment.mockResolvedValue({});
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Did Not Receive'));
    await waitFor(() => expect(mockDeclinePayment).toHaveBeenCalled());
    expect(mockStepUpCalls).toEqual([]);
  });

  test('Calls declinePaymentReceived when Did Not Receive is clicked', async () => {
    mockDeclinePayment.mockResolvedValue({});
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Did Not Receive'));
    });
    expect(mockDeclinePayment).toHaveBeenCalledWith('notif-pay');
  });

  test('Shows confirmed feedback after successful confirm', async () => {
    mockConfirmPayment.mockResolvedValue({});
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Confirm Received'));
    });
    await waitFor(() =>
      expect(screen.getByText('Payment confirmed. Balance updated.')).toBeInTheDocument()
    );
  });

  test('Shows declined feedback after successful decline', async () => {
    mockDeclinePayment.mockResolvedValue({});
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Did Not Receive'));
    });
    await waitFor(() =>
      expect(screen.getByText('Marked as not received. Payer has been notified.')).toBeInTheDocument()
    );
  });

  test('Shows a generic message when confirm fails unexpectedly', async () => {
    mockConfirmPayment.mockRejectedValue(new Error('Network error'));
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Confirm Received'));
    });
    await waitFor(() =>
      expect(screen.getByText('Failed to confirm. Please try again.')).toBeInTheDocument()
    );
  });

  test('Shows the server explanation when the payment cannot be confirmed', async () => {
    mockConfirmPayment.mockRejectedValue(Object.assign(new Error('This payment has already been answered.'), { code: 'functions/failed-precondition' }));
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Confirm Received'));
    expect(await screen.findByText('This payment has already been answered.')).toBeInTheDocument();
  });

  test('Shows a not-allowed message for permission errors', async () => {
    const permError = Object.assign(new Error('Permission denied'), { code: 'functions/permission-denied' });
    mockConfirmPayment.mockRejectedValue(permError);
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Confirm Received'));
    });
    await waitFor(() =>
      expect(screen.getByText('You are not allowed to do this.')).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 8. Read vs unread styling indicator
// ---------------------------------------------------------------------------

describe('NotificationsDropdown - Read state', () => {

  test('Does not show Mark all read when all notifications are read', () => {
    mockStore.notifications = [{ ...baseNotification, read: true }];
    mockStore.unreadCount   = 0;
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    expect(screen.queryByText('Mark all read')).not.toBeInTheDocument();
  });

  test('Does not show unread badge when unreadCount is 0', () => {
    mockStore.notifications = [{ ...baseNotification, read: true }];
    mockStore.unreadCount   = 0;
    render(<NotificationsDropdown isOpen={true} onClose={jest.fn()} />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
