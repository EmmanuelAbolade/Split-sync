// src/utils/userConnectionsManager.js
// Tracks and manages connections between users who have been in groups together

import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query,
  where, //new
  deleteDoc, 
  getDocs,
  updateDoc,
  arrayUnion,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Track a connection between two users in a group
 * Creates/updates bidirectional connection
 */
export const trackConnection = async (userId, otherUserId, groupId, groupName) => {
  if (userId === otherUserId) return; // Don't connect user to themselves

  try {
    // Get user info
    const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
    if (!otherUserDoc.exists()) return;

    const otherUserData = otherUserDoc.data();

    // Connection data
    const connectionData = {
      userId: otherUserId,
      name: otherUserData.fullName || otherUserData.displayName || 'Unknown',
      email: otherUserData.email || '',
      photoURL: otherUserData.photoURL || null,
      lastGroupTogether: groupName,
      lastGroupId: groupId,
      updatedAt: serverTimestamp()
    };

    // Check if connection exists
    const connectionRef = doc(db, 'connections', userId, 'connectedUsers', otherUserId);
    const existingConnection = await getDoc(connectionRef);

    if (existingConnection.exists()) {
      // Update existing connection
      await updateDoc(connectionRef, {
        sharedGroups: arrayUnion({
          groupId,
          groupName,
          addedAt: new Date()
        }),
        lastGroupTogether: groupName,
        lastGroupId: groupId,
        updatedAt: serverTimestamp()
      });
    } else {
      // Create new connection
      await setDoc(connectionRef, {
        ...connectionData,
        sharedGroups: [{
          groupId,
          groupName,
          addedAt: new Date()
        }],
        connectedAt: serverTimestamp()
      });
    }

    console.log(`✅ Connection tracked: ${userId} <-> ${otherUserId} in ${groupName}`);
  } catch (error) {
    console.error('Error tracking connection:', error);
  }
};

/**
 * Update connections for all members of a group
 * Called when group is created or members are added
 */
export const updateGroupConnections = async (groupId, groupName, memberIds) => {
  try {
    // Create connections between all pairs of members
    for (let i = 0; i < memberIds.length; i++) {
      for (let j = i + 1; j < memberIds.length; j++) {
        // Track connection in both directions
        await trackConnection(memberIds[i], memberIds[j], groupId, groupName);
        await trackConnection(memberIds[j], memberIds[i], groupId, groupName);
      }
    }

    console.log(`✅ Updated connections for group: ${groupName}`);
  } catch (error) {
    console.error('Error updating group connections:', error);
  }
};

/**
 * Get all connections for a user
 * Returns list of users they've been in groups with
 */
export const getConnections = async (userId) => {
  try {
    const connectionsRef = collection(db, 'connections', userId, 'connectedUsers');
    const snapshot = await getDocs(connectionsRef);

    // ⭐ Fetch FRESH user data from users collection
    const connections = await Promise.all(
      snapshot.docs.map(async (docSnap) => {
        const connectionData = docSnap.data();
        const connectedUserId = docSnap.id;
        
        try {
          // Fetch current user data
          const userDoc = await getDoc(doc(db, 'users', connectedUserId));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            // Use CURRENT name from users collection
            return {
              id: connectedUserId,
              userId: connectedUserId,
              name: userData.displayName || userData.fullName || connectionData.name || 'Unknown',
              email: userData.email || connectionData.email || '',
              photoURL: userData.photoURL || connectionData.photoURL || null,
              // Keep connection metadata
              sharedGroups: connectionData.sharedGroups,
              lastGroupTogether: connectionData.lastGroupTogether,
              lastGroupId: connectionData.lastGroupId,
              updatedAt: connectionData.updatedAt,
              connectedAt: connectionData.connectedAt,
            };
          }
        } catch (err) {
          console.log(`Could not fetch fresh data for ${connectedUserId}, using cached`);
        }
        
        // Fallback to cached data if user fetch fails
        return {
          id: connectedUserId,
          userId: connectedUserId,
          ...connectionData
        };
      })
    );

    // Sort by most recent connection
    connections.sort((a, b) => {
      const aTime = a.updatedAt?.toMillis() || 0;
      const bTime = b.updatedAt?.toMillis() || 0;
      return bTime - aTime;
    });

    return connections;
  } catch (error) {
    console.error('Error getting connections:', error);
    return [];
  }
};

// new function to sync connections for a user based on their current group memberships
export const syncMyConnectionsFromGroups = async (userId) => {
  try {
    if (!userId) return { success: false, synced: 0 };

    // Get all groups where I'm a member
    const groupsQuery = query(
      collection(db, 'groups'),
      where('memberIds', 'array-contains', userId)
    );

    const snap = await getDocs(groupsQuery);

    let synced = 0;

    for (const groupDoc of snap.docs) {
      const groupData = groupDoc.data();
      const groupName = groupData?.name || 'Group';
      const memberIds = groupData?.memberIds || [];

      // For each other member in the group, ensure I have a connection doc
      for (const otherUserId of memberIds) {
        if (!otherUserId || otherUserId === userId) continue;

        await trackConnection(userId, otherUserId, groupDoc.id, groupName);
        synced++;
      }
    }

    return { success: true, synced };
  } catch (error) {
    console.error('Error syncing my connections from groups:', error);
    return { success: false, synced: 0, error: error.message };
  }
};




/**
 * Get connection details between two specific users
 */
export const getConnectionDetails = async (userId, otherUserId) => {
  try {
    const connectionRef = doc(db, 'connections', userId, 'connectedUsers', otherUserId);
    const connectionDoc = await getDoc(connectionRef);

    if (connectionDoc.exists()) {
      return {
        id: connectionDoc.id,
        ...connectionDoc.data()
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting connection details:', error);
    return null;
  }
};

/**
 * Remove a connection between two users
 * Only used if user leaves all shared groups
 */
export const removeConnection = async (userId, otherUserId) => {
  try {
    // Get connection
    const connectionRef = doc(db, 'connections', userId, 'connectedUsers', otherUserId);
    const connectionDoc = await getDoc(connectionRef);

    if (connectionDoc.exists()) {
      const data = connectionDoc.data();
      
      // Only remove if no shared groups
      if (!data.sharedGroups || data.sharedGroups.length === 0) {
        await deleteDoc(connectionRef);
        console.log(`✅ Connection removed: ${userId} <-> ${otherUserId}`);
      }
    }
  } catch (error) {
    console.error('Error removing connection:', error);
  }
};

/**
 * Update connection when user leaves a group
 * Removes that group from sharedGroups array
 */
export const updateConnectionOnLeaveGroup = async (userId, otherUserId, groupId) => {
  try {
    const connectionRef = doc(db, 'connections', userId, 'connectedUsers', otherUserId);
    const connectionDoc = await getDoc(connectionRef);

    if (connectionDoc.exists()) {
      const data = connectionDoc.data();
      const updatedSharedGroups = (data.sharedGroups || []).filter(
        group => group.groupId !== groupId
      );

      if (updatedSharedGroups.length === 0) {
        // No more shared groups - remove connection
        await deleteDoc(connectionRef);
      } else {
        // Update with remaining groups
        await updateDoc(connectionRef, {
          sharedGroups: updatedSharedGroups,
          lastGroupTogether: updatedSharedGroups[0]?.groupName || '',
          lastGroupId: updatedSharedGroups[0]?.groupId || '',
          updatedAt: serverTimestamp()
        });
      }
    }
  } catch (error) {
    console.error('Error updating connection on leave group:', error);
  }
};

/**
 * Get suggested users to add based on mutual connections
 * "People you may know" feature
 */
export const getSuggestedConnections = async (userId) => {
  try {
    // Get user's direct connections
    const myConnections = await getConnections(userId);
    const myConnectionIds = myConnections.map(c => c.userId);

    // Get connections of connections (2nd degree)
    const suggestedMap = new Map();

    for (const connection of myConnections) {
      const theirConnections = await getConnections(connection.userId);
      
      for (const theirConnection of theirConnections) {
        // Skip if it's the user themselves or already connected
        if (theirConnection.userId === userId || myConnectionIds.includes(theirConnection.userId)) {
          continue;
        }

        // Count mutual connections
        if (suggestedMap.has(theirConnection.userId)) {
          const existing = suggestedMap.get(theirConnection.userId);
          existing.mutualConnections++;
          existing.mutualWith.push(connection.name);
        } else {
          suggestedMap.set(theirConnection.userId, {
            ...theirConnection,
            mutualConnections: 1,
            mutualWith: [connection.name]
          });
        }
      }
    }

    // Convert to array and sort by mutual connections
    const suggested = Array.from(suggestedMap.values());
    suggested.sort((a, b) => b.mutualConnections - a.mutualConnections);

    return suggested.slice(0, 10); // Top 10 suggestions
  } catch (error) {
    console.error('Error getting suggested connections:', error);
    return [];
  }
};