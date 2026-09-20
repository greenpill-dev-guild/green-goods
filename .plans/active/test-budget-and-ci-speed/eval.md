# Evaluation and completion evidence

## Preparation and plan validation

Preparation is a source/measurement refresh, not a full audit rerun. The [dated report](reports/2026-09-19-preparation.md) records source identity, inventory method, open PR heads, CI and coverage references, target dispositions and limits.

Before validation, rendered:

```sh
bun run check --plan -- --intent diagnose --changed .plans/backlog/test-budget-and-ci-speed/plan.todo.md --json
```

Result: ready, sensitive risk, no selected checks. The direct Plan Hub acceptance check is `node scripts/harness/plan-hub.mjs validate`, required by `.plans/README.md`. Validate canonical documents, status and links; do not treat this as product proof.

Plan validation on 2026-09-19: `node scripts/harness/plan-hub.mjs validate` passed with “Validated 27 feature hubs.” The installed Biome formatter formatted status.json; local Markdown links resolve and scaffold placeholders are absent. Source HEAD remained `459ca0b904a46511e31293ef921dfc8c3af70496`; git status showed only this new hub. These are working-copy documents; no committed evidence receipt is claimed.

## Per-slice proof

Render `bun run check --plan -- --intent <intent>` for actual changed paths first. Follow selectedBy, critical overrides and `.claude/context/validation-pipeline.md`. These are acceptance requirements, not precomputed future selector results.

| Change | Direct evidence |
|---|---|
| Guidance | bun run check --only agent-guidance and --only guidance-links; semantic skill evaluation only if triggers change |
| Browser policy | Ordinary pending manual proof, automated failure, unavailable automated capability, stale receipt if applicable, critical override, unchanged ship/merge/release behavior. Demonstrate actual hook outcome in a disposable fixture without bypass. |
| Sharding | Wrapper forwarding, failed/missing shard gate tests, parity, both shards and CI Gate green at the PR's current SHA |
| Floors | Current exact-glob coverage, controlled below-floor failure, then unmodified passing baseline; matching parity |
| Missing proof | Named invariant, real module, baseline result and evidence the assertion detects the defect. Deliberate faults stay in disposable fixtures/scratch. Exposed product bugs get separate scope. |
| Helpers | Before/after JSON reports with identical names and zero failures; preserve retry/cache/provider semantics; list exclusions |
| Deletion | Same-fault surviving test or verified absence of callers; targeted suite passes; staged-module/direct-proof registry protections retained |
| Store contract | Both adapters run common cases; SQLite covers withdrawal, expiry/sweep, stale revisions, pending cap, encryption and persistence |
| Layout | Real subject geometry/interactions and faithful boot-document fixture; required authenticated Brave evidence. Similar markup in a story is not equivalent proof. |
| File merge | Baseline/registry exclusions checked; same-subject cases retained; bun run check --only test-quality |
| Ratio summary | Informational output handles additions, deletions and zero-source changes; cannot fail the required gate |

Use `bun run test` through repo wrappers. No dependencies need installation for preparation. Future visible UI changes follow authenticated-browser requirements and disclose missing evidence.

## Step 1 guidance evidence — 2026-09-19

Source identity: working copy on `develop` at `7f0d81f670b884608b122db2c21a032def852812`. The changed guidance and backlog-to-active hub move are uncommitted, so that SHA identifies the baseline and is not a tested implementation commit. The preparation snapshot at `459ca0b904a46511e31293ef921dfc8c3af70496` was not reused as current-head proof.

The plan rendered with `bun run check --plan -- --intent diagnose --changed AGENTS.md,.claude/context/testing.md,.claude/skills/review/SKILL.md,.plans/active/test-budget-and-ci-speed/brief.md,.plans/active/test-budget-and-ci-speed/spec.md,.plans/active/test-budget-and-ci-speed/plan.todo.md,.plans/active/test-budget-and-ci-speed/eval.md,.plans/active/test-budget-and-ci-speed/status.json --json`. It reported sensitive risk and selected `validation-system-test`, `test-quality`, and `agent-guidance` by their conditional selectors. The hub move also appears as deleted backlog paths in Git status.

| Command | Actual result |
|---|---|
| `bun run check --only agent-guidance` | Passed: Codex consistency, 15 skill behavior scenarios and 15 task routes, 61 guidance files. |
| `bun run check --only guidance-links` | Passed: 61 guidance files. |
| `bun run check --only test-quality` | Passed: all five checks; zero direct-test seam violations. |
| `bun run check --only validation-system-test` | Failed twice: 280/281 tests passed. `scripts/lib/dev-shared.test.mjs` expected every `git rev-parse --local-env-vars` entry in the unchanged `REPOSITORY_LOCAL_GIT_VARIABLES` list, but Git also returned `GIT_INTERNAL_SUPER_PREFIX`. |
| `node scripts/harness/plan-hub.mjs validate` | Passed after the hub update: 27 feature hubs validated. |
| `./node_modules/.bin/biome check .plans/active/test-budget-and-ci-speed/status.json` | Passed after formatting: one file checked, no fixes needed. |
| `git diff --check` | Passed with no whitespace errors. |

The selected suite failure is separate from the guidance edit. `git diff --exit-code HEAD -- scripts/lib/dev-shared.js scripts/lib/dev-shared.test.mjs` returned 0; no production or validation-tooling repair was bundled into step 1. The installed Git reports `git version 2.39.5 (Apple Git-154)`. No all-green validation or current-commit receipt is claimed. No skill trigger wording changed, so the semantic skill evaluation was not selected by the step 1 acceptance rule.

Live overlap check with `gh pr view 795 --json number,state,headRefOid,baseRefName,updatedAt,files` and the same command for `802`: [PR #795](https://github.com/greenpill-dev-guild/green-goods/pull/795) was open at `f3d4de6919819b8afbfe7c9cc01cc92823284a28` and touches `.claude/context/testing.md`; [PR #802](https://github.com/greenpill-dev-guild/green-goods/pull/802) was open at `c825265a9698652f79b283d22f93527feb9b88d5` and touches `.claude/skills/review/SKILL.md` and `AGENTS.md`. The cached local diffs add links and reuse guidance in adjacent lines; this slice did not overwrite them. The [architecture hub](../codebase-architecture-skills/plan.todo.md) still owns the September 22 two-point coverage checkpoint. No threshold or parity array changed.

The `parent_only` Linear manifest was read as planning output; no Linear record was created.

## Step 2 browser-policy evidence — 2026-09-20 UTC

Source identity: uncommitted working copy on `develop` at baseline HEAD `7f0d81f670b884608b122db2c21a032def852812`. Other sessions added Client and Shared working-tree changes during this slice; the changed-path plan below selected only the browser-policy paths. No tested implementation commit or current-head CI receipt exists.

The policy choice was presented before gate editing and the user selected the recommended design: ordinary automated push can pass while manual authenticated browser proof remains pending for readiness. No manual receipt system was added. `.husky/pre-push` and numerical thresholds were unchanged.

Rendered `bun run check --plan -- --intent qa --changed scripts/quality/select-validation.mjs,scripts/quality/select-validation.test.mjs,scripts/dev/ci-local.js,scripts/dev/ci-local.test.mjs,.claude/context/validation-pipeline.md --json`: sensitive risk, ready, selected `format` and `lint` by `automatic-hygiene`, and `validation-system-test` by `direct-root-test:validation-system-test`.

| Command | Actual result |
|---|---|
| `node scripts/dev/node-cli.js node --test scripts/quality/select-validation.test.mjs scripts/dev/ci-local.test.mjs` before implementation | RED: 110/113 passed; three new policy cases failed. Log: `/private/tmp/green-goods-browser-policy-red.log`. |
| Same focused command after implementation | GREEN: 114/114 passed. Log: `/private/tmp/green-goods-browser-policy-green.log`. |
| `node scripts/dev/ci-local.js --intent push --changed packages/client/src/components/Communication/Offline/OfflineIndicator.tsx --test-path client:src/__tests__/components/OfflineIndicator.test.tsx` | Exit 0; format, lint, focused Client test 15/15, staged-modules, and source-structure passed; manual browser proof reported pending. This was a direct runner simulation using unchanged UI files, not a push. Log: `/private/tmp/green-goods-browser-policy-push.log`. |
| `PATH=/opt/homebrew/bin:$PATH sh .husky/pre-push` in disposable clone `/private/tmp/gg-browser-hook-UAV8f0/repo` | Exit 0 through the unchanged hook. Format, lint, validation-system-test (exact passing receipts), Client test 15/15, staged-modules, and source-structure passed; browser proof displayed pending for readiness. The clone had a harmless focused Client source/test edit and symlinked existing dependencies; there was no push or dependency install. Log: `/private/tmp/green-goods-browser-policy-hook-green.log`. The command-scoped PATH selected installed Git 2.55.0 for this fixture only. |
| `bun run check -- --intent qa --changed scripts/quality/select-validation.mjs,scripts/quality/select-validation.test.mjs,scripts/dev/ci-local.js,scripts/dev/ci-local.test.mjs,.claude/context/validation-pipeline.md` | Format and lint passed. Validation-system-test failed 284/285 on unchanged `scripts/lib/dev-shared` Git-variable enumeration: Apple Git 2.39.5 reports `GIT_INTERNAL_SUPER_PREFIX`. Log: `/private/tmp/green-goods-browser-policy-selected.log`. |

The focused tests cover automated failure, unavailable automated capability, critical push, CI push, and readiness/ship/merge/release blocking. The browser check remains mandatory with `state: blocked` in the push plan, and the runner reports it in `pendingManual` rather than claiming authenticated proof. Receipt reuse still requires exact passing inputs. The fixture hook's result proves the installed hook path for that disposable source state; the current dirty working copy has no real push or current-SHA CI evidence.

Review hardening: a new negative case put `dependencies` in the manual browser check's `blockedBy` list. It failed before the browser-only guard (37/38 in `ci-local.test.mjs`) and passed after the guard required every blocker to be `authenticatedBrave` (114/114 focused policy tests). The selected validation-system suite passed 290/290 with command-scoped Git 2.55. After this guard, the unchanged `.husky/pre-push` was rerun in the same disposable clone with the current selector and runner copied in: exit 0, validation-system-test 285/285, focused Client test 15/15, and manual browser proof still pending for readiness. Log: `/private/tmp/green-goods-browser-policy-hook-current.log`. The clone's HEAD and harmless Client fixture are not the live dirty working copy or a published SHA.

## Step 3 Shared CI sharding evidence — 2026-09-20 UTC

Source identity: uncommitted `develop` working copy at baseline HEAD `7f0d81f670b884608b122db2c21a032def852812`. Another session's Shared locale diff hash was `436ffbf6d09e1ba1083729b0c0a59cc07b7b942bc91f108ea79c9b2ca4ab1525` before, during and after the local Shared runs. No workflow run exists for this uncommitted implementation.

Rendered `bun run check --plan -- --intent qa --changed .github/workflows/shared.yml,scripts/dev/package-commands.mjs,scripts/dev/package-commands.test.mjs,scripts/quality/ci-gate.mjs,scripts/quality/ci-gate.test.mjs,scripts/quality/workflow-performance-parity.test.mjs --json`: sensitive risk, ready; format/lint selected by `automatic-hygiene`, validation-system-test by `direct-root-test:validation-system-test`.

| Command | Actual result |
|---|---|
| `node scripts/dev/node-cli.js node --test scripts/dev/package-commands.test.mjs scripts/quality/ci-gate.test.mjs scripts/quality/workflow-performance-parity.test.mjs` before implementation | RED: 59/63 passed; four shard/wrapper/gate/workflow cases failed. `/private/tmp/green-goods-shards-red.log`. |
| Same focused command after implementation and complete-scope guard | GREEN: 63/63 passed. `/private/tmp/green-goods-shards-green-final.log`. |
| `bun run check -- --intent qa --changed .github/workflows/shared.yml,scripts/dev/package-commands.mjs,scripts/dev/package-commands.test.mjs,scripts/quality/ci-gate.mjs,scripts/quality/ci-gate.test.mjs,scripts/quality/workflow-performance-parity.test.mjs` | Format and lint passed; validation-system-test 287/288, failing only the unchanged Apple Git-variable case. `/private/tmp/green-goods-shards-selected.log`. |
| Same selected command with `PATH=/opt/homebrew/bin:$PATH` | All selected checks passed; validation-system-test 288/288 with installed Git 2.55 for this command only. `/private/tmp/green-goods-shards-selected-homebrew-git.log`. |
| `bun run --cwd packages/shared test --shard 2/2 --explain --json` | Resolved through the wrapper to Node Vitest run with default exclusions and `--shard 2/2`; no test launched. |
| `bun run test --shard 1/2` in Shared | Passed: 250 files, 2,693 tests passed, 5 skipped. Vitest 194.77 s; process wall 200.17 s. `/private/tmp/green-goods-shard-1.log`. |
| `bun run test --shard 2/2` in Shared | Failed: 246 files passed, one failed, two skipped; 2,617 tests passed, one failed, 12 skipped. Vitest 193.99 s; process wall 196.27 s. Sole failure: locale-coverage on uncommitted identical `Agro` strings in Spanish and Portuguese. `/private/tmp/green-goods-shard-2.log`. |
| `bun run test src/__tests__/i18n/locale-coverage.test.ts` in Shared without sharding | Reproduced the same locale failure: 14/15 passed. `/private/tmp/green-goods-locale-unsharded.log`. |
| `bun run test` in Shared | Failed on the same locale case: 496 files passed, one failed, two skipped; 5,310 tests passed, one failed, 17 skipped. Vitest 297.06 s; process wall 302.06 s. `/private/tmp/green-goods-shared-unsharded-local.log`. |

The shard totals equal the unsharded totals: 499 files and 5,328 tests with identical pass/fail/skip counts. This is one local timing reference per shape on a dirty source state. The shard commands ran sequentially, so their approximately 195-second maximum is only a possible parallel test-step critical path; CI job setup, runner contention, three-run distribution and a published current-SHA gate remain unmeasured. The September 19 successful Shared CI run at a different SHA remains a dated reference. Nightly coverage's command and thresholds were unchanged. [GitHub's workflow-job API](https://docs.github.com/en/rest/actions/workflow-jobs) supports the latest-run jobs query used by the gate; local tests inject completed, missing and failed job lists without a live PR.

Review hardening: the Indexer parser initially accepted the newly declared Shared-only `--shard` option without applying it. An Indexer rejection case failed before the guard (8/9 in `package-commands.test.mjs`), then wrapper, CI Gate and workflow parity tests passed 65/65. The rendered changed-path QA plan selected format and lint for the wrapper and test; both passed with command-scoped Git 2.55. Logs: `/private/tmp/green-goods-shard-input-red.log`, `/private/tmp/green-goods-shard-input-green.log`, and `/private/tmp/green-goods-shard-input-selected.log`.

## Step 4 informational churn summary — 2026-09-20 UTC

Source identity: uncommitted `develop` working copy at baseline HEAD `7f0d81f670b884608b122db2c21a032def852812`. Another session continued editing Client and Shared files; step 4's changed-path plan selected only `.github/workflows/supply-chain-guardrails.yml`, the new summary script/test, workflow parity test, and `scripts/README.md`.

Rendered `bun run check --plan -- --intent qa --changed .github/workflows/supply-chain-guardrails.yml,scripts/quality/summarize-test-churn.mjs,scripts/quality/summarize-test-churn.test.mjs,scripts/quality/workflow-performance-parity.test.mjs,scripts/README.md --json`: sensitive risk, ready; format/lint selected by `automatic-hygiene`, validation-system-test by `direct-root-test:validation-system-test`.

| Command | Actual result |
|---|---|
| `node scripts/dev/node-cli.js node --test scripts/quality/summarize-test-churn.test.mjs scripts/quality/workflow-performance-parity.test.mjs` before implementation | RED: 28/30 passed; missing module and workflow wiring failed. `/private/tmp/green-goods-churn-red.log`. |
| Same focused command after implementation | GREEN: 31/31 passed. `/private/tmp/green-goods-churn-green-final.log`. |
| `node scripts/quality/summarize-test-churn.mjs --base HEAD^ --head HEAD` | Exit 0; produced a Markdown table for six added other files and an honest `n/a` ratio when no source line changed. `/private/tmp/green-goods-churn-sample.md`. This is a CLI fixture on a prior local commit range, not a current PR report. |
| Same CLI command with `--summary /private/tmp/green-goods-churn-step-summary.md` | Exit 0; appended 11 lines to the disposable step-summary file. |
| `bun run check -- --intent qa --changed .github/workflows/supply-chain-guardrails.yml,scripts/quality/summarize-test-churn.mjs,scripts/quality/summarize-test-churn.test.mjs,scripts/quality/workflow-performance-parity.test.mjs,scripts/README.md` | Format and lint passed; validation-system-test 288/289, failing only the unchanged Apple Git-variable case. `/private/tmp/green-goods-churn-selected.log`. |
| Same selected command with `PATH=/opt/homebrew/bin:$PATH` | All selected checks passed; validation-system-test 289/289 with installed Git 2.55 for that command only. `/private/tmp/green-goods-churn-selected-homebrew-git.log`. |

The summary reports additions and deletions rather than a quota and classifies code/test paths separately from other files. File status uses Git's NUL-delimited, no-rename diff so added/deleted files and zero-source changes have explicit results. It is attached to the existing Supply Chain Guardrails change-detection job with `continue-on-error: true`; no required job or threshold was added. There is no live PR summary or current-SHA CI receipt.

## Step 5 Shared aggregate floors — 2026-09-20 UTC

Source identity: committed Shared source at `7f0d81f670b884608b122db2c21a032def852812` in disposable checkout `/private/tmp/gg-browser-hook-UAV8f0/repo`; its Shared source had no working-tree edits. The new threshold config was copied from the uncommitted `develop` working copy for the green run. Main-worktree Shared cookie-jar and locale edits belong to another session and were excluded from this baseline. The baseline and floor runs are local evidence, not current-head CI.

Installed Vitest 4.1.11's `resolveThresholds` matches glob keys against file paths relative to the package root, builds an aggregate per glob, and still includes those files in global thresholds. Positive numbers are minimum percentages; no per-file option was selected. This agrees with the [Vitest coverage configuration](https://vitest.dev/config/coverage) for the semantics used here. Exact totals came from `coverage/coverage-final.json` with the installed Istanbul coverage-map library, not averages of file percentages. The latter green run's exact totals are:

| Shared glob (files) | Statements | Branches | Functions | Lines | New floors S/B/F/L |
|---|---:|---:|---:|---:|---|
| `src/modules/work/**` (37) | 1,518/1,735 = 87.49% | 1,031/1,256 = 82.08% | 292/332 = 87.95% | 1,365/1,529 = 89.27% | 85/80/85/87 |
| `src/modules/job-queue/**` (33) | 1,331/1,574 = 84.56% | 812/1,039 = 78.15% | 297/350 = 84.85% | 1,213/1,388 = 87.39% | 82/76/82/85 |
| `src/hooks/auth/**` (6) | 120/154 = 77.92% | 98/130 = 75.38% | 29/37 = 78.37% | 109/137 = 79.56% | 75/73/76/77 |
| `src/hooks/vault/**` (27) | 624/868 = 71.88% | 464/775 = 59.87% | 91/132 = 68.93% | 597/814 = 73.34% | 69/57/66/71 |

The floors sit below the measured percentages to allow small changes without losing the boundary. The existing Shared global floors remain 61% statements, 52% branches, 59% functions, and 62% lines. The architecture hub still owns its September 22 two-point global ratchet; it was not marked complete or edited here. Near-zero Cookie Jar and compression paths await direct behavior proof before floors.

Rendered `bun run check --plan -- --intent qa --changed packages/shared/vitest.config.ts,scripts/quality/workflow-performance-parity.test.mjs --json`: sensitive, ready; format/lint selected by `automatic-hygiene`, validation-system-test by `direct-root-test:validation-system-test`, Shared typecheck/test and Client/Admin tests plus Agent typecheck/test by their surface selectors. The broader consumers were not reached after the Shared test failure.

| Command | Actual result |
|---|---|
| `node scripts/dev/node-cli.js node --test scripts/quality/workflow-performance-parity.test.mjs` before config edit | RED: 29/30 passed; the new Shared glob parity case failed. `/private/tmp/green-goods-shared-floors-red.log`. |
| Same command after config edit | GREEN: 30/30 passed. `/private/tmp/green-goods-shared-floors-green.log`. |
| `bun run test --scope all-configured --coverage` in the disposable checkout before new floors | Passed: 497 files, 5,311 tests; 2 files and 17 tests skipped. Global V8 coverage was 70.72/63.30/69.02/72.54% in S/B/F/L order. `/private/tmp/green-goods-shared-coverage-head.log`. |
| Deliberate fault fixture: same wrapper with one `usePrimaryAddress` test, coverage include narrowed to that source file, global floors temporarily removed, auth glob line floor set to 100% | The test passed 9/9, but Vitest exited 1 with `Coverage for lines (31.57%) does not meet "src/hooks/auth/**" threshold (100%)`. Config restored afterward; fixture `git diff --exit-code -- packages/shared/vitest.config.ts` returned 0 before copying proposed floors. `/private/tmp/green-goods-floor-fault-fixture.log`. |
| `bun run test --scope all-configured --coverage` in the disposable checkout with copied proposed config | Passed: 497 files, 5,311 tests; 2 files and 17 tests skipped. Global V8 coverage was 70.71/63.29/69.02/72.54% S/B/F/L. The four globs cleared their floors. `/private/tmp/green-goods-shared-floors-coverage-green.log`; exact aggregate JSON extracted to `/private/tmp/green-goods-shared-floors-baseline.json`. |
| `PATH=/opt/homebrew/bin:$PATH bun run check -- --intent qa --changed packages/shared/vitest.config.ts,scripts/quality/workflow-performance-parity.test.mjs` in the main working tree | Format, lint, validation-system-test 290/290, and Shared typecheck passed. Shared test failed one locale-coverage case on the other session's identical `Agro` Spanish/Portuguese entries (496 files passed, one failed, two skipped); selector stopped dependent Client/Admin/Agent checks. `/private/tmp/green-goods-shared-floors-selected-live.log`. |

No numerical global threshold changed, no test isolation setting changed, and no current-SHA CI proof exists. Client/Admin critical glob measurement and near-zero paths paired with new proof remain for later slices.

The shared checkout advanced independently to `08f96dc0607ca26f00e7d6bf65d038febf9b6e39` after these runs. The intervening commits changed Cookie Jar source/tests and shared guidance, not the four measured Shared globs; the recorded coverage run remains explicitly tied to `7f0d81f`, not a current-HEAD claim. Other sessions' uncommitted Client, garden-hook and locale files remain untouched.

## Step 5 Client aggregate floors — 2026-09-20 UTC

Source identity: committed `08f96dc0607ca26f00e7d6bf65d038febf9b6e39` in fixed-SHA disposable checkout `/private/tmp/gg-test-floors-4ycn4M/repo`. Its Client and Shared source were clean; installed dependencies were symlinked without an install. The current working copy had another session's Client changes and was used separately for the selected check. Exact glob totals came from the fixed checkout's `coverage/coverage-final.json` through the installed Istanbul coverage map, the same method that reproduced the earlier Shared totals.

| Client glob (files) | Statements | Branches | Functions | Lines | New floors S/B/F/L |
|---|---:|---:|---:|---:|---|
| `src/views/Home/WalletSheet/**` (13) | 183/237 = 77.21% | 190/273 = 69.59% | 50/79 = 63.29% | 176/224 = 78.57% | 74/67/60/75 |
| `src/views/Profile/**` (11) | 349/398 = 87.68% | 273/338 = 80.76% | 81/89 = 91.01% | 334/376 = 88.82% | 85/78/88/86 |

Rendered `bun run check --plan -- --intent qa --changed packages/client/vitest.config.ts,scripts/quality/workflow-performance-parity.test.mjs --json`: sensitive, ready; format/lint by `automatic-hygiene`, validation-system-test by `direct-root-test:validation-system-test`, and Client test by `surface:client`. The existing Client global floors remain 63% statements, 56% branches, 62% functions and 64% lines.

| Command | Actual result |
|---|---|
| `bun run test --coverage` in the fixed checkout under the ordinary sandbox | 139 files passed, one failed; 1,289 tests passed, one failed. The Vite watch test could not bind `127.0.0.1` (`EPERM`), so Vitest wrote no coverage report. This is a sandbox capability failure, not a product failure. `/private/tmp/green-goods-client-coverage-head-08f.log`. |
| Same wrapper with local loopback access before new floors | Passed: 140 files and 1,290 tests. Global S/B/F/L = 70.88/64.52/67.82/72.75%. `/private/tmp/green-goods-client-coverage-head-08f-loopback.log`. |
| `node scripts/dev/node-cli.js node --test scripts/quality/workflow-performance-parity.test.mjs` before config edit | RED: 30/31 passed; Client glob parity failed with no entries. `/private/tmp/green-goods-client-floors-red.log`. |
| Same focused command after config edit | GREEN: 31/31 passed. `/private/tmp/green-goods-client-floors-green.log`. |
| `bun run test --coverage` in the fixed checkout with the proposed Client config and local loopback access | Passed: 140 files and 1,290 tests; both globs cleared their floors, with the same global percentages. `/private/tmp/green-goods-client-floors-coverage-green.log`; exact totals in `/private/tmp/green-goods-client-floors-baseline.jsonl`. |
| `PATH=/opt/homebrew/bin:$PATH bun run check -- --intent qa --changed packages/client/vitest.config.ts,scripts/quality/workflow-performance-parity.test.mjs` in the live working copy with loopback access | All selected checks passed: format, lint, validation-system-test 291/291, and Client test 140 files/1,292 tests. The two additional Client tests belong to another session's uncommitted work, not the committed-source coverage baseline. `/private/tmp/green-goods-client-floors-selected-live.log`. |

No current-SHA CI exists for this uncommitted config. Admin measured floors and near-zero paths paired with direct proof remain in step 5; the global ratchet checkpoint remains with the architecture hub.

## Step 5 Admin aggregate floors — 2026-09-20 UTC

The baseline is committed `08f96dc0607ca26f00e7d6bf65d038febf9b6e39` in `/private/tmp/gg-test-floors-4ycn4M/repo`. Its Admin source was clean. The proposed config was subsequently copied there, but that checkout uses symlinked dependencies and its repeated run hit an import-resolution problem described below. The successful floor enforcement run used the live working copy, whose Admin source had no other session's edit. Both reports gave identical exact totals for the two protected globs.

| Admin glob (files) | Statements | Branches | Functions | Lines | New floors S/B/F/L |
|---|---:|---:|---:|---:|---|
| `src/components/Vault/**` (9) | 166/252 = 65.87% | 207/333 = 62.16% | 37/69 = 53.62% | 155/229 = 67.68% | 63/59/50/65 |
| `src/views/Garden/Pool/**` (54) | 574/755 = 76.02% | 767/1,122 = 68.36% | 216/301 = 71.76% | 549/706 = 77.76% | 73/65/68/75 |

Rendered `bun run check --plan -- --intent qa --changed packages/admin/vitest.config.ts,scripts/quality/workflow-performance-parity.test.mjs --json`: sensitive, ready; format/lint by `automatic-hygiene`, validation-system-test by `direct-root-test:validation-system-test`, and Admin test by `surface:admin`. Existing Admin global floors remain 51% statements, 47% branches, 44% functions and 53% lines.

| Command | Actual result |
|---|---|
| `bun run test --coverage` in the fixed checkout before new floors | Passed: 114 files and 863 tests; global S/B/F/L = 58.63/54.78/52.82/60.22%. `/private/tmp/green-goods-admin-coverage-head-08f.log`; exact glob totals in `/private/tmp/green-goods-admin-floors-baseline.jsonl`. |
| `node scripts/dev/node-cli.js node --test scripts/quality/workflow-performance-parity.test.mjs` before config edit | RED: 31/32 passed; Admin globs were missing. `/private/tmp/green-goods-admin-floors-red.log`. |
| Same focused command after config edit | GREEN: 32/32 passed. `/private/tmp/green-goods-admin-floors-green.log`. |
| `bun run test --coverage` in the fixed checkout with copied proposed config | Failed during collection: 113 files passed, one failed to load, 844 tests passed. `SubmitWork.submit.test.tsx` could not import a Vite `/@fs/...react-hook-form/...` path through the checkout's symlinked dependency tree. The dependency file exists, but isolated execution repeated the same module-resolution error. No threshold result is claimed from this run. `/private/tmp/green-goods-admin-floors-coverage-green.log` and `/private/tmp/green-goods-admin-submitwork-isolated.log`. |
| `bun run test --coverage` in the live checkout with the proposed config | Passed: 114 files and 863 tests, both globs above their floors. Global S/B/F/L = 58.65/54.78/52.88/60.22%. The slight global difference is the live mixed working copy; the protected glob counts equal the fixed baseline. `/private/tmp/green-goods-admin-floors-coverage-live.log`. |
| `PATH=/opt/homebrew/bin:$PATH bun run check -- --intent qa --changed packages/admin/vitest.config.ts,scripts/quality/workflow-performance-parity.test.mjs` in the live checkout | All selected checks passed: format, lint, validation-system-test 292/292, and Admin test 114 files/863 tests. `/private/tmp/green-goods-admin-floors-selected-live.log`. |

The eight Shared/Client/Admin glob floors are local, uncommitted implementation. No global threshold, test isolation setting or architecture-hub checkpoint changed. There is no current-SHA CI for the configs. Cookie Jar and compression near-zero paths await direct behavior proof in later slices before receiving floors.

## Step 6 Shared Cookie Jar deposit proof — 2026-09-20 UTC

Source identity: uncommitted `develop` working copy at HEAD `08f96dc0607ca26f00e7d6bf65d038febf9b6e39`. `useCookieJarDeposit.ts` was unchanged from the fixed baseline, and the new `useCookieJarDeposit.test.ts` is this slice's only package edit. Other sessions' Client, Shared garden-hook and locale work was left untouched. A fresh GitHub read for PR #802 failed to connect to `api.github.com`; the last successful overlap check remains the dated step 1 record, and no claim about a newer PR head is made.

The new test calls the real deposit hook through TanStack Query and fakes only chain reads, transaction sending, toast/error edges and the timer scheduler. Four cases protect distinct failures: reject a missing account before reads or writes; reject insufficient balance before a transaction; skip approval when allowance suffices; and approve the token before depositing into the jar, then refresh the jar and dismiss the pending toast. No existing test was removed, and the flagged-upload toast proof was untouched. No product runtime defect was exposed in this slice.

Rendered `bun run check --plan -- --intent qa --changed packages/shared/src/__tests__/hooks/cookie-jar/useCookieJarDeposit.test.ts --json`: routine, ready; format/lint by `automatic-hygiene`, Shared test typecheck by `validation-only:shared:types`, and focused Shared test by `validation-only:shared:tests`.

| Command | Actual result |
|---|---|
| `bun run test src/__tests__/hooks/cookie-jar/useCookieJarDeposit.test.ts` in Shared | Passed: one file, four tests. `/private/tmp/green-goods-cookie-jar-deposit-first.log`. |
| First selected QA run | Stopped at format only: Biome requested a multiline object assertion. No test or typecheck result was inferred from this run. `/private/tmp/green-goods-cookie-jar-deposit-selected.log`. |
| Same selected QA run after formatting that assertion | Passed: format, lint, Shared test typecheck, and focused Shared test 4/4. `/private/tmp/green-goods-cookie-jar-deposit-selected-final.log`. |

This is test-only proof of existing behavior, so a pre-implementation RED is not applicable; the changed tool behavior in earlier slices retains its RED/GREEN records. The Cookie Jar near-zero floor awaits a combined committed-source coverage run after campaign proof. No current-SHA CI receipt exists.

## Step 6 Shared campaign jar read proof — 2026-09-20 UTC

Source identity: uncommitted `develop` working copy at HEAD `08f96dc0607ca26f00e7d6bf65d038febf9b6e39`. That HEAD includes another session's committed app-chain read fix and a second test in `useCampaignCookieJar.test.ts`; both were retained. This slice edited only that test file. Its existing test labeled “while disconnected” previously used a connected `useUser` mock; the fixture is now mutable and the test actually renders with no user. Two new cases cover allowlisted connected claim eligibility and an optional contract-read failure that still leaves usable jar details while reporting `detailErrorCount`. The metadata-read fallback case remains. No product source changed or runtime defect was exposed.

Rendered `bun run check --plan -- --intent qa --changed packages/shared/src/__tests__/hooks/cookie-jar/useCampaignCookieJar.test.ts --json`: routine, ready; format/lint by `automatic-hygiene`, Shared test typecheck by `validation-only:shared:types`, and focused Shared test by `validation-only:shared:tests`.

| Command | Actual result |
|---|---|
| `bun run test src/__tests__/hooks/cookie-jar/useCampaignCookieJar.test.ts` in Shared | Passed: one file, four tests. `/private/tmp/green-goods-campaign-cookie-jar-first.log`. |
| `PATH=/opt/homebrew/bin:$PATH bun run check -- --intent qa --changed packages/shared/src/__tests__/hooks/cookie-jar/useCampaignCookieJar.test.ts` | All selected checks passed: format, lint, Shared test typecheck, and focused Shared test 4/4. `/private/tmp/green-goods-campaign-cookie-jar-selected.log`. |

This is test-only proof of existing behavior, so a pre-implementation RED is not applicable. No test was deleted; the flagged-upload toast proof remains untouched. Next, run complete Shared coverage on a stable source copy with the new Cookie Jar tests, measure exact matching counters, and set only a supported near-zero floor.

## Step 6 campaign deposit mutation proof and coverage probe — 2026-09-20 UTC

The first complete Shared coverage probe ran in the fixed `08f96dc` checkout with the four already selected Shared floors and the new deposit and campaign-read tests overlaid. It passed 498 files and 5,318 tests, with two files and 17 tests skipped. Global S/B/F/L was 70.86/63.39/69.12/72.68%. Exact Istanbul counters showed `useCookieJarDeposit.ts` at S/B/F/L 89.79/61.53/77.77/89.36%, but the larger `useCampaignCookieJar.ts` at only 25.68/40.80/22.44/25.88%. The `src/hooks/cookie-jar/**` aggregate was 62.23/55.28/64.66/62.04% across nine files, including an uncovered campaigns hook. Log: `/private/tmp/green-goods-cookie-jar-coverage-baseline-08f.log`. This probe predates the additional campaign mutation case below and is not its final floor baseline.

The campaign hook's deposit mutation lacked direct Shared proof while Client view tests mocked it. One new case in the existing deposit test file now calls the real campaign deposit mutation, verifies the jar transaction, and checks invalidation of the connected member's campaign key. It reuses the existing external-edge fakes and does not repeat the regular deposit's approval-order case. No runtime source or prior test was removed.

| Command | Actual result |
|---|---|
| `bun run test src/__tests__/hooks/cookie-jar/useCookieJarDeposit.test.ts` after the campaign case | Passed: one file, five tests. `/private/tmp/green-goods-cookie-jar-deposit-campaign-first.log`. |
| `PATH=/opt/homebrew/bin:$PATH bun run check -- --intent qa --changed packages/shared/src/__tests__/hooks/cookie-jar/useCookieJarDeposit.test.ts` | All rendered selected checks passed: format, lint, Shared test typecheck, focused Shared test 5/5. `/private/tmp/green-goods-cookie-jar-deposit-campaign-selected.log`. |

This remains test-only proof of existing behavior; no pre-implementation RED is applicable. Next measure the two exact source files after this fifth test, then enforce file floors only below those fresh totals. The coverage probe and new focused result are local, not current-SHA CI evidence.

## Step 6 Cookie Jar exact-file floors — 2026-09-20 UTC

Source identity: committed `08f96dc0607ca26f00e7d6bf65d038febf9b6e39` in `/private/tmp/gg-test-floors-4ycn4M/repo`, with this plan's Shared config and Cookie Jar test files copied into the disposable checkout. No dependency install was performed. The live working copy at the same HEAD includes other sessions' uncommitted locale, garden-hook and Client work, which was left untouched.

| Exact Shared source file | Observed statements | Branches | Functions | Lines | New floors S/B/F/L |
|---|---:|---:|---:|---:|---|
| `src/hooks/cookie-jar/useCookieJarDeposit.ts` | 89.79% | 61.53% | 77.77% | 89.36% | 86/58/74/86 |
| `src/hooks/cookie-jar/useCampaignCookieJar.ts` | 41.74% (91/218) | 46.55% (81/174) | 36.73% (18/49) | 43.14% (85/197) | 38/43/33/39 |

Rendered `bun run check --plan -- --intent qa --changed packages/shared/vitest.config.ts,scripts/quality/workflow-performance-parity.test.mjs --json`: sensitive, ready. Selected format/lint by `automatic-hygiene`, validation-system-test by `direct-root-test:validation-system-test`, Shared typecheck/test and dependent Client/Admin tests plus Agent typecheck/test by surface. The selector stops dependent checks on a failed Shared test.

| Command | Actual result |
|---|---|
| Targeted `bun run test src/__tests__/hooks/cookie-jar/useCookieJarDeposit.test.ts src/__tests__/hooks/cookie-jar/useCampaignCookieJar.test.ts --coverage` in fixed checkout with coverage restricted to the two exact files | Passed: 2 files/9 tests. Deposit and campaign counters above. `/private/tmp/green-goods-cookie-jar-file-coverage-probe.log`. |
| `node scripts/dev/node-cli.js node --test scripts/quality/workflow-performance-parity.test.mjs` before config edit | RED: 31/32 passed; two exact files missing from parity. `/private/tmp/green-goods-cookie-jar-file-floors-red.log`. |
| Same parity command after config edit | GREEN: 32/32 passed; parity checks both exact files exist. `/private/tmp/green-goods-cookie-jar-file-floors-green.log`. |
| Targeted wrapper with deposit line floor deliberately raised to 100% in disposable config | All 9 tests passed, then Vitest exited 1: deposit lines 89.36% did not meet 100%. `/private/tmp/green-goods-cookie-jar-file-floor-fault.log`. |
| `bun run test --scope all-configured --coverage` in fixed checkout with proposed config | Passed: 498 files/5,319 tests; 2 files/17 tests skipped. Global S/B/F/L = 70.92/63.4/69.17/72.76%; both exact files cleared floors. `/private/tmp/green-goods-cookie-jar-file-floors-coverage-green.log`. |
| `PATH=/opt/homebrew/bin:$PATH bun run check -- --intent qa --changed packages/shared/vitest.config.ts,scripts/quality/workflow-performance-parity.test.mjs` in live checkout | Format, lint, validation-system-test 292/292 and Shared typecheck passed. Shared suite: 497 files/5,318 tests passed, one file/test failed, 2 files/17 tests skipped. The sole failure was locale-coverage's English fallback assertion for uncommitted `es` and `pt` `app.gardenIntro.domain.agroShort -> Agro`. Dependent Client/Admin/Agent checks stopped. `/private/tmp/green-goods-cookie-jar-file-floors-selected-live.log`. |

No global numerical threshold, test isolation setting, or September 22 architecture-hub checkpoint changed. This is local uncommitted proof; no current-SHA CI receipt exists. The live failure belongs to another session's catalog work and was not changed here. No runtime defect was exposed.

## Step 6 background connectivity proof — 2026-09-20 UTC

Source identity: uncommitted `develop` working copy at HEAD `08f96dc0607ca26f00e7d6bf65d038febf9b6e39`. This slice edited only `packages/shared/src/__tests__/stores/connectivity.test.ts`. The source store already offered a 60-second `confirmForBackgroundWork()` rule; the existing tests directly protected `confirmOnline()`'s 15-second rule but did not call the background method.

Two new cases call the real store with a fake origin response and clock. They prove reuse at 30 seconds, a new request after 60,001 milliseconds, and no extra request from the background path when the connection is degraded. The store's scheduled recovery remains owned by the existing degraded/recovery case. No runtime code or test was removed; no runtime defect was exposed.

Rendered `bun run check --plan -- --intent qa --changed packages/shared/src/__tests__/stores/connectivity.test.ts --json`: routine, ready; format/lint by `automatic-hygiene`, Shared test typecheck by `validation-only:shared:types`, and focused Shared test by `validation-only:shared:tests`. `PATH=/opt/homebrew/bin:$PATH bun run check -- --intent qa --changed packages/shared/src/__tests__/stores/connectivity.test.ts` passed all four selected checks, including 14/14 tests in one file. No pre-implementation RED applies to test-only proof of existing behavior. This is local evidence, without current-SHA CI.

## Step 6 queued-upload branches — 2026-09-20 UTC

Source identity: uncommitted `develop` working copy at HEAD `08f96dc0607ca26f00e7d6bf65d038febf9b6e39`. This slice edited only `packages/shared/src/__tests__/modules/work/upload-queued-work.test.ts`; the upload module and existing toast proof were untouched. Existing tests already covered ordinary ready filtering, embedded queue-retired continuation, send failure and wallet decline. The dated preparation report identified distinct missing branches for other-chain exclusion and embedded send cancellation.

Two added cases call the real `uploadQueuedWork` module through its existing port harness. A ready other-chain job stays out of the acquired IDs and `processJob` calls, while same-chain work sends. An embedded `send-cancelled` result yields `declined`, retains the earlier sent count and avoids a third send. No previous test was removed; no runtime defect was exposed.

Rendered `bun run check --plan -- --intent qa --changed packages/shared/src/__tests__/modules/work/upload-queued-work.test.ts --json`: routine, ready; format/lint by `automatic-hygiene`, Shared test typecheck by `validation-only:shared:types`, focused Shared test by `validation-only:shared:tests`.

| Command | Actual result |
|---|---|
| First `PATH=/opt/homebrew/bin:$PATH bun run check -- --intent qa --changed packages/shared/src/__tests__/modules/work/upload-queued-work.test.ts` | Format, lint and test typecheck passed; focused suite had 22 passed/1 failed because the test asserted calls on a non-spy `acquire`. No product failure was inferred. |
| Same selected command after `vi.spyOn(ports, "acquire")` in that case | All four selected checks passed; focused suite 1 file/23 tests. |

This is test-only proof of existing behavior, so pre-implementation RED is not applicable. The first failed run was a test assertion mistake, not a behavior RED. No current-SHA CI receipt exists.

## Step 6 image-compression proof and exact-file floor — 2026-09-20 UTC

The production `packages/shared/src/utils/work/image-compression.ts` has callers in work media processing and Admin's submit-work media controller. `packages/shared/src/__tests__/utils/compression.test.ts` covers the separate native stream utility. This slice added a direct image-compressor test file and one exact-file floor in Shared Vitest config plus parity. No runtime source or existing test was changed. The fixed-source measurement used committed `08f96dc0607ca26f00e7d6bf65d038febf9b6e39` in `/private/tmp/gg-test-floors-4ycn4M/repo`, with this plan's Shared config and tests copied in; no dependencies were installed. The live working copy at the same HEAD retains other sessions' uncommitted locale, garden-hook and Client work.

Three direct tests protect a compressed result with source-named progress, sequential fallback to the original after one file fails, and parallel completion out of input order while preserving both the original order and failed file. The prior fixed-source full Shared report had this exact file at S/B/F/L 3/0/0/3.29%. A focused probe with only the exact file included, using the repository `bun run test` wrapper and temporarily disabled thresholds in the disposable config, measured 71/100 statements (71%), 8/21 branches (38.09%), 12/17 functions (70.58%) and 66/91 lines (72.52%). The new minimums are S68/B35/F67/L69. A later complete Shared report measured identical exact-file counters and cleared those floors. The existing global minimums and the architecture hub's September 22 checkpoint were unchanged.

Rendered `bun run check --plan -- --intent qa --changed packages/shared/src/__tests__/utils/work/image-compression.test.ts --json`: routine, ready, selecting format/lint, Shared test typecheck and focused test. Rendered `bun run check --plan -- --intent qa --changed packages/shared/vitest.config.ts,scripts/quality/workflow-performance-parity.test.mjs --json`: sensitive, ready, selecting format/lint, validation-system-test, Shared typecheck/test and dependent Client/Admin tests plus Agent typecheck/test. The selector stops dependent checks after a failed Shared test.

| Command | Actual result |
|---|---|
| First selected QA for the new direct test | Stopped on Biome format for two line wraps. No later check was inferred. |
| `PATH=/opt/homebrew/bin:$PATH bun run check -- --intent qa --changed packages/shared/src/__tests__/utils/work/image-compression.test.ts` after formatting | Passed format, lint, Shared test typecheck and focused 1 file/3 tests. |
| `bun run test --scope all-configured src/__tests__/utils/work/image-compression.test.ts --coverage` in fixed checkout with an exact-file include and zero temporary thresholds | Passed 1 file/3 tests; exact counters above. `/private/tmp/green-goods-image-compression-coverage-probe.log`. |
| `node scripts/dev/node-cli.js node --test scripts/quality/workflow-performance-parity.test.mjs` before and after the config edit | RED 31/32, then GREEN 32/32. `/private/tmp/green-goods-image-compression-floor-red.log` and `/private/tmp/green-goods-image-compression-floor-green.log`. |
| `bun run test --scope all-configured --coverage` in fixed checkout with the proposed config and current plan tests | Passed 499 files/5,326 tests, 2 files/17 tests skipped. Global S/B/F/L = 71.18/63.47/69.37/73.02%; the exact compressor file cleared its floor. `/private/tmp/green-goods-image-compression-full-coverage-08f.log`. |
| `PATH=/opt/homebrew/bin:$PATH bun run check -- --intent qa --changed packages/shared/vitest.config.ts,scripts/quality/workflow-performance-parity.test.mjs` in live checkout | Format, lint, validation-system-test 292/292 and Shared typecheck passed. Shared suite: 498 files/5,325 tests passed, one file/test failed, 2 files/17 tests skipped. Sole failure: uncommitted Spanish/Portuguese `app.gardenIntro.domain.agroShort -> Agro` entries failed locale coverage. Dependent Client/Admin/Agent checks stopped. `/private/tmp/green-goods-image-compression-selected-live.log`. |

No pre-implementation RED applies to the test-only direct proof; the parity test records RED/GREEN for the config behavior. No runtime defect was exposed. No current-SHA CI receipt exists.

## Step 6 login-message direct proof — 2026-09-20 UTC

Source identity: uncommitted `develop` working copy at HEAD `08f96dc0607ca26f00e7d6bf65d038febf9b6e39`. This slice edited only `packages/shared/src/__tests__/hooks/loginScreenMessages.test.ts`. The existing two direct cases distinguish a wrapped unavailable passkey from an ordinary `NotAllowedError` cancellation. The production controller calls both `getFriendlyLoginErrorMessage` and `getBrowserGuidanceLabel`.

Added a three-case error table for account mismatch, network failure and unknown failure, plus two in-app browser guidance cases: Android with a handoff URL points to Chrome; iOS without one asks for a Safari copy. No prior test or runtime source changed, and no runtime defect was exposed.

Rendered `bun run check --plan -- --intent qa --changed packages/shared/src/__tests__/hooks/loginScreenMessages.test.ts --json`: routine, ready; format/lint by `automatic-hygiene`, Shared test typecheck by `validation-only:shared:types`, and focused Shared test by `validation-only:shared:tests`. `PATH=/opt/homebrew/bin:$PATH bun run check -- --intent qa --changed packages/shared/src/__tests__/hooks/loginScreenMessages.test.ts` passed all four selected checks, including 1 file/7 tests. This is test-only proof of existing behavior, so pre-implementation RED is not applicable. No current-SHA CI receipt exists.

## Step 6 timeframe boundary proof — 2026-09-20 UTC

Source identity: uncommitted `develop` working copy at HEAD `08f96dc0607ca26f00e7d6bf65d038febf9b6e39`. This slice edited only `packages/shared/src/__tests__/lib/hypercerts/validation.test.ts`. The existing schema tests already covered a later end, negative timestamps and an indefinite end (`end = 0`). The single indefinite case was folded into a three-row boundary table that also accepts equal start/end and rejects a reversed range. No prior behavioral proof or runtime source was removed, and no runtime defect was exposed.

Rendered `bun run check --plan -- --intent qa --changed packages/shared/src/__tests__/lib/hypercerts/validation.test.ts --json`: routine, ready; format/lint by `automatic-hygiene`, Shared test typecheck by `validation-only:shared:types`, focused Shared test by `validation-only:shared:tests`. `PATH=/opt/homebrew/bin:$PATH bun run check -- --intent qa --changed packages/shared/src/__tests__/lib/hypercerts/validation.test.ts` passed all selected checks, including 1 file/58 tests. Biome checked zero files for format/lint because this path is outside its configured set; strict test typecheck and the focused suite ran. Test-only proof has no pre-implementation RED. No current-SHA CI receipt exists.

## Step 7 Admin excessive-withdrawal proof — 2026-09-20 UTC

Source identity: uncommitted `develop` working copy at HEAD `08f96dc0607ca26f00e7d6bf65d038febf9b6e39`. The Admin `WithdrawModal.tsx` source and its test were clean before this slice. Existing tests proved Max for a tiny balance and conversion of a valid typed amount, while asserting no excessive-balance error only in the valid case. This slice added one rejection case and hoisted the two repeated vault fixtures into one typed local constant. It asserts visible error text, a disabled Withdraw action, and zero mutation calls. No runtime source or prior behavioral test was removed, and no runtime defect was exposed.

Rendered `bun run check --plan -- --intent qa --changed packages/admin/src/__tests__/components/WithdrawModal.test.tsx --json`: routine, ready; format/lint by `automatic-hygiene`, Admin test typecheck by `validation-only:admin:types`, focused Admin test by `validation-only:admin:tests`. `PATH=/opt/homebrew/bin:$PATH bun run check -- --intent qa --changed packages/admin/src/__tests__/components/WithdrawModal.test.tsx` passed all four selected checks, including 1 file/3 tests. No pre-implementation RED applies to test-only proof of existing behavior. No authenticated browser claim is made from this component test and no current-SHA CI receipt exists.

Read-only `gh pr view 802` and `gh pr view 795` attempts both failed to connect to `api.github.com`; direct GitHub-page web reads also failed. The earlier successful open-PR overlap check remains dated preparation evidence, not a fresh PR-head assertion. CookieJarTab remains untouched.

## Step 7 Client claim-confirmation proof — 2026-09-20 UTC

Source identity: uncommitted `develop` working copy at HEAD `08f96dc0607ca26f00e7d6bf65d038febf9b6e39`. The current `packages/client/src/__tests__/views/CookieJarTab.test.tsx` and production WalletSheet component were clean before this slice. The cached September 19 #802 head `c825265a9698652f79b283d22f93527feb9b88d5` was available as a local Git object. Its older WalletDrawer-path test also stubbed ConfirmDialog as an empty element and had no claim mutation assertion. This is dated overlap evidence only: both fresh `gh` reads and direct web pages failed, so #802's current head/status is unknown.

The test stub now exposes its supplied close/confirm callbacks through two buttons. One new case expands a jar, selects Max (100,000 units at six decimals), enters a purpose, opens confirmation and checks no mutation; cancellation also causes no mutation; a second open/confirm invokes the hook mutation with the exact jar address, amount and purpose. This protects current tab wiring without pretending to test the real dialog's rendering. No runtime source or prior test was removed; no runtime defect was exposed.

Rendered `bun run check --plan -- --intent qa --changed packages/client/src/__tests__/views/CookieJarTab.test.tsx --json`: routine, ready; format/lint by `automatic-hygiene`, Client test typecheck by `validation-only:client:types`, focused Client test by `validation-only:client:tests`, staged-modules by `client:staged-boundary`. `PATH=/opt/homebrew/bin:$PATH bun run check -- --intent qa --changed packages/client/src/__tests__/views/CookieJarTab.test.tsx` passed all five selected checks, including 1 file/15 tests and seven staged modules isolated. Test-only proof has no pre-implementation RED; no current-SHA CI or authenticated browser claim exists.

## Step 7 Client garden-join proof — 2026-09-20 UTC

Source identity: uncommitted `develop` working copy at HEAD `08f96dc0607ca26f00e7d6bf65d038febf9b6e39`. The existing `packages/client/src/__tests__/views/GardensList.test.tsx` and production Profile view were clean before this slice. Its first-join success case previously resolved `joinGarden` for a delayed discovery toast but did not assert the chosen garden argument; no rejection case guarded the failure outcome. The success case now asserts the exact `0xfresh` argument. One new case rejects that join and asserts the error toast receives the thrown error, no success toast or discovery timer fires, and the dialog closes. No prior test or runtime source was removed; no runtime defect was exposed.

Rendered `bun run check --plan -- --intent qa --changed packages/client/src/__tests__/views/GardensList.test.tsx --json`: routine, ready; format/lint by `automatic-hygiene`, Client test typecheck by `validation-only:client:types`, focused Client test by `validation-only:client:tests`, staged-modules by `client:staged-boundary`. `PATH=/opt/homebrew/bin:$PATH bun run check -- --intent qa --changed packages/client/src/__tests__/views/GardensList.test.tsx` passed all five selected checks, including 1 file/13 tests and seven staged modules isolated. Test-only proof has no pre-implementation RED. No current-SHA CI or authenticated browser claim exists.

## Step 8 first helper conversion — 2026-09-20 UTC

Source: uncommitted `develop` at baseline HEAD `08f96dc0607ca26f00e7d6bf65d038febf9b6e39`. The one-case `usePublicImpactEvidence.test.ts` retained its exact test name and assertions. Its local `QueryClientProvider` wrapper became `renderHookWithQueryClient` in `test-utils/query-client-render.ts`, using `createTestQueryClient`; the helper adds no Intl or other providers. It is re-exported from the existing test-utils barrel, while this test imports the narrow module directly. The old client set `retry: false, gcTime: 0`; the shared client additionally sets `staleTime: 0` and mutation retry false. This hook sets its own stale time and performs no mutation. No product source or test was removed.

Rendered `bun run check --plan -- --intent qa --changed packages/shared/src/__tests__/hooks/public/usePublicImpactEvidence.test.ts,packages/shared/src/__tests__/test-utils/index.ts,packages/shared/src/__tests__/test-utils/query-client-render.ts --json`: format, lint, Shared test typecheck and focused test. `PATH=/opt/homebrew/bin:$PATH bun run check -- --intent qa --changed packages/shared/src/__tests__/hooks/public/usePublicImpactEvidence.test.ts,packages/shared/src/__tests__/test-utils/index.ts,packages/shared/src/__tests__/test-utils/query-client-render.ts` passed all selected checks, including 1/1 focused test. Before: `bun run test src/__tests__/hooks/public/usePublicImpactEvidence.test.ts --reporter verbose` passed 1/1, import 319 ms, `/private/tmp/green-goods-impact-helper-before.log`. After: the same command passed 1/1, import 378 ms, `/private/tmp/green-goods-impact-helper-query-only-after.log`. Single runs are not a performance comparison. The broad-barrel trial passed but took 6.43 seconds to import; it was discarded before this reviewed version. No current-SHA CI receipt exists.

## Step 8 bounded Shared helper batch and guard — 2026-09-20 UTC

Source: uncommitted `develop` at HEAD `08f96dc0607ca26f00e7d6bf65d038febf9b6e39`. The clean `usePublicCommitmentImpact.test.ts` ran before conversion with 3/3 named cases, duration 2.55 s and import 333 ms. After replacing its local query-only client/wrapper with `createTestQueryClient` and `renderHookWithQueryClient`, the rendered QA plan selected format, lint, Shared test typecheck and the focused test; all passed, 3/3, duration 1.90 s and import 253 ms. These are single runs, not a controlled speed comparison. The old client specified query retry false and gcTime zero; the shared client additionally disables mutation retries and sets staleTime zero. This test performs no mutation and its hook owns its stale time. No test name, assertion or runtime file changed.

The new `scripts/quality/check-test-query-setup.mjs` is called by the existing `check-test-quality.sh` CI route and listed in scripts/README.md. It checks added local `createWrapper` declarations and `new QueryClient` constructions in Shared/Client/Admin test files, with a nearby `TEST-QUALITY: allow-local-query-setup - reason` exception. The existing validation-system parity suite contains two guard fixtures for added declarations, new files and exceptions. The rendered QA plan for the helper, guard, test-quality shell, parity test and README selected format, lint, validation-system-test, Shared test typecheck and focused test; all passed, with validation-system 294/294 and the focused hook 3/3. `bun run check --only test-quality` initially failed on this plan's new Cookie Jar deposit test client at line 77; after documenting its exact-client invalidation spy and blank Intl provider exception, it passed all six checks. The separately rendered QA plan for that comment passed format/lint/typecheck and the focused Cookie Jar test 5/5. No existing test was deleted. Further helper rollout remains open, and no current-SHA CI exists.

## Performance and coverage

For adopting shards, collect at least three comparable unsharded and three sharded runs at equivalent code/toolchain/configuration. State cache/runner differences. The September 19 reference is one run, not p50 or exact-current-head proof. Report test-step, job and critical-path time separately. Worker setup/import/environment buckets are aggregate time and cannot be added into wall time.

Refresh coverage before enforcing floors. Nightly directory rows are starting evidence, not necessarily recursive-glob totals. Global thresholds remain unchanged; measured glob and exact-file floors are recorded above. Item 6a remains deferred: three comparable CI runs each way, no new failures and explicit selection before disabling isolation.

## Snapshot and closeout

Snapshot 06 follows selected merges. Recover the original measurement/fault methods where possible; otherwise describe a new panel and do not claim like-for-like fault-score improvement. Record skips, superseded targets and deferred isolation. External republishing requires authorization.

Implementation handoffs record tested SHA, UTC time, exact commands, validated paths, clean path-scoped worktree identity, results and remaining manual evidence. Use required RED/GREEN proof for changed behavior; use not_applicable with a reason for pure test/documentation refactors. Current-head CI is required for readiness. Close through the existing plan-skill procedure after delivery; give unresolved obligations explicit destinations.
