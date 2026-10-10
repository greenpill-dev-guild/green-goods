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
        string slug;
        string description;
        string location;
        string bannerImage;
        string metadata;
        bool openJoining;
    }

    /// @notice Initializes the GardenAccount with metadata and open joining configuration
    /// @param params Initialization parameters struct
    function initialize(InitParams calldata params) external;

    /// @notice Returns the name of the garden
    function name() external view returns (string memory);

    /// @notice Returns the Karma GAP project UID for this garden
    function getGAPProjectUID() external view returns (bytes32);

    /// @notice Returns the Karma GAP project UID for this garden
    /// @dev Alias for getGAPProjectUID() - storage variable direct access
    function gapProjectUID() external view returns (bytes32);

    /// @notice Returns the Karma access-sync implementation version.
    function karmaSyncVersion() external pure returns (uint32);

    /// @notice Reconciles one account's Karma project admin state from live Hats roles.
    /// @dev Callable only by the Karma module configured on the bound GardenToken.
    function syncKarmaProjectAccess(address account) external returns (bool roleActive, bool changed);

    function slug() external view returns (string memory);
    function description() external view returns (string memory);
    function location() external view returns (string memory);
    function bannerImage() external view returns (string memory);
}
