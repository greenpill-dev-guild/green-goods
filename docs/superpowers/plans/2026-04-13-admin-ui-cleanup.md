# Admin UI Cleanup — Anti-Gravity Prompt

> **Branch:** `feature/admin-ui-revamp`
> **Context:** We just added 13 `Admin*` M3 components but the integration is rough. The CSS overrides for the nav bar broke it, compact sizing wasn't applied consistently, and several pre-existing UI issues remain. This prompt lists every issue to fix.

---

## Issue Inventory

### 1. Navigation Bar — Items invisible / broken CSS overrides

**Problem:** The CSS overrides in `packages/admin/src/styles/admin-m3-overrides.css` targeting `.canvas-navigation-bar` are breaking the nav bar — items are not visible. The overrides are too aggressive and conflict with the shared NavigationBar's internal structure.

**Root cause:** The overrides assume specific DOM nesting (`button > span:first-child`) but the actual NavigationBar component has different internal structure (NavItem sub-component with its own layout). The `transform: none` also breaks the centering.

**Fix:**
- **Revert the nav bar CSS overrides entirely** — remove everything in the "Navigation Bar" section of `admin-m3-overrides.css` (lines 1-90 approximately)
- The NavigationBar should render as-is from shared. The existing floating pill design on desktop and floating bar on mobile is the actual intended design for this app — it's not a standard M3 nav bar, it's a spatial floating dock
- Do NOT try to force M3 nav bar anatomy onto a floating dock component via CSS overrides — they are different paradigms
- If M3 nav bar compliance is needed in the future, it should be a separate AdminNavigationBar component (like the other Admin* components), not CSS overrides

**Files:** `packages/admin/src/styles/admin-m3-overrides.css`

---

### 2. FAB — Not wired to AdminFab component

**Problem:** The `AdminFab` component exists but isn't actually used anywhere. The NavigationBar still renders its internal `FabButton` which uses the old circular style with ws-primary color.

**Fix:** This is a shared component boundary issue. The FAB inside NavigationBar cannot be swapped from admin since it's internal to the shared component. Leave as-is for now — this requires a shared component change (adding a `fabRenderer` prop or similar) which is out of scope for admin-only fixes.

**Status:** Deferred — needs shared component change

---

### 3. Tabs — Compact but not flush with content

**Problem:** The AdminTabRail was compacted to 36dp/40dp but:
- Tabs don't go full width within their container
- There's padding between the tab rail and the content below it, creating a gap
- The tab rail has its own padding that doesn't align with the content area padding

**Fix in `packages/admin/src/components/AdminTabRail.tsx`:**
- Remove the container background `bg-[rgb(var(--m3-surface))]` — tabs should be transparent, inheriting the surface they sit on
- Make the border-bottom extend full width (it already does via `w-full`)
- Ensure `className` prop can override padding so views can make tabs flush

**Fix in view files (Hub, Garden, etc.):**
- Ensure the tab rail sits flush at the top of its container without extra margin/padding pushing it inward
- The tab rail should be at `mx-0` within its parent, not inheriting any parent padding

---

### 4. Flash / blur on tab change

**Problem:** When switching tabs in the Garden view, there's a visible flash/rerender that shows content changing abruptly.

**Root cause:** Likely the `PageTransition` component in `packages/admin/src/components/Layout/PageTransition.tsx` applying an opacity/transform animation on route changes that also triggers on tab switches (which may be route-based).

**Fix:** Check if tab changes trigger route navigation that goes through `PageTransition`. If so, tab changes within a view should NOT animate via PageTransition — only top-level route changes should. The fix is either:
- Skip PageTransition animation when only the sub-path changes (e.g., `/garden/overview` → `/garden/community` is a tab change, not a page change)
- Or remove PageTransition animation entirely if it's causing more harm than good

**Files:** `packages/admin/src/components/Layout/PageTransition.tsx`, view router config

---

### 5. Settings sheet — not sliding in

**Problem:** The account settings sheet appears/disappears instead of sliding in from the side like a proper sheet animation.

**Check:** `packages/admin/src/components/Layout/AccountSheet.tsx` wraps `SideSheet` from shared. The SideSheet should have slide-in animation via Radix Dialog's `data-[state=open/closed]` transitions.

**Fix:** Verify the SideSheet's animation classes are working. The issue may be:
- The `bounded` mode of SideSheet skipping animations
- The CSS override in `admin-m3-overrides.css` targeting side sheets and breaking the animation
- Check if the side sheet override (`max-width: 256px`) is interfering

**Files:** `packages/admin/src/styles/admin-m3-overrides.css` (side sheet section), `packages/shared/src/components/Canvas/SideSheet.tsx`

---

### 6. Profile/Settings should be separate views, not tabs

**Problem:** Profile and Settings are currently tabs within a single AccountSheet (SideSheet). On desktop, this shows a mobile-style tab pattern that's unnecessary. Profile and Settings should each be their own view/sheet.

**Fix:**
- Remove the tab rail from `AccountSurface` — it should not use `AdminTabRail`
- `AccountSheet` should render either Profile OR Settings based on which was opened (via the `activeTab` prop it already receives)
- The sheet title already changes based on `activeTab` — just remove the tab switcher UI and let the caller control which content shows
- In `CanvasLayout.tsx`, the account sheet is opened via events with a tab parameter — this routing already works, just remove the in-sheet tab UI

**Files:**
- `packages/admin/src/components/Layout/AccountSurface.tsx` — remove `AccountTabList`, render content directly based on `activeTab`
- `packages/admin/src/components/Layout/AccountSheet.tsx` — no changes needed (already passes `activeTab`)

---

### 7. Canvas content not using full width

**Problem:** The main content area has too much horizontal padding, not using the full width of the canvas.

**Check:** `packages/shared/src/components/Canvas/MainSheet.tsx` — check its padding. Also check if the views themselves add excessive padding.

**Fix:** Views should use the full MainSheet width. If MainSheet has large padding, it should be reduced for admin. Check each view's root container for unnecessary `px-*` classes.

---

### 8. GardenChip text too large

**Problem:** Garden names in the GardenChip (garden switcher in TopContextBar) are too large, causing truncation.

**File:** `packages/shared/src/components/Canvas/GardenChip.tsx`

**Fix:** This is a shared component. Options:
- a) Reduce the font size in the shared GardenChip (affects client too)
- b) Apply a CSS override via `.admin-m3` class in the admin overrides CSS
- Recommend option (b): `.admin-m3 .garden-chip { font-size: 0.8125rem; }` or similar, targeting the chip's text element

---

### 9. Typography inconsistency

**Problem:** Text sizes are all over the place — bigger where you'd expect smaller, smaller where you'd expect bigger. The M3 type scale exists in tokens but isn't consistently applied.

**Fix:** Audit the Garden view specifically:
- Page titles should use `text-headline-sm` (24sp)
- Section headers should use `text-title-md` (16sp)
- Body text should use `text-body-md` (14sp)
- Labels should use `text-label-md` (12sp)
- Remove any raw `text-lg`, `text-sm`, `text-xs` that aren't mapped to the M3 type scale

This is a broader sweep — focus on the Garden tab views first.

---

### 10. Dark mode — color palette clash

**Problem:** Dark mode doesn't follow M3 dark theme properly. There's still a clash of color palettes — some elements use the old theme tokens, some use M3 tokens, creating visual inconsistency.

**Fix:** The M3 dark mode tokens are defined in `packages/admin/src/styles/admin-m3-tokens.css` under `[data-theme="dark"]`. But the Admin* components reference M3 tokens while the shared components (CanvasWorkbenchList, Surface, etc.) still use the old `--bg-*` / `--text-*` tokens. This creates two competing palettes.

**Approach:** Don't try to fix all of dark mode in this pass. Instead:
- Ensure the Admin* components look correct in dark mode (they should, since they use `--m3-*` tokens which have dark overrides)
- For the shared components visible in admin, add targeted dark mode overrides in `admin-m3-overrides.css`
- Focus on the most visible surfaces: MainSheet background, tab rail, search toolbar, and list items

---

### 11. Profile icon hover state

**Problem:** The profile icon in TopContextBar has an active hover effect that appears/disappears — it should match the other icons' hover behavior (or have no special treatment).

**File:** This is in the TopContextBar which is a shared component. Check `packages/shared/src/components/Canvas/TopContextBar.tsx` for the user avatar/profile button styling.

**Fix:** Via CSS override in admin-m3-overrides, normalize the profile button hover to match other icon buttons.

---

## Priority Order

1. **Nav bar fix** (#1) — broken, no items visible → revert CSS overrides
2. **Tab flush + no background** (#3) — visual alignment
3. **Remove account tabs** (#6) — structural simplification
4. **Settings sheet animation** (#5) — interaction quality
5. **Tab change flash** (#4) — interaction quality
6. **Garden chip text size** (#8) — quick CSS fix
7. **Full width content** (#7) — layout
8. **Typography audit** (#9) — consistency pass
9. **Dark mode** (#10) — targeted fixes
10. **Profile icon hover** (#11) — minor polish
11. **FAB** (#2) — deferred

---

## Reference Files

| Component | Path |
|-----------|------|
| Admin M3 overrides CSS | `packages/admin/src/styles/admin-m3-overrides.css` |
| Admin M3 tokens CSS | `packages/admin/src/styles/admin-m3-tokens.css` |
| AdminTabRail | `packages/admin/src/components/AdminTabRail.tsx` |
| AdminSearchToolbar | `packages/admin/src/components/AdminSearchToolbar.tsx` |
| AdminFilterChip | `packages/admin/src/components/AdminFilterChip.tsx` |
| CanvasLayout | `packages/admin/src/components/Layout/CanvasLayout.tsx` |
| AccountSheet | `packages/admin/src/components/Layout/AccountSheet.tsx` |
| AccountSurface | `packages/admin/src/components/Layout/AccountSurface.tsx` |
| PageTransition | `packages/admin/src/components/Layout/PageTransition.tsx` |
| NavigationBar (shared) | `packages/shared/src/components/Canvas/NavigationBar.tsx` |
| SideSheet (shared) | `packages/shared/src/components/Canvas/SideSheet.tsx` |
| MainSheet (shared) | `packages/shared/src/components/Canvas/MainSheet.tsx` |
| GardenChip (shared) | `packages/shared/src/components/Canvas/GardenChip.tsx` |
| TopContextBar (shared) | `packages/shared/src/components/Canvas/TopContextBar.tsx` |
| Theme tokens (shared) | `packages/shared/src/styles/theme.css` |

## Design Spec

`docs/superpowers/specs/2026-04-13-admin-m3-component-compliance-design.md`

## Key Constraint

**Zero shared package changes** unless absolutely necessary for a fix. Admin-only overrides via:
1. Admin component files in `packages/admin/src/components/`
2. CSS overrides in `packages/admin/src/styles/admin-m3-overrides.css`
3. View-level changes in `packages/admin/src/views/`
