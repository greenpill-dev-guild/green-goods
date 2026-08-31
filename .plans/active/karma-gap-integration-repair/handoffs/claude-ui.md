# Karma GAP Integration Repair - UI Handoff

## Lane

- Owner: Claude
- Branch: set when work begins using `<type>/<work-description>`
- Status: implementation checkpoint validated; browser proof blocked

## Scope

- Implement the UI behavior accepted in `plan.todo.md`, `spec.md`, and `eval.md`.
- Keep hooks, query keys, and shared state in `@green-goods/shared`.

## TDD Proof

- RED: route/component tests were added for the status panel before the final implementation
- GREEN: selected admin tests pass 24/24; the production admin build, required Storybook coverage,
  story-quality checks, and full `agentic:check` pass
- Proof limit: authenticated Brave was unavailable, and results are not a clean commit-attributed receipt

## Validation

- `/garden` now shows the Karma health panel with all eight states, a canonical profile link,
  permission-aware retry, migration-needed guidance, loading/error handling, and en/es/pt copy.
- A fixture-driven Storybook state catalog covers the panel without wallet or indexer dependencies.

## Validation Receipt

- Tested implementation commit SHA: not pinned; dirty working-tree checkpoint
- Run at (UTC): 2026-08-26T06:59:00Z
- Exact command(s): selected admin Vitest files; `bun run --cwd packages/admin build`; `bun run --filter @green-goods/shared check:stories`; `bun run --filter @green-goods/shared check:story-quality`; `bun run agentic:check`
- Result: admin 24/24; production build and all agentic/Storybook gates pass
- Validated paths: admin Garden route/panel/tests/stories and shared en/es/pt messages
- Worktree identity command and result: intentionally dirty implementation paths; terminal receipt not claimed
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- Authenticated Brave could not be reached because the ChatGPT browser extension connection was
  unavailable. Per repo policy, no isolated browser substituted for this proof.
- The migration-needed state intentionally has no upgrade button because legacy accounts cannot
  execute UUPS.
