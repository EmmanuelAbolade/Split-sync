# SplitSync Circles: Project Brief for Claude Code

**File:** `docs/circles/CIRCLES_BRIEF.md`
**Owner:** Emmanuel Abolade
**Status:** Approved direction, not yet built
**Live app:** splitsync-dev.web.app (must stay working throughout)

Read this whole file before doing anything. It is the source of truth for the SplitSync Circles extension. If anything here conflicts with what you find in the codebase, stop and ask. Do not guess. (There could have been some recent updates in the current working project that i missed - go from there and ignore stale and old information where necessary)

---

## 1. What we are building

SplitSync is a live, working React 18 + Firebase PWA for group expense splitting. It has 1,397 passing tests across 52 suites and over 84% line coverage.

We are extending it into a **financial coordination app** with five "spaces":

| Space | What it does | Where data lives |
|---|---|---|
| **(Shared) Expenses** | Everything SplitSync does today (groups, splits, OCR, settle up, analytics) | Default Firestore DB (unchanged) |
| **(Budget) Events** | Event groups with budget by category, pledges, treasurer approval of spending | Default Firestore DB |
| **(Saving) Circles** | ROSCA / ajo / susu: fixed contributions, payout rotation, slot swaps | Named Firestore DB `circles` |
| **(Free) Loans** | Interest-free person-to-person loans with repayment schedules | Named Firestore DB `circles` |
| **(Support) Aid** | Mutual aid requests shared to a group, admin-verified, pledges paid directly | Named Firestore DB `circles` |

Plus two cross-cutting features:

- **Refunds**: reversing ledger entries linked to the original expense. These are never deletions. Default DB.
- **Trust and request privacy**: a reliability score, and user control over who can send them loan or aid requests.

**Out of scope (do not build):** escrow, holding money, pooled savings groups, lending from a pool, and interest of any kind. These need a licensed partner (for example Stripe Connect or Mangopay) and PSD2 / e-money compliance (far-future set-up). Show them only as locked "Coming later" cards. SplitSync never holds money. Members pay each other directly through the existing PayPal, Revolut and SEPA routes, and SplitSync records it.

---

## 2. Non-negotiable rules

1. **Do not break the live app.** Every existing feature must keep working: auth, WebAuthn passkeys, session timeout, groups, all split methods, OCR, AI assistant, PayPal server-side capture, Revolut, SEPA, archive/soft delete, pending payment locks, analytics, notifications, invitations, offline/PWA, dark mode, profile, settings. Some features are not visible in the mockups. **Never remove or rewrite an existing feature unless I approve it first.**
2. **Money never mixes between spaces.**
   - Every ledger entry carries a `spaceId` and a `currency`.
   - Balances are calculated per space and per currency. There is no conversion and no combined total, matching how the app already handles currencies.
   - The minimum cash flow settlement algorithm runs within one space and one group only.
   - A payment in one space can never settle a debt in another.
3. **Same login everywhere.** Firebase Auth is shared. The `circles` DB references users by `uid` only. User profiles stay in the existing `users` collection. Do not duplicate them.
4. **Request privacy.** Sharing a group with someone lets you split bills with them. It does not let them ask you for money. Users choose who can send loan requests, aid requests and messages (nobody, trusted people only, members of shared circles, or anyone in their groups). Requests outside those rules are held in an inbox for review, and the sender is not told.
5. **All money-affecting writes happen in Cloud Functions,** never directly from the client. Clients read; Functions write ledger entries.
6. **Everything is behind a feature flag** (`circlesEnabled`, plus one flag per space) so it can ship dark and be switched off instantly.

---

## 3. Phase 0: Research and Design documentation (do this FIRST, write no app code)

Produce these documents in `docs/circles/` as Markdown, with diagrams in **Mermaid**. Use an academic, formal register. Then stop and wait for my review.

1. `00-codebase-audit.md`: **Read the actual code first.** List every existing feature, route, component, Zustand store, Cloud Function, Firestore collection and security rule, with file paths. Record the current test count and coverage. This is the baseline we must not regress.
2. `01-business-case.md`: Problem statement; the informal savings and mutual aid market (ROSCA usage among diaspora communities in Ireland and Europe); competitor analysis (Splitwise, Tricount, Settle Up, digital ROSCA apps); value proposition; risks; and the regulatory position (coordination versus custody, PSD2, Central Bank of Ireland, GDPR).
3. `02-requirements.md`: Functional requirements per space (numbered, for example FR-CIR-01) and non-functional requirements (security, performance, availability, accessibility to WCAG 2.2 AA, privacy, maintainability, scalability), each with acceptance criteria.
4. `03-frameworks-and-methodology.md`: Development methodology (Agile / Scrum-style increments), the security frameworks used (OWASP ASVS 4.0, OWASP Top 10, STRIDE), and design frameworks (Nielsen's heuristics, Material-style patterns).
5. `04-system-architecture.md`: Component diagram covering the default DB and the named `circles` DB, the Cloud Functions boundary, Auth, Hosting, external payment providers and AI. Include data flow, the trust boundaries, and a deployment diagram.
6. `05-sitemap-and-navigation.md`: The new navigation. Home becomes a hub of spaces. The current Home content becomes the Expenses space. The bottom nav keeps Home, Activity, +, Stats and You.
7. `06-ux-ui-design.md`: Design system tokens (reuse the existing Tailwind theme, light and dark), screen-by-screen descriptions referencing the mockups, the context-aware + action sheet, scrollable modals, empty states, error states and accessibility.
8. `07-use-cases.md`: Actors (member, organiser, treasurer, borrower, lender, aid requester, group admin, system scheduler), a use case diagram, and fully dressed use cases for the main flows.
9. `08-user-stories.md`: User stories with acceptance criteria (Given / When / Then), grouped into epics, with MoSCoW priority.
10. `09-sequence-diagrams.md`: System sequence diagrams for paying a circle contribution, slot swap, loan request (including the held-request path), loan repayment, aid request with admin verification, pledging, refund request and acceptance, and event spend approval.
11. `10-database-design.md`: Collections, document schemas, field types, indexes, the ledger entry model (append-only, with reversing entries), an ERD, and Firestore security rules for both databases.
12. `11-payments.md`: How the existing PayPal (server-side capture), Revolut deep link and SEPA flows are reused per space; idempotency keys; pending payment locks; reconciliation; and why escrow is excluded.
13. `12-security-and-threat-model.md`: A STRIDE threat model per space, OWASP Top 10 mapping, abuse cases (fake aid requests, loan request spam, a member who collects early then stops paying, slot manipulation), and the mitigations listed in section 5 below.
14. `13-test-strategy.md`: Unit, integration, Firestore rules tests (emulator), Cloud Function tests, end-to-end tests, the regression plan for existing features, and coverage targets.
15. `14-implementation-plan.md`: The phased build plan (section 6 below), with files to create or change for each phase.
16. `references.md`: A full **Harvard-style** reference list, with in-text citations (Author, Year) used throughout all documents.

**Referencing rule:** Only cite sources you can actually verify. Prefer official docs (Firebase, OWASP, NIST, EU and Central Bank of Ireland publications), peer-reviewed papers, and established books. **Never invent a reference, author, year, DOI or URL.** If you are unsure a source exists, leave it out or mark it `[VERIFY]` so I can check it.

When Phase 0 is done, summarise the documents and **wait for my approval before writing any code.**

---

## 4. Reference mockups

Two HTML mockups are in `docs/circles/mockups/`:

- `splitsync-hub.html`: **the approved direction.** Hub home of spaces, "Needs attention" list, per-space screens, Activity and Stats filtered by space, the You page with balances by space and "Who can ask me", the held-requests inbox, and Customise Home.
- `splitsync-circles.html`: an earlier exploration. Use it for feature detail inside each space (rotation timeline, loan schedule, aid pledge, refund review, event budget). Ignore its sidebar layout.

The mockups show **intent and flows, not pixel-perfect design.** Build with the existing React components, Tailwind theme, Lucide icons and patterns already in the codebase. The mockups only show what fitted on screen; the real app has more features, and all of them must stay.

---

## 5. Security requirements (apply to every phase)

- **Firestore security rules** for both databases. Default deny. Members can read only the spaces and groups they belong to. Clients cannot write to ledger collections at all; only Cloud Functions (Admin SDK) can.
- **Rules tests** with the Firebase Emulator and `@firebase/rules-unit-testing` for every rule, including negative cases (another user, a non-member, an unauthenticated user, a tampered field).
- **Firebase App Check** on Functions and Firestore to block scripted abuse.
- **Server-side validation** of every Function input with a schema (for example Zod). Validate on the client too, for UX only.
- **Authorisation in every Function:** check `context.auth`, membership and role (organiser, treasurer, admin) from server data, never from the request.
- **Step-up authentication:** a fresh WebAuthn passkey check before paying, lending, accepting loan terms, approving spends or accepting refunds.
- **Idempotency keys** on every money action, plus the existing pending payment locks, to stop double payments.
- **Rate limiting** on request-creating Functions (loan requests, aid requests, refunds, invites).
- **Append-only ledger.** No updates or deletes on ledger entries; corrections are reversing entries. Every privileged action writes to an audit log.
- **Privacy and GDPR.** Aid reasons are private and visible to the admin only (they may be health-related). Data minimisation. Trust scores are visible only to members of shared circles. Support export and erasure.
- **Secrets** stay in Firebase / Google Secret Manager. Never commit them, log them or send them to the client.
- **No sensitive data in logs or URLs** (amounts tied to names, IBANs, tokens).
- **Dependencies.** Run `npm audit` and report the results, but **never run `npm audit fix --force`.** Pin versions.
- **Security headers / CSP.** Be careful: a previous CSP change in `firebase.json` broke the app. Propose any header change separately, test it on a preview channel, and bump the service worker cache version on deploy.
- **XSS and injection.** Rely on React escaping. Never use `dangerouslySetInnerHTML` with user content. Sanitise anything rendered from user input.

---

## 6. Build phases (after Phase 0 is approved)

Each phase follows this loop: branch, build, test, preview, review, merge, deploy.

| Phase | Scope |
|---|---|
| 1 | Foundations: feature flags, `spaceId` on ledger entries (with a backwards-compatible migration so existing expenses map to `expenses`), the named `circles` DB, rules and rules tests, the shared ledger Function helpers |
| 2 | Hub Home and navigation: Home becomes the spaces hub; the current Home content moves, unchanged, into the Expenses space; Customise Home; Activity and Stats filters by space |
| 3 | Refunds and Events (default DB) |
| 4 | Circles: create circle, invite, rotation (random draw with stored seed, agreed order), contributions, swaps, scheduler reminders |
| 5 | Request privacy, trusted people, held-requests inbox |
| 6 | Loans (P2P, interest-free) |
| 7 | Aid (group-shared, admin-verified, private reason) |
| 8 | Trust score and per-space analytics |
| 9 | Security hardening review, accessibility audit, documentation update |

**For every phase:**

1. Work on a branch: `feature/circles-<phase>`.
2. Read the relevant files before editing them. Never edit from memory of an older version.
3. For small edits, show the change with the lines above and below it. For large files, give a complete replacement.
4. Add file title comments and clear code comments. Use Doxygen-style comments for functions. No emojis anywhere in code or UI; use Lucide icons.
5. Every new component supports light and dark mode. Modals scroll inside themselves.
6. Write tests for the new code. Run the **full** test suite and report the counts. The existing 1,397 tests must still pass. Coverage must not drop below 84%.
7. Run the Firestore rules tests in the emulator.
8. Deploy to a Firebase **preview channel** (`firebase hosting:channel:deploy circles-<phase>`) and give me the link to check.
9. After my approval: merge, commit with a conventional commit message (for example `feat(circles): add rotation scheduler`), push to GitHub, and deploy (`firebase deploy --only functions,hosting`, plus `firestore:rules` and `firestore:indexes` when they change). Bump the service worker cache version when needed.
10. Keep the feature flag off in production until I say to switch it on.
11. List any unused or dead code you noticed, and remind me to clean it up. Do not delete anything without my approval.

---

## 7. How to work with me

- Plan first. I approve the design before implementation.
- I read every diff before approving it.
- Give clear, step-by-step instructions.
- Accuracy over polish. If something is uncertain, say so.
- If a change could affect the live app, warn me before running it.
- Never run destructive commands (deleting data, force pushes, `--force` installs) without asking.
- I love animations and stunning UI UX effects. 
- Instructions i give in claude code overrides the ones i have given here in some cases.
