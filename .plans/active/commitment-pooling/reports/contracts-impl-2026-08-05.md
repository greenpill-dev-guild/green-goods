# PRD-721 contracts implementation checkpoint — 2026-08-05

## Status

PRD-721 is **blocked after review** on `feature/build-commitment-pooling-contracts` at
`3172341aa`.

This run reached a clean, committed, package-green implementation checkpoint after the required
baseline → RED → benchmark/freeze order, but independent review found that the synthetic benchmark
does not support the claimed production freeze. The raw measurements remain reproducible evidence;
the five values must not be consumed downstream as frozen production bounds. It is not the full
first-PR acceptance surface. The complete
`CommitmentPoolingModule` lifecycle, CommitmentSeries/exchange behavior, frozen creation and
recognition hash implementations, and the isolated schema/deployment/421614/upgrade toolchain still
remain. No PR was opened or pushed.

## Commits

| Commit | Purpose |
|---|---|
| `a2e591063` | `test(contracts): verify storage layout baselines` — pre-source-edit checkpoint. Regeneration matched the existing AssessmentResolver, WorkApprovalResolver, and GardenToken baselines byte-for-byte, so the commit is intentionally empty. |
| `a11de79cb` | `test(contracts): add commitment pooling red coverage` — initial RED files and the NET-NEW bounds harness. |
| `9a515e3fe` | `feat(contracts): freeze commitment pooling bounds` — measured table, all five constants frozen at 32, explicit `pure` ABI getters, canonical interfaces, and the 38-slot module declaration scaffold with `__gap[12]`. |
| `fdecac739` | `feat(contracts): add commitment accounting foundations` — registry, resolver/token wiring, concrete storage assertions, generated baselines, and focused GREEN coverage. |
| `2c44ecefa` | `docs(contracts): record PRD-721 checkpoint` — initial implementation report and lane state. |
| `3172341aa` | `fix(contracts): reject malformed assessment words` — canonical uint8 ABI decoding for Assessment v3, two reproduced RED regression cases, and corrected TDD provenance. |

## Completed implementation

- Preserved and verified the pre-change AssessmentResolver, WorkApprovalResolver, and GardenToken
  compiler baselines before any source edit.
- Added the canonical Commitment Pooling and Commitment Registry ABI declarations.
- Added `CommitmentPoolingModule` with the frozen 38-entry storage declaration order,
  `__gap[12]`, paused initialization, root-garden pinning, all five explicit `pure` bound getters,
  cycle-less 20/80 recognition policy, and creation/work-operation read-through getters.
- Added the non-transferable `CommitmentRegistry` with module-only accounting, one-shot
  Registered → Committed → Released/Fulfilled transitions, provider open-commitment caps, and a
  pause-gated module replacement path.
- Upgraded AssessmentResolver in place to 3+47 storage with one-way AssessmentV3 schema pinning,
  v2/v3 collision protection, preserved v2 behavior, and the Baseline/Delta/Technical v3 rules.
- Added the NET-NEW TestimonyResolver with one-way schema pinning, schema-before-module ordering,
  unconditional zero-module fail-closed behavior, community membership checks, CID validation,
  and optional commitment garden validation.
- Extended WorkApprovalResolver to 5+45 storage with monotonic per-Work decision sequence/audit
  state and a non-blocking approval/rejection bridge.
- Appended GardenToken's Commitment Pooling module at slot 213 offset 2, retained its 37-slot gap,
  and made the mint callback graceful.
- Added concrete storage assertions and fail-closed baselines for CommitmentPoolingModule,
  CommitmentRegistry, TestimonyResolver, AssessmentResolver, WorkApprovalResolver, and GardenToken.

The focused tests cover the completed foundation. They do not yet constitute every behavioral case
in the handoff's full RED list; the unimplemented module lifecycle cases remain RED work for the
continuation.

## Recorded RED evidence

The four RED targets listed below were run through their exact Bun-wrapped commands before their
implementations. The WorkApproval decision-bridge and GardenToken callback tests landed in the same
commit as their implementations, so they are GREEN regression evidence but do not have historical
RED-before-GREEN provenance. The remaining handoff RED list also remains incomplete.

- `test/unit/CommitmentPooling.t.sol`: failed in setup because no matching
  `CommitmentPoolingModule` artifact existed.
- `test/unit/CommitmentRegistry.t.sol`: failed in setup because no matching
  `CommitmentRegistry` artifact existed.
- `test/unit/TestimonyResolver.t.sol`: failed in setup because no matching
  `TestimonyResolver` artifact existed.
- `test/unit/AssessmentResolver.t.sol`: compiled all 38 tests; 26 legacy tests passed and 12 new
  v3/dual-schema tests failed through missing logs, missing revert data, or `EvmError: Revert`.

These were the expected behavioral failures for the implemented slice. The initial compile-only
attempt was replaced with runtime artifact lookup so the RED commands could execute and record
behavioral failures before source implementation.

## Bounded-constant measurements

**Review disposition:** these are synthetic-harness measurements, not production-path freeze
evidence. The harness does not call the production module paths or encode every canonical event, and
it does not measure a next candidate above 32. The code still returns 32 from the five `pure`
getters, but the lane is blocked and downstream consumers must treat those values as provisional
until the resolution in `reports/contracts-blocker-2026-08-05.md` is approved and completed.

Measured on `a11de79cb` with Solc 0.8.28 using the exact
`bun run --filter @green-goods/contracts test:match -- test/CommitmentPoolingBounds.t.sol` command.
Each value is gas / ABI-encoded event-data payload bytes.

| Bound | 8 | 16 | 24 | 32 | Selected | Why the next size is rejected |
|---|---:|---:|---:|---:|---:|---|
| `MAX_REQUIREMENTS` | 435,885 / 960 B | 823,052 / 1,728 B | 1,210,262 / 2,496 B | 1,597,514 / 3,264 B | **32** | Above 32 was not measured, so it has no transaction/indexer safety proof. |
| `MAX_LINKED_WORKS_PER_COMMITMENT` | 212,262 / 320 B | 400,065 / 576 B | 587,883 / 832 B | 775,718 / 1,088 B | **32** | Above 32 was not measured, so it has no transaction/indexer safety proof. |
| `MAX_CONTRIBUTORS_PER_COMMITMENT` | 399,076 / 640 B | 772,653 / 1,152 B | 1,146,238 / 1,664 B | 1,519,832 / 2,176 B | **32** | Above 32 was not measured, so it has no transaction/indexer safety proof. |
| `MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT` | 189,705 / 448 B | 375,359 / 704 B | 561,014 / 960 B | 746,672 / 1,216 B | **32** | Above 32 was not measured, so it has no transaction/indexer safety proof. |
| `MAX_CONFIRMERS` | 394,513 / 384 B | 763,806 / 640 B | 1,133,101 / 896 B | 1,502,398 / 1,152 B | **32** | Above 32 was not measured, so it has no transaction/indexer safety proof. |

Every measured cell stayed below the harness ceilings of 10,000,000 gas and 16,384 payload bytes.
The complete harness test consumed 33,157,286 gas across the full matrix. The same results and
selection reasons are frozen in `handoffs/codex-contracts.md`.

## GREEN command evidence

All commands were run from the repository root exactly as specified in the handoff.

| Command surface | Result |
|---|---|
| Seven named `test:match` commands | PASS at `3172341aa` — 132 tests: Pooling 6, Registry 6, bounds 1, Assessment 40, Testimony 8, WorkApproval 43, storage 28. |
| `bun run --filter @green-goods/contracts check:storage-layout` | PASS — all 12 protected contracts matched their baselines. |
| `bun run --filter @green-goods/contracts test:script` | PASS — 53 tests in 5 files. |
| `bun run --filter @green-goods/contracts build:full` | PASS. |
| `bun run --filter @green-goods/contracts lint:check` | PASS — 0 errors, 195 warning-level findings. The update check could not resolve `registry.npmjs.org`, but lint completed successfully and no dependency was installed. |
| `bun run --filter @green-goods/contracts test` | PASS at `3172341aa` — 1,579 tests across 67 suites, 0 failed, 0 skipped. |

The Bun-wrapped Foundry commands were executed outside the filesystem sandbox after the sandboxed
macOS runtime crashed in Dynamic Store initialization. This changed no command, dependency, chain
state, or repository artifact.

## Storage evidence

- CommitmentPoolingModule custom entries occupy slots 151–188; `__gap[12]` starts at 189.
- CommitmentRegistry begins at slot 101, uses six named entries through 106, and starts
  `__gap[44]` at 107.
- AssessmentResolver appends `assessmentV3SchemaUID` at slot 103 and starts `__gap[47]` at 104.
- WorkApprovalResolver appends its bridge/decision fields at slots 103–105 and starts
  `__gap[45]` at 106.
- TestimonyResolver uses slots 101–102 and starts `__gap[48]` at 103.
- GardenToken packs `commitmentPoolingModule` into slot 213 offset 2 and keeps
  `__gap[37]` at slot 214.

No slot mismatch, collision, or baseline divergence was observed.

## Deviations and observations

- Review-confirmed deviation: the bounds harness is synthetic and does not establish the five
  production-safe frozen values claimed by the table/getters. The affected lane is blocked; no new
  bound or alternative freeze rule was chosen.
- The checkout was clean at dispatch. No pre-existing or concurrent working-tree changes were
  encountered.
- No dependency was installed, no package `.env` was created or read, and no file outside
  `packages/contracts/**` and `.plans/active/commitment-pooling/**` was edited.
- No deployment, broadcast, transaction plan against Arbitrum One, live owner/authority change,
  schema registration, or other live chain-state mutation was performed.
- SettlementModule, Celo execution, vouchers/adapters, CreditRegistry, UI, bulk schema updates, and
  existing schema-definition edits remained out of scope.

## Remaining PRD-721 work

1. Resolve `reports/contracts-blocker-2026-08-05.md`: implement the exact production bounded paths
   under a human-approved order correction, measure 8/16/24/32 plus the next candidate, and only
   then replace the five provisional getter values and handoff table with defensible frozen bounds.
2. Expand `CommitmentPooling.t.sol` and adjacent regression files to the complete handoff RED list,
   then implement the complete pool, cycle, commitment, claim, contributor, Work/evidence,
   assessment, confirmation, dispute, recognition, and Hypercert-composer state machines.
3. Implement CommitmentSeries and the standing-commitments/exchange semantics from the
   superseding specification.
4. Implement the frozen `creationPayloadHash` preimage byte-for-byte, including replay/no-event
   behavior and conflict proof.
5. Implement canonical `recognitionSnapshotHash` exactly as
   `keccak256(abi.encode(block.chainid, commitmentId, recognitionEntries))`.
6. Add isolated Commitment Pooling and Community Testimony deployment/finalization targets,
   deterministic schema reconciliation, and the grouped upgrade target.
7. Add the Arbitrum Sepolia `421614` network/toolchain records and required dry-run verifier paths.
8. Add `upgrade.ts` mandatory `--sender` handling and live `owner()` preflight.
9. Run the remaining dry-run/pure-simulation acceptance commands only after those toolchain targets
   exist. The two Arbitrum One future-only `--tx-plan` commands remain unrun.

## Draft PR description

**Title:** `feat(contracts): establish commitment pooling foundations`

```markdown
Linear: PRD-721

## Summary

- Preserve and protect the upgrade storage baselines before implementation.
- Add the canonical Commitment Pooling/Register interfaces, 38+12 module storage scaffold,
  non-transferable register, AssessmentV3 dual-schema upgrade, TestimonyResolver, WorkApproval
  decision bridge, and GardenToken callback.
- Record the required synthetic 8/16/24/32 matrix and preserve the explicit ABI getter surface.

This checkpoint is blocked after independent review: the synthetic matrix does not freeze
production-safe bounds, and downstream lanes must not consume the current value 32. The complete
pooling lifecycle/series/hash behavior and deployment/toolchain targets also remain.

## Validation

- [x] All seven named Foundry test files pass (132 tests at `3172341aa`)
- [x] `bun run --filter @green-goods/contracts check:storage-layout`
- [x] `bun run --filter @green-goods/contracts test:script` (53 tests)
- [x] `bun run --filter @green-goods/contracts build:full`
- [x] `bun run --filter @green-goods/contracts lint:check`
- [x] `bun run --filter @green-goods/contracts test` (1,579 tests)
- [ ] Production-path bounds measurement and defensible freeze
- [ ] Full PRD-721 behavioral and dry-run deployment acceptance

## Safety

- No broadcast or live chain-state mutation
- No dependency or environment-file changes
- No SettlementModule, Celo, voucher, CreditRegistry, UI, or bulk schema work
```
