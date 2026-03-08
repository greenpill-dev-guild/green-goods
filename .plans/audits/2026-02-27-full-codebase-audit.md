# Full Codebase Audit Report - 2026-02-27

## Executive Summary

- **Branch**: `release/1.1`
- **Files analyzed**: ~500+ (all packages)
- **Critical**: 0 | **High**: 8 | **Medium**: 14 | **Low**: 8
- **Post-review corrections**: C-1 downgraded to HIGH (uses valid subpath exports), C-2 downgraded to MEDIUM (single-use view composition hook), L-3 merged into M-3 (duplicate)

Overall the codebase is well-structured with strong architectural discipline. The shared package centralization is working well, Solidity contracts are clean (no dangerous patterns), and the XState-based auth flow is solid. The main concerns are dead code accumulation, barrel import conventions, god objects in admin views, and a large number of empty catch blocks that could mask errors.

---

## Critical Findings

_No critical findings after review. Former C-1 and C-2 were downgraded (see High and Medium sections)._

---

## High Findings

### H-0: Admin uses subpath imports instead of root barrel (Rule #11 convention) — FIXED
**Files**: `packages/admin/src/components/Layout/Sidebar.tsx`, `packages/admin/src/views/Dashboard/index.tsx`, `packages/admin/src/views/Gardens/index.tsx`
These files used `@green-goods/shared/hooks`, `@green-goods/shared/stores`, `@green-goods/shared/modules` — valid subpath exports defined in `package.json`, but Rule #11 convention requires root `@green-goods/shared` imports only. **Downgraded from CRITICAL**: these are stable, explicitly-defined subpath exports, not fragile deep paths. Convention issue, not breakage risk.

### H-1: God Object - GardenDetail.tsx (2,038 lines)
**File**: `packages/admin/src/views/Gardens/Garden/Detail.tsx`
At 2,038 lines, this is the largest non-generated file in the codebase. It contains:
- 7+ local component definitions (TabBadge, ActionMenu, TabActionCard, SectionStateCard, AlertRow, etc.)
- Complex state management (10+ useState calls)
- Multiple inline utility functions
- Tab routing logic
Should be decomposed into smaller focused components.

### H-2: 120+ empty catch blocks across codebase
Found 120+ instances of `catch {` (empty catch without variable capture) across production code. While many are intentional (timeouts, fallbacks), some may mask real errors:
- `packages/shared/src/hooks/vault/useDepositForm.ts:36,80`
- `packages/shared/src/hooks/ops/useOpsRunner.ts:36,80,341,355`
- `packages/admin/src/components/Vault/WithdrawModal.tsx:92`
- `packages/admin/src/components/hypercerts/CreateListingDialog.tsx:94`

### H-3: 271 `any` type usages in production code
Excluding tests, mocks, and generated code, there are 271 instances of `any` type usage. Notable locations:
- `packages/shared/src/config/appkit.ts:71,72,99,115` - `null as any`, `chains as any`
- `packages/shared/src/config/blockchain.ts:247` - `(import.meta as any).env`
- Multiple `(import.meta as any)` casts across shared package

### H-4: console.debug usage in production shared code — FIXED
All `console.debug` calls replaced with `logger.debug` in:
- `packages/shared/src/config/passkeyServer.ts`
- `packages/shared/src/hooks/translation/useTranslation.ts`
- `packages/shared/src/modules/translation/db.ts`
- `packages/shared/src/modules/job-queue/index.ts`
- `packages/shared/src/modules/job-queue/event-bus.ts`
- `packages/shared/src/utils/storage/quota.ts`

### H-5: 164 unused files detected by knip — PARTIALLY FIXED
Removed 4 confirmed unused files:
- ~~`packages/admin/src/components/Garden/GardenHeroSection.tsx`~~ DELETED
- ~~`packages/admin/src/components/Garden/GardenStatsGrid.tsx`~~ DELETED
- ~~`packages/client/src/components/Display/PhoneFrame.tsx`~~ DELETED
- ~~`packages/client/src/views/Home/Garden/WorkApprovalDrawer.tsx`~~ DELETED

Remaining unused files (need manual review):
- `packages/admin/src/components/Layout/DashboardLayoutSkeleton.tsx`
- `packages/admin/src/components/ui/SectionHeader.tsx`
- `packages/agent/src/api/index.ts`
- `packages/agent/src/platforms/index.ts`
- `packages/agent/src/services/index.ts`

### H-6: 84 unused exports detected by knip
Notable unused exports from production code:
- `packages/shared/src/modules/data/eas.ts`: `EASFetchError`, `parseDataToWorkApproval`
- `packages/shared/src/modules/data/hypercerts.ts`: `getAttestationsByUIDs`, `getHypercertClaims`
- `packages/shared/src/modules/job-queue/index.ts`: `computeFirstIncompleteStep`, `draftDB`
- `packages/shared/src/utils/blockchain/abis.ts`: `JUICEBOX_ABI`
- `packages/client/src/components/Cards/Base/Card.tsx`: `CardHeader`, `CardFooter`, `CardTitle`, `CardDescription`, `CardContent`
- `packages/client/src/config.ts`: 12 unused config exports

### H-7: 7 unused dependencies + 6 unused devDependencies — PARTIALLY FIXED
**Removed** (confirmed unused):
- ~~`multiformats`~~ — removed from admin, agent, client, shared (kept in root — needed by `scripts/fix-multiformats.js` postinstall patch)
- ~~`gql.tada`~~ — removed from admin, client (still used in shared where it's actually imported)
- ~~`babel-plugin-react-compiler`~~ — removed from root devDeps only (kept in admin/client — actively used in `vite.config.ts` as Babel plugin)
- ~~`@radix-ui/react-avatar`~~ — removed from admin
- ~~`@radix-ui/react-tabs`~~ — removed from client

**Audit false positives corrected**:
- `multiformats` in root is NOT unused — required by postinstall compatibility shim for EAS SDK / WalletConnect transitive deps
- `babel-plugin-react-compiler` in admin/client is NOT unused — referenced in `vite.config.ts` `plugins` array
- `gql.tada` IS used in `packages/shared/src/modules/data/graphql.ts`. The admin/client listings were redundant (they get it transitively from shared).

**Remaining unverified** (need deeper usage analysis before removal):
- Root: `react-intl`, `uint8arrays`
- admin: `@reown/appkit-adapter-wagmi`, `posthog-js`
- agent: `@fastify/sensible`, `pino-pretty`, `posthog-node`
- client: `@reown/appkit`, `@tanstack/query-persist-client-core`, `clsx`
- indexer: `postgres`

**Remaining unused devDependencies**:
- Root: `@tailwindcss/forms`, `@tailwindcss/typography`, `dotenv-cli`, `graphql`, `lighthouse`, `lint-staged`, `tailwindcss-animate`, `tsc-alias`, `vite-plugin-mkcert`, `wait-port`
- agent: `@faker-js/faker`, `tsx`
- indexer: `@types/chai`, `chai`, `ts-mocha`

### H-8: 17 duplicate exports detected
Files with both named and default exports (code smell):
- `packages/client/src/components/Cards/Action/ActionCardSkeleton.tsx`: `ActionCardSkeleton` + `default`
- `packages/client/src/components/Navigation/LandingFooter.tsx`: `LandingFooter` + `Footer`
- `packages/shared/src/modules/data/ipfs.ts`: `initializeIpfsFromEnv` + `initializeStorachaFromEnv`
- Plus 14 more

---

## Medium Findings

### M-1: Solidity linting warnings (147 warnings, 0 errors)
All warnings are non-blocking quality improvements:
- **gas-indexed-events** (majority): Event parameters that could be indexed for cheaper filtering
- **named-parameters-mapping**: Unnamed mapping key/value parameters
- **no-empty-blocks**: 12 empty block warnings in GardenToken and resolvers
- **gas-struct-packing**: `WorkApprovalSchema` and `GardenConfig` structs have suboptimal packing
- **immutable-vars-naming**: Some immutables not using SNAKE_CASE

### M-2: Large files approaching god object threshold
Files above 500 lines (excluding tests and generated):
| File | Lines | Status |
|------|-------|--------|
| `admin/views/Gardens/Garden/Detail.tsx` | 2,038 | CRITICAL - decompose |
| `ops/src/index.ts` | 1,082 | HIGH - single-file server |
| `shared/modules/data/hypercerts.ts` | 939 | Moderate |
| `admin/views/Deployment/index.tsx` | 886 | High |
| `client/views/Home/WorkDashboard/index.tsx` | 861 | High |
| `shared/modules/job-queue/index.ts` | 854 | Moderate - complex domain |
| `shared/utils/blockchain/abis.ts` | 851 | OK (ABI definitions) |
| `client/views/Home/Garden/Work.tsx` | 851 | High |
| `shared/index.ts` | 790 | OK (barrel export) |
| `shared/hooks/vault/useVaultOperations.ts` | 762 | Moderate |
| `client/components/Dialogs/TreasuryDrawer.tsx` | 716 | High |

### M-3: Unresolved import (also reported as former L-3)
**File**: `packages/shared/.storybook/main.ts`
Import `@storybook/addon-actions` is unresolved — package is not installed in `node_modules`. Addon may need to be installed or configured.

### M-4: 79 unused exported types
Large number of exported types that are never imported externally. While types have zero runtime cost, they add API surface noise. Key areas:
- `packages/client/src/components/Cards/index.ts`: 12 unused type re-exports
- `packages/agent/src/`: 16 unused exported types across handlers/services
- `packages/shared/src/`: 30+ unused exported types across hooks/modules

### M-5: TODO comments in production code (4 active)
1. `packages/shared/src/hooks/gardener/useGardenerProfile.ts:127` - Replace with actual GraphQL query
2. `packages/shared/src/modules/data/eas.ts:436` - Pagination implementation needed
3. `packages/shared/src/components/SyncStatusBar.stories.tsx:5` - Stories depend on internal hooks
4. `packages/client/src/views/Home/GardenList.tsx:138` - Virtualize when gardens > 50

### M-6: Admin vite.config.ts uses console.log
**File**: `packages/admin/vite.config.ts:100,103`
```typescript
console.log('Indexer proxy error:', err);
console.log('Proxying request to indexer:', req.url);
```
Should use logger, though vite.config.ts is build-time only.

### M-7: Hardcoded zero addresses in blockchain config
**File**: `packages/shared/src/config/blockchain.ts:200-210`
Multiple fallbacks to `"0x0000000000000000000000000000000000000000"` for optional modules. While documented as intentional (zero = not deployed), using a named constant like `ADDRESS_ZERO` would improve readability.

### M-8: No package-specific .env files detected
All packages correctly share the root `.env` file. No violations of Rule #2.

### M-9: Test coverage imbalance
| Package | Source files | Test files | Ratio |
|---------|-------------|------------|-------|
| shared | 322 | 179 | 55% |
| admin | ~80 | 18 | 22% |
| client | ~60 | 12 | 20% |
| agent | 25 | 4 | 16% |
| contracts | 40 src | Multiple test dirs | Good |

Admin, client, and agent have relatively low test coverage.

### M-10: Agent package duplicates ABI definitions
**File**: `packages/agent/src/services/blockchain.ts:21-43`
The `GardenAccountABI` is defined locally in the agent package instead of importing from shared. Comment says "to avoid importing browser-dependent shared package utilities" but this creates maintenance burden.

### M-11: Index barrel files export too much
`packages/shared/src/index.ts` (790 lines) re-exports a very large surface area. Consider whether all 84+ unused exports need to be in the public API.

### M-12: Import after const declaration in agent
**File**: `packages/agent/src/services/blockchain.ts:44`
Imports (`import { Address, Chain, ... } from "viem"`) appear after the `GardenAccountABI` const declaration. Imports should be at the top of the file.

### M-13: DEPRECATED fields in deployment scripts
**Files**: `packages/contracts/script/DeployHelper.sol:63-64`, `packages/contracts/script/Deploy.s.sol:1217-1218`
Two deprecated fields (`gardenerAccountLogic`, `gardenerRegistry`) kept for JSON backward compatibility. Should have a timeline for removal.

### M-14: Duplicate configuration in client and admin
Both `packages/client/src/config.ts` and `packages/admin/src/config.ts` export nearly identical configuration functions (`getDefaultChain`, `getEASConfig`, `getIndexerUrl`, etc.). These should be consolidated in shared.

### M-15: Hook defined outside shared package (downgraded from C-2)
**File**: `packages/admin/src/views/Gardens/Garden/useGardenDetailData.ts`
`useGardenDetailData` composes 10+ shared hooks but lives in admin. Technically violates the "ALL hooks in shared" rule. **Downgraded from CRITICAL**: this is a single-use view composition hook that only serves the admin Detail view. Promoting every view-specific composition hook to shared would bloat shared with admin-only logic. Consider adding a rule exception for view-level composition hooks.

---

## Low Findings

### L-1: No dangerous Solidity patterns detected
No `selfdestruct`, `delegatecall`, or `tx.origin` usage in Green Goods contracts. The `unchecked` blocks (4 instances) are all standard loop counter optimizations.

### L-2: Solidity contract sizes are reasonable
Largest contracts (Hats.sol 852L, Gardens.sol 828L, Yield.sol 801L) are large but within acceptable bounds for module contracts.

### ~~L-3~~: _Merged into M-3 (duplicate finding)_

### L-4: Two unused enum members
- `TransferRestrictions.DisallowAll` (shared/lib/hypercerts/transactions.ts)
- `WeightScheme.Exponential`, `WeightScheme.Power` (shared/types/contracts.ts)

### L-5: Naming inconsistency in exports
`packages/client/src/components/Navigation/LandingFooter.tsx` exports both `LandingFooter` and `Footer`.
`packages/client/src/components/Navigation/LandingHeader.tsx` exports both `LandingHeader` and `Header`.

### L-6: Script-only console.log in contracts/
All `console.log` in the contracts package is in deployment/CLI scripts (deploy/, cli.ts), which is acceptable.

### L-7: Unlisted binaries (5 entries)
- Root: `trap`, `start`, `anvil`
- Various packages: `lsof`, `pkill`, `forge`
These are system/toolchain binaries used in scripts, not actual issues.

### L-8: Storage gap comment accuracy
`packages/contracts/src/tokens/Garden.sol:57-62`: Storage gap comment documents 13 used slots and 37 gap slots (50 total). This should be verified whenever new state variables are added.

### L-9: Multiple `(import.meta as any)` casts
Several files use `(import.meta as any).env` to access Vite environment variables. This is a known TypeScript limitation when shared code runs outside Vite. Consider a centralized env accessor utility.

---

## Dead Code Summary

### Unused Files (notable, excluding contracts/lib/ and docs/)
| Package | File | Status |
|---------|------|--------|
| admin | ~~`GardenHeroSection.tsx`~~ | **DELETED** |
| admin | ~~`GardenStatsGrid.tsx`~~ | **DELETED** |
| admin | `DashboardLayoutSkeleton.tsx` | Needs review |
| admin | `SectionHeader.tsx` | Needs review |
| client | ~~`PhoneFrame.tsx`~~ | **DELETED** |
| client | ~~`WorkApprovalDrawer.tsx`~~ | **DELETED** |
| agent | `api/index.ts`, `platforms/index.ts`, `services/index.ts` | Needs review |
| shared | `__tests__/utils/ens.test.skip.ts` | Needs review |
| shared | `__tests__/utils/text.test.skip.ts` | Needs review |

### Unused Dependencies (removed from package.json)
- ~~`multiformats`~~ — removed from admin, agent, client, shared (kept in root for postinstall patch)
- ~~`gql.tada`~~ — removed from admin, client (used in shared)
- ~~`babel-plugin-react-compiler`~~ — removed from root devDeps (kept in admin/client — used in vite.config.ts)
- ~~`@radix-ui/react-avatar`~~ — removed from admin
- ~~`@radix-ui/react-tabs`~~ — removed from client

---

## Architectural Anti-Patterns

| Anti-Pattern | Location | Severity | Status |
|-------------|----------|----------|--------|
| God Object | `admin/views/Gardens/Garden/Detail.tsx` (2,038 lines) | HIGH | Open |
| Hook outside shared | `admin/views/Gardens/Garden/useGardenDetailData.ts` | MEDIUM | Open (view composition exception) |
| Barrel import violations | `admin/components/Layout/Sidebar.tsx`, `admin/views/Dashboard/index.tsx`, `admin/views/Gardens/index.tsx` | HIGH | **FIXED** |
| Duplicate config | `client/src/config.ts` mirrors `admin/src/config.ts` | MEDIUM | Open |
| ABI duplication | `agent/services/blockchain.ts` duplicates GardenAccountABI | MEDIUM | Open |
| Import ordering | `agent/services/blockchain.ts` - imports after const | LOW | Open |

---

## Green Goods Rule Violations

| Rule | Violation | Location | Status |
|------|-----------|----------|--------|
| Rule #11 (Barrel imports) | Subpath imports instead of root | admin/Sidebar.tsx, admin/Dashboard, admin/Gardens | **FIXED** |
| Rule #12 (Console.log) | console.debug in production | shared/passkeyServer.ts, shared/translation, shared/job-queue | **FIXED** |
| Hooks in shared only | useGardenDetailData in admin | admin/views/Gardens/Garden/ | Open (consider rule exception) |

---

## Skill & Configuration Drift

| Reference | Location | Status |
|-----------|----------|--------|
| `useTimeout` | data-layer SKILL.md | Exists |
| `useDelayedInvalidation` | data-layer SKILL.md | Exists |
| `useEventListener` | data-layer SKILL.md | Exists |
| `useAsyncEffect` | data-layer SKILL.md | Exists |
| `useAsyncSetup` | data-layer SKILL.md | Exists |
| `useOffline` | data-layer SKILL.md | Exists |
| `useServiceWorkerUpdate` | monitoring SKILL.md | Exists |
| `useDraftAutoSave` | data-layer SKILL.md | Exists |
| `useDraftResume` | data-layer SKILL.md | Exists |
| `useJobQueue` | data-layer SKILL.md | Exists |
| `parseContractError` | error-handling SKILL.md | Exists |
| `createMutationErrorHandler` | error-handling SKILL.md | Exists |
| `mediaResourceManager` | data-layer SKILL.md | Exists |
| `getStorageQuota` | data-layer SKILL.md | Exists |
| `jobQueue` | data-layer SKILL.md | Exists |
| `jobQueueEventBus` | data-layer SKILL.md | Exists (**FIXED** - skill refs updated from `eventBus`) |
| `logger` | error-handling SKILL.md | Exists |
| `toastService` | error-handling SKILL.md | Exists |
| `Address` type | web3 SKILL.md | Exists |
| `Garden` type | contracts SKILL.md | Exists |
| `Work` type | contracts SKILL.md | Exists |
| `Action` type | contracts SKILL.md | Exists |
| `WorkApproval` type | contracts SKILL.md | Exists |
| `GardenAssessment` type | contracts SKILL.md | Exists |
| `Job` type | data-layer SKILL.md | Exists |
| `JobKind` type | data-layer SKILL.md | Exists |
| `WorkDraft` type | data-layer SKILL.md | Exists |
| `OfflineStatus` type | data-layer SKILL.md | Exists |

### Drift Recommendation
- ~~Update skill references from `eventBus` to `jobQueueEventBus`~~ **DONE**

---

## Recommendations (Priority Order)

1. ~~**Fix barrel import violations**~~ **DONE** — admin imports now use root `@green-goods/shared`
2. **Consider useGardenDetailData** — evaluate adding a rule exception for single-use view composition hooks, or promote to shared
3. **Decompose GardenDetail.tsx** — extract TabBadge, ActionMenu, TabActionCard, SectionStateCard, AlertRow into dedicated component files
4. ~~**Remove unused dependencies**~~ **PARTIALLY DONE** — removed `multiformats` (4 pkgs), `gql.tada` (2), `@radix-ui/react-avatar`, `@radix-ui/react-tabs`, `babel-plugin-react-compiler` (root). Remaining deps need deeper analysis.
5. ~~**Remove dead files**~~ **PARTIALLY DONE** — removed 4 confirmed unused files. Remaining need manual review.
6. ~~**Replace console.debug**~~ **DONE** — all shared production code now uses `logger.debug`
7. ~~**Update skill drift**~~ **DONE** — `eventBus` → `jobQueueEventBus` in all skill files
8. **Consolidate config.ts** — deduplicate client/admin config into shared
9. **Reduce `any` usage** — prioritize shared/config/appkit.ts and shared/config/blockchain.ts
10. **Add tests** — admin (22%), client (20%), and agent (16%) need more test coverage
11. **Install @storybook/addon-actions** — referenced in storybook config but not installed
