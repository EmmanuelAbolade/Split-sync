// src/pages/Profile.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuthStore } from '../stores/authStore';
import { 
  User, Mail, Calendar, LogOut,
  TrendingUp, TrendingDown, Users, Wallet, CreditCard, Save, Info, ChevronDown, Shield, Lock, ArrowLeft 
} from 'lucide-react';
import { calculateBalances,  calculateSettlements  } from '../utils/balanceCalculator';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
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
} from '../utils/biometric';
import BalanceBreakdownModal from '../components/BalanceBreakdownModal';

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [userData, setUserData] = useState(null);
  const updateUserPhoto = useAuthStore((state) => state.updateUserPhoto);
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

  // Phone number state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [phoneSuccess, setPhoneSuccess] = useState('');

  // Collapsible section states
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const [showContactDisc, setShowContactDisc] = useState(false);

  // Biometric state
  const [, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  // Balance breakdown modal state
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [breakdownType, setBreakdownType] = useState('owed');
  const [breakdownData, setBreakdownData] = useState([]);

  // Fetch user's groups and expenses
  useEffect(() => {
    if (!user) return;
    const groupsQuery = query(
      collection(db, 'groups'),
      where('memberIds', 'array-contains', user.uid)
    );
    const unsubscribe = onSnapshot(groupsQuery, (snapshot) => {
      const groupsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGroups(groupsData);
    });
    return () => unsubscribe();
  }, [user]);

  // Load user data including phone number
  useEffect(() => {
    const loadUserData = async () => {
      if (!user?.uid) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData(data);
          setPhoneNumber(data.phoneNumber || '');
        }
      } catch (err) {
        console.error('Error loading user data:', err);
      }
    };
    loadUserData();
  }, [user?.uid]);

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
      const expensesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExpenses(expensesData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, groups]);

  // Fetch user data including payment methods
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData(data);
          if (data.paymentMethods) {
            const methods = data.paymentMethods;
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

  // Save phone number with hash
  const handleSavePhone = async () => {
    if (!phoneNumber.trim()) {
      setPhoneError('Phone number cannot be empty');
      return;
    }
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
      setPhoneError('Please enter a valid phone number (e.g., +353871234567)');
      return;
    }
    setPhoneError('');
    setPhoneSuccess('');
    try {
      const cleanPhone = phoneNumber.replace(/\s/g, '');
      const encoder = new TextEncoder();
      const data = encoder.encode(cleanPhone);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const phoneHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      await updateDoc(doc(db, 'users', user.uid), {
        phoneNumber: cleanPhone,
        phoneHash: phoneHash,
        updatedAt: new Date(),
      });
      setPhoneSuccess('Phone number saved! Friends can now find you via contacts.');
      setEditingPhone(false);
      setTimeout(() => setPhoneSuccess(''), 4000);
    } catch (err) {
      console.error('Error saving phone:', err);
      setPhoneError('Failed to save phone number. Please try again.');
    }
  };

  // Update local state when photo is updated
  const handlePhotoUpdated = async (photoURL) => {
    console.log('Photo updated callback received:', photoURL);
    setUserData(prev => ({ ...prev, photoURL }));
    updateUserPhoto(photoURL);
    setTimeout(async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      } catch (err) {
        console.error('Error refreshing user data:', err);
      }
    }, 500);
  };

  // Calculate overall balance across all groups, grouped by currency.
  // Never sums amounts across different currencies.
  const calculateOverallBalance = () => {
    const owedByCurrency  = {}; // { GBP: X, EUR: Y } — others owe the user
    const owingByCurrency = {}; // { GBP: Z }          — user owes others

    groups.forEach(group => {
      const currency     = group.currency || 'EUR';
      const groupExpenses = expenses.filter(e => e.groupId === group.id);
      const balances      = calculateBalances(groupExpenses, group.members || []);
      const userBalance   = balances[user.uid] || 0;

      if (userBalance > 0.01) {
        owedByCurrency[currency] = (owedByCurrency[currency] || 0) + userBalance;
      } else if (userBalance < -0.01) {
        owingByCurrency[currency] = (owingByCurrency[currency] || 0) + Math.abs(userBalance);
      }
    });

    return { owedByCurrency, owingByCurrency };
  };

  // Calculate detailed breakdown of who owes what.
  // Uses calculateSettlements so per-person amounts match exactly what the
  // user owes or is owed — not the other person's raw group balance.
  const calculateDetailedBreakdown = (type) => {
    const breakdowns = [];

    groups.forEach(group => {
      const groupExpenses = expenses.filter(e => e.groupId === group.id);
      const balances = calculateBalances(groupExpenses, group.members || []);
      const settlements = calculateSettlements(balances);

      // For 'owing': find settlements where the current user is the payer
      // For 'owed': find settlements where the current user is the payee
      const relevant = type === 'owing'
        ? settlements.filter(s => s.from === user.uid)
        : settlements.filter(s => s.to === user.uid);

      relevant.forEach(settlement => {
        const otherUserId = type === 'owing' ? settlement.to : settlement.from;
        const member = group.members.find(m => m.userId === otherUserId);
        if (!member) return;

        let personEntry = breakdowns.find(b => b.userId === otherUserId);
        if (!personEntry) {
          personEntry = {
            userId: otherUserId,
            name: member.name || 'Unknown',
            email: member.email || '',
            photoURL: member.photoURL || null,
            amountsByCurrency: {}, // { GBP: X, EUR: Y } — replaces single amount
            groups: [],
          };
          breakdowns.push(personEntry);
        }

        // Accumulate per currency — never sum across currencies
        const currency = group.currency || 'EUR';
        personEntry.amountsByCurrency[currency] =
          (personEntry.amountsByCurrency[currency] || 0) + settlement.amount;
        personEntry.groups.push({
          groupId: group.id,
          groupName: group.name,
          amount: settlement.amount,
          currency: group.currency,
        });
      });
    });

    // Sort by total amount across all currencies for display order
    breakdowns.sort((a, b) => {
      const sumA = Object.values(a.amountsByCurrency).reduce((s, v) => s + v, 0);
      const sumB = Object.values(b.amountsByCurrency).reduce((s, v) => s + v, 0);
      return sumB - sumA;
    });
    return breakdowns;
  };

  // Save payment methods
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
      if (paymentMethods.paypalUsername && paymentMethods.paypalUsername.trim()) {
        const paypalRegex = /^[a-zA-Z0-9_.]{1,20}$/;
        if (!paypalRegex.test(paymentMethods.paypalUsername.trim())) {
          setPaymentError('PayPal username must be 1–20 characters: letters, numbers, underscores, or dots only');
          setSavingPayment(false);
          return;
        }
      }

      if (paymentMethods.revolutUsername && paymentMethods.revolutUsername.trim()) {
        const revolutRegex = /^[a-zA-Z0-9._]{1,30}$/;
        if (!revolutRegex.test(paymentMethods.revolutUsername.trim())) {
          setPaymentError('Revolut username must be 1–30 characters: letters, numbers, dots, or underscores only');
          setSavingPayment(false);
          return;
        }
      }

      if (paymentMethods.bic && paymentMethods.bic.trim()) {
        const bicRegex = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
        if (!bicRegex.test(paymentMethods.bic.trim().toUpperCase())) {
          setPaymentError('Invalid BIC/SWIFT code. Must be 8 or 11 characters (e.g. AIBKIE2D)');
          setSavingPayment(false);
          return;
        }
      }
      const cleanedPaymentMethods = {};
      if (paymentMethods.paypalUsername?.trim())
        cleanedPaymentMethods.paypalUsername = paymentMethods.paypalUsername.trim();
      if (paymentMethods.revolutUsername?.trim())
        cleanedPaymentMethods.revolutUsername = paymentMethods.revolutUsername.trim();
      if (paymentMethods.bic?.trim())
        cleanedPaymentMethods.bic = paymentMethods.bic.trim().toUpperCase();
      if (paymentMethods.iban?.trim()) {
        const cleanIBAN = paymentMethods.iban.replace(/\s/g, '').toUpperCase();
        cleanedPaymentMethods.encryptedIBAN = encryptData(cleanIBAN);
      }
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, {
          userId: user.uid,
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
          photoURL: user.photoURL || null,
          createdAt: new Date(),
          paymentMethods: cleanedPaymentMethods,
          updatedAt: new Date(),
          defaultCurrency: 'EUR',
          allowContactSync: false,
          biometricEnabled: false,
          notificationPreferences: { email: true, push: true, invitations: true, payments: true, expenses: true },
          onboardingCompleted: false,
          isActive: true
        });
      } else {
        await updateDoc(userDocRef, { paymentMethods: cleanedPaymentMethods, updatedAt: new Date() });
      }
      setPaymentSuccess(true);
      setEditingPayment(false);
      setUserData(prev => ({ ...prev, paymentMethods: cleanedPaymentMethods }));
      setTimeout(() => setPaymentSuccess(false), 3000);
    } catch (err) {
      console.error('Payment save error:', err);
      let errorMessage = 'Failed to save payment methods. ';
      if (err.message?.includes('Encryption failed')) errorMessage = 'Encryption error: ' + err.message;
      else if (err.code === 'permission-denied') errorMessage = 'Permission denied. Check Firestore security rules.';
      else if (err.code === 'unavailable') errorMessage = 'Network error. Check your internet connection.';
      else errorMessage += err.message || 'Please try again.';
      setPaymentError(errorMessage);
    } finally {
      setSavingPayment(false);
    }
  };

  const { owedByCurrency, owingByCurrency } = calculateOverallBalance();

  // Total paid per currency — looks up each expense's group currency
  const paidByCurrency = {};
  expenses
    .filter(e => e.paidBy === user.uid)
    .forEach(e => {
      const group    = groups.find(g => g.id === e.groupId);
      const currency = group?.currency || 'EUR';
      paidByCurrency[currency] = (paidByCurrency[currency] || 0) + e.amount;
    });

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
    ? new Date(user.metadata.creationTime).toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })
    : 'Unknown';

  // Handle showing payment settings with biometric check
  const handleShowPaymentSettings = async () => {
    if (!user) return;
    if (showPaymentSettings) {
      setShowPaymentSettings(false);
      setIsAuthenticated(false);
      return;
    }
    if (biometricEnabled) {
      setBiometricLoading(true); // show overlay BEFORE the prompt
      const authenticated = await authenticateWithBiometric(user.uid, 'Authenticate to view payment settings');
      setBiometricLoading(false);
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
    if (biometricEnabled && !isAuthenticated) {
      setBiometricLoading(true);   // show overlay BEFORE the prompt
      const authenticated = await authenticateWithBiometric(user.uid, 'Authenticate to edit payment settings');
      setBiometricLoading(false);
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

      {/* Biometric authentication loading overlay — prevents black screen during fingerprint prompt */}
      {biometricLoading && (
        <div className="fixed inset-0 z-[100] bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg">
            <Lock size={28} className="text-white" />
          </div>
          <div className="text-center">
            <p className="text-white font-semibold text-lg">Verifying Identity</p>
            <p className="text-gray-300 text-sm mt-1">Use your fingerprint or Face ID to continue</p>
          </div>
          <div className="flex gap-1 mt-2">
            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}
      {/* ── Header ── */}
      <div className="bg-white dark:bg-gray-800 shadow-card top-0 z-30">
        <div className="bg-gradient-to-br from-primary to-primary-dark dark:from-indigo-900 dark:to-blue-900 text-white shadow-card-3d">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-white hover:text-gray-200 mb-4 md:hidden"
                >
                  <ArrowLeft size={24} />
              </button>
              <div>
                <h1 className="text-white text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>
                <p className="text-white text-xs text-gray-500 dark:text-gray-400">Your personal information and settings</p>
              </div>
            </div>
          </div>  
          <div className="flex flex-col items-center">
              <CloudinaryUpload
                user={user}
                currentPhotoURL={userData?.photoURL}
                onPhotoUpdated={handlePhotoUpdated}
              />
              <h1 className="text-2xl font-bold mb-1">{user?.displayName || 'User'}</h1>
              <p className="text-white text-opacity-90 text-sm">{user?.email}</p><br />
          </div>
        </div>
        
      </div>
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* ── Balance Overview ── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card hover:shadow-card-hover dark:shadow-gray-900/50 transition-all duration-300 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Wallet size={20} className="text-primary dark:text-indigo-400" />
            Overall Balance
          </h2>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-4 border border-gray-200 dark:border-gray-600">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 text-center">
              Balances are shown per currency — no conversion applied
            </p>
            {Object.keys(owedByCurrency).length === 0 && Object.keys(owingByCurrency).length === 0 && (
              <p className="text-center text-gray-600 dark:text-gray-300 font-medium">All settled up!</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Owed to You */}
            <div
              onClick={() => {
                setBreakdownData(calculateDetailedBreakdown('owed'));
                setBreakdownType('owed');
                setShowBreakdownModal(true);
              }}
              className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4 border border-green-200 dark:border-green-800 cursor-pointer hover:shadow-md hover:scale-105 transition-all duration-200"
            >
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={16} className="text-green-600 dark:text-green-400" />
                <p className="text-xs text-green-700 dark:text-green-300 font-medium">Owed to You</p>
              </div>
              <div className="space-y-0.5">
                {Object.entries(owedByCurrency).length === 0 ? (
                  <p className="text-xl font-bold text-green-900 dark:text-green-100">—</p>
                ) : (
                  Object.entries(owedByCurrency).map(([currency, amount]) => (
                    <p key={currency} className="text-xl font-bold text-green-900 dark:text-green-100">
                      {currency} {amount.toFixed(2)}
                    </p>
                  ))
                )}
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">Click for details</p>
            </div>

            {/* You Owe */}
            <div
              onClick={() => {
                setBreakdownData(calculateDetailedBreakdown('owing'));
                setBreakdownType('owing');
                setShowBreakdownModal(true);
              }}
              className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-4 border border-orange-200 dark:border-orange-800 cursor-pointer hover:shadow-md hover:scale-105 transition-all duration-200"
            >
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown size={16} className="text-orange-600 dark:text-orange-400" />
                <p className="text-xs text-orange-700 dark:text-orange-300 font-medium">You Owe</p>
              </div>
              <div className="space-y-0.5">
                {Object.entries(owingByCurrency).length === 0 ? (
                  <p className="text-xl font-bold text-orange-900 dark:text-orange-100">—</p>
                ) : (
                  Object.entries(owingByCurrency).map(([currency, amount]) => (
                    <p key={currency} className="text-xl font-bold text-orange-900 dark:text-orange-100">
                      {currency} {amount.toFixed(2)}
                    </p>
                  ))
                )}
              </div>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Click for details</p>
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card dark:shadow-gray-900/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users size={20} className="text-blue-600 dark:text-blue-400" />
              <p className="text-sm text-gray-600 dark:text-gray-300">Groups</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{groups.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card dark:shadow-gray-900/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wallet size={16} className="text-green-600 dark:text-green-400" />
              <p className="text-sm text-gray-600 dark:text-gray-300">Total Paid</p>
            </div>
            {Object.entries(paidByCurrency).length === 0 ? (
              <p className="text-2xl font-bold text-gray-900 dark:text-white">—</p>
            ) : (
              <div className="space-y-1">
                {Object.entries(paidByCurrency).map(([currency, amount]) => (
                  <div key={currency} className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                      {currency}
                    </span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Account Information — collapsible ── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card dark:shadow-gray-900/50 mb-4 overflow-hidden">
          <button
            onClick={() => setShowAccountInfo(o => !o)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <User size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">Account Information</span>
            </div>
            <ChevronDown
              size={18}
              className={`text-gray-400 transition-transform duration-300 ${showAccountInfo ? 'rotate-180' : ''}`}
            />
          </button>
          {/* Collapsible body */}
          <div className={`transition-all duration-300 overflow-hidden ${showAccountInfo ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="px-6 pb-5 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-4">
              <div className="flex items-start gap-3">
                <User size={18} className="text-gray-400 dark:text-gray-500 mt-1" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Name</p>
                  <p className="font-medium text-gray-900 dark:text-white mt-0.5">{user?.displayName || 'Not set'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail size={18} className="text-gray-400 dark:text-gray-500 mt-1" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Email</p>
                  <p className="font-medium text-gray-900 dark:text-white mt-0.5">{user?.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar size={18} className="text-gray-400 dark:text-gray-500 mt-1" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Member Since</p>
                  <p className="font-medium text-gray-900 dark:text-white mt-0.5">{joinDate}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* END Account Information */}

        {/* ── Contact Discovery — collapsible ── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card dark:shadow-gray-900/50 mb-4 overflow-hidden">
          <button
            onClick={() => setShowContactDisc(o => !o)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
                <Users size={18} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-left">
                <span className="font-semibold text-gray-900 dark:text-white">Contact Discovery</span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Add your number so friends can find you</p>
              </div>
            </div>
            <ChevronDown
              size={18}
              className={`text-gray-400 transition-transform duration-300 ${showContactDisc ? 'rotate-180' : ''}`}
            />
          </button>
          {/* Collapsible body */}
          <div className={`transition-all duration-300 overflow-hidden ${showContactDisc ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="px-6 pb-5 pt-3 border-t border-gray-100 dark:border-gray-700">

              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-900 dark:text-blue-300">
                  <strong>Optional:</strong> Add your phone number to let friends find you when they sync their contacts.
                  We store only a hash, never the actual number.
                </p>
              </div>

              {phoneSuccess && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300 text-sm">
                  {phoneSuccess}
                </div>
              )}
              {phoneError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                  {phoneError}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Phone Number (Optional)
                </label>
                {editingPhone ? (
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+353871234567"
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500 focus:border-transparent outline-none"
                    />
                    <button
                      onClick={handleSavePhone}
                      className="px-4 py-2 bg-primary dark:bg-indigo-600 text-white rounded-lg hover:bg-primary-dark dark:hover:bg-indigo-700 transition"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setEditingPhone(false); setPhoneNumber(userData?.phoneNumber || ''); setPhoneError(''); }}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <span className="text-gray-900 dark:text-white">{phoneNumber || 'Not set'}</span>
                    <button
                      onClick={() => setEditingPhone(true)}
                      className="text-primary dark:text-indigo-400 text-sm hover:underline"
                    >
                      {phoneNumber ? 'Edit' : 'Add'}
                    </button>
                  </div>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Format: +[country code][number] (e.g., +353871234567)
                </p>
              </div>

            </div>
          </div>
        </div>
        {/* END Contact Discovery */}

        {/* ── Payment Settings — collapsible ── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card hover:shadow-card-hover dark:shadow-gray-900/50 transition-all duration-300 p-6 mb-6">
          {/* Header */}
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
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Payment Settings</h2>
                  {biometricEnabled && <Lock size={16} className="text-indigo-600 dark:text-indigo-400" />}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {showPaymentSettings ? 'Click to hide' : 'Click to show'}
                  {biometricEnabled && !showPaymentSettings && ' (requires authentication)'}
                </p>
              </div>
            </div>
            <ChevronDown
              size={24}
              className={`text-gray-400 dark:text-gray-500 transition-transform duration-300 ${showPaymentSettings ? 'rotate-180' : ''}`}
            />
          </div>

          {/* Collapsible Content */}
          {showPaymentSettings && (
            <div className="mt-4 animate-scale-in">
              {!editingPayment && (
                <div className="flex justify-end mb-4">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEditPayment(); }}
                    className="px-4 py-2 text-primary dark:text-indigo-400 border border-primary dark:border-indigo-600 rounded-lg hover:bg-primary-light dark:hover:bg-indigo-900/30 transition"
                  >
                    Edit Payment Methods
                  </button>
                </div>
              )}

              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <Info size={16} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-800 dark:text-blue-200">
                    <p className="font-medium mb-1">Set up your payment methods to receive money easily</p>
                    <p>Your IBAN is encrypted and secure. Payment info is only visible to you and members of your groups.</p>
                  </div>
                </div>
              </div>

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

              <div className="space-y-4">
                {/* PayPal Username */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PayPal.me Username</label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-400 dark:text-gray-500">paypal.me/</span>
                    <input
                      type="text"
                      value={paymentMethods.paypalUsername}
                      onChange={(e) => setPaymentMethods(prev => ({ ...prev, paypalUsername: e.target.value }))}
                      disabled={!editingPayment}
                      placeholder="username"
                      maxLength={20}
                      className="w-full pl-24 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500 focus:border-transparent outline-none disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400"
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Your PayPal.me link (e.g., "alice" for paypal.me/alice)</p>
                </div>

                {/* Revolut Username */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Revolut Username</label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-400 dark:text-gray-500">@</span>
                    <input
                      type="text"
                      value={paymentMethods.revolutUsername}
                      onChange={(e) => setPaymentMethods(prev => ({ ...prev, revolutUsername: e.target.value }))}
                      disabled={!editingPayment}
                      placeholder="username"
                      maxLength={30}
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500 focus:border-transparent outline-none disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400"
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Your Revolut @username (e.g., "@alice")</p>
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
                    onChange={(e) => setPaymentMethods(prev => ({ ...prev, iban: e.target.value.toUpperCase() }))}
                    disabled={!editingPayment}
                    placeholder="IE29AIBK12345678901234"
                    maxLength={34}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500 focus:border-transparent outline-none disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Your bank account IBAN for SEPA transfers</p>
                </div>

                {/* BIC */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">BIC/SWIFT Code (Optional)</label>
                  <input
                    type="text"
                    value={paymentMethods.bic}
                    onChange={(e) => setPaymentMethods(prev => ({ ...prev, bic: e.target.value.toUpperCase() }))}
                    disabled={!editingPayment}
                    placeholder="AIBKIE2D"
                    maxLength={11}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500 focus:border-transparent outline-none disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Your bank's BIC/SWIFT code (usually not required for SEPA)</p>
                </div>
              </div>

              {editingPayment && (
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingPayment(false); setPaymentError(''); }}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSavePaymentMethods(); }}
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
        {/* END Payment Settings */}

        {/* ── Actions ── */}
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

      {/* ── Balance Breakdown Modal ── */}
      <BalanceBreakdownModal
        isOpen={showBreakdownModal}
        onClose={() => setShowBreakdownModal(false)}
        type={breakdownType}
        breakdowns={breakdownData}
        amountsByCurrency={breakdownType === 'owed' ? owedByCurrency : owingByCurrency
       }
      />

    </div>
  );
}
