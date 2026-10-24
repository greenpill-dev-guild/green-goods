# PRD-1299 voucher design lab, v2: handoff

**Status:** draft for Afo's review, not approved. Revised in place on 22, 23 and 24 October 2026.
The 24 October revision adds member-owned service vouchers beside garden vouchers, following the
pilot amendment accepted on 23 October Pacific. It is local only: the published
[Voucher Pilot Design](https://claude.ai/artifact/12BURCmGX2Ddnzt7Uv4USC) (artifact version 4) shows
the 23 October build with the dials, and the older [Voucher Lab](https://claude.ai/artifact/3pwUYy43vdb91q6qdH3H9G)
shows the 22 October draft. Nothing here changes contracts, production code, live configuration or
Linear.

PRD-1299 owns design approval and PRD-1297 implements it. PRD-1323 and PRD-1324 own linked
rewards. Gui reviews the Portuguese copy (PRD-1312).

- **Open it:** [`voucher-lab.html`](voucher-lab.html) in any browser. Start with **Pilot design**
  in the left column: four written pages, then eight journeys.
- **Look up a state:** [`crosswalk.md`](crosswalk.md) maps every pilot screen and state to its
  source, recorded proof, gaps and future ideas. [`copy-sheet.md`](copy-sheet.md) has every
  string in English, Spanish and Portuguese.
- **See it rendered:** [`evidence/`](evidence/) holds labeled static-prototype screenshots.
- **Change it:** edit [`lab/`](lab/), then [rebuild and check](#rebuild-and-check).

## What changed on 24 October: member issuers

The accepted amendment puts individual issuers in the same curated Gnosis pool as garden issuers,
with steward-assisted onboarding: a steward prepares and publishes, the Green Goods Safe
registers and admits, and the member owns the token and reserve and approves the exact
obligation and every booking. The lab now designs that, as five new screens, changes to six
existing ones, and two new journeys.

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

## What changed on 23 October

The first v2 draft proposed four architecture changes: a Celo purchase escrow, paying as
agreeing, standing approvals, and automatic completion after a seven-day review window. None is
selected for this pilot. The 23 October revision designed the architecture that is built and locally
proven, kept those ideas under **Future ideas**, corrected the misleading states listed below, put
every pilot string in three languages, added the stricter `check.mjs`, and later added the dials.
v1 stays frozen in its own folder, and the lab keeps v1's screens under **v1 reference**.

## The journeys

| Journey | Steps | Screens | What it shows |
|---|---:|---|---|
| Earn vouchers, with optional G$ | 12 | `SReward`, `SFunds`, `SWallet`, `SIssuer` | A Request pays 20 Sunroot vouchers and 120 G$. Each reward arrives on its own, with its own receipt. A used-up allowance makes a vouchers-only reward wait until the issuer raises it. |
| Redeem a voucher you hold | 14 | `SWallet`, `SOffer`, `SPay`, `SIssuer`, `SRedeem` | Agree, the issuer approves, deposit, the issuer accepts. Then the session, the final split and the confirmation, each a separate approval. |
| Exchange, then redeem | 8 | `SOffer`, `SExchange`, `SPay`, `SRedeem` | One direct exchange in the shared pool, showing fees, minimum, deadline and recipient. The swap books nothing; the vouchers it returns are then redeemed. |
| A course that ends early | 8 | `SRedeem`, `SIssuer` | The issuer proposes a return within its terms, the holder approves one final split, and each transfer is tracked, and retried if it fails, on its own. |
| Offer your own service | 15 | `SIssuers`, `SOnboard`, `SServices`, `SMyService` | Ade drafts Teo's lesson with him; Teo approves the exact obligation from his own account; the Green Goods Safe registers and admits the token; Teo enables his reserve, approves each booking, proposes a return, pauses. Kaya delists Maya's coaching without touching holdings or bookings. |
| A project with three promises | 17 | `SBrief`, `SReward`, `SExchange`, `SOffer`, `SPay`, `SMyService`, `SIssuer`, `SRedeem` | One brief, three separate requests and rewards. Maya exchanges her own vouchers for Teo's, books the lesson, Teo approves, Ade accepts, half is delivered, and the split returns 0.5 each way. |
| Buy with your own G$ | 13 | `SOffer`, `SPay`, `SPurchase`, `SFunds`, `SRequests` | Lina's home-garden Safe holds the payment and its stewards check it. The provider accepts, the month runs, and Lina confirms it was kept before anyone is paid. |
| When something goes wrong | 27 | All but `SWallet` and `SBrief` | Not a gardener, no result, changed terms, an unchecked payment, a decline, a failed refund, a dispute, signing not available, a cancel race, a stale quote, a short pool, a return above terms, an agreement that needs an operator, a changed draft, issuing beyond capacity, a pending transaction, a paused issuer, a holding limit, a delisting. |

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
| "Kept" for reports and payouts | **Kept** appears only after the member confirms, or after stewards resolve a dispute as kept. "Sunroot reported the delivery", "Ready to confirm" and "The payout is running" are separate states. |
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
| V5 Confirm | Dialog, in the row | Issuer, Promises, Funds and Voucher issuers cockpit pages |
| D1 Copy | Full, compact, minimal | Every member and cockpit screen; minimal reshapes the offer and request cards |
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
ceiling per issuer, ten participants and a 1:1 pool ratio on 22 October. The issuers haven't
accepted the terms, so the lab keeps its fictional services, and Sunroot Skills Hub stands in for a
garden issuer.

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
   `SOnboard` review sheet collects that approval in the app, from the member's account. Whether it
   becomes a signed record or stays the metadata reference is a decision for PRD-1297.
2. **Issuer actions as tasks.** The Client's issuer panel exposes a raw action select (issue,
   approve or revoke reserve spending, enable or disable the reserve, approve or revoke exchange
   spending, exchange). The lab wraps the same calls as the member's tasks: approve a booking,
   propose a return, issue more, approve more for rewards, pause. The exact review sheet, the
   five-minute expiry and one pending transaction at a time are kept.
3. **Capacity numbers.** The app says total services owed are unknown, because token balances
   don't establish them. The lab's four numbers come from the issuer's own terms and the verified
   bookings, labeled as such; a projection would have to carry them.
4. **Core acceptance of a member's booking.** The spec keeps steward-controlled acceptance for the
   assisted pilot and requires the member's approval first. The lab shows Teo approving and Ade
   accepting as the pool's steward; who accepts is listed as a decision.
5. **Pause, delist and pool inventory.** Pausing is the member's reserve disabled plus no new
   approvals; delisting is a registry or limiter change for the owner Safe; placing initial
   inventory in the pool is the member's transfer. None has a Shared action or draft today; the lab
   shows their consequences and labels the gap in the crosswalk.
6. **Discovery.** Today's Client lists issuer assets in a select on the Profile page. The services
   list that names who promises delivery is new UI.

## Evidence

Three classes, kept apart. None of them is proof of authenticated signing.

**Static prototype: this lab, run during this revision** in headless Chromium (Playwright's
bundled build).

| Command or check | Observed result |
|---|---|
| `node build.mjs` | Wrote `voucher-lab.html`, `copy-sheet.md` (1,278 keys) and `crosswalk.md` (46 rows). The build refuses a missing language, an em dash or placeholders that differ between languages. |
| `node check.mjs` | Passed on 24 October. The self-test passed, including every dial option on each screen it applies to and the new unfilled-placeholder rule. Twenty-one views fit at 1440 × 900, 1280 × 720, 1024 × 768 and 390 × 844 with no sideways scroll, and at the three desktop sizes the side panel held its controls without scrolling. All 1,683 pilot renders (every state of the fifteen pilot screens in English, Spanish and Portuguese, every state in dark, and 703 dial settings) showed no clipped or overflowing text, a name on every control, no focus behind an open dialog, every icon present, and AA contrast. |
| Keyboard walk | Tab through the five new surfaces: the service approval sheet, the booking approval sheet, the owner Safe drafts dialog, the services list and the member's service page. Twenty-three stops, every one visible, named, with a focus ring, and inside the open sheet or dialog where there was one. The 23 October walk of the lab panel (seventy stops) still holds; the panel didn't change. Run from a scratch script that isn't part of the lab. |
| Visual review | Every state of the five new screens and of the member variants of the six changed screens in English at native size, with Spanish, Portuguese and dark samples, the cockpit pages at full size, and the lab at 1440 × 900, 1280 × 720 and 390 × 844 on both new journeys. The fixes it found (a booking sheet's checkbox label, the capacity line when issuing more, a person named as "it") are in this revision. |

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

**Product and authenticated proof: none.** This revision ran no comparison with the running app,
no Storybook build of these designs, and no screen reader. The
[design audit](design-audit.md#remaining) lists what is still unchecked.

## Decisions for Afo

1. **The direction.** Approve the fifteen pilot screens and eight journeys, or mark what to change.
2. **Who accepts a member's booking.** The garden's stewards, as today's steward-controlled
   acceptance does and as the lab shows, or the member.
3. **The control model.** The simple one the lab shows (the member's account is token owner,
   reserve, booking approver and upgrade administrator, with recovery recorded separately), or a
   delegated recovery authority.
4. **The member's approval of a draft.** A signed in-app record, or the reviewed approval reference
   and digest the issuer metadata carries today.
5. **Pool inventory.** Who places a member's initial inventory in the pool, and whether a Shared
   action is built for it.
6. **Delisting.** What it is in the pool (registry or limiter) and who prepares it; the lab shows
   only the consequences.
7. **Disputes.** Who settles a disputed G$ purchase when the provider's own stewards resolve its
   pool, as in the protocol pool.
8. **Partial delivery.** Which core outcome records it: the issuer's stewards closing the promise
   early, or a dispute resolution.
9. **Follow-up calls.** Who runs activation after acceptance, the transfers after a split is
   approved, and a reward retry after a reserve or allowance repair. Anyone can call each of them,
   and the issuer's Safe also has a retry fallback, but none has an owner yet.
10. **The refund fee.** Whether the home garden or the member carries the refund transfer's token
    fee. Today the Safe pays it.
11. **Defaults.** The acceptance deadline (the lab shows 7 days; the working terms propose a
    two-business-day booking response) and the vault verb.
12. **Accept after the payment check.** Whether it becomes a contract rule. Today it is a design
    rule only.
13. **Real services.** Whether to restyle the fictional services as the working pilot services once
    the issuers accept their terms.

## Live state and blockers

As the implementation lane recorded them through 24 October UTC in
`handoffs/codex-live-pilot-deployment.md` and `artifacts/member-issuer-local-proof-2026-10-24.json`.
This session read them and reran nothing. No voucher, pool or member-issuer transaction has been
broadcast.

- **Accounts.** The same-address requirement was superseded on 23 October: the pilot cohort uses
  new patched passkey accounts, with a member-owned connected wallet as fallback. The selected pilot
  account completed an authenticated, sponsored Gnosis proof. That proves one account, not every
  member issuer's possession or approval.
- **Deployment.** The Hats upgrade is live on Arbitrum. The source, voucher and pool deployments are
  prepared and rehearsed, not broadcast. The release planner still accepts two garden issuers, so
  member tokens are not yet in an executable candidate.
- **Routes and data.** The app's issuer and service routes are empty until receipts exist, and
  Gnosis indexing is unbound, so every member-issuer screen here is a design, not a read.
- **Issuers.** Sunroot and Green Goods stand in for the pilot issuers, whose capacity, addresses and
  acceptance are unconfirmed (COM-46). No real member has accepted terms; the recommended defaults
  are proposals.
- **Earned consent.** Agreeing to a voucher reward on the source network stays operator-assisted;
  approving a booking on Gnosis doesn't replace it. The lab's **Agreement unavailable** state shows
  it honestly.

This design authorizes no deployment, broadcast, production auth activation or live financial
action, and claims no readiness.

## Copy and text owners

- English is a draft for Afo. Portuguese awaits Gui's review (PRD-1312), and Spanish awaits a
  native speaker. The [copy sheet](copy-sheet.md) marks both. The 24 October keys include
  Portuguese forms with and without the article before a person's name ("vales do Teo", "vales da
  Maya"), which Gui should confirm.
- **Redeem** is the voucher verb. The vault verb is unresolved, and production vault strings are
  unchanged. In Spanish and Portuguese the Redeem verbs (canjear, resgatar) collide with today's
  vault strings until a vault verb is chosen.
- The hub spec still says "Redeem" keeps its vault meaning (line 47 of
  [`spec.md`](../../../spec.md)). Its owner should record the voucher decision.
- The contract branch's brief keeps a member's G$ in the buyer garden's Safe. The design follows
  that rule, so v2's earlier request to change it is withdrawn.

## Handoff for PRD-1297, PRD-1323 and PRD-1324

Bounded to what this design adds. Each item names its current source and the gap.

- **Services list** (`SServices`): a discovery view that names who promises delivery and whether
  the member can redeem. Source today: `ServiceAssets` select over `SERVICE_ISSUER_ROUTES`. Gap: new
  UI; routes empty until receipts.
- **Member offer and booking** (`SOffer`, `SPay`, `SRedeem` member variants): the existing voucher
  journey with the issuer's name and unit from the asset metadata. Gap: the issuer-aware copy and
  the stewards' acceptance line.
- **Onboarding** (`SOnboard`): draft review, exact approval, progress by actor, member setup steps.
  Source today: `ServiceIssuerAsset` metadata, `assertServiceIssuerAsset`, the Admin review. Gap: a
  member-side approval flow and its record (decision 4), a setup step list, pool inventory
  placement (decision 5).
- **Your service** (`SMyService`): the four capacity numbers, voucher locations, verified bookings,
  and the member's acts as tasks over `ServiceIssuerAction` (`approveBooking`, `authorizeReturn`,
  `issue`, `approveReserve`, `configureReserve`) with the existing exact review and pending
  reconciliation. Gap: a capacity projection, pause semantics, delisting.
- **Cockpit issuers** (`SIssuers`): the existing `VoucherIssuerOnboarding` plus a draft form, a
  waiting state, an admission result and a delist draft. Gap: everything but the review and copy of
  owner Safe drafts.
- **Project brief** (`SBrief`): presentation over three requests; no core object. Gap: new UI.
- **Rewards** (`SReward`): a member's voucher as a reward and the operator-assisted agreement state
  (`earned-consent-unavailable`). Source today: `ServiceAccessStatus` shows the reason text.
- **Exchange** (`SExchange`): the member pair, the rate row, zero-fee wording, the holding-limit
  failure. Source today: `issuerPoolState` and `ServiceIssuerForm`.
- **Copy**: 1,278 keys in `lab/copy.json`, with the issuer-parametrized booking strings, ready to
  map onto `en.json`, `es.json` and `pt.json` once PRD-1297 picks its namespaces.

## Rebuild and check

Run from the lab folder. `check.mjs` uses the repository's `@playwright/test`; set
`CHROMIUM_PATH` to use another Chromium build.

```sh
cd .plans/backlog/cosmo-local-credit-interop/artifacts/prd-1299-voucher-ui/v2/lab
node build.mjs   # writes ../voucher-lab.html, ../copy-sheet.md and ../crosswalk.md
node check.mjs   # self-test, fit, text, names and focus, icons, contrast, dials
```

| File | Holds |
|---|---|
| `shell.html` | The lab page and runtime, all lab text (journeys, pairs and written pages), and the dials (`TWEAKS`). |
| `gg.css` | The screen kit. Audit corrections follow the "Design-system alignment (v2 audit)" comment, pilot additions follow "Pilot design additions", the dial rules follow "Lab dials", and the member-issuer additions follow "Member issuers". |
| `screens/*.dc.html` | 35 screens: the fifteen `S*` pilot screens, and v1's twenty kept for reference. A pilot screen reads the dials from its props and carries them as data attributes on its root. Screens that name an issuer wrap the copy function with the issuer's name and unit. |
| `copy.json` | Every pilot string as `[EN, ES, PT]`. Booking strings use `{issuer}`, `{issuerFull}`, `{unit}`, `{garden}`, `{inUnit}` and `{outUnit}`. |
| `crosswalk.json` | The screen and state crosswalk. |
| `remix-sprite.svg` | 60 Remix Icon 4.9.0 glyphs from the npm package. Icons by Remix Icon (https://remixicon.com), licensed under the Remix Icon License v1.0. |

These files are design artifacts. Code, tests and CI must not depend on them.

## Task record

Task record: PRD-1299 v2 pilot revision | Type: design | Outcome: complete as a draft; approval pending
Agent/model: Claude Code / claude-opus-5-5 and claude-fable-5-1, in three sessions | Coverage: the revision from 22 October 23:54 UTC

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

Human corrections: 0 observed in this segment; attention: unknown.
