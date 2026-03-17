# Audit Report - 2026-03-15 (Admin Package)

## Executive Summary

- **Packages analyzed**: admin
- **Critical**: 0 | **High**: 2 | **Medium**: 7 | **Low**: 4
- **Dead code**: 31 unused files, 6 unused exports, 12 unused exported types, 1 unused devDependency
- **Lint warnings**: N/A (oxlint binary broken -- ERR_UNKNOWN_FILE_EXTENSION in ESM context)
- **Architectural violations**: 0 hooks outside shared, 0 package .env files, 0 deep path imports in production code
- **Mode**: Single-agent
- **Baseline**: Commits since 2026-03-09 full audit

---

## Previous Findings Status

_Tracked from: 2026-03-09 full audit_

### Critical Findings (all previously resolved)

| ID | Finding | Status |
|----|---------|--------|
| C1 | WithdrawModal shares vs assets | **FIXED** (confirmed 2026-03-08 v1, re-verified 2026-03-15) |
| C2 | CreateGarden infinite re-render | **FIXED** (confirmed 2026-03-08 v1) |

### High Findings

| ID | Finding | File | Status | Notes |
|----|---------|------|--------|-------|
| H2-prev | God object WorkDashboard (861 lines) | `client/views/Home/WorkDashboard/index.tsx` | N/A | Client package, not in scope |
| H3-prev | God object GardenWork (873 lines) | `client/views/Home/Garden/Work.tsx` | N/A | Client package, not in scope |

### Medium Findings (admin-relevant from prior audit)

| ID | Finding | Status | Notes |
|----|---------|--------|-------|
| M4 | Admin unused files (Work*, hypercerts, Actions steps) | STILL OPEN | 31 unused files, up from ~18 admin-specific |
| M5 | `as any` in PositionCard.tsx | STILL OPEN | 1 production `as any` remains (line 75) |
| M9 | God object Deployment (958 lines) | STILL OPEN | Unchanged at 958 lines. 3rd consecutive audit open. |
| L5 | DashboardLayoutSkeleton unused | **FIXED** | File deleted |
| L6 | SectionHeader unused | **FIXED** | File deleted |
| M2 | babel-plugin-react-compiler unused devDep | STILL OPEN | Still present in admin package.json |

---

## High Findings

### H1. Build broken: `OCTANT_VAULT_ABI` not exported from shared (NEW)
- **File**: `packages/admin/src/components/Vault/PositionCard.tsx:8`
- **Issue**: `PositionCard.tsx` imports `OCTANT_VAULT_ABI` from `@green-goods/shared`, but this symbol is not re-exported from `packages/shared/src/index.ts`. The ABI exists at `packages/shared/src/utils/blockchain/abis.ts:727` and is used internally by shared hooks (`useVaultPreview`, `useVaultOperations`), but was never added to the barrel export. This causes `vite build` to fail with: `"OCTANT_VAULT_ABI" is not exported by "packages/shared/src/index.ts"`.
- **Impact**: Admin production build is broken. The app likely works in dev mode because Vite's dev server resolves the alias `@green-goods/shared -> ../shared/src` which bypasses barrel export checking.
- **Recommendation**: Add `OCTANT_VAULT_ABI` to `packages/shared/src/index.ts` exports, or refactor `PositionCard.tsx` to use `useReadContracts` with inline ABI fragments instead of importing the full ABI.
- **Confidence**: HIGH (verified by running `bun run --filter '@green-goods/admin' build`)

### H2. Two test suites failing with stale assertions (NEW)
- **File**: `packages/admin/src/__tests__/components/Garden/ReviewStep.test.tsx:37`
- **File**: `packages/admin/src/__tests__/components/Garden/TeamStep.test.tsx:52`
- **Issue**: Both tests assert UI text that no longer exists in the components:
  - `ReviewStep.test.tsx` expects `"2 unique members"` but the component now shows separate gardener/operator lists with no unique count.
  - `TeamStep.test.tsx` expects `"Planned operators"` to appear before `"Planned gardeners"` but the section headings now use i18n keys (`app.roles.operator.plural` = "Garden operators") and the text `"Planned operators"` does not appear. The `indexOf` returns -1 for both, causing `expect(-1).toBeLessThan(-1)` to fail.
- **Impact**: `bun run test` exits with code 1 (2 failures out of 245 tests, 240 passing).
- **Recommendation**: Update both tests to match current component UI text, or delete them if the components are covered by other tests.
- **Confidence**: HIGH (verified by running `bun run --filter '@green-goods/admin' test`)

---

## Medium Findings

### M1. God object: Deployment view (958 lines) (STILL OPEN, 3rd cycle -- escalated from MEDIUM)
- **File**: `packages/admin/src/views/Deployment/index.tsx`
- **Issue**: 958 lines with 15+ hooks, 7 state variables, 5 async handlers, deployment logic, job monitoring, and allowlist management all in a single component. This has been open for 3 consecutive audits.
- **Recommendation**: Extract into sub-components: `DeploymentRunnerPanel`, `DeploymentJobMonitor`, `DeploymentAllowlistManager`.

### M2. 31 unused files in admin package (STILL OPEN)
- **File**: Various (full list from knip)
- **Key dead production files** (not stories):
  - `components/Work/WorkReviewSummary.tsx` -- 28 lines, never imported
  - `components/Work/WorkStatusBadge.tsx` -- 40 lines, never imported
  - `components/Work/WorkSubmissionDetails.tsx` -- 150 lines, never imported
  - `components/hypercerts/LeaveConfirmDialog.tsx` -- never imported
  - `components/hypercerts/RestoreDraftDialog.tsx` -- never imported
  - `components/hypercerts/WizardStepContent.tsx` -- 157 lines, never imported (logic inlined in HypercertWizard)
  - `components/hypercerts/WizardTypes.ts` -- never imported
  - `components/Garden/GardenHeroSection.tsx` -- 97 lines, never imported
  - `components/ui/cn.ts` -- duplicate of shared's `cn` utility, never imported
  - `views/Actions/BasicsStep.tsx` -- abandoned step decomposition
  - `views/Actions/CapitalsMediaStep.tsx` -- abandoned step decomposition
  - `views/Actions/InstructionsStep.tsx` -- abandoned step decomposition
  - `views/Actions/ReviewStep.tsx` -- abandoned step decomposition
  - `components/Assessment/CreateAssessmentSteps/DomainActionStep.tsx` -- never imported
  - `components/Assessment/CreateAssessmentSteps/SdgHarvestStep.tsx` -- never imported
- **12 story files** also flagged (story files for components that exist but are not wired into Storybook config entry points).
- **Recommendation**: Delete the 15 dead production files. Review story files against Storybook config.

### M3. Oxlint binary broken in ESM context (NEW)
- **File**: `packages/admin/package.json:15` (`"lint": "oxlint src"`)
- **Issue**: Running `bun run --filter '@green-goods/admin' lint` or `bunx oxlint` fails with `ERR_UNKNOWN_FILE_EXTENSION` because the oxlint binary at `node_modules/oxlint/bin/oxlint` has no file extension and the package.json has `"type": "module"`. Node.js v18 refuses to load extensionless files in ESM contexts.
- **Impact**: Lint checks cannot run for the admin package. This means no linting gate in local dev.
- **Recommendation**: Update oxlint to a version that fixes the binary extension issue, or invoke the binary via `bun run` which handles extensionless binaries.

### M4. 10 bare catch blocks silently discard errors (STILL OPEN)
- **Files**: `WorkDetail.tsx:76`, `CreateAssessment.tsx:159`, `Assessment.tsx:239,250`, `SignalPool.tsx:151`, `WithdrawModal.tsx:94`, `CookieJarWithdrawModal.tsx:68`, `CookieJarDepositModal.tsx:75`, `GardenCommunityCard.tsx:197`, `CreateListingDialog.tsx:95`
- **Issue**: `catch {` blocks with no error parameter discard error context. Most are for parseUnits/parseInt fallbacks (acceptable), but `GardenCommunityCard.tsx:197` and `CreateListingDialog.tsx:95` silently swallow mutation errors with only toast feedback and no logging.
- **Recommendation**: Add `logger.error()` calls in catch blocks that handle mutation failures.

### M5. 6 unused exports + 12 unused exported types (STILL OPEN)
- Unused exports: `test-utils.tsx` test helpers (7 exports), `shared.tsx` assessment helpers (2), `Button.tsx` variants, `Card.tsx` variants, `Skeleton.tsx` sub-components, `StatusBadge.tsx` variants
- Unused types: `CreateAssessmentForm`, `AssetTotalInput`, `AssetTotal`, `TxInlineFeedbackSeverity`, `CardProps`, `EmptyStateProps`, `SkeletonTextProps`, `SkeletonCardProps`, `SkeletonGridProps`, `StatusBadgeProps`, `OpsNetwork`, tab props (4)
- **Recommendation**: Remove unused variant exports; keep type exports that serve as public API contracts.

### M6. `as any` type assertion in production code (STILL OPEN)
- **File**: `packages/admin/src/components/Vault/PositionCard.tsx:75`
- **Issue**: `contracts: diagnosticContracts as any` -- the `useReadContracts` call uses `as any` to bypass type checking on the contracts array. This is related to H1 (OCTANT_VAULT_ABI not exported).
- **Recommendation**: Once H1 is fixed (ABI exported from shared), the `as const` on the ABI should make this typecheck correctly. If not, use proper wagmi contract typing.

### M7. Unlisted binary dependency (NEW)
- **File**: `packages/admin/package.json:7`
- **Issue**: The `predev` script uses `lsof` which is not declared as a dependency. While `lsof` is available on macOS/Linux, this would fail in containerized environments without it.
- **Recommendation**: Add a guard (`command -v lsof` check) or use a cross-platform port-killing approach.

---

## Low Findings

### L1. 12 story files flagged as unused by knip
- Story files exist but are not referenced by Storybook entry points in the current knip config. These may be valid if Storybook glob patterns pick them up at runtime.

### L2. `babel-plugin-react-compiler` listed as devDependency but flagged as unused by knip
- **File**: `packages/admin/package.json:55`
- The plugin IS used in `vite.config.ts:37` via Babel plugin config. This is a knip false positive (Babel plugins loaded by string name aren't detected by knip's static analysis).

### L3. Excluded test suites never run
- **File**: `packages/admin/vitest.config.ts:103-108`
- `src/__tests__/views/**`, `unauthorized-actions.test.tsx`, and `WithdrawModal.test.tsx` are all excluded from test runs. The comment says "hang indefinitely" due to dependency tree resolution. These tests are effectively dead.

### L4. Large files approaching god object threshold
- `Garden/Detail.tsx` (624 lines), `Contracts/index.tsx` (613 lines), `Endowments/index.tsx` (545 lines), `StrategyKernelStep.tsx` (542 lines) -- all approaching the 500+ threshold but still manageable.

---

## Skill & Configuration Drift

| Reference | Location | Status |
|-----------|----------|--------|
| All hooks | Skills | OK -- 0 hooks outside shared |
| `cn` utility | shared barrel | OK -- all admin files import from `@green-goods/shared` |
| `parseContractError` | Deployment view | OK -- used correctly |
| `toastService` | Multiple components | OK |
| `logger` | Multiple components | OK (no console.log in production) |
| Port 3002 | vite.config.ts:86 | OK -- matches ecosystem.config |
| Barrel imports | Production code | OK -- deep paths only in test setup |

No drift detected.

---

## Architectural Anti-Patterns

| Anti-Pattern | Location | Lines | Cycles Open | Severity |
|--------------|----------|-------|-------------|----------|
| God object | `admin/views/Deployment/index.tsx` | 958 | 3 | MEDIUM (escalated at 3+) |
| God object | `admin/views/Gardens/Garden/WorkDetail.tsx` | 686 | 1 | MEDIUM |
| God object | `admin/views/Actions/CreateAction.tsx` | 652 | 1 | MEDIUM |
| God object | `admin/components/hypercerts/HypercertWizard.tsx` | 632 | 1 | MEDIUM |
| No hooks outside shared | -- | -- | -- | OK |
| No package-level .env files | -- | -- | -- | OK |
| No deep path imports (prod) | -- | -- | -- | OK |
| No console.log in production | -- | -- | -- | OK |
| No hardcoded addresses (prod) | -- | -- | -- | OK |

---

## Trend (admin-scoped, last 2 audits)

| Metric | 2026-03-09 (full) | 2026-03-15 (admin) |
|--------|--------------------|--------------------|
| Critical | 0 | **0** |
| High | 0 (admin) | **2** |
| Medium | ~5 (admin) | **7** |
| Low | ~3 (admin) | **4** |
| Unused files (admin) | ~18 | **31** (knip now catches story files) |
| Unused exports (admin) | ~7 | **6** |
| Unused types (admin) | ~4 | **12** |
| Unused devDeps (admin) | 1 | **1** |
| `as any` (admin prod) | 1 | **1** |
| Bare catch (admin) | ~8 | **10** |
| Findings fixed | -- | **2** (L5, L6) |
| Findings opened | -- | **5** (H1, H2, M3, M7, L3) |
| Resolution velocity | -- | **0.4** |

**Observations**: The admin package has two new HIGH findings: a build-breaking missing export (H1) and stale test assertions (H2). The Deployment god object (958 lines) reaches its 3rd consecutive audit open and is escalated. Dead code count increased because knip now captures story files. The oxlint binary is broken in ESM context (M3). Resolution velocity is 0.4 (2 fixed, 5 opened) -- debt is growing.

---

## Recommendations (Priority Order)

1. **Fix build**: Export `OCTANT_VAULT_ABI` from `packages/shared/src/index.ts` (High, H1)
2. **Fix failing tests**: Update `ReviewStep.test.tsx` and `TeamStep.test.tsx` assertions to match current UI text (High, H2)
3. **Fix oxlint binary**: Upgrade oxlint or adjust lint script to use `bun run` invocation (Medium, M3)
4. **Delete dead production files**: Remove the 15 unused production files identified by knip (Medium, M2)
5. **Break up Deployment view**: Extract sub-components from the 958-line god object (Medium, M1)
6. **Add error logging**: Add `logger.error()` to bare catch blocks in mutation handlers (Medium, M4)
7. **Clean up unused exports**: Remove variant exports not consumed externally (Low, M5)
