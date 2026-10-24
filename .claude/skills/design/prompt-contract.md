# AI Prompt Contract: Admin Surface

Stable vocabulary and never-use list for prompting AI design tools or coding agents to generate admin UI that aligns with the Green Goods cockpit.

> **Companion**: The `client` surface uses a warmer, more expressive palette of vocabulary anchored in the root `DESIGN.md`. This file is admin-specific: steward cockpit framing.

## Stable Prompt Core

Paste this sentence (or a trimmed version) into every AI design prompt for admin surfaces:

> Green Goods admin is a **restrained steward cockpit**: the installed app's **Warm Earth** language at a **denser setting**, not raw Material 3 and not the app's expressive moments. Use `CanvasLayout` with an admin `AppBar` top context bar, one dominant `MainSheet` workspace, a bottom `NavigationBar`, and **centered `AdminDialog` overlays for every workspace action and detail/inspection flow** (a garden jar's or a position's own page opens in place under its row, DL-113). The only exception: the **three global AppBar surfaces (Profile, Settings, Notifications) open a right-docked `AdminSideSheet`** on desktop. Type is **Plus Jakarta Sans** on a **linen canvas with white cards**, and buttons are **pills** on a **compact metric**. Every surface is **solid, not frosted**, except the translucent **nav dock** (the `NavigationBar` with its `FabButton`). **Workspace tint** is subtle atmosphere only. Prefer **workbench rows, lists, tabs, and inspectors** over nested cards. **Utility copy only.**

## One Language, a Denser Setting

The admin cockpit and the installed app speak one Warm Earth language. The cockpit's strict Material 3 rule is retired (DL-095): the cockpit sets the app's language denser, and keeps a few dials of its own because they serve stewards, not because Material 3 asks for them.

- **Shared with the app**: Plus Jakarta Sans with one set of type role names (DL-096); the linen canvas with white cards and one warm dark ladder (DL-097); the control-grade outline and one solid focus ring (DL-098); one count badge (DL-099); the app's equal-width tabs with the tinted active cell (DL-100); capsule chips with one selected fill (DL-101); one card surface and the shared item row (DL-102), which carries a jar's or a vault's amount in its right slot and opens the item's page in place (DL-113); the app's bottom sheet on phones (DL-104); one field anatomy, the label above an outlined box and a two-line message line (DL-105); the active-tab pill on the bottom bar (DL-107); solid surfaces (DL-108); one action picker of banner cards in a listbox (DL-111); and beneath them concentric geometry, spring motion tokens, role hierarchy (canvas/ink/stone/green accent), 4 disclosure layers and 5 Z-layers. Each shared piece that follows arrives with its decision-log row.
- **The cockpit's own dials**: Standard motion scheme (never Expressive); translucency restricted to the Navigation/FAB **Controlled Chrome**: flat 85% surface + 12px blur + warm ambient shadow + 1px ink ring (rules in `admin-m3-tokens.css`), never "liquid glass", while every dialog and side-sheet surface is solid and `MainSheet` is transparent; transparent admin `AppBar` root over the workspace canvas; the reduced admin radius scale 4/8/12/16/9999 plus the shared card's 24px corner (DL-102), where every button is a pill and the FAB is a capsule at both sizes (DL-010); the compact control metric 28/32/36/40/44 (DL-011: buttons 28/32/40, fields 44, toolbar pills 36); inline filter chips and sort in the toolbar (DL-082); a tone per workspace on a fixed budget (§ Workspace Tone below); Title Case action labels in en (DL-012); no organic/hero shapes; no decorative color.
- **What leaves with the rule**: each piece Material 3 used to justify gives way to the shared piece in its own change: the gray count chip, the underline tab rail, the 8px chip, elevation as a card's surface with the 12px card corner, the warm gray phone sheet and the filled field with an underline give way to the shared count badge, the app's equal-width tabs, capsule chips, the shared card, the app's bottom sheet and the outlined field (DL-099, DL-100, DL-101, DL-102, DL-104 and DL-105). Each lands in its own change, and until it does the component keeps its old anatomy, so check the component before relying on the new one; describe each piece as `packages/admin/DESIGN.md` does. The `--m3-*` token names stay as an internal layer.
- **Why**: stewards use both surfaces in one sitting. When the pieces they meet on both are the same, switching keeps one mental model, while density, pills, tones and navigation still say which surface they are on. Stewards scanning a queue need motion that aids, not entertains. The cockpit inherits warmth; it does not perform it.

If you would not ship a move on Linear, GitHub, or Stripe Dashboard, it does not belong in the cockpit, regardless of what the Warm Earth language permits in client flows.

## Overlays: Centered `AdminDialog` + the Three Global Side Sheets

The canonical admin overlay is the centered **`AdminDialog`** (M3 basic dialog: surface-container-high, a 32% scrim covering the **full viewport**, right-aligned M3 action row; on mobile the installed app's bottom sheet in the shared sheet material, white in light and the lifted card in dark, with a grip and the shared header, DL-104). It hosts **every** workspace action *and* every detail/inspection flow: work review, assessment, hypercert, action create/edit/detail, garden settings, member management, and a cookie jar's or a vault's Deposit, Withdraw and Claim. A garden jar's or a position's own page is the one detail that opens in place, under its row (DL-113).

- **Workspace side sheets stay retired.** The old `LeftSheet` / `RightSheet` / `BottomSheet` canvas inspectors are not a pattern. Never propose a slide-in side panel for a workspace detail or creation flow. Propose an `AdminDialog`. Because the dialog portals to `<body>` (out of the `[data-tone]` scope), always pass the workspace `tone`.
- **Controlled Chrome stays on Navigation/FAB only.** The only translucent chrome in the cockpit is the `NavigationBar` dock with its `FabButton`: a flat 85% surface with 12px blur, a warm ambient shadow, and a 1px ink ring (the Controlled Chrome contract in `admin-m3-tokens.css`, not "liquid glass"). The `AppBar` root and `MainSheet` are transparent; every dialog surface and the side sheet are solid M3, never frosted.
- **`AdminDialog` is still a mobile bottom-sheet** in its responsive presentation (it slides up from the bottom on narrow viewports). That is the dialog adapting, not the retired side-sheet system. Below 640px it takes the installed app's sheet: the shared sheet material, a grip that marks the sheet without dragging it, and, for the `standard` and `confirm` variants, the shared `SheetHeader` at the 22px dialog title, with an optional target line under the title for what a consequential act writes to, and no leading icon; `flow` and `palette` keep their own header under the grip (DL-104). Never propose the warm gray phone sheet. `SheetBody` / `SheetFooter` / `SheetDivider` survive as layout primitives *inside* a dialog or side-sheet body.
- Full-surface action flows (Submit Work, Create Assessment, Create Hypercert, Create/Edit Action) use `AdminDialog variant="flow"` + `className={ADMIN_FLOW_DIALOG_CLASS}` wrapping `ActionFlowShell`. See the size standard below (`xl`/`2xl` tiers no longer exist).

### Side sheets: the three global surfaces (shipped scope: do not extend)

**`AdminSideSheet`** is the M3 modal side sheet for the **three global AppBar surfaces only**: Profile, Settings, Notifications. It is AdminDialog's sibling (same scrim, tone prop and instant-exit handling; from 640px a hairline header and an absolute close button), with side-sheet geometry:

- **≥640px**: right-docked, full height, rounded inner (left) corners at 16px, slides in from the right edge; one shared width (`--canvas-right-sheet-width`, clamp 380–560px). Solid `--admin-surface-0` at elevation 2 (`--m3-elevation-2`) over the scrim, never glass.
- **<640px**: identical presentation to AdminDialog's mobile bottom sheet: the shared sheet material, the grip and the shared `SheetHeader` with Close on the title's line and no permanent rule; the panel's `SheetBody` shows a hairline only while it scrolls (DL-104). On mobile only the notification bell opens it: Profile and Settings live in the Profile tab (`/profile`, tabs **Profile | Settings**; the page reads Profile like the desktop sheet).
- **Global chrome tone**: these surfaces are account chrome, not workspace content, so they pass `tone="hub"` (neutral steward accent), never the active garden's tint.
- **Content contract**: panels own their body. Compose `SheetBody` (scrolling middle) and optionally `SheetFooter` (pinned bar) inside the sheet; the shell adds no padding, so panel and shell padding never stack.
- **Scope is enforced**: only `CanvasLayout` may render `<AdminSideSheet`, and the right-sheet registry is locked to the three content ids (`packages/admin/src/__tests__/components/AdminSideSheetStandard.guard.test.ts`). Adding a fourth side-sheet surface is a design decision, not a code edit.

### Dialog size & variant standard (shipped scale: do not invent tiers)

`AdminDialog` has a **3-tier size scale**. Size is a signal of what kind of action the dialog hosts, not a per-modal aesthetic choice (rationale comments live beside `sizeClasses` in `packages/admin/src/components/AdminDialog.tsx`):

| Size | Hosts | Examples |
|------|-------|----------|
| `sm` | Reserved for confirm/alert dialogs (`variant="confirm"` fixes its own width independent of size) | Discard changes?, destructive confirms |
| `md` (default) | A simple single-purpose action: one form, one concern | Add member, deposit, withdraw, edit one field |
| `lg` | Richer single-view content: lists with per-item actions, multi-field forms, multi-column layouts | Work detail, action create/edit, manage roles |

- **Multi-step flows are a category, not a size.** Submit Work / Create Assessment / Create Hypercert use `size="lg" variant="flow" className={ADMIN_FLOW_DIALOG_CLASS}`: a stable ~90dvh mobile sheet / 85dvh desktop card whose class constant lives beside `AdminDialog` so the three flows cannot drift. Never re-derive those dimensions per flow.
- **Variants:** `standard` (default) · `confirm` (use `AdminConfirmDialog`) · `palette` (command palette only) · `flow` (the three action flows).
- **Tone is required on workspace-owned dialogs.** The dialog portals to `<body>`, escaping the route's `[data-tone]` scope. Pass the workspace `tone` (`hub`/`garden`/`community`/`actions`) or the accent falls back to the neutral `home` default.
- **Never** pass an out-of-scale size (`xl`/`2xl` were removed in the three-tier collapse) or an ad-hoc `max-w-*` override; the only sanctioned width override is `ADMIN_FLOW_DIALOG_CLASS`. Enforced by `packages/admin/src/__tests__/components/AdminDialogStandard.guard.test.ts`.
- **Mobile modal safety is built in** (viewport-capped width + bottom-sheet presentation at 375px), so consumers must not restate `max-w-[calc(100vw-2rem)]`-style guards from `.claude/rules/frontend-design.md` Rule 14; the base component owns it.

## Action Surfaces Confirm Before Discarding

Any admin surface that holds **unsaved steward input** must guard its close:

- **Confirm-before-discard.** Closing a dirty form via the dialog's X / scrim / Escape (or navigating away from a route-mounted flow) raises a confirm ("Discard changes?"). Wire it with the shared **`useDirtyClose`** hook + the admin **`DiscardChangesDialog`**. An explicit footer **Cancel** may still exit directly.
- **In-flight async hard-blocks close.** While a submit / mint / transaction is pending, the dialog cannot be dismissed (`preventClose`: no X, no scrim-close, no Escape), so a write in progress is never orphaned by an accidental close.

## Hero Moments Live in the Client, Not the Cockpit

Hero moments (garden creation, first work submission, hypercert mint, vault deposit, seasonal transitions, assessment completion, role milestone) are a real part of the Warm Earth language (see [language.md § Hero Moments](./language.md#hero-moments)), but they **never happen on admin surfaces**. All seven hero flows are client-PWA-only.

When prompting admin UI:
- Do not say "hero moment", "hero section", or "celebration".
- Do not use the Expressive motion scheme.
- Do not lay translucent panels over vivid backgrounds.
- Status-milestone affirmation in admin is a quiet toast or row badge, not a celebration.

If a design tool emits a hero treatment in an admin screen, reject and regenerate with the stable prompt core.

## Required Vocabulary

> **Terminology authority**: cross-surface domain terms and personas live in [`green-goods-ontology.json`](../../../packages/shared/src/ontology/green-goods-ontology.json). The generated public [glossary](../../../docs/docs/reference/glossary.generated.mdx) explains that vocabulary. The table below is admin-specific component and cockpit vocabulary.

Use these terms when describing admin UI:

| Term | Meaning |
|------|---------|
| `restrained steward cockpit` | Admin identity anchor: always lead with this |
| `CanvasLayout` | The top-level grid: AppBar + MainSheet + NavigationBar |
| `command surface` | Hub and Actions: primary control surfaces |
| `data landscape` | Garden: monitoring and exploration |
| `single-mode operations surface` | Community: single dominant workflow |
| `AdminDialog inspector` | Centered overlay for config & alerts (notifications, settings, account) **and** every detail/inspection flow; full-viewport scrim, bottom-sheet on mobile |
| `ActionFlowShell` | Full-surface creation/commit flows (Submit Work, Create Assessment, Create Hypercert, Create/Edit Action): inner chrome of a centered `AdminDialog` (`variant="flow"` + `ADMIN_FLOW_DIALOG_CLASS`); bottom-sheet on mobile |
| `workspace tint` | Subtle atmospheric color: Hub=blue, Garden=green, Community=orange, Actions=purple |
| `workbench list` | Primary data surface inside MainSheet |
| `stage rail` | Inline secondary actions/filters adjacent to the workspace |
| `view rail` | Collapsible navigation rail when the AppBar is tight |
| `utility copy` | Terse, action-oriented text, not marketing, not brand |

## Never Use (in admin prompts)

> **Machine policy**: the full admin-banned phrase list lives in [`scripts/data/banned-vocabulary.json`](../../../scripts/data/banned-vocabulary.json) (`prompt_vocabulary_admin_banned`). `bun run check --only vocabulary` reads the same file for lint-enforced cross-surface terms.

The categories below are contract-specific framing: *why* admin output should reject these patterns. The exact phrase set is the glossary's job:

- **Hero / celebration framing**: hero moments belong to the client PWA, never the cockpit.
- **Marketing / promo framing**: admin is steward-internal; no banners, no landing-page energy.
- **Gallery / mosaic / floating-stats framing**: admin shows workbench rows and inspectors, not curated visual layouts.
- **Decorative gradient framing**: decoration without function; admin uses solid surfaces.
- **Glass / liquid / frosted framing**: the only translucent chrome is the Navigation/FAB Controlled Chrome (flat 85% surface + 12px blur + warm shadow + 1px ink ring), never phrased as "liquid glass"; the AppBar root and `MainSheet` remain transparent; dense surfaces, every dialog, and the side sheet must be solid.

## Materials & Motion (admin)

- **The app's language, set denser**: the shared pieces at the cockpit's compact metric, pill buttons, the admin shape scale, and state layers (8%/12%/12%/16%) for hover, focus and press.
- **Spring motion**: the only easing. Uses `--spring-*` tokens.
- **Controlled Chrome is restricted** to Navigation/FAB: flat 85% surface (`rgb(var(--admin-surface-0)/0.85)`) + 12px blur + warm ambient shadow + 1px ink ring, per the Controlled Chrome contract in `admin-m3-tokens.css`. Do not call it "liquid glass". The admin `AppBar` root and `MainSheet` are transparent; all dialog surfaces and the `AdminSideSheet` are solid.
- **Typography**: Plus Jakarta Sans across the cockpit.

### Motion Scheme

Admin uses the **Standard** motion scheme only, never Expressive. Route content, canvas tone
changes, FAB menus, dialogs, and interaction state ride the admin motion role aliases
(`--admin-motion-*`) layered on the canonical `--spring-*` tokens. The full two-scheme spec
(token table, durations, when Expressive is permitted on client surfaces) is canonical in
[language.md § Motion System](./language.md#motion-system): reference it, don't restate values.

### Workspace Tone

Each workspace carries an accent hue (Hub=blue, Garden=green, Community=orange, Actions=purple),
but the canvas itself never tints: it stays constant linen (`--m3-surface-container-low`) in
light and m3 surface in dark. Tone spends a **6-use budget**: (1) the active tab: its 10% tint,
label and underline (DL-100), (2) the active nav pill (`--tone-primary-container` / `--tone-on-primary-container`), (3) the
single filled header action (`--tone-action`), (4) the nav-shell FAB fill (`Shell/FabButton`), the
one tone-filled control in the floating chrome, (5) the count badge on every tab of the rail
(the shared `CountBadge` on `--tone-on-surface-accent`, DL-099), and (6) a selected filter chip
(`AdminFilterChip` on `--tone-action` with `--tone-on-action`, DL-101). Outside the budget, a
faint canvas wash (`--tone-surface-tint-color`, 5% light / 10% dark) fades to transparent by
320px. The
mechanism is a `[data-tone]` attribute on the CanvasLayout root that sets the surviving
`--tone-*` roles: `--tone-action`,
`--tone-on-surface-accent`, `--tone-primary-container` / `--tone-on-primary-container`, and
`--tone-surface-tint-color` (workspace palettes live in `admin-m3-tokens.css`); components read
`var(--tone-action, var(--m3-primary))` so they fall back to the M3 accent when unscoped.
**Portals escape the scope**: anything portaled to `<body>` (dialogs, poppers) must re-establish
tone via the `tone` prop or it silently falls back. Anything beyond the six sanctioned uses is
drift: never content surfaces, never extra washes.

### Never rename `--color-primary`

The codebase token `--color-primary` resolves to the **tertiary accent role** (garden green,
1-3% volume), not the primary ink role. It is a historical internal name; role vocabulary lives
in the docs, the token stays as-is. Do not "fix" the name, and do not reach for it as if it were
the dominant brand color.

## Copy Voice

Admin copy is **utility-only**. Status language and task framing, never marketing, never narrative.

**Patterns:**
- **Headers** take functional nouns: "Review Queue", "Garden Settings", "Member Activity".
- **Status text** gives counts + state: "3 pending · 1 flagged · 12 approved".
- **Actions** are verb-first and Title Case (DL-012): "Approve", "Request Changes", "Flag for Review".
- **Empty states** give a terse acknowledgment: "No items in queue", not "Get started by adding…".

**Say:** "3 submissions pending review. 1 flagged for follow-up." / "Approve" / "Request Changes"

**Don't say:** "Welcome back!" / "Let's review some great work" / "You're crushing it"

The admin speaks **about the work, to the steward**. The client speaks **to the community, about the work**. Same garden, different dialects. Cross-surface voice pillars and terminology live in the root [`DESIGN.md § Voice & Copy`](../../../DESIGN.md#voice--copy).

## Canonical Component Palette

AI design tools MUST map generated output to these existing exports. Do not invent component names. Flag missing primitives instead.

**Layout shell**: `AppBar`, `MainSheet`, and `NavigationBar` (+ the FAB dock) live in the forked shell `packages/admin/src/components/Shell/` (styling in JSX); `packages/admin/src/components/Layout/` keeps `CanvasLayout`, `PageHeader`, `CanvasRouteFrame`, and the rest:

| Component | Role |
|-----------|------|
| `CanvasLayout` | CSS Grid root with named areas: `canvas-area-top`, `canvas-area-bottom`, inner cells |
| `AppBar` | Admin top context bar, Z3: garden context, search, and the three global actions (notifications, settings, profile) that open side sheets; transparent root over the workspace canvas |
| `MainSheet` | Z2: dominant workspace; stays visually at rest while centered workspace dialogs open |
| `ActionFlowShell` | Full-surface action-flow chrome: pinned header + scrolling body + pinned footer; rendered inside a centered `AdminDialog` (`variant="flow"` + `ADMIN_FLOW_DIALOG_CLASS`), bottom-sheet on mobile |
| `AdminDialog` | Centered overlay for **every** workspace action and detail/inspection flow (config, alerts, work/assessment/hypercert/action detail, create/edit). Full-viewport scrim; bottom-sheet on mobile; pass workspace `tone`. Replaces the retired `LeftSheet`/`RightSheet`/`BottomSheet` for workspace flows. |
| `AdminSideSheet` | Right-docked modal side sheet for **only** the three global AppBar surfaces (Profile, Settings, Notifications). Bottom-sheet presentation on mobile (bell only); `tone="hub"`; scope enforced by `AdminSideSheetStandard.guard`. |
| `NavigationBar` | Bottom workspace tabs: Hub, Garden, Community, Actions (+ mobile-only Profile tab); symbol-first; role-adaptive |
| `FabButton` (`Shell/FabButton`) | Per-workspace primary action in the nav shell, a capsule at both sizes (`rounded-full`): 48px dock circle, 56px extended floating capsule with label (DL-010); integrated via `FabProvider` |

**Admin wrappers** (exported from `packages/admin/src/components/Admin*.tsx`, where the filesystem is the roster of record; 25 wrappers across 21 files today, since `AdminConfirmDialog` lives in `AdminDialog.tsx`, `AdminIconButton` in `AdminButton.tsx`, and `AdminSelect`/`AdminTextArea` in `AdminTextField.tsx`; `AdminLoadingScreen` and `AdminSignIn` are screens, not wrappers):

`AdminButton` · `AdminCard` · `AdminCheckbox` · `AdminChoiceGroup` · `AdminConfirmDialog` · `AdminDialog` · `AdminFieldGroup` · `AdminFilterChip` · `AdminIconButton` · `AdminInlineField` · `AdminInputChip` · `AdminLinearProgress` · `AdminListRow` · `AdminReasonDialog` · `AdminSearchToolbar` · `AdminSelect` · `AdminSelectableCard` · `AdminSettingRow` · `AdminSideSheet` · `AdminSortSelect` · `AdminTabRail` · `AdminTextArea` · `AdminTextField` · `AdminTooltip` · `AdminViewActions`

Form selects use `AdminSelect` (full field anatomy, the label above, chevron slot, empty-value option as the placeholder row); `AdminSortSelect` is the toolbar sort pill only, never a form control.

**Field anatomy** (DL-105): one look, the installed app's: the label above an outlined 8px box, then a message line that reserves two lines. The filled field with its underline is retired, and so is the `variant` prop. Full-size fields share the responsive tier (44px with 16px text on touch widths, 40px with 14px from 640px), and `AdminInlineField` stays on its 32px inline axis. Every field shares one error anatomy: the label and the ring recolor to `--m3-error`, with the message on the reserved line (`AdminInlineField` and `AdminFieldGroup` included). The shared `FileUploadField` still puts its help above the upload well.

(`AdminBadge`, `AdminFab`, and `AdminListItem` were deleted 2026-08-29. Do not reintroduce them; the nav-shell FAB is `Shell/FabButton`.)

All sit on the compact metric and the reduced admin shape scale, 4/8/12/16/9999 (`--m3-shape-xs/sm/md/lg/full`), except `AdminCard`, which takes the shared card's 24px corner from `.gg-card` (DL-102). Do not override dimensions, state layers, or shape scale.

**Shared primitives** (import from `@green-goods/shared`):
- Admin dashboard dialogs use `AdminDialog` / `AdminConfirmDialog` (centered M3, scrim, pinned `actions`; `palette` variant for the command palette, `flow` variant + `ADMIN_FLOW_DIALOG_CLASS` for full-surface action flows). `DialogShell` is for shared or non-admin (client PWA) surfaces only. Do not use it for admin dashboard dialogs. See the admin.mdx Dialog Contract.
- Identity / data display: `AddressDisplay`, `StatusBadge`, `Alert`. (`DomainBadge` stays a client primitive: admin renders a neutral white/90 domain chip on `HubWorkCard` instead.)

**Reference composition**: `/hub` route. Model new admin surfaces on it. `DashboardLayout` / `Sidebar` / `Header` are legacy. Do not start from them.

## Companion Files

- [language.md](./language.md): Full Warm Earth design language (shapes, motion, color, hero moments, material behaviors)
- [ai-ui-brief.md](./ai-ui-brief.md): Reusable AI UI/CSS build brief and external reference role map
- [SKILL.md](./SKILL.md): Design philosophy, paradigms, admin carve-out
- Root `DESIGN.md`: Canonical Warm Earth DesignMD tokens + creative brief
- `packages/admin/DESIGN.md`: Admin-specific DesignMD dialect

## Why This Contract Exists

The admin cockpit and the installed app speak one Warm Earth language at two densities. Without an explicit contract, AI design tools either blend in the app's expressive moments and produce admin screens with marketing-page energy (hero banners, decorative gradients, oversized CTAs), or fall back on generic Material 3 and draw a second product. This file gives the tools a tight vocabulary that reinforces the cockpit identity every time.

Originated in Codex review (2026-04-15) after the admin revamp stabilized on strict M3, and rewritten when that rule was retired (DL-095). Previously lived in user memory (`project_design_direction.md`) but belonged in the skill itself so any agent (not just the main Claude session) can enforce it.
