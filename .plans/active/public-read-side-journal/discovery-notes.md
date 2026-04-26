# Discovery Notes — Public Read-side / Living Archive Journal

**Slug:** `public-read-side-journal`
**Lane:** A — Discovery
**Date:** 2026-04-25
**Source of truth:** `.plans/active/public-read-side-journal/plan.todo.md`

> Lane A is **discovery only**. No source files were modified. Subsequent lanes (B data hooks, C route shell, D pages) consume this map.

---

## 1. Existing scaffold inventory

### `packages/client/src/views/Landing/index.tsx` (60 LOC)

- **What's there:** A thin shell that renders `<Hero />` from `@/components/Layout/Hero` and wires an email subscription `POST /api/subscribe` with toast feedback. No editorial framing, no Living Archive language, no photography, no `Vol.` marker.
- **Reusable:** the `handleSubscribe` POST contract (could be repurposed as the "Join the Mission" mailing-list capture if Afo wants that flow retained on the new landing).
- **Replace / rewrite:** the entire visible composition. The current `<Hero />` is an *install-the-PWA hero* (QR code, `DeviceFrameset` mockup, smart install guidance, manual-install dialog) — useful in its own right but **not** the editorial Living Archive hero the Stitch design calls for. See § Conflict 1 in the gap list.
- **Note:** `Landing` is currently mounted at `/landing` (not `/`); root `/` goes through `PlatformRouter` → installed PWA gets `/home`, browser gets `/gardens`. Lane C will need to decide whether the journal landing replaces `/gardens` as the default browser destination, or whether `/` for browser visitors becomes the journal landing.

### `packages/client/src/views/Public/Gardens.tsx` (79 LOC)

- **What's there:** Read-only marketplace grid. Custom `<h1>` + skeleton + 1/2/3-col grid of inline-styled cards (banner image + name + description + gardener/work count). Uses `useGardens` from shared. Each card is a `Link` to `/gardens/:id`.
- **Reusable:** the `useGardens` data shape, the routing pattern (`Link` to `/gardens/:id`), and the page-level layout intent (responsive grid).
- **Replace / rewrite:** the inline card markup. There is already a richer `GardenCard` primitive in `@green-goods/shared` — this view re-implements card layout instead of using it. The replacement journal "Site" card needs a Verified Site badge, Restoration Progress %, Species Planted stat, and (optionally) Pollinator Index — none of which `GardenCard` exposes today.

### `packages/client/src/views/Public/GardenDetail.tsx` (76 LOC)

- **What's there:** Banner image + name + description + location + gardener/work count + a "Join this Garden" CTA linking to `/home/:id`.
- **Reusable:** the route shape (`/gardens/:id`) and the existing `useGardens().find(g => g.id === id)` lookup.
- **Replace / rewrite:** the body composition. Stitch's Site detail (inferred — not in the two screens, but implied by the Sites list pattern) needs Field Notes feed scoped to this site, stewards list, evaluator attestations (Verified Site badge + provenance), Restoration Progress, Species Planted, hero photography. The current page is sparse. Detail page is **likely the second-most-important Lane D build** after the landing.
- **Lane B dep:** The detail view needs hooks beyond `useGardens` — at minimum a public field-note feed scoped by garden, an evaluator-attestation read, and aggregate stats per garden.

### `packages/client/src/views/Public/Actions.tsx` (85 LOC)

- **What's there:** Read-only action template gallery. Custom h1 + skeleton + grid of cards with banner image + title + description + domain badge (Solar/Agro/Education/Waste). Uses `useActions`.
- **Reusable:** the `useActions` hook and the domain-label mapping.
- **Replace / rewrite:** the inline card markup. The Stitch design does **not** specify a generic "Actions" page — what it shows is a Field Notes *feed* (location pin + focus tag + ID number), which is closer to the Stitch Field Note Card concept than the current "action template gallery." If `/actions` is preserved as a route, it likely should be repositioned as the action *templates* catalog (the menu of regenerative work a Steward can document), distinct from the Field Notes feed.
- **Vocabulary watch:** the current view is named "Actions" both as route and copy. The Stitch design uses "Field Notes" for the public-facing feed of submitted work. Per § 5, `Action` stays canonical for the *template/type* concept; `Field Note` is the public face of a *submitted Work*. These are two different entities, not a rename.

### `packages/client/src/views/Public/Fund.tsx` (158 LOC)

- **What's there:** Garden gallery with two CTAs per card — `Deposit` (opens `VaultDepositDialog`) and `Cookie Jar` (opens `CookieJarDepositDialog`). Connect-wallet fallback at the bottom. Aggregate stats banner (Total Gardens / Total Gardeners).
- **Reusable:** the `VaultDepositDialog` + `CookieJarDepositDialog` integration is the core "Fund a Site" flow and stays exactly as is. The wallet-modal-on-click pattern (`if (!primaryAddress) openWalletModal()`) is the right pre-deposit guard.
- **Replace / rewrite:** the page chrome. The Stitch landing's "Become a Steward / Fund a Site" twin CTA is at the *landing-hero* level, not a separate page — `/fund` becomes the *destination* of the "Fund a Site" CTA. The aggregate stats block on this page is duplicative with the Impact page; consolidate or remove.

### `packages/client/src/views/Public/Impact.tsx` (97 LOC)

- **What's there:** Three-stat strip (Total Assessments, Total Gardens, Total Gardeners) + a hypercert assessment grid (placeholder thumbnails per assessment).
- **Reusable:** the stat-aggregation pattern from `useGardens`. The conceptual frame matches Stitch's "Quantifiable Restoration" section.
- **Replace / rewrite:** the visual treatment. Stitch frames stats as confident editorial type ("1.2k tons", "+45%", "4,280 SQ FT") with a small label. Current treatment is a generic three-card strip. Stat semantics also don't match — Stitch wants Carbon Sequestered, Water Retention Increase, Species Planted, Network Total. Lane B will need to extend the indexer-derived aggregation to surface domain-specific units rather than just count metrics.

### Cross-cutting violations to note (not fix in Lane A)

- All five Public views build their own `<h1>` + description blocks instead of using a `PageHeader`-equivalent — fine for browser editorial pages where the heading composition is bespoke (`PageHeader` is admin-flavored), but worth flagging for Lane D consistency.
- All five views use raw Tailwind skeletons (`<div className="h-48 rounded-xl bg-bg-weak animate-pulse" />`) instead of the shared `Skeleton` primitive.
- `GardensGallery` re-implements card layout inline instead of using the shared `GardenCard` — Lane D should either consume `GardenCard` directly or extend it (see § 3).

---

## 2. Stitch sections → primitives mapping

Two Stitch screens delivered 2026-04-25: **Landing** ("From Good Intention To Green Outcomes") and **Field Notes / Living Archive** ("The Living Archive of Regeneration").

| # | Stitch section | Existing primitive | Verdict |
|---|---|---|---|
| 1 | Top nav — `Green Goods` logo + IMPACT / GARDENS / ACTIONS + `Sign In` + `Join the Mission` | `packages/client/src/components/Navigation/SiteHeader.tsx` | **Partial.** Logo + sticky + backdrop-blur shell exists. **GAP**: nav items differ per route (Landing uses IMPACT/GARDENS/ACTIONS; Field Notes page uses Stories/Impact/Field Notes), and the right-side CTA pair (`Sign In` + `Join the Mission`) is different from the current single `Connect Wallet` button. Needs route-aware nav config + a CTA-pair slot. Possibly rename: `Connect Wallet` → `Sign In` (existing wallet flow) and add `Join the Mission` (mailing-list capture, reusing Landing's `handleSubscribe`). Confirm copy with Afo. |
| 2 | Editorial hero — full-bleed cinematic landscape photo + headline serif italic green-accent on emphasis word | none | **GAP**: net-new `JournalHero` (or similarly-named) primitive. The existing `Hero` in `@/components/Layout` is the PWA-install hero — different concept, name collision flagged in § 3 (G1). |
| 3 | Site location plate ("Pacific Northwest Conservatory · Active Monitoring") layered over hero photo | none | **GAP**: net-new `LocationPlate` primitive. Glass material, hero-overlay placement. Likely lives in `packages/client/src/components/Display/` or alongside the hero. |
| 4 | `FIELD REPORT 001` eyebrow above hero headline | none | **GAP**: net-new `Eyebrow` primitive. Small caps, letter-spaced, ink-on-canvas. Used both above the hero headline and probably above section headers — generic enough to be a Tier-2 atom. |
| 5 | "Live Observations" trio of cards (Verified Site badge, Restoration Progress %, Species Planted, Pollinator Index, Network Total) | `@green-goods/shared` `GardenCard` (partial) | **EXTEND or NEW**: Stitch's site card carries data points the existing `GardenCard` doesn't expose (verified status, restoration %, species count, pollinator index). Two viable shapes: (a) extend `GardenCard` with optional verified/progress/species/index slots controlled by a `variant="public-journal"` flag, or (b) net-new `SiteCard` in `packages/client/` that composes `ImageWithFallback` + `Badge` + verified-site signal + named stats. **Recommend (b)** because the rendering is markedly different (taller, photo-led, editorial type) and the data inputs are public-aggregate (indexer/EAS) rather than the operator-facing membership focus of `GardenCard`. Ambiguity to flag (per advisor): the Live Observations *trio* on the landing might be the same card with a `variant="featured"` prop, or a markedly different photo-led variant — assume same primitive with feature variant for now. |
| 6 | Verified Site badge | none directly; `StatusBadge` with custom variant adjacent | **GAP**: net-new `VerifiedSiteBadge` (or extend `StatusBadge` with a `variant="verified-site"` semantic variant). Carries a check-mark icon + "Verified Site" copy + tertiary-green accent + (optional) attesting-evaluator name. **Recommend new primitive** because the semantic is editorial credibility, not work status — the existing `StatusBadge` is overloaded with work statuses (approved/rejected/pending/syncing/etc.) and would muddy that contract. |
| 7 | Restoration Progress % | none | **GAP**: net-new `ProgressStat` primitive (or accept as an inline composition inside `SiteCard`). Tertiary green progress arc/bar + label + percent value. Likely small enough to live as an internal piece of `SiteCard` rather than a standalone primitive — flag for Afo's call. |
| 8 | Species Planted stat (per-card) | `@green-goods/shared` `StatCard` (loose match) | **GAP**: `StatCard` exists but its visual contract is a chip-style icon-tile + numeric value (admin-flavored). Stitch wants editorial-weight type — large numeric, small label, no chip background — at the *card-internal* scale. Treat as an internal piece of `SiteCard`. The standalone editorial stat tile (item #15) is a different surface scale. |
| 9 | Network Total stat (per-card) | same as #8 | **GAP**: same — internal piece of `SiteCard`. |
| 10 | Wetland Restoration card (the larger photo-led card on the landing) | none | **GAP**: same primitive as #5 with a `variant="feature"` (or similar) — taller, more photography, fewer stats. Pending Afo's visual pass on whether this is one card primitive or two. |
| 11 | Twin CTA `Become a Steward` / `Fund a Site` | none specific | **GAP**: net-new `JoinCTAStrip` (or two-button section). Tertiary-green primary `Fund a Site` (linking `/fund`) + tertiary-green-outline secondary `Become a Steward` (linking somewhere — open question, possibly `/about` or a stewardship onboarding form). Could just be hand-rolled per page in Lane D, but a reusable component keeps copy + spacing + concentricity consistent. |
| 12 | `Vol. IV — Autumn` volume marker | none | **GAP**: net-new `VolumeMarker` primitive. Small caps + serif italic accent + canvas-on-canvas styling. Per the plan's open question, **hardcode `Vol. I — Onboarding & Cultivation`** in v1 until Seasons-as-primitive ships. Renders above the editorial hero on the Field Notes / Living Archive page. |
| 13 | Field Notes feed cards (Mycorrhizal Networks, Multi-Species Cover Crop, Silvopasture Integration — image + location pin + focus tag + ID number) | none | **GAP**: net-new `FieldNoteCard` primitive. Composes `ImageWithFallback` + location-pin badge + focus-tag (`Soil`, `Forage`, `Carbon`, etc.) + identifier (`No. 042` or similar) + headline serif. Distinct enough from `WorkCard` (which carries operator-facing status, gardener identity, retry/error UI) that **net-new** is correct. Flag for Afo: the focus-tag taxonomy and ID-numbering scheme need governance — possibly maps to action `domain` (Solar/Agro/Education/Waste) plus a sequential id, or it's a curated subset of approved Works with a public flag. |
| 14 | "Quantifiable Restoration" stats section (Carbon Sequestered, Water Retention Increase) | `@green-goods/shared` `StatCard` (loose match) | **GAP** at the surface scale — Stitch's editorial stats are large display-weight numerics with small uppercase labels, no icons, no chip. Recommend net-new `EditorialStatTile` in `packages/client/` rather than overloading `StatCard` (which is widely consumed in admin and PWA at a different scale). |
| 15 | Footer manifesto links | none | **GAP**: net-new `SiteFooter` primitive. `PublicShell` currently renders only `SiteHeader` + `<Outlet />` — there's no footer at all. Holds manifesto copy, Evidence Commons framing, sibling-ecosystem links (Coop / WEFA / Gardens V2), repo + governance links, mailing-list capture (mirrors `Join the Mission`). |
| 16 | Photography (full-bleed, cinematic, naturalist) | `ImageWithFallback` + `GardenBannerFallback` + `ActionBannerFallback` (partial) | **Reusable.** `ImageWithFallback` already races IPFS gateways and applies Pinata optimization — perfect for the journal's heavy imagery. Lane D should keep using it. The fallback components already handle a "no image yet" case, but the editorial fallback may want a quieter, more neutral treatment than the colorful banner fallbacks designed for in-app contexts. Possible variant flag, or a third fallback `JournalImageFallback`. |
| 17 | Editorial serif typography | not yet wired | **GAP** at the implementation level. `DESIGN.md` calls for `Fraunces / Lora / Newsreader` as the editorial serif, restricted to the public browser surface only. **Plan open question**: confirm font choice; load via `@font-face` self-hosted (per privacy/perf constraint in plan). The CSS plumbing (font-face declarations, utility class like `.font-editorial`) is a Lane D shell setup — flag as a dependency. |

---

## 3. Gap list (ranked by Lane D blocker)

Each gap names: location, behavior, suggested API shape, extends-or-new.

### Tier 1 — Lane D Landing build cannot start without these

**G1. `JournalHero` — editorial hero shell** *(net-new)*
- **Location:** `packages/client/src/components/Layout/`
- **Conflict flag:** `Hero` already exists in this folder as the PWA-install hero (QR + DeviceFrameset + install guidance). Do NOT name the new primitive `Hero`. Recommended name: `JournalHero` or `EditorialHero` — Afo to decide, possibly with rename of the existing `Hero` to `InstallHero` for clarity. **Surface this collision before naming.**
- **Behavior:** Full-bleed photographic background, editorial serif headline with italic green-accent emphasis word, optional eyebrow slot above headline, optional location-plate slot overlaid on image, optional CTA-strip slot below headline.
- **Suggested API:**
  ```tsx
  type JournalHeroProps = {
    image: string;                    // IPFS URL or hosted asset
    imageAlt: string;
    eyebrow?: ReactNode;              // <Eyebrow>FIELD REPORT 001</Eyebrow>
    headline: ReactNode;              // accepts JSX for inline italic accent
    subhead?: ReactNode;
    locationPlate?: ReactNode;        // <LocationPlate> overlay
    ctaSlot?: ReactNode;              // <JoinCTAStrip />
    variant?: "landing" | "field-notes"; // sets aspect, type scale
  };
  ```

**G2. `SiteCard` — editorial Site primitive** *(extends concept of `GardenCard`, but recommend net-new)*
- **Location:** `packages/client/src/components/Cards/`
- **Behavior:** Photo-led card with verified badge, restoration progress %, named stats (species planted, pollinator index, etc.), site name, location, focus tag.
- **Suggested API:**
  ```tsx
  type SiteCardProps = {
    site: PublicSiteSummary;          // Lane B-defined shape
    variant?: "default" | "featured"; // featured = larger, fewer stats
    showVerifiedBadge?: boolean;
    showProgress?: boolean;
    stats?: Array<{ label: string; value: string }>;
    onClick?: () => void;
  };
  ```
- **Why net-new vs. extend `GardenCard`:** `GardenCard` is consumed in admin and PWA with operator-membership semantics (members count, operators list, selection state for wizards). Bolting verified-site/progress/species into it muddies the contract. The journal Site is the *public-facing aggregate* of a Garden, not the same data shape.
- **Ambiguity:** Live Observations trio on landing vs. Sites list — recommend assume same primitive with `variant="featured"` for the trio. Flag for Afo's visual pass.

**G3. `VerifiedSiteBadge`** *(net-new — do not reuse `StatusBadge`)*
- **Location:** `packages/client/src/components/Display/` or `packages/client/src/components/Badge/`
- **Behavior:** Small chip — checkmark icon + "Verified Site" copy + tertiary-green accent. Optional `attestedBy` prop showing the attesting evaluator's display name with a tooltip linking to provenance.
- **Suggested API:**
  ```tsx
  type VerifiedSiteBadgeProps = {
    attestedBy?: string;              // evaluator display name
    onClick?: () => void;             // opens provenance drawer / popover
    size?: "sm" | "md";
  };
  ```
- **Why not extend `StatusBadge`:** `StatusBadge` is overloaded with work statuses (approved/rejected/pending/syncing/sync_failed/uploading/offline). Adding "verified-site" muddies that contract and risks visual collision in shared lists.

**G4. `JoinCTAStrip` — twin CTA primitive** *(net-new, optional — could be hand-rolled)*
- **Location:** `packages/client/src/components/Layout/` or inline per-page
- **Behavior:** Tertiary-green filled primary CTA + tertiary-green outline secondary CTA, with consistent spacing and concentricity. Default labels "Fund a Site" / "Become a Steward" but configurable.
- **Suggested API:**
  ```tsx
  type JoinCTAStripProps = {
    primary: { label: string; to: string };
    secondary: { label: string; to: string };
  };
  ```
- **Recommendation:** Build only if more than one page uses this composition. Otherwise inline the two buttons in the landing.

### Tier 2 — Field Notes feed page depends on these

**G5. `FieldNoteCard`** *(net-new)*
- **Location:** `packages/client/src/components/Cards/`
- **Behavior:** Image + location-pin badge + focus-tag (Soil/Carbon/Forage/etc.) + ID number ("No. 042") + headline serif + short body excerpt + author/site attribution.
- **Suggested API:**
  ```tsx
  type FieldNoteCardProps = {
    fieldNote: PublicFieldNote;       // Lane B-defined shape
    variant?: "default" | "featured";
    onClick?: () => void;
  };
  ```
- **Why net-new vs. extend `WorkCard`:** `WorkCard` is operator-focused (status, retry, error, sync state, gardener identity); `FieldNoteCard` is reader-focused (story, attestation, public ID, focus taxonomy). Different audience, different visual scale.

**G6. `VolumeMarker`** *(net-new)*
- **Location:** `packages/client/src/components/Display/`
- **Behavior:** Renders volume label (e.g. `Vol. I — Onboarding & Cultivation`) in serif italic + ink-on-canvas styling, intended to live above editorial heroes on Field-Notes-/ Stories-flavored pages. Hardcode v1 string until Seasons-as-primitive ships.
- **Suggested API:**
  ```tsx
  type VolumeMarkerProps = {
    label: string;                    // "Vol. I — Onboarding & Cultivation"
    align?: "left" | "center";
  };
  ```

### Tier 3 — Atoms used across multiple Tier-1/2 primitives

**G7. `Eyebrow`** *(net-new atom)*
- **Location:** `packages/client/src/components/Display/`
- **Behavior:** Uppercase, letter-spaced, small, ink-on-canvas. Renders above hero headline (`FIELD REPORT 001`) and above section headers throughout journal pages.
- **Suggested API:**
  ```tsx
  type EyebrowProps = {
    children: ReactNode;
    tone?: "ink" | "stone" | "accent";
  };
  ```

**G8. `LocationPlate`** *(net-new atom)*
- **Location:** `packages/client/src/components/Display/`
- **Behavior:** Small overlay chip placed on hero imagery. Glass material (regular thickness OK on hero photos), holds site name + status string ("Pacific Northwest Conservatory · Active Monitoring").
- **Suggested API:**
  ```tsx
  type LocationPlateProps = {
    siteName: string;
    status?: string;                  // "Active Monitoring", "Recently Verified", etc.
    onClick?: () => void;
  };
  ```

**G9. `EditorialStatTile`** *(net-new — do not extend `StatCard`)*
- **Location:** `packages/client/src/components/Display/`
- **Behavior:** Editorial-weight large numeric + small uppercase label + (optional) trend indicator. No chip, no icon background. Used in the "Quantifiable Restoration" section and possibly inside `SiteCard`.
- **Suggested API:**
  ```tsx
  type EditorialStatTileProps = {
    value: ReactNode;                 // "1.2k tons", "+45%", "4,280 SQ FT"
    label: string;
    unit?: string;                    // alternative to inlining unit in value
    trend?: "up" | "down" | "neutral";
  };
  ```
- **Why not extend `StatCard`:** `StatCard` has a colored icon tile that defines its visual identity and is widely consumed in admin/PWA. Editorial stats need a different anatomy (no icon, no chip background, type-led).

### Tier 4 — Page-shell primitives

**G10. `SiteFooter`** *(net-new)*
- **Location:** `packages/client/src/components/Layout/` (must mount inside `PublicShell`)
- **Behavior:** Holds manifesto copy, Evidence Commons framing, sibling-ecosystem links (Coop / WEFA / Gardens V2), repo + governance links, optional mailing-list capture (mirrors landing's `Join the Mission` form).
- **Suggested API:**
  ```tsx
  type SiteFooterProps = {
    showMailingList?: boolean;
    handleSubscribe?: (e: React.FormEvent<HTMLFormElement>) => void;
  };
  ```

**G11. `SiteHeader` extension — route-aware nav + CTA pair** *(extends existing)*
- **Location:** `packages/client/src/components/Navigation/SiteHeader.tsx`
- **Behavior:** Today the nav items are hardcoded as `Gardens / Actions / Impact / Fund` and the right side has a single `Connect Wallet` button. Stitch shows two distinct nav configurations (Landing: IMPACT/GARDENS/ACTIONS; Field Notes: Stories/Impact/Field Notes) and a CTA pair (`Sign In` + `Join the Mission`).
- **Recommendation:** keep `SiteHeader` as a single component, add a route-aware nav config (the component reads route, picks one of N nav sets), and replace the single CTA with a CTA-pair slot. The signed-in destination still routes to `/home` via the existing wallet integration. `Join the Mission` is a new mailing-list flow — likely opens a small dialog using `DialogShell` and POSTs to `/api/subscribe` (existing endpoint in `Landing/index.tsx`).
- **`Sign In` copy — semantic risk to flag.** Green Goods is wallet-based (AppKit + AuthProvider). Renaming the existing `Connect Wallet` button to `Sign In` is not just a copy preference — it sets visitor expectations of password/account auth and may mislead non-crypto visitors. Two safer reads of the Stitch label: (a) keep `Connect Wallet` and treat the Stitch `Sign In` as a stylization, or (b) use `Sign In` as the visible label *and* show the wallet flow underneath. Recommend Afo confirm the auth-model intent before Lane C lands the copy change.
- **Open question:** confirm copy pair (`Sign In` / `Join the Mission`) and confirm whether the desktop nav uppercase styling is required.

### Tier 5 — Typography + asset shell

**G12. Editorial serif font wiring** *(infra, not a component)*
- **Location:** `packages/client/src/styles/` (font-face), `packages/client/public/fonts/` (asset)
- **Behavior:** Self-host one of `Fraunces / Lora / Newsreader` (Afo to confirm) via `@font-face` per the plan's privacy/perf constraint. Add a `.font-editorial` utility class so journal components can opt in. Restricted to public-browser surface only — never on PWA/admin.
- **Why infra not component:** the font is consumed by `JournalHero`, `VolumeMarker`, `FieldNoteCard`, `EditorialStatTile`. Lane D will block on this being wired before any of those land.

**G13. Responsive `<picture>` / `srcset` extension on `ImageWithFallback`** *(extends shared)*
- **Location:** `packages/shared/src/components/Display/ImageWithFallback.tsx`
- **Behavior:** Plan §4 calls for "image-heavy pages need responsive `<picture>` with width hints" and a Lighthouse mobile score ≥ 90 with LCP < 2.5s on 3G. The current `ImageWithFallback` races IPFS gateways and applies a single `img-width=800` Pinata optimization, but emits a single `<img src>` — no `srcset`/`sizes`, no `<picture>` source set. The journal's full-bleed photography pages need responsive variants.
- **Recommendation:** extend `ImageWithFallback` with optional `srcSet` / `sizes` / `breakpoints` props (preserving its IPFS-race logic) rather than introducing a parallel primitive. **Watch the Tailwind shared-scanning gotcha** — keep utility classes on the consumer side, not in the shared component.
- **Why infra-flagged here:** Lane D's image-heavy pages (Landing hero, Sites detail hero, Field Notes feed) won't hit the LCP budget without this. Block before Lane E polish.

---

## 4. Recommendations — extend vs. net-new placement

Given the Tailwind v4 shared-scanning gotcha (utility classes in `packages/shared/src/` silently fail in the client build), the editorial serif being browser-only, and the absence of an admin reuse path for journal primitives, **all Tier 1–4 primitives should live in `packages/client/src/components/`**, not `@green-goods/shared`. That keeps the editorial dialect contained where it belongs and avoids the shared-scanning trap.

The two existing shared cards (`GardenCard`, `WorkCard`) **should not be extended** to absorb the journal use case — both carry operator-facing concerns (membership, status, retry, sync) that don't translate to public reading and would muddy their contracts in admin/PWA. Net-new `SiteCard` and `FieldNoteCard` in client keep the journal dialect crisp and let the existing primitives stay focused.

`StatusBadge` and `StatCard` similarly should not be extended — `StatusBadge` is already overloaded with work-status semantics, and `StatCard` carries an icon-chip anatomy that conflicts with editorial stats. Net-new `VerifiedSiteBadge` and `EditorialStatTile` in client.

`SiteHeader` is the one exception — it already lives in the right place (browser-only, in `packages/client/`) and just needs route-aware nav config + a CTA-pair slot.

`ImageWithFallback` (shared) is a clean reuse — IPFS gateway racing and Pinata optimization are exactly what the journal's photography-heavy pages need. The only watch is that the existing branded fallbacks (`GardenBannerFallback`, `ActionBannerFallback`) may feel too colorful for journal contexts; consider a quieter `JournalImageFallback` variant if the editorial palette demands it (Afo visual pass).

The 4-role volume hierarchy (canvas 80–90% / ink 8–15% / stone 3–5% / accent green 1–3%) is the strongest constraint on this surface. Editorial pages tend to lean on canvas + photography, which is on-brief — but the twin CTA, Verified Site badge, and Restoration Progress arc all want green. Be deliberate: green should appear as inline accent in the headline, the primary CTA, and the verification signals — *not* as section backgrounds, card surfaces, or large hover states. Stitch's screens read on-brief from the descriptions; Lane D should keep that volume discipline.

---

## 5. Vocabulary alignment

The plan's Open Questions already proposes "keep `Garden` as the canonical entity; allow `Site` as visible label only on the read-side public surface." Lane A affirms that recommendation and maps each Stitch term:

| Stitch term | Codebase entity | Recommendation | Conflict? |
|---|---|---|---|
| **Site** | `Garden` | Adopt `Site` as visible label on public read-side only. Internal types and hooks stay `Garden` (`useGardens`, `Garden` type). **Route segments**: the plan §3 calls for `/sites (alias /gardens)` and `/sites/:slug` as canonical URLs. Lane A affirms that direction — both segments resolve to the same view, with `/sites` as the canonical browser-facing URL and `/gardens` retained as a redirect/alias for backward compatibility. Lane C owns the routing decision; if dual-route maintenance is too much, falling back to `/gardens` only with a copy-only Site relabel is acceptable. Public copy in headlines, captions, breadcrumbs reads "Site." | No conflict if the label-only boundary is held at the type/hook layer. **Watch**: don't introduce a `Site` type or `useSites` hook — keep the rename at copy + URL only. |
| **Field Note** | `Work` (with public flag) | Adopt `Field Note` as the public face of a Work. Internal types/hooks stay `Work`. **Open governance question per the plan**: are Field Notes a curated subset of Work submissions (Operator marks public), or all approved Works made readable? **Lane A flags this as a Lane B/governance dependency, not a vocabulary question.** | No vocabulary conflict — but the data-source decision is unresolved. Default to "opt-in public flag at the Work level, default false" per the plan's recommendation. |
| **Steward** | `Operator` | Adopt `Steward` on the read-side public surface (e.g. `Become a Steward` CTA, "Stewards of this site" attribution). Internal admin/PWA copy stays `Operator` per `DESIGN.md § Terminology` ("They operate the garden"). | **Mild tone conflict.** Admin reads `Operator` with operational connotation; public reads `Steward` with regenerative-care connotation. Both are honest framings of the same role. Hold the read-side carve-out. |
| **Verified Site** | Garden + at least one Evaluator attestation | Adopt as a derived public badge — present when the garden has ≥1 attestation from a wallet holding the Evaluator role. **Lane B dependency**: needs an indexer or EAS read to surface this signal. (CLAUDE.md note: indexer scopes EAS attestations *out*; EAS reads need a separate path.) | No vocabulary conflict — but the data path is non-trivial. Flag for Lane B. |
| **Vol. IV — Autumn** | Season (not yet a primitive) | Hardcode `Vol. I — Onboarding & Cultivation` as the v1 volume marker per the plan's recommendation. When Seasons-as-primitive ships, derive volume label from active season. | **No conflict in v1.** Defers the Seasons coupling decision. |
| **Live Observations** | Aggregate of recent Works + active Sites | Use the Stitch label as section header on the landing only. Internally this is "recent activity by site," derivable from the indexer aggregate. | No conflict — pure copy label. |
| **Quantifiable Restoration** | Aggregate `Impact` (carbon, water, species) | Use the Stitch label as section header. Internally maps to the same aggregation as the existing `Impact` page, but with domain-specific units (Carbon Sequestered, Water Retention Increase) rather than count metrics. | **Mild data conflict**: today's `Impact` page surfaces counts (assessments, gardens, gardeners). Stitch wants tonnage / percentage / area units. Lane B needs to extend the aggregation. |

**No banned vocabulary detected** in the Stitch design copy: `streak`, `countdown`, `leaderboard`, `FOMO`, `dashboard`, `KPI tile` are all absent. The "growth-hacking drift" risk is low here — the Stitch direction is editorial and patient, on-brief for the regenerative lens.

---

## 6. Lane D ordering recommendation

Build the editorial primitive bench under `packages/client/src/components/` first, in dependency order — atoms (`Eyebrow`, `VolumeMarker`, `LocationPlate`, `EditorialStatTile`, `VerifiedSiteBadge`) before composites (`SiteCard`, `FieldNoteCard`, `JournalHero`) before page shells (`SiteFooter`, `SiteHeader` extension). Then assemble pages: **Landing first** (exercises every Tier-1 primitive and is the brand showcase), **Sites list second** (reuses `SiteCard`), **Sites detail third** (reuses `SiteCard` data shape and adds a field-notes-by-site composition + Verified Site provenance), **Field Notes feed fourth** (reuses `FieldNoteCard` + `VolumeMarker`), **Field Note single fifth**, then **Stories, Impact, About** using the now-mature bench. Wire the editorial serif font (`G12`) before any page that uses it — likely as the first Lane D shell setup task. SEO metadata, Open Graph images, and Lighthouse polish belong in **Lane E** after page shells are stable.

**About / manifesto page composes from existing primitives — no new gaps.** Plan §3 lists `/about (or /manifesto)` for Evidence Commons framing + sibling-ecosystem (Coop / WEFA) callouts, but the Stitch screens don't include this surface. Lane D should compose the page from `JournalHero` (manifesto headline) + body copy in `Eyebrow`-led sections + `SiteFooter` (already holds the manifesto links per G10). Do **not** introduce new primitives for this page.

---

## Appendix — files read for this discovery

- `.plans/active/public-read-side-journal/plan.todo.md`
- `CLAUDE.md` (project rules, indexer boundary, Tailwind v4 gotcha)
- `DESIGN.md` (root creative brief + Voice & Copy)
- `packages/client/DESIGN.browser.md` (browser dialect)
- `.claude/skills/design/client-prompt-contract.md`
- `.claude/skills/design/quick-reference.md`
- `.claude/rules/react-patterns.md`, `.claude/rules/frontend-design.md`, `.claude/rules/typescript.md`
- `packages/client/src/views/Landing/index.tsx`
- `packages/client/src/views/Public/Gardens.tsx`, `GardenDetail.tsx`, `Actions.tsx`, `Fund.tsx`, `Impact.tsx`
- `packages/client/src/components/Layout/Hero.tsx`
- `packages/client/src/components/Navigation/SiteHeader.tsx`
- `packages/client/src/routes/PlatformRouter.tsx`, `PublicShell.tsx`
- `packages/client/src/router.config.tsx`
- `packages/client/src/views/PublicBrowserSurfaces.stories.tsx`, `PwaProtectedSurfaces.stories.tsx`
- `packages/shared/src/components/index.ts`, `StatCard.tsx`, `StatusBadge.tsx`
- `packages/shared/src/components/Cards/GardenCard/GardenCard.tsx`
- `packages/shared/src/components/Cards/WorkCard/WorkCard.tsx`
- `packages/shared/src/components/Display/ImageWithFallback.tsx`
- `packages/shared/src/styles/theme.css` (token surface inspection)
