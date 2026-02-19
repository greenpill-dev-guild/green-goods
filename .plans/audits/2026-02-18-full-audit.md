# Full Codebase Audit — 2026-02-18

## Executive Summary

| Metric | Count |
|--------|-------|
| **Files analyzed** | ~500+ (all packages) |
| **Critical** | 0 |
| **High** | 6 |
| **Medium** | 33 |
| **Low** | 20 |
| **Unused files (knip)** | 167 |
| **Unused dependencies** | 7 packages |
| **Unused exports** | 81 |
| **Lint warnings (Solidity)** | 142 (0 errors) |

**Branch**: `feature/ens-integration`

---

## Critical Findings

None.

---

## High Severity Findings

### H-1: Silent error swallowing in `useWorkApprovals.ts`

**Location**: `packages/shared/src/hooks/work/useWorkApprovals.ts:54-55, 81-88`

GraphQL errors from EAS queries are silently replaced with empty arrays. No logging, no tracking. Downstream consumers (work approval UI, assessment flows) receive empty results indistinguishable from "no approvals exist."

**Rule violated**: Rule 4 (Error Handling Consistency)
**Fix**: Add `logger.error()` + return the error to the caller via query state.

---

### H-2: `setInterval` singleton leak in job queue

**Location**: `packages/shared/src/modules/job-queue/index.ts:820-827`

`startCleanupScheduler()` creates a `setInterval` on a module-level singleton. If `stopCleanupScheduler()` is never called (e.g., provider unmounts improperly), the interval leaks indefinitely. No automatic teardown exists.

**Rule violated**: Rule 1 (Timer Cleanup)
**Fix**: Verify all call sites call `stopCleanupScheduler()` on unmount; consider adding a safety `AbortSignal` pattern.

---

### H-3: XState type safety bypass in `useMintHypercert`

**Location**: `packages/shared/src/hooks/hypercerts/useMintHypercert.ts:447`

`as unknown as typeof mintHypercertMachine.implementations` casts the entire `provide()` object through `unknown`, eliminating compile-time verification that actors match expected input/output types. Any machine type change will not be caught until runtime.

**Impact**: Future refactors to the hypercert machine could silently break without type errors.

---

### H-4: Raw `setTimeout` in Auth provider

**Location**: `packages/shared/src/providers/Auth.tsx:156-170`

Raw `setTimeout` inside `useEffect` for wallet hydration timeout. While cleanup runs on unmount, this violates Rule 1 and the project convention of using `useTimeout()` from shared.

**Fix**: Replace with `useTimeout()`.

---

### H-5: `revocable: true` contradicts non-revocable resolver design

**Location**: Multiple files:
- `packages/shared/src/utils/eas/transaction-builder.ts:43, 152, 194`
- `packages/shared/src/modules/work/simulate.ts:107`
- `packages/shared/src/hooks/assessment/useCreateAssessmentWorkflow.ts:218`

The Solidity resolvers (`Work.sol:139`, `Assessment.sol:162`) explicitly reject revocations (`onRevoke` returns `false`). The frontend sends `revocable: true`. While not a security issue (revocation attempts fail on-chain), it's semantically incorrect and could waste gas.

**Fix**: Change all frontend EAS attestation requests to `revocable: false`.

---

### H-6: Account.tsx is a 1,094-line god object

**Location**: `packages/client/src/views/Profile/Account.tsx`

Handles PWA install guidance, garden joining, ENS claiming, theme/language settings, logout, and app refresh in a single component. Contains silent error swallowing (lines 228-234), `console.debug` in production (lines 398, 403), and inline component factories inside `useMemo` (lines 435-513).

**Fix**: Extract into focused sub-components (`PWAInstallSection`, `ENSClaimSection`, `SettingsSection`, etc.).

---

## Medium Severity Findings

### Architecture & Structure (M-1 through M-8)

| ID | Finding | Location | Rule |
|----|---------|----------|------|
| M-1 | `EventHandlers.ts` is 2,549 lines — all indexer logic in one file | `packages/indexer/src/EventHandlers.ts` | God Object |
| M-2 | `Detail.tsx` is 1,043 lines with 7 sections | `packages/admin/src/views/Gardens/Garden/Detail.tsx` | God Object |
| M-3 | `action/templates.ts` is 1,433 lines of template data | `packages/shared/src/utils/action/templates.ts` | God Object |
| M-4 | `Toast/presets.ts` is 1,099 lines | `packages/shared/src/components/Toast/presets.ts` | God Object |
| M-5 | `processJob` is ~220 lines — should split success/failure paths | `packages/shared/src/modules/job-queue/index.ts:345-564` | Long Function |
| M-6 | `submitAssessment` actor is ~150 lines with IPFS + EAS + analytics | `packages/shared/src/hooks/assessment/useCreateAssessmentWorkflow.ts:89-239` | Long Function |
| M-7 | `registerInSignalPool` actor is ~120 lines | `packages/shared/src/hooks/hypercerts/useMintHypercert.ts:316-438` | Long Function |
| M-8 | `useGardens()` fetches all gardens then filters client-side | `packages/admin/src/views/Gardens/Garden/Detail.tsx:93-94` | Performance |

### Error Handling (M-9 through M-14)

| ID | Finding | Location | Rule |
|----|---------|----------|------|
| M-9 | `console.debug` in job queue production code | `packages/shared/src/modules/job-queue/index.ts:298, 314` | Rule 12 |
| M-10 | Gas estimation error silently swallowed | `packages/client/src/views/Profile/Account.tsx:228-234` | Rule 4 |
| M-11 | `createPools` error logged to toast but not tracked | `packages/admin/src/views/Gardens/Garden/Detail.tsx:646-657` | Rule 4 |
| M-12 | `disconnectWallet` catch is empty | `packages/shared/src/providers/Auth.tsx:260-265` | Rule 4 |
| M-13 | Partial IPFS upload failure has no user feedback | `packages/shared/src/hooks/assessment/useCreateAssessmentWorkflow.ts:139-150` | UX |
| M-14 | Uncached `getStorageQuota()` call inside catch block | `packages/shared/src/modules/job-queue/index.ts:513` | Performance |

### Type Safety (M-15 through M-21)

| ID | Finding | Location | Rule |
|----|---------|----------|------|
| M-15 | `as unknown[]` cast on EAS attestation data | `packages/shared/src/hooks/work/useWorkApprovals.ts:61` | Type Safety |
| M-16 | 15+ `as string` / `as string[]` casts in EAS parsing | `packages/shared/src/modules/data/eas.ts:93-212` | Type Safety |
| M-17 | `transport as Eip1193Provider` without validation | `packages/shared/src/hooks/assessment/useCreateAssessmentWorkflow.ts:124` | Type Safety |
| M-18 | Multiple `as \`0x${string}\`` casts from deployment JSON | `packages/shared/src/hooks/garden/useCreateGardenWorkflow.ts:180+` | Rule 5 |
| M-19 | `as unknown as typeof ...implementations` | `packages/shared/src/hooks/hypercerts/useMintHypercert.ts:447` | Type Safety |
| M-20 | Log array casts lose viem `Log[]` type info | `packages/shared/src/hooks/hypercerts/useMintHypercert.ts:269, 297` | Type Safety |
| M-21 | `as string` cast on truthy-guarded value | `packages/client/src/views/Profile/Account.tsx:557` | Type Safety |

### DRY / Code Duplication (M-22 through M-24)

| ID | Finding | Location | Rule |
|----|---------|----------|------|
| M-22 | Identical GraphQL `Attestations` query copy-pasted 6 times | `packages/shared/src/modules/data/eas.ts` | DRY |
| M-23 | `toUnixSeconds` helper defined inside closure instead of module scope | `packages/shared/src/hooks/assessment/useCreateAssessmentWorkflow.ts:192-198` | DRY |
| M-24 | Query key fallback uses unstable object literal | `packages/shared/src/hooks/work/useWorkApprovals.ts:101-106` | Rule 7 |

### React Patterns (M-25 through M-29)

| ID | Finding | Location | Rule |
|----|---------|----------|------|
| M-25 | `useEffect` depends on full XState `state` object | `packages/shared/src/hooks/hypercerts/useMintHypercert.ts:519` | Performance |
| M-26 | `walletRestoreAttemptedRef` shared across two useEffects — race-prone | `packages/shared/src/providers/Auth.tsx:149, 196, 247` | Correctness |
| M-27 | `snapshot` from `useSelector(actor, s => s)` causes full re-render cascade | `packages/shared/src/providers/Auth.tsx:462` | Rule 6 |
| M-28 | Inline function components inside `useMemo` for settings | `packages/client/src/views/Profile/Account.tsx:435-513` | Performance |
| M-29 | `React.FC` legacy type annotation | `packages/client/src/views/Profile/Account.tsx:78` | Style |

### Solidity (M-30 through M-33)

| ID | Finding | Location |
|----|---------|----------|
| M-30 | `GardenConfig` struct packing could be more gas-efficient | `packages/contracts/src/tokens/Garden.sol:105` |
| M-31 | `WorkApprovalSchema` struct packing is inefficient | `packages/contracts/src/Schemas.sol:22` |
| M-32 | 3 immutable variables not in SCREAMING_SNAKE_CASE | `packages/contracts/src/strategies/AaveV3.sol:31-33` |
| M-33 | 10+ empty blocks across Garden.sol (hooks for future override) | `packages/contracts/src/tokens/Garden.sol` |

---

## Low Severity Findings

| ID | Finding | Location |
|----|---------|----------|
| L-1 | `gardenId: approval.workUID \|\| approval.id` — misleading field name | `useWorkApprovals.ts:134` |
| L-2 | `size: JSON.stringify(approval).length` computed every render | `useWorkApprovals.ts:129` |
| L-3 | `EAS_EXPLORER_URL` is not chain-aware | `Detail.tsx:66` |
| L-4 | Magic number `5` for assessment slice limit | `Detail.tsx:109` |
| L-5 | `key={\`${member}-${index}\`}` uses index as key | `Detail.tsx:839` |
| L-6 | Nested ternary chain (4 levels) for error messages | `useMintHypercert.ts:462-471` |
| L-7 | `setPasskeySession?: (session: unknown) => void` — legacy stub | `Auth.tsx:103` |
| L-8 | SSR guard on a PWA-only codebase | `Auth.tsx:137` |
| L-9 | Stale JSDoc comment above wrong declaration | `job-queue/index.ts:121-123` |
| L-10 | `ensureArray` helper unused in its own file | `job-queue/index.ts:51` |
| L-11 | TODO: gardener profile query placeholder | `useGardenerProfile.ts:127` |
| L-12 | TODO: EAS pagination not implemented | `eas.ts:436` |
| L-13 | TODO: list virtualization for large garden lists | `GardenList.tsx:138` |
| L-14 | `Goods.sol` immutable naming convention | `Goods.sol:15` |
| L-15 | Duplicate exports (named + default) in 17 files | See knip output |
| L-16 | `React.FC` usage | `Account.tsx:78` |
| L-17 | `estimateCreationCost` missing `@throws` annotation | `useCreateGardenWorkflow.ts:325` |
| L-18 | Gas-indexable event fields throughout Solidity contracts | 40+ solhint warnings |
| L-19 | 6 hardcoded ERC-20 token addresses (WETH/DAI) in `vaults.ts` | `shared/src/utils/blockchain/vaults.ts:9-33` |
| L-20 | `Karma.sol` still uses `revocable: true` for GAP attestations | `Karma.sol:180, 201, 224` |

---

## Dead Code Summary

### Unused Files (top 20 most actionable — 167 total from knip)

| File | Recommendation |
|------|----------------|
| `packages/contracts/script/deploy/goods-token.ts` | Delete — unused deploy script |
| `packages/contracts/script/utils/foundry-wallet.ts` | Delete — unused utility |
| `packages/contracts/script/utils/generate-schemas.ts` | Delete — unused utility |
| `packages/indexer/queries/OptimizedQueries.ts` | Delete — unused queries |
| `packages/client/src/views/Home/WorkDashboard/MyWork.tsx` | Delete — unused view |
| `packages/client/src/components/Skeletons/*.tsx` | Delete — 4 unused skeleton components |
| `packages/shared/src/__tests__/utils/ens.test.skip.ts` | Delete or unskip |
| `packages/shared/src/__tests__/utils/text.test.skip.ts` | Delete or unskip |
| `scripts/sync-codex-mcp.mjs` | Delete — unused script |
| `tests/format-tests.ts` | Delete — unused test runner |
| `tests/test-connectivity.ts` | Delete — unused test |
| `tests/mocks/browser-worker.ts` | Delete — unused mock |
| `tests/run-tests.ts` | Delete — unused test runner |
| `ecosystem.config.cjs` | Review — may still be used by PM2 |
| `packages/shared/src/hooks/analytics/index.ts` | Delete if barrel is empty |
| `packages/shared/src/hooks/conviction/index.ts` | Delete if barrel is empty |
| `packages/shared/src/hooks/ens/index.ts` | Delete if barrel is empty |
| `packages/shared/src/hooks/roles/index.ts` | Delete if barrel is empty |
| `packages/shared/src/hooks/utils/index.ts` | Delete if barrel is empty |
| `packages/shared/src/hooks/yield/index.ts` | Delete if barrel is empty |

### Unused Dependencies (7 packages affected)

| Package | Unused Dependencies |
|---------|-------------------|
| root `package.json` | `multiformats`, `react-intl`, `uint8arrays` |
| `packages/admin` | `@radix-ui/react-accordion`, `@radix-ui/react-avatar`, `@radix-ui/react-slot`, `@radix-ui/react-tabs`, `@reown/appkit-adapter-wagmi`, `clsx`, `gql.tada`, `multiformats`, `posthog-js`, `tailwind-merge`, `tailwind-variants` |
| `packages/agent` | `@fastify/sensible`, `multiformats`, `pino-pretty`, `posthog-node` |
| `packages/client` | `multiformats`, `@radix-ui/react-tabs`, `@reown/appkit`, `@reown/appkit-adapter-wagmi`, `@tanstack/query-persist-client-core`, `@tanstack/query-sync-storage-persister`, `@wagmi/core`, `browser-image-compression`, `clsx`, `gql.tada`, `permissionless`, `posthog-js` |
| `packages/contracts` | `@chainlink/contracts-ccip`, `@ensdomains/ens-contracts`, `@ethereum-attestation-service/eas-contracts`, `@openzeppelin/contracts-4.8.3`, `@openzeppelin/contracts-5.0.2`, `@openzeppelin/contracts-upgradeable` |
| `packages/indexer` | `postgres` |
| `packages/shared` | `multiformats` |

> **Note**: Some `packages/contracts` deps may be Foundry remappings (resolved via `lib/` git submodules, not npm). Verify before removing.

### Unused Exports (81 total — top actionable)

| Export | File | Recommendation |
|--------|------|----------------|
| `CAPITAL_MAPPING`, `DOMAIN_MAPPING` | `contracts/script/utils/validation.ts` | Delete if only used in removed deploy path |
| `EASFetchError`, `parseDataToWorkApproval` | `shared/modules/data/eas.ts` | Review — may be used in future |
| `JUICEBOX_ABI` | `shared/utils/blockchain/abis.ts` | Delete if Juicebox integration removed |
| `useJobQueueEvent` | `shared/modules/job-queue/event-bus.ts` | Review — may be needed for future consumers |
| `computeFirstIncompleteStep`, `draftDB` | `shared/modules/job-queue/index.ts` | Review — may be consumed by future draft recovery |
| `MAX_IMAGE_SIZE_BYTES` | `shared/modules/work/work-submission.ts` | Review — may be used in validation |

---

## Architectural Anti-Patterns

### Green Goods Rule Violations

| Rule | Status | Details |
|------|--------|--------|
| Rule 1: Timer Cleanup | **2 violations** | H-2 (job queue setInterval), H-4 (Auth setTimeout) |
| Rule 2: Event Listeners | **Pass** | No violations found |
| Rule 3: Async Races | **Pass** | All async effects use isMounted guards |
| Rule 4: Error Handling | **5 violations** | H-1, M-10, M-11, M-12 (silent catches) |
| Rule 5: Address Types | **Minor** | L-19 (hardcoded token addresses in vaults.ts) |
| Rule 6: Zustand Selectors | **1 violation** | M-27 (full snapshot selector in Auth) |
| Rule 7: Query Keys | **1 violation** | M-24 (unstable fallback array) |
| Rule 8: Form Validation | **Pass** | All forms use React Hook Form + Zod |
| Rule 9: Chained useMemo | **Pass** | No chained dependencies found |
| Rule 10: Context Values | **Pass** | Provider values properly memoized |
| Rule 11: Barrel Imports | **Pass** | No deep import violations in production code |
| Rule 12: Console.log | **2 violations** | M-9 (job queue console.debug), M-10 (Account.tsx console.debug) |
| Rule 13: Provider Nesting | **Pass** | Provider order matches documentation |
| Rule 14: Bun Scripts | **Pass** | No raw forge commands in scripts |

---

## Skill & Configuration Drift

### Hook/Utility/Type Drift

| Reference | Source | Status |
|-----------|--------|--------|
| `useTimeout` | architectural-rules.md | OK |
| `useDelayedInvalidation` | architectural-rules.md | OK |
| `useEventListener` | architectural-rules.md | OK |
| `useWindowEvent` | architectural-rules.md | OK |
| `useDocumentEvent` | architectural-rules.md | OK |
| `useAsyncEffect` | architectural-rules.md | OK |
| `useAsyncSetup` | architectural-rules.md | OK |
| `useOffline` | data-layer SKILL.md | OK |
| `useServiceWorkerUpdate` | data-layer SKILL.md | OK |
| `useDraftAutoSave` | data-layer SKILL.md | OK |
| `useDraftResume` | data-layer SKILL.md | OK |
| `useJobQueue` | data-layer SKILL.md | OK |
| `parseContractError` | error-handling SKILL.md | OK |
| `createMutationErrorHandler` | error-handling SKILL.md | OK |
| `mediaResourceManager` | data-layer SKILL.md | OK |
| `getStorageQuota` | data-layer SKILL.md | OK |
| `jobQueue` | data-layer SKILL.md | OK |
| **`eventBus`** | **data-layer SKILL.md** | **DRIFT** — renamed to `jobQueueEventBus` |
| `logger` | error-handling SKILL.md | OK |
| `toastService` | error-handling SKILL.md | OK |
| `Address` type | web3 SKILL.md | OK |
| `Garden` type | CLAUDE.md | OK |
| `Work` type | CLAUDE.md | OK |
| `Action` type | CLAUDE.md | OK |
| `WorkApproval` type | CLAUDE.md | OK |
| `GardenAssessment` type | CLAUDE.md | OK |
| `Job` type | data-layer SKILL.md | OK |
| `JobKind` type | data-layer SKILL.md | OK |
| `WorkDraft` type | data-layer SKILL.md | OK |
| `OfflineStatus` type | data-layer SKILL.md | OK |

### Drift Recommendations

1. Update data-layer SKILL.md: `eventBus` -> `jobQueueEventBus` (or `useJobQueueEvents` hook)

---

## TODO/FIXME Markers in Production Code

| File | Line | Content |
|------|------|---------|
| `shared/src/hooks/gardener/useGardenerProfile.ts` | 127 | `TODO: Replace with actual GraphQL query once indexer is updated` |
| `shared/src/modules/data/eas.ts` | 436 | `TODO: When implementing pagination...` |
| `client/src/views/Home/GardenList.tsx` | 138 | `TODO: Virtualize with @tanstack/react-virtual when gardens.length > 50` |

All other TODOs are in `packages/contracts/lib/` (Foundry git submodule vendor code — not actionable).

---

## Recommendations (Priority Order)

### Priority 1 — Fix Before Next Deploy
1. **H-5**: Change `revocable: true` → `revocable: false` in all 5 frontend EAS attestation call sites
2. **H-1**: Add error logging to `useWorkApprovals.ts` GraphQL error paths

### Priority 2 — Fix This Sprint
3. **H-2**: Audit job queue `startCleanupScheduler()` call sites for proper cleanup
4. **H-4**: Replace raw `setTimeout` in `Auth.tsx` with `useTimeout()`
5. **M-9, M-10**: Replace `console.debug` with `logger.debug` in job queue and Account.tsx
6. **M-22**: Extract shared GraphQL query string in `eas.ts` (DRY — 6 copies)
7. **M-12**: Add `logger.warn` to `disconnectWallet` catch block in Auth.tsx

### Priority 3 — Tech Debt Reduction
8. **H-6**: Split `Account.tsx` into focused sub-components
9. **M-1**: Split `EventHandlers.ts` by contract/domain
10. **M-2**: Extract sections from admin `Detail.tsx`
11. **Dead code**: Delete 167 unused files identified by knip (start with scripts/tests)
12. **Unused deps**: Remove unused dependencies from 7 package.json files (verify Foundry deps first)
13. **M-27**: Use granular selectors instead of full snapshot in Auth provider
14. **Drift**: Update `eventBus` → `jobQueueEventBus` in skill docs

### Priority 4 — Nice to Have
15. **L-3**: Make `EAS_EXPLORER_URL` chain-aware
16. **L-15**: Consolidate duplicate named + default exports (17 files)
17. **L-18**: Consider indexing high-traffic event fields (gas optimization)
18. **M-30, M-31**: Optimize Solidity struct packing for `GardenConfig` and `WorkApprovalSchema`
