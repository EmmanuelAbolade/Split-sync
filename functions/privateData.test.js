// Run: node --test functions/privateData.test.js
const test = require('node:test');
const assert = require('node:assert');
const pd = require('./privateData');

// Minimal in-memory Firestore stand-in (doc().get/set/update)
const DELETE = Symbol('delete');
const FieldValue = { delete: () => DELETE };
function fakeDb(initial) {
  const store = JSON.parse(JSON.stringify(initial));
  const deepMerge = (a, b) => {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) {
      out[k] = v && typeof v === 'object' && !Array.isArray(v) && a?.[k] && typeof a[k] === 'object'
        ? deepMerge(a[k], v) : v;
    }
    return out;
  };
  return {
    store,
    doc: (path) => ({
      get: async () => ({ exists: path in store, data: () => store[path] }),
      set: async (data, opts) => { store[path] = opts?.merge ? deepMerge(store[path] || {}, data) : data; },
      update: async (data) => {
        if (!(path in store)) throw new Error('not found');
        for (const [k, v] of Object.entries(data)) {
          if (v === DELETE) delete store[path][k]; else store[path][k] = v;
        }
      },
    }),
  };
}

test('mergePrivate prefers the private doc and falls back to legacy fields', () => {
  assert.deepStrictEqual(pd.mergePrivate({}, { paymentMethods: { paypalUsername: 'a' }, phoneNumber: '+1' }),
    { paymentMethods: { paypalUsername: 'a' }, phoneNumber: '+1' });
  assert.deepStrictEqual(pd.mergePrivate({ phoneNumber: '+2' }, { phoneNumber: '+1' }).phoneNumber, '+2');
  assert.deepStrictEqual(pd.mergePrivate(), { paymentMethods: {}, phoneNumber: '' });
});

test('publicPaymentView never exposes the IBAN ciphertext', () => {
  const v = pd.publicPaymentView({ paypalUsername: 'p', encryptedIBAN: 'v2:secret', bic: 'AIBKIE2D' });
  assert.deepStrictEqual(v, { paypalUsername: 'p', revolutUsername: null, bic: 'AIBKIE2D', hasIban: true });
  assert.ok(!JSON.stringify(v).includes('secret'));
});

test('loadPrivate migrates legacy public fields into the private doc and deletes them', async () => {
  const db = fakeDb({ 'users/u1': { displayName: 'A', phoneHash: 'h', phoneNumber: '+353', paymentMethods: { revolutUsername: 'r' } } });
  const { data } = await pd.loadPrivate(db, FieldValue, 'u1');
  assert.deepStrictEqual(data, { paymentMethods: { revolutUsername: 'r' }, phoneNumber: '+353' });
  assert.deepStrictEqual(db.store['users/u1/private/details'], data);
  assert.deepStrictEqual(db.store['users/u1'], { displayName: 'A', phoneHash: 'h' }); // hash kept for contact sync
});

test('loadPrivate leaves already-migrated users untouched', async () => {
  const db = fakeDb({ 'users/u2': { displayName: 'B' }, 'users/u2/private/details': { paymentMethods: { paypalUsername: 'b' }, phoneNumber: '' } });
  const { data } = await pd.loadPrivate(db, FieldValue, 'u2');
  assert.strictEqual(data.paymentMethods.paypalUsername, 'b');
  assert.deepStrictEqual(db.store['users/u2'], { displayName: 'B' });
});
