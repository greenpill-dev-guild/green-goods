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

Material variants reference the semantic material tokens in `packages/shared/src/styles/theme.css` (`--color-material-*` and `--blur-material-*`). Dark mode and `prefers-contrast: more` fallbacks are handled at the token level — the variants below stay light.

```typescript
import { tv } from "tailwind-variants";

const pane = tv({
  base: [
    "relative overflow-hidden rounded-2xl",
    "border-[color:var(--border-material)]",
    "shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04),0_12px_24px_rgba(0,0,0,0.06)]",
    "dark:shadow-[0_0_0_1px_rgba(0,0,0,0.2),0_2px_4px_rgba(0,0,0,0.15),0_12px_24px_rgba(0,0,0,0.25)]",
  ],
  variants: {
    material: {
      ultrathin:
        "bg-[color:var(--color-material-ultrathin)] backdrop-blur-[var(--blur-material-ultrathin)]",
      thin:
        "bg-[color:var(--color-material-thin)] backdrop-blur-[var(--blur-material-thin)]",
      regular:
        "bg-[color:var(--color-material-regular)] backdrop-blur-[var(--blur-material-regular)]",
      thick:
        "bg-[color:var(--color-material-thick)] backdrop-blur-[var(--blur-material-thick)]",
      solid: "bg-[color:var(--color-material-solid)]",
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
        "hover:shadow-lg active:scale-[0.98] active:shadow-sm",
      ],
      false: "",
    },
  },
  defaultVariants: { material: "regular", elevation: "surface", interactive: false },
});
```

**Usage**: `<div className={pane({ material: "thin", elevation: "floating", interactive: true })} />`

**Why tokens, not hardcoded values**: The material tokens drive dark-mode and `prefers-contrast: more` behavior from a single source. A pane defined with hardcoded `bg-white/65` forgets dark-mode glass needs higher opacity and forgets high-contrast mode entirely. See [materials.md](./materials.md) § Accessibility Fallbacks.

---

## Corner Philosophy — Squircles & Concentricity

Sharp corners feel jagged in spatial contexts. Aggressive rounding creates objects that feel safe and physical. Corners follow a mathematical concentricity system.

**Canonical spec:** [language.md § Shape System](./language.md#shape-system) — three shape types (Fixed / Capsule / Concentric), the `child_radius = parent_radius − padding` formula, the full radius scale, and common pitfalls (pinched / flared / device-edge / shape-type clashes).

This file uses those shapes without re-specifying them.

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

## Behavioral Patterns Defined Elsewhere

These spatial patterns are specified once in [language.md](./language.md) — this file uses them without re-specifying:

- **Source-Anchored Interactions** — menus, sheets, tooltips spring from their trigger, not screen edges. See [language.md § Source-Anchored Interactions](./language.md#source-anchored-interactions).
- **Scroll Edge Effects** — soft/hard blur masks replace hard dividers at glass/content boundaries. See [language.md § Scroll Edge Effects](./language.md#scroll-edge-effects).
- **Background Extension** — content flows behind glass; glass provides separation without cropping. See [language.md § Background Extension](./language.md#background-extension).

---

## Depth Without Vision

The Z-layer model relies on visual depth cues (blur, shadow, scale). For users who cannot perceive these, provide alternative hierarchy signals:

- **Semantic HTML**: Z4 overlays use `<dialog>` or `role="dialog"`. Z3 uses `role="tooltip"` or `role="status"`.
- **Focus management**: Higher Z-layers trap focus. Lower layers are inert when overlaid.
- **Announcements**: `aria-live` regions for ambient displays (Z1-Z2) that update without user action.
- **Size and weight**: Higher Z-layers use larger text and heavier font weight — hierarchy through typography, not just blur.
