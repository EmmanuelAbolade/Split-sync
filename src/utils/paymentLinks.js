// src/utils/paymentLinks.js

/**
 * Generate payment links for different payment services
 */

// PayPal.me link
export const generatePayPalLink = (username, amount, currency = 'EUR') => {
  if (!username) return null;
  // Remove @ if present
  const cleanUsername = username.replace('@', '');
  return `https://paypal.me/${cleanUsername}/${amount}${currency}`;
};

// Revolut deep link
export const generateRevolutLink = (username, amount, currency = 'EUR') => {
  if (!username) return null;
  // Revolut uses @username format
  const cleanUsername = username.replace('@', '');
  //return `https://revolut.me/${cleanUsername}?amount=${amount}&currency=${currency}`;
  return `https://revolut.me/${cleanUsername}`;
};

// Format bank transfer info
export const formatBankTransferInfo = (recipientName, iban, bic, amount, currency = 'EUR') => {
  return {
    recipientName,
    iban: iban || 'Not provided',
    bic: bic || 'Not provided',
    amount: `${currency} ${amount.toFixed(2)}`,
    reference: 'SplitSync Settlement',
  };
};

// Check which payment methods are available for a user
export const getAvailablePaymentMethods = (paymentMethods) => {
  if (!paymentMethods) return [];
  
  const available = [];
  
  if (paymentMethods.paypalUsername) {
    available.push({
      id: 'paypal',
      name: 'PayPal',
      icon: '💳',
      username: paymentMethods.paypalUsername,
      description: `Pay via PayPal (@${paymentMethods.paypalUsername})`,
    });
  }
  
  if (paymentMethods.revolutUsername) {
    available.push({
      id: 'revolut',
      name: 'Revolut',
      icon: '💶',
      username: paymentMethods.revolutUsername,
      description: `Pay via Revolut (@${paymentMethods.revolutUsername})`,
    });
  }
  
  if (paymentMethods.iban) {
    available.push({
      id: 'bank',
      name: 'Bank Transfer',
      icon: '🏦',
      iban: paymentMethods.iban,
      bic: paymentMethods.bic,
      description: 'SEPA bank transfer',
    });
  }
  
  return available;
};