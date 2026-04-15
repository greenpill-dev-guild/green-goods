# Admin UI/UX Audit Fixes — Design Spec

**Date:** 2026-04-14
**Branch:** `feature/admin-ui-revamp`
**Approach:** B — Sheet System Refactor

## Problem

12 UI/UX issues identified from hands-on audit of the admin dashboard. The admin canvas layout has spatial, consistency, and usability problems that make it feel unfinished: MainSheet runs full-width with no "sheet" feeling, RightSheet is too narrow (300px max) causing content clipping, action icons are inconsistent, tooltips are missing, the nav bar flashes on load, and the no-garden empty state has no creation path.

## Issues Addressed

| # | Issue | Severity |
|---|-------|----------|
| 1 | MainSheet full-width, no gutter/padding | High |
| 2 | Action icons inconsistent (profile avatar differs from bell/gear) | High |
| 3 | Hover animation is a harsh rectangle | Medium |
| 4 | No tooltips on top-right action icons | Medium |
| 5 | Nav bar appears then disappears (flash) | High |
| 6 | No garden creation path when no access | High |
| 7 | No bottom padding when nav hidden | Medium |
| 8 | RightSheet too narrow (300px max) | Critical |
| 9 | Profile tabs showing on desktop (should be mobile-only) | High |
| 10 | Tab labels wrong ("Profile" should be "Account") | Low |
| 11 | Sheet content styling poor (overflow, unclear buttons) | High |
| 12 | Notifications sheet placeholder styling | Low |

## Design

### 1. Responsive Sheet Width Tokens

**Current:** `maxWidth: "clamp(220px, 20vw, 300px)"` hardcoded in RightSheet inline style.

**Change:** Define CSS custom properties on the canvas grid container and reference them from RightSheet.

```css
/* theme.css — canvas grid section */
.workspace-canvas-grid {
  --canvas-right-sheet-width: clamp(320px, 28vw, 480px);
}
```

```tsx
/* RightSheet.tsx — replace inline maxWidth */
style={{
  maxWidth: "var(--canvas-right-sheet-width, clamp(320px, 28vw, 480px))",
}}
```

**Rationale:** At 1440px viewport, the sheet gets ~400px. At 2560px ultrawide, it caps at 480px. The minimum of 320px ensures content never clips. The CSS custom property is a single source of truth for all sheets (profile, settings, notifications).

### 2. MainSheet Gutters + Max-Width

**Current:** MainSheet fills the entire `canvas-area-main` grid cell edge-to-edge.

**Change:** Add horizontal margin and max-width to MainSheet so it reads as a distinct surface.

```tsx
/* MainSheet.tsx — outer container */
className="... mx-4 max-w-[1400px] self-center"
```

This matches TopContextBar's `px-4` gutter. On screens wider than ~1432px, the sheet centers and stops growing. The `mx-4` applies the 16px gutter on each side.

### 3. Bottom Padding

**Current:** The `main` scroll area has `paddingBottom: 6rem` (desktop) / `9.5rem` (mobile), but the MainSheet container itself can touch the viewport bottom when the nav bar is hidden.

**Change:** Add `mb-4` to the MainSheet container so it always has a 16px bottom margin, matching the horizontal gutters. This is independent of the scroll area's internal padding.

### 4. TopBarIconButton Component

**Current:** `ICON_BTN` is a className string constant. The profile avatar uses a separate `UserAvatar` component with `ml-1` and different hover behavior.

**Change:** Create a `TopBarIconButton` component that wraps each action icon with:

- **Container:** `h-10 w-10 rounded-full` (circular, not `rounded-sm`)
- **Color:** `text-text-strong` (not `text-text-sub` — better contrast on canvas bg)
- **Hover:** `bg-[rgb(var(--m3-on-surface)/0.08)] scale-105`
- **Press:** `bg-[rgb(var(--m3-on-surface)/0.12)] scale-95`
- **Transition:** `duration-[var(--spring-micro-duration,150ms)]`
- **Focus ring:** `ring-2 ring-[rgb(var(--ws-primary))]`
- **Tooltip:** Radix `Tooltip.Provider` wrapping the button, `delayDuration={400}`, placement `bottom`

```tsx
function TopBarIconButton({ tooltip, onClick, children, className }: {
  tooltip: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button type="button" onClick={onClick} aria-label={tooltip} className={cn(ICON_BTN, className)}>
          {children}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="bottom" sideOffset={4} className="...">
          {tooltip}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
```

**Profile icon change:** Replace `UserAvatar` in the top bar with `<TopBarIconButton tooltip="Profile"><RiUserLine /></TopBarIconButton>`. The avatar with initials moves to the profile sheet content header.

All three icons (notifications, settings, profile) now use identical markup and styling.

### 5. Profile & Settings Sheet Separation (Desktop)

**Current:** Single `AccountSheet` wraps `AccountSurface` which renders `AdminTabRail` with "Profile"/"Settings" tabs inside one `RightSheet`.

**Change:**

- **Delete** `AccountSheet.tsx` (the combined wrapper)
- **Create** `ProfileSheet.tsx` — opens `RightSheet` with `title="Profile"`, renders `AccountProfilePanel` directly
- **Create** `SettingsSheet.tsx` — opens `RightSheet` with `title="Settings"`, renders `AccountSettingsPanel` directly
- **CanvasLayout** registers two content IDs with the sheet orchestrator: `"profile"` and `"settings"`
- Profile icon (`RiUserLine`) triggers `orchestrator.openSheet("right", "profile")`
- Settings icon (`RiSettings3Line`) triggers `orchestrator.openSheet("right", "settings")`

**Mobile behavior preserved:** The Profile route (`/profile`) continues to render a full-page view with tabs. Tab labels change from "Profile"/"Settings" to "Account"/"Settings" per user feedback.

**`AccountSurface` retained for mobile:** `AccountSurface` keeps its tab structure but is only used by the mobile Profile view, not by the desktop sheets.

### 6. Navigation Bar Loading Gate

**Current:** `visibleSlotCount > 0` gates the nav, but `visibleSlotCount` initially includes the profile slot (`visible: true`), so the nav renders briefly before garden data loads and reduces the slot count.

**Change:** Add `eligibleGardensLoaded` to the render guard:

```tsx
{eligibleGardensLoaded && visibleSlotCount > 0 && (
  <FabAwareNavigationBar ... />
)}
```

The loading spinner already covers the wait. Once data arrives, the nav appears with the correct slots — no flash.

### 7. Empty State — Create Garden CTA

**Current:** `CanvasGardenAccessState` shows a "Create Garden" button only if `canCreateGarden` is true. No dropdown in GardenChip when there are no gardens.

**Changes:**

1. **Empty state CTA:** Always show the "Create Garden" button in the empty state. Update the description copy to be more encouraging: "Create your first garden or ask an operator to add you."
2. **GardenChip dropdown:** When `showNoGardenAccessState` is true, replace the static `noGardenChipNode` span with a `GardenChip` that has `gardens={[]}` and `onCreateGarden` always provided. This gives the chip a tappable dropdown with "Create Garden" even when there are no gardens to list.

### 8. Sheet Content Styling

Most content overflow resolves automatically with the wider 320-480px sheet. Additional fixes:

- **All sheet panels:** Consistent `p-5` padding and `gap-5` section spacing
- **Profile panel:** Avatar at `h-14 w-14` with initials, centered. Name, role badge, wallet card below — all have room now
- **Settings panel:** Theme selector `grid-cols-3` renders correctly at 320px+
- **Notification panel:** Empty state centers properly at new width

## Files Changed

### Shared Package (`packages/shared`)
- `src/components/Canvas/RightSheet.tsx` — width from CSS token
- `src/components/Canvas/MainSheet.tsx` — add `mx-4 mb-4 max-w-[1400px]`
- `src/components/Canvas/TopContextBar.tsx` — `TopBarIconButton` component with tooltip + M3 state layer
- `src/styles/theme.css` — `--canvas-right-sheet-width` token

### Admin Package (`packages/admin`)
- `src/components/Layout/CanvasLayout.tsx` — separate profile/settings orchestration, nav loading gate, empty state GardenChip
- `src/components/Layout/AccountSheet.tsx` — **delete** (replaced by ProfileSheet + SettingsSheet)
- `src/components/Layout/ProfileSheet.tsx` — **new** (thin RightSheet wrapper for profile)
- `src/components/Layout/SettingsSheet.tsx` — **new** (thin RightSheet wrapper for settings)
- `src/components/Layout/AccountSurface.tsx` — mobile-only, tab labels to "Account"/"Settings"
- `src/components/Layout/CanvasGardenAccessState.tsx` — always show Create Garden CTA
- `src/components/Layout/UserAvatar.tsx` — remove top-bar usage, retain for sheet content
- `src/views/Profile/index.tsx` — tab labels to "Account"/"Settings"

## Out of Scope

- Full canvas layout token system (Approach C) — deferred
- Dark mode sheet styling
- Notification system implementation (panel remains placeholder)
- LeftSheet changes
- Mobile navigation bar styling
