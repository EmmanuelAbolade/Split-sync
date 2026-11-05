// src/components/ActionButton.test.jsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ActionButton from './ActionButton';

test('ready: a normal button that responds to taps', () => {
  let taps = 0;
  render(<ActionButton onClick={() => { taps += 1; }}>Yes, I paid</ActionButton>);
  const b = screen.getByRole('button', { name: 'Yes, I paid' });
  expect(b).toHaveAttribute('type', 'button');
  expect(b.className).toMatch(/active:scale/);
  fireEvent.click(b);
  expect(taps).toBe(1);
});

test('saving: shows the saving label, is busy and ignores taps', () => {
  let taps = 0;
  render(<ActionButton busy busyLabel="Sending…" onClick={() => { taps += 1; }}>Yes, I paid</ActionButton>);
  const b = screen.getByRole('button', { name: 'Sending…' });
  expect(b).toBeDisabled();
  expect(b).toHaveAttribute('aria-busy', 'true');
  fireEvent.click(b);
  expect(taps).toBe(0);
});

test('variants and submit type pass through', () => {
  render(<ActionButton type="submit" variant="secondary">Not yet</ActionButton>);
  const b = screen.getByRole('button', { name: 'Not yet' });
  expect(b).toHaveAttribute('type', 'submit');
  expect(b.className).toMatch(/border-gray-300/);
});
