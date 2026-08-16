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
| AC-3 | Local execution | Fail-fast, parallel groups, cancellation, receipts, no repeated unchanged checks | `state_api` | working-copy fixtures pass |
| AC-4 | CI safety | Workflow mapping, cache keys, reporters, required hard gates | `contracts` | workflow parity and YAML syntax pass |
| AC-5 | Guidance parity | Agent commands render the same selector plan and honor stop intent | `ui` | four guidance checks pass; durable Bun caller fixed |
| AC-6 | Integrated review | Current-SHA targeted and Repo Quick evidence | `qa_pass_1` | working-copy review and Repo Quick pass; clean-SHA receipt pending |
| AC-7 | Ship readiness | Full Ship Gate and final recurrence sweep | `qa_pass_2` | working-copy Ship Gate passed; clean-SHA and live-CI proof pending |

## Timing Targets

- Pre-commit feedback under 15 seconds.
- Isolated quick-change proof under 90 seconds.
- Warm ordinary pre-push proof under 3 minutes; critical or cold broad work may exceed this without skipping gates.
- First required PR failure signal under 5 minutes.

## Test Strategy

- Unit: Node standard-library tests for selection, mapping, freshness, stopping, and receipts.
- Integration: selector output drives `ci-local` and CI Gate with fixture GitHub responses.
- Workflow: parse every workflow and compare durable callers/mappings against policy.
- Performance: capture before/after job and command durations; no unmeasured performance claim.
- Manual: review security-sensitive workflow, package, and agent-guidance diffs before publication.
