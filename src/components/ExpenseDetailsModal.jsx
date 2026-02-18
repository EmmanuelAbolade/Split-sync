// src/components/ExpenseDetailsModal.jsx
import { X, User, Calendar, Tag, Users, DollarSign, FileText, Receipt, Download, ExternalLink } from 'lucide-react';

export default function ExpenseDetailsModal({ isOpen, onClose, expense, group }) {
  if (!isOpen || !expense) return null;

  const payer = group?.members?.find(m => m.userId === expense.paidBy);
  const expenseDate = expense.date?.toDate ? expense.date.toDate() : new Date(expense.date);
  
  // Get current names for settlement participants
  const getSettlementParticipants = () => {
    if (!expense.isSettlement || !expense.participants || expense.participants.length !== 2) {
      return null;
    }
    
    const fromUserId = expense.paidBy; // Person who paid (sender)
    const toUserId = expense.participants.find(id => id !== expense.paidBy); // Receiver
    
    const fromMember = group?.members?.find(m => m.userId === fromUserId);
    const toMember = group?.members?.find(m => m.userId === toUserId);
    
    return {
      from: fromMember?.name || 'Unknown',
      to: toMember?.name || 'Unknown',
    };
  };
  
  const settlementParticipants = getSettlementParticipants();

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
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {expense.isSettlement && settlementParticipants
                ? `Settlement: ${settlementParticipants.from} → ${settlementParticipants.to}`
                : expense.title
              }
            </h2>
            {expense.isSettlement && (
              <span className="inline-block px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded border border-green-200 dark:border-green-800">
                Settlement
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 ml-4"
          >
            <X size={24} />
          </button>
        </div>

        {/* Receipt Image Section - NEW! */}
        {expense.receiptURL && (
          <div className="mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Receipt size={20} className="text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Scanned Receipt</h3>
            </div>
            
            {/* Receipt Image Preview */}
            <div className="bg-white dark:bg-gray-700 rounded-lg p-2 mb-3">
              <img 
                src={expense.receiptURL} 
                alt="Receipt" 
                className="w-full h-64 object-contain rounded"
              />
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              <a
                href={expense.receiptURL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-600 transition text-sm font-medium flex items-center justify-center gap-2"
              >
                <ExternalLink size={16} />
                View Full Size
              </a>
              <a
                href={expense.receiptURL}
                download
                className="flex-1 px-3 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition text-sm font-medium flex items-center justify-center gap-2"
              >
                <Download size={16} />
                Download
              </a>
            </div>
          </div>
        )}

        {/* Amount Card */}
        <div className="bg-primary-light dark:bg-indigo-900/30 border border-primary dark:border-indigo-700 rounded-lg p-6 mb-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Amount</p>
          <p className="text-4xl font-bold text-primary dark:text-indigo-400">
            {expense.currency} {expense.amount.toFixed(2)}
          </p>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Paid By */}
          <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="w-10 h-10 bg-primary-light dark:bg-indigo-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <User size={20} className="text-primary dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Paid by</p>
              <p className="font-semibold text-gray-900 dark:text-white">{payer?.name || 'Unknown'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{payer?.email}</p>
            </div>
          </div>

          {/* Date */}
          <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <Calendar size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Date</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {expenseDate.toLocaleDateString('en-IE', { 
                  weekday: 'short',
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{expenseDate.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>

          {/* Category */}
          <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <Tag size={20} className="text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Category</p>
              <p className="font-semibold text-gray-900 dark:text-white capitalize">{expense.category || 'Other'}</p>
            </div>
          </div>

          {/* Split Method */}
          <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <Users size={20} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Split Method</p>
              <p className="font-semibold text-gray-900 dark:text-white">{getSplitMethodDisplay()}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{participantShares.length} participant{participantShares.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        {/* Description */}
        {expense.description && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={18} className="text-gray-600 dark:text-gray-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Description</h3>
            </div>
            <p className="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">{expense.description}</p>
          </div>
        )}

        {/* Split Breakdown */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign size={18} className="text-gray-600 dark:text-gray-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Split Breakdown</h3>
          </div>
          <div className="space-y-2">
            {participantShares.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-light dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                    <span className="text-primary dark:text-indigo-400 font-semibold">
                      {item.member?.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{item.member?.name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {item.percentage}% of total
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900 dark:text-white">
                    {expense.currency} {item.share.toFixed(2)}
                  </p>
                  {item.member?.userId === expense.paidBy && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">Paid</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Method Info (if settlement) */}
        {expense.isSettlement && expense.paymentMethod && (
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-900 dark:text-blue-300">
              <strong>Payment Method:</strong> {expense.paymentMethod === 'paypal' ? 'PayPal' : 'Manual Payment'}
            </p>
            {expense.paypalOrderId && (
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                Order ID: {expense.paypalOrderId}
              </p>
            )}
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition font-medium"
        >
          Close
        </button>
      </div>
    </div>
  );
}
