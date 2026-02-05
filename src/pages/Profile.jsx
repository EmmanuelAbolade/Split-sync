// src/pages/Profile.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuthStore } from '../stores/authStore';
import { 
  User, Mail, Calendar, LogOut,
  TrendingUp, TrendingDown, Users, Wallet, CreditCard, Save, Info, ChevronDown 
} from 'lucide-react';
import { calculateBalances } from '../utils/balanceCalculator';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import CloudinaryUpload from '../components/CloudinaryUpload';

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [userData, setUserData] = useState(null);
  const [groups, setGroups] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [, setLoading] = useState(true);

  // Payment settings state
  const [paymentMethods, setPaymentMethods] = useState({
    paypalUsername: '',
    revolutUsername: '',
    iban: '',
    bic: ''
  });
  const [editingPayment, setEditingPayment] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [showPaymentSettings, setShowPaymentSettings] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);

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

  // fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData(data);
          
          // Load payment methods if they exist
          if (data.paymentMethods) {
            setPaymentMethods(data.paymentMethods);
          }
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
      }
    };
    
    fetchUserData();
  }, [user]);

  const handlePhotoUpdated = (photoURL) => {
    setUserData(prev => ({ ...prev, photoURL }));
  };

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

  const handleSavePaymentMethods = async () => {
    setPaymentError('');
    setPaymentSuccess(false);
    setSavingPayment(true);

    try {
      // Validate IBAN if provided
      if (paymentMethods.iban && paymentMethods.iban.trim()) {
        const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/;
        if (!ibanRegex.test(paymentMethods.iban.replace(/\s/g, ''))) {
          setPaymentError('Invalid IBAN format. Example: IE29 AIBK 9311 5212 3456 78');
          setSavingPayment(false);
          return;
        }
      }

      // Validate PayPal username (alphanumeric and underscore only)
      if (paymentMethods.paypalUsername && paymentMethods.paypalUsername.trim()) {
        const paypalRegex = /^[a-zA-Z0-9_]+$/;
        if (!paypalRegex.test(paymentMethods.paypalUsername)) {
          setPaymentError('PayPal username can only contain letters, numbers, and underscores');
          setSavingPayment(false);
          return;
        }
      }

      // Clean up data (remove empty strings)
      const cleanedPaymentMethods = {};
      Object.keys(paymentMethods).forEach(key => {
        const value = paymentMethods[key]?.trim();
        if (value) {
          cleanedPaymentMethods[key] = value;
        }
      });

      // Save to Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        paymentMethods: cleanedPaymentMethods,
        updatedAt: new Date(),
      });

      setPaymentSuccess(true);
      setEditingPayment(false);
      
      // Hide success message after 3 seconds
      setTimeout(() => setPaymentSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving payment methods:', err);
      setPaymentError('Failed to save payment methods. Please try again.');
    } finally {
      setSavingPayment(false);
    }
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
            <CloudinaryUpload
              user={user}
              currentPhotoURL={userData?.photoURL}
              onPhotoUpdated={handlePhotoUpdated}
            />
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

        {/* Payment Settings */}
        <div className="bg-white rounded-xl shadow-card hover:shadow-card-hover transition-all duration-300 p-6 mb-6">
          {/* Collapsible Header */}
          <div 
            className="flex items-center justify-between cursor-pointer select-none"
            onClick={() => setShowPaymentSettings(!showPaymentSettings)}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center">
                <CreditCard size={20} className="text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Payment Settings</h2>
                <p className="text-xs text-gray-500">
                  {showPaymentSettings ? 'Click to hide' : 'Click to show'}
                </p>
              </div>
            </div>
            <ChevronDown 
              size={24} 
              className={`text-gray-400 transition-transform duration-300 ${
                showPaymentSettings ? 'rotate-180' : ''
              }`}
            />
          </div>

          {/* Collapsible Content */}
          {showPaymentSettings && (
            <div className="mt-4 animate-scale-in">
              {/* Edit button */}
              {!editingPayment && (
                <div className="flex justify-end mb-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPayment(true);
                    }}
                    className="px-4 py-2 text-primary border border-primary rounded-lg hover:bg-primary-light transition"
                  >
                    Edit Payment Methods
                  </button>
                </div>
              )}

              {/* Info banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-800">
                    <p className="font-medium mb-1">Set up your payment methods to receive money easily</p>
                    <p>Your payment info is only visible to you and members of your groups.</p>
                  </div>
                </div>
              </div>

              {/* Success/Error Messages */}
              {paymentSuccess && (
                <div className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm">
                  Payment settings saved successfully!
                </div>
              )}

              {paymentError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
                  {paymentError}
                </div>
              )}

              {/* Payment Method Inputs */}
              <div className="space-y-4">
                {/* PayPal Username */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PayPal.me Username
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-400">paypal.me/</span>
                    <input
                      type="text"
                      value={paymentMethods.paypalUsername}
                      onChange={(e) => setPaymentMethods(prev => ({
                        ...prev, 
                        paypalUsername: e.target.value
                      }))}
                      disabled={!editingPayment}
                      placeholder="username"
                      className="w-full pl-24 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Your PayPal.me link (e.g., "alice" for paypal.me/alice)
                  </p>
                </div>

                {/* Revolut Username */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Revolut Username
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-400">@</span>
                    <input
                      type="text"
                      value={paymentMethods.revolutUsername}
                      onChange={(e) => setPaymentMethods(prev => ({
                        ...prev, 
                        revolutUsername: e.target.value
                      }))}
                      disabled={!editingPayment}
                      placeholder="username"
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Your Revolut @username (e.g., "@alice")
                  </p>
                </div>

                {/* IBAN */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    IBAN (Bank Transfer)
                  </label>
                  <input
                    type="text"
                    value={paymentMethods.iban}
                    onChange={(e) => setPaymentMethods(prev => ({
                      ...prev, 
                      iban: e.target.value.toUpperCase()
                    }))}
                    disabled={!editingPayment}
                    placeholder="IE29 AIBK 9311 5212 3456 78"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-500 font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Your bank account IBAN for SEPA transfers
                  </p>
                </div>

                {/* BIC (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    BIC/SWIFT Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={paymentMethods.bic}
                    onChange={(e) => setPaymentMethods(prev => ({
                      ...prev, 
                      bic: e.target.value.toUpperCase()
                    }))}
                    disabled={!editingPayment}
                    placeholder="AIBKIE2D"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-500 font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Your bank's BIC/SWIFT code (usually not required for SEPA)
                  </p>
                </div>
              </div>

              {/* Save/Cancel Buttons */}
              {editingPayment && (
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPayment(false);
                      setPaymentError('');
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSavePaymentMethods();
                    }}
                    disabled={savingPayment}
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                  >
                    <Save size={16} />
                    {savingPayment ? 'Saving...' : 'Save Payment Settings'}
                  </button>
                </div>
              )}
            </div>
          )}
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
