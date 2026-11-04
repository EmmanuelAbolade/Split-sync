# 13. Test Strategy

| | |
|---|---|
| **Document** | `docs/circles/13-test-strategy.md` |
| **Phase** | 0 (Research and Design) |
| **Depends on** | `00-codebase-audit.md` §11 and §14 (baseline and regression checklist), `02-requirements.md`, `12-security-and-threat-model.md` §6 |

---

## 1. Objectives

1. **Prevent regression.** The 1,487 baseline Jest tests, 11 Functions tests and 31 rules tests stay green throughout. Line coverage never drops below 84 %.
2. **Prove money separation.** Automated tests show that no operation changes a balance outside its own space, container and currency (FR-CORE-03).
3. **Prove access control.** Every rule has positive and negative tests (NFR-SEC-01).
4. **Prove the server pipeline.** For every money Function, tests cover authentication, the flag, validation, rate limit, authorisation, step-up, idempotency and audit.
5. **Verify each user story's acceptance criteria** (`08-user-stories.md`).

## 2. Test levels (test pyramid; Cohn, 2009)

| Level | Tool | Location | Scope |
|---|---|---|---|
| Unit (client) | Jest + React Testing Library (via `react-scripts test`) | `src/**/*.test.js(x)` | Components, hooks, pure utilities (balance and read-model computations, schedule generation, draw verification) |
| Unit (server) | Node built-in test runner (`node --test`) | `functions/**/*.test.js` | Pure server modules: schemas, the shuffle with seed, schedule rounding, idempotency hashing, step-up verification with fixed fixtures |
| Rules | `@firebase/rules-unit-testing` against the Firestore emulator | `firestore-tests/rules.test.js` (default) and `firestore-tests/circles.rules.test.js` (new) | Every collection in both databases |
| Function integration | Functions emulator + Firestore emulator (+ Auth emulator), `node --test` | `functions/test/integration/*.test.js` (new) | The full pipeline per callable, including transactions, idempotency and audit writes |
| End-to-end | Playwright against the emulator suite, plus a manual checklist on the preview channel | `e2e/` (new) | Critical journeys: sign in → hub → space → pay contribution → confirm; loan request held path; aid verify → pledge; refund accept |
| Accessibility | `jest-axe` on new components, plus manual keyboard and screen-reader checks | With component tests | WCAG 2.2 AA (NFR-ACC-01) |

## 3. Unit test focus areas

| Module | Must-have cases |
|---|---|
| `balanceCalculator` (extended) | A reversal of 100 % or a partial refund; reversals never affect another group; legacy documents without `spaceId` or `kind` behave exactly as today |
| Ledger read models (new, pure) | Circle cycle status from entries; loan outstanding; aid totals; event spend per category; **cross-space isolation**: given entries from several spaces and currencies, each projection returns only its own |
| Schedule generator | The sum equals the principal exactly; rounding remainder on the last instalment; 1 to 12 instalments; weekly, fortnightly and monthly dates |
| Draw | Deterministic order for a given seed; `sha256(seed) == seedHash`; the order is a permutation of the members |
| Flags hook | Off, on, and allow-listed behaviour; flag changes propagate without reload |
| Hub components | Tiles show per-space figures only; Needs attention ordering; Customise persistence |
| + action sheet | Context ordering; focus trap; Escape closes; flags hide actions |

## 4. Rules tests (both databases)

For **every** collection in `10-database-design.md`, the following matrix is tested:

| Actor | Read own or member | Read other | Query "mine" | Broad query | Client create | Client update | Client delete |
|---|---|---|---|---|---|---|---|
| Owner or party | ✓ allowed | ✗ | ✓ | ✗ | ✗ (ledger and read models) / ✓ (privacy, trusted, blocked) | as create | as create |
| Member | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Non-member | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Unauthenticated | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Platform admin | ✗ for `aidPrivate`, `requests`, `privacy`, `trust`; ✓ for `auditLog` | | | | ✗ | ✗ | ✗ |
| Tampered write (extra fields, wrong types, role injection) | | | | | ✗ | ✗ | ✗ |

**Specific cases:**

- A borrower cannot read their own request's `requests` item; held state is not observable.
- Members cannot read `aidPrivate`; admins of other groups cannot either.
- After Phase 1B, clients cannot create `isSettlement` expenses.
- After Phase 3, clients cannot create `kind: 'reversal'` expenses.
- Ledger entries cannot be updated or deleted by anyone.

The Windows emulator caveat applies: stop the leftover Java process before rerunning (`00-codebase-audit.md` §11.2).

## 5. Function integration tests (per money Function)

| Case | Expected result |
|---|---|
| Unauthenticated | `unauthenticated` |
| Flag off (and caller not allow-listed) | `failed-precondition` |
| Malformed input (schema) | `invalid-argument`; no reads or writes |
| Over the rate limit | `resource-exhausted` |
| Caller not a member or lacking the role (including a forged role in the request) | `permission-denied` |
| Missing, expired, reused or wrong-action step-up token | `unauthenticated` (step-up required) |
| Valid request | One ledger entry and an updated read model in the same transaction; an audit record; notifications |
| Same idempotency key repeated | The same result; still one entry |
| Same key with a different payload | `invalid-argument` |
| Concurrent claims for the same obligation | Exactly one succeeds (lock) |
| Wrong currency or wrong container | `invalid-argument` |
| A balance in another space before and after | Unchanged (**separation test**, run in every phase) |

## 6. Regression plan for existing features

1. **Baseline gate.** The CI command `CI=true npx react-scripts test --watchAll=false --coverage` must report at least 1,487 passing tests (plus new ones) and ≥ 84 % lines. `npm run test:functions` and `npm run test:rules` must pass.
2. **Feature checklist.** Before each preview review, `00-codebase-audit.md` §14 is walked through manually on the preview channel with the flag **off** (proving that today's behaviour is intact) and then **on**.
3. **Characterisation tests first.** Before modifying a covered file, a test pinning the current behaviour is added where none exists. Planned examples:
   - `App.js` routing tests (Phase 0.5);
   - an `ExpenseDetailsModal` coverage increase before the Phase 3 refund button;
   - `SettleUpModal` claim-path tests before Phase 1B.
4. **Test adaptation policy.** When a code path legitimately changes (for example settlements moving to a Function), the affected tests are updated in the same change, with the reason recorded in the commit message. Tests are never deleted to make a phase pass.
5. **Flag-off parity.** A dedicated suite renders the app with `circlesEnabled` off and asserts that the Dashboard, the + button and the Activity, Stats and You pages match today's behaviour.

## 7. Coverage targets

| Scope | Target |
|---|---|
| Whole client (Jest, lines) | ≥ 84 % (never below the baseline 84.25 % by more than 0.25 points within a phase; recovered by the phase's end) |
| Ledger read models, balance calculator, schedule, draw | ≥ 95 % lines, ≥ 90 % branches |
| `functions/core/*` (validate, authz, stepUp, idempotency, rateLimit, ledger, audit) | ≥ 90 % lines |
| Rules | 100 % of collections covered by the actor matrix (§4) |

## 8. Reporting

Each phase review includes:

- the test counts (Jest, Functions, rules, E2E);
- the coverage figures (statements, branches, functions, lines);
- the `npm audit` summary;
- any skipped or flaky tests, by name. The flake recorded on 3 November 2026 is tracked until it is identified.
