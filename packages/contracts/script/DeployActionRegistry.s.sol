// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";
import { FACTORY, SALT } from "../src/Constants.sol";
import { ActionRegistry, Capital } from "../src/registries/Action.sol";

/// @title DeployActionRegistry
/// @notice Script for deploying the ActionRegistry contract using CREATE2.
contract DeployActionRegistry is Script {
    function run() public {
        // Calculate the CREATE2 address for the ActionRegistry
        address predictedRegistryAddress = Create2.computeAddress(
            SALT,
            keccak256(abi.encodePacked(type(ActionRegistry).creationCode, "")),
            FACTORY
        );

        // Check if the contract is already deployed
        if (predictedRegistryAddress.code.length == 0) {
            vm.startBroadcast();
            ActionRegistry newRegistry = new ActionRegistry{ salt: SALT }();

            Capital[] memory capitals = new Capital[](1);
            capitals[0] = Capital.LIVING;

            string[] memory media = new string[](2);
            media[0] = "QmWYQY9vnb9ot7u49UMeH41DdjZghrgr2YoaYaNwYSpeAn";
            media[1] = "QmS9K5EdyakRPW7gV86xivaUNx1AuhPUzUSRD53WnjL4Uz";

            newRegistry.initialize(address(this));
            newRegistry.registerAction(
                block.timestamp,
                block.timestamp + 30 days,
                "Identify Plants",
                "QmTmbcRyKtkMpMFWsm6D8YpgwMUuds3jE4sJdjqhqFGvWe",
                capitals,
                media
            );
            newRegistry.registerAction(
                block.timestamp,
                block.timestamp + 30 days,
                "Planting",
                "QmTmbcRyKtkMpMFWsm6D8YpgwMUuds3jE4sJdjqhqFGvWe",
                capitals,
                media
            );

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
