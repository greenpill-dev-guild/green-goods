// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

// Import all upgradeable contracts
import { ActionRegistry } from "../src/registries/Action.sol";
import { GardenToken } from "../src/tokens/Garden.sol";
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
}
