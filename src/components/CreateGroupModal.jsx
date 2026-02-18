// src/components/CreateGroupModal.jsx
import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuthStore } from '../stores/authStore';
import IconSelector from './IconSelector';

// IMPORTS - ADDED FOR QUICK ADD & CONTACT SYNC
import QuickAddMembers from './QuickAddMembers';
import ContactSyncButton from './ContactSyncButton';
import { sendBulkInvitations } from '../utils/invitationSystem';
import { updateGroupConnections } from '../utils/userConnectionsManager';
import { Users, X } from 'lucide-react';

export default function CreateGroupModal({ isOpen, onClose, onGroupCreated }) {
  const [groupName, setGroupName] = useState('');
  const [icon, setIcon] = useState('home');
  const [currency, setCurrency] = useState('EUR');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // STATE - ADDED FOR QUICK ADD & CONTACT SYNC
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  
  const { user } = useAuthStore();

  const currencies = [
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
  ];

  // HANDLER - Handle adding members from Quick Add
  const handleQuickAddMembers = (selectedConnections) => {
    // Store pending invitations (will send after group is created)
    const invites = selectedConnections.map(conn => ({
      userId: conn.userId,
      name: conn.name,
      email: conn.email,
      photoURL: conn.photoURL
    }));
    
    setPendingInvitations(prev => [...prev, ...invites]);
    setShowQuickAdd(false);
    
    // Show success message
    alert(`✅ ${selectedConnections.length} member(s) will be invited when you create the group`);
  };

  // HANDLER - Handle adding members from Contact Sync
  const handleContactSyncMembers = (selectedUsers) => {
    // Store pending invitations
    const invites = selectedUsers.map(user => ({
      userId: user.userId,
      name: user.name,
      email: user.email,
      photoURL: user.photoURL
    }));
    
    setPendingInvitations(prev => [...prev, ...invites]);
    
    // Show success message
    alert(`✅ ${selectedUsers.length} member(s) will be invited when you create the group`);
  };


  // HANDLER - Remove pending invitation
  const removePendingInvitation = (userId) => {
    setPendingInvitations(prev => prev.filter(inv => inv.userId !== userId));
  };

  // Modified handleSubmit with connection tracking & invitations
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const groupData = {
        name: groupName.trim(),
        icon,
        currency,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        memberIds: [user.uid],
        members: [
          {
            userId: user.uid,
            name: user.displayName || user.email,
            email: user.email,
            role: 'owner',
            joinedAt: new Date(),
          }
        ],
      };

      const docRef = await addDoc(collection(db, 'groups'), groupData);
      
      // Track connections and send invitations
      try {
        // 1. Track connections between creator and any initial members
        const allMemberIds = [user.uid];
        if (allMemberIds.length > 1) {
          await updateGroupConnections(docRef.id, groupName.trim(), allMemberIds);
        }

        // 2. Send invitations to Quick Add / Contact Finder members
        if (pendingInvitations.length > 0) {
          const inviteUserIds = pendingInvitations.map(inv => inv.userId);
          const result = await sendBulkInvitations(
            user,
            inviteUserIds,
            docRef.id,
            groupName.trim()
          );
          
          console.log(`✅ Sent ${result.successful.length} invitations`);
          
          if (result.failed.length > 0) {
            console.log(`❌ Failed to send ${result.failed.length} invitations`);
          }
          
          // Clear pending invitations
          setPendingInvitations([]);
        }
      } catch (inviteError) {
        console.error('Error with invitations:', inviteError);
        // Don't fail group creation if invitations fail
      }
      
      
      // Reset form
      setGroupName('');
      setIcon('home');
      setCurrency('EUR');
      setShowQuickAdd(false);
      
      if (onGroupCreated) {
        onGroupCreated(docRef.id);
      }
      
      onClose();
    } catch (err) {
      console.error('Error creating group:', err);
      setError('Failed to create group. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // HANDLER - Handle modal close with reset
  const handleClose = () => {
    setShowQuickAdd(false);
    setPendingInvitations([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-scale-in">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-card-3d dark:shadow-gray-900/50 animate-scale-in max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create Group</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={24} />
            </button>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-3 rounded-lg mb-4 text-sm border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Group Name
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g., Flat Mates, Paris Trip"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500 focus:border-transparent outline-none"
                required
              />
            </div>

            <IconSelector selected={icon} onSelect={setIcon} />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500 focus:border-transparent outline-none"
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol} {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* SECTION - Add Members */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Add Members
                </h3>
              </div>

              {/* Pending Invitations Display */}
              {pendingInvitations.length > 0 && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 border border-indigo-200 dark:border-indigo-800">
                  <p className="text-xs font-medium text-indigo-900 dark:text-indigo-200 mb-2">
                    {pendingInvitations.length} member(s) will be invited
                  </p>
                  <div className="space-y-2">
                    {pendingInvitations.map((invite) => (
                      <div
                        key={invite.userId}
                        className="flex items-center justify-between bg-white dark:bg-gray-800 p-2 rounded"
                      >
                        <div className="flex items-center gap-2">
                          {invite.photoURL ? (
                            <img
                              src={invite.photoURL}
                              alt={invite.name}
                              className="w-6 h-6 rounded-full"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs">
                              {invite.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm text-gray-900 dark:text-white">
                            {invite.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePendingInvitation(invite.userId)}
                          className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Add Button */}
              <button
                type="button"
                onClick={() => setShowQuickAdd(!showQuickAdd)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition font-medium"
              >
                <Users size={20} />
                <span>Quick Add from Previous Groups</span>
              </button>

              {/* Quick Add Component */}
              {showQuickAdd && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <QuickAddMembers
                    currentUser={user}
                    onAddMembers={handleQuickAddMembers}
                    excludeUserIds={[
                      user.uid,
                      ...pendingInvitations.map(inv => inv.userId)
                    ]}
                  />
                </div>
              )}

              {/* ⭐ ADD CONTACT SYNC - ADD THIS ENTIRE SECTION */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Or find friends via phone contacts:
                </p>
                <ContactSyncButton
                  currentUser={user}
                  onAddMembers={handleContactSyncMembers}
                  excludeUserIds={[
                    user.uid,
                    ...pendingInvitations.map(inv => inv.userId)
                  ]}
                />
              </div>
            </div>
            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-700" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  or create and share invite link later
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-3 bg-primary dark:bg-indigo-600 text-white rounded-lg hover:bg-primary-hover dark:hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </form>
        </div>
      </div>
      
    </>
  );
}
