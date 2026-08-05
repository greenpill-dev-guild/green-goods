# Commitment Pooling: Exchange Architecture Brief

**Date**: 2026-08-01  
**Compatibility amendment**: 2026-08-03
**Posture**: design only  
**Linear mirror**: PRD-651  
**Authority**: plan Decision Log #42 / #51–#53; register #76 / #86–#88

## Purpose

Describe what a full on-chain exchange layer could look like for Green Goods after the frozen
August commitment contracts. The design activates seams already reserved by
`counterCommitmentId`, `acceptExchange`, the non-transferable `CommitmentRegistry`, and each
pool's reserved `settlementAdapter` without moving promise ownership into a transferable system.

**Compatibility conclusion: yes, the frozen initial architecture is adaptable to full Commitment
Pooling.** The adaptation does not require a replacement module, a transfer function on the
registry, or a new initial-deploy ABI/storage member. It does require three identities to stay
separate, the reserved adapter address to resolve a versioned router, and fulfilled-backed issuance
to precede any capacity-backed instrument.

This brief authorizes no implementation, deployment, dependency install, custody change, venue
integration, or partner commitment. A future scope lock must revalidate the implemented pooling
and settlement interfaces, the pilot evidence, legal and audit gates, and the operating model
before any build begins.

## Scope

- the compatibility boundary between promise instances, ongoing Offer identity, and future
  settlement-voucher classes;
- fulfilled-backed voucher issuance first, with reserved-capacity backing specified but disabled;
- a basis-aware quoter, class and holding limiters, and an optional pool venue/vault;
- seed inventory, exchange in/out, redemption, repair, and later federation;
- a buy-vs-build fork between a Green Goods venue and settlement against Grassroots Economics'
  deployed `erc20-pool` architecture on Celo;
- evidence, partnership, audit, legal, custody, and authorization gates for either fork;
- a general settlement-rail posture that preserves the current bounded command/ack pattern.

## Non-goals

- no change to the August contract scope beyond `acceptExchange(uint256)`;
- no transfer surface on `CommitmentRegistry` and no custody in `CommitmentPoolingModule`;
- no activation of `settlementAdapter` or `settlementEnabled`;
- no garden-to-garden routing, multilateral exchange, voucher mint, quoter, limiter, or venue
  implementation;
- no use of AGPL Sarafu source. Clean-room grounding remains the public paper and public docs;
- no ordered participant comparisons, per-person scores, protocol-consumed standing, implicit cross-basis conversion, or
  price-framed care work.

## 0. Compatibility contract

Three IDs represent three different things:

| Identity | Owner | Meaning | Initial build? |
|---|---|---|---|
| `commitmentId` / registry `classId` | `CommitmentPoolingModule` + `CommitmentRegistry` | one immutable promise instance and its non-transferable accounting row | yes; `classId == commitmentId` |
| `commitmentSeriesId` | `CommitmentPoolingModule` | one pool-scoped Offer used over time, grouping ordinary instances and Story | yes; zero remains Offer once |
| `voucherClassId` | future versioned adapter/router | one issuer-backed transferable settlement instrument with declared backing and redemption terms | no; design only |

The identities may reference one another but never collapse:

- one series may produce many commitment instances;
- one future voucher class may cite one series as issuer context and consume eligible fulfillment
  receipts from many instances;
- one commitment instance remains attributable even when its fulfillment authorizes a voucher
  mint; and
- holding or transferring a voucher grants no authority over the promise, provider, claimant,
  contributors, confirmation, dispute, recognition, or Story.

The initial Pool struct keeps one reserved `settlementAdapter` address and `settlementEnabled`
false. A future activation points that address at a versioned adapter/router. The router may add or
retire adapter versions without redefining the Pool struct or making the registry transferable.
The version, implementation, voucher class, and backing policy remain inspectable for every mint,
exchange, and redemption.

## 1. The exchange ladder

1. **Reference record, August scope.** `counterCommitmentId` records that commitment B was made
   "in exchange for" existing same-pool commitment A. The reference is immutable and one-way.
2. **Bilateral atomic acceptance, August scope.** `acceptExchange(B)` lets A's creator accept the
   Offer×Offer pair atomically. B's creator becomes A's claimant and A's creator becomes B's
   claimant. Both reach `Accepted` in one transaction, and all later lifecycle steps remain
   independent. Exact semantics live in `contract-spec.md` amendment 2026-08-01 (second same-day
   amendment), decision 18.
3. **Multilateral transferable exchange, later scope.** A separately authorized voucher layer may
   consume eligible fulfilled facts while issuing separate voucher classes, quote relative values,
   apply holding and class limits, and exchange through either a Green Goods venue or an approved
   external venue.

The ladder is cumulative. The later layer extends the reference and acceptance records; it does
not replace them or turn the base register into a transferable asset system.

## 2. Voucher class, backing, and issuance

The reserved `settlementAdapter` points to a versioned adapter/router, not directly to one
forever-fixed token contract. An adapter reads eligible facts from `CommitmentRegistry`, while the
registry remains the authoritative non-transferable record of promises and exposes no transfer or
approval functions.

**Fulfilled-only wrap is the safety default.** Only kept promises become transferable settlement
instruments. `committedOf` may support eligibility and audit reads, but it does not authorize a
voucher mint. A future exception would require its own scope lock because transferring an
unfulfilled promise would blur settlement with promise ownership.

The current `classId == commitmentId` convention remains valid **for the base registry only**. A
future voucher uses its own `voucherClassId`; it does not add another class kind to the promise
registry. The adapter must preserve `poolId`, issuer, optional `commitmentSeriesId`, backing mode,
and consumed fulfillment-receipt continuity so a voucher can always be traced to the facts that
authorized it without implying that the promise itself moved.

### 2.1 Conceptual future records

Names below are design vocabulary, not additions to the initial ABI:

```text
VoucherClass {
  voucherClassId, poolId, issuer, commitmentSeriesId,
  unitLabel, declaredValueBasis, supplyCap,
  backingMode, redemptionTermsCID, expiry,
  transferPolicy, state, adapterVersion
}

VoucherBackingReceipt {
  voucherClassId, commitmentId, eligibleAmount, consumedAmount
}

Redemption {
  redemptionId, voucherClassId, holder, amount,
  termsVersion, requestedAt, status, settlementReference
}
```

`backingMode` has two intentionally separate values:

1. **FulfilledBacking** — the first activatable mode. A kept promise authorizes a bounded mint; the
   adapter prevents double consumption.
2. **ReservedCapacity** — future-only and disabled. It would reserve a separately accounted amount
   against an active Offer before fulfillment and therefore needs explicit provider consent,
   expiration, default, dispute, release, repair, liquidity, legal, and audit rules.

Reserved capacity never changes the base Commitment or series holder. A cancelled, expired, or
disputed promise remains governed by the base lifecycle; the adapter must repair or retire its own
instrument without rewriting that history.

### 2.2 Voucher lifecycle

1. a steward or authorized issuer proposes a class with exact terms and a supply cap;
2. the class is reviewed, activated, paused, retired, or superseded under published authority;
3. eligible backing facts authorize bounded issuance;
4. a pool venue receives an explicitly authorized seed inventory;
5. holders exchange in or out under quoter and limiter rules;
6. a holder requests redemption under the class's versioned terms;
7. the venue burns or locks the redeemed amount before settlement is marked complete; and
8. failed redemption remains visible and repairable. It never becomes a fulfilled commitment or a
   G$ receipt merely because it was requested.

Voucher redemption and G$ commitment support are different rails. A future redemption may settle
in G$, another named asset, or a service under its class terms; the current G$ command/ack flow
does not become voucher redemption by implication.

## 3. Quoter

`declaredUnitValue` and `declaredValueBasis` provide the initial pricing input: one exact unit label
valued against one exact basis. A future quoter can compare two voucher classes only when their
bases match exactly or when a separately declared conversion is present. At exchange execution it
would:

1. load the two classes, pool identities, exact unit labels, and declared bases;
2. reject a missing or incompatible basis unless a versioned explicit conversion declaration
   names both bases and its authority;
3. compute the relative quantity under bounded rounding rules;
4. return the quote, basis provenance, expiry, and limit checks without mutating base promise
   records.

The count-safe boundary is absolute: declared value never changes quotas, provider slots,
recognition, `promiseKeptRate`, or any cross-commitment count. Unlike-label units never aggregate,
and there is no implicit cross-basis conversion. This corresponds to the GE quoter's role in
relative-pricing enforcement while keeping Green Goods' exact-basis declaration and audit trail
explicit.

## 4. Limiter

The exchange layer reuses two existing constraints without conflating them:

- class quotas remain exact-unit ceilings for each voucher class;
- `providerOpenCommitmentCap` remains the count of concurrent accepted commitments for one lead
  provider and is never converted into a voucher or price limit.

A future limiter adds per-voucher, per-pool holding caps around the wrapper or venue, analogous to
the GE limiter. The limiter must fail before custody or transfer mutation and expose current cap,
used amount, and recovery actor. It cannot derive limits from standing, fulfillment rate, or any
per-person score.

## 5. Venue and vault

A Green Goods venue would hold pool voucher inventory, accept bounded seed rounds, execute
voucher exchange in and out, and support redemption against an authorized settlement source.
Pool-held inventory is the point where custody enters. It therefore binds, before any build:

- a contract audit, reentrancy review, token-behavior review, and upgrade/ownership review;
- explicit Safe/timelock authority and bounded operator permissions;
- accounting, redemption-liquidity, fee, insolvency, and failure-recovery rules;
- legal review of transferable settlement instruments and the care-work anti-speculation posture;
- a canary, rollback plan, published venue configuration, and separately authorized value limit.

None of these gates is inherited from the non-custodial August pooling exception. Once custody or
transferability exists, the full value-tier gate applies.

The first venue scope is one bounded pool. It must prove class issuance, one seed inventory,
exchange in/out, redemption liquidity, failure repair, and complete accounting before any
garden-to-garden or protocol-wide federation is considered.

## 6. Buy-vs-build fork: the Sarafu-pool hybrid

The alternative is to settle Green Goods vouchers against Grassroots Economics' **deployed**
`erc20-pool` architecture on Celo rather than build a Green Goods venue. Pool identity would still
anchor proof on Arbitrum, while an approved external Celo contract becomes the settlement venue.

The four gates from `settlement-spec.md` §10.3 carry forward unchanged:

1. ERC-777 reentrancy audit of the deployed pool version used with canonical G$;
2. Grassroots Economics partnership and licence conversation covering roadmap, third-party pool
   support, operating responsibilities, and versioning;
3. GoodDollar sign-off that House of Alignment G$ may seed a non-GE pool;
4. evidence that the bare-Safe operator burden has become binding enough to justify the external
   venue dependency.

Interacting with deployed contracts is different from forking or reimplementing their source.
The former does not by itself copy code; the latter may trigger copyleft obligations. Counsel
confirmation remains pending, and the `erc20-pool` repository's missing `LICENSE` file observation
from the 2026-07-02 research remains unresolved. The repo clean-room rule remains stricter: no
AGPL Sarafu source is read or used here.

Decision criteria for the fork:

| Criterion | Green Goods venue | Sarafu-pool hybrid |
|---|---|---|
| Control and reversibility | higher local control, larger build and audit burden | faster reuse, external roadmap and version dependency |
| Custody and operator load | designed for this operating model, still new custody | existing venue mechanics, added partner and operator coordination |
| G$ legitimacy | requires GoodDollar review | requires GoodDollar **and** GE review |
| Licensing | Green Goods-owned implementation | deployed interaction may be acceptable; fork/reimplementation remains counsel-gated |
| Pilot fit | justified only by observed exchange and redemption need | justified only if partner support and the deployed version satisfy the four gates |

The GE partnership conversation is scheduled for **2026-08-19**. It is an evidence-gathering gate,
not an implementation kickoff.

## 7. Settlement rail generality

The command/ack pattern, per-lane `SettlementConfiguration`, and bounded executor generalize to
any CCIP-supported chain only through a new executor deployment, a published and verified lane,
and a reward-rail enum extension delivered through a reviewed UUPS upgrade. Arbitrum-local
automated settlement is the degenerate no-CCIP case; `ArbitrumExternal` already covers the
operator-recorded local path, so automation would still need a separately named and authorized
rail rather than silently changing that meaning.

Celo/G$ is the only settlement lane specified for the current implementation scope, and it still
requires its own audit, timelock, Safe/CCIP/AA, canary, and human-authorization gates before
activation. It is not implemented or activated by this design-only brief. This generality note
authorizes no additional chain, executor, enum member, or local automation.

## 8. Guardrails carried forward

- The non-transferable `CommitmentRegistry` stays authoritative for promise classes, committed
  units, fulfilled units, quotas, and provider slots.
- Vouchers are settlement instruments, never ownership of a promise or authority over its
  creator, recipient, contributors, confirmations, disputes, or Hypercert recognition.
- Pair acceptance does not couple later lifecycle state. A cancellation, expiry, dispute, or
  fulfillment on one side never transitions another commitment.
- No custody enters `CommitmentPoolingModule` or `CommitmentRegistry`.
- No ordered participant comparison, per-person score, protocol-consumed standing, or preferential
  limit derived from a person's history.
- Care work is not reduced to a tradeable price. Declared value records what one unit is worth to
  the pool in a named basis; it is not a universal price.
- Exact-label and exact-basis identity, module-events-only derivation, and the sole
  `promiseKeptRate` cross-commitment percentage remain unchanged.

## 9. Evidence gates

`pilot-evidence-spec.md` governs the decision. A future scope lock needs, at minimum:

- §3 evidence that a reciprocal relation remains after fulfillment, including the explicit
  question about what changed among contributor, recipient, group, and pool;
- §5 metric and qualitative evidence showing repeated bilateral or multilateral exchange demand,
  not one-off feature interest;
- §6 safeguard, exposure, and repair findings showing who is disadvantaged by transferability and
  how repair works without scoring people;
- §7 baseline and attribution evidence separating product use from stronger settlement capacity;
- §8 circulation evidence on in-pool use, redemption, reseed, leak, and hoarding, with low volume
  or mixed findings treated as valid evidence;
- §9 privacy and publication rules for event-derived pair and holding data;
- §11 a September evidence packet that names the selected fork, unresolved risks, and the human
  authorization still required.

The reciprocity question is a gate because a transferable layer is justified only when it serves
relationships the pool actually sustains across cycles. It is never justified by activity volume,
completion counts, or a desire to grade reliability.

Evidence must also answer whether the need is better served by ordinary commitment coordination,
direct support, or G$ settlement without a transferable voucher. Feature interest alone is not
exchange demand, and a fulfilled promise alone is not evidence that a redeemable instrument is
needed.

## 10. Open questions for the 2026-08-19 GE conversation

1. Which deployed `erc20-pool` versions are supported for third-party use, and which exact
   contracts and deployment records should Green Goods audit?
2. What licence governs deployed interaction, integration tooling, and any fork or
   reimplementation? Will GE publish an explicit repository licence?
3. How do the GE quoter and limiter treat exact labels, relative bases, rounding, holding caps,
   and failure recovery in production?
4. Can a pool restrict wrapping to fulfilled commitments while retaining normal exchange and
   redemption behavior?
5. What operational work remains outside the contracts for seed rounds, inventory, redemption,
   failed exchanges, and route maintenance?
6. Has an ERC-777 reentrancy audit covered the exact deployed pool version and canonical G$ path?
7. What partnership, support, upgrade-notification, and incident-response commitments would GE
   offer a non-GE pool operator?
8. Does GE see a clean way to preserve Green Goods `poolId` continuity and non-transferable promise
   authority while a Celo venue handles settlement vouchers?
9. Which pilot findings would GE consider sufficient evidence for multilateral exchange rather
   than continued bilateral paired acceptance?
10. How should the return leg work: redemption, reseeding, or another community-defined use, and
    what failure would show that the layer should not be built?

## 11. Staged implementation path

| Stage | Capability | Entry gate | What stays off |
|---|---|---|---|
| **0 — commitment coordination** | Needs, Requests/Offers, Offer over time, capacity, evidence, confirmation, Story, paired start | current frozen architecture plus PRD-721 dispatch | vouchers, custody, redemption, federation |
| **1 — compatibility freeze** | three identities, router semantics, backing modes, G$/redemption separation | this brief, companion specs/matrices, Linear mirror, human review | all voucher code and activation |
| **2 — field evidence** | measure repeated fulfillment, exchange demand, redemption need, agency, exposure, repair | `pilot-evidence-spec.md` packet | automatic promotion |
| **3 — fulfilled-backed voucher** | class registry, fulfillment receipt consumption, mint/burn, redemption terms | new contract/interface closure, legal/security review, explicit scope lock | capacity-backed issuance |
| **4 — one bounded pool** | seed inventory, quoter, limiter, exchange in/out, redemption and failure repair | stage 3 proof plus venue audit, liquidity and operator plan | federation |
| **5 — expansion** | capacity-backed issuance and/or pool federation | separate evidence and consent gates for each capability | any implicit cross-pool or unfulfilled-promise transfer |

Each stage is reversible as a product decision. Completing one stage does not authorize the next.
The initial module remains useful if the voucher stages are paused or never built.

## 12. Tech and Sun: two horizons

**Next cycles.** Tech and Sun records the climate-education Need, offers a bounded series of
workshops and check-ins, exposes only genuinely reserved places, records evidence, and lets the
eligible participant group confirm delivery. Fulfilled instances build an exact Story. Direct
support, impact certificates, supporter-vault yield, and separately gated G$ support may fund the
outcomes without making the commitments transferable.

**Future full-pool pilot.** If repeated cycles show a real need for a redeemable claim, Tech and
Sun could authorize one fulfilled-backed voucher class for one exact service basis. Kept workshop
instances would authorize bounded issuance; a one-pool venue would seed limited inventory, quote
within the declared basis, cap exposure, and publish redemption terms. The pilot would measure
whether people exchange and redeem it, who bears liquidity and operating work, and what happens
when redemption fails. Only that evidence could support a later capacity-backed or federated
design.
