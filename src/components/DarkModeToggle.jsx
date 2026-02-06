// src/components/DarkModeToggle.jsx
import { Moon, Sun } from 'lucide-react';
import { useDarkMode } from '../contexts/DarkModeContext';

export default function DarkModeToggle() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <button
      onClick={toggleDarkMode}
      className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg shadow-card hover:shadow-card-hover transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          isDarkMode 
            ? 'bg-indigo-900 dark:bg-indigo-600' 
            : 'bg-yellow-100'
        }`}>
          {isDarkMode ? (
            <Moon size={20} className="text-indigo-100" />
          ) : (
            <Sun size={20} className="text-yellow-600" />
          )}
        </div>
        <div className="text-left">
          <p className="font-medium text-gray-900 dark:text-white">
            Dark Mode
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isDarkMode ? 'Enabled' : 'Disabled'}
          </p>
        </div>
      </div>
      
      {/* Toggle Switch */}
      <div className={`relative w-14 h-8 rounded-full transition-colors ${
        isDarkMode ? 'bg-indigo-600' : 'bg-gray-300'
      }`}>
        <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
          isDarkMode ? 'translate-x-6' : 'translate-x-0'
        }`} />
      </div>
    </button>
  );
}
