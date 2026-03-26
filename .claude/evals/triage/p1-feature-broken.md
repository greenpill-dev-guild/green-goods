# Triage Eval: P1 Feature Broken (Silent Failure)

## Issue Report

**Title**: Admin dashboard garden creation form silently fails — transaction fires but no garden created on-chain

**Reporter**: Garden operator via Slack #ops-support

**Body**:

Since the last `@green-goods/shared` package update (PR #312, merged yesterday), the garden creation flow in the admin dashboard is completely broken. When an operator fills out the garden creation wizard and clicks "Create Garden":

1. The wallet popup appears and the user confirms the transaction
2. The transaction is sent and confirmed on-chain (visible in block explorer)
3. The admin UI shows a brief loading state then returns to the form — no success toast, no error toast, no redirect to the new garden
4. No garden is created on-chain. The transaction succeeds but calls the wrong function selector — it appears the ABI import in the shared mutation hook is stale after the package update

The `useCreateGarden` hook in `packages/shared/src/hooks/garden/useCreateGarden.ts` references the `GardenToken` ABI for the `mintGarden` function. After the shared package update, the deployment artifact import path was refactored but the ABI reference in the hook was not updated. The hook encodes a call to the old function selector which executes a fallback (or no-op) on-chain instead of minting a garden.

No error is surfaced because:
- The transaction itself succeeds (the EVM doesn't revert on a no-op fallback)
- The mutation's `onSuccess` callback fires (it only checks `txHash` existence, not the actual on-chain effect)
- The `onSuccess` handler calls `queryClient.invalidateQueries` for the gardens list, but since no garden was created, the list is unchanged — the user sees nothing happen

**Labels**: bug, admin, shared, garden, blocking

**Reproduction**:

1. Navigate to Admin > Gardens > Create New Garden
2. Fill out the wizard (name, description, domain, at least one action)
3. Click "Create Garden" and confirm the wallet transaction
4. Observe: transaction confirms, but no garden appears in the list
5. Check the transaction on Arbiscan — it calls a function that doesn't match `mintGarden()`

**Impact**: All garden operators are blocked from creating new gardens. No workaround exists because the mutation hook in shared is the only code path for garden creation. Operators cannot fall back to a direct contract call because the wizard also registers actions and sets up Hats roles in a multicall batch.

## Expected Classification

### Classification
- **Severity**: `P1`
- **Type**: `bug`
- **Complexity**: `medium`

### Affected Packages
- `shared` (mutation hook with stale ABI reference)
- `admin` (garden creation wizard is the user-facing surface)

### Rationale

This is P1 because:
1. **Core feature completely broken**: Garden creation is a primary workflow — operators cannot onboard new gardens
2. **No workaround**: The multicall batch (mint + register actions + set up Hats) cannot be reproduced manually
3. **Regression**: Caused by a recent merge — was working before PR #312
4. **No error visibility**: Silent failure means operators may not realize the creation failed until they check the gardens list
5. **Not P0**: No security risk, no data loss, no fund exposure — it's a broken feature, not a vulnerability

### Expected Route
- Entry point: `/debug --mode hotfix`
- Skills: `contracts`, `error-handling-patterns`
- Immediate: Revert PR #312 or fix the ABI import path in the shared mutation hook

### Context for Next Agent
The `useCreateGarden` hook in `packages/shared/src/hooks/garden/useCreateGarden.ts` has a stale ABI import after the deployment artifact refactor in PR #312. The encoded function selector no longer matches `mintGarden()` on the deployed `GardenToken` contract. Fix the import path to reference the correct deployment artifact, then verify the function selector matches. Also add a post-transaction receipt check in the mutation's `onSuccess` to verify the expected event was emitted (prevent silent no-op failures in the future).

## Passing Criteria

- Severity MUST be `P1` (not P0 — no security/fund risk; not P2 — no workaround exists and it's a core feature)
- Type MUST be `bug`
- Must identify `shared` as the primary affected package (the mutation hook is the root cause)
- Must identify `admin` as the user-facing surface
- Must recognize this as a regression from a recent merge
- Must route to hotfix or debug mode, not standard sprint work
- Should note the silent failure pattern as an additional concern

## Common Failure Modes

- Classifying as P0 (no security or fund exposure — it's a broken feature, not a vulnerability)
- Classifying as P2 (there is NO workaround — the multicall batch is not reproducible manually)
- Identifying only `admin` as affected (the root cause is in `shared`)
- Routing to standard bug fix instead of hotfix (this blocks all garden creation)
- Suggesting a long-term fix without noting the need for immediate revert or hotfix
