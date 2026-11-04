# 06. UX and UI Design

| | |
|---|---|
| **Document** | `docs/circles/06-ux-ui-design.md` |
| **Phase** | 0 (Research and Design) |
| **Depends on** | `05-sitemap-and-navigation.md`; mockups `splitsync-hub.html` (approved direction) and `splitsync-circles.html` (feature detail) |
| **Conformance** | WCAG 2.2 AA (W3C, 2023); Nielsen's heuristics (Nielsen, 1994) |

The mockups show intent and flows. The real screens are built from existing SplitSync components, the existing Tailwind theme and Lucide icons (Brief §4).

---

## 1. Design system tokens

### 1.1 Existing tokens (`tailwind.config.js`), reused as-is

| Token | Value | Use |
|---|---|---|
| `primary` / `primary-light` / `primary-hover` / `primary-dark` | `#3B82F6` / `#DBEAFE` / `#2563EB` / `#1E40AF` | Primary actions, Expenses accent |
| `success` | `#10B981` | Confirmed and paid states |
| `dark.bg` / `dark.surface` / `dark.border` / `dark.text` / `dark.text-muted` | `#0f172a` / `#1e293b` / `#334155` / `#e2e8f0` / `#94a3b8` | Dark mode surfaces |
| Shadows `card`, `card-hover`, `card-3d`, `inner-light` | as configured | Cards and hover lift |
| Animations `float`, `slide-up`, `scale-in` | 3 s, 0.3 s, 0.2 s | Entrances and modals |
| Dark mode | `darkMode: 'class'` with `DarkModeContext` | Every new component ships `dark:` variants |

The existing code uses Tailwind's default palette heavily (`indigo-*`, `green-*`, `orange-*`, `amber-*`, `red-*`, `gray-*`). The new spaces follow the same convention.

### 1.2 New space accents (additions to `theme.extend.colors`)

These are taken from the hub mockup's space colours and mapped to Tailwind palette steps, so light and dark pairs already exist and meet contrast requirements:

| Space | Token | Light (icon/background) | Dark (icon/background) | Lucide icon |
|---|---|---|---|---|
| Expenses | `space-exp` | `blue-600` / `blue-50` | `blue-400` / `blue-900/30` | `Receipt` |
| Events | `space-evt` | `pink-600` / `pink-50` | `pink-400` / `pink-900/30` | `PartyPopper` |
| Circles | `space-cir` | `violet-600` / `violet-50` | `violet-400` / `violet-900/30` | `RefreshCcwDot` |
| Loans | `space-lon` | `amber-600` / `amber-50` | `amber-400` / `amber-900/30` | `HandCoins` |
| Aid | `space-aid` | `teal-600` / `teal-50` | `teal-400` / `teal-900/30` | `HeartHandshake` |

**Owe and owed semantics are unchanged.** Orange means you owe; green means you are owed (as on today's Dashboard). Colour is always accompanied by text ("You owe", "Owed to you") or an icon (WCAG 1.4.1).

### 1.3 Motion

The product owner wants rich animation. The motion system is therefore deliberate but restrained, and fully disabled under `prefers-reduced-motion` (WCAG 2.3.3 at AAA is not required, but it is honoured):

| Element | Motion | Duration and easing | Implementation |
|---|---|---|---|
| Hub space tiles | Staggered `slide-up` entrance (40 ms per tile) and hover lift (`-translate-y-1`, `shadow-card-hover`), as on today's cards | 300 ms ease-out | Existing `animate-slide-up` with a per-tile `animationDelay` |
| Bottom sheet | Slides up from the bottom; backdrop fades | 250 ms ease-out | New `sheet-in` keyframe |
| Rotation timeline | The current slot pulses once; completed slots fill left to right | 600 ms | New `fill-x` keyframe; pulse uses `scale-in` |
| Progress bars (budget, pledges, loan repaid) | Width animates from 0 to the value on first view | 700 ms ease-out | CSS transition on width |
| Confirmed payment | The check icon scales in; a success toast slides up | 200 ms / 300 ms | Existing `scale-in` / `slide-up` |
| Balance figures | Count up from 0 to the value on first view | 600 ms | A small hook; skipped under reduced motion |
| Space header | Gradient hero (as in the mockup) with a subtle `float` on the space icon | 3 s infinite | Existing `float`; disabled under reduced motion |

New keyframes are added to `tailwind.config.js` alongside the existing ones. **Existing defect noted:** `Analytics.jsx` uses `animate-fade-in`, which is not defined in the Tailwind config or the CSS, so those entrance animations do not run today. Defining `fade-in` in Phase 2 fixes it without changing the Analytics markup.

### 1.4 Typography, spacing and shape

The existing stack is used: Tailwind's default sans-serif font, `rounded-xl` cards, `rounded-2xl` modals and sheets, and `p-4` to `p-6` card padding. The mockups' Roboto, Sora and Manrope fonts are **not** adopted. Loading web fonts would change every existing screen, and the Brief asks for the existing look. Numbers use `tabular-nums` so amounts align.

---

## 2. Global patterns

### 2.1 Context-aware + action sheet

- A bottom sheet with a grabber, a title ("What do you want to do?"), a scrollable body and an optional footer.
- Rows: a space-coloured icon tile, a bold action title, a one-line hint and a chevron.
- Inside a space, that space's actions come first, followed by an "Other spaces" label (FR-HUB-05).
- **Accessibility:** `role="dialog"`, `aria-modal="true"`, focus moves to the first action and returns to the + button on close, Escape closes the sheet, and a focus trap keeps keyboard focus inside. The sheet sits above the bottom navigation so focused items are never hidden (WCAG 2.4.11).

### 2.2 Modals scroll inside themselves

Every modal and sheet uses a fixed header and footer with an `overflow-y-auto` body, a `max-h-[88vh]` limit and `overscroll-behavior: contain`, as already done in `ExpenseDetailsModal` and Taskmaster. The keyboard-aware behaviour on mobile is preserved.

### 2.3 Step-up confirmation

The step-up sheet ("Confirm it's you") shows:

- a short summary of the action ("Pay EUR 200.00 to Tolu, Family Ajo Circle");
- the primary button "Use passkey" (fingerprint icon), or "Re-enter password" as the fallback;
- a cancel button.

It never asks for the passkey without first showing what is being authorised. **WCAG 3.3.8 (Accessible Authentication, Minimum):** the passkey and the password manager-friendly fallback avoid any cognitive-function test.

### 2.4 State patterns

| State | Pattern |
|---|---|
| Loading | Skeleton cards with the existing `animate-pulse`, sized like the final content to avoid layout shift |
| Empty | Icon, a one-sentence explanation and one primary action (for example "No circles yet. Start one with people you trust.") |
| Error | Inline alert with plain language and a next step; a retry button for network errors; never a raw error code |
| Offline | Banner: "You're offline. You can view saved information; money actions need a connection." Money buttons are disabled with an explanation. |
| Permission | The "not a member" screen pattern already used by `GroupDetails` |
| Feature off | The space is not shown. If reached by link, the user is redirected to Home with a toast: "This feature isn't available yet." |
| Pending | Amber chip "Awaiting confirmation" with a clock icon, plus an explanation of why the buttons are locked (as in today's SettleUpModal) |

---

## 3. Screen descriptions

References are to mockup screens: **H** = `splitsync-hub.html`, **C** = `splitsync-circles.html`.

### 3.1 Hub Home (`/dashboard`): H "home"

1. **Top bar.** The logo (which still opens Taskmaster for admins), the notifications bell (badge includes held requests), the settings gear, and the dark-mode toggle if present today.
2. **Welcome.** The existing avatar, greeting and cycling tagline.
3. **Needs attention.** Up to 5 task rows from all spaces (for example "Pay EUR 200 to Tolu · Family Ajo Circle · due 10 Nov"), each with a space icon. The header reads "From all your spaces". **No money total.**
4. **Your spaces.** A two-column tile grid (one column under 380 px). Each tile shows the icon, name, a one-line summary from that space only, and a small "Separate ledger" lock label. Customise opens the Customise Home sheet.
5. **Information note.** "Each space keeps its own ledger. Money in one space is never added to or settled against another."
6. Existing invitation banners, the payment-method banner, the onboarding wizard and the AI assistant remain available on the hub.

### 3.2 Expenses space (`/spaces/expenses`): H "space:expenses"

This is the **existing `Dashboard.jsx`, unchanged**: overview cards, suggested settlement, pending-payment banner, groups list, Create Group, and so on. Only the page header gains the Expenses hero gradient and a back-to-Home arrow, through a wrapper component, so the Dashboard code itself is not edited.

### 3.3 Events (`/spaces/events`, `/events/:id`): C "openEvent"

- **List:** event cards showing budget used (progress bar; amber above 90 %) and a "N to approve" chip.
- **Detail:** budget and pledged summary pair; budget by category with progress bars; a pending spend request (requester, item, amount, receipt thumbnail) with Reject and Approve buttons for treasurers; the pledges list with paid/due chips; an "Add pledge" footer.
- Approve triggers step-up. A treasurer's own request shows "Another treasurer must approve this".

### 3.4 Refunds (inside GroupDetails): C "newRefund", "reviewRefund"

- "Request refund" appears in `ExpenseDetailsModal` for non-settlement expenses. The form has the amount (pre-filled and capped at the refundable remainder), a reason select and an optional note.
- A note explains: "The original expense is kept. A linked reversing entry is added once the payer accepts."
- The payer and the group owner see a review sheet with the details, an optional advisory duplicate hint, and Reject or Accept (with step-up).
- In Recent Expenses, a refund appears as a linked "Refund" row with a reversal icon (`Undo2`) under its original expense.

### 3.5 Circles (`/spaces/circles`, `/circles/:id`): H "space:circles"; C "openRosca", "newCircle", "payContribution", "swapSlot"

- **Circle card:** name, amount and frequency, "Cycle 3 of 6", paid count with a progress bar, this cycle's recipient, and the user's payout slot and amount.
- **Detail:**
  - a summary pair (each cycle; pot per payout);
  - a **horizontal rotation timeline** (completed slots in green, the current slot highlighted, the user's slot outlined, keyboard-scrollable);
  - an "Order method" line with **"Verify draw"**, which shows the seed and the recomputed order;
  - the contribution list for the current cycle;
  - footer: "Request swap", and "Pay EUR X to [recipient]" or "Done".
- **Create circle:** name, amount, member count, frequency, first contribution date, payout order (random draw or agreed order), the optional guarantor rule, and a live preview ("Each payout is EUR 600. The circle runs for 6 cycles."). A **required acknowledgement**: "I understand payments go directly between members and SplitSync does not hold or guarantee money" (FR-CIR-10). There is **no "by trust score" option** (FR-CIR-11).
- **Pay contribution:** recipient, amount, a "From space: Circles" label, the payment method (radio cards), the note "Recorded only in the Circles ledger. It cannot settle an expense debt", and "Confirm with passkey".

### 3.6 Loans (`/spaces/loans`, `/loans/:id`): C "openLoan", "newLoan"; H "space:loans"

- **Loan cards:** direction icon (lent `ArrowUpRight`, borrowed `ArrowDownLeft`), counterparty, next instalment, outstanding amount, repaid progress, and an "On track" or "Late" chip.
- **Detail:** amount and outstanding; the repayment schedule (date, amount, status chip); the note "Interest-free. Both of you accepted these terms on [date]". The footer depends on the role: the lender sees "Send friendly reminder"; the borrower sees "Ask to reschedule" and "Repay EUR X".
- **Request:** person picker (only people who accept requests from the user are selectable; others are not shown, so the held status cannot be inferred), amount, number of instalments, purpose, a live schedule preview, the warning "SplitSync records the agreement and does not lend money", and step-up to send and accept the terms. **There is no credit-limit text based on the trust score** (FR-LON-06); the mockup's "Your limit is EUR 500" line is deliberately dropped.

### 3.7 Aid (`/spaces/aid`, `/aid/:id`): C "openAid", "newAid"; H "space:aid"

- **Card:** title, group, end date, a "Verified" chip, pledged against target, and the number of givers.
- **Detail:** the note "The reason for this request is private. A group admin verified it." Pledge input with quick amounts (10, 25, 50, 100) and an "Anonymous" toggle (default on). Pledging is followed by "Pay directly to the requester" instructions using their payment options.
- **Create:** group picker (only groups and circles the user belongs to), title, target, end date, and "Private note for the admin" with the hint "Never shown to other members. Avoid sharing details you don't need to." The status after sending is "Waiting for admin review".
- **Admin review sheet:** the private reason, requester, target, and Verify or Reject (with a reason sent to the requester only).

### 3.8 Requests inbox (`/requests`): H "requests"

Cards for each request. Held requests carry an amber note: "Held because [name] is not on your trusted list. They have not been told it was held." Actions are Decline, Block (danger style), and "Trust and view". The empty state reads "No requests waiting."

### 3.9 Who can ask me (`/settings/privacy`): H "privacy"

Three radio groups (Loan requests, Aid requests sent to me directly, Direct messages), each offering Nobody / Trusted people only / Members of shared circles / Anyone in my groups. The trusted-people chips have a remove action. The toggle "Hold requests from everyone else for my review" is on by default. The introductory note reads: "Being in a group with someone lets you split bills with them. It does not let them ask you for money unless you allow it."

### 3.10 Activity, Stats and You: H "activity", "stats", "you"

As specified in `05-sitemap-and-navigation.md` §5. The You page adds:

- a reliability pill visible to the user themselves;
- "Balances by space" (per space and currency, with the note "No conversion and no combined total");
- the "Who can ask me" summary card.

### 3.11 Customise Home: H "customise"

Switch rows per space (Expenses disabled with "always on"), with the note "Hiding a space keeps its data safe". The setting is saved to the user's profile, so it follows them across devices (FR-HUB-04).

### 3.12 Locked "Coming later" cards: C "future"

Striped, muted cards for "Protected circle pot" and "Savings groups", with a lock chip. They open an explainer: holding money is regulated and needs a licensed partner, and the feature would run as a separate service. "Notify me" stores interest only.

---

## 4. Accessibility checklist (applied to every new screen)

| WCAG 2.2 criterion | Application |
|---|---|
| 1.3.1 Info and Relationships | Semantic headings per section; lists for timelines and schedules; `role="tablist"` on Stats |
| 1.4.1 Use of Colour | Owe/owed and status always carry text or icons |
| 1.4.3 Contrast (Minimum) | Space accents use 600 shades on light and 400 shades on dark, each verified at 4.5:1 for text |
| 1.4.10 Reflow | Single column under 380 px; no horizontal page scroll (timelines scroll inside their own container) |
| 2.1.1 Keyboard | All tiles, chips, sheets and timeline slots are operable by keyboard |
| 2.4.3 Focus Order and 2.4.11 Focus Not Obscured | Sheets trap focus and are not covered by the fixed bottom navigation |
| 2.5.8 Target Size (Minimum) | Touch targets ≥ 24 × 24 CSS px (the current design uses ≥ 40 px) |
| 3.3.1 and 3.3.3 Error Identification and Suggestion | Field-level messages ("Between EUR 10 and EUR 2,000") |
| 3.3.8 Accessible Authentication | Passkey or password-manager-friendly fallback |
| 4.1.2 Name, Role, Value | `aria-pressed` on chips; `aria-current="page"` in the navigation; labelled icon buttons |
| 4.1.3 Status Messages | Toasts use `role="status"` |
