// src/components/DarkModeToggle.test.jsx
// Test suite for DarkModeToggle component
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DarkModeToggle from './DarkModeToggle';

// Mock the DarkModeContext
const mockToggleDarkMode = jest.fn();
jest.mock('../contexts/DarkModeContext', () => ({
  useDarkMode: () => ({
    isDarkMode: false,
    toggleDarkMode: mockToggleDarkMode,
  }),
}));

describe('DarkModeToggle Component - Light Mode', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock to return light mode
    require('../contexts/DarkModeContext').useDarkMode = () => ({
      isDarkMode: false,
      toggleDarkMode: mockToggleDarkMode,
    });
  });

  test('Renders dark mode toggle button', () => {
    render(<DarkModeToggle />);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  test('Shows "Dark Mode" label', () => {
    render(<DarkModeToggle />);
    
    expect(screen.getByText('Dark Mode')).toBeInTheDocument();
  });

  test('Shows "Disabled" status in light mode', () => {
    render(<DarkModeToggle />);
    
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  test('Shows Sun icon in light mode', () => {
    const { container } = render(<DarkModeToggle />);
    
    // Sun icon should be present
    const sunIcon = container.querySelector('.lucide-sun');
    expect(sunIcon).toBeInTheDocument();
  });

  test('Calls toggleDarkMode when clicked', () => {
    render(<DarkModeToggle />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(mockToggleDarkMode).toHaveBeenCalledTimes(1);
  });

  test('Button is clickable', () => {
    render(<DarkModeToggle />);
    
    const button = screen.getByRole('button');
    expect(button).not.toBeDisabled();
  });
});

describe('DarkModeToggle Component - Dark Mode', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock to return dark mode
    require('../contexts/DarkModeContext').useDarkMode = () => ({
      isDarkMode: true,
      toggleDarkMode: mockToggleDarkMode,
    });
  });

  test('Shows "Enabled" status in dark mode', () => {
    render(<DarkModeToggle />);
    
    expect(screen.getByText('Enabled')).toBeInTheDocument();
  });

  test('Shows Moon icon in dark mode', () => {
    const { container } = render(<DarkModeToggle />);
    
    // Moon icon should be present
    const moonIcon = container.querySelector('.lucide-moon');
    expect(moonIcon).toBeInTheDocument();
  });

  test('Calls toggleDarkMode when clicked in dark mode', () => {
    render(<DarkModeToggle />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(mockToggleDarkMode).toHaveBeenCalledTimes(1);
  });

  test('Renders toggle switch', () => {
    const { container } = render(<DarkModeToggle />);
    
    // Check for toggle switch elements
    const toggleSwitch = container.querySelector('.w-14.h-8');
    expect(toggleSwitch).toBeInTheDocument();
  });
});

describe('DarkModeToggle Component - Interaction', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    require('../contexts/DarkModeContext').useDarkMode = () => ({
      isDarkMode: false,
      toggleDarkMode: mockToggleDarkMode,
    });
  });

  test('Multiple clicks call toggle multiple times', () => {
    render(<DarkModeToggle />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    
    expect(mockToggleDarkMode).toHaveBeenCalledTimes(3);
  });

  test('Button has proper structure', () => {
    const { container } = render(<DarkModeToggle />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('w-full');
  });
});

describe('DarkModeToggle Component - Accessibility', () => {
  
  test('Button is keyboard accessible', () => {
    render(<DarkModeToggle />);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  test('Has readable text content', () => {
    render(<DarkModeToggle />);
    
    expect(screen.getByText('Dark Mode')).toBeVisible();
  });
});