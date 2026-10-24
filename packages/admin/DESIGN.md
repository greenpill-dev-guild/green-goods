---
version: alpha
name: Green Goods Admin Cockpit Dialect
description: The steward cockpit, the installed app's Warm Earth language at a denser setting. Extends the Warm Earth core DesignMD tokens.
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

# Green Goods Admin: Design Brief

> Surface-specific creative direction for the admin dashboard. Use with the root `DESIGN.md`; lint this overlay and the root file separately.

## Surface Identity

| Mode | Audiences | Metaphor | Paradigm | Navigation |
|------|-----------|----------|----------|------------|
| **Desktop cockpit** | Stewards, evaluators | Tending the garden, clipboard in hand | Command Surface | AppBar (top) + NavigationBar (bottom) + FabButton |

**Cockpit litmus test:** If inappropriate for Linear, GitHub, or Stripe's dashboard, it's inappropriate here.

---

## Creative Direction

**Physical metaphor:** The operations room of a community garden collective. A well-organized potting shed, with every tool in its place. Functional, purposeful, warm but not decorative.

**Key difference from the installed app:** the same language at a denser setting. Stewards meet the app's face, linen canvas and warm charcoal ink here, set tighter, with pill buttons, a tone per workspace and the cockpit's own navigation. Nothing editorial: no serif headlines, no lookbook layouts. This is where the *work* happens.

---

## One Language, a Denser Setting

The cockpit speaks the installed app's Warm Earth language at a denser setting. Its strict Material 3 rule is retired (DL-095): nothing here follows Material 3 because it is Material 3. Stewards use both surfaces in one sitting, so the pieces they meet on both should look and behave as one, while density, pill buttons, workspace tones and the navigation still tell them which surface they are on.

**Shared with the installed app.** Where Shared has the piece, the cockpit renders it and tunes it through its own token block; it never restyles it (DL-031). So far:

- The face and the type roles: Plus Jakarta Sans, with one set of role names at each surface's sizes (DL-096, § Typography).
- The ground: the linen canvas with white cards, and one warm dark ladder (DL-097, § Workspace Tinting).
- The control-grade outline on fields, chips and secondary buttons, and one solid focus ring in each surface's focus role (DL-098).
- One count badge, the shared `CountBadge`, on the workspace tone's accent here (DL-099, § Workspace Tinting).
- Capsule chips with one selected fill: `AdminFilterChip` is a 32px capsule that a selection fills with the workspace tone's action pair, the app's selected look in the tone (DL-101).
- The active-tab pill on both bottom bars: the workspace tone's container here, the green container in the app (DL-107, § Navigation).
- Solid surfaces: every card, sheet, dialog and menu is opaque on both, and the cockpit's nav dock below is the one translucent piece (DL-108).

Each shared piece that follows joins this list with its decision-log row.

**The cockpit's own dials**, kept because they were chosen for stewards (DL-095):

- **Density**: the compact control metric (buttons 28/32/40, each tier with a 44px finger box) and 14px body and labels (DL-011, DL-030; § Cockpit M3 1a Invariants).
- **Pill buttons**: every button is a pill, and the FAB is a capsule at both sizes (DL-010).
- **Workspace tones**: Hub, Garden, Community and Actions each carry their own tone, spent on a fixed budget (§ Workspace Tinting); the active nav pill is drawn in it.
- **Inline filters**: filter chips and sort sit in the toolbar, so Pending and Approved stay one tap apart (DL-082).
- **Motion**: the Standard scheme on the spring tokens; a hover is an elevation step or the neutral ink layer, never a lift.
- **Navigation**: the AppBar, the NavigationBar dock and its FAB (§ Navigation).

**What leaves with the rule.** Each piece that Material 3 used to justify is replaced by the shared piece in its own change: the filled field with an underline, elevation as a card's surface, the 12px card corner, the underline tab rail and the warm gray phone sheet; the gray count chip has already given way to the shared count badge (DL-099), and the 8px chip to the capsule chip (DL-101). Until its replacement lands, a piece keeps the anatomy this guide gives it.

**Tokens keep their names.** The `--m3-*` tokens are an internal layer under the shared names the views read, and a name changes only when a change has to touch it. Shape, depth and motion read from that layer and the admin aliases beside it:

- State layers: hover (8%), focus (12%), pressed (12%), dragged (16%)
- Shape scale: none (0px), xs (4px), sm (8px), md (12px), lg (16px), full (9999px). No 20/24/28px shapes (`--m3-shape-xl` is deleted). Use admin-prefixed `--admin-radius-*` tokens for these shapes; admin **remaps** the shared `--radius-*` aliases onto this scale (`rounded-xl`/`rounded-2xl` resolve to 16px) rather than inheriting the Warm Earth runtime values.
- Single elevation ladder: `--m3-elevation-0/1/2`, plus the warm `--admin-chrome-shadow` reserved for floating chrome (nav dock, FAB). The old 0-5 scale and `--e1/e2/e3` aliases are deleted.
- **Spring motion (`--spring-*`)** is the only easing; the admin motion roles below alias it.
- **Controlled Chrome**: the nav dock (NavigationBar + FAB) is the only translucent surface, a flat `rgb(var(--admin-surface-0) / 0.85)` with a 12px backdrop blur, a warm ambient shadow (`--admin-chrome-shadow`), and a 1px ink ring. The AppBar, MainSheet, and route frame are transparent, so content sits directly on the canvas. Dialogs, side sheets, menus, route cards, forms, tables, lists, and dense content stay solid (DL-108).
- **Admin motion roles** are tokenized through runtime aliases: route content uses `--admin-motion-route-content-*`, canvas tone changes use `--admin-motion-canvas-tone-*`, FAB menus use `--admin-motion-fab-menu`, and interactive state changes use `--admin-motion-state`.

**Enforcement:** `bun run check --only design-tokens` fails if admin source adds glass, backdrop blur, or decorative gradients outside the approved chrome CSS boundary: `src/index.css` plus `src/styles/admin-m3-tokens.css` (tokens + Controlled Chrome material rules), `src/styles/admin-m3-components.css` (admin-owned component skins and motion), and `src/styles/admin-layout.css` (the layout and surface classes admin components render, including the media scrims; Storybook imports it too, so stories lay out as the product does). The old `admin-m3-overrides.css` is deleted.

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
│  (NavigationBar + FabButton)             │    switching + primary FAB action
└──────────────────────────────────────────┘
```

- **Overlays:** every workspace action and detail/inspection flow is a centered `AdminDialog` (the old side-sheet renderers are deleted). Creation flows and inspectors keep the left-inspector channel: views publish a descriptor through `useLeftSheetConfig`, and `LeftInspectorDialog` renders it as an `AdminDialog` carrying the workspace tone. The three global AppBar surfaces (profile/settings/notifications) route through the right-sheet registry into the `AdminSideSheet` inspector (right-docked within the canvas chrome bounds on desktop, a bottom sheet on mobile). Profile and settings are separate sheet contents on desktop; the tabbed account surface (Profile | Settings) is reserved for the mobile account route.
- **MainSheet recession:** retired. The canvas stays at rest; depth comes from the dialog's own scrim (the `isReceded` prop is no longer passed).
- **Phone gutter:** below 600px the page has one 12px side inset, `--admin-main-inline-gutter-mobile`, and the shell applies it once: the AppBar row and the main scroll area take it, so the GardenChip, the route header, the tab rail, and every card share one edge. Nothing inside adds to it. The route frame's side padding starts at 600px (24px, then 32px from 1024px), and a view never wraps its page content in its own `px-*`. A card's padding is the only other inset. A dialog is a full-width sheet at that size and keeps its own 16px.

---

## Typography

- **Plus Jakarta Sans** across everything: titles (600), body (400), labels (500)
- The type roles, at the cockpit's density: `type-title-lg` 22/28 for dialog, flow, and step titles and the app bar (a step title takes its flow title's size through `FlowStepHeader`, DL-063) · `type-title-md` 16/24 for the route header, every card title, and section titles via `AdminCardTitle` · `type-title-sm` 14/20 for selectable-card and work-card titles and compact values (metrics, balances, review lines) · `type-body` 14px body and `type-label` 14px labels (every AdminButton size, DL-030) · `type-label-sm` 12px labels and `type-meta` 12px meta and floating field labels · `type-meta-sm` 11px for chips and the smallest supporting lines · `type-field` for field text and checkbox and choice labels, 16px on touch widths and 14px from 640px. The installed app uses the same roles at its own sizes. The chrome already declares the workspace, so the route header is a waypoint, not a headline. No display or headline ramp: nothing in the cockpit takes a display size.
- Every size comes from these roles (the `type-*` utilities in shared `theme.css`, set to the cockpit's values in `src/index.css`). The Material `text-title-*`, `text-body-*`, and `text-label-*` aliases and the `label-*`, `body-*`, and `subheading-*` classes are retired, and the cockpit's theme no longer defines them; `check:design-tokens` fails on them, on the shared theme's other sizes (`text-paragraph-*`, `text-title-h*`, and the like), and on a raw Tailwind size anywhere in `src/`, stories included (frontend-design Rule 9). The shared components the cockpit draws (the garden chip, the header's meta line, status pills, record cards, empty states) use the same roles.
- Utility copy, status language, and task framing, not marketing copy. The things in a pool are promises in every label ("Seed Promises", "10 promises", "Add 5 Promises"), Pool names only the container, and code keeps "commitment" (DL-071). The Garden workspace's tab for them is Promises: its card for asks is Review Promises ("Nothing to review." when empty, "To review" in What needs you), its list card is Offers and Requests, and Pool Status and Pool Funding keep the container's name, as do the routes and the code (DL-077).
- Labels and timestamps are the most important typographic element (stewards scan metadata). Times read in the viewer's zone: a timeline says "Today, 3:42 PM", "Yesterday, 9:05 AM", then the date and time, with the year only when it isn't this one; a queue age stays relative (DL-044), with the full moment in its `<time>` title; a due date in a row adds its time within 48 hours ("due tomorrow, 3:42 PM"); an exact deadline gives date, time and zone. Each section that lists times carries one "Times in PDT" label, and each `<time>` a machine-readable `datetime` (DL-069).
- Every person or garden named in a row takes one style, 14px semibold, whether it is a profile name, a Green Goods or ENS name, or a short address (`PersonName`, DL-070).

---

## Workspace Tinting

The canvas is the same warm linen as the installed app, `#FAF8F5` (`--m3-surface-container-low` in light, the warm dark floor `--m3-surface` in dark), and never changes color per workspace. Cards are white in light and sit ten points of lightness above the canvas in dark, with an 8% ring, so a card never blends into the ground (the dark ladder is the shared Earth ramp in `theme.css`, DL-097). Each workspace's tonal palette (defined in `admin-m3-tokens.css`) appears in exactly six places:

1. **Active tab**: the `AdminTabRail` underline and active label.
2. **Active nav pill**: the NavigationBar active item, via `--tone-primary-container` / `--tone-on-primary-container`.
3. **At most one filled header action**: the single `--tone-action` filled button per route. A review surface such as the Hub fills none: its whole action set renders outlined, and the declared primary still sorts rightmost and fills the FAB (DL-043).
4. **The FAB**: the nav-shell `FabButton`, the workspace's primary action, filled with `--tone-action` and labeled in `--tone-on-action`.
5. **Count badges**: the shared `CountBadge` on every `AdminTabRail` tab that counts, active or not, filled with `--tone-on-surface-accent` and inked with `--tone-on-action` (DL-099).
6. **A selected filter chip**: `AdminFilterChip` while it is selected, filled with `--tone-action` and labeled in `--tone-on-action`, the installed app's selected look in the workspace tone (DL-101).

One atmospheric allowance on top: a faint top-of-canvas wash from `--tone-surface-tint-color` (5% light / 10% dark) fading to transparent by 320px. Everything else on the canvas stays neutral ink and stone. The focus role (`--tone-focus-ring`, below) is not one of the six: it rings focus and marks the record a list has open (DL-098, DL-103).

Color roles:

- `--tone-action` is for filled action backgrounds and a selected filter chip's fill.
- `--tone-on-action` is the text/icon color on filled action backgrounds and a selected filter chip, and the count badge's ink.
- `--tone-primary-container` / `--tone-on-primary-container` are the active-selection container pair (the nav pill).
- `--tone-on-surface-accent` is for colored text/icons on solid surfaces, and fills the count badge (DL-099). It equals the action fill in every tone but Community, where it is orange-800 (white at 7.09:1 on the cockpit's amber ramp) beside the orange-700 fill (5.02:1).
- `--tone-focus-ring` is the cockpit's value of the one focus role; it resolves to action tone in light mode and on-surface accent in dark mode, and the shared controls draw it as one solid 2px ring (DL-098). The installed app sets the same role to its green.
- `--tone-surface-tint-color` feeds only the canvas wash.
- `--m3-outline` is the control-grade boundary for fields, chips, and outlined buttons; the shared fields, chips and secondary buttons draw it through `--gg-control-outline` (DL-098).
- `--m3-outline-variant` is a decorative hairline, not a control boundary.
- Deleted tone roles (do not reintroduce): `--tone-canvas`, `--tone-strength`, `--tone-tint`, `--tone-tint-2`, `--tone-accent`, `--tone-secondary`, `--tone-outline`, `--tone-surface-variant`.

---

## Admin Component Pattern

The cockpit's controls are **Admin* adapter wrappers** on its compact metric, with zero changes to the shared package. Around them sit admin-owned shell and layout families that intentionally do not carry the prefix: the Shell forks (`AppBar`, `NavigationBar`, `MainSheet`, `FabButton`), `CanvasLayout` and the `Canvas*` route-state surfaces, the `Account*` panels, the `ActionFlow*` flow chrome, and named singletons (`PageHeader`, `CommandPalette`, `ConnectShell`, `LeftInspectorDialog`).

Wrappers (25): AdminButton, AdminCard, AdminCheckbox, AdminChoiceGroup, AdminConfirmDialog, AdminDialog, AdminFieldGroup, AdminFilterChip, AdminIconButton, AdminInlineField, AdminInputChip, AdminLinearProgress, AdminListRow, AdminReasonDialog, AdminSearchToolbar, AdminSelect, AdminSelectableCard, AdminSettingRow, AdminSideSheet, AdminSortSelect, AdminTabRail, AdminTextArea, AdminTextField, AdminTooltip, AdminViewActions. (AdminSelect is the form select added 2026-08-29. It lives in `AdminTextField.tsx` beside AdminTextArea; the toolbar `AdminSortSelect` stays toolbar-only. AdminIconButton, for glyph-only actions on the DL-011 tiers with a mandatory accessible name, lives in `AdminButton.tsx`; AdminFieldGroup carries the family's label/hint/error anatomy for group-shaped fields (checkbox grids, repeating rows, upload wells). AdminCard also exports AdminCardHeader/Body/Footer slots, which retired the legacy shared `Card` from admin production code (2026-08-30). AdminBadge, AdminFab, and AdminListItem were deleted 2026-08-29 for having zero production consumers; the dock FAB is `Shell/FabButton`. AdminListRow, added 2026-09-30, is the list row that opens its record; unlike AdminListItem it owns only the row's box, so a row of any content can adopt it.)

**Adoption is enforced**: the wrapper-adoption sweep in `check:design-tokens` fails any new shared field primitive (`TextInput`/`Textarea`/`NativeSelect`/`FormField`/local re-wraps), raw `<button>`, or legacy `Card` render in `packages/admin/src` outside the audited baseline (13 sanctioned residue sites: state-layer row/card buttons, the avatar identity tile, stepper dots). Typography is enforced the same way: every size comes from the `type-*` roles (§ Typography), and the type sweep fails on a raw Tailwind size, a retired Material alias or named class, or any other shared-scale size.

### Card and selection grammar

- `WorkbenchCard` (a shared Canvas primitive from `@green-goods/shared`, not an Admin* wrapper) is for workbench records and action/assessment queue items that stewards scan, compare, and act on in a grid or list.
- `HubWorkCard`, the Hub's work card, is the shared media card (`MediaCard`, the card for an object with a picture of its own) with the work's photo mosaic as its picture and the domain and photo count as marks on it. From 600 to 1023px it stacks the mosaic on top, and on a phone the queue takes the work row (F7); from 1024px it lies wide, the mosaic in a 144px column and the title, status, action, gardener and age centered beside it, two to a row at 1280px. Every card in the queue keeps one height (DL-103).
- `AdminCard` is for compact modules, stats, settings, status panels, and supporting detail regions.
- `AdminSelectableCard` is for richer exclusive or multi-select choices where the option needs a title, description, icon, or metadata.
- `AdminListRow` is for a list row that opens its record: the whole row is the button, its height follows its content, and the open record is marked current. Actions stay `AdminButton`; choices stay `AdminSelectableCard`.
- `AdminChoiceGroup` is for compact single-select preferences and context switches inside dense panels.
- `AdminTabRail` is the exclusive mode/tab control for route-local views. Anatomy: underline tabs on a hairline stone rule, with a 2px accent underline under the active tab, and the shared `CountBadge` on every tab that counts (DL-099).
- `AdminFilterChip` is the compact filter grammar for toggles inside toolbars: a 32px capsule, outlined at rest, that a selection fills with the workspace tone's action pair, the installed app's selected look (DL-101). A selected chip shows its fill and `aria-pressed`, never a check mark, so selecting it never changes its width (DL-065).
- `AdminInputChip` holds something the steward chose and can take back out, such as a person named as a confirmer: a 32px outlined capsule with an optional avatar and a remove button.
- Avoid new direct shared `Card` usage in admin route work unless the route is intentionally consuming an existing shared, non-admin surface.

Admin dashboard modals use AdminDialog or AdminConfirmDialog. Desktop renders as a centered M3 dialog; every mobile variant renders as a full-width bottom sheet, with padding inside the surface. Pinned actions sit below the scrollable body so cancel, save, confirm, retry, and close controls remain visible. The command palette uses the AdminDialog palette variant. DialogShell remains for shared or non-admin surfaces, not admin dashboard modals. The three global AppBar surfaces (Profile, Settings, Notifications) are the one side-sheet exception: they render in AdminSideSheet (right-docked within the canvas chrome bounds on desktop, an AdminDialog-identical full-width bottom sheet on mobile), with usage locked to CanvasLayout by AdminSideSheetStandard.guard.

---

## Workspace Scope and Consequential Writes

This is the admin's application of the root [Interface Principles](../../DESIGN.md#interface-principles) (4, 9, 12, 15). The principles are the source; this section names the admin pieces that carry them.

- **The GardenChip sets the scope.** Every workspace (Hub, Garden, Community, Actions) acts only on the garden the AppBar's GardenChip shows. No tab, card, or dialog writes to another garden's records.
- **The protocol lives in its own garden.** The protocol pool is the Green Goods Community Garden's pool. Its console is that garden's Garden → Promises tab, like any garden's, and the protocol's operations (settlement, protocol funding, protocol confirmations) appear in that garden's Community → Coordination tab and nowhere else.
- **Campaign cookie jars are protocol surfaces too** (DL-046). They span gardens, so they sit in that same garden: a Campaign Cookie Jars card on its Community → Payouts, shown to deployers only. Creating one is a flow dialog like every other create, and the `/cookies` URLs redirect to the card. `useIsProtocolGarden` is the one test both Community surfaces share.
- **One home per organism.** `GardenPoolTab` mounts only in the Garden workspace. Its protocol context comes from the pool it reads (`poolType`), never from where it is mounted. Mounting a writing organism anywhere else is a design decision to record, not a convenience.
- **Name the target.** Every pool write dialog names its pool with `PoolTarget`: a quiet "Writing to" line for a garden's pool, a warning for the protocol pool. A flow with a step rail puts the line at the foot of the rail, and on one line under the stepper on narrow screens (`ActionFlowShell`'s `target`); a dialog without a rail opens with it; the protocol pool's warning also stays at the top of the body (DL-066).
- **Show every signature.** A flow that sends several writes shows them all in `SetupProgressList`, each with a `TxStepMarker`: how many prompts are coming, which one the wallet is waiting on, which are confirming or done, where a run stopped, and a done state the steward closes. The same marker drives hypercert minting, so progress reads the same everywhere.

---

## Navigation

- **AppBar** (top context bar, Z3): GardenChip selector, search, settings, notifications, avatar
- **NavigationBar** (bottom, Z3): Workspace tabs (Hub, Garden, Community, Actions). Symbol-first. Role-adaptive visibility via permissions. The active tab carries a pill of the workspace tone's container behind its icon, with its label in ink at weight 600. The installed app's bottom bar draws the same pill in its green, and each bar keeps its own chrome (DL-107).
- **FAB** (`Shell/FabButton`): Per-workspace primary action, a capsule at both sizes (`rounded-full`): 48px circle in the dock, 56px extended capsule with label when floating on mobile (DL-010; capsule = the 9999 step of the admin radius set). Closed, it shows a plus in every workspace, in the workspace tone, whether it fires one act or opens a speed dial; a dial shows a close icon while open, and its rows name each act beside the act's own icon (DL-078). Integrated into NavigationBar via FabProvider.
- **Desktop profile**: On desktop, Profile redirects to Hub and opens the AdminSideSheet account inspector with profile content.
- **Controlled Chrome**: only the NavigationBar/FAB dock is translucent, with flat `rgb(var(--admin-surface-0) / 0.85)`, a 12px blur, a warm ambient shadow, and a 1px ink ring (every dialog surface, menu and the account side sheet are solid, DL-108). The AppBar root and MainSheet are transparent while child controls can carry their own solid/hover states. Page content, tables, forms, and route cards do not use glass.

---

## Cockpit M3 1a Invariants

- **Single elevation ladder**: `--m3-elevation-0/1/2` plus `--admin-chrome-shadow` for floating nav/FAB chrome; nothing else casts shadow.
- **Radius set**: 4/8/12/16/9999px only; no 20/24/28px shapes anywhere in admin.
- **Six-use tone budget**: workspace tone appears only in the active tab, the active nav pill, at most one filled header action (none on a review surface, DL-043), the nav-shell FAB fill, the tab rail's count badges (DL-099) and a selected filter chip (DL-101), plus the faint canvas wash; the focus role, which also marks the record a list has open (DL-103), is not counted.
- **Hover rule**: hovers are an elevation step-up or the neutral ink layer `rgb(var(--m3-on-surface) / 0.08)`, painted beneath the label on a filled control (`m3-state-layer-beneath`) so a hovered or pressed label keeps its rest contrast; never translate/scale lifts or hue shifts.
- **AdminButton only**: pill-shaped, Title Case action labels in en (DL-012; es/pt keep native casing); admin views never render the shared `Button` (`gg-button`).
- **Shared pieces ride the shared family (DL-031)**: the shared components the cockpit renders (FileUploadField, DatePicker, ConfidenceSelector, AudioRecorder, ImagePreviewDialog, toast actions, AssetSelector, AddressDisplay, Alert) keep their shared `Button` / `IconButton` / `Chip` / control anatomy; `index.css` sets the family's `--gg-*` tokens (pills, one 14px / 500 label, lg and md on 40, sm on 32, compact on 28, a 44px finger box) and `surface="admin"` puts a shared field on the responsive field tier and the switch on the M3 52 × 32 track. Never restyle a shared piece from admin; move the token.
- **Compact cockpit metric (DL-011, DL-030)**: control heights ride the 28/32/36/40/44 scale, with buttons 28/32/40 (sm/md/lg, one 14px label, a 44px finger box on every tier: `admin-hit-target` below 40px, `admin-hit-target-lg` on the 40px tier including close buttons and AppBar icons), fields 44 with 16px text on touch widths (matching the installed app) and 40 with 14px text from 640px, with a 12px floating label, inline field 32 on the md-button axis, toolbar pills and tabs 36, chips 32, identity pill 36. Shell chrome (AppBar 56, FAB 48/56 per DL-010, nav dock) sits deliberately outside this scale.

---

## Do's and Don'ts

**Do:**
- Start from layout and flow before reaching for Card
- Use status language: "3 pending reviews" not "You have work to do!"
- Keep one dominant workspace surface per route
- Use the Hub route as reference composition for new cockpit surfaces
- Take the shared piece where Shared has one, and tune it through the cockpit's tokens, never a restyle (DL-031)
- Use solid material for any text-dense surface (forms, tables, review panels)
- Reserve the Controlled Chrome dock material (flat 85% surface, 12px blur, warm shadow, ink ring) for the floating nav/FAB chrome only
- Route motion through the admin motion roles instead of one-off durations

**Don't:**
- Use editorial serif fonts (this is the potting shed, not the gallery)
- Add decorative gradients or hero imagery behind routine UI
- Write homepage, campaign, or executive-summary copy
- Nest multiple layers of rounded bordered panels
- Add side padding around a view's page content below 600px (the shell's 12px phone gutter is the only one)
- Apply glass, blur, or translucency to anything but the nav dock: route cards, menus, forms, tables, records, and dense content stay solid (DL-108)
- Use Inter (admin uses Plus Jakarta Sans)
- Justify a choice by Material 3 alone: the rule is retired (DL-095)
