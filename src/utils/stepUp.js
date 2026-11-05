// src/utils/stepUp.js
// Client side of server-verified step-up (decision D2). A money action asks
// the server for a challenge bound to the exact action, proves it is the user
// (passkey, or signing in again), and receives a single-use token that the
// money Function checks. See functions/stepUp/service.js.
//
// actionHash() must match functions/core/canonical.js byte for byte; both are
// tested against functions/core/canonical.fixtures.json.

import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup,
} from 'firebase/auth';
import { startAuthentication, startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import app, { auth } from '../services/firebase';

// ---- hashing -------------------------------------------------------------------

export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('non-finite number');
    if (value === undefined) return 'null';
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 of the action and all its parameters except the step-up token. */
export async function actionHash(action, params) {
  // eslint-disable-next-line no-unused-vars
  const { stepUpToken, ...rest } = params || {};
  return sha256Hex(canonicalJson({ action, params: rest }));
}

/** A fresh idempotency key for one money action (reuse it when retrying that action). */
export function newIdempotencyKey() {
  return window.crypto.randomUUID();
}

// ---- server calls ------------------------------------------------------------

function call(name, data) {
  const fn = httpsCallable(getFunctions(app, 'us-central1'), name);
  return fn(data).then((r) => r.data);
}

/** Starts step-up for one action. Resolves to { challengeId, methods, webauthn }. */
export async function beginStepUp(action, params) {
  return call('stepUp-begin', { actionHash: await actionHash(action, params) });
}

/** Completes with the passkey on this device. Resolves to { stepUpToken }. */
export async function completeWithPasskey(challengeId, optionsJSON) {
  const response = await startAuthentication({ optionsJSON });
  return call('stepUp-complete', { method: 'webauthn', challengeId, response });
}

/** Completes using a sign-in from the last five minutes. */
export function completeWithRecentLogin(challengeId) {
  return call('stepUp-complete', { method: 'recentLogin', challengeId });
}

/** How this user can sign in again: 'password', 'google' or null. */
export function reauthMethod(user = auth.currentUser) {
  const ids = ((user && user.providerData) || []).map((p) => p.providerId);
  if (ids.includes('password')) return 'password';
  if (ids.includes('google.com')) return 'google';
  return null;
}

/**
 * Signs the current user in again (password or Google), then refreshes the ID
 * token so the server sees the new sign-in time.
 */
export async function reauthenticate(password) {
  const user = auth.currentUser;
  if (!user) throw new Error('not signed in');
  const method = reauthMethod(user);
  if (method === 'password') {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password || ''));
  } else if (method === 'google') {
    await reauthenticateWithPopup(user, new GoogleAuthProvider());
  } else {
    throw new Error('no sign-in method available');
  }
  await user.getIdToken(true);
}

/** True when the server asked for a step-up (or a fresh sign-in). */
export function stepUpHint(err) {
  return (err && err.details && err.details.stepUp) || null;
}

// ---- passkeys (Settings) --------------------------------------------------------

export function passkeysSupported() {
  try { return browserSupportsWebAuthn(); } catch { return false; }
}

export async function registerPasskey(label) {
  const { challengeId, webauthn } = await call('stepUp-registerBegin', {});
  const response = await startRegistration({ optionsJSON: webauthn });
  return call('stepUp-registerComplete', { challengeId, response, ...(label ? { label } : {}) });
}

export function listPasskeys() {
  return call('stepUp-listCredentials', {}).then((r) => r.credentials || []);
}

export function removePasskey(id) {
  return call('stepUp-removeCredential', { id });
}
