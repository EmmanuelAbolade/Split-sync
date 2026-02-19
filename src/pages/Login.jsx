// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthStore } from '../stores/authStore';
import { Eye, EyeOff } from 'lucide-react';
import { isBiometricEnabledOnDevice, authenticateWithBiometric } from '../utils/biometric';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);

  // Email/Password Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Step 1: Authenticate with Firebase (email + password)
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      // Step 2: Check if user has biometric enabled
      const biometricEnabled = isBiometricEnabledOnDevice(result.user.uid);
      
      // Step 3: If biometric is enabled, require authentication
      if (biometricEnabled) {
        const authenticated = await authenticateWithBiometric(
          result.user.uid,
          'Verify your identity to login'
        );
        
        if (!authenticated) {
          // Biometric failed - sign out and show error
          await auth.signOut();
          setError('Biometric authentication required to login on this device');
          setLoading(false);
          return;
        }
      }
      
      // Step 4: All good - proceed to dashboard
      setUser(result.user);
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      if (err.code === 'auth/invalid-credential') {
        setError('Invalid email or password');
      } else if (err.code === 'auth/user-not-found') {
        setError('No account found with this email');
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password');
      } else {
        setError('Failed to login. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Google Sign-In
  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    try {
      console.log('🔵 Starting Google sign-in...');
      
      // Step 1: Sign in with Google
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      console.log('✓ Google auth successful');
      console.log('User:', user.uid, user.email);
      
      // Step 2: Check if user document exists in Firestore
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        console.log('⚠️ User document does NOT exist. Creating new user profile...');
        
        // NEW USER - Create user document with Google profile data
        await setDoc(userRef, {
          userId: user.uid,
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
          photoURL: user.photoURL || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          
          // Default settings
          defaultCurrency: 'EUR',
          allowContactSync: false,
          biometricEnabled: false,
          
          // Notification preferences
          notificationPreferences: {
            email: true,
            push: true,
            invitations: true,
            payments: true,
            expenses: true
          },
          
          // Payment methods (empty initially)
          paymentMethods: {},
          
          // Onboarding
          onboardingCompleted: false,
          
          // Status
          isActive: true,
          
          // Auth provider tracking
          authProvider: 'google'
        });
        
        console.log('✅ User document created successfully!');
        
      } else {
        console.log('✓ User document exists');
        
        // EXISTING USER - Update photo if Google has one and user hasn't uploaded custom
        const existingData = userDoc.data();
        
        if (user.photoURL && !existingData.customPhotoURL) {
          console.log('📸 Updating profile picture from Google...');
          await setDoc(userRef, {
            photoURL: user.photoURL,
            displayName: user.displayName || existingData.displayName,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
      }
      
      // Step 3: Check if user has biometric enabled
      const biometricEnabled = isBiometricEnabledOnDevice(user.uid);
      
      // Step 4: If biometric is enabled, require authentication
      if (biometricEnabled) {
        console.log('🔐 Biometric enabled, requesting authentication...');
        
        const authenticated = await authenticateWithBiometric(
          user.uid,
          'Verify your identity to login'
        );
        
        if (!authenticated) {
          console.log('❌ Biometric authentication failed');
          await auth.signOut();
          setError('Biometric authentication required to login on this device');
          setLoading(false);
          return;
        }
        
        console.log('✓ Biometric authentication successful');
      }
      
      // Step 5: All good - proceed to dashboard
      console.log('✅ Login complete, navigating to dashboard');
      setUser(user);
      navigate('/dashboard');
      
    } catch (err) {
      console.error('❌ Google sign-in error:', err);
      
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Pop-up blocked. Please allow pop-ups for this site.');
      } else {
        setError('Failed to sign in with Google. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-gray-900/50 p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex flex-col items-center mb-2">
            <img 
              src="/logo.png" 
              alt="Split-Sync Logo" 
              className="h-32 w-auto mb-4"
            />
          </div>
          <p className="text-gray-600 dark:text-gray-300 mt-2">Share expenses simply</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-3 rounded-lg mb-4 text-sm border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500 focus:border-transparent outline-none"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500 focus:border-transparent outline-none"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Remember & Forgot */}
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              <span className="text-gray-600 dark:text-gray-400">Remember me</span>
            </label>
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="text-sm text-primary dark:text-indigo-400 hover:underline"
            >
              Forgot Password?
            </button>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary dark:bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-hover dark:hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Logging in...' : 'LOGIN'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
          <span className="px-4 text-sm text-gray-500 dark:text-gray-400">OR</span>
          <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
        </div>

        {/* Google Sign-In */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-3 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        {/* Sign Up Link */}
        <p className="text-center mt-6 text-sm text-gray-600 dark:text-gray-400">
          Don't have an account?{' '}
          <button
            onClick={() => navigate('/register')}
            className="text-primary dark:text-indigo-400 font-semibold hover:underline"
          >
            Sign Up
          </button>
        </p>
      </div>
    </div>
  );
}