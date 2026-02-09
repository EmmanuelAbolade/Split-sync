// src/pages/Profile.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuthStore } from '../stores/authStore';
import { 
  User, Mail, Calendar, LogOut,
  TrendingUp, TrendingDown, Users, Wallet, CreditCard, Save, Info, ChevronDown, Shield, Fingerprint, Lock 
} from 'lucide-react';
import { calculateBalances } from '../utils/balanceCalculator';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import CloudinaryUpload from '../components/CloudinaryUpload';
import { 
  encryptData, 
  decryptData, 
  validateIBAN
} from '../utils/encryption';
import { 
  authenticateWithBiometric,
  isBiometricAvailable,
  isBiometricEnabledOnDevice,
  enableBiometric,
  disableBiometric
} from '../utils/biometric';

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


  // Biometric state
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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

  // Check biometric availability on mount
  useEffect(() => {
    if (user) {
      setBiometricAvailable(isBiometricAvailable());
      setBiometricEnabled(isBiometricEnabledOnDevice(user.uid));  
    }
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
            const methods = data.paymentMethods;
            
            // Decrypt IBAN if it exists and is encrypted
            if (methods.encryptedIBAN) {
              try {
                const decryptedIBAN = decryptData(methods.encryptedIBAN);
                setPaymentMethods({
                  paypalUsername: methods.paypalUsername || '',
                  revolutUsername: methods.revolutUsername || '',
                  iban: decryptedIBAN,
                  bic: methods.bic || ''
                });
              } catch (error) {
                console.error('Error decrypting IBAN:', error);
                setPaymentMethods({
                  paypalUsername: methods.paypalUsername || '',
                  revolutUsername: methods.revolutUsername || '',
                  iban: '',
                  bic: methods.bic || ''
                });
              }
            } else {
              // Legacy: IBAN stored unencrypted
              setPaymentMethods(methods);
            }
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
      if (paymentMethods.iban && paymentMethods.iban.trim()) {
        if (!validateIBAN(paymentMethods.iban)) {
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

      // Prepare data to save (to encrypt IBAN and avoid saving raw sensitive data)
      const cleanedPaymentMethods = {};

      // Add non-sensitive data
      if (paymentMethods.paypalUsername?.trim()) {
        cleanedPaymentMethods.paypalUsername = paymentMethods.paypalUsername.trim();
      }
      if (paymentMethods.revolutUsername?.trim()) {
        cleanedPaymentMethods.revolutUsername = paymentMethods.revolutUsername.trim();
      }
      if (paymentMethods.bic?.trim()) {
        cleanedPaymentMethods.bic = paymentMethods.bic.trim().toUpperCase();
      }

      // Encrypt IBAN before saving
      if (paymentMethods.iban?.trim()) {
        const cleanIBAN = paymentMethods.iban.replace(/\s/g, '').toUpperCase();
        const encryptedIBAN = encryptData(cleanIBAN);
        cleanedPaymentMethods.encryptedIBAN = encryptedIBAN;
      }

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


  // Handle showing payment settings with biometric check
  const handleShowPaymentSettings = async () => {
    if (!user) return;

    // If already open, just toggle closed
    if (showPaymentSettings) {
      setShowPaymentSettings(false);
      setIsAuthenticated(false);
      return;
    }

    // Check if biometric is enabled
    if (biometricEnabled) {
      const authenticated = await authenticateWithBiometric(
        user.uid, 
        'Authenticate to view payment settings'
      );
      
      if (!authenticated) {
        alert('Authentication failed. Cannot access payment settings.');
        return;
      }
      
      setIsAuthenticated(true);
    }

    setShowPaymentSettings(true);
  };

  // Handle editing payment with biometric check
  const handleEditPayment = async () => {
    if (!user) return;

    // Check if biometric is enabled
    if (biometricEnabled && !isAuthenticated) {
      const authenticated = await authenticateWithBiometric(
        user.uid, 
        'Authenticate to edit payment settings'
      );
      
      if (!authenticated) {
        alert('Authentication failed. Cannot edit payment settings.');
        return;
      }
      
      setIsAuthenticated(true);
    }

    setEditingPayment(true);
  };


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-primary-dark dark:from-indigo-900 dark:to-blue-900 text-white shadow-card-3d">
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
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card hover:shadow-card-hover dark:shadow-gray-900/50 transition-all duration-300 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Wallet size={20} className="text-primary dark:text-indigo-400" />
            Overall Balance
          </h2>
          
          <div className={`text-center p-6 rounded-xl mb-4 border ${
            netBalance > 0 
              ? 'bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 border-green-200 dark:border-green-800' 
              : netBalance < 0 
              ? 'bg-gradient-to-br from-orange-50 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 border-orange-200 dark:border-orange-800'
              : 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 border-gray-200 dark:border-gray-600'
          }`}>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Net Balance</p>
            <p className={`text-4xl font-bold ${
              netBalance > 0 ? 'text-green-600 dark:text-green-400' :
              netBalance < 0 ? 'text-orange-600 dark:text-orange-400' :
              'text-gray-600 dark:text-gray-300'
            }`}>
              €{Math.abs(netBalance).toFixed(2)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
              {netBalance > 0 ? 'You are owed' :
               netBalance < 0 ? 'You owe' :
               'All settled up!'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={16} className="text-green-600 dark:text-green-400" />
                <p className="text-xs text-green-700 dark:text-green-300 font-medium">Owed to You</p>
              </div>
              <p className="text-xl font-bold text-green-900 dark:text-green-100">
                €{totalOwed.toFixed(2)}
              </p>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown size={16} className="text-orange-600 dark:text-orange-400" />
                <p className="text-xs text-orange-700 dark:text-orange-300 font-medium">You Owe</p>
              </div>
              <p className="text-xl font-bold text-orange-900 dark:text-orange-100">
                €{totalOwing.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card dark:shadow-gray-900/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users size={20} className="text-blue-600 dark:text-blue-400" />
              <p className="text-sm text-gray-600 dark:text-gray-300">Groups</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{groups.length}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card dark:shadow-gray-900/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet size={20} className="text-green-600 dark:text-green-400" />
              <p className="text-sm text-gray-600 dark:text-gray-300">Total Paid</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">€{totalPaid.toFixed(2)}</p>
          </div>
        </div>

        {/* Account Info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card hover:shadow-card-hover dark:shadow-gray-900/50 transition-all duration-300 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account Information</h2>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <User size={20} className="text-gray-400 dark:text-gray-500 mt-1" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Name</p>
                <p className="font-medium text-gray-900 dark:text-white">{user?.displayName || 'Not set'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail size={20} className="text-gray-400 dark:text-gray-500 mt-1" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                <p className="font-medium text-gray-900 dark:text-white">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar size={20} className="text-gray-400 dark:text-gray-500 mt-1" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Member Since</p>
                <p className="font-medium text-gray-900 dark:text-white">{joinDate}</p>
              </div>
            </div>
          </div>
        </div>


        {/* Payment Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card hover:shadow-card-hover dark:shadow-gray-900/50 transition-all duration-300 p-6 mb-6">
          {/* Collapsible Header */}
          <div 
            className="flex items-center justify-between cursor-pointer select-none"
            onClick={handleShowPaymentSettings}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-light dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                <CreditCard size={20} className="text-primary dark:text-indigo-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Payment Settings</h2>
                  {biometricEnabled && (
                    <Lock size={16} className="text-indigo-600 dark:text-indigo-400" />
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {showPaymentSettings ? 'Click to hide' : 'Click to show'}
                  {biometricEnabled && !showPaymentSettings && ' (requires authentication)'}
                </p>
              </div>
            </div>
            <ChevronDown 
              size={24} 
              className={`text-gray-400 dark:text-gray-500 transition-transform duration-300 ${
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
                      handleEditPayment();
                    }}
                    className="px-4 py-2 text-primary dark:text-indigo-400 border border-primary dark:border-indigo-600 rounded-lg hover:bg-primary-light dark:hover:bg-indigo-900/30 transition"
                  >
                    Edit Payment Methods
                  </button>
                </div>
              )}

              {/* Info banner */}
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <Info size={16} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-800 dark:text-blue-200">
                    <p className="font-medium mb-1">Set up your payment methods to receive money easily</p>
                    <p>Your IBAN is encrypted and secure. Payment info is only visible to you and members of your groups.</p>
                  </div>
                </div>
              </div>

              {/* Success/Error Messages */}
              {paymentSuccess && (
                <div className="bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-300 p-3 rounded-lg mb-4 text-sm flex items-center gap-2 border border-green-200 dark:border-green-800">
                  <Shield size={16} />
                  Payment settings saved successfully! IBAN encrypted.
                </div>
              )}

              {paymentError && (
                <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-3 rounded-lg mb-4 text-sm border border-red-200 dark:border-red-800">
                  {paymentError}
                </div>
              )}

              {/* Payment Method Inputs */}
              <div className="space-y-4">
                {/* PayPal Username */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    PayPal.me Username
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-400 dark:text-gray-500">paypal.me/</span>
                    <input
                      type="text"
                      value={paymentMethods.paypalUsername}
                      onChange={(e) => setPaymentMethods(prev => ({
                        ...prev, 
                        paypalUsername: e.target.value
                      }))}
                      disabled={!editingPayment}
                      placeholder="username"
                      className="w-full pl-24 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500 focus:border-transparent outline-none disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400"
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Your PayPal.me link (e.g., "alice" for paypal.me/alice)
                  </p>
                </div>

                {/* Revolut Username */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Revolut Username
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-400 dark:text-gray-500">@</span>
                    <input
                      type="text"
                      value={paymentMethods.revolutUsername}
                      onChange={(e) => setPaymentMethods(prev => ({
                        ...prev, 
                        revolutUsername: e.target.value
                      }))}
                      disabled={!editingPayment}
                      placeholder="username"
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500 focus:border-transparent outline-none disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400"
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Your Revolut @username (e.g., "@alice")
                  </p>
                </div>

                {/* IBAN */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                    IBAN (Bank Transfer)
                    <Shield size={14} className="text-indigo-600 dark:text-indigo-400" title="Encrypted" />
                  </label>
                  <input
                    type="text"
                    value={paymentMethods.iban}
                    onChange={(e) => setPaymentMethods(prev => ({
                      ...prev, 
                      iban: e.target.value.toUpperCase()
                    }))}
                    disabled={!editingPayment}
                    placeholder="IE29AIBK12345678901234"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500 focus:border-transparent outline-none disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Your bank account IBAN for SEPA transfers
                  </p>
                </div>

                {/* BIC (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500 focus:border-transparent outline-none disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSavePaymentMethods();
                    }}
                    disabled={savingPayment}
                    className="flex-1 px-4 py-2 bg-primary dark:bg-indigo-600 text-white rounded-lg hover:bg-primary-hover dark:hover:bg-indigo-700 transition disabled:opacity-50 font-medium flex items-center justify-center gap-2"
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
            className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl shadow-card hover:shadow-card-hover dark:shadow-gray-900/50 transition-all duration-300 transform hover:-translate-y-0.5 p-4"
          >
            <LogOut size={20} />
            <span className="font-medium">Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
