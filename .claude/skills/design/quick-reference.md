# Quick Reference — Warm Earth Index

Scannable index of the most-referenced Warm Earth systems. Canonical values (hex, px, ms,
opacity) live in [language.md](./language.md) and `packages/shared/src/styles/theme.css` —
this file routes you to the right token by name and does not restate values (restated
values drift). The admin-operational notes at the bottom are this file's own content.

---

## 4 Color Roles → [language.md § Color Direction](./language.md)

| Role | Job |
|------|-----|
| **Neutral (canvas)** | Background — the overwhelming majority of every surface |
| **Primary (ink)** | Body text, headings |
| **Secondary (stone)** | Metadata, borders |
| **Tertiary (accent green)** | CTAs, active states — scarce by design |

> Codebase label `--color-primary` = **tertiary role** (accent green). Historical name; don't rename.
> Volume ratios + hex values: language.md § Role Hierarchy. Supporting accents (amber, sky): § Supporting Accents.

## Radius Scale → [language.md § Shape System](./language.md)

| Use | Token | Type |
|-----|-------|------|
| Status dots, tiny badges | `rounded` | Fixed |
| Chips, tags | `rounded-lg` | Fixed |
| Content inside cards | `rounded-xl` | Concentric |
| Cards, form inputs | `rounded-2xl` | Concentric |
| Panels, sheets | `rounded-[1.25rem]` | Concentric |
| Modals, dialogs | `rounded-3xl` | Concentric |
| Primary / icon buttons | `rounded-full` | Capsule |

Concentricity formula, shape hierarchy, and pitfalls: language.md § Concentricity Rule.

## 6 Spring Motion Tokens → [language.md § Motion System](./language.md)

| Token | Use |
|-------|-----|
| `--spring-spatial` | Layout, nav, sheets |
| `--spring-spatial-fast` | Button press, toggles |
| `--spring-spatial-slow` | Hero transitions, page morphs |
| `--spring-effects` | Opacity, color, blur |
| `--spring-effects-fast` | Hover, focus, tooltip |
| `--spring-effects-slow` | Loaders, progress, pulse |

**Never hardcode** `cubic-bezier` or `duration` in component code. Motion schemes: Standard (admin) vs Expressive (hero moments) — language.md § Motion Schemes.

## 5 Material Thicknesses → [materials.md](./materials.md)

Ultrathin (decorative, no text) · Thin (glanceable status) · Regular (default surfaces) ·
Thick (text-dense, forms) · Solid (fallback, max readability). Tokens:
`var(--color-material-*)` + `blur(var(--blur-material-*))`; degrades to solid via
`@media (prefers-contrast: more)`.

## 5 Paradigms → [SKILL.md § Paradigm Selection](./SKILL.md)

Command Surface (admin review queue) · Ambient Display (sync status) · Data Landscape
(assessment history) · Conversational (agent, onboarding) · Ritual (first work, hypercert
mint). **One paradigm per surface**; declare in a one-line comment at the top of the component.

## 4 Disclosure Layers → [interaction.md](./interaction.md)

Glance (<1s, always visible) → Scan (hover/focus reveals) → Engage (click/expand) →
Deep dive (separate surface). Screen-reader requirement: Scan-layer content must also
appear on `focus-within`, not just `hover`.

## 7 Hero Moments → [language.md](./language.md)

Garden creation (Full) · First work submission (High) · Hypercert minting (Full) ·
Vault deposit (High) · Seasonal transitions / Assessment completion / Role milestone
(Medium). **Succession-aware**: pioneer gardens = simple, climax = full.

## 5-Level Z-Layer Stack → [spatial.md](./spatial.md)

```
Z4 Overlay (modals, palettes) · Z3 Floating (tooltips, FABs) · Z2 Surface (cards)
Z1 Ground (page background) · Z0 Substrate (never styled)
```

## Anti-Patterns → [SKILL.md § Anti-Patterns](./SKILL.md)

The 13 sins (dashboard-itis, spatial-for-spatial's-sake, glass without purpose, …) live in
one place — SKILL.md. Do not restate them here.

---

## Sheet Slot Anatomy

> **Admin**: the `RightSheet` / `LeftSheet` / `BottomSheet` renderers are **deleted** — every workspace overlay is a centered `AdminDialog` (the dialog supplies scrim, title, and close). The one exception is **`AdminSideSheet`**, reserved for the three global AppBar surfaces (Profile, Settings, Notifications): right-docked on desktop, bottom sheet on mobile, same chrome as the dialog. `SheetBody` / `SheetFooter` / `SheetDivider` survive as the body/footer layout primitives *inside* both. Sheet-shell tokens (`--radius-sheet`) apply to the client PWA's own sheet patterns (`PwaSheet`, wallet drawer) only.

The slots compose inside a `flex flex-col` body container. `<SheetBody>` is the only one that scrolls; `<SheetFooter>` pins via `flex-shrink: 0` so it stays visible while long forms scroll above.

```tsx
<AdminDialog open onOpenChange={...} title="Account" tone="hub" size="lg">
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
</AdminDialog>
```

| Slot | Anatomy |
|---|---|
| `SheetBody` | `flex: 1`, hidden scrollbar, `padded={true}` adds `20px 16px`, `padded={false}` for edge-to-edge lists |
| `SheetFooter` | `padding: 12px 16px`, hairline top border, `display: flex; gap: 8px`, raised bg, pins via `flex-shrink: 0` |
| `SheetDivider` | 1px hairline with `16px 0` margin, `role="separator"` |

Sheet shell tokens: `--radius-sheet: 24px` (client sheet shells, e.g. `PwaSheet`), `--canvas-blur-sheet-open: 6px` + `--e-float` (client sheet depth). The admin canvas no longer recedes — depth comes from the AdminDialog's own scrim.

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

---

## Related

- [language.md](./language.md) — Full canonical spec
- [SKILL.md](./SKILL.md) — Philosophy, paradigms, decision tree, anti-patterns
- [review-checklist.md](./review-checklist.md) — 4-lens PR review
- [prompt-contract.md](./prompt-contract.md) — Admin AI prompt vocabulary
- [client-prompt-contract.md](./client-prompt-contract.md) — Client AI prompt vocabulary
- Root `DESIGN.md` — Creative brief for AI tools
