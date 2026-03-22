// src/components/BalanceBreakdownModal.jsx
import { X, Users, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function BalanceBreakdownModal({ 
  isOpen, 
  onClose, 
  type, // 'owed' or 'owing'
  breakdowns,
  totalAmount,
  currency 
}) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const isOwed = type === 'owed';
  const title = isOwed ? 'Owed to You' : 'You Owe';
  const Icon = isOwed ? TrendingUp : TrendingDown;
  const colorClasses = isOwed 
    ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800'
    : 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800';

  const handleGroupClick = (groupId) => {
    onClose(); // Close modal first
    navigate(`/group/${groupId}`); // Navigate to group
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-6 border-b border-gray-200 dark:border-gray-700 ${colorClasses.split('text-')[0]}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colorClasses}`}>
                <Icon size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {title}
                </h2>
                <p className={`text-2xl font-bold ${colorClasses.split('bg-')[0]}`}>
                  {totalAmount > 0 ? `${currency || ''} ${totalAmount.toFixed(2)}`.trim() : '—'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {breakdowns.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                {isOwed ? 'Nobody owes you money' : "You don't owe anyone"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {breakdowns.map((breakdown, index) => (
                <div 
                  key={index}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition"
                >
                  {/* Person */}
                  <div className="flex items-center gap-3 mb-3">
                    {breakdown.photoURL ? (
                      <img 
                        src={breakdown.photoURL} 
                        alt={breakdown.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary-dark dark:from-indigo-900 dark:to-blue-900 flex items-center justify-center">
                        <Users size={20} className="text-white" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {isOwed ? `${breakdown.name} owes you` : `You owe ${breakdown.name}`}
                      </p>
                      <p className={`text-lg font-bold ${colorClasses.split('bg-')[0]}`}>
                        {currency || ''} {breakdown.amount.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Groups - CLICKABLE! */}
                  {breakdown.groups.length > 0 && (
                    <div className="ml-13 space-y-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">
                        Click a group to settle up:
                      </p>
                      {breakdown.groups.map((group, gIndex) => (
                        <button
                          key={gIndex}
                          onClick={() => handleGroupClick(group.groupId)}
                          className="w-full flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded px-3 py-2 transition-all duration-200 group cursor-pointer"
                        >
                          <span className="text-gray-700 dark:text-gray-300 group-hover:text-primary dark:group-hover:text-indigo-400 transition">
                            {group.groupName}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${colorClasses.split('bg-')[0]}`}>
                              {group.currency ? `${group.currency} ` : ''}{group.amount.toFixed(2)}
                            </span>
                            <ChevronRight size={16} className="text-gray-400 dark:text-gray-500 group-hover:text-primary dark:group-hover:text-indigo-400 transition" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}