# Shared Package — Codex Guide

Use this guide when editing `packages/shared/**`.

## Role

`@green-goods/shared` is the single home for cross-app hooks, providers, stores, modules,
types, i18n, and Storybook-backed shared UI building blocks.

## UI Foundations

- `/Users/afo/Code/greenpill/green-goods/docs/docs/builders/packages/admin.mdx` is the consumer contract for admin UI.
- Reusable admin UI foundations belong here before they become package-local copies.
- Prefer extending shared `AppBar`, `NavigationBar`, `GardenChip`, `MainSheet`, `LeftSheet`, `RightSheet`, `BottomSheet`, `Alert`, `Card`, `DialogShell`, `FormField`, `ListToolbar`, `SortSelect`, and `StatusBadge`.
- New shared primitives and major variants need barrel exports, tests, and Storybook coverage in the same change.

## Commands

- `bun run test`
- `bun run typecheck`
- `bun run coverage`
- `bun run check:stories`

## Non-Negotiables

- All reusable hooks live here. Do not create parallel hooks in `client`, `admin`, or `agent`.
- Shared UI primitives should be consumed through `@green-goods/shared`, not recreated in app packages.
- Export public APIs through package barrels. Do not teach consumers deep import paths.
- Use centralized query keys from `queryKeys`; do not invent ad-hoc query arrays.
- Use `useCurrentChain()` or `DEFAULT_CHAIN_ID`, not wallet chain state, for application defaults.
- Prefer event-driven invalidation over polling.
- Add every new user-facing string to `src/i18n/en.json`, `src/i18n/es.json`, and `src/i18n/pt.json`.
- Use `logger` and typed domain models (`Address`, discriminated unions, `unknown` for untrusted data).

## Codex Notes

- Shared changes frequently fan out into `client`, `admin`, and `agent`. If you change a hook
  signature, data shape, or exported utility, run repo-level quick verification from the root.
- When changing test helpers or hook contracts, keep tests aligned before downstream package fixes.
- Storybook is the source of truth for shared UI foundations; keep stories aligned when primitives change.

## Validation

- Package loop: `bun run test && bun run typecheck`
- UI/stories touched: `bun run check:stories`
- Cross-package impact: from repo root run `node scripts/ci-local.js --quick`
