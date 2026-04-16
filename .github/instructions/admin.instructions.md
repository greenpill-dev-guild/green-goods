---
applyTo: "packages/admin/**,docs/docs/builders/packages/admin.mdx"
---

- Read `docs/docs/builders/packages/admin.mdx` before changing admin routes, layouts, or page structure. It is the active UI contract.
- `CanvasLayout` is the canonical shell. Treat `/hub` as the reference canvas surface.
- The default shell is `TopContextBar + .workspace-canvas + MainSheet + NavigationBar`. Do not start new work from `DashboardLayout`, `Sidebar`, or `Header`.
- Prefer shared/admin primitives such as `TopContextBar`, `NavigationBar`, `MainSheet`, `GardenChip`, `SideSheet`, `BottomSheet`, `DialogShell`, `ListToolbar`, `SortSelect`, `PageHeader`, and `AccountSheet` before inventing one-off wrappers.
- Admin is an operator cockpit, not a marketing surface. Favor utility copy, one dominant workspace surface, and explicit task hierarchy over card mosaics or promo treatments.
- Every privileged action must keep permission checks such as `useRole` or `useGardenPermissions`, and user-visible write actions should stay inside the shared toast workflow.
- Validate admin route or view work with `cd packages/admin && bun run test && bun run build`; if shared contracts or shared hooks move, also run `node scripts/ci-local.js --quick` from the repo root.
