// src/components/hub/spaceStyle.js
// Icons and colour classes per space, written out in full so Tailwind keeps
// them in the build. Colours follow the approved hub mockup.

import { Receipt, PartyPopper, RefreshCcw, HandCoins, HeartHandshake } from 'lucide-react';

export const SPACE_ICONS = { Receipt, PartyPopper, RefreshCcw, HandCoins, HeartHandshake };

const STYLES = {
  blue: {
    solid: 'bg-blue-600 text-white',
    soft: 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    text: 'text-blue-700 dark:text-blue-300',
    hero: 'from-blue-500 to-blue-800',
  },
  pink: {
    solid: 'bg-pink-600 text-white',
    soft: 'bg-pink-50 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
    text: 'text-pink-700 dark:text-pink-300',
    hero: 'from-pink-500 to-pink-800',
  },
  violet: {
    solid: 'bg-violet-600 text-white',
    soft: 'bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    text: 'text-violet-700 dark:text-violet-300',
    hero: 'from-violet-500 to-violet-800',
  },
  amber: {
    solid: 'bg-amber-600 text-white',
    soft: 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    text: 'text-amber-800 dark:text-amber-300',
    hero: 'from-amber-500 to-orange-700',
  },
  teal: {
    solid: 'bg-teal-600 text-white',
    soft: 'bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
    text: 'text-teal-700 dark:text-teal-300',
    hero: 'from-teal-500 to-teal-800',
  },
};

export function spaceStyle(space) {
  return STYLES[space && space.accent] || STYLES.blue;
}

export function SpaceIcon({ space, size = 20, className = '' }) {
  const Icon = SPACE_ICONS[space && space.icon] || Receipt;
  return <Icon size={size} className={className} aria-hidden="true" />;
}
