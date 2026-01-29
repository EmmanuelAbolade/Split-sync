// src/components/BottomNav.jsx
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Activity, Plus, User } from 'lucide-react';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { 
      id: 'home', 
      label: 'Home', 
      icon: Home, 
      path: '/dashboard',
      activeColor: 'text-primary'
    },
    { 
      id: 'activity', 
      label: 'Activity', 
      icon: Activity, 
      path: '/activity',
      activeColor: 'text-blue-600'
    },
    { 
      id: 'add', 
      label: 'Add', 
      icon: Plus, 
      path: '/add',
      activeColor: 'text-green-600',
      isSpecial: true
    },
    { 
      id: 'profile', 
      label: 'You', 
      icon: User, 
      path: '/profile',
      activeColor: 'text-purple-600'
    },
  ];

  const isActive = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/';
    }
    return location.pathname === path;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-card-3d z-40 safe-area-bottom">
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
                  onClick={() => navigate(tab.path)}
                  className="relative -mt-6"
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary-dark rounded-full flex items-center justify-center shadow-card-hover hover:shadow-card-3d transition-all duration-300 transform hover:scale-110 active:scale-95">
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
                    : 'hover:bg-gray-50'
                }`}
              >
                <Icon 
                  size={24} 
                  className={`transition-colors duration-300 ${
                    active ? tab.activeColor : 'text-gray-400'
                  }`}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span className={`text-xs font-medium transition-colors duration-300 ${
                  active ? tab.activeColor : 'text-gray-500'
                }`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
