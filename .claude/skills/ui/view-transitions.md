# View Transitions — Spatial Navigation

Implementation guide for View Transitions API, the native CSS mechanism for morphing between routes. Extracted from the former `design/implementation.md` during the 2026-04-17 skill consolidation — moved to `ui/` because this is execution, not direction.

---

## Existing Infrastructure

View Transitions are already implemented for SPA routing with directional transitions (forwards / backwards / fade).

| Feature | Status | File |
|---------|--------|------|
| View Transitions API baseline | **Implemented** | `packages/client/src/styles/view-transitions.css` |
| Directional transitions | **Implemented** | same file (forwards / backwards / fade) |
| Reduced-motion gating | **Implemented** | same file (respects `prefers-reduced-motion`) |
| Named classes | **Implemented** | `.vt-main`, `.vt-page`, `.vt-header`, `.vt-garden-card`, `.vt-work-card` |

---

## Persistent Entity Morphing

Entities that persist across views get a `viewTransitionName`. This creates spatial continuity — the object moves, it isn't replaced.

```typescript
// In list view
function GardenCard({ garden }: { garden: Garden }) {
  return (
    <Link to={`/gardens/${garden.id}`}>
      <div style={{ viewTransitionName: `garden-${garden.id}` }}>
        <img src={garden.image} className="rounded-xl" />
        <h3>{garden.name}</h3>
      </div>
    </Link>
  );
}

// In detail view — same viewTransitionName causes smooth morph
function GardenDetail({ garden }: { garden: Garden }) {
  return (
    <div style={{ viewTransitionName: `garden-${garden.id}` }}>
      <img src={garden.image} className="rounded-2xl w-full" />
      <h1>{garden.name}</h1>
    </div>
  );
}
```

---

## Rules

1. **Unique names per entity**. Two elements with the same `viewTransitionName` on the same page = undefined behavior.
2. **Stable names across routes**. The name binds the list-view instance to the detail-view instance. Changing the naming scheme breaks the morph.
3. **Motion respects `prefers-reduced-motion`**. Handled at the CSS level in `view-transitions.css` — no per-component work needed.
4. **Spring timing** via `--spring-spatial-slow` for full-page morphs; `--spring-spatial` for smaller element swaps. See `packages/shared/src/styles/theme.css` for the canonical spring tokens.

---

## Relationship to Design

- **Source-anchored interaction** ([design/language.md § Source-Anchored Interactions](../design/language.md#source-anchored-interactions)) — view transitions are how we implement "detail panels morph from the card that was clicked".
- **Z-layer model** ([design/spatial.md](../design/spatial.md)) — the morphing element usually promotes from Z2 (list surface) to Z3 or Z4 (detail overlay). The morph interpolates the shadow/blur.
- **Concentricity** ([design/language.md § Shape System](../design/language.md#shape-system)) — the radius should animate through the concentric scale (e.g., `rounded-xl` → `rounded-2xl`), not snap.

---

## Related

- [radix-ui.md](./radix-ui.md) — Dialog/Popover composition that pairs with view transitions for modal workflows
- [tailwindcss.md](./tailwindcss.md) — Spring motion tokens, animation utilities
- [compliance.md](./compliance.md) — `prefers-reduced-motion` gating, accessibility
- [../design/spatial.md](../design/spatial.md) — Z-layer model, depth hierarchy
- [../design/language.md](../design/language.md) § Source-Anchored Interactions — Source-anchored origin rule
