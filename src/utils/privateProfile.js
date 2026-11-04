// src/utils/privateProfile.js
// Owner-only profile data: payment methods and the plain phone number.
// Stored in users/{uid}/private/details (Firestore rules: owner only).
// Other group members get payment options via fetchGroupPaymentMethods, which
// calls a Cloud Function that checks group membership (functions/privateData.js).

import { doc, getDoc, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { db } from '../services/firebase';

const privateRef = (uid) => doc(db, 'users', uid, 'private', 'details');

/**
 * Loads the signed-in user's private details. Moves legacy fields that still
 * sit on the public users/{uid} doc into the private doc, then deletes them.
 * @returns {Promise<{paymentMethods: object, phoneNumber: string}>}
 */
export async function loadMyPrivateDetails(uid) {
  const [privSnap, userSnap] = await Promise.all([
    getDoc(privateRef(uid)),
    getDoc(doc(db, 'users', uid)),
  ]);
  const priv = privSnap.exists() ? privSnap.data() : {};
  const pub  = userSnap.exists() ? userSnap.data() : {};
  const data = {
    paymentMethods: priv.paymentMethods ?? pub.paymentMethods ?? {},
    phoneNumber:    priv.phoneNumber ?? pub.phoneNumber ?? '',
  };

  if (pub.paymentMethods !== undefined || pub.phoneNumber !== undefined) {
    try {
      await setDoc(privateRef(uid), data, { merge: true });
      await updateDoc(doc(db, 'users', uid), {
        paymentMethods: deleteField(),
        phoneNumber:    deleteField(),
      });
    } catch (err) {
      console.warn('Private data migration failed:', err?.code || err?.message);
    }
  }
  return data;
}

/** Replaces the user's payment methods (IBAN must already be server-encrypted). */
export async function saveMyPaymentMethods(uid, paymentMethods) {
  await setDoc(
    privateRef(uid),
    { paymentMethods, updatedAt: new Date() },
    { mergeFields: ['paymentMethods', 'updatedAt'] }
  );
}

/** Saves the plain phone number privately (its hash stays public for contact sync). */
export async function saveMyPhoneNumber(uid, phoneNumber) {
  await setDoc(
    privateRef(uid),
    { phoneNumber, updatedAt: new Date() },
    { mergeFields: ['phoneNumber', 'updatedAt'] }
  );
}

/**
 * Payment options for every member of a group the caller belongs to.
 * @returns {Promise<Object<string, {paypalUsername, revolutUsername, bic, hasIban}|null>>}
 */
export async function fetchGroupPaymentMethods(groupId) {
  try {
    const res = await httpsCallable(getFunctions(app), 'getGroupPaymentMethods')({ groupId });
    return res.data?.methods || {};
  } catch (err) {
    console.error('Could not load payment methods:', err?.message);
    return {};
  }
}
