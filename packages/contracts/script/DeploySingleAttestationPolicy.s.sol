// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script } from "forge-std/Script.sol";
import { SingleAttestationPolicy } from "../src/modules/SingleAttestationPolicy.sol";

/// @notice Standalone policy deployment; installation into a Kernel account is a separate owner action.
contract DeploySingleAttestationPolicy is Script {
    error DeploymentInputsChanged();

    function run() external returns (SingleAttestationPolicy policy) {
        address sender = vm.envAddress("SINGLE_ATTESTATION_POLICY_SENDER");
        if (
            block.chainid != vm.envUint("SINGLE_ATTESTATION_POLICY_CHAIN_ID")
                || vm.getNonce(sender) != vm.envUint("SINGLE_ATTESTATION_POLICY_NONCE")
        ) {
            revert DeploymentInputsChanged();
        }
        vm.startBroadcast(sender);
        policy = new SingleAttestationPolicy();
        vm.stopBroadcast();
        if (
            address(policy) != vm.envAddress("SINGLE_ATTESTATION_POLICY_ADDRESS")
                || address(policy).codehash != vm.envBytes32("SINGLE_ATTESTATION_POLICY_RUNTIME_HASH")
        ) {
            revert DeploymentInputsChanged();
        }
    }
}
