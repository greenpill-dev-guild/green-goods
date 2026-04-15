// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IGreenWillValidator
/// @notice Common interface for badge eligibility validators used by GreenWillRegistry
interface IGreenWillValidator {
    /// @notice Validates whether an account is eligible for a badge claim
    /// @param account The address attempting to claim or receive the badge
    /// @param claimData Arbitrary validator-specific proof data
    /// @return sourceRef Canonical source reference stored with the badge grant
    function validate(address account, bytes calldata claimData) external view returns (bytes32 sourceRef);
}
