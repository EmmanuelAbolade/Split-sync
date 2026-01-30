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
import BottomNav from './components/BottomNav';
import ForgotPassword from './pages/ForgotPassword';

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
        {/* Public Routes */}
        <Route 
          path="/login" 
          element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} 
        />
        <Route 
          path="/register" 
          element={!isAuthenticated ? <Register /> : <Navigate to="/dashboard" />} 
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
          path="/forgot-password" 
          element={!isAuthenticated ? <ForgotPassword /> : <Navigate to="/dashboard" />} 
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