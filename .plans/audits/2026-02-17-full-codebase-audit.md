# Full Codebase Audit Report - 2026-02-17

**Branch:** `feature/ens-integration`
**Scope:** All packages (client, admin, shared, contracts, indexer, agent)

## Executive Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 5 |
| Medium | 8 |
| Low | 11 |
| Informational | 6 |

The codebase is **architecturally sound** -- core rules (hook boundary, provider ordering, single .env, no console.log in production) are fully enforced. The primary issues are **a broken import in an actively-used hook**, **type safety gaps** in contract address interfaces, **dead code accumulation** (32 verified unused files, 80+ unused exports, 30 unused dependencies), and **minor configuration drift** between CLAUDE.md and the actual codebase.

> **Verification note:** All findings were manually verified against source code. Knip false positives (files loaded by non-TS tooling like PM2, Envio config.yaml, Vite importScripts, mocha glob) have been excluded. Contracts Solidity deps flagged by knip are excluded (Foundry remappings are invisible to knip). See "False Positives Excluded" appendix.

---

## Critical Findings

None.

---

## High Severity Findings

### H1. `NetworkContracts` uses `string` for all 23 address properties

**File:** `packages/shared/src/types/contracts.ts:2-27`
**Rule:** #5 (Address Type Enforcement)

Every property in `NetworkContracts` is an Ethereum address but typed as `string` instead of `Address`. This interface feeds `getNetworkContracts()` which is used throughout the codebase, undermining type safety for all contract interactions.

The parallel `DeploymentConfig` interface in `blockchain.ts` correctly uses `Address` for the same concept, making this inconsistency especially problematic.

**Fix:** Change all 23 properties to `Address` type, update `getNetworkContracts()` return type, and fix any downstream type errors.

### H2. `WorkCard.gardenerAddress` typed as `string`

**File:** `packages/shared/src/types/domain.ts:365`
**Rule:** #5 (Address Type Enforcement)

`gardenerAddress: string` sits next to `gardenAddress: Address` in the same interface. Since `Work` extends `WorkCard`, this propagates through the domain layer.

**Fix:** Change to `gardenerAddress: Address`.

### H3. Broken path alias import in actively-used hook

**File:** `packages/shared/src/hooks/utils/useAddressInput.ts:1`
**Impact:** Bug in production code path

```typescript
import { resolveEnsAddress } from "@/utils"; // BROKEN: alias is @shared/*, not @/*
```

This hook is barrel-exported from `@green-goods/shared` and actively used by `packages/admin/src/components/Garden/CreateGardenSteps/TeamStep.tsx` for adding gardeners/operators during garden creation. The `@/utils` path does not match the shared package's tsconfig alias (`@shared/*`). This import likely resolves by accident through Vite's bundler alias in the consuming package, making it fragile.

**Fix:** Change to `import { resolveEnsAddress } from "../../utils"` (relative) or `@shared/utils`.

### H4. React hooks exhaustive-deps instability in `Work.tsx`

**File:** `packages/shared/src/providers/Work.tsx:280,303,374`
**Rule:** #9 (Chained useMemo Dependencies)

`userGardens` reference changes every render, causing unstable dependencies in multiple `useCallback`/`useMemo` hooks. This creates unnecessary re-renders and potential stale closure bugs.

**Fix:** Stabilize `userGardens` reference with proper memoization or extract primitive deps.

### H5. ~30 unused production dependencies across 7 package.json files

**Detected by:** knip (verified: contracts Solidity deps excluded as false positives)

Notable accumulations:
- `packages/client`: 12 unused deps (`@reown/appkit`, `@wagmi/core`, `browser-image-compression`, `gql.tada`, etc.) -- several are used only in `@green-goods/shared` and should be there instead
- `packages/admin`: 11 unused deps (`@radix-ui/react-accordion`, `@radix-ui/react-avatar`, `gql.tada`, etc.) -- same pattern
- `multiformats`: unused in 4 separate package.json files (never directly imported anywhere, only referenced in mock comments)

**Excluded:** `packages/contracts` 6 Solidity deps (`@openzeppelin/*`, `@ensdomains/*`, `@ethereum-attestation-service/*`) are consumed via Foundry remappings in `.sol` files, invisible to knip. These are NOT dead.

**Fix:** Remove unused dependencies from client, admin, agent, root, and shared. Move deps to the package that actually imports them (e.g., `browser-image-compression` belongs in shared, not client).

---

## Medium Severity Findings

### M1. ~32 unused files (38 flagged, 6 false positives excluded)

**False positives excluded:**
- `ecosystem.config.cjs` -- loaded by PM2 via `bun dev` script (not a TS import)
- `packages/indexer/src/EventHandlers.ts` -- referenced 13x in `config.yaml` (Envio runtime, not TS)
- `packages/indexer/test/test.ts` -- matched by mocha glob `"test/**/*.ts"`
- `packages/client/public/sw-custom.js` -- loaded via `importScripts` in vite PWA config
- `packages/contracts/script/utils/generate-schemas.ts` -- CLI script (may be invoked manually)
- `tests/fixtures/anvil-config.ts` -- imported by `tests/specs/client.fork.spec.ts`

**Verified dead code clusters:**
- `packages/client/src/components/Skeletons/` -- entire directory (4 files) -- zero imports outside self
- `packages/shared/src/hooks/` -- 8 barrel `index.ts` files not wired to top-level barrel
- `packages/client/src/views/Home/WorkDashboard/MyWork.tsx` -- `MyWorkTab` component never imported
- `packages/indexer/queries/OptimizedQueries.ts` -- zero references anywhere
- `packages/client/src/__tests__/test-utils.tsx` -- zero imports from any test file
- `tests/fixtures/index.ts`, `tests/mocks/index.ts`, `tests/mocks/browser-worker.ts` -- barrel/mock files never imported (specs import specific files directly)
- `packages/agent/src/` -- 3 barrel re-export files unused

**Fix:** Delete dead files or wire barrel exports as needed.

### M2. 80+ unused exports and 68 unused exported types

Highest concentrations:
- `packages/shared`: 46 unused exports, 25 unused types
- `packages/client`: 32 unused exports, 31 unused types
- `packages/agent`: 27 unused exports, 17 unused types
- `packages/client/src/config.ts` and `packages/admin/src/config.ts`: duplicate config exports

**Fix:** Remove or mark as `@internal` where appropriate.

### M3. 7 accessibility (jsx-a11y) warnings

**Files:**
- `packages/admin/src/components/hypercerts/CreateListingDialog.tsx:148,167,178,192,203` -- 5x `label-has-associated-control` (missing `htmlFor`)
- `packages/client/src/views/Home/WorkDashboard/index.tsx:729` -- `no-static-element-interactions`
- `packages/shared/src/components/Toast/toast.service.tsx:433` -- `no-static-element-interactions`

**Fix:** Add `htmlFor` attributes to labels; add `role` and keyboard handlers to interactive divs.

### M4. Lint parse error in `cli.ts`

**File:** `packages/contracts/script/deploy/cli.ts:63`
**Impact:** Blocks linting for this file.

Backtick inside template literal confuses the oxlint parser.

**Fix:** Refactor the template literal to avoid nested backticks.

### M5. Zero-address comparisons use string literals instead of shared utility

**Files:**
- `packages/admin/src/views/Contracts/index.tsx:25,32`
- `packages/shared/src/hooks/hypercerts/useCancelListing.ts:40`
- `packages/shared/src/hooks/hypercerts/useBatchListForYield.ts:63`
- `packages/shared/src/hooks/hypercerts/useCreateListing.ts:57`
- `packages/shared/src/hooks/garden/useCreateGardenWorkflow.ts:123,263`
- `packages/shared/src/hooks/blockchain/useDeploymentRegistry.ts:86`

**Fix:** Use `isZeroAddress()` or `ZERO_ADDRESS` from shared utils.

### M6. Deep imports in test files

**Files:** 9 locations in `packages/client/src/__tests__/` and `packages/admin/src/__tests__/`
**Rule:** #11 (Barrel Import Enforcement)

Most are `vi.mock()` calls targeting deep paths, which may be necessary for proper module mocking. However, `packages/admin/src/__tests__/workflows/createGarden.test.ts` has direct deep imports that should use barrel imports.

### M7. 22 unused devDependencies

Notable:
- Root: 13 unused devDeps including `babel-plugin-react-compiler`, `lighthouse`, `lint-staged`
- `packages/indexer`: `@types/chai`, `chai`, `ts-mocha` (test runner migration residue)

### M8. 17 duplicate exports (named + default)

Components export both a named export and `default`, creating confusion about canonical import style. Most are in `packages/client/src/components/`.

**Fix:** Standardize on named exports (project convention) and remove redundant defaults.

---

## Low Severity Findings

### L1. 5 TODO markers in first-party code

| File | TODO |
|------|------|
| `shared/src/modules/data/eas.ts:397` | Implement pagination |
| `client/src/views/Home/GardenList.tsx:138` | Virtualize with @tanstack/react-virtual when >50 gardens |
| `admin/src/views/Deployment/index.tsx:42` | Replace mock with real deployment API |
| `client/src/views/Home/WorkDashboard/index.tsx:361` | SCALABILITY: fetches ALL approvals client-side |
| `shared/src/hooks/gardener/useGardenerProfile.ts:127` | Replace with GraphQL query when indexer updated |

### L2. 6 unused variable/import lint warnings

| File | Identifier |
|------|-----------|
| `admin/.../CreateListingDialog.tsx:11` | `DEFAULT_CHAIN_ID` unused import |
| `admin/.../CreateListingDialog.tsx:61` | `formatMessage` unused variable |
| `admin/.../CreateListingDialog.tsx:294` | `isPending` unused variable |
| `shared/.../job-queue/index.ts:51` | `ensureArray` unused function |
| `shared/.../useGardenCookieJars.ts:13` | `queryKeys` unused import |
| `client/.../Review.tsx:16` | `AUDIO_REVIEW_TRACKING_ID` unused variable |

### L3. Hardcoded Hypercert minter addresses (documented fallbacks)

**File:** `packages/shared/src/hooks/hypercerts/hypercert-contracts.ts:43-51`

4 hardcoded addresses for third-party Hypercert protocol. Well-documented as fallbacks.

### L4. Hardcoded ERC-20 token address maps

**File:** `packages/shared/src/utils/blockchain/vaults.ts:7-35`

6 well-known token addresses (WETH, DAI) across chains for display purposes.

### L5. Phantom dependency: `@storybook/addon-essentials`

**File:** `packages/shared/.storybook/main.ts:7`

Listed in the Storybook addons array but not in `package.json`. Currently resolves via transitive installation from `@storybook/react-vite`, but would break if the transitive dep changes. Should be explicitly added to devDependencies.

Note: The `useAddressInput.ts` broken import (`@/utils`) was elevated to H3 after verification confirmed it's actively used in production.

### L6-L12. Additional minor lint warnings

5 React hooks exhaustive-deps warnings across `FileUploadField.tsx`, `Work.tsx`, and `App.tsx` (beyond the H3 instability issue).

---

## Dead Code Summary

| Category | Raw (knip) | Verified | Highest-Impact Packages |
|----------|-----------|----------|------------------------|
| Unused files | 38 | ~32 | shared (11), client (6), tests (3), agent (4) |
| Unused dependencies | 36 | ~30 | admin (11), client (12) |
| Unused devDependencies | 22 | ~22 | root (13), indexer (3), agent (2) |
| Unused exports | 80 | ~80* | shared (46), client (32), agent (27) |
| Unused exported types | 68 | ~68* | client (31), shared (25), agent (17) |
| Duplicate exports | 17 | 17 | client (10), shared (7) |

*\*Export counts not individually verified -- knip is highly accurate for TS export analysis. Contracts Solidity deps (6) excluded as false positives.*

---

## Skill & Configuration Drift

### Hooks (15/15 exist)

All hooks referenced in skills/rules exist and are barrel-exported from `@green-goods/shared`.

### Utilities (7/9 correct)

| Reference | Status |
|-----------|--------|
| `parseContractError` | Exists |
| `createMutationErrorHandler` | Exists (intentionally internal) |
| `mediaResourceManager` | Exists |
| `getStorageQuota` | **Missing from barrel** -- exists in `utils/index.ts` but not re-exported from `packages/shared/src/index.ts` |
| `jobQueue` | Exists |
| `eventBus` | **Renamed to `jobQueueEventBus`** -- CLAUDE.md references `eventBus` |
| `logger` | Exists |
| `toastService` | Exists |
| `createWorkToasts` | **Missing from barrel** -- exists in `components/index.ts` but not in `packages/shared/src/index.ts` |

### Types (10/10 exist)

All types referenced in skills/rules exist and are barrel-exported.

### Environment Variables (7/7 exist)

All variables documented. Minor drift: CLAUDE.md omits `84532=Base Sepolia` which is the default on `main` branch.

### Scripts (7/7 exist) / Ports (4/4 match)

No drift detected.

---

## Architectural Rule Compliance

| Rule | Status | Notes |
|------|--------|-------|
| 1. Timer Cleanup | PASS | No raw setTimeout in hooks |
| 2. Event Listeners | PASS | Proper cleanup patterns |
| 3. Async Races | PASS | Mount guards in place |
| 4. Error Handling | PASS | No empty catch blocks (2 dev-only borderline) |
| 5. Address Types | **FAIL** | 24 properties using `string` for addresses |
| 6. Zustand Selectors | PASS | Granular selectors used |
| 7. Query Keys | PASS | Stable references |
| 8. Form Validation | PASS | React Hook Form + Zod |
| 9. Chained useMemo | **WARN** | `Work.tsx` has render instability |
| 10. Context Values | PASS | Values memoized |
| 11. Barrel Imports | **WARN** | 9 deep imports in test files only |
| 12. Console.log | PASS | All in logger or JSDoc |
| 13. Provider Nesting | PASS | Correct hierarchy |
| 14. Bun Scripts | PASS | No raw forge commands |

---

## Recommendations (Priority Order)

### Priority 1: Broken Import + Type Safety (1-2 hours)
1. **Fix `useAddressInput.ts` broken import** -- change `@/utils` to relative path or `@shared/utils` (H3, actively used in admin)
2. Fix `NetworkContracts` interface -- change all 23 properties to `Address` type (H1)
3. Fix `WorkCard.gardenerAddress` to `Address` type (H2)
4. Replace zero-address string literals with `isZeroAddress()` utility (M5)

### Priority 2: Dead Code Cleanup (2-3 hours)
5. Remove `packages/client/src/components/Skeletons/` directory (4 dead files)
6. Remove `multiformats` from 4 package.json files
7. Remove unused deps from client (12) and admin (11) package.json files
8. Wire or delete 8 orphaned barrel `index.ts` files in shared hooks
9. Remove dead `MyWork.tsx`, `OptimizedQueries.ts`, `goods-token.ts` deploy script

### Priority 3: Stability (1 hour)
10. Fix `Work.tsx` memo instability -- wrap `userGardens` filter in `useMemo` (H4)
11. Fix `App.tsx` missing `appKitState` dependency
12. Fix `FileUploadField.tsx` missing deps

### Priority 4: Configuration Drift (30 min)
13. Add `getStorageQuota` and `createWorkToasts` to barrel export
14. Update CLAUDE.md: `eventBus` -> `jobQueueEventBus`
15. Update CLAUDE.md: add `84532=Base Sepolia` to supported chains
16. Add `@storybook/addon-essentials` to shared devDependencies

### Priority 5: Polish (1 hour)
17. Add `htmlFor` to 5 labels in `CreateListingDialog.tsx`
18. Standardize named exports (remove duplicate defaults)
19. Fix lint parse error in `cli.ts`
20. Clean up 6 unused variables/imports

---

## Appendix: False Positives Excluded

These knip findings were manually verified and determined to be false positives. Knip traces TypeScript/JavaScript imports only — it cannot follow YAML config references, CLI arguments, glob patterns, or Vite plugin configs.

| File | Why It's Not Dead | Verification |
|------|-------------------|-------------|
| `ecosystem.config.cjs` | Loaded by PM2 via `bun dev` script in root `package.json:29` | `npx pm2 start ecosystem.config.cjs` |
| `packages/indexer/src/EventHandlers.ts` | Referenced 13x in `config.yaml` as Envio event handler | `config.yaml:8,18,22,31,41,49,54,62,71,75,80,86,91` |
| `packages/indexer/test/test.ts` | Matched by mocha glob `"test/**/*.ts"` in package.json | `package.json:8` |
| `packages/client/public/sw-custom.js` | Loaded via `importScripts` in Vite PWA config | `vite.config.ts:102` |
| `packages/contracts` Solidity deps (6) | Consumed via Foundry remappings in `.sol` files | `foundry.toml` remappings |
| `tests/fixtures/anvil-config.ts` | Imported by `tests/specs/client.fork.spec.ts` | Direct TS import verified |
| `@storybook/addon-essentials` | Installed transitively, exists in `node_modules` | Phantom dep (should be explicit) |
