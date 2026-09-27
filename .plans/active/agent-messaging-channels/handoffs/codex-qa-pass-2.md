# Agent reporting — Independent review handoff

## Lane

- Owner: Astra (Codex)
- Branch: record the approved implementation checkout before dispatch
- Status: blocked (see status.json)
- Support owner: Afolabi, [afo@wefa.world](mailto:afo@wefa.world)

## Start gate

Before implementation, run `node scripts/harness/plan-hub.mjs linear-sync --feature agent-messaging-channels --json`, reconcile the existing tracker scope, and record verified canonical identifiers with `record-linear`. Keep `parent_only`; no new lane issues. This documentation update does not dispatch a task. Follow the current package slices in [plan.todo.md](../plan.todo.md#current-build-sequence), not the historical step numbers. No branch switch or creation is implied.

## Scope

Independently review Opus 5.5's implementation and proof at each completed checkpoint, then the integrated demo. This review is in prototype scope, including auth, data boundaries, cross-garden denial, identity rotation, crash/retry behavior, exact payload binding, failure callbacks, incident controls and conditional Kernel delegation. Do not infer live compatibility from synthetic fixtures or an EOA-only demo.

Use technical brief sections 11–12, current plan slices and eval.md as the acceptance contract. Verify schema/exports/deployment scopes match actual code; inspect the ERD XOR invariant and migration tests. Confirm support and privacy prerequisites before live intake. Record current-head evidence and any unmet gate before a readiness verdict; do not mark a lane complete from documentation alone.

## Validation

Render `bun run check --plan -- --intent qa` before checks. Run actual focused tests through the owning package wrapper; record exact commands here and in status.json. Retain required critical checks for Shared auth, Work and JobQueue. Existing wrappers include `bun run --cwd packages/agent test -- <test-file>` and `bun run --cwd packages/shared test -- <test-file>`; placeholders are not executable evidence. No obsolete intake-hook command is authoritative.

## Validation Receipt

- Tested implementation commit SHA: pending
- Run at (UTC): pending
- Exact command(s): pending
- Result: pending
- Validated paths: pending
- Worktree identity command and result: pending
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

Waiting for the relevant implementation checkpoint and its recorded evidence. Live support/provider/privacy/deployment gates must pass before live rehearsal.
