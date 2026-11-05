// src/utils/postAuthRedirect.js
// Remembers where a signed-out user was going (for example an invite link,
// /invite/:groupId) so they land there after signing in or registering,
// instead of always on /dashboard.
//
// Stored in sessionStorage so it survives the Login <-> Register switch and the
// Google sign-in popup, but not a new browser session. Logout clears
// sessionStorage, so a target never carries over to another account.
//
// Security: only same-origin, absolute in-app paths are accepted. Anything that
// could redirect off-site ("//evil.com", "/\evil.com", "https://...") or loop
// back to an auth page is rejected (open-redirect protection).

const KEY = 'splitsync.postAuthRedirect';
const FALLBACK = '/dashboard';
const AUTH_PAGES = /^\/(login|register|forgot-password)(\/|\?|#|$)/;

/**
 * @brief Whether a value is a safe in-app path to redirect to after sign-in.
 * @param {*} path Candidate path, for example "/invite/abc".
 * @returns {boolean} True only for "/..." paths that stay on this origin and are not auth pages.
 */
export function isSafeInternalPath(path) {
  return typeof path === 'string' &&
    path.length > 1 && path.length <= 512 &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.includes('\\') &&
    !hasControlCharacter(path) &&
    !AUTH_PAGES.test(path);
}

/** True if the string contains an ASCII control character (code < 32 or 127). */
function hasControlCharacter(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 32 || c === 127) return true;
  }
  return false;
}

/**
 * @brief Remembers the page a signed-out user tried to open.
 * @param {string} path Path (with optional query) to return to after sign-in; ignored if unsafe.
 */
export function rememberRedirect(path) {
  if (!isSafeInternalPath(path)) return;
  try { sessionStorage.setItem(KEY, path); } catch { /* storage unavailable */ }
}

/**
 * @brief Returns the remembered target without clearing it.
 * @returns {string} The remembered safe path, or "/dashboard".
 */
export function peekRedirect() {
  let path = null;
  try { path = sessionStorage.getItem(KEY); } catch { /* storage unavailable */ }
  return isSafeInternalPath(path) ? path : FALLBACK;
}

/**
 * @brief Forgets the remembered target (called once the user is inside the app).
 */
export function clearRedirect() {
  try { sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}
