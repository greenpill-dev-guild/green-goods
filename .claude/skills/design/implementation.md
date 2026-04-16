# Implementation Bridge — Today's Web, Tomorrow's Space

Patterns that work on standard monitors today but prepare the codebase for spatial rendering. Maps to existing Green Goods CSS infrastructure.

## Existing Infrastructure Map

| Feature | Status | File |
|---------|--------|------|
| View Transitions API | **Implemented** | `packages/client/src/styles/view-transitions.css` |
| Container queries | **Defined** | `packages/shared/src/styles/theme.css` (utilities layer) |
| Named containers | **Defined** | `.container-card`, `.container-work-card`, `.container-panel` |
| 6-level elevation | **Implemented** | `packages/admin/src/index.css` |
| Animation library | **Implemented** | `packages/client/src/styles/animation.css` (466 lines) |
| Native Popover API | **Implemented** | `packages/client/src/styles/utilities.css` (backdrop-blur) |
| Content-visibility | **Implemented** | `.cv-auto`, `.cv-work-card`, etc. |
| Scroll-driven animations | **Not yet** | Spec in `spatial.md` |
| Glass material tokens | **Not yet** | Spec in `materials.md` |
| Squircle radius scale | **Not yet** | Spec in `spatial.md` |

---

## View Transitions as Spatial Navigation

View Transitions are already implemented for SPA routing with directional transitions (forwards/backwards/fade). Extend this for persistent entity morphing:

```typescript
// Entities that persist across views get viewTransitionName
// This creates spatial continuity — the object moves, it isn't replaced

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

**Existing classes to use**: `.vt-main`, `.vt-page`, `.vt-header`, `.vt-garden-card`, `.vt-work-card` (defined in `view-transitions.css`).

**Inclusive design**: View transitions respect `prefers-reduced-motion` — already handled in `view-transitions.css`.

---

## Generative UI Readiness

Structure components as intent-driven atoms, not page-specific widgets. When AI generates UI, it composes from these atoms.

```typescript
// Intent: "Show garden status" → AI picks atoms based on context
type UIAtom =
  | { type: "metric"; label: string; value: number; trend?: "up" | "down" }
  | { type: "status"; entity: string; state: string; since: Date }
  | { type: "action"; label: string; handler: () => void; variant: "primary" | "ghost" }
  | { type: "timeline"; events: Event[] }
  | { type: "relationship"; from: string; to: string; label: string };

// Atom renderer — each atom renders itself
function renderAtom(atom: UIAtom) {
  switch (atom.type) {
    case "metric": return <MetricChip {...atom} />;
    case "status": return <StatusIndicator {...atom} />;
    case "action": return <ActionButton {...atom} />;
    case "timeline": return <TimelineStrip {...atom} />;
    case "relationship": return <RelationshipEdge {...atom} />;
  }
}

// Compose: AI or rule engine provides atoms, renderer lays them out
function GenerativePanel({ atoms }: { atoms: UIAtom[] }) {
  return (
    <Pane material="regular" className="grid gap-3 auto-rows-min">
      {atoms.map((atom, i) => (
        <div key={i}>{renderAtom(atom)}</div>
      ))}
    </Pane>
  );
}
```

**Principle**: The interface describes *intent* ("show garden health"), not *layout* ("put a chart here"). The renderer chooses the optimal layout based on available space (container queries), density mode, and material context.

---

## Progressive Immersion Strategy

Build one semantic core that scales across capability tiers. Do not build separate apps.

```
Tier 1: Text / Voice (lowest bandwidth, highest accessibility)
├── Logic exposed as API for voice agents and chatbots
├── Serves lowest-bandwidth users, screen readers, CLI
└── Green Goods: offline-first service worker serves this tier

Tier 2: 2D Screen (mobile + desktop)
├── Same logic wrapped in standard UI components
├── Responsive via container queries (not just media queries)
└── Green Goods: current PWA client and admin

Tier 3: Spatial (headsets, AR, large displays)
├── 2D components "explode" into 3D floating panes
├── Depth, gaze, gesture become available
└── Green Goods: future — prepared via glass pane patterns
```

**The bridge**: Each tier is additive. Tier 2 includes everything from Tier 1. Tier 3 includes everything from Tier 2. Nothing is spatial-only.

This maps to Green Goods' offline-first architecture: the offline state (service worker, IndexedDB) IS Tier 1. The PWA is Tier 2. The codebase is spatially-prepared via glass panes, container queries, and view transitions for when Tier 3 arrives.

---

## CSS Additions Needed (Tracked Separately)

These specs live in `materials.md` and `spatial.md` but will be implemented in `packages/shared/src/styles/theme.css` and documented in `ui/tailwindcss.md`:

1. **Glass material tokens** — `--color-material-*`, `--blur-material-*` (see `materials.md`)
2. **Squircle radius scale** — `--radius-squircle-sm/md/lg/xl` (see `spatial.md`)
3. **Scroll-driven animation utilities** — `.depth-aware` class (see `spatial.md`)
4. **High-contrast material fallback** — `@media (prefers-contrast: more)` override (see `materials.md`)
