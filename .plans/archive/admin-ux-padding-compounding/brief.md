# Admin Padding Compounding

**Slug**: `admin-ux-padding-compounding`
**Stage**: `active`
**Priority**: `p2`
**Created**: `2026-04-26T09:25:59.246Z`

## Problem

Across admin views, content nests through `MainSheet → Surface → Surface → Card`, and each layer adds its own padding. The result feels cramped on mobile and wastes horizontal space at desktop. One careful pass through the canvas wrappers lets every admin view inherit the fix without per-view edits.

## Desired Outcome

- Hub at 375px shows content edges aligned with sheet edges (no compounded inset).
- Canonical token contract documented inline in `theme.css` or surface-level component comment (one line, why-not-what).
- No visible regressions in Garden / Action / Hypercerts / Vault views at 4 breakpoints.
- `bun run check:design-tokens && bun run lint:vocab && bun run test` pass.

## Scope Notes

- Primary lane: `ui`
- Detailed checklist: [plan.todo.md](./plan.todo.md)
- Out of scope:

- Visual refresh of typography, color, or component vocabulary
- Sheet animation work (see `admin-sheet-animation-retune`)
- Client PWA padding (admin-only pass)
