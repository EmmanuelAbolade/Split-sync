// src/App.js - WITH BOTTOM NAVIGATION
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import { useAuthStore } from './stores/authStore';
import JoinGroup from './pages/JoinGroup';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import GroupDetails from './pages/GroupDetails';
import Activity from './pages/Activity';
import Profile from './pages/Profile';
import QuickAdd from './pages/QuickAdd';
import Analytics      from './pages/Analytics';
import BottomNav from './components/BottomNav';
import ForgotPassword from './pages/ForgotPassword';
import Settings from './pages/Settings';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import SessionTimeoutWarning from './components/SessionTimeoutWarning';

// Layout wrapper for protected routes with bottom nav
function ProtectedLayout({ children }) {
  const location = useLocation();
  
  // Hide bottom nav on group details and invite pages
  const hideBottomNav = location.pathname.startsWith('/group/') || 
                       location.pathname.startsWith('/invite/');
  
  return (
    <>
      {children}
      {!hideBottomNav && <BottomNav />}
    </>
  );
}

function App() {
  const { setUser, setLoading, isAuthenticated, loading } = useAuthStore();


  // Session timeout hook
  const {
    showWarning,
    countdown,
    stayLoggedIn,
    logoutNow,
  } = useSessionTimeout();

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, [setUser, setLoading]);

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary to-primary-dark dark:from-indigo-900 dark:to-blue-900 flex items-center justify-center">
        <div className="text-center">
          {/* Logo */}
          <img 
            src="/logo.png" 
            alt="Split-Sync" 
            className="h-32 w-auto mx-auto mb-8 animate-pulse"
          />
          {/* Loading Spinner */}
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-white">Loading Split-Sync...</p>
        </div>
      </div>
    );
  }

  // Helper — wraps a page in ProtectedLayout, redirects to /login if not authed
  const Protected = ({ element }) =>
    isAuthenticated ? (
      <ProtectedLayout>{element}</ProtectedLayout>
    ) : (
      <Navigate to="/login" />
    );

  return (
    <BrowserRouter>
      {/* Session Timeout Warning Modal */}
      <SessionTimeoutWarning
        isOpen={showWarning}
        countdown={countdown}
        onStayLoggedIn={stayLoggedIn}
        onLogoutNow={logoutNow}
      />
      <Routes>
        {/* Public Routes */}
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

        {/* Protected Routes with Bottom Nav */}
        <Route 
          path="/dashboard" 
          element={
            isAuthenticated ? (
              <ProtectedLayout>
                <Dashboard />
              </ProtectedLayout>
            ) : (
              <Navigate to="/login" />
            )
          } 
        />

        <Route 
          path="/analytics" 
          element={
            isAuthenticated ? (
              <ProtectedLayout>
                <Analytics />
              </ProtectedLayout>
            ) : (
              <Navigate to="/login" />
            )
          } 
        />
        
        <Route 
          path="/activity" 
          element={
            isAuthenticated ? (
              <ProtectedLayout>
                <Activity />
              </ProtectedLayout>
            ) : (
              <Navigate to="/login" />
            )
          } 
        />

        <Route 
          path="/settings" 
          element={
            isAuthenticated ? (
              <ProtectedLayout>
                <Settings />
              </ProtectedLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        
        <Route 
          path="/add" 
          element={
            isAuthenticated ? (
              <ProtectedLayout>
                <QuickAdd />
              </ProtectedLayout>
            ) : (
              <Navigate to="/login" />
            )
          } 
        />
        
        <Route 
          path="/profile" 
          element={
            isAuthenticated ? (
              <ProtectedLayout>
                <Profile />
              </ProtectedLayout>
            ) : (
              <Navigate to="/login" />
            )
          } 
        />

        {/* Group details - no bottom nav */}
        <Route 
          path="/group/:groupId" 
          element={
            isAuthenticated ? (
              <ProtectedLayout>
                <GroupDetails />
              </ProtectedLayout>
            ) : (
              <Navigate to="/login" />
            )
          } 
        />

        <Route 
          path="/invite/:groupId" 
          element={
            isAuthenticated ? (
              <ProtectedLayout>
                <JoinGroup />
              </ProtectedLayout>
            ) : (
              <Navigate to="/login" />
            )
          } 
        />

        {/* Default Route */}
        <Route 
          path="/" 
          element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} 
        />

        {/* 404 - Catch all */}
        <Route 
          path="*" 
          element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;