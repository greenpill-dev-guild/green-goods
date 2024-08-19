// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.25;

/// @title IERC6551Registry
/// @notice Interface for the ERC-6551 Token Bound Account Registry.
/// @dev This interface defines the standard functions and events for interacting with the registry.
interface IERC6551Registry {
    /// @notice Emitted when a new TBA (Token Bound Account) is created.
    /// @param account The address of the newly created TBA account.
    /// @param implementation The address of the TBA implementation contract.
    /// @param chainId The ID of the blockchain where the account is created.
    /// @param tokenContract The address of the token contract associated with the TBA.
    /// @param tokenId The ID of the token associated with the TBA.
    /// @param salt A salt used in the creation of the TBA account.
    event AccountCreated(
        address indexed account,
        address indexed implementation,
        uint256 indexed chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt
    );

    /// @notice Creates a new TBA account.
    /// @param implementation The address of the TBA implementation contract.
    /// @param chainId The ID of the blockchain where the account is to be created.
    /// @param tokenContract The address of the token contract associated with the TBA.
    /// @param tokenId The ID of the token associated with the TBA.
    /// @param salt A salt used to create a unique TBA account.
    /// @param initData Initialization data passed to the TBA contract upon creation.
    /// @return The address of the newly created TBA account.
    function createAccount(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt,
        bytes calldata initData
    ) external returns (address);

    /// @notice Retrieves the TBA account associated with the given parameters.
    /// @param implementation The address of the TBA implementation contract.
    /// @param chainId The ID of the blockchain where the account was created.
    /// @param tokenContract The address of the token contract associated with the TBA.
    /// @param tokenId The ID of the token associated with the TBA.
    /// @param salt A salt used in the creation of the TBA account.
    /// @return The address of the TBA account.
    function account(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt
    ) external view returns (address);
}
