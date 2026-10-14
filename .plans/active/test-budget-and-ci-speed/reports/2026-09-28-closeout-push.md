# Closeout push (2026-09-28)

The velocity follow-through and the resolution of Astra's review are on `origin/develop`
(`d7cf681ec..fca76d585`, 31 commits). Measuring the push found two gate defects, and both are
fixed forward in that range. Every workflow for each pushed head is green, and Coverage Nightly
passed every floor at `627149a4d`. Steps 3 and 5 close on that evidence.

## Pushes

| Push | Range | Pre-push hook | Wall |
|---|---|---|---|
| 1 | `d7cf681ec..8e05497f6` (29 commits) | critical plan, 32 checks; reused none and ran all | 230 s |
| 2 | `8e05497f6..627149a4d` | sensitive plan, 5 checks; reused all 5 | 4.6 s |
| 3 | `627149a4d..fca76d585` | sensitive plan, 5 checks; reused all 5 | 4.9 s |

Each push printed the expected "Bypassed rule violations" notice (pull request required, CI Gate
expected, CodeQL pending), and `git ls-remote` confirmed each head.

## Push-gate timings

| Run | Plan | Result |
|---|---|---|
| Manual gate before push 1, at `8e05497f6` (20:35:45Z to 20:43:26Z, load 1.2 to 5.3) | critical, 365 paths, 32 checks, 1,716 s of budgets | passed in 461 s: the first real-world sample for outcome 1 |
| Hook of push 1 | same plan | passed in 230 s, reusing nothing (finding 1); Turbo's cache was warm |
| Replay at `fca76d585` from a plain shell, `--base d7cf681ec`, no receipts | same plan | passed in 217 s; the package suites hit Turbo's cache, and the contract checks (70 s and 80 s) dominate |
| The same replay again | same plan | passed in 2.1 s, reusing all 32 receipts |
| Manual gate before pushes 2 and 3 | sensitive, 3 and 2 paths | 13 s each |

For one Shared hook file (`useWorkApprovals.ts`) the critical plan is now 19 checks and a 269 s
estimate, against 18 checks and 965 s in snapshot 06. Slice 3 measured that fixture at 274 s cold
and 3 s warm.

Two corrections to earlier records: the plan has 32 checks, not 34 (two contract checks print
their own ✓ lines, and the count included them), including in `627149a4d`'s message. And the
resolution report's claim that a manual run and the hook differ in exactly `PATH`,
`GIT_EXEC_PATH` and `SHLVL` was measured without Husky's shim (finding 1).

## Findings fixed forward

1. **The hook could not reuse a manual pass (`627149a4d`).** Only the environment digest differed.
   A real `git push` through Husky's shim `.husky/_/h` sources `~/.config/husky/init.sh`, which
   exports `NVM_DIR`. Measured with the real shim, the manual run and the hook differ in `PATH`,
   `GIT_EXEC_PATH`, `NVM_DIR` and `SHLVL`. The fingerprint now also leaves out nvm's variables and
   `MANPATH`, which only nvm and `man` read; the hook loads nvm itself when a `.nvmrc` exists.
   RED: the hook-shaped test run reran. GREEN: runner tests 40/40, validation-system test
   348/348, and the next two hooks reused every receipt.
2. **A manual gate could not find package binaries (`fca76d585`).** `design-guardrails`,
   `design-md` and `agentic-readiness` call `design.md` by name, and `fork-fixtures-test` calls
   `vitest`. The runner passed the caller's `PATH` through unchanged. Husky's shim adds
   `node_modules/.bin`, so the hook passed; a manual run failed with exit 127 and left the hook
   nothing to reuse. The 20:35Z gate passed only because it was started with
   `node_modules/.bin` added by hand, and the first replay failed on it. This predates the range.
   The runner now puts the check's and the repository's `node_modules/.bin` first, as `bun run`
   does. RED: exit 127. GREEN: exit 0, runner tests 41/41, validation-system test 349/349, and
   the plain-shell replay above.

## Current-head CI

| Head | Workflow | Result | Run |
|---|---|---|---|
| `8e05497f6` | Admin | success | [36481732047](https://github.com/greenpill-dev-guild/green-goods/actions/runs/36481732047) |
| | Agent | success | [36481732760](https://github.com/greenpill-dev-guild/green-goods/actions/runs/36481732760) |
| | Client | success | [36481732133](https://github.com/greenpill-dev-guild/green-goods/actions/runs/36481732133) |
| | Contracts | success | [36481732287](https://github.com/greenpill-dev-guild/green-goods/actions/runs/36481732287) |
| | Design | success | [36481732058](https://github.com/greenpill-dev-guild/green-goods/actions/runs/36481732058) |
| | Docs | success | [36481732246](https://github.com/greenpill-dev-guild/green-goods/actions/runs/36481732246) |
| | Indexer | success | [36481732459](https://github.com/greenpill-dev-guild/green-goods/actions/runs/36481732459) |
| | Shared | success | [36481732150](https://github.com/greenpill-dev-guild/green-goods/actions/runs/36481732150) |
| | Supply Chain Guardrails | success | [36481732041](https://github.com/greenpill-dev-guild/green-goods/actions/runs/36481732041) |
| | CodeQL, CodeQL - Code Quality | success | [36481729190](https://github.com/greenpill-dev-guild/green-goods/actions/runs/36481729190), [36481729700](https://github.com/greenpill-dev-guild/green-goods/actions/runs/36481729700) |
| `627149a4d` | Supply Chain Guardrails | success | [36482782901](https://github.com/greenpill-dev-guild/green-goods/actions/runs/36482782901) |
| | Coverage Nightly (dispatched) | success | [36483127896](https://github.com/greenpill-dev-guild/green-goods/actions/runs/36483127896) |
| | CodeQL, CodeQL - Code Quality | success | [36482781374](https://github.com/greenpill-dev-guild/green-goods/actions/runs/36482781374), [36482781924](https://github.com/greenpill-dev-guild/green-goods/actions/runs/36482781924) |
| `fca76d585` | Supply Chain Guardrails | success | [36484392150](https://github.com/greenpill-dev-guild/green-goods/actions/runs/36484392150) |
| | CodeQL, CodeQL - Code Quality | success | [36484390301](https://github.com/greenpill-dev-guild/green-goods/actions/runs/36484390301), [36484390147](https://github.com/greenpill-dev-guild/green-goods/actions/runs/36484390147) |

Each head started exactly the workflows `expectedWorkflowNames` names for its range: nine for
push 1 and Supply Chain Guardrails alone for pushes 2 and 3. `ci-gate.yml` runs on pull requests
only, so a direct push has no CI Gate run.

## Step 3: Shared shards at `8e05497f6`

| Shard | Job | Vitest line |
|---|---|---|
| Test (1/2), 273 files | 168 s | `Duration 128.92s (transform 38.49s, setup 43.78s, import 183.07s, tests 40.89s, environment 74.08s)` |
| Test (2/2), 272 files, 2 skipped | 146 s | `Duration 116.66s (transform 39.96s, setup 38.39s, import 168.67s, tests 37.58s, environment 65.82s)` |

Worker time is 730.7 s over both shards, against 1,039.8 s in snapshot 06 (−30%), and test bodies
are 10.7% of it, against 8.2%. These are one run each; the job medians need a seven-day window.

## Step 5: coverage floors at `627149a4d`

Push CI does not enforce the floors; Coverage Nightly does, nightly and on pushes to `main`. Its
last run was at `d7cf681ec`, so this pass dispatched it on `develop`
([36483127896](https://github.com/greenpill-dev-guild/green-goods/actions/runs/36483127896)).
A job fails on an unmet threshold, and all three passed:

| Package | Job | Files | Statements, branches, functions, lines |
|---|---|---|---|
| Shared | 293 s | 545 (2 skipped) | 74.05, 67.32, 72.51, 75.86 |
| Client | 139 s | 144 | 72.6, 67.09, 70.08, 74.48 |
| Admin | 217 s | 135 | 69.06, 65.15, 62.05, 70.65 |

## Contracts · Unit Tests at `8e05497f6`

The job took 514 s, against a 243 s median in snapshot 06:

- Solc compiled 396 files cold (250 s), because the Foundry test cache under the key's prefix was
  gone. The only cache under that prefix is the one this run saved.
- The release gas gate rebuilt the production tree from scratch (85 s), as pushes do by design,
  then verified its fixtures (31 s).
- Forge ran 2,091 tests in 21.26 s; the script Vitest suite ran 25 files in 11.26 s.

The Actions cache holds 9.78 of its 10 GB, and 22 CodeQL overlay base databases of about 450 MB
each take 9.89 GB of that. GitHub evicts the least recently used caches, so a cache that a
workflow touches only now and then does not survive. The develop-PR reuse of the production tree
(slice 9) stays unverified until a pull request runs.

## Test lease on a quiet machine

The full Shared suite (545 files) through `bun run test` in `packages/shared`, one slot, in the
main checkout. Before the runs: uptime 6 d 3 h, load 1.6, no other Vitest process, 13.8 of 15.4 GB
of swap in use. Every run passed.

| Run | Start (UTC) | Wall | Vitest |
|---|---|---|---|
| single | 21:13:33 | 45 s | 44.6 s |
| pair, first | 21:14:18 | 48 s | 47.6 s |
| pair, second | 21:14:19 | 111 s: waited 47 s, then ran | 62.6 s |
| single | 21:16:10 | 75 s | 74.6 s |

The second run printed the holder's pid, package and checkout at once and again at 30 s, and
took the slot within a second of its release. The timing bound (both done within twice one quiet
run, 90 s) is not met: the second result came at 111 s. As in slice 1, runs slowed one after
another without overlapping (45, 48, 63, 75 s) while load rose from 1.5 to 13; the swap in use
may explain it, and these samples cannot separate the causes. The quiet single run is 45 s,
against 75 s in snapshot 06.

## Selector replay

Slice 4's replay stands: 37 of 39 CI red pairs select their check, and the other 2 were base
drift. It was not re-run at `fca76d585`; its drift tests pass there (validation-system test
349/349).

## Open items and destinations

| Item | Destination |
|---|---|
| CodeQL's overlay databases fill the Actions cache (9.89 of 10 GB), so less-used caches, such as Foundry's, are evicted and the jobs that need them start cold | Afo's decision: CodeQL runs under GitHub's default setup, a security setting |
| The lease timing bound is not met on this machine | Measure again with swap under 1 GB (after a restart) |
| Job medians, the CI Gate median, red rates and failure mix | Pending the seven-day window from 2026-09-28 |
| Items from the resolution report (SDK `BigInt` patch, Data Saver inheritance, import-seam parity gap) | Unchanged; see the [resolution report](2026-09-28-astra-review-resolution.md) |
