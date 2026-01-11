// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IHats
/// @notice Minimal interface for Hats Protocol v1
/// @dev Only includes functions needed for Green Goods access control
///
/// Hats Protocol: https://docs.hatsprotocol.xyz/
/// Full interface: https://docs.hatsprotocol.xyz/for-developers/v1-protocol-spec/interfaces/ihats.sol
interface IHats {
    /// @notice Check if an account is wearing a hat
    /// @dev Returns true if:
    ///   1. Account holds a balance of the hat's token
    ///   2. The hat is active
    ///   3. The account is eligible to wear the hat
    /// @param _user The address to check
    /// @param _hatId The hat ID to check
    /// @return isWearer True if the account is wearing the hat
    function isWearerOfHat(address _user, uint256 _hatId) external view returns (bool isWearer);

    /// @notice Check if a hat is active
    /// @param _hatId The hat ID to check
    /// @return active True if the hat is active
    function isActive(uint256 _hatId) external view returns (bool active);

    /// @notice Get the image URI for a hat
    /// @param _hatId The hat ID
    /// @return imageUri The image URI
    function getHatImageUri(uint256 _hatId) external view returns (string memory imageUri);

    /// @notice Mint a hat to an account
    /// @dev Caller must be an admin of the hat
    /// @param _hatId The hat ID to mint
    /// @param _wearer The account to mint to
    /// @return success True if minting succeeded
    function mintHat(uint256 _hatId, address _wearer) external returns (bool success);

    /// @notice Transfer a hat from one account to another
    /// @dev Caller must be an admin of the hat
    /// @param _hatId The hat ID to transfer
    /// @param _from The current wearer
    /// @param _to The new wearer
    function transferHat(uint256 _hatId, address _from, address _to) external;
}
