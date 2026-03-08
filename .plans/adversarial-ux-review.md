# Adversarial UX Review: Core Transaction Flows (Synced)

> **Date**: 2026-02-19
> **Branch**: feature/ens-integration
> **Status**: IN PROGRESS (doc synchronized with current implementation)
> **Scope Note**: EAS revocability changes are explicitly out of scope in this pass.

---

## Summary

This document now reflects the current state of implementation and the active remediation pass.

This pass focused on:

1. Correcting previous overstatements in this file.
2. Implementing critical/high UX safety gaps that were not consistently applied.

---

## Out of Scope

- No changes to EAS revocability in `packages/shared/src/utils/eas/transaction-builder.ts`.
- No EAS revocability test updates in this pass.

---

## Implemented in This Pass

### Systemic Safety

- Added shared mutation lock exports and runtime integration:
  - `packages/shared/src/hooks/utils/useMutationLock.ts`
  - `packages/shared/src/hooks/index.ts`
  - `packages/shared/src/index.ts`
- Added before-unload protection during pending operations in runtime mutation paths.
- Added centralized transaction receipt timeout constant:
  - `packages/shared/src/utils/blockchain/polling.ts` (`TX_RECEIPT_TIMEOUT_MS = 120_000`)
- Applied timeout-aware receipt waiting across targeted hooks/modules:
  - `packages/shared/src/hooks/work/useBatchWorkSync.ts`
  - `packages/shared/src/hooks/ens/useENSClaim.ts`
  - `packages/shared/src/hooks/hypercerts/useCreateListing.ts`
  - `packages/shared/src/hooks/hypercerts/useCancelListing.ts`
  - `packages/shared/src/hooks/hypercerts/useBatchListForYield.ts`
  - `packages/shared/src/hooks/hypercerts/useMarketplaceApprovals.ts`
  - `packages/shared/src/hooks/garden/useCreateGardenWorkflow.ts`
  - `packages/shared/src/modules/work/wallet-submission.ts`

### Work Submission

- Added additional image validation rules in:
  - `packages/shared/src/modules/work/work-submission.ts`
  - max image count
  - max total payload size
  - allowed mime types
- Added wallet-flow network failure fallback to queue in:
  - `packages/shared/src/hooks/work/useWorkMutation.ts`
- Added best-effort blob preview URL cleanup in:
  - `packages/shared/src/hooks/work/useWorkImages.ts`
  - `packages/shared/src/hooks/work/useWorkMutation.ts`
- Added cancellable/timeout metadata fetch support:
  - API: `packages/shared/src/modules/data/ipfs.ts` (`getFileByHash` options)
  - Usage + retry action: `packages/client/src/views/Home/Garden/Work.tsx`
- Replaced object dependency with stable primitive metadata dependencies in:
  - `packages/client/src/views/Home/Garden/Work.tsx`
- Surfaced validation errors via provider context state in:
  - `packages/shared/src/providers/Work.tsx`

### Create Garden

- Removed dead progress logic in:
  - `packages/admin/src/components/Garden/CreateGardenSteps/DetailsStep.tsx`
- Disabled deploy confirmation when estimate error exists in:
  - `packages/admin/src/views/Gardens/CreateGarden.tsx`
- Added mutation-safety guards to submit path and before-unload warning in:
  - `packages/shared/src/hooks/garden/useCreateGardenWorkflow.ts`

### Work Approval UX

- Added distinct action-specific pending labels in:
  - `packages/admin/src/views/Gardens/Garden/WorkDetail.tsx`
- Added pending auto-clear guard metadata in optimistic state path in:
  - `packages/shared/src/hooks/work/useWorkApproval.ts`

### Deposit + Cross-Cutting

- Reordered slippage check to run before approval transaction in:
  - `packages/shared/src/hooks/vault/useVaultOperations.ts`
- Added stage-specific deposit failure messaging (approval vs deposit) in:
  - `packages/shared/src/hooks/vault/useVaultOperations.ts`
- Added while-open refresh intervals:
  - `packages/admin/src/components/Vault/DepositModal.tsx` (balance)
  - `packages/admin/src/components/Vault/WithdrawModal.tsx` (deposits)
  - `packages/shared/src/hooks/vault/useVaultDeposits.ts` (refetch option)
- Fixed query cache persist filter for non-greengoods keys in:
  - `packages/client/src/App.tsx`
- Re-enabled queue failure toasts and added queue `jobFailed` preset:
  - `packages/shared/src/providers/JobQueue.tsx`
  - `packages/shared/src/components/Toast/presets/queue.ts`
  - `packages/shared/src/components/Toast/presets/types.ts`

### Localization Updated

New user-facing strings were added to all locales:

- `packages/shared/src/i18n/en.json`
- `packages/shared/src/i18n/es.json`
- `packages/shared/src/i18n/pt.json`

---

## Remaining Open Items (Not Fully Addressed Here)

- EAS revocability remains unchanged (out of scope by decision).
- Additional medium/low polish and a11y backlog from prior audit remains open.
- Full test/lint/build execution is environment-dependent (`bun` CLI not available in current shell).

---

## Verification Notes

- Targeted code updates were applied to the files listed above.
- Full `bun`-based test and build validation is pending execution in a Bun-enabled environment.
