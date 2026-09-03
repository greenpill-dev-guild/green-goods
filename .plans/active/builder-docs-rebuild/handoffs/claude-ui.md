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
