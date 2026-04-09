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

## Spring Motion System

All animation uses named spring tokens — no hardcoded `cubic-bezier` or `duration` values in component code. See [language.md](./language.md) § Motion System for the full spec.

### Spring Tokens

| Token | CSS Value | Duration | Use |
|-------|-----------|----------|-----|
| `--spring-spatial` | `cubic-bezier(0.16, 1, 0.3, 1)` | 300ms | Layout shifts, nav, expand/collapse, sheets |
| `--spring-spatial-fast` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 200ms | Button press, toggles, micro-interactions |
| `--spring-spatial-slow` | `cubic-bezier(0.16, 1, 0.3, 1)` | 400ms | Hero transitions, page morphs, view transitions |
| `--spring-effects` | `cubic-bezier(0.2, 0, 0, 1)` | 250ms | Opacity, color, blur, material transitions |
| `--spring-effects-fast` | `cubic-bezier(0.2, 0, 0, 1)` | 150ms | Hover states, focus rings, tooltip appearance |
| `--spring-effects-slow` | `cubic-bezier(0.2, 0, 0, 1)` | 500ms | Loading indicators, progress bars, ambient pulse |

### Motion Schemes

| Scheme | When | Spring Character |
|--------|------|-----------------|
| **Standard** | Productivity, data-dense, operator cockpit | Tokens as defined — efficient, minimal overshoot |
| **Expressive** | Hero moments, celebrations, onboarding | +50% duration, higher overshoot — playful, bouncy |

Set at the surface level, not per-component. A "Ritual" paradigm surface uses Expressive; a "Command Surface" uses Standard.

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Shape morphing, focus variation, and scroll effects are visual polish — fully functional with instant transitions.

---

## Shape Morphing

Interactive elements shift shape on engagement, creating tactile feedback. Shape morphing *complements* the existing lift-and-press pattern (§ Adaptive Card in Progressive Disclosure) — cards get scale transforms, buttons get radius shifts, interactive cards get both.

### Interaction Model

| Element Type | Hover | Press | Release |
|-------------|-------|-------|---------|
| **Capsule button** (primary) | Shadow glow | Pill → squircle (`rounded-full` → `rounded-xl`) | Springs back to pill |
| **Squircle button** (secondary) | Shadow glow | Radius tightens (`rounded-xl` → `rounded-lg`) | Springs back |
| **Icon button** | Background appears | Circle → squished square | Springs back to circle |
| **Card** (combines with lift-and-press) | scale(1.008) + shadow | scale(0.985) + radius tightens 2-4px | Springs back |

All morph transitions use `--spring-spatial-fast` (200ms with overshoot).

### CSS Approach

```css
/* Capsule button — morph toward squircle on press */
.btn-primary {
  border-radius: 9999px;
  transition: border-radius var(--spring-spatial-fast),
              transform var(--spring-spatial-fast);
}
.btn-primary:active {
  border-radius: var(--radius-xl);
}

/* Squircle button — tighten further on press */
.btn-secondary {
  border-radius: var(--radius-xl);
  transition: border-radius var(--spring-spatial-fast);
}
.btn-secondary:active {
  border-radius: var(--radius-lg);
}

/* Card — lift-and-press + shape morph complement */
.card-interactive {
  transition: transform var(--spring-spatial-fast),
              border-radius var(--spring-spatial-fast),
              box-shadow var(--spring-effects-fast);
}
.card-interactive:hover {
  transform: scale(1.008);
  box-shadow: 0 4px 16px rgba(31,193,107,0.10);
}
.card-interactive:active {
  transform: scale(0.985);
  border-radius: calc(var(--radius-2xl) - 2px);
}
```

### Inclusive Design Note

Shape morphing is visual polish, not information. Keyboard focus uses a focus ring (`--spring-effects-fast` fade-in), not a shape morph. Screen readers receive no morph feedback — the interaction outcome (button pressed, card selected) is communicated through standard ARIA.

---

## Hero Moments

Designated places where all Warm Glass style dimensions amplify simultaneously. They celebrate special functionality and frame content in a delightful way.

### The Five Dimensions

| Dimension | Standard Surface | Hero Moment |
|-----------|-----------------|-------------|
| **Shape** | Functional squircles and capsules | Expressive/organic shapes |
| **Color** | Balanced accent triad | Full chroma, vibrant primary |
| **Motion** | Standard spring scheme | Expressive spring scheme (bouncy overshoot) |
| **Typography** | Body/label weights | Display weight, variable fonts |
| **Material** | Regular glass | Dramatic (ultrathin glass over vivid background) |

### Green Goods Hero Moments

| Moment | Expression Level | Why |
|--------|-----------------|-----|
| Garden creation | Full | The birth of a new community space — celebrate with growth animation |
| First work submission | High | Gardener's first contribution — affirm with value chain lighting up |
| Hypercert minting | Full | Impact permanently recorded on-chain — certificate reveal |
| Vault deposit | High | Resources committed — flow visualization |
| Seasonal transitions | Medium | Garden enters new season — ambient color shift |
| Assessment completion | Medium | Evaluator publishes — impact chain advancement |
| Role milestone | Medium | Capability badge earned — organic unfurl |

### Succession-Aware Expression

Match expressiveness to garden maturity (see [regenerative.md](./regenerative.md)):

| Stage | Hero Level | Why |
|-------|-----------|-----|
| **Pioneer** | Simple, encouraging | New communities need clarity, not spectacle |
| **Intermediate** | Moderate expression | Established — celebrate milestones with spring + color |
| **Climax** | Full expression | Mature community earns the full Warm Glass treatment |

---

## Symbol-First Navigation

From Apple's Liquid Glass: persistent navigation should rely on symbols (icons) over text. This reduces visual noise and scales across screen sizes.

### Rules

1. **Persistent nav** (bar, rail, toolbar) uses symbols. Text labels are secondary.
2. **Text only when ambiguous** — if a pencil could mean "annotate" or "edit", use text.
3. **Don't pair symbol with text** as a single button — it can be misread as one tappable element. If you need text, let it sit on its own container.
4. **Group related actions** on a shared glass background. Related actions together, unrelated actions separate.
5. **Primary action stays tinted** — "Done" or "Create" stands apart with accent color, often as a tinted symbol rather than a text button.

The admin cockpit already follows this — the floating toolbar uses RiClipboardLine (Hub), RiSeedlingLine (Garden), RiTeamLine (Community) with delayed tooltips.

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
