# AI Prompt Contract — Admin Surface

Stable vocabulary and never-use list for prompting AI design tools (Stitch, Antigravity, Claude Design, Figma Make) to generate admin UI that aligns with the Green Goods cockpit.

> **Companion**: The `client` surface uses a warmer, more expressive palette of vocabulary anchored in the root `DESIGN.md`. This file is admin-specific — operator cockpit framing.

## Stable Prompt Core

Paste this sentence (or a trimmed version) into every AI design prompt for admin surfaces:

> Green Goods admin is a **restrained operator cockpit** expressing the **Warm Earth** design language through M3 anatomy — not raw M3, and not the expressive client dialect. Use `CanvasLayout` with a `TopContextBar`, one dominant `MainSheet` workspace, a bottom `NavigationBar`, and sheet-based inspectors for detail flows. Components follow **Material 3 anatomy** with **Plus Jakarta Sans**. Dense surfaces are **solid, not frosted**. **Workspace tint** is subtle atmosphere only. Prefer **workbench rows, lists, tabs, and inspectors** over nested cards. **Utility copy only.**

## Admin is Restrained Warm Earth, Not Raw M3

The admin cockpit and the client PWA are both Warm Earth. The difference is expressiveness, not foundation:

- **Shared baseline**: concentric geometry, spring motion tokens, role hierarchy (canvas/ink/stone/green accent), 4 disclosure layers, 5 Z-layers, material system.
- **Admin subset**: Standard motion scheme (never Expressive), glass restricted to `TopContextBar`, capsule shape only for primary CTAs/FABs, solid surfaces over blur everywhere else, no organic/hero shapes, no decorative color.
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

Use these terms when describing admin UI:

| Term | Meaning |
|------|---------|
| `restrained operator cockpit` | Admin identity anchor — always lead with this |
| `CanvasLayout` | The top-level grid: TopContextBar + MainSheet + NavigationBar |
| `command surface` | Hub and Actions — primary control surfaces |
| `data landscape` | Garden — monitoring and exploration |
| `single-mode operations surface` | Community — single dominant workflow |
| `RightSheet inspector` | Config & alerts (notifications, settings, account) |
| `BottomSheet inspector` | Detail flows on mobile |
| `LeftSheet inspector` | Creation flows (submit work, create assessment, mint) |
| `workspace tint` | Subtle atmospheric color — Hub=blue, Garden=green, Community=orange, Actions=red |
| `workbench list` | Primary data surface inside MainSheet |
| `stage rail` | Inline secondary actions/filters adjacent to the workspace |
| `view rail` | Collapsible navigation rail when TopContextBar is tight |
| `utility copy` | Terse, action-oriented text — not marketing, not brand |

## Never Use (in admin prompts)

These terms signal promotional, marketing, or brand-surface framing and produce incoherent admin output:

- `hero section` / `hero moment` (hero moments are reserved for celebratory client PWA flows)
- `marketing banner` / `promo band`
- `gallery` / `masonry gallery`
- `dashboard card mosaic` / `feature cards`
- `decorative gradient` / `ambient gradient wash`
- `floating stats` / `stat chips floating above content`
- `landing-page` framing of any kind
- Any `liquid`, `glass`, or `frosted` treatment applied outside of `TopContextBar` — dense surfaces must be solid

## Materials & Motion (admin)

- **M3 strict anatomy** (v0.192) — exact dimensions, state layers (8%/12%/12%/16%), shapes, color roles.
- **Spring motion** — the single permitted deviation from M3 standard easing. Uses `--spring-*` tokens.
- **Glass is restricted** to `TopContextBar` only.
- **Typography** — Plus Jakarta Sans across the cockpit.

## Companion Files

- [language.md](./language.md) — Full Warm Earth design language (shapes, motion, color, hero moments, material behaviors)
- [SKILL.md](./SKILL.md) — Design philosophy, paradigms, admin carve-out
- Root `DESIGN.md` — Aesthetic direction (Warm Earth) + surface-agnostic tokens
- `packages/admin/DESIGN.md` — Admin-specific design system snapshot
- `.stitch/config.json` — Surface routing for AI design tools

## Why This Contract Exists

The admin cockpit and the client PWA speak different dialects of the same Warm Earth language. Without an explicit contract, AI design tools blend the two and produce admin screens with marketing-page energy — hero banners, decorative gradients, oversized CTAs. This file gives the tools a tight vocabulary that reinforces the cockpit identity every time.

Originated in Codex review (2026-04-15) after the admin revamp stabilized on strict M3. Previously lived in user memory (`project_design_direction.md`) but belonged in the skill itself so any agent — not just the main Claude session — can enforce it.
