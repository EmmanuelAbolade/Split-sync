// src/utils/settlements.test.js
jest.mock('../services/firebase', () => ({ __esModule: true, default: {}, db: {} }));

const mockCall = jest.fn();
jest.mock('firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: (_fns, name) => (data) => mockCall(name, data),
}));

// eslint-disable-next-line import/first
import {
  toMinor, startSettlement, claimSettlement, confirmSettlement, declineSettlement,
  receiveSettlement, receiveParams, confirmParams, cancelSettlement, settlementErrorMessage, methodLabel,
} from './settlements';

beforeEach(() => {
  mockCall.mockReset();
  mockCall.mockImplementation(() => Promise.resolve({ data: { status: 'ok' } }));
});

test('toMinor turns amounts into whole cents without float drift', () => {
  expect(toMinor(12.34)).toBe(1234);
  expect(toMinor('0.1')).toBe(10);
  expect(toMinor(19.99)).toBe(1999);
  expect(toMinor(1000000)).toBe(100000000);
});

test('each helper calls its Function with only the fields the server accepts', async () => {
  await startSettlement({ groupId: 'g', toUid: 'b', amount: 5, method: 'revolut', extra: 'x' });
  await claimSettlement({ groupId: 'g', toUid: 'b', amount: 5, method: 'manual', idempotencyKey: 'k' });
  await confirmSettlement('n1', 'tok');
  await declineSettlement('n1');
  await receiveSettlement({ groupId: 'g', fromUid: 'a', amount: 7.5, idempotencyKey: 'k2' }, 'tok2');
  await cancelSettlement({ groupId: 'g', toUid: 'b' });
  expect(mockCall.mock.calls).toEqual([
    ['settlements-start', { groupId: 'g', toUid: 'b', amountMinor: 500, method: 'revolut' }],
    ['settlements-claim', { groupId: 'g', toUid: 'b', amountMinor: 500, method: 'manual', idempotencyKey: 'k' }],
    ['settlements-confirm', { notificationId: 'n1', stepUpToken: 'tok' }],
    ['settlements-decline', { notificationId: 'n1' }],
    ['settlements-receive', { groupId: 'g', fromUid: 'a', amountMinor: 750, idempotencyKey: 'k2', stepUpToken: 'tok2' }],
    ['settlements-cancel', { groupId: 'g', toUid: 'b' }],
  ]);
});

test('the step-up parameters are exactly what is sent, minus the token', async () => {
  // The server hashes the request without stepUpToken; these must match it.
  await confirmSettlement('n9', 'tok');
  const { stepUpToken: _a, ...sentConfirm } = mockCall.mock.calls[0][1];
  expect(sentConfirm).toEqual(confirmParams('n9'));

  const p = { groupId: 'g', fromUid: 'a', amount: 3.3, idempotencyKey: 'k' };
  await receiveSettlement(p, 'tok');
  const { stepUpToken: _b, ...sentReceive } = mockCall.mock.calls[1][1];
  expect(sentReceive).toEqual(receiveParams(p));
});

test('error messages: server explanations are shown, other errors stay generic', () => {
  const e = (code, message = 'Server says why') => Object.assign(new Error(message), { code });
  expect(settlementErrorMessage(e('functions/failed-precondition'))).toBe('Server says why');
  expect(settlementErrorMessage(e('functions/invalid-argument'))).toBe('Server says why');
  expect(settlementErrorMessage(e('functions/permission-denied'))).toBe('You are not allowed to do this.');
  expect(settlementErrorMessage(e('functions/internal', 'stack trace'))).toBe('That did not work. Please try again.');
  expect(settlementErrorMessage(new Error('offline'), 'Fallback')).toBe('Fallback');
});

test('methodLabel reads naturally in a sentence', () => {
  expect(methodLabel('revolut')).toBe('Revolut');
  expect(methodLabel('bank')).toBe('bank transfer');
  expect(methodLabel('manual')).toBe('cash or other');
  expect(methodLabel('nope')).toBe('another way');
});
