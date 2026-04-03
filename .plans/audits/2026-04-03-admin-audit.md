# Audit Report - 2026-04-03 (Admin Package)

## Executive Summary

- **Packages analyzed**: admin (7 modified files) | **Mode**: Single-agent | **Baseline**: uncommitted working tree vs d6095d27
- **Critical**: 0 | **High**: 0 | **Medium**: 2 | **Low**: 2
- **Security (contracts)**: N/A (admin-only audit)
- **Dead code**: 4 unused files, 7 unused exports, 15 unused types, 5 unused deps
- **Build**: Green (8m 7s, Vite) | **TypeCheck**: 0 errors | **Lint**: 0 errors, 16 oxlint warnings (pre-existing, not in changed files)
- **Tests**: 265 passed / 0 failed / 3 skipped (29 test files)
- **Dependency health**: 5 unused deps (knip-reported), no new CVEs
- **Architectural violations**: 0 hooks outside shared, 0 skill drift, 0 package .env files

### Chronic findings (risk score > 8.0)

None in admin scope.

### Executive Delta (since 2026-04-03 shared audit)

- **Scope**: Uncommitted working tree changes in admin package only (7 modified files, net -1,073 lines)
- **Findings opened**: 4 (M1-admin, M2-admin, L1-admin, L2-admin) | **Findings closed**: 0 | **Net**: +4 (all new to admin scope)
- **Key changes**:
  - **CreateAction** (764 -> 216 lines, -72%): Step rendering extracted to 4 step components (`BasicsStep`, `CapitalsStep`, `InstructionsStep`, `ReviewStep`). Template selection correctly moved to `InstructionsStep`.
  - **Contracts** (613 -> 303 lines, -51%): Upgrade panel extracted to `ContractUpgradePanel`. New `useOpsRunnerConnect` and `useOpsJobRunner` hooks from shared replace inline auth/job logic.
  - **Endowments** (756 -> 612 lines, -19%): `AssetApyCard`, `MyTrackedPositionCard`, `VaultUnharvestedYield` extracted. Garden vault card still inline.
  - **Dashboard**: `useDashboardHeader` renamed to `getDashboardHeader` (pure function, correct -- was not a hook despite `use` prefix).
  - **DeploymentRunnerPanel**: Props simplified -- auth flow abstracted behind `connect`/`disconnect`/`isConnecting` (from `useOpsRunnerConnect`). Removed 5 auth-related props.
  - **Deployment/index**: Switched from `useOpsRunnerAuth` + `useOpsRunnerSession` to unified `useOpsRunnerConnect`.
  - **CreateAssessment**: Comment added documenting hook boundary exception for `useStepConfigs`.

---

## Previous Findings Status

_Admin-specific carry-forward from 2026-04-03 shared audit._

| ID | Finding | File | Status | Notes |
|----|---------|------|--------|-------|
| KI-001 / C1 | Hardcoded Hypercert Minter addresses | `shared/hooks/hypercerts/hypercert-contracts.ts` | CARRY-FORWARD (shared scope) | Not admin-owned. |
| KI-002 | God object WorkDashboard (838 lines) | `client/views/Home/WorkDashboard/index.tsx` | CARRY-FORWARD (client scope) | Not admin-owned. |
| M3 (prev) | Dead code: unused files | Admin subset | **STILL OPEN** (see M1-admin below) | 4 orphan files in Endowments. |

---

## New Findings

### M1-admin. Orphaned Endowment sub-components (4 unused files) (NEW)

- **Files**:
  - `packages/admin/src/views/Endowments/GardenVaultCard.tsx` (182 lines)
  - `packages/admin/src/views/Endowments/ImpactFundersSidebar.tsx` (exported but never imported)
  - `packages/admin/src/views/Endowments/ImpactFundersDialog.tsx` (only imported by ImpactFundersSidebar)
  - `packages/admin/src/views/Endowments/MyPositionsSidebar.tsx` (exported but never imported)
- **Risk score**: 2.0 (impact=1 x likelihood=2 x staleness=1.0)
- **Confidence**: HIGH
- **Issue**: These files were created in commit `a2f71171` ("fix(shared,admin): correct endowments yield and APY states") but never integrated into the Endowments view. `GardenVaultCard` appears to be an intended extraction target for the inline vault card rendering in `Endowments/index.tsx` (lines 510-604) but was never wired up. The sidebar components suggest a planned sidebar layout that was superseded by the current inline layout.
- **Recommendation**: Either integrate `GardenVaultCard` (would reduce `index.tsx` by ~90 lines, bringing it to ~520) or delete all 4 orphan files. The inline vault card rendering and these extracted components are duplicated intent.

### M2-admin. Unused dependencies (5 packages) (NEW)

- **File**: `packages/admin/package.json`
- **Risk score**: 1.5 (impact=1 x likelihood=1.5 x staleness=1.0)
- **Confidence**: HIGH (knip-reported)
- **Issue**: `@radix-ui/react-dropdown-menu`, `@radix-ui/react-slot`, `@reown/appkit`, `tailwind-merge`, `tailwind-variants` are listed as dependencies but not imported by any admin source file.
- **Recommendation**: Remove unused dependencies. Note: `tailwind-merge` and `tailwind-variants` may be used transitively through UI components imported from shared -- verify before removing.

### L1-admin. Duplicate export in SettingsSheet (NEW)

- **File**: `packages/admin/src/components/Layout/SettingsSheet.tsx`
- **Risk score**: 1.0 (impact=1 x likelihood=1 x staleness=1.0)
- **Confidence**: HIGH (knip-reported)
- **Issue**: Both named export `SettingsSheet` and `default` export exist. Knip flags this as a duplicate export.
- **Recommendation**: Remove the default export (named exports are the project convention).

### L2-admin. oxlint warnings in non-changed files (pre-existing) (CARRY-FORWARD)

- **Files**: Various (16 warnings across admin src)
- **Risk score**: 1.0 (impact=1 x likelihood=1 x staleness=1.0)
- **Confidence**: HIGH
- **Issue**: 16 oxlint warnings: 2 unused imports (`Alert` in MintProgress, `FractionTrade` in TradeHistoryTable), 1 autoFocus a11y (`CookieJarManageModal`), 1 unused import (`DEFAULT_CHAIN_ID` in CreateListingDialog), and others. None are in the changed files.
- **Recommendation**: Fix in a dedicated cleanup pass.

---

## Test Findings

### Admin: 265 tests passing (3 skipped, 29 test files)

- All passing. No regressions from component extractions.
- Skipped tests: pre-existing (not related to this changeset).

---

## Skill & Configuration Drift

All hooks, utilities, types, ports, commands, and env vars verified by `check-drift.sh`.

| Reference | Location | Status |
|-----------|----------|--------|
| All 12 hooks | Skills | OK |
| All 8 utilities | Skills | OK |
| All 10 types | Skills | OK |
| Port assignments | ecosystem.config.cjs | OK |
| Core commands | root package.json | OK |
| Environment vars | .env.schema | OK |
| Hook locations | validate-hook-location.sh | OK (0 outside shared) |

No drift detected.

---

## Architectural Anti-Patterns (admin, top 10 by risk score)

| Anti-Pattern | Location | Lines | Cycles Open | Risk Score | Severity | Notes |
|--------------|----------|-------|-------------|------------|----------|-------|
| Near-god object | `views/Gardens/Garden/WorkDetail.tsx` | 686 | pre-existing | 2.0 | MEDIUM | Under 700 threshold, but highest admin file |
| Near-god object | `views/Gardens/Garden/Detail.tsx` | 638 | pre-existing | 2.0 | MEDIUM | Complex garden detail view |
| Near-god object | `components/hypercerts/HypercertWizard.tsx` | 632 | pre-existing | 2.0 | MEDIUM | Multi-step wizard |
| Borderline | `views/Endowments/index.tsx` | 612 | 1 | 2.0 | MEDIUM | Down from 756. Could extract GardenVaultCard (~90 lines). |
| Borderline | `views/Gardens/Garden/SubmitWork.tsx` | 564 | pre-existing | 1.0 | LOW | Stable |
| Borderline | `views/Deployment/DeploymentRunnerPanel.tsx` | 553 | pre-existing | 1.0 | LOW | Prop-heavy but well-decomposed |
| Borderline | `views/Gardens/Garden/CreateAssessment.tsx` | 548 | pre-existing | 1.0 | LOW | Well-structured wizard |
| Dead files | `views/Endowments/GardenVaultCard.tsx` | 182 | 1 | 2.0 | MEDIUM | Orphan -- see M1-admin |
| Dead files | `views/Endowments/ImpactFundersSidebar.tsx` | - | 1 | 2.0 | MEDIUM | Orphan -- see M1-admin |
| Dead files | `views/Endowments/MyPositionsSidebar.tsx` | - | 1 | 2.0 | MEDIUM | Orphan -- see M1-admin |

**Resolved in this changeset**:
- **CreateAction** (764 -> 216 lines): 4 step components extracted. **RESOLVED.**
- **Contracts** (613 -> 303 lines): Upgrade panel extracted. **RESOLVED.**
- **Endowments** (756 -> 612 lines): 3 sub-components extracted. **IMPROVED** (not fully resolved -- GardenVaultCard inline).

---

## Dead Code Summary (knip-reported)

| Category | Count | Details |
|----------|-------|---------|
| Unused files | 4 | Endowments orphans (GardenVaultCard, ImpactFundersSidebar, ImpactFundersDialog, MyPositionsSidebar) |
| Unused exports | 7 | test-utils (6), shared components (1) |
| Unused exported types | 15 | Mostly Props types exported from UI components for consumer convenience |
| Unused dependencies | 5 | @radix-ui/react-dropdown-menu, @radix-ui/react-slot, @reown/appkit, tailwind-merge, tailwind-variants |
| Duplicate exports | 1 | SettingsSheet |

---

## Refactoring Quality Assessment

The uncommitted changes represent a high-quality decomposition pass:

1. **CreateAction step extraction** -- Clean separation into 4 focused step components (`BasicsStep`, `CapitalsStep`, `InstructionsStep`, `ReviewStep`). Template selection logic correctly moved to `InstructionsStep`. Parent view reduced from 764 to 216 lines (72% reduction).

2. **ContractUpgradePanel extraction** -- Self-contained panel with its own auth flow via `useOpsRunnerConnect` and job execution via `useOpsJobRunner`. Parent Contracts view reduced from 613 to 303 lines (51% reduction).

3. **Endowments sub-component extraction** -- `AssetApyCard`, `MyTrackedPositionCard`, `VaultUnharvestedYield` cleanly extracted with appropriate props. 19% reduction, but inline vault card rendering remains.

4. **Auth flow consolidation** -- Both Deployment and Contracts now use `useOpsRunnerConnect` from shared instead of duplicating auth challenge/verify logic. DeploymentRunnerPanel props reduced from 5 auth-related props to 3 (`connect`, `disconnect`, `isConnecting`).

5. **Dashboard hook rename** -- `useDashboardHeader` -> `getDashboardHeader` correctly reflects that this is a pure function (no hook calls), not a React hook. Comment documents the exception.

6. **CreateAssessment annotation** -- Comment added for `useStepConfigs` hook boundary exception. No code change needed -- the hook is non-exported and view-specific.

---

## Trend (admin-specific)

| Metric | 2026-04-02 | 2026-04-03 (current) |
|--------|------------|----------------------|
| Critical | 0 | **0** |
| High | 0 | **0** |
| Medium | - | **2** (orphan files, unused deps) |
| Low | - | **2** (duplicate export, pre-existing lint) |
| `as any` (admin prod) | - | **0** |
| Tests passing (admin) | 265 | **265** |
| Tests failing (admin) | 0 | **0** |
| God objects (admin >700) | 0 | **0** |
| Near-god objects (500-700) | 7 | **5** (2 resolved by extraction) |
| Largest admin file | 764 (CreateAction) | **686** (WorkDetail) |

---

## Recommendations (Priority Order)

1. **Integrate or remove Endowments orphan files** -- 4 unused files totaling ~500 lines. Integrating `GardenVaultCard` would reduce `Endowments/index.tsx` by ~90 lines. Simplest path: delete all 4 if the sidebar layout is abandoned. (Medium, M1-admin, risk=2.0)

2. **Remove unused dependencies** -- 5 packages in `package.json` not imported. Verify `tailwind-merge`/`tailwind-variants` aren't used transitively before removing. (Medium, M2-admin, risk=1.5)

3. **Fix duplicate SettingsSheet export** -- Remove default export, keep named export. (Low, L1-admin, risk=1.0)

4. **Clean up oxlint warnings** -- 16 pre-existing warnings, primarily unused imports. Quick batch fix. (Low, L2-admin, risk=1.0)

5. **Commit this changeset** -- Net -1,073 lines, 0 test regressions, clean type-check. CreateAction and Contracts views dramatically simplified. Recommend committing with scope `refactor(admin)`.
