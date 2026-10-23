# Pilot issuer terms — working draft

**Version:** `pilot-2026-10-22-draft-1` · **Status:** proposed terms; no live offer or capacity approval.

The selected services are Tech and Sun hub access, Green Goods assisted sessions, and Claude
access under a Green Goods team. Quantities, voucher prices, caps and operating deadlines below
are proposals for the bounded pilot. Neither issuer has yet supplied confirmed capacity,
accountable addresses or its acceptance record. The [deployment package](handoffs/codex-live-pilot-deployment.md)
tracks those inputs separately from technical readiness.

## Services and voucher prices

| Issuer / offer | Full service for the stated voucher price | Proposed availability |
|---|---|---|
| Tech and Sun — hub day | **1 Tech and Sun voucher:** one named person's reserved visit of up to four hours, including workspace, power and connectivity. Publish the location, opening hours and equipment restrictions before accepting a booking. | Twenty visits, at least eighty seat-hours in a published calendar. These are proposed resources, not observed capacity. |
| Green Goods — assisted session | **1 Green Goods voucher:** one thirty-minute remote or in-person session to set up a garden or document a contribution. Publish the facilitator, language and appointment times before booking. | Up to twenty sessions, ten facilitator-hours, if every GG voucher is used for assistance. |
| Green Goods — Claude access | **10 Green Goods vouchers:** thirty consecutive days of a named Claude Team **Standard** seat in Green Goods' organization, starting when the participant can sign in and confirms access. No automatic renewal or additional voucher charge. | Up to two seat-periods if every GG voucher is used for Claude. Budget and eligible seat provisioning are still unconfirmed. |

These are full-access offers at their stated scope, rather than discounts requiring an unstated
cash contribution. A four-hour hub visit is one booking; unused time does not create another
visit. Assistance excludes ongoing delivery or maintenance beyond the booked session. Holding
a voucher confers the issuer's published service rights, never garden governance or Safe control.

The two Green Goods offers share **one** twenty-voucher service budget. A possible mix is one
Claude seat-period and ten assisted sessions: `10 + 10 × 1 = 20`. Twenty sessions plus two Claude
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

## Proposed pilot limits and inventory

| Limit | Tech and Sun | Green Goods | Meaning |
|---|---:|---:|---|
| Total initial voucher supply / issuance ceiling | 20 | 20 | No automatic increase or replenishment by minting. Bind the actual token implementation and authorities. |
| Initial shared-pool inventory | 10 | 10 | Part of the twenty issued units; not additional capacity. Pool stock is available for swaps, not the reward adapter. |
| Initial issuer reserve | 10 | 10 | Separate issuer-controlled custody; actual reserve addresses remain open. |
| Initial adapter allowance | At most 10 | At most 10 | Finite allowance from that reserve to the exact adapter. Lower it to actual stock and remaining service budget; never unlimited. |
| Per-participant operational limit | 10 | 10 | Ten units allows a whole Claude redemption. This is an admission/distribution rule until selected limiter enforcement is proved; do not claim a global transfer restriction. |
| Initial pool holding ceiling per asset | 10 | 10 | Separate pool limiter setting, subject to exact implementation semantics and readback. It can constrain one direction of exchange even when the other direction has stock. |
| Whole-pilot discharged service budget | 20 visits | 20 GG units | Cumulative delivered service cost, not a token balance or automatically reset allowance. |

Propose at most ten invited adult participants for the first operating cohort, with no public
sale. Any participant purchase in this pilot is the bounded voucher-to-voucher pool exchange;
fiat, cash-out, a G$ purchase and the Tech and Sun cash swap-back example are outside these terms.
Optional G$ rewards retain their separate Celo consent, custody, receipts and recovery.

For the initial shared pool, propose a **1:1 gross voucher exchange ratio**, with zero configured
fees where supported and verified, and no cash peg. This is a proposed exchange setting, not a
claim that the issuers' services have equal time, cost or market value. Admission, inventory,
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

Propose first bookings on 25–26 October and a published booking calendar through 30 November
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
| Assisted session | Holder-approved delivered minutes / 30, capped at one GG voucher. A failed connection with no useful session is zero delivered. |
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

Each issuer must accept or revise its services, quantities, prices, calendar, remedies and caps,
and identify its accountable service operator and help route. Green Goods must additionally
confirm its actual Claude organization, permitted participant provisioning, funded seat capacity,
billing interval and participant-visible workspace/data rules. Keep those private records private;
only a public-safe acceptance reference belongs here.

The deployment manifest must then bind each issuer's Gnosis token, reserve, owner/admin Safe,
threshold, adapter and finite allowance; shared pool/registry/limiter/fee controls; Arbitrum
source authorities and both authenticated transport peers; plus pause and recovery authorities.
No address, signer, approved capacity or supplier permission is fabricated by this draft.

Existing Safe controls, implemented delays, consent, full escrow before promise activation,
immutable final allocation and independent Celo G$ remain authoritative. The accepted hackathon
external-audit exemption and replacement of the two-week testnet wait are already recorded in
the deployment package; they do not substitute for issuer acceptance or working deployment inputs.
