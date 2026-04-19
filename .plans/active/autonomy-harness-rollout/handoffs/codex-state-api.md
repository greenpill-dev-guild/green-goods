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
- Cleared the unrelated formatting drift in `.plans/backlog/harness-hardening-wave-1/status.json` and confirmed `node scripts/ci-local.js --quick` now passes end to end.
- Aligned the default `packages/admin bun run test` script with `packages/admin/AGENTS.md` by excluding legacy `src/__tests__/views/**` and `src/__tests__/components/assessment/StrategyKernelStep.test.tsx` from the default inner-loop gate, and confirmed the admin default test script now exits cleanly.
- Closed the `CookieJarManageModal` Radix dialog warning by adding a localized modal description, then backed it with a focused regression assertion and locale-coverage validation.
- Closed the shared `JobQueueProvider` React `act(...)` warning by suppressing redundant no-op queue stats and offline-banner updates on mount, then verified the focused provider test and shared typecheck pass cleanly.
- Verified the current shared/client full-suite runs do not reproduce the earlier `react-intl` warning claim, then closed the shared `useDraftAutoSave` async `act(...)` warning by awaiting the in-flight save path correctly in the focused test.
- Closed the shared `useActionOperations` React `act(...)` warning by running the async hook operations inside `act(...)` in the focused test, then verified the isolated suite passes cleanly without the warning.
- Closed the shared `useDepositForm` React `act(...)` warning by awaiting the `setValue(..., { shouldValidate: true })` flush in the focused test, then verified the isolated hook suite passes cleanly without the warning.
- Closed the shared `useHypercertDraft` React `act(...)` warning by disabling the unrelated default `autoLoad` side effect in the `draftKey`-only test, then verified the isolated hook suite passes cleanly without the warning.
- Re-baselined the full shared suite, confirmed the earlier shared hook `act(...)` warnings no longer reproduce there, and closed the repeated Lit dev-mode banner by pre-marking Lit's `dev-mode` warning code in the shared test setup before any Lit-backed test imports run.
- Removed the Storacha runtime path from shared/client/agent by switching shared IPFS uploads to Pinata-only, deleting the stale agent media service, dropping the shared/client Vitest Storacha inlining, and updating the client runtime cache / chunk config so focused shared/client validation no longer reproduces Storacha sourcemap noise.
- Removed the contracts-side Storacha upload path by switching `packages/contracts` deploy/repair upload scripts to Pinata-only, removing `@storacha/client` from `packages/contracts/package.json`, and updating the indexer default gateway to the dedicated Pinata gateway.
- Removed the root Storacha repo-script path by converting `scripts/lib/ipfs-hybrid.ts`, `scripts/upload-action-images.ts`, and `scripts/repin-ipfs-media.ts` to Pinata-only flows, then dropping root `@storacha/client` from `package.json`.
- Fixed the remaining script-surface TypeScript objection in `scripts/lib/ipfs-hybrid.ts` by copying upload bytes into a plain `ArrayBuffer` before constructing the `Blob`, so the Bun scripts now pass a targeted `tsc` probe under bundler-style module resolution.
- Aligned `.env.schema` and the generated `env.d.ts` to Pinata-only repo truth without editing the operator-local root `.env`, so the repo-owned env contract no longer advertises Storacha keys.
- Removed the retired `VITE_STORACHA_GATEWAY` fallback from `packages/shared/src/modules/data/ipfs/client.ts` and added focused shared IPFS tests for Vite-prefixed Pinata env plus the retired-alias negative case.
- Fixed the repin wrapper smoke by removing nested `varlock/auto-load` from `scripts/repin-ipfs-media.ts`, then verified `bun run ipfs:repin:audit -- --chain 42161 --include input --input /dev/null --out /tmp/ipfs-repin-audit-codex.json` completes.

## Remaining

1. Cull the remaining historical Storacha references from changelog / reporting surfaces when that bounded docs loop is chosen; keep the negative shared IPFS regression string unless the retired-alias behavior contract changes.
2. Decide whether the excluded legacy admin view-heavy surface needs a dedicated hardening loop or should remain outside the default gate until a dedicated view runner exists.
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
- `bun run test` in `packages/admin` (`31` files / `313` tests, with legacy view-heavy surfaces excluded from the default gate)
- `bun run test -- src/__tests__/components/CookieJarManageModal.test.tsx` in `packages/admin` (`8` tests, without the Radix dialog description warning)
- `bun run test -- src/__tests__/i18n/locale-coverage.test.ts` in `packages/shared` (`9` tests)
- `bun run test -- src/__tests__/providers/JobQueueProvider.test.tsx` in `packages/shared` (`16` tests, without the React `act(...)` warning)
- `bun run typecheck` in `packages/shared` after suppressing no-op queue stats / offline-banner updates in `JobQueueProvider`
- `bun run test -- src/__tests__/hooks/work/useDraftAutoSave.test.ts` in `packages/shared` (`14` tests, without the async `act(...)` warning)
- `bun run test -- src/__tests__/hooks/useActionOperations.test.ts` in `packages/shared` (`9` tests, without the React `act(...)` warning)
- `bun run test -- src/__tests__/hooks/vault/useDepositForm.test.ts` in `packages/shared` (`9` tests, without the React `act(...)` warning)
- `bun run test -- src/__tests__/hooks/hypercerts/useHypercertDraft.test.ts` in `packages/shared` (`26` tests, without the React `act(...)` warning)
- `bun run test` in `packages/shared` (`221` files / `2991` tests, `2` skipped) re-baselined the remaining stderr noise and no longer reproduced the earlier shared hook `act(...)` warnings
- `bun run test -- src/__tests__/components/Primitives.test.tsx src/__tests__/components/MainSheet.test.tsx src/__tests__/hooks/auth/usePrimaryAddress.test.ts` in `packages/shared` (`19` tests, without the Lit dev-mode banner)
- `bun run test -- src/__tests__/modules/ipfs.module.test.ts` in `packages/shared` (`8` tests) after the Pinata-only IPFS cutover and legacy-gateway retirement
- `bun run typecheck` in `packages/shared` after removing the retired `VITE_STORACHA_GATEWAY` fallback from `packages/shared/src/modules/data/ipfs/client.ts`
- `bun run typecheck` in `packages/agent` after deleting `src/services/media.ts`
- `bun install` after removing `@storacha/client` from `packages/shared` and `packages/agent`
- `bunx tsc --noEmit -p packages/contracts/tsconfig.json` after removing the contracts-side Storacha upload path
- `cd packages/contracts && bun script/deploy-repair-event-arbitrum.ts --help`
- `cd packages/indexer && bun run check:indexing-boundary`
- `cd packages/indexer && bun run build`
- `bun install` after removing `@storacha/client` from `packages/contracts`
- `bunx tsc --noEmit --module esnext --moduleResolution bundler --target ES2022 --lib es2022,dom --types node scripts/lib/ipfs-hybrid.ts scripts/upload-action-images.ts scripts/repin-ipfs-media.ts`
- `bun scripts/upload-action-images.ts --dry-run`
- `bun install` after removing root `@storacha/client`
- `bun run ipfs:repin:audit -- --chain 42161 --include input --input /dev/null --out /tmp/ipfs-repin-audit-codex.json`
- `bun x @biomejs/biome format .plans/backlog/harness-hardening-wave-1/status.json`
- `bash scripts/check-test-quality.sh`
- focused repo-truth doc updates in `.plans/README.md`, `.plans/_templates/feature/status.json`, and `docs/docs/builders/agentic/context-engineering.mdx`
- `node scripts/ci-local.js --quick` now passes end to end

## Known Blockers

- `packages/admin` build remains env-gated by `varlock` / 1Password secrets.
- The excluded legacy admin view-heavy surface (`src/__tests__/views/**` plus `src/__tests__/components/assessment/StrategyKernelStep.test.tsx`) still needs a dedicated hardening decision before it can re-enter the default gate.
