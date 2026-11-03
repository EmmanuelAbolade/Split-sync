// functions/iban.js
// Server-side IBAN encryption.
//
// Why: IBANs used to be encrypted in the browser with a key from
// REACT_APP_ENCRYPTION_KEY. Every REACT_APP_* value is bundled into the public
// JavaScript, so anyone could decrypt any stored IBAN. Encryption now happens
// only here, with a key held in Secret Manager, and a plain IBAN is returned
// only to its owner or to someone who shares a group with the owner.
//
// Stored format:  v2:<iv b64>:<auth tag b64>:<ciphertext b64>   (AES-256-GCM)
// Legacy format:  CryptoJS.AES passphrase output ("U2FsdGVkX1...") — still
//                 readable with LEGACY_IBAN_KEY and re-encrypted to v2 on read.

const crypto   = require('crypto');
const CryptoJS = require('crypto-js');

const V2_PREFIX = 'v2:';

/** Uppercase, strip spaces, basic structural IBAN check (country + check digits + BBAN). */
function normaliseIban(raw) {
  if (typeof raw !== 'string') return null;
  const iban = raw.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return null;
  return iban;
}

function keyBuffer(keyHex) {
  const key = Buffer.from(String(keyHex || '').trim(), 'hex');
  if (key.length !== 32) throw new Error('IBAN_ENCRYPTION_KEY must be 32 bytes of hex');
  return key;
}

function encryptV2(plain, keyHex) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer(keyHex), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${V2_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

function isV2(stored) {
  return typeof stored === 'string' && stored.startsWith(V2_PREFIX);
}

/**
 * Decrypts either format. Returns { iban, legacy } or throws.
 */
function decryptAny(stored, keyHex, legacyKey) {
  if (isV2(stored)) {
    const [ivB64, tagB64, ctB64] = stored.slice(V2_PREFIX.length).split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer(keyHex), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const plain = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
    return { iban: plain, legacy: false };
  }
  if (!legacyKey) throw new Error('Legacy IBAN key not configured');
  const plain = CryptoJS.AES.decrypt(stored, legacyKey).toString(CryptoJS.enc.Utf8);
  if (!plain) throw new Error('Legacy IBAN could not be decrypted');
  return { iban: plain, legacy: true };
}

/** True when both users are current members of the group document data. */
function shareGroup(groupData, uidA, uidB) {
  const ids = new Set((groupData?.members || []).map(m => m.userId));
  return ids.has(uidA) && ids.has(uidB);
}

module.exports = { normaliseIban, encryptV2, decryptAny, isV2, shareGroup };
