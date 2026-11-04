// src/pages/Analytics.test.jsx
// Test suite for Analytics page
// Covers: loading state, empty state, summary cards, chart sections,
//         navigation, and derived data rendering with expenses present.

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

jest.mock('../services/firebase', () => ({ db: {} }));

const mockGetDocs     = jest.fn();
const mockCollection  = jest.fn();
const mockQuery       = jest.fn();
const mockWhere       = jest.fn();
const mockDoc         = jest.fn();
const mockGetDoc      = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: (...a) => mockCollection(...a),
  query:      (...a) => mockQuery(...a),
  where:      (...a) => mockWhere(...a),
  getDocs:    (...a) => mockGetDocs(...a),
  doc:        (...a) => mockDoc(...a),
  getDoc:     (...a) => mockGetDoc(...a),
}));

const mockUser = {
  uid:         'user-001',
  email:       'alice@example.com',
  displayName: 'Alice',
};

jest.mock('../stores/authStore', () => ({
  useAuthStore: (selector) => {
    const store = { user: mockUser };
    return selector ? selector(store) : store;
  },
}));

const mockCalculateBalances    = jest.fn(() => ({}));
const mockCalculateSettlements = jest.fn(() => []);

jest.mock('../utils/balanceCalculator', () => ({
  calculateBalances:    (...a) => mockCalculateBalances(...a),
  calculateSettlements: (...a) => mockCalculateSettlements(...a),
}));

// Mock Recharts — rendering SVG charts in jsdom causes errors
jest.mock('recharts', () => {
  const React = require('react');
  const mockComponent = ({ children, ...props }) =>
    React.createElement('div', { 'data-testid': 'recharts-mock', ...props }, children);
  return {
    AreaChart:         mockComponent,
    Area:              mockComponent,
    BarChart:          mockComponent,
    Bar:               mockComponent,
    PieChart:          mockComponent,
    Pie:               mockComponent,
    Cell:              mockComponent,
    XAxis:             mockComponent,
    YAxis:             mockComponent,
    CartesianGrid:     mockComponent,
    Tooltip:           mockComponent,
    Legend:            mockComponent,
    ResponsiveContainer: ({ children }) =>
      React.createElement('div', { 'data-testid': 'recharts-container' }, children),
  };
});

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import Analytics from './Analytics';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Returns an empty Firestore-like snapshot
const emptySnap = () => ({ docs: [] });

// Returns a snapshot with group documents
const groupSnap = (groups) => ({
  docs: groups.map(g => ({ id: g.id, data: () => g })),
});

// Returns a snapshot with expense documents
const expenseSnap = (expenses) => ({
  docs: expenses.map(e => ({ id: e.id, data: () => e })),
});

// Builds a mock expense with sensible defaults
const makeExpense = (overrides = {}) => ({
  id:        'exp-1',
  groupId:   'grp-1',
  amount:    50,
  category:  'food',
  paidBy:    'user-001',
  createdAt: new Date('2025-03-01').toISOString(),
  ...overrides,
});

// Setup: no groups, no expenses — shows empty state after loading
const setupEmpty = () => {
  mockGetDocs.mockResolvedValue(emptySnap());
};

// Setup: one group, one expense — shows full dashboard
const setupWithData = (expenses = [makeExpense()]) => {
  const group = {
    id: 'grp-1', name: 'House', memberIds: ['user-001'],
    members: [{ userId: 'user-001', name: 'Alice', email: 'alice@example.com' }],
  };
  mockGetDocs
    .mockResolvedValueOnce(groupSnap([group]))   // groups query
    .mockResolvedValueOnce(expenseSnap(expenses)); // expenses query
};

// ---------------------------------------------------------------------------
// 1. Loading state
// ---------------------------------------------------------------------------

describe('Analytics - Loading State', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    // Restore implementations cleared by clearAllMocks
    mockCalculateBalances.mockReturnValue({});
    mockCalculateSettlements.mockReturnValue([]);
  });

  test('Shows loading spinner while data is being fetched', () => {
    // getDocs never resolves — stays in loading state
    mockGetDocs.mockReturnValue(new Promise(() => {}));
    render(<Analytics />);
    expect(screen.getByText('Loading analytics...')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Empty state
// ---------------------------------------------------------------------------

describe('Analytics - Empty State', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    // Restore implementations cleared by clearAllMocks
    mockCalculateBalances.mockReturnValue({});
    mockCalculateSettlements.mockReturnValue([]);
  });

  test('Shows No data yet heading when no expenses exist', async () => {
    setupEmpty();
    render(<Analytics />);
    await waitFor(() =>
      expect(screen.getByText('No data yet')).toBeInTheDocument()
    );
  });

  test('Shows descriptive message in empty state', async () => {
    setupEmpty();
    render(<Analytics />);
    await waitFor(() =>
      expect(screen.getByText(/Add expenses to your groups/)).toBeInTheDocument()
    );
  });

  test('Shows Go to Dashboard button in empty state', async () => {
    setupEmpty();
    render(<Analytics />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Go to Dashboard' })).toBeInTheDocument()
    );
  });

  test('Navigates to /dashboard when Go to Dashboard is clicked', async () => {
    setupEmpty();
    render(<Analytics />);
    await waitFor(() => screen.getByRole('button', { name: 'Go to Dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Go to Dashboard' }));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});

// ---------------------------------------------------------------------------
// Shared render helper — wraps in act so async state updates flush before assertions
// ---------------------------------------------------------------------------

const renderAndWait = async (component) => {
  let result;
  await act(async () => {
    result = render(component);
  });
  return result;
};

// ---------------------------------------------------------------------------
// 3. Header
// ---------------------------------------------------------------------------

describe('Analytics - Header', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    // Restore implementations cleared by clearAllMocks
    mockCalculateBalances.mockReturnValue({});
    mockCalculateSettlements.mockReturnValue([]);
  });

  test('Renders Analytics heading when data is present', async () => {
    setupWithData();
    await renderAndWait(<Analytics />);
    await waitFor(() =>
      expect(screen.getByText('Analytics')).toBeInTheDocument()
    );
  });

  test('Renders subtitle text', async () => {
    setupWithData();
    await renderAndWait(<Analytics />);
    await waitFor(() =>
      expect(screen.getByText('Spending insights across all groups')).toBeInTheDocument()
    );
  });

  test('Back button navigates to /dashboard', async () => {
    setupWithData();
    await renderAndWait(<Analytics />);
    await waitFor(() => screen.getByText('Analytics'));
    const backBtn = screen.getAllByRole('button')[0];
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});

// ---------------------------------------------------------------------------
// 4. Summary cards
// ---------------------------------------------------------------------------

describe('Analytics - Summary Cards', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    // Restore implementations cleared by clearAllMocks
    mockCalculateBalances.mockReturnValue({});
    mockCalculateSettlements.mockReturnValue([]);
  });

  test('Renders Total Spent card', async () => {
    setupWithData();
    await renderAndWait(<Analytics />);
    await waitFor(() =>
      expect(screen.getByText('Total Spent')).toBeInTheDocument()
    );
  });

  test('Renders This Month card', async () => {
    setupWithData();
    await renderAndWait(<Analytics />);
    await waitFor(() =>
      expect(screen.getByText('This Month')).toBeInTheDocument()
    );
  });

  test('Renders Total Expenses card', async () => {
    setupWithData();
    await renderAndWait(<Analytics />);
    await waitFor(() =>
      expect(screen.getByText('Total Expenses')).toBeInTheDocument()
    );
  });

  test('Renders Groups card', async () => {
    setupWithData();
    await renderAndWait(<Analytics />);
    await waitFor(() =>
      expect(screen.getByText('Groups')).toBeInTheDocument()
    );
  });

  test('Shows formatted total spend amount', async () => {
    setupWithData([makeExpense({ amount: 100 })]);
    await renderAndWait(<Analytics />);
    await waitFor(() =>
      expect(screen.getByText('EUR 100.00')).toBeInTheDocument()
    );
  });

  test('Shows expense count of 1', async () => {
    setupWithData([makeExpense()]);
    await renderAndWait(<Analytics />);
    await waitFor(() => {
      const totalExpensesLabel = screen.getByText('Total Expenses');
      const card = totalExpensesLabel.closest('div');
      expect(card).toHaveTextContent('1');
    });
  });
});

// ---------------------------------------------------------------------------
// 5. Chart sections
// ---------------------------------------------------------------------------

describe('Analytics - Chart Sections', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    // Restore implementations cleared by clearAllMocks
    mockCalculateBalances.mockReturnValue({});
    mockCalculateSettlements.mockReturnValue([]);
  });

  test('Renders Spending Over Time chart card', async () => {
    setupWithData();
    await renderAndWait(<Analytics />);
    await waitFor(() =>
      expect(screen.getByText('Spending Over Time')).toBeInTheDocument()
    );
  });

  test('Renders Monthly Summary chart card', async () => {
    setupWithData();
    await renderAndWait(<Analytics />);
    await waitFor(() =>
      expect(screen.getByText('Monthly Summary')).toBeInTheDocument()
    );
  });

  test('Renders Category Breakdown chart card', async () => {
    setupWithData();
    await renderAndWait(<Analytics />);
    await waitFor(() =>
      expect(screen.getByText('Category Breakdown')).toBeInTheDocument()
    );
  });

  test('Renders Per-Person Balance chart card', async () => {
    setupWithData();
    await renderAndWait(<Analytics />);
    await waitFor(() =>
      expect(screen.getByText('Per-Person Balance')).toBeInTheDocument()
    );
  });

  test('Renders Who Owes Who chart card', async () => {
    setupWithData();
    await renderAndWait(<Analytics />);
    await waitFor(() =>
      expect(screen.getByText('Who Owes Who')).toBeInTheDocument()
    );
  });

  test('Shows No data yet when no expenses exist', async () => {
    setupEmpty();
    await renderAndWait(<Analytics />);
    await waitFor(() =>
      expect(screen.getByText('No data yet')).toBeInTheDocument()
    );
  });

  test('Shows All settled up in Who Owes Who when no settlements', async () => {
    setupWithData();
    await renderAndWait(<Analytics />);
    await waitFor(() =>
      expect(screen.getByText('All settled up!')).toBeInTheDocument()
    );
  });

  test('Shows No balance data yet in Per-Person Balance when balances empty', async () => {
    setupWithData();
    await renderAndWait(<Analytics />);
    await waitFor(() =>
      expect(screen.getByText('No balance data yet')).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 6. Multiple expenses
// ---------------------------------------------------------------------------

describe('Analytics - Multiple Expenses', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    // Restore implementations cleared by clearAllMocks
    mockCalculateBalances.mockReturnValue({});
    mockCalculateSettlements.mockReturnValue([]);
  });

  test('Accumulates total spend across multiple expenses', async () => {
    setupWithData([
      makeExpense({ id: 'e1', amount: 30 }),
      makeExpense({ id: 'e2', amount: 70 }),
    ]);
    await renderAndWait(<Analytics />);
    await waitFor(() =>
      expect(screen.getByText('EUR 100.00')).toBeInTheDocument()
    );
  });

  test('Shows expense count of 2', async () => {
    setupWithData([
      makeExpense({ id: 'e1', amount: 25 }),
      makeExpense({ id: 'e2', amount: 35 }),
    ]);
    await renderAndWait(<Analytics />);
    await waitFor(() => {
      const totalExpensesLabel = screen.getByText('Total Expenses');
      const card = totalExpensesLabel.closest('div');
      expect(card).toHaveTextContent('2');
    });
  });
});

// ---------------------------------------------------------------------------
// 7. Group Selector
// ---------------------------------------------------------------------------

describe('Analytics - Group Selector', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockCalculateBalances.mockReturnValue({});
    mockCalculateSettlements.mockReturnValue([]);
  });

  test('Group selector renders with All Groups option', async () => {
    setupWithData();
    await renderAndWait(<Analytics />);
    await waitFor(() =>
      expect(screen.getByText('All Groups (mixed currencies)')).toBeInTheDocument()
    );
  });

  test('Group selector shows group name and currency as an option', async () => {
    const group = {
      id: 'grp-1', name: 'House', currency: 'EUR',
      memberIds: ['user-001'],
      members: [{ userId: 'user-001', name: 'Alice', email: 'alice@example.com' }],
    };
    mockGetDocs
      .mockResolvedValueOnce(groupSnap([group]))
      .mockResolvedValueOnce(expenseSnap([makeExpense()]));
    await renderAndWait(<Analytics />);
    await waitFor(() =>
      expect(screen.getByText('House — EUR')).toBeInTheDocument()
    );
  });

  test('Mixed currency warning shown when All Groups selected', async () => {
    setupWithData();
    await renderAndWait(<Analytics />);
    await waitFor(() =>
      expect(
        screen.getByText(/Amounts across groups may be of different currencies/i)
      ).toBeInTheDocument()
    );
  });

  test('Mixed currency warning hidden when specific group selected', async () => {
    const group = {
      id: 'grp-1', name: 'House', currency: 'EUR',
      memberIds: ['user-001'],
      members: [{ userId: 'user-001', name: 'Alice', email: 'alice@example.com' }],
    };
    mockGetDocs
      .mockResolvedValueOnce(groupSnap([group]))
      .mockResolvedValueOnce(expenseSnap([makeExpense()]));
    await renderAndWait(<Analytics />);
    await waitFor(() => screen.getByText('House — EUR'));
    const selector = screen.getByRole('combobox');
    fireEvent.change(selector, { target: { value: 'grp-1' } });
    await waitFor(() =>
      expect(
        screen.queryByText(/Amounts across groups may be of different currencies/i)
      ).not.toBeInTheDocument()
    );
  });

  test('Selecting a group filters expense count', async () => {
    const group1 = {
      id: 'grp-1', name: 'House', currency: 'EUR',
      memberIds: ['user-001'],
      members: [{ userId: 'user-001', name: 'Alice', email: 'alice@example.com' }],
    };
    const group2 = {
      id: 'grp-2', name: 'Trip', currency: 'GBP',
      memberIds: ['user-001'],
      members: [{ userId: 'user-001', name: 'Alice', email: 'alice@example.com' }],
    };
    mockGetDocs
      .mockResolvedValueOnce(groupSnap([group1, group2]))
      .mockResolvedValueOnce(expenseSnap([
        makeExpense({ id: 'e1', groupId: 'grp-1', amount: 50 }),
      ]))
      .mockResolvedValueOnce(expenseSnap([
        makeExpense({ id: 'e2', groupId: 'grp-2', amount: 30 }),
      ]));
    await renderAndWait(<Analytics />);
    await waitFor(() => screen.getByText('House — EUR'));
    // Select grp-1 only
    const selector = screen.getByRole('combobox');
    fireEvent.change(selector, { target: { value: 'grp-1' } });
    await waitFor(() => {
      const totalExpensesLabel = screen.getByText('Total Expenses');
      const card = totalExpensesLabel.closest('div');
      expect(card).toHaveTextContent('1');
    });
  });
});

// ---------------------------------------------------------------------------
// 8. Multi-currency summary cards
// ---------------------------------------------------------------------------

describe('Analytics - Multi-currency summary cards', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockCalculateBalances.mockReturnValue({});
    mockCalculateSettlements.mockReturnValue([]);
  });

  test('Shows EUR and GBP totals separately when all groups selected', async () => {
    const group1 = {
      id: 'grp-1', name: 'House', currency: 'EUR',
      memberIds: ['user-001'],
      members: [{ userId: 'user-001', name: 'Alice', email: 'alice@example.com' }],
    };
    const group2 = {
      id: 'grp-2', name: 'Trip', currency: 'GBP',
      memberIds: ['user-001'],
      members: [{ userId: 'user-001', name: 'Alice', email: 'alice@example.com' }],
    };
    mockGetDocs
      .mockResolvedValueOnce(groupSnap([group1, group2]))
      .mockResolvedValueOnce(expenseSnap([
        makeExpense({ id: 'e1', groupId: 'grp-1', amount: 100 }),
      ]))
      .mockResolvedValueOnce(expenseSnap([
        makeExpense({ id: 'e2', groupId: 'grp-2', amount: 50 }),
      ]));
    await renderAndWait(<Analytics />);
    await waitFor(() => {
      expect(screen.getByText('EUR 100.00')).toBeInTheDocument();
      expect(screen.getByText('GBP 50.00')).toBeInTheDocument();
    });
  });

  test('Shows dash when no expenses exist in all-groups view', async () => {
    mockGetDocs.mockResolvedValue(emptySnap());
    await renderAndWait(<Analytics />);
    await waitFor(() =>
      expect(screen.getByText('No data yet')).toBeInTheDocument()
    );
  });

  test('Shows formatted single currency total when group is selected', async () => {
    const group = {
      id: 'grp-1', name: 'House', currency: 'GBP',
      memberIds: ['user-001'],
      members: [{ userId: 'user-001', name: 'Alice', email: 'alice@example.com' }],
    };
    mockGetDocs
      .mockResolvedValueOnce(groupSnap([group]))
      .mockResolvedValueOnce(expenseSnap([
        makeExpense({ id: 'e1', groupId: 'grp-1', amount: 75 }),
      ]));
    await renderAndWait(<Analytics />);
    await waitFor(() => screen.getByText('House — GBP'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'grp-1' } });
    await waitFor(() =>
      expect(screen.getByText('GBP 75.00')).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 9. Who Owes Who — with settlements
// ---------------------------------------------------------------------------

describe('Analytics - Who Owes Who with settlements', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockCalculateBalances.mockReturnValue({});
    mockCalculateSettlements.mockReturnValue([]);
  });

  test('Shows settlement row when settlements exist', async () => {
    mockCalculateBalances.mockReturnValue({
      'user-001': 30, 'user-002': -30,
    });
    mockCalculateSettlements.mockReturnValue([
      { from: 'user-002', to: 'user-001', amount: 30 },
    ]);
    const group = {
      id: 'grp-1', name: 'House', currency: 'EUR',
      memberIds: ['user-001', 'user-002'],
      members: [
        { userId: 'user-001', name: 'Alice', email: 'alice@example.com' },
        { userId: 'user-002', name: 'Bob',   email: 'bob@example.com' },
      ],
    };
    mockGetDocs
      .mockResolvedValueOnce(groupSnap([group]))
      .mockResolvedValueOnce(expenseSnap([makeExpense({ amount: 60 })]));
    await renderAndWait(<Analytics />);
    await waitFor(() =>
      expect(screen.queryByText('All settled up!')).not.toBeInTheDocument()
    );
  });

  test('Shows All settled up when no settlements needed', async () => {
    mockCalculateBalances.mockReturnValue({});
    mockCalculateSettlements.mockReturnValue([]);
    setupWithData();
    await renderAndWait(<Analytics />);
    await waitFor(() =>
      expect(screen.getByText('All settled up!')).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 10. Category Breakdown
// ---------------------------------------------------------------------------

describe('Analytics - Category Breakdown', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockCalculateBalances.mockReturnValue({});
    mockCalculateSettlements.mockReturnValue([]);
  });

  test('Category Breakdown section is present with data', async () => {
    setupWithData([makeExpense({ category: 'food', amount: 50 })]);
    await renderAndWait(<Analytics />);
    await waitFor(() =>
      expect(screen.getByText('Category Breakdown')).toBeInTheDocument()
    );
  });

  test('Multiple expenses with different categories render without error', async () => {
    setupWithData([
      makeExpense({ id: 'e1', category: 'food',      amount: 50 }),
      makeExpense({ id: 'e2', category: 'transport', amount: 30 }),
      makeExpense({ id: 'e3', category: 'accommodation', amount: 100 }),
    ]);
    await renderAndWait(<Analytics />);
    await waitFor(() =>
      expect(screen.getByText('Category Breakdown')).toBeInTheDocument()
    );
  });

  test('Settlements are excluded from category breakdown', async () => {
    setupWithData([
      makeExpense({ id: 'e1', category: 'food',       amount: 50, isSettlement: false }),
      makeExpense({ id: 'e2', category: 'settlement', amount: 30, isSettlement: true }),
    ]);
    await renderAndWait(<Analytics />);
    await waitFor(() =>
      expect(screen.getByText('Category Breakdown')).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 11. Groups count card
// ---------------------------------------------------------------------------

describe('Analytics - Groups count card', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockCalculateBalances.mockReturnValue({});
    mockCalculateSettlements.mockReturnValue([]);
  });

  test('Groups card shows count of 1 with one group', async () => {
    setupWithData();
    await renderAndWait(<Analytics />);
    await waitFor(() => {
      const groupsLabel = screen.getByText('Groups');
      const card = groupsLabel.closest('div');
      expect(card).toHaveTextContent('1');
    });
  });

  test('Groups card shows count of 2 with two groups', async () => {
    const group1 = {
      id: 'grp-1', name: 'House', currency: 'EUR',
      memberIds: ['user-001'],
      members: [{ userId: 'user-001', name: 'Alice', email: 'alice@example.com' }],
    };
    const group2 = {
      id: 'grp-2', name: 'Trip', currency: 'GBP',
      memberIds: ['user-001'],
      members: [{ userId: 'user-001', name: 'Alice', email: 'alice@example.com' }],
    };
    mockGetDocs
      .mockResolvedValueOnce(groupSnap([group1, group2]))
      .mockResolvedValueOnce(expenseSnap([
        makeExpense({ id: 'e1', groupId: 'grp-1', amount: 50 }),
      ]))
      .mockResolvedValueOnce(expenseSnap([]));
    await renderAndWait(<Analytics />);
    await waitFor(() => {
      const groupsLabel = screen.getByText('Groups');
      const card = groupsLabel.closest('div');
      expect(card).toHaveTextContent('2');
    });
  });
});

// ---------------------------------------------------------------------------
// Regression: people who left a group used to appear as raw 28-character user
// IDs in Per-Person Balance and Who Owes Who, breaking the mobile layout.
// ---------------------------------------------------------------------------

describe('Analytics - names of people who left', () => {
  const LONG_ID = 'Xq9ZkP2mL7vBn4Rt8Wc1Hy6JsDfA'; // looks like a Firebase uid

  const setupWithLeaver = (group, userDoc) => {
    mockGetDocs
      .mockResolvedValueOnce(groupSnap([group]))
      .mockResolvedValueOnce(expenseSnap([
        makeExpense({ paidBy: 'user-001', participants: ['user-001', LONG_ID], splits: { 'user-001': 25, [LONG_ID]: 25 } }),
      ]));
    mockGetDoc.mockResolvedValue(userDoc);
    mockCalculateBalances.mockReturnValue({ 'user-001': 25, [LONG_ID]: -25 });
    mockCalculateSettlements.mockReturnValue([{ from: LONG_ID, to: 'user-001', amount: 25 }]);
  };

  beforeEach(() => jest.clearAllMocks());

  test('shows the formerMembers name marked "(left)" instead of the user ID', async () => {
    setupWithLeaver({
      id: 'grp-1', name: 'House', currency: 'EUR', memberIds: ['user-001'],
      members: [{ userId: 'user-001', name: 'Alice' }],
      formerMembers: [{ userId: LONG_ID, name: 'Carol Smith', reason: 'left' }],
    }, { exists: () => false, data: () => ({}) });
    render(<Analytics />);
    await waitFor(() => expect(screen.getAllByText('Carol (left)').length).toBeGreaterThan(0));
    expect(screen.queryByText(new RegExp(LONG_ID))).not.toBeInTheDocument();
    expect(mockGetDoc).not.toHaveBeenCalled(); // name already known
  });

  test('looks up the profile of someone with no snapshot, else shows "Former member"', async () => {
    setupWithLeaver({
      id: 'grp-1', name: 'House', currency: 'EUR', memberIds: ['user-001'],
      members: [{ userId: 'user-001', name: 'Alice' }],
    }, { exists: () => false, data: () => ({}) }); // account deleted
    render(<Analytics />);
    await waitFor(() => expect(screen.getAllByText('Former member').length).toBeGreaterThan(0));
    expect(screen.queryByText(new RegExp(LONG_ID))).not.toBeInTheDocument();
  });
});

describe('Analytics - Who Owes Who keeps currencies separate', () => {
  beforeEach(() => jest.clearAllMocks());

  test('the same two people in EUR and GBP groups get two rows, never one summed amount', async () => {
    const members = [{ userId: 'user-001', name: 'Alice' }, { userId: 'user-002', name: 'Bob' }];
    mockGetDocs
      .mockResolvedValueOnce(groupSnap([
        { id: 'g-eur', name: 'Trip', currency: 'EUR', memberIds: ['user-001', 'user-002'], members },
        { id: 'g-gbp', name: 'Flat', currency: 'GBP', memberIds: ['user-001', 'user-002'], members },
      ]))
      .mockResolvedValueOnce(expenseSnap([makeExpense({ id: 'a', groupId: 'g-eur' })]))
      .mockResolvedValueOnce(expenseSnap([makeExpense({ id: 'b', groupId: 'g-gbp' })]));
    mockCalculateBalances.mockReturnValue({ 'user-001': 10, 'user-002': -10 });
    mockCalculateSettlements.mockReturnValue([{ from: 'user-002', to: 'user-001', amount: 10 }]);
    render(<Analytics />);
    await waitFor(() => expect(screen.getAllByText('Bob').length).toBe(2)); // two rows
    const amounts = screen.getAllByText(/10\.00/).map(el => el.textContent);
    expect(amounts.some(t => /EUR|€/.test(t))).toBe(true);
    expect(amounts.some(t => /GBP|£/.test(t))).toBe(true);
    expect(screen.queryByText(/20\.00/)).not.toBeInTheDocument(); // not summed
  });
});
