# AI Prompt Contract — Admin Surface

Stable vocabulary and never-use list for prompting AI design tools or coding agents to generate admin UI that aligns with the Green Goods cockpit.

> **Companion**: The `client` surface uses a warmer, more expressive palette of vocabulary anchored in the root `DESIGN.md`. This file is admin-specific — operator cockpit framing.

## Stable Prompt Core

Paste this sentence (or a trimmed version) into every AI design prompt for admin surfaces:

> Green Goods admin is a **restrained operator cockpit** expressing the **Warm Earth** design language through M3 anatomy — not raw M3, and not the expressive client dialect. Use `CanvasLayout` with an admin `AppBar` top context bar, one dominant `MainSheet` workspace, a bottom `NavigationBar`, and sheet-based inspectors for detail flows. Components follow **Material 3 anatomy** with **Plus Jakarta Sans**. Dense surfaces are **solid, not frosted**. **Workspace tint** is subtle atmosphere only. Prefer **workbench rows, lists, tabs, and inspectors** over nested cards. **Utility copy only.**

## Admin is Restrained Warm Earth, Not Raw M3

The admin cockpit and the client PWA are both Warm Earth. The difference is expressiveness, not foundation:

- **Shared baseline**: concentric geometry, spring motion tokens, role hierarchy (canvas/ink/stone/green accent), 4 disclosure layers, 5 Z-layers, material system.
- **Admin subset**: Standard motion scheme (never Expressive), glass restricted to Navigation/FAB and sheet shells, transparent admin `AppBar` root over the workspace canvas, capsule shape only for primary CTAs/FABs, solid surfaces over blur everywhere else, no organic/hero shapes, no decorative color.
- **Why**: operators scanning a queue need motion that aids, not entertains. The cockpit inherits warmth; it does not perform it.

If you would not ship a move on Linear, GitHub, or Stripe Dashboard, it does not belong in the cockpit — regardless of what the Warm Earth language permits in client flows.

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
| `RightSheet inspector` | Config & alerts (notifications, settings, account) |
| `BottomSheet inspector` | Detail flows on mobile |
| `LeftSheet inspector` | Registry create/edit (e.g. Action create/edit) |
| `ActionFlowShell` | Full-surface creation/commit flows (Submit Work, Create Assessment, Create Hypercert) — inner chrome of a centered `AdminDialog` (`size="2xl" variant="flow"`); bottom-sheet on mobile |
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
- **Glass / liquid / frosted outside Navigation/FAB and sheet shells** — the AppBar root remains transparent; dense surfaces must be solid.

## Materials & Motion (admin)

- **M3 strict anatomy** (v0.192) — exact dimensions, state layers (8%/12%/12%/16%), shapes, color roles.
- **Spring motion** — the single permitted deviation from M3 standard easing. Uses `--spring-*` tokens.
- **Glass is restricted** to Navigation/FAB and sheet shells. The admin `AppBar` root remains transparent.
- **Typography** — Plus Jakarta Sans across the cockpit.

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
| `ActionFlowShell` | Full-surface action-flow chrome — pinned header + scrolling body + pinned footer; rendered inside a centered `AdminDialog` (`size="2xl" variant="flow"`), bottom-sheet on mobile |
| `LeftSheet` | Registry create/edit (Action create/edit) and inspector-bound creation |
| `RightSheet` | Config, alerts, profile, settings, notifications |
| `BottomSheet` | Mobile detail flows |
| `NavigationBar` | Bottom workspace tabs — Hub, Garden, Community, Actions; symbol-first; role-adaptive |
| `AdminFab` | Per-workspace primary action, capsule shape, integrated via `FabProvider` |

**M3 wrappers** (`packages/admin/src/components/Admin*.tsx`, 13 total):

`AdminBadge` · `AdminButton` · `AdminCard` · `AdminCheckbox` · `AdminDialog` · `AdminFab` · `AdminFilterChip` · `AdminLinearProgress` · `AdminListItem` · `AdminSearchToolbar` · `AdminTabRail` · `AdminTextField` · `AdminTooltip`

All follow M3 v0.192 anatomy exactly — do not override dimensions, state layers, or shape scale.

**Shared primitives** (import from `@green-goods/shared`):
- Admin dashboard dialogs use `AdminDialog` / `AdminConfirmDialog` (centered M3, scrim, pinned `actions`; `palette` variant for the command palette, `flow` variant at `size="2xl"` for full-surface action flows). `DialogShell` is for shared or non-admin (client PWA) surfaces only — do not use it for admin dashboard dialogs. See the admin.mdx Dialog Contract.
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
