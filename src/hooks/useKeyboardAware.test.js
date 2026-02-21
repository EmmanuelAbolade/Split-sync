// src/hooks/useKeyboardAware.test.js
// Test suite for useKeyboardAware hook - keyboard scroll behaviour for input fields

import { renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { useKeyboardAware } from './useKeyboardAware';

// ─────────────────────────────────────────────────────────────────────────────

describe('useKeyboardAware - No-op when ref is null or empty', () => {

  test('Does not throw when inputRef is null', () => {
    expect(() => {
      renderHook(() => useKeyboardAware(null));
    }).not.toThrow();
  });

  test('Does not throw when inputRef.current is null', () => {
    const ref = { current: null };
    expect(() => {
      renderHook(() => useKeyboardAware(ref));
    }).not.toThrow();
  });

  test('Does not throw when inputRef is undefined', () => {
    expect(() => {
      renderHook(() => useKeyboardAware(undefined));
    }).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('useKeyboardAware - Event listener registration', () => {

  let mockElement;

  beforeEach(() => {
    jest.useFakeTimers();
    mockElement = {
      addEventListener:    jest.fn(),
      removeEventListener: jest.fn(),
      scrollIntoView:      jest.fn(),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('Adds focus event listener to the input element', () => {
    const ref = { current: mockElement };
    renderHook(() => useKeyboardAware(ref));
    expect(mockElement.addEventListener).toHaveBeenCalledWith(
      'focus',
      expect.any(Function)
    );
  });

  test('Adds exactly one event listener', () => {
    const ref = { current: mockElement };
    renderHook(() => useKeyboardAware(ref));
    expect(mockElement.addEventListener).toHaveBeenCalledTimes(1);
  });

  test('Removes focus event listener on unmount', () => {
    const ref = { current: mockElement };
    const { unmount } = renderHook(() => useKeyboardAware(ref));
    unmount();
    expect(mockElement.removeEventListener).toHaveBeenCalledWith(
      'focus',
      expect.any(Function)
    );
  });

  test('Removes the same handler that was added', () => {
    const ref = { current: mockElement };
    const { unmount } = renderHook(() => useKeyboardAware(ref));

    const addedHandler    = mockElement.addEventListener.mock.calls[0][1];
    const removedHandler  = mockElement.removeEventListener.mock.calls[0]?.[1];

    unmount();
    const removedHandler2 = mockElement.removeEventListener.mock.calls[0][1];
    expect(addedHandler).toBe(removedHandler2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('useKeyboardAware - Focus handler behaviour', () => {

  let mockElement;

  beforeEach(() => {
    jest.useFakeTimers();
    mockElement = {
      addEventListener:    jest.fn(),
      removeEventListener: jest.fn(),
      scrollIntoView:      jest.fn(),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('Does not call scrollIntoView immediately on focus', () => {
    const ref = { current: mockElement };
    renderHook(() => useKeyboardAware(ref));

    const focusHandler = mockElement.addEventListener.mock.calls[0][1];
    focusHandler();

    expect(mockElement.scrollIntoView).not.toHaveBeenCalled();
  });

  test('Calls scrollIntoView after 300ms timeout', () => {
    const ref = { current: mockElement };
    renderHook(() => useKeyboardAware(ref));

    const focusHandler = mockElement.addEventListener.mock.calls[0][1];
    focusHandler();

    jest.advanceTimersByTime(300);
    expect(mockElement.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  test('Does not call scrollIntoView before 300ms', () => {
    const ref = { current: mockElement };
    renderHook(() => useKeyboardAware(ref));

    const focusHandler = mockElement.addEventListener.mock.calls[0][1];
    focusHandler();

    jest.advanceTimersByTime(299);
    expect(mockElement.scrollIntoView).not.toHaveBeenCalled();
  });

  test('Calls scrollIntoView with smooth behaviour and center block', () => {
    const ref = { current: mockElement };
    renderHook(() => useKeyboardAware(ref));

    const focusHandler = mockElement.addEventListener.mock.calls[0][1];
    focusHandler();

    jest.advanceTimersByTime(300);
    expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });
  });

  test('Does not throw if ref.current is null when timer fires', () => {
    const ref = { current: mockElement };
    renderHook(() => useKeyboardAware(ref));

    const focusHandler = mockElement.addEventListener.mock.calls[0][1];
    focusHandler();

    // Simulate element being removed from DOM before timer fires
    ref.current = null;

    expect(() => jest.advanceTimersByTime(300)).not.toThrow();
  });

  test('Handles multiple focus events correctly', () => {
    const ref = { current: mockElement };
    renderHook(() => useKeyboardAware(ref));

    const focusHandler = mockElement.addEventListener.mock.calls[0][1];

    focusHandler();
    jest.advanceTimersByTime(300);

    focusHandler();
    jest.advanceTimersByTime(300);

    expect(mockElement.scrollIntoView).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('useKeyboardAware - Cleanup on unmount', () => {

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('Cleans up event listener when component unmounts', () => {
    const mockElement = {
      addEventListener:    jest.fn(),
      removeEventListener: jest.fn(),
      scrollIntoView:      jest.fn(),
    };
    const ref = { current: mockElement };

    const { unmount } = renderHook(() => useKeyboardAware(ref));
    unmount();

    expect(mockElement.removeEventListener).toHaveBeenCalledWith(
      'focus',
      expect.any(Function)
    );
    expect(mockElement.removeEventListener).toHaveBeenCalledTimes(1);
  });
});