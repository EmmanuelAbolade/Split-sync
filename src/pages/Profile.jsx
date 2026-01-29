// src/pages/Profile.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuthStore } from '../stores/authStore';
import { 
  User, Mail, Calendar, LogOut, Settings, 
  TrendingUp, TrendingDown, Users, Wallet 
} from 'lucide-react';
import { calculateBalances } from '../utils/balanceCalculator';

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  
  const [groups, setGroups] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch user's groups and expenses
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
      setExpenses(expensesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, groups]);

  // Calculate overall balance across all groups
  const calculateOverallBalance = () => {
    let totalOwed = 0; // Money owed to you
    let totalOwing = 0; // Money you owe

    groups.forEach(group => {
      const groupExpenses = expenses.filter(e => e.groupId === group.id);
      const balances = calculateBalances(groupExpenses, group.members || []);
      const userBalance = balances[user.uid] || 0;

      if (userBalance > 0) {
        totalOwed += userBalance;
      } else if (userBalance < 0) {
        totalOwing += Math.abs(userBalance);
      }
    });

    return { totalOwed, totalOwing };
  };

  const { totalOwed, totalOwing } = calculateOverallBalance();
  const netBalance = totalOwed - totalOwing;

  const totalPaid = expenses
    .filter(e => e.paidBy === user.uid)
    .reduce((sum, e) => sum + e.amount, 0);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const joinDate = user?.metadata?.creationTime 
    ? new Date(user.metadata.creationTime).toLocaleDateString('en-IE', {
        month: 'long',
        year: 'numeric'
      })
    : 'Unknown';

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-primary-dark text-white shadow-card-3d">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 bg-white bg-opacity-20 backdrop-blur-sm rounded-full flex items-center justify-center mb-4 shadow-card-hover">
              <span className="text-5xl font-bold text-white">
                {user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <h1 className="text-2xl font-bold mb-1">
              {user?.displayName || 'User'}
            </h1>
            <p className="text-white text-opacity-90 text-sm">
              {user?.email}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Balance Overview */}
        <div className="bg-white rounded-xl shadow-card hover:shadow-card-hover transition-all duration-300 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Wallet size={20} className="text-primary" />
            Overall Balance
          </h2>
          
          <div className={`text-center p-6 rounded-xl mb-4 ${
            netBalance > 0 
              ? 'bg-gradient-to-br from-green-50 to-emerald-100' 
              : netBalance < 0 
              ? 'bg-gradient-to-br from-orange-50 to-amber-100'
              : 'bg-gradient-to-br from-gray-50 to-gray-100'
          }`}>
            <p className="text-sm text-gray-600 mb-2">Net Balance</p>
            <p className={`text-4xl font-bold ${
              netBalance > 0 ? 'text-green-600' :
              netBalance < 0 ? 'text-orange-600' :
              'text-gray-600'
            }`}>
              €{Math.abs(netBalance).toFixed(2)}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              {netBalance > 0 ? 'You are owed' :
               netBalance < 0 ? 'You owe' :
               'All settled up!'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={16} className="text-green-600" />
                <p className="text-xs text-green-700 font-medium">Owed to You</p>
              </div>
              <p className="text-xl font-bold text-green-900">
                €{totalOwed.toFixed(2)}
              </p>
            </div>

            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown size={16} className="text-orange-600" />
                <p className="text-xs text-orange-700 font-medium">You Owe</p>
              </div>
              <p className="text-xl font-bold text-orange-900">
                €{totalOwing.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users size={20} className="text-blue-600" />
              <p className="text-sm text-gray-600">Groups</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{groups.length}</p>
          </div>

          <div className="bg-white rounded-xl shadow-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet size={20} className="text-green-600" />
              <p className="text-sm text-gray-600">Total Paid</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">€{totalPaid.toFixed(2)}</p>
          </div>
        </div>

        {/* Account Info */}
        <div className="bg-white rounded-xl shadow-card hover:shadow-card-hover transition-all duration-300 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <User size={20} className="text-gray-400 mt-1" />
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-medium text-gray-900">{user?.displayName || 'Not set'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail size={20} className="text-gray-400 mt-1" />
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium text-gray-900">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar size={20} className="text-gray-400 mt-1" />
              <div>
                <p className="text-sm text-gray-600">Member Since</p>
                <p className="font-medium text-gray-900">{joinDate}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-gray-700 rounded-xl shadow-card hover:shadow-card-hover transition-all duration-300 transform hover:-translate-y-0.5 p-4"
          >
            <LogOut size={20} />
            <span className="font-medium">Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
