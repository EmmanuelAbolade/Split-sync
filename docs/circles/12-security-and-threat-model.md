# 12. Security and Threat Model

| | |
|---|---|
| **Document** | `docs/circles/12-security-and-threat-model.md` |
| **Phase** | 0 (Research and Design) |
| **Method** | STRIDE per element and per space (Kohnfelder and Garg, 1999; Shostack, 2014), mapped to the OWASP Top 10 2021 (OWASP Foundation, 2021) and the OWASP ASVS 4.0 Level 2 (OWASP Foundation, 2019), plus abuse cases |
| **System model** | `04-system-architecture.md` §4 (data-flow diagram and trust boundaries) |

---

## 1. Assets

| Asset | Why it matters |
|---|---|
| Ledger integrity in every space | Members rely on it to know who owes whom |
| Payment details (PayPal and Revolut usernames, IBAN) | Fraud and social engineering |
| Aid reasons | Often special-category data (health, bereavement); GDPR Article 9 |
| Request-privacy state (held or blocked) | Revealing it harms relationships and safety |
| Trust scores | Reputational harm if wrong or exposed |
| Step-up credentials and tokens | Gatekeepers for money actions |
| Availability of the live Expenses product | Existing users depend on it |

## 2. STRIDE per space

Controls are cross-referenced to section 6. "Pipeline" means the server pipeline in `04-system-architecture.md` §4.1.

### 2.1 Cross-cutting: client ↔ Functions ↔ databases

| Threat | Example | Mitigation |
|---|---|---|
| **S**poofing | A script calls Functions with a stolen ID token | Firebase Auth token verification; App Check (C-03); step-up for money actions (C-06) |
| **T**ampering | A client edits a ledger document or a read model | Rules deny all client writes to ledgers and read models (C-01); append-only (C-08) |
| **R**epudiation | "I never approved that spend" | An audit log with actor, action, target, request ID and time (C-09); step-up evidence recorded |
| **I**nformation disclosure | Broad queries over another user's data | Membership-scoped rules; no list access without a membership filter (C-01); rules tests (C-15) |
| **D**enial of service | Floods of requests or invites | Rate limits (C-07); App Check; Function concurrency limits |
| **E**levation of privilege | A request claims `role: 'treasurer'` | Roles are read only from server documents (C-05) |

### 2.2 Events

| Threat | Mitigation |
|---|---|
| S: a member impersonates a treasurer to approve | Roles from `events/{id}.treasurerUids`; step-up |
| T: a treasurer approves their own request | Server check `decider != requester` (FR-EVT-05) |
| R: disputed approvals | Audit log; `decidedBy` and `decidedAt` on the request |
| I: non-members read the budget | Member-only rules |
| E: the organiser changes roles silently | Role changes are audit-logged and notified to all members |

### 2.3 Refunds

| Threat | Mitigation |
|---|---|
| T: a refund exceeding the original amount | Server check against the refundable remainder in a transaction |
| T: the original expense is edited to hide history | Reversal entries only; the original is immutable once refunded |
| E: a non-payer accepts a refund | Only the payer or the group owner; step-up |
| R: "I didn't accept that refund" | Audit log and step-up record |

### 2.4 Circles

| Threat | Mitigation |
|---|---|
| T: the organiser manipulates the random order | Commit-reveal: `seedHash` is stored at creation and the seed revealed at start; the order is computed by deterministic Fisher–Yates over uid-sorted members (Knuth, 1997); any member can verify it (FR-CIR-03) |
| T: the order is changed after the start | `order` is writable only through the swap Function, with mutual consent and an audit record |
| S: a claim is made on someone else's behalf | `fromUid` = caller is enforced on the server |
| R: "I paid" against "I never received it" | Two-party claim and confirmation; dispute state (`11-payments.md` §6) |
| I: outsiders see circle membership or amounts | Member-only rules; invite previews show name and size only |
| D: reminder spam | One reminder per obligation per day |

### 2.5 Loans

| Threat | Mitigation |
|---|---|
| I: the borrower infers that the request was held | No delivery field in any borrower-readable document; identical responses (`10-database-design.md` §3) |
| S/E: terms altered after acceptance | `termsHash` frozen at acceptance; changes only by mutual reschedule |
| T: interest smuggled into the terms | No interest field; the server asserts `interestMinor == 0` and that the schedule sums to the principal |
| D: request spam or harassment | Privacy settings, held inbox, block list, rate limits (C-07) |

### 2.6 Aid

| Threat | Mitigation |
|---|---|
| I: the private reason is exposed to members or admins of other groups | A separate `aidPrivate` document readable by `[requester, admin]` only; never sent to the AI assistant; deleted 90 days after closure |
| S: a fake request | Administrator verification before visibility; one active request per requester per group; rate limits |
| T: the admin verifies their own request | Server check `admin != requester` |
| I: an anonymous giver is revealed | Pledge documents readable by the giver and requester only; members see aggregates |

### 2.7 Request privacy and trust

| Threat | Mitigation |
|---|---|
| I: trust scores scraped by non-members | Owner-only rule. Other members read through `trust.get`, which checks for a shared circle. |
| T: score manipulation through self-dealing (two accounts lending to each other) | The score uses only confirmed obligations with counterparties, and its weight is capped by the number of distinct counterparties (the exact weighting is finalised in Phase 8); the score never authorises anything (FR-TRU-03) |
| E: the score used as a credit gate | Prohibited by design (FR-LON-06, FR-TRU-03) |

## 3. OWASP Top 10 (2021) mapping

| Category | Risk in SplitSync Circles | Control |
|---|---|---|
| A01 Broken Access Control | Direct client database access; cross-container reads | Default-deny rules for both databases; membership-scoped reads; Function-only writes; negative rules tests (C-01, C-15) |
| A02 Cryptographic Failures | IBAN exposure; weak draw randomness | AES-256-GCM server-side IBAN encryption (existing); `crypto.randomBytes` seeds; TLS (platform) |
| A03 Injection | User text rendered in UI or exports | React escaping; no `dangerouslySetInnerHTML`; escape user fields in the existing print export (`document.write`, audit §10.3) before extending exports |
| A04 Insecure Design | Custody creep; non-verifiable step-up | Coordination-only design (`11-payments.md`); server-verified step-up (decision D2) |
| A05 Security Misconfiguration | A rules gap in the new database; a CSP that breaks the app | A separate rules file with tests; headers proposed separately and tested on a preview channel (Brief §5) |
| A06 Vulnerable and Outdated Components | 72 root and 38 functions advisories (audit §11.3) | `npm audit` each phase; non-breaking upgrades; pinned versions; never `--force` |
| A07 Identification and Authentication Failures | Session reuse on a shared device | Session timeout (existing); step-up per money action |
| A08 Software and Data Integrity Failures | Tampered read models | Server-only writes; daily ledger-to-read-model integrity check (`11-payments.md` §6) |
| A09 Security Logging and Monitoring Failures | No record of privileged actions today | `auditLog` in both databases; Function error logging without personal data |
| A10 Server-Side Request Forgery | Functions fetching user-supplied URLs | Functions call only fixed hosts (PayPal, Anthropic, Vision); receipt URLs are validated to the Cloudinary domain |

## 4. ASVS 4.0 Level 2 mapping (selected requirements)

| ASVS chapter | Requirement focus | Design response |
|---|---|---|
| V1 Architecture | Trust boundaries are documented; access control is enforced at a trusted service layer | `04-system-architecture.md` §4; Functions plus rules |
| V2 Authentication | Re-authentication before sensitive transactions; authenticator verification | Step-up with WebAuthn (W3C, 2021) or `auth_time`; aligned with re-authentication guidance (Grassi *et al.*, 2017) |
| V3 Session | Session timeout; tokens not in URLs | Existing timeout; tokens only in request bodies |
| V4 Access Control | Least privilege; deny by default; data-level authorisation | Default-deny rules; server-derived roles |
| V5 Validation | Server-side input validation with an allow-list | Zod schemas per Function |
| V7 Errors and Logging | Logs without sensitive data; security events logged | Audit log; redaction of amounts tied to names in logs |
| V8 Data Protection | Sensitive data minimised and protected; retention | `aidPrivate`; retention table (`10-database-design.md` §8) |
| V11 Business Logic | Anti-automation, sequential step enforcement, limits | Rate limits; state machines (claimed → confirmed); idempotency |
| V13 API | Authenticated APIs; schema validation | Callable Functions with auth and schemas |
| V14 Configuration | Dependencies kept up to date; security headers | Phase-wise audit; header proposal in Phase 9 |

## 5. Abuse cases

| ID | Abuse case | Mitigations | Residual risk |
|---|---|---|---|
| AB-01 | **Fake aid request.** A member invents a hardship to collect pledges. | Group-scoped only; administrator verification before visibility; the admin sees the private reason; one active request per person per group; rate limit; anyone can report it to the admin; Taskmaster moderation | An admin can be deceived. Pledges are paid directly, so SplitSync cannot claw them back. Users are told this in the Aid information sheet. |
| AB-02 | **Loan request spam or pressure.** | Restrictive privacy defaults; held inbox; silent block; rate limits; no read receipts on held requests | Pressure can continue through channels outside SplitSync |
| AB-03 | **Collect early, then stop paying (circle default).** | Verifiable order (no rigging); optional guarantor for early slots of members with no history (FR-CIR-08); visible payment status; reminders; overdue marking; trust history visible to future circles; the organiser may exclude the member from future circles; a plain-language warning before joining | **Cannot be prevented without custody.** This is stated in FR-CIR-10, and is the reason escrow is a "Coming later" partner feature. |
| AB-04 | **Slot manipulation.** The organiser re-rolls or re-orders after seeing the draw. | Commit-reveal seed; the order is locked at start; swaps only by mutual consent and audit-logged; "Verify draw" | None material |
| AB-05 | **False confirmation claims.** The payer claims to have paid; the payee is pressured to confirm. | Only the payee can confirm; no auto-confirm in any new space; disputes are recorded | Social pressure |
| AB-06 | **Self-dealing to inflate trust.** | Distinct-counterparty weighting; score not used for authorisation; visible inputs | Some inflation remains possible; the score is informational only |
| AB-07 | **Admin snooping.** A platform admin reads aid reasons or privacy state. | `aidPrivate`, `requests` and `privacy` deny admins; audit log on admin actions | A Firebase project owner can always read data through the console. This is an organisational control, covered in a documented operating policy. |
| AB-08 | **Replayed money action.** | Idempotency key; single-use step-up token bound to the action hash; pending lock | None material |
| AB-09 | **Cross-space settlement attempt.** A circle payment is used to clear an expense debt. | Claims name one container; currency and container checks; no cross-container operation exists | None |

## 6. Control catalogue (Brief §5 requirements)

| ID | Control | Phase | Verification |
|---|---|---|---|
| C-01 | Default-deny rules for both databases; members read only their own spaces and containers; no client writes to ledgers | 1, then each phase | Rules tests (positive and negative) |
| C-02 | The `circles` database isolated with its own rules file | 1 | Rules tests against the named-database emulator |
| C-03 | App Check on Functions and Firestore (monitor, then enforce) | 1 (monitor), 9 (enforce) | Console metrics; tests with App Check enforcement in the emulator |
| C-04 | Zod schema validation of every Function input | 1 | Unit tests with malformed inputs |
| C-05 | Authorisation from server data in every Function | 1 | Tests with forged role or membership claims |
| C-06 | Server-verified step-up (WebAuthn, or `auth_time` fallback) before pay, lend, accept terms, approve spend, accept refund | 1 | Function tests (valid, expired, reused, wrong action) |
| C-07 | Rate limiting on request-creating Functions | 1 | Function tests |
| C-08 | Append-only ledger; reversing entries | 1, then per space | Rules tests (no update or delete); Function tests |
| C-09 | Audit log of privileged actions | 1 | Function tests assert an audit record per action |
| C-10 | Idempotency keys plus pending locks | 1 | Function tests (duplicate key, concurrent claims) |
| C-11 | GDPR: private aid reasons, minimisation, trust visibility, export and erasure | 7, 8, 9 | Rules tests; erasure tests |
| C-12 | Secrets in Secret Manager only; none in logs or URLs | All | Bundle scan; log review |
| C-13 | `npm audit` reported each phase; no `--force`; pinned versions | All | Phase report |
| C-14 | Security headers and CSP proposed separately; tested on a preview channel; service worker cache bumped on deploy | 9 | Preview-channel test of every route |
| C-15 | XSS: React escaping; no `dangerouslySetInnerHTML` with user content; escape the print export | All | Code review; lint rule |

## 7. Residual risks accepted for this release

1. Default by circle members after an early payout (AB-03), mitigated but not prevented.
2. Project-owner access to all data (AB-07), managed by organisational policy.
3. Provider-side fraud outside SplitSync (for example a fake PayPal.me username). This is mitigated by showing usernames only to co-members and through payee confirmation.
4. Until Phase 10, ordinary Expenses writes remain client-side under rules (decision D1). The current rules and 31 rules tests protect them.
