# AI Prompt Contract — Admin Surface

Stable vocabulary and never-use list for prompting AI design tools or coding agents to generate admin UI that aligns with the Green Goods cockpit.

> **Companion**: The `client` surface uses a warmer, more expressive palette of vocabulary anchored in the root `DESIGN.md`. This file is admin-specific — operator cockpit framing.

## Stable Prompt Core

Paste this sentence (or a trimmed version) into every AI design prompt for admin surfaces:

> Green Goods admin is a **restrained operator cockpit** expressing the **Warm Earth** design language through M3 anatomy — not raw M3, and not the expressive client dialect. Use `CanvasLayout` with an admin `AppBar` top context bar, one dominant `MainSheet` workspace, a bottom `NavigationBar`, and **centered `AdminDialog` overlays for every action and detail/inspection flow** (side sheets are retired). Components follow **Material 3 anatomy** with **Plus Jakarta Sans**. Dense surfaces are **solid, not frosted**. **Workspace tint** is subtle atmosphere only. Prefer **workbench rows, lists, tabs, and inspectors** over nested cards. **Utility copy only.**

## Admin is Restrained Warm Earth, Not Raw M3

The admin cockpit and the client PWA are both Warm Earth. The difference is expressiveness, not foundation:

- **Shared baseline**: concentric geometry, spring motion tokens, role hierarchy (canvas/ink/stone/green accent), 4 disclosure layers, 5 Z-layers, material system.
- **Admin subset**: Standard motion scheme (never Expressive), glass restricted to Navigation/FAB (sheet shells retired), transparent admin `AppBar` root over the workspace canvas, capsule shape only for primary CTAs/FABs, solid surfaces over blur everywhere else (including every dialog surface), no organic/hero shapes, no decorative color.
- **Why**: operators scanning a queue need motion that aids, not entertains. The cockpit inherits warmth; it does not perform it.

If you would not ship a move on Linear, GitHub, or Stripe Dashboard, it does not belong in the cockpit — regardless of what the Warm Earth language permits in client flows.

## Overlays: Centered `AdminDialog` Everywhere

The canonical admin overlay is the centered **`AdminDialog`** (M3 basic dialog: surface-container-high, a 32% scrim covering the **full viewport**, right-aligned M3 action row, bottom-sheet on mobile). It hosts **every** admin action *and* every detail/inspection flow — work review, assessment, hypercert, action create/edit/detail, garden settings, member management, notifications, profile, settings, cookie jar, vault.

- **Side sheets are retired.** The old `LeftSheet` / `RightSheet` / `BottomSheet` canvas inspectors are no longer a pattern. Never propose a slide-in side panel for a detail or creation flow — propose an `AdminDialog`. Because the dialog portals to `<body>` (out of the `[data-tone]` scope), always pass the workspace `tone`.
- **Glass stays on Navigation/FAB only.** With sheet shells gone, the only glass surfaces in the cockpit are the `NavigationBar` and `AdminFab`. The `AppBar` root and every dialog surface are solid M3 — never frosted.
- **`AdminDialog` is still a mobile bottom-sheet** in its responsive presentation (it slides up from the bottom on narrow viewports). That is the dialog adapting — not the retired side-sheet system. `SheetBody` / `SheetFooter` / `SheetDivider` survive as layout primitives *inside* a dialog body.
- Full-surface action flows (Submit Work, Create Assessment, Create Hypercert, Create/Edit Action) use `AdminDialog variant="flow"` + `className={ADMIN_FLOW_DIALOG_CLASS}` wrapping `ActionFlowShell` — see the size standard below (`xl`/`2xl` tiers no longer exist).

### Dialog size & variant standard (shipped scale — do not invent tiers)

`AdminDialog` has a **3-tier size scale**. Size is a signal of what kind of action the dialog hosts, not a per-modal aesthetic choice (rationale comments live beside `sizeClasses` in `packages/admin/src/components/AdminDialog.tsx`):

| Size | Hosts | Examples |
|------|-------|----------|
| `sm` | Reserved for confirm/alert dialogs (`variant="confirm"` fixes its own width independent of size) | Discard changes?, destructive confirms |
| `md` (default) | A simple single-purpose action — one form, one concern | Add member, deposit, withdraw, edit one field |
| `lg` | Richer single-view content — lists with per-item actions, multi-field forms, multi-column layouts | Work detail, action create/edit, manage roles |

- **Multi-step flows are a category, not a size.** Submit Work / Create Assessment / Create Hypercert use `size="lg" variant="flow" className={ADMIN_FLOW_DIALOG_CLASS}` — a stable ~90dvh mobile sheet / 85dvh desktop card whose class constant lives beside `AdminDialog` so the three flows cannot drift. Never re-derive those dimensions per flow.
- **Variants:** `standard` (default) · `confirm` (use `AdminConfirmDialog`) · `palette` (command palette only) · `flow` (the three action flows).
- **Tone is required on workspace-owned dialogs.** The dialog portals to `<body>`, escaping the route's `[data-tone]` scope — pass the workspace `tone` (`hub`/`garden`/`community`/`actions`) or the accent falls back to the neutral `home` default.
- **Never** pass an out-of-scale size (`xl`/`2xl` were removed in the three-tier collapse) or an ad-hoc `max-w-*` override; the only sanctioned width override is `ADMIN_FLOW_DIALOG_CLASS`. Enforced by `packages/admin/src/__tests__/components/AdminDialogStandard.guard.test.ts`.
- **Mobile modal safety is built in** (viewport-capped width + bottom-sheet presentation at 375px) — consumers must not restate `max-w-[calc(100vw-2rem)]`-style guards from `.claude/rules/frontend-design.md` Rule 14; the base component owns it.

## Action Surfaces Confirm Before Discarding

Any admin surface that holds **unsaved operator input** must guard its close:

- **Confirm-before-discard.** Closing a dirty form via the dialog's X / scrim / Escape (or navigating away from a route-mounted flow) raises a confirm ("Discard changes?"). Wire it with the shared **`useDirtyClose`** hook + the admin **`DiscardChangesDialog`**. An explicit footer **Cancel** may still exit directly.
- **In-flight async hard-blocks close.** While a submit / mint / transaction is pending, the dialog cannot be dismissed (`preventClose`) — no X, no scrim-close, no Escape — so a write in progress is never orphaned by an accidental close.

## Hero Moments Live in the Client, Not the Cockpit

Hero moments (garden creation, first work submission, hypercert mint, vault deposit, seasonal transitions, assessment completion, role milestone) are a real part of the Warm Earth language — see [language.md § Hero Moments](./language.md#hero-moments) — but they **never happen on admin surfaces**. All seven hero flows are client-PWA-only.

When prompting admin UI:
- Do not say "hero moment", "hero section", or "celebration".
- Do not use the Expressive motion scheme.
- Do not use dramatic material pairings (ultrathin glass over vivid background).
- Status-milestone affirmation in admin is a quiet toast or row badge, not a celebration.

If a design tool emits a hero treatment in an admin screen, reject and regenerate with the stable prompt core.

## Required Vocabulary

> **Canonical glossary**: cross-surface domain terms (Garden, Action, Work, Assessment, Hypercert, Vault, Cookie Jar, Attestation, Hat, Season) and personas (Gardener, Operator, Evaluator, Funder, Community Member) live in [`docs/docs/reference/glossary-community.md § Design Vocabulary`](../../../docs/docs/reference/glossary-community.md#design-vocabulary). The table below is admin-specific component / cockpit vocabulary that does not live there.

Use these terms when describing admin UI:

| Term | Meaning |
|------|---------|
| `restrained operator cockpit` | Admin identity anchor — always lead with this |
| `CanvasLayout` | The top-level grid: AppBar + MainSheet + NavigationBar |
| `command surface` | Hub and Actions — primary control surfaces |
| `data landscape` | Garden — monitoring and exploration |
| `single-mode operations surface` | Community — single dominant workflow |
| `AdminDialog inspector` | Centered overlay for config & alerts (notifications, settings, account) **and** every detail/inspection flow; full-viewport scrim, bottom-sheet on mobile |
| `ActionFlowShell` | Full-surface creation/commit flows (Submit Work, Create Assessment, Create Hypercert, Create/Edit Action) — inner chrome of a centered `AdminDialog` (`variant="flow"` + `ADMIN_FLOW_DIALOG_CLASS`); bottom-sheet on mobile |
| `workspace tint` | Subtle atmospheric color — Hub=blue, Garden=green, Community=orange, Actions=red |
| `workbench list` | Primary data surface inside MainSheet |
| `stage rail` | Inline secondary actions/filters adjacent to the workspace |
| `view rail` | Collapsible navigation rail when the AppBar is tight |
| `utility copy` | Terse, action-oriented text — not marketing, not brand |

## Never Use (in admin prompts)

> **Canonical source**: the full admin-banned phrase list lives in [`docs/docs/reference/glossary-community.md § Admin-Only Banned (AI Prompt Vocabulary)`](../../../docs/docs/reference/glossary-community.md#admin-only-banned-ai-prompt-vocabulary) and in [`docs/docs/reference/banned-vocabulary.json`](../../../docs/docs/reference/banned-vocabulary.json) (`prompt_vocabulary_admin_banned`). Lint-enforced cross-surface bans live in the same glossary § Lint-Enforced section — `bun run lint:vocab` parses the JSON.

The categories below are contract-specific framing — *why* admin output should reject these patterns. The exact phrase set is the glossary's job:

- **Hero / celebration framing** — hero moments belong to the client PWA, never the cockpit.
- **Marketing / promo framing** — admin is operator-internal; no banners, no landing-page energy.
- **Gallery / mosaic / floating-stats framing** — admin shows workbench rows and inspectors, not curated visual layouts.
- **Decorative gradient framing** — decoration without function; admin uses solid surfaces.
- **Glass / liquid / frosted outside Navigation/FAB** — sheet shells are retired; the AppBar root remains transparent; dense surfaces and every dialog must be solid.

## Materials & Motion (admin)

- **M3 strict anatomy** (v0.192) — exact dimensions, state layers (8%/12%/12%/16%), shapes, color roles.
- **Spring motion** — the single permitted deviation from M3 standard easing. Uses `--spring-*` tokens.
- **Glass is restricted** to Navigation/FAB. Sheet shells are retired; the admin `AppBar` root and all dialog surfaces remain solid.
- **Typography** — Plus Jakarta Sans across the cockpit.

### Motion Scheme

Admin uses the **Standard** motion scheme only — never Expressive. Route content, canvas tone
changes, FAB menus, dialogs, and interaction state ride the admin motion role aliases
(`--admin-motion-*`) layered on the canonical `--spring-*` tokens. The full two-scheme spec
(token table, durations, when Expressive is permitted on client surfaces) is canonical in
[language.md § Motion System](./language.md#motion-system) — reference it, don't restate values.

### Workspace Tone

Each workspace tints its canvas: Hub=blue, Garden=green, Community=orange, Actions=red. The
mechanism is a `[data-tone]` attribute on the CanvasLayout root that sets the `--tone-*` custom
properties (`--tone-canvas`, `--tone-action`, `--tone-on-surface-accent`); components read
`var(--tone-action, var(--m3-primary))` so they fall back to the M3 accent when unscoped.
**Portals escape the scope** — anything portaled to `<body>` (dialogs, poppers) must re-establish
tone via the `tone` prop or it silently falls back. Tint is atmosphere only (canvas + subtle
accents), never content surfaces.

### Never rename `--color-primary`

The codebase token `--color-primary` resolves to the **tertiary accent role** (garden green,
1-3% volume) — not the primary ink role. It is a historical internal name; role vocabulary lives
in the docs, the token stays as-is. Do not "fix" the name, and do not reach for it as if it were
the dominant brand color.

## Copy Voice

Admin copy is **utility-only**. Status language and task framing — never marketing, never narrative.

**Patterns:**
- **Headers** — functional nouns: "Review Queue", "Garden Settings", "Member Activity".
- **Status text** — counts + state: "3 pending · 1 flagged · 12 approved".
- **Actions** — verb-first: "Approve", "Request changes", "Flag for review".
- **Empty states** — terse acknowledgement: "No items in queue", not "Get started by adding…".

**Say:** "3 submissions pending review. 1 flagged for follow-up." / "Approve" / "Request changes"

**Don't say:** "Welcome back!" / "Let's review some great work" / "You're crushing it"

The admin speaks **about the work, to the operator**. The client speaks **to the community, about the work**. Same garden, different dialects. Cross-surface voice pillars and terminology live in the root [`DESIGN.md § Voice & Copy`](../../../DESIGN.md#voice--copy).

## Canonical Component Palette

AI design tools MUST map generated output to these existing exports. Do not invent component names — flag missing primitives instead.

**Layout shell** (`packages/admin/src/components/Layout/`):

| Component | Role |
|-----------|------|
| `CanvasLayout` | CSS Grid root — named areas: `canvas-area-top`, `canvas-area-bottom`, inner cells |
| `AppBar` | Admin top context bar, Z3 — garden context, search, settings, avatar; transparent root over the workspace canvas |
| `MainSheet` | Z2 — dominant workspace; `isReceded` prop triggers canvas recession on sheet open |
| `ActionFlowShell` | Full-surface action-flow chrome — pinned header + scrolling body + pinned footer; rendered inside a centered `AdminDialog` (`variant="flow"` + `ADMIN_FLOW_DIALOG_CLASS`), bottom-sheet on mobile |
| `AdminDialog` | Centered overlay — **every** action and detail/inspection flow (config, alerts, profile, settings, notifications, work/assessment/hypercert/action detail, create/edit). Full-viewport scrim; bottom-sheet on mobile; pass workspace `tone`. Replaces the retired `LeftSheet`/`RightSheet`/`BottomSheet`. |
| `NavigationBar` | Bottom workspace tabs — Hub, Garden, Community, Actions; symbol-first; role-adaptive |
| `AdminFab` | Per-workspace primary action, capsule shape, integrated via `FabProvider` |

**M3 wrappers** (`packages/admin/src/components/Admin*.tsx` — the filesystem is the count of record; 15 today):

`AdminBadge` · `AdminButton` · `AdminCard` · `AdminCheckbox` · `AdminDialog` · `AdminFab` · `AdminFilterChip` · `AdminLinearProgress` · `AdminListItem` · `AdminSearchToolbar` · `AdminSortSelect` · `AdminTabRail` · `AdminTextField` · `AdminTooltip` · `AdminViewActions`

All follow M3 v0.192 anatomy exactly — do not override dimensions, state layers, or shape scale.

**Shared primitives** (import from `@green-goods/shared`):
- Admin dashboard dialogs use `AdminDialog` / `AdminConfirmDialog` (centered M3, scrim, pinned `actions`; `palette` variant for the command palette, `flow` variant + `ADMIN_FLOW_DIALOG_CLASS` for full-surface action flows). `DialogShell` is for shared or non-admin (client PWA) surfaces only — do not use it for admin dashboard dialogs. See the admin.mdx Dialog Contract.
- Identity / data display: `AddressDisplay`, `DomainBadge`, `StatusBadge`, `Alert`.

**Reference composition**: `/hub` route. Model new admin surfaces on it. `DashboardLayout` / `Sidebar` / `Header` are legacy — do not start from them.

## Companion Files

- [language.md](./language.md) — Full Warm Earth design language (shapes, motion, color, hero moments, material behaviors)
- [ai-ui-brief.md](./ai-ui-brief.md) — Reusable AI UI/CSS build brief and external reference role map
- [SKILL.md](./SKILL.md) — Design philosophy, paradigms, admin carve-out
- Root `DESIGN.md` — Canonical Warm Earth DesignMD tokens + creative brief
- `packages/admin/DESIGN.md` — Admin-specific DesignMD dialect

## Why This Contract Exists

The admin cockpit and the client PWA speak different dialects of the same Warm Earth language. Without an explicit contract, AI design tools blend the two and produce admin screens with marketing-page energy — hero banners, decorative gradients, oversized CTAs. This file gives the tools a tight vocabulary that reinforces the cockpit identity every time.

Originated in Codex review (2026-04-15) after the admin revamp stabilized on strict M3. Previously lived in user memory (`project_design_direction.md`) but belonged in the skill itself so any agent — not just the main Claude session — can enforce it.
