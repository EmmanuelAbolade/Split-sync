// src/components/ContactSyncButton.jsx
import { useState } from 'react';
import { Users, Phone, Loader, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { requestContactsPermission, findContactsOnSplitSync, isContactSyncSupported } from '../utils/contactSyncManager';

export default function ContactSyncButton({ currentUser, onAddMembers, excludeUserIds = [] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [syncResult, setSyncResult] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);

  // Check if contact sync is supported on this device
  const supported = isContactSyncSupported();

  const handleSyncContacts = async () => {
    setLoading(true);
    setError('');
    setSyncResult(null);

    try {
      // Step 1: Request contacts permission
      const contacts = await requestContactsPermission();

      if (!contacts) {
        setError('Contact access was denied or cancelled');
        setLoading(false);
        return;
      }

      if (contacts.length === 0) {
        setError('No contacts found on your device');
        setLoading(false);
        return;
      }

      // Step 2: Find matches on Split-Sync
      const result = await findContactsOnSplitSync(contacts);

      // Filter out already excluded users
      const availableMatches = result.matched.filter(
        match => !excludeUserIds.includes(match.user.userId)
      );

      setSyncResult({
        ...result,
        matched: availableMatches
      });

      setLoading(false);
    } catch (err) {
      console.error('Error syncing contacts:', err);
      setError(err.message || 'Failed to sync contacts. Please try again.');
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const handleAddSelected = () => {
    if (selectedUsers.length === 0) return;

    const usersToAdd = syncResult.matched
      .filter(match => selectedUsers.includes(match.user.userId))
      .map(match => ({
        userId: match.user.userId,
        name: match.user.name,
        email: match.user.email,
        photoURL: match.user.photoURL
      }));

    onAddMembers(usersToAdd);
    
    // Reset
    setSelectedUsers([]);
    setSyncResult(null);
  };

  if (!supported) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
              Contact Sync Not Available
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
              This feature requires a modern browser or mobile device.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sync Button */}
      {!syncResult && (
        <button
          type="button"
          onClick={handleSyncContacts}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition font-medium disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader size={20} className="animate-spin" />
              <span>Syncing Contacts...</span>
            </>
          ) : (
            <>
              <Phone size={20} />
              <span>Find Friends via Contacts</span>
            </>
          )}
        </button>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <XCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Sync Results */}
      {syncResult && (
        <div className="space-y-3">
          {/* Success Header */}
          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
              <p className="text-sm font-medium text-green-900 dark:text-green-200">
                Found {syncResult.matchedCount} friend{syncResult.matchedCount !== 1 ? 's' : ''} on Split-Sync!
              </p>
            </div>
          </div>

          {/* Matched Contacts List */}
          {syncResult.matched.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Select friends to add:
              </p>
              
              {syncResult.matched.map((match) => (
                <div
                  key={match.user.userId}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${
                    selectedUsers.includes(match.user.userId)
                      ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700'
                      : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-purple-200 dark:hover:border-purple-800'
                  }`}
                  onClick={() => toggleUserSelection(match.user.userId)}
                >
                  <div className="flex items-center gap-3">
                    {match.user.photoURL ? (
                      <img
                        src={match.user.photoURL}
                        alt={match.user.name}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white font-semibold">
                        {match.user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {match.user.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {match.user.email}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Saved as: {match.contactName}
                      </p>
                    </div>
                  </div>
                  
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    selectedUsers.includes(match.user.userId)
                      ? 'bg-purple-600 border-purple-600'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {selectedUsers.includes(match.user.userId) && (
                      <CheckCircle size={16} className="text-white" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Users size={32} className="mx-auto text-gray-400 dark:text-gray-500 mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                None of your contacts are on Split-Sync yet
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setSyncResult(null);
                setSelectedUsers([]);
                setError('');
              }}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddSelected}
              disabled={selectedUsers.length === 0}
              className="flex-1 px-4 py-2 bg-purple-600 dark:bg-purple-700 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-800 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              Add {selectedUsers.length > 0 ? `(${selectedUsers.length})` : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}