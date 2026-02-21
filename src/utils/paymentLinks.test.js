// src/utils/paymentLinks.test.js
// Test suite for paymentLinks utility - payment link generation and method detection

import {
  generatePayPalLink,
  generateRevolutLink,
  formatBankTransferInfo,
  getAvailablePaymentMethods,
} from './paymentLinks';

// ─────────────────────────────────────────────────────────────────────────────

describe('generatePayPalLink', () => {

  test('Generates correct PayPal link with username and amount', () => {
    const result = generatePayPalLink('johnsmith', 25.50);
    expect(result).toBe('https://paypal.me/johnsmith/25.5EUR');
  });

  test('Strips @ from username', () => {
    const result = generatePayPalLink('@johnsmith', 10);
    expect(result).toBe('https://paypal.me/johnsmith/10EUR');
  });

  test('Uses default EUR currency', () => {
    const result = generatePayPalLink('alice', 50);
    expect(result).toContain('EUR');
  });

  test('Supports custom currency', () => {
    const result = generatePayPalLink('alice', 50, 'USD');
    expect(result).toBe('https://paypal.me/alice/50USD');
  });

  test('Returns null when username is empty string', () => {
    expect(generatePayPalLink('', 10)).toBeNull();
  });

  test('Returns null when username is null', () => {
    expect(generatePayPalLink(null, 10)).toBeNull();
  });

  test('Returns null when username is undefined', () => {
    expect(generatePayPalLink(undefined, 10)).toBeNull();
  });

  test('Handles username with numbers', () => {
    const result = generatePayPalLink('user123', 15);
    expect(result).toBe('https://paypal.me/user123/15EUR');
  });

  test('Generates link starting with https://paypal.me/', () => {
    const result = generatePayPalLink('bob', 20);
    expect(result).toMatch(/^https:\/\/paypal\.me\//);
  });

  test('Handles zero amount', () => {
    const result = generatePayPalLink('alice', 0);
    expect(result).toBe('https://paypal.me/alice/0EUR');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('generateRevolutLink', () => {

  test('Generates correct Revolut link with username', () => {
    const result = generateRevolutLink('johnsmith', 25);
    expect(result).toBe('https://revolut.me/johnsmith');
  });

  test('Strips @ from username', () => {
    const result = generateRevolutLink('@johnsmith', 10);
    expect(result).toBe('https://revolut.me/johnsmith');
  });

  test('Returns null when username is empty string', () => {
    expect(generateRevolutLink('', 10)).toBeNull();
  });

  test('Returns null when username is null', () => {
    expect(generateRevolutLink(null, 10)).toBeNull();
  });

  test('Returns null when username is undefined', () => {
    expect(generateRevolutLink(undefined, 10)).toBeNull();
  });

  test('Generates link starting with https://revolut.me/', () => {
    const result = generateRevolutLink('alice', 30);
    expect(result).toMatch(/^https:\/\/revolut\.me\//);
  });

  test('Handles username with numbers', () => {
    const result = generateRevolutLink('user456', 50);
    expect(result).toBe('https://revolut.me/user456');
  });

  test('Does not include amount in the URL', () => {
    const result = generateRevolutLink('bob', 99);
    expect(result).not.toContain('99');
  });

  test('Does not include currency in the URL', () => {
    const result = generateRevolutLink('bob', 99, 'EUR');
    expect(result).not.toContain('EUR');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('formatBankTransferInfo', () => {

  test('Returns object with all required fields', () => {
    const result = formatBankTransferInfo('Alice', 'IE29AIBK93115212345678', 'AIBKIE2D', 50);
    expect(result).toHaveProperty('recipientName');
    expect(result).toHaveProperty('iban');
    expect(result).toHaveProperty('bic');
    expect(result).toHaveProperty('amount');
    expect(result).toHaveProperty('reference');
  });

  test('Sets recipientName correctly', () => {
    const result = formatBankTransferInfo('Alice Smith', 'IE29AIBK93115212345678', 'AIBKIE2D', 50);
    expect(result.recipientName).toBe('Alice Smith');
  });

  test('Sets IBAN correctly', () => {
    const result = formatBankTransferInfo('Alice', 'IE29AIBK93115212345678', 'AIBKIE2D', 50);
    expect(result.iban).toBe('IE29AIBK93115212345678');
  });

  test('Sets BIC correctly', () => {
    const result = formatBankTransferInfo('Alice', 'IE29AIBK93115212345678', 'AIBKIE2D', 50);
    expect(result.bic).toBe('AIBKIE2D');
  });

  test('Formats amount with EUR prefix by default', () => {
    const result = formatBankTransferInfo('Alice', 'IE29AIBK93115212345678', 'AIBKIE2D', 50);
    expect(result.amount).toBe('EUR 50.00');
  });

  test('Formats amount with 2 decimal places', () => {
    const result = formatBankTransferInfo('Alice', 'IE29AIBK93115212345678', 'AIBKIE2D', 25.5);
    expect(result.amount).toBe('EUR 25.50');
  });

  test('Supports custom currency', () => {
    const result = formatBankTransferInfo('Alice', 'IE29AIBK93115212345678', 'AIBKIE2D', 50, 'USD');
    expect(result.amount).toBe('USD 50.00');
  });

  test('Uses "Not provided" when IBAN is null', () => {
    const result = formatBankTransferInfo('Alice', null, 'AIBKIE2D', 50);
    expect(result.iban).toBe('Not provided');
  });

  test('Uses "Not provided" when BIC is null', () => {
    const result = formatBankTransferInfo('Alice', 'IE29AIBK93115212345678', null, 50);
    expect(result.bic).toBe('Not provided');
  });

  test('Uses "Not provided" when IBAN is empty string', () => {
    const result = formatBankTransferInfo('Alice', '', 'AIBKIE2D', 50);
    expect(result.iban).toBe('Not provided');
  });

  test('Sets reference to SplitSync Settlement', () => {
    const result = formatBankTransferInfo('Alice', 'IE29AIBK93115212345678', 'AIBKIE2D', 50);
    expect(result.reference).toBe('SplitSync Settlement');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('getAvailablePaymentMethods', () => {

  test('Returns empty array when paymentMethods is null', () => {
    expect(getAvailablePaymentMethods(null)).toEqual([]);
  });

  test('Returns empty array when paymentMethods is undefined', () => {
    expect(getAvailablePaymentMethods(undefined)).toEqual([]);
  });

  test('Returns empty array when no methods are set', () => {
    expect(getAvailablePaymentMethods({})).toEqual([]);
  });

  test('Includes PayPal when paypalUsername is set', () => {
    const result = getAvailablePaymentMethods({ paypalUsername: 'alice' });
    expect(result.some(m => m.id === 'paypal')).toBe(true);
  });

  test('Includes Revolut when revolutUsername is set', () => {
    const result = getAvailablePaymentMethods({ revolutUsername: 'alice' });
    expect(result.some(m => m.id === 'revolut')).toBe(true);
  });

  test('Includes bank transfer when iban is set', () => {
    const result = getAvailablePaymentMethods({ iban: 'IE29AIBK93115212345678' });
    expect(result.some(m => m.id === 'bank')).toBe(true);
  });

  test('Returns all three methods when all are set', () => {
    const result = getAvailablePaymentMethods({
      paypalUsername: 'alice',
      revolutUsername: 'alice',
      iban: 'IE29AIBK93115212345678',
    });
    expect(result).toHaveLength(3);
  });

  test('PayPal entry has correct name', () => {
    const result = getAvailablePaymentMethods({ paypalUsername: 'alice' });
    const paypal = result.find(m => m.id === 'paypal');
    expect(paypal.name).toBe('PayPal');
  });

  test('Revolut entry has correct name', () => {
    const result = getAvailablePaymentMethods({ revolutUsername: 'alice' });
    const revolut = result.find(m => m.id === 'revolut');
    expect(revolut.name).toBe('Revolut');
  });

  test('Bank entry has correct name', () => {
    const result = getAvailablePaymentMethods({ iban: 'IE29AIBK93115212345678' });
    const bank = result.find(m => m.id === 'bank');
    expect(bank.name).toBe('Bank Transfer');
  });

  test('PayPal entry includes username', () => {
    const result = getAvailablePaymentMethods({ paypalUsername: 'alice' });
    const paypal = result.find(m => m.id === 'paypal');
    expect(paypal.username).toBe('alice');
  });

  test('Revolut entry includes username', () => {
    const result = getAvailablePaymentMethods({ revolutUsername: 'bob' });
    const revolut = result.find(m => m.id === 'revolut');
    expect(revolut.username).toBe('bob');
  });

  test('Bank entry includes IBAN', () => {
    const result = getAvailablePaymentMethods({ iban: 'IE29AIBK93115212345678', bic: 'AIBKIE2D' });
    const bank = result.find(m => m.id === 'bank');
    expect(bank.iban).toBe('IE29AIBK93115212345678');
    expect(bank.bic).toBe('AIBKIE2D');
  });

  test('PayPal description contains username', () => {
    const result = getAvailablePaymentMethods({ paypalUsername: 'alice' });
    const paypal = result.find(m => m.id === 'paypal');
    expect(paypal.description).toContain('alice');
  });

  test('Does not include PayPal when paypalUsername is missing', () => {
    const result = getAvailablePaymentMethods({ revolutUsername: 'alice' });
    expect(result.some(m => m.id === 'paypal')).toBe(false);
  });

  test('Does not include Revolut when revolutUsername is missing', () => {
    const result = getAvailablePaymentMethods({ paypalUsername: 'alice' });
    expect(result.some(m => m.id === 'revolut')).toBe(false);
  });
});