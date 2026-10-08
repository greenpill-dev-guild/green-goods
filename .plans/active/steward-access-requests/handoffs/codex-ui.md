# UI Lane

Owner: Codex. Branch: `release/october-2-0-0`. The user-directed action-bar refinement is committed with fresh focused and rendered proof. The broad browser gate and release publication remain blocked.

Requester entry is in the no-access state and Profile. It opens the existing AdminDialog, chooses a known operational garden, reviews the primary account and optional note, then explicitly signs a request. Status checks, withdrawal, changing garden and confirmed/declined/error outcomes are available. Account, chain and authentication changes clear private drafts and close the dialog. The request target stays in account-scoped memory; it does not activate an inaccessible workspace.

The Community queue separates membership and stewardship. A steward request invokes the existing steward assignment, then resolves only after success. Failed or cancelled assignments never start the resolution signature; unknown outcomes provide recovery guidance.

TDD: queue RED at 2026-10-08T07:06:43Z: 4 failed / 10 passed, failed/cancelled assignment incorrectly continued to resolution. Lifecycle RED at 07:20:21Z: 2 failed / 8 passed, confirmed outcome and changing target were missing. GREEN: focused Admin command recorded in status.json, 7 files / 53 tests passed; controller 8 tests passed. Logs are local `/private/tmp/green-goods-steward-queue-red.log`, `/private/tmp/green-goods-steward-status-ui-red.log`, `/private/tmp/green-goods-steward-requests-final-admin-proof.log` and `/private/tmp/green-goods-steward-controller-final-proof.log`.

Rendered proof: Storybook in Brave, synthetic fixtures. Desktop review and 375×812 mobile review/pending were inspected. Signing, real API submission and role grants remain unverified in an authenticated session. Screenshot artifacts stay local; no private QA evidence enters Git.

Original implementation receipt before the sizing correction: tested implementation `6cf9020c771b22010310293c2d4bbb75e3772de0`, run 2026-10-08T07:49:18Z → 08:01:56Z with `node scripts/dev/ci-local.js --intent release`. Admin 1,282 tests, Shared 7,267 tests, Client 1,686 tests, Agent unit/SQLite tests and all owning package typechecks/builds passed. The gate passed 33 checks, then exited 1 at the unrelated immutable-report guard; story-quality was independently rerun and passed. See the State/API handoff Validation Receipt for exact commands, scoped paths, checkout identity, equality/cleanliness proof and local logs. This does not claim release readiness or live authenticated proof.

Original browser proof before the sizing correction: Storybook in Brave on that implementation. Desktop Profile, garden selection and review, and mobile review/pending sheets were inspected. A path-scoped `git diff --exit-code 30fff13e7..HEAD -- packages/admin/src/components packages/shared/src/hooks/admin-ui/layout/useStewardAccessRequestController.ts packages/shared/src/i18n` returned 0, confirming subsequent classification/test repairs did not change those rendered sources. Copy, request and Disconnect actions are visible in Profile; phone status and withdrawal actions fit within 375×812.

## Action-bar refinement

English / Spanish verification, 2026-10-08: added four Spanish presentation stories using the declared Shared locale export. Storybook in Brave with synthetic fixtures exposed one remaining wrap at 320px: Withdraw Request. The English action now reads Withdraw; Retirar solicitud already fits, so Spanish copy stays descriptive. Entry, review and status action labels fit on one line at 320px and 375px. The selection rows intentionally contain a garden name and location on separate lines. Selection, review and pending keep the 730.797px mobile height; desktop review/status retain the 672px height at 1280×900. Six inspected 375×812 screenshots are local `/private/tmp/green-goods-steward-{en,es}-{choose,review,pending}-mobile.jpg`, with DOM measurements in `/private/tmp/green-goods-steward-locale-geometry.json`. No signatures, API submissions or role grants occurred.

Locale proof: five fresh focused QA checks passed, including 10 existing request component tests, Admin test typechecking and Storybook coverage/quality. Exact command: `node scripts/dev/ci-local.js --intent qa --base HEAD --changed packages/admin/src/components/Layout/StewardAccessRequest.stories.tsx,packages/admin/src/components/Layout/StewardAccessRequest.test.tsx,packages/shared/src/i18n/en.json --only format --only lint --only admin-test-typecheck --only admin-test --only story-quality --test-path admin:src/components/Layout/StewardAccessRequest.test.tsx`. The routine copy/story scope changes no hook, API, type contract or mutation; the transitive Shared/Client/Agent suites were not rerun. `bun run --filter @green-goods/shared build-storybook` passed with 2,222 stories / 420 components. No new `storybook-ci` tags were added. Logs: `/private/tmp/green-goods-steward-locale-final-qa.log`, `/private/tmp/green-goods-steward-locale-build.log`. Earlier broad browser failures and the historical-report release blocker remain unresolved.

Task record: Steward Access Requests — English / Spanish verification | Type: fix | Outcome: local language proof complete, release remains blocked. Agent/model: Codex / unknown. Coverage: this language verification segment. Investigate: unknown → 2026-10-08T18:02:27Z; implement and verify: 18:02:27Z → 18:08:46Z, overlapping copy repair and rendered/check proof. Human corrections: 0 in this scope addition; attention: unknown.

Latest copy correction, 2026-10-08: the status action now reads Check Status, with Consultar estado / Consultar status in Spanish / Portuguese. Storybook in Brave at 375×812 shows one 17.5px text line inside the existing 40px button; screenshot `/private/tmp/green-goods-check-status-mobile.jpg`. The existing request component assertion uses the new accessible name. Focused QA passed format, lint and 10 component tests with `node scripts/dev/ci-local.js --intent qa --base 4207bd3af --changed packages/shared/src/i18n/en.json,packages/shared/src/i18n/es.json,packages/shared/src/i18n/pt.json,packages/admin/src/components/Layout/StewardAccessRequest.test.tsx --only format --only lint --only admin-test --test-path admin:src/components/Layout/StewardAccessRequest.test.tsx`. The copy-only scope has no type, hook, API or mutation change; transitive package suites were not rerun. Prior broad browser failures and the release-report blocker remain unresolved. Earlier Shared-wide equality proof predates these locale-only changes.

Task record: Steward Access Requests — short status label | Type: fix | Outcome: local copy and rendered proof complete, release still blocked. Agent/model: Codex / unknown. Coverage: this label correction. Investigate began 2026-10-08T17:03:18Z; implementation and focused verification were observed complete at 17:05:00Z; intermediate phase boundaries are unknown. Human corrections: 1, wrapped action label; attention: unknown.

The user requested less whitespace with one action, a shorter desktop dialog and the client PWA's continuous solid background. The requester now uses a compact step-action row with 40px controls and existing 44px finger targets. Mobile actions share the row, and a lone action fills it; desktop actions align right. Long labels wrap inside the mobile row. The footer inherits the surface color instead of painting a separate white panel. Stable single-purpose dialogs use 75dvh capped at 42rem on desktop and retain 90dvh on mobile.

Storybook in Brave, synthetic fixtures: selection, review and pending measured 672px at 1280×900, down from 765px. All three mobile states retained 730.797px at 375×812. The footer measured 69px in every state, down from the previous 80px desktop / 128px mobile reserve. Its body, header and footer share one solid background. All actions fit within their content gutter, including the wrapped status label. Local geometry and screenshots are in `/private/tmp/green-goods-steward-polish-*`; no real requests or signatures were produced.

Provisional proof: focused QA passed five checks, including four files / 27 tests. The two browser story files passed eight tests. Source structure and test quality passed; the design guard passed after expressing the computed transparency check without a hardcoded color literal. The initial automatic QA scope included another session's untracked plan artifacts and failed their formatting; no unrelated artifacts were changed. Final QA uses the six owned paths.

Fresh committed proof at `3b4cae767044698d9594019b395fbcd2865cad61`: five focused QA checks / 27 tests and the static Storybook build / 2,218 stories passed. Two full curated browser runs each passed 528 of 529 tests. The first failed Actions Route Backed Create Mobile at dialog lookup; the second, without a concurrent build, failed Submit Work Details Step at required-field visibility. Both subjects passed alongside the changed request/dialog stories in a four-file, 18-test serial diagnostic. The changed flow's cases passed in both full runs. This supports the bounded refinement but does not establish a passing broad gate or the exact cause of the intermittent failures. No failing subject, assertion, tag or harness setting was changed. Failure and diagnostic logs stay local.

## Validation Receipt (action-bar refinement)

- Tested implementation commit SHA: `3b4cae767044698d9594019b395fbcd2865cad61`
- Run at (UTC): 2026-10-08T16:42:10Z → 16:46:42Z
- Exact command(s): `node scripts/dev/ci-local.js --intent qa --base cfa0bacd3 --changed packages/admin/src/components/AdminDialog.tsx,packages/admin/src/components/Layout/StewardAccessRequest.tsx,packages/admin/src/components/Layout/StewardAccessRequest.stories.tsx,.plans/active/steward-access-requests/spec.md,.plans/active/steward-access-requests/status.json,.plans/active/steward-access-requests/handoffs/codex-ui.md --test-path admin:src/components/Layout/StewardAccessRequest.test.tsx --test-path admin:src/__tests__/components/AdminDialog.test.tsx --test-path admin:src/__tests__/components/AdminDialogStandard.guard.test.ts --test-path admin:src/__tests__/components/AdminDialogInstantExit.test.tsx`; `bun run --filter @green-goods/shared build-storybook`; `bun run --filter @green-goods/shared test:stories:ci` (two runs); `bun run --cwd packages/shared node ../../scripts/dev/node-cli.js vitest run --config vitest.storybook.config.ts --project=storybook --maxWorkers=1 --no-file-parallelism ../admin/src/components/Layout/StewardAccessRequest.stories.tsx ../admin/src/components/AdminDialog.stories.tsx ../admin/src/views/Actions/ActionsSheetDescriptor.stories.tsx ../admin/src/views/Garden/SubmitWork.stories.tsx`.
- Result: focused QA, static build and 18-test browser diagnostic passed. Each full browser run failed one different existing subject, with 528 tests passed. Broad gate and release readiness are not claimed.
- Validated paths: `packages/admin/`, `package.json`, `bun.lock`, `scripts/`, `.github/`, `.husky/`, `AGENTS.md`, `.claude/`; the six owned refinement paths are the focused QA scope. Shared/Agent proof is retained separately through scoped equality.
- Worktree identity command and result: `git rev-parse --show-toplevel` identifies `/Users/afo/Code/greenpill/green-goods`, on `release/october-2-0-0`. `git status --porcelain=v1 --untracked-files=all -- packages/admin package.json bun.lock scripts .github .husky AGENTS.md .claude` returned no output.
- Evidence-only diff command and result: `git diff --exit-code 3b4cae767044698d9594019b395fbcd2865cad61..HEAD -- packages/admin package.json bun.lock scripts .github .husky AGENTS.md .claude` returned exit 0, no output before this evidence-only follow-up and repeats after its commit.
- Evidence-only worktree-status command and result: the scoped status command above returned no output and repeats after this evidence-only commit. The unrelated historical report's blob remains `7053dbc855862ca535a2c50d30b80a468529659b`; another session's untracked Green Goods OS hub was left untouched.
- Local logs: `/private/tmp/green-goods-steward-polish-committed-qa.log`, `/private/tmp/green-goods-steward-polish-committed-build.log`, `/private/tmp/green-goods-steward-polish-committed-ci.log`, `/private/tmp/green-goods-steward-polish-committed-ci-isolated.log`, `/private/tmp/green-goods-steward-polish-recovery-browser.log`.

Task record: Steward Access Requests — action-bar refinement | Type: fix | Outcome: local implementation complete, broad verification and release blocked
Agent/model: Codex / model unknown | Coverage: this user-directed visual refinement

| Phase | Start → end (UTC) | Result / evidence |
|---|---|---|
| Investigate | 2026-10-08T16:32:11Z → 16:34:12Z | Inspected rendered footer and the PWA SheetActions grammar |
| Implement | 16:34:12Z → 16:39:49Z | Shorter desktop surface, compact row, continuous color and rendered regression assertions |
| Verify / review | 16:36Z → 16:46:42Z | Fresh focused QA, static build and 18-test browser diagnostic passed; two broad runs failed different existing subjects |
| Publish | 16:41Z → ongoing | Local commit 3b4cae767; original historical-report approval still holds the release push |

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
