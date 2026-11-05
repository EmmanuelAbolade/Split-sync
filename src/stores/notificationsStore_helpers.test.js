// src/stores/notificationsStore_helpers.test.js
// Tests for the standalone payment helpers: recordPaymentSent,
// confirmPaymentReceived, declinePaymentReceived. Since Circles Phase 1B they
// call the settlements Functions; what those Functions write (notifications,
// locks, the settlement entry) is tested against the emulator in
// functions/test/integration/settlements.test.js.

jest.mock('../services/firebase', () => ({ __esModule: true, default: {}, db: {} }));

const mockCall = jest.fn();
jest.mock('firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: (_fns, name) => (data) => mockCall(name, data),
}));

jest.mock('firebase/firestore', () => ({
  collection: () => ({}), query: () => ({}), where: () => ({}), onSnapshot: () => () => {},
  doc: () => ({}), updateDoc: () => Promise.resolve(), writeBatch: () => ({}),
  addDoc: () => Promise.resolve({ id: 'x' }), serverTimestamp: () => 'TS',
}));

// eslint-disable-next-line import/first
import { recordPaymentSent, confirmPaymentReceived, declinePaymentReceived } from './notificationsStore';

const paymentPayload = {
  payerId: 'payer-uid',
  payerName: 'Alice',
  payeeId: 'payee-uid',
  payeeName: 'Bob',
  groupId: 'group-001',
  groupName: 'Flatmates',
  amount: 25.5,
  currency: 'EUR',
  method: 'paypal',
  idempotencyKey: 'k'.repeat(20),
};

let errorSpy;
beforeEach(() => {
  mockCall.mockReset();
  mockCall.mockImplementation((_name, data) => Promise.resolve({ data: { ok: true, echo: data } }));
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

describe('recordPaymentSent', () => {
  test('claims the payment on the server in cents, with the payee and the idempotency key', async () => {
    const r = await recordPaymentSent(paymentPayload);
    expect(mockCall).toHaveBeenCalledWith('settlements-claim', {
      groupId: 'group-001', toUid: 'payee-uid', amountMinor: 2550, method: 'paypal', idempotencyKey: 'k'.repeat(20),
    });
    expect(r.ok).toBe(true);
  });

  test('never sends a payer id: the server uses the signed-in user', async () => {
    await recordPaymentSent(paymentPayload);
    const [, data] = mockCall.mock.calls[0];
    expect(data).not.toHaveProperty('payerId');
    expect(data).not.toHaveProperty('fromUid');
  });

  test('passes a PayPal order reference when there is one', async () => {
    await recordPaymentSent({ ...paymentPayload, paypalOrderId: 'ORDER-1' });
    expect(mockCall.mock.calls[0][1].paypalOrderId).toBe('ORDER-1');
  });

  test('rethrows and logs only the error code', async () => {
    mockCall.mockRejectedValueOnce(Object.assign(new Error('secret detail'), { code: 'functions/failed-precondition' }));
    await expect(recordPaymentSent(paymentPayload)).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    expect(errorSpy).toHaveBeenCalledWith('Error recording payment sent:', 'functions/failed-precondition');
  });
});

describe('confirmPaymentReceived', () => {
  test('confirms on the server with the notification id and the step-up token', async () => {
    await confirmPaymentReceived('notif-1', 't'.repeat(40));
    expect(mockCall).toHaveBeenCalledWith('settlements-confirm', { notificationId: 'notif-1', stepUpToken: 't'.repeat(40) });
  });

  test('rethrows server errors', async () => {
    mockCall.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'functions/unauthenticated' }));
    await expect(confirmPaymentReceived('notif-1', 'tok')).rejects.toMatchObject({ code: 'functions/unauthenticated' });
    expect(errorSpy).toHaveBeenCalledWith('Error confirming payment:', 'functions/unauthenticated');
  });
});

describe('declinePaymentReceived', () => {
  test('declines on the server with only the notification id', async () => {
    await declinePaymentReceived('notif-2');
    expect(mockCall).toHaveBeenCalledWith('settlements-decline', { notificationId: 'notif-2' });
  });

  test('rethrows server errors', async () => {
    mockCall.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'functions/permission-denied' }));
    await expect(declinePaymentReceived('notif-2')).rejects.toMatchObject({ code: 'functions/permission-denied' });
    expect(errorSpy).toHaveBeenCalledWith('Error declining payment:', 'functions/permission-denied');
  });
});
