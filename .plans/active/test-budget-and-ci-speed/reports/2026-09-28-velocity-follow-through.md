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

## Slice 2 — critical scope matches D1

The old Shared override was both too broad and too narrow. Measured against the code at `d1bc5d86e`:
52 read-only hooks were critical only because of their directory (garden search, ENS and ENS-name
lookups, conviction reads, assessment and GreenWill reads, chain configuration). Meanwhile 60 of the
130 Shared files that sign, send, move funds or change auth, session or queue state were not
critical. Those included the transaction senders themselves (`modules/transactions/*`), cookie-jar
deposit and withdraw, hypercert listing and minting, commitment-pooling mutations, yield allocation,
profile-avatar signing, and the admin and client controllers that trigger them.

What changed:

- `criticalOverrides` entry `shared-signing-money-queue-auth` keeps ten prefixes critical as a whole
  (the three providers; the auth, job-queue and work modules; `workflows/`; `hooks/auth`,
  `hooks/work`, `hooks/vault`) and lists the 88 other Shared files whose code reaches a primitive.
  `sharedMutationPrimitives` in the policy names the primitives, read from the code: wagmi and
  `@wagmi/core` write, send, sign, connect/disconnect and switch-chain calls, `useWalletClient`
  and `getWalletClient`; account-abstraction and smart-account constructors; the passkey server
  client; EAS and the hypercert exchange client; the transaction-sender factory and classes;
  `useAuthActions`; and member calls such as `.sendContractCall()`, `.sendUserOperation()`,
  `.signMessageAsync()`, `.addJob()`, `.retryAndSend()` or a destructured `signOut`.
- `scripts/quality/shared-mutation-surface.mjs` finds those files. It follows named imports,
  aliases, re-export chains, `export *`, namespace imports, optional calls and dynamic imports, and
  does not propagate through hubs that only forward an action (`useAuth()` returns `signOut`
  without calling it, so its readers stay non-critical). Barrels that only re-export do not
  need the critical plan themselves. It is dependency-free because CI Gate runs the selector tests
  with Node alone. A scratch Babel analysis gave the same 130 files; comparing the two found two
  lexical bugs (optional calls and spread calls), both fixed before the policy was written.
- The selector reads the code of each changed Shared file that no path rule covers and escalates
  any that reaches a primitive (`selectedBy: critical-content`), so a new mutation hook is critical
  before anyone lists it. `resolveGitInputs` parses only those files' import closure: rendering a
  push plan took 2.5–2.8 s with or without a Shared path.
- The 52 read-only hooks are now sensitive (`riskRules[1]`). A push of one still needs direct proof
  (`needs-focus`), and conditional rules add `shared-typecheck` plus two new checks,
  `client-typecheck` and `admin-typecheck` (source typechecks, measured 1.0–1.3 s and 0.7 s warm).
  In the six former directories those two also run inside a critical plan, where the builds'
  `tsc -b` already covers them (about 2 s of redundancy).
- Guard: a selector test fails when any file the analyzer finds is not critical by policy, and
  when the exact list names a file that no longer reaches a primitive. It runs in CI Gate on every
  pull request.
- `AGENTS.md § Change Criticality` and `validation-pipeline.md` now state D1.

Routing gap found on the way: changing the selector, `ci-local.js`, the policy, `ci-gate.mjs` or
any other implementation behind `validation-system-test` selected only format and lint in a push.
All 19 such files now select their suite in QA, review and push. The diagnose fixture for
`ci-local.js` now expects that direct suite instead of an empty plan.

Plans after this slice (`--plan-json --intent push`):

| Changed path | Before | After |
|---|---|---|
| `hooks/work/useWorkApprovals.ts` | critical, 18 checks | critical, 18 checks (unchanged) |
| `hooks/garden/useFilteredGardens.ts` | critical, 17 checks | sensitive, `needs-focus`; with its focused test: 7 checks (format, lint, `shared-typecheck`, focused `shared-test`, `client-typecheck`, `admin-typecheck`, `source-structure`), estimate 124 s of the 180 s limit |
| `hooks/app/useLoadingWithMinDuration.ts` | routine, 3 checks, `needs-focus` | unchanged |

Proof:

| Step | Command | Result |
|---|---|---|
| RED | the four new selector tests run in a worktree at `d1bc5d86e` (the pre-change selector and policy), with the candidate primitives | 0/4: `useFilteredGardens` critical; `useCookieJarDeposit` routine; a new sending hook routine; 60 unclassified files |
| GREEN | `node scripts/dev/node-cli.js node --test scripts/quality/select-validation.test.mjs` | 85/85 |
| RED/GREEN | routing fixture over the 19 tooling files | failed on `qa: scripts/data/validation-policy.json`, then passed |
| Selected | `validation-system-test` | 335/336; the pre-existing parity failure only |
| Selected | `agent-guidance`, `docs-authority`, `docs-build` | all exit 0 |
| Docs | `node scripts/docs/generate.mjs --check` | current after regenerating three digests and one check count |

Limits: the analyzer relies on Biome formatting (top-level statements start at column 0). It
cannot see signing inside an external library unless that library's entry is listed, so a new
signing API needs a line in `sharedMutationPrimitives`. Forwarding an action without calling it
(`onClick: auth.signOut`) is not detected. Client, Admin and Agent source are outside this
analysis.

## Slice 3 — critical push in 5–7 minutes

Slice 0 showed that the cold critical push already took 263 s on a quiet machine. The costs were
the rerun (57 s, every check again) and an estimate that read 965 s. Changes:

- **Receipts.** A critical plan may reuse exact-fingerprint passing receipts in push intent only.
  The selector owns the rule (`receiptPolicy.criticalReuseAllowed`, true for push only), and
  `ci-local` reads it. Readiness, ship, merge and release never reuse. A new fixture shows that a
  changed head, working copy, policy version, toolchain or command each forces a fresh run.
- **One check at a time.** The package suites lose their concurrency groups, and the batching code
  goes: the batch branch in `executePlan`, `resolveVitestBatchEnvironment`, the concurrency option,
  the grouped estimate and nine batching tests. A new test drives a real checkpoint plan (Shared,
  Client, Admin, Agent suites back to back) and sees at most one check running. The test lease
  gives each suite the whole machine, and `turbo.json` now passes an explicit
  `VITEST_MAX_WORKERS` through to it.
- **Measured budgets.** Each check the critical plan runs, plus the two new typechecks, carries its
  slice 0 cold measurement rounded up to whole seconds. The critical estimate reads 267 s.

The smallest-change rule stopped there. Both cold runs below are under five minutes, so no build
or typecheck parallelism and no Agent skip were added.

Decision check: across 5,857 single-path push scenarios (every tracked file, plus deletion of every
package test), compared between `56ed7f6ac` and this change:

- **Critical plans:** 624 before and after.
- **Deleted tests:** lower suite budgets would have let 277 pushes that delete a Client or Admin
  test run the whole suite instead of stopping for focus. A deleted package test now counts as
  missing focused proof unless its whole suite costs no more than a focused run (30 s). That keeps
  those plans at `needs-focus`, now with the stop reason `focused-proof-required`.
- **The one intended change:** deleting `packages/agent/src/__tests__/config.test.ts` used to stop
  only because static budgets summed to 220 s. It now runs its 16 s plan: the Agent typecheck, the
  4 s Agent suite, and the Agent build.
- **Tests updated:** two tests whose assertions were derived from the old budgets now check the
  same intent against the measured ones (a QA plan that now fits its target, and a focused push
  fixture with a third surface so it still exceeds the routine limit).

Measured after (quiet-gated single runs, 02:10–02:34, receipt store cleared before each cold run):

| Check | Approvals cold 1 | Approvals cold 2 | Approvals warm |
|---|---:|---:|---:|
| `format` | 0.8 | 1.0 | reused |
| `lint` | 5.1 | 4.9 | reused |
| `shared-typecheck` | 1.6 | 2.3 | reused |
| `shared-test-typecheck` | 0.6 | 0.8 | reused |
| `shared-test` | 89.3 | 124.4 | reused |
| `shared-build` | 0.0 | 0.0 | reused |
| `client-test-typecheck` | 1.2 | 1.1 | reused |
| `client-test` | 58.8 | 48.4 | reused |
| `client-build` | 21.8 | 15.8 | reused |
| `admin-test-typecheck` | 1.0 | 0.8 | reused |
| `admin-test` | 63.5 | 49.9 | reused |
| `admin-build` | 17.3 | 13.8 | reused |
| `agent-typecheck` | 1.9 | 1.5 | reused |
| `agent-test-typecheck` | 1.6 | 1.3 | reused |
| `agent-test` | 3.7 | 2.9 | reused |
| `agent-build` | 1.6 | 1.2 | reused |
| `source-structure` | 1.1 | 0.9 | reused |
| `ontology` | 0.3 | 0.2 | reused |
| **Gate wall time** | **274 s** | **274 s** | **3 s** |

`useFilteredGardens.ts` is now sensitive; with its focused test the push plan ran seven checks:
format, lint, `shared-typecheck`, the focused `shared-test`, `client-typecheck`, `admin-typecheck`
and `source-structure`. It took 8 s and 6 s cold and 2 s warm (all seven reused), against 360 s
cold and 73 s warm at START.

The first attempt at these runs stopped at `format` in under a second: this slice's `turbo.json`
line needed wrapping. It was fixed with Biome and all six runs repeated.

Proof:

| Step | Command | Result |
|---|---|---|
| RED | `node scripts/dev/node-cli.js node --test --test-name-pattern "critical plans reuse exact passing receipts" scripts/dev/ci-local.test.mjs` | a critical push ran twice (`expected 1, actual 2`) |
| RED | `--test-name-pattern "package suites in a real plan"` over `ci-local.test.mjs` | two suites ran at once (`expected 1, actual 2`) |
| RED | `--test-name-pattern "Turbo passes lease"` over `package-commands.test.mjs` | `VITEST_MAX_WORKERS` missing from the pass-through list |
| GREEN | the three suites together | 148/148 |
| Selected | `validation-system-test` | 328/329; the pre-existing parity failure only |
| Selected | `docs-authority` (2 s), `docs-build` (4 s), `agent-guidance` | all exit 0 |
