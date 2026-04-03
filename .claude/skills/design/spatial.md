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

## Corner Philosophy — Squircles

Sharp corners feel jagged in spatial contexts. Aggressive rounding creates objects that feel safe and physical. Scale rounding with element size:

| Element Size | Border Radius | Examples |
|-------------|---------------|----------|
| Small (chips, tags) | `rounded-xl` (12px) | StatusBadge, MetricChip |
| Medium (cards, inputs) | `rounded-2xl` (16px) | Cards, form fields |
| Large (panels, dialogs) | `rounded-[1.25rem]` (20px) | Panels, sheets |
| Full-screen (sheets) | `rounded-3xl` (24px) | Bottom sheets, full modals |

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

## Depth Without Vision

The Z-layer model relies on visual depth cues (blur, shadow, scale). For users who cannot perceive these, provide alternative hierarchy signals:

- **Semantic HTML**: Z4 overlays use `<dialog>` or `role="dialog"`. Z3 uses `role="tooltip"` or `role="status"`.
- **Focus management**: Higher Z-layers trap focus. Lower layers are inert when overlaid.
- **Announcements**: `aria-live` regions for ambient displays (Z1-Z2) that update without user action.
- **Size and weight**: Higher Z-layers use larger text and heavier font weight — hierarchy through typography, not just blur.
