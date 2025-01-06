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

            Capital[] memory capitals = new Capital[](3);
            capitals[0] = Capital.LIVING;
            capitals[1] = Capital.CULTURAL;
            capitals[2] = Capital.SOCIAL;

            string[] memory observeMedia = new string[](3);
            observeMedia[0] = "QmVvKqpnfJm8UwRq9SF15V2jgJ86yCBsmMBmpEaoQU92bD";
            observeMedia[1] = "QmXeV9zWpXHzTGFS3jJRBRYBTHkcVE23qpdhhtQKX1uC4L";
            observeMedia[2] = "QmXp5fEnjHbsLniCE5BD1LyjoGgvoHKuajqQnDCPAZih2X";

            string[] memory plantMedia = new string[](3);
            plantMedia[0] = "QmY6h53RyAY6VQfqqUTBwkVkG8JpCon9SdVkqtB5YzPVwx";
            plantMedia[1] = "QmZAeu9sEtNqXZBmiYiAt7bd4M38TmE73ekj47n7JDU2xm";
            plantMedia[2] = "QmdYz2JsVhyzZe591vR1sBQQjLWjGCTp1yJ1t1EicrAnYH";

            newRegistry.initialize(address(this));
            newRegistry.registerAction(
                block.timestamp,
                block.timestamp + 27 days,
                "Identify Plants",
                "QmX8rLExs7TDGPNAg9w22R8iYeRUYsrkkLg6LUUK8oNDUJ",
                capitals,
                observeMedia
            );
            newRegistry.registerAction(
                block.timestamp,
                block.timestamp + 27 days,
                "Plant Seedlings",
                "QmZGJBdZeCVx7S42KqovzUhwrGhqwxVCaoofzUE2YRhb2s",
                capitals,
                plantMedia
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
