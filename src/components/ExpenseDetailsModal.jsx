// src/components/ExpenseDetailsModal.jsx
import { X, User, Calendar, Tag, Users, DollarSign, FileText } from 'lucide-react';

export default function ExpenseDetailsModal({ isOpen, onClose, expense, group }) {
  if (!isOpen || !expense) return null;

  const payer = group?.members?.find(m => m.userId === expense.paidBy);
  const expenseDate = expense.date?.toDate ? expense.date.toDate() : new Date(expense.date);
  
  // Get participant details with their shares
  const participantShares = expense.participants?.map(userId => {
    const member = group?.members?.find(m => m.userId === userId);
    const share = expense.splits?.[userId] || 0;
    return {
      member,
      share,
      percentage: ((share / expense.amount) * 100).toFixed(1)
    };
  }) || [];

  // Format split method display
  const getSplitMethodDisplay = () => {
    switch(expense.splitMethod) {
      case 'equal': return 'Split Equally';
      case 'percentage': return 'Split by Percentage';
      case 'exact': return 'Exact Amounts';
      case 'shares': return 'Split by Shares';
      default: return expense.splitMethod;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">{expense.title}</h2>
            {expense.isSettlement && (
              <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                Settlement
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 ml-4"
          >
            <X size={24} />
          </button>
        </div>

        {/* Amount Card */}
        <div className="bg-primary-light border border-primary rounded-lg p-6 mb-6 text-center">
          <p className="text-sm text-gray-600 mb-1">Total Amount</p>
          <p className="text-4xl font-bold text-primary">
            {expense.currency} {expense.amount.toFixed(2)}
          </p>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Paid By */}
          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center flex-shrink-0">
              <User size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Paid by</p>
              <p className="font-semibold text-gray-900">{payer?.name || 'Unknown'}</p>
              <p className="text-xs text-gray-500">{payer?.email}</p>
            </div>
          </div>

          {/* Date */}
          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Calendar size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Date</p>
              <p className="font-semibold text-gray-900">
                {expenseDate.toLocaleDateString('en-IE', { 
                  weekday: 'short',
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </p>
              <p className="text-xs text-gray-500">{expenseDate.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>

          {/* Category */}
          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Tag size={20} className="text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Category</p>
              <p className="font-semibold text-gray-900 capitalize">{expense.category || 'Other'}</p>
            </div>
          </div>

          {/* Split Method */}
          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Users size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Split Method</p>
              <p className="font-semibold text-gray-900">{getSplitMethodDisplay()}</p>
              <p className="text-xs text-gray-500">{participantShares.length} participant{participantShares.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        {/* Description */}
        {expense.description && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={18} className="text-gray-600" />
              <h3 className="font-semibold text-gray-900">Description</h3>
            </div>
            <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{expense.description}</p>
          </div>
        )}

        {/* Split Breakdown */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign size={18} className="text-gray-600" />
            <h3 className="font-semibold text-gray-900">Split Breakdown</h3>
          </div>
          <div className="space-y-2">
            {participantShares.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center">
                    <span className="text-primary font-semibold">
                      {item.member?.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{item.member?.name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500">
                      {item.percentage}% of total
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">
                    {expense.currency} {item.share.toFixed(2)}
                  </p>
                  {item.member?.userId === expense.paidBy && (
                    <span className="text-xs text-green-600 font-medium">Paid</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Method Info (if settlement) */}
        {expense.isSettlement && expense.paymentMethod && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-900">
              <strong>Payment Method:</strong> {expense.paymentMethod === 'paypal' ? 'PayPal' : 'Manual Payment'}
            </p>
            {expense.paypalOrderId && (
              <p className="text-xs text-blue-700 mt-1">
                Order ID: {expense.paypalOrderId}
              </p>
            )}
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
        >
          Close
        </button>
      </div>
    </div>
  );
}
