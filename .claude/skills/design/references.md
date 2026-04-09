# References & Spatial Readiness Checklist

## Books

| Book | Author | Key Concept |
|------|--------|-------------|
| *Laws of UX* | Jon Yablonski | Psychology-backed design heuristics (Fitts's Law, Hick's Law, Miller's Law) |
| *Refactoring UI* | Adam Wathan, Steve Schoger | Visual design for developers — spacing, hierarchy, color, typography |
| *The Design of Everyday Things* | Don Norman | Affordances, signifiers, mapping — timeless interaction principles |
| *Designing Interfaces* (3rd ed.) | Jenifer Tidwell et al. | Pattern library for interaction design |
| *Designing for Spatial Computing* | O'Reilly (2025) | visionOS principles, gaze+pinch, window management |

## Designers & Studios

| Who | Known For | Follow For |
|-----|-----------|------------|
| **Rauno Freiberg** (Vercel) | Spatial web effects, liquid interfaces | Bleeding-edge CSS/motion |
| **Paco Coursey** (Linear) | Precision minimalism, keyboard-first | Command surface craft |
| **Lee Robinson** (Vercel) | Developer-facing design systems | Performance-aware design |
| **Stripe Design** | Glass materials, data-dense elegance | Financial/data UI |
| **Linear** | GPU-rendered UI, keyboard navigation | Operator tools, control panes |
| **Apple HIG (Spatial)** | visionOS guidelines | Material system, gaze patterns |
| **Diagram (Rive)** | Interactive motion design | Cross-platform micro-interactions |

## Inspiration Sources

| Source | Use For |
|--------|---------|
| **Godly** | High-end visual direction, animation |
| **Refero** | Real-world UI patterns by interaction type |
| **Mobbin** | Mobile/web app flow analysis |
| **UXArchive** | User flow recordings |
| **Awwwards** | Boundary-pushing sites with tech breakdowns |

## Tools

| Tool | Use For |
|------|---------|
| **Figma** (AI features) | Layout generation, design-to-code |
| **Rive** | Interactive motion graphics, stateful animations |
| **Spline** | 3D web experiences, spatial UI prototyping |
| **Motion** (Framer Motion) | Production React animations, layout gestures |
| **View Transitions API** | Native morphing navigation |

## Research & Frameworks

| Source | Authority On |
|--------|-------------|
| **Nielsen Norman Group** | Research-backed usability, AI UX, spatial interaction |
| **Growth.Design** | Interactive case studies on product psychology |
| **Baymard Institute** | E-commerce UX benchmarks |
| **Material Design 3** | Adaptive tokens, dynamic color, motion |
| **Material 3 Expressive** (Google I/O 2025) | Spring-based motion tokens, shape morphing, component flexibility (5 button sizes, button groups, split button, FAB menu), expressive color (higher chroma, brighter on-container), hero moments, wavy progress indicators |
| **Liquid Glass** (Apple WWDC 2025) | Concentricity (3 shape types: fixed, capsule, concentric), functional glass layers, source-anchored interaction, scroll edge effects (soft/hard), symbol-first navigation, background extension, material focus variation, content-forward hierarchy |
| **Microsoft Inclusive Design** | [inclusive.microsoft.design](https://inclusive.microsoft.design/) — Persona Spectrum, cognitive inclusion |
| **Inclusive Design for Cognition** | Cognitive load management, neurodiversity, motivation-first design |
| **Inclusive Design for Mental Health** | Emotional state awareness, stress-responsive patterns |
| **Rethinking Users** (Youngblood, Chesluk, Haidary) | [rethinkingusers.com](https://www.rethinkingusers.com/) — 15 user archetypes, ecosystem mapping, relational design |
| **EPIC 2023** — Friction & Ease in Complex Systems | Ethnographic frictions, systems phenomena, user ecosystem theory |
| **NNGroup — User-Ecosystem Thinking** | [nngroup.com](https://www.nngroup.com/articles/user-ecosystem-thinking-anthropologic/) — Practitioner-oriented ecosystem framework |

---

## Spatial Readiness Checklist

Run before shipping new components or views:

```
Spatial Readiness Check
│
├─ [ ] Detached from edges?
│      Nav, toolbars, and controls float — not anchored to viewport edges
│
├─ [ ] Material-based backgrounds?
│      Using backdrop-blur + semi-transparent bg, not solid hex colors
│      (Thick material for text-dense surfaces)
│
├─ [ ] Generous hit targets?
│      All interactive elements ≥ 44px (gaze/touch imprecision)
│
├─ [ ] Squircle corners?
│      Rounded corners scale with element size (12-24px)
│
├─ [ ] Progressive disclosure?
│      Information layers: glance → scan → engage → deep dive
│
├─ [ ] Container-query aware?
│      Components adapt to container, not viewport
│
├─ [ ] View transition named?
│      Persistent entities have viewTransitionName for morph navigation
│
├─ [ ] Depth hierarchy?
│      Z-axis used for information hierarchy (Z0-Z4 model)
│
├─ [ ] Adaptive density?
│      Comfortable / compact / focused modes available
│
├─ [ ] Motion respects reduced-motion?
│      All animations degrade with prefers-reduced-motion
│
├─ [ ] Works without gaze?
│      Every action reachable via keyboard + voice fallback
│      (Persona Spectrum: permanent/temporary/situational exclusion)
│
├─ [ ] Cognitive load appropriate?
│      Material thickness matches content density
│      Glass blur doesn't reduce readability for text-heavy surfaces
│      Progressive disclosure reduces overwhelm for neurodiverse users
│
├─ [ ] Concentric shapes?  (Warm Glass)
│      Nested containers use parent_radius - padding for child radius
│      Three types: Fixed (constant), Capsule (half-height), Concentric (derived)
│
├─ [ ] Source-anchored interactions?  (Warm Glass)
│      Menus, sheets, confirmations spring from their trigger element
│      Not from screen edges or arbitrary positions
│
├─ [ ] Spring-based motion?  (Warm Glass)
│      All transitions use named spring tokens (--spring-spatial, --spring-effects)
│      Not hardcoded cubic-bezier + duration values
│
├─ [ ] Scroll edge effects?  (Warm Glass)
│      Glass/content boundaries use soft blur, not hard dividers
│      One per view, not decorative, only where glass overlaps content
│
├─ [ ] Symbol-first navigation?  (Warm Glass)
│      Persistent nav uses symbols, text only for ambiguous actions
│      Related actions grouped on shared glass background
│
└─ [ ] Hero moments identified?  (Warm Glass)
       Key celebrations use expressive motion + shape + color combined
       Succession-aware: pioneer=simple, intermediate=moderate, climax=full
```
