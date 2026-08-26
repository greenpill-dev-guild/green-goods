// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { KarmaLib } from "../lib/Karma.sol";
import { KarmaAccessLib } from "../lib/KarmaAccess.sol";
import { KarmaProjectsLib } from "../lib/KarmaProjects.sol";
import { KarmaUpdatesLib } from "../lib/KarmaUpdates.sol";
import { IKarmaGAPModule } from "../interfaces/IKarmaGAPModule.sol";
import { IGardenAccount } from "../interfaces/IGardenAccount.sol";

interface IGardenTokenKarmaView {
    function isGardenAccount(address garden) external view returns (bool);
}

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

    /// @notice Last successfully attested canonical ProjectDetails payload hash.
    mapping(address garden => bytes32 detailsHash) public gardenDetailsHashes;

    /// @notice Historical MemberOf UID created for each Garden/account pair.
    mapping(address garden => mapping(address account => bytes32 memberUID)) public gardenMemberOfUIDs;

    /// @notice Project Update UID for each original Work attestation.
    mapping(bytes32 workUID => bytes32 updateUID) public projectUpdateUIDs;

    /// @notice Project generation associated with each historical MemberOf UID.
    mapping(address garden => mapping(address account => bytes32 projectUID)) public gardenMemberOfProjectUIDs;

    /// @notice Per-operation guard for external Karma and ProjectResolver calls.
    mapping(bytes32 key => bool active) private _syncInFlight;

    /// @notice Storage gap for future upgrades
    uint256[40] private __gap;

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
        address, /*operator*/
        string calldata name,
        string calldata description,
        string calldata location,
        string calldata bannerImage
    )
        external
        onlyGardenToken
        returns (bytes32 projectUID)
    {
        projectUID = _reconcileProject(garden, name, "", description, location, bannerImage);
    }

    /// @inheritdoc IKarmaGAPModule
    function addProjectAdmin(address garden, address admin) external onlyAuthorized {
        _reconcileProjectAccess(garden, admin);
    }

    /// @inheritdoc IKarmaGAPModule
    function removeProjectAdmin(address garden, address admin) external onlyAuthorized {
        _reconcileProjectAccess(garden, admin);
    }

    /// @inheritdoc IKarmaGAPModule
    function reconcileProject(address garden) external returns (bytes32 projectUID) {
        if (!_isGarden(garden)) {
            emit GAPOperationFailed(garden, "reconcileProject", "Invalid garden");
            _record(
                garden,
                bytes32(0),
                address(0),
                KarmaSyncOperation.Project,
                KarmaSyncOutcome.Failed,
                bytes32(0),
                bytes32(0),
                "invalid_garden"
            );
            return bytes32(0);
        }
        IGardenAccount account = IGardenAccount(garden);
        projectUID = _reconcileProject(
            garden, account.name(), account.slug(), account.description(), account.location(), account.bannerImage()
        );
    }

    /// @inheritdoc IKarmaGAPModule
    function reconcileProjectAccess(address garden, address account) external returns (bool roleActive, bool changed) {
        if (!_isGarden(garden)) {
            emit GAPOperationFailed(garden, "reconcileProjectAccess", "Invalid garden");
            KarmaAccessLib.recordPrerequisiteFailure(garden, gardenProjects[garden], account, "invalid_garden");
            return (false, false);
        }
        return _reconcileProjectAccess(garden, account);
    }

    function _reconcileProject(
        address garden,
        string memory name,
        string memory slug,
        string memory description,
        string memory location,
        string memory bannerImage
    )
        internal
        returns (bytes32 projectUID)
    {
        return KarmaProjectsLib.reconcile(
            gardenProjects, gardenDetailsHashes, _syncInFlight, garden, name, slug, description, location, bannerImage
        );
    }

    function _reconcileProjectAccess(address garden, address account) internal returns (bool roleActive, bool changed) {
        return KarmaAccessLib.reconcile(
            gardenProjects, gardenMemberOfUIDs, gardenMemberOfProjectUIDs, _syncInFlight, garden, account
        );
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
        delete gardenDetailsHashes[garden];
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
        bytes32 workUID,
        string calldata metadataCID
    )
        external
        onlyWorkApprovalResolver
        returns (bytes32 impactUID)
    {
        return _createProjectUpdate(garden, workTitle, impactDescription, proofIPFS, workUID, metadataCID);
    }

    /// @inheritdoc IKarmaGAPModule
    function createProjectUpdate(
        address garden,
        string calldata workTitle,
        string calldata updateText,
        string calldata proofReference,
        bytes32 workUID,
        string calldata metadataReference
    )
        external
        onlyWorkApprovalResolver
        returns (bytes32 updateUID)
    {
        return _createProjectUpdate(garden, workTitle, updateText, proofReference, workUID, metadataReference);
    }

    function _createProjectUpdate(
        address garden,
        string calldata workTitle,
        string calldata updateText,
        string calldata proofReference,
        bytes32 workUID,
        string calldata metadataReference
    )
        internal
        returns (bytes32 updateUID)
    {
        return KarmaUpdatesLib.createProjectUpdate(
            gardenProjects,
            projectUpdateUIDs,
            _syncInFlight,
            garden,
            workTitle,
            updateText,
            proofReference,
            workUID,
            metadataReference
        );
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
        return KarmaUpdatesLib.createMilestone(
            gardenProjects,
            _syncInFlight,
            garden,
            milestoneTitle,
            milestoneDescription,
            startDate,
            endDate,
            domain,
            location,
            assessmentConfigCID
        );
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

    function _isGarden(address garden) internal view returns (bool) {
        if (gardenToken.code.length == 0 || garden.code.length == 0) return false;
        try IGardenTokenKarmaView(gardenToken).isGardenAccount(garden) returns (bool valid) {
            return valid;
        } catch {
            return false;
        }
    }

    function _record(
        address garden,
        bytes32 projectUID,
        address account,
        KarmaSyncOperation operation,
        KarmaSyncOutcome outcome,
        bytes32 sourceUID,
        bytes32 resultUID,
        string memory reason
    )
        internal
    {
        emit KarmaSyncRecorded(garden, projectUID, account, operation, outcome, sourceUID, resultUID, reason);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UUPS Upgrade
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Authorizes an upgrade to a new implementation
    /// @param newImplementation The address of the new implementation
    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner { }
}
