# Public Browser Read-side — Editorial Visual Refresh on Existing Routes

**Slug**: `public-read-side-journal` (slug retained; scope reset 2026-04-25)
**Status**: `ACTIVE`
**Created**: `2026-04-25` (reset)
**Priority**: `p1`
**Branch**: `feature/public-read-side-journal`

## Why this exists

The existing public browser surface (`packages/client/src/views/Public/`) is functional but operator-flavored — flat headings, basic Tailwind cards, no editorial weight. This plan refreshes the **visual treatment** of the existing four routes to match the Warm Earth editorial direction (typography, photography, generous spacing, large editorial stat type). Same routes, same domain entities, same hooks — just a visual upgrade so funders, partners, and curious visitors arrive at a surface that reads like the platform's quality, not a placeholder.

**Critical scope note**: an earlier version of this plan over-interpreted Stitch reference images as canonical information architecture and vocabulary. That was wrong. Stitch images = visual *style* reference (typography, palette, photography composition). They are NOT IA, NOT vocabulary, NOT primitive enumeration. This rewrite resets to the actual product structure.

## Canonical structure (do NOT add or rename)

**Routes** — the four public browser paths, as they exist today:

| Route | Existing file | View focus |
|---|---|---|
| `/gardens` | `packages/client/src/views/Public/Gardens.tsx` | See gardens |
| `/impact` | `packages/client/src/views/Public/Impact.tsx` | See network impact |
| `/fund` | `packages/client/src/views/Public/Fund.tsx` | Fund a garden's vault or cookie jar |
| `/actions` | `packages/client/src/views/Public/Actions.tsx` | See actions Green Goods supports |

**No new routes.** No `/sites`, no `/field-notes`, no `/stories`, no `/seasons`, no `/about`, no `/manifesto`. The four above are the surface.

**Vocabulary** — domain entities only: Garden, Action, Work, Vault, Cookie Jar, Hypercert, Assessment, Attestation, Season. The 5 personas stay canonical. **No `Sites`, `Field Notes`, `Volumes`, `Steward (as public alias)`, or `Verified Site badge` aliases.**

## Pattern per view

Each of the four views follows the same shape:

1. **Top — high-level focus showcase** tied to that view's theme.
   - `/gardens`: network overview (count, total gardeners, cumulative work).
   - `/impact`: aggregate impact stats (carbon, water, species, area where available; hide tiles cleanly when oracle data is absent).
   - `/fund`: funding total, vault TVL, cookie jar funded, depositor count.
   - `/actions`: action templates supported, total submissions across the network.
2. **Scroll — garden cards** with view-specific tilt:
   - `/gardens`: overview cards (last activity, gardener count, brief description).
   - `/impact`: impact-tilted cards (per-garden stats, attestation summary).
   - `/fund`: funding-tilted cards (existing `Fund.tsx` pattern with Deposit + Cookie Jar buttons opening `VaultDepositDialog` / `CookieJarDepositDialog`).
   - `/actions`: action templates with which gardens use them.

The card itself is one primitive with a few content variants — not four card families.

## Funding flow inside `/fund` (preserved from prior thinking)

`/fund` is the only route with active interaction beyond browsing. The flow:

1. Visitor browses gardens with funding intent.
2. Selects a garden + chooses Deposit (vault) or Cookie Jar.
3. Existing `VaultDepositDialog` / `CookieJarDepositDialog` opens.
4. Inside the dialog, only the **final step** triggers wallet connection (`useAppKit`).
5. Future: fiat / credit card path inserted before wallet step (provider TBD; tracks alongside #433).

Reuse what's already in `Fund.tsx`. Do not redesign the dialog flow as part of this plan.

## What to actually build (3 small primitives + 4 view refreshes)

### Primitives (build minimally — extend existing where possible)

1. **`PublicHero`** — editorial top-of-page block per route. Props: `title`, `subtitle`, `image`, optional `eyebrow`, optional `actions`. Same component, four content payloads. Lives in `packages/client/src/components/Layout/` (NOT `packages/shared/` — Tailwind v4 scanning gotcha for layout classes).
2. **`PublicGardenCard`** — editorial Warm Earth garden card with photographic treatment, optional content slot for view-specific tilt (impact stats, fund buttons, last activity). One component, optional render-prop for tilt content.
3. **`StatTile`** — large editorial-type number + label, used in `/impact` and `/fund` showcases. May already exist in some form; reuse if so.

That's it. No `JournalHero`, no `SiteCard`, no `FieldNoteCard`, no `EditorialStatTile`, no `VolumeMarker`, no `LocationPlate`, no `VerifiedSiteBadge`.

### View refreshes (one PR or commit per view)

For each of `Gardens.tsx`, `Impact.tsx`, `Fund.tsx`, `Actions.tsx`:
- Top: `PublicHero` with view-specific content.
- Scroll: existing list, swap inline cards for `PublicGardenCard` with view-specific content slot.
- Apply Warm Earth typography (editorial serif for hero/stats, sans for body), warm cream canvas, accent green sparingly.
- Keep semantic tokens (Frontend Rule 13). No raw Tailwind colors.
- Keep i18n via `react-intl`.

### `SiteHeader` extension

Browser nav already exists. Confirm it surfaces the four routes prominently, with `Sign In` (link to existing app auth, return-user affordance) and a `Join the Mission` / `Become a Steward` CTA. No deeper nav hierarchy.

## Public read hooks (already shipped via Lane B — minor follow-up)

Lane B shipped:
- `usePublicGardens` ✓ (consumed by all four views)
- `usePublicGardenDetail` ✓ (potentially un-needed if no detail route in scope; confirm with consumers before removing)
- `usePublicFieldNotes` ⚠️ (name reflects old vocabulary; **rename to `usePublicWorks` before merge** for domain alignment)
- `usePublicVolume` ⚠️ (name reflects old vocabulary; **rename to `usePublicSeason` before merge**)
- `usePublicStats` ✓
- `SEASON_ONE_VOLUME_ID` / `SEASON_ONE_WINDOW` ⚠️ (rename: `SEASON_ONE_ID` / `SEASON_ONE_WINDOW` is fine; the `_VOLUME_` infix should drop)

Renames are mechanical; do them in the same PR that consumes the hooks for the four views.

## Constraints

- Browser-vs-PWA hard rule (`feedback_browser_vs_pwa`): browser path uses `SiteHeader`; installed PWA continues to route into the app via `PlatformRouter`. Never mix.
- Tailwind v4 utility classes authored inside `packages/shared/src/` will silently fail in client builds — keep utility classes in `packages/client` JSX where the new primitives live.
- Semantic tokens only (Frontend Rule 13). No raw `bg-neutral-*` / `text-gray-*`.
- All motion via spring tokens.
- No `console.log` — use `logger` from shared.
- `Address` type for any wallet field.
- Vocabulary lint applies: client-only banned terms (`operator cockpit`, `KPI tile`, `dashboard`, `Plus Jakarta Sans`) and cross-surface (`streak`, `countdown`, `leaderboard`, `FOMO`, growth-hacking).
- Do NOT add evaluator credibility loop UI, public evaluator profiles, or `Verified Site` badges. The Evaluator persona is served via existing Garden views with role-permissioned visibility.

## Out of scope

- New routes beyond `/gardens` / `/impact` / `/fund` / `/actions`.
- Per-garden public detail permalinks (unless `GardenDetail.tsx` already wires one — confirm; if it does, fine, but no new ones).
- `Sites`, `Field Notes`, `Volumes`, `Steward` (as public alias), `Verified Site` badge — none of these.
- Evaluator-specific public surfaces (per Afo: not in scope).
- SEO / Open Graph / Lighthouse work — defer; the visual refresh is the priority.
- Stories / About / Manifesto pages.
- New design system primitives beyond the three named above.
- Hypercert display metadata views (per CLAUDE.md indexer boundary).

## Success

- A funder visiting `/fund` from a browser sees an editorial Warm Earth surface, browses gardens with funding context, and completes a vault deposit — wallet connection only at the final dialog step.
- A visitor lands on `/gardens` and sees the network with editorial weight, not basic Tailwind cards.
- `/impact` surfaces network-wide stats prominently using `usePublicStats`; oracle metrics that aren't available are hidden cleanly (no placeholder copy).
- `/actions` surfaces the supported action templates so visitors understand what gets done.
- All four views share visual rhythm without repeating layout code (one `PublicHero`, one `PublicGardenCard`, one `StatTile`).
- `bun run lint && bun run lint:vocab && bun run test && bun build` pass.
- Installed PWA still routes into the app via `PlatformRouter`; browser routes only land here.

## Checklist

### Hook rename pass (do first — small, blocks consumer renames)
- [ ] `usePublicFieldNotes` → `usePublicWorks` in barrel + consumers + tests.
- [ ] `usePublicVolume` → `usePublicSeason` in barrel + consumers + tests.
- [ ] `SEASON_ONE_VOLUME_ID` → `SEASON_ONE_ID`.
- [ ] Confirm `usePublicGardenDetail` is consumed somewhere; if not, remove.

### Primitives
- [ ] `PublicHero` in `packages/client/src/components/Layout/`.
- [ ] `PublicGardenCard` in `packages/client/src/components/`.
- [ ] `StatTile` (reuse existing if present; build only if not).

### View refreshes
- [ ] `Gardens.tsx` — `PublicHero` + `PublicGardenCard` (overview tilt).
- [ ] `Impact.tsx` — `PublicHero` + stat showcase + `PublicGardenCard` (impact tilt).
- [ ] `Fund.tsx` — `PublicHero` + funding showcase + `PublicGardenCard` (funding tilt) — preserve existing dialog wiring.
- [ ] `Actions.tsx` — `PublicHero` + action template showcase.

### `SiteHeader`
- [ ] Browser nav surfaces `/gardens` `/impact` `/fund` `/actions` + `Sign In` (link to app auth) + `Join the Mission` / `Become a Steward` CTA.

### Validation
- [ ] Visual pass at 375 / 768 / 1024 / 1440 via Chrome MCP.
- [ ] Browser-vs-PWA path verified (installed PWA routes to app, not journal).
- [ ] `bun run lint && bun run lint:vocab && bun run test && bun build`.
