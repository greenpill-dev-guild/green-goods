# Design System Creative Briefs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create 4 AI-readable creative brief files (DESIGN.md + COPY_PROMPT.md) that translate the internal Warm Glass design language into a format any external design tool can consume.

**Architecture:** Foundation + surface layered approach. Root DESIGN.md holds shared creative direction (empathy, color hierarchy, typography, shape, motion, material, regenerative constraints). Per-package DESIGN.md files hold surface-specific direction. COPY_PROMPT.md holds voice/tone for all surfaces. Files are concatenated when fed to external tools (`cat DESIGN.md packages/client/DESIGN.md | pbcopy`).

**Tech Stack:** Markdown files only. No code changes. No token modifications.

**Spec:** `docs/superpowers/specs/2026-04-15-design-system-creative-briefs-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `DESIGN.md` | Create | Shared foundation — empathy, Warm Glass identity, color hierarchy (Stitch-compatible roles), typography DNA, shape system, motion tokens, material thickness, elevation, progressive disclosure, hero moments, regenerative dos/don'ts |
| `packages/client/DESIGN.md` | Create | Client surface — browser editorial (lookbook + marketplace) and PWA field tool. Navigation patterns, imagery direction, typography split (serif browser / Inter PWA), offline behavior |
| `packages/admin/DESIGN.md` | Create | Admin surface — M3 strict cockpit. Canvas grid layout, Plus Jakarta Sans, workspace tinting, Admin* adapter pattern, cockpit litmus test |
| `COPY_PROMPT.md` | Create | Voice/tone guide — brand voice pillars, tone spectrum, per-surface copy patterns, terminology table, writing checklist, AI tool usage instructions |

---

### Task 1: Create Root DESIGN.md

**Files:**
- Create: `DESIGN.md`

**Reference:** Spec § Deliverable 1 (Root DESIGN.md)

- [ ] **Step 1: Create the root DESIGN.md**

Write the shared foundation creative brief. Content must include all sections from the spec:

```markdown
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
```

- [ ] **Step 2: Verify file renders correctly**

Run: `head -5 DESIGN.md && wc -l DESIGN.md`
Expected: Title line visible, line count ~150-180 lines.

- [ ] **Step 3: Commit**

```bash
git add DESIGN.md
git commit -m "docs: add root DESIGN.md creative brief for AI design tools"
```

---

### Task 2: Create Client DESIGN.md

**Files:**
- Create: `packages/client/DESIGN.md`

**Reference:** Spec § Deliverable 2 (Client DESIGN.md)

- [ ] **Step 1: Create the client DESIGN.md**

Write the client surface creative brief. Content must include all sections from the spec:

```markdown
# Green Goods Client — Design Brief

> Surface-specific creative direction for the client package. **Must be combined with the root DESIGN.md** when feeding to AI tools: `cat ../../DESIGN.md DESIGN.md | pbcopy`

## Surface Identity

The client serves **two experiences** from one codebase:

| Mode | Detection | Audiences | Metaphor | Paradigm | Navigation |
|------|-----------|-----------|----------|----------|------------|
| **Browser** | Standard browser visit | Funders, Community members | Walking through the garden | Per-route: Ambient Display (editorial) / Data Landscape (browse/fund) | SiteHeader: hamburger (mobile) + horizontal links (desktop) |
| **PWA** | `display-mode: standalone` | Gardeners | Working in the garden | Command Surface | AppBar: bottom nav (Home, Garden, Profile) |

**Hard rule:** Browser = website (SiteHeader at top). PWA = app (AppBar at bottom). Never mix.

**Routing:** PlatformRouter checks `isInstalled`. PWA → `/home`. Browser → `/gardens`.

---

## Browser Mode — The Garden Gallery

**Physical metaphor:** A coffee-table book about community gardens crossed with a farmers market directory.

**Layout split:**
- **Garden & impact pages** → Editorial lookbook. Full-width imagery, large typographic headings over images. Serif display headlines. The visitor feels *in* the place where the garden grows.
- **Funding & browsing pages** → Marketplace directory. Structured cards, auto-fill grid, filter toolbar. Each garden is a market stall — colorful, distinct, alive.

**Typography:**
- Headlines use the **serif display font** (Fraunces/Lora/Newsreader) — the one surface with editorial weight
- Body stays Inter — the serif is the chapter heading, not the paragraph
- Large typographic headings over imagery, luxury-travel-magazine scale

**Navigation (SiteHeader):**
- Desktop (≥768px): horizontal links — Gardens, Actions, Impact, Fund — plus Connect Wallet button
- Mobile (<768px): hamburger icon → left-slide drawer (w-72) with stacked nav links
- Sticky, with backdrop blur

**Imagery direction:**
- Real community gardens, real people, real soil — not stock photography
- Cinematic photography of the places where gardens grow — the neighborhood, the context
- Show the *scale* and *place*, not cliché "hands holding seedlings"
- Garden cards should feel like market stalls — each one distinct and alive

**Content hierarchy:**
1. Hero statement — what Green Goods is, one emotional sentence
2. Featured gardens — editorial spread, 2-3 spotlights
3. All gardens — marketplace browse (auto-fill grid)
4. Impact metrics — community-wide numbers, understated but present
5. Fund — clear CTAs, garden-specific funding flows

**Progressive disclosure applied:**
- Glance: garden card shows name, location, season status
- Scan: garden card shows member count, recent action count, funding status
- Engage: garden detail page with full story, work timeline, impact data
- Deep Dive: on-chain verification, attestation details, audit trail

---

## PWA Mode — The Field Tool

**Physical metaphor:** A gardener's well-worn journal. Practical, personal, tactile.

**Layout philosophy:**
- Mobile-first, thumb-zone optimized
- AppBar: 3 tabs — Home (with notification badge), Garden, Profile
- AppBar hides on `/garden` and `/work/:id` routes (immersive content)
- SyncStatusBar positioned above AppBar
- Content height: `calc(100lvh - 69px)` minus AppBar
- Safe areas: `env(safe-area-inset-bottom)` for notched devices

**Typography:**
- Inter only — no serif. This is a tool, not a magazine.
- Client typography utilities: `.title-screen`, `.title-section`, `.body-md-regular`, `.label-md`
- Compact type scale — body-sm and label-md are the workhorses

**Content hierarchy:**
1. Active garden context — always visible, always grounding
2. Work in progress — drafts, submissions, the thing you're doing now
3. Garden activity — what others are contributing
4. Your impact — personal contribution history

**Offline behavior:**
- Warm, reassuring offline indicators — not error-red
- SyncStatusBar shows sync state above AppBar
- Draft persistence is invisible — you never lose work

**Window Controls Overlay:** CSS is ready for desktop PWA titlebar integration (`.app-titlebar` with `app-region: drag`). Currently prepared but not active in components.

---

## Color Adaptation

Both modes inherit the foundation color hierarchy. No client-specific token overrides — all from shared.

Browser mode may use slightly more generous tertiary (green) in CTAs since editorial layouts have more breathing room. PWA stays tighter — green only on primary actions.

**Dynamic garden theming** (future): Each garden can tint the experience with accent color derived from its banner image. Foundation palette remains — only the accent shifts.

---

## Do's and Don'ts

**Do:**
- Test every browser layout at 1440px, 1024px, 768px, 375px
- Use container queries for components that live in both modes
- Give garden cards enough visual variety that the marketplace feels alive
- Use `content-visibility: auto` for long garden/work lists

**Don't:**
- Show AppBar (bottom nav) in browser mode
- Show SiteHeader (hamburger) in PWA mode
- Use editorial serif in the PWA — it's an app, not a magazine
- Make the funding flow feel transactional — it should feel like watering a garden
```

- [ ] **Step 2: Verify file renders correctly**

Run: `head -5 packages/client/DESIGN.md && wc -l packages/client/DESIGN.md`
Expected: Title line visible, line count ~100-120 lines.

- [ ] **Step 3: Commit**

```bash
git add packages/client/DESIGN.md
git commit -m "docs(client): add client DESIGN.md creative brief for AI design tools"
```

---

### Task 3: Create Admin DESIGN.md

**Files:**
- Create: `packages/admin/DESIGN.md`

**Reference:** Spec § Deliverable 3 (Admin DESIGN.md)

- [ ] **Step 1: Create the admin DESIGN.md**

Write the admin surface creative brief. Content must include all sections from the spec:

```markdown
# Green Goods Admin — Design Brief

> Surface-specific creative direction for the admin dashboard. **Must be combined with the root DESIGN.md** when feeding to AI tools: `cat ../../DESIGN.md DESIGN.md | pbcopy`

## Surface Identity

| Mode | Audiences | Metaphor | Paradigm | Navigation |
|------|-----------|----------|----------|------------|
| **Desktop cockpit** | Operators, Evaluators | Tending the garden — clipboard in hand | Command Surface | AppBar (top) + NavigationBar (bottom) + AdminFab |

**Cockpit litmus test:** If inappropriate for Linear, GitHub, or Stripe's dashboard, it's inappropriate here.

---

## Creative Direction

**Physical metaphor:** The operations room of a community garden collective. A well-organized potting shed — every tool in its place. Functional, purposeful, warm but not decorative.

**Key difference from client:** Same warm linen canvas, same warm charcoal ink. But no serif headlines, no lookbook layouts, no editorial personality. This is where the *work* happens.

---

## M3 Strict Anatomy

The admin uses Material Design 3 v0.192 as its **strict structural backbone** — not M3-inspired, not hybrid:

- All components follow M3 dimensions exactly
- State layers: hover (8%), focus (12%), pressed (12%), dragged (16%)
- Shape scale: none (0px), xs (4px), sm (8px), md (12px), lg (16px), xl (28px), full (9999px)
- M3 elevation scale (0-5) with specific shadow values
- **Spring motion (`--spring-*`) is the sole permitted deviation** from M3 standard easing
- **Liquid Glass on TopContextBar (AppBar) only** — no blur/translucency on M3 components

**Why strict:** M3+Liquid Glass hybrid produced inconsistent UI. Strict M3 provides discipline; glass limited to where spatial depth cues actually help.

---

## Canvas Grid Layout

CSS Grid with named areas:

```
┌──────────────────────────────────────────┐
│  canvas-area-top                         │  ← AppBar (Z3): garden context,
│  (AppBar)                                │    search, settings, avatar
├──────┬───────────────────────┬───────────┤
│      │                       │           │
│ Left │     MainSheet         │  Right    │  ← MainSheet (Z2): workspace content
│Sheet │     (content zone)    │  Sheet    │    Recedes when sheets open
│      │                       │           │    (scale 0.97 + blur 2px)
├──────┴───────────────────────┴───────────┤
│  canvas-area-bottom                      │  ← NavigationBar (Z3): workspace
│  (NavigationBar + AdminFab)              │    switching + primary FAB action
└──────────────────────────────────────────┘
```

- **LeftSheet:** Action-oriented (creation flows, wizards)
- **RightSheet:** Config, alerts, profile, settings — pane-scoped content routing via sheet orchestrator
- **MainSheet recession:** `isReceded` prop triggers scale + blur when sheets open

---

## Typography

- **Plus Jakarta Sans** across everything — headlines (600-700), body (400-500), labels (500)
- M3 type scale: display, headline, title, body, label with defined sizes
- Utility copy, status language, task framing — not marketing copy
- Labels and timestamps are the most important typographic element (operators scan metadata)

---

## Workspace Tinting

Existing tokens (`--ws-primary`, `--ws-on-primary`) support per-workspace color atmosphere:

| Workspace | Tint | Purpose |
|-----------|------|---------|
| Hub / Work | Soft green wash | Managing growth |
| Garden | Garden's own accent (future) | Garden identity |
| Community | Neutral / warm stone | Assessment objectivity |
| Actions | Neutral | Configuration, structure |
| Settings | Cool gray | System, infrastructure |

The tint is environmental — barely perceptible warmth in the canvas, not a colored header bar.

---

## Admin Component Pattern

All admin-specific components use **Admin* adapter wrappers** following M3 v0.192 exactly. Zero changes to the shared package.

Components: AdminButton, AdminCard, AdminCheckbox, AdminDialog, AdminFab, AdminLinearProgress, AdminListItem, AdminBadge, AdminTooltip, AdminFilterChip, AdminSearchToolbar, AdminTabRail, AdminTextField.

---

## Navigation

- **AppBar** (top, Z3): GardenChip selector, search, settings, notifications, avatar
- **NavigationBar** (bottom, Z3): Workspace tabs — Hub, Garden, Community, Actions. Symbol-first. Role-adaptive visibility via permissions.
- **AdminFab**: Per-workspace primary action, capsule shape. Integrated into NavigationBar via FabProvider.
- **Desktop profile**: On desktop, Profile redirects to Hub and opens RightSheet with profile content.

---

## Do's and Don'ts

**Do:**
- Start from layout and flow before reaching for Card
- Use status language: "3 pending reviews" not "You have work to do!"
- Keep one dominant workspace surface per route
- Use the Hub route as reference composition for new cockpit surfaces
- Follow M3 dimensions exactly — don't deviate "because it looks better"
- Use thick or solid material for any text-dense surface (forms, tables, review panels)

**Don't:**
- Use editorial serif fonts — this is the potting shed, not the gallery
- Add decorative gradients or hero imagery behind routine UI
- Write homepage, campaign, or executive-summary copy
- Nest multiple layers of rounded bordered panels
- Apply glass/blur/translucency to M3 components (TopContextBar only)
- Use Inter — admin uses Plus Jakarta Sans
```

- [ ] **Step 2: Verify file renders correctly**

Run: `head -5 packages/admin/DESIGN.md && wc -l packages/admin/DESIGN.md`
Expected: Title line visible, line count ~100-120 lines.

- [ ] **Step 3: Commit**

```bash
git add packages/admin/DESIGN.md
git commit -m "docs(admin): add admin DESIGN.md creative brief for AI design tools"
```

---

### Task 4: Create COPY_PROMPT.md

**Files:**
- Create: `COPY_PROMPT.md`

**Reference:** Spec § Deliverable 4 (COPY_PROMPT.md)

- [ ] **Step 1: Create COPY_PROMPT.md**

Write the voice/tone guide. Content must include all sections from the spec:

```markdown
# Green Goods — Copy & Voice Guide

> Feed this file to any copywriting agent (Antigravity, Gemini, Claude) alongside the relevant DESIGN.md for visual context. Specify which surface you're writing for.

## Brand Voice

**Green Goods speaks like:** A knowledgeable neighbor who runs the community garden. Warm but not gushing. Practical but not clinical. They know soil science but explain it by pointing at the compost pile.

**Voice pillars:**

| Pillar | Means | Doesn't Mean |
|--------|-------|------------|
| **Grounded** | Concrete, specific, rooted in real action | Jargon-heavy, academic, blockchain-first |
| **Inviting** | Welcoming, assumes good intent, lowers barriers | Sycophantic, over-enthusiastic, exclamation-heavy |
| **Honest** | Transparent about what works and what's experimental | Hedging, corporate disclaimers, vague promises |
| **Active** | Action-oriented, present-tense, you-centered | Passive voice, abstract nouns, bureaucratic |

**One-sentence test:** If it could appear on a government form, rewrite it. If it could appear on a hand-painted garden sign, it's close.

---

## Tone Spectrum

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

---

## Per-Surface Copy Patterns

### Browser (Funders / Community Members)

- **Headlines:** Editorial, evocative, magazine-weight. "The gardens growing a new kind of evidence."
- **Subheads:** Bridge emotion and information. "Community-documented impact, verified on-chain."
- **Garden descriptions:** Place-first. Lead with where the garden is and what it grows, not the technology.
- **Impact numbers:** Let them breathe. "47 documented actions" > "47 actions have been documented by community members."
- **CTAs:** Warm imperative. "Fund this garden" not "Contribute now."

### PWA (Gardeners)

- **Instructions:** Direct, second-person. "Describe what you did" not "Please provide a description."
- **Labels:** Short, noun-based. "Photo," "Method," "Confidence."
- **Empty states:** Encouraging, suggest next action. "No work yet. Start by documenting what you see."
- **Sync status:** Calm indicators. "Saved locally" / "Synced" / "Syncing..."
- **Errors:** Never blame the user. "We couldn't submit that" not "Your submission failed."

### Admin (Operators / Evaluators)

- **Copy mode:** Utility only. Status language and task framing.
- **Headers:** Functional nouns. "Review Queue," "Garden Settings," "Member Activity."
- **Status text:** Counts + state. "3 pending · 1 flagged · 12 approved"
- **Actions:** Verb-first. "Approve," "Request changes," "Flag for review."
- **Never:** Marketing copy, exclamatory language, homepage-style prose.

---

## Terminology

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

---

## Writing Checklist

Before shipping copy:

- [ ] Is it concrete? (Can the reader picture it?)
- [ ] Is it active? (Subject → verb → object?)
- [ ] Is the audience right? (Gardener ≠ operator ≠ funder)
- [ ] Is blockchain invisible? (On-chain = implementation, not copy)
- [ ] Would it make sense to someone who's never heard of web3?
- [ ] Is it shorter than your first draft?

---

## Using With AI Tools

When feeding this to a copywriting agent (Antigravity, Gemini, Claude):

1. Paste this full file as voice/tone context
2. Specify the surface (browser / PWA / admin)
3. Include the relevant DESIGN.md (foundation + surface) for visual context
4. Ask the agent to draft, then review against the checklist

**Example prompt:**
> Using the attached COPY_PROMPT.md as voice/tone guide and DESIGN.md as visual context, write copy for the Green Goods homepage (browser mode). The audience is funders and community members. Use the editorial lookbook tone. Draft 3 options for the hero headline and subhead.
```

- [ ] **Step 2: Verify file renders correctly**

Run: `head -5 COPY_PROMPT.md && wc -l COPY_PROMPT.md`
Expected: Title line visible, line count ~100-120 lines.

- [ ] **Step 3: Commit**

```bash
git add COPY_PROMPT.md
git commit -m "docs: add COPY_PROMPT.md voice and tone guide for AI copy generation"
```

---

### Task 5: Validation Pass

**Files:**
- Read: `DESIGN.md`
- Read: `packages/client/DESIGN.md`
- Read: `packages/admin/DESIGN.md`
- Read: `COPY_PROMPT.md`
- Reference: `packages/shared/src/styles/theme.css`
- Reference: `packages/admin/src/styles/admin-m3-tokens.css`
- Reference: `packages/admin/src/components/Layout/CanvasLayout.tsx`
- Reference: `packages/client/src/components/Navigation/SiteHeader.tsx`
- Reference: `packages/client/src/components/Layout/AppBar.tsx`

- [ ] **Step 1: Cross-reference color values**

Verify that every hex value in root DESIGN.md matches the actual token values in `theme.css`:
- `#292524` should match `--neutral-800` (rgb 41 37 36 — actually this is the bg-surface value, text-strong is `--neutral-950` = 12 10 9 = `#0C0A09`). Check and correct if needed.
- `#78716C` should match `--neutral-500` (rgb 120 113 108). Verify.
- `#1FC16B` should match `--green-500` (rgb 31 193 107). Verify.
- `#FAF8F5` is new (creative direction) — confirm this is noted as aspirational, not current.

Run: `grep -n "neutral-800\|neutral-950\|neutral-500\|green-500" packages/shared/src/styles/theme.css | head -10`

If any hex values in DESIGN.md don't match, correct them in the DESIGN.md files.

- [ ] **Step 2: Cross-reference admin font**

Verify Plus Jakarta Sans is the actual admin font:

Run: `grep -n "Jakarta\|font-family" packages/admin/src/index.css | head -5`

Confirm the admin DESIGN.md correctly specifies Plus Jakarta Sans.

- [ ] **Step 3: Cross-reference navigation structure**

Verify the admin navigation matches what's described:
- AppBar at top with GardenChip
- NavigationBar at bottom with workspace tabs
- RightSheet with orchestrator
- No FloatingToolbar references

Run: `grep -rn "FloatingToolbar\|floating.toolbar" packages/admin/src/ | head -5`

Expected: No matches (FloatingToolbar was removed).

- [ ] **Step 4: Cross-reference client navigation**

Verify client navigation matches:
- SiteHeader routes: Gardens, Actions, Impact, Fund
- AppBar tabs: Home, Garden, Profile

Run: `grep -n "Gardens\|Actions\|Impact\|Fund" packages/client/src/components/Navigation/SiteHeader.tsx | head -10`

- [ ] **Step 5: Test concatenation workflow**

Verify the usage pattern works:

```bash
# Test client concatenation
cat DESIGN.md packages/client/DESIGN.md | wc -l
# Expected: ~250-300 lines combined

# Test admin concatenation
cat DESIGN.md packages/admin/DESIGN.md | wc -l
# Expected: ~250-300 lines combined
```

- [ ] **Step 6: Fix any discrepancies and commit**

If any values needed correction:

```bash
git add -A
git commit -m "fix: correct design brief values against actual codebase tokens"
```

If no corrections needed, skip this step.
