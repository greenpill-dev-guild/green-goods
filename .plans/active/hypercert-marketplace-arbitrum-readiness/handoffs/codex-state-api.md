# State/API Lane Handoff

**Actual branch**: `main` per operator instruction to stay on main.
**Planned branch**: `codex/state-api/hypercert-marketplace-arbitrum-readiness`
**Status**: completed.
**Date**: 2026-05-10

## Scope Completed

- Added deployment-artifact marketplace readiness state in shared:
  - `MARKETPLACE_READINESS_REQUIRED_FIELDS`
  - `deriveMarketplaceReadiness`
  - `getMarketplaceReadiness`
  - `formatMarketplaceReadinessError`
  - `assertMarketplaceReady`
- Required fields are `marketplaceAdapter`, `hypercertsModule`, `hypercertExchange`, `hypercertMinter`, `transferManager`, and `strategyHypercertFractionOffer`.
- Missing, invalid, or zero required fields now produce `status: "unavailable"` / `available: false`; `assertMarketplaceReady` throws before reads, approvals, signing, or writes.
- Approval checks and transaction builders now use the readiness guard before touching `TransferManager` or `HypercertMinter`.
- Listing helpers now use artifact-backed exchange/minter addresses for nonces, EIP-712 domain, order collection, and validation.
- `useCreateListing`, `useBatchListForYield`, and `useCancelListing` now gate on readiness before building orders, encoding calldata, signing, or sending transactions.
- Marketplace invalidation coverage was preserved for approvals/root invalidation, listing order invalidation, and trade-history invalidation.
- No admin/client UI lane work was started.

## Files Touched

- `packages/shared/src/types/contracts.ts`
- `packages/shared/src/utils/blockchain/contracts.ts`
- `packages/shared/src/modules/marketplace/approvals.ts`
- `packages/shared/src/modules/marketplace/client.ts`
- `packages/shared/src/modules/marketplace/signing.ts`
- `packages/shared/src/hooks/hypercerts/useCreateListing.ts`
- `packages/shared/src/hooks/hypercerts/useBatchListForYield.ts`
- `packages/shared/src/hooks/hypercerts/useCancelListing.ts`
- shared barrels: `packages/shared/src/index.ts`, `packages/shared/src/types/index.ts`, `packages/shared/src/utils/index.ts`
- tests under `packages/shared/src/__tests__/utils/`, `modules/marketplace/`, and `hooks/`

## TDD Proof

### RED

Command:

```bash
cd packages/shared
bun run test -- src/__tests__/utils/marketplace-readiness.test.ts src/__tests__/modules/marketplace/approvals.test.ts src/__tests__/modules/marketplace/signing.test.ts src/__tests__/hooks/hypercerts/useCreateListing.test.ts src/__tests__/hooks/hypercerts/useBatchListForYield.test.ts src/__tests__/hooks/query-keys.test.ts
```

Result before implementation: failed as expected. Failures proved:

- readiness helper exports did not exist
- approval reads/builders still proceeded with incomplete zero-address config
- signing still used SDK addresses instead of deployment-artifact readiness
- listing hooks did not gate before signing or writing

Follow-up RED from the production-readiness review:

```bash
cd packages/shared
bun run test -- src/__tests__/hooks/hypercerts/useCancelListing.test.ts
```

Result before the cancel-listing fix: failed as expected because `useCancelListing` did not throw a marketplace-readiness error and could continue toward calldata encoding/writing with incomplete config.

### GREEN

Command:

```bash
cd packages/shared
bun run test -- src/__tests__/public-contracts.test.ts src/__tests__/utils/marketplace-readiness.test.ts src/__tests__/modules/marketplace src/__tests__/hooks/hypercerts/useCreateListing.test.ts src/__tests__/hooks/hypercerts/useBatchListForYield.test.ts src/__tests__/hooks/query-keys.test.ts
```

Result after implementation: passed, 8 files and 83 tests.

Additional focused validation:

```bash
cd packages/shared
bun run test -- src/__tests__/utils/marketplace-readiness.test.ts src/__tests__/modules/marketplace src/__tests__/hooks/hypercerts/useMarketplaceApprovals.test.ts src/__tests__/hooks/hypercerts/useCreateListing.test.ts src/__tests__/hooks/hypercerts/useBatchListForYield.test.ts src/__tests__/hooks/hypercerts/useCancelListing.test.ts src/__tests__/hooks/hypercerts/useHypercertListings.test.ts src/__tests__/hooks/hypercerts/useTradeHistory.test.ts src/__tests__/hooks/query-keys.test.ts
```

Result after the cancel-listing guard: passed, 12 files and 103 tests.

```bash
cd packages/shared
bun run typecheck
```

Result: passed.

Machine-readable proof was recorded with:

```bash
node scripts/harness/plan-hub.mjs record-tdd --feature hypercert-marketplace-arbitrum-readiness --lane state_api ...
```

## Current Lane State

- `contracts`: completed after stale blocked state was reconciled from direct JSON-RPC evidence.
- `state_api`: completed.
- `ui`: ready.
- `qa_pass_1`: blocked until UI completes.
- `qa_pass_2`: blocked until QA pass 1 completes.

## Remaining UI Blocker

The UI lane still needs to implement the admin operator UX using the shared readiness API. It should cover unavailable, needs-approval, ready, pending, success, and failure states without duplicating readiness logic in admin/client.
