/**
 * @file encryption.js
 * @brief IBAN validation and display helpers.
 *
 * @details IBAN encryption moved server-side on 2026-11-03 (functions/iban.js,
 * AES-256-GCM with a key in Secret Manager). The previous client-side
 * encryptData/decryptData used a key from REACT_APP_ENCRYPTION_KEY, which is
 * bundled into the public JavaScript, so it offered no real protection.
 * Use utils/ibanService.js (encryptIban / fetchIban) instead.
 *
 * @author Emmanuel Abolade (C00288657)
 * @date 2025-2026
 * @version 2.0.0
 * @copyright SETU Carlow — Final Year Project 2025/2026
 */

// src/utils/encryption.js
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
