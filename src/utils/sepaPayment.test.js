// src/utils/sepaPayment.test.js
// Test suite for SEPA payment utilities
import {
  generatePaymentReference,
  validateIBAN,
  formatIBAN,
  maskIBAN,
  processSepaPayment,
  calculatePaymentFee,
  PAYMENT_STATUS,
  getPaymentStatusText,
  getPaymentStatusColor,
  validatePaymentAmount,
  createPaymentDescription,
} from './sepaPayment';

describe('SEPA Payment - Reference Generation', () => {
  
  test('Generates payment reference with correct format', () => {
    const reference = generatePaymentReference();
    
    expect(reference).toMatch(/^SEPA-\d{8}-[A-Z0-9]{6}$/);
    expect(reference).toContain('SEPA-');
  });

  test('Reference includes current date', () => {
    const reference = generatePaymentReference();
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    expect(reference).toContain(today);
  });

  test('Generates unique references', () => {
    const ref1 = generatePaymentReference();
    const ref2 = generatePaymentReference();
    
    // Should be different (random part)
    expect(ref1).not.toBe(ref2);
  });

  test('Reference has correct length', () => {
    const reference = generatePaymentReference();
    
    // Format: SEPA-YYYYMMDD-XXXXXX
    expect(reference.length).toBeGreaterThanOrEqual(20);
  });
});

describe('SEPA Payment - IBAN Validation', () => {
  
  test('Validates correct Irish IBAN', () => {
    expect(validateIBAN('IE29AIBK93115212345678')).toBe(true);
  });

  test('Validates IBAN with spaces', () => {
    expect(validateIBAN('IE29 AIBK 9311 5212 3456 78')).toBe(true);
  });

  test('Validates different country IBANs', () => {
    expect(validateIBAN('DE89370400440532013000')).toBe(true);
    expect(validateIBAN('FR1420041010050500013M02606')).toBe(true);
    expect(validateIBAN('GB29NWBK60161331926819')).toBe(true);
  });

  test('Rejects empty IBAN', () => {
    expect(validateIBAN('')).toBe(false);
    expect(validateIBAN(null)).toBe(false);
    expect(validateIBAN(undefined)).toBe(false);
  });

  test('Rejects invalid IBAN format', () => {
    expect(validateIBAN('12345')).toBe(false);
    expect(validateIBAN('INVALID')).toBe(false);
    expect(validateIBAN('IE')).toBe(false);
  });

  test('Rejects IBAN with special characters', () => {
    expect(validateIBAN('IE29-AIBK-9311')).toBe(false);
  });

  test('Handles lowercase IBAN', () => {
    expect(validateIBAN('ie29aibk93115212345678')).toBe(true);
  });
});

describe('SEPA Payment - IBAN Formatting', () => {
  
  test('Formats IBAN with spaces', () => {
    const formatted = formatIBAN('IE29AIBK93115212345678');
    expect(formatted).toBe('IE29 AIBK 9311 5212 3456 78');
  });

  test('Handles already formatted IBAN', () => {
    const input = 'IE29 AIBK 9311 5212 3456 78';
    const formatted = formatIBAN(input);
    expect(formatted).toBe('IE29 AIBK 9311 5212 3456 78');
  });

  test('Returns empty string for null/undefined', () => {
    expect(formatIBAN(null)).toBe('');
    expect(formatIBAN(undefined)).toBe('');
    expect(formatIBAN('')).toBe('');
  });

  test('Converts to uppercase', () => {
    const formatted = formatIBAN('ie29aibk93115212345678');
    expect(formatted).toContain('IE29');
  });

  test('Groups characters in sets of 4', () => {
    const formatted = formatIBAN('GB29NWBK60161331926819');
    const parts = formatted.split(' ');
    parts.forEach(part => {
      expect(part.length).toBeLessThanOrEqual(4);
    });
  });
});

describe('SEPA Payment - IBAN Masking', () => {
  
  test('Masks IBAN showing country code and last 4 digits', () => {
    const masked = maskIBAN('IE29AIBK93115212345678');
    
    expect(masked).toContain('IE');
    expect(masked).toContain('56 78'); // Formatted with space
    expect(masked).toContain('*');
    });

  test('Returns empty string for null/undefined', () => {
    expect(maskIBAN(null)).toBe('');
    expect(maskIBAN(undefined)).toBe('');
    expect(maskIBAN('')).toBe('');
  });

  test('Handles short IBAN', () => {
    const masked = maskIBAN('IE29AB');
    expect(masked).toBe('IE29AB');
  });

  test('Hides middle section', () => {
    const masked = maskIBAN('IE29AIBK93115212345678');
    expect(masked).not.toContain('AIBK');
    expect(masked).not.toContain('9311');
  });

  test('Formats masked IBAN with spaces', () => {
    const masked = maskIBAN('IE29AIBK93115212345678');
    expect(masked).toContain(' ');
  });
});

describe('SEPA Payment - Payment Processing', () => {
  
  test('Processes payment successfully', async () => {
    // Mock Math.random to ensure success (> 0.05)
    const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.1);
    
    const paymentData = {
        amount: 50,
        fromUserId: 'user1',
        toUserId: 'user2',
        fromIBAN: 'IE29AIBK93115212345678',
        toIBAN: 'DE89370400440532013000',
        reference: 'TEST-REF',
        description: 'Test payment',
    };

    const result = await processSepaPayment(paymentData);

    expect(result.status).toBe('completed');
    expect(result.paymentId).toBeDefined();
    expect(result.amount).toBe(50);
    expect(result.fromUserId).toBe('user1');
    expect(result.toUserId).toBe('user2');
    
    mockRandom.mockRestore();
    });

    test('Masks IBANs in payment result', async () => {
    // Mock Math.random to ensure success (> 0.05)
    const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.1);
    
    const paymentData = {
      amount: 100,
      fromUserId: 'user1',
      toUserId: 'user2',
      fromIBAN: 'IE29AIBK93115212345678',
      toIBAN: 'DE89370400440532013000',
    };

    const result = await processSepaPayment(paymentData);

    expect(result.fromIBAN).toContain('*');
    expect(result.toIBAN).toContain('*');
    
    mockRandom.mockRestore();
  });

  test('Generates payment reference if not provided', async () => {
    const paymentData = {
      amount: 50,
      fromUserId: 'user1',
      toUserId: 'user2',
      fromIBAN: 'IE29AIBK93115212345678',
      toIBAN: 'DE89370400440532013000',
    };

    const result = await processSepaPayment(paymentData);

    expect(result.reference).toMatch(/^SEPA-/);
  });

  test('Includes estimated arrival time', async () => {
    // Mock Math.random to ensure success (> 0.05)
    const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.1);
    
    const paymentData = {
      amount: 50,
      fromUserId: 'user1',
      toUserId: 'user2',
      fromIBAN: 'IE29AIBK93115212345678',
      toIBAN: 'DE89370400440532013000',
    };

    const result = await processSepaPayment(paymentData);

    expect(result.estimatedArrival).toBeDefined();
    expect(new Date(result.estimatedArrival)).toBeInstanceOf(Date);
    
    mockRandom.mockRestore();
  });

  test('Includes processedAt timestamp', async () => {
    // Mock Math.random to ensure success (> 0.05)
    const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.1);
    
    const paymentData = {
      amount: 50,
      fromUserId: 'user1',
      toUserId: 'user2',
      fromIBAN: 'IE29AIBK93115212345678',
      toIBAN: 'DE89370400440532013000',
    };

    const result = await processSepaPayment(paymentData);

    expect(result.processedAt).toBeDefined();
    expect(new Date(result.processedAt)).toBeInstanceOf(Date);
    
    mockRandom.mockRestore();
  });
});

describe('SEPA Payment - Fee Calculation', () => {
  
  test('Returns zero fee for any amount', () => {
    expect(calculatePaymentFee(50)).toBe(0);
    expect(calculatePaymentFee(100)).toBe(0);
    expect(calculatePaymentFee(1000)).toBe(0);
  });

  test('Fee calculation is consistent', () => {
    const fee1 = calculatePaymentFee(100);
    const fee2 = calculatePaymentFee(100);
    expect(fee1).toBe(fee2);
  });
});

describe('SEPA Payment - Payment Status', () => {
  
  test('PAYMENT_STATUS constants are defined', () => {
    expect(PAYMENT_STATUS.PENDING).toBe('pending');
    expect(PAYMENT_STATUS.PROCESSING).toBe('processing');
    expect(PAYMENT_STATUS.COMPLETED).toBe('completed');
    expect(PAYMENT_STATUS.FAILED).toBe('failed');
    expect(PAYMENT_STATUS.CANCELLED).toBe('cancelled');
  });

  test('Gets correct status text', () => {
    expect(getPaymentStatusText(PAYMENT_STATUS.PENDING)).toBe('Pending');
    expect(getPaymentStatusText(PAYMENT_STATUS.PROCESSING)).toBe('Processing');
    expect(getPaymentStatusText(PAYMENT_STATUS.COMPLETED)).toBe('Completed');
    expect(getPaymentStatusText(PAYMENT_STATUS.FAILED)).toBe('Failed');
    expect(getPaymentStatusText(PAYMENT_STATUS.CANCELLED)).toBe('Cancelled');
  });

  test('Returns Unknown for invalid status', () => {
    expect(getPaymentStatusText('invalid')).toBe('Unknown');
  });

  test('Gets correct status color', () => {
    expect(getPaymentStatusColor(PAYMENT_STATUS.PENDING)).toContain('yellow');
    expect(getPaymentStatusColor(PAYMENT_STATUS.PROCESSING)).toContain('blue');
    expect(getPaymentStatusColor(PAYMENT_STATUS.COMPLETED)).toContain('green');
    expect(getPaymentStatusColor(PAYMENT_STATUS.FAILED)).toContain('red');
    expect(getPaymentStatusColor(PAYMENT_STATUS.CANCELLED)).toContain('gray');
  });

  test('Returns default color for invalid status', () => {
    expect(getPaymentStatusColor('invalid')).toContain('gray');
  });
});

describe('SEPA Payment - Amount Validation', () => {
  
  test('Validates correct amounts', () => {
    expect(validatePaymentAmount(50).valid).toBe(true);
    expect(validatePaymentAmount(0.01).valid).toBe(true);
    expect(validatePaymentAmount(999999).valid).toBe(true);
  });

  test('Rejects zero or negative amounts', () => {
    expect(validatePaymentAmount(0).valid).toBe(false);
    expect(validatePaymentAmount(-50).valid).toBe(false);
    expect(validatePaymentAmount(-0.01).valid).toBe(false);
  });

  test('Rejects amounts exceeding maximum', () => {
    const result = validatePaymentAmount(1000000);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('maximum');
  });

  test('Rejects amounts with more than 2 decimal places', () => {
    const result = validatePaymentAmount(50.123);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('2 decimal places');
  });

  test('Accepts amounts with 2 decimal places', () => {
    expect(validatePaymentAmount(50.99).valid).toBe(true);
    expect(validatePaymentAmount(100.50).valid).toBe(true);
  });

  test('Returns error message for invalid amounts', () => {
    const result1 = validatePaymentAmount(0);
    expect(result1.error).toBeDefined();
    
    const result2 = validatePaymentAmount(1000000);
    expect(result2.error).toBeDefined();
  });

  test('Returns null error for valid amounts', () => {
    const result = validatePaymentAmount(50);
    expect(result.error).toBeNull();
  });
});

describe('SEPA Payment - Description Creation', () => {
  
  test('Creates payment description with group and payer', () => {
    const description = createPaymentDescription('House Rent', 'John Doe');
    
    expect(description).toContain('Split-Sync settlement');
    expect(description).toContain('House Rent');
    expect(description).toContain('John Doe');
  });

  test('Formats description correctly', () => {
    const description = createPaymentDescription('Test Group', 'Alice');
    
    expect(description).toBe('Split-Sync settlement - Test Group - from Alice');
  });

  test('Handles special characters in names', () => {
    const description = createPaymentDescription('Test & Group', 'O\'Brien');
    
    expect(description).toContain('Test & Group');
    expect(description).toContain('O\'Brien');
  });
});