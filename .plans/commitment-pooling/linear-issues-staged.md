# Linear issues — staged for creation (Seasons & Campaigns project)

> **Errata — 2026-06-28:** This is a historical staging export only. Do not use it to create or
> recreate implementation child issues. Current Linear source of truth uses one durable Green Goods
> Garden Commitment Pool identity/control plane, with proof and settlement capabilities attached to
> the same `poolId`. Premature draft child issues PRD-652 through PRD-658 were canceled and
> detached pending deeper implementation scoping.

> Staged 2026-06-28 because a transient safety-classifier outage blocked Linear writes. Project: **Green Goods Seasons & Campaigns** (`fa1b7a04-6eee-4f43-a861-07d8205aa0bf`). Create issues 1–3 first; then 4 & 5 as children of issue 3 (the epic). Each "accompanying document" is copied from the `.plans/commitment-pooling/` files.

---

## Issue 1 — Research

- **Title:** research: Commitment pooling — goal, model & key decisions
- **Team:** Research · **Project:** Green Goods Seasons & Campaigns · **Labels:** `activity:research`, `protocol:green-goods`
- **Accompanying doc:** `research-memo.md`

## Research Output
A shared, decision-ready understanding of what "commitment pooling" means for Green Goods and the decisions already locked — so the team, collaborators, and funders can get oriented without re-deriving it.

## What this is (short version)
- We're building the Grassroots Economics / Sarafu **mutual-credit** commitment pool (a curated garden ledger of promises members exchange) — **not** the Allo "threshold-pledge" mechanism that shares the name.
- **Green Goods is the ownership / permission / evidence / UX layer.** Sarafu is a clean-room reference, not a second product members must learn.
- Build **Arbitrum-native first**, denomination-agnostic (DAI today; G$ if/when it reaches Arbitrum).

## Key decisions locked
- **Two unified models** — Model A: attestation substrate (commitment → work evidence → fulfillment confirmation → hypercert; July-shippable). Model B: ERC-20 vouchers + owner-governed swap pool (later; reuses A's attestations).
- **Fulfillment = counterparty-confirmed** (the member helped confirms), operator fallback for high-value/disputed.
- **Build our own contracts** clean-room, non-AGPL, ABI-compatible.
- Support **both** reserve-backed and reserve-less pools, and **both** transferable (→ B) and soulbound (→ A) vouchers.
- Valuation defaults to **time/effort units**; non-fulfillment = **clawback** (slash issuer's seed, never a good-faith holder); operators set caps; members **self-custodial** via the PWA.
- **Mutual-aid framing**, not marketplace. Commitment pooling **is the Seasons primitive**.

## Acceptance criteria
- Memo reviewed and accepted as the shared reference.
- Naming distinction (mutual-credit vs threshold-pledge) agreed and reflected in editorial copy.
- Open items owned: G$-on-Arbitrum confirmation (Sam/GoodDollar), AGPL clean-room counsel sign-off, PRD-473 promotion.

## Boundary
No contract code, schema, or chain commitment beyond Arbitrum-first. Shared understanding + locked decisions only; implementation lives in the Product architecture issue.

## Decision / exit
Done when goal/model/decisions are accepted as reference and PRD-473 is updated to point here.

---

## Issue 2 — Research

- **Title:** research: Commitment pooling — use cases across the 4 domains
- **Team:** Research · **Project:** Green Goods Seasons & Campaigns · **Labels:** `activity:research`, `protocol:green-goods`
- **Accompanying doc:** *Commitment Pooling — Use Cases* (extract of memo §User scenarios + §Circular economy)

## Research Output
A concrete, human-readable set of use cases showing how commitment pooling plays out in real Green Goods gardens — across all four domains, for digital-native and analog communities, and for both domain-action and support/service commitments.

## Use cases to cover
- **AGRO** — farmers pool seasonal labor (the granary model); Trisha's Costa Rica analog community, operator-mediated.
- **EDU** — facilitator commits to workshops; participants confirm; learning-hours → hypercert.
- **SOLAR** — installer commits to an install; IoT (meter/inverter) evidence; host confirms.
- **WASTE** — cleanup crew commits to a route; before/after + GPS; community witnesses.
- **Support / service (non-domain)** — meals, tool-lending, childcare, rides — connective tissue; circulates in the pool but stays out of the impact ledger.
- **Within-garden** circular economy (reserve-less works); **cross-garden** circulation (transferable vouchers + shared denomination, later).

## Acceptance criteria
- Each of the 4 domains has ≥1 tangible scenario (actor · commitment · evidence · confirmation · settlement).
- Domain-vs-support distinction illustrated.
- Analog/Trisha onboarding path described (self-custodial gardener + operator-assisted capture).
- Cross-garden circulation sketched (scoped as later / Model B).

## Boundary
Scenarios and requirements only — no schema or contract design.

## Decision / exit
Done when the use cases are accepted as the shared picture of "what good looks like" and feed the PWA/editorial UX and first pilot-garden selection.

---

## Issue 3 — Product (EPIC)

- **Title:** Commitment pooling — software architecture
- **Team:** Product · **Project:** Green Goods Seasons & Campaigns · **Labels:** `activity:architecture`, `protocol:green-goods`
- **Accompanying docs:** `model-a-spec.md` (+ Model B spec, coming)

## What this tracks
The software architecture for commitment pooling as a native garden capability — the two-model design and how it reuses existing Green Goods rails. Epic; child issues track Model A and Model B.

## Architecture in one picture
- **Model A (July substrate):** commitments + fulfillment as EAS attestations, reusing `Work`/`WorkApproval`; aggregate state in two new resolvers, indexed by Envio; surfaced on garden pages. Soulbound, no reserve.
- **Model B (later settlement):** ERC-20 vouchers (GoodsToken template) + clean-room non-AGPL owner-governed swap pool owned by the Garden TBA; seed/collateral; reserve (DAI → G$); cross-garden.
- Both map to the **6 Hats roles**; fulfilled domain commitments feed **hypercerts** → conviction-weighted funding (the existing `YieldResolver` seam).

## Reuses (verified in code)
`IGardenAccessControl` + Hats roles · `Work`/`WorkApproval`/`Assessment` resolvers · `confidence` + `verificationMethod` (HUMAN/IOT/ONCHAIN/AGENT) · Garden TBA `execute()` ownership · `YieldResolver` (extensible 4th leg) · `Hypercerts` · Envio indexer.

## Acceptance criteria
- Model A and Model B specs reviewed (incl. an adversarial pass on the resolver design) and accepted.
- New on-chain surface enumerated (2 resolvers for A; voucher + pool for B) with existing-rail reuse explicit.
- Open architecture decisions tracked: reserve custody, seed mechanics, dual-voucher contract shape, cross-garden valuation, permission-hook reconciliation.

## Out of scope
Non-technical goal/use-case framing — see the two Research issues in this project.

---

## Issue 4 — Product (child of Issue 3)

- **Title:** Model A — attestation substrate (July)
- **Team:** Product · **Project:** Green Goods Seasons & Campaigns · **Parent:** Issue 3 · **Labels:** `activity:architecture`, `protocol:green-goods`, `package:contracts`, `package:shared`, `package:indexer`
- **Accompanying doc:** `model-a-spec.md`

## Goal
Ship the July-shippable commitment-pool substrate: commitments + fulfillment as on-chain attestations, surfaced on garden pages, riding existing rails. DAI-denominated, all active gardens × 4 domains.

## Scope
- `CommitmentResolver` + `FulfillmentConfirmationResolver` (UUPS EAS resolvers) mirroring `Work`/`WorkApproval`.
- `commitmentType` (DOMAIN_ACTION | SUPPORT_SERVICE) — domain commitments link a `Work` attestation; support commitments stand alone (pool-only, no impact).
- Counterparty-confirmed fulfillment + operator fallback + value-threshold escalation; self-attestation blocked.
- Per-garden aggregate state in the resolvers + events; add both to the Envio `config.yaml`.
- Shared hooks (`useGardenCommitments`, `useCreateCommitment`, `useConfirmFulfillment`, `useCommitmentPoolStats`).
- PWA "Pools" tab (replaces the coming-soon stub), admin config + dispute/default, editorial garden-page pool story.

## Acceptance criteria
- Commitments and confirmations can be created on Arbitrum; self-attestation and cap checks enforced.
- Domain commitments require a linked Work attestation; support commitments don't.
- Garden pages show made/fulfilled/circulating from indexed data (no bespoke API).
- Mutual-aid copy; no debt/leaderboard language.

## Out of scope (→ Model B)
ERC-20 vouchers, transferability, swap pool, seed/collateral, reserve denomination, cross-garden.

## Open questions (from the spec)
Base unit (HOURS v1?), open-offer claim step, in-resolver state vs aggregator contract, dispute UX.

---

## Issue 5 — Product (child of Issue 3)

- **Title:** Model B — vouchers & owner-governed swap pool
- **Team:** Product · **Project:** Green Goods Seasons & Campaigns · **Parent:** Issue 3 · **Labels:** `activity:architecture`, `protocol:green-goods`, `package:contracts`, `package:shared`
- **Accompanying doc:** *Model B Spec* (coming)

## Goal
The settlement layer that snaps onto Model A: transferable ERC-20 vouchers + a clean-room, non-AGPL, owner-governed swap pool owned by the Garden TBA, with seed/collateral and a reserve denomination — enabling exchange-in/out, redemption, and (later) cross-garden circulation.

## Scope
- ERC-20 voucher (GoodsToken template); transferable vs soulbound handling.
- Clean-room swap pool (curate/limit/value/swap) — ABI-compatible with Sarafu's CIC interface, our own non-AGPL source; fixes Sarafu's flaws (gated seal, `Ownable2Step`, settable registry, constructor owner = Garden TBA).
- Seed/collateral mechanics (issuer stake; slash-on-default makes holders whole).
- Reserve denomination: DAI now; G$ pending GoodDollar/Arbitrum confirmation.
- A 4th `YieldResolver` leg to route yield into the pool reserve.

## Acceptance criteria
- A non-AGPL pool contract (counsel sign-off on clean-room) deployable on Arbitrum, owned by the Garden TBA.
- Seeding, exchange-in/out, redemption work; default slashes the issuer's seed, not a good-faith holder.
- Transferable vouchers usable across gardens via curation (scoped).

## Depends on
Model A (uses its attestations as proof-of-fulfillment) · G$-on-Arbitrum confirmation · AGPL counsel sign-off.

## Open questions
Dual-voucher contract shape (flag vs ERC-20 + SBT), cross-garden valuation, seed sizing, reserve custody.
