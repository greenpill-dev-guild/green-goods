# Design System Enforcement Plan

**Feature Slug**: `design-system-enforcement`
**Status**: `ACTIVE`
**Created**: `2026-04-08`
**Last Updated**: `2026-04-17` (Step 6 tablet layout already in place; typography migration applied safe body-*/subheading-xs mappings across 5 files — label-sm/label-md mappings deferred as admin token overrides would shrink text; spacing rhythm applied to Vault.tsx; Hub/index.tsx already clean. **Plan hygiene refresh 2026-04-17**: added 3 Requirements Coverage rows for post-plan DS growth — admin M3 token cascade, `Admin*` component family, dialog primitive policy. Corrected Surface consumer list.)
**Branch**: `feature/admin-ui-revamp` (shared with admin-ui-revamp — orthogonal concerns, same branch)

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | One `Surface` component replaces CardBase + SurfaceCard + `.surface-*` CSS | 4 ways to make a box is 3 too many. Semantic variants enforce visual hierarchy through distinct backgrounds, shadows, and optional blur. CardBase/SurfaceCard preserved as re-exports for backward compat during migration. |
| 2 | Z-index uses named CSS custom properties mapped to `@theme` tokens | `z-[9999]` is a symptom of no system. Named tokens (`--z-nav: 30`, `--z-modal: 50`) are self-documenting. Tailwind `@theme` integration means `z-nav`, `z-modal` work as classes. |
| 3 | Glass tokens are opt-in CSS classes, not mandatory on all surfaces | Full glass on every surface tanks readability. Apply selectively: nav (already has it), sticky headers, overlay backdrops. Solid remains the default material. `prefers-reduced-motion` and `prefers-contrast: more` force solid fallback. |
| 4 | `ModalDialog` wraps Radix Dialog.Root + Portal + Overlay + Content with opinionated defaults | 13 modals copy-paste identical overlay/content/animation classes. One wrapper with `size` and `position` variants eliminates drift. Each modal becomes ~15 lines: `<ModalDialog title="X"><form>...</form></ModalDialog>`. |
| 5 | Garden detail rail becomes horizontal summary strip at md breakpoint (768px-1023px) | Rail below fold on tablets means alerts/metrics invisible. A horizontal strip (2-3 stat boxes) above main content keeps key data visible without committing to a full sidebar. At lg+ (1024px), revert to current 9fr/3fr grid. |
| 6 | Typography and spacing applied to high-visibility views, not full sweep | Touching 53 files for `text-sm font-medium` → `label-sm` creates massive diff noise with high conflict risk. New code follows the pattern. Existing code migrated in garden tabs, hub, and vault — the 3 most-visited views. |
| 7 | Surface variants map to elevation scale, not blur levels | Design docs describe 5 material layers (ultrathin→solid) based on blur. But blur-based hierarchy requires careful readability testing and `prefers-contrast` fallbacks. Elevation-based hierarchy (background tint + shadow depth) is immediately usable, accessible by default, and aligns with M3. Glass blur is an enhancement on specific surfaces, not the hierarchy driver. |
| 8 | Retire `.canvas-route-shell` + warm-glass atmospheric pseudo-elements from `.workspace-canvas`; keep workspace tint CSS vars (D1 resolution, 2026-04-17) | Admin ran two competing visual systems: warm-glass gradients (`.canvas-route-shell` content wrappers, `.workspace-canvas::before/::after` radial-gradient + noise backdrop + `canvas-atmosphere-drift` animation) vs strict M3 solid surfaces. Per `feedback_m3_strict_over_hybrid.md`, user prefers strict M3 below the TopContextBar glass. Path A retires warm-glass: `.canvas-route-shell` deleted (5 consumers migrated to `<Surface elevation="solid-raised">`); `.workspace-canvas` reduced to data-workspace attribute selectors that set `--workspace-tint/-tint-2/-accent` vars (still consumed by NavigationBar, UserAvatar, PageHeader, AccountProfilePanel, AccountSettingsPanel, WorkbenchRow — workspace color identity preserved via component accents, not backdrop atmosphere). Dead sheet-animation CSS overrides removed (sheets now use react-spring, not CSS). |

## Requirements Coverage

| Requirement | Planned Step | Status |
|-------------|-------------|--------|
| Unified surface component | Step 2 | ✅ (already built at `packages/shared/src/components/Surface/Surface.tsx` with full elevation/padding/radius/interactive variant system mapping to glass-ground/raised/floating/overlay plus solid variants. Consumed by 8 admin files (AccountProfilePanel, AccountSettingsPanel, Garden/index.tsx, HubCertificationInspector, HubHistoryInspector, Actions/ActionDetail, Actions/EditAction, Actions/GreenWillPanel) and 2 shared files (EmptyStateShell, FormWizard). `CardBase` and `SurfaceCard` still exist as separate components — deprecation re-exports skipped per decision 3B since no consumer migration is pressing.) |
| Z-index scale tokens | Step 1 | ✅ (`--z-base/raised/sticky/nav/overlay/modal/toast` at theme.css:413–419 with `--z-index-*` Tailwind aliases at 1186–1192) |
| Z-index applied to all components | Step 4 | 🟡 (13 files swept: 7 admin+Canvas — AppBar tooltip, GardenChip dropdown, AdminDialog, CommandPalette, UserMenu, AdminTooltip, Hub FAB; 6 shared primitives — DateRangePicker, DatePicker, FormWizard, StepIndicator, ImagePreviewDialog header gradient (z-raised), ImagePreviewDialog body layer stays high. **Reverted for client safety 2026-04-17:** SyncStatusBar (z-50), Select (z-50), WorkCard preview (z-[70]), ImagePreviewDialog overlay/content (z-[10002]/[10003]) — these shared components are consumed by client, whose modal stack still uses arbitrary `z-[1000]`/`z-[10001]`/`z-[20000]`; migrating shared to the token scale would drop them below client modals and TopNav. Deferred until Phase 3 sweeps client's z values too.) |
| Glass material tokens | Step 1 | ✅ (`--glass-blur/bg/ring`, dark overrides, `--glass-overlay-bg` at theme.css:425–428, 620–621; `.glass-surface` utility at admin/index.css:1111–1125) |
| Glass applied to PageHeader, SideSheet, TopContextBar | Step 5 | ✅ (Sheets use `glass-floating` ×3, NavigationBar uses `glass-ground`, MainSheet uses `glass-surface`, GardenChip dropdowns use `glass-raised`/`glass-floating`. PageHeader sticky variant now applies glass backdrop-blur + ring (admin PageHeader.tsx). AppBar stays `bg-transparent` intentionally — canvas backdrop shows through.) |
| ModalDialog wrapper | Step 3 | ✅ (`DialogShell` in shared serves this role; `preventClose` prop added for loading lock) |
| Modal migration (13 files) | Steps 7, 8, 9 | 9/13 ✅ Garden (AddMember, ManageRoles, Members, GardenDomainEditor), Vault (PositionCard, Deposit, Withdraw), Hypercerts (CreateListing, Minting). CookieJar×3 stay on AdminDialog (M3-strict). ConfirmDialog already is the shared primitive. |
| Garden detail tablet layout | Step 6 | ✅ (media (768-1023px) rule at index.css:749–777) |
| Spacing rhythm utilities | Step 1 | ✅ (`gap-section`/`gap-content` at index.css:1137–1152) |
| Spacing applied to hub + vault | Step 12 | ✅ (Vault.tsx `contentClassName` now uses `flex flex-col gap-section`; Hub/index.tsx had no space-y to migrate) |
| Typography in garden tabs | Step 10 | ✅ (body-*/subheading-xs applied across OverviewTab, ImpactTab, WorkTab, CommunityTab. Label-* rows dropped 2026-04-17 per decision 1A — admin's M3 small-label overrides shrink the shared label scale, so raw `text-sm font-medium`/`text-lg font-semibold` stay on admin stat rows and headers.) |
| Typography in hub + vault | Step 11 | ✅ (Vault.tsx body-sm/body-xs applied. Hub/index.tsx delegates all typography to child components — no raw text-* patterns in the orchestration file.) |
| CardBase/SurfaceCard backward compat | Step 2 | n/a — dropped per decision 3B (2026-04-17). Existing CardBase/SurfaceCard consumers stay as-is; Surface lives alongside them. |
| prefers-contrast solid fallback | Step 1 | 🟡 (glass-* utility definitions exist; `@media (prefers-contrast: more)` fallback still to verify in utilities.css) |
| **Admin M3 token cascade** (added 2026-04-17) | post-plan | ✅ `packages/admin/src/styles/admin-m3-tokens.css` (140 LOC — M3 surface/state/shape/elevation foundation on top of `theme.css`) + `admin-m3-overrides.css` (184 LOC — CSS overrides for shared NavBar, sheets, toast, date picker). Landed 2026-04-13 via commits `8ae1f4df`, `3593a849`, `b3365978` during admin M3 compliance work (orthogonal to this plan, now recognized as the canonical admin token layer). |
| **Admin\* M3 component family** (added 2026-04-17) | post-plan | ✅ 13 adapter components in `packages/admin/src/components/Admin*.tsx`: AdminBadge, AdminButton, AdminCard (7 view consumers — HubWorkCard, CommunityTab, ImpactTab, OverviewTab, CookieJarManageModal, GardenDetailHelpers, ActionDetail), AdminCheckbox, AdminDialog (3 CookieJar consumers), AdminFab, AdminFilterChip, AdminLinearProgress, AdminListItem, AdminSearchToolbar, AdminTabRail, AdminTextField, AdminTooltip. Strict M3 v0.192 anatomy, same data contracts as shared primitives. Storybook coverage pending. |
| **Dialog primitive policy** (added 2026-04-17) | post-plan | ✅ Two primitives coexist by design: `DialogShell` (shared, flexible, **default**) consumed by 9 admin modals + 2 client dialogs; `ConfirmDialog` shares the DialogShell file. `AdminDialog` (admin, strict M3) reserved for CookieJar×3 (deposit/withdraw/manage) where the M3 `actions` slot + elevation-3 + centered layout are explicit design requirements. New admin modals default to DialogShell. |

## CLAUDE.md Compliance

- [x] All components in `@green-goods/shared`
- [ ] i18n — no user-facing strings in this plan (component structure only)
- [x] Barrel imports from `@green-goods/shared`
- [x] No contract/indexer changes

## Impact Analysis

### Files to Create
- `packages/shared/src/components/Surface/Surface.tsx` — unified surface component
- `packages/shared/src/components/Surface/index.ts` — barrel
- `packages/shared/src/components/Dialog/ModalDialog.tsx` — modal wrapper

### Files to Modify (Tokens)
- `packages/shared/src/styles/theme.css` — glass + z-index custom properties
- `packages/admin/src/index.css` — `@theme` z-index tokens, spacing rhythm, glass utilities, garden detail md breakpoint
- `packages/admin/src/styles/admin-m3-tokens.css` — **post-plan (2026-04-13)**: M3 surface/state/shape/elevation foundation (140 LOC)
- `packages/admin/src/styles/admin-m3-overrides.css` — **post-plan (2026-04-13)**: CSS overrides for shared NavBar/sheets/toast/date picker (184 LOC)

### Files to Modify (Z-Index)
- `packages/shared/src/components/Cockpit/NavigationBar.tsx` — z-30 → z-nav
- `packages/shared/src/components/Cockpit/SideSheet.tsx` — z-50 → z-overlay
- `packages/shared/src/components/Cockpit/BottomSheet.tsx` — z-50 → z-overlay
- `packages/shared/src/components/Layout/PageHeader.tsx` — z-30 → z-sticky
- `packages/admin/src/components/Layout/CanvasLayout.tsx` — z-[9999] → z-toast (skip-link), z-40 → z-sticky (TopContextBar ref)
- `packages/admin/src/components/Vault/PositionCard.tsx` — z-[9999]/z-[10000] → z-overlay/z-modal
- `packages/admin/src/components/Vault/DepositModal.tsx` — z-[9999]/z-[10000] → z-overlay/z-modal
- `packages/admin/src/components/Vault/WithdrawModal.tsx` — z-[9999]/z-[10000] → z-overlay/z-modal
- `packages/admin/src/components/Garden/AddMemberModal.tsx` — z-60 → z-modal
- `packages/client/src/components/Navigation/LandingHeader.tsx` — z-[9999] → z-toast
- `packages/client/src/components/Navigation/TopNav.tsx` — z-[9999] → z-toast

### Files to Modify (Glass)
- `packages/shared/src/components/Cockpit/SideSheet.tsx` — glass overlay treatment
- `packages/shared/src/components/Layout/PageHeader.tsx` — consistent glass when sticky
- `packages/admin/src/components/Layout/CanvasLayout.tsx` — TopContextBar glass ref

### Files to Modify (Modal Migration)
- `packages/admin/src/components/Garden/AddMemberModal.tsx`
- `packages/admin/src/components/Garden/ManageRolesModal.tsx`
- `packages/admin/src/components/Garden/MembersModal.tsx`
- `packages/admin/src/components/Garden/GardenDomainEditor.tsx`
- `packages/admin/src/components/Vault/PositionCard.tsx`
- `packages/admin/src/components/Vault/DepositModal.tsx`
- `packages/admin/src/components/Vault/WithdrawModal.tsx`
- `packages/admin/src/components/Work/CookieJarDepositModal.tsx`
- `packages/admin/src/components/Work/CookieJarWithdrawModal.tsx`
- `packages/admin/src/components/Work/CookieJarManageModal.tsx`
- `packages/admin/src/components/Hypercerts/CreateListingDialog.tsx`
- `packages/admin/src/components/Hypercerts/MintingDialog.tsx`
- `packages/shared/src/components/Dialog/ConfirmDialog.tsx`

### Files to Modify (Typography + Spacing)
- `packages/admin/src/views/Gardens/Garden/OverviewTab.tsx`
- `packages/admin/src/views/Gardens/Garden/ImpactTab.tsx`
- `packages/admin/src/views/Gardens/Garden/WorkTab.tsx`
- `packages/admin/src/views/Gardens/Garden/CommunityTab.tsx`
- `packages/admin/src/views/Work/index.tsx`
- `packages/admin/src/views/Gardens/Garden/Vault.tsx`

## Test Strategy

- **Unit tests**: Surface component variants render correct classes; ModalDialog renders overlay + content; z-index tokens resolve correctly
- **Visual regression**: Storybook stories for Surface (all variants), ModalDialog (sizes), glass effects
- **Integration**: Existing admin views render without regression after Card → Surface migration
- **Accessibility**: `prefers-contrast: more` forces solid surfaces; `prefers-reduced-motion` disables glass transitions; focus trap preserved in ModalDialog

## Implementation Steps

### Step 1: Foundation Tokens
**Files**: `packages/shared/src/styles/theme.css`, `packages/admin/src/index.css`
**Details**: Add CSS custom properties and Tailwind @theme tokens for:

Z-index scale:
```css
/* theme.css :root */
--z-base: 0;
--z-raised: 10;
--z-sticky: 20;
--z-nav: 30;
--z-overlay: 40;
--z-modal: 50;
--z-toast: 60;

/* admin index.css @theme */
--z-index-base: var(--z-base);
--z-index-raised: var(--z-raised);
--z-index-sticky: var(--z-sticky);
--z-index-nav: var(--z-nav);
--z-index-overlay: var(--z-overlay);
--z-index-modal: var(--z-modal);
--z-index-toast: var(--z-toast);
```

Glass tokens:
```css
/* theme.css :root */
--glass-blur: 16px;
--glass-bg-light: rgba(255, 255, 255, 0.8);
--glass-bg-dark: rgba(23, 23, 23, 0.8);
--glass-ring: rgba(0, 0, 0, 0.04);
--glass-ring-dark: rgba(255, 255, 255, 0.06);
```

Spacing rhythm utilities:
```css
/* admin index.css @layer utilities */
.gap-section { gap: 1rem; }
.gap-content { gap: 0.75rem; }
@media (min-width: 640px) { .gap-section { gap: 1.25rem; } .gap-content { gap: 1rem; } }
@media (min-width: 1024px) { .gap-section { gap: 1.5rem; } .gap-content { gap: 1.25rem; } }
```

Glass utility classes:
```css
.glass-surface {
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  background: var(--glass-bg-light);
  ring: 1px solid var(--glass-ring);
}
[data-theme="dark"] .glass-surface { background: var(--glass-bg-dark); ring-color: var(--glass-ring-dark); }
@media (prefers-contrast: more) { .glass-surface { backdrop-filter: none; background: var(--color-bg-white); } }
```

**Verify**: CSS builds without errors, tokens accessible in Tailwind classes.

### Step 2: Surface Component

> **Status (2026-04-17):** Already built at `packages/shared/src/components/Surface/Surface.tsx` with glass tiers (ground/raised/floating/overlay) + solid equivalents, padding/radius/interactive/colorAccent variants, `Surface.Header`/`Body`/`Footer` compound pattern, polymorphic `as` prop. Exported from shared barrel, consumed by AccountProfilePanel, AccountSettingsPanel, Garden/index. **Not done in this plan's execution — it was implemented in an earlier pass and the plan hadn't been updated.** Per decision 3B (2026-04-17), the "CardBase/SurfaceCard backward-compat re-export" sub-goal is also dropped: consumers who still use CardBase are fine as-is; a targeted `.surface-*` CSS retirement can happen separately.

**Files**: `packages/shared/src/components/Surface/Surface.tsx`, `packages/shared/src/components/Surface/index.ts`, `packages/shared/src/components/Cards/CardBase.tsx` (add deprecation re-export), `packages/shared/src/index.ts` (barrel export)
**Details**:

Create `Surface` component using `tailwind-variants` (consistent with existing CardBase pattern):

```typescript
const surfaceVariants = tv({
  base: "rounded-xl border",
  variants: {
    elevation: {
      ground: "border-stroke-soft bg-bg-weak shadow-elevation-0",       // substrate — blends with canvas
      raised: "border-stroke-soft bg-bg-white shadow-elevation-1",      // default card — distinct from ground
      floating: "border-stroke-soft bg-bg-white shadow-elevation-3",    // popovers, dropdown panels
      overlay: "border-0 bg-bg-white shadow-elevation-5",               // sheets, full overlays
    },
    padding: {
      none: "",
      compact: "p-3",
      default: "p-4 sm:p-5",
      spacious: "p-6 sm:p-8",
    },
    radius: {
      md: "rounded-lg",
      lg: "rounded-xl",
      xl: "rounded-2xl",
    },
    interactive: {
      true: "cursor-pointer transition-[border-color,box-shadow,transform] duration-200 hover:shadow-elevation-2 hover:-translate-y-px active:translate-y-0",
      false: "",
    },
  },
  defaultVariants: {
    elevation: "raised",
    padding: "none",
    radius: "lg",
    interactive: false,
  },
});
```

Compound pattern with `Surface.Header`, `Surface.Body`, `Surface.Footer` (mirrors current Card compound).

Backward compat: `CardBase` and `Card` re-export from Surface with console.warn in dev only.

**Verify**: `bun build` succeeds, no type errors. Storybook stories render all variant combinations.

### Step 3: ModalDialog Wrapper
**Files**: `packages/shared/src/components/Dialog/ModalDialog.tsx`, `packages/shared/src/index.ts`
**Details**:

Wraps `@radix-ui/react-dialog` (Root + Portal + Overlay + Content) with:
- Consistent overlay: `fixed inset-0 z-overlay bg-overlay backdrop-blur-sm` + open/close animation
- Consistent content: `fixed z-modal bg-bg-white shadow-elevation-5` + slide/fade animation
- Spring easing: `cubic-bezier(0.16, 1, 0.3, 1)` (matches existing SideSheet)
- Props: `open`, `onClose`, `title`, `description?`, `size` (sm: 400px, md: 520px, lg: 640px, full: 100vw), `children`
- Built-in header (Dialog.Title + close button) and scrollable body
- `prefers-reduced-motion` respected (duration-0)
- Focus trap via Radix (already built in)

```typescript
interface ModalDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg" | "full";
  children: React.ReactNode;
}
```

**Verify**: Renders correctly in Storybook (all sizes). Focus trap works. Animation plays. Reduced-motion disables animation.

### Step 4: Z-Index Scale Application
**Files**: 11 files across shared, admin, client (see Impact Analysis)
**Details**:

Replace all arbitrary z-index values with named tokens:

| Current | New | Files |
|---------|-----|-------|
| `z-30` (NavigationBar) | `z-nav` | NavigationBar.tsx |
| `z-40` (TopContextBar) | `z-sticky` | CanvasLayout.tsx |
| `z-30` (PageHeader sticky) | `z-sticky` | PageHeader.tsx |
| `z-50` (SideSheet, BottomSheet) | `z-overlay` | SideSheet.tsx, BottomSheet.tsx |
| `z-60` (AddMemberModal) | `z-modal` | AddMemberModal.tsx |
| `z-[9999]` (skip-links) | `z-toast` | CanvasLayout.tsx, LandingHeader.tsx, TopNav.tsx |
| `z-[9999]` / `z-[10000]` (Vault modals) | `z-overlay` / `z-modal` | PositionCard.tsx, DepositModal.tsx, WithdrawModal.tsx |
| `z-[10000]` (client footer) | `z-modal` | client Garden/index.tsx |
| `z-20` (FAB) | `z-raised` | Work/index.tsx (if FAB still exists) |

**Verify**: `bun build` succeeds. No visual stacking regressions — overlays above nav, modals above overlays, toasts above everything.

### Step 5: Glass Language Extension
**Files**: `PageHeader.tsx`, `SideSheet.tsx`, `CanvasLayout.tsx` (TopContextBar section)
**Details**:

Apply consistent glass treatment to navigation-tier surfaces:

**TopContextBar** (in CanvasLayout or wherever it renders):
- Current: `bg-bg-soft`
- New: `bg-bg-soft/90 supports-[backdrop-filter]:bg-bg-soft/70 backdrop-blur-lg ring-1 ring-black/[0.04] dark:ring-white/[0.06]`
- Matches NavigationBar's existing glass pattern

**PageHeader** (when sticky):
- Current: conditional `bg-bg-white/60 backdrop-blur-lg` only when scrolled
- New: Always use glass when `sticky` prop is true: `bg-bg-white/90 supports-[backdrop-filter]:bg-bg-white/70 backdrop-blur-lg ring-1 ring-black/[0.04]`
- Remove the `shadow-[--shadow-elevation-1]` in favor of the ring border (glass doesn't need shadow — the blur provides depth)

**SideSheet** overlay backdrop:
- Current overlay: `bg-black/40`
- Keep as-is (overlay is already glassmorphic with backdrop-blur-sm)
- Content panel: Add subtle `ring-1 ring-black/[0.04]` to match glass family

**Accessibility**: All glass surfaces have `@media (prefers-contrast: more)` override to fully opaque.

**Verify**: Visual consistency — TopContextBar, PageHeader (sticky), and NavigationBar all share the same glass language. SideSheet has subtle ring. Contrast mode shows fully opaque surfaces.

### Step 6: Garden Detail Tablet Layout
**Files**: `packages/admin/src/index.css`
**Details**:

Add a medium breakpoint (768px-1023px) for `.garden-tab-layout` that shows the rail as a horizontal summary strip above the main content:

```css
@media (min-width: 768px) and (max-width: 1023px) {
  .garden-tab-layout {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  
  .garden-tab-rail {
    order: -1;  /* Rail ABOVE main content on tablet */
  }
  
  .garden-tab-rail-sticky {
    flex-direction: row;
    gap: 1rem;
    overflow-x: auto;
  }
  
  .garden-tab-rail-sticky > * {
    min-width: 240px;
    flex: 1;
  }
}
```

This makes the rail cards (Alerts, Key Metrics, Treasury Status, etc.) display as a horizontal scrollable strip above the main content on tablets. At lg+ (1024px), it reverts to the existing 9fr/3fr sidebar grid.

**Verify**: Test at 768px, 900px, 1024px, 1200px. Rail visible without scrolling main content on tablet. No horizontal overflow on mobile (<768px).

### Step 7: Modal Migration — Garden Modals
**Files**: `AddMemberModal.tsx`, `ManageRolesModal.tsx`, `MembersModal.tsx`, `GardenDomainEditor.tsx`
**Details**:

Replace Radix Dialog boilerplate with `<ModalDialog>` wrapper. Each modal goes from ~40 lines of Dialog setup to ~15.

Before (typical):
```tsx
<Dialog.Root open={isOpen} onOpenChange={...}>
  <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-60 bg-overlay backdrop-blur-sm data-[state=open]:animate-in..." />
    <Dialog.Content className="fixed left-1/2 top-1/2 z-60 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-bg-white rounded-lg shadow-2xl...">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <Dialog.Title>...</Dialog.Title>
        <button onClick={onClose}><RiCloseLine /></button>
      </div>
      <div className="p-4">{content}</div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

After:
```tsx
<ModalDialog open={isOpen} onClose={onClose} title="Add Member" size="md">
  {content}
</ModalDialog>
```

**Verify**: Each modal opens, animates, closes, traps focus. Form submission works. No visual regression.

### Step 8: Modal Migration — Vault Modals
**Files**: `PositionCard.tsx`, `DepositModal.tsx`, `WithdrawModal.tsx`
**Details**: Same pattern as Step 7. These modals also use `z-[9999]`/`z-[10000]` which is resolved by ModalDialog using `z-overlay`/`z-modal` internally.

**Verify**: Deposit/withdraw flows work end-to-end. Position card detail modal opens correctly.

### Step 9: Modal Migration — Work & Hypercert Modals
**Files**: `CookieJarDepositModal.tsx`, `CookieJarWithdrawModal.tsx`, `CookieJarManageModal.tsx`, `CreateListingDialog.tsx`, `MintingDialog.tsx`, `ConfirmDialog.tsx` (shared)
**Details**: Same pattern. Note `ConfirmDialog` is in shared package — update it to use ModalDialog internally.

**Verify**: Cookie jar deposit/withdraw flows. Hypercert minting flow. Confirm dialog renders in all consuming views.

### Step 10: Typography — Garden Detail Tabs

> **Implementation note (2026-04-17):** Admin overrides `--text-label-sm: 11px` and `--text-label-md: 12px` (M3 small-label adaptation, vs theme-scale 14px/16px). Per decision 1A, the `text-sm font-medium → label-sm` and `text-lg font-semibold → label-md` rows are **dropped from this step's mapping**; admin stat values / section headers stay on raw `text-lg font-semibold` so the M3 small-label scale remains usable for its intended role (compact metadata labels) without affecting emphasis typography. Applied mappings (value-equivalent across both scales): `text-xs text-text-soft → body-xs text-text-soft`, `text-sm text-text-sub → body-sm text-text-sub`, `text-sm text-text-soft → body-sm text-text-soft`, `text-xs text-primary-base → body-xs text-primary-base`.

**Files**: `OverviewTab.tsx`, `ImpactTab.tsx`, `WorkTab.tsx`, `CommunityTab.tsx`
**Details**:

Replace raw Tailwind typography with semantic utilities in these high-visibility views:

| Raw Pattern | Semantic Replacement |
|------------|---------------------|
| `text-xs text-text-soft` | `body-xs text-text-soft` |
| `text-sm text-text-sub` | `body-sm text-text-sub` |
| `text-sm font-medium text-text-strong` | `label-sm text-text-strong` |
| `text-lg font-semibold text-text-strong` | `label-md text-text-strong` |
| `text-xs font-medium uppercase text-text-soft` | `subheading-xs text-text-soft` |

Only replace direct typography classes, not spacing or layout. Color classes stay (they're semantic already).

**Verify**: No visual change — utilities produce identical font-size/weight/line-height. Confirm with browser devtools.

### Step 11: Typography — Hub + Vault
**Files**: `packages/admin/src/views/Work/index.tsx`, `packages/admin/src/views/Gardens/Garden/Vault.tsx`
**Details**: Same replacements as Step 10.

**Verify**: No visual change.

### Step 12: Spacing Rhythm — Hub + Vault
**Files**: `packages/admin/src/views/Work/index.tsx`, `packages/admin/src/views/Gardens/Garden/Vault.tsx`
**Details**:

Replace ad-hoc spacing with rhythm utilities:

| Current | Replacement |
|---------|------------|
| `space-y-6` (Vault) | `gap-section` (on flex container) |
| `gap-4` (Hub card grid) | Keep — grid gaps are layout-specific |
| `space-y-3` (list items) | `gap-content` (on flex container) |
| `space-y-2` (stat rows) | Keep — tight spacing within a single card is intentional |

Only replace section-level and content-level gaps, not within-card micro-spacing.

**Verify**: Visual spacing matches or improves. Responsive scaling works (1rem → 1.25rem → 1.5rem).

## Validation

- [ ] `bun format && bun lint`
- [ ] `bun run test`
- [ ] `VITE_CHAIN_ID=11155111 bun run build`
- [ ] Storybook: Surface variants, ModalDialog sizes, glass effects
- [ ] Manual: admin dashboard at 375px (mobile), 768px (tablet), 1024px (desktop), 1440px (wide)
