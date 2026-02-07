// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IGardenAccount
/// @notice Interface for Garden token-bound accounts
/// @dev Abstracts GardenAccount implementation to allow core contracts to compile without via_ir
///
/// **Architecture:**
/// - Core contracts (GardenToken, resolvers) use this interface
/// - GardenAccount implementation compiles separately with via_ir=true
/// - Enables fast iteration on core contracts without tokenbound library overhead
///
/// **Implementers:**
/// - GardenAccount (token-bound account for gardens)
interface IGardenAccount {
    /// @notice Parameters for initializing a garden account
    struct InitParams {
        address communityToken;
        string name;
        string description;
        string location;
        string bannerImage;
        string metadata;
        bool openJoining;
        address[] gardeners;
        address[] gardenOperators;
    }

    /// @notice Initializes the GardenAccount with initial gardeners and operators
    /// @param params Initialization parameters struct
    function initialize(InitParams calldata params) external;

    /// @notice Returns the name of the garden
    function name() external view returns (string memory);

    /// @notice Returns the Karma GAP project UID for this garden
    function getGAPProjectUID() external view returns (bytes32);

    /// @notice Returns the Karma GAP project UID for this garden
    /// @dev Alias for getGAPProjectUID() - storage variable direct access
    function gapProjectUID() external view returns (bytes32);
}
