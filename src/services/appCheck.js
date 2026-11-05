// src/services/appCheck.js
// Firebase App Check in MONITOR mode (Phase 1): the app attaches App Check
// tokens so the Firebase console can show how much traffic would pass, but
// nothing is rejected until enforcement is switched on in the console
// (planned for Phase 9).
//
// It only starts when REACT_APP_RECAPTCHA_ENTERPRISE_SITE_KEY is set (a public
// site key, not a secret), so builds without it behave exactly as before.

import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

let started = false;

export function startAppCheck(app, env = process.env) {
  if (started) return true;
  const siteKey = env.REACT_APP_RECAPTCHA_ENTERPRISE_SITE_KEY;
  if (!siteKey || env.NODE_ENV === 'test') return false;
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    started = true;
  } catch (err) {
    // Never block the app: monitor mode must be invisible to users
    console.warn('App Check could not start');
  }
  return started;
}
