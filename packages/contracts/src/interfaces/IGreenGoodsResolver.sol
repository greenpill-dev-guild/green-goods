// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IGreenGoodsResolver
/// @notice Interface for the integration resolver that fans out to protocol modules
/// @dev Called by other resolvers after successful attestation validation
///
/// **Design Principles:**
/// - Resolvers call this resolver AFTER validation succeeds
/// - Uses try/catch internally — integration failures never block attestations
/// - Each module is isolated — one failure doesn't affect others
/// - Emits events for observability even on partial failures
///
/// **Execution Flow:**
/// 1. Resolver validates attestation (identity, action, etc.)
/// 2. Resolver calls greenGoodsResolver.onWorkApproved() / onAssessmentCreated()
/// 3. Resolver iterates enabled modules with try/catch
/// 4. Attestation succeeds regardless of module outcomes
interface IGreenGoodsResolver {
    /// @notice Called when work is approved
    /// @dev Called by WorkApprovalResolver after validation
    /// @param garden The garden account address
    /// @param workUID The UID of the work attestation
    /// @param approvalUID The UID of the approval attestation
    /// @param actionUID The action UID from the work
    /// @param worker The gardener who submitted the work
    /// @param attester The operator who approved
    /// @param feedback The approval feedback text
    /// @param mediaIPFS First media IPFS CID from work (for proof)
    function onWorkApproved(
        address garden,
        bytes32 workUID,
        bytes32 approvalUID,
        bytes32 actionUID,
        address worker,
        address attester,
        string calldata feedback,
        string calldata mediaIPFS
    )
        external;

    /// @notice Called when an assessment is created
    /// @dev Called by AssessmentResolver after validation
    /// @param garden The garden account address
    /// @param assessmentUID The UID of the assessment attestation
    /// @param attester The operator who created the assessment
    /// @param title Assessment title
    /// @param description Assessment description
    /// @param capitals Array of capital types
    /// @param assessmentType Type of assessment
    function onAssessmentCreated(
        address garden,
        bytes32 assessmentUID,
        address attester,
        string calldata title,
        string calldata description,
        string[] calldata capitals,
        string calldata assessmentType
    )
        external;

    /// @notice Check if a specific module is enabled
    /// @param moduleId The module identifier (e.g., keccak256("GAP"), keccak256("OCTANT"))
    /// @return True if the module is enabled
    function isModuleEnabled(bytes32 moduleId) external view returns (bool);
}
