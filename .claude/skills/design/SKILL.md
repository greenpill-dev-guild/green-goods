---
name: design
description: "Design philosophy for adaptive, spatial interfaces. Paradigm selection, material language, interaction patterns, inclusive design, ecosystem thinking, and progressive immersion strategy. Use for design direction, visual language decisions, and spatial UI planning."
version: "2.0.0"
status: active
packages: ["shared", "client", "admin"]
dependencies: ["ui"]
last_updated: "2026-04-02"
last_verified: "2026-04-02"
---

# Design Skill

Design philosophy and visual direction for building spatial-ready, AI-driven interfaces. This skill shapes *what* to build and *why* — the `ui` skill handles *how* (tooling, tokens, compliance).

> **Paradigm**: The Adaptive Surface, expressed through **Warm Glass** — Material's warmth of color, shape morphing, and spring physics wrapped in Liquid Glass's structural precision, concentricity, and content-forward hierarchy. Not pages, not screens — living control surfaces that breathe with spring physics and shift material as engagement deepens. See [language.md](./language.md) for the full design language spec.

## Activation

| Domain | Keywords / Triggers | Sub-file |
|--------|-------------------|----------|
| **Design Language** | Warm Glass, shape system, motion tokens, color direction, components, hero moments | [language.md](./language.md) |
| **Design Philosophy** | design direction, paradigm, adaptive surface, spatial, vision | This file |
| **Depth & Space** | Z-axis, depth, layers, glass pane, elevation, scroll depth | [spatial.md](./spatial.md) |
| **Interaction** | adaptive density, progressive disclosure, multimodal, hover-to-gaze | [interaction.md](./interaction.md) |
| **Materials** | glass, material, blur, surface, frosted, translucent | [materials.md](./materials.md) |
| **Implementation Bridge** | view transitions, generative UI, progressive immersion, spatial CSS | [implementation.md](./implementation.md) |
| **Ecosystem** | ecosystem, relational, cascade, multi-user, surrogate, autonomic, archetype | [ecosystem.md](./ecosystem.md) |
| **Regenerative** | regenerative, regen, degen, mycofi, commons, biomimicry, succession, growth-agnostic, capability | [regenerative.md](./regenerative.md) |
| **Review Checklist** | review, PR, audit, compliance, checklist, design review, before merging | [review-checklist.md](./review-checklist.md) |
| **References** | inspiration, design books, spatial readiness checklist | [references.md](./references.md) |

When invoked:
1. Establish design paradigm and material metaphor before writing code
2. Apply Inclusive Design lens — every decision raises or lowers barriers
3. Apply Ecosystem lens for multi-user surfaces — whose experience composes with whose? ([ecosystem.md](./ecosystem.md))
4. Defer to `ui` skill for TailwindCSS config, Radix primitives, Storybook, i18n, compliance
5. Run Spatial Readiness Checklist ([references.md](./references.md)) and Ecosystem Readiness Checklist ([ecosystem.md](./ecosystem.md)) on new components

---

## Quad Foundation

Four frameworks anchor every design decision:

### The Adaptive Surface Paradigm

The interface is a set of adaptive surfaces. Information floats in layers of relevance — the most urgent at eye level, the contextual at the periphery, the archival behind a gesture. Controls appear when context demands them and recede when it doesn't. The user is in command, not along for the ride.

This paradigm is not decoration. It is information architecture expressed through depth, density, and contextual revelation. A dashboard that shows everything at once has every surface at maximum opacity — it creates noise, not awareness.

Not everything should be spatial. A simple form is a simple form. The paradigm applies when: the user monitors multiple data streams, a primary focus needs auxiliary context, or the interface is dense enough to benefit from depth layering.

### Microsoft Inclusive Design

Three principles woven throughout — not a checklist, a lens:

- **Recognize Exclusion** — Spatial interfaces create new forms of exclusion: gorilla arm fatigue, gaze tracking imprecision, depth perception variance, motion sickness. The [Persona Spectrum](./interaction.md) maps these across permanent, temporary, and situational contexts.
- **Learn from Diversity** — Adaptive density and progressive disclosure serve cognitive diversity, not just preference. The [Cognition Extension](https://inclusive.microsoft.design/) adds: understand motivation → discern cognitive load → co-create across the neurodiversity spectrum.
- **Solve for One, Extend to Many** — Every spatial pattern must degrade gracefully to 2D, voice, and keyboard. Closed captions started for the deaf and became universal. Spatial patterns that work only in spatial mode are incomplete.

### Regenerative Design

Does this design regenerate or extract? Seven principles — make the mycelium visible, design for succession, enrich the edges, failure is succession, be growth-agnostic, capability is the deliverable, regen not degen. Full framework: [regenerative.md](./regenerative.md). Run the Regenerative Design Checklist alongside Spatial Readiness and Ecosystem Readiness on new components.

### User Ecosystem Thinking

The interface exists in an ecosystem of interconnected people. A single design decision cascades across users who may never see the same screen. Based on Youngblood, Chesluk, and Haidary's framework (BIS Publishers, 2021).

- **Design for relationships, not individuals** — 15 archetypes classify users by their functional relationship to the artifact (Direct, Governing, Dependent, Autonomic, etc.), not by demographics. A person occupies multiple archetypes simultaneously.
- **Make cascades visible** — When a governing user's action affects dependent users, show the blast radius before confirmation. "Reject" is not just a button — it is a decision that reaches Maria.
- **Surface autonomic actors** — On-chain contracts, indexers, and resolvers are not infrastructure. They are non-human actors whose behavior shapes every user's experience. Give them visible state.

Full framework, Green Goods ecosystem map, and design patterns: [ecosystem.md](./ecosystem.md)

---

## Paradigm Selection

Choose one paradigm per surface. Mix across a view.

| Paradigm | When | Feel | Density |
|----------|------|------|---------|
| **Command Surface** | Primary action area | Glass pane, sharp focus, high contrast | High — controls visible and ready |
| **Ambient Display** | Status, background info | Translucent, soft, peripheral | Low — glanceable, never demands attention |
| **Data Landscape** | Analytics, history, flows | Volumetric, layered, navigable | Variable — zooms overview to detail |
| **Conversational** | AI interaction, guidance | Minimal chrome, content-forward | Sparse — message and response |
| **Ritual** | Onboarding, confirmation, ceremony | Full-screen, cinematic, focused | Single-purpose — one thing, done well |

### Material Metaphors

Pick a material that carries the entire surface:

| Material | Visual Language | Best For |
|----------|----------------|----------|
| **Liquid Glass** | Refracted light, variable blur, chromatic edges | Command surfaces, active workspaces (**default Warm Glass material**) |
| **Obsidian** | Dark, reflective, warm accent glows on interaction | Data landscapes, operator tools |
| **Vellum** | Warm, tactile, paper-like grain texture | Conversational surfaces, documentation |
| **Holographic** | Iridescent edges, gradient shifts, spectral accents | Ritual moments, celebrations, onboarding |
| **Carbon** | Industrial matte dark, precise grid lines, monospace | Technical/operator surfaces, config |

Then enforce it — every element speaks the same material language.

---

## Anti-Patterns

### Design Philosophy
1. **Dashboard-itis** — Cramming every metric onto one flat surface. Use progressive disclosure.
2. **Spatial for spatial's sake** — A contact form doesn't need depth layers. Match paradigm to complexity.
3. **Glass without purpose** — Blurring everything ≠ depth. Materials serve information hierarchy.
4. **Edge-anchored in 2026** — Anchoring nav to viewport edges. In spatial computing, there are no edges. Float controls.
5. **Uniform density** — Same spacing everywhere. Adapt: comfortable / compact / focused.

### Inclusive Design
6. **Spatial-only patterns** — Any interaction that requires gaze, gesture, or depth perception without keyboard/voice fallback.
7. **Cognitive overload via material** — Ultrathin glass over text-dense content. Thick material is mandatory for readability.
8. **Motion without escape** — Spatial animations without `prefers-reduced-motion` respect.
9. **Assuming full vision** — Depth cues that rely solely on blur or parallax without alternative hierarchy signals (size, weight, contrast).

### Visual Execution
10. **Generic AI slop** — Inter + purple gradient + white bg + predictable grid = forgettable.
11. **Sharp corners at scale** — Squircles for panes. Sharp only for inline text elements.
12. **Motion without meaning** — Every animation communicates state change, not decoration.

---

## Decision Tree

```text
What kind of design work?
│
├─► New view or page?
│   ├── Choose paradigm (Command / Ambient / Data / Conversational / Ritual)
│   ├── Choose material metaphor (Glass / Obsidian / Vellum / Holographic / Carbon)
│   ├── Apply Inclusive Design lens (who gets excluded? what's the fallback?)
│   ├── Define disclosure layers (glance → scan → engage → deep dive)
│   └── Implement with ui skill (Pane pattern + adaptive density)
│
├─► New component?
│   ├── What Z-layer? (ground / surface / floating / overlay) → spatial.md
│   ├── What material? → materials.md
│   ├── Interactive? (hit targets ≥ 44px, keyboard reachable) → interaction.md
│   └── Run Spatial Readiness Checklist → references.md
│
├─► Multi-user or governing surface?
│   ├── Map archetypes involved → ecosystem.md
│   ├── Add cascade indicators for governing actions
│   ├── Surface autonomic actor state (resolver, indexer, queue)
│   └── Run Ecosystem Readiness Checklist → ecosystem.md
│
├─► Visual polish pass?
│   ├── Replace solid backgrounds with materials → materials.md
│   ├── Add depth via Z-layer model → spatial.md
│   ├── Add progressive disclosure to dense surfaces → interaction.md
│   └── Verify inclusive design checks → references.md
│
├─► Animation / spatial motion?
│   ├── View transitions for navigation morph → implementation.md
│   ├── Scroll-linked depth → spatial.md
│   └── Respect prefers-reduced-motion (MANDATORY)
│
├─► Generative UI / AI surface?
│   └── UIAtom composition pattern → implementation.md
│
└─► Need inspiration or direction?
    └── Reference library → references.md
```

---

## Related Skills

- `ui` — Implementation tooling: TailwindCSS v4, Radix UI, Storybook, i18n, compliance, animation recipes
- `react` — Component composition, state management, performance optimization
- `data-layer` — Offline-first patterns, sync state as ambient UI indicators
- `architecture` — System boundaries that influence surface decomposition

> **Note**: This skill was previously named `frontend-design`. The broader scope (ecosystem thinking, inclusive design, bot/docs tone) warranted the simpler name.
