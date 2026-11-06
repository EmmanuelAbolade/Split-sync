// src/pages/spaces/SpaceHome.jsx
// Entry page for a space that is switched on for this user but not built
// yet (Events, Circles, Loans, Aid arrive in Phases 3 to 7). It explains what
// the space will hold so a tester never meets a blank screen.

import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Hammer } from 'lucide-react';
import { spaceStyle, SpaceIcon } from '../../components/hub/spaceStyle';
import AppTopBar from '../../components/AppTopBar';

export default function SpaceHome({ space }) {
  const navigate = useNavigate();
  const st = spaceStyle(space);
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-28">
      <AppTopBar />
      <header className={`bg-gradient-to-br ${st.hero} text-white`}>
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            aria-label="Back to Home"
            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-white/15 active:scale-95 transition"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{space.name}</h1>
            <p className="text-sm text-white/85">{space.blurb}</p>
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-5 flex flex-col gap-4">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-card p-5 flex items-start gap-4">
          <span className={`w-11 h-11 flex-shrink-0 rounded-xl flex items-center justify-center ${st.soft}`}>
            <SpaceIcon space={space} size={22} />
          </span>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Hammer size={16} aria-hidden="true" /> Being built
            </h2>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              {space.name} is switched on for you as a tester. Its screens arrive in a later phase; nothing here can be used yet.
            </p>
          </div>
        </div>
        <p className="flex items-start gap-2 rounded-xl bg-gray-100 dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300">
          <Lock size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          Balances here will be calculated only from this space. Settling a debt here never changes a balance in another space.
        </p>
      </main>
    </div>
  );
}
