// src/components/IconSelector.test.jsx
// Tests for IconSelector component

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import IconSelector, { ICONS } from './IconSelector';

const mockOnSelect = jest.fn();

describe('IconSelector', () => {

  beforeEach(() => jest.clearAllMocks());

  test('Renders Choose Icon label', () => {
    render(<IconSelector selected="" onSelect={mockOnSelect} />);
    expect(screen.getByText('Choose Icon')).toBeInTheDocument();
  });

  test('Renders a button for every icon in ICONS list', () => {
    render(<IconSelector selected="" onSelect={mockOnSelect} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(ICONS.length);
  });

  test('Each icon button has a title attribute', () => {
    render(<IconSelector selected="" onSelect={mockOnSelect} />);
    ICONS.forEach(({ label }) => {
      expect(screen.getByTitle(label)).toBeInTheDocument();
    });
  });

  test('Calls onSelect with icon name when a button is clicked', () => {
    render(<IconSelector selected="" onSelect={mockOnSelect} />);
    fireEvent.click(screen.getByTitle('Home'));
    expect(mockOnSelect).toHaveBeenCalledWith('home');
  });

  test('Calls onSelect with correct name for Travel icon', () => {
    render(<IconSelector selected="" onSelect={mockOnSelect} />);
    fireEvent.click(screen.getByTitle('Travel'));
    expect(mockOnSelect).toHaveBeenCalledWith('plane');
  });

  test('Selected icon button has ring/primary styling class', () => {
    render(<IconSelector selected="home" onSelect={mockOnSelect} />);
    const homeBtn = screen.getByTitle('Home');
    expect(homeBtn.className).toMatch(/bg-primary/);
  });

  test('Unselected icon buttons do not have primary styling', () => {
    render(<IconSelector selected="home" onSelect={mockOnSelect} />);
    const travelBtn = screen.getByTitle('Travel');
    expect(travelBtn.className).not.toMatch(/bg-primary\b/);
  });

  test('ICONS export contains 16 icons', () => {
    expect(ICONS).toHaveLength(16);
  });

  test('ICONS export has correct structure with name, Icon, label', () => {
    ICONS.forEach(icon => {
      expect(icon).toHaveProperty('name');
      expect(icon).toHaveProperty('Icon');
      expect(icon).toHaveProperty('label');
    });
  });
});
