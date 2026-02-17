// src/components/OnboardingWizard.jsx
// Purpose: First-login walkthrough modal (scrollable) + navigation shortcuts.

import { useMemo, useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Compass,
  Users,
  PlusCircle,
  Receipt,
  HandCoins,
  ShieldCheck,
  BellRing,
  Settings,
  CreditCard
} from "lucide-react";

export default function OnboardingWizard({ open, onClose, onFinish, navigate }) {
  const steps = useMemo(
    () => [
      {
        title: "Welcome to SplitSync",
        icon: Compass,
        body: (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              SplitSync helps you create or join groups, add expenses, and settle balances fairly.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">
              This quick tour shows the fastest path to “done”. To explore all features, check out the Help and Info section in Settings anytime.
            </p>
          </>
        ),
      },
      {
        title: "Step 1: Create or Join a Group",
        icon: Users,
        body: (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Everything happens inside a group (Trip, Rent, Housemates, Party,  etc.).
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="px-3 py-2 rounded-lg text-sm bg-primary text-white hover:bg-primary-hover dark:bg-indigo-600 dark:hover:bg-indigo-700"
              >
                Go to Dashboard
              </button>
              <button
                type="button"
                onClick={() => navigate("/join-group")}
                className="px-3 py-2 rounded-lg text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Join a Group
              </button>
            </div>
          </div>
        ),
      },
      {
        title: "Step 2: Add Expenses (manual or receipt scan)",
        icon: PlusCircle,
        body: (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Invite others(or join), manually enter or scan the receipt of what you have paid for, review the details and choose how to split: Equal, Percentage, Exact, or Shares.
            </p>
            <button
              type="button"
              onClick={() => navigate("/quick-add")}
              className="px-3 py-2 rounded-lg text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 inline-flex items-center gap-2"
            >
              <Receipt size={16} />
              Quick Add / Receipt Scan
            </button>
          </div>
        ),
      },
      {
        title: "Step 3: Review balances and settle up",
        icon: HandCoins,
        body: (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Open a group to see who owes who, then settle using PayPal, Revolut, or SEPA.
            </p>
            <button
              type="button"
              onClick={() => navigate("/activity")}
              className="px-3 py-2 rounded-lg text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Go to Activity
            </button>
          </div>
        ),
      },

      {
        title: "Important: Set up payment methods",
        icon: CreditCard,
        body: (
            <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
                To settle quickly, add at least one payment method (PayPal, Revolut, or SEPA IBAN).
            </p>
            <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc pl-5 space-y-2">
                <li>PayPal.me username</li>
                <li>Revolut @username</li>
                <li>IBAN (encrypted) + optional BIC</li>
            </ul>
            <button
                type="button"
                onClick={() => navigate("/profile")}
                className="px-3 py-2 rounded-lg text-sm bg-primary text-white hover:bg-primary-hover
                        dark:bg-indigo-600 dark:hover:bg-indigo-700 inline-flex items-center gap-2"
            >
                <CreditCard size={16} />
                Open Profile Payment Settings
            </button>
            </div>
        ),
        },

      {
        title: "Security essentials (recommended)",
        icon: ShieldCheck,
        body: (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              To keep your account safe:
            </p>
            <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc pl-5 space-y-2">
              <li>Enable biometric login on this device (fingerprint/Face ID).</li>
              <li>Use a strong password (or Google sign-in).</li>
              <li>Don’t share invite links publicly; treat them like keys.</li>
              <li>Log out on shared devices.</li>
              <li>Check Settings for more info in the Help and Info section.</li>
            </ul>
            <button
              type="button"
              onClick={() => navigate("/settings")}
              className="px-3 py-2 rounded-lg text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 inline-flex items-center gap-2"
            >
              <Settings size={16} />
              Open Settings
            </button>
          </div>
        ),
      },
      {
        title: "Notifications",
        icon: BellRing,
        body: (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Keep notifications on so you don’t miss group invites and settlement updates.
          </p>
          
        ),
      },
    ],
    [navigate]
  );

  const [idx, setIdx] = useState(0);

  if (!open) return null;

  const StepIcon = steps[idx].icon;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center p-3">
        <div className="w-full sm:max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <StepIcon className="text-gray-800 dark:text-gray-100" size={18} />
              <h2 className="font-semibold text-gray-900 dark:text-white">
                {steps[idx].title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
              aria-label="Close onboarding"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="px-4 py-4 max-h-[70vh] overflow-y-auto">
            {steps[idx].body}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIdx((p) => Math.max(0, p - 1))}
              disabled={idx === 0}
              className="px-3 py-2 rounded-lg text-sm inline-flex items-center gap-2
                         bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                         text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
              Back
            </button>

            <div className="text-xs text-gray-500 dark:text-gray-400">
              {idx + 1} / {steps.length}
            </div>

            {idx < steps.length - 1 ? (
              <button
                type="button"
                onClick={() => setIdx((p) => Math.min(steps.length - 1, p + 1))}
                className="px-3 py-2 rounded-lg text-sm inline-flex items-center gap-2
                           bg-primary text-white hover:bg-primary-hover
                           dark:bg-indigo-600 dark:hover:bg-indigo-700"
              >
                Next
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={onFinish}
                className="px-3 py-2 rounded-lg text-sm bg-primary text-white hover:bg-primary-hover
                           dark:bg-indigo-600 dark:hover:bg-indigo-700"
              >
                Finish
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
