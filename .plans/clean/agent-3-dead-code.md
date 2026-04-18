# Agent 3 — Dead Code Detection Report (DRY RUN)

Source: `bunx knip --reporter compact` at 2026-04-18, cross-verified with manual grep.
Mode: research + assess only. No files were modified.

## Executive Summary

- **HIGH-confidence unused files**: 22 (~3,432 LOC TS/TSX + some CSS excluded)
- **HIGH-confidence unused exports**: ~40 symbols (mostly barrel re-exports with zero consumers; handful of truly-dead helpers)
- **HIGH-confidence unused types**: ~35 interfaces/aliases (most are Props that should be un-exported, not deleted)
- **HIGH-confidence unused dependencies (package.json)**: 2 (`@radix-ui/react-slot`, `@radix-ui/react-tabs` in admin)
- **HIGH-confidence unused devDependencies**: ~7 (tailwind extensions, qrcode types, faker)
- **Bundle size impact**: small — orphan views and modals are already tree-shaken because no importer references them. Real win is compile / type-check / test surface shrinkage and reduced cognitive load.

Most "unused dependency" knip findings are **false positives** — Solidity deps (Foundry remappings), script binaries (`oxlint`, `mkcert`, `lint-staged`, `lighthouse`), build-time plugins (`babel-plugin-react-compiler`), husky targets, and test-only `vi.mock` subjects (`@reown/appkit`). See Section 6 — it is the most important part of this report to review before acting.

Knip's pessimism comes from three patterns:
1. Re-exports in barrel `index.ts` files when consumers bypass the barrel and import the underlying file directly.
2. Same-file helper exports used only inside the defining file.
3. Solidity imports under `packages/contracts` (no JS/TS parser sees them).

---

## 1. HIGH-CONFIDENCE unused files (safe to delete)

### `packages/admin` — orphan views (not wired in `router.tsx`)

Verified: `packages/admin/src/router.tsx` does NOT lazy-load any of these. The only `WorkTab.tsx` consumer was itself; it imports `WorkSubmissionsView` from `Hub/components` (also orphaned — see exports section).

| File | LOC |
|---|---|
| `packages/admin/src/views/Garden/Assessment.tsx` | 274 |
| `packages/admin/src/views/Garden/Hypercerts.tsx` | 211 |
| `packages/admin/src/views/Garden/WorkTab.tsx` | 284 |
| `packages/admin/src/views/Actions/GreenWillPanel.tsx` | 281 |

`packages/admin/src/views/Garden/SubmitWork.tsx` is **NOT** in this list — it exports both `default` and named `SubmitWorkPanel`. Only `default` is unused (see Section 2); `SubmitWorkPanel` is imported by `views/Hub/components/HubSheetDescriptor.tsx:10`.

### `packages/admin` — orphan Garden modals (barrel not consumed externally)

`packages/admin/src/components/Garden/index.ts` has no consumer. Its listed files form a closed graph with no entry point.

| File | LOC |
|---|---|
| `packages/admin/src/components/Garden/AddMemberModal.tsx` | 210 |
| `packages/admin/src/components/Garden/GardenDomainEditor.tsx` | 178 |
| `packages/admin/src/components/Garden/GardenMetadata.tsx` | 243 |
| `packages/admin/src/components/Garden/GardenProfileModal.tsx` | 65 |
| `packages/admin/src/components/Garden/GardenRolesPanel.tsx` | 154 |
| `packages/admin/src/components/Garden/ManageRolesModal.tsx` | 57 |
| `packages/admin/src/components/Garden/index.ts` | 16 |

### `packages/admin` — unused `Admin*` primitive components

Each appears only in its own file + its own Storybook story. Before removing, cross-reference `.claude/skills/design/prompt-contract.md § Canonical Component Palette`: CLAUDE.md says "13 `Admin*` wrappers." If an entry below is in the canonical palette, keep it as "Storybook-documented, not-yet-consumed" rather than deleting.

| File | LOC | Notes |
|---|---|---|
| `packages/admin/src/components/AdminBadge.tsx` | 63 | Storybook only |
| `packages/admin/src/components/AdminCheckbox.tsx` | 137 | Storybook only |
| `packages/admin/src/components/AdminFab.tsx` | 98 | Storybook only |
| `packages/admin/src/components/AdminLinearProgress.tsx` | 35 | Storybook only |
| `packages/admin/src/components/AdminListItem.tsx` | 202 | Storybook only |
| `packages/admin/src/components/AdminTooltip.tsx` | 39 | Storybook only |
| `packages/admin/src/components/TrendIndicator.tsx` | 34 | No consumer anywhere |
| `packages/admin/src/components/Vault/assetTotals.ts` | 49 | Not re-exported; Vault hooks use shared version |

### `packages/admin` — dead barrel files

All three barrels re-export symbols that are imported directly from the underlying files elsewhere. Deleting the barrels is cheap and eliminates ambiguity.

| File | LOC |
|---|---|
| `packages/admin/src/components/Action/index.ts` | 10 |
| `packages/admin/src/components/Assessment/index.ts` | 15 |
| `packages/admin/src/components/Hypercerts/index.ts` | 12 |

### `packages/shared` — deprecated shim + unused hook

| File | LOC | Notes |
|---|---|---|
| `packages/shared/src/utils/admin-routes.ts` | 20 | Already `@deprecated`; consumers import from `utils/navigation/admin-routes` |
| `packages/shared/src/hooks/utils/useTxErrorMessages.ts` | 53 | Superseded by `parseContractError` + `USER_FRIENDLY_ERRORS` pattern (CLAUDE.md) |

### `scripts/`

| File | LOC | Notes |
|---|---|---|
| `scripts/plan-hub.mjs` | 660 | **MEDIUM** — no `package.json` script invokes it and no `.github/workflows/*` reference. Old plans-hub kanban tool; `.plans/` is now manual per CLAUDE.md. Confirm no external agent/cron invocation before removing. |

---

## 1b. Files knip flagged that are actually used (do NOT remove)

These are moved out of HIGH because manual grep proves they are referenced at build time:

| File | Why it stays |
|---|---|
| `docs/src/css/custom.css` | Referenced by `docs/docusaurus.config.ts:52` as `customCss` entry |
| `packages/client/public/sw-custom.js` | Referenced by `packages/client/vite.config.ts:215` via `importScripts` (Workbox SW companion) |
| `packages/admin/src/lib/varlock-env.ts` | Aliased in `packages/admin/vite.config.ts:81` as `"varlock/env"` |
| `packages/indexer/test/test.ts` | Reachable via `packages/indexer/package.json:8 "mocha"` script (glob `test/**/*.ts`) |

Final HIGH-confidence file list: **22 files, ~3,432 LOC** (orphan views + Garden modals + Admin primitives + empty barrels + deprecated shim + unused hook). `scripts/plan-hub.mjs` adds 660 LOC more if Afo confirms retirement.

---

## 2. HIGH-CONFIDENCE unused exports

### `packages/admin` — dead barrel re-exports

Each barrel below has zero external consumers; every real import goes direct to the concrete file. Deleting the barrel removes all listed exports at once.

- `packages/admin/src/components/Layout/index.ts` — `CanvasLayout, CommandPalette, ConnectShell, UserAvatar, UserMenu`
- `packages/admin/src/views/Hub/components/index.ts` — `CookieJarDepositModal, CookieJarManageModal, CookieJarPayoutPanel, CookieJarWithdrawModal, HubCertificationInspector, HubHistoryInspector, HubWorkbenchSkeletonRows, MediaEvidence, WorkCard, WorkSubmissionsView`
- `packages/admin/src/components/Vault/index.ts:4` — `FunderRow, ImpactFunders` (the barrel has one external consumer via `views/Garden/Vault.tsx`, but no one imports `FunderRow` or `ImpactFunders` through it; also `ImpactFunders` has no consumer anywhere)

### `packages/admin` — unused same-file helpers

- `packages/admin/src/components/Layout/AccountSurface.tsx:64` — `AccountSurface` (sibling `AccountTabList`/`AccountTabPanels` ARE used by `views/Profile/index.tsx`)
- `packages/admin/src/components/Layout/accountSheet.events.ts:8` — `ACCOUNT_SHEET_CONTENT_ID`
- `packages/admin/src/components/Assessment/CreateAssessmentSteps/shared.tsx` — `ReviewRow, formatDateRange`
- `packages/admin/src/views/Garden/SubmitWork.tsx` — `default` export only (named `SubmitWorkPanel` stays)
- `packages/admin/src/views/Garden/components/GardenDetailHelpers.tsx` — `TabBadge, GardenHeroBanner` (other exports from this file ARE used)
- `packages/admin/src/views/Garden/components/gardenDetail.constants.ts` — `TAB_TRIGGER_BASE, TAB_SECTIONS`
- `packages/admin/src/views/Hub/hub.utils.ts` — `WORK_DETAIL_CONTENT_ID_PREFIX, CERTIFICATION_CONTENT_ID_PREFIX, HISTORY_CONTENT_ID_PREFIX`
- `packages/admin/src/components/AdminButton.tsx` — `adminButtonVariants` (raw variants fn; component itself is used)
- `packages/admin/src/components/Hypercerts/HypercertWizard/types.ts:26` — `ERROR_CATEGORY_KEYS` → **FALSE POSITIVE**. Knip bug: used in same file at line 38 (`return ERROR_CATEGORY_KEYS[categorized.category]`). Do NOT remove.

### `packages/shared` — barrel re-exports with direct-path consumers

- `packages/shared/src/lib/hypercerts/index.ts` — `DEFAULT_PROTOCOL_VERSION, aggregateOutcomeMetrics, deriveWorkTimeframe, allowlistEntrySchema, allowlistSchema, greenGoodsExtensionSchema, outcomeMetricsSchema, propertyDefinitionSchema, scopeDefinitionSchema, timeframeDefinitionSchema, generateProof, verifyProof, HYPERCERT_MINTER_ABI_FULL, MARKETPLACE_ADAPTER_ABI, HYPERCERTS_MODULE_ABI, TRANSFER_MANAGER_ABI` (tests and marketplace hooks import from `./constants`, `./validation`, `../../utils/blockchain/hypercert-abis` directly; barrel re-exports are dead — but verify each symbol's top-level `shared/src/index.ts` re-export before pruning)
- `packages/shared/src/lib/hypercerts/transactions.ts` — `HYPERCERT_MINTER_ABI_FULL`
- `packages/shared/src/modules/data/hypercerts.ts` — `getHypercertClaims, getAttestationsByUIDs, normalizeHypercertStatus, parseMetadataPayload, getHypercertMetadataFromIpfs` (re-exports; concrete impls live in `hypercerts-fetch.ts`, `hypercerts-metadata.ts`)
- `packages/shared/src/modules/data/ipfs/index.ts` — `toCanonicalIPFSUri, tryParseJson`
- `packages/shared/src/modules/data/ipfs/resolve.ts` — `toCanonicalIPFSUri, tryParseJson`
- `packages/shared/src/modules/data/ipfs/client.ts` — `DEFAULT_PINATA_GATEWAY, DEFAULT_PINATA_UPLOADS_API_BASE_URL, setIpfsInitializationStatus, setIpfsInitializationError, configurePinata`

### `packages/shared` — truly unused

- `packages/shared/src/utils/blockchain/abis.ts:22` — `JUICEBOX_ABI`
- `packages/shared/src/utils/blockchain/abis/index.ts:21` — `JUICEBOX_ABI`
- `packages/shared/src/utils/blockchain/abis/yield.ts:121` — `JUICEBOX_ABI` (defined, re-exported twice, never consumed)
- `packages/shared/src/utils/query-invalidation.ts` — `INVALIDATION_DELAYS, scheduleInvalidation, scheduleInvalidationForKey, scheduleProgressiveInvalidation` (all re-exports of `config/query-keys/schedule.ts`; underlying file IS used internally but the public re-exports are dead)
- `packages/shared/src/modules/data/eas.ts` — `EASFetchError, parseDataToWorkApproval`
- `packages/shared/src/modules/data/hypercerts-fetch.ts` — `getHypercertClaims`
- `packages/shared/src/modules/data/hypercerts-metadata.ts` — `isRecord, getString, getStringArray, parseMetadataPayload`
- `packages/shared/src/modules/app/error-categories.ts` — `getTimeSincePageLoad`
- `packages/shared/src/modules/app/error-tracking.ts` — `getTimeSincePageLoad` (duplicate of above — Agent 1 territory)
- `packages/shared/src/modules/app/posthog.ts` — `getAppVersion, getChainId, isTestnetEnvironment, isMainnetEnvironment, getEnvironment, initNetworkTracking`
- `packages/shared/src/modules/job-queue/event-bus.ts` — `useJobQueueEvent`
- `packages/shared/src/modules/job-queue/index.ts` — `computeFirstIncompleteStep, draftDB`
- `packages/shared/src/modules/job-queue/job-maintenance.ts` — `ORPHAN_CLEANUP_INTERVAL, FAILED_DELETE_ALERT_THRESHOLD`
- `packages/shared/src/modules/work/wallet-submission/index.ts` — `WorkSubmissionError`
- `packages/shared/src/modules/work/work-submission.ts` — `MAX_IMAGE_SIZE_BYTES, MAX_IMAGE_COUNT, MAX_TOTAL_IMAGE_SIZE_BYTES, ALLOWED_IMAGE_TYPES`
- `packages/shared/src/types/greenwill.ts` — `GREENWILL_BADGE_ORDER`
- `packages/shared/src/components/TranslationBadge.tsx` — `UnsupportedTranslationNotice`

### `packages/client` — barrel re-exports, unused helpers

- `packages/client/src/components/Cards/index.ts` — `ActionCard, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, gardenCardVariants, StatusBadge, WorkCard` (Card root still used via `FlexCard`/`Card`)
- `packages/client/src/components/Cards/Base/Card.tsx` — `cardVariants, CardHeader, CardFooter, CardTitle, CardDescription, CardContent`
- `packages/client/src/components/Inputs/Select/Select.tsx` — `SelectGroup, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator` (radix re-exports; no consumer)
- `packages/client/src/components/Cards/Work/WorkCard.tsx` — `StatusBadge`
- `packages/client/src/components/Actions/Button/Base.tsx` — `Icon`
- `packages/client/src/components/Communication/Badge/Badge.tsx` — `badgeVariants`
- `packages/client/src/components/Display/Avatar/Avatar.tsx` — `avatarVariants`

### `packages/agent` — barrel re-exports and in-file helpers

`handlers/index.ts` re-exports are unused because tests import handlers directly from `../handlers/<name>`:
- `packages/agent/src/handlers/index.ts` — `handleApprove, handleFeedback, handleHelp, handleJoin, handlePending, handleReject, handleStart, handleStatus, handleCancelSubmission, handleConfirmSubmission, handleTextSubmission, handleVoiceSubmission`
- `packages/agent/src/handlers/utils.ts` — `formatWaitTime`
- `packages/agent/src/types.ts` — `buttonResponse`

### Misc truly unused

- `scripts/lib/ipfs-hybrid.ts` — `parseIPFSReference, buildGatewayUrl`
- `packages/admin/src/__tests__/test-utils.tsx` — `createMockSmartAccountClient, createTestQueryClient, MOCK_ADDRESSES, MOCK_TX_HASH, mock, TestWrapper, render` (only `renderWithProviders` + `screen` used)
- `packages/client/src/__tests__/test-utils.tsx` — `createMockSmartAccountClient, createTestQueryClient, MOCK_ADDRESSES, MOCK_TX_HASH, mock, TestWrapper, userEvent, render` (same pattern)
- `packages/agent/src/__tests__/utils/mocks.ts` — `mockTelegramBot, mockPublicClient, mockWalletClient, createAIMock, createStorageMock, useMockTimers` (only `mockLogger` is consumed)
- `packages/shared/src/__tests__/test-utils/index.ts` — `renderWithQuery, renderWithProviders` flagged as **duplicate** export (Agent 1 concern, not dead code)

---

## 3. HIGH-CONFIDENCE unused types / interfaces

Most of these are component Props or hook return-types exported as public API but not consumed externally. They are NOT truly dead — TypeScript needs them internally for correct typing, and they document the component/hook contract. Preferred action: **un-export** (remove the `export` keyword, keep the declaration) rather than delete.

### `packages/admin`
- `packages/admin/src/components/AdminButton.tsx:98` — `AdminButtonProps`
- `packages/admin/src/components/AdminCard.tsx:68` — `AdminCardProps`
- `packages/admin/src/components/AdminDialog.tsx:11` — `AdminDialogProps`
- `packages/admin/src/components/AdminFilterChip.tsx:9` — `AdminFilterChipProps`
- `packages/admin/src/components/AdminSearchToolbar.tsx` — `AdminSearchToolbarProps`
- `packages/admin/src/components/AdminTabRail.tsx` — `AdminTab, AdminTabRailProps`
- `packages/admin/src/components/AdminTextField.tsx` — `AdminTextFieldProps`
- `packages/admin/src/components/Hypercerts/HypercertWizard/index.tsx` — `HypercertWizardProps`
- `packages/admin/src/views/Actions/createActionTemplateSelection.ts` — `CreateActionTemplateSelection`
- `packages/admin/src/views/Community/components/CommunityTab.tsx` — `CommunityTabProps`
- `packages/admin/src/views/Garden/SubmitWork.tsx` — `SubmitWorkPanelProps`
- `packages/admin/src/views/Garden/WorkDetail/index.tsx` — `WorkDetailPanelProps`
- `packages/admin/src/views/Garden/components/ImpactTab.tsx` — `ImpactTabProps`
- `packages/admin/src/views/Garden/components/OverviewTab.tsx` — `OverviewTabProps`
- `packages/admin/src/views/Hub/components/HubWorkCard.tsx` — `HubWorkCardProps`

### `packages/agent`
- `packages/agent/src/__tests__/utils/mocks.ts` — `AIMockResponses`
- `packages/agent/src/api/server.ts` — `ServerConfig, ServerDeps`
- `packages/agent/src/config.ts` — `BotMode, Config`
- `packages/agent/src/handlers/approve.ts` — `ApproveDeps`
- `packages/agent/src/handlers/index.ts` — `HandlerContext`
- `packages/agent/src/handlers/reject.ts` — `RejectDeps`
- `packages/agent/src/handlers/status.ts` — `StatusDeps`
- `packages/agent/src/platforms/telegram.ts` — `TelegramConfig, MessageHandler, VoiceProcessor, PhotoProcessor, Notifier`
- `packages/agent/src/services/crypto.ts` — `EncryptedData`
- `packages/agent/src/services/logger.ts` — `AuditEventType`
- `packages/agent/src/services/media.ts` — `MediaUploadResult, MediaBuffer`
- `packages/agent/src/services/rate-limiter.ts` — `RateLimitConfig, RateLimitResult`
- `packages/agent/src/types.ts` — `RateLimitResult` (duplicate of rate-limiter.ts — Agent 2 concern)

### `packages/client`
- `packages/client/src/components/Actions/Button/index.tsx` — `ButtonProps`
- `packages/client/src/components/Cards/Action/ActionCard.tsx` — `ActionCardRootProps`
- `packages/client/src/components/Cards/Garden/GardenCard.tsx` — `GardenCardOptions, GardenCardProps`
- `packages/client/src/components/Cards/Work/DraftCard.tsx` — `DraftCardProps`
- `packages/client/src/components/Cards/Work/WorkCard.tsx` — `WorkCardItem, WorkCardProps, MinimalWorkCardProps, StatusBadgeProps`
- `packages/client/src/components/Cards/index.ts` — duplicate type re-exports (`ActionCardRootProps, ActionCardVariantProps, CardRootProps, CardVariantProps, GardenCardOptions, GardenCardProps, GardenCardVariantProps, DraftCardProps, MinimalWorkCardProps, StatusBadgeProps, WorkCardItem, WorkCardProps`)
- `packages/client/src/components/Communication/Badge/Badge.tsx` — `BadgeProps, BadgeVariantProps`
- `packages/client/src/components/Dialogs/ImagePreviewDialog.tsx` — `ImagePreviewDialogProps`
- `packages/client/src/components/Dialogs/TreasuryDrawer/CookieJarCard.tsx` — `CookieJarCardProps`
- `packages/client/src/components/Dialogs/TreasuryDrawer/CookieJarTabContent.tsx` — `CookieJarTabContentProps`
- `packages/client/src/components/Dialogs/TreasuryDrawer/MyDepositRow.tsx` — `MyDepositRowProps`
- `packages/client/src/components/Dialogs/TreasuryDrawer/TreasuryTabContent.tsx` — `TreasuryTabContentProps`
- `packages/client/src/components/Display/Avatar/Avatar.tsx` — `AvatarVariantProps, AvatarRootProps`
- `packages/client/src/components/Display/Carousel/Carousel.tsx` — `CarouselApi`
- `packages/client/src/components/Display/Image/ImageWithFallback.tsx` — `ImageWithFallbackProps`
- `packages/client/src/components/Inputs/Select/FormSelect.tsx` — `FormSelectOption, FormSelectProps`
- `packages/client/src/components/Inputs/TextField/Input.tsx` — `FormInputProps`
- `packages/client/src/components/Inputs/TextField/Text.tsx` — `FormTextProps`
- `packages/client/src/components/Navigation/Tabs/index.ts` — `StandardTabsProps`
- `packages/client/src/views/Home/GardenFilters/index.tsx` — `GardenFilterScope, GardenSortOrder, FilterOptionButtonProps`
- `packages/client/src/views/Home/WorkDashboard/Drafts.tsx` — `DraftsTabProps`
- `packages/client/src/views/Home/WorkDashboard/index.tsx` — `WorkDashboardProps`

### `packages/ops`
- `packages/ops/src/types.ts` — `ScriptDefinition`

### `packages/shared`
- `packages/shared/src/components/Cards/CardBase.tsx` — `SurfaceCardVariantProps`
- `packages/shared/src/components/Dialog/ImagePreviewDialog.tsx` — `ImagePreviewDialogLabels`
- `packages/shared/src/config/query-persistence.ts` — `QueryPersister`
- `packages/shared/src/hooks/assessment/useCreateAssessmentWorkflow.ts` — `AssessmentWorkflowParams, AssessmentDraftRecord, UseCreateAssessmentWorkflowOptions`
- `packages/shared/src/hooks/auth/useUser.ts` — `User, UseUserReturn`
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
- `packages/shared/src/lib/hypercerts/index.ts` — `MerkleLeaf, MerkleTree` (re-exports)
- `packages/shared/src/lib/hypercerts/merkle.ts` — `MerkleLeaf, MerkleTree`
- `packages/shared/src/modules/data/hypercerts-attestations.ts` — `BundledAttestationInfo`
- `packages/shared/src/modules/data/hypercerts.ts` — `BundledAttestationInfo` (duplicate)
- `packages/shared/src/modules/data/ipfs/client.ts` — `IpfsConfig, IpfsInitStatus`
- `packages/shared/src/modules/data/ipfs/index.ts` — `IpfsConfig, IpfsInitStatus, GetFileByHashOptions` (re-exports)
- `packages/shared/src/modules/data/ipfs/pinata.ts` — `PinataUploadResponse`
- `packages/shared/src/modules/data/ipfs/resolve.ts` — `GetFileByHashOptions`
- `packages/shared/src/modules/job-queue/index.ts` — `FlushResult`
- `packages/shared/src/modules/work/passkey-submission.ts` — `PasskeyBatchApprovalParams`
- `packages/shared/src/modules/work/simulate.ts` — `SimulateWorkSubmissionParams, SimulateApprovalSubmissionParams`
- `packages/shared/src/modules/work/wallet-submission/index.ts` — `BatchApprovalOptions, OnProgressCallback, SubmissionPhase, WalletSubmissionStage`
- `packages/shared/src/modules/work/wallet-submission/types.ts` — `WalletSubmissionStage, SubmissionPhase`
- `packages/shared/src/modules/work/work-submission.ts` — `ValidateWorkContextOptions`
- `packages/shared/src/types/greenwill.ts` — `GreenWillBadgeSlug`
- `packages/shared/src/utils/eas/encoders.ts` — `EncodeWorkDataOptions`
- `packages/shared/src/utils/navigation/admin-routes.ts` — `AdminHubMode, AdminHubView, AdminGardenMode, AdminCommunityMode, AdminHubSort, AdminHubRouteContext, AdminGardenRouteContext, AdminCommunityRouteContext`
- `packages/shared/src/workflows/authMachine.ts` — `RestoreSessionInput, PasskeyOperationInput, AuthInput`

### `scripts/` / `tests/`
- `scripts/lib/ipfs-hybrid.ts` — `PinataScriptConfig`
- `tests/fixtures/anvil-config.ts` — `TestAccountName, TestAccount`
- `tests/fixtures/anvil-fork.ts` — `ForkOptions`
- `tests/fixtures/contract-helpers.ts` — `Capital, CreateGardenParams, CreateActionParams, SubmitWorkParams, ApproveWorkParams, ApprovalResult`
- `tests/helpers/test-utils.ts` — `ServiceStatus, AdminMockRole`

---

## 4. HIGH-CONFIDENCE unused dependencies (package.json)

| Package | Dep | Reason |
|---|---|---|
| `packages/admin/package.json:27` | `@radix-ui/react-slot` | No import anywhere in `packages/admin/src` (client uses it separately via `packages/client/src/components/Actions/Button/Base.tsx`) |
| `packages/admin/package.json:28` | `@radix-ui/react-tabs` | No import in `packages/admin/src`; admin uses its own `AdminTabRail` primitive |

That is the entire genuine dependency-removal list. Everything else knip flagged under "Unused dependencies" is a false positive — see Section 6.

---

## 5. MEDIUM findings (verify before action)

### Files
- `scripts/plan-hub.mjs` — no package.json or workflow invocation; confirm no external agent/cron use before removing.
- `packages/indexer/test/test.ts` — knip flagged as unused; actually reachable via `mocha` glob. Low-value either way.

### Un-export candidates (safe behavioural change, not removal)
These exports are used ONLY inside their own file. Un-exporting tightens the public surface:

- `packages/agent/src/config.ts` — `loadConfig`, `validateConfig`
- `packages/agent/src/platforms/telegram.ts` — `toInboundMessage`, `toTelegramReply`
- `packages/agent/src/services/errors.ts` — `ValidationError`, `AuthorizationError`, `ExternalServiceError`
- `packages/agent/src/services/logger.ts` — `createLogger`
- `packages/agent/src/services/media.ts` — `uploadBufferToIPFS`, `uploadMediaBatch`, `resolveIPFSUrl`, `getMediaCIDs`, `detectMimeType`, `getExtensionForMime`
- `packages/agent/src/services/ai.ts` — `getAI`, `transcribe` (CAREFUL: both are re-wrapped as `export const transcribe = ...`; verify the wrapper uses the correct name before editing)
- `packages/agent/src/services/blockchain.ts` — `getBlockchain`, `resetBlockchain`, `isGardener`, `getChainId` (same wrapper pattern)
- `packages/ops/src/executors.ts` — `executeDeployPlan`, `executeFinalizeDeploy`, `executeUpgradePlan`, `executeFinalizeUpgrade`, `executeScript` (all dispatched by internal switch in same file)
- `packages/ops/src/types.ts` — `resolveArtifactOutputDir`
- `packages/admin/src/components/Layout/ConnectShell.tsx:16` — `ConnectShell` (used only by sibling `WalletRequiredConnectShell` in same file; un-export leaves both)

### Design-system audit before deleting Admin primitives
Before deleting `AdminBadge`, `AdminCheckbox`, `AdminFab`, `AdminLinearProgress`, `AdminListItem`, `AdminTooltip`: check `.claude/skills/design/prompt-contract.md § Canonical Component Palette`. Per CLAUDE.md: "13 `Admin*` wrappers". Canonical-palette members should be kept with Storybook as "available but unused," not deleted.

### `@reown/appkit` in admin/client `dependencies`
Not imported from admin/client source — only from `@green-goods/shared`. Admin and client bundles DO contain reown (confirmed in `packages/admin/dist/assets`). Bun's workspace hoisting likely resolves the shared transitive dep via admin's/client's node_modules. Removing could break production resolution — **test by removing from one package + running `bun run build`** before committing.

### `uint8arrays` in root `package.json`
Not imported anywhere; `scripts/fix-multiformats.js` references the package by filesystem path to apply a compatibility patch for `@walletconnect/utils`. Transitively installed via walletconnect; the explicit pin guarantees a patchable version. Keep unless the multiformats shim is retired.

### `@varlock/1password-plugin` (root devDep)
Declared for varlock's 1Password backend. The `.env.schema` is the source of truth (not inspected — hook blocks `.env*` reads). Confirm with Afo before removing.

### Test fixtures
Every "unused" export under `tests/fixtures/` and `tests/helpers/` is test-infrastructure. Low cleanup value, modest maintenance cost. Recommend **defer** until test-suite refactor.

---

## 6. LOW findings (knip false positives — do NOT remove)

### Files wired non-statically (already moved out of HIGH in Section 1b)
- `docs/src/css/custom.css` — Docusaurus `customCss` config entry
- `packages/client/public/sw-custom.js` — Workbox `importScripts`
- `packages/admin/src/lib/varlock-env.ts` — Vite alias `"varlock/env"`
- `packages/indexer/test/test.ts` — `mocha` glob

### Solidity deps (Foundry remappings) — ALL must stay
`packages/contracts/package.json`:
- `@chainlink/contracts-ccip` (remapping line 10–12; used by `src/mocks/CCIPRouter.sol`)
- `@ensdomains/ens-contracts` (remapping `@ens=...` line 7)
- `@ethereum-attestation-service/eas-contracts` (remapping `@eas=...` line 6)
- `@openzeppelin/contracts-4.8.3` (remapping line 12)
- `@openzeppelin/contracts-5.0.2` (remapping line 11)
- `@openzeppelin/contracts-upgradeable` (remapping line 9; every UUPS-based contract depends on it)

Knip cannot parse Solidity.

### vi.mock / test-only deps
- `@reown/appkit` — mocked in `packages/admin/src/__tests__/setup.ts:73`, `packages/admin/src/__tests__/components/ConnectButton.test.tsx:16`, `packages/client/src/__tests__/setupTests.ts:39` — plus the transitive shared usage. Keep.

### Runtime-only deps
- `pino-pretty` (`packages/agent`) — runtime transport target in `packages/agent/src/services/logger.ts:19`. Keep.

### Script / config-only deps
- `oxlint` — used by every `lint` script (`package.json:37`, all package.json `lint` scripts). Keep.
- `lint-staged` — used by `.husky/pre-commit:21,23`. Keep.
- `babel-plugin-react-compiler` — used in `packages/admin/vite.config.ts:40` and `packages/client/vite.config.ts:185`. Keep.
- `vite-plugin-mkcert` — imported in both admin and client vite configs. Keep.
- `wait-port` — used by `scripts/open-dev-urls.sh:14`. Keep.
- `lighthouse` — used by `lighthouse:client` / `lighthouse:admin` scripts and `.github/workflows/lighthouse-ci.yml`. Keep.
- `tsx` (`packages/agent`, root) — used with `--import tsx` in `packages/indexer/package.json:8` and bun script execution. Keep.
- `mocha` + `@types/mocha` (`packages/indexer`) — `packages/indexer/package.json:8` invokes mocha directly. Keep.

### Same-file knip bugs
- `packages/admin/src/components/Hypercerts/HypercertWizard/types.ts:26` — `ERROR_CATEGORY_KEYS` (used at line 38 in same file)

### "Unlisted dependencies"
Knip's "Unlisted" section reports Storybook imports in `.stories.tsx` files plus `@docusaurus/plugin-content-docs` in `docs/sidebars.ts`. Both are transitively installed by their frameworks. Do NOT add them to `package.json` just to silence knip — stories and docs continue to build.

---

## 7. Unused devDependencies (separate — safer to retire)

Verified truly unreferenced. Low value + low cost — consolidate into one PR.

### Root `package.json`
| Package | Notes |
|---|---|
| `@tailwindcss/forms` | No Tailwind config or component references |
| `@tailwindcss/typography` | No config references |
| `@tailwindcss/postcss` | No postcss config references |
| `@types/qrcode` | Only `qrcode.react` is used; base `qrcode` has no imports |
| `qrcode` | No imports |
| `tailwindcss-animate` | No Tailwind config references |
| `sharp` | In `optionalDependencies`; no direct import; may be lighthouse transitive — **MEDIUM**, verify lighthouse CI first |
| `graphql` | Declared in root + `packages/shared`; no direct import; likely transitive tooling — **MEDIUM**, verify codegen/schema pipeline first |
| `tsc-alias` | Declared but no script invokes it. Safe to retire. |

### `packages/agent/package.json`
| Package | Notes |
|---|---|
| `@faker-js/faker` | No import anywhere in agent. Safe to retire. |
| `tsx` | Listed but no script invokes it inside agent. `packages/indexer` uses `tsx` separately. Verify no workflow references before retiring. **MEDIUM** |

### Not removable
- `packages/admin/package.json` devDeps — `babel-plugin-react-compiler` stays (vite.config reference).
- `packages/client/package.json` devDeps — `babel-plugin-react-compiler` stays.
- `packages/indexer/package.json` — `@types/mocha`, `mocha` stay (script reference).

### Final HIGH-confidence retirable devDeps (≈ 7)
- `@tailwindcss/forms`
- `@tailwindcss/typography`
- `@tailwindcss/postcss`
- `@types/qrcode`
- `qrcode`
- `tailwindcss-animate`
- `@faker-js/faker` (in `packages/agent`)
- `tsc-alias` (root)

---

## Appendix: grouped removal plan by package

### `packages/admin` (largest dead-code concentration)
- Delete 4 orphan views (`WorkTab`, `Assessment`, `Hypercerts`, `GreenWillPanel`).
- Delete 6 Garden modals + their `index.ts` barrel.
- Delete 3 empty component barrels (`Action/index.ts`, `Assessment/index.ts`, `Hypercerts/index.ts`).
- After design-palette audit: delete 6 standalone `Admin*` primitives + `TrendIndicator` + `Vault/assetTotals.ts`.
- Prune unused exports from `Layout/AccountSurface.tsx` (drop `AccountSurface` function), `accountSheet.events.ts`, `gardenDetail.constants.ts`, `hub.utils.ts`, `SubmitWork.tsx` (drop `default` only), `GardenDetailHelpers.tsx`, `Hub/components/index.ts`, `Vault/index.ts`, `AdminButton.tsx` (drop `adminButtonVariants`).
- Remove `@radix-ui/react-slot` and `@radix-ui/react-tabs` from `package.json`.

### `packages/shared`
- Delete `utils/admin-routes.ts` (deprecated shim).
- Delete `hooks/utils/useTxErrorMessages.ts`.
- Prune re-exports in `lib/hypercerts/index.ts`, `modules/data/hypercerts.ts`, `modules/data/ipfs/{index,client,resolve}.ts`, `utils/query-invalidation.ts`, `utils/blockchain/abis*.ts` (drop `JUICEBOX_ABI`).
- Prune truly-unused module exports (Section 2).
- Un-export Props/types (Section 3) — keep as local interfaces.

### `packages/client`
- Prune Card subcomponent re-exports in `Cards/index.ts` and `Base/Card.tsx`.
- Prune Select subcomponent re-exports in `Select.tsx`.
- Prune variant helpers (`badgeVariants`, `avatarVariants`).

### `packages/agent`
- Un-export service internals (Section 5).
- Prune `handlers/index.ts` barrel re-exports.
- Remove `@faker-js/faker` from `package.json`.

### `packages/ops`
- Un-export service internals (`executeDeployPlan`, etc., `resolveArtifactOutputDir`).

### `packages/contracts`
- **No changes.** Knip's "unused dependencies" list is 100% Solidity-via-Foundry false positives.

### `packages/indexer`
- **No changes.** Mocha test is reachable via script.

### Root `package.json`
- Retire `@tailwindcss/{forms,typography,postcss}`, `@types/qrcode`, `qrcode`, `tailwindcss-animate`, `tsc-alias`.
- Leave `@reown/appkit` refs, `@varlock/1password-plugin`, `uint8arrays`, `graphql`, `sharp`, `oxlint`, `lint-staged`, `vite-plugin-mkcert`, `wait-port`, `lighthouse`, `tsx` alone (MEDIUM/LOW).

### `scripts/`
- Confirm no external invocation of `plan-hub.mjs` before removing.
- Prune `scripts/lib/ipfs-hybrid.ts` exports (`parseIPFSReference`, `buildGatewayUrl`).

### `tests/`
- No removals — low-risk test infra.

---

## Validation checklist before any removal lands

1. `bun run lint` — catches import-graph regressions (oxlint is fast; will fail on unresolved imports).
2. `bun run test` — catches runtime references missed by static analysis.
3. `bun build` — catches bundler-resolved deps removed too aggressively.
4. `bun run storybook` / `bun run build:storybook` (if available) — ensure no stories orphaned by component deletions.
5. For admin/client `@reown` / `@radix` removals: run `bun install` to confirm `package.json` diff doesn't break peer-resolution, then rebuild.
6. Per CLAUDE.md: `bun run check:design-tokens` and `bun run lint:vocab` before committing admin changes.
