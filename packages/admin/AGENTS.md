# Admin Package — Codex Guide

Use this guide when editing `packages/admin/**`.

## Role

The admin package is the operator cockpit for Green Goods stewards and deployers. It
depends on shared hooks, permissions, contract interaction helpers, and shared UI
foundations.

## UI Contract

- Read `/Users/afo/Code/greenpill/green-goods/docs/docs/builders/packages/admin.mdx` before changing routes, layouts, or page structure.
- The canonical shell is `CanvasLayout`.
- The Wave 3 shell is `TopContextBar + .workspace-canvas + MainSheet + NavigationBar`, with `LeftSheet`, `RightSheet`, and `BottomSheet` layered off that canvas instead of separate page chrome.
- `TopContextBar` is the sticky `z-40 h-14` context region: `GardenChip` on the left; desktop search, settings, and `UserAvatar` on the right.
- `NavigationBar` is pure navigation only. Use the canonical items `Hub`, `Garden`, `Community`, and `Actions`; do not add leading or trailing slots.
- `AppBar` is client/PWA chrome, not admin chrome. Keep admin navigation on `NavigationBar`.
- `ConnectShell` is the disconnected full-screen state with a centered connect prompt and no navigation.
- Shared owns `TopContextBar`, `NavigationBar`, `GardenChip`, `MainSheet`, `LeftSheet`, `RightSheet`, `BottomSheet`, and `SheetErrorBoundary`. Admin owns `CanvasLayout`, `AccountSheet`, `AccountSettingsPanel`, `AccountSurface`, `UserAvatar`, `ConnectShell`, `CommandPalette`, and `PageHeader`.
- Treat `DashboardLayout`, `Sidebar`, and `Header` as legacy migration code for new admin work.
- Prefer the primitives below before composing raw `rounded border bg shadow` layouts.
- Use `.surface-section`, `.surface-inset`, `.surface-card`, and `.workspace-canvas` before inventing one-off shell or page surface wrappers.
- Use `AccountSheet` for authenticated account/profile/settings flows; otherwise prefer shared `SideSheet`.

## Cockpit UI Mode

- Admin is an operator cockpit, not a marketing surface. Default to utility copy, not brand or campaign copy.
- Default route composition is `PageHeader` -> primary workspace -> optional secondary inspector (`SideSheet` or `BottomSheet`).
- Start from task flow and information hierarchy, not from `Card`.
- Use cards or elevated surfaces only when they represent a discrete record, action target, or bounded interactive unit.
- Prefer one dominant workspace surface per route. Avoid nested stacks of bordered panels that turn the page into a card mosaic.
- Avoid hero sections, decorative promo banners, decorative gradients behind routine UI, and ornamental icon rows.
- Keep color restrained: shared semantic tokens, one workspace accent, strong typography, minimal chrome.
- Treat `/hub` as the reference cockpit surface for new admin page composition.

## Preferred Primitives

- `TopContextBar`
- `NavigationBar`
- `MainSheet`
- `LeftSheet`
- `RightSheet`
- `BottomSheet`
- `GardenChip`
- `CommandPalette`
- `AccountSheet`
- `AccountSettingsPanel`
- `UserAvatar`
- `ConnectShell`
- `PageHeader`
- `ListToolbar`
- `SortSelect`
- `Surface`
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
- Use `DialogShell`, `AccountSheet`, `SideSheet`, or `BottomSheet` for modal and sheet flows instead of ad-hoc shells.
- New user-facing strings must be translated in all three locale files.

## Codex Notes

- Use `/Users/afo/Code/greenpill/green-goods/docs/docs/builders/packages/admin.mdx` as the single admin UI contract; do not recreate a package-local design doc.
- Keep reusable components and config helpers in `@green-goods/shared`. Admin owns only canvas shell, account surfaces, and admin-only workflows.
- Keep admin routes canonical: primary surfaces `/hub`, `/garden`, `/community`, `/actions`; Hub deep links stay under `/hub/work/*`; secondary route families should match the contract in `admin.mdx`.
- The default admin Vitest run excludes `src/__tests__/views/**` and a few heavy tests. Treat `bun run build` as a required validation step for route and view work until a dedicated view test runner exists.
- Permission and role changes often originate in shared code; use the root quick verification
  loop when shared contracts or shared hooks move.

## Validation

- Package loop: `bun run test && bun run build`
- Broader impact: from repo root run `node scripts/ci-local.js --quick`
