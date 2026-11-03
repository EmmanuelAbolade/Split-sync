// Run: node --test functions/iban.test.js
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const CryptoJS = require('crypto-js');
const iban = require('./iban');

const KEY = crypto.randomBytes(32).toString('hex');
const SAMPLE = 'IE29AIBK93115212345678';

test('normaliseIban strips spaces, uppercases, rejects junk', () => {
  assert.strictEqual(iban.normaliseIban('ie29 aibk 9311 5212 3456 78'), SAMPLE);
  assert.strictEqual(iban.normaliseIban('not-an-iban'), null);
  assert.strictEqual(iban.normaliseIban(42), null);
});

test('v2 round trip', () => {
  const enc = iban.encryptV2(SAMPLE, KEY);
  assert.ok(iban.isV2(enc));
  assert.notStrictEqual(enc, iban.encryptV2(SAMPLE, KEY)); // random IV
  assert.deepStrictEqual(iban.decryptAny(enc, KEY, null), { iban: SAMPLE, legacy: false });
});

test('v2 rejects tampering and wrong key', () => {
  const enc = iban.encryptV2(SAMPLE, KEY);
  const parts = enc.split(':');
  const ct = Buffer.from(parts[3], 'base64'); ct[0] ^= 1;
  parts[3] = ct.toString('base64');
  assert.throws(() => iban.decryptAny(parts.join(':'), KEY, null));
  assert.throws(() => iban.decryptAny(enc, crypto.randomBytes(32).toString('hex'), null));
});

test('legacy CryptoJS ciphertext is readable with the legacy key', () => {
  const legacy = CryptoJS.AES.encrypt(SAMPLE, 'old-pass').toString();
  assert.deepStrictEqual(iban.decryptAny(legacy, KEY, 'old-pass'), { iban: SAMPLE, legacy: true });
  assert.throws(() => iban.decryptAny(legacy, KEY, 'wrong-pass'));
  assert.throws(() => iban.decryptAny(legacy, KEY, ''));
});

test('shareGroup requires both users in members', () => {
  const g = { members: [{ userId: 'a' }, { userId: 'b' }], memberIds: ['a', 'b', 'c'] };
  assert.ok(iban.shareGroup(g, 'a', 'b'));
  assert.ok(!iban.shareGroup(g, 'a', 'c')); // c only in memberIds (left)
  assert.ok(!iban.shareGroup(null, 'a', 'b'));
});
