// src/components/SepaPaymentModal.jsx - IMPROVED VERSION
import { useState, useEffect } from 'react';
import { X, CreditCard, Shield, AlertCircle, CheckCircle, Loader, Info } from 'lucide-react';
import { 
  processSepaPayment, 
  generatePaymentReference,
  maskIBAN,
  validatePaymentAmount,
  createPaymentDescription,
  calculatePaymentFee
} from '../utils/sepaPayment';
import { fetchIban } from '../utils/ibanService';
import { loadMyPrivateDetails } from '../utils/privateProfile';
import { authenticateWithBiometric } from '../utils/biometric';

export default function SepaPaymentModal({ 
  isOpen, 
  onClose, 
  payment,
  currentUser,
  onPaymentSuccess 
}) {
  const [step, setStep] = useState('confirm'); // 'confirm', 'processing', 'success', 'error'
  const [error, setError] = useState('');
  const [paymentResult, setPaymentResult] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [senderPaymentMethods, setSenderPaymentMethods] = useState(null);
  const [loadingPaymentData, setLoadingPaymentData] = useState(true);

  // Fetch sender's payment methods
  useEffect(() => {
    const fetchSenderPaymentMethods = async () => {
      if (!isOpen || !currentUser) return;
      
      setLoadingPaymentData(true);
      try {
        // Own payment methods live in the private profile doc
        const { paymentMethods } = await loadMyPrivateDetails(currentUser.uid);
        const methods = paymentMethods && Object.keys(paymentMethods).length ? { ...paymentMethods } : null;
        // Own IBAN is decrypted server-side (the browser holds no key)
        if (methods?.encryptedIBAN) {
          methods.iban = await fetchIban(currentUser.uid);
        }
        setSenderPaymentMethods(methods);
      } catch (error) {
        console.error('Error fetching sender payment methods:', error);
        setError('Could not load your payment information');
      } finally {
        setLoadingPaymentData(false);
      }
    };

    fetchSenderPaymentMethods();
  }, [isOpen, currentUser]);

  if (!isOpen || !payment) return null;

  const {
    amount,
    fromUser,
    toUser,
    toUserPaymentMethods,
    groupName,
    groupId
  } = payment;

  // Plain IBANs come from the server: the sender's own (fetched above) and the
  // recipient's (fetched by SettleUpModal, which passes it as .iban)
  const fromIBAN = senderPaymentMethods?.iban || null;
  const toIBAN   = toUserPaymentMethods?.iban || null;

  const paymentFee = calculatePaymentFee(amount);
  const totalAmount = amount + paymentFee;

  const handleConfirmPayment = async () => {
    setError('');
    setIsAuthenticating(true);

    try {
      // Require biometric authentication before payment
      const authenticated = await authenticateWithBiometric(
        currentUser.uid,
        'Authenticate to confirm payment'
      );

      if (!authenticated) {
        setError('Authentication failed. Payment cancelled.');
        setIsAuthenticating(false);
        return;
      }

      setIsAuthenticating(false);
      setStep('processing');

      // Validate amount
      const validation = validatePaymentAmount(amount);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Check IBANs exist
      if (!fromIBAN) {
        throw new Error('Your IBAN is not set. Please add it in your profile settings.');
      }

      if (!toIBAN) {
        throw new Error('Recipient IBAN not available. They need to set up their payment method.');
      }

      // Generate payment reference
      const reference = generatePaymentReference();
      const description = createPaymentDescription(groupName, fromUser.name);

      // Process payment (simulated)
      const result = await processSepaPayment({
        amount,
        fromUserId: fromUser.id,
        toUserId: toUser.id,
        fromIBAN,
        toIBAN,
        reference,
        description,
        groupId
      });

      setPaymentResult(result);
      setStep('success');

      // Call success callback to update balances
      if (onPaymentSuccess) {
        await onPaymentSuccess({
          ...result,
          groupId,
          fromUserId: fromUser.id,
          toUserId: toUser.id,
          amount
        });
      }

    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed. Please try again.');
      setStep('error');
    }
  };

  const handleClose = () => {
    if (step === 'processing') return; // Don't allow closing during processing
    onClose();
    // Reset state after modal closes
    setTimeout(() => {
      setStep('confirm');
      setError('');
      setPaymentResult(null);
    }, 300);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl dark:shadow-gray-900/50 max-w-md w-full my-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
              <CreditCard size={20} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">SEPA Payment</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Demo Mode - Simulation</p>
            </div>
          </div>
          {step !== 'processing' && (
            <button
              onClick={handleClose}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition"
            >
              <X size={24} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Loading State */}
          {loadingPaymentData ? (
            <div className="py-12 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Loader size={32} className="text-gray-400 dark:text-gray-500 animate-spin" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Loading payment information...</p>
            </div>
          ) : (
            <>
              {/* Confirm Step */}
              {step === 'confirm' && (
                <div className="space-y-6">
                  {/* Demo Mode Notice */}
                  <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Info size={16} className="text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-yellow-800 dark:text-yellow-300">
                        <p className="font-medium mb-1">Demo Mode</p>
                        <p>This is a simulated SEPA payment for demonstration purposes. No real money will be transferred.</p>
                      </div>
                    </div>
                  </div>

                  {/* Payment Details */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">From</label>
                      <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <p className="font-medium text-gray-900 dark:text-white">{fromUser.name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 font-mono mt-1">
                          {fromIBAN ? maskIBAN(fromIBAN) : (
                            <span className="text-red-600 dark:text-red-400">IBAN not set - Go to Profile</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                        <span className="text-gray-400 dark:text-gray-500">→</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">To</label>
                      <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <p className="font-medium text-gray-900 dark:text-white">{toUser.name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 font-mono mt-1">
                          {toIBAN ? maskIBAN(toIBAN) : (
                            <span className="text-red-600 dark:text-red-400">IBAN not set</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Amount</span>
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">€{amount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Payment Fee</span>
                        <span className="text-sm text-green-600 dark:text-green-400 font-medium">FREE</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total</span>
                        <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">€{totalAmount.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <Shield size={16} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-blue-800 dark:text-blue-300">
                          <p className="font-medium mb-1">Secure Payment</p>
                          <p>Your payment will be authenticated with biometric verification for security.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Error Display */}
                  {error && (
                    <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle size={16} className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleClose}
                      className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmPayment}
                      disabled={isAuthenticating || !fromIBAN || !toIBAN}
                      className="flex-1 px-4 py-3 bg-indigo-600 dark:bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                    >
                      {isAuthenticating ? (
                        <>
                          <Loader size={16} className="animate-spin" />
                          Authenticating...
                        </>
                      ) : (
                        <>
                          <Shield size={16} />
                          Confirm Payment
                        </>
                      )}
                    </button>
                  </div>

                  {(!fromIBAN || !toIBAN) && (
                    <p className="text-xs text-center text-red-600 dark:text-red-400">
                      {!fromIBAN && "Set up your IBAN in Profile Settings first. "}
                      {!toIBAN && "Recipient hasn't set up their IBAN yet."}
                    </p>
                  )}
                </div>
              )}

              {/* Processing Step */}
              {step === 'processing' && (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Loader size={32} className="text-indigo-600 dark:text-indigo-400 animate-spin" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Processing Payment</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Please wait while we process your SEPA transfer...</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-4">This may take a few seconds</p>
                </div>
              )}

              {/* Success Step */}
              {step === 'success' && paymentResult && (
                <div className="space-y-6">
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Payment Successful!</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Your SEPA transfer has been initiated</p>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Payment Reference</span>
                      <span className="font-mono text-gray-900 dark:text-white">{paymentResult.reference}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Amount</span>
                      <span className="font-semibold text-gray-900 dark:text-white">€{amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Status</span>
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs font-medium">
                        Completed
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Estimated Arrival</span>
                      <span className="text-gray-900 dark:text-white">
                        {new Date(paymentResult.estimatedArrival).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-green-800 dark:text-green-300">
                        <p className="font-medium mb-1">Payment Initiated</p>
                        <p>The funds will typically arrive in 1-2 business days. You'll receive a confirmation once the transfer is complete.</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleClose}
                    className="w-full px-4 py-3 bg-indigo-600 dark:bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-700 transition font-medium"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* Error Step */}
              {step === 'error' && (
                <div className="space-y-6">
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle size={32} className="text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Payment Failed</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">We couldn't process your payment</p>
                  </div>

                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleClose}
                      className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setStep('confirm');
                        setError('');
                      }}
                      className="flex-1 px-4 py-3 bg-indigo-600 dark:bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-700 transition font-medium"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
