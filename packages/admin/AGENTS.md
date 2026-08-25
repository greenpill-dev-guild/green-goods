# Admin Package — Agent Guide

Use this guide when editing `packages/admin/**`.

## Role

The admin package is the operator cockpit for Green Goods stewards and deployers. It
depends on shared hooks, permissions, contract interaction helpers, and shared UI
foundations.

## UI Contract

- Read `/Users/afo/Code/greenpill/green-goods/docs/docs/builders/packages/admin.mdx` before changing routes, layouts, or page structure.
- The canonical shell is `CanvasLayout`.
- The Wave 3 shell is `AppBar + .workspace-canvas + MainSheet + NavigationBar`, with every workspace overlay rendering as a centered `AdminDialog` (the `LeftSheet`/`RightSheet`/`BottomSheet` renderers are deleted). The three global AppBar surfaces (Profile, Settings, Notifications) render in `AdminSideSheet` — right-docked within the canvas chrome bounds on desktop, bottom sheet on mobile.
- In admin docs, `AppBar` means the admin-owned Canvas top context bar in `packages/admin/src/components/Shell/`: sticky `z-sticky h-14`, `GardenChip` on the left, and search plus the notifications / settings / profile icon actions on the right (settings and profile are desktop-only; mobile keeps the bell).
- `NavigationBar` is pure navigation only. Use the canonical items `Hub`, `Garden`, `Community`, and `Actions`; do not add leading or trailing slots.
- Do not use the client/PWA `AppBar` pattern for admin. Keep admin workspace navigation on `NavigationBar`.
- `ConnectShell` is the disconnected full-screen state with a centered connect prompt and no navigation.
- Shared owns `GardenChip`, `NotificationPanel`, and `SheetErrorBoundary`. Admin owns the forked shell — `AppBar`, `NavigationBar`, `MainSheet`, and `FabButton` in `components/Shell/` (styling in JSX, per the Tailwind gotcha below) — plus `CanvasLayout`, `CanvasRouteFrame`, `CanvasRouteHeader`, `AdminDialog`, `AdminSideSheet`, the left-inspector channel (`components/Layout/leftSheetChannel.tsx`), `AccountProfilePanel`, `AccountSettingsPanel`, `AccountSurface`, `ConnectShell`, `CommandPalette`, and `PageHeader`. The shared `Canvas/NavigationBar` still exists for non-admin surfaces; a behavior or accessibility fix to one shell has to be applied to both.
- Treat `DashboardLayout`, `Sidebar`, and `Header` as legacy migration code for new admin work.
- Prefer the primitives below before composing raw `rounded border bg shadow` layouts.
- Treat `packages/admin/src/components/Admin*.tsx` as the admin wrapper inventory; use those wrappers before local control styling.
- Use `.surface-section`, `.surface-inset`, `.surface-card`, and `.workspace-canvas` before inventing one-off shell or page surface wrappers.
- The account/profile/settings/notifications flows route through the right-sheet registry into the `AdminSideSheet` inspector (right-docked within the canvas chrome bounds on desktop; bottom sheet on mobile, where only the bell opens it). `AccountSurface` is the mobile account route with **Account | Settings** tabs ("Account" is the mobile name for the desktop Profile sheet content; there is no notifications tab). Every other overlay uses `AdminDialog` or `AdminConfirmDialog` — side-sheet scope is enforced by `AdminSideSheetStandard.guard.test.ts`.

## Cockpit UI Mode

- Admin is an operator cockpit, not a marketing surface. Default to utility copy, not brand or campaign copy.
- Default route composition is `CanvasRouteFrame` + `CanvasRouteHeader` (`PageHeader` under the hood — routes no longer import it directly) -> primary workspace -> optional secondary inspector (a centered `AdminDialog`).
- Start from task flow and information hierarchy, not from `Card`.
- Use cards or elevated surfaces only when they represent a discrete record, action target, or bounded interactive unit.
- Prefer one dominant workspace surface per route. Avoid nested stacks of bordered panels that turn the page into a card mosaic.
- Avoid hero sections, decorative promo banners, decorative gradients behind routine UI, and ornamental icon rows.
- Keep color restrained: shared semantic tokens, one workspace accent, strong typography, minimal chrome.
- Color roles are split by job: `--tone-action` for filled action backgrounds, `--tone-on-action` for text/icons on those fills, `--tone-on-surface-accent` for colored text/icons on solid surfaces, and `--tone-focus-ring` for focus indicators.
- Treat `/hub` as the reference cockpit surface for new admin page composition.

## Preferred Primitives

- `AppBar`
- `NavigationBar`
- `MainSheet`
- `AdminDialog`
- `AdminConfirmDialog`
- `AdminSideSheet`
- `AdminChoiceGroup`
- `AdminSelectableCard`
- `AdminTabRail`
- `AdminFilterChip`
- `GardenChip`
- `CommandPalette`
- `AccountProfilePanel`
- `AccountSettingsPanel`
- `ConnectShell`
- `PageHeader`
- `ListToolbar`
- `SortSelect`
- `Surface`
- `Card`
- `Alert`
- `StatusBadge`
- `FormField`

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
- Use `AdminDialog` / `AdminConfirmDialog` for every workspace modal flow instead of ad-hoc shells (the old sheet renderers are deleted). The single exception is `AdminSideSheet`, reserved for the three global AppBar surfaces (Profile, Settings, Notifications) and rendered only by `CanvasLayout` — enforced by `AdminSideSheetStandard.guard`. `DialogShell` remains available for shared or non-admin surfaces, but admin dashboard dialogs should use the admin wrappers. Full-surface create/commit flows (Submit Work, Create Assessment, Create Hypercert) are centered `AdminDialog` (`variant="flow"` + `ADMIN_FLOW_DIALOG_CLASS`) modals hosting `ActionFlowShell` — not fullscreen takeovers or routes. Dialog sizes follow the three-tier scale (`sm` confirm · `md` single-purpose · `lg` rich single-view) enforced by the `AdminDialogStandard.guard` test.
- Do not edit the admin UI standards (`admin.mdx`, `packages/admin/DESIGN.md`, `.claude/skills/design/*`) in the same commit as the code they govern. A change to an archetype rule — which surface is a modal vs a sheet vs a route, which primitive a flow uses — is its own commit/PR with its own review, so a wrong implementation cannot quietly rewrite the standard to bless itself. (Static gates check token hygiene, not whether a standard still describes good UI.)
- New user-facing strings must be translated in all three locale files.
- New or changed shared admin primitives, major variants, or Storybook-covered surfaces must add or update stories in the same change. Run `bun run --filter @green-goods/shared check:stories`; run `bun run --filter @green-goods/shared test:stories:ci` when adding `storybook-ci` stories; run `bun run --filter @green-goods/shared build-storybook` for Storybook-impacting changes. Do not require Storybook checks for a route-local QA fix that does not touch a shared primitive, story, token, or Storybook-covered surface.

## Package Notes

- Use `/Users/afo/Code/greenpill/green-goods/docs/docs/builders/packages/admin.mdx` as the single admin UI contract; do not recreate a package-local design doc.
- Keep reusable components and config helpers in `@green-goods/shared`. Admin owns only canvas shell, account surfaces, and admin-only workflows.
- Keep admin routes canonical: primary surfaces `/hub`, `/garden`, `/community`, `/actions`; Hub deep links stay under `/hub/work/*`; secondary route families should match the contract in `admin.mdx`.
- The default `bun run test` discovers the full admin Vitest suite, including `src/__tests__/views/**`.
  Use a targeted test for QA Speed Mode; add `bun run build` when route wiring, view imports, or
  production build output could break.
- In QA Speed Mode, run the targeted view/component/model test when one covers the fix and capture authenticated rendered proof for visible UI. Use `bun run build` when route wiring, view imports, or build output could break; do not run Storybook checks unless shared primitives/stories/tokens moved.
- Permission and role changes often originate in shared code; use the root quick verification
  loop when shared contracts or shared hooks move.
- Visible changes follow root `AGENTS.md` section “Agentic Modern Web Standard”; if its
  authenticated Brave path is unavailable, report browser QA as `BLOCKED`.
- **Tailwind v4 gotcha**: admin's content scan does not reach `packages/shared/src/`, so a shared component that uses utility classes in its JSX may render off-center, missing padding, or wrong width in admin even when it looks fine in Storybook. Before debugging the shared component, check root `AGENTS.md` → "Known Gotchas" — the fix is a fork into `packages/admin/src/components/Shell/` (the Canvas shell pattern) or inline styles inside the shared component, not utility classes in shared JSX.

## Validation

- QA Speed Mode: targeted admin test plus rendered proof for visible behavior; add `bun run build` only for route, view-import, or build-output risk.
- Package loop: `bun run test && bun run build`.
- Conditional proof: Storybook checks apply only when shared primitives, stories, or tokens move.
- Broader impact: run the root Repo Quick Gate when shared hooks, permissions, or public contracts move.

## Authenticated Browser QA

Local agentic browser QA for this package uses the authenticated Brave QA profile.
Codex sessions use the Codex browser-extension path and claim the already-open Brave tab/window.
Claude Code sessions use the Claude Code Chrome/Chromium extension path and select the authenticated Brave profile/tab.
Do not use isolated Browser, Playwright, or DevTools MCP profiles for local QA.
If authenticated Brave access is blocked, stop and report QA as blocked.
