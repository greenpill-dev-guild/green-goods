// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

// Import all upgradeable contracts
import { ActionRegistry } from "../src/registries/Action.sol";
import { GardenToken } from "../src/tokens/Garden.sol";
import { GardenAccount } from "../src/accounts/Garden.sol";
import { WorkResolver } from "../src/resolvers/Work.sol";
import { WorkApprovalResolver } from "../src/resolvers/WorkApproval.sol";
import { AssessmentResolver } from "../src/resolvers/Assessment.sol";
import { DeploymentRegistry } from "../src/DeploymentRegistry.sol";

/// @title Upgrade Script for Green Goods Contracts
/// @notice Handles UUPS proxy upgrades for all upgradeable contracts
contract Upgrade is Script {
    /// @notice Load proxy address from deployment file
    function loadProxyAddress(string memory contractName) internal view returns (address) {
        string memory chainIdStr = vm.toString(block.chainid);
        string memory deploymentPath = string.concat(vm.projectRoot(), "/deployments/", chainIdStr, "-latest.json");

        // vm.readFile will revert if file doesn't exist
        string memory json = vm.readFile(deploymentPath);
        string memory path = string.concat(".", contractName);

        return abi.decode(vm.parseJson(json, path), (address));
    }

    /// @notice Load network configuration
    function loadNetworkConfig() internal view returns (address eas, address actionRegistry, address gardenAccountImpl) {
        string memory chainIdStr = vm.toString(block.chainid);
        string memory deploymentPath = string.concat(vm.projectRoot(), "/deployments/", chainIdStr, "-latest.json");
        string memory json = vm.readFile(deploymentPath);

        eas = abi.decode(vm.parseJson(json, ".eas"), (address));
        actionRegistry = abi.decode(vm.parseJson(json, ".actionRegistry"), (address));
        gardenAccountImpl = abi.decode(vm.parseJson(json, ".gardenAccountImpl"), (address));
    }

    /// @notice Upgrade ActionRegistry
    function upgradeActionRegistry() public {
        console.log("\n=== Upgrading ActionRegistry ===");
        address proxy = loadProxyAddress("actionRegistry");
        console.log("Proxy address:", proxy);

        vm.startBroadcast();

        // Deploy new implementation
        ActionRegistry newImpl = new ActionRegistry();
        console.log("New implementation:", address(newImpl));

        // Upgrade proxy
        UUPSUpgradeable(proxy).upgradeTo(address(newImpl));
        console.log("Proxy upgraded successfully");

        vm.stopBroadcast();
    }

    /// @notice Upgrade GardenToken
    function upgradeGardenToken() public {
        console.log("\n=== Upgrading GardenToken ===");
        address proxy = loadProxyAddress("gardenToken");
        console.log("Proxy address:", proxy);

        vm.startBroadcast();

        (,, address gardenAccountImpl) = loadNetworkConfig();

        GardenToken newImpl = new GardenToken(gardenAccountImpl);
        console.log("New implementation:", address(newImpl));

        UUPSUpgradeable(proxy).upgradeTo(address(newImpl));
        console.log("Proxy upgraded successfully");

        vm.stopBroadcast();
    }

    /// @notice Upgrade WorkResolver
    function upgradeWorkResolver() public {
        console.log("\n=== Upgrading WorkResolver ===");
        address proxy = loadProxyAddress("workResolver");
        console.log("Proxy address:", proxy);

        vm.startBroadcast();

        (address eas, address actionRegistry,) = loadNetworkConfig();

        WorkResolver newImpl = new WorkResolver(eas, actionRegistry);
        console.log("New implementation:", address(newImpl));

        UUPSUpgradeable(proxy).upgradeTo(address(newImpl));
        console.log("Proxy upgraded successfully");

        vm.stopBroadcast();
    }

    /// @notice Upgrade WorkApprovalResolver
    function upgradeWorkApprovalResolver() public {
        console.log("\n=== Upgrading WorkApprovalResolver ===");
        address proxy = loadProxyAddress("workApprovalResolver");
        console.log("Proxy address:", proxy);

        vm.startBroadcast();

        (address eas, address actionRegistry,) = loadNetworkConfig();

        WorkApprovalResolver newImpl = new WorkApprovalResolver(eas, actionRegistry);
        console.log("New implementation:", address(newImpl));

        UUPSUpgradeable(proxy).upgradeTo(address(newImpl));
        console.log("Proxy upgraded successfully");

        vm.stopBroadcast();
    }

    /// @notice Upgrade AssessmentResolver
    function upgradeAssessmentResolver() public {
        console.log("\n=== Upgrading AssessmentResolver ===");
        address proxy = loadProxyAddress("assessmentResolver");
        console.log("Proxy address:", proxy);

        vm.startBroadcast();

        (address eas,,) = loadNetworkConfig();

        AssessmentResolver newImpl = new AssessmentResolver(eas);
        console.log("New implementation:", address(newImpl));

        UUPSUpgradeable(proxy).upgradeTo(address(newImpl));
        console.log("Proxy upgraded successfully");

        vm.stopBroadcast();
    }

    /// @notice Upgrade DeploymentRegistry
    function upgradeDeploymentRegistry() public {
        console.log("\n=== Upgrading DeploymentRegistry ===");
        address proxy = loadProxyAddress("deploymentRegistry");
        console.log("Proxy address:", proxy);

        vm.startBroadcast();

        DeploymentRegistry newImpl = new DeploymentRegistry();
        console.log("New implementation:", address(newImpl));

        UUPSUpgradeable(proxy).upgradeTo(address(newImpl));
        console.log("Proxy upgraded successfully");

        vm.stopBroadcast();
    }

    /// @notice Upgrade all contracts
    function upgradeAll() public {
        upgradeActionRegistry();
        upgradeGardenToken();
        upgradeWorkResolver();
        upgradeWorkApprovalResolver();
        upgradeAssessmentResolver();
        upgradeDeploymentRegistry();
    }

    /// @notice Deploy new GardenAccount implementation with updated resolver addresses
    /// @dev Use this when resolvers have been upgraded and gardens need new implementation
    /// @param workApprovalResolver New WorkApprovalResolver address
    /// @param assessmentResolver New AssessmentResolver address
    /// @return newImplAddress Address of newly deployed GardenAccount implementation
    function deployNewGardenAccountImplementation(
        address workApprovalResolver,
        address assessmentResolver
    )
        public
        returns (address newImplAddress)
    {
        console.log("\n=== Deploying New GardenAccount Implementation ===");
        console.log("New WorkApprovalResolver:", workApprovalResolver);
        console.log("New AssessmentResolver:", assessmentResolver);

        vm.startBroadcast();

        // Load network config for constructor args
        string memory chainIdStr = vm.toString(block.chainid);
        string memory deploymentPath = string.concat(vm.projectRoot(), "/deployments/", chainIdStr, "-latest.json");
        string memory json = vm.readFile(deploymentPath);

        address entryPoint = abi.decode(vm.parseJson(json, ".eas.address"), (address));
        address multicallForwarder = address(0xcA11bde05977b3631167028862bE2a173976CA11);
        address tokenboundRegistry = address(0x000000006551c19487814612e58FE06813775758);
        address guardian = abi.decode(vm.parseJson(json, ".guardian"), (address));

        // Deploy new implementation
        GardenAccount newImpl = new GardenAccount(
            entryPoint, multicallForwarder, tokenboundRegistry, guardian, workApprovalResolver, assessmentResolver
        );

        newImplAddress = address(newImpl);
        console.log("New GardenAccount implementation deployed:", newImplAddress);
        console.log("\nNOTE: This is a NEW implementation. Existing gardens must opt-in to upgrade.");
        console.log("Use upgradeGardenProxy() to upgrade individual gardens.");

        vm.stopBroadcast();

        return newImplAddress;
    }

    /// @notice Upgrade a specific garden proxy to new GardenAccount implementation
    /// @dev Garden owner must approve this transaction
    /// @param gardenProxyAddress Address of the garden proxy to upgrade
    /// @param newImplementation Address of new GardenAccount implementation
    function upgradeGardenProxy(address gardenProxyAddress, address newImplementation) public {
        console.log("\n=== Upgrading Garden Proxy ===");
        console.log("Garden proxy:", gardenProxyAddress);
        console.log("New implementation:", newImplementation);

        vm.startBroadcast();

        // Garden proxies use AccountV3Upgradable which has upgradeTo
        // This requires the caller to be the garden owner (via _isValidSigner)
        UUPSUpgradeable(gardenProxyAddress).upgradeTo(newImplementation);
        console.log("Garden proxy upgraded successfully");

        vm.stopBroadcast();
    }

    /// @notice Batch upgrade multiple garden proxies
    /// @param gardenProxies Array of garden proxy addresses
    /// @param newImplementation Address of new GardenAccount implementation
    function batchUpgradeGardens(address[] calldata gardenProxies, address newImplementation) public {
        console.log("\n=== Batch Upgrading Garden Proxies ===");
        console.log("Number of gardens:", gardenProxies.length);
        console.log("New implementation:", newImplementation);

        vm.startBroadcast();

        for (uint256 i = 0; i < gardenProxies.length; i++) {
            console.log("\nUpgrading garden", i + 1, "/", gardenProxies.length);
            console.log("Garden proxy:", gardenProxies[i]);

            try UUPSUpgradeable(gardenProxies[i]).upgradeTo(newImplementation) {
                console.log("[OK] Upgraded successfully");
            } catch Error(string memory reason) {
                console.log("[FAIL] Failed:", reason);
            }
        }

        vm.stopBroadcast();
    }

    /// @notice Check which implementation a garden proxy is using
    /// @param gardenProxy Address of garden proxy
    function checkGardenImplementation(address gardenProxy) public view returns (address) {
        // Implementation address is stored at ERC1967 implementation slot
        bytes32 implementationSlot = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
        bytes32 implementation = vm.load(gardenProxy, implementationSlot);
        return address(uint160(uint256(implementation)));
    }
}
