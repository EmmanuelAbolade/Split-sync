// src/components/ActionSheet.jsx
// What the centre + opens when circlesEnabled is on: one action per enabled
// space. Inside a space, that space's actions come first, then "Other spaces".
// "Add an expense" opens the existing Quick Add flow. Spaces that are not
// built yet open their space page, which says so.

import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import BottomSheet from './BottomSheet';
import useSpaces from '../hooks/useSpaces';
import { spaceOfPath } from '../config/spaces';
import { spaceStyle, SpaceIcon } from './hub/spaceStyle';

export const SPACE_ACTIONS = {
  expenses: { title: 'Add an expense', sub: 'Quick add to one of your groups', to: '/add' },
  events: { title: 'Log event spending', sub: 'Coming soon in Events', to: '/spaces/events' },
  circles: { title: 'Pay a contribution', sub: 'Coming soon in Circles', to: '/spaces/circles' },
  loans: { title: 'Request or offer a loan', sub: 'Coming soon in Loans', to: '/spaces/loans' },
  aid: { title: 'Ask your group for help', sub: 'Coming soon in Aid', to: '/spaces/aid' },
};

export function orderedActions(spaces, currentSpaceId) {
  const list = spaces.filter((s) => SPACE_ACTIONS[s.id]);
  const current = list.filter((s) => s.id === currentSpaceId);
  const others = list.filter((s) => s.id !== currentSpaceId);
  return { current, others };
}

export default function ActionSheet({ open, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { spaces } = useSpaces();
  const { current, others } = orderedActions(spaces, spaceOfPath(location.pathname));

  const row = (space) => {
    const a = SPACE_ACTIONS[space.id];
    const st = spaceStyle(space);
    return (
      <button
        key={space.id}
        type="button"
        onClick={() => { onClose(); navigate(a.to); }}
        className="w-full flex items-center gap-3 p-3 text-left rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 active:scale-[0.98] active:bg-gray-50 dark:active:bg-gray-700 transition"
      >
        <span className={`w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center ${st.soft}`}>
          <SpaceIcon space={space} size={20} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-gray-900 dark:text-white">{a.title}</span>
          <span className="block text-[13px] text-gray-600 dark:text-gray-400">{a.sub}</span>
        </span>
        <ChevronRight size={18} className="text-gray-500" aria-hidden="true" />
      </button>
    );
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="What do you want to do?" labelId="action-sheet-title">
      {current.map(row)}
      {current.length > 0 && others.length > 0 ? (
        <p className="mt-1 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">Other spaces</p>
      ) : null}
      {others.map(row)}
    </BottomSheet>
  );
}
