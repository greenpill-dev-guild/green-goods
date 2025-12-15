// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {DeploymentRegistry} from "../../src/DeploymentRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeploymentRegistryTest is Test {
    DeploymentRegistry public registry;
    address public owner;
    address public allowedUser;
    address public unauthorizedUser;

    event NetworkConfigUpdated(uint256 indexed chainId, DeploymentRegistry.NetworkConfig config);
    event AllowlistAdded(address indexed account);
    event AllowlistRemoved(address indexed account);

    function setUp() public {
        owner = address(this);
        allowedUser = address(0x1);
        unauthorizedUser = address(0x2);

        // Deploy implementation
        DeploymentRegistry impl = new DeploymentRegistry();

        // Deploy with proxy pattern
        bytes memory initData = abi.encodeWithSelector(DeploymentRegistry.initialize.selector, owner);
        address proxyAddr = address(new ERC1967Proxy(address(impl), initData));
        registry = DeploymentRegistry(proxyAddr);
    }

    function testInitialization() public {
        assertEq(registry.owner(), owner, "Owner should be set correctly");
    }

    function testSetNetworkConfig() public {
        uint256 chainId = 1;
        DeploymentRegistry.NetworkConfig memory config = _createTestConfig(0x10);

        vm.expectEmit(true, true, true, true);
        emit NetworkConfigUpdated(chainId, config);

        registry.setNetworkConfig(chainId, config);

        DeploymentRegistry.NetworkConfig memory retrieved = registry.getNetworkConfigForChain(chainId);
        assertEq(retrieved.eas, config.eas, "EAS address should match");
        assertEq(retrieved.actionRegistry, config.actionRegistry, "ActionRegistry should match");
    }

    /// @notice Helper to create test config with all fields
    function _createTestConfig(uint160 baseAddr) internal pure returns (DeploymentRegistry.NetworkConfig memory) {
        return DeploymentRegistry.NetworkConfig({
            eas: address(baseAddr),
            easSchemaRegistry: address(baseAddr + 1),
            communityToken: address(baseAddr + 2),
            actionRegistry: address(baseAddr + 3),
            gardenToken: address(baseAddr + 4),
            workResolver: address(baseAddr + 5),
            workApprovalResolver: address(baseAddr + 6),
            assessmentResolver: address(baseAddr + 7),
            integrationRouter: address(baseAddr + 8),
            hatsAccessControl: address(0), // Optional
            octantFactory: address(0), // Optional
            unlockFactory: address(0), // Optional
            hypercerts: address(0), // Optional
            greenWillRegistry: address(0) // Optional
        });
    }

    function testAddToAllowlist() public {
        assertFalse(registry.isInAllowlist(allowedUser), "User should not be in allowlist initially");

        vm.expectEmit(true, false, false, false);
        emit AllowlistAdded(allowedUser);

        registry.addToAllowlist(allowedUser);

        assertTrue(registry.isInAllowlist(allowedUser), "User should be in allowlist after adding");
    }

    function testRemoveFromAllowlist() public {
        registry.addToAllowlist(allowedUser);
        assertTrue(registry.isInAllowlist(allowedUser), "User should be in allowlist");

        vm.expectEmit(true, false, false, false);
        emit AllowlistRemoved(allowedUser);

        registry.removeFromAllowlist(allowedUser);

        assertFalse(registry.isInAllowlist(allowedUser), "User should not be in allowlist after removal");
    }

    function test_RevertWhen_UnauthorizedSetNetworkConfig() public {
        uint256 chainId = 1;
        DeploymentRegistry.NetworkConfig memory config = _createTestConfig(0x10);

        vm.prank(unauthorizedUser);
        vm.expectRevert();
        registry.setNetworkConfig(chainId, config);
    }

    function test_RevertWhen_UnauthorizedAddToAllowlist() public {
        vm.prank(unauthorizedUser);
        vm.expectRevert();
        registry.addToAllowlist(allowedUser);
    }

    function testGetNetworkConfigForCurrentChain() public {
        uint256 currentChain = block.chainid;
        DeploymentRegistry.NetworkConfig memory config = _createTestConfig(0x20);

        registry.setNetworkConfig(currentChain, config);

        DeploymentRegistry.NetworkConfig memory retrieved = registry.getNetworkConfig();
        assertEq(retrieved.eas, config.eas, "Should get config for current chain");
    }

    function testMultipleChainConfigurations() public {
        DeploymentRegistry.NetworkConfig memory config1 = _createTestConfig(0x30);
        DeploymentRegistry.NetworkConfig memory config2 = _createTestConfig(0x40);

        registry.setNetworkConfig(1, config1);
        registry.setNetworkConfig(137, config2);

        DeploymentRegistry.NetworkConfig memory retrieved1 = registry.getNetworkConfigForChain(1);
        DeploymentRegistry.NetworkConfig memory retrieved2 = registry.getNetworkConfigForChain(137);

        assertEq(retrieved1.eas, config1.eas, "Chain 1 config should match");
        assertEq(retrieved2.eas, config2.eas, "Chain 137 config should match");
    }

    function testAllowlistCanSetConfig() public {
        registry.addToAllowlist(allowedUser);

        uint256 chainId = 1;
        DeploymentRegistry.NetworkConfig memory config = _createTestConfig(0x50);

        vm.prank(allowedUser);
        registry.setNetworkConfig(chainId, config);

        DeploymentRegistry.NetworkConfig memory retrieved = registry.getNetworkConfigForChain(chainId);
        assertEq(retrieved.eas, config.eas, "Allowlisted user should be able to set config");
    }

    function testGovernanceTransfer() public {
        address newOwner = address(0x99);

        registry.initiateGovernanceTransfer(newOwner);
        assertEq(registry.pendingOwner(), newOwner, "Pending owner should be set");

        vm.prank(newOwner);
        registry.acceptGovernanceTransfer();

        assertEq(registry.owner(), newOwner, "Ownership should be transferred");
    }

    function testBatchAddToAllowlist() public {
        address[] memory accounts = new address[](3);
        accounts[0] = address(0x10);
        accounts[1] = address(0x20);
        accounts[2] = address(0x30);

        registry.batchAddToAllowlist(accounts);

        assertTrue(registry.isInAllowlist(accounts[0]), "First account should be in allowlist");
        assertTrue(registry.isInAllowlist(accounts[1]), "Second account should be in allowlist");
        assertTrue(registry.isInAllowlist(accounts[2]), "Third account should be in allowlist");
    }

    function testAllowlistLength() public {
        assertEq(registry.allowlistLength(), 0, "Allowlist should be empty initially");

        registry.addToAllowlist(address(0x10));
        assertEq(registry.allowlistLength(), 1, "Allowlist should have 1 address");

        registry.addToAllowlist(address(0x20));
        assertEq(registry.allowlistLength(), 2, "Allowlist should have 2 addresses");
    }

    function testGetAllowlist() public {
        address[] memory expected = new address[](2);
        expected[0] = address(0x10);
        expected[1] = address(0x20);

        registry.addToAllowlist(expected[0]);
        registry.addToAllowlist(expected[1]);

        address[] memory actual = registry.getAllowlist();
        assertEq(actual.length, 2, "Should return 2 addresses");
        assertEq(actual[0], expected[0], "First address should match");
        assertEq(actual[1], expected[1], "Second address should match");
    }

    function testEmergencyPause() public {
        // Setup a network config first
        uint256 chainId = 1;
        DeploymentRegistry.NetworkConfig memory config = _createTestConfig(0x10);
        registry.setNetworkConfig(chainId, config);

        // Activate emergency pause
        registry.emergencyPause();
        assertTrue(registry.emergencyPaused(), "Should be paused");

        // Should not be able to set config when paused
        vm.expectRevert();
        registry.setNetworkConfig(chainId, config);

        // Unpause
        registry.emergencyUnpause();
        assertFalse(registry.emergencyPaused(), "Should not be paused");

        // Should be able to set config after unpause
        registry.setNetworkConfig(chainId, config);
    }

    function testGetIndividualAddresses() public {
        uint256 chainId = block.chainid;
        DeploymentRegistry.NetworkConfig memory config = _createTestConfig(0x10);
        registry.setNetworkConfig(chainId, config);

        assertEq(registry.getEAS(), address(0x10), "EAS address should match");
        assertEq(registry.getEASSchemaRegistry(), address(0x11), "Schema registry should match");
        assertEq(registry.getCommunityToken(), address(0x12), "Community token should match");
        assertEq(registry.getActionRegistry(), address(0x13), "Action registry should match");
        assertEq(registry.getGardenToken(), address(0x14), "Garden token should match");
        assertEq(registry.getWorkResolver(), address(0x15), "Work resolver should match");
        assertEq(registry.getWorkApprovalResolver(), address(0x16), "Work approval resolver should match");
        assertEq(registry.getAssessmentResolver(), address(0x17), "Assessment resolver should match");
        assertEq(registry.getIntegrationRouter(), address(0x18), "Integration router should match");
    }

    function testUpdateIndividualAddresses() public {
        uint256 chainId = block.chainid;
        DeploymentRegistry.NetworkConfig memory config = _createTestConfig(0x10);
        registry.setNetworkConfig(chainId, config);

        // Update action registry
        registry.updateActionRegistry(address(0x99));
        assertEq(registry.getActionRegistry(), address(0x99), "Action registry should be updated");

        // Update garden token
        registry.updateGardenToken(address(0x98));
        assertEq(registry.getGardenToken(), address(0x98), "Garden token should be updated");

        // Update integration router
        registry.updateIntegrationRouter(address(0x97));
        assertEq(registry.getIntegrationRouter(), address(0x97), "Integration router should be updated");

        // Update assessment resolver
        registry.updateAssessmentResolver(address(0x96));
        assertEq(registry.getAssessmentResolver(), address(0x96), "Assessment resolver should be updated");
    }

    function testUpdateIntegrationAddresses() public {
        uint256 chainId = block.chainid;
        DeploymentRegistry.NetworkConfig memory config = _createTestConfig(0x10);
        registry.setNetworkConfig(chainId, config);

        // Update hats access control
        registry.updateHatsAccessControl(address(0xA1));
        assertEq(registry.getHatsAccessControl(), address(0xA1), "Hats access control should be updated");

        // Update octant factory
        registry.updateOctantFactory(address(0xA2));
        assertEq(registry.getOctantFactory(), address(0xA2), "Octant factory should be updated");

        // Update unlock factory
        registry.updateUnlockFactory(address(0xA3));
        assertEq(registry.getUnlockFactory(), address(0xA3), "Unlock factory should be updated");

        // Update hypercerts
        registry.updateHypercerts(address(0xA4));
        assertEq(registry.getHypercerts(), address(0xA4), "Hypercerts should be updated");

        // Update greenwill registry
        registry.updateGreenWillRegistry(address(0xA5));
        assertEq(registry.getGreenWillRegistry(), address(0xA5), "GreenWill registry should be updated");
    }

    function testNetworkNotConfiguredError() public {
        uint256 nonExistentChain = 999_999;

        vm.expectRevert();
        registry.getNetworkConfigForChain(nonExistentChain);
    }

    function testCancelGovernanceTransfer() public {
        address newOwner = address(0x99);

        registry.initiateGovernanceTransfer(newOwner);
        assertEq(registry.pendingOwner(), newOwner, "Pending owner should be set");

        registry.cancelGovernanceTransfer();
        assertEq(registry.pendingOwner(), address(0), "Pending owner should be cleared");
    }
}
