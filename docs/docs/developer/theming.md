# CSS Variables Theme System

Complete guide to the Green Goods CSS variables-based theming system.

## Overview

The Green Goods admin dashboard uses a CSS variables-based theme system that provides:
- **Instant theme switching** with no visual flash
- **Semantic color tokens** that automatically adapt to light/dark modes
- **Single source of truth** for all color definitions
- **Type-safe theme API** with React hooks

## Architecture

### Core Components

1. **Theme CSS** (`packages/shared/src/styles/theme.css`)
   - Defines all CSS variables
   - Maps semantic tokens to base colors
   - Handles light/dark mode switching

2. **Theme Controller** (`packages/shared/src/theme/index.ts`)
   - Pure JavaScript API for theme management
   - Handles localStorage persistence
   - Manages system preference detection

3. **React Hook** (`packages/shared/src/hooks/app/useTheme.ts`)
   - React integration for theme state
   - Provides reactive theme updates
   - Cleanup on unmount

4. **Tailwind Integration** (`packages/admin/tailwind.config.ts`)
   - Maps CSS variables to Tailwind utilities
   - Enables `bg-*`, `text-*`, `border-*` classes
   - Supports opacity modifiers

## Theme System

### Data Attribute Approach

The system uses `data-theme` attributes instead of class-based dark mode:

```html
<!-- Light mode -->
<html data-theme="light">

<!-- Dark mode -->
<html data-theme="dark">
```

**Why `data-theme`:**
- More semantic than `.dark` class
- Explicit theme state in markup
- Easy to extend (high-contrast, etc.)
- Clean selector syntax in CSS

### Pre-Hydration Script

Prevents flash of wrong theme on page load:

```html
<!-- In index.html, before React loads -->
<script>
(function() {
  const KEY = 'theme';
  try {
    const stored = localStorage.getItem(KEY) || 'system';
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolved = stored === 'dark' || (stored === 'system' && systemDark);
    document.documentElement.dataset.theme = resolved ? 'dark' : 'light';
  } catch (_) {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = systemDark ? 'dark' : 'light';
  }
})();
</script>
```

## Color Token System

### Semantic Background Tokens

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `bg-white-0` | White (#FFFFFF) | Black (#000000) | Primary backgrounds |
| `bg-weak-50` | Gray 50 | Gray 900 | Subtle backgrounds |
| `bg-soft-200` | Gray 200 | Gray 700 | Soft backgrounds |
| `bg-sub-300` | Gray 300 | Gray 600 | Medium backgrounds |
| `bg-surface-800` | Gray 100 | Gray 800 | Surface backgrounds |
| `bg-strong-950` | Black (#000000) | White (#FFFFFF) | Strong backgrounds |

### Semantic Text Tokens

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `text-strong-950` | Gray 950 | Gray 50 | Primary text |
| `text-sub-600` | Gray 600 | Gray 400 | Secondary text |
| `text-soft-400` | Gray 400 | Gray 500 | Tertiary text |
| `text-disabled-300` | Gray 300 | Gray 600 | Disabled text |

### Semantic Stroke Tokens

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `stroke-strong-950` | Gray 950 | Gray 50 | Strong borders |
| `stroke-sub-300` | Gray 300 | Gray 600 | Medium borders |
| `stroke-soft-200` | Gray 200 | Gray 700 | Soft borders |

### State Color Tokens

Each state has 4 variants:

| State | Dark | Base | Light | Lighter |
|-------|------|------|-------|---------|
| **Success** (Green) | `success-dark` | `success-base` | `success-light` | `success-lighter` |
| **Error** (Red) | `error-dark` | `error-base` | `error-light` | `error-lighter` |
| **Warning** (Orange) | `warning-dark` | `warning-base` | `warning-light` | `warning-lighter` |
| **Information** (Blue) | `information-dark` | `information-base` | `information-light` | `information-lighter` |

**Usage guidelines:**
- `-darker`: Text on light backgrounds
- `-base`: Icons, borders, primary state color
- `-light`: Borders, accents
- `-lighter`: Backgrounds

## Usage

### JavaScript/TypeScript

```typescript
import { initTheme, setTheme, getTheme } from '@green-goods/shared';

// Initialize on app start
const cleanup = initTheme();

// Get current theme
const current = getTheme(); // 'light' | 'dark' | 'system'

// Change theme
setTheme('dark');    // Force dark mode
setTheme('light');   // Force light mode
setTheme('system');  // Follow OS preference

// Cleanup (in unmount)
cleanup();
```

### React Hook

```typescript
import { useTheme } from '@green-goods/shared/hooks';

function ThemeToggle() {
  const { theme, isDark, setTheme, toggleTheme } = useTheme();
  
  return (
    <button onClick={toggleTheme}>
      {isDark ? 'Switch to Light' : 'Switch to Dark'}
    </button>
  );
}
```

### Tailwind CSS

```tsx
// Background colors
<div className="bg-bg-white">White background (inverts in dark mode)</div>
<div className="bg-bg-weak">Subtle background</div>
<div className="bg-bg-soft">Soft background</div>

// Text colors
<h1 className="text-text-strong">Primary heading</h1>
<p className="text-text-sub">Secondary text</p>
<span className="text-text-soft">Tertiary text</span>

// Borders
<div className="border border-stroke-soft">Soft border</div>
<div className="border border-stroke-sub">Medium border</div>

// State colors
<div className="bg-success-lighter text-success-dark">Success message</div>
<div className="bg-error-lighter text-error-dark">Error message</div>
<div className="bg-warning-lighter text-warning-dark">Warning message</div>

// With opacity modifiers
<div className="bg-text-strong/10">10% opacity text color</div>
<div className="border-success-base/50">50% opacity success border</div>
```

### Raw CSS

```css
.custom-component {
  background-color: rgb(var(--bg-white-0));
  color: rgb(var(--text-strong-950));
  border: 1px solid rgb(var(--stroke-soft-200));
}

.custom-component:hover {
  background-color: rgb(var(--bg-weak-50));
}
```

## Common Patterns

### Card Component

```tsx
<div className="bg-bg-white border border-stroke-soft rounded-lg shadow-sm">
  <div className="p-6 border-b border-stroke-soft">
    <h3 className="text-lg font-medium text-text-strong">Card Title</h3>
    <p className="text-sm text-text-sub mt-1">Card description</p>
  </div>
  <div className="p-6">
    <p className="text-text-soft">Card content</p>
  </div>
</div>
```

### Button Variants

```tsx
// Primary button (brand color - intentional)
<button className="bg-green-600 text-white hover:bg-green-700">
  Primary Action
</button>

// Secondary button (semantic tokens)
<button className="bg-bg-white border border-stroke-sub text-text-sub hover:bg-bg-weak">
  Secondary Action
</button>

// Danger button (semantic state tokens)
<button className="bg-error-base text-white hover:bg-error-dark">
  Delete
</button>
```

### Form Input

```tsx
<input
  className={cn(
    "bg-bg-white border border-stroke-soft text-text-strong",
    "focus:border-success-base focus:ring-2 focus:ring-success-lighter",
    error && "border-error-base focus:border-error-base focus:ring-error-lighter"
  )}
/>
{error && <span className="text-xs text-error-base">{error}</span>}
```

### Status Badge

```tsx
// Success state
<span className="bg-success-lighter text-success-dark border border-success-light rounded-full px-2 py-1">
  Approved
</span>

// Error state
<span className="bg-error-lighter text-error-dark border border-error-light rounded-full px-2 py-1">
  Rejected
</span>

// Warning state
<span className="bg-warning-lighter text-warning-dark border border-warning-light rounded-full px-2 py-1">
  Pending
</span>
```

### Alert Banners

```tsx
// Error alert
<div className="bg-error-lighter border border-error-light rounded-md p-4">
  <h3 className="text-sm font-medium text-error-dark">Error</h3>
  <p className="text-sm text-error-dark/80 mt-1">Something went wrong</p>
</div>

// Warning alert
<div className="bg-warning-lighter border border-warning-light rounded-md p-4">
  <h3 className="text-sm font-medium text-warning-dark">Warning</h3>
  <p className="text-sm text-warning-dark/80 mt-1">Please review</p>
</div>
```

## Migration Guide

### Migrating Existing Components

**Before:**
```tsx
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
  <button className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600">
    Click me
  </button>
</div>
```

**After:**
```tsx
<div className="bg-bg-white text-text-strong">
  <button className="bg-bg-weak hover:bg-bg-soft">
    Click me
  </button>
</div>
```

### Common Replacements

| Old (Hardcoded) | New (Semantic Token) |
|----------------|---------------------|
| `bg-white dark:bg-gray-800` | `bg-bg-white` |
| `bg-gray-50 dark:bg-gray-900` | `bg-bg-weak` |
| `bg-gray-100` | `bg-bg-weak` |
| `text-gray-900 dark:text-gray-100` | `text-text-strong` |
| `text-gray-600 dark:text-gray-400` | `text-text-sub` |
| `text-gray-500` | `text-text-soft` |
| `border-gray-200 dark:border-gray-700` | `border-stroke-soft` |
| `border-gray-300` | `border-stroke-sub` |

### Brand Colors vs Semantic Tokens

**Keep as brand colors:**
- Primary CTAs: `bg-green-600 hover:bg-green-700`
- Active tab indicators: `border-green-500 text-green-600`
- Links: `text-green-600 hover:text-green-900`

**Convert to semantic tokens:**
- Status badges: `bg-success-lighter text-success-dark`
- Error states: `bg-error-lighter text-error-dark`
- Form validation: `border-error-base focus:ring-error-lighter`
- Remove buttons: `text-error-base hover:bg-error-lighter`

## Testing Checklist

When adding new components:

- [ ] Use semantic tokens for backgrounds, text, borders
- [ ] Use state tokens for success/error/warning states
- [ ] Keep brand green for primary CTAs
- [ ] Test in both light and dark modes
- [ ] Verify no `dark:` classes remain
- [ ] Check contrast meets accessibility standards
- [ ] Test theme switching is instant (no flash)
- [ ] Verify hover/focus states work in both themes

## Troubleshooting

### Colors Not Changing

**Problem:** Classes don't change colors between themes.

**Solution:** Ensure CSS variables are defined in `theme.css` and mapped in `tailwind.config.ts`.

### Theme Flash on Load

**Problem:** Wrong theme briefly shows on page load.

**Solution:** Verify pre-hydration script is in `index.html` before React loads.

### Opacity Modifiers Not Working

**Problem:** `bg-text-strong/50` doesn't work.

**Solution:** Ensure colors use `rgb(var(--color) / <alpha-value>)` format in Tailwind config.

### State Colors Not Available

**Problem:** `bg-success-lighter` class not found.

**Solution:** Add state color tokens to `tailwind.config.ts`:

```typescript
colors: {
  "success-dark": "rgb(var(--success-dark) / <alpha-value>)",
  "success-base": "rgb(var(--success-base) / <alpha-value>)",
  "success-light": "rgb(var(--success-light) / <alpha-value>)",
  "success-lighter": "rgb(var(--success-lighter) / <alpha-value>)",
  // ... (error, warning, information)
}
```

## Best Practices

1. **Always use semantic tokens** for neutral colors (gray scale)
2. **Use state tokens** for status indicators and alerts
3. **Keep brand colors** for primary actions and navigation
4. **Test both themes** during development
5. **Avoid hardcoded colors** in component styles
6. **Use opacity modifiers** for subtle variations
7. **Document custom patterns** in this guide
8. **Maintain accessibility** contrast ratios in both themes

## References

- Shared theme CSS: `packages/shared/src/styles/theme.css`
- Theme controller: `packages/shared/src/theme/index.ts`
- React hook: `packages/shared/src/hooks/app/useTheme.ts`
- Admin Tailwind config: `packages/admin/tailwind.config.ts`
- Implementation doc: `/CSS_VARIABLES_THEME_IMPLEMENTATION.md`

