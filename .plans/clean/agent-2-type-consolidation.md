# Agent 2 — Type Consolidation (Dry Run)

Scope: research only. No source edits. Monorepo root: `/Users/afo/Code/greenpill/green-goods`.

## Executive Summary

- `@green-goods/shared/types/` is well-organized and broadly canonical — Garden / Work / Action / Assessment / Hypercert / Vault types all live there with explicit barrel exports through `packages/shared/src/types/index.ts` and `packages/shared/src/index.ts`.
- The biggest concrete duplication is the ops runner types: `packages/ops/src/types.ts` and `packages/shared/src/types/ops.ts` both define `OpsJob`, plus parallel pairs (`JobStatus`/`OpsJobStatus`, `JobType`/`OpsJobType`, `JobLogEntry`/`OpsJobLogEntry`, `DeployRequest`/`OpsDeployRequest`). Two sources of truth that will drift.
- The agent package (`packages/agent/src/types.ts`) uses `string` for every Ethereum address (`User.address`, `PendingWork.gardenerAddress`, `PendingWork.gardenAddress`, `Feedback.gardenAddress`, `GardenInfo.address`, `SubmitWorkParams.gardenAddress`, `SubmitApprovalParams.gardenerAddress`). This is the largest single concentration of Rule 5 violations in the repo.
- `WorkCardItem.status` in `packages/client/src/components/Cards/Work/WorkCard.tsx:19` is a hand-inlined copy of the `WorkDisplayStatus` union from `packages/shared/src/types/domain.ts:338`.
- Medium: `Garden` in `packages/shared/src/stores/useAdminStore.ts:8` shadows the canonical `Garden` from `domain.ts`; naming clash (same name, different shape). The store exports it alongside the real `Garden` via `packages/shared/src/stores/index.ts:4`, so downstream imports from `@green-goods/shared` work only because the types re-export (line 731) wins the name resolution order.
- Admin has a broken re-export: `packages/admin/src/components/Assessment/index.ts:4` does `export type { CreateAssessmentForm } from "./CreateAssessmentSteps/shared"`, but `shared.tsx` does not export that type. Dead re-export that would fail strict isolatedModules checks.

---

## HIGH-CONFIDENCE findings (safe to fix)

### H1. `OpsJob` / `JobStatus` / `JobType` / `JobLogEntry` duplicated between shared and ops
- **Shared** (client-facing, used by admin UI via `@green-goods/shared`):
  - `packages/shared/src/types/ops.ts:8` — `OpsJobStatus`
  - `packages/shared/src/types/ops.ts:1` — `OpsJobType`
  - `packages/shared/src/types/ops.ts:10` — `OpsJobLogEntry`
  - `packages/shared/src/types/ops.ts:17` — `OpsJob` (logs is optional)
- **Ops server-side** (internal):
  - `packages/ops/src/types.ts:82` — `JobType`
  - `packages/ops/src/types.ts:83` — `JobStatus`
  - `packages/ops/src/types.ts:86` — `JobLogEntry`
  - `packages/ops/src/types.ts:93` — `OpsJob` (logs is required; same name, different shape)
- **Canonical location**: `packages/shared/src/types/ops.ts`.
- **Proposed fix**: ops should import the `Ops*`-prefixed types from shared. The type name collision on `OpsJob` is the most urgent — the two definitions diverge only on `logs` optionality.
- **Affected imports**: 3 files in `packages/ops/src/` import from `./types` (`job-queue.ts`, plus internal handlers). The ops package is an API server, so switching to shared is straightforward (no framework coupling).

### H2. `WorkCardItem.status` inlines the `WorkDisplayStatus` union
- **Duplicate**: `packages/client/src/components/Cards/Work/WorkCard.tsx:19` declares `status: "approved" | "rejected" | "pending" | "syncing" | "uploading" | "sync_failed" | "offline";`
- **Canonical**: `packages/shared/src/types/domain.ts:338` — `WorkDisplayStatus` with the exact same 7-member union. Doc comment already explicitly names this as the single source of truth ("all components … should reference this type rather than defining their own").
- **Proposed fix**: replace the inline union with `status: WorkDisplayStatus` and import `WorkDisplayStatus` from `@green-goods/shared` (already imported elsewhere in the client — `packages/client/src/views/Home/Garden/WorkViewSection.tsx:5`).
- **Affected import sites**: `WorkCardItem` is exported via `packages/client/src/components/Cards/index.ts:44`. Any consumer passing a `WorkCardItem` will benefit automatically.

### H3. `WorkStatus` deprecated alias in shared
- **Location**: `packages/shared/src/components/Cards/WorkCard/WorkCard.tsx:32` — `export type WorkStatus = WorkDisplayStatus;` with a `@deprecated` JSDoc.
- **Proposed fix**: grep for `WorkStatus` consumers and migrate them; then remove the alias. (Low-churn: the alias exists specifically so it can be removed once migration is complete.)

### H4. Broken re-export of `CreateAssessmentForm` in admin
- **Location**: `packages/admin/src/components/Assessment/index.ts:4` — `export type { CreateAssessmentForm } from "./CreateAssessmentSteps/shared";`
- **Reality**: `packages/admin/src/components/Assessment/CreateAssessmentSteps/shared.tsx` contains no `CreateAssessmentForm` export (only `LabeledField`, `ReviewRow`, `Section`, `DOMAIN_GUIDANCE`, etc.).
- **Consumers of `CreateAssessmentForm` in admin**: only `packages/admin/src/views/Garden/CreateAssessment.tsx:21` imports it — directly from `@green-goods/shared` via `type CreateAssessmentForm as WorkflowAssessmentForm`, not via the admin barrel.
- **Proposed fix**: delete line 4 of `packages/admin/src/components/Assessment/index.ts`. The admin codebase doesn't actually use its own re-export.

### H5. Shared `CreateAssessmentForm` is a deprecated alias; 2 deprecated alias pairs in `domain.ts`
- **Location**: `packages/shared/src/types/domain.ts:542` — `export type CreateAssessmentForm = AssessmentWorkflowParams;` (`@deprecated`)
- Ditto `packages/shared/src/types/domain.ts:390` — `export type WorkDraft = WorkSubmission;` (`@deprecated`)
- `WorkDraft` is still widely used (10+ internal files in `shared/src/hooks/work/*`, `shared/src/modules/work/*`, `shared/src/utils/eas/encoders.ts`). Migration required before deletion.
- **Proposed fix**: plan a migration to rename all 10+ internal `WorkDraft` usages to `WorkSubmission`; same for `CreateAssessmentForm` → `AssessmentWorkflowParams`. Then drop the alias lines plus their `index.ts:118` re-export. Low-priority — aliases carry a clear `@deprecated` marker.

### H6. `Garden` name clash in `useAdminStore.ts` shadowing the canonical `Garden`
- **Location**: `packages/shared/src/stores/useAdminStore.ts:8` defines `export type Garden = Pick<DomainGarden, ...>;` — a subset of the full `Garden`.
- **Re-export**: `packages/shared/src/stores/index.ts:4` re-exports this narrow `Garden` from the store.
- **Conflict**: `packages/shared/src/index.ts:731` re-exports the canonical `Garden` from types. The export order in `index.ts` means the domain `Garden` wins for consumers of `@green-goods/shared`, but the shadowed store `Garden` is a latent foot-gun for anyone who deep-imports the store.
- **Proposed fix**: rename the store type to `SelectedGarden` or `AdminGardenRef` — it's intentionally narrower than `Garden` (only the fields persisted to localStorage).
- **Affected sites**: only the store itself (`selectedGarden`, `setSelectedGarden`, `stores/index.ts`) and its 12+ hook consumers in `packages/shared/src/hooks/**` that pull `AdminState`. Rename is internal to shared.

---

## MEDIUM findings (need design judgment)

### M1. `Domain` enum vs `ActionDomain` string union — intentional but worth documenting
- `packages/shared/src/types/domain.ts:41` — numeric on-chain enum `Domain` (SOLAR=0, AGRO=1, EDU=2, WASTE=3).
- `packages/shared/src/types/hypercerts.ts:7` — string union `ActionDomain = "solar" | "waste" | "agroforestry" | "education" | "mutual_credit"`.
- There is a bridging function `domainToActionDomain()` at `packages/shared/src/modules/data/hypercerts-filters.ts:21`.
- **Assessment**: intentional split (on-chain uint8 vs hypercerts.org spec string). But `ActionDomain` adds `"mutual_credit"` which has no `Domain` mirror, and the naming does not make this difference legible (both are "domain"). Consider renaming `ActionDomain` to `HypercertDomain` or documenting explicitly that these are two universes.

### M2. `Capital` enum vs `CapitalType` string union — same pattern as M1
- `packages/shared/src/types/domain.ts:26` — numeric enum `Capital` (SOCIAL=0, MATERIAL=1, …, CULTURAL=7).
- `packages/shared/src/types/hypercerts.ts:33` — string union `CapitalType = "living" | "social" | "material" | …`.
- Same rationale as M1 (on-chain uint8 vs hypercert metadata spec). The `Capital` enum has only one external callsite: `packages/client/src/components/Cards/Action/ActionCard.stories.tsx:15`. Usage is asymmetric.
- **Proposed fix**: document both and consider renaming the string union `HypercertCapital` or `CapitalLabel`.

### M3. `ActionType` union — only defined, few direct consumers
- `packages/shared/src/types/hypercerts.ts:18` — 13-member string union.
- External callsites: `packages/admin/src/components/Hypercerts/Steps/MetadataEditor.tsx:49` (`CAPITALS: CapitalType[]`) and `AttestationSelector.tsx:3` (for `ActionDomain`). `ActionType` itself is referenced mostly in shared's hypercerts module.
- **Assessment**: partly dead code risk — worth a targeted usage audit to confirm any consumer actually instantiates `ActionType` instead of receiving it as `string`.

### M4. `HubPipelineStage` / `ActivityEvent` / `SortDirection` live in `packages/admin/src/views/Hub/hub.utils.ts`
- Lines 14–16 of that file: `HubPipelineStage = "work" | "assess" | "certify" | "history"`, `SortDirection = "newest" | "oldest"`, `ActivityEvent = ReturnType<typeof useGardenDerivedState>["activityEvents"][number]`.
- **Assessment**: pipeline stage & sort direction are purely admin UI concepts (Hub view state), so hand-rolled in admin is acceptable. But the `ActivityEvent` inferred type is derived from a shared hook — if that shape becomes first-class it should be promoted to `@green-goods/shared`. Flag only; no action needed unless Hub is refactored.

### M5. `GardenMember` in `packages/client/src/components/Features/Garden/Gardeners.tsx:29`
- `export type GardenMember = GardenerCard & { account: Address; isOperator: boolean; isGardener: boolean; };`
- **Assessment**: this augmentation is used only by client's Gardeners view. Admin's member management does not use it. Keeping it local is fine, but if the client and admin converge on a shared member list UI, promote to shared (`GardenMember` alongside `GardenerCard`).

### M6. `GardenInfo` (agent package) vs `Garden` (shared) — naming inconsistency flagged in the brief
- `packages/agent/src/types.ts:218` — `GardenInfo { exists: boolean; name?: string; address: string; }`.
- Shape is a narrow, agent-specific "does this garden exist?" response, not a full domain `Garden`. So the divergence is justified by scope, but `GardenInfo` is an imprecise name.
- **Proposed rename**: `GardenExistenceCheck` or `AgentGardenLookup` to avoid implying it's an alternate `Garden` shape. Also type `address` as `Address`, not `string` (covered in Address audit below).

### M7. Admin `Hypercerts/HypercertWizard/types.ts` — `HypercertCompletionData` / `HypercertWizardProps`
- `packages/admin/src/components/Hypercerts/HypercertWizard/types.ts:7` — `HypercertCompletionData` is a UI-callback payload specific to the admin wizard.
- **Assessment**: admin-only UI contract, correctly scoped. No action. The `txHash?: \`0x${string}\`` would be cleaner as `Hex` (from viem / shared) — minor.

---

## LOW findings

### L1. `ChainId = number` trivial alias
- `packages/shared/src/types/blockchain.ts:10` — adds no type safety over `number`.
- Candidates to make it meaningful: brand it (`type ChainId = number & { __chain: true };`) to prevent `chainId` ↔ `timestamp` mix-ups. Low priority; cost of churn likely > benefit.

### L2. `AdminSearchValue = string | number | boolean | null | undefined`
- `packages/shared/src/utils/navigation/admin-routes.ts:12` — a utility alias for URL search params. Useful for type discipline; keep.

### L3. `Garden.tokenID` (bigint, uppercase D) vs `HypercertRecord.tokenId` (bigint, lowercase d) vs `DeploymentConfig.rootGarden.tokenId` (number, lowercase d)
- `packages/shared/src/types/domain.ts:145` — `tokenID: bigint;`
- `packages/shared/src/types/hypercerts.ts:222` — `tokenId: bigint;`
- `packages/shared/src/types/blockchain.ts:35` — `tokenId: number;`
- `packages/shared/src/types/indexer-responses.ts:23` — `tokenID: string | bigint;`
- **Assessment**: casing is inconsistent and the `bigint` vs `number` split is a known footgun (number overflow on large tokenIds). These are different tokens conceptually (Garden ERC721 vs Hypercert ERC1155), but the casing convention should be unified. The Solidity generated code at `packages/shared/src/types/green-goods.d.ts` uses `tokenID` — that likely forces the domain `Garden` casing. Consider standardizing on `tokenID` everywhere or typing `rootGarden.tokenId` as `bigint`.

### L4. `Job<T>` in shared vs `OpsJob` in ops — different concepts, same noun
- `packages/shared/src/types/job-queue.ts:21` — generic offline work queue job (`synced: boolean`, `userAddress`, `attempts`).
- `packages/shared/src/types/ops.ts:17` — ops runner deployment job.
- Not a duplication; just a name overload. Consider documenting with a type-level comment to prevent confusion, or rename the offline queue to `QueuedJob` / `OfflineJob`. Low-priority.

---

## Address vs string audit

Files where a `string` likely represents an Ethereum address and should be `Address` (from viem, barrelled by `@green-goods/shared`).

**Agent package — largest concentration of violations:**
- `packages/agent/src/types.ts:135` — `User.address: string`
- `packages/agent/src/types.ts:136` — `User.currentGarden?: string`
- `packages/agent/src/types.ts:145` — `CreateUserInput.address: string`
- `packages/agent/src/types.ts:146` — `CreateUserInput.currentGarden?: string`
- `packages/agent/src/types.ts:177` — `PendingWork.gardenerAddress: string`
- `packages/agent/src/types.ts:180` — `PendingWork.gardenAddress: string`
- `packages/agent/src/types.ts:209` — `Feedback.gardenAddress?: string`
- `packages/agent/src/types.ts:221` — `GardenInfo.address: string`
- `packages/agent/src/types.ts:226` — `SubmitWorkParams.gardenAddress: string`
- `packages/agent/src/types.ts:241` — `SubmitApprovalParams.gardenerAddress: string`

**Shared package — borderline cases (some legitimately accept raw user input):**
- `packages/shared/src/types/ops.ts:56` — `OpsRunnerChallengeResponse.address: string`
- `packages/shared/src/types/ops.ts:63` — `OpsRunnerVerifyResponse.address: string`
- `packages/shared/src/types/ops.ts:69` — `OpsRunnerSession.address: string`
- `packages/shared/src/types/blockchain.ts:13-14` — `EAS.address: string`, `SCHEMA_REGISTRY.address: string` (inside `NetworkContracts`). Arguably should be `Address`.
- `packages/shared/src/providers/Work.tsx:45, 91` — `gardenAddress: string | null` (prop shape).
- `packages/shared/src/stores/useAdminStore.ts:58` — `getAdminGardenScopeKey(address: string | null | undefined, ...)`. Acceptable as a scope-key helper (normalizes to lowercase).
- `packages/shared/src/stores/useCreateGardenStore.ts:44–97` — `addGardener(address: string)`, `addOperator(address: string)`, `sanitizeAddress(address: string): string`, `isValidAddress(address: string): boolean`. Legitimate — validators accept raw user input before coercing.
- `packages/shared/src/utils/blockchain/address.ts:37,54,75,99,100,111,122` — `address: string | undefined | null`. Legitimate — validators/normalizers.
- `packages/shared/src/utils/storage/avatar-cache.ts:14,59,81` — `address: string`. Cache-key helper, acceptable but could be tighter.
- `packages/shared/src/hooks/auth/useUser.ts:40,50` — `{ address: string }`. User identity — should be `Address`.
- `packages/shared/src/stores/useHypercertWizardStore.ts:210` — `toDraft(gardenId, operatorAddress: string)`. Should be `Address`.
- `packages/shared/src/hooks/garden/createGardenOperation.ts:29,41` — `gardenAddress: string`. Should be `Address`.

**Admin package:**
- `packages/admin/src/components/Garden/GardenProfileModal.tsx:18` — `tokenAddress: string` inside an inline `garden` prop type. Should be `Address` (the same file already imports `Address`).

**Client package:**
- `packages/client/src/views/Home/WorkDashboard/work-dashboard-utils.ts:60` — `gardenAddress: string` param. Compatible with `Address`, but tighten.
- `packages/client/src/views/Home/WorkDashboard/work-dashboard-utils.ts:72, 83` — `CompletedApproval.gardenerAddress: string`, `ReceivedApproval.gardenerAddress: string` (internal file-private interfaces, but still).

**Not violations / intentional:**
- `packages/indexer/src/handlers/types.ts` — Envio codegen emits `string` for bytes20 addresses; indexer code does not import shared types. Intentional boundary.
- `packages/shared/src/__mocks__/**` — test mocks, not production code.
- `packages/shared/src/config/query-keys/**` — `gardenAddress: string` function params accept any stringifiable key. Borderline; tightening to `Address` would force callers to pre-validate.

---

## Explicit non-findings (look duplicated but are intentional)

1. **`packages/indexer/generated/src/Types.gen.ts`** — `export type Garden = garden;`, `export type Gardener = gardener;`, etc. These are Envio-generated GraphQL entity types. Leave alone — regenerated on schema changes.
2. **`IndexerGarden` (shared) vs `Garden` (shared)** — `IndexerGarden` at `packages/shared/src/types/indexer-responses.ts:19` is a wire-format shape with `tokenID: string | bigint` and nullable arrays; `Garden` at `packages/shared/src/types/domain.ts:141` is the normalized domain entity. Boundary by design. The mapping between them lives in `packages/shared/src/modules/data/greengoods.ts`.
3. **`EASWork` / `EASWorkApproval` / `EASGardenAssessment`** vs domain `Work` / `WorkApproval` / `GardenAssessment` — EAS types are the decoded-attestation shape (still contains `confidence: number`, `verificationMethod: number` as raw uint8). Domain types add derived fields. Do not merge.
4. **`Capital` (enum) and `CapitalType` (string union)** — on-chain uint8 vs hypercerts.org metadata-spec string. Not duplicates; conceptually distinct serializations.
5. **`Domain` (enum) and `ActionDomain` (string union)** — same rationale as Capital. Also `ActionDomain` includes `"mutual_credit"` which has no `Domain` counterpart.
6. **`WorkCardProps` / `MinimalWorkCardProps` (client) vs `WorkCardProps` (shared)** — client's wrapper composes over the shared primitive and adds client-specific concerns (draft rendering, offline-queue badges).
7. **`GardenCardProps` (client) extending `SharedGardenCardProps`** — `packages/client/src/components/Cards/Garden/GardenCard.tsx:21`. Correctly uses `Omit<…> & ClientExtras` pattern.
8. **`TransactionStatus` / `TransactionInfo` in `useAdminStore.ts`** — narrow in-memory admin tx tracking; unrelated to `OpsJobStatus` or contract transaction flows. No consolidation needed.
9. **Agent's `Platform` / `InboundMessage` / `OutboundResponse`** — agent bot domain, lives in agent. Not cross-cutting.
10. **Viem's `Account` type appearing in grep hits** — those are from `node_modules/viem/accounts/types.ts`, not source. Ignore.

---

## Suggested remediation order

1. Fix H4 (delete dead re-export in admin) — zero-risk one-line edit.
2. Fix H2 (replace `WorkCardItem.status` inline union with `WorkDisplayStatus`).
3. Unify the Address audit hits in `packages/agent/src/types.ts` — 10 lines, all local to one file.
4. Resolve H6 (rename store `Garden` to `SelectedGarden` or `AdminGardenRef`) — touches `useAdminStore.ts`, `stores/index.ts`, and ~12 hooks consuming `AdminState`.
5. Consolidate H1 (ops runner types). Choose: have `packages/ops` import from `@green-goods/shared`, or keep the boundary explicit by renaming ops-side types (`JobStatus` → `OpsRunnerJobStatus`) so the collision disappears.
6. Chip away at H5 (`WorkDraft` → `WorkSubmission` migration; `CreateAssessmentForm` → `AssessmentWorkflowParams`).
7. Document M1/M2 to help future contributors understand the `Domain`/`ActionDomain` and `Capital`/`CapitalType` splits.
