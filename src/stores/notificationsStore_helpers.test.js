// src/stores/notificationsStore_helpers.test.js
// Tests for standalone helpers: recordPaymentSent, confirmPaymentReceived, declinePaymentReceived
// These cover lines 125-282 of notificationsStore.js

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../services/firebase', () => ({ db: {} }));

const mockAddDoc      = jest.fn();
const mockUpdateDoc   = jest.fn();
const mockGetDoc      = jest.fn();
const mockDoc         = jest.fn();
const mockCollection  = jest.fn();
const mockQuery       = jest.fn();
const mockWhere       = jest.fn();
const mockOnSnapshot  = jest.fn();
const mockWriteBatch  = jest.fn();
const mockServerTimestamp = jest.fn(() => 'SERVER_TIMESTAMP');

jest.mock('firebase/firestore', () => ({
  collection:      (...args) => mockCollection(...args),
  query:           (...args) => mockQuery(...args),
  where:           (...args) => mockWhere(...args),
  onSnapshot:      (...args) => mockOnSnapshot(...args),
  doc:             (...args) => mockDoc(...args),
  updateDoc:       (...args) => mockUpdateDoc(...args),
  writeBatch:      (...args) => mockWriteBatch(...args),
  addDoc:          (...args) => mockAddDoc(...args),
  getDoc:          (...args) => mockGetDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

// ─── Shared payment payload ────────────────────────────────────────────────────

const paymentPayload = {
  payerId:   'payer-uid',
  payerName: 'Alice',
  payeeId:   'payee-uid',
  payeeName: 'Bob',
  groupId:   'group-001',
  groupName: 'Flatmates',
  amount:    25,
  currency:  'EUR',
  method:    'paypal',
};

// ─── Helpers to get store exports fresh each test ─────────────────────────────

const getHelpers = () => {
  const mod = require('./notificationsStore');
  return {
    recordPaymentSent:       mod.recordPaymentSent,
    confirmPaymentReceived:  mod.confirmPaymentReceived,
    declinePaymentReceived:  mod.declinePaymentReceived,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// recordPaymentSent (lines 125-183)
// ─────────────────────────────────────────────────────────────────────────────

describe('recordPaymentSent', () => {

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockServerTimestamp.mockReturnValue('SERVER_TIMESTAMP');
    mockCollection.mockReturnValue('mock-collection');
    mockDoc.mockReturnValue('mock-doc-ref');
    mockUpdateDoc.mockResolvedValue();
    // First addDoc = payee notification, second = payer log
    mockAddDoc
      .mockResolvedValueOnce({ id: 'payee-notif-id' })
      .mockResolvedValueOnce({ id: 'payer-log-id' });
  });

  test('Returns success:true on happy path', async () => {
    const { recordPaymentSent } = getHelpers();
    const result = await recordPaymentSent(paymentPayload);
    expect(result).toEqual({ success: true });
  });

  test('Calls addDoc twice — once for payee, once for payer log', async () => {
    const { recordPaymentSent } = getHelpers();
    await recordPaymentSent(paymentPayload);
    expect(mockAddDoc).toHaveBeenCalledTimes(2);
  });

  test('Payee notification has type payment_confirmation_needed', async () => {
    const { recordPaymentSent } = getHelpers();
    await recordPaymentSent(paymentPayload);
    const firstCall = mockAddDoc.mock.calls[0][1];
    expect(firstCall.type).toBe('payment_confirmation_needed');
  });

  test('Payee notification has requiresAction true', async () => {
    const { recordPaymentSent } = getHelpers();
    await recordPaymentSent(paymentPayload);
    const firstCall = mockAddDoc.mock.calls[0][1];
    expect(firstCall.requiresAction).toBe(true);
  });

  test('Payee notification is unread', async () => {
    const { recordPaymentSent } = getHelpers();
    await recordPaymentSent(paymentPayload);
    const firstCall = mockAddDoc.mock.calls[0][1];
    expect(firstCall.read).toBe(false);
  });

  test('Payee notification message contains payer name', async () => {
    const { recordPaymentSent } = getHelpers();
    await recordPaymentSent(paymentPayload);
    const firstCall = mockAddDoc.mock.calls[0][1];
    expect(firstCall.message).toContain('Alice');
  });

  test('Payee notification message contains formatted amount', async () => {
    const { recordPaymentSent } = getHelpers();
    await recordPaymentSent(paymentPayload);
    const firstCall = mockAddDoc.mock.calls[0][1];
    expect(firstCall.message).toContain('25.00');
  });

  test('Payer log notification has type payment_log', async () => {
    const { recordPaymentSent } = getHelpers();
    await recordPaymentSent(paymentPayload);
    const secondCall = mockAddDoc.mock.calls[1][1];
    expect(secondCall.type).toBe('payment_log');
  });

  test('Payer log notification is auto-read', async () => {
    const { recordPaymentSent } = getHelpers();
    await recordPaymentSent(paymentPayload);
    const secondCall = mockAddDoc.mock.calls[1][1];
    expect(secondCall.read).toBe(true);
  });

  test('Payer log data contains payeeNotifId', async () => {
    const { recordPaymentSent } = getHelpers();
    await recordPaymentSent(paymentPayload);
    const secondCall = mockAddDoc.mock.calls[1][1];
    expect(secondCall.data.payeeNotifId).toBe('payee-notif-id');
  });

  test('Calls updateDoc to backfill payerLogNotifId into payee notification', async () => {
    const { recordPaymentSent } = getHelpers();
    await recordPaymentSent(paymentPayload);
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { 'data.payerLogNotifId': 'payer-log-id' }
    );
  });

  test('Still returns success if backfill updateDoc fails (non-critical)', async () => {
    mockUpdateDoc.mockRejectedValueOnce(new Error('backfill failed'));
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { recordPaymentSent } = getHelpers();
    const result = await recordPaymentSent(paymentPayload);
    expect(result).toEqual({ success: true });
    consoleSpy.mockRestore();
  });

  test('Throws and logs error when addDoc fails', async () => {
    mockAddDoc.mockReset();
    mockAddDoc.mockRejectedValue(new Error('Firestore down'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { recordPaymentSent } = getHelpers();
    await expect(recordPaymentSent(paymentPayload)).rejects.toThrow('Firestore down');
    expect(consoleSpy).toHaveBeenCalledWith('Error recording payment sent:', expect.any(Error));
    consoleSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// confirmPaymentReceived (lines 195-243)
// ─────────────────────────────────────────────────────────────────────────────

const makePayeeNotifDoc = (overrides = {}) => ({
  exists: () => true,
  data: () => ({
    data: {
      groupId:          'group-001',
      groupName:        'Flatmates',
      payerId:          'payer-uid',
      payerName:        'Alice',
      payeeId:          'payee-uid',
      payeeName:        'Bob',
      amount:           25,
      currency:         'EUR',
      method:           'paypal',
      payerLogNotifId:  'payer-log-id',
      ...overrides,
    },
  }),
});

describe('confirmPaymentReceived', () => {

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockServerTimestamp.mockReturnValue('SERVER_TIMESTAMP');
    mockCollection.mockReturnValue('mock-collection');
    mockDoc.mockReturnValue('mock-doc-ref');
    mockGetDoc.mockResolvedValue(makePayeeNotifDoc());
    mockAddDoc.mockResolvedValue({ id: 'expense-id' });
    mockUpdateDoc.mockResolvedValue();
  });

  test('Returns success:true on happy path', async () => {
    const { confirmPaymentReceived } = getHelpers();
    const result = await confirmPaymentReceived('payee-notif-id');
    expect(result).toEqual({ success: true });
  });

  test('Calls getDoc to fetch the payee notification', async () => {
    const { confirmPaymentReceived } = getHelpers();
    await confirmPaymentReceived('payee-notif-id');
    expect(mockGetDoc).toHaveBeenCalledTimes(1);
  });

  test('Creates an expense document in Firestore', async () => {
    const { confirmPaymentReceived } = getHelpers();
    await confirmPaymentReceived('payee-notif-id');
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const expenseData = mockAddDoc.mock.calls[0][1];
    expect(expenseData.isSettlement).toBe(true);
  });

  test('Expense has correct amount', async () => {
    const { confirmPaymentReceived } = getHelpers();
    await confirmPaymentReceived('payee-notif-id');
    const expenseData = mockAddDoc.mock.calls[0][1];
    expect(expenseData.amount).toBe(25);
  });

  test('Expense paidBy is the payerId', async () => {
    const { confirmPaymentReceived } = getHelpers();
    await confirmPaymentReceived('payee-notif-id');
    const expenseData = mockAddDoc.mock.calls[0][1];
    expect(expenseData.paidBy).toBe('payer-uid');
  });

  test('Updates payee notification to requiresAction false', async () => {
    const { confirmPaymentReceived } = getHelpers();
    await confirmPaymentReceived('payee-notif-id');
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ requiresAction: false, actionStatus: 'confirmed' })
    );
  });

  test('Updates payer log notification when payerLogNotifId present', async () => {
    const { confirmPaymentReceived } = getHelpers();
    await confirmPaymentReceived('payee-notif-id');
    // updateDoc called twice: payee notif + payer log
    expect(mockUpdateDoc).toHaveBeenCalledTimes(2);
    const payerLogUpdate = mockUpdateDoc.mock.calls[1][1];
    expect(payerLogUpdate.status).toBe('confirmed');
  });

  test('Payer log update sets read to false so payer notices', async () => {
    const { confirmPaymentReceived } = getHelpers();
    await confirmPaymentReceived('payee-notif-id');
    const payerLogUpdate = mockUpdateDoc.mock.calls[1][1];
    expect(payerLogUpdate.read).toBe(false);
  });

  test('Skips payer log update when payerLogNotifId is absent', async () => {
    mockGetDoc.mockResolvedValue(makePayeeNotifDoc({ payerLogNotifId: undefined }));
    const { confirmPaymentReceived } = getHelpers();
    await confirmPaymentReceived('payee-notif-id');
    // Only one updateDoc call (payee notif) — no payer log update
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
  });

  test('Throws when payee notification does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { confirmPaymentReceived } = getHelpers();
    await expect(confirmPaymentReceived('bad-id')).rejects.toThrow('Payment notification not found');
    consoleSpy.mockRestore();
  });

  test('Logs error and throws when Firestore call fails', async () => {
    mockGetDoc.mockRejectedValue(new Error('Firestore error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { confirmPaymentReceived } = getHelpers();
    await expect(confirmPaymentReceived('payee-notif-id')).rejects.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith('Error confirming payment:', expect.any(Error));
    consoleSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// declinePaymentReceived (lines 253-282)
// ─────────────────────────────────────────────────────────────────────────────

describe('declinePaymentReceived', () => {

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockServerTimestamp.mockReturnValue('SERVER_TIMESTAMP');
    mockCollection.mockReturnValue('mock-collection');
    mockDoc.mockReturnValue('mock-doc-ref');
    mockGetDoc.mockResolvedValue(makePayeeNotifDoc());
    mockUpdateDoc.mockResolvedValue();
  });

  test('Returns success:true on happy path', async () => {
    const { declinePaymentReceived } = getHelpers();
    const result = await declinePaymentReceived('payee-notif-id');
    expect(result).toEqual({ success: true });
  });

  test('Calls getDoc to fetch the payee notification', async () => {
    const { declinePaymentReceived } = getHelpers();
    await declinePaymentReceived('payee-notif-id');
    expect(mockGetDoc).toHaveBeenCalledTimes(1);
  });

  test('Does NOT create an expense document (balance unchanged)', async () => {
    const { declinePaymentReceived } = getHelpers();
    await declinePaymentReceived('payee-notif-id');
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  test('Updates payee notification to actionStatus declined', async () => {
    const { declinePaymentReceived } = getHelpers();
    await declinePaymentReceived('payee-notif-id');
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ requiresAction: false, actionStatus: 'declined' })
    );
  });

  test('Payee notification is marked as read after decline', async () => {
    const { declinePaymentReceived } = getHelpers();
    await declinePaymentReceived('payee-notif-id');
    const payeeUpdate = mockUpdateDoc.mock.calls[0][1];
    expect(payeeUpdate.read).toBe(true);
  });

  test('Updates payer log to status declined when payerLogNotifId present', async () => {
    const { declinePaymentReceived } = getHelpers();
    await declinePaymentReceived('payee-notif-id');
    expect(mockUpdateDoc).toHaveBeenCalledTimes(2);
    const payerLogUpdate = mockUpdateDoc.mock.calls[1][1];
    expect(payerLogUpdate.status).toBe('declined');
  });

  test('Payer log decline update sets read to false so payer notices', async () => {
    const { declinePaymentReceived } = getHelpers();
    await declinePaymentReceived('payee-notif-id');
    const payerLogUpdate = mockUpdateDoc.mock.calls[1][1];
    expect(payerLogUpdate.read).toBe(false);
  });

  test('Payer log decline message contains payee name', async () => {
    const { declinePaymentReceived } = getHelpers();
    await declinePaymentReceived('payee-notif-id');
    const payerLogUpdate = mockUpdateDoc.mock.calls[1][1];
    expect(payerLogUpdate.message).toContain('Bob');
  });

  test('Skips payer log update when payerLogNotifId is absent', async () => {
    mockGetDoc.mockResolvedValue(makePayeeNotifDoc({ payerLogNotifId: undefined }));
    const { declinePaymentReceived } = getHelpers();
    await declinePaymentReceived('payee-notif-id');
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
  });

  test('Throws when payee notification does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { declinePaymentReceived } = getHelpers();
    await expect(declinePaymentReceived('bad-id')).rejects.toThrow('Payment notification not found');
    consoleSpy.mockRestore();
  });

  test('Logs error and throws when Firestore call fails', async () => {
    mockGetDoc.mockRejectedValue(new Error('Firestore error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { declinePaymentReceived } = getHelpers();
    await expect(declinePaymentReceived('payee-notif-id')).rejects.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith('Error declining payment:', expect.any(Error));
    consoleSpy.mockRestore();
  });
});
