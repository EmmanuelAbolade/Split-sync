// src/components/SessionTimeoutWarning.jsx
import { AlertTriangle, Clock } from 'lucide-react';

export default function SessionTimeoutWarning({ 
  isOpen, 
  countdown, 
  onStayLoggedIn, 
  onLogoutNow 
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-scale-in">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-card-3d dark:shadow-gray-900/50 animate-scale-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
            <AlertTriangle size={24} className="text-orange-600 dark:text-orange-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Session Timeout</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">You've been inactive</p>
          </div>
        </div>

        {/* Warning Message */}
        <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Clock size={20} className="text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-orange-900 dark:text-orange-200 font-medium mb-2">
                You will be automatically logged out in:
              </p>
              <div className="text-center">
                <p className="text-4xl font-bold text-orange-600 dark:text-orange-400 mb-1">
                  {countdown}
                </p>
                <p className="text-xs text-orange-700 dark:text-orange-300">
                  seconds
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
          This is a security feature to protect your account when you're away.
        </p>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onLogoutNow}
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            Logout Now
          </button>
          <button
            onClick={onStayLoggedIn}
            className="flex-1 px-4 py-3 bg-primary dark:bg-indigo-600 text-white rounded-lg hover:bg-primary-hover dark:hover:bg-indigo-700 transition font-medium"
          >
            Stay Logged In
          </button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
          You can change this setting in Settings → Security & Privacy
        </p>
      </div>
    </div>
  );
}