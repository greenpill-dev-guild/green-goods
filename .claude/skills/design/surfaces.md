# Surfaces — Depth, Materials & Interaction Mechanics

How Warm Earth surfaces get built: the Z-layer depth model, the semantic material system, and the interaction patterns that keep every surface reachable across input modalities. Merged from the former `spatial.md`, `materials.md`, and `interaction.md` (2026-08 round-3 consolidation).

Canonical token values live in root `DESIGN.md` front matter and [language.md](./language.md); this file covers *when and how* to apply them.

---

## Z-Layer Model

Every element has a Z-axis position — a "distance" from the user. Depth creates hierarchy without borders or heavy color contrast.

```text
Z4: Overlay      → Modals, command palettes, critical alerts (thick/solid material, shadow-2xl)
Z3: Floating     → Tooltips, popovers, FABs (backdrop-blur-lg, shadow-lg)
Z2: Surface      → Cards, panels, primary content (backdrop-blur-sm, shadow-sm)
Z1: Ground       → Page background, canvas, ambient texture (no blur, no shadow)
Z0: Substrate    → The "world" behind the app — never directly styled
```

Higher layers use thicker materials for readability. Z4 always uses thick or solid — never ultrathin glass over critical content.

Admin's 6-level elevation system (`packages/admin/src/index.css`) maps onto this: elevation-0 = Z1, elevation-1/2 = Z2, elevation-3/4 = Z3, elevation-5 = Z4.

### Depth Without Vision

Visual depth cues (blur, shadow, scale) need non-visual equivalents:

- **Semantic HTML**: Z4 uses `<dialog>` or `role="dialog"`; Z3 uses `role="tooltip"` / `role="status"`.
- **Focus management**: higher Z-layers trap focus; lower layers go inert when overlaid.
- **Announcements**: `aria-live` regions for ambient surfaces that update without user action.
- **Size and weight**: higher layers also use larger text and heavier weight — hierarchy through typography, not just blur.

---

## Material System

Five semantic materials, most transparent to fully opaque. Materials are information architecture, not decoration — match thickness to content density (glass blur reduces readability).

| Material | Use when | Content ceiling |
|----------|----------|-----------------|
| **Ultrathin** | Purely decorative, ambient indicators | Icons and status dots only — never text |
| **Thin** | Secondary context, status displays | Single-line labels and numeric values |
| **Regular** | Standard cards, panels — the default | Titles, short descriptions, buttons |
| **Thick** | Text-dense content, command surfaces | Mandatory for paragraphs, forms, data tables |
| **Solid** | Unpredictable backgrounds (user images/video), max-contrast needs | Everything — the accessibility floor |

Tokens are shipped in `packages/shared/src/styles/theme.css` — use `var(--color-material-*)` and `var(--blur-material-*)` directly; never hardcode opacity/blur in component code. Dark mode and `prefers-contrast: more` fallbacks (solid backgrounds, no blur) are handled at the token level; materials are progressive enhancement and the solid fallback must always be functional.

### Material pairing

| Paradigm (SKILL.md) | Primary material | Focus behavior |
|---------------------|------------------|----------------|
| Command Surface | Thick or Solid | Admin uses a scrim plus elevation with a centered `AdminDialog` or solid `AdminSideSheet`; lower layers become inert without receding |
| Ambient Display | Thin or Ultrathin | Peripheral; promotes to thick only on autonomic actor failure |
| Data Landscape | Regular | Thickens on drill-in, thins on zoom-out |
| Conversational | Regular or Thick | Thickens during active conversation |
| Ritual | Varies | Dramatic: ultrathin over cinematic bg → thick for the confirmation step |

---

## The Glass Pane Pattern

The foundational visual unit — a pane of glass, not a "card". Variants reference the semantic tokens so dark-mode and contrast fallbacks come for free:

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
      thin: "bg-[color:var(--color-material-thin)] backdrop-blur-[var(--blur-material-thin)]",
      regular:
        "bg-[color:var(--color-material-regular)] backdrop-blur-[var(--blur-material-regular)]",
      thick: "bg-[color:var(--color-material-thick)] backdrop-blur-[var(--blur-material-thick)]",
      solid: "bg-[color:var(--color-material-solid)]",
    },
    elevation: {
      ground: "shadow-none",
      surface: "", // default shadow from base
      floating: "shadow-xl dark:shadow-2xl",
      overlay: "shadow-2xl dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]",
    },
    interactive: {
      true: "cursor-pointer hover:shadow-lg active:scale-[0.98] active:shadow-sm",
      false: "",
    },
  },
  defaultVariants: { material: "regular", elevation: "surface", interactive: false },
});
```

A pane hardcoding `bg-white/65` forgets dark-mode opacity and high-contrast mode entirely — that's why the tokens are mandatory.

**Corners**: shape types, the `child_radius = parent_radius − padding` concentricity formula, radius scale, and pitfalls are canonical in [language.md § Shape System](./language.md#shape-system).

---

## Interaction Mechanics

### Two-modality rule

Every interaction must be reachable through at least two modalities — fallback chain `Keyboard → Touch → Voice → Gaze/Gesture`. The persona spectrum makes exclusion concrete: each modality fails for someone permanently (low vision, limb difference, non-verbal, monocular vision), temporarily (eye strain, RSI, laryngitis, VR sickness), or situationally (glare, holding a child, open office, small screen). A pattern that works only via one channel is incomplete.

### Hover is a preview, not a gate

Design hover states as if the cursor were an eye: generous hit areas (≥ 44px), glow not just color shift, delayed reveal (~300ms) for context. Never hide essential information behind hover — touch and gaze cannot hover; primary content must be visible at rest.

### Adaptive Density

The interface breathes — this is cognitive load management, not visual preference:

```typescript
const densityModes = {
  // Comfortable: onboarding, exploration, reading — the default for new users
  comfortable: { gap: "gap-6", padding: "p-6", text: "text-base", grid: "grid-cols-1 md:grid-cols-2" },
  // Compact: earned — expose as preference or on detected expertise
  compact: { gap: "gap-3", padding: "p-3", text: "text-sm", grid: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4" },
  // Focused: single-task moments needing undivided attention
  focused: { gap: "gap-8", padding: "p-8 md:p-12", text: "text-lg", grid: "grid-cols-1 max-w-lg mx-auto" },
} as const;
```

### Progressive Disclosure

Information appears in layers; the first layer is always calm. Directly implements "Solve for One, Extend to Many".

| Layer | Time | What shows | How it reveals |
|-------|------|------------|----------------|
| **Glance** | < 1s | Title, status dot, one key metric | Always visible |
| **Scan** | 1–3s | Summary, actions, relationships | Hover **and** `focus-within` — never hover-only |
| **Engage** | 3s+ | Full detail, history, configuration | Click/expand |
| **Deep Dive** | Intentional | Raw data, audit trails, settings | Separate surface (dialog/panel) |

Screen readers announce scan-level content when the element receives focus.

### Floating navigation & container queries

Navigation detaches from viewport edges — the client's installed-PWA bottom nav is this pattern (a floating pill on glass; see `feedback_browser_vs_pwa` memory for the PWA/browser split). Build it from the material tokens above, not hardcoded white/opacity values.

Each pane is its own viewport: use the named containers in `theme.css` (`.container-card`, `.container-panel`, …) with `@container` queries so components adapt to their pane, not the screen.

### Scroll-linked depth

Scrolling content moves along the Z-axis (scale + opacity via CSS scroll-driven animations, `animation-timeline: view()`). Gate behind `prefers-reduced-motion: no-preference`; the reduced-motion fallback is an opacity-only cue with no scale transform.

---

## Defined once in language.md

These behaviors are specified in [language.md](./language.md) — use them, don't re-specify:

- **Spring Motion System, Shape Morphing, Hero Moments, Symbol-First Navigation** — § Motion System, § Shape Morphing, § Hero Moments, § Symbol-First Navigation
- **Source-Anchored Interactions, Scroll Edge Effects, Background Extension** — § under the same names
- **Material Focus Variation and Functional Glass Layers** — § Material Behaviors, § Functional Glass Layers
