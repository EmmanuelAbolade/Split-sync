// src/components/ShareInviteModal.test.jsx
// Tests for ShareInviteModal - rendering, copy, share options, QR toggle, close

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock QRCodeCanvas to avoid canvas errors in jsdom
jest.mock('./QRCodeCanvas', () => () => <div data-testid="qr-code-canvas" />);

import ShareInviteModal from './ShareInviteModal';

// ---------------------------------------------------------------------------
// Shared props
// ---------------------------------------------------------------------------

const defaultProps = {
  isOpen:     true,
  onClose:    jest.fn(),
  inviteLink: 'https://splitsync.app/invite/abc123',
  groupName:  'Weekend Trip',
};

beforeEach(() => {
  jest.clearAllMocks();

  // Mock clipboard API
  Object.defineProperty(navigator, 'clipboard', {
    value:      { writeText: jest.fn().mockResolvedValue(undefined) },
    writable:   true,
    configurable: true,
  });

  // Ensure navigator.share is not defined by default
  Object.defineProperty(navigator, 'share', {
    value:      undefined,
    writable:   true,
    configurable: true,
  });
});

// ---------------------------------------------------------------------------
// 1. Visibility
// ---------------------------------------------------------------------------

describe('ShareInviteModal - Visibility', () => {

  test('Renders when isOpen is true', () => {
    render(<ShareInviteModal {...defaultProps} />);
    expect(screen.getByText('Share Invite Link')).toBeInTheDocument();
  });

  test('Does not render when isOpen is false', () => {
    render(<ShareInviteModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Share Invite Link')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Content
// ---------------------------------------------------------------------------

describe('ShareInviteModal - Content', () => {

  test('Shows invite link in readonly input', () => {
    render(<ShareInviteModal {...defaultProps} />);
    const input = screen.getByDisplayValue('https://splitsync.app/invite/abc123');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('readonly');
  });

  test('Shows Copy button', () => {
    render(<ShareInviteModal {...defaultProps} />);
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  test('Shows WhatsApp option', () => {
    render(<ShareInviteModal {...defaultProps} />);
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
  });

  test('Shows Text Message option', () => {
    render(<ShareInviteModal {...defaultProps} />);
    expect(screen.getByText('Text Message')).toBeInTheDocument();
  });

  test('Shows Email option', () => {
    render(<ShareInviteModal {...defaultProps} />);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  test('Shows QR Code option', () => {
    render(<ShareInviteModal {...defaultProps} />);
    expect(screen.getByText('QR Code')).toBeInTheDocument();
  });

  test('Shows Close button in footer', () => {
    render(<ShareInviteModal {...defaultProps} />);
    // There are two close triggers - the X button and the footer Close button
    expect(screen.getByText('Close')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Close behaviour
// ---------------------------------------------------------------------------

describe('ShareInviteModal - Close', () => {

  test('Calls onClose when footer Close button is clicked', () => {
    const onClose = jest.fn();
    render(<ShareInviteModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('Calls onClose when X icon button is clicked', () => {
    const onClose = jest.fn();
    render(<ShareInviteModal {...defaultProps} onClose={onClose} />);
    // X button is the first button (header)
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 4. Copy behaviour
// ---------------------------------------------------------------------------

describe('ShareInviteModal - Copy', () => {

  test('Calls clipboard.writeText with invite link when Copy is clicked', async () => {
    render(<ShareInviteModal {...defaultProps} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Copy'));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://splitsync.app/invite/abc123'
    );
  });

  test('Shows Copied! feedback after successful copy', async () => {
    render(<ShareInviteModal {...defaultProps} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Copy'));
    });
    await waitFor(() =>
      expect(screen.getByText('Copied!')).toBeInTheDocument()
    );
  });

  test('Falls back to prompt when clipboard is unavailable', async () => {
    // Remove clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value:      undefined,
      writable:   true,
      configurable: true,
    });
    const mockPrompt = jest.spyOn(window, 'prompt').mockImplementation(() => null);

    render(<ShareInviteModal {...defaultProps} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Copy'));
    });
    expect(mockPrompt).toHaveBeenCalledWith(
      'Copy this link:',
      'https://splitsync.app/invite/abc123'
    );
    mockPrompt.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 5. QR Code toggle
// ---------------------------------------------------------------------------

describe('ShareInviteModal - QR Code', () => {

  test('QR code canvas is hidden by default', () => {
    render(<ShareInviteModal {...defaultProps} />);
    expect(screen.queryByTestId('qr-code-canvas')).not.toBeInTheDocument();
  });

  test('Shows QR code canvas when QR Code button is clicked', () => {
    render(<ShareInviteModal {...defaultProps} />);
    fireEvent.click(screen.getByText('QR Code'));
    expect(screen.getByTestId('qr-code-canvas')).toBeInTheDocument();
  });

  test('Shows Scan to join group text when QR is visible', () => {
    render(<ShareInviteModal {...defaultProps} />);
    fireEvent.click(screen.getByText('QR Code'));
    expect(screen.getByText('Scan to join group')).toBeInTheDocument();
  });

  test('Hides QR code canvas when QR Code button is clicked again', () => {
    render(<ShareInviteModal {...defaultProps} />);
    fireEvent.click(screen.getByText('QR Code'));
    fireEvent.click(screen.getByText('QR Code'));
    expect(screen.queryByTestId('qr-code-canvas')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 6. WhatsApp / SMS / Email handlers
// ---------------------------------------------------------------------------

describe('ShareInviteModal - Share handlers', () => {

  test('Opens WhatsApp URL in new tab when WhatsApp is clicked', () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    render(<ShareInviteModal {...defaultProps} />);
    fireEvent.click(screen.getByText('WhatsApp'));
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('wa.me'),
      '_blank'
    );
    openSpy.mockRestore();
  });

  test('Sets window.location.href for SMS when Text Message is clicked', () => {
    const originalHref = window.location.href;
    delete window.location;
    window.location = { href: '' };

    render(<ShareInviteModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Text Message'));
    expect(window.location.href).toContain('sms:');

    window.location.href = originalHref;
  });

  test('Sets window.location.href for email when Email is clicked', () => {
    delete window.location;
    window.location = { href: '' };

    render(<ShareInviteModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Email'));
    expect(window.location.href).toContain('mailto:');
  });
});

// ---------------------------------------------------------------------------
// 7. Native share (when available)
// ---------------------------------------------------------------------------

describe('ShareInviteModal - Native share', () => {

  test('Shows More Options button when navigator.share is available', () => {
    Object.defineProperty(navigator, 'share', {
      value:      jest.fn().mockResolvedValue(undefined),
      writable:   true,
      configurable: true,
    });
    render(<ShareInviteModal {...defaultProps} />);
    expect(screen.getByText('More Options')).toBeInTheDocument();
  });

  test('Does not show More Options button when navigator.share is unavailable', () => {
    Object.defineProperty(navigator, 'share', {
      value:      undefined,
      writable:   true,
      configurable: true,
    });
    render(<ShareInviteModal {...defaultProps} />);
    expect(screen.queryByText('More Options')).not.toBeInTheDocument();
  });

  test('Calls navigator.share with correct data when More Options is clicked', async () => {
    const mockShare = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value:      mockShare,
      writable:   true,
      configurable: true,
    });

    render(<ShareInviteModal {...defaultProps} />);
    await act(async () => {
      fireEvent.click(screen.getByText('More Options'));
    });
    expect(mockShare).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://splitsync.app/invite/abc123',
    }));
  });
});
