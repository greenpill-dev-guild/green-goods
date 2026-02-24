// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IOctantStrategy } from "../interfaces/IOctantFactory.sol";

/// @title MockYDSStrategy
/// @notice Lightweight mock for YDS-like strategy behavior in tests
contract MockYDSStrategy is IOctantStrategy {
    address public donationAddress;
    uint256 public reportCount;
    uint256 public totalReportedAssets;
    uint256 public pendingYield;
    bool public shutdownTriggered;

    function simulateYield(uint256 amount) external {
        pendingYield += amount;
    }

    function report() external override returns (uint256 totalAssets) {
        unchecked {
            reportCount += 1;
        }
        totalReportedAssets += pendingYield;
        pendingYield = 0;
        return totalReportedAssets;
    }

    function setDonationAddress(address newDonationAddress) external override {
        donationAddress = newDonationAddress;
    }

    function shutdown() external override {
        shutdownTriggered = true;
    }
}

/// @title RevertingStrategy
/// @notice Mock strategy that can be configured to revert on specific calls
contract RevertingStrategy is IOctantStrategy {
    address public donationAddress;
    bool public shouldRevertReport;
    bool public shouldRevertSetDonation;
    bool public shouldRevertShutdown;

    function setRevertReport(bool _shouldRevert) external {
        shouldRevertReport = _shouldRevert;
    }

    function setRevertSetDonation(bool _shouldRevert) external {
        shouldRevertSetDonation = _shouldRevert;
    }

    function setRevertShutdown(bool _shouldRevert) external {
        shouldRevertShutdown = _shouldRevert;
    }

    function report() external override returns (uint256) {
        require(!shouldRevertReport, "report reverted");
        return 0;
    }

    function setDonationAddress(address newDonationAddress) external override {
        require(!shouldRevertSetDonation, "setDonationAddress reverted");
        donationAddress = newDonationAddress;
    }

    function shutdown() external override {
        require(!shouldRevertShutdown, "shutdown reverted");
    }
}
