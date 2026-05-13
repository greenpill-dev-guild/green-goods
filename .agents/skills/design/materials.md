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

**Implementation status**: Shipped in `packages/shared/src/styles/theme.css` (light + dark + `prefers-contrast: more` fallback). Use `var(--color-material-*)` and `var(--blur-material-*)` directly; do not hardcode opacity/blur in component code.

---

## Material ↔ Paradigm Mapping

Each design paradigm has a natural material pairing. Warm Earth focus variation notes describe how materials shift dynamically within each paradigm.

| Paradigm | Primary Material | Warm Earth Behavior |
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

## Behavioral Patterns Defined Elsewhere

These material behaviors are specified once in [language.md](./language.md) — this file uses them without re-specifying:

- **Material Focus Variation** — browsing / engaged / deep-focus / parallel-task states, dimming-vs-separation rule, and bounded admin canvas recession (`translateY + opacity + blur`). See [language.md § Material Behaviors](./language.md#material-behaviors).
- **Functional Glass Layers** — Layer 1 Environment / Layer 2 Content / Layer 3 Glass Controls, and how they map to the Z-layer model in [spatial.md](./spatial.md). See [language.md § Functional Glass Layers](./language.md#functional-glass-layers).

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
