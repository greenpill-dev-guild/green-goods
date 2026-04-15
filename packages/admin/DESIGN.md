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
