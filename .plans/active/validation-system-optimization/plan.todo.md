# Validation System Optimization Plan

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
- [x] The selector-driven Ship Gate passes on the working copy; clean-SHA and live-CI receipts remain pending.

## Boundary

No test deletion, coverage-threshold reduction, contract source/deployment mutation, package dependency
installation or upgrade, workflow rerun, GitHub setting change, deployment, broadcast, or Linear write.

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

  | Configuration | Wall | Passing | Failing |
  |---|---|---|---|
  | serial (baseline) | 606.6s | 244 | 0 |
  | `--parallel`, default 9 workers | 442.6s | 197 | 47 |
  | `--parallel --jobs 4` | 401.3s | 242 | 2 |

  Every one of those 49 failures is `Timeout of 30000ms exceeded`; not one is an assertion failure,
  so the suite is logically parallel-safe and c8 coverage is byte-identical between serial and
  parallel runs (24.7 / 97.1 / 17.58 / 24.7 on a two-file probe). What blocks parallelism is
  headroom: the slowest test already takes 20.3s serially on an idle machine against a 30000ms
  timeout. Bounding workers helps a lot and is not enough, so `--parallel` must not ship until
  per-test cost falls.

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

- Two levers follow, and they are independent:
  1. Repo-side, no Envio change: merge calls. 64 adjacent call pairs already have no assertion or
     entity read between them and are directly mergeable, worth about 45s. Concentrated in
     `hatsModule` (10), `settlement` (10), `hypercerts` (9), `settlementReview` (9),
     `commitmentPoolReview` (8). The newer commitment-pooling tests already use the batched style
     (23 batched against 5 single), so the pattern to copy exists in-repo.
  2. Upstream: the 707ms is rebuilt state that cannot change between calls within a test. Memoizing
     the generated config and ChainFetcher would cut every test with no test edits at all. This is
     the larger prize and belongs as an Envio issue.
