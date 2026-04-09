// src/components/InfoHubModal.test.jsx
// Tests for InfoHubModal component — tab navigation and content rendering

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import InfoHubModal from './InfoHubModal';

const mockOnClose = jest.fn();

describe('InfoHubModal', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Renders nothing when isOpen is false', () => {
    render(<InfoHubModal isOpen={false} onClose={mockOnClose} />);
    expect(screen.queryByText('Help and Information')).not.toBeInTheDocument();
  });

  test('Renders modal when isOpen is true', () => {
    render(<InfoHubModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText('Help and Information')).toBeInTheDocument();
  });

  test('Renders all four tabs', () => {
    render(<InfoHubModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByRole('button', { name: /Getting Started/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Features/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tutorials/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Contact Us/i })).toBeInTheDocument();
  });

  test('Shows Getting Started content by default', () => {
    render(<InfoHubModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText(/Welcome to Split-Sync/)).toBeInTheDocument();
  });

  test('Shows Features content when Features tab is clicked', () => {
    render(<InfoHubModal isOpen={true} onClose={mockOnClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Features/i }));
    expect(screen.getByText(/Core Features/i)).toBeInTheDocument();
  });

  test('Shows Tutorials content when Tutorials tab is clicked', () => {
    render(<InfoHubModal isOpen={true} onClose={mockOnClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Tutorials/i }));
    expect(screen.getByText(/Getting Started with Split-Sync/)).toBeInTheDocument();
  });

  test('Shows Contact content when Contact Us tab is clicked', () => {
    render(<InfoHubModal isOpen={true} onClose={mockOnClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Contact Us/i }));
    expect(screen.getByText('Get in Touch')).toBeInTheDocument();
  });

  test('Shows support email in Contact tab', () => {
    render(<InfoHubModal isOpen={true} onClose={mockOnClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Contact Us/i }));
    expect(screen.getAllByText('support@split-sync.com').length).toBeGreaterThan(0);
  });

  test('Calls onClose when X button is clicked', () => {
    render(<InfoHubModal isOpen={true} onClose={mockOnClose} />);
    // X button is the only element containing the close icon in the header
    const closeBtn = screen.getByRole('button', { name: '' });
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('Shows Quick Start Guide in Getting Started tab', () => {
    render(<InfoHubModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText(/Quick Start Guide/)).toBeInTheDocument();
  });

  test('Getting Started tab shows Create a Group step', () => {
    render(<InfoHubModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText('Create a Group')).toBeInTheDocument();
  });
});
