# Generative UI — Intent-Driven Atoms

Structure components as intent-driven atoms, not page-specific widgets. When AI generates UI, it composes from these atoms.

Extracted from the former `implementation.md` during the 2026-04-17 skill consolidation.

---

## The Pattern

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

---

## Principle

The interface describes **intent** ("show garden health"), not **layout** ("put a chart here"). The renderer chooses the optimal layout based on:

- Available space (container queries)
- Density mode (comfortable / compact / focused)
- Material context (thick / thin / ultrathin)
- Paradigm (Command / Ambient / Data / Conversational / Ritual)

---

## When to Use

- **Agent-generated surfaces** — Where the GreenWill agent or another AI composes UI based on user intent.
- **Context-adaptive panels** — Where a single "inspector" surface needs to render different content depending on the selected entity (work, garden, gardener, hypercert).
- **Dynamic dashboards** — Where operators configure which atoms appear on their cockpit without a new deploy.

**Don't use** when the layout is known at design time — a static form is a static form. Atomic composition adds indirection and loses type safety that a hand-authored layout has.

---

## Relationship to Other Patterns

- **Container queries** ([interaction.md](./interaction.md)) — each atom adapts to its container, so the atomic composition works across pane sizes without hardcoded breakpoints.
- **Material system** ([materials.md](./materials.md)) — the `<Pane>` wrapper picks the material; atoms inherit. An ambient pane gets thin material; a command pane gets thick.
- **Paradigm selection** ([SKILL.md](./SKILL.md)) — a Command Surface composed of atoms looks different from a Conversational one, even with the same atoms, because the renderer's layout algorithm changes.

---

## Related

- [SKILL.md](./SKILL.md) — Paradigm selection, decision tree
- [interaction.md](./interaction.md) — Progressive disclosure, adaptive density
- [materials.md](./materials.md) — Material thickness per atom type
- [../ui/view-transitions.md](../ui/view-transitions.md) — How atoms morph across route changes
