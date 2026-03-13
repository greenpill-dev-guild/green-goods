# Octant Production Hardening — Phase 2: Test & Deploy Pipeline

> Plan created: 2026-03-12 (supersedes Phase 1, which is fully implemented)
> All findings validated against actual source code.

## Context

Phase 1 (4-layer vault fix + contract hardening) is **complete**. All 8 original steps are implemented:
- [x] backfillDonationAddresses (Octant.sol:535-543)
- [x] MAX_PROPOSALS_PER_SPLIT conviction cap (Yield.sol:117, 611)
- [x] _requireOctantReadiness yieldResolver check (Deploy.s.sol:641)
- [x] post-deploy-verify maxDebt + role checks (post-deploy-verify.ts:716-805)
- [x] maxWithdraw/maxRedeem Aave liquidity cap (AaveV3ERC4626.sol:154-172)
- [x] Per-asset yield thresholds (Yield.sol:185, 469, 834-837)
- [x] NatSpec documentation comments
- [x] Golden-path fork test — test 9 (ArbitrumExtendedE2E.t.sol:505-585)

**The contracts are correct. The problem is the test and deploy infrastructure still has blind spots that caused the last release's false positive.** Specifically: the deploy script said "success" when vaults existed but had no strategy, and CI tests passed because mocks bypass the exact validations that failed in production.

---

## Findings (Validated Against Source)

### CRITICAL — Caused the last false positive

| # | Finding | File | Lines | Evidence |
|---|---------|------|-------|----------|
| C1 | **`_runPostSeedReadinessChecks()` only checks vault existence, not strategy wiring** — vault can exist with no strategy, no autoAllocate, no accountant. Deploy reports success. | `Deploy.s.sol` | 538-544 | Only calls `getVaultForAsset() != address(0)`. Compare to `post-deploy-verify.ts:716-805` which checks strategy, autoAllocate, maxDebt, queue head, accountant, roles |
| C2 | **Integration test `MockOctantVault.add_strategy()` has zero ERC4626 validation** — accepts any address. Real vault checks `IERC4626Payable(strategy).asset() == vaultAsset`. | `src/mocks/Octant.sol` | 206-213 | Mock: `activeStrategies[_strategy] = true`. Real: `MultistrategyVault.sol:2306-2327` |
| C3 | **Mock `process_report()` skips accountant callback entirely** — directly mints shares without calling `IAccountant.report()`. The accountant path is never tested in CI. | `src/mocks/Octant.sol` | 254-267 | Mock mints `processReportShareAmount` directly. Real vault: 10-step accounting (lines 736-959) including `IAccountant(accountant).report(strategy, gain, loss)` |

### HIGH — Test coverage gaps

| # | Finding | File | Lines | Evidence |
|---|---------|------|-------|----------|
| H1 | **Crown jewel test NatSpec claims "yield split verified" but stops at harvest** — `_runCrownJewelYieldPipeline()` never calls `splitYield()`. Only test 9 exercises the full split. | `ArbitrumExtendedE2E.t.sol` | 402-417, 50-67 | NatSpec line 405: "yield split verified". Implementation line 66: last assertion is `gardenVaults == vault`. No `splitYield()` call. |
| H2 | **All fork tests silently skip when ARBITRUM_RPC_URL not set** — CI shows green with 0 tests actually run. No enforcement that fork tests executed. | `ArbitrumExtendedE2E.t.sol` | 126-129 | `if (!_tryChainFork("arbitrum")) { emit log("SKIPPED"); return; }` in every test function |
| H3 | **No test for Gardens/hypercerts pool route failure** — all tests leave `gardenHypercertPools[garden] == address(0)`, triggering escrow. No test attempts real CVStrategy pool interaction (expected to fail since 1hive hasn't deployed update). | `ArbitrumExtendedE2E.t.sol` | 565 | Fractions always escrowed — never routes to a real pool |
| H4 | **No unit tests for interest accrual / share price changes** — AaveV3ERC4626 only tested at 1:1 ratio. Core ERC4626 behavior (shares worth >1 asset after yield) never exercised in unit tests. | `AaveV3ERC4626.t.sol` | entire file | All tests deposit and immediately withdraw. No aToken balance increase between deposit and withdraw. |

### LOW — Code hygiene

| # | Finding | File | Lines |
|---|---------|------|-------|
| L1 | `AaveV3ERC4626.donationAddress` is dead storage — never consumed by yield routing logic (accountant mechanism handles it). Exists for `IOctantStrategy` interface compliance. | `AaveV3ERC4626.sol` | 64, 179-184 |
| L2 | `ArbitrumOctantVault.t.sol` is a stub — single chain-ID smoke test. NatSpec says "detailed tests in E2E suite" but creates misleading coverage impression. | `ArbitrumOctantVault.t.sol` | entire file |

---

## Implementation Plan

### Step 1: Harden Deploy Post-Seed Checks (CRITICAL, blocks release)

**File:** `packages/contracts/script/Deploy.s.sol`

Add strategy-level assertions to `_runPostSeedReadinessChecks()` mirroring `post-deploy-verify.ts:716-805`:

```solidity
if (_envBoolOrDefault("REQUIRE_OCTANT_READY", true)) {
    address[] memory activeOctantAssets = _getActiveOctantAssets();
    for (uint256 i = 0; i < activeOctantAssets.length; i++) {
        address vault = octantModule.getVaultForAsset(rootGardenAddress, activeOctantAssets[i]);
        if (vault == address(0)) revert RootGardenVaultMissing(activeOctantAssets[i]);

        // --- NEW: Verify vault is fully wired (prevents silent strategy attachment failures) ---
        address strategy = octantModule.vaultStrategies(vault);
        if (strategy == address(0)) revert RootGardenStrategyMissing(activeOctantAssets[i]);

        if (!IOctantVault(vault).autoAllocate()) revert RootGardenAutoAllocateDisabled(activeOctantAssets[i]);

        (, , , uint256 maxDebt) = IOctantVault(vault).strategies(strategy);
        if (maxDebt == 0) revert RootGardenMaxDebtZero(activeOctantAssets[i]);

        address resolver = octantModule.yieldResolver();
        if (resolver != address(0)) {
            if (IOctantVault(vault).accountant() != resolver) {
                revert RootGardenAccountantMismatch(activeOctantAssets[i]);
            }
        }
    }
}
```

Add corresponding custom errors. Also add `console.log("SKIP: Octant not configured")` to the silent return paths in `_configureOctant()` (Deploy.s.sol:226-240).

**Tests:** Existing deploy E2E should still pass. Add test that deploy reverts when strategy attachment silently fails.

### Step 2: Real-Vault Integration Test (CRITICAL)

**File:** `packages/contracts/test/integration/OctantVaultIntegration.t.sol`

Add a new test that uses the real `MultistrategyVault` (not mock) to verify ERC4626 validation and accountant callback work in CI without requiring a fork RPC:

```solidity
contract RealVaultIntegrationTest is Test {
    // Deploy real MultistrategyVault + MultistrategyVaultFactory
    // Deploy AaveV3ERC4626 with mock Aave (for deposit/withdraw)
    // Verify: add_strategy succeeds (ERC4626 check passes)
    // Verify: process_report calls IAccountant.report() on YieldResolver
    // Verify: fee shares are minted to YieldResolver (the accountant)
    // Verify: OctantModule.harvest() detects and registers shares
}
```

Key: This runs in CI without `ARBITRUM_RPC_URL`. Uses real vault + real strategy + mock Aave pool. Tests the wiring, not Aave yield.

### Step 3: Crown Jewel Test — Add splitYield (HIGH)

**File:** `packages/contracts/test/fork/e2e/ArbitrumExtendedE2E.t.sol`

Extend `_runCrownJewelYieldPipeline` to include the full split:

```solidity
function _runCrownJewelYieldPipeline(address garden, uint256 actionUID) internal returns (address vault) {
    // ... existing harvest logic ...

    // NEW: Complete the yield pipeline
    yieldSplitter.setMinYieldThreshold(0); // Allow small amounts for test
    address cookieJar = address(0xC001);
    yieldSplitter.setCookieJar(garden, cookieJar);
    address treasury = address(0x7EA5);
    yieldSplitter.setGardenTreasury(garden, treasury);

    yieldSplitter.splitYield(garden, WETH, vault);
    assertGt(IERC20(WETH).balanceOf(cookieJar), 0, "crown jewel: cookie jar should receive yield");
    assertEq(yieldSplitter.gardenShares(garden, vault), 0, "crown jewel: all shares redeemed");
}
```

Also fix NatSpec at line 402-405 to match implementation.

### Step 4: Gardens Pool Failure Test (HIGH)

**File:** `packages/contracts/test/fork/e2e/ArbitrumExtendedE2E.t.sol`

Add test that exercises the expected Gardens/hypercerts failure path:

```solidity
/// @notice Verify that fractions route correctly handles both:
///         (a) no pool configured → escrow
///         (b) stale pool configured → revert/escrow fallback
function testForkArbitrum_e2e_fractionsEscrowAndStalePoolFailure() public {
    // Part A: gardenHypercertPools == address(0) → fractions escrowed (default behavior)
    // Part B: Set a real CVStrategy address from Gardens V2 → attempt splitYield →
    //         expect revert or graceful escrow since the pool doesn't support yield reads
}
```

### Step 5: Interest Accrual Unit Tests (HIGH)

**File:** `packages/contracts/test/unit/AaveV3ERC4626.t.sol`

Add scenarios where share price diverges from 1:1:

```solidity
function test_interestAccrual_sharesWorthMoreAfterYield() public {
    strategy.deposit(100 ether, address(vault));
    // Simulate yield: mint extra aTokens to strategy (like Aave interest)
    aToken.mint(address(strategy), 10 ether);
    // Now 100 shares should be worth 110 assets
    assertEq(strategy.convertToAssets(100 ether), 110 ether);
}

function test_redeem_afterInterestAccrual_returnsCorrectAssets() public { ... }
function test_multiDepositor_differentSharePrices() public { ... }
function test_maxWithdraw_respectsLiquidityAtNon1to1SharePrice() public { ... }
```

### Step 6: Fork Test CI Enforcement (MEDIUM)

**File:** `.github/workflows/contracts.yml` (or equivalent CI config)

Add a dedicated CI job for fork tests that:
- Requires `ARBITRUM_RPC_URL` secret
- Runs `bun run test:fork` with `--fail-on-skip` or equivalent
- Reports as a separate check (can be non-blocking initially)
- At minimum, logs a warning if all fork tests were skipped

Alternative: Add a `test:fork:count` script that asserts N tests actually ran (not just "0 failed").

### Step 7: Remove MockOctantVault ERC4626 Bypass (MEDIUM)

**File:** `packages/contracts/src/mocks/Octant.sol`

Add minimal ERC4626 validation to `MockOctantVault.add_strategy()`:

```solidity
function add_strategy(address _strategy, bool addToQueue) external override {
    if (msg.sender != roleManager) revert UnauthorizedRoleManager();
    // Mirror real vault's ERC4626 validation to prevent false positives
    require(IERC4626(_strategy).asset() == asset, "InvalidAsset");
    activeStrategies[_strategy] = true;
    // ...
}
```

This ensures existing integration tests fail if a non-ERC4626 strategy is accidentally introduced, matching production behavior.

---

## Execution Strategy

### Wave 1 (Release blockers) — Steps 1, 2
- Step 1 (deploy checks) and Step 2 (real-vault integration test) are independent → parallel
- Together they close the exact gap that caused the last false positive

### Wave 2 (Test depth) — Steps 3, 4, 5
- Step 3 (crown jewel), Step 4 (pool failure), Step 5 (interest accrual) are all independent → parallel
- All are test-only changes — no contract modifications

### Wave 3 (Infrastructure) — Steps 6, 7
- Step 6 (CI enforcement) requires CI config changes — may need ops review
- Step 7 (mock validation) is a small change to the mock — low risk

### Validation
After all steps: `bun format && bun lint && bun run test && bun build`
Fork validation: `bun run test:fork` (requires ARBITRUM_RPC_URL)

---

## Success Criteria

1. **Deploy script rejects partially-wired vaults** — `_runPostSeedReadinessChecks` catches missing strategy, autoAllocate, maxDebt, accountant
2. **CI catches ERC4626 incompatibility without fork RPC** — real-vault integration test runs unconditionally
3. **Crown jewel test exercises full pipeline** including splitYield
4. **Gardens pool failure is explicitly tested** — both escrow and stale pool paths
5. **Interest accrual is unit-tested** — share price >1:1 scenarios covered
6. **Fork tests cannot silently report success** when actually skipped
