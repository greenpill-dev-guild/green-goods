// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { AaveV3YDSStrategy } from "../../src/strategies/AaveV3YDSStrategy.sol";

contract ArbitrumAaveStrategyForkTest is Test {
    address internal constant AAVE_V3_POOL = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
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

    function test_forkDeploy_reportsOnArbitrum() public {
        if (!_tryFork()) return;

        AaveV3YDSStrategy wethStrategy = new AaveV3YDSStrategy(WETH, AAVE_V3_POOL, AWETH, address(this));
        AaveV3YDSStrategy daiStrategy = new AaveV3YDSStrategy(DAI, AAVE_V3_POOL, ADAI, address(this));

        assertEq(address(wethStrategy.aavePool()), AAVE_V3_POOL, "weth strategy should point to Aave pool");
        assertEq(address(daiStrategy.aavePool()), AAVE_V3_POOL, "dai strategy should point to Aave pool");

        assertEq(wethStrategy.report(), 0, "expected zero balance for new strategy");
        assertEq(daiStrategy.report(), 0, "expected zero balance for new strategy");
    }

    function test_forkCycle_depositDeployReportFreeWithdraw() public {
        if (!_tryFork()) return;

        AaveV3YDSStrategy strategy = new AaveV3YDSStrategy(WETH, AAVE_V3_POOL, AWETH, address(this));

        uint256 depositAmount = 1 ether;
        deal(WETH, address(strategy), depositAmount);

        // Verify idle balance shows in report before deploying to Aave
        uint256 idleReport = strategy.report();
        assertEq(idleReport, depositAmount, "idle balance should equal deposit");

        // Deploy funds to Aave
        strategy.deployFunds(depositAmount);

        // After deploying, idle balance should be ~0, aToken balance should be ~depositAmount
        uint256 deployedReport = strategy.report();
        assertGe(deployedReport, depositAmount - 1, "report should include aToken balance");
        assertLe(deployedReport, depositAmount + 0.001 ether, "report should not wildly exceed deposit");

        // aToken balance should be non-zero
        uint256 aTokenBal = IERC20(AWETH).balanceOf(address(strategy));
        assertGt(aTokenBal, 0, "aToken balance should be positive after deploy");

        // Free all funds from Aave (use type(uint256).max to handle rounding)
        strategy.freeFunds(type(uint256).max, address(this));

        // Strategy should now have ~0 balance, we should have received WETH
        uint256 afterFree = strategy.report();
        assertLe(afterFree, 1, "strategy should be near-empty after freeing funds");

        uint256 receiverBalance = IERC20(WETH).balanceOf(address(this));
        assertGe(receiverBalance, depositAmount - 2, "receiver should have gotten WETH back");
    }
}
