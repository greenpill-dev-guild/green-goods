# Pilot issuer terms — working draft

**Member-issuer amendment, 23 October Pacific:** individual service vouchers are required in the
pilot alongside the collective vouchers below, with one shared exchange pool. Steward assistance
does not transfer token/reserve ownership or replace the member's exact approval. The existing
GG/TAS numeric baseline remains specific to those issuers; no member quantity, service price or
exchange ratio is approved by analogy. The [architecture](spec.md#accepted-pilot-amendment--member-and-garden-issuers-23-october-pacific)
owns the model and [M1–M8](plan.todo.md#member-and-garden-issuer-pilot--accepted-23-october-pacific)
own the implementation sequence.

## Member onboarding terms to confirm before activation

For each willing member, record a public-safe service description and explicit acceptance of:

- A bounded service unit, deliverable, availability/location, booking rules and remedy terms.
- Their token-owning account, reserve, source approval authority, mint writers and separate
  upgrade/recovery powers. Keep private member associations and credential evidence outside Git.
- Total initial issuance, remaining service capacity, initial reserve/pool inventory, finite adapter
  allowance and accepted-undelivered obligations. The recommendations below are starting points
  for later onboarding, rather than current member approvals.
- Pool admission, an agreed quote/rate and fees, and a holding cap with usable swap headroom.
  Neither admission nor an inventory cap guarantees demand or delivery.
- Exact offer and booking approvals; the steward may assist but cannot approve as the issuer.
  Delivered vouchers return to the member reserve within the remaining service budget; undelivered
  vouchers return to the holder and do not automatically refund the earlier exchange asset.

Start with a small confirmed member cohort; its size and names remain open. Career conversations
inform possible services but are not permission to publish personal details or evidence that a
member has agreed to deliver. No private notes or proposed individual commitments are copied here.

## Selected TAS rehearsal brief

The accepted implementation example is a TAS impact website with three distinct participant
accounts and three separate commitments: design, metrics/impact analysis and website engineering.
They share a brief/reference, with independent acceptance, evidence and outcomes. These are
rehearsal roles, not a confirmed participant roster or permission to publish personal details.

At least the analyst and engineer fixtures own separate service-voucher assets admitted to the
same pool as the collective assets. A bounded exchange obtains the other member's voucher and
continues through booking and partial delivery/refund. The designer need not issue a token.
Standalone measurement coaching and integration-help lessons are possible fixture services;
their work, evidence and capacity budgets stay separate from the project's impact summary and
website implementation. Fixture issuance, quote/rate, pool cap, reserve and upgrade controls must
be explicit and labeled, with no automatic promotion into live values.

Before live issuer configuration, each real member still needs to confirm their account, service,
capacity, issuance, source authority, allowance, rate/fees, remedies and upgrade/recovery powers.
No live member rate, funded reward or delegated authority is approved here.

### Recommended defaults for hub members

**Recommendation requested on 23 October Pacific:** participant names and accounts are later
onboarding inputs. They do not block generalized implementation, deployment preparation, or
independent protocol deployment. Prepare the reusable setup now and collect member-specific
acceptance when that member is ready to activate an offer. These recommendations do not replace
the accepted collective issuer baseline below or promote fictional fixture values into live inputs.

Start with one clearly bounded service per willing issuer. Use the same review and accounting
rules for individuals and collectives, while allowing different service units, prices and capacity.
An hour of coaching, a reserved hub visit and a defined repair are different promises; a shared
pool does not make their value or delivery evidence interchangeable.

| Setting | Recommended starting point | Why / boundary |
|---|---|---|
| Service definition | One voucher buys one published standard service unit, with scope, exclusions, booking window, evidence and remedy. A sixty-minute session is a useful example, not a mandatory unit. | Holders can understand the obligation before exchanging or booking. Keep service units separate from token base units. |
| Initial issuance | At most six standard service units per new member, and less when their confirmed available capacity is lower. Review capacity over a published two-to-four-week booking window. | This is a conservative operational starting ceiling, not evidence of capacity or an immutable token supply cap. Existing accepted bookings and other claims reduce available capacity. |
| Initial inventory | Of those six units, provisionally place two in the existing shared pool and retain four in the issuer reserve. Scale both down with issuance. | Pool stock and reserve stock are parts of the same issuance, with separate custody and spending paths. An issuer may start smaller; no additional pool is needed. |
| Reward adapter allowance | Approve only the next explicitly reviewed reward tranche, initially at most one standard unit, and never more than usable reserve and remaining uncommitted capacity. | A finite allowance is separate from issuance and pool admission. Revocation stops future pulls; it does not cancel an already accepted obligation. |
| Pool holding ceiling | Start no higher than the approved total initial issuance; for the six-unit example, six. | Two starting units leave four units of incoming exchange headroom. The holding limiter is not an issuance limit, delivery guarantee or per-person transfer limit. |
| Exchange rates | Agree a price index for each offer. A 1:1 gross ratio is a simple rehearsal default only when issuers accept it; allow other reviewed ratios. | No cash peg, universal hourly wage or automatic parity across member services. The fixture's 2:1 exchange remains an independent test case. |
| Fees and quote review | Recommend zero configurable pool fee initially. Read the actual protocol fee and net quote; review exact input, minimum output and deadline for each exchange. | Zero pool fee can still produce a protocol fee. Use spendable output inventory after reserved fees, rather than raw token balance. |
| Control | For a member who accepts the simple control model, use their selected account as token owner, reserve, source approver and direct factory upgrade administrator. Keep protocol pool/source administration with the existing owner Safe. | Steward assistance does not substitute a signature or grant minting, reserve access or member upgrade power. Do not create a member Safe automatically. Record the member's chosen account recovery procedure separately. |
| Booking and remedies | Publish availability; propose a response within two business days. Require exact consent, issuer approval and escrow before activation. For a divisible service, agree partial-delivery arithmetic before booking. | Fix one holder-approved delivered/refundable allocation. A timeout, transfer or issuer assertion does not establish delivery. A non-divisible deliverable needs its own accepted outcome rule. |
| Capacity refresh | Review outstanding obligations and delivered service before another issuance or allowance tranche. Reapprove any added capacity explicitly. | Returned vouchers are inventory, not renewed service capacity. Token balances alone cannot establish how much work an issuer can still deliver. |

For example, a member who can reliably offer only three sessions should start with three units,
perhaps one in the pool and two in reserve. Six is a suggested upper starting point, not a target
to fill. Reserve stock also needs coverage for existing approved rewards; moving it into the
pool cannot leave those obligations uncovered. Increase inventory after observed delivery and
issuer review, rather than automatically in response to swap demand.

The fee distinction follows the pinned published
[CLC protocol specification](https://github.com/cosmo-local-credit/protocol/blob/ce090fd3d5a7493c726fb939da39af15ef1c9d7c/docs/SPEC.md):
the raw quote precedes fees, the output quote is net, and output-side reserved fees reduce usable
inventory. The numerical operating recommendations above are local judgment for this pilot,
not requirements or economic guarantees from that specification.

During later onboarding, bind these choices to the actual account, approved terms revision,
deployed assets and receipt-backed route. Source-chain earned-voucher approval and Gnosis booking
approval remain distinct signing steps. Current generalized UI or contract rehearsal evidence does
not claim that either live ceremony has occurred.

### Fictional rehearsal parameters

The local contract rehearsal uses the following explicit examples. They exercise the integration;
they are not actual issuer acceptance or deployment inputs.

| Fixture | Separate project deliverable and reward | Peer service |
|---|---|---|
| Designer | Website design; one engineer voucher, funded with the engineer's exact finite grant | No issued service asset |
| Analyst | Project impact summary; one TAS voucher | Standalone measurement coaching, separate from the project summary |
| Engineer | Website implementation; one GG voucher | Standalone integration lesson, separate from the website implementation |

Each project commitment has its own acceptance, evidence and outcome under the shared brief.
The two member assets use six decimals, with six vouchers minted per member: two in the existing
shared pool and four in that member's reserve. In this fixture, each member is token owner,
reserve, source approver and direct factory upgrade administrator. No new member Safe or timelock
is created. These control choices require a separate real-member decision before live use.

The fictional analyst/engineer price indices are one/two, with zero configured fees. The analyst
exchanges two newly issued analyst vouchers for one engineer voucher. This spends the analyst's
own service promise, independently of the TAS reward; it does not pay for the same work twice.
The pool holds both member assets alongside GG/TAS, with a six-voucher holding cap per member
asset. Finite member reserve allowances and exact booking approvals remain separate actions.

The analyst then books a sixty-minute integration lesson for the received engineer voucher.
After consent, escrow, steward acceptance and activation, an immutable thirty-minute delivered /
thirty-minute undelivered outcome returns half a voucher to the engineer reserve and refunds half
to the analyst. It does not reverse the exchange. Financial closure does not label the whole
sixty-minute core promise fulfilled. Returned vouchers do not replenish consumed service capacity.

The resulting engineer balances are reserve 3.5, pool 1, designer 1, analyst 0.5 and escrow 0;
the analyst asset remains reserve 2 and pool 4. Both sums remain six. The analyst retains the
separate TAS reward, and the engineer retains the separate GG reward. Optional G$ is zero in
this example and remains an independent Celo route.

## Existing collective issuer baseline

**Version:** `pilot-2026-10-27` · **Status:** operating terms approved on 27 October 2026 (UTC) with two changes; the Claude seat budget and cash swap-back are open, and each issuer's identities stay on the private path.

The selected services are Tech and Sun hub access, Green Goods assisted sessions, and Claude
access under a Green Goods team. The human release owner accepted the service prices below,
a twenty-voucher ceiling per issuer, ten participants and an initial 1:1 gross exchange ratio
on 22 October Pacific. On 27 October 2026 (UTC) the release owner approved the operating
terms below, with two changes: an assisted session is forty-five minutes for two GG vouchers,
and the booking window runs to 31 December 2026. Any term can change later through a new terms
revision, and a booking keeps the revision it was agreed under. Neither issuer has yet supplied
its accountable addresses or acceptance record through the private path. The [deployment package](handoffs/codex-live-pilot-deployment.md)
tracks those inputs separately from technical readiness.

## Services and voucher prices

| Issuer / offer | Full service for the stated voucher price | Capacity required by the baseline, still unconfirmed |
|---|---|---|
| Tech and Sun — hub day | **1 Tech and Sun voucher:** one named person's reserved visit of up to four hours, including workspace, power and connectivity. Publish the location, opening hours and equipment restrictions before accepting a booking. | Twenty visits, at least eighty seat-hours in a published calendar. These are proposed resources, not observed capacity. |
| Green Goods — assisted session | **2 Green Goods vouchers:** one forty-five-minute remote or in-person session to set up a garden or document a contribution. Publish the facilitator, language and appointment times before booking. | Up to ten sessions, seven and a half facilitator-hours, if every GG voucher is used for assistance. |
| Green Goods — Claude access | **10 Green Goods vouchers:** thirty consecutive days of a named Claude Team **Standard** seat in Green Goods' organization, starting when the participant can sign in and confirms access. No automatic renewal or additional voucher charge. | Approved to run with up to ten funded seats. The twenty-voucher ceiling covers two seat-periods at a time; whether to mint more GG vouchers or recirculate returned ones is open, as is confirming that participant seats are permitted under the supplier terms. |

These are full-access offers at their stated scope, rather than discounts requiring an unstated
cash contribution. A four-hour hub visit is one booking; unused time does not create another
visit. Assistance excludes ongoing delivery or maintenance beyond the booked session. Holding
a voucher confers the issuer's published service rights, never garden governance or Safe control.

The two Green Goods offers share **one** twenty-voucher service budget. A possible mix is one
Claude seat-period and five assisted sessions: `10 + 5 × 2 = 20`. Ten sessions plus two Claude
seat-periods would cost forty vouchers and is outside this draft. Green Goods must be capable
of honoring every permitted mix before releasing that inventory.

## Claude service definition and cost

The selected product is a named Standard seat in the Green Goods Claude Team organization.
The requested $20 reference corresponds to **annual billing**. Current US list prices are $20
per seat/month billed annually, or $25 billed monthly, excluding tax; Team requires at least two
members. These are dated supplier prices, not a voucher-to-dollar peg. Verify regional checkout,
existing paid seats and renewal terms before committing an operating budget.
[Anthropic pricing](https://claude.com/pricing),
[Team plan details](https://support.claude.com/en/articles/9266767-what-is-the-team-plan).

For a short pilot, propose monthly billing unless Green Goods already has funded annual seats.
Two new monthly Standard seats have a $50/month list-price floor before tax. Confirm whether an
owner occupies one of those seats: two participant seats may require additional paid allocation.
An annual price comparison does not authorize an annual purchase or promise a supplier refund.

Each person gets their own invited account and seat. Provider usage limits apply; this offer
promises neither unlimited use, API spend nor Premium access. Green Goods keeps paid extra usage
disabled for this offer unless it separately publishes and funds a bounded allowance. The holder
sees the workspace/admin data policy before accepting; no private prompts, emails or invitations
are written to public Git or the public passport. Anthropic documents named-seat use and seat
administration in [its Team seat guide](https://support.claude.com/en/articles/12004354-purchase-and-manage-seats-on-team-plans).

A transferable service voucher does not transfer an Anthropic account or confer a right to
resell subscriptions. Before enabling this offer, Green Goods must confirm that its intended
participant provisioning is permitted by its supplier agreement; Anthropic's
[Commercial Terms](https://www.anthropic.com/legal/commercial-terms) restrict resale without express
approval. This draft establishes no such approval. If provisioning is unavailable, leave this
specific offer unavailable; do not substitute shared logins, individual Pro or API credits.
The other approved services may proceed independently.

## Accepted ceilings and proposed inventory allocation

| Limit | Tech and Sun | Green Goods | Meaning |
|---|---:|---:|---|
| Total initial voucher supply / issuance ceiling | 20 | 20 | No automatic increase or replenishment by minting. Bind the actual token implementation and authorities. |
| Initial shared-pool inventory | 10 | 10 | Part of the twenty issued units; not additional capacity. Pool stock is available for swaps, not the reward adapter. |
| Initial issuer reserve | 10 | 10 | Separate issuer-controlled custody; actual reserve addresses remain open. |
| Initial adapter allowance | At most 10 | At most 10 | Finite allowance from that reserve to the exact adapter. Lower it to actual stock and remaining service budget; never unlimited. |
| Per-participant operational limit | 10 | 10 | Ten units allows a whole Claude redemption. This is an admission/distribution rule until selected limiter enforcement is proved; do not claim a global transfer restriction. |
| Initial pool holding ceiling per asset | 20 | 20 | Accepted on 23 October: ten units of starting inventory and a twenty-unit holding cap per asset, within the existing twenty-unit issuance ceiling. This leaves ten units of incoming swap headroom; bind and read back the separate pool limiter setting. |
| Whole-pilot discharged service budget | 20 visits | 20 GG units | Cumulative delivered service cost, not a token balance or automatically reset allowance. |

The accepted cohort ceiling is ten invited participants. Propose adults only for the first
operating cohort, with no public sale. Any participant purchase in this pilot is the bounded
voucher-to-voucher pool exchange;
fiat, cash-out, a G$ purchase and the Tech and Sun cash swap-back example are outside these terms.
Optional G$ rewards retain their separate Celo consent, custody, receipts and recovery.

For the initial shared pool, the accepted baseline is a **1:1 gross voucher exchange ratio**.
Propose zero configured fees where supported and verified, and no cash peg. The selected ratio
is a pilot exchange setting, not a claim that the issuers' services have equal time, cost or
market value. Admission, inventory,
fees, limiter and the actual minimum-output/deadline quote govern each transaction. Do not
advertise a whole ten-GG-voucher subscription exchange if net available output is below ten.

A proposed six-decimal token would encode one voucher as `1_000_000` base units; deployment must
pin and verify the selected token's actual decimals. These human units do not select a token
implementation or authorize changing existing assets. Keep service quantities and token amounts
separate in the accepted terms.

## Capacity and obligations

Keep four numbers separate for each issuer: deliverable capacity, usable reserve balance,
remaining adapter allowance, and accepted-but-undelivered rewards. A reward acceptance reserves
no inventory automatically. Operators must account for these promises before accepting more
work, or stop accepting rewards when coverage is insufficient. Never display reserve and pool
stock as if both were spendable by the same adapter.

Returned delivered vouchers remain in the issuer reserve but **do not restore consumed service
capacity**. Example: ten GG vouchers returned after one completed Claude seat-period leave ten
GG units of the twenty-unit pilot budget. Distributing all twenty reserve units again would
exceed that budget. Quarantine returned inventory unless remaining capacity covers its reuse;
use finite allowance and pause/revoke paths to stop distribution. A new service budget needs
explicit issuer approval. Token supply, transfers and service discharge remain distinct; no
automatic burn is assumed.

Each live offer needs its own approved revision. A request states its required work, review and
whole redeemable reward: an AI-access request must award **ten GG vouchers in total** if that is
the promised service. A group reward divides its agreed total and does not promise ten to every
participant. Completing work, delivery of the earned voucher and delivery of its service are
separate obligations with separate evidence.

## Booking, activation and remedies

First bookings open on 28 October, with a published booking calendar through 31 December
2026. Confirm local opening hours and every participant's timezone. Closing this pilot window
stops new offers; it does not erase outstanding service rights or force an escrow settlement.

1. The holder sees the issuer, exact offer revision, scope, voucher cost, availability, help
   contact and remedy before consenting. For Claude, confirm a provisionable named seat and
   funded access period first. Keep participant/account eligibility separate from token ownership.
2. Link the existing service promise and exact consent. Obtain the authenticated full escrow
   before activating that promise under the implemented protocol. This activation records the
   commitment; external hub access, assistance or a Claude subscription has its own delivery start.
3. The issuer confirms a booking within a proposed two business days. An unanswered request
   creates a help/recovery case, not automatic acceptance, delivery, forfeiture or refund.
   Before external service starts, cancellation has zero delivered units and all escrowed vouchers
   refundable through the supported agreed lifecycle. No proposed cancellation fee or no-show burn.
4. The holder reviews delivery evidence and approves **one immutable final allocation** of
   delivered and refundable voucher amounts. A transfer, activation, provider invoice, timeout or
   issuer assertion alone cannot provide that approval. Preserve disputes and existing confirmer
   provenance; no unilateral completion or revision of a fixed allocation.
5. Full delivery returns the approved cost to the issuer reserve. Non-delivery returns the
   undelivered allocation to the holder. Partial delivery uses the accepted calculation below,
   agreed and reviewed before the allocation is fixed. Transfer legs and acknowledgments retry
   that fixed result without changing it or moving any unit twice.

| Service | Proposed partial-delivery calculation |
|---|---|
| Hub visit | Holder-approved usable minutes / 240, capped at the agreed one-voucher cost. Provider-caused loss of the promised power/connectivity is reflected in usable time; a mutually accepted equivalent may be agreed before the allocation is fixed. |
| Assisted session | Holder-approved delivered minutes / 45 × 2, capped at two GG vouchers. A failed connection with no useful session is zero delivered. |
| Claude access | Holder-approved available days / 30 × 10 GG vouchers. The thirty-day clock starts with working access, not the invitation or invoice. A seven-day failure is not a full subscription delivery. Normal disclosed provider usage limits do not count as an outage; loss of the promised seat does. |

Calculate delivered base units by rounding down at verified token precision; refundable amount
is the exact escrowed amount minus delivered, so no unit is lost or counted twice. These are
proposed issuer policies to bind into accepted terms and exercise against actual contract units;
they are not a claim that the app already calculates or adjudicates every partial outcome.

Propose a help acknowledgment within two business days and a remedy proposal within five.
The issuer offers a new appointment, extension or equivalent service only with holder consent.
If this requires changing the accepted promise, use the supported lifecycle before a final
allocation is fixed. If a voucher is returned but the issuer cannot honor future service,
record that unresolved obligation and suspend further issuance; do not call the voucher return
cash compensation or successful service delivery. No timeout resolves a disputed case by itself.

## Inputs needed to turn this into live terms

The accepted business baseline fixes the current prices, issuance ceilings, cohort ceiling and
initial exchange ratio. Each issuer must confirm its deliverable quantities, calendar, remedies
and caps, and identify its accountable service operator and help route. Green Goods must additionally
confirm its actual Claude organization, permitted participant provisioning, funded seat capacity,
billing interval and participant-visible workspace/data rules. Keep those private records private;
only a public-safe acceptance reference belongs here.

The deployment manifest must then bind each issuer's Gnosis token, reserve, owner/admin Safe,
threshold, adapter and finite allowance; shared pool/registry/limiter/fee controls; Arbitrum
source authorities and both authenticated transport peers; plus pause and recovery authorities.
No address, signer, approved capacity or supplier permission is fabricated by this draft.

The user selected reuse of the existing Green Goods Safe on Gnosis on 22 October Pacific:
`0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19`. The [pinned read](artifacts/green-goods-safe-gnosis-2026-10-22.json)
records five owners and threshold two. Reuse preserves that configuration; it does not authorize
owner/threshold changes, a new module, an allowance or asset movement. Read back the selected
Safe's state again when binding the executable deployment manifest.

The user selected the **same existing Green Goods Gnosis Safe** for network exchange-pool
administration and the Green Goods issuer reserve. Keep its current **2-of-5** owners/threshold.
This supersedes the separate 3-of-4 pool Safe and joint Green Goods/Tech and Sun signer proposal;
no additional Green Goods Safe is needed. Pool participation grants no administrative seat.
The same authority controls these two roles, while pool inventory and issuer reserve allocations
still need separate accounting. No configuration change or asset movement is authorized here.

Tech and Sun retains a separate issuer-reserve Safe, initially **2-of-3**. The intended signers
are its active garden stewards, replacing the earlier service-lead/finance/backup job-title
proposal. Actual accounts remain unconfirmed; use verified, distinct, Gnosis-compatible signing
accounts. A steward grant should make that account eligible for signing; a revocation should
remove its signing eligibility through the selected verified synchronization path.

The selected threshold is **two valid steward signatures at every roster size**, superseding
majority signing. The bootstrap can still be 2-of-3, with names and addresses confirmed later.
Fewer than two valid signers blocks spending. A new Tech and Sun Safe uses the published
[Hats Signer Gate v2.0.0](https://github.com/Hats-Protocol/hats-zodiac/tree/2c0172e979e64f6f73647adc634a4622cba465ef),
a dedicated Gnosis signer Hat and the authenticated Arbitrum role mirror. The receiver controls
the signer Hat; the Safe cannot rewrite its own eligibility. HSG is locked with no extra modules
or delegatecall targets. Existing Green Goods Safe custody is unchanged.

`HatsModule` role hooks automatically dispatch canonical steward changes when the publisher has
native transport fuel. Fuel or transport failure leaves the change queued; anyone can refresh
or pay the quoted CCIP fee directly. Initial existing stewards need a refresh. The Gnosis
receiver applies ordered updates and reconciles Safe owners. Failed
cleanup does not restore a delivered revoked signer's eligibility. Destination delivery is
asynchronous; do not claim instant revocation across chains. Roles changed outside the hooks
need an explicit refresh. Below two owners, Safe may display threshold one, while HSG still
blocks execution. Source garden administrators can grant replacement stewards even when the
issuer Safe cannot spend. Actual accounts, source upgrade/registration, funded dispatch and live
activation remain pending. Local fork proof uses fictional roles and delivery; it establishes
neither real signer control nor DON operation.

Existing Safe controls, implemented delays, consent, full escrow before promise activation,
immutable final allocation and independent Celo G$ remain authoritative. The accepted hackathon
external-audit exemption and replacement of the two-week testnet wait are already recorded in
the deployment package; they do not substitute for issuer acceptance or working deployment inputs.
