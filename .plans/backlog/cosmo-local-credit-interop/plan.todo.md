# Cosmo-Local Credit Voucher Interoperability Plan

**Feature Slug**: `cosmo-local-credit-interop`
**Linear Issue**: [RESR-73](https://linear.app/greenpill-dev-guild/issue/RESR-73) (parent-only mirror)
**Linear Project**: Commitment Pooling
**Linear Source**: source:plans
**Status**: BLOCKED — scoping and architecture only. **No implementation is authorized.**
**Created**: 2026-08-25
**Last Updated**: 2026-08-25
**Companion documents**: [`brief.md`](./brief.md) · [`spec.md`](./spec.md) ·
[`tensions.md`](./tensions.md) · [`resources.md`](./resources.md) · [`eval.md`](./eval.md)

> Every slice below requires its own scope lock and explicit human dispatch before any code is
> written. Slice ordering is a dependency statement, not a schedule commitment. The PRD-651 gates
> are unchanged by anything in this hub.

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Target Problem Statement 2 of the SustainableFinance.Live hackathon | The brief names Sarafu and commitment pools directly and asks for exactly the funder-legibility surface Green Goods lacks |
| 2 | Green Goods enters solo | Afo's call. Solo entry does not mean solo architecture — the GE relationship remains live and the §10 questions still need answering |
| 3 | All work lands in the Green Goods repo | Afo's call. In-repo does **not** grant deployment authority; mainnet and custody remain separately gated |
| 4 | Transact against CLC's **live** Gnosis deployment rather than deploying our own instances | Interoperability is the goal; network membership is the point. Accepts the rake and the CLC-governance dependency knowingly (`tensions.md` §1) |
| 5 | Constrain the marketplaces Green Goods creates; enable the market aspects CLC supports | Green Goods vocabulary and design rules cannot follow an ERC20. Constrain what we build, acknowledge what we don't control (`tensions.md` §2) |
| 6 | Introduce transferability | It is the core of the change. Bilateral exchange needs no token; multilateral does, and third-party transfer is the entire justification |
| 7 | Record on Arbitrum, instrument on Gnosis, **nothing bridges** | Same split-state command/ack shape as Celo G$. Arbitrum emits a mint authorization; Gnosis mints natively. "No bridged value ever" holds unamended |
| 8 | Apply weights **at mint**, not at exchange | Keeps the governance in Green Goods where cycles, freezing and authority already live. CLC's `RelativeQuoter` is global, per-token and owner-mutable — it cannot hold cycle-scoped, activity-typed weights |
| 9 | The voucher's unit is a **weighted contribution unit, not an hour** | Follows from #8. Hours stay unconverted in layer 1 forever |
| 10 | Three valuation layers: record (native units) / commensuration (declared) / exchange — and a layer-2 change **never** rewrites layer 1 | The difference between a group revising its values and a group retroactively revaluing people's past contributions |
| 11 | Basis is **time**, for v1 | Education is unusually time-legible. Prove the basis where it works before stressing it |
| 12 | `ValuationPolicy` is a cycle snapshot frozen at `CycleOpened`, keyed to action UIDs or domains, never identities, and carrying `version` + `authority` + `rationaleCID` as mandatory fields | Follows the `AllocationBps` / `RecognitionPolicy` freeze-at-open pattern, which is the consent mechanism. The three identity fields are additional to that pattern and required by §2.2–§2.3: without them nothing can prove the table a mint was weighted by is the table the steward froze |
| 13 | Stewards hold the pen; gardeners get **see-before-commit** plus a **two-sided align/dissent signal** | Afo's call. Consultation and ratification deferred — but see #14 |
| 14 | The two-sided signal follows the `NeedSignal` **pattern** as a sibling schema and resolver branch — it does not reuse that schema UID | Corrected 2026-08-25. The NeedSignal resolver branch fails closed: `refUID` must resolve to an attestation with the exact Need schema and the same recipient, so a valuation-policy UID is rejected and nothing is recorded. One pattern and one UI, two schemas. See `spec.md` §2.3 |
| 15 | `PoolType` gains `GardenToGarden` and `Community` — but **only together with guards and consumer updates**, never appended bare | Corrected 2026-08-25. The `LoanPrincipal` precedent relies on a fail-closed consumer, which `PoolType` does not have: `PoolsLib.sol:43` sends every non-`Protocol` value down the `Garden` path, so a bare append silently grants garden-steward semantics. `ConsiderationRail` *is* fail-closed (`CreationChecksLib.sol:286` reverts on an unhandled rail) and may be appended ahead of use. See `spec.md` §3 |
| 16 | Spin up a pool when **membership differs from the garden**; otherwise use a cycle | A cohort including non-members is a pool; the same people doing focused work is a cycle. Keeps the common case simple |
| 17 | **Never build a global cross-pool rate table** | Each pool decides what it accepts and at what rate *to itself*. A shared index would break the no-universal-price guardrail and foreclose federation simultaneously |
| 18 | Federation starts hub-and-spoke through the Protocol pool, not mesh | N rates instead of N². The Protocol pool already exists and is already cross-garden |
| 19 | `expiresAt = 0` — do not use token expiry | The cliff confiscates from whoever redeems slowest, and erases the outstanding-obligation figure that is itself the funder signal (`tensions.md` §5) |
| 20 | Backing mode is `FulfilledBacking`; `ReservedCapacity` stays disabled | The labor already happened. The job is to record and count it, not to finance future delivery |
| 21 | Per-member limits stay Green Goods-side | CLC's `Limiter` caps `(token, holder-contract)` and rejects EOAs. Pool absorption is the *community* credit line — correct granularity; per-person is ours and stays anti-score |
| 22 | Clean room: hand-write interfaces from `docs/SPEC.md`, never import `src/`, never vendor `ge-publish` | `src/` is AGPL-3.0. Interface implementation is not derivation; vendoring is. Matches the existing pattern for ~30 external protocols |

**Open decisions** (do not resolve without Afo):

| Question | Blocks |
|---|---|
| **Where does a per-contributor quantity come from?** Work-record field, per-contributor units on the commitment, or single-contributor-only for v1 | **Everything.** `spec.md` §2.0 — layer 1 does not exist on chain today, so weighted minting cannot be specified until this is chosen. Only the third option fits the hackathon window |
| Does learning count, and at what weight relative to facilitating? | The whole education weights table. Values decision, not technical |
| Do concurrent campaigns need a bound? | Slice 2. The exit check ("a campaign nobody joins is inert") may suffice at hub scale |
| Does `GiftableToken.burn` survive expiry? | Slice 0 fork verification. Determines whether a redemption path survives an expired class |
| What is the second confirmer on a redemption event? | Slice 5. Transferability breaks counterparty-first confirmation (`tensions.md` §4) |

---

## MVP definition

**The smallest thing that proves the thesis:**

> One garden's confirmed contributions, weighted by a published cycle policy, mint a Gnosis-native
> voucher that is listed and exchangeable in a Cosmo-Local Credit pool — and a third party actually
> receives one.

Everything else is either a precondition (Slice 1), the funder surface (Slice 3), or later
(Slice 6+). The falsifiable half is in `brief.md` § Success Signal: if all exchange turns out
bilateral, the finding is that the token was not needed, and that is a valid result.

---

## Slices

### Slice 0 — Due diligence and the GE conversation

**No code. Blocking for every later slice.**

- Read on-chain, Gnosis mainnet, for each of the six live CLC contracts: `owner` vs ERC1967 admin
  slot; `ProtocolFeeController.isActive()` and `getProtocolFee()`; `FeePolicy.getDefaultFee()`;
  `SwapPool.isSealed(0)`; whether a live pool *proxy instance* exists (the README lists
  implementations) and how it is configured.
- Fork-verify whether `GiftableToken.burn` functions after expiry.
- Answer `exchange-architecture-brief.md` §10 questions 1–5 with Will Ruddick / Grassroots
  Economics — and establish whether the 2026-08-19 conversation happened and what it produced.
- Establish whether Green Goods would list into an existing pool or have one created, and who owns
  the resulting `SwapPool`.

**Exit**: a findings record plus a documented go / no-go on network membership under known terms.

### Slice 1 — Interfaces and Gnosis read bridgehead

**In-repo. No deploy, no writes, no custody.**

- Hand-written `ISwapPool`, `ILimiter`, `IQuoter`, `IGiftableToken`, `ITokenIndex`,
  `IAccountsIndex`, `IContractRegistry` from `docs/SPEC.md`.
- `networks.json` Gnosis (100) entry: RPC, explorer, CCIP router and selector `465200170687744372`.
- Read-only CLC client in `shared`: resolve registry, read listing state, limit, quoted rate, fee
  configuration and pool inventory for a given token.
- `ConsiderationRail` Gnosis member appended ahead of use — safe, because the rail dispatch is
  fail-closed.
- **`PoolType` stays two-valued in this slice.** Adding `GardenToGarden` or `Community` requires a
  per-value contract guard replacing the `else` fallthrough, plus indexer, GraphQL-schema,
  shared-type and client mappings and round-trip coverage, all in one change. That belongs to
  Slice 6+, not here. See decision 15.

**Exit**: Green Goods can read the live CLC pool's state and render it. Nothing is written anywhere.

### Slice 2 — `ValuationPolicy` and gardener voice

**Arbitrum + app layer. Green Goods-native — no CLC dependency. Valuable standalone.**

**Blocking prerequisite**: `spec.md` §2.0. There is no per-contributor quantity anywhere on chain,
so layer 1 as the architecture describes it does not yet exist. Slice 2 must pick one of the three
resolutions there before Slice 4 is dispatchable.

`spec.md` §2.1 defines the **contract** — the five mandatory fields and freeze-at-open semantics.
2a and 2b are two **carriers** of that same contract, not competing architectures; decision 12
governs the contract, the slice governs the carrier. Phase B selects 2a. Whichever carrier ships,
the fields and their immutability are identical.

- **2a — `metadataCID`-carried.** The weights table is published in the cycle's existing
  `metadataCID`, frozen at open by convention and enforced by the indexer. No contract change, no
  upgrade, no gate. Requires a **mandatory, versioned schema** carrying `version`, `authority`,
  `rationaleCID`, `basis` and `weights` — see `spec.md` §2.1. A table missing any of those cannot be
  proven to be the one the steward froze, and the indexer must reject it rather than project a
  partial policy.
- **2b — on-chain struct.** `ValuationPolicy` as a third `Cycle` snapshot emitted in `CycleOpened`,
  alongside `AllocationBps` and `RecognitionPolicy`, carrying the same five fields. A UUPS upgrade
  to a deployed, unpaused module, with every gate that implies.

Plus, in either shape: steward authoring UI in admin; see-before-commit surface in client; the
two-sided align/dissent signal as a `NeedSignal`-pattern sibling schema and resolver branch
(decision 14); indexer entities; i18n with en/es/pt mirrors.

**Exit**: a garden can declare, publish and freeze a weighted valuation for a cycle, gardeners can
see it before committing and register alignment or dissent, and the signal aggregate is readable.

### Slice 3 — Pool passport (MCC profile) and funder view

**Public, read-only.**

- Machine-readable MCC-shaped profile per pool: registry roots, receipt standard, health endpoints
  with freshness bounds, policy constraints, deterministic failure codes.
- The `evidence` extension block CLC has no equivalent for: EAS schema UIDs, attestation counts,
  confirmation path, Hats-gated roles.
- Funder-facing view: circulation, distinct participants, needs met without cash, outstanding
  obligation, **capability progression** (learner → peer teacher → facilitator, visible without
  ranking anyone).

**Dependency**: hosted Envio has no pooling schema. Until that ships and reindexes, this runs on
local or fixture data.

**Exit**: a bank, council or funder can inspect a Green Goods pool with their own tools, and the
fulfilment figures trace to counterparty confirmations on Arbitrum.

### Slice 4 — Voucher mint authorization

**The interop core. Gated on Slices 0–2.**

- Gnosis `GiftableToken` class per campaign, `expiresAt = 0`, Green Goods as owner, mint adapter as
  `writer`.
- Mint adapter: reads eligible fulfilment facts, applies the frozen cycle weights, and enforces the
  replay invariant below.
- **Replay invariant.** Each authorization carries a stable `authorizationId` derived from the facts
  it consumes — pool, cycle, commitment set, policy version — not from the message that carried it.
  The Gnosis receiver records the consumed `authorizationId` **and** the CCIP `messageId` atomically
  with the mint, and rejects both a repeated `messageId` and a distinct message reusing a consumed
  `authorizationId`. This is the `CeloGardenAccountRelay` shape:
  [`processedMessages[messageId]`](../../../packages/contracts/src/accounts/CeloGardenAccountRelay.sol)
  plus `actionStatus[actionId]`, `nextActionNonce`, and a stored action digest, guarded by
  `CcipMessageReplay`, `InvalidActionNonce` and `ActionHashMismatch`. Message-level dedup alone is
  insufficient — CCIP can deliver the same authorization under a new `messageId` after a retry.
- CCIP Arbitrum → Gnosis lane: executor deployment, published and verified lane, reviewed UUPS
  upgrade — following `SettlementMessageCodec` and `CeloGardenAccountRelay` patterns.
- **Two distinct account paths — do not conflate them.**
  - *Garden* accounts: sibling of `CeloGardenAccountDeploymentCoordinator`, same exact-address
    CREATE2 technique. That coordinator deploys exactly `GARDEN_COUNT = 18` ERC-6551 accounts keyed
    by `GardenToken` token IDs. It produces **garden organisation accounts and nothing else.**
  - *Gardener* accounts: individual contributors authenticate with per-person Pimlico Kernel
    accounts ([`auth-passkey-adapters.ts`](../../../packages/shared/src/workflows/auth-passkey-adapters.ts)),
    a completely different derivation. Vouchers minted to individuals land here, not in a garden
    account, so the Kernel-account Gnosis derivation and deployment path must be specified and
    proven on its own. Reusing the coordinator would reproduce garden accounts and silently mint to
    the wrong recipients.
- Pimlico Gnosis bundler and paymaster configuration and funding, for the gardener path.

**Exit**: a confirmed contribution on Arbitrum produces a weighted, Gnosis-native voucher held by
the contributor in their own Gnosis Kernel account.

### Slice 5 — Listing, exchange, redemption

**Gated on Slice 4 and on Slice 0's ownership answer.**

- Listing and limit negotiated with CLC; rate set in `RelativeQuoter`.
- Exchange in and out through `SwapPool`; bounded swap form only
  (`withdraw(tokenOut, tokenIn, value, recipient, minAmountOut, deadline)` — the unbounded forms
  have no protection against a price move between quote and settlement).
- Redemption path, including the **second-confirmer design** for a bearer instrument.
- Explicit failure handling for de-listing, rate change, limit change, pool insolvency.
- Outstanding-obligation figure published.

**Exit**: a voucher moves through a third party and is redeemed, with the whole path traceable.

**Venue availability constrains where this slice can run.** Cosmo-Local Credit publishes a Gnosis
**mainnet** deployment only (`resources.md`); no Chiado addresses exist, and pool proxy instances
require separate discovery even on mainnet. So Slice 5 splits:

- **5a, testnet-provable** — the exchange *mechanics* against a Chiado venue we stand up ourselves.
  A repo-wide search finds no CLC Chiado address, config, artifact, or deploy command, so this is
  not a matter of looking one up. The path has to be built, and Slice 1 must produce it:
  deploy the published implementations to Chiado with their `ge-publish` tool run **externally**
  (never vendored — `docs/DEPLOY.md` gives the exact command sequence and requires
  `--admin != --owner`), record the resulting addresses in `networks.json` and a deployment
  artifact, and pin them here. Interface-conformant mocks are the fallback if that proves
  impractical inside the window. Either way the venue is ours, not CLC's.
- **5b, mainnet-only** — real CLC venue *behaviour*: their quoter's rates, their limiter's caps,
  their fee policy, and de-listing with a held balance. None of it is observable on a venue we
  control, so none of it can be proven in Phase C.

Decision 4 commits to transacting against their live deployment. That deployment is mainnet, and
mainnet is gated. 5b therefore lands in Phase D or later, never in the hackathon.

### Slice 6+ — Later, each separately gated

- `GardenToGarden` and `Community` pool types activated; pool-scoped authority predicate for
  multi-steward pools (and the consultation rung it pulls forward — `spec.md` §3.3).
- Routing: intra-garden first via two pools, then hub-and-spoke through the Protocol pool.
- Mutual credit proper — negative balances cleared by service, per-member caps, the exit-with-debt
  problem.
- Community pool via the community app, after needs-surfacing v1 proves needs actually get met.

---

## Phasing

| Phase | Window | Contents |
|---|---|---|
| **A — Understand and decide** | now → mid Sept | Slice 0 |
| **B — Foundations** | Sept → 15 Oct | Slice 1, Slice 2a |
| **C — Hackathon** | 16–27 Oct | Slice 4 + Slice **5a** on **Gnosis Chiado**, against our own deployment of the published CPP implementations or interface-conformant mocks; Slice 3 as the pitch surface. Slice 5b is excluded — see Slice 5 |
| **D — Pilot readiness** | Nov → Q1 | Legal (jurisdiction, transferable instrument, KYC tier), external audit, custody model, repair and insurance design, pilot-garden consent and governance, CLC partnership terms, mainnet gates |
| **E — Later** | beyond | Slice 6+ |

### Explicitly **not** in the hackathon

Mainnet anything. Real value. Custody. Slice 2b's contract upgrade. Credit and negative balances.
Cross-garden routing. `GardenToGarden` or `Community` pool types — added at all, let alone in use.
Multi-steward authority. Community-app pool integration. **Slice 5b — any claim about the live CLC
venue's rates, limits, fees, or de-listing behaviour**, since that venue exists only on mainnet.

The hackathon deliverable the organisers actually ask for is *"MVPs, platform concepts, and customer
journeys"* — not a deployed protocol. An honest testnet loop plus the funder surface is a stronger
submission than a rushed mainnet claim, and it does not spend gates that cannot be un-spent.

---

## Test Strategy

- **Unit**: weight arithmetic and rounding; mint-authorization double-spend prevention; interface
  encode/decode against `docs/SPEC.md` shapes; `ValuationPolicy` freeze semantics.
- **Integration**: cycle open → weighted mint authorization → CCIP command → Gnosis mint, on forked
  Arbitrum and Chiado; MCC profile assembly from indexer output.
- **Fork**: exact-address GardenAccount derivation on Gnosis; gardener Kernel-account derivation and
  deployment on Gnosis, proven separately; `GiftableToken` expiry and burn
  behavior; bounded-swap slippage and deadline paths; de-listing behavior with a held balance.
- **E2E**: steward authors and freezes a valuation policy → gardener sees it → gardener commits →
  contribution confirmed → voucher appears → transfers to a third party → third party redeems.
- **Manual**: locale tone across en/es/pt; the contribution ledger reading as a ledger rather than a
  wallet (motivation-crowding mitigation).

## CLAUDE.md Compliance

- [ ] Hooks in shared package
- [ ] i18n for all UI strings, en + es + pt mirrors, 4-part locale gate
- [ ] Deployment artifacts for every address; no hardcoded addresses
- [ ] Implementation Quality Contract applied; no speculative abstractions
- [ ] No AGPL source read, imported, or vendored
- [ ] No `#<number>` PR references in source comments (design-tokens hex false positive)

## Impact Analysis

### Likely to create

- `packages/contracts/src/interfaces/I{SwapPool,Limiter,Quoter,GiftableToken,TokenIndex}.sol`
- Gnosis executor and mint-authorization adapter under `packages/contracts/src/modules/`
- A Gnosis GardenAccount deployment coordinator, sibling of the Celo one, plus a separate gardener
  Kernel-account derivation and deployment path
- `shared` CLC read client and MCC profile assembler
- Admin valuation-policy authoring views; client see-before-commit and signal surfaces
- Public funder view

### Likely to modify

- `packages/contracts/deployments/networks.json` — Gnosis (100)
- `ICommitmentPoolingModule.sol` — `PoolType`, `ConsiderationRail`, and in 2b `Cycle`
- Indexer schema — valuation policy, signals, voucher classes, outstanding obligation
- `packages/shared` hooks and selectors
