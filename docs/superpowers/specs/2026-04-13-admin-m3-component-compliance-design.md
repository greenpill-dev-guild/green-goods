# Admin M3 Component Compliance

**Date:** 2026-04-13
**Scope:** Admin dashboard only — zero shared package changes
**Reference:** Material Design 3 v0.192 token spec (material-components/material-web)
**Strictness:** Strict M3 anatomy. Liquid Glass limited to surface materials and motion on shell chrome only.

## Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Strict M3 anatomy over M3-inspired | Components follow exact M3 spec dimensions, state layers, and structure |
| D2 | Admin-only overrides | Shared components untouched; admin creates `Admin*` wrappers or CSS overrides |
| D3 | Adapter pattern | New admin components accept the same data contracts as shared primitives, render M3 anatomy |
| D4 | Liquid Glass on shell only | Glass blur/saturation allowed on TopContextBar; all other components (including NavigationBar) use solid M3 surfaces |
| D5 | Spring motion preserved | M3 standard easing replaced with spring easing from existing motion library — deviation allowed for motion only |
| D6 | Build-on-demand for missing components | Switch, Slider, Carousel created only when a view needs them |

## M3 System Tokens (Reference)

### Shape Scale

| Token | Value | Used by |
|-------|-------|---------|
| corner-none | 0dp | Tabs container, lists, progress |
| corner-extra-small | 4dp | Text fields (outlined), snackbar, tooltip (plain) |
| corner-extra-small-top | 4 4 0 0dp | Text fields (filled) |
| corner-small | 8dp | Chips |
| corner-medium | 12dp | Cards, FAB (small), tooltip (rich) |
| corner-large | 16dp | FAB (standard), side sheet, date picker |
| corner-extra-large | 28dp | Dialogs, bottom sheet, carousel items |
| corner-full | 9999dp | Buttons, badges, search bar, switch, slider handle |

### State Layer Opacity

| State | Opacity |
|-------|---------|
| Hover | 8% |
| Focus | 12% |
| Pressed | 12% |
| Dragged | 16% |

Implementation: `::after` pseudo-element with `background: rgb(var(--state-layer-color) / <opacity>)` and `pointer-events: none`. Each component specifies its state layer color (e.g. on-primary for filled button, on-surface for cards).

### Elevation Scale

| Level | Shadow |
|-------|--------|
| 0 | none |
| 1 | 0 1px 2px rgba(0,0,0,0.3), 0 1px 3px 1px rgba(0,0,0,0.15) |
| 2 | 0 1px 2px rgba(0,0,0,0.3), 0 2px 6px 2px rgba(0,0,0,0.15) |
| 3 | 0 1px 3px rgba(0,0,0,0.3), 0 4px 8px 3px rgba(0,0,0,0.15) |
| 4 | 0 2px 3px rgba(0,0,0,0.3), 0 6px 10px 4px rgba(0,0,0,0.15) |
| 5 | 0 4px 4px rgba(0,0,0,0.3), 0 8px 12px 6px rgba(0,0,0,0.15) |

These replace the existing `--elevation-*` custom properties for admin components. Define as `--m3-elevation-0` through `--m3-elevation-5` in `admin-m3-overrides.css`.

---

## Tier 1: Critical (Visually broken)

### 1. Tabs — AdminTabRail

**Replaces:** `CanvasStageTabRail` in Hub view

**Interface:** Accepts `CanvasStageTab[]`, `activeId`, `ariaLabel`, `onChange` — same contract as `CanvasStageTabRail`.

**M3 Primary Navigation Tab anatomy:**

| Property | Value |
|----------|-------|
| Container height | 48dp (label only) / 64dp (icon + label) |
| Container shape | corner-none (0dp) |
| Container color | surface |
| Active indicator | 3dp height, primary color, shape 3 3 0 0 (rounded top corners) |
| Active indicator width | Match tab content width (not full tab width) |
| Typography | title-small (14sp, weight 500) |
| Active label color | primary |
| Inactive label color | on-surface-variant |
| Active icon color | primary |
| Inactive icon color | on-surface-variant |
| Icon size | 24dp |
| State layer (active) | primary @ hover/focus/pressed opacity |
| State layer (inactive) | on-surface @ hover/focus/pressed opacity |

**Animation:** Active indicator slides between tabs using `--spring-medium-duration` and `--spring-medium-easing`. Width animates to match target tab content width.

**Badge treatment:** Tab count badges use M3 badge spec — 16dp height, corner-full, error color background, on-error text, label-small typography. Positioned top-right of tab icon area.

**Accessibility:** `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, focus-visible ring.

**Files:**
- `packages/admin/src/components/AdminTabRail.tsx` (new)
- `packages/admin/src/views/Hub/index.tsx` (swap import)

---

### 2. Search — AdminSearchToolbar

**Replaces:** `ListToolbar` + `SortSelect` in admin views

**Interface:**
```typescript
interface AdminSearchToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  children?: ReactNode; // Filter chips rendered inline
  className?: string;
}
```

**M3 Search Bar anatomy:**

| Property | Value |
|----------|-------|
| Container height | 56dp |
| Container shape | corner-full (pill) |
| Container color | surface-container-high |
| Container elevation | level 3 |
| Input text typography | body-large |
| Input text color | on-surface |
| Placeholder text | body-large, on-surface-variant |
| Leading icon | 24dp, on-surface |
| Trailing icon | 24dp, on-surface-variant |
| State layer | on-surface |

**Layout:** Single flex row, no wrapping. Search bar takes available width. Filter chips render after the search bar via `children` prop with `flex-shrink-0` and `gap-2`.

**Clear button:** Trailing X icon appears when search has value. Replaces trailing icon position.

**Files:**
- `packages/admin/src/components/AdminSearchToolbar.tsx` (new)
- `packages/admin/src/components/AdminFilterChip.tsx` (new — see Chips section)
- `packages/admin/src/views/Hub/index.tsx` (swap import)

---

### 3. Text Fields — AdminTextField

**Replaces:** `FormInput` usage in admin form views

**Interface:**
```typescript
interface AdminTextFieldProps {
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  leadingIcon?: ComponentType<{ className?: string }>;
  trailingIcon?: ComponentType<{ className?: string }>;
  variant?: "filled" | "outlined";
  className?: string;
  // Forwards native input props via React.ComponentPropsWithoutRef<"input">
  inputProps?: React.ComponentPropsWithoutRef<"input">;
}
```

**M3 Filled Text Field anatomy:**

| Property | Value |
|----------|-------|
| Container height | 56dp (content-determined, 56dp standard) |
| Container shape | corner-extra-small-top (4 4 0 0dp) |
| Container color | surface-container-highest |
| Active indicator | 1dp height bottom, on-surface-variant default; 2dp height, primary on focus |
| Input text | body-large, on-surface |
| Label (resting) | body-large, on-surface-variant, vertically centered |
| Label (floating) | body-small, primary (focused) or on-surface-variant (populated) |
| Placeholder | body-large, on-surface-variant (only visible when focused + empty) |
| Leading icon | 24dp, on-surface-variant |
| Trailing icon | 24dp, on-surface-variant |
| Supporting text | body-small, on-surface-variant |
| Error state | Active indicator, label, trailing icon use error color |
| Disabled | Container on-surface @ 0.04, text on-surface @ 0.38 |
| State layer | on-surface |

**M3 Outlined Text Field anatomy:**

| Property | Value |
|----------|-------|
| Container shape | corner-extra-small (4dp all corners) |
| Container color | transparent |
| Outline | 1dp, outline color; 2dp, primary on focus |
| Label (floating) | Breaks the outline (notched) |
| All other properties | Same as filled |

**Label animation:** CSS transition on `transform` and `font-size`. Resting state: `translateY(0)` at body-large. Floating state: `translateY(-12px)` at body-small. Triggered by `:focus-within` or when value is non-empty.

**react-hook-form compatibility:** Forwards `ref` via `forwardRef`, supports `register()` spread.

**Files:**
- `packages/admin/src/components/AdminTextField.tsx` (new)
- Admin form views (swap FormInput → AdminTextField)

---

## Tier 2: High (Wrong anatomy)

### 4. Buttons — AdminButton

**Replaces:** `Button` usage in admin views

**5 M3 variants:**

| Variant | Container | Label | Elevation (rest/hover) | State layer color |
|---------|-----------|-------|----------------------|------------------|
| filled | primary | on-primary | 0 / 1 | on-primary |
| tonal | secondary-container | on-secondary-container | 0 / 1 | on-secondary-container |
| elevated | surface-container-low | primary | 1 / 2 | primary |
| outlined | transparent + outline 1dp | primary | 0 / 0 | primary |
| text | transparent | primary | 0 / 0 | primary |

**Shared properties (all variants):**

| Property | Value |
|----------|-------|
| Height | 40dp |
| Shape | corner-full (pill) |
| Typography | label-large |
| Icon size | 18dp |
| Padding (no icon) | 24dp leading, 24dp trailing |
| Padding (with leading icon) | 16dp leading, 24dp trailing |
| Disabled container | on-surface @ 0.12 |
| Disabled label | on-surface @ 0.38 |
| Min touch target | 48dp |

**Variant mapping from current usage:**
- `primary` → `filled`
- `secondary` → `outlined`
- `ghost` → `text`
- `danger` → `filled` with error color overrides (error container, on-error label)

**Files:**
- `packages/admin/src/components/AdminButton.tsx` (new)

---

### 5. Chips — AdminFilterChip

**New component** — replaces native `<select>` (SortSelect) and wrapping button children.

**M3 Filter Chip anatomy:**

| Property | Value |
|----------|-------|
| Height | 32dp |
| Shape | corner-small (8dp) |
| Typography | label-large |
| Icon size | 18dp |
| Unselected | transparent fill, outline 1dp, on-surface-variant label |
| Selected | secondary-container fill, no outline, on-secondary-container label, checkmark leading icon |
| State layer (unselected) | on-surface-variant |
| State layer (selected) | on-secondary-container |
| Disabled | on-surface @ 0.12 fill, on-surface @ 0.38 label |

**Interface:**
```typescript
interface AdminFilterChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
  leadingIcon?: ComponentType<{ className?: string }>;
  disabled?: boolean;
  className?: string;
}
```

**Sort usage:** Two `AdminFilterChip` elements in radio mode (only one selected). The `AdminSearchToolbar` renders them inline after the search bar.

**Files:**
- `packages/admin/src/components/AdminFilterChip.tsx` (new)

---

### 6. FAB — AdminFab

**Replaces:** `FabButton` rendering in NavigationBar

**M3 FAB anatomy:**

| Property | Standard | Small | Extended |
|----------|----------|-------|----------|
| Size | 56x56dp | 40x40dp | 56dp height, width varies |
| Shape | corner-large (16dp) | corner-medium (12dp) | corner-large (16dp) |
| Container color | primary-container | primary-container | primary-container |
| Icon color | on-primary-container | on-primary-container | on-primary-container |
| Icon size | 24dp | 24dp | 24dp |
| Label typography | — | — | label-large |
| Elevation (rest/hover) | 3 / 4 | 3 / 4 | 3 / 4 |
| State layer | on-primary-container | on-primary-container | on-primary-container |

**Integration:** The NavigationBar's `fabSlot` renders an `AdminFab` instead of `FabButton`. The speed dial items also use corner-large shape. On mobile, the extended FAB shows icon + label with 16dp radius.

**Files:**
- `packages/admin/src/components/AdminFab.tsx` (new)

---

### 7. Checkbox — AdminCheckbox

**Replaces:** `FormCheckbox` in admin form views

**M3 Checkbox anatomy:**

| Property | Value |
|----------|-------|
| Container size | 18dp |
| Container shape | 2dp corner radius |
| State layer | 40dp circle (touch target) |
| Unselected | transparent fill, on-surface-variant outline 2dp |
| Selected | primary fill, on-primary checkmark, no outline |
| Error (unselected) | transparent, error outline 2dp |
| Error (selected) | error fill, on-error checkmark |
| Disabled (unselected) | on-surface @ 0.38 outline |
| Disabled (selected) | on-surface @ 0.38 fill, surface checkmark |
| State layer color | primary (selected), on-surface (unselected), error (error) |

**react-hook-form compatibility:** Wraps native `<input type="checkbox">` with `forwardRef`.

**Files:**
- `packages/admin/src/components/AdminCheckbox.tsx` (new)

---

## Tier 3: Medium (Partial compliance)

### 8. Cards — AdminCard

**Replaces:** `CardBase` / `SurfaceCard` in admin views

**3 M3 variants:**

| Variant | Container color | Elevation (rest/hover) | Outline |
|---------|----------------|----------------------|---------|
| filled | surface-container-highest | 0 / 1 | none |
| elevated | surface-container-low | 1 / 2 | none |
| outlined | surface | 0 / 1 | outline-variant, 1dp |

**Shared properties:**

| Property | Value |
|----------|-------|
| Shape | corner-medium (12dp) |
| Internal padding | 16dp |
| State layer | on-surface |
| Disabled (filled) | surface-variant @ 0.38 |

**Files:**
- `packages/admin/src/components/AdminCard.tsx` (new)

---

### 9. Navigation Bar — CSS Override

**Approach:** Wrapper class `.admin-nav-m3` on CanvasLayout adds CSS overrides.

**Overrides:**

| Property | Current | Target |
|----------|---------|--------|
| Container height | ~60dp | 80dp |
| Active indicator | Circular icon bg | 64x32dp pill, secondary-container |
| Surface | Glass | surface-container, level 2 |
| Label | text-[11px] | label-medium (12sp) |
| Active label weight | font-medium | font-bold (label-medium-prominent) |

**Files:**
- `packages/admin/src/styles/admin-m3-overrides.css` (new)
- `packages/admin/src/components/Layout/CanvasLayout.tsx` (add class)

---

### 10. Dialogs — AdminDialog

**Replaces:** `ConfirmDialog` in admin views

**M3 Basic Dialog anatomy:**

| Property | Value |
|----------|-------|
| Shape | corner-extra-large (28dp) |
| Surface | surface-container-high |
| Elevation | level 3 |
| Headline | headline-small |
| Body | body-medium, on-surface-variant |
| Actions | Text buttons, right-aligned, primary color, label-large |
| Icon | 24dp, secondary |
| Padding | 24dp |
| Scrim | on-surface @ 32% (M3 standard) |

**Wraps Radix Dialog** — keeps focus trap, aria, portal. Only visual output changes.

**Files:**
- `packages/admin/src/components/AdminDialog.tsx` (new)

---

### 11. Lists — AdminListItem

**Replaces:** `CanvasWorkbenchRow` rendering in admin views

**M3 List Item anatomy:**

| Lines | Height | Label | Supporting |
|-------|--------|-------|-----------|
| 1-line | 56dp | body-large, on-surface | — |
| 2-line | 72dp | body-large, on-surface | body-medium, on-surface-variant |
| 3-line | 88dp | body-large, on-surface | body-medium, on-surface-variant (max 2 lines) |

**Shared properties:**

| Property | Value |
|----------|-------|
| Container shape | corner-none |
| Padding | 16dp leading, 16dp trailing |
| Leading icon | 24dp, on-surface-variant |
| Leading avatar | 40dp, corner-full |
| Leading image | 56x56dp, corner-none |
| Trailing icon | 24dp, on-surface-variant |
| Trailing text | label-small, on-surface-variant |
| Divider | on-surface-variant @ low opacity, 16dp inset |
| State layer | on-surface |

**Hub mapping:** Hub workbench rows become 3-line AdminListItems with leading image (thumbnail), overline (garden name), label (work title), supporting text (action + gardener), trailing text (status badge).

**Files:**
- `packages/admin/src/components/AdminListItem.tsx` (new)

---

### 12. Badges — AdminBadge

**For M3 notification badges only** (tab counts, nav indicators). Existing StatusBadge kept as-is for domain-specific status labels.

| Property | Small (dot) | Large (number) |
|----------|-------------|----------------|
| Size | 6dp | 16dp height |
| Shape | corner-full | corner-full |
| Color | error | error |
| Text | — | on-error, label-small |
| Padding | — | 4dp horizontal |

**Files:**
- `packages/admin/src/components/AdminBadge.tsx` (new)

---

### 13. Snackbar — Toast Override

**Approach:** CSS custom properties on admin root + react-hot-toast style config.

| Property | Current | Target |
|----------|---------|--------|
| Background | bg-white | inverse-surface |
| Text | on-surface | inverse-on-surface |
| Action | primary | inverse-primary |
| Shape | 10px | corner-extra-small (4dp) |
| Height | Variable | 48dp (1-line) / 68dp (2-line) |
| Elevation | shadow-md | level 3 |

**Files:**
- `packages/admin/src/styles/admin-m3-overrides.css` (add toast rules)
- `packages/admin/src/main.tsx` (toast Toaster config)

---

### 14. Sheets — CSS Override

**Approach:** CSS overrides via admin wrapper classes.

| Property | Component | Current | Target |
|----------|-----------|---------|--------|
| Top radius | BottomSheet | rounded-t-xl (~12px) | corner-extra-large-top (28dp) |
| Width | SideSheet | 400px | 256dp |
| Side shape | SideSheet | rounded-l/r-xl | corner-large-start (16dp) |
| Surface | Both | Glass | surface-container-low (solid) |
| Drag handle | BottomSheet | w-10 h-1.5 | 32x4dp |

**Files:**
- `packages/admin/src/styles/admin-m3-overrides.css` (add sheet rules)

---

## Tier 4: Low Priority

### 15. Progress — AdminLinearProgress

New generic M3 linear progress bar for loading states.

| Property | Value |
|----------|-------|
| Track height | 4dp |
| Track color | surface-container-highest |
| Indicator color | primary |
| Track/indicator shape | corner-none |
| Indeterminate animation | Standard M3 sweep |

Domain-specific SubmissionProgress remains unchanged.

**Files:**
- `packages/admin/src/components/AdminLinearProgress.tsx` (new)

---

### 16. Tooltips — AdminTooltip

Extracted from FloatingToolbar for reuse across admin.

| Property | Plain | Rich |
|----------|-------|------|
| Shape | corner-extra-small (4dp) | corner-medium (12dp) |
| Container | inverse-surface | surface-container |
| Text | body-small, inverse-on-surface | body-medium, on-surface-variant |
| Elevation | — | level 2 |
| Subhead | — | title-small, on-surface-variant |
| Max width | 200dp | 320dp |

**Files:**
- `packages/admin/src/components/AdminTooltip.tsx` (new)

---

### 17. Date Picker — CSS Override

CSS overrides on existing DatePicker when used in admin.

| Property | Current | Target |
|----------|---------|--------|
| Calendar shape | rounded-xl | corner-large (16dp) |
| Surface | bg-bg-white | surface-container-high |
| Elevation | Custom | level 3 |
| Selected day | bg-primary-base | primary fill, on-primary text |

**Files:**
- `packages/admin/src/styles/admin-m3-overrides.css` (add date picker rules)

---

## Tier 5: Build-on-Demand

### 18. Switch — AdminSwitch

Build when Garden settings or admin preferences need toggles.

| Property | Value |
|----------|-------|
| Track | 52x32dp, corner-full |
| Handle (off) | 16dp, outline color |
| Handle (on) | 24dp, on-primary color |
| Handle (pressed) | 28dp |
| Track (off) | surface-container-highest, outline 2dp |
| Track (on) | primary |

### 19. Slider — AdminSlider

Build when confidence selector or yield config needs a range input.

| Property | Value |
|----------|-------|
| Handle | 20dp, corner-full, primary |
| Track | 4dp height, active: primary, inactive: surface-container-highest |
| Value label | 28dp, primary fill, on-primary text |

### 20. Carousel — AdminCarousel

Build when media galleries are implemented.

| Property | Value |
|----------|-------|
| Item shape | corner-extra-large (28dp) |
| Item surface | surface |
| State layer | on-surface |

---

## File Impact Summary

### New files (15)

```
packages/admin/src/components/AdminTabRail.tsx
packages/admin/src/components/AdminSearchToolbar.tsx
packages/admin/src/components/AdminFilterChip.tsx
packages/admin/src/components/AdminTextField.tsx
packages/admin/src/components/AdminButton.tsx
packages/admin/src/components/AdminFab.tsx
packages/admin/src/components/AdminCheckbox.tsx
packages/admin/src/components/AdminCard.tsx
packages/admin/src/components/AdminDialog.tsx
packages/admin/src/components/AdminListItem.tsx
packages/admin/src/components/AdminBadge.tsx
packages/admin/src/components/AdminTooltip.tsx
packages/admin/src/components/AdminLinearProgress.tsx
packages/admin/src/styles/admin-m3-overrides.css
packages/admin/src/styles/admin-m3-tokens.css
```

### Modified files (~12)

```
packages/admin/src/views/Hub/index.tsx (swap tab, search, list imports)
packages/admin/src/views/Gardens/ (swap form inputs, buttons, dialogs)
packages/admin/src/components/Layout/CanvasLayout.tsx (add nav override class)
packages/admin/src/main.tsx (toast config, CSS imports)
packages/admin/src/components/Garden/*.tsx (swap buttons, checkboxes, cards)
packages/admin/src/components/Hypercerts/*.tsx (swap dialogs, buttons)
packages/admin/src/components/Vault/*.tsx (swap dialogs, buttons)
```

### Shared package changes: 0

### Estimated component count: 12 new + 3 CSS overrides + 3 deferred = 18 total

## Implementation Priority

| Phase | Components | Rationale |
|-------|-----------|-----------|
| 1 | admin-m3-tokens.css, admin-m3-overrides.css | Foundation: M3 elevation, state layer, and shape tokens available to all components |
| 2 | AdminButton, AdminTextField, AdminTabRail | Critical + most-reused: buttons appear everywhere, text fields in all forms, tabs in Hub |
| 3 | AdminSearchToolbar, AdminFilterChip | Fixes the filter wrapping + search styling — high-visibility Hub improvement |
| 4 | AdminCard, AdminListItem, AdminDialog | Medium tier: structural components used across views |
| 5 | AdminFab, AdminCheckbox, AdminBadge | High-priority anatomy fixes, but fewer instances |
| 6 | Nav override, sheet overrides, snackbar override | CSS-only changes, low risk |
| 7 | AdminTooltip, AdminLinearProgress, date picker override | Low priority additions |
| 8 | AdminSwitch, AdminSlider, AdminCarousel | Build on demand |
