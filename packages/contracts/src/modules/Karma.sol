// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { AttestationRequest, AttestationRequestData } from "@eas/IEAS.sol";

import { KarmaLib } from "../lib/Karma.sol";
import { JsonBuilder } from "../lib/JsonBuilder.sol";
import { IGap } from "../interfaces/IKarma.sol";
import { IKarmaGAPModule } from "../interfaces/IKarmaGAPModule.sol";

/// @title KarmaGAPModule
/// @notice Manages Karma GAP projects for Green Goods gardens
/// @dev Extracts GAP attestation logic from GardenAccount for modularity and reduced contract size
///
/// **Architecture:**
/// - Singleton module deployed once per chain
/// - Called by GardenToken during garden minting to create GAP projects
/// - Called by resolvers to create impacts (work approval) and milestones (assessments)
/// - Graceful degradation: GAP failures don't block garden operations
///
/// **Security:**
/// - Only GardenToken can create projects
/// - Only WorkApprovalResolver can create impacts
/// - Only AssessmentResolver can create milestones
/// - Authorized callers configurable by owner
contract KarmaGAPModule is IKarmaGAPModule, OwnableUpgradeable, UUPSUpgradeable {
    // ═══════════════════════════════════════════════════════════════════════════
    // Storage
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice GardenToken contract address
    address public gardenToken;

    /// @notice WorkApprovalResolver contract address
    address public workApprovalResolver;

    /// @notice AssessmentResolver contract address
    address public assessmentResolver;

    /// @notice HatsModule contract address (authorized to sync project admins)
    address public hatsModule;

    /// @notice Garden address → GAP Project UID
    mapping(address garden => bytes32 projectUID) public gardenProjects;

    /// @notice Storage gap for future upgrades
    uint256[45] private __gap;

    // ═══════════════════════════════════════════════════════════════════════════
    // Constructor & Initializer
    // ═══════════════════════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the module
    /// @param _owner The owner address
    /// @param _gardenToken The GardenToken contract address
    /// @param _workApprovalResolver The WorkApprovalResolver contract address
    /// @param _assessmentResolver The AssessmentResolver contract address
    function initialize(
        address _owner,
        address _gardenToken,
        address _workApprovalResolver,
        address _assessmentResolver
    )
        external
        initializer
    {
        if (_owner == address(0)) revert ZeroAddress();
        if (_gardenToken == address(0)) revert ZeroAddress();
        // Resolvers can be zero initially and set later

        __Ownable_init();
        _transferOwnership(_owner);

        gardenToken = _gardenToken;
        workApprovalResolver = _workApprovalResolver;
        assessmentResolver = _assessmentResolver;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Modifiers
    // ═══════════════════════════════════════════════════════════════════════════

    modifier onlyGardenToken() {
        if (msg.sender != gardenToken) revert NotGardenToken();
        _;
    }

    modifier onlyWorkApprovalResolver() {
        if (msg.sender != workApprovalResolver) revert NotWorkApprovalResolver();
        _;
    }

    modifier onlyAssessmentResolver() {
        if (msg.sender != assessmentResolver) revert NotAssessmentResolver();
        _;
    }

    modifier onlyAuthorized() {
        if (
            msg.sender != gardenToken && msg.sender != workApprovalResolver && msg.sender != assessmentResolver
                && msg.sender != hatsModule
        ) {
            revert NotAuthorizedCaller();
        }
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Admin Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Set the GardenToken contract address
    /// @param _gardenToken The new GardenToken address
    function setGardenToken(address _gardenToken) external onlyOwner {
        if (_gardenToken == address(0)) revert ZeroAddress();
        gardenToken = _gardenToken;
    }

    /// @notice Set the WorkApprovalResolver contract address
    /// @param _workApprovalResolver The new WorkApprovalResolver address
    function setWorkApprovalResolver(address _workApprovalResolver) external onlyOwner {
        workApprovalResolver = _workApprovalResolver;
    }

    /// @notice Set the AssessmentResolver contract address
    /// @param _assessmentResolver The new AssessmentResolver address
    function setAssessmentResolver(address _assessmentResolver) external onlyOwner {
        assessmentResolver = _assessmentResolver;
    }

    /// @notice Set the HatsModule contract address
    /// @param _hatsModule The new HatsModule address
    function setHatsModule(address _hatsModule) external onlyOwner {
        if (_hatsModule == address(0)) revert ZeroAddress();
        hatsModule = _hatsModule;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Project Management
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IKarmaGAPModule
    function createProject(
        address garden,
        address operator,
        string calldata name,
        string calldata description,
        string calldata location,
        string calldata bannerImage
    )
        external
        onlyGardenToken
        returns (bytes32 projectUID)
    {
        // Skip if GAP not supported on this chain
        if (!KarmaLib.isSupported()) {
            emit GAPOperationFailed(garden, "createProject", "Chain not supported");
            return bytes32(0);
        }

        // Check if project already exists
        if (gardenProjects[garden] != bytes32(0)) {
            revert ProjectAlreadyExists(garden);
        }

        IGap gap = IGap(KarmaLib.getGapContract());

        // 1. Create Project attestation
        {
            AttestationRequestData memory reqData = AttestationRequestData({
                recipient: garden,
                expirationTime: 0,
                revocable: true,
                refUID: bytes32(0),
                data: abi.encode(true),
                value: 0
            });

            AttestationRequest memory req = AttestationRequest({ schema: KarmaLib.getProjectSchemaUID(), data: reqData });

            try gap.attest(req) returns (bytes32 uid) {
                projectUID = uid;
            } catch {
                emit GAPOperationFailed(garden, "createProject", "Project attestation failed");
                return bytes32(0);
            }
        }

        // 2. Create MemberOf attestation for operator
        {
            AttestationRequestData memory reqData = AttestationRequestData({
                recipient: operator,
                expirationTime: 0,
                revocable: true,
                refUID: projectUID,
                data: abi.encode(true),
                value: 0
            });

            AttestationRequest memory req = AttestationRequest({ schema: KarmaLib.getMemberOfSchemaUID(), data: reqData });

            try gap.attest(req) {
                // Success - continue to details
            } catch {
                emit GAPOperationFailed(garden, "createProject", "MemberOf attestation failed");
                return bytes32(0);
            }
        }

        // 3. Create Details attestation
        {
            string memory detailsJson = JsonBuilder.buildProjectDetails(name, description, location, bannerImage);

            AttestationRequestData memory reqData = AttestationRequestData({
                recipient: garden,
                expirationTime: 0,
                revocable: true,
                refUID: projectUID,
                data: abi.encode(detailsJson),
                value: 0
            });

            AttestationRequest memory req = AttestationRequest({ schema: KarmaLib.getDetailsSchemaUID(), data: reqData });

            try gap.attest(req) {
                // Success - finalize below
            } catch {
                emit GAPOperationFailed(garden, "createProject", "Details attestation failed");
                return bytes32(0);
            }
        }

        gardenProjects[garden] = projectUID;
        emit GAPProjectCreated(projectUID, garden, name);

        return projectUID;
    }

    /// @inheritdoc IKarmaGAPModule
    function addProjectAdmin(address garden, address admin) external onlyAuthorized {
        bytes32 projectUID = gardenProjects[garden];
        if (projectUID == bytes32(0)) return; // No project, skip silently
        if (!KarmaLib.isSupported()) return;

        try IGap(KarmaLib.getGapContract()).addProjectAdmin(projectUID, admin) {
            emit GAPProjectAdminAdded(projectUID, admin);
        } catch {
            emit GAPOperationFailed(garden, "addProjectAdmin", "Failed to add admin");
        }
    }

    /// @inheritdoc IKarmaGAPModule
    function removeProjectAdmin(address garden, address admin) external onlyAuthorized {
        bytes32 projectUID = gardenProjects[garden];
        if (projectUID == bytes32(0)) return; // No project, skip silently
        if (!KarmaLib.isSupported()) return;

        try IGap(KarmaLib.getGapContract()).removeProjectAdmin(projectUID, admin) {
            emit GAPProjectAdminRemoved(projectUID, admin);
        } catch {
            emit GAPOperationFailed(garden, "removeProjectAdmin", "Failed to remove admin");
        }
    }

    /// @notice Emitted when a GAP project mapping is reset
    event GAPProjectReset(address indexed garden, bytes32 indexed previousUID);

    /// @notice Reset a garden's GAP project mapping for recovery
    /// @dev Allows re-creating a GAP project if the original attestation is orphaned
    /// @param garden The garden address to reset
    function resetProject(address garden) external onlyOwner {
        bytes32 prev = gardenProjects[garden];
        if (prev == bytes32(0)) return; // No-op if no project
        delete gardenProjects[garden];
        emit GAPProjectReset(garden, prev);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Impact & Milestone Creation
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IKarmaGAPModule
    function createImpact(
        address garden,
        uint256, /*tokenId*/
        string calldata workTitle,
        string calldata impactDescription,
        string calldata proofIPFS,
        bytes32 workUID
    )
        external
        onlyWorkApprovalResolver
        returns (bytes32 impactUID)
    {
        bytes32 projectUID = gardenProjects[garden];
        if (projectUID == bytes32(0)) {
            emit GAPOperationFailed(garden, "createImpact", "No project");
            return bytes32(0);
        }
        if (!KarmaLib.isSupported()) {
            emit GAPOperationFailed(garden, "createImpact", "Chain not supported");
            return bytes32(0);
        }

        string memory impactJson =
            JsonBuilder.buildImpact(workTitle, impactDescription, proofIPFS, workUID, garden, block.timestamp);

        AttestationRequestData memory reqData = AttestationRequestData({
            recipient: garden,
            expirationTime: 0,
            revocable: false,
            refUID: projectUID,
            data: abi.encode(impactJson),
            value: 0
        });

        AttestationRequest memory req = AttestationRequest({ schema: KarmaLib.getDetailsSchemaUID(), data: reqData });

        try IGap(KarmaLib.getGapContract()).attest(req) returns (bytes32 uid) {
            impactUID = uid;
            emit GAPImpactCreated(projectUID, impactUID, workUID);
        } catch {
            emit GAPOperationFailed(garden, "createImpact", "Attestation failed");
            return bytes32(0);
        }
    }

    /// @inheritdoc IKarmaGAPModule
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
        onlyAssessmentResolver
        returns (bytes32 milestoneUID)
    {
        bytes32 projectUID = gardenProjects[garden];
        if (projectUID == bytes32(0)) {
            emit GAPOperationFailed(garden, "createMilestone", "No project");
            return bytes32(0);
        }
        if (!KarmaLib.isSupported()) {
            emit GAPOperationFailed(garden, "createMilestone", "Chain not supported");
            return bytes32(0);
        }

        string memory milestoneJson = JsonBuilder.buildMilestone(
            milestoneTitle, milestoneDescription, startDate, endDate, domain, location, assessmentConfigCID
        );

        AttestationRequestData memory reqData = AttestationRequestData({
            recipient: garden,
            expirationTime: 0,
            revocable: false,
            refUID: projectUID,
            data: abi.encode(milestoneJson),
            value: 0
        });

        AttestationRequest memory req = AttestationRequest({ schema: KarmaLib.getDetailsSchemaUID(), data: reqData });

        try IGap(KarmaLib.getGapContract()).attest(req) returns (bytes32 uid) {
            milestoneUID = uid;
            emit GAPMilestoneCreated(projectUID, milestoneUID, milestoneTitle);
        } catch {
            emit GAPOperationFailed(garden, "createMilestone", "Attestation failed");
            return bytes32(0);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // View Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IKarmaGAPModule
    function getProjectUID(address garden) external view returns (bytes32) {
        return gardenProjects[garden];
    }

    /// @inheritdoc IKarmaGAPModule
    function isSupported() external view returns (bool) {
        return KarmaLib.isSupported();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UUPS Upgrade
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Authorizes an upgrade to a new implementation
    /// @param newImplementation The address of the new implementation
    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner { }
}
