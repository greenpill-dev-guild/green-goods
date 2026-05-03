# Codex QA Pass 2 Handoff

**Actor**: Claude (acting on user request to run QA Pass 2 from this session)
**Date**: 2026-05-02
**Status**: passed for admin stabilization scope; two recorded out-of-scope items remain

## QA Sequence Pre-Conditions

- `qa_pass_1` is `passed` per `status.json` and the durable
  `handoffs/claude-qa-pass-1.md` covering all 9 verification points and
  AC-1..AC-6.
- `branch_trigger: claude/qa-pass-1/admin-dashboard-stabilization` is
  declared on `qa_pass_2` but does not exist locally
  (`git for-each-ref refs/heads/` returns no match). The QA Pass 1 evidence is
  recorded durably in the hub regardless of branch presence; treating Pass 2 as
  authorized to proceed under the user's explicit request. If a future
  automated runner enforces the trigger branch, create
  `claude/qa-pass-1/admin-dashboard-stabilization` from the current Pass 1
  hub commit before re-running this pass.

## Validation Re-Run

| Command | Result | Notes |
|---|---|---|
| `bun --bun tsc --noEmit -p packages/admin/tsconfig.json` | exit 0 | clean |
| `bun run --filter @green-goods/admin test:hub` | 13 files / 96 tests pass | matches Pass 1 evidence |
| `bun run --filter @green-goods/shared check:stories` | PASS | required Storybook contract satisfied |
| `bun run --filter @green-goods/shared check:story-quality` | PASS | 134 story files |
| `bun run --filter @green-goods/admin build` | proof-limit | Varlock/1Password authorization timeout for `PINATA_JWT`; identical sandbox/credential constraint already documented in `spec.md` Research Evidence. Admin code itself is clean — `tsc` passes and prior recorded `build` runs (codex pre-Pass 1, see `codex-qa-pass-2.md` history) succeeded with only existing Rollup chunk warnings. |
| `bun run --filter @green-goods/shared test:stories:ci` | 1 failed / 102 passed (199 total / 170 skipped) | same single failure as Pass 1: `packages/client/src/views/PublicBrowserSurfaces.stories.tsx:163` `findByRole("link", { name: /green goods logo/i })` against the post-`17951dca` `SiteHeader` markup; admin workspace stories all pass under the new isolation harness. |

## Source Diff vs. Handoff Agreement

Hub-touched paths in the worktree (excluding unrelated dirty files):

- New admin: `packages/admin/src/components/Layout/AdminAccessStateRenderer.tsx`, `AdminAccessStateRenderer.stories.tsx`.
- Modified admin: `routes/CanvasShell.tsx`, `routes/IndexRoute.tsx`, `__tests__/components/CanvasLayout.test.tsx`, `__tests__/routes/IndexRoute.test.tsx`, `views/Actions/Actions.stories.tsx`, `views/Actions/ActionsSheetDescriptor.stories.tsx`, `views/Actions/actions.workspaceModel.test.ts`, `components/Layout/CommandPalette.stories.tsx`.
- New shared: `packages/shared/.storybook/adminStoryIsolation.ts`, `src/hooks/admin-ui/useAdminAccessState.ts`, `src/__tests__/hooks/admin-ui/useAdminAccessState.test.ts`, `src/__tests__/hooks/garden/useGardenDetailData.fallback.test.ts`, `src/__tests__/storybook/admin-story-isolation.test.ts`.
- Modified shared: `.storybook/adminFixtures.ts`, `.storybook/decorators.tsx`, `.storybook/preview.tsx`, `src/hooks/admin-ui/actions/useActionsController.ts`, `src/hooks/garden/useGardenDetailData.ts`, `src/hooks/index.ts`, `src/hooks/roles/useEffectiveToolbarPermissions.ts`, `src/index.ts`, `src/providers/DevAuthProvider.tsx`, `src/providers/index.ts`, `src/__tests__/hooks/roles/useEffectiveToolbarPermissions.test.ts`.

These match what `claude-ui.md`, `codex-state-api.md`, and `claude-qa-pass-1.md`
describe. No contract, indexer, deployment, or public client changes were
introduced under hub authorship. `codex-contracts.md` correctly records `n/a`.

`status.json` agrees:

- `ui.status = completed`, `state_api.status = completed`, `contracts.status = n/a`.
- `qa_pass_1.status = passed` with handoff at `handoffs/claude-qa-pass-1.md`.
- `qa_pass_2.status = blocked` until this handoff flips it.

## Acceptance Checks (eval.md)

| AC | Verdict | Source |
|---|---|---|
| AC-1 plan hub | pass | `node scripts/harness/plan-hub.mjs validate` succeeded after Pass 1 lane update; re-run from Pass 1 timestamp 17:43 reported "Validated 20 feature hubs." |
| AC-2 Storybook isolation | pass | unit proof in `admin-story-isolation.test.ts`; integration evidence is the `test:stories:ci` jump from pre-fix "7 failed / 96 passed" to post-fix "1 failed / 102 passed" with the only failure outside admin scope. |
| AC-3 direct route auth | pass | `CanvasShell access states` block in `__tests__/components/CanvasLayout.test.tsx` plus `useAdminAccessState.test.ts` covering all six terminal states. |
| AC-4 eligible garden fallback | pass | `useGardenDetailData.fallback.test.ts` and the stale-base-list ready case in `useAdminAccessState.test.ts:112-132`. |
| AC-5 Actions policy | pass | route gate in `views.tsx:246-256`, controller policy in `useActionsController.ts:34-36`, controller test in `actions.workspaceModel.test.ts:107-111`, and Storybook deployer identity wiring in the three Actions/CommandPalette stories. |
| AC-6 regression review | pass for admin scope | tsc clean, test:hub clean, story checks clean, story isolation harness verified live; build is proof-limited by Varlock/1Password locally. |

## Out-of-Scope Items (deferred)

1. **`PublicBrowserSurfaces.stories.tsx:163` assertion** — failing because
   `SiteHeader` no longer exposes a link with the accessible name `Green
   Goods Logo` after `17951dca fix(client): SiteHeader logo uses h-8 w-auto,
   drops text wordmark`. This is a public-browser editorial work item, not an
   admin stabilization defect. Recommend opening a small client-side fix
   plan (single-file assertion update) rather than absorbing it into this
   hub. Per the user instruction in this session, no source code change
   was applied here.
2. **`bun run --filter @green-goods/admin build` Varlock/1Password timeout**
   — credential proof-limit on `PINATA_JWT`, not an admin code defect.
   Identical to the sandbox-escalation note in `spec.md` Research Evidence.
   Re-run with a refreshed 1Password session or `varlock run` shell when
   archive readiness depends on a green build.

## Failure Modes Watched (per eval.md)

- Stabilization stayed off the visual-redesign path. ✓
- `CanvasLayout` was reused as the `ready` shell, not replaced. ✓
- Storybook isolation reaches `test:stories:ci`, not just isolated unit tests. ✓
- Actions stories use deployer seeds, not operator seeds. ✓
- Eligible-garden fallback exposes explicit `hasStaleBaseList` /
  `isRecoveredEligibleGarden` signals so consumers do not treat stubs as full
  records. ✓
- The single residual `test:stories:ci` failure is not admin Storybook —
  no false-positive admin-only success was claimed. ✓

## Verdict

QA Pass 2: **pass** for admin stabilization scope. `qa_pass_2.status` may move
from `blocked` to `passed`. Two non-blocking out-of-scope items remain
documented above; neither belongs inside this hub. Archive promotion can
follow once the maintainer (a) decides whether the public-browser story
assertion fix is required for a green `test:stories:ci` and (b) optionally
runs `bun run --filter @green-goods/admin build` with refreshed Varlock
credentials to retire the local proof-limit.
