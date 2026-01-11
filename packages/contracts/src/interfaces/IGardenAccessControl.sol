// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IGardenAccessControl
/// @notice Interface for garden role verification
/// @dev Abstracts role checks to allow swapping implementations (mappings → Hats → etc.)
///
/// **Current Implementation:** GardenAccount uses internal mappings
/// **Future Implementation:** HatsAccessControlAdapter for Hats Protocol integration
///
/// Resolvers and modules MUST use this interface instead of reading mappings directly.
/// This enables:
/// - Swapping access control backends without changing resolvers
/// - Adding role caching or batching
/// - Integrating with external permission systems (Hats, etc.)
interface IGardenAccessControl {
    /// @notice Check if an address is a gardener of this garden
    /// @param account The address to check
    /// @return True if the account is a gardener
    function isGardener(address account) external view returns (bool);

    /// @notice Check if an address is an operator of this garden
    /// @param account The address to check
    /// @return True if the account is an operator
    function isOperator(address account) external view returns (bool);

    /// @notice Check if an address is the owner of this garden
    /// @param account The address to check
    /// @return True if the account is the owner
    function isOwner(address account) external view returns (bool);
}
