// src/App.js
import { useNotificationsStore } from './stores/notificationsStore';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import { useAuthStore } from './stores/authStore';
import JoinGroup          from './pages/JoinGroup';
import Login              from './pages/Login';
import Register           from './pages/Register';
import Dashboard          from './pages/Dashboard';
import GroupDetails       from './pages/GroupDetails';
import Activity           from './pages/Activity';
import Analytics          from './pages/Analytics';
import Profile            from './pages/Profile';
import QuickAdd           from './pages/QuickAdd';
import BottomNav          from './components/BottomNav';
import ForgotPassword     from './pages/ForgotPassword';
import Settings           from './pages/Settings';
import SplitSyncChat      from './components/SplitSyncChat';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import SessionTimeoutWarning from './components/SessionTimeoutWarning';

// Layout wrapper for protected routes — renders bottom nav, session timeout, and AI chatbot
function ProtectedLayout({ children }) {
  const location = useLocation();
  const { user } = useAuthStore();
  const { subscribeToNotifications } = useNotificationsStore();

  // Subscribe to notifications at the app level — not just on Dashboard.
  // Ensures payment_log and other notifications update in real time
  // on any page, without needing a refresh.
  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = subscribeToNotifications(user.uid);
    return () => unsubscribe();
  }, [user?.uid, subscribeToNotifications]);
  
  // Session timeout hook — drives the auto-logout warning modal
  const {
    showWarning,
    countdown,
    stayLoggedIn,
    logoutNow,
  } = useSessionTimeout();

  // Hide bottom nav on group details and invite pages
  const hideBottomNav = location.pathname.startsWith('/group/') ||
                        location.pathname.startsWith('/invite/');

  return (
    <>
      {children}
      {!hideBottomNav && <BottomNav />}
      <SplitSyncChat />
      {/* Session timeout warning modal */}
      {showWarning && (
        <SessionTimeoutWarning
          countdown={countdown}
          onStayLoggedIn={stayLoggedIn}
          onLogout={logoutNow}
        />
      )}
    </>
  );
}

function App() {
  const { setUser, setLoading, isAuthenticated, loading } = useAuthStore();

  useEffect(() => {
    // Listen for Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, [setUser, setLoading]);

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>

        {/* Public routes */}
        <Route
          path="/login"
          element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/register"
          element={!isAuthenticated ? <Register /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/forgot-password"
          element={!isAuthenticated ? <ForgotPassword /> : <Navigate to="/dashboard" />}
        />

        {/* Protected routes with bottom nav, session timeout, and chatbot */}
        <Route
          path="/dashboard"
          element={
            isAuthenticated ? (
              <ProtectedLayout><Dashboard /></ProtectedLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/activity"
          element={
            isAuthenticated ? (
              <ProtectedLayout><Activity /></ProtectedLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/analytics"
          element={
            isAuthenticated ? (
              <ProtectedLayout><Analytics /></ProtectedLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/add"
          element={
            isAuthenticated ? (
              <ProtectedLayout><QuickAdd /></ProtectedLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/profile"
          element={
            isAuthenticated ? (
              <ProtectedLayout><Profile /></ProtectedLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/settings"
          element={
            isAuthenticated ? (
              <ProtectedLayout><Settings /></ProtectedLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* Group details - bottom nav hidden via ProtectedLayout logic */}
        <Route
          path="/group/:groupId"
          element={
            isAuthenticated ? (
              <ProtectedLayout><GroupDetails /></ProtectedLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/invite/:groupId"
          element={
            isAuthenticated ? (
              <ProtectedLayout><JoinGroup /></ProtectedLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* Default and 404 routes */}
        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />}
        />
        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />}
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
