// src/components/CreateGroupModal.test.jsx
// Test suite for CreateGroupModal component
// Covers: rendering, form validation, group creation, currency selection,
//         pending invitations, Quick Add toggle, error handling, close behaviour

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Suppress browser alert calls
global.alert = jest.fn();

const mockAddDoc      = jest.fn();
const mockCollection  = jest.fn();
const mockServerTimestamp = jest.fn(() => 'mock-timestamp');

jest.mock('firebase/firestore', () => ({
  collection:      (...a) => mockCollection(...a),
  addDoc:          (...a) => mockAddDoc(...a),
  serverTimestamp: ()     => mockServerTimestamp(),
}));

jest.mock('../services/firebase', () => ({ db: {} }));

const mockUser = {
  uid: 'user-123',
  email: 'alice@example.com',
  displayName: 'Alice',
};
jest.mock('../stores/authStore', () => ({
  useAuthStore: () => ({ user: mockUser }),
}));

// Mock child components to keep tests focused
jest.mock('./IconSelector', () => ({ selected, onSelect }) => (
  <div data-testid="icon-selector">
    <button type="button" onClick={() => onSelect('car')}>Select Car Icon</button>
  </div>
));

jest.mock('./QuickAddMembers', () => ({ onAddMembers }) => (
  <div data-testid="quick-add-members">
    <button
      type="button"
      onClick={() => onAddMembers([
        { userId: 'u2', name: 'Bob', email: 'bob@example.com', photoURL: null },
      ])}
    >
      Add Bob
    </button>
  </div>
));

jest.mock('./ContactSyncButton', () => () => (
  <div data-testid="contact-sync-button" />
));

const mockSendBulkInvitations    = jest.fn();
const mockUpdateGroupConnections = jest.fn();

jest.mock('../utils/invitationSystem', () => ({
  sendBulkInvitations: (...a) => mockSendBulkInvitations(...a),
}));

jest.mock('../utils/userConnectionsManager', () => ({
  updateGroupConnections: (...a) => mockUpdateGroupConnections(...a),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import CreateGroupModal from './CreateGroupModal';

// ---------------------------------------------------------------------------
// Default props
// ---------------------------------------------------------------------------

const defaultProps = {
  isOpen:         true,
  onClose:        jest.fn(),
  onGroupCreated: jest.fn(),
};

const renderModal = (props = {}) =>
  render(<CreateGroupModal {...defaultProps} {...props} />);

// ---------------------------------------------------------------------------
// 1. Closed state
// ---------------------------------------------------------------------------

describe('CreateGroupModal - Closed State', () => {
  test('renders nothing when isOpen is false', () => {
    render(<CreateGroupModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Create Group')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Rendering
// ---------------------------------------------------------------------------

describe('CreateGroupModal - Rendering', () => {
  beforeEach(() => jest.clearAllMocks());

  test('renders the Create Group heading', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: /Create Group/i })).toBeInTheDocument();
  });

  test('renders the group name input', () => {
    renderModal();
    expect(
      screen.getByPlaceholderText('e.g., Flat Mates, Paris Trip')
    ).toBeInTheDocument();
  });

  test('renders the currency dropdown', () => {
    renderModal();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  test('renders EUR as the default currency option', () => {
    renderModal();
    expect(screen.getByRole('combobox')).toHaveValue('EUR');
  });

  test('renders all three currency options', () => {
    renderModal();
    expect(screen.getByText('€ Euro')).toBeInTheDocument();
    expect(screen.getByText('$ US Dollar')).toBeInTheDocument();
    expect(screen.getByText('£ British Pound')).toBeInTheDocument();
  });

  test('renders the Create Group submit button', () => {
    renderModal();
    expect(
      screen.getByRole('button', { name: /Create Group/i })
    ).toBeInTheDocument();
  });

  test('renders the Cancel button', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  test('renders the X close button', () => {
    renderModal();
    // X button sits alongside the heading in the header row
    const heading = screen.getByRole('heading', { name: /Create Group/i });
    const closeBtn = heading.parentElement.querySelector('button');
    expect(closeBtn).toBeInTheDocument();
  });

  test('renders the IconSelector component', () => {
    renderModal();
    expect(screen.getByTestId('icon-selector')).toBeInTheDocument();
  });

  test('renders the ContactSyncButton component', () => {
    renderModal();
    expect(screen.getByTestId('contact-sync-button')).toBeInTheDocument();
  });

  test('renders the Quick Add from Previous Groups button', () => {
    renderModal();
    expect(
      screen.getByText('Quick Add from Previous Groups')
    ).toBeInTheDocument();
  });

  test('does not render the error banner initially', () => {
    renderModal();
    expect(
      screen.queryByText('Group name is required')
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Form validation
// ---------------------------------------------------------------------------

describe('CreateGroupModal - Form Validation', () => {
  beforeEach(() => jest.clearAllMocks());

  test('shows error when submitting with empty group name', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Create Group/i }));
    await waitFor(() =>
      expect(screen.getByText('Group name is required')).toBeInTheDocument()
    );
  });

  test('shows error when submitting with whitespace-only group name', async () => {
    renderModal();
    fireEvent.change(
      screen.getByPlaceholderText('e.g., Flat Mates, Paris Trip'),
      { target: { value: '   ' } }
    );
    fireEvent.click(screen.getByRole('button', { name: /Create Group/i }));
    await waitFor(() =>
      expect(screen.getByText('Group name is required')).toBeInTheDocument()
    );
  });

  test('does not call addDoc when group name is empty', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Create Group/i }));
    await waitFor(() =>
      screen.getByText('Group name is required')
    );
    expect(mockAddDoc).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 4. Successful group creation
// ---------------------------------------------------------------------------

describe('CreateGroupModal - Successful Creation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: 'new-group-123' });
    mockSendBulkInvitations.mockResolvedValue({ successful: [], failed: [] });
  });

  test('calls addDoc with correct group data on submit', async () => {
    renderModal();
    fireEvent.change(
      screen.getByPlaceholderText('e.g., Flat Mates, Paris Trip'),
      { target: { value: 'Flat Mates' } }
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Group/i }));
    });
    await waitFor(() => expect(mockAddDoc).toHaveBeenCalledTimes(1));
    const callArgs = mockAddDoc.mock.calls[0][1];
    expect(callArgs.name).toBe('Flat Mates');
    expect(callArgs.createdBy).toBe('user-123');
    expect(callArgs.memberIds).toContain('user-123');
  });

  test('trims whitespace from group name before saving', async () => {
    renderModal();
    fireEvent.change(
      screen.getByPlaceholderText('e.g., Flat Mates, Paris Trip'),
      { target: { value: '  Paris Trip  ' } }
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Group/i }));
    });
    await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
    expect(mockAddDoc.mock.calls[0][1].name).toBe('Paris Trip');
  });

  test('calls onGroupCreated with the new group id after creation', async () => {
    renderModal();
    fireEvent.change(
      screen.getByPlaceholderText('e.g., Flat Mates, Paris Trip'),
      { target: { value: 'Test Group' } }
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Group/i }));
    });
    await waitFor(() =>
      expect(defaultProps.onGroupCreated).toHaveBeenCalledWith('new-group-123')
    );
  });

  test('calls onClose after successful group creation', async () => {
    renderModal();
    fireEvent.change(
      screen.getByPlaceholderText('e.g., Flat Mates, Paris Trip'),
      { target: { value: 'Test Group' } }
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Group/i }));
    });
    await waitFor(() =>
      expect(defaultProps.onClose).toHaveBeenCalled()
    );
  });

  test('shows Creating... loading text while submitting', async () => {
    // addDoc never resolves so loading state persists
    mockAddDoc.mockImplementation(() => new Promise(() => {}));
    renderModal();
    fireEvent.change(
      screen.getByPlaceholderText('e.g., Flat Mates, Paris Trip'),
      { target: { value: 'Test Group' } }
    );
    fireEvent.click(screen.getByRole('button', { name: /Create Group/i }));
    await waitFor(() =>
      expect(screen.getByText('Creating...')).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 5. Currency selection
// ---------------------------------------------------------------------------

describe('CreateGroupModal - Currency Selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: 'grp-1' });
    mockSendBulkInvitations.mockResolvedValue({ successful: [], failed: [] });
  });

  test('allows changing currency to USD', () => {
    renderModal();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'USD' } });
    expect(screen.getByRole('combobox')).toHaveValue('USD');
  });

  test('saves the selected currency in group data', async () => {
    renderModal();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'GBP' } });
    fireEvent.change(
      screen.getByPlaceholderText('e.g., Flat Mates, Paris Trip'),
      { target: { value: 'London Trip' } }
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Group/i }));
    });
    await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
    expect(mockAddDoc.mock.calls[0][1].currency).toBe('GBP');
  });
});

// ---------------------------------------------------------------------------
// 6. Close / cancel behaviour
// ---------------------------------------------------------------------------

describe('CreateGroupModal - Close Behaviour', () => {
  beforeEach(() => jest.clearAllMocks());

  test('calls onClose when Cancel button is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  test('calls onClose when X button is clicked', () => {
    renderModal();
    const heading = screen.getByRole('heading', { name: /Create Group/i });
    const closeBtn = heading.parentElement.querySelector('button');
    fireEvent.click(closeBtn);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 7. Quick Add toggle and pending invitations
// ---------------------------------------------------------------------------

describe('CreateGroupModal - Quick Add and Pending Invitations', () => {
  beforeEach(() => jest.clearAllMocks());

  test('shows QuickAddMembers panel when Quick Add button is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByText('Quick Add from Previous Groups'));
    expect(screen.getByTestId('quick-add-members')).toBeInTheDocument();
  });

  test('hides QuickAddMembers panel when Quick Add button is clicked again', () => {
    renderModal();
    fireEvent.click(screen.getByText('Quick Add from Previous Groups'));
    fireEvent.click(screen.getByText('Quick Add from Previous Groups'));
    expect(screen.queryByTestId('quick-add-members')).not.toBeInTheDocument();
  });

  test('shows pending invitation count after adding members via Quick Add', () => {
    renderModal();
    fireEvent.click(screen.getByText('Quick Add from Previous Groups'));
    fireEvent.click(screen.getByText('Add Bob'));
    expect(screen.getByText('1 member(s) will be invited')).toBeInTheDocument();
  });

  test('shows the invited member name in the pending list', () => {
    renderModal();
    fireEvent.click(screen.getByText('Quick Add from Previous Groups'));
    fireEvent.click(screen.getByText('Add Bob'));
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  test('removes a pending invitation when Remove is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByText('Quick Add from Previous Groups'));
    fireEvent.click(screen.getByText('Add Bob'));
    expect(screen.getByText('Bob')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Remove'));
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
  });

  test('sends bulk invitations when group is created with pending members', async () => {
    mockAddDoc.mockResolvedValue({ id: 'grp-2' });
    mockSendBulkInvitations.mockResolvedValue({ successful: ['u2'], failed: [] });
    renderModal();
    // Add a pending invitation
    fireEvent.click(screen.getByText('Quick Add from Previous Groups'));
    fireEvent.click(screen.getByText('Add Bob'));
    // Submit the form
    fireEvent.change(
      screen.getByPlaceholderText('e.g., Flat Mates, Paris Trip'),
      { target: { value: 'Group With Members' } }
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Group/i }));
    });
    await waitFor(() =>
      expect(mockSendBulkInvitations).toHaveBeenCalledWith(
        mockUser,
        ['u2'],
        'grp-2',
        'Group With Members'
      )
    );
  });
});

// ---------------------------------------------------------------------------
// 8. Error handling
// ---------------------------------------------------------------------------

describe('CreateGroupModal - Error Handling', () => {
  beforeEach(() => jest.clearAllMocks());

  test('shows error message when addDoc fails', async () => {
    mockAddDoc.mockRejectedValue(new Error('Firestore error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    renderModal();
    fireEvent.change(
      screen.getByPlaceholderText('e.g., Flat Mates, Paris Trip'),
      { target: { value: 'Test Group' } }
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Group/i }));
    });
    await waitFor(() =>
      expect(
        screen.getByText('Failed to create group. Please try again.')
      ).toBeInTheDocument()
    );
    consoleSpy.mockRestore();
  });

  test('does not call onClose when addDoc fails', async () => {
    mockAddDoc.mockRejectedValue(new Error('Firestore error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    renderModal();
    fireEvent.change(
      screen.getByPlaceholderText('e.g., Flat Mates, Paris Trip'),
      { target: { value: 'Test Group' } }
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create Group/i }));
    });
    await waitFor(() =>
      screen.getByText('Failed to create group. Please try again.')
    );
    expect(defaultProps.onClose).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
