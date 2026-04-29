# Stage 2 Drawer And Overlay Evidence

Date: 2026-04-28
Actor: Codex
Scope: Stage 2 only

## Files Changed For Stage 2

- `packages/client/src/styles/pwaDrawerStyles.ts`
- `packages/client/src/__tests__/styles/pwaDrawerStyles.test.ts`
- `packages/client/src/components/Dialogs/ModalDrawer.tsx`
- `packages/client/src/components/Dialogs/DraftDialog.tsx`
- `packages/client/src/views/Home/WorkDashboard/index.tsx`
- `packages/client/src/views/Home/Garden/Work.tsx`
- `packages/client/src/components/Features/Garden/Gardeners.tsx`
- `packages/client/src/styles/animation.css`
- `scripts/data/design-token-usage-baseline.tsv`
- `docs/docs/builders/packages/client-pwa-token-audit.generated.md`
- Plan truth/evidence files under this hub.

## What Changed

- Added `pwaDrawerStyles`, a client-internal helper for token-backed drawer overlays, material
  surfaces, tab chrome, close controls, work approval drawer chrome, and close timing.
- Replaced Stage 2 raw overlays with `--color-overlay` plus `--blur-material-thick`.
- Moved shared bottom-sheet surfaces to `--color-material-thick`, `--shadow-float`, and
  `--radius-lg`/`--radius-2xl` backing.
- Replaced hardcoded close delays in `ModalDrawer` and `WorkDashboard` with
  `--spring-spatial-duration` parsing through `getPwaDrawerCloseDelayMs`.
- Preserved focus trap, Escape/backdrop dismissal, body scroll lock, AppBar hiding behavior, and
  `ModalDrawer.maxHeight`.
- Removed only fixed Stage 2 baseline rows; `Gardeners` member controls remain as the sole
  current Stage 2-adjacent row and are assigned to Stage 4.

## Validation

- `node scripts/harness/plan-hub.mjs validate`: passed with `Validated 19 feature hubs`.
- `bun run check:design-tokens`: passed.
- `bun run lint:vocab`: passed.
- `bun run check:design-generated`: initially failed because
  `docs/docs/builders/packages/client-pwa-token-audit.generated.md` was stale.
- `bun run design:generate`: run only after the generated-artifact gate reported staleness.
- `bun run check:design-generated`: passed after regeneration.
- Targeted Stage 2 tests passed:
  `bun run --filter @green-goods/client test -- pwaDrawerStyles DraftDialog WorkDashboard`.
- `git diff --check` on the Stage 2 touched paths: passed.
- `bun run --filter @green-goods/client test`: ran and failed only in
  `src/__tests__/views/Intro.test.tsx` because the current `@green-goods/shared` mock does not
  define `localizeAction`, which `src/views/Garden/Intro.tsx` imports. Result: 48 files passed,
  1 file failed; 320 tests passed, 6 failed.
- `bun run --filter @green-goods/client build`: blocked twice by Varlock/1Password while resolving
  `VITE_PINATA_JWT`:
  `1Password CLI error - error initializing client: authorization timeout`.

## Visual Evidence

Storybook initially failed under the sandbox with
`Invariant failed: expected options to have a port`; it started successfully outside the sandbox at
`http://localhost:6007/`. Playwright Chromium also required running outside the sandbox.

Screenshots captured under
`output/playwright/client-pwa-design-system-transition/stage-2/`:

- `modal-drawer-with-tabs-375x812.png`
- `modal-drawer-long-content-375x812.png`
- `modal-drawer-long-content-390x844.png`
- `modal-drawer-mobile-390x844.png`
- `appbar-hidden-work-dashboard-375x812.png`

DOM evidence from the captured Storybook run:

- `ModalDrawer` panel class included `bg-[var(--color-material-thick)]`,
  `backdrop-blur-[var(--blur-material-thick)]`, `rounded-t-[var(--radius-lg)]`,
  `shadow-[var(--shadow-float)]`, and `border-stroke-soft-200`.
- `ModalDrawer` long-content story applied `maxHeight`: `568.4px` at 375x812 and `590.8px` at
  390x844, confirming the `maxHeight` prop is now honored.
- `Client/Layout/AppBar` `HiddenWhenWorkDashboardOpen` retained `translate-y-full` on
  `data-testid="authenticated-nav"`.

## Visual Proof Limits

- No existing Storybook story exercises the `TopNav` notification drawer with real pending work.
  Code evidence confirms `TopNav` still passes `maxHeight="60vh"` through `ModalDrawer`; the
  visual proof is limited to the `ModalDrawer` long-content story.
- No existing Storybook story or seeded browser route was available for the operator work approval
  drawer at `/home/:id/work/:workId`, so that workflow still needs QA Pass 1 visual signoff.
- `DraftDialog` and `Gardeners` dialog chrome were covered by code/tests and token gates, but no
  existing visual story was available for screenshot proof in this pass.

## Remaining Work

- Stage 3 and Stage 4 source implementation are complete in the final hub state.
- No Stage 2 source work remains. Seeded/mobile screenshots for TopNav notifications, the work
  approval drawer, DraftDialog, and Gardeners dialog were not all captured in this Stage 2 pass;
  QA Pass 1 recorded the available Storybook/source evidence and no longer treats this as an
  archive blocker.
