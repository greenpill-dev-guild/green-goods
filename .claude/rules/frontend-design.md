---
paths:
  - "packages/admin/**/*.{ts,tsx}"
  - "packages/client/**/*.{ts,tsx}"
---

# Frontend Design Rules

Rules for all frontend code in admin and client packages.

## Rule 1: Header Consistency

All views MUST use `PageHeader` from `@/components/Layout/PageHeader`. Never use custom h1/p headers.

```tsx
// Bad
<h1 className="text-2xl font-bold">{title}</h1>
<p className="text-gray-500">{description}</p>

// Good
import { PageHeader } from "@/components/Layout/PageHeader";
<PageHeader title={title} description={description} sticky />
```

## Rule 2: Action Bar Separation

Actions go in `PageHeader.actions` prop (rendered on a separate row below title). Never place actions on the title line.

```tsx
// Bad — actions beside title
<div className="flex items-center justify-between">
  <h1>{title}</h1>
  <button>Create</button>
</div>

// Good — actions in PageHeader
<PageHeader title={title} actions={<Button>Create</Button>} />
```

## Rule 3: Container Queries

Use `@container` / `@[Npx]:` for width-responsive components, not viewport breakpoints, when the component's layout depends on its own container width.

```tsx
// Bad — viewport breakpoint for card internal layout
"sm:flex-row sm:w-56"

// Good — container query
"@[480px]:flex-row @[480px]:w-56"
```

## Rule 4: Text Overflow

All user-generated text MUST have `truncate` or `line-clamp-*` AND a `title` attribute for hover tooltip.

```tsx
// Bad
<p className="truncate">{gardenName}</p>

// Good
<p className="truncate" title={gardenName}>{gardenName}</p>
```

## Rule 5: No Action Duplication

Tab-level actions (in PageHeader or tab bar) are canonical. Do not create shortcut cards that duplicate them.

## Rule 6: Flex Height

Use `flex-1` on cards that should expand vertically within a flex container.

## Rule 7: Filter Alignment

When using `flex-col` inside `Card.Header`, always add `items-start` to override the base `items-center`.

```tsx
<Card.Header className="flex-col items-start gap-3">
```

## Rule 8: Thumbnails

Entity references in lists (gardens, actions) include small thumbnails (40px) using `ImageWithFallback` or letter fallbacks.

## Rule 9: Typography Utilities

Use `label-md`, `body-md` utilities from theme.css instead of raw Tailwind text sizes for form labels and body text.

## Rule 10: Icon Sizing Convention

- `h-3.5 w-3.5` — inline badges only
- `h-4 w-4` — standard UI icons (buttons, menu items, list icons)
- `h-5 w-5` — prominent icons (stat cards, section headers, nav items)
- `h-6 w-6` — large icons (empty states, main nav)

## Rule 11: Grid Breakpoints

Always include `sm:` breakpoint. Never skip from single-column to `md:` 2-column.

```tsx
// Bad
"grid-cols-1 md:grid-cols-3"

// Good
"grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
```

## Rule 12: Accessibility — Status Indicators

Status indicators must not rely on color alone. Use icons alongside color (WCAG 1.4.1). The `StatusBadge` component handles this — always use it.

## Rule 13: Dark Mode — Semantic Tokens Only

Never use raw Tailwind colors (`bg-neutral-*`, `text-gray-*`). Always use semantic tokens (`bg-bg-sub`, `text-text-strong`).

## Rule 14: Modal Mobile Safety

Modals must use `max-w-[calc(100vw-2rem)] sm:max-w-lg` to prevent overflow on 375px viewports.

## Rule 15: Form Fields

Use `FormField` component from `@/components/ui/FormField` for label+input+error patterns. Mark required fields.

```tsx
// Bad
<label>Name</label>
<input {...register('name')} />
{errors.name && <p>{errors.name.message}</p>}

// Good
<FormField label="Name" required error={errors.name?.message}>
  <input {...register('name')} />
</FormField>
```

## Rule 16: Alert/Error Boxes

Use `Alert` component from `@/components/ui/Alert` for all error/warning/info boxes. Never use inline styled divs.

```tsx
// Bad
<div className="bg-warning-lighter border border-warning-light rounded-md p-4">
  <svg>...</svg>
  <p>Something went wrong</p>
</div>

// Good
<Alert variant="warning" title="Connection Issue">
  Something went wrong
</Alert>
```
