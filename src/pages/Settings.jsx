// src/pages/Settings.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, User, Mail, Bell, Trash2, 
  LogOut, Shield, Eye, EyeOff, AlertTriangle
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { 
  updateProfile,
  EmailAuthProvider, 
  reauthenticateWithCredential,
  deleteUser
} from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, deleteDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { QrCode, HelpCircle } from 'lucide-react';
import QRCodeModal from '../components/QRCodeModal';
import InfoHubModal from '../components/InfoHubModal';
import DarkModeToggle from '../components/DarkModeToggle';
import { registerBiometric, authenticateWithBiometric, disableBiometric, isBiometricEnabledOnDevice, getDeviceInfo } from '../utils/biometric';
import { useSessionTimeout } from '../hooks/useSessionTimeout';

export default function Settings() {
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [notifications, setNotifications] = useState(true);
  const { timeoutSetting, updateTimeoutSetting } = useSessionTimeout();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showQRCode, setShowQRCode] = useState(false);
  const [showInfoHub, setShowInfoHub] = useState(false);
  
  // Profile edit state
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.displayName || '');
  
  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      setError('Name cannot be empty');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // 1. Update Firebase Auth
      await updateProfile(auth.currentUser, {
        displayName: newName.trim()
      });
      
      // 2. Update Firestore user document
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: newName.trim(),
        updatedAt: new Date(),
      });

      // 3. Update user's name in ALL groups where they're a member
      const groupsQuery = query(
        collection(db, 'groups'),
        where('memberIds', 'array-contains', user.uid)
      );
      
      const groupsSnapshot = await getDocs(groupsQuery);
      
      // Update each group's members array
      const groupUpdates = groupsSnapshot.docs.map(async (groupDoc) => {
        const groupData = groupDoc.data();
        const updatedMembers = groupData.members.map(member => {
          if (member.userId === user.uid) {
            return { ...member, name: newName.trim() };
          }
          return member;
        });
        
        return updateDoc(doc(db, 'groups', groupDoc.id), {
          members: updatedMembers,
        });
      });
      
      await Promise.all(groupUpdates);
      
      setSuccess('Name updated successfully across all groups!');
      setEditingName(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating name:', err);
      setError('Failed to update name. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
      setError('Failed to logout. Please try again.');
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError('Password is required');
      return;
    }

    setDeleteLoading(true);
    setDeleteError('');

    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email,
        deletePassword
      );
      
      await reauthenticateWithCredential(auth.currentUser, credential);

      // Delete user's groups (only if they're the owner)
      const groupsQuery = query(
        collection(db, 'groups'),
        where('createdBy', '==', user.uid)
      );
      const groupsSnapshot = await getDocs(groupsQuery);
      
      for (const groupDoc of groupsSnapshot.docs) {
        await deleteDoc(doc(db, 'groups', groupDoc.id));
      }

      // Delete user's expenses
      const expensesQuery = query(
        collection(db, 'expenses'),
        where('paidBy', '==', user.uid)
      );
      const expensesSnapshot = await getDocs(expensesQuery);
      
      for (const expenseDoc of expensesSnapshot.docs) {
        await deleteDoc(doc(db, 'expenses', expenseDoc.id));
      }

      // Delete user account
      await deleteUser(auth.currentUser);

      // Redirect to login
      navigate('/login');
    } catch (err) {
      console.error('Delete account error:', err);
      if (err.code === 'auth/wrong-password') {
        setDeleteError('Incorrect password. Please try again.');
      } else if (err.code === 'auth/too-many-requests') {
        setDeleteError('Too many attempts. Please try again later.');
      } else {
        setDeleteError('Failed to delete account. Please try again.');
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBiometricToggle = async (newValue) => {
    // TURNING ON - Register biometric on THIS device
    if (newValue && !biometricEnabled) {
      try {
        setLoading(true);
        
        // Register biometric - prompts for ACTUAL fingerprint/Face ID
        const success = await registerBiometric(user.uid, user.email, user.displayName);
        
        if (success) {
          setBiometricEnabled(true);
          const deviceInfo = getDeviceInfo();
          setSuccess(`✅ Biometric authentication enabled on ${deviceInfo}!`);
          setTimeout(() => setSuccess(''), 4000);
        } else {
          setError('Failed to enable biometric authentication. Please try again.');
          setTimeout(() => setError(''), 3000);
        }
      } catch (err) {
        console.error('Biometric enable error:', err);
        setError('Failed to enable biometric authentication');
        setTimeout(() => setError(''), 3000);
      } finally {
        setLoading(false);
      }
      return;
    }
    
    // TURNING OFF - Require authentication first
    if (!newValue && biometricEnabled) {
      try {
        setLoading(true);
        
        // Require biometric auth to disable
        const authenticated = await authenticateWithBiometric(
          user.uid,
          'Authenticate to disable biometric security'
        );
        
        if (!authenticated) {
          setLoading(false);
          return; // Don't change toggle
        }

        // Disable biometric on THIS device
        disableBiometric(user.uid);
        
        setBiometricEnabled(false);
        const deviceInfo = getDeviceInfo();
        setSuccess(`Biometric authentication disabled on ${deviceInfo}`);
        setTimeout(() => setSuccess(''), 3000);
      } catch (err) {
        console.error('Biometric disable error:', err);
        setError('Failed to disable biometric authentication');
        setTimeout(() => setError(''), 3000);
      } finally {
        setLoading(false);
      }
    }
  };


  // Load biometric setting from user document
  useEffect(() => {
    // Load biometric setting from localStorage (device-specific)
    if (user) {
      const enabled = isBiometricEnabledOnDevice(user.uid);
      setBiometricEnabled(enabled);
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      {/* Top Bar */}
      <div className="bg-white dark:bg-gray-800 shadow dark:shadow-gray-900/50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Profile Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card dark:shadow-gray-900/50 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <User size={20} />
            Profile
          </h2>

          {/* Display Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Display Name
            </label>
            {editingName ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500 focus:border-transparent outline-none"
                  placeholder="Enter your name"
                />
                <button
                  onClick={handleUpdateName}
                  disabled={loading}
                  className="px-4 py-2 bg-primary dark:bg-indigo-600 text-white rounded-lg hover:bg-primary-dark dark:hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditingName(false);
                    setNewName(user?.displayName || '');
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-gray-900 dark:text-white">{user?.displayName || 'Not set'}</span>
                <button
                  onClick={() => setEditingName(true)}
                  className="text-primary dark:text-indigo-400 text-sm hover:underline"
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          {/* Email */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email
            </label>
            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <Mail size={18} className="text-gray-400 dark:text-gray-500" />
              <span className="text-gray-900 dark:text-white">{user?.email}</span>
            </div>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card dark:shadow-gray-900/50 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Bell size={20} />
            Notifications
          </h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Push Notifications</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Get notified about new expenses</p>
              </div>
              <button
                onClick={() => setNotifications(!notifications)}
                className={`relative w-14 h-7 rounded-full transition-colors ${
                  notifications ? 'bg-primary dark:bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                    notifications ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Session Timeout Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card dark:shadow-gray-900/50 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Shield size={20} />
            Security & Privacy
          </h2>

          <div className="space-y-4">
            {/* Session Timeout Setting */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                  <Shield size={20} className="text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">Auto-Logout Timer</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Automatically log out after a period of inactivity to protect your account
                  </p>
                </div>
              </div>
            
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: '5min', label: '5 min' },
                  { value: '10min', label: '10 min' },
                  { value: '20min', label: '20 min' },
                  { value: '30min', label: '30 min' },
                  { value: 'never', label: 'Never' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={async () => {               
                      try {
                        await updateTimeoutSetting(option.value);
                        
                      } catch (error) {
                        
                      }
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                      timeoutSetting === option.value
                        ? 'bg-primary dark:bg-indigo-600 text-white'
                        : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              
              {timeoutSetting !== 'never' && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-xs text-blue-800 dark:text-blue-300">
                    You'll be warned 30 seconds before auto-logout and can choose to stay logged in.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Account Actions Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card dark:shadow-gray-900/50 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Shield size={20} />
            Account
          </h2>

          <div className="space-y-3">
          

          {/* App Information Section */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <HelpCircle size={20} className="text-primary dark:text-indigo-400" />
              App Information
            </h3>
            
            <div className="space-y-3">
              {/* Dark Mode Toggle */}
              <DarkModeToggle />
              {/* Share App Button */}
              <button
                onClick={() => setShowQRCode(true)}
                className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-700 rounded-lg shadow-card hover:shadow-card-hover dark:shadow-gray-900/50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                    <QrCode size={20} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900 dark:text-white">Share Split-Sync</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">QR code & download link</p>
                  </div>
                </div>
                <div className="w-5 h-5 bg-gray-100 dark:bg-gray-600 rounded-full flex items-center justify-center">
                  <span className="text-gray-600 dark:text-gray-300">→</span>
                </div>
              </button>

              {/* Help & Information Button */}
              <button
                onClick={() => setShowInfoHub(true)}
                className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-700 rounded-lg shadow-card hover:shadow-card-hover dark:shadow-gray-900/50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <HelpCircle size={20} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900 dark:text-white">Help & Information</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Guides, tutorials & support</p>
                  </div>
                </div>
                <div className="w-5 h-5 bg-gray-100 dark:bg-gray-600 rounded-full flex items-center justify-center">
                  <span className="text-gray-600 dark:text-gray-300">→</span>
                </div>
              </button>
            </div>
          </div>

          {/* Biometric Authentication Toggle */}
           <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                  <Shield size={20} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Biometric Authentication</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Use fingerprint/Face ID on {getDeviceInfo()}</p>
                </div>
              </div>
              
              {/* Toggle Switch */}
              <button
                onClick={() => handleBiometricToggle(!biometricEnabled)}
                className={`relative w-12 h-6 rounded-full transition ${
                  biometricEnabled ? 'bg-primary dark:bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
                aria-label="Toggle biometric authentication"
              >
                <span className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-all ${
                  biometricEnabled ? 'right-0.5' : 'left-0.5'
                }`} />
              </button>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition"
            >
              <div className="flex items-center gap-3">
                <LogOut size={20} className="text-gray-600 dark:text-gray-400" />
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white">Log Out</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Sign out of your account</p>
                </div>
              </div>
            </button>


            {/* Delete Account */}
            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-full flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition border border-red-200 dark:border-red-800"
            >
              <div className="flex items-center gap-3">
                <Trash2 size={20} className="text-red-600 dark:text-red-400" />
                <div className="text-left">
                  <p className="font-medium text-red-900 dark:text-red-300">Delete Account</p>
                  <p className="text-sm text-red-600 dark:text-red-400">Permanently delete your account</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* App Info */}
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>SplitSync v1.0.0</p>
          <p className="mt-1">Made with ❤️ for easy expense tracking</p>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-card-3d">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle size={24} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Delete Account</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-800 dark:text-red-300">
                <strong>Warning:</strong> Deleting your account will:
              </p>
              <ul className="text-sm text-red-700 dark:text-red-300 mt-2 space-y-1 list-disc list-inside">
                <li>Delete all your groups (if you're the owner)</li>
                <li>Delete all your expenses</li>
                <li>Remove you from shared groups</li>
                <li>Permanently erase your account data</li>
              </ul>
            </div>

            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                {deleteError}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Enter your password to confirm
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 dark:focus:ring-red-600 focus:border-transparent outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePassword('');
                  setDeleteError('');
                }}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading || !deletePassword}
                className="flex-1 px-4 py-3 bg-red-600 dark:bg-red-700 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-800 transition disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={showQRCode}
        onClose={() => setShowQRCode(false)}
        appUrl={process.env.REACT_APP_BASE_URL || window.location.origin}
      />

      {/* Info Hub Modal */}
      <InfoHubModal
        isOpen={showInfoHub}
        onClose={() => setShowInfoHub(false)}
      />

    </div>
  );
}
