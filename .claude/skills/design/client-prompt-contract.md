# AI Prompt Contract — Client Surface

Stable vocabulary and never-use list for prompting AI design tools (Stitch, Antigravity, Claude Design, Figma Make) to generate client PWA screens that align with the Green Goods garden-journal voice.

> **Companion**: The `admin` surface uses a restrained operator cockpit dialect. See [prompt-contract.md](./prompt-contract.md) for admin-specific framing. This file is client-specific — gardener-facing PWA framing.

## Stable Prompt Core

Paste this sentence (or a trimmed version) into every AI design prompt for client surfaces:

> Green Goods client is a **PWA in an adaptive shell**. Installed PWA uses a **bottom `NavigationBar`**; browser uses a **hamburger + top header**. Never mix. Use **Inter** for all typography (editorial serif only appears on the public browser site, never in the PWA). Surfaces follow the **Warm Earth** language — concentric geometry, expressive spring motion, garden-journal feel. Materials are **permitted to be expressive** (liquid glass, organic shapes, hero moments). **Real content over lorem ipsum.** Copy tone is **warm, first-person-community** — "our garden", "what's in season", "how the work grew" — not operator-facing task framing.

## Required Vocabulary

Use these terms when describing client UI:

| Term | Meaning |
|------|---------|
| `adaptive shell` | The PWA-vs-browser shell pattern; mode determines chrome |
| `installed PWA` | Bottom navigation, app-feel, standalone mode |
| `browser mode` | Hamburger + top header, website-feel |
| `garden-journal feel` | Handmade but precise, seed-catalog aesthetic |
| `expressive material` | Liquid glass, organic shapes, spring physics permitted |
| `hero moment` | Celebrated flow (garden creation, first work, hypercert mint) |
| `value flow` | End-to-end chain visualization (submit → review → assess → fund) |
| `MDR flow` | Media + Data + Review — the core gardener capture loop |
| `pane` | Primary surface unit (not "card" — panes float, cards sit) |
| `succession-aware` | UI complexity scales with garden stage (pioneer/intermediate/climax) |
| `ecological time` | Seasonal prompts, not countdowns or streaks |
| `capability badge` | Recognition of what a user can independently do, not activity volume |

## Never Use (in client prompts)

These terms signal operator-cockpit or growth-hacking framing and produce incoherent client output:

- `operator cockpit` / `workbench row` / `inspector pattern` (admin-only vocabulary)
- `utility copy` (client copy is warm and narrative, not terse task framing)
- `dashboard` / `KPI tile` / `metric grid` (client is a journal, not a dashboard)
- `Plus Jakarta Sans` (admin-only typography — client uses Inter)
- `countdown` / `streak` / `leaderboard` / `FOMO` (violates regenerative lens)
- `dark pattern` / `re-engagement` / `retention hook` (growth-hacking vocabulary)
- `trading floor` / `financial terminal` (degen aesthetic)
- `gamification` (we use motivation design, not game mechanics)

## Materials & Motion (client)

- **Full Warm Earth expression** is permitted — capsule + squircle + concentric shapes, spring motion, hero moments, expressive color.
- **Glass material is allowed across client surfaces**, unlike admin where glass is restricted to the admin `AppBar`. Match thickness to content density (see [materials.md](./materials.md)).
- **Spring motion is the default easing** — never hardcoded cubic-bezier or duration values.
- **Typography** — Inter across the PWA. Editorial serif (Fraunces/Lora/Newsreader) only on the public browser site, never in the installed PWA.
- **Succession-aware** — pioneer gardens get simple hero moments, climax gardens get full expression.

## Copy Voice

**Say:** "Let's see what's grown in your garden." / "Your work is in good hands." / "The reviewer will take it from here." / "Go do more of what matters."

**Don't say:** "Processing submission..." / "Review queued." / "1 of 12 pending." / "Submit another?"

The client speaks **to the community, about the work**. The admin speaks **about the work, to the operator**. Same garden, different dialects.

## Canonical Component Palette

AI design tools MUST map generated output to these existing exports. Do not invent component names — flag missing primitives instead.

**Shell** (`packages/client/src/components/`):

| Component | Role |
|-----------|------|
| `PlatformRouter` | `isInstalled` detection — PWA → `/home`, browser → `/gardens` |
| `SiteHeader` | Browser mode — hamburger (mobile) + horizontal links (desktop), sticky, backdrop blur |
| `AppBar` | Installed PWA — bottom nav (Home / Garden / Profile), hides on `/garden` and `/work/:id` |
| `SyncStatusBar` | Positioned above `AppBar`, reflects offline queue state |

**Shared primitives** (import from `@green-goods/shared`):

| Family | Components |
|--------|-----------|
| Dialogs | `DialogShell` (default — mobile bottom-sheet + desktop centered, `glass-floating`) |
| Cards / status | `Card`, `StatCard`, `StatusBadge`, `Alert` |
| Feedback | `Skeleton`, `Spinner`, `HydrationFallback` |
| Input | `FileUploadField`, `ListPrimitives`, `DatePicker`, form components |
| Surfaces | `Surface`, `SyncStatusBar` |
| Identity | `AddressDisplay`, `DomainBadge` |
| Audio | `Audio/*` (voice capture primitives) |

**Typography utilities** (`packages/client/src/styles/typography.css`):
- `.title-screen` · `.title-section` · `.body-md-regular` · `.label-md`
- Compact type scale — `body-sm` and `label-md` are the workhorses.

**Hero moment amplification** (garden creation, first work submission, hypercert mint, vault deposit, seasonal transitions, assessment completion, role milestone):
- Apply full Warm Earth amplification: expressive shape × full chroma × Expressive motion scheme × display typography × dramatic material.
- Spec and list: `.claude/skills/design/language.md § Hero Moments`.
- **Never appear in admin** — see `prompt-contract.md § Hero Moments Live in the Client, Not the Cockpit`.

**Reference composition**: browser `/gardens` marketplace, PWA `/home` Work/Garden/Profile tabs. Model new client surfaces on them.

## Companion Files

- [prompt-contract.md](./prompt-contract.md) — Admin cockpit prompt contract (sister file)
- [language.md](./language.md) — Full Warm Earth design language (shapes, motion, color, hero moments)
- [SKILL.md](./SKILL.md) — Design philosophy, paradigms, client/admin carve-outs
- Root `DESIGN.md` — Aesthetic direction + role hierarchy
- `packages/client/DESIGN.md` — Client-specific design system snapshot
- `.stitch/config.json` — Surface routing for AI design tools

## Why This Contract Exists

The admin cockpit and client PWA speak different dialects of the same Warm Earth language. An explicit client contract prevents two failure modes:

1. **Admin bleed** — client screens generated with operator-cockpit vocabulary produce sterile data-table layouts where a garden journal belongs.
2. **Growth-hacking drift** — AI tools default to "engagement-maximizing" patterns (streaks, leaderboards, FOMO) that violate the regenerative design lens.

Created 2026-04-17 to close the asymmetry gap — admin had `prompt-contract.md`, client had nothing but the root `DESIGN.md`.
