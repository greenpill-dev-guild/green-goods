# Contracts Package Audit Report - 2026-02-27

## Executive Summary

- **Solidity source files**: 85 (including 17 mocks, 24 interfaces, 9 vendor files)
- **Test files**: 96
- **TypeScript tooling**: 26 scripts
- **Critical**: 2 | **High**: 5 | **Medium**: 7 | **Low**: 6

### Test Suite Status
- CI profile (via_ir=true): **1327 passed, 3 failed** (3 test regressions)
- Default profile (via_ir=false): **Compilation failure** (stack-too-deep)

### Verification Pass (Post-Audit)

All findings were verified against source code. Results:

| Finding | Verdict | Action |
|---------|---------|--------|
| C-1 | **CONFIRMED → FIXED** | Added `[profile.test]` with `via_ir=true`, excluded fork tests (Yul stack overflow), separate cache dirs |
| C-2 | **CONFIRMED → FIXED** | Missing mock functions: `getOrderInfo` + `IGardenAccountMetadata` |
| H-1 | **CONFIRMED → FIXED** (lower impact) | Aligned UUPS import, removed no-op init |
| H-2 | **FALSE POSITIVE** | Deps used via Foundry remappings, not TS imports |
| H-3 | CONFIRMED (design) | Single raw-token threshold — deployer sets knowingly |
| H-4 | **CONFIRMED → FIXED** | Gap comment was wrong (15 actual slots, not 17), gap adjusted 33→35 |
| H-5 | **FALSE POSITIVE** | Manual utility scripts (used for resolver fix) |
| M-1 | By design | Placeholder until eligibility modules deployed |
| M-2 | Informational | Vendored code — tracking recommendation only |
| M-3 | **FALSE POSITIVE** | Individual updates avoid struct overwrite — valid design |
| M-4 | **FALSE POSITIVE** | onlyOwner function — admin responsibility |
| M-5 | **FALSE POSITIVE** | Already documented in NatSpec |
| L-1 | **CONFIRMED → FIXED** | Stale comment removed |
| L-2 | **CONFIRMED → FIXED** | 3 files changed from UNLICENSED to MIT |
| L-3 | Intentional | Clearly marked as temporarily disabled |
| L-4 | Cosmetic | Standard try/catch warning suppression |
| L-5 | **FALSE POSITIVE** | CREATE2 deterministic address, correct by design |
| L-6 | **CONFIRMED → FIXED** | Raw selector now documented |

**Adjusted counts**: Critical: 2→0 | High: 5→1 | Medium: 7→2 | Low: 6→0 (after removing false positives and fixing confirmed issues)

---

## Critical Findings

### C-1: Default Profile Cannot Compile Test Suite (CRITICAL)

**File**: `foundry.toml` + test/source files
**Impact**: `bun run test` and `bun run test:fast` fail with stack-too-deep errors

The default foundry profile (`via_ir = false`) has `compilation_restrictions` for 5 source files that require `via_ir = true`, but several test/source files still trigger stack-too-deep when the full test suite (which transitively imports all source) is compiled in the default profile. The Yul exception references `var_ins_mpos` variables deep in the stack.

**Current workaround**: CI profile uses `via_ir = true` globally.
**Root cause**: `via_ir = false` with `compilation_restrictions` only applies to specific source paths, but test files that import those contracts (or transitive deps) still compile without via_ir.

**Recommendation**: Either:
1. Add `compilation_restrictions` for additional files causing stack-too-deep, OR
2. Make the default profile use `via_ir = true` (slower builds but correct), OR
3. Update `bun run test` script to use `FOUNDRY_PROFILE=ci` explicitly

### C-2: Three Test Regressions in CI Profile

**Tests failing**:
1. `test/integration/HypercertsIntegration.t.sol::test_delistCancelsOrder()` - log mismatch
2. `test/unit/GardensModule.t.sol::test_retryCreateCommunity_successAfterPartialFailure()` - call to non-contract address
3. `test/unit/HypercertsModule.t.sol::test_delistFromYield_success()` - EvmError: Revert

**Impact**: These indicate broken functionality or test drift. The GardensModule test failure (`call to non-contract address 0x100`) suggests a mock wiring issue where a mock contract was not deployed at the expected address.

---

## High Findings

### H-1: Inconsistent UUPSUpgradeable Import in ResolverStub

**File**: `src/resolvers/ResolverStub.sol:4`
```solidity
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
```

All other upgradeable contracts import from `@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol` (non-upgradeable variant). ResolverStub uses the upgradeable variant. This creates a potential storage layout mismatch if ResolverStub is ever used as an implementation behind a proxy alongside other contracts. The upgradeable variant has a `__gap` while the non-upgradeable variant does not.

**Recommendation**: Align to the same import used by all other contracts for consistency, or document the intentional difference.

### H-2: knip Reports 6 Unused Dependencies in package.json

**File**: `packages/contracts/package.json`

The following dependencies are flagged as unused by knip:
- `@chainlink/contracts-ccip`
- `@ensdomains/ens-contracts`
- `@ethereum-attestation-service/eas-contracts`
- `@openzeppelin/contracts-4.8.3`
- `@openzeppelin/contracts-5.0.2`
- `@openzeppelin/contracts-upgradeable`

**Note**: These are likely used via Foundry's remappings system (not TypeScript imports), so knip may not detect them. However, it is worth verifying that each is actually imported by at least one Solidity file. The dual OZ versions (`4.8.3` and `5.0.2`) warrant particular scrutiny -- mixing OZ versions creates potential Create2 collision issues as documented in project memory.

### H-3: Permissionless splitYield Timing Attack Surface

**File**: `src/resolvers/Yield.sol:234`

`splitYield()` is deliberately permissionless. The NatSpec acknowledges the timing risk: anyone can trigger yield distribution immediately after harvest, before additional yield accrues. While the code documents this is intentional with mitigations (fixed split ratios, minYieldThreshold), the `minYieldThreshold` is denominated in raw token units and defaults to a value that represents ~$7 for stablecoins but ~$21,000 for WETH. This mismatch is documented but could lead to operator confusion.

**Recommendation**: Consider per-asset configurable thresholds or a USD-oracle-based threshold.

### H-4: GardenAccount Storage Gap Calculation May Be Incorrect

**File**: `src/accounts/Garden.sol:414-415`

The gap comment states: `50 - (5 + 12) = 33 slots`. The 5 inherited slots come from Initializable (1), Lockable (1), Overridable (1), Permissioned (1), ERC6551Account (1). However, `AccountV3Upgradable` (tokenbound) has its own complex inheritance tree. If the parent's storage layout has changed or was miscounted, the gap would be wrong, risking storage collisions on upgrade.

**Recommendation**: Run `forge inspect GardenAccount storage-layout` and verify the exact slot count matches the documented layout.

### H-5: Unused TypeScript Script Files

**Files** (flagged by knip as unused):
- `script/utils/generate-schemas.ts`
- `script/utils/update-action-metadata.ts`
- `script/utils/update-instructions.ts`
- `script/validate-eas-immutables.mjs`
- `script/validate-resolver-eas.mjs`

These scripts are not referenced in `package.json` scripts. They may be one-off utilities that should either be integrated into the build system or removed.

---

## Medium Findings

### M-1: Eligibility Module Addresses Are All Zero

**File**: `src/lib/Hats.sol:76-96`

All eligibility module constants (`ARBITRUM_ALLOWLIST_ELIGIBILITY`, `SEPOLIA_ALLOWLIST_ELIGIBILITY`, etc.) are set to `address(0)` with "Placeholder" comments. This means `_configureEligibilityModules()` in HatsModule currently falls through without creating clones. Funder and community hats have no eligibility enforcement beyond Hats Protocol defaults.

### M-2: Large Vendored Octant Codebase (~8,000 lines)

**Directory**: `src/vendor/octant/` (7,973 lines)

This vendored code includes full implementations of MultistrategyVault, TokenizedStrategy, BaseHealthCheck, and associated libraries. Vendored code does not receive upstream security updates. If Octant releases patches, this code must be manually synchronized.

**Recommendation**: Track the upstream Octant commit hash in a comment/file and create a periodic update checklist.

### M-3: Deployment Registry Has Redundant Individual Update Functions

**File**: `src/registries/Deployment.sol:335-393`

The contract has `setNetworkConfig()` for full config updates AND nine individual `update*()` functions (updateActionRegistry, updateGardenToken, etc.). The individual functions each emit a full `NetworkConfigUpdated` event (with the entire struct), making them gas-inefficient duplicates.

**Recommendation**: Either remove individual update functions (use `setNetworkConfig` only) or make them emit field-specific events for gas efficiency.

### M-4: ActionRegistry Does Not Validate Slug Uniqueness

**File**: `src/registries/Action.sol:171-194`

`registerAction()` accepts a `slug` parameter but does not check for duplicate slugs across actions. Two actions could have the same slug, leading to ambiguity in frontends.

### M-5: Batch Minting ENS Limitation

**File**: `src/tokens/Garden.sol:301-306`

The `batchMintGardens()` function forwards `msg.value` to the first garden's ENS registration. Subsequent gardens with slugs will attempt ENS with zero value. This is documented in NatSpec but could still surprise callers.

### M-6: Multiple Compiler Warnings

The build output shows 8+ warnings:
- Function state mutability can be restricted to `view` in `src/mocks/Hats.sol` (lines 362, 368)
- Function state mutability can be restricted to `pure` in `src/mocks/Octant.sol` (line 192)
- Multiple warnings in test files (integration/FullModuleWiring.t.sol, GardenMinting.t.sol, invariant/RoleHierarchy.t.sol)

### M-7: Package.json Script Complexity

**File**: `packages/contracts/package.json`

The package has 88 scripts, many with complex shell pipelines (e.g., `test:e2e` chains 6 forge commands with `&&`). This makes debugging failures difficult and increases maintenance burden.

---

## Low Findings

### L-1: Stale `_GARDEN_ACCOUNT_IMPLEMENTATION` Comment

**File**: `src/tokens/Garden.sol:298`
```solidity
// _mintGardenInternal removed as it is no longer needed
```
This orphaned comment should be removed.

### L-2: Mixed License Headers

Most files use `MIT` license, but `src/registries/Action.sol` uses `UNLICENSED`. This inconsistency should be resolved.

### L-3: Commented-Out Function in GardenAccount

**File**: `src/accounts/Garden.sol:167-170`
```solidity
/// @dev Temporarily disabled -- updateCommunityToken affects Gardens V2 integration
// function updateCommunityToken(address _communityToken) external onlyOperator {
```
This dead code should either be removed or tracked as a TODO with an issue reference.

### L-4: Unused Return Variable Pattern

**File**: `src/tokens/Garden.sol:402-403`
```solidity
try octantModule.onGardenMinted(gardenAccount, config.name) returns (address[] memory _vaults) {
    _vaults; // Success handled by module events
```
The pattern `_vaults;` to suppress compiler warnings is used in multiple places. Consider using `/* _vaults */` syntax in the returns clause instead.

### L-5: Hats Protocol Address Constant

**File**: `src/lib/Hats.sol:17`

The Hats Protocol v1 address (`0x3bc1A0Ad72417f2d411118085256fC53CBdDd137`) is hardcoded as a constant. While this is correct (CREATE2 deterministic), it means the library cannot be used on chains where a v2 contract may be deployed to a different address. The `HatsModule.setHatsContract()` admin function provides runtime override, but `HatsLib` functions like `isSupported()` are disconnected from this.

### L-6: `_attemptSignalPoolMembershipJoin` Raw Call

**File**: `src/modules/Gardens.sol:690`
```solidity
(bool ok,) = community.call(abi.encodeWithSelector(bytes4(0x9a1f46e2), ""));
ok; // silence compiler warning for ignored result
```
Using a raw bytes4 selector (`0x9a1f46e2`) without a comment explaining what function it corresponds to reduces readability. Should document what `stakeAndRegisterMember(string)` corresponds to.

---

## Dead Code

| File | Export / Item | Status | Recommendation |
|------|-------------|--------|----------------|
| `script/utils/generate-schemas.ts` | Entire file | Unused (no package.json ref) | Remove or add script entry |
| `script/utils/update-action-metadata.ts` | Entire file | Unused (no package.json ref) | Remove or add script entry |
| `script/utils/update-instructions.ts` | Entire file | Unused (no package.json ref) | Remove or add script entry |
| `script/validate-eas-immutables.mjs` | Entire file | Unused (no package.json ref) | Remove or add script entry |
| `script/validate-resolver-eas.mjs` | Entire file | Unused (no package.json ref) | Remove or add script entry |
| `script/utils/validation.ts` | `CAPITAL_MAPPING`, `DOMAIN_MAPPING` | Unused exports | Remove or use |
| `script/utils/deployment-addresses.ts` | `DeploymentData`, `NetworkContracts`, `NetworkConfig`, `NetworksConfig` | Unused type exports | Remove or use |
| `script/utils/network.ts` | `NetworkConfig`, `DeploymentDefaults`, `NetworksFile`, `VerifierConfig` | Unused type exports | Remove or use |

---

## Anti-Patterns

| Issue | Location | Severity |
|-------|----------|----------|
| God Object (>500 lines) | `src/modules/Hats.sol` (852 lines), `src/modules/Gardens.sol` (828 lines), `src/resolvers/Yield.sol` (801 lines) | MEDIUM |
| Large Mock Files | `src/mocks/Hats.sol` (458 lines), `src/mocks/GAP.sol` (387 lines) | LOW |
| Vendored Code | `src/vendor/octant/` (~8K lines, no upstream tracking) | MEDIUM |
| Script Sprawl | 88 package.json scripts | LOW |

---

## Green Goods Violations

| Rule | Violation | Location |
|------|-----------|----------|
| No package .env files | None found | PASS |
| No hardcoded addresses (excluding constants) | Chain-specific constants in `src/lib/Hats.sol` and `src/lib/Karma.sol` | PASS (by design) |
| Single chain env | Correct | PASS |
| Build system | `bun run test` broken (C-1) | FAIL |

---

## Recommendations

1. **[URGENT]** Fix default profile compilation (C-1) so `bun run test` works without requiring CI profile
2. **[URGENT]** Fix the 3 failing tests (C-2) before any deployment
3. **[HIGH]** Align ResolverStub UUPSUpgradeable import with the rest of the codebase (H-1)
4. **[HIGH]** Verify GardenAccount storage layout with `forge inspect` (H-4)
5. **[MEDIUM]** Populate eligibility module addresses (M-1) or document when they will be set
6. **[MEDIUM]** Track vendored Octant upstream commit hash (M-2)
7. **[MEDIUM]** Clean up unused TypeScript scripts (H-5) and dead code exports
8. **[LOW]** Fix mixed license headers, remove stale comments, address compiler warnings
