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
