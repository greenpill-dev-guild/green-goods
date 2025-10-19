// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
/* solhint-disable no-console */

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";
import { stdJson } from "forge-std/StdJson.sol";

/// @title DeployHelper
/// @notice Helper contract for deployment scripts
abstract contract DeployHelper is Script {
    /// @notice Error thrown when CREATE2 deployment fails
    error CREATE2DeploymentFailed();

    /// @notice Error thrown when deployment address doesn't match predicted address
    error DeploymentAddressMismatch();

    using stdJson for string;

    struct NetworkConfig {
        address eas;
        address easSchemaRegistry;
        address communityToken;
        address safe;
        address safeFactory;
        address safe4337Module;
        address erc4337EntryPoint;
        address multicallForwarder;
        address greenGoodsSafe;
        address multisig;
        address ensRegistry;
        address ensResolver;
    }

    struct DeploymentResult {
        address deploymentRegistry;
        address guardian;
        address gardenAccountImpl;
        address accountProxy;
        address gardenToken;
        address actionRegistry;
        address assessmentResolver;
        address workResolver;
        address workApprovalResolver;
        address gardenerAccountLogic; // GardenerAccount implementation for user smart accounts
        address ensRegistrar; // ENS Registrar (mainnet only, address(0) on L2s)
        bytes32 assessmentSchemaUID;
        bytes32 workSchemaUID;
        bytes32 workApprovalSchemaUID;
        // Root garden info
        address rootGardenAddress;
        uint256 rootGardenTokenId;
    }

    /// @notice Load network configuration from JSON file
    function loadNetworkConfig() public view returns (NetworkConfig memory) {
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/deployments/networks.json");
        string memory json = vm.readFile(path);

        // Map chain ID to network name
        string memory networkName = _getNetworkName(block.chainid);
        console.log("Loading network config for:", networkName);
        string memory basePath = string.concat(".networks.", networkName);

        // Check if network is configured by trying to read chainId
        // solhint-disable-next-line no-empty-blocks
        try vm.parseJson(json, string.concat(basePath, ".chainId")) {
            // Network exists - basePath is correct, continue with it
        } catch {
            // Network not found, use localhost as fallback
            console.log("Network not found, using localhost as fallback");
            basePath = ".networks.localhost";
        }

        NetworkConfig memory config;
        config.eas = json.readAddress(string.concat(basePath, ".contracts.eas"));
        config.easSchemaRegistry = json.readAddress(string.concat(basePath, ".contracts.easSchemaRegistry"));
        config.communityToken = json.readAddress(string.concat(basePath, ".contracts.communityToken"));
        config.erc4337EntryPoint = json.readAddress(string.concat(basePath, ".contracts.erc4337EntryPoint"));
        config.multicallForwarder = json.readAddress(string.concat(basePath, ".contracts.multicallForwarder"));

        // ENS is only on mainnet and sepolia (testnets)
        // solhint-disable-next-line no-empty-blocks
        try vm.parseJson(json, string.concat(basePath, ".contracts.ensRegistry")) returns (bytes memory data) {
            config.ensRegistry = abi.decode(data, (address));
            // solhint-disable-next-line no-empty-blocks
        } catch {
            // ENS not configured for this network (L2 chains) - defaults to address(0)
        }

        // solhint-disable-next-line no-empty-blocks
        try vm.parseJson(json, string.concat(basePath, ".contracts.ensResolver")) returns (bytes memory data) {
            config.ensResolver = abi.decode(data, (address));
            // solhint-disable-next-line no-empty-blocks
        } catch {
            // ENS not configured for this network (L2 chains) - defaults to address(0)
        }

        // Get deployment defaults
        config.safe = json.readAddress(".deploymentDefaults.safe");
        config.safeFactory = json.readAddress(".deploymentDefaults.safeFactory");
        config.safe4337Module = json.readAddress(".deploymentDefaults.safe4337Module");
        config.greenGoodsSafe = json.readAddress(".deploymentDefaults.greenGoodsSafe");
        config.multisig = json.readAddress(".deploymentDefaults.multisig");

        console.log("EAS:", config.eas);
        console.log("EAS Schema Registry:", config.easSchemaRegistry);
        if (config.ensRegistry != address(0)) {
            console.log("ENS Registry:", config.ensRegistry);
            console.log("ENS Resolver:", config.ensResolver);
        }

        return config;
    }

    /// @notice Get network name from chain ID
    function _getNetworkName(uint256 chainId) internal pure returns (string memory) {
        if (chainId == 1) return "mainnet";
        if (chainId == 11_155_111) return "sepolia";
        if (chainId == 31_337) return "localhost";
        if (chainId == 42_161) return "arbitrum";
        if (chainId == 84_532) return "baseSepolia";
        if (chainId == 42_220) return "celo";

        // Default to localhost for unknown chains
        return "localhost";
    }

    /// @notice Get deployment defaults from JSON
    function getDeploymentDefaults() public view returns (bytes32 salt, address factory, address tokenboundRegistry) {
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/deployments/networks.json");
        string memory json = vm.readFile(path);

        // Generate salt from string for fresh deployment
        salt = keccak256(bytes("greenGoodsCleanDeploy2025:6"));
        factory = json.readAddress(".deploymentDefaults.factory");
        tokenboundRegistry = json.readAddress(".deploymentDefaults.tokenboundRegistry");
    }

    /// @notice Deploy a contract using CREATE2
    function _deployCreate2(bytes memory bytecode, bytes32 salt, address factory) internal returns (address) {
        address predicted = Create2.computeAddress(salt, keccak256(bytecode), factory);
        console.log("Predicted CREATE2 address:", predicted);

        if (predicted.code.length > 0) {
            console.log("Contract already deployed at predicted address");
            return predicted;
        }

        console.log("Deploying via CREATE2 factory:", factory);
        // Deploy using CREATE2 through factory
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory data) = factory.call(abi.encodePacked(salt, bytecode));
        if (!success) {
            console.log("CREATE2 deployment failed");
            revert CREATE2DeploymentFailed();
        }

        // Extract address from raw bytes (factory returns 20 bytes, not ABI-encoded)
        address deployed;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            deployed := mload(add(data, 20))
        }

        if (deployed != predicted) {
            console.log("Deployment address mismatch!");
            console.log("Expected:", predicted);
            console.log("Got:", deployed);
            revert DeploymentAddressMismatch();
        }

        console.log("Successfully deployed at:", deployed);
        return deployed;
    }

    /// @notice Check if contract is already deployed
    function _isDeployed(address addr) internal view returns (bool) {
        return addr.code.length > 0;
    }

    /// @notice Save deployment result to JSON with schema configuration
    function _saveDeployment(DeploymentResult memory result) internal {
        console.log("\n=== Saving Deployment ===");
        console.log("DeploymentRegistry:", result.deploymentRegistry);
        console.log("Guardian:", result.guardian);
        console.log("GardenAccountImpl:", result.gardenAccountImpl);
        console.log("GardenerAccountLogic:", result.gardenerAccountLogic);
        console.log("GardenToken:", result.gardenToken);
        console.log("ActionRegistry:", result.actionRegistry);

        string memory obj = "deployment";
        vm.serializeAddress(obj, "deploymentRegistry", result.deploymentRegistry);
        vm.serializeAddress(obj, "guardian", result.guardian);
        vm.serializeAddress(obj, "gardenAccountImpl", result.gardenAccountImpl);
        vm.serializeAddress(obj, "accountProxy", result.accountProxy);
        vm.serializeAddress(obj, "gardenToken", result.gardenToken);
        vm.serializeAddress(obj, "actionRegistry", result.actionRegistry);
        vm.serializeAddress(obj, "assessmentResolver", result.assessmentResolver);
        vm.serializeAddress(obj, "workResolver", result.workResolver);
        vm.serializeAddress(obj, "workApprovalResolver", result.workApprovalResolver);
        vm.serializeAddress(obj, "gardenerAccountLogic", result.gardenerAccountLogic);
        vm.serializeAddress(obj, "ensRegistrar", result.ensRegistrar);

        // Serialize root garden info
        console.log("\nRoot Garden:");
        console.log("  Address:", result.rootGardenAddress);
        console.log("  Token ID:", result.rootGardenTokenId);
        string memory rootGardenObj = "rootGarden";
        vm.serializeAddress(rootGardenObj, "address", result.rootGardenAddress);
        string memory rootGardenJson = vm.serializeUint(rootGardenObj, "tokenId", result.rootGardenTokenId);

        // Load schema configuration from JSON
        string memory schemasJson = _loadSchemasFromConfig(result);

        // Add EAS configuration
        NetworkConfig memory config = loadNetworkConfig();
        string memory easObj = "eas";
        vm.serializeAddress(easObj, "address", config.eas);
        string memory easJson = vm.serializeAddress(easObj, "schemaRegistry", config.easSchemaRegistry);

        // Final serialization with rootGarden
        vm.serializeString(obj, "schemas", schemasJson);
        vm.serializeString(obj, "eas", easJson);
        vm.serializeString(obj, "rootGarden", rootGardenJson);
        vm.serializeAddress(obj, "assessmentResolver", result.assessmentResolver);
        string memory finalJson = vm.serializeAddress(obj, "workApprovalResolver", result.workApprovalResolver);

        string memory chainIdStr = vm.toString(block.chainid);
        string memory fileName = string.concat("deployments/", chainIdStr, "-latest.json");
        console.log("\nWriting deployment to:", fileName);
        vm.writeJson(finalJson, fileName);
        console.log("Deployment saved successfully\n");
    }

    /// @notice Load schemas from configuration file and add deployment UIDs
    function _loadSchemasFromConfig(DeploymentResult memory result) internal returns (string memory) {
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/config/schemas.json");
        string memory json = vm.readFile(path);

        string memory schemasObj = "schemas";

        // Find and process each schema from the flat array
        (string memory assessmentName, string memory assessmentDescription) = _findSchemaDataInArray(json, "assessment");
        (string memory workName, string memory workDescription) = _findSchemaDataInArray(json, "work");
        (string memory workApprovalName, string memory workApprovalDescription) =
            _findSchemaDataInArray(json, "workApproval");

        // Assessment Schema (New Impact Schema)
        vm.serializeBytes32(schemasObj, "assessmentSchemaUID", result.assessmentSchemaUID);
        vm.serializeString(schemasObj, "assessmentName", assessmentName);
        vm.serializeString(schemasObj, "assessmentDescription", assessmentDescription);
        vm.serializeString(schemasObj, "assessmentSchema", _generateSchemaString("assessment"));

        // Work Schema
        vm.serializeBytes32(schemasObj, "workSchemaUID", result.workSchemaUID);
        vm.serializeString(schemasObj, "workName", workName);
        vm.serializeString(schemasObj, "workDescription", workDescription);
        vm.serializeString(schemasObj, "workSchema", _generateSchemaString("work"));

        // Work Approval Schema
        vm.serializeBytes32(schemasObj, "workApprovalSchemaUID", result.workApprovalSchemaUID);
        vm.serializeString(schemasObj, "workApprovalName", workApprovalName);
        vm.serializeString(schemasObj, "workApprovalDescription", workApprovalDescription);
        string memory schemasJson =
            vm.serializeString(schemasObj, "workApprovalSchema", _generateSchemaString("workApproval"));

        return schemasJson;
    }

    /// @notice Find a schema by ID in the object structure and return its name and description
    function _findSchemaDataInArray(
        string memory json,
        string memory schemaId
    )
        internal
        pure
        returns (string memory name, string memory description)
    {
        // Map schema ID to actual key in schemas.json
        string memory actualSchemaKey = schemaId;
        if (keccak256(abi.encodePacked(schemaId)) == keccak256(abi.encodePacked("assessment"))) {
            actualSchemaKey = "assessment";
        } else if (keccak256(abi.encodePacked(schemaId)) == keccak256(abi.encodePacked("work"))) {
            actualSchemaKey = "work";
        } else if (keccak256(abi.encodePacked(schemaId)) == keccak256(abi.encodePacked("workApproval"))) {
            actualSchemaKey = "workApproval";
        }

        // Access schema from object structure: .schemas.<key>.name
        string memory schemaPath = string.concat(".schemas.", actualSchemaKey);

        try vm.parseJson(json, string.concat(schemaPath, ".name")) returns (bytes memory nameData) {
            name = abi.decode(nameData, (string));
            description = abi.decode(vm.parseJson(json, string.concat(schemaPath, ".description")), (string));
            return (name, description);
        } catch {
            revert(string.concat("Schema not found: ", schemaId, " (tried key: ", actualSchemaKey, ")"));
        }
    }

    /// @notice Generate schema string from fields array using JavaScript utility
    function _generateSchemaString(string memory schemaName) internal virtual returns (string memory) {
        string[] memory inputs = new string[](3);
        inputs[0] = "node";
        inputs[1] = "script/utils/generate-schemas.js";
        inputs[2] = schemaName;

        bytes memory result = vm.ffi(inputs);
        return string(result);
    }

    /// @notice Print deployment summary
    // solhint-disable-next-line no-empty-blocks
    function _printDeploymentSummary(DeploymentResult memory /* result */ ) internal view {
        // TODO: Implement deployment summary logging
    }

    /// @notice Generate verification commands
    // solhint-disable-next-line no-empty-blocks
    function _generateVerificationCommands(DeploymentResult memory /* result */ ) internal view {
        // TODO: Generate verification commands for deployment
    }
}
