// src/components/PaymentInfoModal.jsx
import { X, ExternalLink, CreditCard, Smartphone, Info } from 'lucide-react';

export default function PaymentInfoModal({ isOpen, onClose, paymentInfo }) {
  if (!isOpen || !paymentInfo) return null;

  const { method, amount, currency, username, onProceed } = paymentInfo;

  const getMethodIcon = () => {
    switch(method) {
      case 'paypal': return '💳';
      case 'revolut': return '💶';
      default: return '💰';
    }
  };

  const getMethodName = () => {
    switch(method) {
      case 'paypal': return 'PayPal';
      case 'revolut': return 'Revolut';
      default: return 'Payment';
    }
  };

  const handleProceed = () => {
    onProceed();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-scale-in">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-card-3d animate-scale-in">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-dark rounded-full flex items-center justify-center text-2xl">
              {getMethodIcon()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Opening {getMethodName()}</h2>
              <p className="text-sm text-gray-500">Payment Instructions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Payment Details Card */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard size={18} className="text-blue-600" />
            <h3 className="font-semibold text-blue-900">Payment Details</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-700">Amount:</span>
              <span className="font-bold text-blue-900">{currency} {amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Recipient:</span>
              <span className="font-bold text-blue-900">@{username}</span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-2 mb-3">
            <Info size={18} className="text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-yellow-900 mb-2">Important Steps</h3>
              <ol className="text-sm text-yellow-800 space-y-2 list-decimal list-inside">
                <li>Enter the amount manually: <strong>{currency} {amount.toFixed(2)}</strong></li>
                {method === 'revolut' && (
                  <>
                    <li className="flex items-start gap-1">
                      <span className="flex-shrink-0">Note:</span>
                      <span>
                        <strong>If using Mobile:</strong> Choose "Pay with Card" or "Apple Pay" <br/>
                        <strong>If using Desktop:</strong> Scan QR code with your phone
                      </span>
                    </li>
                    <li>Complete the payment securely in {getMethodName()}</li>
                    <li>Return here and click "Confirm Payment Sent"</li>
                  </>
                )}
                {method === 'paypal' && (
                  <>
                    <li>Securely Login to your PayPal account</li>
                    <li>Click "Send" and follow the instructions to complete payment (You may need to review the amount before confirming payment)</li>
                    <li>Return here and click "Confirm Payment Sent"</li>
                  </>
                )}
              </ol>
            </div>
          </div>
        </div>

        {/* Mobile Device Tip */}
        {method === 'revolut' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
            <div className="flex items-start gap-2">
              <Smartphone size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-800">
                <p className="font-medium mb-1">Using mobile?</p>
                <p>The QR code option works best when you have another device with your Revolut app. On mobile, use "Pay with Card" for instant payment.</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleProceed}
            className="flex-1 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition font-medium flex items-center justify-center gap-2"
          >
            <ExternalLink size={18} />
            Open {getMethodName()}
          </button>
        </div>
      </div>
    </div>
  );
}
