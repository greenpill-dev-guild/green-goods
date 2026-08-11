# Codex review prompt — payer identity + recipient rule (2026-08-08, round 2)

Review the uncommitted change on `feature/build-commitment-pooling-contracts`. Be adversarial: find
what is wrong, not what is right. Report severity-ordered with file:line anchors. If a claim below
is false, say so and show the evidence.

Your round-1 review returned REQUEST_CHANGES with six findings. All six were accepted; five were
fixed and one was a correction to a false claim of mine. **Two of the fixes changed behaviour, and
a third change landed afterwards that you have never seen.** Treat the whole thing as new.

## What this change now does

**1. The payer is the asking side (register #90).** An immutable `payerGarden` sits beside
`providerGarden`. A Request stores `pools[poolId].garden` at creation; an Offer stores the claiming
`gardenContext` at acceptance. Settlement derives `source`/`executorGarden` and payout-plan
authority from `settlementAccounts[payerGarden]`. `providerGarden` keeps its meaning — EAS
recipient scope and roster boundary — and stops being the payer. Garden-internal commitments
resolve both to the same garden, so single-garden pools are behaviourally unchanged.

**2. Paired acceptance is barter-only (your finding 1, fixed).** `acceptExchange` derives one
`gardenContext` for both sides, so a priced Offer×Offer pair would record one garden as payer for a
two-person trade — the protocol Safe for both halves in the protocol pool. Exchange eligibility now
rejects a non-zero consideration on either side with `ExchangeConsiderationUnsupported`, before
either side mutates.

**3. `CommitmentCreated` carries `payerGarden` (your finding 3, fixed).** Omitting it assumed
`PoolRegistered` always projects first; reverse delivery makes that false and there is no bounded
reverse index to backfill from.

**4. NEW SINCE YOUR REVIEW — who receives follows who claimed (register #91).** This is the part
you have not seen and the part most worth your attention. The protocol pool asks for two kinds of
thing, and `claimType` already separates them: garden-scoped work (an event, a garden-scoped
survey) is claimed by the **garden** via `ClaimType.Garden` — steward-only and protocol-pool-only,
already enforced in `AcceptanceLib` — while individual work is claimed by a **gardener** via
`ClaimType.Individual`. Settlement's recipient derivation now follows that:

- **Request + `ClaimType.Garden`** → exactly one recipient, the claiming garden's registered Celo Safe.
- **Request + `ClaimType.Individual`** → the frozen eligible contributors' own Celo accounts.
- **Offer, either claim type** → contributors, because the claimant is the *payer* and paying them
  would be a self-transfer.

This closes the circulation loop by earning rather than by subsidy: gardens accumulate G$ from
garden-scoped protocol Requests and spend it on protocol Offers. It also restores
`gardenRetainedAmount` to a coherent meaning. It required no Solidity change — `direction`,
`claimType`/`counterpartyKind`, `providerGarden`, and `payerGarden` are all already on the record.

## Scrutinise these first

1. **Is the recipient rule actually complete?** Walk every combination of
   `direction` × `claimType` × pool type and find one the three bullets above do not cover, or
   cover ambiguously. Specifically: a Garden-claimed Offer in the protocol pool, a Garden-claimed
   Request whose claiming garden has no registered settlement account, and any garden-internal
   commitment that could somehow reach `ClaimType.Garden`.
2. **Is `gardenRetainedAmount` genuinely coherent now?** Under provider-pays it meant a garden
   keeping a cut of what it earned. Trace it through all three recipient cases. For a
   Garden-claimed Request the whole consideration goes to one Safe — does retention still mean
   anything there, or should it be constrained to zero? For an Offer, the payer is a garden and the
   recipients are the provider's contributors — who retains, and does the invariant
   `declaredAmount == gardenRetainedAmount + Σ contributorPayout` still hold sensibly?
3. **The recipient tests are boundary tests, not settlement tests.** `SettlementModule` does not
   exist, so `test/unit/CommitmentPoolingPayer.t.sol` pins the *inputs* and the specified
   derivation rather than an implementation. Judge whether they prove anything real or are
   self-referential. The strongest claim they make: for a Garden-claimed Request the GardenAccount
   is **not** on the contributor roster while the steward who claimed **is**, so a contributor
   fan-out would pay a person for institutional work. Verify that claim independently.
4. **Exchange barter-only.** Is rejecting at acceptance sufficient, or can a commitment become
   priced after a pair is formed but before acceptance in a way that bypasses the check? Is
   rejecting at acceptance the right layer versus rejecting at creation of Offer B?
5. **Zero-payer hazard.** An unaccepted Offer has `payerGarden == address(0)`. Prove no
   settlement-facing path can read a zero payer and treat it as valid.

## Claims to verify independently — do not take these on trust

- 1,812 Solidity + 100 script tests pass. Payer/recipient suite 10/10, exchange 15/15.
- Module 21,205 bytes, margin 3,371 against the 24,576 EIP-170 limit; all new weight in libraries
  per Decision Log #55.
- Top-level storage layout identical across all 46 entries, every `__gap` untouched; only the
  in-mapping `Commitment` struct grew (832 → 864 bytes).
- `check:ontology`, `check:storage-layout`, `check:sizes`, `architecture-closure.validate.ts`,
  `hifi/validate.ts` all pass; lint 0 errors.
- ABI freeze exception is bounded to: `CommitmentAccepted` and `CommitmentCreated` each gaining one
  trailing `payerGarden`, the `Reward*` → `Consideration*` rename, and the new
  `ExchangeConsiderationUnsupported` error. `DisbursementKind.ContributorReward` deliberately
  unrenamed. No new `DisbursementKind` or `FundingRoute` member.

## Known scope calls — judge whether each is right

- **hifi prototype UI copy keeps "reward"/"support" wording.** That is presentation vocabulary
  governed by `glossary-community.md` (which says "declared support"), not the ABI. Read-model
  identifiers were renamed; user-facing copy was not. Recorded in `reports/corrections-log.md`.
- **The rename swept identifier names inside dated Decision Log entries** in `plan.todo.md`.
  Applied Linear payloads (`reports/linear/**`), corrections-log history, and dated
  `reports/*-2026-*.md` were excluded. You judged this acceptable in round 1; re-confirm it still
  is now that the sweep is wider.
- **`handoffs/README.md`** gained an index row for `claude-contracts-hardening.md` and its file
  count moved 19 → 20. That validator failure pre-existed at HEAD.

## Out of scope

- Linear updates and the Google Doc are deliberately untouched; they follow this review.
- `SettlementModule` does not exist. All settlement changes here are spec-only.
- `test/fork/ArbitrumCommitmentPooling.t.sol` and `test/unit/CommitmentSchemaRecovery.t.sol` are
  another session's in-flight work (+315/-2 and +106/-13), correctly identified in round 1 as not
  merely reformatted. They contain no payer/consideration/recipient references and must be excluded
  from this change's commit boundary. Do not review them; confirm only that nothing semantic in
  them was altered.
- `synthesis-circular-gd.svg/.png` was redrawn twice today. Review it only for whether it now
  states the architecture correctly — five relationships: HoA → pool; individual Requests paid to
  the gardener; garden-scoped Requests paid to the garden's Safe; Offers claimed and paid for by
  gardens; and gardens paying their own gardeners for their own commitments.
