// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IOctantStrategy } from "../interfaces/IOctantFactory.sol";

/// @notice Authorized one-shot callback probe; rejected inner calls must not revert the outer operation.
contract ReentrantStrategy is IOctantStrategy {
    enum AttackVector {
        None,
        ReenterHarvest,
        ReenterEmergencyPause,
        ReenterSetDonationAddress,
        ReenterResumeVault
    }

    address public target;
    address public attackGarden;
    address public asset;
    address public vault;
    AttackVector public attackVector;
    address public donationAddress;
    bool public attempted;
    bool public callbackSucceeded;
    bytes public callbackResult;
    bool public depositsPaused;
    uint256 public reports;

    function configure(address _target, address _garden, address _asset, AttackVector _vector) external {
        target = _target;
        attackGarden = _garden;
        asset = _asset;
        attackVector = _vector;
        attempted = false;
        callbackSucceeded = false;
        delete callbackResult;
    }

    function setVault(address value) external {
        vault = value;
    }

    function report() external override returns (uint256) {
        reports++;
        if (attackVector == AttackVector.ReenterHarvest || attackVector == AttackVector.ReenterEmergencyPause) {
            _attempt();
        }
        return 0;
    }

    function setDonationAddress(address value) external override {
        donationAddress = value;
        if (attackVector == AttackVector.ReenterSetDonationAddress || attackVector == AttackVector.ReenterResumeVault) {
            _attempt();
        }
    }

    function shutdown() external override {
        depositsPaused = true;
        if (attackVector == AttackVector.ReenterEmergencyPause) _attempt();
    }

    function _attempt() private {
        if (attempted) return;
        // Set before the call so removing a guard cannot turn rejection into recursive out-of-gas.
        attempted = true;
        bytes memory callData;
        if (attackVector == AttackVector.ReenterHarvest) {
            callData = abi.encodeWithSignature("harvest(address,address)", attackGarden, asset);
        } else if (attackVector == AttackVector.ReenterEmergencyPause) {
            callData = abi.encodeWithSignature("emergencyPause(address,address)", attackGarden, asset);
        } else if (attackVector == AttackVector.ReenterSetDonationAddress) {
            callData = abi.encodeWithSignature("setDonationAddress(address,address)", attackGarden, address(0xDEAD));
        } else if (attackVector == AttackVector.ReenterResumeVault) {
            callData = abi.encodeWithSignature("resumeVault(address,address,address)", attackGarden, asset, address(this));
        }
        (callbackSucceeded, callbackResult) = target.call(callData);
    }
}
