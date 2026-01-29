// src/components/SettleUpModal.jsx - FINAL VERSION WITH ALL FIXES
import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { PayPalButtons } from '@paypal/react-paypal-js';
import { DollarSign, CreditCard, CheckCircle2, X, ArrowRight, AlertCircle } from 'lucide-react';

export default function SettleUpModal({ isOpen, onClose, settlement, group, currentUserId }) {
  const [amount, setAmount] = useState(settlement?.amount?.toFixed(2) || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('paypal');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const fromMember = group?.members?.find(m => m.userId === settlement?.from);
  const toMember = group?.members?.find(m => m.userId === settlement?.to);

  // Determine if current user is the one paying or receiving
  const userIsPaying = currentUserId === settlement?.from;
  const userIsReceiving = currentUserId === settlement?.to;

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
          [settlement.from]: -amountNum,
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
      console.log('PayPal payment successful:', details);
      
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
      <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-card-3d animate-scale-in">
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
    </div>
  );
}
