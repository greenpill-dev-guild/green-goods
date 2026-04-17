# Green Goods Design System

> Creative brief for AI design tools. Paste this file (plus a surface-specific DESIGN.md) into Stitch, Figma AI, or Claude Design to produce on-brand output.
>
> **Usage:** `cat DESIGN.md packages/client/DESIGN.md | pbcopy` (client) or `cat DESIGN.md packages/admin/DESIGN.md | pbcopy` (admin).
>
> **Token spec lives in** `.claude/skills/design/language.md`. This file sets atmosphere and role hierarchy; language.md is the exhaustive specification. When the two disagree, language.md wins.

## Relationship to Codebase

This file uses **role vocabulary** (neutral/primary/secondary/tertiary = canvas/ink/stone/accent). The codebase uses its own internal token naming — `--color-primary` is a label that resolves to the **tertiary role (garden green, used 1-3%)**. Neither renames — this file translates between them.

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

## Quick Token Reference

Full specs in [`.claude/skills/design/language.md`](.claude/skills/design/language.md). AI prompts should honor these one-line rules:

- **Shape** — *Fixed* (badges, avatars), *Capsule* (primary CTA, icon buttons), *Concentric* (nested: `child_radius = parent_radius − padding`). Shape alone creates hierarchy — capsule reads as primary next to squircle secondary.
- **Motion** — Named spring tokens only (`--spring-spatial`, `--spring-spatial-fast`, `--spring-effects`, etc.). Never hardcoded `cubic-bezier` or `duration`. Things settle like a leaf on water.
- **Material** — Five thicknesses (ultrathin 20% / thin 40% / regular 65% / thick 85% / solid 100%). Match thickness to content density. Never body text on ultrathin. Admin limits glass to `TopContextBar` only.
- **Elevation** — Five Z-layers (Z0 substrate → Z4 overlay). Canvas recedes on sheet open (`scale(0.97) + opacity(0.85) + blur(2px)`). No dark scrims.
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
- Use dark scrims behind sheets — depth comes from transform + blur
- Mix serif and sans-serif on the same surface (except browser editorial)
- Add decorative gradients behind routine UI
- Use generic placeholder copy — real content makes the design real
- Animate without intent — every motion should aid comprehension
- Use countdown timers, leaderboards, or streak mechanics
- Add re-engagement notifications or FOMO-driven urgency
- Design competitive comparisons — show verified impact, not rankings
- Use trading-floor aesthetics — this is a garden, not a terminal
