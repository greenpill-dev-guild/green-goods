# Module Seams and Velocity Plan

**Linear Source**: `source:plans`
**Feature Slug**: `module-seams-and-velocity`
**Stage**: `active`
**Status**: `ACTIVE`
**Created**: `2026-08-23`
**Last Updated**: `2026-08-23`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Keep this as a version 2 hub that depends on `validation-system-optimization`. | The older hub owns the original velocity implementation and receipt debt; this hub owns the broader module-seam program. |
| 2 | Burn down all eight receipt waivers by 2026-09-03 and never extend their 2026-09-05 expiry. | Plan Hub validation is a repository-wide guard and terminal claims need fresh proof. |
| 3 | Fix agent-shell toolchain drift with `ci-local.js` re-exec, preferring the mise shim, then `$NODE`, sanitized PATH, and mise installs. | Non-interactive agent shells do not run activation hooks, while validation already chose re-entry as the durable boundary. |
| 4 | Make push, ship, and local merge path-scoped; keep readiness, release, empty strict change sets, CI merge, critical overrides, and forced workspace checkpoints full or mandatory. | Small changes should not select every package, but strict and critical safety contracts remain load-bearing. |
| 5 | Move shared, client, and admin coverage to nightly and `main` with real flat floors, then ratchet monthly. | Current nested thresholds are a no-op and coverage dominates three pull-request jobs. |
| 6 | Route eligible local package tests through Turbo and preserve real consumer inputs. | Test files and stories should not invalidate consumers, while shared test utilities, mocks, and setup remain public test inputs. |
| 7 | Use Vitest `test.projects` with `extends: true` for DOM-free tests. | Vitest 4.1.10 removed `environmentMatchGlobs`; projects preserve coverage parity. |
| 8 | Run indexer test-only lanes before helper source splits, keep `shared.ts` as the handler seam, and make Hasura policy a pure Node planner. | Most grades improve without runtime changes, and permission decisions need direct proof. |
| 9 | Create lane handoffs when their dependencies become dispatchable, and record the final path in `status.json` before dispatch. | Prompts must reflect the merged parent state; future lane entries remain complete in `execution_sub_lanes` without freezing stale instructions. |
| 10 | Hold W0-F for a human floor correction instead of implementing accepted statement thresholds that fail the clean baseline. | Measured full-suite statement coverage is Shared 61.12%, Client 63.36%, and Admin 51.52%; the accepted 63% Shared and 61% Admin floors are not presently attainable. |
| 11 | Treat W0-G1 as locally proven with a bounded empirical-proof limit, without claiming its pasted test-only consumer example. | W0-C deliberately keeps focused shared test-only changes scoped to Shared, D6 excludes test files from consumer inputs, and the Work-hook mutation needed for the other example is outside the lane allowlist. |
| 12 | Start W0-G2 and W0-H only after their prerequisite commits merge into `develop`. | The Wave 0 stack merged with live CI green, so both lanes gained the required merged-parent provenance. |
| 13 | Adopt Afo's corrected W0-F statement floors of 61 Shared, 63 Client, and 51 Admin, while keeping the other metrics at their measured integer floors. | The corrected values pass the clean baseline and preserve real enforcement; live Coverage Nightly proof remains a merge gate. |
| 14 | Merge the ready Wave 0 stack without waiting for the quiet-machine timing matrix or a pre-merge Coverage Nightly dispatch. | Afo explicitly accepted both proof limits on 2026-08-22 to unblock Wave 1. The timing result remains unclaimed, and the first default-branch Coverage Nightly run remains a required post-merge observation. |
| 15 | Close the two actionable Turbo input findings from merged PR #760 on a successor stacked lane before Wave 1. | Root test-runner helpers and consumer source scanned by Shared tests must affect Turbo hashes or later validation can reuse stale successes. |
| 16 | Accept the repository-owned Wave 0 snapshot as the execution gate while the two private Claude artifacts are inaccessible from this environment. | Fresh local receipts preserve every observed signal and proof limit without blocking the approved implementation program on an external presentation surface. |
| 17 | Execute the remaining program only in the shared checkout on `develop`, with no new branches, worktrees, pull requests, or subagents. | Afo replaced the original lane-publication protocol on 2026-08-23 so the program can finish without duplicating fixes across stacked delivery units. |
| 18 | Treat lane blocks as acceptance criteria inside wave batches, run one Repo Quick Gate per wave, and reserve the full Ship Gate for program exit. | Focused RED/GREEN proof remains required while repeated full-suite lane gates are removed. |
| 19 | Record one consolidated receipt and Plan Hub update per wave. | Sublanes may reference the same tested wave SHA when their implementation and validation inputs are unchanged. |

## Research / Plan Gate

- [x] Record baseline and live-reconciliation evidence in `spec.md`.
- [x] Identify the Commitment Pooling ports, optional dependency object, and injected-reader patterns.
- [x] Record Afo approval, Claude ownership, product decisions, and deferrals.
- [x] Define deferred contract, agent, and Card Endow activation work.
- [x] Define per-lane selector, direct proof, source-structure, Ship, review, CI, and receipt gates.

## Requirements Coverage

| Requirement | Waves | Status |
|---|---|---|
| A green-by-default scoped validation harness | Wave 0 | complete |
| Direct seams for high-risk mutations and pooling controllers | Wave 1 | in progress |
| Declared shared boundaries and smaller composition surfaces | Wave 2 | blocked on Wave 1 |
| Every remaining shared module below A- regraded | Wave 3 | blocked on dependencies |
| Every remaining client/admin module below A- regraded | Wave 4 | blocked on shared seams |
| Every remaining indexer module below A- regraded | Wave 5 | held behind Wave 0 program start |
| DOM-free project routing and enforceable direct-test architecture | Wave 6 | blocked on Wave 0 seam work |
| Module Health and Velocity targets with fresh receipts | Program exit | blocked on all committed waves |

## Execution Steps

1. [x] Scaffold and populate this hub from the accepted program.
2. [x] Validate the hub and Plan Hub fixtures.
3. [x] Run `linear-sync --json`, create or update one parent Product issue with `source:plans`, and record `parent_only` identifiers (`PRD-831`).
4. [x] Dispatch and land Wave 0 parallel set 1: W0-A, W0-B, W0-C, W0-E, W0-F.
5. [x] Dispatch and land W0-D after W0-B and W0-G1 after W0-C.
6. [x] Land W0-G2 and burn down receipt debt in W0-H, then archive Validation System Optimization.
7. [x] Close W0 Turbo input hardening feedback on a successor stacked lane.
8. [x] Record the Wave 0 Module Health and Velocity snapshots and verify every Wave 0 exit signal.
9. [ ] Complete the remaining Wave 1 shared seams in order A and C, then B1 and B2, as one integrated `develop` batch.
10. [ ] Complete the remaining Wave 1 pooling controller suites and typed view tests in the same batch.
11. [ ] Complete Wave 2 client controllers, Community split and design pass, Hasura planner, and pooling subpath on `develop`.
12. [ ] Complete Wave 3 shared ports, repositories, adapters, commands, transitions, hooks, providers, and shell contracts in dependency rounds.
13. [ ] Complete Wave 4 client and admin controller, view-model, state, and direct-test requirements.
14. [ ] Complete Wave 5 indexer event helpers, fixtures, delivery contracts, source split, automatic mined-log selection, and permission planner.
15. [ ] Complete Wave 6 Vitest projects, direct-tested-seam guard, and the coverage ratchet when due.
16. [ ] Re-run the complete Module Health and Velocity procedures, attach fresh receipts, and close only the non-deferred program rows.

## Wave Lifecycle

1. Reconcile the wave's lane dependencies and acceptance criteria against live `develop`.
2. Implement the related changes as one batch in the shared main checkout. Do not create or switch
   branches, create worktrees or pull requests, or spawn subagents.
3. Preserve each required RED or named mutant and run focused tests and coverage while editing.
4. Commit coherent checkpoints directly to `develop` without running the full repository suite after
   every checkpoint.
5. Render `bun run validation:plan` for the wave's actual changed paths, execute its targeted and
   conditional checks, then run one Repo Quick Gate at the wave boundary.
6. Record one consolidated wave receipt with the tested SHA, UTC time, commands, results, validated
   paths, and clean status. Update Plan Hub and repository-owned health and velocity evidence once.
7. Continue automatically unless a new product decision, conflicting foreign work on `develop`, an
   unclear destructive target, or an unresolvable blocker requires human direction.

## Validation

- [ ] `node scripts/harness/plan-hub.mjs validate`
- [ ] `node --test scripts/harness/plan-hub.test.mjs`
- [ ] During each wave: render and execute `bun run validation:plan -- --intent qa --changed <wave paths>`.
- [ ] During each wave: run the named RED/GREEN or mutant proof and per-file coverage targets.
- [ ] At each wave boundary: run `SOURCE_STRUCTURE_BASE_REF=origin/develop bun run check:source-structure` when selected and one Repo Quick Gate.
- [ ] Per wave: record one fresh consolidated receipt and update repository-owned Module Health and Velocity evidence.
- [ ] At program exit only: run `bun format && bun lint && bun run test && bun run build`, plus every conditional gate selected for the complete touched surface.

## Program Exit

- [ ] Every committed shared, client, admin, and indexer module is A- or A.
- [ ] Deferred rows are limited to Card Endow activation and contract-redeployment work.
- [ ] Admin suite is at or below 90 seconds, shared at or below 60 seconds, and client at or below 50 seconds on a quiet recorded machine.
- [ ] CI Gate p50 is at or below three minutes and static-check red runs are at or below 10%.
- [ ] Plan steps and external scorecards are marked done only with fresh receipts.
