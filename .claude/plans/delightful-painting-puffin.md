# Admin UI Overhaul — Remaining Gaps Implementation Plan

## Context

The admin UI overhaul (`bfc6bdf9`) brought completion from ~55% to ~95%. Six gaps remain: dashboard density, garden hero enhancement, featured cards, color-only status indicators, touch targets, and named type scale. This plan closes all gaps for a 100% complete overhaul.

---

## Phase A: Foundation (type scale + StatusBadge + touch targets)

These are cross-cutting changes that other phases build on.

### A1. Adopt named type scale in admin `index.css`

**File**: `packages/admin/src/index.css`

Add `@theme` block with the type scale tokens from `packages/client/src/styles/typography.css` (title-h5/h6, label-md/sm/xs, paragraph-md/sm/xs, subheading-sm/xs). Then add utility classes in `@layer utilities`:

```css
.label-md { font-size: var(--text-label-md); line-height: var(--text-label-md--line-height); ... }
.label-sm { font-size: var(--text-label-sm); ... }
.label-xs { font-size: var(--text-label-xs); ... }
.body-md   { font-size: var(--text-paragraph-md); ... }
.body-sm   { font-size: var(--text-paragraph-sm); ... }
.body-xs   { font-size: var(--text-paragraph-xs); ... }
.subheading-sm { font-size: var(--text-subheading-sm); letter-spacing: 0.06em; text-transform: uppercase; }
.subheading-xs { font-size: var(--text-subheading-xs); letter-spacing: 0.04em; text-transform: uppercase; }
```

Then migrate high-traffic patterns across views:
- `text-xs uppercase tracking-wide` → `subheading-xs` (StatCard labels, section headers)
- `text-sm font-medium` → `label-sm` (card titles, form labels)
- `text-sm text-text-sub` → `body-sm text-text-sub` (descriptions)
- `text-2xl font-bold font-heading` → keep as-is (page titles use font-heading already)

**Scope**: Define tokens/utilities in index.css, then migrate usage in: `StatCard.tsx`, `SectionHeader.tsx`, `GardenStatsGrid.tsx`, `GardenHeroSection.tsx`, `Dashboard/index.tsx`, `Gardens/index.tsx`, `Treasury/index.tsx`, `Actions/index.tsx`.

### A2. Upgrade StatusBadge with icons (fix color-only indicators)

**File**: `packages/admin/src/components/ui/StatusBadge.tsx`

The current admin StatusBadge is a color-only stub. The shared package has a richer version with icons (`RiCheckLine`, `RiCloseLine`, `RiTimeLine`, `RiErrorWarningLine`, etc.). Enhance the admin component:

- Add `icon` slot prop (optional `React.ReactNode`)
- Add per-variant default icons (success → checkmark, warning → alert, error → close, info → info circle)
- Add `showIcon` boolean (default `true`) to opt out
- Add `role="status"` and `aria-live="polite"` to the root `<span>`
- Keep existing `tv()` variants but extend with icon sizing

This ensures no status indicator relies on color alone (WCAG 1.4.1).

### A3. Touch target utility + audit

**File**: `packages/admin/src/index.css`

Add in `@layer utilities`:
```css
.touch-target { min-height: 44px; min-width: 44px; }
```

Then audit and apply to icon-only interactive elements:
- `GardenHeroSection.tsx` action links (already `h-10 w-10` = 40px on mobile → bump to `h-11 w-11` = 44px)
- Sidebar close button
- Header mobile menu button
- Any other icon-only buttons found during implementation

---

## Phase B: Entity-Typed Color Language

### B1. Apply `colorAccent` to Cards across views

The `Card` component has a `colorAccent` prop that renders a 2px left border — currently unused. Apply entity-typed colors consistently:

| View | Entity | colorAccent |
|------|--------|-------------|
| Dashboard — Quick Actions card | primary entity | `colorAccent="primary"` |
| Dashboard — Recent Gardens card | gardens | `colorAccent="success"` |
| Dashboard — ENS Claim card | info | `colorAccent="info"` |
| Gardens list — each garden card | gardens | `colorAccent="success"` |
| Actions list — each action card | actions | `colorAccent="warning"` |
| Treasury — vault cards | treasury | `colorAccent="info"` |
| Contracts — contract sections | contracts | `colorAccent="primary"` |
| Garden Detail — sections | per-section | success (stats), info (metadata), warning (community) |

**Files**: `Dashboard/index.tsx`, `Gardens/index.tsx`, `Actions/index.tsx`, `Treasury/index.tsx`, `Contracts/index.tsx`, `Gardens/Garden/Detail.tsx`

### B2. Fix GardenStatsGrid colorSchemes

**File**: `packages/admin/src/components/Garden/GardenStatsGrid.tsx`

All StatCards currently default to `colorScheme="success"`. Apply semantic colors:

- Gardeners → `"success"` (green — growth)
- Operators → `"info"` (blue — management)
- Work count → `"warning"` (amber — activity)
- Assessments → `"info"` (blue — review)
- TVL → `"info"` (blue — financial)
- Harvests → `"success"` (green — yield)
- Depositors → `"warning"` (amber — participation)
- Community → `"success"` (green — collective)

---

## Phase C: Garden Hero Enhancement

### C1. Overlapping stat chips on hero

**File**: `packages/admin/src/components/Garden/GardenHeroSection.tsx`

Add a row of compact stat "chips" that sit at the bottom of the hero, overlapping the image/content boundary:

```tsx
<div className="-mt-5 mx-4 sm:mx-6 flex gap-3 flex-wrap relative z-10">
  <StatChip icon={<RiUserLine />} label="12" sublabel="Gardeners" color="success" />
  <StatChip icon={<RiShieldCheckLine />} label="3" sublabel="Operators" color="info" />
  <StatChip icon={<RiCheckboxCircleLine />} label="8" sublabel="Works" color="warning" />
</div>
```

The `StatChip` is a lightweight inline component (not a separate file) — small pill with icon + number + label, `bg-bg-white shadow-md rounded-lg px-3 py-2`.

Also enhance the hero gradient: extend `from-static-black/80` area slightly to create a richer base for the overlapping chips.

**Props needed**: Pass `gardenerCount`, `operatorCount`, `workCount` to `GardenHeroSection` (currently not passed — will need to thread from `Detail.tsx`).

### C2. Garden Detail section headers with `SectionHeader`

**Files**: `packages/admin/src/views/Gardens/Garden/Detail.tsx`

Use the existing `SectionHeader` component for tab content sections instead of ad-hoc `<h3>` elements. This provides consistent spacing, description slots, and action buttons.

---

## Phase D: Dashboard Density Redesign

### D1. Compact stat rows

**File**: `packages/admin/src/views/Dashboard/index.tsx`

Replace the current `md:grid-cols-3` StatCard grid with a denser layout:
- Keep 3 StatCards on desktop but make them more compact (reduce padding)
- Add a secondary stat row below with smaller inline stats (total works, total assessments) using `text-sm` inline badges rather than full StatCards
- Use `gap-4` instead of `gap-6` for tighter spacing

### D2. Activity feed for Recent Gardens

**File**: `packages/admin/src/views/Dashboard/index.tsx`

Enhance the "Recent Gardens" section from a plain list to a richer activity-oriented layout:
- Each row gets a small avatar/monogram circle (garden initial on gradient)
- Show last activity timestamp (relative time like "2h ago")
- Add a subtle sparkline-ready layout (flex row with a reserved `w-20` slot on the right for future sparklines — just a placeholder div for now)
- More visible member counts with mini icon + number pairs

### D3. Garden card size variants in Gardens list

**File**: `packages/admin/src/views/Gardens/index.tsx`

Add a "featured" treatment to the first garden in the grid:
- First card spans `md:col-span-2` (takes 2 columns on desktop)
- Taller banner (`h-56` instead of `h-48`)
- Shows full description (remove `line-clamp-2`)
- Gets `colorAccent="primary"` and a "Featured" badge
- Remaining cards stay at their current size

---

## Phase E: Remaining Polish

### E1. Dark mode `shadow-2xl` on login card

**File**: `packages/admin/src/index.css`

The login card's `shadow-2xl` is invisible in dark mode. Add a subtle `border border-stroke-soft` fallback on the login card in dark mode, or adjust the dark mode `shadow-2xl` to use a slightly lighter shadow color.

### E2. Sidebar section label size

**File**: `packages/admin/src/components/Layout/Sidebar.tsx`

The "ADMIN" section label uses `text-[10px]` which may fail WCAG minimum text size. Change to `subheading-xs` (12px) from the new type scale.

---

## Files Modified (complete list)

| File | Changes |
|------|---------|
| `packages/admin/src/index.css` | Type scale tokens + utilities, touch-target utility, dark shadow fix |
| `packages/admin/src/components/ui/StatusBadge.tsx` | Add icons, ARIA, showIcon prop |
| `packages/admin/src/components/StatCard.tsx` | Migrate to `subheading-xs` for label |
| `packages/admin/src/components/ui/SectionHeader.tsx` | Migrate to named type scale |
| `packages/admin/src/components/Garden/GardenStatsGrid.tsx` | Add per-stat colorSchemes |
| `packages/admin/src/components/Garden/GardenHeroSection.tsx` | Overlapping stat chips, touch targets |
| `packages/admin/src/views/Dashboard/index.tsx` | Density redesign, activity feed, entity colors |
| `packages/admin/src/views/Gardens/index.tsx` | Featured first card, entity colors |
| `packages/admin/src/views/Gardens/Garden/Detail.tsx` | SectionHeader usage, entity colors, pass stats to hero |
| `packages/admin/src/views/Actions/index.tsx` | Entity color accent |
| `packages/admin/src/views/Treasury/index.tsx` | Entity color accent, type scale |
| `packages/admin/src/views/Contracts/index.tsx` | Entity color accent |
| `packages/admin/src/components/Layout/Sidebar.tsx` | Section label size fix |

## Verification

1. `bun format && bun lint` — ensure no formatting/lint issues
2. `bun run test` — run all tests
3. `bun build` — verify admin builds cleanly
4. Visual check at `https://localhost:3002`:
   - Toggle dark/light mode on every view — no contrast issues
   - Check StatusBadges show icons alongside colors
   - Verify entity color accents are visible on Cards
   - Verify GardenStatsGrid has varied colorSchemes
   - Check dashboard density feels tighter
   - Check garden hero has overlapping stat chips
   - Verify first garden card in list spans 2 columns
   - Test at 375px mobile — touch targets are ≥44px
   - Check sidebar "ADMIN" label is 12px not 10px
