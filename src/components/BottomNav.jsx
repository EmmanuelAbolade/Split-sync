// src/components/BottomNav.jsx
// Bottom navigation bar — Home, Activity, Add (FAB), Analytics, Profile
// With circlesEnabled on, the centre + opens the action sheet (one action per
// space) and Home stays highlighted inside any space. Off: exactly as before.
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ActionSheet from './ActionSheet';
import useSpaces from '../hooks/useSpaces';
import { Home, Activity, Plus, User, BarChart2 } from 'lucide-react';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { circlesOn } = useSpaces();
  const [sheetOpen, setSheetOpen] = useState(false);

  const tabs = [
    { 
      id: 'home', 
      label: 'Home', 
      icon: Home, 
      path: '/dashboard',
      activeColor: 'text-primary dark:text-indigo-400'
    },
    { 
      id: 'activity', 
      label: 'Activity', 
      icon: Activity, 
      path: '/activity',
      activeColor: 'text-blue-600 dark:text-blue-400'
    },
    { 
      id: 'add', 
      label: 'Add', 
      icon: Plus, 
      path: '/add',
      activeColor: 'text-green-600 dark:text-green-400',
      isSpecial: true
    },
    {
      id:          'analytics',
      label:       'Stats',
      icon:        BarChart2,
      path:        '/analytics',
      activeColor: 'text-amber-500 dark:text-amber-400',
    },
    { 
      id: 'profile', 
      label: 'You', 
      icon: User, 
      path: '/profile',
      activeColor: 'text-purple-600 dark:text-purple-400'
    },
  ];

  const isActive = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/' ||
        (circlesOn && location.pathname.startsWith('/spaces/'));
    }
    return location.pathname === path;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-card-3d dark:shadow-gray-900/50 z-40 safe-area-bottom">
      <div className="max-w-7xl mx-auto px-2 py-2">
        <div className="flex items-center justify-around">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.path);

            if (tab.isSpecial) {
              // Special "Add" button with floating style
              return (
                <button
                  key={tab.id}
                  onClick={() => (circlesOn ? setSheetOpen(true) : navigate(tab.path))}
                  className="relative -mt-6"
                  aria-label={circlesOn ? 'Create' : 'Add expense'}
                  aria-haspopup={circlesOn ? 'dialog' : undefined}
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary-dark dark:from-indigo-600 dark:to-blue-600 rounded-full flex items-center justify-center shadow-card-hover hover:shadow-card-3d dark:shadow-gray-900/50 transition-all duration-300 transform hover:scale-110 active:scale-95">
                    <Icon size={24} className="text-white" strokeWidth={2.5} />
                  </div>
                </button>
              );
            }


            

            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)}
                className={`flex flex-col items-center gap-1 py-2 px-4 rounded-lg transition-all duration-300 ${
                  active 
                    ? 'transform scale-105' 
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                aria-label={tab.label}
              >
                <Icon 
                  size={24} 
                  className={`transition-colors duration-300 ${
                    active ? tab.activeColor : 'text-gray-400 dark:text-gray-500'
                  }`}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span className={`text-xs font-medium transition-colors duration-300 ${
                  active ? tab.activeColor : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {circlesOn ? <ActionSheet open={sheetOpen} onClose={() => setSheetOpen(false)} /> : null}
    </nav>
  );
}
