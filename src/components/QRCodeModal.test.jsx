// src/components/QRCodeModal.test.jsx
// Tests for QRCodeModal - visibility, content, copy URL, share buttons, close

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock QRCodeSVG to avoid canvas issues in jsdom
jest.mock('qrcode.react', () => ({
  QRCodeSVG: ({ id, value }) => <div data-testid="qr-code" id={id} data-value={value} />,
}));

import QRCodeModal from './QRCodeModal';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const mockOnClose = jest.fn();
const TEST_URL = 'https://split-sync.app';

const defaultProps = {
  isOpen:  true,
  onClose: mockOnClose,
  appUrl:  TEST_URL,
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(navigator, {
    clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
  });
  window.open = jest.fn();
});

// ---------------------------------------------------------------------------
// 1. Visibility
// ---------------------------------------------------------------------------

describe('QRCodeModal - Visibility', () => {

  test('Renders when isOpen is true', () => {
    render(<QRCodeModal {...defaultProps} />);
    expect(screen.getByText('Share Split-Sync')).toBeInTheDocument();
  });

  test('Does not render when isOpen is false', () => {
    render(<QRCodeModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Share Split-Sync')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Content
// ---------------------------------------------------------------------------

describe('QRCodeModal - Content', () => {

  test('Renders QR code element', () => {
    render(<QRCodeModal {...defaultProps} />);
    expect(screen.getByTestId('qr-code')).toBeInTheDocument();
  });

  test('Shows the app URL', () => {
    render(<QRCodeModal {...defaultProps} />);
    expect(screen.getByText(TEST_URL)).toBeInTheDocument();
  });

  test('Shows Scan to download the app subtitle', () => {
    render(<QRCodeModal {...defaultProps} />);
    expect(screen.getByText('Scan to download the app')).toBeInTheDocument();
  });

  test('Shows how to use instructions', () => {
    render(<QRCodeModal {...defaultProps} />);
    expect(screen.getByText('Open your phone\'s camera app')).toBeInTheDocument();
  });

  test('Shows Download QR button', () => {
    render(<QRCodeModal {...defaultProps} />);
    expect(screen.getByText('Download QR')).toBeInTheDocument();
  });

  test('Shows Copy Link button', () => {
    render(<QRCodeModal {...defaultProps} />);
    expect(screen.getByText('Copy Link')).toBeInTheDocument();
  });

  test('Shows WhatsApp share button', () => {
    render(<QRCodeModal {...defaultProps} />);
    expect(screen.getByTitle('Share on WhatsApp')).toBeInTheDocument();
  });

  test('Shows Email share button', () => {
    render(<QRCodeModal {...defaultProps} />);
    expect(screen.getByTitle('Share via Email')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Actions
// ---------------------------------------------------------------------------

describe('QRCodeModal - Actions', () => {

  test('Calls onClose when X button is clicked', () => {
  render(<QRCodeModal {...defaultProps} />);
  // X close button is the first button in the header
  const buttons = screen.getAllByRole('button');
  fireEvent.click(buttons[0]);
  expect(mockOnClose).toHaveBeenCalledTimes(1);
});

  test('Copies URL to clipboard when Copy Link is clicked', async () => {
    render(<QRCodeModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Copy Link'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(TEST_URL);
  });

  test('Shows Copied! after copying', async () => {
    jest.useFakeTimers();
    render(<QRCodeModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Copy Link'));
    await waitFor(() =>
      expect(screen.getByText('Copied!')).toBeInTheDocument()
    );
    jest.useRealTimers();
  });

  test('Copy Link reverts back after 2 seconds', async () => {
    jest.useFakeTimers();
    render(<QRCodeModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Copy Link'));
    await waitFor(() => screen.getByText('Copied!'));
    act(() => jest.advanceTimersByTime(2500));
    await waitFor(() =>
      expect(screen.getByText('Copy Link')).toBeInTheDocument()
    );
    jest.useRealTimers();
  });

  test('Opens WhatsApp share link when WhatsApp button is clicked', () => {
    render(<QRCodeModal {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Share on WhatsApp'));
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('wa.me'),
      '_blank'
    );
  });

  test('Opens email share when Email button is clicked', () => {
    render(<QRCodeModal {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Share via Email'));
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('mailto:'),
      '_blank'
    );
  });
});
