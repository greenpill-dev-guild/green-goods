# Karma GAP Integration Repair - State/API Handoff

## Lane

- Owner: Codex
- Branch: set when work begins using `<type>/<work-description>`
- Status: implementation checkpoint validated

## Scope

- Implement shared types, hooks, query keys, state, job queue, and API flows accepted in `plan.todo.md`, `spec.md`, and `eval.md`.
- Keep reusable hooks in `packages/shared/src/hooks`.

## TDD Proof

- RED: direct status, hook, projection, and replay tests were added before their implementation
- GREEN: shared selected tests pass 14/14; indexer suite passes 317 with one intentionally pending
  local contract-event integration, and boundary TAP passes 6/6
- Proof limit: results are working-tree evidence, not a clean commit-attributed terminal receipt

## Validation

- The indexer now registers the Karma module emitter and derives replay-safe, chain-aware status
  without consuming the EAS stream. Shared exposes typed status, canonical profile URLs, query
  invalidation, and role-aware reconciliation.
- The initially planned UUPS mutation was removed because it cannot succeed for existing accounts.

## Validation Receipt

- Tested implementation commit SHA: not pinned; dirty working-tree checkpoint
- Run at (UTC): 2026-08-26T06:59:00Z
- Exact command(s): selected shared Vitest files through `bun run --cwd packages/shared test`; indexer codegen, `bun run --cwd packages/indexer test`, boundary test, and TypeScript build
- Result: shared 14/14; indexer 317 passing, 1 intentional pending; boundary 6/6; builds and type checks pass
- Validated paths: `packages/indexer`, shared Karma types/data/hooks/query keys/exports
- Worktree identity command and result: intentionally dirty implementation paths; terminal receipt not claimed
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- Terminal receipt awaits a pinned clean commit. The production legacy-account migration blocker is
  documented in `../release-runbook.md`.
