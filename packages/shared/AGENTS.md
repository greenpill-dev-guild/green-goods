# Shared Package — Agent Guide

Use this guide when editing `packages/shared/**`.

## Role

`@green-goods/shared` is the single home for cross-app hooks, providers, stores, modules,
types, i18n, and Storybook-backed shared UI building blocks.

## UI Foundations

- `/Users/afo/Code/greenpill/green-goods/docs/docs/builders/packages/admin.mdx` is the consumer contract for admin UI.
- Reusable admin UI foundations belong here before they become package-local copies.
- Prefer extending shared `AppBar`, `NavigationBar`, `GardenChip`, `MainSheet`, `Alert`, `Card`, `DialogShell`, `FormField`, `ListToolbar`, `SortSelect`, and `StatusBadge`. (The Canvas `LeftSheet`/`RightSheet`/`BottomSheet` renderers are deleted — admin overlays are centered `AdminDialog`s owned by the admin package.)
- New shared primitives and major variants need barrel exports, tests, and Storybook coverage in the same change.

## Commands

- `bun run test`
- `bun run typecheck`
- `bun run coverage`
- `bun run check:stories`

## Non-Negotiables

- All reusable hooks live here. Do not create parallel hooks in `client`, `admin`, or `agent`.
- Shared UI primitives should be consumed through `@green-goods/shared`, not recreated in app packages.
- Declared subpaths in `package.json#exports` are public API; deep `src/**` paths are not. Prefer the narrowest declared public subpath when it avoids unrelated runtime coupling.
- Use centralized query keys from `queryKeys`; do not invent ad-hoc query arrays.
- Use `useCurrentChain()` or `DEFAULT_CHAIN_ID`, not wallet chain state, for application defaults.
- Prefer event-driven invalidation over polling.
- Add every new user-facing string to `src/i18n/en.json`, `src/i18n/es.json`, and `src/i18n/pt.json`.
- Use `logger` and typed domain models (`Address`, discriminated unions, `unknown` for untrusted data).

## Package Notes

- Shared changes frequently fan out into `client`, `admin`, and `agent`. If you change a hook
  signature, data shape, or exported utility, run repo-level quick verification from the root.
- In QA Speed Mode for an internal shared fix, run the targeted shared test plus `bun run typecheck`
  when types/contracts are touched. Escalate to root quick verification only when exports, hook
  signatures, provider contracts, shared data shapes, or mutation flows can affect consumers.
- When changing test helpers or hook contracts, keep tests aligned before downstream package fixes.
- Storybook is the source of truth for shared UI foundations; keep stories aligned when primitives change.
- Visible consumer changes follow root `AGENTS.md` section “Agentic Modern Web Standard”; if its
  authenticated Brave path is unavailable, report browser QA as `BLOCKED`.
- **Tailwind v4 gotcha**: utility classes authored in shared JSX (`mx-4`, `w-max`, `self-center`, etc.) are not in admin/client content scans and silently fail to generate in consuming apps. They will look correct in Storybook and broken in the running app. Use inline styles or CSS custom properties for layout in shared components, or apply the utility class in the consumer's JSX. Full detail and commit references in root `AGENTS.md` → "Known Gotchas".

## Validation

- QA Speed Mode: targeted `bun run test -- src/...`; add `bun run typecheck` when shared types or contracts move.
- Package loop: `bun run test && bun run typecheck`.
- Conditional proof: run `bun run check:stories` for shared UI or story changes.
- Broader impact: run the root Repo Quick Gate when public exports, hooks, providers, data shapes, or mutation flows affect consumers.
