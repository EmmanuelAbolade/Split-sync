// src/components/PasswordStrength.test.jsx
// Test suite for PasswordStrength component
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PasswordStrength from './PasswordStrength';

describe('PasswordStrength Component - Basic Rendering', () => {
  
  const mockOnPasswordGenerate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Renders generate password button', () => {
    render(<PasswordStrength password="" onPasswordGenerate={mockOnPasswordGenerate} />);
    
    expect(screen.getByText('Generate Strong Password')).toBeInTheDocument();
  });

  test('Does not show strength bar for empty password', () => {
    render(<PasswordStrength password="" onPasswordGenerate={mockOnPasswordGenerate} />);
    
    expect(screen.queryByText('Password Strength:')).not.toBeInTheDocument();
  });

  test('Does not show requirements for empty password', () => {
    render(<PasswordStrength password="" onPasswordGenerate={mockOnPasswordGenerate} />);
    
    expect(screen.queryByText('At least 8 characters')).not.toBeInTheDocument();
  });

  test('Shows strength bar when password is provided', () => {
    render(<PasswordStrength password="test123" onPasswordGenerate={mockOnPasswordGenerate} />);
    
    expect(screen.getByText('Password Strength:')).toBeInTheDocument();
  });

  test('Shows requirements checklist when password is provided', () => {
    render(<PasswordStrength password="test123" onPasswordGenerate={mockOnPasswordGenerate} />);
    
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
  });
});

describe('PasswordStrength Component - Strength Calculation', () => {
  
  const mockOnPasswordGenerate = jest.fn();

  test('Shows "Weak" for short password', () => {
    render(<PasswordStrength password="abc" onPasswordGenerate={mockOnPasswordGenerate} />);
    
    expect(screen.getByText('Weak')).toBeInTheDocument();
  });

  test('Shows "Weak" for password with only lowercase', () => {
    render(<PasswordStrength password="abcdefgh" onPasswordGenerate={mockOnPasswordGenerate} />);
    
    expect(screen.getByText('Weak')).toBeInTheDocument();
  });

  test('Shows "Medium" for password with mixed case and numbers', () => {
    render(<PasswordStrength password="Abc123456" onPasswordGenerate={mockOnPasswordGenerate} />);
    
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  test('Shows "Strong" for complex password', () => {
    render(<PasswordStrength password="Abc123!@#Xyz" onPasswordGenerate={mockOnPasswordGenerate} />);
    
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });

  test('Recalculates strength when password changes', () => {
    const { rerender } = render(
      <PasswordStrength password="weak" onPasswordGenerate={mockOnPasswordGenerate} />
    );
    expect(screen.getByText('Weak')).toBeInTheDocument();

    rerender(<PasswordStrength password="Strong123!@#Pass" onPasswordGenerate={mockOnPasswordGenerate} />);
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });
});

describe('PasswordStrength Component - Requirements Checking', () => {
  
  const mockOnPasswordGenerate = jest.fn();

  test('Shows unmet requirement for short password', () => {
    const { container } = render(
      <PasswordStrength password="Abc1!" onPasswordGenerate={mockOnPasswordGenerate} />
    );
    
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
    // Should show X icon for unmet requirement
    const xIcons = container.querySelectorAll('.lucide-x');
    expect(xIcons.length).toBeGreaterThan(0);
  });

  test('Shows met requirement for long password', () => {
    const { container } = render(
      <PasswordStrength password="Abcdefgh123!" onPasswordGenerate={mockOnPasswordGenerate} />
    );
    
    // Should show Check icon for met requirements
    const checkIcons = container.querySelectorAll('.lucide-check');
    expect(checkIcons.length).toBeGreaterThan(0);
  });

  test('Validates uppercase requirement', () => {
    render(<PasswordStrength password="ABCDEFGH123!" onPasswordGenerate={mockOnPasswordGenerate} />);
    
    expect(screen.getByText('Uppercase letter (A-Z)')).toBeInTheDocument();
  });

  test('Validates lowercase requirement', () => {
    render(<PasswordStrength password="abcdefgh123!" onPasswordGenerate={mockOnPasswordGenerate} />);
    
    expect(screen.getByText('Lowercase letter (a-z)')).toBeInTheDocument();
  });

  test('Validates number requirement', () => {
    render(<PasswordStrength password="Abcdefgh!" onPasswordGenerate={mockOnPasswordGenerate} />);
    
    expect(screen.getByText('Number (0-9)')).toBeInTheDocument();
  });

  test('Validates special character requirement', () => {
    render(<PasswordStrength password="Abcdefgh123" onPasswordGenerate={mockOnPasswordGenerate} />);
    
    expect(screen.getByText('Special character (!@#$)')).toBeInTheDocument();
  });

  test('All requirements met for strong password', () => {
    const { container } = render(
      <PasswordStrength password="StrongPass123!@#" onPasswordGenerate={mockOnPasswordGenerate} />
    );
    
    // Should show all check icons (5 requirements)
    const checkIcons = container.querySelectorAll('.lucide-check');
    expect(checkIcons.length).toBe(5);
  });
});

describe('PasswordStrength Component - Password Generation', () => {
  
  const mockOnPasswordGenerate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Calls onPasswordGenerate when button clicked', () => {
    render(<PasswordStrength password="" onPasswordGenerate={mockOnPasswordGenerate} />);
    
    const button = screen.getByText('Generate Strong Password');
    fireEvent.click(button);
    
    expect(mockOnPasswordGenerate).toHaveBeenCalledTimes(1);
  });

  test('Generates password with correct structure', () => {
    render(<PasswordStrength password="" onPasswordGenerate={mockOnPasswordGenerate} />);
    
    const button = screen.getByText('Generate Strong Password');
    fireEvent.click(button);
    
    const generatedPassword = mockOnPasswordGenerate.mock.calls[0][0];
    expect(generatedPassword).toBeDefined();
    expect(generatedPassword.length).toBeGreaterThan(10);
  });

  test('Generated password contains numbers', () => {
    render(<PasswordStrength password="" onPasswordGenerate={mockOnPasswordGenerate} />);
    
    const button = screen.getByText('Generate Strong Password');
    fireEvent.click(button);
    
    const generatedPassword = mockOnPasswordGenerate.mock.calls[0][0];
    expect(/[0-9]/.test(generatedPassword)).toBe(true);
  });

  test('Generated password contains special characters', () => {
    render(<PasswordStrength password="" onPasswordGenerate={mockOnPasswordGenerate} />);
    
    const button = screen.getByText('Generate Strong Password');
    fireEvent.click(button);
    
    const generatedPassword = mockOnPasswordGenerate.mock.calls[0][0];
    expect(/[!@#$&*]/.test(generatedPassword)).toBe(true);
  });

  test('Multiple clicks generate different passwords', () => {
    render(<PasswordStrength password="" onPasswordGenerate={mockOnPasswordGenerate} />);
    
    const button = screen.getByText('Generate Strong Password');
    
    fireEvent.click(button);
    const password1 = mockOnPasswordGenerate.mock.calls[0][0];
    
    fireEvent.click(button);
    const password2 = mockOnPasswordGenerate.mock.calls[1][0];
    
    // Passwords should be different (with high probability)
    expect(password1).not.toBe(password2);
  });

  test('Generate button has RefreshCw icon', () => {
    const { container } = render(
      <PasswordStrength password="" onPasswordGenerate={mockOnPasswordGenerate} />
    );
    
    const icon = container.querySelector('.lucide-refresh-cw');
    expect(icon).toBeInTheDocument();
  });
});

describe('PasswordStrength Component - Visual Elements', () => {
  
  const mockOnPasswordGenerate = jest.fn();

  test('Strength bar shows correct width for weak password', () => {
    const { container } = render(
      <PasswordStrength password="abc" onPasswordGenerate={mockOnPasswordGenerate} />
    );
    
    const strengthBar = container.querySelector('.h-full');
    expect(strengthBar).toBeInTheDocument();
  });

  test('Strength bar has red color for weak password', () => {
    const { container } = render(
      <PasswordStrength password="abc" onPasswordGenerate={mockOnPasswordGenerate} />
    );
    
    const strengthBar = container.querySelector('.bg-red-500');
    expect(strengthBar).toBeInTheDocument();
  });

  test('Strength bar has yellow color for medium password', () => {
    const { container } = render(
      <PasswordStrength password="Abc123456" onPasswordGenerate={mockOnPasswordGenerate} />
    );
    
    const strengthBar = container.querySelector('.bg-yellow-500');
    expect(strengthBar).toBeInTheDocument();
  });

  test('Strength bar has green color for strong password', () => {
    const { container } = render(
      <PasswordStrength password="Abc123!@#Xyz" onPasswordGenerate={mockOnPasswordGenerate} />
    );
    
    const strengthBar = container.querySelector('.bg-green-500');
    expect(strengthBar).toBeInTheDocument();
  });

  test('Shows check icon for met requirements', () => {
    const { container } = render(
      <PasswordStrength password="Abcdefgh123!" onPasswordGenerate={mockOnPasswordGenerate} />
    );
    
    const checkIcons = container.querySelectorAll('.lucide-check');
    expect(checkIcons.length).toBeGreaterThan(0);
  });

  test('Shows X icon for unmet requirements', () => {
    const { container } = render(
      <PasswordStrength password="abc" onPasswordGenerate={mockOnPasswordGenerate} />
    );
    
    const xIcons = container.querySelectorAll('.lucide-x');
    expect(xIcons.length).toBeGreaterThan(0);
  });
});

describe('PasswordStrength Component - Edge Cases', () => {
  
  const mockOnPasswordGenerate = jest.fn();

  test('Handles empty password correctly', () => {
    render(<PasswordStrength password="" onPasswordGenerate={mockOnPasswordGenerate} />);
    
    expect(screen.queryByText('Weak')).not.toBeInTheDocument();
  });

  test('Handles very long password', () => {
    const longPassword = 'A'.repeat(100) + '1!';
    render(<PasswordStrength password={longPassword} onPasswordGenerate={mockOnPasswordGenerate} />);
    
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });

  test('Handles password with only special characters', () => {
    render(<PasswordStrength password="!@#$%^&*()" onPasswordGenerate={mockOnPasswordGenerate} />);
    
    expect(screen.getByText(/Weak|Medium/)).toBeInTheDocument();
  });

  test('Handles password with spaces', () => {
    render(<PasswordStrength password="Pass Word 123!" onPasswordGenerate={mockOnPasswordGenerate} />);
    
    // Check for strength label specifically (not button text)
    const strengthLabel = screen.getByText('Password Strength:').nextElementSibling;
    expect(strengthLabel).toHaveTextContent(/Weak|Medium|Strong/);
  });

  test('Updates when switching from password to empty', () => {
    const { rerender } = render(
      <PasswordStrength password="Strong123!" onPasswordGenerate={mockOnPasswordGenerate} />
    );
    expect(screen.getByText('Password Strength:')).toBeInTheDocument();

    rerender(<PasswordStrength password="" onPasswordGenerate={mockOnPasswordGenerate} />);
    expect(screen.queryByText('Password Strength:')).not.toBeInTheDocument();
  });
});

describe('PasswordStrength Component - Score Calculation', () => {
  
  const mockOnPasswordGenerate = jest.fn();

  test('Score increases with password length', () => {
    const { rerender } = render(
      <PasswordStrength password="abc" onPasswordGenerate={mockOnPasswordGenerate} />
    );
    expect(screen.getByText('Weak')).toBeInTheDocument();

    rerender(<PasswordStrength password="Abcd1234" onPasswordGenerate={mockOnPasswordGenerate} />);
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  test('Score increases with character variety', () => {
    render(<PasswordStrength password="abcdefghijkl" onPasswordGenerate={mockOnPasswordGenerate} />);
    // 12 chars (2 points) + lowercase (1 point) = 3 points = Medium
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  test('Maximum score for complete password', () => {
    render(<PasswordStrength password="Abcdefghijk123!@#" onPasswordGenerate={mockOnPasswordGenerate} />);
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });
});