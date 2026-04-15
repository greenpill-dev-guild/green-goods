// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IGreenWillRegistry
/// @notice Minimal interface used by GreenWill support routing and other badge issuers
interface IGreenWillRegistry {
    /// @notice Returns whether an account already owns a given badge
    /// @param badgeId The badge identifier
    /// @param account The address to query
    /// @return True if the badge has been issued to the account
    function hasBadge(bytes32 badgeId, address account) external view returns (bool);

    /// @notice Issues a badge from a configured authorized issuer
    /// @param badgeId The badge identifier
    /// @param account The recipient address
    /// @param sourceRef Canonical source reference for the issuance
    /// @return tokenId Optional Unlock token id minted as part of the issuance
    function issueByAuthorizedIssuer(
        bytes32 badgeId,
        address account,
        bytes32 sourceRef
    )
        external
        returns (uint256 tokenId);
}
