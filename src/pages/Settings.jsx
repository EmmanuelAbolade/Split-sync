// src/pages/Settings.jsx
// Settings page — collapsible sections:
// Profile | Notifications | Appearance | Install App | Security & Privacy | Account | Support

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Mail, Bell, Trash2, LogOut,
  Shield, Eye, EyeOff, AlertTriangle, ChevronDown,
  QrCode, HelpCircle, Moon, Fingerprint, Info, Timer,
  MonitorDown, Smartphone, CheckCircle2, Share2, Compass,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useSessionTimeout } from '../hooks/useSessionTimeout';
import {
  updateProfile,
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  deleteUser,
} from 'firebase/auth';
import { findUnsettledGroups, deleteAccountData } from '../utils/accountDeletion';
import { auth, db } from '../services/firebase';
import { doc, updateDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import QRCodeModal    from '../components/QRCodeModal';
import InfoHubModal   from '../components/InfoHubModal';
import DarkModeToggle from '../components/DarkModeToggle';
import {
  registerBiometric,
  authenticateWithBiometric,
  disableBiometric,
  isBiometricEnabledOnDevice,
  getDeviceInfo,
} from '../utils/biometric';

// ─── Collapsible Section wrapper ─────────────────────────────────────────────

function Section({ title, icon: Icon, iconColor = 'text-indigo-600 dark:text-indigo-400', iconBg = 'bg-indigo-50 dark:bg-indigo-900/30', defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mb-3">
      {/* Header — click to toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 ${iconBg} rounded-xl flex items-center justify-center`}>
            <Icon size={18} className={iconColor} />
          </div>
          <span className="font-semibold text-gray-900 dark:text-white">{title}</span>
        </div>
        <ChevronDown
          size={18}
          className={`text-gray-400 dark:text-gray-500 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Collapsible body */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${open ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-5 pb-5 pt-1 border-t border-gray-100 dark:border-gray-700 space-y-3">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Toggle row ───────────────────────────────────────────────────────────────

function ToggleRow({ label, description, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-3 px-4 bg-gray-50 dark:bg-gray-700/60 rounded-xl">
      <div>
        <p className="font-medium text-gray-900 dark:text-white text-sm">{label}</p>
        {description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${value ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}
        aria-label={label}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${value ? 'right-0.5' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

// ─── Action row (button-style row) ────────────────────────────────────────────

function ActionRow({ icon: Icon, iconBg, iconColor, label, description, onClick, chevron = true, destructive = false }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between py-3 px-4 rounded-xl transition-colors ${
        destructive
          ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30'
          : 'bg-gray-50 dark:bg-gray-700/60 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 ${iconBg} rounded-xl flex items-center justify-center shrink-0`}>
          <Icon size={17} className={iconColor} />
        </div>
        <div className="text-left">
          <p className={`font-medium text-sm ${destructive ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{label}</p>
          {description && <p className={`text-xs mt-0.5 ${destructive ? 'text-red-500 dark:text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>{description}</p>}
        </div>
      </div>
      {chevron && (
        <ChevronDown size={16} className={`-rotate-90 ${destructive ? 'text-red-400' : 'text-gray-400 dark:text-gray-500'}`} />
      )}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Settings() {
  const navigate       = useNavigate();
  const { user, logout, updateUserDisplayName } = useAuthStore();

  const [notifications,    setNotifications]    = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState('');
  const [success,          setSuccess]          = useState('');
  const [showQRCode,       setShowQRCode]       = useState(false);
  const [showInfoHub,      setShowInfoHub]      = useState(false);

  // Profile edit
  const [editingName, setEditingName] = useState(false);
  const [newName,     setNewName]     = useState(user?.displayName || '');

  // Delete account
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword,  setDeletePassword]  = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [deleteLoading,   setDeleteLoading]   = useState(false);
  const [deleteError,     setDeleteError]     = useState('');

  // Load biometric state from device
  useEffect(() => {
    if (user) setBiometricEnabled(isBiometricEnabledOnDevice(user.uid));
  }, [user]);

  // Session timeout settings
  const { timeoutSetting, updateTimeoutSetting } = useSessionTimeout();

  const TIMEOUT_OPTIONS = [
    { value: '5min',  label: '5 minutes' },
    { value: '10min', label: '10 minutes' },
    { value: '20min', label: '20 minutes' },
    { value: '30min', label: '30 minutes' },
    { value: 'never', label: 'Never' },
  ];

  // ── PWA Install ────────────────────────────────────────────────────────────
  // Captures the browser's beforeinstallprompt event so we can trigger it via
  // a button. Works on Chrome and Edge (Android + desktop). iOS requires the
  // user to use Safari's Share sheet manually, so we detect and show steps.

  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled,   setIsInstalled]   = useState(false);
  const [installDone,   setInstallDone]   = useState(false);

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInStandaloneMode =
    window.matchMedia('(display-mode: standalone)').matches ||
    navigator.standalone === true;

  useEffect(() => {
    if (isInStandaloneMode) {
      setIsInstalled(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();          // Stop the browser's own mini-infobar
      setInstallPrompt(e);         // Save the event for later use
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Detect successful install via appinstalled event
    const onInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [isInStandaloneMode]);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstallDone(true);
        setInstallPrompt(null);
      }
    } catch (err) {
      console.error('PWA install error:', err);
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  // Update name across Firebase Auth, Firestore user doc, and all group member arrays
  const handleUpdateName = async () => {
    if (!newName.trim()) { setError('Name cannot be empty'); return; }
    if (newName.trim().length > 50) { setError('Name cannot exceed 50 characters'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const trimmedName = newName.trim();

      // 1. Update Firebase Auth display name
      await updateProfile(auth.currentUser, { displayName: trimmedName });

      // 2. Update Firestore user document — keep both displayName and fullName in sync
      await updateDoc(doc(db, 'users', user.uid), { displayName: trimmedName, fullName: trimmedName });

      // 3. Update this user's name inside every group's members array
      const groupsSnap = await getDocs(
        query(collection(db, 'groups'), where('memberIds', 'array-contains', user.uid))
      );
      const batch = writeBatch(db);
      groupsSnap.forEach(groupDoc => {
        const members = groupDoc.data().members || [];
        const updatedMembers = members.map(m =>
          m.userId === user.uid ? { ...m, name: trimmedName } : m
        );
        batch.update(groupDoc.ref, { members: updatedMembers });
      });
      await batch.commit();

      // Update the in-memory store so all components reflect the new name immediately
      updateUserDisplayName(trimmedName);
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

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
      setError('Failed to log out. Please try again.');
    }
  };

  // Google-only accounts have no password — they re-authenticate with a popup
  const isGoogleOnlyAccount =
    !!auth.currentUser?.providerData?.some(p => p.providerId === 'google.com') &&
    !auth.currentUser?.providerData?.some(p => p.providerId === 'password');

  // Account deletion — see utils/accountDeletion.js for the full data policy.
  // Previously this deleted every expense the user had paid in ANY group
  // (silently erasing debts other members owed), deleted owned groups while
  // leaving their expenses orphaned, never removed the user from shared groups,
  // and could not work for Google sign-in accounts.
  const handleDeleteAccount = async () => {
    if (!isGoogleOnlyAccount && !deletePassword) { setDeleteError('Password is required'); return; }
    setDeleteLoading(true); setDeleteError('');
    try {
      // 1. Re-authenticate (Firebase requires a recent login to delete a user)
      if (isGoogleOnlyAccount) {
        await reauthenticateWithPopup(auth.currentUser, new GoogleAuthProvider());
      } else {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, deletePassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
      }

      // 2. Block while money is still owed in either direction
      const unsettled = await findUnsettledGroups(user.uid);
      if (unsettled.length > 0) {
        setDeleteError(
          'Settle all balances before deleting your account. Outstanding: ' +
          unsettled.map(u => `${u.name} (you ${u.direction} ${u.currency} ${u.amount})`).join(', ') + '.'
        );
        return;
      }

      // 3. Leave shared groups (history kept), remove personal data, then the auth user
      await deleteAccountData(user);
      await deleteUser(auth.currentUser);
      navigate('/login');
    } catch (err) {
      console.error('Delete account error:', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setDeleteError('Incorrect password. Please try again.');
      } else if (err.code === 'auth/too-many-requests') {
        setDeleteError('Too many attempts. Please try again later.');
      } else if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        setDeleteError('Sign-in was cancelled. Please confirm with Google to delete your account.');
      } else {
        setDeleteError('Failed to delete account. Please try again.');
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBiometricToggle = async (newValue) => {
    if (newValue && !biometricEnabled) {
      try {
        setLoading(true);
        const ok = await registerBiometric(user.uid, user.email, user.displayName);
        if (ok) {
          setBiometricEnabled(true);
          setSuccess(`Biometric authentication enabled on ${getDeviceInfo()}`);
          setTimeout(() => setSuccess(''), 4000);
        } else {
          setError('Failed to enable biometric. Please try again.');
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

    if (!newValue && biometricEnabled) {
      try {
        setLoading(true);
        const authenticated = await authenticateWithBiometric(user.uid, 'Authenticate to disable biometric security');
        if (!authenticated) { setLoading(false); return; }
        disableBiometric(user.uid);
        setBiometricEnabled(false);
        setSuccess(`Biometric authentication disabled on ${getDeviceInfo()}`);
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-28">

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Settings</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Manage your preferences</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5">

        {/* ── Toast messages ── */}
        {success && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl text-green-700 dark:text-green-300 text-sm flex items-center gap-2">
            <Info size={15} /> {success}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
            <AlertTriangle size={15} /> {error}
          </div>
        )}

        {/* ── 1. Profile ── */}
        <Section title="Profile" icon={User} defaultOpen={true}>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
              Display Name
            </label>
            {editingName ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  placeholder="Enter your name"
                  maxLength={50}
                  autoFocus
                />
                <button
                  onClick={handleUpdateName}
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => { setEditingName(false); setNewName(user?.displayName || ''); }}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/60 rounded-xl">
                <span className="text-sm text-gray-900 dark:text-white">{user?.displayName || 'Not set'}</span>
                <button
                  onClick={() => setEditingName(true)}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
              Email Address
            </label>
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-700/60 rounded-xl">
              <Mail size={15} className="text-gray-400 dark:text-gray-500" />
              <span className="text-sm text-gray-900 dark:text-white">{user?.email}</span>
            </div>
          </div>

        </Section>

        {/* ── 2. Notifications ── */}
        <Section
          title="Notifications"
          icon={Bell}
          iconBg="bg-blue-50 dark:bg-blue-900/30"
          iconColor="text-blue-600 dark:text-blue-400"
        >
          <ToggleRow
            label="Push Notifications"
            description="Get notified about new expenses and settlements"
            value={notifications}
            onChange={setNotifications}
          />
        </Section>

        {/* ── 3. Appearance ── */}
        <Section
          title="Appearance"
          icon={Moon}
          iconBg="bg-purple-50 dark:bg-purple-900/30"
          iconColor="text-purple-600 dark:text-purple-400"
        >
          {/* DarkModeToggle already has its own row styling — wrap in a neutral container */}
          <div className="py-1">
            <DarkModeToggle />
          </div>
        </Section>

        {/* ── 4. Install App ── */}
        <Section
          title="Install App"
          icon={MonitorDown}
          iconBg="bg-teal-50 dark:bg-teal-900/30"
          iconColor="text-teal-600 dark:text-teal-400"
        >
          {/* Already installed */}
          {isInstalled && (
            <div className="flex items-center gap-3 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
              <CheckCircle2 size={18} className="text-green-600 dark:text-green-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  Split-Sync is installed
                </p>
                <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                  Open it from your home screen or app launcher.
                </p>
              </div>
            </div>
          )}

          {/* Install completed this session */}
          {!isInstalled && installDone && (
            <div className="flex items-center gap-3 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
              <CheckCircle2 size={18} className="text-green-600 dark:text-green-400 shrink-0" />
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                Installation started — check your home screen.
              </p>
            </div>
          )}

          {/* Chrome / Edge install button */}
          {!isInstalled && !installDone && installPrompt && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400 px-1">
                Install Split-Sync as an app for faster access, offline support, and a full-screen experience — no app store required.
              </p>
              <button
                onClick={handleInstallClick}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 dark:bg-teal-700 text-white rounded-xl text-sm font-medium hover:bg-teal-700 dark:hover:bg-teal-600 transition-colors"
              >
                <MonitorDown size={17} />
                Install Split-Sync
              </button>
            </div>
          )}

          {/* iOS Safari instructions */}
          {!isInstalled && !installDone && isIOS && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400 px-1">
                To install on iOS, use Safari and follow these steps:
              </p>
              <ol className="space-y-2">
                {[
                  { icon: Share2,      text: 'Tap the Share button in Safari\'s toolbar' },
                  { icon: Smartphone,  text: 'Scroll down and tap "Add to Home Screen"' },
                  { icon: CheckCircle2,text: 'Tap "Add" to confirm' },
                ].map(({ icon: Icon, text }, i) => (
                  <li key={i} className="flex items-start gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-700/60 rounded-xl">
                    <div className="w-7 h-7 bg-teal-100 dark:bg-teal-900/40 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                      <Icon size={14} className="text-teal-600 dark:text-teal-400" />
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{text}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Fallback: browser does not support install prompt and is not iOS */}
          {!isInstalled && !installDone && !installPrompt && !isIOS && (
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/60 rounded-xl space-y-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Install not available</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                To install Split-Sync, open it in Chrome or Edge on your device. The install option will appear here automatically.
              </p>
            </div>
          )}
        </Section>

        {/* ── 5. Security & Privacy ── */}
        <Section
          title="Security & Privacy"
          icon={Shield}
          iconBg="bg-emerald-50 dark:bg-emerald-900/30"
          iconColor="text-emerald-600 dark:text-emerald-400"
        >
          {/* Biometric Authentication */}
          <div className="flex items-center justify-between py-3 px-4 bg-gray-50 dark:bg-gray-700/60 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
                <Fingerprint size={17} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="font-medium text-sm text-gray-900 dark:text-white">Biometric Authentication</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Fingerprint / Face ID on {getDeviceInfo()}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleBiometricToggle(!biometricEnabled)}
              disabled={loading}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 disabled:opacity-50 ${
                biometricEnabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              aria-label="Toggle biometric authentication"
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${
                biometricEnabled ? 'right-0.5' : 'left-0.5'
              }`} />
            </button>
          </div>
          {/* Auto-Logout Timer */}
          <div className="py-3 px-4 bg-gray-50 dark:bg-gray-700/60 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                <Timer size={17} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="font-medium text-sm text-gray-900 dark:text-white">Auto-Logout Timer</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Automatically sign out after inactivity
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {TIMEOUT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updateTimeoutSetting(opt.value)}
                  className={`py-2 px-2 rounded-xl text-xs font-medium text-center transition-all ${
                    timeoutSetting === opt.value
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white dark:bg-gray-600 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-500 hover:border-indigo-400 dark:hover:border-indigo-500'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

        </Section>

        {/* ── 6. Account ── */}
        <Section
          title="Account"
          icon={User}
          iconBg="bg-amber-50 dark:bg-amber-900/30"
          iconColor="text-amber-600 dark:text-amber-400"
        >
          {/* Log Out */}
          <ActionRow
            icon={LogOut}
            iconBg="bg-gray-100 dark:bg-gray-600"
            iconColor="text-gray-600 dark:text-gray-300"
            label="Log Out"
            description="Sign out of your account"
            onClick={handleLogout}
          />

          {/* Delete Account */}
          <ActionRow
            icon={Trash2}
            iconBg="bg-red-100 dark:bg-red-900/30"
            iconColor="text-red-600 dark:text-red-400"
            label="Delete Account"
            description="Permanently erase all your data"
            onClick={() => setShowDeleteModal(true)}
            destructive
          />
        </Section>

        {/* ── 7. Support ── */}
        <Section
          title="Support"
          icon={HelpCircle}
          iconBg="bg-cyan-50 dark:bg-cyan-900/30"
          iconColor="text-cyan-600 dark:text-cyan-400"
        >
          <ActionRow
            icon={QrCode}
            iconBg="bg-indigo-50 dark:bg-indigo-900/30"
            iconColor="text-indigo-600 dark:text-indigo-400"
            label="Share Split-Sync"
            description="QR code and download link"
            onClick={() => setShowQRCode(true)}
          />
          <ActionRow
            icon={HelpCircle}
            iconBg="bg-blue-50 dark:bg-blue-900/30"
            iconColor="text-blue-600 dark:text-blue-400"
            label="Help & Information"
            description="Guides, tutorials and support"
            onClick={() => setShowInfoHub(true)}
          />
        </Section>

        <button
          onClick={() => {
            localStorage.setItem('splitsync_reopen_wizard', '1');
            navigate('/dashboard');
          }}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition rounded-lg"
        >
          <Compass size={18} className="text-indigo-500" />
          <div className="text-left">
            <p className="font-medium">Revisit Getting Started Guide</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Reopen the onboarding walkthrough</p>
          </div>
        </button>

        {/* ── App version ── */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4 mb-6">
          Split-Sync v1.0.0
        </p>
      </div>

      {/* ── Delete Account Modal ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle size={24} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Delete Account</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4 text-sm text-red-700 dark:text-red-300">
              <p className="font-semibold mb-2">This will permanently:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Remove you from all shared groups</li>
                <li>Pass groups you own to another member</li>
                <li>Delete your personal trackers</li>
                <li>Erase your profile, notifications and payment details</li>
              </ul>
              <p className="text-xs mt-3 text-red-600 dark:text-red-400">
                You must settle all balances first. Expenses you shared with others stay in those groups under your name so their history remains correct.
              </p>
            </div>

            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm">
                {deleteError}
              </div>
            )}

            {isGoogleOnlyAccount ? (
              <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                You signed in with Google. You'll be asked to confirm with Google before your account is deleted.
              </p>
            ) : (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Enter your password to confirm
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Your password"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError(''); }}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading || (!isGoogleOnlyAccount && !deletePassword)}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      <QRCodeModal
        isOpen={showQRCode}
        onClose={() => setShowQRCode(false)}
        appUrl={process.env.REACT_APP_BASE_URL || window.location.origin}
      />
      <InfoHubModal
        isOpen={showInfoHub}
        onClose={() => setShowInfoHub(false)}
      />
    </div>
  );
}
