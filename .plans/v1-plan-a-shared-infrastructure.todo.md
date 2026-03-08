# Plan A: Shared Infrastructure Fixes

**GitHub Issues**: #404, #431, #411, #406
**Branch**: `fix/shared-infrastructure`
**Status**: IMPLEMENTED
**Created**: 2026-03-07
**Phase**: 1 (goes first — client and admin depend on these)

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Single source of truth for gateway list in ipfs.ts | 6+ files define gateways independently — drift causes image failures |
| 2 | ImageWithFallback imports from ipfs.ts, not hardcoded | Component should use the configured gateway list |
| 3 | Client assessments should use useGardenAssessments hook | Same pattern as admin — dedicated EAS query, not nested garden data |
| 4 | All EAS URLs use getEASExplorerUrl() | 2 places hardcode mainnet URL; chain-aware function already exists |
| 5 | Pre-flight validation before work approval contract call | Prevent confusing reverts with clear error messages |

## CLAUDE.md Compliance
- [x] Hooks in shared package
- [x] Barrel imports only
- [ ] i18n for validation error messages
- [x] Use `logger` not `console.log`

## Impact Analysis

### Files to Modify
- `packages/shared/src/modules/data/ipfs.ts` — export gateway list
- `packages/shared/src/components/Display/ImageWithFallback.tsx` — import gateways from ipfs.ts
- `packages/shared/src/hooks/assessment/useGardenAssessments.ts` — make chain-aware (not admin-store-dependent)
- `packages/client/src/views/Home/Garden/Assessment.tsx` — use getEASExplorerUrl, use proper assessment hook
- `packages/admin/src/views/Gardens/Garden/Assessment.tsx` — use getEASExplorerUrl instead of hardcoded constant
- `packages/shared/src/hooks/work/useWorkApproval.ts` — add pre-flight validation
- `packages/shared/src/index.ts` — export new items if needed

### Files to Create
- None (possibly a `useAssessments.ts` for cross-garden assessment queries if needed for #430)

## Test Strategy
- **Unit tests**: Gateway list export, resolveIPFSUrl with fallbacks, EAS URL generation per chain
- **Component tests**: ImageWithFallback gateway retry with imported list
- **Integration tests**: Assessment hook returns data, work approval pre-flight catches invalid states

---

## Implementation Steps

### Step 1: Export gateway list from ipfs.ts as single source of truth
**Files**: `packages/shared/src/modules/data/ipfs.ts` (lines 24-36)
**Details**:

Current state — `DEFAULT_IPFS_GATEWAYS` is a module-private `const` at line 34:
```typescript
const DEFAULT_IPFS_GATEWAYS = ["https://storacha.link", "https://w3s.link", "https://ipfs.io"];
```

Changes:
1. Export `DEFAULT_IPFS_GATEWAYS` (rename to `IPFS_FALLBACK_GATEWAYS` for clarity)
2. Export a `getIPFSFallbackGateways()` function that returns the gateway list respecting env config:
   ```typescript
   export function getIPFSFallbackGateways(): string[] {
     return Array.from(new Set(
       [pinataGatewayUrl, gatewayUrl, ...IPFS_FALLBACK_GATEWAYS]
         .filter((entry): entry is string => Boolean(entry))
         .map(trimTrailingSlashes)
     ));
   }
   ```
3. `getReadGatewayBases()` (line 422) already does this — consider exporting it directly or refactoring to share logic

**Verification**: Import `getIPFSFallbackGateways` from shared — returns configured gateways

---

### Step 2: Update ImageWithFallback to use shared gateway list
**Files**: `packages/shared/src/components/Display/ImageWithFallback.tsx` (line 6)
**Details**:

Current state — hardcoded independent list at line 6:
```typescript
const FALLBACK_GATEWAYS = ["https://w3s.link", "https://storacha.link", "https://dweb.link"];
```

Change to:
```typescript
import { getIPFSFallbackGateways } from "../../modules/data/ipfs";
```

Update `handleError` (lines 53-65) to call `getIPFSFallbackGateways()` instead of iterating `FALLBACK_GATEWAYS`:
```typescript
const handleError = () => {
  const gateways = getIPFSFallbackGateways();
  for (const gateway of gateways) {
    if (triedGateways.current.has(gateway)) continue;
    triedGateways.current.add(gateway);
    const alternate = rewriteGateway(currentSrc, gateway);
    if (alternate && alternate !== currentSrc) {
      setCurrentSrc(alternate);
      setIsLoading(true);
      return;
    }
  }
  setHasError(true);
  setIsLoading(false);
  onErrorCallback?.();
};
```

**Verification**: Component test — when image fails, retries with gateways from ipfs.ts config

---

### Step 3: Fix assessment EAS URLs — replace hardcoded mainnet with chain-aware function
**Files**:
- `packages/client/src/views/Home/Garden/Assessment.tsx` (line 168)
- `packages/admin/src/views/Gardens/Garden/Assessment.tsx` (line 15)

**Client — line 168**, current:
```html
href={`https://explorer.easscan.org/attestation/view/${uid}`}
```
Change to:
```typescript
import { getEASExplorerUrl } from "@green-goods/shared";
// ... in the component:
href={getEASExplorerUrl(chainId, uid)}
```

Need to ensure `chainId` is available in the client assessment component. Currently it uses `useGardens(DEFAULT_CHAIN_ID)` at line 13, so `DEFAULT_CHAIN_ID` is available.

**Admin — line 15**, current:
```typescript
const EAS_EXPLORER_URL = "https://explorer.easscan.org";
```
Remove this constant. Replace all usages with `getEASExplorerUrl(chainId, attestation.id)`. The admin assessment component already has `chainId` from `useAdminStore`.

**Verification**: On Arbitrum (chain 42161), assessment links go to `arbitrum-one.easscan.org`, not `explorer.easscan.org`

---

### Step 4: Make assessment hook chain-aware for client use
**Files**: `packages/shared/src/hooks/assessment/useGardenAssessments.ts`
**Details**:

Current state — hook depends on `useAdminStore` (line 4, 8):
```typescript
import { type AdminState, useAdminStore } from "../../stores/useAdminStore";
// ...
const selectedChainId = useAdminStore((state: AdminState) => state.selectedChainId);
```

This means the **client cannot use this hook** because `useAdminStore` is admin-specific.

**Fix**: Accept `chainId` as an optional parameter, defaulting to `DEFAULT_CHAIN_ID`:
```typescript
export function useGardenAssessments(gardenAddress?: string, chainId?: number) {
  const resolvedChainId = chainId ?? DEFAULT_CHAIN_ID;
  // ... use resolvedChainId instead of selectedChainId
}
```

Remove the `useAdminStore` dependency. The admin caller can pass `selectedChainId` explicitly:
```typescript
// Admin usage:
const chainId = useAdminStore(state => state.selectedChainId);
useGardenAssessments(gardenAddress, chainId);

// Client usage:
useGardenAssessments(gardenAddress); // defaults to DEFAULT_CHAIN_ID
```

**Verification**: Client can import and call `useGardenAssessments` without admin store dependency

---

### Step 5: Update client assessment view to use dedicated hook
**Files**: `packages/client/src/views/Home/Garden/Assessment.tsx`
**Details**:

Current state — assessments are extracted from nested garden data:
```typescript
const { gardens } = useGardens(DEFAULT_CHAIN_ID);
// ... garden.assessments.find(...)
```

This is fragile — if the garden query doesn't include assessments (stale cache, partial fetch), nothing renders.

**Fix**: Use the updated `useGardenAssessments` hook:
```typescript
import { useGardenAssessments } from "@green-goods/shared";
const { data: assessments } = useGardenAssessments(gardenAddress);
const assessment = assessments?.find(a => a.id === assessmentId);
```

This gives the client the same reliable, independent assessment fetching that admin has.

**Verification**: Client garden assessments tab loads data independently of garden query

---

### Step 6: Fix broken approval simulation + add pre-flight validation
**Files**:
- `packages/shared/src/modules/work/simulate.ts` — missing `simulateApprovalSubmission` export
- `packages/shared/src/hooks/work/useWorkApproval.ts` (lines 94-140)

**Details**:

**Critical discovery**: `simulateApprovalSubmission` is imported in `submit-approval.ts` (line 17) but **NOT defined** in `simulate.ts`. Only `simulateWorkSubmission` is exported (lines 63-153). This means the pre-flight simulation for approvals is completely broken — a dead import.

**Two-part fix**:

**Part A** — Implement `simulateApprovalSubmission` in `simulate.ts`:
- Mirror the pattern of `simulateWorkSubmission` but for the approval contract call
- Should call `staticCall` / `estimateGas` on the approval resolver contract
- Return a clear error if the simulation fails (e.g., "not authorized", "already approved")

**Part B** — Add inline pre-flight checks in the mutation:
```typescript
mutationFn: async ({ draft, work }: UseWorkApprovalParams) => {
  // Pre-flight validation
  if (!draft.workUID) {
    throw new Error("Work UID is required for approval");
  }
  if (!work.gardenAddress) {
    throw new Error("Garden address is missing from work data");
  }
  if (work.status === "approved" || work.status === "rejected") {
    throw new Error(`This work has already been ${work.status}`);
  }
  if (authMode === "wallet" && !smartAccountClient) {
    throw new Error("Wallet is not connected");
  }
  // ... existing submission logic
}
```

Also update `createMutationErrorHandler` usage to provide user-friendly messages for these validation failures.

**Verification**: Approving already-approved work shows "This work has already been approved" instead of a confusing contract revert. The broken import no longer silently fails.

---

## Validation

```bash
bun format && bun lint && bun run test && bun build
```

## Post-Landing

After this plan merges:
- Plans B and C can launch in parallel (they depend on the fixed shared modules)
- Client assessment loading (#431) should work
- Image fallbacks (#411) use consistent gateways
- Work approval (#406) gives clear error messages
