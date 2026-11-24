// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

import { ICommitmentPoolingModule } from "../interfaces/ICommitmentPoolingModule.sol";

/// @notice Exact amounts from the core's already validated complete recognition snapshot.
library VoucherRecognitionAllocation {
    /// @dev Largest fractional remainder of the canonical weights; ties use ascending addresses
    ///      already proved by the core. Retain zero rows so the complete recognition set is visible.
    function allocate(
        ICommitmentPoolingModule.RecognitionEntry[] calldata entries,
        uint256 total
    )
        internal
        pure
        returns (address[] memory recipients, uint256[] memory amounts)
    {
        uint256 rows = entries.length;
        recipients = new address[](rows);
        amounts = new uint256[](rows);
        uint256[] memory remainders = new uint256[](rows);
        uint256 assigned;
        for (uint256 i = 0; i < rows; i++) {
            recipients[i] = entries[i].contributor;
            amounts[i] = Math.mulDiv(total, entries[i].recognitionWeightBps, 10_000);
            remainders[i] = mulmod(total, entries[i].recognitionWeightBps, 10_000);
            assigned += amounts[i];
        }
        uint256 remaining = total - assigned;
        for (uint256 i = 0; i < rows; i++) {
            uint256 rank;
            for (uint256 j = 0; j < rows; j++) {
                if (remainders[j] > remainders[i] || (remainders[j] == remainders[i] && j < i)) rank++;
            }
            if (rank < remaining) amounts[i]++;
        }
    }
}
