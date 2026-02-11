// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IOctantStrategy } from "../interfaces/IOctantFactory.sol";

/// @title ReentrantStrategy
/// @notice Malicious strategy mock that re-enters OctantModule during callbacks
/// @dev Used to verify reentrancy protection on harvest(), emergencyPause(), setDonationAddress()
contract ReentrantStrategy is IOctantStrategy {
    enum AttackVector {
        None,
        ReenterHarvest,
        ReenterEmergencyPause,
        ReenterSetDonationAddress
    }

    address public target;
    address public attackGarden;
    address public attackAsset;
    AttackVector public attackVector;
    address public donationAddress;

    function configure(address _target, address _garden, address _asset, AttackVector _vector) external {
        target = _target;
        attackGarden = _garden;
        attackAsset = _asset;
        attackVector = _vector;
    }

    function report() external override returns (uint256) {
        if (attackVector == AttackVector.ReenterHarvest) {
            // Re-enter harvest during report callback
            (bool success,) = target.call(abi.encodeWithSignature("harvest(address,address)", attackGarden, attackAsset));
            // success will be false if reentrancy guard blocks it
            if (!success) revert("reentrancy blocked");
        } else if (attackVector == AttackVector.ReenterEmergencyPause) {
            // Cross-function attack: re-enter emergencyPause during harvest's report callback
            (bool success,) =
                target.call(abi.encodeWithSignature("emergencyPause(address,address)", attackGarden, attackAsset));
            if (!success) revert("reentrancy blocked");
        }
        return 0;
    }

    function setDonationAddress(address newDonationAddress) external override {
        donationAddress = newDonationAddress;
        if (attackVector == AttackVector.ReenterSetDonationAddress) {
            (bool success,) =
                target.call(abi.encodeWithSignature("setDonationAddress(address,address)", attackGarden, address(0xDEAD)));
            if (!success) revert("reentrancy blocked");
        }
    }

    function shutdown() external override {
        if (attackVector == AttackVector.ReenterEmergencyPause) {
            (bool success,) =
                target.call(abi.encodeWithSignature("emergencyPause(address,address)", attackGarden, attackAsset));
            if (!success) revert("reentrancy blocked");
        }
    }
}
