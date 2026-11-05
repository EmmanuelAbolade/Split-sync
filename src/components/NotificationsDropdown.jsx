// src/components/NotificationsDropdown.jsx
import { useState } from 'react';
import { X, Check, Trash2, Bell, DollarSign, Receipt, Users, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { useNotificationsStore, confirmPaymentReceived, declinePaymentReceived } from '../stores/notificationsStore';
import { useNavigate } from 'react-router-dom';
import useStepUp from '../hooks/useStepUp';
import { confirmParams, settlementErrorMessage } from '../utils/settlements';

const NOTIFICATION_ICONS = {
  payment: DollarSign,
  expense: Receipt,
  settlement: DollarSign,
  invitation: Users,
  payment_confirmation_needed: AlertCircle,
  payment_confirmed: CheckCircle2,
  payment_declined: XCircle,
  payment_log: DollarSign,
  default: Bell,
};

export default function NotificationsDropdown({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotificationsStore();

  // Per-notification loading, error, and done state
  const [actionLoading, setActionLoading] = useState({});
  const [actionError, setActionError] = useState({});
  const [actionDone, setActionDone] = useState({});
  const { requestStepUp, stepUpSheet } = useStepUp();

  const handleNotificationClick = (notification) => {
    // Do not navigate on action-required notifications — buttons handle those
    if (notification.requiresAction) return;
    if (!notification.read) markAsRead(notification.id);
    if (notification.data?.groupId) {
      navigate(`/group/${notification.data.groupId}`);
    }
    onClose();
  };

  // Payee confirms they received the payment. This changes balances, so the
  // server needs a "Confirm it's you" token bound to this notification.
  // notification.id IS the payeeNotifId that confirmPaymentReceived expects.
  const handleConfirmPayment = async (e, notification) => {
    e.stopPropagation();
    setActionError(prev => ({ ...prev, [notification.id]: null }));
    setActionLoading(prev => ({ ...prev, [notification.id]: 'confirming' }));
    try {
      const token = await requestStepUp('settlements.confirm', confirmParams(notification.id));
      if (!token) return; // cancelled
      await confirmPaymentReceived(notification.id, token);
      setActionDone(prev => ({ ...prev, [notification.id]: 'confirmed' }));
    } catch (err) {
      const msg = settlementErrorMessage(err, 'Failed to confirm. Please try again.');
      setActionError(prev => ({ ...prev, [notification.id]: msg }));
    } finally {
      setActionLoading(prev => ({ ...prev, [notification.id]: null }));
    }
  };

  // Payee declines — balance unchanged, payer is notified to retry.
  const handleDeclinePayment = async (e, notification) => {
    e.stopPropagation();
    setActionError(prev => ({ ...prev, [notification.id]: null }));
    setActionLoading(prev => ({ ...prev, [notification.id]: 'declining' }));
    try {
      await declinePaymentReceived(notification.id);
      setActionDone(prev => ({ ...prev, [notification.id]: 'declined' }));
    } catch (err) {
      const msg = settlementErrorMessage(err, 'Failed to decline. Please try again.');
      setActionError(prev => ({ ...prev, [notification.id]: msg }));
    } finally {
      setActionLoading(prev => ({ ...prev, [notification.id]: null }));
    }
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
      {/* Backdrop — sits behind the dropdown, closes on click */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Dropdown panel */}
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
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        {/* Bulk actions */}
        {notifications.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="text-xs text-primary dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <Check size={14} />
                Mark all read
              </button>
            )}
            <button
              onClick={() => { if (window.confirm('Clear all notifications?')) clearAll(); }}
              className="text-xs text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 ml-auto"
            >
              <Trash2 size={14} />
              Clear all
            </button>
          </div>
        )}

        {/* Notifications list */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
                <Bell size={32} className="text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-1">No notifications yet</p>
              <p className="text-gray-500 dark:text-gray-500 text-xs text-center">
                You will see notifications here when there is activity in your groups.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {notifications.map((notification) => {
                const Icon = NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.default;

                // Show action buttons only while requiresAction is true AND user has not
                // yet actioned it in this session. The Firestore update will eventually
                // remove requiresAction, hiding the buttons permanently.
                const isActionable = notification.requiresAction === true && !actionDone[notification.id];
                const loadingState = actionLoading[notification.id];
                const errorMsg = actionError[notification.id];
                const doneState = actionDone[notification.id];

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 transition-colors ${
                      isActionable ? 'cursor-default' : 'cursor-pointer'
                    } ${
                      notification.read
                        ? 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750'
                        : notification.type === 'payment_confirmation_needed'
                          ? 'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                          : 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Notification icon */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        notification.type === 'payment_confirmation_needed' ? 'bg-amber-100 dark:bg-amber-900/30' :
                        notification.type === 'payment_confirmed'           ? 'bg-green-100 dark:bg-green-900/30' :
                        notification.type === 'payment_declined'            ? 'bg-red-100 dark:bg-red-900/30' :
                        notification.type === 'expense'                     ? 'bg-blue-100 dark:bg-blue-900/30' :
                        notification.type === 'settlement'                  ? 'bg-orange-100 dark:bg-orange-900/30' :
                        notification.type === 'invitation'                  ? 'bg-purple-100 dark:bg-purple-900/30' :
                        'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        <Icon size={20} className={`${
                          notification.type === 'payment_confirmation_needed' ? 'text-amber-600 dark:text-amber-400' :
                          notification.type === 'payment_confirmed'           ? 'text-green-600 dark:text-green-400' :
                          notification.type === 'payment_declined'            ? 'text-red-600 dark:text-red-400' :
                          notification.type === 'expense'                     ? 'text-blue-600 dark:text-blue-400' :
                          notification.type === 'settlement'                  ? 'text-orange-600 dark:text-orange-400' :
                          notification.type === 'invitation'                  ? 'text-purple-600 dark:text-purple-400' :
                          'text-gray-500 dark:text-gray-400'
                        }`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold mb-0.5 ${
                          notification.type === 'payment_confirmation_needed'
                            ? 'text-amber-800 dark:text-amber-200'
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">
                          {formatTime(notification.createdAt)}
                        </p>

                        {/* Inline success feedback — shown immediately after action */}
                        {doneState === 'confirmed' && (
                          <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 font-medium mt-1">
                            <CheckCircle2 size={13} />
                            Payment confirmed. Balance updated.
                          </div>
                        )}
                        {doneState === 'declined' && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-1">
                            <XCircle size={13} />
                            Marked as not received. Payer has been notified.
                          </div>
                        )}

                        {/* Inline error feedback — shown when Firestore operation fails */}
                        {errorMsg && (
                          <div className="flex items-start gap-1.5 mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <AlertCircle size={13} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-red-700 dark:text-red-300">{errorMsg}</p>
                          </div>
                        )}

                        {/* Action buttons — visible only while payment is pending confirmation */}
                        {isActionable && (
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={(e) => handleConfirmPayment(e, notification)}
                              disabled={!!loadingState}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 dark:bg-green-700 text-white text-xs font-medium rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition disabled:opacity-60"
                            >
                              {loadingState === 'confirming'
                                ? <Clock size={13} className="animate-spin" />
                                : <CheckCircle2 size={13} />}
                              {loadingState === 'confirming' ? 'Confirming...' : 'Confirm Received'}
                            </button>
                            <button
                              onClick={(e) => handleDeclinePayment(e, notification)}
                              disabled={!!loadingState}
                              className="flex items-center gap-1.5 px-3 py-1.5 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 text-xs font-medium rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition disabled:opacity-60"
                            >
                              {loadingState === 'declining'
                                ? <Clock size={13} className="animate-spin" />
                                : <XCircle size={13} />}
                              {loadingState === 'declining' ? 'Declining...' : 'Did Not Receive'}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Unread dot */}
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
      {stepUpSheet}
    </>
  );
}
