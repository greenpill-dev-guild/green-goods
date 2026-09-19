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
| **Public browser** | Standard browser visit | Funders, community members, partners | Coffee-table garden journal crossed with a living public record | Editorial gateway → ambient data landscape | `SiteHeader` (sticky, transparent, fades on scroll, no bottom AppBar) |

**Hard rule:** Browser = website. Use `SiteHeader` at the top; never show installed-PWA bottom `AppBar` chrome.

## Routing

- **Browser `/`** renders the editorial homepage under `PublicShell`.
- **Installed PWA entry** is `/home`; presentation-mode loaders redirect app-mode visits away from the public shell before the PWA runtime renders.
- **`/landing`** is a legacy compatibility redirect that loads back to `/`.
- Public route table: `/`, `/gardens`, `/gardens/:id`, `/impact`, `/fund`, `/vaults`, `/actions`, `/cookies`, `/glossary`. No new public route families beyond this list.
- Garden identifiers in URLs accept both raw `id`/`address` and the deterministic slug from `publicGardenHelpers.deriveSlug`. Stale, missing, zero-match, or ambiguous slugs render the normal page with a localized non-blocking message — never a hard 404 on `/fund?garden=…`.

## SiteHeader

- **Fixed at top, fully transparent** on every public route — no background, no border, no blur. The header is removed from the layout flow so the hero image plate runs all the way to the top of the viewport and the header floats over it.
- **Fades out on scroll** rather than turning into a solid sticky bar. Opacity goes from `1` at the top to `0` after ~220px of scroll, with `pointer-events: none` once hidden so the page below stays interactive. The mobile drawer pins the header back to fully visible while open.
- Wayfinding once the hero leaves the viewport is owned by the **compact utility footer** at the bottom of every public page.
- Logo links home. **Nav order:** Gardens, Impact, Fund, Actions.
- **Primary CTA:** `Install App` (or `Open App` when `useInstallGuidance` reports already-installed). The CTA carries `data-install-action` from the guidance hook so the install logic stays one source of truth.
- **No wallet connect in the header.** Wallet connect appears only at the wallet-required step inside funding flows.
- Mobile drawer mirrors the desktop nav and footers with the same `Install App` / `Open App` CTA.

## Homepage (`/`)

Composed of eight sections in this exact order (pinned by the section-order test in `PublicHome.test.tsx`):

1. **`PublicEditorialHero`** — full-bleed curated Garden image plate. The linen content card sits as a **bottom-left overlay inside the hero image** (no negative overlap, no clipping, fully contained). The card carries the H1 (the tagline `From good intentions to green outcomes`), the one-sentence lede, and the hero CTAs.
   - **Desktop CTAs:** `Explore Gardens` only (single primary). The `Install App` CTA already lives in the header on desktop, so the hero stays focused on the editorial gesture.
   - **Mobile CTAs:** `Install App` (or `Open App`) **first**, then `Explore Gardens` second. A phone visitor lands on the install path; the secondary keeps the editorial route open.
   - The CTAs land **above the fold** on standard browser viewports (1440 / 1024 / 768 / 375 px) because the card is contained inside the image, not protruding below it.
   - **Never** stats, route grids, wallet connect, or waitlist forms in the hero.
2. **`PublicFeaturedGardens`** — **four featured Gardens in an editorial masonry column flow** (not a fake stagger). Image-backed Gardens are preferred so the grid feels alive rather than placeholder-heavy. Curation comes from `packages/client/src/content/publicCuration.ts` keyed by Garden id/address (canonical) — slugs are display aliases. Falls back to recent active Gardens when curation is empty or unmatched. The section uses standard vertical rhythm — no oversized top padding to absorb a hero overlap, since the hero is now self-contained.
3. **`PublicProofBand`** — confirmed counts only (Gardens, Contributors, Work, Assessments). Links contextually to `/impact`. Unavailable carbon, water, species, and area metrics stay hidden. Renders on the warm linen surface in light mode and a warm walnut surface in dark mode (both via `--editorial-warm-rgb`); body text uses semantic tokens that auto-flip.
4. **`PublicRecordLoop`** — visitor-facing four-step narrative: `Assess the place` → `Do the work` → `Verify impact` → `Fund what grows`. Links each step contextually. Body copy must stay grounded in the actual protocol: Gardens as community hubs, Work submissions, steward review, evaluator Assessments, Cookie Jars, and Vault endowments. This is narrative copy; it does **not** imply formal EAS Assessment happens before Work.
5. **`PublicWhoTendsAGarden`** — five persona portraits walking outward from the field: Gardener → Steward → Evaluator → Funder → Community Member, mirroring the canonical user-archetypes doc (personas themselves are canon in `v1-0.mdx` § 3.1). Gardener CTA is the install path; Steward and Evaluator CTAs route to docs because those roles are invited by an existing Garden, not open sign-ups.
6. **`PublicFundingBridge`** — cardless trust section explaining the two public support paths: `Donate` through a Garden Cookie Jar for direct support, or `Endow` through a Garden Vault designed so yield supports the Garden over time. One primary CTA routes to `/fund`; no wallet connect, amount form, or per-Garden funding selector lives on Home.
7. **`PublicGetInTouch`** — closing module: email subscribe via `POST {VITE_API_BASE_URL}/public/subscribe` (single opt-in with explicit consent copy) plus a secondary Schedule-a-Call link from `VITE_GOOGLE_APPOINTMENT_URL`. The Schedule-a-Call link is inline after a divider, not inside its own card. **Honest UX**: success only when the public Agent route returns a confirmed `subscribed` / `already_subscribed`; Luma outages render a localized failure with the Schedule-a-Call fallback.
8. **`PublicFooter`** — compact provenance row with restored living-public-record message, public route links, and contact. Footer links are neutral by default; green is a hover/focus affordance only.

No final sitemap-style "choose your path" route grid.

### Compact utility footer

Every public-browser page ends with `PublicFooter` — a single quiet row containing:

- Small wordmark (`Green Goods`, regular Fraunces, base size — **not** the oversized italic display treatment).
- Public nav links (Gardens, Impact, Fund, Actions) + Contact (`mailto:`).
- Copyright/provenance (`© <year> Green Goods. A living public record, rooted in regenerative work.`).

Stacks gracefully on mobile. Schedule-a-Call lives in `PublicGetInTouch` above the footer; the footer is wayfinding + provenance, not a hero moment.

## `/gardens`

- Editorial header (kicker `Living Archive`, serif h1, lede).
- Featured row reuses `PublicGardenCard` with a `lead` variant on the first card.
- Browse section: search input over a structured Garden grid. Cards link to `/gardens/:slug` and render confirmed-only metadata (location, contributors, Work count). No fake metrics.

## `/gardens/:id`

An ordinary editorial page, not a modal. It was briefly wired to a Radix dialog over the `/gardens` grid — an accident of an unrelated homepage-polish commit, not a decision — which cost the page its footer, gave an editorial long-read a nested scroll container, and left the return trip to the archive undefined.

- `PublicEditorialHero variant="banner"`. Image is the Garden's own `bannerImage`, falling back to `getPublicHeroImage("gardens")`. Location is the kicker, name is the H1, description is the lede. A quiet `← All Gardens` sits in the hero's `actions` slot.
- Four-cell record strip under the hero: **Entries · Hands at work · Assessments · Certificates**. Do not widen it — the commitment-pooling section brings its own counts.
- Single-column numbered sections: **§ 01 Field notes → § 02 Commitments → § 03 Impact Certificates → § 04 Stewards**. No side rail; only the transactional `/fund` carries one, and the dialect treats boxed rails as chrome.
- § 02 Commitments is the Garden's record across seasons and campaigns. Header and body both compose directly on the canvas in the page's own grammar — headers on linen, hairline dividers, § 01-style stat rows (the 2026-08-25 supersession of the PR-748 `EditorialPanel` body; no section on this page is card-wrapped). The record reads: the pool-state sentence beside the lifetime **Commitments made · Kept · Kept rate** (the rate only when `selectPublicPromiseKeptRate` publishes it), then the open Season and Campaigns beside the pool-wide exact-label units, then the finished cycles newest first, then the line that ties fulfilled commitments to § 03. A section body, not a rail. Never pause reasons, providers, addresses, cancelled or disputed counts, or rankings.
- Field notes are an image-led grid in the `PublicGardenCard` restraint grammar — no border, radius, or shadow — twelve at a time with a local `Show more entries`. A tile opens the `PublicRecordDrawer` record view with the full media, the gardener's note, and an attestation link.
- People (note authors, stewards) render through shared `AddressDisplay`, so an ENS name appears where one resolves.
- **Every section always renders.** An absent thing says it is absent. Ordinals stay stable between Gardens, and a Garden with nothing published yet still reads as a record in progress.
- **A failed read is not an empty one.** `usePublicGardenDetail` reports `partialData` / `unavailableSources`; a count whose source failed renders an em dash, never `0`, and its section says it could not load rather than claiming the Garden is empty.
- Closes with `Support this Garden` (links to `/fund?garden=<slug>`) and `View public evidence`, then `PublicInstallCta`, then `PublicFooter variant="soil"`.
- No admin-only controls, role tools, or public-side conviction allocation.

## `/impact`

- Aggregate counts (`Total Assessments` / `Total Gardens` / `Total Contributors`).
- § 02 Commitments band between the proof markers and the cycle: header and record both on the linen (2026-08-25 panel supersession) — four protocol-wide aggregates — Gardens with open pools, commitments fulfilled (lifetime), commitments kept (a share only above the ≥ 5 due / ≥ 3 providers threshold, counts below it), and CCIP-confirmed G$ support — with the lifecycle sentence and `See the Gardens` as the record's hairline footer line. No per-garden table or ordering; a failed figure is an em dash, never `0`.
- Evidence cards from `usePublicImpactEvidence`. Cards open `PublicEvidenceDialog` (a `PublicRecordDrawer` composition) with a readable Assessment summary and an EAS reference link when available.
- Honest states: loading, empty, EAS-unavailable, `partialData`, `sourceLimitReached` (the v1 caps are 50 Gardens / 100 records, sliced locally page-by-page).
- No Hypercert gallery placeholder, no Karma GAP claims.

## `/fund`

- **Donate is always present on `/fund`, beside Endow (DL-027).** The hero lede names both paths, § 02 Ways to Support explains them once (Donate is direct support to a Garden's shared fund through its Cookie Jar; Endow is a withdrawable deposit in the Garden Vault whose yield supports the Garden), and every Garden row in § 03 carries both actions. Do not hide Donate. A Garden without a donation jar keeps the button, and its funding card says donations are not enabled yet.
- `?intent=<id>` mounts `PublicFundingReceipt` above the Garden grid. Receipt UI reads the in-memory token (already scrubbed by Root) and only renders redacted public fields: Garden, intent, amount, status, `fundingTxHash`, receiver wallet (Card Endow), and the management CTA when the receipt is an Endow receipt.
- `?manage=endowments` opens `PublicEndowmentPanel`; the URL never carries wallet addresses, account ids, or receipt tokens.
- `?garden=<id-or-slug>` resolves exact id/address first, then unique-slug match via `publicGardenHelpers.deriveSlug`. Stale / missing / zero-match / ambiguous queries render the regular Fund page with a localized non-blocking message and the matched Garden (if any) scrolls into view with a soft ring highlight.
- Garden grid uses public Garden rows with a `Donate` primary and an `Endow` warm secondary on every row, both 40 px (DL-023). Section 3 also carries an always-visible `Manage Endowments` secondary action (the website's square corner, warm tone) aligned to the section header on desktop and stacked under the title on mobile.

### Funding UX

Wallet Donate and Wallet Endow share `PublicFundingCard`, which each Garden row opens with the matching intent:

1. **Amount** — USD-first input with token selection resolved from the Garden's Cookie Jars (Donate) or Garden Vaults (Endow).
2. **Wallet** — Reown/wagmi wallet connect folds into the submit button and deposits directly to the selected jar or vault; an Endow names the connected wallet as receiver.

Card Endow remains part of the project scope but hidden until recovered-wallet ownership, exact vault-share verification, public visibility, and successful withdrawal proof pass. Card Donate proof never reveals Card Endow, and Card Donate does not appear on `/fund`; wallet Donate does (DL-027).

Manage Endowments is the only public withdrawal surface in v1. It is wallet-owned only, opens a right-side panel on desktop and a bottom sheet on mobile, leads with what the funder has supported, groups positions by Garden, and expands each asset row inline for Withdraw / Max / confirm / pending / error / success. It does not include public address lookup, admin Vault management, auto-buy claims, custody claims, public Donate, Card Donate, or visible Card Endow.

## `/vaults`

- Octant vault campaign crowdfunding surface (also the WebMCP-registered description). Editorial hero + campaign records from `getOctantVaultCampaigns`, each with live stats (`useOctantVaultStats`), strategy APY, and harvestable-yield reads.
- Endow opens `VaultCheckoutDialog`; managing positions opens `VaultManagePositionsPanel` (the `PublicEndowmentPanel` right-panel/bottom-sheet treatment).
- Same honesty rules as `/fund`: em dash for a failed figure, never `0`; risk copy uses "designed to preserve" language.

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

That's it. No JSX touches; every `font-serif` headline picks up the new family. Validate with `bun run check --only design-tokens` and a Storybook spot-check.

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
- **Dark mode** is supported on all public-browser surfaces. Editorial-specific tokens (`--editorial-warm-rgb`, `--editorial-deep-rgb`) get warm dark overrides under `[data-theme="dark"]` so the Living Public Record and Get In Touch sections render as warm walnut with linen ink instead of cold neutral grey. Domain palette stays the same in both modes.

## Motion & Dialogs

- **Route transitions:** soft fades (no morphs).
- **Section reveals:** light stagger.
- **Return position:** back and forward belong to `ScrollRestoration`. `PublicShell`'s scroll reset skips POP navigations so it cannot race and win; pages that were reached from a list also hand focus back to the item that was opened. Only PUSH and REPLACE start at the top.
- **Record drawers** (`PublicRecordDrawer` — used directly by the Garden page's field notes and, wrapped as `PublicEvidenceDialog`, by `/impact`'s evidence records): bottom sheet at `92vh` on mobile with a rounded top, right-side drawer at `sm:h-screen sm:max-w-[42rem]` on desktop. **Fixed height, never content-sized**: a persistent header bar (mono uppercase eyebrow + pill close) over a `flex-1 overflow-y-auto` body, so a long record scrolls inside the drawer instead of growing past the viewport. Use this for reading one published record.
  - **Images inside a record are bounded and uncropped** — `max-h-[40vh]` with `object-contain` on `bg-editorial-warm`, one per row. These are evidence photos, usually shot portrait; cropping hides what was documented, and unbounded ones ran past 2,000px and pushed the record's own title and source link off screen.
- **Source dialogs** (`PublicSourceDialog` on `/actions`, `PublicInstallDialog` from every Install CTA, `VaultCheckoutDialog` on `/vaults`, `PublicEndowmentPanel` on `/fund`, `VaultManagePositionsPanel` on `/vaults`):
  - Desktop: centered, square editorial sheet on `bg-static-black/40` overlay; `PublicEndowmentPanel` and `VaultManagePositionsPanel` are the exceptions and open as right-side public panels.
  - Mobile: bottom sheet with square corners, like every other editorial surface (DL-024). The record drawer above keeps its rounded top.
  - The actions inside these surfaces are the shared buttons (see Buttons and Fields), not square blocks.
  - Labelled title (`aria-labelledby` → `<h2>` id), Escape close, overlay click close, focus moved to the close button on mount.
  - Mobile-safe width: `max-w-[calc(100vw-2rem)]` clamps the dialog under 375px viewports.
- **Modals portal to `document.body`.** `.editorial-section-reveal` applies a transform, and a transformed ancestor becomes the containing block for `position: fixed` — a dialog rendered inside a revealed section sizes and scrolls against that section instead of the viewport. `PublicRecordDrawer` and `PublicSourceDialog` portal internally, so a consumer is safe wherever it is rendered. Do not rely on a call site happening to sit outside a transform.
- Source-morph transitions require unique transition names per item; until that lands, public surfaces fall back to simple fades.
- All motion respects reduced-motion preferences.

## Buttons and Fields

The public site uses the same button and field system as the installed app (DL-024):

- **Actions** come from the shared `Button`, `IconButton`, and `Chip`. Every button is square with a semibold label, whatever its emphasis, and does not morph on press (DL-026, DL-029); a text action (arrow links such as `Show more entries`) has no container, a close is a circle, and a filter chip is a capsule. The vault and cookie flows follow the same rule: square surfaces, square buttons.
- **Editorial atoms** (`EditorialPrimaryButton`, `EditorialGhostButton`, their link variants, and `EditorialDomainChip`) are thin wrappers over the shared primitives that pass `size` through and add only the dialect's colors: the warm linen secondary, the walnut-surface secondary, and each domain's ink on an active filter chip.
- **Sizes** follow the shared scale (DL-023): 48 px for hero actions, 44 px for section actions and dialog actions, 40 px for row actions (Donate, Endow), 32 px chips with a 44 px tap area. One size per context: the `Install App` CTA is 48 px in the hero and 44 px everywhere else, including the header drawer.
- **Fields** are the editorial underline field (`surface="editorial"`: no box, a hairline in the text color, serif input text) on editorial sections, and the 16px shared field inside funding and account panels (DL-022). Display-size text never changes a field's height: the Get in Touch email and both funding amounts are 44 px, level with the actions beside and below them.
- **Square stays** for editorial cards, dialogs, panels, and image tiles.

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
- Endow receipts route to `/fund?manage=endowments`; no wallet/account identifier is placed in the receipt URL or management URL.

## Do's and Don'ts

**Do:**
- Test browser layouts at 1440px, 1024px, 768px, and 375px.
- Let real Garden imagery carry the first impression.
- Use the same `Install App` CTA across header, drawer, sections, and receipt completion: the shared primary Button at 48 px in the hero and 44 px elsewhere.
- Keep funding copy honest — Donate is direct support; Endow uses "designed to preserve" language with explicit risk.
- Hide unproven card methods by default. `comingSoon` is curated only.

**Don't:**
- Show the installed-PWA bottom `AppBar` in browser mode.
- Show `Connect Wallet` as a public header CTA.
- Imply Donate is tax-deductible, charitable, nonprofit-backed, or a legal receipt.
- Promise card payments before the provider proof registry confirms the exact tuple is `live`.
- Make the public site feel like an admin dashboard or KPI grid.
- Carry raw receipt tokens into analytics, query params, JSON bodies, or server-rendered URLs.
