// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";
import { stdJson } from "forge-std/StdJson.sol";

/// @title DeploymentHelper
/// @notice Helper contract for deployment scripts
abstract contract DeploymentHelper is Script {
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
    }

    struct DeploymentResult {
        address deploymentRegistry;
        address guardian;
        address gardenAccountImpl;
        address accountProxy;
        address gardenToken;
        address actionRegistry;
        address workResolver;
        address workApprovalResolver;
        bytes32 gardenAssessmentSchemaUID;
        bytes32 workSchemaUID;
        bytes32 workApprovalSchemaUID;
    }

    /// @notice Load network configuration from JSON file
    function loadNetworkConfig() public view returns (NetworkConfig memory) {
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/deployments/networks.json");
        string memory json = vm.readFile(path);

        // Map chain ID to network name
        string memory networkName = getNetworkName(block.chainid);
        string memory basePath = string.concat(".networks.", networkName);

        // Check if network is configured by trying to read chainId
        try vm.parseJson(json, string.concat(basePath, ".chainId")) {
            // Network exists, use it
        } catch {
            // Network not found, use localhost as fallback
            basePath = ".networks.localhost";
            console.log("Warning: Chain ID", block.chainid, "not configured, using localhost config");
        }

        NetworkConfig memory config;
        config.eas = json.readAddress(string.concat(basePath, ".contracts.eas"));
        config.easSchemaRegistry = json.readAddress(string.concat(basePath, ".contracts.easSchemaRegistry"));
        config.communityToken = json.readAddress(string.concat(basePath, ".contracts.communityToken"));
        config.erc4337EntryPoint = json.readAddress(string.concat(basePath, ".contracts.erc4337EntryPoint"));
        config.multicallForwarder = json.readAddress(string.concat(basePath, ".contracts.multicallForwarder"));

        // Get deployment defaults
        config.safe = json.readAddress(".deploymentDefaults.safe");
        config.safeFactory = json.readAddress(".deploymentDefaults.safeFactory");
        config.safe4337Module = json.readAddress(".deploymentDefaults.safe4337Module");
        config.greenGoodsSafe = json.readAddress(".deploymentDefaults.greenGoodsSafe");

        return config;
    }

    /// @notice Get network name from chain ID
    function getNetworkName(uint256 chainId) internal pure returns (string memory) {
        if (chainId == 31_337) return "localhost";
        if (chainId == 11_155_111) return "sepolia";
        if (chainId == 42_161) return "arbitrum";
        if (chainId == 8453) return "base";
        if (chainId == 10) return "optimism";
        if (chainId == 42_220) return "celo";

        // Default to localhost for unknown chains
        return "localhost";
    }

    /// @notice Get deployment defaults from JSON
    function getDeploymentDefaults() public view returns (bytes32 salt, address factory, address tokenboundRegistry) {
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/deployments/networks.json");
        string memory json = vm.readFile(path);

        salt = json.readBytes32(".deploymentDefaults.salt");
        factory = json.readAddress(".deploymentDefaults.factory");
        tokenboundRegistry = json.readAddress(".deploymentDefaults.tokenboundRegistry");
    }

    /// @notice Deploy a contract using CREATE2
    function deployCreate2(bytes memory bytecode, bytes32 salt, address factory) internal returns (address) {
        address predicted = Create2.computeAddress(salt, keccak256(bytecode), factory);

        if (predicted.code.length > 0) {
            console.log("Contract already deployed at:", predicted);
            return predicted;
        }

        // Deploy using CREATE2 through factory
        (bool success, bytes memory data) = factory.call(abi.encodePacked(salt, bytecode));
        if (!success) {
            revert CREATE2DeploymentFailed();
        }

        address deployed = abi.decode(data, (address));
        if (deployed != predicted) {
            revert DeploymentAddressMismatch();
        }

        return deployed;
    }

    /// @notice Check if contract is already deployed
    function isDeployed(address addr) internal view returns (bool) {
        return addr.code.length > 0;
    }

    /// @notice Save deployment result to JSON with schema configuration
    function saveDeployment(DeploymentResult memory result) internal {
        string memory obj = "deployment";
        vm.serializeAddress(obj, "deploymentRegistry", result.deploymentRegistry);
        vm.serializeAddress(obj, "guardian", result.guardian);
        vm.serializeAddress(obj, "gardenAccountImpl", result.gardenAccountImpl);
        vm.serializeAddress(obj, "accountProxy", result.accountProxy);
        vm.serializeAddress(obj, "gardenToken", result.gardenToken);
        vm.serializeAddress(obj, "actionRegistry", result.actionRegistry);
        vm.serializeAddress(obj, "workResolver", result.workResolver);
        vm.serializeAddress(obj, "workApprovalResolver", result.workApprovalResolver);

        // Load schema configuration from JSON
        string memory schemasJson = loadSchemasFromConfig(result);

        // Add EAS configuration
        NetworkConfig memory config = loadNetworkConfig();
        string memory easObj = "eas";
        vm.serializeAddress(easObj, "address", config.eas);
        string memory easJson = vm.serializeAddress(easObj, "schemaRegistry", config.easSchemaRegistry);

        // Final serialization
        vm.serializeString(obj, "schemas", schemasJson);
        vm.serializeString(obj, "eas", easJson);
        string memory finalJson = vm.serializeAddress(obj, "workApprovalResolver", result.workApprovalResolver);

        string memory chainIdStr = vm.toString(block.chainid);
        string memory fileName = string.concat("deployments/", chainIdStr, "-latest.json");
        vm.writeJson(finalJson, fileName);

        console.log("Deployment saved to:", fileName);
    }

    /// @notice Load schemas from configuration file and add deployment UIDs
    function loadSchemasFromConfig(DeploymentResult memory result) internal returns (string memory) {
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/config/schemas.json");
        string memory json = vm.readFile(path);

        string memory schemasObj = "schemas";

        // Garden Assessment Schema
        vm.serializeBytes32(schemasObj, "gardenAssessmentSchemaUID", result.gardenAssessmentSchemaUID);
        vm.serializeString(schemasObj, "gardenAssessmentName", json.readString(".schemas.gardenAssessment.name"));
        vm.serializeString(
            schemasObj, "gardenAssessmentDescription", json.readString(".schemas.gardenAssessment.description")
        );
        vm.serializeString(schemasObj, "gardenAssessmentSchema", _generateSchemaString("gardenAssessment"));

        // Work Schema
        vm.serializeBytes32(schemasObj, "workSchemaUID", result.workSchemaUID);
        vm.serializeString(schemasObj, "workName", json.readString(".schemas.work.name"));
        vm.serializeString(schemasObj, "workDescription", json.readString(".schemas.work.description"));
        vm.serializeString(schemasObj, "workSchema", _generateSchemaString("work"));

        // Work Approval Schema
        vm.serializeBytes32(schemasObj, "workApprovalSchemaUID", result.workApprovalSchemaUID);
        vm.serializeString(schemasObj, "workApprovalName", json.readString(".schemas.workApproval.name"));
        vm.serializeString(schemasObj, "workApprovalDescription", json.readString(".schemas.workApproval.description"));
        string memory schemasJson =
            vm.serializeString(schemasObj, "workApprovalSchema", _generateSchemaString("workApproval"));

        return schemasJson;
    }

    /// @notice Generate schema string from fields array using JavaScript utility
    function _generateSchemaString(string memory schemaName) internal virtual returns (string memory) {
        string[] memory inputs = new string[](3);
        inputs[0] = "node";
        inputs[1] = "script/utils/generateSchemas.js";
        inputs[2] = schemaName;

        bytes memory result = vm.ffi(inputs);
        return string(result);
    }

    /// @notice Print deployment summary
    function printDeploymentSummary(DeploymentResult memory result) internal view {
        console.log("\n=== Deployment Summary ===");
        console.log("Chain ID:", block.chainid);
        console.log("Deployment Registry:", result.deploymentRegistry);
        console.log("Guardian:", result.guardian);
        console.log("Garden Account Implementation:", result.gardenAccountImpl);
        console.log("Account Proxy:", result.accountProxy);
        console.log("Garden Token:", result.gardenToken);
        console.log("Action Registry:", result.actionRegistry);
        console.log("Work Resolver:", result.workResolver);
        console.log("Work Approval Resolver:", result.workApprovalResolver);
        console.log("\n--- EAS Schema UIDs ---");
        console.log("Garden Assessment Schema UID:", vm.toString(result.gardenAssessmentSchemaUID));
        console.log("Work Schema UID:", vm.toString(result.workSchemaUID));
        console.log("Work Approval Schema UID:", vm.toString(result.workApprovalSchemaUID));
        console.log("========================\n");
    }

    /// @notice Generate verification commands
    function generateVerificationCommands(DeploymentResult memory result) internal view {
        console.log("\n=== Verification Commands ===");

        string memory baseCmd =
            string.concat("forge verify-contract --num-of-optimizations 200 --chain-id ", vm.toString(block.chainid));

        console.log(
            string.concat(
                baseCmd, " ", vm.toString(result.deploymentRegistry), " src/DeploymentRegistry.sol:DeploymentRegistry"
            )
        );
        console.log(
            string.concat(
                baseCmd, " ", vm.toString(result.guardian), " @tokenbound/AccountGuardian.sol:AccountGuardian"
            )
        );
        console.log(
            string.concat(baseCmd, " ", vm.toString(result.gardenAccountImpl), " src/accounts/Garden.sol:GardenAccount")
        );
        console.log(
            string.concat(baseCmd, " ", vm.toString(result.accountProxy), " @tokenbound/AccountProxy.sol:AccountProxy")
        );
        console.log(string.concat(baseCmd, " ", vm.toString(result.gardenToken), " src/tokens/Garden.sol:GardenToken"));
        console.log(
            string.concat(baseCmd, " ", vm.toString(result.actionRegistry), " src/registries/Action.sol:ActionRegistry")
        );
        console.log(
            string.concat(baseCmd, " ", vm.toString(result.workResolver), " src/resolvers/Work.sol:WorkResolver")
        );
        console.log(
            string.concat(
                baseCmd,
                " ",
                vm.toString(result.workApprovalResolver),
                " src/resolvers/WorkApproval.sol:WorkApprovalResolver"
            )
        );

        console.log("=============================\n");
    }
}
