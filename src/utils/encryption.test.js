// src/utils/encryption.test.js
// IBAN validation and display helpers. Encryption itself moved server-side
// (functions/iban.js, tested by functions/iban.test.js).
import {
  validateIBAN,
  formatIBANDisplay,
  maskIBAN
} from './encryption';

describe('IBAN Validation', () => {
  
  test('Accepts valid Irish IBAN', () => {
    expect(validateIBAN('IE29AIBK93115212345678')).toBe(true);
    expect(validateIBAN('IE29 AIBK 9311 5212 3456 78')).toBe(true);
  });

  test('Accepts valid German IBAN', () => {
    expect(validateIBAN('DE89370400440532013000')).toBe(true);
  });

  test('Accepts valid French IBAN', () => {
    expect(validateIBAN('FR1420041010050500013M02606')).toBe(true);
  });

  test('Accepts valid UK IBAN', () => {
    expect(validateIBAN('GB29NWBK60161331926819')).toBe(true);
  });

  test('Rejects IBAN starting with numbers', () => {
    expect(validateIBAN('12AIBK93115212345678')).toBe(false);
  });

  test('Rejects IBAN with special characters', () => {
    expect(validateIBAN('IE29-AIBK-9311-5212-3456-78')).toBe(false);
  });

  test('Rejects IBAN with invalid format', () => {
  expect(validateIBAN('IE29')).toBe(false); // Only country code + check digits
  expect(validateIBAN('IEABC')).toBe(false); // No check digits
});

  test('Rejects IBAN with only country code', () => {
    expect(validateIBAN('IE')).toBe(false);
  });

  test('Allows empty IBAN (optional field)', () => {
    expect(validateIBAN('')).toBe(true);
    expect(validateIBAN(null)).toBe(true);
    expect(validateIBAN(undefined)).toBe(true);
  });

  test('Handles lowercase IBAN', () => {
    expect(validateIBAN('ie29aibk93115212345678')).toBe(true);
  });

  test('Handles mixed case IBAN', () => {
    expect(validateIBAN('Ie29AiBk93115212345678')).toBe(true);
  });

  test('Handles IBAN with multiple spaces', () => {
    expect(validateIBAN('IE29  AIBK  9311  5212  3456  78')).toBe(true);
  });
});

describe('IBAN Formatting', () => {
  
  test('Formats IBAN with spaces every 4 characters', () => {
    const formatted = formatIBANDisplay('IE29AIBK93115212345678');
    expect(formatted).toBe('IE29 AIBK 9311 5212 3456 78');
  });

  test('Handles already spaced IBAN', () => {
    const formatted = formatIBANDisplay('IE29 AIBK 9311 5212 3456 78');
    expect(formatted).toBe('IE29 AIBK 9311 5212 3456 78');
  });

  test('Returns empty string for null/undefined', () => {
    expect(formatIBANDisplay('')).toBe('');
    expect(formatIBANDisplay(null)).toBe('');
    expect(formatIBANDisplay(undefined)).toBe('');
  });

  test('Converts to uppercase when formatting', () => {
    const formatted = formatIBANDisplay('ie29aibk93115212345678');
    expect(formatted).toBe('IE29 AIBK 9311 5212 3456 78');
  });

  test('Formats short IBAN correctly', () => {
    const formatted = formatIBANDisplay('IE29AIBK');
    expect(formatted).toBe('IE29 AIBK');
  });
});

describe('IBAN Masking', () => {
  
  test('Masks IBAN showing country code and last 4 digits', () => {
    const masked = maskIBAN('IE29AIBK93115212345678');
    expect(masked).toMatch(/^IE\*+5678$/);
    expect(masked).toContain('IE');
    expect(masked).toContain('5678');
  });

  test('Handles IBAN with spaces', () => {
    const masked = maskIBAN('IE29 AIBK 9311 5212 3456 78');
    expect(masked).toContain('IE');
    expect(masked).toContain('78');
  });

  test('Returns full IBAN if shorter than 4 characters', () => {
    expect(maskIBAN('IE29')).toBe('IE29');
    expect(maskIBAN('IE')).toBe('IE');
  });

  test('Returns empty string for null/undefined', () => {
    expect(maskIBAN('')).toBe('');
    expect(maskIBAN(null)).toBe('');
    expect(maskIBAN(undefined)).toBe('');
  });

  test('Masked IBAN hides middle characters', () => {
    const masked = maskIBAN('IE29AIBK93115212345678');
    expect(masked).not.toContain('AIBK');
    expect(masked).not.toContain('9311');
  });
});