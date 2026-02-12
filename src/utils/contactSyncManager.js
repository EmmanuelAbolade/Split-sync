// src/utils/contactSyncManager.js
// Handles phone contact syncing with privacy-first approach (hashing)

import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where,
  getDocs 
} from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Hash a phone number using SHA-256 for privacy
 * Never stores raw phone numbers
 */
const hashPhoneNumber = async (phoneNumber) => {
  // Normalize phone number (remove spaces, dashes, etc.)
  const normalized = phoneNumber.replace(/[\s\-\(\)]/g, '');
  
  // Convert to ArrayBuffer
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  
  // Hash using SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
};

/**
 * Normalize phone number to international format
 * E.g., "087 123 4567" → "+353871234567"
 */
const normalizePhoneNumber = (phone, countryCode = '+353') => {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');
  
  // If starts with 0, replace with country code
  if (digits.startsWith('0')) {
    digits = countryCode.replace('+', '') + digits.substring(1);
  }
  
  // Add + if not present
  if (!digits.startsWith(countryCode.replace('+', ''))) {
    digits = countryCode.replace('+', '') + digits;
  }
  
  return '+' + digits;
};

/**
 * Request permission to access contacts
 * Uses Contact Picker API for web (Chrome/Edge only)
 */
export const requestContactsPermission = async () => {
  try {
    // Check if Contact Picker API is available (web)
    if ('contacts' in navigator && 'ContactsManager' in window) {
      // Web implementation - requires user gesture
      return { 
        granted: true, 
        method: 'picker',
        message: 'Contact Picker API available'
      };
    }
    
    // For React Native / Capacitor - would use different API
    // This is a placeholder for future mobile implementation
    if (window.ReactNativeWebView) {
      return {
        granted: false,
        method: 'native',
        message: 'Native contact access not yet implemented'
      };
    }
    
    return {
      granted: false,
      method: 'none',
      message: 'Contact access not available in this browser. Use Chrome or Edge.'
    };
  } catch (error) {
    console.error('Error requesting contacts permission:', error);
    return {
      granted: false,
      method: 'none',
      message: error.message
    };
  }
};

/**
 * Get phone contacts using Contact Picker API
 * Web only - requires user gesture
 */
export const getPhoneContacts = async () => {
  try {
    if (!('contacts' in navigator)) {
      throw new Error('Contact Picker API not available. Use Chrome or Edge.');
    }

    // Supported properties
    const props = ['name', 'tel'];
    const opts = { multiple: true };

    // This will show native contact picker
    const contacts = await navigator.contacts.select(props, opts);
    
    // Format contacts
    const formattedContacts = contacts.map(contact => ({
      name: contact.name?.[0] || 'Unknown',
      phones: contact.tel || []
    }));

    console.log(`✅ Retrieved ${formattedContacts.length} contacts`);
    return formattedContacts;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('User cancelled contact selection');
      return [];
    }
    console.error('Error getting contacts:', error);
    throw error;
  }
};

/**
 * Upload user's phone number hash to enable contact matching
 */
export const uploadPhoneHash = async (userId, phoneNumber) => {
  try {
    // Normalize and hash the phone number
    const normalized = normalizePhoneNumber(phoneNumber);
    const hashed = await hashPhoneNumber(normalized);

    // Store in phoneNumbers collection for matching
    await setDoc(doc(db, 'phoneNumbers', hashed), {
      userId,
      hashedPhone: hashed,
      createdAt: new Date()
    });

    // Store in user document
    await setDoc(doc(db, 'users', userId), {
      phoneNumberHash: hashed,
      allowContactSync: true,
      updatedAt: new Date()
    }, { merge: true });

    console.log(`✅ Phone hash uploaded for user ${userId}`);
    return { success: true, hash: hashed };
  } catch (error) {
    console.error('Error uploading phone hash:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Find which contacts are on Split-Sync
 * Matches phone numbers via hashing (privacy-preserving)
 */
export const findContactsOnSplitSync = async (contacts) => {
  try {
    const matches = [];
    const nonMatches = [];

    for (const contact of contacts) {
      let foundMatch = false;

      // Try each phone number for this contact
      for (const phone of contact.phones) {
        try {
          // Normalize and hash
          const normalized = normalizePhoneNumber(phone);
          const hashed = await hashPhoneNumber(normalized);

          // Check if hash exists in database
          const phoneDoc = await getDoc(doc(db, 'phoneNumbers', hashed));

          if (phoneDoc.exists()) {
            const data = phoneDoc.data();

            // Get user info
            const userDoc = await getDoc(doc(db, 'users', data.userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();

              // Check if user allows contact sync
              if (userData.allowContactSync !== false) {
                matches.push({
                  contactName: contact.name,
                  contactPhone: phone,
                  userId: data.userId,
                  userName: userData.fullName || userData.displayName || 'User',
                  userEmail: userData.email,
                  userPhoto: userData.photoURL || null
                });

                foundMatch = true;
                break; // Found a match for this contact
              }
            }
          }
        } catch (error) {
          console.error('Error checking phone:', error);
        }
      }

      // If no match found for any phone number
      if (!foundMatch) {
        nonMatches.push({
          name: contact.name,
          phones: contact.phones
        });
      }
    }

    console.log(`✅ Found ${matches.length} contacts on Split-Sync`);
    return { matches, nonMatches };
  } catch (error) {
    console.error('Error finding contacts:', error);
    return { matches: [], nonMatches: [] };
  }
};

/**
 * Disable contact sync for a user
 */
export const disableContactSync = async (userId) => {
  try {
    await setDoc(doc(db, 'users', userId), {
      allowContactSync: false,
      updatedAt: new Date()
    }, { merge: true });

    console.log(`✅ Contact sync disabled for user ${userId}`);
    return { success: true };
  } catch (error) {
    console.error('Error disabling contact sync:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Enable contact sync for a user
 */
export const enableContactSync = async (userId) => {
  try {
    await setDoc(doc(db, 'users', userId), {
      allowContactSync: true,
      updatedAt: new Date()
    }, { merge: true });

    console.log(`✅ Contact sync enabled for user ${userId}`);
    return { success: true };
  } catch (error) {
    console.error('Error enabling contact sync:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if user has contact sync enabled
 */
export const isContactSyncEnabled = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const data = userDoc.data();
      return data.allowContactSync !== false; // Default to true
    }
    return false;
  } catch (error) {
    console.error('Error checking contact sync status:', error);
    return false;
  }
};

/**
 * Send SMS invite to non-user (placeholder)
 * Would integrate with Twilio or similar service
 */
export const sendSMSInvite = async (phoneNumber, fromUserName) => {
  try {
    // Placeholder for SMS service integration
    console.log(`Would send SMS to ${phoneNumber} from ${fromUserName}`);
    
    // In production, would call:
    // - Twilio API
    // - Firebase Cloud Functions
    // - Or other SMS gateway
    
    const smsMessage = `${fromUserName} invited you to Split-Sync! 
Download: https://split-sync.web.app
Track expenses easily with friends!`;

    // For now, just copy to clipboard
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(smsMessage);
      return { 
        success: true, 
        message: 'Invite message copied to clipboard! Send it via your messaging app.' 
      };
    }

    return {
      success: false,
      message: 'SMS invites require backend integration'
    };
  } catch (error) {
    console.error('Error sending SMS invite:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Example integration for React Native (Capacitor/Expo)
 * This would be used in mobile app version
 */
export const getContactsNative = async () => {
  // Placeholder for React Native implementation
  // Would use: expo-contacts or @capacitor/contacts
  
  console.log('Native contacts API would be called here');
  return {
    success: false,
    message: 'Native contacts not implemented yet'
  };
};