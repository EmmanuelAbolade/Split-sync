// src/components/QRCodeCanvas.test.jsx
// Test suite for QRCodeCanvas component - QR code generation and display

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import QRCodeCanvas from './QRCodeCanvas';

// ─── Mock: qrcode library ─────────────────────────────────────────────────────
const mockToCanvas = jest.fn((canvas, value, options, callback) => {
  if (callback) callback(null); // simulate success
});

jest.mock('qrcode', () => ({
  toCanvas: (...args) => mockToCanvas(...args),
}));

// ─────────────────────────────────────────────────────────────────────────────

describe('QRCodeCanvas Component - Rendering', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Renders the wrapper div', () => {
    const { container } = render(<QRCodeCanvas value="https://example.com" />);
    const wrapper = container.querySelector('.inline-block');
    expect(wrapper).toBeInTheDocument();
  });

  test('Renders a canvas element', () => {
    const { container } = render(<QRCodeCanvas value="https://example.com" />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  test('Wrapper has light and dark mode classes', () => {
    const { container } = render(<QRCodeCanvas value="https://example.com" />);
    const wrapper = container.querySelector('.inline-block');
    expect(wrapper).toHaveClass('bg-white');
    expect(wrapper).toHaveClass('dark:bg-gray-800');
  });

  test('Wrapper has padding and rounded corners', () => {
    const { container } = render(<QRCodeCanvas value="https://example.com" />);
    const wrapper = container.querySelector('.p-4');
    expect(wrapper).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('QRCodeCanvas Component - QR Code Generation', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Calls QRCode.toCanvas when value is provided', async () => {
    render(<QRCodeCanvas value="https://example.com" />);
    await waitFor(() => {
      expect(mockToCanvas).toHaveBeenCalledTimes(1);
    });
  });

  test('Does NOT call QRCode.toCanvas when value is empty', async () => {
    render(<QRCodeCanvas value="" />);
    await waitFor(() => {
      expect(mockToCanvas).not.toHaveBeenCalled();
    });
  });

  test('Does NOT call QRCode.toCanvas when value is undefined', async () => {
    render(<QRCodeCanvas value={undefined} />);
    await waitFor(() => {
      expect(mockToCanvas).not.toHaveBeenCalled();
    });
  });

  test('Passes the correct value to QRCode.toCanvas', async () => {
    const testValue = 'https://split-sync.app/join/abc123';
    render(<QRCodeCanvas value={testValue} />);
    await waitFor(() => {
      expect(mockToCanvas).toHaveBeenCalledWith(
        expect.any(Object), // canvas ref
        testValue,
        expect.any(Object), // options
        expect.any(Function) // callback
      );
    });
  });

  test('Uses default size of 200 when size prop is not provided', async () => {
    render(<QRCodeCanvas value="https://example.com" />);
    await waitFor(() => {
      const options = mockToCanvas.mock.calls[0][2];
      expect(options.width).toBe(200);
    });
  });

  test('Uses custom size when size prop is provided', async () => {
    render(<QRCodeCanvas value="https://example.com" size={300} />);
    await waitFor(() => {
      const options = mockToCanvas.mock.calls[0][2];
      expect(options.width).toBe(300);
    });
  });

  test('Passes correct colour options for dark pixels', async () => {
    render(<QRCodeCanvas value="https://example.com" />);
    await waitFor(() => {
      const options = mockToCanvas.mock.calls[0][2];
      expect(options.color.dark).toBe('#3B82F6');
    });
  });

  test('Passes correct colour options for light pixels', async () => {
    render(<QRCodeCanvas value="https://example.com" />);
    await waitFor(() => {
      const options = mockToCanvas.mock.calls[0][2];
      expect(options.color.light).toBe('#FFFFFF');
    });
  });

  test('Passes margin option of 2', async () => {
    render(<QRCodeCanvas value="https://example.com" />);
    await waitFor(() => {
      const options = mockToCanvas.mock.calls[0][2];
      expect(options.margin).toBe(2);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('QRCodeCanvas Component - Error Handling', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Handles QR code generation error gracefully', async () => {
    // Mock toCanvas to call callback with an error
    mockToCanvas.mockImplementationOnce((canvas, value, options, callback) => {
      if (callback) callback(new Error('QR generation failed'));
    });

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<QRCodeCanvas value="https://example.com" />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'QR Code generation failed:',
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });

  test('Component still renders canvas even when generation fails', async () => {
    mockToCanvas.mockImplementationOnce((canvas, value, options, callback) => {
      if (callback) callback(new Error('Failed'));
    });

    jest.spyOn(console, 'error').mockImplementation(() => {});

    const { container } = render(<QRCodeCanvas value="https://example.com" />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('QRCodeCanvas Component - Prop Changes', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Re-generates QR code when value changes', async () => {
    const { rerender } = render(<QRCodeCanvas value="https://example.com" />);

    await waitFor(() => expect(mockToCanvas).toHaveBeenCalledTimes(1));

    rerender(<QRCodeCanvas value="https://new-url.com" />);

    await waitFor(() => expect(mockToCanvas).toHaveBeenCalledTimes(2));
  });

  test('Re-generates QR code when size changes', async () => {
    const { rerender } = render(<QRCodeCanvas value="https://example.com" size={200} />);

    await waitFor(() => expect(mockToCanvas).toHaveBeenCalledTimes(1));

    rerender(<QRCodeCanvas value="https://example.com" size={300} />);

    await waitFor(() => expect(mockToCanvas).toHaveBeenCalledTimes(2));
  });

  test('Does not call toCanvas when value changes to empty string', async () => {
    const { rerender } = render(<QRCodeCanvas value="https://example.com" />);

    await waitFor(() => expect(mockToCanvas).toHaveBeenCalledTimes(1));
    mockToCanvas.mockClear();

    rerender(<QRCodeCanvas value="" />);

    // No additional call expected
    await waitFor(() => expect(mockToCanvas).not.toHaveBeenCalled());
  });

  test('Updated value is passed correctly to toCanvas', async () => {
    const { rerender } = render(<QRCodeCanvas value="https://first.com" />);
    await waitFor(() => expect(mockToCanvas).toHaveBeenCalledTimes(1));

    rerender(<QRCodeCanvas value="https://second.com" />);

    await waitFor(() => {
      const lastCall = mockToCanvas.mock.calls[mockToCanvas.mock.calls.length - 1];
      expect(lastCall[1]).toBe('https://second.com');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('QRCodeCanvas Component - Various Value Types', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Generates QR code for a URL', async () => {
    render(<QRCodeCanvas value="https://split-sync.app" />);
    await waitFor(() => {
      expect(mockToCanvas).toHaveBeenCalledWith(
        expect.any(Object),
        'https://split-sync.app',
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  test('Generates QR code for plain text', async () => {
    render(<QRCodeCanvas value="Hello, Split-Sync!" />);
    await waitFor(() => {
      expect(mockToCanvas).toHaveBeenCalledTimes(1);
    });
  });

  test('Generates QR code for a group invite link', async () => {
    render(<QRCodeCanvas value="https://split-sync.app/join/group-abc-123" />);
    await waitFor(() => {
      const callValue = mockToCanvas.mock.calls[0][1];
      expect(callValue).toContain('join');
    });
  });

  test('Generates QR code for a long string', async () => {
    const longValue = 'https://split-sync.app/join/' + 'x'.repeat(100);
    render(<QRCodeCanvas value={longValue} />);
    await waitFor(() => {
      expect(mockToCanvas).toHaveBeenCalledTimes(1);
    });
  });
});