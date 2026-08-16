# Validation System Optimization Evaluation Plan

## Release Gates

1. Correctness: all required checks are selected for every locked scenario and no critical override can be downgraded.
2. Performance: quick plans meet budgets by selection; broad/critical gates remain strict even when over budget.
3. Regression safety: coverage thresholds, contract wrappers, security, auth, mutation, deployment, and release gates remain blocking.
4. Evidence quality: measured timings are separated from projections and every accepted optimization has before/after proof.
5. Failure behavior: deterministic failure, environment block, stale receipt, and user cancellation are explicit and tested.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Intent/path/risk selection | Fixture matrix for docs, UI, package TS, contract, shared API, ship, blocked, cancel | `state_api` | working-copy fixtures pass |
| AC-2 | Aggregate failure | Completed failure wins over pending/missing workflows | `contracts` | working-copy fixtures pass |
| AC-3 | Local execution | Fail-fast, concurrent package suites, cancellation, receipts, no repeated unchanged checks | `state_api` | 73 fixtures pass; fail-fast confirmed on a live run; concurrency added after certification |
| AC-4 | CI safety | Workflow mapping, cache keys, reporters, required hard gates | `contracts` | workflow parity and YAML syntax pass |
| AC-5 | Guidance parity | Agent commands render the same selector plan and honor stop intent | `ui` | four guidance checks pass; durable Bun caller fixed |
| AC-6 | Integrated review | Current-SHA targeted and Repo Quick evidence | `qa_pass_1` | working-copy review and Repo Quick pass; clean-SHA receipt pending |
| AC-7 | Ship readiness | Full Ship Gate and final recurrence sweep | `qa_pass_2` | working-copy Ship Gate passed; clean-SHA and live-CI proof pending |

## Timing Targets

- Pre-commit feedback under 15 seconds.
- Isolated quick-change proof under 90 seconds.
- Warm ordinary pre-push proof under 3 minutes; critical or cold broad work may exceed this without skipping gates.
- First required PR failure signal under 5 minutes.

## Measured Results (2026-08-16, `fb835410`)

| Target | Measured | Verdict |
|---|---|---|
| Pre-commit under 15s | selector renders in 2.0–3.6s; `format` 2.3s | met |
| Isolated quick-change under 90s | docs-only `qa` selects 2 checks, client UI `qa` selects 4 | met by selection; per-check runtime not separately timed |
| Warm pre-push under 3 min | broad 66-path `checkpoint` ran 609s before stopping at a blocked check | **not met**, as the plan already predicted |
| First PR failure signal under 5 min | fast workflows report in 6–66s; the gate now propagates within one 20s poll | met |

Package-test cost dominates the local checkpoint: `shared-test` 185.4s, `admin-test` 265.4s,
`client-test` 125.3s, `agent-test` 6.2s. Cheap checks are already negligible (`format` 2.3s,
`lint` 13.3s, `shared-typecheck` 5.6s, `agent-typecheck` 2.2s).

Two open opportunities, both measured rather than assumed:

1. The runner executes checks in a strictly sequential loop, so it forfeits the grouping the root
   `test` script still uses (`shared`+`docs`, then `client`+`admin`+`agent`). An ideal grouped model
   puts the package-test portion at 450.8s instead of 582.3s. The host has 10 cores and 24 GB and
   `admin-test` alone consumed ~4.5 cores and 3.4 GB, so part of that 131.5s is real and part is
   contention. This was previously listed as a passing acceptance behavior and was not implemented.
2. Indexer and Admin remain the largest suites in both CI and local runs and were not restructured.

## Test Strategy

- Unit: Node standard-library tests for selection, mapping, freshness, stopping, and receipts.
- Integration: selector output drives `ci-local` and CI Gate with fixture GitHub responses.
- Workflow: parse every workflow and compare durable callers/mappings against policy.
- Performance: capture before/after job and command durations; no unmeasured performance claim.
- Manual: review security-sensitive workflow, package, and agent-guidance diffs before publication.
