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

## Validation Receipt — Review-pass fixes (2026-10-10)

- **Scope**: the self-review items Afo accepted after QA round 2; decisions 28 to 31. Commits
  `461515da2` and `500082846`.
- **Exact commands and results**:
  `node --test scripts/docs/generate.test.mjs scripts/quality/check-ontology.test.mjs docs/scripts/developer-guides.test.mjs scripts/quality/select-validation.test.mjs docs/scripts/llms.test.mjs docs/scripts/docs-audit.test.mjs scripts/docs/mermaid-parse.test.mjs scripts/quality/task-routing-contract.test.mjs docs/scripts/check-search-index.test.mjs`
  → 248/248 · `node scripts/docs/generate.mjs --check` → 16 projections current ·
  `node docs/scripts/docs-audit.mjs --ci` → exit 0, the two advisory endpoint notes only (every
  retired capture had its consumer repointed first) · `node scripts/quality/check-docs-design-parity.mjs`
  → 11 bindings aligned · in `docs/`: `bun run test` 85/85, `bun run typecheck` clean,
  `bun run build` green (70 routes, search index covers 70).
- **Captures** (Storybook, deployed build, headless Chromium at 2x, light theme; easscan.org,
  headless Chromium 1440x900 at 2x): Create Garden, Create Action, the Garden overview, the admin
  sign-in, the shared foundation controls, Submit Work media and review, Your Work offline, and
  the Green Goods Work Submission schema page. Not usable: the hats app renders tree 92 too small
  at viewport size and arbiscan answers with a bot check.
- **Rendered proof** (docs local production build on 127.0.0.1:3013, browser pane): every image on
  EAS, Submit Work (six) and Managing Actions (two) reports `complete` with a natural width;
  Deployments & Addresses shows "ERC-6551 account proxy" and "Root garden" with the raw key only in
  the zero-address line; Why We Build's article carries no "Dev Guild" (the footer copyright line
  still does, by decision 28).
- **Validated paths**: `docs/`, `scripts/docs/`, `DESIGN.md` (prose only; the front matter and the
  generated token JSON are unchanged in value).
- **Worktree identity**: `git status --porcelain` → empty after the two commits.
- **Push gate**: run on the pushed head through this branch's own pre-push hook with the ontology
  check and the nine docs test files as focus; the PR body records the result.
- **Human gates open**: unchanged (D12, the page-length gate, a Reference landing, the merge) plus
  the items left on purpose in the status note above.

## Validation Receipt — Develop merge and Codex round (2026-10-10)

- **Scope**: merge develop (`8c57a9d56`, 43 commits) and address the 19 unresolved Codex threads
  from QA rounds 1 and 2; decisions 32 to 34. Commits `5d68e7eaf` (merge), `409f3e25a` (hook),
  `fd152d851` (docs and generators); pushed head `fd152d851`.
- **Merge**: conflicts only in `docs/docs/builders/packages/commands.mdx` and
  `docs/docs/builders/quality/test-cases.mdx`; both regenerated from the merged sources with
  `node scripts/docs/generate.mjs`, then `node scripts/quality/check-ontology.mjs --generate`.
- **Thread ledger**: 19 unresolved at classification (all Codex P2, opened against `08fcea646`
  through `39c1554ac`); 18 ACTIONABLE and fixed, 1 STALE at the live head (the design-page corner,
  fixed by `500082846` before the thread was opened); none ambiguous or declined. Review bodies: the
  four Codex summaries (informational); conversation comments: bot summaries, Afo's brand-kit note
  and the `@coderabbitai review` trigger (informational). 91 threads, 95 reviews, 7 comments; every
  connection read to completion.
- **Exact commands and results** (merged tree): `node --test` over the generator, ontology,
  docs-script, selector, mermaid-parse, routing and search-index suites → 249/249 after the merge;
  the five suites the fixes touch (generator, hook parity, developer guides, audit, twins) → 111/111;
  `node scripts/docs/generate.mjs --check` → 16 current; `node scripts/quality/check-ontology.mjs`
  → all guards; `node docs/scripts/docs-audit.mjs --ci` → exit 0; docs `bun run build` → 70 routes,
  search index covers 70.
- **Rendered proof**: none this round (prose, frontmatter, generated tables and a hook change; the
  build is the proof the MDX renders).
- **Validated paths**: `.husky/pre-push`, `scripts/quality/workflow-performance-parity.test.mjs`,
  `scripts/docs/{renderers,generator-core}.mjs` and their test, thirteen builder pages, the
  regenerated Contract operations page.
- **Worktree identity**: `git status --porcelain` → empty after each commit.
- **Push gate**: run on the pushed head through this branch's own pre-push hook with the ontology
  check and the nine docs test files as focus; the PR body records the result.
- **GitHub writes**: one reply and a resolution on each of the 19 threads, authorized by Afo's
  request to address and resolve the valid comments.
- **Human gates open**: unchanged (D12, the page-length gate, a Reference landing, the merge).

## Validation Receipt — Second develop merge, CI Gate, and six Codex threads (2026-10-10)

- **Scope**: the desktop app's Auto-fix event for head `70e64a58d`: a conflict with develop, a
  failing CI Gate, and new review comments. Decisions 35 to 38. Commits `75ed33894` (merge),
  `422606c9d` (CI Gate and the gate wording), `99a4d0ff9` (twins), `807b8ffc2` (prose); pushed
  head `807b8ffc2`.
- **Merge**: develop `e602fc13d` (5 commits, the Linear closeout guidance). One conflict, the
  generated Task Routing page, regenerated; the three skill files develop changed
  (`.claude/skills/{debug,plan,ship}/SKILL.md`) merged identical to develop.
- **CI Gate root cause**: the gate job runs `node --test scripts/quality/select-validation.test.mjs …`
  with no install, and one selector test imports `scripts/docs/generate.mjs`, whose reader imported
  `js-yaml` at module load since `d33522ad3`. GitHub ran no pull-request workflows while the branch
  conflicted with develop, so the failure first showed on `fd152d851`, after the previous merge.
  Reproduced in a copy of the tracked tree with no `node_modules` (1 of 225 failing with
  `Cannot find package 'js-yaml'`), fixed by resolving the parser where a workflow is parsed, and
  rerun in a fresh package-free git copy: 225 of 225. The new graph test fails on the old reader
  and passes on the new one.
- **Feedback ledger**: 97 threads, 6 unresolved at classification (all Codex P2 on `70e64a58d`),
  all ACTIONABLE and fixed. Reviews: 115, all read; 20 carry a body: 16 Codex summaries
  (informational) and 4 CodeRabbit summaries from September whose inline findings are resolved
  threads, plus one outside-diff finding (duplicate ERD group members), STALE:
  `assignDataModelGroups` rejects a member listed twice and a test pins it. Conversation comments:
  7, informational. **Correction to the previous receipt**: it said every connection was read to
  completion, but it read review bodies from the last 30 of 95 reviews; this round read all of them.
- **Sweep**: best-effort mint hooks (`GardenHooksLib`) checked against every integration page and
  Architecture: Cookie Jar, ENS and the Architecture modules section corrected; Octant, Gardens,
  Hats and Karma make no unconditional mint claim. Assessment ordering: no other builder or
  community page orders it after approved work. Cited code paths: all 80 backticked repository
  paths in the hand-written builder pages exist. Bare component tags in twins: none left on any
  page (the new test walks all of them).
- **Exact commands and results**: `node --test` over the generator, ontology, docs-script,
  selector, mermaid-parse, routing, search-index and hook-parity suites → 294/294 ·
  `node scripts/docs/generate.mjs --check` → 16 current · `node scripts/quality/check-ontology.mjs`
  → all guards · `node docs/scripts/docs-audit.mjs --ci` → exit 0, the two advisory endpoint notes ·
  `check-docs-design-parity` → 11 bindings · in `docs/`: `bun run test` 87/87, `bun run typecheck`
  clean, `bun run build` green (70 routes, search index covers 70).
- **Rendered proof** (docs local production build on 127.0.0.1:3013, browser pane): the welcome
  page draws four role cards (gardener, steward, funder, builder) with icons and links from the
  data file; the steward path lists four steps with the current one active; Cookie Jar shows the
  new "Two kinds of jar" section, its diagram and no failure fallback; CI & GitHub Actions shows
  five "never waits" lines. Built twins: `/brand.md`, `/builders/architecture/design.md`,
  `/index.md` and a steward page carry the data and no bare tag.
- **Validated paths**: `scripts/docs/`, `docs/scripts/llms*.mjs`, `docs/plugins/llms-twins.mjs`,
  `docs/src/components/docs/{Hero,StewardPathNav}.tsx`, `docs/src/data/{role-paths,steward-path}.json`,
  five builder pages, two regenerated pages.
- **Push gate**: run on the pushed head through this branch's own pre-push hook with the ontology
  check and the nine docs test files as focus; the PR body records the result.
- **GitHub writes**: one reply and a resolution on each of the six threads, under Afo's standing
  request to address and resolve the valid comments.
- **Human gates open**: unchanged (D12, the page-length gate, a Reference landing, the merge).

## Validation Receipt — Two Codex threads on c839256b6 (2026-10-10)

- **Scope**: the two threads Codex opened on `c839256b6`; both ACTIONABLE, fixed in `a380cd0e9`.
- **Copied contract commands**: 13 of 92 operations declare always-required values the copied row
  omitted. Before the fix, 13 rendered commands could not be completed (the resolver's own
  `requires --expected-nonce`, `--step`, `--commit`, `--receipt` errors); after it, all 92 resolve
  when filled from their own row. Mode-only requirements (a nonce to plan or broadcast on a few
  operations) stay in `--help`, and the page says so.
- **API Index**: `renderApiIndex` projects `PUBLIC_AGENT_ROUTES` (9 routes). The agent also serves
  six public paths with their own constants (garden join requests, profile avatars, a feature
  flag), so the page, the Monorepo Map and the Agent page now describe the table as the contract's
  routes. Indexing the rest is a generator change left as a follow-up.
- **Exact commands and results**: `node --test` over the same ten suites → 295/295 ·
  `node scripts/docs/generate.mjs --check` → 16 current · `node docs/scripts/docs-audit.mjs --ci` →
  exit 0 · docs `bun run build` → 70 routes, search index covers 70.
- **Rendered proof**: none needed (generated tables and two prose lines; the build is the proof the
  MDX compiles).
- **Ledger at close**: 99 threads; the two new ones replied to and resolved after the push.

## Validation Receipt — Two Codex rounds and the agent route index (2026-10-11)

- **Scope**: three threads Codex opened on `2aae01200` (fixed in `01dce161d`), four it opened on
  `01dce161d` (fixed in `6f631c8dc`), and the route index Afo asked for in this session
  (`ea2b5f410`), which he chose to add to this PR. Decisions 39 to 43.
- **Feedback ledger**: seven threads, all ACTIONABLE. Compact button corner (12px at rest, 8px
  pressed, per the theme tokens); Cookie Jar definition (two gates); persona surfaces (fixed in
  the page's wording, not in the ontology: the eligibility hook admits stewards, owners and
  evaluators, so the finding held for gardeners and funders only, and the field is a vocabulary
  rule); the Indexer page's read path (the agent's reporting services query the indexer directly);
  integration page sources (ENS, then all nine pages); Unlock completeness (nested deployment
  fields); the token gallery's radius caption (cards are 16px).
- **Route index**: the reader resolves the path argument of all 74 `app.<verb>()` calls in
  `packages/agent/src/api` to 76 registrations and lists the 19 public paths: 9 from
  `PUBLIC_AGENT_ROUTES`, 4 saved offers, 2 profile avatars, 4 join requests. Five have no Shared
  constant. Sources: three Shared contract files and eleven Agent API files; two files that only
  mentioned the contract are no longer sources.
- **Sensitive surfaces changed**: `scripts/data/validation-policy.json` (the docs-generated rule
  and the Docs workflow rule) and `.github/workflows/docs.yml` (two Shared contract files added
  to both path lists). No permission or safety check is weakened: the change adds inputs that
  select the Docs checks.
- **Exact commands and results**: `node --test` over the nine docs, ontology, selector and parity
  suites → 291/291 · `node scripts/docs/generate.mjs --check` → 16 current ·
  `node scripts/quality/check-ontology.mjs` → all guards passed · `node docs/scripts/docs-audit.mjs --ci`
  → exit 0, two advisory warnings that predate this round · docs `bun run test`,
  `bun run typecheck` and `bun run build` → exit 0, 70 routes, search index covers 70.
- **Regression proof**: with the public rule put back to contract-only, the fixture test and the
  real-repository completeness test fail (`/public/features/garden-join-requests is missing from
  the API Index`); restored, both pass. The completeness test scans the Agent API and the route
  contracts for quoted `/public/` paths by a separate pattern and requires a row for each.
- **Package-free CI Gate job**: the gate job's exact `node --test` command in a copy of the tracked tree at `ea2b5f410` with no `node_modules` → 225/225, so the new reader loads no package.
- **Push gate**: run on `ea2b5f410` with the ontology check and the nine docs test files as focus: passed, 12 fresh passes, 0 reused, 0 unrun of 13 selected checks; the thirteenth is the manual browser proof, recorded above.
- **Rendered proof**: local production build in the desktop app's browser pane, no sign-in. API
  Index: 19 rows, the four columns, the 404 note and the constants list; no page-level overflow
  at 1280 and 375 wide (the table scrolls inside itself, like the exports table below it). Unlock
  page: Arbitrum One reads Deployed with the registry, factory and three locks. ENS page: the
  receiver and mint-time rows. Indexer, Design and Personas pages: the corrected sentences.
- **GitHub writes**: one reply and a resolution on each of the seven threads, under Afo's
  standing request to address and resolve the valid comments.
- **Follow-up left out of this PR**: the four join-request paths are written in both
  `packages/agent/src/api` and `packages/shared/src/modules/garden-join-requests/transport.ts`
  with no shared constant. Afo chose a backlog issue for it.
- **Human gates open**: unchanged (D12, the page-length gate, a Reference landing, the merge).

## Validation Receipt — Five Codex threads on fee71dd2e (2026-10-11)

- **Scope**: the five threads Codex opened on `fee71dd2e`; all ACTIONABLE, fixed in `517e8cb49`.
  Decisions 44 to 46. GitHub CI was green on `fee71dd2e` (30 pass, 6 skipped) before this round.
- **EAS completeness**: `selectSafeDeploymentFields` (renamed from the address-only selector) takes
  a schema UID for a field ending in `SchemaUID` and an address for any other, and rejects the
  wrong shape either way. Generated status: Sepolia and Arbitrum One Deployed with six fields, Celo
  Partial with four.
- **Vault custody**: verified in `Octant.sol` (the module is the vault's role manager and the
  donation address defaults to the yield resolver) and `Yield.sol` (three-way split; the garden
  account is the fallback when a Cookie Jar or treasury is not set).
- **Best-effort setups**: verified in `GardenHooks.sol`, `Gardens.sol` (`GardenPartiallyInitialized`,
  `createGardenPools`, `retryCreateCommunity`) and `ENSReceiver.sol` (`NameRegistrationSkipped`,
  `ENSRegistrationFailed` followed by `NameRegistered`).
- **Exact commands and results**: `node --test` over the nine suites → 291/291 ·
  `node scripts/docs/generate.mjs --check` → 16 current · `node scripts/quality/check-ontology.mjs`
  → all guards passed · `node docs/scripts/docs-audit.mjs --ci` → exit 0, the same two advisory
  warnings · docs `bun run test` 87/87 and `bun run build` → 70 routes, search index covers 70.
- **Push gate**: run on `517e8cb49` with the ontology check and the nine docs test files as focus: passed, 12 fresh passes, 0 reused, 0 unrun of 13 selected checks; the thirteenth is the manual browser proof, recorded below.
- **Rendered proof**: local production build in the desktop app's browser pane, no sign-in. The
  Gardens, ENS and Octant diagrams render with their new labels and no parse error; the EAS status
  table shows Celo as Partial; the Contracts page shows the three corrected rows; no console
  errors.
- **GitHub writes**: one reply and a resolution on each of the five threads, under Afo's standing
  request to address and resolve the valid comments.
- **Human gates open**: unchanged (D12, the page-length gate, a Reference landing, the merge). The
  Vault and Cookie Jar definitions are canonical glossary text changed in review; worth a read.

## Validation Receipt — Five Codex threads on 61234a5a4 (2026-10-11)

- **Scope**: the five threads Codex opened on `61234a5a4`, relayed by the desktop app's Auto-fix;
  all ACTIONABLE, fixed in `fa3811a01`. Decisions 47 to 49. GitHub CI was green on `61234a5a4`.
- **ENS completeness**: `integrationNetworkRecords` resolves each field on the network that hosts
  it and drops a network that only hosts another's component. Generated status: Sepolia Deployed,
  Arbitrum One Deployed with `ensReceiver` on Ethereum Mainnet, no Ethereum row. The component and
  the Markdown twin print where a remote field lives. `check-ontology` rejects a mapping that names
  an undeclared field or its own chain.
- **Verified in the contracts**: `joinGarden` and `setOpenJoining` in `accounts/Garden.sol` with
  the Hats module accepting the garden account as a caller; the transfer hook in `tokens/Garden.sol`
  enforcing only `transferRestriction` and `isOwner` reading the owner hat; ERC-4626 redemption for
  the principal wording.
- **QA catalog**: `DOCS-033` reworded (preconditions, one step, the expected result). The id ledger
  check reports 443 ids, none removed, reintroduced or reactivated.
- **Exact commands and results**: `node --test` over the nine suites → 292/292 ·
  `node scripts/docs/generate.mjs --check` → 16 current · `node scripts/quality/check-ontology.mjs`
  → all guards passed · `node docs/scripts/docs-audit.mjs --ci` → exit 0, the same two advisory
  warnings · docs `bun run test` 87/87, `bun run typecheck` clean, and a production build into a
  side folder → 70 routes, search index covers 70.
- **Push gate**: run on `fa3811a01` with the ontology check and the nine docs test files as focus: passed, 12 fresh passes, 0 reused, 0 unrun of 13 selected checks; the thirteenth is the manual browser proof, recorded below.
- **Rendered proof**: the side build served on a second local port and read in a background tab of
  the desktop app's browser pane, no sign-in. The Hats diagram renders the open-joining path with
  no parse error; the ENS table shows `ensReceiver (on Ethereum Mainnet)` on Arbitrum One; the
  Tokenbound paragraph and the entity matrix's ENS row show the new text; no console errors. The
  build was then swapped into the folder Afo's preview serves.
- **GitHub writes**: one reply and a resolution on each of the five threads, under Auto-fix and
  Afo's standing request to address and resolve the valid comments.
- **Human gates open**: unchanged (D12, the page-length gate, a Reference landing, the merge).

## Validation Receipt — Four Codex threads on da0163580 (2026-10-11)

- **Scope**: the four threads Codex opened on `da0163580`, relayed by the desktop app's Auto-fix.
  Three ACTIONABLE and fixed in `c57faf305`; one declined with evidence. Decisions 50 to 52.
- **Transfer and roles (Architecture)**: re-read `_beforeTokenTransfer` in `tokens/Garden.sol`
  (restriction only), `isOwner` in `accounts/Garden.sol` (the owner hat), and
  `_requireOwnerOrOperator` in `modules/Hats.sol` (the garden account, an owner or a steward may
  rotate roles). The paragraph now matches the Tokenbound page.
- **Type gallery**: the three brand-kit TTFs have no `fvar` table and `usWeightClass` 400 (read
  from the files). The samples now link the client's two font stylesheets through
  `@docusaurus/Head`. New test in `designTokens.test.ts`; it failed as expected with a token
  weight changed to 800 ("editorial is Fraunces 800, outside the loaded 400..700") and with a
  request the client does not make, and both files were restored.
- **Docs row**: `bun run check -- --intent qa --only docs-authority` ran on its own in 5 s: 65
  tests including the Mermaid parser, the audit, and the projection check (16 current).
- **Fork-mode indexer (declined)**: `productionProfileEnv("fork")` does set `ARBITRUM_RPC_URL` to
  Anvil, but only on the process that runs `docker compose`; the compose file forwards no RPC
  variable, the Envio config has no RPC source, and Envio 3.6.1 reads no RPC URL from the
  environment. `smoke-full.js` passes no chain head to `checkIndexerLag` in fork mode. Read from
  the code; the fork stack was not started.
- **Exact commands and results**: `bun run check -- --intent qa --only docs-authority` → passed ·
  docs `bun run test` → 88/88 · docs `bun run typecheck` → clean · production build into a side
  folder → exit 0, search index covers 70 routes.
- **Push gate**: hand-run with the hook's own arguments on `c57faf305`: passed; 12 fresh passes, 0 reused, 0 unrun of 13 selected checks (push), 68 s; `browser-proof` stays advisory and is recorded above.
- **Rendered proof**: local production build on a second port, read in a background tab of the
  desktop app's browser pane, no sign-in. On the Design page the two font stylesheets are linked,
  the loaded faces include `Inter 100 900` and `Fraunces 400 700`, `document.fonts.check` is true
  for 600 22px Inter, 500 12px Inter and 700 48px Fraunces, and the samples compute
  `font-synthesis: none`. The build was then swapped into the folder Afo's preview serves.
- **GitHub writes**: one reply and a resolution on each of the four threads.
- **Human gates open**: unchanged, plus one flag for Afo: the fork-indexer comment in
  `scripts/dev/stack.js` against `ONBOARDING.md`.

## Validation Receipt — Afo's final pass, the develop merge, and the explorer twin (2026-10-11)

- **Scope**: fifteen notes from Afo's pass on the local build, four of them decided by clickable
  questions (decisions 53, 55, 56, 57); a merge of develop at `5886bebcc`; one Codex note on
  `270f78cb8`. Commits `65e16b847`, `a195e520e`, `4610170d2`, `154a382db`.
- **Personas**: journeys for the five personas (23 interactions) in
  `green-goods-projections.json`, each row checked against the role guides and the code it points
  at (all paths exist). The page inherits two availability notes from capability records dated
  2026-08-15: commitments "deployed, not switched on" and hypercerts "still being built". Flagged
  to Afo as possibly stale; the records are his to change.
- **Matrix**: re-read `modules/Hats.sol` (admin hat under the protocol's Gardens hat; the six role
  hat names), `modules/Karma.sol` (project admins, project updates), `modules/CookieJar.sol`
  (`jarOwner: garden`), the ENS page (subnames for gardens and gardeners) and the hypercert
  allowlist hook (contributors). No conviction "proposal" term was verified, so none was added.
- **Merge**: the four conflicts were all generated pages (the API index, the command inventory,
  the test cases, and develop's copy of the CI page at its old path). Resolved by keeping the
  branch's layout and regenerating from the merged sources; the drift check reads 17 current.
- **Explorer twin**: `docs/src/data/revenue-explorer.json` is rendered from
  `protocolRevenueModel.ts`; the test checks each preset's streams add up to its revenue and its
  margin is revenue minus expenses, so the outputs were computed and not typed.
- **Exact commands and results**: `node --test` over the ten docs, ontology and selector suites
  → 303/303 before the explorer change and 157/157 on the three suites it touched ·
  `bun run check -- --intent qa --only docs-authority` → passed (69 tests, audit, 17 projections
  current) · `node scripts/quality/check-ontology.mjs` → all guards passed · docs `bun run test`
  → 89/89 · docs `bun run typecheck` → clean · production build into a side folder → exit 0,
  search index covers 70 routes.
- **Push gate**: hand-run with the hook's own arguments on `154a382db`: passed; 12 fresh passes, 0 reused, 0 unrun of 13 selected checks (push), 75 s; `browser-proof` stays advisory and is recorded above.
- **Rendered proof**: local production build, read in a background tab of the desktop app's
  browser pane, no sign-in. Personas page: seven sections, six tables, five code lists, four
  availability notes. Entity matrix: ten protocol sections, no Silvi, Lido, FTC or TAM. MCP guide:
  seven connected services. Economics explorer: the calculator still renders (44 inputs) and its
  `.md` twin has the model's tables and no BrowserOnly block. Earlier in the round: the CI table's
  command column went from 74px to 188px with one-line commands, no deployments table scrolls at a
  511px column, and the footer matches the page background in both color modes.
- **GitHub writes**: none for the explorer note (a review summary with no thread to answer).
- **Human gates open**: D12, the page-length gate, a Reference landing, the merge, the two
  capability records above, and the three filed tasks.

## Validation Receipt — Path audit and the screenshot pass (2026-10-11)

- **Scope**: the last two of Afo's fifteen notes that belong on this branch. Commits `e2548a283`
  and `052c8ad82`; decisions 60 and 61.
- **Path audit**: run on the real pages it checked 178 path mentions and found three: two entry
  files with the wrong extension on the Client page (fixed in `a195e520e`) and the indexer's
  generated folder, which git ignores and the rule now skips. With one wrong name put back, the
  audit exits 1 and names it. A fixture test covers a missing path in a code span and a missing
  row in a package page's directory table.
- **Screenshots**: seven frames captured from the deployed Storybook at the standard size. Three
  were used (the Submit Work media and review steps, and the sign-in component cropped to its
  content). Four were rejected on sight: the Hub work-queue and work-detail stories render an
  empty queue and a "Work not found" dialog, and the two protected-surface stories are schematic
  compositions, not screens.
- **Exact commands and results**: `node --test docs/scripts/docs-audit.test.mjs` → 12/12 ·
  `node docs/scripts/docs-audit.mjs --ci` → exit 0 · `bun run check -- --intent qa --only
  docs-authority` → passed · production build → exit 0, search index covers 70 routes.
- **Rendered proof**: local production build in a background tab of the desktop app's browser
  pane, no sign-in. Anatomy shows two frames at 240x517 with the new caption (before the fix to
  the row's CSS they rendered 240x1688, stretched by their height attribute); the Passkeys page
  shows the cropped sign-in figure at 511x355.
- **Human gates open**: unchanged, plus the seven captures the plan lists as not replaced.

## Validation Receipt — Three Codex threads on 2b9809c9e (2026-10-11)

- **Scope**: the three threads Codex opened on `2b9809c9e`, relayed by the desktop app's Auto-fix;
  all ACTIONABLE, fixed in `f156d771e`. Decisions 62 and 63.
- **Read in the agent**: `handlers/join.ts` (checks the garden exists, sets the chat's
  `currentGarden`), `status.ts` (wallet, role, garden, session step, submission allowance),
  `submit.ts` (text or voice into a draft, confirm adds it to the bot's pending list),
  `pending.ts`, `approve.ts` (checks the steward on-chain, then submits the work with the
  gardener's key and the approval with the steward's) and `reject.ts`.
- **Read in the contracts**: `_grantRole`, `_grantSubRole` and `_revokeRole` in
  `modules/Hats.sol`; `grantRole` and `revokeRole` are gated by `_requireOwnerOrOperator`, which
  also admits the garden account, and the base Tokenbound account lets the token holder execute.
- **Same class, same pass**: every other journey row's code path was re-read. Three pointers were
  corrected (join requests and role dialogs in the cockpit, the endowment panel) and the
  commitment pool row now uses the steward guide's verbs.
- **Exact commands and results**: `node --test` over the generator, ontology and twin suites →
  124/124 · `bun run check -- --intent qa --only docs-authority` → passed ·
  `node scripts/quality/check-ontology.mjs` → all guards passed · drift check → 17 current.
- **GitHub writes**: one reply and a resolution on each of the three threads.
- **Human gates open**: unchanged.

## Validation Receipt — Five Codex threads on 4fdcfa0cd, before the merge (2026-10-11)

- **Scope**: the five threads Codex opened on `4fdcfa0cd`; all ACTIONABLE, fixed in `66f5255a6`.
  Decisions 64 to 66.
- **Read before changing**: the three deployment artifacts (Arbitrum records the testimony
  resolver and five schema UIDs, Sepolia three resolvers and three schemas, Celo three resolvers
  and one schema); `resolvers/Testimony.sol` and `resolvers/Yield.sol` (an `IAccountant`, not a
  schema resolver); the cockpit's vault view, position card, payouts tab and cookie jar screens;
  `modules/data/eas.ts` (queries only); and the selector's plan for a hook-only change (format and
  lint before, the validation-system suite after).
- **Sensitive surfaces**: `scripts/data/validation-policy.json`, `docs.yml`, `ontology.yml` and
  `supply-chain-guardrails.yml` gain inputs only: the two hooks and the testimony resolver.
- **Exact commands and results**: `node --test` over the generator, ontology, twin, selector,
  workflow-parity, gate, audit and guide suites → 322/322 ·
  `bun run check -- --intent qa --only docs-authority` → passed ·
  `node scripts/quality/check-ontology.mjs` → all guards passed · drift check → 17 current ·
  docs `bun run test` → 90/90.
- **Human gates open**: D12, the page-length gate, a Reference landing, the seven captures without
  a faithful source, and the two capability records dated 2026-08-15.

## Validation Receipt — The merge of PR #795 (2026-10-12 UTC)

- **Scope**: the record of the merge and one correction. No page, generator or check changed in
  this entry. The `ui` and `state_api` lanes move from `in_progress` to `blocked` on Afo's review
  gates (`plan-hub.mjs set-lane`), and the hub's overall status is `blocked`; nothing is certified
  and the hub is not closed.
- **Merged**: PR #795 into `develop` at 2026-10-12T04:41:41Z as merge commit
  `5c37667fe48dc159c90a45b4004895fe51290a5f`, parents `b0f1e9e6d` (develop) and `2da291351` (the PR
  head). A merge commit, not a squash, pinned to the head with `--match-head-commit`.
- **State at the merge**: CI Gate passed on `2da2913516051f818ec6b551e5c98ff60604b5c1`; all 128
  review threads resolved; CodeRabbit's changes-requested review of 2026-09-03 dismissed at Afo's
  direction (decision 66). The last push gate ran on the same head (12 of 13 checks fresh,
  browser-proof advisory).
- **Exact commands and results**:
  `git diff --stat 2da2913516051f818ec6b551e5c98ff60604b5c1 5c37667fe48dc159c90a45b4004895fe51290a5f`
  → one file, `scripts/dev/stack.js` (develop's own change from PR #1076), so every path the gate
  and CI validated on the head is what landed ·
  `git merge-base --is-ancestor 66f5255a6 origin/develop` → exit 0 ·
  `git ls-remote --heads origin feature/builder-docs-rebuild` → empty (the branch was removed at
  the merge).
- **After the merge**: the Linear closeout ran. Vercel built develop at the merge commit. The
  public docs site still served its production build of 2026-10-06 and returned 404 for
  `/builders/architecture/personas` (unauthenticated requests, 2026-10-12); the rebuild reaches it
  with the next production deployment.
- **Late review**: Codex opened five threads on the merged head at 2026-10-12T04:51:05Z, after the
  merge. A paged read of the PR's threads now returns 133, five of them unresolved; the 128 above
  was the count at the merge. First read against the code: `Garden.sol` increments
  `gardenMemberCount` only in `joinGarden` and never decrements it; `packages/contracts.mdx` and a
  link on `integrations/gardens.mdx` still say opt-in; the Supply Chain Guardrails workflow has
  formatting, guidance and parity jobs its catalog entry does not name. The thread on the API Index
  needs reframing, not a listing: the files under `packages/agent/src/api/routes/messaging/`
  register 26 routes, and `http.ts` there describes them as a private same-origin API (session
  cookie, exact Origin, CSRF token, private responses); `PublicRouteClass` only names their rate
  limits. None is answered or fixed in this entry; Afo asked for one follow-up PR.
- **Linear mirror**: `linear.stateSyncMode` is now `preserve_existing`. Before it,
  `plan-hub.mjs linear-sync --feature builder-docs-rebuild --json` returned a parent update with
  state `Todo` (it would have been `In Progress` while the lanes said `in_progress`); after it,
  the parent is a read-only `preserve` entry. No manifest was applied.
- **Correction**: the receipts above and the plan said five captures lack a faithful source. The
  plan's own list has seven, and the files agree: `admin-work-queue.png` and `admin-work-detail.png`
  (last changed 2026-03-08), `client-work-intro.png` and `client-work-details.png` (2026-04-18),
  `qa-app-journey-view.jpg` (2026-09-03), `qa-app-priority-view.webp` and
  `qa-app-recorded-issues.webp` (2026-09-01), all under `docs/static/img/screenshots/` and none at
  the capture size of decision 61. The count is corrected in the plan, in the two receipts above
  and in the status history.
- **Open**: the five late threads, for a follow-up PR. **Human gates open**: D12 (the spine tone
  and the Anatomy page), the page-length gate, a Reference landing, the seven captures, the
  commitment and hypercert capability records (last verified 2026-08-15), and the community funder
  guide's "designed to preserve your principal" wording.
