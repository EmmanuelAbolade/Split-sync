// src/components/OnboardingWizard.jsx
// Purpose: Action-first onboarding wizard shown on first login.
// Guides the user through required setup, recommended security steps,
// the core group expense flow, and optional features — in that order.

import { useMemo, useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Compass,
  CreditCard,
  Fingerprint,
  Users,
  UserPlus,
  PlusCircle,
  HandCoins,
  Sparkles,
  Phone,
  CheckCircle2,
} from "lucide-react";

// Badge component — labels each step as Required, Recommended, or Optional
function StepBadge({ type }) {
  const styles = {
    required:    "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800",
    recommended: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800",
    optional:    "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700",
  };
  const labels = {
    required:    "Required",
    recommended: "Recommended",
    optional:    "Optional",
  };
  if (!type) return null;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[type]}`}>
      {labels[type]}
    </span>
  );
}

// ActionButton — primary CTA within a step
function ActionButton({ onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                 bg-primary text-white hover:bg-primary-hover
                 dark:bg-indigo-600 dark:hover:bg-indigo-700 transition"
    >
      {Icon && <Icon size={15} />}
      {label}
    </button>
  );
}

// SecondaryButton — secondary navigation within a step
function SecondaryButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
    >
      {label}
    </button>
  );
}

export default function OnboardingWizard({ open, onClose, onFinish, navigate }) {

  const steps = useMemo(() => [

    // ── Step 0: Welcome ───────────────────────────────────────────────
    {
      icon:  Compass,
      badge: null,
      title: "Welcome to Split-Sync",
      body: (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Split-Sync helps you track shared expenses, settle debts fairly,
            and keep everyone in your group on the same page — whether it is
            a trip, rent, dining, or any event with shared cost.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            This guide walks you through the steps in the order that matters.
            Steps marked <strong className="text-red-600 dark:text-red-400">Required</strong> should
            be done now. Steps marked <strong className="text-amber-600 dark:text-amber-400">Recommended</strong> are
            strongly advised. Everything else is optional and can be explored later.
          </p>
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
            You can use the chat bubble by the bottom right of this screen to get help or visit the Help & Support in the <strong>Settings</strong> at any time for more information.
          </div>
        </div>
      ),
    },

   

    // ── Step 1: Set Up a Payment Method ──────────────────────────────
    {
      icon:  CreditCard,
      badge: "required",
      title: "Set up a payment method",
      body: (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Before you can settle a debt, you need at least one payment method
            saved to your profile. Without this, other members cannot send you
            money directly through the app.
          </p>
          <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc pl-5 space-y-1">
            <li><strong>PayPal</strong> — your PayPal.me @username</li>
            <li><strong>Revolut</strong> — your Revolut @username</li>
            <li><strong>SEPA</strong> — your IBAN (stored encrypted) and optional BIC</li>
          </ul>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            You only need one. Add more if you want to give others options.
          </p>
          <ActionButton
            onClick={() => navigate("/profile")}
            icon={CreditCard}
            label="Open Payment Settings"
          />
        </div>
      ),
    },

    // ── Step 2: Enable Biometric Login ───────────────────────────────
    {
      icon:  Fingerprint,
      badge: "required",
      title: "Enable biometric login",
      body: (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Protect your account with fingerprint or Face ID on this device.
            Biometric login is faster and more secure than typing your password
            every time.
          </p>
          <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc pl-5 space-y-1">
            <li>Enabled per device — you can set it up on each device you use</li>
            <li>If biometric fails, your password is always the fallback</li>
            <li>You can disable it at any time from Settings</li>
          </ul>
          <ActionButton
            onClick={() => navigate("/settings")}
            icon={Fingerprint}
            label="Go to Settings to Enable"
          />
        </div>
      ),
    },

    // ── Step 3: Add Phone Number ───────────────────────────────────────

     {
      icon:  Phone,
      badge: "recommended",
      title: "Add Phone number",
      body: (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Add your phone number to enable others find you more quickly.
          </p>
          <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc pl-5 space-y-1">
            <li>Go to your Profile page</li>
            <li>Click Contact Discovery</li>
            <li>Enter your phone number</li>
          </ul>
          <ActionButton
            onClick={() => navigate("/profile")}
            icon={Phone}
            label="Add Phone Number"
          />
        </div>
      ),
    },

    // ── Step 4: Create or Join a Group ───────────────────────────────
    {
      icon:  Users,
      badge: null,
      title: "Create or join a group",
      body: (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            All expense tracking happens inside a group. A group represents a
            shared context — a trip, a household, a dinner, or any shared cost
            between people.
          </p>
          <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc pl-5 space-y-1">
            <li>Tap the <strong>+</strong> button on the Dashboard to create a group</li>
            <li>Give it a name, pick an icon, and set the currency</li>
            <li>Or join an existing group using an invite link someone shared with you</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              onClick={() => navigate("/dashboard")}
              icon={Users}
              label="Go to Dashboard"
            />
            <SecondaryButton
              onClick={() => navigate("/join-group")}
              label="Join a Group"
            />
          </div>
        </div>
      ),
    },

    // ── Step 5: Invite Members ───────────────────────────────────────
    {
      icon:  UserPlus,
      badge: null,
      title: "Invite members before adding expenses",
      body: (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            This is the most important flow to understand. You must have at
            least one other member in your group before you can add and split
            an expense.
          </p>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            Adding expenses to a group with only yourself in it simply means — there is no one to split with. Always invite first and when they join, you can add expenses.
          </div>
          <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc pl-5 space-y-1">
            <li>Open your group and tap <strong>Invite Link</strong></li>
            <li>Share the link via WhatsApp, email, or QR code</li>
            <li>Members appear instantly once they join</li>
          </ul>
        </div>
      ),
    },

    // ── Step 6: Add an Expense ───────────────────────────────────────
    {
      icon:  PlusCircle,
      badge: null,
      title: "Add an expense",
      body: (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Once your group has members, tap <strong>Add Expense</strong> inside the group.
            You can enter details of what is paid for manually or scan a receipt using the camera. Choose how to split among members:
          </p>
          <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc pl-5 space-y-1">
            <li><strong>Equal</strong> — split the total evenly across members</li>
            <li><strong>Percentage</strong> — assign a custom percentage to each person</li>
            <li><strong>Exact</strong> — specify the exact amount each person owes</li>
            <li><strong>Shares</strong> — assign weighted shares (e.g. 2 shares vs 1 share)</li>
          </ul>
          <p className="text-sm text-gray-600 dark:text-gray-300">Members are notified of new expenses and can view details and their share in the app.</p>
          <ActionButton
            onClick={() => navigate("/quick-add")}
            icon={PlusCircle}
            label="Quick Add"
          />
        </div>
      ),
    },

    // ── Step 7: Settle Up ────────────────────────────────────────────
    {
      icon:  HandCoins,
      badge: null,
      title: "Review balances and settle up",
      body: (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Open any group to see the Settlement Summary — a clear breakdown
            of who owes who and how much. Tap <strong>Pay (Amount)</strong> to
            send payment through your chosen method. And you can confirm a payment is made by tapping <strong>Mark as Paid</strong> to update balances.
          </p>
          <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc pl-5 space-y-1">
            <li>PayPal and Revolut open a direct payment link</li>
            <li>SEPA generates bank transfer details</li>
            <li>Balances update in real-time as expenses and payments are recorded</li>
          </ul>
          <ActionButton
            onClick={() => navigate("/activity")}
            icon={HandCoins}
            label="View Activity"
          />
        </div>
      ),
    },

    // ── Step 8: Optional Features ────────────────────────────────────
    {
      icon:  Sparkles,
      badge: "optional",
      title: "Optional features to explore",
      body: (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Improve your experience once you are comfortable with the basics.
          </p>
          <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc pl-5 space-y-2">
            <li><strong>Profile Photo</strong> — Add a photo to your profile</li>
            <li><strong>Analytics</strong> — view spending breakdowns and charts per group</li>
            <li><strong>Dark Mode</strong> — toggle in Settings under Appearance</li>
            <li><strong>QR Code Sharing</strong> — share your group invite as a scannable QR code</li>
            <li><strong>Receipt Scanner</strong> — scan a receipt to pre-fill expense details</li>
            <li><strong>Click Details to settle up</strong> — view and manage your settlement details from your profile dashboard</li>
          </ul>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            You can watch the video guide in the Support Section from App Settings.
          </p>
        </div>
      ),
    },

  ], [navigate]);

  const [idx, setIdx] = useState(0);

  if (!open) return null;

  const StepIcon  = steps[idx].icon;
  const stepBadge = steps[idx].badge;
  const isLast    = idx === steps.length - 1;
  const isFirst   = idx === 0;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="absolute inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center p-3">
        <div className="w-full sm:max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0 p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30">
                <StepIcon size={18} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">
                    {steps[idx].title}
                  </h2>
                  <StepBadge type={stepBadge} />
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 ml-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition"
              aria-label="Close onboarding wizard"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="px-5 py-5 max-h-[55vh] overflow-y-auto">
            {steps[idx].body}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">

            {/* Back button */}
            <button
              type="button"
              onClick={() => setIdx((p) => Math.max(0, p - 1))}
              disabled={isFirst}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                         bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                         text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700
                         disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft size={16} />
              Back
            </button>

            {/* Step indicators */}
            <div className="flex items-center gap-1.5">
              {steps.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIdx(i)}
                  aria-label={`Go to step ${i + 1}`}
                  className={`rounded-full transition-all duration-200 ${
                    i === idx
                      ? "w-5 h-2 bg-indigo-600 dark:bg-indigo-400"
                      : i < idx
                      ? "w-2 h-2 bg-indigo-300 dark:bg-indigo-600"
                      : "w-2 h-2 bg-gray-200 dark:bg-gray-700"
                  }`}
                />
              ))}
            </div>

            {/* Next / Finish button */}
            {isLast ? (
              <button
                type="button"
                onClick={onFinish}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                           bg-primary text-white hover:bg-primary-hover
                           dark:bg-indigo-600 dark:hover:bg-indigo-700 transition"
              >
                <CheckCircle2 size={16} />
                Get Started
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIdx((p) => Math.min(steps.length - 1, p + 1))}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                           bg-primary text-white hover:bg-primary-hover
                           dark:bg-indigo-600 dark:hover:bg-indigo-700 transition"
              >
                Next
                <ChevronRight size={16} />
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}