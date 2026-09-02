# Lane Handoff — mechanics (Phase 1: generators & site mechanics)

**Owner**: claude · **Branch**: `feature/builder-docs-rebuild` · **Status**: in_progress
**Scope**: plan.todo.md Steps 1.1–1.6. No prose rewrites in this lane — mechanism only.

## Boundaries

- Change generators (`scripts/docs/*`), docs site config/CSS/components (`docs/`), and regenerated
  outputs. Do not rewrite hand-written page prose (Phases 2–4 own voice).
- Seven integration pages convert from generated MDX to hand-owned MDX embedding the projection
  component — keep their existing intro sentences verbatim in this lane.
- Every generator change lands with test coverage in `scripts/docs/generate.test.mjs` and honest
  digests via `bun run docs:generate` + `bun run check:docs-generated`.

## TDD proof

_To be recorded: red command/evidence (failing test for new renderer behavior), green
command/evidence after implementation._

## Validation Receipt

_Pending — filled with tested commit SHA, UTC timestamp, exact commands, and summarized output
before this lane is marked passed._
