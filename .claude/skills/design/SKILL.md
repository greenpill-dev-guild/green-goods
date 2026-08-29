---
name: design
user-invocable: false
description: "Green Goods design direction — the Warm Earth design language (shape, motion, color, material tokens), admin cockpit vs client PWA surface identities, paradigm selection, layout composition, AI design-tool prompt contracts, and design review lenses. Use for design direction, visual language decisions, what paradigm or material a view should use, new views or components, UI polish passes, and preparing prompts for AI design tools."
token_version: "2.6.0"
---

# Design Skill

Design philosophy and visual direction for building spatial-ready, AI-driven interfaces. This skill shapes *what* to build and *why* — [implementation.md](./implementation.md) covers *how* (tooling, tokens, compliance).

> **Paradigm**: The Adaptive Surface.
> **Aesthetic direction**: **Warm Earth** — architectural warmth, handmade precision, garden journal over trading terminal (see root `DESIGN.md`).
> **Design language**: the **Warm Earth** language — Material 3 Expressive × Liquid Glass structural precision. Content-forward hierarchy, concentric geometry, spring physics, organic color. Root `DESIGN.md` front matter is the canonical DesignMD token source; see [language.md](./language.md) for implementation guidance.

## Route to another skill when…

- You need an at-a-glance map of this skill stack (which file owns which question) → [ARCHITECTURE.md](./ARCHITECTURE.md).
- You are doing **any admin-console UI work** (shipped console, admin prototypes, AI-generated admin design) → [admin-ux-brief.md](./admin-ux-brief.md) (the canonical brief + authoritative external references) and [interaction-patterns.md](./interaction-patterns.md) (the codified contract: action placement/alignment, dialog taxonomy and shell continuity, flow anatomy, layout, row/status anatomy, component parity — each rule cited to shipped code). Both are MANDATORY reading before an admin design round.
- You need implementation detail (Tailwind tokens, Radix composition, a11y checks, Storybook, i18n) → [implementation.md](./implementation.md).
- You are about to feed a design to an AI tool or coding agent → [ai-ui-brief.md](./ai-ui-brief.md) + § Working with AI Design Tools below + the matching prompt contract.
- You need the **admin** AI prompt contract (stable core, vocabulary, never-use list) → [prompt-contract.md](./prompt-contract.md).
- You need the **client** AI prompt contract → [client-prompt-contract.md](./client-prompt-contract.md).
- You need to **report a UI defect** on an admin surface (grammar, component identifiers, browser workflow) → [defect-grammar.md](./defect-grammar.md).
- You need the **locked design decisions** (the `DL-NNN` ledger, its graduation ladder, or where a decision was codified) → [decision-log.md](./decision-log.md).
- You just need a scannable token cheat sheet → [quick-reference.md](./quick-reference.md).
- You are doing a **design-system alignment review** — full-repo, or stack-only when the target is just the `design/` skill stack → [system-alignment-review.md](./system-alignment-review.md).

## Token version

This skill's frontmatter `token_version` reflects the current Warm Earth token spec in [language.md](./language.md); `scripts/design/check-tokens.sh` requires the field and verifies every spec'd token is projected into `theme.css`.

**When `language.md` tokens change** (radii, springs, materials, color roles): bump `token_version` here and re-verify [implementation.md](./implementation.md) references still align.

## Activation

| Domain | Keywords / Triggers | Sub-file |
|--------|-------------------|----------|
| **Skill Map** | where does X live, skill stack, routing, architecture overview | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| **Design Language** | Warm Earth language, shape system, motion tokens, color direction, components, hero moments | [language.md](./language.md) |
| **AI UI Brief** | reusable prompt contract, external reference role map, saved UI/CSS build brief | [ai-ui-brief.md](./ai-ui-brief.md) |
| **Admin UX Brief** | admin usability brief, NN/g heuristics, GOV.UK patterns, USWDS, Laws of UX, Refactoring UI, responsive requirements | [admin-ux-brief.md](./admin-ux-brief.md) |
| **Interaction Patterns** | action placement, alignment, right-aligned actions, stable view actions, dialog taxonomy, shell continuity, flow anatomy, two-column rail, row anatomy, state matrix, component parity | [interaction-patterns.md](./interaction-patterns.md) |
| **Admin Prompt Contract** | admin stable core, banned terms, workspace vocabulary for AI design tools | [prompt-contract.md](./prompt-contract.md) |
| **Client Prompt Contract** | client stable core, banned terms, PWA shell vocabulary | [client-prompt-contract.md](./client-prompt-contract.md) |
| **Defect Grammar** | "this looks broken", describe UI bug, component identifier lookup, defect types, browser inspect workflow | [defect-grammar.md](./defect-grammar.md) |
| **Decision Log** | locked decision, DL-NNN, design ruling, "what did we decide about", decision ledger, codification | [decision-log.md](./decision-log.md) |
| **Quick Reference** | cheat sheet, radii, springs, colors, materials, paradigms at a glance | [quick-reference.md](./quick-reference.md) |
| **Design Philosophy** | design direction, paradigm, adaptive surface, spatial, vision, progressive immersion | This file |
| **Surfaces** | Z-axis, depth, glass pane, elevation, material, blur, adaptive density, progressive disclosure, multimodal | [surfaces.md](./surfaces.md) |
| **View Transitions** | view transition API, entity morphing, spatial navigation | [implementation.md § View Transitions](./implementation.md) |
| **Ecosystem** | ecosystem, relational, cascade, multi-user, surrogate, autonomic, archetype | [ecosystem.md](./ecosystem.md) |
| **Regenerative** | regenerative, regen, degen, mycofi, commons, biomimicry, succession, growth-agnostic, capability | [regenerative.md](./regenerative.md) |
| **Review Checklist** | review, PR, audit, compliance, checklist, design review, before merging | [review-checklist.md](./review-checklist.md) |
| **System Alignment Review** | design system alignment, UI drift, Storybook alignment, full repo design-system review, stack review, meta-review of the design skill stack | [system-alignment-review.md](./system-alignment-review.md) |

When invoked:
0. Check [decision-log.md](./decision-log.md) for `locked` rows touching your surface — locked decisions bind immediately, before codification
1. Establish design paradigm and material metaphor before writing code
2. Apply Inclusive Design lens — every decision raises or lowers barriers
3. Apply Ecosystem lens for multi-user surfaces — whose experience composes with whose? ([ecosystem.md](./ecosystem.md))
4. Defer to [implementation.md](./implementation.md) for TailwindCSS config, Radix primitives, Storybook, i18n, compliance
5. Run the unified [review-checklist.md](./review-checklist.md) (4 lenses: Regenerative / Spatial / Ecosystem / Compliance) on new components before merging

---

## Quad Foundation

Four frameworks anchor every design decision:

### The Adaptive Surface Paradigm

The interface is a set of adaptive surfaces. Information floats in layers of relevance — the most urgent at eye level, the contextual at the periphery, the archival behind a gesture. Controls appear when context demands them and recede when it doesn't. The user is in command, not along for the ride.

This paradigm is not decoration. It is information architecture expressed through depth, density, and contextual revelation. A dashboard that shows everything at once has every surface at maximum opacity — it creates noise, not awareness.

Not everything should be spatial. A simple form is a simple form. The paradigm applies when: the user monitors multiple data streams, a primary focus needs auxiliary context, or the interface is dense enough to benefit from depth layering.

### Microsoft Inclusive Design

Three principles woven throughout — not a checklist, a lens:

- **Recognize Exclusion** — Spatial interfaces create new forms of exclusion: gorilla arm fatigue, gaze tracking imprecision, depth perception variance, motion sickness. The [Persona Spectrum](./surfaces.md) maps these across permanent, temporary, and situational contexts.
- **Learn from Diversity** — Adaptive density and progressive disclosure serve cognitive diversity, not just preference. The [Cognition Extension](https://inclusive.microsoft.design/) adds: understand motivation → discern cognitive load → co-create across the neurodiversity spectrum.
- **Solve for One, Extend to Many** — Every spatial pattern must degrade gracefully to 2D, voice, and keyboard. Closed captions started for the deaf and became universal. Spatial patterns that work only in spatial mode are incomplete.

### Regenerative Design

Does this design regenerate or extract? Seven principles — make the mycelium visible, design for succession, enrich the edges, failure is succession, be growth-agnostic, capability is the deliverable, regen not degen. Full framework: [regenerative.md](./regenerative.md). PR checks live in the unified [review-checklist.md](./review-checklist.md) § Lens 1.

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
| **Liquid Glass** | Refracted light, variable blur, chromatic edges | Command surfaces, active workspaces (**default material for client PWA**) |
| **Obsidian** | Dark, reflective, warm accent glows on interaction | Data landscapes, steward tools |
| **Vellum** | Warm, tactile, paper-like grain texture | Conversational surfaces, documentation |
| **Holographic** | Iridescent edges, gradient shifts, spectral accents | Ritual moments, celebrations, onboarding |
| **Carbon** | Industrial matte dark, precise grid lines, monospace | Technical/steward surfaces, config |

Then enforce it — every element speaks the same material language.

### Admin Cockpit Carve-Out

For `packages/admin` and steward dashboards, do not treat the Warm Earth language as permission to make the cockpit theatrical. The cockpit inherits warmth and concentric geometry from the design language, but expresses them through restraint — solid surfaces, quiet workspace tint, utility copy. See [prompt-contract.md](./prompt-contract.md) for the stable admin brief.

- Default to **Command Surface** with restrained material, strong typography, and calm workspace hierarchy.
- Use subtle atmosphere and tint, not decorative spectacle.
- Prefer utility copy, visible task flow, and inspector patterns over immersive scenes or brand moments.
- If a design move would be inappropriate for Linear, GitHub, or Stripe Dashboard, it is probably inappropriate for Green Goods admin unless explicitly requested.

---

## Working with AI Design Tools

The platforms come and go. The contract is platform-agnostic and saved in [ai-ui-brief.md](./ai-ui-brief.md):

1. **Feed the right context** — [ai-ui-brief.md](./ai-ui-brief.md) + root `DESIGN.md` + the matching surface DESIGN.md (`packages/admin/DESIGN.md`, `packages/client/DESIGN.pwa.md`, `packages/client/DESIGN.browser.md`, or `docs/DESIGN.md`) + the matching prompt contract when one exists (`prompt-contract.md` admin / `client-prompt-contract.md` client).
2. **One screen per pass** — quality degrades when multiple screens get bundled into a single prompt.
3. **Screenshot is the source of truth** — generated HTML is reference only. Map output back to existing components; never accept generic React.
4. **Use the canonical palette** — `Admin*` wrappers (admin) or `@green-goods/shared` primitives (client). Flag missing primitives instead of inventing component names.
5. **Route by repo-owned sources** — use [ARCHITECTURE.md](./ARCHITECTURE.md), the surface DESIGN file, and the matching prompt contract as the surface map.

If a platform-specific quirk really is worth recording (e.g. a one-line tip about a particular tool's prompt parser), put it in your user memory, not in a project skill. Project skills outlive any single tool.

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
13. **Client styling in the cockpit** — Do not import landing-page or public-brand composition rules into steward surfaces.

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
│   └── Implement per implementation.md (Pane pattern + adaptive density)
│
├─► New component?
│   ├── What Z-layer? (ground / surface / floating / overlay) → surfaces.md
│   ├── What material? → surfaces.md
│   ├── Interactive? (hit targets ≥ 44px, keyboard reachable) → surfaces.md
│   └── Run review-checklist.md § Lens 2 (Spatial Readiness)
│
├─► Multi-user or governing surface?
│   ├── Map archetypes involved → ecosystem.md
│   ├── Add cascade indicators for governing actions
│   ├── Surface autonomic actor state (resolver, indexer, queue)
│   └── Run review-checklist.md § Lens 3 (Ecosystem Awareness)
│
├─► Visual polish pass?
│   ├── Replace solid backgrounds with materials → surfaces.md
│   ├── Add depth via Z-layer model → surfaces.md
│   ├── Add progressive disclosure to dense surfaces → surfaces.md
│   └── Verify inclusive design checks → review-checklist.md § Lens 2
│
├─► Animation / spatial motion?
│   ├── View transitions for navigation morph → ./implementation.md § View Transitions
│   ├── Scroll-linked depth → surfaces.md
│   └── Respect prefers-reduced-motion (MANDATORY)
│
└─► Need inspiration or direction?
    └── language.md § Philosophy (Sources) — the model already knows the classic
        design canon; the skill only records what Warm Earth takes from it
```

---

## Progressive Immersion Strategy

Build **one semantic core** that scales across capability tiers. Do not build separate apps.

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
└── Green Goods: future — prepared via glass pane patterns, concentricity, view transitions
```

**The bridge**: Each tier is additive. Tier 2 includes everything from Tier 1. Tier 3 includes everything from Tier 2. **Nothing is spatial-only** — that's a core rule from Inclusive Design (see Quad Foundation above).

This maps to Green Goods' offline-first architecture: the offline state (service worker, IndexedDB) IS Tier 1. The PWA is Tier 2. The codebase is spatially-prepared via glass panes and container queries ([surfaces.md](./surfaces.md)) and view transitions ([implementation.md § View Transitions](./implementation.md)).

---

## Related Surfaces

- [implementation.md](./implementation.md) — Implementation tooling: dialogs, component runbook, Storybook, i18n, view transitions
- `.claude/context/shared.md` — Hooks, stores, error utilities behind the components
- `.claude/context/client.md` — Offline-first patterns, sync state as ambient UI indicators
- `review` — boundary/coherence judgment when surface decomposition is in question

---

> **Note**: This skill was previously named `frontend-design`. The broader scope (ecosystem thinking, inclusive design, bot/docs tone) warranted the simpler name. The former reading-list appendix (books, designers, inspiration sites, tools) was removed in the 2026-07 round-2 consolidation — it was generic design-industry knowledge the model already has; Warm Earth's actual sources stay recorded in [language.md § Philosophy](./language.md).
