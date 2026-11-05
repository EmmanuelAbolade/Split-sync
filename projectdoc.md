# Split-Sync — Project Document

> Living reference for the Split-Sync project. Update it whenever behaviour, data shape, rules, or deployment state changes. The **Change log** at the bottom records each working session.
>
> Last updated: **2026-11-04**

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
| Tests | `master`: 60 Jest suites / 1,550 tests (85.1% lines), 11 Functions unit tests, 31 rules tests. Branch `feature/circles-1`: 67 suites / 1,596 tests (85.8%), 27 Functions unit + 20 emulator tests, 48 rules tests. All passing as of 2026-11-05 |
| Licence | Apache 2.0 |

---

## 2. Tech stack

**Frontend:** React 19 (Create React App / `react-scripts` 5), React Router 7 (`react-router-dom` 7.18.4; all direct dependencies are pinned to exact versions from Phase 0.5), Zustand 5 (state), Tailwind CSS 3 (with `dark:` class strategy), lucide-react icons, Recharts 3 (analytics), qrcode / qrcode.react, crypto-js (legacy, server-side migration only), tesseract.js (legacy OCR, superseded by Cloud Vision), `@paypal/react-paypal-js`.

**Backend (Firebase):** Firebase Auth (email/password + Google), Cloud Firestore (real-time `onSnapshot` everywhere), Cloud Functions v2 (Node 22), Firebase Hosting. From Circles Phase 1: a second Firestore database `circles` (europe-west1, same as `(default)`; billed from the first read because only one database per project gets the free allowance), Zod 4.6.7 (Function input validation), SimpleWebAuthn 14 (server-verified passkeys), App Check in monitor mode (off until a reCAPTCHA Enterprise site key is configured). Cloudinary (unsigned upload preset) stores profile photos and receipt images.

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
Public profile (readable by any signed-in user): `displayName`, `fullName`, `email`, `photoURL`, `phoneHash` (SHA-256 of the number, for contact discovery), `isFirstLogin`, `onboardingCompletedAt`, session-timeout setting, `lastActive` (written once a day per device), `isActive` (`false` = suspended by an admin; enforced at login and by the rules).

### `users/{uid}/private/details` (owner only, added 2026-11-04)
`paymentMethods` `{ paypalUsername, revolutUsername, bic, encryptedIBAN (v2 AES-256-GCM) }`, `phoneNumber`, `updatedAt`. Legacy copies of these fields on the public doc are moved here on first read (by the client or the Cloud Functions) and deleted from the public doc.

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

**Admin (Taskmaster, `/taskmaster`):** gated by the `admin` custom claim (the logo routes admins here). Sections: **System Health** (live counts, users active in the last 7 days, pending/expired invitations; quick actions to delete expired invitations and open Firestore usage and Cloud Function logs), **Platform Growth** (new users, groups and expenses per month), **User Management** (search, details, suspend/re-activate; admins cannot suspend themselves), **Group Management** (type, owner, members, former members, expense count, balance status), **Financial Oversight** (spending, settlements and amounts still owed per currency; removed expenses excluded), **Content Moderation** (keyword scan of group names and expense text, with remove-expense and rename-group actions; link to Formspree feedback submissions), and **Notifications** (system-wide in-app announcement to all active users). Calculations live in `src/utils/adminStats.js` (unit-tested). Admins cannot see payment details or phone numbers.

**AI assistant:** floating chat on every protected page, suggestion chips, plain-text answers.

---

## 7. Cloud Functions (`functions/index.js`, Node 22, firebase-functions v7)

| Function | Auth | Secrets | Purpose |
|---|---|---|---|
| `capturePayPalOrder` | required | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | OAuth then capture of a PayPal **sandbox** order server-side (mobile browsers block client-side capture) |
| `scanReceipt` | required (added 2026-11-03) | `GOOGLE_VISION_API_KEY` | OCR. Merchant = first alphabetic line; amount = "total"/"amount" line, else the largest decimal; date = dd/mm/yyyy |
| `splitSyncChat` | required | `ANTHROPIC_API_KEY` | Claude proxy. Model **`claude-sonnet-5-5`**, `effort: low`, `max_tokens: 2048`, server-side refusal fallback (`fallbacks: "default"`, beta header `server-side-fallback-2026-07-01`), last 20 messages, ≤4,000 chars per message. Reads only `text` blocks from the response. The system prompt is built by **`functions/assistantPrompt.js`** (full app guide + user context of shared/personal group counts sent by `SplitSyncChat`). The static guide carries a `cache_control` breakpoint so repeat turns hit the prompt cache |
| `encryptIban` | required | `IBAN_ENCRYPTION_KEY` | Validates and encrypts an IBAN with AES-256-GCM (`v2:iv:tag:ct`). Called by Profile when saving payment settings |
| `getGroupPaymentMethods` | required | none | Returns `{ paypalUsername, revolutUsername, bic, hasIban }` for every member of a group the caller belongs to. Never returns IBANs or phone numbers. Migrates legacy public payment fields to the private doc |
| `getIban` | required | `IBAN_ENCRYPTION_KEY`, `LEGACY_IBAN_KEY` | Returns a user's plain IBAN only to the owner, or to someone who is in `members` of the same group (`groupId` required). Legacy CryptoJS ciphertext is decrypted with `LEGACY_IBAN_KEY` and re-encrypted to v2 on read |

Crypto helpers live in `functions/iban.js`, and private-profile helpers in `functions/privateData.js`. Both are unit-tested (`iban.test.js`, `privateData.test.js`; run with `npm run test:functions`). Dependencies: `firebase-functions` 7.4, `firebase-admin` 13 (14 is available but is a major upgrade, not yet done); the unused `@google/generative-ai` was removed.
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

## 9. Firestore security rules (summary, as of 2026-11-04)

- `users`: read by any signed-in user; write own doc only; **admins may change only `isActive`** (Taskmaster suspend/reactivate). **`paymentMethods` and `phoneNumber` can never be added or changed on the public doc** (legacy copies may only be removed).
- `users/{uid}/private/{doc}`: **owner only** (not even admins).
- `notSuspended()`: users with `isActive == false` cannot write expenses or update groups. The app also signs them out at login with a "suspended" message.
- `groups`: read by any signed-in user (needed for invite previews). Create only as `createdBy == uid` with `memberIds == [uid]`. Update by (non-suspended) members. A non-member may **only join** (`isSelfJoin()`): `memberIds` gains exactly their uid, `members` gains exactly one entry (theirs), and `formerMembers`/`updatedAt` may change; nothing else, and never on personal trackers. Before 2026-11-04 a "join" could also rename the group, change the owner or remove members. Admins may only rename (`name`, `moderatedAt`, `moderatedBy`). **Delete by the owner only** (or a sole remaining member).
- `expenses`: **read only by current group members or admins**. **Create/update/delete only by current, non-suspended group members** (`isGroupMember()` reads the group's `memberIds`); `createdBy`, when present, must be the requester; `groupId` can't change. Admins may only soft-remove (`status: 'deleted'` plus `deletedAt`/`deletedBy`/`moderated`). The app's `==` and `in` (≤30) queries satisfy the read rule; listing the whole collection does not (except for admins).
- `invitations`: read by sender, recipient or admin; create as sender; recipient updates; sender **or admin** deletes (expired-invitation cleanup).
- `notifications`: read/delete own; any signed-in user can create. **Update only by the owner, or by the payer/payee named in `data`**, and they cannot change `userId`, `type`, or `data.amount/payerId/payeeId/groupId`.
- `pendingPayments`: payer or payee read/delete; payer creates/updates.
- `connections`, `phoneNumbers`: as before. Fallback: deny everything else.

Tested against the Firestore emulator by `firestore-tests/rules.test.js` (31 tests covering every query and write path the app uses, including the admin moderation paths): `npm run test:rules`. **Deployed 2026-11-04.**

---

## 10. Build, run, test, deploy

```bash
npm install                     # root (React app)
cd functions && npm install     # Cloud Functions
npm start                       # dev server
CI=true npx react-scripts test --watchAll=false   # full Jest suite (60 suites)
npm run test:functions          # Cloud Functions unit tests: IBAN, private data, core pipeline helpers (node --test)
npm run test:functions:emulator # step-up, idempotency, rate limit, admin flags on the Firestore emulator
npm run test:rules              # Firestore rules on the emulator (needs Java; first: cd firestore-tests && npm install)
npm run build                   # production build → build/
firebase deploy --only hosting
firebase deploy --only functions            # or --only functions:splitSyncChat
firebase deploy --only firestore:rules
```

Env (`.env`, git-ignored): `REACT_APP_FIREBASE_*` (api key, auth domain, project id, storage bucket, messaging sender id, app id, measurement id), `REACT_APP_CLOUDINARY_CLOUD_NAME`, `REACT_APP_CLOUDINARY_UPLOAD_PRESET`, `REACT_APP_PAYPAL_CLIENT_ID`, `REACT_APP_BASE_URL`.
**Never put secrets in a `REACT_APP_*` variable.** CRA inlines them into the public JavaScript, and because some code reads `process.env` as a whole object, *every* `REACT_APP_*` value in `.env` ends up in the bundle, even unused ones. `REACT_APP_ENCRYPTION_KEY` must be removed from `.env` once its value is stored as the `LEGACY_IBAN_KEY` secret (§12).

Windows note: `firebase emulators:exec` can leave the Firestore emulator (java.exe) running and holding port 8080; stop it before re-running `npm run test:rules`.

Testing notes: CRA's Jest uses `resetMocks: true`, so module-level `jest.fn(impl)` implementations are wiped before each test. Use plain functions inside `jest.mock` factories, or set implementations in `beforeEach`. Page tests mock `react-router-dom` per file, so any new router hook must be added to those mocks (GroupDetails tests now stub `useLocation`). `src/__mocks__/react-router-dom.js` replaces the router in every test automatically (CRA's Jest root is `src/`); `src/App.test.js` opts out with `jest.mock('react-router-dom', () => jest.requireActual('react-router-dom'))` to test real routing. Two settings make the real React Router 7 load under CRA's Jest 27: a `moduleNameMapper` entry for `react-router/dom` in `package.json` (Jest 27 can't resolve package `exports` subpaths) and a `TextEncoder`/`TextDecoder` polyfill in `src/setupTests.js`. Neither affects the production build.

The production build has 6 ESLint warnings that predate 2026-11-03 (hook deps in AddExpenseModal, InvitationNotification, QuickAddMembers, GroupDetails; one missing default case). `CI=true npm run build` turns warnings into errors.

---

## 11. Known issues and open items (not fixed yet)

Ordered by importance.

1. **Legacy IBAN ciphertext.** Until an IBAN is next read through `getIban` or `getGroupPaymentMethods`, it stays in the old format, which anyone with the old key can decrypt (that key was public in earlier app bundles). It upgrades on first read. A one-off batch migration can be added if needed.
2. **Group members can change any group field.** A current member can edit the group document freely (needed for leaving, name sync and ownership hand-over), so a malicious member could, for example, remove others. Tightening this means per-operation rules or moving those operations into Cloud Functions.
3. **Phone-number hashes can be reversed.** Contact discovery stores an unsalted SHA-256 of the number on the public profile, and the space of phone numbers is small enough to brute-force. This is a general limitation of hash-based contact matching; a server-side matching function would remove it.
4. **Settling with a former member** (only possible for accounts deleted under the old code, which skipped balance checks): payment details won't load for non-members. The old account deletion also *deleted those users' paid expenses*, which may have shifted balances in shared groups before 2026-11-03. That can't be repaired automatically.
5. `pendingPayments` read allows `resource == null`, which lets anyone probe whether a document ID exists. Low risk.
6. Group documents are readable by any signed-in user who knows the ID (needed for invite previews). Member names and emails are exposed to anyone holding an invite link.
7. Any signed-in user can *create* a notification for anyone (needed for expense/payment notifications). This could be abused for spam; moving notification creation into Cloud Functions would fix it.
8. **`splitsync-web-key` API key is unused.** The user confirmed it doesn't match the receipt-scanner key, so it can be deleted in Google Cloud Console → APIs & Services → Credentials.
9. `firebase-admin` 13 → 14 (major) upgrade not done.
10. Receipt OCR is heuristic (first line as merchant, dd/mm/yyyy dates only). PayPal is sandbox-only.
11. ~~Intermittent Jest failure~~ Identified and fixed on 2026-11-04 (Phase 0.5 branch): `sepaPayment.test.js` "Generates payment reference if not provided" didn't pin `Math.random`, so the simulated 5% payment failure hit it about 1 run in 20.
12. `npm audit` (report only, 2026-11-04): app 70 findings, functions 38, all transitive, almost all from the `react-scripts` 5 toolchain (webpack, jest, svgo, workbox) and `firebase-admin`'s Google Cloud dependencies. Nothing reachable from the shipped bundle was identified. The fix is a toolchain migration away from CRA (planned later), never `npm audit fix --force`.

Resolved: expense read access, IBAN key exposure, notification tampering, Taskmaster suspend, legacy `memberIds` (self-healing), the Gemini key (deleted by the user), Firebase web key restricted to the app's domains (by the user), **public-profile exposure of payment details and phone numbers (2026-11-04)**, **join-and-hijack via the group join rule (2026-11-04)**, **non-functional Taskmaster sections (2026-11-04)**, and coverage back to 84.1%.

---

## 12. Deployment state / pending actions

Status at the end of 2026-11-04: **fully deployed** (functions incl. `getGroupPaymentMethods`, rules, hosting).

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
- [x] GitHub repo made **public** (2026-11-04) with homepage, topics and a README Highlights section; Firebase web key restricted to the app domains and localhost by the user.
- [ ] Delete the unused `splitsync-web-key` API key (§11.8). This is a user action in the Google Cloud console.
- [x] **Circles Phase 0.5** verified by the user on localhost (invite link resumes after sign-in with a real group), approved, merged to `master` and hosting deployed (2026-11-05). No rules or Functions changes in this phase.
- [x] **Preview sign-in fixed (2026-11-05).** The Firebase web key ("Browser key (auto created by Firebase)", starts `AIzaSyDo`, ends `IUxE`) only allows listed websites, and Google rejects mid-name wildcards such as `splitsync-dev--*.web.app`, so each preview address must be added exactly. The user added `https://splitsync-dev--circles-0-5-jliv3m33.web.app/*`; verified that sign-in requests from it now reach Firebase. While saving, the user also confirmed the key no longer allows the Gemini API (one call on 2026-11-04 from the deleted Gemini key; harmless).
- [x] **Preview channel convention (agreed 2026-11-05):** one fixed channel `circles-review` for every Circles phase: https://splitsync-dev--circles-review-cijsoz51.web.app (`firebase hosting:channel:deploy circles-review --expires 30d`; redeploying keeps the address).
- [x] User added the circles-review address to the web key and removed circles-0-5 (2026-11-05); sign-in from the preview verified.
- [x] **Circles Phase 1 backend deployed (2026-11-05, approved):** `circles` database created (europe-west1, delete protection ON); rules and indexes deployed for both databases; new functions `stepUp-*` (6) and `admin-setFlag` created (existing functions untouched; new ones verified to reject callers who are not signed in). No flags set, so users see no change. Front end merged to master and deployed to live hosting the same day after approval.
- [ ] Optional, user: App Check monitor mode needs a reCAPTCHA Enterprise key (Google Cloud console) registered in Firebase App Check, then `REACT_APP_RECAPTCHA_ENTERPRISE_SITE_KEY` in `.env` (a public site key). Until then App Check stays off.

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

### 2026-11-04: Taskmaster, profile privacy, tests and cleanups

| Area | Problem | Change |
|---|---|---|
| Taskmaster | Quick actions, moderation cards and broadcast did nothing; "Active (7 days)", "Settled", group status and the user list read fields that never existed; the suspend popup never closed; admin claims were logged to the console | Every card and button now works (see §6): expired-invitation cleanup, console links, new Platform Growth section, real active-user count (`lastActive`), accurate financial totals, group details incl. former members, keyword moderation with remove/rename, real broadcast. Logic in `utils/adminStats.js` with 7 unit tests |
| Profile privacy | Any signed-in user could read anyone's PayPal/Revolut usernames, BIC and plain phone number from the public profile | Moved to the owner-only `users/{uid}/private/details`; members get payment options from the new `getGroupPaymentMethods` function (membership-checked, no IBANs); rules forbid writing these fields to the public profile; legacy data migrates automatically |
| Group join rule | "Joining" a shared group could be combined with renaming it, changing the owner or removing members | `isSelfJoin()` allows only adding yourself |
| Tests | No tests for account deletion, the IBAN service or the private profile; coverage had dropped to 82.9% | 22 new unit tests (`accountDeletion`, `ibanService`, `privateProfile`, `adminStats`) + 4 functions tests + 8 emulator rule tests. Coverage 84.1% |
| Cleanups | Unused Gemini SDK; outdated `firebase-functions` | Removed; upgraded to 7.4.0. Gemini API key deleted by the user; Firebase web key restricted by the user |
| README | Draft employer section pending | Highlights section added; privacy and test descriptions updated |
| AI assistant | Did not know payment details are now private | Prompt updated |

Results: Jest 58 suites / 1,483 tests, functions 9/9, rules 31/31, lint clean on changed files, build compiles. Deployed functions, rules and hosting; the new functions were checked live (they reject callers who aren't signed in).

### 2026-11-04 (later): payment banner and Analytics names

| Report | Cause | Fix |
|---|---|---|
| "Payment method not set" banner keeps showing although a payment method exists | Accounts that saved bank details before 5 Feb 2026 have the IBAN in **plain text** as `paymentMethods.iban`. The Dashboard (and `hasIban` for Settle Up) only recognised `encryptedIBAN`, so those users got the banner, other members saw no Bank Transfer option, and the IBAN sat unencrypted | Dashboard counts `iban`. Plain IBANs are now encrypted (v2) and the plain copy deleted: by the client on load (`loadMyPrivateDetails`) and by the server in `getIban`/`getGroupPaymentMethods` (`privateData.upgradePlainIban`), which covers users who never sign in |
| Analytics "Per-Person Balance" / "Who Owes Who" show a long reference that breaks the mobile layout on some accounts | Names came only from current group members; anyone who had left (or deleted their account) fell back to their raw 28-character user ID. Only accounts sharing a group with a former member were affected | Names resolve via current members → `formerMembers` ("Name (left)") → profile lookup → "Former member". Labels are capped at 12 characters and truncate; never a raw ID |
| (found while fixing) Who Owes Who merged the same two people's debts across **different currencies** and dropped the currency | Consolidation key ignored currency | Rows are kept per currency. Per-Person Balance shows one bar per person per currency when "All groups" mixes currencies |

Tests: +3 Analytics regression tests, +1 private-profile test, +2 functions tests. Jest 58 suites / 1,487, functions 11/11. Deployed `getIban`, `getGroupPaymentMethods` (now uses `IBAN_ENCRYPTION_KEY`) and hosting.

### 2026-11-04 (Circles Phase 0 and 0.5)

Phase 0 (committed `d3745ea`): Circles research and design docs in `docs/circles/` (audit, design, references; private study checklist git-ignored).

Phase 0.5 (branch `feature/circles-0.5`; verified by the user on localhost, merged and deployed 2026-11-05):

| Area | Problem | Change |
|---|---|---|
| Invite links | A signed-out person opening `/invite/{id}` was sent to Login and then always to the Dashboard, so the invite was lost (also after registering) | New `src/utils/postAuthRedirect.js`: protected routes remember the requested path in sessionStorage (`splitsync.postAuthRedirect`); Login (email and Google) and Register return there with `replace`. Only safe internal paths are accepted: no `//`, backslashes, control characters, absolute or `javascript:` URLs, or auth pages; anything else goes to `/dashboard`. The target is read before the async sign-in (biometric prompt race) and cleared when the app shell mounts |
| Routing tests | `App.js` had 0% coverage | `src/App.test.js` (36 tests, real router): every guard both ways, `/` and `*`, remember/resume/clear, unsafe targets, bottom nav hidden on group and invite pages, Taskmaster outside the shell, suspension sign-out, once-a-day `lastActive`, lookup failure doesn't block sign-in. `App.js` is now at 100% lines |
| Dependencies | `react-router-dom` 7.x advisories (fixed in later 7.18 releases); `^` ranges everywhere | `react-router-dom` 7.18.4 (non-breaking, within 7.x; 7.18.5 skipped as only 8 days old); every direct dependency in the app, `functions/` and `firestore-tests/` pinned to its exact installed version |
| Flaky test | See §11.11 | `Math.random` pinned in that test |

Results: Jest 60 suites / 1,550 tests passing, 85.1% lines; functions 11/11; rules 31/31; lint 0 errors on changed files; build compiles (+1.2 kB gzip). Preview deployed; the live site is unchanged.

---

### 2026-11-05 (Circles Phase 1: foundations; approved and live)

Branch `feature/circles-1`. Everything is additive and invisible with flags off.

| Area | What was built |
|---|---|
| Server core (`functions/core/`) | `errors` (safe messages, internal errors never leak), `schemas` (Zod: amounts as integer minor units, EUR/USD/GBP, safe ids, idempotency keys), `flags` (server-enforced, fail closed, 30 s cache), `authz` (auth, admin claim, recent sign-in via `auth_time`), `rateLimit` (fixed window per user and action), `idempotency` (result stored in the same transaction; same key with a different request refused), `ledger` (append-only entry validation, currency must match the container, per-container and per-currency sums with reversals), `audit` (uids only; names, emails, IBANs, notes and tokens stripped), `canonical` (deterministic JSON and action hash shared with the browser) |
| Step-up (`functions/stepUp/`) | Callables `stepUp-begin/complete/registerBegin/registerComplete/listCredentials/removeCredential`. Challenge bound to the exact action (2 min, single use); token bound to uid and action hash (5 min, single use, stored only as its SHA-256). Passkeys verified on the server (SimpleWebAuthn, user verification required); fallback is a sign-in under 5 minutes old. Adding or removing a passkey needs a recent sign-in, so a stolen session cannot add its own. Passkeys work per site (live, firebaseapp.com, localhost:3000 and this project's preview channels) |
| Admin flags | `admin-setFlag` (admin claim, validated, audit-logged); Taskmaster → Feature Flags (`src/components/admin/FeatureFlagsPanel.jsx`) with on-for-everyone and a tester allow-list |
| Rules | `firestore.rules`: `config/features` readable when signed in, server-only step-up/idempotency/rate-limit collections, admin-readable `auditLog`. New `firestore.circles.rules` for the `circles` database, from the design with three tightenings: invites can be fetched by id but not listed; privacy settings need all four values; trusted/blocked entries hold only `addedAt`. `firebase.json` now lists both databases with index files (production had no custom indexes, so none can be lost) |
| Client | `src/config/featureFlags.js`, `src/config/spaces.js` (space registry; missing `spaceId` means Expenses), `useFeatureFlags` (live, off while loading or on error), `services/circlesDb.js` (lazy), `services/appCheck.js` (monitor mode, only with a site key), `utils/stepUp.js`, `StepUpSheet` (Confirm it's you: passkey or sign in again), `PasskeysCard` in Settings → Security (shown only when `circlesEnabled` is on for that user) |

Review: tested on the preview (tester flag, passkey add and remove, a non-tester sees no card). Following review, removing a passkey now needs a second click ("Yes, remove" / "Keep it"; the row turns red). The old circles-0-5 preview address is confirmed blocked on the API key.

Tests: Jest 67 suites / 1,597 tests, 85.8% lines; functions unit 27/27; functions emulator 20/20 (incl. concurrent idempotency, token replay, wrong user, wrong action, expiry, the real SimpleWebAuthn rejecting a forged response); rules 48/48 (31 existing + 3 default additions + 14 circles). The circles rules are tested on the emulator's default database because the test library cannot address a named one; the rules never refer to the database name. Lint clean on new files (the Settings test files had the same 18 lint errors on master). Build compiles (+10.2 kB gzip). New dependencies: `zod` 4.6.7, `@simplewebauthn/server` 14.0.3 (functions), `@simplewebauthn/browser` 14.0.0 (app); no new audit findings.

## 15. Maintaining this document

- Add a dated entry to §14 for every working session, and keep §12 (deployment state) accurate.
- When a feature changes, update §6, the data model (§5) if fields change, and **the assistant guide in `functions/assistantPrompt.js`**, since the assistant only knows what that file says.
- When rules change, update §9, add or adjust tests in `firestore-tests/rules.test.js`, and run `npm run test:rules` before deploying.
