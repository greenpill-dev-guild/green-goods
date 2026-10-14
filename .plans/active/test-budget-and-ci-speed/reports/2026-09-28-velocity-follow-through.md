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

## Slice 4 — route the checks the push gate missed

New push-intent rules, read from the tools themselves:

- **`test-quality`:** `scripts/quality/check-test-quality.sh` scans every tracked test or spec file
  (including `.t.sol`), checks new local query setups in tests, and fingerprints each certified
  seam's module, composition roots, consumers, proof files and owning manifest. The rule matches
  test, helper and mock paths, the 12 non-test seam files, and the check's own scripts. Measured
  1–2 s.
- **`docs-generated`:** the 90 sources `projectionSourcePaths()` reports, as 69 exact paths plus
  `.github/workflows/`, `docs/`, `packages/contracts/deployments/` and the generator in
  `scripts/docs/`. Measured under 1 s.
- **`docs-authority`:** `docs/scripts/docs-audit.mjs` reads `docs/`, the root and package guides,
  `.claude/context` and skills, workflows and the command ledgers. Its retired-caller scan opens
  every tracked script, config and guide outside Plan Hubs. The rule matches those extensions
  outside `.plans/`, so most pushes now run it. Measured 2 s.
- **Drift tests:** two selector tests fail when `projectionSourcePaths()` and the rule drift apart
  (in either direction), or when a seam-fingerprinted file stops selecting `test-quality`.
- **Scope:** the rules apply to push intent only, so checkpoint, ship, merge, readiness and release
  plans are unchanged. Across 5,857 single-path push scenarios no risk or status changed; the
  plans only gained these checks.

Replay of the Actions API reds (failed runs created 2026-09-19..28; step names "Check test quality",
"Check generated documentation", "Audit documentation authority"). The API returned 38 commits,
two more than the brief's 36; runs after it was written account for the difference. That is 39
commit/check pairs: 10 `test-quality`, 19 `docs-generated`, 10 `docs-authority`. Before this slice
the push plan for each commit's own paths selected none of them.

| Now | Pairs | Evidence |
|---|---:|---|
| Selected by the commit's own paths | 19 | replay of `git diff <parent> <sha>` |
| Selected by the branch diff the push gate evaluates | 18 | 16 against the PR's fork point; two direct pushes against their `develop` merge base |
| Base drift, not the commit's own change | 2 | `baa29c0135` (#856) and `459ca0b904` (direct develop push) |

The causes, from the failing step logs:

- **`test-quality`:** new local query clients in tests (4) and stale seam fingerprints (6), four
  of them after a `packages/shared/package.json` edit that the fingerprint covers.
- **`docs-authority`:** all 10 failed on one line: `scripts/harness/agent-hooks.test.mjs: Retired
  command caller deploy:mainnet at line 115`. `f9bbeb9dd` (September 26) added that line, and its
  paths now select `docs-authority`.
- **The two base-drift pairs:** both were already stale at their base (`574918cb5`, `35baa35d6`),
  with exactly the pages CI named. First-parent search places the introducer at `35baa35d6`
  (September 19, "refuse commits made under an address reserved for tests"). It edited
  `ci-gate.yml` and the validation policy without regenerating, and now selects `docs-generated`.

Proof:

| Step | Command | Result |
|---|---|---|
| RED | `node scripts/dev/node-cli.js node --test --test-name-pattern "push gate routes test quality\|every docs generator input\|every file a certified seam" scripts/quality/select-validation.test.mjs` | 0/3 |
| GREEN | `select-validation.test.mjs`, `ci-local.test.mjs`, `package-commands.test.mjs` | 151/151; five exact-list push tests now include the routed checks |
| Selected | `validation-system-test` | 331/332; the pre-existing parity failure only |
| Selected | `test-quality`, `docs-authority`, `docs-build`, `agent-guidance`, `docs-generated --check` | all exit 0 |

## Slice 5 — DetailsGate at one worker (D5)

The table refactor D5 approved had already landed: `ee5c8a147` (September 27, "keep each work
template within its own test timeout") turned the 23-template loop into `it.each`. It kept the same
assertions, added a count case, and left the 10 s timeout alone. This slice verified it and found
why the earlier one- and two-worker diagnosis misled.

Finding: `--maxWorkers N` never took effect. The Shared, Client and Admin Vitest configs compute
`maxWorkers`, and with projects that value wins over the CLI flag. On the Client views directory
(59 files), `--maxWorkers 1` and `--maxWorkers 4` both ran at full width (15 s wall, about 130 s of
worker time). `VITEST_MAX_WORKERS=1` ran at one worker (56 s wall, about 55 s of worker time), because
Vitest applies the variable after the config. So the hub's September 27 "times out at one and two
workers" runs were full-width runs on a loaded machine. `package-commands.mjs` now passes an
explicit `--maxWorkers` to Vitest as `VITEST_MAX_WORKERS`, which also keeps the lease from
overriding it. No other caller passed the flag.

Proof:

| Step | Command | Result |
|---|---|---|
| RED | `node scripts/dev/node-cli.js node --test --test-name-pattern "explicit worker count\|keeps an explicit worker choice" scripts/dev/package-commands.test.mjs` | 0/2 (flag forwarded, no variable) |
| GREEN | `node scripts/dev/node-cli.js node --test scripts/dev/package-commands.test.mjs` | 26/26 |
| Before the fix | `bun run --cwd packages/client test --maxWorkers 1` | exit 0 in 27 s wall with about 220 s of worker time, so not one worker |
| Outcome 8 | `bun run --cwd packages/client test --maxWorkers 1` (quiet, 02:50) | **exit 0**: 144 files, 1,481 tests, 104 s wall, about 100 s of worker time; each `DetailsGate` template 5–65 ms |
| Selected | `validation-system-test` | 332/333; the pre-existing parity failure only |
| Docs | `node scripts/docs/generate.mjs` | `commands.mdx` digest restaled by the `package-commands.mjs` edit; regenerated |

## Slice 6 — Shared Node tests share one module graph

The Shared config now has three projects:

- **`node-shared-graph`** (145 files): Node files that mock and stub nothing, `isolate: false`, with
  mocks, stubbed globals and stubbed env restored after each test.
- **`node`** (67 files): isolated Node files.
- **`dom`** (337 files): unchanged apart from 44 `.test.ts` files that declare a DOM environment in
  their docblock. Those used to run in the Node project with the full DOM setup and now run here.

`scripts/lib/vitest-shared-graph.mjs` decides membership from each file's code when the config
loads (15 ms). A file stays isolated in any of these cases:

- it calls `vi.mock`, `vi.doMock`, `vi.hoisted`, `vi.stubGlobal`, `vi.stubEnv`, `vi.resetModules`,
  `vi.isolateModules`, `vi.unmock` or `vi.doUnmock`;
- it uses IndexedDB;
- it assigns a global directly or through `Object.defineProperty`;
- it carries a `// @shared-graph isolate: <reason>` marker.

The Node projects load a lean setup (`setupTests.node.ts`): the Node-safe core without Testing
Library, jest-dom or React DOM. `setupTests.base.ts` keeps its behaviour for Client and Admin, with
the same hook order.

Running the shared graph found four leaks, and each is now a rule:

- **Module-registry resets and IndexedDB.** `job-queue-blocked-open` and `draft-migration` broke
  later files.
- **A dependency that patches a built-in.** `job-queue.commitment-policy` "canonicalizes bigint
  payloads" received `{"commitmentId":"9"}` after certain other files. The first bisect blamed
  `chain-guard.test.ts`, but it was confounded: removing a file from a file-order shuffle
  re-permutes the rest. A logging trap in the shared-graph setup found the cause.
  `@hypercerts-org/sdk` 2.9.1 sets `BigInt.prototype.toJSON` when it loads
  (`dist/esm/index.mjs:4954`), and three Node files import it through `lib/hypercerts/*`. They now
  carry the marker.
- **A global assigned directly.** Once in six Node-only B runs, Vitest reported three unhandled
  `TypeError: markResourceTiming is not a function` errors in `gql-client.test.ts`, although every
  test passed. `ipfs.module.test.ts` captures `globalThis.fetch` while Vitest collects it, and
  restores that value after each test. When the file runs first in its worker, the captured value
  is the native `fetch`. A later request then reaches the network, and its response trips Node's
  fetch timing hook on the setup's mocked `performance` object in whichever file is running. With
  `ipfs.module` first in a one-worker shared graph, this reproduced 3/3. With the file isolated, it
  did not recur (0/3 on the same two files, and 0/6 B runs on the 212 Node files). Four other files
  mutate globals the same way (`session`, `browser`, `pwa`, `authMachine`) and are isolated too.

The shared-graph setup (`setupTests.shared-graph.ts`) fails the file that causes a leak:

- fake timers left installed;
- a changed built-in. It compares the own properties of fourteen built-in prototypes and `JSON`
  with a snapshot taken before the file's imports, restores them, and names what changed.

With the markers removed, the guard failed `metadata.test.ts` ("BigInt.prototype.toJSON added")
and every other shared-graph test passed.

`scripts/quality/check-shared-graph-tests.mjs` is Check 7 in `test-quality`, which CI runs in the
Client, Admin and guidance jobs. It asks `vitest list --filesOnly --json` which project each
Shared test file runs in. It fails when a file runs in two projects, or when a `node-shared-graph`
file needs its own graph under the helper's rule.

Routing:

- **Locally:** `validation-system-test` covers the helper and the check (their tests are in the
  parity suite), `shared-test` covers the helper in qa and push, and push-intent `test-quality`
  covers the Shared config, the helper and the check. Before this slice, the helper alone selected
  format and lint only.
- **In CI:** `shared.yml` (outer paths and internal detector) and the policy's `workflowRules.Shared`
  now include the helper, so a helper-only PR runs the Shared suite and CI Gate expects it. The
  Supply Chain classifier sends the Shared config, the helper and the check to the parity job, which
  runs their tests.

Measurement. A = the `HEAD` config in a scratch worktree, B = this slice, in A B B A pairs. Before
each run the machine had no other Vitest process and a 1-minute load under 30. It was under memory
pressure throughout: about 11.7 GB of 13.3 GB swap in use, and a 1-minute load of 12–15 during runs.

| Scope | Pair | A (s) | B (s) | Wall | Summed worker-seconds |
|---|---|---|---|---|---|
| The 212 Node files, four workers | 1 | 21, 25 | 10, 12 | −52% | −42% |
| | 2 | 28, 31 | 13, 14 | −54% | −43% |
| | 3 | 29, 30 | 15, 14 | −51% | −43% |
| Full Shared suite, default workers | 1 | 99, 110 | 97, 96 | −8% | −5% |
| | 2 | 108, 104 | 93, 91 | −13% | −11% |
| | 3 | 105, 104 | 94, 95 | −10% | −7% |

On the Node files, summed setup fell from 18–27 s to 1.3–1.9 s and summed import by about 36%.
Summed transform rose from 5–8 s to 9–12 s. The full suite gains less because the DOM project's
jsdom environments (about 280 s summed) and imports dominate it. An earlier three-pair run with the
first partition (150 shared-graph files) gave −4%, −17% and −9% full-suite wall.

CI's two shards split the same files on both configs (275 and 274) with identical results. Shard 2
is slower than shard 1 on both (A 63 s against 37 s, B 60 s against 42 s, one run each), so the
imbalance predates this slice and it does not widen it.

Proof:

| Step | Command | Result |
|---|---|---|
| RED | parity tests `consumer Vitest projects…` and `Shared Node tests share…`, run against the `HEAD` config in a scratch worktree | 0/2 (two projects; no `node-shared-graph`) |
| RED | `select-validation.test.mjs` routing tests for the helper, the check and CI Gate's expected workflows | failed before the policy edits |
| RED | parity tests `Supply Chain classifier routes…` and `Shared outer routing…` | 0/2 before the workflow and classifier edits |
| GREEN | `node --test scripts/quality/select-validation.test.mjs` | 89/89 |
| Selected | `validation-system-test` | 334/335; the pre-existing `SeedStepHowMuch` barrel failure only |
| Selected | `format`, `lint`, `shared-typecheck`, `shared-test-typecheck`, `shared-test` (the three changed files), `client-test` (1,481), `admin-test` (1,093), `agent-typecheck`, `agent-test`, `docs-authority`, `docs-build` | all pass |
| Push checks | `test-quality` (Check 7 included, 1.8 s), `docs-generated` | pass; three projection digests regenerated |
| Guard | shared graph, one worker, file shuffle seed 1, markers removed | `metadata.test.ts` fails with the guard message; the other 2,172 tests pass |
| Check 7 fault | `ipfs.module.test.ts` added to the shared-graph include | exit 1: "runs in node and node-shared-graph" and "needs its own"; exit 0 after restoring |
| Fetch leak | `ipfs.module` first in a one-worker shared graph, then `gql-client` | 3/3 runs report `markResourceTiming` unhandled errors; 0/3 with the final config |
| Identical results | full Shared suite JSON against the pre-change baseline | 6,056 passed, 17 skipped; no name added, removed or changed |
| File-order shuffles | shared graph at one worker, seeds 1–3 | 1,898 passed each |
| File-order shuffles | full suite, seeds 11–13 (first partition) | identical to the baseline each time |
| Full shuffles | `--sequence.shuffle` (tests within files too), seeds 21–23, on both configs | the same failures on both configs for every seed, so they predate this slice (open items) |

Open items from this slice:

- **Tests that depend on their order within a file.** Five files fail under `--sequence.shuffle`
  identically on the `HEAD` config:
  - `service-worker-registration`, seeds 21 and 22;
  - `useActionOperations`, seed 21;
  - `useGardenDomains` and `useDrafts`, seed 22;
  - `stores/connectivity`, seed 23.

  `upload-preparation` also depends on the order of its tests: its module-level `snapshot`, `active`
  and `openHolds` state is never reset. The brief's "three runs with `--sequence.shuffle` and no
  failures" therefore holds only for file order.
- **`@hypercerts-org/sdk` 2.9.1 patches `BigInt.prototype.toJSON` when it loads.** Any app session
  that loads it changes how `JSON.stringify` treats bigints from then on. That includes
  `canonicalJobPayload`'s `__bigint` tagging, so `{ commitmentId: 9n }` and `{ commitmentId: "9" }`
  would canonicalize alike. This is a product question for Afo; nothing here changes it.
- **Two CI routing gaps predate this slice:**
  - `shared.yml` runs for `scripts/dev/package-commands.mjs`, but `workflowRules.Shared` omits it,
    so CI Gate does not expect Shared for that path;
  - the parity job still does not run for Client or Admin Vitest config changes, although the
    parity suite locks their shapes; this slice routed only the Shared config.

## Slice 7 — happy-dom for the Shared DOM project (D2)

Adopted: happy-dom met all three criteria, so the Shared DOM project now runs in happy-dom. Five
files stay pinned to jsdom.

- **Version:** happy-dom 20.14.5, published 2026-09-12, 16 days before this slice, so it clears the
  `minimumReleaseAge = 259200` gate. It is pinned exactly in the root `devDependencies`, like jsdom.
- **Method:** measured in a scratch worktree at `b27b85a21` with its own install. A was jsdom as
  checked in. B was one patch: happy-dom as the root and DOM-project environment, with every
  `@vitest-environment jsdom` docblock in Shared (264 files) switched to happy-dom.
- **First B run:** 8 tests failed in 5 files. Each failure is a real difference between the two DOMs,
  so those files are pinned to jsdom with a comment naming the behaviour:

| File | Why it stays on jsdom |
|---|---|
| `components/NavigationBar.test.tsx` | Asserts authored inline values (`0.75rem`, `calc(100vw - 2rem)`, `column-reverse`); happy-dom's computed style converts `rem` to px and drops `calc()` and some flex values |
| `components/Toast/toast.service.test.tsx` | Asserts an inline `rgb(var(--tone-action, …))` colour; happy-dom resolves the custom property to empty |
| `modules/app/service-worker-registration.test.ts` | Expects `expect.any(MessagePort)`; happy-dom's `MessageChannel` returns ports that are not the global `MessagePort` |
| `hooks/useWorkApproval.test.ts` | Spies on `Storage.prototype.setItem`; happy-dom's `localStorage` does not call the spied method |
| `utils/work/offlineDownloads.test.ts` | Asserts `size` 13, which is the length of `"[object Blob]"`: jsdom's `File` does not recognise Node's `Blob` from `response.blob()` and stringifies it. happy-dom keeps the 14 real bytes |

The last row is a test defect, not a happy-dom gap. The test passes under jsdom although the
"downloaded original" holds the text `[object Blob]`, so it does not prove the bytes survive. It
goes to Afo; nothing here changes the assertion.

Criteria:

| Criterion | Evidence | Result |
|---|---|---|
| Passes with no assertion changes apart from a short, reasoned jsdom list | Full suite with the five pins, three runs | 6,056 passed, 17 skipped each time; identical names and results to the jsdom baseline |
| DOM-project wall time at least 10% lower in each of three A B B A pairs | `--project dom` in the scratch worktree (A 85/90, 86/87, 86/85 s; B 71/68, 62/63, 63/63 s) | −21%, −28%, −26% |
| No new flaky tests in three full runs | The three full runs above, plus six DOM-only B runs | no failures |

Summed environment time for the DOM project fell from 302–321 s to 114–133 s. Summed import time
changed by −4% to +9% across the pairs.

The dependency change is the root `package.json` line and `bun.lock`. The lockfile:

- adds happy-dom and its dependencies (12 packages);
- re-hoists `ws`, `whatwg-mimetype` and `entities`, so their root entries change and nested entries
  appear. Resolving every dependency edge in both lockfiles shows that all 11,194 existing edges
  keep their version. The 8 new edges belong to happy-dom and `buffer-image-size`.

`git diff -- package.json packages/*/package.json` shows only the happy-dom line.

Four certified seams (`shared-job-queue-construction`, `shared-auth-session`,
`shared-work-provider-command`, `shared-commitment-pooling-public`) had proof files among the
switched docblocks. Their 13 proof files pass under the new config (250 passed, 4 skipped), and
their fingerprints are re-certified in `module-seam-registry.json`.

Client and Admin stay on jsdom. D2 approves happy-dom for the Shared DOM project, and Shared's 21–28%
is the evidence for a separate Client and Admin A/B if Afo wants one.

Proof:

| Step | Command | Result |
|---|---|---|
| Release-age gate | `npm view happy-dom time` | 20.14.5 published 2026-09-12, 16 days old |
| Dependency diff | `git diff -- bun.lock package.json` in the checkout and the scratch worktree | identical; only the happy-dom manifest line |
| Lock resolution | every dependency edge in `HEAD`'s lockfile against the new one | 11,194 unchanged, 8 new edges from happy-dom |
| Seam proofs | the 13 proof files of the four re-certified seams | 250 passed, 4 skipped; `check-direct-tested-seams` reports no drift |
| Selected | `format`, `lint`, `shared-typecheck`, `shared-test-typecheck`, `shared-test`, `client-test`, `admin-test`, `agent-typecheck`, `agent-test`, `indexer-test`, `contracts-build`, `contracts-test` (90.9 s), `docs-authority`, `docs-build`, `agent-guidance` | all pass |
| Extra | `supply-chain`, `test-quality`, `docs-generated` | pass after the fingerprint re-certification (before it, `supply-chain` failed on the four stale fingerprints) |

## Slice 8 — small new test files

`testing.md` § Test budget carries the three rules:

- open a new test file only for a new subject or environment, and give it four cases or a reason;
- say so when a change adds more test lines than source lines;
- run the focused file while working.

`scripts/quality/check-small-test-files.mjs` is Check 8 in `test-quality`. It follows
`check-test-query-setup.mjs`: it takes the test files added since the base, plus working-tree
additions and untracked test files. It fails one with fewer than four cases unless the file carries
a `TEST-QUALITY: allow-small-test-file - <reason>` comment.

- **Counting:** one case per `it`/`test` call, with modifiers. An `.each` or `.for` table counts its
  inline rows, or four when its rows are not written inline. Methods such as `pattern.test(`,
  comments and strings do not count.
- **Limit:** cases generated by a helper, such as `describeConformance`, are invisible to the count,
  so a new file built that way needs the comment.

Routing:

- push-intent `test-quality` and `validation-system-test` select the check;
- the Supply Chain classifier sends it to the parity job, which holds its tests.

Fold batch. The pre-checks were clean:

- no fold file is in `module-seam-registry.json` or the direct-tested baseline;
- source-structure caps skip test files;
- staged modules cover Client source only.

Each fold keeps its `describe` names and setup and stays in the same project and environment. Ten
small files folded; the Shared suite went from 549 files to 540.

| Small file (cases) | Into |
|---|---|
| `modules/graphql-client.test.ts` (1) | `modules/gql-client.test.ts` |
| `config/pimlico-rpc-fallback.test.ts` (1) | `config/pimlico.test.ts` (was `pimlico-policy.test.ts`) |
| `cycle-metadata.test.ts` (2) | `commitment-pool-documents.test.ts` |
| `stores/createGardenStore.test.ts` (3) | `stores/useCreateGardenStore.test.ts` |
| `utils/contracts.greenwill.test.ts` (2) and `utils/gardenTokenAbiCompatibility.test.ts` (1) | `utils/contracts.test.ts` |
| `stores/useAdminStore.test.ts` (3) | `stores/stores.test.ts`, as a second `stores/useAdminStore` block with its own setup |
| `hooks/hypercerts/marketplace-query-keys.test.ts` (3) | `hooks/query-keys.test.ts` |
| `hooks/work/useWorkLocation.test.ts` (1) | `hooks/useWorkForm.test.ts`, with its `afterEach` inside the moved block |
| `workflows/auth-passkey-adapters.test.ts` (3) | absorbed `workflows/authPasskeyAdapters.test.ts`; the target mocks only `createPublicClientForChain`, which the moved tests never call |

Reviewed and left separate:

- **Different mocks, environment or lane:**
  - `useGardenUrlSync.search-options`: mocks `react-router-dom`, which the main file uses for real;
  - `offlineDownloads` and `graphql-client-offline`: DOM and three module mocks, against Node
    targets that mock nothing;
  - `passkey-confirmation`: pinned to Node, while `passkey-sender` runs in a DOM;
  - `job-queue.claim-hold`: mocks the work-confirmation and claim modules; `job-queue.seam`
    mocks nothing;
  - `AppProvider.analytics`: mocks a different PostHog module from `AppProvider.install`;
  - `commitment-pooling-read-boundary`: mocks the GraphQL client;
  - `react-query` against `react-query-offline`: Node against DOM;
  - `aave.live`: the live-network lane.
- **Since slice 7:** `modules/service-worker`, because its target is pinned to jsdom while it runs in
  happy-dom.
- **Only file for its subject:** `job-queue.event-bus` and the one-hook files, such as
  `useSendingWorkIds` and the commitment hook and controller files.

Remaining candidates. 102 Shared test files still hold fewer than four cases. Each needs the same
review; most are the only file for their subject:

- __tests__: commitment-allocation-abi-parity.test.ts (3), commitment-completion-refresh.test.tsx (2), commitment-document-store.test.ts (3), commitment-pool-charter-hook.test.tsx (3), commitment-pooling-read-boundary.test.ts (2), commitment-pooling-read-repository.test.ts (2), credit-read-boundary.test.ts (2), proof-draft-repository.test.ts (2), protocol-funding-operations-controller.test.tsx (3), settlement-aa-profile.test.ts (3), settlement-operations-controller.test.tsx (3), translation-port.test.ts (3), work-decision-readback.test.ts (3), work-link-choices.test.ts (2)
- __tests__/components: AudioRecorder.test.tsx (2), Chip.test.tsx (2), ENSProgressTimeline.test.tsx (3), EmptyState.test.tsx (3), ErrorBoundary.test.tsx (1), NavigationBarFab.test.tsx (1), SheetHeader.test.tsx (3), SheetHeading.test.tsx (2), StatusBadge.test.tsx (3)
- __tests__/components/Canvas: GardenChipUrlSync.test.tsx (1), springConfig.test.ts (2)
- __tests__/components/Cards: WorkCard.test.tsx (1)
- __tests__/components/Toast: toast.queue.test.ts (3)
- __tests__/config: appkit.test.ts (3), react-query-offline.test.ts (2)
- __tests__/hooks/action: useAction.test.tsx (2)
- __tests__/hooks/admin-ui: useAccountProfileController.test.tsx (2), useActionEditorController.test.tsx (2), useCreateActionController.test.tsx (3), useResolvedWorkDetail.test.tsx (3)
- __tests__/hooks/app: useOnlineStatus.test.tsx (2), useScrollToTop.test.ts (2)
- __tests__/hooks/assessment: useCreateAssessmentForm.test.ts (3)
- __tests__/hooks/blockchain: useTransactionSender.test.tsx (3), useTxActPhase.test.tsx (1)
- __tests__/hooks/client-ui: useWorkMediaLifecycle.test.ts (2)
- __tests__/hooks/garden: useAutoJoinRootGarden.test.ts (3), useGardenAccountSigner.test.ts (3), useGardenMaxGardeners.test.ts (1), useSetGardenDomains.test.ts (2)
- __tests__/hooks/navigation: useGardenUrlSync.search-options.test.ts (2)
- __tests__/hooks/profile: useProfileAvatarDraftPreview.test.tsx (1)
- __tests__/hooks/public: usePublicCommitmentImpact.test.ts (3), usePublicImpactEvidence.test.ts (1), usePublicStats.test.ts (3)
- __tests__/hooks/roles: useGardenMembership.test.tsx (3)
- __tests__/hooks/ui: useDocumentScrollLock.test.tsx (3), useSheetPresence.test.tsx (3)
- __tests__/hooks/utils: useExitPresence.test.ts (2)
- __tests__/hooks/vault: useFunderLeaderboard.test.ts (1)
- __tests__/hooks/work: gardenWorkListQuery.test.ts (1), useGardenReviewQueue.test.ts (2), useSendingWorkIds.test.ts (2), useWorkApprovalActions.test.tsx (2), useWorkAudioRecording.test.ts (1), useWorkDraftRetirement.test.ts (2)
- __tests__/hooks/yield: useProtocolYieldSummary.test.ts (1)
- __tests__/i18n: arrival-messages-format.test.ts (3), pool-articles.test.ts (2)
- __tests__/modules: action-operation-command.test.ts (2), create-garden-command.test.ts (3), graphql-client-offline.test.ts (2), graphql.test.ts (1), job-queue-blocked-open.test.ts (1), job-queue.analytics.test.ts (3), job-queue.claim-hold.test.ts (2), job-queue.event-bus.test.ts (1), job-queue.telemetry-privacy.test.ts (3), join-garden-command.test.ts (2), media-resource-manager.test.ts (2), offline-content-media.test.ts (2), profile-avatar-transport.test.ts (2), react-query.test.ts (1), service-worker.test.ts (2), update-garden-command.test.ts (1), work-claims.test.ts (3), work-submission-flow.test.ts (3)
- __tests__/modules/app: error-categories.test.ts (2), sentry-redaction.test.ts (2), share-target.test.ts (3)
- __tests__/modules/data: eas-work-list.test.ts (1), gardens-reader.test.ts (1), hypercerts-fetch.test.ts (1), karma.test.ts (2)
- __tests__/providers: AppProvider.analytics.test.tsx (2)
- __tests__/storybook: admin-story-isolation.test.ts (1)
- __tests__/test-utils: controller-fixtures.test.ts (2)
- __tests__/utils: action-templates.test.ts (1), contracts.test.ts (3), encoders.test.ts (3)
- __tests__/utils/blockchain: aave.live.test.ts (1), octant-abi.test.ts (1)
- __tests__/utils/styles: theme.test.ts (3)
- __tests__/utils/work: image-compression.test.ts (3), offlineDownloads.test.ts (2)
- modules/transactions/__tests__: act-phase.test.ts (1), passkey-confirmation.test.ts (3), sender-conformance.test.ts (0)

Proof:

| Step | Command | Result |
|---|---|---|
| RED | parity test `test quality Check 5 enforces…` with the Check 8 assertions | failed until Check 8 was wired |
| RED | `select-validation.test.mjs` routing tests for the new check | 0/2 before the policy edits |
| GREEN | `workflow-performance-parity.test.mjs` | 37/38; the pre-existing `SeedStepHowMuch` failure only |
| GREEN | `select-validation.test.mjs` | 89/89 |
| Fault | an untracked two-case test file, then the same file with a reason comment | exit 1 naming the file and "2 cases", then exit 0 |
| Folds | full Shared suite JSON before and after, compared by full test name and status | 549 → 540 files; 6,056 passed, 17 skipped; 0 differences |
| Renames | `git diff --cached -M --name-status` | `pimlico.test.ts` and `contracts.test.ts` count as renames (59% and 53%), so Check 8 does not treat them as new |
| Selected | `format`, `lint`, `validation-system-test` (336/337, same failure), `shared-test-typecheck`, `shared-test` | pass |
| Push checks | `test-quality` (2.1 s), `docs-generated`, `docs-authority` | pass. A fixture string containing `test.skip(` first tripped Check 2's ungoverned-skip scan and became `test.todo(` |

## Slice 9 — contracts gas gate reuses an exact-input production tree on develop PRs

Release tooling, so critical: every touched line was read, and the selector's full critical
override ran.

Before, `run-release-gas-gate.ts` ran `forge build --force` for the production profile on every
`bun run test`, including every pull request's unit-test job. The brief measured that rebuild at
about 84 s of the job's 243 s median.

Now:

- **The mode.** `script/utils/release-gas-build-mode.ts` owns the decision:
  - `GG_RELEASE_GAS_GATE_BUILD` unset, empty or `fresh` rebuilds from scratch;
  - `cached` skips only the rebuild; the fixture listing and the three `--isolate` boundary
    proofs still run;
  - any other value fails the gate, so a typo cannot skip the rebuild.
- **`contracts.yml` unit job:**
  - The general Foundry cache holds only the test profile, so it can no longer restore a production
    tree from another commit.
  - A new step caches `.generated/foundry/{cache,out}/production` with no restore-keys. Its exact
    key is the Foundry version plus a hash of `foundry.toml`, `foundry.lock`, `remappings.txt`,
    `src/**`, `test/**`, `script/**/*.sol`, `lib/**`, the release config and `bun.lock`. Only
    this gate's from-scratch build fills it.
  - The test step passes `cached` only for a pull request into develop with an exact hit. Pushes,
    release pull requests into main, and every miss pass `fresh`.
- **Release gate.** The local release gate is unchanged: `contracts-test` runs `bun run test` with
  no mode, which rebuilds from scratch.
- **Nightly.** It did not run the gate before. It now adds
  `bun run test --suite release-gas` from scratch after the deep fuzz suite.

Local wall time of the unit job's command (`bun run test` in `packages/contracts`), A B B A on a quiet
machine (1-minute load 3–8):

| Run | Mode | Wall |
|---|---|---|
| 1 | fresh | 71 s |
| 2 | cached | 18 s |
| 3 | cached | 18 s |
| 4 | fresh | 72 s |

The fresh rebuild costs about 54 s locally. In CI, a develop pull request whose contract inputs are
already cached should skip the rebuild. The first run for a new input set misses, rebuilds and saves
the entry. This is unverified until CI runs it; the closeout pass should check the second run of a
contracts PR for `reusing the production tree`.

Proof:

| Step | Command | Result |
|---|---|---|
| RED | `vitest run --dir script script/utils/release-gas-gate.test.ts` | the new mode module is missing |
| RED | parity test `contract PRs reuse only an exact-input production tree…` | fails: no production cache step |
| GREEN | `release-gas-gate.test.ts` | 6/6: the mode defaults to fresh, `cached` is explicit, a typo throws, and the runner keeps `--force` and consults the mode |
| GREEN | `workflow-performance-parity.test.mjs` | 38/39; the pre-existing `SeedStepHowMuch` failure only |
| Critical override | `abi-artifacts`, `contracts-build`, `contracts-test` (71 s, fresh), `contracts-verify-fast` | all pass |
| Selected | `format`, `lint`, `validation-system-test` (337/338, same failure), `static-lint`, `foundry-version` | pass |
| Push checks | `test-quality`, `docs-generated` (`gh-actions.mdx` digest regenerated), `docs-authority` | pass |

## Slice 10 — Shared tests import test-utils leaves

Measured first, in the scratch worktree. 55 Shared test files imported the barrel statically;
the brief's 45 was an earlier count. A was the barrel as checked in. B was a codemod:

- the barrel's own definitions move to a leaf module, which the barrel re-exports;
- 54 files point at the leaves. The 55th is `test-utils/controller-fixtures.test.ts`, which tests
  the barrel itself.

Three A B B A pairs over those 55 files, four workers, identical results every run (710 passed,
4 skipped):

| Pair | Duration, A | Duration, B | Change | Summed import | Summed transform |
|---|---|---|---|---|---|
| 1 | 16.2, 17.2 s | 14.0, 14.3 s | −16% | −27% | −41% |
| 2 | 16.8, 18.3 s | 14.3, 14.5 s | −18% | −29% | −43% |
| 3 | 21.4, 21.7 s | 17.7, 17.6 s | −18% | −29% | −43% |

That gain is real, so the migration went ahead. It is modest for the whole suite: about 12
worker-seconds of a full Shared run.

- **`test-utils/render-helpers.tsx`** holds what `index.ts` used to define itself: the Query and Intl
  wrappers, `renderHookWithProviders`, `renderWithQuery` and `renderWithProviders`, the navigator
  and async helpers, and `mock()`. It keeps all imports at the top.
- **`index.ts`** re-exports every leaf and Testing Library, so `@green-goods/shared/testing` works
  unchanged for Admin and Client.
- **Shared test files:** 54 import leaf modules. Six more reached the barrel through
  `await import("@green-goods/shared/testing")` inside `vi.mock` factories, which the first scan
  missed; they now import `test-utils/transaction-fakes`.
- **Check 9 in `test-quality`** (`scripts/quality/check-test-utils-barrel.mjs`) fails a Shared test
  that imports the barrel by path or alias, statically or dynamically. The barrel's own tests in
  `test-utils/` are exempt. It is routed like Check 8.
- **Seam fingerprints:** two certified seams had proof files among the rewritten imports:
  - `shared-commitment-pooling-public`: `commitment-pooling-hooks.test.tsx`;
  - `shared-work-provider-command`: `WorkProvider.test.tsx` and `sender-conformance.test.ts`.

  Their proof files pass, and their fingerprints are re-certified.

Proof:

| Step | Command | Result |
|---|---|---|
| RED | parity tests for Check 9 and the classifier; selector routing tests | failed before the check and the policy edits |
| GREEN | `select-validation.test.mjs`; `workflow-performance-parity.test.mjs` | 89/89; 39/40 (the pre-existing `SeedStepHowMuch` failure) |
| Full suite | Shared JSON after the fold batch against after the migration, by full test name and status | 540 files; 6,056 passed, 17 skipped; 0 differences |
| Consumers | `client-test`, `admin-test` | 1,481 and 1,093 passed; both import `@green-goods/shared/testing` |
| Seams | the two seams' six proof files, then `check-direct-tested-seams` | 153 passed, 4 skipped; no drift |
| Selected | `format`, `lint`, `validation-system-test`, `shared-test-typecheck`, `shared-test`, `docs-authority`, `docs-build`, `agent-guidance` | pass. `format` first failed on four unformatted transaction tests; formatting them changed `sender-conformance`'s fingerprint again, and it was re-certified |
| Push checks | `test-quality` (Checks 1–9), `docs-generated` | pass |

Open item: the selector treats `packages/shared/src/__tests__/**` as Shared-only. So a change to
`test-utils`, which Client and Admin import as `@green-goods/shared/testing`, selects neither
suite. They ran here by hand.

## Slice 11 — behaviour proof for six near-zero files

Each file got the smallest behaviour test at its own layer. Pure logic uses tables; setup uses
the existing helpers (`render-helpers` in Shared, `renderWithProviders` in Admin); nothing asserts a
class name. Each new file holds at least four cases, so Check 8 passes without a reason comment.

| File | Decision it owns | New test | Coverage (lines), before → after, from the new test alone |
|---|---|---|---|
| `shared/hooks/client-ui/auth/useLoginScreenController.ts` | A display name under three characters never starts a passkey ceremony; a recovery that signs in to a different account says which one; the post-login redirect (`?redirectTo`, home, never back after sign-out) | `__tests__/hooks/client-ui/useLoginScreenController.test.tsx` (7 cases) | 0% → 60% |
| `shared/components/FileUploadField.tsx` | Only images over the size limit are compressed and the rest pass as chosen; a failed compression reports briefly and sends nothing; staged names render without markup or control characters | `__tests__/components/FileUploadField.test.tsx` (4) | 1.4% → 85% |
| `shared/components/Toast/presets/wallet.ts` | Every stage replaces the one `wallet-submission` toast; only signing waits indefinitely; the retry hint appears only on a recoverable failure; upload progress replaces the default text | `__tests__/components/Toast/wallet-presets.test.ts` (8) | 17% → 65%; the rest is the older non-i18n object |
| `admin/components/Vault/VaultEventHistory.tsx` | One page of events at a time until all show; transactions link to the chain's explorer; empty and no-amount states | `__tests__/components/VaultEventHistory.test.tsx` (4) | 0% → 100% |
| `admin/views/Garden/SignalPool.tsx` | Which item IDs may be registered; registration hidden while the registered list cannot be read; each item's share of conviction; removal only after confirmation | `__tests__/views/GardenSignalPool.test.tsx` (7) | 0% → 80% |
| `admin/views/Cookies/.../CampaignCookieJarCreateWorkspace.tsx` | How the flow ends: a submitted create takes the jar address by hand, only a valid address completes it, "Create Another" starts a clean first step, and the flow returns to the list | colocated `CampaignCookieJarCreateWorkspace.test.tsx` (4) | 0% → 77% |

Fault injection used a scratch config under `.cache/fault/` (git-ignored). It imports the package's
`vitest.config.ts` by absolute path, sets `root`, and adds an `enforce: "pre"` plugin that swaps one
string in one file and throws if the string is missing. Each fault ran through
`vitest related <file> --run` after an unchanged baseline:

| File | Injected fault | Result |
|---|---|---|
| `wallet.ts` | the i18n signing stage loses `persistent: true` | the `confirming` case fails (1 of 841 related tests) |
| `FileUploadField.tsx` | the keep filter keeps oversized images too | "compresses only the images over the size limit…" fails (1 of 13) |
| `useLoginScreenController.ts` | the recovery attempt is not recorded | "tells the user when recovery signed in to a different account…" fails (1 of 7) |
| `VaultEventHistory.tsx` | "Load More" adds one row instead of a page | the paging case fails (1 of 54) |
| `SignalPool.tsx` | the register form ignores read failures | "hides registration while the registered items cannot be read" fails (1 of 45) |
| `CampaignCookieJarCreateWorkspace.tsx` | the address typed by hand is not applied | the submitted-transaction case fails (1 of 57) |

Selected checks: `format`, `lint`, `shared-test-typecheck`, `shared-test` (3 files, 19 tests),
`admin-test-typecheck`, `admin-test` (3 files, 15 tests) and `test-quality` (Check 8: six new
files, none too small) all pass.

## Slice 12 — close the ratchet (D3)

- **`testing.md` § Coverage:** the September 22 ratchet paragraphs are replaced by the decision. The
  global floors stay. Eleven measured critical-path floors replace the ratchet: Shared's
  `modules/work`, `modules/job-queue`, `hooks/auth` and `hooks/vault` plus three exact files, two
  Client and two Admin globs, all pinned by `workflow-performance-parity.test.mjs`. A floor rises
  only from measured coverage, with its parity array in the same change.
- **`codebase-architecture-skills`:**
  - decision 11 records D3;
  - the ratchet requirement row and step 10 are closed;
  - `eval.md` records the closure under the scheduled checkpoint;
  - `status.json` drops `coverage_ratchet` from `linear.operationalCheckpoints` and restates the
    note;
  - `plan-hub set-lane` appends a `state_api` history entry.

  The lane stays `in_progress` for the agent workflow reliability follow-up, and lane `branch`
  fields stay null.
- **Unchanged:** no Vitest config and no parity array changed.
- **PRD-835:** its Linear mirror still shows the checkpoint until the next `linear-sync`, which
  belongs to the closeout pass; this pass makes no Linear writes.

Proof: `node scripts/harness/plan-hub.mjs validate` validated 24 feature hubs after the status write and
Biome format. `git diff -- packages/*/vitest.config.ts scripts/quality/workflow-performance-parity.test.mjs`
is empty for this slice.

## Slice 13 — hub and handoff

`plan.todo.md`:

- carries D1–D5 in the decision log, with the ratchet row now decided;
- has the slice table with evidence links and a dated "Current execution truth";
- keeps steps 3 and 5 open only for the current-head CI that the closeout pass provides;
- closes step 11 now that the Client blocker is resolved, and the deferred isolation row, which
  slice 6 adopted.

`status.json` moves `state_api` from `blocked` to `in_progress` with a history entry and a note.
[`handoffs/astra-review.md`](../handoffs/astra-review.md) holds the range from `d7cf681ec`, each
slice's claim and evidence, the known limits, and what could not be verified locally.

Proof: `node scripts/harness/plan-hub.mjs validate` and
`bun run check -- --intent qa --only agent-guidance --only docs-generated --only docs-authority`,
recorded in the commit that adds this section. The immutable-report check runs after the commit.
