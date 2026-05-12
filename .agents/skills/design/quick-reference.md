# Quick Reference — Warm Earth at a Glance

One-page cheat sheet for the most-referenced values. Canonical definitions live in [language.md](./language.md); this file is a scannable index.

---

## 4 Color Roles

| Role | Volume | Color | Job |
|------|--------|-------|-----|
| **Neutral (canvas)** | 80-90% | Warm linen `#FAF8F5` / dark `#1C1917` | Background |
| **Primary (ink)** | 8-15% | Warm charcoal `#292524` / dark `#F5F5F4` | Body text, headings |
| **Secondary (stone)** | 3-5% | Earth stone `#78716C` / dark `#A8A29E` | Metadata, borders |
| **Tertiary (accent)** | 1-3% | Garden green `#1FC16B` | CTAs, active states |

> Codebase label `--color-primary` = **tertiary role** (accent green). Historical name; don't rename.

**Supporting accents**: Amber `#D97706` (warnings, seasonal), Sky `#3B82F6` (info, evaluation).

---

## 7-Step Radius Scale

| Use | Radius | Token | Type |
|-----|--------|-------|------|
| Status dots, tiny badges | 4px | `rounded` | Fixed |
| Chips, tags | 8px | `rounded-lg` | Fixed |
| Content inside cards | 12px | `rounded-xl` | Concentric |
| Cards, form inputs | 16px | `rounded-2xl` | Concentric |
| Panels, sheets | 20px | `rounded-[1.25rem]` | Concentric |
| Modals, dialogs | 24px | `rounded-3xl` | Concentric |
| Primary / icon buttons | half-h | `rounded-full` | Capsule |

**Concentricity rule**: `child_radius = parent_radius − padding`.

**Shape hierarchy**: capsule (primary) > squircle (secondary) — shape alone creates emphasis.

---

## 6 Spring Motion Tokens

| Token | Duration | Use |
|-------|----------|-----|
| `--spring-spatial` | 300ms | Layout, nav, sheets |
| `--spring-spatial-fast` | 200ms | Button press, toggles |
| `--spring-spatial-slow` | 400ms | Hero transitions, page morphs |
| `--spring-effects` | 250ms | Opacity, color, blur |
| `--spring-effects-fast` | 150ms | Hover, focus, tooltip |
| `--spring-effects-slow` | 500ms | Loaders, progress, pulse |

**Never hardcode** `cubic-bezier` or `duration` in component code. Motion schemes: Standard (admin) vs Expressive (hero moments, celebrations).

---

## 5 Material Thicknesses

| Material | Opacity | Blur | When |
|----------|---------|------|------|
| Ultrathin | 20% | 30px | Decorative, ambient — no text |
| Thin | 40% | 20px | Status, glanceable metrics |
| Regular | 65% | 12px | Standard surfaces, cards (default) |
| Thick | 85% | 8px | Text-dense, forms, tables |
| Solid | 100% | 0 | Fallback, max readability |

**Tokens**: `var(--color-material-regular)` + `blur(var(--blur-material-regular))`. Defined in `packages/shared/src/styles/theme.css`. Degrades to solid via `@media (prefers-contrast: more)`.

---

## 5 Paradigms

| Paradigm | Material | Density | Example |
|----------|----------|---------|---------|
| **Command Surface** | Thick / Solid | High — controls visible | Admin review queue |
| **Ambient Display** | Thin / Ultrathin | Low — glanceable | Sync status, health |
| **Data Landscape** | Regular | Variable — zoomable | Assessment history, analytics |
| **Conversational** | Ultrathin / Regular | Sparse — content-forward | Agent, onboarding |
| **Ritual** | Dramatic | Single-purpose | First work, hypercert mint |

**One paradigm per surface**; mix across a view. Declare in a one-line comment at the top of the component.

---

## 4 Disclosure Layers (Jarvis Principle)

| Layer | Time | Shows | How |
|-------|------|-------|-----|
| **Glance** | <1s | Title, status dot, one metric | Always visible |
| **Scan** | 1-3s | Summary, actions, relationships | Hover / focus reveals |
| **Engage** | 3s+ | Full detail, history, config | Click / expand |
| **Deep dive** | Intentional | Raw data, audit trail | Separate surface |

Screen-reader requirement: Scan-layer content must also appear on `focus-within`, not just `hover`.

---

## 7 Hero Moments

Celebrate these with amplified shape + color + motion + typography + material:

| Moment | Level |
|--------|-------|
| Garden creation | Full |
| First work submission | High |
| Hypercert minting | Full |
| Vault deposit | High |
| Seasonal transitions | Medium |
| Assessment completion | Medium |
| Role / capability milestone | Medium |

**Succession-aware**: pioneer gardens = simple, intermediate = moderate, climax = full.

---

## 5-Level Z-Layer Stack

```
Z4: Overlay       modals, command palettes        thick/solid
Z3: Floating      tooltips, popovers, FABs        regular
Z2: Surface       cards, panels                   regular
Z1: Ground        page background                 — (no blur)
Z0: Substrate     environment / wallpaper         — (never styled)
```

Canvas recession on sheet open: `scale(0.97) + opacity(0.85) + blur(2px)`. No dark scrim.

---

## Sheet Slot Anatomy

Sheets compose three optional slots inside a `flex flex-col` body container. `<SheetBody>` is the only one that scrolls; `<SheetFooter>` pins via `flex-shrink: 0` so it stays visible while long forms scroll above.

```tsx
<RightSheet open onClose={...} title="Account">
  <SheetBody padded={true}>
    {sections}
    <SheetDivider />
    {moreSections}
  </SheetBody>
  <SheetFooter>
    <Button>Cancel</Button>
    <div style={{ flex: 1 }} />
    <Button form="my-form" type="submit">Save</Button>
  </SheetFooter>
</RightSheet>
```

| Slot | Anatomy |
|---|---|
| `SheetBody` | `flex: 1`, hidden scrollbar, `padded={true}` adds `20px 16px`, `padded={false}` for edge-to-edge lists |
| `SheetFooter` | `padding: 12px 16px`, hairline top border, `display: flex; gap: 8px`, raised bg, pins via `flex-shrink: 0` |
| `SheetDivider` | 1px hairline with `16px 0` margin, `role="separator"` |

Sheet shell tokens: `--radius-sheet: 24px` (LeftSheet/RightSheet outer), `--canvas-blur-sheet-open: 6px` (MainSheet filter when any sheet open), `--e-float` (sheet elevation). MainSheet exposes `data-sheet-open="true|false"` for downstream styling.

## Tabs (segmented-card)

`AdminTabRail` ships handoff `.rv-tabs` anatomy — segmented cards in a grid container. **No sliding underline.**

| Property | Value |
|---|---|
| Container | `display: grid; gap: 6px; padding: 6px; border-radius: 14px; background: var(--surface-quiet)` |
| Tab button | `height: 40px; border-radius: 10px; font: 600 14px/1; letter-spacing: -0.005em` |
| Active tab | `background: var(--surface-raised)` + `box-shadow: var(--e1)` + 6% tone wash via `linear-gradient(rgb(var(--tone-action,…) / 0.06), …)` |
| Count chip | 22×20 pill — inactive `var(--surface-raised)` + 1px outline; active `var(--g-action)` with white text |
| Keyboard | Roving tabindex; ArrowLeft/ArrowRight cycle, Home/End jump (skip disabled tabs) |

## Tone Consumption Rule

`var(--tone-action, var(--green-800))` — `--tone-action` is a **raw RGB triplet** inside admin's `[data-tone]` scopes (e.g. `51 92 255` for Hub). The fallback must also be a raw triplet so `rgb(var(...) / 0.06)` alpha-blending stays valid:

```css
/* OK — both raw triplets */
background: rgb(var(--tone-action, 26 117 68) / 0.06);

/* BROKEN — fallback wraps `--g-action` which is itself rgb(...) */
background: rgb(var(--tone-action, var(--g-action)) / 0.06);
```

For non-blended use, either form works.

## Anti-Patterns (the 13 sins)

1. Dashboard-itis — everything on one flat surface
2. Spatial for spatial's sake
3. Glass without purpose
4. Edge-anchored UI in 2026
5. Uniform density everywhere
6. Spatial-only patterns (no keyboard/voice fallback)
7. Cognitive overload via ultrathin glass over text
8. Motion without `prefers-reduced-motion` respect
9. Assuming full vision (depth via blur alone)
10. Generic AI slop (Inter + purple + white + grid)
11. Sharp corners at scale (squircles for panes)
12. Motion without meaning (decorative animation)
13. Client styling in the cockpit (or vice versa)

---

## Related

- [language.md](./language.md) — Full canonical spec
- [SKILL.md](./SKILL.md) — Philosophy, paradigms, decision tree
- [review-checklist.md](./review-checklist.md) — 4-lens PR review
- [prompt-contract.md](./prompt-contract.md) — Admin AI prompt vocabulary
- [client-prompt-contract.md](./client-prompt-contract.md) — Client AI prompt vocabulary
- Root `DESIGN.md` — Creative brief for AI tools
