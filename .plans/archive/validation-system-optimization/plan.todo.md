# Validation System Optimization Plan

> **Archived record:** implementation is closed. Operational handoffs, artifacts, and lane files were removed; preserved reports and any references below describe historical execution, not live work.

**Feature Slug**: `validation-system-optimization`
**Stage**: `active`
**Status**: `ACTIVE`
**Created**: `2026-08-15`
**Last Updated**: `2026-08-16`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | One versioned selector is the source of validation policy. | Removes YAML, local-runner, CI Gate, and agent-guidance drift. |
| 2 | CI controls push/merge/release intent and criticality can only add checks. | User wording and local caches cannot weaken merge safety. |
| 3 | Coverage thresholds stay blocking on PRs. | The audit confirmed they are load-bearing safety gates. |
| 4 | CI reporter reduction and dependency caching are measured optimizations. | Preserve signal and reject speculative savings. |
| 5 | Fail dependent work on the first deterministic failure. | Faster feedback and lower compute without hiding independent diagnostics. |
| 6 | Consumer checks follow observable artifacts and public boundaries. | Solidity source alone is not an input to mocked web builds/tests. |
| 7 | No test deletion or threshold reduction belongs in this feature. | Suite performance work is profiling and safe restructuring only. |
| 8 | The current branch `perf/ci-speed-optimization` is the implementation branch. | It is already isolated and follows the branch contract. |

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Machine-readable selector and fixtures | `state_api` | 1 | complete; certified at `fb835410` |
| CI Gate immediate failure | `contracts` | 2 | complete; certified at `fb835410` |
| Change-aware fail-fast local runner | `state_api` | 3 | complete; certified at `fb835410` |
| Toolchain and guidance parity | `ui` | 4 | complete; certified at `fb835410` |
| Shared setup and CI reporters | `contracts` | 5 | complete; dependency cache measured as a net loss and removed |
| Changed-impact workflow graph | `contracts` | 6 | complete; certified at `fb835410` |
| Indexer/Admin/Storybook profiling and safe improvements | `state_api` | 7 | partial: Contracts Realism optimized; deeper suite profiling deferred to measured follow-up |
| Acceptance and timing proof | `qa_pass_1`, `qa_pass_2` | 8 | complete; measured evidence below |

## TDD / Proof Order

- [x] Audit and exact failure evidence recorded before implementation.
- [x] Add failing selector, CI Gate, cancellation, blocked-environment, and freshness fixtures.
- [x] Implement the smallest policy/tooling changes that satisfy those fixtures.
- [x] Run targeted tests after each disjoint lane.
- [x] Run Repo Quick Gate at integration checkpoint if dependencies are available.
- [x] Run Ship Gate before claiming the branch ready.

## Implementation Steps

1. Add the policy catalog, selector CLI, standard-library fixtures, and durable package/script callers.
2. Make CI Gate consume selector output and fail immediately on any completed expected failure.
3. Make `ci-local` selector-driven, change-aware, fail-fast, cancellation-aware, and receipt-capable.
4. Align Bun/toolchain declarations and make agent instructions unambiguous and non-mutating in QA/review modes.
5. Add reusable CI setup/cache behavior and CI-only text coverage reporters, with cache-safety tests.
6. Move fast hygiene ahead of dependent expensive work and route consumers from artifact/dependency impact.
7. Profile Indexer, Admin, Contracts Realism, and Storybook; land only equivalence-proven safe improvements.
8. Run fixture, parity, failure-path, cache, timing, Repo Quick, and Ship acceptance checks.

## Validation

- [x] Standard-library selector and CI Gate tests pass without installed dependencies.
- [x] Workflow syntax and selector/workflow parity tests pass.
- [x] Targeted local-runner tests prove fail-fast, cancellation, blocked environment, and receipt invalidation.
- [x] Coverage threshold and local-report equivalence is fixture-protected for every affected package.
- [x] `node scripts/dev/ci-local.js --quick` passes with the exact activated toolchain.
- [x] The selector-driven Ship Gate passes, and every pushed head has a full green CI run; no receipt is outstanding.

## Boundary

No test deletion, coverage-threshold reduction, contract source/deployment mutation, workflow rerun,
GitHub setting change, deployment, broadcast, or Linear write.

Dependency changes are limited to validation-time package operations, which stay prohibited: no
installing or upgrading a package to make a check pass. The Envio 3.6.1 upgrade is a deliberate,
separately authorized exception recorded in the implementation notes, because it removes the
per-call cost that dominates the indexer suite rather than papering over a failing check.

## Implementation Notes

- Existing workflow and job names remain stable. A single-workflow graph migration was not attempted
  because it would change required check contexts without a verified branch-protection migration path.
- Shared workflow routing now follows actual shared-impact inputs, while raw Solidity source stays on
  Contracts, Ontology, and global guardrails until ABI/deployment artifacts change.
- Deeper Admin, Indexer, and Storybook suite profiling remains a measured follow-up; no speculative
  parallelism, test deletion, or threshold reduction was included in this implementation.
- The integrated local pass measured Indexer tests at 227.9 seconds and Admin tests at 95.3 seconds;
  these remain the largest local package costs and keep a broad all-surface checkpoint above the
  ordinary three-minute target.
- Certification run (2026-08-16, `fb835410`): the Bun dependency cache was measured and found to be
  a net loss (20.7s restore against 14.9s of install saved, on an already-over-quota repository
  cache) and was removed from `.github/actions/setup-js`. This is the one accepted optimization that
  the evidence rejected.
- `parallel groups` was listed as a passing AC-3 behavior while `scripts/dev/ci-local.js` ran a
  strictly sequential loop. Concurrency now exists: independent package suites declare a
  `concurrencyGroup` in the policy (shared with docs; client with admin and agent, mirroring the
  root `test` script), and only checks adjacent in plan order batch together, so printed order and
  the stop rule are unchanged.
- `--reuse-passing-receipts` is now named in `.claude/context/validation-pipeline.md`; it was
  previously implemented, fixture-tested, and reachable only as an undocumented raw flag.
- The scoped `format` command passed changed paths straight to Biome, which exits non-zero when it
  handles none of them. Markdown-, Solidity-, and YAML-only changes therefore failed at the first
  check and fail-fast stopped the plan. Fixed with `--no-errors-on-unmatched`; the previous fixture
  had asserted the broken command verbatim.
- Indexer suite profiling (requirement 7) was carried out and produced no shipped change.
  Measurements on an idle 10-core host, full suite unless noted:

  **Corrected measurements.** The first round of these numbers was invalid and is recorded here so
  the error is not repeated. A serial baseline of 606.6s was measured immediately after a parallel
  run that had saturated all ten cores; re-measuring the identical code on a quiet machine gives
  245.1s, so that figure was inflated about 2.5x. Every parallel-versus-serial comparison scored
  against it was therefore wrong, and in the flattering direction for parallelism.

  | Configuration | Wall | Passing | Timeouts |
  |---|---|---|---|
  | serial, pre-sweep | 245.1s | 244 | 0 |
  | serial, post-sweep | 194.4s | 244 | 0 |
  | `--parallel` 9 workers, post-sweep | 96.3s | 244 | 0 |

  The 47 timeouts seen earlier came from machine contention plus per-call cost that the batching
  sweep has since removed. On a quiet machine with the sweep applied, parallel mocha is twice as
  fast as serial and completely green. c8 coverage is byte-identical between serial and parallel
  (24.7 / 97.1 / 17.58 / 24.7 on a two-file probe).

  Measurement discipline this cost us: never compare a run against a baseline captured right after a
  saturating run, and re-measure a baseline on the machine state that the comparison run will see.

  Parallel mocha still must not ship. A second 9-worker run on the same code minutes later took
  180.3s with one timeout against the first run's 96.3s with none, so the result does not reproduce
  on this host. `--parallel --jobs 3`, which matches CI's four-core runner, was green at 151.1s but
  has a single sample. The slowest test under parallel is 15.3s against a 30000ms timeout, roughly
  2x headroom, which is consistent with timeouts appearing intermittently. Certifying parallelism
  needs a controlled environment; a dedicated CI runner is a better one than this laptop.

- CI-verified results at `9f23920e7`, which are the trustworthy numbers because they come from
  dedicated runners rather than a developer machine:

  | Measure | Before | After |
  |---|---|---|
  | Pull request wall clock, 13 workflows | 651s | **553s** |
  | Indexer `Run indexer tests with coverage` | 559s | **492s** |
  | Shared JS setup per job | 42s | **33s** |

  That is 98s off every pull request. The indexer gain comes from the batching sweep and the setup
  gain from removing the dependency cache.

- The indexer cost is per *call*, not per event. Measured against the `ActionRegistered` handler,
  one `processEvents` call costs the same whether it carries 1 event or 50:

  | Events in the call | Total |
  |---|---|
  | 1 | 707ms |
  | 5 | 707ms |
  | 20 | 707ms |
  | 50 | 705ms |

  `createTestIndexer()` is 0.1ms and module import is 696ms once per worker, so the 707ms is the
  call itself. Reading the generated harness explains it: `TestHelpers_MockDb.makeProcessEvents`
  runs `Generated.makeGeneratedConfig()`, builds a `ChainFetcher` with a 5000-item buffer, and
  deep-clones the mockDb on every call. Envio's `X.processEvent({event, mockDb})` and the repo's own
  `processEvents(db, events)` wrapper cost the same for a single event (690ms vs 687ms); the wrapper
  only wins by amortizing.

  Caveat that bounds the claim: 707ms is a *floor*. The four files measured directly run at roughly
  0.8s per call site, while the remaining files average about 4.3s, so heavier handlers add genuine
  per-event work that the `ActionRegistered` probe does not capture. What holds regardless of
  handler is that eliminating a call saves about 707ms.

- **Envio 3.6.1 removes the per-call cost almost entirely.** Probed by installing 3.6.1 in the
  worktree, measuring, and restoring 3.2.1:

  | | 3.2.1 | 3.6.1 |
  |---|---|---|
  | fixed cost per call | 707ms | **12ms** |
  | 5 separate `processEvent` calls | 3,489ms | **53ms** |
  | 1 call carrying 5 events | 700ms | **11ms** |

  Entities were verified materialized on both versions (5/5 on both the separate-call and batched
  paths), so this compares real handler work rather than a no-op. `bun run codegen` succeeds
  unchanged against the current `config.yaml`, so the config schema is compatible.

  The migration is real but mechanical. 154 of 244 tests fail on 3.6.1 with `simulate: item never
  reached a handler`: 3.6.1 requires a mock event's `srcAddress` to be an address actually indexed
  for that contract, where 3.2.1 accepted any address. The repo's tests use a per-file `mockEvent()`
  helper defaulting to `addr(99)`, so the fix is centralised in those helpers rather than spread
  across 154 test bodies. Routing a probe at the real ActionRegistry address
  (`0xA514eA2730b9eD401875693793BEfA9e2D51C0b4`) made it pass and produced the numbers above.

  Since essentially all of CI's 492s indexer step is per-call overhead, this upgrade is the largest
  remaining lever by a wide margin and would likely stop Indexer being the critical path at all.

  **Shipped.** The upgrade landed with the suite green at 244 passing, unchanged in count, and the
  local suite fell from 194s to 3s. `test/v3.ts` resolves indexed addresses from `config.yaml` and
  defaults `srcAddress` where every mock event is built, so the tests cannot drift from the indexed
  set; helpers omit `logIndex` so Envio auto-increments within a block. Two latent test bugs
  surfaced and were fixed rather than papered over: garden mint events claimed an arbitrary token
  address and so never registered the GardenAccount they were meant to, and the settlement executor
  lane ran under Arbitrum's chain id while `CeloSettlementExecutor` is only indexed on Celo. One
  behaviour genuinely changed — an event at an unindexed address is rejected rather than silently
  skipped — so the OctantVault case asserts the rejection.

- Two further levers, independent of the upgrade:
  1. Repo-side, no Envio change: merge calls. 64 adjacent call pairs already have no assertion or
     entity read between them and are directly mergeable, worth about 45s. Concentrated in
     `hatsModule` (10), `settlement` (10), `hypercerts` (9), `settlementReview` (9),
     `commitmentPoolReview` (8). The newer commitment-pooling tests already use the batched style
     (23 batched against 5 single), so the pattern to copy exists in-repo.
  2. Upstream: the 707ms is rebuilt state that cannot change between calls within a test. Memoizing
     the generated config and ChainFetcher would cut every test with no test edits at all. This is
     the larger prize and belongs as an Envio issue.
