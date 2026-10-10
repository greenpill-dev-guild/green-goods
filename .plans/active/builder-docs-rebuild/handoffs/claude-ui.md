# Lane Handoff — ui (docs-site surface)

**Owner**: claude · **Branch**: `feature/builder-docs-rebuild` · **Status**: in_progress
**Scope**: docs-site mechanics in Phase 1 (mermaid pan-zoom, sidebar accent fallback, redirects
plumbing, integration pages embedding the projection component), then the page rewrites of
Phases 2-5 per plan.todo.md. Prose follows the spec.md tone contract; every phase passes the
docs gates in eval.md.

## Validation Receipt

_The lane's closing receipt is still pending. The per-phase receipts below record each phase's
validation._

## Phase 1 receipt pointer

Phase 1 ui-lane changes (client modules, accent CSS, converted integration pages, sidebar, config)
were validated together with the state_api lane; the shared Fresh Evidence Receipt lives in
`claude-state-api.md` (commit `ade03f693`, 2026-09-02T17:27:52Z). Browser-verified: builders teal
holds on `/category/user-journeys` (computed `rgb(45, 212, 191)` on the active sidebar link,
post-hydration), Hats page renders its indexer section, ENS page renders none, skills catalog
renders all 13 skills.

## Validation Receipt — Phase 2 (spine)

- **Tested implementation commit SHA**: `6b7d408c42ce85a7bea8ffd9d6d62ee6d2d11a86`
- **Run at (UTC)**: `2026-09-02T17:47:15Z`
- **Commands and results**: generator tests 19/19 · `docs:audit:ci` clean · `check:docs-generated`
  13 projections idempotent · `test:docs` 45/45 · `build:docs` SUCCESS, search index 67 routes
  (4 fewer, matching the absorbed pages) · push gate `ci-local --intent push` passed pre-commit.
- **Validated paths**: `docs/**`, `scripts/data/qa-test-catalog.json` — worktree status on those
  paths empty at the SHA.
- **Scope**: Getting Started (absorbs env-management; two named paths; mockAuth=steward), First
  Contribution (guild links, Linear-first flow, one-way pointer into CONTRIBUTING.md), System
  Overview (absorbs modular-approach + local-vs-global + ethereum-alignment; zoomable system
  diagram; seven-package map). Four pages deleted with client redirects; DOCS-011 wording updated
  in the QA catalog (ID unchanged).
- **Human gate open**: Afo's tone review of the three pages (plan.todo Phase 2 gate) — voice
  changes sweep all three.

## Validation Receipt — Tone-gate feedback round

- **Tested implementation commit SHA**: `79b499b116e1c6987622d013d299f51a71507bae`
- **Run at (UTC)**: `2026-09-03T01:09:16Z`
- **Results**: generator tests 19/19 · docs:audit:ci clean · check:docs-generated idempotent (13)
  · test:docs 45/45 · build:docs green at the pre-amend tree (content-identical) · push gate passed.
- **Feedback addressed** (Afo, 2026-09-02): (1) em dashes removed from all hand-written builder
  prose; tone-contract rule 6 recorded in spec.md; ontology definitions keep canon punctuation.
  (2) Bring-an-agent section in First Contribution + Getting Started pointer; ONBOARDING.md
  reviewed and refreshed (qa package, qa-session, ship wording, Skills Catalog link). (3) Landing
  retitled Architecture and rewritten around grounded protocol ideas with links woven through.
  (4) svg-pan-zoom replaced by a visible per-diagram Expand control with a full-screen zoom
  overlay; headlessly verified in the built site: 3 buttons, overlay open, scale 1.00 on open,
  zoom to 1.56x, Escape closes, cloned SVG id + embedded stylesheet rewritten.
- **Open question for Afo**: ONBOARDING.md uses Telegram invite `+N3o3_43iRec1Y2Jh` while the org
  CONTRIBUTING (and the docs) use `+n7g-u8wYtwQ2YjVi`; which is canonical?

## Validation Receipt — Phase 3 (sections)

- **Tested implementation commit SHA**: `e8ba51dc8e9a38e5e9cc677623ddd9ba7e68e08d`
- **Run at (UTC)**: `2026-09-03T01:46:36Z`
- **Results**: generator tests 19/19 · docs pkg tests 45/45 · docs:audit:ci exit 0 (2 advisory
  endpoint-literal warnings on the deliberate easscan links) · check:docs-generated idempotent
  (12) · check-ontology all guards passed · build:docs green (search index 65 routes) · push gate
  (sensitive plan, explicit checks docs-authority + ontology) fully green incl. agent-tools 193
  tests · digests re-verified post-commit.
- **Scope**: Monorepo Map + 7 package pages (qa new) · Integrations landing + 10 hybrid pages
  with upstream links · Anatomy of a Work Submission (D12, live Arbitrum schema links) · Data
  Model & Ontology consolidation (3 layers + 5 lifecycles) · entity matrix relocated · journeys
  deleted (D2) · Persona Surfaces → Reference · redirects for every move · ontology watch anchor
  and validation-policy path retargets (mechanical, meaning unchanged).
- **Browser spot-check**: Anatomy renders; sidebar shape verified (no User Journeys; Packages
  with QA; Integrations landing; Reference present).
- **Human gate open**: D12, Afo judges the rendered Anatomy page.

## Validation Receipt — Phase 4 (design, agents, testing, reference)

- **Tested implementation commit SHAs**: `acb13e7b9` (content) + `8d0202ab8` (guidance retargets)
- **Results**: generator tests 19/19 · select-validation 71/71 · docs pkg tests 45/45 ·
  docs:audit:ci exit 0 (advisory endpoint notes only) · check:docs-generated idempotent (12) ·
  agent-guidance green (codex-docs parity, 15 skill scenarios, 74 guidance files) · build:docs
  green, search index 64 routes · delta-scoped push gate green through the hook
  (GG_PUSH_GATE_ARGS="--base origin/feature/builder-docs-rebuild"; full-branch plan exceeds the
  180s sensitive budget by design, so the last CI-green push is the honest base).
- **Scope**: Design page moved+revamped under Architecture (D9) · Working with Agents landing +
  13 skill READMEs projected by the catalog (D8) · Testing Guide consolidates 4 tool pages (D1) ·
  Testing & QA category merged with CI & GitHub Actions moved back (D11, redirect direction
  swapped) · Deployment Status promoted to Reference as Deployments & Addresses with all consumer
  links retargeted · Economics Explorer (D3) and new License page (D10) in Reference · Product
  Specifications and deployments categories dissolved · guidance/guard references retargeted.
- **Browser spot-check**: all 7 new/moved routes return 200; sidebar shows the blueprint's final
  shape.
- **Session note**: the previous process exited mid-phase; resumed, completed agent-guidance
  fixes, and pushed.

## Validation Receipt — Develop merge (2026-09-22)

- **Tested implementation commit SHAs**: `5d4da7761` (merge of origin/develop `cda3494d4`) +
  `8eb035d98` (guides on develop's setup model) + `d46b45771` (link and trigger retargets) +
  `552622bc0` (QA catalog); pushed `f3d4de691..552622bc0`.
- **Results**: generator tests 20/20 · select-validation 78/78 · validation-system suite 307/307 ·
  docs-authority tests 44/44 · docs package tests 59/59 · `node docs/scripts/docs-audit.mjs --ci`
  exit 0 (the two advisory endpoint notes only) · `node scripts/docs/generate.mjs --check` (14) ·
  ontology guards pass · agent-guidance green (codex docs, 15 skill scenarios, 74 guidance files) ·
  qa-id-ledger 371 ids · source-structure clean in diff mode · docs build green, search index 67
  routes · push gate green through the hook with `GG_PUSH_GATE_ARGS="--check ontology"` (the
  ontology sidecar change needs an acceptance check to count as focused proof).
- **Pre-existing on develop, not from this merge**: docs typecheck (two recharts errors in
  `RevenueProjectionChart.tsx`, file untouched here) and `check-docs-design-parity.mjs` (it still
  expects the `operator` role accent renamed to `steward` on 2026-08-23; no CI job runs it).
- **Scope**: 28 conflicts resolved (8 projections regenerated, 7 integration pages kept, the erd,
  journeys/funding, and env-management deletions kept, ONBOARDING.md and the QA catalog taken from
  develop, 8 hand merges). Guides moved onto develop's isolated/host setup profiles and
  consolidated commands; the env page's rewrite folded into Getting Started. Integration pages
  describe the fork as its own mode. Links, workflow triggers, and the policy parity fixture
  retargeted. QA: DOCS-027 retired for DOCS-033 (Anatomy trace); DOCS-011 and DOCS-029 wording.
- **Evidence note**: earlier receipts in this file cite pre-rewrite SHAs. The branch was
  re-authored after 2026-09-03 to remove the leaked fixture identity (`Validation Test`):
  `acb13e7b9`→`929995a37`, `8d0202ab8`→`126ee8098`, `bb8247967`→`f3d4de691`,
  `6cd031fd8`→`8cf6be4ba`.
- **Browser proof**: pending; the Vercel branch preview rebuilds from `552622bc0`.

## Validation Receipt — Review fixes and Phase 5 sweep (2026-09-23)

- **Tested implementation commit SHAs**: review fixes `eb86483e4` (merge of origin/develop
  `f91c76fb6`) through `efd85dceb`, pushed with CI green; Phase 5 `295be57a9` (flow diagrams and
  next steps), `44059edf3` (`llms.txt` and Markdown twins, D5), `576fb6fc7` (EAS scope),
  `2c327c588` (Getting Started checkpoint screenshot), `a2d5a207d` (the last two next-steps gaps).
- **Run at (UTC)**: `2026-09-23T23:17:13Z`
- **Results**: generator tests 22/22 · docs package tests 69/69 across 7 files, including the
  llms and diagram-id tests · `node scripts/docs/generate.mjs --check` (14) ·
  `node docs/scripts/docs-audit.mjs --ci` exit 0 (the two advisory endpoint notes only) ·
  ontology guards pass · docs build green with 67 Markdown twins and `llms.txt` · 225 of 225
  redirects land on built pages. The ready-for-CI push gate runs on the final head before the
  push; its result goes in PR #795's body.
- **Browser proof** (Playwright headless Chromium against the local production build,
  unauthenticated): the Expand overlay passes 12 of 12 checks (focus trap, zoom keys, drag pan,
  Escape, focus return, theme switch, route change); 11 pages render their flow diagrams; the
  Getting Started figure loads in light and dark themes. Accent and diagram measurements are in
  `eval.md`.
- **Review feedback**: 63 threads and reviews collected; every actionable item is fixed on the
  branch. Two are declined with reasons: the fork-indexer claim (in fork mode the local indexer
  still reads live Arbitrum, and Getting Started now says so) and the projection i18n ask
  (decision 12). No GitHub replies or thread resolutions yet; those wait for Afo's go-ahead.
- **Offline queue wording**: Anatomy and Architecture now match the code. Queued work is prepared
  in the background for wallet and passkey users alike, and nothing is sent until the gardener
  taps Upload all. Only commitment actions send on their own, and only for passkey and embedded
  logins (`packages/shared/src/providers/JobQueue.tsx`).
- **Human gates open**: D12 (Afo judges the rendered Anatomy page), the page-length gate, and a
  Reference landing (see `eval.md`).

## Validation Receipt — Third develop merge and the last Codex threads (2026-10-09)

- **Tested implementation commit SHAs**: `2b4d44e04` (owner approvals, three next steps; the fixes
  the previous session left uncommitted in its worktree), `e53c79bef` (merge of origin/develop
  `55a67ae2b`, the 2.0.0 release sync, 1182 commits), `8cec31869` (env file names), `a048963e3`
  (EAS and Tokenbound projections).
- **Merge shape**: 22 conflicts. Eight projections regenerated on the merged tree; the erd,
  env-management, Playwright and Vitest page deletions kept; develop's testing context, design
  skill, Design workflow, validation policy and QA ledger taken with the branch's moved-page paths
  re-applied; hand merges for the pre-push hook (develop's test-path loop plus `GG_PUSH_GATE_ARGS`
  as separate words), ONBOARDING (both sides), the sidebar (develop's Commitment Pool, Brand kit and
  builders Brand kit entries), the Admin page (commitment-pool scope note) and the Passkeys page
  (develop's passkey directory section, lightly re-voiced).
- **Results on the merged tree**: generator tests 23/23 · select-validation, parity, ci-gate,
  branch-policy, ontology and docs-audit suites 286/286 · docs package tests 71/71 ·
  `node scripts/docs/generate.mjs --check` (14) · `node docs/scripts/docs-audit.mjs --ci` exit 0
  (the two advisory endpoint notes only) · `check-ontology` all guards, 3 generated artifacts current
  · `check-qa-id-ledger --base origin/develop` 443 ids, none regressed · codex docs, skill behavior
  contracts (15/15), guidance links (91 files) and docs design parity (11 bindings) pass · docs
  typecheck clean · docs build green: 69 routes, 69 Markdown twins, `llms.txt` 96 lines, 225
  redirect pages.
- **Rendered check (built HTML, text read)**: the EAS and Tokenbound pages carry the deployment
  projection (Sepolia, Arbitrum One, Celo; `WorkApprovalResolver`, `GardenAccount` and
  `GardenToken` as indexer boundaries); the Passkeys page carries develop's directory section; the
  Admin page carries the pooling note; the builders sidebar shows develop's Brand kit link.
- **Policy and workflow routing**: the six contract sources the new catalog entries digest join the
  `docs-generated` rule, the Docs workflow trigger paths and the CI Gate's Docs expectation, the
  same way the module sources do; the 13 skill READMEs the catalog reads join the rule too (develop's
  new parity test caught that they were unrouted).
- **Install note**: `bun install --frozen-lockfile` ran in the worktree to pick up develop's
  dependency moves (happy-dom in, MSW out, viem 2.55.13); no manifest or lockfile changed.
- **Human gates open**: D12, the page-length gate, a Reference landing, the GitHub thread replies,
  and taking PR #795 out of draft.

## Validation Receipt — QA round 1 (2026-10-10)

- **Tested implementation commit SHAs**: `a7f89bd01` (site chrome: flat canvas, one sidebar
  highlight, navbar and footer), `5ba4d32d0` (per-mode mermaid palettes, parseable lifecycle
  diagrams, CopyCommand, command inventory order, testing guide order), `e747e18c8` (Deployments &
  Addresses with linked addresses, data-driven entity matrix), `d33522ad3` (Personas under
  Architecture, explained CI workflows, grouped contract operations, readable routing, status
  table, onboarding projection), `efa625a01` (hand-written pages, design tokens projection and
  component, six Storybook captures). The hub update is the commit after these.
- **Run at (UTC)**: 2026-10-10T00:25:00Z to 2026-10-10T00:35:00Z
- **Exact commands and results**:
  `node --test scripts/docs/generate.test.mjs scripts/docs/mermaid-parse.test.mjs docs/scripts/llms.test.mjs docs/scripts/developer-guides.test.mjs docs/scripts/docs-audit.test.mjs docs/scripts/check-search-index.test.mjs scripts/quality/check-ontology.test.mjs scripts/quality/select-validation.test.mjs scripts/quality/task-routing-contract.test.mjs`
  → 248/248 · `node scripts/docs/generate.mjs --check` → 16 projections current ·
  `node scripts/quality/check-ontology.mjs` → all guards, 3 generated artifacts current ·
  `node docs/scripts/docs-audit.mjs --ci` → exit 0, the two advisory endpoint notes only ·
  `node scripts/quality/check-docs-design-parity.mjs` → 11 bindings aligned · in `docs/`:
  `bun run test` 84/84, `bun run typecheck` clean, `bun run build` green (69 routes, search index
  covers 69).
- **Rendered proof** (docs local production build served on 127.0.0.1:3013, browser pane, light
  and dark, desktop and the 375px mobile preset): one canvas (`html` and `body` the same color,
  `.main-wrapper::before` is `none`); navbar Community, Builders, App, Admin; the Builders sidebar
  starts Getting Started, First Contribution, Architecture; the active link is `rgb(26,117,68)` on
  a 12% tint with an 8px radius and no left border, the parent category shows the color only, and
  an open category's wrapper takes the same tint, on builders and community pages alike; footer
  four links per column, titles `#171717` and links `#5c5c5c` on `#f7f7f7` in light mode;
  code-block buttons at 0.55 opacity at rest and 0.9 on the mobile preset with no horizontal
  scroll. Data model: 8 diagrams, 0 "Try again", 8 Expand controls, 5 mechanism tables; in dark
  mode node fill `#14532d`, label `#dcfce7`. How It Works: both community diagrams render. Command
  inventory: Repository root first, docs last, 247 copy buttons (the pane denies clipboard writes,
  so the button shows "Copy failed", the designed fallback). Deployments & Addresses: Arbitrum One,
  Celo, Ethereum Mainnet, Sepolia sections; 65 arbiscan, 14 celoscan and 9 easscan schema links;
  117 copy buttons; the libraries collapsed. Entity matrix: Silvi "Vocabulary mapping only", ENS
  lists its recorded networks, no Planned badge. Personas and Surfaces is first under Architecture
  and the old reference slug still answers. Design: 16 swatches, 6 pairings, 4 type rows in the
  brand Inter, 7 radii, 6 figures served (every image path answers 200). Architecture shows five
  ideas and the arrow `contracts → indexer → shared → client / admin / agent`. Integrations: list,
  status table (9 rows), ownership. Testing Guide: runners Storybook, Vitest, Playwright, Mocha,
  Foundry; surfaces Client, Admin, Agent, Shared, Indexer, Contracts; 19 copy buttons. Product QA
  titled and labelled as such with the current `bun run qa pull` and `bun run qa report` commands.
  CI & GitHub Actions: Workflow, Purpose, Runs on, Required columns, CI Gate the only Yes, 16
  sections.
- **Validated paths**: `docs/`, `scripts/docs/`, `scripts/data/validation-policy.json`,
  `scripts/data/workflow-catalog.json`, `scripts/quality/check-ontology.mjs`,
  `scripts/quality/ontology-render.mjs`, `packages/shared/src/ontology/green-goods-ontology.json`,
  `.github/workflows/docs.yml`, `.claude/skills/design/{review-checklist,ecosystem}.md`.
- **Worktree identity**: `git status --porcelain=v1 --untracked-files=all -- docs scripts/docs scripts/data scripts/quality packages/shared/src/ontology .github/workflows/docs.yml` → empty after the content commits.
- **Push gate**: run on the pushed head through this branch's own pre-push hook with the ontology
  check and the nine docs test files as focus; the PR body records the result.
- **Human gates open**: D12 (Afo judges the rendered Anatomy page), the page-length gate, a
  Reference landing, and the merge.

## Validation Receipt — QA round 2 (2026-10-10)

- **Scope**: Afo's eleven items from the rebuilt local build (old admin captures, guild framing,
  capital formation, route literals, full-width infographic, the dense entity matrix, the design
  page's structure, package order, retired commands, Unlock through GreenWill, more product
  captures) plus a self-review pass; decisions 21 to 27.
- **Exact commands and results**:
  `node --test scripts/docs/generate.test.mjs scripts/quality/check-ontology.test.mjs docs/scripts/developer-guides.test.mjs scripts/quality/select-validation.test.mjs docs/scripts/llms.test.mjs docs/scripts/docs-audit.test.mjs scripts/docs/mermaid-parse.test.mjs scripts/quality/task-routing-contract.test.mjs docs/scripts/check-search-index.test.mjs`
  → 248/248 · `node scripts/quality/check-ontology.mjs --generate` then `node scripts/docs/generate.mjs`
  → 16 projections, `--check` clean after the commits · `node scripts/quality/check-ontology.mjs` → all
  guards, 3 generated artifacts current · `node docs/scripts/docs-audit.mjs --ci` → exit 0, the two
  advisory endpoint notes only · `node scripts/quality/check-docs-design-parity.mjs` → 11 bindings
  aligned · in `docs/`: `bun run test` 85/85, `bun run typecheck` clean, `bun run build` green (70
  routes, search index covers 70).
- **Captures** (Storybook, deployed build, headless Chromium at 2x, light theme; the public site at
  greengoods.app, headless Chromium 1440x900 at 2x): the admin Hub Work tab (Rio Rainforest Lab,
  approved submissions), Actions registry, Garden Promises tab, Hub Hypercerts tab, the PWA Your Work
  sheet, the public home, gardens, impact, vaults and cookies pages, and four design-system stories
  (color gallery, website foundations and buttons, admin buttons). The Hub work-detail story renders
  "Work not found" on the deployed build and was not used; the Hub work-queue story's garden has no
  seeded work, so the approved tab stands in for the queue.
- **Rendered proof** (docs local production build served on 127.0.0.1:3013, browser pane): every
  figure on Anatomy and Design reports `complete` with a natural width (6 and 14 images); the
  infographic renders at the full column width; Data Model renders 8 of 8 diagrams with no failure
  fallback (the console's parse errors in that tab predate round 1's fix); Personas shows the
  persona-by-surface matrix and no route literals; Entity Matrix opens with the glance table and
  one section per protocol; Unlock Protocol sits last under Integrations; Architecture lists six
  ideas with the Promises-tab figure; First Contribution ends with Stay in touch and the new admin
  capture; the Packages sidebar reads Contracts, Indexer, Shared, Agent, QA, Admin, Client.
- **Validated paths**: `docs/`, `scripts/docs/`, `scripts/data/validation-policy.json`,
  `scripts/quality/{check-ontology.test,ontology-render}.mjs`,
  `packages/shared/src/ontology/green-goods-ontology.json`, `.github/workflows/{docs,ontology}.yml`.
- **Worktree identity**: `git status --porcelain` → empty after commits `0ef282c23` and `b691dbdf9`.
- **Push gate**: run on the pushed head through this branch's own pre-push hook with the ontology
  check and the nine docs test files as focus; the PR body records the result.
- **Human gates open**: D12 (Afo judges the rendered Anatomy page), the page-length gate, a
  Reference landing, the merge, and the review-pass items left to Afo (community pages and footer
  still name the guild; root DESIGN.md says website buttons are 16px while DL-029 and the Storybook
  say square; the Command inventory order).
