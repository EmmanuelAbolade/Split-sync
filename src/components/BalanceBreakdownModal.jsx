// src/components/BalanceBreakdownModal.jsx
// Displays a breakdown of who owes the user money or who the user owes,
// grouped by person and group. Supports multi-currency display.

import { X, Users, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Renders one line per currency — e.g. "GBP 258.33" then "EUR 18.33"
function CurrencyLines({ amountsByCurrency, colorClass, emptyText = '—' }) {
  const entries = Object.entries(amountsByCurrency || {});
  if (entries.length === 0) {
    return <span className={`font-bold ${colorClass}`}>{emptyText}</span>;
  }
  return (
    <div className="space-y-0.5">
      {entries.map(([currency, amount]) => (
        <p key={currency} className={`font-bold ${colorClass}`}>
          {currency} {amount.toFixed(2)}
        </p>
      ))}
    </div>
  );
}

export default function BalanceBreakdownModal({
  isOpen,
  onClose,
  type,              // 'owed' or 'owing'
  breakdowns,        // array of { userId, name, photoURL, amountsByCurrency, groups }
  amountsByCurrency, // { GBP: X, EUR: Y } — total per currency for the header
}) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const isOwed = type === 'owed';
  const title  = isOwed ? 'Owed to You' : 'You Owe';
  const Icon   = isOwed ? TrendingUp : TrendingDown;

  const colorClass = isOwed
    ? 'text-green-600 dark:text-green-400'
    : 'text-orange-600 dark:text-orange-400';

  const headerBg = isOwed
    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800';

  const iconBg = isOwed
    ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
    : 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400';

  const handleGroupClick = (groupId) => {
    onClose();
    navigate(`/group/${groupId}`);
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
        <div className={`p-6 border-b border-gray-200 dark:border-gray-700 ${headerBg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconBg}`}>
                <Icon size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                  {title}
                </h2>
                {/* Multi-currency total */}
                <CurrencyLines
                  amountsByCurrency={amountsByCurrency}
                  colorClass={`text-2xl ${colorClass}`}
                  emptyText="All settled"
                />
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

        {/* Content — scrollable */}
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
                  {/* Person row */}
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
                      {/* Per-person multi-currency total */}
                      <CurrencyLines
                        amountsByCurrency={breakdown.amountsByCurrency}
                        colorClass={`text-base ${colorClass}`}
                      />
                    </div>
                  </div>

                  {/* Groups list — clickable to navigate */}
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
                            <span className={`font-medium ${colorClass}`}>
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