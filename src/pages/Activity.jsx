// src/pages/Activity.jsx

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuthStore } from '../stores/authStore';
import { ArrowLeft, Calendar, Users, TrendingUp, TrendingDown, Archive } from 'lucide-react';
import ExpenseDetailsModal from '../components/ExpenseDetailsModal';

export default function Activity() {
  const navigate  = useNavigate();
  const { user }  = useAuthStore();
  const location  = useLocation();

  const [expenses,        setExpenses]        = useState([]);
  const [groups,          setGroups]          = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [selectedExpense, setSelectedExpense] = useState(null);

  // Role filter: 'all' | 'paid' | 'owe'
  const [filter, setFilter] = useState(location.state?.filter || 'all');
  // Status filter: 'active' | 'archived'
  const [statusFilter, setStatusFilter] = useState('active');

  const getDisplayTitle = (expense, group) => {
    if (!expense.isSettlement) return expense.title;
    const fromMember = group?.members?.find(m => m.userId === expense.paidBy);
    const toUserId   = expense.participants?.find(id => id !== expense.paidBy);
    const toMember   = group?.members?.find(m => m.userId === toUserId);
    return `Settlement: ${fromMember?.name || 'Unknown'} → ${toMember?.name || 'Unknown'}`;
  };

  // Fetch groups
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'groups'), where('memberIds', 'array-contains', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      setGroups(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      if (snapshot.docs.length === 0) setLoading(false);
    });
    return () => unsub();
  }, [user]);

  // Fetch expenses
  useEffect(() => {
    if (!user || groups.length === 0) return;
    const groupIds = groups.map(g => g.id);
    const q = query(collection(db, 'expenses'), where('groupId', 'in', groupIds));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => {
        const dA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const dB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return dB - dA;
      });
      setExpenses(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user, groups]);

  const getGroupForExpense = (groupId) => groups.find(g => g.id === groupId);

  // Apply status filter first then role filter
  const filteredExpenses = expenses
    .filter(e => {
      if (statusFilter === 'active')   return !e.status || e.status === 'active';
      if (statusFilter === 'archived') return e.status === 'archived';
      return true;
    })
    .filter(e => {
      if (filter === 'paid') return e.paidBy === user.uid;
      if (filter === 'owe')  return e.participants?.includes(user.uid) && e.paidBy !== user.uid;
      return true;
    });

  // Stats — exclude deleted and archived from displayed totals
  const activeExpenses = expenses.filter(e => !e.status || e.status === 'active');

  const paidByCurrency = {};
  activeExpenses
    .filter(e => e.paidBy === user.uid && !e.isSettlement)
    .forEach(e => {
      const currency = getGroupForExpense(e.groupId)?.currency || 'EUR';
      paidByCurrency[currency] = (paidByCurrency[currency] || 0) + e.amount;
    });

  const owedByCurrency = {};
  activeExpenses
    .filter(e => e.participants?.includes(user.uid) && e.paidBy !== user.uid && !e.isSettlement)
    .forEach(e => {
      const currency = getGroupForExpense(e.groupId)?.currency || 'EUR';
      const share    = e.splits?.[user.uid] || 0;
      owedByCurrency[currency] = (owedByCurrency[currency] || 0) + share;
    });

  const archivedCount = expenses.filter(e => e.status === 'archived').length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">

      {/* Top Bar */}
      <div className="bg-white dark:bg-gray-800 shadow-card sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white md:hidden"
              aria-label="Back to dashboard"
            >
              <ArrowLeft size={24} />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Activity</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Activities across groups</p>
            </div>
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

        {/* Status Filter — Active / Archived */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              statusFilter === 'active'
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setStatusFilter('archived')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
              statusFilter === 'archived'
                ? 'bg-gray-600 dark:bg-gray-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
          >
            <Archive size={11} />
            Archived
            {archivedCount > 0 && (
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-xs ${
                statusFilter === 'archived'
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}>
                {archivedCount}
              </span>
            )}
          </button>
        </div>

        {/* Role Filter Tabs */}
        <div className="flex gap-2 mb-6 bg-white dark:bg-gray-800 rounded-lg p-1 shadow-card dark:shadow-gray-900/50">
          {[
            { key: 'all',  label: 'All',    active: 'bg-primary dark:bg-indigo-600 text-white shadow-card' },
            { key: 'paid', label: 'I Paid', active: 'bg-green-600 dark:bg-green-500 text-white shadow-card' },
            { key: 'owe',  label: 'I Owe',  active: 'bg-orange-600 dark:bg-orange-500 text-white shadow-card' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-all duration-300 ${
                filter === tab.key
                  ? tab.active
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Expenses List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <p className="mt-4 text-gray-600 dark:text-gray-300">Loading activity...</p>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card dark:shadow-gray-900/50 p-12 text-center">
            {statusFilter === 'archived' ? (
              <>
                <Archive size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No archived expenses</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Archived expenses are hidden from your active list but still count toward group balances.
                </p>
              </>
            ) : (
              <>
                <Calendar size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No activity yet</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {filter === 'all'  ? 'Start adding expenses to see activity here' :
                   filter === 'paid' ? "You haven't paid for any expenses yet" :
                   "You don't owe anyone yet"}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredExpenses.map((expense) => {
              const group       = getGroupForExpense(expense.groupId);
              const expenseDate = expense.date?.toDate ? expense.date.toDate() : new Date(expense.date);
              const isPayer     = expense.paidBy === user.uid;
              const yourShare   = expense.splits?.[user.uid] || 0;
              const isArchived  = expense.status === 'archived';

              return (
                <div
                  key={expense.id}
                  onClick={() => setSelectedExpense(expense)}
                  className={`rounded-lg shadow-card hover:shadow-card-hover dark:shadow-gray-900/50 transition-all duration-300 transform hover:-translate-y-1 cursor-pointer p-4 border ${
                    isArchived
                      ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-75'
                      : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {isArchived && (
                          <Archive size={12} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        )}
                        <h4 className={`font-semibold mb-1 ${
                          isArchived
                            ? 'text-gray-500 dark:text-gray-400'
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {getDisplayTitle(expense, group)}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <Users size={14} />
                        <span>{group?.name || 'Unknown Group'}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${
                        isArchived
                          ? 'text-gray-400 dark:text-gray-500'
                          : 'text-gray-900 dark:text-white'
                      }`}>
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
                    <div className="flex items-center gap-2">
                      {expense.isSettlement && (
                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded border border-green-200 dark:border-green-800">
                          Settlement
                        </span>
                      )}
                      {isArchived && (
                        <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-1 rounded border border-gray-200 dark:border-gray-600">
                          Archived
                        </span>
                      )}
                    </div>
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
        currentUserId={user?.uid}
        groupExpenses={selectedExpense
          ? expenses.filter(e => e.groupId === selectedExpense.groupId)
          : []
        }
        onDeleted={() => setSelectedExpense(null)}
        onStatusChanged={() => setSelectedExpense(null)}
      />
    </div>
  );
}
