// src/components/BottomSheet.jsx
// A sheet that slides up from the bottom (centred dialog on wide screens).
// Closes on the backdrop, the close button or Escape. Focus moves into the
// sheet when it opens.

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function BottomSheet({ open, title, onClose, children, footer, labelId = 'sheet-title' }) {
  const panel = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const first = panel.current && panel.current.querySelector('button, [href], input, [tabindex]:not([tabindex="-1"])');
    if (first) first.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 animate-fade-in"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        className="w-full sm:max-w-md max-h-[88vh] flex flex-col bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-3xl shadow-card-3d animate-sheet-in pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-gray-300 dark:bg-gray-600" aria-hidden="true" />
        <div className="flex items-center gap-2 px-5 pt-3 pb-3 border-b border-gray-200 dark:border-gray-700">
          <h2 id={labelId} className="flex-1 text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition"
          >
            <X size={22} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 flex flex-col gap-3">{children}</div>
        {footer ? <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}
