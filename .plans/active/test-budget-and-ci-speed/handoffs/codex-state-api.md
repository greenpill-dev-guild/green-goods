# Reduce test maintenance and improve validation feedback - State/API Handoff

## Lane

- Owner: Codex
- Branch: `develop` (unchanged)
- Status: steps 1–2 and 4 locally implemented; steps 3 and 5 have bounded local implementation with wider acceptance pending; step 6 direct behavior proof is next; lane remains in progress

## Scope

- Step 1 added the test budget to `.claude/context/testing.md`, an excess-proof review lens to `.claude/skills/review/SKILL.md`, and one pointer in `AGENTS.md`.
- Step 2 implements the selected ordinary-push policy in the selector and local runner. Authenticated browser proof remains pending for readiness, while failed or unavailable automated checks and strict/critical gates still block.
- Step 3 adds two Shared CI test shards through the package wrapper, requires both successful named jobs in CI Gate, and leaves nightly coverage unsharded. Green current-SHA CI and controlled performance comparison remain pending.
- Step 4 adds a non-blocking source/test churn and file-count summary in the existing Supply Chain Guardrails workflow; no ratio threshold or required check was added.
- Step 5 adds measured aggregate Shared floors for work, job queue, auth hooks and vault hooks, Client floors for WalletSheet and Profile, and Admin floors for Vault and Garden Pool. Near-zero paths remain paired with later proof. Global floors and the architecture hub's September 22 checkpoint were not changed.
- Step 6's first Shared slice adds four direct tests for the Cookie Jar deposit hook: missing account, insufficient balance, adequate allowance, and approve-before-deposit success with invalidation. Campaign proof and a measured Cookie Jar floor remain next.
- Step 6's campaign slice retains the committed chain-read and metadata fallback tests, makes the disconnected fixture real, and adds connected eligibility plus partial detail-read failure proof. Complete-source Cookie Jar coverage is next.
- Step 6's campaign-deposit case reuses the deposit test setup to protect the campaign-specific member refresh. A complete fixed-source Shared coverage probe passed before this fifth case and showed the campaign source file remains far less covered than the ordinary deposit file; exact-file floors are next.
- Step 6 now has measured exact-file floors for regular and campaign Cookie Jar hooks, with parity and threshold-failure proof. Full fixed-source Shared coverage passed with both floors. Global floors and the architecture checkpoint remain unchanged.
- Step 6 adds direct background-work connectivity proof for the 60-second re-probe rule and degraded-state deferral. No runtime source changed.
- Step 6 adds direct queued-upload proof for other-chain exclusion and embedded send cancellation, retaining the flagged-upload toast case.
- Step 6 adds direct image-compressor proof and a measured exact-file floor after a fixed-source full coverage run. Native stream compression tests remain separate.
- Step 6 extends login-message proof for account mismatch, network/generic errors and platform-specific in-app browser guidance while retaining existing passkey cases.
- Step 6 completes its selected Shared subjects with equal/reversed timeframe schema boundaries beside the existing indefinite case. No runtime source was changed in step 6.
- Step 7 begins with Admin excessive-withdrawal rejection/no-mutation proof; the previous valid cases now share one local vault fixture.
- Step 7 adds Client CookieJarTab confirmation wiring proof after comparing the current clean file with the cached dated #802 head; fresh PR state remains unknown.
- Step 7 completes its local direct-proof subjects with Client garden-join argument and rejected-join outcome checks.
- Step 8's first helper candidate passed review: query-only provider, fresh client, identical test name and result. Broad barrel import was discarded after an observed slowdown.
- Step 8's bounded Shared batch now covers `usePublicImpactEvidence` and `usePublicCommitmentImpact`. The diff-aware guard is wired into test-quality with one documented Cookie Jar exact-client exception. Further package batches remain.

## TDD Proof

- Step 1 documentation: RED/GREEN not applicable.
- Step 2 tooling: RED 110/113, then GREEN 114/114 with `node scripts/dev/node-cli.js node --test scripts/quality/select-validation.test.mjs scripts/dev/ci-local.test.mjs`. The Plan Hub `state_api` TDD record contains both commands and evidence paths.
- Step 2 review guard: RED 37/38 in `ci-local.test.mjs` for a browser check blocked by `dependencies`, then GREEN 114/114 across the focused browser-policy suites. Deferral now accepts only `authenticatedBrave` blockers. The disposable unchanged pre-push hook passed again with this selector, leaving manual proof pending.
- Step 3 tooling: RED 59/63, then GREEN 63/63 with `node scripts/dev/node-cli.js node --test scripts/dev/package-commands.test.mjs scripts/quality/ci-gate.test.mjs scripts/quality/workflow-performance-parity.test.mjs`. The proof remains in eval.md.
- Step 3 parser guard: RED 8/9 because Indexer silently accepted Shared-only `--shard`, then GREEN 65/65 across wrapper, CI Gate and workflow parity tests after explicit rejection.
- Step 4 tooling: RED 28/30, then GREEN 31/31 with `node scripts/dev/node-cli.js node --test scripts/quality/summarize-test-churn.test.mjs scripts/quality/workflow-performance-parity.test.mjs`. The latest Plan Hub `state_api` TDD record contains this command; earlier slices remain in eval.md.
- Step 5 Shared floors: RED 29/30, then GREEN 30/30 with `node scripts/dev/node-cli.js node --test scripts/quality/workflow-performance-parity.test.mjs`. A separate 100% auth-hook floor fixture produced a threshold exit 1 after nine passing tests; full baseline coverage with proposed floors exited 0. The proof remains in eval.md.
- Step 5 Client floors: RED 30/31, then GREEN 31/31 with the same parity command. Fixed-SHA full Client coverage with proposed floors exited 0 after 140 files and 1,290 tests passed. The proof remains in eval.md.
- Step 5 Admin floors: RED 31/32, then GREEN 32/32 with the same parity command. Full Admin coverage in the normal checkout exited 0 after 114 files and 863 tests passed; protected glob totals matched the fixed-SHA baseline. The Plan Hub TDD record now points to this latest pair; prior RED/GREEN evidence remains in eval.md.
- Step 6 deposit is test-only proof of existing behavior; no pre-implementation RED is applicable. The focused test passed 4/4, and the selected format, lint, Shared test typecheck and focused test passed after one formatting correction. The latest Plan Hub TDD record remains the Admin tooling change; deposit evidence is in eval.md.
- Step 6 campaign is also test-only proof of existing behavior; no pre-implementation RED is applicable. The focused test and all selected checks passed. The latest Plan Hub TDD record remains the Admin tooling change; campaign evidence is in eval.md.
- Step 6 campaign deposit is test-only proof of existing behavior; no pre-implementation RED is applicable. Focused 5/5 and all selected checks passed. The latest Plan Hub TDD record remains the Admin tooling change; the exact coverage probe and fifth-test evidence are in eval.md.
- Cookie Jar floor tooling: parity RED 31/32 before the two exact files were added, then GREEN 32/32 after. A deliberate 100% line floor failed after all 9 targeted tests passed; fixed-source full Shared coverage passed 498 files/5,319 tests with the proposed floors. Exact commands and logs are in eval.md.

## Validation

- The rendered diagnose plan selected `validation-system-test`, `test-quality`, and `agent-guidance` for the changed paths.
- `bun run check --only agent-guidance` passed: Codex consistency, 15 skill behavior scenarios and 15 task routes, and 61 guidance files.
- `bun run check --only guidance-links` passed: 61 guidance files.
- `bun run check --only test-quality` passed: all five checks, with zero direct-test seam violations.
- `bun run check --only validation-system-test` failed twice: 280 of 281 tests passed. The unchanged `scripts/lib/dev-shared.js` list omits `GIT_INTERNAL_SUPER_PREFIX`, which this machine's Git reports through `git rev-parse --local-env-vars`. No tooling fix was made in this slice.
- Step 2's rendered QA plan selected format, lint, and validation-system-test for its changed paths. Format and lint passed. The selected suite failed on the same unchanged Git-variable case: 284/285 passed.
- Direct ordinary-push runner simulation passed, including focused Client test 15/15, and reported manual browser proof pending. Actual unchanged `.husky/pre-push` exited 0 in a disposable clone with a focused Client source/test edit, again leaving browser proof pending. See `eval.md` for commands, logs, and fixture limits.
- Step 3's selected format/lint and validation-system-test passed 288/288 with command-scoped Homebrew Git 2.55; default Apple Git failed 287/288 on the unchanged Git-variable case. Both Shared shards and unsharded suite covered identical files/tests, but shard 2 and unsharded both failed one locale-coverage assertion from another session's uncommitted `Agro` catalog entries. See eval.md for counts and timings.
- Step 4's selected format/lint and validation-system-test passed 289/289 with command-scoped Homebrew Git 2.55; default Apple Git failed 288/289 on the same unchanged case. The summary script wrote an 11-line disposable GitHub step-summary fixture; focused summary/parity tests passed 31/31.
- Step 5 full Shared coverage with proposed floors passed in a disposable checkout with committed Shared source at `7f0d81f`: 497 files and 5,311 tests passed, 2 files and 17 tests skipped; all four measured globs cleared their floors. Live selected format, lint, validation-system-test 290/290, and Shared typecheck passed; Shared test stopped on the other session's one locale assertion, before Client/Admin/Agent checks. Exact commands and numbers are in eval.md.
- The tightened step 2 hook fixture passed again: validation-system-test 285/285 and focused Client test 15/15, with manual browser proof still pending. Step 3's Indexer parser guard passed focused 65/65 and selected format/lint. See eval.md for commands, logs and fixture limits.
- Step 5 Client baseline and floor runs passed 140 files/1,290 tests on fixed committed source at `08f96dc`; the first sandbox run failed Vite watch loopback with `EPERM`, then local-loopback access enabled full proof. Live selected format/lint, validation-system-test 291/291 and Client test 140 files/1,292 tests passed. Two extra tests came from another session's uncommitted Client work.
- Step 5 Admin fixed-source baseline passed 114 files/863 tests. The copied-config rerun in that scratch checkout failed a Vite `/@fs/` import through symlinked dependencies, and isolated execution reproduced it. The normal live checkout passed full Admin coverage 114/863 with unchanged protected glob totals; live selected format/lint, validation-system-test 292/292 and Admin test 114/863 passed. Exact commands and counts are in eval.md.
- Step 6 deposit focused Shared test passed 4/4; selected format, lint, Shared test typecheck and focused test passed. The first selected run stopped on one Biome formatting request, which was corrected before the passing run. No runtime file or prior test changed.
- Step 6 campaign focused Shared test passed 4/4; selected format, lint, Shared test typecheck and focused test passed. The previous disconnected fixture was corrected without removing its test, and two distinct cases were added. No runtime file changed.
- The fixed-source Shared coverage probe with four new deposit tests and two new campaign read tests passed 498 files/5,318 tests, with two files/17 tests skipped. A fifth campaign-deposit test then passed focused 5/5 and selected format, lint, Shared test typecheck and focused test. No runtime file changed.
- The Cookie Jar exact-file floor slice passed focused parity 32/32, deliberate below-floor enforcement, and fixed-source full Shared coverage 498 files/5,319 tests. Live selected format, lint, validation-system 292/292 and Shared typecheck passed, then Shared suite stopped at one other session `Agro` locale assertion (497 files/5,318 tests passed). Dependent checks did not run.
- The connectivity slice passed selected format, lint, Shared test typecheck and focused store tests 14/14. It adds two cases without deleting existing proof. Exact command and source identity are in eval.md.
- The queued-upload slice passed selected format, lint, Shared test typecheck and focused upload-all tests 23/23 after correcting an initial non-spy assertion. It adds two cases without deleting existing proof; exact command and source identity are in eval.md.
- The image-compression slice passed focused 3/3, parity RED 31/32 to GREEN 32/32, and fixed-source full Shared coverage 499 files/5,326 tests with an exact-file floor. Live selected format, lint, validation-system 292/292 and Shared typecheck passed; Shared stopped on one other-session `Agro` locale assertion after 498 files/5,325 tests passed. Dependent checks did not run. Exact commands are in eval.md.
- The login-message slice passed selected format, lint, Shared test typecheck and focused 7/7 tests. It adds five cases without deleting existing proof. Exact command and source identity are in eval.md.
- The timeframe slice passed selected format/lint (Biome checked zero ignored files), Shared test typecheck and focused 58/58 tests. It expands the existing indefinite case into a three-row boundary table. Exact command and source identity are in eval.md.
- The Admin withdrawal slice passed selected format, lint, Admin test typecheck and focused 3/3 tests. It adds one rejection case without deleting behavioral proof. Exact command and source identity are in eval.md.
- The Client claim slice passed selected format, lint, Client test typecheck, focused 15/15 tests and staged-module isolation. The new case distinguishes open/cancel from confirm and asserts exact mutation arguments. Exact command and PR evidence limits are in eval.md.
- The Client garden-join slice passed selected format, lint, Client test typecheck, focused 13/13 tests and staged-module isolation. It strengthens a success case and adds one rejection case. Exact command and source identity are in eval.md.
- The first helper conversion passed selected format/lint/Shared test typecheck and focused 1/1. Before and after verbose runs passed the identical test name. Exact paths, commands, provider differences and single-run import timings are in eval.md.
- The second helper conversion passed the original three named tests before and after. Selected format/lint/validation-system 294/294/Shared typecheck/focused 3/3 passed. Test-quality first found the new Cookie Jar exact-client exception, then passed with its reasoned comment; its selected focused test passed 5/5. The guard and exception details are in eval.md.

## Validation Receipt

- Proof source: local working copy at baseline HEAD `08f96dc0607ca26f00e7d6bf65d038febf9b6e39` before the authorized commit. Read the current commit with `git log -1` after this handoff; no current-commit CI receipt is claimed.
- Baseline HEAD: `7f0d81f670b884608b122db2c21a032def852812`.
- Later shared-checkout HEAD: `08f96dc0607ca26f00e7d6bf65d038febf9b6e39`, advanced by other sessions after the Shared measurements; this is not a tested implementation SHA. The intervening Shared source changes are in Cookie Jar, outside the four measured globs.
- Run at (UTC): step 1 between 2026-09-19 23:13 and 23:18; step 2 through 2026-09-20 00:42; step 3 through 2026-09-20 01:03; step 4 through 2026-09-20 01:11; step 5 Shared floor runs later on 2026-09-20 UTC.
- Exact commands and results: listed in the Validation section above and `eval.md`.
- Validated paths: step 1 guidance and this Plan Hub; step 2 selector, local runner, tests and validation-pipeline guidance; step 3 Shared workflow, package wrapper, CI Gate and tests; step 4 Supply Chain workflow, summary script/test, workflow parity and scripts README; step 5 `packages/shared/vitest.config.ts` and `scripts/quality/workflow-performance-parity.test.mjs` against committed Shared source in a disposable checkout plus the live selected QA plan.
- Worktree identity: changed guidance and a backlog-to-active hub move; no clean path-scoped commit receipt is claimed.
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- The selected validation-system check remains failed on the separately identified Git-variable defect.
- Authenticated browser proof is still owed at readiness; the fixture did not supply that proof.
- Step 3's green shards, three comparable CI runs and current-SHA CI Gate are pending publication authorization and resolution of another session's locale test failure. Preserve that session's locale files and Client edits.
- Steps 6–7 local proof and step 8's first bounded Shared helper batch and guard review are complete. Further helper expansion, then settlement/store and consolidation slices remain. Cached dated #802 did not contain the claim proof, but fresh #802/#795 status and heads remain network-unverified. Step 3's current-SHA CI timings and step 5's current-SHA CI enforcement remain pending publication authorization. The architecture hub retains the September 22 two-point checkpoint; in-flight Client and Shared locale edits belong to another session.
