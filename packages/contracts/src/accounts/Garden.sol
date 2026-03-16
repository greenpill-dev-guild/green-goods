// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { AccountV3Upgradable } from "@tokenbound/AccountV3Upgradable.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IGardenAccessControl } from "../interfaces/IGardenAccessControl.sol";
import { IGardenAccount } from "../interfaces/IGardenAccount.sol";
import { IGardensModule } from "../interfaces/IGardensModule.sol";
import { IHatsModule } from "../interfaces/IHatsModule.sol";
import { IKarmaGAPModule } from "../interfaces/IKarmaGAPModule.sol";
import { IRegistryCommunity } from "../interfaces/IGardensV2.sol";

error NotGardenOwner();
error NotGardenOperator();
error InvalidInvite();
error AlreadyGardener();
error GardenFull();
error NameTooLong();
error HatsModuleNotAvailable();

/// @notice Minimal interface to fetch module addresses from GardenToken
interface IGardenTokenModules {
    function hatsModule() external view returns (IHatsModule);
    function karmaGAPModule() external view returns (IKarmaGAPModule);
    function gardensModule() external view returns (IGardensModule);
}

/// @title GardenAccount Contract
/// @notice Manages garden metadata and role checks for Garden accounts
/// @dev Delegates access control to HatsModule.
contract GardenAccount is AccountV3Upgradable, Initializable, IGardenAccessControl, IGardenAccount {
    using SafeERC20 for IERC20;
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

    /// @notice Emitted when a member is auto-registered in the Gardens V2 community.
    /// @param member The member address that was registered.
    /// @param community The community address.
    event MemberAutoRegistered(address indexed member, address indexed community);

    /// @notice Maximum allowed byte-length for the garden name (UTF-8).
    uint256 public constant MAX_NAME_LENGTH = 72;

    /// @notice The community token associated with this garden.
    address public communityToken;

    /// @notice The name of the garden.
    string public name;

    /// @notice The ENS subdomain slug (e.g., "miyawaki-park")
    string public slug;

    /// @notice The description of the garden.
    string public description;

    /// @notice The location of the garden.
    string public location;

    /// @notice The CID of the banner image of the garden.
    string public bannerImage;

    /// @notice The IPFS CID containing additional garden metadata as JSON.
    string public metadata;

    /// @notice Whether this garden allows open joining without invite.
    bool public openJoining;

    /// @notice Maximum number of gardeners allowed (0 = unlimited)
    uint256 public maxGardeners;

    /// @notice Current garden member count
    uint256 public gardenMemberCount;

    /// @notice Guard flag for executeAutoStake — prevents TBA execution bypass
    /// @dev Set to true only during _autoRegisterInCommunity, checked in executeAutoStake
    bool private _autoStaking;

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
        if (bytes(params.name).length > MAX_NAME_LENGTH) revert NameTooLong();
        communityToken = params.communityToken;
        name = params.name;
        slug = params.slug;
        description = params.description;
        location = params.location;
        bannerImage = params.bannerImage;
        metadata = params.metadata;
        openJoining = params.openJoining;
    }

    /// @dev Temporarily disabled — updateCommunityToken affects Gardens V2 integration
    // function updateCommunityToken(address _communityToken) external onlyOperator {
    //     communityToken = _communityToken;
    //     emit CommunityTokenUpdated(_msgSender(), _communityToken);
    // }

    /// @notice Updates the name of the garden
    function updateName(string memory _name) external onlyGardenOwner {
        if (bytes(_name).length > MAX_NAME_LENGTH) revert NameTooLong();
        name = _name;
        emit NameUpdated(_msgSender(), _name);
    }

    /// @notice Updates the description of the garden
    function updateDescription(string memory _description) external onlyOperator {
        description = _description;
        emit DescriptionUpdated(_msgSender(), _description);
    }

    /// @notice Updates the location of the garden
    function updateLocation(string memory _location) external onlyOperator {
        location = _location;
        emit LocationUpdated(_msgSender(), _location);
    }

    /// @notice Updates the banner image CID of the garden
    function updateBannerImage(string memory _bannerImage) external onlyOperator {
        bannerImage = _bannerImage;
        emit BannerImageUpdated(_msgSender(), _bannerImage);
    }

    /// @notice Updates the metadata IPFS CID of the garden
    function updateMetadata(string memory _metadata) external onlyOperator {
        metadata = _metadata;
        emit MetadataUpdated(_msgSender(), _metadata);
    }

    /// @notice Join garden if open joining is enabled.
    /// @dev Grants gardener hat via HatsModule, then auto-registers in Gardens V2 community
    ///      if available. The auth flow works because this call originates from the
    ///      GardenAccount itself (msg.sender == garden address in HatsModule), which is
    ///      an authorized caller.
    function joinGarden() external {
        if (!openJoining) revert InvalidInvite();

        // Use hierarchy-inclusive check: operators and owners are implicitly gardeners
        if (_isGardener(_msgSender())) revert AlreadyGardener();

        IHatsModule hatsModuleRef = _getHatsModule();

        // CAP CHECK: Prevent Sybil drainage
        if (maxGardeners > 0 && gardenMemberCount >= maxGardeners) revert GardenFull();

        // Grant gardener role FIRST — this MUST succeed
        hatsModuleRef.grantRole(address(this), _msgSender(), IHatsModule.GardenRole.Gardener);

        // Track member count
        gardenMemberCount++;

        // Auto-register in Gardens V2 community if available (best-effort)
        _autoRegisterInCommunity(_msgSender());
    }

    /// @notice Enable or disable open joining for the garden
    function setOpenJoining(bool _openJoining) external onlyOperator {
        openJoining = _openJoining;
        emit OpenJoiningUpdated(_msgSender(), _openJoining);
    }

    /// @notice Set the maximum gardener cap (0 = unlimited)
    function setMaxGardeners(uint256 _max) external onlyOperator {
        maxGardeners = _max;
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

    /// @notice Get the GardensModule from GardenToken
    /// @return The GardensModule, or address(0) if unavailable
    function _getGardensModule() internal view returns (IGardensModule) {
        (, address tokenContract,) = token();
        if (tokenContract == address(0)) return IGardensModule(address(0));

        try IGardenTokenModules(tokenContract).gardensModule() returns (IGardensModule module) {
            return module;
        } catch {
            return IGardensModule(address(0));
        }
    }

    /// @notice Auto-register a new member in the Gardens V2 community
    /// @dev Best-effort: failures are silently caught. The gardener role is already granted.
    ///      Flow: garden TBA approves GOODS → community.stakeAndRegisterMember(member)
    /// @param member The address to register
    function _autoRegisterInCommunity(address member) internal {
        IGardensModule gardens = _getGardensModule();
        if (address(gardens) == address(0)) return;

        address community = gardens.getGardenCommunity(address(this));
        if (community == address(0)) return;

        uint256 stakeAmount = gardens.stakeAmountPerMember();
        if (stakeAmount == 0) return;

        IERC20 token_ = gardens.goodsToken();
        if (address(token_) == address(0)) return;

        // Check if garden treasury has enough GOODS
        uint256 balance = token_.balanceOf(address(this));
        if (balance < stakeAmount) return; // No GOODS left — join still succeeds

        // Garden TBA approves + stakes on behalf of the new member
        // Set guard flag to prevent TBA execution bypass (Critical: msg.sender == address(this)
        // is satisfiable by TBA owner via execute(target=this, data=executeAutoStake.selector))
        _autoStaking = true;
        try this.executeAutoStake(address(token_), community, stakeAmount, member) {
            emit MemberAutoRegistered(member, community);
        } catch {
            // Non-blocking — gardener role still granted even if community registration fails
        }
        _autoStaking = false;
    }

    /// @notice Execute the approve + stake sequence (called via this.executeAutoStake for try/catch)
    /// @dev Must be external so it can be wrapped in try/catch from internal context.
    ///      Protected by _autoStaking flag in addition to self-call check — the self-call check
    ///      alone is insufficient in TBA context because the NFT owner can call execute(target=this)
    ///      which makes msg.sender == address(this). The flag is only set by _autoRegisterInCommunity.
    function executeAutoStake(address goodsToken_, address community, uint256 stakeAmount, address member) external {
        if (msg.sender != address(this) || !_autoStaking) revert NotGardenOwner();
        IERC20(goodsToken_).forceApprove(community, stakeAmount);
        IRegistryCommunity(community).stakeAndRegisterMember(member);
    }

    /// @notice Storage gap for upgradeable contract
    /// @dev Reserve 50 slots total for future upgrades.
    /// Verified via `forge inspect GardenAccount storage-layout`:
    /// Inherited storage (4 full slots, slots 0-3):
    ///   - Lockable: 1 slot (lockedUntil)                    [slot 0]
    ///   - Overridable: 1 slot (overrides mapping)           [slot 1]
    ///   - Permissioned: 1 slot (permissions mapping)        [slot 2]
    ///   - ERC6551Account: 1 slot (_state)                   [slot 3]
    /// Packed slot (slot 4):
    ///   - Initializable: _initialized (1B) + _initializing (1B)
    ///   - communityToken (20B) — packed in same slot
    /// GardenAccount storage (10 slots, slots 5-14):
    ///   - name (1) + slug (1) + description (1) + location (1) + bannerImage (1)
    ///   - metadata (1) + openJoining (1) + maxGardeners (1)
    ///   - gardenMemberCount (1) + _autoStaking (1)
    /// Note: WORK_APPROVAL_RESOLVER and ASSESSMENT_RESOLVER are immutables (no storage slots)
    /// Gap calculation: 50 - 15 (slots 0-14) = 35 slots
    uint256[35] private __gap;
}
