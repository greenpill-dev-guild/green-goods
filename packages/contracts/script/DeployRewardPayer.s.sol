// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script } from "forge-std/Script.sol";
import { RewardPayer } from "../src/modules/RewardPayer.sol";

/// @notice Standalone reward payer deployment; it has no owner, roles or funds to configure afterwards.
contract DeployRewardPayer is Script {
    error DeploymentInputsChanged();

    function run() external returns (RewardPayer payer) {
        address sender = vm.envAddress("REWARD_PAYER_SENDER");
        if (block.chainid != vm.envUint("REWARD_PAYER_CHAIN_ID") || vm.getNonce(sender) != vm.envUint("REWARD_PAYER_NONCE"))
        {
            revert DeploymentInputsChanged();
        }
        vm.startBroadcast(sender);
        payer = new RewardPayer();
        vm.stopBroadcast();
        if (
            address(payer) != vm.envAddress("REWARD_PAYER_ADDRESS")
                || address(payer).codehash != vm.envBytes32("REWARD_PAYER_RUNTIME_HASH")
        ) {
            revert DeploymentInputsChanged();
        }
    }
}
