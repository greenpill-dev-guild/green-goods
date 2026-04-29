---
version: alpha
name: Green Goods Public Browser Dialect
description: Editorial public-web overlay for the Warm Earth core DesignMD tokens.
extends: ../../DESIGN.md
surface: client-browser
dialect: public-browser
---

# Green Goods Public Browser — Design Brief

> Public browser creative direction for funders, community members, and visitors. Use with the root `DESIGN.md`; lint this overlay and the root file separately.

## Surface Identity

| Mode | Detection | Audiences | Metaphor | Paradigm | Navigation |
|------|-----------|-----------|----------|----------|------------|
| **Public browser** | Standard browser visit | Funders, community members, partners | Coffee-table garden journal crossed with a living public record | Editorial gateway → ambient data landscape | `SiteHeader` (sticky, glassy, no bottom AppBar) |

**Hard rule:** Browser = website. Use `SiteHeader` at the top; never show installed-PWA bottom `AppBar` chrome.

## Routing

- **Browser `/`** renders the editorial homepage under `PublicShell` (the new `Home` view).
  - Inside `Home`, `useApp().isInstalled` decides: installed PWA users redirect to `/home` (preserving `?redirectTo=`), browser users see the editorial gateway.
- **Installed PWA `/`** continues to route to `/home` via the same `Home` check.
- **`/landing`** is a legacy compatibility redirect that loads back to `/`.
- Public route table: `/`, `/gardens`, `/gardens/:id`, `/impact`, `/fund`, `/actions`. No new public route families.
- Garden identifiers in URLs accept both raw `id`/`address` and the deterministic slug from `publicGardenHelpers.deriveSlug`. Stale, missing, zero-match, or ambiguous slugs render the normal page with a localized non-blocking message — never a hard 404 on `/fund?garden=…`.

## SiteHeader

- Sticky, with backdrop blur. Logo links home.
- **Nav order:** Gardens, Impact, Fund, Actions.
- **Primary CTA:** `Install App` (or `Open App` when `useInstallGuidance` reports already-installed). The CTA carries `data-install-action` from the guidance hook so the install logic stays one source of truth.
- **No wallet connect in the header.** Wallet connect appears only at the wallet-required step inside funding flows.
- Mobile drawer mirrors the desktop nav and footers with the same `Install App` / `Open App` CTA.

## Homepage (`/`)

Composed of six sections in this exact order:

1. **`PublicHero`** — full-bleed curated Garden image, anchored bottom-left, dark gradient overlay using `static-black/*` semantic tokens. H1 `Green Goods`, tagline `From good intentions to green outcomes`, one-sentence lede about communities documenting, verifying, and funding regenerative work. Primary CTA `Explore Gardens`, secondary CTA `Install App`. **Never** stats, route grids, wallet connect, or waitlist forms in the hero.
2. **`PublicFeaturedGardens`** — lead-plus-two layout. Curation comes from `packages/client/src/content/publicCuration.ts` keyed by Garden id/address (canonical) — slugs are display aliases. Falls back to recent active Gardens when curation is empty or unmatched.
3. **`PublicProofBand`** — confirmed counts only (Gardens, Contributors, Work, Assessments). Links contextually to `/impact`. Unavailable carbon, water, species, and area metrics stay hidden.
4. **`PublicRecordLoop`** — visitor-facing four-step narrative: `Assess the place` → `Do the work` → `Verify impact` → `Fund what grows`. Links each step contextually. This is narrative copy; it does **not** imply formal EAS Assessment happens before Work.
5. **`PublicInstallCta`** — install/open module section. Reuses the same install action as the header.
6. **`PublicGetInTouch`** — closing module: email subscribe via `POST {VITE_API_BASE_URL}/public/subscribe` (single opt-in with explicit consent) plus a Schedule-a-Call link from `VITE_GOOGLE_APPOINTMENT_URL`. **Honest UX**: success only when the public Agent route returns a confirmed `subscribed` / `already_subscribed`; Luma outages render a localized failure with the Schedule-a-Call fallback.

No final sitemap-style "choose your path" route grid.

## `/gardens`

- Editorial header (kicker `Living Archive`, serif h1, lede).
- Featured row reuses `PublicGardenCard` with a `lead` variant on the first card.
- Browse section: search input over a structured Garden grid. Cards link to `/gardens/:slug` and render confirmed-only metadata (location, contributors, Work count). No fake metrics.

## `/gardens/:id`

- Banner with overlap card carrying location, name, lede.
- Content order: **Place → Work → Evidence → Fund**.
- Desktop side rail: counts, `Support this Garden` (links to `/fund?garden=<slug>`), and Install/Open App.
- No admin-only controls, role tools, or public-side conviction allocation.

## `/impact`

- Aggregate counts (`Total Assessments` / `Total Gardens` / `Total Contributors`).
- Evidence cards from `usePublicImpactEvidence`. Cards open `PublicSourceDialog` with a readable Assessment summary and an EAS reference link when available.
- Honest states: loading, empty, EAS-unavailable, `partialData`, `sourceLimitReached` (the v1 caps are 50 Gardens / 100 records, sliced locally page-by-page).
- No Hypercert gallery placeholder, no Karma GAP claims.

## `/fund`

- Editorial header with support-only language and a tax/charity disclaimer (Donate is **not** tax-deductible, charitable, or nonprofit-backed unless separately configured).
- `?intent=<id>` mounts `PublicFundingReceipt` above the Garden grid. Receipt UI reads the in-memory token (already scrubbed by Root) and only renders redacted public fields: Garden, intent, amount, status, `fundingTxHash`, receiver wallet (Card Endow), and the Install/Open App CTA.
- `?garden=<id-or-slug>` resolves exact id/address first, then unique-slug match via `publicGardenHelpers.deriveSlug`. Stale / missing / zero-match / ambiguous queries render the regular Fund page with a localized non-blocking message and the matched Garden (if any) scrolls into view with a soft ring highlight.
- Garden grid uses `PublicGardenCard` with a `Support this Garden` CTA → opens `PublicFundingMethodSelector`.

### Funding UX

Two-step dialog driven by `PublicFundingMethodSelector`:

1. **Intent** — `Donate` (Cookie Jar) or `Endow` (Vault, "designed to preserve your principal while yield helps the Garden", with explicit smart-contract / token / yield / provider / wallet-recovery risk copy).
2. **Method** — `Wallet` (Reown/wagmi, always available, opens AppKit at the wallet-required step) or `Card` (thirdweb, **hidden** unless `publicProviderProofRegistry.resolve` returns `state: "live"` for the exact tuple). Curated `comingSoon` shows a disabled coming-soon block; otherwise the card option is omitted.

Wallet selection routes to the existing `CookieJarDepositDialog` (Donate) or `VaultDepositDialog` (Endow). Card flow lights up only when the proof registry has a `live` entry.

`/fund` stays support-only: no public withdrawals, no admin Vault management, no auto-buy claims, no public treasury custody claims.

## `/actions`

- Domain filter chips (All / Solar / Agro / Education / Waste).
- `PublicActionCard` grid; cards open `PublicSourceDialog` with media, description, and an `Install App` CTA in the dialog footer.
- No public create or edit controls.

## Typography

- **Fraunces** (serif) is reserved for editorial route heroes, large stat numbers, and Garden story headings. Loaded via `packages/client/index.html`; resolved by Tailwind's `font-serif` utility through `--font-serif` in shared `theme.css`.
- **Inter** carries body, nav, cards, buttons, and dialogs across both browser and installed PWA modes.
- Editorial headlines scale to magazine sizes (text-3xl → text-5xl); body stays restrained.

### Trying a different editorial serif

Swap two places to test an alternative serif on the public browser:

1. `packages/client/index.html` — replace the Fraunces `<link>` family parameter with the new family's Google Fonts URL.
2. `packages/shared/src/styles/theme.css` (`@theme` block) — change the first family in `--font-serif` from `"Fraunces"` to the new family name.

That's it. No JSX touches; every `font-serif` headline picks up the new family. Validate with `bun run check:design-tokens` and a Storybook spot-check.

#### Serif options (similar tone to Fraunces)

| Family | Voice | Notes |
|---|---|---|
| **Fraunces** (current) | Warm humanist with optical sizing; magazine | Variable woff2, full character |
| **Newsreader** | Editorial, slightly more bookish | Variable, narrower personality than Fraunces |
| **Lora** | Classic literary serif | Familiar, slightly more "blog" than "magazine" |
| **Source Serif 4** | Adobe humanist serif | Very legible at small sizes; slightly more corporate |
| **Marcellus** | Roman display serif | Display only — pair with Fraunces or Inter for body weights |
| **Crimson Pro** | Old-style book serif | Closer to print typography; warmer than Source Serif |
| **DM Serif Display** | Modern display serif | Strong identity, narrow weight range; for hero only |

Pairing rule: keep Inter as the sans companion; **never** pair two serifs on the public surface.

## Color & Tokens

- **Semantic Warm Earth tokens only.** Never raw color, radius, motion, or duration values. Image overlays use `text-static-white` / `bg-static-black` semantic tokens (audited via `check:design-tokens`).
- 4-role volume hierarchy: canvas 80–90% / ink 8–15% / stone 3–5% / accent green 1–3%.
- Accent green (`primary-action`) is reserved for interactive support / install CTAs. Editorial accents (kicker, link green) come from semantic primary-base.

## Motion & Dialogs

- **Route transitions:** soft fades (no morphs).
- **Section reveals:** light stagger.
- **Source dialogs** (`PublicSourceDialog`, `PublicFundingMethodSelector`, `PublicFundingReceipt`):
  - Desktop: centered, rounded sheet on `bg-static-black/40` overlay.
  - Mobile: bottom sheet with rounded top corners.
  - Labelled title (`aria-labelledby` → `<h2>` id), Escape close, overlay click close, focus moved to the close button on mount.
  - Mobile-safe width: `max-w-[calc(100vw-2rem)]` clamps the dialog under 375px viewports.
- Source-morph transitions require unique transition names per item; until that lands, public surfaces fall back to simple fades.
- All motion respects reduced-motion preferences.

## Imagery

- Real community Garden imagery wherever available; deterministic local fallback set.
- Cinematic photography of the places where Gardens grow — neighborhood, context, scale.
- Avoid generic "hands holding seedlings" and decorative gradients.
- Garden cards should feel distinct and alive — not a SaaS card grid.

## Receipt-Token Safety

- Receipt URLs ship as `/fund?intent=<id>#receiptToken=<token>`.
- Root pre-pageview bootstrap moves the token from the URL fragment into short-lived session state and calls `history.replaceState` before initial analytics fires.
- `usePageView` redacts sensitive hash keys (including `receiptToken`) so `page_view.hash` never carries the token even if a downstream view re-introduces a hash.
- Public receipt reads call `GET /public/funding-intents/:id` with `X-GG-Receipt-Token` only — never query params or JSON body. Receipt UI never shows payer email, provider ids, raw failure detail, webhook payloads, or the raw token itself.

## Do's and Don'ts

**Do:**
- Test browser layouts at 1440px, 1024px, 768px, and 375px.
- Let real Garden imagery carry the first impression.
- Use the same `Install App` CTA across header, drawer, sections, and receipt completion.
- Keep funding copy honest — Donate is direct support; Endow uses "designed to preserve" language with explicit risk.
- Hide unproven card methods by default. `comingSoon` is curated only.

**Don't:**
- Show the installed-PWA bottom `AppBar` in browser mode.
- Show `Connect Wallet` as a public header CTA.
- Imply Donate is tax-deductible, charitable, nonprofit-backed, or a legal receipt.
- Promise card payments before the provider proof registry confirms the exact tuple is `live`.
- Make the public site feel like an admin dashboard or KPI grid.
- Carry raw receipt tokens into analytics, query params, JSON bodies, or server-rendered URLs.
