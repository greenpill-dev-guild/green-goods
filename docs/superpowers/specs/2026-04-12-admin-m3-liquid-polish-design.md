# Admin Dashboard M3 + Liquid Glass Polish

**Date:** 2026-04-12
**Approach:** Component-Out (top-down) — redesign visible components to M3+Liquid specs, extract tokens as we go, consolidate at the end.
**Scope:** All four admin views (Hub, Garden, Community, Actions) — uniform pass.

## Design Principles

- **Material 3** provides the systematic backbone: dynamic color, type scale, shape tokens, component anatomy.
- **Apple Liquid** provides the visual layer: balanced glass translucency, fluid spring animations, spatial depth.
- **Typography** follows M3's type scale exclusively.
- **Shell chrome** (TopContextBar, NavigationBar) stays neutral. **Workspace chrome** (sheets, view content) gets view-adaptive color.

---

## 1. View-Adaptive M3 Tonal Color System

Each admin view gets a full M3 tonal palette derived from its workspace seed color. Shell elements stay neutral.

### Workspace Seeds

| View | Seed | Scale |
|------|------|-------|
| Hub | blue-500 (`51 92 255`) | `--blue-*` |
| Garden | green-500 (`31 193 107`) | `--green-*` |
| Community | orange-500 (`250 115 25`) | `--orange-*` |
| Actions | red-500 (`251 55 72`) | `--red-*` |

### Tonal Roles per Workspace

Set via `[data-workspace="hub"]` etc. on route change (CanvasLayout already manages this):

| Token | Light Mode | Dark Mode | Used for |
|-------|-----------|-----------|----------|
| `--ws-primary` | seed-500 | seed-200 | FAB, active tab indicator, focus rings |
| `--ws-on-primary` | white | seed-900 | Text on primary surfaces |
| `--ws-primary-container` | seed-100 | seed-900 | Selected chips, active badges, card fills |
| `--ws-on-primary-container` | seed-900 | seed-100 | Text on container surfaces |
| `--ws-secondary` | seed-300 | seed-400 | Secondary actions |
| `--ws-surface-tint` | seed-500/8% | seed-200/10% | Glass tint mixed into surfaces |
| `--ws-outline` | seed-200 | seed-700 | Card borders, dividers |
| `--ws-surface-variant` | seed-50 | seed-900 | Subtle background fills |

### Neutral Shell

TopContextBar and NavigationBar use the stone neutral scale exclusively — no workspace tint on shell chrome.

### Stone Neutral Scale

Replace `--neutral-*` with stone (warm gray) values:

| Token | Current (pure gray) | New (stone) |
|-------|-------------------|-------------|
| `--neutral-950` | `23 23 23` | `12 10 9` |
| `--neutral-900` | `28 28 28` | `28 25 23` |
| `--neutral-800` | `41 41 41` | `41 37 36` |
| `--neutral-700` | `51 51 51` | `68 64 60` |
| `--neutral-600` | `92 92 92` | `87 83 78` |
| `--neutral-500` | `123 123 123` | `120 113 108` |
| `--neutral-400` | `163 163 163` | `168 162 158` |
| `--neutral-300` | `209 209 209` | `214 211 209` |
| `--neutral-200` | `235 235 235` | `231 229 228` |
| `--neutral-100` | `245 245 245` | `245 245 244` |
| `--neutral-50` | `247 247 247` | `250 250 249` |

The `--gray-*` raw scale remains for cases where true neutral is needed (code blocks, etc.). Semantic aliases (`--bg-weak-50`, `--text-strong-950`, etc.) resolve to stone values.

---

## 2. M3 Type Scale

Font: Plus Jakarta Sans (500/600/700 weights loaded).

| M3 Role | CSS Token | Size | Line Height | Weight | Tracking | Maps to |
|---------|-----------|------|-------------|--------|----------|---------|
| Display Large | `--type-display-lg` | 57px | 64px | 600 | -0.25px | Hero stats (rare) |
| Display Medium | `--type-display-md` | 45px | 52px | 600 | 0 | — |
| Display Small | `--type-display-sm` | 36px | 44px | 600 | 0 | — |
| Headline Large | `--type-headline-lg` | 32px | 40px | 600 | 0 | Page titles (PageHeader) |
| Headline Medium | `--type-headline-md` | 28px | 36px | 600 | 0 | Section headers |
| Headline Small | `--type-headline-sm` | 24px | 32px | 600 | 0 | Card group headers |
| Title Large | `--type-title-lg` | 22px | 28px | 600 | 0 | Sheet titles |
| Title Medium | `--type-title-md` | 16px | 24px | 600 | 0.15px | Card titles, tab labels |
| Title Small | `--type-title-sm` | 14px | 20px | 600 | 0.1px | HubWorkCard title |
| Body Large | `--type-body-lg` | 16px | 24px | 400 | 0.5px | Primary body text |
| Body Medium | `--type-body-md` | 14px | 20px | 400 | 0.25px | Descriptions, meta |
| Body Small | `--type-body-sm` | 12px | 16px | 400 | 0.4px | Secondary info |
| Label Large | `--type-label-lg` | 14px | 20px | 500 | 0.1px | Buttons, filter chips |
| Label Medium | `--type-label-md` | 12px | 16px | 500 | 0.5px | Badges, timestamps |
| Label Small | `--type-label-sm` | 11px | 16px | 500 | 0.5px | Eyebrow labels, pill counts |

### Implementation

- Define as CSS custom properties in `theme.css`
- Update `.type-*` utilities in `utilities.css` to map to these tokens
- Add Tailwind `@theme` aliases in admin `index.css` (e.g., `text-title-md`)
- Replace all raw sizes: `text-[11px]` → `text-label-sm`, `text-sm` → `text-body-md`, `text-[0.95rem]` → `text-title-sm`

---

## 3. Shape Token System

Adapted M3 shape scale, keeping the project's existing rounder aesthetic.

| Token | CSS Variable | Value | Used for |
|-------|-------------|-------|----------|
| None | `--shape-none` | 0px | Dividers, table cells |
| Extra Small | `--shape-xs` | 4px | Inline code, tiny chips |
| Small | `--shape-sm` | 8px | Inputs, small buttons, skeletons |
| Medium | `--shape-md` | 12px | Badges, filter chips, toolbar |
| Large | `--shape-lg` | 16px | Cards, workbench rows, dialogs |
| Extra Large | `--shape-xl` | 20px | Sheets, HubWorkCard, elevated surfaces |
| 2XL | `--shape-2xl` | 28px | FAB, NavigationBar, canvas main sheet |
| Full | `--shape-full` | 9999px | Pills, avatars, status dots |

### Tailwind Integration

Add to `@theme` in `index.css`:
```css
@theme {
  --radius-xs: 4px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-2xl: 28px;
  --radius-full: 9999px;
}
```

Tailwind v4 auto-maps `rounded-sm` → `var(--radius-sm)` etc.

### Replacements

| Current | New |
|---------|-----|
| `rounded-[1.65rem]` (HubWorkCard) | `rounded-xl` (20px) |
| `rounded-[1.9rem]` (NavigationBar desktop) | `rounded-2xl` (28px) |
| `rounded-[1.6rem]` (NavigationBar mobile, BottomSheet) | `rounded-2xl` (28px) |
| `rounded-l-[1.5rem]` / `rounded-r-[1.5rem]` (SideSheet) | `rounded-l-xl` / `rounded-r-xl` (20px) |
| `rounded-t-[1.6rem]` (BottomSheet) | `rounded-t-xl` (20px) |
| Inconsistent skeleton rounding | All `rounded-sm` (8px) |

---

## 4. Balanced Glass Surface System

Glass intensity scales with elevation — higher surfaces get more translucency.

### Glass Tiers

| Tier | Opacity | Blur | Saturate | Used for |
|------|---------|------|----------|----------|
| `glass-ground` | 90% | 8px | 1.1 | Page backgrounds, NavigationBar, TopContextBar (on scroll) |
| `glass-raised` | 70% | 16px | 1.3 | Cards, workbench rows, HubWorkCard |
| `glass-floating` | 55% | 20px | 1.5 | SideSheet, BottomSheet, dialogs |
| `glass-overlay` | 40% | 24px | 1.6 | CommandPalette, speed dial backdrop |

### CSS Implementation

```css
.glass-ground {
  background: rgb(var(--neutral-0) / 90%);
  backdrop-filter: blur(8px) saturate(1.1);
  border: 1px solid rgb(var(--neutral-0) / 50%);
}

.glass-raised {
  background: rgb(var(--neutral-0) / 70%);
  backdrop-filter: blur(16px) saturate(1.3);
  border: 1px solid rgb(var(--neutral-0) / 30%);
}

.glass-floating {
  background: rgb(var(--neutral-0) / 55%);
  backdrop-filter: blur(20px) saturate(1.5);
  border: 1px solid rgb(var(--neutral-0) / 25%);
}

.glass-overlay {
  background: rgb(var(--neutral-0) / 40%);
  backdrop-filter: blur(24px) saturate(1.6);
  border: 1px solid rgb(var(--neutral-0) / 20%);
}
```

### Workspace Tinting

Glass surfaces inside workspace views get a subtle color tint:
```css
[data-workspace="hub"] .glass-raised {
  background: color-mix(in srgb, rgb(var(--neutral-0) / 70%), rgb(var(--blue-500) / 4%));
}
/* Same pattern for garden/green, community/orange, actions/red */
```

### Dark Mode

- Base color shifts from `neutral-0` (white) to `neutral-900` (warm dark stone)
- Opacity drops ~10% per tier (more translucent in dark = more depth feel)
- Saturate increases slightly
- Border shifts to `white/10%`

### What NOT to Glass

Body text areas, form inputs (content area), data tables, code blocks — these stay fully opaque. Glass is for chrome and containers, not content.

### Surface Component Integration

Add `glass` variant alongside existing `elevation` variants in `Surface.tsx`:
```tsx
variants: {
  elevation: {
    ground: "glass-ground",
    raised: "glass-raised",
    floating: "glass-floating",
    overlay: "glass-overlay",
    // Keep solid variants for non-glass contexts
    "solid-ground": "bg-bg-weak shadow-[var(--edge-rest)]",
    "solid-raised": "bg-bg-white shadow-[var(--edge-rest),_var(--elevation-1)]",
  }
}
```

---

## 5. Expressive Motion System

### Spring Curve Library

| Token | Easing | Duration | Use |
|-------|--------|----------|-----|
| `--spring-micro` | `cubic-bezier(0.2, 0, 0, 1)` | 150ms | Hover, focus, icon swaps |
| `--spring-fast` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 200ms | Button press, chip toggle |
| `--spring-medium` | `cubic-bezier(0.16, 1, 0.3, 1)` | 300ms | Sheet open/close, tab slide |
| `--spring-slow` | `cubic-bezier(0.16, 1, 0.3, 1)` | 400ms | View transitions, canvas recession |
| `--spring-dramatic` | `cubic-bezier(0.16, 1, 0.3, 1)` | 500ms | Stagger entrance, color dissolve |

### Motion Patterns

**1. Tab indicator slide (new)**
`CanvasStageTabRail` active indicator slides horizontally with `spring-medium`. CSS `transform: translateX()` on pseudo-element, width morphs to match target tab.

**2. Stagger list entrance (upgrade)**
Current: `0.35s`, `40ms` delay. New: `spring-dramatic` (500ms), `50ms` stagger, add `scale(0.97)` to `translateY(8px)`. Max 12 items before delay flattens.

**3. Canvas recession (formalize)**
Sheet opens: `scale(0.992)`, `opacity(0.95)`, `blur(1.5px)` over `spring-slow`. Already defined — ensure consistent application.

**4. View crossfade (upgrade)**
Add workspace color cross-dissolve. Hub→Garden: blue tint → green tint over `spring-dramatic`. Uses `@property` animation on `--ws-surface-tint`.

**5. Card hover lift (standardize)**
All interactive surfaces:
- Hover: `translateY(-2px)` + elevation-1→elevation-2, `spring-fast`
- Active: `translateY(0) scale(0.992)`, `spring-micro`
- Focus-visible: `ring-2` workspace primary, `spring-micro`

**6. Speed dial entrance (keep)**
Existing `speed-dial-in` aligned to `spring-fast` with `30ms` stagger.

### Reduced Motion

All animations collapse to instant state changes (opacity 0→1 only, no transforms). Existing `prefers-reduced-motion` support extended to full coverage.

---

## 6. Component Polish

### Approach: Three-Tier Cascade

Fix ~15 high-visibility foundation components. ~40+ domain components inherit automatically.

### Tier 1: Foundation (high visibility)

**HubWorkCard**
- Remove: 8-line `cn()` with hardcoded rgba shadows, `bg-[linear-gradient(180deg,...)]`
- Replace: `glass-raised` + `rounded-xl` + `shadow-[var(--edge-rest),var(--elevation-1)]`
- Typography: `text-[0.95rem]` → `text-title-sm`, `text-[11px]` → `text-label-sm`, `text-xs` → `text-body-sm`
- Hover: standardized card hover lift
- Domain badge: unified `DomainBadge` component
- Keep: image grid layout, aspect ratios, lazy loading

**DomainBadge (new shared component)**
- Extracted from duplicated Hub/Actions definitions
- M3 chip anatomy: `glass-raised` + workspace-aware colors
- Props: `domain: Domain`, `size?: 'sm' | 'md'`

**PageHeader (canvas variant)**
- Background: `glass-ground` with workspace gradient tint
- Typography: title → `text-headline-lg`, description → `text-body-lg`
- Keep: sticky, metadata slot, toolbar slot, actions slot

**NavigationBar**
- Background: `glass-ground` neutral (no workspace tint — shell chrome)
- Shape: `rounded-2xl` (28px)
- Active NavItem: `--ws-primary-container` fill + `--ws-on-primary-container` text
- FAB: flat `--ws-primary` fill (no gradient)
- Entry animation: `var(--spring-medium)`
- Keep: safe-area insets, speed dial, z-nav

**TopContextBar**
- Background: transparent at rest, `glass-ground` on scroll (frosted appearing header)
- Icon buttons: shared `icon-button` utility, `rounded-sm`, hover → `glass-raised`, `spring-micro`
- Typography: sheet label → `text-title-md`
- Keep: sticky, notification popover, back-button

**SideSheet**
- Background: `glass-floating` + workspace tint
- Shape: `rounded-l-xl` / `rounded-r-xl` (20px)
- Shadow: `var(--elevation-4)` + workspace-tinted inset highlight
- Border: `white/30%` (balanced glass)
- Animation: `var(--spring-medium)` (300ms)
- Overlay: `bg-neutral-950/18 backdrop-blur-sm`
- Keep: bounded/full overlay, left/right positioning, close button

**BottomSheet**
- Background: `glass-floating` + workspace tint
- Shape: `rounded-t-xl` (20px)
- Shadow: `var(--elevation-4)` upward
- Drag handle: `bg-ws-primary/32`
- Animation: `var(--spring-slow)` (400ms)
- Keep: drag physics, pointer capture, max-height, safe-area

**CanvasStageTabRail**
- Add sliding indicator (spring-medium)
- Active: workspace primary + `glass-raised`
- Shape: tab `rounded-md`, rail `rounded-lg`

**CanvasWorkbenchRow**
- Surface: `glass-raised` + `rounded-lg`
- Standardized hover lift
- Typography: eyebrow → `text-label-sm`, title → `text-title-md`, description → `text-body-md`, meta → `text-body-sm`

**StatCard**
- Surface: `glass-raised` + workspace tint
- Typography: value → `text-headline-sm`, label → `text-label-md`
- TrendIndicator: `--ws-primary` positive, `error-base` negative
- Shape: `rounded-lg`

**Card / CardBase**
- Align with Surface glass variants
- CardHeader title: `text-title-md`, description: `text-body-sm`
- Shape: `rounded-lg`

**GardenChip**
- Shape: `rounded-full`
- Active: `glass-raised` + workspace tint
- Typography: `text-label-lg`

**StatusBadge**
- Ensure semantic state token colors
- Shape: `rounded-full`

**Badge**
- Shape: `rounded-md`
- Typography: `text-label-sm`

**CommandPalette**
- Surface: `glass-overlay`
- Shape: container `rounded-xl`
- Input: `text-body-lg`, neutral background
- Results: `glass-raised` hover

**Button**
- Primary: use `--ws-primary` inside workspaces
- Shape: `rounded-sm` (8px)
- Keep: size variants, loading state

**EmptyState**
- Icon container: `glass-raised` circle, 64px, workspace tint
- Typography: title → `text-title-md`, description → `text-body-md`

**Filter chips (Actions domain tags)**
- M3 filter chip: `rounded-sm`, `text-label-lg`
- Active: `--ws-primary-container` + `--ws-on-primary-container`
- Inactive: `glass-ground` + `text-neutral-600`

### Tier 2: Creation Flows

**Form system** (FormInput, FormTextarea, FormSelect, FormCheckbox, FormField, FormLayout)
- Input borders: `--edge-rest` / `--edge-hover` / `--edge-active`
- Focus: `--edge-focus` with workspace primary
- Shape: `rounded-sm` (8px)
- Typography: labels → `text-label-lg`, input → `text-body-lg`, error → `text-body-sm` + `error-base`
- Keep: Radix Select, zod, react-hook-form

**FormWizard + StepIndicator**
- Active dot: `--ws-primary`, completed: `--ws-primary` + check
- Connector line: `stroke-soft` → `--ws-primary` on completion
- Step label: `text-label-md`

**ConfirmDialog / DialogShell**
- Surface: `glass-floating`
- Shape: `rounded-xl`
- Typography: title → `text-title-lg`, body → `text-body-lg`
- Buttons: M3 dialog pattern (text buttons, primary right)

**ImagePreviewDialog**
- Surface: `glass-overlay` backdrop
- Close button: `glass-raised` circle

### Tier 3: Domain Components (inherit from Tier 1+2)

These compose Tier 1+2 primitives and inherit styling automatically:
- Garden creation steps → FormWizard + FormField
- Action creation steps → FormWizard + FormField
- Hypercert wizard → FormWizard + FormField
- Vault modals → DialogShell + FormField
- Assessment steps → FormWizard + FormField
- Member/Role modals → DialogShell
- Tables → neutral `text-body-md`, `rounded-sm` cells, `--edge-rest` separators

---

## 7. Structural Cleanup

### A. Container Queries over Media Queries

- Delete duplicated `useMediaQuery` from Community and Garden views
- Sheet rendering (Side vs Bottom) uses container width, not viewport
- Promote `useContainerQuery` hook to `@green-goods/shared` (uses `ResizeObserver` on ref)

### B. Unified Skeleton System

Replace inconsistent skeleton patterns across views:
- **Workbench skeleton** (Actions): 6× `h-20 rounded-sm`
- **Dashboard skeleton** (Garden/Community): 2-col grid with `h-36 rounded-lg` + full-width `h-64 rounded-lg`
- All use `--shape-sm` rounding, same shimmer from `utilities.css`
- Stagger delay: `50ms × index`

### C. Unified Domain Color Definitions

Single `DOMAIN_CONFIG` in `@green-goods/shared`:
```ts
export const DOMAIN_CONFIG: Record<Domain, {
  icon: ComponentType;
  labelId: string;
  colors: { bg: string; text: string; border: string };
  gradient: { from: string; to: string };
}> = { ... }
```
- Resolve SOLAR inconsistency: `warning-*` (yellow/amber) is canonical
- Both `DomainBadge` and Actions filter chips consume from this

### D. Deduplicate Sheet Width

Extract `useSheetWidth()` to `@green-goods/shared`:
- Uses `ResizeObserver` on canvas container (not `window.innerWidth`)
- Returns responsive width for SideSheet prop

---

## Files Affected (Estimated)

### Shared Package (`packages/shared/`)
- `src/styles/theme.css` — stone neutrals, workspace tonal roles, glass tiers, spring tokens, type scale, shape tokens
- `src/styles/utilities.css` — updated `.type-*`, new `.glass-*`, updated stagger
- `src/components/Surface/Surface.tsx` — glass variants
- `src/components/Canvas/NavigationBar.tsx` — glass-ground, shape tokens, flat FAB
- `src/components/Canvas/TopContextBar.tsx` — scroll glass, icon-button utility
- `src/components/Canvas/SideSheet.tsx` — glass-floating, shape tokens, spring tokens
- `src/components/Canvas/BottomSheet.tsx` — glass-floating, shape tokens, spring tokens
- `src/components/Canvas/CanvasScaffold.tsx` — tab sliding, workbench row glass
- `src/components/Button.tsx` — workspace primary, shape token
- `src/components/Cards/CardBase.tsx` — glass alignment, typography
- `src/components/ListPrimitives.tsx` — EmptyState glass, typography
- `src/components/StatCard.tsx` — glass-raised, typography
- `src/components/StatusBadge.tsx` — token colors
- `src/components/Badge.tsx` — shape, typography
- `src/components/Dialog/ConfirmDialog.tsx` — glass-floating
- `src/components/Form/*.tsx` — edge tokens, shape, typography
- New: `src/components/DomainBadge.tsx`
- New: `src/hooks/useContainerQuery.ts`
- New: `src/hooks/useSheetWidth.ts`
- New: `src/config/domain.ts` (DOMAIN_CONFIG)

### Admin Package (`packages/admin/`)
- `src/index.css` — @theme aliases for shape/type, workspace palette CSS rulesets
- `src/views/Hub/components/HubWorkCard.tsx` — glass + tokens + DomainBadge
- `src/views/Actions/index.tsx` — DOMAIN_CONFIG, filter chip M3, skeleton
- `src/views/Community/index.tsx` — remove useMediaQuery, useContainerQuery, skeleton
- `src/views/Garden/index.tsx` — remove useMediaQuery, useContainerQuery, skeleton
- `src/components/Layout/PageHeader.tsx` — glass-ground, typography
- `src/components/Layout/CommandPalette.tsx` — glass-overlay
- `src/components/Layout/CanvasLayout.tsx` — workspace data attribute (verify)
