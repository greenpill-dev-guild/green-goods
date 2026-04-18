# Codex State / API Handoff

## Status

In progress.

## Completed

- Fixed `scripts/plan-hub.mjs` validator and backfilled minimum handoff data.
- Reconciled docs and CI truth for current agent / eval surfaces.
- Governed the GreenWill skipped-test surfaces and restored the shared GreenWill contract surface.
- Cleared the known failing baseline tests in shared, admin, and client.
- Completed the safe Loop A deletions for dead barrels and dead leaf helpers.
- Restored `packages/admin/src/views/Actions/GreenWillPanel.tsx` after determining it was dormant legacy UI, not pure dead infrastructure.
- Refreshed the cleanup / mutation-bug baseline in `reports/2026-04-18-baseline-refresh.md`.
- Recorded that some dead-code audit claims are now stale, especially the orphan-view deletion list and the `components/Layout/index.ts` barrel claim.
- Codified the inner-loop testing policy in repo truth: targeted `bun run test -- <file>` or `bun run test` is the fast iterative gate; coverage remains scheduled or pre-merge evidence.
- Codified the memory policy in repo truth: `.plans/` is authoritative and any `.claude/agent-memory` pilot remains environment-local until freshness, expiry, and ownership rules exist.
- Fixed the `CreateListingDialog.tsx` silent-failure path by adding a local actionable error fallback when `createListing()` rejects before hook-owned error state is visible.
- Added a focused regression test for the rejected-listing flow and retry path in `packages/admin/src/__tests__/components/hypercerts/CreateListingDialog.test.tsx`.
- Fixed the `Work.tsx` silent-failure path by propagating `mutateAsync` rejection after provider-level debug logging, so callers can observe submission failure instead of receiving a false success path.
- Added a focused provider regression test for the rejected-work-submission path in `packages/shared/src/__tests__/providers/WorkProvider.test.tsx`.
- Fixed the `JobQueue.tsx` auto-flush silent-failure path by surfacing rejected `jobQueue.flush()` calls through `lastEvent`, `queueToasts.syncError()`, `setIsProcessing(false)`, and a stats refresh instead of silently swallowing the error.
- Added a focused provider regression test for the rejected auto-flush path in `packages/shared/src/__tests__/providers/JobQueueProvider.test.tsx`.
- Removed the deprecated `packages/shared/src/utils/query-invalidation.ts` shim, rewired the remaining shared invalidation type re-export to `config/query-keys/schedule`, and updated `packages/shared/src/MODULES.md` so the cleanup surface matches the live module layout.
- Closed the client full-suite harness blocker by aliasing `@ethereum-attestation-service/eas-sdk` to the shared test mock in `packages/client/vitest.config.ts`.
- Replaced the mock-heavy `packages/client/src/__tests__/components/Cards.test.tsx` omnibus with behavior-based `ActionCard`, `GardenCard`, and `WorkCard` tests, and confirmed `packages/client bun run test` now exits cleanly.
- Aligned `node scripts/ci-local.js --quick` with `packages/admin`'s existing `test:hub` surface so repo-quick now clears shared, client, admin, and agent tests instead of stalling in the legacy admin full suite.

## Remaining

1. Tighten the legacy `packages/admin` full-suite `bun run test` hang; isolated repro runs still stop making progress after visible suite output, and the child Vitest node sits idle in `uv__io_poll` with open `KQUEUE` handles.
2. Decide whether the next smallest loop is the unrelated repo-quick format drift in `.plans/backlog/harness-hardening-wave-1/status.json` or validation warning hygiene (`react-intl`, Radix dialog description, Lit dev-mode noise, React `act(...)` noise).
3. Continue cleanup only on bounded dead-infrastructure surfaces.
4. Keep full-view parity review as a deletion precondition for dormant admin surfaces.

## Validation Run

- `node scripts/plan-hub.mjs validate`
- `bash scripts/check-test-quality.sh`
- targeted `bun run test -- <file>` on touched shared / admin / client surfaces
- `bunx tsc --noEmit -p packages/admin/tsconfig.json`
- `bun run test -- src/__tests__/components/hypercerts/CreateListingDialog.test.tsx`
- `bun run test -- src/__tests__/providers/WorkProvider.test.tsx`
- `bun run test -- src/__tests__/providers/JobQueueProvider.test.tsx`
- `bun run typecheck` in `packages/shared`
- `bun run typecheck` in `packages/shared` after removing `utils/query-invalidation.ts`
- `bun run test -- src/__tests__/components/ActionCard.test.tsx src/__tests__/components/GardenCard.test.tsx src/__tests__/components/WorkCard.test.tsx` in `packages/client`
- `bun run test` in `packages/client` (`45` files / `293` tests)
- `bun run test:hub` in `packages/admin` (`8` files / `54` tests)
- `bash scripts/check-test-quality.sh`
- focused repo-truth doc updates in `.plans/README.md`, `.plans/_templates/feature/status.json`, and `docs/docs/builders/agentic/context-engineering.mdx`
- `node scripts/ci-local.js --quick` now clears shared tests, client tests, admin hub tests, and agent tests; the remaining failure is the format check on `.plans/backlog/harness-hardening-wave-1/status.json`
- `bun run test` in `packages/admin` reproduced the same hang after visible suite progress
- sampled admin Vitest child process showed the node main thread idle in `uv__io_poll` with open `KQUEUE` handles

## Known Blockers

- Repo-quick currently fails at format-check time because `.plans/backlog/harness-hardening-wave-1/status.json` is not Biome-formatted on the current branch tip.
- `packages/admin` build remains env-gated by `varlock` / 1Password secrets.
- `packages/admin` full-suite `bun run test` currently hangs after visible suite progress, but repo-quick no longer depends on that surface.
- Shared provider tests still emit pre-existing React `act(...)` warnings during targeted runs and need a separate hygiene loop before they can count as clean-output evidence.
