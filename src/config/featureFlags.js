// src/config/featureFlags.js
// Client copy of the flag rules in functions/core/flags.js. The client uses it
// only to decide what to SHOW; every Cloud Function re-checks the same flag,
// so a hidden button is never the only protection.

export const FLAG_NAMES = [
  'circlesEnabled',
  'eventsEnabled',
  'refundsEnabled',
  'circlesSpaceEnabled',
  'loansEnabled',
  'aidEnabled',
  'trustEnabled',
  'paymentDemosEnabled',
];

/**
 * True when the flag is on for everyone, or `uid` is on its allow-list.
 * Missing, malformed or unknown flags are off.
 */
export function isEnabledFor(features, flagName, uid) {
  if (!FLAG_NAMES.includes(flagName)) return false;
  const flag = features && features[flagName];
  if (!flag || typeof flag !== 'object') return false;
  if (flag.enabled === true) return true;
  return Boolean(uid) && Array.isArray(flag.allowUids) && flag.allowUids.includes(uid);
}
