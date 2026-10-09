---
applyTo: "packages/admin/**,docs/docs/builders/packages/admin.mdx"
---

- Read `packages/admin/AGENTS.md`, `packages/admin/DESIGN.md`, exported admin primitives, and
  relevant guard tests before changing admin routes, layouts, or page structure. The public
  Builder page explains the surface; it does not own the implementation contract.
- `CanvasLayout` is the canonical shell. Treat `/hub` as the reference canvas surface.
- The default shell is `AppBar + .workspace-canvas + MainSheet + NavigationBar`. Do not start new work from `DashboardLayout`, `Sidebar`, or `Header`.
- Prefer shared/admin primitives such as `AppBar`, `NavigationBar`, `MainSheet`, `GardenChip`, `AdminDialog`, `AdminConfirmDialog`, `AdminSideSheet` (three global AppBar surfaces only), `ListToolbar`, `SortSelect`, `PageHeader`, and `AccountSurface` before inventing one-off wrappers. The old `LeftSheet`/`RightSheet`/`BottomSheet` renderers are deleted; workspace overlays are centered `AdminDialog`s.
- Admin is an operator cockpit, not a marketing surface. Favor utility copy, one dominant workspace surface, and explicit task hierarchy over card mosaics or promo treatments.
- Every privileged action must keep permission checks such as `useRole` or `useGardenPermissions`, and user-visible write actions should stay inside the shared toast workflow.
- Select validation through root `AGENTS.md` and the package guide; use focused proof and the
  required cross-package checks when shared contracts move.
