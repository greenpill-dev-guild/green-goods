---
name: design
user-invocable: false
description: "Design philosophy for adaptive, spatial interfaces. Paradigm selection, material language, interaction patterns, inclusive design, ecosystem thinking, and progressive immersion strategy. Use for design direction, visual language decisions, and spatial UI planning."
version: "2.5.0"
token_version: "2.4.0"
status: active
packages: ["shared", "client", "admin"]
dependencies: []
last_updated: "2026-06-30"
last_verified: "2026-06-30"
changelog:
  - "2.5.0 — token_version → 2.4.0. Deliberate admin dark-mode palette (not a light inversion): warm surface ladder (higher elevation = lighter), ring-forward elevation, dual-use-safe per-view accents (light --tone-primary for on-surface text, deep white-safe --tone-action for fills), raised canvas wash. New § Dark Mode Palette (Admin) in language.md with an AA contrast table; new check:design-tokens dark-parity guard."
  - "2.4.1 — Added ai-ui-brief.md as the saved reusable prompt contract for UI/CSS/design generation. Removed stale tool-specific references and replaced missing legacy surface-map routing with repo-owned DesignMD + surface dialect routing."
  - "2.4.0 — Removed project-specific AI-design-tool skills. AI-design platforms change too fast to encode per-platform; the durable contract is platform-agnostic and now lives in this file under § Working with AI Design Tools. ARCHITECTURE.md collapsed from a four-skill stack to a two-skill stack."
  - "2.3.3 — Added stack-review.md (design-system self-audit protocol, scoped strictly to design/ + ui/). ARCHITECTURE.md synced: version label bumped to 2.3.3, stack-review.md added to the Where-to-look table and Related section. stack-review.md hardened with an explicit scope fence (out-of-scope list: other skills, registry canonical_commands, check-guidance-consistency, ship/plan/debug) after a first-run drift into non-design findings."
  - "2.3.2 — review-checklist.md § Closing the Loop rewritten to mark each lens's automation as Wired / Partial / Proposed, with evidence. Dropped two broken commands from the Quick wiring reference (`bun --filter @green-goods/shared test-storybook --failOnA11yIssues` and `bun --filter @green-goods/shared chromatic` — neither script exists in `packages/shared/package.json`). Added a Roadmap subsection listing what's needed to move each Proposed row to Wired. No token changes."
  - "2.3.1 — Spring motion tokens shipped to packages/shared/src/styles/theme.css (previously spec'd as aspirational in language.md; AI tools can now safely emit var(--spring-*)). prompt-contract.md clarifies admin = restrained Warm Earth (not raw M3) and that hero moments are client-only. materials.md stale 'not yet in theme.css' note removed. review-checklist.md references new scripts bun run lint:vocab and bun run check:design-tokens instead of the unwritten biome rule. Registry token_version synced to 2.3.0 (was drifted at 2.2.0)."
  - "2.3.0 — Added client-prompt-contract.md (closes admin/client asymmetry). Material tokens now implemented in theme.css (no longer aspirational). Added quick-reference.md cheat sheet. Closing-the-loop section added to review-checklist.md. implementation.md split — generative UI stayed, view transitions moved to ui/, progressive immersion folded into SKILL.md, references.md folded into SKILL.md appendix. Registry triggers expanded for finer activation routing. Bumped token_version — coupled ui skill should revisit compliance guidance."
  - "2.2.0 — Consolidated the legacy implementation token guide into language.md. Reconciled colour model on canvas/ink/stone/green-as-tertiary. Collapsed per-file checklists into review-checklist.md. DESIGN.md rewritten as terse creative brief."
---

# Design Skill

Design philosophy and visual direction for building spatial-ready, AI-driven interfaces. This skill shapes *what* to build and *why* — the `ui` skill implements *how* (tooling, tokens, compliance).

> **Paradigm**: The Adaptive Surface.
> **Aesthetic direction**: **Warm Earth** — architectural warmth, handmade precision, garden journal over trading terminal (see root `DESIGN.md`).
> **Design language**: the **Warm Earth** language — Material 3 Expressive × Liquid Glass structural precision. Content-forward hierarchy, concentric geometry, spring physics, organic color. Root `DESIGN.md` front matter is the canonical DesignMD token source; see [language.md](./language.md) for implementation guidance.

## Route to another skill when…

- You need an at-a-glance map of this skill stack (which file owns which question) → [ARCHITECTURE.md](./ARCHITECTURE.md).
- You need implementation detail (Tailwind tokens, Radix composition, a11y checks, Storybook, i18n) → **`ui`** skill.
- You are about to feed a design to an AI tool or coding agent → [ai-ui-brief.md](./ai-ui-brief.md) + § Working with AI Design Tools below + the matching prompt contract.
- You need the **admin** AI prompt contract (stable core, vocabulary, never-use list) → [prompt-contract.md](./prompt-contract.md).
- You need the **client** AI prompt contract → [client-prompt-contract.md](./client-prompt-contract.md).
- You need to **report a UI defect** on an admin surface (grammar, component identifiers, browser workflow) → [defect-grammar.md](./defect-grammar.md).
- You just need a scannable token cheat sheet → [quick-reference.md](./quick-reference.md).
- You are doing a **full design-system alignment review** across DesignMD files, tokens, Storybook, admin, client, docs, and agentic guidance → [system-alignment-review.md](./system-alignment-review.md). Use [stack-review.md](./stack-review.md) instead when the target is only the `design/` + `ui/` skill stack.

## Version coupling with `ui`

This skill has a `token_version` field in frontmatter that reflects the current Warm Earth token spec in [language.md](./language.md). The `ui` skill has a `design_token_version` field that mirrors it.

**When `language.md` tokens change** (radii, springs, materials, color roles):
1. Bump `token_version` on this skill
2. Bump `design_token_version` on `ui` skill to match
3. Re-verify `ui/compliance.md` references still align
4. Note the token delta in both skills' changelogs

If the two versions drift, you have a token consistency bug: the design says one thing, the implementation guidance still references the old. The version field exists to make that drift obvious on `grep`.

## Activation

| Domain | Keywords / Triggers | Sub-file |
|--------|-------------------|----------|
| **Skill Map** | where does X live, skill stack, routing, architecture overview | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| **Design Language** | Warm Earth language, shape system, motion tokens, color direction, components, hero moments | [language.md](./language.md) |
| **AI UI Brief** | reusable prompt contract, external reference role map, saved UI/CSS build brief | [ai-ui-brief.md](./ai-ui-brief.md) |
| **Admin Prompt Contract** | admin stable core, banned terms, workspace vocabulary for AI design tools | [prompt-contract.md](./prompt-contract.md) |
| **Client Prompt Contract** | client stable core, banned terms, PWA shell vocabulary | [client-prompt-contract.md](./client-prompt-contract.md) |
| **Defect Grammar** | "this looks broken", describe UI bug, component identifier lookup, defect types, browser inspect workflow | [defect-grammar.md](./defect-grammar.md) |
| **Quick Reference** | cheat sheet, radii, springs, colors, materials, paradigms at a glance | [quick-reference.md](./quick-reference.md) |
| **Design Philosophy** | design direction, paradigm, adaptive surface, spatial, vision, progressive immersion | This file |
| **Depth & Space** | Z-axis, depth, layers, glass pane, elevation, scroll depth | [spatial.md](./spatial.md) |
| **Interaction** | adaptive density, progressive disclosure, multimodal, hover-to-gaze | [interaction.md](./interaction.md) |
| **Materials** | glass, material, blur, surface, frosted, translucent | [materials.md](./materials.md) |
| **Generative UI** | UI atoms, intent-driven composition, agent-generated surfaces | [generative-ui.md](./generative-ui.md) |
| **View Transitions** | view transition API, entity morphing, spatial navigation | [../ui/view-transitions.md](../ui/view-transitions.md) |
| **Ecosystem** | ecosystem, relational, cascade, multi-user, surrogate, autonomic, archetype | [ecosystem.md](./ecosystem.md) |
| **Regenerative** | regenerative, regen, degen, mycofi, commons, biomimicry, succession, growth-agnostic, capability | [regenerative.md](./regenerative.md) |
| **Review Checklist** | review, PR, audit, compliance, checklist, design review, before merging | [review-checklist.md](./review-checklist.md) |
| **Stack Review** | stack review, audit skill stack, meta-review, design skill stack health | [stack-review.md](./stack-review.md) |
| **System Alignment Review** | design system alignment, design-system alignment, UI drift, Storybook alignment, admin client docs alignment, full repo design-system review | [system-alignment-review.md](./system-alignment-review.md) |
| **Inspiration & Frameworks** | inspiration, design books, designers, studios, research | § Appendix below |

When invoked:
1. Establish design paradigm and material metaphor before writing code
2. Apply Inclusive Design lens — every decision raises or lowers barriers
3. Apply Ecosystem lens for multi-user surfaces — whose experience composes with whose? ([ecosystem.md](./ecosystem.md))
4. Defer to `ui` skill for TailwindCSS config, Radix primitives, Storybook, i18n, compliance
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

- **Recognize Exclusion** — Spatial interfaces create new forms of exclusion: gorilla arm fatigue, gaze tracking imprecision, depth perception variance, motion sickness. The [Persona Spectrum](./interaction.md) maps these across permanent, temporary, and situational contexts.
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
| **Obsidian** | Dark, reflective, warm accent glows on interaction | Data landscapes, operator tools |
| **Vellum** | Warm, tactile, paper-like grain texture | Conversational surfaces, documentation |
| **Holographic** | Iridescent edges, gradient shifts, spectral accents | Ritual moments, celebrations, onboarding |
| **Carbon** | Industrial matte dark, precise grid lines, monospace | Technical/operator surfaces, config |

Then enforce it — every element speaks the same material language.

### Admin Cockpit Carve-Out

For `packages/admin` and operator dashboards, do not treat the Warm Earth language as permission to make the cockpit theatrical. The cockpit inherits warmth and concentric geometry from the design language, but expresses them through restraint — solid surfaces, quiet workspace tint, utility copy. See [prompt-contract.md](./prompt-contract.md) for the stable admin brief.

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
13. **Client styling in the cockpit** — Do not import landing-page or public-brand composition rules into operator surfaces.

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
│   └── Run review-checklist.md § Lens 2 (Spatial Readiness)
│
├─► Multi-user or governing surface?
│   ├── Map archetypes involved → ecosystem.md
│   ├── Add cascade indicators for governing actions
│   ├── Surface autonomic actor state (resolver, indexer, queue)
│   └── Run review-checklist.md § Lens 3 (Ecosystem Awareness)
│
├─► Visual polish pass?
│   ├── Replace solid backgrounds with materials → materials.md
│   ├── Add depth via Z-layer model → spatial.md
│   ├── Add progressive disclosure to dense surfaces → interaction.md
│   └── Verify inclusive design checks → § Appendix (below)
│
├─► Animation / spatial motion?
│   ├── View transitions for navigation morph → ../ui/view-transitions.md
│   ├── Scroll-linked depth → spatial.md
│   └── Respect prefers-reduced-motion (MANDATORY)
│
├─► Generative UI / AI surface?
│   └── UIAtom composition pattern → generative-ui.md
│
└─► Need inspiration or direction?
    └── § Appendix — Inspiration & Frameworks (below)
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

This maps to Green Goods' offline-first architecture: the offline state (service worker, IndexedDB) IS Tier 1. The PWA is Tier 2. The codebase is spatially-prepared via glass panes ([spatial.md](./spatial.md)), container queries ([interaction.md](./interaction.md)), and view transitions ([../ui/view-transitions.md](../ui/view-transitions.md)).

---

## Related Skills

- `ui` — Implementation tooling: TailwindCSS v4, Radix UI, Storybook, i18n, compliance, animation recipes
- `react` — Component composition, state management, performance optimization
- `data-layer` — Offline-first patterns, sync state as ambient UI indicators
- `architecture` — System boundaries that influence surface decomposition

---

## Appendix — Inspiration & Frameworks

Folded into this file from the former `references.md` during the 2026-04-17 skill consolidation. This is reading-list depth — use when you need direction, not when you need tokens (see [quick-reference.md](./quick-reference.md) for that).

### Books

| Book | Author | Key Concept |
|------|--------|-------------|
| *Laws of UX* | Jon Yablonski | Psychology-backed design heuristics (Fitts's Law, Hick's Law, Miller's Law) |
| *Refactoring UI* | Adam Wathan, Steve Schoger | Visual design for developers — spacing, hierarchy, color, typography |
| *The Design of Everyday Things* | Don Norman | Affordances, signifiers, mapping — timeless interaction principles |
| *Designing Interfaces* (3rd ed.) | Jenifer Tidwell et al. | Pattern library for interaction design |
| *Designing for Spatial Computing* | O'Reilly (2025) | visionOS principles, gaze+pinch, window management |

### Designers & Studios

| Who | Known For | Follow For |
|-----|-----------|------------|
| **Rauno Freiberg** (Vercel) | Spatial web effects, liquid interfaces | Bleeding-edge CSS/motion |
| **Paco Coursey** (Linear) | Precision minimalism, keyboard-first | Command surface craft |
| **Lee Robinson** (Vercel) | Developer-facing design systems | Performance-aware design |
| **Stripe Design** | Glass materials, data-dense elegance | Financial/data UI |
| **Linear** | GPU-rendered UI, keyboard navigation | Operator tools, control panes |
| **Apple HIG (Spatial)** | visionOS guidelines | Material system, gaze patterns |
| **Diagram (Rive)** | Interactive motion design | Cross-platform micro-interactions |

### Inspiration Sources

| Source | Use For |
|--------|---------|
| **Godly** | High-end visual direction, animation |
| **Refero** | Real-world UI patterns by interaction type |
| **Mobbin** | Mobile/web app flow analysis |
| **UXArchive** | User flow recordings |
| **Awwwards** | Boundary-pushing sites with tech breakdowns |

### Tools

| Tool | Use For |
|------|---------|
| **Figma** (AI features) | Layout generation, design-to-code |
| **Rive** | Interactive motion graphics, stateful animations |
| **Spline** | 3D web experiences, spatial UI prototyping |
| **Motion** (Framer Motion) | Production React animations, layout gestures |
| **View Transitions API** | Native morphing navigation — see [../ui/view-transitions.md](../ui/view-transitions.md) |

### Research & Frameworks

| Source | Authority On |
|--------|-------------|
| **Nielsen Norman Group** | Research-backed usability, AI UX, spatial interaction |
| **Growth.Design** | Interactive case studies on product psychology |
| **Baymard Institute** | E-commerce UX benchmarks |
| **Material Design 3** | Adaptive tokens, dynamic color, motion |
| **Material 3 Expressive** (Google I/O 2025) | Spring-based motion tokens, shape morphing, expressive color, hero moments, wavy progress |
| **Liquid Glass** (Apple WWDC 2025) | Concentricity (3 shape types), functional glass layers, source-anchored interaction, scroll edge effects, symbol-first nav |
| **Microsoft Inclusive Design** | [inclusive.microsoft.design](https://inclusive.microsoft.design/) — Persona Spectrum, cognitive inclusion |
| **Rethinking Users** (Youngblood, Chesluk, Haidary) | [rethinkingusers.com](https://www.rethinkingusers.com/) — 15 user archetypes, ecosystem mapping |
| **EPIC 2023** — Friction & Ease in Complex Systems | Ethnographic frictions, systems phenomena, user ecosystem theory |

---

> **Note**: This skill was previously named `frontend-design`. The broader scope (ecosystem thinking, inclusive design, bot/docs tone) warranted the simpler name.
