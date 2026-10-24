---
version: alpha
name: Green Goods Public Browser Dialect
description: Editorial public-web overlay for the Warm Earth core DesignMD tokens.
extends: ../../DESIGN.md
surface: client-browser
dialect: public-browser
---

# Green Goods Public Browser: Design Brief

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
- Public route table: `/`, `/gardens`, `/gardens/:id`, `/impact`, `/fund`, `/vaults`, `/actions`, `/cookies`, `/glossary`. No new public route families beyond this list, with one recorded exception: the chat reporting ceremony pages under `/agent/reporting/*` (see below).
- **Unknown URLs redirect to `/`.** Only a garden's page says "not found" (`/gardens/:id`); no other route renders a 404 (DL-083).
- Garden identifiers in URLs accept both raw `id`/`address` and the deterministic slug from `publicGardenHelpers.deriveSlug`. Stale, missing, zero-match, or ambiguous slugs render the normal page with a localized non-blocking message, never a hard 404 on `/fund?garden=…`.

## SiteHeader

- **Fixed at top, fully transparent** on every public route: no background, no border, no blur. The header is removed from the layout flow so the hero image plate runs all the way to the top of the viewport and the header floats over it.
- **Fades out on scroll** rather than turning into a solid sticky bar. Opacity goes from `1` at the top to `0` after ~220px of scroll, with `pointer-events: none` once hidden so the page below stays interactive. The mobile drawer pins the header back to fully visible while open.
- **Keyboard focus brings the page to its top.** The header's controls stay in the tab order and in the accessibility tree while it is faded. When the keyboard reaches one, the page goes to its top, where the header is fully shown over the hero, as a header that scrolls with the page would be. A pointer press on a part-faded header does not move the page.
- **The footer does not repeat the routes** (Afo, 2026-10-12). A visitor at the foot of a page returns to the header, and keyboard focus brings the page to its top (below). Do not move route links into the footer to solve wayfinding; that was tried and reverted.
- Logo links home. **Nav order:** Gardens, Impact, Fund, Actions.
- **Primary CTA:** `Install App` (or `Open App` when `useInstallGuidance` reports already-installed). The CTA carries `data-install-action` from the guidance hook so the install logic stays one source of truth.
- **No wallet connect in the header.** Wallet connect appears only at the wallet-required step inside funding flows.
- Mobile drawer mirrors the desktop nav and footers with the same `Install App` / `Open App` CTA.

## Failure States

A visitor who meets a failure still sees a website. The failure is drawn where it happened and only as large as what failed (DL-083):

- **A page fails** (its code will not load, its loader throws, or it throws while rendering): the page is replaced by an ordinary editorial page inside the site's frame. `PublicPageError` is the banner hero with a title, one sentence, Reload and Browse Gardens, over the soil footer. `SiteHeader` stays, so the navigation still leads away. The public pages sit inside one route that carries `RouteErrorBoundary view="page"` (`errorFrame` in `config/routes.tsx`), which is what keeps `PublicShell` on screen. The state cannot sit on a page's own route: React Router renders nothing for a route whose code failed to load.
- **The site's frame fails** (`PublicShell`, the root route, or a provider): `PublicSiteError` is one linen card on the walnut ground, where the boot shell's recovery card sits, with the title, one sentence and Reload. It reads no provider and no router, so it renders whatever failed.
- **A reporting ceremony page fails** inside its focused bar, in the website's voice (DL-121): its own words in the serif sentence and its own act as the ghost button, as `PublicReadUnavailable` draws them, never the app's state block.
- **Offline**: when a page's code cannot be fetched without a connection, the title says so and the page reloads itself when the connection returns. Reload waits with it, so the browser's own offline page never replaces the site.
- **A new build**: a page whose code is from a build that is no longer served reloads itself once, and no error is shown.
- **A failed read is not an empty one.** A section whose read failed renders `PublicReadUnavailable`: the serif italic sentence ("This public record is temporarily unavailable. Please try again.", or the surface's own) and a Try Again that asks the read again. `PublicSurfaceState` renders it by default; the homepage's featured gardens and the lists on `/gardens`, `/actions`, `/fund` and `/impact` use it. An empty state is only for a read that succeeded and found nothing.
- **Never on the website**: an error message or code, a stack, "technical details", a copy-details action, a bug or warning illustration, or app chrome. Reports go to PostHog by themselves.

## Reporting ceremony pages (`/agent/reporting/*`)

The browser step of a chat report, review or account move: `/agent/reporting/:requestId`,
`/agent/reporting/recover/:requestId`, and the static `/agent/reporting/permissions`. They are
transactional pages that someone reaches from a chat link, usually on a phone, so they keep a
focused shell; funders and community members read them, so they take the website's look (DL-121):

- **Focused shell.** `PublicShell` renders `FocusedSiteHeader` for this prefix: the mark on a solid
  canvas and one Help control, with no navigation, no `Install App` CTA, no footer and no hero.
  Nothing leads away from a signature in progress. Help opens in place and explains the page, what
  becomes public and returning to the chat, and links the static permissions page and the support
  contact. The boot skeleton uses the matching `focused` variant.
- **Website surface (DL-121).** The shell carries `data-site="website"`, so shared buttons take the
  website's capsule, and the page keeps the website's white ground and Inter even inside an installed
  app. A page's buttons keep the app's 500 label: at the website's semibold, the act bar's two acts
  wrap on a 320px phone in Portuguese, and the bar keeps one height in every state. A panel is the website's white panel with a hairline edge and a 24px
  corner, the funding receipt's shape, which the shared card already draws. A list of facts is the
  receipt's rows: the label on the start side in the sub ink and the value at weight 500 on the
  end, with a hairline under each row. A failed or empty read is the serif sentence with its ghost
  button, and a field is the underlined editorial field. One narrow column, one step at a time,
  headings in Inter.
- **Website presentation even when installed.** The prefix is a public website prefix, so an
  installed app that captures the link still renders the page, not the PWA shell.
- **Wallet connect is allowed here**, at the proof step only, as in funding flows. The page connects
  an existing wallet or passkey. Only a link that joins a chat to an account may create one, and
  only when the person chooses to: no failed sign-in leads to a new account. A publish or review
  says up front that it takes two signatures.
- **Privacy.** Served `no-store`, `no-referrer` and `noindex`; analytics and error reports drop the
  link locator, and replays and element captures are not taken on these pages. They are not WebMCP
  routes.

## Homepage (`/`)

Composed of eight sections in this exact order (pinned by the section-order test in `PublicHome.test.tsx`):

1. **`PublicEditorialHero`**: full-bleed curated garden image plate. The linen content card sits as a **bottom-left overlay inside the hero image** (no negative overlap, no clipping, fully contained). The card carries the H1 (the tagline `From good intentions to green outcomes`), the one-sentence lede, and the hero CTAs.
   - **Desktop CTAs:** `Explore Gardens` (primary, to `/gardens`) and `Support a Garden` (secondary, to `/fund`), side by side. The `Install App` CTA already lives in the header on desktop, so the hero stays focused on the editorial gesture.
   - **Mobile CTAs:** `Install App` (or `Open App`) **first**, then `Explore Gardens` second. A phone visitor lands on the install path; the secondary keeps the editorial route open.
   - The CTAs land **above the fold** on standard browser viewports (1440 / 1024 / 768 / 375 px) because the card is contained inside the image, not protruding below it.
   - **Short screens:** where the viewport is too short for the card (a phone held sideways, a short desktop window), the hero grows past the first screen and the card starts one gutter below the header. It never slides under the header or off the top.
   - **Never** stats, route grids, wallet connect, or waitlist forms in the hero.
2. **`PublicFeaturedGardens`**: **four featured gardens in an editorial masonry column flow** (not a fake stagger). Image-backed gardens are preferred so the grid feels alive rather than placeholder-heavy. Curation comes from `packages/client/src/content/publicCuration.ts` keyed by garden id/address (canonical), with slugs as display aliases. Falls back to recent active gardens when curation is empty or unmatched. The section uses standard vertical rhythm, with no oversized top padding to absorb a hero overlap, since the hero is now self-contained.
3. **`PublicProofBand`**: confirmed counts only, five of them, covering what the listed gardens have documented (Gardens, Garden members, Approved submissions, Assessments), then Commitments kept across Green Goods (in the `/impact` § 02 band's words and from the same Agent read, which spans every pool rather than only the listed gardens; the band's sentence says so). Home shows kept, not made: a kept commitment is the proof (Afo, 2026-10-13); `/impact` § 02 shows both. The short last row sits centered (2 + 2 + 1, and 3 + 2 on the wide layout). A count that could not be read is a dash, never zero, and the commitment figure loads on its own. Links contextually to `/impact`. Unavailable carbon, water, species, and area metrics stay hidden. Renders on the warm linen surface in light mode and a warm walnut surface in dark mode (both via `--editorial-warm-rgb`); body text uses semantic tokens that auto-flip.
4. **`PublicRecordLoop`** ("How it works", "Four steps, season after season."): the visitor's plan, each step an action under its stage (Afo, 2026-10-13): Needs, *Assess the needs.*; Commitment, *Plan, then commit.*; Work, *Report the work.*; Funding, *Fund what grows.* The first three stages keep the `/impact` cycle's names and descriptions (`components/Public/cycleSteps.ts` owns them; change the words there, never in one page); `/impact` keeps Learnings as its fourth stage, and the shared loop line closes both. Each step links to where it can be seen: Needs to `/impact`, Commitment to `/gardens`, Work to `/actions`, Funding to `/fund`.
5. **`PublicWhoTendsAGarden`**: five persona portraits walking outward from the field (Gardener → Steward → Evaluator → Funder → Community Member), mirroring the canonical user-archetypes doc (personas themselves are canon in `v1-0.mdx` § 3.1). Gardener CTA is the install path; steward and evaluator CTAs route to docs because those roles are invited by an existing garden, not open sign-ups.
6. **`PublicFundingBridge`**: cardless trust section explaining the two public support paths, `Donate` through a garden cookie jar for direct support and `Endow` through a garden vault designed so yield supports the garden over time. One primary CTA routes to `/fund`; no wallet connect, amount form, or per-garden funding selector lives on Home.
7. **`PublicGetInTouch`**: the closing module, with email subscribe via `POST {VITE_API_BASE_URL}/public/subscribe` (single opt-in with explicit consent copy) plus a secondary Schedule-a-Call link from `VITE_GOOGLE_APPOINTMENT_URL`. The Schedule-a-Call link is inline after a divider, not inside its own card. **Honest UX**: success only when the public Agent route returns a confirmed `subscribed` / `already_subscribed`; Luma outages render a localized failure with the Schedule-a-Call fallback.
8. **`PublicFooter`**: compact provenance row with restored living-public-record message and links to Twitter, LinkedIn, GitHub, and Docs. Footer links are neutral by default; green is a hover/focus affordance only.

No final sitemap-style "choose your path" route grid.

### Compact utility footer

Every public-browser page ends with `PublicFooter`, a single quiet row containing:

- Small wordmark (`Green Goods`, regular Fraunces, base size, **not** the oversized italic display treatment).
- Twitter, LinkedIn, GitHub, and Docs, each opening in a new tab, and nothing else: no site routes, Glossary, or Admin (Afo, 2026-10-12; LinkedIn added 2026-10-13; `PublicFooter.test.tsx` pins the list).
- Copyright/provenance (`© <year> Green Goods. A living public record, rooted in regenerative work.`).

Stacks gracefully on mobile. Schedule-a-Call lives in `PublicGetInTouch` above the footer; the footer is wayfinding + provenance, not a hero moment.

## Banner Hero

Every public page but Home opens on `PublicEditorialHero variant="banner"`: a shorter image plate (340px, 420px from 640px, 500px from 1024px) with the linen card at its foot, spilling past it into the next section (64px, 80px from 640px). The section after a banner reserves top padding for the spill.

- **The card never slides under `SiteHeader`.** The plate's height is a minimum, not a fixed height. A card too tall for it (a narrow phone, a longer Spanish or Portuguese title, a stacked action row) grows the plate, so the card starts one gutter below the header (88px, 104px from 640px) and still spills the same distance. This is the homepage hero's short-screen rule, applied to the banner.
- Where the card fits, the plate keeps its height and nothing moves.
- The boot skeleton in `index.html` mirrors both rules; `bootFallbackGeometry.test.ts` pins the pair.

## `/gardens`

- Editorial header (kicker `Living Archive`, serif h1, lede).
- Featured row reuses `PublicGardenCard` with a `lead` variant on the first card.
- Browse section: search input over a structured garden grid. Cards link to `/gardens/:slug` and render confirmed-only metadata. No fake metrics.
- **Card anatomy** (also the `/fund` row's text, through `PublicGardenMeta`): image, name, description up to three lines, then two details lines: the place and the member count (`Awka, Nigeria · 13 members`), then approved submissions and the latest one's date (`16 approved submissions · Latest Aug 26, 2026`). Each pair shares a line wherever it fits; on a row too narrow for both (a `/fund` row two-up on a tablet) the second item moves under the first instead of clipping a short place name, and only a place longer than the whole row ends in an ellipsis. The place appears once, in that line, not as a kicker above the name. A wrapped details line never starts or ends on a separator dot (`EditorialMetaRow`).

## `/gardens/:id`

An ordinary editorial page, not a modal. It was briefly wired to a Radix dialog over the `/gardens` grid (an accident of an unrelated homepage-polish commit, not a decision), which cost the page its footer, gave an editorial long-read a nested scroll container, and left the return trip to the archive undefined.

- `PublicEditorialHero variant="banner"`. Image is the garden's own `bannerImage`, falling back to `getPublicHeroImage("gardens")`. The hero card shows the garden name first, followed by the location in regular sentence-case body text with normal letter spacing. Reserve two lines for the location and let longer names wrap without clipping; never style it as a kicker or eyebrow. The hero contains these identity details only; it has no description preview or expansion controls. A quiet text link, `← All Gardens`, sits directly below the overlapping hero card, without extra section-top whitespace. The full description appears once, always visible in the page body under “About this garden,” before the record strip. Long text wraps naturally; it does not change the hero card.
- Four-cell record strip under the hero: **Approved submissions · Garden members · Assessments · Certificates**. Do not widen it: the commitment-pooling section brings its own counts. **Garden members** is the garden's gardeners and stewards, each address once: the number its card and `/fund` row show as gardeners, and the home page's total is the same people across every listed garden. All three read `publicGardenHelpers.gardenerAddresses`; do not count people from approved Work in a view.
- Single-column numbered sections: **§ 01 Approved submissions → § 02 Commitments → § 03 Impact Certificates → § 04 Stewards**. No side rail; only the transactional `/fund` carries one, and the dialect treats boxed rails as chrome.
- § 02 Commitments is the garden's record across seasons and campaigns. Header and body both compose directly on the canvas in the page's own grammar: headers on linen, hairline dividers, § 01-style stat rows (the 2026-08-25 supersession of the PR-748 `EditorialPanel` body; no section on this page is card-wrapped). The record reads: the pool-state sentence beside the lifetime **Commitments made · Kept · Kept rate** (the rate only when `selectPublicPromiseKeptRate` publishes it), then the open season and campaigns beside the pool-wide exact-label units, then the finished cycles newest first, then the line that ties fulfilled commitments to § 03. A section body, not a rail. Never pause reasons, providers, addresses, canceled or disputed counts, or rankings.
- Approved submissions are an image-led grid in the `PublicGardenCard` restraint grammar (no border, radius, or shadow), twelve at a time with a local `Show more submissions`. A tile opens the `PublicRecordDrawer` record view with the full media, the gardener's note, and an attestation link.
- People (note authors, stewards) render through shared `AddressDisplay`, so an ENS name appears where one resolves.
- **Every section always renders.** An absent thing says it is absent. Ordinals stay stable between gardens, and a garden with nothing published yet still reads as a record in progress. A garden with no certificates shows § 03 with its empty line, never a jump from § 02 to § 04.
- **A failed read is not an empty one.** `usePublicGardenDetail` reports `partialData` / `unavailableSources`; a count whose source failed renders an em dash, never `0`, and its section says it could not load rather than claiming the garden is empty.
- Closes with `Support this Garden` (links to `/fund?garden=<slug>`) and `View public evidence`, then `PublicInstallCta`, then `PublicFooter variant="soil"`.
- No admin-only controls, role tools, or public-side conviction allocation.

## `/impact`

- § 01 proof markers: Approved submissions · Assessments · Gardens, in the home band's words. Impact Certificates join the row once one is public, counted across the gardens the ledger reads before its record cap (`PublicImpactSlice.certificateCount`). The row carries no figure it cannot read: the marker stays out before the first certificate, whenever a certificate read fails, and when a garden holds more certificates than one read takes (50). The count is then `null`, and the ledger's partial or capped notice explains the gap.
- § 02 Commitments band between the proof markers and the cycle: header and record both on the linen. "Commitments within communities" introduces the community story before two lifetime figures: commitments made (offers plus requests) and commitments kept (confirmed fulfilled count). **No money figure** (Afo, 2026-10-12): "funding" framed a mutual-aid record as a funding product, and its historical USD valuation is often unavailable. It returns only by his decision, under a name chosen then. The "some figures are unavailable" note shows only when the counts themselves are missing. `See the Gardens` closes the record. No open-pool count, percentage, per-garden table, or ordering. This band labels unavailable figures in words and uses no em dashes in its copy.
- Evidence cards from `usePublicImpactEvidence`, twelve to a page. **Prev and Next take the visitor to the top of the ledger**, with focus on its heading, so the next Tab continues from the first card; staying put left them at the bottom of a page they had not seen. Cards open `PublicEvidenceDialog` (a `PublicRecordDrawer` composition) with a readable assessment summary and an EAS reference link when available.
- Honest states: loading, empty, EAS-unavailable, `partialData`, `sourceLimitReached` (the v1 caps are 50 gardens / 100 records, sliced locally page-by-page).
- No Hypercert gallery placeholder, no Karma GAP claims.

## `/fund`

- **Order: § 01 Endowment engine → § 02 Ways to support → § 03 Choose a garden**, then the closing "Discuss Funding" line. The page opens with what already supports gardens, then explains the two paths before the list so a visitor has the context before choosing. This is the order before a 7 Oct change put the list first and the totals in a toggle at the foot (restored 2026-10-12 and 2026-10-13). A `?garden=` link still scrolls to its garden's row.
- **Nothing on `/fund` hides behind a toggle.** A garden with vaults shows its endowment in its row (`Endowment 2,005 DAI · 1.25 ETH · Yield accrued …`), and the endowment totals are the open section that leads the page. A garden without vaults leaves the line out; when the vault read fails, every row says `Not available right now` instead, so a failed read never looks like a garden without vaults.
- **Donate is always present on `/fund`, beside Endow (DL-027).** The hero lede names both paths, § 02 Ways to Support explains them once (Donate is direct support to a garden's shared fund through its cookie jar; Endow is a withdrawable deposit in the garden vault whose yield supports the garden), and every garden row in § 03 carries both actions. Do not hide Donate. A garden without a donation jar keeps the button, and its funding card says donations are not enabled yet.
- `?intent=<id>` mounts `PublicFundingReceipt` above the garden grid. Receipt UI reads the in-memory token (already scrubbed by Root) and only renders redacted public fields: garden, intent, amount, status, `fundingTxHash`, receiver wallet (Card Endow), and the management CTA when the receipt is an Endow receipt.
- `?manage=endowments` opens `PublicEndowmentPanel`; the URL never carries wallet addresses, account ids, or receipt tokens.
- `?garden=<id-or-slug>` resolves exact id/address first, then unique-slug match via `publicGardenHelpers.deriveSlug`. Stale / missing / zero-match / ambiguous queries render the regular Fund page with a localized non-blocking message and the matched garden (if any) scrolls into view with a soft ring highlight.
- Garden grid uses public garden rows with a `Donate` primary and an `Endow` warm secondary on every row, both 40 px (DL-023). § 03 also carries an always-visible `Manage Endowments` secondary action (the website's capsule, warm tone) aligned to the section header on desktop and stacked under the title on mobile.

### Funding UX

Wallet Donate and Wallet Endow share `PublicFundingCard`, which each garden row opens with the matching intent:

1. **Amount**: USD-first input with token selection resolved from the garden's Cookie Jars (Donate) or garden Vaults (Endow).
2. **Wallet**: Reown/wagmi wallet connect folds into the submit button and deposits directly to the selected jar or vault; an Endow names the connected wallet as receiver.

Card Endow remains part of the project scope but hidden until recovered-wallet ownership, exact vault-share verification, public visibility, and successful withdrawal proof pass. Card Donate proof never reveals Card Endow, and Card Donate does not appear on `/fund`; wallet Donate does (DL-027).

Manage Endowments is the only public withdrawal surface in v1. It is wallet-owned only, opens a right-side panel on desktop and a bottom sheet on mobile, leads with what the funder has supported, groups positions by garden, and expands each asset row inline for Withdraw / Max / confirm / pending / error / success. It does not include public address lookup, admin vault management, auto-buy claims, custody claims, public Donate, Card Donate, or visible Card Endow.

## `/vaults`

- Octant vault campaign crowdfunding surface (also the WebMCP-registered description). Editorial hero + campaign records from `getOctantVaultCampaigns`, each with live stats (`useOctantVaultStats`), strategy APY, and harvestable-yield reads.
- Endow opens `VaultCheckoutDialog`; managing positions opens `VaultManagePositionsPanel` (the `PublicEndowmentPanel` right-panel/bottom-sheet treatment).
- Same honesty rules as `/fund`: em dash for a failed figure, never `0`; risk copy uses "designed to preserve" language.

## `/actions`

- Domain filter chips (All / Solar / Agro / Education / Waste).
- `PublicActionCard` grid; cards open `PublicSourceDialog` with media and description. The Install App CTA belongs in the site header, not action details.
- No public create or edit controls.

## Record names

One name for a garden's approved work records wherever the website labels or counts them: **approved submissions** (`16 approved submissions`, `Approved submissions`), *trabajos aprobados* in Spanish and *trabalhos aprovados* in Portuguese. Not "entries", "field notes", or "approved work" for the same records, and the evidence ledger's kind filter says `Submission`. "Work" stays the name of the activity and of the cycle step. (QA review, 2026-10-12: the same 38 records carried four names across Home, `/impact` and the garden pages.)

## Typography

- **Fraunces** (serif) is reserved for editorial route heroes, large stat numbers, and garden story headings. Local font faces are declared in `packages/client/index.html`, with WOFF2 files and licenses in `packages/client/public/fonts/`; resolved by Tailwind's `font-serif` utility through `--font-serif` in shared `theme.css`.
- **Inter** carries body, nav, cards, buttons, and dialogs on the public website, including a public page opened inside the installed app. The installed app itself reads in Plus Jakarta Sans, the cockpit's face (DL-096; `DESIGN.pwa.md` § The Field Tool).
- Editorial headlines scale to magazine sizes (text-3xl → text-5xl); body stays restrained.
- The home page and the four navigation pages (Gardens, Impact, Fund, Actions) open on a hero title of three lines at every width. Their English titles are written as three `<line>` segments in the catalog and rendered with `EditorialTitleLine`, because the card's measure alone lets a small copy edit change the count. Keep each line within the desktop card, 456px at 60px type. Spanish and Portuguese titles are longer and wrap on their own.

### Trying a different editorial serif

Swap two places to test an alternative serif on the public browser:

1. Vendor the replacement font's WOFF2 files and license in `packages/client/public/fonts/`, then update the Fraunces font-face declarations in `packages/client/index.html`. Keep the Latin coverage needed for English, Spanish, and Portuguese.
2. `packages/shared/src/styles/theme.css` (`@theme` block): change the first family in `--font-serif` from `"Fraunces"` to the new family name.

That's it. No JSX touches; every `font-serif` headline picks up the new family. Validate with `bun run check --only design-tokens` and a Storybook spot-check.

#### Serif options (similar tone to Fraunces)

| Family | Voice | Notes |
|---|---|---|
| **Fraunces** (current) | Warm humanist with optical sizing; magazine | Variable woff2, full character |
| **Newsreader** | Editorial, slightly more bookish | Variable, narrower personality than Fraunces |
| **Lora** | Classic literary serif | Familiar, slightly more "blog" than "magazine" |
| **Source Serif 4** | Adobe humanist serif | Very legible at small sizes; slightly more corporate |
| **Marcellus** | Roman display serif | Display only, paired with Fraunces or Inter for body weights |
| **Crimson Pro** | Old-style book serif | Closer to print typography; warmer than Source Serif |
| **DM Serif Display** | Modern display serif | Strong identity, narrow weight range; for hero only |

Pairing rule: keep Inter as the sans companion; **never** pair two serifs on the public surface.

## Color & Tokens

- **Semantic Warm Earth tokens only.** Never raw color, radius, motion, or duration values. Image overlays use `text-static-white` / `bg-static-black` semantic tokens (audited via `check:design-tokens`).
- 4-role volume hierarchy: canvas 80–90% / ink 8–15% / stone 3–5% / accent green 1–3%.
- Accent green (`primary-action`) is reserved for interactive support / install CTAs. Editorial accents (kicker, link green) come from semantic primary-base.
- **Dark mode** is supported on all public-browser surfaces. Editorial-specific tokens (`--editorial-warm-rgb`, `--editorial-deep-rgb`) get warm dark overrides under `[data-theme="dark"]` so the Living Public Record and Get In Touch sections render as warm walnut with linen ink instead of cold neutral gray. Domain palette stays the same in both modes.

## Motion & Dialogs

- **Route transitions:** soft fades (no morphs).
- **Section reveals:** light stagger.
- **Return position:** back and forward belong to `ScrollRestoration`. `PublicShell`'s scroll reset skips POP navigations so it cannot race and win; pages that were reached from a list also hand focus back to the item that was opened. Only PUSH and REPLACE start at the top.
- **Record drawers** (`PublicRecordDrawer`, used directly by the garden page's field notes and, wrapped as `PublicEvidenceDialog`, by `/impact`'s evidence records): bottom sheet at `92vh` on mobile with a rounded top, right-side drawer at `sm:h-screen sm:max-w-[42rem]` on desktop. **Fixed height, never content-sized**: a persistent header bar (mono uppercase eyebrow + pill close) over a `flex-1 overflow-y-auto` body, so a long record scrolls inside the drawer instead of growing past the viewport. Use this for reading one published record.
  - **Images inside a record are bounded and uncropped**: `max-h-[40vh]` with `object-contain` on `bg-editorial-warm`, one per row. These are evidence photos, usually shot portrait; cropping hides what was documented, and unbounded ones ran past 2,000px and pushed the record's own title and source link off screen.
- **Source dialogs** (`PublicSourceDialog` on `/actions`, `PublicInstallDialog` from every Install CTA, `VaultCheckoutDialog` on `/vaults`, `PublicEndowmentPanel` on `/fund`, `VaultManagePositionsPanel` on `/vaults`):
  - Desktop: centered, square editorial sheet on `bg-static-black/40` overlay; `PublicEndowmentPanel` and `VaultManagePositionsPanel` are the exceptions and open as right-side public panels.
  - Mobile: bottom sheet with square corners, like every other editorial surface (DL-024). The record drawer above keeps its rounded top.
  - The actions inside these surfaces are the shared buttons (see Buttons and Fields): capsules, not square blocks.
  - Labeled title (`aria-labelledby` → `<h2>` id), Escape close, overlay click close, focus moved to the close button on mount.
  - Every mobile bottom sheet spans the full viewport width, with padding inside the sheet. Width caps apply only to desktop dialogs and side panels.
- **Modals portal to `document.body`.** `.editorial-section-reveal` applies a transform, and a transformed ancestor becomes the containing block for `position: fixed`, so a dialog rendered inside a revealed section sizes and scrolls against that section instead of the viewport. `PublicRecordDrawer` and `PublicSourceDialog` portal internally, so a consumer is safe wherever it is rendered. Do not rely on a call site happening to sit outside a transform.
- **A record drawer or source dialog hands focus back to its opener.** `PublicRecordDrawer` and `PublicSourceDialog` return focus to whatever held it when they opened, and leave the page where it was. A card that opens one takes focus in its press handler first: Safari does not focus a pressed button, so the overlay would otherwise have nothing to return to.
- Source-morph transitions require unique transition names per item; until that lands, public surfaces fall back to simple fades.
- All motion respects reduced-motion preferences.

## Buttons and Fields

The public site uses the same button and field system as the installed app (DL-024):

- **Actions** come from the shared `Button`, `IconButton`, and `Chip`. Every button is a capsule with a semibold label, whatever its emphasis or size, and keeps that shape while pressed (DL-026, DL-089); a text action (arrow links such as `Show more entries`) has no container, a close is a circle, and a filter chip is a capsule. The vault and cookie flows follow the same rule: square surfaces, capsule buttons.
- **Editorial atoms** (`EditorialPrimaryButton`, `EditorialGhostButton`, their link variants, and `EditorialDomainChip`) are thin wrappers over the shared primitives that pass `size` through and add only the dialect's colors: the warm linen secondary, the walnut-surface secondary, and each domain's ink on an active filter chip.
- **Sizes** follow the shared scale (DL-023): 48 px for hero actions, 44 px for section actions and dialog actions, 40 px for row actions (Donate, Endow), 32 px chips with a 44 px tap area. One size per context: the `Install App` CTA is 48 px in the hero and 44 px everywhere else, including the header drawer.
- **Fields** are the editorial underline field (`surface="editorial"`: no box, a hairline in the text color, serif input text) on editorial sections, and the 16px shared field inside funding and account panels (DL-022). Display-size text never changes a field's height: the Get in Touch email and both funding amounts are 44 px, level with the actions beside and below them.
- **Square stays** for editorial cards, dialogs, panels, and image tiles.

## Imagery

- Real community garden imagery wherever available; deterministic local fallback set.
- Cinematic photography of the places where gardens grow: neighborhood, context, scale.
- Avoid generic "hands holding seedlings" and decorative gradients.
- Garden cards should feel distinct and alive, not a SaaS card grid.

## Receipt-Token Safety

- Receipt URLs ship as `/fund?intent=<id>#receiptToken=<token>`.
- Root pre-pageview bootstrap moves the token from the URL fragment into short-lived session state and calls `history.replaceState` before initial analytics fires.
- `usePageView` redacts sensitive hash keys (including `receiptToken`) so `page_view.hash` never carries the token even if a downstream view re-introduces a hash.
- Public receipt reads call `GET /public/funding-intents/:id` with `X-GG-Receipt-Token` only, never query params or JSON body. Receipt UI never shows payer email, provider ids, raw failure detail, webhook payloads, or the raw token itself.
- Endow receipts route to `/fund?manage=endowments`; no wallet/account identifier is placed in the receipt URL or management URL.

## Do's and Don'ts

**Do:**
- Test browser layouts at 1440px, 1024px, 768px, and 375px.
- Let real garden imagery carry the first impression.
- Use the same `Install App` CTA across header, drawer, sections, and receipt completion: the shared primary Button at 48 px in the hero and 44 px elsewhere.
- Keep funding copy honest: Donate is direct support; Endow uses "designed to preserve" language with explicit risk.
- Hide unproven card methods by default. `comingSoon` is curated only.

**Don't:**
- Show the installed-PWA bottom `AppBar` in browser mode.
- Show `Connect Wallet` as a public header CTA.
- Imply Donate is tax-deductible, charitable, nonprofit-backed, or a legal receipt.
- Promise card payments before the provider proof registry confirms the exact tuple is `live`.
- Make the public site feel like an admin dashboard or KPI grid.
- Carry raw receipt tokens into analytics, query params, JSON bodies, or server-rendered URLs.
