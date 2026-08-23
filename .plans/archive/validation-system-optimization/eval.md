# Validation System Optimization Evaluation Plan

> **Archived record:** implementation is closed. Operational handoffs, artifacts, and lane files were removed; preserved reports and any references below describe historical execution, not live work.

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
| AC-3 | Local execution | Fail-fast, concurrent package suites, cancellation, receipts, no repeated unchanged checks | `state_api` | 77 fixtures pass, including the compatibility-filter status regression; fail-fast confirmed on a live run |
| AC-4 | CI safety | Workflow mapping, cache keys, reporters, required hard gates | `contracts` | workflow parity and YAML syntax pass |
| AC-5 | Guidance parity | Agent commands render the same selector plan and honor stop intent | `ui` | four guidance checks pass; durable Bun caller fixed |
| AC-6 | Integrated review | Current-SHA targeted and Repo Quick evidence | `qa_pass_1` | certified at `fb835410`; every later PR head re-verified by a full green CI run |
| AC-7 | Ship readiness | Full Ship Gate and final recurrence sweep | `qa_pass_2` | live CI green on every pushed head; no receipt remains outstanding |

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

Both opportunities recorded here were subsequently closed, and the numbers above are superseded:

1. Sequential execution: **closed.** Independent package suites now declare a `concurrencyGroup` and
   adjacent members run together.
2. Indexer suite cost: **closed.** The batching sweep and the Envio 3.6.1 upgrade took the CI indexer
   test step from 559s to 9s and the local suite from 194s to about 3s, so Indexer is no longer the
   critical path. The `admin-test` figure above predates that work.

Final CI-measured outcome, which supersedes the local figures in this section because it comes from
dedicated runners rather than a developer machine: pull-request wall clock 651s to 307s, indexer test
step 559s to 9s, shared JS setup per job 42s to 33s.

## Test Strategy

- Unit: Node standard-library tests for selection, mapping, freshness, stopping, and receipts.
- Integration: selector output drives `ci-local` and CI Gate with fixture GitHub responses.
- Workflow: parse every workflow and compare durable callers/mappings against policy.
- Performance: capture before/after job and command durations; no unmeasured performance claim.
- Manual: review security-sensitive workflow, package, and agent-guidance diffs before publication.
