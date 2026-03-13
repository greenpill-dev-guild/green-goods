// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { AaveV3ERC4626 } from "../../src/strategies/AaveV3ERC4626.sol";

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
}
