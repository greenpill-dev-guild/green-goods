# Agent 7 — Legacy, Deprecated, and Fallback Code Paths

Scope: `/Users/afo/Code/greenpill/green-goods`, `packages/{shared,client,admin,indexer,ops,agent,contracts}/src` only. `node_modules`, `generated/`, `lib/`, `dist/`, `build/` excluded.

---

## 1. Executive Summary

The codebase is in good shape. Most `@deprecated` annotations still have active callers (backward-compat aliases), and legacy paths that exist are either (a) intentional iOS-Safari IndexedDB migration fallbacks, (b) Solidity storage-slot preservations for UUPS upgrades, (c) optional module zero-address sentinels called out in CLAUDE.md, or (d) legacy contract error selectors kept on purpose.

Warm-glass is fully retired at the code level — zero matches for `warm[-_]glass` / `warmGlass` / `warm-tint` anywhere under `packages/*/src`. Pre-M3 admin styles are gone. Hub has been decomposed into `views/Hub/index.tsx` + `views/Hub/components/*`. Dialog split is complete (DialogShell default, AdminDialog reserved for CookieJar modals per its Storybook doc).

Rough deletable-line budget: **~50-100 LOC** of safe removals, with ~200-400 LOC of medium-confidence deprecation sweeps that would require updating many call sites to non-deprecated aliases (mechanical but high-touch).

High-signal removals (unused deprecated exports):
- `ACCOUNT_SHEET_CONTENT_ID` (admin, 1 LOC) — zero consumers
- `WorkStatus` alias (shared, 2 LOC + barrel re-exports) — zero client/admin consumers (the new `WorkDisplayStatus` is used everywhere)
- `isZeroAddressValue` alias + its two barrel re-exports — zero consumers
- `useWork()` combined hook + `WorkContext` (~60 LOC) — zero production consumers; only test-file callers

---

## 2. HIGH-CONFIDENCE REMOVE

### 2.1 `ACCOUNT_SHEET_CONTENT_ID` — zero consumers
File: `packages/admin/src/components/Layout/accountSheet.events.ts:7-8`
```ts
/** @deprecated Use PROFILE_SHEET_CONTENT_ID or SETTINGS_SHEET_CONTENT_ID */
export const ACCOUNT_SHEET_CONTENT_ID = "account";
```
- `grep -rn ACCOUNT_SHEET_CONTENT_ID packages/` returns only the declaration line.
- All real call sites use `PROFILE_SHEET_CONTENT_ID` / `SETTINGS_SHEET_CONTENT_ID`.
- Safe to delete.

### 2.2 `WorkStatus` alias — zero client/admin consumers
File: `packages/shared/src/components/Cards/WorkCard/WorkCard.tsx:31-37`, plus barrel re-exports at:
- `packages/shared/src/components/Cards/WorkCard/index.ts:8`
- `packages/shared/src/components/Cards/index.ts:36`
- `packages/shared/src/components/index.ts:59`
- `packages/shared/src/index.ts:78`
```ts
/** @deprecated Use `WorkDisplayStatus` from `@green-goods/shared` instead. */
export type WorkStatus = WorkDisplayStatus;
```
- Zero hits for `WorkStatus\b` outside the WorkCard declaration and the 4 re-exports.
- Every real consumer uses `WorkDisplayStatus` directly (`packages/client/src/__tests__/views/WorkViewSection.test.tsx`, `packages/shared/src/components/StatusBadge.tsx`, etc.).
- The `status: WorkStatus` prop on the WorkCard component (line 37) just needs to be retyped to `WorkDisplayStatus`.

### 2.3 `isZeroAddressValue` alias — zero consumers
File: `packages/shared/src/utils/blockchain/vaults.ts:50-51`
```ts
/** @deprecated Use `isZeroAddress` from `./address` instead. */
export const isZeroAddressValue = isZeroAddress;
```
- Barrel re-exports at `packages/shared/src/utils/index.ts:167` and `packages/shared/src/index.ts:987`.
- Zero callers found across the monorepo.
- Safe to delete, including the two barrel lines.

### 2.4 Dead `describe.skip` test blocks with stale TODOs
- `packages/shared/src/__tests__/utils/contracts.greenwill.test.ts:1-` — entire file is `describe.skip` predicated on "when ABIs and addresses are exported". ABIs ARE exported (`GreenWillRegistryABI`, `GreenWillSupportRouterABI`) in `contracts.ts`, but `GreenWillUnlockModuleABI` and `getNetworkContracts(chainId).greenWill*` fields don't exist. Either implement the surface the test expects, or delete the file — currently it's a permanent TODO that lint treats as passing.
- `packages/shared/src/__tests__/hooks/greenwill/useGreenWillHooks.test.tsx:90` — same pattern (`// TODO: Enable when GreenWill query keys and contract surface are wired`). GreenWill hooks DO exist (`useGreenWillBadges`, `useGreenWillBadgeDefinitions`, `useGreenWillRecentGrants`, `useGreenWillSupportDeposit`), so the test is likely partially-skipped rather than entirely skipped; worth auditing.

---

## 3. HIGH-CONFIDENCE SIMPLIFY

### 3.1 `useWork()` combined hook — zero production consumers
File: `packages/shared/src/providers/Work.tsx:155-162`
```ts
/** @deprecated Consider using useWorkSelection or useWorkFormContext for better performance */
export const useWork = () => useContext(WorkContext);
```
- Callers: `packages/shared/src/__tests__/providers/WorkProvider.test.tsx` (tests of the hook itself, 17 call sites).
- Zero client/admin production usage — `client/src/views/Garden/index.tsx` already uses `useWorkSelection` + `useWorkFormContext`.
- Removing the hook + its `WorkContext`/`legacyValue` (~60 LOC in `Work.tsx` lines 110-125, 362-420) is a pure simplification, assuming the tests are updated or deleted.

### 3.2 `WorkDraft = WorkSubmission` alias — safe at the type level
File: `packages/shared/src/types/domain.ts:388-390`
```ts
/** @deprecated Use WorkSubmission instead. Kept for backward compatibility. */
export type WorkDraft = WorkSubmission;
```
- Heavy usage (~25 call sites) but all locations use `WorkDraft` as an alias that resolves to the same type, so renaming is mechanical (find-replace + barrel updates). Pure type alias, no runtime impact.
- Either: rename all call sites to `WorkSubmission` OR drop the `@deprecated` tag (keep as permanent public alias). Having it `@deprecated` with 25 live callers signals technical debt without a clear migration path.

### 3.3 `CreateAssessmentForm = AssessmentWorkflowParams` alias
File: `packages/shared/src/types/domain.ts:541-542`
- Same pattern as 3.2. Widely used (see `useCreateAssessmentForm()` hook name). Either complete the rename or remove the deprecation tag — the name `CreateAssessmentForm` is actually more ergonomic for UI code that thinks in forms, not workflow params.

### 3.4 Rename-shim barrel cleanup: `ZERO_ADDRESS` re-export in `vaults.ts`
File: `packages/shared/src/utils/blockchain/vaults.ts:6-7`
```ts
// Re-export for backward compatibility (canonical source is address.ts)
export { ZERO_ADDRESS };
```
- Canonical export is at `packages/shared/src/utils/blockchain/address.ts:117`. This is a legacy alias.
- Whether to remove depends on how many consumers import `ZERO_ADDRESS` from `./vaults` vs `./address` — medium-sized sweep but mechanical. If kept, should be annotated `@deprecated`.

---

## 4. MEDIUM

### 4.1 `useContractTxSender` — widely used despite `@deprecated`
File: `packages/shared/src/hooks/blockchain/useContractTxSender.ts:15`
- ~20+ production consumers in shared hooks (garden/, conviction/, cookie-jar/, yield/). Modern `useTransactionSender` is used in ~10 others (work/, vault/, greenwill/).
- This is the largest open migration. Both call patterns coexist. Decide: keep both APIs long-term (remove `@deprecated`) or budget a sweep to migrate conviction/cookie-jar/yield.

### 4.2 `useAuth` — widely used despite `@deprecated`
File: `packages/shared/src/hooks/auth/useAuth.ts:94`
- Still the recommended public API per the JSDoc `@example` block at the top of the file. The `@deprecated` tag says "prefer useAuthState/useAuthActions in new code", but `JobQueue.tsx`, `SyncStatusBar.tsx`, `useENSClaim.ts`, `useGardenerProfile.ts`, and many test mocks use `useAuth`.
- Same call: drop `@deprecated` OR commit to migrating consumers. Having deprecation text in docstrings that the project itself ignores is a quality-smell.

### 4.3 `getStoredRpId`/`setStoredRpId`/`clearStoredRpId` — only tests consume these
File: `packages/shared/src/modules/auth/session.ts:93`
- Grep shows exactly one non-self, non-export-barrel call site: `packages/shared/src/__tests__/workflows/authServices.test.ts:156` (a `vi.fn()` mock).
- Barrel export at `packages/shared/src/modules/index.ts:124` still exposes it publicly.
- `setStoredRpId` and `clearStoredRpId` have no callers either — so the whole RP-ID localStorage getter/setter surface could be collapsed, keeping only the `getPasskeyRpId()` canonical path in `passkeyServer.ts`.
- Caveat: `clearAllAuth()` still calls `localStorage.removeItem(RP_ID_STORAGE_KEY)` for safety. The storage key constant is used; only the getter/setter wrappers are dead.

### 4.4 `utils/query-invalidation.ts` and `utils/admin-routes.ts` — pure re-export shims
Files:
- `packages/shared/src/utils/query-invalidation.ts` — 9 LOC shim that re-exports from `../config/query-keys/schedule`.
- `packages/shared/src/utils/admin-routes.ts` — 20 LOC shim that re-exports from `./navigation/admin-routes`.
- External consumers: only `packages/shared/src/utils/index.ts` (2 lines). No package/admin/client code imports from these shim paths.
- The barrel could re-export directly from the canonical paths, letting both shim files be deleted.

### 4.5 TODO comments inventory — one stale group, most reasonable
Full non-test TODO inventory:
1. `packages/shared/src/providers/Auth.tsx:230` — "Verify connector.id against actual AppKit version". Stale-ish: has been living next to the heuristic since AppKit integration. Worth filing an issue or accepting the heuristic.
2. `packages/shared/src/hooks/gardener/useGardenerProfile.ts:128` — "Replace with GraphQL query once indexer supports gardener profiles". Keep (real blocker).
3. `packages/shared/src/modules/transactions/embedded-sender.ts:52,93` — EIP-5792 migration plan, with an 11-line commented-out example block (see §8.1). Keep (documents the intended replacement).
4. `packages/shared/src/modules/transactions/passkey-sender.ts:57` — batch via `sendUserOperation` when `permissionless` supports it. Keep.
5. `packages/shared/src/modules/transactions/wallet-sender.ts:68` — EIP-5792 probe. Keep.
6. `packages/shared/src/modules/data/eas.ts:434` — pagination plan in a JSDoc. Keep (forward-looking doc).
7. `packages/client/src/views/Home/GardenList.tsx:138` — virtualize when `gardens.length > 50`. Keep (perf guardrail).
8. Test TODOs in `__tests__/utils/contracts.greenwill.test.ts:9` and `__tests__/hooks/greenwill/useGreenWillHooks.test.tsx:90` — see §2.4 (real stale).
9. `packages/shared/src/components/SyncStatusBar.stories.tsx:5` — explanation of why Storybook coverage is limited (keep as doc, not really a TODO).
10. `packages/shared/src/hooks/hypercerts/useMintHypercert.ts:144` — `// for AbortSignal, which is not currently available.` Dangling comment with no actionable next step; trim or reword.

No `FIXME`, `HACK`, `XXX`, or `KLUDGE` instances anywhere in `packages/*/src`. Clean.

### 4.6 Auto-init for "backward compatibility" in posthog.ts
File: `packages/shared/src/modules/app/posthog.ts:525-528`
```ts
// Auto-initialize for backward compatibility (only in browser)
if (typeof window !== "undefined") {
  initNetworkTracking();
}
```
- `initNetworkTracking` has zero external consumers — so either the auto-init is the only way it runs (in which case the "backward compatibility" comment is misleading — it's the sole entry point), or it's a side-effect import that should be made explicit in `providers/App.tsx`.
- Low priority. Worth a one-line comment audit to clarify intent.

---

## 5. LOW — Intentional fallbacks (leave alone)

### 5.1 Zero-address fallbacks for optional modules
File: `packages/shared/src/config/blockchain.ts:201-222`
- 14 `deployment.X || "0x00...00"` fallbacks for contracts like `octantModule`, `hatsModule`, `karmaGAPModule`, `eas`, `easSchemaRegistry`, etc.
- Per CLAUDE.md: "Zero addresses mean the module hasn't been deployed yet (not a blocker for optional modules)."
- Keep. This is the documented pattern.

### 5.2 iOS Safari `fileData` vs legacy `file` in IndexedDB
Files: `packages/shared/src/types/job-queue.ts:143,222`, `packages/shared/src/utils/storage/file-serialization.ts:55-96`
- `@deprecated file?: File` on `JobQueueDBImage` and `DraftImage` is a real migration fallback for users whose IndexedDB was populated before the `SerializedFileData` switch. `deserializeFile()` handles both formats.
- `job-executors.ts:20`, `useBatchWorkSync.ts:89`, and `db.ts:351` read `img.file`, but the source is `deserializeFile()` which reconstructs a fresh `File` from `fileData` when present. The legacy path (`stored.file instanceof File`) is the iOS-Safari-broken path; keeping it is correct for old records.
- Keep. Removable only after a known cutover date + migration script.

### 5.3 Solidity `__deprecated_*` storage slots
Files:
- `packages/contracts/src/markets/HypercertMarketplaceAdapter.sol:111`
- `packages/contracts/src/modules/Octant.sol:104`
- Preserving slot layout for UUPS-upgradeable contracts. MUST stay.

### 5.4 Legacy contract-error selector
File: `packages/shared/src/utils/errors/contract-errors.ts:183-184`
```ts
// Legacy selector (NotGardenerAccount) - kept for backward compatibility
"0x8cb4ae3b": { … },
```
- Known rewriting of the `NotGardenerAccount` selector; old transaction receipts in user history can still surface this selector. Keep.

### 5.5 `WorkMetadataV1` type + `isV1Metadata` guard
Files: `packages/shared/src/types/domain.ts:435-438`, `packages/client/src/views/Home/Garden/WorkViewSection.tsx:59-64,134`
- Old attestations on-chain use the `plantCount`/`plantSelection` shape. The v1 fallback is consulted only in display code. Immutable on-chain data means this path stays forever (or until a migration re-issues attestations).
- Keep.

### 5.6 `cached_work` IndexedDB object store
File: `packages/shared/src/modules/job-queue/db.ts:60-65`
```ts
// Keep cached work for backward compatibility
if (!db.objectStoreNames.contains("cached_work")) { … }
```
- Schema migration safety — IndexedDB schema churn for users requires keeping the store. Keep.

### 5.7 `AdminDialog` coexisting with `DialogShell`
Per the `AdminDialog.stories.tsx:15` Storybook doc, `AdminDialog` is intentionally reserved for CookieJar deposit/withdraw/manage modals (strict M3 Basic Dialog). Three modals use it (`CookieJarDepositModal`, `CookieJarWithdrawModal`, `CookieJarManageModal`). This is the documented architecture, not legacy.
- Keep.

### 5.8 Translation API legacy fallback
File: `packages/shared/src/modules/translation/browser-translator.ts`
- Chrome 125-126 exposed a `self.translation` API before the spec moved to `self.ai`. The browser-translator holds handles to both (`aiApi`, `legacyApi`). Removable when we drop Chrome <127 support.
- Keep for now.

### 5.9 Theme `@supports (color-mix(…))` legacy browser fallback
File: `packages/shared/src/utils/styles/theme.ts:89` + `packages/shared/src/hooks/app/useTheme.ts:59`
- Kept for browsers without `color-mix`. Keep (progressive enhancement).

---

## 6. Post-M3-migration leftovers

### 6.1 Warm-glass — **fully retired**
- Zero matches for `warm[-_]glass`, `warmGlass`, `warm-tint`, `warm_tint` anywhere under `packages/*/src`. Retirement (2026-04-17) is complete at the code level.

### 6.2 Pre-split Dialog code — **none remaining**
- `DialogShell` is exported from `packages/shared/src/components/Dialog/ConfirmDialog.tsx` and consumed by 5 admin modals (GardenProfileModal, GardenDomainEditor, AddMemberModal, ManageRolesModal, MembersModal).
- `AdminDialog` is intentionally kept for CookieJar modals (see §5.7).
- No dangling pre-split scaffolding.

### 6.3 Pre-decomposition Hub — **none remaining**
- `packages/admin/src/views/Hub/index.tsx` is the single entry point. Components decomposed into `views/Hub/components/` (18 files). Memory says 1376→605 LOC — current file is within that range.
- `legacyItemId` in `Hub/index.tsx:86,236-278` is **not** pre-decomposition debt — it handles the legacy `?item=…` query parameter that can point at a work, certification, or history event. Kept for URL back-compat. Reasonable to keep.

### 6.4 Pre-strict-M3 admin styles — **none remaining**
- No references to "strict M3" precursors (M3 expressive mixing warm glass, etc.) — the 13 `Admin*` wrappers are fully in place.
- `packages/admin/src/components/Layout/CanvasLayout.tsx:64` still says "No sidebar, no legacy header, no layout shift" which is the positive summary of the refactor. Not a marker that anything still exists.

---

## 7. Rename shims (`export { X as Y }`)

Non-test `export { X as Y }` forms found:

| File | Line | Shim | Status |
|---|---|---|---|
| `packages/shared/src/components/Cards/CardBase.tsx` | 191 | `SurfaceCardBody as CardBody` | `CardBody` is the public name; `SurfaceCardBody` is internal. Keep. |
| `packages/shared/src/hooks/index.ts` | 254 | `useAttestations as useHypercertAttestations` | Intentional namespacing to avoid confusing with EAS attestations. Keep. |
| `packages/shared/src/i18n/index.ts` | 2-4 | `default as en`/`es`/`pt` | Standard JSON-default-to-named-export. Keep. |
| `packages/client/src/components/Actions/Button/Base.tsx` | 314 | `ButtonRoot as Root, ButtonIcon as Icon` | Compound-component API pattern. Keep. |
| `packages/client/src/components/Inputs/TextField/Text.tsx` | 7 | `FormTextarea as FormText` | Usage not audited. If `FormText` is consumed, keep; otherwise drop one side. |
| `packages/admin/src/components/Garden/index.ts` | 15 | `ReviewStep as GardenReviewStep` | Disambiguation vs other `ReviewStep`s in the flow. Keep. |

No rename shims flagged as stale (i.e., both names actively consumed indicates disambiguation, not legacy).

---

## 8. Commented-out code blocks > 2 lines

Only **one** real multi-line commented-out code block exists across all of `packages/{shared,client,admin}/src`:

### 8.1 EIP-5792 example stub
File: `packages/shared/src/modules/transactions/embedded-sender.ts:52-62`
```ts
// TODO: Use EIP-5792 sendCalls with paymasterService capability when
// @wagmi/core/experimental becomes available:
//
// const id = await sendCalls(this.config, {
//   calls: [{ to: call.address, data: encodeFunctionData(...), value: call.value }],
//   capabilities: {
//     paymasterService: { url: this.erc7677ProxyUrl },
//   },
// });
// const status = await getCallsStatus(this.config, { id });
// return { hash: status.receipts[0].transactionHash, sponsored: true };
```
**Verdict**: This is intentional — it's the migration target, inline so the next developer doesn't need to rediscover the API shape. Keep as-is, but if you want to trim, move to a GitHub issue linked from the TODO line.

No other commented-out code blocks > 2 lines were found. All other "3-line comment cluster" matches turned out to be JSDoc/contextual comments, not commented-out code.

---

## 9. Not flagged but worth a second look

These are patterns I scanned that came back clean — recording so you don't need to re-run:

- **No feature flags**: Zero hits for `VITE_FEATURE_*`, `FEATURE_FLAG`, `featureFlags`, `*_ENABLED` patterns beyond `VITE_ENABLE_SW_DEV` (explicit dev-only SW toggle, keep) and `VITE_MOCK_PWA_INSTALLED` (test-only, keep).
- **No version gates**: No `if (version >= X)` comparisons in source.
- **No component V1/V2 parallels**: No `ButtonV1`/`ButtonV2` or similar pairs. `WorkMetadataV1` + `WorkMetadata` is the only V1/V2 shape and its use is limited to deserialization guards (see §5.5).
- **No old API endpoints or chain IDs**: Chain IDs 42161/42220/11155111 are the three supported chains; localhost test chain is a test-only constant.
- **No orphan redirect routes**: `route-folding.test.ts` enforces that old top-level `/assessments` and `/endowments` are absent. Current `admin/src/router.tsx` passes the test — only the expected three index redirects (`HubIndexRedirect`, `GardenIndexRedirect`, `CommunityIndexRedirect`) remain.

---

## 10. Suggested action order

1. **No-cost deletions** (§2.1, §2.2, §2.3): ~10 LOC each, no call-site updates needed.
2. **Stale test audit** (§2.4): decide per file — implement the pending surface or delete the skip.
3. **Deprecation policy decision** (§3.2, §3.3, §4.1, §4.2): `@deprecated` with dozens of in-repo consumers is worse than no tag. Pick one: commit to migration or drop the tag.
4. **`useWork()` simplification** (§3.1): ~60 LOC removal + test file updates. Pure win once tests updated.
5. **Shim flattening** (§4.4): swap barrel imports to canonical paths, delete 2 files (~30 LOC).
6. **Session RP-ID surface cleanup** (§4.3): remove unused setter/clearer; keep `getStoredRpId` only if the mock in `authServices.test.ts` is essential — otherwise delete both.

Agent 3 (dead code) and Agent 6 (defensive code) will likely overlap on items §3.1, §3.2 (as type simplification), §4.3, and the vault `ZERO_ADDRESS` re-export — please cross-check before edits.
