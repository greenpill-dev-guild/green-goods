// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { GardenAccount } from "../src/accounts/Garden.sol";

/**
 * @title Enable Open Joining Script
 * @notice Enables open joining on the root garden after upgrade
 * @dev Run after upgrading GardenAccount to add setOpenJoining function
 *
 * Usage:
 *   forge script script/EnableOpenJoining.s.sol:EnableOpenJoining \
 *     --rpc-url arbitrum \
 *     --account green-goods-deployer \
 *     --broadcast
 */
contract EnableOpenJoining is Script {
    function run() external {
        // Load root garden address from deployment
        address rootGarden = vm.envAddress("ROOT_GARDEN_ADDRESS");
        if (rootGarden == address(0)) {
            rootGarden = 0x1a48bB7b20eeEf4EbC8651F4E113136f0aacfCd4; // Arbitrum mainnet
        }

        console.log("Enabling open joining on root garden:", rootGarden);

        vm.startBroadcast();

        GardenAccount garden = GardenAccount(payable(rootGarden));
        garden.setOpenJoining(true);

        vm.stopBroadcast();

        console.log("Open joining enabled successfully!");
    }
}
