// src/pages/Dashboard.test.jsx
// Test suite for Dashboard page - rendering, groups, navigation, modals, payment banner

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockSignOut = jest.fn();
jest.mock('firebase/auth', () => ({
  signOut: (...a) => mockSignOut(...a),
}));

const mockOnSnapshot = jest.fn();
const mockGetDoc     = jest.fn();
const mockUpdateDoc  = jest.fn();
const mockDoc        = jest.fn(() => 'mock-doc-ref');
const mockCollection = jest.fn();
const mockQuery      = jest.fn();
const mockWhere      = jest.fn();
const mockGetDocs = jest.fn();
const clearMocks = () => {
  jest.clearAllMocks();
  mockGetDocs.mockResolvedValue({ docs: [] });
};
jest.mock('firebase/firestore', () => ({
  collection:  (...a) => mockCollection(...a),
  query:       (...a) => mockQuery(...a),
  where:       (...a) => mockWhere(...a),
  onSnapshot:  (...a) => mockOnSnapshot(...a),
  getDoc:      (...a) => mockGetDoc(...a),
  getDocs:     (...a) => mockGetDocs(...a),
  updateDoc:   (...a) => mockUpdateDoc(...a),
  doc:         (...a) => mockDoc(...a),
}));

jest.mock('../services/firebase', () => ({ auth: {}, db: {} }));

const mockLogout = jest.fn();
const mockUser = {
  uid:         'user-123',
  email:       'alice@example.com',
  displayName: 'Alice',
};
jest.mock('../stores/authStore', () => ({
  useAuthStore: () => ({ user: mockUser, logout: mockLogout }),
}));

jest.mock('../stores/notificationsStore', () => ({
  useNotificationsStore: () => ({ unreadCount: 0, notifications: [] }),
}));

jest.mock('../components/NotificationsDropdown', () => () => null);

jest.mock('../utils/balanceCalculator', () => ({
  calculateBalances:     () => ({}),
  getUserBalanceSummary: () => ({ status: 'settled', amount: 0 }),
}));

// Mock child components to isolate Dashboard
jest.mock('../components/CreateGroupModal', () => ({ isOpen, onClose, onGroupCreated }) =>
  isOpen ? (
    <div data-testid="create-group-modal">
      <button onClick={onClose}>Close Modal</button>
      <button onClick={() => onGroupCreated('new-group-id')}>Create</button>
    </div>
  ) : null
);
jest.mock('../components/InvitationNotification', () => ({ onInvitationUpdate }) => (
  <div data-testid="invitation-notification">
    <button onClick={() => onInvitationUpdate(0)}>Clear</button>
    <button onClick={() => onInvitationUpdate(2)}>Set2</button>
  </div>
));
jest.mock('../components/OnboardingWizard', () => ({ open, onClose, onFinish }) =>
  open ? (
    <div data-testid="onboarding-wizard">
      <button onClick={onClose}>Close Onboarding</button>
      <button onClick={onFinish}>Finish</button>
    </div>
  ) : null
);

// ─── Import after mocks ───────────────────────────────────────────────────────
import Dashboard from './Dashboard';

// ─── Setup helpers ────────────────────────────────────────────────────────────

const setupEmptyGroups = () => {
  // onSnapshot called for groups + invitations — return empty for both
  mockOnSnapshot.mockImplementation((query, callback) => {
    if (typeof callback === 'function') callback({ docs: [] });
    return jest.fn();
  });
  mockGetDoc.mockResolvedValue({
    exists: () => true,
    data:   () => ({ isFirstLogin: false, paymentMethods: { paypalUsername: 'alice' } }),
  });
  mockGetDocs.mockResolvedValue({ docs: [] });
  mockUpdateDoc.mockResolvedValue();
};

const setupWithGroups = (groups = []) => {
  let callCount = 0;
  mockOnSnapshot.mockImplementation((query, callback) => {
    callCount++;
    if (typeof callback === 'function') {
      // First call = groups, second call = invitations
      if (callCount === 1) {
        callback({ docs: groups.map(g => ({ id: g.id, data: () => g })) });
      } else {
        callback({ docs: [] });
      }
    }
    return jest.fn();
  });
  mockGetDocs.mockResolvedValue({ docs: [] });
  mockGetDoc.mockResolvedValue({
    exists: () => true,
    data:   () => ({ isFirstLogin: false, paymentMethods: { paypalUsername: 'alice' } }),
  });
  mockUpdateDoc.mockResolvedValue();
};

const mockGroups = [
  { id: 'g1', name: 'Trip to Rome', currency: 'EUR', icon: 'plane', members: [{ userId: 'user-123' }, { userId: 'user-456' }], memberIds: ['user-123', 'user-456'] },
  { id: 'g2', name: 'House Bills',  currency: 'EUR', icon: 'home',  members: [{ userId: 'user-123' }], memberIds: ['user-123'] },
];

// ─────────────────────────────────────────────────────────────────────────────

describe('Dashboard - Rendering', () => {

  beforeEach(() => {
    clearMocks();
    setupEmptyGroups();
  });

  test('Renders SplitSync logo', async () => {
    render(<Dashboard />);
    expect(screen.getByAltText('Split-Sync')).toBeInTheDocument();
  });

  test('Renders user display name in header', async () => {
    render(<Dashboard />);
    await waitFor(() =>
      expect(screen.getByText('Alice')).toBeInTheDocument()
    );
  });

  test('Renders Your Groups heading', async () => {
    render(<Dashboard />);
    await waitFor(() =>
      expect(screen.getByText('Your groups')).toBeInTheDocument()
    );
  });

  test('Renders Create Group button', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText('+ Create group')).toBeInTheDocument());
  });

  test('Renders Logout button', async () => {
    render(<Dashboard />);
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  test('Shows welcome message with user name', async () => {
    render(<Dashboard />);
    await waitFor(() =>
      expect(screen.getByText(/Welcome.*Alice/)).toBeInTheDocument()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Dashboard - Loading & Empty states', () => {

  beforeEach(() => clearMocks());

  test('Shows loading spinner before groups load', () => {
    mockOnSnapshot.mockImplementation(() => jest.fn()); // never fires callback
    mockGetDoc.mockResolvedValue({ exists: () => false });
    render(<Dashboard />);
    expect(screen.getByText('Loading groups...')).toBeInTheDocument();
  });

  test('Shows empty state when no groups', async () => {
    setupEmptyGroups();
    render(<Dashboard />);
    await waitFor(() =>
      expect(screen.getByText('No groups yet')).toBeInTheDocument()
    );
  });

  test('Shows Create Your First Group button in empty state', async () => {
    setupEmptyGroups();
    render(<Dashboard />);
    await waitFor(() =>
      expect(screen.getByText('Create your first group')).toBeInTheDocument()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Dashboard - Groups list', () => {

  beforeEach(() => {
    clearMocks();
    setupWithGroups(mockGroups);
  });

  test('Renders group names', async () => {
    render(<Dashboard />);
    await waitFor(() =>
  expect(screen.getByText(/2 members/)).toBeInTheDocument()
  );
  expect(screen.getByText(/1 member/)).toBeInTheDocument();
  });

  test('Renders group member counts', async () => {
    render(<Dashboard />);
    await waitFor(() =>
      expect(screen.getByText(/2 members/)).toBeInTheDocument()
    );
    expect(screen.getByText(/1 member/)).toBeInTheDocument();
  });

  test('Renders group currencies', async () => {
    render(<Dashboard />);
    await waitFor(() =>
      expect(screen.getAllByText(/EUR/).length).toBeGreaterThan(0)
    );
  });

  test('Navigates to group page when group card is clicked', async () => {
    render(<Dashboard />);
    await waitFor(() => screen.getByText('Trip to Rome'));
    fireEvent.click(screen.getByText('Trip to Rome'));
    expect(mockNavigate).toHaveBeenCalledWith('/group/g1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Dashboard - Navigation', () => {

  beforeEach(() => {
    clearMocks();
    setupEmptyGroups();
    mockSignOut.mockResolvedValue();
  });

  test('Navigates to /settings when Settings icon is clicked', async () => {
    render(<Dashboard />);
    // Find the button containing the lucide-settings SVG
    const settingsBtn = screen.getAllByRole('button').find(b =>
      b.querySelector('.lucide-settings')
    );
    fireEvent.click(settingsBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });

  test('Calls signOut when Logout is clicked', async () => {
    render(<Dashboard />);
    fireEvent.click(screen.getByText('Logout'));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  });

  test('Calls logout store action after sign out', async () => {
    render(<Dashboard />);
    fireEvent.click(screen.getByText('Logout'));
    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
  });

  test('Navigates to /login after logout', async () => {
    render(<Dashboard />);
    fireEvent.click(screen.getByText('Logout'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Dashboard - Create Group modal', () => {

  beforeEach(() => {
    clearMocks();
    setupEmptyGroups();
  });

  test('Opens create group modal when Create Group is clicked', async () => {
    render(<Dashboard />);
    await waitFor(() => screen.getByText('+ Create group'));
    fireEvent.click(screen.getByText('+ Create group'));
    expect(screen.getByTestId('create-group-modal')).toBeInTheDocument();
  });

  test('Opens create group modal from empty state button', async () => {
    render(<Dashboard />);
    await waitFor(() => screen.getByText('Create your first group'));
fireEvent.click(screen.getByText('Create your first group'));
    expect(screen.getByTestId('create-group-modal')).toBeInTheDocument();
  });

  test('Closes create group modal when Close Modal is clicked', async () => {
    render(<Dashboard />);
    await waitFor(() => screen.getByText('+ Create group'));
    fireEvent.click(screen.getByText('+ Create group'));
    fireEvent.click(screen.getByText('Close Modal'));
    expect(screen.queryByTestId('create-group-modal')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Dashboard - Payment banner', () => {

  beforeEach(() => clearMocks());

  test('Shows payment banner when no payment method set', async () => {
    mockOnSnapshot.mockImplementation((query, callback) => {
      if (typeof callback === 'function') callback({ docs: [] });
      return jest.fn();
    });
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data:   () => ({ isFirstLogin: false, paymentMethods: {} }),
    });
    render(<Dashboard />);
    await waitFor(() =>
      expect(screen.getByText('Payment method not set')).toBeInTheDocument()
    );
  });

  test('Hides payment banner when payment method exists', async () => {
    setupEmptyGroups(); // has paypalUsername set
    render(<Dashboard />);
    await waitFor(() =>
      expect(screen.queryByText('Payment method not set')).not.toBeInTheDocument()
    );
  });

  test('Navigates to /profile when Set Up is clicked', async () => {
    mockOnSnapshot.mockImplementation((query, callback) => {
      if (typeof callback === 'function') callback({ docs: [] });
      return jest.fn();
    });
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data:   () => ({ isFirstLogin: false, paymentMethods: {} }),
    });
    render(<Dashboard />);
    await waitFor(() => screen.getByText('Set Up'));
    fireEvent.click(screen.getByText('Set Up'));
    expect(mockNavigate).toHaveBeenCalledWith('/profile');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Dashboard - Onboarding wizard', () => {

  beforeEach(() => clearMocks());

  test('Shows onboarding wizard on first login', async () => {
    mockOnSnapshot.mockImplementation((query, callback) => {
      if (typeof callback === 'function') callback({ docs: [] });
      return jest.fn();
    });
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data:   () => ({ isFirstLogin: true, paymentMethods: {} }),
    });
    mockUpdateDoc.mockResolvedValue();
    render(<Dashboard />);
    await waitFor(() =>
      expect(screen.getByTestId('onboarding-wizard')).toBeInTheDocument()
    );
  });

  test('Closes onboarding wizard when Close is clicked', async () => {
    mockOnSnapshot.mockImplementation((query, callback) => {
      if (typeof callback === 'function') callback({ docs: [] });
      return jest.fn();
    });
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data:   () => ({ isFirstLogin: true, paymentMethods: {} }),
    });
    mockUpdateDoc.mockResolvedValue();
    render(<Dashboard />);
    await waitFor(() => screen.getByTestId('onboarding-wizard'));
    fireEvent.click(screen.getByText('Close Onboarding'));
    expect(screen.queryByTestId('onboarding-wizard')).not.toBeInTheDocument();
  });
});