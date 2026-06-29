# Research Memo — Commitment Pooling for Green Goods — v2 (Arbitrum-native) — 2026-06-27

> **Errata — 2026-06-28:** This file is a historical reference export, not the current source of
> truth. Current Linear framing centers one durable Green Goods Garden Commitment Pool
> identity/control plane. Proof/attestation and settlement/voucher behavior are capabilities
> attached to the same `poolId`, not separate pool constructs. Do not build a disposable Model A
> pool that later gets replaced by a Model B pool. Where this memo says "two unified models,"
> "Model A is the permanent foundation," or "Model B swap pool," read that as: durable pool
> identity/control plane first, proof capability first, optional settlement adapter later. Current
> Linear documents also supersede any local text that recommends resolver-held aggregate state:
> resolvers validate attestations; the shared pool control-plane/aggregator emits indexable stats.

> **Changelog — v2 (2026-06-27):** Supersedes v1's "off-chain-first" lean. Revised after Afo + Codex input to **Green Goods-as-the-layer, Arbitrum-native, on-chain, two-model** framing. v1's durable findings (Sarafu mechanics, UX pain points, the naming trap, the role model) are preserved below; the chain/sequencing recommendation changed.

- **Owner:** afo (Green Goods deep / cross-cutting research lane)
- **Team:** Research (`RESR`)
- **Related delivery:** House of Alignment (GoodDollar) — `PRD` · [PRD-473](https://linear.app/greenpill-dev-guild/issue/PRD-473) (commitment-pool strategy) · chain decision shared with [PRD-475](https://linear.app/greenpill-dev-guild/issue/PRD-475)
- **Proposed parent issue:** `RESR-XX — research: Commitment pooling for Green Goods`
- **Initiative:** Sustainability & Monetization
- **Status:** Research memo / architecture-decision artifact (pre-build)
- **Created from:** Claude Code research session (source PDF + Sarafu/GE primary-source contract reads + codebase grounding + Linear + Codex memo)
- **Date:** 2026-06-27

---

## Thesis (revised)

**Green Goods is the ownership, permission, evidence, and reporting layer for commitment pooling. Sarafu is a reference implementation we clean-room from — not a second product the user has to understand.** A pool is not just a market object; it is a **garden-governed commitment surface** whose ownership, issuer permissions, seeding limits, fulfillment validation, and reporting all map to existing Green Goods garden roles. Build **Arbitrum-native first**; cross-chain and shared liquidity are a later, maturity-gated concern.

## Research Output

A decision-ready architecture memo that: (1) keeps the two-mechanism naming straight, (2) presents the **headline design decisions** with recommendations, (3) gives a **deep, code-grounded mapping** of the Green Goods protocol (roles, resolvers, verification, value primitives, hypercerts, domains, seasons) to commitment pooling, (4) defines the **two unified on-chain models** and a Sarafu-compatible-but-non-AGPL contract path, (5) lays out **user flows** wired to the existing submit/approve-work flow and **tangible per-domain user scenarios**, (6) answers all of Afo's follow-up questions, and (7) proposes the `RESR-*` tree and resource documents — before any build.

## Decision this informs

Promotion of [PRD-473](https://linear.app/greenpill-dev-guild/issue/PRD-473); the fulfillment-authority and chain decisions; build-our-own-vs-fork; client/admin/editorial scope; how commitment pooling becomes the Seasons & Campaigns primitive; and the research backlog.

---

## Headline decisions (lead here)

**D1 — Fulfillment authority — DECIDED 2026-06-27: counterparty-confirmed default + operator fallback.** Mutual credit is *peer-to-peer*: in the granary example, the family that received help confirms the promise was kept. But Green Goods's `WorkApproval` resolver is **operator-only and self-attestation-blocked** (`packages/contracts/src/resolvers/WorkApproval.sol:149,154`). Reusing it as-is bottlenecks *every* fulfillment through one role and drops the peer dynamic that makes this a commitment pool rather than relabeled work-tracking. Options:
- **(a) Operator-approved** — reuse `WorkApproval` unchanged. Lowest build, fits today, but a bottleneck and not truly mutual.
- **(b) Counterparty-confirmed (recommended primary)** — the member who received the good/labor confirms fulfillment via a *new* `FulfillmentConfirmation` attestation path (attester = beneficiary, self-attestation still blocked). Fits mutual credit; reuses `confidence` + the `verificationMethod` bitmask.
- **(c) Community/peer witness** — a community member co-signs (the "families gather" model). Broadest, weakest individual accountability.
- **Decision (Afo, 2026-06-27): (b) counterparty-confirmed as the default, with (a) operator approval as fallback/escalation** for high-value, disputed, or unmatched commitments — preserving the peer dynamic while keeping operator oversight. **Build implication:** a new `FulfillmentConfirmation` resolver (attester = the beneficiary; self-attestation blocked; carries `confidence` + `verificationMethod`), with the existing `WorkApproval` as the operator escalation path. Maps cleanly to roles (below).

**D2 — Chain: Arbitrum-native, denomination-agnostic.** Per Afo's call: build on **Arbitrum first, no cross-chain** until mature enough for shared liquidity. The pool is **denomination-agnostic** — on Arbitrum the live reserve/community token is already **DAI** (`0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1`; `deployments/networks.json`). **G$ is decoupled** — see D2a.

**D2a — The G$-on-Arbitrum premise needs partner confirmation.** GoodDollar's own current docs say **G$ is deployed on Ethereum, Celo, Fuse, XDC — *not* Arbitrum or Base** ([GoodDollar docs](https://docs.gooddollar.org/); the GoodWallet *supports* Base/Polygon/Optimism/BNB as a wallet UI, which is not the same as a native G$ deployment). This contradicts the working assumption that "GoodDollar is on Arbitrum." **One crisp action for Afo: confirm with Sam McCarthy / GoodDollar whether G$ can reach Arbitrum (native deploy or official bridge).** Until confirmed, treat G$-as-denomination as a dependency, not a given — and note this lands on the *existing* HoA distribution-chain decision ([PRD-475](https://linear.app/greenpill-dev-guild/issue/PRD-475) is chain-undecided), not something pooling introduces. The architecture does **not** block on it: DAI denominates today; G$ slots in when it's on Arbitrum.

**D3 — Build our own contracts, clean-room, non-AGPL, ABI-compatible.** The GE contracts are AGPL-3.0; Green Goods is a non-AGPL product. **AGPL binds the implementation source, not the ABI/function selectors** (Google v. Oracle), and the mechanism is ~30 lines (allow-list + cap + external quoter + two transfers — no AMM math). So Green Goods **clean-room reimplements** from the public spec (PDF + docs + ABI), keeping its source non-AGPL while remaining ABI-compatible with Sarafu tooling for *optional* future interop. This also lets us **fix Sarafu's real flaws**: owner-gate `seal()` (currently ungated — a griefing surface), use `Ownable2Step`, make the registry/limiter swappable, and set `owner` via constructor so a Garden TBA/Safe owns the pool atomically. *(Human-judgment point: confirm the clean-room process and the ABI-vs-source reasoning with counsel before shipping; engineering assessment only.)*

**D4 — Two unified models, not either/or.** **Model A (attestation substrate)** — a commitment is an EAS attestation; fulfillment is a Work + (counterparty/operator) confirmation attestation; impact closes via hypercerts. This *is* the "purely attestation-based version" Afo asked about, and it is the **permanent foundation**, not training wheels. **Model B (settlement layer)** — ERC-20 vouchers + an owner-governed swap pool owned by the Garden TBA — **snaps onto A and uses A's attestations as proof-of-fulfillment.** July ships A; B is the maturation.

**D5 — One garden-scoped pool to start; cross-garden later.** A garden is the natural trust boundary. Auto-provision **one commitment pool per garden** (via the existing `onGardenMinted` factory pattern that already spins up vaults and cookie jars), stewarded by operators — not a Sarafu-style free-for-all of user-created pools. Multiple pools (per-domain, per-season) and **cross-garden liquidity** (transferable vouchers + shared denomination + curation federation) are Model-B, post-July extensions.

---

## Resolved design decisions — 2026-06-28 (co-design round 2)

Extends D1–D5 with Afo's answers to the open-question set. ★ = Afo asked me to recommend.

| Topic | Decision |
| -- | -- |
| **Reserve** | **Support both** reserve-backed (DAI/G$) *and* reserve-less (pure mutual credit, no denomination asset). The pool ledger/contract must **not hard-require a reserve**. |
| **Voucher type** | **Support both transferable and soulbound** — and they map onto the two models: **soulbound commitment = Model A** (on-chain attestation, non-transferable); **transferable voucher = Model B** (ERC-20). |
| **Valuation ★** | **Default to time/effort units** (egalitarian, no pricing-steward, sidesteps Sarafu's #1 friction "pricing disputes"); **optional operator-set relative value** only for reserve-backed pools. Start minimal. |
| **Non-fulfillment** | **Voucher clawback** (GreenWill reputation not yet mature). Clawback hits soulbound commitments directly and the issuer's **seed/stake** for transferable vouchers — **never a downstream good-faith holder**. Reputation penalties layer in as GreenWill matures. |
| **Disputes** | **Operator fallback for v1**; evaluator/community panel for certain (high-value/contested) commitment classes long-term. |
| **Sybil/collusion ★** | v1: **garden membership is the Sybil floor** (Hats roles are operator-granted — you can't mint fake gardeners) + **value-threshold escalation** to operator co-sign above a cap + **public, auditable on-chain confirmations** (operators can spot A↔B mutual-confirm loops). No reputation-graph detection in v1. |
| **Caps** | **Operators** set per-issuer exposure caps (the "limit" step), tied to required seed for transferable vouchers. |
| **Member custody** | **Self-custodial** — analog members join as regular Green Goods gardeners via the PWA (passkey; ~80% have smartphones). Operators **assist capture** (data entry, offline) but never custody accounts. No USSD/custodial stack. |
| **On-chain** | **Commitments/vouchers are on-chain** — attestations (soulbound/Model A) or ERC-20 (transferable/Model B). Nothing purely off-chain. |
| **Framing ★** | Mutual-aid, not marketplace: "offers / requests / promises kept", never "debt / owed / credit / market"; **no leaderboards or balance-shaming** (collective circulation, not individual debt rankings); reciprocity & relationships over accumulation; seeding = "offering", fulfillment = a celebrated moment; any expiry = "promises have a season". (Aligns with the banned-vocab system.) |
| **July MVP scope** | **All active Green Goods gardens, all 4 domains.** Feasible for **Model A** (it rides the existing per-domain `Work` flow); **Model B** (transferable vouchers + swap pool) phases in more gradually. |
| **Coherence** | **Commitment pools = action/service (doing & exchanging work); conviction pools = decision-making (allocating/prioritizing).** They already connect in code: the `YieldResolver` buys hypercert fractions **conviction-weighted**, so decision routes capital to fulfilled action. Deepen by design. |

---

## The two-model architecture (unified)

```
Model A — ATTESTATION SUBSTRATE (permanent, ships July)
  Commitment (EAS) ──▶ Work evidence (existing Work resolver)
        │                       │
        │                       ▼
        │            Fulfillment confirmation  ◀── D1: counterparty (default) / operator (fallback)
        │                       │
        ▼                       ▼
  Garden pool ledger     Hypercert allowlist ──▶ fractions ──▶ YieldResolver buys (conviction) ──▶ funding
  (registry/aggregate)                                                                                │
        ▲                                                                                             │
        └──────────────────────── seeds next season ◀────────────────────────────────────────────────┘

Model B — SETTLEMENT LAYER (snaps on later, uses A's attestations as proof)
  ERC-20 voucher (GoodsToken template) ──▶ owner-governed swap pool (owned by Garden TBA)
     curate (registry) · limit (limiter) · value (quoter) · exchange-in/out · redeem
     reserve = DAI now / G$ when on Arbitrum · pool fundable from a 4th YieldResolver leg
```

**Maturity ladder (revised — now on-chain rungs).** A commitment is a social primitive; the rungs add integrity/settlement, all on Arbitrum:

| Rung | Adds | Model | July? |
| -- | -- | -- | -- |
| 1 | Commitment attestation (who promises what, valued in time/effort/local terms) | A | ✅ |
| 2 | Work evidence (photo/voice/GPS/IoT) via existing `Work` resolver | A | ✅ |
| 3 | Fulfillment confirmation (counterparty/operator) + `confidence` + `verificationMethod` | A | ✅ |
| 4 | Pool aggregate state (commitments made/open/fulfilled) — needs a light registry or indexer extension | A | ◐ |
| 5 | Hypercert of fulfilled impact → fractions → funding | A | ◐ |
| 6 | ERC-20 vouchers + owner-governed swap pool (exchange-in/out, redeem) | B | ✕ |
| 7 | Reserve denomination (DAI→G$) + cross-garden liquidity | B | ✕ |

---

## Deep mapping: Green Goods protocol ↔ commitment pooling

All claims below are code-verified (file:line).

### Roles → pool capability matrix

Green Goods has **six on-chain roles via Hats Protocol** (`IGardenAccessControl.sol:16-46`; `packages/shared/src/utils/blockchain/garden-roles.ts:12-21`: gardener 0, evaluator 1, operator 2, owner 3, funder 4, community 5), with an inclusive hierarchy (owner→operator→evaluator→gardener) in `GardenAccount`. The app capability map is `packages/shared/src/hooks/roles/useRolePermissions.ts:16-32`.

| Role | Existing capability (verified) | Commitment-pool capability |
| -- | -- | -- |
| **Owner** | `canManageGarden` | Create/disable the garden pool; own the pool via the Garden TBA; emergency seal/pause; final policy authority |
| **Operator** | `canApproveWork`, `canManageRoles` | Configure pool (curate vouchers, set caps/limits, set values/rates), seed from garden funds, approve fulfillment (fallback path), steward |
| **Evaluator** | `canCreateAssessment` | Quality-grade fulfillment (`Assessment` resolver), review evidence, `qualityGrade` |
| **Gardener** | `canSubmitWork` | Create commitments/vouchers, seed own promises, request help, submit fulfillment evidence |
| **Funder** | (funder hat) | Seed the reserve (DAI/G$), view reporting, receive allocation/impact reports |
| **Community** | (community hat) | Discover offers, request help, **confirm/witness fulfillment** (D1 default path) |

> ⚠️ **Reconcile before building:** two permission surfaces disagree on `canManageGarden` — `useRolePermissions.ts:23` (owner-only) vs `useGardenPermissions.ts:39-42` (operator-OR-owner, and this is what actually gates the admin UI). Pick one for "who configures the pool."

### Resolvers → commitment lifecycle

Three real EAS `SchemaResolver`s (schemas in `packages/contracts/src/Schemas.sol`):
- **`Work.sol`** — attester must be gardener|operator; requires `title`+`metadata`; action must exist, be active, and **its domain must be in the garden's domain mask** (`Work.sol:101,134`). → **the "fulfillment evidence" step** of a commitment.
- **`WorkApproval.sol`** — operator-only (`:149`), **blocks self-attestation** (`:154`), carries **`confidence` (0–3)** (`:170`) and **`verificationMethod` (4-bit bitmask, 0–15)** (`:175`), links a specific `workUID`. → **the "fulfillment confirmation" step** (D1: reuse for operator path; add a sibling resolver for the counterparty path).
- **`Assessment.sol`** — evaluator|operator; single-domain (0–3). → **quality grading** of fulfilled commitments (`qualityGrade`).
- **`Yield.sol`** is **NOT** an EAS resolver — it's the `YieldResolver`/yield-splitter (see value primitives). *(v1 mis-labeled this.)*

> The v1 product spec already anticipates this: `docs/docs/builders/specs/v1-0.mdx` **Domain 5 "Mutual Credit and Farmer Verification"** names `commitmentPoolId`, `estimatedValue`, `qualityGrade`, and a **"Commitment Fulfilled"** action — **but these are spec-prose only; zero implementation exists** in any `.sol`/`.ts`. This memo is the bridge from that spec to a build.

### Verification methods → passive/IoT/agent capture

`packages/shared/src/types/domain.ts:102-107` defines exactly the bitmask Afo wants: `HUMAN=1, IOT=2, ONCHAIN=4, AGENT=8`, already wired into `WorkApproval`'s `verificationMethod`. **Passive capture (IoT sensors, AI agents) attaches to fulfillment confirmation with no new primitive** — it's a higher rung on the same evidence ladder, not a new axis.

### Value primitives → the ERC-20 model

- **Voucher = ERC-20** mirroring the existing `GoodsToken` template (`tokens/Goods.sol` — capped, ownable, mint-on-demand). GOODS is **not live on Arbitrum** (community token = DAI), so there's an open lane to introduce a voucher token without collision.
- **Owner-governed swap pool sits *beside* the Octant vault, not inside it.** Octant ERC-4626 vaults are sacred yield infra (users deposit/redeem directly; module is admin-only). A voucher↔reserve pool is a **separate contract owned by the Garden TBA** (`GardenAccount.execute(pool, 0, data, 0)`; the TBA can own external contracts — `accounts/Garden.sol` → ERC-6551 `execute`, gated by NFT owner, batch-executor enables atomic approve+swap).
- **`YieldResolver` is the "route value to N destinations" primitive to extend.** It already splits vault yield three ways — **Cookie Jar 48.65% / Hypercert fractions 48.65% / Juicebox-GOODS 2.7%** (`resolvers/Yield.sol:118-129`), per-garden configurable, permissionless trigger, must sum to 10000. **A 4th leg ("voucher reserve") routes yield into the pool** — structurally identical to the existing legs.
- **Cookie Jar** (`modules/CookieJar.sol`, 1Hive-backed, Hats-gated on the gardener hat) is a natural **redemption rail**: a gardener redeems a voucher → claims from the jar. *(Claim internals are external 1Hive code, not in-repo.)*

### Hypercerts → completing the loop

`modules/Hypercerts.sol` links hypercerts to **gardens** (`hypercertGarden[id] = garden`) and lists **fractions for yield** that the `YieldResolver` buys conviction-weighted. So: **fulfilled commitment (verified work) → operator registers a hypercert allowlist → fractions become the ownable proof of fulfilled impact → yield flows into them → funding seeds the next season's pool.** This is the circular economy completion — commitment pooling feeds the *existing* impact/funding rail rather than bolting on a parallel one.

### Domains → the 4-domain mapping (and the "Domain 5" question)

On-chain `Domain` enum is fixed at **four**: `SOLAR, AGRO, EDU, WASTE` (`registries/Action.sol:28`; garden domains are a 4-bit mask). The v1 spec's **"Domain 5: Mutual Credit"** has *no* on-chain home — adding it as a 5th domain means an enum + mask change. **Recommendation: do NOT make commitment pooling a 5th domain.** It is a *cross-domain capability* — a garden runs commitments *within* its existing domains. Per-domain scenarios below.

### Seasons & Campaigns → the cyclical cadence

There is **no Season/Campaign primitive in code** (Linear-only; `project_campaigns_as_seasons.md` parked it for a "Seasons primitive" reframe). **Commitment pooling can *be* that primitive.** The PDF's granary rotation is a season: seed → commit → fulfill → settle → report, pool returns to baseline but now there are new granaries + stronger ties + a record. Map: **season start** = seed pool (funders + HoA G$ distribution "boosts amounts locked in commitment pools" per PRD-473); **season** = gardeners make/fulfill commitments; **season end** = settle, mint hypercerts, report. This gives Seasons a financial heartbeat and gives commitment pooling its natural cadence — they should be designed together.

---

## What Sarafu gives us (clean-room reference, not a dependency)

The deployed Sarafu model (Celo; primary-source contract reads):
- **Pool = owner-governed, externally-priced swap** (not an AMM): `deposit`/`withdraw`(swap)/`getQuote` are **public**; `setFee`/`setFeeAddress`/`setQuoter`/`transferOwnership`/fee-sweep are **owner-gated**; **`seal()` is ungated** (griefing risk — we gate it). Registry/limiter are constructor-fixed (we make them settable).
- **curate / limit / value are three *separate*, independently-owned contracts** (TokenRegistry `add`/`remove` + `addWriter`; Limiter `setLimitFor`; PriceIndexQuoter `setPriceIndexValue`). "Add a voucher" = registry.add → limiter.setLimitFor → quoter.setPriceIndexValue + pool.setQuoter.
- **Owner = `msg.sender` at construction**, transferable to any address. → **A Green Goods Garden TBA (or a garden Safe) owns the pool** — deploy from the account for atomic ownership, or `transferOwnership` post-deploy.
- **Minimal ABI to stay Sarafu-compatible** (optional future interop): match `Swap`/`Deposit` events + `valueFor`/`have`/`limitOf` reads (CIC `TokenSwap`/`TokenQuote`/`ACL`/`TokenLimit`). AGPL does not restrict these.

**UX pain points to beat (from v1, still valid):** only ~47% of Sarafu users fully understand it; **50% report challenges (vs 35% for M-Pesa)**; the swap is a **3-transaction approve-dance**; Chrome-only with **no service worker (not actually offline)**; gas-cost crisis. Green Goods's edge: a **genuine offline-first PWA + job queue + operator role** — collapse exchange to one (sponsored) tap, hide contract vocabulary, capture offline and sync.

**The naming trap (unchanged):** Afo's `commitment-pooling.md` CMS card is the *Allo threshold-pledge* mechanism; our product is the *Sarafu mutual-credit* mechanism. Editorial must not ship the wrong definition.

---

## User flows (wired to existing flows)

**Core loop (Model A, reuses submit/approve-work):**
1. **Make a commitment** — a gardener (or operator on-behalf-of) creates a commitment ("I'll provide 4 days of labor / 20kg compost / a solar install"), valued in time/effort or local terms → commitment attestation (rung 1).
2. **Do the work** → **submit evidence** via the *existing* Work flow (photo/voice/GPS/IoT) — `Work` resolver, no change.
3. **Confirm fulfillment** — **the counterparty confirms** (D1 default) or operator approves (fallback), carrying `confidence` + `verificationMethod`.
4. **Grade (optional)** — evaluator assesses quality (`Assessment`).
5. **Settle** — Model A: reputation/ledger update + hypercert; Model B: voucher exchange-in/out / redemption via the pool.
6. **Report** — pool health (seeded / made / fulfilled / circulated) on the garden page + quarterly HoA report.

**Per-role entry points** map to the capability matrix above (operators steward; gardeners commit & fulfill; community confirms; funders seed; evaluators grade).

**Surfaces:** **PWA** — replace the `WalletDrawer` "Pools" `ComingSoonStub` with a garden-native pool tab ("Offer help / Request help / Seed my commitment / Mark fulfilled"). **Admin** — garden-level "Commitments" surface (create/link pool, configure voucher/service types, set who can issue, caps/rates/evidence requirements, risk flags: outstanding/overexposed/expired). **Editorial** — garden page shows the pool story (commitments made/fulfilled, capital circulating, evidence), transaction details secondary.

## User scenarios mapped to the 4 domains (tangible)

- **AGRO (agroforestry)** — *the v1 spec's lead case.* Greenpill Brasil farmers commit to seasonal output (seedlings planted, hectares maintained); neighbors pool labor (the granary model); fulfillment confirmed by the helped farmer; consistent delivery unlocks a mutual-credit line. Trisha's Costa Rica analog community is the same shape, operator-mediated.
- **EDU (education)** — a workshop facilitator commits to running 4 climate-literacy sessions; participants/community confirm attendance; fulfillment → learning-hours hypercert; pool credit redeemable for materials.
- **SOLAR** — an installer commits to a community solar install; fulfillment evidenced by **IoT** (inverter/meter reading, `verificationMethod=IOT`); confirmed by the host; kWh feeds impact reporting.
- **WASTE (cleanup)** — a crew commits to a cleanup route; before/after photos + GPS as evidence; community witnesses; mass-collected feeds the pool ledger and a cleanup hypercert.

## Circular economy: within and across gardens

- **Within a garden (Model A, works in July):** funders seed the reserve; gardeners earn credit/vouchers for fulfilled commitments; credit redeems for goods/services/membership; hypercerts route funding back to seed the next season. No tokens strictly required — reputation + ledger + hypercerts close the loop.
- **Across gardens (Model B, later):** vouchers are transferable ERC-20s, so a voucher earned in garden A can be presented to garden B *if* B curates it (adds A's voucher with a cap + value). Cross-garden circulation = **shared denomination (DAI/G$) + curation federation**, optionally a network-level registry. This is where G$ as a common denomination genuinely matters — it makes commitments legible and exchangeable across gardens. **Do not promise cross-garden for July.**

## Surfacing & indexing (the honest answer to "how do gardens see these pools?")

EAS attestations are **outside the Envio indexer boundary** (CLAUDE.md; confirmed in code) — so Model-A commitments surface **the same way work does today** (EAS reads / GraphQL), which **avoids the bespoke agent API Afo wants to dodge**. But **pool aggregate state** (totals made/open/fulfilled, exposure per issuer) does **not** come free — it needs either a **lightweight on-chain registry/aggregator contract** (cleanest; emits indexable events) or an Envio extension. This is rung 4 and is the one piece of new on-chain plumbing the July slice should scope deliberately. Model B's pool *is* an indexable contract (its `Swap`/`Deposit` events), so once B lands, aggregate state is native.

## Long-term roadmap (analog + AI/IoT + PGSP) — condensed from v1

- **Analog-first (Trisha/Costa Rica):** the bridge is an **operator/steward + process**, not a wallet — on-behalf-of capture, offline sync, paper/QR/voice evidence, social recovery via guardians.
- **AI/IoT passive capture:** a higher rung on the evidence ladder (`IOT`/`AGENT` already in the bitmask) — ambient capture → AI structures candidate commitments → **human confirmation** (non-negotiable) → ledger.
- **PGSP** ("public goods staking protocol", [PRD-367](https://linear.app/greenpill-dev-guild/issue/PRD-367)/[368](https://linear.app/greenpill-dev-guild/issue/PRD-368)/[369](https://linear.app/greenpill-dev-guild/issue/PRD-369)) is the hardware lineage that can host the capture/sync node. Roadmap section only — do not bleed into July.

## July scope vs. the multi-month feature (honest)

- **Shippable in July (Model A):** garden commitment attestations + verified fulfillment (D1 resolved) + a **visible garden-page surface** (commitments made/fulfilled) + the PWA "Pools" tab replacement + admin create/configure + editorial showcase + the rung-4 aggregator. This is a **real, demoable feature**, denominated in DAI, Arbitrum-native.
- **Multi-month maturation (Model B):** ERC-20 vouchers, the owner-governed swap pool, G$ denomination (pending D2a), cross-garden liquidity, passive IoT/AI capture, PGSP hardware. Partner-, custody-, and (for G$) chain-gated.

---

## Open decisions requiring human judgment

**Resolved (2026-06-27/28):** D1 fulfillment authority (counterparty + operator fallback) · reserve (both) · voucher type (both → A/B) · valuation (time-units) · non-fulfillment (clawback) · disputes (operator v1) · sybil (membership floor) · caps (operators) · member custody (self-custodial) · framing (mutual-aid) · MVP (all active gardens) · coherence (action vs decision). See the round-2 table.

**Still open:**
1. **D2a — G$ on Arbitrum:** confirm native/bridge path with GoodDollar (Afo ↔ Sam); until then DAI denominates.
2. **D3 — clean-room process + AGPL/ABI reasoning:** counsel sign-off; confirm GG repo license.
3. **Reserve custody:** Garden TBA holds the pool/reserve (it owns the pool) — confirm vs a garden Safe for higher-value pools.
4. **Seed/collateral mechanics:** how much seed an issuer posts per transferable-voucher issuance, and how a slash makes good-faith holders whole.
5. **Base unit & conversion:** is the time unit an hour or a generic commitment point; how reserve-backed pools convert time ↔ reserve value.
6. **Dual-voucher contract shape:** one contract with a transferability flag vs ERC-20 (transferable) + SBT/attestation (soulbound).
7. **Cross-garden valuation:** how garden B values/accepts a transferable voucher issued by garden A (curation federation).
8. **PRD-473 promotion** + designing Seasons/Campaigns *with* commitment pooling.
9. **Permission reconciliation:** `useRolePermissions` vs `useGardenPermissions` for "who configures the pool."
10. **Model B rollout sequencing:** which active gardens get transferable vouchers + swap pool first.

## Boundary

No contract code, no final schema, no chosen custody model, no committed Costa Rica pilot, no 5th domain, no cross-chain. Recommends a PRD-473 update, not an HoA milestone re-scope.

## Acceptance criteria

Complete when it: keeps the two mechanisms distinct; states the headline decisions (D1–D5) with recommendations; maps roles/resolvers/verification/value-primitives/hypercerts/domains/seasons to commitment pooling with code citations; defines the two unified models + the non-AGPL clean-room contract path; gives user flows wired to submit/approve-work and per-domain scenarios; answers Afo's questions (index below); separates July from the maturation; and yields the `RESR-*` tree + resource docs.

## Decision / exit

Done when reviewed by afo and either converted into the `RESR-*` tree (with owners/due dates/cycle) or accepted as reference and used to update [PRD-473](https://linear.app/greenpill-dev-guild/issue/PRD-473) and the Seasons & Campaigns project.

---

## Questions answered (Afo's follow-up → where)

| # | Question | Where |
| -- | -- | -- |
| 1 | Deeper GG↔Sarafu mapping | §Deep mapping; §What Sarafu gives us |
| 2 | No-onchain surfacing issue + avoid agent API | §Surfacing & indexing (Model A is on-chain attestations, EAS/GraphQL, no bespoke API) |
| 3 | Blend the two protocols seamlessly | Thesis; D3/D4; §What Sarafu gives us (GG-as-layer, clean-room, ABI-compatible) |
| 4 | "GoodDollar is on Arbitrum" | **D2a — not per current docs; confirm with partner** |
| 5 | Operators create pools / single pool per garden | **D5 — one garden pool, operator-stewarded** |
| 6 | Commitments across gardens | §Circular economy (Model B: transferable vouchers + curation federation) |
| 7 | G$ circular economy within/across gardens | §Circular economy |
| 8 | User flows tied to submit/approve work | §User flows (steps 2–3 reuse Work/confirmation) |
| 9 | Arbitrum first, no cross-chain | **D2** |
| 10 | AGPL: build off theirs or our own? | **D3 — clean-room, non-AGPL, ABI-compatible** |
| 11 | Stronger 4-domain mapping + scenarios | §Domains; §User scenarios |
| 12 | Support Seasons & campaigns cadence | §Seasons & Campaigns (commitment pooling *is* the primitive) |
| 13 | Purely attestation-based version via resolvers | **Model A** (§two-model; §resolvers) |
| 14 | ERC-20 mapping to vaults/cookie jars; hypercerts | §Value primitives; §Hypercerts |

## Recommended follow-up `RESR-*` tree (revised)

Parent: **`research: Commitment pooling for Green Goods`** (Research; `activity:research` + `protocol:green-goods`; initiative *Sustainability & Monetization*).

1. **`FulfillmentConfirmation` resolver design (D1 resolved)** (`band:deep`) — design the counterparty-confirmed attestation path (attester = beneficiary, self-attestation blocked, carries `confidence` + `verificationMethod`) with `WorkApproval` as the operator escalation path; schema + resolver checks + how pool-aggregate indexing reads it.
2. **Model A spec: commitment + pool-aggregator on-chain design** (`band:deep`) — commitment/fulfillment attestation schemas reusing resolvers; the rung-4 aggregator/registry + indexing; hypercert linkage.
3. **Model B spec: non-AGPL clean-room voucher + swap-pool contracts** (`band:deep`) — CIC-compatible interface, Garden-TBA ownership, `seal()`/`Ownable2Step`/settable-registry fixes, YieldResolver 4th leg; counsel gate on clean-room.
4. **G$ / HoA denomination & chain confirmation** (`band:brief`) — close D2a with GoodDollar; DAI-vs-G$ denomination policy; ties to PRD-475.
5. **PWA + Admin + Editorial UX spec** (`band:brief`) — the three surfaces, against Sarafu's pain points, plain-language copy.
6. **Seasons & Campaigns ↔ commitment pooling design** (`band:brief`) — the cyclical seed→commit→fulfill→settle→report cadence as the Seasons primitive.

## Resource documents to create (Research-team)

- This memo (mirror to Linear) · **Fulfillment-authority decision brief** · **Garden role → pool capability matrix** · **Non-AGPL clean-room contract spec (CIC-compatible)** · **GoodDollar pool pilot spec** · **PWA/Admin/Editorial UX brief** · **Commitment-fulfillment evidence schema** · **Analog + AI-hardware roadmap** · **Risks register (custody, caps, AGPL, accounting, cross-chain)**.

## Sources

Primary contract reads (clean-room reference): [`erc20-pool` SwapPool.sol](https://github.com/grassrootseconomics/erc20-pool/blob/main/solidity/SwapPool.sol) (owner-gating, ungated `seal()`, constructor `owner`), TokenRegistry/Limiter/PriceIndexQuoter (separate owners). G$ chains: [GoodDollar docs](https://docs.gooddollar.org/) (ETH/Celo/Fuse/XDC — **no Arbitrum/Base**). Sarafu UX: [GE 2025 study](https://grassecon.substack.com/p/2025-sarafu-network-study-results), [Celo forum](https://forum.celo.org/t/delegate-thread-grassroots-economics/12091). PDF: Ruddick, "Intro to Commitment Pools." AGPL/ABI: Google v. Oracle (2021).

Codebase (verified): `IGardenAccessControl.sol`, `modules/Hats.sol`, `accounts/Garden.sol` (TBA `execute`), `resolvers/{Work,WorkApproval,Assessment,Yield}.sol`, `Schemas.sol`, `registries/Action.sol`, `tokens/Goods.sol`, `modules/{Octant,CookieJar,Hypercerts}.sol`, `shared/src/types/domain.ts`, `shared/src/hooks/roles/useRolePermissions.ts`, `shared/src/hooks/garden/useGardenPermissions.ts`, `docs/docs/builders/specs/v1-0.mdx` (Domain 5). Linear: [PRD-473](https://linear.app/greenpill-dev-guild/issue/PRD-473), [PRD-475](https://linear.app/greenpill-dev-guild/issue/PRD-475), House of Alignment project, [RESR-4](https://linear.app/greenpill-dev-guild/issue/RESR-4) template. Detailed external notes: `.claude/agent-memory/oracle/reference_sarafu_network_research.md`.
