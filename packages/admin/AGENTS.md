# Admin Package — Codex Guide

Use this guide when editing `packages/admin/**`.

## Role

The admin package is the operator and deployer dashboard. It depends on shared hooks,
permissions, and contract interaction helpers.

## Commands

- `bun run test`
- `bun run test:coverage`
- `bun run build`
- `bun run lint`

## Non-Negotiables

- Do not add local hooks or providers when the logic belongs in `@green-goods/shared`.
- Every privileged action must flow through permission checks such as `useRole` or
  `useGardenPermissions`.
- Wrap user-visible write actions in the shared toast workflow instead of ad-hoc transaction UI.
- Use Radix dialog patterns for modal forms and multi-step flows.
- New user-facing strings must be translated in all three locale files.

## Codex Notes

- The default admin Vitest run excludes `src/__tests__/views/**` and a few heavy tests. Treat
  `bun run build` as a required validation step for route and view work until a dedicated view
  test runner exists.
- Permission and role changes often originate in shared code; use the root quick verification
  loop when shared contracts or shared hooks move.

## Validation

- Package loop: `bun run test && bun run build`
- Broader impact: from repo root run `node scripts/ci-local.js --quick`
