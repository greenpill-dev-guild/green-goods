# Admin UI Revamp — Wave 3: Shell + Primitives

**Status**: READY
**Branch**: `feature/admin-ui-revamp`
**Created**: 2026-04-06
**Depends on**: Waves 1+2 (query-keys split, barrel exports, test suites, Endowments extraction)

## Motivation

The admin cockpit shell is structurally incomplete. `CockpitLayout` bypasses `TopContextBar` entirely, wiring GardenChip and UserMenu into NavigationBar's `leading`/`trailing` slots as a workaround. The workspace canvas is a plain scroll area. Admin views repeat the same `rounded-xl border border-stroke-soft bg-bg-white p-4 shadow-sm` recipe 30+ times. The client package has mature utilities (btn-icon, badge-pill-\*, cv-\*, tap-feedback) that should be shared foundations. Popover and shimmer styles are duplicated between packages.

Wave 3 reconciles the documented shell contract (TopContextBar + NavigationBar + workspace canvas) with the live code, promotes client visual utilities into shared, and establishes surface primitives to replace the raw recipes.

---

## Part 1: Current-State Audit

### Shell Architecture Drift

| Documented (DESIGN_SYSTEM.md) | Live Code (CockpitLayout.tsx) | Gap |
|---|---|---|
| TopContextBar for context | NOT wired — ad-hoc mobile floating controls at lines 148-159 | TopContextBar exists in shared, unused |
| FloatingToolbar for navigation | NavigationBar replaces it (comment: "Replaces FloatingToolbar (deprecated)") | FloatingToolbar still exported from shared barrel |
| GardenChip in TopContextBar | GardenChip in NavigationBar `leading` slot (desktop-only) | Wrong component hierarchy |
| User avatar in TopContextBar | UserMenu in NavigationBar `trailing` slot (Radix dropdown) | UserMenu does too much; no standalone avatar |
| Settings icon in TopContextBar | No settings icon — `UserMenu` has "More settings" link | Indirect access only |
| Workspace canvas treatment | `bg-bg-weak` on root div, no surface treatment on `<main>` | Generic scroll area |

### Mobile Shell Problems

- `CockpitLayout` lines 148-159: Fixed GardenChip (top-left) and search button (top-right) are ad-hoc floating elements — exactly what TopContextBar already provides but with z-30 instead of z-40 and no connection to sheet context
- No way to open Settings on mobile except through UserMenu (which is hidden `min-[600px]:flex` on the trailing slot)
- No user identity visible on mobile at all

### Styling Layer Gaps

| Utility | Client | Admin | Shared | Action |
|---|---|---|---|---|
| `btn-icon` | `utilities.css:82-102` | missing | missing | Promote to shared |
| `badge-pill-*` (8 variants) | `utilities.css:122-160` | missing | missing | Promote to shared |
| `cv-*` (6 variants) | `utilities.css:234-266` | missing | missing | Promote to shared |
| `h-modal` / `max-h-modal` | `utilities.css:283-294` | missing | missing | Promote to shared |
| `tap-feedback` | `animation.css:143-153` | missing | missing | Promote to shared |
| `tap-target-lg` | `utilities.css:104-115` | missing | missing | Promote to shared |
| `native-scroll` | `utilities.css:273-276` | missing | missing | Promote to shared |
| `[popover]` styles | `utilities.css:168-225` | `index.css:508-568` | missing | **Deduplicate** → shared |
| `shimmer` keyframes | `animation.css:45-52` (`-1000px`) | `index.css:262-269` (`200%`) | missing | Canonicalize in shared (pick one) |
| `skeleton` / `skeleton-shimmer` | `animation.css:54-72` | `index.css:396-400` | missing | Deduplicate → shared |
| `.surface-section` | missing | missing | missing | **Create** in admin |
| `.surface-card` | missing | missing | missing | **Create** in admin |
| `.workspace-canvas` | missing | missing | missing | **Create** in admin |

### Raw Surface Recipes (30+ instances)

Pattern: `rounded-{lg,xl} border border-stroke-soft bg-bg-white p-{4,6} shadow-sm`

| View | File | Instances |
|---|---|---|
| HypercertDetail | `views/Gardens/Garden/HypercertDetail.tsx` | 8 |
| Endowments | `views/Endowments/index.tsx` + subcomponents | 4 |
| Dashboard | `views/Dashboard/index.tsx` | 1 |
| Strategies | `views/Gardens/Garden/Strategies.tsx` | 2 |
| Vault | `views/Gardens/Garden/Vault.tsx` | 4 |
| SignalPool | `views/Gardens/Garden/SignalPool.tsx` | 4 |
| Hypercerts gallery | `views/Gardens/Garden/Hypercerts.tsx` | 2 |
| Deployment | `views/Deployment/` subcomponents | 3 |
| Contracts | `views/Contracts/ContractUpgradePanel.tsx` | 2 |

### Legacy Files Still Exported

From `packages/admin/src/components/Layout/index.ts`:
- `DashboardLayout` — legacy shell, not used by routes
- `Header` — legacy top bar, not used
- `Sidebar` — legacy nav, not used
- `Breadcrumbs` — superseded by TopContextBar context label
- `UserProfile` — superseded by UserMenu/SettingsSheet

---

## Part 2: Ownership Recommendations

### Promote to `packages/shared/src/styles/utilities.css` (NEW)

These are product-agnostic UI primitives already battle-tested in client:

| Utility | Source | Lines | Why shared |
|---|---|---|---|
| `.btn-icon` + `.btn-icon svg` + `::after` | client `utilities.css:82-102` | 21 | Admin needs icon buttons too |
| `.badge-pill` + 7 color variants | client `utilities.css:122-160` | 39 | Status display across both apps |
| `.cv-auto`, `.cv-work-card`, etc. | client `utilities.css:234-266` | 33 | Performance primitive for any list |
| `.h-modal`, `.max-h-modal` | client `utilities.css:283-294` | 12 | Used by BottomSheet (shared) |
| `.tap-feedback` + `:active` | client `animation.css:143-153` | 11 | Touch-first UX across both apps |
| `.tap-target-lg` + `::after` | client `utilities.css:104-115` | 12 | Touch target expansion |
| `.native-scroll` | client `utilities.css:273-276` | 4 | Scroll behavior standardization |
| `[popover]` full suite | client `utilities.css:168-225` | 58 | Exact duplicate in admin |
| `shimmer` + `.skeleton` + `.skeleton::after` | client `animation.css:45-72` | 28 | Canonical animation |

### Keep in admin (`packages/admin/src/index.css`)

| Pattern | Why admin-specific |
|---|---|
| `--elevation-0` through `--elevation-5` | M3 tonal elevation with green tinting — cockpit-specific |
| `.shadow-elevation-*` | Elevation utilities consuming admin tokens |
| `.surface-section`, `.surface-inset`, `.surface-card` | NEW — admin surface primitives |
| `.workspace-canvas` | NEW — cockpit canvas treatment |
| `.skeleton-shimmer` (existing) | Can become thin alias importing shared `.skeleton` |
| `nav-bar-enter` keyframe | Cockpit-specific animation |
| `stagger-children` | Cockpit list animation |

### Keep in client (after extraction)

| Pattern | Why client-specific |
|---|---|
| `.landing-hover` | Landing page only |
| `.image-lut` | Photo post-processing |
| `view-transitions.css` (named VT classes) | Client SPA navigation |
| Modal slide/bounce animations | Client modal patterns |
| `.scroll-reveal` | Landing page scroll animation |
| `.work-confirmed-shimmer` | Client-specific optimistic UI |

### Avoid bringing to admin

- `.landing-hover` — consumer-facing flourish
- `.ripple-effect` — too decorative for operational UI
- `.shake-error` — too aggressive for admin forms (admin uses subtle red border + toast)
- `.pulse-success` — too playful; admin uses `confirmedShimmer` (calmer)

---

## Part 3: Shell Architecture

### 3-Region Desktop Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ TopContextBar (z-40, h-14, sticky)                              │
│ ┌─GardenChip────────────────────┐  ┌─Search─Settings─Avatar──┐ │
│ └────────────────────────────────┘  └─────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ main.workspace-canvas (flex-1, overflow-y-auto)                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  PageHeader (sticky within scroll, backdrop-blur)           │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │                                                             │ │
│ │  Route content with .surface-section / .surface-card        │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ NavigationBar (z-30, no leading/trailing — pure nav)            │
│ ┌─Work──Garden──Community──Actions─┐                            │
│ └──────────────────────────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

### 3-Region Mobile Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ TopContextBar (z-40, h-14, sticky)                              │
│ ┌─GardenChip────────────────────┐  ┌─Settings──Avatar────────┐ │
│ └────────────────────────────────┘  └─────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ main.workspace-canvas (flex-1, overflow-y-auto)                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  Route content                                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ NavigationBar (z-30, full-width bottom bar — pure nav)          │
│ ┌──Work────Garden────Community────Actions──┐                    │
│ └──────────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

### Key Shell Changes

| Change | Why |
|---|---|
| Wire TopContextBar into CockpitLayout above `<main>` | Reconcile docs with reality — context belongs at top, not smuggled into nav |
| Remove NavigationBar `leading`/`trailing` slots | Nav bar should be pure navigation; identity/context belongs in TopContextBar |
| Remove mobile floating controls (lines 148-159) | TopContextBar replaces these ad-hoc elements |
| Create UserAvatar.tsx in admin | Compact circle button (role initial), tap opens SettingsSheet; replaces UserMenu as the visible trigger |
| Create ConnectShell.tsx in admin | Disconnected-state shell: centered connect prompt, no nav bar |
| Delete legacy files | DashboardLayout, Header, Sidebar, Breadcrumbs, UserProfile — dead code |
| Delete FloatingToolbar from shared barrel | Deprecated, replaced by NavigationBar — consumers should not import it |

### Auth/Connect Clarity

**Connected state:**
- UserAvatar in TopContextBar (rightmost icon) — tap opens SettingsSheet
- Role initial letter (D/O/U) always visible at top-right
- SettingsSheet absorbs: profile, theme, chain, disconnect

**Disconnected state:**
- ConnectShell renders instead of CockpitLayout
- Centered card: Green Goods logo, "Connect to continue", AppKit connect button
- No floating nav, no TopContextBar — clean pre-auth experience
- After connect → redirect to /work (existing auth flow)

---

## Part 4: Styling System Strategy

### Surface Primitives (admin/index.css)

Replace the 30+ raw `rounded-xl border border-stroke-soft bg-bg-white p-4 shadow-sm` recipes with three named classes:

```css
/* Full-width section: page-level grouping */
.surface-section {
  @apply rounded-xl border border-stroke-soft bg-bg-white shadow-sm;
  @apply p-4 sm:p-5;
}

/* Inset panel: nested inside a section or grid cell */
.surface-inset {
  @apply rounded-lg border border-stroke-soft bg-bg-white shadow-sm;
  @apply p-4;
}

/* Compact card: metric tile, stat block */
.surface-card {
  @apply rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm;
  @apply transition-shadow duration-200 hover:shadow-md;
}
```

Design rationale:
- `surface-section` uses `rounded-xl` + responsive padding — for top-level grouping (Treasury card, Overview panel)
- `surface-inset` uses `rounded-lg` + fixed padding — for nested elements (vault details inside Treasury)
- `surface-card` adds hover elevation — for interactive items (garden cards, stat tiles)

### Workspace Canvas (admin/index.css)

```css
/* Workspace canvas — subtle dot-grid treatment on main scroll area */
.workspace-canvas {
  background-color: rgb(var(--bg-weak-50));
  background-image: radial-gradient(
    circle,
    rgb(var(--stroke-soft-200) / 0.4) 1px,
    transparent 1px
  );
  background-size: 24px 24px;
}

[data-theme="dark"] .workspace-canvas {
  background-image: radial-gradient(
    circle,
    rgb(var(--stroke-soft-200) / 0.15) 1px,
    transparent 1px
  );
}

@media (prefers-reduced-motion: reduce) {
  .workspace-canvas {
    background-image: none;
  }
}
```

Design rationale: A dot-grid evokes a physical workspace surface (graph paper, drafting table) without being decorative. The pattern is subtle enough (0.4 alpha, 24px spacing) to recede behind content while giving the canvas spatial presence. Dark mode reduces opacity further to avoid visual noise.

### PageHeader Refinement

Current PageHeader has `bg-bg-white/95 backdrop-blur` when sticky. Refinement:

```css
/* Stronger backdrop + elevation hint when scrolled under content */
sticky && "sticky top-0 z-30 bg-bg-white/90 supports-[backdrop-filter]:bg-bg-white/60 backdrop-blur-lg shadow-elevation-1"
```

Change: `bg-bg-white/70` → `bg-bg-white/60` (more translucent), `backdrop-blur` → `backdrop-blur-lg` (stronger blur), add `shadow-elevation-1` for subtle underline depth.

### Shared Utility Import Chain

```
shared/src/styles/theme.css      ← tokens, @property, semantic variables
shared/src/styles/utilities.css  ← NEW: promoted utilities (btn-icon, badge-pill-*, etc.)

admin/src/index.css
  @import "@green-goods/shared/styles/theme.css";  ← already exists
  @import "@green-goods/shared/styles/utilities.css"; ← NEW import
  /* admin-specific: elevation, surfaces, canvas, admin animations */

client/src/index.css
  @import "@green-goods/shared/styles/theme.css";  ← already exists
  @import "@green-goods/shared/styles/utilities.css"; ← NEW import
  /* client-specific: view-transitions, landing-hover, modal animations */
```

---

## Part 5: Implementation Plan — Engine Split

### Batch 1 (parallel — different files)

#### Codex Task 1: Wire TopContextBar + simplify NavigationBar
**Files**: `CockpitLayout.tsx`, `NavigationBar.tsx`
**Prompt goal**: Wire shared TopContextBar into CockpitLayout above `<main>`. Pass gardenChipNode, onOpenSearch, onOpenSettings, and a placeholder userAvatar div. Remove the mobile floating controls (lines 148-159). Remove NavigationBar `leading` and `trailing` props — make it pure navigation only. Remove leading/trailing divs from NavigationBar render. Update NavigationBarProps type.
**Validation**: `tsc --noEmit` in worktree.

#### Codex Task 2: Create UserAvatar + ConnectShell
**Files**: NEW `UserAvatar.tsx`, NEW `ConnectShell.tsx` in `packages/admin/src/components/Layout/`
**UserAvatar**: Compact 40px circle button showing role initial (D/O/U from `useRole()`). Tap calls `onOpenSettings()`. Uses `cn` utility. Colors: `bg-primary-alpha-10 text-primary-dark`. Focus ring: `focus-visible:ring-2 ring-primary-base`.
**ConnectShell**: Full-screen centered layout for disconnected state. Green Goods seedling icon, "Connect your wallet to continue" heading, render `<appkit-button />` web component. No nav, no TopContextBar.
**Validation**: `tsc --noEmit` in worktree.

#### Claude Task 1: Create shared/src/styles/utilities.css
**Files**: NEW `packages/shared/src/styles/utilities.css`
**Action**: Create file containing promoted utilities from client:
- `.btn-icon` + `.btn-icon svg` + `::after` (client utilities.css:82-102)
- `.badge-pill` + 7 color variants (client utilities.css:122-160)
- `.cv-auto` through `.cv-member` (client utilities.css:234-266)
- `.h-modal`, `.max-h-modal` (client utilities.css:283-294)
- `.tap-feedback` + `:active` (client animation.css:143-153)
- `.tap-target-lg` + `::after` (client utilities.css:104-115)
- `.native-scroll` (client utilities.css:273-276)

Do NOT include popover styles in this task (Task 2 handles dedup).

#### Claude Task 2: Deduplicate popover + shimmer
**Files**: `shared/src/styles/utilities.css` (append), `client/src/styles/utilities.css`, `client/src/styles/animation.css`, `admin/src/index.css`
**Action**: 
- Move canonical `[popover]` suite into shared `utilities.css` (use client version — it uses `var(--shadow-tooltip)` which is cleaner than admin's hardcoded shadow)
- Move canonical `shimmer` keyframe + `.skeleton` + `.skeleton::after` into shared `utilities.css` (use client version — px-based `-1000px to 1000px` is more predictable)
- Remove popover block from client `utilities.css:168-225`
- Remove popover block from admin `index.css:508-568`
- Remove shimmer keyframe from client `animation.css:45-72`
- Remove shimmer keyframe from admin `index.css:262-269`
- Update admin `.skeleton-shimmer` to reference shared `.skeleton` pattern or keep as thin alias

#### Claude Task 3: Client CSS cleanup + shared import
**Files**: `client/src/index.css`, `client/src/styles/utilities.css`, `client/src/styles/animation.css`
**Action**:
- Add `@import "@green-goods/shared/styles/utilities.css";` to client `index.css`
- Remove from `utilities.css`: btn-icon (82-102), badge-pill-* (122-160), cv-* (234-266), h-modal (283-294), tap-target-lg (104-115), native-scroll (273-276)
- Remove from `animation.css`: tap-feedback (143-153)
- Keep client-specific: image-lut, shadow utilities, rounded-10/20, modal-open

### Merge Codex first

Codex tasks change component structure. Claude CSS tasks reference files but don't import components, so merge order is:
1. Codex Task 1 (shell wiring)
2. Codex Task 2 (new components)
3. Claude Tasks 1+2+3 (CSS)

### Batch 2 (parallel — after Batch 1 merge)

#### Codex Task 3: Delete legacy files + update barrel exports
**Files**: Multiple deletions + `components/Layout/index.ts`
**Delete**: `DashboardLayout.tsx`, `Header.tsx`, `Sidebar.tsx`, `Breadcrumbs.tsx`, `UserProfile.tsx`
**Update barrel** `components/Layout/index.ts`:
```typescript
export { CockpitLayout } from "./CockpitLayout";
export { CockpitWorkspaceSelectionState } from "./CockpitWorkspaceSelectionState";
export { CommandPalette } from "./CommandPalette";
export { ConnectShell } from "./ConnectShell";
export { PageHeader } from "./PageHeader";
export { SettingsSheet } from "./SettingsSheet";
export { UserAvatar } from "./UserAvatar";
export { UserMenu } from "./UserMenu";
```
Also remove FloatingToolbar from shared Cockpit barrel (keep the file for now, just unexport).
**Validation**: `tsc --noEmit` — verify no remaining imports of deleted files.

#### Codex Task 4: Update DESIGN_SYSTEM.md + AGENTS.md
**Files**: `packages/admin/DESIGN_SYSTEM.md`, `packages/admin/AGENTS.md`
**Action**: Reflect new shell reality:
- Shell contract: TopContextBar (z-40) → workspace canvas → NavigationBar (z-30, pure nav)
- Remove FloatingToolbar from preferred primitives, add UserAvatar, ConnectShell
- Update ownership model: shared owns TopContextBar, NavigationBar, GardenChip, SideSheet, BottomSheet; admin owns CockpitLayout, SettingsSheet, UserAvatar, ConnectShell, CommandPalette
- Add surface primitive reference: `.surface-section`, `.surface-inset`, `.surface-card`, `.workspace-canvas`
- Note NavigationBar no longer has leading/trailing

#### Claude Task 4: Define surface primitives in admin/index.css
**Files**: `admin/src/index.css`
**Action**: Add to `@layer utilities` block:
```css
.surface-section {
  @apply rounded-xl border border-stroke-soft bg-bg-white shadow-sm;
  @apply p-4 sm:p-5;
}
.surface-inset {
  @apply rounded-lg border border-stroke-soft bg-bg-white shadow-sm;
  @apply p-4;
}
.surface-card {
  @apply rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm;
  @apply transition-shadow duration-200 hover:shadow-md;
}
```
Also add `@import "@green-goods/shared/styles/utilities.css";` to admin index.css.

#### Claude Task 5: Add workspace-canvas dot-grid
**Files**: `admin/src/index.css`, `CockpitLayout.tsx`
**Action**: 
- Add `.workspace-canvas` CSS (from Part 4 above) to admin `index.css`
- In CockpitLayout: add `workspace-canvas` class to `<main>` element (line 165)

#### Claude Task 6: Migrate views to surface classes
**Files**: 10 view files (see list below)
**Action**: Replace raw `rounded-{lg,xl} border border-stroke-soft bg-bg-white p-{4,6} shadow-sm` with appropriate surface class:
- Top-level sections → `.surface-section`
- Nested panels → `.surface-inset`
- Interactive tiles → `.surface-card`
- Also replace inline badge styles (e.g. `rounded-full bg-warning-lighter px-2 py-0.5 text-xs font-semibold text-warning-dark shadow-sm ring-1 ring-warning-light/50`) with `badge-pill-amber` etc.

Target files:
1. `views/Gardens/Garden/HypercertDetail.tsx` — 8 sections → `.surface-inset`
2. `views/Endowments/index.tsx` — 2 sections → `.surface-section`
3. `views/Endowments/ProtocolYieldSummary.tsx` — 1 section → `.surface-section`
4. `views/Endowments/MyPositionsSection.tsx` — 1 section → `.surface-section`
5. `views/Dashboard/index.tsx` — 1 card → `.surface-card`
6. `views/Gardens/Garden/Strategies.tsx` — 2 items → `.surface-inset`
7. `views/Gardens/Garden/Vault.tsx` — 4 items → `.surface-inset`
8. `views/Gardens/Garden/SignalPool.tsx` — 4 items → `.surface-inset`
9. `views/Gardens/Garden/Hypercerts.tsx` — 2 items → mix of `.surface-section` and `.surface-inset`
10. `views/Gardens/index.tsx` — badge inline styles → `badge-pill-*`

#### Claude Task 7: PageHeader backdrop-blur refinement
**Files**: `components/Layout/PageHeader.tsx`
**Action**: Update sticky styling (line 47-48):
```typescript
// Before
"sticky top-0 z-30 bg-bg-white/95 supports-[backdrop-filter]:bg-bg-white/70 backdrop-blur"
// After
"sticky top-0 z-30 bg-bg-white/90 supports-[backdrop-filter]:bg-bg-white/60 backdrop-blur-lg shadow-elevation-1"
```

---

## Part 6: TDD Specs — Red Before Green

### Test: CockpitLayout shell regions

**File**: `packages/admin/src/__tests__/components/CockpitLayout.test.tsx`

```typescript
// RED — write these assertions first, they fail until shell wiring is done

describe("CockpitLayout", () => {
  it("renders TopContextBar with GardenChip in left region", () => {
    // Expect: a <header> with sticky top-0 z-40 containing GardenChip
    // Fail reason: TopContextBar not yet wired into CockpitLayout
  });

  it("renders TopContextBar settings icon that opens SettingsSheet", () => {
    // Expect: click settings icon → SettingsSheet becomes visible
    // Fail reason: settings icon is in UserMenu dropdown, not TopContextBar
  });

  it("renders NavigationBar without leading/trailing slots", () => {
    // Expect: NavigationBar has no GardenChip or UserMenu children
    // Fail reason: CockpitLayout passes leading={gardenChipNode} trailing={<UserMenu>}
  });

  it("renders main workspace with workspace-canvas class", () => {
    // Expect: <main> has className containing "workspace-canvas"
    // Fail reason: <main> only has overflow-y-auto and padding classes
  });

  it("does not render mobile floating controls", () => {
    // Expect: no fixed top-3 left-3 z-30 element
    // Fail reason: lines 148-159 render orphaned floating controls
  });
});
```

### Test: UserAvatar click behavior

**File**: `packages/admin/src/__tests__/components/UserAvatar.test.tsx`

```typescript
describe("UserAvatar", () => {
  it("renders circle button with role initial letter", () => {
    // Expect: button with "D" for deployer, "O" for operator, "U" for user
  });

  it("calls onOpenSettings on click", () => {
    // Expect: onClick handler fires
  });

  it("has accessible name including role", () => {
    // Expect: aria-label contains role
  });

  it("has focus-visible ring", () => {
    // Expect: focus-visible:ring-2 in className
  });
});
```

### Test: ConnectShell rendering

**File**: `packages/admin/src/__tests__/components/ConnectShell.test.tsx`

```typescript
describe("ConnectShell", () => {
  it("renders when user is not authenticated", () => {
    // Expect: ConnectShell visible when useAuth().isAuthenticated is false
  });

  it("shows connect wallet prompt", () => {
    // Expect: heading text "Connect your wallet to continue"
  });

  it("does not render NavigationBar or TopContextBar", () => {
    // Expect: no nav element, no sticky header
  });

  it("renders appkit-button web component", () => {
    // Expect: <appkit-button> element in DOM
  });
});
```

### Test: Surface class adoption

**File**: `packages/admin/src/__tests__/views/surface-classes.test.tsx`

```typescript
describe("surface class adoption", () => {
  it("HypercertDetail sections use surface-inset class", () => {
    // Grep HypercertDetail.tsx for "surface-inset" — expect 8+ matches
    // Grep HypercertDetail.tsx for raw "rounded-lg border border-stroke-soft bg-bg-white" — expect 0
  });

  it("Endowments sections use surface-section class", () => {
    // Grep Endowments/index.tsx for "surface-section" — expect 2+ matches
  });

  it("Dashboard cards use surface-card class", () => {
    // Grep Dashboard/index.tsx for "surface-card" — expect 1+ match
  });
});
```

### Test: Shared utilities exist

**File**: `packages/shared/src/__tests__/styles/utilities.test.ts`

```typescript
describe("shared utilities.css", () => {
  it("exports btn-icon class", () => {
    // Read utilities.css, assert contains ".btn-icon"
  });

  it("exports all 8 badge-pill variants", () => {
    // Assert: badge-pill, badge-pill-blue, -amber, -green, -red, -purple, -slate, -emerald
  });

  it("exports popover styles (not duplicated in client or admin)", () => {
    // Assert: shared utilities.css contains "[popover]"
    // Assert: client utilities.css does NOT contain "[popover]"
    // Assert: admin index.css does NOT contain "[popover]" in utilities layer
  });

  it("exports shimmer and skeleton", () => {
    // Assert: shared has @keyframes shimmer and .skeleton
  });
});
```

---

## Part 7: Acceptance Criteria

### Shell Structure
- [ ] TopContextBar renders as the top region of CockpitLayout (sticky, z-40, h-14)
- [ ] GardenChip appears in TopContextBar left side (not NavigationBar)
- [ ] UserAvatar appears in TopContextBar right side (compact circle, role initial)
- [ ] Settings icon in TopContextBar opens SettingsSheet
- [ ] Search icon in TopContextBar opens CommandPalette (desktop only)
- [ ] NavigationBar is pure navigation — no leading/trailing slots
- [ ] Mobile: TopContextBar replaces the ad-hoc floating controls
- [ ] Mobile: no orphaned fixed-position buttons at top of screen
- [ ] ConnectShell renders for unauthenticated users — clean connect prompt
- [ ] ConnectShell has no NavigationBar or TopContextBar

### Styling System
- [ ] `shared/src/styles/utilities.css` exists with promoted utilities
- [ ] Client `index.css` imports `@green-goods/shared/styles/utilities.css`
- [ ] Admin `index.css` imports `@green-goods/shared/styles/utilities.css`
- [ ] Popover styles exist ONLY in shared (not duplicated in client or admin)
- [ ] Shimmer/skeleton styles exist ONLY in shared (not duplicated)
- [ ] `.surface-section`, `.surface-inset`, `.surface-card` defined in admin `index.css`
- [ ] `.workspace-canvas` defined in admin `index.css` with dot-grid background

### View Migration
- [ ] HypercertDetail: all 8 raw surface recipes replaced with `.surface-inset`
- [ ] Endowments: raw recipes replaced with `.surface-section`
- [ ] Dashboard: raw card recipe replaced with `.surface-card`
- [ ] Strategies, Vault, SignalPool: raw recipes replaced with `.surface-inset`
- [ ] Gardens index: inline badge styles replaced with `badge-pill-*`
- [ ] No remaining `rounded-xl border border-stroke-soft bg-bg-white p-4 shadow-sm` in migrated views

### Legacy Cleanup
- [ ] `DashboardLayout.tsx` deleted
- [ ] `Header.tsx` deleted
- [ ] `Sidebar.tsx` deleted
- [ ] `Breadcrumbs.tsx` deleted
- [ ] `UserProfile.tsx` deleted
- [ ] `FloatingToolbar` unexported from shared Cockpit barrel
- [ ] Layout barrel `index.ts` updated with new exports (UserAvatar, ConnectShell)

### Design Quality
- [ ] PageHeader sticky: backdrop-blur-lg + shadow-elevation-1
- [ ] Workspace canvas dot-grid visible in light mode, subtle in dark mode
- [ ] Dot-grid disabled under `prefers-reduced-motion: reduce`
- [ ] All promoted utilities use semantic tokens (no raw Tailwind colors)
- [ ] Dark mode: all surface classes render correctly
- [ ] Admin tone: calmer and more operational than client (no decorative animations)

### Documentation
- [ ] DESIGN_SYSTEM.md reflects: TopContextBar → workspace canvas → NavigationBar (pure nav)
- [ ] AGENTS.md preferred primitives updated (remove FloatingToolbar, add UserAvatar, ConnectShell)
- [ ] Surface primitive reference in DESIGN_SYSTEM.md

---

## Part 8: Validation Checklist

### Per-task validation (during development)
```bash
# Codex worktrees
tsc --noEmit                           # Type check without env vars

# Claude tasks  
bun run test && bun build              # Full test + build
```

### Final gate (after all merges)
```bash
bun format && bun lint && bun run test && bun build
```

### Manual verification
- [ ] Open admin in browser — TopContextBar visible at top
- [ ] Click UserAvatar → SettingsSheet opens
- [ ] Click Settings icon → SettingsSheet opens
- [ ] Click Search icon (desktop) → CommandPalette opens
- [ ] NavigationBar shows only nav items (no GardenChip, no UserMenu)
- [ ] Resize to mobile — TopContextBar adapts, no orphaned floating buttons
- [ ] Switch to dark mode — workspace canvas dot-grid is subtle
- [ ] Visit HypercertDetail — sections use uniform surface styling
- [ ] Disconnect wallet — ConnectShell appears instead of cockpit

---

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| W3-1 | TopContextBar wired into CockpitLayout above `<main>` | Reconciles documented shell contract with live code. TopContextBar already exists in shared — just unused. |
| W3-2 | NavigationBar loses leading/trailing | Navigation bar should be pure navigation. Identity/context belongs at top (TopContextBar), not stuffed into nav. Simplifies the component API. |
| W3-3 | UserAvatar is admin-local, not shared | Only admin needs the role-initial circle pattern. Client uses different identity UI. |
| W3-4 | ConnectShell replaces auth redirect for shell | Current disconnected state shows nothing useful. A deliberate connect surface is clearer than an empty shell or redirect loop. |
| W3-5 | Client shimmer wins over admin shimmer | Client's `-1000px to 1000px` (px-based) is more predictable across container sizes than admin's `200% to -200%` (percentage-based). |
| W3-6 | Client popover wins over admin popover | Uses `var(--shadow-tooltip)` token instead of hardcoded rgba — more themeable. |
| W3-7 | Surface classes defined in admin, not shared | Surface primitives compose admin-specific elevation tokens. Client has different surface treatments. If shared later, promote then. |
| W3-8 | Workspace canvas uses radial dot-grid | Evokes physical workspace without being decorative. 24px spacing, 0.4 alpha in light, 0.15 in dark. Respects reduced-motion. |
| W3-9 | Delete legacy files, don't deprecate | DashboardLayout/Header/Sidebar have zero route consumers. Keeping dead code creates confusion about which shell is canonical. |
| W3-10 | FloatingToolbar unexported but file kept | Other branches or tests may reference the file. Remove the barrel export to prevent new usage. Full deletion in a cleanup sweep later. |
| W3-11 | PageHeader gets shadow-elevation-1 when sticky | Subtle depth cue when content scrolls under the header. Uses the M3 elevation system already defined in admin. |
