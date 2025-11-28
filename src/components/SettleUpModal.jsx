// src/components/SettleUpModal.jsx
import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function SettleUpModal({ isOpen, onClose, settlement, group }) {
  const [amount, setAmount] = useState(settlement?.amount?.toFixed(2) || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fromMember = group?.members?.find(m => m.userId === settlement?.from);
  const toMember = group?.members?.find(m => m.userId === settlement?.to);

  const handleSettle = async (e) => {
    e.preventDefault();
    setError('');

    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      setError('Valid amount is required');
      return;
    }

    setLoading(true);

    try {
      // Record settlement as a special "payment" expense
      const settlementData = {
        groupId: group.id,
        title: `Settlement: ${fromMember?.name} → ${toMember?.name}`,
        amount: amountNum,
        currency: group.currency,
        paidBy: settlement.from,
        category: 'settlement',
        description: `Payment recorded`,
        date: new Date(),
        splitMethod: 'exact',
        splits: {
          [settlement.from]: -amountNum,  // Payer reduces their debt
          [settlement.to]: amountNum,      // Receiver reduces what they're owed
        },
        participants: [settlement.from, settlement.to],
        createdAt: serverTimestamp(),
        isSettlement: true,
      };

      await addDoc(collection(db, 'expenses'), settlementData);
      
      onClose();
    } catch (err) {
      console.error('Error recording settlement:', err);
      setError('Failed to record settlement. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Record Payment</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-700 mb-2">Payment Details:</p>
          <p className="text-lg font-semibold text-gray-900">
            <span className="text-primary">{fromMember?.name}</span>
            {' '}pays{' '}
            <span className="text-primary">{toMember?.name}</span>
          </p>
        </div>

        <form onSubmit={handleSettle} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount ({group?.currency})
            </label>
            <input
              type="number"
              step="0.01"
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

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-success text-white rounded-lg hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}