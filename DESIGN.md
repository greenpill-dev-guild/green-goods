---
version: alpha
name: Green Goods Warm Earth Core
description: Core semantic tokens and reasoning for Warm Earth across admin cockpit, installed PWA, public browser, and docs surfaces.
colors:
  primary: "#292524"
  primary-inverse: "#F5F5F4"
  secondary: "#78716C"
  secondary-inverse: "#A8A29E"
  tertiary: "#1FC16B"
  on-tertiary: "#0B4627"
  tertiary-action: "#1A7544"
  tertiary-action-hover: "#16643B"
  on-tertiary-action: "#FFFFFF"
  amber: "#D97706"
  sky: "#3B82F6"
  neutral: "#FAF8F5"
  neutral-dark: "#1C1917"
typography:
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 500
    lineHeight: 16px
  app-title:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: 600
    lineHeight: 28px
  editorial:
    fontFamily: Fraunces
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.1
rounded:
  md: 8px
  lg: 16px
  xl: 20px
  2xl: 24px
  full: 9999px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
components:
  surface-canvas:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary}"
    typography: "{typography.body-md}"
    padding: "{spacing.lg}"
    rounded: "{rounded.lg}"
  surface-canvas-dark:
    backgroundColor: "{colors.neutral-dark}"
    textColor: "{colors.primary-inverse}"
    typography: "{typography.body-md}"
  metadata-label:
    textColor: "{colors.secondary}"
    typography: "{typography.label-md}"
    padding: "{spacing.sm}"
  metadata-label-dark:
    textColor: "{colors.secondary-inverse}"
    typography: "{typography.label-md}"
  accent-indicator:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    rounded: "{rounded.full}"
  warning-badge:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.neutral-dark}"
    typography: "{typography.label-md}"
    padding: "{spacing.sm}"
    rounded: "{rounded.full}"
  info-badge:
    backgroundColor: "{colors.sky}"
    textColor: "{colors.neutral-dark}"
    typography: "{typography.label-md}"
    padding: "{spacing.sm}"
    rounded: "{rounded.full}"
  button-primary:
    backgroundColor: "{colors.tertiary-action}"
    textColor: "{colors.on-tertiary-action}"
    typography: "{typography.label-md}"
    padding: "{spacing.md}"
    rounded: "{rounded.full}"
  button-primary-hover:
    backgroundColor: "{colors.tertiary-action-hover}"
    textColor: "{colors.on-tertiary-action}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
  app-title:
    textColor: "{colors.primary}"
    typography: "{typography.app-title}"
    rounded: "{rounded.md}"
---

# Green Goods Design System

> Creative brief for AI design tools and coding agents. Pair this file with `.claude/skills/design/ai-ui-brief.md` plus a surface-specific DESIGN.md to produce on-brand output.
>
> **Usage:** pair this root file with a dialect file: `packages/admin/DESIGN.md`, `packages/client/DESIGN.pwa.md`, `packages/client/DESIGN.browser.md`, or `docs/DESIGN.md`.
>
> **Token contract lives in** the YAML front matter above. The root `DESIGN.md` front matter is the canonical DesignMD source; dialect files such as `packages/admin/DESIGN.md`, `packages/client/DESIGN.pwa.md`, `packages/client/DESIGN.browser.md`, and `docs/DESIGN.md` extend it. Generated artifacts and runtime documentation should be regenerated from this source. `packages/shared/src/styles/theme.css` is the runtime projection that consumes generated DesignMD tokens; it is not the source of truth.

## Relationship to Codebase

This file uses **role vocabulary** (neutral/primary/secondary/tertiary = canvas/ink/stone/accent). The codebase uses its own internal token naming — `--color-primary`, `bg-primary`, and `bg-primary-base` are historical implementation labels that resolve to the **green accent/action family**, not the DesignMD `primary` role. Neither renames — this file translates between them.

Text-bearing filled CTAs use the darker `tertiary-action` role so white text passes contrast. The brighter `tertiary` garden green stays available for icons, active nav, badges, progress, soft highlights, and low-volume brand accents.

Tiny text on bright `tertiary` surfaces uses `on-tertiary` so count badges and selected chips can stay visually bright without failing contrast.

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

## Design Language: Warm Earth

A synthesis of Material Design 3 Expressive warmth with Apple Liquid Glass structural precision. Three qualities guide every decision:

1. **Warmth** — Higher chroma, spring motion, shape morphing. Friendly and alive, not sterile.
2. **Clarity** — Concentricity, functional layers, content-forward hierarchy. Structure is self-evident, never decorated into existence.
3. **Purpose** — Every element serves the mission. No engagement hacking. No dark patterns.

## Color Hierarchy

Four roles, defined by **how much of the screen each occupies** — not a palette ranking:

| Role | Volume | Color | Hex (light / dark) | Job |
|------|--------|-------|--------------------|-----|
| **Neutral (canvas)** | 80-90% | Warm linen | #FAF8F5 / #1C1917 | Background, breathing room |
| **Primary (ink)** | 8-15% | Warm charcoal | #292524 / #F5F5F4 | Headings, body, core content |
| **Secondary (stone)** | 3-5% | Earth stone | #78716C / #A8A29E | Metadata, borders, labels |
| **Tertiary (accent)** | 1-3% | Garden green | #1FC16B | CTAs, active states, value-flow |

**Rule:** Tertiary (green) is third in volume but first in visual pull. The bright flower — draws the eye *because* everything else is quiet. Flooding the screen with green is the #1 failure mode.

**Supporting accents** (situational, not core hierarchy):
- **Amber** #D97706 — Warnings, seasonal indicators, secondary warmth
- **Sky** #3B82F6 — Information, external links, evaluation/assessment context

**State colors:** Information (Sky), Warning (Amber), Error (red), Success (Tertiary green).

## Typography

| Role | Font | Weight | Use |
|------|------|--------|-----|
| **Editorial headlines** | Serif display (Fraunces, Lora, or Newsreader) | 600-700 | Browser site only — garden/impact editorial pages |
| **App headlines** | Inter (client PWA) / Plus Jakarta Sans (admin) | 600-700 | Functional headings |
| **Body** | Inter (client) / Plus Jakarta Sans (admin) | 400-500 | Core reading text |
| **Labels / timestamps** | Inter (client) / Plus Jakarta Sans (admin) | 500 | Utility text, metadata |

**Rationale:** The serif headline only appears on the public browser site where editorial weight matters. PWA and admin stay utilitarian with their respective sans-serif workhorses.

## Voice & Copy

> Companion to the visual creative direction. Same brief — verbal expression instead of visual.

**Voice:** Green Goods speaks like a knowledgeable neighbor who runs the community garden. Warm but not gushing. Practical but not clinical. Knows soil science but explains it by pointing at the compost pile.

### Voice Pillars

| Pillar | Means | Doesn't Mean |
|--------|-------|------------|
| **Grounded** | Concrete, specific, rooted in real action | Jargon-heavy, academic, blockchain-first |
| **Inviting** | Welcoming, assumes good intent, lowers barriers | Sycophantic, over-enthusiastic, exclamation-heavy |
| **Honest** | Transparent about what works and what's experimental | Hedging, corporate disclaimers, vague promises |
| **Active** | Action-oriented, present-tense, you-centered | Passive voice, abstract nouns, bureaucratic |

**One-sentence test:** If it could appear on a government form, rewrite it. If it could appear on a hand-painted garden sign, it's close.

### Tone Spectrum

Tone shifts by context while voice stays constant:

| Context | Tone | Example |
|---------|------|---------|
| **Onboarding** | Encouraging, patient | "Start by describing what you see. We'll help with the rest." |
| **Submitting work** | Supportive, clear | "Add a photo and a few words about what you did today." |
| **Hero moments** | Celebratory, genuine | "Your first contribution. This garden is growing because of you." |
| **Errors** | Calm, constructive | "That didn't go through. Your work is saved — try again when you're ready." |
| **Offline** | Reassuring, matter-of-fact | "You're offline. Everything is saved locally and will sync when you reconnect." |
| **Admin / operator** | Efficient, status-oriented | "3 submissions pending review. 1 flagged for follow-up." |
| **Funding / impact** | Respectful, concrete | "This garden has documented 47 actions across 3 seasons." |

### Terminology

The names that carry the work. The canonical vocabulary contract — domain entities, personas, surfaces, and banned terms (streak, countdown, leaderboard, FOMO, growth-hacking language, plus admin-only and client-only AI-prompt bans) — lives in [`docs/docs/reference/glossary-community.md`](docs/docs/reference/glossary-community.md). This table is the positive copy-voice set; the glossary is the cross-surface single source of truth.

| Use | Don't Use | Why |
|-----|-----------|-----|
| Garden | Project, organization, DAO | Gardens are the metaphor. |
| Gardener | User, contributor, member | People who do the work have a name. |
| Operator | Admin, manager | They operate the garden. |
| Evaluator | Reviewer, auditor, assessor | They evaluate impact, not audit compliance. |
| Funder | Donor, investor, backer | Funding a garden, not donating to a cause. |
| Community member | Visitor, viewer, spectator | Part of the community, not an audience. |
| Work | Task, activity, submission | Regenerative work is the core concept. |
| Action | Action type, template | The thing a gardener can do. |
| Fund | Donate, contribute, invest | Funding a garden. |
| Impact | Output, result, metric | Bridges community and chain. |
| Document | Log, record, capture | Gardeners document their work. |

### Writing Checklist

Before shipping copy:

- [ ] Is it concrete? (Can the reader picture it?)
- [ ] Is it active? (Subject → verb → object?)
- [ ] Is the audience right? (Gardener ≠ operator ≠ funder)
- [ ] Is blockchain invisible? (On-chain = implementation, not copy)
- [ ] Would it make sense to someone who's never heard of web3?
- [ ] Is it shorter than your first draft?

Surface-specific copy patterns (browser editorial, PWA gardener-facing, admin utility) live in the matching prompt contracts: [`.claude/skills/design/prompt-contract.md`](.claude/skills/design/prompt-contract.md) (admin) and [`.claude/skills/design/client-prompt-contract.md`](.claude/skills/design/client-prompt-contract.md) (client).

## Quick Token Reference

Full specs in [`.claude/skills/design/language.md`](.claude/skills/design/language.md). AI prompts should honor these one-line rules:

- **Shape** — *Fixed* (badges, avatars), *Capsule* (primary CTA, icon buttons), *Concentric* (nested: `child_radius = parent_radius − padding`). Shape alone creates hierarchy — capsule reads as primary next to squircle secondary.
- **Motion** — Named spring tokens only (`--spring-spatial`, `--spring-spatial-fast`, `--spring-effects`, etc.). Never hardcoded `cubic-bezier` or `duration`. Things settle like a leaf on water.
- **Material** — Five thicknesses (ultrathin 20% / thin 40% / regular 65% / thick 85% / solid 100%). Match thickness to content density. Never body text on ultrathin. Admin limits glass to Navigation/FAB and sheet shells; the admin `AppBar` root stays transparent.
- **Elevation** — Five Z-layers (Z0 substrate → Z4 overlay). Admin canvas recedes on bounded sheet open (`translateY(var(--canvas-recede-y, 8px)) + opacity(var(--canvas-opacity-receded, 0.95)) + blur(var(--canvas-blur-receded, 1.5px))`). Avoid dark scrims for parallel admin sheets; viewport dialogs and PWA sheets may use the shared scrim token.
- **Progressive disclosure** — Four layers: Glance (<1s) → Scan (1-3s) → Engage (3s+) → Deep Dive (intentional).
- **Hero moments** — Garden creation, first submission, hypercert mint. Amplify shape + color + motion + typography + material together. Succession-aware: pioneer=simple, intermediate=moderate, climax=full.

## Do's and Don'ts

**Do:**
- Use role vocabulary (canvas/ink/stone/green) when describing designs to AI tools
- Use semantic color tokens in code, never raw values
- Let the canvas breathe — generous whitespace
- Use shape to create hierarchy (capsule > squircle > concentric)
- Celebrate milestone moments with expressive motion
- Design for sunlight readability (high contrast on warm backgrounds)
- Use spring physics for all transitions
- Make value flows visible end-to-end
- Match complexity to garden maturity (succession stages)
- Use both color AND icon for status indicators (WCAG 1.4.1)
- Gate all animation behind `prefers-reduced-motion`

**Don't:**
- Flood the screen with green — it's the accent (1-3%), not the canvas
- Use dark scrims behind parallel admin sheets — depth comes from canvas recession and sheet material
- Mix serif and sans-serif on the same surface (except browser editorial)
- Add decorative gradients behind routine UI
- Use generic placeholder copy — real content makes the design real
- Animate without intent — every motion should aid comprehension
- Use countdown timers, leaderboards, or streak mechanics
- Add re-engagement notifications or FOMO-driven urgency
- Design competitive comparisons — show verified impact, not rankings
- Use trading-floor aesthetics — this is a garden, not a terminal
