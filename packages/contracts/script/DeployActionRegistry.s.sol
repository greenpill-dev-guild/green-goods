// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";

import { GREEN_GOODS_SAFE } from "../src/Constants.sol";
import { ActionRegistry } from "../src/registries/Action.sol";

contract Deploy is Script {
    function run() public {
        bytes32 salt = 0x6551655165516551655165516551655165516551655165516551655165516551;
        address factory = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

        address registry = Create2.computeAddress(
            salt,
            keccak256(abi.encodePacked(type(ActionRegistry).creationCode, "")),
            factory
        );

        // Deploy ActionRegistry
        if (registry.code.length == 0) {
            vm.startBroadcast();
            new ActionRegistry{ salt: salt }().initialize(GREEN_GOODS_SAFE);
            vm.stopBroadcast();

            console.log("ActionRegistry:", registry, "(deployed)");
        } else {
            console.log("ActionRegistry:", registry, "(exists)");
        }

        console.log("\nVerification Commands:\n");
        console.log(
            "ActionRegistry: forge verify-contract --num-of-optimizations 200 --chain-id",
            block.chainid,
            registry
        );
    }
}
