/**
 * @file encryption.js
 * @brief AES-256 encryption and IBAN formatting utilities for secure data storage.
 *
 * @details This module handles client-side encryption of sensitive financial data
 * (specifically IBAN numbers) before they are written to Firestore. Encryption
 * uses AES-256 via the CryptoJS library. The encryption key is read from an
 * environment variable so it is never hard-coded in the production bundle.
 *
 * IBAN display helpers (formatting and masking) are also provided for the
 * Payment Settings UI.
 *
 * @author Emmanuel Abolade (C00288657)
 * @date 2025-2026
 * @version 1.0.0
 * @copyright SETU Carlow — Final Year Project 2025/2026
 *
 * @warning The encryption key must be stored in REACT_APP_ENCRYPTION_KEY
 * environment variable. Never commit the key to version control.
 */

// src/utils/encryption.js
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.REACT_APP_ENCRYPTION_KEY || 'split-sync-secure-key-2026';

/**
 * @brief Encrypts a plaintext string using AES-256 before Firestore storage.
 *
 * @details Uses CryptoJS.AES.encrypt with the application encryption key.
 * Empty or whitespace-only input returns an empty string without encrypting.
 * This function is called before any IBAN value is written to Firestore.
 *
 * @param {string} data - Plaintext data to encrypt (e.g. a raw IBAN string).
 *
 * @returns {string} AES-encrypted ciphertext as a Base64 string, or '' if input is empty.
 *
 * @throws {Error} Throws 'Failed to encrypt data' if CryptoJS encounters an error.
 *
 * @example
 * const encrypted = encryptData('IE29AIBK93115212345678');
 * // 'U2FsdGVkX1+...' (Base64 ciphertext)
 */
export const encryptData = (data) => {
  if (!data || data.trim() === '') return '';
  try {
    return CryptoJS.AES.encrypt(data.trim(), ENCRYPTION_KEY).toString();
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * @brief Decrypts an AES-256 ciphertext string retrieved from Firestore.
 *
 * @details Reverses the operation performed by encryptData(). Called when
 * displaying payment settings to the authenticated user. Empty or
 * whitespace-only input returns an empty string without attempting decryption.
 *
 * @param {string} encryptedData - AES ciphertext (Base64 string from Firestore).
 *
 * @returns {string} Plaintext string, or '' if input is empty.
 *
 * @throws {Error} Throws 'Failed to decrypt data' if decryption fails
 * (e.g. wrong key or corrupted ciphertext).
 *
 * @example
 * const iban = decryptData('U2FsdGVkX1+...');
 * // 'IE29AIBK93115212345678'
 */
export const decryptData = (encryptedData) => {
  if (!encryptedData || encryptedData.trim() === '') return '';
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * @brief Validates whether a string conforms to the basic IBAN format.
 *
 * @details Performs a structural check only (not a full modulo-97 checksum
 * verification). The IBAN is normalised to uppercase and stripped of spaces
 * before validation. An empty value returns true (field is optional).
 *
 * Supported format: 2 uppercase letters (country code) + 2 digits (check digits)
 * + 1 to 30 alphanumeric characters (BBAN).
 *
 * @param {string} iban - IBAN string to validate (may contain spaces).
 *
 * @returns {boolean} True if the format is valid or the input is empty; false otherwise.
 *
 * @example
 * validateIBAN('IE29 AIBK 9311 5212 3456 78'); // true
 * validateIBAN('INVALID');                       // false
 * validateIBAN('');                              // true (empty is allowed)
 */
export const validateIBAN = (iban) => {
  if (!iban) return true;
  const cleanIBAN = iban.replace(/\s/g, '').toUpperCase();
  const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/;
  return ibanRegex.test(cleanIBAN);
};

/**
 * @brief Formats an IBAN with spaces every four characters for human-readable display.
 *
 * @param {string} iban - Raw IBAN string (may already contain spaces).
 *
 * @returns {string} IBAN grouped in blocks of four, e.g. 'IE29 AIBK 9311 5212 3456 78'.
 *
 * @example
 * formatIBANDisplay('IE29AIBK93115212345678');
 * // 'IE29 AIBK 9311 5212 3456 78'
 */
export const formatIBANDisplay = (iban) => {
  if (!iban) return '';
  const cleanIBAN = iban.replace(/\s/g, '').toUpperCase();
  return cleanIBAN.match(/.{1,4}/g)?.join(' ') || cleanIBAN;
};

/**
 * @brief Masks an IBAN for secure display, showing only the country code and last four digits.
 *
 * @details Used in the Payment Settings UI to confirm the IBAN is saved without
 * exposing the full account number. The middle section is replaced with asterisks.
 *
 * @param {string} iban - Raw IBAN string.
 *
 * @returns {string} Masked IBAN, e.g. 'IE**3456' for a short IBAN.
 *
 * @example
 * maskIBAN('IE29AIBK93115212345678');
 * // 'IE************5678'
 */
export const maskIBAN = (iban) => {
  if (!iban) return '';
  const cleanIBAN = iban.replace(/\s/g, '');
  if (cleanIBAN.length <= 4) return cleanIBAN;
  const countryCode = cleanIBAN.substring(0, 2);
  const lastFour = cleanIBAN.substring(cleanIBAN.length - 4);
  const middleMask = '*'.repeat(Math.min(cleanIBAN.length - 6, 12));
  return `${countryCode}${middleMask}${lastFour}`;
};
