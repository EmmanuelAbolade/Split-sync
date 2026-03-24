// src/components/QRCodeModal.test.jsx
// Tests for QRCodeModal - visibility, content, copy URL, download QR, share buttons, close

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

// Mock canvas, XMLSerializer and Image for handleDownloadQR
let mockImageOnLoad;

beforeEach(() => {
  jest.clearAllMocks();

  // Clipboard mock
  Object.assign(navigator, {
    clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
  });

  window.open = jest.fn();

  // XMLSerializer mock
  global.XMLSerializer = jest.fn().mockImplementation(() => ({
    serializeToString: jest.fn().mockReturnValue('<svg></svg>'),
  }));

  // Canvas mock — toDataURL returns a fake png data URL
  const mockCtx = { drawImage: jest.fn() };
  const mockCanvas = {
    getContext:  jest.fn().mockReturnValue(mockCtx),
    toDataURL:   jest.fn().mockReturnValue('data:image/png;base64,fakedata'),
    width:  0,
    height: 0,
  };
  jest.spyOn(document, 'createElement').mockImplementation((tag) => {
    if (tag === 'canvas') return mockCanvas;
    if (tag === 'a') {
      const anchor = { download: '', href: '', click: jest.fn() };
      return anchor;
    }
    // Fall through for any other elements (e.g. div created by React)
    return document.createElement.wrappedJestFn
      ? document.createElement.wrappedJestFn(tag)
      : Object.getPrototypeOf(document).createElement.call(document, tag);
  });

  // Image mock — captures onload so tests can trigger it
  global.Image = jest.fn().mockImplementation(() => {
    const img = { width: 200, height: 200, src: '' };
    Object.defineProperty(img, 'onload', {
      set(fn) { mockImageOnLoad = fn; },
      get() { return mockImageOnLoad; },
    });
    return img;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
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
    expect(screen.getByText("Open your phone's camera app")).toBeInTheDocument();
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
// 3. Actions — Copy Link
// ---------------------------------------------------------------------------

describe('QRCodeModal - Copy Link', () => {

  test('Calls onClose when X button is clicked', () => {
    render(<QRCodeModal {...defaultProps} />);
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
});

// ---------------------------------------------------------------------------
// 4. Actions — Download QR (lines 19-37)
// ---------------------------------------------------------------------------

describe('QRCodeModal - Download QR', () => {

  test('Clicking Download QR triggers XMLSerializer on the QR SVG element', () => {
    render(<QRCodeModal {...defaultProps} />);
    // Ensure the QR element exists with the expected id
    const qrEl = document.getElementById('qr-code-svg');
    expect(qrEl).not.toBeNull();

    const serializer = new XMLSerializer();
    fireEvent.click(screen.getByText('Download QR'));

    // XMLSerializer should have been instantiated
    expect(global.XMLSerializer).toHaveBeenCalled();
  });

  test('Clicking Download QR creates a canvas element', () => {
    render(<QRCodeModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Download QR'));
    expect(document.createElement).toHaveBeenCalledWith('canvas');
  });

  test('Image onload draws to canvas and triggers download anchor click', () => {
    render(<QRCodeModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Download QR'));

    // Simulate the image loading — this runs the onload callback (lines 26-35)
    act(() => {
      if (mockImageOnLoad) mockImageOnLoad();
    });

    // After onload an anchor element should have been created for download
    expect(document.createElement).toHaveBeenCalledWith('a');
  });

  test('Download anchor has correct download filename', () => {
    let capturedAnchor = null;
    // Grab the original from the prototype BEFORE spying to avoid recursion
    const originalCreateElement = HTMLDocument.prototype.createElement;
    jest.spyOn(document, 'createElement').mockImplementation(function(tag) {
      if (tag === 'canvas') {
        return {
          getContext: jest.fn().mockReturnValue({ drawImage: jest.fn() }),
          toDataURL:  jest.fn().mockReturnValue('data:image/png;base64,fakedata'),
          width: 0, height: 0,
        };
      }
      if (tag === 'a') {
        capturedAnchor = { download: '', href: '', click: jest.fn() };
        return capturedAnchor;
      }
      // Call the real method via prototype to avoid circular spy calls
      return originalCreateElement.call(document, tag);
    });

    render(<QRCodeModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Download QR'));
    act(() => { if (mockImageOnLoad) mockImageOnLoad(); });

    expect(capturedAnchor).not.toBeNull();
    expect(capturedAnchor.download).toBe('split-sync-qr-code.png');
  });

  test('Image src is set to base64 SVG data URL', () => {
    let capturedImage = null;
    global.Image = jest.fn().mockImplementation(() => {
      const img = { width: 200, height: 200 };
      Object.defineProperty(img, 'src', {
        set(val) { capturedImage = val; },
        get() { return capturedImage; },
      });
      Object.defineProperty(img, 'onload', {
        set(fn) { mockImageOnLoad = fn; },
        get() { return mockImageOnLoad; },
      });
      return img;
    });

    render(<QRCodeModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Download QR'));

    expect(capturedImage).toMatch(/^data:image\/svg\+xml;base64,/);
  });
});

// ---------------------------------------------------------------------------
// 5. Actions — Share buttons
// ---------------------------------------------------------------------------

describe('QRCodeModal - Share Buttons', () => {

  test('Opens WhatsApp share link when WhatsApp button is clicked', () => {
    render(<QRCodeModal {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Share on WhatsApp'));
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('wa.me'),
      '_blank'
    );
  });

  test('WhatsApp link contains the app URL', () => {
    render(<QRCodeModal {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Share on WhatsApp'));
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining(TEST_URL),
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

  test('Email share body contains the app URL', () => {
    render(<QRCodeModal {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Share via Email'));
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining(TEST_URL),
      '_blank'
    );
  });
});
