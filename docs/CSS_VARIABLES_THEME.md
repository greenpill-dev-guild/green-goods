# CSS Variables Theme System (Superseded)

> ⚠️ This legacy guide has moved. The maintained theming documentation now lives at [`developer/theming.md`](developer/theming.md) within the GitBook docs.

### Start here instead

- [Theme System & Tokens](developer/theming.md) — semantic tokens, Tailwind integration, hooks, and usage examples (updated November 2024).
- [Client Package Architecture](developer/architecture/client-package.md) — how theming fits into the PWA stack.

Please update and reference the GitBook pages moving forward; this file remains only to avoid breaking historical links.
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

