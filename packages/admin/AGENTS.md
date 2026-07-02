# Admin Package — Codex Guide

Use this guide when editing `packages/admin/**`.

## Role

The admin package is the operator cockpit for Green Goods stewards and deployers. It
depends on shared hooks, permissions, contract interaction helpers, and shared UI
foundations.

## UI Contract

- Read `/Users/afo/Code/greenpill/green-goods/docs/docs/builders/packages/admin.mdx` before changing routes, layouts, or page structure.
- The canonical shell is `CanvasLayout`.
- The Wave 3 shell is `AppBar + .workspace-canvas + MainSheet + NavigationBar`, with every overlay rendering as a centered `AdminDialog` (the `LeftSheet`/`RightSheet`/`BottomSheet` renderers are deleted).
- In admin docs, `AppBar` means the shared Canvas top context bar: sticky `z-sticky h-14`, `GardenChip` on the left, and desktop search, settings, notifications, and `UserAvatar` on the right.
- `NavigationBar` is pure navigation only. Use the canonical items `Hub`, `Garden`, `Community`, and `Actions`; do not add leading or trailing slots.
- Do not use the client/PWA `AppBar` pattern for admin. Keep admin workspace navigation on `NavigationBar`.
- `ConnectShell` is the disconnected full-screen state with a centered connect prompt and no navigation.
- Shared owns `AppBar`, `NavigationBar`, `GardenChip`, `MainSheet`, and `SheetErrorBoundary`. Admin owns `CanvasLayout`, `AdminDialog`, the left-inspector channel (`components/Layout/leftSheetChannel.tsx`), `AccountProfilePanel`, `AccountSettingsPanel`, `AccountSurface`, `UserAvatar`, `UserMenu`, `ConnectShell`, `CommandPalette`, and `PageHeader`.
- Treat `DashboardLayout`, `Sidebar`, and `Header` as legacy migration code for new admin work.
- Prefer the primitives below before composing raw `rounded border bg shadow` layouts.
- Use `.surface-section`, `.surface-inset`, `.surface-card`, and `.workspace-canvas` before inventing one-off shell or page surface wrappers.
- Desktop account/profile/settings flows route through the right-sheet registry into the AdminDialog account inspector; `AccountSurface` is the mobile account route. Every other overlay uses `AdminDialog` or `AdminConfirmDialog`.

## Cockpit UI Mode

- Admin is an operator cockpit, not a marketing surface. Default to utility copy, not brand or campaign copy.
- Default route composition is `PageHeader` -> primary workspace -> optional secondary inspector (a centered `AdminDialog`).
- Start from task flow and information hierarchy, not from `Card`.
- Use cards or elevated surfaces only when they represent a discrete record, action target, or bounded interactive unit.
- Prefer one dominant workspace surface per route. Avoid nested stacks of bordered panels that turn the page into a card mosaic.
- Avoid hero sections, decorative promo banners, decorative gradients behind routine UI, and ornamental icon rows.
- Keep color restrained: shared semantic tokens, one workspace accent, strong typography, minimal chrome.
- Treat `/hub` as the reference cockpit surface for new admin page composition.

## Preferred Primitives

- `AppBar`
- `NavigationBar`
- `MainSheet`
- `AdminDialog`
- `AdminConfirmDialog`
- `GardenChip`
- `CommandPalette`
- `AccountProfilePanel`
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
- `AdminDialog`
- `AdminConfirmDialog`

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
- Use `AdminDialog` / `AdminConfirmDialog` for every modal flow instead of ad-hoc shells (the sheet renderers are deleted). `DialogShell` remains available for shared or non-admin surfaces, but admin dashboard dialogs should use the admin wrappers. Full-surface create/commit flows (Submit Work, Create Assessment, Create Hypercert) are centered `AdminDialog` (`variant="flow"` + `ADMIN_FLOW_DIALOG_CLASS`) modals hosting `ActionFlowShell` — not fullscreen takeovers or routes. Dialog sizes follow the three-tier scale (`sm` confirm · `md` single-purpose · `lg` rich single-view) enforced by the `AdminDialogStandard.guard` test.
- Do not edit the admin UI standards (`admin.mdx`, `packages/admin/DESIGN.md`, `.claude/skills/design/*`) in the same commit as the code they govern. A change to an archetype rule — which surface is a modal vs a sheet vs a route, which primitive a flow uses — is its own commit/PR with its own review, so a wrong implementation cannot quietly rewrite the standard to bless itself. (Static gates check token hygiene, not whether a standard still describes good UI.)
- New user-facing strings must be translated in all three locale files.
- New or changed shared admin primitives, major variants, or Storybook-covered surfaces must add or update stories in the same change. Run `bun run --filter @green-goods/shared check:stories`; run `bun run --filter @green-goods/shared test:stories:ci` when adding `storybook-ci` stories; run `bun run --filter @green-goods/shared build-storybook` for Storybook-impacting changes. Do not require Storybook checks for a route-local QA fix that does not touch a shared primitive, story, token, or Storybook-covered surface.

## Codex Notes

- Use `/Users/afo/Code/greenpill/green-goods/docs/docs/builders/packages/admin.mdx` as the single admin UI contract; do not recreate a package-local design doc.
- Keep reusable components and config helpers in `@green-goods/shared`. Admin owns only canvas shell, account surfaces, and admin-only workflows.
- Keep admin routes canonical: primary surfaces `/hub`, `/garden`, `/community`, `/actions`; Hub deep links stay under `/hub/work/*`; secondary route families should match the contract in `admin.mdx`.
- The default admin Vitest run excludes `src/__tests__/views/**` and a few heavy tests. Treat `bun run build` as a required validation step for route and view work until a dedicated view test runner exists.
- In QA Speed Mode, run the targeted view/component/model test when one covers the fix and capture authenticated rendered proof for visible UI. Use `bun run build` when route wiring, view imports, or build output could break; do not run Storybook checks unless shared primitives/stories/tokens moved.
- Permission and role changes often originate in shared code; use the root quick verification
  loop when shared contracts or shared hooks move.
- Local agentic browser QA must use the authenticated Brave QA profile. Codex: use the Codex browser-extension path and claim the already-open Brave tab/window. Claude Code: use the Claude Code Chrome/Chromium extension path (`claude --chrome` or `/chrome`) and select the authenticated Brave profile/tab when it is installed, connected, and able to control the already-open Brave window. Do not fall back merely because the extension is branded Chrome. If the Brave extension path is unavailable or not connected, use Claude computer-use/visible desktop control of the already-open Brave window; if neither can reach authenticated Brave, report QA as blocked. Use this for admin, PWA, extension, wallet/passkey, staging-session, installed-app, and profile-dependent verification.
- Do not use isolated Browser, Playwright, or DevTools MCP profiles for local QA. Existing isolated browser-proof commands are CI/clean-room checks only and must not be reported as authenticated verification. If authenticated Brave access is blocked, stop and report QA as blocked.
- **Tailwind v4 gotcha**: admin's content scan does not reach `packages/shared/src/`, so a shared component that uses utility classes in its JSX may render off-center, missing padding, or wrong width in admin even when it looks fine in Storybook. Before debugging the shared component, check root `AGENTS.md` → "Known Gotchas" — the fix usually lives in `packages/admin/src/styles/admin-m3-overrides.css` or in inline styles inside the shared component, not in the JSX.

## Validation

- QA Speed Mode: targeted admin test or rendered proof; add `bun run build` for route/view/build risk
- Package loop: `bun run test && bun run build`
- Broader impact: from repo root run `node scripts/dev/ci-local.js --quick`
