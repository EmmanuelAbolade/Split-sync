# 08. User Stories

| | |
|---|---|
| **Document** | `docs/circles/08-user-stories.md` |
| **Phase** | 0 (Research and Design) |
| **Depends on** | `02-requirements.md`, `07-use-cases.md` |
| **Format** | "As a … I want … so that …" (Cohn, 2004); acceptance criteria in Given/When/Then (North, 2006); MoSCoW priority (Clegg and Barker, 1994) |

Each story traces to requirement IDs. Each story becomes acceptance tests in its phase (`13-test-strategy.md`).

---

## Epic E1: Foundations and safety (Phase 1, 1B)

**US-101 (M) Kill switch.** *As the product owner, I want each space behind a server-enforced flag, so that I can hide and disable it instantly.* (FR-CORE-01)

- **Given** `loansEnabled` is off
  **When** any user calls a loans Function
  **Then** the call fails with `failed-precondition`, and the Loans tile and actions are not shown.
- **Given** `loansEnabled` is off but my uid is on the allow-list
  **When** I open the app
  **Then** I see and can use Loans.

**US-102 (M) Money never mixes.** *As a user, I want each space's balances kept separately, so that I never confuse a circle contribution with a bill debt.* (FR-CORE-02, -03, -04)

- **Given** I owe Tolu EUR 20 in an expense group and I pay Tolu EUR 200 in a circle
  **When** I view my balances
  **Then** I still owe Tolu EUR 20 in Expenses, and the circle shows my contribution as paid.

**US-103 (M) No double payments.** *As a payer, I want a repeated tap or a retry not to record my payment twice.* (FR-CORE-07)

- **Given** I submit a claim with idempotency key K
  **When** the same request with K arrives again
  **Then** exactly one entry exists, and both responses are identical.

**US-104 (M) Confirm it's me.** *As a user, I want money actions to need a fresh passkey check, so that someone with my unlocked phone cannot move my obligations.* (FR-CORE-08)

- **Given** I am signed in but have not completed step-up in the last 5 minutes for this action
  **When** I approve a spend request
  **Then** I am asked to use my passkey, or to re-enter my password if I have no passkey, and the approval proceeds only after the server verifies it.

**US-105 (M) Settlements are honest.** *As a creditor, I want only the person who owes me to be able to claim they paid, so that nobody can record a payment on someone else's behalf.* (FR-SET-01, -02)

- **Given** Bob owes Alice
  **When** Carol tries to record "Bob paid Alice"
  **Then** it is rejected.

**US-106 (M) Existing behaviour is unchanged.** *As an existing user, I want everything I use today to keep working.* (Preservation requirement)

- **Given** the 1,487 baseline tests
  **When** any phase is merged
  **Then** all of them pass, and coverage is at least 84 % lines.

## Epic E2: Hub and navigation (Phase 0.5, 2)

**US-201 (M) Spaces at a glance.** *As a user, I want Home to show my spaces, each with its own summary, so that I can see where I need to act.* (FR-HUB-01)

- **Given** Circles and Loans are enabled
  **When** I open Home
  **Then** I see tiles for Expenses, Circles and Loans, each showing only its own figures, and no combined total.

**US-202 (M) Nothing lost.** *As an existing user, I want my current Home content available in the Expenses space.* (FR-HUB-02)

- **Given** the hub is enabled
  **When** I open Expenses
  **Then** I see my overview cards, suggested settlement, groups and pending banners exactly as before.

**US-203 (M) What needs me.** *As a user, I want one list of things needing my attention across spaces.* (FR-HUB-03)

- **Given** a contribution is due in 2 days and a spend request awaits my approval
  **When** I open Home
  **Then** both appear under "Needs attention", each labelled with its space.

**US-204 (S) My Home, my way.** *As a user, I want to hide spaces I don't use.* (FR-HUB-04)

- **Given** I hide Aid
  **When** I sign in on another device
  **Then** Aid is hidden there too, and my aid data is intact.

**US-205 (M) Smart + button.** *As a user, I want the + button to offer what makes sense where I am.* (FR-HUB-05)

- **Given** I am in Circles
  **When** I tap +
  **Then** "Pay a contribution" is listed first.

**US-206 (M) Filtered activity and stats.** *As a user, I want to filter Activity and Stats by space.* (FR-HUB-06, -07)

- **Given** I choose the Loans chip
  **When** the list loads
  **Then** only loan activity is shown.
- **Given** I choose All
  **Then** items are labelled by space and not totalled.

**US-207 (M) Invite links survive sign-in.** *As an invited person, I want to reach the group after signing in.* (FR-HUB-10)

- **Given** I am signed out and open an invite link
  **When** I sign in
  **Then** I land on that group's join screen.

## Epic E3: Refunds (Phase 3)

**US-301 (M) Ask for money back.** *As a member, I want to request a refund on an expense, so that a mistake or cancellation can be corrected without deleting history.* (FR-REF-01, -03)

- **Given** an expense of EUR 60 with no prior refunds
  **When** I request EUR 70
  **Then** I am told the maximum is EUR 60.
- **Given** a refund of EUR 36.40 is accepted
  **Then** the original expense is still listed, and a linked refund entry adjusts the balances.

**US-302 (M) Only the payer decides.** *As a payer, I want to be the one who accepts refunds on what I paid.* (FR-REF-02, -04)

- **Given** I am neither the payer nor the group owner
  **When** I try to accept a refund
  **Then** I am refused.

**US-303 (C) Spot duplicates.** *As a reviewer, I want a hint when a refund looks like a duplicate entry.* (FR-REF-05)

## Epic E4: Events (Phase 3)

**US-401 (M) Budget my event.** *As an organiser, I want to set a total budget and category budgets.* (FR-EVT-01)

- **Given** a total of EUR 6,000
  **When** I set categories adding up to EUR 6,500
  **Then** I am asked to correct them.

**US-402 (M) Approve before spending.** *As a treasurer, I want spending approved before it is committed.* (FR-EVT-04, -05)

- **Given** Kemi requests EUR 180 for a cake deposit
  **When** I approve it with my passkey
  **Then** EUR 180 is recorded against Catering, and Kemi is notified.
- **Given** I am a treasurer
  **When** I submit my own spend request
  **Then** I cannot approve it myself.

**US-403 (M) Track pledges.** *As an organiser, I want to see who pledged and who has paid.* (FR-EVT-03, -06)

## Epic E5: Circles (Phase 4)

**US-501 (M) Start a circle.** *As an organiser, I want to create a savings circle with clear rules.* (FR-CIR-01, -10)

- **Given** I enter EUR 5 per cycle
  **When** I submit
  **Then** I am told the amount must be between EUR 10 and EUR 2,000.
- **Given** valid values
  **When** I have not ticked the rules acknowledgement
  **Then** the circle is not created.

**US-502 (M) A fair, provable order.** *As a member, I want to verify that the random payout order was not manipulated.* (FR-CIR-03)

- **Given** a circle created with a random draw
  **When** the circle starts and I tap "Verify draw"
  **Then** the revealed seed's hash equals the commitment stored at creation, and recomputing the shuffle gives the published order.

**US-503 (M) Pay my contribution.** *As a member, I want to pay the cycle's recipient and have it recorded.* (FR-CIR-04, -05)

- **Given** Tolu is this cycle's recipient
  **When** I pay EUR 200 via Revolut, tap "I've paid" and pass step-up
  **Then** my contribution shows "Awaiting confirmation" until Tolu confirms it, and the Pay button is locked meanwhile.

**US-504 (S) Swap slots.** *As a member, I want to swap my payout slot with someone who agrees.* (FR-CIR-06)

**US-505 (M) Reminders.** *As a member, I want reminders before contributions are due.* (FR-CIR-07)

- **Given** my contribution is due in 2 days
  **When** the daily schedule runs
  **Then** I receive one reminder, and no more than one per day.

**US-506 (M) See the whole circle.** *As a member, I want the timeline, the current recipient, who has paid, and my slot.* (FR-CIR-09)

**US-507 (C) Guarantors.** *As an organiser, I want new members without history to have a guarantor for early slots.* (FR-CIR-08)

## Epic E6: Request privacy (Phase 5)

**US-601 (M) Choose who can ask me.** *As a user, I want to choose who may send me loan or aid requests.* (FR-PRV-01)

- **Given** a new account
  **Then** the loan and aid request settings default to "Trusted people only".

**US-602 (M) Silent holding.** *As a user, I want requests from people outside my settings held for review, without them being told.* (FR-PRV-02)

- **Given** Marco is not on my trusted list
  **When** he requests a loan
  **Then** it appears in my held inbox, and Marco sees exactly the same confirmation as for a delivered request.

**US-603 (M) Trust or block.** *As a user, I want to decline, block, or trust and view from the inbox.* (FR-PRV-03, -04)

## Epic E7: Loans (Phase 6)

**US-701 (M) Ask for a loan.** *As a borrower, I want to request an interest-free loan with a clear schedule.* (FR-LON-01)

**US-702 (M) Agree terms.** *As a lender, I want terms fixed once we both accept them.* (FR-LON-02, -06)

- **Given** we both accepted a 3-instalment plan
  **When** either of us tries to change an amount
  **Then** only a reschedule request is possible; the accepted terms remain in the history; interest is always zero.

**US-703 (M) Repay and confirm.** *As a borrower, I want each repayment recorded once the lender confirms it.* (FR-LON-03)

**US-704 (S) Friendly reminder.** *As a lender, I want to send a polite reminder without it feeling personal.* (FR-LON-05)

## Epic E8: Aid (Phase 7)

**US-801 (M) Ask my community.** *As a member in difficulty, I want to ask my group for help without exposing my private circumstances.* (FR-AID-01, -03)

- **Given** I write a private reason
  **Then** only the verifying admin can read it; other members see the title and target only.

**US-802 (M) Verified first.** *As a group member, I want requests checked by an admin before I see them.* (FR-AID-02)

**US-803 (M) Give anonymously.** *As a giver, I want to pledge without other members seeing my name or amount.* (FR-AID-04)

## Epic E9: Trust and analytics (Phase 8)

**US-901 (S) A transparent reliability score.** *As a circle member, I want to see a fellow member's reliability, and to know how it is calculated.* (FR-TRU-01, -02)

- **Given** I share no circle with Sean
  **When** I view his profile
  **Then** I cannot see his score.

**US-902 (M) Never a gatekeeper.** *As a user, I want my score never to block me automatically.* (FR-TRU-03)

## Epic E10: Data rights (Phases 1 and 9)

**US-1001 (S) Download my data.** (FR-DAT-01)

**US-1002 (M) Leave safely.** *As a user, I want account deletion to account for my circle and loan obligations.* (FR-DAT-02)

- **Given** I have an outstanding loan instalment
  **When** I try to delete my account
  **Then** I am told what must be settled first.

---

## Priority summary

| Priority | Stories |
|---|---|
| Must | US-101–106, 201–203, 205–207, 301–302, 401–403, 501–503, 505–506, 601–603, 701–703, 801–803, 902, 1002 |
| Should | US-204, 504, 704, 901, 1001 |
| Could | US-303, 507 |
| Won't (this release) | Circle ordering by trust score; escrow; pooled savings; interest; lending from a pool |
