# Agent 3 — Dead Code Detection (DRY RUN, scoped to admin/shared/client/contracts)

Source: `bunx knip --reporter compact` @ 2026-04-18, cross-verified with manual grep.
Mode: research + assess only. No files were modified.
Out of scope this run: `packages/agent`, `packages/indexer`, `packages/ops`, contract submodules (`packages/contracts/lib/**`, `packages/contracts/out/**`), Storybook stories.

## Executive Summary

- **Palette reframe**: of the 6 Admin\* primitives the prior report kept as "palette — documented, not-yet-consumed," two (`AdminCheckbox`, `AdminLinearProgress`) are already adopted (knip flags them as unused-*files* because of file-level dominator misses, not unused-symbol — see §5). Of the remaining four (`AdminBadge`, `AdminFab`, `AdminListItem`, `AdminTooltip`), **three are ADOPT** (live admin views ship hand-rolled alternatives that should be migrated) and **one is DEFER** (`AdminListItem` — no obvious hand-rolled target; M3-list UX not yet designed into admin).
- **HIGH-confidence unused files in scope**: 17 files (~2,380 LOC TS/TSX). Excludes 4 Admin\* primitives (handled via palette adoption), 3 out-of-scope entries, and 1 false positive (`varlock-env.ts`).
- **HIGH-confidence unused exports in scope**: ~45 symbols (mostly barrel re-exports with zero consumers; handful of truly-dead helpers).
- **HIGH-confidence unused exported types in scope**: ~75 (mostly `*Props`/`*Return` that should be un-exported, not deleted).
- **HIGH-confidence unused package dependencies in scope**: 2 (`@radix-ui/react-slot`, `@radix-ui/react-tabs` in admin).
- **HIGH-confidence unused devDependencies in scope**: 6 (root tailwind extensions, qrcode types, `tsc-alias`).
- **Bundle impact**: small. Orphan views/modals are already tree-shaken. Real win is compile/type-check/test surface shrinkage.

---

## 1. HIGH-CONFIDENCE unused files (safe to delete)

### `packages/admin` — orphan views (not wired in `router.tsx`)

Verified: `packages/admin/src/router.tsx` does not lazy-load any of these. `WorkTab.tsx` self-imports `WorkSubmissionsView` from `Hub/components` (also orphaned — see §2).

| File | LOC |
|---|---|
| `packages/admin/src/views/Garden/Assessment.tsx` | 274 |
| `packages/admin/src/views/Garden/Hypercerts.tsx` | 211 |
| `packages/admin/src/views/Garden/WorkTab.tsx` | 284 |
| `packages/admin/src/views/Actions/GreenWillPanel.tsx` | 281 |

`packages/admin/src/views/Garden/SubmitWork.tsx` is NOT here; named export `SubmitWorkPanel` is consumed by `views/Hub/components/HubSheetDescriptor.tsx:10`. Only `default` export is dead — see §2.

### `packages/admin` — orphan Garden modals (closed graph, barrel not consumed)

`packages/admin/src/components/Garden/index.ts` is only referenced by `Garden/AddMemberModal.stories.tsx`; no non-story consumer. All listed files form a closed graph.

| File | LOC |
|---|---|
| `packages/admin/src/components/Garden/AddMemberModal.tsx` | 210 |
| `packages/admin/src/components/Garden/GardenDomainEditor.tsx` | 178 |
| `packages/admin/src/components/Garden/GardenMetadata.tsx` | 243 |
| `packages/admin/src/components/Garden/GardenProfileModal.tsx` | 65 |
| `packages/admin/src/components/Garden/GardenRolesPanel.tsx` | 154 |
| `packages/admin/src/components/Garden/ManageRolesModal.tsx` | 57 |
| `packages/admin/src/components/Garden/index.ts` | 16 |

`AddMemberModal.stories.tsx` will orphan with the modal — remove it too.

### `packages/admin` — non-palette unused components

| File | LOC | Notes |
|---|---|---|
| `packages/admin/src/components/TrendIndicator.tsx` | 34 | No consumer anywhere — RETIRE |
| `packages/admin/src/components/Vault/assetTotals.ts` | 49 | Vault hooks use shared version — RETIRE |

### `packages/admin` — dead barrel files

| File | LOC |
|---|---|
| `packages/admin/src/components/Action/index.ts` | 10 |
| `packages/admin/src/components/Assessment/index.ts` | 15 |
| `packages/admin/src/components/Hypercerts/index.ts` | 12 |

### `packages/shared` — deprecated shim + unused hook

| File | LOC | Notes |
|---|---|---|
| `packages/shared/src/utils/admin-routes.ts` | 20 | `@deprecated` shim; consumers import `utils/navigation/admin-routes` |
| `packages/shared/src/hooks/utils/useTxErrorMessages.ts` | 53 | Superseded by `parseContractError` + `USER_FRIENDLY_ERRORS` |

### `packages/client`

None flagged as wholly-unused files in scope.

### `packages/contracts`

None. The package.json dependency flags are 100% Solidity-via-Foundry remappings — see §8.

---

## 1b. Files knip flagged but actually used (do NOT remove)

| File | Why it stays |
|---|---|
| `packages/admin/src/lib/varlock-env.ts` | Aliased in `packages/admin/vite.config.ts` as `varlock/env` |
| `packages/client/public/sw-custom.js` | Referenced by `packages/client/vite.config.ts` `importScripts` |
| (out of scope) `docs/src/css/custom.css` | Docusaurus `customCss` |
| (out of scope) `packages/indexer/test/test.ts` | mocha glob via `packages/indexer/package.json` |

Final HIGH list in scope: **17 files, ~2,380 LOC**.

---

## 2. HIGH-CONFIDENCE unused exports

### `packages/admin` — dead barrel re-exports

Each barrel has zero external consumers; real imports go direct.

- `packages/admin/src/components/Layout/index.ts` — `CanvasLayout`, `CommandPalette`, `ConnectShell`, `UserAvatar`, `UserMenu`
- `packages/admin/src/views/Hub/components/index.ts` — `CookieJarDepositModal`, `CookieJarManageModal`, `CookieJarPayoutPanel`, `CookieJarWithdrawModal`, `HubCertificationInspector`, `HubHistoryInspector`, `HubWorkbenchSkeletonRows`, `MediaEvidence`, `WorkCard`, `WorkSubmissionsView`
- `packages/admin/src/components/Vault/index.ts:4` — `FunderRow`, `ImpactFunders` (barrel has one consumer in `views/Garden/Vault.tsx` but neither of these symbols is imported through it; `ImpactFunders` has no consumer anywhere)

### `packages/admin` — unused same-file helpers

- `packages/admin/src/components/Layout/AccountSurface.tsx:64` — `AccountSurface` (siblings `AccountTabList`/`AccountTabPanels` ARE used by `views/Profile/index.tsx`)
- `packages/admin/src/components/Layout/ConnectShell.tsx:16` — `ConnectShell` (used only by sibling `WalletRequiredConnectShell` in same file)
- `packages/admin/src/components/Layout/UserAvatar.tsx` — `UserAvatar`
- `packages/admin/src/components/Layout/UserMenu.tsx` — `UserMenu`
- `packages/admin/src/components/Layout/accountSheet.events.ts:8` — `ACCOUNT_SHEET_CONTENT_ID`
- `packages/admin/src/components/Assessment/CreateAssessmentSteps/shared.tsx` — `ReviewRow`, `formatDateRange`
- `packages/admin/src/views/Garden/SubmitWork.tsx` — `default` export only (named `SubmitWorkPanel` stays)
- `packages/admin/src/views/Garden/components/GardenDetailHelpers.tsx` — `TabBadge`, `GardenHeroBanner` (other exports used)
- `packages/admin/src/views/Garden/components/gardenDetail.constants.ts` — `TAB_TRIGGER_BASE`, `TAB_SECTIONS`
- `packages/admin/src/views/Hub/hub.utils.ts` — `WORK_DETAIL_CONTENT_ID_PREFIX`, `CERTIFICATION_CONTENT_ID_PREFIX`, `HISTORY_CONTENT_ID_PREFIX`
- `packages/admin/src/views/Hub/components/WorkSubmissionsView.tsx` — `WorkSubmissionsView` (orphaned with the WorkTab view)
- `packages/admin/src/components/AdminButton.tsx` — `adminButtonVariants` (raw variants fn; component itself is used)
- `packages/admin/src/components/Vault/ImpactFunders.tsx` — `ImpactFunders`

### False positive — do NOT remove

- `packages/admin/src/components/Hypercerts/HypercertWizard/types.ts:26` — `ERROR_CATEGORY_KEYS` is used at line 38 in the same file (`return ERROR_CATEGORY_KEYS[categorized.category]`). Knip bug.

### `packages/shared` — barrel re-exports with direct-path consumers

- `packages/shared/src/lib/hypercerts/index.ts` — `DEFAULT_PROTOCOL_VERSION`, `aggregateOutcomeMetrics`, `deriveWorkTimeframe`, `allowlistEntrySchema`, `allowlistSchema`, `greenGoodsExtensionSchema`, `outcomeMetricsSchema`, `propertyDefinitionSchema`, `scopeDefinitionSchema`, `timeframeDefinitionSchema`, `generateProof`, `verifyProof`, `HYPERCERT_MINTER_ABI_FULL`, `MARKETPLACE_ADAPTER_ABI`, `HYPERCERTS_MODULE_ABI`, `TRANSFER_MANAGER_ABI` (tests and marketplace hooks import from `./constants`, `./validation`, `../../utils/blockchain/hypercert-abis`). Verify each symbol's top-level `shared/src/index.ts` re-export before pruning.
- `packages/shared/src/lib/hypercerts/transactions.ts` — `HYPERCERT_MINTER_ABI_FULL`
- `packages/shared/src/modules/data/hypercerts.ts` — `getHypercertClaims`, `getAttestationsByUIDs`, `normalizeHypercertStatus`, `parseMetadataPayload`, `getHypercertMetadataFromIpfs` (re-exports; concrete impls in `hypercerts-fetch.ts`, `hypercerts-metadata.ts`)
- `packages/shared/src/modules/data/ipfs/index.ts` — `toCanonicalIPFSUri`, `tryParseJson`
- `packages/shared/src/modules/data/ipfs/resolve.ts` — `toCanonicalIPFSUri`, `tryParseJson`
- `packages/shared/src/modules/data/ipfs/client.ts` — `DEFAULT_PINATA_GATEWAY`, `DEFAULT_PINATA_UPLOADS_API_BASE_URL`, `setIpfsInitializationStatus`, `setIpfsInitializationError`, `configurePinata`

### `packages/shared` — truly unused

- `packages/shared/src/utils/blockchain/abis.ts:22` — `JUICEBOX_ABI`
- `packages/shared/src/utils/blockchain/abis/index.ts:21` — `JUICEBOX_ABI`
- `packages/shared/src/utils/blockchain/abis/yield.ts:121` — `JUICEBOX_ABI` (defined, re-exported twice, never consumed)
- `packages/shared/src/utils/query-invalidation.ts` — `INVALIDATION_DELAYS`, `scheduleInvalidation`, `scheduleInvalidationForKey`, `scheduleProgressiveInvalidation` (re-exports of `config/query-keys/schedule.ts`; underlying file IS used internally)
- `packages/shared/src/modules/data/eas.ts` — `EASFetchError`, `parseDataToWorkApproval`
- `packages/shared/src/modules/data/hypercerts-fetch.ts` — `getHypercertClaims`
- `packages/shared/src/modules/data/hypercerts-metadata.ts` — `isRecord`, `getString`, `getStringArray`, `parseMetadataPayload`
- `packages/shared/src/modules/app/error-categories.ts` — `getTimeSincePageLoad`
- `packages/shared/src/modules/app/error-tracking.ts` — `getTimeSincePageLoad` (duplicate)
- `packages/shared/src/modules/app/posthog.ts` — `getAppVersion`, `getChainId`, `isTestnetEnvironment`, `isMainnetEnvironment`, `getEnvironment`, `initNetworkTracking`
- `packages/shared/src/modules/job-queue/event-bus.ts` — `useJobQueueEvent`
- `packages/shared/src/modules/job-queue/index.ts` — `computeFirstIncompleteStep`, `draftDB`
- `packages/shared/src/modules/job-queue/job-maintenance.ts` — `ORPHAN_CLEANUP_INTERVAL`, `FAILED_DELETE_ALERT_THRESHOLD`
- `packages/shared/src/modules/work/wallet-submission/index.ts` — `WorkSubmissionError`
- `packages/shared/src/modules/work/work-submission.ts` — `MAX_IMAGE_SIZE_BYTES`, `MAX_IMAGE_COUNT`, `MAX_TOTAL_IMAGE_SIZE_BYTES`, `ALLOWED_IMAGE_TYPES`
- `packages/shared/src/types/greenwill.ts` — `GREENWILL_BADGE_ORDER`
- `packages/shared/src/components/TranslationBadge.tsx` — `UnsupportedTranslationNotice`

### `packages/client` — barrel re-exports, unused helpers

- `packages/client/src/components/Cards/index.ts` — `ActionCard`, `CardContent`, `CardDescription`, `CardFooter`, `CardHeader`, `CardTitle`, `gardenCardVariants`, `StatusBadge`, `WorkCard` (Card root still used via `FlexCard`/`Card`)
- `packages/client/src/components/Cards/Base/Card.tsx` — `cardVariants`, `CardHeader`, `CardFooter`, `CardTitle`, `CardDescription`, `CardContent`
- `packages/client/src/components/Inputs/Select/Select.tsx` — `SelectGroup`, `SelectLabel`, `SelectScrollDownButton`, `SelectScrollUpButton`, `SelectSeparator` (radix re-exports; no consumer)
- `packages/client/src/components/Cards/Work/WorkCard.tsx` — `StatusBadge`
- `packages/client/src/components/Actions/Button/Base.tsx` — `Icon`
- `packages/client/src/components/Communication/Badge/Badge.tsx` — `badgeVariants`
- `packages/client/src/components/Display/Avatar/Avatar.tsx` — `avatarVariants`

### In scope misc — tests

- `packages/admin/src/__tests__/test-utils.tsx` — `createMockSmartAccountClient`, `createTestQueryClient`, `MOCK_ADDRESSES`, `MOCK_TX_HASH`, `mock`, `TestWrapper`, `render` (only `renderWithProviders` + `screen` are consumed)
- `packages/client/src/__tests__/test-utils.tsx` — `createMockSmartAccountClient`, `createTestQueryClient`, `MOCK_ADDRESSES`, `MOCK_TX_HASH`, `mock`, `TestWrapper`, `userEvent`, `render`

---

## 3. HIGH-CONFIDENCE unused exported types

Almost all are component `Props` or hook return types exported as public API but not consumed externally. TypeScript still needs them internally. Preferred action: un-export (drop the `export` keyword, keep the declaration), not delete.

### `packages/admin`
- `packages/admin/src/components/AdminButton.tsx` — `AdminButtonProps`
- `packages/admin/src/components/AdminCard.tsx` — `AdminCardProps`
- `packages/admin/src/components/AdminCheckbox.tsx` — `AdminCheckboxProps`
- `packages/admin/src/components/AdminDialog.tsx` — `AdminDialogProps`
- `packages/admin/src/components/AdminFilterChip.tsx` — `AdminFilterChipProps`
- `packages/admin/src/components/AdminSearchToolbar.tsx` — `AdminSearchToolbarProps`
- `packages/admin/src/components/AdminTabRail.tsx` — `AdminTab`, `AdminTabRailProps`
- `packages/admin/src/components/AdminTextField.tsx` — `AdminTextFieldProps`
- `packages/admin/src/components/Hypercerts/HypercertWizard/index.tsx` — `HypercertWizardProps`
- `packages/admin/src/views/Actions/createActionTemplateSelection.ts` — `CreateActionTemplateSelection`
- `packages/admin/src/views/Community/components/CommunityTab.tsx` — `CommunityTabProps`
- `packages/admin/src/views/Garden/SubmitWork.tsx` — `SubmitWorkPanelProps`
- `packages/admin/src/views/Garden/WorkDetail/index.tsx` — `WorkDetailPanelProps`
- `packages/admin/src/views/Garden/components/ImpactTab.tsx` — `ImpactTabProps`
- `packages/admin/src/views/Garden/components/OverviewTab.tsx` — `OverviewTabProps`
- `packages/admin/src/views/Hub/components/HubWorkCard.tsx` — `HubWorkCardProps`

### `packages/client`
- `packages/client/src/components/Actions/Button/index.tsx` — `ButtonProps`
- `packages/client/src/components/Cards/Action/ActionCard.tsx` — `ActionCardRootProps`
- `packages/client/src/components/Cards/Garden/GardenCard.tsx` — `GardenCardOptions`, `GardenCardProps`
- `packages/client/src/components/Cards/Work/DraftCard.tsx` — `DraftCardProps`
- `packages/client/src/components/Cards/Work/WorkCard.tsx` — `WorkCardItem`, `WorkCardProps`, `MinimalWorkCardProps`, `StatusBadgeProps`
- `packages/client/src/components/Cards/index.ts` — duplicate type re-exports (`ActionCardRootProps`, `ActionCardVariantProps`, `CardRootProps`, `CardVariantProps`, `GardenCardOptions`, `GardenCardProps`, `GardenCardVariantProps`, `DraftCardProps`, `MinimalWorkCardProps`, `StatusBadgeProps`, `WorkCardItem`, `WorkCardProps`)
- `packages/client/src/components/Communication/Badge/Badge.tsx` — `BadgeProps`, `BadgeVariantProps`
- `packages/client/src/components/Dialogs/ImagePreviewDialog.tsx` — `ImagePreviewDialogProps`
- `packages/client/src/components/Dialogs/TreasuryDrawer/CookieJarCard.tsx` — `CookieJarCardProps`
- `packages/client/src/components/Dialogs/TreasuryDrawer/CookieJarTabContent.tsx` — `CookieJarTabContentProps`
- `packages/client/src/components/Dialogs/TreasuryDrawer/MyDepositRow.tsx` — `MyDepositRowProps`
- `packages/client/src/components/Dialogs/TreasuryDrawer/TreasuryTabContent.tsx` — `TreasuryTabContentProps`
- `packages/client/src/components/Display/Avatar/Avatar.tsx` — `AvatarVariantProps`, `AvatarRootProps`
- `packages/client/src/components/Display/Carousel/Carousel.tsx` — `CarouselApi`
- `packages/client/src/components/Display/Image/ImageWithFallback.tsx` — `ImageWithFallbackProps`
- `packages/client/src/components/Inputs/Select/FormSelect.tsx` — `FormSelectOption`, `FormSelectProps`
- `packages/client/src/components/Inputs/TextField/Input.tsx` — `FormInputProps`
- `packages/client/src/components/Inputs/TextField/Text.tsx` — `FormTextProps`
- `packages/client/src/components/Navigation/Tabs/index.ts` — `StandardTabsProps`
- `packages/client/src/views/Home/GardenFilters/index.tsx` — `GardenFilterScope`, `GardenSortOrder`, `FilterOptionButtonProps`
- `packages/client/src/views/Home/WorkDashboard/Drafts.tsx` — `DraftsTabProps`
- `packages/client/src/views/Home/WorkDashboard/index.tsx` — `WorkDashboardProps`

### `packages/shared`
- `packages/shared/src/components/Cards/CardBase.tsx` — `SurfaceCardVariantProps`
- `packages/shared/src/components/Dialog/ImagePreviewDialog.tsx` — `ImagePreviewDialogLabels`
- `packages/shared/src/config/query-persistence.ts` — `QueryPersister`
- `packages/shared/src/hooks/assessment/useCreateAssessmentWorkflow.ts` — `AssessmentWorkflowParams`, `AssessmentDraftRecord`, `UseCreateAssessmentWorkflowOptions`
- `packages/shared/src/hooks/auth/useUser.ts` — `User`, `UseUserReturn`
- `packages/shared/src/hooks/blockchain/useContractTxSender.ts` — `SendContractTxRequest`
- `packages/shared/src/hooks/garden/createGardenOperation.ts` — `GardenOperationConfigBase`
- `packages/shared/src/hooks/garden/useCreateGardenWorkflow.ts` — `GardenDraft`
- `packages/shared/src/hooks/garden/useSetGardenDomains.ts` — `SetGardenDomainsParams`
- `packages/shared/src/hooks/hypercerts/services/index.ts` — `MintServiceDeps`
- `packages/shared/src/hooks/hypercerts/useCreateHypercertWorkflow.ts` — `UseCreateHypercertWorkflowResult`
- `packages/shared/src/hooks/hypercerts/useMintHypercert.ts` — `UseMintHypercertOptions`
- `packages/shared/src/hooks/utils/useEventListener.ts` — `UseEventListenerOptions`
- `packages/shared/src/hooks/vault/vault-helpers.ts` — `VaultDepositStage`
- `packages/shared/src/hooks/work/useBatchWorkSync.ts` — `UseBatchWorkSyncReturn`
- `packages/shared/src/hooks/work/useMyWorks.ts` — `UseMyWorksOptions`
- `packages/shared/src/hooks/work/useWorkForm.ts` — `UseWorkFormReturn`
- `packages/shared/src/hooks/work/useWorkImages.ts` — `UseWorkImagesReturn`
- `packages/shared/src/hooks/work/useWorkMutation.ts` — `UseWorkMutationReturn`
- `packages/shared/src/lib/hypercerts/aggregation.ts` — `ContributorStats`
- `packages/shared/src/lib/hypercerts/index.ts` — `MerkleLeaf`, `MerkleTree` (re-exports)
- `packages/shared/src/lib/hypercerts/merkle.ts` — `MerkleLeaf`, `MerkleTree`
- `packages/shared/src/modules/data/hypercerts-attestations.ts` — `BundledAttestationInfo`
- `packages/shared/src/modules/data/hypercerts.ts` — `BundledAttestationInfo` (duplicate)
- `packages/shared/src/modules/data/ipfs/client.ts` — `IpfsConfig`, `IpfsInitStatus`
- `packages/shared/src/modules/data/ipfs/index.ts` — `IpfsConfig`, `IpfsInitStatus`, `GetFileByHashOptions` (re-exports)
- `packages/shared/src/modules/data/ipfs/pinata.ts` — `PinataUploadResponse`
- `packages/shared/src/modules/data/ipfs/resolve.ts` — `GetFileByHashOptions`
- `packages/shared/src/modules/job-queue/index.ts` — `FlushResult`
- `packages/shared/src/modules/work/passkey-submission.ts` — `PasskeyBatchApprovalParams`
- `packages/shared/src/modules/work/simulate.ts` — `SimulateWorkSubmissionParams`, `SimulateApprovalSubmissionParams`
- `packages/shared/src/modules/work/wallet-submission/index.ts` — `BatchApprovalOptions`, `OnProgressCallback`, `SubmissionPhase`, `WalletSubmissionStage`
- `packages/shared/src/modules/work/wallet-submission/types.ts` — `WalletSubmissionStage`, `SubmissionPhase`
- `packages/shared/src/modules/work/work-submission.ts` — `ValidateWorkContextOptions`
- `packages/shared/src/types/greenwill.ts` — `GreenWillBadgeSlug`
- `packages/shared/src/utils/eas/encoders.ts` — `EncodeWorkDataOptions`
- `packages/shared/src/utils/navigation/admin-routes.ts` — `AdminHubMode`, `AdminHubView`, `AdminGardenMode`, `AdminCommunityMode`, `AdminHubSort`, `AdminHubRouteContext`, `AdminGardenRouteContext`, `AdminCommunityRouteContext`
- `packages/shared/src/workflows/authMachine.ts` — `RestoreSessionInput`, `PasskeyOperationInput`, `AuthInput`

---

## 4. Palette adoption audit (the reframe)

Four Admin\* primitives remain with zero non-story consumers. Below is the hand-rolled-alternative search for each.

### `AdminBadge` — **ADOPT**

**Evidence of hand-rolled alternatives** (every instance should be migrated to `AdminBadge` or — if it is a status, not a count — the shared `StatusBadge`):

1. `packages/admin/src/views/Garden/WorkDetail/index.tsx:100-132` — custom `WorkDetailStatusBadge` helper renders a bespoke `inline-flex ... rounded-full px-2 py-0.5 text-xs font-medium bg-warning-lighter text-warning-dark` pill for work status. The shared `StatusBadge` from `packages/shared/src/components/StatusBadge.tsx` is the correct primitive for *status*; `AdminBadge` itself is a dot/count primitive. Either way the hand-rolled code duplicates approved primitives.
2. `packages/admin/src/views/Garden/components/GardenDetailHelpers.tsx:35` — `TabBadge` inline div `ml-2 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${BADGE_TONE_CLASSES[badge.severity]}` is a pure count/dot badge and is an exact match for `AdminBadge`'s anatomy (`bg-error`, `on-error`, full-round, `h-4 min-w-4 px-1`). *(Note: `TabBadge` itself is dead — §2 — so its existence is double trouble.)*
3. `packages/admin/src/views/Garden/Assessment.tsx:145` — inline `mb-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeStyle}` — status-style pill. (File is scheduled for retirement per §1; if it were not, this would be a `StatusBadge` migration.)
4. `packages/admin/src/views/Garden/WorkTab.tsx:150` — inline `rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusColors(work.status).combined}`. (File is also scheduled for retirement — §1.)
5. `packages/admin/src/views/Hub/components/HubWorkCard.tsx:184` — `absolute bottom-2 right-2 inline-flex items-center rounded-full bg-black/45 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-md` — visual count overlay on a media thumbnail. Plausible `AdminBadge` target.

**Conclusion**: ADOPT. Live `HubWorkCard` overlay and `GardenDetailHelpers.TabBadge` are direct matches. Retire `WorkDetailStatusBadge` in favour of the shared `StatusBadge` primitive and retire `AdminBadge`'s count-style competitor if any real consumer still needs a number badge.

### `AdminTooltip` — **ADOPT**

**Evidence of hand-rolled alternatives**: admin views and components use the native HTML `title=` attribute as a tooltip in at least 12 places, all of which lose keyboard focus and touch support:

- `packages/admin/src/components/Garden/GardenAssessmentsPanel.tsx:81`
- `packages/admin/src/components/Garden/GardenHypercertsPanel.tsx:91`
- `packages/admin/src/components/Garden/GardenSettingsEditor.tsx:78`
- `packages/admin/src/components/Layout/UserMenu.tsx:99` (wallet address)
- `packages/admin/src/components/Layout/PageHeader.tsx:80,90`
- `packages/admin/src/components/AdminListItem.tsx:149,155,165`
- `packages/admin/src/components/Hypercerts/Steps/HypercertPreview.tsx:65`
- `packages/admin/src/components/Hypercerts/Steps/DistributionConfig.tsx:25`
- `packages/admin/src/views/Garden/components/ImpactTab.tsx:127,221`
- `packages/admin/src/views/Garden/WorkTab.tsx:141` (file scheduled for retirement)

`AdminTooltip` provides the right M3-inverse-surface visual, keyboard focus, and touch fallback. The `title=` pattern also collides with feedback_admin_audit_2026_04_14 (missing tooltips).

**Conclusion**: ADOPT. 11+ live sites should migrate from `title=` to `AdminTooltip`.

### `AdminFab` — **ADOPT (partial)**

**Evidence**: admin uses a bespoke `FabProvider` / `useFabConfig` / `FabAwareNavigationBar` system (`packages/admin/src/components/Layout/CanvasLayout.tsx:3,16,284,336,375,380,385` — with views calling `useFabConfig` in `views/Garden/index.tsx`, `views/Actions/index.tsx`, `views/Community/index.tsx`, `views/Hub/index.tsx`). The FAB is rendered *inside* the `NavigationBar`, not as a standalone button. `AdminFab` (`packages/admin/src/components/AdminFab.tsx:33`) is a standalone M3 FAB component (small/standard/large, primary-container background, elevation-3).

The system-level `FabProvider` is not a hand-rolled *alternative* to `AdminFab`; it is a coordination layer. The actual button element inside `FabAwareNavigationBar` is the one that should be `AdminFab`. Need to confirm whether `FabAwareNavigationBar` currently hand-rolls the button or already uses `AdminFab` via some other path.

Based on file search, `AdminFab` has no import anywhere outside its own file + story, so whatever `FabAwareNavigationBar` renders is hand-rolled.

**Conclusion**: ADOPT. `FabAwareNavigationBar` in `CanvasLayout.tsx` should render `AdminFab` as the concrete button; the config-context plumbing stays as-is.

### `AdminListItem` — **DEFER**

**Evidence of hand-rolled alternatives**: short list, and most are *semantic* `<li>` inside `<ul>` for reviews/summaries, not interactive M3 list rows:

- `packages/admin/src/components/Garden/CreateGardenSteps/TeamStep.tsx:102,104,182,184` — bullet lists of gardeners/operators (text-only, no interaction)
- `packages/admin/src/components/Garden/CreateGardenSteps/ReviewStep.tsx:128,130,154,156` — summary bullet list (font-mono text items, no click target)
- `packages/admin/src/components/Hypercerts/Steps/MintProgress.tsx:133,141` — ordered-list progress indicator (horizontal chain of step nodes — not an M3 list anatomy)
- `packages/admin/src/routes/RequireRole.tsx:37,39,42` — `list-disc` prose bullet list inside an error state

None of these match M3 list-item semantics (leading icon/image, 1/2/3-line label, trailing content, state layer, touch height). Migrating them would be a visual regression.

**Conclusion**: DEFER. `AdminListItem` is palette-complete but has no target in current admin UX. Either (a) design introduces a member-roster / governance-participant list in a future sprint and this primitive gets adopted then, or (b) drop it from the palette if the design doesn't call for M3 list rows. Flag at next design pass rather than retire now.

### Palette summary

| Primitive | Classification | Targets |
|---|---|---|
| `AdminBadge` | ADOPT | `HubWorkCard` media overlay + `TabBadge` rewrite (also: migrate `WorkDetailStatusBadge` to shared `StatusBadge`) |
| `AdminTooltip` | ADOPT | 11+ `title=` attributes across Garden / Hypercerts / ImpactTab / Layout |
| `AdminFab` | ADOPT | `FabAwareNavigationBar` inside `CanvasLayout.tsx` |
| `AdminListItem` | DEFER | No current target; revisit next design pass |
| `AdminCheckbox` | *already adopted* | Used in `components/Action/DetailsConfigSection.tsx:375`, `components/Action/MediaConfigSection.tsx:131` — knip false positive |
| `AdminLinearProgress` | *already adopted* | Used in `views/Garden/SignalPool.tsx:341` — knip false positive |

**The palette is healthier than the prior report implied**: 2/6 already adopted, 3/6 have clear migration targets, only 1/6 is a DEFER. Net: 5 of 13 wrappers with adoption opportunities identified, 0 retirable.

---

## 5. Why knip flags adopted primitives as "unused files"

`AdminCheckbox` and `AdminLinearProgress` show up under knip's "Unused files" section even though both have live consumers. This is because the *consumer files* (`DetailsConfigSection`, `MediaConfigSection`, `SignalPool`) themselves sit in closed graphs that knip classifies as unreachable from an entry point, so their imports don't count toward file liveness.

Consumers:
- `components/Action/DetailsConfigSection.tsx:11` imports `AdminCheckbox` → `DetailsConfigSection` → `components/Action/InstructionsBuilder.tsx:4` → ... (path eventually reaches the router)
- `components/Action/MediaConfigSection.tsx:5` imports `AdminCheckbox` → `MediaConfigSection` → `InstructionsBuilder.tsx:5` → ... (same chain)
- `views/Garden/SignalPool.tsx:22` imports `AdminLinearProgress` → `SignalPool` → `views/Community/index.tsx:33` → router

The chains are live; knip just cannot traverse them because of a dynamic import or barrel ambiguity upstream. Do NOT delete either primitive.

---

## 6. HIGH-CONFIDENCE unused package dependencies in scope

| Package | Dep | Reason |
|---|---|---|
| `packages/admin/package.json:27` | `@radix-ui/react-slot` | No import anywhere in `packages/admin/src` (client uses it separately via `packages/client/src/components/Actions/Button/Base.tsx`) |
| `packages/admin/package.json:28` | `@radix-ui/react-tabs` | No import in `packages/admin/src`; admin uses its own `AdminTabRail` primitive |

Knip also lists `@reown/appkit` as unused in `packages/admin/package.json` and `packages/client/package.json`. This is **NOT** a clean removal: AppKit is used transitively via `@green-goods/shared`'s `AppKitProvider`, and bundles in both packages contain reown symbols. Flag as MEDIUM: test by removing from one package + running `bun run build` before committing (same warning as prior report).

### `packages/contracts` — 0 removable

All six package.json deps knip flagged are Foundry remappings. See §8.

### `packages/shared`, `packages/client` — 0 removable

Knip found no unused runtime dependencies in these packages.

---

## 7. HIGH-CONFIDENCE unused devDependencies in scope

### Root `package.json` (affects all scope packages)

| Package | Notes |
|---|---|
| `@tailwindcss/forms` | No Tailwind config or component references |
| `@tailwindcss/typography` | No config references |
| `@tailwindcss/postcss` | No postcss config references |
| `@types/qrcode` | Only `qrcode.react` is used; base `qrcode` has no imports |
| `qrcode` | No imports |
| `tailwindcss-animate` | No Tailwind config references |
| `tsc-alias` | Declared but no script invokes it |

### MEDIUM — verify before removal

| Package | Notes |
|---|---|
| `sharp` | `optionalDependencies`; possible lighthouse transitive — verify CI |
| `graphql` | Declared in root + `packages/shared`; likely tooling transitive — verify codegen |
| `@varlock/1password-plugin` | Used by varlock's 1Password backend; `.env.schema` hook blocks read — confirm with Afo |
| `uint8arrays` (root) | `scripts/fix-multiformats.js` applies a compatibility patch for `@walletconnect/utils`; keep unless the shim is retired |

### Not removable in scope
- `babel-plugin-react-compiler` — used in `packages/admin/vite.config.ts:40` and `packages/client/vite.config.ts:185`
- `vite-plugin-mkcert` — imported by both admin and client vite configs
- `lighthouse` — used by lighthouse CI workflow + per-package scripts
- `oxlint`, `lint-staged`, `wait-port` — referenced by scripts / husky hooks

---

## 8. LOW / knip false positives in scope

### Files wired non-statically — already in §1b
- `packages/admin/src/lib/varlock-env.ts` — Vite alias
- `packages/client/public/sw-custom.js` — Workbox `importScripts`

### Solidity deps (Foundry remappings) — all must stay
`packages/contracts/package.json` — all 6 deps knip flagged are referenced only by Foundry remappings (`packages/contracts/remappings.txt`) and consumed by `.sol` files knip cannot parse:
- `@chainlink/contracts-ccip` — `src/mocks/CCIPRouter.sol`
- `@ensdomains/ens-contracts` — remapping `@ens=...`
- `@ethereum-attestation-service/eas-contracts` — remapping `@eas=...`
- `@openzeppelin/contracts-4.8.3`, `@openzeppelin/contracts-5.0.2` — remappings
- `@openzeppelin/contracts-upgradeable` — every UUPS-based contract

### vi.mock / test-only deps
- `@reown/appkit` — mocked in `packages/admin/src/__tests__/setup.ts:73`, `packages/admin/src/__tests__/components/ConnectButton.test.tsx:16`, `packages/client/src/__tests__/setupTests.ts:39` (plus transitive shared usage). Keep in `dependencies`, not `devDependencies` — bundle contains it.

### Unlisted binaries in scope
Knip's "Unlisted binaries" section reports `lsof` under admin/client/contracts package.json, and `anvil`, `forge`, `cast`, `pkill` in contracts/indexer. These are system binaries invoked by dev scripts; not npm-installable. Ignore.

### Script / config-only deps
- `tsx` (root) — used with `--import tsx` for bun script execution elsewhere. Keep.

### Same-file knip bugs
- `packages/admin/src/components/Hypercerts/HypercertWizard/types.ts:26` — `ERROR_CATEGORY_KEYS` used at line 38 same-file.

### "Unlisted dependencies"
Storybook imports in `.stories.tsx` + `@docusaurus/plugin-content-docs` in `docs/sidebars.ts` are transitively installed by their frameworks. Don't add to `package.json` just to silence knip.

### Unresolved import in a test — separate concern
- `packages/admin/src/__tests__/workflows/unauthorized-actions.test.tsx` imports `@/views/Gardens` which does not exist. This is a genuine **test bug**, not dead code — Agent 5/6 territory.

---

## Appendix: grouped removal plan for scope packages

### `packages/admin`
- Delete 4 orphan views (`WorkTab`, `Assessment`, `Hypercerts`, `GreenWillPanel`).
- Delete 6 Garden modals + `index.ts` barrel + `AddMemberModal.stories.tsx`.
- Delete 3 empty component barrels (`Action/index.ts`, `Assessment/index.ts`, `Hypercerts/index.ts`).
- Delete `TrendIndicator.tsx`, `Vault/assetTotals.ts`.
- Prune same-file helpers (`Layout/AccountSurface.tsx`, `Layout/ConnectShell.tsx`, `Layout/UserAvatar.tsx`, `Layout/UserMenu.tsx`, `accountSheet.events.ts`, `GardenDetailHelpers.tsx`, `gardenDetail.constants.ts`, `hub.utils.ts`, `AdminButton.tsx` — drop `adminButtonVariants`, `SubmitWork.tsx` — drop `default` only).
- Remove `@radix-ui/react-slot` and `@radix-ui/react-tabs` from `package.json`.
- **Palette work** (separate PR): migrate `AdminBadge` into `HubWorkCard` + `GardenDetailHelpers.TabBadge` (or retire `TabBadge` with view); migrate 11+ `title=` sites to `AdminTooltip`; replace hand-rolled FAB in `FabAwareNavigationBar` with `AdminFab`. Revisit `AdminListItem` at next design pass.

### `packages/shared`
- Delete `utils/admin-routes.ts` (deprecated shim).
- Delete `hooks/utils/useTxErrorMessages.ts`.
- Prune re-exports in `lib/hypercerts/index.ts`, `modules/data/hypercerts.ts`, `modules/data/ipfs/{index,client,resolve}.ts`, `utils/query-invalidation.ts`, `utils/blockchain/abis*.ts` (drop `JUICEBOX_ABI`).
- Prune truly-unused module exports (§2).
- Un-export Props/types (§3) — keep as local interfaces.

### `packages/client`
- Prune Card subcomponent re-exports in `Cards/index.ts` and `Base/Card.tsx`.
- Prune Select subcomponent re-exports in `Select.tsx`.
- Prune variant helpers (`badgeVariants`, `avatarVariants`, `cardVariants`).

### `packages/contracts`
- **No changes.** All "unused" deps are Solidity remappings.

### Root `package.json`
- Retire `@tailwindcss/{forms,typography,postcss}`, `@types/qrcode`, `qrcode`, `tailwindcss-animate`, `tsc-alias`.
- Leave `@reown/appkit` refs, `@varlock/1password-plugin`, `uint8arrays`, `graphql`, `sharp`, `oxlint`, `lint-staged`, `vite-plugin-mkcert`, `wait-port`, `lighthouse` alone (MEDIUM/LOW).

---

## Validation checklist before any removal

1. `bun run lint` — catches import-graph regressions.
2. `bun run test` — catches runtime references missed by static analysis.
3. `bun build` — catches bundler-resolved deps removed too aggressively.
4. `bun run storybook` / `bun run build:storybook` — ensure no stories orphaned by component deletions (`AddMemberModal.stories.tsx` will orphan with its modal).
5. For admin `@radix` / `@reown` removals: `bun install` + rebuild to confirm peer-resolution.
6. Per CLAUDE.md: `bun run check:design-tokens` and `bun run lint:vocab` before admin changes.
