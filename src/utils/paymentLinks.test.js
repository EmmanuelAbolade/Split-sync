// src/utils/paymentLinks.test.js
// Test suite for paymentLinks utility - PayPal, Revolut, bank transfer, available methods

import {
  generatePayPalLink,
  generateRevolutLink,
  formatBankTransferInfo,
  getAvailablePaymentMethods,
} from './paymentLinks';

// ─────────────────────────────────────────────────────────────────────────────

describe('generatePayPalLink', () => {

  test('Returns null when username is empty string', () => {
    expect(generatePayPalLink('')).toBeNull();
  });

  test('Returns null when username is null', () => {
    expect(generatePayPalLink(null)).toBeNull();
  });

  test('Returns null when username is undefined', () => {
    expect(generatePayPalLink(undefined)).toBeNull();
  });

  test('Generates correct PayPal link with plain username', () => {
    expect(generatePayPalLink('johndoe', 50, 'EUR'))
      .toBe('https://paypal.me/johndoe/50EUR');
  });

  test('Strips @ symbol from username', () => {
    expect(generatePayPalLink('@johndoe', 50, 'EUR'))
      .toBe('https://paypal.me/johndoe/50EUR');
  });

  test('Uses EUR as default currency', () => {
    expect(generatePayPalLink('johndoe', 25))
      .toBe('https://paypal.me/johndoe/25EUR');
  });

  test('Supports USD currency', () => {
    expect(generatePayPalLink('johndoe', 100, 'USD'))
      .toBe('https://paypal.me/johndoe/100USD');
  });

  test('Supports decimal amounts', () => {
    expect(generatePayPalLink('johndoe', 12.5, 'EUR'))
      .toBe('https://paypal.me/johndoe/12.5EUR');
  });

  test('Link starts with https://paypal.me/', () => {
    const link = generatePayPalLink('alice', 10);
    expect(link).toMatch(/^https:\/\/paypal\.me\//);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('generateRevolutLink', () => {

  test('Returns null when username is empty string', () => {
    expect(generateRevolutLink('')).toBeNull();
  });

  test('Returns null when username is null', () => {
    expect(generateRevolutLink(null)).toBeNull();
  });

  test('Returns null when username is undefined', () => {
    expect(generateRevolutLink(undefined)).toBeNull();
  });

  test('Generates correct Revolut link with plain username', () => {
    expect(generateRevolutLink('johndoe', 50, 'EUR'))
      .toBe('https://revolut.me/johndoe');
  });

  test('Strips @ symbol from username', () => {
    expect(generateRevolutLink('@johndoe', 50, 'EUR'))
      .toBe('https://revolut.me/johndoe');
  });

  test('Link starts with https://revolut.me/', () => {
    const link = generateRevolutLink('alice', 10);
    expect(link).toMatch(/^https:\/\/revolut\.me\//);
  });

  test('Returns same link regardless of amount', () => {
    const link1 = generateRevolutLink('alice', 10);
    const link2 = generateRevolutLink('alice', 200);
    expect(link1).toBe(link2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('formatBankTransferInfo', () => {

  test('Returns object with correct recipientName', () => {
    const result = formatBankTransferInfo('Alice', 'IE12BOFI90001710023456', 'BOFIIE2D', 50);
    expect(result.recipientName).toBe('Alice');
  });

  test('Returns object with formatted IBAN', () => {
    const result = formatBankTransferInfo('Alice', 'IE12BOFI90001710023456', 'BOFIIE2D', 50);
    expect(result.iban).toBe('IE12BOFI90001710023456');
  });

  test('Returns object with BIC', () => {
    const result = formatBankTransferInfo('Alice', 'IE12BOFI90001710023456', 'BOFIIE2D', 50);
    expect(result.bic).toBe('BOFIIE2D');
  });

  test('Returns formatted amount with currency', () => {
    const result = formatBankTransferInfo('Alice', 'IE12', 'BOFI', 50, 'EUR');
    expect(result.amount).toBe('EUR 50.00');
  });

  test('Uses EUR as default currency', () => {
    const result = formatBankTransferInfo('Alice', 'IE12', 'BOFI', 75);
    expect(result.amount).toBe('EUR 75.00');
  });

  test('Returns "Not provided" when IBAN is null', () => {
    const result = formatBankTransferInfo('Alice', null, 'BOFI', 50);
    expect(result.iban).toBe('Not provided');
  });

  test('Returns "Not provided" when BIC is null', () => {
    const result = formatBankTransferInfo('Alice', 'IE12', null, 50);
    expect(result.bic).toBe('Not provided');
  });

  test('Returns "Not provided" when IBAN is undefined', () => {
    const result = formatBankTransferInfo('Alice', undefined, undefined, 50);
    expect(result.iban).toBe('Not provided');
    expect(result.bic).toBe('Not provided');
  });

  test('Includes reference field with SplitSync Settlement', () => {
    const result = formatBankTransferInfo('Alice', 'IE12', 'BOFI', 50);
    expect(result.reference).toBe('SplitSync Settlement');
  });

  test('Formats decimal amounts to 2 decimal places', () => {
    const result = formatBankTransferInfo('Alice', 'IE12', 'BOFI', 33.3333);
    expect(result.amount).toBe('EUR 33.33');
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
    const methods = getAvailablePaymentMethods({ paypalUsername: 'johndoe' });
    expect(methods.find(m => m.id === 'paypal')).toBeTruthy();
  });

  test('PayPal entry has correct name', () => {
    const methods = getAvailablePaymentMethods({ paypalUsername: 'johndoe' });
    const paypal = methods.find(m => m.id === 'paypal');
    expect(paypal.name).toBe('PayPal');
  });

  test('PayPal entry includes username', () => {
    const methods = getAvailablePaymentMethods({ paypalUsername: 'johndoe' });
    const paypal = methods.find(m => m.id === 'paypal');
    expect(paypal.username).toBe('johndoe');
  });

  test('PayPal description mentions username', () => {
    const methods = getAvailablePaymentMethods({ paypalUsername: 'johndoe' });
    const paypal = methods.find(m => m.id === 'paypal');
    expect(paypal.description).toContain('johndoe');
  });

  test('Includes Revolut when revolutUsername is set', () => {
    const methods = getAvailablePaymentMethods({ revolutUsername: 'alice' });
    expect(methods.find(m => m.id === 'revolut')).toBeTruthy();
  });

  test('Revolut entry has correct name', () => {
    const methods = getAvailablePaymentMethods({ revolutUsername: 'alice' });
    const revolut = methods.find(m => m.id === 'revolut');
    expect(revolut.name).toBe('Revolut');
  });

  test('Revolut entry includes username', () => {
    const methods = getAvailablePaymentMethods({ revolutUsername: 'alice' });
    const revolut = methods.find(m => m.id === 'revolut');
    expect(revolut.username).toBe('alice');
  });

  test('Includes Bank Transfer when iban is set', () => {
    const methods = getAvailablePaymentMethods({ iban: 'IE12BOFI90001710023456' });
    expect(methods.find(m => m.id === 'bank')).toBeTruthy();
  });

  test('Bank Transfer entry has correct name', () => {
    const methods = getAvailablePaymentMethods({ iban: 'IE12' });
    const bank = methods.find(m => m.id === 'bank');
    expect(bank.name).toBe('Bank Transfer');
  });

  test('Bank Transfer entry includes IBAN', () => {
    const methods = getAvailablePaymentMethods({ iban: 'IE12BOFI90001710023456' });
    const bank = methods.find(m => m.id === 'bank');
    expect(bank.iban).toBe('IE12BOFI90001710023456');
  });

  test('Bank Transfer entry includes BIC', () => {
    const methods = getAvailablePaymentMethods({ iban: 'IE12', bic: 'BOFIIE2D' });
    const bank = methods.find(m => m.id === 'bank');
    expect(bank.bic).toBe('BOFIIE2D');
  });

  test('Returns all three methods when all are set', () => {
    const methods = getAvailablePaymentMethods({
      paypalUsername: 'johndoe',
      revolutUsername: 'alice',
      iban: 'IE12',
    });
    expect(methods).toHaveLength(3);
  });

  test('Does not include PayPal when paypalUsername is missing', () => {
    const methods = getAvailablePaymentMethods({ revolutUsername: 'alice' });
    expect(methods.find(m => m.id === 'paypal')).toBeUndefined();
  });

  test('Does not include Revolut when revolutUsername is missing', () => {
    const methods = getAvailablePaymentMethods({ paypalUsername: 'johndoe' });
    expect(methods.find(m => m.id === 'revolut')).toBeUndefined();
  });

  test('Does not include Bank when iban is missing', () => {
    const methods = getAvailablePaymentMethods({ paypalUsername: 'johndoe' });
    expect(methods.find(m => m.id === 'bank')).toBeUndefined();
  });
});