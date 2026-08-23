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
9. [ ] Land Wave 1 shared seams in order A and C, then B1, then B2.
10. [ ] Land Wave 1 pooling controller contracts, direct suites, and typed view tests.
11. [ ] Land the Wave 2 client controller, Community split, design review, Hasura planner, and pooling subpath lanes.
12. [ ] Land Wave 3 shared ports, repositories, adapters, commands, transitions, hooks, providers, and shell contracts in dependency rounds.
13. [ ] Land Wave 4 client and admin controller, view-model, state, and direct-test lanes.
14. [ ] Land Wave 5 indexer event helpers, fixtures, delivery contracts, source split, automatic mined-log selection, and permission planner.
15. [ ] Land Wave 6 Vitest projects, direct-tested-seam guard, and first coverage ratchet when due.
16. [ ] Re-run the complete Module Health and Velocity procedures, attach fresh receipts, and close only the non-deferred program rows.

## Lane Lifecycle

1. Write `handoffs/<lane>.md` with an outcome, files to read first, exact path globs, explicit
   exclusions, gates, report shape, and stop condition.
2. Dispatch one isolated worktree and branch from current `develop` with
   `.claude/scripts/dispatch-codex-lane.sh` for Codex-owned work.
3. Read `codex-result.md`; refine and re-dispatch a partial or failed lane once, then report a real
   blocker.
4. Run a Claude review and the lane's Ship Gate. Apply the mutation-reliability lens and require
   Afo approval for critical surfaces.
5. Open one pull request to `develop`, reference the parent Linear issue, require CI green, merge
   with `--no-ff`, then remove the worktree and local branch.
6. Record RED/GREEN proof, tested SHA, UTC time, exact commands, result, validated paths, and empty
   path-scoped status before marking the execution sub-lane passed.

## Validation

- [ ] `node scripts/harness/plan-hub.mjs validate`
- [ ] `node --test scripts/harness/plan-hub.test.mjs`
- [ ] Per lane: render and execute `bun run validation:plan -- --intent qa --changed <lane paths>`.
- [ ] Per lane: run the named RED/GREEN or mutant proof and per-file coverage target.
- [ ] Per lane: `SOURCE_STRUCTURE_BASE_REF=origin/develop bun run check:source-structure`.
- [ ] Per lane before merge: `bun format && bun lint && bun run test && bun run build`, plus every conditional gate selected for touched paths.
- [ ] Per lane: Claude diff review, critical approval where applicable, CI green, and a fresh Validation Receipt.
- [ ] Per wave: update the Module Health and Velocity snapshots from fresh measurements.

## Program Exit

- [ ] Every committed shared, client, admin, and indexer module is A- or A.
- [ ] Deferred rows are limited to Card Endow activation and contract-redeployment work.
- [ ] Admin suite is at or below 90 seconds, shared at or below 60 seconds, and client at or below 50 seconds on a quiet recorded machine.
- [ ] CI Gate p50 is at or below three minutes and static-check red runs are at or below 10%.
- [ ] Plan steps and external scorecards are marked done only with fresh receipts.
