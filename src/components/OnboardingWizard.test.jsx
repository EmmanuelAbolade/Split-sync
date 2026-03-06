// src/components/OnboardingWizard.test.jsx
// Tests for OnboardingWizard - visibility, step navigation, step content,
// navigation callbacks, backdrop close, Back disabled on first step

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import OnboardingWizard from './OnboardingWizard';

// ---------------------------------------------------------------------------
// Shared props
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();
const mockOnClose  = jest.fn();
const mockOnFinish = jest.fn();

const defaultProps = {
  open:       true,
  onClose:    mockOnClose,
  onFinish:   mockOnFinish,
  navigate:   mockNavigate,
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Visibility
// ---------------------------------------------------------------------------

describe('OnboardingWizard - Visibility', () => {

  test('Renders when open is true', () => {
    render(<OnboardingWizard {...defaultProps} />);
    expect(screen.getByText('Welcome to SplitSync')).toBeInTheDocument();
  });

  test('Does not render when open is false', () => {
    render(<OnboardingWizard {...defaultProps} open={false} />);
    expect(screen.queryByText('Welcome to SplitSync')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. First step content
// ---------------------------------------------------------------------------

describe('OnboardingWizard - Step 1 (Welcome)', () => {

  test('Shows Welcome to SplitSync title', () => {
    render(<OnboardingWizard {...defaultProps} />);
    expect(screen.getByText('Welcome to SplitSync')).toBeInTheDocument();
  });

  test('Shows step counter 1 / 7', () => {
    render(<OnboardingWizard {...defaultProps} />);
    expect(screen.getByText('1 / 7')).toBeInTheDocument();
  });

  test('Back button is disabled on first step', () => {
    render(<OnboardingWizard {...defaultProps} />);
    expect(screen.getByText('Back').closest('button')).toBeDisabled();
  });

  test('Shows Next button on first step', () => {
    render(<OnboardingWizard {...defaultProps} />);
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  test('Does not show Finish button on first step', () => {
    render(<OnboardingWizard {...defaultProps} />);
    expect(screen.queryByText('Finish')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Step navigation
// ---------------------------------------------------------------------------

describe('OnboardingWizard - Navigation', () => {

  test('Advances to step 2 when Next is clicked', () => {
    render(<OnboardingWizard {...defaultProps} />);
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Step 1: Create or Join a Group')).toBeInTheDocument();
  });

  test('Shows step counter 2 / 7 after one Next click', () => {
    render(<OnboardingWizard {...defaultProps} />);
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('2 / 7')).toBeInTheDocument();
  });

  test('Back button is enabled after first Next click', () => {
    render(<OnboardingWizard {...defaultProps} />);
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Back').closest('button')).not.toBeDisabled();
  });

  test('Returns to step 1 when Back is clicked from step 2', () => {
    render(<OnboardingWizard {...defaultProps} />);
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Welcome to SplitSync')).toBeInTheDocument();
  });

  test('Shows Finish button on last step', () => {
    render(<OnboardingWizard {...defaultProps} />);
    // Click Next 6 times to reach last step (7 steps total)
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByText('Next'));
    }
    expect(screen.getByText('Finish')).toBeInTheDocument();
  });

  test('Does not show Next button on last step', () => {
    render(<OnboardingWizard {...defaultProps} />);
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByText('Next'));
    }
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  test('Shows step counter 7 / 7 on last step', () => {
    render(<OnboardingWizard {...defaultProps} />);
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByText('Next'));
    }
    expect(screen.getByText('7 / 7')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 4. Step content per step
// ---------------------------------------------------------------------------

describe('OnboardingWizard - Step content', () => {

  test('Step 2 shows Go to Dashboard button', () => {
    render(<OnboardingWizard {...defaultProps} />);
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
  });

  test('Step 2 shows Join a Group button', () => {
    render(<OnboardingWizard {...defaultProps} />);
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Join a Group')).toBeInTheDocument();
  });

  test('Step 3 shows Quick Add / Receipt Scan button', () => {
    render(<OnboardingWizard {...defaultProps} />);
    for (let i = 0; i < 2; i++) fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Quick Add / Receipt Scan')).toBeInTheDocument();
  });

  test('Step 4 shows Go to Activity button', () => {
    render(<OnboardingWizard {...defaultProps} />);
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Go to Activity')).toBeInTheDocument();
  });

  test('Step 5 shows Open Profile Payment Settings button', () => {
    render(<OnboardingWizard {...defaultProps} />);
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Open Profile Payment Settings')).toBeInTheDocument();
  });

  test('Step 6 shows Open Settings button', () => {
    render(<OnboardingWizard {...defaultProps} />);
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Open Settings')).toBeInTheDocument();
  });

  test('Step 7 (Notifications) shows correct title', () => {
    render(<OnboardingWizard {...defaultProps} />);
    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 5. Navigation callbacks
// ---------------------------------------------------------------------------

describe('OnboardingWizard - Navigate callbacks', () => {

  test('Clicking Go to Dashboard calls navigate with /dashboard', () => {
    render(<OnboardingWizard {...defaultProps} />);
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Go to Dashboard'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  test('Clicking Join a Group calls navigate with /join-group', () => {
    render(<OnboardingWizard {...defaultProps} />);
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Join a Group'));
    expect(mockNavigate).toHaveBeenCalledWith('/join-group');
  });

  test('Clicking Quick Add / Receipt Scan calls navigate with /quick-add', () => {
    render(<OnboardingWizard {...defaultProps} />);
    for (let i = 0; i < 2; i++) fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Quick Add / Receipt Scan'));
    expect(mockNavigate).toHaveBeenCalledWith('/quick-add');
  });

  test('Clicking Go to Activity calls navigate with /activity', () => {
    render(<OnboardingWizard {...defaultProps} />);
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Go to Activity'));
    expect(mockNavigate).toHaveBeenCalledWith('/activity');
  });

  test('Clicking Open Profile Payment Settings calls navigate with /profile', () => {
    render(<OnboardingWizard {...defaultProps} />);
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Open Profile Payment Settings'));
    expect(mockNavigate).toHaveBeenCalledWith('/profile');
  });

  test('Clicking Open Settings calls navigate with /settings', () => {
    render(<OnboardingWizard {...defaultProps} />);
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Open Settings'));
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });
});

// ---------------------------------------------------------------------------
// 6. Close and Finish callbacks
// ---------------------------------------------------------------------------

describe('OnboardingWizard - Close and Finish', () => {

  test('Calls onClose when X button is clicked', () => {
    render(<OnboardingWizard {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Close onboarding'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('Calls onClose when backdrop is clicked', () => {
    const { container } = render(<OnboardingWizard {...defaultProps} />);
    const backdrop = container.querySelector('[aria-hidden="true"]');
    fireEvent.click(backdrop);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('Calls onFinish when Finish is clicked on last step', () => {
    render(<OnboardingWizard {...defaultProps} />);
    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Finish'));
    expect(mockOnFinish).toHaveBeenCalledTimes(1);
  });
});
