// src/pages/Settings.jsx
import { useState, useEffectEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, User, Mail, Moon, Sun, Bell, Trash2, 
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
import { doc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { QrCode, HelpCircle, Star } from 'lucide-react';
import QRCodeModal from '../components/QRCodeModal';
import InfoHubModal from '../components/InfoHubModal';

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
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
      await updateProfile(auth.currentUser, {
        displayName: newName.trim()
      });
      
      setSuccess('Name updated successfully!');
      setEditingName(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating name:', err);
      setError('Failed to update name. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDarkModeToggle = () => {
    setDarkMode(!darkMode);
    // TODO: Implement dark mode theme switching
    // This would involve adding dark mode classes to the root element
    // and saving preference to localStorage
    if (!darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
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

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Top Bar */}
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Profile Section */}
        <div className="bg-white rounded-xl shadow-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User size={20} />
            Profile
          </h2>

          {/* Display Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Display Name
            </label>
            {editingName ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  placeholder="Enter your name"
                />
                <button
                  onClick={handleUpdateName}
                  disabled={loading}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditingName(false);
                    setNewName(user?.displayName || '');
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-900">{user?.displayName || 'Not set'}</span>
                <button
                  onClick={() => setEditingName(true)}
                  className="text-primary text-sm hover:underline"
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          {/* Email */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <Mail size={18} className="text-gray-400" />
              <span className="text-gray-900">{user?.email}</span>
            </div>
          </div>
        </div>

        {/* Appearance Section */}
        <div className="bg-white rounded-xl shadow-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            {darkMode ? <Moon size={20} /> : <Sun size={20} />}
            Appearance
          </h2>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Dark Mode</p>
              <p className="text-sm text-gray-600">Switch to dark theme</p>
            </div>
            <button
              onClick={handleDarkModeToggle}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                darkMode ? 'bg-primary' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  darkMode ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="bg-white rounded-xl shadow-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Bell size={20} />
            Notifications
          </h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Push Notifications</p>
                <p className="text-sm text-gray-600">Get notified about new expenses</p>
              </div>
              <button
                onClick={() => setNotifications(!notifications)}
                className={`relative w-14 h-7 rounded-full transition-colors ${
                  notifications ? 'bg-primary' : 'bg-gray-300'
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

        {/* Account Actions Section */}
        <div className="bg-white rounded-xl shadow-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Shield size={20} />
            Account
          </h2>

          <div className="space-y-3">
          

          {/* App Information Section */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <HelpCircle size={20} className="text-primary" />
              App Information
            </h3>
            
            <div className="space-y-3">
              {/* Share App Button */}
              <button
                onClick={() => setShowQRCode(true)}
                className="w-full flex items-center justify-between p-4 bg-white rounded-lg shadow-card hover:shadow-card-hover transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                    <QrCode size={20} className="text-indigo-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Share Split-Sync</p>
                    <p className="text-sm text-gray-500">QR code & download link</p>
                  </div>
                </div>
                <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center">
                  <span className="text-gray-600">→</span>
                </div>
              </button>

              {/* Help & Information Button */}
              <button
                onClick={() => setShowInfoHub(true)}
                className="w-full flex items-center justify-between p-4 bg-white rounded-lg shadow-card hover:shadow-card-hover transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <HelpCircle size={20} className="text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Help & Information</p>
                    <p className="text-sm text-gray-500">Guides, tutorials & support</p>
                  </div>
                </div>
                <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center">
                  <span className="text-gray-600">→</span>
                </div>
              </button>
            </div>
          </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
            >
              <div className="flex items-center gap-3">
                <LogOut size={20} className="text-gray-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">Log Out</p>
                  <p className="text-sm text-gray-600">Sign out of your account</p>
                </div>
              </div>
            </button>

            {/* Delete Account */}
            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-full flex items-center justify-between p-4 bg-red-50 hover:bg-red-100 rounded-lg transition"
            >
              <div className="flex items-center gap-3">
                <Trash2 size={20} className="text-red-600" />
                <div className="text-left">
                  <p className="font-medium text-red-900">Delete Account</p>
                  <p className="text-sm text-red-600">Permanently delete your account</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* App Info */}
        <div className="text-center text-sm text-gray-500">
          <p>SplitSync v1.0.0</p>
          <p className="mt-1">Made with ❤️ for easy expense tracking</p>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-card-3d">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle size={24} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Delete Account</h2>
                <p className="text-sm text-gray-600">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-800">
                <strong>Warning:</strong> Deleting your account will:
              </p>
              <ul className="text-sm text-red-700 mt-2 space-y-1 list-disc list-inside">
                <li>Delete all your groups (if you're the owner)</li>
                <li>Delete all your expenses</li>
                <li>Remove you from shared groups</li>
                <li>Permanently erase your account data</li>
              </ul>
            </div>

            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {deleteError}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter your password to confirm
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading || !deletePassword}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
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
      />

      {/* Info Hub Modal */}
      <InfoHubModal
        isOpen={showInfoHub}
        onClose={() => setShowInfoHub(false)}
      />

    </div>
  );
}
