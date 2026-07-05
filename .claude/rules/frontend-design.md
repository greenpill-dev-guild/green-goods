---
paths:
  - "packages/admin/**/*.{ts,tsx}"
  - "packages/client/**/*.{ts,tsx}"
---

# Frontend Design Rules

Rules for all frontend code in admin and client packages.

## Rule 1: Header Consistency (admin canvas routes)

Admin views render their header through `CanvasRouteFrame` + `CanvasRouteHeader` (PageHeader
under the hood — views no longer import `PageHeader` directly). Never hand-roll h1/p headers.
Client views use the client shell patterns (`SiteHeader` / `AppShell`), not PageHeader.

```tsx
// Bad
<h1 className="text-2xl font-bold">{title}</h1>
<p className="text-gray-500">{description}</p>

// Good — canvas route composition
import { CanvasRouteFrame, CanvasRouteHeader } from "@/components/Layout";
<CanvasRouteFrame>
  <CanvasRouteHeader title={title} description={description} />
  {/* route content */}
</CanvasRouteFrame>
```

## Rule 2: Action Bar Separation

Actions go in the header's `actions` slot (a separate row, never beside the title). View-level
actions flow through `ViewAction` + `AdminViewActions` on desktop and the same action set via
`useViewActions` for the tablet/mobile FAB speed dial — do not duplicate them inline in route
bodies.

```tsx
// Bad — actions beside title
<div className="flex items-center justify-between">
  <h1>{title}</h1>
  <button>Create</button>
</div>

// Good — actions in the header slot
<CanvasRouteHeader title={title} actions={<AdminViewActions actions={viewActions} />} />
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

Use the project dialog primitives — they own mobile safety. `AdminDialog` (admin) and
`DialogShell` (client/shared) already cap width to the viewport and present as a bottom sheet
on narrow viewports; consumers must NOT restate `max-w-*` overrides (the admin
`AdminDialogStandard.guard` test fails ad-hoc `max-w-*` on AdminDialog). Only a hand-rolled
modal (avoid building these) needs `max-w-[calc(100vw-2rem)] sm:max-w-lg` to survive 375px.

## Rule 15: Form Fields

Use the `FormField` component from `@green-goods/shared` for label+input+error patterns
(admin-local `components/ui` shims are forbidden — admin.mdx Migration Rules). Mark required
fields.

```tsx
// Bad
<label>Name</label>
<input {...register('name')} />
{errors.name && <p>{errors.name.message}</p>}

// Good
import { FormField } from "@green-goods/shared";
<FormField label="Name" required error={errors.name?.message}>
  <input {...register('name')} />
</FormField>
```

## Rule 16: Alert/Error Boxes

Use the `Alert` component from `@green-goods/shared` for all error/warning/info boxes. Never use inline styled divs.

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

## Rule 17: Don't redeclare context the chrome already declares

Persistent chrome (`AppBar` GardenChip, workspace title bar, breadcrumb) is the canonical declaration of which entity the operator is in. Views, page headers, toolbars, list rows, and cards must not restate that same entity. Re-declaration steals vertical space, dilutes the chrome's authority, and trains the eye to ignore the very element that should be ground truth.

```tsx
// Bad — AppBar GardenChip already shows "Aiyeloja Family Garden"
<PageHeader
  title="Work"
  description="Review work flowing through Aiyeloja Family Garden."
  metadata={<MetaStrip items={[{ label: garden.name }]} />}
/>
<WorkbenchRow eyebrow={garden.name} title={...} />
<Card>
  <p>{gardenName}</p>  {/* visible-body duplication */}
</Card>

// Good — header speaks to the stage; rows speak to their own status; chrome owns the garden context
<PageHeader title="Work" description="Review and triage pending submissions." />
<WorkbenchRow eyebrow="Review" title={...} />
<Card>
  {/* Garden context inherited from chrome; no body line needed. Keep it in
      hover-title for accessibility if the card may be detached from chrome. */}
</Card>
```

When to redeclare:
- A list **mixes entities** (cross-garden feed, multi-workspace dashboard) — then the row must name its garden because chrome can't.
- A card may be **detached** from chrome (PDF export, email digest, screenshot share) — keep an accessible `title=""` attribute even if the visible line is removed for in-app contexts.
- The body **disambiguates** (e.g., "the garden's vault is X, the parent DAO's vault is Y") — declaring the qualifier is the whole point of the line.

Otherwise: trust the chrome. Anti-pattern guard for review: search the rendered DOM for the active garden / workspace / entity name; if it appears more than once outside chrome, justify it or remove it.
