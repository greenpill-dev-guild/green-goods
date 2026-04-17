# Interaction Patterns — From Screens to Surfaces

Interaction paradigms for interfaces that bridge today's desktop/mobile with tomorrow's spatial computing. Every pattern must work across input modalities.

## Persona Spectrum for Spatial Interaction

Spatial interfaces create new forms of exclusion. Apply Microsoft's Inclusive Design persona spectrum to every modality:

| Modality | Permanent | Temporary | Situational |
|----------|-----------|-----------|-------------|
| **Gaze** | Low vision, blindness | Eye strain, dilated pupils | Bright sunlight, screen glare |
| **Gesture** | Limb difference | Broken arm, RSI | Holding a child, crowded bus |
| **Voice** | Non-verbal | Laryngitis | Library, open office |
| **Depth/3D** | Monocular vision | VR sickness | Small screen, 2G bandwidth |

**Design rule**: Every interaction must be reachable through at least two modalities. The fallback chain:

```
Keyboard → Touch → Voice → Gaze/Gesture
(most universal)              (most spatial)
```

If a pattern works only via gaze or gesture, it is incomplete.

---

## From Hover to Intent

Desktop hover states are the training ground for spatial gaze interaction. Design hover states as if the cursor is an eye.

| Desktop (Now) | Spatial (Bridge) | Implementation |
|---------------|-----------------|----------------|
| Mouse hover → visual change | Eye gaze → focus highlight | Generous hit areas (min 44px), glow on hover not just color shift |
| Click → action | Pinch → action | Clear affordance at rest, not just on hover |
| Right-click → context menu | Long gaze → context reveal | Delayed reveal (show more after 300ms hover) |
| Scroll → content movement | Lean/zoom → approach | Scale transforms on scroll, parallax depth |

**Critical**: Never hide essential information behind hover. Hover is a preview, not a gate. Touch and gaze cannot hover traditionally — ensure primary content is visible at rest.

---

## Adaptive Density

The interface should breathe — expanding when the user needs space to think, compressing when they're in flow. This is cognitive load management, not just visual preference.

```typescript
const densityModes = {
  // Comfortable: onboarding, exploration, reading — low cognitive load
  comfortable: {
    gap: "gap-6",
    padding: "p-6",
    text: "text-base",
    grid: "grid-cols-1 md:grid-cols-2",
  },
  // Compact: experienced users, operators, data-heavy — high familiarity
  compact: {
    gap: "gap-3",
    padding: "p-3",
    text: "text-sm",
    grid: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
  },
  // Focused: single-task, modal workflows — minimize distraction
  focused: {
    gap: "gap-8",
    padding: "p-8 md:p-12",
    text: "text-lg",
    grid: "grid-cols-1 max-w-lg mx-auto",
  },
} as const;
```

**When to use each**: Comfortable is the default for new users and unfamiliar tasks. Compact is earned — expose it as a user preference or trigger it when the system detects expertise (frequent use, keyboard shortcuts). Focused is for moments requiring undivided attention (confirmation dialogs, onboarding steps, critical actions).

---

## Progressive Disclosure — The Jarvis Principle

Information appears in layers. The first layer is always calm. Complexity reveals on engagement. This directly implements "Solve for One, Extend to Many" — the base layer serves everyone, deeper layers serve those who need them.

| Layer | Time | What Shows | How It Reveals |
|-------|------|------------|----------------|
| **Glance** | < 1s | Title, status dot, one key metric | Always visible |
| **Scan** | 1-3s | Summary, action buttons, relationships | Hover/focus reveals |
| **Engage** | 3s+ | Full detail, history, configuration | Click/expand |
| **Deep Dive** | Intentional | Raw data, audit trails, settings | Separate surface (dialog/panel) |

```typescript
// Progressive card — layers revealed on engagement
function AdaptiveCard({ garden }: { garden: Garden }) {
  return (
    <Pane material="regular" interactive className="group">
      {/* Layer 1: Glance — always visible */}
      <div className="flex items-center justify-between p-4">
        <h3 className="font-medium truncate">{garden.name}</h3>
        <StatusDot status={garden.status} />
      </div>

      {/* Layer 2: Scan — revealed on hover/focus-within */}
      <div className={cn(
        "px-4 pb-3 transition-all duration-300",
        "opacity-0 max-h-0 overflow-hidden",
        "group-hover:opacity-100 group-hover:max-h-24",
        "group-focus-within:opacity-100 group-focus-within:max-h-24",
      )}>
        <p className="text-sm text-muted-foreground">{garden.description}</p>
        <div className="flex gap-2 mt-2">
          <MetricChip label="Works" value={garden.workCount} />
          <MetricChip label="Operators" value={garden.operatorCount} />
        </div>
      </div>
    </Pane>
  );
}
```

**Inclusive design note**: Layer 2 (scan) content must also be accessible via `focus-within`, not just hover. Screen readers should announce scan-level content when the card receives focus.

---

## Floating Navigation

Detach navigation from screen edges. In spatial computing, there are no edges to anchor to.

```typescript
function FloatingNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-1 px-2 py-1.5",
        "rounded-full",
        "bg-white/85 backdrop-blur-[8px] dark:bg-zinc-900/85",
        "border border-white/[0.08]",
        "shadow-lg dark:shadow-2xl",
      )}
      aria-label="Main navigation"
    >
      {items.map((item) => (
        <NavButton key={item.id} item={item} />
      ))}
    </nav>
  );
}
```

**Note**: This matches Green Goods' existing PWA pattern — the client uses bottom navigation for installed PWA mode (see `feedback_browser_vs_pwa` memory). The floating pill is the spatial evolution of that pattern.

---

## Motion, Shape Morphing, Hero Moments, Symbol-First

These patterns are specified once in [language.md](./language.md) — this file uses them without re-specifying:

- **Spring Motion System** — named tokens (`--spring-spatial`, `--spring-effects` + fast/slow variants), Standard vs Expressive motion schemes, reduced-motion fallback. See [language.md § Motion System](./language.md#motion-system).
- **Shape Morphing** — capsule/squircle/icon buttons morph on press; cards combine lift-and-press with radius tighten. Visual polish only — never encodes information. See [language.md § Shape Morphing](./language.md#shape-morphing).
- **Hero Moments** — the five-dimension amplification (shape + color + motion + typography + material) for garden creation, first work, hypercert mint, vault deposit, seasonal transitions, assessment, role milestones. Succession-aware: pioneer=simple, intermediate=moderate, climax=full. See [language.md § Hero Moments](./language.md#hero-moments).
- **Symbol-First Navigation** — persistent nav uses symbols; text only when ambiguous; related actions grouped on shared glass. See [language.md § Symbol-First Navigation](./language.md#symbol-first-navigation).

---

## Container Queries as Adaptive Surfaces

In spatial computing, each pane is its own viewport. Container queries already model this — components adapt to their container, not the screen.

Green Goods already defines named containers in `theme.css` (`.container-card`, `.container-panel`, etc.). Use them:

```css
/* The pane IS the viewport */
.pane { container-type: inline-size; }

@container (min-width: 400px) {
  .pane-content { /* horizontal layout */ }
}
@container (max-width: 399px) {
  .pane-content { /* stacked layout */ }
}
```

This means components work correctly whether they're in a full-width panel or a narrow sidebar — spatial-ready without any changes when panes eventually float in 3D space.
