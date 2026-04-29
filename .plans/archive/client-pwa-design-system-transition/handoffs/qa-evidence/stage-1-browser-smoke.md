# Stage 1 Browser Smoke

Date: 2026-04-28
Actor: Codex
Viewport: 375x812
Browser: Playwright Chromium

## Server / Tooling Notes

- `bun run --filter @green-goods/client build` passed before browser smoke.
- `bun run preview -- --host 127.0.0.1 --port 4173` from `packages/client` was blocked by
  Varlock/1Password env resolution:
  `VITE_PINATA_JWT` could not authenticate with 1Password, and `TELEGRAM_BOT_TOKEN` plus
  `ENCRYPTION_SECRET` were empty.
- Browser smoke used the built `packages/client/dist` bundle through a read-only local static SPA
  server instead.
- Sandboxed Chromium launch failed with macOS Mach port permission errors, so Playwright
  screenshots were captured with approved escalation.
- Direct installed `/home` proof was not used because the live protected PWA route requires auth
  state. Installed PWA state evidence used the repo's Storybook harness instead.

## Installed PWA Storybook Evidence

Storybook was started from `packages/shared` and served on `http://127.0.0.1:6007/`.

Screenshots:

- `output/playwright/client-pwa-design-system-transition/pwa-protected-home.png`
- `output/playwright/client-pwa-design-system-transition/pwa-garden-work-capture.png`
- `output/playwright/client-pwa-design-system-transition/pwa-offline-sync-status.png`
- `output/playwright/client-pwa-design-system-transition/pwa-appbar-state-catalog.png`

Verified:

- `Client/PWA/ProtectedSurfaces` `Home`: heading ink, primary filter badge, primary progress, active
  tab status, and bottom `AppBar`.
- `Client/PWA/ProtectedSurfaces` `GardenWorkCapture`: form progress and upload progress states.
- `Client/PWA/ProtectedSurfaces` `OfflineAndSyncStatus`: warning/information status copy remains
  visible with non-color text and icon indicators.
- `Client/Layout/AppBar` `StateCatalog`: bottom app navigation active state remains visible.

Known limitation:

- `Client/Layout/AppBar` `StateCatalog` uses fixed bottom navigation, so the screenshot is useful
  for active nav color/state only, not for judging the panel framing inside each catalog row.

## Public Browser Smoke

Screenshots:

- `output/playwright/client-pwa-design-system-transition/public-root-light.png`
- `output/playwright/client-pwa-design-system-transition/public-root-dark.png`
- `output/playwright/client-pwa-design-system-transition/public-gardens-light.png`
- `output/playwright/client-pwa-design-system-transition/public-gardens-dark.png`

Computed heading color evidence:

- `/`, light: first `h1` color `rgb(12, 10, 9)`.
- `/`, dark: first `h1` color `rgb(250, 250, 249)`.
- `/gardens`, light: first `h1` color `rgb(12, 10, 9)`.
- `/gardens`, dark: first `h1` color `rgb(250, 250, 249)`.

Known limitation:

- Public `/` first viewport still shows existing hero/media composition issues in the current dirty
  tree. This pass did not touch public browser hero/editorial work, per scope.
