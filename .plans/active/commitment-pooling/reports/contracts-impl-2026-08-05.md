# PRD-721 contracts implementation checkpoint — 2026-08-05

## Status

PRD-721 remains **in progress** on `feature/build-commitment-pooling-contracts` at
`042a8e851`. This is the handoff-authorized clean checkpoint after the production-path bounds
freeze, not the full first-PR acceptance surface.

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

## Frozen production bounds

Measured on the `4b08bc437` tree with Solc 0.8.28 using exactly:

`bun run --filter @green-goods/contracts test:match -- test/CommitmentPoolingBounds.t.sol`

Each cell deploys a fresh real proxy/module dependency graph, executes the named production
entrypoints/scans, and records the largest transaction plus largest ABI-encoded canonical event
data in that path.

| Bound | 8 | 16 | 24 | 32 | 40 | Selected | Why 48 is rejected |
|---|---:|---:|---:|---:|---:|---:|---|
| `MAX_REQUIREMENTS` | 1,043,475 / 1,920 B | 1,534,758 / 2,688 B | 2,028,433 / 3,456 B | 2,524,982 / 4,224 B | 3,024,608 / 4,992 B | **40** | Outside the authorized measured matrix; no transaction/indexer safety proof. |
| `MAX_LINKED_WORKS_PER_COMMITMENT` | 108,320 / 128 B | 108,326 / 128 B | 137,757 / 128 B | 181,126 / 128 B | 224,496 / 128 B | **40** | Outside the authorized measured matrix; no transaction/indexer safety proof. |
| `MAX_CONTRIBUTORS_PER_COMMITMENT` | 85,465 / 416 B | 97,269 / 672 B | 152,394 / 928 B | 221,664 / 1,184 B | 305,080 / 1,440 B | **40** | Outside the authorized measured matrix; no transaction/indexer safety proof. |
| `MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT` | 56,653 / 448 B | 97,635 / 704 B | 152,761 / 960 B | 222,032 / 1,216 B | 305,446 / 1,472 B | **40** | Outside the authorized measured matrix; no transaction/indexer safety proof. |
| `MAX_CONFIRMERS` | 258,926 / 384 B | 447,431 / 640 B | 646,176 / 896 B | 855,161 / 1,152 B | 1,074,387 / 1,408 B | **40** | Outside the authorized measured matrix; no transaction/indexer safety proof. |

All measurements remain below the frozen harness ceilings of 10,000,000 gas and 16,384 event-data
bytes. The same values and rejection reasons are recorded in `handoffs/codex-contracts.md`.

## Command evidence

All commands were run from the repository root through the exact Bun wrappers.

| Command surface | Result |
|---|---|
| `CommitmentPooling.t.sol` | PASS — 12 tests. |
| `CommitmentRegistry.t.sol` | PASS — 6 tests. |
| `CommitmentPoolingBounds.t.sol` | PASS — 1 production matrix test. |
| `AssessmentResolver.t.sol` | PASS — 40 tests. |
| `TestimonyResolver.t.sol` | PASS — 8 tests. |
| `WorkApprovalResolver.t.sol` | PASS — 43 tests. |
| `StorageLayout.t.sol` | PASS — 28 tests. |
| Seven named files combined | PASS — 138 tests. |
| `bun run --filter @green-goods/contracts check:storage-layout` | PASS — all 12 protected layouts matched. |
| `bun run --filter @green-goods/contracts test:script` | PASS — 53 tests in 5 files. |
| `bun run --filter @green-goods/contracts build:full` | PASS. |
| `bun run --filter @green-goods/contracts lint:check` | PASS — 0 errors, 195 existing warning-level findings. |
| `bun run --filter @green-goods/contracts test` | PASS — 1,585 tests across 68 suites, 0 failed, 0 skipped. |
| `node scripts/harness/plan-hub.mjs validate` | PASS — 41 feature hubs. |

The first sandboxed Foundry invocation crashed while initializing macOS Dynamic Store. The same
exact Bun commands then ran outside the filesystem sandbox; that changed no dependency, command,
repository artifact, environment file, or chain state.

## Deviations and observations

- No frozen ABI, storage, event, error, hash preimage, or state-machine deviation is known in the
  completed slice. No contradictory specification source was encountered.
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
4. Complete `setDeclaredReward`, `setDeclaredValue`, `setConfirmerRule`, default Garden confirmer,
   local/protocol fallback provenance, cancellation, expiry, disputes, and payout recording.
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
- Replace the synthetic planning values with the real 8/16/24/32/40 production matrix and freeze
  all five explicit ABI bounds at 40.

This remains a checkpoint PR description until the remaining cycle/series/exchange/recognition,
terminal/fallback, and deployment-toolchain acceptance listed in the implementation report lands.

## Validation

- [x] Seven named Foundry files pass (138 tests)
- [x] `bun run --filter @green-goods/contracts check:storage-layout`
- [x] `bun run --filter @green-goods/contracts test:script` (53 tests)
- [x] `bun run --filter @green-goods/contracts build:full`
- [x] `bun run --filter @green-goods/contracts lint:check`
- [x] `bun run --filter @green-goods/contracts test` (1,585 tests, 0 failed)
- [ ] Complete remaining PRD-721 lifecycle/ABI and dry-run deployment acceptance

## Safety

- No broadcast, dry broadcast, tx-plan, or live chain-state mutation
- No dependency or environment-file changes
- No SettlementModule, Celo execution, voucher, CreditRegistry, UI, or bulk schema work
```
