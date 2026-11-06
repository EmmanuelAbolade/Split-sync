// src/components/SpaceChips.jsx
// A row of chips, one per space (plus "All" when asked), used by Activity
// (a filter) and Stats (tabs). Scrolls sideways on narrow screens.

export default function SpaceChips({ spaces, value, onChange, includeAll = false, label = 'Filter by space', asTabs = false }) {
  const items = [...(includeAll ? [{ id: 'all', name: 'All' }] : []), ...spaces];
  return (
    <div
      role={asTabs ? 'tablist' : 'group'}
      aria-label={label}
      className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
    >
      {items.map((s) => {
        const on = value === s.id;
        return (
          <button
            key={s.id}
            type="button"
            role={asTabs ? 'tab' : undefined}
            aria-selected={asTabs ? on : undefined}
            aria-pressed={asTabs ? undefined : on}
            onClick={() => onChange(s.id)}
            className={`flex-shrink-0 min-h-[40px] px-4 rounded-full border text-sm font-semibold whitespace-nowrap transition active:scale-[0.96] ${
              on
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:border-blue-300'
            }`}
          >
            {s.name}
          </button>
        );
      })}
    </div>
  );
}
