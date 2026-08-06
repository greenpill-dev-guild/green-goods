# PRD-721 contracts implementation checkpoint — 2026-08-05

## Status

PRD-721 contract behavior remains **in progress** on `feature/build-commitment-pooling-contracts`,
with the review corrections implemented through `4256623d0`. The review-correction run is
**BLOCKED** only on canonical branch-mirror reconciliation: Plan Hub requires the machine-lane
signal `codex/contracts/commitment-pooling`, while this dispatch requires the actual execution
branch `feature/build-commitment-pooling-contracts`. Changing that validator is outside this
lane. This remains a tested checkpoint, not the full first-PR acceptance surface.

Afo's 2026-08-05 direction resolved the benchmark-order blocker. The real module paths and
canonical events were implemented before measurement, the 8/16/24/32/40 matrix passed, and all
five explicit `pure` ABI getters now reconcile to the frozen value **40**. The former synthetic
32 values are superseded and must not be consumed.

No deployment, dry broadcast, broadcast, transaction plan, or live chain mutation was needed or
performed. The remaining blockers are ordinary implementation and dry-run toolchain completeness,
not a need to validate this checkpoint through deployment.

## Commits

| Commit | Purpose |
|---|---|
| `a2e591063` | `test(contracts): verify storage layout baselines` — pre-source-edit baseline checkpoint. |
| `a11de79cb` | `test(contracts): add commitment pooling red coverage` — original RED files and synthetic harness history. |
| `9a515e3fe` | `feat(contracts): freeze commitment pooling bounds` — superseded provisional 32 scaffold. |
| `fdecac739` | `feat(contracts): add commitment accounting foundations` — registry, resolvers, wiring, and storage proof. |
| `3172341aa` | `fix(contracts): reject malformed assessment words` — canonical Assessment v3 ABI decoding. |
| `076c8937d` | `docs(contracts): block unsupported bounds freeze` — independent-review blocker evidence. |
| `7f6194e42` | `docs(contracts): authorize production bounds benchmark` — records Afo's order correction. |
| `96d7efd2b` | `test(contracts): exercise pooling production paths` — real dependency fixture, production RED cases, and 8/16/24/32/40 harness. |
| `4b08bc437` | `feat(contracts): implement pooling benchmark paths` — real bounded entrypoints and canonical events. |
| `042a8e851` | `perf(contracts): freeze pooling bounds at 40` — measured table and ABI getter reconciliation. |
| `8fd27b66b` | `test(contracts): cover pooling review regressions` — RED credit, reachability, claiming-garden, and replay cases. |
| `3353d4457` | `test(contracts): lock pooling readiness direction` — RED non-Open-cycle and Request-default cases. |
| `c37c04c3c` | `fix(contracts): enforce pooling readiness gates` — frozen Ready, confirmation, and configuration semantics. |
| `4256623d0` | `test(contracts): measure cold pooling bounds` — operation-specific cold transactions and actual canonical logs. |

## Completed in this checkpoint

- Preserved the exact 38 named CommitmentPoolingModule storage declarations plus `__gap[12]` and
  passed both generated-baseline and concrete-slot proof.
- Added pause-only dependency/schema configuration, complete-configuration unpause gating, and
  exact old/new configuration events.
- Implemented pool registration and lifecycle entrypoints used by the production paths, including
  wrong-root Protocol rejection before pool/protocol ID mutation, charter/cap readiness, and
  owner/Hats stewardship checks.
- Implemented Offer and Request creation for the measured paths, including full-quota Offer
  reservation, Request reservation at acceptance, provider-garden lead validation, Garden-request
  `requestedBy` lead accounting, class registration, and pool/cycle live-count creation effects.
- Implemented the frozen `creationPayloadHash` preimage byte-for-byte, stored/emitted hash parity,
  exact replay as a no-op, and conflicting-key rejection.
- Implemented bounded DomainImpact requirement derivation, repeated actions/domains, valid action
  UID zero handling, linked Work validation, caller-scoped link replay, decision-sequence credit and
  reversal accounting, approved-unit floor math, complete-set freshness scans, and automatic Ready
  evaluation.
- Implemented bounded lead-managed contributors, evidence attachment with exact-CID deduplication,
  one evidence credit per contributor across distinct CIDs, write-once Accepted-and-unfrozen
  assessment attachment, roster freeze, and ordinary confirmation/fulfillment.
- Implemented named confirmer acceptance de-duplication and contributor filtering plus
  roster-mutation reachability revalidation for the measured path.
- Enforced the shared Ready predicates on every automatic, submitted, and steward-override path:
  non-zero verified credit, Open recognition policy for cycle-scoped commitments, complete linked-
  Work freshness, and an ordinary threshold reachable after contributor exclusion or an explicitly
  configured protocol fallback.
- Corrected direction-aware ordinary confirmation: a Protocol-pool Offer claimed by a Garden uses
  the claiming GardenAccount's operator/owner Hat wearers, the GardenAccount itself never calls,
  provider/root-only stewards and contributors are rejected, and a Garden Request still uses its
  creator/requester as the default confirmer.
- Made configuration replay exact: initialization emits the paused-first transition, while exact
  dependency, schema, and pause repeats return without storage or event mutation.
- Preserved the previously completed CommitmentRegistry, AssessmentResolver dual-schema upgrade,
  TestimonyResolver, WorkApprovalResolver bridge, GardenToken callback, schema/deploy foundations,
  and storage baselines.

This completed slice is internally GREEN and supplies the exact five bounded production paths. It
does not yet implement every one of the interface's 86 functions or every full handoff state
machine.

## Recorded RED evidence

Before the first production source edit, commit `96d7efd2b` added the real proxy/dependency fixture
and real-module benchmark harness.

- `bun run --filter @green-goods/contracts test:match -- test/unit/CommitmentPooling.t.sol`
  compiled successfully; the six scaffold tests passed and the production suite failed in `setUp`
  because the scaffold had none of the required dependency setters/lifecycle selectors.
- `bun run --filter @green-goods/contracts test:match -- test/CommitmentPoolingBounds.t.sol`
  compiled successfully and `testBoundedConstantMatrix` failed before any measurement because the
  production module paths did not exist.

Earlier RED provenance remains as recorded: the initial CommitmentPooling, CommitmentRegistry, and
TestimonyResolver suites failed before their artifacts existed; the AssessmentResolver extension
ran 26 legacy passes with 12 expected v3/dual-schema failures. WorkApproval bridge and GardenToken
callback coverage remain GREEN-only historical provenance.

The fresh reviewer-fix RED sequence was also recorded before the production correction:

- `8fd27b66b`: the exact CommitmentPooling command produced 12 passes and 5 expected failures for
  zero-credit Ready override, unreachable default confirmation, provider-garden authorization,
  missing initialization pause replay, and noisy exact configuration repeats.
- `3353d4457`: the expanded command produced 12 passes and 7 expected failures, adding non-Open
  recognition-policy and Garden-Request direction cases. After `c37c04c3c`, all 19 focused cases
  pass.

## Frozen production bounds

Re-measured on the `4256623d0` tree with Solc 0.8.28 using exactly:

`bun run --filter @green-goods/contracts test:match -- test/CommitmentPoolingBounds.t.sol`

The harness contains 60 operation-specific cases. Each case prepares a fresh real proxy/module
dependency graph and specification-valid state in Foundry `setUp`, then measures exactly one top-
level test transaction with a fresh access list. Each cell records the largest cold transaction
and largest actual canonical module-log payload among its named operations.

| Bound | 8 | 16 | 24 | 32 | 40 | Selected | Why 48 is rejected |
|---|---:|---:|---:|---:|---:|---:|---|
| `MAX_REQUIREMENTS` | 1,242,130 / 1,920 B | 1,873,097 / 2,688 B | 2,504,598 / 3,456 B | 3,136,637 / 4,224 B | 3,769,213 / 4,992 B | **40** | Outside the authorized measured matrix; no cold-transaction vector proof. |
| `MAX_LINKED_WORKS_PER_COMMITMENT` | 168,032 / 128 B | 170,870 / 128 B | 230,239 / 128 B | 289,608 / 128 B | 348,978 / 128 B | **40** | Outside the authorized measured matrix; no cold-transaction vector proof. |
| `MAX_CONTRIBUTORS_PER_COMMITMENT` | 166,137 / 448 B | 194,515 / 704 B | 288,197 / 960 B | 396,023 / 1,216 B | 517,992 / 1,472 B | **40** | Outside the authorized measured matrix; no cold-transaction vector proof. |
| `MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT` | 114,980 / 448 B | 194,515 / 704 B | 288,197 / 960 B | 396,023 / 1,216 B | 517,992 / 1,472 B | **40** | Outside the authorized measured matrix; no cold-transaction vector proof. |
| `MAX_CONFIRMERS` | 767,941 / 1,024 B | 960,070 / 1,024 B | 1,152,133 / 1,024 B | 1,344,270 / 1,152 B | 1,536,424 / 1,408 B | **40** | Outside the authorized measured matrix; no cold-transaction vector proof. |

All measured cold transactions remain below 10,000,000 gas and the actual canonical logs emitted
with the harness's fixed strings remain below 16,384 data bytes. This is not a global payload claim:
the frozen ABI keeps `unitLabel`, metadata/evidence/reason CIDs, and declared-value basis as dynamic
strings, while the specification requires only non-empty values and defines no maximum byte length.
The table therefore proves the bounded-vector contribution for the exact canonical fixture strings.
No string cap or ABI error was invented. The same limitation, values, and rejection reasons are
recorded in `handoffs/codex-contracts.md`; all five getters remain reconciled at **40**.

## Command evidence

All commands were run from the repository root through the exact Bun wrappers.

| Command surface | Result |
|---|---|
| `CommitmentPooling.t.sol` | PASS — 19 tests. |
| `CommitmentRegistry.t.sol` | PASS — 6 tests. |
| `CommitmentPoolingBounds.t.sol` | PASS — 60 cold production-path tests. |
| `AssessmentResolver.t.sol` | PASS — 40 tests. |
| `TestimonyResolver.t.sol` | PASS — 8 tests. |
| `WorkApprovalResolver.t.sol` | PASS — 43 tests. |
| `StorageLayout.t.sol` | PASS — 28 tests. |
| Seven named files combined | PASS — 204 tests. |
| `bun run --filter @green-goods/contracts check:storage-layout` | PASS — all 12 protected layouts matched. |
| `bun run --filter @green-goods/contracts test:script` | PASS — 53 tests in 5 files. |
| `bun run --filter @green-goods/contracts build:full` | PASS. |
| `bun run --filter @green-goods/contracts lint:check` | PASS — 0 errors, 195 existing warning-level findings. |
| `bun run --filter @green-goods/contracts test` | PASS — 1,651 tests across 127 suites, 0 failed, 0 skipped. |
| `node scripts/harness/plan-hub.mjs validate` | PASS — 41 feature hubs. |

The first sandboxed Foundry invocation crashed while initializing macOS Dynamic Store. The same
exact Bun commands then ran outside the filesystem sandbox; that changed no dependency, command,
repository artifact, environment file, or chain state.

## Deviations and observations

- No frozen ABI, storage, event, error, hash preimage, or state-machine deviation is known in the
  completed slice. No contradictory specification source was encountered. The historical
  8/16/24/32 handoff wording is now explicitly reconciled to Afo's later 8/16/24/32/40 authorization.
- The frozen dynamic string fields prevent a finite global event-payload maximum. The prior report's
  broader payload-safety wording was removed; this is an evidence limitation, not a contract-spec
  deviation.
- Reviewer finding 5 cannot be applied inside the authorized paths. `status.json` keeps Plan Hub's
  required machine-lane branch `codex/contracts/commitment-pooling` and separately records the
  actual dispatched branch under `execution_sub_lanes.contracts.branch`. Setting the machine-lane
  value to the actual branch makes `node scripts/harness/plan-hub.mjs validate` fail because
  `scripts/harness/plan-hub.mjs` hard-codes the former value. That script is outside the contracts
  lane, so the exact evidence and requested authorization are recorded in
  `reports/contracts-blocker-2026-08-05.md`.
- The module intentionally does not claim interface completeness yet. Missing selectors are listed
  below and must be implemented and RED-tested before this PR can be called PRD-721 complete.
- The checkout was clean at dispatch and no unrelated concurrent change was encountered.
- No dependency was installed; no package `.env` was created or read; no file outside
  `packages/contracts/**` and `.plans/active/commitment-pooling/**` was edited.
- SettlementModule, Celo execution, vouchers/adapters, CreditRegistry, UI, existing schema edits,
  bulk schema updates, all broadcasts, and all live chain-state mutation remained out of scope.

## Remaining PRD-721 work

1. Finish the cycle lifecycle and live-count edge cases, including Season/Campaign constraints,
   reconciliation/compost/cancel, and Expired → Disputed count restoration.
2. Implement CommitmentSeries Active/Resting/Retired behavior and atomic `acceptExchange`, including
   the complete direct-B consent and reservation revalidation surface.
3. Complete Open contributor join/leave, managed removal, requirement assignment, unlink,
   two-pass `syncWorkDecisions`, stale/late decision cases, and all max-plus-one cases.
4. Complete `setDeclaredReward`, `setDeclaredValue`, `setConfirmerRule`, local/protocol fallback
   provenance, cancellation, expiry, disputes, and payout recording.
5. Implement `validateRecognitionSnapshot` with the canonical settlement-spec §3.1.3 preimage
   `keccak256(abi.encode(block.chainid, commitmentId, recognitionEntries))` and complete recognition
   weight/remainder tests.
6. Expand `CommitmentPooling.t.sol` to every remaining handoff RED case and make ABI/interface
   completeness an executable proof.
7. Add the isolated Commitment Pooling and testimony deployment/finalization targets, grouped
   GardenToken/WorkApproval upgrade target, deterministic reconciliation, and dry-run tests.
8. Add the Arbitrum Sepolia `421614` toolchain and mandatory `upgrade.ts --sender` plus live
   `owner()` preflight, then run only the authorized dry-run/pure-simulation commands.
9. Re-run the exact full GREEN gate after those increments. The two Arbitrum One future-only
   `--tx-plan` commands remain prohibited and unrun.

## Draft PR description

**Title:** `feat(contracts): implement commitment pooling production core`

```markdown
Linear: PRD-721

## Summary

- Add the canonical Commitment Pooling storage/interface foundations, non-transferable registry,
  dual-schema AssessmentResolver, TestimonyResolver, WorkApproval bridge, and GardenToken wiring.
- Implement the production pool, creation/replay, acceptance, contributor, evidence, Work-decision,
  assessment, readiness, and ordinary-confirmation paths used by the frozen bounded vectors.
- Enforce the frozen Ready, claimant-garden confirmation, and exact configuration-replay semantics
  found by independent review.
- Replace the warmed synthetic planning values with the cold-transaction 8/16/24/32/40 production
  matrix, actual canonical logs, and five explicit ABI bounds reconciled at 40.

This remains a checkpoint PR description until the remaining cycle/series/exchange/recognition,
terminal/fallback, and deployment-toolchain acceptance listed in the implementation report lands.

## Validation

- [x] Seven named Foundry files pass (204 tests)
- [x] `bun run --filter @green-goods/contracts check:storage-layout`
- [x] `bun run --filter @green-goods/contracts test:script` (53 tests)
- [x] `bun run --filter @green-goods/contracts build:full`
- [x] `bun run --filter @green-goods/contracts lint:check`
- [x] `bun run --filter @green-goods/contracts test` (1,651 tests, 0 failed)
- [ ] Complete remaining PRD-721 lifecycle/ABI and dry-run deployment acceptance

## Safety

- No broadcast, dry broadcast, tx-plan, or live chain-state mutation
- No dependency or environment-file changes
- No SettlementModule, Celo execution, voucher, CreditRegistry, UI, or bulk schema work
```
