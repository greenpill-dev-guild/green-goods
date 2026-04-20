# Codex Lane A — Stories + Focused Tests (Sprint 2026-04-20 · Day 1)

Sprint board: `.plans/active/admin-ui-revamp/execution-board-2026-04-20.md`
Branch: `codex/lane-a-stories/sprint-2026-04-20` (worktree — commit here only)
Base commit: current `develop` tip

## Goal

Close the missing visual Storybook coverage for the admin shell and the shared canvas components touched by the sprint, and add focused unit tests for sheet render/close behavior and layout shell empty/populated states. Do not touch shell `.tsx` files — Claude owns those in this sprint.

## Context

- `cd packages/shared && bun run check:stories` currently fails with 8 misses. Of those, `shared/Canvas/LeftSheetContext.tsx` is **non-visual** and explicitly out-of-scope. Real story targets in shared:
  - `packages/shared/src/components/Canvas/EmptyStateShell.tsx`
  - `packages/shared/src/components/Canvas/LeftSheet.tsx`
  - `packages/shared/src/components/Canvas/RightSheet.tsx`
  - `packages/shared/src/components/Canvas/MetaStrip.tsx`
  - `packages/shared/src/components/Canvas/WorkbenchList.tsx`
  - `packages/shared/src/components/Canvas/WorkbenchRow.tsx`
  - `packages/shared/src/components/DomainBadge.tsx`
- Admin shell coverage to add (colocated `*.stories.tsx` in `packages/admin/src/components/Layout/`):
  - `CanvasLayout.stories.tsx`
  - `AccountSurface.stories.tsx`
  - `AccountProfilePanel.stories.tsx`
  - `AccountSettingsPanel.stories.tsx`
  - `CanvasGardenAccessState.stories.tsx`
  - `CanvasWorkspaceSelectionState.stories.tsx`
  - `ConnectShell.stories.tsx`
  - `UserAvatar.stories.tsx`
  - `UserMenu.stories.tsx`
- Reference templates already in repo:
  - Shared canvas: `packages/shared/src/components/Canvas/BottomSheet.stories.tsx`, `MainSheet.stories.tsx`, `AppBar.stories.tsx`
  - Admin layout: `packages/admin/src/components/Layout/CommandPalette.stories.tsx`, `PageHeader.stories.tsx`, `PageTransition.stories.tsx`
- Focused tests to add under `packages/shared/src/__tests__/components/Canvas/` and `packages/admin/src/__tests__/components/Layout/` covering:
  - Sheet render mounts the dialog and announces title when provided; `onClose` fires on overlay click, drag-past-threshold, and Escape.
  - Shell states render the correct empty-vs-populated slot for `CanvasGardenAccessState` and `CanvasWorkspaceSelectionState`.
  - `ConnectShell` renders the connect prompt without navigation.

## Constraints

- **Do not modify shell `.tsx` files.** Claude owns `packages/admin/src/components/Layout/*.tsx` and `packages/shared/src/components/Canvas/{LeftSheet,RightSheet,BottomSheet,MainSheet,springConfig}.tsx`. Story files are fair game; the underlying components are not.
- Use existing story patterns. Wrap with providers (`IntlProvider`, `MemoryRouter`, `QueryClientProvider`) as the reference stories already do.
- User-facing strings in stories must either come from existing i18n keys or be plain story copy that doesn't introduce new keys. If you add a new string to a component test fixture, do not add new i18n keys — use fallback copy inside the story itself.
- Do not introduce new dependencies.
- Do not touch `packages/admin/src/views/{Hub,Garden,Community,Actions}/index.tsx` — those are Day 2 Claude targets.
- Do not touch `packages/admin/src/views/Actions/GreenWillPanel.tsx` or `packages/client/src/views/Profile/Badges.tsx` — those are Lane B scope on Day 2+.
- Respect CLAUDE.md: hooks only in shared; no deep imports; `@green-goods/shared` barrel only; use `logger` (not `console.log`); use Remixicon `Ri*Line`, never lucide; semantic tokens, never raw Tailwind colors.

## Validation (before declaring done)

- `cd packages/shared && bun run check:stories` — must pass (9/9 visual components now covered; non-visual exclusions unchanged).
- `cd packages/shared && bun run build-storybook` — must succeed.
- `cd packages/shared && bun run test` — must stay green.
- `cd packages/admin && bun run test` — must stay green.

## Done when

- All 7 shared visual stories + 9 admin layout stories added, each rendering with sensible empty/populated props.
- New sheet open/close tests cover the three behaviors listed above for `LeftSheet`, `RightSheet`, `BottomSheet`.
- `CanvasGardenAccessState`, `CanvasWorkspaceSelectionState`, `ConnectShell` have at least one test covering their primary empty-state render.
- Validation commands above all pass.
- Structured `codex-result.md` written per schema with `status: success`, file list, and any issues encountered.

## Out of scope (defer or refer to Claude)

- Shell `.tsx` edits, shell styling, composition changes, motion behavior.
- Route composition for `/hub`, `/garden`, `/community`, `/actions` — Day 2 Claude.
- Any `GreenWill*` surfaces.
- Any `.claude/**` edits.
