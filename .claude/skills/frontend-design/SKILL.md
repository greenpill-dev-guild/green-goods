---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, or applications. Generates creative, polished code that avoids generic AI aesthetics.
version: "1.0.0"
status: active
packages: ["shared", "client", "admin"]
dependencies: ["tailwindcss", "radix-ui"]
last_updated: "2026-02-19"
last_verified: "2026-02-19"
---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

> Adapted from [antfu/skills](https://github.com/antfu/skills) frontend-design skill.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Activation

When invoked:
- Choose a clear aesthetic direction before writing code.
- Preserve existing Green Goods design tokens when working in existing views/components.
- Pair this skill with `ui-compliance` for accessibility and responsive checks.

## Part 1: Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. There are so many flavors to choose from. Use these for inspiration but design one that is true to the aesthetic direction.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail.

## Frontend Aesthetics Guidelines

Focus on:
- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics; unexpected, characterful font choices. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a coherent aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays.

NEVER use generic AI-generated aesthetics like overused font families (Inter, Roboto, Arial, system fonts), clichéd color schemes (particularly purple gradients on white backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character.

Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on common choices (Space Grotesk, for example) across generations.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist or refined designs need restraint, precision, and careful attention to spacing, typography, and subtle details. Elegance comes from executing the vision well.

Remember: Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision.

## Green Goods Integration

When implementing UI for Green Goods, this skill works alongside:
- **`ui-compliance`** — Accessibility, responsive, forms, i18n (MANDATORY checks)
- **`react`** — Component composition, state management, performance
- **`testing`** — Storybook stories MANDATORY for new shared components

### Green Goods Aesthetic

- **Color**: Primary green (#1FC16B) with earth-toned accents
- **Feel**: Organic, trustworthy, action-oriented (regenerative/nature)
- **Tokens**: Use semantic tokens from `packages/shared/src/styles/theme.css`
- **Typography**: `packages/client/src/styles/typography.css` for existing hierarchy
- **Animation**: `packages/client/src/styles/animation.css` for existing motions
- **Consistency**: Same design language whether gardener (client) or operator (admin)

### Component Development Workflow

1. Check existing patterns (GardenCard, WorkCard, StatusBadge)
2. Develop in Storybook first (`bun run storybook` in packages/shared)
3. Follow Radix UI + tailwind-variants patterns
4. Run `ui-compliance` checklist before integration
5. Test light/dark mode via Storybook toolbar

See cracked-coder agent's "UI Design Excellence" section for comprehensive Green Goods visual guidelines.

## Implementation Patterns

### Component Composition with Radix UI + Tailwind

```typescript
// ✅ Compound component pattern with Radix primitives
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

// Define variants once, use everywhere
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
// Staggered list reveal — organic feel for garden/work lists
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

// Skeleton pulse — loading states that feel alive
function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 p-4 space-y-3">
      <div className="h-4 w-2/3 rounded-md bg-muted animate-pulse" />
      <div className="h-3 w-full rounded-md bg-muted/70 animate-pulse [animation-delay:150ms]" />
      <div className="h-3 w-4/5 rounded-md bg-muted/50 animate-pulse [animation-delay:300ms]" />
    </div>
  );
}

// Page transition — smooth view changes
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
// Compound card — used for GardenCard, WorkCard, ActionCard
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

// Mobile-first stack → row layout
function AdaptiveRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {children}
    </div>
  );
}
```

## Decision Tree

```text
What kind of UI work?
│
├─► New component? ──────────► Check existing patterns first
│                               → Radix UI + tailwind-variants
│                               → Co-locate story file
│
├─► Visual polish? ──────────► Focus on:
│                               → Animation timing & easing
│                               → Color contrast & dark mode
│                               → Micro-interactions (hover, focus)
│
├─► Layout change? ──────────► Use responsive grid patterns
│                               → CSS logical properties (for i18n)
│                               → Test mobile, tablet, desktop
│
├─► Loading state? ──────────► Skeleton with staggered pulse
│                               → Never block UI on translation
│                               → Match skeleton shape to content
│
└─► Full page/view? ─────────► Start with wireframe composition
                                → Build sections as compound components
                                → Add animation last (page transition)
```

## Anti-Patterns

- Shipping generic default UI without an explicit visual direction
- Ignoring existing design tokens in established Green Goods surfaces
- Prioritizing novelty over accessibility, readability, and interaction clarity
- Using placeholder motion without intent (random micro-animations)
- Creating visual complexity without corresponding information hierarchy

## Related Skills

- `ui-compliance` — Accessibility and responsive design requirements for all UIs
- `radix-ui` — Accessible primitives for interactive components
- `storybook` — Component documentation and visual regression testing
- `react` — React patterns for component composition and state
- `performance` — Bundle size and rendering optimization for complex UIs
