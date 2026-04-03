# ADR-017: Admin Cockpit Desktop Interface

**Date**: 2026-04-03
**Status**: Accepted

## Context

The admin package serves garden operators, deployers, and platform managers who need to review work submissions, manage gardens, configure actions, and oversee on-chain state. The original admin layout used a fixed sidebar navigation (`DashboardLayout`) with a persistent header. As the number of admin surfaces grew -- contracts tables, endowment grids, vault management, community views -- the sidebar consumed ~240px of horizontal space on every view, squeezing dense data tables on standard-width monitors. Operators reported that they primarily navigated via keyboard shortcuts rather than clicking sidebar links, making the persistent sidebar low-value visual weight.

Separately, the platform uses Hats Protocol for role-based access. Different operators have different permissions -- a deployer can create gardens and actions, an operator can review work, but neither should see UI controls they cannot use. The original sidebar showed all links regardless of role, creating confusion about what actions were available.

## Decision

The admin uses a **cockpit** layout pattern centered on a floating toolbar and command palette, with the following key mechanics:

### 1. Sidebar-to-Floating-Toolbar Migration

The fixed sidebar was replaced by a `FloatingToolbar` component (`packages/shared/src/components/Cockpit/FloatingToolbar.tsx`). On desktop (>=600px), it renders as a vertical floating pill fixed to the left edge, vertically centered. On narrower viewports, it renders as a horizontal bottom bar with safe-area inset. The toolbar auto-hides invisible slots and disappears entirely when fewer than 2 slots are visible. Content views get full-width layout with a 80px left offset on desktop (`min-[600px]:pl-20`) to clear the toolbar.

A `TopContextBar` sits above the content providing garden selection (via `GardenChip`), search access, settings, and user identity.

### 2. Single Layout, No Fullscreen Split

All admin routes render inside `DashboardShell` (`packages/admin/src/routes/DashboardShell.tsx`), which mounts `CockpitLayout` (`packages/admin/src/components/Layout/CockpitLayout.tsx`). There is no separate fullscreen layout -- all views, including garden creation, deployment flows, and detailed work review, render within the cockpit shell. Focused workflows use route-level guards (e.g., `RequireDeployer`, `RequireSpecificGarden`) rather than layout switching.

### 3. Command Palette as Primary Navigation

The admin uses a command palette (`CommandPalette`, `packages/admin/src/components/Layout/CommandPalette.tsx`) triggered by Cmd+K / Ctrl+K. The palette searches across five categories: quick actions, pages, gardens, actions, and assessments. Quick actions are role-gated -- only actions the user's role permits appear in results. The palette debounces search input by 300ms and supports full keyboard navigation (arrow keys + Enter). Traditional nav links exist in the toolbar slots but the palette is the power-user path for operators who manage multiple gardens.

### 4. Role-Adaptive Toolbar Permissions

The `useEffectiveToolbarPermissions` hook (`packages/shared/src/hooks/roles/useEffectiveToolbarPermissions.ts`) computes toolbar slot visibility based on the user's garden-level roles aggregated across all managed gardens (or scoped to the selected garden). The permission model:

- **Work**: visible to any user with any role in any garden
- **Garden**: visible to operators and owners only
- **Community**: visible to operators and owners only
- **Actions**: visible to deployers and platform operators only

The hook uses a fail-open strategy: while loading or on error, all slots are visible. This prevents a flash of missing navigation on initial load. The `CockpitLayout` filters toolbar `slots` by `permissions.show*` flags before passing them to `FloatingToolbar`.

### 5. Desktop-Only Assumption

The admin makes no effort to be a PWA or support offline workflows. It targets desktop Chrome/Firefox for operators managing on-chain state. The `FloatingToolbar` has a mobile layout (bottom bar) as a responsive concession for window resizing and tablet use, but the admin is not designed for mobile field work -- that is the client's domain.

## Consequences

- **Enables**: Views get full-width layout for data-dense tables and grids. The command palette provides fast O(1) navigation to any entity. Role-adaptive visibility means operators see only what they can act on.
- **Constrains**: All new admin views must render within `CockpitLayout` -- there is no escape hatch for a different shell. New toolbar slots require updating `useEffectiveToolbarPermissions` with the appropriate role gate. The command palette must be kept in sync with the route tree.
- **Trade-off**: The floating toolbar has less discoverability than a sidebar for first-time users. Mitigation: the `TopContextBar` provides visible search and settings entry points, and the command palette footer shows keyboard hints. The fail-open permission strategy means users may briefly see nav items they cannot use during loading, traded against the alternative of a navigation flash on every page load.
- **Dependency**: Role computation depends on Hats Protocol on-chain state via `useRole` and garden membership lists via `useGardens`. If the indexer lags, the fail-open default ensures the admin remains navigable.
