// functions/core/canonical.js
// Deterministic JSON (object keys sorted at every level) and its SHA-256.
// The browser computes the same hash in src/utils/stepUp.js, so both sides
// must agree byte for byte; shared fixtures in core/canonical.test.js and
// src/utils/stepUp.test.js keep them in step.

const crypto = require('crypto');

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('non-finite number');
    if (value === undefined) return 'null';
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}

function sha256Hex(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * The hash a step-up token is bound to: the action name plus every parameter
 * except the token itself. The idempotency key is included, so a token
 * authorises exactly one request and cannot be reused with other amounts,
 * recipients or keys.
 */
function actionHash(action, params) {
  // eslint-disable-next-line no-unused-vars
  const { stepUpToken, ...rest } = params || {};
  return sha256Hex(canonicalJson({ action, params: rest }));
}

module.exports = { canonicalJson, sha256Hex, actionHash };
