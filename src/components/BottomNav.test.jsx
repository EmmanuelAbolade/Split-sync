// src/components/BottomNav.test.jsx
// Test suite for BottomNav component - bottom navigation bar

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import BottomNav from './BottomNav';

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockNavigate = jest.fn();
let mockPathname = '/dashboard';

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname }),
}));

// ─────────────────────────────────────────────────────────────────────────────

describe('BottomNav Component - Rendering', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/dashboard';
  });

  test('Renders the nav element', () => {
    render(<BottomNav />);
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
  });

  test('Renders all four tab buttons', () => {
    const { container } = render(<BottomNav />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
    // Add button has no label — identified by its unique floating class
    expect(container.querySelector('.-mt-6')).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  test('Renders four buttons total', () => {
    render(<BottomNav />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);
  });

  test('Nav is fixed to the bottom', () => {
    render(<BottomNav />);
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveClass('fixed');
    expect(nav).toHaveClass('bottom-0');
  });

  test('Nav has light and dark mode background classes', () => {
    render(<BottomNav />);
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveClass('bg-white');
    expect(nav).toHaveClass('dark:bg-gray-800');
  });

  test('Nav has correct z-index for layering', () => {
    render(<BottomNav />);
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveClass('z-40');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('BottomNav Component - Navigation', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/dashboard';
  });

  test('Navigates to /dashboard when Home is clicked', () => {
    render(<BottomNav />);
    fireEvent.click(screen.getByText('Home'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  test('Navigates to /activity when Activity is clicked', () => {
    render(<BottomNav />);
    fireEvent.click(screen.getByText('Activity'));
    expect(mockNavigate).toHaveBeenCalledWith('/activity');
  });

  test('Navigates to /add when Add button is clicked', () => {
    const { container } = render(<BottomNav />);
    const addButton = container.querySelector('.-mt-6');
    fireEvent.click(addButton);
    expect(mockNavigate).toHaveBeenCalledWith('/add');
  });

  test('Navigates to /profile when You is clicked', () => {
    render(<BottomNav />);
    fireEvent.click(screen.getByText('You'));
    expect(mockNavigate).toHaveBeenCalledWith('/profile');
  });

  test('Each nav button calls navigate exactly once per click', () => {
    render(<BottomNav />);
    fireEvent.click(screen.getByText('Activity'));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('BottomNav Component - Active State on /dashboard', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/dashboard';
  });

  test('Home tab is active on /dashboard', () => {
    render(<BottomNav />);
    const homeButton = screen.getByText('Home').closest('button');
    expect(homeButton).toHaveClass('scale-105');
  });

  test('Activity tab is not active on /dashboard', () => {
    render(<BottomNav />);
    const activityButton = screen.getByText('Activity').closest('button');
    expect(activityButton).not.toHaveClass('scale-105');
  });

  test('Profile tab is not active on /dashboard', () => {
    render(<BottomNav />);
    const profileButton = screen.getByText('You').closest('button');
    expect(profileButton).not.toHaveClass('scale-105');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('BottomNav Component - Active State on root path /', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/';
  });

  test('Home tab is also active on root path /', () => {
    render(<BottomNav />);
    const homeButton = screen.getByText('Home').closest('button');
    expect(homeButton).toHaveClass('scale-105');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('BottomNav Component - Active State on /activity', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/activity';
  });

  test('Activity tab is active on /activity', () => {
    render(<BottomNav />);
    const activityButton = screen.getByText('Activity').closest('button');
    expect(activityButton).toHaveClass('scale-105');
  });

  test('Home tab is not active on /activity', () => {
    render(<BottomNav />);
    const homeButton = screen.getByText('Home').closest('button');
    expect(homeButton).not.toHaveClass('scale-105');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('BottomNav Component - Active State on /profile', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/profile';
  });

  test('Profile tab is active on /profile', () => {
    render(<BottomNav />);
    const profileButton = screen.getByText('You').closest('button');
    expect(profileButton).toHaveClass('scale-105');
  });

  test('Home tab is not active on /profile', () => {
    render(<BottomNav />);
    const homeButton = screen.getByText('Home').closest('button');
    expect(homeButton).not.toHaveClass('scale-105');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('BottomNav Component - Special Add Button', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/dashboard';
  });

  test('Add button has elevated floating style', () => {
    const { container } = render(<BottomNav />);
    const addButton = container.querySelector('.-mt-6');
    expect(addButton).toBeInTheDocument();
    expect(addButton).toHaveClass('-mt-6');
  });

  test('Add button inner div has gradient background', () => {
    const { container } = render(<BottomNav />);
    const gradientDiv = container.querySelector('.bg-gradient-to-br');
    expect(gradientDiv).toBeInTheDocument();
  });

  test('Add button inner div has rounded-full class', () => {
    const { container } = render(<BottomNav />);
    const roundedDiv = container.querySelector('.rounded-full');
    expect(roundedDiv).toBeInTheDocument();
  });

  test('Add button has dark mode gradient classes', () => {
    const { container } = render(<BottomNav />);
    const gradientDiv = container.querySelector('.dark\\:from-indigo-600');
    expect(gradientDiv).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('BottomNav Component - Icons', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/dashboard';
  });

  test('Renders Home icon', () => {
    const { container } = render(<BottomNav />);
    const homeIcon = container.querySelector('.lucide-house, .lucide-home');
    expect(homeIcon).toBeInTheDocument();
  });

  test('Renders Activity icon', () => {
    const { container } = render(<BottomNav />);
    const activityIcon = container.querySelector('.lucide-activity');
    expect(activityIcon).toBeInTheDocument();
  });

  test('Renders Plus icon inside Add button', () => {
    const { container } = render(<BottomNav />);
    const plusIcon = container.querySelector('.lucide-plus');
    expect(plusIcon).toBeInTheDocument();
  });

  test('Renders User icon', () => {
    const { container } = render(<BottomNav />);
    const userIcon = container.querySelector('.lucide-user');
    expect(userIcon).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('BottomNav Component - Inactive Tab Styling', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/dashboard';
  });

  test('Inactive tabs have hover background class', () => {
    render(<BottomNav />);
    // Activity is inactive when on /dashboard
    const activityButton = screen.getByText('Activity').closest('button');
    expect(activityButton).toHaveClass('hover:bg-gray-50');
  });

  test('Inactive tabs have dark mode hover class', () => {
    render(<BottomNav />);
    const activityButton = screen.getByText('Activity').closest('button');
    expect(activityButton).toHaveClass('dark:hover:bg-gray-700');
  });

  test('Inactive tab labels have muted text colour', () => {
    render(<BottomNav />);
    const activityLabel = screen.getByText('Activity');
    expect(activityLabel).toHaveClass('text-gray-500');
  });
});