# Agent 2 — Type Consolidation (Dry Run, Re-Run)

Scope: **admin, shared, client, contracts** only. Service packages OUT OF SCOPE. Research only, no source edits. Monorepo root: `/Users/afo/Code/greenpill/green-goods`.

## Executive Summary

- `@green-goods/shared/types/` remains the canonical home for domain types (Garden, Work, Action, Address, etc.) and the in-scope packages import them correctly through the barrel.
- **H6** (agent package `GardenInfo` rename) is dropped from scope.
- Remaining HIGH-confidence findings are small and safe:
  - `WorkCardItem.status` in `packages/client/src/components/Cards/Work/WorkCard.tsx:19` still inlines `WorkDisplayStatus`.
  - `packages/admin/src/components/Assessment/index.ts:4` is still a broken re-export (`CreateAssessmentForm` is not exported from the file it claims to re-export from).
  - `Garden` type in `packages/shared/src/stores/useAdminStore.ts:8` still shadows the canonical `Garden`. Only reachable via `@green-goods/shared/stores` deep import, not via the top-level barrel.
  - New finding: `DeploymentConfig` name collision between `packages/shared/src/config/blockchain.ts:28` (internal) and `packages/shared/src/types/blockchain.ts:13` (exported). Different shapes.
  - New finding: file-private `interface Work` in `packages/shared/src/providers/JobQueue.tsx:53` shadows canonical `Work` and uses `status: string`.
- `string`→`Address` audit (§5): ~20 clear violations in shared, 1 in admin, 4 in client. Key hotspots: `useUser.ts`, `useHypercertWizardStore.ts`, `providers/Work.tsx`, `GardenProfileModal.tsx`, `work-dashboard-utils.ts`, `TreasuryTabContent.tsx`.
- Deprecated aliases (§6): `WorkDraft`, `CreateAssessmentForm`, `WorkStatus`. None consumed by admin/client. Migration scope is entirely within shared.

---

## HIGH-CONFIDENCE findings (safe to fix)

### H2. `WorkCardItem.status` inlines the `WorkDisplayStatus` union
- **Duplicate**: `packages/client/src/components/Cards/Work/WorkCard.tsx:19` declares `status: "approved" | "rejected" | "pending" | "syncing" | "uploading" | "sync_failed" | "offline";`
- **Canonical**: `packages/shared/src/types/domain.ts:338` — `WorkDisplayStatus` with the exact same 7-member union. Doc comment already explicitly names this as the single source of truth.
- **Proposed fix**: replace the inline union with `status: WorkDisplayStatus` imported from `@green-goods/shared`.
- **Affected consumers**: `WorkCardItem` is exported via `packages/client/src/components/Cards/index.ts:44`. All consumers will benefit automatically.

### H3. `WorkStatus` deprecated alias in shared component
- **Location**: `packages/shared/src/components/Cards/WorkCard/WorkCard.tsx:32` — `export type WorkStatus = WorkDisplayStatus;` with `@deprecated` JSDoc.
- **Admin/client consumers**: 0 (verified via targeted grep — only `WorkStatusBadge` name collision, which is a different symbol).
- **Internal consumers**: line 37 (same file), barrel re-exports at `packages/shared/src/components/Cards/WorkCard/index.ts:8`, `packages/shared/src/components/Cards/index.ts:36`, `packages/shared/src/components/index.ts:59`, `packages/shared/src/index.ts:78`.
- **Proposed fix**: rewrite line 37 to use `WorkDisplayStatus`, drop the alias at line 32, and drop the four internal barrel re-exports. Zero external churn.

### H4. Broken re-export of `CreateAssessmentForm` in admin
- **Location**: `packages/admin/src/components/Assessment/index.ts:4` — `export type { CreateAssessmentForm } from "./CreateAssessmentSteps/shared";`
- **Reality**: verified `packages/admin/src/components/Assessment/CreateAssessmentSteps/shared.tsx` has no `CreateAssessmentForm` export (only `DOMAIN_ICON_CONFIG`, `resolveDomainLabel`, `ALL_DOMAINS`, `domainKey`, `DOMAIN_GUIDANCE`, `LabeledField`, `inputClassName`, `textareaClassName`, `Section`, `ReviewRow`, `formatDateRange`).
- **Consumers of `CreateAssessmentForm` in admin**: only `packages/admin/src/views/Garden/CreateAssessment.tsx:21` — imports from `@green-goods/shared` directly as `type CreateAssessmentForm as WorkflowAssessmentForm`, not via the admin barrel.
- **Proposed fix**: delete line 4 of `packages/admin/src/components/Assessment/index.ts`. Zero churn; admin never used its own re-export.

### H5. Deprecated aliases `WorkDraft` and `CreateAssessmentForm` in shared domain types
- `packages/shared/src/types/domain.ts:390` — `export type WorkDraft = WorkSubmission;` (`@deprecated`)
- `packages/shared/src/types/domain.ts:542` — `export type CreateAssessmentForm = AssessmentWorkflowParams;` (`@deprecated`)
- Re-exported: `packages/shared/src/types/index.ts:118`.
- **`WorkDraft` consumers** (in-scope): 0 in admin, 0 in client. 20 locations in shared (hooks, modules, providers, stores, tests, utils). Migration is internal.
- **`CreateAssessmentForm` consumers** (in-scope): 2 in admin (`Assessment/index.ts:4` broken re-export — see H4; `views/Garden/CreateAssessment.tsx:21` actual usage), 0 in client, 8 locations in shared (workflows, stores, hooks, tests).
- **Proposed fix**: see §6 for full recommendation. Summary: rename internal shared usages to `WorkSubmission` / `AssessmentWorkflowParams`, then delete the alias + barrel re-export.

### H6. `Garden` name clash in `useAdminStore.ts`
- **Location**: `packages/shared/src/stores/useAdminStore.ts:8` defines `export type Garden = Pick<DomainGarden, ...>;` — a 10-field subset of the canonical 25-field `Garden`.
- **Re-export**: `packages/shared/src/stores/index.ts:4` re-exports this narrow `Garden` (verified unchanged).
- **Top-level barrel check**: the `@green-goods/shared` top-level index.ts re-exports from stores as a named list (lines 647–672) that does NOT include `Garden`. So consumers of `@green-goods/shared` get the canonical `Garden` (from `./types/index`, line 827). Safe from the public API surface.
- **Latent risk**: anyone deep-importing from `@green-goods/shared/stores` (barrel-bypass), or editing code inside `packages/shared/src/stores/**`, sees the narrow `Garden`. `packages/shared/src/hooks/**` routinely imports `AdminState` from `../stores/useAdminStore`, where the narrow `Garden` resolves through `AdminState.selectedGarden`.
- **Proposed fix**: rename the store type to `SelectedGarden` or `AdminSelectedGarden`. Update `useAdminStore.ts` local references, `stores/index.ts` re-export, and any consumer that deep-imports from stores.

### H7. NEW — `DeploymentConfig` name collision
- **Exported**: `packages/shared/src/types/blockchain.ts:13` — exported `DeploymentConfig` with Address-typed fields, re-exported via `packages/shared/src/types/index.ts:42`.
- **Internal**: `packages/shared/src/config/blockchain.ts:28` — local `interface DeploymentConfig` (file-private) using `string` for all address fields, plus extra fields (`octantModule`, `octantFactory`).
- **Proposed fix**: either merge the two (drop the internal one and use the exported one with `as DeploymentConfig` at the JSON parse boundary), or rename the internal one to `DeploymentJSONConfig` / `RawDeploymentConfig` to make the JSON-wire vs domain distinction explicit.

### H8. NEW — File-private `Work` in `providers/JobQueue.tsx`
- **Location**: `packages/shared/src/providers/JobQueue.tsx:53` — `interface Work { id: string; status: string; [key: string]: unknown; }`.
- **Canonical**: `packages/shared/src/types/domain.ts:412` — `Work extends WorkCard` with typed `status: WorkDisplayStatus`, addresses, etc.
- **Usage scope**: single callsite at line 165 (`queryClient.setQueriesData<Work[]>`).
- **Proposed fix**: replace the local interface with `import type { Work } from "../types/domain";` (or use `Partial<Work>` / `Pick<Work, 'id' | 'status'>` since the local shape was a loose index signature).

---

## MEDIUM findings (need design judgment)

### M1. `Domain` enum vs `ActionDomain` string union — documented but still confusing
- `packages/shared/src/types/domain.ts:41` — numeric on-chain enum `Domain` (SOLAR=0, AGRO=1, EDU=2, WASTE=3).
- `packages/shared/src/types/hypercerts.ts:7` — string union `ActionDomain = "solar" | "waste" | "agroforestry" | "education" | "mutual_credit"`.
- Bridging: `domainToActionDomain()` at `packages/shared/src/modules/data/hypercerts-filters.ts:21`.
- **Assessment**: intentional split (on-chain uint8 vs hypercerts.org metadata spec). But `ActionDomain` adds `"mutual_credit"` which has no `Domain` counterpart, and the name does not make the difference legible. Consider renaming to `HypercertDomain` or adding an explicit type-level comment.

### M2. `Capital` enum vs `CapitalType` string union — same pattern as M1
- `packages/shared/src/types/domain.ts:26` — numeric enum `Capital` (SOCIAL=0, MATERIAL=1, … CULTURAL=7).
- `packages/shared/src/types/hypercerts.ts:33` — string union `CapitalType = "living" | "social" | "material" | …`.
- **Proposed fix**: document both. `Capital` has one direct callsite (`packages/client/src/components/Cards/Action/ActionCard.stories.tsx:15`); `CapitalType` is used by admin's `MetadataEditor`. Both are legitimate in their domains.

### M3. `HubPipelineStage` / `SortDirection` / `ActivityEvent` in `packages/admin/src/views/Hub/hub.utils.ts`
- Lines 14–16: pipeline stage union, sort direction, and `ActivityEvent = ReturnType<typeof useGardenDerivedState>["activityEvents"][number]`.
- **Assessment**: pipeline stage & sort direction are purely admin UI concepts — keep local. `ActivityEvent` is derived from a shared hook's inferred type; if the shape becomes a first-class entity it should be promoted to `@green-goods/shared`. Flag only; no action needed unless Hub is refactored.

### M4. `GardenMember` in `packages/client/src/components/Features/Garden/Gardeners.tsx:29`
- `export type GardenMember = GardenerCard & { account: Address; isOperator: boolean; isGardener: boolean; };`
- Client-only augmentation of shared `GardenerCard`. Admin's member management does not use it. Keeping local is acceptable; promote to shared if/when admin and client converge on a shared member-list UI.

### M5. `HypercertCompletionData` and `HypercertWizardProps` in admin
- `packages/admin/src/components/Hypercerts/HypercertWizard/types.ts:7` — `HypercertCompletionData` (admin-only UI-callback payload).
- **Assessment**: correctly scoped. Minor: the `txHash?: \`0x${string}\`` could be `Hex` from viem — trivial.

### M6. Contracts scripts — `NetworkConfig`, `NetworkContracts`, `DeploymentData` in `packages/contracts/script/utils/`
- `packages/contracts/script/utils/network.ts:4` — `NetworkConfig`
- `packages/contracts/script/utils/deployment-addresses.ts:5,21,26` — `DeploymentData`, `NetworkContracts`, `NetworkConfig`
- Shared equivalents exist in `packages/shared/src/types/contracts.ts:5` (`NetworkContracts`) and `packages/shared/src/config/blockchain.ts:17` (`NetworkConfig`).
- **Assessment**: intentional separation. Contracts scripts are Node/Foundry-side and don't import `@green-goods/shared`. Consolidation would require the shared package to ship Node-safe utilities — large refactor for limited benefit. No action unless someone adds a dependency from scripts to shared.

### M7. `WorkCardItem` vs `Work` vs `WorkCardData`
- Client: `packages/client/src/components/Cards/Work/WorkCard.tsx:12` — `WorkCardItem` (includes upload/sync metadata: `retryCount`, `size`, `lastAttempt`, `error`).
- Shared: `packages/shared/src/components/Cards/WorkCard/WorkCard.tsx:34` — `WorkCardData` (presentation-layer shape: id/title/status/createdAt/mediaPreview).
- Shared: `packages/shared/src/types/domain.ts:412` — `Work` (domain entity).
- **Assessment**: three distinct concerns (draft-with-queue-meta vs card-view-model vs domain-entity). Not duplicates. Current layering is correct. Could be tighter if `WorkCardItem` extended `WorkCardData`, but not required.

---

## LOW findings

### L1. `ChainId = number` trivial alias
- `packages/shared/src/types/blockchain.ts:10` — adds no type safety.
- Could be branded (`type ChainId = number & { __chain: true };`) to prevent `chainId` ↔ `timestamp` mix-ups. Churn not worth it.

### L2. `Garden.tokenID` casing vs `HypercertRecord.tokenId`
- `packages/shared/src/types/domain.ts:145` — `tokenID: bigint;` (Garden ERC721)
- `packages/shared/src/types/hypercerts.ts:222` — `tokenId: bigint;` (Hypercert ERC1155)
- `packages/shared/src/types/indexer-responses.ts:23` — `tokenID: string | bigint;`
- `packages/shared/src/types/blockchain.ts:35` — `rootGarden.tokenId: number;` (note lowercase + number).
- **Assessment**: different ERC tokens, so conceptually different. But the casing variation is footgun-worthy. The Solidity-generated `packages/shared/src/types/green-goods.d.ts` uses `tokenID` — likely forces the Garden domain type. `rootGarden.tokenId: number` should probably be `bigint` to match.

### L3. `SyncStatus` vs `WorkDisplayStatus`
- `packages/shared/src/components/Progress/SyncIndicator.tsx:19` — `SyncStatus = "synced" | "pending" | "syncing" | "offline" | "error"` (queue-level).
- `packages/shared/src/types/domain.ts:338` — `WorkDisplayStatus` (per-work-item).
- Different granularity. Not duplicates.

---

## 5. `string` → `Address` audit (exhaustive, in-scope packages only)

Legend: ✅ = hard violation (should be `Address`), ⚠️ = borderline (raw user input, storage key, or existing type union), ℹ️ = intentional.

### Shared package — domain violations

| File:line | Field | Status |
| --- | --- | --- |
| `packages/shared/src/hooks/auth/useUser.ts:40` | `User.wallet.address: string` | ✅ |
| `packages/shared/src/hooks/auth/useUser.ts:50` | `UseUserReturn.eoa: { address: string } \| null` | ✅ |
| `packages/shared/src/hooks/auth/useUser.ts:52` | `UseUserReturn.smartAccountAddress: string \| null` | ✅ |
| `packages/shared/src/hooks/auth/useUser.ts:64` | `UseUserReturn.externalWalletAddress: string \| null` | ✅ |
| `packages/shared/src/hooks/auth/useUser.ts:66` | `UseUserReturn.primaryAddress: string \| null` | ✅ |
| `packages/shared/src/hooks/analytics/useAnalyticsIdentity.ts:50` | `primaryAddress: string \| null` | ✅ |
| `packages/shared/src/stores/useHypercertWizardStore.ts:142` | `signalPoolAddress: string \| null` | ✅ |
| `packages/shared/src/stores/useHypercertWizardStore.ts:210` | `toDraft: (gardenId: string, operatorAddress: string) => ...` | ✅ |
| `packages/shared/src/hooks/garden/createGardenOperation.ts:29,32,41,44,54,57,157` | `gardenAddress / targetAddress: string` (operation helpers) | ✅ |
| `packages/shared/src/hooks/garden/useGardenOperations.ts:34,141,164,168` | `targetAddress: string` (operation helpers) | ✅ |
| `packages/shared/src/hooks/garden/useGardenDraft.ts:56,80` | `operatorAddress?: string` | ✅ |
| `packages/shared/src/hooks/garden/useJoinGarden.ts:85,94,113,196` | `{ address: string; ... }`, `userAddress: string`, `gardenAddress: string` | ✅ (mix — `userAddress` candidate for `Address \| null`) |
| `packages/shared/src/hooks/gardener/useRole.ts:34` | `fetchOperatorGardens(address: string, ...)` | ✅ |
| `packages/shared/src/workflows/mintHypercert.ts:43,181,221` | `signalPoolAddress: string \| null` | ✅ |
| `packages/shared/src/providers/Work.tsx:45,46` | `WorkSelectionValue.gardenAddress: string \| null` | ✅ |
| `packages/shared/src/providers/Work.tsx:91,92` | `WorkDataProps.form.gardenAddress: string \| null` | ✅ |
| `packages/shared/src/config/blockchain.ts:13,14` | `EASConfig.EAS.address: string`, `EASConfig.SCHEMA_REGISTRY.address: string` | ✅ |
| `packages/shared/src/config/blockchain.ts:38,54` | `address?: string` (internal `DeploymentConfig` — see H7) | ⚠️ (raw JSON-wire shape; tighten if H7 consolidates) |
| `packages/shared/src/components/Cards/GardenCard/GardenCard.tsx:76` | `renderOperatorName?: (address: string) => ...` | ✅ |
| `packages/shared/src/components/Vault/AssetSelector.tsx:7` | `onSelect: (assetAddress: string) => void` | ✅ |
| `packages/shared/src/hooks/garden/useFilteredGardens.ts:47` | `userAddress: string \| null` | ✅ |
| `packages/shared/src/hooks/garden/useAutoJoinRootGarden.ts:40,48` | `address?: string \| null` (membership check) | ⚠️ (normalizer) |

### Shared package — intentional / borderline (do not convert)

- `packages/shared/src/config/query-keys/**` — `gardenAddress: string` function params accept any stringifiable key. Tightening forces callers to pre-validate. Leave as-is.
- `packages/shared/src/utils/blockchain/address.ts:37-122` — validators/normalizers accept raw strings. Intentional.
- `packages/shared/src/stores/useAdminStore.ts:58` — `getAdminGardenScopeKey(address: string | null | undefined, ...)` — scope-key helper normalizes to lowercase. Acceptable.
- `packages/shared/src/stores/useCreateGardenStore.ts:44–97` — `addGardener(address: string)`, `sanitizeAddress(address: string)`, `isValidAddress(address: string)` — validators accept raw user input before coercing. Intentional.
- `packages/shared/src/utils/storage/avatar-cache.ts:14,59,81` — cache-key helper, acceptable.
- `packages/shared/src/modules/job-queue/**` — `userAddress: string` (IndexedDB key); low-value to convert.
- `packages/shared/src/__mocks__/**`, `packages/shared/src/__tests__/**` — test code, not production.

### Admin package — violations

| File:line | Field | Status |
| --- | --- | --- |
| `packages/admin/src/components/Garden/GardenProfileModal.tsx:18` | `garden.tokenAddress: string` (inline prop type) | ✅ (file already imports `Address` at line 1, and line 59 casts `as Address`) |

### Client package — violations

| File:line | Field | Status |
| --- | --- | --- |
| `packages/client/src/views/Home/WorkDashboard/work-dashboard-utils.ts:60` | `gardenAddress: string` param | ✅ |
| `packages/client/src/views/Home/WorkDashboard/work-dashboard-utils.ts:72` | `CompletedApproval.gardenerAddress: string` | ✅ (file-private interface) |
| `packages/client/src/views/Home/WorkDashboard/work-dashboard-utils.ts:83` | `ReceivedApproval.gardenerAddress: string` | ✅ (file-private interface) |
| `packages/client/src/components/Dialogs/TreasuryDrawer/TreasuryTabContent.tsx:25` | `TreasuryTabContentProps.primaryAddress: string \| null` | ✅ (file already imports `Address` at line 2) |

### Contracts package

- `packages/contracts/script/utils/deployment-addresses.ts` uses plain `string` for addresses (Node scripts). Intentional boundary — scripts don't import from `@green-goods/shared`. No change recommended.

---

## 6. Deprecated alias status

For each `@deprecated` type alias in shared, counting only in-scope-package consumers.

### `WorkDraft` (`packages/shared/src/types/domain.ts:390`)
- **Alias for**: `WorkSubmission`
- **Admin consumers**: 0
- **Client consumers**: 0
- **Internal shared consumers**: 20 files (hooks/work/**, modules/work/**, providers/Work.tsx, stores/useWorkFlowStore.ts, utils/eas/encoders.ts, types/job-queue.ts, MODULES.md, plus tests).
- **Recommendation**: **migrate**. Since there are zero external consumers, rename all internal `WorkDraft` references to `WorkSubmission`, then delete the alias + the re-export at `packages/shared/src/types/index.ts:118` + the re-export at `packages/shared/src/index.ts:833`. Roughly 20 find/replace sites, all within shared.

### `CreateAssessmentForm` (`packages/shared/src/types/domain.ts:542`)
- **Alias for**: `AssessmentWorkflowParams`
- **Admin consumers**: 2 — `components/Assessment/index.ts:4` (broken re-export, see H4; delete outright) and `views/Garden/CreateAssessment.tsx:21` (aliased to `WorkflowAssessmentForm`; easy rename).
- **Client consumers**: 0
- **Internal shared consumers**: 8 files (workflows/createAssessment.ts, workflows/index.ts, stores/useCreateAssessmentStore.ts, hooks/assessment/useCreateAssessmentForm.ts, hooks/assessment/useCreateAssessmentWorkflow.ts, types/index.ts, index.ts, plus tests).
- **Recommendation**: **migrate**. First delete the dead admin re-export (H4), then rename the one real admin consumer to import `AssessmentWorkflowParams` directly, then internal shared migration.

### `WorkStatus` (`packages/shared/src/components/Cards/WorkCard/WorkCard.tsx:32`)
- **Alias for**: `WorkDisplayStatus`
- **Admin consumers**: 0
- **Client consumers**: 0
- **Internal shared consumers**: 1 file (same file, line 37) + 4 barrel re-exports.
- **Recommendation**: **migrate**. Update line 37 to `WorkDisplayStatus`, delete the alias at line 32 and the four re-exports. Zero external churn.

### `WorkMetadataV1` (`packages/shared/src/types/index.ts:118`)
- Not marked `@deprecated` explicitly, but referenced in a compatibility comment. Kept for backward compatibility with old on-chain attestations. **Do not drop** — indexer/historical-data concern. Leave as-is.

---

## 7. Non-findings (look duplicated but are intentional)

1. **`packages/indexer/generated/src/Types.gen.ts`** — Envio codegen. Out of scope anyway.
2. **`IndexerGarden` vs `Garden` (both in shared)** — `IndexerGarden` at `types/indexer-responses.ts:19` is a wire-format shape; `Garden` at `types/domain.ts:141` is the normalized domain entity. Boundary by design.
3. **`EASWork` / `EASWorkApproval` / `EASGardenAssessment` (shared) vs `Work` / `WorkApproval` / `GardenAssessment` (shared)** — EAS types are decoded-attestation shapes; domain types add derived fields. Do not merge.
4. **`Capital` enum vs `CapitalType` string union** — on-chain uint8 vs hypercerts.org spec. Conceptually distinct.
5. **`Domain` enum vs `ActionDomain` string union** — same rationale; `ActionDomain` has `"mutual_credit"` with no on-chain mirror.
6. **`WorkCardProps` / `MinimalWorkCardProps` (client) vs `WorkCardProps` (shared)** — client composes over the shared primitive (draft rendering, offline-queue badges).
7. **`GardenCardProps` (client) extending `SharedGardenCardProps`** — `packages/client/src/components/Cards/Garden/GardenCard.tsx` uses `Omit<...> & ClientExtras` pattern. Correct.
8. **`TransactionStatus` / `TransactionInfo` in `useAdminStore.ts`** — narrow in-memory admin tx tracking. Unrelated to other tx flow types.
9. **Contracts-script `NetworkConfig` / `NetworkContracts` / `DeploymentData`** (§M6) — intentional separation from shared.
10. **Viem's `Account` type in grep hits** — from `node_modules`, not source.
11. **`SyncStatus` vs `WorkDisplayStatus`** — queue-level vs item-level. Not duplicates.
12. **`WorkCardItem` / `WorkCardData` / `Work`** (§M7) — three distinct concerns.

---

## Suggested remediation order (in-scope only)

1. **H4** (delete dead re-export in admin) — zero-risk one-line edit.
2. **H2** (replace `WorkCardItem.status` inline union with `WorkDisplayStatus`) — import already available.
3. **H8** (replace local `Work` interface in `JobQueue.tsx` with canonical `Work`) — one-file change.
4. **H3** (drop `WorkStatus` alias and its four re-exports) — file-local.
5. Address audit hits in `packages/shared/src/hooks/auth/useUser.ts` — 5 lines in one file.
6. Address audit hits in `packages/shared/src/stores/useHypercertWizardStore.ts` and `packages/shared/src/providers/Work.tsx` — ~8 lines.
7. Admin + client one-off Address tightening (`GardenProfileModal`, `work-dashboard-utils`, `TreasuryTabContent`).
8. **H6** (rename store `Garden` to `SelectedGarden` or `AdminSelectedGarden`).
9. **H7** (resolve `DeploymentConfig` name collision — merge or rename internal).
10. **H5 / deprecated aliases** — migrate `WorkDraft` → `WorkSubmission` (20 sites, all shared-internal), then `CreateAssessmentForm` → `AssessmentWorkflowParams` (10 sites).
11. Document M1/M2 to help future contributors understand the `Domain`/`ActionDomain` and `Capital`/`CapitalType` splits.
