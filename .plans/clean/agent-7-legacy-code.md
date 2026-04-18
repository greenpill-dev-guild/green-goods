# Agent 7 — Legacy, Deprecated, and Fallback Code

Scope: `packages/{admin,shared,client,contracts}` only. Agent/indexer/ops dropped.
Dry-run — no source edits. Session reframe: unadopted primitives and `@deprecated` tags with many callers are debt, not scaffolding.

---

## 1. Executive Summary

Warm-glass is gone. Pre-split Dialog is gone. Pre-decomposition Hub is gone. The M3 retirement is complete at the code level — zero hits for `warm-glass`, `warmGlass`, `warm-tint` anywhere in `packages/*/src`.

What remains is **deprecation drift**: 10 `@deprecated` JSDoc tags in scope, of which 3 have zero callers (safe delete), 2 have only self-callers or tests (trim-to-zero possible), and 5 have 20+ live callers with no migration in motion. Per the reframe, the 5 "heavy" ones should either commit to a sweep or drop the tag — a `@deprecated` tag that the project itself ignores is noise.

One genuinely dead feature-flag type declaration: `VITE_ENABLE_RPC_BG_SYNC` is declared in 3 `vite-env.d.ts` files and has zero runtime reads. Type-only carcass.

Contracts: two `__deprecated_*` storage slots remain (UUPS slot preservation — MUST stay). One legacy contract-error selector is intentional (`0x8cb4ae3b` / `NotGardenerAccount`). Defensive ABI fallbacks in `Gardens.sol`, `Garden.sol`, `Yield.sol` are intentional (Gardens V2 interop).

One commented-out code block > 2 lines remains: the EIP-5792 migration example in `embedded-sender.ts`, intentionally inline for the next developer.

Rough removable-line budget in scope: ~30 LOC of zero-risk deletions, another ~60 LOC if `useWork()` combined hook is retired, another ~300–500 LOC if the project commits to migrating the heavy `@deprecated` items.

---

## 2. HIGH-CONFIDENCE REMOVE (zero callers or dead type)

### 2.1 `ACCOUNT_SHEET_CONTENT_ID` — zero consumers
File: `packages/admin/src/components/Layout/accountSheet.events.ts:7-8`
```ts
/** @deprecated Use PROFILE_SHEET_CONTENT_ID or SETTINGS_SHEET_CONTENT_ID */
export const ACCOUNT_SHEET_CONTENT_ID = "account";
```
Grep confirms: declaration is the only hit across admin/shared/client. Safe delete.

### 2.2 `isZeroAddressValue` alias — zero consumers
File: `packages/shared/src/utils/blockchain/vaults.ts:50-51`
```ts
/** @deprecated Use `isZeroAddress` from `./address` instead. */
export const isZeroAddressValue = isZeroAddress;
```
Barrel re-exports at `packages/shared/src/utils/index.ts:167` and `packages/shared/src/index.ts:987`. Zero downstream callers. Delete alias + 2 barrel lines.

### 2.3 `WorkStatus` type alias — no external consumers
Files:
- `packages/shared/src/components/Cards/WorkCard/WorkCard.tsx:31-37` (declaration + used as the `status:` prop type on `WorkCardData`)
- Barrel re-exports: `WorkCard/index.ts:8`, `Cards/index.ts:36`, `components/index.ts:59`, `shared/src/index.ts:78`

The alias is an unmigrated self-reference: `WorkCard.tsx` line 37 declares `status: WorkStatus` on `WorkCardData`, but every external consumer already imports `WorkDisplayStatus` directly. Retyping the one field to `WorkDisplayStatus` drops the alias cleanly. ~6 LOC removed across 5 files.

### 2.4 `VITE_ENABLE_RPC_BG_SYNC` — dead env var type declaration
Files:
- `packages/admin/src/vite-env.d.ts:10`
- `packages/shared/src/vite-env.d.ts:12`
- `packages/client/src/vite-env.d.ts:9`

Zero runtime reads of `import.meta.env.VITE_ENABLE_RPC_BG_SYNC` in any package. Type-only carcass from a feature that never landed (or was ripped). Safe to delete all three lines. (Compare to `VITE_ENABLE_SW_DEV` which is actively read in `service-worker.ts` and `useServiceWorkerUpdate.ts`.)

### 2.5 `describe.skip` blocks with permanently-stale predicates
- `packages/shared/src/__tests__/utils/contracts.greenwill.test.ts:10` — `describe.skip("utils/blockchain/contracts GreenWill surface", …)` predicated on "when ABIs and addresses are exported". `GreenWillRegistryABI` and `GreenWillSupportRouterABI` exist in `contracts.ts`, but `GreenWillUnlockModuleABI` and `getNetworkContracts(chainId).greenWill*` fields don't. The describe predicate will never flip true without new contract surface.
- `packages/shared/src/__tests__/hooks/greenwill/useGreenWillHooks.test.tsx:91` — same pattern. The hooks (`useGreenWillBadges`, `useGreenWillBadgeDefinitions`, `useGreenWillRecentGrants`, `useGreenWillSupportDeposit`) DO exist, so this skip is even staler.
- `packages/admin/src/__tests__/components/MembersModal.test.tsx:103,214,222` — three `it.skip` on backdrop-click and body-scroll behavior. No predicate, no issue link. Stale.

Decide: implement the assertions or delete the skipped blocks.

---

## 3. HIGH-CONFIDENCE SIMPLIFY

### 3.1 `useWork()` combined-context hook — zero production consumers
File: `packages/shared/src/providers/Work.tsx:155-162`
```ts
/** @deprecated Consider using useWorkSelection or useWorkFormContext for better performance */
export const useWork = () => useContext(WorkContext);
```
Only callers: `packages/shared/src/__tests__/providers/WorkProvider.test.tsx` (17 `renderHook(() => useWork(), …)` call sites — testing the deprecated hook itself). Client/admin all use `useWorkSelection` + `useWorkFormContext`.

Removing the hook + `WorkContext` + `legacyValue` shim is ~60 LOC in `Work.tsx`. The 16-test file either gets rewritten to test the split hooks, or deleted if those already have coverage.

### 3.2 `query-invalidation.ts` — pure re-export shim (1 non-trivial consumer)
File: `packages/shared/src/utils/query-invalidation.ts`
```ts
/** @deprecated Prefer imports from ../config/query-keys/schedule. */
```
External consumers: only `packages/shared/src/utils/index.ts:285` (which re-exports two types). Zero consumer code imports from the shim path — the barrel uses it as an indirection.

Action: point the barrel directly at `../config/query-keys/schedule`, delete the shim file.

### 3.3 `admin-routes.ts` — pure re-export shim, zero consumers
File: `packages/shared/src/utils/admin-routes.ts`
```ts
/** @deprecated Prefer imports from ../utils/navigation/admin-routes. */
```
Zero consumers anywhere in scope. Delete the file + the barrel's reference to it (if any — prior grep shows no barrel pointer at all, so it may already be orphaned).

### 3.4 `ZERO_ADDRESS` re-export from `vaults.ts` — not `@deprecated`, but a legacy shim
File: `packages/shared/src/utils/blockchain/vaults.ts:6-7`
```ts
// Re-export for backward compatibility (canonical source is address.ts)
export { ZERO_ADDRESS };
```
7 in-repo imports of `ZERO_ADDRESS` from `./blockchain/vaults` (cookie-jar × 3, vault × 2, vault-helpers, et al.). Mechanical find-replace to canonical `./blockchain/address` source, then drop the re-export.

---

## 4. `@deprecated` Policy Table (in-scope caller counts)

| Symbol | File | Caller count (prod/test/decl) | Recommendation |
|---|---|---|---|
| `ACCOUNT_SHEET_CONTENT_ID` | `admin/src/components/Layout/accountSheet.events.ts:7` | 0 / 0 / 1 | **Delete** |
| `isZeroAddressValue` | `shared/src/utils/blockchain/vaults.ts:50` | 0 / 0 / 3 (decl + 2 barrel) | **Delete** |
| `WorkStatus` type alias | `shared/src/components/Cards/WorkCard/WorkCard.tsx:31` | 1 self / 0 / 4 barrel | **Delete** (retype `WorkCardData.status` to `WorkDisplayStatus`) |
| `useWork()` | `shared/src/providers/Work.tsx:158` | 0 / 16 / 1 | **Delete** + rewrite the 16 tests against `useWorkSelection`/`useWorkFormContext` |
| `WorkDraft` type alias | `shared/src/types/domain.ts:388` | 25 prod / 3 test / 2 barrel | **Drop the tag** — `WorkDraft` is the ergonomic form-side name and `WorkSubmission` reads as a runtime payload; both names carry meaning. Keep as permanent public alias, drop the `@deprecated` |
| `CreateAssessmentForm` type alias | `shared/src/types/domain.ts:541` | 6 prod / 6 test / 4 barrel | **Drop the tag** — `CreateAssessmentForm` is the UI-side form name, `AssessmentWorkflowParams` is the state-machine params. Both names are load-bearing |
| `useContractTxSender` | `shared/src/hooks/blockchain/useContractTxSender.ts:15` | 25 prod (14 hooks) / 11 test | **Commit to sweep** — clean domain split (conviction/cookie-jar/garden/yield still on legacy; work/vault/greenwill on `useTransactionSender`). This is the single largest migration. Pick a sprint to finish the 4 remaining hook domains |
| `useAuth()` | `shared/src/hooks/auth/useAuth.ts:94` | ~30 prod / ~20 test | **Drop the tag** — JSDoc at top of file literally says "recommended public API." The `@deprecated` line contradicts the rest of the file's own documentation. `useAuthState` + `useAuthActions` are fine for granular use, but `useAuth()` is the ergonomic combined-consumer API |
| `compressImages()` (method) | `shared/src/utils/work/image-compression.ts:145` | 2 prod / 0 test | **Commit to sweep** — `FileUploadField.tsx:67` and `client/Media.tsx:240` still call `.compressImages(...)`. `.compressImagesParallel(...)` has zero callers. Flip the 2 callers, delete the deprecated method. Small, worth doing |
| `getStoredRpId()` | `shared/src/modules/auth/session.ts:93` | 0 prod / 1 test-mock / 1 barrel | **Delete** — the comment says primary source is `getPasskeyRpId()` from `passkeyServer.ts`; `getStoredRpId` truly has zero production callers. Drop it + its test mock + the barrel entry |
| `JobQueueDBImage.file` | `shared/src/types/job-queue.ts:143` | Read by `job-executors.ts`, `useBatchWorkSync.ts:89`, `db.ts:351` | **Keep** — iOS-Safari IndexedDB migration fallback. `deserializeFile()` reconstructs a `File` from `fileData`; the `file?: File` path handles records written before the switch. Removable only after migration script. Documented |
| `DraftImage.file` | `shared/src/types/job-queue.ts:222` | Same as above | **Keep** — same iOS fallback, same reasoning |

Note: the "Keep" rows have a legitimate why-we-kept-it. The "Drop the tag" rows are the pattern your reframe targets — debt without a migration path that should stop signaling migration intent.

---

## 5. MEDIUM — stale TODOs, feature-flag comment drift

### 5.1 TODO inventory (non-test, in scope)
Count: 10 non-test TODOs.

1. `packages/shared/src/providers/Auth.tsx:230` — "Verify connector.id against actual AppKit version — may also be embedded"
2. `packages/shared/src/hooks/gardener/useGardenerProfile.ts:128` — "Replace with GraphQL query once indexer supports gardener profiles" (real blocker, keep)
3. `packages/shared/src/modules/transactions/passkey-sender.ts:57` — "When permissionless supports sendUserOperation with multiple calls" (keep, roadmap)
4. `packages/shared/src/modules/transactions/embedded-sender.ts:52` — EIP-5792 migration target with inline example (see §7)
5. `packages/shared/src/modules/transactions/embedded-sender.ts:93` — "Use EIP-5792 sendCalls for atomic batching when available"
6. `packages/shared/src/modules/transactions/wallet-sender.ts:68` — "Try EIP-5792 sendCalls with paymasterService first when available"
7. `packages/shared/src/modules/data/eas.ts:434` — pagination plan in JSDoc (keep, forward-looking doc)
8. `packages/client/src/views/Home/GardenList.tsx:138` — "Virtualize with @tanstack/react-virtual when gardens.length > 50" (keep, guard)
9. `packages/shared/src/components/SyncStatusBar.stories.tsx:5` — Storybook limitation explanation (keep)
10. Contract lib `StringUtils.sol:10,25` — `\uXXXX` JSON escape references, not actual TODOs (false positives from grep on `XXX`)

No `FIXME`, `HACK`, `KLUDGE` anywhere in scope. Clean.

Verdict: 3 TODOs (1, 4, 5, 6) cluster around EIP-5792. They're a single conceptual blocker — when wagmi/permissionless ship `sendCalls`, all three TODOs collapse together. Worth collecting into a tracking issue. One TODO (number 1 on AppKit connector.id) is genuinely stale and could be closed by the next person touching the auth provider.

### 5.2 `posthog.ts` auto-init "for backward compatibility" comment
File: `packages/shared/src/modules/app/posthog.ts:525-528`
```ts
// Auto-initialize for backward compatibility (only in browser)
if (typeof window !== "undefined") { initNetworkTracking(); }
```
`initNetworkTracking` has zero external consumers, so the "for backward compatibility" framing is misleading — the auto-init is the *only* entry point. Either make it an explicit call in `providers/App.tsx` or reword the comment. Low priority, one-line fix.

---

## 6. LOW / INTENTIONAL FALLBACKS — leave alone

### 6.1 Zero-address module fallbacks
`packages/shared/src/config/blockchain.ts` — 14 `deployment.X || "0x00...00"` fallbacks for optional modules (`octantModule`, `hatsModule`, `karmaGAPModule`, `eas`, `easSchemaRegistry`, etc.). Per CLAUDE.md: documented intentional pattern. Keep.

### 6.2 iOS Safari `fileData` vs `file` IndexedDB migration
`packages/shared/src/types/job-queue.ts:143,222` + `packages/shared/src/utils/storage/file-serialization.ts:55-96`. Documented iOS-Safari `File`-vs-`fileData` migration for pre-switch IndexedDB records. Consumers: `job-executors.ts`, `useBatchWorkSync.ts`, `db.ts`. Keep.

### 6.3 `cached_work` IndexedDB object store
`packages/shared/src/modules/job-queue/db.ts:28,61-62`. Schema migration safety for users with old DB versions. Keep.

### 6.4 Legacy `NotGardenerAccount` error selector (`0x8cb4ae3b`)
`packages/shared/src/utils/errors/contract-errors.ts:183-184` + recovery logic at line 546-547. Old on-chain receipts still surface this selector. Keep (tested in `contract-errors-recovery.test.ts:63,87`).

### 6.5 `WorkMetadataV1` type + `isV1Metadata` guard
`packages/shared/src/types/domain.ts:438` + `packages/client/src/views/Home/Garden/WorkViewSection.tsx:59-64,134`. Immutable on-chain attestations still carry v1 shape (`plantCount`/`plantSelection`). Display-only fallback. Keep permanently.

### 6.6 `AdminDialog` coexistence with `DialogShell`
Three CookieJar modals (`CookieJarManageModal`, `CookieJarDepositModal`, `CookieJarWithdrawModal`) still use `AdminDialog`. Per the Storybook doc, this is intentional — strict M3 Basic Dialog is the documented choice for these three. Five admin modals use `DialogShell` (Garden modals + MintingDialog + CreateListingDialog). Architecture is clean; not legacy.

### 6.7 Theme `color-mix` fallback
`packages/shared/src/utils/styles/theme.ts:89` + `packages/shared/src/hooks/app/useTheme.ts:59`. Progressive-enhancement fallback for browsers without `color-mix`. Keep.

### 6.8 Translation API legacy handle
`packages/shared/src/modules/translation/browser-translator.ts` — Chrome 125-126 exposed `self.translation` before spec moved to `self.ai`. Removable when Chrome <127 is dropped. Keep.

### 6.9 Rename-shim exports (all deliberate)
| File | Shim | Status |
|---|---|---|
| `shared/src/components/Cards/CardBase.tsx:191` | `SurfaceCardBody as CardBody` | Internal → public name. Keep |
| `shared/src/hooks/index.ts:254` | `useAttestations as useHypercertAttestations` | Disambiguation vs EAS attestations. Keep |
| `shared/src/i18n/index.ts:2-4` | `default as en/es/pt` | Standard JSON default-to-named. Keep |
| `admin/src/components/Garden/index.ts:15` | `ReviewStep as GardenReviewStep` | Disambiguation. Keep |
| `client/src/components/Actions/Button/Base.tsx:314` | `ButtonRoot as Root, ButtonIcon as Icon` | Compound-component API. Keep |
| `client/src/components/Inputs/TextField/Text.tsx:7` | `FormTextarea as FormText` | Verified: `FormText` is consumed in `views/Garden/Details.tsx:285,346`. Keep |

No stale rename shims.

---

## 7. Contracts — `__deprecated_*` storage + defensive fallbacks

### 7.1 `__deprecated_*` storage slots (MUST keep — UUPS slot preservation)
- `packages/contracts/src/markets/HypercertMarketplaceAdapter.sol:111` — `mapping(address => bool) private __deprecated_allowedCurrencies;` // "Deprecated: allowedCurrencies was never enforced. Slot preserved for upgrade safety."
- `packages/contracts/src/modules/Octant.sol:104` — `uint256 private __deprecated_supportedAssetCount;` // "Deprecated: count is derived via supportedAssetCount(). Slot reserved for storage layout."

Both have comments + counted in the `__gap` accounting (Octant line 121 enumerates the slot list). Textbook UUPS hygiene. Keep.

### 7.2 Defensive fallbacks for external Gardens V2 ABIs (keep)
- `packages/contracts/src/modules/Gardens.sol:680-708` — `_attemptSignalPoolMembershipJoin` tries 3 ABI signatures in order (`attemptCommunityMembership()` → `stakeAndRegisterMember(address)` → `stakeAndRegisterMember(string)`). Comment notes the middle one is "legacy/mock interface". Interoperability defense, not debt.
- `packages/contracts/src/accounts/Garden.sol:436-449` — `executeGardenSelfStake` tries string-based community ABI first, falls back to address-based. "Prefers the newer string-based community ABI, then falls back to the legacy address-based path." Keep.
- `packages/contracts/src/resolvers/Yield.sol:541-553` — `_routeToCookieJar` tries `CookieJarModule.getGardenJar()` first, falls back to `gardenCookieJars[garden]` mapping. "Try per-asset jar from CookieJarModule first, fall back to legacy mapping." Keep.

### 7.3 Unused parameter markers (not legacy)
- `packages/contracts/src/resolvers/Yield.sol:585` — `(vault); // Suppress unused parameter warning` (interface consistency)
- `packages/contracts/src/resolvers/Work.sol:141` / `Assessment.sol:169` — `// solhint-disable no-unused-vars` (interface conformance)

These are standard Solidity interface-conformance patterns, not debt. Keep.

### 7.4 Contracts TODO/FIXME
Zero. `StringUtils.sol:10,25` hits were false positives on `\uXXXX` (JSON escape syntax, not the `XXX` marker).

---

## 8. Commented-out code blocks > 2 lines

Only ONE multi-line commented-out code block exists across `packages/{admin,shared,client}/src`:

### 8.1 EIP-5792 example stub — `embedded-sender.ts:55-62`
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
**Verdict**: intentional — migration target inline so the next developer gets the API shape without re-researching it. Keep as-is, or (if trimming) move to a GitHub issue linked from the single TODO line.

No other commented-out code blocks > 2 lines. All other multi-line `//` clusters in `src` are JSDoc, contextual comments, or license headers.

---

## 9. Patterns scanned and found CLEAN

Record so this can be skipped on the next re-run:

- **Warm-glass retirement**: confirmed complete — zero hits for `warm[-_]glass`, `warmGlass`, `warm[-_]tint`, `warm_tint` anywhere in `packages/*/src`.
- **No V1/V2 component parallels**: no `ButtonV1`/`ButtonV2` etc. `WorkMetadataV1` is the only versioned shape, and it's intentionally a permanent display-only fallback.
- **No old chain IDs / API endpoints**: chain IDs 42161 / 42220 / 11155111 are the three active chains; localhost is test-only.
- **No orphan redirect routes**: `route-folding.test.ts` enforces absence of the old top-level `/assessments` and `/endowments` routes.
- **No always-true / always-false version gates**: no `if (version >= X)` comparisons in source.
- **No raw string timer cleanup violations or dangling addEventListeners** — out of this agent's scope, but the patterns weren't visible during grepping.

---

## 10. Recommended action order (delta vs prior report)

1. **Delete (all zero-risk)**: §2.1 `ACCOUNT_SHEET_CONTENT_ID`, §2.2 `isZeroAddressValue`, §2.4 `VITE_ENABLE_RPC_BG_SYNC` type decls. ~10 LOC across 6 files.
2. **Fix `WorkStatus` alias** (§2.3): retype the one self-reference in `WorkCard.tsx`, delete 4 barrel re-exports. ~6 LOC.
3. **Shim flattening** (§3.2, §3.3, §3.4): delete `query-invalidation.ts` and `admin-routes.ts`, redirect barrel imports; drop `ZERO_ADDRESS` re-export from `vaults.ts` after 7-import rewrite. ~30 LOC net.
4. **Delete `useWork()`** (§3.1) + rewrite 16 test call sites to use split hooks. ~60 LOC prod + ~500 LOC test churn (mechanical).
5. **Stale skip-test decision** (§2.5): implement or delete the 3 greenwill + 3 MembersModal `describe.skip` / `it.skip` blocks.
6. **Delete `getStoredRpId`** + test mock + barrel (table in §4). ~15 LOC.
7. **`compressImages` sweep** (table in §4): flip 2 callers to `compressImagesParallel`, delete deprecated method. ~30 LOC.
8. **Deprecation policy decisions** (table in §4):
   - Drop the `@deprecated` tag on `useAuth`, `WorkDraft`, `CreateAssessmentForm` — commit to them as permanent public API.
   - Commit to sweeping `useContractTxSender` out of conviction/cookie-jar/garden/yield (14 hook files). The hard, mechanical, high-value one.
9. **Open one tracking issue** for the EIP-5792 TODO cluster (§5.1 items 4/5/6 + the §8.1 commented-out stub).

Cross-agent check:
- Agent 3 (dead code) overlaps on §2.1, §2.2, §2.4, §3.3.
- Agent 6 (defensive code) overlaps on §3.4 (`ZERO_ADDRESS` shim) and the iOS `file?` fallback (§6.2) framing.

No contract source changes recommended in this pass — all Solidity findings are intentional.
