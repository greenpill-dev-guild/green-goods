# Type Consolidation Findings

## HIGH-CONFIDENCE (safe to fix)

### H1: Duplicate `RateLimitResult` in agent package
- **Location**: `packages/agent/src/types.ts:256` AND `packages/agent/src/services/rate-limiter.ts:27`
- **Issue**: Same interface defined in two files within the same package. Both have identical fields: `allowed`, `remaining`, `resetIn`, `limit`. The `types.ts` version adds optional `message`.
- **Fix**: Remove from `types.ts`, import from `rate-limiter.ts`. Add `message?: string` to the `rate-limiter.ts` version.

### H2: Duplicate `TrackedAsset` and `MyTrackedPosition` in admin Endowments
- **Location**: `packages/admin/src/views/Endowments/index.tsx:78-89` AND `packages/admin/src/views/Endowments/MyPositionsSidebar.tsx:12-24`
- **Issue**: Both files define `TrackedAsset = "WETH" | "DAI"` and `MyTrackedPosition` interface. The sidebar version has an extra `chainId` field.
- **Fix**: Use the sidebar's exported version in `index.tsx`. Remove duplicate definitions from `index.tsx`.

### H3: Duplicate `WeightScheme` enum in shared/types
- **Location**: `packages/shared/src/types/contracts.ts:35-39` AND `packages/shared/src/types/gardens-community.ts:21-25`
- **Issue**: Same enum with identical values defined in two files within the shared types directory.
- **Fix**: Remove from `contracts.ts`, import from `gardens-community.ts`.

### H4: Unused `CreateAssessmentForm` re-export alias in admin
- **Location**: `packages/admin/src/components/Assessment/CreateAssessmentSteps/shared.tsx:6`
- **Issue**: `export type CreateAssessmentForm = CreateAssessmentFormData` is never imported by any file.
- **Fix**: Remove the unused alias.

### H5: `WorkCardData` uses `string` instead of `Address` for address fields
- **Location**: `packages/shared/src/components/Cards/WorkCard/WorkCard.tsx:40,43`
- **Issue**: `gardenerAddress?: string` and `gardenAddress?: string` should use `Address` type.
- **Fix**: Import `Address` from domain types and update field types.

### H6: `AssetTotalInput.assetAddress` uses `string` instead of `Address`
- **Location**: `packages/admin/src/components/Vault/assetTotals.ts:5`
- **Issue**: `assetAddress: string` should be `assetAddress: Address`.
- **Fix**: Import `Address` from `@green-goods/shared` and update.

### H7: Duplicate `WorkStatus` alias within shared package
- **Location**: `packages/shared/src/components/StatusBadge.tsx:15` AND `packages/shared/src/components/Cards/WorkCard/WorkCard.tsx:32`
- **Issue**: Both define `export type WorkStatus = WorkDisplayStatus`. Both are deprecated.
- **Fix**: Keep in `WorkCard.tsx` (which the `WorkCardData` interface uses), remove from `StatusBadge.tsx` and import from WorkCard. Or better: just reference `WorkDisplayStatus` directly.

### H8: `GardenMember.account` uses `string` instead of `Address`
- **Location**: `packages/client/src/components/Features/Garden/Gardeners.tsx:29`
- **Issue**: `account: string` overrides `GardenerCard.account?: Address` with a weaker type.
- **Fix**: Change to `account: Address`.

## MEDIUM (needs judgment)

### M1: Agent package uses `string` for all address fields instead of `Address`
- **Location**: `packages/agent/src/types.ts` (lines 135, 145, 176-180, 201, 204-216, 219-225)
- **Issue**: `User.address`, `CreateUserInput.address`, `PendingWork.gardenerAddress`, `GardenInfo.address`, `SubmitWorkParams.gardenAddress`, `SubmitApprovalParams.gardenerAddress` all use `string`.
- **Judgment**: Agent is a server-side package with less viem integration. Would require importing `Address` from `@green-goods/shared` and validating inputs. Could break the agent's loose typing model. Skip for now.

### M2: Inconsistent `gardenId: string` vs `gardenId: Address` across shared package
- **Location**: Many hooks/modules in shared use `gardenId: string` while domain types use `Address`.
- **Judgment**: Large-scale change across many files in shared package. Risky to change broadly.

### M3: `contracts.ts` imports `Address` from `viem` instead of from `./domain`
- **Location**: `packages/shared/src/types/contracts.ts:1`
- **Issue**: Should import from `./domain` for consistency within the types directory. However, both ultimately resolve to the same viem type.
- **Judgment**: Purely cosmetic. Low risk but also low value.

## LOW (risky/unclear)

### L1: `WorkCardItem` in client vs `WorkCardData` in shared
- **Location**: `packages/client/src/components/Cards/Work/WorkCard.tsx:17` vs `packages/shared/src/components/Cards/WorkCard/WorkCard.tsx:34`
- **Issue**: Different interfaces with partially overlapping fields. `WorkCardItem` has queue-specific fields (retryCount, size, images) while `WorkCardData` is display-focused.
- **Judgment**: These serve different purposes. Client's `WorkCardItem` is for the offline work queue cards, shared's `WorkCardData` is for the shared WorkCard component. Not truly duplicates.

### L2: `CreateAssessmentForm` deprecation chain
- **Location**: `domain.ts:542`, `workflows/createAssessment.ts:5`, `hooks/index.ts:82`
- **Issue**: `CreateAssessmentForm = AssessmentWorkflowParams` is deprecated but still exported from shared barrel.
- **Judgment**: Breaking change to remove. Deprecation is already documented. Leave as-is.
