// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
/* solhint-disable no-console */

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

// Import all upgradeable contracts
import { ActionRegistry } from "../src/registries/Action.sol";
import { GardenToken } from "../src/tokens/Garden.sol";
import { GardenAccount } from "../src/accounts/Garden.sol";
import { Gardener } from "../src/accounts/Gardener.sol";
import { IEntryPoint } from "account-abstraction/interfaces/IEntryPoint.sol";
import { WorkResolver } from "../src/resolvers/Work.sol";
import { WorkApprovalResolver } from "../src/resolvers/WorkApproval.sol";
import { AssessmentResolver } from "../src/resolvers/Assessment.sol";
import { DeploymentRegistry } from "../src/DeploymentRegistry.sol";

/// @title Upgrade Script for Green Goods Contracts
/// @notice Handles UUPS proxy upgrades for all upgradeable contracts
contract Upgrade is Script {
    // Custom errors for better gas efficiency
    error SameImplementation();
    error ZeroAddress(string paramName);
    error NotAContract(string contractName);
    /// @notice Load proxy address from deployment file

    function loadProxyAddress(string memory contractName) internal view returns (address) {
        string memory chainIdStr = vm.toString(block.chainid);
        string memory deploymentPath = string.concat(vm.projectRoot(), "/deployments/", chainIdStr, "-latest.json");

        // vm.readFile will revert if file doesn't exist
        string memory json = vm.readFile(deploymentPath);
        string memory path = string.concat(".", contractName);

        return abi.decode(vm.parseJson(json, path), (address));
    }

    /// @notice Validate that address is non-zero and is a contract
    function validateAddress(address addr, string memory name) internal view {
        require(addr != address(0), string.concat(name, " address is zero"));
        require(addr.code.length > 0, string.concat(name, " is not a contract"));
    }

    /// @notice Validate that target is a UUPS proxy
    function validateProxy(address proxy, string memory name) internal view {
        validateAddress(proxy, name);

        // Check ERC1967 implementation slot is set
        bytes32 implementationSlot = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
        bytes32 implementation = vm.load(proxy, implementationSlot);
        address implAddr = address(uint160(uint256(implementation)));

        require(implAddr != address(0), string.concat(name, " has no implementation"));
    }

    /// @notice Load network configuration
    function loadNetworkConfig()
        internal
        view
        returns (address eas, address easSchemaRegistry, address actionRegistry, address gardenAccountImpl)
    {
        string memory chainIdStr = vm.toString(block.chainid);
        string memory deploymentPath = string.concat(vm.projectRoot(), "/deployments/", chainIdStr, "-latest.json");
        string memory json = vm.readFile(deploymentPath);

        eas = abi.decode(vm.parseJson(json, ".eas.address"), (address));
        easSchemaRegistry = abi.decode(vm.parseJson(json, ".eas.schemaRegistry"), (address));
        actionRegistry = abi.decode(vm.parseJson(json, ".actionRegistry"), (address));
        gardenAccountImpl = abi.decode(vm.parseJson(json, ".gardenAccountImpl"), (address));
    }

    /// @notice Upgrade ActionRegistry
    function upgradeActionRegistry() public {
        address proxy = loadProxyAddress("actionRegistry");
        console.log("Upgrading ActionRegistry proxy at:", proxy);

        // Validate proxy
        validateProxy(proxy, "ActionRegistry");

        // Get current implementation
        bytes32 implementationSlot = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
        bytes32 currentImpl = vm.load(proxy, implementationSlot);
        address currentImplAddr = address(uint160(uint256(currentImpl)));
        console.log("Current ActionRegistry implementation:", currentImplAddr);

        vm.startBroadcast();

        // Deploy new implementation
        ActionRegistry newImpl = new ActionRegistry();
        console.log("New ActionRegistry implementation:", address(newImpl));

        // Verify implementations differ
        if (address(newImpl) == currentImplAddr) revert SameImplementation();

        // Upgrade proxy
        UUPSUpgradeable(proxy).upgradeTo(address(newImpl));
        console.log("ActionRegistry upgraded successfully");

        vm.stopBroadcast();
    }

    /// @notice Upgrade GardenToken
    function upgradeGardenToken() public {
        address proxy = loadProxyAddress("gardenToken");
        console.log("Upgrading GardenToken proxy at:", proxy);

        // Validate proxy
        validateProxy(proxy, "GardenToken");

        // Get current implementation
        bytes32 implementationSlot = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
        bytes32 currentImpl = vm.load(proxy, implementationSlot);
        address currentImplAddr = address(uint160(uint256(currentImpl)));
        console.log("Current GardenToken implementation:", currentImplAddr);

        vm.startBroadcast();

        (,,, address gardenAccountImpl) = loadNetworkConfig();
        console.log("Using GardenAccount implementation:", gardenAccountImpl);

        GardenToken newImpl = new GardenToken(gardenAccountImpl);
        console.log("New GardenToken implementation:", address(newImpl));

        // Verify implementations differ
        if (address(newImpl) == currentImplAddr) revert SameImplementation();

        UUPSUpgradeable(proxy).upgradeTo(address(newImpl));
        console.log("GardenToken upgraded successfully");

        vm.stopBroadcast();
    }

    /// @notice Upgrade WorkResolver
    function upgradeWorkResolver() public {
        address proxy = loadProxyAddress("workResolver");
        console.log("Upgrading WorkResolver proxy at:", proxy);

        // Validate proxy
        validateProxy(proxy, "WorkResolver");

        // Get current implementation
        bytes32 implementationSlot = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
        bytes32 currentImpl = vm.load(proxy, implementationSlot);
        address currentImplAddr = address(uint160(uint256(currentImpl)));
        console.log("Current WorkResolver implementation:", currentImplAddr);

        vm.startBroadcast();

        (address eas,, address actionRegistry,) = loadNetworkConfig();
        console.log("Using EAS:", eas);
        console.log("Using ActionRegistry:", actionRegistry);

        WorkResolver newImpl = new WorkResolver(eas, actionRegistry);
        console.log("New WorkResolver implementation:", address(newImpl));

        // Verify implementations differ
        if (address(newImpl) == currentImplAddr) revert SameImplementation();

        UUPSUpgradeable(proxy).upgradeTo(address(newImpl));
        console.log("WorkResolver upgraded successfully");

        vm.stopBroadcast();
    }

    /// @notice Upgrade WorkApprovalResolver
    function upgradeWorkApprovalResolver() public {
        address proxy = loadProxyAddress("workApprovalResolver");
        console.log("Upgrading WorkApprovalResolver proxy at:", proxy);

        // Validate proxy
        validateProxy(proxy, "WorkApprovalResolver");

        // Get current implementation
        bytes32 implementationSlot = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
        bytes32 currentImpl = vm.load(proxy, implementationSlot);
        address currentImplAddr = address(uint160(uint256(currentImpl)));
        console.log("Current WorkApprovalResolver implementation:", currentImplAddr);

        vm.startBroadcast();

        (address eas,, address actionRegistry,) = loadNetworkConfig();
        console.log("Using EAS:", eas);
        console.log("Using ActionRegistry:", actionRegistry);

        WorkApprovalResolver newImpl = new WorkApprovalResolver(eas, actionRegistry);
        console.log("New WorkApprovalResolver implementation:", address(newImpl));

        // Verify implementations differ
        if (address(newImpl) == currentImplAddr) revert SameImplementation();

        UUPSUpgradeable(proxy).upgradeTo(address(newImpl));
        console.log("WorkApprovalResolver upgraded successfully");

        vm.stopBroadcast();
    }

    /// @notice Upgrade AssessmentResolver
    function upgradeAssessmentResolver() public {
        address proxy = loadProxyAddress("assessmentResolver");
        console.log("Upgrading AssessmentResolver proxy at:", proxy);

        // Validate proxy
        validateProxy(proxy, "AssessmentResolver");

        // Get current implementation
        bytes32 implementationSlot = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
        bytes32 currentImpl = vm.load(proxy, implementationSlot);
        address currentImplAddr = address(uint160(uint256(currentImpl)));
        console.log("Current AssessmentResolver implementation:", currentImplAddr);

        vm.startBroadcast();

        (address eas,,,) = loadNetworkConfig();
        console.log("Using EAS:", eas);

        AssessmentResolver newImpl = new AssessmentResolver(eas);
        console.log("New AssessmentResolver implementation:", address(newImpl));

        // Verify implementations differ
        if (address(newImpl) == currentImplAddr) revert SameImplementation();

        UUPSUpgradeable(proxy).upgradeTo(address(newImpl));
        console.log("AssessmentResolver upgraded successfully");

        vm.stopBroadcast();
    }

    /// @notice Upgrade DeploymentRegistry
    function upgradeDeploymentRegistry() public {
        address proxy = loadProxyAddress("deploymentRegistry");
        console.log("Upgrading DeploymentRegistry proxy at:", proxy);

        // Validate proxy
        validateProxy(proxy, "DeploymentRegistry");

        // Get current implementation
        bytes32 implementationSlot = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
        bytes32 currentImpl = vm.load(proxy, implementationSlot);
        address currentImplAddr = address(uint160(uint256(currentImpl)));
        console.log("Current DeploymentRegistry implementation:", currentImplAddr);

        vm.startBroadcast();

        DeploymentRegistry newImpl = new DeploymentRegistry();
        console.log("New DeploymentRegistry implementation:", address(newImpl));

        // Verify implementations differ
        if (address(newImpl) == currentImplAddr) revert SameImplementation();

        UUPSUpgradeable(proxy).upgradeTo(address(newImpl));
        console.log("DeploymentRegistry upgraded successfully");

        vm.stopBroadcast();
    }

    /// @notice Upgrade Gardener logic (Kernel v3 smart account)
    function upgradeGardenerAccount() public {
        string memory chainIdStr = vm.toString(block.chainid);
        string memory deploymentPath = string.concat(vm.projectRoot(), "/deployments/", chainIdStr, "-latest.json");

        console.log("Upgrading Gardener logic");

        vm.startBroadcast();

        // Load network config
        string memory json = vm.readFile(deploymentPath);
        address entryPoint = abi.decode(vm.parseJson(json, ".entryPoint"), (address));

        // Deploy new logic with IEntryPoint only (no ENS registrar needed)
        Gardener newLogic = new Gardener(IEntryPoint(entryPoint));

        console.log("New Gardener logic deployed at:", address(newLogic));

        // Update deployment file
        vm.writeJson(vm.toString(address(newLogic)), deploymentPath, ".gardenerAccountLogic");
        console.log("Gardener logic upgraded successfully");

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
        upgradeGardenerAccount();
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
        console.log("Deploying new GardenAccount implementation");
        console.log("WorkApprovalResolver:", workApprovalResolver);
        console.log("AssessmentResolver:", assessmentResolver);

        vm.startBroadcast();

        // Load network config for guardian address
        string memory chainIdStr = vm.toString(block.chainid);
        string memory deploymentPath = string.concat(vm.projectRoot(), "/deployments/", chainIdStr, "-latest.json");
        string memory json = vm.readFile(deploymentPath);

        // EntryPoint is constant across all networks (ERC-4337 standard)
        address entryPoint = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
        address multicallForwarder = 0xcA11bde05977b3631167028862bE2a173976CA11;
        address tokenboundRegistry = 0x000000006551c19487814612e58FE06813775758;
        address guardian = abi.decode(vm.parseJson(json, ".guardian"), (address));

        // Validate all addresses
        if (workApprovalResolver == address(0)) revert ZeroAddress("WorkApprovalResolver");
        if (assessmentResolver == address(0)) revert ZeroAddress("AssessmentResolver");
        if (guardian == address(0)) revert ZeroAddress("Guardian");
        if (workApprovalResolver.code.length == 0) revert NotAContract("WorkApprovalResolver");
        if (assessmentResolver.code.length == 0) revert NotAContract("AssessmentResolver");

        console.log("EntryPoint:", entryPoint);
        console.log("MulticallForwarder:", multicallForwarder);
        console.log("TokenboundRegistry:", tokenboundRegistry);
        console.log("Guardian:", guardian);

        // Deploy new implementation
        GardenAccount newImpl = new GardenAccount(
            entryPoint, multicallForwarder, tokenboundRegistry, guardian, workApprovalResolver, assessmentResolver
        );

        newImplAddress = address(newImpl);
        console.log("New GardenAccount implementation deployed at:", newImplAddress);

        vm.stopBroadcast();

        return newImplAddress;
    }

    /// @notice Upgrade a specific garden proxy to new GardenAccount implementation
    /// @dev Garden owner must approve this transaction
    /// @param gardenProxyAddress Address of the garden proxy to upgrade
    /// @param newImplementation Address of new GardenAccount implementation
    function upgradeGardenProxy(address gardenProxyAddress, address newImplementation) public {
        console.log("Upgrading garden proxy:", gardenProxyAddress);
        console.log("To implementation:", newImplementation);

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
        console.log("Batch upgrading", gardenProxies.length, "gardens");
        console.log("To implementation:", newImplementation);

        // Validate new implementation
        validateAddress(newImplementation, "New implementation");

        uint256 successCount = 0;
        uint256 failureCount = 0;
        address[] memory failedGardens = new address[](gardenProxies.length);

        vm.startBroadcast();

        for (uint256 i = 0; i < gardenProxies.length; i++) {
            console.log("Upgrading garden %s of %s: %s", i + 1, gardenProxies.length, gardenProxies[i]);
            // solhint-disable-next-line no-empty-blocks
            try UUPSUpgradeable(gardenProxies[i]).upgradeTo(newImplementation) {
                console.log("  Successfully upgraded");
                successCount++;
                // solhint-disable-next-line no-empty-blocks
            } catch Error(string memory reason) {
                console.log("  Failed:", reason);
                failedGardens[failureCount] = gardenProxies[i];
                failureCount++;
            } catch {
                console.log("  Failed: Unknown error");
                failedGardens[failureCount] = gardenProxies[i];
                failureCount++;
            }
        }

        vm.stopBroadcast();

        console.log("\n=== Batch Upgrade Summary ===");
        console.log("Total gardens:", gardenProxies.length);
        console.log("Successful:", successCount);
        console.log("Failed:", failureCount);

        if (failureCount > 0) {
            console.log("\nFailed gardens:");
            for (uint256 i = 0; i < failureCount; i++) {
                console.log("  -", failedGardens[i]);
            }
        }
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
