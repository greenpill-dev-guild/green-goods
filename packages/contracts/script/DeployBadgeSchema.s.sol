// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
/* solhint-disable no-console */

import { Script, console2 } from "forge-std/Script.sol";

interface ISchemaRegistry {
    function register(string calldata schema, address resolver, bool revocable) external returns (bytes32 uid);
}

/// @title DeployBadgeSchema
/// @notice Register the shared GreenWill badge schema in EAS
/// @dev Invoked by `bun script/deploy.ts badge-schemas --network <chain> --broadcast`
///      Writes deployments/{chainId}-badge-schema.json for the TS wrapper to merge.
contract DeployBadgeSchema is Script {
    error MissingSchemaRegistry(string path);
    error UnsupportedChain(uint256 chainId);

    string internal constant GREEN_GOODS_BADGE_SCHEMA =
        "string badgeType, address recipient, uint40 earnedAt, string evidenceUri, uint8 tier";
    string internal constant GREEN_GOODS_BADGE_NAME = "GreenGoodsBadge";
    string internal constant GREEN_GOODS_BADGE_DESCRIPTION = "Shared EAS schema for GreenWill reputation badges";
    bool internal constant REVOCABLE = true;

    function run() external {
        string memory networksJson = vm.readFile(string.concat(vm.projectRoot(), "/deployments/networks.json"));
        string memory networkName = _getNetworkName(block.chainid);
        string memory schemaRegistryPath = string.concat(".networks.", networkName, ".contracts.easSchemaRegistry");
        address schemaRegistry = _parseRequiredAddress(networksJson, schemaRegistryPath);

        vm.startBroadcast();
        bytes32 schemaUID = ISchemaRegistry(schemaRegistry).register(GREEN_GOODS_BADGE_SCHEMA, address(0), REVOCABLE);
        vm.stopBroadcast();

        _saveResult(schemaRegistry, schemaUID);
    }

    function _saveResult(address schemaRegistry, bytes32 schemaUID) internal {
        string memory obj = "badgeSchema";
        vm.serializeAddress(obj, "schemaRegistry", schemaRegistry);
        vm.serializeString(obj, "schemaUID", vm.toString(schemaUID));
        vm.serializeString(obj, "schema", GREEN_GOODS_BADGE_SCHEMA);
        vm.serializeString(obj, "name", GREEN_GOODS_BADGE_NAME);
        vm.serializeString(obj, "description", GREEN_GOODS_BADGE_DESCRIPTION);
        string memory finalJson = vm.serializeBool(obj, "revocable", REVOCABLE);

        string memory outPath =
            string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), "-badge-schema.json");
        vm.writeJson(finalJson, outPath);
        console2.log("Saved to:", outPath);
    }

    function _parseRequiredAddress(string memory json, string memory path) internal view returns (address parsed) {
        try vm.parseJson(json, path) returns (bytes memory data) {
            parsed = abi.decode(data, (address));
        } catch {
            revert MissingSchemaRegistry(path);
        }

        if (parsed == address(0)) {
            revert MissingSchemaRegistry(path);
        }
    }

    function _getNetworkName(uint256 chainId) internal pure returns (string memory) {
        if (chainId == 1) return "mainnet";
        if (chainId == 11_155_111) return "sepolia";
        if (chainId == 31_337) return "localhost";
        if (chainId == 42_161) return "arbitrum";
        if (chainId == 42_220) return "celo";
        revert UnsupportedChain(chainId);
    }
}
