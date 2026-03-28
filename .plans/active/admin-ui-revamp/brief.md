# Admin UI Revamp & Two-App Architecture

**Slug**: `admin-ui-revamp`
**Stage**: `active`
**Priority**: `p1`
**Created**: `2026-03-26`

## Problem

The admin dashboard serves all 6 roles (gardener through owner) with a generic sidebar + header + content layout. This creates a confused audience — funders see operator tools, community members see deployer routes, and the interface feels like a standard desktop dashboard rather than a purpose-built tool. Meanwhile, greengoods.app on desktop is a dead-end hero page.

## Desired Outcome

- Admin becomes a focused **operator/evaluator cockpit** with spatial depth, floating toolbar, and cross-garden workflows
- greengoods.app becomes a **living public platform** where community members browse gardens, funders deposit into vaults, and gardeners install the PWA
- Each surface is purpose-built for its audience and doesn't try to serve everyone
- The cockpit feels like an app, not a dashboard — no sidebar, depth-based hierarchy, M3 design patterns

## Scope Notes

- In scope: UI architecture split, wireframes, route structure, toolbar design, M3 integration, mobile cockpit, /fund view, empty states, install flow refinement, route consolidation (assessments into /work, endowments into /community, deployer into settings), role-adaptive toolbar, public /actions gallery on greengoods.app, "Govern" renamed to "Community"
- In scope: deposit-only on public /fund (no withdraw)
- In scope (deferred): Spatial/circular desktop layouts for greengoods.app, RevNet token funding path
- In scope: Two new hooks + one extended store — extend existing `useAdminStore` in shared (add stale-garden guard for garden selection), create `useEffectiveToolbarPermissions` (toolbar slot visibility — composes existing hooks, no new data fetching), create `useCrossGardenQueue` (Phase 2 — client-side merge of per-garden work items). All compose existing data; no new indexer queries.
- Out of scope: Contract changes, indexer changes.

## Success Signal

An operator with 3 gardens can open the cockpit, see their pending review queue across all gardens, approve work, create an assessment (full-screen overlay), and switch gardens — all without a page navigation, using only the floating toolbar and side sheets. An evaluator opening the same cockpit sees only the Work tab in their toolbar — no Garden or Community clutter.
