# Agent reporting — Client ceremony handoff

## Lane

- Owner: Opus 5.5 (Claude)
- Branch: record the approved implementation checkout before dispatch
- Status: blocked (see status.json)
- Support owner: Afolabi, [afo@wefa.world](mailto:afo@wefa.world)

## Start gate

Before implementation, run `node scripts/harness/plan-hub.mjs linear-sync --feature agent-messaging-channels --json`, reconcile the existing tracker scope, and record verified canonical identifiers with `record-linear`. Keep `parent_only`; no new lane issues. This documentation update does not dispatch a task. Follow the current package slices in [plan.todo.md](../plan.todo.md#current-build-sequence), not the historical step numbers. No branch switch or creation is implied.

## Scope

Own platform-neutral `/agent/reporting/:requestId` and `/agent/reporting/recover/:requestId` with PWA design components and no installation prerequisite. Proposed Shared hooks are `useAgentReportingCeremony` and `useAgentReportingRecovery`, backed by `modules/agent-reporting/` transport/machines and declared exports. Keep hooks in Shared. The client owns route/presentation/provider composition and views; there is no ordinary composer hydration or mandatory first-run account creation.

Integrate existing EOA/Kernel authentication, the read-only confirmed report, separate Kernel permission approval, exact prepared-envelope signing and minimal durable attempt/outcome checkpoints. Resume failure callbacks after reload and scoped reauthentication. Account/session/revision changes invalidate access; unknown sends remain reserved. A fresh publication permit is required before the owner sender is invoked.

Own `packages/client/vercel.json` proxy/headers with Agent response middleware and serving-edge log settings. Prove deployed headers, cookie forwarding/clearing, Origin/CSRF, canary log redaction and existing-passkey origin/build configuration. Include browser refresh/handoff, private-cache exclusion and en/es/pt copy. Help exposes Afolabi at afo@wefa.world.

## TDD Proof

- RED: pending; choose concrete owning test paths with the first implementation slice.
- GREEN: pending; run the same behavior proof after implementation.
- Proof limit: no runtime proof recorded.

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

Tracker/start-gate reconciliation must complete before implementation. Live stages retain provider, processing, privacy, custody and deployed-browser/chain gates; they do not block synthetic fixtures.
