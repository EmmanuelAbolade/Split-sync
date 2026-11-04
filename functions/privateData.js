// functions/privateData.js
// Private profile data: payment handles, bank details and phone number.
//
// Why: users/{uid} must stay readable by any signed-in user (names, photos and
// the phone *hash* power member lists and contact discovery). Payment details
// and the plain phone number used to live there too, so anyone who knew a uid
// could read them. They now live in users/{uid}/private/details, which the
// Firestore rules restrict to the owner. Other people receive only what they
// need to pay someone, via getGroupPaymentMethods, and only for members of a
// group they share.
//
// Legacy data (fields still on users/{uid}) is moved into the private doc the
// first time it is read, then deleted from the public doc.

const PRIVATE_FIELDS = ['paymentMethods', 'phoneNumber'];

function privatePath(uid) {
  return `users/${uid}/private/details`;
}

/** Combine private and legacy public data; private wins. Pure, for testing. */
function mergePrivate(privData = {}, userData = {}) {
  return {
    paymentMethods: privData.paymentMethods ?? userData.paymentMethods ?? {},
    phoneNumber:    privData.phoneNumber ?? userData.phoneNumber ?? '',
  };
}

function hasLegacyFields(userData = {}) {
  return PRIVATE_FIELDS.some(f => userData[f] !== undefined);
}

/** What another group member may see: enough to pay, never the IBAN itself. */
function publicPaymentView(pm = {}) {
  return {
    paypalUsername:  pm.paypalUsername || null,
    revolutUsername: pm.revolutUsername || null,
    bic:             pm.bic || null,
    hasIban:         !!pm.encryptedIBAN,
  };
}

/**
 * Loads a user's private data with the Admin SDK, migrating legacy fields.
 * @returns {Promise<{ref, data: {paymentMethods, phoneNumber}}>}
 */
async function loadPrivate(db, FieldValue, uid) {
  const privRef = db.doc(privatePath(uid));
  const userRef = db.doc(`users/${uid}`);
  const [privSnap, userSnap] = await Promise.all([privRef.get(), userRef.get()]);
  const privData = privSnap.exists ? privSnap.data() : {};
  const userData = userSnap.exists ? userSnap.data() : {};
  const data = mergePrivate(privData, userData);

  if (hasLegacyFields(userData)) {
    try {
      await privRef.set(data, { merge: true });
      await userRef.update({
        paymentMethods: FieldValue.delete(),
        phoneNumber:    FieldValue.delete(),
      });
    } catch (err) {
      console.warn('private data migration failed for', uid, err.message);
    }
  }
  return { ref: privRef, data };
}

module.exports = { PRIVATE_FIELDS, privatePath, mergePrivate, hasLegacyFields, publicPaymentView, loadPrivate };
