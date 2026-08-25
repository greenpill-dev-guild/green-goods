# Cosmo-Local Credit Voucher Interoperability — Architecture Spec

**Posture**: design only. Authorizes no implementation, deployment, dependency install, custody
change, venue integration, or partner commitment.
**Companion documents**: [`brief.md`](./brief.md) · [`resources.md`](./resources.md) ·
[`tensions.md`](./tensions.md) · [`plan.todo.md`](./plan.todo.md) · [`eval.md`](./eval.md)

## Summary

Green Goods keeps the promise and the evidence; Cosmo-Local Credit provides the exchange venue.
Confirmed contribution on Arbitrum authorizes the mint of a **Gnosis-native voucher** through a CCIP
command, in the same split-state shape already used for Celo G$ settlement. The voucher is listed,
priced, limited, and exchanged inside CLC's deployed Commitment Pooling Protocol contracts. Nothing
bridges: only authorization crosses, and the instrument is native to the chain it lives on.

Contribution weight is applied **at mint, not at exchange** — a cycle-scoped, steward-set, frozen
`ValuationPolicy` decides how many voucher units an hour of a given activity yields, inside Green
Goods where the governance is. CLC's quoter then only needs one rate per garden voucher.

## Users

- **Primary**: hub members who already provide services and skills to one another informally —
  teaching, facilitating, mentoring, cooking, hosting — whose labor is currently recognized but not
  valued, and never valued against anything else.
- **Secondary**: garden stewards, who set and publish the valuation policy; funders, councils and
  banks who need to assess a place-based organisation from outside Green Goods; Cosmo-Local Credit
  pool operators and routers who need a source of truth for fulfilment.

## 1. Where things live

| Layer | Chain | Owner |
|---|---|---|
| Commitments, cycles, evidence, EAS, Hats, Hypercerts, confirmation | Arbitrum One (42161) | Green Goods |
| Valuation policy, weights, per-member limits, mint authorization | Arbitrum One | Green Goods |
| Voucher token (`GiftableToken` instance) | Gnosis (100) | Green Goods |
| Pool, router, quoters, limiter, fee policy | Gnosis (100) | **Cosmo-Local Credit** |
| G$ settlement (existing, paused) | Celo (42220) | Green Goods |

**Nothing bridges.** Arbitrum emits a mint authorization — class, amount, recipient — and Gnosis
mints locally, exactly as `SettlementMessageCodec`'s frozen v1 command/ack does for G$. The "no
bridged value ever" posture holds without amendment because there is no value in transit, only an
authorization.

`ConsiderationRail` gains a Gnosis member. Precedent for shipping an enum member inert ahead of use
is `DisbursementKind.LoanPrincipal`.

## 2. The valuation model — three layers that must not collapse

This is the core architectural commitment of the hub, and it is what allows Green Goods to make
contribution comparable without pricing care work.

**Layer 1 — Record, in native units, never converted.** Ada cooked three meals. Chidi taught five
design hours. Stored as recorded, permanently. `unlike-label units never aggregate` stays true here
forever. This is the contribution ledger and it is what makes unpaid labor *visible*.

**Layer 2 — Commensuration, declared by the pool.** A versioned, governed, publicly visible
equivalence table with a named authority. This is what makes contribution *comparable*. It is
explicitly not a price, not portable outside the pool, and never convertible to money at protocol
level.

**Layer 3 — Exchange**, which consumes layer 2: vouchers, quoter, limiter, routing.

**The critical property: a layer-2 change never rewrites layer 1.** Revising equivalences produces a
new versioned table; the record of what actually happened is untouched. That is the difference
between a group revising its values and a group retroactively revaluing people's past contributions.

The escape hatch already exists in the frozen design —
`exchange-architecture-brief.md` §3 permits a quoter to accept an incompatible basis when *"a
versioned explicit conversion declaration names both bases and its authority."* Layer 2 is that
declaration.

### 2.1 `ValuationPolicy` — a third cycle snapshot

`Cycle` already carries two steward-set policies frozen at open and emitted in `CycleOpened`:
`AllocationBps` (six role shares) and `RecognitionPolicy` (`equalParticipationBps` /
`verifiedContributionBps` — already the egalitarian-versus-merit dial, already settled as a per-cycle
split rather than a global principle).

`ValuationPolicy` is the third, in the same shape:

```text
ValuationPolicy {
  basis                      // Time for v1
  weights[actionUID|domain]  // declared relevance to this cycle's purpose
}
```

Frozen at `CycleOpened`, emitted with the rest, keyed to **action UIDs or domains** —
which `CommitmentCreated` already carries — and **never to identities**, the same way
`AllocationBps` weights role classes rather than people.

**Basis for v1 is time.** Education is unusually time-legible: facilitating, preparing, mentoring,
attending and reviewing all record naturally in hours, where growing food or building infrastructure
separate effort from output. Prove the basis where it works before stressing it.

### 2.2 Invariants on the pen

1. **Weights are set before cycle open and never move mid-cycle.** This is the consent mechanism,
   not an implementation detail: a gardener sees the table *before* deciding whether to commit, and
   the steward cannot move it afterward.
2. **Weights attach to activity types, never to identities.** Preserves the anti-scoring rule by
   construction.
3. **The rationale is part of the record.** `metadataCID` carries the steward's stated reason,
   making a political act legible rather than silent.

### 2.3 Gardener voice

Stewards hold the pen. Two rungs are in scope; two are deferred.

| Rung | Status |
|---|---|
| See before commit | **In scope.** Comes free with freeze-at-open. The floor. |
| Visible two-sided signal — align **or** dissent, recorded against the cycle's valuation policy, non-binding | **In scope.** Not an objection log; a legitimacy reading. |
| Consultation required before open | Deferred — but see §3.3 |
| Ratification / gardener block | Deferred |

The signal is the same primitive as `NeedSignal` in the community-interface spec, pointed at a
different object. Build one mechanism, not two.

The aggregate reading is useful in three directions at once: the steward learns whether a weighting
landed, gardeners see they are not alone in a view, and a funder sees whether a campaign's
priorities were shared by the people doing the work.

## 3. Pool taxonomy

`enum PoolType` is currently `{ Garden, Protocol }`. Two members are to be added:

| Type | Membership | Status |
|---|---|---|
| `Garden` | one garden's roster | live |
| `Protocol` | cross-garden, root garden tokenId 1 | live, singular by convention |
| `GardenToGarden` | stewards from multiple gardens | **to add** |
| `Community` | surfaced from the community app | **to add** |

Append both now, inert, following the `DisbursementKind.LoanPrincipal` precedent — it costs nothing
and avoids an upgrade later.

### 3.1 The discriminator: when to spin up a pool

**Does this cohort have a different membership than the garden?**

A climate cohort at a university plausibly includes students who are not garden members — different
people, different boundary, different consent. That is a pool. A garden doing focused work with the
same people for a season is a *cycle*. Default to one pool per garden with cycle-scoped valuation;
reserve the heavier structure for when it is earned.

Two consequences. In CPP terms a pool is exactly the thing that declares its own curation,
valuation and limits, so pool-per-cohort maps cleanly and makes each cohort independently
discoverable. And two pools inside one garden make `SwapRouter` earn its place *within* a hub — a
much shorter path to demonstrating routing than waiting for a second hub.

### 3.2 Federation does not require shared valuation

Cross-garden routing appeared to demand a cross-pool rate that nobody has authority to declare
— the universal price the guardrails ban. It does not. **Each pool independently decides what it
accepts and at what rate to itself.** Garden A decides what Garden B's voucher is worth *to A*;
B decides separately; the two need not agree. Asymmetric, and correct — a curation decision, not
price discovery. This is how Sarafu and CLC already operate.

**Binding constraint, recorded now while it is cheap: never build a global rate table.** A shared
cross-pool index would break the no-universal-price guardrail and foreclose federation in the same
move. Valuation stays pool-local; acceptance is curation.

**Start hub-and-spoke, not mesh.** Peer-to-peer garden pairs need N² acceptance rates and N²
relationships; routing through the Protocol pool needs N. The Protocol pool already exists and is
already cross-garden.

### 3.3 Multi-steward pools pull governance forward

`RosterLib` is commitment-scoped — self-join, self-exit, managed removal, contributor requirements —
not pool membership. Pool membership currently rides on garden membership through Hats. A pool
stewarded across gardens needs a pool-scoped authority concept that does not exist yet, and Hats
constrains its shape: no wearer enumeration, and revoke behaves as transfer, so authority must be a
**predicate** (`isWearerOfHat` against a pool-scoped hat) rather than a set.

Second-order consequence: in a single-garden pool one steward obviously holds the pen. In a
co-stewarded pool **nobody does**, so the "consultation required" rung deferred in §2.3 becomes the
minimum viable process. Multi-steward pools and the heavier governance rungs arrive together.

## 4. Voucher model

- **Backing mode**: `FulfilledBacking`. Confirmed contribution authorizes a bounded mint. The
  labor already happened; the job is to record and count it. `ReservedCapacity` stays disabled.
- **Class unit**: one voucher class per campaign, wrapping a `commitmentSeriesId` as issuer context.
  A series — "one pool-scoped Offer used over time" — is the natural class boundary.
- **Unit label**: a **weighted contribution unit, not an hour.** Weights are applied at mint per
  §2.1; hours stay unconverted in layer 1 forever.
- **Expiry**: `expiresAt = 0`. See [`tensions.md`](./tensions.md) §5 — the expiry cliff is a
  confiscation, and the outstanding-obligation figure it would erase is itself the funder signal.
- **Per-member limits stay Green Goods-side.** CLC's `Limiter` caps `(token, holder-contract)` and
  rejects EOAs, so it is pool inventory control, not per-person credit. That granularity is right:
  the amount a pool will absorb of a garden's voucher **is that community's credit line**, set at
  community level, never per person.

The three identities from the frozen compatibility contract stay separate and never collapse:
`commitmentId`/`classId` (one immutable promise instance), `commitmentSeriesId` (one ongoing Offer),
`voucherClassId` (one issuer-backed transferable settlement instrument).

## 5. CPP crosswalk

| CPP pool function | CLC contract | Green Goods | Note |
|---|---|---|---|
| Curation | `TokenUniqueSymbolIndex`, `AccountsIndex` | `CommitmentRegistry`, pool roster | GG curates promises; CLC curates tokens |
| Valuation | `RelativeQuoter` (PPM, owner-mutable, global) | `ValuationPolicy` (cycle-frozen, weighted) | **Weights at mint; the quoter carries one rate per garden voucher** |
| Limitation | `Limiter` (per token, per holder-contract) | class quotas, `providerOpenCommitmentCap`, `borrowerCap` | Different units — inventory vs counts. Per-member stays GG-side |
| Exchange | `SwapPool` + `FeePolicy` + `SwapRouter` | reserved `settlementAdapter` | The gap CLC fills |
| Receipts | `Swap`, `SwapSettlement` | EAS work → approval → assessment → testimony → confirmation → Hypercert | Different kinds of receipt; neither substitutes |
| Health endpoints (MCC) | — | Envio indexer, `promiseKeptRate`, `distinctProviderCount` | Exists; not yet published in MCC shape |

**The asymmetry is the contribution.** CLC's voucher metadata carries `proof` as a free-text string
and its Fulfillment Rate KPI (`FR = Settlements / RedemptionsRequested`) has no defined source of
truth. Green Goods' Hats-gated attestation graph is that missing source.

## 6. Functional requirements

1. A confirmed commitment on Arbitrum authorizes a bounded voucher mint on Gnosis, with double-spend
   prevention against the same fulfilment facts.
2. Weights from the cycle's frozen `ValuationPolicy` determine mint quantity; layer-1 hour records
   are never rewritten.
3. A garden voucher is listable, priceable, limitable and exchangeable in a CLC pool.
4. Every pool publishes a machine-readable MCC-shaped profile — registry roots, receipt standard,
   health endpoints with freshness bounds, policy constraints, failure codes — plus an `evidence`
   block CLC has no equivalent for.
5. Gardeners hold, transfer and redeem vouchers from a Gnosis account at the same address as their
   Arbitrum account.
6. Outstanding unredeemed obligation is a first-class published figure.
7. Marketplace surfaces built by Green Goods obey Green Goods vocabulary and design rules; external
   surfaces are acknowledged as outside that control.

## 7. Human judgment points

| Decision | Status |
|---|---|
| Transact against CLC's live Gnosis deployment vs deploy own instances | **Decided: live deployment.** Accepts the rake and the network-governance dependency |
| Accept external pricing vs constrain transfer venues | **Decided: constrain the marketplaces Green Goods creates**, enable the market aspects CLC supports |
| Introduce transferability | **Decided: yes.** This is the core of the change |
| Weights at mint vs at exchange | **Decided: at mint** |
| Basis | **Decided: time, for v1** |
| Who holds the pen | **Decided: stewards**, with see-before-commit + two-sided signal |
| Does learning count, and at what weight relative to facilitating? | **Open.** Values decision; everything else in the education weights table follows from it |
| Do concurrent campaigns need a bound? | **Open.** Exit check ("a campaign nobody joins is inert") may be sufficient at hub scale |
| Whether `GiftableToken.burn` survives expiry | **Open.** Fork verification |

## 8. Non-functional constraints

- **Clean room**: hand-write interfaces from `docs/SPEC.md`. Never import `src/`. Never vendor the
  `ge-publish` Go package. Interface implementation is not derivation; vendoring is.
- **Package boundaries**: contracts → indexer → shared → client/admin, per repo dependency order.
- **Security**: every pooling-tier mainnet deployment, upgrade, activation or unpause remains
  blocked by external audit with no unresolved critical/high finding, 3-of-5 Safe ownership, a
  48-hour mainnet timelock, two weeks of testnet operation, tested rollback, and explicit human
  authorization. CLC's internal review does not satisfy this.
- **Localization**: every user-facing string is i18n'd with en/es/pt mirrors.
- **Privacy**: `pilot-evidence-spec.md` §9 governs publication of event-derived pair and holding
  data. Public surfaces must not enumerate addresses.
- **Vocabulary**: no leaderboards, no streaks, no ordered participant comparison, no price-framed
  care work on Green Goods surfaces.

## 9. Package / lane mapping

| Area | Lane | Notes |
|---|---|---|
| UI | `ui` | Valuation-policy authoring, two-sided signal, voucher holdings, funder view |
| State / API | `state_api` | Gnosis chain config, CLC read clients, MCC profile assembly, indexer schema |
| Contracts | `contracts` | `ValuationPolicy`, enum members, mint-authorization adapter, Gnosis CCIP lane |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential |

## 10. Risks

See [`tensions.md`](./tensions.md) for the full integration analysis. Headline risks:

- **Cold start.** Small voucher circles usually die. GE's own visualizer shows ~4 transactions per
  pool per day across five established chamas. A new hub needs a reason to transact in week one.
- **Motivation crowding.** Quantifying intrinsic contribution can reduce it. A contribution ledger
  must read differently from a wallet balance.
- **Measurement capture.** Whoever records best accrues most. Counterparty confirmation prevents
  self-credit but does not surface the person who never asks to be confirmed.
- **The fracture moment.** Valuing things against each other means someone's contribution is valued
  lower — typically care work, typically gendered. Facilitation problem first, software problem
  second; software's job is to keep the table visible, versioned, revisable and clearly owned by the
  group.
- **Exit with a negative balance.** Students graduate. Mutual credit's default problem, unaddressed
  in Green Goods today beyond "visible and repairable."
- **Liquidity fragmentation.** Every added pool is a thinner market. Education is the most portable
  unit across gardens — every hub wants teaching — which is a second argument for the education
  anchor.
