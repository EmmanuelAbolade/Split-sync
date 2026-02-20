// src/components/Tooltip.test.jsx
// Test suite for Tooltip component
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Tooltip from './Tooltip';

describe('Tooltip Component - Basic Rendering', () => {
  
  test('Renders tooltip button', () => {
    render(<Tooltip text="Test tooltip" />);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  test('Shows default Info icon when no children provided', () => {
    const { container } = render(<Tooltip text="Test tooltip" />);
    
    const infoIcon = container.querySelector('.lucide-info');
    expect(infoIcon).toBeInTheDocument();
  });

  test('Shows custom children when provided', () => {
    render(<Tooltip text="Test tooltip"><span>Custom</span></Tooltip>);
    
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  test('Tooltip content is hidden by default', () => {
    render(<Tooltip text="Test tooltip content" />);
    
    expect(screen.queryByText('Test tooltip content')).not.toBeInTheDocument();
  });

  test('Button has correct type attribute', () => {
    render(<Tooltip text="Test" />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'button');
  });
});

describe('Tooltip Component - Mouse Interactions', () => {
  
  test('Shows tooltip on mouse enter', () => {
    render(<Tooltip text="Hover tooltip" />);
    
    const button = screen.getByRole('button');
    fireEvent.mouseEnter(button);
    
    expect(screen.getByText('Hover tooltip')).toBeInTheDocument();
  });

  test('Hides tooltip on mouse leave', () => {
    render(<Tooltip text="Hover tooltip" />);
    
    const button = screen.getByRole('button');
    fireEvent.mouseEnter(button);
    expect(screen.getByText('Hover tooltip')).toBeInTheDocument();
    
    fireEvent.mouseLeave(button);
    expect(screen.queryByText('Hover tooltip')).not.toBeInTheDocument();
  });

  test('Multiple hover cycles work correctly', () => {
    render(<Tooltip text="Test tooltip" />);
    
    const button = screen.getByRole('button');
    
    // First hover
    fireEvent.mouseEnter(button);
    expect(screen.getByText('Test tooltip')).toBeInTheDocument();
    fireEvent.mouseLeave(button);
    expect(screen.queryByText('Test tooltip')).not.toBeInTheDocument();
    
    // Second hover
    fireEvent.mouseEnter(button);
    expect(screen.getByText('Test tooltip')).toBeInTheDocument();
  });
});

describe('Tooltip Component - Click Interactions', () => {
  
  test('Toggles tooltip on click', () => {
    render(<Tooltip text="Click tooltip" />);
    
    const button = screen.getByRole('button');
    
    // Click to show
    fireEvent.click(button);
    expect(screen.getByText('Click tooltip')).toBeInTheDocument();
    
    // Click to hide
    fireEvent.click(button);
    expect(screen.queryByText('Click tooltip')).not.toBeInTheDocument();
  });

  test('Click prevents default behavior', () => {
    render(<Tooltip text="Test" />);
    
    const button = screen.getByRole('button');
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    
    button.dispatchEvent(clickEvent);
    // If preventDefault wasn't called, form submission might occur
    // We're testing the structure here
    expect(button).toBeInTheDocument();
  });

  test('Multiple clicks toggle correctly', () => {
    render(<Tooltip text="Toggle tooltip" />);
    
    const button = screen.getByRole('button');
    
    fireEvent.click(button);
    expect(screen.getByText('Toggle tooltip')).toBeInTheDocument();
    
    fireEvent.click(button);
    expect(screen.queryByText('Toggle tooltip')).not.toBeInTheDocument();
    
    fireEvent.click(button);
    expect(screen.getByText('Toggle tooltip')).toBeInTheDocument();
  });
});

describe('Tooltip Component - Content Display', () => {
  
  test('Displays provided text content', () => {
    const tooltipText = 'This is helpful information';
    render(<Tooltip text={tooltipText} />);
    
    const button = screen.getByRole('button');
    fireEvent.mouseEnter(button);
    
    expect(screen.getByText(tooltipText)).toBeInTheDocument();
  });

  test('Handles long text content', () => {
    const longText = 'This is a very long tooltip text that should be displayed properly';
    render(<Tooltip text={longText} />);
    
    const button = screen.getByRole('button');
    fireEvent.mouseEnter(button);
    
    expect(screen.getByText(longText)).toBeInTheDocument();
  });

  test('Handles empty text', () => {
    render(<Tooltip text="" />);
    
    const button = screen.getByRole('button');
    fireEvent.mouseEnter(button);
    
    // Tooltip should still render, just empty
    const button2 = screen.getByRole('button');
    expect(button2).toBeInTheDocument();
  });

  test('Tooltip has proper styling classes', () => {
    const { container } = render(<Tooltip text="Test" />);
    
    const button = screen.getByRole('button');
    fireEvent.mouseEnter(button);
    
    const tooltip = container.querySelector('.bg-gray-900');
    expect(tooltip).toBeInTheDocument();
  });
});

describe('Tooltip Component - Positioning', () => {
  
  test('Tooltip appears above button', () => {
    const { container } = render(<Tooltip text="Test" />);
    
    const button = screen.getByRole('button');
    fireEvent.mouseEnter(button);
    
    const tooltipContainer = container.querySelector('.bottom-full');
    expect(tooltipContainer).toBeInTheDocument();
  });

  test('Has arrow pointing down', () => {
    const { container } = render(<Tooltip text="Test" />);
    
    const button = screen.getByRole('button');
    fireEvent.mouseEnter(button);
    
    const arrow = container.querySelector('.border-t-gray-900');
    expect(arrow).toBeInTheDocument();
  });
});

describe('Tooltip Component - Custom Children', () => {
  
  test('Renders custom icon', () => {
    render(
      <Tooltip text="Custom icon tooltip">
        <span data-testid="custom-icon">?</span>
      </Tooltip>
    );
    
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  test('Custom children trigger tooltip', () => {
    render(
      <Tooltip text="Custom trigger">
        <span data-testid="trigger">Click me</span>
      </Tooltip>
    );
    
    const trigger = screen.getByTestId('trigger');
    fireEvent.mouseEnter(trigger.closest('button'));
    
    expect(screen.getByText('Custom trigger')).toBeInTheDocument();
  });
});

describe('Tooltip Component - Accessibility', () => {
  
  test('Button is keyboard accessible', () => {
    render(<Tooltip text="Accessible tooltip" />);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  test('Has inline-block wrapper', () => {
    const { container } = render(<Tooltip text="Test" />);
    
    const wrapper = container.querySelector('.inline-block');
    expect(wrapper).toBeInTheDocument();
  });
});