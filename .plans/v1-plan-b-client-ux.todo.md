# Plan B: Client UX Fixes

**GitHub Issues**: #383, #408, #428, #429, #381, #378
**Branch**: `fix/client-ux`
**Status**: IMPLEMENTED
**Created**: 2026-03-07
**Phase**: 2 (after Plan A lands)
**Depends on**: Plan A (shared infrastructure — IPFS, image fallbacks)

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Add SW cache clearing to shared logout handler | All apps benefit, not just client |
| 2 | Bump form inputs to `text-base` (16px) | Prevents iOS auto-zoom on focus |
| 3 | Add close button to notification popover | HTML Popover API `auto` dismiss exists but users need visible affordance |
| 4 | Change garden name from `line-clamp-1` to `line-clamp-2` | User wants full name visible, two rows |
| 5 | Time-spent is a label fix, not a logic fix | Conversion is correct (hours → minutes) |

## CLAUDE.md Compliance
- [x] Hooks in shared package (logout fix goes in Auth.tsx)
- [ ] i18n for UI strings (notification close, time-spent label)
- [x] No deep imports — all shared barrel imports

## Impact Analysis

### Files to Modify
- `packages/shared/src/providers/Auth.tsx` — add SW cache clear to signOut
- `packages/shared/src/modules/app/service-worker.ts` — add `clearCaches()` method
- `packages/shared/src/components/Form/FormInput.tsx` — font-size to 16px
- `packages/shared/src/components/Form/FormTextarea.tsx` — font-size to 16px
- `packages/client/src/components/Navigation/TopNav.tsx` — notification close button
- `packages/client/src/views/Home/Garden/Notifications.tsx` — close affordance
- `packages/client/src/views/Home/Garden/index.tsx` — garden name line-clamp, scroll fix
- `packages/client/src/views/Home/Garden/Work.tsx` — back navigation fix

### Files to Create
- None

## Test Strategy
- **Unit tests**: Service worker cache clearing, back navigation logic
- **Component tests**: Notification dialog close, form input rendering at 16px
- **Manual**: iOS Safari zoom test, garden name wrapping, scroll-to-top flash

---

## Implementation Steps

### Step 1: Add programmatic cache clearing to service worker module
**Files**: `packages/shared/src/modules/app/service-worker.ts`
**Details**:
- Add `async clearAllCaches()` method to the ServiceWorkerManager class
- Logic: `caches.keys()` → `caches.delete(key)` for each
- Also clear IndexedDB `gg-react-query` database
- Export the method for use in signOut

**Verification**: Unit test that `clearAllCaches()` calls `caches.delete` for all keys

---

### Step 2: Wire cache clearing into logout handler
**Files**: `packages/shared/src/providers/Auth.tsx` (lines 360-380)
**Details**:
- After `queryClient.clear()` at line 379, call `serviceWorker.clearAllCaches()`
- Import the service worker module
- Make it async-safe (don't block logout on cache clear — use `.catch()` to avoid failures blocking signout)

**Current code at line 378-379**:
```typescript
// Clear query cache
queryClient.clear();
```
Add after:
```typescript
// Clear SW caches and IndexedDB to prevent stale data leaking across sessions
serviceWorker.clearAllCaches().catch(() => {});
```

**Verification**: Manual test — logout, check devtools Application tab for cleared caches

---

### Step 3: Fix iOS auto-zoom on form inputs
**Files**: `packages/shared/src/components/Form/FormInput.tsx` (line 39), `packages/shared/src/components/Form/FormTextarea.tsx` (line 40)
**Details**:
- Change `text-sm` to `text-base` (16px) on both components
- `text-sm` = 14px triggers iOS Safari auto-zoom on input focus
- `text-base` = 16px is the threshold that prevents zoom

**FormInput.tsx line 39** — change:
```
"text-sm text-text-strong-950 placeholder:text-text-soft-400"
```
to:
```
"text-base text-text-strong-950 placeholder:text-text-soft-400"
```

**FormTextarea.tsx line 40** — same change.

**Verification**: Test on iOS Safari — focus on input should NOT trigger page zoom

---

### Step 4: Add close button to notification popover
**Files**: `packages/client/src/components/Navigation/TopNav.tsx` (lines 34-54), `packages/client/src/views/Home/Garden/Notifications.tsx` (lines 61-107)
**Details**:
- Add an `<button popovertarget="{popoverId}" popovertargetaction="hide">` with RiCloseLine icon
- Position it at top-right of the notification card in `Notifications.tsx`
- The HTML Popover API `auto` type already dismisses on outside click, but users need a visible X
- Style: `absolute top-3 right-3`, same `w-11 h-11` pattern as NAV_BUTTON_BASE for consistency

**Verification**: Tap X → popover closes. Tap outside → popover closes.

---

### Step 5: Fix garden name truncation and banner sizing
**Files**: `packages/client/src/views/Home/Garden/index.tsx` (line 331)
**Details**:
- Change garden name from `line-clamp-1` to `line-clamp-2` to show full name on two rows
- Optionally reduce banner height from `h-44 md:h-52` to `h-36 md:h-44` to reclaim vertical space
- Update spacer div at line 377 accordingly (`h-[304px]` → recalculate based on new banner height)
- Reduce garden name text from `text-xl md:text-2xl` to `text-lg md:text-xl` to fit more content

**Current line 331**:
```html
<h1 className="text-xl md:text-2xl font-semibold line-clamp-1">{name}</h1>
```

**Verification**: Garden with a long name shows full text across two lines

---

### Step 6: Fix scroll-to-top flash when opening garden
**Files**: `packages/client/src/views/Home/Garden/index.tsx` (lines 51-52, 377)
**Details**:
- The flash is caused by scroll position resetting before the route transition
- Investigate: Is the home page scroll container being reset by the router?
- Potential fix: Use `scrollRestoration: "manual"` on the router, or prevent scroll reset on garden navigation by preserving scroll state
- Alternative: Add `scroll-behavior: instant` to the garden view container to prevent the visible scroll animation

**Verification**: Open a garden from home — no visible scroll jump. Return to home — scroll position preserved.

---

### Step 7: Fix back navigation from work detail
**Files**: `packages/client/src/views/Home/Garden/Work.tsx` (lines 469-485)
**Details**:
- Current `handleBack` at line 469 has 4-tier fallback:
  1. `state.from === "dashboard"` → `/home`
  2. `state.returnTo` → custom return path
  3. `history.length > 1` → `navigate(-1)` (browser back)
  4. Fallback → `/home/${gardenId}` or `/home`
- Bug: When navigating to work detail from a garden, `location.state` may not include `from` or `returnTo`, so it falls through to `navigate(-1)` which may go to `/home` if the garden was the first page visited
- Fix: When entering from a garden context, always set `returnTo` in navigation state. Or change the final fallback to prioritize garden over home.

**Verification**: From garden → work detail → back → returns to garden (not home)

---

### Step 8: Update time-spent field label
**Files**: Work form component (find the input field that renders "Time spent (hours)")
**Details**:
- The `normalizeTimeSpentMinutes()` function correctly converts hours → minutes
- The label should make the unit unambiguous: "Time spent" with a "(hours)" hint or placeholder
- Ensure the display in `WorkViewSection.tsx` (line 70, i18n key `app.home.workApproval.timeSpent`) shows the value converted back to hours for readability
- Check `formatTimeSpent()` utility — does it convert minutes back to a human-readable format?

**Verification**: User enters 1.5 in time-spent → stored as 90 minutes → displayed as "1.5 hours" or "1h 30m"

---

## Validation

```bash
bun format && bun lint && bun run test && bun build
```
