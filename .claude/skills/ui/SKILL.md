---
name: ui
description: UI development - design system, TailwindCSS v4, Radix UI primitives, accessibility, Storybook, i18n, diagrams. Use for frontend design, theming, component composition, accessibility compliance, stories, internationalization, or creating diagrams.
version: "1.0.0"
status: active
packages: ["shared", "client", "admin"]
dependencies: []
last_updated: "2026-03-18"
last_verified: "2026-03-18"
---

# UI Skill

Unified UI development guide: design thinking, component development, TailwindCSS v4, Radix UI, accessibility, Storybook, i18n, and diagrams.

## Activation

| Domain | Keywords / Triggers | Sub-file |
|--------|-------------------|----------|
| **Design & Aesthetics** | build UI, component, page, visual polish, animation, layout | This file (Parts 1-3) |
| **TailwindCSS** | theme, tokens, dark mode, CSS config, `@theme`, responsive utilities | [tailwindcss.md](./tailwindcss.md) |
| **Radix UI** | dialog, select, popover, accordion, accessible primitive, `asChild` | [radix-ui.md](./radix-ui.md) |
| **Accessibility & Compliance** | WCAG, a11y, form validation, responsive, reduced motion, safe areas | [compliance.md](./compliance.md) |
| **Storybook** | story, stories, CSF3, play function, visual regression | [storybook.md](./storybook.md) |
| **Storybook Addons** | a11y addon, theme switching, design system docs, MDX | [storybook-addons.md](./storybook-addons.md) |
| **Storybook Testing** | visual regression, Chromatic, interaction testing, responsive stories | [storybook-testing.md](./storybook-testing.md) |
| **i18n** | translation, react-intl, locale, RTL, Browser Translation API | [i18n.md](./i18n.md) |
| **Diagrams** | mermaid, flowchart, sequence diagram, state diagram, ERD | [mermaid.md](./mermaid.md) |

When invoked:
- Choose a clear aesthetic direction before writing code.
- Preserve existing Green Goods design tokens when working in existing views/components.
- Pair design work with compliance checks (accessibility + responsive).
- All shared components need Storybook stories.

---

## Part 1: Design Thinking

Before coding, understand the context and commit to a **BOLD** aesthetic direction:

- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme -- brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian. Use these for inspiration but design one that is true to the aesthetic direction.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What is the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work -- the key is intentionality, not intensity.

Then implement working code that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

### Frontend Aesthetics Guidelines

- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a coherent aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. CSS-only for HTML; Motion library for React. One well-orchestrated page load with staggered reveals creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth. Gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, grain overlays.

NEVER use generic AI-generated aesthetics: overused fonts (Inter, Roboto, Arial, system fonts), purple gradients on white, predictable layouts, cookie-cutter design without context-specific character. No two designs should be the same.

### Green Goods Aesthetic Tokens

- **Color**: Primary green (#1FC16B) with earth-toned accents
- **Feel**: Organic, trustworthy, action-oriented (regenerative/nature)
- **Tokens**: Semantic tokens from `packages/shared/src/styles/theme.css`
- **Typography**: `packages/client/src/styles/typography.css` for existing hierarchy
- **Animation**: `packages/client/src/styles/animation.css` for existing motions
- **Consistency**: Same design language whether gardener (client) or operator (admin)

---

## Part 2: Component Development Workflow

1. **Check existing patterns** (GardenCard, WorkCard, StatusBadge, Button, Card, Alert, FormField)
2. **Develop in Storybook first** (`bun run storybook` in packages/shared)
3. **Follow Radix UI + tailwind-variants patterns** (see [radix-ui.md](./radix-ui.md))
4. **Run compliance checklist** before integration (see [compliance.md](./compliance.md))
5. **Test light/dark mode** via Storybook toolbar
6. **Add i18n** for all user-facing strings (see [i18n.md](./i18n.md))

---

## Part 3: Implementation Patterns

### Component Composition with Radix UI + Tailwind

```typescript
// Compound component pattern with Radix primitives
import * as Dialog from "@radix-ui/react-dialog";
import { tv, type VariantProps } from "tailwind-variants";

const overlay = tv({
  base: "fixed inset-0 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
});

const content = tv({
  base: "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-background p-6 shadow-2xl border border-border/50",
  variants: {
    size: {
      sm: "w-[90vw] max-w-sm",
      md: "w-[90vw] max-w-lg",
      lg: "w-[90vw] max-w-2xl",
    },
  },
  defaultVariants: { size: "md" },
});

export function ConfirmDialog({ children, size, ...props }: DialogProps) {
  return (
    <Dialog.Root {...props}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlay()} />
        <Dialog.Content className={content({ size })}>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

### Tailwind Variants for Consistent Component APIs

```typescript
import { tv } from "tailwind-variants";

const badge = tv({
  base: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors",
  variants: {
    status: {
      active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400",
      pending: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400",
      failed: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400",
      offline: "bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-500/10 dark:text-zinc-400",
    },
  },
});

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return <span className={badge({ status })}>{label}</span>;
}
```

### Animation Recipes

```typescript
// Staggered list reveal -- organic feel for garden/work lists
function StaggeredList({ items, renderItem }: StaggeredListProps) {
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li
          key={item.id}
          className="animate-in fade-in-0 slide-in-from-bottom-2"
          style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
        >
          {renderItem(item)}
        </li>
      ))}
    </ul>
  );
}

// Skeleton pulse -- loading states that feel alive
function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 p-4 space-y-3">
      <div className="h-4 w-2/3 rounded-md bg-muted animate-pulse" />
      <div className="h-3 w-full rounded-md bg-muted/70 animate-pulse [animation-delay:150ms]" />
      <div className="h-3 w-4/5 rounded-md bg-muted/50 animate-pulse [animation-delay:300ms]" />
    </div>
  );
}

// Page transition -- smooth view changes
function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in-0 slide-in-from-right-4 duration-300 ease-out">
      {children}
    </div>
  );
}
```

### Card Composition Pattern (Green Goods)

```typescript
// Compound card -- used for GardenCard, WorkCard, ActionCard
const card = tv({
  base: "group relative overflow-hidden rounded-xl border bg-card transition-all",
  variants: {
    interactive: {
      true: "cursor-pointer hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 active:scale-[0.98]",
      false: "",
    },
    elevated: {
      true: "shadow-sm",
      false: "",
    },
  },
  defaultVariants: { interactive: true, elevated: false },
});

function Card({ children, className, interactive, elevated, ...props }) {
  return (
    <div className={card({ interactive, elevated, className })} {...props}>
      {children}
    </div>
  );
}

Card.Header = ({ children, className }) => (
  <div className={cn("flex items-start justify-between p-4 pb-2", className)}>
    {children}
  </div>
);

Card.Body = ({ children, className }) => (
  <div className={cn("px-4 pb-4", className)}>{children}</div>
);

Card.Footer = ({ children, className }) => (
  <div className={cn("flex items-center gap-2 border-t px-4 py-3 bg-muted/30", className)}>
    {children}
  </div>
);
```

### Responsive Layout Patterns

```typescript
// Responsive grid that adapts to content
function ResponsiveGrid({ children, minWidth = "280px" }: GridProps) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}, 1fr))` }}
    >
      {children}
    </div>
  );
}

// Mobile-first stack to row layout
function AdaptiveRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {children}
    </div>
  );
}
```

---

## Reference Files

| File | Content |
|------|---------|
| [tailwindcss.md](./tailwindcss.md) | TailwindCSS v4 CSS-first config, `@theme` directive, `@property` tokens, dark mode via `[data-theme]`, custom utilities, CSS file organization |
| [radix-ui.md](./radix-ui.md) | Radix primitive composition (Dialog, Select, Popover, Slot), namespace imports, built-in a11y, animation with `data-[state]` |
| [compliance.md](./compliance.md) | WCAG 2.1 AA checklist, form patterns (RHF + Zod), responsive breakpoints, container queries, reduced motion, images, mobile safe areas |
| [storybook.md](./storybook.md) | CSF3 story format, play functions, decorators, global configuration, story organization |
| [storybook-addons.md](./storybook-addons.md) | a11y addon rules, theme switching, component API docs with JSDoc, MDX pages, story hierarchy |
| [storybook-testing.md](./storybook-testing.md) | Visual snapshots, responsive stories, Chromatic CI, test runner, multi-step play functions, offline scenarios |
| [i18n.md](./i18n.md) | Hybrid translation (react-intl + Browser Translation API), ICU message syntax, domain hooks, RTL support, Intl formatting |
| [mermaid.md](./mermaid.md) | Diagram type selection, sequence/flowchart/class/ERD examples, canonical diagram locations, rendering platforms |

---

## Anti-Patterns

### Design
1. Shipping generic default UI without an explicit visual direction
2. Ignoring existing design tokens in established Green Goods surfaces
3. Prioritizing novelty over accessibility, readability, and interaction clarity
4. Using placeholder motion without intent (random micro-animations)
5. Creating visual complexity without corresponding information hierarchy

### TailwindCSS
6. Using `tailwind.config.js` instead of CSS-first v4 configuration
7. Using raw color values (`bg-green-500`) instead of semantic tokens (`bg-primary`)
8. Defining theme tokens in app packages instead of `packages/shared/src/styles/theme.css`
9. Skipping dark mode values for new color tokens
10. Using `prefers-color-scheme` instead of `[data-theme]` attribute

### Radix UI
11. Using `@radix-ui/themes` instead of primitives + TailwindCSS
12. Skipping `Dialog.Title` (required for accessibility -- use `sr-only` to visually hide)
13. Destructuring Radix imports instead of namespace imports (`Dialog.Root`, not `Root`)

### Accessibility & Compliance
14. Relying on color alone to convey state or validation failures
15. Shipping forms without accessible labels and error associations (`aria-describedby`)
16. Ignoring `prefers-reduced-motion` for animated interactions
17. Assuming desktop-only layouts without mobile verification

### i18n
18. Hardcoding user-facing strings instead of `intl.formatMessage()` / `FormattedMessage`
19. Forgetting to update all three language files (en.json, es.json, pt.json)
20. Using physical CSS properties (`margin-left`) instead of logical (`margin-inline-start`) for RTL

### Storybook
21. Skipping `tags: ["autodocs"]` on component stories
22. Hardcoding data in stories instead of using mock factories from test-utils
23. Skipping loading/error/empty state stories

---

## Decision Tree

```text
What kind of UI work?
|
+--> Design direction / visual identity?
|    --> This file, Part 1 (Design Thinking)
|    --> Green Goods Aesthetic Tokens
|
+--> New component?
|    --> Part 2 (Component Development Workflow)
|    --> radix-ui.md for primitives
|    --> storybook.md for story co-location
|    --> compliance.md before merge
|
+--> Theme / token / dark mode change?
|    --> tailwindcss.md (Parts 2-3)
|
+--> Accessibility audit?
|    --> compliance.md (Parts 1-2)
|    --> storybook-addons.md (a11y addon)
|
+--> Responsive layout issue?
|    --> compliance.md (Parts 3, 10)
|    --> tailwindcss.md (Part 4)
|
+--> Storybook story or visual regression?
|    --> storybook.md (writing stories)
|    --> storybook-testing.md (visual regression, Chromatic)
|    --> storybook-addons.md (addon config, design system docs)
|
+--> Translation / i18n?
|    --> i18n.md (react-intl + Browser Translation API)
|    --> compliance.md Part 6 (i18n checklist)
|
+--> Architecture / flow diagram?
|    --> mermaid.md (diagram type selection)
|
+--> Animation / motion?
|    --> This file, Part 3 (Animation Recipes)
|    --> compliance.md Part 4 (reduced motion)
```

---

## Related Skills

- `react` -- Component composition, state management, React 19 APIs, performance optimization
- `testing` -- TDD workflow, Vitest patterns, React Testing Library
- `data-layer` -- Offline-first patterns, IndexedDB, sync state that integrates with UI
- `react` (error-handling sub-file) -- Toast service, mutation error handlers, user-facing error messages
- `react` (performance sub-file) -- Bundle budgets, re-render optimization, virtualization
