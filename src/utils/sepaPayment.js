// src/utils/sepaPayment.js

/**
 * SEPA Payment Utilities
 * Handles SEPA payment simulation for Split-Sync
 * 
 * NOTE: This is a DEMO/SIMULATION for academic purposes.
 * In production, this would integrate with real SEPA providers like Stripe or Wise.
 */

/**
 * Generates a unique SEPA payment reference
 * Format: SEPA-YYYYMMDD-XXXXXX
 * @returns {string} - Payment reference
 */
export const generatePaymentReference = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SEPA-${dateStr}-${randomStr}`;
};

/**
 * Validates IBAN format (basic validation)
 * @param {string} iban - IBAN to validate
 * @returns {boolean} - True if valid
 */
export const validateIBAN = (iban) => {
  if (!iban) return false;
  
  // Remove spaces and convert to uppercase
  const cleanIBAN = iban.replace(/\s/g, '').toUpperCase();
  
  // Check format: 2 letters + 2 digits + up to 30 alphanumeric
  const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/;
  
  return ibanRegex.test(cleanIBAN);
};

/**
 * Formats IBAN for display (adds spaces every 4 characters)
 * @param {string} iban - IBAN to format
 * @returns {string} - Formatted IBAN
 */
export const formatIBAN = (iban) => {
  if (!iban) return '';
  
  const cleanIBAN = iban.replace(/\s/g, '').toUpperCase();
  return cleanIBAN.match(/.{1,4}/g)?.join(' ') || cleanIBAN;
};

/**
 * Masks IBAN for secure display (shows only first 2 and last 4 characters)
 * @param {string} iban - IBAN to mask
 * @returns {string} - Masked IBAN (e.g., "IE** **** **** 6789")
 */
export const maskIBAN = (iban) => {
  if (!iban) return '';
  
  const cleanIBAN = iban.replace(/\s/g, '');
  
  if (cleanIBAN.length <= 6) return cleanIBAN;
  
  const countryCode = cleanIBAN.substring(0, 2);
  const lastFour = cleanIBAN.substring(cleanIBAN.length - 4);
  const middleLength = cleanIBAN.length - 6;
  const mask = '*'.repeat(Math.min(middleLength, 12));
  
  const masked = `${countryCode}${mask}${lastFour}`;
  return formatIBAN(masked);
};

/**
 * Simulates SEPA payment processing
 * In production, this would call a real payment gateway API
 * 
 * @param {Object} paymentData - Payment details
 * @returns {Promise<Object>} - Payment result
 */
export const processSepaPayment = async (paymentData) => {
  const {
    amount,
    fromUserId,
    toUserId,
    fromIBAN,
    toIBAN,
    reference,
    description
  } = paymentData;

  // Simulate network delay (500ms - 2s)
  const delay = Math.random() * 1500 + 500;
  await new Promise(resolve => setTimeout(resolve, delay));

  // Simulate 95% success rate (5% random failures for realism)
  const isSuccess = Math.random() > 0.05;

  if (!isSuccess) {
    throw new Error('Payment processing failed. Please try again.');
  }

  // Return successful payment result
  return {
    status: 'completed',
    paymentId: `PAY-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    reference: reference || generatePaymentReference(),
    amount,
    fromUserId,
    toUserId,
    fromIBAN: maskIBAN(fromIBAN),
    toIBAN: maskIBAN(toIBAN),
    description,
    processedAt: new Date().toISOString(),
    estimatedArrival: getEstimatedArrival()
  };
};

/**
 * Gets estimated arrival time for SEPA payment (1-2 business days)
 * @returns {string} - Estimated arrival date
 */
const getEstimatedArrival = () => {
  const now = new Date();
  
  // Add 1-2 business days
  let daysToAdd = Math.random() > 0.5 ? 1 : 2;
  
  // Skip weekends
  const dayOfWeek = now.getDay();
  if (dayOfWeek === 5) daysToAdd += 2; // Friday
  if (dayOfWeek === 6) daysToAdd += 1; // Saturday
  
  const arrival = new Date(now);
  arrival.setDate(arrival.getDate() + daysToAdd);
  
  return arrival.toISOString();
};

/**
 * Calculates SEPA payment fee (free for this demo)
 * In production, this would return actual fees
 * 
 * @param {number} amount - Payment amount
 * @returns {number} - Fee amount
 */
export const calculatePaymentFee = (amount) => {
  // SEPA transfers within EU are typically free or very low cost
  // For demo purposes, we'll make it free
  return 0;
};

/**
 * Payment status types
 */
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

/**
 * Gets user-friendly payment status text
 * @param {string} status - Payment status
 * @returns {string} - Display text
 */
export const getPaymentStatusText = (status) => {
  const statusMap = {
    [PAYMENT_STATUS.PENDING]: 'Pending',
    [PAYMENT_STATUS.PROCESSING]: 'Processing',
    [PAYMENT_STATUS.COMPLETED]: 'Completed',
    [PAYMENT_STATUS.FAILED]: 'Failed',
    [PAYMENT_STATUS.CANCELLED]: 'Cancelled'
  };
  
  return statusMap[status] || 'Unknown';
};

/**
 * Gets payment status color for UI
 * @param {string} status - Payment status
 * @returns {string} - Tailwind color class
 */
export const getPaymentStatusColor = (status) => {
  const colorMap = {
    [PAYMENT_STATUS.PENDING]: 'text-yellow-600 bg-yellow-50',
    [PAYMENT_STATUS.PROCESSING]: 'text-blue-600 bg-blue-50',
    [PAYMENT_STATUS.COMPLETED]: 'text-green-600 bg-green-50',
    [PAYMENT_STATUS.FAILED]: 'text-red-600 bg-red-50',
    [PAYMENT_STATUS.CANCELLED]: 'text-gray-600 bg-gray-50'
  };
  
  return colorMap[status] || 'text-gray-600 bg-gray-50';
};

/**
 * Validates payment amount
 * @param {number} amount - Amount to validate
 * @returns {Object} - { valid: boolean, error: string }
 */
export const validatePaymentAmount = (amount) => {
  if (!amount || amount <= 0) {
    return { valid: false, error: 'Please enter an amount greater than €0' };
  }
  
  if (amount > 999999) {
    return { valid: false, error: 'Amount exceeds maximum limit (€999,999)' };
  }
  
  // Check for more than 2 decimal places
  // Round to 2 decimals and compare with original
  const rounded = Math.round(amount * 100) / 100;
  if (rounded !== Number(amount)) {
    return { valid: false, error: 'Please use maximum 2 decimal places (e.g., 5.99)' };
  }
  
  return { valid: true, error: null };
};

/**
 * Creates payment description
 * @param {string} groupName - Group name
 * @param {string} payerName - Payer name
 * @returns {string} - Payment description
 */
export const createPaymentDescription = (groupName, payerName) => {
  return `Split-Sync settlement - ${groupName} - from ${payerName}`;
};