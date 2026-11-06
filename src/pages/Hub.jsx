// src/pages/Hub.jsx
// Home when circlesEnabled is on: a hub of spaces (approved mockup
// splitsync-hub.html). Needs attention gathers tasks, not money; each tile
// shows only its own space's summary. Today's Home lives on unchanged in the
// Expenses space (/spaces/expenses).

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { SlidersHorizontal, Shield, Plus } from 'lucide-react';
import { db } from '../services/firebase';
import { useAuthStore } from '../stores/authStore';
import { useNotificationsStore } from '../stores/notificationsStore';
import AppTopBar from '../components/AppTopBar';
import { CyclingTagline } from './Dashboard';
import useSpaces from '../hooks/useSpaces';
import useExpensesSummary from '../hooks/useExpensesSummary';
import useHubPrefs from '../hooks/useHubPrefs';
import SpaceTile, { moneyLines } from '../components/hub/SpaceTile';
import NeedsAttention, { attentionItems } from '../components/hub/NeedsAttention';
import CustomiseHomeSheet from '../components/hub/CustomiseHomeSheet';

export function expensesTileText(summary) {
  const owe = moneyLines(summary.owe);
  const owed = moneyLines(summary.owed);
  if (summary.loading) return { lines: ['Loading…'], tone: 'neutral' };
  if (owe.length) return { lines: owe.map((l) => `You owe ${l}`), tone: 'owe' };
  if (owed.length) return { lines: owed.map((l) => `Owed ${l}`), tone: 'owed' };
  return { lines: ['All settled up'], tone: 'neutral' };
}

export default function Hub() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { notifications } = useNotificationsStore();
  const { spaces } = useSpaces();
  const summary = useExpensesSummary(user?.uid, true);
  const { hidden, saveHidden } = useHubPrefs(user?.uid);
  const [photoURL, setPhotoURL] = useState(null);
  const [customising, setCustomising] = useState(false);
  const [toast, setToast] = useState('');

  // Profile photo, as on the original Home
  useEffect(() => {
    if (!user?.uid) return undefined;
    let live = true;
    getDoc(doc(db, 'users', user.uid))
      .then((snap) => { if (live && snap.exists()) setPhotoURL(snap.data().photoURL || null); })
      .catch(() => {});
    return () => { live = false; };
  }, [user?.uid]);

  const shown = spaces.filter((s) => !hidden.includes(s.id));
  const hiddenCount = spaces.length - shown.length;
  const firstName = (user?.displayName || '').split(' ')[0] || 'there';
  const today = new Date().toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const items = attentionItems({ notifications: notifications || [], highestDebt: summary.highestDebt });

  const tileFor = (s) => {
    if (s.id === 'expenses') {
      const t = expensesTileText(summary);
      return { sub: summary.loading ? 'Your groups' : `${summary.groupCount} group${summary.groupCount === 1 ? '' : 's'}`, ...t };
    }
    return { sub: s.blurb, lines: ['Coming soon'], tone: 'neutral' };
  };

  const closeCustomise = (saved) => {
    setCustomising(false);
    if (saved) {
      setToast('Home updated');
      setTimeout(() => setToast(''), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-28">
      <AppTopBar />

      <main className="max-w-2xl mx-auto px-4 py-5 flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            title="Go to your profile"
            aria-label="Go to your profile"
            className="w-14 h-14 flex-shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-primary to-primary-dark shadow-card-hover hover:ring-2 hover:ring-indigo-400 transition"
          >
            {photoURL ? (
              <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="w-full h-full flex items-center justify-center text-xl font-bold text-white">{firstName.charAt(0).toUpperCase()}</span>
            )}
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back, {firstName}!</h1>
            <CyclingTagline />
            <p className="text-sm text-gray-500 dark:text-gray-400">{today}</p>
          </div>
        </div>

        <NeedsAttention items={items} loading={summary.loading} onOpen={(to) => navigate(to)} />

        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-lg font-bold text-gray-900 dark:text-white">Your spaces</h2>
          <button
            type="button"
            onClick={() => setCustomising(true)}
            className="inline-flex items-center gap-2 min-h-[40px] px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-900 dark:text-white hover:bg-gray-50 active:scale-[0.97] transition"
          >
            <SlidersHorizontal size={16} aria-hidden="true" /> Customise
          </button>
        </div>

        <p className="flex items-start gap-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 px-3 py-2.5 text-sm text-blue-900 dark:text-blue-100">
          <Shield size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          Each space keeps its own ledger. Money in one space is never added to or settled against another.
        </p>

        <div className="grid grid-cols-1 min-[381px]:grid-cols-2 gap-3">
          {shown.map((s) => {
            const t = tileFor(s);
            return <SpaceTile key={s.id} space={s} sub={t.sub} lines={t.lines} tone={t.tone} onOpen={() => navigate(s.route)} />;
          })}
          {hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setCustomising(true)}
              className="min-[381px]:col-span-2 flex items-center gap-3 p-4 text-left rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 active:scale-[0.99] transition"
            >
              <span className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center">
                <Plus size={22} aria-hidden="true" />
              </span>
              <span>
                <span className="block font-bold text-gray-900 dark:text-white">Add a space</span>
                <span className="block text-xs text-gray-600 dark:text-gray-400">{hiddenCount} hidden</span>
              </span>
            </button>
          ) : null}
        </div>
      </main>

      {toast ? (
        <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-28 z-50 rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium shadow-card-3d">
          {toast}
        </div>
      ) : null}

      <CustomiseHomeSheet open={customising} onClose={closeCustomise} spaces={spaces} hidden={hidden} onSave={saveHidden} />
    </div>
  );
}
