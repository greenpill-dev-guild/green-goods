# Agent reporting — State/API handoff

## Lane

- Owner: Opus 5.5 (Claude)
- Branch: record the approved implementation checkout before dispatch
- Status: blocked (see status.json)
- Support owner: Afolabi, [afo@wefa.world](mailto:afo@wefa.world)

## Start gate

Before implementation, run `node scripts/harness/plan-hub.mjs linear-sync --feature agent-messaging-channels --json`, reconcile the existing tracker scope, and record verified canonical identifiers with `record-linear`. Keep `parent_only`; no new lane issues. This documentation update does not dispatch a task. Follow the current package slices in [plan.todo.md](../plan.todo.md#current-build-sequence), not the historical step numbers. No branch switch or creation is implied.

## Scope

Own the minimum Shared pure reporting contract and explicit exports, Agent coordinator, SQLite stores/migrations and reproducible API harness first. Complete story-first Action inference/clarification, fixed submission fields including confirmed time, provenance and revisions; never require browser editing. Agent consumes only declared server-safe Shared exports.

Then own root `.env.schema`/Agent config validation, bounded durable Meta inbox, fenced conversation processing and atomic reply intents; OpenAI/Jev and isolated media conversion; stable channel-subject IDs and versioned HMAC aliases; processing/publication consent; operation reservations and durable terminal outcomes; grant/executor policy; receipt reconciliation; correlated provider delivery statuses; cleanup, relinking and dispatch controls.

The UI slice supplies the scoped browser outcome/checkpoint producer; both lanes share the typed command contract. No browser Dexie default instance enters the Agent. Publication controls are enforced at actual send boundaries; outcome and status reconciliation keep running during pauses.

Persist the confirmed Action definition bytes/source/block/digest on the revision and bind them into confirmation/preparation. Later instruction updates do not reinterpret a pending report; explicit adoption creates a new confirmed revision. Prove updates between reservation and inclusion for both authorization branches while retaining live resolver eligibility checks. Kernel enablement depends on the UI/Shared independent owner-revocation proof in technical brief section 9.3; reconcile externally revoked permissions from chain on restart without requiring a surviving Agent callback.

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
