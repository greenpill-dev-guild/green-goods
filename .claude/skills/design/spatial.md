# Spatial Design — Depth-First Design

The Z-axis is a first-class dimension. Every element has a position on the Z-axis — a "distance" from the user. This creates natural hierarchy without borders or heavy color contrast.

## Z-Layer Model

```
Z-Layer Stack
═══════════════════════════════════════
Z4: Overlay      → Modals, command palettes, critical alerts
                    backdrop-blur-xl, shadow-2xl, border-border/50
Z3: Floating     → Tooltips, popovers, floating action buttons
                    backdrop-blur-lg, shadow-lg, elevated above content
Z2: Surface      → Cards, panels, primary content containers
                    backdrop-blur-sm, shadow-sm, slight elevation
Z1: Ground       → Page background, canvas, ambient texture
                    No blur, no shadow, recessive
Z0: Substrate    → The "world" behind the app (wallpaper, environment)
                    Never directly styled — inferred through glass
```

Each layer has a default material thickness. Higher layers use thicker materials for readability. Z4 (overlay) always uses thick or solid material — never ultrathin glass over critical content.

### Mapping to Existing Infrastructure

The admin already has a 6-level elevation system (`packages/admin/src/index.css`). The Z-layer model is a conceptual superset:

| Z-Layer | Admin Elevation | Typical Element |
|---------|----------------|-----------------|
| Z0 | — | Environment / wallpaper |
| Z1 | elevation-0 | Page background |
| Z2 | elevation-1, elevation-2 | Cards, panels |
| Z3 | elevation-3, elevation-4 | Popovers, floating actions |
| Z4 | elevation-5 | Modals, command palette |

---

## The Glass Pane Pattern

The foundational visual unit. Not a "card" — a pane of glass floating in the interface.

```typescript
import { tv } from "tailwind-variants";

const pane = tv({
  base: [
    "relative overflow-hidden rounded-2xl",
    "border border-white/[0.08]",
    "shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04),0_12px_24px_rgba(0,0,0,0.06)]",
    "dark:border-white/[0.06]",
    "dark:shadow-[0_0_0_1px_rgba(0,0,0,0.2),0_2px_4px_rgba(0,0,0,0.15),0_12px_24px_rgba(0,0,0,0.25)]",
  ],
  variants: {
    material: {
      ultrathin: "bg-white/20 backdrop-blur-[30px] dark:bg-black/20",
      thin: "bg-white/40 backdrop-blur-[20px] dark:bg-black/40",
      regular: "bg-white/65 backdrop-blur-[12px] dark:bg-zinc-900/65",
      thick: "bg-white/85 backdrop-blur-[8px] dark:bg-zinc-900/85",
      solid: "bg-card",
    },
    elevation: {
      ground: "shadow-none",
      surface: "", // default shadow from base
      floating: "shadow-xl dark:shadow-2xl",
      overlay: "shadow-2xl dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]",
    },
    interactive: {
      true: [
        "cursor-pointer transition-all duration-200",
        "hover:border-white/[0.15] hover:shadow-lg",
        "active:scale-[0.98] active:shadow-sm",
        "dark:hover:border-white/[0.1]",
      ],
      false: "",
    },
  },
  defaultVariants: { material: "regular", elevation: "surface", interactive: false },
});
```

**Usage**: `<div className={pane({ material: "thin", elevation: "floating", interactive: true })} />`

---

## Corner Philosophy — Squircles & Concentricity

Sharp corners feel jagged in spatial contexts. Aggressive rounding creates objects that feel safe and physical. In Warm Glass ([language.md](./language.md)), corners follow a mathematical concentricity system.

### Three Shape Types

| Type | Behavior | When to Use |
|------|----------|-------------|
| **Fixed** | Constant radius regardless of context | Small elements that don't nest (avatars, badges, status dots) |
| **Capsule** | Radius = half container height (`rounded-full`) | Elements signaling emphasis or interactivity (primary buttons, pills, active indicators) |
| **Concentric** | Radius = parent radius - padding | Elements nested inside containers (cards in panels, content in cards) |

### Concentricity — Shape Nesting

When an element lives inside a container, its corner radius derives from the parent's radius minus the padding between them:

```
child_radius = parent_radius - padding

┌─────────────────────────────────┐  Viewport/page edge: ∞ (or 24px reference)
│ margin: 4px                     │
│  ┌───────────────────────────┐  │  Panel: 24px - 4px = 20px
│  │ padding: 4px              │  │
│  │  ┌─────────────────────┐  │  │  Card: 20px - 4px = 16px
│  │  │ padding: 4px        │  │  │
│  │  │  ┌───────────────┐  │  │  │  Content: 16px - 4px = 12px
│  │  │  │               │  │  │  │
│  │  │  └───────────────┘  │  │  │
│  │  └─────────────────────┘  │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

This eliminates "pinched" or "flared" corners. The eye perceives geometric harmony without conscious awareness.

### Radius Scale (updated)

| Element | Radius | Tailwind Token | Shape Type | Concentric Parent |
|---------|--------|----------------|------------|-------------------|
| Status dots, tiny badges | 4px | `rounded` | Fixed | — |
| Chips, tags | 8px | `rounded-lg` | Fixed | — |
| Content inside cards | 12px | `rounded-xl` | Concentric | Card (16px) - 4px |
| Cards, form inputs | 16px | `rounded-2xl` | Concentric | Panel (20px) - 4px |
| Panels, sheets | 20px | `rounded-[1.25rem]` | Concentric | Page (24px) - 4px |
| Modals, dialogs, bottom sheets | 24px | `rounded-3xl` | Concentric | Viewport edge |
| Primary buttons, icon buttons | half-height | `rounded-full` | Capsule | — |
| Secondary buttons | 12px | `rounded-xl` | Fixed | — |

### Concentric Fallback Pattern

Components that work both inside a container AND standalone use a fallback radius:

```typescript
// Adapts when nested, uses fallback when standalone
const cardRadius = isInsidePanel
  ? parentRadius - padding   // concentric: 20px - 4px = 16px
  : 16;                      // fallback: standalone default
```

### Common Pitfalls

1. **Pinched corners** — Inner element radius too small relative to outer. Fix: make it concentric.
2. **Flared corners** — Inner radius larger than outer minus padding. Fix: reduce inner radius or increase padding.
3. **Near device edges** — On phone, use capsule + extra margin near screen edge for breathing room. On tablet/desktop, use concentric shape aligned to window edge.
4. **Mixing shape types** — Don't put a capsule inside a fixed-radius container if the radii clash. The capsule's inherent geometry naturally supports concentricity.

---

## Scroll-Linked Depth

As content scrolls, it moves along the Z-axis — approaching the user or receding. This trains the "canvas" mental model.

```css
/* Scroll-linked parallax via CSS scroll-driven animations */
@keyframes depth-shift {
  from {
    transform: scale(1);
    opacity: 1;
  }
  to {
    transform: scale(0.95);
    opacity: 0.6;
  }
}

.depth-aware {
  animation: depth-shift linear both;
  animation-timeline: view();
  animation-range: exit 0% exit 50%;
}
```

**Inclusive design note**: Scroll-linked animations must be gated behind `prefers-reduced-motion: no-preference`. For users with vestibular disorders, depth shift via opacity alone (no scale transform) is the fallback.

```css
@media (prefers-reduced-motion: reduce) {
  .depth-aware {
    animation: none;
    /* Fallback: opacity-only depth cue via intersection observer */
  }
}
```

---

## Source-Anchored Interactions

Actions originate from their trigger element, not from screen edges or arbitrary positions. This creates spatial continuity — the user sees *where* the action came from and *where* it returns to.

| Interaction | Source | Motion |
|-------------|--------|--------|
| Dropdown menus | The button that opened them | Spring from button position using `--spring-spatial` |
| Detail panels | The card that was clicked | View transition morph (card → detail via `viewTransitionName`) |
| Side/bottom sheets | The action button | Sheet slides from the button's side of the screen |
| Confirmation dialogs | The action button | Scale from button center using `--spring-spatial` |
| Toast notifications | The action that caused them | Slide from the action's position |
| Tooltips | The element being described | Scale + fade from trigger using `--spring-effects-fast` |

This extends the spatial architecture's "Spatial Origin Rule" (sheets open from the side where triggered) to all interactive surfaces — menus, confirmations, toasts, tooltips.

---

## Scroll Edge Effects

Replace hard dividers at glass/content boundaries with soft blur transitions. These clarify where UI ends and content begins without adding visual clutter.

| Style | Use | Appearance |
|-------|-----|------------|
| **Soft** | Default on mobile/tablet. Interactive elements using glass. | Subtle blur transition at boundary |
| **Hard** | Desktop, admin, text-heavy. Controls without backgrounds, pinned headers. | Stronger, more opaque boundary |

**Rules**:
- Scroll edge effects are NOT decorative — only appear where floating UI overlaps scrollable content
- Don't mix or stack soft and hard on the same view
- One scroll edge effect per scroll view. In split layouts, each pane can have its own.

```css
/* Soft scroll edge — subtle boundary */
.scroll-edge-soft {
  mask-image: linear-gradient(
    to bottom,
    transparent 0px,
    black 12px,
    black calc(100% - 12px),
    transparent 100%
  );
}

/* Hard scroll edge — stronger boundary for desktop/admin */
.scroll-edge-hard {
  mask-image: linear-gradient(
    to bottom,
    transparent 0px,
    black 4px,
    black calc(100% - 4px),
    transparent 100%
  );
}
```

---

## Background Extension

Content extends behind glass surfaces for immersion. The glass layer floats above content — content should feel continuous, not cropped by UI elements.

| Pattern | Where |
|---------|-------|
| Hero images extend behind sidebar glass | Admin garden detail — banner flows behind nav rail |
| Garden banners extend behind nav bar | Client PWA — banner visible through top glass |
| Ambient color wash behind glass layers | Workspace atmospheres visible in margins around canvas |

**Rule**: Text and controls must always layer above the extended background. Glass material provides the separation — content behind glass is visible but not interactive. Use `z-index` to keep interactive elements above the extension.

```css
/* Content extends behind inset sidebar */
.content-extended {
  margin-left: calc(-1 * var(--sidebar-width));
  padding-left: var(--sidebar-width);
}

/* Sidebar glass floats above */
.sidebar-glass {
  position: fixed;
  backdrop-filter: blur(var(--blur-material-regular));
  background: var(--color-material-regular);
  z-index: var(--z-chrome);
}
```

---

## Depth Without Vision

The Z-layer model relies on visual depth cues (blur, shadow, scale). For users who cannot perceive these, provide alternative hierarchy signals:

- **Semantic HTML**: Z4 overlays use `<dialog>` or `role="dialog"`. Z3 uses `role="tooltip"` or `role="status"`.
- **Focus management**: Higher Z-layers trap focus. Lower layers are inert when overlaid.
- **Announcements**: `aria-live` regions for ambient displays (Z1-Z2) that update without user action.
- **Size and weight**: Higher Z-layers use larger text and heavier font weight — hierarchy through typography, not just blur.
