// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IGardenAccount
/// @notice Interface for Garden token-bound accounts
/// @dev Abstracts GardenAccount implementation to allow core contracts to compile without via_ir
///
/// **Architecture (Post-Modularization):**
/// - Core contracts (GardenToken, resolvers) use this interface
/// - GardenAccount implementation compiles separately with via_ir=true
/// - GAP integration moved to KarmaGAPModule
/// - Role management can use GardenHatsModule or built-in mappings
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

    /// @notice Returns the description of the garden
    function description() external view returns (string memory);

    /// @notice Returns the location of the garden
    function location() external view returns (string memory);

    /// @notice Returns the banner image CID
    function bannerImage() external view returns (string memory);

    /// @notice Returns the metadata IPFS CID
    function metadata() external view returns (string memory);

    /// @notice Returns the community token address
    function communityToken() external view returns (address);

    /// @notice Returns whether open joining is enabled
    function openJoining() external view returns (bool);
}
