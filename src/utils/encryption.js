// src/utils/encryption.js
import CryptoJS from 'crypto-js';

// IMPORTANT: In production, this key should be stored securely
// For now, we'll use an environment variable
const ENCRYPTION_KEY = process.env.REACT_APP_ENCRYPTION_KEY || 'split-sync-secure-key-2026';

/**
 * Encrypts sensitive data (like IBAN) before storing in Firestore
 * @param {string} data - The data to encrypt
 * @returns {string} - Encrypted data as a string
 */
export const encryptData = (data) => {
  if (!data || data.trim() === '') return '';
  
  try {
    const encrypted = CryptoJS.AES.encrypt(data.trim(), ENCRYPTION_KEY).toString();
    return encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypts encrypted data (like IBAN) when retrieving from Firestore
 * @param {string} encryptedData - The encrypted data
 * @returns {string} - Decrypted data as plain text
 */
export const decryptData = (encryptedData) => {
  if (!encryptedData || encryptedData.trim() === '') return '';
  
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Validates IBAN format
 * @param {string} iban - The IBAN to validate
 * @returns {boolean} - True if valid format
 */
export const validateIBAN = (iban) => {
  if (!iban) return true; // Allow empty
  
  // Remove spaces and convert to uppercase
  const cleanIBAN = iban.replace(/\s/g, '').toUpperCase();
  
  // Basic IBAN format: 2 letters + 2 digits + up to 30 alphanumeric
  const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/;
  
  return ibanRegex.test(cleanIBAN);
};

/**
 * Formats IBAN with spaces for display (every 4 characters)
 * @param {string} iban - The IBAN to format
 * @returns {string} - Formatted IBAN with spaces
 */
export const formatIBANDisplay = (iban) => {
  if (!iban) return '';
  
  // Remove existing spaces
  const cleanIBAN = iban.replace(/\s/g, '').toUpperCase();
  
  // Add space every 4 characters
  return cleanIBAN.match(/.{1,4}/g)?.join(' ') || cleanIBAN;
};

/**
 * Masks IBAN for secure display (shows only last 4 characters)
 * @param {string} iban - The IBAN to mask
 * @returns {string} - Masked IBAN like "IE** **** **** 6789"
 */
export const maskIBAN = (iban) => {
  if (!iban) return '';
  
  const cleanIBAN = iban.replace(/\s/g, '');
  
  if (cleanIBAN.length <= 4) return cleanIBAN;
  
  // Show first 2 chars (country code) and last 4 digits
  const countryCode = cleanIBAN.substring(0, 2);
  const lastFour = cleanIBAN.substring(cleanIBAN.length - 4);
  const middleMask = '*'.repeat(Math.min(cleanIBAN.length - 6, 12));
  
  return `${countryCode}${middleMask}${lastFour}`;
};