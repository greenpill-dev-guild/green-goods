# Green Goods Design System

> Creative brief for AI design tools. Paste this file (plus a surface-specific DESIGN.md) into Stitch, Figma AI, or any generative design tool to produce on-brand output.
>
> **Usage:** `cat DESIGN.md packages/client/DESIGN.md | pbcopy` (client) or `cat DESIGN.md packages/admin/DESIGN.md | pbcopy` (admin)

## Relationship to Codebase

This file uses **Stitch-compatible color vocabulary** (neutral/primary/secondary/tertiary = canvas/ink/stone/accent). The codebase uses its own naming (`--color-primary` = green). Neither changes — this file translates between them.

| Stitch Role | Job | Internal Token | Color |
|-------------|-----|---------------|-------|
| Neutral | Canvas (80-90%) | `--bg-white-0`, `--bg-weak-50` | Warm linen white (#FAF8F5 light / #1C1917 dark) |
| Primary | Ink (8-15%) | `--text-strong-950` | Warm charcoal (#292524 light / #F5F5F4 dark) |
| Secondary | Subdued support (3-5%) | `--text-sub-600` | Earth stone (#78716C light / #A8A29E dark) |
| Tertiary | Accent/CTA (1-3%) | `--color-primary` / `--green-500` | Garden green (#1FC16B) |

---

## Creative Direction

**Empathy statement:** Green Goods is a community garden. When users arrive, they should feel they've stepped into an open, sun-warmed garden where diverse beds grow side by side. The interface is the soil — warm, grounding, and ready for planting. Not a dashboard. Not a terminal. A place where impact takes root.

**Design concept:** *Warm Earth* — architectural warmth of sun-bleached linen, the quiet authority of a well-kept garden journal, and the vibrant punctuation of new growth. Handmade but precise, like a beautifully organized seed catalog.

**Key aesthetic words:**
- Sun-bleached linen, warm parchment, garden journal
- Soft charcoal ink on cream paper
- Terracotta clay, worn wood, pressed leaves
- The green of new growth — vivid but not neon
- Spring physics — things settle, bounce gently, feel alive

## Design Language: Warm Glass

A synthesis of Material Design 3's warmth with Liquid Glass's structural precision. Three qualities guide every decision:

1. **Warmth** — Higher chroma, spring motion, shape morphing. Friendly and alive, not sterile.
2. **Clarity** — Concentricity, functional layers, content-forward hierarchy. Structure is self-evident.
3. **Purpose** — Every element serves the mission. No engagement hacking. No dark patterns.

## Color Hierarchy

Each color has a **job** based on visual weight, not just palette harmony:

| Role | Job | Color | Hex | Usage |
|------|-----|-------|-----|-------|
| **Neutral** | The canvas. Background, breathing room. | Warm linen white | #FAF8F5 (light) / #1C1917 (dark) | 80-90% |
| **Primary** | The ink. Headings, body, core content. | Warm charcoal | #292524 (light) / #F5F5F4 (dark) | 8-15% |
| **Secondary** | Subdued support. Metadata, labels, borders. | Earth stone | #78716C (light) / #A8A29E (dark) | 3-5% |
| **Tertiary** | The accent. CTAs, active states. Loudest but used least. | Garden green | #1FC16B | 1-3% |

**Supporting accents** (situational, not core hierarchy):
- **Amber** #D97706 — Warnings, seasonal indicators, secondary warmth
- **Sky** #3B82F6 — Information, external links, evaluation context

**Rule:** Tertiary (green) is third in volume but first in visual pull. It's the bright flower — draws the eye *because* everything else is quiet.

**State colors:** Information (blue), Warning (orange/amber), Error (red), Success (green).

## Typography

| Role | Font | Weight | Use |
|------|------|--------|-----|
| **Editorial headlines** | Serif display (Fraunces, Lora, or Newsreader) | 600-700 | Browser site only — garden/impact editorial pages |
| **App headlines** | Inter (client PWA) / Plus Jakarta Sans (admin) | 600-700 | Functional headings |
| **Body** | Inter (client) / Plus Jakarta Sans (admin) | 400-500 | Core reading text |
| **Labels / timestamps** | Inter (client) / Plus Jakarta Sans (admin) | 500 | Utility text, metadata |

**Rationale:** The serif headline only appears on the public browser site where editorial weight matters. PWA and admin stay utilitarian with their respective sans-serif workhorses.

## Shape System

Three shape types create geometric harmony:

| Type | Behavior | Examples |
|------|----------|---------|
| **Fixed** | Constant radius regardless of context | Avatars (4px), badges, chips (8px) |
| **Capsule** | Radius = half container height (fully round) | Primary buttons, FABs, icon buttons |
| **Concentric** | Radius = parent radius - padding | Cards inside panels, content inside cards |

**Concentricity rule:** `child_radius = parent_radius - padding`. No pinched or flared corners.

**Radius scale:**
- 4px — Status dots, tiny badges (fixed)
- 8px — Chips, tags (fixed)
- 12px — Content inside cards, secondary buttons (concentric/fixed)
- 16px — Cards, form inputs (concentric)
- 20px — Panels, sheets (concentric)
- 24px — Modals, bottom sheets (concentric)
- Fully round — Primary buttons, icon buttons (capsule)

**Shape as emphasis:** Capsule = primary (draws eye). Squircle (12px) = secondary (recedes). Shape alone creates hierarchy — no color difference needed.

## Motion

All animation uses named spring tokens. No hardcoded bezier curves or durations.

| Token | Duration | Use |
|-------|----------|-----|
| `--spring-spatial` | 300ms | Layout shifts, navigation, sheets |
| `--spring-spatial-fast` | 200ms | Button press, toggles, shape morphing |
| `--spring-spatial-slow` | 400ms | Hero transitions, page morphs |
| `--spring-effects` | 250ms | Opacity, color, blur changes |
| `--spring-effects-fast` | 150ms | Hover states, focus rings, tooltips |
| `--spring-effects-slow` | 500ms | Loading indicators, progress bars |

**Two motion schemes:**
- **Standard** — Efficient, minimal overshoot. Default for data-dense views.
- **Expressive** — Bouncy, delightful, +50% duration. Hero moments only.

**Rule:** Things settle like a leaf landing on water — gentle arrival, not mechanical snap.

## Material Thickness

Glass material opacity follows cognitive load:

| Level | Opacity | Blur | When |
|-------|---------|------|------|
| **Ultrathin** | 20% | 30px | Decorative, ambient backgrounds only |
| **Thin** | 40% | 20px | Secondary context, glanceable metrics |
| **Regular** | 65% | 12px | Standard surfaces, default for most cards |
| **Thick** | 85% | 8px | Text-dense content — mandatory for forms and tables |
| **Solid** | 100% | 0px | Maximum readability fallback |

**Rule:** Glass blur reduces readability. Match thickness to content density. Never put body text on ultrathin material.

## Elevation

| Level | Z-Layer | Use |
|-------|---------|-----|
| **Substrate** | Z0 | World behind the app |
| **Ground** | Z1 | Page background, canvas, ambient warmth |
| **Surface** | Z2 | Cards, content areas, primary reading |
| **Floating** | Z3 | Toolbars, tooltips, popovers, navigation |
| **Overlay** | Z4 | Modals, command palettes, critical alerts (always thick/solid material) |

**Canvas recession:** When sheets open, main content recedes: scale(0.97) + opacity(0.85) + blur(2px). No dark scrims.

## Progressive Disclosure

Content reveals in four layers:

| Layer | Time | Shows |
|-------|------|-------|
| **Glance** | <1s | Title, status dot, one key metric |
| **Scan** | 1-3s | Summary, action buttons, relationships |
| **Engage** | 3s+ | Full detail, history, configuration |
| **Deep Dive** | Intentional | Raw data, audit trails, settings |

## Hero Moments

Designated celebrations where all style dimensions amplify:

| Moment | Expression Level |
|--------|-----------------|
| Garden creation | Full — growth animation, expressive springs |
| First work submission | High — celebratory confirmation |
| Hypercert minting | Full — certificate reveal animation |
| Vault deposit | High — flow visualization |
| Seasonal transitions | Medium — ambient color shift |
| Assessment completion | Medium — flows into impact chain |
| Role milestone | Medium — badge reveal with organic unfurl |

**Succession-aware:** Pioneer gardens get simple, encouraging expression. Intermediate gets moderate. Climax communities earn the full treatment. Don't over-design for communities that need onboarding simplicity.

## Do's and Don'ts

**Do:**
- Use semantic color tokens, never raw values
- Let the canvas breathe — generous whitespace
- Use shape to create hierarchy (capsule > squircle > concentric)
- Celebrate milestone moments with expressive motion
- Design for sunlight readability (high contrast on warm backgrounds)
- Use spring physics for all transitions
- Make value flows visible end-to-end
- Match complexity to garden maturity
- Use both color AND icon for status indicators (WCAG 1.4.1)
- Gate all animation behind `prefers-reduced-motion`

**Don't:**
- Flood the screen with green — it's the accent, not the canvas
- Use dark scrims behind sheets — depth comes from transform + blur
- Mix serif and sans-serif on the same surface (except browser editorial)
- Add decorative gradients behind routine UI
- Use generic placeholder copy — real content makes the design real
- Animate without intent — every motion should aid comprehension
- Use countdown timers, leaderboards, or streak mechanics
- Add re-engagement notifications or FOMO-driven urgency
- Design competitive comparisons — show verified impact, not rankings
- Use trading-floor aesthetics — this is a garden, not a terminal
