// src/components/InvitationNotification.test.jsx
// Test suite for InvitationNotification component - group invitation display and actions

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import InvitationNotification from './InvitationNotification';

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockGetMyInvitations = jest.fn();
const mockAcceptInvitation  = jest.fn();
const mockDeclineInvitation = jest.fn();

jest.mock('../utils/invitationSystem', () => ({
  getMyInvitations:  (...args) => mockGetMyInvitations(...args),
  acceptInvitation:  (...args) => mockAcceptInvitation(...args),
  declineInvitation: (...args) => mockDeclineInvitation(...args),
}));

// ─── Shared fixtures ──────────────────────────────────────────────────────────
const mockUser = { uid: 'user-123' };

const mockInvitation = {
  id: 'inv-001',
  groupId: 'group-abc',
  groupName: 'Weekend Trip',
  fromUserName: 'Alice Smith',
  fromUserPhoto: null,
  createdAt: { toMillis: () => Date.now() - 300000 }, // 5 mins ago
};

const mockInvitationWithPhoto = {
  ...mockInvitation,
  id: 'inv-002',
  fromUserPhoto: 'https://example.com/photo.jpg',
};

// ─────────────────────────────────────────────────────────────────────────────

describe('InvitationNotification - Returns null states', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Returns null while loading (no user)', () => {
    mockGetMyInvitations.mockResolvedValue([]);
    const { container } = render(<InvitationNotification user={null} />);
    expect(container.firstChild).toBeNull();
  });

  test('Returns null when there are no invitations', async () => {
    mockGetMyInvitations.mockResolvedValue([]);
    const { container } = render(<InvitationNotification user={mockUser} />);
    await waitFor(() => expect(mockGetMyInvitations).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('InvitationNotification - Rendering with invitations', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMyInvitations.mockResolvedValue([mockInvitation]);
  });

  test('Shows header "Group Invitations" when invitations exist', async () => {
    render(<InvitationNotification user={mockUser} />);
    await waitFor(() => expect(screen.getByText('Group Invitations')).toBeInTheDocument());
  });

  test('Shows pending count in header', async () => {
    render(<InvitationNotification user={mockUser} />);
    await waitFor(() => expect(screen.getByText('1 pending')).toBeInTheDocument());
  });

  test('Shows count badge', async () => {
    render(<InvitationNotification user={mockUser} />);
    await waitFor(() => {
      const badges = screen.getAllByText('1');
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  test('Shows sender name', async () => {
    render(<InvitationNotification user={mockUser} />);
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
  });

  test('Shows group name', async () => {
    render(<InvitationNotification user={mockUser} />);
    await waitFor(() => expect(screen.getByText('Weekend Trip')).toBeInTheDocument());
  });

  test('Shows "invited you to join" text', async () => {
    render(<InvitationNotification user={mockUser} />);
    await waitFor(() => expect(screen.getByText('invited you to join')).toBeInTheDocument());
  });

  test('Shows Accept button', async () => {
    render(<InvitationNotification user={mockUser} />);
    await waitFor(() => expect(screen.getByText('Accept')).toBeInTheDocument());
  });

  test('Shows Decline button', async () => {
    render(<InvitationNotification user={mockUser} />);
    await waitFor(() => expect(screen.getByText('Decline')).toBeInTheDocument());
  });

  test('Shows Bell icon in header', async () => {
    const { container } = render(<InvitationNotification user={mockUser} />);
    await waitFor(() => {
      const bellIcon = container.querySelector('.lucide-bell');
      expect(bellIcon).toBeInTheDocument();
    });
  });

  test('Shows Users icon next to group name', async () => {
    const { container } = render(<InvitationNotification user={mockUser} />);
    await waitFor(() => {
      const usersIcon = container.querySelector('.lucide-users');
      expect(usersIcon).toBeInTheDocument();
    });
  });

  test('Shows Clock icon for timestamp', async () => {
    const { container } = render(<InvitationNotification user={mockUser} />);
    await waitFor(() => {
      const clockIcon = container.querySelector('.lucide-clock');
      expect(clockIcon).toBeInTheDocument();
    });
  });

  test('Shows time ago text', async () => {
    render(<InvitationNotification user={mockUser} />);
    await waitFor(() => expect(screen.getByText('5m ago')).toBeInTheDocument());
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('InvitationNotification - Avatar rendering', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Shows initials avatar when no photo', async () => {
    mockGetMyInvitations.mockResolvedValue([mockInvitation]);
    render(<InvitationNotification user={mockUser} />);
    await waitFor(() => expect(screen.getByText('A')).toBeInTheDocument());
  });

  test('Shows img element when photo URL is provided', async () => {
    mockGetMyInvitations.mockResolvedValue([mockInvitationWithPhoto]);
    const { container } = render(<InvitationNotification user={mockUser} />);
    await waitFor(() => {
      const img = container.querySelector('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('InvitationNotification - Accept action', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMyInvitations.mockResolvedValue([mockInvitation]);
    global.alert = jest.fn();
  });

  test('Calls acceptInvitation with correct args on Accept click', async () => {
    mockAcceptInvitation.mockResolvedValue({ success: true, groupId: 'group-abc' });
    render(<InvitationNotification user={mockUser} />);

    await waitFor(() => screen.getByText('Accept'));
    await act(async () => fireEvent.click(screen.getByText('Accept')));

    expect(mockAcceptInvitation).toHaveBeenCalledWith('inv-001', 'user-123');
  });

  test('Navigates to group on successful accept', async () => {
    mockAcceptInvitation.mockResolvedValue({ success: true, groupId: 'group-abc' });
    render(<InvitationNotification user={mockUser} />);

    await waitFor(() => screen.getByText('Accept'));
    await act(async () => fireEvent.click(screen.getByText('Accept')));

    expect(mockNavigate).toHaveBeenCalledWith('/groups/group-abc');
  });

  test('Shows alert on successful accept', async () => {
    mockAcceptInvitation.mockResolvedValue({ success: true, groupId: 'group-abc' });
    render(<InvitationNotification user={mockUser} />);

    await waitFor(() => screen.getByText('Accept'));
    await act(async () => fireEvent.click(screen.getByText('Accept')));

    expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Weekend Trip'));
  });

  test('Shows alert on failed accept', async () => {
    mockAcceptInvitation.mockResolvedValue({ success: false, message: 'Already a member' });
    render(<InvitationNotification user={mockUser} />);

    await waitFor(() => screen.getByText('Accept'));
    await act(async () => fireEvent.click(screen.getByText('Accept')));

    expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Already a member'));
  });

  test('Shows alert on accept error', async () => {
    mockAcceptInvitation.mockRejectedValue(new Error('Network error'));
    render(<InvitationNotification user={mockUser} />);

    await waitFor(() => screen.getByText('Accept'));
    await act(async () => fireEvent.click(screen.getByText('Accept')));

    expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Failed to accept'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('InvitationNotification - Decline action', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMyInvitations.mockResolvedValue([mockInvitation]);
    global.alert = jest.fn();
  });

  test('Calls declineInvitation with correct args on Decline click', async () => {
    mockDeclineInvitation.mockResolvedValue({ success: true });
    render(<InvitationNotification user={mockUser} />);

    await waitFor(() => screen.getByText('Decline'));
    await act(async () => fireEvent.click(screen.getByText('Decline')));

    expect(mockDeclineInvitation).toHaveBeenCalledWith('inv-001', 'user-123');
  });

  test('Removes invitation from list on successful decline', async () => {
    mockDeclineInvitation.mockResolvedValue({ success: true });
    const { container } = render(<InvitationNotification user={mockUser} />);

    await waitFor(() => screen.getByText('Decline'));
    await act(async () => fireEvent.click(screen.getByText('Decline')));

    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  test('Shows alert on failed decline', async () => {
    mockDeclineInvitation.mockResolvedValue({ success: false, message: 'Not found' });
    render(<InvitationNotification user={mockUser} />);

    await waitFor(() => screen.getByText('Decline'));
    await act(async () => fireEvent.click(screen.getByText('Decline')));

    expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Not found'));
  });

  test('Shows alert on decline error', async () => {
    mockDeclineInvitation.mockRejectedValue(new Error('Network error'));
    render(<InvitationNotification user={mockUser} />);

    await waitFor(() => screen.getByText('Decline'));
    await act(async () => fireEvent.click(screen.getByText('Decline')));

    expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Failed to decline'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('InvitationNotification - onInvitationUpdate callback', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Calls onInvitationUpdate with invitation count on load', async () => {
    mockGetMyInvitations.mockResolvedValue([mockInvitation]);
    const mockCallback = jest.fn();

    render(<InvitationNotification user={mockUser} onInvitationUpdate={mockCallback} />);

    await waitFor(() => expect(mockCallback).toHaveBeenCalledWith(1));
  });

  test('Calls onInvitationUpdate with 0 when no invitations', async () => {
    mockGetMyInvitations.mockResolvedValue([]);
    const mockCallback = jest.fn();

    render(<InvitationNotification user={mockUser} onInvitationUpdate={mockCallback} />);

    await waitFor(() => expect(mockCallback).toHaveBeenCalledWith(0));
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('InvitationNotification - getTimeAgo formatting', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Shows "Just now" for very recent invitation', async () => {
    mockGetMyInvitations.mockResolvedValue([{
      ...mockInvitation,
      createdAt: { toMillis: () => Date.now() - 30000 }, // 30 seconds ago
    }]);

    render(<InvitationNotification user={mockUser} />);
    await waitFor(() => expect(screen.getByText('Just now')).toBeInTheDocument());
  });

  test('Shows hours ago for older invitation', async () => {
    mockGetMyInvitations.mockResolvedValue([{
      ...mockInvitation,
      createdAt: { toMillis: () => Date.now() - 7200000 }, // 2 hours ago
    }]);

    render(<InvitationNotification user={mockUser} />);
    await waitFor(() => expect(screen.getByText('2h ago')).toBeInTheDocument());
  });

  test('Shows days ago for invitation from yesterday', async () => {
    mockGetMyInvitations.mockResolvedValue([{
      ...mockInvitation,
      createdAt: { toMillis: () => Date.now() - 172800000 }, // 2 days ago - safely past 24h threshold
    }]);

    render(<InvitationNotification user={mockUser} />);
    await waitFor(() => expect(screen.getByText('2d ago')).toBeInTheDocument());
  });

  test('Shows weeks ago for old invitation', async () => {
    mockGetMyInvitations.mockResolvedValue([{
      ...mockInvitation,
      createdAt: { toMillis: () => Date.now() - 691200000 }, // 8 days ago - safely past 7d threshold
    }]);

    render(<InvitationNotification user={mockUser} />);
    await waitFor(() => expect(screen.getByText('1w ago')).toBeInTheDocument());
  });

  test('Shows "Just now" when createdAt is null', async () => {
    mockGetMyInvitations.mockResolvedValue([{
      ...mockInvitation,
      createdAt: null,
    }]);

    render(<InvitationNotification user={mockUser} />);
    await waitFor(() => expect(screen.getByText('Just now')).toBeInTheDocument());
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('InvitationNotification - Multiple invitations', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Renders multiple invitations', async () => {
    const inv2 = { ...mockInvitation, id: 'inv-002', groupName: 'Book Club', fromUserName: 'Bob Jones' };
    mockGetMyInvitations.mockResolvedValue([mockInvitation, inv2]);

    render(<InvitationNotification user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText('Weekend Trip')).toBeInTheDocument();
      expect(screen.getByText('Book Club')).toBeInTheDocument();
    });
  });

  test('Shows correct pending count for multiple invitations', async () => {
    const inv2 = { ...mockInvitation, id: 'inv-002', groupName: 'Book Club', fromUserName: 'Bob Jones' };
    mockGetMyInvitations.mockResolvedValue([mockInvitation, inv2]);

    render(<InvitationNotification user={mockUser} />);
    await waitFor(() => expect(screen.getByText('2 pending')).toBeInTheDocument());
  });
});