# Wave 1 A: Constructable Job Queue

## Goal

Make the job queue constructable from explicit ports while preserving the production singleton and
every existing consumer contract. Split processing, default wiring, executor resolution, lifecycle,
maintenance, and recovery responsibilities so the queue seam is directly testable without module
mocks. Do not start until `w0_receipt_debt_burndown` is terminal and passed.

## Read first

- `AGENTS.md` and `packages/shared/AGENTS.md`
- `.claude/context/values.md`, `.claude/context/testing.md`, and `.claude/context/shared.md`
- `.plans/active/module-seams-and-velocity/{spec.md,status.json}`
- Existing `packages/shared/src/modules/job-queue/**`, `providers/JobQueue.tsx`, and their tests
- `packages/shared/src/modules/commitment-pooling/job-types.ts:172-196`

## Start gate

Run `node scripts/harness/plan-hub.mjs linear-sync --feature module-seams-and-velocity --json`.
Respect the recorded `parent_only` mode and do not create lane issues. Confirm this lane's W0-H
dependency is passed before editing; otherwise stop with the dependency evidence.

## Allowed paths

- `packages/shared/src/modules/job-queue/**`
- `packages/shared/src/modules/commitment-pooling/queue-admission.ts`
- `packages/shared/src/providers/JobQueue.tsx`
- `packages/shared/src/hooks/commitment-pooling/useCommitmentQueueState.ts`
- `packages/shared/src/__tests__/modules/job-queue*.test.ts`
- `packages/shared/src/__tests__/providers/JobQueueProvider.test.tsx`
- `packages/shared/src/__tests__/test-utils/{index.ts,job-queue-fakes.ts}`
- `scripts/quality/check-source-structure.js`
- This handoff's TDD and Validation Receipt sections

## Required outcome

- Export `createJobQueue(deps)` and preserve `export const jobQueue =
  createJobQueue(createDefaultJobQueueDependencies())` with all eleven existing imports compiling.
- Introduce the consumer-driven ports and execution union specified in the program: store, events,
  executor registry, admission, analytics, quota, scheduler, connectivity, background sync, clock,
  and config. Only default wiring imports concrete production dependencies.
- Split queue orchestration, job processing, executor registry, default dependencies, and lifecycle
  into coherent files within the source-size limits. Replace the process-job kind chain with the
  registry and all queue `Date.now()` calls with the injected clock.
- Move commitment admission policy out of the queue index. Make maintenance and recovery consume
  only their required store/events/telemetry picks.
- Attach `beforeunload` once through lifecycle wiring; importing event bus or media management must
  not attach a listener. Preserve the exact default event-bus instance used by service worker and
  offline consumers.
- Give `JobQueueProvider` an optional `queue?: JobQueueHandle`, migrate its tests to a fake queue,
  and remove the provider's whole-module job-queue mock. Switch commitment queue reads to the queue
  seam. Remove the three dead cleanup scheduler exports with no production callers.
- Add the named in-memory store, clock, connectivity, analytics, scheduler, registry, background
  sync, queue-handle, and dependency factories under shared testing.
- Preserve all existing error strings and status/event semantics byte-for-byte, including retry,
  identity-conflict, unavailable, flush mutex, retry, discard, and `queue:sync-completed` behavior.
- Lower or remove the frozen source-structure entry only after the oversized queue index is gone.

## Do not

- Change consumer APIs beyond the optional provider injection and documented queue handle.
- Change auth, work-provider, client/admin source, workflows, dependencies, environment files, or
  deployment/runtime configuration.
- Add speculative abstractions, change retry policy, swallow failures, duplicate the singleton, or
  move hooks outside shared.
- Stage, publish, merge, broadcast, or modify another lane's files.

## Gates

- RED first: add the node `createJobQueue` seam test, import-time listener test, and injected-provider
  test; record the parent-commit failures before implementation.
- `bun run validation:plan -- --intent qa --changed packages/shared/src/modules/job-queue/index.ts
  --changed packages/shared/src/modules/job-queue/queue.ts --changed
  packages/shared/src/providers/JobQueue.tsx`
- Focused job-queue seam, provider, event-bus, and wiring tests through `bun run --filter
  @green-goods/shared test -- <files>`.
- `bun run --filter @green-goods/shared typecheck:full`
- Execute every selector-mandated Shared, Client, Admin, and Agent suite for this critical surface.
- Coverage proof for `queue.ts` and `process-job.ts`: at least 90% lines and 80% branches from the
  node seam test alone.
- `grep -rn beforeunload packages/shared/src/modules/job-queue` returns only `lifecycle.ts`.
- `SOURCE_STRUCTURE_BASE_REF=origin/develop bun run check:source-structure`.
- Record TDD proof with `node scripts/harness/plan-hub.mjs record-tdd` and fill a clean committed
  Validation Receipt before any passed claim.

## Report back

Return the tested SHA, changed paths, RED/GREEN commands and counts, coverage for both extracted
files, singleton/listener/search proofs, selector results, exact clean path-scoped status command,
and any preserved duplicate background-sync request as a finding. Stop on any consumer break,
ambiguous queue policy, or unavailable mandatory gate.

## TDD Proof

- RED: pending
- GREEN: pending
- Proof limit: none

## Validation Receipt

- Tested implementation commit SHA: pending
- Run at (UTC): pending
- Exact command(s): pending
- Result: pending
- Validated paths: pending
- Worktree identity command and result: pending
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable
