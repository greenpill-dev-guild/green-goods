// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { CeloSettlementExecution } from "./Execution.sol";

/// @title CeloSettlementViews
/// @notice Read-only surface over routes, results, peer, period spend, and the fee reserve.
abstract contract CeloSettlementViews is CeloSettlementExecution {
    function gardenRouteOf(address garden) external view override returns (GardenRoute memory) {
        return _gardenRoutes[garden];
    }

    function executionResultOf(bytes32 executionKey) external view override returns (ExecutionResult memory) {
        return _executionResults[executionKey];
    }

    function sourcePeer() external view override returns (SourcePeer memory) {
        return _sourcePeer;
    }

    function gardenPeriodSpend(address garden) external view override returns (GardenPeriodSpend memory) {
        return _gardenPeriodSpends[garden];
    }

    function nativeFeeBalance() external view override returns (uint256) {
        return address(this).balance;
    }

    function isAcknowledgmentFeeReserveLow() external view override returns (bool) {
        return address(this).balance < acknowledgmentFeeReserveMinimum;
    }

    function HARD_MAX_BATCH_SIZE() external pure override returns (uint256) {
        return _HARD_MAX_BATCH_SIZE;
    }
}
