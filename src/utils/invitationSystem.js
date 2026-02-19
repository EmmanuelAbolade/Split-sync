// src/utils/invitationSystem.js
// Handles group invitations - sending, accepting, declining

import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  arrayUnion,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { createNotification } from '../stores/notificationsStore';

/**
 * Send a group invitation to a user
 */
export const sendInvitation = async (fromUser, toUserId, groupId, groupName) => {
  
  try {    
    // Check if user is already in the group
    const groupDoc = await getDoc(doc(db, 'groups', groupId));
    if (groupDoc.exists()) {
      const groupData = groupDoc.data();
      if (groupData.memberIds?.includes(toUserId)) {
        return { success: false, message: 'User is already in this group' };
      }
    }

    // Get recipient info
    const toUserDoc = await getDoc(doc(db, 'users', toUserId));
    if (!toUserDoc.exists()) {
      return { success: false, message: 'User not found' };
    }
    const toUserData = toUserDoc.data();

    

    // Create invitation
    const invitationRef = doc(collection(db, 'invitations'));
    const invitationData = {
      id: invitationRef.id,
      groupId,
      groupName,
      fromUserId: fromUser.uid,
      fromUserName: fromUser.displayName || fromUser.email,
      fromUserPhoto: fromUser.photoURL || null,
      toUserId,
      toUserEmail: toUserData.email,
      toUserName: toUserData.fullName || toUserData.displayName || 'User',
      status: 'pending',
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      notificationSent: false
    };

    try {
      await setDoc(invitationRef, invitationData);
    } catch (inviteError) {
      throw inviteError; // Re-throw to maintain existing error handling
    }

    // Create bell notification for recipient
    try {
      console.log('🔔 [INVITE] Notification data:', {
        userId: toUserId,
        type: 'invitation',
        groupName: groupName
      });
      
      await createNotification({
        userId: toUserId,
        type: 'invitation',
        title: '📨 Group Invitation',
        message: `${fromUser.displayName || 'Someone'} invited you to join "${groupName}"`,
        data: {
          invitationId: invitationRef.id,
          groupId: groupId,
          groupName: groupName,
          fromUserId: fromUser.uid,
          fromUserName: fromUser.displayName || fromUser.email,
        },
      });
  
} catch (notifError) {
  // Don't fail the invitation if notification fails
}

console.log(`✅ Invitation sent: ${fromUser.displayName} → ${toUserData.fullName} for ${groupName}`);

return { 
  success: true, 
  invitationId: invitationRef.id,
  message: 'Invitation sent successfully'
};

  } catch (error) {
    console.error('Error sending invitation:', error);
    return { success: false, message: 'Failed to send invitation' };
  }
};

/**
 * Send invitations to multiple users at once
 */
export const sendBulkInvitations = async (fromUser, toUserIds, groupId, groupName) => {
  const results = {
    successful: [],
    failed: []
  };

  for (const toUserId of toUserIds) {
    const result = await sendInvitation(fromUser, toUserId, groupId, groupName);
    
    if (result.success) {
      results.successful.push(toUserId);
    } else {
      results.failed.push({ userId: toUserId, reason: result.message });
    }
  }

  return results;
};

/**
 * Get all pending invitations for a user
 */
export const getMyInvitations = async (userId) => {
  try {
    const invitationsQuery = query(
      collection(db, 'invitations'),
      where('toUserId', '==', userId),
      where('status', '==', 'pending')
    );

    const snapshot = await getDocs(invitationsQuery);
    const invitations = [];

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      
      // Check if expired
      const expiresAt = data.expiresAt?.toMillis() || 0;
      if (expiresAt < Date.now()) {
        // Mark as expired
        await updateDoc(doc(db, 'invitations', docSnap.id), {
          status: 'expired'
        });
        continue;
      }

      invitations.push({
        id: docSnap.id,
        ...data
      });
    }

    // Sort by most recent
    invitations.sort((a, b) => {
      const aTime = a.createdAt?.toMillis() || 0;
      const bTime = b.createdAt?.toMillis() || 0;
      return bTime - aTime;
    });

    return invitations;
  } catch (error) {
    console.error('Error getting invitations:', error);
    return [];
  }
};

/**
 * Get invitations sent by a user
 */
export const getMySentInvitations = async (userId, groupId = null) => {
  try {
    let invitationsQuery = query(
      collection(db, 'invitations'),
      where('fromUserId', '==', userId)
    );

    if (groupId) {
      invitationsQuery = query(
        invitationsQuery,
        where('groupId', '==', groupId)
      );
    }

    const snapshot = await getDocs(invitationsQuery);
    const invitations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return invitations;
  } catch (error) {
    console.error('Error getting sent invitations:', error);
    return [];
  }
};

/**
 * Accept an invitation and join the group
 */
export const acceptInvitation = async (invitationId, userId) => {
  try {
    // Get invitation
    const invitationDoc = await getDoc(doc(db, 'invitations', invitationId));
    if (!invitationDoc.exists()) {
      return { success: false, message: 'Invitation not found' };
    }

    const invitationData = invitationDoc.data();

    // Verify it's for this user
    if (invitationData.toUserId !== userId) {
      return { success: false, message: 'This invitation is not for you' };
    }

    // Check if expired
    const expiresAt = invitationData.expiresAt?.toMillis() || 0;
    if (expiresAt < Date.now()) {
      await updateDoc(doc(db, 'invitations', invitationId), { status: 'expired' });
      return { success: false, message: 'Invitation has expired' };
    }

    // Get group
    const groupRef = doc(db, 'groups', invitationData.groupId);
    const groupDoc = await getDoc(groupRef);
    
    if (!groupDoc.exists()) {
      return { success: false, message: 'Group not found' };
    }

    const groupData = groupDoc.data();

    // Check if already a member
    if (groupData.memberIds?.includes(userId)) {
      await updateDoc(doc(db, 'invitations', invitationId), { status: 'accepted' });
      return { success: false, message: 'You are already a member of this group' };
    }

    // Get user info
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data();

    // Add user to group
    await updateDoc(groupRef, {
      memberIds: arrayUnion(userId),
      members: arrayUnion({
        userId,
        name: userData.fullName || userData.displayName || 'User',
        email: userData.email,
        photoURL: userData.photoURL || null,
        joinedAt: new Date()
      }),
      updatedAt: serverTimestamp()
    });

    // Mark invitation as accepted
    await updateDoc(doc(db, 'invitations', invitationId), {
      status: 'accepted',
      acceptedAt: serverTimestamp()
    });

    console.log(`✅ Invitation accepted: ${userData.fullName} joined ${groupData.name}`);

    return { 
      success: true, 
      groupId: invitationData.groupId,
      groupName: invitationData.groupName,
      message: `You've joined ${invitationData.groupName}!`
    };
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return { success: false, message: 'Failed to accept invitation' };
  }
};

/**
 * Decline an invitation
 */
export const declineInvitation = async (invitationId, userId) => {
  try {
    // Get invitation
    const invitationDoc = await getDoc(doc(db, 'invitations', invitationId));
    if (!invitationDoc.exists()) {
      return { success: false, message: 'Invitation not found' };
    }

    const invitationData = invitationDoc.data();

    // Verify it's for this user
    if (invitationData.toUserId !== userId) {
      return { success: false, message: 'This invitation is not for you' };
    }

    // Mark as declined
    await updateDoc(doc(db, 'invitations', invitationId), {
      status: 'declined',
      declinedAt: serverTimestamp()
    });

    console.log(`✅ Invitation declined by user ${userId}`);

    return { 
      success: true, 
      message: 'Invitation declined'
    };
  } catch (error) {
    console.error('Error declining invitation:', error);
    return { success: false, message: 'Failed to decline invitation' };
  }
};

/**
 * Cancel an invitation (by sender)
 */
export const cancelInvitation = async (invitationId, userId) => {
  try {
    // Get invitation
    const invitationDoc = await getDoc(doc(db, 'invitations', invitationId));
    if (!invitationDoc.exists()) {
      return { success: false, message: 'Invitation not found' };
    }

    const invitationData = invitationDoc.data();

    // Verify it's from this user
    if (invitationData.fromUserId !== userId) {
      return { success: false, message: 'You can only cancel invitations you sent' };
    }

    // Delete invitation
    await deleteDoc(doc(db, 'invitations', invitationId));

    console.log(`✅ Invitation cancelled by user ${userId}`);

    return { 
      success: true, 
      message: 'Invitation cancelled'
    };
  } catch (error) {
    console.error('Error cancelling invitation:', error);
    return { success: false, message: 'Failed to cancel invitation' };
  }
};

/**
 * Clean up expired invitations
 * Should be called periodically
 */
export const cleanupExpiredInvitations = async () => {
  try {
    const invitationsQuery = query(
      collection(db, 'invitations'),
      where('status', '==', 'pending')
    );

    const snapshot = await getDocs(invitationsQuery);
    const now = Date.now();
    let expiredCount = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const expiresAt = data.expiresAt?.toMillis() || 0;

      if (expiresAt < now) {
        await updateDoc(doc(db, 'invitations', docSnap.id), {
          status: 'expired'
        });
        expiredCount++;
      }
    }

    console.log(`✅ Cleaned up ${expiredCount} expired invitations`);
    return expiredCount;
  } catch (error) {
    console.error('Error cleaning up expired invitations:', error);
    return 0;
  }
};

/**
 * Get invitation count for a user (badge number)
 */
export const getInvitationCount = async (userId) => {
  try {
    const invitations = await getMyInvitations(userId);
    return invitations.length;
  } catch (error) {
    console.error('Error getting invitation count:', error);
    return 0;
  }
};