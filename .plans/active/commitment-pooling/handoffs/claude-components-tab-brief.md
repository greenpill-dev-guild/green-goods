# Handoff: Components tab for the commitment pooling prototypes artifact

- **Written**: 2026-08-14 (end of the pool-tab/cards/workflows polish session; PR of that session linked from the branch this file lands on)
- **For**: a fresh Claude Code session
- **Mission**: extract every component the commitment pooling prototypes use into a reviewable, Storybook-style **Components tab** inside the existing prototypes artifact, so Afo can review styling and feel per component, give coherent feedback, and we can align the whole set before adjusting.

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
