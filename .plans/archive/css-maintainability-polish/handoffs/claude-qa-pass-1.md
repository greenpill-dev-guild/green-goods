# CSS Maintainability Polish - QA Pass 1 Handoff

**Lane**: `qa_pass_1`  
**Owner**: `claude`  
**Status**: closed with accepted browser-proof follow-up  
**Branch target**: `claude/qa-pass-1/css-maintainability-polish`  
**Run date**: `2026-06-19T02:41:18Z`  
**Checkout used**: `/private/tmp/green-goods-qa-pass-1-css-maintainability-polish` on `claude/qa-pass-1/css-maintainability-polish` at `b4257d57d1be7981e4d037025c41770f538719e6`

## Current Truth

1. `state_api` is complete. The custom-property guard and design-token wiring remain green.
2. The revamped `ui` lane is complete. The approved runtime micro-batch stayed limited to installed-PWA drawer/dialog backdrop token ownership (`--color-scrim`).
3. Linear was verified live:
   - Parent `PRD-451` exists and is `In Review`.
   - UI lane `PRD-452` is `Done` under `PRD-451`.
   - QA pass 1 `PRD-610` exists as `Todo` under `PRD-451`.
4. `.plans` in `origin/develop` was stale for the QA lane Linear ID before this handoff: `linear-sync` saw `qa_pass_1` as a create action because `status.json` only recorded `PRD-452`.
5. The 60 audited typography/font custom-property entries remain documented debt, not a current gate failure.
6. 2026-06-19 closeout decision: the hub is archived by explicit human direction. Missing authenticated browser proof remains recorded as a follow-up/proof limit, not as completed QA evidence.

## Findings

1. **P1 - Authenticated browser QA was blocked in this environment.**  
   Evidence: no Codex Browser/Chrome control tool was exposed for the authenticated Brave QA path; terminal Playwright clean-room attempts were also blocked. Localhost serving of the static Storybook build failed with `PermissionError: [Errno 1] Operation not permitted` even after escalation, and Playwright-launched Brave aborted before a page/context became available.  
   Impact: admin `/hub`, real admin sheet overlap/focus/route-backed states, and installed-PWA drawer/dialog scroll-lock/focus-trap proof cannot be claimed from this run. This is now accepted as follow-up proof outside this hub.

2. **P1 - Static guardrails and Storybook build are green.**  
   Evidence:
   - `node scripts/harness/plan-hub.mjs validate` -> `Validated 22 feature hubs.`
   - `node scripts/design/check-css-custom-properties.mjs` -> `CSS custom property guard passed: 3128 var() references, 1002 definitions, 60 audited unresolved entries.`
   - `bun run check:design-tokens` passed custom-property, raw-token, admin Controlled Chrome, token-version, radius, and workspace-tone guards.
   - `bun run --filter @green-goods/shared check:stories` -> `178/178 required Storybook surfaces have stories (100%)`.
   - `bun run --filter @green-goods/shared check:story-quality` -> `Checked 152 story file(s). PASS`.
   - `bun run --filter @green-goods/shared build-storybook` completed successfully; static output: `packages/shared/storybook-static/`.

3. **P1 - Admin Controlled Chrome assumptions are encoded and buildable, but still need runtime/browser confirmation.**  
   Evidence: `packages/admin/src/components/Layout/ControlledChromeContract.stories.tsx` has `storybook-ci` play assertions for a transparent `AppBar`, blurred `NavigationBar` and `RightSheet`, and solid route content. Static Storybook build included `CanvasLayout`, `ControlledChromeContract`, and Actions sheet story chunks.  
   Limit: no browser could execute these play assertions or computed-style checks in this environment.

4. **P1 - Admin sheet and route-backed Actions assumptions are covered by focused tests and Storybook surfaces, but not visual route QA.**  
   Evidence:
   - Admin focused tests passed: `AdminDialog`, `CanvasLayout`, `actions.workspaceModel`, and Hypercert distribution config, `66 passed`.
   - Shared focused sheet tests passed: `LeftSheet`, `RightSheet`, `BottomSheet`, `SheetInteractions`, and `useToastAction`, `48 passed`.
   - Storybook surfaces exist for `admin-workspaces-actionssheetdescriptor--route-backed-detail`, `--route-backed-create`, `--route-backed-create-mobile`, and `--route-backed-edit`.
   Limit: AppBar/navigation overlap, scroll, focus, close, and route-backed create/edit/detail visual behavior still need authenticated Brave or equivalent browser proof.

5. **P1 - Client PWA drawer/dialog token ownership is statically and unit-tested as expected, but real installed-PWA flow proof is blocked.**  
   Evidence:
   - `packages/client/src/styles/pwaDrawerStyles.ts` uses `bg-[var(--color-scrim)]` for `overlay` and `dialogOverlay`.
   - Client focused tests passed: `pwaDrawerStyles` and `DraftDialog`, `15 passed`.
   - Shared `PwaSheet` still uses `style={{ backgroundColor: "var(--color-scrim)" }}` and has Storybook assertions checking `--color-scrim`.
   Limit: safe area, animation, focus trap, and scroll lock at narrow mobile viewport still need browser execution.

6. **P2 - Token alias fixes remain coherent.**  
   Evidence:
   - `DistributionChart.tsx` uses `--color-information-base`, `--color-primary-dark`, and `--color-information-dark`; the old `--color-info-*` aliases were not found in the Hypercert chart path.
   - `toast.service.tsx` uses `--color-primary-dark` for action hover and `--color-text-sub-600` for close/description text. The old `primary-strong` / `text-subtle-600` strings were not present in the toast service path.
   - CSS custom-property and design-token guards passed.
   Limit: the chart and toast states still lack fresh visual screenshot proof from this QA pass.

7. **P2 - The isolated `git worktree` requirement was blocked by host Git metadata permissions, but QA proceeded in an isolated local clone.**  
   Evidence:
   - Source checkout `/Users/afo/Code/greenpill/green-goods` was clean before work.
   - `git worktree add ../green-goods-qa-pass-1-css-maintainability-polish -b claude/qa-pass-1/css-maintainability-polish origin/develop` failed creating the branch ref under `.git/refs/heads/claude/...`.
   - Detached worktree creation failed creating `.git/worktrees/green-goods-qa-pass-1-css-maintainability-polish`.
   - A local clone under `/private/tmp` was created from the clean source checkout and switched to `claude/qa-pass-1/css-maintainability-polish` at `origin/develop` commit `b4257d57d1be7981e4d037025c41770f538719e6`.

## Evidence Paths

- Static Storybook build: `packages/shared/storybook-static/`
- Story index: `packages/shared/storybook-static/index.json`
- Story iframe shell: `packages/shared/storybook-static/iframe.html`
- Admin Controlled Chrome story source: `packages/admin/src/components/Layout/ControlledChromeContract.stories.tsx`
- Admin CanvasLayout story source: `packages/admin/src/components/Layout/CanvasLayout.stories.tsx`
- Admin Actions sheet story source: `packages/admin/src/views/Actions/ActionsSheetDescriptor.stories.tsx`
- Client ModalDrawer story source: `packages/client/src/components/Dialogs/ModalDrawer.stories.tsx`
- Shared PwaSheet story source: `packages/shared/src/components/Dialog/PwaSheet.stories.tsx`

No screenshot evidence was captured in this pass because both authenticated browser control and clean-room browser execution were blocked.

## Commands Run

1. `git status --short` from `/Users/afo/Code/greenpill/green-goods` -> clean.
2. `git worktree list --porcelain` from `/Users/afo/Code/greenpill/green-goods`.
3. `git worktree add ../green-goods-qa-pass-1-css-maintainability-polish -b claude/qa-pass-1/css-maintainability-polish origin/develop` -> blocked by `.git/refs/heads/claude/...` permission.
4. `git worktree add --detach /Users/afo/Code/greenpill/green-goods-qa-pass-1-css-maintainability-polish origin/develop` -> blocked by `.git/worktrees/...` permission.
5. `git clone /Users/afo/Code/greenpill/green-goods /private/tmp/green-goods-qa-pass-1-css-maintainability-polish`.
6. `git switch -c claude/qa-pass-1/css-maintainability-polish origin/develop`.
7. `bun scripts/harness/plan-hub.mjs linear-sync --feature css-maintainability-polish --json`.
8. Linear MCP reads for `PRD-451`, `PRD-452`, and `PRD-610`.
9. `bun run agentic:guidance`.
10. `node scripts/harness/plan-hub.mjs validate`.
11. `node scripts/design/check-css-custom-properties.mjs`.
12. `bun run check:design-tokens`.
13. `bun run --filter @green-goods/shared check:stories`.
14. `bun run --filter @green-goods/shared check:story-quality`.
15. `bun run --filter @green-goods/shared build-storybook`.
16. `bun run test -- src/__tests__/styles/pwaDrawerStyles.test.ts src/__tests__/components/DraftDialog.test.tsx` in `packages/client` -> `15 passed`.
17. `bun run test -- src/__tests__/components/Canvas/LeftSheet.test.tsx src/__tests__/components/Canvas/RightSheet.test.tsx src/__tests__/components/Canvas/BottomSheet.test.tsx src/__tests__/components/Canvas/SheetInteractions.test.tsx src/__tests__/hooks/useToastAction.test.ts` in `packages/shared` -> `48 passed`.
18. `bun run test -- src/__tests__/components/AdminDialog.test.tsx src/__tests__/components/CanvasLayout.test.tsx src/views/Actions/actions.workspaceModel.test.ts src/__tests__/components/hypercerts/DistributionConfig.test.tsx` in `packages/admin` -> `66 passed`.

## Recommendation

Close/archive the hub by explicit human direction.

The code-facing CSS maintainability gates are green, and there is no evidence that the 60 audited typography/font entries are a current gate failure. The remaining proof gap is authenticated Brave/browser evidence for admin `/hub`, admin sheet overlap/focus/close behavior, route-backed Actions states, and installed-PWA drawer/dialog focus/scroll/safe-area behavior. Do not claim that browser proof exists for this pass; treat it as accepted follow-up/non-gating debt after this archive move. QA Pass 2 is skipped for this hub closeout.
