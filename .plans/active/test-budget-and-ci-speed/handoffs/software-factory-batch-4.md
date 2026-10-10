# Software Factory fourth batch — browser qualification and live hooks

SF03 now meets local acceptance: the full Admin browser project passes **12 cases, with one
declared fork-only skip and zero retries**. SF10's Codex session and pre/post-edit hook loading
are observed; Claude Desktop Code remains pending. Afo selected this batch after the SF03/SF10
recommendation. No runtime, dependency, permissions, hook configuration or CI workflow changed.

## Repair and investigation

The first focused run passed both route/recovery scenarios before any code edit. Its trace
showed real Create Garden, Create Assessment, Community/empty-vault and Create Hypercert
content. The previous failed screenshot shows React Router's `HydrationFallback`, not the
initial `AdminBootShell`. The earlier timeout did not reproduce, so this batch does not claim
its cause was identified or repaired. Global setup's earlier boot observation is not proof that
every lazy route has finished loading; the scenario assertions still own route qualification.

The full-project RED run exposed a different, concrete failure. Admin's smoke indexer returned
garden `0x1234567890123456789012345678901234567890`, while `mockSepoliaRpc(page)` silently selected
the default Client fixture garden. The app's valid `token()` read (`0xfc0c546a`) to the smoke
garden therefore failed the strict RPC allowlist. The browser had already rendered the Hub and
its work queue; this was a fixture identity mismatch, not a product routing defect.

The only code change passes `MOCK_GARDENS[0]` into that existing RPC mock. No generic success
fallback, timeout increase or retry was added. The existing integration test supplies meaningful
RED/GREEN proof; a second unit test copying this one argument would add no useful coverage.
The sibling search covered every `mockSepoliaRpc` call under `tests/`: the shared backend already
passes its scenario garden; the direct fixture tests intentionally select default/custom gardens;
Admin auth exercises the default registry/auth fixture rather than a separate indexer garden.
The smoke spec's older permissive GraphQL branches were not redesigned in this bounded repair.

## Verification receipt

Working-copy evidence on `develop`, based on
`c4a9487350c6739de54bcc2737dd2a972223243f`. The checkout contains earlier batches and other
sessions' application/Docs work. This is not a committed or current-head CI receipt.

| Run | UTC start | Result |
|---|---|---|
| Focused production flows, before code edit | 2026-10-05 04:59:50 | 2 passed, zero retries; 58.82 seconds |
| Full Admin RED | 2026-10-05 05:01:53 | 8 passed, 1 failed, 1 declared skip, 3 later serial cases not run; 114.37 seconds |
| Full Admin GREEN after fixture repair | 2026-10-05 05:04:53 | 12 passed, 1 declared skip, zero failures/retries; 131.60 seconds |

The remaining declared skip belongs to real wagmi wrong-network coverage in the fork project;
this clean-room mock-auth run does not certify it. The RED reporter totals four skips: one
explicit skip and three tests not run after their serial predecessor failed. They are not four
independent coverage exemptions.

Exact browser commands:

```sh
CI=true SKIP_INDEXER=true PLAYWRIGHT_APP=admin APP_ENV=test VITE_CHAIN_ID=11155111 PLAYWRIGHT_JSON_OUTPUT_FILE=/tmp/green-goods-sf4-admin-red.json bun x playwright test tests/specs/admin.production-flows.ci.spec.ts --project=admin-ci --workers=1 --retries=0 --reporter=line,json --trace=on --output=/tmp/green-goods-sf4-admin-red
CI=true SKIP_INDEXER=true PLAYWRIGHT_APP=admin APP_ENV=test VITE_CHAIN_ID=11155111 PLAYWRIGHT_JSON_OUTPUT_FILE=/tmp/green-goods-sf4-admin-full.json bun x playwright test --project=admin-ci --workers=2 --retries=0 --reporter=line,json --trace=retain-on-failure --output=/tmp/green-goods-sf4-admin-full
CI=true SKIP_INDEXER=true PLAYWRIGHT_APP=admin APP_ENV=test VITE_CHAIN_ID=11155111 PLAYWRIGHT_JSON_OUTPUT_FILE=/tmp/green-goods-sf4-admin-green.json bun x playwright test --project=admin-ci --workers=2 --retries=0 --reporter=line,json --trace=retain-on-failure --output=/tmp/green-goods-sf4-admin-green
```

Despite its diagnostic filename, the focused `admin-red` run passed. Only `admin-full` supplies
the failing integration evidence. Tests ran on the normal port 3002 after `dev status` showed
it free; Playwright owned startup and cleanup. The external Docs server was left untouched.

The QA selector for `tests/specs/admin.smoke.spec.ts` selects format/lint only, without critical
overrides. `node scripts/dev/ci-local.js --intent qa --changed tests/specs/admin.smoke.spec.ts`
passes both checks. Format checks one file; selected Biome lint checks zero because of existing
exclusions. Supplemental `bun x oxlint tests/specs/admin.smoke.spec.ts --allow no-console
--deny-warnings` passes and covers the authored file. The full browser project above supplies
the behavioral evidence. Application suites/builds were not rerun for this one-line test repair.

The final source manifest at **2026-10-05 05:07:56 UTC** is
`sha256:e308d6a7a31a0ae071849e213904e1143e31f12f461203b1ce8b75b4657f6a7c` in
`/tmp/green-goods-sf4-final-source.json`. It hashes a sorted path-to-file-SHA256 mapping over the
Admin, Shared, scripts, tests, root manifest/lockfile and Playwright configuration. It includes
unrelated active source; it is an evidence identity, not task ownership or a CI receipt.

Rendered proof: **CI Playwright, clean-room Chromium with mock auth**. The inspected
`/tmp/green-goods-sf4-validation-recovery.png` shows corrected name, location and description,
with the deliberate short-slug/domain errors still present. The scenario also verifies cancel
returns to the garden. Browser logs/traces stay outside Git. They include nonfatal external
service/indexer fetch errors in older auth/smoke scenarios; a passing run does not assert those
services succeeded or that every existing mock is strict. No real wallet signing or authenticated
Brave/installed-PWA proof is claimed.

## Live hooks and pilot ownership

The actual Codex app conversation received the `Green Goods Codex context:` developer message
matching `.codex/hooks/session_context.sh`. Real manifest edits in the third batch emitted the
registered pre-edit and post-edit context messages naming the touched path and the configuration
validation obligation. These observations came from the host around real work, not direct script
invocation or synthetic events. They prove only SessionStart context and PreToolUse/PostToolUse
edit context loaded in this session. Startup/resume/compact subtype, Stop, restricted-command
blocking, Linear hooks, other worktrees and model compliance remain unverified by this observation.

The existing architecture hub records this evidence in its `eval.md`; historical certification
and lane proof are preserved. Its bug-fix pilot row now records this normally authorized repair.
Four task categories remain pending. The user was asked for Claude Desktop Code observation;
none had arrived at handoff, so SF10 stays open. No duplicate pilot, billed simulation, harness
change or worktree repair was introduced.

## Plan validation and remaining work

Guidance links pass across 77 files; immutable-report checks pass. All 54 local Markdown file
references in the edited plan documents resolve, status JSON parses, and `git diff --check`
passes. The final source manifest was rechecked without drift. The read-only `linear-sync`
manifests retain parent-only visibility (missing parent for this hub, PRD-835 for architecture).
No Linear write occurred. `record-tdd` preserves this batch's integration RED/GREEN; overall
hub/lane state remains active for the remaining slices.

Full `plan-hub validate` still fails because the unrelated in-progress
`.plans/active/agent-messaging-channels` directory lacks `status.json`. It was not edited.
No commit, branch change, push, PR, deployment, external message or routine dispatch occurred.
SF07/SF08 exploration and publication remain later checkpoints. The earlier readiness timeout
remains a recorded diagnostic limit even though the current complete Admin project passes.
