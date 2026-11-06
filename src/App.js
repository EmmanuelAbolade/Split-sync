// src/App.js
import { useNotificationsStore } from './stores/notificationsStore';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './services/firebase';
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
import Taskmaster from './pages/Taskmaster';
import { rememberRedirect, peekRedirect, clearRedirect } from './utils/postAuthRedirect';
import Hub from './pages/Hub';
import ExpensesSpace from './pages/spaces/ExpensesSpace';
import SpaceHome from './pages/spaces/SpaceHome';
import useSpaces from './hooks/useSpaces';
import { getSpace } from './config/spaces';
import { forgetExpensesHome } from './utils/spaceNav';

function PageSpinner() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center" role="status" aria-label="Loading">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
    </div>
  );
}

// /dashboard: the Hub when circlesEnabled is on for this user, otherwise
// today's Dashboard exactly as before (the kill switch, 05-sitemap §3).
function HomeRoute() {
  const { loading, circlesOn } = useSpaces();
  useEffect(() => { if (!loading && !circlesOn) forgetExpensesHome(); }, [loading, circlesOn]);
  if (loading) return <PageSpinner />;
  return circlesOn ? <Hub /> : <Dashboard />;
}

// /spaces/:spaceId: a space's entry page. Unknown or switched-off spaces, and
// everything while circlesEnabled is off, go back to /dashboard.
function SpaceRoute() {
  const { spaceId } = useParams();
  const { loading, circlesOn, isSpaceOn } = useSpaces();
  if (loading) return <PageSpinner />;
  if (!circlesOn || !isSpaceOn(spaceId)) return <Navigate to="/dashboard" replace />;
  if (spaceId === 'expenses') return <ExpensesSpace />;
  return <SpaceHome space={getSpace(spaceId)} />;
}

// Sends a signed-out visitor to /login, remembering the page they were trying
// to open (for example an invite link) so they return to it after signing in.
// rememberRedirect is idempotent, so calling it during render is safe.
function LoginRedirect() {
  const location = useLocation();
  rememberRedirect(location.pathname + location.search);
  return <Navigate to="/login" replace />;
}

// Used on the auth pages once the user is signed in: go to the remembered
// page if there is one, otherwise the dashboard.
function AfterAuthRedirect() {
  return <Navigate to={peekRedirect()} replace />;
}

// Layout wrapper for protected routes — renders bottom nav, session timeout, and AI chatbot
function ProtectedLayout({ children }) {
  const location = useLocation();
  const { user } = useAuthStore();
  const { subscribeToNotifications } = useNotificationsStore();

  // The user is inside the app now, so any remembered post-sign-in target
  // has been used (or is no longer wanted).
  useEffect(() => { clearRedirect(); }, []);

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
      <SessionTimeoutWarning
        isOpen={showWarning}
        countdown={countdown}
        onStayLoggedIn={stayLoggedIn}
        onLogoutNow={logoutNow}
      />
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

      // Accounts suspended by an admin (users/{uid}.isActive === false) are
      // signed out. Firestore rules also block their writes server-side.
      if (user) {
        getDoc(doc(db, 'users', user.uid))
          .then(snap => {
            if (snap.exists() && snap.data().isActive === false) {
              try { sessionStorage.setItem('accountSuspended', '1'); } catch { /* ignore */ }
              signOut(auth);
              return;
            }
            // Record activity for the admin "Active (7 days)" stat — once per day per device
            const today = new Date().toISOString().slice(0, 10);
            let last = null;
            try { last = localStorage.getItem(`lastActive:${user.uid}`); } catch { /* ignore */ }
            if (snap.exists() && last !== today) {
              updateDoc(doc(db, 'users', user.uid), { lastActive: serverTimestamp() })
                .then(() => { try { localStorage.setItem(`lastActive:${user.uid}`, today); } catch { /* ignore */ } })
                .catch(() => { /* non-critical */ });
            }
          })
          .catch(() => { /* non-blocking — never stop sign-in on a lookup failure */ });
      }
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
          element={!isAuthenticated ? <Login /> : <AfterAuthRedirect />}
        />
        <Route
          path="/register"
          element={!isAuthenticated ? <Register /> : <AfterAuthRedirect />}
        />
        <Route
          path="/forgot-password"
          element={!isAuthenticated ? <ForgotPassword /> : <AfterAuthRedirect />}
        />

        {/* Protected routes with bottom nav, session timeout, and chatbot */}
        <Route
          path="/dashboard"
          element={
            isAuthenticated ? (
              <ProtectedLayout><HomeRoute /></ProtectedLayout>
            ) : (
              <LoginRedirect />
            )
          }
        />

        <Route
          path="/activity"
          element={
            isAuthenticated ? (
              <ProtectedLayout><Activity /></ProtectedLayout>
            ) : (
              <LoginRedirect />
            )
          }
        />

        <Route
          path="/analytics"
          element={
            isAuthenticated ? (
              <ProtectedLayout><Analytics /></ProtectedLayout>
            ) : (
              <LoginRedirect />
            )
          }
        />

        <Route
          path="/add"
          element={
            isAuthenticated ? (
              <ProtectedLayout><QuickAdd /></ProtectedLayout>
            ) : (
              <LoginRedirect />
            )
          }
        />

        <Route
          path="/profile"
          element={
            isAuthenticated ? (
              <ProtectedLayout><Profile /></ProtectedLayout>
            ) : (
              <LoginRedirect />
            )
          }
        />

        <Route
          path="/settings"
          element={
            isAuthenticated ? (
              <ProtectedLayout><Settings /></ProtectedLayout>
            ) : (
              <LoginRedirect />
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
              <LoginRedirect />
            )
          }
        />

        <Route
          path="/invite/:groupId"
          element={
            isAuthenticated ? (
              <ProtectedLayout><JoinGroup /></ProtectedLayout>
            ) : (
              <LoginRedirect />
            )
          }
        />

        <Route
          path="/spaces/:spaceId"
          element={
            isAuthenticated ? (
              <ProtectedLayout><SpaceRoute /></ProtectedLayout>
            ) : (
              <LoginRedirect />
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
        <Route
        path="/taskmaster"
        element={isAuthenticated ? <Taskmaster /> : <LoginRedirect />}
      />

      </Routes>
      
    </BrowserRouter>
  );
}

export default App;