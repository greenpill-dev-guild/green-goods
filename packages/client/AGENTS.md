# Client Package — Codex Guide

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

## Codex Notes

- Client changes commonly depend on shared hooks and providers. If the change reaches into
  `@green-goods/shared`, validate from the repo root, not only from this package.
- Route and rendering changes should always get a build, not only tests.

## Validation

- Package loop: `bun run test && bun run build`
- Shared impact or cross-package changes: from repo root run `node scripts/ci-local.js --quick`
