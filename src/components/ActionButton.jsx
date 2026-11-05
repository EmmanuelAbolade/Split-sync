// src/components/ActionButton.jsx
// One button for every settle-up action, so each tap gives the same feedback:
// a pressed look when tapped, a spinner and a "saving" label while the server
// works (and a second tap is ignored), then the caller shows the result.

const BASE =
  'inline-flex items-center justify-center gap-2 min-h-[46px] px-4 rounded-xl font-semibold text-[15px] ' +
  'transition duration-150 select-none active:scale-[0.97] ' +
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500';

const VARIANTS = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 active:shadow-inner dark:bg-blue-600 dark:hover:bg-blue-500',
  success:
    'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 active:shadow-inner dark:bg-green-600 dark:hover:bg-green-500',
  secondary:
    'border-2 border-gray-300 bg-white text-gray-900 hover:bg-gray-50 active:bg-gray-200 active:border-gray-400 ' +
    'dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 dark:active:bg-gray-600',
  warning:
    'border-2 border-amber-300 bg-white text-amber-900 hover:bg-amber-50 active:bg-amber-100 ' +
    'dark:border-amber-700 dark:bg-gray-800 dark:text-amber-200 dark:hover:bg-amber-900/30',
};

export function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

export default function ActionButton({
  variant = 'primary',
  busy = false,
  busyLabel,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy ? 'true' : undefined}
      className={`${BASE} ${VARIANTS[variant] || VARIANTS.primary} ${className}`}
      {...rest}
    >
      {busy ? (
        <>
          <Spinner />
          {busyLabel || children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
