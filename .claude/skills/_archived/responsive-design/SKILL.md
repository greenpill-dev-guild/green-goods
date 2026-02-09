---
name: responsive-design
description: Modern responsive layouts with container queries, fluid typography, CSS Grid, and mobile-first strategies.
---

# Responsive Design

Modern responsive design techniques for interfaces that adapt across all screen sizes.

## When to Use

- Implementing mobile-first layouts
- Using container queries for component responsiveness
- Creating fluid typography scales
- Building complex Grid/Flexbox layouts
- Designing breakpoint strategies

## Core Capabilities

### 1. Container Queries

Component-level responsiveness independent of viewport.

```css
/* Define containment context */
.card-container {
  container-type: inline-size;
  container-name: card;
}

/* Query the container */
@container card (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 200px 1fr;
  }
}
```

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

### 2. Fluid Typography

```css
:root {
  /* clamp(min, preferred, max) */
  --text-base: clamp(1rem, 0.9rem + 0.5vw, 1.125rem);
  --text-xl: clamp(1.25rem, 1rem + 1.25vw, 1.5rem);
  --text-3xl: clamp(1.875rem, 1.5rem + 1.875vw, 2.5rem);

  /* Fluid spacing */
  --space-md: clamp(1rem, 0.8rem + 1vw, 1.5rem);
  --space-lg: clamp(1.5rem, 1.2rem + 1.5vw, 2.5rem);
}
```

### 3. CSS Grid Responsive

```css
/* Auto-fit: items wrap automatically */
.grid-auto {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
  gap: 1.5rem;
}
```

```tsx
// Tailwind Grid
function ProductGrid({ products }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

## Breakpoint Strategy

```css
/* Mobile-first breakpoints */
/* Base: Mobile (< 640px) */
@media (min-width: 640px) { /* sm: Landscape phones */ }
@media (min-width: 768px) { /* md: Tablets */ }
@media (min-width: 1024px) { /* lg: Laptops */ }
@media (min-width: 1280px) { /* xl: Desktops */ }
@media (min-width: 1536px) { /* 2xl: Large desktops */ }
```

## Viewport Units

```css
/* Dynamic viewport (accounts for mobile browser UI) */
.full-height {
  height: 100dvh;  /* Recommended for mobile */
}

/* Small viewport (minimum) */
.min-height {
  min-height: 100svh;
}
```

## Green Goods Patterns

### Mobile-First Cards

```tsx
// Follow GardenCard pattern
function WorkCard({ work, selected, onSelect }) {
  return (
    <button
      onClick={() => onSelect?.(work.id)}
      className={cn(
        "w-full p-4 rounded-lg border transition-colors",
        "flex flex-col gap-2",
        // Desktop: horizontal layout
        "md:flex-row md:items-center md:gap-4",
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50"
      )}
    >
      <img
        src={work.photos[0]}
        className="w-full md:w-24 aspect-video md:aspect-square object-cover rounded"
      />
      <div className="flex-1">
        <h3 className="font-medium">{work.action.name}</h3>
        <p className="text-sm text-muted-foreground">{work.feedback}</p>
      </div>
    </button>
  );
}
```

### Responsive Images

```tsx
import { useIntl } from "react-intl";

function ResponsiveHero() {
  const intl = useIntl();

  return (
    <picture>
      <source media="(min-width: 1024px)" srcSet="/hero-wide.webp" />
      <source media="(min-width: 768px)" srcSet="/hero-medium.webp" />
      <img
        src="/hero-mobile.webp"
        alt={intl.formatMessage({ id: "hero.alt" })}
        className="w-full h-auto"
        loading="eager"
        fetchPriority="high"
      />
    </picture>
  );
}
```

## Best Practices

1. **Mobile-first** — Start with mobile styles, enhance for larger
2. **Content breakpoints** — Base on content, not devices
3. **Fluid over fixed** — Use fluid values for typography/spacing
4. **Container queries** — Component-level responsiveness
5. **Touch targets** — 44x44px minimum on mobile
6. **Test real devices** — Simulators miss issues
7. **Logical properties** — Use `inline`/`block` for i18n

## Common Issues

| Issue | Solution |
|-------|----------|
| Horizontal overflow | Check fixed widths, use `max-width: 100%` |
| 100vh on mobile | Use `100dvh` for dynamic viewport |
| Small touch targets | Minimum 44x44px, use padding |
| Font too small | Base 16px minimum, use `clamp()` |
| Image distortion | Use `object-fit: cover` with aspect-ratio |
