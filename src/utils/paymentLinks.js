/**
 * @file paymentLinks.js
 * @brief Utility functions for generating payment links and retrieving available payment methods.
 *
 * @details This module generates deep links for PayPal and Revolut payments,
 * formats SEPA bank transfer information, and determines which payment methods
 * a recipient has configured. All link generation is client-side — no API
 * calls are made to payment providers from this module.
 *
 * @author Emmanuel Abolade (C00288657)
 * @date 2025-2026
 * @version 1.0.0
 * @copyright SETU Carlow — Final Year Project 2025/2026
 */

// src/utils/paymentLinks.js

/**
 * @brief Generates a PayPal.me deep link for a direct payment.
 *
 * @details Constructs a PayPal.me URL in the format:
 * https://paypal.me/{username}/{amount}{currency}
 * The @ prefix is stripped from the username if present.
 * Opening this link redirects the payer to the PayPal app or website
 * with the amount pre-filled.
 *
 * @param {string} username - PayPal.me username (with or without leading @).
 * @param {number} amount   - Payment amount.
 * @param {string} [currency='EUR'] - ISO 4217 currency code.
 *
 * @returns {string|null} Full PayPal.me URL, or null if username is not provided.
 *
 * @example
 * generatePayPalLink('alice123', 30.00, 'EUR');
 * // 'https://paypal.me/alice123/30EUR'
 */
export const generatePayPalLink = (username, amount, currency = 'EUR') => {
  if (!username) return null;
  const cleanUsername = username.replace('@', '');
  return `https://paypal.me/${cleanUsername}/${amount}${currency}`;
};

/**
 * @brief Generates a Revolut deep link for a direct payment.
 *
 * @details Constructs a Revolut.me URL in the format:
 * https://revolut.me/{username}
 * The @ prefix is stripped from the username if present.
 * Opening this link redirects the payer to the Revolut app.
 *
 * @note Amount and currency are not included in the Revolut link as Revolut
 * does not support pre-filled amounts via deep links at this time.
 * The amount is instead copied to the clipboard automatically when the
 * link is opened so the payer can paste it manually.
 *
 * @param {string} username - Revolut username (with or without leading @).
 * @param {number} amount   - Payment amount (reserved for future use).
 * @param {string} [currency='EUR'] - ISO 4217 currency code (reserved for future use).
 *
 * @returns {string|null} Full Revolut.me URL, or null if username is not provided.
 *
 * @example
 * generateRevolutLink('alice123', 30.00, 'EUR');
 * // 'https://revolut.me/alice123'
 */
export const generateRevolutLink = (username, amount, currency = 'EUR') => {
  if (!username) return null;
  const cleanUsername = username.replace('@', '');
  return `https://revolut.me/${cleanUsername}`;
};

/**
 * @brief Formats SEPA bank transfer details into a structured object for display.
 *
 * @details Returns a plain object containing all the fields a payer needs to
 * initiate a SEPA bank transfer from their own banking application.
 * The reference is always set to 'SplitSync Settlement' for easy identification.
 *
 * @param {string} recipientName - Full name of the payment recipient.
 * @param {string} iban          - IBAN of the recipient's bank account.
 * @param {string} bic           - BIC/SWIFT code of the recipient's bank.
 * @param {number} amount        - Transfer amount.
 * @param {string} [currency='EUR'] - ISO 4217 currency code.
 *
 * @returns {Object} Formatted transfer details:
 *   - {string} recipientName - Recipient full name.
 *   - {string} iban          - IBAN or 'Not provided'.
 *   - {string} bic           - BIC or 'Not provided'.
 *   - {string} amount        - Formatted as '{currency} {amount.toFixed(2)}'.
 *   - {string} reference     - Always 'SplitSync Settlement'.
 */
export const formatBankTransferInfo = (recipientName, iban, bic, amount, currency = 'EUR') => {
  return {
    recipientName,
    iban: iban || 'Not provided',
    bic: bic || 'Not provided',
    amount: `${currency} ${amount.toFixed(2)}`,
    reference: 'SplitSync Settlement',
  };
};

/**
 * @brief Returns the list of payment methods available for a given user.
 *
 * @details Inspects a user's stored payment methods object and builds an array
 * of available method descriptors. Only methods with a non-empty value are
 * included. The order is: PayPal, Revolut, Bank Transfer (SEPA).
 *
 * @param {Object} paymentMethods - Payment methods object from Firestore user document:
 *   - {string} [paypalUsername]  - PayPal.me username.
 *   - {string} [revolutUsername] - Revolut username.
 *   - {string} [iban]            - Encrypted IBAN (decrypted before passing in).
 *   - {string} [bic]             - BIC/SWIFT code.
 *
 * @returns {Array<Object>} Array of available method objects, each containing:
 *   - {string} id          - Unique method identifier ('paypal' | 'revolut' | 'bank').
 *   - {string} name        - Display name.
 *   - {string} username    - Username (PayPal/Revolut only).
 *   - {string} iban        - IBAN (bank only).
 *   - {string} bic         - BIC (bank only).
 *   - {string} description - Human-readable description for the UI.
 *
 * @example
 * const methods = getAvailablePaymentMethods({ paypalUsername: 'alice', revolutUsername: 'alice' });
 * // [{ id: 'paypal', name: 'PayPal', ... }, { id: 'revolut', name: 'Revolut', ... }]
 */
export const getAvailablePaymentMethods = (paymentMethods) => {
  if (!paymentMethods) return [];

  const available = [];

  if (paymentMethods.paypalUsername) {
    available.push({
      id: 'paypal',
      name: 'PayPal',
      username: paymentMethods.paypalUsername,
      description: `Pay via PayPal (@${paymentMethods.paypalUsername})`,
    });
  }

  if (paymentMethods.revolutUsername) {
    available.push({
      id: 'revolut',
      name: 'Revolut',
      username: paymentMethods.revolutUsername,
      description: `Pay via Revolut (@${paymentMethods.revolutUsername})`,
    });
  }

  if (paymentMethods.iban) {
    available.push({
      id: 'bank',
      name: 'Bank Transfer',
      iban: paymentMethods.iban,
      bic: paymentMethods.bic,
      description: 'SEPA bank transfer',
    });
  }

  return available;
};
