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

  // Calculate stats
  const totalPaid = expenses
    .filter(e => e.paidBy === user.uid)
    .reduce((sum, e) => sum + e.amount, 0);

  const totalOwed = expenses
    .filter(e => e.participants?.includes(user.uid) && e.paidBy !== user.uid)
    .reduce((sum, e) => sum + (e.splits?.[user.uid] || 0), 0);

  const getGroupForExpense = (groupId) => {
    return groups.find(g => g.id === groupId);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Top Bar */}
      <div className="bg-white shadow-card sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-600 hover:text-gray-900 md:hidden"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Activity</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl shadow-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={20} className="text-green-600" />
              <p className="text-sm text-green-700 font-medium">You Paid</p>
            </div>
            <p className="text-2xl font-bold text-green-900">
              €{totalPaid.toFixed(2)}
            </p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-amber-100 rounded-xl shadow-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown size={20} className="text-orange-600" />
              <p className="text-sm text-orange-700 font-medium">You Owe</p>
            </div>
            <p className="text-2xl font-bold text-orange-900">
              €{totalOwed.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 bg-white rounded-lg p-1 shadow-card">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-all duration-300 ${
              filter === 'all'
                ? 'bg-primary text-white shadow-card'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('paid')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-all duration-300 ${
              filter === 'paid'
                ? 'bg-green-600 text-white shadow-card'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            I Paid
          </button>
          <button
            onClick={() => setFilter('owe')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-all duration-300 ${
              filter === 'owe'
                ? 'bg-orange-600 text-white shadow-card'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            I Owe
          </button>
        </div>

        {/* Expenses List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading activity...</p>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="bg-white rounded-xl shadow-card p-12 text-center">
            <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No activity yet
            </h3>
            <p className="text-gray-600">
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
                  className="bg-white rounded-lg shadow-card hover:shadow-card-hover transition-all duration-300 transform hover:-translate-y-1 cursor-pointer p-4 border border-gray-100"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">
                        {expense.title}
                      </h4>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Users size={14} />
                        <span>{group?.name || 'Unknown Group'}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        {expense.currency} {expense.amount.toFixed(2)}
                      </p>
                      {isPayer ? (
                        <span className="text-xs text-green-600 font-medium">You paid</span>
                      ) : (
                        <span className="text-xs text-orange-600 font-medium">
                          You owe €{yourShare.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar size={12} />
                      <span>{expenseDate.toLocaleDateString()}</span>
                    </div>
                    {expense.isSettlement && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
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
