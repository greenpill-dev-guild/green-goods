# UI Lane

Owner: Codex. Branch: `release/october-2-0-0`. The user-directed action-bar refinement has provisional focused and rendered proof; current-commit validation is pending. Release publication remains blocked.

Requester entry is in the no-access state and Profile. It opens the existing AdminDialog, chooses a known operational garden, reviews the primary account and optional note, then explicitly signs a request. Status checks, withdrawal, changing garden and confirmed/declined/error outcomes are available. Account, chain and authentication changes clear private drafts and close the dialog. The request target stays in account-scoped memory; it does not activate an inaccessible workspace.

The Community queue separates membership and stewardship. A steward request invokes the existing steward assignment, then resolves only after success. Failed or cancelled assignments never start the resolution signature; unknown outcomes provide recovery guidance.

TDD: queue RED at 2026-10-08T07:06:43Z: 4 failed / 10 passed, failed/cancelled assignment incorrectly continued to resolution. Lifecycle RED at 07:20:21Z: 2 failed / 8 passed, confirmed outcome and changing target were missing. GREEN: focused Admin command recorded in status.json, 7 files / 53 tests passed; controller 8 tests passed. Logs are local `/private/tmp/green-goods-steward-queue-red.log`, `/private/tmp/green-goods-steward-status-ui-red.log`, `/private/tmp/green-goods-steward-requests-final-admin-proof.log` and `/private/tmp/green-goods-steward-controller-final-proof.log`.

Rendered proof: Storybook in Brave, synthetic fixtures. Desktop review and 375×812 mobile review/pending were inspected. Signing, real API submission and role grants remain unverified in an authenticated session. Screenshot artifacts stay local; no private QA evidence enters Git.

Original implementation receipt before the sizing correction: tested implementation `6cf9020c771b22010310293c2d4bbb75e3772de0`, run 2026-10-08T07:49:18Z → 08:01:56Z with `node scripts/dev/ci-local.js --intent release`. Admin 1,282 tests, Shared 7,267 tests, Client 1,686 tests, Agent unit/SQLite tests and all owning package typechecks/builds passed. The gate passed 33 checks, then exited 1 at the unrelated immutable-report guard; story-quality was independently rerun and passed. See the State/API handoff Validation Receipt for exact commands, scoped paths, checkout identity, equality/cleanliness proof and local logs. This does not claim release readiness or live authenticated proof.

Original browser proof before the sizing correction: Storybook in Brave on that implementation. Desktop Profile, garden selection and review, and mobile review/pending sheets were inspected. A path-scoped `git diff --exit-code 30fff13e7..HEAD -- packages/admin/src/components packages/shared/src/hooks/admin-ui/layout/useStewardAccessRequestController.ts packages/shared/src/i18n` returned 0, confirming subsequent classification/test repairs did not change those rendered sources. Copy, request and Disconnect actions are visible in Profile; phone status and withdrawal actions fit within 375×812.

## Action-bar refinement

The user requested less whitespace with one action, a shorter desktop dialog and the client PWA's continuous solid background. The requester now uses a compact step-action row with 40px controls and existing 44px finger targets. Mobile actions share the row, and a lone action fills it; desktop actions align right. Long labels wrap inside the mobile row. The footer inherits the surface color instead of painting a separate white panel. Stable single-purpose dialogs use 75dvh capped at 42rem on desktop and retain 90dvh on mobile.

Storybook in Brave, synthetic fixtures: selection, review and pending measured 672px at 1280×900, down from 765px. All three mobile states retained 730.797px at 375×812. The footer measured 69px in every state, down from the previous 80px desktop / 128px mobile reserve. Its body, header and footer share one solid background. All actions fit within their content gutter, including the wrapped status label. Local geometry and screenshots are in `/private/tmp/green-goods-steward-polish-*`; no real requests or signatures were produced.

Provisional proof: focused QA passed five checks, including four files / 27 tests. The two browser story files passed eight tests. Source structure and test quality passed; the design guard passed after expressing the computed transparency check without a hardcoded color literal. The initial automatic QA scope included another session's untracked plan artifacts and failed their formatting; no unrelated artifacts were changed. Final QA uses the six owned paths. Static Storybook built 2,218 stories before the final mobile-width/label-wrap refinements; a fresh committed build and full browser run remain pending.

Task record: Steward Access Requests — action-bar refinement | Type: fix | Outcome: local verification in progress
Agent/model: Codex / model unknown | Coverage: this user-directed visual refinement

| Phase | Start → end (UTC) | Result / evidence |
|---|---|---|
| Investigate | 2026-10-08T16:32:11Z → 16:34:12Z | Inspected rendered footer and the PWA SheetActions grammar |
| Implement | 16:34:12Z → 16:39:49Z | Shorter desktop surface, compact row, continuous color and rendered regression assertions |
| Verify / review | 16:36Z → ongoing | Focused QA/browser checks and six desktop/mobile captures; committed proof pending |

Human corrections: 1, action-bar whitespace, desktop height and background consistency; attention: unknown.

## Validation Receipt (prior stable-height correction)

- Tested implementation commit SHA: `0fc3fd83e9a1c4258e4bcfdf64396a3dbe601778`
- Run at (UTC): 2026-10-08T15:43:51Z
- Exact command(s): `node scripts/dev/ci-local.js --intent qa --base d677e37c37dfe426061c86cc447e29e22b9b54b8 --test-path admin:src/components/Layout/StewardAccessRequest.test.tsx --test-path admin:src/__tests__/components/AdminDialog.test.tsx --test-path admin:src/__tests__/components/AdminDialogStandard.guard.test.ts --test-path admin:src/__tests__/components/AdminDialogInstantExit.test.tsx`; `bun run --filter @green-goods/shared test:stories:ci`; `bun run --cwd packages/shared node ../../scripts/dev/node-cli.js vitest run --config vitest.storybook.config.ts --project=storybook --maxWorkers=1 --no-file-parallelism ../admin/src/components/Layout/StewardAccessRequest.stories.tsx ../admin/src/components/AdminDialog.stories.tsx ../admin/src/views/Actions/ActionsSheetDescriptor.stories.tsx ../admin/src/views/Profile/Profile.stories.tsx ../admin/src/views/Garden/SubmitWork.stories.tsx`.
- Result: all 529 curated browser tests passed on the final committed fixture cleanup. The final committed QA run passed all five checks, including 27 focused tests; the static Storybook build passed with 2,218 stories. Earlier full Admin proof passed 1,282 tests. Release readiness is not claimed.
- Validated paths: `packages/admin/`, `package.json`, `bun.lock`, `scripts/`, `.github/`, `.husky/`, `AGENTS.md`, `.claude/`. Shared/Agent implementation proof is retained separately through scoped equality.
- Worktree identity command and result: `git rev-parse --show-toplevel` identifies `/Users/afo/Code/greenpill/green-goods`, on `release/october-2-0-0`. `git status --porcelain=v1 --untracked-files=all -- packages/admin package.json bun.lock scripts .github .husky AGENTS.md .claude` returned no output: validated paths are clean.
- Evidence-only diff command and result (if applicable): `git diff --exit-code 0fc3fd83e9a1c4258e4bcfdf64396a3dbe601778..HEAD -- packages/admin package.json bun.lock scripts .github .husky AGENTS.md .claude` returned exit 0, no output after the test-cleanup follow-up. This hub-only follow-up repeats equality after commit.
- Evidence-only worktree-status command and result (if applicable): `git status --porcelain=v1 --untracked-files=all -- packages/admin package.json bun.lock scripts .github .husky AGENTS.md .claude` returned no output at receipt write and repeats after the evidence-only commit.

## Stable-height correction

The user identified that a content-sized surface made selection and status shorter than review, and requested mobile evidence for every state. Before correction, desktop selection measured 360px and review 552px. AdminDialog now offers an opt-in stable height using the existing 90dvh mobile / 85dvh desktop values; existing flow sizing uses the same central variable. The requester reserves the target row and footer, while its garden list fills the remaining scroll region instead of stopping at 256px.

Storybook in Brave at 1280×900: selection, review and pending each measured 765px, with body top 194.5px and footer top 752.5px. At 375×812 they each measured 730.797px, with body top 208.203px and footer top 684px. The mobile list is 348px high and its last garden was reachable by scrolling without resizing the sheet. All six screenshots were inspected. Local geometry evidence: `/private/tmp/green-goods-steward-stable-geometry.json`.

Supplemental provisional evidence before commit: all 1,282 Admin tests, source/test typechecks, source/test-quality/design guards and the static Storybook build (2,218 stories) passed. Current committed focused logs: `/private/tmp/green-goods-steward-stable-committed-qa.log` and `/private/tmp/green-goods-steward-stable-committed-browser.log`.

Earlier broad Storybook CI runs were not green. After fixing the new geometry test's premature entrance-animation baseline, different runs failed existing Actions route, Profile route or Submit Work visibility assertions, while the new flow cases passed. The final committed focused serial run includes all of those subjects and passed 20 tests. The new fixture now closes its modal and waits for teardown before returning. The subsequent full committed run passed all 529 tests. Earlier failure logs are preserved locally; no existing test was weakened or removed, and no harness configuration changed. Final logs: `/private/tmp/green-goods-steward-stable-cleanup-ci.log`, `/private/tmp/green-goods-steward-stable-final-qa.log`, `/private/tmp/green-goods-steward-stable-final-build.log`. Full release proof is pending after this Admin change and resolution of the unrelated historical-report blocker.

Visual proof substitute: this is presentation sizing with no auth/request-state change. The before/after geometry and the new desktop/mobile browser assertions protect the original trigger; no class-only unit assertions were added.

Task record: Steward Access Requests — stable geometry correction | Type: fix | Outcome: local implementation complete, release blocked
Agent/model: Codex / model unknown | Coverage: this user-directed layout correction

| Phase | Start → end (UTC) | Result / evidence |
|---|---|---|
| Investigate | unknown → 2026-10-08T14:54:06Z | Reproduced content-sized picker/review mismatch |
| Implement | 14:54:06Z → 15:27:09Z | Stable height, anchored regions, expanded list, browser geometry checks; commit adc6af623 |
| Verify / review | 14:56Z → 15:43:51Z | Full provisional Admin suite, committed focused QA/browser proof and six labeled screenshots |
| Publish | 15:27:09Z → ongoing | Local commit only; original release push remains blocked |

Human corrections: 1, design sizing and missing mobile-selection evidence; attention: unknown.

## Task record

Task record: Steward Access Requests | Type: feature | Outcome: partial
Agent/model: Codex / model unknown | Coverage: this implementation segment

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Investigate | 2026-10-08T06:43Z → 06:53Z | Existing membership capability required explicit signed request kind and role confirmation |
| Implement | 06:53Z → 07:35Z | Shared, Agent and Admin work assembled; focused RED/GREEN evidence above |
| Verify / review | 07:02Z → 08:03:39Z | Focused RED/GREEN, labeled screenshots, fresh committed full suites and builds; release guard blocked on unrelated report |
| Publish | 07:38:55Z → ongoing | Local implementation and bounded repair commits; push blocked |
| Wait | unknown → ongoing | Unrelated immutable report preservation approval remains pending |

Human corrections: 0 in this feature segment; attention: unknown. Overlapping agent intervals are not summed.
