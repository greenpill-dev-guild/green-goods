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

- RED: `bun run --filter @green-goods/shared test --
  src/__tests__/modules/job-queue.seam.test.ts
  src/__tests__/modules/job-queue.imports.test.ts
  src/__tests__/providers/JobQueueProvider.test.tsx` on the parent implementation failed all 3
  files with 3 failed and 17 passed tests. The Node seam reached the concrete browser graph instead
  of a constructable queue, event-bus and media imports each registered `beforeunload`, and the
  provider ignored the injected queue handle.
- GREEN: the final focused queue/provider/wiring command passed 11/11 files and 75/75 tests. Its
  direct acceptance rows were 17/17 for the Node seam, 3/3 for import lifecycle, and 18/18 for the
  provider without a whole-module job-queue mock.
- Proof limit: the selector-required Shared suite first timed out the default-lifecycle dynamic
  import while Shared, Client, and Admin ran concurrently under host contention. That failure was
  not reused. After the competing suites ended, the unchanged implementation commit passed the
  standalone Shared suite with 3,981 tests passed and 6 skipped. This receipt proves the selected
  standalone package gates, not cross-package concurrent timing robustness.

## Validation Receipt

- Tested implementation commit SHA: `a83be79670abc877ec4d8083d9a12e2fa5f715b1`
- Run at (UTC): 2026-08-23T10:01:23Z
- Toolchain/dependencies: validation used the checked-in toolchain through disposable `node_modules`
  symlinks into the primary checkout. No dependency was installed or changed. Every symlink was
  removed before the clean-tree evidence below.
- Exact command(s), risk, signal, freshness, stopping rule, and result:
  - `bun run validation:plan -- --intent qa --changed
    packages/shared/src/modules/job-queue/index.ts --changed
    packages/shared/src/modules/job-queue/queue.ts --changed
    packages/shared/src/providers/JobQueue.tsx` — risk: omitting a critical consumer gate; expected
    signal: a ready critical plan; freshness: rendered from the exact committed paths and current
    policy; stop: do not substitute a lighter plan. Result: ready; selected format, lint, Shared
    full typecheck/test, Client/Admin tests, Agent typecheck/test, and ontology.
  - `bun format` and `bun lint` — risk: unformatted source, static-boundary drift, or Solidity/tooling
    lint regression; expected signal: no format mutation and zero blocking lint errors; freshness:
    exact implementation SHA and current toolchain; stop: any mutation or error blocks the receipt.
    Result: format applied no fixes; lint passed with 0 errors and the existing 260 Solhint warnings.
  - `bun run --filter @green-goods/shared typecheck:full` and `bun run --filter
    @green-goods/agent typecheck` — risk: exported queue-handle or downstream type break; expected
    signal: source/test and Agent typechecks exit zero; freshness: exact SHA and linked checked-in
    dependencies; stop: any type error blocks consumer proof. Result: both passed.
  - `bun run --filter @green-goods/shared test --
    src/__tests__/modules/job-queue.seam.test.ts
    src/__tests__/modules/job-queue.imports.test.ts
    src/__tests__/modules/job-queue.core.test.ts
    src/__tests__/modules/job-queue.analytics.test.ts
    src/__tests__/modules/job-queue.commitment-policy.test.ts
    src/__tests__/modules/job-queue.db.test.ts
    src/__tests__/modules/job-queue.event-bus.test.ts
    src/__tests__/modules/job-queue.telemetry-privacy.test.ts
    src/__tests__/modules/media-resource-manager.test.ts
    src/__tests__/modules/work-submission.test.ts
    src/__tests__/providers/JobQueueProvider.test.tsx` — risk: queue policy/event/provider wiring
    regression; expected signal: all focused files pass; freshness: exact SHA and current Vitest
    entrypoint; stop: any deterministic behavior failure blocks the lane. Result: 11/11 files and
    75/75 tests passed.
  - `bun run --filter @green-goods/shared coverage --
    src/__tests__/modules/job-queue.seam.test.ts
    --coverage.include=src/modules/job-queue/queue.ts
    --coverage.include=src/modules/job-queue/process-job.ts --coverage.reporter=text
    --coverage.reporter=json-summary` — risk: an untested constructable core; expected signal: each
    file exceeds 90% lines and 80% branches from the Node seam alone; freshness: exact SHA and named
    include files; stop: either floor blocks the lane. Result: `queue.ts` 93.24% lines/80.55%
    branches and `process-job.ts` 98.5% lines/86.53% branches; 17/17 tests passed.
  - `bun run --filter @green-goods/shared test -- --reporter=json
    --outputFile=/private/tmp/gg-jobqueue-shared-a83be796.json`, `bun run --filter
    @green-goods/client test -- --reporter=dot`, `bun run --filter @green-goods/admin test --
    --reporter=json --outputFile=/private/tmp/gg-jobqueue-admin-a83be796.json`, and `bun run
    --filter @green-goods/agent test -- --reporter=dot` — risk: consumer regression across the
    critical Shared API; expected signal: every selected package suite exits zero; freshness: exact
    SHA with the same checked-in dependency graph; stop: a deterministic package failure blocks the
    lane, while independent suites may finish. Result: Shared 344 files/3,981 passed/6 skipped,
    Client 93 files/865 passed, Admin 94 files/659 passed, and Agent 24 files/265 passed with 1
    skipped. The non-reused contended Shared timeout is disclosed in the proof limit above.
  - `bun run check:ontology` and `SOURCE_STRUCTURE_BASE_REF=origin/develop bun run
    check:source-structure` — risk: ontology drift or replacing one oversized module with another;
    expected signal: all ontology guards and changed-source ceilings pass; freshness: exact SHA,
    current sidecar, and current `origin/develop`; stop: either guard blocks passed status. Result:
    ontology passed 50/50 tests plus every guard; source structure checked 16 changed non-test files
    with no violation and the obsolete queue-index ceiling removed.
  - `grep -rn beforeunload packages/shared/src/modules/job-queue` — risk: duplicate import-time
    lifecycle listeners; expected signal: only lifecycle wiring; freshness: exact committed module
    tree; stop: any other hit blocks the lane. Result: only `lifecycle.ts` lines 11 and 13.
- Singleton/consumer proof: `packages/shared/src/modules/job-queue/index.ts` constructs exactly
  `createJobQueue(createDefaultJobQueueDependencies())`; the focused core test proves default
  dependencies use the exported `jobQueueEventBus`. Shared full typecheck plus the complete Shared
  and Client suites compile and execute all 11 pre-existing static singleton import consumers, the
  newly switched commitment queue reader, and the existing dynamic utility import.
- Preserved finding: job addition still posts `REGISTER_SYNC` through
  `default-dependencies.ts`, while `modules/work/work-submission.ts` separately calls
  `serviceWorkerManager.requestBackgroundSync()`. The duplicate request is pre-existing behavior and
  was intentionally not changed in this lane.
- Validated paths: `packages/shared/src/modules/job-queue/**`,
  `packages/shared/src/modules/commitment-pooling/queue-admission.ts`,
  `packages/shared/src/providers/JobQueue.tsx`,
  `packages/shared/src/hooks/commitment-pooling/useCommitmentQueueState.ts`, the named JobQueue test
  and test-utility files, and `scripts/quality/check-source-structure.js`.
- Worktree identity/clean command: `git branch --show-current && git rev-parse HEAD && git status
  --short -- packages/shared/src/modules/job-queue
  packages/shared/src/modules/commitment-pooling/queue-admission.ts
  packages/shared/src/providers/JobQueue.tsx
  packages/shared/src/hooks/commitment-pooling/useCommitmentQueueState.ts
  packages/shared/src/__tests__/modules/job-queue.core.test.ts
  packages/shared/src/__tests__/modules/job-queue.imports.test.ts
  packages/shared/src/__tests__/modules/job-queue.seam.test.ts
  packages/shared/src/__tests__/modules/job-queue.telemetry-privacy.test.ts
  packages/shared/src/__tests__/providers/JobQueueProvider.test.tsx
  packages/shared/src/__tests__/test-utils/index.ts
  packages/shared/src/__tests__/test-utils/job-queue-fakes.ts
  scripts/quality/check-source-structure.js` — branch
  `refactor/job-queue-dependencies`, SHA `a83be79670abc877ec4d8083d9a12e2fa5f715b1`, empty
  path-scoped status. Full `git status --short` was also empty after disposable symlink removal.
- Evidence-only diff command and result (if applicable): after the evidence commit, `git diff
  --exit-code a83be79670abc877ec4d8083d9a12e2fa5f715b1..HEAD --
  packages/shared/src scripts/quality/check-source-structure.js` must be empty.
- Evidence-only worktree-status command and result (if applicable): after the evidence commit, `git
  status --short` must be empty.
