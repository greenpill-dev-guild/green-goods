# Admin Taxonomy Cleanup — Design Spec

**Date:** 2026-04-14
**Branch:** `feature/admin-ui-revamp`
**Sub-project:** 1 of 3 (taxonomy + sheet architecture)

## Problem

The admin canvas component taxonomy has accumulated naming inconsistencies and architectural mismatches:

1. `TopContextBar` is unnecessarily verbose — M3 calls it "Top App Bar"
2. `Canvas*` prefix on scaffold primitives is redundant (they only exist inside the canvas) and makes them feel like framework-level abstractions rather than the simple layout components they are
3. `ProfileSheet` and `SettingsSheet` were incorrectly modeled as separate sheets — they're panels (content) rendered inside the single `RightSheet` (spatial container)
4. Dead code: `CanvasScaffold` and `CanvasStageTabRail` are exported but never imported
5. Over-abstracted: `CanvasSheetFrame` (3 CSS classes) and `CanvasMobileActionSlot` (1 use) don't earn their existence as components

## Revised Taxonomy

### Component Categories

| Category | Role | Examples |
|---|---|---|
| **Bars** | Persistent chrome — always visible, fixed position | `AppBar`, `NavigationBar` |
| **Sheets** | Spatial containers — slide in/out, glass-floating, drag-dismissable | `MainSheet`, `LeftSheet`, `RightSheet` |
| **Panels** | Content rendered inside sheets — no spatial behavior | `AccountProfilePanel`, `AccountSettingsPanel`, `NotificationPanel` |
| **Primitives** | Reusable layout building blocks for views | `MetaStrip`, `WorkbenchList`, `WorkbenchRow`, `EmptyStateShell` |
| **Surfaces** | Elevation wrappers | `Surface` |
| **Providers** | State/context wrappers | `FabProvider`, `CanvasPortalContext` |

### Renames

| Before | After | Reason |
|---|---|---|
| `TopContextBar` | `AppBar` | M3 naming, shorter |
| `TopContextBarProps` | `AppBarProps` | Follows component rename |
| `CanvasMetaStrip` | `MetaStrip` | Drop redundant prefix |
| `CanvasWorkbenchList` | `WorkbenchList` | Drop redundant prefix |
| `CanvasWorkbenchRow` | `WorkbenchRow` | Drop redundant prefix |
| `CanvasEmptyStateShell` | `EmptyStateShell` | Drop redundant prefix |

### Deletions

| Component | Reason |
|---|---|
| `CanvasScaffold` | Dead code — never imported |
| `CanvasStageTabRail` | Dead code — never imported |
| `CanvasSheetFrame` | Inline into 2 use sites — just `flex flex-col gap-4 p-1.5` |
| `CanvasMobileActionSlot` | Inline into 1 use site |
| `ProfileSheet` | Not a sheet — panel content routed through RightSheet |
| `SettingsSheet` | Same |

### RightSheet Content Routing

Instead of separate sheet wrapper components per content type, the single `RightSheet` in `CanvasLayout` uses the orchestrator's `contentId` to decide what content to render:

```tsx
<RightSheet
  open={rightSheetOpen}
  onClose={() => orchestrator.closeSheet()}
  title={rightSheetTitle}
  container={overlayRootRef.current}
>
  {rightSheetContentId === "profile" && <AccountProfilePanel />}
  {rightSheetContentId === "settings" && <AccountSettingsPanel />}
  {rightSheetContentId === "notifications" && <NotificationPanel />}
</RightSheet>
```

The `title` is derived from `contentId` via a simple lookup map. No extra wrapper components needed.

## File Changes

### Shared Package (`packages/shared`)

#### Renames
- `src/components/Canvas/TopContextBar.tsx` → `src/components/Canvas/AppBar.tsx`
- `src/components/Canvas/TopContextBar.stories.tsx` → `src/components/Canvas/AppBar.stories.tsx`
- `__tests__/components/TopContextBar.test.tsx` → `__tests__/components/AppBar.test.tsx`

#### New Files (extracted from CanvasScaffold.tsx)
- `src/components/Canvas/MetaStrip.tsx`
- `src/components/Canvas/WorkbenchList.tsx`
- `src/components/Canvas/WorkbenchRow.tsx`
- `src/components/Canvas/EmptyStateShell.tsx`

#### Deletions
- `src/components/Canvas/CanvasScaffold.tsx` — after extracting the 4 keepers
- `src/components/Canvas/CanvasScaffold.stories.tsx` — if it exists

#### Modifications
- `src/components/Canvas/index.ts` — update barrel exports
- `src/index.ts` — update re-exports (`TopContextBar` → `AppBar`, `Canvas*` → new names)

### Admin Package (`packages/admin`)

#### Deletions
- `src/components/Layout/ProfileSheet.tsx`
- `src/components/Layout/SettingsSheet.tsx`

#### Modifications
- `src/components/Layout/CanvasLayout.tsx` — import `AppBar`, single `RightSheet` with contentId routing, remove `ProfileSheet`/`SettingsSheet` imports
- `src/views/Hub/index.tsx` — rename imports, inline `CanvasSheetFrame`/`CanvasMobileActionSlot`
- `src/views/Actions/index.tsx` — rename imports
- `src/views/Garden/index.tsx` — rename `CanvasMetaStrip` → `MetaStrip`
- `src/views/Community/index.tsx` — rename `CanvasMetaStrip` → `MetaStrip`

#### Test Files
- All test files referencing `TopContextBar`, `AccountSheet`, `ProfileSheet`, `SettingsSheet`, or `Canvas*` primitives get updated imports and mock names

## Out of Scope

- Animation polish (sheet slide-in/close jank) — sub-project 2
- Home view for unauthenticated state — sub-project 3
- Component logic changes (only naming and file structure changes here)
- NavigationBar rename (stays as-is per user decision)
