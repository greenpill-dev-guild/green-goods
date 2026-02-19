// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { MultistrategyVault } from "@octant/core/MultistrategyVault.sol";
import { IMultistrategyVault } from "@octant/core/interfaces/IMultistrategyVault.sol";
import { MultistrategyVaultFactory } from "@octant/factories/MultistrategyVaultFactory.sol";
import { MockERC20 } from "../../src/mocks/ERC20.sol";

/// @title VendoredVaultTest
/// @notice Integration tests for the real Octant MultistrategyVault within Green Goods
/// @dev Validates that vendored contracts compile and work correctly with OZ 4.9.3
contract VendoredVaultTest is Test {
    MultistrategyVault internal implementation;
    MultistrategyVaultFactory internal factory;
    MockERC20 internal token;

    address internal constant ROLE_MANAGER = address(0xA1);
    address internal constant GOVERNANCE = address(0xA2);
    address internal constant DEPOSITOR = address(0xA3);

    function setUp() public {
        token = new MockERC20();

        // Deploy implementation (constructor poisons asset to prevent direct init)
        implementation = new MultistrategyVault();

        // Deploy factory with governance
        factory = new MultistrategyVaultFactory("Green Goods Vault Factory", address(implementation), GOVERNANCE);
    }

    // =========================================================================
    // Factory Tests
    // =========================================================================

    function test_factory_hasCorrectImplementation() public {
        assertEq(factory.vaultOriginal(), address(implementation), "factory should reference implementation");
    }

    function test_factory_hasCorrectGovernance() public {
        assertEq(factory.governance(), GOVERNANCE, "factory governance should match");
    }

    function test_factory_hasCorrectName() public {
        assertEq(factory.name(), "Green Goods Vault Factory", "factory name should match");
    }

    // =========================================================================
    // Vault Deployment via Factory
    // =========================================================================

    function test_deployNewVault_createsInitializedClone() public {
        address vault = factory.deployNewVault(address(token), "Green Goods MOCK Vault", "ggMOCK", ROLE_MANAGER, 7 days);

        assertTrue(vault != address(0), "vault should be deployed");
        assertEq(IMultistrategyVault(vault).asset(), address(token), "vault asset should match");
        assertEq(IMultistrategyVault(vault).name(), "Green Goods MOCK Vault", "vault name should match");
        assertEq(IMultistrategyVault(vault).symbol(), "ggMOCK", "vault symbol should match");
        assertEq(IMultistrategyVault(vault).roleManager(), ROLE_MANAGER, "vault roleManager should match");
    }

    function test_deployNewVault_implementationCannotBeReinitialized() public {
        // The implementation has asset = address(this), so initialize should revert
        vm.expectRevert();
        implementation.initialize(address(token), "Test", "TST", ROLE_MANAGER, 7 days);
    }

    // =========================================================================
    // Deposit / Withdraw
    // =========================================================================

    function test_deposit_and_withdraw() public {
        address vault = factory.deployNewVault(address(token), "Test Vault", "ggTEST", ROLE_MANAGER, 7 days);

        // roleManager must set deposit limit (defaults to 0 = no deposits allowed)
        // DEPOSIT_LIMIT_MANAGER is Roles enum index 8
        uint256 depositLimitBitmask = 1 << uint256(IMultistrategyVault.Roles.DEPOSIT_LIMIT_MANAGER);
        vm.prank(ROLE_MANAGER);
        IMultistrategyVault(vault).set_role(ROLE_MANAGER, depositLimitBitmask);

        vm.prank(ROLE_MANAGER);
        IMultistrategyVault(vault).set_deposit_limit(type(uint256).max, false);

        uint256 depositAmount = 100 ether;

        // Fund depositor and approve
        token.mint(DEPOSITOR, depositAmount);
        vm.prank(DEPOSITOR);
        token.approve(vault, depositAmount);

        // Deposit
        vm.prank(DEPOSITOR);
        uint256 shares = IMultistrategyVault(vault).deposit(depositAmount, DEPOSITOR);

        assertTrue(shares > 0, "should receive shares");
        assertEq(IMultistrategyVault(vault).balanceOf(DEPOSITOR), shares, "balance should equal shares received");
        assertEq(token.balanceOf(vault), depositAmount, "vault should hold deposited tokens");

        // Withdraw (real vault has maxLoss and strategies params)
        vm.prank(DEPOSITOR);
        IMultistrategyVault(vault).withdraw(depositAmount, DEPOSITOR, DEPOSITOR, 0, new address[](0));

        assertEq(IMultistrategyVault(vault).balanceOf(DEPOSITOR), 0, "shares should be burned after withdraw");
        assertEq(token.balanceOf(DEPOSITOR), depositAmount, "depositor should recover tokens");
    }

    // =========================================================================
    // Role Manager: add_strategy
    // =========================================================================

    function test_add_strategy_requiresRole() public {
        address vault = factory.deployNewVault(address(token), "Test Vault", "ggTEST", ROLE_MANAGER, 7 days);

        address mockStrategy = address(0xBEEF);

        // Non-role-manager should fail
        vm.prank(DEPOSITOR);
        vm.expectRevert();
        IMultistrategyVault(vault).add_strategy(mockStrategy, true);
    }

    function test_roleManager_can_grant_role_and_add_strategy() public {
        address vault = factory.deployNewVault(address(token), "Test Vault", "ggTEST", ROLE_MANAGER, 7 days);

        // roleManager grants itself the ADD_STRATEGY_MANAGER role (Roles enum index 0 = bitmask 1)
        uint256 addStrategyBitmask = 1 << uint256(IMultistrategyVault.Roles.ADD_STRATEGY_MANAGER);

        vm.prank(ROLE_MANAGER);
        IMultistrategyVault(vault).set_role(ROLE_MANAGER, addStrategyBitmask);

        // Now deploy a minimal mock strategy that implements the asset() view
        MockMinimalStrategy strategy = new MockMinimalStrategy(address(token));

        vm.prank(ROLE_MANAGER);
        IMultistrategyVault(vault).add_strategy(address(strategy), true);

        // Verify strategy was added by checking its activation timestamp
        IMultistrategyVault.StrategyParams memory params = IMultistrategyVault(vault).strategies(address(strategy));
        assertTrue(params.activation > 0, "strategy should be active after add_strategy");
    }
}

/// @title MockMinimalStrategy
/// @notice Minimal mock that satisfies the vault's add_strategy requirements
/// @dev Real strategies inherit from BaseStrategy; this just needs asset() to match
contract MockMinimalStrategy {
    address public asset;

    constructor(address _asset) {
        asset = _asset;
    }

    // The vault calls IERC4626Payable(strategy).asset() to validate matching asset
    function totalAssets() external pure returns (uint256) {
        return 0;
    }
}
