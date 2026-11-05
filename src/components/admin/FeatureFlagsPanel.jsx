// src/components/admin/FeatureFlagsPanel.jsx
// Taskmaster: view and change Circles feature flags. Changes go through the
// admin-setFlag Cloud Function (admin claim checked on the server, audit
// logged). Flags stay OFF in production until the product owner approves a
// space; the allow-list lets named testers try a space first.

import { useCallback, useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Flag, RefreshCw } from 'lucide-react';
import app, { db } from '../../services/firebase';
import { FLAG_NAMES } from '../../config/featureFlags';

const DESCRIPTIONS = {
  circlesEnabled: 'Master switch for the Circles extension (Hub, + sheet). Other spaces also need this.',
  eventsEnabled: 'Events space: shared budgets for trips and occasions.',
  refundsEnabled: 'Refund requests on expenses.',
  circlesSpaceEnabled: 'Circles space: rotating savings groups.',
  loansEnabled: 'Loans space: interest-free loans between people who know each other.',
  aidEnabled: 'Aid space: group support requests.',
  trustEnabled: 'Trust score and per-space Stats.',
};

/** Splits a comma, space or newline separated list into unique, non-empty uids. */
export function parseUidList(text) {
  return [...new Set(String(text || '').split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
}

function FlagRow({ name, value, onSave }) {
  const [enabled, setEnabled] = useState(Boolean(value && value.enabled));
  const [uids, setUids] = useState(((value && value.allowUids) || []).join('\n'));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEnabled(Boolean(value && value.enabled));
    setUids(((value && value.allowUids) || []).join('\n'));
  }, [value]);

  const save = async () => {
    setBusy(true);
    try { await onSave(name, enabled, parseUidList(uids)); } finally { setBusy(false); }
  };

  const status = value && value.enabled ? 'On for everyone'
    : value && value.allowUids && value.allowUids.length ? `Testers only (${value.allowUids.length})` : 'Off';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-semibold text-gray-900 dark:text-white">{name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{DESCRIPTIONS[name]}</p>
        </div>
        <span className="text-xs whitespace-nowrap px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">{status}</span>
      </div>
      <label className="flex items-center gap-2 mt-3 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} aria-label={`${name} on for everyone`} />
        On for everyone
      </label>
      <label htmlFor={`uids-${name}`} className="block mt-3 text-xs font-medium text-gray-600 dark:text-gray-400">
        Testers (user IDs, one per line, up to 50)
      </label>
      <textarea
        id={`uids-${name}`}
        rows={2}
        value={uids}
        onChange={(e) => setUids(e.target.value)}
        className="mt-1 w-full px-3 py-2 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      />
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="mt-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {busy ? 'Saving...' : `Save ${name}`}
      </button>
    </div>
  );
}

export default function FeatureFlagsPanel() {
  const [features, setFeatures] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setNotice(null);
    try {
      const snap = await getDoc(doc(db, 'config', 'features'));
      setFeatures(snap.exists() ? snap.data() : {});
    } catch {
      setFeatures({});
      setNotice({ kind: 'error', text: 'Could not load the flags.' });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (flag, enabled, allowUids) => {
    setNotice(null);
    try {
      const setFlag = httpsCallable(getFunctions(app, 'us-central1'), 'admin-setFlag');
      const { data } = await setFlag({ flag, enabled, allowUids });
      setFeatures((f) => ({ ...(f || {}), [flag]: { enabled: data.enabled, allowUids: data.allowUids } }));
      setNotice({ kind: 'success', text: `${flag} saved.` });
    } catch (err) {
      const text = err && err.code === 'functions/permission-denied' ? 'Only platform admins can change flags.'
        : err && err.code === 'functions/invalid-argument' ? 'Check the tester list (up to 50 valid user IDs).'
          : 'Could not save the flag.';
      setNotice({ kind: 'error', text });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Flag size={20} aria-hidden="true" /> Feature Flags
        </h2>
        <button type="button" onClick={load} className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      </div>
      <div className="p-3 mb-4 border rounded-xl text-sm bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200">
        Keep flags off for everyone until a space has been reviewed and approved. Use the tester list to try a space with named accounts. Every change is recorded in the audit log.
      </div>
      {notice && (
        <p role={notice.kind === 'error' ? 'alert' : 'status'} className={`mb-4 text-sm ${notice.kind === 'error' ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
          {notice.text}
        </p>
      )}
      {features === null ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {FLAG_NAMES.map((name) => <FlagRow key={name} name={name} value={features[name]} onSave={save} />)}
        </div>
      )}
    </div>
  );
}
