# Stage 3 Loading Evidence

Date: 2026-04-29
Actor: Codex
Scope: loading/splash motion source implementation and QA Pass 1 visual evidence

## Routes / Stories

- `packages/client/src/components/Layout/Splash.tsx`
- `packages/client/src/views/Login/components/LoadingSplash.tsx`
- `Client/Layout/Splash` `Default`
- `Client/Layout/Splash` `WithUsernameInput`
- `Client/Layout/Splash` `WithError`
- `Client/Layout/Splash` loading/reduced-motion state

## State / Data Setup

- Covered in source: welcome/default message, loading state, joining-garden prompt, username
  input reveal, info callout reveal, error alert reveal, secondary action visibility, and
  tertiary action visibility.
- Visual pass used the shared Storybook host at `http://127.0.0.1:6007/`, viewport `375x812`,
  Playwright Chromium, and the Storybook Splash fixtures.
- Reduced-motion pass used Playwright's `prefers-reduced-motion: reduce` emulation and confirmed
  `matchMedia("(prefers-reduced-motion: reduce)").matches` was `true` during capture.
- No new user-facing strings were added.

## What Was Verified

- Replaced raw `transition-all`, `duration-*`, and local easing in `Splash` with Warm Earth
  spring-token classes.
- Preserved fixed-height title/action regions and max-height/opacity reveal behavior for username
  input and info callout states.
- Replaced raw spinner color treatment with token-backed `pwaStatusStyles.primary.spinnerBorder`
  and `border-primary-alpha-24`.
- Replaced `LoadingSplash` raw duration/spinner styling with spring-token motion and
  `pwaStatusStyles`.
- Reduced-motion behavior remains anchored in the existing global reduced-motion stylesheet guard;
  this pass did not introduce custom animation code outside that token model.
- Captured 375x812 loading-state screenshots:
  - `output/playwright/client-pwa-design-system-transition/stage-3/splash-default-375x812.png`
  - `output/playwright/client-pwa-design-system-transition/stage-3/splash-username-375x812.png`
  - `output/playwright/client-pwa-design-system-transition/stage-3/splash-error-375x812.png`
  - `output/playwright/client-pwa-design-system-transition/stage-3/splash-loading-reduced-motion-375x812.png`

## Validation

- Passed: `bun run check:design-tokens`
- Passed after gated regeneration: `bun run check:design-generated`
- Passed: targeted client Vitest via bundled Node, including the style helper tests
- Passed: client `tsc --noEmit` via bundled Node
- Passed in completion pass: `bun run --filter @green-goods/client test`
- Passed in completion pass: `bun run --filter @green-goods/client build`

## Limitations

- Storybook logged a static asset 404 for `/icon.png` in the Splash fixtures because
  `packages/shared/.storybook/main.ts` serves only the shared design-asset folder. The app build
  passed, so this is recorded as a Storybook fixture limitation rather than an app asset
  regression.
- The invalid exploratory screenshot `splash-gallery-375x812.png` rendered a Storybook router
  fixture error and is not accepted as QA evidence.
