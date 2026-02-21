// src/pages/JoinGroup.test.jsx
// Test suite for JoinGroup page - group fetching, joining, error states, already member

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams:   () => ({ groupId: 'group-abc' }),
}));

const mockGetDoc    = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDoc       = jest.fn(() => 'mock-doc-ref');
const mockArrayUnion = jest.fn((...args) => args);
jest.mock('firebase/firestore', () => ({
  doc:        (...a) => mockDoc(...a),
  getDoc:     (...a) => mockGetDoc(...a),
  updateDoc:  (...a) => mockUpdateDoc(...a),
  arrayUnion: (...a) => mockArrayUnion(...a),
}));

jest.mock('../services/firebase', () => ({ db: {} }));

jest.mock('../stores/authStore', () => ({
  useAuthStore: () => ({
    user: {
      uid:         'user-123',
      email:       'alice@example.com',
      displayName: 'Alice',
    },
  }),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────
import JoinGroup from './JoinGroup';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockGroupData = (overrides = {}) => ({
  name:      'Trip to Rome',
  currency:  'EUR',
  createdBy: 'creator-1',
  memberIds: ['creator-1'],
  members:   [
    { userId: 'creator-1', name: 'Bob', email: 'bob@example.com', role: 'admin' },
  ],
  ...overrides,
});

const setupGroupDoc = (data, exists = true) => {
  mockGetDoc.mockResolvedValue({
    exists: () => exists,
    id:     'group-abc',
    data:   () => data,
  });
};

// ─────────────────────────────────────────────────────────────────────────────

describe('JoinGroup - Loading state', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Shows loading spinner while fetching group', () => {
    mockGetDoc.mockImplementation(() => new Promise(() => {})); // never resolves
    render(<JoinGroup />);
    expect(screen.getByText('Loading invitation...')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('JoinGroup - Error states', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Shows invalid invite when group does not exist', async () => {
    setupGroupDoc(null, false);
    render(<JoinGroup />);
    await waitFor(() =>
      expect(screen.getByText('Invalid Invite')).toBeInTheDocument()
    );
  });

  test('Shows correct error message when group not found', async () => {
    setupGroupDoc(null, false);
    render(<JoinGroup />);
    await waitFor(() =>
      expect(screen.getByText('Group not found. The invite link may be invalid.')).toBeInTheDocument()
    );
  });

  test('Shows Go to Dashboard button on invalid invite', async () => {
    setupGroupDoc(null, false);
    render(<JoinGroup />);
    await waitFor(() =>
      expect(screen.getByText('Go to Dashboard')).toBeInTheDocument()
    );
  });

  test('Navigates to /dashboard from invalid invite screen', async () => {
    setupGroupDoc(null, false);
    render(<JoinGroup />);
    await waitFor(() => screen.getByText('Go to Dashboard'));
    fireEvent.click(screen.getByText('Go to Dashboard'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  test('Shows error when getDoc throws', async () => {
    mockGetDoc.mockRejectedValue(new Error('network error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<JoinGroup />);
    await waitFor(() =>
      expect(screen.getByText('Failed to load group. Please try again.')).toBeInTheDocument()
    );
    consoleSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('JoinGroup - Already a member', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Shows Already a Member screen when user is already in group', async () => {
    setupGroupDoc(mockGroupData({ memberIds: ['user-123', 'creator-1'] }));
    render(<JoinGroup />);
    await waitFor(() =>
      expect(screen.getByText('Already a Member')).toBeInTheDocument()
    );
  });

  test('Shows group name on already member screen', async () => {
    setupGroupDoc(mockGroupData({ memberIds: ['user-123', 'creator-1'] }));
    render(<JoinGroup />);
    await waitFor(() =>
      expect(screen.getByText(/Trip to Rome/)).toBeInTheDocument()
    );
  });

  test('Shows View Group button when already a member', async () => {
    setupGroupDoc(mockGroupData({ memberIds: ['user-123', 'creator-1'] }));
    render(<JoinGroup />);
    await waitFor(() =>
      expect(screen.getByText('View Group')).toBeInTheDocument()
    );
  });

  test('Navigates to group page from already member screen', async () => {
    setupGroupDoc(mockGroupData({ memberIds: ['user-123', 'creator-1'] }));
    render(<JoinGroup />);
    await waitFor(() => screen.getByText('View Group'));
    fireEvent.click(screen.getByText('View Group'));
    expect(mockNavigate).toHaveBeenCalledWith('/group/group-abc');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('JoinGroup - Join invitation screen', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupGroupDoc(mockGroupData());
  });

  test('Shows group name on invitation screen', async () => {
    render(<JoinGroup />);
    await waitFor(() =>
      expect(screen.getAllByText('Trip to Rome').length).toBeGreaterThan(0)
    );
  });

  test("Shows inviter's name in heading when inviter found", async () => {
    render(<JoinGroup />);
    await waitFor(() =>
      expect(screen.getByText("You're Invited!")).toBeInTheDocument()
    );
  });

  test('Shows inviter name in description', async () => {
    render(<JoinGroup />);
    await waitFor(() =>
      expect(screen.getByText('Bob invited you to join')).toBeInTheDocument()
    );
  });

  test('Shows member count', async () => {
    render(<JoinGroup />);
    await waitFor(() =>
      expect(screen.getByText('1 member')).toBeInTheDocument()
    );
  });

  test('Shows plural members when more than one', async () => {
    setupGroupDoc(mockGroupData({
      memberIds: ['creator-1', 'other-user'],
      members: [
        { userId: 'creator-1', name: 'Bob', email: 'bob@example.com' },
        { userId: 'other-user', name: 'Carol', email: 'carol@example.com' },
      ],
    }));
    render(<JoinGroup />);
    await waitFor(() =>
      expect(screen.getByText('2 members')).toBeInTheDocument()
    );
  });

  test('Shows currency', async () => {
    render(<JoinGroup />);
    await waitFor(() =>
      expect(screen.getByText('EUR')).toBeInTheDocument()
    );
  });

  test('Shows Track Expenses feature', async () => {
    render(<JoinGroup />);
    await waitFor(() =>
      expect(screen.getByText('Track Expenses')).toBeInTheDocument()
    );
  });

  test('Shows See Balances feature', async () => {
    render(<JoinGroup />);
    await waitFor(() =>
      expect(screen.getByText('See Balances')).toBeInTheDocument()
    );
  });

  test('Shows Settle Up feature', async () => {
    render(<JoinGroup />);
    await waitFor(() =>
      expect(screen.getByText('Settle Up')).toBeInTheDocument()
    );
  });

  test('Shows Join button with group name', async () => {
    render(<JoinGroup />);
    await waitFor(() =>
      expect(screen.getByText('Join Trip to Rome')).toBeInTheDocument()
    );
  });

  test('Shows Cancel button', async () => {
    render(<JoinGroup />);
    await waitFor(() =>
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    );
  });

  test('Navigates to /dashboard when Cancel is clicked', async () => {
    render(<JoinGroup />);
    await waitFor(() => screen.getByText('Cancel'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('JoinGroup - Joining a group', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    setupGroupDoc(mockGroupData());
    mockUpdateDoc.mockResolvedValue();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('Calls updateDoc when Join button is clicked', async () => {
    render(<JoinGroup />);
    await waitFor(() => screen.getByText('Join Trip to Rome'));
    fireEvent.click(screen.getByText('Join Trip to Rome'));
    await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
  });

  test('Shows joining spinner after clicking join', async () => {
    mockUpdateDoc.mockImplementation(() => new Promise(() => {}));
    render(<JoinGroup />);
    await waitFor(() => screen.getByText('Join Trip to Rome'));
    fireEvent.click(screen.getByText('Join Trip to Rome'));
    await waitFor(() =>
      expect(screen.getByText('Joining group...')).toBeInTheDocument()
    );
  });

  test('Shows error when updateDoc fails', async () => {
    mockUpdateDoc.mockRejectedValue(new Error('permission denied'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<JoinGroup />);
    await waitFor(() => screen.getByText('Join Trip to Rome'));
    fireEvent.click(screen.getByText('Join Trip to Rome'));
    await waitFor(() =>
      expect(screen.getByText('Failed to join group. Please try again.')).toBeInTheDocument()
    );
    consoleSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('JoinGroup - No inviter name fallback', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  test('Shows Join Group heading when no inviter found', async () => {
    setupGroupDoc(mockGroupData({ createdBy: 'unknown-id', members: [] }));
    render(<JoinGroup />);
    await waitFor(() =>
      expect(screen.getByText('Join Group')).toBeInTheDocument()
    );
  });

  test("Shows generic invited message when no inviter found", async () => {
    setupGroupDoc(mockGroupData({ createdBy: 'unknown-id', members: [] }));
    render(<JoinGroup />);
    await waitFor(() =>
      expect(screen.getByText("You've been invited to join")).toBeInTheDocument()
    );
  });
});