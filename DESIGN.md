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
  none: 0px
  md: 8px
  squircle: 12px
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
    rounded: "{rounded.full}"
  count-badge:
    backgroundColor: "{colors.tertiary-action}"
    textColor: "{colors.on-tertiary-action}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
  accent-ink:
    textColor: "{colors.on-tertiary}"
    typography: "{typography.label-md}"
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
    rounded: "{rounded.lg}"
  button-primary-hover:
    backgroundColor: "{colors.tertiary-action-hover}"
    textColor: "{colors.on-tertiary-action}"
    typography: "{typography.label-md}"
    rounded: "{rounded.lg}"
  button-primary-website:
    backgroundColor: "{colors.tertiary-action}"
    textColor: "{colors.on-tertiary-action}"
    typography: "{typography.label-md}"
    padding: "{spacing.md}"
    rounded: "{rounded.none}"
  button-secondary:
    textColor: "{colors.primary}"
    typography: "{typography.label-md}"
    padding: "{spacing.md}"
    rounded: "{rounded.lg}"
  field:
    textColor: "{colors.primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
  chip:
    textColor: "{colors.primary}"
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

Any green fill that carries text, a number, or a glyph uses the darker `tertiary-action` role with white `on-tertiary-action`: filled CTAs, count badges, step markers, selected chips, and pills. White on `tertiary-action` measures 5.72:1; white on bright `tertiary` is 2.36:1, and dark `on-tertiary` on it reads muddy at 4.64:1 (DL-017).

The brighter `tertiary` garden green stays on text-free accents: icons, active nav, dots, progress lines, soft highlights, and low-volume brand accents.

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
| **Admin / steward** | Efficient, status-oriented | "3 submissions pending review. 1 flagged for follow-up." |
| **Funding / impact** | Respectful, concrete | "This garden has documented 47 actions across 3 seasons." |

### Terminology

The names that carry the work. Domain entities, personas, relationships, and lifecycle semantics live in [`green-goods-ontology.json`](packages/shared/src/ontology/green-goods-ontology.json); banned language lives in [`scripts/data/banned-vocabulary.json`](scripts/data/banned-vocabulary.json). The generated [public glossary](docs/docs/reference/glossary.generated.mdx) explains both without becoming another authority. This table is the positive copy-voice set.

| Use | Don't Use | Why |
|-----|-----------|-----|
| Garden | Project, organization, DAO | Gardens are the metaphor. |
| Gardener | User, contributor, member | People who do the work have a name. |
| Steward | Admin, manager | They operate the garden. |
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
- [ ] Is the audience right? (Gardener ≠ steward ≠ funder)
- [ ] Is blockchain invisible? (On-chain = implementation, not copy)
- [ ] Would it make sense to someone who's never heard of web3?
- [ ] Is it shorter than your first draft?

Surface-specific copy patterns (browser editorial, PWA gardener-facing, admin utility) live in the matching prompt contracts: [`.claude/skills/design/prompt-contract.md`](.claude/skills/design/prompt-contract.md) (admin) and [`.claude/skills/design/client-prompt-contract.md`](.claude/skills/design/client-prompt-contract.md) (client).

## Quick Token Reference

Full specs in [`.claude/skills/design/language.md`](.claude/skills/design/language.md). AI prompts should honor these one-line rules:

- **Shape** — *Fixed* (badges, avatars), *Capsule* (icon buttons, chips), *Concentric* (nested: `child_radius = parent_radius − padding`). Buttons take one corner per surface whatever their emphasis: the 12px squircle (`rounded.squircle`) in the installed app, 16px (`rounded.lg`) on the public website; fill, outline, and colour carry emphasis. Fields are 16px (`rounded.lg`). Buttons and fields share one height scale: 48 / 44 / 40 / 32px.
- **Motion** — Named spring tokens only (`--spring-spatial`, `--spring-spatial-fast`, `--spring-effects`, etc.). Never hardcoded `cubic-bezier` or `duration`. Things settle like a leaf on water.
- **Material** — Five thicknesses (ultrathin 20% / thin 40% / regular 65% / thick 85% / solid 100%). Match thickness to content density. Never body text on ultrathin. Admin limits glass to Navigation/FAB chrome only; the admin `AppBar` root stays transparent and dialogs/side sheets stay solid.
- **Elevation** — Five Z-layers (Z0 substrate → Z4 overlay). Admin workspace action/detail flows open in centered `AdminDialog`; the canvas stays at rest and depth comes from the dialog scrim/elevation. Global AppBar surfaces use solid `AdminSideSheet`. Viewport dialogs and PWA sheets may use the shared scrim token.
- **Progressive disclosure** — Four layers: Glance (<1s) → Scan (1-3s) → Engage (3s+) → Deep Dive (intentional).
- **Hero moments** — Garden creation, first submission, hypercert mint. Amplify shape + color + motion + typography + material together. Succession-aware: pioneer=simple, intermediate=moderate, climax=full.

## Interface Principles

Everything above says how Green Goods should look. This section says how people actually read and use what we build, and it comes first when designing or reviewing any screen. The rules in `.claude/rules/frontend-design.md` and the admin invariants apply these principles; they do not replace them.

It exists because of a failure that no visual rule caught. On 2026-09-22 a steward with Aiyeloja Family Garden selected set up the protocol pool instead. A tab under that garden's header held a console for a different pool, nothing in the dialog named the pool being written, and six wallet prompts arrived with no word of progress between them, so the run read as a loop. Every token and component was on-system; the screen still misled the person using it.

The principles come from three books, restated in our own words and applied to Green Goods. Page numbers refer to the PDF editions the team holds.

- **DMMT**: Steve Krug, *Don't Make Me Think, Revisited*. How people read screens and decide what to do.
- **RUI**: Adam Wathan and Steve Schoger, *Refactoring UI*. How a screen shows what matters.
- **AD**: Brad Frost, *Atomic Design*. How a design system is built, reused, and kept whole.

### How people use what we build

1. **Make every screen self-evident.** A steward should know at a glance what a screen is, whose it is, and what its main action will do. Each moment of "wait, which one?" costs a little trust, and the costs add up. A screen that cannot be self-evident must at least explain itself in place. *(DMMT ch. 1, pp. 29–38)* In Green Goods, the first read of any pool screen answers: which garden, which pool, and what happens if I press this.
2. **Design for scanning and the first plausible click.** People skim for the words that match their task and take the first reasonable option rather than weighing them all. The obvious click has to be the right one, and a wrong one has to be cheap to undo. When it cannot be undone, it must be impossible to make by accident. *(DMMT ch. 2, pp. 39–47; ch. 4, pp. 70–76)* An on-chain write is never cheap to undo, so its target and consequence sit where the eye already is, not in a header two regions away.
3. **Build for muddling through.** People keep using a tool with a rough, sometimes wrong idea of how it works. The interface has to catch a wrong assumption before it becomes an irreversible act, rather than rely on anyone remembering how a tab or selector behaves. *(DMMT ch. 2, pp. 44–47)*
4. **Show where the steward is and what they are acting on.** From any screen it must be obvious which section this is and which garden is in scope; the trunk test (drop someone on the page and ask them to name it) should pass without hesitation. A control never acts outside the scope the page announces. When the scope genuinely differs, as with the protocol pool, the screen looks different; a different default tab is not enough. *(DMMT ch. 6, pp. 96–113; ch. 3, p. 56)* The garden in the header is the only garden a screen can change, and protocol work lives in the Green Goods Community Garden, whose pool the protocol pool is.
5. **Keep conventions, and break them only for clarity.** Reuse patterns people already know, ours and the wider web's, so they learn once. When sameness would hide a difference that matters, clarity wins over consistency. *(DMMT ch. 3, pp. 48–56)*
6. **Cut what is not earning its place.** Remove happy talk and instructions nobody reads. Say the one thing the steward needs, where they need it. *(DMMT ch. 5, pp. 77–80)*
7. **Spend goodwill carefully.** Patience is a reserve. Silence at a moment of uncertainty (a wallet prompt with no word about why, a wait with no progress) drains it fastest; candour, saved steps, and recoverable mistakes refill it. *(DMMT ch. 11, pp. 204–211)*
8. **Watch one real person use it.** Opinions do not settle design questions; watching someone try the flow does. Before a consequential flow ships, one person outside the build walks it cold while thinking aloud, and the worst problems are fixed first. *(DMMT ch. 8–9, pp. 135–170)*

### How a screen shows what matters

9. **Rank everything.** Decide what is primary, secondary, and tertiary on each screen, and let weight, colour, and position carry that ranking. When something does not stand out, quiet its neighbours rather than making it louder. *(RUI "Not all elements are equal" and "Emphasize by de-emphasizing", pp. 36–47)* On a screen that ends in a signature, the target of the write is the most prominent fact after the title.
10. **One primary action per moment.** Actions form a pyramid: one clear primary, a few secondary, the rest tertiary. A destructive act stays modest where it sits and becomes the loud, primary action only inside its own confirmation. *(RUI "Semantics are secondary", pp. 60–62)*
11. **Let values speak for themselves.** Format and context often already say what a value is. Add a label only when they do not, and keep it quieter than the value. *(RUI "Labels are a last resort", pp. 48–52)*
12. **Design the in-between states on purpose.** Empty, loading, waiting on a wallet, three of six done, stopped part-way, finished: each is a screen someone will see, and each is designed rather than left to a spinner. *(RUI "Don't overlook empty states", pp. 234–237; AD ch. 4, p. 99)* A multi-signature act says how many prompts are coming, shows each one landing, names where it stopped, and ends on a clear done state.
13. **Choose from the systems, not from scratch.** Spacing, type sizes, colour shades, elevation, and radii come from the defined scales; a value outside them is drift, not a decision. Colour is never the only signal. *(RUI "Limit your choices", pp. 28–32; spacing pp. 66–75; type pp. 102–107; colour pp. 142–168; depth pp. 180–185)*

### How the system stays whole

14. **Name each piece by what it is responsible for.** Atoms (a button, a step marker), molecules (a labelled field, the line naming a write's target), organisms (a pool console, a setup flow), templates, and pages. The larger and more stateful the piece, the more care each new placement needs. *(AD ch. 2, pp. 39–61)*
15. **Reuse is a decision, and an organism is handed its context.** Promote a pattern to shared when a second real need matches the first one's context, not because the pattern already exists. An organism that writes is told its target and never infers it from wherever it happens to be mounted, and we keep track of everywhere it is used. *(AD ch. 5, p. 155; ch. 1, pp. 35–36; ch. 3, pp. 88–91)* The pool console has one home, the Garden workspace's Pool tab, and its protocol context comes from the pool itself.
16. **Prove patterns with real and worst-case content.** A pattern is finished when real pages hold up: long names, zero items, errors, pending states, elevated permissions. Storybook carries those states for every pattern, not only the tidy one. *(AD ch. 2, pp. 48–54; ch. 3, pp. 77–81)*
17. **Fix at the pattern, everywhere it lives.** When a flaw shows up in one placement, check every other placement and fix the shared piece once. The pattern library and the product are built from the same components, so they cannot drift apart. *(AD ch. 5, pp. 140–163)*

### Applied to consequential writes

These are how the principles above apply to on-chain acts, not a separate rulebook. The numbers point back to the principles.

- **Scope.** A screen changes only the garden selected in the header (4, 15). The protocol pool is managed from the Green Goods Community Garden, like any garden's pool, and cannot be reached from another garden's workspace.
- **Target.** Every write dialog names the pool it writes to before anything else, and the protocol pool is set apart as a warning (4, 9). This is the disambiguation case of the rule against restating the chrome's context.
- **Count and reason.** Before the first prompt, the flow says how many times the wallet will ask and why each write is needed (1, 7).
- **Progress.** While it runs, each write shows whether it is waiting for the wallet, confirming, or done, with a link to its transaction (7, 12).
- **Stop and finish.** A stopped run names where and why, and trying again says how many prompts remain. A finished run stays on screen as a done state until the steward closes it (7, 12).
- **Fewer prompts when the wallet allows.** When the wallet can run several calls as one transaction, related writes share one approval; otherwise they go one at a time, and the checklist shows which (6, 7).

### How we follow them

- **Before building,** start from the feature, not the layout (RUI pp. 8–11). Find the existing pattern for the job and reuse it, or say why not (15).
- **For every UI change,** run the five-minute review:
  1. Look at a screenshot for five seconds. Can you say which garden or pool this is, which step you are on, what the primary action does, and to what? If any answer needs reading or another selector, fix it (1, 4).
  2. Is the most important thing the most prominent, with one primary action? (9, 10)
  3. Does any control act outside the scope the page announces, or any tab change scope without saying so? (4)
  4. Are the in-between states designed and in Storybook: empty, loading, waiting, part-way, failed, done? (12, 16)
  5. Is every value on the defined scales, and does no status rely on colour alone? (13)
  6. If a shared organism changed: where else is it mounted, and does each mount hand it its context? (15, 17)
- **Before a consequential flow ships,** someone outside the build walks it cold, thinking aloud (8).
- **Where it is enforced:** this section is the source. The design review checklist carries it as its clarity lens (`.claude/skills/design/review-checklist.md`), and every frontend rule points here (`.claude/rules/frontend-design.md`, Rule 20).

## Do's and Don'ts

**Do:**
- Use role vocabulary (canvas/ink/stone/green) when describing designs to AI tools
- Use semantic color tokens in code, never raw values
- Let the canvas breathe — generous whitespace
- Give every button on a surface the same corner; show importance with fill, outline, and colour
- Celebrate milestone moments with expressive motion
- Design for sunlight readability (high contrast on warm backgrounds)
- Use spring physics for all transitions
- Make value flows visible end-to-end
- Match complexity to garden maturity (succession stages)
- Use both color AND icon for status indicators (WCAG 1.4.1)
- Gate all animation behind `prefers-reduced-motion`
- Name the target of every write, and show every step of a multi-signature act (Interface Principles 4, 12)

**Don't:**
- Let a control act outside the garden the page announces, or a tab change scope silently (Interface Principle 4)
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
