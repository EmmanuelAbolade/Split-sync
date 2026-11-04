# 02. Requirements Specification

| | |
|---|---|
| **Document** | `docs/circles/02-requirements.md` |
| **Phase** | 0 (Research and Design) |
| **Depends on** | `00-codebase-audit.md`, `01-business-case.md` |
| **Conventions** | **Shall** = mandatory. **Should** = expected unless justified. Priority uses MoSCoW (Clegg and Barker, 1994): **M**ust, **S**hould, **C**ould, **W**on't (this release). Quality characteristics follow ISO/IEC 25010 (ISO/IEC, 2011). |

Requirement identifiers are stable and are referenced by the use cases (`07`), user stories (`08`), sequence diagrams (`09`), database design (`10`) and test strategy (`13`).

---

## 1. Scope and spaces

| Space | Identifier prefix | Database | Phase |
|---|---|---|---|
| Cross-cutting foundations | `FR-CORE` | Both | 1 |
| Settlement migration (Expenses) | `FR-SET` | Default | 1B |
| Hub and navigation | `FR-HUB` | Both (read) | 2 |
| Refunds | `FR-REF` | Default | 3 |
| Events | `FR-EVT` | Default | 3 |
| Circles (ROSCA) | `FR-CIR` | `circles` | 4 |
| Request privacy and trusted people | `FR-PRV` | `circles` | 5 |
| Loans | `FR-LON` | `circles` | 6 |
| Aid | `FR-AID` | `circles` | 7 |
| Trust score and per-space analytics | `FR-TRU` | `circles` (+ default, read) | 8 |
| Data rights | `FR-DAT` | Both | 1 and 9 |

**Preservation requirement (applies to all):** every feature listed in `00-codebase-audit.md` §14 shall continue to work, and the 1,487 baseline tests shall continue to pass (Brief §2, rule 1).

---

## 2. Functional requirements

### 2.1 Cross-cutting foundations (`FR-CORE`)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-CORE-01 | The system shall provide feature flags `circlesEnabled` and one flag per space (`eventsEnabled`, `refundsEnabled`, `circlesSpaceEnabled`, `loansEnabled`, `aidEnabled`, `trustEnabled`). | M | With a flag off, the space is hidden in the UI **and** every Function belonging to it rejects calls with `failed-precondition`. Flags can be changed without a redeploy. |
| FR-CORE-02 | Every new ledger entry shall carry `spaceId` and `currency`. | M | Writing an entry without either field fails validation. Existing `expenses` documents without `spaceId` are treated as `spaceId = 'expenses'` at read time, without rewriting data. |
| FR-CORE-03 | Balances shall be computed per space, per container (group, circle, loan, event) and per currency. | M | No API or view returns a figure that sums across spaces or currencies. Tests demonstrate that a payment in one space leaves balances in every other space unchanged. |
| FR-CORE-04 | Settlement suggestions shall be computed within one space and one container only. | M | `calculateSettlements` is never given entries from more than one container. |
| FR-CORE-05 | All money-affecting writes in new spaces shall be performed by Cloud Functions. | M | The Firestore rules deny client writes to every ledger collection. Rules tests prove the denial for members, non-members and admins. |
| FR-CORE-06 | Ledger entries shall be append-only. Corrections are reversing entries linked to the original. | M | The rules and Functions never update or delete a posted entry. A reversal references `reversesEntryId`. |
| FR-CORE-07 | Every money action shall accept an idempotency key. | M | Repeating a call with the same key returns the original result and creates no second entry. |
| FR-CORE-08 | Money actions (pay, lend, accept loan terms, approve spend, accept refund) shall require server-verified step-up authentication (decision D2). | M | The Function rejects the action unless it is given a valid, unexpired, single-use step-up token issued after a verified WebAuthn assertion or a re-authentication less than 5 minutes old. |
| FR-CORE-09 | Every privileged action shall write an audit-log record. | M | Approvals, verifications, role changes, reversals and admin actions each produce an `auditLog` record with actor, action, target, time and request identifier. |
| FR-CORE-10 | Request-creating Functions shall be rate-limited per user. | M | Exceeding the limit returns `resource-exhausted`. Limits are configurable. |
| FR-CORE-11 | Function inputs shall be validated against a schema on the server. | M | Malformed input returns `invalid-argument` before any read or write. |
| FR-CORE-12 | App Check shall protect Functions and Firestore, in monitoring mode first and enforced later. | S | Metrics show verified-request rates before enforcement is switched on. |

### 2.2 Settlement migration, Expenses space (`FR-SET`)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-SET-01 | Recording a settlement ("Mark as paid", PayPal capture, SEPA demo) shall be performed by a Cloud Function. | M | Clients can no longer create `isSettlement` entries directly; the rules deny it. |
| FR-SET-02 | Only the debtor may claim a payment, and only the creditor may confirm it. | M | A member claiming that another member paid is rejected. |
| FR-SET-03 | The existing confirm/decline flow, pending-payment lock, My Payment Activity and notifications shall behave as today. | M | The SettleUpModal, GroupDetails and notificationsStore suites pass, adapted only for the new call path. |

### 2.3 Hub and navigation (`FR-HUB`)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-HUB-01 | Home shall become a hub listing the enabled spaces as tiles, each showing that space's own summary. | M | No tile or header shows a combined money total. |
| FR-HUB-02 | The current Home content shall move unchanged into the Expenses space. | M | Every Dashboard feature listed in `00-codebase-audit.md` §7 works at the new route, and the Dashboard suite passes. |
| FR-HUB-03 | A "Needs attention" list shall gather tasks (not money totals) from all spaces. | M | Each item names its space and opens the relevant screen. |
| FR-HUB-04 | Users shall be able to hide or show spaces on Home ("Customise Home"). Expenses is always shown. | S | Hiding a space never deletes data. The setting persists across devices. |
| FR-HUB-05 | The centre "+" button shall open a context-aware action sheet listing the current space's actions first. | M | Outside any space, all enabled spaces' actions are listed. |
| FR-HUB-06 | Activity shall be filterable by space. "All" lists items in time order, labelled by space and never totalled across spaces. | M | The existing Active/Archived and role filters keep working within Expenses. |
| FR-HUB-07 | Stats shall show one tab per enabled space, each reading only its own space. | M | The existing Analytics content appears unchanged as the Expenses tab. |
| FR-HUB-08 | The You page shall show balances by space and per currency, and a "Who can ask me" summary. | M | No combined total. |
| FR-HUB-09 | The bottom navigation shall keep Home, Activity, +, Stats and You. | M | `BottomNav` tests pass with updated routes. |
| FR-HUB-10 | Invite links opened while signed out shall resume after sign-in (Phase 0.5 fix). | M | A signed-out visitor to `/invite/:id` reaches the join screen after signing in. |

### 2.4 Refunds (`FR-REF`)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-REF-01 | A group member shall be able to request a full or partial refund of an expense, giving an amount and a reason. | M | Amount > 0 and ≤ the original amount minus refunds already accepted. A reason is required. |
| FR-REF-02 | Only the original payer, or the group owner, shall be able to accept or reject a refund. | M | Others receive `permission-denied`. |
| FR-REF-03 | Acceptance shall post a reversing entry linked to the original expense. The original is never edited or deleted. | M | Balances reflect the reversal; the history shows both entries. |
| FR-REF-04 | Accepting a refund shall require step-up authentication. | M | As FR-CORE-08. |
| FR-REF-05 | The system could flag likely duplicates to the reviewer (for example the same amount and title within a short time). | C | The hint is advisory and never automatic. |

### 2.5 Events (`FR-EVT`)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-EVT-01 | An organiser shall be able to create an event with a currency, a total budget and budget categories. | M | Category budgets sum to no more than the total budget. |
| FR-EVT-02 | The organiser shall assign one or more treasurers. | M | Roles are stored on the server, and changes are audit-logged. |
| FR-EVT-03 | Members shall record pledges (amounts they commit to contribute) and mark them paid directly to the treasurer or organiser. | M | Pledge status: `pledged`, `paid-claimed`, `confirmed`. |
| FR-EVT-04 | Members shall submit spend requests (item, category, amount, optional receipt) for treasurer approval. | M | Spending is recorded against a category only after approval. |
| FR-EVT-05 | A treasurer shall approve or reject spend requests. Approval requires step-up. | M | The requester is notified of the decision. A treasurer cannot approve their own request. |
| FR-EVT-06 | The event shall show budget against actual spending per category, and pledged against received. | M | Figures are in the event's currency only. |

### 2.6 Circles (`FR-CIR`)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-CIR-01 | A user shall be able to create a circle with a name, currency, contribution amount, frequency (weekly, fortnightly or monthly), member count (3 to 20) and start date. | M | Values outside these bounds are rejected on the client and the server. |
| FR-CIR-02 | Membership shall be by invitation only. | M | Only invited users can join; the circle locks when full or when it starts. |
| FR-CIR-03 | The payout order shall be set by a verifiable random draw or by an agreed order. | M | Random: the server commits to a seed hash at creation and reveals the seed when the circle starts; anyone can recompute the order. Agreed: every member accepts the proposed order before the start. |
| FR-CIR-04 | Each cycle, every member except the recipient shall pay the contribution directly to the recipient and claim the payment. The recipient confirms it. | M | A cycle completes when all contributions are confirmed. |
| FR-CIR-05 | Paying a contribution shall require step-up and an idempotency key, and shall respect a pending lock per (circle, cycle, payer). | M | No duplicate claims. |
| FR-CIR-06 | Two members shall be able to swap future slots by mutual agreement. | S | Only slots not yet paid out can be swapped. Both accept. The swap is audit-logged. |
| FR-CIR-07 | A scheduler shall send reminders before due dates and mark overdue contributions. | M | Reminders use in-app notifications and are not repeated more than once a day. |
| FR-CIR-08 | The organiser could require a guarantor (an existing member) for new members taking early slots. | C | The guarantor is named on the record. SplitSync enforces nothing financially. |
| FR-CIR-09 | Members shall see the rotation timeline, the current recipient, who has paid, and their own payout slot. | M | Matches the mockup intent. |
| FR-CIR-10 | Before joining, members shall acknowledge that payments go directly between members and that SplitSync does not hold or guarantee funds. | M | The acknowledgement is recorded with a timestamp. |
| FR-CIR-11 | Ordering by trust score shall not be offered in this release. | W | It is excluded on fairness grounds (see `12-security-and-threat-model.md`). |

### 2.7 Request privacy and trusted people (`FR-PRV`)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-PRV-01 | Users shall set who may send them loan requests, aid requests and direct messages: nobody, trusted people only, members of shared circles, or anyone in their groups. | M | The default is "trusted people only" (privacy by default). |
| FR-PRV-02 | Requests that fall outside a user's settings shall be held in a review inbox. The sender is not told. | M | The sender's response is identical whether the request was delivered or held. |
| FR-PRV-03 | Users shall manage a trusted-people list and a blocked list. | M | Requests from blocked users are silently discarded. |
| FR-PRV-04 | From the inbox, users shall be able to decline, block, or trust and view a held request. | M | Each action is reflected immediately. |

### 2.8 Loans (`FR-LON`)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-LON-01 | A user shall be able to request an interest-free loan from a specific person, giving an amount, a repayment plan (number of instalments and frequency) and a short purpose. | M | The request passes the recipient's privacy rules (FR-PRV-02) and rate limits. |
| FR-LON-02 | The lender shall accept or decline. Acceptance by both parties of the generated schedule requires step-up. | M | Terms are immutable once both parties accept. Interest is always zero. |
| FR-LON-03 | Disbursement and each repayment shall be claimed by the payer and confirmed by the payee. | M | The outstanding amount updates only on confirmation. |
| FR-LON-04 | Either party could request a reschedule, which the other must accept. | S | The original schedule is retained in the history. |
| FR-LON-05 | The lender shall be able to send a friendly reminder, at most once per instalment per day. | S | Rate-limited. |
| FR-LON-06 | SplitSync shall not charge fees or interest or make lending decisions. | M | No interest field exists. No credit limit is enforced from the trust score. |

### 2.9 Aid (`FR-AID`)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-AID-01 | A member shall be able to create an aid request for a group or circle they belong to, with a title, target, end date and a private reason. | M | One active request per requester per group. |
| FR-AID-02 | Requests shall be visible to members only after an administrator of that group verifies them. | M | The administrator is the group owner or circle organiser; an administrator cannot verify their own request. |
| FR-AID-03 | The reason shall be visible to the verifying administrator only. | M | A rules test proves that members cannot read the reason document. |
| FR-AID-04 | Members shall pledge amounts, optionally anonymously, and pay the requester directly. The requester confirms receipt. | M | Anonymous pledges hide the name and amount from other members, but not from the requester. |
| FR-AID-05 | Progress shall show pledged and confirmed totals against the target, in the request's currency. | M | |
| FR-AID-06 | The requester or administrator shall be able to close a request early. | S | Closed requests accept no new pledges. |

### 2.10 Trust and analytics (`FR-TRU`)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-TRU-01 | The system shall compute a reliability score (0 to 100) from on-time circle contributions, on-time loan repayments, history length and upheld disputes. | S | The formula is published in the app. Users can see their own inputs. |
| FR-TRU-02 | Scores shall be visible only to members of circles the user shares. | M | Rules and Function tests prove that others cannot read them. |
| FR-TRU-03 | Scores shall never block or approve any action automatically. | M | No Function reads the score for authorisation. |
| FR-TRU-04 | Stats shall offer per-space analytics (FR-HUB-07). | S | |

### 2.11 Data rights (`FR-DAT`)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-DAT-01 | Users shall be able to export all their data from both databases. | S | A machine-readable JSON download. |
| FR-DAT-02 | Account deletion shall extend to the `circles` database. It is blocked while any obligation is open (unsettled contributions, outstanding loans, an open aid request). | M | Records other members depend on are retained, with the deleted user's name snapshot. |

---

## 3. Non-functional requirements

| ID | Characteristic | Requirement | Acceptance criteria |
|---|---|---|---|
| NFR-SEC-01 | Security | Default-deny Firestore rules for both databases; members read only their own spaces and containers. | Rules tests cover positive and negative cases for each collection: owner, member, non-member, unauthenticated, admin, tampered field. |
| NFR-SEC-02 | Security | Function authorisation is derived from server data, never from request fields. | Tests in which a request claims a role the user lacks are rejected. |
| NFR-SEC-03 | Security | Alignment with OWASP ASVS 4.0 Level 2 for authentication, session, access control, validation and logging. | A mapping table in `12-security-and-threat-model.md`; residual gaps tracked. |
| NFR-SEC-04 | Security | No secrets in client code, logs or URLs; no amounts tied to names in logs. | Bundle scan; log review. |
| NFR-SEC-05 | Security | Dependencies are audited each phase; `npm audit fix --force` is never run; versions are pinned. | An audit report in each phase review. |
| NFR-PRF-01 | Performance | Hub Home becomes interactive in under 2.5 s on a mid-range phone over a 4G connection, for users with up to 20 containers. | Lighthouse or RUM measurement on a preview channel. |
| NFR-PRF-02 | Performance | Money-action Functions respond in under 2 s at the 95th percentile (warm). | Function metrics. |
| NFR-AVL-01 | Availability | Disabling a space by flag takes effect within 60 s without a redeploy. | Manual test on a preview channel. |
| NFR-AVL-02 | Availability | Existing offline behaviour (service worker) is preserved; new spaces degrade to a clear "offline" state rather than failing silently. | Offline test. |
| NFR-ACC-01 | Accessibility | WCAG 2.2 Level AA (W3C, 2023) for all new screens. | Automated checks plus manual keyboard and screen-reader checks. |
| NFR-ACC-02 | Accessibility | Animations respect `prefers-reduced-motion`; colour is never the only carrier of meaning. | Review. |
| NFR-PRV-01 | Privacy | Data minimisation, private aid reasons, restrictive defaults (GDPR Articles 5, 9, 25). | Data-flow review in `10-database-design.md`. |
| NFR-MNT-01 | Maintainability | Doxygen-style comments on Functions and utilities; file title comments; no emojis in code or UI. | Code review. |
| NFR-MNT-02 | Maintainability | Line coverage ≥ 84 % overall and ≥ 90 % for ledger, step-up and rules code. | Coverage report each phase. |
| NFR-SCL-01 | Scalability | Queries are bounded and indexed; no client query scans a whole collection. | `firestore.indexes.json` reviewed each phase. |
| NFR-CMP-01 | Compatibility | Light and dark modes; current evergreen browsers; installed PWA on Android and iOS. | Manual matrix on a preview channel. |
| NFR-REG-01 | Regulatory | No feature receives, holds or transmits funds; no interest or fees. | Design review gate in each phase. |
