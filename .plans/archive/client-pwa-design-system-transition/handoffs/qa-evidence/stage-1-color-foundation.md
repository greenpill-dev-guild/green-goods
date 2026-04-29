# Stage 1 Color Foundation Evidence

Date: 2026-04-28
Actor: Codex
Scope: Stage 1 only

## Files Changed For Stage 1

- `packages/client/src/styles/typography.css`
- `packages/client/src/styles/animation.css`
- `packages/client/src/styles/pwaStatusStyles.ts`
- `packages/client/src/__tests__/styles/pwaStatusStyles.test.ts`
- `packages/client/src/components/Navigation/TopNav.tsx`
- `packages/client/src/components/Navigation/Tabs/StandardTabs.tsx`
- `packages/client/src/components/Communication/Progress/Progress.tsx`
- `packages/client/src/routes/RequireAuth.tsx`
- `packages/client/src/views/Home/index.tsx`
- `packages/client/src/views/Home/WalletDrawer/Icon.tsx`
- `packages/client/src/views/Home/Garden/Notifications.tsx`
- `packages/client/src/views/Home/WorkDashboard/Icon.tsx`
- `packages/client/src/views/Home/WorkDashboard/PendingTab.tsx`
- `packages/client/src/views/Home/WorkDashboard/Drafts.tsx`
- `packages/client/src/components/Dialogs/ConvictionDrawer.tsx`
- `scripts/data/design-token-usage-baseline.tsv`
- `docs/docs/builders/packages/client-pwa-token-audit.generated.md`
- Plan truth/evidence files under this hub.

## What Changed

- Replaced the global green heading backing in `typography.css` with
  `var(--color-foreground)`.
- Added `pwaStatusStyles` with six tones: `primary`, `information`, `warning`, `success`,
  `error`, and `neutral`.
- The helper exposes token-backed slots for `text`, `icon`, `surface`, `border`, `dot`, `badge`,
  `progress`, `spinnerBorder`, `focus`, and `foreground`.
- Applied the helper to Stage 1 status surfaces only: nav, tabs, work dashboard icon/pending/draft
  status portions, form progress, auth loading, home filter, wallet icon, notifications,
  `animation.css`, and conviction status indicators.
- Preserved state text, labels, icons, badges, and shapes where they already existed, so color is
  not the only status indicator.
- Removed only fixed baseline TSV rows after the corresponding raw usage was gone.

## Validation

- `node scripts/harness/plan-hub.mjs validate`: passed with `Validated 19 feature hubs`.
- `bun run check:design-tokens`: passed.
- `bun run lint:vocab`: passed.
- `bun run check:design-generated`: initially failed because
  `docs/docs/builders/packages/client-pwa-token-audit.generated.md` was stale.
- `bun run design:generate`: run only after the generated-artifact gate reported staleness.
- `bun run check:design-generated`: passed after regeneration.
- Targeted helper/status tests passed:
  `bun run --filter @green-goods/client test -- src/__tests__/views/DraftsTab.test.tsx src/__tests__/styles/pwaStatusStyles.test.ts`.
- `bun run --filter @green-goods/client build`: passed. Rollup emitted existing dependency
  annotation/chunk-size warnings and generated PWA service worker assets.
- `bun run --filter @green-goods/client test`: ran and failed in unrelated dirty-tree areas:
  - `src/__tests__/views/Intro.test.tsx`: 6 failures because the current
    `@green-goods/shared` mock does not define `localizeAction`, which
    `src/views/Garden/Intro.tsx` now imports.
  - `src/__tests__/views/fund.test.tsx`: 3 public `/fund` dialog/receipt expectation failures.

## Visual Evidence

See `stage-1-browser-smoke.md` for the screenshot paths and browser proof details.

## Remaining Work

Final hub state update: Stages 2-4 are complete, the full client test/build gates passed in the
completion pass after unrelated mock drift was repaired, and no Stage 1 source or QA blocker
remains.
