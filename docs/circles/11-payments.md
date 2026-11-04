# 11. Payments

| | |
|---|---|
| **Document** | `docs/circles/11-payments.md` |
| **Phase** | 0 (Research and Design) |
| **Depends on** | `00-codebase-audit.md` §13.6a, `01-business-case.md` §6, `10-database-design.md` |

---

## 1. Principle

**SplitSync never moves or holds money.** In every space, a payer pays a payee directly, using the payee's own PayPal.me, Revolut or bank details. SplitSync then records two facts:

- the payer's **claim** ("I paid");
- the payee's **confirmation** ("I received it").

Balances and progress change only on confirmation. This is the model the Expenses space already uses (Mark as Paid followed by Confirm Receipt). It is reused unchanged in every new space.

## 2. Existing payment routes, as audited

| Route | Today | How the money moves | Server involvement |
|---|---|---|---|
| PayPal.me link | `paymentLinks.generatePayPalLink`; amount copied to the clipboard | Payer → payee, in the PayPal app | None (deep link) |
| Revolut link | `paymentLinks.generateRevolutLink`; amount copied | Payer → payee, in the Revolut app | None |
| SEPA bank transfer | IBAN and BIC shown with copy buttons (IBAN from `getIban`, members only) | Payer's bank → payee's bank | `getIban` decrypts for co-members only |
| QR scan-to-pay | QR of the PayPal or Revolut link | As above | None |
| PayPal Checkout (sandbox) | `PayPalButtons` + `capturePayPalOrder`, inside the "Future feature" demo panel | **No payee is set**, so a live capture would credit SplitSync's merchant account (`00-codebase-audit.md` §13.6a) | Server-side capture |
| SEPA demo | `SepaPaymentModal`, simulated | None (simulation) | None |

### 2.1 Control on PayPal Checkout (applies before any live use)

1. PayPal Checkout **remains sandbox-only and inside the demo panel**. No new space offers it.
2. `capturePayPalOrder` gains a guard: it refuses to run unless the PayPal environment is sandbox. Any switch to live requires an explicit code change and review.
3. Real-money PayPal payments use **PayPal.me**, which pays the payee directly.
4. Live Checkout would need the creditor as payee, which means PayPal's multiparty or partner programme and a contractual review. It is outside the scope of this extension (Brief §1, "Out of scope").

## 3. Reuse per space

| Space | Payer → payee | Methods offered | Claim Function | Confirm Function | Pending lock key |
|---|---|---|---|---|---|
| Expenses (Phase 1B) | Debtor → creditor | PayPal.me, Revolut, SEPA details (+ sandbox demo) | `settlements.claim` | `settlements.confirm` | `pendingPayments/{groupId}_{from}_{to}` (existing format) |
| Events, pledges | Member → treasurer or organiser | PayPal.me, Revolut, SEPA | `events.claimPledgePayment` | `events.confirmPledgePayment` | `locks/evt_{eventId}_{uid}_{pledgeId}` |
| Events, spending | n/a (approval records a commitment; the purchase happens outside SplitSync) | n/a | `events.decideSpend` | n/a | n/a |
| Circles | Member → cycle recipient | PayPal.me, Revolut, SEPA | `circles.claimContribution` | `circles.confirmContribution` | `locks/cir_{circleId}_{cycle}_{uid}` |
| Loans, disbursement | Lender → borrower | PayPal.me, Revolut, SEPA | `loans.claimDisbursement` | `loans.confirmDisbursement` | `locks/lon_{loanId}_d` |
| Loans, repayment | Borrower → lender | PayPal.me, Revolut, SEPA | `loans.claimRepayment` | `loans.confirmRepayment` | `locks/lon_{loanId}_{n}` |
| Aid | Giver → requester | PayPal.me, Revolut, SEPA | `aid.claimPledgePayment` | `aid.confirmPledgePayment` | `locks/aid_{aid}_{pledgeId}` |
| Refunds | n/a: a refund is a ledger reversal of what is owed, not a payment. If money must actually change hands afterwards, it flows through the normal settlement process in the Expenses space. | n/a | `refunds.decide` | n/a | n/a |

**Payment options for the payee** come from the server and are scoped to the container:

- `getGroupPaymentMethods` (existing) for groups;
- equivalent container-scoped calls (`circles.getRecipientPaymentOptions`, `loans.getCounterpartyPaymentOptions`, `aid.getRequesterPaymentOptions`) for the new spaces.

Each returns usernames and `hasIban` only. The IBAN is fetched with `getIban`, extended to accept a container reference so that **only people who share that circle, loan or aid request** can read it.

**Space separation of payments (Brief §2, rule 2).** A claim names exactly one space and one container. The Functions:

- reject claims whose `currency` differs from the container's currency;
- never apply a confirmation to a different container;
- have no "settle all with this person" operation that crosses containers or spaces.

## 4. Idempotency

| Aspect | Design |
|---|---|
| Key | A client-generated random identifier (`crypto.randomUUID()`) created **once per user intent**, for example when the "I've paid" sheet opens, and kept until it closes, so retries and double taps reuse it |
| Scope | `idempotency/{uid}_{key}` in the **same database** as the ledger write (`10-database-design.md` §1, principle 6) |
| Semantics | Within the ledger transaction: if the record exists and `requestHash` matches, return the stored `result`; if it exists with a different hash, return `invalid-argument` (key reuse); otherwise perform the write and store the record (Stripe, n.d.) |
| Expiry | 7 days (scheduler) |

## 5. Pending locks

The existing `pendingPayments` lock is generalised:

- **Creation:** inside the claim transaction.
- **Removal:** on confirm or decline, inside the same transaction.
- **Effect:** while a lock exists, the payer's Pay button is disabled with an explanation (existing UX), and another claim for the same obligation is rejected.
- **Stale locks:** after 7 days without a response, the scheduler reminds the payee. After 14 days, the claim becomes `disputed`: visible to both parties, with no automatic resolution. The lock remains until the payee responds or the payer withdraws.

## 6. Reconciliation

SplitSync cannot see provider transactions, so reconciliation is **two-party**:

| Situation | Outcome |
|---|---|
| Payer claims, payee confirms | `confirmed`; balances and progress update |
| Payer claims, payee declines | `declined`; nothing changes; the payer is told to check and retry |
| Payer claims, payee silent | Reminders, then `disputed` (§5); counted in neither party's trust inputs until resolved |
| Payee confirms an amount different from the claim | Not allowed. The payee declines; the payer claims the correct amount. |
| Duplicate claim | Prevented by the lock and the idempotency key |

**Scheduled integrity checks.** A daily check recomputes each container's read model (paid counts, outstanding, pledged) from its ledger and reports any mismatch to the audit log. It never rewrites ledger entries.

## 7. Amounts and currency

- New spaces use integer minor units (`amountMinor`) with ISO 4217 codes.
- Instalment and contribution schedules round half-up per instalment, and the final instalment absorbs the remainder, so the schedule sums exactly to the principal.
- The client displays amounts with `Intl.NumberFormat` and the container's currency.
- There is never a conversion and never a combined total across currencies or spaces (FR-CORE-03).

## 8. Why escrow and pooled funds are excluded

| Option | Why excluded |
|---|---|
| Protected circle pot (escrow) | Holding contributions until release means SplitSync takes possession of funds: a regulated payment or e-money activity (Directive (EU) 2015/2366; Directive 2009/110/EC). It would need authorisation or a licensed partner, safeguarding, and identity checks. |
| Savings groups (shared pot) | The same: custody of pooled funds |
| Lending from a pool, or interest | Credit provision with regulatory and consumer-protection obligations (see `01-business-case.md` §6, and the legal review recommended there) |
| Routing payments through SplitSync's PayPal account | The same custody problem (§2.1) |

These appear only as locked "Coming later" cards (`06-ux-ui-design.md` §3.12). If they are ever pursued, they would run as a **separate service** with a licensed partner, so that a defect in SplitSync could never sit next to held funds.
