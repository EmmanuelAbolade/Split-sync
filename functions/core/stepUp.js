// functions/core/stepUp.js
// Server-verified step-up (decision D2, FR-CORE-08). A money Function only
// runs with a step-up token that is:
//   - issued by stepUp-complete after a verified passkey assertion or a
//     sign-in less than 5 minutes old,
//   - bound to the caller's uid and to the hash of this exact action,
//   - unexpired (5 minutes) and unused (single use).
// Tokens are stored by their SHA-256, so a database read never reveals a
// usable token.

const crypto = require('crypto');
const { stepUpRequired } = require('./errors');
const { sha256Hex, actionHash } = require('./canonical');

const CHALLENGE_TTL_MS = 2 * 60 * 1000;
const TOKEN_TTL_MS = 5 * 60 * 1000;

// Web origins allowed to run the passkey ceremony. A passkey is tied to the
// exact host it was created on (web.app is a public suffix), so each origin
// is its own relying party.
const ALLOWED_ORIGINS = [
  'https://splitsync-dev.web.app',
  'https://splitsync-dev.firebaseapp.com',
  'http://localhost:3000',
];
// This project's own Hosting preview channels (only the project owner can deploy to them)
const PREVIEW_ORIGIN = /^https:\/\/splitsync-dev--[a-z0-9-]{1,60}\.web\.app$/;

function isAllowedOrigin(origin) {
  return typeof origin === 'string' && (ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN.test(origin));
}

/** The relying-party ID for an allowed origin: its host name. */
function rpIdFor(origin) {
  if (!isAllowedOrigin(origin)) return null;
  return new URL(origin).hostname;
}

function randomId(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Creates a token record inside `tx` and returns the token (shown to the client once). */
function issueToken(tx, db, { uid, hash, method, nowMs = Date.now() }) {
  const token = randomId(32);
  tx.create(db.collection('stepUpTokens').doc(sha256Hex(token)), {
    uid, actionHash: hash, method, used: false,
    createdAt: new Date(nowMs),
    expiresAt: new Date(nowMs + TOKEN_TTL_MS),
  });
  return token;
}

/**
 * Checks and burns a token in one transaction. Any problem (missing, wrong
 * user, wrong action, expired, already used) gives the same step-up error, so
 * the caller learns nothing about why.
 */
async function consumeToken(db, { uid, token, hash, nowMs = Date.now() }) {
  if (typeof token !== 'string' || token.length < 32 || token.length > 128) throw stepUpRequired();
  const ref = db.collection('stepUpTokens').doc(sha256Hex(token));
  const ok = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const t = snap.data();
    const expires = t.expiresAt && t.expiresAt.toMillis ? t.expiresAt.toMillis() : new Date(t.expiresAt).getTime();
    if (t.used || t.uid !== uid || t.actionHash !== hash || !(expires > nowMs)) return false;
    tx.update(ref, { used: true, usedAt: new Date(nowMs) });
    return true;
  });
  if (!ok) throw stepUpRequired();
}

/**
 * For money Functions: requires a valid token for `action` with these exact
 * parameters (everything in `data` except stepUpToken).
 */
async function requireStepUp(db, uid, action, data, nowMs = Date.now()) {
  await consumeToken(db, { uid, token: data && data.stepUpToken, hash: actionHash(action, data), nowMs });
}

module.exports = {
  CHALLENGE_TTL_MS, TOKEN_TTL_MS, ALLOWED_ORIGINS, PREVIEW_ORIGIN,
  isAllowedOrigin, rpIdFor, randomId, issueToken, consumeToken, requireStepUp,
};
