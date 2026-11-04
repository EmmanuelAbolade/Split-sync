# 01. Business Case: SplitSync as a Financial Coordination Platform

| | |
|---|---|
| **Document** | `docs/circles/01-business-case.md` |
| **Phase** | 0 (Research and Design) |
| **Depends on** | `00-codebase-audit.md` (baseline and decisions D1 to D4) |
| **Referencing** | Harvard style; full list in `references.md`. |

---

## 1. Problem statement

People who share money informally coordinate it through a patchwork of tools. Bills are split in one application, savings circles are tracked in messaging groups and paper notebooks, personal loans between friends are remembered rather than recorded, and appeals for help circulate as forwarded messages. Three problems follow.

1. **Opacity.** In a rotating savings circle, members often cannot see who has paid this cycle, whose turn is next, or how the order was decided. Disputes then arise from memory rather than records.
2. **Social cost of asking and reminding.** Requesting repayment of a personal loan, or reminding a circle member that a contribution is late, carries a social cost. That cost is lowered when the reminder comes from a neutral system.
3. **Unwanted requests.** Sharing an expense group with someone does not mean consenting to be asked by them for money. Existing bill-splitting tools offer no control over who may make financial requests of a user.

SplitSync already solves the first of these problems for shared expenses (see `00-codebase-audit.md`). The Circles extension applies the same principles to four further kinds of informal money: transparent records, per-currency balances that are never converted, and direct member-to-member payment. Those four are budgeted events, rotating savings circles, interest-free personal loans and mutual aid. Each is kept in its own space, so that money of different kinds is never combined.

## 2. Background: informal savings and mutual aid

### 2.1 Rotating savings and credit associations (ROSCAs)

A rotating savings and credit association is a group in which each member contributes a fixed sum at regular intervals. The whole pot is given to one member in turn until every member has received it once. Ardener's comparative study established the ROSCA as a widespread institution across cultures (Ardener, 1964). Besley, Coate and Loury modelled the ROSCA as a mechanism that lets members acquire an indivisible good earlier than saving alone would allow, and analysed random and bidding allocation of turns (Besley, Coate and Loury, 1993). Local names include *ajo* and *esusu* (Yoruba), *susu* (Ghana and the Caribbean), *tontine* (Francophone Africa), *tanda* (Mexico) and *chit fund* (India).

The economic literature identifies the central risk of the ROSCA: a member who receives the pot early has an incentive to stop contributing afterwards. Groups manage this risk through social ties and sanctions rather than legal enforcement (Besley, Coate and Loury, 1993; Anderson, Baland and Moene, 2009). This matters for the design. Because SplitSync will not hold funds (§6), it cannot prevent default. It can only make obligations visible, remind members, and give organisers better information when choosing the payout order.

### 2.2 Diaspora communities in Ireland and Europe

ROSCAs travel with migrant communities and remain in use in the diaspora. The author's community experience motivates this extension. **However, no reliable quantitative data on ROSCA usage in Ireland was located during this research.** No figure is therefore claimed. Two research tasks are recommended:

- Population context could be drawn from the Central Statistics Office's Census 2022 tables on country of birth and ethnicity.
- Usage could be established through a short user survey of the target communities, which would also serve as requirements validation (see `02-requirements.md`).

### 2.3 Mutual aid

Mutual aid is reciprocal, voluntary help among members of a community: for example, contributions towards a funeral, travel home after a bereavement, or a family emergency. Informal collection through messaging groups is common. It is vulnerable to two problems: duplicate or false appeals, and the exposure of sensitive personal circumstances (often health-related) to a wide audience. The design response is to route requests through a group, require a verifying administrator, and keep the reason visible to that administrator only (see `12-security-and-threat-model.md`).

## 3. Competitor analysis

The analysis below compares products on their capabilities as observed by the author on each product's public website at the time of writing (November 2026). Products change frequently, so the comparison reflects that point in time. "Not assessed" means the capability was not evaluated.

| Capability | Splitwise | Tricount | Settle Up | Messaging group + spreadsheet | **SplitSync (current)** | **SplitSync Circles (proposed)** |
|---|---|---|---|---|---|---|
| Shared-expense splitting | Yes | Yes | Yes | Manual | Yes (4 methods) | Yes (unchanged) |
| Multi-currency without forced conversion | Partial | Partial | Partial | Manual | Yes, per group | Yes, per space and currency |
| Receipt OCR | Paid tier | Not assessed | Not assessed | No | Yes | Yes |
| In-app settle-up links (PayPal, Revolut, SEPA) | Limited | Not assessed | Not assessed | No | Yes | Yes |
| Payee confirmation of payments | Not assessed | Not assessed | Not assessed | No | Yes | Yes |
| Event budgets with treasurer approval | No | No | No | Manual | No | **Yes** |
| ROSCA rotation with verifiable draw | No | No | No | Manual | No | **Yes** |
| Interest-free P2P loan schedules | Partial (IOUs) | No | Partial | Manual | No | **Yes** |
| Admin-verified mutual aid with private reason | No | No | No | No | No | **Yes** |
| Control over who may request money | No | No | No | No | No | **Yes** |
| AI assistant | Not assessed | Not assessed | Not assessed | No | Yes | Yes, space-aware |

Dedicated digital ROSCA products exist in several markets. Examples reported in the press include MoneyFellows in Egypt and various "ajo"/"esusu" savings apps in Nigeria. Several of these appear to hold members' contributions themselves, which places them inside payment or e-money regulation. SplitSync's differentiator is the opposite choice: it is a coordination and record-keeping layer over payments that members make directly to one another (§6), combined with the existing expense-splitting product and a single login.

## 4. Value proposition

| Stakeholder | Value |
|---|---|
| Circle members | A transparent rotation order with a verifiable random draw; visibility of who has paid; neutral reminders; a record that survives disputes |
| Organisers and treasurers | Budget against actuals by category; approval of spending before it happens; pledge tracking |
| Lenders and borrowers | An agreed, interest-free schedule both parties accepted; reminders that remove the awkwardness of asking |
| Aid requesters and givers | Help reaches a known community, a verifying administrator protects against false appeals, and the reason stays private |
| All users | One login; money never mixed across spaces or currencies; control over who may ask them for money |

The proposition is deliberately modest. SplitSync makes informal money practices **visible, fair and less awkward**. It does not move, hold, lend or guarantee money.

## 5. Risks

| Risk | Likelihood | Impact | Response |
|---|---|---|---|
| A circle member collects the pot early and then stops paying | Medium | High for other members | Cannot be prevented without custody. Mitigated by a verifiable order, an optional guarantor for early slots, reminders, visible payment status and trust history (`12-security-and-threat-model.md`). Members are told this plainly before joining. |
| Fake or duplicate aid requests | Medium | Medium | Group-only sharing, administrator verification, rate limits, one active request per requester per group |
| Loan or aid request spam and harassment | Medium | Medium | Request privacy settings, a held-requests inbox, blocking, rate limits |
| Regulatory reclassification as a payment or credit service | Low if the design is followed | High | Coordination-only design (§6); no funds held; no interest; legal review before any change to this position |
| Regression of the live expense-splitting product | Medium during the build | High | The baseline in `00-codebase-audit.md`; feature flags; a preview channel per phase; the full regression suite on every phase (`13-test-strategy.md`) |
| Exposure of special-category personal data (health reasons in aid requests) | Low with controls | High | Administrator-only visibility, data minimisation, retention limits, erasure support (GDPR Article 9) |
| Trust score perceived as unfair or discriminatory | Medium | Medium | A transparent formula, visibility limited to shared-circle members, no use outside SplitSync, and the ability to see one's own inputs |
| Scope growth across five spaces | High | Medium | Phased delivery with approval gates (`14-implementation-plan.md`) |

## 6. Regulatory position

> This section is the author's analysis for design purposes. It is **not legal advice**. Independent legal review is recommended before launch, and is mandatory before any change that would involve holding funds.

### 6.1 Coordination versus custody

The defining design choice is that **SplitSync never receives, holds or transmits users' funds**. Members pay one another directly through their own PayPal, Revolut or bank accounts. SplitSync records the agreement and the claimed payment, and the payee confirms receipt.

The revised Payment Services Directive regulates "payment services", such as money remittance and the execution of payment transactions, provided by payment institutions (Directive (EU) 2015/2366). The Directive excludes certain activities from its scope. These include, on the author's reading, services provided by technical service providers that support the provision of payment services without at any time entering into possession of the funds to be transferred (Directive (EU) 2015/2366, Article 3). Ireland transposed the Directive through the European Union (Payment Services) Regulations 2018 (S.I. No. 6 of 2018), and the Central Bank of Ireland authorises and supervises payment institutions. Issuing electronic money or holding customer funds would separately engage the E-Money Directive (Directive 2009/110/EC), transposed in Ireland by the European Communities (Electronic Money) Regulations 2011 (S.I. No. 183 of 2011).

Design consequences:

- **No pooled or escrowed funds.** "Protected circle pot" and "Savings groups" appear only as locked "Coming later" cards (Brief §1). They would require a licensed partner and a separate service.
- **No payments routed through SplitSync's own merchant accounts.** The current PayPal Checkout demonstration has no payee and would settle into the platform's account if made live (`00-codebase-audit.md` §13.6a). It must either set the creditor as payee or remain sandbox-only. `11-payments.md` sets out the control.
- **No interest, fees or credit decisions on loans.** Loans are records of agreements between two people. SplitSync does not lend, does not charge, and does not decide creditworthiness. The trust score is informational and is never used to approve or refuse credit. Whether recording interest-free private loans engages consumer-credit legislation (for example Ireland's Consumer Credit Act 1995) depends on the facts and should be confirmed by legal review.

### 6.2 Data protection (GDPR)

The General Data Protection Regulation applies (Regulation (EU) 2016/679). The design adopts the following measures.

| GDPR provision | Design measure |
|---|---|
| Article 5(1)(c), data minimisation | Only the fields each space needs are stored. Payment details stay in the owner-only private profile (already implemented). |
| Article 9, special categories (for example health) | An aid reason is stored in a separate document readable only by the verifying administrator. Requesters are warned not to include unnecessary detail. |
| Article 17, erasure | The existing safe account deletion is extended to the `circles` database. Records that other members' balances depend on are retained in pseudonymised form, as today. |
| Article 20, portability | A "Download my data" export covering both databases |
| Article 25, data protection by design and by default | The default privacy settings are restrictive (requests from trusted people only); aid pledges can be anonymous; trust scores are visible only to shared-circle members |
| Article 32, security of processing | The controls in `12-security-and-threat-model.md` |

### 6.3 Positioning statement

> SplitSync is a coordination and record-keeping tool. It helps people who already pay one another directly to agree, record and remember what is owed. It never holds, moves or lends money, and it charges no interest.

## 7. Success criteria

| Criterion | Measure |
|---|---|
| No regression of the live product | The baseline of 1,487 tests stays green; coverage stays at or above 84 % lines throughout; no user-reported regression attributable to the extension |
| Money separation | Automated tests prove that a payment in one space never changes a balance in another, and that no view sums across spaces or currencies |
| Security | Every new rule and Function has negative tests. No high-severity finding is open at the Phase 9 review. |
| Usability | Each new flow passes a heuristic evaluation (Nielsen, 1994) and meets WCAG 2.2 AA (W3C, 2023) |
| Adoption (post-launch, measured with consent) | Circles created and completed; the proportion of contributions confirmed on time |
