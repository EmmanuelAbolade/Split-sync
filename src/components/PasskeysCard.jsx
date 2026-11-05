// src/components/PasskeysCard.jsx
// Settings card: passkeys used to confirm money actions (server-verified
// step-up). Separate from the existing device biometric login lock, which
// stays as it is. Adding or removing a passkey needs a fresh sign-in.

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Trash2, Plus } from 'lucide-react';
import { listPasskeys, registerPasskey, removePasskey, passkeysSupported, stepUpHint } from '../utils/stepUp';
import { ReauthForm } from './StepUpSheet';

function formatDate(ms) {
  if (!ms) return 'never';
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PasskeysCard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [pending, setPending] = useState(null); // action waiting for a fresh sign-in
  const [confirmingId, setConfirmingId] = useState(null); // passkey awaiting a second click to remove
  const supported = passkeysSupported();

  const refresh = useCallback(async () => {
    try {
      setItems(await listPasskeys());
    } catch {
      setMessage({ type: 'error', text: 'Could not load your passkeys.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const run = async (action) => {
    setBusy(true);
    setMessage({ type: '', text: '' });
    try {
      await action.fn();
      setPending(null);
      setMessage({ type: 'success', text: action.done });
      await refresh();
    } catch (err) {
      if (stepUpHint(err) === 'reauth') {
        setPending(action);
      } else if (err && err.name === 'NotAllowedError') {
        setMessage({ type: 'error', text: 'Cancelled.' });
      } else {
        setMessage({ type: 'error', text: (err && err.code === 'functions/already-exists') ? 'This passkey is already added.' : 'That did not work. Please try again.' });
      }
    } finally {
      setBusy(false);
    }
  };

  const add = () => run({ fn: () => registerPasskey(), done: 'Passkey added.' });
  const remove = (id) => run({
    fn: async () => { await removePasskey(id); setConfirmingId(null); },
    done: 'Passkey removed.',
  });

  return (
    <div className="py-3 px-4 bg-gray-50 dark:bg-gray-700/60 rounded-xl">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
          <KeyRound size={17} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        </div>
        <div>
          <p className="font-medium text-sm text-gray-900 dark:text-white">Passkeys for confirming payments</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Used to confirm money actions. Without one, you confirm by signing in again.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">Loading...</p>
      ) : (
        <ul className="space-y-2 mt-2">
          {items.length === 0 && <li className="text-xs text-gray-500 dark:text-gray-400">No passkeys yet.</li>}
          {items.map((p) => (
            <li
              key={p.id}
              className={`text-sm rounded-lg px-3 py-2 ${confirmingId === p.id
                ? 'bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700'
                : 'bg-white dark:bg-gray-800'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-900 dark:text-white">{p.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Added {formatDate(p.createdAt)} · last used {formatDate(p.lastUsedAt)}</p>
                </div>
                {confirmingId !== p.id && (
                  <button
                    type="button"
                    onClick={() => { setMessage({ type: '', text: '' }); setConfirmingId(p.id); }}
                    disabled={busy}
                    aria-label={`Remove passkey ${p.label}`}
                    className="p-2 text-red-500 hover:text-red-700 disabled:opacity-50"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
              {confirmingId === p.id && (
                <div className="mt-2">
                  <p className="text-xs text-red-700 dark:text-red-300">
                    Remove this passkey? You will no longer be able to use it to confirm payments on this device.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => remove(p.id)}
                      disabled={busy}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {busy ? 'Removing...' : 'Yes, remove'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      disabled={busy}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                    >
                      Keep it
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {pending ? (
        <div className="mt-3">
          <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">Please confirm it's you first.</p>
          <ReauthForm onDone={() => run(pending)} submitLabel="Confirm" />
        </div>
      ) : (
        supported && (
          <button
            type="button"
            onClick={add}
            disabled={busy || loading}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold border-2 border-emerald-500 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50"
          >
            <Plus size={16} aria-hidden="true" />
            Add a passkey on this device
          </button>
        )
      )}
      {!supported && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">This browser does not support passkeys.</p>}

      {message.text && (
        <p role={message.type === 'error' ? 'alert' : 'status'} className={`mt-2 text-xs ${message.type === 'error' ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-300'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
