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

## Slice 1 — machine-wide test lease

Reuse check: the closest implementation is [`scripts/dev/surface-leases.mjs`](../../../../scripts/dev/surface-leases.mjs)
(per-checkout port claims for dev servers). It has no counted slots, no blocking wait, no timeout
and no machine-wide scope, so the lease is a new dev-tooling module,
[`scripts/dev/test-lease.mjs`](../../../../scripts/dev/test-lease.mjs), that reuses its
`isProcessAlive`. The package test path owns it: `scripts/dev/package-commands.mjs` takes the lease
for every package-wide `test` run, so `bun run test` and the local gate's Turbo-routed suites both
pass through it.

Behaviour:

- A package-wide run claims `slot-<n>.json` under `$(git rev-parse --git-common-dir)/green-goods-test-lease/`,
  which every worktree shares. One slot by default; `GREEN_GOODS_TEST_LEASE_SLOTS` overrides it.
  The claim is published with `link()`, so a slot appears with its whole record (token, pid, cwd,
  package, start time) or not at all.
- A waiter prints a status line naming the holder at once and every 30 s, and gives up after
  `GREEN_GOODS_TEST_LEASE_TIMEOUT_SECONDS` (900 by default) with exit 75 and a message naming the
  holder and both overrides. The suite never starts after a timeout.
- A slot whose holder pid is gone is recovered. Only a waiter holding a short recovery lock may
  delete a slot, and it re-reads the slot first, so it cannot delete a claim made after its check.
- The slot is released in `finally`, on SIGINT (130) and SIGTERM (143) while the suite runs or
  while it waits, and from an `exit` handler.
- Real CI skips it. The local gate exports `CI=true`, so `ci-local` now marks its checks with
  `GREEN_GOODS_LOCAL_GATE=1`. Focused paths, `--suite`, the live RPC pair, watch and UI modes skip it.
- When `VITEST_MAX_WORKERS` is unset and `--maxWorkers` was not passed, the holder sets it from its
  share: `resolveVitestMaxWorkers({ share: slots })`. Vitest lets the variable override the flag,
  so it is never set over an explicit flag.
- An unwritable directory (a sandbox) warns once and runs with half the machine.

Finding: Turbo runs tasks in strict environment mode (`turbo run test --dry=json` reports
`envMode: strict`, `passThroughEnv: null`), so `ci-local`'s batch `VITEST_MAX_WORKERS` never reached a
Turbo-routed suite, and a lease override would not either. `turbo.json` now passes
`GREEN_GOODS_TEST_LEASE_*` and `GREEN_GOODS_LOCAL_GATE` through without adding them to the cache key
(the same dry run lists both under `passthrough`). `VITEST_MAX_WORKERS` stays out of the list until
slice 3 removes the batch split; passing it now would shrink batched suites that the lease already
runs one at a time.

Selector gap fixed: a change to `package-commands.mjs`, its test, `test-lease.mjs` or `turbo.json`
selected only format and lint, so nothing ran their tests. They now select `validation-system-test`
in QA, review and push (policy `conditionalRules[1]`). The policy edit and the `package-commands.mjs`
edit restale two generated pages; `node scripts/docs/generate.mjs` rewrote only their digests.

Proof:

| Step | Command | Result |
|---|---|---|
| RED | `node scripts/dev/node-cli.js node --test scripts/dev/package-commands.test.mjs` | `ERR_MODULE_NOT_FOUND: scripts/dev/test-lease.mjs` |
| RED | same runner, `--test-name-pattern "local gate checks mark\|Turbo passes lease"` over `ci-local.test.mjs` and `package-commands.test.mjs` | 0/2: marker missing (`'true '`), pass-through missing |
| RED | `--test-name-pattern "hook and doctor edits"` over `select-validation.test.mjs` | failed on `review: scripts/dev/package-commands.test.mjs` |
| GREEN | `node scripts/dev/node-cli.js node --test scripts/dev/ci-local.test.mjs scripts/dev/package-commands.test.mjs` | 70/70 (15 new lease cases) |
| Selected | `validation-system-test` (the policy command) | 331/332; the one failure is pre-existing, see below |
| Docs | `node scripts/docs/generate.mjs --check` | 20 projections current after regeneration |

`validation-system-test` fails one case on unmodified `develop`:
`workflow-performance-parity.test.mjs` reports "`packages/admin/src/views/Garden/Pool/Seed/SeedStepHowMuch.tsx`
must not restore a broad Shared barrel". `967499ff4` (September 27, in START) added
`import { hasActionEnded } from "@green-goods/shared/utils"`. It reproduces in a clean worktree at
`fbccab4ed` with none of this pass's files. `classify-supply-chain-changes.mjs` sets `parity=true`
for this slice, so CI will run that test when this pass is pushed. Fixing it needs a declared Shared
leaf export (a manifest change), so it is outside this pass; a separate task is queued for Afo.

Two-worktree proof: two disposable detached worktrees at `fbccab4ed` with this slice's files copied
in and `node_modules` symlinked from the main checkout; each runs `bun run test` in
`packages/shared` (full default scope, 547 files, 6,056 tests). Every run below passed; no test and
no lease timed out.

| Run | Mode | Result |
|---|---|---|
| 1 | single (quiet) | 86 s |
| 1 | pair, one slot | first 129 s; second waited 129 s, total 285 s (antivirus scanner at 100% CPU mid-run: contended) |
| 2 | single | 130 s |
| 2 | pair, one slot | first 220 s; second waited 221 s, total 403 s (started at load 31, rose to 60: contended) |
| 3 | single, pair, single bracket | 103 s; first 175 s, second waited 176 s and ran 161 s, total 337 s; 120 s |
| 4 | pair, two slots (4 workers each, both at once) | both 265 s; single afterwards 136 s |
| 5 | pair, two slots at full width (9 workers each: the pre-lease behaviour) | both 273 s; single afterwards 120 s |

The second run waited every time, with a status line every 30 s naming the holder's pid, package
and worktree, and started within a second of the release. The timing bound (both done within twice
one quiet run) was not met: in the bracketed attempt the two serialized runs took 175 s and 161 s
although they never overlapped, against 103 s and 120 s for the single runs around them. The
machine has about 10 GB in the memory compressor and a scanner that wakes during test runs; these
samples cannot separate those causes from sustained-load slowdown. In single samples, running both
at once finished the pair sooner (265 s split, 273 s competing, against 337 s serialized), while the
lease returned the first result at 175 s instead of 265–273 s. Outcome 3's behaviour holds; its
timing bound stays open. The default stays at one slot as decided; `GREEN_GOODS_TEST_LEASE_SLOTS=2`
is the measured alternative if throughput matters more than the first result.
