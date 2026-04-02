// src/pages/Activity.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuthStore } from '../stores/authStore';
import { ArrowLeft, Calendar, Users, TrendingUp, TrendingDown } from 'lucide-react';
import ExpenseDetailsModal from '../components/ExpenseDetailsModal';

export default function Activity() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [expenses, setExpenses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'paid', 'owe'

  // Get display title with current names for settlements
  const getDisplayTitle = (expense, group) => {
    if (!expense.isSettlement) return expense.title;
    
    const fromUserId = expense.paidBy; // Person who paid
    const toUserId = expense.participants?.find(id => id !== expense.paidBy); // Receiver
    
    const fromMember = group?.members?.find(m => m.userId === fromUserId);
    const toMember = group?.members?.find(m => m.userId === toUserId);
    
    return `Settlement: ${fromMember?.name || 'Unknown'} → ${toMember?.name || 'Unknown'}`;
  };
  // Fetch user's groups
  useEffect(() => {
    if (!user) return;

    const groupsQuery = query(
      collection(db, 'groups'),
      where('memberIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(groupsQuery, (snapshot) => {
      const groupsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setGroups(groupsData);
      // If user has no groups, stop loading immediately — expenses will never load
      if (snapshot.docs.length === 0) {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch all expenses from user's groups
  useEffect(() => {
    if (!user || groups.length === 0) return;

    const groupIds = groups.map(g => g.id);
    
    const expensesQuery = query(
      collection(db, 'expenses'),
      where('groupId', 'in', groupIds)
    );

    const unsubscribe = onSnapshot(expensesQuery, (snapshot) => {
      const expensesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Sort by date manually
      expensesData.sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return dateB - dateA;
      });

      setExpenses(expensesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, groups]);

  // Filter expenses
  const filteredExpenses = expenses.filter(expense => {
    if (filter === 'all') return true;
    if (filter === 'paid') return expense.paidBy === user.uid;
    if (filter === 'owe') return expense.participants?.includes(user.uid) && expense.paidBy !== user.uid;
    return true;
  });

  // Helper — must be defined before stats so it can be used in calculations
  const getGroupForExpense = (groupId) => groups.find(g => g.id === groupId);

  // Calculate stats grouped by currency — never sum across different currencies
  const paidByCurrency = {};
  expenses
    .filter(e => e.paidBy === user.uid)
    .forEach(e => {
      const currency = getGroupForExpense(e.groupId)?.currency || 'EUR';
      paidByCurrency[currency] = (paidByCurrency[currency] || 0) + e.amount;
    });

  const owedByCurrency = {};
  expenses
    .filter(e => e.participants?.includes(user.uid) && e.paidBy !== user.uid)
    .forEach(e => {
      const currency = getGroupForExpense(e.groupId)?.currency || 'EUR';
      const share = e.splits?.[user.uid] || 0;
      owedByCurrency[currency] = (owedByCurrency[currency] || 0) + share;
    });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      {/* Top Bar */}
      <div className="bg-white dark:bg-gray-800 shadow-card sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white md:hidden"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Activity</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 rounded-xl shadow-card dark:shadow-gray-900/50 p-4 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={20} className="text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-700 dark:text-green-300 font-medium">You Paid</p>
            </div>
            <div className="space-y-1">
              {Object.entries(paidByCurrency).length === 0 ? (
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">—</p>
              ) : (
                Object.entries(paidByCurrency).map(([currency, amount]) => (
                  <div key={currency} className="flex items-center justify-between">
                    <span className="text-2xl font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-1.5 py-0.5 rounded">
                      {currency}
                    </span>
                    <span className="text-2xl font-bold text-green-900 dark:text-green-100">
                      {amount.toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 rounded-xl shadow-card dark:shadow-gray-900/50 p-4 border border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown size={20} className="text-orange-600 dark:text-orange-400" />
              <p className="text-sm text-orange-700 dark:text-orange-300 font-medium">You Owe</p>
            </div>
            <div className="space-y-0.5">
              {Object.entries(owedByCurrency).length === 0 ? (
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">—</p>
              ) : (
                Object.entries(owedByCurrency).map(([currency, amount]) => (
                  <div key={currency} className="flex items-center justify-between">
                    <span className="text-2xl font-medium text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/40 px-1.5 py-0.5 rounded">
                      {currency}
                    </span>
                    <span className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                      {amount.toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 bg-white dark:bg-gray-800 rounded-lg p-1 shadow-card dark:shadow-gray-900/50">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-all duration-300 ${
              filter === 'all'
                ? 'bg-primary dark:bg-indigo-600 text-white shadow-card'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('paid')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-all duration-300 ${
              filter === 'paid'
                ? 'bg-green-600 dark:bg-green-500 text-white shadow-card'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            I Paid
          </button>
          <button
            onClick={() => setFilter('owe')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-all duration-300 ${
              filter === 'owe'
                ? 'bg-orange-600 dark:bg-orange-500 text-white shadow-card'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            I Owe
          </button>
        </div>

        {/* Expenses List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300">Loading activity...</p>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card dark:shadow-gray-900/50 p-12 text-center">
            <Calendar size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No activity yet
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              {filter === 'all' ? 'Start adding expenses to see activity here' :
               filter === 'paid' ? 'You haven\'t paid for any expenses yet' :
               'You don\'t owe anyone yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredExpenses.map((expense) => {
              const group = getGroupForExpense(expense.groupId);
              const expenseDate = expense.date?.toDate ? expense.date.toDate() : new Date(expense.date);
              const isPayer = expense.paidBy === user.uid;
              const yourShare = expense.splits?.[user.uid] || 0;

              return (
                <div
                  key={expense.id}
                  onClick={() => setSelectedExpense(expense)}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-card hover:shadow-card-hover dark:shadow-gray-900/50 transition-all duration-300 transform hover:-translate-y-1 cursor-pointer p-4 border border-gray-100 dark:border-gray-700"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                        {getDisplayTitle(expense, group)}
                      </h4>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <Users size={14} />
                        <span>{group?.name || 'Unknown Group'}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {expense.currency} {expense.amount.toFixed(2)}
                      </p>
                      {isPayer ? (
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">You paid</span>
                      ) : (
                        <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                          You owe {group?.currency || ''} {yourShare.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <Calendar size={12} />
                      <span>{expenseDate.toLocaleDateString()}</span>
                    </div>
                    {expense.isSettlement && (
                      <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded border border-green-200 dark:border-green-800">
                        Settlement
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Expense Details Modal */}
      <ExpenseDetailsModal
        isOpen={!!selectedExpense}
        onClose={() => setSelectedExpense(null)}
        expense={selectedExpense}
        group={selectedExpense ? getGroupForExpense(selectedExpense.groupId) : null}
      />
    </div>
  );
}
