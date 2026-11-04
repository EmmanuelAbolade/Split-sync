# 09. System Sequence Diagrams

| | |
|---|---|
| **Document** | `docs/circles/09-sequence-diagrams.md` |
| **Phase** | 0 (Research and Design) |
| **Depends on** | `04-system-architecture.md` §4.1 (server pipeline), `07-use-cases.md` |

**Conventions**

- `Fn` stands for the Cloud Functions boundary.
- Every Function call implicitly runs the pipeline in `04-system-architecture.md` §4.1: App Check, auth, flag, schema validation, rate limit, server-side authorisation, step-up check, idempotency.
- Function names use the grouped form `space.action`. Firebase deploys grouped exports as `space-action`.
- `DB` is the default database and `CDB` the `circles` database.

---

## 1. Step-up authentication (included in every money action)

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant C as Client
  participant A as Platform authenticator
  participant F as Fn stepUp
  participant D as DB stepUp collections

  U->>C: Confirm a money action
  C->>F: stepUp.begin({actionHash})
  F->>D: store challenge {uid, actionHash, expires +2 min, used:false}
  F-->>C: WebAuthn request options (challenge, allowCredentials)
  C->>A: navigator.credentials.get(options)
  A->>U: biometric / PIN prompt
  U-->>A: verifies
  A-->>C: assertion
  C->>F: stepUp.complete({assertion})
  F->>D: load challenge + stored public key (transaction)
  F->>F: verify signature, origin, RP ID, challenge, signCount
  F->>D: mark challenge used, create stepUpToken {uid, actionHash, expires +5 min, used:false}
  F-->>C: stepUpToken
  alt no passkey registered or device unsupported
    C->>U: re-authenticate (password or Google)
    C->>F: stepUp.complete({idToken})
    F->>F: verify ID token, auth_time within 5 min
    F-->>C: stepUpToken
  end
  Note over C,F: The money Function consumes the token (single use, bound to uid and actionHash)
```

## 2. Paying a circle contribution

```mermaid
sequenceDiagram
  autonumber
  actor P as Payer
  participant C as Client
  participant X as Payment provider
  participant F as Fn circles
  participant CDB as CDB
  actor R as Recipient

  P->>C: Pay EUR 200 to Tolu
  C->>F: circles.getRecipientPaymentOptions({circleId})
  F-->>C: {paypalUsername?, revolutUsername?, hasIban}
  P->>C: choose Revolut
  C->>X: open Revolut.me link (amount copied)
  P->>X: pays outside SplitSync
  P->>C: I've paid
  Note over C: Step-up (diagram 1) produces stepUpToken
  C->>F: circles.claimContribution({circleId, cycle, method, idempotencyKey, stepUpToken})
  F->>CDB: transaction: check member, cycle open, not recipient, no pending lock, <br/>create lock, post ledger entry {spaceId:'circles', kind:'contribution', status:'claimed'}, <br/>store idempotency record
  F->>CDB: auditLog + notification to recipient
  F-->>C: {entryId, status:'claimed'}
  C-->>P: Awaiting Tolu's confirmation (Pay button locked)
  R->>C: Confirm receipt
  C->>F: circles.confirmContribution({entryId, idempotencyKey})
  F->>CDB: transaction: verify caller is recipient, post status entry 'confirmed', <br/>update cycle read model (paidCount), delete lock
  F->>CDB: auditLog + notification to payer
  F-->>C: confirmed
  alt recipient declines
    R->>C: Decline
    C->>F: circles.declineContribution({entryId, reason})
    F->>CDB: post status entry 'declined', delete lock, notify payer
  end
```

## 3. Slot swap

```mermaid
sequenceDiagram
  autonumber
  actor A as Member A (slot 5)
  participant C as Client
  participant F as Fn circles
  participant CDB as CDB
  actor B as Member B (slot 6)

  A->>C: Request swap with B
  C->>F: circles.requestSwap({circleId, withUid:B, idempotencyKey})
  F->>CDB: check both are members and both slots are in the future, <br/>create swapRequest {status:'pending', expires +72h}
  F->>CDB: notify B, auditLog
  F-->>C: pending
  B->>C: Accept
  C->>F: circles.respondSwap({swapId, accept:true})
  F->>CDB: transaction: re-check that neither slot has been paid out, <br/>swap positions in order[], swapRequest 'accepted'
  F->>CDB: notify all members, auditLog {action:'slot.swap'}
  F-->>C: accepted
  alt declined, expired or slot already paid out
    F-->>C: rejected (no change to order)
  end
```

## 4. Loan request, including the held-request path

```mermaid
sequenceDiagram
  autonumber
  actor Bo as Borrower
  participant C as Client
  participant F as Fn loans
  participant CDB as CDB
  actor L as Lender

  Bo->>C: Request EUR 250 over 3 months
  Note over C: Step-up (borrower accepts the proposed terms)
  C->>F: loans.requestLoan({lenderUid, amountMinor, currency, instalments, frequency, purpose, idempotencyKey, stepUpToken})
  F->>CDB: rate limit check (per borrower)
  F->>CDB: read lender privacy, trusted list, blocked list, shared circles
  alt borrower blocked by lender
    F->>F: discard silently
  else allowed by lender settings
    F->>CDB: create loanRequest {delivery:'inbox'}, generate schedule
    F->>CDB: notify lender
  else outside lender settings
    F->>CDB: create loanRequest {delivery:'held'}, increment held count only
  end
  F->>CDB: auditLog (all branches)
  F-->>C: {status:'sent'} (identical response in every branch)
  C-->>Bo: Request sent
  L->>C: Open Requests (held) then "Trust and view"
  C->>F: privacy.trustAndView({requestId})
  F->>CDB: add Bo to trusted, request delivery 'inbox'
  L->>C: Accept terms
  Note over C: Step-up (lender)
  C->>F: loans.respond({requestId, accept:true, stepUpToken})
  F->>CDB: create loan {status:'accepted-awaiting-disbursement', terms frozen, interest 0}
  F->>CDB: notify borrower, auditLog
```

## 5. Loan repayment

```mermaid
sequenceDiagram
  autonumber
  actor Bo as Borrower
  participant C as Client
  participant X as Payment provider
  participant F as Fn loans
  participant CDB as CDB
  actor L as Lender

  Bo->>C: Repay instalment 2 (EUR 83.33)
  C->>X: deep link / SEPA details
  Bo->>X: pays outside SplitSync
  Note over C: Step-up
  C->>F: loans.claimRepayment({loanId, instalment:2, idempotencyKey, stepUpToken})
  F->>CDB: transaction: verify borrower, instalment due and unclaimed, lock, <br/>post entry {spaceId:'loans', kind:'repayment', status:'claimed'}
  F->>CDB: notify lender, auditLog
  L->>C: Confirm received
  C->>F: loans.confirmRepayment({entryId})
  F->>CDB: post 'confirmed', reduce outstanding, next instalment 'due'
  alt outstanding reaches zero
    F->>CDB: loan status 'repaid', notify both
  end
```

## 6. Aid request with administrator verification

```mermaid
sequenceDiagram
  autonumber
  actor R as Requester
  participant C as Client
  participant F as Fn aid
  participant DB as DB (groups)
  participant CDB as CDB
  actor A as Group admin
  actor M as Members

  R->>C: Ask for help (group, title, target, end, private note)
  C->>F: aid.createRequest({groupRef, title, targetMinor, currency, endsAt, privateNote, idempotencyKey})
  F->>DB: read group, verify R is member, find admin (owner) other than R
  F->>CDB: check one active request per R per group, rate limit
  F->>CDB: aidRequests/{id} {status:'pending-review', memberUids snapshot}<br/>aidPrivate/{id} {note, readers:[R, admin]}
  F->>CDB: notify admin only, auditLog
  F-->>C: pending-review
  A->>C: Review (reads aidPrivate)
  A->>C: Verify
  C->>F: aid.review({requestId, decision:'verify'})
  F->>CDB: verify caller is admin and not the requester, status 'open', verifiedBy, verifiedAt
  F->>CDB: notify members (title and target only), auditLog
  alt rejected
    F->>CDB: status 'rejected', notify requester only, with the reason
  end
```

## 7. Pledging aid

```mermaid
sequenceDiagram
  autonumber
  actor G as Giver
  participant C as Client
  participant F as Fn aid
  participant CDB as CDB
  actor R as Requester

  G->>C: Pledge EUR 25 (anonymous on)
  C->>F: aid.pledge({requestId, amountMinor, anonymous:true, idempotencyKey})
  F->>CDB: verify G is in memberUids, request open, not expired, <br/>create pledge {status:'pledged', anonymous}
  F-->>C: pledged
  G->>C: Pays requester directly, then "I've paid"
  Note over C: Step-up
  C->>F: aid.claimPledgePayment({pledgeId, idempotencyKey, stepUpToken})
  F->>CDB: post entry {spaceId:'aid', kind:'pledgePayment', status:'claimed'}, notify requester
  R->>C: Confirm received
  C->>F: aid.confirmPledgePayment({entryId})
  F->>CDB: confirmed, update progress read model (pledgedMinor, receivedMinor)
  Note over CDB: Other members see the totals. An anonymous giver's name and amount are visible only to the requester
```

## 8. Refund request and acceptance (Expenses space)

```mermaid
sequenceDiagram
  autonumber
  actor Q as Requester
  participant C as Client
  participant F as Fn refunds
  participant DB as DB
  actor P as Payer (or group owner)

  Q->>C: Request refund EUR 36.40 (duplicate entry)
  C->>F: refunds.request({expenseId, amount, reason, idempotencyKey})
  F->>DB: read expense and its accepted refunds, verify Q is a member, <br/>amount at most the refundable remainder, not a settlement
  F->>DB: refundRequests/{id} {status:'pending'}, notify payer, auditLog
  F-->>C: pending
  P->>C: Review (optional duplicate hint) then Accept
  Note over C: Step-up (payer)
  C->>F: refunds.decide({refundId, accept:true, stepUpToken, idempotencyKey})
  F->>DB: transaction: verify caller is the payer or group owner, re-check remainder, <br/>create reversal entry in expenses {kind:'reversal', reversesEntryId:expenseId,<br/>splits scaled by 36.40/original, spaceId:'expenses'}, request 'accepted'
  F->>DB: auditLog, notify requester and participants
  F-->>C: accepted
  Note over DB: The original expense is never edited. calculateBalances applies the reversal with a negative sign.
```

## 9. Event spend approval

```mermaid
sequenceDiagram
  autonumber
  actor K as Member (requester)
  participant C as Client
  participant F as Fn events
  participant DB as DB
  actor T as Treasurer

  K->>C: Request EUR 180, Catering, cake deposit (+ receipt)
  C->>F: events.requestSpend({eventId, category, amountMinor, item, receiptUrl?, idempotencyKey})
  F->>DB: verify membership and that the category exists, <br/>spendRequests/{id} {status:'pending'}, notify treasurers
  T->>C: Approve
  Note over C: Step-up (treasurer)
  C->>F: events.decideSpend({spendId, approve:true, acknowledgeOverBudget?, stepUpToken, idempotencyKey})
  F->>DB: verify T is treasurer and T is not K, <br/>compute category spent + amount against budget
  alt over budget and not acknowledged
    F-->>C: failed-precondition (over budget: confirm to proceed)
  else
    F->>DB: post ledger entry {spaceId:'events', kind:'eventSpend', category}, <br/>spend 'approved', update budget read model
    F->>DB: auditLog, notify K
    F-->>C: approved
  end
```

## 10. Settlement (Expenses, Phase 1B)

```mermaid
sequenceDiagram
  autonumber
  actor D as Debtor
  participant C as Client (SettleUpModal)
  participant F as Fn settlements
  participant DB as DB
  actor Cr as Creditor

  D->>C: Mark as paid (EUR 37.50, Revolut)
  Note over C: Step-up
  C->>F: settlements.claim({groupId, toUid, amount, method, idempotencyKey, stepUpToken})
  F->>DB: verify caller is in members, toUid is a member, and the amount is at most what the caller owes, <br/>pendingPayments lock, notifications (payment_confirmation_needed, payment_log)
  F-->>C: pending
  Cr->>C: Confirm receipt
  C->>F: settlements.confirm({pendingId})
  F->>DB: verify caller is the creditor, create expenses settlement entry {isSettlement:true, createdBy:'system'}, <br/>delete lock, update notifications, auditLog
```
