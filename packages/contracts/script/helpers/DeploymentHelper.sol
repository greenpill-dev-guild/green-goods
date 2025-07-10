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
    }

    /// @notice Load network configuration from JSON file
    function loadNetworkConfig() public view returns (NetworkConfig memory) {
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/deployments/networks.json");
        string memory json = vm.readFile(path);

        string memory chainIdStr = vm.toString(block.chainid);
        string memory basePath = string.concat(".networks.", chainIdStr);

        // Check if network is configured
        bytes memory checkBytes = json.parseRaw(string.concat(basePath, ".chainId"));
        if (checkBytes.length == 0) {
            // Use localhost config for unconfigured networks
            basePath = ".networks.localhost";
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

    /// @notice Save deployment result to JSON
    function saveDeployment(DeploymentResult memory result) internal {
        string memory obj = "deployment";
        vm.serializeAddress(obj, "deploymentRegistry", result.deploymentRegistry);
        vm.serializeAddress(obj, "guardian", result.guardian);
        vm.serializeAddress(obj, "gardenAccountImpl", result.gardenAccountImpl);
        vm.serializeAddress(obj, "accountProxy", result.accountProxy);
        vm.serializeAddress(obj, "gardenToken", result.gardenToken);
        vm.serializeAddress(obj, "actionRegistry", result.actionRegistry);
        vm.serializeAddress(obj, "workResolver", result.workResolver);
        string memory finalJson = vm.serializeAddress(obj, "workApprovalResolver", result.workApprovalResolver);

        string memory chainIdStr = vm.toString(block.chainid);
        string memory fileName = string.concat("deployments/", chainIdStr, "-latest.json");
        vm.writeJson(finalJson, fileName);

        console.log("Deployment saved to:", fileName);
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
