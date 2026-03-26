// src/components/AddExpenseModal.test.jsx
// Tests for AddExpenseModal component
// Covers: rendering, form inputs, validation, split methods, confirmation flow, submission

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddExpenseModal from './AddExpenseModal';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../services/firebase', () => ({
  db: {},
}));

jest.mock('firebase/firestore', () => ({
  collection:      jest.fn(() => ({})),
  addDoc:          jest.fn(() => Promise.resolve({ id: 'new-expense-id' })),
  serverTimestamp: jest.fn(() => new Date()),
  doc:             jest.fn(() => ({})),
  updateDoc:       jest.fn(() => Promise.resolve()),
}));
jest.mock('../stores/authStore', () => ({
  useAuthStore: () => ({
    user: {
      uid: 'user-1',
      displayName: 'Alice',
      email: 'alice@example.com',
    },
  }),
}));

jest.mock('../stores/notificationsStore', () => ({
  createNotification: jest.fn(() => Promise.resolve()),
}));

jest.mock('./ReceiptScanner', () =>
  function MockReceiptScanner({ isOpen, onClose, onDataExtracted }) {
    if (!isOpen) return null;
    return (
      <div data-testid="receipt-scanner">
        <button onClick={onClose}>Close Scanner</button>
        <button
          onClick={() =>
            onDataExtracted({ title: 'Scanned Item', amount: '42.00', date: '2025-03-01', receiptURL: 'http://test.com/receipt.jpg' })
          }
        >
          Extract Data
        </button>
      </div>
    );
  }
);

jest.mock('./Tooltip', () =>
  function MockTooltip({ text }) {
    return <span data-testid="tooltip" title={text} />;
  }
);

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockGroup = {
  id: 'group-1',
  name: 'Trip to Lisbon',
  currency: 'EUR',
  members: [
    { userId: 'user-1', name: 'Alice' },
    { userId: 'user-2', name: 'Bob' },
    { userId: 'user-3', name: 'Carol' },
  ],
};

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  group: mockGroup,
};

// Helper to render the modal
const renderModal = (props = {}) =>
  render(<AddExpenseModal {...defaultProps} {...props} />);

// ---------------------------------------------------------------------------
// 1. Rendering
// ---------------------------------------------------------------------------

describe('AddExpenseModal - Rendering', () => {
  beforeEach(() => jest.clearAllMocks());

  test('renders nothing when isOpen is false', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByText('Add Expense')).not.toBeInTheDocument();
  });

  test('renders the modal heading when isOpen is true', () => {
    renderModal();
    // Use heading role to avoid matching the submit button which also says "Add Expense"
    expect(screen.getByRole('heading', { name: 'Add Expense' })).toBeInTheDocument();
  });

  test('renders all core form fields', () => {
    renderModal();
    expect(screen.getByPlaceholderText('e.g., Dinner at Restaurant')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Optional notes...')).toBeInTheDocument();
    expect(screen.getByDisplayValue(new Date().toISOString().split('T')[0])).toBeInTheDocument();
  });

  test('renders all split method buttons', () => {
    renderModal();
    expect(screen.getByText('Equal Split')).toBeInTheDocument();
    expect(screen.getByText('By Percentage')).toBeInTheDocument();
    expect(screen.getByText('Exact Amounts')).toBeInTheDocument();
    expect(screen.getByText('By Shares')).toBeInTheDocument();
  });

  test('renders all group members as checkboxes', () => {
    renderModal();
    // Members appear in both the Paid By select and the checkbox list, use getAllByText
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Carol').length).toBeGreaterThan(0);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
  });

  test('renders all group members pre-checked', () => {
    renderModal();
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(cb => expect(cb).toBeChecked());
  });

  test('renders Scan Receipt button', () => {
    renderModal();
    expect(screen.getByText('Scan Receipt (Auto-fill)')).toBeInTheDocument();
  });

  test('renders Cancel and Add Expense buttons', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add expense/i })).toBeInTheDocument();
  });

  test('renders currency label from group prop', () => {
    renderModal();
    expect(screen.getByText(/Amount \(EUR\)/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Form Input Interactions
// ---------------------------------------------------------------------------

describe('AddExpenseModal - Form Inputs', () => {
  beforeEach(() => jest.clearAllMocks());

  test('updates title field on user input', async () => {
    renderModal();
    const titleInput = screen.getByPlaceholderText('e.g., Dinner at Restaurant');
    await userEvent.type(titleInput, 'Lunch');
    expect(titleInput).toHaveValue('Lunch');
  });

  test('updates amount field on valid input', async () => {
    renderModal();
    const amountInput = screen.getByPlaceholderText('0.00');
    await userEvent.type(amountInput, '50.00');
    expect(amountInput).toHaveValue(50);
  });

  test('updates description field on user input', async () => {
    renderModal();
    const descInput = screen.getByPlaceholderText('Optional notes...');
    await userEvent.type(descInput, 'Split for the team');
    expect(descInput).toHaveValue('Split for the team');
  });

  test('calls onClose when Cancel button is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  test('calls onClose when close (x) button is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByText('✕'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  test('toggling a member checkbox unchecks that member', () => {
    renderModal();
    const checkboxes = screen.getAllByRole('checkbox');
    // Uncheck Alice (first checkbox)
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).not.toBeChecked();
  });

  test('shows summary box when amount and members are set', async () => {
    renderModal();
    const amountInput = screen.getByPlaceholderText('0.00');
    await userEvent.type(amountInput, '90');
    expect(screen.getByText('Total Amount:')).toBeInTheDocument();
    expect(screen.getByText(/Split among:/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Validation
// ---------------------------------------------------------------------------

describe('AddExpenseModal - Validation', () => {
  beforeEach(() => jest.clearAllMocks());

  test('shows error when title is empty on submit', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /add expense/i }));
    await waitFor(() =>
      expect(screen.getByText('Expense title is required')).toBeInTheDocument()
    );
  });

  test('shows error when amount is zero on submit', async () => {
    renderModal();
    await userEvent.type(screen.getByPlaceholderText('e.g., Dinner at Restaurant'), 'Dinner');
    fireEvent.click(screen.getByRole('button', { name: /add expense/i }));
    await waitFor(() =>
      expect(screen.getByText(/please enter a valid amount/i)).toBeInTheDocument()
    );
  });

  test('shows error when amount exceeds 1,000,000', async () => {
    renderModal();
    await userEvent.type(screen.getByPlaceholderText('e.g., Dinner at Restaurant'), 'Dinner');
    const amountInput = screen.getByPlaceholderText('0.00');
    fireEvent.change(amountInput, { target: { value: '1000001' } });
    await waitFor(() =>
      expect(screen.getByText(/amount cannot exceed/i)).toBeInTheDocument()
    );
  });

  test('shows error when no members are selected', async () => {
    renderModal();
    await userEvent.type(screen.getByPlaceholderText('e.g., Dinner at Restaurant'), 'Dinner');
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '90' } });

    // Uncheck all members
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(cb => fireEvent.click(cb));

    fireEvent.click(screen.getByRole('button', { name: /add expense/i }));
    await waitFor(() =>
      expect(screen.getByText(/select at least one member/i)).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Split Methods
// ---------------------------------------------------------------------------

describe('AddExpenseModal - Split Methods', () => {
  beforeEach(() => jest.clearAllMocks());

  test('switches to Percentage split method', () => {
    renderModal();
    fireEvent.click(screen.getByText('By Percentage'));
    expect(screen.getByText('By Percentage').closest('button')).toHaveClass('border-primary', { exact: false });
  });

  test('switches to Exact Amounts split method', () => {
    renderModal();
    fireEvent.click(screen.getByText('Exact Amounts'));
    // Input fields with currency placeholder should appear
    const inputs = screen.getAllByPlaceholderText('EUR');
    expect(inputs.length).toBeGreaterThan(0);
  });

  test('switches to By Shares split method', () => {
    renderModal();
    fireEvent.click(screen.getByText('By Shares'));
    const sharesInputs = screen.getAllByPlaceholderText('shares');
    expect(sharesInputs.length).toBeGreaterThan(0);
  });

  test('percentage indicator renders and shows Perfect when total equals 100%', async () => {
    renderModal();
    fireEvent.click(screen.getByText('By Percentage'));
    // Component initialises Alice=100%, Bob=0%, Carol=0% so total is exactly 100%
    await waitFor(() =>
      expect(screen.getByText(/Perfect!/i)).toBeInTheDocument()
    );
  });

  test('percentage validation error shown on submit when percentages do not equal 100%', async () => {
    renderModal();
    fireEvent.click(screen.getByText('By Percentage'));
    await userEvent.type(
      screen.getByPlaceholderText('e.g., Dinner at Restaurant'),
      'Dinner'
    );
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '90' } });
    // Override Alice percentage to 50 — auto-balance sets Carol to 50, but Bob still has 0
    // Directly manipulate splits state via all spinbutton inputs
    const spinButtons = screen.getAllByRole('spinbutton');
    // spinButtons[0] = amount, [1] = Alice %, [2] = Bob %, [3] = Carol %
    // Set all to 30 each (total = 90, not 100) to trigger validation error
    if (spinButtons[1]) fireEvent.change(spinButtons[1], { target: { value: '30' } });
    if (spinButtons[2]) fireEvent.change(spinButtons[2], { target: { value: '30' } });
    if (spinButtons[3]) fireEvent.change(spinButtons[3], { target: { value: '30' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /add expense/i }));
    });
    await waitFor(() =>
      expect(screen.getByText(/Percentages must add up/i)).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 5. Confirmation Flow
// ---------------------------------------------------------------------------

describe('AddExpenseModal - Confirmation Flow', () => {
  beforeEach(() => jest.clearAllMocks());

  const fillAndSubmitForm = async () => {
    renderModal();
    await userEvent.type(
      screen.getByPlaceholderText('e.g., Dinner at Restaurant'),
      'Team Lunch'
    );
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '90' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /add expense/i }));
    });
  };

  test('shows confirmation screen after valid form submission', async () => {
    await fillAndSubmitForm();
    await waitFor(() =>
      expect(screen.getByText('Confirm Expense')).toBeInTheDocument()
    );
  });

  test('shows Go Back button on confirmation screen', async () => {
    await fillAndSubmitForm();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
    );
  });

  test('returns to form when Go Back is clicked', async () => {
    await fillAndSubmitForm();
    await waitFor(() => screen.getByText('Confirm Expense'));
    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    // Use heading role to avoid matching the submit button
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Add Expense' })).toBeInTheDocument()
    );
  });

  test('calls addDoc and onClose after confirming expense', async () => {
    const { addDoc } = require('firebase/firestore');
    await fillAndSubmitForm();
    await waitFor(() => screen.getByText('Confirm Expense'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm & add/i }));
    });

    await waitFor(() => expect(addDoc).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(defaultProps.onClose).toHaveBeenCalledTimes(1));
  });
});

// ---------------------------------------------------------------------------
// 6. Receipt Scanner
// ---------------------------------------------------------------------------

describe('AddExpenseModal - Receipt Scanner', () => {
  beforeEach(() => jest.clearAllMocks());

  test('opens receipt scanner when Scan Receipt is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByText('Scan Receipt (Auto-fill)'));
    expect(screen.getByTestId('receipt-scanner')).toBeInTheDocument();
  });

  test('closes receipt scanner when Close Scanner is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByText('Scan Receipt (Auto-fill)'));
    fireEvent.click(screen.getByText('Close Scanner'));
    expect(screen.queryByTestId('receipt-scanner')).not.toBeInTheDocument();
  });

  test('pre-fills form fields from scanned receipt data', async () => {
    renderModal();
    fireEvent.click(screen.getByText('Scan Receipt (Auto-fill)'));
    fireEvent.click(screen.getByText('Extract Data'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Scanned Item')).toBeInTheDocument();
      expect(screen.getByDisplayValue('42.00')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// 7. Category and Paid By selectors
// ---------------------------------------------------------------------------

describe('AddExpenseModal - Selects', () => {
  beforeEach(() => jest.clearAllMocks());

  test('renders all expense categories in the dropdown', () => {
    renderModal();
    expect(screen.getByText('Food & Dining')).toBeInTheDocument();
    expect(screen.getByText('Transport')).toBeInTheDocument();
    expect(screen.getByText('Accommodation')).toBeInTheDocument();
    expect(screen.getByText('Entertainment')).toBeInTheDocument();
    expect(screen.getByText('Shopping')).toBeInTheDocument();
    expect(screen.getByText('Utilities')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
  });

  test('renders all group members in the Paid By dropdown', () => {
    renderModal();
    const select = screen.getByDisplayValue('Alice');
    expect(select).toBeInTheDocument();
    expect(screen.getAllByRole('option', { name: 'Bob' }).length).toBeGreaterThan(0);
  });

  test('changes Paid By selection', () => {
    renderModal();
    const paidBySelect = screen.getByDisplayValue('Alice');
    fireEvent.change(paidBySelect, { target: { value: 'user-2' } });
    expect(paidBySelect).toHaveValue('user-2');
  });
});
