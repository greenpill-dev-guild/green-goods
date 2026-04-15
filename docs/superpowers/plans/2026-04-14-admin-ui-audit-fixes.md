# Admin UI/UX Audit Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 12 UI/UX issues from the admin dashboard audit — sheet widths, icon consistency, tooltips, nav flash, empty state, and profile/settings separation.

**Architecture:** Refactor the sheet system so profile and settings are separate RightSheet instances (desktop), move sheet width to a CSS custom property, and create a unified TopBarIconButton component with tooltip and M3 state layer. MainSheet gets horizontal gutters and max-width.

**Tech Stack:** React, TailwindCSS v4, react-spring, @use-gesture/react, Radix Dialog, CSS custom properties

**Spec:** `docs/superpowers/specs/2026-04-14-admin-ui-audit-fixes-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/shared/src/styles/theme.css` | Modify | Add `--canvas-right-sheet-width` token |
| `packages/shared/src/components/Canvas/MainSheet.tsx` | Modify | Add `mx-4 mb-4 max-w-[1400px]` |
| `packages/shared/src/components/Canvas/RightSheet.tsx` | Modify | Use CSS token for width |
| `packages/shared/src/components/Canvas/TopContextBar.tsx` | Modify | TopBarIconButton component with tooltip + M3 state layer |
| `packages/admin/src/components/Layout/ProfileSheet.tsx` | Create | Thin RightSheet wrapper for profile content |
| `packages/admin/src/components/Layout/SettingsSheet.tsx` | Create | Thin RightSheet wrapper for settings content |
| `packages/admin/src/components/Layout/AccountSheet.tsx` | Delete | Replaced by ProfileSheet + SettingsSheet |
| `packages/admin/src/components/Layout/accountSheet.events.ts` | Modify | Update content IDs and event types for separate sheets |
| `packages/admin/src/components/Layout/CanvasLayout.tsx` | Modify | Wire separate sheets, nav gate, empty state chip, remove UserAvatar |
| `packages/admin/src/components/Layout/AccountSurface.tsx` | Modify | Relabel tabs to "Account"/"Settings" |
| `packages/admin/src/components/Layout/CanvasGardenAccessState.tsx` | Modify | Always show Create Garden CTA |
| `packages/admin/src/views/Profile/index.tsx` | Modify | Relabel tabs to "Account"/"Settings" |

---

### Task 1: CSS Sheet Width Token

**Files:**
- Modify: `packages/shared/src/styles/theme.css:1219-1235`

- [ ] **Step 1: Add the CSS custom property to the canvas grid**

In `packages/shared/src/styles/theme.css`, add the sheet width token inside the `.workspace-canvas-grid` block:

```css
  /* ── Canvas Grid Layout ── */
  .workspace-canvas-grid {
    --canvas-right-sheet-width: clamp(320px, 28vw, 480px);
    display: grid;
    grid-template-areas:
      "top    top    top"
      "left   main   right"
      "bottom bottom bottom";
    grid-template-rows: auto 1fr auto;
    grid-template-columns:
      var(--left-sheet-width, 0)
      1fr
      var(--right-sheet-width, 0);
    background: var(--canvas-gradient,
      linear-gradient(180deg, rgb(var(--bg-white-0)) 0%, rgb(var(--bg-weak-50) / 0.6) 40%, rgb(var(--bg-sub-300) / 0.3) 100%)
    );
    min-height: 0;
    overflow: hidden;
  }
```

The only change is adding the `--canvas-right-sheet-width` line at the top of the block.

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/styles/theme.css
git commit -m "style(shared): add --canvas-right-sheet-width CSS token for responsive sheets"
```

---

### Task 2: RightSheet Responsive Width

**Files:**
- Modify: `packages/shared/src/components/Canvas/RightSheet.tsx:121-126`

- [ ] **Step 1: Replace hardcoded clamp with CSS token**

In `packages/shared/src/components/Canvas/RightSheet.tsx`, change the inline style on `Dialog.Content` (around line 122-126):

```tsx
// Before:
style={{
  top: 0,
  right: 0,
  width: "100%",
  maxWidth: "clamp(220px, 20vw, 300px)",
  paddingBottom: isBounded ? undefined : "env(safe-area-inset-bottom)",
}}

// After:
style={{
  top: 0,
  right: 0,
  width: "100%",
  maxWidth: "var(--canvas-right-sheet-width, clamp(320px, 28vw, 480px))",
  paddingBottom: isBounded ? undefined : "env(safe-area-inset-bottom)",
}}
```

- [ ] **Step 2: Verify the admin builds**

```bash
cd packages/shared && bun build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/components/Canvas/RightSheet.tsx
git commit -m "fix(shared): RightSheet uses CSS token for responsive width (320-480px)"
```

---

### Task 3: MainSheet Gutters, Max-Width, and Bottom Margin

**Files:**
- Modify: `packages/shared/src/components/Canvas/MainSheet.tsx:94-128`

- [ ] **Step 1: Add gutters, max-width, and bottom margin to MainSheet container**

In `packages/shared/src/components/Canvas/MainSheet.tsx`, modify the outer container div (line 96-99):

```tsx
// Before:
<div
  className={cn("canvas-area-main relative flex-1 min-h-0", className)}
  data-testid="main-sheet"
>

// After:
<div
  className={cn("canvas-area-main relative mx-4 mb-4 flex-1 min-h-0 max-w-[1400px] self-center", className)}
  data-testid="main-sheet"
>
```

- [ ] **Step 2: Verify the admin builds**

```bash
cd packages/shared && bun build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/components/Canvas/MainSheet.tsx
git commit -m "fix(shared): MainSheet adds px-4 gutters, max-w-1400, and bottom margin"
```

---

### Task 4: TopBarIconButton with Tooltip and M3 State Layer

**Files:**
- Modify: `packages/shared/src/components/Canvas/TopContextBar.tsx`

- [ ] **Step 1: Replace ICON_BTN constant and add TopBarIconButton component**

Rewrite `packages/shared/src/components/Canvas/TopContextBar.tsx`:

```tsx
import {
  RiArrowLeftLine,
  RiNotification3Line,
  RiSearchLine,
  RiSettings3Line,
  RiUserLine,
} from "@remixicon/react";
import * as Popover from "@radix-ui/react-popover";
import type React from "react";
import { useIntl } from "react-intl";
import { cn } from "../../utils/styles/cn";

// ----------------------------------------------------------------------------
// M3 Icon Button — consistent across all top-bar actions
// ----------------------------------------------------------------------------

const ICON_BTN = cn(
  "group/icon relative flex h-10 w-10 items-center justify-center rounded-full",
  "text-text-strong",
  "hover:bg-[rgb(var(--m3-on-surface,15_23_42)/0.08)] hover:scale-105",
  "active:bg-[rgb(var(--m3-on-surface,15_23_42)/0.12)] active:scale-95",
  "transition-all duration-[var(--spring-micro-duration,150ms)]",
  "motion-reduce:transition-none motion-reduce:active:scale-100 motion-reduce:hover:scale-100",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ws-primary,var(--primary-base)))]"
);

function TopBarIconButton({
  tooltip,
  onClick,
  children,
  className,
}: {
  tooltip: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={tooltip}
      className={cn(ICON_BTN, className)}
    >
      {children}
      <span
        className={cn(
          "pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap",
          "rounded-md bg-neutral-900/90 px-2.5 py-1 text-xs font-medium text-white",
          "opacity-0 transition-opacity group-hover/icon:opacity-100",
          "motion-reduce:transition-none"
        )}
        role="tooltip"
      >
        {tooltip}
      </span>
    </button>
  );
}

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface TopContextBarProps {
  gardenChip: React.ReactNode;
  /** When a side sheet is open, show item name with back arrow */
  sheetContext?: { label: string; onBack: () => void };
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
  /** Open notifications in right sheet (desktop) — bell icon triggers this */
  onOpenNotifications?: () => void;
  /** Open profile sheet (desktop) — person icon triggers this */
  onOpenProfile?: () => void;
}

// ----------------------------------------------------------------------------
// TopContextBar
// ----------------------------------------------------------------------------

/**
 * Sticky top bar for the admin canvas layout.
 *
 * - Left side: GardenChip (or sheetContext back-arrow + label when a sheet is open)
 * - Right side: Search, Notifications, Settings, Profile — all with identical M3 icon buttons
 * - z-index 40 per D49
 * - h-14 (56px)
 *
 * On mobile, search icon is hidden to save space.
 */
export function TopContextBar({
  gardenChip,
  sheetContext,
  onOpenSearch,
  onOpenSettings,
  onOpenNotifications,
  onOpenProfile,
}: TopContextBarProps) {
  const { formatMessage } = useIntl();

  return (
    <header
      className={cn(
        "sticky top-0 z-sticky flex h-14 w-full items-center justify-between",
        "bg-transparent px-4"
      )}
    >
      {/* Left side */}
      <div className="flex min-w-0 items-center gap-2">
        {sheetContext ? (
          <>
            <button
              type="button"
              onClick={sheetContext.onBack}
              aria-label={formatMessage({ id: "cockpit.topBar.back" })}
              className={ICON_BTN}
            >
              <RiArrowLeftLine className="h-5 w-5" />
            </button>
            <span className="truncate text-title-md text-text-main">{sheetContext.label}</span>
          </>
        ) : (
          gardenChip
        )}
      </div>

      {/* Right side — all icons share M3 TopBarIconButton */}
      <div className="flex items-center gap-1">
        {/* Search — hidden on mobile */}
        {onOpenSearch && (
          <TopBarIconButton
            tooltip={formatMessage({ id: "cockpit.topBar.openSearch", defaultMessage: "Search" })}
            onClick={onOpenSearch}
            className="hidden min-[600px]:flex"
          >
            <RiSearchLine className="h-5 w-5" />
          </TopBarIconButton>
        )}

        {/* Notification bell */}
        {onOpenNotifications ? (
          <TopBarIconButton
            tooltip={formatMessage({ id: "cockpit.topBar.notifications", defaultMessage: "Notifications" })}
            onClick={onOpenNotifications}
          >
            <RiNotification3Line className="h-5 w-5" />
          </TopBarIconButton>
        ) : (
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                type="button"
                aria-label={formatMessage({
                  id: "cockpit.topBar.notifications",
                  defaultMessage: "Notifications",
                })}
                className={ICON_BTN}
              >
                <RiNotification3Line className="h-5 w-5" />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                side="bottom"
                align="end"
                sideOffset={4}
                className={cn(
                  "z-50 rounded-xl bg-bg-white px-4 py-3 shadow-elevation-3",
                  "text-sm text-text-sub",
                  "animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2",
                  "duration-200"
                )}
                style={{ boxShadow: "var(--edge-rest), var(--elevation-3)" }}
              >
                {formatMessage({
                  id: "cockpit.topBar.noNotifications",
                  defaultMessage: "No notifications yet",
                })}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        )}

        {/* Settings — desktop only */}
        {onOpenSettings && (
          <TopBarIconButton
            tooltip={formatMessage({ id: "cockpit.topBar.openSettings", defaultMessage: "Settings" })}
            onClick={onOpenSettings}
          >
            <RiSettings3Line className="h-5 w-5" />
          </TopBarIconButton>
        )}

        {/* Profile — desktop only */}
        {onOpenProfile && (
          <TopBarIconButton
            tooltip={formatMessage({ id: "cockpit.topBar.userProfile", defaultMessage: "Profile" })}
            onClick={onOpenProfile}
          >
            <RiUserLine className="h-5 w-5" />
          </TopBarIconButton>
        )}
      </div>
    </header>
  );
}
```

Key changes from current code:
- `ICON_BTN` class updated: `rounded-sm` → `rounded-full`, `text-text-sub` → `text-text-strong`, added `hover:scale-105`, `active:scale-95`, M3 state layer opacity values, `group/icon` for tooltip
- New `TopBarIconButton` wraps each action with a CSS tooltip (`group-hover/icon:opacity-100`)
- `userAvatar` prop removed, replaced by `onOpenProfile` callback
- Profile renders as `RiUserLine` icon in the same `TopBarIconButton` — no more special avatar treatment
- Popover fallback for notifications kept for mobile path

- [ ] **Step 2: Verify the shared package builds**

```bash
cd packages/shared && bun build
```

Expected: Build succeeds. Note: the admin will have a type error until Task 6 updates CanvasLayout to pass `onOpenProfile` instead of `userAvatar`.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/components/Canvas/TopContextBar.tsx
git commit -m "feat(shared): TopBarIconButton with M3 state layer, tooltip, and uniform profile icon"
```

---

### Task 5: Create ProfileSheet and SettingsSheet

**Files:**
- Create: `packages/admin/src/components/Layout/ProfileSheet.tsx`
- Create: `packages/admin/src/components/Layout/SettingsSheet.tsx`
- Modify: `packages/admin/src/components/Layout/accountSheet.events.ts`

- [ ] **Step 1: Update accountSheet.events.ts with separate content IDs**

Replace the contents of `packages/admin/src/components/Layout/accountSheet.events.ts`:

```ts
export type AccountSheetTab = "profile" | "settings";

export const PROFILE_SHEET_CONTENT_ID = "profile";
export const SETTINGS_SHEET_CONTENT_ID = "settings";
export const ACCOUNT_TAB_SEARCH_PARAM = "tab";

/** @deprecated Use PROFILE_SHEET_CONTENT_ID or SETTINGS_SHEET_CONTENT_ID */
export const ACCOUNT_SHEET_CONTENT_ID = "account";
export const OPEN_ACCOUNT_SHEET_EVENT = "open-account-sheet";

export interface OpenAccountSheetEventDetail {
  tab: AccountSheetTab;
}

export function dispatchOpenAccountSheet(tab: AccountSheetTab) {
  window.dispatchEvent(
    new CustomEvent<OpenAccountSheetEventDetail>(OPEN_ACCOUNT_SHEET_EVENT, {
      detail: { tab },
    })
  );
}

export function parseAccountSheetTab(value: string | null | undefined): AccountSheetTab {
  return value === "settings" ? "settings" : "profile";
}
```

- [ ] **Step 2: Create ProfileSheet.tsx**

Create `packages/admin/src/components/Layout/ProfileSheet.tsx`:

```tsx
import { RightSheet } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { AccountProfilePanel } from "./AccountProfilePanel";

interface ProfileSheetProps {
  open: boolean;
  onClose: () => void;
  container?: HTMLElement | null;
}

export function ProfileSheet({ open, onClose, container }: ProfileSheetProps) {
  const { formatMessage } = useIntl();

  return (
    <RightSheet
      open={open}
      onClose={onClose}
      title={formatMessage({ id: "cockpit.profile.title", defaultMessage: "Profile" })}
      container={container}
    >
      <div className="p-5">
        <AccountProfilePanel />
      </div>
    </RightSheet>
  );
}
```

- [ ] **Step 3: Create SettingsSheet.tsx**

Create `packages/admin/src/components/Layout/SettingsSheet.tsx`:

```tsx
import { RightSheet } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { AccountSettingsPanel } from "./AccountSettingsPanel";

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  container?: HTMLElement | null;
}

export function SettingsSheet({ open, onClose, container }: SettingsSheetProps) {
  const { formatMessage } = useIntl();

  return (
    <RightSheet
      open={open}
      onClose={onClose}
      title={formatMessage({ id: "cockpit.settings.title", defaultMessage: "Settings" })}
      container={container}
    >
      <div className="p-5">
        <AccountSettingsPanel />
      </div>
    </RightSheet>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/admin/src/components/Layout/ProfileSheet.tsx packages/admin/src/components/Layout/SettingsSheet.tsx packages/admin/src/components/Layout/accountSheet.events.ts
git commit -m "feat(admin): add ProfileSheet and SettingsSheet as separate RightSheet instances"
```

---

### Task 6: Rewire CanvasLayout

**Files:**
- Modify: `packages/admin/src/components/Layout/CanvasLayout.tsx`

This is the largest task — it wires up the new sheets, adds the nav loading gate, fixes the empty state GardenChip, and removes the UserAvatar from the top bar.

- [ ] **Step 1: Update imports**

In `packages/admin/src/components/Layout/CanvasLayout.tsx`, update the imports:

```tsx
// Remove these imports:
import { AccountSheet } from "./AccountSheet";
import { UserAvatar } from "./UserAvatar";
import {
  ACCOUNT_TAB_SEARCH_PARAM,
  ACCOUNT_SHEET_CONTENT_ID,
  OPEN_ACCOUNT_SHEET_EVENT,
  parseAccountSheetTab,
  type AccountSheetTab,
  type OpenAccountSheetEventDetail,
} from "./accountSheet.events";

// Add these imports:
import { ProfileSheet } from "./ProfileSheet";
import { SettingsSheet } from "./SettingsSheet";
import {
  ACCOUNT_TAB_SEARCH_PARAM,
  PROFILE_SHEET_CONTENT_ID,
  SETTINGS_SHEET_CONTENT_ID,
  OPEN_ACCOUNT_SHEET_EVENT,
  parseAccountSheetTab,
  type AccountSheetTab,
  type OpenAccountSheetEventDetail,
} from "./accountSheet.events";
```

- [ ] **Step 2: Replace account sheet state with separate profile/settings orchestration**

Remove the combined `accountSheetOpen` and `accountTab` state. Replace with separate checks.

Find and replace the sheet state block (around lines 91-116):

```tsx
// Remove:
const [accountTab, setAccountTab] = useState<AccountSheetTab>("profile");
const accountSheetOpen =
  orchestrator.activeSheet === "right" &&
  orchestrator.activeContentId === ACCOUNT_SHEET_CONTENT_ID;

useEffect(() => {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<OpenAccountSheetEventDetail>).detail;
    const nextTab = detail?.tab === "settings" ? "settings" : "profile";
    setAccountTab(nextTab);
    orchestrator.openSheet("right", ACCOUNT_SHEET_CONTENT_ID);
  };

  window.addEventListener(OPEN_ACCOUNT_SHEET_EVENT, handler as EventListener);
  return () => window.removeEventListener(OPEN_ACCOUNT_SHEET_EVENT, handler as EventListener);
}, [orchestrator]);

const handleOpenSearch = useCallback(() => setSearchOpen(true), []);
const openAccountSheet = useCallback(
  (tab: AccountSheetTab) => {
    setAccountTab(tab);
    orchestrator.openSheet("right", ACCOUNT_SHEET_CONTENT_ID);
  },
  [orchestrator]
);

// Replace with:
const profileSheetOpen =
  orchestrator.activeSheet === "right" &&
  orchestrator.activeContentId === PROFILE_SHEET_CONTENT_ID;

const settingsSheetOpen =
  orchestrator.activeSheet === "right" &&
  orchestrator.activeContentId === SETTINGS_SHEET_CONTENT_ID;

useEffect(() => {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<OpenAccountSheetEventDetail>).detail;
    const contentId = detail?.tab === "settings" ? SETTINGS_SHEET_CONTENT_ID : PROFILE_SHEET_CONTENT_ID;
    orchestrator.openSheet("right", contentId);
  };

  window.addEventListener(OPEN_ACCOUNT_SHEET_EVENT, handler as EventListener);
  return () => window.removeEventListener(OPEN_ACCOUNT_SHEET_EVENT, handler as EventListener);
}, [orchestrator]);

const handleOpenSearch = useCallback(() => setSearchOpen(true), []);
const openProfile = useCallback(
  () => orchestrator.openSheet("right", PROFILE_SHEET_CONTENT_ID),
  [orchestrator]
);
const openSettings = useCallback(
  () => orchestrator.openSheet("right", SETTINGS_SHEET_CONTENT_ID),
  [orchestrator]
);
```

- [ ] **Step 3: Update desktop profile redirect logic**

Find the desktop profile redirect effect (around lines 187-214). Replace `ACCOUNT_SHEET_CONTENT_ID` references:

```tsx
// Replace the pending tab effect (around line 201-214):
useEffect(() => {
  if (!isDesktop || rawWorkspaceId === "profile") {
    return;
  }

  const pendingTab = pendingDesktopAccountTabRef.current;
  if (!pendingTab) {
    return;
  }

  const contentId = pendingTab === "settings" ? SETTINGS_SHEET_CONTENT_ID : PROFILE_SHEET_CONTENT_ID;
  orchestrator.openSheet("right", contentId);
  pendingDesktopAccountTabRef.current = null;
}, [isDesktop, orchestrator, rawWorkspaceId]);
```

- [ ] **Step 4: Fix the empty state GardenChip**

Replace the `gardenChipNode` construction (around lines 268-296). When `showNoGardenAccessState` is true, use a `GardenChip` with empty gardens list instead of a static span, so the dropdown with "Create Garden" is always available:

```tsx
// Replace:
const gardenChipNode = showNoGardenAccessState ? (
  noGardenChipNode
) : (
  <GardenChip
    gardens={gardenList}
    selectedGarden={chipGarden}
    onSelectGarden={(g) => {
      if (g) {
        const fullGarden = eligibleGardens.find((garden) => garden.id === g.id);
        setSelectedGarden(fullGarden ?? null);
      } else {
        setSelectedGarden(null);
      }
    }}
    onCreateGarden={canCreateGarden ? () => navigate(adminRoutes.gardenCreate()) : undefined}
  />
);

// With:
const gardenChipNode = (
  <GardenChip
    gardens={gardenList}
    selectedGarden={chipGarden}
    onSelectGarden={(g) => {
      if (g) {
        const fullGarden = eligibleGardens.find((garden) => garden.id === g.id);
        setSelectedGarden(fullGarden ?? null);
      } else {
        setSelectedGarden(null);
      }
    }}
    onCreateGarden={() => navigate(adminRoutes.gardenCreate())}
  />
);
```

Also remove the `noGardenChipNode` variable (lines 268-278) — it's no longer needed.

- [ ] **Step 5: Update TopContextBar props — remove userAvatar, add onOpenProfile**

Find the TopContextBar render (around lines 320-327):

```tsx
// Replace:
<TopContextBar
  gardenChip={gardenChipNode}
  onOpenSearch={handleOpenSearch}
  onOpenSettings={isDesktop ? () => openAccountSheet("settings") : undefined}
  onOpenNotifications={() => orchestrator.openSheet("right", "notifications")}
  userAvatar={isDesktop ? userAvatarNode : undefined}
/>

// With:
<TopContextBar
  gardenChip={gardenChipNode}
  onOpenSearch={handleOpenSearch}
  onOpenSettings={isDesktop ? openSettings : undefined}
  onOpenNotifications={() => orchestrator.openSheet("right", "notifications")}
  onOpenProfile={isDesktop ? openProfile : undefined}
/>
```

Also remove the `userAvatarNode` variable (line 298):

```tsx
// Remove:
const userAvatarNode = <UserAvatar onOpenProfile={() => openAccountSheet("profile")} />;
```

- [ ] **Step 6: Add nav bar loading gate**

Find the nav bar render (around lines 352-360):

```tsx
// Replace:
<div className="canvas-area-bottom">
  {visibleSlotCount > 0 && (
    <FabAwareNavigationBar
      slots={slots}
      activePath={activePath}
      onNavigate={(path) => navigate(path)}
    />
  )}
</div>

// With:
<div className="canvas-area-bottom">
  {eligibleGardensLoaded && visibleSlotCount > 0 && (
    <FabAwareNavigationBar
      slots={slots}
      activePath={activePath}
      onNavigate={(path) => navigate(path)}
    />
  )}
</div>
```

- [ ] **Step 7: Replace AccountSheet with ProfileSheet + SettingsSheet**

Find the sheet portal section (around lines 364-384):

```tsx
// Replace:
<AccountSheet
  open={accountSheetOpen}
  activeTab={accountTab}
  onClose={() => orchestrator.closeSheet()}
  onTabChange={setAccountTab}
  container={overlayRootRef.current}
/>

// With:
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
```

- [ ] **Step 8: Verify the admin builds**

```bash
cd packages/shared && bun build && cd ../admin && bun build
```

Expected: Both build successfully.

- [ ] **Step 9: Commit**

```bash
git add packages/admin/src/components/Layout/CanvasLayout.tsx
git commit -m "refactor(admin): wire separate ProfileSheet/SettingsSheet, nav gate, empty state chip"
```

---

### Task 7: Delete AccountSheet.tsx

**Files:**
- Delete: `packages/admin/src/components/Layout/AccountSheet.tsx`

- [ ] **Step 1: Delete the file**

```bash
rm packages/admin/src/components/Layout/AccountSheet.tsx
```

- [ ] **Step 2: Verify no remaining imports**

```bash
grep -r "AccountSheet" packages/admin/src/ --include="*.tsx" --include="*.ts" | grep -v "accountSheet.events" | grep -v "__tests__"
```

Expected: No results (all references were replaced in Task 6).

- [ ] **Step 3: Commit**

```bash
git add packages/admin/src/components/Layout/AccountSheet.tsx
git commit -m "chore(admin): delete AccountSheet.tsx — replaced by ProfileSheet + SettingsSheet"
```

---

### Task 8: Empty State CTA Always Visible

**Files:**
- Modify: `packages/admin/src/components/Layout/CanvasGardenAccessState.tsx`

- [ ] **Step 1: Always show Create Garden button and update copy**

Replace the contents of `packages/admin/src/components/Layout/CanvasGardenAccessState.tsx`:

```tsx
import { Button } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { SeedlingIllustration } from "./SeedlingIllustration";

interface CanvasGardenAccessStateProps {
  onCreateGarden: () => void;
}

export function CanvasGardenAccessState({
  onCreateGarden,
}: CanvasGardenAccessStateProps) {
  const { formatMessage } = useIntl();

  return (
    <section
      className="flex min-h-full flex-col items-center justify-center px-6 py-16 text-center"
      data-testid="canvas-no-garden-access"
    >
      <SeedlingIllustration className="h-28 w-28" />
      <h1 className="mt-5 text-xl font-semibold text-text-strong">
        {formatMessage({
          id: "cockpit.access.noGardenTitle",
          defaultMessage: "No garden access yet",
        })}
      </h1>
      <p className="mt-2 max-w-md text-sm text-text-sub">
        {formatMessage({
          id: "cockpit.access.noGardenDescriptionUnified",
          defaultMessage:
            "Create your first garden or ask a garden owner to add you as an operator.",
        })}
      </p>
      <Button className="mt-6" onClick={onCreateGarden}>
        {formatMessage({
          id: "cockpit.workspace.createGarden",
          defaultMessage: "Create Garden",
        })}
      </Button>
    </section>
  );
}
```

Key changes:
- Removed `canCreateGarden` prop — button always shows
- Unified description copy for all users
- Simplified interface

- [ ] **Step 2: Update CanvasLayout call site**

In `packages/admin/src/components/Layout/CanvasLayout.tsx`, update the `CanvasGardenAccessState` usage (around line 342):

```tsx
// Before:
<CanvasGardenAccessState
  canCreateGarden={canCreateGarden}
  onCreateGarden={() => navigate(adminRoutes.gardenCreate())}
/>

// After:
<CanvasGardenAccessState
  onCreateGarden={() => navigate(adminRoutes.gardenCreate())}
/>
```

- [ ] **Step 3: Verify the admin builds**

```bash
cd packages/admin && bun build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/admin/src/components/Layout/CanvasGardenAccessState.tsx packages/admin/src/components/Layout/CanvasLayout.tsx
git commit -m "fix(admin): always show Create Garden CTA in empty state"
```

---

### Task 9: Relabel Mobile Tabs to "Account" / "Settings"

**Files:**
- Modify: `packages/admin/src/components/Layout/AccountSurface.tsx:39-44`
- Modify: `packages/admin/src/views/Profile/index.tsx:66`

- [ ] **Step 1: Update AccountSurface tab labels**

In `packages/admin/src/components/Layout/AccountSurface.tsx`, change the tab label for "profile" to "Account" (around line 43):

```tsx
// Before:
tabs={ACCOUNT_TABS.map((tab) => ({
  id: tab,
  label:
    tab === "settings"
      ? formatMessage({ id: "cockpit.settings.title", defaultMessage: "Settings" })
      : formatMessage({ id: "cockpit.nav.profile", defaultMessage: "Profile" }),
}))}

// After:
tabs={ACCOUNT_TABS.map((tab) => ({
  id: tab,
  label:
    tab === "settings"
      ? formatMessage({ id: "cockpit.settings.title", defaultMessage: "Settings" })
      : formatMessage({ id: "cockpit.nav.account", defaultMessage: "Account" }),
}))}
```

- [ ] **Step 2: Update Profile view page header title**

In `packages/admin/src/views/Profile/index.tsx`, change the PageHeader title (around line 66):

```tsx
// Before:
<PageHeader
  title={formatMessage({ id: "cockpit.profile.title", defaultMessage: "Profile" })}

// After:
<PageHeader
  title={formatMessage({ id: "cockpit.nav.account", defaultMessage: "Account" })}
```

- [ ] **Step 3: Commit**

```bash
git add packages/admin/src/components/Layout/AccountSurface.tsx packages/admin/src/views/Profile/index.tsx
git commit -m "fix(admin): relabel mobile profile tabs to Account/Settings"
```

---

### Task 10: Verify and Visual Check

- [ ] **Step 1: Build everything**

```bash
bun build
```

Expected: All packages build successfully.

- [ ] **Step 2: Run linting and formatting**

```bash
bun format && bun lint
```

Expected: No errors. Fix any that appear.

- [ ] **Step 3: Run tests**

```bash
bun run test
```

Expected: All tests pass. If any tests reference `AccountSheet`, `userAvatar` prop, or `canCreateGarden` prop, update them to match the new API.

- [ ] **Step 4: Visual verification**

Start the dev server (`bun dev`) and verify in the browser:

1. MainSheet has visible horizontal gutters and doesn't touch edges
2. MainSheet has a max-width on wide screens
3. All three top-right icons (bell, gear, person) look identical
4. Hovering each icon shows a tooltip
5. Hover state is circular with smooth scale animation
6. Clicking person icon opens Profile sheet with title header
7. Clicking gear icon opens Settings sheet with title header
8. Neither sheet shows tabs on desktop
9. RightSheet is wider (~320-400px depending on viewport)
10. Nav bar does not flash on initial load
11. "No garden access" state shows a "Create Garden" button
12. GardenChip shows "Create Garden" in dropdown even with no gardens
13. Bottom of MainSheet has visible margin

- [ ] **Step 5: Final commit (if any lint/test fixes were needed)**

```bash
git add -A && git commit -m "fix(admin): address lint and test issues from UI audit fixes"
```
