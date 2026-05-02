# Claude QA Pass 1 Handoff

**Actor**: Claude
**Date**: 2026-05-02
**Status**: passed (one out-of-scope blocker noted, deferred to qa_pass_2)

## Summary

Reviewed the implementation diff against `eval.md` AC-1 through AC-6 and the
nine verification points in the QA scope. All admin stabilization acceptance
criteria pass. No legacy route aliases, no package-local admin hooks, no
`CanvasLayout` replacement, no admin shell drift. Targeted validation
re-executed locally and matches the evidence recorded in
`handoffs/codex-state-api.md` and `handoffs/claude-ui.md`.

## Verification Points

| # | Claim | Status | Evidence |
|---|---|---|---|
| 1 | `CanvasLayout` remains the canonical ready shell | pass | `routes/CanvasShell.tsx:14-23` — `AdminAccessStateRenderer` returns `<CanvasLayout />` only on `status === "ready"`. |
| 2 | `/hub` remains the reference admin canvas surface | pass | `routes/views.tsx:84-153` — `/hub` index redirects to `/hub/work`; `/hub/work`, `/hub/assess`, `/hub/certify`, `/hub/history` retained as canonical Hub deep links. |
| 3 | ADR-019 canonical routes preserved; no legacy aliases restored | pass | `routes/views.tsx:84-261` — primary canvases `/hub`, `/garden`, `/community`, `/cookies`, `/actions`, `/profile`; nested deep links match the contract in `docs/docs/builders/packages/admin.mdx`. `router.tsx:30-47` keeps the public-garden `/gardens/*` redirect to the client app. No retired admin top-level routes were re-introduced. |
| 4 | `/actions` deployer-only across route + controller + stories | pass | Route: `routes/views.tsx:246-256` `roleGatedBranch(["deployer"], ...)` for `/actions`, `/actions/create`, `/actions/:id`, `/actions/:id/edit`. Controller: `packages/shared/src/hooks/admin-ui/actions/useActionsController.ts:34-36` `canManageActionsForRole(role) === role === "deployer"`. Stories: `Actions.stories.tsx`, `ActionsSheetDescriptor.stories.tsx`, and `Layout/CommandPalette.stories.tsx` now use `withAdminIdentityRole("deployer")` + `STORYBOOK_ADMIN_DEPLOYER_SEEDS`. Test: `views/Actions/actions.workspaceModel.test.ts:107-111` asserts deployer-only across `deployer`/`operator`/`user` roles. |
| 5 | Direct canvas routes share the `/` terminal-state ladder | pass | Both `routes/IndexRoute.tsx:19-28` and `routes/CanvasShell.tsx:7-25` consume `useAdminAccessState` from shared and render through the same `AdminAccessStateRenderer`. The renderer produces dedicated branches for `checking`, `disconnected`, `embedded-wallet`, `indexer-error`, `no-access`, `ready`. Behavior parity is exercised by the new `CanvasShell access states` block in `__tests__/components/CanvasLayout.test.tsx:530-595`. |
| 6 | Storybook admin workspace stories isolated from previous-story state | pass | Global decorator `withAdminStoryIsolation` is the first entry in `.storybook/preview.tsx` and calls `resetAdminStoryState()` before each story. `adminStoryIsolation.ts:22-52` clears: `useAdminStore`, `useSheetOrchestratorStore`, `useGardenStateStore.clearAll()`, `useCreateGardenStore`, `useCreateAssessmentStore`, `useWorkFlowStore`, `useHypercertWizardStore`, `ADMIN_GARDEN_PREFERENCES_STORAGE_KEY` (localStorage), `SHEET_STATE_STORAGE_KEY`, `GARDEN_STATE_STORAGE_KEY`, `DEV_MOCK_AUTH_STORAGE_KEY`, and `hypercert-minting-state` (sessionStorage). `withSeededQueryClient` was changed from `useState` first-render-only to `useMemo([context.id])` plus `client.clear()` cleanup, so each story gets its own seeded `QueryClient`. Verified by `__tests__/storybook/admin-story-isolation.test.ts`. |
| 7 | `useGardenDetailData` and `useEffectiveToolbarPermissions` share the eligible-garden fallback truth | pass | `useGardenDetailData` (`packages/shared/src/hooks/garden/useGardenDetailData.ts`) now consumes `useEligibleAdminGardens` and falls back to `recoveredEligibleGarden` when the base list misses the record, while exposing `baseGarden`, `isRecoveredEligibleGarden`, `hasStaleBaseList`, `baseListError`, `isBaseListError` so callers can still distinguish recovered stubs from fully indexed records. `useEffectiveToolbarPermissions` switched its source from `useGardens` to `useEligibleAdminGardens`, with explicit fail-open conditions that respect `isError && eligibleGardens.length === 0`. Stale-base-list ready state proven by `useAdminAccessState.test.ts:112-132` and `useGardenDetailData.fallback.test.ts:139-160`. |
| 8 | No package-local admin hooks added | pass | `packages/admin/src/hooks` does not exist. The new `useAdminAccessState` lives in `packages/shared/src/hooks/admin-ui/useAdminAccessState.ts` and is re-exported through both `packages/shared/src/hooks/index.ts` and `packages/shared/src/index.ts`. `AdminAccessStateRenderer` is admin-owned UI (terminal-state renderer) per spec, not a hook. All hook imports in the new admin code come from `@green-goods/shared`. |
| 9 | New user-facing strings translated in en/es/pt | pass | New keys `app.admin.auth.checking`, `app.admin.auth.signOutAndReconnect`, `app.admin.auth.connectRequired`, `app.admin.auth.connectPrompt`, `app.admin.brand` all present in `packages/shared/src/i18n/en.json`, `es.json`, and `pt.json` (verified by grep). |

## Acceptance Checks (eval.md)

- AC-1 plan hub: pass — hub structure, handoffs, and validation run remain valid.
- AC-2 Storybook isolation: pass — see point 6.
- AC-3 direct route auth: pass — see point 5; mock parity in `IndexRoute.test.tsx` plus real classifier coverage in `useAdminAccessState.test.ts`.
- AC-4 eligible garden fallback: pass — see point 7.
- AC-5 Actions policy: pass — see point 4.
- AC-6 regression review: implementation evidence agrees; targeted commands re-run.

## Validation Re-Run (this pass)

- `bun --bun tsc --noEmit -p packages/admin/tsconfig.json` — exit 0.
- `bun run --filter @green-goods/shared test -- src/__tests__/hooks/admin-ui/useAdminAccessState.test.ts src/__tests__/hooks/roles/useEffectiveToolbarPermissions.test.ts src/__tests__/hooks/garden/useGardenDetailData.fallback.test.ts src/__tests__/storybook/admin-story-isolation.test.ts` — 4 files, 18 tests, all pass.
- `bun run --filter @green-goods/admin test -- src/views/Actions/actions.workspaceModel.test.ts src/__tests__/components/CanvasLayout.test.tsx src/__tests__/routes/IndexRoute.test.tsx` — 3 files, 36 tests, all pass.
- `bun run --filter @green-goods/admin test:hub` — 13 files, 96 tests, all pass.
- `bun run --filter @green-goods/shared check:stories` — PASS, required Storybook contract satisfied.
- `bun run --filter @green-goods/shared test:stories:ci` — 28 test files passed, 1 failed (199 total story modules, 170 skipped). The single failing test is `PublicBrowserSurfaces.stories.tsx:163` (`findByRole("link", { name: /green goods logo/i })`); admin workspace stories all pass. Compared to the pre-fix evidence in `spec.md` ("7 failed, 96 passed"), admin Storybook reliability under the new isolation harness is materially improved and the only residual failure is the documented out-of-scope public-browser assertion.

Validation deferred to `qa_pass_2` (already recorded by Codex in `codex-qa-pass-2.md`):

- `bun run --filter @green-goods/shared check:story-quality` — recorded pass (134 story files).
- `bun run --filter @green-goods/admin build` — recorded pass.

## Notes / Observations

1. `__tests__/routes/IndexRoute.test.tsx:55-79` re-implements the
   `useAdminAccessState` classifier inline inside its `vi.mock` factory. This is
   acceptable because the real classifier is independently covered by
   `__tests__/hooks/admin-ui/useAdminAccessState.test.ts`, but if the
   classifier ordering changes in shared, the IndexRoute mock must be updated
   in lockstep to avoid silent drift.
2. `useGardenDetailData` adds new return fields (`baseGarden`,
   `isRecoveredEligibleGarden`, `hasStaleBaseList`, `baseListError`,
   `isBaseListError`). Existing callers consuming only `garden` still work
   transparently with fallback. Future call sites that need to render
   recovered-vs-indexed differently now have explicit signals — recommend the
   admin Garden detail view consumes `isRecoveredEligibleGarden` /
   `hasStaleBaseList` if it shows write-affordances that should be gated
   pending full base-list confirmation. Out of scope for this stabilization
   pass.
3. `withSeededQueryClient` was switched from `useState` (sticky across
   re-renders only) to `useMemo([context.id])` with `client.clear()` cleanup.
   This is the right move for story isolation, but it means a story that
   re-renders due to global decorator state changes will get a fresh client
   per `context.id` — which is per story, not per render — so we still keep
   stable cache identity inside one story. Verified behaviorally by the
   admin Storybook stories passing under the new harness.
4. `app.admin.brand` resolves to `Green Goods` in all three locales. That is
   intentional for the brand, not a missing translation — the value is the
   brand name itself.

## Out-of-Scope Blocker (already known)

`bun run --filter @green-goods/shared test:stories:ci` is reported failing on
`packages/client/src/views/PublicBrowserSurfaces.stories.tsx`: the assertion
expects a link named `/green goods logo/i` while `SiteHeader` now renders the
text `Green Goods` (per commit `17951dca fix(client): SiteHeader logo uses
h-8 w-auto, drops text wordmark` and the editorial public-browser refresh
that landed alongside this hub). This is unrelated to admin stabilization
and is the same blocker `codex-qa-pass-2.md` flagged. Recommendation for
qa_pass_2: either update the public-browser story assertion to match the
new logo accessible name, or explicitly waive this one assertion as
out-of-scope for the admin hub.

## Verdict

QA Pass 1: **pass**. Implementation matches the plan and acceptance criteria
with no admin scope drift. `qa_pass_1` lane status can be updated from
`blocked` to `passed`. `qa_pass_2` may proceed; its only remaining decision
is the public-browser story assertion.
