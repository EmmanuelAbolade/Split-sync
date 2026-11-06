// src/components/AppTopBar.jsx
// The app's top bar, shared by Home (Dashboard or Hub) and the space pages:
// logo (opens Taskmaster for admins), the user's name, notifications,
// Settings and Logout, exactly as on the original Dashboard.
// With circlesEnabled on it also sticks to the top and adds a Spaces menu
// for quick access to every enabled space.
//
// Callers that already manage the bell, admin check or logout (Dashboard)
// pass them in; otherwise the bar manages them itself.

import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { Bell, Settings, LayoutGrid, ChevronDown, Home as HomeIcon, Check } from 'lucide-react';
import { auth } from '../services/firebase';
import { useAuthStore } from '../stores/authStore';
import { useNotificationsStore } from '../stores/notificationsStore';
import NotificationsDropdown from './NotificationsDropdown';
import useSpaces from '../hooks/useSpaces';
import { spaceOfPath } from '../config/spaces';
import { spaceStyle, SpaceIcon } from './hub/spaceStyle';

function SpacesMenu({ spaces }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const here = location.pathname.startsWith('/spaces/') ? spaceOfPath(location.pathname) : null;
  const current = spaces.find((s) => s.id === here);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const go = (to) => { setOpen(false); navigate(to); };
  const item = (key, label, icon, to, active, cls = '') => (
    <li key={key}>
      <button
        type="button"
        role="menuitem"
        onClick={() => go(to)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100"
      >
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${cls}`}>{icon}</span>
        <span className="flex-1">{label}</span>
        {active ? <Check size={16} className="text-blue-600" aria-label="Current" /> : null}
      </button>
    </li>
  );

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 min-h-[40px] px-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-[0.97] transition"
      >
        {current ? <SpaceIcon space={current} size={16} /> : <LayoutGrid size={16} aria-hidden="true" />}
        <span className="hidden sm:inline">{current ? current.name : 'Spaces'}</span>
        <span className="sr-only sm:hidden">{current ? current.name : 'Spaces'}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? (
        <ul role="menu" aria-label="Spaces" className="absolute right-0 mt-2 w-60 py-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-card-3d z-50 animate-fade-in">
          {item('home', 'Home', <HomeIcon size={16} aria-hidden="true" />, '/dashboard', location.pathname === '/dashboard', 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200')}
          {spaces.map((s) => item(s.id, s.name, <SpaceIcon space={s} size={16} />, s.route, s.id === here, spaceStyle(s).soft))}
        </ul>
      ) : null}
    </div>
  );
}

export default function AppTopBar({ isAdmin: isAdminProp, unreadCount: unreadProp, onBell, onLogout }) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { unreadCount: storeUnread } = useNotificationsStore();
  const { circlesOn, spaces } = useSpaces();
  const [ownAdmin, setOwnAdmin] = useState(false);
  const [ownNotifications, setOwnNotifications] = useState(false);

  const managesAdmin = isAdminProp === undefined;
  useEffect(() => {
    if (!managesAdmin || !auth.currentUser) return;
    auth.currentUser.getIdTokenResult(true)
      .then((t) => setOwnAdmin(t.claims.admin === true))
      .catch(() => setOwnAdmin(false));
  }, [managesAdmin]);

  const isAdmin = managesAdmin ? ownAdmin : isAdminProp;
  const unreadCount = unreadProp === undefined ? storeUnread : unreadProp;
  const bell = onBell || (() => setOwnNotifications((v) => !v));
  const handleLogout = onLogout || (async () => {
    try {
      await signOut(auth);
      logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err?.code);
    }
  });

  return (
    <div className={`bg-white dark:bg-gray-800 shadow ${circlesOn ? 'sticky top-0 z-40' : ''}`}>
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center gap-3">
        <img
          src="/logo.png"
          alt="Split-Sync"
          className="h-10 w-auto cursor-pointer"
          onClick={() => (isAdmin ? navigate('/taskmaster') : navigate('/dashboard'))}
          title={isAdmin ? 'Open Taskmaster' : 'Go to dashboard'}
        />
        <div className="flex items-center gap-4">
          {circlesOn ? <SpacesMenu spaces={spaces} /> : null}
          <span className={`text-sm text-gray-600 dark:text-gray-300 ${circlesOn ? 'hidden sm:inline' : ''}`}>
            {user?.displayName || user?.email}
          </span>
          <button
            onClick={bell}
            aria-label="Notifications"
            className="relative text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
          >
            <Bell size={24} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => navigate('/settings')}
            aria-label="Settings"
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            <Settings size={24} />
          </button>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium"
          >
            Logout
          </button>
        </div>
      </div>
      {onBell ? null : <NotificationsDropdown isOpen={ownNotifications} onClose={() => setOwnNotifications(false)} />}
    </div>
  );
}
