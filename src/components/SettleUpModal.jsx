// src/components/SettleUpModal.jsx - WITH PAYMENT CONFIRMATION FLOW
import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { PayPalButtons } from '@paypal/react-paypal-js';
import { DollarSign, CreditCard, CheckCircle2, X, ArrowRight, AlertCircle, ExternalLink, Copy, Check, Info, Landmark, QrCode, Smartphone, ChevronDown } from 'lucide-react';
import { getDoc } from 'firebase/firestore';
import { generatePayPalLink, generateRevolutLink, getAvailablePaymentMethods } from '../utils/paymentLinks';
import PaymentInfoModal from './PaymentInfoModal';
import SepaPaymentModal from './SepaPaymentModal';
import { authenticateWithBiometric } from '../utils/biometric';
import { createNotification, recordPaymentSent } from '../stores/notificationsStore';
import QRCodeCanvas from './QRCodeCanvas';

export default function SettleUpModal({ isOpen, onClose, settlement, group, currentUserId }) {
  const [amount, setAmount] = useState(settlement?.amount?.toFixed(2) || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('paypal');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [recipientPaymentMethods, setRecipientPaymentMethods] = useState(null);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(true);
  const [selectedPaymentLink, setSelectedPaymentLink] = useState(null);
  const [copiedIban, setCopiedIban] = useState(false);
  const [showPaymentInfo, setShowPaymentInfo] = useState(false);
  const [showSepaModal, setShowSepaModal] = useState(false);
  const [sepaPaymentData, setSepaPaymentData] = useState(null);
  const [paymentInfo, setPaymentInfo] = useState(null);
  
  // Pending payment confirmation state
  const [pendingPayment, setPendingPayment] = useState(null);
  const [showPendingConfirmation, setShowPendingConfirmation] = useState(false);
  const [activeQR, setActiveQR] = useState('paypal');
  const [showQR, setShowQR] = useState(false);
  const [showDemoInfo, setShowDemoInfo] = useState(false);
  const fromMember = group?.members?.find(m => m.userId === settlement?.from);
  const toMember = group?.members?.find(m => m.userId === settlement?.to);
  const userIsPaying = currentUserId === settlement?.from;
  const userIsReceiving = currentUserId === settlement?.to;

  // Merge reset + pending-check into a single effect so the reset never
  // overrides the pending-check result (previous bug: two separate effects
  // on [isOpen] ran in definition order, reset was second and cleared
  // showPendingConfirmation that the check had just set to true).
  useEffect(() => {
    if (!isOpen) return;

    // Step 1: Reset all transient UI state
    setPaymentSuccess(false);
    setError('');
    setLoading(false);
    setShowConfirmation(false);
    setCopiedIban(false);
    setAmount(settlement?.amount?.toFixed(2) || '');

    // Step 2: Check sessionStorage for a pending payment AFTER the reset,
    // so the check result is the final value of showPendingConfirmation.
    try {
      const pending = sessionStorage.getItem('pendingPayment');
      if (pending) {
        const paymentData = JSON.parse(pending);
        if (
          paymentData.groupId === group?.id &&
          paymentData.fromUserId === settlement?.from &&
          paymentData.toUserId === settlement?.to
        ) {
          setPendingPayment(paymentData);
          setShowPendingConfirmation(true);
        } else {
          sessionStorage.removeItem('pendingPayment');
          setShowPendingConfirmation(false);
        }
      } else {
        setShowPendingConfirmation(false);
      }
    } catch (err) {
      console.error('Error checking pending payment:', err);
      sessionStorage.removeItem('pendingPayment');
      setShowPendingConfirmation(false);
    }
  }, [isOpen, group?.id, settlement?.from, settlement?.to]);

  // Fetch recipient's payment methods
  useEffect(() => {
    const fetchRecipientPaymentMethods = async () => {
      if (!settlement || !settlement.to) return;
      
      setLoadingPaymentMethods(true);
      try {
        const recipientDoc = await getDoc(doc(db, 'users', settlement.to));
        if (recipientDoc.exists()) {
          const data = recipientDoc.data();
          setRecipientPaymentMethods(data.paymentMethods || null);
        }
      } catch (error) {
        console.error('Error fetching payment methods:', error);
      } finally {
        setLoadingPaymentMethods(false);
      }
    };

    if (isOpen) {
      fetchRecipientPaymentMethods();
    }
  }, [settlement, isOpen]);

  const recordSettlement = async (paypalOrderId = null) => {
    const amountNum = parseFloat(amount);

    try {
      const settlementData = {
        groupId: group.id,
        title: `Settlement: ${fromMember?.name} → ${toMember?.name}`,
        amount: amountNum,
        currency: group.currency,
        paidBy: settlement.from,
        category: 'settlement',
        description: paypalOrderId 
          ? `PayPal Payment (Order: ${paypalOrderId})`
          : `Manual payment ${userIsReceiving ? 'received' : 'sent'}`,
        date: new Date(),
        splitMethod: 'exact',
        splits: {
          [settlement.to]: amountNum,
        },
        participants: [settlement.from, settlement.to],
        createdAt: serverTimestamp(),
        isSettlement: true,
        paymentMethod: paypalOrderId ? 'paypal' : 'manual',
        paypalOrderId: paypalOrderId || null,
        recordedBy: currentUserId,
      };

      await addDoc(collection(db, 'expenses'), settlementData);

      // Notify the OTHER person (not the one who recorded it)
      if (userIsReceiving) {
        // Receiver marked as received - notify the payer
        await createNotification({
          userId: settlement.from,
          type: 'payment',
          title: 'Payment Confirmed',
          message: `${toMember?.name} confirmed receiving ${group.currency} ${amountNum.toFixed(2)} from you in ${group.name}`,
          data: {
            groupId: group.id,
            amount: amountNum,
            currency: group.currency,
            toUserId: settlement.to,
            toName: toMember?.name,
          },
        });
      } else {
        // Payer marked as sent - notify the receiver
        await createNotification({
          userId: settlement.to,
          type: 'payment',
          title: 'Payment Received',
          message: `${fromMember?.name} paid you ${group.currency} ${amountNum.toFixed(2)} in ${group.name}`,
          data: {
            groupId: group.id,
            amount: amountNum,
            currency: group.currency,
            fromUserId: settlement.from,
            fromName: fromMember?.name,
          },
        });
      }

      return true;
    } catch (err) {
      console.error('Error recording settlement:', err);
      throw err;
    }
  };

  // Handle "Mark as Paid" for pending payment
  // Handle "Mark as Paid" for pending payment.
  // Uses recordPaymentSent which writes to the existing notifications collection only —
  // no new Firestore collection, no additional security rules required.
  const handleMarkAsPaid = async () => {
    if (!pendingPayment) return;

    setLoading(true);
    setError('');

    try {
      await recordPaymentSent({
        payerId: settlement.from,
        payerName: fromMember?.name || 'Unknown',
        payeeId: settlement.to,
        payeeName: toMember?.name || 'Unknown',
        groupId: group.id,
        groupName: group.name,
        amount: pendingPayment.amount,
        currency: pendingPayment.currency,
        method: pendingPayment.method,
      });

      sessionStorage.removeItem('pendingPayment');
      setPendingPayment(null);
      setShowPendingConfirmation(false);
      setPaymentSuccess(true);

      setTimeout(() => { onClose(); }, 2500);
    } catch (err) {
      console.error('Error marking as paid:', err);
      // Show the actual error message so it is debuggable
      setError(
        err?.code === 'permission-denied'
          ? 'Permission denied. Please ensure you are signed in and try again.'
          : `Failed to record payment: ${err?.message || 'Please try again.'}`
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle "Not Yet" for pending payment
  const handleNotYet = () => {
    // Keep pending payment in sessionStorage for later
    setShowPendingConfirmation(false);
    setPendingPayment(null);
  };

  const handleManualSettle = async (e) => {
    e.preventDefault();
    setError('');

    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      setError('Valid amount is required');
      return;
    }

    if (userIsReceiving && !showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    // Set loading BEFORE biometric check
    setLoading(true);

    if (userIsReceiving && showConfirmation) {
      try {
        const authenticated = await authenticateWithBiometric(
          currentUserId,
          'Authenticate to confirm receipt'
        );
        
        if (!authenticated) {
          setError('Biometric authentication was cancelled or failed. Please try again.');
          setLoading(false);
          setShowConfirmation(false); // Reset confirmation state
          return;
        }
      } catch (err) {
        console.error('Biometric error:', err);
        setError('Authentication failed. Please enable biometric authentication in Settings or try again.');
        setLoading(false);
        setShowConfirmation(false); // Reset confirmation state
        return;
      }
    }

    try {
      await recordSettlement();
      setPaymentSuccess(true);
      setTimeout(() => {
        onClose();
        setShowConfirmation(false);
      }, 2500);
    } catch (err) {
      setError('Failed to record settlement. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSepaPayment = () => {
    const paymentData = {
      amount: parseFloat(amount),
      fromUser: {
        id: settlement.from,
        name: fromMember?.name || 'Unknown'
      },
      toUser: {
        id: settlement.to,
        name: toMember?.name || 'Unknown'
      },
      fromUserPaymentMethods: null,
      toUserPaymentMethods: recipientPaymentMethods,
      groupName: group.name,
      groupId: group.id
    };
    
    setSepaPaymentData(paymentData);
    setShowSepaModal(true);
  };

  const handleSepaPaymentSuccess = async (paymentResult) => {
    try {
      const settlementData = {
        groupId: group.id,
        title: `SEPA Settlement: ${fromMember?.name} → ${toMember?.name}`,
        amount: paymentResult.amount,
        currency: group.currency,
        paidBy: settlement.from,
        category: 'settlement',
        description: `SEPA Payment (Ref: ${paymentResult.reference})`,
        date: new Date(),
        splitMethod: 'exact',
        splits: {
          [settlement.to]: paymentResult.amount,
        },
        participants: [settlement.from, settlement.to],
        createdAt: serverTimestamp(),
        isSettlement: true,
        paymentMethod: 'sepa',
        sepaReference: paymentResult.reference,
        sepaPaymentId: paymentResult.paymentId,
        recordedBy: currentUserId,
      };

      await addDoc(collection(db, 'expenses'), settlementData);
      
      setPaymentSuccess(true);
      setShowSepaModal(false);
      
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (err) {
      console.error('Error recording SEPA settlement:', err);
      setError('Payment processed but failed to record. Please contact support.');
    }
  };

  // Save to sessionStorage before opening payment link
  const handlePaymentLinkClick = (method) => {
    const amountNum = parseFloat(amount);
    
    // Save pending payment data
    const pendingPaymentData = {
      groupId: group.id,
      fromUserId: settlement.from,
      toUserId: settlement.to,
      fromName: fromMember?.name,
      toName: toMember?.name,
      amount: amountNum,
      currency: group.currency,
      method: method.id === 'paypal' || method.id === 'paypal-link' ? 'paypal' :
              method.id === 'revolut' ? 'revolut' :
              method.id === 'bank' ? 'bank' : 'manual',
      timestamp: Date.now(),
    };

    sessionStorage.setItem('pendingPayment', JSON.stringify(pendingPaymentData));
    
    if (method.id === 'paypal' || method.id === 'paypal-link') {
      setPaymentInfo({
        method: 'paypal',
        amount: amountNum,
        currency: group.currency,
        username: method.username,
        onProceed: () => {
          const link = generatePayPalLink(method.username, amountNum, group.currency);
          window.open(link, '_blank');
          setShowPaymentInfo(false);
          onClose();
        }
      });
      setShowPaymentInfo(true);
      
    } else if (method.id === 'revolut') {
      setPaymentInfo({
        method: 'revolut',
        amount: amountNum,
        currency: group.currency,
        username: method.username,
        onProceed: () => {
          const link = generateRevolutLink(method.username, amountNum, group.currency);
          window.open(link, '_blank');
          setShowPaymentInfo(false);
          onClose();
        }
      });
      setShowPaymentInfo(true);
      
    } else if (method.id === 'bank') {
      // Shows inline bank details - user copies IBAN and makes transfer
      setSelectedPaymentLink(method);
    }
  };

  const createPayPalOrder = (data, actions) => {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    return actions.order.create({
      purchase_units: [
        {
          description: `Settlement: ${fromMember?.name} pays ${toMember?.name}`,
          amount: {
            currency_code: group.currency || 'EUR',
            value: amountNum.toFixed(2),
          },
          payee: {
            email_address: toMember?.email || 'receiver@example.com',
          },
        },
      ],
      application_context: {
        shipping_preference: 'NO_SHIPPING',
      },
    });
  };

  const onPayPalApprove = async (data, actions) => {
    setLoading(true);
    setError('');

    try {
      const details = await actions.order.capture();
      
      await recordSettlement(details.id);
      setPaymentSuccess(true);
      setTimeout(() => onClose(), 2500);
    } catch (err) {
      console.error('PayPal error:', err);
      setError('Payment failed. Please try again.');
      setLoading(false);
    }
  };

  const onPayPalError = (err) => {
    console.error('PayPal error:', err);
    setError('Payment initialization failed. Please try again.');
  };

  if (!isOpen) return null;

  // Pending payment confirmation dialog
  if (showPendingConfirmation && pendingPayment) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-card-3d dark:shadow-gray-900/50 animate-scale-in">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Did you complete the payment?
            </h2>
            <button
              onClick={() => {
                setShowPendingConfirmation(false);
                setPendingPayment(null);
              }}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={24} />
            </button>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Info size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900 dark:text-blue-200">
                <p className="font-medium mb-2">Payment Summary</p>
                <div className="space-y-1">
                  <p><strong>Amount:</strong> {pendingPayment.currency} {pendingPayment.amount.toFixed(2)}</p>
                  <p><strong>To:</strong> {pendingPayment.toName}</p>
                  <p><strong>Method:</strong> {pendingPayment.method.toUpperCase()}</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                    {new Date(pendingPayment.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-6">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-800 dark:text-yellow-300">
                <strong>Important:</strong> Only mark as paid if you actually transferred the money. This will update your group balances.
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-3 rounded-lg mb-4 text-sm border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleNotYet}
              disabled={loading}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
            >
              Not Yet
            </button>
            <button
              onClick={handleMarkAsPaid}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-success dark:bg-green-600 text-white rounded-lg hover:opacity-90 transition disabled:opacity-50 font-medium flex items-center justify-center gap-2"
            >
              {loading ? (
                'Processing...'
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  Mark as Paid
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (paymentSuccess) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-card-3d dark:shadow-gray-900/50 animate-scale-in text-center">
          <div className="flex justify-end mb-2">
            <button
              onClick={onClose}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={24} />
            </button>
          </div>
          <div className="mb-4">
            <CheckCircle2 className="mx-auto text-green-500 dark:text-green-400" size={64} />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {userIsPaying ? 'Payment Sent!' : 'Payment Recorded!'}
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            {userIsPaying
              ? `${toMember?.name} has been notified and will confirm receipt.`
              : `${group?.currency} ${amount} has been settled.`}
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-primary dark:bg-indigo-600 text-white rounded-lg hover:bg-primary-hover dark:hover:bg-indigo-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (showConfirmation && userIsReceiving) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-card-3d dark:shadow-gray-900/50 animate-scale-in">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Confirm Payment</h2>
            <button
              onClick={() => setShowConfirmation(false)}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={24} />
            </button>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-yellow-600 dark:text-yellow-400 flex-shrink-0" size={24} />
              <div>
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200 mb-2">
                  Please confirm the payment details:
                </p>
                <div className="space-y-2 text-sm text-yellow-800 dark:text-yellow-300">
                  <p><strong>From:</strong> {fromMember?.name}</p>
                  <p><strong>To:</strong> {toMember?.name} (You)</p>
                  <p><strong>Amount:</strong> {group?.currency} {amount}</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            By confirming, you acknowledge that you have received this payment from {fromMember?.name}.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirmation(false)}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              Go Back
            </button>
            <button
              onClick={handleManualSettle}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-success dark:bg-green-600 text-white rounded-lg hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Authenticating...
                </>
              ) : (
                'Confirm Receipt'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-card-3d dark:shadow-gray-900/50 animate-scale-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {userIsPaying ? 'Pay Settlement' : 'Mark as Received'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-3 rounded-lg mb-4 text-sm flex items-start gap-2 border border-red-200 dark:border-red-800">
            <span className="font-semibold">Error:</span>
            <span>{error}</span>
          </div>
        )}

        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">Settlement Details:</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-lg font-semibold text-primary dark:text-indigo-400">{fromMember?.name}</span>
            <ArrowRight size={20} className="text-gray-400 dark:text-gray-500" />
            <span className="text-lg font-semibold text-primary dark:text-indigo-400">{toMember?.name}</span>
          </div>
          <p className="text-center text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {group?.currency} {settlement?.amount?.toFixed(2)}
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Amount ({group?.currency})
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max="1000000"
            value={amount}
            onChange={(e) => {
              const value = e.target.value;
              
              // Check if amount exceeds limit
              if (value && parseFloat(value) > 1000000) {
                setError('Settlement amount cannot exceed 1,000,000');
                return;
              }
              
              // Allow empty or valid numbers with max 2 decimals
              if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                setAmount(value);
                if (error && error.includes('cannot exceed')) {
                  setError(''); // Clear error when user fixes amount
                }
              }
            }}
            onBlur={(e) => {
              // Format to 2 decimals when user leaves field
              if (e.target.value && !isNaN(e.target.value)) {
                const formatted = parseFloat(e.target.value).toFixed(2);
                setAmount(formatted);
              }
            }}
            placeholder="0.00"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500 focus:border-transparent outline-none text-lg font-semibold"
            required
            autoFocus
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Suggested: {group?.currency} {settlement?.amount?.toFixed(2)} • Maximum: {group?.currency} 1,000,000.00
          </p>
        </div>

        {userIsPaying ? (
          /* User is paying - show payment options */
          <div className="mb-6">
            {/* Quick Payment Links Section — hidden when Paid Offline is selected */}
            {!loadingPaymentMethods && (getAvailablePaymentMethods(recipientPaymentMethods) || []).length > 0 && !selectedPaymentLink && paymentMethod !== 'manual' && (
              <div className="mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="relative group">
                    <Info size={18} className="text-blue-600 dark:text-blue-400" />
                    <div className="absolute left-0 top-6 w-64 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      These payment methods are set up by the recipient in their Profile settings
                    </div>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Quick Payment Options</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                  {toMember?.name} accepts payments via:
                </p>
                <div className="space-y-2">
                  {getAvailablePaymentMethods(recipientPaymentMethods).map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => handlePaymentLinkClick(method)}
                      disabled={!amount || parseFloat(amount) <= 0}
                      className="w-full flex items-center gap-3 p-3 bg-white dark:bg-gray-700 border-2 border-blue-200 dark:border-blue-700 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                        {method.icon}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-gray-900 dark:text-white">{method.name}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{method.description}</p>
                      </div>
                      <ExternalLink size={16} className="text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
                  Click to open payment app, then return here to mark as paid
                </p>
              </div>
            )}

            {/* SEPA Bank Transfer Button — hidden when Paid Offline is selected */}
            {!loadingPaymentMethods && recipientPaymentMethods?.encryptedIBAN && !selectedPaymentLink && paymentMethod !== 'manual' && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Or pay directly with SEPA</h3>
                <button
                  onClick={handleSepaPayment}
                  disabled={!amount || parseFloat(amount) <= 0}
                  className="w-full flex items-center gap-3 p-4 border-2 border-indigo-300 dark:border-indigo-700 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/50 transition">
                    <Landmark size={24} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-semibold text-gray-900 dark:text-white">SEPA Bank Transfer</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Secure bank-to-bank payment
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      IBAN available · Biometric secured
                    </div>
                  </div>
                  <ArrowRight size={20} className="text-gray-400 dark:text-gray-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition" />
                </button>
              </div>
            )}

            {/* Bank Transfer Details */}
            {selectedPaymentLink && selectedPaymentLink.id === 'bank' && (
              <div className="mb-6 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-2">
                    <CreditCard size={18} />
                    Bank Transfer Details
                  </h3>
                  <button
                    onClick={() => setSelectedPaymentLink(null)}
                    className="text-blue-600 dark:text-blue-400 text-sm hover:underline"
                  >
                    Back to options
                  </button>
                </div>
                
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-blue-600 dark:text-blue-400 font-medium">Recipient</p>
                    <p className="text-blue-900 dark:text-blue-200">{toMember?.name}</p>
                  </div>
                  
                  <div>
                    <p className="text-blue-600 dark:text-blue-400 font-medium">IBAN</p>
                    <div className="flex items-center gap-2">
                      <p className="text-blue-900 dark:text-blue-200 font-mono text-xs flex-1 break-all bg-white dark:bg-gray-700 p-2 rounded">
                        {selectedPaymentLink.iban}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedPaymentLink.iban);
                          setCopiedIban(true);
                          setTimeout(() => setCopiedIban(false), 2000);
                        }}
                        className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded flex-shrink-0"
                      >
                        {copiedIban ? <Check size={16} className="text-green-600 dark:text-green-400" /> : <Copy size={16} className="dark:text-blue-400" />}
                      </button>
                    </div>
                  </div>
                  
                  {selectedPaymentLink.bic && (
                    <div>
                      <p className="text-blue-600 dark:text-blue-400 font-medium">BIC</p>
                      <p className="text-blue-900 dark:text-blue-200 font-mono text-sm bg-white dark:bg-gray-700 p-2 rounded">{selectedPaymentLink.bic}</p>
                    </div>
                  )}
                  
                  <div>
                    <p className="text-blue-600 dark:text-blue-400 font-medium">Amount</p>
                    <p className="text-blue-900 dark:text-blue-200 font-semibold bg-white dark:bg-gray-700 p-2 rounded">{group.currency} {amount}</p>
                  </div>
                  
                  <div>
                    <p className="text-blue-600 dark:text-blue-400 font-medium">Reference</p>
                    <p className="text-blue-900 dark:text-blue-200 bg-white dark:bg-gray-700 p-2 rounded">SplitSync Settlement</p>
                  </div>
                </div>
                
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-3 text-center">
                  After making the transfer, mark the payment as completed below
                </p>
              </div>
            )}

            {/* Divider — hidden when Paid Offline is selected */}
{!loadingPaymentMethods && (getAvailablePaymentMethods(recipientPaymentMethods) || []).length > 0 && !selectedPaymentLink && paymentMethod !== 'manual' && (
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">or use</span>
                </div>
              </div>
            )}

            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setPaymentMethod('paypal')}
                className={`flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition ${
                  paymentMethod === 'paypal'
                    ? 'bg-blue-600 dark:bg-blue-700 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <CreditCard size={18} />
                <span className="font-medium">PayPal</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('manual')}
                className={`flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition ${
                  paymentMethod === 'manual'
                    ? 'bg-blue-600 dark:bg-blue-700 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <DollarSign size={18} />
                <span className="font-medium">Paid Offline</span>
              </button>
            </div>

            {paymentMethod === 'paypal' ? (
              <div>
                {/* Demo Mode — collapsible panel containing all PayPal sandbox UI */}
                <button
                  type="button"
                  onClick={() => setShowDemoInfo(prev => !prev)}
                  className="w-full flex items-center justify-between px-4 py-3 mb-2 rounded-xl border-2 border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-yellow-400 dark:bg-yellow-600 rounded-lg flex items-center justify-center shrink-0">
                      <CreditCard size={16} className="text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-yellow-900 dark:text-yellow-200">
                        Future feature - Settlement Payment Flow
                      </p>
                      <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">
                        {showDemoInfo ? 'Tap to collapse' : 'PayPal or Credit/Debit Card payment demo'}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`text-yellow-600 dark:text-yellow-400 transition-transform duration-300 shrink-0 ${showDemoInfo ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* Expanded PayPal sandbox panel */}
                {showDemoInfo && (
                  <div className="mb-2 border border-yellow-200 dark:border-yellow-800 rounded-xl overflow-hidden">
                    {/* Demo notice */}
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3 flex items-start gap-2 border-b border-yellow-200 dark:border-yellow-800">
                      <Info size={14} className="text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-yellow-800 dark:text-yellow-300">
                        <strong>Demo Mode:</strong> This uses a PayPal Sandbox environment. No real money is transferred. Use sandbox test credentials to complete the payment flow.
                      </p>
                    </div>
                    {/* PayPal buttons */}
                    <div className="px-4 py-4 bg-white dark:bg-gray-800">
                      {parseFloat(amount) > 0 ? (
                        <PayPalButtons
                          style={{ layout: 'vertical', label: 'pay' }}
                          createOrder={createPayPalOrder}
                          onApprove={onPayPalApprove}
                          onError={onPayPalError}
                          disabled={loading}
                        />
                      ) : (
                        <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                          Enter an amount above to continue
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Paid Offline — payer confirms they paid outside the app */
              <form onSubmit={handleManualSettle}>
                <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Mark this payment as completed if you paid {toMember?.name} via cash, bank transfer, or another method.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-3 bg-success dark:bg-green-600 text-white rounded-lg hover:opacity-90 transition disabled:opacity-50 font-medium"
                >
                  {loading ? 'Recording...' : 'Confirm Payment Sent'}
                </button>
              </form>
            )}
          </div>
        ) : (
          /* ── Receiver view: collapsible QR + confirm received ── */
          <div>

            {/* QR toggle button — hidden by default, tap to reveal for payer to scan */}
            <button
              type="button"
              onClick={() => setShowQR(prev => !prev)}
              className="w-full flex items-center justify-between px-4 py-3 mb-3 rounded-xl border-2 border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-600 dark:bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
                  <QrCode size={16} className="text-white" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-indigo-800 dark:text-indigo-200">
                    Let {fromMember?.name} scan to pay you
                  </p>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {showQR ? 'Tap to hide QR code' : 'Tap to show PayPal or Revolut QR code'}
                  </p>
                </div>
              </div>
              <ChevronDown
                size={18}
                className={`text-indigo-500 dark:text-indigo-400 transition-transform duration-300 shrink-0 ${showQR ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Collapsible QR panel */}
            {showQR && (
              <div className="mb-4 border border-indigo-200 dark:border-indigo-800 rounded-xl overflow-hidden">

                {/* Instruction */}
                <div className="bg-indigo-50 dark:bg-indigo-900/30 px-4 py-3 flex items-start gap-2">
                  <Smartphone size={15} className="text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                  <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">
                    Show this screen to <strong>{fromMember?.name}</strong> — they scan the QR code with their phone camera to pay you instantly via PayPal or Revolut.
                  </p>
                </div>

                {/* Tab selector — only show tabs for methods the receiver has configured */}
                {recipientPaymentMethods && (recipientPaymentMethods.paypalUsername || recipientPaymentMethods.revolutUsername) && (
                  <div className="flex gap-2 px-4 pt-3">
                    {recipientPaymentMethods.paypalUsername && (
                      <button
                        type="button"
                        onClick={() => setActiveQR('paypal')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                          activeQR === 'paypal'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        PayPal
                      </button>
                    )}
                    {recipientPaymentMethods.revolutUsername && (
                      <button
                        type="button"
                        onClick={() => setActiveQR('revolut')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                          activeQR === 'revolut'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        Revolut
                      </button>
                    )}
                  </div>
                )}

                {/* QR code display */}
                <div className="flex flex-col items-center py-4 px-4">
                  {recipientPaymentMethods?.paypalUsername && activeQR === 'paypal' && (
                    <>
                      <QRCodeCanvas
                        value={generatePayPalLink(
                          recipientPaymentMethods.paypalUsername,
                          parseFloat(amount),
                          group?.currency || 'EUR'
                        )}
                        size={200}
                      />
                      <p className="mt-3 text-sm font-semibold text-gray-800 dark:text-white">
                        Scan to pay via PayPal
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Opens PayPal pre-filled with {group?.currency || 'EUR'} {parseFloat(amount || 0).toFixed(2)}
                      </p>
                    </>
                  )}
                  {recipientPaymentMethods?.revolutUsername && activeQR === 'revolut' && (
                    <>
                      <QRCodeCanvas
                        value={generateRevolutLink(
                          recipientPaymentMethods.revolutUsername,
                          parseFloat(amount),
                          group?.currency || 'EUR'
                        )}
                        size={200}
                      />
                      <p className="mt-3 text-sm font-semibold text-gray-800 dark:text-white">
                        Scan to pay via Revolut
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Opens Revolut — enter {group?.currency || 'EUR'} {parseFloat(amount || 0).toFixed(2)} to complete
                      </p>
                    </>
                  )}
                  {/* Fallback — no payment methods configured */}
                  {!recipientPaymentMethods?.paypalUsername && !recipientPaymentMethods?.revolutUsername && (
                    <div className="text-center py-4">
                      <QrCode size={36} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">No payment methods set up yet.</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Add your PayPal or Revolut username in Profile to enable QR payments.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Confirm received button — always visible regardless of QR state */}
            <form onSubmit={handleManualSettle}>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 bg-success dark:bg-green-600 text-white rounded-lg hover:opacity-90 transition disabled:opacity-50 font-medium"
              >
                {loading ? 'Recording...' : 'Confirm Payment Received'}
              </button>
            </form>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-3 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
        >
          Cancel
        </button>
      </div>

      {/* Payment Info Modal */}
      <PaymentInfoModal
        isOpen={showPaymentInfo}
        onClose={() => setShowPaymentInfo(false)}
        paymentInfo={paymentInfo}
      />

      {/* SEPA Payment Modal */}
      {showSepaModal && sepaPaymentData && (
        <SepaPaymentModal
          isOpen={showSepaModal}
          onClose={() => setShowSepaModal(false)}
          payment={sepaPaymentData}
          currentUser={{ uid: currentUserId }}
          onPaymentSuccess={handleSepaPaymentSuccess}
        />
      )}
    </div>
  );
}
