// src/components/SettleUpModal.jsx - FINAL VERSION WITH ALL FIXES
import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { PayPalButtons } from '@paypal/react-paypal-js';
import { DollarSign, CreditCard, CheckCircle2, X, ArrowRight, AlertCircle, ExternalLink, Copy, Check, Info, Landmark } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { generatePayPalLink, generateRevolutLink, getAvailablePaymentMethods } from '../utils/paymentLinks';
import { useEffect } from 'react';
import PaymentInfoModal from './PaymentInfoModal';
import SepaPaymentModal from './SepaPaymentModal';

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
  const [showPaymentInfo, setShowPaymentInfo] = useState(false);  // ← ADD THIS!
  const [showSepaModal, setShowSepaModal] = useState(false);
  const [sepaPaymentData, setSepaPaymentData] = useState(null);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const fromMember = group?.members?.find(m => m.userId === settlement?.from);
  const toMember = group?.members?.find(m => m.userId === settlement?.to);

  // Determine if current user is the one paying or receiving
  const userIsPaying = currentUserId === settlement?.from;
  const userIsReceiving = currentUserId === settlement?.to;

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
      return true;
    } catch (err) {
      console.error('Error recording settlement:', err);
      throw err;
    }
  };

  const handleManualSettle = async (e) => {
    e.preventDefault();
    setError('');

    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      setError('Valid amount is required');
      return;
    }

    // For receivers, show confirmation first
    if (userIsReceiving && !showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    setLoading(true);

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
    // Prepare payment data for SEPA modal
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
      fromUserPaymentMethods: null, // Will be fetched in modal
      toUserPaymentMethods: recipientPaymentMethods,
      groupName: group.name,
      groupId: group.id
    };
    
    setSepaPaymentData(paymentData);
    setShowSepaModal(true);
  };

  const handleSepaPaymentSuccess = async (paymentResult) => {
    try {
      // Record the settlement in Firestore
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
      
      // Close main modal after short delay
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (err) {
      console.error('Error recording SEPA settlement:', err);
      setError('Payment processed but failed to record. Please contact support.');
    }
  };


  const handlePaymentLinkClick = (method) => {
    const amountNum = parseFloat(amount);
    
    if (method.id === 'paypal' || method.id === 'paypal-link') {
      // Show beautiful modal instead of alert
      setPaymentInfo({
        method: 'paypal',
        amount: amountNum,
        currency: group.currency,
        username: method.username,
        onProceed: () => {
          const link = generatePayPalLink(method.username, amountNum, group.currency);
          window.open(link, '_blank');
        }
      });
      setShowPaymentInfo(true);
      
    } else if (method.id === 'revolut') {
      // Show beautiful modal instead of alert
      setPaymentInfo({
        method: 'revolut',
        amount: amountNum,
        currency: group.currency,
        username: method.username,
        onProceed: () => {
          const link = generateRevolutLink(method.username, amountNum, group.currency);
          window.open(link, '_blank');
        }
      });
      setShowPaymentInfo(true);
      
    } else if (method.id === 'bank') {
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

  if (paymentSuccess) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
        <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-card-3d animate-scale-in text-center">
          <div className="flex justify-end mb-2">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
          </div>
          <div className="mb-4">
            <CheckCircle2 className="mx-auto text-green-500" size={64} />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            {userIsPaying ? 'Payment Sent!' : 'Payment Received!'}
          </h3>
          <p className="text-gray-600 mb-4">
            {group?.currency} {amount} has been settled
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Confirmation screen for receivers
  if (showConfirmation && userIsReceiving) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
        <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-card-3d animate-scale-in">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Confirm Payment</h2>
            <button
              onClick={() => setShowConfirmation(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-yellow-600 flex-shrink-0" size={24} />
              <div>
                <p className="text-sm font-medium text-yellow-900 mb-2">
                  Please confirm the payment details:
                </p>
                <div className="space-y-2 text-sm text-yellow-800">
                  <p><strong>From:</strong> {fromMember?.name}</p>
                  <p><strong>To:</strong> {toMember?.name} (You)</p>
                  <p><strong>Amount:</strong> {group?.currency} {amount}</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-6">
            By confirming, you acknowledge that you have received this payment from {fromMember?.name}.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirmation(false)}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Go Back
            </button>
            <button
              onClick={handleManualSettle}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-success text-white rounded-lg hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? 'Confirming...' : 'Confirm Receipt'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-card-3d animate-scale-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {userIsPaying ? 'Pay Settlement' : 'Mark as Received'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm flex items-start gap-2">
            <span className="font-semibold">Error:</span>
            <span>{error}</span>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-700 mb-2">Settlement Details:</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-lg font-semibold text-primary">{fromMember?.name}</span>
            <ArrowRight size={20} className="text-gray-400" />
            <span className="text-lg font-semibold text-primary">{toMember?.name}</span>
          </div>
          <p className="text-center text-2xl font-bold text-gray-900 mt-2">
            {group?.currency} {settlement?.amount?.toFixed(2)}
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amount ({group?.currency})
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-lg font-semibold"
            required
            autoFocus
          />
          <p className="text-xs text-gray-500 mt-1">
            Suggested: {group?.currency} {settlement?.amount?.toFixed(2)}
          </p>
        </div>

        {userIsPaying ? (
          /* User is paying - show payment options */
          <div className="mb-6">
            {/* Quick Payment Links Section */}
            {!loadingPaymentMethods && getAvailablePaymentMethods(recipientPaymentMethods).length > 0 && !selectedPaymentLink && (
              <div className="mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="relative group">
                    <Info size={18} className="text-blue-600" />
                    <div className="absolute left-0 top-6 w-64 bg-gray-900 text-white text-xs rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      These payment methods are set up by the recipient in their Profile settings
                    </div>
                  </div>
                  <h3 className="font-semibold text-gray-900">Quick Payment Options</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  {toMember?.name} accepts payments via:
                </p>
                <div className="space-y-2">
                  {getAvailablePaymentMethods(recipientPaymentMethods).map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => handlePaymentLinkClick(method)}
                      disabled={!amount || parseFloat(amount) <= 0}
                      className="w-full flex items-center gap-3 p-3 bg-white border-2 border-blue-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                        {method.icon}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-gray-900">{method.name}</p>
                        <p className="text-xs text-gray-600">{method.description}</p>
                      </div>
                      <ExternalLink size={16} className="text-gray-400 group-hover:text-blue-600" />
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-3 text-center">
                  Click to open payment app, then return here to mark as paid
                </p>
              </div>
            )}

            {/* SEPA Bank Transfer Button */}
            {!loadingPaymentMethods && recipientPaymentMethods?.encryptedIBAN && !selectedPaymentLink && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Or pay directly with SEPA</h3>
                <button
                  onClick={handleSepaPayment}
                  disabled={!amount || parseFloat(amount) <= 0}
                  className="w-full flex items-center gap-3 p-4 border-2 border-indigo-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center group-hover:bg-indigo-200 transition">
                    <Landmark size={24} className="text-indigo-600" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-semibold text-gray-900">SEPA Bank Transfer</div>
                    <div className="text-sm text-gray-600">
                      Secure bank-to-bank payment
                    </div>
                    <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      IBAN available · Biometric secured
                    </div>
                  </div>
                  <ArrowRight size={20} className="text-gray-400 group-hover:text-indigo-600 transition" />
                </button>
              </div>
            )}

            {/* Bank Transfer Details */}
            {selectedPaymentLink && selectedPaymentLink.id === 'bank' && (
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                    <CreditCard size={18} />
                    Bank Transfer Details
                  </h3>
                  <button
                    onClick={() => setSelectedPaymentLink(null)}
                    className="text-blue-600 text-sm hover:underline"
                  >
                    Back to options
                  </button>
                </div>
                
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-blue-600 font-medium">Recipient</p>
                    <p className="text-blue-900">{toMember?.name}</p>
                  </div>
                  
                  <div>
                    <p className="text-blue-600 font-medium">IBAN</p>
                    <div className="flex items-center gap-2">
                      <p className="text-blue-900 font-mono text-xs flex-1 break-all bg-white p-2 rounded">
                        {selectedPaymentLink.iban}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedPaymentLink.iban);
                          setCopiedIban(true);
                          setTimeout(() => setCopiedIban(false), 2000);
                        }}
                        className="p-2 hover:bg-blue-100 rounded flex-shrink-0"
                      >
                        {copiedIban ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>
                  
                  {selectedPaymentLink.bic && (
                    <div>
                      <p className="text-blue-600 font-medium">BIC</p>
                      <p className="text-blue-900 font-mono text-sm bg-white p-2 rounded">{selectedPaymentLink.bic}</p>
                    </div>
                  )}
                  
                  <div>
                    <p className="text-blue-600 font-medium">Amount</p>
                    <p className="text-blue-900 font-semibold bg-white p-2 rounded">{group.currency} {amount}</p>
                  </div>
                  
                  <div>
                    <p className="text-blue-600 font-medium">Reference</p>
                    <p className="text-blue-900 bg-white p-2 rounded">SplitSync Settlement</p>
                  </div>
                </div>
                
                <p className="text-xs text-blue-700 mt-3 text-center">
                  After making the transfer, mark the payment as completed below
                </p>
              </div>
            )}

            {/* Divider */}
            {!loadingPaymentMethods && getAvailablePaymentMethods(recipientPaymentMethods).length > 0 && !selectedPaymentLink && (
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-white text-gray-500">or use</span>
                </div>
              </div>
            )}

            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setPaymentMethod('paypal')}
                className={`flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition ${
                  paymentMethod === 'paypal'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <DollarSign size={18} />
                <span className="font-medium">Paid Offline</span>
              </button>
            </div>

            {paymentMethod === 'paypal' ? (
              <div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-yellow-800">
                    <strong>Demo Mode:</strong> Using PayPal Sandbox for demonstration.
                  </p>
                </div>
                {parseFloat(amount) > 0 ? (
                  <PayPalButtons
                    style={{ layout: 'vertical', label: 'pay' }}
                    createOrder={createPayPalOrder}
                    onApprove={onPayPalApprove}
                    onError={onPayPalError}
                    disabled={loading}
                  />
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    Enter an amount to continue
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleManualSettle}>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-700">
                    Mark this payment as completed if you paid {toMember?.name} via cash, bank transfer, or another method.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-3 bg-success text-white rounded-lg hover:opacity-90 transition disabled:opacity-50 font-medium"
                >
                  {loading ? 'Recording...' : 'Confirm Payment Sent'}
                </button>
              </form>
            )}
          </div>
        ) : (
          /* User is receiving - manual confirmation only */
          <form onSubmit={handleManualSettle}>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-green-900 mb-2">
                Did you receive this payment?
              </p>
              <p className="text-sm text-green-700">
                You will be asked to confirm before recording this payment.
              </p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-success text-white rounded-lg hover:opacity-90 transition disabled:opacity-50 font-medium"
            >
              {loading ? 'Recording...' : 'Confirm Payment Received'}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-3 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
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
