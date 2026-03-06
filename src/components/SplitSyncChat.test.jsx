// src/components/SplitSyncChat.test.jsx
// Tests for SplitSyncChat - FAB visibility, open/close, welcome message,
// suggestion chips, send message, Enter key, error handling, reset, loading

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock Firebase functions
const mockChatFn = jest.fn();
jest.mock('firebase/functions', () => ({
  getFunctions:   jest.fn(() => ({})),
  httpsCallable:  jest.fn(() => mockChatFn),
}));
jest.mock('../services/firebase', () => ({}));

// Mock auth store
const mockAuthStore = { user: { uid: 'user-123', displayName: 'Alice' } };
jest.mock('../stores/authStore', () => ({
  useAuthStore: () => mockAuthStore,
}));

import SplitSyncChat from './SplitSyncChat';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

// jsdom does not implement scrollIntoView - mock it globally
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  jest.clearAllMocks();
  // Restore httpsCallable return value cleared by clearAllMocks
  const { httpsCallable } = require('firebase/functions');
  httpsCallable.mockReturnValue(mockChatFn);
  mockAuthStore.user = { uid: 'user-123', displayName: 'Alice' };
});

// ---------------------------------------------------------------------------
// 1. Auth gate
// ---------------------------------------------------------------------------

describe('SplitSyncChat - Auth gate', () => {

  test('Does not render FAB when user is null', () => {
    mockAuthStore.user = null;
    render(<SplitSyncChat />);
    expect(screen.queryByLabelText('Open assistant')).not.toBeInTheDocument();
  });

  test('Renders FAB when user is authenticated', () => {
    render(<SplitSyncChat />);
    expect(screen.getByLabelText('Open assistant')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Open / Close
// ---------------------------------------------------------------------------

describe('SplitSyncChat - Open and close', () => {

  test('Chat window is hidden by default', () => {
    render(<SplitSyncChat />);
    expect(screen.queryByText('Split-Sync Assistant')).not.toBeInTheDocument();
  });

  test('Opens chat window when FAB is clicked', () => {
    render(<SplitSyncChat />);
    fireEvent.click(screen.getByLabelText('Open assistant'));
    expect(screen.getByText('Split-Sync Assistant')).toBeInTheDocument();
  });

  test('FAB label changes to Close assistant when open', () => {
    render(<SplitSyncChat />);
    fireEvent.click(screen.getByLabelText('Open assistant'));
    expect(screen.getByLabelText('Close assistant')).toBeInTheDocument();
  });

  test('Closes chat window when FAB is clicked again', () => {
    render(<SplitSyncChat />);
    fireEvent.click(screen.getByLabelText('Open assistant'));
    fireEvent.click(screen.getByLabelText('Close assistant'));
    expect(screen.queryByText('Split-Sync Assistant')).not.toBeInTheDocument();
  });

  test('Closes chat window when X button inside header is clicked', () => {
    render(<SplitSyncChat />);
    fireEvent.click(screen.getByLabelText('Open assistant'));
    fireEvent.click(screen.getByLabelText('Close chat'));
    expect(screen.queryByText('Split-Sync Assistant')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Welcome message and suggestions
// ---------------------------------------------------------------------------

describe('SplitSyncChat - Welcome state', () => {

  test('Shows welcome message when chat is opened', () => {
    render(<SplitSyncChat />);
    fireEvent.click(screen.getByLabelText('Open assistant'));
    expect(screen.getByText(/I am the Split-Sync assistant/)).toBeInTheDocument();
  });

  test('Shows Powered by Claude AI label', () => {
    render(<SplitSyncChat />);
    fireEvent.click(screen.getByLabelText('Open assistant'));
    expect(screen.getByText('Powered by Claude AI')).toBeInTheDocument();
  });

  test('Shows all 4 suggestion chips', () => {
    render(<SplitSyncChat />);
    fireEvent.click(screen.getByLabelText('Open assistant'));
    expect(screen.getByText('How do I split an expense equally?')).toBeInTheDocument();
    expect(screen.getByText('How do I settle up with someone?')).toBeInTheDocument();
    expect(screen.getByText('How do I invite friends to a group?')).toBeInTheDocument();
    expect(screen.getByText('How do I set up my payment methods?')).toBeInTheDocument();
  });

  test('Shows Ask a question placeholder in textarea', () => {
    render(<SplitSyncChat />);
    fireEvent.click(screen.getByLabelText('Open assistant'));
    expect(screen.getByPlaceholderText('Ask a question...')).toBeInTheDocument();
  });

  test('Send button is disabled when input is empty', () => {
    render(<SplitSyncChat />);
    fireEvent.click(screen.getByLabelText('Open assistant'));
    expect(screen.getByLabelText('Send message')).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// 4. Sending messages
// ---------------------------------------------------------------------------

describe('SplitSyncChat - Send message', () => {

  test('Send button becomes enabled when input has text', () => {
    render(<SplitSyncChat />);
    fireEvent.click(screen.getByLabelText('Open assistant'));
    fireEvent.change(screen.getByPlaceholderText('Ask a question...'), {
      target: { value: 'Hello' },
    });
    expect(screen.getByLabelText('Send message')).not.toBeDisabled();
  });

  test('Displays user message after sending', async () => {
    mockChatFn.mockResolvedValue({ data: { reply: 'Hi there!' } });
    render(<SplitSyncChat />);
    fireEvent.click(screen.getByLabelText('Open assistant'));
    fireEvent.change(screen.getByPlaceholderText('Ask a question...'), {
      target: { value: 'Hello' },
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Send message'));
    });
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  test('Displays assistant reply after successful response', async () => {
    mockChatFn.mockResolvedValue({ data: { reply: 'Hi there!' } });
    render(<SplitSyncChat />);
    fireEvent.click(screen.getByLabelText('Open assistant'));
    fireEvent.change(screen.getByPlaceholderText('Ask a question...'), {
      target: { value: 'Hello' },
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Send message'));
    });
    await waitFor(() =>
      expect(screen.getByText('Hi there!')).toBeInTheDocument()
    );
  });

  test('Clears input after sending', async () => {
    mockChatFn.mockResolvedValue({ data: { reply: 'Hi!' } });
    render(<SplitSyncChat />);
    fireEvent.click(screen.getByLabelText('Open assistant'));
    const textarea = screen.getByPlaceholderText('Ask a question...');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Send message'));
    });
    expect(textarea.value).toBe('');
  });

  test('Sends message when suggestion chip is clicked', async () => {
    mockChatFn.mockResolvedValue({ data: { reply: 'Sure!' } });
    render(<SplitSyncChat />);
    fireEvent.click(screen.getByLabelText('Open assistant'));
    await act(async () => {
      fireEvent.click(screen.getByText('How do I split an expense equally?'));
    });
    expect(mockChatFn).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ content: 'How do I split an expense equally?' }),
        ]),
      })
    );
  });

  test('Sends message on Enter key press', async () => {
    mockChatFn.mockResolvedValue({ data: { reply: 'Got it!' } });
    render(<SplitSyncChat />);
    fireEvent.click(screen.getByLabelText('Open assistant'));
    const textarea = screen.getByPlaceholderText('Ask a question...');
    fireEvent.change(textarea, { target: { value: 'Test question' } });
    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    });
    expect(mockChatFn).toHaveBeenCalled();
  });

  test('Does not send message on Shift+Enter', async () => {
    render(<SplitSyncChat />);
    fireEvent.click(screen.getByLabelText('Open assistant'));
    const textarea = screen.getByPlaceholderText('Ask a question...');
    fireEvent.change(textarea, { target: { value: 'Test' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(mockChatFn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 5. Error handling
// ---------------------------------------------------------------------------

describe('SplitSyncChat - Error handling', () => {

  test('Shows error message when chatFn throws', async () => {
    mockChatFn.mockRejectedValue(new Error('Network error'));
    render(<SplitSyncChat />);
    fireEvent.click(screen.getByLabelText('Open assistant'));
    fireEvent.change(screen.getByPlaceholderText('Ask a question...'), {
      target: { value: 'Hello' },
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Send message'));
    });
    await waitFor(() =>
      expect(screen.getByText('Could not reach the assistant. Please try again.')).toBeInTheDocument()
    );
  });

  test('Removes user message from list on error', async () => {
    mockChatFn.mockRejectedValue(new Error('Network error'));
    render(<SplitSyncChat />);
    fireEvent.click(screen.getByLabelText('Open assistant'));
    fireEvent.change(screen.getByPlaceholderText('Ask a question...'), {
      target: { value: 'Hello' },
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Send message'));
    });
    await waitFor(() =>
      expect(screen.queryByText('Hello')).not.toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// 6. Reset conversation
// ---------------------------------------------------------------------------

describe('SplitSyncChat - Reset', () => {

  test('Shows clear button after a message is sent', async () => {
    mockChatFn.mockResolvedValue({ data: { reply: 'Hi!' } });
    render(<SplitSyncChat />);
    fireEvent.click(screen.getByLabelText('Open assistant'));
    fireEvent.change(screen.getByPlaceholderText('Ask a question...'), {
      target: { value: 'Hello' },
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Send message'));
    });
    await waitFor(() =>
      expect(screen.getByTitle('Clear conversation')).toBeInTheDocument()
    );
  });

  test('Clicking clear button resets conversation to welcome state', async () => {
    mockChatFn.mockResolvedValue({ data: { reply: 'Hi!' } });
    render(<SplitSyncChat />);
    fireEvent.click(screen.getByLabelText('Open assistant'));
    fireEvent.change(screen.getByPlaceholderText('Ask a question...'), {
      target: { value: 'Hello' },
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Send message'));
    });
    await waitFor(() => screen.getByTitle('Clear conversation'));
    fireEvent.click(screen.getByTitle('Clear conversation'));
    expect(screen.getByText(/I am the Split-Sync assistant/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 7. formatMessage utility (via rendered output)
// ---------------------------------------------------------------------------

describe('SplitSyncChat - formatMessage', () => {

  test('Strips bold markdown from assistant reply', async () => {
    mockChatFn.mockResolvedValue({ data: { reply: '**Hello** world' } });
    render(<SplitSyncChat />);
    fireEvent.click(screen.getByLabelText('Open assistant'));
    fireEvent.change(screen.getByPlaceholderText('Ask a question...'), {
      target: { value: 'Hi' },
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Send message'));
    });
    await waitFor(() =>
      expect(screen.getByText('Hello world')).toBeInTheDocument()
    );
  });
});
