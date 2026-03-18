---
name: tailwindcss
user-invocable: false
description: TailwindCSS v4 configuration and theming - @theme directive, CSS custom properties, design tokens, dark mode, responsive utilities. Use for styling configuration, theme customization, and CSS architecture.
version: "1.0.0"
status: active
packages: ["shared", "client", "admin"]
dependencies: []
last_updated: "2026-02-19"
last_verified: "2026-02-19"
---

# TailwindCSS v4 Skill

TailwindCSS v4 configuration guide: theme system, design tokens, dark mode, custom utilities, and CSS architecture.

---

## Activation

### Requirements & Architecture

TailwindCSS v4 requires modern browsers (Chrome 111+, Safari 16.4+, Firefox 128+) because it relies on modern CSS features like `@property`, cascade layers, native nesting, and `color-mix()`.

Tailwind's default palette is rebuilt in OKLCH/P3 color space for more perceptually consistent colors across the system.

When invoked:
- Check existing theme in `packages/shared/src/styles/theme.css` before making changes.
- TailwindCSS v4 uses CSS-first configuration — no `tailwind.config.js` needed.
- Shared theme is imported by client and admin via `@import "@green-goods/shared/styles/theme.css"`.
- Biome handles code formatting; TailwindCSS handles CSS architecture.

## Part 1: CSS-First Configuration (v4)

### Key Difference from v3

TailwindCSS v4 replaces `tailwind.config.js` with CSS directives. Configuration lives in CSS files, not JavaScript.

```css
/* v3 (old) — tailwind.config.js */
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#1fc16b',
      },
    },
  },
};

/* v4 (current) — in CSS file */
@import "tailwindcss";

@theme {
  --color-primary: rgb(31, 193, 107);
}
```

### Entry Point Pattern

Each app has a single CSS entry point that imports TailwindCSS and the shared theme:

```css
/* packages/client/src/index.css */
@import "tailwindcss";

/* Dark mode via data-theme attribute (not prefers-color-scheme) */
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

/* Shared theme — CSS variables + @theme tokens */
@import "@green-goods/shared/styles/theme.css";

/* App-specific styles */
@import "./styles/typography.css";
@import "./styles/utilities.css";
@import "./styles/animation.css";
```

## Part 1.5: Critical Breaking Changes from v3

- Important modifier now uses suffix form: `text-3xl!` (replace `!text-3xl`).
- Opacity utilities are removed: `bg-blue-500/20` (replace `bg-opacity-*` patterns).
- CSS variable utility syntax uses parentheses: `bg-(--brand-color)` (replace `bg-[--brand-color]`).
- Utility rename: `grow-*` (replace `flex-grow-*`).
- Utility rename: `shrink-*` (replace `flex-shrink-*`).
- Utility rename: `text-ellipsis` (replace `overflow-ellipsis`).
- Utility rename: `box-decoration-slice` (replace `decoration-slice`).
- Utility rename: `box-decoration-clone` (replace `decoration-clone`).
- `outline-none` now only removes outline style: use `outline-hidden` for prior behavior.
- Default ring width changed 3px → 1px: use `ring-3` to preserve previous thickness.

## Part 2: Theme Architecture

### Shared Theme (`packages/shared/src/styles/theme.css`)

The theme system uses CSS `@property` definitions for type-safe, animatable custom properties:

```css
/* Type-safe custom properties (Baseline July 2024) */
@property --color-primary {
  syntax: "<color>";
  inherits: true;
  initial-value: rgb(31, 193, 107);
}

@property --color-background {
  syntax: "<color>";
  inherits: true;
  initial-value: rgb(255, 255, 255);
}
```

These properties enable smooth animated theme transitions because the browser knows they are `<color>` values.

### Theme Tokens via `@theme`

The `@theme` block registers values as Tailwind utilities:

```css
@theme {
  /* These become Tailwind classes: bg-primary, text-primary, etc. */
  --color-primary: var(--color-primary);
  --color-primary-foreground: var(--color-primary-foreground);
  --color-background: var(--color-background);
  --color-foreground: var(--color-foreground);
  --color-card: var(--color-card);
  --color-muted: var(--color-muted);

  /* Spacing, radii, etc. */
  --radius-lg: 0.75rem;
  --radius-md: 0.5rem;
  --radius-sm: 0.25rem;
}
```

### Dark Mode

Green Goods uses `[data-theme]` attribute (not `prefers-color-scheme`) for explicit theme control:

```css
/* Custom variant definition */
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

/* Theme values switch via data attribute */
[data-theme="dark"] {
  --color-background: rgb(23, 23, 23);
  --color-foreground: rgb(237, 237, 237);
  --color-card: rgb(38, 38, 38);
  --color-muted: rgb(64, 64, 64);
}
```

Usage in components:
```tsx
<div className="bg-background text-foreground">
  {/* Automatically adapts to theme */}
</div>

<div className="border border-stroke-sub dark:border-white">
  {/* Explicit non-semantic dark override */}
</div>
```

## Part 3: Design Token Patterns

### Color Convention

Green Goods uses a semantic color system (not raw colors):

| Token | Purpose | Light | Dark |
|-------|---------|-------|------|
| `background` | Page background | white | near-black |
| `foreground` | Primary text | near-black | near-white |
| `card` | Card surfaces | light gray | dark gray |
| `muted` | Subtle backgrounds | lighter gray | medium gray |
| `primary` | Brand action color | green | green |
| `primary-foreground` | Text on primary | white | white |
| `destructive` | Danger actions | red | red |
| `warning` | Caution states | amber | amber |
| `success` | Positive states | green | green |

```tsx
// ✅ Correct — semantic tokens
<button className="bg-primary text-primary-foreground">

// ❌ Wrong — raw colors
<button className="bg-green-500 text-white">
```

### Adding New Tokens

1. Define the `@property` in `packages/shared/src/styles/theme.css`
2. Add to `@theme` block for Tailwind utility generation
3. Set dark mode value in `[data-theme="dark"]` block
4. Use the semantic name in components

```css
/* Step 1: @property for animation support */
@property --color-accent {
  syntax: "<color>";
  inherits: true;
  initial-value: rgb(99, 102, 241);
}

/* Step 2: @theme registration */
@theme {
  --color-accent: var(--color-accent);
}

/* Step 3: Dark mode value */
[data-theme="dark"] {
  --color-accent: rgb(129, 140, 248);
}
```

## Part 4: Custom Utilities & Variants

### Custom Utilities

```css
/* packages/client/src/styles/utilities.css */
@utility scrollbar-hide {
  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar {
    display: none;
  }
}

@utility text-balance {
  text-wrap: balance;
}
```

### Responsive Design

Green Goods is mobile-first. Use standard Tailwind breakpoints:

```tsx
// Mobile-first: base styles for mobile, then override
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  {gardens.map(garden => <GardenCard key={garden.id} garden={garden} />)}
</div>

// Container queries for component-level responsiveness
<div className="@container">
  <div className="@sm:flex @sm:gap-4">
    {/* Responds to container width, not viewport */}
  </div>
</div>
```

## Part 5: CSS File Organization

```text
packages/shared/src/styles/
└── theme.css              # Shared theme: @property + @theme + dark mode

packages/client/src/
├── index.css              # Entry point: @import tailwindcss + theme + app styles
└── styles/
    ├── colors.css         # Additional color definitions
    ├── typography.css     # Font scales, text utilities
    ├── utilities.css      # Custom @utility definitions
    ├── animation.css      # @keyframes and animation utilities
    └── view-transitions.css  # View Transition API styles

packages/admin/src/
└── index.css              # Entry point: @import tailwindcss + theme
```

### Import Order (Matters!)

```css
/* 1. TailwindCSS base (must be first) */
@import "tailwindcss";

/* 2. Custom variants (before theme, so theme can use them) */
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

/* 3. Shared theme (provides all design tokens) */
@import "@green-goods/shared/styles/theme.css";

/* 4. App-specific styles (can override/extend theme) */
@import "./styles/typography.css";
```

## Anti-Patterns

- **Never use `tailwind.config.js`** — TailwindCSS v4 uses CSS-first configuration
- **Never use raw color values in components** — Use semantic tokens (`bg-primary`, not `bg-green-500`)
- **Never define theme tokens in app packages** — All tokens live in `packages/shared/src/styles/theme.css`
- **Never use `@apply` for simple utilities** — Use classes directly in JSX; `@apply` is for complex compositions only
- **Never use CSS-in-JS or inline styles** — Use TailwindCSS classes exclusively
- **Never skip dark mode values** — Every new color token needs both light and dark variants
- **Never use `prefers-color-scheme`** — Use `[data-theme]` attribute for explicit control
- **Never import TailwindCSS in multiple entry points per package** — One `index.css` per app

## Quick Reference

```bash
# Check for unused CSS (via build analysis)
bun --filter client build && ls -la packages/client/dist/assets/*.css

# Verify theme tokens are registered
grep "@theme" packages/shared/src/styles/theme.css

# Check dark mode coverage
grep "data-theme.*dark" packages/shared/src/styles/theme.css
```

## Related Skills

- `radix-ui` — Radix primitives styled with TailwindCSS classes
- `frontend-design` — Design philosophy and aesthetic direction
- `ui-compliance` — Responsive design and accessibility patterns
- `biome` — Code formatting (Biome handles TS/JS; TailwindCSS handles CSS)
- `performance` — Bundle size impact of CSS utilities
- `storybook` — Design token documentation in Storybook
