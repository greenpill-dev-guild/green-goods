// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { AaveV3ERC4626, IPoolDataProvider } from "../../src/strategies/AaveV3ERC4626.sol";

contract ArbitrumAaveStrategyForkTest is Test {
    address internal constant AAVE_V3_POOL = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
    address internal constant AAVE_V3_DATA_PROVIDER = 0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654;
    address internal constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address internal constant DAI = 0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1;
    address internal constant AWETH = 0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8;
    address internal constant ADAI = 0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE;

    function _tryFork() internal returns (bool) {
        string memory rpc;
        try vm.envString("ARBITRUM_RPC_URL") returns (string memory value) {
            rpc = value;
        } catch {
            try vm.envString("ARBITRUM_RPC") returns (string memory fallback_) {
                rpc = fallback_;
            } catch {
                return false;
            }
        }
        if (bytes(rpc).length == 0) return false;

        uint256 forkId = vm.createFork(rpc);
        vm.selectFork(forkId);
        return true;
    }

    function _deployStrategy(
        address asset,
        address aToken,
        string memory name,
        string memory symbol,
        address owner
    )
        internal
        returns (AaveV3ERC4626)
    {
        return new AaveV3ERC4626(asset, name, symbol, AAVE_V3_POOL, aToken, AAVE_V3_DATA_PROVIDER, owner);
    }

    function test_forkDeploy_reportsOnArbitrum() public {
        if (!_tryFork()) return;

        AaveV3ERC4626 wethStrategy = _deployStrategy(WETH, AWETH, "Green Goods Aave WETH", "ggaWETH", address(this));
        AaveV3ERC4626 daiStrategy = _deployStrategy(DAI, ADAI, "Green Goods Aave DAI", "ggaDAI", address(this));

        assertEq(wethStrategy.asset(), WETH, "weth strategy should expose the underlying asset");
        assertEq(address(wethStrategy.aavePool()), AAVE_V3_POOL, "weth strategy should point to Aave pool");
        assertEq(address(daiStrategy.aavePool()), AAVE_V3_POOL, "dai strategy should point to Aave pool");

        assertEq(wethStrategy.report(), 0, "expected zero balance for new strategy");
        assertEq(daiStrategy.report(), 0, "expected zero balance for new strategy");
    }

    function test_forkCycle_depositDeployReportFreeWithdraw() public {
        if (!_tryFork()) return;

        AaveV3ERC4626 strategy = _deployStrategy(WETH, AWETH, "Green Goods Aave WETH", "ggaWETH", address(this));
        strategy.setVault(address(this));

        uint256 depositAmount = 1 ether;
        deal(WETH, address(this), depositAmount);
        IERC20(WETH).approve(address(strategy), depositAmount);

        uint256 mintedShares = strategy.deposit(depositAmount, address(this));
        assertEq(mintedShares, depositAmount, "initial deposit should mint 1:1 shares");
        uint256 deployedReport = strategy.report();
        assertGe(deployedReport, depositAmount - 1, "report should include aToken balance");
        assertLe(deployedReport, depositAmount + 0.001 ether, "report should not wildly exceed deposit");

        // aToken balance should be non-zero
        uint256 aTokenBal = IERC20(AWETH).balanceOf(address(strategy));
        assertGt(aTokenBal, 0, "aToken balance should be positive after deploy");

        uint256 redeemedAssets = strategy.redeem(strategy.balanceOf(address(this)), address(this), address(this));

        // Strategy should now have ~0 balance, we should have received WETH
        uint256 afterFree = strategy.report();
        assertLe(afterFree, 1, "strategy should be near-empty after freeing funds");

        uint256 receiverBalance = IERC20(WETH).balanceOf(address(this));
        assertGe(receiverBalance, depositAmount - 2, "receiver should have gotten WETH back");
        assertEq(receiverBalance, redeemedAssets, "redeem return value should match assets received");
    }

    /// @notice Verify AAVE yield accrual over a simulated 30-day period via time warp
    /// @dev Deploys 10 WETH to AAVE, warps 30 days + 216000 blocks, then verifies
    ///      totalAssets > deposit (yield accrued). Withdraws all and verifies receiver
    ///      got more than the original deposit.
    function test_forkYieldAccrual_timeWarp() public {
        if (!_tryFork()) return;

        AaveV3ERC4626 strategy = _deployStrategy(WETH, AWETH, "Green Goods Aave WETH", "ggaWETH", address(this));
        strategy.setVault(address(this));

        uint256 depositAmount = 10 ether;
        deal(WETH, address(this), depositAmount);
        IERC20(WETH).approve(address(strategy), depositAmount);

        strategy.deposit(depositAmount, address(this));

        // Verify initial deployment
        uint256 postDeployReport = strategy.report();
        assertGe(postDeployReport, depositAmount - 1, "Post-deploy report should approximate deposit");

        // Time warp: 30 days forward, ~216000 blocks (Arbitrum ~12s blocks)
        vm.warp(block.timestamp + 30 days);
        vm.roll(block.number + 216_000);

        // Report should show yield accrued (totalAssets > deposit)
        uint256 postWarpReport = strategy.report();
        assertGt(postWarpReport, depositAmount, "Total assets should exceed deposit after 30 days of AAVE yield");

        // Withdraw all funds
        address receiver = address(0xBEEF);
        uint256 withdrawn = strategy.redeem(strategy.balanceOf(address(this)), receiver, address(this));

        // Verify receiver got more than the original deposit
        uint256 receiverBalance = IERC20(WETH).balanceOf(receiver);
        assertGt(receiverBalance, depositAmount, "Receiver should get more than deposit (yield earned)");
        assertEq(receiverBalance, withdrawn, "Receiver balance should match withdrawn amount");

        // Strategy should be near-empty
        uint256 afterFreeReport = strategy.report();
        assertLe(afterFreeReport, 1, "Strategy should be near-empty after full withdrawal");
    }

    /// @notice Verify maxDeposit() returns correct remaining capacity against real Aave V3 PoolDataProvider
    /// @dev Queries the real DataProvider for supply cap and aToken total supply, replicates
    ///      the unit-conversion logic (supplyCap is in full tokens, totalSupply is in wei),
    ///      and asserts the strategy's maxDeposit matches the independently computed value.
    function test_forkMaxDeposit_returnsCorrectRemainingCapacity() public {
        if (!_tryFork()) return;

        AaveV3ERC4626 strategy = _deployStrategy(WETH, AWETH, "Green Goods Aave WETH", "ggaWETH", address(this));
        IPoolDataProvider dp = IPoolDataProvider(AAVE_V3_DATA_PROVIDER);

        // --- 1. Verify reserve is active and not frozen/paused ---
        (,,,,,,,, bool isActive, bool isFrozen) = dp.getReserveConfigurationData(WETH);
        bool isPaused = dp.getPaused(WETH);
        assertTrue(isActive, "WETH reserve should be active on Arbitrum");

        // --- 2. Query supply cap and current utilization ---
        (, uint256 supplyCap) = dp.getReserveCaps(WETH);
        uint256 totalSupply = dp.getATokenTotalSupply(WETH);
        uint256 decimals = IERC20Metadata(WETH).decimals();

        // --- 3. Compute expected maxDeposit independently ---
        uint256 expectedMaxDeposit;
        if (!isActive || isFrozen || isPaused) {
            expectedMaxDeposit = 0;
        } else if (supplyCap == 0) {
            // Supply cap of 0 means unlimited
            expectedMaxDeposit = type(uint256).max;
        } else {
            uint256 supplyCapScaled = supplyCap * 10 ** decimals;
            if (supplyCapScaled <= totalSupply) {
                expectedMaxDeposit = 0;
            } else {
                expectedMaxDeposit = supplyCapScaled - totalSupply;
            }
        }

        // --- 4. Assert strategy's maxDeposit matches ---
        uint256 actualMaxDeposit = strategy.maxDeposit(address(this));
        assertEq(actualMaxDeposit, expectedMaxDeposit, "maxDeposit should match independently computed remaining capacity");

        // --- 5. Sanity: maxDeposit should be non-zero if reserve is healthy and has room ---
        if (isActive && !isFrozen && !isPaused && supplyCap > 0) {
            uint256 supplyCapScaled = supplyCap * 10 ** decimals;
            if (supplyCapScaled > totalSupply) {
                assertGt(actualMaxDeposit, 0, "maxDeposit should be positive when reserve has remaining capacity");
            }
        }

        // --- 6. Log values for debugging (visible with -vv) ---
        emit log_named_uint("supplyCap (full tokens)", supplyCap);
        emit log_named_uint("supplyCap (scaled wei)", supplyCap == 0 ? 0 : supplyCap * 10 ** decimals);
        emit log_named_uint("aTokenTotalSupply (wei)", totalSupply);
        emit log_named_uint("maxDeposit (wei)", actualMaxDeposit);
        emit log_named_uint("decimals", decimals);
    }

    /// @notice Verify maxDeposit returns type(uint256).max when supply cap is 0 (unlimited)
    /// @dev Uses DAI which may have different cap configuration than WETH.
    ///      If both WETH and DAI have non-zero caps on the fork, this test verifies
    ///      the cap-present path for a second asset as additional coverage.
    function test_forkMaxDeposit_secondAssetConsistency() public {
        if (!_tryFork()) return;

        AaveV3ERC4626 daiStrategy = _deployStrategy(DAI, ADAI, "Green Goods Aave DAI", "ggaDAI", address(this));
        IPoolDataProvider dp = IPoolDataProvider(AAVE_V3_DATA_PROVIDER);

        (, uint256 daiSupplyCap) = dp.getReserveCaps(DAI);
        uint256 daiTotalSupply = dp.getATokenTotalSupply(DAI);
        uint256 daiDecimals = IERC20Metadata(DAI).decimals();

        uint256 actualMaxDeposit = daiStrategy.maxDeposit(address(this));

        if (daiSupplyCap == 0) {
            // Unlimited — maxDeposit should be type(uint256).max (unless reserve is frozen/paused)
            (,,,,,,,, bool isActive, bool isFrozen) = dp.getReserveConfigurationData(DAI);
            bool isPaused = dp.getPaused(DAI);
            if (isActive && !isFrozen && !isPaused) {
                assertEq(actualMaxDeposit, type(uint256).max, "maxDeposit should be unlimited when supplyCap is 0");
            }
        } else {
            uint256 supplyCapScaled = daiSupplyCap * 10 ** daiDecimals;
            if (supplyCapScaled > daiTotalSupply) {
                uint256 expected = supplyCapScaled - daiTotalSupply;
                assertEq(actualMaxDeposit, expected, "DAI maxDeposit should match computed remaining capacity");
            } else {
                assertEq(actualMaxDeposit, 0, "DAI maxDeposit should be 0 when cap is fully utilized");
            }
        }

        emit log_named_uint("DAI supplyCap (full tokens)", daiSupplyCap);
        emit log_named_uint("DAI aTokenTotalSupply (wei)", daiTotalSupply);
        emit log_named_uint("DAI maxDeposit (wei)", actualMaxDeposit);
        emit log_named_uint("DAI decimals", daiDecimals);
    }

    /// @notice Verify maxDeposit returns 0 when deposits are paused on the strategy
    function test_forkMaxDeposit_returnsZeroWhenPaused() public {
        if (!_tryFork()) return;

        AaveV3ERC4626 strategy = _deployStrategy(WETH, AWETH, "Green Goods Aave WETH", "ggaWETH", address(this));

        // Before pausing, maxDeposit should be non-zero (assuming WETH reserve is healthy)
        uint256 beforePause = strategy.maxDeposit(address(this));

        // Pause deposits on the strategy
        strategy.setDepositsPaused(true);

        uint256 afterPause = strategy.maxDeposit(address(this));
        assertEq(afterPause, 0, "maxDeposit should be 0 when strategy deposits are paused");

        // Unpause and verify it recovers
        strategy.setDepositsPaused(false);
        uint256 afterUnpause = strategy.maxDeposit(address(this));
        assertEq(afterUnpause, beforePause, "maxDeposit should recover after unpausing");
    }
}
