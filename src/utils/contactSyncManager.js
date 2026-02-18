// src/utils/contactSyncManager.js
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Hash a phone number using SHA-256
 * @param {string} phoneNumber - Phone number to hash
 * @returns {Promise<string>} - Hexadecimal hash string
 */
export const hashPhoneNumber = async (phoneNumber) => {
  try {
    // Remove all spaces, dashes, and special characters
    const cleanPhone = phoneNumber.replace(/[\s\-()]/g, '');
    // Ensure it starts with +
    const normalizedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;
    
    // Hash using SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(normalizedPhone);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const phoneHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return phoneHash;
  } catch (error) {
    console.error('Error hashing phone number:', error);
    throw error;
  }
};

/**
 * Request contacts permission and read contacts from device
 * @returns {Promise<Array>} - Array of contacts with name and phone
 */
export const requestContactsPermission = async () => {
  try {
    // Check if Contacts API is available (modern browsers)
    if ('contacts' in navigator && 'ContactsManager' in window) {
      const props = ['name', 'tel'];
      const opts = { multiple: true };
      
      try {
        const contacts = await navigator.contacts.select(props, opts);
        
        // Format contacts
        return contacts.map(contact => ({
          name: contact.name?.[0] || 'Unknown',
          phoneNumbers: contact.tel || []
        })).filter(c => c.phoneNumbers.length > 0);
      } catch (err) {
        // User cancelled or denied permission
        return null;
      }
    } else {
      // Fallback: Not supported on this browser/device
      throw new Error('Contact API not supported on this device');
    }
  } catch (error) {
    console.error('Error requesting contacts:', error);
    throw error;
  }
};

/**
 * Find Split-Sync users from phone contacts
 * @param {Array} contacts - Array of contacts from device
 * @returns {Promise<Object>} - Object with matched and unmatched contacts
 */
export const findContactsOnSplitSync = async (contacts) => {
  try {
    const matched = [];
    const unmatched = [];
    
    // Hash all phone numbers from contacts
    const contactsWithHashes = await Promise.all(
      contacts.map(async (contact) => {
        const hashes = await Promise.all(
          contact.phoneNumbers.map(phone => hashPhoneNumber(phone))
        );
        return {
          name: contact.name,
          phoneNumbers: contact.phoneNumbers,
          hashes: hashes
        };
      })
    );
    
    // Collect all unique hashes
    const allHashes = [...new Set(contactsWithHashes.flatMap(c => c.hashes))];
    
    // Query Firestore for users with these phone hashes (batch in groups of 10)
    const batchSize = 10;
    const userMatches = [];
    
    for (let i = 0; i < allHashes.length; i += batchSize) {
      const batchHashes = allHashes.slice(i, i + batchSize);
      
      const usersQuery = query(
        collection(db, 'users'),
        where('phoneHash', 'in', batchHashes)
      );
      
      const snapshot = await getDocs(usersQuery);
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        userMatches.push({
          userId: doc.id,
          name: data.displayName,
          email: data.email,
          phoneHash: data.phoneHash,
          photoURL: data.photoURL || null
        });
      });
    }
    
    // Create a map of hash -> user for quick lookup
    const hashToUser = {};
    userMatches.forEach(user => {
      hashToUser[user.phoneHash] = user;
    });
    
    // Match contacts to users
    contactsWithHashes.forEach(contact => {
      let foundUser = null;
      
      // Check if any of this contact's phone hashes match a user
      for (const hash of contact.hashes) {
        if (hashToUser[hash]) {
          foundUser = hashToUser[hash];
          break;
        }
      }
      
      if (foundUser) {
        matched.push({
          contactName: contact.name,
          phoneNumbers: contact.phoneNumbers,
          user: foundUser
        });
      } else {
        unmatched.push({
          contactName: contact.name,
          phoneNumbers: contact.phoneNumbers
        });
      }
    });
    
    return {
      matched: matched,
      unmatched: unmatched,
      total: contacts.length,
      matchedCount: matched.length
    };
  } catch (error) {
    console.error('Error finding contacts on Split-Sync:', error);
    throw error;
  }
};

/**
 * Check if contact sync is supported on this device
 * @returns {boolean}
 */
export const isContactSyncSupported = () => {
  return 'contacts' in navigator && 'ContactsManager' in window;
};

