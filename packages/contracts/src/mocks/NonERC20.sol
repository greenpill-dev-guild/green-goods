// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title MockNonERC20
/// @notice Mock non-ERC-20 contract for testing invalid token scenarios
contract MockNonERC20 {
    function someFunction() external pure returns (uint256) {
        return 42;
    }
}
