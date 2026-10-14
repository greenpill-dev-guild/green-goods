# Production Gas Boundary Correction and Test-Lane Re-Review — 2026-08-12

## Scope and reviewed range

This is an incremental committed-range review of the correction that repaired the contract
test-profile split and established a truthful production-codegen source-acknowledgment gas
boundary. It extends the member-funded release re-review of 2026-08-12 and pins:

`50a2c29d3d9f08ed97d9b0e8b8de95d07f6fcb63..56263a6f17396d988620489bca30cee3ce48f5cd`

The range contains five commits:

- `d8549e4e668441e25ee9b315991f0be824061081` — perf(contracts): 3x faster test compiles, capped
  PR invariants, nightly deep lane (previously outside any reviewed range)
- `021e5b25843b8f714df394dda80a375acc013966` — docs(contracts): confirm internal release review
- `95530c91c0cb6eb8938ad78c91eacc8219468443` — fix(contracts): prove production acknowledgment
  gas boundary
- `f3f57dc1dade36a79ede516537967a19cc5229d5` — ci(contracts): require production gas proof
- `56263a6f17396d988620489bca30cee3ce48f5cd` — test(contracts): cover Garden account guard
  branches

Afo explicitly confirmed on 2026-08-12 that the August 10 decision to substitute an internal
committed-range review for an external vendor audit extends to the member-funded increment
(`member-funded-internal-review-confirmation-2026-08-12.md`). This correction range continues
under that same internal-review substitution; it introduces no new source contracts and no
production bytecode change.

## Why a correction was required

Commit `d8549e4e6` switched the PR `test` profile to `optimizer = false` for compile speed.
That exposed a latent defect in the release gas evidence:

1. The required package gate `bun run test` went red — the batch-3 acknowledgment fixture
   exceeded the fixed 300,000 receiver allowance under optimizer-off codegen.
2. Re-measuring under the actual release codegen (`profile.production`, via_ir,
   optimizer_runs = 1) showed batch 3 failing there too — while the frozen release config
   recorded batch size 3 as proven, using runs-200 measurements (250,326 gas).
3. The root cause of the bogus prior evidence: **`vm.cool` silently does not cool accounts or
   storage in normal (non-tracing) forge runs.** Measured on forge 1.5.1, 2026-08-12: a getter
   costing 16,567 gas naturally cold re-costs 7,120 after `cool()` in a plain run (still
   warm), but 16,620 under `--gas-report` tracing (properly re-cooled). Every prior
   "cold-state" number measured without tracing was warm-subsidized.

## The truthful production boundary

Measured under `FOUNDRY_PROFILE=production` with `forge test --isolate` — every top-level call
executes as its own transaction with a fresh access list, the same cold-receiver reality as a
live CCIP delivery. Fresh state per size, distinct funded plans, pooling reads disabled:

| batch size | capped attempt @300,000 | uncapped completion cost |
|---|---|---|
| 1 | completes — 171,563 | — |
| **2 (accepted)** | **completes — 240,108** | — |
| **3 (first rejected)** | **fails (consumes 294,432)** | **308,653** |
| 4 | fails (294,432) | 377,198 |
| 5 | fails (294,432) | 445,743 |
| 24 (hard max) | fails (294,432) | 1,748,098 |

The release batch-size limit is therefore **2**. Batch 3 genuinely needs 308,653 gas >
300,000; its capped attempt reverts without partial state (batch stays Dispatched, fundings
stay Consumed, empty revert payload), and the identical unchanged acknowledgment completes
when only the receiver-gas cap is raised — no double payment, no state divergence. The
hard-max (24) rejection proof is retained. The 300,000 receiver allowance itself was not
changed or reinterpreted.

The prior release evidence (accepted 3 at 250,326 / first rejected 4 at 304,689, recorded
2026-08-11) was measured under optimizer-runs-200 codegen with a warm receiver path; it was
not release-artifact evidence and has been replaced.

## What changed

Boundary fixtures (`test/unit/SettlementFunding.t.sol`):

- `PROPOSED_BATCH_SIZE_LIMIT` 3 → 2; funding-state assertions and log labels re-pointed to the
  proven boundary (accepted batch items 100–101; first-rejected items 150–152).
- Documented the execution contract: the boundary fixtures are meaningful only under
  production codegen with `--isolate`; `_coolSettlementAcknowledgmentPath()` remains only as
  defense in depth for tracing runs.

Validation lanes (`packages/contracts/package.json`):

- The three boundary fixtures are excluded by exact signature-anchored name
  (`--no-match-test '^(…)\(\)$'`) from every non-production-codegen lane: `test`,
  `test:solidity`, `test:deep`, `test:fast`, `test:lite`. No broad patterns; nothing else is
  filtered — the other 20 SettlementFundingTest tests remain in the fast lanes. (Forge matches
  test filters against the full signature `name()`; a bare-name `$` anchor matches nothing,
  which the new guardrails now pin.)
- New `test:gas:release` (`script/utils/run-release-gas-gate.ts`): builds the full unlinked
  production `src` artifact set, verifies via `forge test --list` that every fixture named in
  `config/commitment-pooling-release.json` still resolves (fail-closed against selector
  drift), then runs the three fixtures with `--isolate -vv`.
- `bun run test` remains a single honest entrypoint, now chaining: typecheck → optimizer-off
  suite (boundary fixtures excluded) → `test:gas:release` → script tests. The production build
  inside the gate also provides the artifacts the release-lock derivation test reads, so the
  chain works on a cold checkout.
- Guardrail vitest (`script/utils/release-gas-gate.test.ts`) pins the routing: exclusions
  match the release-config fixture names exactly, the gate stays chained inside `test`, the
  runner keeps `production` + `--isolate` + `--list`, and each fixture exists exactly once in
  the Solidity test tree.

Release configuration (`config/commitment-pooling-release.json` + lock):

- `batching.releaseBatchSizeLimit` 3 → 2; the measurement block records acceptedBatchSize 2 at
  240,108, firstRejectedBatchSize 3 at 308,653, `measuredOn` 2026-08-12, plus two new honesty
  fields: `profile` (must equal `build.profile`; enforced) and
  `executionMode: "isolated-per-call-transactions"` (enforced).
- `validateReleaseManifest` now rejects measurements taken under any profile other than the
  frozen build profile, or without per-call transaction isolation. The existing arithmetic
  boundary check (accepted ≤ 300,000 < firstRejected) remains and now holds with honest
  numbers.
- Lock regenerated via `FOUNDRY_PROFILE=production bun run build:fast` +
  `bun run release:manifest:write`. Diff against the prior lock: exactly one line —
  `manifestHash` `0x13114a1e…` → `0x6383e1ad…`. All 31 CREATE2 identities (21 libraries, 5
  implementations, 5 proxies), every creation/runtime hash, and the library map are
  byte-identical: **no production bytecode drift**. `sourceCommit` remains
  `49fc62cc0e665de929baca02c1228a43d681ad68` (the frozen implementation source; no `src`
  change in this range).
- Indexer config hash recomputed from `packages/indexer/config.yaml`:
  `0xb3cfc35d0ff1152a7543c5209032ac4b118b08cbd2c916f6d62fdef0bb3b82b0` — unchanged, matches
  the frozen manifest value.

CI (`.github/workflows/contracts.yml`):

- The required unit job's `bun run test` now carries the production gas gate on every PR and
  push; the workflow documents the chain and the two-profile cache lineage. Comments only —
  no step, permission, pin, secret, or trigger changes. SHA-pinned actions,
  `permissions: contents: read`, per-job cache lineages, and the absence of secrets and
  broadcast commands are all preserved. `contracts-nightly.yml` is untouched (schedule,
  90-minute timeout, no secrets); its role is unchanged: deep fuzz/invariants under
  optimizer-200 — explicitly not release gas evidence.

Coverage restoration (`test/unit/GardenAccount.t.sol`):

- forge 1.5.1 (upgraded from 1.3.5 during the optimization work) enumerates 227 more branch
  points across the identical tree (1,425 → 1,652), which dropped `src/accounts/Garden.sol` to
  21/31 branches (67.74%) against its 75% coverage-audit target and turned
  `test:audit:coverage` red. Eight new guard-branch tests close it: NameTooLong on
  `initialize` and `updateName`, the `executeGardenSelfStake` self-only guard, and the four
  `attemptCommunityMembership` early returns. Garden.sol now measures 28/31 branches (90.32%).

## Coverage ledger

| Surface | Reviewed | Evidence |
|---|---|---|
| `test/unit/SettlementFunding.t.sol` boundary fixtures | every touched line | diff review + green gate runs |
| `test/unit/SettlementPayer.t.sol` router harness | read in full | unchanged; semantics verified by probe |
| `test/unit/GardenAccount.t.sol` additions | every touched line | 91/91 green; scoped LCOV proves each target branch flipped |
| `packages/contracts/package.json` script lanes | every touched line | guardrail vitest + green runs of each lane |
| `script/utils/run-release-gas-gate.ts` (new) | authored + reviewed | fail-closed proven live: its `--list` check caught the bad-anchor drift class during development |
| `script/utils/release-gas-gate.test.ts` (new) | authored + reviewed | 4 tests green in `test:script` |
| `script/utils/release-manifest.ts` validation | every touched line | negative cases added in vitest |
| `config/commitment-pooling-release.json` + `.lock.json` | every touched line | regeneration + one-line lock diff |
| `.github/workflows/contracts.yml` / `contracts-nightly.yml` | every touched line / read | YAML parses; comments-only diff / untouched |
| `foundry.toml` | read in full | untouched — the optimizer-off PR speed lane is preserved as-is |

## Findings and closures

1. **Frozen release config recorded an unprovable batch size (3).** Closed: limit re-pointed
   to the proven 2 with production-profile isolated measurements; manifest validation now
   enforces measurement profile and isolation mode.
2. **`vm.cool`-based cold-path evidence is invalid in normal runs.** Closed for the source
   acknowledgment lane (isolation mode). Recorded for the destination lane: the Celo
   `destinationGasMeasurement` (hard-max 1,383,897, status
   `local-hard-max-green-live-authority-pending`) was measured with the same cool()-based
   pattern and is likely warm-subsidized. That lane already fails closed —
   `destinationGasLimit` stays `0` until live Safe/Zodiac measurement — so no config change is
   made here, but **the live measurement must not reuse the `vm.cool` pattern**.
3. **The required PR gate was red and the boundary tests were codegen-mismatched in every
   lane.** Closed: lane exclusions + the chained production gate; `bun run test` green
   end-to-end.
4. **Selector-list drift could silently drop the production proof.** Closed: fail-closed
   `--list` verification in the runner + guardrail vitest pinning config ↔ scripts ↔ Solidity
   source. The drift class is real: during development the bare-name `$` anchor matched zero
   tests and the gate refused to run until it was fixed.
5. **`test:audit:coverage` red under forge 1.5.1 branch accounting.** Closed with eight
   Garden-account guard-branch tests (finding scope: toolchain accounting, not a source or
   behavior change). Residual: the lane's 900-second default timeout
   (`COVERAGE_TIMEOUT_SECONDS` in `scripts/contracts/run-coverage-audit.sh`) is no longer
   realistic — the full instrumented run now needs ~32 minutes on this host under ambient
   load, and passes only with the env override raised (3,600s used here). The default was
   deliberately left unchanged pending a separate owner decision.

## Validation evidence (2026-08-12, tested tree = `56263a6f17396d988620489bca30cee3ce48f5cd`)

Phase 5 contract gates:

- `bun run test` — green: typecheck; fast suite 2,033 passed / 0 failed (156 suites);
  `test:gas:release` 3/3 (accepted 2 = 240,108; first rejected 3 = 294,432 attempt / 308,653
  retry; hard-max 24 rejected); script tests 148 passed / 0 failed (14 files). 13.6s wall
  warm-cache.
- `bun run test:deep` — green: 2,033 passed / 0 failed under `profile.ci` (fuzz 10,000,
  invariants 256×500); execution 708.5s, 12:02 wall warm-cache.
- `bun run test:script` — green: 148/148.
- `bun run build:full` — green: 5:06 cold, incremental re-run green.
- `bun run check:sizes` — green; SettlementModule 24,495 bytes (81-byte EIP-170 margin),
  CreditRegistry 22,055, CommitmentPoolingModule 21,217, CeloSettlementExecutor 20,243 —
  unchanged from the freeze.
- `bun run check:storage-layout` — green: all layouts match baselines (54.7s). Executed before
  the test-only Garden additions; test files are not inputs to storage layouts.
- `bun run test:audit:full` — green end-to-end on the final tree (31:50 wall,
  `COVERAGE_TIMEOUT_SECONDS=3600`): realism tooling green; realism advisory 0 must-fix /
  0 should-fix / 0 nice-to-have; coverage PASS — core `src/**` line 87.20% (6,034/6,920),
  branch 67.07% (1,108/1,652); all critical contract gates PASS including
  `src/accounts/Garden.sol` at 96.43% line / 90.32% branch.
- `bun run test:fork:settlement-lane` — green: 8/8 (20.9s; pinned Arbitrum + Celo forks).
  Executed before the test-only Garden additions; the subsequent change set does not intersect
  `test/fork/**` or any compiled fork input.

Repo-level gates:

- `bun run format:check` (root, Biome) — green, exit 0 (includes the new TS files).
- `bun lint` (root) — `lint:rules` green (0 violations); oxlint green across all packages
  including `packages/contracts/script` (`--deny-warnings`); contracts `forge fmt --check`
  fails with exactly the 114 pre-existing drift files produced by the local forge 1.5.1
  rewrap, documented before this correction — every Solidity file touched in this range is
  fmt-clean. No formatter was run over the shared tree; landing that rewrap remains a
  coordinated one-shot commit outside this correction.
- solhint (contracts `src/**`) — green, exit 0 (no `src` change in range).
- `bun run test` (root, all packages) — green, exit 0 (5:56 wall): contracts 2,033 + 3 + 148;
  shared 3,417 passed / 1 skipped; client 658; admin 558; agent 245 passed / 1 skipped;
  indexer 206 tests, exit 0.
- `bun run build` (root: contracts, shared, indexer, client, admin) — green, exit 0.
- Guardrails: `check:solidity-test-names` — 8 added names follow the canonical format;
  `check:source-structure` — no changed non-test source in scope; workflow YAML parses.

Gas-profile distinction, stated plainly: the PR fast lane (optimizer-off) and the nightly deep
lane (optimizer-200) prove logic, not release gas. The only release gas evidence is
`test:gas:release` under `profile.production` with per-call transaction isolation, and it runs
in required PR CI on every push and pull request.

## Verdict

The correction range `50a2c29d3..56263a6f17` is approved as an internal committed-range
review.
The release configuration now records only production-codegen, isolation-measured gas
evidence; the required package gate is green end-to-end; the fast-compile PR lane and the
nightly deep lane are preserved and honest about what they prove.

**Re-freeze:** the release candidate is re-frozen at manifest hash
`0x6383e1ad076a51153323004ab03ea80a9cde8f43c660fbd2e22b020e579a2246`
(sourceCommit `49fc62cc0e665de929baca02c1228a43d681ad68`, release batch-size limit 2, CREATE2
identity set unchanged, indexer config hash unchanged).

No deployment or broadcast was authorized or performed by this correction: no network
transaction, no Safe transaction, no schema registration, no indexer activation, no live
infrastructure mutation of any kind.

The four release-lane blockers remain unchanged and were not addressed here:

1. protocol-Safe transfer
2. AssessmentResolver v3 Phase B
3. `destinationGasLimit` (final live Safe/Zodiac measurement — which must not reuse the
   `vm.cool` pattern, per finding 2)
4. value authority
