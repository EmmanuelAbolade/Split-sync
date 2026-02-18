// src/components/NotificationsDropdown.jsx
import { X, Check, Trash2, Bell, DollarSign, Receipt, Users, Gift } from 'lucide-react';
import { useNotificationsStore } from '../stores/notificationsStore';
import { useNavigate } from 'react-router-dom';

const NOTIFICATION_ICONS = {
  payment: DollarSign,
  expense: Receipt,
  settlement: DollarSign,
  invitation: Users,
  default: Bell,
};

export default function NotificationsDropdown({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotificationsStore();
  const user = notifications[0]?.userId; // Get userId from first notification

  const handleNotificationClick = (notification) => {
    // Mark as read
    if (!notification.read) {
      markAsRead(notification.id);
    }

    // Navigate based on type
    if (notification.data?.groupId) {
      navigate(`/group/${notification.data.groupId}`);
    }

    onClose();
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
      />

      {/* Dropdown */}
      <div className="fixed top-16 right-4 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-xl shadow-card-3d dark:shadow-gray-900/50 border border-gray-200 dark:border-gray-700 z-50 max-h-[80vh] flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Bell size={20} className="text-gray-700 dark:text-gray-300" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-primary dark:bg-indigo-600 text-white text-xs rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        {/* Actions */}
        {notifications.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead(user)}
                className="text-xs text-primary dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <Check size={14} />
                Mark all read
              </button>
            )}
            <button
              onClick={() => {
                if (window.confirm('Clear all notifications?')) {
                  clearAll(user);
                }
              }}
              className="text-xs text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 ml-auto"
            >
              <Trash2 size={14} />
              Clear all
            </button>
          </div>
        )}

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
                <Bell size={32} className="text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-1">
                No notifications yet
              </p>
              <p className="text-gray-500 dark:text-gray-500 text-xs text-center">
                You'll see notifications here when there's activity in your groups
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {notifications.map((notification) => {
                const Icon = NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.default;
                
                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 cursor-pointer transition-colors ${
                      notification.read
                        ? 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750'
                        : 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        notification.type === 'payment' ? 'bg-green-100 dark:bg-green-900/30' :
                        notification.type === 'expense' ? 'bg-blue-100 dark:bg-blue-900/30' :
                        notification.type === 'settlement' ? 'bg-orange-100 dark:bg-orange-900/30' :
                        notification.type === 'invitation' ? 'bg-purple-100 dark:bg-purple-900/30' :
                        'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        <Icon size={20} className={`${
                          notification.type === 'payment' ? 'text-green-600 dark:text-green-400' :
                          notification.type === 'expense' ? 'text-blue-600 dark:text-blue-400' :
                          notification.type === 'settlement' ? 'text-orange-600 dark:text-orange-400' :
                          notification.type === 'invitation' ? 'text-purple-600 dark:text-purple-400' :
                          'text-gray-600 dark:text-gray-400'
                        }`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium mb-1 ${
                          notification.read
                            ? 'text-gray-900 dark:text-white'
                            : 'text-gray-900 dark:text-white font-semibold'
                        }`}>
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {formatTime(notification.createdAt)}
                        </p>
                      </div>

                      {/* Unread indicator */}
                      {!notification.read && (
                        <div className="w-2 h-2 bg-primary dark:bg-indigo-500 rounded-full flex-shrink-0 mt-2" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}