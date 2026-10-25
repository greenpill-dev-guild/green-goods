# PRD-1299 voucher design lab, v2: handoff

**Status:** design direction approved by Afo on 25 October 2026. This file opens with the
build brief for PRD-1297. The sections after it are the reference the brief rests on, and the
history of each revision, from 22 to 25 October 2026, is at the end. Nothing here changes
contracts, production code, live configuration or Linear.

PRD-1299 owns design approval and PRD-1297 implements it. PRD-1323 and PRD-1324 own linked
rewards. Gui reviews the Portuguese copy (PRD-1312).

- **Open it:** [`voucher-lab.html`](voucher-lab.html) in any browser. Start with **Pilot design**
  in the left column: four written pages, then eight journeys.
- **Look up a state:** [`crosswalk.md`](crosswalk.md) maps every pilot screen and state to its
  source, recorded proof, gaps and future ideas. [`copy-sheet.md`](copy-sheet.md) has every
  string in English, Spanish and Portuguese.
- **See it rendered:** [`evidence/`](evidence/) holds labeled static-prototype screenshots.
- **Change it:** edit [`lab/`](lab/), then [rebuild and check](#rebuild-and-check).
- **Published:** the [Voucher Pilot Design](https://claude.ai/artifact/4JsufnSDH2uym3arusVpdE)
  (private) shows this revision beside the lab. It replaces an
  [earlier page of that name](https://claude.ai/artifact/12BURCmGX2Ddnzt7Uv4USC), whose version 6 shows the
  fourth pass and which the approving session could not open. The older
  [Voucher Lab](https://claude.ai/artifact/3pwUYy43vdb91q6qdH3H9G) shows the 22 October draft.

## Build this

The brief PRD-1297 builds from. Everything after it in this file is the reference it rests on.
Afo approved the direction on 25 October 2026 ([Decisions](#decisions)).

### Pilot scope

**Slice 1, built first: the two collective issuers.** Green Goods and Tech and Sun vouchers, the
ones the first downstream deployment creates.

| Journey | Screens and states |
|---|---|
| Earn vouchers, with optional G$ | `SReward` (Vouchers only, Vouchers + G$, every state); `SWallet` (Vouchers, Voucher open); `SIssuer` (Reserve short, Raise allowance); `SFunds` (Reward payout failed) |
| Redeem a voucher you hold | `SWallet` (Vouchers, booked); `SServices` (Browse, Loading, Empty); `SOffer`, `SPay` and `SRedeem` (Hub day, every state); `SIssuer` (Approve booking, Accept, Report visit) |
| Exchange, then redeem | `SOffer` (Claude access: Open, Not enough); `SExchange` (Tech and Sun to Green Goods, every state); `SPay` and `SRedeem` (Claude access) |
| Claude access that ends early | `SRedeem` (Claude access: Return proposed to Closed, Return failed); `SIssuer` (Propose return, Above terms, Transfer failed); `SWallet` (Vouchers, return pending) |
| When something goes wrong | Its steps on the screens above: signing not available, changed terms, a cancel race, a stale quote, a short pool, a holding limit, a short reserve, a failed transfer, a reported problem |

**Slice 2, after a member onboards: member issuers.** It can be built on fixtures earlier, but no
member's token exists until that member's onboarding. `SIssuers`, `SOnboard`, `SMyService`,
`SBrief`, `SServices` (Issuer paused, Delisted), and the member variants: `SOffer` and `SPay`
(Member lesson), `SRedeem` (Lesson), `SReward` (Member voucher), `SExchange` (Maya to Teo) and
`SIssuer` (Accept member booking).

**Out of the pilot build:**
- The personal G$ purchase, hidden from pilot members (decision 8): `SPurchase`, `SRequests`,
  `SFunds` (Check payment, Assign payment, Refund, Refund failed) and the G$ purchase kind of
  `SOffer` and `SPay`. Its design stays in the lab.
- The [left-out list](#what-the-design-follows): a G$ bridge, G$-to-voucher swaps, cash-out,
  mixed checkouts, timed approvals, automatic burns, a project token or team payout, self-service
  issuer setup, and treating a financial close as proof of delivery.
- Everything on the lab's Future ideas page.

### Locked picks

Only the lab's defaults ship. The dials compare patterns in the lab; they are not settings.

| Dial | Ships as |
|---|---|
| V1 Sheet steps | Strip: a bar per step, the current one dark, another person's dashed |
| V2 Progress | Phases: steps grouped into phases, each naming who acts |
| V3 Final split | Bar: the proportion as a bar, the exact figures under it, one checkbox |
| V4 Transfers | Rows: one row per transfer, each with its own pill |
| V5 Confirm | Dialog: the cockpit's confirm dialog with its checks and flow status |
| D1 Copy | Full: every answer with its line of detail |
| D2 Chain words | Details: chains, Safes and record numbers only under Transaction details |
| S1 to S5 | The design-system forks locked on 18 October: Plus Jakarta Sans, the linen ground, 24px cards over 16px rows, a 12px list gap, dark cards one step lighter. They are already the app's tokens, so there is nothing to build. |

### Surface by surface

Each piece extends a surface the app or the cockpit already ships, with that surface's own
components; none is a new page. The states are rows of [`crosswalk.md`](crosswalk.md), and the
copy prefixes are `lab/copy.json`'s ([Copy](#copy)).

**1. The promise page's Service Access section.** Client, slice 1; member variants in slice 2.
- **Extends** `GardenCommitment`, beside the contract branch's `ServiceAccessPanel`.
- **Adds** a section card like the page's others, its facts on `FactList` and `FactRow` (what you
  get, what you give, who holds it, who acts next, what can come back); the booking steps as
  phases (V2); the transfers as rows (V4); chain words under Transaction details (D2). Acts move
  to the page's one action bar, `CommitmentActionBar`: one primary, at most one secondary, and a
  short reason above when something outside the page blocks the act. A reader who can't act gets
  `JoinToAct`'s one sentence and one door under the status band. Delivery counts go in Progress
  and proof, booking events in History, and an early end shows "Ended early" (task 2).
- **States:** `SOffer` (Hub day, Claude access; Member lesson), `SRedeem`, `SReward`.
- **Copy:** `of.`, `rd.`, `rw.`, `pp.`, and `sh.` for the page's own words.
- **Calls:** `ServiceOffersLib` `requestClaim`; `VoucherRedemptionModule` `prepareVoucherSetup`;
  `GnosisVoucherEscrow` `presentSetup`, `finalizeActivation`, `finalizeAllocation` and
  `executeFinalLeg` (the holder's app runs activation and each transfer, with retries),
  `abortSetup` and `requestSetupAbort`; `TerminalLib` `raiseDispute`; `ConfirmLib` for Promise
  kept?. Shared reads and commands live in `modules/commitment-pooling/service-access-*.ts`.
- **Done when** every crosswalk state of these screens draws on the page with one status message;
  the section's facts are fact rows and its acts sit only in the action bar; "Kept" appears only
  after the member confirms, or after stewards resolve a dispute as kept.

**2. The sheets over the promise page.** Client, slice 1.
- **Extends** `ServiceConsentSheet` ("Review This Service"), the pilot's exchange review and the
  shipped `ConfirmSheet`.
- **Adds** the step strip (V1) at the top of the agree and deposit sheets, the final split as a
  bar with its figures (V3), each sheet's terms as a fact list, and "Your passkey asks you to
  approve. If there's a network fee, you see it first." A deposit may ask twice.
- **States:** `SPay` (all but the G$ kind), `SExchange`, and the split and Promise kept? steps of
  `SRedeem`.
- **Copy:** `pay.`, `ex.`, `rd.`.
- **Calls:** as above; the exchange is the pool's one bounded swap (`ICLCSwapPool`), quoted with
  its fees, minimum, deadline and recipient.
- **Done when** a changed term needs a fresh agreement and the sheet says what changed; an
  unknown exchange result blocks another paid exchange until it resolves; a failed exchange
  spends nothing; a swap books nothing.

**3. A request's rewards.** Client, slice 1; the member's voucher in slice 2.
- **Extends** the request's promise page, one item row per reward.
- **Adds** each reward on its own row with its own pill, one short detail and its own receipt;
  vouchers and G$ never wait on each other; a short reserve shows the reward waiting, not lost;
  Agreement unavailable while the source-network agreement stays operator-assisted.
- **States:** `SReward`. **Copy:** `rw.`.
- **Calls:** `VoucherEntitlementModule` `registerTerms` and `approveTerms` (operator-assisted
  today, `earned-consent-unavailable`); `GnosisVoucherAdapter` delivery, `retry` and `safeRetry`;
  the existing Celo payout plan for G$.
- **Done when** vouchers can be received while G$ is on the way, and a reward retried after a
  repair arrives once.

**4. The wallet's Vouchers tab.** Client, slice 1.
- **Extends** `WalletSheet`, with a third tab after Cookies and Tokens.
- **Adds** holdings on the item row with the amount in the right slot (DL-113), opening in place
  to book or exchange; a voucher a booking holds as its own row, which opens the booking
  (decision 11); a return on its way as its own pending row.
- **States:** `SWallet`. **Copy:** `wl.`, `u.`.
- **Calls:** balances per issuer token, the amount each booking's escrow holds, and pending
  returns. No read model exists yet (gap 12).
- **Done when** a booking at another garden opens from this tab whatever the active garden, and
  no amount is cut off.

**5. A garden's list of promises.** Client, slice 1 for the collective offers; the member rows
and the brief in slice 2.
- **Extends** `CommitmentRow` (DL-110) wherever a garden's promises are listed: the Promises sheet
  over the garden-scoped Home for that garden's members, with the season and campaign rail on
  top, and the garden page's Promises tab for visitors (decision 12). The lab draws the
  visitor's view.
- **Adds** an offer row whose detail says what booking takes first, then who promises it, and a
  campaign's brief note in its details sheet.
- **States:** `SServices`, `SBrief`. **Copy:** `sv.`, `br.`, `gp.`. **Calls:** reads only.
- **Done when** the same row draws in both lists, and Home gains nothing voucher-specific.

**6. The Promises console.** Admin, slice 1.
- **Extends** `GardenPoolTab`: `PoolClaimsCard` (Review Promises), `PoolCommitmentsCard` (Offers
  and Requests) and the rail beside Pool Status and Pool Funding.
- **Adds** voucher asks in Review Promises with 28px Decline… and Approve… or Accept…; their
  confirm dialog as `AdminConfirmDialog` (DL-117), with the consent, approval, deposit and
  deadline checks in its body, `PoolTarget` in the header for a pool write, a plain description
  for an escrow or reserve write, and the wallet note last in the body; service acts (Report
  Visit…, Propose Return…, Try Again) in the promise row's right slot; the issuer's Your Reserve
  card in the rail. Buttons are the shared `Button` (DL-119) and fields the shared controls
  (DL-116).
- **States:** `SIssuer`. `SRequests` and `SFunds` wait for the G$ purchase, except `SFunds`'
  Reward payout failed. **Copy:** `is.`, `ck.`, and `sh.` for the console's own words.
- **Calls:** `GnosisVoucherEscrow` `approveSetupAuthorization` (the issuer's Safe) and
  `authorizeReturn`; the pool steward's `acceptServiceClaim`, never the generic `acceptClaim`
  (gap 10); `GnosisVoucherAdapter` `retry` and `safeRetry`; the reserve's allowance.
- **Done when** an ask can't be accepted while a check fails, approving and accepting never share
  a word, and the Safe's signature count comes from the Safe, not from the copy.

**7. Service Assets in Profile, Account.** Client, slice 2.
- **Extends** `ServiceAssets`, which mounts `ServiceIssuerPanel`; the asset select stays.
- **Adds** the status band; the four capacity numbers and where the vouchers are, as fact lists;
  bookings as person rows (DL-112) with the act in the right slot; the member's acts by name over
  `ServiceIssuerAction`, keeping the exact review, the five-minute expiry and one pending
  transaction at a time; the signed draft approval (task 1).
- **States:** `SOnboard`, `SMyService`. **Copy:** `ob.`, `ms.`.
- **Calls:** `approveBooking`, `authorizeReturn`, `issue`, `approveReserve`, `configureReserve`.
- **Done when** the member approves the draft and each booking from their own account, and no
  steward act reads as approval.

**8. Voucher Issuers in Community, Coordination.** Admin, slice 2.
- **Extends** `VoucherIssuerOnboarding`, shown in the protocol garden.
- **Adds** draft, waiting, admitted and delisting states, and a fact list in its review dialog.
- **States:** `SIssuers`. **Copy:** `iss.`.
- **Calls:** the owner Safe drafts in `service-issuer-governance.ts` (`setIssuerAuthority`,
  `register`, `setLimitFor`, `setPriceIndexValue`), and delisting, whose mechanism PRD-1297
  picks.
- **Done when** copying a draft sends nothing and says so, and delisting keeps every holding,
  booking and obligation.

### Build order

1. **Merge `develop` into `feature/cosmo-local-contracts`.** The branch is 588 commits behind and
   lacks the fact list, the person row, the shared commitment row and the cockpit's shared
   controls (DL-109 to DL-119), which every surface above uses.
2. **Change the vault verb to Withdraw** (task 4) before a voucher's Redeem ships, in English and
   in the translations.
3. **Shared reads and fixtures:** holdings per issuer, each booking's escrow, pending returns,
   reward delivery, and each issuer Safe's threshold, each with a fixture. The DEV ledger
   (`service-access-pilot.ts`) and Storybook's `VoucherPilotJourney` already carry fictional
   journeys.
4. **Client surfaces 1 to 5, then the cockpit's surface 6,** against those fixtures.
5. **Wire to the deployment once it is adopted.** Until then the issuer and service routes are
   empty and Gnosis indexing is unbound.
6. **Slice 2** after a member onboards, on fixtures earlier if that helps.

Before the deployment is adopted, every surface, state and string can be built and reviewed on
fixtures and in Storybook, with the dialogs and their checks. Live routes and reads, the Safe
threshold read, real Gnosis signing and any end-to-end proof wait for it.

The Home redesign (`pwa-interface-simplification`) runs alongside. Its first slice brings the
active garden, the chip and the switcher; its second scopes the Promises sheet to the active
garden. Surface 5 follows that second slice, and until it lands a garden's offers stay where the
app lists them today.

### Tasks

Decisions to build:

1. **Signed draft approval** (decision 1, slice 2). The member signs their approval of the exact
   terms in the app, bound to the terms digest, and the issuer metadata references it.
2. **The Ended early close** (decision 2). After the holder approves the split, the stewards close
   the promise as canceled with the reason; the app shows "Ended early", never "Kept".
3. **The 7-day deadline default** (decision 3). Seven days from agreeing, set in the issuer's
   terms and shown as a date before the member agrees, in place of today's typed deadline.
4. **Withdraw for vaults** (decision 4), so Redeem belongs to vouchers alone in all three
   languages.
5. **Accept after the payment check** (decision 7), with the reason beside the disabled Accept.
   It ships with the G$ purchase, so it is not in this build (decision 8).
6. **The booking row in the wallet** (decision 11).
7. **Services wherever the garden's promises are listed** (decision 12), after the Home
   redesign's second slice.

Gaps the shipped surfaces exposed:

8. `ServiceAccessStatus` and `ServiceIssuerPanel` draw their own label and value pairs; use the
   fact list (DL-109).
9. `ServiceAccessPanel` sits under a top rule with an inline button group; make it a section card
   and move its acts into `CommitmentActionBar`.
10. The cockpit has no surface for voucher bookings, and Review Promises approves a claim through
    `acceptClaim` without the consent, approval, deposit and deadline checks. Add the voucher asks
    and accept through `acceptServiceClaim`.
11. The Voucher Issuers card shows only in the protocol garden, and only protocol stewards prepare
    from it. The pilot keeps that; a garden steward drafting from their own garden isn't built.
12. The wallet has no Vouchers tab or holdings read; members' own G$ for purchases elsewhere has no
    cockpit home (it comes with the G$ purchase); finding every service that takes a voucher you
    hold, across gardens, isn't designed.
13. Read each issuer Safe's threshold instead of writing it into copy. Tech and Sun's starts at one
    signature and moves to two.

### Copy

- `lab/copy.json` holds every string as `[EN, ES, PT]`; [`copy-sheet.md`](copy-sheet.md) lists
  them by screen prefix.
- Keys under `sh.` are the app's own strings from `develop`: use the app's keys rather than new
  ones. The rest map onto app namespaces that PRD-1297 chooses. Booking strings take `{issuer}`,
  `{issuerFull}`, `{unit}`, `{garden}`, `{inUnit}` and `{outUnit}`.
- Keys under `who.`, and every date, amount and address, are sample data, not strings.
- English ships first (decision 9). The app's locale test fails on any key missing from `es.json`
  or `pt.json`, so the Spanish and Portuguese drafts ship with the English, and Gui's review
  (PRD-1312) and a native Spanish speaker's replace them before those languages open to members.

### Styling

- Use the app's tokens and shared components. `lab/gg.css` is a sketch of them for the lab, not
  code to port.
- The cockpit pieces follow `develop` of 24 October: the shared `Button` and `IconButton`
  (DL-119), the shared fields and filter chip (DL-116, DL-122), and the dialog's shared header and
  action bar (DL-117).
- Two contrast gaps in shipped pieces belong to the design system, not this build: `PoolTarget`'s
  "Writing to" label measures 3.96:1 on the dialog surface, and the dark error alert 4.17:1 on
  the dark dialog surface. The lab uses one step more ink to hold AA ([design
  audit](design-audit.md#remaining)).

### Open items

| Item | Owner |
|---|---|
| Delisting's mechanism; the lab recommends a zero pool holding limit | PRD-1297 |
| Portuguese and Spanish review | Gui (PRD-1312); a native Spanish speaker |
| Each issuer's acceptance of the terms, its capacity and its addresses | The issuers, at onboarding |
| The downstream deployment, its owner packets and their adoption | The implementation lane |
| The Promises sheet scoped to the active garden | The Home redesign |
| The two shipped contrast gaps | The design system's owner |
| The hub spec's item 4 and the plan's PRD-1299 wording item still call the voucher wording undecided; the approved design's copy answers them | The hub's owner |

## Decisions

**Decided by Afo on 24 October:** ten that day, and two more that evening, once the Home redesign
was cleared to build. All but the tenth follow the lab's recommendation.

1. **The member's approval of a draft** is a signed approval in the app, bound to the terms
   digest, which the issuer metadata then references. Today the metadata carries an approval
   reference and digest that a steward prepares; PRD-1297 builds the signing and the record.
2. **Partial delivery's core outcome:** after the holder approves the split, the stewards close
   the promise as canceled with the reason, and the app shows it as "Ended early", never "Kept".
   The rehearsal leaves it in progress, so the close is new work.
3. **The acceptance deadline** defaults to seven days from agreeing, set in the issuer's terms and
   shown as a date before the member agrees. That leaves room for the issuer's two-business-day
   reply, the deposit and the stewards' acceptance. The app today asks the member to type one.
4. **The vault verb is Withdraw**, so **Redeem** belongs to vouchers alone in all three languages.
   Changing the vault strings is PRD-1297's work.
5. **G$ purchase disputes in the protocol pool:** Green Goods' stewards decide, under a seven-day
   response policy shown as policy.
6. **The refund fee:** the home garden's Safe keeps paying the refund transfer's token fee.
7. **Accept after the payment check** stays a cockpit rule for the pilot, with the reason beside
   the disabled Accept.
8. **Personal G$ purchases are hidden from pilot members.** The working terms don't offer them;
   the designed journey stays in the lab for later.
9. **English first.** The first cohort gets English; Spanish and Portuguese follow once native
   reviewers sign off.
10. **The working pilot services now.** The lab shows the real services before the issuers accept
    their terms, instead of waiting as it recommended. See
    [the working pilot terms](#the-working-pilot-terms-and-the-member-defaults).
11. **A booking at another garden is reached from the wallet.** The Home redesign shows only the
    member's active garden in the Promises sheet, so the wallet's Vouchers tab shows a voucher a
    booking holds as its own row, which opens the booking. The wallet is account-wide, so no
    sheet mixes gardens.
12. **Services show wherever a garden's promises are listed,** on the same rows: the Promises
    sheet over Home for its members, with the season and campaign rail on top, and the garden
    page for visitors. The lab draws the visitor's view.

**Settled from the spec and the contract branch:** who accepts a member's booking (the stewards,
after the member approves), the pilot's control model (the member's own account owns the token and
reserve and administers upgrades, accepted per member at onboarding), pool inventory (the member
deposits it from their reserve), who runs activation and the transfers after a split (the holder's
app; anyone can call), who prepares a member's draft (a protocol steward, in the Voucher Issuers
card), and a reward retry after a reserve or allowance repair (it reuses the same request through
the same budget, pause and replay guards, and the issuer's Safe may retry only one already
authorized). Afo ruled on 24 October that participant accounts and each issuer's accepted terms,
capacity and addresses are onboarding inputs, not blockers to implementation or deployment.
Placement is settled by the no-regression rule: each piece lives on the shipped surface the
contract branch extends.

**Approved on 25 October: the direction.** Afo approved the rebuilt screens, the eight journeys
and [Build this](#build-this).

**For PRD-1297 to choose:** delisting's mechanism. The lab recommends a zero pool holding limit,
prepared as an owner Safe draft beside the onboarding drafts, which keeps every balance.

## Live state and blockers

As the implementation lane recorded them in `handoffs/codex-live-pilot-deployment.md` on
`feature/cosmo-local-contracts` (last at `c2eafb2cc`, the evening of 24 October UTC) and in
`artifacts/member-issuer-local-proof-2026-10-24.json`. This revision read them on 25 October UTC
and reran nothing. The Hats upgrade and the Arbitrum source upgrade are live; no voucher, pool or
member-issuer transaction has been broadcast.

- **Done: the Arbitrum source upgrade.** The original 2-of-5 Safe's one batch executed (Safe nonce
  33, relayed), leaving Pooling and Settlement paused on their new implementations.
- **Next: the downstream deployment.** One operator command rehearses both chains, then sends 23
  deployments, the Hats observer registration and five transport fuel transfers. Two runs stopped
  before sending anything; both causes, verifier bugs, are fixed. Three owner packets follow: the
  Green Goods Safe's on Gnosis (14 calls) and on Arbitrum (8 calls), each two of five, and Tech and
  Sun's on Gnosis (5 calls).
- **Tech and Sun's Safe.** Its Gnosis Safe starts with one approved bootstrap signer and moves to
  two signatures once two source-verified steward owners exist, so the app reads the threshold
  rather than stating one (task 13).
- **Member tokens come later.** The downstream deployment creates the two collective issuers only.
  The member extension (milestones M2 to M4 and M7) is signed and rehearsed on owned forks with
  fictional members; the data, UI and signing proof (M5 and M6) and a member's deployment
  candidate and live readback (M8) are still open, and a real member's token goes live only after
  that member's onboarding.
- **Accounts.** The pilot cohort uses new patched passkey accounts that keep one new address on all
  three networks, with a member-owned connected wallet as fallback; keeping each member's original
  address was dropped on 23 October. The selected pilot account completed an authenticated,
  sponsored Gnosis proof. That proves one account, not every member issuer's signing.
- **Routes and data.** The app's issuer and service routes are empty and Gnosis indexing is unbound
  until the deployment is adopted, so every member-issuer screen here is a design, not a read.
- **Earned consent.** Agreeing to a voucher reward on the source network stays operator-assisted;
  approving a booking on Gnosis doesn't replace it. The lab's **Agreement unavailable** state shows
  it honestly.
- **Not blockers.** Participant accounts and each issuer's accepted terms, capacity and addresses
  are onboarding inputs. No real member has accepted terms yet, and the recommended defaults stay
  proposals until one does.

This design authorizes no deployment, broadcast, production auth activation or live financial
action, and claims no readiness.

## The journeys

| Journey | Steps | Screens | What it shows |
|---|---:|---|---|
| Earn vouchers, with optional G$ | 12 | `SReward`, `SFunds`, `SWallet`, `SIssuer` | A Request pays 2 Tech and Sun vouchers and 120 G$. Each reward arrives on its own, with its own receipt. A used-up allowance makes a vouchers-only reward wait until Tech and Sun raises it. |
| Redeem a voucher you hold | 15 | `SWallet`, `SOffer`, `SPay`, `SIssuer`, `SRedeem` | A Tech and Sun hub day for 1 voucher. Agree, Tech and Sun approves, deposit, Tech and Sun accepts within seven days; meanwhile the wallet shows the voucher the booking holds and opens the booking. Then the visit, the final split and the confirmation, each a separate approval. |
| Exchange, then redeem | 8 | `SOffer`, `SExchange`, `SPay`, `SRedeem` | Claude access takes 10 Green Goods vouchers; Lina exchanges Tech and Sun vouchers at 1:1 in the shared pool, seeing fees, minimum, deadline and recipient. The swap books nothing; the vouchers it returns are then redeemed. |
| Claude access that ends early | 8 | `SRedeem`, `SIssuer` | The seat stops after 12 of 30 days. Green Goods proposes a return by days of access, the holder approves one final split, and each transfer is tracked, and retried if it fails, on its own. |
| Offer your own service | 15 | `SIssuers`, `SOnboard`, `SServices`, `SMyService` | Kaya, a Green Goods steward, drafts Teo's lesson with him and Ade in the Voucher Issuers card; Teo approves the exact obligation in his Service Assets, from his own account; the Green Goods Safe registers and admits the token; Teo enables his reserve, approves each booking, proposes a return and pauses. Kaya delists Maya's coaching without touching holdings or bookings. |
| A project with three promises | 17 | `SBrief`, `SReward`, `SExchange`, `SOffer`, `SPay`, `SMyService`, `SIssuer`, `SRedeem` | One brief, three separate requests and rewards. Maya exchanges her own vouchers for Teo's, books the lesson, Teo approves, Ade accepts, half is delivered, and the split returns 0.5 each way. |
| Buy with your own G$ | 13 | `SOffer`, `SPay`, `SPurchase`, `SFunds`, `SRequests` | Lina's home-garden Safe holds the payment and its stewards check it. The provider accepts, the month runs, and Lina confirms it was kept before anyone is paid. Outside the working terms, with a fictional service. |
| When something goes wrong | 27 | All but `SWallet`, `SBrief` and `SIssuers` | Not a gardener, no result, changed terms, an unchecked payment, a decline, a failed refund, a dispute, signing not available, a cancel race, a stale quote, a short pool, a return above terms, an agreement that needs an operator, a changed draft, issuing beyond capacity, a pending transaction, a paused issuer, a holding limit, a delisting. |

Six before-and-after pairs, under **What changed from v1**, show what each pilot screen removes.

## What the design follows

- **Rewards.** Vouchers are the main reward, with G$ as an optional extra on Celo. A Request names
  the issuer, the entitlement and the quantity; the issuer may be a member. Voucher and G$
  deliveries keep separate statuses and receipts. Accepting a Request reserves no inventory, and
  another issuer's voucher needs its authorization and a finite allowance.
- **Member issuance.** A member's supported account owns the token and reserve and approves
  issuance, the service terms and every booking. A steward prepares and publishes; membership or
  stewardship alone mints nothing, spends no reserve and approves nothing. One bounded service per
  member issuer; repeated bookings use the same voucher. Deliverable capacity, issued units, usable
  reserve, finite allowance, accepted undelivered rewards, outstanding obligations and pool
  inventory stay separate, and returned vouchers restore no capacity.
- **Exchange.** One shared curated pool on Gnosis for garden and member tokens, with explicit rates,
  fees, inventory and holding caps, and no default 1:1 for members. Issuers keep their own tokens,
  reserves and obligations. A swap books nothing. Quotes can list routes, but only direct exchanges
  run.
- **Redemption.** Exact consent first, then issuer approval and an authenticated escrow deposit
  on Gnosis, then acceptance. Activation fixes the agreement; it is not delivery. Service evidence
  and the member's confirmation stay explicit. The holder approves one final split within the
  issuer's return limit, and each transfer has its own pending, arrived and failed states, with
  retry. A refund returns that issuer's voucher; it reverses no exchange and promises no G$.
- **Personal G$.** A member's own G$ goes to their home garden's Celo Safe, where a steward checks
  it arrived. It is an accounting earmark, not a lock. Consent, the payment check and the
  provider's acceptance stay separate steps. Each agreement uses one payment route, and refunds
  return the recorded deposit.
- **Left out:** a G$ bridge, G$-to-voucher swaps, cash-out or fiat payouts, mixed checkouts,
  timed approvals, automatic burns, a project token or team payout, self-service issuer setup,
  and treating a financial close as proof of delivery.

## Corrected states

| Before | Now |
|---|---|
| One passkey approval and sponsored fees | "Your passkey asks you to approve. If there's a network fee, you see it first." A deposit may ask twice: allow, then deposit. |
| "Back in your account right away" | A return shows as pending until its transfer arrives. A failed one says so and can be retried, for the same amount only. |
| A provider remedy that moves value | The issuer can **Propose Return**: a limit within its terms. Nothing moves until the holder approves a split. |
| "Kept" for reports and payouts | **Kept** appears only after the member confirms, or after stewards resolve a dispute as kept. "Tech and Sun reported the hub day", "Ready to confirm" and "The payout is running" are separate states. |
| Topping up a changed price | Changed terms need a fresh agreement. A G$ payment made under the old terms is refunded and the new price paid in full. A voucher booking is canceled and booked again. |
| Cancel "any time before service starts" | Cancel before the issuer or provider accepts. If acceptance lands first, the screen says so and offers a return request or a problem report. |
| A dispute that pauses every payment | A disputed G$ purchase can't start a new payout or refund until the stewards decide. Escrowed vouchers stay where they are; only the holder's approved split moves them. |
| Steward authority over a holder's vouchers | Stewards resolve the promise. They can't change the holder's voucher split. |
| Redeem on the spot | Removed. Immediate services use the same consent, acceptance and delivery steps. A bounded on-the-spot receipt is a future idea. |
| Automatic completion after seven days | Removed. Suggested response times are labeled as policy, not enforced. |
| A steward approving or issuing for a member | The member approves the draft and every booking from their own account. The cockpit can prepare, remind and publish; its drafts send nothing and are no member signature. |
| A token balance as capacity | Lessons promised, booked, delivered and left are shown apart from where the vouchers are. The app's "services owed: unknown" stays true until a projection exists. |
| A return that undoes an exchange or restores capacity | The settled lesson says the earlier exchange isn't reversed and the issuer's capacity isn't restored. |
| Delisting that erases | Delisting stops new exchanges only; holders keep their vouchers and terms, accepted bookings go ahead, and the member's remaining obligations stay recorded. |

The 23 October pass also cut repeated notices to one status message per page, put each blocking
reason next to the action it blocks, kept issuer names and amounts whole on a phone, kept numbers
on the same line as their units, removed the progress bar from canceled bookings, and stopped
cockpit pages above the dock.

## The lab's dials

The dials are lab tooling, not pilot behavior: every option draws the same implemented flow with
a different pattern or wording. The defaults are the pilot's picks, marked with a dot. Picks save
in the reviewer's browser, go into any note saved from the panel, and "Copy picks" puts them on
the clipboard as one line. A dial shows only on screens it changes.

| Dial | Options (pilot's pick first) | Screens |
|---|---|---|
| V1 Sheet steps | Strip, list, counter | Review sheet, voucher booking sheets, the service approval sheet |
| V2 Progress | Phases, flat, summary | Voucher booking, G$ purchase, service setup |
| V3 Final split | Bar, two steps, figures | Voucher booking |
| V4 Transfers | Rows, bar, in the band | Voucher booking |
| V5 Confirm | Dialog, in the row | The Promises console (issuer, provider and home-garden views) and the Voucher Issuers card |
| D1 Copy | Full, compact, minimal | Every pilot screen; minimal keeps three facts on an offer (get, give, back) |
| D2 Chain words | Details, one line, none | Voucher booking, G$ purchase |
| S1 to S5 Design system | Typeface, ground, cards, list gap, dark cards | Every pilot screen; defaults are the forks locked on 18 October |

The panel fits a viewer window: controls hold without scrolling at desktop sizes, the step list is
a strip of dots, the narration sits in a fixed band under the screen, and notes fold away. Cockpit
steps show a readable crop of the dialog or card in play at the phone frame's height, with a
thumbnail of the whole screen and a "Whole screen" toggle. Below 860px wide the screen stays pinned
above the controls.

## The working pilot terms and the member defaults

The collective terms (`pilot-issuer-terms.md`, draft 3) name Tech and Sun hub days, Green Goods
assisted sessions and Claude access; the release owner accepted their prices, a twenty-voucher
ceiling per issuer, ten participants and a 1:1 pool ratio on 22 October. Each issuer accepts the
terms, and confirms its capacity and addresses, at onboarding; on 24 October Afo ruled those
onboarding inputs rather than blockers and chose to show the services now. So the lab's voucher
services, issuers and prices are these working terms, still to be accepted.

The member-issuer amendment adds recommended starting points for a member's service, requested on
23 October Pacific. The lab carries them in the onboarding draft **as proposals the member approves
or changes**, never as accepted terms:

| Setting | Shown in the draft | From the recommendation |
|---|---|---|
| Service unit | One voucher buys one 60-minute lesson | One voucher, one published standard unit, with scope, booking window, evidence and remedy |
| Capacity | 6 lessons over the next 4 weeks | At most six units per new member, less when confirmed capacity is lower |
| Issuance and inventory | 6 vouchers: 2 to the shared pool, 4 in reserve | Two in the pool, four in reserve, scaled down with issuance |
| Reward allowance | 1 at a time, raised by the member | At most one unit per reviewed tranche, never more than usable reserve and uncommitted capacity |
| Rate and fees | 1 Teo voucher = 2 Maya vouchers; 0 pool fee proposed | A price index agreed per offer, zero configurable pool fee, the protocol fee read separately |
| Pool limit | 6 | A holding ceiling no higher than total initial issuance |
| Control | The member's account owns the token, holds the reserve, approves bookings and administers upgrades directly | The simple control model, when the member accepts it; recovery recorded separately |
| Booking reply and remedies | 2 business days; returns by minutes delivered | Policy, not enforced; partial-delivery arithmetic agreed before booking |

The fictional project fixture (`pilot-issuer-terms.md`, fictional rehearsal parameters) sets the
numbers the project journey uses: six vouchers per member, two in the pool and four in reserve,
price indices of one and two, zero fees, a two-for-one exchange, a 60-minute lesson with 30 minutes
delivered, and final balances of 3.5 in the engineer's reserve, 1 in the pool, 1 with the designer
and 0.5 with the analyst.

## Discrepancies recorded, not redesigned

Where the lab and the implementation differ, the lab records it instead of changing either side.

1. **Member approval of a draft.** The implementation carries a member's acceptance as an approval
   reference and digest inside reviewed issuer metadata that a steward prepares. The lab's
   `SOnboard` review sheet collects that approval in the app, from the member's account. Afo decided
   on 24 October that it becomes a signed approval bound to the terms digest, which the metadata
   references (decision 1).
2. **Issuer actions as tasks.** The Client's issuer panel exposes a raw action select (issue,
   approve or revoke reserve spending, enable or disable the reserve, approve or revoke exchange
   spending, exchange). The lab wraps the same calls as the member's tasks: approve a booking,
   propose a return, issue more, approve more for rewards, pause. The exact review sheet, the
   five-minute expiry and one pending transaction at a time are kept.
3. **Capacity numbers.** The app says total services owed are unknown, because token balances
   don't establish them. The lab's four numbers come from the issuer's own terms and the verified
   bookings, labeled as such; a projection would have to carry them.
4. **Core acceptance of a member's booking.** Settled: the spec keeps steward-controlled
   acceptance for the assisted pilot and requires the member's approval first. The lab shows Teo
   approving and Ade accepting as the pool's steward.
5. **Pause, delist and pool inventory.** Pausing is the member's reserve disabled plus no new
   approvals; delisting is a registry or limiter change for the owner Safe. Placing initial
   inventory is the member's own deposit from their reserve, as the rehearsal does. Pausing and
   delisting have no Shared action or draft today; the lab shows their consequences and labels the
   gap in the crosswalk.
6. **Discovery.** A member's service shows as an offer wherever its garden's promises are listed
   (decision 12). Today's Profile select over issuer assets stays for the member's own assets.
   Finding every service that takes a voucher you hold, across gardens, is not designed.
7. **Shipped-surface gaps.** Tasks 8 to 12 under [Build this](#tasks).

## Copy and text owners

- English is the approved design's copy, and the first cohort gets English (decision 9). Portuguese awaits
  Gui's review (PRD-1312), and Spanish awaits a native speaker. The [copy sheet](copy-sheet.md)
  marks both. The app's locale test needs every key in all three catalogs, so the drafts ship with
  the English and reviewed text replaces them ([Copy](#copy)). The 24 October keys include
  Portuguese forms with and without the article before a person's name ("vales do Teo", "vales da
  Maya"), which Gui should confirm.
- **Redeem** is the voucher verb and **Withdraw** the vault verb, decided on 24 October.
  Production vault strings are unchanged until PRD-1297 updates them (task 4), and until then the
  vault's English, Spanish and Portuguese strings say Redeem too.
- `develop`'s copy of the hub spec still says "Redeem" keeps its vault meaning, at its line 47.
  The accepted spec on `feature/cosmo-local-contracts` no longer says so, so the line goes when
  that branch's hub reaches `develop`.
- The contract branch's brief keeps a member's G$ in the buyer garden's Safe. The design follows
  that rule, so v2's earlier request to change it is withdrawn.

## Evidence

Four classes, kept apart. Each rendered frame names its engine and session, as AGENTS.md asks:
the lab's frames are **static prototype, headless Chromium (Playwright's bundled build), a local
Claude Code session with no app session**, and the shipped references are **Storybook, deployed
build, headless Chromium, a local Claude Code session**. None of them is authenticated or
mock-auth proof, and none proves signing.

**Shipped reference: deployed Storybook** (`design.greengoods.app`). Recaptured on 25 October UTC,
the evening of 24 October Pacific, for `evidence/shipped-vs-lab.png` and
`evidence/cockpit-dialog.png`: the promise page, the garden's Promises tab, the wallet's jar row,
the cockpit's Promises console, and two cockpit dialogs (`AdminDialog`'s confirm with details, and
the commitment Mark Ready dialog). The deployed build now carries the DL-110 promise row and the
cockpit's DL-115 to DL-119 controls. The first captures, of 24 October before those merged, are in
the second pass's comparison.

**Static prototype: this lab, run during this revision.**

| Command or check | Observed result |
|---|---|
| `node build.mjs`, fifth pass | Wrote `voucher-lab.html`, `copy-sheet.md` (1,535 keys) and `crosswalk.md` (46 rows). The build now also refuses a shell that isn't a complete document: a doctype, the `html` element and a viewport meta. |
| `node check.mjs`, fifth pass | The check now loads the built page as it is, with no wrapper, and also asserts standards mode and the viewport meta, and walks the contents drawer at 1024 × 768 and 390 × 844: closed, it is inert and hidden; open, focus sits inside it and the page behind it is inert; Escape hands focus back to Contents. The first run failed: seven states still used a removed key (Tech and Sun's signature count), the dial self-test failed with them, the new target line's ellipsis counted as clipped text, the "Writing to" label measured 3.96:1, and the dark dialog surface, lifted to the shipped step, pulled four dark notices to between 4.17 and 4.27:1. After the fixes it passed: 1,707 pilot renders (every state of the fifteen pilot screens in English, Spanish and Portuguese, and every state in dark) and 719 dial settings, with no clipped or overflowing text, a name on every control, no focus behind an open dialog, every icon present and AA contrast. |
| Visual review, fifth pass | The redrawn Accept dialog beside a shipped dialog from the deployed Storybook, which Afo approved before the rollout; then every changed cockpit state in English light and dark and in Portuguese dark, the in-row confirm, and the wallet's booked state at 2× in English, Portuguese and dark. It found two slips, both fixed: the Owner Safe drafts dialog said its signature count twice once the note moved into the body, and the wider outlined Cancel pushed the in-row confirm's button onto a second line. |
| Keyboard walk, fifth pass | Tab through five changed surfaces: Tech and Sun's Accept dialog, the dispute dialog, the Owner Safe drafts dialog, the wallet's booked state and the console with the in-row confirm. Thirty-seven stops, every one visible, named, with a focus ring, and inside the open dialog where there was one. |
| `node build.mjs` | Wrote `voucher-lab.html`, `copy-sheet.md` (1,531 keys) and `crosswalk.md` (46 rows). The build refuses a missing language, an em dash or placeholders that differ between languages. |
| `node check.mjs` | Passed on 24 October after the second pass. The self-test passed, including every dial option on each screen it applies to and the unfilled-placeholder rule. Twenty-one views fit at 1440 × 900, 1280 × 720, 1024 × 768 and 390 × 844 with no sideways scroll, and at the three desktop sizes the side panel held its controls without scrolling. All 1,687 pilot renders (every state of the fifteen pilot screens in English, Spanish and Portuguese, every state in dark, and 703 dial settings) showed no clipped or overflowing text, a name on every control, no focus behind an open dialog, every icon present, and AA contrast. The clipping rule now exempts only the item row's one-line title and detail line, whose ellipsis is the shipped design (DL-102). The first run of the second pass failed on long reward details, the cycle rail at phone width, one Spanish pill and one dark contrast; each was fixed and the rerun passed. It passed again, with the same counts, after the docs pass removed the first pass's unused kit rules and rewrote the lab's decisions page. After the third pass it passed on the first run and on both reruns that followed the visual-review fixes: 1,703 renders and 719 dial settings, now that the console's Report visit and Transfer failed states are in the dial sweep. In the fourth pass it passed three times with the same counts: after the live-state corrections, after the two decisions, and after the peer-help note's margin fix. |
| Decisions page | Rendered at 1440 × 900 and 390 × 844 after the fourth pass: ten sections, the ten decisions and five gaps as numbered lists, code spans styled, no sideways scroll or overflowing text, no page errors. Run from a scratch script. |
| Visual review, fourth pass | The 33 frames rendered for the published page, at 2× for the member app and 1× for the cockpit. It found one slip, fixed: the campaign's peer-help note without side margins. |
| Published page | The summary page at 1280 × 900 in light and 390 × 844 in dark: no sideways scroll, no load errors, both typefaces loaded, every image present. The wrapped lab at 1440 × 900 and 390 × 844: standards mode, the link back, no page errors. Both before publishing, from scratch scripts. |
| Repository checks | `node scripts/harness/plan-hub.mjs validate` validated 32 hubs. `bun run check -- --intent qa` selected `format` and `lint` for the changed paths; both passed, 2 fresh and 0 reused. |
| Visual review, third pass | Every regenerated frame in English, the Green Goods console in Portuguese dark, and the Voucher Issuers card at full size. It found six slips, all fixed: "deposit the vouchers" for a single voucher, "Green Goods's", voucher amounts printed as "8.00", "1 cumpridas" in the Portuguese season line, a booking deadline still explained as the holder's choice, and issuer names wrapping onto three lines. |
| Keyboard walk, third pass | Tab through eleven restyled surfaces: the hub day and Claude access offers, the hub day's Promise kept? sheet, the Claude access split, the exchange, the Promises tab, the Vouchers tab with a holding open, the approval sheet, Tech and Sun's accept dialog, Green Goods' return dialog, and the draft dialog. Forty-six stops, every one visible, named, with a focus ring, and inside the open sheet or dialog; no problems. |
| Visual review, second pass | Every rebuilt surface beside its Storybook reference, then each screen's main states in English, with Spanish, Portuguese and dark samples, and the cockpit at full size. |
| Keyboard walk | Second pass: Tab through ten rebuilt surfaces (the promise page open and blocked, the Promise kept? sheet, the Promises tab, the Vouchers tab with a holding open, Service Assets and its approval sheet, the issuer's accept dialog, the provider console, the owner Safe drafts dialog). Fifty-seven stops, every one visible, named, with a focus ring, and inside the open sheet or dialog where there was one. The 23 October walk of the lab panel (seventy stops) still holds. Run from a scratch script that isn't part of the lab. |
| Visual review, first pass | Every state of the five new screens and of the member variants of the six changed screens in English at native size, with Spanish, Portuguese and dark samples, the cockpit pages at full size, and the lab at 1440 × 900, 1280 × 720 and 390 × 844 on both new journeys. The fixes it found (a booking sheet's checkbox label, the capacity line when issuing more, a person named as "it") are in this revision. |

**Recorded implementation proof, not rerun here.** The crosswalk's proof column cites the
contract tests, pinned forks, component tests and Storybook rehearsal recorded in the implementation
handoffs at `c40697f6e`, and, for the member-issuer rows, the proof of 24 October UTC
(`artifacts/member-issuer-local-proof-2026-10-24.json`): 21 cases in the owning Gnosis suite on
owned Arbitrum and Gnosis forks with fictional accounts and manually relayed transport, 108
planner and read-back cases, 37 CLI checks, Shared 115, Client 24 and Admin 13 focused tests, and a
Storybook rehearsal in Brave with fictional member balances, an exact booking review and owner Safe
preparation. The same record says no live deployment, no live issuer approval, no confirmed
capacity and no live cross-chain delivery.

**Account proof.** The deployment handoff records that the selected pilot account completed an
authenticated Brave passkey flow and a sponsored Gnosis proof, independently checked against chain
state on 23 October at 23:48 UTC. It proves that one account can sign; it proves nothing about any
member issuer's possession, terms, issuance or approvals.

**Product and authenticated proof: none.** This revision compared the lab with the deployed
Storybook again, and ran no comparison with the running app, no Storybook build of these designs,
and no screen reader. The [design audit](design-audit.md#remaining) lists what is still unchecked.

## Rebuild and check

Run from the lab folder, or give either script's full path. `check.mjs` uses the repository's
`@playwright/test`; set `CHROMIUM_PATH` to use another Chromium build. It loads the built page as a
reviewer opens it, and takes a few minutes.

```sh
cd .plans/backlog/cosmo-local-credit-interop/artifacts/prd-1299-voucher-ui/v2/lab
node build.mjs   # writes ../voucher-lab.html, ../copy-sheet.md and ../crosswalk.md
node check.mjs   # self-test, standards mode, fit, the contents drawer, text, names and focus, icons, contrast, dials
```

| File | Holds |
|---|---|
| `shell.html` | The lab page and runtime, a complete standards document: all lab text (journeys, pairs and written pages), and the dials (`TWEAKS`). A screen link can carry the target's props as a query (`SOffer.dc.html?kind=Hub%20day`). |
| `gg.css` | The screen kit. The shipped pieces the pilot screens draw follow "Shipped components (develop, 24 Oct)": the card, the item row and the promise row on it, the status pill, the fact list, the promise page's band, sections and action bar, the empty state, the field, the Promises tab and the Promises console. The cockpit's controls follow "Shipped cockpit controls (develop, 24 Oct, evening)": buttons, dialogs, fields, the filter chip and the search pill, on the pilot cockpit screens only. Earlier layers follow "Design-system alignment (v2 audit)", "Cockpit alignment", "Pilot design additions", "Lab dials" and "Member issuers". v1's reference screens use them, and the member screens still draw buttons and sheets from them. |
| `screens/*.dc.html` | 35 screens: the fifteen `S*` pilot screens, and v1's twenty kept for reference. Each pilot screen draws the shipped surface it extends, reads the dials from its props and carries them as data attributes on its root. Screens that name an issuer wrap the copy function with the issuer's name and unit. |
| `copy.json` | Every pilot string as `[EN, ES, PT]`. Keys under `sh.` are the app's own strings from `develop`, copied in its three languages; keep them in step with the app. Booking strings use `{issuer}`, `{issuerFull}`, `{unit}`, `{garden}`, `{inUnit}` and `{outUnit}`. |
| `crosswalk.json` | The screen and state crosswalk. |
| `remix-sprite.svg` | 83 Remix Icon 4.9.0 glyphs from the npm package. Icons by Remix Icon (https://remixicon.com), licensed under the Remix Icon License v1.0. |

These files are design artifacts. Code, tests and CI must not depend on them.

## History

Each revision of this design, newest first. Where an earlier pass describes a screen's first form,
a later pass gives its current one, and [Build this](#build-this) is the current brief.

### What changed on 25 October: approval and the published page

Afo confirmed the build brief is clear and approved the direction. This file, the lab's header and
its Decisions and gaps page, the copy sheet and the artifact README now say so. Version 6 of the
published page could not be opened from this session, so at Afo's choice the summary page was
rebuilt for the fifth pass and published as a new artifact, [Voucher Pilot Design](https://claude.ai/artifact/4JsufnSDH2uym3arusVpdE),
with its 31 screen frames rendered again from this lab and the two comparison images from
`evidence/`.

CodeRabbit's review of the fifth pass found that a paused issuer's row in `SServices` opened the
member offer as open. The row now opens the offer's Paused state, where booking is disabled.

### What changed on 24 October, fifth pass: the build brief

Afo reviewed version 6 and asked for a design PRD-1297 can build from one short brief. This pass:

- **Wrote [Build this](#build-this)** at the top of this file, in place of the old "Handoff for
  PRD-1297, PRD-1323 and PRD-1324" section, and moved the pass history here.
- **Redrew the cockpit on `develop` of 24 October.** That afternoon DL-115 to DL-119 put the
  cockpit's buttons, fields, filter chip and dialogs on the shared family. The four pilot cockpit
  screens now draw them: the dialog's shared header with no rule under it (the 22px title, the
  target line for a pool write, Close on the title's line), the white action bar with Cancel
  outlined and the confirm filled, the wallet note last in the body, pill buttons with neutral
  outlined labels, 28px acts in Review Promises, outlined white fields and the shared filter chip.
  The protocol pool's warning moved into the dialog's header, where `PoolTarget` puts it. Afo
  approved one dialog, Tech and Sun's Accept, before the rest changed. v1's reference desks keep
  their older look.
- **Placed bookings and services beside the Home redesign.** The PWA Home redesign, cleared to
  build on 24 October, scopes the Promises sheet to the member's active garden. Afo decided that a
  booking at another garden is reached from the wallet (decision 11): the Vouchers tab gains a row
  for a voucher a booking holds, which opens the booking, and "Redeem a voucher you hold" gains
  that step. A garden's services show wherever its promises are listed (decision 12).
- **Brought the record up to the evening of 24 October.** The Arbitrum source upgrade executed.
  The downstream deployment is prepared and not sent, and it creates the two collective issuers
  only. Tech and Sun's Gnosis Safe starts with one bootstrap signer, so the lab no longer says
  "2 of 3" anywhere, and the issuer copy takes the signature count as a whole phrase.
- **Closed seven crosswalk gaps** that the decisions or the spec had already settled, pinned the
  member-issuer sources to `6327e48cb`, and fixed decision 10's broken link and the stale note
  about the spec's line 47.
- **Changed "1 books one hub day"** and its siblings to "1 voucher per hub day", Afo's pick.
- **Fixed the lab's own code** from the bot review of
  [PR #1186](https://github.com/greenpill-dev-guild/green-goods/pull/1186): the build emits a
  complete standards document and the check loads it as built; below 1200px the contents drawer
  is inert while closed and holds focus while open; screen links carry their record, so a link
  followed outside a journey opens that service rather than a default; the feedback migration
  clears only what reached the shared store; and both scripts decode their own paths.
- **Found two contrast gaps in shipped pieces**, recorded in the [design
  audit](design-audit.md#remaining).

### What changed on 24 October, fourth pass: the live record and the published page

Afo found the published page still asking settled questions and listing blockers the
implementation lane had cleared. This pass brought the lab and these docs up to that lane's record
of 08:37 UTC on 24 October, then published the revision.

- **Live state.** The lab's decisions page, the crosswalk and
  [Live state and blockers](#live-state-and-blockers) now follow that record. Of the 23 October
  blockers, the new passkey accounts replaced the same-address rule, Gnosis signing is proven for
  the selected pilot account, issuer acceptance became an onboarding input, and Gnosis routes and
  data wait on the deployment. The Arbitrum source upgrade is next.
- **Settled.** The reward retry after a repair, and Afo's ruling that onboarding inputs don't block
  implementation or deployment, joined the settled list.
- **Two decisions.** The last two questions on the 23 October page: personal G$ purchases are
  hidden from pilot members, and the first cohort gets English (decisions 8 and 9).
- **One fix.** The campaign's peer-help note (`SBrief`, One kept) sat flush against the screen
  edges, because the note rule's margin shorthand overrode its gutter class. The rule now sets only
  the top and bottom margins, and `evidence/discovery-and-project.png` was composed again to match.
- **Published.** The summary page was rewritten from this handoff: the ten decisions, the six
  settled items, the one open call, the live state, 32 static-prototype renders and the shipped
  comparison. The lab beside it is `voucher-lab.html` wrapped as a full page, with a link back.

### What changed on 24 October, third pass: decisions and the working pilot services

**Decisions.** Afo settled the open questions, the last two (the G$ purchase's visibility and the
first cohort's languages) in the fourth pass; they are listed under [Decisions](#decisions).
Three now show in the screens: the member's approval sheet says approving signs the exact terms
and adds "Recorded as: your signed approval of these terms"; the draft terms carry "Acceptance
deadline: 7 days from agreeing"; and every booking's deadline sits seven days after agreeing.

**The working pilot services.** Each fictional service became the real one it stood for, with the
prices, ceilings and partial-delivery rules of `pilot-issuer-terms.md` (draft 3):

| Journey | Before | Now |
|---|---|---|
| Redeem a voucher you hold | Sunroot's 60-minute solar session for 10 vouchers | Tech and Sun's hub day for 1 voucher: one named person's visit of up to four hours, with workspace, power and connectivity |
| Exchange, then redeem | 163.6 Hilltop vouchers for 80 Sunroot vouchers at 2:1, for a 100-voucher course | 8.01 Tech and Sun vouchers for 8 Green Goods vouchers at the accepted 1:1, for Claude access at 10 |
| Claude access that ends early (was "A course that ends early") | 3 of 10 lessons; 40 to Sunroot, 60 back | 12 of 30 days; 4 to Green Goods, 6 back, proposed by Kaya |
| Earn vouchers | 20 Sunroot vouchers and 120 G$ | 2 Tech and Sun vouchers and 120 G$ |
| A project with three promises | Sunroot's impact website | Tech and Sun's impact website, the terms' rehearsal brief |

- **Issuers.** A hub day is Tech and Sun's, whose Safe signs 2 of 3; Claude access and assisted
  sessions are Green Goods', whose Safe signs 2 of 5. The issuer console now follows the service:
  Ade acts in Tech and Sun's, Kaya in Green Goods'. Voucher Issuers lists both collective issuers.
- **Numbers from the terms.** 20 vouchers per issuer, 10 in the pool and 10 in reserve, at most 10
  per participant, returns by usable minutes out of 240 or available days out of 30, and bookings
  agreed on 26 October, inside the booking window of 25 October to 30 November.
- **Not invented.** Tech and Sun's banner says its address is shared before booking, with no
  founding date, because the lab doesn't know them. Seat counts, reserve balances and the 0.01
  protocol fee are illustrative.
- **Kept fictional:** the people, Riverside Commons and Hilltop Orchard, Teo's and Maya's services
  and the project fixture, and the G$ purchase, which the working terms don't offer; its journey
  now says so.
- **In the lab panel** the kinds read **Hub day** and **Claude access**, and the console's "Report
  lesson" state is **Report visit**. Two weekday slips are gone: a session on 30 October was called
  a Thursday and a lesson on 4 November a Tuesday.

### What changed on 24 October, second pass: built on the shipped surfaces

**The regression.** The lab's pilot screens drew their own pages: an offer page in place of the
promise page, a services list in place of the garden's Promises tab, a wallet with its own rows and
a Purchases tab, and cockpit cards in place of the Promises console. Their rows, facts, empty
states and fields predated the unification that landed on `develop` this week (the item row DL-102,
the fact row DL-109, the promise row DL-110, the empty state DL-106, the field DL-105, records on
the item row DL-111 and DL-113, the person row DL-112). Built as drawn, they would have replaced the
promise page's status band, its "What was promised" facts, Team, Progress and History, and the
console's Review Promises, Pool Status and Pool Funding.

**The fix.** Every pilot screen now extends the surface it belongs to, drawn with that surface's
components under their shipped names and values (the kit's "Shipped components" block in
`gg.css`), and placed where the contract branch puts the feature. Words that already exist in the
app come from its own strings in all three languages: 125 `sh.` keys in `copy.json`, and four
more under their screens' prefixes.

| Lab screen | Now extends | What the lab still adds |
|---|---|---|
| `SOffer`, `SRedeem`, `SPurchase`, `SReward` | The promise page (`GardenCommitment`): title, season and garden, status band, What was promised, Progress and proof, History, the one action bar | A **Service Access** section where the contract branch mounts `ServiceAccessPanel`: what you get and give, who holds it, who acts next, the booking steps, the transfers. A request's rewards as item rows. "Ended early" as a presented outcome. |
| `SPay`, `SExchange` | Sheets over the promise page, as `ServiceConsentSheet` and the pilot's exchange review are | The step strip (dial V1) |
| `SServices` | The garden's Promises tab (`GardenPool`): banner, tabs, cycle rail, live count and filters, promise rows | Each service is an offer row whose detail says what booking takes first, then who promises it |
| `SBrief` | The same tab with the campaign selected in the cycle rail, and its details sheet | The brief's note on the campaign |
| `SWallet` | The wallet sheet (Cookies, Tokens) | A third **Vouchers** tab of item rows with amounts (DL-113) that open in place. The Purchases tab is gone: bookings and purchases are promises. |
| `SOnboard`, `SMyService` | Profile, Account tab, **Service Assets** section (where the contract branch mounts `ServiceAssets`) | The status band, the capacity and voucher fact lists, bookings as person rows, the member's acts named and inline |
| `SIssuer`, `SRequests`, `SFunds` | The garden's Promises console (DL-077): What needs you, seasons and campaigns, Offers and Requests, Review Promises, Pool Status, Pool Funding | Voucher asks in Review Promises with checks in the confirm dialog; service acts on the promise row; an issuer's **Your Reserve** card and a home garden's **Members' Payments** card in the rail |
| `SIssuers` | Community, Coordination, the protocol garden's pooling rail, and its **Voucher Issuers** card (`VoucherIssuerOnboarding`) | Draft, waiting, admitted and delisting states on that card |

[`evidence/shipped-vs-lab.png`](evidence/shipped-vs-lab.png) puts the shipped surfaces (deployed
Storybook) beside the rebuilt lab (static prototype).

**Gaps this exposed in the implementation**, for PRD-1297, not redesigned here:

1. `ServiceAccessStatus` and `ServiceIssuerPanel` draw their own label and value pairs. The shipped
   pattern is the fact list (DL-109).
2. `ServiceAccessPanel` sits under a top rule and puts its acts in an inline button group. Its
   siblings on the promise page are section cards, and the page's acts belong in its one action
   bar (`CommitmentActionBar`).
3. The cockpit has no surface for voucher bookings. Review Promises lists claims, and approving one
   calls `acceptClaim` without the consent, approval, deposit and deadline checks the lab shows.
4. The Voucher Issuers card appears only for the protocol garden and only protocol stewards can
   prepare from it. The lab follows that: Kaya, a Green Goods steward, prepares Teo's draft, and
   Ade, Teo's garden steward, helps define the terms. A garden steward drafting from their own
   garden is not built.
5. The wallet has no Vouchers tab, members' own G$ for purchases elsewhere has no cockpit home, and
   finding every service that takes a voucher you hold is not designed.

### What the contract branch settled since the last revision

Read on 24 October from `feature/cosmo-local-contracts` (last commit `30fbaafe2`) and the hub's
records. The four commits after `6327e48cb` change deployment tooling only, not the app.

- **Stewards accept a member's booking after the member approves it.** The spec keeps
  steward-controlled acceptance for the assisted pilot and requires the member's exact approval
  first (onboarding step 5). The lab already showed this.
- **The member's own account controls the token.** The rehearsal initializes the member's token
  with the member's account as owner, reserve and factory administrator, and the metadata validator
  requires a member-kind upgrade control whose administrator is the owner. No member Safe or
  timelock. Each real member still accepts this at onboarding.
- **The member places their own pool inventory** from their reserve: six issued, two deposited in
  the pool, four kept.
- **The holder's app runs the follow-up calls**: activation after acceptance and each transfer after
  the split, with acknowledgment retries. Anyone can call them; the issuer's Safe keeps its retry.
- **Returned vouchers restore no capacity** and authorize no new issuance.
- **A member's earned agreement on the source network stays operator-assisted**, separate from the
  Gnosis booking approval.
- **The source upgrade is one standard Safe batch** (23 creates), proven on local binaries; the live
  rehearsal and every broadcast are still pending.
- **Participant accounts and terms are deferred to onboarding**; they don't block implementation.

### What changed on 24 October, first pass: member issuers

The accepted amendment puts individual issuers in the same curated Gnosis pool as garden issuers,
with steward-assisted onboarding: a steward prepares and publishes, the Green Goods Safe
registers and admits, and the member owns the token and reserve and approves the exact
obligation and every booking. The first pass designed that, as five new screens, changes to six
existing ones, and two new journeys. The second pass kept all of it and moved each screen onto
its shipped surface, so where a bullet below describes a screen's first form (the services list,
the wallet's links), [the second pass](#what-changed-on-24-october-second-pass-built-on-the-shipped-surfaces)
gives its current one.

- **Who promises delivery.** Every service names a person or a garden. The new `SServices` list
  leads with the service, its unit, availability and cost, and a pill that says whether Lina can
  redeem now or must exchange first. `SOffer` gains a **Member lesson** kind: "Teo approves, then
  Sunroot's stewards accept you", with the note that a steward can't approve for Teo.
- **Assisted onboarding.** `SOnboard` (member app) shows the steward's draft as proposals, what the
  member promises, and what stays theirs (token, reserve, each booking approval, upgrades and
  recovery), then one exact approval from the member's own account. Its progress names who acts
  next: Green Goods sets up the token, the Green Goods Safe registers it during a paused window,
  the pool administrator admits it, the member enables the reserve. `SIssuers` (cockpit, Community)
  is the steward side: prepare the draft, wait for the member, prepare the four owner Safe drafts,
  see the admission land, delist.
- **Member service management.** `SMyService` keeps four numbers apart (lessons promised, booked,
  delivered, left) from where the vouchers are (issued, in the pool, in the reserve, in escrow,
  approved for rewards), lists verified bookings labeled as possibly incomplete, and carries the
  member's acts as exact reviews: approve a booking, propose a return, issue more within capacity,
  approve more for rewards, pause, check a pending transaction.
- **Holdings and exchange.** `SWallet` shows a member's voucher among the holdings and links to
  the services list and to offering a service of your own. `SExchange` gains a **Maya to Teo** pair:
  two of Maya's own coaching vouchers for one Teo voucher at the rate each approved, zero fees
  proposed, the holding limit as a failure.
- **Booking, delivery and recovery.** `SPay` and `SRedeem` gain the member variants (**Member
  lesson**, **Lesson**): the same consent, issuer approval, escrow, acceptance, activation and
  immutable split, with the stewards accepting after Teo approves, a 60-minute lesson that stops
  at 30, and a 0.5 and 0.5 split that reverses no exchange and restores no capacity. `SIssuer`
  gains **Accept member booking**, where Ade accepts as the pool's steward after Teo's approval.
- **The project brief.** `SBrief` groups three separate requests under Sunroot's impact website:
  Noor designs for 1 Teo voucher, Maya writes the impact summary for 1 Sunroot voucher, Teo builds
  for 1 Green Goods voucher. Nothing pays out as a team, and the peer help (Maya's lesson with Teo)
  sits apart from the project work. `SReward` gains a **Member voucher** kind for Noor's reward and
  an **Agreement unavailable** state for the operator-assisted source-chain agreement.
- **Copy.** The booking copy no longer names Sunroot; it names the issuer and its vouchers through
  placeholders, so a garden and a member read the same sentences. 414 keys were added in English,
  Spanish and Portuguese, and 97 existing keys were parametrized. The lab's self-test now fails on
  an unfilled placeholder.
- **Dials.** V1 and V2 also apply to the onboarding screen, V5 to the cockpit issuers page, and D1
  to every new screen.

### What changed on 23 October

The first v2 draft proposed four architecture changes: a Celo purchase escrow, paying as
agreeing, standing approvals, and automatic completion after a seven-day review window. None is
selected for this pilot. The 23 October revision designed the architecture that is built and locally
proven, kept those ideas under **Future ideas**, corrected the misleading states listed below, put
every pilot string in three languages, added the stricter `check.mjs`, and later added the dials.
v1 stays frozen in its own folder, and the lab keeps v1's screens under **v1 reference**.

## Task record

Task record: PRD-1299 v2 pilot revision | Type: design | Outcome: complete; direction approved on 25 October
Agent/model: Claude Code / claude-opus-5-5 and claude-fable-5-1, in four sessions | Coverage: the revision from 22 October 23:54 UTC to the approval of 25 October UTC

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Investigate and implement | 2026-10-22 23:54 → 2026-10-23 05:36 | Sources read; screens, copy and crosswalk rewritten; lab self-test clean. The two phases overlapped. |
| Verify | 2026-10-23 05:36 → 05:47 | Text, name, focus and contrast sweep added to `check.mjs` and passing; visual review began. |
| Wait | 2026-10-23 05:47 → 16:36 | Session usage limit; resolved. |
| Verify | 2026-10-23 16:36 → 16:45 | Visual-review fixes, keyboard walk, first evidence capture. The session then stopped at a usage limit. |
| Investigate | 2026-10-23 17:19 → 17:27 | Resumed in a second session; read the newer implementation handoffs and working pilot terms. |
| Implement and verify | 2026-10-23 17:26 → 17:38 | Copy fixes; current blockers and pilot terms in the crosswalk and lab pages; these docs; a rebuild; `check.mjs`, the selected `format` and `lint` checks (2 fresh passes, 0 reused) and Plan Hub validation passing; renders and evidence. |
| Investigate | unknown → 2026-10-23 20:10 | Measured the lab at viewer sizes; read the unification lab's dials; four forks answered by Afo. |
| Implement and verify | 2026-10-23 20:10 → 22:30 | Dials, compact panel, step strip, narration band and cockpit focus crop; `check.mjs` with the panel-fit rule and dial sweep passing (1,001 renders); keyboard walk; evidence. Committed and pushed to PR #1186 after the push gate. |
| Investigate | unknown → 2026-10-24 01:30 | Third session: read the accepted amendment, the working terms' member defaults and fixture, the deployment handoff's latest state, the member-issuer proof, and the Shared, Client and Admin issuer code. |
| Implement | 2026-10-24 01:30 → 02:55 | Copy parametrized and extended (three languages); five new screens; six screens gain member variants; journeys, pages, dials, build and check extended; crosswalk rows. Intervals approximate. |
| Verify | 2026-10-24 02:55 → 03:30 | `check.mjs` passing (1,683 renders, 703 dial settings, 21 views); keyboard walk of the new surfaces; visual review and three fixes; evidence; these docs. |
| Ship | unknown → 2026-10-24 04:24 | Push gate passed; committed `bb6e0406e`; pushed to draft PR #1186 and updated its description. |
| Investigate | unknown → about 17:55 | Afo's request: settle the open questions, catch up with the contract branch, and stop the designs dropping the shipped promise and pool components. Read the contract branch to `30fbaafe2`; `develop`'s DL-102 to DL-113 components, promise page, Promises tab, wallet and Promises console; the deployed Storybook. |
| Implement | about 17:55 → 18:40 | The kit's shipped-components block, 23 glyphs, 125 of the app's strings and new copy; the fifteen pilot screens rebuilt on their shipped surfaces; journey captions and dial scopes. Times from file changes, approximate. |
| Verify | 2026-10-24 18:40 → 18:46 | `check.mjs` failed on six text and contrast findings, then passed after fixes (1,687 renders, 703 dial settings, 21 views); keyboard walk, 57 stops; evidence regenerated with the shipped comparison. |
| Document | 2026-10-24 18:46 → 19:04 | These docs, the lab's decisions page, the evidence README and the design audit; Plan Hub validation and the selected `format` and `lint` checks passing. |
| Decide | 2026-10-24 19:04 → about 19:08 | Two rounds of questions. Afo accepted seven recommendations and chose the working pilot services now, against the recommendation to wait. |
| Investigate | about 19:08 → 19:25 | Read `pilot-issuer-terms.md` on the contract branch (still `30fbaafe2`); mapped each fictional service, issuer, amount and date onto the working terms. |
| Implement | 2026-10-24 19:25 → 19:40 | Decisions recorded in these docs and the lab; copy, screens, journeys, written pages, crosswalk and the check's dial sweep restyled; the deadline and signed-approval decisions drawn into onboarding. Times from file changes. |
| Verify | 2026-10-24 19:40 → 19:50 | `check.mjs` passing three times (1,703 renders, 719 dial settings); evidence re-rendered twice; visual review and six fixes; keyboard walk, 46 stops. |
| Document | 2026-10-24 19:45 → 19:55 | Third-pass docs, evidence README, design audit, artifact README; repository checks rerun. |
| Investigate | unknown → about 20:20 | Afo asked whether the published page was current. It still showed the 23 October build, with eleven open questions and four blockers; compared it, the lab and the implementation lane's deployment handoff, member-issuer proof and plan todo. |
| Implement | about 20:20 → 20:56 | Live state and settled items corrected in the lab's decisions page, the crosswalk and this handoff; `check.mjs` passing; the decisions page rendered. Times from file changes, approximate. |
| Decide | about 20:57 → 21:45 | Two of the published page's questions had never been answered. Afo hid personal G$ purchases from pilot members and chose English first. |
| Implement and verify | about 21:45 → 22:00 | Decisions recorded; rebuild; `check.mjs` passing; 33 frames rendered and reviewed; the peer-help note's margins fixed and the discovery evidence composed again. |
| Publish | 2026-10-24 22:00 → 22:06 | Summary page rewritten from this handoff and checked at two widths and themes; published with the lab and 32 images as artifact versions 5 and 6, the second after wrapping the lab as a full page. |
| Document | 2026-10-24 22:06 → 22:10 | Fourth-pass docs, evidence README, design audit, artifact README; `check.mjs` passing after the margin fix. |
| Investigate | 2026-10-25 01:40 → about 01:52 | Fourth session, from a handoff brief. The brief's worktree was gone, so the design branch was read from git, then checked out in this session's worktree. Read the handoff, crosswalk, audit, lab and evidence; the contract branch to `c2eafb2cc` and its deployment handoff; `develop` to `2da72d8b0`; the 14 new bot comments on PR #1186. Gave Afo an eleven-point readiness list. Version 6 of the published page could not be read from this session. |
| Decide | about 01:52 → 01:55 | Afo chose the accuracy fixes, the cockpit on `develop`'s controls and the lab-code fixes; collective vouchers first; the brief at the top of this file; "1 voucher per hub day". |
| Implement | about 01:55 → 02:07 | One cockpit dialog redrawn on DL-115 to DL-119 and rendered beside a shipped dialog captured from the deployed Storybook. |
| Decide | about 02:07 → 02:13 | Afo approved the rollout and pointed to the Home redesign session. Read that hub's spec and guides branch; Afo put a booking at another garden in the wallet (decision 11) and services wherever a garden's promises are listed (decision 12). |
| Implement | about 02:13 → 02:31 | The cockpit rollout, the wallet's booking row and journey step, the crosswalk and live-state corrections, the Safe threshold copy, the hub-day wording, and the lab-code fixes. Times from file changes, approximate. |
| Verify | about 02:28 → 02:34 | `check.mjs` failed on a removed key, the target line's ellipsis and three contrast findings, two of them in shipped pieces; after the fixes it passed (1,707 renders, 719 dial settings). Renders reviewed; keyboard walk, 37 stops. |
| Document | about 02:34 → 02:48 | Build this; the reference sections and the history reordered; evidence re-rendered from the built page with today's Storybook; evidence README, design audit and artifact README. |
| Ship | about 02:44 → 02:55 | Push gate passed; committed `6bf015e42`; pushed; PR description updated and checked against the live text. |
| Wait | 2026-10-25 02:55 → 03:03 | Afo's read of the brief; resolved: "The build brief is clear." |
| Decide | 04:22 → about 04:26 | Afo approved the direction and asked for the review's dismissal, the merge and a republish. Version 6 could not be read from this session, so Afo chose a new artifact. |
| Publish | about 04:26 → 04:39 | Lab, copy sheet and docs marked approved; `check.mjs` passing (1,707 renders, 719 dial settings); 31 frames rendered again; the summary page rebuilt and published as a new artifact after one look at two widths. |
| Document | 04:40 → 04:42 | This record, the handoff's status, open items and history, and the artifact README; committed `65b1e9740` after the push gate and pushed. |
| Fix | 04:43 → about 04:50 | CodeRabbit's finding on `6bf015e42` verified: a paused issuer's row opened the open offer. Fixed and followed in the built lab; `check.mjs` passing (1,707 renders, 719 dial settings); the published lab updated to version 2. The dismissals and the merge follow. |

Human corrections: 2 observed in the third session (the designs had lost the existing promise and
pool components; the published page still asked settled questions and listed cleared blockers);
none in the fourth, where Afo added one constraint, the Home redesign, which moved two screens'
placement; attention: unknown.
