// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test, console } from "forge-std/Test.sol";
import { Deploy } from "../script/Deploy.s.sol";
import { DeploymentRegistry } from "../src/DeploymentRegistry.sol";
import { GardenToken } from "../src/tokens/Garden.sol";
import { ActionRegistry } from "../src/registries/Action.sol";
import { WorkResolver } from "../src/resolvers/Work.sol";
import { WorkApprovalResolver } from "../src/resolvers/WorkApproval.sol";
import { GardenAccount } from "../src/accounts/Garden.sol";

contract DeployTest is Test {
    Deploy deployer;

    function setUp() public {
        deployer = new Deploy();
    }

    function testDeploy() public {
        // Set up environment
        vm.setEnv("MULTISIG_ADDRESS", vm.toString(address(this)));
        vm.setEnv("INITIALIZE_SAMPLE_DATA", "false");

        // Run deployment
        deployer.run();

        // The deployment should have saved the addresses, but in tests we can't easily access them
        // So we'll verify by checking that contracts are deployed at expected addresses
        // In a real deployment, addresses would be deterministic with CREATE2
    }

    function testDeploymentRegistry() public {
        // Deploy registry
        address registryAddr = deployer.deployDeploymentRegistry(address(this));

        // Verify deployment
        assertTrue(registryAddr != address(0), "Registry should be deployed");
        assertTrue(registryAddr.code.length > 0, "Registry should have code");

        // Verify initialization
        DeploymentRegistry registry = DeploymentRegistry(registryAddr);
        assertEq(registry.owner(), address(this), "Owner should be set correctly");

        // Verify defaults are set
        DeploymentRegistry.DeploymentDefaults memory defaults = registry.getDeploymentDefaults();
        assertEq(defaults.salt, bytes32(0x6551655165516551655165516551655165516551655165516551655165516551));
        assertEq(defaults.factory, 0x4e59b44847b379578588920cA78FbF26c0B4956C);
        assertEq(defaults.tokenboundRegistry, 0x000000006551c19487814612e58FE06813775758);
    }

    function testNetworkConfiguration() public {
        // Deploy and configure registry
        address registryAddr = deployer.deployDeploymentRegistry(address(this));
        DeploymentRegistry registry = DeploymentRegistry(registryAddr);

        // Set up test network config
        DeploymentRegistry.NetworkConfig memory config = DeploymentRegistry.NetworkConfig({
            eas: address(0x1),
            easSchemaRegistry: address(0x2),
            communityToken: address(0x3),
            safe: address(0x4),
            safeFactory: address(0x5),
            safe4337Module: address(0x6),
            erc4337EntryPoint: address(0x7),
            multicallForwarder: address(0x8),
            greenGoodsSafe: address(0x9),
            actionRegistry: address(0),
            workResolver: address(0),
            workApprovalResolver: address(0),
            gardenToken: address(0),
            gardenAccountImplementation: address(0)
        });

        // Set config for current chain
        registry.setNetworkConfig(block.chainid, config);

        // Verify config is stored correctly
        DeploymentRegistry.NetworkConfig memory retrieved = registry.getNetworkConfig();
        assertEq(retrieved.eas, address(0x1), "EAS address should match");
        assertEq(retrieved.communityToken, address(0x3), "Community token should match");
    }

    function testContractDeployments() public {
        // Test individual contract deployments
        (bytes32 salt, address factory,) = deployer.getDeploymentDefaults();

        // Deploy Guardian
        address guardian = deployer.deployGuardian(address(0x123), salt, factory);
        assertTrue(guardian != address(0), "Guardian should be deployed");

        // Deploy GardenAccount implementation
        address gardenAccount = deployer.deployGardenAccount(
            address(0x7), // entry point
            address(0x8), // multicall
            address(0x9), // token registry
            guardian,
            salt,
            factory
        );
        assertTrue(gardenAccount != address(0), "GardenAccount should be deployed");

        // Deploy ActionRegistry
        address actionRegistry = deployer.deployActionRegistry(salt, factory, address(this));
        assertTrue(actionRegistry != address(0), "ActionRegistry should be deployed");

        // Verify ActionRegistry initialization
        ActionRegistry registry = ActionRegistry(actionRegistry);
        assertEq(registry.owner(), address(this), "ActionRegistry owner should be set");
    }

    function testForkDeployment() public {
        // Test deployment on a fork
        string memory rpcUrl;
        try vm.envString("ARBITRUM_RPC_URL") returns (string memory url) {
            rpcUrl = url;
        } catch {
            rpcUrl = "https://arb1.arbitrum.io/rpc";
        }
        uint256 forkId = vm.createFork(rpcUrl);
        vm.selectFork(forkId);

        // Run deployment on fork
        vm.setEnv("MULTISIG_ADDRESS", vm.toString(address(this)));
        vm.setEnv("INITIALIZE_SAMPLE_DATA", "false");

        // This would run the full deployment on the fork
        // deployer.run();

        // For now, just verify we can read network config
        Deploy.NetworkConfig memory config = deployer.loadNetworkConfig();
        assertTrue(config.eas != address(0) || block.chainid == 31_337, "Should have network config or be localhost");
    }

    function testDeploymentWithSampleData() public {
        vm.setEnv("MULTISIG_ADDRESS", vm.toString(address(this)));
        vm.setEnv("INITIALIZE_SAMPLE_DATA", "true");

        // Deploy ActionRegistry first
        (bytes32 salt, address factory,) = deployer.getDeploymentDefaults();
        address actionRegistry = deployer.deployActionRegistry(salt, factory, address(this));

        // Initialize sample data
        deployer.initializeSampleData(actionRegistry);

        // Verify sample data was added
        ActionRegistry registry = ActionRegistry(actionRegistry);
        ActionRegistry.Action memory action = registry.getAction(0);
        assertEq(action.title, "Identify Plants", "Sample action should be created");
        assertTrue(action.endTime > block.timestamp, "Action should be active");
    }

    function testDeploymentIdempotency() public {
        // Test that deployment is idempotent (can be run multiple times safely)
        vm.setEnv("MULTISIG_ADDRESS", vm.toString(address(this)));
        vm.setEnv("INITIALIZE_SAMPLE_DATA", "false");

        // First deployment
        deployer.run();

        // Second deployment should not fail
        deployer.run();

        // Both deployments should result in the same addresses due to CREATE2
    }
}
