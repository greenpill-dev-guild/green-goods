---
version: alpha
name: Green Goods Admin Cockpit Dialect
description: Restrained M3 cockpit overlay for Green Goods admin surfaces. Extends the Warm Earth core DesignMD tokens.
extends: ../../DESIGN.md
surface: admin
dialect: cockpit
typography:
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: 500
    lineHeight: 16px
  app-title:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: 600
    lineHeight: 28px
---

# Green Goods Admin — Design Brief

> Surface-specific creative direction for the admin dashboard. Use with the root `DESIGN.md`; lint this overlay and the root file separately.

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
- Shape scale: none (0px), xs (4px), sm (8px), md (12px), lg (16px), xl (28px), full (9999px). Use admin-prefixed `--admin-radius-*` tokens for these M3-only shapes; shared `--radius-*` aliases remain the DesignMD-generated Warm Earth runtime scale.
- M3 elevation scale (0-5) with specific shadow values
- **Spring motion (`--spring-*`) is the sole permitted deviation** from M3 standard easing
- **Controlled Chrome Liquid Glass** — subtle glass is allowed only on AppBar, Navigation/FAB, and sheet shells; route cards, forms, tables, lists, and dense content stay solid.
- **Admin motion roles** are tokenized through runtime aliases: route content uses `--admin-motion-route-content-*`, canvas tone changes use `--admin-motion-canvas-tone-*`, FAB menus use `--admin-motion-fab-menu`, and interactive state changes use `--admin-motion-state`.

**Why strict:** M3+unbounded glass produced inconsistent UI. Strict M3 provides discipline; Controlled Chrome gives spatial depth to persistent shell surfaces without making operational content translucent.

**Enforcement:** `bun run check:design-tokens` fails if admin source adds glass, backdrop blur, or decorative gradients outside the approved chrome CSS boundary.

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
- **RightSheet:** Config, alerts, profile, settings — pane-scoped content routing via sheet orchestrator. Profile and settings are separate sheet contents on desktop; the tabbed account surface is reserved for the mobile account route.
- **MainSheet recession:** `isReceded` prop triggers scale + blur when sheets open

---

## Typography

- **Plus Jakarta Sans** across everything — headlines (600-700), body (400-500), labels (500)
- M3 type scale: display, headline, title, body, label with defined sizes
- Utility copy, status language, task framing — not marketing copy
- Labels and timestamps are the most important typographic element (operators scan metadata)

---

## Workspace Tinting

Existing tokens (`--ws-primary`, `--ws-on-primary`, `--ws-action`, `--ws-on-action`) support per-workspace color atmosphere and contrast-safe actions:

| Workspace | Tint Color | Action Color | Purpose |
|-----------|------------|--------------|---------|
| Hub | Blue (`--blue-500`) | Blue (`--blue-500`) | Work pipeline, review queue |
| Garden | Green (`--green-500`) | Deep green (`--green-800`) | Garden management, brand color |
| Community | Orange (`--orange-500`) | Deep orange (`--orange-800`) | Members, roles, social activity |
| Actions | Red (`--red-500`) | Deep red (`--red-700`) | Action configuration, templates |
| Home | Stone/Neutral (`120 113 108`) | Deep stone (`68 64 60`) | Unauthenticated landing |

The tint is environmental — barely perceptible warmth in the canvas, not a colored header bar. Filled text-bearing actions use the action color so white text passes contrast.

---

## Admin Component Pattern

All admin-specific components use **Admin* adapter wrappers** following M3 v0.192 exactly. Zero changes to the shared package.

Components: AdminButton, AdminCard, AdminCheckbox, AdminDialog, AdminFab, AdminLinearProgress, AdminListItem, AdminBadge, AdminTooltip, AdminFilterChip, AdminSearchToolbar, AdminTabRail, AdminTextField.

---

## Navigation

- **AppBar** (top context bar, Z3): GardenChip selector, search, settings, notifications, avatar
- **NavigationBar** (bottom, Z3): Workspace tabs — Hub, Garden, Community, Actions. Symbol-first. Role-adaptive visibility via permissions.
- **AdminFab**: Per-workspace primary action, capsule shape. Integrated into NavigationBar via FabProvider.
- **Desktop profile**: On desktop, Profile redirects to Hub and opens RightSheet with profile content.
- **Controlled Chrome**: AppBar, NavigationBar/FAB, and Left/Right/Bottom sheet shells use subtle liquid material. Page content, tables, forms, and route cards do not.

---

## Do's and Don'ts

**Do:**
- Start from layout and flow before reaching for Card
- Use status language: "3 pending reviews" not "You have work to do!"
- Keep one dominant workspace surface per route
- Use the Hub route as reference composition for new cockpit surfaces
- Follow M3 dimensions exactly — don't deviate "because it looks better"
- Use thick or solid material for any text-dense surface (forms, tables, review panels)
- Use Controlled Chrome only for persistent shell depth and sheet containment
- Route motion through the admin motion roles instead of one-off durations

**Don't:**
- Use editorial serif fonts — this is the potting shed, not the gallery
- Add decorative gradients or hero imagery behind routine UI
- Write homepage, campaign, or executive-summary copy
- Nest multiple layers of rounded bordered panels
- Apply glass/blur/translucency to route cards, forms, tables, records, or dense content
- Use Inter — admin uses Plus Jakarta Sans
