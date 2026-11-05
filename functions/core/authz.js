// functions/core/authz.js
// Who is calling, and are they allowed? Authorisation is always decided from
// server data (the request's verified token and Firestore), never from
// anything the client claims about itself.

const { fail } = require('./errors');

/** Returns the caller's uid or throws unauthenticated. */
function requireAuth(request) {
  const uid = request && request.auth && request.auth.uid;
  if (!uid) throw fail('unauthenticated');
  return uid;
}

/** Platform admin (custom claim `admin: true`, as used by Taskmaster and the rules). */
function requireAdmin(request) {
  const uid = requireAuth(request);
  if (request.auth.token && request.auth.token.admin === true) return uid;
  throw fail('permission-denied');
}

/**
 * Seconds since the caller last signed in (the ID token's auth_time).
 * Infinity when unknown, so callers fail closed.
 */
function secondsSinceSignIn(request, nowMs = Date.now()) {
  const authTime = request && request.auth && request.auth.token && request.auth.token.auth_time;
  if (typeof authTime !== 'number') return Infinity;
  return Math.max(0, Math.floor(nowMs / 1000) - authTime);
}

const RECENT_SIGN_IN_SECONDS = 5 * 60;

/** True when the caller signed in (or re-authenticated) within the last 5 minutes. */
function signedInRecently(request, nowMs = Date.now()) {
  return secondsSinceSignIn(request, nowMs) <= RECENT_SIGN_IN_SECONDS;
}

/** Throws unless `uid` is in the document's `field` array (e.g. memberUids). */
function requireListed(data, field, uid) {
  if (!data || !Array.isArray(data[field]) || !data[field].includes(uid)) {
    throw fail('permission-denied');
  }
}

module.exports = {
  requireAuth, requireAdmin, secondsSinceSignIn, signedInRecently, requireListed,
  RECENT_SIGN_IN_SECONDS,
};
