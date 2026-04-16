# Materials — Semantic Surfaces

Replace solid backgrounds with materials that communicate depth, hierarchy, and purpose. Materials are not decoration — they are information architecture.

## Material System

Five semantic materials, from most transparent to fully opaque:

| Material | Opacity | Blur | Use When | Cognitive Load |
|----------|---------|------|----------|----------------|
| **Ultrathin** | 20% | 30px | Purely decorative, ambient indicators | Very low — no text content |
| **Thin** | 40% | 20px | Secondary context, status displays | Low — glanceable metrics only |
| **Regular** | 65% | 12px | Standard surfaces, cards, panels | Medium — short text, icons, controls |
| **Thick** | 85% | 8px | Text-dense content, command surfaces | High — paragraphs, forms, data tables |
| **Solid** | 100% | 0px | Fallback, maximum readability | Maximum — critical content, accessibility override |

### Cognitive Load Rule

Glass blur reduces readability. Match material thickness to content density:

- **Ultrathin**: Never place text content on ultrathin materials. Icons and status dots only.
- **Thin**: Single-line labels and numeric values. No paragraphs.
- **Regular**: Titles, short descriptions, buttons. The default for most surfaces.
- **Thick**: Mandatory for any surface with paragraph text, form inputs, or data tables.
- **Solid**: Use when the background is unpredictable (user-uploaded images, video) or for users who need maximum contrast.

---

## Material Tokens

Spec for future addition to `packages/shared/src/styles/theme.css`:

```css
@theme {
  /* Light mode materials */
  --color-material-ultrathin: oklch(0.99 0 0 / 0.2);
  --color-material-thin: oklch(0.98 0 0 / 0.4);
  --color-material-regular: oklch(0.97 0 0 / 0.65);
  --color-material-thick: oklch(0.96 0 0 / 0.85);

  --blur-material-ultrathin: 30px;
  --blur-material-thin: 20px;
  --blur-material-regular: 12px;
  --blur-material-thick: 8px;

  /* Border: subtle edge that separates pane from environment */
  --border-material: 1px solid oklch(1 0 0 / 0.08);
}

/* Dark mode: higher opacity needed for readability against dark backgrounds */
[data-theme="dark"] {
  --color-material-ultrathin: oklch(0.1 0 0 / 0.2);
  --color-material-thin: oklch(0.15 0 0 / 0.4);
  --color-material-regular: oklch(0.18 0 0 / 0.65);
  --color-material-thick: oklch(0.12 0 0 / 0.85);

  --border-material: 1px solid oklch(1 0 0 / 0.06);
}
```

**Note**: These are spec tokens — not yet in `theme.css`. Implementation tracked separately.

---

## Material ↔ Paradigm Mapping

Each design paradigm has a natural material pairing. Warm Glass focus variation notes describe how materials shift dynamically within each paradigm.

| Paradigm | Primary Material | Warm Glass Behavior |
|----------|-----------------|---------------------|
| **Command Surface** | Thick or Solid | Focus variation: stays thick. Controls need constant readability. Canvas recedes on sheet open. |
| **Ambient Display** | Thin or Ultrathin | Focus variation: minimal change. Always peripheral. Promotes to thick only on autonomic actor failure. |
| **Data Landscape** | Regular | Focus variation: thickens when user drills into data. Thins when zooming out to overview. |
| **Conversational** | Regular or Thick | Focus variation: thickens during active conversation. Thins during idle/waiting. |
| **Ritual** | Varies | Focus variation: dramatic. Ultrathin over cinematic bg during celebration → thick for confirmation step. Hero moments use Expressive motion scheme. |

---

## Material ↔ Metaphor Mapping

Each material metaphor from `SKILL.md` uses materials differently:

| Metaphor | Dominant Material | Accent |
|----------|------------------|--------|
| **Liquid Glass** | Regular with chromatic edge tint | Thin border with subtle refraction color |
| **Obsidian** | Thick (dark mode) with warm glow | Accent border-glow on interaction |
| **Vellum** | Solid with grain texture overlay | Subtle noise background-image |
| **Holographic** | Thin with iridescent gradient border | Animated gradient on border |
| **Carbon** | Solid (dark) with grid-line border | Hairline borders, monospace type |

---

## Material Focus Variation

Glass material shifts dynamically as user engagement deepens. This is the Warm Glass behavioral layer — materials are not static; they respond to what the user is doing.

| Engagement Level | Material Response | UI State |
|-----------------|-------------------|----------|
| **Browsing** | Default glass — transparent, content shows through | No sheets open, user scanning |
| **Engaged** | Slightly more opaque, material settles | User interacting with a specific surface |
| **Deep focus** (modal/sheet) | Opaque glass + dimming layer behind | Sheet open, canvas recedes: `scale(0.97) + opacity(0.85) + blur(2px)` |
| **Parallel task** (side panel) | Lighter glass, no dimming | Side panel open but canvas stays visible and aware |

### Dimming vs Separation

Two distinct responses for different task relationships (from Liquid Glass):

- **Dimming** — for modal interruption: a task that interrupts the main flow. Pair glass with a dimming layer to center attention. Example: confirmation sheet, destructive action dialog.
- **Glass separation** — for parallel tasks: a task that happens alongside the main flow. Glass creates natural separation without breaking context. Example: settings panel, garden context sidebar.

### Canvas Recession as Material Behavior

When a sheet opens, the canvas responds materially — it doesn't just get a dark overlay. The canvas physically recedes:

```
Canvas resting:   scale(1.0), opacity(1.0), filter(none)
Canvas receded:   scale(0.97), opacity(0.85), filter(blur(2px))
```

This is the spatial architecture's "Three-Body System" expressed as material behavior. The transitions use `--spring-spatial` tokens (see [language.md](./language.md) § Motion System).

---

## Functional Glass Layer

Glass is not decoration — it defines a distinct functional layer in the UI. This formalizes the relationship between glass controls and content.

### Three Functional Layers

```
Layer 3: Glass Controls   — Navigation bars, toolbars, FABs
                            Semi-transparent, floating above content
                            Interactive, persistent, orientation-giving

Layer 2: Content          — Cards, lists, media, data tables, forms
                            Solid or thick material, primary reading surface
                            The work — what the user came for

Layer 1: Environment      — Background, ambient color, workspace atmosphere
                            Z0-Z1 in the Z-layer model
                            Felt more than seen — sets mood without demanding attention
```

### Relationship to Z-Layers

Z-layers (Z0-Z4) are the implementation mechanism — they define shadow depth, blur amount, and stacking order. Functional layers are design intent — they define the *role* each surface plays:

| Functional Layer | Z-Layer Range | Material Thickness |
|-----------------|---------------|-------------------|
| Glass Controls | Z3 (chrome) | Regular or Thin — transparent enough to see content through |
| Content | Z2 (surface) | Thick or Solid — maximum readability for the work |
| Environment | Z0-Z1 (substrate/ground) | N/A — background color, ambient wash |

### Design Principle

Glass controls should never compete with content for attention. They exist to serve navigation and orientation, then recede. When content needs full focus (reading, form filling, media viewing), glass controls become more transparent or hide entirely.

---

## Accessibility Fallbacks

For users who need maximum readability (high contrast mode, certain cognitive needs):

```css
/* Force solid materials when user needs maximum contrast */
@media (prefers-contrast: more) {
  [class*="backdrop-blur"] {
    backdrop-filter: none;
    background-color: var(--color-card); /* solid fallback */
  }
}
```

Materials are progressive enhancement. The solid fallback must always be readable and functional.
