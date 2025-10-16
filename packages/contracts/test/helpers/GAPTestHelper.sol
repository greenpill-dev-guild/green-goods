// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

/// @title GAPTestHelper
/// @notice Helper functions for testing Karma GAP integration
library GAPTestHelper {
    /// @notice Validates that a GAP project UID is valid (non-zero)
    /// @param projectUID The GAP project UID to validate
    /// @return True if valid, false otherwise
    function isValidProjectUID(bytes32 projectUID) internal pure returns (bool) {
        return projectUID != bytes32(0);
    }

    /// @notice Validates that a GAP milestone UID is valid (non-zero)
    /// @param milestoneUID The GAP milestone UID to validate
    /// @return True if valid, false otherwise
    function isValidMilestoneUID(bytes32 milestoneUID) internal pure returns (bool) {
        return milestoneUID != bytes32(0);
    }

    /// @notice Validates that a GAP impact UID is valid (non-zero)
    /// @param impactUID The GAP impact UID to validate
    /// @return True if valid, false otherwise
    function isValidImpactUID(bytes32 impactUID) internal pure returns (bool) {
        return impactUID != bytes32(0);
    }

    /// @notice Generates mock project data for testing
    /// @param name Project name
    /// @param description Project description
    /// @param location Project location
    /// @return Encoded project data
    function mockProjectData(
        string memory name,
        string memory description,
        string memory location
    )
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(name, description, location);
    }

    /// @notice Generates mock milestone data for testing
    /// @param title Milestone title
    /// @param description Milestone description
    /// @param startDate Start date
    /// @param endDate End date
    /// @return Encoded milestone data
    function mockMilestoneData(
        string memory title,
        string memory description,
        uint256 startDate,
        uint256 endDate
    )
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(title, description, startDate, endDate);
    }

    /// @notice Generates mock impact data for testing
    /// @param title Impact title
    /// @param description Impact description
    /// @param metrics Impact metrics JSON
    /// @return Encoded impact data
    function mockImpactData(
        string memory title,
        string memory description,
        string memory metrics
    )
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(title, description, metrics);
    }
}
