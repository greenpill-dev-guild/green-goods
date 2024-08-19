// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";
import { GREEN_GOODS_SAFE } from "../src/Constants.sol";
import { ActionRegistry } from "../src/registries/Action.sol";

/// @title DeployActionRegistry
/// @notice Script for deploying the ActionRegistry contract using CREATE2.
contract DeployActionRegistry is Script {
    function run() public {
        bytes32 salt = 0x6551655165516551655165516551655165516551655165516551655165516551;
        address factory = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

        // Calculate the CREATE2 address for the ActionRegistry
        address predictedRegistryAddress = Create2.computeAddress(
            salt,
            keccak256(abi.encodePacked(type(ActionRegistry).creationCode, "")),
            factory
        );

        // Check if the contract is already deployed
        if (predictedRegistryAddress.code.length == 0) {
            vm.startBroadcast();
            ActionRegistry newRegistry = new ActionRegistry{ salt: salt }();
            newRegistry.initialize(GREEN_GOODS_SAFE);
            vm.stopBroadcast();

            console.log("ActionRegistry deployed at:", predictedRegistryAddress);
        } else {
            console.log("ActionRegistry already exists at:", predictedRegistryAddress);
        }

        // Print out verification commands
        console.log("\nVerification Commands:\n");
        console.log(
            "ActionRegistry: forge verify-contract --num-of-optimizations 200 --chain-id",
            block.chainid,
            predictedRegistryAddress
        );
    }
}
