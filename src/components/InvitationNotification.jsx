// src/components/InvitationNotification.jsx
// Displays pending group invitations with accept/decline actions

import { useState, useEffect } from 'react';
import { getMyInvitations, acceptInvitation, declineInvitation } from '../utils/invitationSystem';
import { Users, Check, X, Clock, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function InvitationNotification({ user, onInvitationUpdate }) {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const navigate = useNavigate();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (user) {
      loadInvitations();
      
      // Poll for new invitations every 30 seconds
      const interval = setInterval(loadInvitations, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadInvitations = async () => {
    if (!user) return;

    try {
      const userInvitations = await getMyInvitations(user.uid);
      setInvitations(userInvitations);
      
      // Notify parent of invitation count
      if (onInvitationUpdate) {
        onInvitationUpdate(userInvitations.length);
      }
    } catch (error) {
      console.error('Error loading invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (invitation) => {
    setProcessingId(invitation.id);

    try {
      const result = await acceptInvitation(invitation.id, user.uid);
      
      if (result.success) {
        // Remove from list
        setInvitations(invitations.filter(inv => inv.id !== invitation.id));
        
        // Show success message
        alert(`✅ You've joined ${invitation.groupName}!`);
        
        // Navigate to the group
        navigate(`/groups/${result.groupId}`);
        
        // Update parent
        if (onInvitationUpdate) {
          onInvitationUpdate(invitations.length - 1);
        }
      } else {
        alert(`❌ ${result.message}`);
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      alert('❌ Failed to accept invitation. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invitation) => {
    setProcessingId(invitation.id);

    try {
      const result = await declineInvitation(invitation.id, user.uid);
      
      if (result.success) {
        // Remove from list
        setInvitations(invitations.filter(inv => inv.id !== invitation.id));
        
        // Update parent
        if (onInvitationUpdate) {
          onInvitationUpdate(invitations.length - 1);
        }
      } else {
        alert(`❌ ${result.message}`);
      }
    } catch (error) {
      console.error('Error declining invitation:', error);
      alert('❌ Failed to decline invitation. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return 'Just now';
    
    const now = Date.now();
    const createdAt = timestamp.toMillis ? timestamp.toMillis() : timestamp;
    const diffMs = now - createdAt;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return `${Math.floor(diffDays / 7)}w ago`;
  };

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (invitations.length === 0) {
    return null; // Don't show if no invitations
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card dark:shadow-gray-900/50 border border-indigo-200 dark:border-indigo-800 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 px-4 py-3 border-b border-indigo-200 dark:border-indigo-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 dark:bg-indigo-500 rounded-full flex items-center justify-center">
              <Bell size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Group Invitations
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {invitations.length} pending
              </p>
            </div>
          </div>
          <span className="bg-indigo-600 dark:bg-indigo-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            {invitations.length}
          </span>
        </div>
      </div>

      {/* Invitation List */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {invitations.map((invitation) => {
          const isProcessing = processingId === invitation.id;

          return (
            <div
              key={invitation.id}
              className="p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition"
            >
              <div className="flex items-start gap-3">
                {/* Sender Photo */}
                {invitation.fromUserPhoto ? (
                  <img
                    src={invitation.fromUserPhoto}
                    alt={invitation.fromUserName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                    {invitation.fromUserName.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Message */}
                  <p className="text-sm text-gray-900 dark:text-white mb-1">
                    <span className="font-semibold">{invitation.fromUserName}</span>
                    {' invited you to join'}
                  </p>

                  {/* Group Name */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center gap-1.5 bg-indigo-100 dark:bg-indigo-900/30 px-2 py-1 rounded-lg">
                      <Users size={14} className="text-indigo-600 dark:text-indigo-400" />
                      <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
                        {invitation.groupName}
                      </span>
                    </div>
                  </div>

                  {/* Time */}
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-3">
                    <Clock size={12} />
                    <span>{getTimeAgo(invitation.createdAt)}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(invitation)}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 dark:bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      <Check size={16} />
                      <span>{isProcessing ? 'Accepting...' : 'Accept'}</span>
                    </button>

                    <button
                      onClick={() => handleDecline(invitation)}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      <X size={16} />
                      <span>{isProcessing ? 'Declining...' : 'Decline'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
