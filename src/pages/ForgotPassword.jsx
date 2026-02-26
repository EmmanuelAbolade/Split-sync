// src/pages/ForgotPassword.jsx
// Forgot Password page - handles email/password reset and Google account detection

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendPasswordResetEmail, fetchSignInMethodsForEmail } from 'firebase/auth';
import { auth } from '../services/firebase';
import { ArrowLeft, Mail, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);
  const [isGoogle, setIsGoogle] = useState(false);
  const navigate = useNavigate();

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setIsGoogle(false);
    setLoading(true);

    try {
      // Check which sign-in methods are linked to this email
      const methods = await fetchSignInMethodsForEmail(auth, email);

      // If the only method is Google, inform the user — no password to reset
      if (methods.length > 0 && methods.includes('google.com') && !methods.includes('password')) {
        setIsGoogle(true);
        setLoading(false);
        return;
      }

      // Send the reset email
      await sendPasswordResetEmail(auth, email);
      setSuccess(true);

    } catch (err) {
      console.error('Password reset error:', err);

      // Handle all relevant Firebase Auth error codes
      switch (err.code) {
        case 'auth/user-not-found':
        case 'auth/invalid-credential':
          // For security — don't reveal whether the email exists
          // Still show success to prevent email enumeration attacks
          setSuccess(true);
          break;
        case 'auth/invalid-email':
          setError('Please enter a valid email address.');
          break;
        case 'auth/too-many-requests':
          setError('Too many attempts. Please wait a few minutes and try again.');
          break;
        case 'auth/network-request-failed':
          setError('Network error. Please check your connection and try again.');
          break;
        default:
          setError('Failed to send reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Google Account Screen ────────────────────────────────────────────────

  if (isGoogle) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg dark:shadow-gray-900/50 p-8 text-center">
          {/* Google Icon */}
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Google Account Detected
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            The email <span className="font-semibold text-gray-900 dark:text-white">{email}</span> is linked to a Google account.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            You signed up using "Continue with Google". There is no password to reset — simply sign in with your Google account instead.
          </p>

          <button
            onClick={() => navigate('/login')}
            className="w-full bg-gradient-to-r from-primary to-primary-dark dark:from-indigo-600 dark:to-blue-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 mb-3"
          >
            Back to Login
          </button>
          <button
            onClick={() => { setIsGoogle(false); setEmail(''); }}
            className="w-full text-gray-500 dark:text-gray-400 py-2 text-sm hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            Try a different email
          </button>
        </div>
      </div>
    );
  }

  // ─── Success Screen ───────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg dark:shadow-gray-900/50 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Check Your Email
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            If an account exists for:
          </p>
          <p className="font-semibold text-gray-900 dark:text-white mb-4">{email}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            A password reset link has been sent. Click the link in the email to set a new password.
            If you don't see it within a few minutes, check your spam or junk folder.
          </p>

          <button
            onClick={() => navigate('/login')}
            className="w-full bg-gradient-to-r from-primary to-primary-dark dark:from-indigo-600 dark:to-blue-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 mb-3"
          >
            Back to Login
          </button>

          {/* Resend option */}
          <button
            onClick={() => { setSuccess(false); }}
            className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors py-2"
          >
            <RefreshCw size={14} />
            Didn't receive it? Send again
          </button>
        </div>
      </div>
    );
  }

  // ─── Main Form ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg dark:shadow-gray-900/50 p-8">

        {/* Back Button */}
        <button
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="text-sm font-medium">Back to Login</span>
        </button>

        {/* Header */}
        <div className="mb-8">
          <div className="w-12 h-12 bg-primary/10 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center mb-4">
            <Mail size={24} className="text-primary dark:text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Forgot Password?
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 p-3 rounded-xl mb-4 text-sm border border-red-200 dark:border-red-800">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                required
                autoFocus
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full bg-gradient-to-r from-primary to-primary-dark dark:from-indigo-600 dark:to-blue-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Sending...
              </span>
            ) : 'Send Reset Link'}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center mt-6 text-sm text-gray-500 dark:text-gray-400">
          Remember your password?{' '}
          <button
            onClick={() => navigate('/login')}
            className="text-primary dark:text-indigo-400 font-semibold hover:underline"
          >
            Log In
          </button>
        </p>
      </div>
    </div>
  );
}
