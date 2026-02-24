// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase } from "./helpers/ForkTestBase.sol";
import { Deployment } from "../../src/registries/Deployment.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title DeploymentRegistryForkTest
/// @notice Fork tests for the Deployment (governance registry) contract.
/// @dev Validates initialization, network config persistence, allowlist management,
/// governance transfer, emergency pause, and UUPS upgrade against forked chains.
/// Uses ForkTestBase for full-stack deployment, which deploys the registry via
/// deployDeploymentWithGovernance() in _deployL2Protocol().
contract DeploymentRegistryForkTest is ForkTestBase {
    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Registry Initialized With Correct Owner (Sepolia)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice After full-stack deployment, the registry should be owned by the test contract.
    function test_fork_sepolia_registry_initializedWithCorrectOwner() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        assertEq(deploymentRegistry.owner(), address(this), "registry owner should be test contract");
        assertFalse(deploymentRegistry.emergencyPaused(), "should not be paused after deploy");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Registry Initialized With Correct Owner (Arbitrum)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Same initialization check on Arbitrum fork.
    function test_fork_arbitrum_registry_initializedWithCorrectOwner() public {
        if (!_tryChainFork("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        assertEq(deploymentRegistry.owner(), address(this), "registry owner should be test contract");
        assertFalse(deploymentRegistry.emergencyPaused(), "should not be paused after deploy");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Network Config Persisted After Deploy (Sepolia)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice _configureRegistry() saves the full network config. Verify all core addresses are non-zero.
    function test_fork_sepolia_registry_networkConfigPersisted() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        Deployment.NetworkConfig memory config = deploymentRegistry.getNetworkConfig();

        // Core addresses must be non-zero
        assertTrue(config.eas != address(0), "EAS should be set");
        assertTrue(config.easSchemaRegistry != address(0), "EAS schema registry should be set");
        assertTrue(config.communityToken != address(0), "community token should be set");
        assertTrue(config.actionRegistry != address(0), "action registry should be set");
        assertTrue(config.gardenToken != address(0), "garden token should be set");
        assertTrue(config.workResolver != address(0), "work resolver should be set");
        assertTrue(config.workApprovalResolver != address(0), "work approval resolver should be set");
        assertTrue(config.assessmentResolver != address(0), "assessment resolver should be set");
        assertTrue(config.hatsAccessControl != address(0), "hats access control should be set");

        // Verify addresses match deployed contracts
        assertEq(config.actionRegistry, address(actionRegistry), "action registry address mismatch");
        assertEq(config.gardenToken, address(gardenToken), "garden token address mismatch");
        assertEq(config.workResolver, address(workResolver), "work resolver address mismatch");
        assertEq(config.hatsAccessControl, address(hatsModule), "hats module address mismatch");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Network Config Persisted After Deploy (Arbitrum)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Same config verification on Arbitrum fork.
    function test_fork_arbitrum_registry_networkConfigPersisted() public {
        if (!_tryChainFork("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        Deployment.NetworkConfig memory config = deploymentRegistry.getNetworkConfig();

        assertTrue(config.eas != address(0), "EAS should be set");
        assertTrue(config.actionRegistry != address(0), "action registry should be set");
        assertTrue(config.gardenToken != address(0), "garden token should be set");

        assertEq(config.actionRegistry, address(actionRegistry), "action registry address mismatch");
        assertEq(config.gardenToken, address(gardenToken), "garden token address mismatch");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 5: Unconfigured Network Reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Querying an unconfigured chain ID reverts with NetworkNotConfigured.
    function test_fork_sepolia_registry_unconfiguredNetworkReverts() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        uint256 fakeChainId = 999_999;
        vm.expectRevert(abi.encodeWithSelector(Deployment.NetworkNotConfigured.selector, fakeChainId));
        deploymentRegistry.getNetworkConfigForChain(fakeChainId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 6: Allowlist Management
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Owner can add/remove addresses from allowlist. Allowlisted addresses can set config.
    function test_fork_sepolia_registry_allowlistManagement() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Initially, allowlist may have the deployer
        uint256 initialLength = deploymentRegistry.allowlistLength();

        // Add forkOperator to allowlist
        deploymentRegistry.addToAllowlist(forkOperator);
        assertTrue(deploymentRegistry.isInAllowlist(forkOperator), "operator should be in allowlist");
        assertEq(deploymentRegistry.allowlistLength(), initialLength + 1, "allowlist length should increase");

        // Allowlisted address can set network config
        Deployment.NetworkConfig memory config = Deployment.NetworkConfig({
            eas: address(0x1),
            easSchemaRegistry: address(0x2),
            communityToken: address(0x3),
            actionRegistry: address(0x4),
            gardenToken: address(0x5),
            workResolver: address(0x6),
            workApprovalResolver: address(0x7),
            assessmentResolver: address(0x8),
            integrationRouter: address(0),
            hatsAccessControl: address(0x9),
            octantFactory: address(0),
            unlockFactory: address(0),
            hypercerts: address(0),
            greenWillRegistry: address(0)
        });

        vm.prank(forkOperator);
        deploymentRegistry.setNetworkConfig(12_345, config);

        Deployment.NetworkConfig memory stored = deploymentRegistry.getNetworkConfigForChain(12_345);
        assertEq(stored.eas, address(0x1), "allowlisted user should set config");

        // Remove from allowlist
        deploymentRegistry.removeFromAllowlist(forkOperator);
        assertFalse(deploymentRegistry.isInAllowlist(forkOperator), "operator should be removed");

        // Now unauthorized
        vm.prank(forkOperator);
        vm.expectRevert(abi.encodeWithSelector(Deployment.UnauthorizedCaller.selector, forkOperator));
        deploymentRegistry.setNetworkConfig(12_345, config);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 7: Batch Allowlist
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Owner can batch-add multiple addresses. Zero address in batch reverts.
    function test_fork_sepolia_registry_batchAllowlist() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        address[] memory accounts = new address[](3);
        accounts[0] = forkOperator;
        accounts[1] = forkGardener;
        accounts[2] = forkEvaluator;

        deploymentRegistry.batchAddToAllowlist(accounts);

        assertTrue(deploymentRegistry.isInAllowlist(forkOperator), "operator in allowlist");
        assertTrue(deploymentRegistry.isInAllowlist(forkGardener), "gardener in allowlist");
        assertTrue(deploymentRegistry.isInAllowlist(forkEvaluator), "evaluator in allowlist");

        // Batch with zero address reverts
        address[] memory badBatch = new address[](2);
        badBatch[0] = makeAddr("validAddr");
        badBatch[1] = address(0);
        vm.expectRevert(Deployment.CannotAddZeroAddress.selector);
        deploymentRegistry.batchAddToAllowlist(badBatch);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 8: Governance Transfer (Two-Step)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Two-step governance transfer: initiate → accept. Cancel also tested.
    function test_fork_sepolia_registry_governanceTransfer() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        address newOwner = forkOperator;

        // Initiate transfer
        deploymentRegistry.initiateGovernanceTransfer(newOwner);
        assertEq(deploymentRegistry.pendingOwner(), newOwner, "pending owner should be set");

        // Non-pending-owner cannot accept
        vm.prank(forkGardener);
        vm.expectRevert(Deployment.NotPendingOwner.selector);
        deploymentRegistry.acceptGovernanceTransfer();

        // Pending owner accepts
        vm.prank(newOwner);
        deploymentRegistry.acceptGovernanceTransfer();

        assertEq(deploymentRegistry.owner(), newOwner, "owner should be new owner");
        assertEq(deploymentRegistry.pendingOwner(), address(0), "pending should be cleared");

        // Old owner can no longer initiate
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", address(this)));
        deploymentRegistry.initiateGovernanceTransfer(address(this));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 9: Governance Transfer Cancel
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Owner can cancel a pending governance transfer.
    function test_fork_sepolia_registry_governanceTransferCancel() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        deploymentRegistry.initiateGovernanceTransfer(forkOperator);
        assertEq(deploymentRegistry.pendingOwner(), forkOperator, "pending should be set");

        deploymentRegistry.cancelGovernanceTransfer();
        assertEq(deploymentRegistry.pendingOwner(), address(0), "pending should be cleared");

        // Cancel when no pending reverts
        vm.expectRevert(Deployment.NoPendingTransfer.selector);
        deploymentRegistry.cancelGovernanceTransfer();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 10: Emergency Pause Blocks Config Updates
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Emergency pause blocks setNetworkConfig and individual update functions.
    function test_fork_sepolia_registry_emergencyPause() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Pause
        deploymentRegistry.emergencyPause();
        assertTrue(deploymentRegistry.emergencyPaused(), "should be paused");

        // setNetworkConfig should revert
        Deployment.NetworkConfig memory config = deploymentRegistry.getNetworkConfig();
        vm.expectRevert(Deployment.EmergencyPaused.selector);
        deploymentRegistry.setNetworkConfig(block.chainid, config);

        // Individual updaters should also revert
        vm.expectRevert(Deployment.EmergencyPaused.selector);
        deploymentRegistry.updateActionRegistry(address(0x123));

        vm.expectRevert(Deployment.EmergencyPaused.selector);
        deploymentRegistry.updateGardenToken(address(0x123));

        // Reads still work while paused
        Deployment.NetworkConfig memory readConfig = deploymentRegistry.getNetworkConfig();
        assertTrue(readConfig.eas != address(0), "reads should still work while paused");

        // Unpause
        deploymentRegistry.emergencyUnpause();
        assertFalse(deploymentRegistry.emergencyPaused(), "should be unpaused");

        // Updates work again
        deploymentRegistry.updateActionRegistry(address(0x123));
        assertEq(deploymentRegistry.getNetworkConfig().actionRegistry, address(0x123), "update should work after unpause");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 11: Unauthorized Callers Blocked
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Non-owner, non-allowlisted callers cannot modify registry state.
    function test_fork_sepolia_registry_unauthorizedCallersBlocked() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        Deployment.NetworkConfig memory config = deploymentRegistry.getNetworkConfig();

        // forkNonMember is not owner or allowlisted
        vm.startPrank(forkNonMember);

        vm.expectRevert(abi.encodeWithSelector(Deployment.UnauthorizedCaller.selector, forkNonMember));
        deploymentRegistry.setNetworkConfig(block.chainid, config);

        vm.expectRevert(abi.encodeWithSelector(Deployment.UnauthorizedCaller.selector, forkNonMember));
        deploymentRegistry.updateActionRegistry(address(0x123));

        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", forkNonMember));
        deploymentRegistry.addToAllowlist(forkNonMember);

        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", forkNonMember));
        deploymentRegistry.emergencyPause();

        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 12: Individual Updaters Persist Correctly
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Each individual update* function only modifies its target field.
    function test_fork_sepolia_registry_individualUpdaters() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Capture original EAS to verify it doesn't change
        address originalEas = deploymentRegistry.getNetworkConfig().eas;

        // Update individual fields
        address newAddr = makeAddr("newContract");
        deploymentRegistry.updateActionRegistry(newAddr);
        assertEq(deploymentRegistry.getActionRegistry(), newAddr, "action registry should be updated");
        assertEq(deploymentRegistry.getNetworkConfig().eas, originalEas, "EAS should be unchanged");

        deploymentRegistry.updateHatsAccessControl(makeAddr("newHats"));
        assertEq(deploymentRegistry.getHatsAccessControl(), makeAddr("newHats"), "hats should be updated");

        deploymentRegistry.updateAssessmentResolver(makeAddr("newAssessment"));
        assertEq(deploymentRegistry.getAssessmentResolver(), makeAddr("newAssessment"), "assessment should be updated");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 13: UUPS Upgrade Preserves State (Sepolia)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice UUPS upgrade preserves owner, network config, and allowlist state.
    function test_fork_sepolia_registry_uupsUpgradePreservesState() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Add an allowlist entry
        deploymentRegistry.addToAllowlist(forkOperator);

        // Capture pre-upgrade state
        address preOwner = deploymentRegistry.owner();
        Deployment.NetworkConfig memory preConfig = deploymentRegistry.getNetworkConfig();
        bool preAllowlisted = deploymentRegistry.isInAllowlist(forkOperator);

        // Deploy new implementation and upgrade
        Deployment newImpl = new Deployment();
        deploymentRegistry.upgradeToAndCall(address(newImpl), "");

        // Verify state preserved
        assertEq(deploymentRegistry.owner(), preOwner, "owner should be preserved");
        assertTrue(deploymentRegistry.isInAllowlist(forkOperator) == preAllowlisted, "allowlist should be preserved");

        Deployment.NetworkConfig memory postConfig = deploymentRegistry.getNetworkConfig();
        assertEq(postConfig.eas, preConfig.eas, "EAS should be preserved");
        assertEq(postConfig.actionRegistry, preConfig.actionRegistry, "action registry should be preserved");
        assertEq(postConfig.gardenToken, preConfig.gardenToken, "garden token should be preserved");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 14: UUPS Upgrade — Non-Owner Reverts (Arbitrum)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Only the owner can perform UUPS upgrades.
    function test_fork_arbitrum_registry_uupsUpgradeNonOwnerReverts() public {
        if (!_tryChainFork("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        Deployment newImpl = new Deployment();

        vm.prank(forkNonMember);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", forkNonMember));
        deploymentRegistry.upgradeToAndCall(address(newImpl), "");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 15: Convenience Getters Return Correct Addresses (Sepolia)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice All convenience getters (getEAS, getActionRegistry, etc.) return correct values.
    function test_fork_sepolia_registry_convenienceGetters() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        Deployment.NetworkConfig memory config = deploymentRegistry.getNetworkConfig();

        assertEq(deploymentRegistry.getEAS(), config.eas, "getEAS mismatch");
        assertEq(deploymentRegistry.getEASSchemaRegistry(), config.easSchemaRegistry, "getEASSchemaRegistry mismatch");
        assertEq(deploymentRegistry.getCommunityToken(), config.communityToken, "getCommunityToken mismatch");
        assertEq(deploymentRegistry.getActionRegistry(), config.actionRegistry, "getActionRegistry mismatch");
        assertEq(deploymentRegistry.getGardenToken(), config.gardenToken, "getGardenToken mismatch");
        assertEq(deploymentRegistry.getWorkResolver(), config.workResolver, "getWorkResolver mismatch");
        assertEq(
            deploymentRegistry.getWorkApprovalResolver(), config.workApprovalResolver, "getWorkApprovalResolver mismatch"
        );
        assertEq(deploymentRegistry.getAssessmentResolver(), config.assessmentResolver, "getAssessmentResolver mismatch");
        assertEq(deploymentRegistry.getHatsAccessControl(), config.hatsAccessControl, "getHatsAccessControl mismatch");
    }
}
