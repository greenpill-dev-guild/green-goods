# Warm Earth — Design Language

> Material expression through spatial structure. The warmth of color, shape, and spring physics wrapped in the geometric precision of hierarchy and concentricity.

**Warm Earth** is Green Goods' design language — a synthesis of [M3 Expressive](https://m3.material.io/) and [Liquid Glass](https://developer.apple.com/design/) that creates interfaces feeling alive, friendly, and spatially precise. It builds on the existing Adaptive Surface paradigm, Z-layer model, and material system. Those foundations remain — the Warm Earth language adds the visual/interaction identity.

This file is the detailed Warm Earth implementation guide. The root `DESIGN.md` YAML front matter is the canonical DesignMD token source; this file, sibling sub-files (`spatial.md`, `interaction.md`, `materials.md`), generated artifacts, and runtime CSS are projections that explain or consume that source for implementation.

---

## Philosophy

### Sources

**Material 3 Expressive brings the soul** — warmth, color, spring-based animation, organic shapes, friendliness. Backed by 46 user studies and 18,000 participants proving that expressive UIs are preferred across all age groups, spotted key elements up to 4x faster, and dramatically erased the usability age gap.

**Apple's Liquid Glass brings the skeleton** — concentricity, functional glass layers, structural precision, content-forward hierarchy, source-anchored interaction. A system-level rethinking of how glass material creates spatial depth, with mathematical shape nesting and clear functional layer separation.

**Green Goods adds the meaning** — regenerative principles, ecological time, capability over extraction. The interface is a garden tool, not a financial terminal. Every element serves communities documenting real-world impact.

### Three Qualities

Every surface, component, and interaction in Green Goods expresses:

1. **Warmth** — Higher chroma colors, spring-based motion, shape morphing on interaction, organic loading shapes. The interface feels friendly and alive, not sterile and flat.

2. **Clarity** — Concentricity, functional layer separation, content-forward hierarchy, scroll edge effects. Structure is self-evident, never decorated into existence.

3. **Purpose** — Every element serves the mission. No engagement hacking. No dark patterns. The regenerative design lens ([regenerative.md](./regenerative.md)) applies to visual expression too — solarpunk warmth, not trading-floor urgency.

### What We Do NOT Take

**From M3 Expressive** — skipped: 35 iconic shapes (we use garden-themed shapes selectively), 5 button sizes (we use 3), button groups, split buttons, FAB menu, carousel, slider (future work if needed).

**From Liquid Glass** — skipped: platform-specific macOS density rules, SF Symbols dependency, SwiftUI-specific APIs. We take the principles, not the Apple-platform implementation.

---

## Shape System

### Three Shape Types

Adapted from Apple's Liquid Glass, these three types create geometric harmony across all UI elements:

| Type | Behavior | When to Use | Examples |
|------|----------|-------------|----------|
| **Fixed** | Constant corner radius regardless of context | Small elements that don't nest | Avatars, badges, status dots, chips |
| **Capsule** | Radius = half the container height | Elements that signal emphasis or interactivity | Primary buttons, pills, sliders, nav active indicators, icon buttons |
| **Concentric** | Radius = parent radius - padding | Elements nested inside containers | Cards inside panels, content inside cards, inputs inside dialogs |

### Concentricity Rule

When an element lives inside a container, its corner radius derives from the parent's radius minus the padding between them. This eliminates "pinched" or "flared" corners that create visual tension.

```
child_radius = parent_radius - padding

┌─────────────────────────────────┐  Panel: 20px radius
│ padding: 4px                    │
│  ┌───────────────────────────┐  │  Card: 20px - 4px = 16px radius
│  │ padding: 4px              │  │
│  │  ┌─────────────────────┐  │  │  Content: 16px - 4px = 12px radius
│  │  │                     │  │  │
│  │  └─────────────────────┘  │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**Fallback pattern** — Components that work both nested and standalone use a concentric shape with a fallback radius. The concentric value adapts when nested; the fallback kicks in when the component stands alone:

```typescript
// Conceptual pattern — adapts to context
const cardRadius = isNested
  ? parentRadius - padding   // concentric: derives from parent
  : 16;                      // fallback: standalone default
```

### Radius Scale

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

### Shape & Emphasis Hierarchy

Shape communicates emphasis level. This is the core Warm Earth principle for buttons and interactive elements:

| Emphasis | Shape | Morph on Press | Use |
|----------|-------|----------------|-----|
| **Primary / hero** | Capsule (`rounded-full`) | Pill tightens toward squircle | CTAs, FABs, hero actions, "Create Garden" |
| **Secondary / functional** | Squircle (`rounded-xl`) | Radius tightens further | Toolbar actions, form submits, "Cancel" |
| **Icon buttons** | Capsule (`rounded-full`) | Circle squishes toward square | Settings gear, search, nav icons |
| **Ghost / text** | None (inherits parent) | Subtle background appears | Inline links, tertiary actions |

**Rule**: When a capsule button sits next to a squircle button, the capsule reads as primary and the squircle as secondary — no color difference needed. Shape alone creates hierarchy.

### Shape Morphing

Interactive elements shift shape on engagement. This creates physical, tactile feedback — the "Expressive touch" from M3 that makes interfaces feel alive.

**Buttons**:
- Capsule buttons (primary): pill tightens toward squircle on press, springs back on release
- Squircle buttons (secondary): radius tightens subtly on press, springs back
- Both use `--spring-spatial-fast` for the morph transition

**Cards** (complements lift-and-press):
- Hover: scale(1.008) + green shadow glow (lift-and-press)
- Press: scale(0.985) + corner radius tightens 2-4px (shape morph addition)
- Combined: the card feels like it's being pressed into the surface

**CSS approach sketch**:
```css
/* Capsule button — morph on press */
.btn-primary {
  border-radius: 9999px; /* capsule at rest */
  transition: border-radius var(--spring-spatial-fast),
              transform var(--spring-spatial-fast);
}
.btn-primary:active {
  border-radius: var(--radius-xl); /* tightens to squircle */
}

/* Squircle button — tighten on press */
.btn-secondary {
  border-radius: var(--radius-xl); /* squircle at rest */
  transition: border-radius var(--spring-spatial-fast);
}
.btn-secondary:active {
  border-radius: var(--radius-lg); /* tightens further */
}

/* Card — complement lift-and-press with radius tighten */
.card-interactive:active {
  transform: scale(0.985);
  border-radius: calc(var(--radius-2xl) - 2px);
}
```

### Common Shape Pitfalls

From Apple's Liquid Glass talk — watch for these as you build:

1. **Pinched corners** — Inner element radius too small relative to outer. Fix: make it concentric.
2. **Flared corners** — Inner radius larger than outer minus padding. Fix: use `concentricShape(fallback)`.
3. **Near device edges** — On phone, use capsule + extra margin near screen edge. On tablet/desktop, use concentric shape aligned to window edge.
4. **Mixing shape types** — Don't put a capsule button inside a fixed-radius container if the radii clash. The capsule's geometry naturally supports concentricity.

---

## Motion System

### Spring Tokens

All animation uses named spring tokens. No hardcoded `cubic-bezier` or `duration` values in component code. Springs produce fluid, natural motion that responds gracefully to interruption.

| Token | CSS Value | Duration | Use |
|-------|-----------|----------|-----|
| `--spring-spatial` | `cubic-bezier(0.16, 1, 0.3, 1)` | 300ms | Layout shifts, navigation, expand/collapse, sheets |
| `--spring-spatial-fast` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 200ms | Button press, toggles, micro-interactions |
| `--spring-spatial-slow` | `cubic-bezier(0.16, 1, 0.3, 1)` | 400ms | Hero transitions, page morphs, view transitions |
| `--spring-effects` | `cubic-bezier(0.2, 0, 0, 1)` | 250ms | Opacity, color, blur, material transitions |
| `--spring-effects-fast` | `cubic-bezier(0.2, 0, 0, 1)` | 150ms | Hover states, focus rings, tooltip appearance |
| `--spring-effects-slow` | `cubic-bezier(0.2, 0, 0, 1)` | 500ms | Loading indicators, progress bars, ambient pulse |

**Implementation** — shipped in `packages/shared/src/styles/theme.css`:
```css
:root {
  --spring-spatial: cubic-bezier(0.16, 1, 0.3, 1) 300ms;
  --spring-spatial-fast: cubic-bezier(0.34, 1.56, 0.64, 1) 200ms;
  --spring-spatial-slow: cubic-bezier(0.16, 1, 0.3, 1) 400ms;
  --spring-effects: cubic-bezier(0.2, 0, 0, 1) 250ms;
  --spring-effects-fast: cubic-bezier(0.2, 0, 0, 1) 150ms;
  --spring-effects-slow: cubic-bezier(0.2, 0, 0, 1) 500ms;
}
```

Each token is a `cubic-bezier(...) duration` pair — usable directly as a transition shorthand: `transition: transform var(--spring-spatial-fast);`. Reduced motion is handled globally — do not gate per-component.

### Motion Schemes

Two schemes control the personality of motion across the interface:

| Scheme | When | Feel | Spring Character |
|--------|------|------|-----------------|
| **Standard** | Productivity, data-dense, operator cockpit | Efficient, professional, minimal overshoot | Spatial tokens as defined above |
| **Expressive** | Hero moments, celebrations, onboarding, ritual | Playful, bouncy, delightful overshoot | Spatial tokens with +50% duration and higher overshoot |

**Standard** is the default for the admin cockpit — operators scanning a review queue need motion that aids, not entertains. **Expressive** activates for hero moments (see § Hero Moments) — garden creation, first submission, hypercert minting.

The motion scheme is set at the surface level, not per-component. A "Ritual" paradigm surface uses Expressive; a "Command Surface" uses Standard.

### Component Motion Map

Motion is built into components, not applied externally:

| Component | Motion | Spring Token |
|-----------|--------|-------------|
| **Buttons** | Shape morph on press (capsule → squircle or squircle → tighter) | `--spring-spatial-fast` |
| **Cards** | Hover lift (scale 1.008) + press (scale 0.985 + radius tighten) | `--spring-spatial-fast` |
| **Sheets** | Slide from source element, canvas recedes | `--spring-spatial` |
| **Navigation** | Active indicator slides with spring transition | `--spring-spatial` |
| **Progress (wavy)** | Organic wave motion on track | `--spring-effects-slow` |
| **Loading indicator** | Organic shape rotation/pulse | `--spring-effects-slow` |
| **Floating toolbar** | Spring entrance, dock transition | `--spring-spatial` |
| **View transitions** | Cross-fade + scale morph between routes | `--spring-spatial-slow` |
| **Focus rings** | Fade-in on keyboard focus | `--spring-effects-fast` |
| **Tooltips** | Scale + fade from trigger | `--spring-effects-fast` |

### Reduced Motion

All spring animation degrades gracefully for `prefers-reduced-motion: reduce`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Shape morphing, focus variation, and scroll edge effects are purely visual polish — the interface remains fully functional with instant transitions. No information is conveyed through motion alone.

---

## Color Direction

### Role Hierarchy

Green Goods uses a **four-role volume hierarchy** anchored in the root `DESIGN.md`. The roles describe *how much of the screen each color occupies*, not a palette ranking:

| Role | Volume | Color | Internal Token | Job |
|------|--------|-------|----------------|-----|
| **Neutral (canvas)** | 80-90% | Warm linen — #FAF8F5 / dark #1C1917 | `--bg-white-0`, `--bg-weak-50` | Background, breathing room |
| **Primary (ink)** | 8-15% | Warm charcoal — #292524 / dark #F5F5F4 | `--text-strong-950` | Headings, body, core content |
| **Secondary (stone)** | 3-5% | Earth stone — #78716C / dark #A8A29E | `--text-sub-600` | Metadata, borders, labels |
| **Tertiary (accent)** | 1-3% | Garden green — #1FC16B | `--color-primary` | CTAs, active states, value-flow moments |

**Rule:** Tertiary (green) is third in volume but first in visual pull. The bright flower — draws the eye *because* everything else is quiet. Flooding the screen with green is the #1 degen-aesthetic failure mode.

> **Token-name caveat:** the codebase label `--color-primary` is an internal string — it resolves to the **tertiary role** (green as accent). This file, root `DESIGN.md`, and AI-prompt vocabulary all use role names. The internal token stays as-is; no rename needed.

### Supporting Accents

Situational, not core hierarchy. Used where state communication needs a dedicated hue:

| Accent | Hex | Use |
|--------|-----|-----|
| **Amber** | `#D97706` | Warnings, seasonal indicators, secondary warmth |
| **Sky** | `#3B82F6` | Information, external links, evaluation/assessment context |

**State colors:** Information (Sky), Warning (Amber), Error (red), Success (Tertiary green).

### Expressive Color Principles

From M3 Expressive: colors should be brighter, richer, more diverse. The upgrade path from Green Goods' current RGB tokens:

1. **Higher chroma** — OKLCH color space unlocks more vibrant, perceptually uniform colors across all hues. Current RGB triplets are the bridge; OKLCH tokens are the destination.
2. **Brighter content colors** — Text and icons on tinted surfaces (on-container treatment) use higher-chroma values for visual pop without sacrificing readability.
3. **Diverse hue range** — Dynamic color produces wider variation, so users choosing soft neutrals AND juicy vibrance both get rich experiences.

### Tonal Surface Hierarchy

Group related content using tonal surface variants, not just cards and borders:

| Surface Level | Use | Visual |
|---------------|-----|--------|
| `surface` | Page background | Lightest tone |
| `surface-container` | Content groups, sections | Slightly elevated tone |
| `surface-container-high` | Emphasized groups, active states | Noticeable tonal lift |

This creates nuanced hierarchy that guides users through the screen without relying on borders or shadows alone. Combined with glass materials, tonal surfaces show through translucent layers.

### Dynamic Garden Theming

Each garden can derive an accent palette from its visual identity — this is M3's dynamic color adapted for Green Goods' multi-tenancy:

| Context | Palette Source |
|---------|---------------|
| Admin dashboard (default) | Green Goods brand — primary green |
| Garden detail view | Derived from garden's banner image |
| Client PWA | Adapts to the garden the user operates in |
| Workspace atmospheres | Subtle tonal wash per workspace (already spec'd in spatial architecture) |

**Implementation note**: Dynamic garden theming is aspirational — the brand palette is the baseline. Garden-derived palettes are a future enhancement when the garden profile system supports banner images.

### Glass Color Harmony

Colors must read well through translucent glass surfaces. Considerations:

- **On glass text**: Needs higher contrast than on solid backgrounds. Glass blur reduces perceived contrast.
- **Tinted glass**: Subtle color tint in glass material shifts how content colors appear. Test accent colors through all 5 material thicknesses.
- **Dark mode**: Glass materials need higher opacity in dark mode (already handled in material tokens). Colors shift to lighter tints for readability.

### Dark Mode Palette (Admin)

Admin dark mode is a **deliberate palette, not a light inversion**. Three rules carry it; all values live in admin-scoped files (`packages/admin/src/index.css`, `admin-m3-tokens.css`) so the client PWA is untouched. Toggle is `[data-theme="dark"]` on `<html>`.

**1 — Warm surface ladder (Warm Earth at low lightness).** Surfaces keep a constant warm hue (~65 OKLCH) with raised chroma so they read warm even when dark. Following the M3-dark convention, **higher elevation = lighter** — the card sits a clear lightness step above the canvas, so separation comes from *tonal lift, not a drop shadow* (black shadows are invisible on near-black).

| Role (`--m3-*`) | OKLCH intent | RGB triplet | Job |
|---|---|---|---|
| `surface` / `surface-dim` | `16% .012 65` | `17 12 8` | Canvas floor |
| `surface-container-lowest` | `13% .010 65` | `10 7 4` | Sunken wells |
| `surface-container-low` | `19% .014 65` | `24 19 13` | Quiet grouping |
| `surface-container` | `22% .015 65` | `32 25 19` | **Default card** |
| `surface-container-high` | `26% .016 65` | `42 35 28` | Sheet / dialog |
| `surface-container-highest` | `30% .018 65` | `52 44 36` | Active / hover, chips |

**2 — Ring-forward elevation.** Depth is a warm-white hairline ring (`--neutral-50` at 6–16%, scaling with level) plus a small black blur only for chrome floating over content — never a black drop shadow as the primary cue. The canvas wash carries each workspace's hue at L≈17% (just under the card) with chroma ~0.024 (community ~0.034); the dark `--tone-strength` default is `1` (the wash chroma is too low to oversaturate).

**3 — Per-view accents (dual-use-safe).** `--tone-primary` feeds `--m3-primary`, which components consume **both** as a white-text fill **and** as on-surface text/icon/link color. So `--tone-primary` stays **light** (the `-200` step, readable as text on the dark card); saturation lives in `--tone-action` (deep, white-text filled CTA) and vividness in the wash + bright accent text. Never set `--tone-primary` to a deep step — it would make tone-colored links/icons unreadable.

| Tone | Filled action (white-safe) | Accent text on card | Container / on |
|---|---|---|---|
| hub (blue) | `blue-700` · 7.3:1 | `blue-200` · 11.7:1 | `blue-900` / `blue-100` |
| garden (green) | `green-800` · 5.7:1 | `green-200` · 14.4:1 | `green-900` / `green-100` |
| community (amber/gold) | `orange-700` · 5.0:1 (deep amber — gold identity from wash/accent, not the fill) | `yellow-200` · 14.9:1 | `yellow-900` / `yellow-100` |
| actions (red) | `red-700` · 6.5:1 | `red-200` · 12.0:1 | `red-900` / `red-100` |
| home (stone) | `neutral-600` · 7.6:1 | `neutral-300` · 11.7:1 | `neutral-700` / `neutral-100` |

**Contrast invariant:** filled actions carry white text and MUST clear AA (≥4.5:1) — this forces *deep* steps, so "vivid" can never come from brightening the fill. Accent-text `-200` steps clear AA on the `surface-container` card (≥11.7:1). A `check:design-tokens` dark-parity guard enforces light/dark tone-block and elevation parity.

---

## Component Patterns

Admin-relevant subset. Components not listed here (button groups, split button, FAB menu, carousel, slider, XS/XL buttons) are recognized in the Warm Earth vocabulary but deferred for future specification.

### Button System

Three sizes, shape-as-emphasis hierarchy:

| Size | Height | Shape | Morph on Press | Use |
|------|--------|-------|----------------|-----|
| **SM** | 32px | Squircle (`rounded-xl`) | Tightens to `rounded-lg` | Toolbar actions, compact secondary, inline |
| **MD** | 40px | Squircle (`rounded-xl`) | Tightens to `rounded-lg` | Default — forms, dialogs, table actions |
| **LG** | 48px | Capsule (`rounded-full`) | Tightens to `rounded-xl` | Hero CTAs, mobile primary, FABs |

**Icon buttons**: Always capsule (`rounded-full`), morph toward square on press. Three widths matching the three sizes (32/40/48px).

**Color variants** (from M3): Filled, Tonal, Outlined, Ghost. Combined with shape, these give sufficient hierarchy without introducing more sizes.

### Floating Toolbar

Contextual page-level actions. The admin cockpit's primary action surface.

- Desktop: always visible, docked to content zone edge or floating centered
- Mobile: replaced by bottom navigation bar
- Pairs with FAB for hero action emphasis
- Holds buttons, icon buttons, and search field
- Uses glass material (`bg-bg-soft/95 backdrop-blur-lg`)
- Capsule shape (the toolbar itself is a capsule container; items inside are concentric)

### Sheets

> **Admin cockpit exception**: the operator cockpit (`packages/admin`) has **retired side sheets** — every admin action and detail/inspection flow is a centered `AdminDialog` (full-viewport scrim; bottom-sheet on mobile). See [prompt-contract.md § Overlays: Centered AdminDialog Everywhere](./prompt-contract.md). The sheet motion below applies to the **client PWA** (wallet drawer, mobile detail flows) and the shared primitives; `SheetBody` / `SheetFooter` / `SheetDivider` also survive as layout primitives *inside* an `AdminDialog` body.

Detail surfaces that slide from the edge, anchored to their trigger (source-anchored interaction):

| Type | Motion | Use |
|------|--------|-----|
| **Side sheet** (desktop) | `translateX(±100%→0)` with `--spring-spatial` | Work review, settings, garden context, member management |
| **Bottom sheet** (mobile) | `translateY(100%→0)` with `--spring-spatial` | Same content, adapted for vertical screen |

Admin canvas recedes when a bounded sheet opens: `translateY(var(--canvas-recede-y, 8px)) + opacity(var(--canvas-opacity-receded, 0.95)) + blur(var(--canvas-blur-receded, 1.5px))`. Parallel admin sheets avoid dark scrims; viewport dialogs and installed-PWA sheets may use the shared scrim token when they interrupt the main flow.

### Navigation

| Component | Context | Shape | Behavior |
|-----------|---------|-------|----------|
| **Nav Bar** (bottom) | Mobile, 3-4 tabs | Capsule container, capsule active indicator | Symbol-first, tap to switch workspace |
| **Nav Rail** (side) | Tablet, desktop sidebar | Collapsible (icons only) / expandable (icons + labels) | Icon moves from above to beside label when expanded |
| **Floating Toolbar** | Desktop content zone | Capsule, glass material | Contextual actions, always visible |

**Symbol-first rule** (from Liquid Glass): Persistent navigation uses symbols (icons). Text labels only when the icon is genuinely ambiguous. Don't pair a symbol with text in a way that looks like a single button — if you need text, let it sit on its own container.

**Grouping** (from Liquid Glass): Related bar items share a glass background. Items grouped using the correct API automatically share spatial relationship. Don't group symbols with text labels.

### Progress & Loading

| Component | Style | Use |
|-----------|-------|-----|
| **Linear progress** | Wavy track configuration | File upload, sync progress, pipeline completion |
| **Circular progress** | Wavy track configuration | Processing, ongoing operations |
| **Loading indicator** | Organic shapes (leaf, seed, sprout) | Content loading, pull-to-refresh |

Wavy progress makes the indicator feel alive and active — the progress isn't just filling a bar, it's growing. Organic loading shapes align with Green Goods' regenerative identity — a sprouting seed instead of a generic spinner.

**Accessibility**: Wavy styling is purely decorative. The progress value is communicated via `aria-valuenow`. Loading indicators use `aria-busy` and `aria-label`.

---

## Material Behaviors

New behavioral patterns for glass materials, synthesized from Liquid Glass. These extend the existing material system ([materials.md](./materials.md)) with dynamic responses.

### Focus Variation

Glass material shifts as user engagement deepens. This replaces the binary "transparent or opaque" model with a continuous spectrum:

| Engagement Level | Material Response | Interaction Pattern |
|-----------------|-------------------|---------------------|
| **Browsing** | Default glass — transparent, content shows through | User scanning, not focused on any element |
| **Engaged** | Slightly more opaque, material settles | User interacting with a specific surface |
| **Deep focus** (modal/sheet) | Opaque glass + dimming layer behind | Task interrupts main flow — center attention |
| **Parallel task** (side panel) | Lighter glass, no dimming | Task happens alongside main flow — maintain context |

**Dimming vs separation** (from Liquid Glass):
- **Dimming layer** for modal interruption: sheet opens, canvas dims behind it. The user's attention is redirected.
- **Glass separation** for parallel tasks: panel slides in, canvas recedes slightly but stays visible. The user maintains awareness of both contexts.

This maps to the spatial architecture's canvas recession states: bounded admin sheet-active uses `translateY(var(--canvas-recede-y, 8px)) + opacity(var(--canvas-opacity-receded, 0.95)) + blur(var(--canvas-blur-receded, 1.5px))`, with full restoration on dismiss.

### Source-Anchored Interactions

Actions originate from their trigger element, not from screen edges or arbitrary positions. This creates spatial continuity — the user sees *where* the action came from.

| Interaction | Source | Motion |
|-------------|--------|--------|
| **Dropdown menus** | The button that opened them | Spring from button position |
| **Detail panels** | The card that was clicked | View transition morph (card → detail) |
| **Confirmation sheets** | The action button | Sheet slides from the button's side of the screen |
| **Toast notifications** | The action that caused them | Slide from the action's position |
| **Tooltips** | The element being described | Scale + fade from trigger |

**Rule** (from Liquid Glass): Apply the material directly to the control, not its inner views. When making custom controls, the glass material sits on the control itself, and the action sheet's source role is assigned to the control.

This extends the spatial architecture's "Spatial Origin Rule" — sheets open from the side where you triggered them — to all interactive surfaces.

### Scroll Edge Effects

Replace hard dividers at glass/content boundaries with soft blur. Scroll edge effects clarify where UI ends and content begins, without adding visual clutter.

| Style | Use | Appearance |
|-------|-----|------------|
| **Soft** | Default on mobile/tablet. For interactive elements using glass. | Subtle blur transition at the boundary |
| **Hard** | Desktop, admin, text-heavy interfaces. For controls without backgrounds or pinned headers. | Stronger, more opaque boundary |

**Rules** (from Liquid Glass):
- Scroll edge effects are NOT decorative. They only appear where floating UI elements overlap scrollable content.
- Don't mix or stack soft and hard on the same view.
- One scroll edge effect per scroll view. In split layouts, each pane can have its own.
- Scroll views automatically show an edge effect when pinned controls overlap them.

```css
/* Soft scroll edge — mask at glass/content boundary */
.scroll-edge-soft {
  mask-image: linear-gradient(
    to bottom,
    transparent 0px,
    black 12px,
    black calc(100% - 12px),
    transparent 100%
  );
}

/* Hard scroll edge — stronger boundary */
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

### Background Extension

Content extends behind glass surfaces for immersion. The glass layer floats above content — content should feel continuous, not cropped by UI elements.

| Pattern | Use |
|---------|-----|
| Hero images extend behind sidebar glass | Admin garden detail — banner flows behind nav rail |
| Garden banners extend behind nav bar | Client PWA — banner visible through top glass |
| Ambient color wash behind glass layers | Workspace atmospheres visible in margins around canvas |

**Rule**: Text and controls must always layer above the extended background. Glass material provides the separation — content behind glass is visible but not interactive.

**CSS approach sketch**:
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
}
```

---

## Structure & Layout

### Functional Glass Layers

The interface has three distinct functional layers. Glass creates a floating control plane above content, replacing the traditional "embedded controls in content" model.

```
Layer 3: Glass Controls   — Navigation bars, toolbars, FABs
                            Liquid Glass material, floating above content
                            Interactive, persistent, orientation-giving

Layer 2: Content          — Cards, lists, media, data tables, forms
                            Solid or thick material, primary reading surface
                            The work — what the user came for

Layer 1: Environment      — Background, ambient color, workspace atmosphere
                            Z0-Z1 in the Z-layer model
                            Felt more than seen — sets mood without demanding attention
```

**Distinction from Z-layers**: Z-layers (Z0-Z4) are implementation — they define shadow depth, blur amount, and stacking order. Functional layers are design intent — they define the *role* each surface plays. A Z2 card is "Content." A Z3 toolbar is "Glass Controls." The mental models complement each other.

### Content-Forward Principle

From Liquid Glass: UI should support interaction where needed and remain unobtrusive when not. The Glass Controls layer exists to serve the Content layer, not to compete with it.

In practice:
- Controls use glass material (semi-transparent) so content shows through — controls recede
- Empty states are quiet, not attention-grabbing
- Toolbar and navigation recede during scroll or full-screen content modes
- Dense content (forms, tables) uses thick or solid material — glass recedes to let content dominate
- Hero content (images, videos, celebrations) uses ultrathin glass — controls barely visible

### Symbol-First Navigation

From Liquid Glass: persistent navigation bars now rely more on symbols (icons) than text. This reduces visual noise and scales across screen sizes.

**Rules**:
- Persistent nav (bar, rail, toolbar) uses symbols. Text labels are secondary.
- Text labels only when the icon is genuinely ambiguous (e.g., "Select" vs "Edit" — a pencil could mean either).
- Don't pair symbol with text in a way that reads as a single button.
- When actions are closely related (multiple copy variants), use the symbol once to introduce the group, then text for variants.
- The admin cockpit already follows this — floating toolbar uses RiClipboardLine, RiSeedlingLine, RiTeamLine with delayed tooltips.

**Grouping** (from Liquid Glass): Related bar items should share a glass background:
- Group by function and frequency — related actions together
- A primary action (like "Done") stays separate with tint color
- If a bar feels crowded, move secondary actions into a menu to keep things clean

---

## Hero Moments

### Definition

Hero moments are designated places where all style dimensions amplify simultaneously. They celebrate special functionality or frame content in a delightful way — the full breadth of Warm Earth combining for maximum expression.

| Dimension | Standard Surface | Hero Moment |
|-----------|-----------------|-------------|
| **Shape** | Functional squircles and capsules | Expressive/organic shapes |
| **Color** | Balanced role hierarchy (mostly canvas + ink) | Full chroma, vibrant tertiary accent |
| **Motion** | Standard spring scheme | Expressive spring scheme (bouncy, delightful) |
| **Typography** | Body/label weights | Display weight, variable fonts |
| **Material** | Regular glass | Dramatic (ultrathin glass over vivid background) |

### Green Goods Hero Moments

| Moment | Context | Expression Level |
|--------|---------|-----------------|
| **Garden creation** | First garden wizard completion | Full — confetti/growth animation, expressive springs |
| **First work submission** | Gardener's first capture-verify-submit | High — celebratory confirmation, value chain lights up |
| **Hypercert minting** | Impact certificate created on-chain | Full — certificate reveal animation, chain confirmation |
| **Vault deposit** | Funder commits resources | High — flow visualization, amount animates into position |
| **Seasonal transitions** | Garden enters new season | Medium — ambient color shift, seasonal loading shapes |
| **Assessment completion** | Evaluator publishes assessment | Medium — assessment flows into impact chain |
| **Role milestone** | Capability badge earned | Medium — badge reveal with organic unfurl |

### Succession-Aware Expression

Match expressiveness to garden maturity (see [regenerative.md](./regenerative.md) § Succession-Stage Awareness):

| Garden Stage | Hero Moment Level | Why |
|-------------|-------------------|-----|
| **Pioneer** | Simple, encouraging | New communities need clarity, not spectacle. Clean confirmation, gentle celebration. |
| **Intermediate** | Moderate expression | Community is established. Celebrate milestones with spring physics and color. |
| **Climax** | Full expression | Mature community. The full Warm Earth treatment — expressive springs, organic shapes, rich color. |

This prevents over-designing for communities that need onboarding simplicity, while rewarding mature communities with the rich expressiveness they've grown into.

---

## Design Decisions Log

Decisions made during the Warm Earth synthesis (2026-04-07):

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Interaction model | Complement: lift-and-press (cards) + shape morph (buttons) | Different elements get different physics; richer tactile vocabulary |
| Motion system | Named spring tokens replacing hardcoded beziers | Semantic names enable motion scheme switching; consistent vocabulary |
| Button shape | Context-dependent: capsule = primary, squircle = secondary | Shape as emphasis hierarchy; capsule draws eye, squircle recedes |
| Component scope | Admin-relevant subset (3 button sizes, toolbar, sheets, nav, progress) | Focus on what the revamp needs now; extend vocabulary later |
| Document depth | Comprehensive standalone spec | language.md should be self-contained enough to guide implementation without jumping between files |
| Spatial arch integration | Deep — all beziers → tokens, radii → concentric types, full vocabulary alignment | Spatial architecture is the first consumer of Warm Earth; coherence matters |

---

## Related

- [SKILL.md](./SKILL.md) — Adaptive Surface paradigm, material metaphors, decision tree
- [spatial.md](./spatial.md) — Z-layer model, concentricity details, scroll-linked depth
- [interaction.md](./interaction.md) — Spring motion details, shape morphing, adaptive density, progressive disclosure
- [materials.md](./materials.md) — Material thickness system, focus variation, tokens
- [regenerative.md](./regenerative.md) — Seven principles, succession stages, growth-agnostic design
- [ecosystem.md](./ecosystem.md) — 15 user archetypes, cascade awareness
- [SKILL.md § Appendix](./SKILL.md#appendix--inspiration--frameworks) — Inspiration library, books, designers, studios
- [review-checklist.md](./review-checklist.md) — Unified 4-lens PR review (Regenerative + Spatial + Ecosystem + Compliance)
- `.plans/active/admin-ui-revamp/artifacts/spatial-architecture.md` — Three-body system applying Warm Earth
