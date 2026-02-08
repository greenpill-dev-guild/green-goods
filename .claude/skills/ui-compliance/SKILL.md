---
name: ui-compliance
description: UI compliance - accessibility (WCAG), forms, responsive design, animation. Use for a11y, mobile-first, forms, i18n.
---

# UI Compliance Skill

Complete UI guide: accessibility, forms, responsive design, animation, and i18n.

---

## Activation

When invoked:
- Start with accessibility checks (WCAG AA).
- Validate forms with RHF + Zod patterns.
- Ensure responsive behavior across mobile and desktop.

## Part 1: Accessibility (CRITICAL)

**Every Green Goods user deserves equal access.**

### Interactive Elements

```typescript
// Bad: Inaccessible
<div onClick={handleClick}>Submit</div>

// Good: Accessible
<button onClick={handleClick} aria-label="Submit work">
  Submit
</button>
```

### Checklist

- [ ] ARIA labels on interactive elements without visible text
- [ ] Semantic HTML (`<button>`, `<nav>`, `<main>`, not `<div onClick>`)
- [ ] Keyboard handlers for mouse interactions (`onClick` + `onKeyDown`)
- [ ] Alt text for images (or `alt=""` for decorative)
- [ ] Skip links for keyboard navigation
- [ ] Verify with Storybook's a11y addon during component development

### Focus States

```css
/* Use :focus-visible, not :focus (avoids mouse focus rings) */
button:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
```

- [ ] Visible focus indicator on all interactive elements
- [ ] Use `:focus-visible` (not `:focus`)
- [ ] Group focus with `:focus-within` for compound components
- [ ] Never `outline: none` without replacement

---

## Part 2: Forms (HIGH)

### Green Goods Pattern (RHF + Zod)

```typescript
<label htmlFor="garden-name">Garden Name</label>
<input
  id="garden-name"
  type="text"
  autoComplete="organization"
  aria-describedby={errors.name ? "name-error" : undefined}
  {...register("name")}
/>
{errors.name && (
  <p id="name-error" role="alert">{errors.name.message}</p>
)}
```

### Checklist

- [ ] `autocomplete` attribute on inputs
- [ ] Correct `type` for inputs (email, tel, url)
- [ ] Labels associated via `htmlFor`/`id`
- [ ] Error messages linked with `aria-describedby`
- [ ] Never disable paste on password fields

---

## Part 3: Responsive Design

### Mobile-First Breakpoints

```css
/* Base: Mobile (< 640px) */
@media (min-width: 640px) { /* sm: Landscape phones */ }
@media (min-width: 768px) { /* md: Tablets */ }
@media (min-width: 1024px) { /* lg: Laptops */ }
@media (min-width: 1280px) { /* xl: Desktops */ }
@media (min-width: 1536px) { /* 2xl: Large desktops */ }
```

### Container Queries

```tsx
// Tailwind container queries
function ResponsiveCard({ title, image }) {
  return (
    <div className="@container">
      <article className="flex flex-col @md:flex-row @md:gap-4">
        <img className="w-full @md:w-48 @lg:w-64" src={image} />
        <h2 className="text-lg @md:text-xl @lg:text-2xl">{title}</h2>
      </article>
    </div>
  );
}
```

### Fluid Typography

```css
:root {
  /* clamp(min, preferred, max) */
  --text-base: clamp(1rem, 0.9rem + 0.5vw, 1.125rem);
  --text-xl: clamp(1.25rem, 1rem + 1.25vw, 1.5rem);
  --space-md: clamp(1rem, 0.8rem + 1vw, 1.5rem);
}
```

### CSS Grid Auto-Fit

```css
.grid-auto {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
  gap: 1.5rem;
}
```

### Viewport Units

```css
/* Dynamic viewport (accounts for mobile browser UI) */
.full-height {
  height: 100dvh;  /* Recommended for mobile */
}
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Horizontal overflow | Check fixed widths, use `max-width: 100%` |
| 100vh on mobile | Use `100dvh` for dynamic viewport |
| Small touch targets | Minimum 44x44px, use padding |
| Font too small | Base 16px minimum, use `clamp()` |
| Image distortion | Use `object-fit: cover` with aspect-ratio |

---

## Part 4: Animation (HIGH)

### Reduced Motion

```css
/* Only animate if user allows */
@media (prefers-reduced-motion: no-preference) {
  .card {
    transition: transform 200ms ease-out, opacity 200ms ease-out;
  }
}
```

### Checklist

- [ ] `prefers-reduced-motion` media query respected
- [ ] Only animate `transform` and `opacity` (GPU-accelerated)
- [ ] Animations are interruptible (not blocking input)
- [ ] No `transition: all` (specify properties)

---

## Part 5: Images (HIGH)

```typescript
// Green Goods image pattern
import { useIntl } from "react-intl";

const intl = useIntl();

<img
  src={workPhoto}
  alt={intl.formatMessage({ id: "work.photoAlt" }, { action: action.name })}
  width={300}
  height={200}
  loading="lazy"
/>
```

### Checklist

- [ ] Explicit `width` and `height` to prevent CLS
- [ ] `loading="lazy"` for below-fold images
- [ ] `fetchpriority="high"` for above-fold hero images

---

## Part 6: i18n (HIGH for Green Goods)

```typescript
// Green Goods i18n pattern
import { useIntl } from "react-intl";

const intl = useIntl();

// Formatting dates
const formattedDate = intl.formatDate(work.createdAt, {
  dateStyle: "medium"
});

// User-facing strings (NEVER hardcode)
const title = intl.formatMessage({ id: "work.submit.title" });
```

### Mandatory Requirements

1. **Use `intl.formatMessage()`** — Never hardcode UI strings
2. **Update ALL language files** — en.json, es.json, pt.json simultaneously
3. **Semantic key naming** — Use pattern `app.feature.action` (e.g., `work.actions.submit`)

### Checklist

- [ ] All user-facing strings use `intl.formatMessage()`
- [ ] New strings added to ALL THREE language files (en.json, es.json, pt.json)
- [ ] Semantic key naming (e.g., `garden.create.button`)
- [ ] `Intl` API for dates, numbers, currency
- [ ] `lang` attribute set on `<html>`
- [ ] RTL support if needed

---

## Part 7: Dark Mode & Theming

```css
/* Green Goods theme tokens */
:root {
  color-scheme: light dark;
}

[data-theme="dark"] {
  --bg-primary: #0f0f0f;
  --text-primary: #ffffff;
}
```

### Checklist

- [ ] `color-scheme` declaration in CSS
- [ ] `theme-color` meta tag (changes browser chrome)
- [ ] Use semantic tokens (`--bg-*`, `--text-*`)

---

## Part 8: Performance

```typescript
// Virtualization for long lists (50+ items)
import { useVirtualizer } from "@tanstack/react-virtual";

const rowVirtualizer = useVirtualizer({
  count: gardens.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 72,
});
```

### Checklist

- [ ] Virtualize lists > 50 items
- [ ] Batch DOM updates (avoid layout thrashing)
- [ ] `preconnect` for external origins
- [ ] Controlled inputs don't re-render parent

---

## Part 9: Navigation & State

- [ ] UI state reflected in URL (filters, tabs, pagination)
- [ ] Deep linking works (can share URLs)
- [ ] Destructive actions require confirmation
- [ ] Back button works as expected

---

## Part 10: Mobile Safe Areas

```css
/* Mobile safe area for notched devices */
.bottom-nav {
  padding-bottom: env(safe-area-inset-bottom);
}
```

---

## Quick Reference Checklist

### Before Merging UI Code

**Accessibility**
- [ ] All interactive elements keyboard accessible
- [ ] ARIA labels on icon-only buttons
- [ ] Focus indicators visible (`:focus-visible`)
- [ ] **Run Storybook a11y addon and resolve any violations — mandatory**

**Forms**
- [ ] Labels linked to inputs
- [ ] Error messages have `aria-describedby`
- [ ] Autocomplete attributes set

**Responsive**
- [ ] Mobile-first styles (min-width breakpoints)
- [ ] Touch targets 44x44px minimum
- [ ] 100dvh instead of 100vh

**Performance**
- [ ] Images have dimensions
- [ ] Long lists virtualized
- [ ] Animations use transform/opacity only

**i18n**
- [ ] All strings use `intl.formatMessage()`
- [ ] **Update all three language files (en, es, pt) — mandatory**
- [ ] Dates/numbers use Intl API
