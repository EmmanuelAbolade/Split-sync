// src/hooks/useStepUp.test.js
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../components/StepUpSheet', () => ({
  __esModule: true,
  default: ({ action, params, onConfirmed, onCancel }) => (
    <div role="dialog">
      <span>{action}</span>
      <span>{JSON.stringify(params)}</span>
      <button type="button" onClick={() => onConfirmed('tok-123')}>ok</button>
      <button type="button" onClick={onCancel}>cancel</button>
    </div>
  ),
}));

// eslint-disable-next-line import/first
import useStepUp from './useStepUp';

let result;
function Harness() {
  const { requestStepUp, stepUpSheet } = useStepUp();
  return (
    <>
      <button type="button" onClick={() => { result = requestStepUp('settlements.confirm', { notificationId: 'n1' }); }}>go</button>
      {stepUpSheet}
    </>
  );
}

test('resolves with the token once confirmed, and closes the sheet', async () => {
  render(<Harness />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('go'));
  expect(screen.getByText('settlements.confirm')).toBeInTheDocument();
  expect(screen.getByText('{"notificationId":"n1"}')).toBeInTheDocument();
  fireEvent.click(screen.getByText('ok'));
  await act(async () => { expect(await result).toBe('tok-123'); });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('resolves with null when cancelled', async () => {
  render(<Harness />);
  fireEvent.click(screen.getByText('go'));
  fireEvent.click(screen.getByText('cancel'));
  await act(async () => { expect(await result).toBeNull(); });
});

test('a second request replaces an open one; the first resolves with null', async () => {
  render(<Harness />);
  fireEvent.click(screen.getByText('go'));
  const first = result;
  fireEvent.click(screen.getByText('go'));
  await act(async () => { expect(await first).toBeNull(); });
  fireEvent.click(screen.getByText('ok'));
  await act(async () => { expect(await result).toBe('tok-123'); });
});
