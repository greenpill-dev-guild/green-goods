# Client Package — Agent Guide

Use this guide when editing `packages/client/**`.

## Role

The client package is the end-user web app. Hooks, providers, stores, and most business logic
should come from `@green-goods/shared`.

## Commands

- `bun run test`
- `bun run build`
- `bun run lint`

## Non-Negotiables

- Do not create local hooks or providers when the logic belongs in `@green-goods/shared`.
- Work submission must preserve the offline-first queue flow; do not bypass the queue for
  passkey users.
- Prefer event-driven invalidation over polling.
- Manage blob URLs through shared utilities such as `mediaResourceManager`; do not leave
  orphaned `URL.createObjectURL` values behind.
- Authentication branches through shared auth APIs. Do not treat wallet chain state as the
  source of truth for app defaults.
- New user-facing strings must be translated in all three locale files.

## Design Surfaces

- Root `AGENTS.md` and `.claude/skills/design/system-alignment-review.md` own the Warm Earth
  source map. Do not restate or fork the design spec here.
- Public/browser routes should stay on the public shell path (`PublicShell` + `SiteHeader`).
- Installed/authenticated PWA routes should stay on the protected app shell path (`AppShell` +
  bottom `AppBar`).
- If a route or shell change blurs those paths, verify `router.tsx`, the shell component, and the
  relevant Storybook story in the same pass.

## Package Notes

- Client changes commonly depend on shared hooks and providers. If the change reaches into
  `@green-goods/shared`, validate from the repo root, not only from this package.
- In QA Speed Mode, run targeted view/component tests when relevant and capture authenticated
  rendered proof for visible UI. Build only when route wiring, render/build output, or PWA
  packaging behavior moves.
- Route and rendering contract changes should get a build before PR/ship readiness, not only tests.
- Follow root `AGENTS.md` section “Agentic Modern Web Standard” for browser proof. Local PWA QA uses
  the authenticated Brave QA profile: Codex uses the Codex browser-extension path, and Claude uses
  the Claude Code Chrome/Chromium extension path to claim the authenticated Brave profile/tab. Do
  Do not use isolated Browser, Playwright, or DevTools MCP profiles for local QA.
  If authenticated Brave access is blocked, stop and report QA as blocked.

## Validation

- QA Speed Mode: targeted `bun run test -- src/...` or rendered proof; add `bun run build` only for route/render/PWA build risk
- Package loop: `bun run test && bun run build`
- Shared impact or cross-package changes: from repo root run `node scripts/dev/ci-local.js --quick`
