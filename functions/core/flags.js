// functions/core/flags.js
// Server-enforced feature flags. The client reads the same document only to
// decide what to show; every Function re-checks here (a hidden button is not
// a security control).
//
// Document: config/features (default database), written only by admin.setFlag
//   { circlesEnabled: { enabled: false, allowUids: [] }, ..., updatedAt, updatedBy }

const { fail } = require('./errors');

const FLAG_NAMES = [
  'circlesEnabled',       // master switch for the Circles extension (hub, + sheet)
  'eventsEnabled',
  'refundsEnabled',
  'circlesSpaceEnabled',  // the Circles (ROSCA) space itself
  'loansEnabled',
  'aidEnabled',
  'trustEnabled',
  'paymentDemosEnabled',  // PayPal sandbox + SEPA simulation in Settle Up
];

const MAX_ALLOW_UIDS = 50;

/**
 * True when the flag is on for everyone, or the uid is on its allow-list.
 * Missing, malformed or unknown flags are OFF (fail closed).
 */
function isEnabledFor(features, flagName, uid) {
  if (!FLAG_NAMES.includes(flagName)) return false;
  const flag = features && features[flagName];
  if (!flag || typeof flag !== 'object') return false;
  if (flag.enabled === true) return true;
  return Boolean(uid) && Array.isArray(flag.allowUids) && flag.allowUids.includes(uid);
}

// Short in-memory cache per Function instance, so a burst of calls costs one read.
const CACHE_MS = 30 * 1000;
let cache = { at: 0, data: null };

async function loadFeatures(db, now = Date.now()) {
  if (cache.data && now - cache.at < CACHE_MS) return cache.data;
  const snap = await db.doc('config/features').get();
  cache = { at: now, data: snap.exists ? snap.data() : {} };
  return cache.data;
}

/** Throws failed-precondition unless the flag is on for this uid. */
async function requireFlag(db, flagName, uid) {
  const features = await loadFeatures(db);
  if (!isEnabledFor(features, flagName, uid)) throw fail('failed-precondition');
}

function clearCache() { cache = { at: 0, data: null }; }

module.exports = { FLAG_NAMES, MAX_ALLOW_UIDS, isEnabledFor, loadFeatures, requireFlag, clearCache };
