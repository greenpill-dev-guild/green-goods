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
    fontSize: 14px
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
| **Desktop cockpit** | Stewards, Evaluators | Tending the garden — clipboard in hand | Command Surface | AppBar (top) + NavigationBar (bottom) + AdminFab |

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
- Shape scale: none (0px), xs (4px), sm (8px), md (12px), lg (16px), full (9999px) — no 20/24/28px shapes (`--m3-shape-xl` is deleted). Use admin-prefixed `--admin-radius-*` tokens for these M3-only shapes; admin **remaps** the shared `--radius-*` aliases onto this scale (`rounded-xl`/`rounded-2xl` resolve to 16px) rather than inheriting the Warm Earth runtime values.
- Single elevation ladder: `--m3-elevation-0/1/2`, plus the warm `--admin-chrome-shadow` reserved for floating chrome (nav dock, FAB). The old 0-5 scale and `--e1/e2/e3` aliases are deleted.
- **Spring motion (`--spring-*`) is the sole permitted deviation** from M3 standard easing
- **Controlled Chrome** — the nav dock (NavigationBar + FAB) is the only translucent surface: flat `rgb(var(--admin-surface-0) / 0.85)` with a 12px backdrop blur, a warm ambient shadow (`--admin-chrome-shadow`), and a 1px ink ring. The AppBar, MainSheet, and route frame are transparent — content sits directly on the canvas. Dialogs, side sheets, route cards, forms, tables, lists, and dense content stay solid.
- **Admin motion roles** are tokenized through runtime aliases: route content uses `--admin-motion-route-content-*`, canvas tone changes use `--admin-motion-canvas-tone-*`, FAB menus use `--admin-motion-fab-menu`, and interactive state changes use `--admin-motion-state`.

**Why strict:** M3+unbounded glass produced inconsistent UI. Strict M3 provides discipline; Controlled Chrome gives spatial depth to persistent shell surfaces without making operational content translucent.

**Enforcement:** `bun run check:design-tokens` fails if admin source adds glass, backdrop blur, or decorative gradients outside the approved chrome CSS boundary — `src/index.css` plus `src/styles/admin-m3-tokens.css` (tokens + Controlled Chrome material rules) and `src/styles/admin-m3-components.css` (admin-owned component skins and motion). The old `admin-m3-overrides.css` is deleted.

---

## Canvas Grid Layout

CSS Grid with named areas:

```
┌──────────────────────────────────────────┐
│  canvas-area-top                         │  ← AppBar (Z3): garden context,
│  (AppBar)                                │    search, settings, avatar
├──────┬───────────────────────┬───────────┤
│      │                       │           │
│      │     MainSheet         │           │  ← MainSheet (Z2): workspace content
│      │     (content zone)    │           │    Stays at rest when dialogs open
│      │                       │           │
├──────┴───────────────────────┴───────────┤
│  canvas-area-bottom                      │  ← NavigationBar (Z3): workspace
│  (NavigationBar + AdminFab)              │    switching + primary FAB action
└──────────────────────────────────────────┘
```

- **Overlays:** every workspace action and detail/inspection flow is a centered `AdminDialog` (the old side-sheet renderers are deleted). Creation flows and inspectors keep the left-inspector channel: views publish a descriptor through `useLeftSheetConfig`, and `LeftInspectorDialog` renders it as an `AdminDialog` carrying the workspace tone. The three global AppBar surfaces (profile/settings/notifications) route through the right-sheet registry into the `AdminSideSheet` inspector — right-docked within the canvas chrome bounds on desktop, bottom sheet on mobile. Profile and settings are separate sheet contents on desktop; the tabbed account surface (Account | Settings) is reserved for the mobile account route.
- **MainSheet recession:** retired — the canvas stays at rest; depth comes from the dialog's own scrim (the `isReceded` prop is no longer passed).

---

## Typography

- **Plus Jakarta Sans** across everything — titles (600), body (400), labels (500)
- Compressed cockpit scale: 22px/28px title-large for dialog and flow titles and the app bar · 16px/24px title-medium (weight 600) for the route header title — the chrome already declares the workspace, so the header is a waypoint, not a headline (2026-08-25) · 14px body and labels · 12px meta · 11px inside chips only. No display or headline ramp — nothing in the cockpit takes a display size.
- Utility copy, status language, task framing — not marketing copy
- Labels and timestamps are the most important typographic element (stewards scan metadata)

---

## Workspace Tinting

The canvas is a **constant** warm linen `#FAF8F5` (`--m3-surface-container-low` in light, `--m3-surface` in dark) — it never changes color per workspace. Each workspace's tonal palette (defined in `admin-m3-tokens.css`) appears in exactly three places:

1. **Active tab** — the `AdminTabRail` underline and active label (the count chip flips to the tone container pair).
2. **Active nav pill** — the NavigationBar active item, via `--tone-primary-container` / `--tone-on-primary-container`.
3. **One filled header action** — the single `--tone-action` filled button per route.

One atmospheric allowance on top: a faint top-of-canvas wash from `--tone-surface-tint-color` (5% light / 10% dark) fading to transparent by 320px. Everything else on the canvas stays neutral ink and stone.

Color roles:

- `--tone-action` is for filled action backgrounds.
- `--tone-on-action` is the text/icon color on filled action backgrounds.
- `--tone-primary-container` / `--tone-on-primary-container` are the active-selection container pair (nav pill, active tab count chips).
- `--tone-on-surface-accent` is for colored text/icons on solid surfaces.
- `--tone-focus-ring` is the only focus-ring role; it resolves to action tone in light mode and on-surface accent in dark mode.
- `--tone-surface-tint-color` feeds only the canvas wash.
- `--m3-outline` is the control-grade boundary for fields, chips, and outlined buttons.
- `--m3-outline-variant` is a decorative hairline, not a control boundary.
- Deleted tone roles — do not reintroduce: `--tone-canvas`, `--tone-strength`, `--tone-tint`, `--tone-tint-2`, `--tone-accent`, `--tone-secondary`, `--tone-outline`, `--tone-surface-variant`.

---

## Admin Component Pattern

The M3 primitives are **Admin* adapter wrappers** following M3 v0.192 exactly — zero changes to the shared package. Around them sit admin-owned shell and layout families that intentionally do not carry the prefix: the Shell forks (`AppBar`, `NavigationBar`, `MainSheet`, `FabButton`), `CanvasLayout` and the `Canvas*` route-state surfaces, the `Account*` panels, the `ActionFlow*` flow chrome, and named singletons (`PageHeader`, `CommandPalette`, `ConnectShell`, `LeftInspectorDialog`).

Wrappers (22): AdminBadge, AdminButton, AdminCard, AdminCheckbox, AdminChoiceGroup, AdminConfirmDialog, AdminDialog, AdminFab, AdminFilterChip, AdminInlineField, AdminLinearProgress, AdminListItem, AdminReasonDialog, AdminSearchToolbar, AdminSelectableCard, AdminSettingRow, AdminSideSheet, AdminSortSelect, AdminTabRail, AdminTextField, AdminTooltip, AdminViewActions.

### Card and selection grammar

- `WorkbenchCard` (a shared Canvas primitive from `@green-goods/shared`, not an Admin* wrapper) is for workbench records and action/assessment queue items that stewards scan, compare, and act on in a grid or list.
- `AdminCard` is for compact modules, stats, settings, status panels, and supporting detail regions.
- `AdminSelectableCard` is for richer exclusive or multi-select choices where the option needs a title, description, icon, or metadata.
- `AdminChoiceGroup` is for compact single-select preferences and context switches inside dense panels.
- `AdminTabRail` is the exclusive mode/tab control for route-local views. Anatomy: underline tabs on a hairline stone rule — a 2px accent underline under the active tab, neutral count chips that flip to the tone container pair when active.
- `AdminFilterChip` is the compact filter grammar for toggles inside toolbars.
- Avoid new direct shared `Card` usage in admin route work unless the route is intentionally consuming an existing shared, non-admin surface.

Admin dashboard modals use AdminDialog or AdminConfirmDialog. Desktop renders as a centered M3 dialog; mobile renders as a bottom sheet. Pinned actions sit below the scrollable body so cancel, save, confirm, retry, and close controls remain visible. The command palette uses the AdminDialog palette variant. DialogShell remains for shared or non-admin surfaces, not admin dashboard modals. The three global AppBar surfaces (Profile, Settings, Notifications) are the one side-sheet exception: they render in AdminSideSheet — right-docked within the canvas chrome bounds on desktop, AdminDialog-identical bottom sheet on mobile — with usage locked to CanvasLayout by AdminSideSheetStandard.guard.

---

## Navigation

- **AppBar** (top context bar, Z3): GardenChip selector, search, settings, notifications, avatar
- **NavigationBar** (bottom, Z3): Workspace tabs — Hub, Garden, Community, Actions. Symbol-first. Role-adaptive visibility via permissions.
- **FAB** (`Shell/FabButton`): Per-workspace primary action — M3 large FAB geometry with 16px radius; the in-dock nav FAB is circular. Integrated into NavigationBar via FabProvider. (`AdminFab` is the standalone M3 FAB wrapper in the palette; the shipped nav dock uses `Shell/FabButton`.)
- **Desktop profile**: On desktop, Profile redirects to Hub and opens the AdminSideSheet account inspector with profile content.
- **Controlled Chrome**: only the NavigationBar/FAB dock is translucent — flat `rgb(var(--admin-surface-0) / 0.85)`, 12px blur, warm ambient shadow, 1px ink ring (every dialog surface and the account side sheet are solid M3). The AppBar root and MainSheet are transparent while child controls can carry their own solid/hover states. Page content, tables, forms, and route cards do not use glass.

---

## Cockpit M3 1a Invariants

- **Single elevation ladder** — `--m3-elevation-0/1/2` plus `--admin-chrome-shadow` for floating nav/FAB chrome; nothing else casts shadow.
- **Radius set** — 4/8/12/16/9999px only; no 20/24/28px shapes anywhere in admin.
- **Four-use tone budget** — workspace tone appears only in the active tab, the active nav pill, one filled header action, and the nav-shell FAB fill (plus the faint canvas wash).
- **Hover rule** — hovers are an elevation step-up or the neutral ink layer `rgb(var(--m3-on-surface) / 0.08)`; never translate/scale lifts or hue shifts.
- **AdminButton only** — pill-shaped, sentence case; the shared `Button` (`gg-button`) does not appear in admin.

---

## Do's and Don'ts

**Do:**
- Start from layout and flow before reaching for Card
- Use status language: "3 pending reviews" not "You have work to do!"
- Keep one dominant workspace surface per route
- Use the Hub route as reference composition for new cockpit surfaces
- Follow M3 dimensions exactly — don't deviate "because it looks better"
- Use solid material for any text-dense surface (forms, tables, review panels)
- Reserve the Controlled Chrome dock material (flat 85% surface, 12px blur, warm shadow, ink ring) for the floating nav/FAB chrome only
- Route motion through the admin motion roles instead of one-off durations

**Don't:**
- Use editorial serif fonts — this is the potting shed, not the gallery
- Add decorative gradients or hero imagery behind routine UI
- Write homepage, campaign, or executive-summary copy
- Nest multiple layers of rounded bordered panels
- Apply glass/blur/translucency to route cards, forms, tables, records, or dense content
- Use Inter — admin uses Plus Jakarta Sans
