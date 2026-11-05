// src/components/StepUpSheet.jsx
// "Confirm it's you" sheet shown before a money action. It gets a server
// challenge for the exact action, then either uses this device's passkey or
// a fresh sign-in (password or Google), and hands back a single-use token.
//
// Usage:
//   <StepUpSheet open action="circles.claimContribution" params={{...}}
//     onConfirmed={(token) => ...} onCancel={() => ...} />

import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Fingerprint, KeyRound, X } from 'lucide-react';
import {
  beginStepUp, completeWithPasskey, completeWithRecentLogin, reauthenticate, reauthMethod, stepUpHint,
} from '../utils/stepUp';

function friendly(err) {
  const code = (err && err.code) || '';
  if (code.includes('wrong-password') || code.includes('invalid-credential')) return 'That password is not right.';
  if (code.includes('too-many-requests') || code.includes('resource-exhausted')) return 'Too many attempts. Please wait a moment and try again.';
  if (code.includes('popup-closed') || code.includes('cancelled') || (err && err.name === 'NotAllowedError')) return 'Confirmation was cancelled.';
  if (stepUpHint(err) === 'expired') return 'That took too long. Please try again.';
  return 'We could not confirm it is you. Please try again.';
}

/** Password or Google sign-in again. Calls onDone() once the fresh sign-in is in place. */
export function ReauthForm({ onDone, busyLabel = 'Checking...', submitLabel = 'Confirm' }) {
  const method = reauthMethod();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    if (e) e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await reauthenticate(password);
      setPassword('');
      await onDone();
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  };

  if (!method) {
    return <p className="text-sm text-gray-600 dark:text-gray-300">Please sign out and sign in again to continue.</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {method === 'password' ? (
        <>
          <label htmlFor="stepup-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Enter your password
          </label>
          <input
            id="stepup-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500 outline-none"
            required
          />
        </>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-300">Sign in with Google again to confirm.</p>
      )}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy || (method === 'password' && !password)}
        className="w-full flex items-center justify-center gap-2 bg-primary dark:bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-hover dark:hover:bg-indigo-700 transition disabled:opacity-50"
      >
        <KeyRound size={18} aria-hidden="true" />
        {busy ? busyLabel : method === 'google' ? 'Continue with Google' : submitLabel}
      </button>
    </form>
  );
}

export default function StepUpSheet({ open, action, params, onConfirmed, onCancel }) {
  const [stage, setStage] = useState('starting'); // starting | choose | reauth | working | error
  const [challenge, setChallenge] = useState(null);
  const [error, setError] = useState('');
  const confirmedRef = useRef(onConfirmed);
  confirmedRef.current = onConfirmed;
  const paramsKey = JSON.stringify(params || {});

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setStage('starting');
    setError('');
    setChallenge(null);
    beginStepUp(action, JSON.parse(paramsKey))
      .then((c) => {
        if (cancelled) return;
        setChallenge(c);
        setStage('choose');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(friendly(err));
        setStage('error');
      });
    return () => { cancelled = true; };
  }, [open, action, paramsKey]);

  if (!open) return null;

  const finish = (result) => confirmedRef.current(result.stepUpToken);

  const usePasskey = async () => {
    setStage('working');
    setError('');
    try {
      finish(await completeWithPasskey(challenge.challengeId, challenge.webauthn));
    } catch (err) {
      setError(friendly(err));
      setStage('choose');
    }
  };

  // Try a recent sign-in first; only ask for the password if it is too old.
  const useSignIn = async () => {
    setStage('working');
    setError('');
    try {
      finish(await completeWithRecentLogin(challenge.challengeId));
    } catch (err) {
      if (stepUpHint(err) === 'reauth') {
        setStage('reauth');
      } else {
        setError(friendly(err));
        setStage('choose');
      }
    }
  };

  const afterReauth = async () => {
    finish(await completeWithRecentLogin(challenge.challengeId));
  };

  const hasPasskey = Boolean(challenge && challenge.methods && challenge.methods.includes('webauthn'));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stepup-title"
        className="w-full sm:max-w-md bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-primary dark:text-indigo-400" size={22} aria-hidden="true" />
            <h2 id="stepup-title" className="text-lg font-semibold text-gray-900 dark:text-white">Confirm it's you</h2>
          </div>
          <button type="button" onClick={onCancel} aria-label="Cancel" className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          For your safety, money actions need a quick check that it is really you.
        </p>

        {stage === 'starting' && <p className="text-sm text-gray-500 dark:text-gray-400">Preparing...</p>}
        {stage === 'working' && <p className="text-sm text-gray-500 dark:text-gray-400">Checking...</p>}

        {stage === 'choose' && (
          <div className="space-y-3">
            {hasPasskey && (
              <button
                type="button"
                onClick={usePasskey}
                className="w-full flex items-center justify-center gap-2 bg-primary dark:bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-hover dark:hover:bg-indigo-700 transition"
              >
                <Fingerprint size={18} aria-hidden="true" />
                Use passkey
              </button>
            )}
            <button
              type="button"
              onClick={useSignIn}
              className={hasPasskey
                ? 'w-full py-3 rounded-lg font-semibold border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition'
                : 'w-full flex items-center justify-center gap-2 bg-primary dark:bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-hover dark:hover:bg-indigo-700 transition'}
            >
              {hasPasskey ? 'Sign in again instead' : 'Continue'}
            </button>
          </div>
        )}

        {stage === 'reauth' && <ReauthForm onDone={afterReauth} />}

        {error && stage !== 'reauth' && (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {stage === 'error' && (
          <button type="button" onClick={onCancel} className="mt-4 w-full py-3 rounded-lg font-semibold border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200">
            Close
          </button>
        )}
      </div>
    </div>
  );
}
