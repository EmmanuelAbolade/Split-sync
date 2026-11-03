// src/utils/ibanService.js
// Client wrapper for the server-side IBAN functions (functions/iban.js).
// The browser never holds an encryption key: it sends a plain IBAN to be
// encrypted, and asks the server for a decrypted IBAN only when the caller is
// the owner or shares a group with the owner.

import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../services/firebase';

const fns = () => getFunctions(app);

/** Encrypts an IBAN server-side. Returns the ciphertext to store as paymentMethods.encryptedIBAN. */
export async function encryptIban(iban) {
  const res = await httpsCallable(fns(), 'encryptIban')({ iban });
  return res.data.encryptedIBAN;
}

/**
 * Fetches a user's plain IBAN.
 * @param {string} userId  owner of the IBAN
 * @param {string} [groupId] required when userId is not the signed-in user
 * @returns {Promise<string|null>}
 */
export async function fetchIban(userId, groupId) {
  try {
    const res = await httpsCallable(fns(), 'getIban')({ userId, ...(groupId && { groupId }) });
    return res.data?.iban || null;
  } catch (err) {
    console.error('Could not load IBAN:', err?.message);
    return null;
  }
}
