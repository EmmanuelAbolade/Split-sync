# Split-Sync — Project Document

> Living reference for the Split-Sync project. Update it whenever behaviour, data shape, rules, or deployment state changes. The **Change log** at the bottom records each working session.
>
> Last updated: **2026-11-03**

---

## 1. Snapshot

| | |
|---|---|
| What | Progressive Web App for splitting shared expenses within groups, settling up, and tracking personal spending |
| Author | Emmanuel Abolade (student C00288657), Year 4 project, SETU |
| Live app | https://splitsync-dev.web.app (Firebase Hosting, project `splitsync-dev`) |
| Repo | https://github.com/EmmanuelAbolade/Split-sync (branch `master`) |
| Docs | Doxygen: https://splitsync-docs.netlify.app · Coverage: https://splitsync-coverage-test.netlify.app · Showcase: https://showcase.setu.ie/C00288657/index.html · Screencast: https://youtu.be/7uat5PeTsrI |
| Formal docs in repo | `docs/` — Research Document, Functional Specification, Design Document, Project Report (PDFs), screenshots, `docs/index.html` showcase page |
| Size | ~38k lines of JS/JSX in `src/` + `functions/`; 191 commits (2025-11-25 → 2026-04-20) plus uncommitted work |
| Tests | 54 Jest suites / 1,461 tests, 5 Cloud Functions unit tests, 23 Firestore rules emulator tests; all passing as of 2026-11-03 (coverage last published 84.37%) |
| Licence | Apache 2.0 |

---

## 2. Tech stack

**Frontend:** React 19 (Create React App / `react-scripts` 5), React Router 7, Zustand 5 (state), Tailwind CSS 3 (with `dark:` class strategy), lucide-react icons, Recharts 3 (analytics), qrcode / qrcode.react, crypto-js (legacy, server-side migration only), tesseract.js (legacy OCR, superseded by Cloud Vision), `@paypal/react-paypal-js`.

**Backend (Firebase):** Firebase Auth (email/password + Google), Cloud Firestore (real-time `onSnapshot` everywhere), Cloud Functions v2 (Node 22), Firebase Hosting. Cloudinary (unsigned upload preset) stores profile photos and receipt images.

**External APIs:** Google Cloud Vision (receipt OCR), Anthropic Claude API (in-app assistant), PayPal REST API sandbox (server-side capture), PayPal.me / Revolut.me deep links, SEPA (demo simulation).

**Testing/tooling:** Jest + React Testing Library (via `react-scripts test`, which sets `resetMocks: true`), Doxygen for API docs, ESLint (`react-app` config).

---

## 3. Repository layout

```
split-sync-app/
├─ src/
│  ├─ App.js                 Routes, auth listener, ProtectedLayout (BottomNav, AI chat, session-timeout modal, notifications subscription)
│  ├─ index.js               Entry + service worker registration
│  ├─ services/firebase.js   Firebase app/auth/db init from REACT_APP_* env
│  ├─ stores/                authStore (user, persisted), notificationsStore (real-time notifications + payment confirm/decline helpers)
│  ├─ hooks/                 useSessionTimeout, useKeyboardAware, useFormerMemberNames (2026-11-03)
│  ├─ contexts/              DarkModeContext
│  ├─ pages/                 Login, Register, ForgotPassword, Dashboard, GroupDetails, JoinGroup, Activity, Analytics, QuickAdd, Profile, Settings, Taskmaster (admin)
│  ├─ components/            AddExpenseModal, ExpenseDetailsModal, SettleUpModal, SepaPaymentModal, CreateGroupModal, ShareInviteModal, QRCode*, ReceiptScanner, CloudinaryUpload, ProfilePhotoUpload, PaymentInfoModal, BalanceBreakdownModal, NotificationsDropdown, InvitationNotification, QuickAddMembers, ContactSyncButton, OnboardingWizard, InfoHubModal, SplitSyncChat, SessionTimeoutWarning, BottomNav, DarkModeToggle, IconSelector, PasswordStrength, Tooltip
│  ├─ utils/                 balanceCalculator, invitationSystem, paymentLinks, sepaPayment, encryption, biometric, contactSyncManager, userConnectionsManager, memberDirectory (2026-11-03), accountDeletion (2026-11-03)
│  └─ __mocks__/             Firebase + router mocks for tests
├─ functions/index.js        Cloud Functions: capturePayPalOrder, scanReceipt, splitSyncChat
├─ firestore.rules           Security rules
├─ firebase.json / .firebaserc   Hosting (build/ → SPA rewrite), functions, rules; default project splitsync-dev
├─ public/                   manifest, service-worker.js (offline cache), offline.html, feedback.html, icons
├─ docs/                     PDFs, screenshots, showcase page, doxygen/html
├─ Doxyfile, README.md, LICENSE
└─ projectdoc.md             This file
```

---

## 4. Architecture

- **Routing** (`App.js`): `/login`, `/register`, `/forgot-password` public; `/dashboard`, `/activity`, `/analytics`, `/add`, `/profile`, `/settings`, `/group/:groupId`, `/invite/:groupId` behind `isAuthenticated`; `/taskmaster` requires auth in the router and checks the `admin` custom claim inside the page.
- **Auth state:** `onAuthStateChanged` → Zustand `authStore`. Display-name and photo updates are pushed into the store so the UI updates without a refresh.
- **Real-time data:** pages subscribe with `onSnapshot`. Group lists are queried by `memberIds array-contains uid`, then filtered client-side by `members` (see §8).
- **Notifications** are subscribed once at app level (`ProtectedLayout`). The payment confirm/decline flow is built on the `notifications` collection (no separate payments collection), plus `pendingPayments` to stop duplicate payments.
- **Balances** are computed client-side from expenses (`utils/balanceCalculator.js`): positive means the member is owed money, negative means they owe. Settlements are expenses with `isSettlement: true`, paid by the debtor with the creditor as the only split. Expenses with `status: 'deleted'` are excluded; archived ones still count. `calculateSettlements` is a greedy minimal-transfer algorithm.
- **PWA:** `public/service-worker.js` (cache `splitsync-*-v2`), cache-first for static assets, network-only for Firebase, Cloud Functions and `run.app` hosts. Install button in Settings.
- **AI assistant:** `SplitSyncChat` (floating button on every protected page) → callable `splitSyncChat` → Anthropic Messages API. The system prompt (`functions/assistantPrompt.js`) is the assistant's only knowledge of the app and must be kept in sync with features.

---

## 5. Data model (Firestore)

### `users/{uid}`
`displayName`, `fullName`, `email`, `photoURL`, `phoneNumber`, `paymentMethods` `{ paypal, revolut, sepa: { iban (encrypted), bic } }`, `isFirstLogin`, `onboardingCompletedAt`, session-timeout setting, `isActive` (written by Taskmaster; **not enforced anywhere**).

### `groups/{groupId}`
| field | notes |
|---|---|
| `name`, `icon`, `currency` (EUR/GBP/USD) | one currency per group; balances are never converted across currencies |
| `type` | `'shared'` (default when the field is missing) or `'personal'` (added 2026-11-03) |
| `createdBy` | owner uid. Ownership passes to another member if the owner deletes their account |
| `members[]` | `{ userId, name, email, role: 'owner'|'member', joinedAt, photoURL? }`, the **source of truth for membership** |
| `memberIds[]` | uids, used for `array-contains` queries and Firestore rules. Must mirror `members` (see §8 for legacy drift) |
| `formerMembers[]` | `{ userId, name, email, leftAt, reason: 'left'|'account_deleted' }` (added 2026-11-03). A name snapshot so history keeps names |
| `createdAt`, `updatedAt` | |

### `expenses/{expenseId}`
`groupId`, `title`, `amount`, `currency`, `paidBy`, `category`, `description`, `date`, `splitMethod` (`equal|percentage|exact|shares`), `splits {uid: amount}`, `participants[]`, `createdAt`, `createdBy`, `receiptURL?`, `status` (`active` / `archived` / `deleted`, a soft delete kept for audit), `archivedAt/By`, `deletedAt/By`, `restoredAt/By`, `updatedAt/By` (on edit).
Settlements also carry: `isSettlement: true`, `paymentMethod` (`paypal|manual|sepa|revolut`), `paypalOrderId?`, `recordedBy?`, `confirmedAt?`. Settlements have **no `createdBy`**.

### Other collections
- `invitations/{id}`: `fromUserId`, `toUserId`, `groupId`, `groupName`, `status` (`pending|accepted|declined|cancelled`), `expiresAt`.
- `notifications/{id}`: `userId`, `type` (`expense`, `invitation`, `payment`, `payment_confirmation_needed`, `payment_log`, `group_deleted`, `group_ownership`), `title`, `message`, `data`, `read`, `requiresAction`, `actionStatus`, `dismissed`.
- `pendingPayments/{groupId_from_to}`: an in-flight payment awaiting payee confirmation. It blocks duplicate payments, and blocks the payee from adding expenses until they resolve it.
- `phoneNumbers/{hash}`: `{ userId }`, used by contact discovery.
- `connections/{uid}/connectedUsers/{otherUid}`: people you've shared groups with (powers Quick Add).

---

## 6. Feature catalogue

**Accounts & security:** email/password and Google sign-in; password strength meter; forgot password; biometric (WebAuthn, per device) login and re-auth for sensitive views; configurable session auto-logout with warning (mousemove intentionally excluded from activity events); IBAN encrypted server-side with AES-256-GCM and shown only to the owner and co-members (§7); onboarding wizard on first login (reopenable from Settings); dark mode.

**Groups:** create with name (≤50 chars, duplicate-name detection with suggestions), icon and currency. **Shared group or Personal tracker** (2026-11-03). Invite by link / QR / WhatsApp / email, by Quick Add from previous groups, or by contact sync (phone hash). In-app invitations with accept/decline. Pending invites are listed in the group. Members appear in real time. Leave (members, once settled) / delete (owner, once all settled, with password or biometric re-auth). CSV and PDF export. A nav strip jumps to Members / Balances / Settlements / History / Expenses.

**Expenses:** 4 split methods; inline calculator (amount field + exact-split helper); receipt scan (Cloudinary upload + Vision OCR pre-fills title/amount/date); amount ≤ 1,000,000; confirmation step; creator-only edit/archive/remove. Edit and remove lock once a settlement is recorded *after* the expense's `createdAt`. Archived expenses are hidden from Recent Expenses but count in balances. Removed expenses are a soft delete kept for audit. Settlements are styled green with a badge and can't be archived. New-expense notifications go to the other members.

**Settling up:** Settlement Summary with minimal transfers; Pay via PayPal.me / Revolut (amount copied to clipboard), QR scan-to-pay, SEPA bank details with copy, SEPA demo (auto-confirms), PayPal sandbox (server-side capture). Payee confirms or declines receipt; a decline offers the payer a retry. Payment buttons lock while a payment is pending. My Payment Activity shows Active/Dismissed tabs; a status badge on settlement rows scrolls to it. A dashboard banner prompts payees to review.

**Dashboard / Activity / Analytics / Profile:** dashboard overview cards, per-group balances, suggested settlement, cycling tagline. Activity lists all expenses across groups with Active/Archived and All/I Paid/I Owe filters, per-currency totals, and **a group link in the expense details that opens the group focused on that expense** (2026-11-03). Analytics has 5 charts (spending over time, monthly, category, per-person balance, who-owes-who) with a group selector; totals are per currency. Profile has per-currency owed/owe cards with a breakdown modal, payment settings (auth required), phone number for discovery, and collapsible sections.

**Admin (Taskmaster, `/taskmaster`):** system health, user/group lists, financial oversight, moderation, notifications. Gated by the `admin` custom claim. The logo routes admins here.

**AI assistant:** floating chat on every protected page, suggestion chips, plain-text answers.

---

## 7. Cloud Functions (`functions/index.js`, Node 22, firebase-functions v7)

| Function | Auth | Secrets | Purpose |
|---|---|---|---|
| `capturePayPalOrder` | required | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | OAuth then capture of a PayPal **sandbox** order server-side (mobile browsers block client-side capture) |
| `scanReceipt` | required (added 2026-11-03) | `GOOGLE_VISION_API_KEY` | OCR. Merchant = first alphabetic line; amount = "total"/"amount" line, else the largest decimal; date = dd/mm/yyyy |
| `splitSyncChat` | required | `ANTHROPIC_API_KEY` | Claude proxy. Model **`claude-sonnet-5-5`**, `effort: low`, `max_tokens: 2048`, server-side refusal fallback (`fallbacks: "default"`, beta header `server-side-fallback-2026-07-01`), last 20 messages, ≤4,000 chars per message. Reads only `text` blocks from the response. The system prompt is built by **`functions/assistantPrompt.js`** (full app guide + user context of shared/personal group counts sent by `SplitSyncChat`). The static guide carries a `cache_control` breakpoint so repeat turns hit the prompt cache |
| `encryptIban` | required | `IBAN_ENCRYPTION_KEY` | Validates and encrypts an IBAN with AES-256-GCM (`v2:iv:tag:ct`). Called by Profile when saving payment settings |
| `getIban` | required | `IBAN_ENCRYPTION_KEY`, `LEGACY_IBAN_KEY` | Returns a user's plain IBAN only to the owner, or to someone who is in `members` of the same group (`groupId` required). Legacy CryptoJS ciphertext is decrypted with `LEGACY_IBAN_KEY` and re-encrypted to v2 on read |

Crypto helpers live in `functions/iban.js` (unit-tested by `functions/iban.test.js`, run with `npm run test:functions`).
Secrets live in Firebase Secret Manager (`firebase functions:secrets:set NAME`). The Firebase CLI refuses to deploy **any** function until **every** secret the codebase declares exists. Logs: `firebase functions:log --only splitSyncChat`.

---

## 8. Membership lifecycle: what happens when someone leaves or deletes their account

Policy as implemented on 2026-11-03:

1. **Leaving a group** (only possible when the member's balance is 0): the member is removed from `members` **and** `memberIds`, and a `{ userId, name, email, leftAt, reason: 'left' }` snapshot is appended to `formerMembers`. They immediately lose access. The group disappears from their lists, the group page shows a "You're not a member" screen, and the Firestore rules reject their writes. **The only way back is the group's invite link (or a new in-app invitation).** Rejoining removes their `formerMembers` entry.
2. **Their data stays.** Expenses and settlements they were part of are kept unchanged, so balances and history remain correct for everyone else. Everywhere a name is shown (expense cards, details, settlement titles, Settlement Summary, CSV/PDF export, Activity), names resolve through `utils/memberDirectory.js`: current members first, then `formerMembers` (shown as "Name (left)"), then a lookup of the user's profile (for people who left before snapshots existed), and finally "Former member".
3. **Deleting an account** (`utils/accountDeletion.js`): blocked while any group balance is non-zero. The user is removed from every shared group exactly as in a leave, but with `reason: 'account_deleted'`; expenses are kept. Owned shared groups pass to the longest-standing remaining member, who is notified. Personal trackers, and groups where the user is the only member, are deleted with their expenses. Private data is deleted: users doc, notifications, sent invitations, phone-number index, connections, pending payments. Pending invitations *to* the user are marked declined. Google-only accounts re-authenticate with a Google popup.
4. **Personal trackers** (`type: 'personal'`): single-owner, no invites, Add Expense always enabled, no split UI (owner pays and is the only participant, so nothing is ever owed). They can't be joined: JoinGroup refuses, and the rules block non-members from adding themselves.

**Legacy data:** before 2026-11-03, leaving only removed the user from `members`, so some groups still hold leavers in `memberIds`. The client judges membership by `members` everywhere (Dashboard, Activity, Analytics, Profile, QuickAdd, JoinGroup, invitations, IBAN access), so those users no longer see the group and can rejoin. The data **self-heals**: when such a user opens their Dashboard, the app removes them from that group's `memberIds` and writes their `formerMembers` snapshot. Until they next open the app, their stale `memberIds` entry still passes the Firestore membership rule.

---

## 9. Firestore security rules (summary, as written 2026-11-03)

- `users`: read by any signed-in user; write own doc only; **admins may change only `isActive`** (Taskmaster suspend/reactivate).
- `notSuspended()`: users with `isActive == false` cannot write expenses or update groups. The app also signs them out at login with a "suspended" message.
- `groups`: read by any signed-in user (needed for invite previews). Create only as `createdBy == uid` with `memberIds == [uid]`. Update by (non-suspended) members, or by a non-member adding themselves (joining), except on personal trackers. **Delete by the owner only** (or a sole remaining member).
- `expenses`: **read only by current group members or admins**. **Create/update/delete only by current, non-suspended group members** (`isGroupMember()` reads the group's `memberIds`); `createdBy`, when present, must be the requester; `groupId` can't change. The app's `==` and `in` (≤30) queries satisfy the read rule; listing the whole collection does not (except for admins).
- `invitations`: read by sender, recipient or admin; create as sender; recipient updates; sender deletes.
- `notifications`: read/delete own; any signed-in user can create. **Update only by the owner, or by the payer/payee named in `data`**, and they cannot change `userId`, `type`, or `data.amount/payerId/payeeId/groupId`.
- `pendingPayments`: payer or payee read/delete; payer creates/updates.
- `connections`, `phoneNumbers`: as before. Fallback: deny everything else.

Tested against the Firestore emulator by `firestore-tests/rules.test.js` (23 tests covering every query and write path the app uses): `npm run test:rules`. **Deployed 2026-11-03.**

---

## 10. Build, run, test, deploy

```bash
npm install                     # root (React app)
cd functions && npm install     # Cloud Functions
npm start                       # dev server
CI=true npx react-scripts test --watchAll=false   # full Jest suite (54 suites)
npm run test:functions          # Cloud Functions IBAN crypto unit tests (node --test)
npm run test:rules              # Firestore rules on the emulator (needs Java; first: cd firestore-tests && npm install)
npm run build                   # production build → build/
firebase deploy --only hosting
firebase deploy --only functions            # or --only functions:splitSyncChat
firebase deploy --only firestore:rules
```

Env (`.env`, git-ignored): `REACT_APP_FIREBASE_*` (api key, auth domain, project id, storage bucket, messaging sender id, app id, measurement id), `REACT_APP_CLOUDINARY_CLOUD_NAME`, `REACT_APP_CLOUDINARY_UPLOAD_PRESET`, `REACT_APP_PAYPAL_CLIENT_ID`, `REACT_APP_BASE_URL`.
**Never put secrets in a `REACT_APP_*` variable.** CRA inlines them into the public JavaScript, and because some code reads `process.env` as a whole object, *every* `REACT_APP_*` value in `.env` ends up in the bundle, even unused ones. `REACT_APP_ENCRYPTION_KEY` must be removed from `.env` once its value is stored as the `LEGACY_IBAN_KEY` secret (§12).

Windows note: `firebase emulators:exec` can leave the Firestore emulator (java.exe) running and holding port 8080; stop it before re-running `npm run test:rules`.

Testing notes: CRA's Jest uses `resetMocks: true`, so module-level `jest.fn(impl)` implementations are wiped before each test. Use plain functions inside `jest.mock` factories, or set implementations in `beforeEach`. Page tests mock `react-router-dom` per file, so any new router hook must be added to those mocks (GroupDetails tests now stub `useLocation`).

The production build has 6 ESLint warnings that predate 2026-11-03 (hook deps in AddExpenseModal, InvitationNotification, QuickAddMembers, GroupDetails; one missing default case). `CI=true npm run build` turns warnings into errors.

---

## 11. Known issues and open items (not fixed yet)

Ordered by importance.

1. **User profiles are readable by any signed-in user.** Payment handles (PayPal/Revolut usernames), phone number and email are visible to any account that knows a uid. The IBAN is now server-encrypted, so its ciphertext is useless without the key. Fixing the rest needs payment details moved to a sub-document readable only by co-members (rules can't check "shares a group" without a lookup per group).
2. **Legacy IBAN ciphertext.** Until an IBAN is next read through `getIban` (owner opens Profile, or someone opens Settle Up with them), it stays in the old format, which anyone with the old key can decrypt. That key was public in earlier app bundles. Once `LEGACY_IBAN_KEY` is set and functions are deployed, each IBAN upgrades on first read. A one-off batch migration can be added if needed.
3. **Settling with a former member** (only possible for accounts deleted under the old code, which skipped balance checks): SettleUpModal looks up payees only in `members`, so payment details won't load, and `getIban` refuses non-members. The old account deletion also *deleted those users' paid expenses*, which may have shifted balances in shared groups before 2026-11-03. That can't be repaired automatically.
4. `pendingPayments` read allows `resource == null`, which lets anyone probe whether a document ID exists. Low risk.
5. Group documents are readable by any signed-in user who knows the ID (needed for invite previews). Member names and emails are exposed to anyone holding an invite link.
6. Any signed-in user can *create* a notification for anyone (needed for expense/payment notifications). This could be abused for spam; moving notification creation into Cloud Functions would fix it.
7. Receipt OCR is heuristic (first line as merchant, dd/mm/yyyy dates only).
8. PayPal integration is sandbox-only; the payee e-mail was intentionally removed from the order.
9. One Jest test failed once in five coverage runs (2026-11-03) and passed on every rerun. It is a timing flake; the failing test name was not captured. If it recurs, note the name here.
10. Coverage is 82.9% of lines (it was 84.4%). The new `utils/accountDeletion.js` and `utils/ibanService.js` have no unit tests yet; they are good next candidates.

Resolved on 2026-11-03 (second session): expense read access, IBAN key exposure, notification tampering, Taskmaster suspend, legacy `memberIds` (self-healing).

---

## 12. Deployment state / pending actions

Status at the end of 2026-11-03: **fully deployed.**

- [x] **Firestore rules deployed** (expense reads/writes members-only, notification update limits, admin suspend, owner-only group delete).
- [x] All code committed to `master`.
- [x] **Secrets created** by the user (Claude's session was not permitted to write to Secret Manager), then verified: `IBAN_ENCRYPTION_KEY` is 64 hex chars; `LEGACY_IBAN_KEY` matches the old client key. To recreate or rotate them:
  ```powershell
  # 1. new random AES-256 key
  node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" > iban.key
  firebase functions:secrets:set IBAN_ENCRYPTION_KEY --data-file iban.key
  Remove-Item iban.key
  # 2. the old client key, so existing IBANs can be migrated (value of REACT_APP_ENCRYPTION_KEY in .env)
  firebase functions:secrets:set LEGACY_IBAN_KEY
  ```
- [x] `REACT_APP_ENCRYPTION_KEY` removed from `.env` (replaced by a comment); the production bundle was checked and contains no key value.
- [x] Functions deployed: `splitSyncChat` (AI assistant restored), `encryptIban`, `getIban` (new), `scanReceipt`, `capturePayPalOrder`.
- [x] Hosting deployed to https://splitsync-dev.web.app.
- [x] Assistant verified by sending the exact production request (model, settings, new prompt) to the Claude API: HTTP 200, accurate answer about personal trackers and leaving groups, prompt cache written (3,935 tokens). An in-browser check was not possible (Chrome extension not connected), so try the chat once on the live site.
- [ ] Optional: make the GitHub repo public for employers (see the recommendations in the 2026-11-03 conversation: confirm SETU policy, add homepage and topics, a README "my role" section, and restrict the Firebase web API key to your domains).

Order matters: secrets → functions → hosting. Until hosting is deployed, users run the previous client against the new rules. That is safe: its queries still pass the rules, and its destructive old account-deletion path is now blocked, because its cross-group expense query is denied.

---

## 13. History (from git)

| Period | Milestones |
|---|---|
| 2025-11-25 → 11-28 | CRA scaffold; auth, dashboard, groups, icons, invite links; full expense tracking with 4 split methods, balances, settlement tracking |
| 2026-01-23 → 01-31 | Env-secured Firebase keys; receipt OCR (Tesseract, then Google Cloud Vision function); settlement UX; bottom nav with Activity/Profile/QuickAdd; Cloudinary profile photos; multi-channel invite sharing with QR |
| 2026-02-02 → 02-09 | Settings page; tooltips; receipt image storage; v1.0 production release; IBAN encryption + biometric auth; SEPA; QR app sharing + info hub; full dark mode; device-specific biometrics |
| 2026-02-12 → 02-19 | Quick Add, in-app invitations, contact sync; payment confirmation flow; real-time notifications bell; session timeout; balance breakdown modal; README + licence |
| 2026-02-20 → 03-06 | Test push from 0 to ~1,240 tests; Analytics page (5 charts); AI chatbot via Cloud Function; auto-logout timer; QR scan-to-pay; PayPal sandbox panel |
| 2026-03-22 → 03-31 | Leave/delete group with balance guards; edit/delete expense with settlement lock; offline PWA service worker; per-currency balances; disable Add Expense when solo |
| 2026-04-01 → 04-14 | Input validation limits; Lucide icons per group type; tutorial videos; PDF export; dashboard overview; duplicate group names; soft delete + archive; Taskmaster admin panel; Firestore-backed pending payments (1,397 tests, 84.37% coverage); Doxygen docs; screenshots; project report |
| 2026-04-16 → 04-20 | Inline calculator; SEPA bank-transfer path; payment status badges; dismiss/restore payment activity; settlement styling; session-timeout fixes; final test additions |
| 2026-04 → 10 (uncommitted) | Server-side PayPal capture (`capturePayPalOrder`), service worker v2, report PDF / showcase page updates |
| 2026-11-03 | Audit and fixes session (see Change log) |

---

## 14. Change log

### 2026-11-03: audit and fixes

Reported issues and what was found/done:

| # | Report / finding | Root cause | Fix |
|---|---|---|---|
| 1 | **AI assistant stopped working** | `claude-sonnet-4-20250514` was retired on 2026-06-15; every call returned `not_found_error` (confirmed in function logs) | Model → `claude-sonnet-5-5`, `effort: low`, `max_tokens` 512 → 2048 (thinking tokens count toward it), read only `text` blocks (a thinking block now comes first), refusal handling + server-side fallback. System prompt updated for the new behaviour. **Needs functions deploy.** |
| 2 | **Recent Expenses "Add Expense" link adds expenses in a group with no members** | Only the header button checked `isSoloGroup`; the Recent Expenses link and "Add First Expense" called `setShowAddExpense(true)` directly | One `canAddExpense` gate on every entry point, plus a guard inside AddExpenseModal itself |
| 3 | **Leavers could still act in the group** | Leave removed the user from `members` but **not** `memberIds`, so the rules still granted writes, the group stayed on their dashboard, and JoinGroup said "already a member" (rejoining was impossible). GroupDetails had no membership check, so anyone with the URL could open it and add expenses. The rules let **any** signed-in user write **any** expense | Leave clears both lists and writes `formerMembers`; GroupDetails shows a "not a member" screen; membership judged by `members` everywhere; rules require group membership for expense writes |
| 4 | **Names of leavers show "Unknown"** | All name lookups searched only the current `members` | `formerMembers` snapshot + `memberDirectory` helpers + `useFormerMemberNames` profile lookup for older leavers; shown as "Name (left)" |
| 5 | **Personal expense tracking without invites** | Not supported (solo groups were blocked by design) | New group type **Personal**: no invites, Add Expense always on, no split UI, receipt scan works, can't be joined |
| 6 | **Activity card → go to its group** | Not available; the Edit button in Activity also did nothing (no `onEdit` passed) | The group name in the expense details header links to the group, which scrolls to and highlights the expense (archived or removed ones open in the group's details modal); Edit opens the group's editor |
| 7 | Account deletion destroyed shared data | It deleted every expense the user had paid **in any group** (erasing other members' debts), deleted owned groups while orphaning their expenses, never removed the user from shared groups, skipped balance checks, and failed for Google accounts | New policy in §8 (`utils/accountDeletion.js`) |
| 8 | Editing an expense unlocked it after settlement | Edit overwrote `createdAt` with the current time, so later settlements no longer counted as "after" the expense | Edit no longer writes `groupId`/`createdAt`/`createdBy`; adds `updatedAt`/`updatedBy` |
| 9 | Activity/Profile break for users in more than 30 groups | Firestore `in` queries accept at most 30 values | Queries chunked in 30s |
| 10 | Activity showed "You owe 0.00" on expenses the user isn't in | Missing participant check | Shows "Not involved" |
| 11 | Any group member could delete the whole group (rules) | Delete rule checked membership, not ownership | Owner-only (or sole remaining member) |
| 12 | `scanReceipt` callable without sign-in | No auth check | Auth required |
| 13 | Chat had no message size limit | — | ≤ 4,000 chars per message |
| 14 | SettleUpModal PayPal test failing | The uncommitted server-capture change wasn't mocked | Test mocks `firebase/functions` |

New files: `src/utils/memberDirectory.js` (+ test), `src/hooks/useFormerMemberNames.js`, `src/utils/accountDeletion.js`, `projectdoc.md`.
Tests added: gating, non-member, personal-tracker, leave-writes-formerMembers and former-member-name tests (GroupDetails); group link, edit-from-Activity and legacy-leaver filtering (Activity); legacy-leaver invitation (invitationSystem); memberDirectory unit tests. Full suite: **54 suites, 1,466 tests, all passing**. The production build compiles.

### 2026-11-03 (second session): safety hardening, assistant update, commit and deploy

| Area | Problem | Change |
|---|---|---|
| Expense privacy | Any signed-in account could read every expense | Rule: read only by group members or admins. Verified on the emulator that the app's `==` and chunked `in` queries still pass |
| IBAN protection | The client-side AES key (`REACT_APP_ENCRYPTION_KEY`, plus a hard-coded fallback) was bundled into the public JS, so any IBAN could be decrypted | Server-side AES-256-GCM (`encryptIban`/`getIban`, key in Secret Manager). Plain IBANs are returned only to the owner or co-members; legacy values re-encrypt on read; client encrypt/decrypt removed (`utils/ibanService.js` replaces it) |
| Notifications | Any signed-in user could update any notification | Owner, or the payer/payee named in the payment, only; amount, parties and owner are immutable |
| Suspension | Taskmaster's suspend was denied by the rules and never enforced | Admins may change `isActive` only; suspended users can't write expenses or groups (rules) and are signed out at login with a message |
| Legacy leavers | Stale `memberIds` entries | Self-heal on Dashboard load (remove from `memberIds`, add `formerMembers`) |
| AI assistant | Prompt incomplete; context always "0 groups" | New `functions/assistantPrompt.js`: a complete guide covering every feature, including personal trackers, leave/rejoin, "(left)" names, the Activity group link, safe account deletion, server-side IBAN protection, suspension, settings layout and exact button names. `SplitSyncChat` now sends shared/personal group counts; prompt caching enabled |
| Errors | Payment-settings "Permission denied. Check Firestore security rules." shown to users | Friendly message |

New: `functions/iban.js` (+ `iban.test.js`, 5 tests), `functions/assistantPrompt.js`, `src/utils/ibanService.js`, `firestore-tests/` (23 emulator rule tests), npm scripts `test:functions` and `test:rules`.
Results: Jest 54 suites / 1,461 tests passing (7 obsolete client-encryption tests removed), functions 5/5, rules 23/23, production build compiles.
Deployed: Firestore rules, all functions, hosting (after the user created the two secrets).

---

## 15. Maintaining this document

- Add a dated entry to §14 for every working session, and keep §12 (deployment state) accurate.
- When a feature changes, update §6, the data model (§5) if fields change, and **the assistant guide in `functions/assistantPrompt.js`**, since the assistant only knows what that file says.
- When rules change, update §9, add or adjust tests in `firestore-tests/rules.test.js`, and run `npm run test:rules` before deploying.
