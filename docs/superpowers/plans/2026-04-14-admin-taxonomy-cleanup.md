# Admin Taxonomy Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up admin component taxonomy — rename TopContextBar→AppBar, drop Canvas* prefix from primitives, delete dead code, merge ProfileSheet/SettingsSheet into RightSheet content routing.

**Architecture:** Pure rename/restructure — no logic changes. Extract 4 primitives from CanvasScaffold.tsx into individual files, rename TopContextBar to AppBar, consolidate RightSheet content routing in CanvasLayout. Update all imports and barrel exports.

**Tech Stack:** React, TypeScript, @green-goods/shared barrel exports

**Spec:** `docs/superpowers/specs/2026-04-14-admin-taxonomy-cleanup-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/shared/src/components/Canvas/AppBar.tsx` | Create (rename from TopContextBar) | Top app bar component |
| `packages/shared/src/components/Canvas/AppBar.stories.tsx` | Create (rename from TopContextBar.stories) | Stories |
| `packages/shared/src/components/Canvas/MetaStrip.tsx` | Create (extract) | Badge-like metadata row |
| `packages/shared/src/components/Canvas/WorkbenchList.tsx` | Create (extract) | Rounded list container |
| `packages/shared/src/components/Canvas/WorkbenchRow.tsx` | Create (extract) | Grid-layout list item |
| `packages/shared/src/components/Canvas/EmptyStateShell.tsx` | Create (extract) | Centered empty state surface |
| `packages/shared/src/components/Canvas/TopContextBar.tsx` | Delete | Replaced by AppBar.tsx |
| `packages/shared/src/components/Canvas/TopContextBar.stories.tsx` | Delete | Replaced by AppBar.stories.tsx |
| `packages/shared/src/components/Canvas/CanvasScaffold.tsx` | Delete | Components extracted to own files |
| `packages/shared/src/components/Canvas/CanvasScaffold.stories.tsx` | Delete (if exists) | Dead |
| `packages/shared/src/index.ts` | Modify | Update re-exports |
| `packages/admin/src/components/Layout/ProfileSheet.tsx` | Delete | Content routing in CanvasLayout |
| `packages/admin/src/components/Layout/SettingsSheet.tsx` | Delete | Content routing in CanvasLayout |
| `packages/admin/src/components/Layout/CanvasLayout.tsx` | Modify | AppBar import, single RightSheet with content routing |
| `packages/admin/src/views/Hub/index.tsx` | Modify | Rename imports, inline SheetFrame/MobileActionSlot |
| `packages/admin/src/views/Actions/index.tsx` | Modify | Rename imports |
| `packages/admin/src/views/Garden/index.tsx` | Modify | Rename import |
| `packages/admin/src/views/Community/index.tsx` | Modify | Rename import |
| `packages/shared/__tests__/components/AppBar.test.tsx` | Create (rename) | Updated test imports |
| Test files referencing old names | Modify | Update mocks and imports |

---

### Task 1: Rename TopContextBar → AppBar

**Files:**
- Create: `packages/shared/src/components/Canvas/AppBar.tsx`
- Create: `packages/shared/src/components/Canvas/AppBar.stories.tsx`
- Delete: `packages/shared/src/components/Canvas/TopContextBar.tsx`
- Delete: `packages/shared/src/components/Canvas/TopContextBar.stories.tsx`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Copy TopContextBar.tsx to AppBar.tsx and rename**

Copy `packages/shared/src/components/Canvas/TopContextBar.tsx` to `packages/shared/src/components/Canvas/AppBar.tsx`. Then in the new file:
- Rename `TopContextBarProps` → `AppBarProps`
- Rename `export function TopContextBar` → `export function AppBar`
- Update the JSDoc comment to say "AppBar" instead of "TopContextBar"

- [ ] **Step 2: Copy TopContextBar.stories.tsx to AppBar.stories.tsx and rename**

Copy `packages/shared/src/components/Canvas/TopContextBar.stories.tsx` to `packages/shared/src/components/Canvas/AppBar.stories.tsx`. Update:
- Import from `./AppBar` instead of `./TopContextBar`
- `title: "Canvas/AppBar"` instead of `"Canvas/TopContextBar"`
- Component references from `TopContextBar` to `AppBar`

- [ ] **Step 3: Delete old files**

```bash
rm packages/shared/src/components/Canvas/TopContextBar.tsx
rm packages/shared/src/components/Canvas/TopContextBar.stories.tsx
```

- [ ] **Step 4: Update shared barrel exports**

In `packages/shared/src/index.ts`, find all references to `TopContextBar` and `TopContextBarProps` and replace with `AppBar` and `AppBarProps`. The export source path changes from `"./components/Canvas/TopContextBar"` (or wherever it's re-exported through) to `"./components/Canvas/AppBar"`.

Also check `packages/shared/src/components/Canvas/index.ts` (if it exists) for the same.

- [ ] **Step 5: Update test file**

Rename `packages/shared/src/__tests__/components/TopContextBar.test.tsx` to `packages/shared/src/__tests__/components/AppBar.test.tsx`. Update all internal references from `TopContextBar` to `AppBar`.

- [ ] **Step 6: Verify shared package compiles**

```bash
cd packages/shared && npx tsc --noEmit
```

Expected: Errors in admin package (still importing TopContextBar) — that's fine, fixed in Task 5.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(shared): rename TopContextBar to AppBar (M3 naming)"
```

---

### Task 2: Extract Primitives from CanvasScaffold.tsx

**Files:**
- Create: `packages/shared/src/components/Canvas/MetaStrip.tsx`
- Create: `packages/shared/src/components/Canvas/WorkbenchList.tsx`
- Create: `packages/shared/src/components/Canvas/WorkbenchRow.tsx`
- Create: `packages/shared/src/components/Canvas/EmptyStateShell.tsx`
- Delete: `packages/shared/src/components/Canvas/CanvasScaffold.tsx`

- [ ] **Step 1: Create MetaStrip.tsx**

Create `packages/shared/src/components/Canvas/MetaStrip.tsx` with the `CanvasMetaStrip` component renamed to `MetaStrip`:

```tsx
import type { ReactNode } from "react";
import { cn } from "../../utils";

export interface MetaStripItem {
  id?: string;
  label: ReactNode;
  value?: ReactNode;
}

export interface MetaStripProps {
  items: MetaStripItem[];
  className?: string;
}

export function MetaStrip({ items, className }: MetaStripProps) {
  if (items.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2 max-[599px]:gap-1.5", className)}>
      {items.map((item, index) => (
        <span
          key={item.id ?? `meta-${index}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-bg-soft px-3 py-2 text-[0.72rem] font-semibold tracking-[0.01em] text-text-sub shadow-[var(--edge-rest)]"
        >
          {item.value ? <span className="font-bold text-text-strong">{item.value}</span> : null}
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create WorkbenchList.tsx**

Create `packages/shared/src/components/Canvas/WorkbenchList.tsx`:

```tsx
import type { HTMLAttributes } from "react";
import { cn } from "../../utils";

export function WorkbenchList({
  children,
  className,
  style,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "overflow-hidden rounded-xl divide-y divide-stroke-soft",
        "glass-raised",
        className
      )}
      style={{
        boxShadow: "var(--edge-rest), var(--elevation-1)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Create WorkbenchRow.tsx**

Create `packages/shared/src/components/Canvas/WorkbenchRow.tsx`. Copy the full `CanvasWorkbenchRow` component and its helpers from CanvasScaffold.tsx, renaming:
- `CanvasWorkbenchTone` → `WorkbenchTone`
- `CanvasWorkbenchRowProps` → `WorkbenchRowProps`
- `CanvasWorkbenchRow` → `WorkbenchRow`
- `getStatusToneClasses` stays internal (not exported)

The file needs these imports:
```tsx
import { RiArrowRightLine } from "@remixicon/react";
import type { ComponentType } from "react";
import { cn } from "../../utils";
```

- [ ] **Step 4: Create EmptyStateShell.tsx**

Create `packages/shared/src/components/Canvas/EmptyStateShell.tsx`:

```tsx
import type { ReactNode } from "react";
import { cn } from "../../utils";
import { Surface } from "../Surface";

export function EmptyStateShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Surface
      elevation="ground"
      radius="xl"
      className={cn(
        "flex items-center justify-center p-6",
        "bg-[linear-gradient(180deg,rgb(255_255_255/0.62)_0%,rgb(249_247_242/0.82)_100%)] dark:bg-bg-soft/60",
        className
      )}
      style={{
        minHeight: "min(24rem, 48vh)",
        boxShadow: "var(--edge-rest)",
      }}
    >
      {children}
    </Surface>
  );
}
```

- [ ] **Step 5: Delete CanvasScaffold.tsx**

Note: `useCanvasResponsiveFab` is also defined in this file. Before deleting, move it to its own file or into an existing hooks file. Check if it's exported from shared — if so, create `packages/shared/src/components/Canvas/useCanvasResponsiveFab.ts` with just the hook and its types (`CanvasMobilePrimaryAction`, `UseCanvasResponsiveFabOptions`).

Then delete:
```bash
rm packages/shared/src/components/Canvas/CanvasScaffold.tsx
```

Also delete stories if they exist:
```bash
rm -f packages/shared/src/components/Canvas/CanvasScaffold.stories.tsx
```

- [ ] **Step 6: Update barrel exports**

In `packages/shared/src/index.ts`, replace all `CanvasScaffold` re-exports:

| Old Export | New Source |
|---|---|
| `CanvasMetaStrip`, `CanvasMetaStripItem`, `CanvasMetaStripProps` | `MetaStrip`, `MetaStripItem`, `MetaStripProps` from `"./components/Canvas/MetaStrip"` |
| `CanvasWorkbenchList` | `WorkbenchList` from `"./components/Canvas/WorkbenchList"` |
| `CanvasWorkbenchRow`, `CanvasWorkbenchRowProps`, `CanvasWorkbenchTone` | `WorkbenchRow`, `WorkbenchRowProps`, `WorkbenchTone` from `"./components/Canvas/WorkbenchRow"` |
| `CanvasEmptyStateShell` | `EmptyStateShell` from `"./components/Canvas/EmptyStateShell"` |
| `CanvasStageTabRail`, `CanvasStageTabRailProps`, `CanvasStageTab` | **Delete** (dead code) |
| `CanvasSheetFrame` | **Delete** (will be inlined) |
| `CanvasMobileActionSlot` | **Delete** (will be inlined) |
| `useCanvasResponsiveFab`, `CanvasMobilePrimaryAction`, `UseCanvasResponsiveFabOptions` | Keep, update source path |

- [ ] **Step 7: Verify shared package compiles**

```bash
cd packages/shared && npx tsc --noEmit
```

Expected: Errors in admin (still importing old names) — fixed in Task 3.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(shared): extract Canvas primitives to individual files, drop Canvas prefix"
```

---

### Task 3: Update Admin View Imports

**Files:**
- Modify: `packages/admin/src/views/Hub/index.tsx`
- Modify: `packages/admin/src/views/Actions/index.tsx`
- Modify: `packages/admin/src/views/Garden/index.tsx`
- Modify: `packages/admin/src/views/Community/index.tsx`

- [ ] **Step 1: Update Hub view imports**

In `packages/admin/src/views/Hub/index.tsx`, update the import from `@green-goods/shared`:

```tsx
// Before:
import {
  CanvasEmptyStateShell,
  CanvasMetaStrip,
  CanvasMobileActionSlot,
  CanvasSheetFrame,
  CanvasWorkbenchList,
  CanvasWorkbenchRow,
  // ... other imports
} from "@green-goods/shared";

// After:
import {
  EmptyStateShell,
  MetaStrip,
  WorkbenchList,
  WorkbenchRow,
  // ... other imports
} from "@green-goods/shared";
```

Then find-and-replace throughout the file:
- `<CanvasEmptyStateShell` → `<EmptyStateShell`
- `</CanvasEmptyStateShell>` → `</EmptyStateShell>`
- `<CanvasMetaStrip` → `<MetaStrip`
- `<CanvasWorkbenchList` → `<WorkbenchList`
- `</CanvasWorkbenchList>` → `</WorkbenchList>`
- `<CanvasWorkbenchRow` → `<WorkbenchRow`

**Inline CanvasSheetFrame** — replace every `<CanvasSheetFrame>...</CanvasSheetFrame>` with `<div className="flex flex-col gap-4 p-1.5">...</div>`.

**Inline CanvasMobileActionSlot** — the single usage around line 1346. Replace:
```tsx
<CanvasMobileActionSlot action={mobileFabAction} />
```
with the inlined markup. Import `useCanvasMobileChromeHidden` and `Button` from shared, then:
```tsx
{!useCanvasMobileChromeHidden() && mobileFabAction && (
  <div className="pointer-events-none sticky bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-[7] flex justify-end px-3 pb-2 pt-1 min-[600px]:hidden">
    <div className="pointer-events-auto ml-auto w-auto max-w-full">
      <Button
        onClick={mobileFabAction.onClick}
        size="lg"
        className="min-h-12 min-w-[10rem] max-w-[min(15rem,calc(100vw-1.5rem))] justify-center rounded-full px-4.5 shadow-[0_14px_30px_rgba(38,28,18,0.14)] transition-[transform,box-shadow] duration-200 ease-out motion-reduce:transition-none active:translate-y-px active:shadow-[0_8px_18px_rgba(38,28,18,0.16)]"
      >
        <mobileFabAction.icon className="h-5 w-5" />
        {mobileFabAction.label}
      </Button>
    </div>
  </div>
)}
```

Note: `useCanvasMobileChromeHidden` needs to be called at the component level (not inside JSX). Move the call to the top of the component and store the result.

- [ ] **Step 2: Update Actions view imports**

In `packages/admin/src/views/Actions/index.tsx`:

```tsx
// Before:
import { CanvasWorkbenchList, CanvasWorkbenchRow, ... } from "@green-goods/shared";

// After:
import { WorkbenchList, WorkbenchRow, ... } from "@green-goods/shared";
```

Find-and-replace `CanvasWorkbenchList` → `WorkbenchList`, `CanvasWorkbenchRow` → `WorkbenchRow`.

- [ ] **Step 3: Update Garden view imports**

In `packages/admin/src/views/Garden/index.tsx`:

```tsx
// Before:
import { CanvasMetaStrip, ... } from "@green-goods/shared";
// After:
import { MetaStrip, ... } from "@green-goods/shared";
```

Replace `<CanvasMetaStrip` → `<MetaStrip`.

- [ ] **Step 4: Update Community view imports**

In `packages/admin/src/views/Community/index.tsx`:

```tsx
// Before:
import { CanvasMetaStrip, ... } from "@green-goods/shared";
// After:
import { MetaStrip, ... } from "@green-goods/shared";
```

Replace `<CanvasMetaStrip` → `<MetaStrip`.

- [ ] **Step 5: Verify admin builds**

```bash
cd packages/admin && npx tsc --noEmit
```

Expected: May still have errors from TopContextBar → AppBar rename (fixed in Task 5).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(admin): update view imports for renamed primitives"
```

---

### Task 4: Merge ProfileSheet/SettingsSheet into RightSheet Content Routing

**Files:**
- Delete: `packages/admin/src/components/Layout/ProfileSheet.tsx`
- Delete: `packages/admin/src/components/Layout/SettingsSheet.tsx`
- Modify: `packages/admin/src/components/Layout/CanvasLayout.tsx`

- [ ] **Step 1: Update CanvasLayout to use single RightSheet with content routing**

In `packages/admin/src/components/Layout/CanvasLayout.tsx`:

Remove imports:
```tsx
import { ProfileSheet } from "./ProfileSheet";
import { SettingsSheet } from "./SettingsSheet";
```

Add imports for the panels:
```tsx
import { AccountProfilePanel } from "./AccountProfilePanel";
import { AccountSettingsPanel } from "./AccountSettingsPanel";
```

Add a title lookup map (inside the component or as a module-level constant):
```tsx
const RIGHT_SHEET_TITLES: Record<string, { id: string; defaultMessage: string }> = {
  profile: { id: "cockpit.profile.title", defaultMessage: "Profile" },
  settings: { id: "cockpit.settings.title", defaultMessage: "Settings" },
  notifications: { id: "cockpit.notifications.title", defaultMessage: "Notifications" },
};
```

Replace the two separate sheet instances and the notifications RightSheet with a single RightSheet:

```tsx
// Remove:
<ProfileSheet
  open={profileSheetOpen}
  onClose={() => orchestrator.closeSheet()}
  container={overlayRootRef.current}
/>
<SettingsSheet
  open={settingsSheetOpen}
  onClose={() => orchestrator.closeSheet()}
  container={overlayRootRef.current}
/>
<RightSheet
  open={orchestrator.activeSheet === "right" && orchestrator.activeContentId === "notifications"}
  onClose={() => orchestrator.closeSheet()}
  title={intl.formatMessage({ id: "cockpit.notifications.title", defaultMessage: "Notifications" })}
  container={overlayRootRef.current}
>
  <NotificationPanel />
</RightSheet>

// Replace with:
<RightSheet
  open={orchestrator.activeSheet === "right"}
  onClose={() => orchestrator.closeSheet()}
  title={
    orchestrator.activeContentId && RIGHT_SHEET_TITLES[orchestrator.activeContentId]
      ? intl.formatMessage(RIGHT_SHEET_TITLES[orchestrator.activeContentId])
      : undefined
  }
  container={overlayRootRef.current}
>
  {orchestrator.activeContentId === PROFILE_SHEET_CONTENT_ID && (
    <div className="p-5"><AccountProfilePanel /></div>
  )}
  {orchestrator.activeContentId === SETTINGS_SHEET_CONTENT_ID && (
    <div className="p-5"><AccountSettingsPanel /></div>
  )}
  {orchestrator.activeContentId === "notifications" && <NotificationPanel />}
</RightSheet>
```

Also remove the `profileSheetOpen` and `settingsSheetOpen` derived state variables — they're no longer needed.

- [ ] **Step 2: Delete ProfileSheet.tsx and SettingsSheet.tsx**

```bash
rm packages/admin/src/components/Layout/ProfileSheet.tsx
rm packages/admin/src/components/Layout/SettingsSheet.tsx
```

- [ ] **Step 3: Verify admin builds**

```bash
cd packages/admin && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(admin): merge ProfileSheet/SettingsSheet into single RightSheet content routing"
```

---

### Task 5: Update CanvasLayout AppBar Import + Remaining References

**Files:**
- Modify: `packages/admin/src/components/Layout/CanvasLayout.tsx`
- Modify: All test files referencing old names

- [ ] **Step 1: Update CanvasLayout import**

In `packages/admin/src/components/Layout/CanvasLayout.tsx`, change the shared import:

```tsx
// Before:
import { ... TopContextBar ... } from "@green-goods/shared";

// After:
import { ... AppBar ... } from "@green-goods/shared";
```

And in the JSX:
```tsx
// Before:
<TopContextBar ... />

// After:
<AppBar ... />
```

- [ ] **Step 2: Update test files**

Search all test files for stale references:

```bash
grep -r "TopContextBar\|CanvasMetaStrip\|CanvasWorkbenchList\|CanvasWorkbenchRow\|CanvasEmptyStateShell\|CanvasSheetFrame\|CanvasMobileActionSlot\|ProfileSheet\|SettingsSheet" packages/admin/src/__tests__/ --include="*.tsx" --include="*.ts" -l
```

For each file found, update:
- `TopContextBar` → `AppBar` (in mocks and type definitions)
- `ProfileSheet`/`SettingsSheet` mocks → remove (no longer separate components)
- `Canvas*` primitive names → new names (in mocks)

- [ ] **Step 3: Verify full build**

```bash
cd packages/shared && npx tsc --noEmit && cd ../admin && npx tsc --noEmit
```

Expected: Clean compile, no errors.

- [ ] **Step 4: Run linting**

```bash
bun format && bun lint
```

Fix any issues.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(admin): update CanvasLayout to AppBar, fix all test references"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Verify no stale references remain**

```bash
grep -r "TopContextBar\|CanvasScaffold\|CanvasStageTabRail\|CanvasSheetFrame\|CanvasMobileActionSlot\|CanvasMetaStrip\|CanvasWorkbenchList\|CanvasWorkbenchRow\|CanvasEmptyStateShell\|ProfileSheet\|SettingsSheet" packages/shared/src/ packages/admin/src/ --include="*.tsx" --include="*.ts" | grep -v "__tests__" | grep -v "node_modules"
```

Expected: No matches.

- [ ] **Step 2: Verify dev server works**

Start `bun dev`, navigate to the admin, confirm:
1. AppBar renders with garden chip and action icons
2. RightSheet opens for profile, settings, and notifications
3. Views render with MetaStrip, WorkbenchList, WorkbenchRow, EmptyStateShell
4. No console errors

- [ ] **Step 3: Commit any final fixes**

```bash
git add -A && git commit -m "chore(admin): final cleanup for taxonomy rename"
```
