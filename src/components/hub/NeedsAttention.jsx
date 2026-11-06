// src/components/hub/NeedsAttention.jsx
// Tasks from every space (not money totals). Each item names its space and
// opens the screen where the task is done.

import { ChevronRight, CheckCircle2 } from 'lucide-react';
import { getSpace } from '../../config/spaces';
import { spaceStyle, SpaceIcon } from './spaceStyle';

/**
 * Builds the list from what the Hub knows today (Expenses only):
 * payments waiting for the user to confirm, then their largest debt.
 */
export function attentionItems({ notifications = [], highestDebt = null }) {
  const items = [];
  notifications
    .filter((n) => n.type === 'payment_confirmation_needed' && n.requiresAction && (n.actionStatus || 'pending') === 'pending')
    .forEach((n) => {
      const d = n.data || {};
      items.push({
        key: `confirm-${n.id}`,
        spaceId: 'expenses',
        title: `Confirm a payment from ${d.payerName || 'a member'}`,
        sub: `${d.groupName || 'Your group'} · ${d.currency || ''} ${Number(d.amount || 0).toFixed(2)}`.trim(),
        to: d.groupId ? `/group/${d.groupId}` : '/spaces/expenses',
      });
    });
  if (highestDebt) {
    items.push({
      key: `settle-${highestDebt.groupId}`,
      spaceId: 'expenses',
      title: `Settle ${highestDebt.currency} ${highestDebt.amount.toFixed(2)}`,
      sub: `${highestDebt.groupName || 'Your group'} · your largest debt`,
      to: `/group/${highestDebt.groupId}`,
    });
  }
  return items;
}

export default function NeedsAttention({ items, onOpen, loading }) {
  return (
    <section aria-labelledby="needs-attention" className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-card p-4">
      <div className="flex items-baseline gap-2 mb-1">
        <h2 id="needs-attention" className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">Needs attention</h2>
        <span className="flex-1" />
        <span className="text-xs text-gray-600 dark:text-gray-400">From all your spaces</span>
      </div>
      {loading ? (
        <p className="py-3 text-sm text-gray-600 dark:text-gray-400">Checking your spaces…</p>
      ) : items.length === 0 ? (
        <p className="flex items-center gap-2 py-3 text-sm text-gray-700 dark:text-gray-300">
          <CheckCircle2 size={18} className="text-green-600" aria-hidden="true" /> Nothing needs you right now.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {items.map((it) => {
            const space = getSpace(it.spaceId);
            const st = spaceStyle(space);
            return (
              <li key={it.key}>
                <button
                  type="button"
                  onClick={() => onOpen(it.to)}
                  className="w-full flex items-center gap-3 py-3 text-left active:scale-[0.99] transition"
                >
                  <span className={`w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center ${st.soft}`}>
                    <SpaceIcon space={space} size={18} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-gray-900 dark:text-white">{it.title}</span>
                    <span className="block text-xs text-gray-600 dark:text-gray-400">
                      <span className={`font-semibold ${st.text}`}>{space.name}</span> · {it.sub}
                    </span>
                  </span>
                  <ChevronRight size={18} className="text-gray-500" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
