// src/components/ContactFinder.jsx
// UI component for finding phone contacts on Split-Sync

import { useState } from 'react';
import {
  requestContactsPermission,
  getPhoneContacts,
  findContactsOnSplitSync,
  sendSMSInvite
} from '../utils/contactSyncManager';
import { Phone, Search, UserPlus, Users, Mail, CheckCircle, AlertCircle, X } from 'lucide-react';

export default function ContactFinder({ currentUser, onAddContact, onClose }) {
  const [step, setStep] = useState('intro'); // intro, loading, results
  const [matches, setMatches] = useState([]);
  const [nonMatches, setNonMatches] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleStartSync = async () => {
    setError('');
    setStep('loading');
    setProcessing(true);

    try {
      // Request permission
      const permission = await requestContactsPermission();

      if (!permission.granted) {
        setError(permission.message || 'Contact access denied');
        setStep('intro');
        setProcessing(false);
        return;
      }

      // Get contacts
      const contacts = await getPhoneContacts();

      if (contacts.length === 0) {
        setError('No contacts selected');
        setStep('intro');
        setProcessing(false);
        return;
      }

      // Find matches
      const { matches: foundMatches, nonMatches: notFound } = await findContactsOnSplitSync(contacts);

      setMatches(foundMatches);
      setNonMatches(notFound);
      setStep('results');
    } catch (err) {
      console.error('Error syncing contacts:', err);
      setError(err.message || 'Failed to sync contacts. Please try again.');
      setStep('intro');
    } finally {
      setProcessing(false);
    }
  };

  const handleAddSelected = () => {
    if (selectedUsers.length === 0) return;

    const selectedContacts = matches.filter(match =>
      selectedUsers.includes(match.userId)
    );

    onAddContact(selectedContacts);
    onClose();
  };

  const handleInviteNonUser = async (contact) => {
    const result = await sendSMSInvite(
      contact.phones[0],
      currentUser.displayName || 'A friend'
    );

    if (result.success) {
      alert(`✅ ${result.message}`);
    } else {
      alert(`❌ ${result.message}`);
    }
  };

  const toggleUserSelection = (userId) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  const filteredMatches = matches.filter(match =>
    match.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    match.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    match.contactName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredNonMatches = nonMatches.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Intro Screen
  if (step === 'intro') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
              <Phone size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Find Friends
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Discover contacts on Split-Sync
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Users size={20} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium mb-2">How it works:</p>
              <ul className="space-y-1 text-blue-800 dark:text-blue-200">
                <li>• Select contacts from your phone</li>
                <li>• We'll securely check who uses Split-Sync</li>
                <li>• Your phone numbers are hashed for privacy</li>
                <li>• Invite friends who aren't on Split-Sync yet</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Privacy Note */}
        <div className="bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-lg p-3 mb-6">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-gray-600 dark:text-gray-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-700 dark:text-gray-300">
              <span className="font-medium">Privacy First:</span> Phone numbers are never stored in plain text. 
              We use one-way encryption (hashing) to match contacts while protecting your privacy.
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Start Button */}
        <button
          onClick={handleStartSync}
          disabled={processing}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-500 dark:to-purple-500 text-white py-3 rounded-lg hover:from-indigo-700 hover:to-purple-700 dark:hover:from-indigo-600 dark:hover:to-purple-600 transition font-medium disabled:opacity-50"
        >
          <Phone size={20} />
          <span>{processing ? 'Accessing Contacts...' : 'Find Friends on Split-Sync'}</span>
        </button>

        {/* Cancel Button */}
        <button
          onClick={onClose}
          className="w-full mt-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    );
  }

  // Loading Screen
  if (step === 'loading') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 max-w-lg mx-auto text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Phone size={32} className="text-white" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Finding Your Friends...
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Securely checking which contacts use Split-Sync
        </p>
      </div>
    );
  }

  // Results Screen
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl mx-auto max-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Contact Results
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {matches.length} on Split-Sync, {nonMatches.length} not yet
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X size={24} />
        </button>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search contacts..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* On Split-Sync */}
        {filteredMatches.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={18} className="text-green-600 dark:text-green-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">
                On Split-Sync ({filteredMatches.length})
              </h3>
            </div>

            <div className="space-y-2">
              {filteredMatches.map((match) => {
                const isSelected = selectedUsers.includes(match.userId);

                return (
                  <button
                    key={match.userId}
                    onClick={() => toggleUserSelection(match.userId)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700'
                        : 'bg-white dark:bg-gray-750 border-gray-200 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-800'
                    }`}
                  >
                    {/* Photo */}
                    {match.userPhoto ? (
                      <img
                        src={match.userPhoto}
                        alt={match.userName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                        {match.userName.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {match.userName}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {match.userEmail}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        Saved as: {match.contactName}
                      </p>
                    </div>

                    {/* Checkbox */}
                    {isSelected ? (
                      <CheckCircle size={20} className="text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <div className="w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Not on Split-Sync */}
        {filteredNonMatches.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Mail size={18} className="text-gray-400 dark:text-gray-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Not on Split-Sync ({filteredNonMatches.length})
              </h3>
            </div>

            <div className="space-y-2">
              {filteredNonMatches.map((contact, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-750 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 text-sm font-semibold">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {contact.name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {contact.phones[0]}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleInviteNonUser(contact)}
                    className="px-3 py-1.5 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition"
                  >
                    Invite
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Results */}
        {filteredMatches.length === 0 && filteredNonMatches.length === 0 && searchTerm && (
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400">
              No contacts found matching "{searchTerm}"
            </p>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {selectedUsers.length > 0 && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleAddSelected}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 dark:bg-indigo-500 text-white py-3 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition font-medium"
          >
            <UserPlus size={20} />
            <span>Add Selected ({selectedUsers.length})</span>
          </button>
        </div>
      )}
    </div>
  );
}
