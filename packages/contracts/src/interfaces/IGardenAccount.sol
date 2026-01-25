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

    /// @notice Creates Karma GAP project impact for approved work
    /// @dev SECURITY: Only callable by WorkApprovalResolver (has onlyWorkApprovalResolver modifier)
    /// @param workTitle Action title from approved work
    /// @param impactDescription Approval feedback
    /// @param proofIPFS IPFS CID for evidence
    /// @param workUID The UID of the work attestation
    /// @return impactUID The impact attestation UID
    function createProjectImpact(
        string calldata workTitle,
        string calldata impactDescription,
        string calldata proofIPFS,
        bytes32 workUID
    )
        external
        returns (bytes32 impactUID);

    /// @notice Creates Karma GAP milestone for an assessment
    /// @dev SECURITY: Only callable by AssessmentResolver (has onlyAssessmentResolver modifier)
    /// @param milestoneTitle Assessment title
    /// @param milestoneDescription Assessment description
    /// @param milestoneMeta Additional metadata JSON from assessment
    /// @return milestoneUID The milestone attestation UID
    function createProjectMilestone(
        string calldata milestoneTitle,
        string calldata milestoneDescription,
        string calldata milestoneMeta
    )
        external
        returns (bytes32 milestoneUID);

    /// @notice Returns the name of the garden
    function name() external view returns (string memory);

    /// @notice Returns the Karma GAP project UID for this garden
    function getGAPProjectUID() external view returns (bytes32);

    /// @notice Returns the Karma GAP project UID for this garden
    /// @dev Alias for getGAPProjectUID() - storage variable direct access
    function gapProjectUID() external view returns (bytes32);
}
