// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IKarmaGAPModule
/// @notice Interface for the Karma GAP Module that manages GAP projects for gardens
/// @dev This module extracts GAP attestation logic from GardenAccount for modularity
interface IKarmaGAPModule {
    enum KarmaSyncOperation {
        Project,
        Details,
        Membership,
        Access,
        ProjectUpdate
    }

    enum KarmaSyncOutcome {
        Noop,
        Succeeded,
        Failed
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Emitted when a GAP project is created for a garden
    /// @param projectUID The Karma GAP project attestation UID
    /// @param garden The garden address
    /// @param projectName The name of the GAP project
    event GAPProjectCreated(bytes32 indexed projectUID, address indexed garden, string projectName);

    /// @notice Emitted when an admin is added to a GAP project
    /// @param projectUID The project UID
    /// @param admin The admin address added
    event GAPProjectAdminAdded(bytes32 indexed projectUID, address indexed admin);

    /// @notice Emitted when an admin is removed from a GAP project
    /// @param projectUID The project UID
    /// @param admin The admin address removed
    event GAPProjectAdminRemoved(bytes32 indexed projectUID, address indexed admin);

    /// @notice Emitted when a GAP impact is created (work approval)
    /// @param projectUID The project UID
    /// @param impactUID The impact attestation UID
    /// @param workUID The work attestation UID
    event GAPImpactCreated(bytes32 indexed projectUID, bytes32 indexed impactUID, bytes32 workUID);

    /// @notice Emitted when a GAP milestone is created (assessment)
    /// @param projectUID The project UID
    /// @param milestoneUID The milestone attestation UID
    /// @param title The milestone title
    event GAPMilestoneCreated(bytes32 indexed projectUID, bytes32 indexed milestoneUID, string title);

    /// @notice Emitted when a GAP operation fails gracefully
    /// @param garden The garden address
    /// @param operation The operation that failed
    /// @param reason The failure reason
    event GAPOperationFailed(address indexed garden, string operation, string reason);

    /// @notice Records the final result of one Karma synchronization attempt.
    event KarmaSyncRecorded(
        address indexed garden,
        bytes32 indexed projectUID,
        address indexed account,
        KarmaSyncOperation operation,
        KarmaSyncOutcome outcome,
        bytes32 sourceUID,
        bytes32 resultUID,
        string reason
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════════════════

    error ZeroAddress();
    error NotGardenToken();
    error NotWorkApprovalResolver();
    error NotAssessmentResolver();
    error NotAuthorizedCaller();
    error ProjectAlreadyExists(address garden);
    error ProjectNotFound(address garden);
    error GAPNotSupported();
    error InvalidGarden(address garden);
    error ProjectUpdateMigrationAlreadyComplete();
    error ProjectUpdateMigrationLengthMismatch();
    error InvalidProjectUpdateMigrationEntry(uint256 index);
    error ProjectUpdateMigrationConflict(bytes32 workUID, bytes32 existingUID, bytes32 suppliedUID);

    /// @notice Emitted after legacy Project Update UIDs have been restored during a proxy upgrade.
    event ProjectUpdateMigrationCompleted(uint256 seededCount);

    // ═══════════════════════════════════════════════════════════════════════════
    // Project Management
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Creates a GAP project for a garden
    /// @dev Called by GardenToken during garden minting
    /// @param garden The garden address
    /// @param operator The primary operator address
    /// @param name The project name
    /// @param description The project description
    /// @param location The project location
    /// @param bannerImage The banner image CID
    /// @return projectUID The created project UID (bytes32(0) if creation failed gracefully)
    function createProject(
        address garden,
        address operator,
        string calldata name,
        string calldata description,
        string calldata location,
        string calldata bannerImage
    )
        external
        returns (bytes32 projectUID);

    /// @notice Adds an admin to a garden's GAP project
    /// @dev Called when an operator is added to the garden
    /// @param garden The garden address
    /// @param admin The admin address to add
    function addProjectAdmin(address garden, address admin) external;

    /// @notice Removes an admin from a garden's GAP project
    /// @dev Called when an operator is removed from the garden
    /// @param garden The garden address
    /// @param admin The admin address to remove
    function removeProjectAdmin(address garden, address admin) external;

    /// @notice Creates a missing project and reconciles changed public details.
    function reconcileProject(address garden) external returns (bytes32 projectUID);

    /// @notice Reconciles historical membership and current admin access for one account.
    function reconcileProjectAccess(address garden, address account) external returns (bool roleActive, bool changed);

    /// @notice Restores legacy Work-to-Project-Update UID pairs before Project Update creation is enabled.
    function migrateProjectUpdates(bytes32[] calldata workUIDs, bytes32[] calldata updateUIDs) external;

    // ═══════════════════════════════════════════════════════════════════════════
    // Impact & Milestone Creation
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Creates a GAP impact for approved work
    /// @dev Called by WorkApprovalResolver when work is approved
    /// @param garden The garden address
    /// @param tokenId The garden token ID
    /// @param workTitle The work title
    /// @param impactDescription The impact description
    /// @param proofIPFS The IPFS CID for evidence
    /// @param workUID The work attestation UID
    /// @param metadataCID The IPFS CID for structured work metadata (domain-specific indicators)
    /// @return impactUID The created impact UID (bytes32(0) if creation failed gracefully)
    function createImpact(
        address garden,
        uint256 tokenId,
        string calldata workTitle,
        string calldata impactDescription,
        string calldata proofIPFS,
        bytes32 workUID,
        string calldata metadataCID
    )
        external
        returns (bytes32 impactUID);

    /// @notice Creates an idempotent Project Update for approved Work.
    function createProjectUpdate(
        address garden,
        string calldata workTitle,
        string calldata updateText,
        string calldata proofReference,
        bytes32 workUID,
        string calldata metadataReference
    )
        external
        returns (bytes32 updateUID);

    /// @notice Creates a GAP milestone for an assessment
    /// @dev Called by AssessmentResolver when assessment is created
    /// @param garden The garden address
    /// @param milestoneTitle The milestone title
    /// @param milestoneDescription The milestone description
    /// @param startDate Assessment start date (unix timestamp)
    /// @param endDate Assessment end date (unix timestamp)
    /// @param domain Domain enum (0=SOLAR, 1=AGRO, 2=EDU, 3=WASTE)
    /// @param location Assessment location
    /// @param assessmentConfigCID IPFS CID for the full assessment configuration
    /// @return milestoneUID The created milestone UID (bytes32(0) if creation failed gracefully)
    function createMilestone(
        address garden,
        string calldata milestoneTitle,
        string calldata milestoneDescription,
        uint256 startDate,
        uint256 endDate,
        uint8 domain,
        string calldata location,
        string calldata assessmentConfigCID
    )
        external
        returns (bytes32 milestoneUID);

    // ═══════════════════════════════════════════════════════════════════════════
    // View Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Returns the GAP project UID for a garden
    /// @param garden The garden address
    /// @return The project UID (bytes32(0) if no project)
    function getProjectUID(address garden) external view returns (bytes32);

    /// @notice Whether the legacy Project Update migration boundary has been completed.
    function projectUpdateMigrationComplete() external view returns (bool);

    /// @notice Checks if GAP is supported on the current chain
    /// @return True if GAP is supported
    function isSupported() external view returns (bool);
}
