// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { IGreenGoodsResolver } from "../interfaces/IGreenGoodsResolver.sol";
import { IGardenAccount } from "../interfaces/IGardenAccount.sol";
import { IKarmaGAPModule } from "../interfaces/IKarmaGAPModule.sol";
import { OctantModule } from "../modules/Octant.sol";
import { UnlockModule } from "../modules/Unlock.sol";

/// @title GreenGoodsResolver
/// @notice Central fan-out resolver for protocol integrations
/// @dev Called by other resolvers after attestation validation; uses try/catch to isolate failures
///
/// **Architecture:**
/// - Resolvers call this contract AFTER successful validation
/// - Each integration module is called with try/catch
/// - One module failure does not affect others or block the attestation
/// - Events are emitted for observability (success/failure per module)
///
/// **Phase 1 (Current):**
/// - GAP integration (moved from GardenAccount)
/// - Module enable/disable via owner
///
/// **Future Phases:**
/// - Octant vault creation
/// - Unlock badge minting
/// - Hypercert anchoring
/// - GreenWill registry updates
contract GreenGoodsResolver is IGreenGoodsResolver, OwnableUpgradeable, UUPSUpgradeable {
    // ═══════════════════════════════════════════════════════════════════════════
    // Module Identifiers
    // ═══════════════════════════════════════════════════════════════════════════

    bytes32 public constant MODULE_GAP = keccak256("GAP");
    bytes32 public constant MODULE_OCTANT = keccak256("OCTANT");
    bytes32 public constant MODULE_UNLOCK = keccak256("UNLOCK");
    bytes32 public constant MODULE_HYPERCERTS = keccak256("HYPERCERTS");
    bytes32 public constant MODULE_GREENWILL = keccak256("GREENWILL");

    // ═══════════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Emitted when a module is enabled or disabled
    event ModuleStatusChanged(bytes32 indexed moduleId, bool enabled);

    /// @notice Emitted when a module execution succeeds
    event ModuleExecutionSuccess(bytes32 indexed moduleId, address indexed garden, bytes32 indexed attestationUID);

    /// @notice Emitted when a module execution fails (non-blocking)
    event ModuleExecutionFailed(bytes32 indexed moduleId, address indexed garden, bytes32 indexed attestationUID);

    /// @notice Emitted when an authorized caller is added or removed
    event AuthorizedCallerChanged(address indexed caller, bool authorized);

    /// @notice Emitted when the Octant module address is updated
    event OctantModuleUpdated(address indexed oldModule, address indexed newModule);

    /// @notice Emitted when the Unlock module address is updated
    event UnlockModuleUpdated(address indexed oldModule, address indexed newModule);

    /// @notice Emitted when the KarmaGAP module address is updated
    event KarmaGAPModuleUpdated(address indexed oldModule, address indexed newModule);

    // ═══════════════════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════════════════

    error UnauthorizedCaller(address caller);
    error ZeroAddress();

    // ═══════════════════════════════════════════════════════════════════════════
    // Storage
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Mapping of module IDs to enabled status
    mapping(bytes32 moduleId => bool enabled) private _enabledModules;

    /// @notice Authorized callers (resolvers)
    mapping(address caller => bool authorized) public authorizedCallers;

    /// @notice Octant vault module address
    OctantModule public octantModule;

    /// @notice Unlock badge module address
    UnlockModule public unlockModule;

    /// @notice KarmaGAP module address
    IKarmaGAPModule public karmaGAPModule;

    /// @notice Storage gap for future upgrades
    /// Reserves 45 slots (50 total - 5 used: _enabledModules, authorizedCallers, octantModule, unlockModule,
    /// karmaGAPModule)
    uint256[45] private __gap;

    // ═══════════════════════════════════════════════════════════════════════════
    // Modifiers
    // ═══════════════════════════════════════════════════════════════════════════

    modifier onlyAuthorized() {
        if (!authorizedCallers[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedCaller(msg.sender);
        }
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Constructor & Initializer
    // ═══════════════════════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the router
    /// @param _owner The address that will own the router
    /// @param _workApprovalResolver The WorkApprovalResolver address (authorized caller)
    /// @param _assessmentResolver The AssessmentResolver address (authorized caller)
    function initialize(address _owner, address _workApprovalResolver, address _assessmentResolver) external initializer {
        if (_owner == address(0)) revert ZeroAddress();

        __Ownable_init();
        _transferOwnership(_owner);

        // Authorize resolvers
        if (_workApprovalResolver != address(0)) {
            authorizedCallers[_workApprovalResolver] = true;
            emit AuthorizedCallerChanged(_workApprovalResolver, true);
        }
        if (_assessmentResolver != address(0)) {
            authorizedCallers[_assessmentResolver] = true;
            emit AuthorizedCallerChanged(_assessmentResolver, true);
        }

        // Enable GAP module by default (existing functionality)
        _enabledModules[MODULE_GAP] = true;
        emit ModuleStatusChanged(MODULE_GAP, true);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // IGardenIntegrationRouter Implementation
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IGreenGoodsResolver
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
        external
        override
        onlyAuthorized
    {
        // GAP Module: Create project impact
        if (_enabledModules[MODULE_GAP]) {
            _executeGAPWorkApproved(garden, workUID, approvalUID, actionUID, attester, feedback, mediaIPFS);
        }

        // Octant Module: Create/update vault for garden
        if (_enabledModules[MODULE_OCTANT] && address(octantModule) != address(0)) {
            _executeOctantWorkApproved(garden, workUID);
        }

        // Unlock Module: Grant badge to worker
        if (_enabledModules[MODULE_UNLOCK] && address(unlockModule) != address(0)) {
            _executeUnlockWorkApproved(garden, worker, workUID);
        }

        // Future: Hypercerts, GreenWill modules
    }

    /// @inheritdoc IGreenGoodsResolver
    function onAssessmentCreated(
        address garden,
        bytes32 assessmentUID,
        address attester,
        string calldata title,
        string calldata description,
        string[] calldata capitals,
        string calldata assessmentType
    )
        external
        override
        onlyAuthorized
    {
        // GAP Module: Create project milestone
        if (_enabledModules[MODULE_GAP]) {
            _executeGAPAssessmentCreated(garden, assessmentUID, attester, title, description, capitals, assessmentType);
        }

        // Future: GreenWill registry updates for assessments
    }

    /// @inheritdoc IGreenGoodsResolver
    function isModuleEnabled(bytes32 moduleId) external view override returns (bool) {
        return _enabledModules[moduleId];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Admin Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Enable or disable a module
    /// @param moduleId The module identifier
    /// @param enabled Whether to enable or disable
    function setModuleEnabled(bytes32 moduleId, bool enabled) external onlyOwner {
        _enabledModules[moduleId] = enabled;
        emit ModuleStatusChanged(moduleId, enabled);
    }

    /// @notice Add or remove an authorized caller
    /// @param caller The caller address
    /// @param authorized Whether to authorize or deauthorize
    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        if (caller == address(0)) revert ZeroAddress();
        authorizedCallers[caller] = authorized;
        emit AuthorizedCallerChanged(caller, authorized);
    }

    /// @notice Sets the Octant module address
    /// @param _module The module address
    function setOctantModule(address _module) external onlyOwner {
        address oldModule = address(octantModule);
        octantModule = OctantModule(_module);
        emit OctantModuleUpdated(oldModule, _module);
    }

    /// @notice Sets the Unlock module address
    /// @param _module The module address
    function setUnlockModule(address _module) external onlyOwner {
        address oldModule = address(unlockModule);
        unlockModule = UnlockModule(_module);
        emit UnlockModuleUpdated(oldModule, _module);
    }

    /// @notice Sets the KarmaGAP module address
    /// @param _module The module address
    function setKarmaGAPModule(address _module) external onlyOwner {
        address oldModule = address(karmaGAPModule);
        karmaGAPModule = IKarmaGAPModule(_module);
        emit KarmaGAPModuleUpdated(oldModule, _module);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GAP Module (Phase 1 — migrated from GardenAccount)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Execute GAP integration for work approval
    /// @dev Wrapped in try/catch at call site; emits success/failure events
    function _executeGAPWorkApproved(
        address garden,
        bytes32 workUID,
        bytes32, /* approvalUID */
        bytes32, /* actionUID */
        address, /* attester */
        string calldata feedback,
        string calldata mediaIPFS
    )
        private
    {
        // Skip if GAP module not configured
        if (address(karmaGAPModule) == address(0)) return;

        // Skip if garden has no GAP project
        bytes32 projectUID = karmaGAPModule.getProjectUID(garden);
        if (projectUID == bytes32(0)) return;

        // GAP impact creation is now handled by WorkApprovalResolver calling KarmaGAPModule directly
        // This is just for event emission and future module fan-out
        emit ModuleExecutionSuccess(MODULE_GAP, garden, workUID);

        // solhint-disable-next-line no-unused-vars
        feedback;
        mediaIPFS;
    }

    /// @notice Execute GAP integration for assessment creation
    /// @dev Wrapped in try/catch at call site; emits success/failure events
    function _executeGAPAssessmentCreated(
        address garden,
        bytes32 assessmentUID,
        address, /* attester */
        string calldata, /* title */
        string calldata, /* description */
        string[] calldata, /* capitals */
        string calldata /* assessmentType */
    )
        private
    {
        // Skip if GAP module not configured
        if (address(karmaGAPModule) == address(0)) return;

        // Skip if garden has no GAP project
        bytes32 projectUID = karmaGAPModule.getProjectUID(garden);
        if (projectUID == bytes32(0)) return;

        // GAP milestone creation is now handled by AssessmentResolver calling KarmaGAPModule directly
        // This is just for event emission and future module fan-out
        emit ModuleExecutionSuccess(MODULE_GAP, garden, assessmentUID);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Octant Module (Phase 3)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Execute Octant integration for work approval
    /// @dev Creates or retrieves vault for garden; failures are non-blocking
    function _executeOctantWorkApproved(address garden, bytes32 workUID) private {
        // Get garden name for vault creation
        IGardenAccount gardenAccount = IGardenAccount(garden);
        string memory gardenName = gardenAccount.name();

        // Call module with try/catch — failures don't block attestations
        try octantModule.onWorkApproved(garden, gardenName) returns (address vault) {
            if (vault != address(0)) {
                emit ModuleExecutionSuccess(MODULE_OCTANT, garden, workUID);
            }
            // vault == address(0) means factory not configured or vault already exists
            // This is not a failure, just no action needed
        } catch {
            emit ModuleExecutionFailed(MODULE_OCTANT, garden, workUID);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Unlock Module (Phase 3)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Execute Unlock integration for work approval
    /// @dev Grants badge to worker; failures are non-blocking
    function _executeUnlockWorkApproved(address garden, address worker, bytes32 workUID) private {
        // Call module with try/catch — failures don't block attestations
        try unlockModule.onWorkApproved(garden, worker, workUID) returns (uint256 tokenId) {
            if (tokenId != 0) {
                emit ModuleExecutionSuccess(MODULE_UNLOCK, garden, workUID);
            }
            // tokenId == 0 means no lock configured for garden
            // This is not a failure, just no badge to grant
        } catch {
            emit ModuleExecutionFailed(MODULE_UNLOCK, garden, workUID);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UUPS Upgrade
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Authorizes an upgrade to a new implementation
    /// @param newImplementation The address of the new implementation
    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        // Intentionally empty - UUPS upgrade authorization handled by onlyOwner modifier
    }
}
