# Admin M3 + Liquid Glass Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the admin dashboard's four views (Hub, Garden, Community, Actions) with Material 3 systematic tokens and Apple Liquid Glass visual layer, replacing inconsistent AI-generated styling.

**Architecture:** Component-Out approach — define design tokens in CSS, apply to the ~15 highest-visibility shared components (glass surfaces, typography, shape, motion), then migrate the four admin views. ~40+ domain components inherit styling automatically through composition. Stone warm neutrals for shell chrome, view-adaptive M3 tonal palettes for workspace content.

**Tech Stack:** Tailwind CSS v4 (CSS-first), tailwind-variants, CSS custom properties, CSS `color-mix()`, View Transitions API, `@property` animations, ResizeObserver.

**Spec:** `docs/superpowers/specs/2026-04-12-admin-m3-liquid-polish-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `packages/shared/src/config/domain.ts` | Unified `DOMAIN_CONFIG` — icons, labels, colors, gradients per domain |
| `packages/shared/src/components/DomainBadge.tsx` | M3 chip-style domain badge consuming `DOMAIN_CONFIG` |
| `packages/shared/src/hooks/useContainerQuery.ts` | ResizeObserver-based container width hook (replaces `useMediaQuery`) |
| `packages/shared/src/hooks/useSheetWidth.ts` | Responsive sheet width from canvas container |

### Modified Files (by wave)

**Wave 1 — Tokens:**
- `packages/shared/src/styles/theme.css` — stone neutrals, workspace tonal roles, type scale, shape, spring, glass tokens
- `packages/shared/src/styles/utilities.css` — updated `.type-*`, new `.glass-*`, updated stagger
- `packages/admin/src/index.css` — `@theme` radius/type aliases, workspace palette rulesets, dark mode glass

**Wave 2 — Structural:**
- `packages/shared/src/config/domain.ts` (create)
- `packages/shared/src/components/DomainBadge.tsx` (create)
- `packages/shared/src/hooks/useContainerQuery.ts` (create)
- `packages/shared/src/hooks/useSheetWidth.ts` (create)
- `packages/shared/src/hooks/index.ts` — export new hooks
- `packages/shared/src/index.ts` — export new hooks + DomainBadge + DOMAIN_CONFIG

**Wave 3 — Foundation Components:**
- `packages/shared/src/components/Surface/Surface.tsx` — glass elevation variants
- `packages/shared/src/components/Button.tsx` — workspace primary, shape token
- `packages/shared/src/components/Cards/CardBase.tsx` — glass alignment, typography
- `packages/shared/src/components/Canvas/NavigationBar.tsx` — glass-ground, shape, flat FAB
- `packages/shared/src/components/Canvas/TopContextBar.tsx` — scroll glass, icon utility
- `packages/shared/src/components/Canvas/SideSheet.tsx` — glass-floating, tokens
- `packages/shared/src/components/Canvas/BottomSheet.tsx` — glass-floating, tokens
- `packages/shared/src/components/Canvas/CanvasScaffold.tsx` — tab slide, workbench glass
- `packages/shared/src/components/Canvas/GardenChip.tsx` — shape, glass, typography
- `packages/shared/src/components/StatCard.tsx` — glass-raised, typography
- `packages/shared/src/components/ListPrimitives.tsx` — EmptyState glass, typography, toolbar tokens
- `packages/shared/src/components/StatusBadge.tsx` — token alignment
- `packages/shared/src/components/Badge.tsx` — shape, typography
- `packages/shared/src/components/Dialog/ConfirmDialog.tsx` — glass-floating, typography
- `packages/shared/src/components/Form/FormInput.tsx` — edge tokens, shape
- `packages/shared/src/components/Form/FormFieldWrapper.tsx` — typography tokens
- `packages/admin/src/components/Layout/PageHeader.tsx` — glass-ground, typography
- `packages/admin/src/components/Layout/CommandPalette.tsx` — glass-overlay

**Wave 4 — View Migration:**
- `packages/admin/src/views/Hub/components/HubWorkCard.tsx` — glass, tokens, DomainBadge
- `packages/admin/src/views/Actions/index.tsx` — DOMAIN_CONFIG, filter chips, skeleton
- `packages/admin/src/views/Garden/index.tsx` — container queries, skeleton
- `packages/admin/src/views/Community/index.tsx` — container queries, skeleton
- `packages/admin/src/components/Layout/CanvasLayout.tsx` — verify workspace attribute

---

## Wave 1: Design Token Foundation

### Task 1: Stone Neutrals + Workspace Tonal Palette CSS

**Files:**
- Modify: `packages/shared/src/styles/theme.css:120-140` (neutral scale)
- Modify: `packages/admin/src/index.css` (add workspace palette rulesets)

- [ ] **Step 1: Replace neutral scale with stone values in theme.css**

In `packages/shared/src/styles/theme.css`, find the neutral scale section (around line 125) and replace:

```css
  /* Neutral (alias to gray with added 850 for card elevation) */
  --neutral-950: var(--gray-950);
  --neutral-900: var(--gray-900);
  --neutral-850: 35 35 35;  /* Custom intermediate for card elevation */
  --neutral-800: var(--gray-800);
  --neutral-700: var(--gray-700);
  --neutral-600: var(--gray-600);
  --neutral-500: var(--gray-500);
  --neutral-400: var(--gray-400);
  --neutral-300: var(--gray-300);
  --neutral-200: var(--gray-200);
  --neutral-100: var(--gray-100);
  --neutral-50: var(--gray-50);
  --neutral-0: var(--gray-0);
```

Replace with:

```css
  /* Neutral — Stone (warm gray with earthy undertone) */
  --neutral-950: 12 10 9;
  --neutral-900: 28 25 23;
  --neutral-850: 35 32 30;
  --neutral-800: 41 37 36;
  --neutral-700: 68 64 60;
  --neutral-600: 87 83 78;
  --neutral-500: 120 113 108;
  --neutral-400: 168 162 158;
  --neutral-300: 214 211 209;
  --neutral-200: 231 229 228;
  --neutral-100: 245 245 244;
  --neutral-50: 250 250 249;
  --neutral-0: 255 255 255;
```

- [ ] **Step 2: Add workspace tonal palette rulesets to admin index.css**

In `packages/admin/src/index.css`, add after the existing `:root` spatial design tokens section (after the `--edge-*` dark mode block, around line 205):

```css
/* ============================================================================
 * WORKSPACE TONAL PALETTES — M3 dynamic color per admin view
 * Each workspace derives 8 tonal roles from its seed color.
 * Shell chrome (TopContextBar, NavigationBar) stays on neutral.
 * ============================================================================ */
[data-workspace="hub"] {
  --ws-primary: var(--blue-500);
  --ws-on-primary: 255 255 255;
  --ws-primary-container: var(--blue-100);
  --ws-on-primary-container: var(--blue-900);
  --ws-secondary: var(--blue-300);
  --ws-surface-tint: var(--blue-500) / 8%;
  --ws-outline: var(--blue-200);
  --ws-surface-variant: var(--blue-50);
}

[data-workspace="garden"] {
  --ws-primary: var(--green-500);
  --ws-on-primary: 255 255 255;
  --ws-primary-container: var(--green-100);
  --ws-on-primary-container: var(--green-900);
  --ws-secondary: var(--green-300);
  --ws-surface-tint: var(--green-500) / 8%;
  --ws-outline: var(--green-200);
  --ws-surface-variant: var(--green-50);
}

[data-workspace="community"] {
  --ws-primary: var(--orange-500);
  --ws-on-primary: 255 255 255;
  --ws-primary-container: var(--orange-100);
  --ws-on-primary-container: var(--orange-900);
  --ws-secondary: var(--orange-300);
  --ws-surface-tint: var(--orange-500) / 8%;
  --ws-outline: var(--orange-200);
  --ws-surface-variant: var(--orange-50);
}

[data-workspace="actions"] {
  --ws-primary: var(--red-500);
  --ws-on-primary: 255 255 255;
  --ws-primary-container: var(--red-100);
  --ws-on-primary-container: var(--red-900);
  --ws-secondary: var(--red-300);
  --ws-surface-tint: var(--red-500) / 8%;
  --ws-outline: var(--red-200);
  --ws-surface-variant: var(--red-50);
}

/* Dark mode workspace palettes */
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

@variant dark {
  [data-workspace="hub"] {
    --ws-primary: var(--blue-200);
    --ws-on-primary: var(--blue-900);
    --ws-primary-container: var(--blue-900);
    --ws-on-primary-container: var(--blue-100);
    --ws-secondary: var(--blue-400);
    --ws-surface-tint: var(--blue-200) / 10%;
    --ws-outline: var(--blue-700);
    --ws-surface-variant: var(--blue-900);
  }

  [data-workspace="garden"] {
    --ws-primary: var(--green-200);
    --ws-on-primary: var(--green-900);
    --ws-primary-container: var(--green-900);
    --ws-on-primary-container: var(--green-100);
    --ws-secondary: var(--green-400);
    --ws-surface-tint: var(--green-200) / 10%;
    --ws-outline: var(--green-700);
    --ws-surface-variant: var(--green-900);
  }

  [data-workspace="community"] {
    --ws-primary: var(--orange-200);
    --ws-on-primary: var(--orange-900);
    --ws-primary-container: var(--orange-900);
    --ws-on-primary-container: var(--orange-100);
    --ws-secondary: var(--orange-400);
    --ws-surface-tint: var(--orange-200) / 10%;
    --ws-outline: var(--orange-700);
    --ws-surface-variant: var(--orange-900);
  }

  [data-workspace="actions"] {
    --ws-primary: var(--red-200);
    --ws-on-primary: var(--red-900);
    --ws-primary-container: var(--red-900);
    --ws-on-primary-container: var(--red-100);
    --ws-secondary: var(--red-400);
    --ws-surface-tint: var(--red-200) / 10%;
    --ws-outline: var(--red-700);
    --ws-surface-variant: var(--red-900);
  }
}
```

- [ ] **Step 3: Verify build compiles**

Run: `cd packages/admin && bun build`
Expected: Build succeeds with no CSS errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/styles/theme.css packages/admin/src/index.css
git commit -m "feat(shared,admin): stone neutrals + M3 workspace tonal palettes"
```

---

### Task 2: M3 Type Scale Tokens + Utilities

**Files:**
- Modify: `packages/shared/src/styles/theme.css` (add type scale custom properties)
- Modify: `packages/shared/src/styles/utilities.css:83-131` (update `.type-*` utilities)
- Modify: `packages/admin/src/index.css` (add `@theme` type aliases)

- [ ] **Step 1: Add M3 type scale custom properties to theme.css**

In `packages/shared/src/styles/theme.css`, inside the `:root` block within `@layer theme`, add after the color scales (before the closing `}` of `:root`):

```css
  /* ── M3 Type Scale ── */
  --type-display-lg: 57px;
  --type-display-lg-lh: 64px;
  --type-display-lg-ls: -0.25px;
  --type-display-md: 45px;
  --type-display-md-lh: 52px;
  --type-display-md-ls: 0px;
  --type-display-sm: 36px;
  --type-display-sm-lh: 44px;
  --type-display-sm-ls: 0px;
  --type-headline-lg: 32px;
  --type-headline-lg-lh: 40px;
  --type-headline-lg-ls: 0px;
  --type-headline-md: 28px;
  --type-headline-md-lh: 36px;
  --type-headline-md-ls: 0px;
  --type-headline-sm: 24px;
  --type-headline-sm-lh: 32px;
  --type-headline-sm-ls: 0px;
  --type-title-lg: 22px;
  --type-title-lg-lh: 28px;
  --type-title-lg-ls: 0px;
  --type-title-md: 16px;
  --type-title-md-lh: 24px;
  --type-title-md-ls: 0.15px;
  --type-title-sm: 14px;
  --type-title-sm-lh: 20px;
  --type-title-sm-ls: 0.1px;
  --type-body-lg: 16px;
  --type-body-lg-lh: 24px;
  --type-body-lg-ls: 0.5px;
  --type-body-md: 14px;
  --type-body-md-lh: 20px;
  --type-body-md-ls: 0.25px;
  --type-body-sm: 12px;
  --type-body-sm-lh: 16px;
  --type-body-sm-ls: 0.4px;
  --type-label-lg: 14px;
  --type-label-lg-lh: 20px;
  --type-label-lg-ls: 0.1px;
  --type-label-md: 12px;
  --type-label-md-lh: 16px;
  --type-label-md-ls: 0.5px;
  --type-label-sm: 11px;
  --type-label-sm-lh: 16px;
  --type-label-sm-ls: 0.5px;
```

- [ ] **Step 2: Update `.type-*` utilities in utilities.css**

In `packages/shared/src/styles/utilities.css`, replace lines 83-131 (the existing `.type-*` block):

```css
  /* ── Type Roles — M3 Type Scale ── */
  .type-display {
    font-size: var(--type-display-sm);
    line-height: var(--type-display-sm-lh);
    letter-spacing: var(--type-display-sm-ls);
    font-weight: 600;
    color: rgb(var(--text-strong-950));
  }

  .type-headline {
    font-size: var(--type-headline-lg);
    line-height: var(--type-headline-lg-lh);
    letter-spacing: var(--type-headline-lg-ls);
    font-weight: 600;
    color: rgb(var(--text-strong-950));
  }

  .type-title {
    font-size: var(--type-title-md);
    line-height: var(--type-title-md-lh);
    letter-spacing: var(--type-title-md-ls);
    font-weight: 600;
    color: rgb(var(--text-strong-950));
  }

  .type-body {
    font-size: var(--type-body-md);
    line-height: var(--type-body-md-lh);
    letter-spacing: var(--type-body-md-ls);
    font-weight: 400;
    color: rgb(var(--text-sub-600));
  }

  .type-label {
    font-size: var(--type-label-md);
    line-height: var(--type-label-md-lh);
    letter-spacing: var(--type-label-md-ls);
    font-weight: 500;
    text-transform: uppercase;
    color: rgb(var(--text-soft-400));
  }

  .type-caption {
    font-size: var(--type-label-sm);
    line-height: var(--type-label-sm-lh);
    letter-spacing: var(--type-label-sm-ls);
    font-weight: 500;
    color: rgb(var(--text-soft-400));
  }
```

- [ ] **Step 3: Add Tailwind @theme type aliases in admin index.css**

In `packages/admin/src/index.css`, inside the existing `@theme { }` block, add after the color declarations:

```css
  /* M3 Type Scale — Tailwind aliases */
  --text-display-lg: var(--type-display-lg);
  --text-display-md: var(--type-display-md);
  --text-display-sm: var(--type-display-sm);
  --text-headline-lg: var(--type-headline-lg);
  --text-headline-md: var(--type-headline-md);
  --text-headline-sm: var(--type-headline-sm);
  --text-title-lg: var(--type-title-lg);
  --text-title-md: var(--type-title-md);
  --text-title-sm: var(--type-title-sm);
  --text-body-lg: var(--type-body-lg);
  --text-body-md: var(--type-body-md);
  --text-body-sm: var(--type-body-sm);
  --text-label-lg: var(--type-label-lg);
  --text-label-md: var(--type-label-md);
  --text-label-sm: var(--type-label-sm);
```

- [ ] **Step 4: Verify build**

Run: `cd packages/admin && bun build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/styles/theme.css packages/shared/src/styles/utilities.css packages/admin/src/index.css
git commit -m "feat(shared,admin): M3 type scale tokens and updated type utilities"
```

---

### Task 3: Shape Tokens + Glass Tiers + Spring Tokens

**Files:**
- Modify: `packages/admin/src/index.css` (add `@theme` radius aliases)
- Modify: `packages/shared/src/styles/utilities.css` (add glass tier classes)
- Modify: `packages/admin/src/index.css` (update spring tokens, add glass dark mode + workspace tinting)

- [ ] **Step 1: Add shape tokens to admin @theme**

In `packages/admin/src/index.css`, inside the `@theme { }` block:

```css
  /* M3 Shape Scale — adapted rounder aesthetic */
  --radius-xs: 4px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-2xl: 28px;
  --radius-full: 9999px;
```

- [ ] **Step 2: Add glass tier utilities to utilities.css**

In `packages/shared/src/styles/utilities.css`, inside the `@layer utilities { }` block, add before the stagger animation section:

```css
  /* ── Glass Surface Tiers — Balanced Liquid ── */
  .glass-ground {
    background: rgb(var(--neutral-0) / 90%);
    backdrop-filter: blur(8px) saturate(1.1);
    box-shadow: inset 0 0 0 1px rgb(var(--neutral-0) / 50%);
  }

  .glass-raised {
    background: rgb(var(--neutral-0) / 70%);
    backdrop-filter: blur(16px) saturate(1.3);
    box-shadow: inset 0 0 0 1px rgb(var(--neutral-0) / 30%);
  }

  .glass-floating {
    background: rgb(var(--neutral-0) / 55%);
    backdrop-filter: blur(20px) saturate(1.5);
    box-shadow: inset 0 0 0 1px rgb(var(--neutral-0) / 25%);
  }

  .glass-overlay {
    background: rgb(var(--neutral-0) / 40%);
    backdrop-filter: blur(24px) saturate(1.6);
    box-shadow: inset 0 0 0 1px rgb(var(--neutral-0) / 20%);
  }

  /* Dark mode glass — shifts to warm dark base, more translucent */
  [data-theme="dark"] .glass-ground {
    background: rgb(var(--neutral-900) / 80%);
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 10%);
  }

  [data-theme="dark"] .glass-raised {
    background: rgb(var(--neutral-900) / 60%);
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 8%);
  }

  [data-theme="dark"] .glass-floating {
    background: rgb(var(--neutral-900) / 45%);
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 6%);
  }

  [data-theme="dark"] .glass-overlay {
    background: rgb(var(--neutral-900) / 30%);
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 5%);
  }
```

- [ ] **Step 3: Add workspace glass tinting to admin index.css**

In `packages/admin/src/index.css`, add after the workspace palette rulesets:

```css
/* ============================================================================
 * WORKSPACE GLASS TINTING — subtle color bleed into glass surfaces
 * ============================================================================ */
[data-workspace="hub"] .glass-raised,
[data-workspace="hub"] .glass-floating {
  background: color-mix(in srgb, rgb(var(--neutral-0) / 70%) 96%, rgb(var(--blue-500)) 4%);
}

[data-workspace="garden"] .glass-raised,
[data-workspace="garden"] .glass-floating {
  background: color-mix(in srgb, rgb(var(--neutral-0) / 70%) 96%, rgb(var(--green-500)) 4%);
}

[data-workspace="community"] .glass-raised,
[data-workspace="community"] .glass-floating {
  background: color-mix(in srgb, rgb(var(--neutral-0) / 70%) 96%, rgb(var(--orange-500)) 4%);
}

[data-workspace="actions"] .glass-raised,
[data-workspace="actions"] .glass-floating {
  background: color-mix(in srgb, rgb(var(--neutral-0) / 70%) 96%, rgb(var(--red-500)) 4%);
}
```

- [ ] **Step 4: Consolidate spring tokens in admin index.css**

In `packages/admin/src/index.css`, update the existing spring tokens section (around line 173) to include the full library:

```css
  /* Spring animation tokens — full M3+Liquid library */
  --spring-micro-easing: cubic-bezier(0.2, 0, 0, 1);
  --spring-micro-duration: 150ms;
  --spring-fast-easing: cubic-bezier(0.34, 1.56, 0.64, 1);
  --spring-fast-duration: 200ms;
  --spring-medium-easing: cubic-bezier(0.16, 1, 0.3, 1);
  --spring-medium-duration: 300ms;
  --spring-slow-easing: cubic-bezier(0.16, 1, 0.3, 1);
  --spring-slow-duration: 400ms;
  --spring-dramatic-easing: cubic-bezier(0.16, 1, 0.3, 1);
  --spring-dramatic-duration: 500ms;
```

Keep the existing `--spring-spatial-*` aliases pointing to the same values for backward compatibility until all references are migrated.

- [ ] **Step 5: Verify build**

Run: `cd packages/admin && bun build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/styles/utilities.css packages/admin/src/index.css
git commit -m "feat(shared,admin): shape tokens, glass tiers, and spring motion library"
```

---

## Wave 2: Structural Cleanup — New Hooks + DOMAIN_CONFIG

### Task 4: DOMAIN_CONFIG + DomainBadge

**Files:**
- Create: `packages/shared/src/config/domain.ts`
- Create: `packages/shared/src/components/DomainBadge.tsx`
- Modify: `packages/shared/src/index.ts` (export new files)

- [ ] **Step 1: Create DOMAIN_CONFIG**

Create `packages/shared/src/config/domain.ts`:

```typescript
import type { ComponentType, SVGProps } from "react";
import { RiBookOpenLine, RiPlantLine, RiRecycleLine, RiSunLine } from "@remixicon/react";
import { Domain } from "../types";

export interface DomainStyle {
  icon: ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;
  labelId: string;
  colors: {
    bg: string;
    text: string;
    border: string;
  };
  gradient: {
    from: string;
    to: string;
  };
}

export const DOMAIN_CONFIG: Record<Domain, DomainStyle> = {
  [Domain.SOLAR]: {
    icon: RiSunLine,
    labelId: "app.domain.tab.solar",
    colors: {
      bg: "bg-warning-lighter",
      text: "text-warning-dark",
      border: "border-warning-light",
    },
    gradient: {
      from: "from-yellow-100",
      to: "to-yellow-50",
    },
  },
  [Domain.AGRO]: {
    icon: RiPlantLine,
    labelId: "app.domain.tab.agro",
    colors: {
      bg: "bg-success-lighter",
      text: "text-success-dark",
      border: "border-success-light",
    },
    gradient: {
      from: "from-green-100",
      to: "to-green-50",
    },
  },
  [Domain.EDU]: {
    icon: RiBookOpenLine,
    labelId: "app.domain.tab.education",
    colors: {
      bg: "bg-information-lighter",
      text: "text-information-dark",
      border: "border-information-light",
    },
    gradient: {
      from: "from-blue-100",
      to: "to-blue-50",
    },
  },
  [Domain.WASTE]: {
    icon: RiRecycleLine,
    labelId: "app.domain.tab.waste",
    colors: {
      bg: "bg-warning-lighter",
      text: "text-warning-dark",
      border: "border-warning-light",
    },
    gradient: {
      from: "from-orange-100",
      to: "to-orange-50",
    },
  },
};
```

- [ ] **Step 2: Create DomainBadge component**

Create `packages/shared/src/components/DomainBadge.tsx`:

```typescript
import { type Domain, cn } from "../index";
import { DOMAIN_CONFIG } from "../config/domain";
import { useIntl } from "react-intl";

interface DomainBadgeProps {
  domain: Domain;
  size?: "sm" | "md";
  className?: string;
}

export function DomainBadge({ domain, size = "sm", className }: DomainBadgeProps) {
  const { formatMessage } = useIntl();
  const config = DOMAIN_CONFIG[domain];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium backdrop-blur-md",
        config.colors.bg,
        config.colors.text,
        size === "sm" ? "px-2.5 py-1 text-label-sm" : "px-3 py-1.5 text-label-md",
        className,
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {formatMessage({ id: config.labelId })}
    </span>
  );
}
```

- [ ] **Step 3: Export from shared index**

In `packages/shared/src/index.ts`, add exports:

```typescript
export { DOMAIN_CONFIG, type DomainStyle } from "./config/domain";
export { DomainBadge } from "./components/DomainBadge";
```

- [ ] **Step 4: Verify build**

Run: `cd packages/shared && bun build && cd ../admin && bun build`
Expected: Both build successfully.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/config/domain.ts packages/shared/src/components/DomainBadge.tsx packages/shared/src/index.ts
git commit -m "feat(shared): add DOMAIN_CONFIG and DomainBadge component"
```

---

### Task 5: useContainerQuery + useSheetWidth Hooks

**Files:**
- Create: `packages/shared/src/hooks/useContainerQuery.ts`
- Create: `packages/shared/src/hooks/useSheetWidth.ts`
- Modify: `packages/shared/src/hooks/index.ts` (export hooks)
- Modify: `packages/shared/src/index.ts` (export hooks)

- [ ] **Step 1: Create useContainerQuery hook**

Create `packages/shared/src/hooks/useContainerQuery.ts`:

```typescript
import { useEffect, useRef, useState } from "react";

/**
 * Returns the current width of a container element via ResizeObserver.
 * Use instead of useMediaQuery when layout depends on container width, not viewport.
 */
export function useContainerQuery<T extends HTMLElement = HTMLDivElement>(
  breakpoint: number,
): { ref: React.RefObject<T | null>; matches: boolean; width: number } {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });

    observer.observe(element);
    setWidth(element.getBoundingClientRect().width);

    return () => observer.disconnect();
  }, []);

  return { ref, matches: width >= breakpoint, width };
}
```

- [ ] **Step 2: Create useSheetWidth hook**

Create `packages/shared/src/hooks/useSheetWidth.ts`:

```typescript
import { useMemo } from "react";
import { useContainerQuery } from "./useContainerQuery";

/**
 * Computes responsive sheet width based on canvas container width.
 * Replaces duplicated `desktopSheetWidth` calculations in view files.
 */
export function useSheetWidth() {
  const { ref, width } = useContainerQuery<HTMLDivElement>(600);

  const sheetWidth = useMemo(() => {
    if (width === 0) return 560; // SSR fallback
    return Math.min(Math.max(440, width * 0.38), 660);
  }, [width]);

  const isDesktop = width >= 600;

  return { containerRef: ref, sheetWidth, isDesktop };
}
```

- [ ] **Step 3: Export hooks from hooks/index.ts**

In `packages/shared/src/hooks/index.ts`, add:

```typescript
export { useContainerQuery } from "./useContainerQuery";
export { useSheetWidth } from "./useSheetWidth";
```

- [ ] **Step 4: Export hooks from shared index.ts**

In `packages/shared/src/index.ts`, add:

```typescript
export { useContainerQuery } from "./hooks/useContainerQuery";
export { useSheetWidth } from "./hooks/useSheetWidth";
```

- [ ] **Step 5: Verify build**

Run: `cd packages/shared && bun build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/hooks/useContainerQuery.ts packages/shared/src/hooks/useSheetWidth.ts packages/shared/src/hooks/index.ts packages/shared/src/index.ts
git commit -m "feat(shared): add useContainerQuery and useSheetWidth hooks"
```

---

## Wave 3: Foundation Component Migration

### Task 6: Surface Glass Variants

**Files:**
- Modify: `packages/shared/src/components/Surface/Surface.tsx:23-62` (surfaceVariants)

- [ ] **Step 1: Update surfaceVariants with glass + solid options**

In `packages/shared/src/components/Surface/Surface.tsx`, replace the `elevation` variant in `surfaceVariants`:

```typescript
export const surfaceVariants = tv({
  base: "rounded-xl",
  variants: {
    elevation: {
      // Glass tiers (M3 + Liquid)
      ground: "glass-ground",
      raised: "glass-raised",
      floating: "glass-floating",
      overlay: "glass-overlay",
      // Solid variants (for non-glass contexts: form content, data tables)
      "solid-ground": "bg-bg-weak shadow-[var(--edge-rest)]",
      "solid-raised": "bg-bg-white shadow-[var(--edge-rest),_var(--elevation-1)]",
      "solid-floating": "bg-bg-white shadow-[var(--edge-rest),_var(--elevation-3)]",
      "solid-overlay": "bg-bg-white shadow-elevation-5",
    },
    padding: {
      none: "",
      compact: "p-3",
      default: "p-4 sm:p-5",
      spacious: "p-6 sm:p-8",
    },
    radius: {
      sm: "rounded-sm",
      md: "rounded-md",
      lg: "rounded-lg",
      xl: "rounded-xl",
    },
    interactive: {
      true: [
        "cursor-pointer",
        "transition-[box-shadow,transform] duration-[var(--spring-fast-duration)] ease-[var(--spring-fast-easing)]",
        "hover:-translate-y-0.5 hover:shadow-[var(--edge-hover),_var(--elevation-2)]",
        "active:translate-y-0 active:scale-[0.992]",
      ].join(" "),
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

- [ ] **Step 2: Run existing tests**

Run: `cd packages/shared && bun run test -- --run`
Expected: All existing tests pass (Surface tests should still work since the variant names `ground`, `raised`, `floating`, `overlay` are unchanged).

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/components/Surface/Surface.tsx
git commit -m "feat(shared): add glass elevation variants to Surface component"
```

---

### Task 7: Button + Badge + StatusBadge Token Alignment

**Files:**
- Modify: `packages/shared/src/components/Button.tsx:6-32`
- Modify: `packages/shared/src/components/Badge.tsx`
- Modify: `packages/shared/src/components/StatusBadge.tsx`

- [ ] **Step 1: Update Button variants**

In `packages/shared/src/components/Button.tsx`, update `buttonVariants`:

```typescript
export const buttonVariants = tv({
  base: [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm font-medium",
    "transition-all duration-[var(--spring-fast-duration,200ms)] ease-[var(--spring-fast-easing,ease-out)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ws-primary,var(--primary-base)))] focus-visible:ring-offset-2",
    "active:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  variants: {
    variant: {
      primary: "bg-[rgb(var(--ws-primary,var(--primary-base)))] text-[rgb(var(--ws-on-primary,var(--primary-foreground)))] hover:brightness-90",
      secondary: "border border-stroke-soft bg-bg-white text-text-strong hover:border-stroke-sub hover:bg-bg-soft",
      ghost: "text-text-sub hover:bg-bg-soft hover:text-text-strong",
      danger: "bg-error-base text-destructive-foreground hover:bg-error-dark",
    },
    size: {
      sm: "h-8 px-3 text-label-sm",
      md: "h-10 px-4 text-label-lg",
      lg: "h-12 px-6 text-body-lg",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});
```

Key changes: `rounded-lg` → `rounded-sm` (8px), size text uses type scale tokens, primary uses `--ws-primary` with fallback, focus ring uses workspace color, transition uses spring token.

- [ ] **Step 2: Update Badge shape and typography**

In `packages/shared/src/components/Badge.tsx`, update the variant definition. Change:
- `rounded-full` → `rounded-md` (12px)
- Font size classes → `text-label-sm`
- Keep: all color variants

- [ ] **Step 3: Verify StatusBadge uses semantic tokens**

In `packages/shared/src/components/StatusBadge.tsx`, verify all color references use semantic tokens (e.g., `bg-success-lighter`, `text-error-dark`). Update any raw color references to semantic tokens. Change `rounded-full` to stay (badges are pills). Ensure `text-xs` → `text-label-sm` and `text-sm` → `text-label-md`.

- [ ] **Step 4: Run tests**

Run: `cd packages/shared && bun run test -- --run`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/components/Button.tsx packages/shared/src/components/Badge.tsx packages/shared/src/components/StatusBadge.tsx
git commit -m "feat(shared): align Button, Badge, StatusBadge to M3 tokens"
```

---

### Task 8: Card, StatCard, EmptyState, ListToolbar

**Files:**
- Modify: `packages/shared/src/components/Cards/CardBase.tsx`
- Modify: `packages/shared/src/components/StatCard.tsx`
- Modify: `packages/shared/src/components/ListPrimitives.tsx`

- [ ] **Step 1: Update CardBase surfaceCardVariants**

In `packages/shared/src/components/Cards/CardBase.tsx`, update `surfaceCardVariants` (around line 94):

```typescript
export const surfaceCardVariants = tv({
  base: "rounded-lg glass-raised",
  variants: {
    variant: {
      default: "",
      interactive: [
        "cursor-pointer",
        "transition-[box-shadow,transform] duration-[var(--spring-fast-duration,200ms)] ease-[var(--spring-fast-easing)]",
        "hover:shadow-[var(--edge-hover),_var(--elevation-2)] hover:-translate-y-0.5",
        "active:translate-y-0 active:scale-[0.992]",
      ].join(" "),
    },
    padding: {
      compact: "p-4",
      feature: "p-6",
      none: "",
    },
  },
  defaultVariants: {
    variant: "default",
    padding: "compact",
  },
});
```

Also update `Card.Header` title typography to reference `text-title-md` and `Card.Body` description to `text-body-md`.

- [ ] **Step 2: Update StatCard**

In `packages/shared/src/components/StatCard.tsx`, update the card class (around line 72):

Replace:
```
"block rounded-xl border border-stroke-soft bg-bg-white p-3 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 sm:p-4"
```

With:
```
"block rounded-lg glass-raised p-3 transition-all duration-[var(--spring-fast-duration)] ease-[var(--spring-fast-easing)] hover:shadow-[var(--edge-hover),_var(--elevation-2)] hover:-translate-y-0.5 sm:p-4"
```

Update typography: value display → `text-headline-sm font-semibold`, label → `text-label-md`.

- [ ] **Step 3: Update EmptyState and ListToolbar**

In `packages/shared/src/components/ListPrimitives.tsx`:

**EmptyState** — update icon container:
```
"mb-4 flex h-16 w-16 items-center justify-center rounded-full glass-raised text-text-soft"
```

Update title: `"text-title-md text-text-strong"`, description: `"mt-1 max-w-sm text-body-md text-text-sub"`.

**ListToolbar** — update search input:
```
"h-9 w-full rounded-sm border-0 bg-bg-white pl-9 pr-8 text-body-md shadow-[var(--edge-rest)] focus:shadow-[var(--edge-focus)] transition-shadow duration-[var(--spring-micro-duration)]"
```

- [ ] **Step 4: Run tests**

Run: `cd packages/shared && bun run test -- --run`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/components/Cards/CardBase.tsx packages/shared/src/components/StatCard.tsx packages/shared/src/components/ListPrimitives.tsx
git commit -m "feat(shared): glass + M3 tokens for Card, StatCard, EmptyState, ListToolbar"
```

---

### Task 9: NavigationBar + TopContextBar (Shell Chrome)

**Files:**
- Modify: `packages/shared/src/components/Canvas/NavigationBar.tsx`
- Modify: `packages/shared/src/components/Canvas/TopContextBar.tsx`

- [ ] **Step 1: Update NavigationBar**

In `packages/shared/src/components/Canvas/NavigationBar.tsx`:

**Desktop nav bar** — replace the gradient background class:
- Replace `linear-gradient(180deg,rgba(255,255,255,0.78)_0%,rgba(245,248,252,0.66)_100%)` with `glass-ground`
- Replace `rounded-[1.9rem]` with `rounded-2xl`
- Replace `border-white/64` with remove (glass-ground provides its own inset border)
- Replace `backdrop-blur-xl` with remove (glass-ground includes blur)
- Replace `animate-[nav-bar-enter_300ms_cubic-bezier(0.16,1,0.3,1)_both]` with `animate-[nav-bar-enter_var(--spring-medium-duration,300ms)_var(--spring-medium-easing,cubic-bezier(0.16,1,0.3,1))_both]`

**Mobile nav bar** — same glass-ground treatment:
- Replace gradient with `glass-ground`
- Replace `rounded-[1.6rem]` with `rounded-2xl`

**Active NavItem** — replace:
- `bg-[rgb(var(--workspace-tint,59_130_246)/0.14)]` with `bg-[rgb(var(--ws-primary-container,var(--blue-100)))]`
- `text-[rgb(var(--workspace-accent,37_99_235))]` with `text-[rgb(var(--ws-on-primary-container,var(--blue-900)))]`

**FAB** — replace gradient:
- `linear-gradient(135deg,rgba(var(--workspace-accent,...),1)_0%,...)` with `bg-[rgb(var(--ws-primary,var(--primary-base)))] text-[rgb(var(--ws-on-primary,255_255_255))]`

- [ ] **Step 2: Update TopContextBar**

In `packages/shared/src/components/Canvas/TopContextBar.tsx`:

**Icon button constant** (`ICON_BTN`): Replace with:
```typescript
const ICON_BTN = "flex h-10 w-10 items-center justify-center rounded-sm text-text-sub hover:glass-raised active:scale-95 transition-all duration-[var(--spring-micro-duration,150ms)] ease-[var(--spring-micro-easing)] focus-visible:ring-2 focus-visible:ring-[rgb(var(--ws-primary,var(--primary-base)))]";
```

**Sheet context label**: Change `text-sm font-medium` → `text-title-md`.

**Header container**: Keep `bg-transparent` — the scroll-triggered glass effect is a separate task (requires scroll detection logic). For now, keep transparent. Add a TODO comment for scroll glass behavior.

- [ ] **Step 3: Run tests**

Run: `cd packages/shared && bun run test -- --run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/components/Canvas/NavigationBar.tsx packages/shared/src/components/Canvas/TopContextBar.tsx
git commit -m "feat(shared): glass-ground shell chrome for NavigationBar and TopContextBar"
```

---

### Task 10: SideSheet + BottomSheet (Workspace Glass)

**Files:**
- Modify: `packages/shared/src/components/Canvas/SideSheet.tsx`
- Modify: `packages/shared/src/components/Canvas/BottomSheet.tsx`

- [ ] **Step 1: Update SideSheet**

In `packages/shared/src/components/Canvas/SideSheet.tsx`:

**Content panel** — replace the gradient background:
- Replace `linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(247,249,252,0.9)_100%)` with `glass-floating`
- Replace `border-white/66` with remove (glass-floating provides inset border)
- Replace `rounded-l-[1.5rem]` / `rounded-r-[1.5rem]` with `rounded-l-xl` / `rounded-r-xl`
- Replace hardcoded shadow `-18px 0 40px rgba(15,23,42,0.16), inset 1px 0 0 rgba(255,255,255,0.7)` with `var(--elevation-4)`
- Replace animation `duration-[260ms]` with `duration-[var(--spring-medium-duration,300ms)]`

**Overlay** — replace:
- `bg-[rgba(8,15,28,0.18)]` with `bg-neutral-950/18`
- `backdrop-blur-[2px]` with `backdrop-blur-sm`

- [ ] **Step 2: Update BottomSheet**

In `packages/shared/src/components/Canvas/BottomSheet.tsx`:

**Content panel** — replace the gradient background:
- Replace `linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,252,0.9)_100%)` with `glass-floating`
- Replace `rounded-t-[1.6rem]` with `rounded-t-xl`
- Replace `border-white/66 border-b-0` with remove (glass-floating provides inset border)
- Replace hardcoded shadow `0 -24px 48px rgba(15,23,42,0.18)` with `var(--elevation-4)`
- Replace animation `duration-[420ms]` with `duration-[var(--spring-slow-duration,400ms)]`

**Drag handle**: Replace `bg-[rgb(var(--workspace-tint,59_130_246)/0.32)]` with `bg-[rgb(var(--ws-primary,var(--primary-base))/0.32)]`.

**Overlay**: Same as SideSheet — `bg-neutral-950/18 backdrop-blur-sm`.

- [ ] **Step 3: Run tests**

Run: `cd packages/shared && bun run test -- --run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/components/Canvas/SideSheet.tsx packages/shared/src/components/Canvas/BottomSheet.tsx
git commit -m "feat(shared): glass-floating workspace chrome for SideSheet and BottomSheet"
```

---

### Task 11: CanvasScaffold — TabRail Sliding + WorkbenchRow Glass

**Files:**
- Modify: `packages/shared/src/components/Canvas/CanvasScaffold.tsx`

- [ ] **Step 1: Update CanvasStageTabRail active styling**

In `packages/shared/src/components/Canvas/CanvasScaffold.tsx`, find the `CanvasStageTabRail` component (around line 57). The animated background slider already exists (lines 83-100).

Update the slider's styling to use workspace tokens:
- Replace any hardcoded background color with `bg-[rgb(var(--ws-primary-container,var(--blue-100)))]`
- Ensure the slider transition uses `var(--spring-medium-duration)` and `var(--spring-medium-easing)`

Update active tab text:
- Active: `text-[rgb(var(--ws-on-primary-container,var(--blue-900)))]`
- Inactive: `text-text-sub`

Update tab shape:
- Individual tabs: `rounded-md`
- Rail container: `rounded-lg`

- [ ] **Step 2: Update CanvasWorkbenchList**

Find `CanvasWorkbenchList` (around line 150). Replace:
- `rounded-[1.35rem]` with `rounded-xl`
- `bg-[linear-gradient(...)]` with `glass-raised`
- `boxShadow: "var(--edge-rest), 0 8px 22px rgba(133, 109, 70, 0.08)"` with `boxShadow: "var(--edge-rest), var(--elevation-1)"`

- [ ] **Step 3: Update CanvasWorkbenchRow**

Find `CanvasWorkbenchRow` (around line 198). Update:
- Typography: eyebrow → `text-label-sm`, title → `text-title-md`, description → `text-body-md`, meta → `text-body-sm`
- Hover: align to standard card hover lift with `spring-fast` timing
- Selected state: use `bg-[rgb(var(--ws-primary-container)/0.12)]` instead of hardcoded gradient

- [ ] **Step 4: Run tests**

Run: `cd packages/shared && bun run test -- --run`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/components/Canvas/CanvasScaffold.tsx
git commit -m "feat(shared): M3 tab sliding, glass workbench, workspace tokens in CanvasScaffold"
```

---

### Task 12: GardenChip + Dialog + Form Tokens

**Files:**
- Modify: `packages/shared/src/components/Canvas/GardenChip.tsx`
- Modify: `packages/shared/src/components/Dialog/ConfirmDialog.tsx`
- Modify: `packages/shared/src/components/Form/FormInput.tsx`
- Modify: `packages/shared/src/components/Form/FormFieldWrapper.tsx`

- [ ] **Step 1: Update GardenChip**

In `packages/shared/src/components/Canvas/GardenChip.tsx`:

**Static chip**: Replace:
- `bg-bg-white/80 backdrop-blur-sm supports-[backdrop-filter]:bg-bg-white/60` with `glass-raised`
- `shadow-[var(--edge-rest),_var(--elevation-1)]` → keep (already uses tokens)
- `text-sm font-medium` → `text-label-lg font-medium`

**Interactive chip hover**: Update transition to `duration-[var(--spring-micro-duration)]`.

**Popover**: Replace:
- `rounded-xl bg-bg-white p-1 shadow-[var(--edge-rest),_var(--elevation-4)]` with `rounded-xl glass-floating p-1 shadow-[var(--elevation-4)]`
- Dropdown item text: `text-sm` → `text-body-md`

- [ ] **Step 2: Update DialogShell**

In `packages/shared/src/components/Dialog/ConfirmDialog.tsx`:

**Content panel**: Replace:
- `bg-bg-white shadow-elevation-5` with `glass-floating`
- Keep responsive radius (`rounded-t-2xl` mobile, `rounded-2xl` desktop) — but update to `rounded-t-xl` mobile, `rounded-xl` desktop.
- Title typography: ensure it uses `text-title-lg`
- Body typography: ensure it uses `text-body-lg`

**Overlay**: Replace `bg-overlay backdrop-blur-sm` with `bg-neutral-950/18 backdrop-blur-sm` (consistent with sheets).

- [ ] **Step 3: Update FormInput**

In `packages/shared/src/components/Form/FormInput.tsx`:

Replace input className (around line 37):
```
"block w-full bg-bg-white-0 rounded-sm py-3 px-4"
"text-body-lg text-text-strong-950 placeholder:text-text-soft-400"
"shadow-[var(--edge-rest)] transition-shadow duration-[var(--spring-micro-duration)]"
"focus-visible:shadow-[var(--edge-focus)]"
```

Remove `border border-stroke-sub-300` (shadow-as-border replaces CSS border).

Error state: `shadow-[0_0_0_1px_rgb(var(--error-base))] focus-visible:shadow-[0_0_0_3px_rgb(var(--error-lighter))]`

- [ ] **Step 4: Update FormFieldWrapper**

In `packages/shared/src/components/Form/FormFieldWrapper.tsx`:

Update label: `text-label-lg font-medium text-text-strong-950` (was `font-semibold text-text-strong-950 text-label-sm`).
Update error text: `text-body-sm text-error-dark` (was `text-xs`).
Update helper text: `text-body-sm text-text-sub-600` (was `text-xs`).

- [ ] **Step 5: Run tests**

Run: `cd packages/shared && bun run test -- --run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/components/Canvas/GardenChip.tsx packages/shared/src/components/Dialog/ConfirmDialog.tsx packages/shared/src/components/Form/FormInput.tsx packages/shared/src/components/Form/FormFieldWrapper.tsx
git commit -m "feat(shared): glass + M3 tokens for GardenChip, Dialog, Form inputs"
```

---

### Task 13: PageHeader + CommandPalette (Admin Layout)

**Files:**
- Modify: `packages/admin/src/components/Layout/PageHeader.tsx`
- Modify: `packages/admin/src/components/Layout/CommandPalette.tsx`

- [ ] **Step 1: Update PageHeader canvas variant**

In `packages/admin/src/components/Layout/PageHeader.tsx`:

For the `canvas` variant:
- Background: replace any hardcoded gradient with `glass-ground` + workspace surface-variant:
  ```
  className="glass-ground bg-[rgb(var(--ws-surface-variant,var(--neutral-50)))/40%]"
  ```
- Title: replace the current font class with `text-headline-lg font-semibold text-text-strong`
- Description: replace with `text-body-lg text-text-sub`

For the `default` variant:
- Keep minimal — just ensure typography uses `text-headline-lg` for title.

- [ ] **Step 2: Update CommandPalette**

In `packages/admin/src/components/Layout/CommandPalette.tsx`:

**Dialog content container**: Add `glass-overlay` class, replace any `bg-bg-white` with remove (glass-overlay handles it). Shape: `rounded-xl`.

**Search input**: Replace:
```
"h-9 w-full rounded-lg border border-stroke-soft bg-bg-white pl-9 pr-8 text-sm focus:border-primary-base focus:ring-1"
```
With:
```
"h-10 w-full rounded-sm bg-transparent pl-9 pr-8 text-body-lg shadow-[var(--edge-rest)] focus:shadow-[var(--edge-focus)] transition-shadow duration-[var(--spring-micro-duration)]"
```

**Result items**: Add `hover:glass-raised rounded-sm` for hover state. Text: `text-body-md`.

- [ ] **Step 3: Run tests**

Run: `cd packages/admin && bun run test -- --run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/admin/src/components/Layout/PageHeader.tsx packages/admin/src/components/Layout/CommandPalette.tsx
git commit -m "feat(admin): glass + M3 tokens for PageHeader and CommandPalette"
```

---

## Wave 4: View Migration

### Task 14: Hub — HubWorkCard + DomainBadge Migration

**Files:**
- Modify: `packages/admin/src/views/Hub/components/HubWorkCard.tsx`

- [ ] **Step 1: Replace domain badge definitions with DomainBadge**

In `packages/admin/src/views/Hub/components/HubWorkCard.tsx`:

Remove the `DOMAIN_BADGE_STYLES` constant and `DomainBadgeStyle` interface (lines 16-32). Import DomainBadge and DOMAIN_CONFIG instead:

```typescript
import {
  type Domain,
  DOMAIN_CONFIG,
  DomainBadge,
  cn,
  formatRelativeTime,
  resolveIPFSUrl,
  type Work,
} from "@green-goods/shared";
```

Remove the `DOMAIN_LABEL_IDS` import if it was only used for the badge.

- [ ] **Step 2: Replace DOMAIN_GRADIENT_STYLES with DOMAIN_CONFIG**

Replace lines 38-43:

```typescript
function DomainGradientFallback({ domain, className }: { domain?: Domain; className?: string }) {
  const config = domain !== undefined ? DOMAIN_CONFIG[domain] : undefined;
  const gradientClasses = config
    ? `${config.gradient.from} ${config.gradient.to}`
    : "from-gray-100 to-gray-50";

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-gradient-to-br",
        gradientClasses,
        className,
      )}
    >
      {config && <config.icon className="h-8 w-8 opacity-30" />}
    </div>
  );
}
```

- [ ] **Step 3: Restyle HubWorkCard with glass + tokens**

Replace the main button className (around line 148):

```typescript
<button
  type="button"
  onClick={onClick}
  className={cn(
    "group w-full cursor-pointer overflow-hidden rounded-xl text-left",
    "glass-raised",
    "shadow-[var(--edge-rest),_var(--elevation-1)]",
    "transition-[transform,box-shadow] duration-[var(--spring-fast-duration)] ease-[var(--spring-fast-easing)]",
    "hover:-translate-y-0.5 hover:shadow-[var(--edge-hover),_var(--elevation-2)]",
    "active:translate-y-0 active:scale-[0.992]",
    "motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 motion-reduce:active:scale-100 motion-reduce:transition-none",
    "outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ws-primary,var(--primary-base)))] focus-visible:ring-offset-2",
  )}
>
```

- [ ] **Step 4: Update typography inside HubWorkCard**

Replace typography classes:
- Title (line ~247): `text-sm font-semibold leading-5 text-text-strong line-clamp-2 sm:text-[0.95rem]` → `text-title-sm font-semibold leading-5 text-text-strong line-clamp-2`
- Timestamp (line ~250): `text-[11px] font-medium uppercase tracking-[0.08em] text-text-soft` → `text-label-sm font-medium uppercase text-text-soft`
- Gardener name (line ~258): `truncate font-medium text-text-sub` → `truncate text-body-sm font-medium text-text-sub`
- Garden name (line ~259): `truncate text-text-soft` → `truncate text-body-sm text-text-soft`
- Meta text (line ~260): `text-xs text-text-sub` → `text-body-sm text-text-sub`
- Review badge (line ~261): `text-[11px] font-medium` → `text-label-sm font-medium`

- [ ] **Step 5: Replace inline badge with DomainBadge**

Replace the badge rendering (around line 218) with:

```tsx
{actionDomain !== undefined && (
  <DomainBadge domain={actionDomain} size="sm" className="absolute bottom-2 left-2" />
)}
```

- [ ] **Step 6: Run tests**

Run: `cd packages/admin && bun run test -- --run`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/admin/src/views/Hub/components/HubWorkCard.tsx
git commit -m "feat(admin): glass + M3 tokens + DomainBadge for HubWorkCard"
```

---

### Task 15: Actions View — DOMAIN_CONFIG + Filter Chips + Skeleton

**Files:**
- Modify: `packages/admin/src/views/Actions/index.tsx`

- [ ] **Step 1: Replace DOMAIN_TAGS with DOMAIN_CONFIG**

In `packages/admin/src/views/Actions/index.tsx`:

Replace the `DOMAIN_TAGS` constant (lines 28-49) and import `DOMAIN_CONFIG` from shared:

```typescript
import {
  // ... existing imports
  DOMAIN_CONFIG,
  DomainBadge,
} from "@green-goods/shared";
```

Replace `DOMAIN_TAGS` usage in the filter chips (around line 232). Create a derived array from DOMAIN_CONFIG:

```typescript
const DOMAIN_FILTER_OPTIONS = Object.entries(DOMAIN_CONFIG).map(([key, config]) => ({
  value: Number(key) as Domain,
  labelId: config.labelId,
  colors: config.colors,
}));
```

- [ ] **Step 2: Restyle filter chips to M3 spec**

Update the filter chip button (around line 240):

```tsx
<button
  key={tag.value}
  type="button"
  onClick={() => toggleDomain(tag.value)}
  className={cn(
    "group inline-flex items-center gap-1 rounded-sm px-3 py-1.5 text-label-lg font-medium",
    "transition-colors duration-[var(--spring-micro-duration)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ws-primary))]",
    isActive
      ? "bg-[rgb(var(--ws-primary-container))] text-[rgb(var(--ws-on-primary-container))]"
      : "glass-ground text-text-sub hover:bg-bg-soft",
  )}
  aria-pressed={isActive}
>
  {isActive && <RiCheckLine className="h-3.5 w-3.5" aria-hidden="true" />}
  {intl.formatMessage({ id: tag.labelId })}
</button>
```

- [ ] **Step 3: Standardize skeleton loading**

Replace the loading skeleton (around line 263):

```tsx
{isLoading ? (
  <div className="canvas-route-shell space-y-3" role="status" aria-live="polite">
    <span className="sr-only">
      {intl.formatMessage({ id: "admin.actions.loadingMessage", defaultMessage: "Loading actions..." })}
    </span>
    {Array.from({ length: 6 }).map((_, index) => (
      <div
        key={`action-skeleton-${index}`}
        className="h-20 rounded-sm skeleton-shimmer"
        style={{ animationDelay: `${index * 0.05}s` }}
      />
    ))}
  </div>
) : null}
```

Changes: `h-24` → `h-20`, `rounded-xl` → `rounded-sm`, delay `0.06s` → `0.05s`.

- [ ] **Step 4: Run tests**

Run: `cd packages/admin && bun run test -- --run`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/admin/src/views/Actions/index.tsx
git commit -m "feat(admin): M3 filter chips, DOMAIN_CONFIG, unified skeleton in Actions view"
```

---

### Task 16: Garden + Community Views — Container Queries + Skeleton

**Files:**
- Modify: `packages/admin/src/views/Garden/index.tsx`
- Modify: `packages/admin/src/views/Community/index.tsx`

- [ ] **Step 1: Migrate Garden view to useSheetWidth**

In `packages/admin/src/views/Garden/index.tsx`:

Remove the inline `useMediaQuery` function definition (lines 43-54). Remove the `isDesktop` and `desktopSheetWidth` local variables.

Import and use the new hook:

```typescript
import { useSheetWidth } from "@green-goods/shared";
```

Replace:
```typescript
const isDesktop = useMediaQuery("(min-width: 600px)");
const desktopSheetWidth = typeof window === "undefined" ? 560 : Math.min(Math.max(440, window.innerWidth * 0.38), 660);
```

With:
```typescript
const { containerRef, sheetWidth, isDesktop } = useSheetWidth();
```

Wrap the main content `<div>` with the container ref:
```tsx
<div ref={containerRef} className="pb-6">
```

Replace `desktopSheetWidth` references with `sheetWidth`.

- [ ] **Step 2: Standardize Garden skeleton**

Replace the loading skeleton grid (around line 211):

```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2" role="status" aria-live="polite">
  <div className="h-36 rounded-lg skeleton-shimmer" />
  <div className="h-36 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.05s" }} />
  <div className="h-64 rounded-lg skeleton-shimmer sm:col-span-2" style={{ animationDelay: "0.1s" }} />
</div>
```

Changes: `lg:grid-cols-2` → `sm:grid-cols-2`, `h-40` → `h-36`, `h-72` → `h-64`, `rounded-lg` stays, delays aligned to `0.05s` increment, `lg:col-span-2` → `sm:col-span-2`.

- [ ] **Step 3: Migrate Community view to useSheetWidth**

In `packages/admin/src/views/Community/index.tsx`:

Same migration as Garden — remove inline `useMediaQuery`, import `useSheetWidth`, wrap with `containerRef`, replace `desktopSheetWidth` with `sheetWidth`.

- [ ] **Step 4: Standardize Community skeleton**

Same skeleton pattern as Garden:

```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2" role="status" aria-live="polite">
  <div className="h-36 rounded-lg skeleton-shimmer" />
  <div className="h-36 rounded-lg skeleton-shimmer" style={{ animationDelay: "0.05s" }} />
  <div className="h-64 rounded-lg skeleton-shimmer sm:col-span-2" style={{ animationDelay: "0.1s" }} />
</div>
```

- [ ] **Step 5: Run tests**

Run: `cd packages/admin && bun run test -- --run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/admin/src/views/Garden/index.tsx packages/admin/src/views/Community/index.tsx
git commit -m "refactor(admin): container queries, useSheetWidth, unified skeletons in Garden+Community"
```

---

### Task 17: Verify Workspace Data Attribute + Stagger Upgrade

**Files:**
- Modify: `packages/admin/src/components/Layout/CanvasLayout.tsx` (verify/add data-workspace)
- Modify: `packages/shared/src/styles/utilities.css` (upgrade stagger animation)

- [ ] **Step 1: Verify CanvasLayout sets data-workspace**

In `packages/admin/src/components/Layout/CanvasLayout.tsx`, check if `data-workspace` is already set on route change. If not, add it. The workspace value should be derived from the current route:

```typescript
// Inside CanvasLayout, derive workspace from current path
const location = useLocation();
const workspace = useMemo(() => {
  if (location.pathname.startsWith("/garden")) return "garden";
  if (location.pathname.startsWith("/community")) return "community";
  if (location.pathname.startsWith("/actions")) return "actions";
  return "hub"; // default
}, [location.pathname]);
```

Set it on the outermost element:
```tsx
<div data-workspace={workspace} className="...existing classes...">
```

If `data-workspace` already exists via another mechanism (e.g., the existing `--workspace-tint` CSS variable setter), ensure the attribute name matches what the CSS rulesets in Task 1 target: `[data-workspace="hub"]`.

- [ ] **Step 2: Upgrade stagger animation**

In `packages/shared/src/styles/utilities.css`, update the stagger animation section (around line 134):

Replace:
```css
  .animate-stagger-in > * {
    opacity: 0;
    animation: stagger-fade-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
```

With:
```css
  @keyframes stagger-fade-in {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .animate-stagger-in > * {
    opacity: 0;
    animation: stagger-fade-in var(--spring-dramatic-duration, 500ms) var(--spring-dramatic-easing, cubic-bezier(0.16, 1, 0.3, 1)) both;
  }
```

Update delays from `40ms` to `50ms` and extend to 12 children:
```css
  .animate-stagger-in > *:nth-child(1) { animation-delay: 0ms; }
  .animate-stagger-in > *:nth-child(2) { animation-delay: 50ms; }
  .animate-stagger-in > *:nth-child(3) { animation-delay: 100ms; }
  .animate-stagger-in > *:nth-child(4) { animation-delay: 150ms; }
  .animate-stagger-in > *:nth-child(5) { animation-delay: 200ms; }
  .animate-stagger-in > *:nth-child(6) { animation-delay: 250ms; }
  .animate-stagger-in > *:nth-child(7) { animation-delay: 300ms; }
  .animate-stagger-in > *:nth-child(8) { animation-delay: 350ms; }
  .animate-stagger-in > *:nth-child(9) { animation-delay: 400ms; }
  .animate-stagger-in > *:nth-child(10) { animation-delay: 450ms; }
  .animate-stagger-in > *:nth-child(11) { animation-delay: 500ms; }
  .animate-stagger-in > *:nth-child(n+12) { animation-delay: 550ms; }
```

- [ ] **Step 3: Run full test suite**

Run: `bun run test`
Expected: All tests across all packages pass.

- [ ] **Step 4: Commit**

```bash
git add packages/admin/src/components/Layout/CanvasLayout.tsx packages/shared/src/styles/utilities.css
git commit -m "feat(admin,shared): workspace data attribute + upgraded stagger animation"
```

---

## Wave 5: Motion Polish + Accessibility

### Task 18: View Crossfade Color Dissolve

**Files:**
- Modify: `packages/admin/src/index.css` (add @property + keyframes)

- [ ] **Step 1: Add @property definitions for workspace tint animation**

In `packages/admin/src/index.css`, add before the workspace palette rulesets:

```css
/* Animatable workspace tint — enables color cross-dissolve between views */
@property --ws-surface-tint-color {
  syntax: "<color>";
  inherits: true;
  initial-value: transparent;
}
```

- [ ] **Step 2: Wire workspace tint color into palettes**

In each `[data-workspace="..."]` ruleset, add a resolved color value:

```css
[data-workspace="hub"] {
  /* ... existing tokens ... */
  --ws-surface-tint-color: rgb(var(--blue-500) / 8%);
}

[data-workspace="garden"] {
  --ws-surface-tint-color: rgb(var(--green-500) / 8%);
}

[data-workspace="community"] {
  --ws-surface-tint-color: rgb(var(--orange-500) / 8%);
}

[data-workspace="actions"] {
  --ws-surface-tint-color: rgb(var(--red-500) / 8%);
}
```

- [ ] **Step 3: Add transition on the workspace container**

In the view transition section of `packages/admin/src/index.css`, add:

```css
/* Workspace color cross-dissolve when switching views */
[data-workspace] {
  transition: --ws-surface-tint-color var(--spring-dramatic-duration, 500ms) var(--spring-dramatic-easing, cubic-bezier(0.16, 1, 0.3, 1));
}
```

Because `--ws-surface-tint-color` is registered via `@property` with `syntax: "<color>"`, the browser can interpolate between color values during view navigation.

- [ ] **Step 4: Verify build**

Run: `cd packages/admin && bun build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/admin/src/index.css
git commit -m "feat(admin): @property workspace color cross-dissolve for view transitions"
```

---

### Task 19: Reduced Motion Audit

**Files:**
- Modify: `packages/shared/src/styles/utilities.css` (extend reduced-motion coverage)
- Modify: `packages/admin/src/index.css` (reduced-motion for view transitions)

- [ ] **Step 1: Extend reduced motion for glass transitions**

In `packages/shared/src/styles/utilities.css`, add inside `@layer utilities`:

```css
  /* ── Reduced Motion — disable all non-essential animation ── */
  @media (prefers-reduced-motion: reduce) {
    .glass-ground,
    .glass-raised,
    .glass-floating,
    .glass-overlay {
      transition: none;
    }

    /* Disable hover transforms on interactive surfaces */
    [class*="hover:-translate-y"],
    [class*="hover:scale-"],
    [class*="active:scale-"] {
      transform: none !important;
      transition: none !important;
    }
  }
```

- [ ] **Step 2: Extend reduced motion for admin-specific animations**

In `packages/admin/src/index.css`, add after the view transitions section:

```css
@media (prefers-reduced-motion: reduce) {
  /* Disable view transition animations */
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation: none;
  }

  /* Disable workspace color dissolve */
  [data-workspace] {
    transition: none;
  }

  /* Disable speed dial stagger */
  @keyframes speed-dial-in {
    from { opacity: 1; transform: none; }
  }

  /* Disable hub tab crossfade */
  @keyframes hub-fade-in {
    from { opacity: 1; }
  }
}
```

- [ ] **Step 3: Run tests**

Run: `bun run test`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/styles/utilities.css packages/admin/src/index.css
git commit -m "a11y(shared,admin): extend prefers-reduced-motion coverage for glass and motion"
```

---

## Wave 6: Final Validation

### Task 20: Build Verification + Lint + Format

**Files:** None new — validation only.

- [ ] **Step 1: Format and lint**

Run: `bun format && bun lint`
Expected: No errors. Fix any that arise.

- [ ] **Step 2: Run full test suite**

Run: `bun run test`
Expected: All tests pass across all packages.

- [ ] **Step 3: Full build**

Run: `bun build`
Expected: All packages build successfully in dependency order (contracts → shared → indexer → client/admin).

- [ ] **Step 4: Final commit (if format/lint made changes)**

```bash
git add -A
git commit -m "chore: format and lint after M3+Liquid polish migration"
```

---

## Task Dependency Graph

```
Task 1 (stone + workspace palettes)
  ├─→ Task 2 (type scale)
  ├─→ Task 3 (shape + glass + springs)
  │     ├─→ Task 6 (Surface glass)
  │     ├─→ Task 9 (Nav + TopBar)
  │     └─→ Task 10 (Sheets)
  ├─→ Task 4 (DOMAIN_CONFIG)
  │     └─→ Task 14 (Hub HubWorkCard)
  │     └─→ Task 15 (Actions view)
  └─→ Task 5 (hooks)
        └─→ Task 16 (Garden + Community)

Task 6 ─→ Task 7 (Button/Badge)
       ─→ Task 8 (Card/StatCard/EmptyState)
       ─→ Task 11 (CanvasScaffold)
       ─→ Task 12 (GardenChip/Dialog/Form)
       ─→ Task 13 (PageHeader/CommandPalette)

Task 17 (workspace attr + stagger) — can run after Task 1
Task 18 (color dissolve) — can run after Task 1
Task 19 (reduced motion) — can run after Tasks 3 + 18
Task 20 (validation) — runs last, after all other tasks
```

**Parallelizable groups:**
- Tasks 2, 3, 4, 5 can run in parallel (all depend only on Task 1)
- Tasks 6-13 can run in parallel after their token dependencies (Tasks 2+3) are done
- Tasks 14, 15, 16 can run in parallel after their Wave 2+3 dependencies
