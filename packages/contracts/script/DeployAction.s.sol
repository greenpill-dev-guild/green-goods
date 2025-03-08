// SPDX-License-Identifier: UNLICENSED
/* solhint-disable max-line-length */
/* solhint-disable quotes */
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";

import { ActionRegistry, Capital } from "../src/registries/Action.sol";

import { ACTION_REGISTRY } from "../src/Constants.sol";

/// @title DeployAction
/// @notice Script for deploying the ActionRegistry contract.
contract DeployAction is Script {
    function run() external {
        // Deploy Action
        vm.startBroadcast();

        Capital[] memory capitals = new Capital[](4);

        capitals[0] = Capital.LIVING;
        capitals[1] = Capital.MATERIAL;
        capitals[2] = Capital.SOCIAL;
        capitals[3] = Capital.EXPERIENTIAL;

        string[] memory media = new string[](1);

        media[0] = "bafkreiemwmci42u7cb23xacktk5nfspo5kfsbmflvh6sixjahjbdk2bsie";

        ActionRegistry registry = ActionRegistry(ACTION_REGISTRY);

        registry.registerAction(
            block.timestamp,
            block.timestamp + 270 days,
            "Litter Cleanup",
            "bafkreiafya2q3nz5dbl4fvxphtrnmahl6hcjyvhzwcimgwnbh4wsy5kr7i",
            capitals,
            media
        );

        registry.updateActionEndTime(0, block.timestamp + 270 days);
        registry.updateActionEndTime(1, block.timestamp + 270 days);

        vm.stopBroadcast();

        console.log("Litter Cleanup registered.");
    }
}
