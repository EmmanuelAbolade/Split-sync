// functions/core/errors.js
// One place for the errors the money pipeline returns. Messages are safe to
// show to users and never echo the caller's input (no amounts, names or ids).

const { HttpsError } = require('firebase-functions/v2/https');

const MESSAGES = {
  'unauthenticated': 'Please sign in again.',
  'failed-precondition': 'This feature is not available yet.',
  'invalid-argument': 'Some details are missing or not valid.',
  'resource-exhausted': 'Too many attempts. Please wait a moment and try again.',
  'permission-denied': 'You are not allowed to do this.',
  'not-found': 'That item could not be found.',
  'already-exists': 'This has already been done.',
  'aborted': 'Something changed while saving. Please try again.',
  'internal': 'Something went wrong. Please try again.',
};

/**
 * Builds an HttpsError with a safe default message.
 * @param {string} code    Firebase callable error code
 * @param {string} [message] Optional user-facing message (must not contain user input)
 * @param {object} [details] Optional machine-readable details for the client
 */
function fail(code, message, details) {
  return new HttpsError(code, message || MESSAGES[code] || MESSAGES.internal, details);
}

/** The error a money Function returns when a step-up token is missing or invalid. */
function stepUpRequired() {
  return fail('unauthenticated', 'Please confirm it is you to continue.', { stepUp: 'required' });
}

/**
 * Turns any thrown value into an HttpsError so internal details never reach
 * the client. HttpsErrors pass through unchanged; anything else is logged
 * (message only, under `label`) and becomes a generic internal error.
 */
function toHttpsError(err, label = 'function') {
  if (err instanceof HttpsError) return err;
  console.error(`${label} failed:`, err && err.message);
  return fail('internal');
}

module.exports = { fail, stepUpRequired, toHttpsError, MESSAGES, HttpsError };
