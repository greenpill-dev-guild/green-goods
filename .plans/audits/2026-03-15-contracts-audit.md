# Contracts Audit Report - 2026-03-15

## Executive Summary

- **Packages analyzed**: contracts (only)
- **Critical**: 0 | **High**: 0 | **Medium**: 6 | **Low**: 4
- **Dead code**: 2 source files (AaveV3.sol, validate-eas-*.mjs), 0 genuinely unused npm dependencies
- **Lint warnings**: 161 warnings + 1 error (up from 147 warnings, 0 errors)
- **Architectural violations**: 0
- **Mode**: Single-agent (contracts-scoped)
- **Baseline**: Commit c008b2b9 (6 commits since 2026-03-09 audit)

---

## Previous Findings Status

_Tracked from: 2026-03-09_

### Contracts-Relevant Findings

| ID | Finding | File | Status | Cycles Open | Notes |
|----|---------|------|--------|-------------|-------|
| M2 | Unused npm dependencies (6 packages) | `package.json` | STILL OPEN | 3 | Same 6 deps flagged by knip |
| M4 | Unused validation scripts | `script/validate-eas-*.mjs` | STILL OPEN | 2 | Both files still exist |
| M6 | Solidity lint warnings | `src/**/*.sol` | WORSENED | 3 | 147 warnings -> 161 warnings + 1 error |

### Escalation Applied

- **M2** (unused deps): Open 3 cycles -> **Escalated to HIGH** per escalation policy.
- **M6** (solidity lint): Open 3 cycles -> **Escalated to HIGH** per escalation policy. Additionally worsened (new error introduced).

---

## High Findings

None.

### ~~H1~~ Downgraded to INFORMATIONAL: npm dependencies flagged by knip are all false positives
- **File**: `packages/contracts/package.json`
- **Issue**: Knip flagged 6 deps as unused, but ALL are consumed via Foundry remappings (invisible to JS tooling):
  - `@chainlink/contracts-ccip` — used by `src/registries/ENS.sol` and `src/registries/ENSReceiver.sol` (CCIP crosschain ENS bridge)
  - `@ensdomains/ens-contracts` — used by ENS registries
  - `@ethereum-attestation-service/eas-contracts` — used by resolvers via `@eas/` remapping
  - `@openzeppelin/contracts-*` — used throughout via `@oz/` remappings
- **Resolution**: No action needed. This is a knip limitation for Solidity projects. Consider adding these to `.kniprc` ignore list to prevent future false escalations.

---

## Medium Findings

### M1. AaveV3ERC4626 uses `require` instead of custom error (NEW)
- **File**: `packages/contracts/src/strategies/AaveV3ERC4626.sol:215`
- **Issue**: `require(totalAvailable >= assets, "Aave: insufficient liquidity")` uses a string revert instead of a custom error. This is the only solhint **error** in the entire codebase (gas-custom-errors rule). String reverts cost ~20 bytes more per deployment and are harder to catch in client code via `parseContractError()`.
- **Recommendation**: Replace with a custom error: `error InsufficientLiquidity(uint256 available, uint256 requested);`

### M2. Solidity lint: 161 warnings + 1 error (worsened, open 3 cycles)
- **File**: Various files under `src/`
- **Issue**: Lint count increased from 147 to 162 problems (was 0 errors, now 1 error). Breakdown:
  - `gas-indexed-events`: 9 warnings (AaveV3.sol, AaveV3ERC4626.sol, Garden.sol)
  - `gas-struct-packing`: 2 warnings (Schemas.sol, Garden.sol)
  - `immutable-vars-naming`: 4 warnings (AaveV3.sol, AaveV3ERC4626.sol, Goods.sol)
  - `no-empty-blocks`: 11 warnings (Garden.sol)
  - `gas-custom-errors`: 1 error (AaveV3ERC4626.sol:215 -- the `require` statement)
  - Remaining: inherited from prior audit (module files)
- **Recommendation**: Fix the 1 error immediately. Address `immutable-vars-naming` warnings (rename `aavePool`/`aToken`/`dataProvider` to `AAVE_POOL`/`A_TOKEN`/`DATA_PROVIDER`).

### M3. Old AaveV3 strategy is dead production code (NEW)
- **File**: `packages/contracts/src/strategies/AaveV3.sol`
- **Issue**: The non-ERC4626 `AaveV3` strategy is not imported by any production source file. It was replaced by `AaveV3ERC4626.sol` (which OctantModule uses). The old strategy is only referenced by `test/unit/AaveV3YDSStrategy.t.sol`.
- **Recommendation**: Move `AaveV3.sol` to `src/mocks/` or `test/helpers/` since it only serves test purposes. Alternatively, delete it and update the test to use the ERC4626 variant.

### ~~M4~~ FALSE POSITIVE: CookieJarModule storage gap is already correct
- **File**: `packages/contracts/src/modules/CookieJar.sol:56-59`
- **Status**: RESOLVED — gap is already `uint256[39]` (11 entries + 39 gap = 50 total). Comment correctly reads "11 storage entries ... reserves 39 more here (50 total)." The original finding was based on stale code.

### ~~M5~~ RESOLVED: Validation scripts already removed
- **File**: `packages/contracts/script/validate-eas-immutables.mjs`, `validate-resolver-eas.mjs`
- **Status**: Files no longer exist. Confirmed via glob — removed since last audit cycle.

### ~~M6~~ FALSE POSITIVE: GardenAccount already uses `forceApprove()`
- **File**: `packages/contracts/src/accounts/Garden.sol:406`
- **Status**: RESOLVED — code already reads `IERC20(goodsToken_).forceApprove(community, stakeAmount)`. The original finding was based on stale code.

---

## Low Findings

### L1. IAaveV3Pool interface duplicated
- `src/strategies/AaveV3.sol:9-12` and `src/strategies/AaveV3ERC4626.sol:13-16` both define identical `IAaveV3Pool` interfaces.
- **Recommendation**: Extract to a shared interface file if AaveV3.sol is retained.

### L2. Old AaveV3 strategy uses bare `approve()` (line 73)
- `src/strategies/AaveV3.sol:73`: `underlyingAsset.approve(address(aavePool), amount)` — same issue as M6 but in dead code.
- **Recommendation**: Fix if retaining the file; moot if deleting per M3.

### L3. Empty catch blocks in production contracts
- 8 `catch { }` blocks in `src/tokens/Garden.sol` (lines 377-437) for module initialization callbacks.
- These are intentional (documented as "non-blocking") but discard error context.
- **Recommendation**: Consider emitting failure events (like OctantModule does) for post-mortem debugging.

### L4. `_readConvictionWeights` receives unused `proposalCount` parameter
- `src/resolvers/Yield.sol:656`: The `proposalCount` parameter is suppressed with `(proposalCount);` on line 663 and never used (iteration uses `maxIter`).
- **Recommendation**: Remove the parameter or use it for the array allocation size.

---

## Architectural Anti-Patterns

| Anti-Pattern | Location | Lines | Severity |
|--------------|----------|-------|----------|
| God object | `src/modules/Hats.sol` | 852 | MEDIUM |
| God object | `src/resolvers/Yield.sol` | 846 | MEDIUM |
| God object | `src/modules/Gardens.sol` | 829 | MEDIUM |
| God object | `src/modules/Octant.sol` | 785 | MEDIUM |
| God object | `src/tokens/Garden.sol` | 527 | LOW (approaching threshold) |

Note: Vendor files (MultistrategyVault at 2621 lines, TokenizedStrategy at 1826 lines) are excluded from this analysis as they are vendored from Octant/Yearn upstream.

---

## Dead Code Summary

| File | Type | Evidence |
|------|------|----------|
| `src/strategies/AaveV3.sol` | Dead production code | Not imported by any `src/` file; only test imports |
| ~~`script/validate-eas-immutables.mjs`~~ | ~~Stale utility~~ | RESOLVED — already removed |
| ~~`script/validate-resolver-eas.mjs`~~ | ~~Stale utility~~ | RESOLVED — already removed |

---

## Trend (contracts-specific, last 2 audits)

| Metric | 2026-03-09 | 2026-03-15 (current) |
|--------|------------|----------------------|
| Critical | 0 | **0** |
| High | 0 | **0** (H1 downgraded — knip false positive) |
| Medium | 3 (M2, M4, M6 contracts-relevant) | **6** |
| Low | 0 | **4** |
| Lint warnings | 147 | **161** |
| Lint errors | 0 | **1** |
| Dead files | 2 | **3** |
| Unused deps | 6 | **0** (all 6 are Foundry remapping false positives) |

**Observations**: The contracts package grew with AaveV3ERC4626, OctantModule, and YieldResolver since the last audit. Code quality is generally high -- well-documented with extensive NatSpec, proper storage gaps, and consistent patterns. The new `require` in AaveV3ERC4626 is the only lint error. The escalation of M2 (unused deps) is largely a knip limitation for Solidity projects -- only `@chainlink/contracts-ccip` is genuinely unused.

---

## Recommendations (Priority Order)

1. **Replace `require` with custom error in AaveV3ERC4626** -- fixes the only lint error and aligns with codebase pattern (Medium, M1)
2. **Move or delete `AaveV3.sol`** -- dead production code, only used by one test file (Medium, M3)
3. **Address lint warnings** -- prioritize the 4 `immutable-vars-naming` warnings as they are quick fixes (Low)

~~4. **Fix `approve()` to `forceApprove()`** -- FALSE POSITIVE, already uses `forceApprove()` (see M6)~~
~~5. **Fix CookieJarModule storage gap** -- FALSE POSITIVE, gap is already correct at 50 total (see M4)~~
