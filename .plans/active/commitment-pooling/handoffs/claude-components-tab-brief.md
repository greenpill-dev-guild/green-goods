# Handoff: Components tab for the commitment pooling prototypes artifact

- **Written**: 2026-08-14 (end of the pool-tab/cards/workflows polish session; PR of that session linked from the branch this file lands on) · **amended same day**: the build is gated behind explicit alignment phases — see § Process.
- **For**: a fresh Claude Code session
- **Mission**: extract every component the commitment pooling prototypes use into a reviewable, Storybook-style **Components tab** inside the existing prototypes artifact, so Afo can review styling and feel per component, give coherent feedback, and we can align the whole set before adjusting.

## Process — align before generating (non-negotiable)

The point of this pass is to REDUCE review burden, so the library's shape is
agreed **before** anything is generated. Run it in three phases and do not
start Phase 3 without an explicit go.

**Phase 1 — inventory & audit (read-only).** Scan `kit.ts`, every
`screens/*.ts` composite, and each shipping counterpart component. Produce in
chat: the full component inventory with a *proposed* grouping and naming, the
variant/state matrix per component, which screen-local composites you propose
promoting into `kit.ts`, and an honest drift list (specimen vs shipping
counterpart, file:line). No edits in this phase.

**Phase 2 — alignment rounds (AskUserQuestion, several rounds expected).**
Afo prefers multiple rounds of design questions over one big approval — batch
2–4 questions per round, always with a recommended option first, and keep the
wireframe-or-specimen evidence in chat so choices are concrete. Decisions that
belong to him, not you:
- the grouping taxonomy and group order;
- component naming where kit names and shipping names differ;
- the per-entry template (which annotations, how much depth) and how variants
  present (matrix grid vs stacked list vs interactive switcher);
- how dialects show (client/admin side-by-side vs per-surface sections) and
  whether public/editorial components are in scope;
- what happens to each drifted specimen — redraw-to-shipping now, or render
  with an explicit drift flag for a later fix;
- which screen-local composites get promoted into `kit.ts`;
- the review affordance (hash anchors, and whatever else he wants for giving
  per-component feedback).
Fold each round's answers into a short **component-library contract** section
appended to this file (groups, entry template, presentation rules, drift
policy) so the agreement is durable, then confirm the contract in one final
question before building.

**Phase 3 — generate.** Build the tab exactly per the locked contract,
validate to zero warnings, verify in the rendered DOM, republish to the same
URL, and hand back for a look-and-feel-only review — structural questions
should all be settled by then.

## Context you must load first

This repo runs multiple concurrent Claude/Codex sessions. Stay inside the paths listed here; treat unexpected working-tree changes as another agent's work and surface them, never revert them.

- The prototype machinery lives in `.plans/active/commitment-pooling/hifi/`:
  - `kit.ts` — the component builders (each mimics a real Green Goods component, noted per function). This is the primary extraction source.
  - `tokens.ts` — `HIFI_CSS`: the phone frame, per-surface dialects (`.s-client` Warm Earth, `.s-admin` restrained M3, `.s-public` editorial), light + dark via `[data-theme]` **and** the `prefers-color-scheme` twin.
  - `screens/*.ts` — screen definitions; several composites live screen-locally and are worth promoting to `kit.ts` during extraction (`byline`, `domainRow`, `poolFilters`, `seasonCard`/`campaignSlide`, `promiseSlide`, `selCard`/`selRail`, `offerCard` family).
  - `player.ts` — the artifact shell: currently three tabs (Guided flows · Screen library · Implementation reference). The Components tab becomes the fourth.
  - `validate.ts` — fails the build for orphaned hotspots, empty states, copy-lint violations, etc. Keep the build at **zero warnings**; if gallery specimens need an exemption (they should not need hotspot registration), scope it narrowly — never weaken a validator globally.
- Rebuild: `bun .plans/active/commitment-pooling/prototypes-artifact.build.ts` (fails loudly, writes `/tmp/commitment-pooling-prototypes.html`). Local QA: `mkdir -p /tmp/gg-proto && cp /tmp/commitment-pooling-prototypes.html /tmp/gg-proto/index.html`, then the `proto` entry in `.claude/launch.json` serves port 4601.
- Republish to the **same artifact URL** with the Claude Code Artifact tool, passing `url: https://claude.ai/code/artifact/19c3dcad-ac1d-4398-bcd4-57d0c892be2c` (publishing without `url` from a new session forks a separate artifact). Note: republishing does not move an existing share pin.
- Decision context to honor (do not re-litigate; render the decided versions):
  - `uiux-spec.md` 2026-08-14 addenda: chips-lead cycle and promise cards, the ①–⑧ promise-card anatomy, direction edges, equal-weight domain rows, whole-card-opens/button-acts grammar, mode-helper trim, standing attribution (d0–d3).
  - `prototypes.md` changelog rows dated 2026-08-14 (seven passes).
  - The Pool Card Studies artifact (`69acd524-…`) and its one-shot builder `card-explorations.build.ts` record the rejected layout options — the Components tab supersedes future one-shot studies of that kind.

## The lesson this tab exists to enforce

This session found real drift: prototype casts had invented UI (a text-grid intro, an Action select on the details step) that did not match the shipping client. **Every specimen must name its shipping counterpart with a file:line citation and mirror its anatomy** — e.g. `WorkCard` status edges (`packages/shared/src/components/Cards/WorkCard/WorkCard.tsx`), `CardBase` accent variants, `StatusBadge`, `DomainBadge`, `FormInfo` (`packages/client/src/components/Cards/Form/FormInfo.tsx`), `ActionCard`/`GardenCard` selection cards + `Carousel` (`packages/client/src/views/Garden/Intro.tsx`), `FabButton`, `StandardTabs`, `SyncStatusBar`, `TopNav` + `FormProgress`. Where a kit specimen deliberately diverges (or the component is net-new to pooling with no shipping counterpart yet), the gallery entry must say so explicitly instead of implying parity. Open the real component before writing its entry — never cite from memory.

## What to build

A **Components** tab in the artifact with:

1. **Full inventory** — every `kit.ts` builder and every screen-local composite, grouped by family (suggested: Chips & badges · Cards · Rails & carousels · Forms & inputs · Chrome (headers, tabs, bars, FAB) · Feedback (banners, skeletons, empty states, sync) · People (avatar, byline, team strip)). Promote screen-local composites into `kit.ts` as part of the pass so the kit becomes the single component source.
2. **Every variant, state, and tone rendered** — e.g. chip: all `ChipTone`s ± dot; card: default/flat/surface/inset × edge-offer/edge-request; button: pri/sec/ghost/danger × sm/full/disabled; banner: all four tones; statusBadge: the full lifecycle map; domain row: all four domains; the promise/cycle/selection slides; both **dialects** where a component differs (client vs admin chip sizing, button shapes) and both **themes** (the existing dark machinery must just work — verify, don't fork it).
3. **Per-entry annotations**: component name · shipping counterpart file:line (or "net-new, no shipping counterpart yet") · one-line usage rule (when to use, when not) · where-used list of screen ids (derivable by scanning `screens/*.ts` for the builder name).
4. **Stable review anchors** — each component addressable by hash (e.g. `#comp=chip`) so feedback can name components unambiguously. Follow the player's existing hash-routing patterns.
5. **Coherence bookkeeping** — update `prototypes-coverage.md` (snapshot + a Components-tab line) and add a `prototypes.md` changelog row; keep the build at zero validation warnings; republish to the same URL and verify in the rendered DOM before claiming success (the repo's evidence bar: no "should work").

## Working agreements

- Read `CLAUDE.md` and honor the Warm Earth / M3 surface-identity rules; the design skill (`.claude/skills/design/`) is the canonical spec if paradigm questions come up.
- `.plans/**` is outside biome's include set — the artifact build is the validation gate for these files; don't run the full repo Ship Gate for a `.plans`-only diff.
- Branch per repo convention (`feature/…` — never encode the agent in the name), PR to `develop`, and check whether the polish-session PR this file arrived on is merged or still open before choosing your base.
- Ask Afo before expanding scope beyond the Components tab (e.g. restyling components — this pass is about *extraction and reviewability*; adjustments come after his review).

## Component-library contract (Phase 2 outcome, locked 2026-08-14)

Agreed with Afo across three AskUserQuestion rounds in the components-tab
session (Phase 1 audit presented in chat first; PR #710 confirmed merged, so
Phase 3 branches off `develop`).

**Tab.** A fourth tab, **Components**, between Screen library and
Implementation reference. Root anchor `#components`; `applyHash` handles the
`#components…` patterns *before* the doc-tab fallthrough.

**Surfaces flip; they never mix.** The tab carries a surface switcher (same
`.surface-tab` pattern as the Screen library): **Client PWA / Admin console /
Editorial website** — three different design systems, each rendering its own
family-grouped catalog in its own dialect. Shared primitives (button, chip,
field, skeleton, empty state…) appear once per surface, drawn in that
surface's dialect.

**Grouping (client-led family order).** Chips & badges → Cards → Rails &
carousels → Forms & inputs → Chrome → Feedback → People. The admin catalog
follows the same order restricted to what exists there plus its cockpit-only
set (PageHeader, AdminTabRail, AdminCard, AdminDialog + flow dialog, stage
stepper, data table, GardenChip, canvas chrome). Editorial is a small set
(site header, web window, kicker/serif type, panel, stat row, pipeline,
install CTA) rendered from the existing `.s-public` classes.

**Naming.** The shipping component name leads each entry title
(StandardTabs, FormInfo, SyncStatusBar, StatusBadge, AdminCard…); the kit
builder name appears in the annotation line. Net-new components carry their
pooling name plus an explicit **NET-NEW** tag.

**Variant presentation.** Static matrix grid per entry — every variant ×
state rendered at once with labels; no interaction needed to review. Gallery
specimens render controls **disabled** (satisfies the enabled-button
validator; gallery registers no hotspots). Dark mode rides the existing
global toggle — verify, don't fork.

**Entry template (5 parts).** ① Title = shipping name + tags (NET-NEW /
DRIFT / deliberate-divergence note) ② kit builder signature (e.g.
`kit: gardenTabs(active, {hotPrefix})`) ③ shipping counterpart `file:line`,
or "net-new — no shipping counterpart yet" ④ one-line usage rule (when to
use / when not) ⑤ where-used screen ids as **clickable chips** linking
`#screens/<id>` through the existing hash router. Drift entries add one
delta sentence naming what shipping does differently, with `file:line`.

**Drift policy: flag all, redraw nothing.** Every fidelity-gap specimen from
the Phase 1 audit (flowHeader's added title h1, syncBar's single state vs
the 3-state + Sync All shipping bar, FAB squircle/icon-swap vs rounded-full
rotate-45, text-only domain row vs icon DomainBadge, selCard 200px 2-up vs
~full-width 212px shipping slides, homeHeader 44px vs 32px icon buttons,
gardenTabs missing counts/icons, banner tone set vs Alert's, formInfo
radius/variants, emptyState/appBar/btn/meter/acard small gaps) renders
exactly as screens draw it today plus an amber **DRIFT** tag; Afo picks
redraws after reviewing the tab. Decided divergences (24px cards + 3px
inset direction edges, chips-lead promise-card anatomy) render as decided
and are annotated as deliberate, not drift.

**Promotions into kit.ts.** From client.ts / client-wallet.ts: `byline`,
`domainRow` (+ DOMAIN_CLS), `poolFilters`, `seasonCard`/`seasonSlide`/
`emptySeasonSlide`/`campaignSlide`, `promiseSlide`, `selCard`/`selRail`,
the offerCard family (`offerCard`, `requestCard`, `ongoingOfferCard`,
`teamOfferCard`, `fundedOfferCard`), `offerRow` (W32), and a new
`teamstrip` builder replacing the raw HTML duplicated in client.ts:1063 and
funding.ts:35. Admin builders relocate from screens/admin.ts into kit.ts
under an admin-dialect section (`deskWin`, `acard`, `stages`, `gardenChip`,
`pageHeader`, `tabRail`, `adminCanvas` with its internal appBar/navDock/
iconBtn helpers, `adminDialogM3`, `flowDialog`, `dtable`); journey-hot
wiring (`adminChromeHots`, NAV_TARGETS) stays in screens/admin.ts. Screens
import the moved builders back from kit. `statTiles` is **dropped** from
kit.ts (used by zero screens; anatomy diverges from shipping StatCard).
Screen-bound casts (`claimCard`, `walletShell`, intro section wrappers,
CARD_* fixtures, `wfHead`) stay screen-local. Editorial stays class-based;
`siteHeader`/`webWin` remain in public.ts.

**Anchors & review affordance.** Stable kebab ids: `#components/<id>` with
the player's `@` grammar for surface (`#components/chip@admin`); default
surface = client when the component exists there, else its only surface. A
deep link flips to the right surface tab and scrolls to the entry. Every
entry has a copy-link button; the tab opens with a compact jump-index strip
(family → entries) per surface.

**Validation.** Zero warnings; no validator weakened, no global exemption.
The build additionally runs the existing copy scanners (vocab / spec-citation
/ aggregate) and the enabled-button control scan over the gallery HTML — new
call sites, unchanged rules.

**Bookkeeping.** Update `prototypes-coverage.md` (snapshot + Components-tab
line) and add a `prototypes.md` changelog row; republish to the same
artifact URL (`19c3dcad-ac1d-4398-bcd4-57d0c892be2c`) and DOM-verify before
claiming success; PR to `develop` on a `feature/…` branch.
