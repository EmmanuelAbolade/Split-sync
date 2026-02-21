// src/contexts/DarkModeContext.test.jsx
// Test suite for DarkModeContext - dark mode state, persistence, and DOM class management

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DarkModeProvider, useDarkMode } from './DarkModeContext';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem:    (key)        => store[key] ?? null,
    setItem:    (key, value) => { store[key] = String(value); },
    removeItem: (key)        => { delete store[key]; },
    clear:      ()           => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock window.matchMedia
const mockMatchMedia = jest.fn();
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
});

// ─── Test consumer component ──────────────────────────────────────────────────
// Simple component that consumes the context so we can assert on values
function TestConsumer() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  return (
    <div>
      <span data-testid="mode">{isDarkMode ? 'dark' : 'light'}</span>
      <button onClick={toggleDarkMode}>Toggle</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

describe('DarkModeContext - Initialisation from localStorage', () => {

  beforeEach(() => {
    localStorageMock.clear();
    mockMatchMedia.mockReturnValue({ matches: false });
    document.documentElement.classList.remove('dark');
  });

  test('Defaults to light mode when localStorage is empty and system is light', () => {
    render(<DarkModeProvider><TestConsumer /></DarkModeProvider>);
    expect(screen.getByTestId('mode').textContent).toBe('light');
  });

  test('Initialises as dark when localStorage has darkMode=true', () => {
    localStorageMock.setItem('darkMode', 'true');
    render(<DarkModeProvider><TestConsumer /></DarkModeProvider>);
    expect(screen.getByTestId('mode').textContent).toBe('dark');
  });

  test('Initialises as light when localStorage has darkMode=false', () => {
    localStorageMock.setItem('darkMode', 'false');
    render(<DarkModeProvider><TestConsumer /></DarkModeProvider>);
    expect(screen.getByTestId('mode').textContent).toBe('light');
  });

  test('Reads system preference when localStorage is empty and system prefers dark', () => {
    mockMatchMedia.mockReturnValue({ matches: true });
    render(<DarkModeProvider><TestConsumer /></DarkModeProvider>);
    expect(screen.getByTestId('mode').textContent).toBe('dark');
  });

  test('Prefers localStorage value over system preference', () => {
    localStorageMock.setItem('darkMode', 'false');
    mockMatchMedia.mockReturnValue({ matches: true }); // system says dark
    render(<DarkModeProvider><TestConsumer /></DarkModeProvider>);
    expect(screen.getByTestId('mode').textContent).toBe('light');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('DarkModeContext - Toggle behaviour', () => {

  beforeEach(() => {
    localStorageMock.clear();
    mockMatchMedia.mockReturnValue({ matches: false });
    document.documentElement.classList.remove('dark');
  });

  test('Toggles from light to dark on button click', () => {
    render(<DarkModeProvider><TestConsumer /></DarkModeProvider>);
    expect(screen.getByTestId('mode').textContent).toBe('light');
    fireEvent.click(screen.getByText('Toggle'));
    expect(screen.getByTestId('mode').textContent).toBe('dark');
  });

  test('Toggles from dark back to light on second click', () => {
    localStorageMock.setItem('darkMode', 'true');
    render(<DarkModeProvider><TestConsumer /></DarkModeProvider>);
    fireEvent.click(screen.getByText('Toggle'));
    expect(screen.getByTestId('mode').textContent).toBe('light');
  });

  test('Multiple toggles alternate correctly', () => {
    render(<DarkModeProvider><TestConsumer /></DarkModeProvider>);
    const btn = screen.getByText('Toggle');
    fireEvent.click(btn); // light → dark
    expect(screen.getByTestId('mode').textContent).toBe('dark');
    fireEvent.click(btn); // dark → light
    expect(screen.getByTestId('mode').textContent).toBe('light');
    fireEvent.click(btn); // light → dark
    expect(screen.getByTestId('mode').textContent).toBe('dark');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('DarkModeContext - localStorage persistence', () => {

  beforeEach(() => {
    localStorageMock.clear();
    mockMatchMedia.mockReturnValue({ matches: false });
    document.documentElement.classList.remove('dark');
  });

  test('Persists dark mode to localStorage after toggle', () => {
    render(<DarkModeProvider><TestConsumer /></DarkModeProvider>);
    fireEvent.click(screen.getByText('Toggle'));
    expect(localStorageMock.getItem('darkMode')).toBe('true');
  });

  test('Persists light mode to localStorage after toggling back', () => {
    localStorageMock.setItem('darkMode', 'true');
    render(<DarkModeProvider><TestConsumer /></DarkModeProvider>);
    fireEvent.click(screen.getByText('Toggle'));
    expect(localStorageMock.getItem('darkMode')).toBe('false');
  });

  test('Writes to localStorage on initial render', () => {
    render(<DarkModeProvider><TestConsumer /></DarkModeProvider>);
    expect(localStorageMock.getItem('darkMode')).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('DarkModeContext - DOM class management', () => {

  beforeEach(() => {
    localStorageMock.clear();
    mockMatchMedia.mockReturnValue({ matches: false });
    document.documentElement.classList.remove('dark');
  });

  test('Adds "dark" class to documentElement when dark mode is enabled', () => {
    localStorageMock.setItem('darkMode', 'true');
    render(<DarkModeProvider><TestConsumer /></DarkModeProvider>);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  test('Does not add "dark" class when light mode is active', () => {
    render(<DarkModeProvider><TestConsumer /></DarkModeProvider>);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  test('Adds "dark" class after toggling to dark', () => {
    render(<DarkModeProvider><TestConsumer /></DarkModeProvider>);
    fireEvent.click(screen.getByText('Toggle'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  test('Removes "dark" class after toggling back to light', () => {
    localStorageMock.setItem('darkMode', 'true');
    render(<DarkModeProvider><TestConsumer /></DarkModeProvider>);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    fireEvent.click(screen.getByText('Toggle'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('DarkModeContext - Context provision', () => {

  beforeEach(() => {
    localStorageMock.clear();
    mockMatchMedia.mockReturnValue({ matches: false });
  });

  test('Provides isDarkMode value to consumers', () => {
    render(<DarkModeProvider><TestConsumer /></DarkModeProvider>);
    expect(screen.getByTestId('mode')).toBeInTheDocument();
  });

  test('Provides toggleDarkMode function to consumers', () => {
    render(<DarkModeProvider><TestConsumer /></DarkModeProvider>);
    expect(screen.getByText('Toggle')).toBeInTheDocument();
  });

  test('Renders children correctly', () => {
    render(
      <DarkModeProvider>
        <span data-testid="child">Child content</span>
      </DarkModeProvider>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  test('Throws error when useDarkMode is used outside DarkModeProvider', () => {
    // Suppress expected error output
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      'useDarkMode must be used within DarkModeProvider'
    );
    consoleSpy.mockRestore();
  });
});