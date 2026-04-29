# Stage 3 Media Evidence

Date: 2026-04-29
Actor: Codex
Scope: garden media/status source implementation and QA Pass 1 visual evidence

## Routes / Stories

- `packages/client/src/views/Garden/Media.tsx`
- `packages/client/src/views/Garden/index.tsx`
- `Client/PWA/ProtectedSurfaces` `GardenWorkCapture`
- Matrix targets waived by the human owner on 2026-04-29: `/garden` media step with real bright
  outdoor thumbnails and video thumbnails.

## State / Data Setup

- Covered in source: minimum-media requirement badge, image/video previews, video play overlay,
  image zoom overlay, compression progress, video duration error, active recording state, and
  media action-bar image/camera/mic/stop icons.
- Visual pass used the shared Storybook host at `http://127.0.0.1:6007/`, viewport `375x812`,
  Playwright Chromium, and the protected PWA GardenWorkCapture fixture.
- Existing blob URL cleanup, media source tracking, image compression, video duration validation,
  and audio recording completion paths were not changed.

## What Was Verified

- Requirement badge now uses `pwaStatusStyles.success` or `pwaStatusStyles.warning` instead of
  local semantic color alpha classes.
- Compression progress now uses `pwaStatusStyles.information` and spring-token width transition.
- Video error and recording states now use `pwaStatusStyles.error`.
- Video play and image zoom overlays now use `--color-overlay` with `text-static-white`
  foreground over media.
- `/garden` action-bar media icons now use `pwaStatusStyles.primary.icon`; the active stop icon
  uses `pwaStatusStyles.error.foreground`.
- Captured 375x812 media/progress screenshot:
  - `output/playwright/client-pwa-design-system-transition/stage-3/garden-work-capture-375x812.png`

## Validation

- Passed: `bun run check:design-tokens`
- Passed: `bun run check:design-generated`
- Passed: targeted client Vitest via bundled Node, including `Media.test.tsx` and `Garden.test.tsx`
- Passed: client `tsc --noEmit` via bundled Node
- Passed in completion pass: `bun run --filter @green-goods/client test`
- Passed in completion pass: `bun run --filter @green-goods/client build`

## Limitations

- `GardenWorkCapture` covers the protected PWA capture/progress state, but it is not a real media
  thumbnail fixture.
- Overlay contrast over real bright outdoor thumbnails and video thumbnails was not captured with a
  seeded `/garden` run, real device/simulator run, or dedicated thumbnail fixture. The human owner
  waived this proof gap on 2026-04-29, so it is not an archive blocker for this hub.
