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
