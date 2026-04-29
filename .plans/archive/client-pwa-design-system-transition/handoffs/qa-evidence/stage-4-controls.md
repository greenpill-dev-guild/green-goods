# Stage 4 Controls Evidence

Date: 2026-04-29
Actor: Codex
Scope: lower-risk controls, cards, and forms source implementation and QA Pass 1 visual evidence

## Routes / Stories

- Representative source surfaces:
  - `packages/client/src/components/Cards/Base/Card.tsx`
  - `packages/client/src/components/Cards/Work/DraftCard.tsx`
  - `packages/client/src/components/Errors/AppErrorBoundary.tsx`
  - `packages/client/src/components/Features/Garden/Gardeners.tsx`
  - `packages/client/src/components/Inputs/Clipboard/AddressCopy.tsx`
  - `packages/client/src/components/Inputs/PullToRefresh.tsx`
  - `packages/client/src/views/Home/Garden/Assessment.tsx`
  - `packages/client/src/views/Home/GardenFilters/index.tsx`
  - `packages/client/src/views/Profile/ENSSection.tsx`
  - `packages/client/src/views/Profile/GardensList.tsx`
- Storybook visual targets:
  - `Client/Cards/ActionCard` gallery
  - `Client/Cards/DraftCard` gallery
  - `Client/PWA/ProtectedSurfaces` `Profile`

## State / Data Setup

- Covered in source: routine card press states, draft card warning surface, error recovery actions,
  gardener member controls, address copy focus/press behavior, pull-to-refresh indicator motion,
  garden filter selected state, assessment links/status text, ENS availability icon, and profile
  garden refresh control.
- Visual pass used the shared Storybook host at `http://127.0.0.1:6007/`, viewport `375x812`,
  and Playwright Chromium.

## What Was Verified

- Removed every fixed protected-PWA row from `scripts/data/design-token-usage-baseline.tsv` only
  after eliminating the matching source usage.
- Current `rg -n "packages/client/src" scripts/data/design-token-usage-baseline.tsv` output shows
  only deferred public/browser `Hero.tsx` rows.
- Routine controls use spring tokens for movement/color/focus without adding decorative motion.
- Stage 4 source changes stayed within client PWA files and plan artifacts; deferred public
  browser rows remain out of scope.
- Completion pass found invalid nested interactive markup in `DraftCard` while capturing the
  Storybook visual state. The root card is now a non-interactive wrapper, the resume action is an
  inner button, and the delete action remains a separate button with propagation stopped.
- Captured 375x812 representative control/card/profile screenshots:
  - `output/playwright/client-pwa-design-system-transition/stage-4/action-card-gallery-375x812.png`
  - `output/playwright/client-pwa-design-system-transition/stage-4/draft-card-gallery-375x812.png`
  - `output/playwright/client-pwa-design-system-transition/stage-4/pwa-profile-375x812.png`

## Validation

- Passed: `bun run check:design-tokens`
- Passed: `bun run check:design-generated`
- Passed: `bun run lint:vocab`
- Passed: path-scoped `oxlint`
- Passed: targeted client Vitest via bundled Node, including `GardensList.test.tsx` and
  `ENSSection.test.tsx`
- Passed: client `tsc --noEmit` via bundled Node
- Passed in completion pass: `bun run --cwd packages/shared check:stories`
- Passed in completion pass: `bun run --cwd packages/shared check:story-quality`
- Passed in completion pass: `bun run --filter @green-goods/client test`
- Passed in completion pass: `bun run --filter @green-goods/client build`

## Limitations

- `DraftCard` gallery screenshots include a fixture image path served as `/placeholder-tree.jpg`.
  Storybook logged a 404 for that static asset because the shared Storybook staticDirs configuration
  does not serve client public assets. The no-thumbnail state and control layout still rendered.
- Stage 4 Storybook evidence covers representative cards and profile controls. It does not replace
  installed-phone smoke; that proof gap was waived by the human owner on 2026-04-29.
