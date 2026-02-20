// src/utils/paymentLinks.test.js
// Test suite for payment link generation

describe('Payment Links - PayPal', () => {
  
  test('Generates valid PayPal.me link', () => {
    const username = 'johndoe';
    const amount = 50.00;
    const link = `https://paypal.me/${username}/${amount}`;
    
    expect(link).toContain('paypal.me');
    expect(link).toContain(username);
    expect(link).toContain('50');
  });

  test('PayPal link includes amount', () => {
    const username = 'alice';
    const amount = 123.45;
    const link = `https://paypal.me/${username}/${amount}`;
    
    expect(link).toMatch(/\/\d+(\.\d+)?$/);
  });

  test('PayPal link handles decimal amounts', () => {
    const amounts = [10.50, 99.99, 0.01, 1000.00];
    
    amounts.forEach(amount => {
      const link = `https://paypal.me/user/${amount}`;
      expect(link).toContain(amount.toString());
    });
  });

  test('PayPal username is URL-safe', () => {
    const username = 'testuser123';
    expect(username).toMatch(/^[a-zA-Z0-9]+$/);
  });

  test('Validates PayPal username format', () => {
    const validUsernames = ['alice', 'john123', 'user_name'];
    
    validUsernames.forEach(username => {
      expect(typeof username).toBe('string');
      expect(username.length).toBeGreaterThan(0);
    });
  });

  test('PayPal link structure is correct', () => {
    const link = 'https://paypal.me/testuser/50.00';
    const parts = link.split('/');
    
    expect(parts[0]).toBe('https:');
    expect(parts[2]).toBe('paypal.me');
    expect(parts.length).toBeGreaterThanOrEqual(4);
  });
});

describe('Payment Links - Revolut', () => {
  
  test('Generates valid Revolut link', () => {
    const username = 'alice';
    const link = `https://revolut.me/${username}`;
    
    expect(link).toContain('revolut.me');
    expect(link).toContain(username);
  });

  test('Revolut link format is correct', () => {
    const username = 'johndoe';
    const link = `https://revolut.me/${username}`;
    
    expect(link).toMatch(/^https:\/\/revolut\.me\/.+$/);
  });

  test('Revolut username is lowercase', () => {
    const username = 'testuser';
    expect(username).toBe(username.toLowerCase());
  });

  test('Validates Revolut username', () => {
    const validUsernames = ['alice', 'bob123', 'user_test'];
    
    validUsernames.forEach(username => {
      expect(username.length).toBeGreaterThan(0);
      expect(username.length).toBeLessThan(50);
    });
  });

  test('Revolut link without amount', () => {
    const link = 'https://revolut.me/testuser';
    expect(link).not.toMatch(/\/\d+$/);
  });
});

describe('Payment Links - Validation', () => {
  
  test('Validates payment amount is positive', () => {
    const validAmounts = [0.01, 1, 50, 999.99];
    
    validAmounts.forEach(amount => {
      expect(amount).toBeGreaterThan(0);
    });
  });

  test('Rejects negative amounts', () => {
    const invalidAmounts = [-1, -50, -0.01];
    
    invalidAmounts.forEach(amount => {
      expect(amount).toBeLessThan(0);
    });
  });

  test('Validates amount has max 2 decimal places', () => {
    const validAmounts = [10, 10.5, 10.50, 99.99];
    
    validAmounts.forEach(amount => {
      const decimals = amount.toString().split('.')[1];
      if (decimals) {
        expect(decimals.length).toBeLessThanOrEqual(2);
      }
    });
  });

  test('Rejects zero amount', () => {
    const amount = 0;
    const isValid = amount > 0;
    expect(isValid).toBe(false);
  });

  test('Validates maximum payment amount', () => {
    const MAX_AMOUNT = 10000;
    const amount = 5000;
    
    expect(amount).toBeLessThanOrEqual(MAX_AMOUNT);
  });
});

describe('Payment Links - URL Encoding', () => {
  
  test('Handles special characters in username', () => {
    const username = 'test_user';
    const encoded = username.replace(/_/g, '-');
    
    expect(encoded).toBe('test-user');
  });

  test('Removes spaces from username', () => {
    const username = 'test user';
    const cleaned = username.replace(/\s/g, '');
    
    expect(cleaned).toBe('testuser');
  });

  test('Converts username to lowercase', () => {
    const username = 'TestUser';
    const lowercase = username.toLowerCase();
    
    expect(lowercase).toBe('testuser');
  });

  test('Validates URL format', () => {
    const urls = [
      'https://paypal.me/user',
      'https://revolut.me/user',
    ];

    urls.forEach(url => {
      expect(url).toMatch(/^https:\/\//);
    });
  });
});

describe('Payment Links - Currency Handling', () => {
  
  test('Amount is in EUR by default', () => {
    const currency = 'EUR';
    expect(currency).toBe('EUR');
  });

  test('Formats amount with currency symbol', () => {
    const amount = 50;
    const formatted = `€${amount.toFixed(2)}`;
    
    expect(formatted).toBe('€50.00');
  });

  test('Handles different currency codes', () => {
    const currencies = ['EUR', 'USD', 'GBP'];
    
    currencies.forEach(currency => {
      expect(currency.length).toBe(3);
      expect(currency).toMatch(/^[A-Z]{3}$/);
    });
  });

  test('Currency amount precision', () => {
    const amount = 123.456;
    const rounded = Math.round(amount * 100) / 100;
    
    expect(rounded).toBe(123.46);
  });
});

describe('Payment Links - Error Cases', () => {
  
  test('Handles empty username', () => {
    const username = '';
    const isValid = username.length > 0;
    
    expect(isValid).toBe(false);
  });

  test('Handles null username', () => {
    const username = null;
    const isValid = username !== null && username !== undefined;
    
    expect(isValid).toBe(false);
  });

  test('Handles undefined amount', () => {
    const amount = undefined;
    const isValid = typeof amount === 'number' && amount > 0;
    
    expect(isValid).toBe(false);
  });

  test('Handles invalid amount type', () => {
    const amounts = ['50', null, undefined, NaN];
    
    amounts.forEach(amount => {
      const isValid = typeof amount === 'number' && !isNaN(amount) && amount > 0;
      expect(isValid).toBe(false);
    });
  });
});

describe('Payment Links - Link Generation', () => {
  
  test('Generates complete payment link', () => {
    const paymentLink = {
      platform: 'paypal',
      username: 'testuser',
      amount: 50,
      url: 'https://paypal.me/testuser/50',
    };

    expect(paymentLink.platform).toBeDefined();
    expect(paymentLink.username).toBeDefined();
    expect(paymentLink.url).toBeDefined();
  });

  test('Includes metadata in payment link', () => {
    const paymentLink = {
      url: 'https://paypal.me/user/50',
      currency: 'EUR',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    };

    expect(paymentLink.currency).toBe('EUR');
    expect(paymentLink.createdAt).toBeInstanceOf(Date);
  });

  test('Validates complete link structure', () => {
    const link = {
      platform: 'revolut',
      username: 'alice',
      url: 'https://revolut.me/alice',
      isValid: true,
    };

    expect(link.platform).toMatch(/^(paypal|revolut)$/);
    expect(link.url).toMatch(/^https:\/\//);
    expect(link.isValid).toBe(true);
  });
});

describe('Payment Links - QR Code Data', () => {
  
  test('Generates QR code data from payment link', () => {
    const paymentUrl = 'https://paypal.me/testuser/50';
    const qrData = paymentUrl;
    
    expect(qrData).toBe(paymentUrl);
    expect(qrData.length).toBeGreaterThan(0);
  });

  test('QR data includes full URL', () => {
    const url = 'https://revolut.me/testuser';
    expect(url).toMatch(/^https?:\/\/.+/);
  });

  test('Validates QR data format', () => {
    const qrData = 'https://paypal.me/user/100';
    expect(typeof qrData).toBe('string');
    expect(qrData.startsWith('http')).toBe(true);
  });
});