// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { AccountV3Upgradable } from "@tokenbound/AccountV3Upgradable.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import { IGardenAccessControl } from "../interfaces/IGardenAccessControl.sol";
import { IGardenAccount } from "../interfaces/IGardenAccount.sol";
import { IHatsModule } from "../interfaces/IHatsModule.sol";
import { IKarmaGAPModule } from "../interfaces/IKarmaGAPModule.sol";

error NotGardenOwner();
error NotGardenOperator();
error InvalidInvite();
error AlreadyGardener();
error HatsModuleNotAvailable();

/// @notice Minimal interface to fetch module addresses from GardenToken
interface IGardenTokenModules {
    function hatsModule() external view returns (IHatsModule);
    function karmaGAPModule() external view returns (IKarmaGAPModule);
}

/// @title GardenAccount Contract
/// @notice Manages garden metadata and role checks for Garden accounts
/// @dev Delegates access control to HatsModule.
contract GardenAccount is AccountV3Upgradable, Initializable, IGardenAccessControl, IGardenAccount {
    /// @notice Emitted when the garden name is updated.
    /// @param updater The address of the entity that updated the name.
    /// @param newName The new name of the garden.
    event NameUpdated(address indexed updater, string newName);

    /// @notice Emitted when the garden description is updated.
    /// @param updater The address of the entity that updated the description.
    /// @param newDescription The new description of the garden.
    event DescriptionUpdated(address indexed updater, string newDescription);

    /// @notice Emitted when the garden metadata is updated.
    /// @param updater The address of the entity that updated the metadata.
    /// @param newMetadata The new IPFS CID containing metadata JSON.
    event MetadataUpdated(address indexed updater, string newMetadata);

    /// @notice Emitted when the community token is updated.
    /// @param updater The address of the entity that updated the token.
    /// @param newToken The new community token address.
    event CommunityTokenUpdated(address indexed updater, address newToken);

    /// @notice Emitted when the garden location is updated.
    /// @param updater The address of the entity that updated the location.
    /// @param newLocation The new location of the garden.
    event LocationUpdated(address indexed updater, string newLocation);

    /// @notice Emitted when the garden banner image is updated.
    /// @param updater The address of the entity that updated the banner.
    /// @param newBannerImage The new banner image CID.
    event BannerImageUpdated(address indexed updater, string newBannerImage);

    /// @notice Emitted when open joining status is updated.
    /// @param updater The address of the entity that updated the setting.
    /// @param openJoining The new open joining status.
    event OpenJoiningUpdated(address indexed updater, bool openJoining);

    /// @notice The community token associated with this garden.
    address public communityToken;

    /// @notice The name of the garden.
    string public name;

    /// @notice The description of the garden.
    string public description;

    /// @notice The location of the garden.
    string public location;

    /// @notice The CID of the banner image of the garden.
    string public bannerImage;

    /// @notice The IPFS CID containing additional garden metadata as JSON.
    string public metadata;

    /// @dev Reserved slot — previously `gardeners` mapping. Do not reuse.
    uint256 private __reservedSlot6;

    /// @dev Reserved slot — previously `gardenOperators` mapping. Do not reuse.
    uint256 private __reservedSlot7;

    /// @notice Whether this garden allows open joining without invite.
    bool public openJoining;

    /// @notice Immutable address of the WorkApprovalResolver
    /// @dev Retained for backwards-compatible constructor signature
    address public immutable WORK_APPROVAL_RESOLVER;

    /// @notice Immutable address of the AssessmentResolver
    /// @dev Retained for backwards-compatible constructor signature
    address public immutable ASSESSMENT_RESOLVER;

    modifier onlyGardenOwner() {
        if (!_isOwner(_msgSender())) {
            revert NotGardenOwner();
        }
        _;
    }

    modifier onlyOperator() {
        if (!_isOperatorOrOwner(_msgSender())) {
            revert NotGardenOperator();
        }
        _;
    }

    /// @notice Initializes the contract with the necessary dependencies.
    /// @dev This constructor is for the upgradable pattern and uses Initializable for upgrade safety.
    /// @param erc4337EntryPoint The entry point address for ERC-4337 operations.
    /// @param multicallForwarder The forwarder address for multicall operations.
    /// @param erc6551Registry The registry address for ERC-6551.
    /// @param guardian The guardian address for security-related functions.
    /// @param workApprovalResolver The address of the WorkApprovalResolver contract.
    /// @param assessmentResolver The address of the AssessmentResolver contract.
    constructor(
        address erc4337EntryPoint,
        address multicallForwarder,
        address erc6551Registry,
        address guardian,
        address workApprovalResolver,
        address assessmentResolver
    )
        AccountV3Upgradable(erc4337EntryPoint, multicallForwarder, erc6551Registry, guardian)
    {
        WORK_APPROVAL_RESOLVER = workApprovalResolver;
        ASSESSMENT_RESOLVER = assessmentResolver;
        _disableInitializers();
    }

    /// @notice Initializes the GardenAccount with initial data.
    /// @dev Role initialization is handled by GardenToken + HatsModule (v2).
    /// @param params Initialization parameters struct
    function initialize(IGardenAccount.InitParams calldata params) external initializer {
        communityToken = params.communityToken;
        name = params.name;
        description = params.description;
        location = params.location;
        bannerImage = params.bannerImage;
        metadata = params.metadata;
        openJoining = params.openJoining;
    }

    /// @dev Temporarily disabled to reduce contract size - can be re-enabled via upgrade
    // function updateCommunityToken(address _communityToken) external onlyOperator {
    //     communityToken = _communityToken;
    //     emit CommunityTokenUpdated(_msgSender(), _communityToken);
    // }

    /// @notice Updates the name of the garden
    function updateName(string memory _name) external onlyGardenOwner {
        name = _name;
        emit NameUpdated(_msgSender(), _name);
    }

    /// @notice Updates the description of the garden
    function updateDescription(string memory _description) external onlyOperator {
        description = _description;
        emit DescriptionUpdated(_msgSender(), _description);
    }

    /// @dev Temporarily disabled to reduce contract size - can be re-enabled via upgrade
    // function updateLocation(string memory _location) external onlyOperator {
    //     location = _location;
    //     emit LocationUpdated(_msgSender(), _location);
    // }

    /// @dev Temporarily disabled to reduce contract size - can be re-enabled via upgrade
    // function updateBannerImage(string memory _bannerImage) external onlyOperator {
    //     bannerImage = _bannerImage;
    //     emit BannerImageUpdated(_msgSender(), _bannerImage);
    // }

    /// @dev Temporarily disabled to reduce contract size - can be re-enabled via upgrade
    // function updateMetadata(string memory _metadata) external onlyOperator {
    //     metadata = _metadata;
    //     emit MetadataUpdated(_msgSender(), _metadata);
    // }

    /// @notice Join garden if open joining is enabled.
    /// @dev Grants gardener hat via HatsModule.
    function joinGarden() external {
        if (!openJoining) revert InvalidInvite();

        IHatsModule hatsModule = _getHatsModule();
        if (hatsModule.isGardenerOf(address(this), _msgSender())) revert AlreadyGardener();

        hatsModule.grantRole(address(this), _msgSender(), IHatsModule.GardenRole.Gardener);
    }

    /// @notice Enable or disable open joining for the garden
    function setOpenJoining(bool _openJoining) external onlyOperator {
        openJoining = _openJoining;
        emit OpenJoiningUpdated(_msgSender(), _openJoining);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // IGardenAccessControl Implementation
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev Role checks apply inclusive hierarchy: owner→operator→evaluator→gardener.
    ///      An owner is implicitly an operator, evaluator, and gardener. An operator is
    ///      implicitly an evaluator and gardener. This differs from HatsModule.is*Of()
    ///      which checks exact hat membership. Use these for permission checks.

    /// @inheritdoc IGardenAccessControl
    function isGardener(address account) external view override returns (bool) {
        return _isGardener(account);
    }

    /// @inheritdoc IGardenAccessControl
    function isEvaluator(address account) external view override returns (bool) {
        return _isEvaluator(account);
    }

    /// @inheritdoc IGardenAccessControl
    function isOperator(address account) external view override returns (bool) {
        return _isOperatorOrOwner(account);
    }

    /// @inheritdoc IGardenAccessControl
    function isOwner(address account) external view override returns (bool) {
        return _isOwner(account);
    }

    /// @inheritdoc IGardenAccessControl
    function isFunder(address account) external view override returns (bool) {
        return _getHatsModule().isFunderOf(address(this), account);
    }

    /// @inheritdoc IGardenAccessControl
    function isCommunity(address account) external view override returns (bool) {
        return _getHatsModule().isCommunityOf(address(this), account);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GAP Views (delegated to KarmaGAPModule)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Returns the Karma GAP project UID for this garden
    function getGAPProjectUID() external view returns (bytes32) {
        return _getGAPProjectUID();
    }

    /// @notice Alias for getGAPProjectUID()
    function gapProjectUID() external view returns (bytes32) {
        return _getGAPProjectUID();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    function _getGAPProjectUID() internal view returns (bytes32) {
        IKarmaGAPModule gapModule = _getKarmaGAPModule();
        if (address(gapModule) == address(0)) return bytes32(0);
        return gapModule.getProjectUID(address(this));
    }

    function _getHatsModule() internal view returns (IHatsModule) {
        (, address tokenContract,) = token();
        if (tokenContract == address(0)) revert HatsModuleNotAvailable();

        IHatsModule module = IGardenTokenModules(tokenContract).hatsModule();
        if (address(module) == address(0)) revert HatsModuleNotAvailable();

        return module;
    }

    function _getKarmaGAPModule() internal view returns (IKarmaGAPModule) {
        (, address tokenContract,) = token();
        if (tokenContract == address(0)) return IKarmaGAPModule(address(0));

        try IGardenTokenModules(tokenContract).karmaGAPModule() returns (IKarmaGAPModule module) {
            return module;
        } catch {
            return IKarmaGAPModule(address(0));
        }
    }

    function _isOwner(address account) internal view returns (bool) {
        return _getHatsModule().isOwnerOf(address(this), account);
    }

    function _isOperatorOrOwner(address account) internal view returns (bool) {
        IHatsModule hatsModule = _getHatsModule();
        return hatsModule.isOperatorOf(address(this), account) || hatsModule.isOwnerOf(address(this), account);
    }

    function _isEvaluator(address account) internal view returns (bool) {
        IHatsModule hatsModule = _getHatsModule();
        return hatsModule.isEvaluatorOf(address(this), account) || hatsModule.isOperatorOf(address(this), account)
            || hatsModule.isOwnerOf(address(this), account);
    }

    function _isGardener(address account) internal view returns (bool) {
        IHatsModule hatsModule = _getHatsModule();
        return hatsModule.isGardenerOf(address(this), account) || hatsModule.isOperatorOf(address(this), account)
            || hatsModule.isOwnerOf(address(this), account);
    }

    /// @notice Storage gap for upgradeable contract
    /// @dev Reserve 50 slots total for future upgrades.
    /// Inherited storage (5 slots):
    ///   - Initializable: 1 slot (_initialized + _initializing packed)
    ///   - Lockable: 1 slot (lockedUntil)
    ///   - Overridable: 1 slot (overrides mapping)
    ///   - Permissioned: 1 slot (permissions mapping)
    ///   - ERC6551Account: 1 slot (_state)
    /// GardenAccount storage (10 slots):
    ///   - communityToken (1) + name (1) + description (1) + location (1)
    ///   - bannerImage (1) + metadata (1) + __reservedSlot6 (1) + __reservedSlot7 (1)
    ///   - openJoining (1) + unused gapProjectUID slot reserved (1)
    /// Note: WORK_APPROVAL_RESOLVER and ASSESSMENT_RESOLVER are immutables (no storage slots)
    /// Gap calculation: 50 - (5 + 10) = 35 slots
    uint256[35] private __gap;
}
