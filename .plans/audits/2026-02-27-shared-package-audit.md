# Shared Package Audit Report - 2026-02-27

## Executive Summary

| Metric | Value |
|--------|-------|
| Source files analyzed | 335 |
| Test files | 171 |
| Story files | 35 |
| Lines of code (source) | 72,172 |
| TypeScript errors | 0 |
| Lint warnings | 18 (0 errors) |
| **Critical** | **3** |
| **High** | **10** |
| **Medium** | **16** |
| **Low** | **11** |

Tests: 14 test files failing (32 failing tests / 2,634 total), 5 skipped.

---

## Critical Findings

### C1. Unresolved Storybook Dependency: `@storybook/addon-actions`

- **File**: `packages/shared/.storybook/main.ts:56`
- **Issue**: `@storybook/addon-actions` is listed in the Storybook addons config but is NOT installed as a dependency (not in `package.json`, not in `node_modules/` at any level). This will cause Storybook to fail or silently lose action logging.
- **Impact**: Storybook builds may break or action tab will be non-functional.
- **Fix**: Add `@storybook/addon-actions` to `devDependencies` in `packages/shared/package.json`.

### C2. 14 Test Files Failing (32 Tests)

- **Files**: See full list below
- **Issue**: 32 tests across 14 files are currently failing. Failing areas:
  - Marketplace types/modules (4 files) -- likely schema or API changes not reflected in tests
  - Work approval toast tests (1 file)
  - Smart polling tests (1 file)
  - Cookie jar hooks (1 file)
  - Conviction mutations (1 file)
  - Vault operations (1 file)
  - Draft auto-save/resume (2 files)
  - Mutation error handler (1 file)
- **Impact**: CI gate failures, regression risk.

**Failing test files:**
1. `src/__tests__/types/marketplace-types.test.ts`
2. `src/__tests__/modules/marketplace/approvals.test.ts`
3. `src/__tests__/modules/marketplace/client.test.ts`
4. `src/__tests__/modules/marketplace/signing.test.ts`
5. `src/__tests__/hooks/useWorkApproval.test.ts`
6. `src/__tests__/utils/smart-polling.test.ts`
7. `src/__tests__/hooks/cookie-jar/useGardenCookieJars.test.ts`
8. `src/__tests__/hooks/conviction/useConvictionMutations.test.ts`
9. `src/__tests__/hooks/vault/useVaultOperations.test.ts`
10. `src/__tests__/hooks/work/useDraftAutoSave.test.ts`
11. `src/__tests__/hooks/work/useDraftResume.test.ts`
12. `src/utils/errors/__tests__/mutation-error-handler.test.ts`

### C3. Unsafe `finally` Block in `useTranslation`

- **File**: `packages/shared/src/hooks/translation/useTranslation.ts:67-69`
- **Issue**: The `finally` block contains an early `return` statement (`if (!isMounted) return;`), which overrides any thrown error from the `try` or `catch` blocks. This silently swallows errors when the component unmounts during translation.
- **Impact**: Errors in translation are silently dropped; `setIsTranslating(false)` may not execute on error paths when component is still mounted.
- **Fix**: Remove the early return from `finally` and restructure to only guard `setIsTranslating`.

---

## High Findings

### H1. 30 Hooks Missing Test Coverage

- **Impact**: No regression safety for substantial hook surface area.
- **Key gaps** (untested hooks):
  - Entire `conviction/` subsystem (12 hooks -- zero tests)
  - `useCreateAssessmentWorkflow`, `useCreateGardenWorkflow` (complex multi-step workflows)
  - `useUpdateGarden`, `useSetGardenDomains`, `useOpenMinting`
  - `useOpsRunner` (admin operations)
  - `useCookieJarAdmin`, `useCookieJarDeposit`, `useCookieJarWithdraw`
  - `useAllocateYield`, `useYieldAllocations`

### H2. 225 `any` Type Usages (30 in Production Code)

- **Breakdown (excluding tests/stories/mocks)**:
  - `as any`: 24 instances (9 are `import.meta as any` -- acceptable Vite pattern)
  - `Record<string, any>`: 6 instances
  - `: any` annotations: 0

- **Concerning non-import.meta casts**:
  - `packages/shared/src/config/appkit.ts:71-72`: `null as any` for AppKit config (2 instances)
  - `packages/shared/src/config/appkit.ts:99`: `chains as any` (SDK type mismatch)
  - `packages/shared/src/hooks/vault/useVaultPreview.ts:39`: `contracts as any`
  - `packages/shared/src/components/Toast/toast.service.tsx:602`: icon cast
  - `packages/shared/src/modules/translation/diagnostics.ts`: 5 instances for experimental AI API access (acceptable -- unstable browser API)

### H3. Duplicate Exports (4 in Shared Package)

Knip flagged these files exporting the same symbol under two names:

| File | Exports |
|------|---------|
| `components/Dialog/ConfirmDialog.tsx` | `ConfirmDialog` + `default` |
| `components/ErrorBoundary/ErrorBoundary.tsx` | `ErrorBoundary` + `default` |
| `hooks/analytics/useAnalyticsIdentity.ts` | `useAnalyticsIdentity` + `default` |
| `hooks/analytics/usePageView.ts` | `usePageView` + `default` |
| `modules/data/graphql-client.ts` | `GRAPHQL_TIMEOUT_MS` + `INDEXER_TIMEOUT_MS` |
| `modules/data/ipfs.ts` | 3 alias pairs (Storacha/Pinata/IPFS naming) |

**Recommendation**: Remove `default` exports in favor of named exports (project convention). Remove the `INDEXER_TIMEOUT_MS` alias.

### H4. Hardcoded English Strings in Shared Components (i18n Violations)

The following components have hardcoded English strings instead of using `react-intl` translations:

| File | Hardcoded strings |
|------|-------------------|
| `components/Form/MethodSelector.tsx:6-9` | "Human", "IoT", "Onchain", "Agent" labels |
| `components/Form/ConfidenceSelector.tsx:6-9` | "None", "Low", "Medium", "High" labels + hint descriptions |
| `components/ErrorBoundary/ErrorBoundary.tsx:111-127` | "Something went wrong", "An unexpected error occurred", "Try again" |
| `hooks/gardener/useGardenerProfile.ts:178-193` | All toast messages (12+ strings) |
| `components/Form/MethodSelector.tsx:55` | `aria-label="Verification methods"` |
| `components/Form/ConfidenceSelector.tsx:67` | `aria-label="Confidence level"` |

### H5. Deprecated Exports Still in Barrel (Dead Weight)

These deprecated exports are re-exported through `modules/index.ts` and `index.ts` but have zero consumer usage outside shared itself:

- `clearStoredPasskey` (deprecated for `clearStoredCredential`)
- `hasStoredPasskey` (deprecated for `hasStoredCredential`)
- `PASSKEY_STORAGE_KEY` (deprecated for `CREDENTIAL_STORAGE_KEY`)
- `initializePinata` (deprecated for `initializeIpfs`)
- `initializePinataFromEnv` (deprecated for `initializeIpfsFromEnv`)
- `INDEXER_TIMEOUT_MS` (alias for `GRAPHQL_TIMEOUT_MS`)

### H6. useMemo Dependency Lint Warning in `useWorkForm`

- **File**: `packages/shared/src/hooks/work/useWorkForm.ts:100`
- **Issue**: `inputsKey` is flagged as an unnecessary dependency. The memo uses `inputsKey` (a JSON-serialized string) to stabilize the dependency instead of using `inputs` directly. While intentional (comment explains why), the lint warning indicates a potential confusion point.

### H7. `useGardenerProfile` Query Returns Hardcoded `null`

- **File**: `packages/shared/src/hooks/gardener/useGardenerProfile.ts:127-139`
- **Issue**: The query function contains a `TODO` comment and always returns `null`. This is placeholder code that should either be implemented or gated behind a feature flag.
- **Impact**: Profile data is never fetched; any UI depending on it gets nothing.

### H8. God Objects (Files > 500 Lines)

| File | Lines | Concern |
|------|-------|---------|
| `types/eas.d.ts` | 9,435 | Type declarations (acceptable) |
| `types/green-goods.d.ts` | 4,328 | Type declarations (acceptable) |
| `modules/data/hypercerts.ts` | 939 | Data module -- consider splitting by concern |
| `modules/job-queue/index.ts` | 852 | Core queue logic -- consider splitting |
| `utils/blockchain/abis.ts` | 851 | ABI constants (acceptable) |
| `index.ts` | 790 | Barrel file (acceptable) |
| `hooks/vault/useVaultOperations.ts` | 762 | Multiple operations in one hook |
| `hooks/query-keys.ts` | 680 | Registry (acceptable) |
| `modules/app/error-tracking.ts` | 679 | Error tracking -- consider splitting |
| `components/Toast/toast.service.tsx` | 664 | Toast service -- consider splitting |

### H9. Unused Exports from Shared (Per knip)

These exports exist in shared but have no consumer across the monorepo:

| File | Unused Exports |
|------|---------------|
| `components/Toast/ToastViewport.tsx` | `defaultToastOptions` |
| `components/TranslationBadge.tsx` | `UnsupportedTranslationNotice` |
| `hooks/hypercerts/hypercert-contracts.ts` | `HYPERCERT_MINTER_BY_CHAIN`, `getHypercertMinterFallback` |
| `hooks/hypercerts/useMintHypercert.ts` | `TimeoutError` |
| `lib/hypercerts/index.ts` | 14 exports (schemas, ABIs, functions) |
| `modules/app/posthog.ts` | `getAppVersion`, `getChainId`, and 4 others |
| `modules/auth/session.ts` | `CREDENTIAL_STORAGE_KEY`, `debugPasskeyConfig` |
| `modules/data/eas.ts` | `EASFetchError`, `parseDataToWorkApproval` |
| `modules/data/hypercerts.ts` | `getAttestationsByUIDs`, `getHypercertClaims` |
| `modules/job-queue/event-bus.ts` | `useJobQueueEvent` |
| `modules/job-queue/index.ts` | `computeFirstIncompleteStep`, `draftDB` |
| `modules/work/work-submission.ts` | `MAX_IMAGE_SIZE_BYTES`, `MAX_IMAGE_COUNT`, etc. |
| `providers/Auth.tsx` | `useOptionalAuthContext`, `AUTH_MODE_STORAGE_KEY` |
| `utils/blockchain/abis.ts` | `JUICEBOX_ABI` |
| `utils/eas/encoders.ts` | `encodeAssessmentData` |
| `utils/storage/avatar-cache.ts` | `clearAvatarCache`, `removeCachedAvatar` |
| `utils/storage/file-serialization.ts` | `isIOSSafari` |

### H10. Unused Exported Types from Shared (Per knip)

| File | Unused Types |
|------|-------------|
| `components/StatusBadge.tsx` | `WorkStatus` |
| `hooks/assessment/useCreateAssessmentWorkflow.ts` | `AssessmentWorkflowParams`, `AssessmentDraftRecord`, etc. |
| `hooks/auth/useUser.ts` | `User`, `UseUserReturn` |
| `hooks/blockchain/useContractTxSender.ts` | `SendContractTxRequest` |
| `hooks/garden/createGardenOperation.ts` | `GardenOperationConfigBase` |
| `hooks/garden/useCreateGardenWorkflow.ts` | `GardenDraft` |
| `hooks/garden/useSetGardenDomains.ts` | `SetGardenDomainsParams` |
| `hooks/hypercerts/useCreateHypercertWorkflow.ts` | `UseCreateHypercertWorkflowResult` |
| `hooks/hypercerts/useMintHypercert.ts` | `UseMintHypercertOptions` |
| `hooks/utils/useEventListener.ts` | `UseEventListenerOptions` |
| `hooks/work/*.ts` | 5 return/option types |
| `lib/hypercerts/*.ts` | `ContributorStats`, `MerkleLeaf`, `MerkleTree` |
| `modules/**/*.ts` | 5 types across data/job-queue/work modules |
| `providers/Auth.tsx` | `AuthMode` |
| `utils/eas/encoders.ts` | `EncodeWorkDataOptions`, `EncodeAssessmentDataOptions`, etc. |
| `utils/errors/mutation-error-handler.ts` | `MutationErrorHandlerConfig`, etc. |
| `workflows/authMachine.ts` | `RestoreSessionInput`, `PasskeyOperationInput`, `AuthInput` |

---

## Medium Findings

### M1. Unused `devDependency`: `@types/uuid`

`packages/shared/package.json` lists `@types/uuid` but knip reports it as unused.

### M2. `ethers` v6 in `dependencies`

- **File**: `packages/shared/package.json:59`
- **Issue**: `ethers` v6 is listed as a dependency alongside `viem`. The project convention is to use `viem` for all blockchain interactions. Check if `ethers` is still needed or if it can be removed.

### M3. Two Skipped Test Files

- `packages/shared/src/__tests__/utils/ens.test.skip.ts`
- `packages/shared/src/__tests__/utils/text.test.skip.ts`

These are flagged as unused files by knip. They should either be fixed and un-skipped, or deleted if obsolete.

### M4. `INDEXER_TIMEOUT_MS` Duplicate Constant

- **File**: `packages/shared/src/modules/data/graphql-client.ts:148`
- `INDEXER_TIMEOUT_MS` is an alias for `GRAPHQL_TIMEOUT_MS`. This is confusing and should be consolidated.

### M5. `null as any` in AppKit Config

- **File**: `packages/shared/src/config/appkit.ts:71-72`
- Two `null as any` casts for `appKit` and `wagmiConfig`. These should use proper optional types or lazy initialization patterns.

### M6. Toast Messages Not Using i18n

Multiple hooks use hardcoded English strings in `toastService.success/error` calls rather than `intl.formatMessage`. This affects:
- `useGardenerProfile` (12+ hardcoded strings)
- Many other mutation hooks (not audited individually)

### M7. `posthog-js` as Direct Dependency

`posthog-js` is in `dependencies` but is also wrapped by `modules/app/posthog.ts`. Consider if it should be a `peerDependency` instead, since admin/client also list it.

### M8. Barrel File Size (790 Lines)

`packages/shared/src/index.ts` is 790 lines. While this is a barrel file and inherently large, it may benefit from code generation to stay in sync with actual exports.

### M9. Inconsistent Export Patterns

Some modules use `export default` alongside named exports (ConfirmDialog, ErrorBoundary, analytics hooks). The project convention should be named exports only.

### M10. `useWork` Provider Hook Deprecated But Not Marked

- **File**: `packages/shared/src/providers/Work.tsx:158`
- `useWork()` is marked `@deprecated` but is still exported and re-exported through `index.ts` without any deprecation notice in the barrel.

### M11. Unused `TransferRestrictions` Enum Members

- **File**: `packages/shared/src/lib/hypercerts/transactions.ts`
- `DisallowAll` and `FromCreatorOnly` enum members are never used.

### M12. Unused `WeightScheme` Enum Members

- **File**: `packages/shared/src/types/contracts.ts`
- `Exponential` and `Power` enum members are never used.

### M13. Sensitive Data in `modules/auth/session.ts`

- `debugPasskeyConfig` function is exported and exposed through barrel exports. While it only reads data, it logs credential storage keys which could be a debug information leak in production.

### M14. Deep File Nesting in Utilities

`packages/shared/src/utils/` has 6 subdirectory levels. Some paths like `utils/errors/contract-errors.ts` vs `utils/errors/blockchain-errors.ts` vs `utils/errors/tx-error-classifier.ts` suggest these could be consolidated.

### M15. `gql.tada` Dependency May Be Unused

`gql.tada` v1.8.10 is listed in dependencies but its actual usage should be verified. The GraphQL client uses `graphql-request` with `TypedDocumentNode`.

### M16. Multiple GraphQL Client Approaches

The codebase has both `graphql-request` (via `GQLClient`) and `gql.tada` as dependencies, suggesting potentially conflicting GraphQL patterns.

---

## Low Findings

### L1. Lint Warning: Unused `canvas` Variable in Story

- `packages/shared/src/components/Dialog/ConfirmDialog.stories.tsx:176`

### L2. Lint Warning: Unused `needsDarkText` Variable in Story

- `packages/shared/src/components/Tokens/Colors.stories.tsx:267`

### L3. Lint Warning: Unescaped Apostrophe in Story

- `packages/shared/src/components/Tokens/Shadows.stories.tsx:204`

### L4. TODO Comments (2 in Production Code)

1. `packages/shared/src/hooks/gardener/useGardenerProfile.ts:127` -- "Replace with actual GraphQL query"
2. `packages/shared/src/modules/data/eas.ts:436` -- "When implementing pagination"

### L5. `TEMPORAL-SPECIFIC UTILITIES` Comment Label

- `packages/shared/src/utils/time.ts:378` -- Comment says "new in 2026" which will become stale.

### L6. Unused Skipped Tests

- `ens.test.skip.ts` and `text.test.skip.ts` should be deleted or re-enabled.

### L7. `storybook-static` Directory Committed

- `packages/shared/storybook-static/` exists in the working directory (should be in `.gitignore`).

### L8. `coverage` Directory Present

- `packages/shared/coverage/` exists in the working directory (should be in `.gitignore`).

### L9. `debug-storybook.log` File Present

- Should not be tracked; add to `.gitignore`.

### L10. Large `.d.ts` Files

- `types/eas.d.ts` (9,435 lines) and `types/green-goods.d.ts` (4,328 lines) are auto-generated type declarations but may benefit from being split or documented.

### L11. `FormFieldWrapper` Component Exists But Is Not Exported

- `packages/shared/src/components/Form/FormFieldWrapper.tsx` exists but is not exported through the barrel. This may be intentional (internal use only) or an oversight.

---

## Dead Code Summary

### Unused Files (in shared)
| File | Recommendation |
|------|---------------|
| `src/__tests__/utils/ens.test.skip.ts` | Delete or re-enable |
| `src/__tests__/utils/text.test.skip.ts` | Delete or re-enable |

### Deprecated Code Ready for Removal
| Symbol | File | Deprecated For |
|--------|------|---------------|
| `initializePinata` | `modules/data/ipfs.ts` | `initializeIpfs` |
| `initializePinataFromEnv` | `modules/data/ipfs.ts` | `initializeIpfsFromEnv` |
| `PASSKEY_STORAGE_KEY` | `modules/auth/session.ts` | `CREDENTIAL_STORAGE_KEY` |
| `hasStoredPasskey` | `modules/auth/session.ts` | `hasStoredCredential` |
| `clearStoredPasskey` | `modules/auth/session.ts` | `clearStoredCredential` |
| `INDEXER_TIMEOUT_MS` | `modules/data/graphql-client.ts` | `GRAPHQL_TIMEOUT_MS` |
| `useWork` (provider) | `providers/Work.tsx` | `useWorkSelection`/`useWorkFormContext` |
| `WorkDraft` type | `types/domain.ts` | `WorkSubmission` |
| `CreateAssessmentForm` | `types/index.ts` | `AssessmentWorkflowParams` |

---

## Anti-Patterns

| Issue | Location | Severity |
|-------|----------|----------|
| God object | `modules/data/hypercerts.ts` (939 lines) | MEDIUM |
| God object | `modules/job-queue/index.ts` (852 lines) | MEDIUM |
| God object | `hooks/vault/useVaultOperations.ts` (762 lines) | MEDIUM |
| Duplicate exports | 6 files with named + default exports | MEDIUM |
| `as any` bypasses | 15 non-import.meta casts in production code | HIGH |
| Placeholder query | `useGardenerProfile` always returns null | HIGH |
| Deprecated re-exports | 9 symbols still in barrel | HIGH |

---

## Green Goods Violations

| Rule | Violation | Location |
|------|-----------|----------|
| Hook boundary | `useGardenDetailData` in admin (not shared) | `packages/admin/src/views/Gardens/Garden/useGardenDetailData.ts` |
| No console.log | None found (clean) | N/A |
| Address type | No violations found | N/A |
| No package .env | None found (clean) | N/A |
| Barrel imports | No deep-path imports from outside shared | N/A |
| No hardcoded addresses | Only zero-address fallbacks + test fixtures | N/A |

---

## Skill & Configuration Drift

| Reference | Location | Status |
|-----------|----------|--------|
| `useTimeout` | hooks/utils | Exists |
| `useDelayedInvalidation` | hooks/index | Exists |
| `useEventListener` | hooks/utils | Exists |
| `useWindowEvent` | hooks/utils (via useEventListener) | Exists |
| `useDocumentEvent` | hooks/utils (via useEventListener) | Exists |
| `useAsyncEffect` | hooks/utils | Exists |
| `useAsyncSetup` | hooks/utils (via useAsyncEffect) | Exists |
| `useOffline` | hooks/app | Exists |
| `useServiceWorkerUpdate` | hooks/app | Exists |
| `useDraftAutoSave` | hooks/work | Exists |
| `useDraftResume` | hooks/work | Exists |
| `useJobQueue` | providers/JobQueue | Exists |
| `parseContractError` | utils/errors | Exists |
| `createMutationErrorHandler` | utils/errors | Exists |
| `mediaResourceManager` | modules/job-queue | Exists |
| `getStorageQuota` | utils/storage | Exists |
| `jobQueue` | modules/job-queue | Exists |
| `jobQueueEventBus` | modules/job-queue/event-bus | Exists |
| `logger` | modules/app | Exists |
| `toastService` | components/Toast | Exists |
| `Address` type | types/domain | Exists |
| `Garden` type | types/domain | Exists |
| `Work` type | types/domain | Exists |
| `Action` type | types/domain | Exists |
| `WorkApproval` type | types/domain | Exists |
| `GardenAssessment` type | types/domain | Exists |
| `Job` type | types/job-queue | Exists |
| `JobKind` type | types/job-queue | Exists |
| `WorkDraft` type | types/domain | Exists |
| `OfflineStatus` type | types/offline | Exists |
| `@storybook/addon-actions` | `.storybook/main.ts` | **MISSING -- not installed** |

**No drift detected** in hooks, utilities, or types. All skill references are valid. One unresolved Storybook dependency.

---

## Recommendations

### Priority 1 (Critical)
1. Install `@storybook/addon-actions` or remove from Storybook config
2. Fix 14 failing test files (32 tests)
3. Fix unsafe `finally` block in `useTranslation`

### Priority 2 (High)
4. Add tests for untested conviction hooks (12 hooks, zero coverage)
5. Remove deprecated exports from barrel files (`clearStoredPasskey`, `initializePinata*`, etc.)
6. Remove duplicate `default` exports -- standardize on named exports
7. Implement or remove `useGardenerProfile` placeholder query
8. Add i18n support to `MethodSelector`, `ConfidenceSelector`, `ErrorBoundary`

### Priority 3 (Medium)
9. Audit `ethers` dependency -- remove if unused
10. Clean up unused exports flagged by knip (prioritize removing over keeping)
11. Split `modules/data/hypercerts.ts` (939 lines) by concern
12. Consolidate error utility files (`contract-errors.ts`, `blockchain-errors.ts`, `tx-error-classifier.ts`)
13. Remove skipped test files or re-enable them

### Priority 4 (Low)
14. Fix 3 lint warnings in story files
15. Delete `storybook-static/`, `coverage/`, `debug-storybook.log` from working tree
16. Remove stale date comment in `utils/time.ts`
