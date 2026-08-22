# Client Structure Cleanup + Agent Guide Consolidation - State/API Handoff

## Lane

- Owner: Codex
- Branch: current shared `develop` checkout; no branch was created or switched
- Status: in progress; assessment cluster complete, broader typecheck lane open

## Scope

- Implement shared types, hooks, query keys, state, job queue, and API flows accepted in `plan.todo.md`, `spec.md`, and `eval.md`.
- Keep reusable hooks in `packages/shared/src/hooks`.

## TDD Proof

- Cluster RED: canonical `assessment_v2` fixtures crashed both legacy screens. The detail view
  failed at `assessment.capitals.map`; the list failed at `assessment.capitals.length`.
- Cluster GREEN: both screens render canonical domain, Cynefin phase, reporting period, diagnosis,
  SMART outcomes, SDGs, and IPFS attachments. The two focused files pass 8 tests.
- Lane RED: the existing client and admin build configs still report success while compiling no
  project files.
- Lane GREEN: pending. Step 1.5 is complete, but this does not certify the full Phase 1 build gate.

## Validation

- The selector-prescribed path formatter and oxlint checks pass for all seven changed source, test,
  and locale files.
- Shared typecheck passes. Agent typecheck passes.
- Focused client tests pass: 2 files, 8 tests.
- Shared tests pass: 325 files, 3,741 passed and 1 skipped.
- Admin tests pass: 84 files, 583 tests.
- Agent tests pass: 25 files with 265 passed and 1 skipped, plus the 5-test SQLite lane.
- The app-only client compiler still fails on the known wider baseline. A focused diagnostic reports
  no TypeScript errors for either migrated component.
- Authenticated Brave proof is blocked. Port 3001 is an external process serving
  `.claude/worktrees/client-loop`, not this checkout, and its garden route fails before these
  screens render because `useJobQueue` has no `JobQueueProvider`. The tab was restored to
  `/home`; no isolated-browser result was substituted.

## Validation Receipt

- Tested implementation commit SHA: not commit-attributable; this is a dirty shared `develop`
  checkout
- Run at (UTC): 2026-08-22 00:00–00:05
- Exact command(s):
  - `bun run validation:plan -- --intent qa --risk sensitive ... --json`
  - selector-rendered path-scoped Biome and oxlint commands
  - `node ../../scripts/dev/node-cli.js tsc --noEmit` from `packages/shared`
  - `bun run typecheck` from `packages/agent`
  - `bun run test src/__tests__/components/GardenAssessments.test.tsx src/__tests__/views/Assessment.test.tsx` from `packages/client`
  - `bun run test` from `packages/shared`, `packages/admin`, and `packages/agent`
  - `node ../../scripts/dev/node-cli.js tsc --noEmit -p tsconfig.app.json --pretty false` from `packages/client`
- Result: all selector-prescribed automated checks pass; full client app compiler remains red on
  unrelated baseline errors; authenticated rendered proof is environment-blocked
- Validated paths: the two assessment components, two focused tests, and `en`/`es`/`pt`
  locale files
- Worktree identity command and result: `git status --short`; shared dirty checkout, current branch
  `develop`
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- Neither migrated component contains a legacy assessment-field access, alias, or cast.
- `selectedActionUIDs` are not shown as raw identifiers because these components do not receive
  human-readable action metadata.
- The larger Phase 1 typecheck remains open. Do not mark the lane complete until the config,
  remaining error clusters, and deliberate-failure probe in steps 1.0–1.10 are complete.
- Browser proof must be rerun from a local server rooted in this checkout after the external
  `client-loop` process is replaced or stopped by its owner.
