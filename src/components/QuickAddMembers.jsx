// src/components/QuickAddMembers.jsx
// UI component for quickly adding members from previous groups

import { useState, useEffect, useCallback } from 'react';
import { getConnections, syncMyConnectionsFromGroups } from '../utils/userConnectionsManager';
import { Users, CheckSquare, Square, Search, UserPlus } from 'lucide-react';


export default function QuickAddMembers({ currentUser, onAddMembers, excludeUserIds = [] }) {
  const [connections, setConnections] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAll, setShowAll] = useState(false);

 

  const loadConnections = useCallback(async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      // new First sync connections based on current group memberships, then fetch them
      await syncMyConnectionsFromGroups(currentUser.uid);
      const userConnections = await getConnections(currentUser.uid);
      
      // Filter out users already in the group or excluded
      const filtered = userConnections.filter(
        conn => !excludeUserIds.includes(conn.userId)
      );
      
      setConnections(filtered);
    } catch (error) {
      console.error('Error loading connections:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const toggleUserSelection = (userId) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  const handleSelectAll = () => {
    const filteredConnections = getFilteredConnections();
    const allUserIds = filteredConnections.map(conn => conn.userId);
    setSelectedUsers(allUserIds);
  };

  const handleDeselectAll = () => {
    setSelectedUsers([]);
  };

  const handleAddMembers = () => {
    if (selectedUsers.length === 0) return;
    
    const selectedConnections = connections.filter(
      conn => selectedUsers.includes(conn.userId)
    );
    
    onAddMembers(selectedConnections);
    setSelectedUsers([]);
  };

  const getFilteredConnections = () => {
    if (!searchTerm) {
      return showAll ? connections : connections.slice(0, 5);
    }

    const filtered = connections.filter(conn =>
      conn.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conn.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return showAll ? filtered : filtered.slice(0, 5);
  };

   useEffect(() => {
    loadConnections();
 // }, [currentUser]);
    }, [loadConnections]);

  const filteredConnections = getFilteredConnections();
  const hasMore = connections.length > 5;

  if (loading) {
    return (
      <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 border border-indigo-200 dark:border-indigo-800">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
          <Users size={20} className="animate-pulse" />
          <span className="text-sm">Loading your connections...</span>
        </div>
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
          <Users size={20} />
          <span className="text-sm font-medium">No Previous Collaborators</span>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Once you've been in groups with other users, they'll appear here for quick adding.
        </p>
      </div>
    );
  }

  


  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
            <UserPlus size={16} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Quick Add Members
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              From your previous groups
            </p>
          </div>
        </div>
        {connections.length > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
            {connections.length} available
          </span>
        )}
      </div>

      {/* Search */}
      {connections.length > 3 && (
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search connections..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent outline-none"
          />
        </div>
      )}

      {/* Select Controls */}
      {filteredConnections.length > 0 && (
        <div className="flex gap-2">
          <button
            type="button"  // ✅ IMPORTANT: prevent form submit
            onClick={handleSelectAll}
            className="flex-1 text-xs px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition"
          >
            Select All
          </button>
          <button
            type="button"  // ✅ IMPORTANT: prevent form submit
            onClick={handleDeselectAll}
            className="flex-1 text-xs px-3 py-1.5 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition"
          >
            Deselect All
          </button>
        </div>
      )}

      {/* Connection List */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {filteredConnections.map((connection) => {
          const isSelected = selectedUsers.includes(connection.userId);
          
          return (
            <button
              type="button"  // ✅ IMPORTANT: prevent form submit
              key={connection.userId}
              onClick={() => toggleUserSelection(connection.userId)}
              className={`w-full flex items-start gap-3 p-3 rounded-lg border transition ${
                isSelected
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-800'
              }`}
            >
              {/* Checkbox */}
              <div className="mt-0.5">
                {isSelected ? (
                  <CheckSquare size={20} className="text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <Square size={20} className="text-gray-400 dark:text-gray-500" />
                )}
              </div>

              {/* User Info */}
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-2">
                  {connection.photoURL ? (
                    <img
                      src={connection.photoURL}
                      alt={connection.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                      {connection.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {connection.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {connection.email}
                    </p>
                  </div>
                </div>

                {/* Shared Groups */}
                {connection.sharedGroups && connection.sharedGroups.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {connection.sharedGroups.slice(0, 2).map((group, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full"
                      >
                        {group.groupName}
                      </span>
                    ))}
                    {connection.sharedGroups.length > 2 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        +{connection.sharedGroups.length - 2} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Show More/Less */}
      {hasMore && !searchTerm && (
        <button
          type="button"  // ✅ IMPORTANT: prevent form submit
          onClick={() => setShowAll(!showAll)}
          className="w-full text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 py-2"
        >
          {showAll ? 'Show Less' : `Show All (${connections.length})`}
        </button>
      )}

      {/* Add Selected Button */}
      {selectedUsers.length > 0 && (
        <button
          type="button"  // ✅ IMPORTANT: prevent form submit
          onClick={handleAddMembers}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 dark:bg-indigo-500 text-white py-3 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition font-medium"
        >
          <UserPlus size={20} />
          <span>Send Invitations ({selectedUsers.length})</span>
        </button>
      )}
    </div>
  );
}
