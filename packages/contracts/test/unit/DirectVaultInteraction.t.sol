// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";

import { MockOctantVault } from "../../src/mocks/Octant.sol";

contract DirectVaultInteractionTest is Test {
    MockOctantVault internal vault;

    address internal constant ASSET = address(0xC1);
    address internal constant ROLE_MANAGER = address(0xC2);
    address internal constant USER_A = address(0xC3);
    address internal constant USER_B = address(0xC4);

    function setUp() public {
        vault = new MockOctantVault(ASSET, "Green Goods Vault", "ggVAULT", ROLE_MANAGER, 7 days);
    }

    // =========================================================================
    // Happy Path: Deposit
    // =========================================================================

    function test_directDeposit_mintsSharesToReceiver() public {
        vm.prank(USER_A);
        uint256 shares = vault.deposit(100 ether, USER_A);

        assertEq(shares, 100 ether, "expected 1:1 share minting");
        assertEq(vault.balanceOf(USER_A), 100 ether, "user share balance should update");
        assertEq(vault.totalAssets(), 100 ether, "vault assets should increase");
        assertEq(vault.totalSupply(), 100 ether, "total supply should increase");
    }

    // =========================================================================
    // Happy Path: Redeem
    // =========================================================================

    function test_directRedeem_returnsAssets() public {
        vm.prank(USER_A);
        vault.deposit(150 ether, USER_A);

        vm.prank(USER_A);
        uint256 assets = vault.redeem(40 ether, USER_A, USER_A, 0, new address[](0));

        assertEq(assets, 40 ether, "redeem should return 1:1 assets");
        assertEq(vault.balanceOf(USER_A), 110 ether, "shares should decrease after redeem");
        assertEq(vault.totalAssets(), 110 ether, "assets should decrease after redeem");
    }

    // =========================================================================
    // Happy Path: Withdraw
    // =========================================================================

    function test_directWithdraw_returnsShares() public {
        vm.prank(USER_A);
        vault.deposit(100 ether, USER_A);

        vm.prank(USER_A);
        uint256 shares = vault.withdraw(30 ether, USER_A, USER_A, 0, new address[](0));

        assertEq(shares, 30 ether, "withdraw should burn 1:1 shares");
        assertEq(vault.balanceOf(USER_A), 70 ether, "shares should decrease after withdraw");
        assertEq(vault.totalAssets(), 70 ether, "assets should decrease after withdraw");
    }

    // =========================================================================
    // Happy Path: Multi-depositor
    // =========================================================================

    function test_multiDepositor_shareAccounting_isIndependent() public {
        vm.prank(USER_A);
        vault.deposit(70 ether, USER_A);

        vm.prank(USER_B);
        vault.deposit(30 ether, USER_B);

        assertEq(vault.balanceOf(USER_A), 70 ether, "user A shares should be isolated");
        assertEq(vault.balanceOf(USER_B), 30 ether, "user B shares should be isolated");
        assertEq(vault.totalSupply(), 100 ether, "total supply should aggregate deposits");
        assertEq(vault.totalAssets(), 100 ether, "assets should aggregate deposits");
    }

    // =========================================================================
    // Happy Path: Conversions
    // =========================================================================

    function test_convertToAssets_andConvertToShares_areConsistent() public {
        vm.prank(USER_A);
        vault.deposit(25 ether, USER_A);

        assertEq(vault.convertToAssets(10 ether), 10 ether, "shares -> assets conversion");
        assertEq(vault.convertToShares(10 ether), 10 ether, "assets -> shares conversion");
        assertEq(vault.previewDeposit(5 ether), 5 ether, "preview deposit should match");
        assertEq(vault.previewWithdraw(5 ether), 5 ether, "preview withdraw should match");
    }

    // =========================================================================
    // Happy Path: View Functions
    // =========================================================================

    function test_maxDeposit_returnsMaxUint() public {
        assertEq(vault.maxDeposit(USER_A), type(uint256).max, "max deposit should be unlimited");
    }

    function test_maxWithdraw_returnsUserBalance() public {
        vm.prank(USER_A);
        vault.deposit(50 ether, USER_A);

        assertEq(vault.maxWithdraw(USER_A, 0, new address[](0)), 50 ether, "max withdraw should equal deposited balance");
        assertEq(vault.maxWithdraw(USER_B, 0, new address[](0)), 0, "max withdraw for non-depositor should be 0");
    }

    // =========================================================================
    // Revert: Redeem more than balance
    // =========================================================================

    function test_redeem_revertsWhenExceedingBalance() public {
        vm.prank(USER_A);
        vault.deposit(50 ether, USER_A);

        vm.prank(USER_A);
        vm.expectRevert(MockOctantVault.InsufficientShares.selector);
        vault.redeem(51 ether, USER_A, USER_A, 0, new address[](0));
    }

    function test_redeem_revertsWithZeroDeposit() public {
        vm.prank(USER_A);
        vm.expectRevert(MockOctantVault.InsufficientShares.selector);
        vault.redeem(1 ether, USER_A, USER_A, 0, new address[](0));
    }

    // =========================================================================
    // Revert: Withdraw more than balance
    // =========================================================================

    function test_withdraw_revertsWhenExceedingBalance() public {
        vm.prank(USER_A);
        vault.deposit(50 ether, USER_A);

        vm.prank(USER_A);
        vm.expectRevert(MockOctantVault.InsufficientShares.selector);
        vault.withdraw(51 ether, USER_A, USER_A, 0, new address[](0));
    }

    // =========================================================================
    // Revert: add_strategy access control
    // =========================================================================

    function test_add_strategy_revertsForNonRoleManager() public {
        vm.prank(USER_A);
        vm.expectRevert(MockOctantVault.UnauthorizedRoleManager.selector);
        vault.add_strategy(address(0xDEAD), true);
    }

    function test_add_strategy_succeedsForRoleManager() public {
        address strategy = address(0xDEAD);
        // MockOctantVault.add_strategy now validates ERC4626 asset() — mock the call
        vm.mockCall(strategy, abi.encodeWithSignature("asset()"), abi.encode(ASSET));

        vm.prank(ROLE_MANAGER);
        vault.add_strategy(strategy, true);

        (uint256 activation,,,) = vault.strategies(strategy);
        assertTrue(activation > 0, "strategy should be active after add_strategy");
    }

    // =========================================================================
    // Edge: Full redeem (drain all shares)
    // =========================================================================

    function test_redeem_fullBalance_leavesZero() public {
        vm.prank(USER_A);
        vault.deposit(100 ether, USER_A);

        vm.prank(USER_A);
        vault.redeem(100 ether, USER_A, USER_A, 0, new address[](0));

        assertEq(vault.balanceOf(USER_A), 0, "should have zero shares after full redeem");
        assertEq(vault.totalAssets(), 0, "vault should be empty after full redeem");
        assertEq(vault.totalSupply(), 0, "total supply should be zero after full redeem");
    }
}
