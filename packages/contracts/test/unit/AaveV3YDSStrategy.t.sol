// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";

import { AaveV3YDSStrategy } from "../../src/strategies/AaveV3YDSStrategy.sol";
import { MockAavePool, MockAToken } from "../../src/mocks/MockAavePool.sol";
import { MockERC20 } from "../../src/mocks/ERC20.sol";

/// @title AaveV3YDSStrategyTest
/// @notice Unit tests for AaveV3YDSStrategy using MockAavePool (no fork RPC needed)
contract AaveV3YDSStrategyTest is Test {
    AaveV3YDSStrategy internal strategy;
    MockERC20 internal asset;
    MockAToken internal aToken;
    MockAavePool internal pool;

    address internal owner = address(this);
    address internal unauthorized = address(0x999);
    address internal donation = address(0xD0);

    function setUp() public {
        asset = new MockERC20();
        aToken = new MockAToken();
        pool = new MockAavePool(address(aToken));

        strategy = new AaveV3YDSStrategy(address(asset), address(pool), address(aToken), owner);

        // Fund the strategy with some tokens for testing
        asset.transfer(address(strategy), 1000 ether);

        // Fund the pool so withdrawals work
        asset.transfer(address(pool), 5000 ether);
    }

    // =========================================================================
    // Constructor Tests
    // =========================================================================

    function test_constructor_setsImmutables() public {
        assertEq(address(strategy.underlyingAsset()), address(asset));
        assertEq(address(strategy.aavePool()), address(pool));
        assertEq(address(strategy.aToken()), address(aToken));
        assertEq(strategy.owner(), owner);
    }

    function test_constructor_revertsForZeroAsset() public {
        vm.expectRevert(AaveV3YDSStrategy.ZeroAddress.selector);
        new AaveV3YDSStrategy(address(0), address(pool), address(aToken), owner);
    }

    function test_constructor_revertsForZeroPool() public {
        vm.expectRevert(AaveV3YDSStrategy.ZeroAddress.selector);
        new AaveV3YDSStrategy(address(asset), address(0), address(aToken), owner);
    }

    function test_constructor_revertsForZeroAToken() public {
        vm.expectRevert(AaveV3YDSStrategy.ZeroAddress.selector);
        new AaveV3YDSStrategy(address(asset), address(pool), address(0), owner);
    }

    function test_constructor_revertsForZeroOwner() public {
        vm.expectRevert(AaveV3YDSStrategy.ZeroAddress.selector);
        new AaveV3YDSStrategy(address(asset), address(pool), address(aToken), address(0));
    }

    function test_constructor_transfersOwnershipWhenDifferentFromSender() public {
        address differentOwner = address(0xBEEF);
        AaveV3YDSStrategy s = new AaveV3YDSStrategy(address(asset), address(pool), address(aToken), differentOwner);
        assertEq(s.owner(), differentOwner);
    }

    // =========================================================================
    // setDonationAddress Tests
    // =========================================================================

    function test_setDonationAddress_updatesAddress() public {
        strategy.setDonationAddress(donation);
        assertEq(strategy.donationAddress(), donation);
    }

    function test_setDonationAddress_revertsForZeroAddress() public {
        vm.expectRevert(AaveV3YDSStrategy.ZeroAddress.selector);
        strategy.setDonationAddress(address(0));
    }

    function test_setDonationAddress_revertsForNonOwner() public {
        vm.prank(unauthorized);
        vm.expectRevert("Ownable: caller is not the owner");
        strategy.setDonationAddress(donation);
    }

    function test_setDonationAddress_emitsEvent() public {
        vm.expectEmit(true, true, false, false);
        emit AaveV3YDSStrategy.DonationAddressUpdated(address(0), donation);
        strategy.setDonationAddress(donation);
    }

    // =========================================================================
    // deployFunds Tests
    // =========================================================================

    function test_deployFunds_suppliesToAave() public {
        uint256 amount = 100 ether;
        strategy.deployFunds(amount);

        assertEq(aToken.balanceOf(address(strategy)), amount, "aToken balance should match deposited amount");
    }

    function test_deployFunds_revertsForNonOwner() public {
        vm.prank(unauthorized);
        vm.expectRevert("Ownable: caller is not the owner");
        strategy.deployFunds(100 ether);
    }

    function test_deployFunds_revertsWhenPaused() public {
        strategy.setDepositsPaused(true);

        vm.expectRevert(AaveV3YDSStrategy.DepositsPaused.selector);
        strategy.deployFunds(100 ether);
    }

    function test_deployFunds_emitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit AaveV3YDSStrategy.FundsDeployed(100 ether);
        strategy.deployFunds(100 ether);
    }

    // =========================================================================
    // freeFunds Tests
    // =========================================================================

    function test_freeFunds_withdrawsFromAave() public {
        // First deploy funds
        strategy.deployFunds(100 ether);

        address receiver = address(0xCAFE);
        uint256 withdrawn = strategy.freeFunds(50 ether, receiver);

        assertEq(withdrawn, 50 ether, "Should withdraw requested amount");
        assertEq(asset.balanceOf(receiver), 50 ether, "Receiver should have tokens");
        assertEq(aToken.balanceOf(address(strategy)), 50 ether, "aToken balance should decrease");
    }

    function test_freeFunds_revertsForNonOwner() public {
        strategy.deployFunds(100 ether);

        vm.prank(unauthorized);
        vm.expectRevert("Ownable: caller is not the owner");
        strategy.freeFunds(50 ether, unauthorized);
    }

    function test_freeFunds_emitsEvent() public {
        strategy.deployFunds(100 ether);
        address receiver = address(0xCAFE);

        vm.expectEmit(false, true, false, true);
        emit AaveV3YDSStrategy.FundsFreed(50 ether, receiver);
        strategy.freeFunds(50 ether, receiver);
    }

    // =========================================================================
    // report Tests
    // =========================================================================

    function test_report_returnsIdleBalance() public {
        // Strategy has 1000 ether idle, 0 in aave
        uint256 total = strategy.report();
        assertEq(total, 1000 ether, "Should report idle balance");
    }

    function test_report_returnsIdlePlusAaveBalance() public {
        strategy.deployFunds(400 ether);

        // Simulate yield by minting extra aTokens
        aToken.mint(address(strategy), 50 ether);

        uint256 total = strategy.report();
        // 600 idle + 450 aToken (400 deposited + 50 yield)
        assertEq(total, 1050 ether, "Should sum idle + aToken balances");
    }

    function test_report_returnsZeroWithNoFunds() public {
        // Drain the strategy
        AaveV3YDSStrategy emptyStrategy = new AaveV3YDSStrategy(address(asset), address(pool), address(aToken), owner);
        uint256 total = emptyStrategy.report();
        assertEq(total, 0, "Empty strategy should report 0");
    }

    function test_report_emitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit AaveV3YDSStrategy.StrategyReported(1000 ether);
        strategy.report();
    }

    // =========================================================================
    // shutdown Tests
    // =========================================================================

    function test_shutdown_pausesDeposits() public {
        assertFalse(strategy.depositsPaused());

        strategy.shutdown();

        assertTrue(strategy.depositsPaused(), "Deposits should be paused after shutdown");
    }

    function test_shutdown_revertsForNonOwner() public {
        vm.prank(unauthorized);
        vm.expectRevert("Ownable: caller is not the owner");
        strategy.shutdown();
    }

    function test_shutdown_idempotentWhenAlreadyPaused() public {
        strategy.shutdown();
        assertTrue(strategy.depositsPaused());

        // Calling again should not revert
        strategy.shutdown();
        assertTrue(strategy.depositsPaused());
    }

    // =========================================================================
    // setDepositsPaused Tests
    // =========================================================================

    function test_setDepositsPaused_togglesBothWays() public {
        strategy.setDepositsPaused(true);
        assertTrue(strategy.depositsPaused());

        strategy.setDepositsPaused(false);
        assertFalse(strategy.depositsPaused());
    }

    function test_setDepositsPaused_revertsForNonOwner() public {
        vm.prank(unauthorized);
        vm.expectRevert("Ownable: caller is not the owner");
        strategy.setDepositsPaused(true);
    }
}
