# Builder Docs Rebuild Plan

**Feature Slug**: `builder-docs-rebuild`
**Status**: ACTIVE
**Created**: 2026-09-02
**Last Updated**: 2026-10-10

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Five phases, each an independently shippable PR to `develop` | Diátaxis anti-big-bang; site never worse mid-migration; avoids stacked-PR CI Gate gaps |
| 2 | ~~One lane branch per phase~~ **Amended by Afo 2026-09-02: all phases proceed on `feature/builder-docs-rebuild`**; PR #795 grows with each phase | Afo's explicit direction after Phase 1 review; single review surface, one CI stream |
| 3 | Hybrid integration mechanism: pages become hand-owned MDX that render generated projection data via a component | Meaning stays human-editable (D4); concrete details keep digest-gated provenance |
| 4 | Skills catalog generated from `.claude/skills/*/README.md` with `SKILL.md` description fallback | Catalog complete on day one (D8); improves as READMEs land |
| 5 | Mermaid zoom implemented site-wide, not per-page | Every diagram benefits; one mechanism to maintain |
| 6 | Redirect entries land in the same PR as each slug move or deletion | No window where old links dead-end |
| 7 | QA pages (`quality/*`) stay owned by the qa-report stream; this effort only re-parents and cross-links | Avoid rework of pages rewritten 09-01/02 (#793) |
| 8 | Merge `develop` into the branch rather than rebase (Afo, 2026-09-22) | A rebase replays 18 commits over the same files, and a force-push would orphan the 46 open review threads |
| 9 | Keep `GG_PUSH_GATE_ARGS` on develop's pre-push gate line (Afo, 2026-09-22) | Does nothing unless set; this branch's full push plan needs explicit focus or a narrower base |
| 10 | Community invites follow the product: Telegram `+N3o3_43iRec1Y2Jh` (Afo, 2026-09-22) and Discord `discord.gg/greenpill` to match | One invite set across the app, the docs, and the repo |
| 11 | Develop's generated Command inventory and Contract operations pages stay under Packages (Afo, 2026-09-22) | Matches their slugs; Getting Started links Command inventory as the command source |
| 12 | The integration projection stays English-only (Afo, 2026-09-23) | The docs site ships no locales, so routing its labels through i18n would add keys nobody reads; revisit if the docs add locales |
| 13 | EAS and Tokenbound join the ontology's integration catalog, so every integration page with an on-chain footprint renders the deployment projection (2026-10-09, open to Afo's veto) | The catalog had been seeded from modules only; the resolvers and garden account contracts are deployed per network like any module, and Passkeys, with no deployment, says so in prose |
| 14 | Develop merged into the branch a third time on 2026-10-09 (1182 commits, the 2.0.0 release sync), by merge again | Same reasoning as decision 8; the review threads stay anchored |
| 15 | QA round 1 lands on the same PR (Afo, 2026-10-10): thirty review items from the local production build, all on `feature/builder-docs-rebuild` | One review surface and one CI stream, as decision 2 |
| 16 | One sidebar highlight everywhere, the primary green from the app tokens; builder teal survives only as the Builder role accent (Afo, 2026-10-10) | The teal was off-brand in the sidebar and three active looks coexisted; `docs/README.md` keeps brand artwork colors out of UI tokens |
| 17 | Personas and Surfaces moves under Architecture as its first entry, slug `/builders/architecture/personas`, with the old reference slug redirected (Afo, 2026-10-10) | The actors give the work-submission trace its context; the collapsed Reference group hid them |
| 18 | Product Experience QA becomes Product QA and is condensed, overriding decision 7 for this round (Afo, 2026-10-10) | Afo asked for the rename and a lighter page; the qa-report stream keeps ownership afterwards |
| 19 | Deployments & Addresses prints every recorded address and schema UID with explorer links from an explicit artifact allowlist; owners, deployers, managers, safes, signers and receipts are blocked by name and tested (2026-10-10) | Resolves the open Codex thread; the page is now the address reference its sidebar label promised |
| 20 | Architecture reframes "three ideas" as five (adding opt-in modules and local-first capture with indexed reads) and the dependency arrow reads `contracts → indexer → shared → client / admin / agent` as data flow (Afo, 2026-10-10) | "Three ideas" sold the protocol short; the indexer belongs in the arrow |
| 21 | QA round 2 lands on the same PR (Afo, 2026-10-10): eleven review items from the rebuilt local build plus a self-review pass | Same reasoning as decision 15 |
| 22 | Unlock Protocol joins the integration catalog through the GreenWill registry, with its own page and the `Unlock` matrix column (Afo, 2026-10-10: "Unlock protocol is integrated through GreenWill") | The column note called it vocabulary-only while the registry, three locks, shared hooks and an indexer handler exist; a catalog entry makes the status table, the matrix and the deployments page agree |
| 23 | The entity matrix reads per protocol (a two-column table under each protocol, a glance table above) and the personas page drops the route-literal appendix and reads the ontology alone (2026-10-10) | Afo found the grid dense and confusing and asked what the route literals were for; the literals had no reader and coupled the page to every client and admin route edit |
| 24 | Retired command names leave the generated Command inventory and Contract operations pages; both migration ledgers stay inputs to the docs authority audit only (Afo, 2026-10-10) | A reader needs what runs today; the audit still refuses retired callers everywhere |
| 25 | Architecture carries six ideas: Capital forms around verified work joins the five from decision 20 (Afo, 2026-10-10) | Five ideas still missed commitment pooling and capital formation |
| 26 | Package order is contracts, indexer, shared, agent, qa, admin, client in the Monorepo Map and the Packages sidebar (Afo, 2026-10-10); the Command inventory keeps the contributor order from round 1 unless Afo says otherwise | The map follows the dependency direction; the inventory order was a separate explicit ask |
| 27 | The builder track is Green Goods-centric: no dev-guild byline, guild-wide guide or blog link in First Contribution, and the closing section is Stay in touch (Afo, 2026-10-10) | Afo is stripping the dev-guild framing; the community pages, footer blog link and copyright line still name the guild and are his call |
| 28 | The community track, Credits and the FAQ drop the dev-guild framing as well (2026-10-10, applying Afo's round-2 direction); the footer copyright line and the License page keep the legal copyright holder until `LICENSE` changes | A byline and guild headings on Welcome, Why We Build and Credits contradicted the builder track; the copyright holder is a legal fact, not framing |
| 29 | Root `DESIGN.md`'s quick reference follows DL-029 and DL-038 for button corners (16px in the installed app, 12px while pressed, square on the public website) and the Design page says the same (2026-10-10) | The root file still carried DL-026's values a day after DL-029 replaced them; the docs follow the code and the decision log |
| 30 | Community guide captures are refreshed only where a current Storybook story exists (Create Garden, Create Action, the Garden overview, the Submit Work media and review steps, Your Work offline and pending, the Hub Hypercerts tab); Reviewing Work keeps its two old captures until the Hub work stories mount a seeded garden; no Hats tree or arbiscan visual (2026-10-10) | A stale screenshot beats a wrong one: the Hub work-detail story renders Work not found, the hats app draws tree 92 too small headlessly, and arbiscan sits behind a bot check |
| 31 | Deployments & Addresses labels every contract by name through a renderer label map with a words fallback; artifact keys appear only in the zero-address line (2026-10-10) | Raw keys such as `accountProxy` and `unifiedPowerRegistry` read as code, not as a reference page |

## Requirements Coverage

| Requirement (decision) | Phase | Status |
|------------------------|-------|--------|
| D1 consolidated Testing Guide | 4 | ✅ |
| D2 journeys deleted + redirects | 3 | ✅ |
| D3 Economics Explorer → Reference | 4 | ✅ |
| D4 hybrid integration pages | 1 (mechanism) + 3 (prose) | ✅ |
| D5 llms.txt + .md twins | 5 | ✅ 44059edf3: `llms.txt` plus a Markdown twin of every page (67 in the build) |
| D7 real category landings | 1 (CSS fallback) + 3 (pages) | ✅ all categories |
| D8 Skills catalog + Working with Agents | 1 (generator) + 4 (prose/READMEs) | ✅ (13 READMEs authored) |
| D9 Design page under Architecture | 4 | ✅ |
| D10 License page in Reference | 4 | ✅ |
| D11 CI & GH Actions under Testing & QA | 4 | ✅ |
| D12 Anatomy of a Work Submission (tentative) | 3 | ✅ built; Afo judgment pending |
| ERD layered + zoomable | 1 | ✅ 26e2f6cf3 + ade03f693 |
| Spine rewrites (Getting Started, First Contribution, System Overview) | 2 | ✅ 6b7d408c4 (tone gate open) |
| Package template ×7 incl. new QA page | 3 | ✅ |
| Link audit: every page has next steps + external links | 5 | ✅ 295be57a9 + a2d5a207d: all 29 hand-written pages link out and end with next steps |
| CONTRIBUTING.md circularity fix | 5 | ✅ develop's CONTRIBUTING names First Contribution the full guide; First Contribution no longer defers its core flow back (merge round) |

## Phase 1 — Generators & mechanics (lanes `state_api` + `ui`, this branch)

### Step 1.1: Layered ERD
**Files**: `scripts/docs/renderers.mjs`, `scripts/docs/generate.test.mjs`, regenerated `docs/docs/builders/architecture/erd.mdx`
**Details**: `renderErd` emits three focused diagrams (core protocol / funding / commitments) from
the ontology projection instead of one 21-entity graph. Test asserts layer membership and that no
entity is dropped.

### Step 1.2: Site-wide Mermaid pan-zoom
**Files**: `docs/package.json`, `docs/docusaurus.config.ts` or `docs/src/` client module
**Details**: attach pan-zoom to rendered Mermaid SVGs (pinned dependency), keyboard-safe,
reduced-motion respectful. Verify on the regenerated ERD page via docs build.

### Step 1.3: Integration projection mechanism (hybrid, D4)
**Files**: `scripts/docs/generate.mjs`, `scripts/docs/renderers.mjs`, `scripts/docs/generate.test.mjs`, new docs component, converted `docs/docs/builders/integrations/*.mdx`
**Details**: generator emits one digest-gated projection data file; a docs component renders a
named integration's deployment/indexer tables (indexer section only when configured). The seven
generated integration MDX pages become hand-owned pages that keep their current intro text (Phase 3
rewrites prose) and embed the component. `check:docs-generated` covers the data file.

### Step 1.4: Skills catalog generator (D8)
**Files**: `scripts/docs/renderers.mjs`, `scripts/docs/generate.mjs`, `scripts/docs/source-readers.mjs`, `scripts/docs/generate.test.mjs`, new `docs/docs/builders/agentic/skills.mdx`, `docs/sidebars.ts`
**Details**: `renderSkills` reads `.claude/skills/*/README.md` (fallback: `SKILL.md` frontmatter
description), emits the generated catalog page with required trust frontmatter; sidebar entry under
Agentic Development.

### Step 1.5: Sidebar accent fallback
**Files**: `docs/src/css/custom.css` (+ small client module if needed)
**Details**: builders teal holds on every `/builders/*` route including category index pages, ahead
of the Phase 3 real-landing fix.

### Step 1.6: Redirects plumbing
**Files**: `docs/package.json`, `docs/docusaurus.config.ts`
**Details**: wire `@docusaurus/plugin-client-redirects` with an empty, documented redirect map;
entries land with each later move/deletion (Decision 6).

## Phase 2 — The spine
Getting Started (absorbs env-management) · First Contribution · System Overview (absorbs
modular-approach, local-vs-global, ethereum-alignment) + redirects. Tone check with Afo on the
first page before the other two.

## Phase 3 — Sections
Monorepo Map landing + package pages ×7 (incl. new `packages/qa`) · Integrations landing + meaning
blocks on all ten pages · Anatomy of a Work Submission (D12 — Afo judges rendered result) · Data
Model & Ontology consolidation (entity matrix + commitment state diagrams) · journeys deleted (D2)
+ redirects · Persona Surfaces → Reference.

## Phase 4 — Design, agents, testing
Design page under Architecture (D9) · Working with Agents landing + 13 skill READMEs (D8) ·
Testing Guide consolidation (D1) + redirects · CI & GH Actions under Testing & QA (D11) ·
Economics Explorer → Reference (D3) · License page (D10) + community Credits slimmed.

## Phase 5 — Sweep
`llms.txt` + `.md` twins (D5) · track-wide link audit (next steps + external links per page) ·
CONTRIBUTING.md one-way pointer · final `docs:audit` green · redirect map verification.

Status (2026-09-23): all five items done; the receipt is in `handoffs/claude-ui.md` and the gate
measurements are in `eval.md`. Two outcome gates wait on Afo: the page-length gate and whether
Reference gets a landing page.

Status (2026-10-09): develop merged in again (decision 14), the last three Codex threads fixed
(owner approvals, three next steps, projections on EAS and Tokenbound), and every gate re-run
green on the merged tree; receipt in `handoffs/claude-ui.md`. What remains is Afo's: the three
human gates below, the GitHub thread replies, and taking the PR out of draft.

Status (2026-10-10): QA round 1 from Afo's walk of the local build, thirty items, all landed on the
branch (decisions 15 to 20). Site chrome: flat canvas (the fixed gradient is gone), one sidebar
highlight, no Brand kit in the navbar or the Builders sidebar, Admin instead of Dashboard, four
links per footer column, a readable light-mode footer. Diagrams: per-mode mermaid palettes through
a swizzled component, lifecycle arrows carry a short clause with the full mechanism in a table,
and a jsdom parse test guards every generated diagram. Generated pages: Deployments & Addresses
prints linked addresses, the entity matrix derives integration status from the catalog and the
artifacts, Personas moved under Architecture, CI workflows explained from a catalog data file,
contract operations grouped by verb, task routing and skills restructured, commands root-first with
copy buttons, ONBOARDING.md and the design tokens embedded through projections. Hand-written pages:
Getting Started refreshed, First Contribution de-duplicated, five ideas on Architecture with the
indexer in the arrow, one package table, deeper package pages with screenshots, integrations status
table, Product QA, design page with tokens and six Storybook captures. Receipt in
`handoffs/claude-ui.md`.

Status (2026-10-10, later): QA round 2 from Afo's walk of the rebuilt build, eleven items, all landed
(decisions 21 to 27). Current admin and public-site captures replace the old admin screenshots in
the builder track (Storybook, deployed build, headless Chromium; the public site at greengoods.app),
First Contribution loses the guild framing, Architecture gains the capital-formation idea with the
Promises tab as its figure, the Anatomy infographic runs full width, the entity matrix reads per
protocol, the personas page is a persona-by-surface matrix from the ontology alone, the retired-name
ledgers leave the two command pages, Unlock Protocol gets a catalog entry and a page through
GreenWill, the Design page is one system then three dialects with captures, and the package order
follows the dependency direction. The self-review outline went to Afo in chat and the Linear comment.

Status (2026-10-10, review pass): the self-review follow-ups Afo accepted landed as `461515da2` (named
contracts on Deployments & Addresses) and `500082846` (guild framing off the community track, the
root DesignMD corner rule, current community captures, visuals for EAS, Shared and Passkeys, the
admin navigation claim softened); decisions 28 to 31. Left on purpose: the Command inventory
order, Lido and FTC in the matrix, moving the seven principles off the Design page, seeding the
Hub work stories (shared package), and the footer and License copyright lines.

## CLAUDE.md Compliance
- [x] No package-level env files touched; docs generators read repo sources only
- [x] Generated pages keep trust frontmatter + digest gates
- [ ] Implementation Quality Contract applied per phase (no speculative abstractions)

## Test Strategy
- **Unit**: `scripts/docs/generate.test.mjs` covers renderer changes (layer membership, conditional
  sections, skills fallback); `docs/scripts/docs-audit.test.mjs` stays green.
- **Integration**: `bun run docs:generate` + `bun run check:docs-generated` (digest honesty),
  `bun run docs:audit:ci`, `bun run build:docs` (includes redirects plugin + pan-zoom).
- **E2E/manual**: rendered ERD zoom + sidebar accent verified in the built site preview.

## Validation
- [ ] Phase 1: docs generator tests pass · docs:generate idempotent · docs:audit:ci green · build:docs green
- [ ] Fresh Evidence Receipt recorded in `handoffs/claude-state-api.md` before lane marked passed

## Implementation Notes

- Phase 3 divergences: the entity matrix relocated to its own generated page under Architecture
  instead of being absorbed into Data Model (a 3,600-word merge helped no reader); all five
  lifecycle state machines live on Data Model, and Anatomy links the work-display-status anchor
  rather than embedding the diagram.
- Deferred (Afo, 2026-09-02): revisit the Architecture landing for stronger protocol capture once
  Phases 3-4 surround it; reassess what it should still say that Anatomy and Data Model now cover.
- Tone rule 6 (no em dashes) applied to all Phase 3 prose.
