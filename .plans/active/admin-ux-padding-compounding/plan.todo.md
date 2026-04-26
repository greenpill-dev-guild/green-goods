# Admin Padding Compounding

**Slug**: `admin-ux-padding-compounding`
**Status**: `ACTIVE`
**Created**: `2026-04-25`
**Priority**: `p2`
**Branch**: `feature/admin-padding-compounding`

## Why this exists

Across admin views, content nests through `MainSheet → Surface → Surface → Card`, and each layer adds its own padding. The result feels cramped on mobile and wastes horizontal space at desktop. One careful pass through the canvas wrappers lets every admin view inherit the fix without per-view edits.

## Background

- `MainSheet` at `packages/shared/src/components/Canvas/MainSheet.tsx` — sets layout width and inner radius (`1.25rem`)
- Admin Surface / Card wrappers live under `packages/admin/src/components/`
- Hub view is the densest victim: `packages/admin/src/views/Hub/` (recently decomposed from 1376→605 LOC, see git log)
- Concentricity rule from design language: `child_radius = parent_radius − padding`

## Approach

1. Inventory every wrapper that sets padding inside MainSheet's content tree (`grep -rn 'data-component=' packages/admin/src/components/` plus `packages/shared/src/components/Canvas/`).
2. Define one canonical padding contract per nesting depth (Sheet → Surface → Card), encoded as design tokens. Use existing spacing scale; no raw px.
3. Apply concentricity rule when adjusting radii at each layer.
4. Fix Hub first (highest density); then sweep Garden, Action, Hypercerts, Vault, Community.
5. Visually verify in Storybook + Chrome MCP at 375 / 768 / 1024 / 1440.

## Constraints

- Do **not** add Tailwind utility classes inside `packages/shared/src/` for new layout — silent scan failure. See CLAUDE.md "Known Gotchas". Use inline styles or token-driven CSS in shared; keep Tailwind utilities in admin/client.
- Strict M3 anatomy in admin — no glass on Surface or Card. (Glass only on `AdminAppBar`.)
- All motion via spring tokens; no hardcoded `cubic-bezier` or duration literals.
- Tokens: prefer existing `--spacing-*` / `--radius-*` from `packages/shared/src/styles/theme.css`.

## Success

- Hub at 375px shows content edges aligned with sheet edges (no compounded inset).
- Canonical token contract documented inline in `theme.css` or surface-level component comment (one line, why-not-what).
- No visible regressions in Garden / Action / Hypercerts / Vault views at 4 breakpoints.
- `bun run check:design-tokens && bun run lint:vocab && bun run test` pass.

## Out of scope

- Visual refresh of typography, color, or component vocabulary
- Sheet animation work (see `admin-sheet-animation-retune`)
- Client PWA padding (admin-only pass)

## Checklist

- [ ] Audit current padding per layer (Sheet, Surface variants, Card variants).
- [ ] Define canonical token contract (one tier per layer).
- [ ] Apply to MainSheet / Surface / Card primitives.
- [ ] Sweep Hub.
- [ ] Sweep Garden, Action, Hypercerts, Vault, Community.
- [ ] Storybook visual diff captured.
- [ ] Chrome MCP screenshots at 375 / 768 / 1024 / 1440.
- [ ] Validation suite green.
