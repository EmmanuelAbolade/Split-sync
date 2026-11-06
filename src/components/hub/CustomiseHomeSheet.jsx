// src/components/hub/CustomiseHomeSheet.jsx
// Choose which spaces appear on Home. Expenses is always on. Hiding a space
// never deletes anything; it only hides the tile.

import { useEffect, useState } from 'react';
import BottomSheet from '../BottomSheet';
import ActionButton from '../ActionButton';
import { spaceStyle, SpaceIcon } from './spaceStyle';

export default function CustomiseHomeSheet({ open, onClose, spaces, hidden, onSave }) {
  const [draft, setDraft] = useState(hidden);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (open) { setDraft(hidden); setError(''); } }, [open, hidden]);

  const toggle = (id) => setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await onSave(draft);
      onClose(true);
    } catch (err) {
      setError('Could not save. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => onClose(false)}
      title="Customise Home"
      labelId="customise-title"
      footer={<ActionButton onClick={save} busy={busy} busyLabel="Saving…">Done</ActionButton>}
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">Show only the spaces you use. Hiding a space keeps its data safe.</p>
      {spaces.map((s) => {
        const st = spaceStyle(s);
        const always = s.id === 'expenses';
        return (
          <label key={s.id} className="flex items-center gap-3 py-2 border-b border-gray-200 dark:border-gray-700 last:border-0 cursor-pointer">
            <input
              type="checkbox"
              className="w-5 h-5 accent-blue-600"
              checked={always || !draft.includes(s.id)}
              disabled={always}
              onChange={() => toggle(s.id)}
            />
            <span className={`w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center ${st.soft}`}>
              <SpaceIcon space={s} size={16} />
            </span>
            <span className="flex-1">
              <span className="block font-semibold text-gray-900 dark:text-white">{s.name}</span>
              <span className="block text-xs text-gray-600 dark:text-gray-400">{s.blurb}{always ? ' · always on' : ''}</span>
            </span>
          </label>
        );
      })}
      {error ? <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p> : null}
    </BottomSheet>
  );
}
