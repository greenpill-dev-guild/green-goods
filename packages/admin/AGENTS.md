# Admin Package — Codex Guide

Use this guide when editing `packages/admin/**`.

## Role

The admin package is the operator cockpit for Green Goods stewards and deployers. It
depends on shared hooks, permissions, contract interaction helpers, and shared UI
foundations.

## UI Contract

- Read `DESIGN_SYSTEM.md` before changing routes, layouts, or page structure.
- The canonical shell is `CockpitLayout`.
- Wave 3 shell is a 3-region layout: `TopContextBar` at the top, `.workspace-canvas` as the main workspace, and a bottom-floating `NavigationBar`.
- `TopContextBar` is the sticky `z-40 h-14` context region: `GardenChip` on the left; desktop search, settings, and `UserAvatar` on the right.
- `NavigationBar` is pure navigation only. Use the canonical items `Work`, `Garden`, `Community`, and `Actions`; do not add leading or trailing slots.
- `ConnectShell` is the disconnected full-screen state with a centered connect prompt and no navigation.
- Shared owns `TopContextBar`, `NavigationBar`, `GardenChip`, `SideSheet`, `BottomSheet`, and `SheetErrorBoundary`. Admin owns `CockpitLayout`, `SettingsSheet`, `UserAvatar`, `ConnectShell`, `CommandPalette`, and `PageHeader`.
- Treat `DashboardLayout`, `Sidebar`, and `Header` as legacy migration code for new admin work.
- Prefer the primitives below before composing raw `rounded border bg shadow` layouts.
- Use `.surface-section`, `.surface-inset`, `.surface-card`, and `.workspace-canvas` before inventing one-off shell or page surface wrappers.
- Use admin `SettingsSheet` for cockpit settings flows; otherwise prefer shared `SideSheet`.

## Preferred Primitives

- `TopContextBar`
- `NavigationBar`
- `GardenChip`
- `CommandPalette`
- `SettingsSheet`
- `UserAvatar`
- `ConnectShell`
- `SideSheet`
- `PageHeader`
- `ListToolbar`
- `SortSelect`
- `Card`
- `Alert`
- `StatusBadge`
- `FormField`
- `DialogShell`

## Commands

- `bun run test`
- `bun run test:coverage`
- `bun run build`
- `bun run lint`

## Non-Negotiables

- Do not add local hooks or providers when the logic belongs in `@green-goods/shared`.
- Reach for shared/admin primitives before adding one-off layout wrappers or duplicated UI.
- Every privileged action must flow through permission checks such as `useRole` or
  `useGardenPermissions`.
- Wrap user-visible write actions in the shared toast workflow instead of ad-hoc transaction UI.
- Use `DialogShell`, `SettingsSheet`, or `SideSheet` for modal and sheet flows instead of ad-hoc shells.
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
