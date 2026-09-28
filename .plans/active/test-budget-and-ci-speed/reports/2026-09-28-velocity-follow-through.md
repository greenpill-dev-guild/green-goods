# Velocity follow-through — 2026-09-28

Source: local commits on `develop`, starting at `START=d7cf681ec5cd2413bf1fbd6b2ee7f9d08d3e22cc`
(equal to `origin/develop` after `git fetch origin`; clean tree). Nothing in this pass is pushed. A
separate closeout pass pushes after Astra's review. Times are America/Los_Angeles unless marked UTC.

This report is built across this pass's local commits: each slice commit adds its own section. It
is new relative to `origin/develop`, so the immutable-report check reads it as an added file at
every committed state.

## Decisions (Afo, 2026-09-28)

| ID | Decision |
|---|---|
| D1 | Critical means signing, money, queue and auth. Read-only hooks become sensitive. Target the critical push at 5–7 minutes. |
| D2 | Measure happy-dom and adopt it for the Shared DOM project only if the A/B wins. Approves this one dev dependency. |
| D3 | Close the overdue September 22 two-point ratchet: the 11 measured critical-path floors replace it; global floors stay. |
| D4 | Work on `develop` and commit each slice locally. No push, PR, merge, deploy or Linear write in this pass. |
| D5 | The DetailsGate table refactor is approved. |

## Method

- Machine: 10-core Apple silicon, 24 GB, about 12.8 GB of 14 GB swap in use throughout.
- Before each timed run: `uptime`, `sysctl vm.swapusage` and other `vitest`/`forge`/`turbo`/`tsc`
  processes are recorded next to the log. A run starts only when the 1-minute load is under about
  30 (three times the core count).
- Speed claims need A B B A pairs; single runs are labelled as such. A run whose load rose far above
  the gate's own footprint is labelled contended.
- Gate runs use `PATH="$PWD/node_modules/.bin:$PATH" node scripts/dev/node-cli.js
  scripts/dev/ci-local.js --intent push --changed <path>`, without pushing. Cold adds
  `TURBO_FORCE=true`, so Turbo re-runs every package suite; TypeScript incremental state is left as
  it was. Warm is the next run, with `--reuse-passing-receipts` as the pre-push hook passes it.
- Other sessions: two idle Claude sessions are rooted in this checkout ("Test suite performance
  audit" and "Plan hub audit"; both `isRunning: false`). Before each commit this pass checks
  `git log origin/develop..develop` for foreign commits and `git status` for foreign edits.

## Slice 0 — preflight and baseline

Toolchain: `node scripts/dev/ci-local.js --quick --plan-json --changed
packages/client/src/views/Home/Garden/index.tsx` reports `ready` (Node 22.22.1 after re-exec from the
shell's 24.20.0, Bun 1.4.2, Foundry 1.7.1; no environment blockers).

Plans at START (`--plan-json`):

| Changed path | Risk | Checks | `estimatedWallSeconds` | Status |
|---|---|---:|---:|---|
| `packages/shared/src/hooks/work/useWorkApprovals.ts` | critical | 18 | 965 (sum of budgets) | ready, uncapped |
| `packages/shared/src/hooks/garden/useFilteredGardens.ts` | critical | 17 | 945 (sum of budgets) | ready, uncapped |
| `packages/shared/src/hooks/app/useLoadingWithMinDuration.ts` | routine | 3 | 45 | `needs-focus` |

The critical plans run their package suites one at a time: plan order interleaves each suite with
its typecheck and build, so the `package-tests-surface` group never forms a batch here.

Measured end to end (four single runs, 2026-09-28 00:47–01:00):

| Check | Approvals cold | Approvals warm | Filtered cold | Filtered warm |
|---|---:|---:|---:|---:|
| `format` | 1.1 | 1.6 | 1.1 | 1.8 |
| `lint` | 4.9 | 7.4 | 6.4 | 8.4 |
| `shared-typecheck` | 1.7 | 2.8 | 2.4 | 3.2 |
| `shared-test-typecheck` | 0.6 | 1.1 | 0.8 | 1.1 |
| `shared-test` | 84.0 | 0.3 | 131.9 | 0.4 |
| `shared-build` | 0.0 | 0.0 | 0.0 | 0.0 |
| `client-test-typecheck` | 0.9 | 1.0 | 1.1 | 1.3 |
| `client-test` | 45.4 | 0.3 | 76.4 | 0.3 |
| `client-build` | 20.7 | 16.8 | 22.9 | 22.3 |
| `admin-test-typecheck` | 1.3 | 1.0 | 1.1 | 1.4 |
| `admin-test` | 72.8 | 0.3 | 81.7 | 0.4 |
| `admin-build` | 14.8 | 14.1 | 20.8 | 19.8 |
| `agent-typecheck` | 2.3 | 2.2 | 2.4 | 2.3 |
| `agent-test-typecheck` | 1.6 | 1.7 | 1.8 | 1.8 |
| `agent-test` | 3.8 | 0.3 | 4.0 | 0.4 |
| `agent-build` | 1.6 | 1.5 | 1.7 | 2.0 |
| `source-structure` | 1.2 | 1.0 | 1.3 | 1.2 |
| `ontology` | 0.3 | 0.2 | — | — |
| **Gate wall time** | **263 s** | **57 s** | **360 s** | **73 s** |

Seconds per check as `ci-local` printed them. Suites: Shared 547 files passed, 2 skipped (6,056
tests); Client 144 files (1,481 tests); Admin 132 files (1,093 tests); Agent 27 + 1 files (317 + 16
tests). Every run exited 0.

Observations:

- The 965-second estimate is the sum of static budgets, not a measurement. On a quiet machine the
  approvals gate took 263 s cold. The filtered run took 360 s: its 1-minute load rose to 45 while
  it ran (load at start 8.1), so it is labelled contended and is not a comparable sample.
- Cold time is the three package suites (about 200 s of 263). Warm time is the two frontend builds
  (31–42 s), which re-run in full every time; Turbo replays each unchanged suite in under half a
  second. The critical plan stores no receipt, so a rerun after a pass repeats every check.
- Both fixtures select the same checks except `ontology` (`useWorkApprovals.ts` is an ontology
  source). The read-only search hook pays the whole critical plan.
