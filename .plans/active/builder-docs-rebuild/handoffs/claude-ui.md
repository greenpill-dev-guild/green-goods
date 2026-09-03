# Lane Handoff — ui (docs-site surface)

**Owner**: claude · **Branch**: `feature/builder-docs-rebuild` · **Status**: in_progress
**Scope**: docs-site mechanics in Phase 1 (mermaid pan-zoom, sidebar accent fallback, redirects
plumbing, integration pages embedding the projection component), then the page rewrites of
Phases 2-5 per plan.todo.md. Prose follows the spec.md tone contract; every phase passes the
docs gates in eval.md.

## Validation Receipt

_Pending — filled per phase before terminal claims._

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
