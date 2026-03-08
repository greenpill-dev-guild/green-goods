# Web Design Guidelines Skill

UI compliance checklist covering accessibility, forms, animation, i18n, and more.

**Source**: [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines)

---

## Activation

| Trigger | When to Apply |
|---------|---------------|
| `/ui-review` | Full UI compliance audit |
| Building forms | Check form accessibility rules |
| Adding animations | Check motion/performance rules |
| i18n work | Check locale/formatting rules |
| Code review Pass 4 | Environment/UI compatibility check |

---

## Guideline Categories (13 Total)

### 1. Accessibility (CRITICAL)

**Every Green Goods user deserves equal access.**

- [ ] ARIA labels on interactive elements without visible text
- [ ] Semantic HTML (`<button>`, `<nav>`, `<main>`, not `<div onClick>`)
- [ ] Keyboard handlers for mouse interactions (`onClick` + `onKeyDown`)
- [ ] Alt text for images (or `alt=""` for decorative)
- [ ] Skip links for keyboard navigation

```typescript
// ❌ Inaccessible
<div onClick={handleClick}>Submit</div>

// ✅ Accessible
<button onClick={handleClick} aria-label="Submit work">
  Submit
</button>
```

### 2. Focus States (CRITICAL)

- [ ] Visible focus indicator on all interactive elements
- [ ] Use `:focus-visible` (not `:focus`) to avoid mouse focus rings
- [ ] Group focus with `:focus-within` for compound components
- [ ] Never `outline: none` without replacement

```css
/* ✅ Focus-visible only shows for keyboard */
button:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
```

### 3. Forms (HIGH)

- [ ] `autocomplete` attribute on inputs
- [ ] Correct `type` for inputs (email, tel, url)
- [ ] Labels associated via `htmlFor`/`id`
- [ ] Error messages linked with `aria-describedby`
- [ ] Never disable paste on password fields

```typescript
// ✅ Green Goods form pattern (RHF + Zod)
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

### 4. Animation (HIGH)

- [ ] `prefers-reduced-motion` media query respected
- [ ] Only animate `transform` and `opacity` (GPU-accelerated)
- [ ] Animations are interruptible (not blocking input)
- [ ] No `transition: all` (specify properties)

```css
/* ✅ Green Goods animation pattern */
@media (prefers-reduced-motion: no-preference) {
  .card {
    transition: transform 200ms ease-out, opacity 200ms ease-out;
  }
}
```

### 5. Typography (MEDIUM)

- [ ] Use `...` (ellipsis) not `...` (three dots)
- [ ] Curly quotes `"` `'` not straight `"` `'`
- [ ] Non-breaking space between number and unit (`5 kg` not `5 kg`)
- [ ] Proper number formatting via `Intl.NumberFormat`

### 6. Content Handling (MEDIUM)

- [ ] Text truncation with `text-overflow: ellipsis`
- [ ] Empty states for all lists/data views
- [ ] Long content anticipated (don't overflow)

### 7. Images (HIGH)

- [ ] Explicit `width` and `height` to prevent CLS
- [ ] `loading="lazy"` for below-fold images
- [ ] `fetchpriority="high"` for above-fold hero images

```typescript
// ✅ Green Goods image pattern
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

### 8. Performance (HIGH)

- [ ] Virtualize lists > 50 items
- [ ] Batch DOM updates (avoid layout thrashing)
- [ ] `preconnect` for external origins
- [ ] Controlled inputs don't re-render parent

```typescript
// ✅ Virtualization for long lists
import { useVirtualizer } from "@tanstack/react-virtual";

const rowVirtualizer = useVirtualizer({
  count: gardens.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 72,
});
```

### 9. Navigation & State (MEDIUM)

- [ ] UI state reflected in URL (filters, tabs, pagination)
- [ ] Deep linking works (can share URLs)
- [ ] Destructive actions require confirmation
- [ ] Back button works as expected

### 10. Touch & Interaction (MEDIUM)

- [ ] Tap highlight disabled where appropriate
- [ ] Drag behavior considers touch
- [ ] Safe-area insets for notched devices
- [ ] Custom scrollbar styling (if overridden)

```css
/* ✅ Mobile safe area */
.bottom-nav {
  padding-bottom: env(safe-area-inset-bottom);
}
```

### 11. Dark Mode & Theming (MEDIUM)

- [ ] `color-scheme` declaration in CSS
- [ ] `theme-color` meta tag (changes browser chrome)
- [ ] Native selects styled for dark mode
- [ ] Use semantic tokens (Green Goods: `--bg-*`, `--text-*`)

```css
/* ✅ Green Goods theme tokens */
:root {
  color-scheme: light dark;
}

[data-theme="dark"] {
  --bg-primary: #0f0f0f;
  --text-primary: #ffffff;
}
```

### 12. Locale & i18n (HIGH for Green Goods)

- [ ] All user-facing strings use `intl.formatMessage()`
- [ ] New strings added to ALL THREE language files (en.json, es.json, pt.json)
- [ ] `Intl` API for dates, numbers, currency
- [ ] `lang` attribute set on `<html>`
- [ ] RTL support if needed

```typescript
// ✅ Green Goods i18n pattern
import { useIntl } from "react-intl";

const intl = useIntl();
const formattedDate = intl.formatDate(work.createdAt, {
  dateStyle: "medium"
});
```

### 13. Hydration Safety (MEDIUM)

- [ ] Controlled inputs have both `value` AND `onChange`
- [ ] Server/client render match (no `typeof window` in render)
- [ ] Use `suppressHydrationWarning` only when necessary

---

## Green Goods Integration

### Alignment with Existing Patterns

| Guideline | Green Goods Implementation |
|-----------|---------------------------|
| Forms | RHF + Zod (architectural rule #8) |
| i18n | react-intl (en, es, pt) |
| Dark mode | `[data-theme="dark"]` in theme.css |
| Animation | animation.css with reduced-motion |
| Performance | Virtual lists, offline-first PWA |

### When Code-Reviewer Uses This

Add to **Pass 4: Environment Compatibility**:

1. Check accessibility (ARIA, semantic HTML)
2. Check form patterns (autocomplete, labels, errors)
3. Check animation (reduced-motion, GPU properties)
4. Check i18n (Intl API, translation keys)

### Example Review Finding

```markdown
#### High Priority
- Missing `aria-label` on icon button - `WorkCard.tsx:45`
- Form input missing `autocomplete` attribute - `CreateWorkForm.tsx:89`
- Animation uses `width` instead of `transform` - `Modal.tsx:23`
```

---

## Quick Reference Checklist

Before merging UI code:

**Accessibility**
- [ ] All interactive elements keyboard accessible
- [ ] ARIA labels on icon-only buttons
- [ ] Focus indicators visible

**Forms**
- [ ] Labels linked to inputs
- [ ] Error messages have `aria-describedby`
- [ ] Autocomplete attributes set

**Performance**
- [ ] Images have dimensions
- [ ] Long lists virtualized
- [ ] Animations use transform/opacity only

**i18n**
- [ ] All strings use `intl.formatMessage()`
- [ ] **Update all three language files (en, es, pt) — mandatory**
- [ ] Dates/numbers use Intl API

**Storybook**
- [ ] Run Storybook a11y addon and resolve violations

---

## Full Guidelines

For complete rules, see:
- [web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) — Full guideline source
- [command.md](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md) — Machine-readable rules

