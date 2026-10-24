# AI Prompt Contract: Client Surface

Stable vocabulary and never-use list for prompting AI design tools or coding agents to generate client PWA screens that align with the Green Goods garden-journal voice.

> **Companion**: The `admin` surface uses a restrained steward cockpit dialect. See [prompt-contract.md](./prompt-contract.md) for admin-specific framing. This file is client-specific: gardener-facing PWA framing.

## Stable Prompt Core

Paste this sentence (or a trimmed version) into every AI design prompt for client surfaces:

> Green Goods client is a **PWA in an adaptive shell**. Installed PWA uses a **bottom `AppBar`**; browser uses a **hamburger + `SiteHeader`**. Never mix. Use **Plus Jakarta Sans** in the installed PWA, the admin cockpit's face, and **Inter** on the browser site (editorial serif only appears on the public browser site, never in the PWA). Surfaces follow the **Warm Earth** language: concentric geometry, expressive spring motion, garden-journal feel. Expression comes from **organic shapes, spring motion, and hero moments** on **solid surfaces**, never glass. **Real content over lorem ipsum.** Copy tone is **warm, first-person-community** ("our garden", "what's in season", "how the work grew"), not steward-facing task framing.

## Required Vocabulary

> **Terminology authority**: cross-surface domain terms and personas live in [`green-goods-ontology.json`](../../../packages/shared/src/ontology/green-goods-ontology.json). The generated public [glossary](../../../docs/docs/reference/glossary.generated.mdx) explains that vocabulary. The table below is client-specific shell and journal vocabulary.

Use these terms when describing client UI:

| Term | Meaning |
|------|---------|
| `adaptive shell` | The PWA-vs-browser shell pattern; mode determines chrome |
| `installed PWA` | Bottom navigation, app-feel, standalone mode |
| `browser mode` | Hamburger + top header, website-feel |
| `garden-journal feel` | Handmade but precise, seed-catalog aesthetic |
| `expressive shape and motion` | Organic shapes and spring physics, on solid surfaces |
| `hero moment` | Celebrated flow (garden creation, first work, hypercert mint) |
| `value flow` | End-to-end chain visualization (submit → review → assess → fund) |
| `MDR flow` | Media + Data + Review: the core gardener capture loop |
| `pane` | Primary surface unit (not "card": panes float, cards sit) |
| `succession-aware` | UI complexity scales with garden stage (pioneer/intermediate/climax) |
| `ecological time` | Seasonal prompts, not countdowns or streaks |
| `capability badge` | Recognition of what a user can independently do, not activity volume |

## Never Use (in client prompts)

> **Machine policy**: the full client-banned phrase list lives in [`scripts/data/banned-vocabulary.json`](../../../scripts/data/banned-vocabulary.json) (`prompt_vocabulary_client_banned`). `bun run check --only vocabulary` reads the same file for lint-enforced cross-surface terms.

The categories below are contract-specific framing: *why* client output should reject these patterns. The exact phrase set is the glossary's job:

- **Steward-cockpit framing**: `operator cockpit`, workbench / inspector vocabulary; the client is a garden journal, not a cockpit.
- **Utility-copy register**: terse task framing; client copy is warm and narrative.
- **Dashboard / KPI / metric-grid framing**: the client surfaces story and place, not key-performance-indicator tiles.
- **Growth-hacking framing**: streak, leaderboard, FOMO, re-engagement, retention hook; violates the regenerative lens (also lint-enforced).
- **Trading-floor / financial-terminal framing**: degen aesthetic; this is a garden, not an exchange.
- **Gamification**: we use motivation design, not game mechanics.
- **Glass / liquid / frosted framing**: surfaces are solid (DL-108); the only translucent piece in Green Goods is the cockpit's nav dock.

## Materials & Motion (client)

- **Full Warm Earth expression** is permitted: capsule + squircle + concentric shapes, spring motion, hero moments, expressive color.
- **Surfaces are solid**, as in the cockpit, whose nav dock is the one translucent piece (DL-108): no glass, blur, or frosted panels on cards, sheets, dialogs, or bars. The browser site's `SiteHeader` stays fully transparent over the hero, with no fill and no blur: transparent chrome draws no surface, so it is not glass (see [surfaces.md](./surfaces.md)).
- **Spring motion is the default easing**, never hardcoded cubic-bezier or duration values.
- **Typography**: Plus Jakarta Sans across the installed PWA, shared with the cockpit (DL-096); Inter on the public browser site. Editorial serif (Fraunces/Lora/Newsreader) only on the public browser site, never in the installed PWA.
- **Succession-aware**: pioneer gardens get simple hero moments, climax gardens get full expression.
- **Never rename `--color-primary`**: the codebase token resolves to the **tertiary accent role** (garden green, 1-3% volume), not the primary ink role. The name is historical; keep it, and don't treat it as the dominant brand color when prompting or generating UI.

## Copy Voice

The client speaks **to the community, about the work**. The admin speaks **about the work, to the steward**. Same garden, different dialects. Cross-surface voice pillars and terminology live in the root [`DESIGN.md § Voice & Copy`](../../../DESIGN.md#voice--copy).

**Say:** "Let's see what's grown in your garden." / "Your work is in good hands." / "Your steward will take it from here." / "Go do more of what matters."

**Don't say:** "Processing submission..." / "Review queued." / "1 of 12 pending." / "Submit another?"

### Browser mode (funders / community members)

- **Headlines**: editorial, evocative, magazine-weight. "The gardens growing a new kind of evidence."
- **Subheads**: bridge emotion and information. "Work the community documented, reviewed by the people who know the place."
- **Garden descriptions**: place-first. Lead with where the garden is and what it grows, not the technology.
- **Impact numbers**: let them breathe. "[count] documented actions" (a live figure) > "[count] actions have been documented by community members."
- **CTAs**: warm imperative. "Fund this garden" not "Contribute now."

### Installed PWA (gardeners)

- **Instructions**: direct, second-person. "Describe what you did" not "Please provide a description."
- **Labels**: short, noun-based. "Photo", "Method", "Confidence".
- **Empty states**: encouraging, suggest next action. "No work yet. Start by documenting what you see."
- **Sync status**: calm indicators. "Saved locally" / "Synced" / "Syncing…"
- **Errors**: never blame the user. "We couldn't submit that" not "Your submission failed."

## Canonical Component Palette

AI design tools MUST map generated output to these existing exports. Do not invent component names. Flag missing primitives instead.

**Shell routes and components** (`packages/client/src/routes/`, `packages/client/src/components/`):

| Component | Role |
|-----------|------|
| `requireWebsitePresentationLoader` / `requirePwaPresentationLoader` | Presentation-mode route guards: browser stays on public routes, PWA routes to `/home` |
| `PublicShell` | Browser mode route shell: `SiteHeader` + public route outlet |
| `PwaRuntime` / `AppShell` | Installed/authenticated PWA runtime: providers, update notifier, scroll root, bottom `AppBar` |
| `SiteHeader` | Browser mode: hamburger (mobile) + horizontal links (desktop), fixed transparent header that fades out on scroll; no backdrop blur |
| `AppBar` | Installed PWA: bottom nav (Home / Garden / Profile), hides on `/home/garden` and `/home/:id/work/:workId`; the active tab shows a green pill behind its icon, the cockpit's recipe (DL-107) |

**Shared primitives** (import from `@green-goods/shared`):

| Family | Components |
|--------|-----------|
| Dialogs | `DialogShell` (default: mobile bottom-sheet + desktop centered, solid) |
| Cards / status | `Card`, `StatCard`, `StatusBadge`, `Alert` |
| Feedback | `Skeleton`, `Spinner`, `HydrationFallback` |
| Input | `FileUploadField`, `ListPrimitives`, `DatePicker`, form components |
| Surfaces | `Surface` with a `solid-*` elevation; its glass elevations are residue, and its own story and the Glass story still show them until they go |
| Identity | `AddressDisplay`, `DomainBadge` |
| Pickers | `ActionPicker` and `GardenPicker`, arriving with step 16's code change: banner cards in one listbox, the row Submit Work scrolls sideways (DL-111) |
| Audio | `Audio/*` (voice capture primitives) |

**Type roles** (the `type-*` utilities in shared `theme.css`, at the app's density; root `DESIGN.md` § Typography):
- `type-title-lg` · `type-title-md` · `type-title-sm` (24, 18, and 16px at 600) · `type-body` 16px · `type-label` 16px at 500 · `type-label-sm` 14px (field labels, secondary lines) · `type-meta` 12px · `type-meta-sm` 11px (chips, status pills) · `type-field` for field text.
- Never a raw Tailwind size or a retired Material name. The app's own views still carry the shared scale (`text-label-md` and its siblings) until they move.

**Hero moment amplification** (garden creation, first work submission, hypercert mint, vault deposit, seasonal transitions, assessment completion, role milestone):
- Apply full Warm Earth amplification: expressive shape × full chroma × Expressive motion scheme × display typography, on solid surfaces (no material step, DL-108).
- Spec and list: `.claude/skills/design/language.md § Hero Moments`.
- **Never appear in admin** (see `prompt-contract.md § Hero Moments Live in the Client, Not the Cockpit`).

**Reference composition**: browser `/gardens` marketplace, PWA `/home` Work/Garden/Profile tabs. Model new client surfaces on them.

## Companion Files

- [prompt-contract.md](./prompt-contract.md): Admin cockpit prompt contract (sister file)
- [ai-ui-brief.md](./ai-ui-brief.md): Reusable AI UI/CSS build brief and external reference role map
- [language.md](./language.md): Full Warm Earth design language (shapes, motion, color, hero moments)
- [SKILL.md](./SKILL.md): Design philosophy, paradigms, client/admin carve-outs
- Root `DESIGN.md`: Canonical Warm Earth DesignMD tokens + creative brief
- `packages/client/DESIGN.pwa.md`: Installed PWA DesignMD dialect
- `packages/client/DESIGN.browser.md`: Public browser DesignMD dialect

## Why This Contract Exists

The admin cockpit and client PWA speak different dialects of the same Warm Earth language. An explicit client contract prevents two failure modes:

1. **Admin bleed**: client screens generated with steward-cockpit vocabulary produce sterile data-table layouts where a garden journal belongs.
2. **Growth-hacking drift**: AI tools default to "engagement-maximizing" patterns (streaks, leaderboards, FOMO) that violate the regenerative design lens.

Created 2026-04-17 to close the asymmetry gap: admin had `prompt-contract.md`, client had nothing but the root `DESIGN.md`.
