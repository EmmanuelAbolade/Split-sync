// src/components/QuickAddMembers.test.jsx
// Tests for QuickAddMembers - loading state, empty state, connection list,
// selection, search, select/deselect all, add members, show more/less

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetConnections = jest.fn();
const mockSyncMyConnectionsFromGroups = jest.fn();

jest.mock('../utils/userConnectionsManager', () => ({
  getConnections:               (...args) => mockGetConnections(...args),
  syncMyConnectionsFromGroups:  (...args) => mockSyncMyConnectionsFromGroups(...args),
}));

import QuickAddMembers from './QuickAddMembers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockUser = { uid: 'user-123' };
const mockOnAddMembers = jest.fn();

const makeConnections = (count) =>
  Array.from({ length: count }, (_, i) => ({
    userId:      `uid-${i}`,
    name:        `User ${i}`,
    email:       `user${i}@example.com`,
    photoURL:    null,
    sharedGroups: [{ groupName: `Group ${i}` }],
  }));

beforeEach(() => {
  jest.clearAllMocks();
  mockSyncMyConnectionsFromGroups.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// 1. Loading state
// ---------------------------------------------------------------------------

describe('QuickAddMembers - Loading', () => {

  test('Shows loading indicator while fetching connections', async () => {
    // Never resolves during this test
    mockGetConnections.mockReturnValue(new Promise(() => {}));
    render(
      <QuickAddMembers
        currentUser={mockUser}
        onAddMembers={mockOnAddMembers}
      />
    );
    expect(screen.getByText('Loading your connections...')).toBeInTheDocument();
  });

  test('Does not fetch when currentUser is null', async () => {
    render(
      <QuickAddMembers
        currentUser={null}
        onAddMembers={mockOnAddMembers}
      />
    );
    expect(mockGetConnections).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. Empty state
// ---------------------------------------------------------------------------

describe('QuickAddMembers - Empty state', () => {

  test('Shows no previous collaborators message when empty', async () => {
    mockGetConnections.mockResolvedValue([]);
    await act(async () => {
      render(
        <QuickAddMembers
          currentUser={mockUser}
          onAddMembers={mockOnAddMembers}
        />
      );
    });
    await waitFor(() =>
      expect(screen.getByText('No Previous Collaborators')).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Connection list rendering
// ---------------------------------------------------------------------------

describe('QuickAddMembers - Connection list', () => {

  test('Renders connections after loading', async () => {
    mockGetConnections.mockResolvedValue(makeConnections(2));
    await act(async () => {
      render(
        <QuickAddMembers
          currentUser={mockUser}
          onAddMembers={mockOnAddMembers}
        />
      );
    });
    await waitFor(() =>
      expect(screen.getByText('User 0')).toBeInTheDocument()
    );
    expect(screen.getByText('User 1')).toBeInTheDocument();
  });

  test('Shows connection email', async () => {
    mockGetConnections.mockResolvedValue(makeConnections(1));
    await act(async () => {
      render(
        <QuickAddMembers
          currentUser={mockUser}
          onAddMembers={mockOnAddMembers}
        />
      );
    });
    await waitFor(() =>
      expect(screen.getByText('user0@example.com')).toBeInTheDocument()
    );
  });

  test('Shows available count badge', async () => {
    mockGetConnections.mockResolvedValue(makeConnections(3));
    await act(async () => {
      render(
        <QuickAddMembers
          currentUser={mockUser}
          onAddMembers={mockOnAddMembers}
        />
      );
    });
    await waitFor(() =>
      expect(screen.getByText('3 available')).toBeInTheDocument()
    );
  });

  test('Shows shared group tags', async () => {
    mockGetConnections.mockResolvedValue(makeConnections(1));
    await act(async () => {
      render(
        <QuickAddMembers
          currentUser={mockUser}
          onAddMembers={mockOnAddMembers}
        />
      );
    });
    await waitFor(() =>
      expect(screen.getByText('Group 0')).toBeInTheDocument()
    );
  });

  test('Filters out excluded user IDs', async () => {
    mockGetConnections.mockResolvedValue(makeConnections(3));
    await act(async () => {
      render(
        <QuickAddMembers
          currentUser={mockUser}
          onAddMembers={mockOnAddMembers}
          excludeUserIds={['uid-0', 'uid-1']}
        />
      );
    });
    await waitFor(() =>
      expect(screen.getByText('User 2')).toBeInTheDocument()
    );
    expect(screen.queryByText('User 0')).not.toBeInTheDocument();
    expect(screen.queryByText('User 1')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 4. Selection
// ---------------------------------------------------------------------------

describe('QuickAddMembers - Selection', () => {

  test('Selects a connection when clicked', async () => {
    mockGetConnections.mockResolvedValue(makeConnections(2));
    await act(async () => {
      render(
        <QuickAddMembers
          currentUser={mockUser}
          onAddMembers={mockOnAddMembers}
        />
      );
    });
    await waitFor(() => screen.getByText('User 0'));
    fireEvent.click(screen.getByText('User 0').closest('button'));
    expect(screen.getByText('Send Invitations (1)')).toBeInTheDocument();
  });

  test('Deselects a connection when clicked again', async () => {
    mockGetConnections.mockResolvedValue(makeConnections(2));
    await act(async () => {
      render(
        <QuickAddMembers
          currentUser={mockUser}
          onAddMembers={mockOnAddMembers}
        />
      );
    });
    await waitFor(() => screen.getByText('User 0'));
    fireEvent.click(screen.getByText('User 0').closest('button'));
    fireEvent.click(screen.getByText('User 0').closest('button'));
    expect(screen.queryByText('Send Invitations (1)')).not.toBeInTheDocument();
  });

  test('Select All selects all visible connections', async () => {
    mockGetConnections.mockResolvedValue(makeConnections(2));
    await act(async () => {
      render(
        <QuickAddMembers
          currentUser={mockUser}
          onAddMembers={mockOnAddMembers}
        />
      );
    });
    await waitFor(() => screen.getByText('Select All'));
    fireEvent.click(screen.getByText('Select All'));
    expect(screen.getByText('Send Invitations (2)')).toBeInTheDocument();
  });

  test('Deselect All clears selection', async () => {
    mockGetConnections.mockResolvedValue(makeConnections(2));
    await act(async () => {
      render(
        <QuickAddMembers
          currentUser={mockUser}
          onAddMembers={mockOnAddMembers}
        />
      );
    });
    await waitFor(() => screen.getByText('Select All'));
    fireEvent.click(screen.getByText('Select All'));
    fireEvent.click(screen.getByText('Deselect All'));
    expect(screen.queryByText(/Send Invitations/)).not.toBeInTheDocument();
  });

  test('Calls onAddMembers with selected connections', async () => {
    const connections = makeConnections(2);
    mockGetConnections.mockResolvedValue(connections);
    await act(async () => {
      render(
        <QuickAddMembers
          currentUser={mockUser}
          onAddMembers={mockOnAddMembers}
        />
      );
    });
    await waitFor(() => screen.getByText('User 0'));
    fireEvent.click(screen.getByText('User 0').closest('button'));
    fireEvent.click(screen.getByText('Send Invitations (1)'));
    expect(mockOnAddMembers).toHaveBeenCalledWith([connections[0]]);
  });

  test('Clears selection after adding members', async () => {
    mockGetConnections.mockResolvedValue(makeConnections(2));
    await act(async () => {
      render(
        <QuickAddMembers
          currentUser={mockUser}
          onAddMembers={mockOnAddMembers}
        />
      );
    });
    await waitFor(() => screen.getByText('User 0'));
    fireEvent.click(screen.getByText('User 0').closest('button'));
    fireEvent.click(screen.getByText('Send Invitations (1)'));
    expect(screen.queryByText(/Send Invitations/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 5. Search
// ---------------------------------------------------------------------------

describe('QuickAddMembers - Search', () => {

  test('Shows search box when more than 3 connections', async () => {
    mockGetConnections.mockResolvedValue(makeConnections(4));
    await act(async () => {
      render(
        <QuickAddMembers
          currentUser={mockUser}
          onAddMembers={mockOnAddMembers}
        />
      );
    });
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Search connections...')).toBeInTheDocument()
    );
  });

  test('Does not show search box with 3 or fewer connections', async () => {
    mockGetConnections.mockResolvedValue(makeConnections(3));
    await act(async () => {
      render(
        <QuickAddMembers
          currentUser={mockUser}
          onAddMembers={mockOnAddMembers}
        />
      );
    });
    await waitFor(() => screen.getByText('User 0'));
    expect(screen.queryByPlaceholderText('Search connections...')).not.toBeInTheDocument();
  });

  test('Filters connections by name search term', async () => {
    const connections = [
      { userId: 'uid-alice', name: 'Alice Smith', email: 'alice@example.com', photoURL: null, sharedGroups: [] },
      { userId: 'uid-bob',   name: 'Bob Jones',   email: 'bob@example.com',   photoURL: null, sharedGroups: [] },
      { userId: 'uid-carol', name: 'Carol White', email: 'carol@example.com', photoURL: null, sharedGroups: [] },
      { userId: 'uid-dave',  name: 'Dave Brown',  email: 'dave@example.com',  photoURL: null, sharedGroups: [] },
    ];
    mockGetConnections.mockResolvedValue(connections);
    await act(async () => {
      render(
        <QuickAddMembers
          currentUser={mockUser}
          onAddMembers={mockOnAddMembers}
        />
      );
    });
    await waitFor(() => screen.getByPlaceholderText('Search connections...'));
    fireEvent.change(screen.getByPlaceholderText('Search connections...'), {
      target: { value: 'Alice' },
    });
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 6. Show more / less
// ---------------------------------------------------------------------------

describe('QuickAddMembers - Show more', () => {

  test('Shows Show All button when more than 5 connections', async () => {
    mockGetConnections.mockResolvedValue(makeConnections(6));
    await act(async () => {
      render(
        <QuickAddMembers
          currentUser={mockUser}
          onAddMembers={mockOnAddMembers}
        />
      );
    });
    await waitFor(() =>
      expect(screen.getByText('Show All (6)')).toBeInTheDocument()
    );
  });

  test('Clicking Show All reveals all connections', async () => {
    mockGetConnections.mockResolvedValue(makeConnections(6));
    await act(async () => {
      render(
        <QuickAddMembers
          currentUser={mockUser}
          onAddMembers={mockOnAddMembers}
        />
      );
    });
    await waitFor(() => screen.getByText('Show All (6)'));
    fireEvent.click(screen.getByText('Show All (6)'));
    expect(screen.getByText('User 5')).toBeInTheDocument();
  });

  test('Clicking Show Less hides extra connections', async () => {
    mockGetConnections.mockResolvedValue(makeConnections(6));
    await act(async () => {
      render(
        <QuickAddMembers
          currentUser={mockUser}
          onAddMembers={mockOnAddMembers}
        />
      );
    });
    await waitFor(() => screen.getByText('Show All (6)'));
    fireEvent.click(screen.getByText('Show All (6)'));
    fireEvent.click(screen.getByText('Show Less'));
    expect(screen.queryByText('User 5')).not.toBeInTheDocument();
  });
});
