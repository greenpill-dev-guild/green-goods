# Contracts Audit Report - 2026-04-03

## Executive Summary

- **Package analyzed**: contracts (22 modified source files, 1 new file)
- **Mode**: Single-agent, targeted | **Baseline**: d6095d27 (HEAD) + uncommitted changes
- **Critical**: 0 | **High**: 1 | **Medium**: 2 | **Low**: 1
- **Security (contracts)**: SEC-Critical: 0 | SEC-High: 0 | SEC-Medium: 0 | SEC-Low: 0
- **Build status**: FAILING (2 compilation errors in tests)
- **Dead code**: 0 real (6 knip false positives from Foundry remappings)
- **Skill & configuration drift**: None

### Change Summary

This audit covers a **single refactoring**: extraction of 5 commonly-duplicated custom errors into a new shared file `src/errors/CommonErrors.sol`. The errors are:

- `ZeroAddress()`
- `NotGardenOperator()`
- `UnauthorizedCaller(address caller)`
- `ArrayLengthMismatch()`
- `InvalidSchema()`

**17 source files** were modified to import from `CommonErrors.sol` instead of declaring errors locally. **1 new file** was created (`src/errors/CommonErrors.sol`). The refactoring eliminates ~35 redundant error declarations across the codebase.

### Key Assessment

The refactoring is architecturally sound:
- Error selectors are determined by signature, not declaration location -- **no ABI breakage**
- No storage layout changes -- **no upgrade safety concerns**
- No access control changes -- all `_authorizeUpgrade`, modifier, and role-check code is untouched
- No logic changes -- only `import` + `error` declaration lines changed

However, **test files were not updated** to account for the changed error resolution scope, causing 2 compilation failures.

---

## Previous Findings Status (contracts-only)

| ID | Finding | File | Status | Notes |
|----|---------|------|--------|-------|
| SEC-POSITIVE-1 | WorkApproval self-attestation check | `resolvers/WorkApproval.sol` | CARRY-FORWARD | Still present, unchanged |
| SEC-POSITIVE-2 | Redundant getAction() removal | `resolvers/WorkApproval.sol` | CARRY-FORWARD | Still present, unchanged |
| SEC-L1 | Intentional catch in Garden.sol | `accounts/Garden.sol` | CARRY-FORWARD | Still present, unchanged |
| M3 (prev) | Solidity lint warnings | Various | CARRY-FORWARD | Cannot verify -- build fails |

---

## Security Findings (contracts)

### SEC review of CommonErrors.sol refactoring

**All 17 modified source files reviewed.** Changes are strictly mechanical:
1. Add `import { ErrorName } from "../errors/CommonErrors.sol";`
2. Remove local `error ErrorName();` declaration
3. No logic, state, access control, or storage layout changes

**Detailed verification per contract category:**

**Accounts** (1 file):
- `Garden.sol`: Imports `NotGardenOperator`. Removed local declaration. No other changes. Access control via `_checkOperator()` still intact.

**Modules** (4 files):
- `Gardens.sol`: Imports `ZeroAddress`, `NotGardenOperator`. Both removed from contract body. UUPS `_authorizeUpgrade` unchanged (`onlyOwner`).
- `Hats.sol`: Imports `ZeroAddress`, `ArrayLengthMismatch`. Both removed from contract body. Hat-based access control unchanged.
- `Octant.sol`: Imports `ZeroAddress`, `UnauthorizedCaller`. Both removed. Factory pattern and operator checks unchanged.
- `Unlock.sol`: Imports `ZeroAddress`, `UnauthorizedCaller`. Both removed. Router authorization unchanged.

**Registries** (5 files):
- `Action.sol`: Imports `ZeroAddress`, `NotGardenOperator`. File-level errors moved. UUPS unchanged.
- `Deployment.sol`: Imports `UnauthorizedCaller`. Contract-level error removed. Allowlist checks unchanged.
- `ENS.sol`: Imports `ZeroAddress`. File-level error moved. Fee handling unchanged.
- `ENSReceiver.sol`: Imports `ZeroAddress`. File-level error moved. CCIP auth unchanged.
- `Power.sol`: Imports `ZeroAddress`. Contract-level error removed. UUPS unchanged.

**Resolvers** (4 files):
- `Assessment.sol`: Imports `InvalidSchema`. File-level error moved. Operator/evaluator checks unchanged.
- `Work.sol`: Imports `InvalidSchema`. File-level error moved. Member checks unchanged.
- `WorkApproval.sol`: Imports `NotGardenOperator`, `InvalidSchema`. File-level errors moved. Self-attestation check (SEC-POSITIVE-1) still intact.
- `Yield.sol`: Imports `ZeroAddress`, `UnauthorizedCaller`. Contract-level errors removed. ReentrancyGuard unchanged. Split ratio validation unchanged.

**Strategies** (1 file):
- `AaveV3ERC4626.sol`: Imports `ZeroAddress`. Contract-level error removed. Vault access control (`OnlyVault`) unchanged.

**Markets** (1 file):
- `HypercertMarketplaceAdapter.sol`: Imports `ZeroAddress`, `ArrayLengthMismatch`. Contract-level errors removed. Order validation unchanged.

**Mocks** (2 files):
- `GAP.sol`: Imports `ZeroAddress`. Local error removed. Mock only.
- `Hats.sol`: Imports `ArrayLengthMismatch`. Local error removed. Mock only.

**No security findings.** The refactoring is purely structural with no behavioral changes.

---

## High Findings

### H1. Build failure: 2 test files reference moved errors via contract namespace (NEW)

- **Files**:
  - `packages/contracts/test/fork/ArbitrumGardensNegativePaths.t.sol:84`
  - `packages/contracts/test/unit/AaveV3ERC4626.t.sol:66,90`
- **Risk score**: 9.0 (impact=3 x likelihood=3 x staleness=1.0)
- **Confidence**: HIGH
- **Issue**: The error centralization refactoring moved errors from contract-local declarations to file-scope imports from `CommonErrors.sol`. Two test files reference moved errors via `ContractName.ErrorName.selector`, which fails to compile because the error is no longer a member of the contract type:
  - `GardensModule.NotGardenOperator.selector` -- error imported at file scope in `Gardens.sol`, not accessible as a contract member in the fork test compilation group
  - `AaveV3ERC4626.ZeroAddress.selector` -- error imported at file scope in `AaveV3ERC4626.sol`, not accessible as a contract member

  Note: 45 other similar references across unit/integration tests compile successfully. The 2 failures appear to be caused by Solidity's dual-compilation-group behavior (the build runs 2 separate solc invocations with 50 and 70 files respectively). Tests in the failing group cannot resolve file-scope imported errors as contract members.

- **Recommendation**: Fix the 2 failing references by importing the error directly in the test:
  ```solidity
  // In ArbitrumGardensNegativePaths.t.sol:
  import { NotGardenOperator } from "../../src/errors/CommonErrors.sol";
  // Change line 84 to:
  vm.expectRevert(NotGardenOperator.selector);

  // In AaveV3ERC4626.t.sol:
  import { ZeroAddress } from "../../src/errors/CommonErrors.sol";
  // Change lines 66,90 to:
  vm.expectRevert(ZeroAddress.selector);
  ```

  Additionally, consider updating ALL 45 compiling references for consistency, replacing `ContractName.ErrorName.selector` with direct `ErrorName.selector` imports. This prevents future breakage if compilation groups change.

---

## Medium Findings

### M1. Incomplete error migration: Hypercerts.sol retains local ArrayLengthMismatch() (NEW)

- **File**: `packages/contracts/src/modules/Hypercerts.sol:56`
- **Risk score**: 2.0 (impact=1 x likelihood=1 x staleness=1.0)
- **Confidence**: HIGH
- **Issue**: `Hypercerts.sol` still declares `error ArrayLengthMismatch()` locally instead of importing from `CommonErrors.sol`. This is an incomplete migration -- the error has the same signature and selector as the centralized version but remains duplicated.
  - Note: `error ZeroAddress(string paramName)` in the same file is intentionally different (has a parameter) and should NOT be migrated.
  - `ICookieJarModule.sol` and `IKarmaGAPModule.sol` also retain local error declarations, but these are interface definitions where local declaration is an acceptable pattern for ABI clarity.
- **Recommendation**: Import `ArrayLengthMismatch` from `CommonErrors.sol` in `Hypercerts.sol` and remove the local declaration. Leave `ZeroAddress(string paramName)` as-is (different signature).

### M2. Latent test fragility: 45 test references use ContractName.ErrorName for imported errors (NEW)

- **File**: Multiple test files (see list below)
- **Risk score**: 4.0 (impact=2 x likelihood=1 x staleness=1.0)
- **Confidence**: HIGH
- **Issue**: 45 test references across 10 test files use `ContractName.ErrorName.selector` for errors that are now imported from `CommonErrors.sol` rather than declared locally. While these currently compile (possibly due to Solidity 0.8.28's resolution of file-scope imports within the same compilation group), they are fragile:
  - A future Solidity version may change file-scope error resolution behavior
  - Moving files between compilation groups (foundry profile changes) could break them
  - The pattern is inconsistent with the intended centralization

  **Affected test files (count of fragile references):**
  | Test File | Refs |
  |-----------|------|
  | `GardensModule.t.sol` | 10 |
  | `YieldSplitter.t.sol` | 10 |
  | `OctantModule.t.sol` | 9 |
  | `UnifiedPowerRegistry.t.sol` | 6 |
  | `HatsModule.t.sol` | 6 |
  | `DeploymentRegistryFork.t.sol` | 3 |
  | `ArbitrumNegativePaths.t.sol` | 3 |
  | `HypercertMarketplaceAdapter.t.sol` | 1 |

- **Recommendation**: Batch-update all test files to import errors directly from `CommonErrors.sol` and use `ErrorName.selector` instead of `ContractName.ErrorName.selector`. This can be done as a follow-up to H1.

---

## Low Findings

### L1. Vendor files retain duplicate error declarations (INFO)

- **Files**:
  - `packages/contracts/src/vendor/octant/errors.sol:8` -- `error ZeroAddress()`
  - `packages/contracts/src/vendor/octant/core/interfaces/IMultistrategyVault.sol:18` -- `error ZeroAddress()`
- **Risk score**: 1.0 (impact=1 x likelihood=1 x staleness=1.0)
- **Confidence**: HIGH
- **Issue**: Vendor files (third-party code) still declare `ZeroAddress()` locally. These were correctly excluded from the migration (vendor code should not import project-internal error libraries). No action needed -- this is informational.

---

## Architectural Anti-Patterns

| Anti-Pattern | Location | Risk Score | Notes |
|--------------|----------|------------|-------|
| Duplicate error declarations | `Hypercerts.sol` + `CommonErrors.sol` | 2.0 | `ArrayLengthMismatch` declared in both places |
| Interface error duplication | `ICookieJarModule.sol`, `IKarmaGAPModule.sol` | 1.0 | Acceptable pattern for interfaces |

---

## Dependency Health

No changes to contract dependencies in this refactoring. Knip reports 6 unused dependencies -- all false positives (Foundry git submodule remappings).

---

## Recommendations (Priority Order)

1. **Fix H1 (build failure)** -- Add `import { NotGardenOperator } from "../../src/errors/CommonErrors.sol"` to `ArbitrumGardensNegativePaths.t.sol` and `import { ZeroAddress } from "../../src/errors/CommonErrors.sol"` to `AaveV3ERC4626.t.sol`. Change `ContractName.ErrorName.selector` to `ErrorName.selector`. This restores compilation. (High, H1, risk=9.0)

2. **Complete migration (M1)** -- Import `ArrayLengthMismatch` in `Hypercerts.sol` from `CommonErrors.sol`. (Medium, M1, risk=2.0)

3. **Harden test references (M2)** -- Batch-update all 45 test references to use direct error imports instead of contract-scoped access. This is a consistency pass that prevents future breakage. (Medium, M2, risk=4.0)
