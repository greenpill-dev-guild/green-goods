# Agent reporting — Builder integration proof handoff

## Lane

- Owner: Opus 5.5 (Claude)
- Branch: record the approved implementation checkout before dispatch
- Status: blocked (see status.json)
- Support owner: Afolabi, [afo@wefa.world](mailto:afo@wefa.world)

## Start gate

Before implementation, run `node scripts/harness/plan-hub.mjs linear-sync --feature agent-messaging-channels --json`, reconcile the existing tracker scope, and record verified canonical identifiers with `record-linear`. Keep `parent_only`; no new lane issues. This documentation update does not dispatch a task. Follow the current package slices in [plan.todo.md](../plan.todo.md#current-build-sequence), not the historical step numbers. No branch switch or creation is implied.

## Scope

Run the current harness and acceptance in technical brief sections 11–12, then the live rehearsal only after its stage gates pass. Cover incomplete story -> eligible Action -> all fixed/domain fields -> correction -> confirmation; existing EOA signing; Kernel reporting and separate review permissions when proven; no self-review; and both prototype gardens' actual roles.

Adversarial proof includes duplicate/reclaimed ingress, HMAC rotation/racing insert, no-hash terminal failure/reload, uncertain sends, forged outcome hints, atomic outcome/outbox writes, asynchronous provider failure, consent withdrawal at the Shared dispatch boundary, publication pause after preparation/queueing, private-file cleanup and relinking. Use synthetic Telegram-shaped input without requiring a live Telegram adapter.

Before tester intake, rehearse help/deletion/incident contact with Afolabi (afo@wefa.world) and verify privacy/provider/retention gates. Deployed edge/header proof and authenticated Brave wallet/passkey proof are separate from harness fixtures. Record every capability omitted from the demo. Submit each completed checkpoint and final integration evidence to Astra.

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
