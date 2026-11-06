// src/components/hub/SpaceTile.jsx
// One space on the Hub. Shows that space's own summary only; amounts are
// listed per currency and never added together across spaces or currencies.

import { Lock } from 'lucide-react';
import { spaceStyle, SpaceIcon } from './spaceStyle';

/** "EUR 60.49" lines for a { currency: amount } map, largest first. */
export function moneyLines(byCurrency) {
  return Object.entries(byCurrency || {})
    .filter(([, amt]) => amt > 0.004)
    .sort((a, b) => b[1] - a[1])
    .map(([cur, amt]) => `${cur} ${amt.toFixed(2)}`);
}

export default function SpaceTile({ space, sub, lines = [], tone = 'neutral', onOpen }) {
  const st = spaceStyle(space);
  const toneClass = tone === 'owe' ? 'text-orange-700 dark:text-orange-300'
    : tone === 'owed' ? 'text-green-700 dark:text-green-300'
      : 'text-gray-900 dark:text-white';
  const shown = lines.slice(0, 2);
  const more = lines.length - shown.length;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col gap-2.5 min-w-0 p-4 text-left rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-card hover:border-blue-400 active:scale-[0.99] transition"
    >
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${st.solid}`}>
        <SpaceIcon space={space} size={22} />
      </span>
      <span>
        <span className="block text-base font-bold text-gray-900 dark:text-white">{space.name}</span>
        <span className="block text-xs text-gray-600 dark:text-gray-400">{sub}</span>
      </span>
      <span className={`block text-[15px] font-bold tabular-nums ${toneClass}`}>
        {shown.map((l) => <span key={l} className="block">{l}</span>)}
        {more > 0 ? <span className="block text-xs font-medium text-gray-600 dark:text-gray-400">and {more} more currenc{more === 1 ? 'y' : 'ies'}</span> : null}
      </span>
      <span className="inline-flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-400">
        <Lock size={12} aria-hidden="true" /> Separate ledger
      </span>
    </button>
  );
}
