# Surfaces: Depth, Materials & Interaction Mechanics

How Warm Earth surfaces get built: the Z-layer depth model, solid surfaces, and the interaction patterns that keep every surface reachable across input modalities. Merged from three former sub-files of this skill in the 2026-08 round-3 consolidation.

Canonical token values live in root `DESIGN.md` front matter and [language.md](./language.md); this file covers *when and how* to apply them.

---

## Z-Layer Model

Every element has a Z-axis position: a "distance" from the user. Depth creates hierarchy without borders or heavy color contrast.

```text
Z4: Overlay      → Modals, command palettes, critical alerts (solid, var(--shadow-float))
Z3: Floating     → Tooltips, popovers, FABs (solid, var(--shadow-elevation-3))
Z2: Surface      → Cards, panels, primary content (solid, var(--shadow-elevation-2))
Z1: Ground       → Page background, canvas, ambient texture (no blur, no shadow)
Z0: Substrate    → The "world" behind the app, never directly styled
```

Every layer is solid, and depth comes from shadow, the scrim, and stacking order rather than translucency; the cockpit's nav dock is the one exception (§ Solid Surfaces, DL-108).

Admin backs the Z-model with the single 2-level ladder (`--m3-elevation-0/1/2` in `packages/admin/src/styles/admin-m3-tokens.css`) plus the warm chrome shadow (`--admin-chrome-shadow`) for floating chrome at Z3. Dialogs sit at level 2 over their scrim; Z4 separation comes from the scrim, not a bigger shadow.

### Depth Without Vision

Visual depth cues (blur, shadow, scale) need non-visual equivalents:

- **Semantic HTML**: Z4 uses `<dialog>` or `role="dialog"`; Z3 uses `role="tooltip"` / `role="status"`.
- **Focus management**: higher Z-layers trap focus; lower layers go inert when overlaid.
- **Announcements**: `aria-live` regions for ambient surfaces that update without user action.
- **Size and weight**: higher layers also use larger text and heavier weight: hierarchy through typography, not just blur.

---

## Solid Surfaces

This section replaces § Material System. Every surface that carries content or controls is solid, in the installed app, the cockpit, and the public website alike: cards, panels, sheets, dialogs, menus, popovers, and bars (DL-108). A surface takes an opaque fill (`var(--color-material-solid)` in Shared, the surface's own card token in each app, never a hardcoded `bg-white/65`), and its depth comes from its shadow tier and stacking order.

- **One translucent piece**: the cockpit's nav dock (the `NavigationBar` with its FAB), a flat 85% surface with a 12px blur, a warm ambient shadow, and a 1px ink ring (Controlled Chrome in `packages/admin/DESIGN.md`). Nothing else is translucent.
- **The scrim is not a surface**: a dialog or sheet that interrupts the main flow dims the page behind it with the shared scrim. The scrim carries no content.
- **Transparent chrome is not glass**: a chrome root with no fill and no blur at all (the cockpit's `AppBar` root, `MainSheet` and route frame, and the website's `SiteHeader` over its hero) draws nothing behind its controls. Its controls sit on the page or carry their own solid fills.
- **Glass in code is residue**: the translucent `--color-material-*` steps and `glass-surface` (Shared's `MainSheet`) stay in Shared only until nothing renders them. `glass-surface` is the last `glass-*` utility once step 19's code change puts `WorkbenchCard` on the shared card surface and deletes `glass-raised` with `WorkbenchList`. `Surface` draws all four of its levels solid. New UI never reaches for any of them. `--color-material-solid` stays the solid fill, and the dock reads its blur from `--blur-material-regular`.

---

## Panes and Corners

A pane is a solid surface with a corner, a shadow tier, and a defined edge, built from tokens so dark mode and `prefers-contrast: more` come for free. Each surface's guide sets its card anatomy; the cockpit's depth is the 2-level `--m3-elevation-0/1/2` ladder, and its interactive surfaces step elevation only (no scale-press).

**Corners**: shape types, the `child_radius = parent_radius − padding` concentricity formula, radius scale, and pitfalls are canonical in [language.md § Shape System](./language.md#shape-system).

---

## Interaction Mechanics

### Two-modality rule

Every interaction must be reachable through at least two modalities (fallback chain `Keyboard → Touch → Voice → Gaze/Gesture`). The persona spectrum makes exclusion concrete: each modality fails for someone permanently (low vision, limb difference, non-verbal, monocular vision), temporarily (eye strain, RSI, laryngitis, VR sickness), or situationally (glare, holding a child, open office, small screen). A pattern that works only via one channel is incomplete.

### Hover is a preview, not a gate

Design hover states as if the cursor were an eye: generous hit areas (≥ 44px), glow not just color shift, and a brief contextual reveal using the shared effects timing. (Admin carve-out: cockpit hovers never glow: an elevation step or the neutral `rgb(var(--m3-on-surface)/0.08)` ink layer only, and a card or item row takes the ink layer only, DL-102.) Never hide essential information behind hover: touch and gaze cannot hover; primary content must be visible at rest.

### Adaptive Density

The interface breathes. This is cognitive load management, not visual preference:

```typescript
const densityModes = {
  // Comfortable: onboarding, exploration, reading (the default for new users)
  comfortable: { gap: "gap-6", padding: "p-6", text: "text-base", grid: "grid-cols-1 md:grid-cols-2" },
  // Compact: earned, so expose as preference or on detected expertise
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
| **Scan** | 1–3s | Summary, actions, relationships | Hover **and** `focus-within`, never hover-only |
| **Engage** | 3s+ | Full detail, history, configuration | Click/expand |
| **Deep Dive** | Intentional | Raw data, audit trails, settings | Separate surface (dialog/panel) |

Screen readers announce scan-level content when the element receives focus.

### Floating navigation & container queries

Navigation can detach from viewport edges: the cockpit's nav dock floats above the canvas, the one translucent surface (§ Solid Surfaces). The installed app's bottom bar stays solid on the bottom edge. Build either from tokens, not hardcoded white/opacity values.

Each pane is its own viewport: use the named containers in `theme.css` (`.container-card`, `.container-panel`, …) with `@container` queries so components adapt to their pane, not the screen.

### Scroll-linked depth

Scrolling content moves along the Z-axis (scale + opacity via CSS scroll-driven animations, `animation-timeline: view()`). Gate behind `prefers-reduced-motion: no-preference`; the reduced-motion fallback is an opacity-only cue with no scale transform.

---

## Defined once in language.md

These behaviors are specified in [language.md](./language.md). Use them instead of re-specifying them:

- **Spring Motion System, Shape Morphing, Hero Moments, Symbol-First Navigation**: § Motion System, § Shape Morphing, § Hero Moments, § Symbol-First Navigation
- **Source-Anchored Interactions, Scroll Edge Effects, Background Extension**: § under the same names
- **Focus Variation and the Content-Forward Principle**: § Material Behaviors, § Structure & Layout
