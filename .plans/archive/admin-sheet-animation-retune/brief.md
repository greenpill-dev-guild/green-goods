# Admin Sheet Animation Retune

**Slug**: `admin-sheet-animation-retune`
**Stage**: `active`
**Priority**: `p2`
**Created**: `2026-04-26T09:25:59.246Z`

## Problem

The recede animation in `MainSheet` currently transitions `opacity + transform + filter (blur)` simultaneously on shared duration and easing tokens. On lower-end Android, animated `filter: blur()` stacks paints on top of any overlay sheet's `backdrop-filter`, producing a visible sluggishness. A token-level retune (fewer animated properties + lighter blur strategy) lifts perceived performance across every sheet open without rewriting the spatial language.

## Desired Outcome

- Frame budget on sheet open improves measurably under throttled Chrome MCP (record before/after).
- Reduced-motion path unchanged.
- Visual recede effect remains clearly distinct from "sheet not open" at full opacity.

## Scope Notes

- Primary lane: `ui`
- Detailed checklist: [plan.todo.md](./plan.todo.md)
- Out of scope:

- Padding compounding (see `admin-ux-padding-compounding`)
- New motion language — this is retune, not redesign.
- Client PWA motion.
