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

- **Red** (2026-09-02, pre-implementation): `node --test scripts/docs/generate.test.mjs` fails at
  load — `renderSkills` unexported, skills and integration-data projections absent; 1 file-level
  failure covering the 4 new behavior tests.
- **Green**: same command at `ade03f693` — 19 tests, 19 pass, 0 fail (Node 22.22.1). Recorded in
  `status.json` via `record-tdd`.

## Validation Receipt — Phase 1 (mechanics)

- **Tested implementation commit SHA**: `ade03f69342ac2a8842057c1b56234ad2e80388d`
- **Run at (UTC)**: `2026-09-02T17:27:52Z`
- **Commands and results**:
  - `node --test scripts/docs/generate.test.mjs` → 19 tests, 19 pass, 0 fail
  - `bun run docs:audit:ci` → "docs-audit: no errors or warnings."
  - `bun run check:docs-generated` → "Checked documentation projections (13)." (idempotent)
  - `bun run test:docs` → 45 pass, 0 fail (4 files)
  - `bun run build:docs` → SUCCESS; search index covers 71 live source routes
- **Validated paths**: `scripts/docs/**`, `docs/**` (content, components, client modules, config),
  `biome.json`, `.claude/launch.json`
- **Worktree identity**: `git status --porcelain=v1 --untracked-files=all -- scripts/docs docs` →
  empty
- **Known limit**: svg-pan-zoom attaches on first visibility via IntersectionObserver; the embedded
  verification pane reports `document.visibilityState === "hidden"` permanently, so the attach step
  is queued-but-unfired there (states verified as `queued` on all three ERD diagrams). Confirm the
  zoom controls once in a visible browser (Vercel preview or local `bun run --cwd docs serve`).
  Discovery, sizing, accent, conditional sections, and all build gates are machine-verified above.
- **Pre-existing, out of scope**: `cd docs && bun run typecheck` fails on two recharts formatter
  types in `RevenueProjectionChart.tsx` (present on develop since the TS7 upgrade, #639); zero
  errors reference Phase 1 files.
