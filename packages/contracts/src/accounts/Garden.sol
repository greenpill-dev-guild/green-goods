// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { AccountV3Upgradable } from "@tokenbound/AccountV3Upgradable.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import { IGardenAccount } from "../interfaces/IGardenAccount.sol";

error NotGardenOwner();

/// @title GardenAccount Contract
/// @notice Token-bound account for gardens managing metadata and community tokens.
/// @dev Inherits from AccountV3Upgradable and uses OpenZeppelin's Initializable for upgradability.
///
/// **Architecture (Hats-Only Roles):**
/// - Role management: Delegated entirely to HatsModule
/// - GAP integration: Handled by KarmaGAPModule
/// - This contract focuses on basic TBA functionality and garden metadata
/// - Resolvers query HatsModule directly for role checks
contract GardenAccount is AccountV3Upgradable, Initializable, IGardenAccount {
    // ═══════════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Emitted when the garden name is updated.
    event NameUpdated(address indexed updater, string newName);

    /// @notice Emitted when the garden description is updated.
    event DescriptionUpdated(address indexed updater, string newDescription);

    /// @notice Emitted when the garden metadata is updated.
    event MetadataUpdated(address indexed updater, string newMetadata);

    /// @notice Emitted when the community token is updated.
    event CommunityTokenUpdated(address indexed updater, address newToken);

    /// @notice Emitted when the garden location is updated.
    event LocationUpdated(address indexed updater, string newLocation);

    /// @notice Emitted when the garden banner image is updated.
    event BannerImageUpdated(address indexed updater, string newBannerImage);

    /// @notice Emitted when open joining status is updated.
    event OpenJoiningUpdated(address indexed updater, bool openJoining);

    // ═══════════════════════════════════════════════════════════════════════════
    // Storage
    // ═══════════════════════════════════════════════════════════════════════════

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

    /// @notice The IPFS CID containing additional garden metadata as JSON
    string public metadata;

    /// @notice Whether this garden allows open joining without invite
    /// @dev Used by HatsModule.joinGarden() to determine if anyone can join
    bool public openJoining;

    // ═══════════════════════════════════════════════════════════════════════════
    // Modifiers
    // ═══════════════════════════════════════════════════════════════════════════

    modifier onlyGardenOwner() {
        if (_isValidSigner(_msgSender(), "") == false) {
            revert NotGardenOwner();
        }
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Constructor & Initializer
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Initializes the contract with the necessary dependencies.
    /// @param erc4337EntryPoint The entry point address for ERC-4337 operations.
    /// @param multicallForwarder The forwarder address for multicall operations.
    /// @param erc6551Registry The registry address for ERC-6551.
    /// @param guardian The guardian address for security-related functions.
    constructor(
        address erc4337EntryPoint,
        address multicallForwarder,
        address erc6551Registry,
        address guardian
    )
        AccountV3Upgradable(erc4337EntryPoint, multicallForwarder, erc6551Registry, guardian)
    {
        _disableInitializers();
    }

    /// @notice Initializes the GardenAccount with metadata.
    /// @dev This function must be called after the contract is deployed.
    /// @dev Role management (operators/gardeners) is handled by HatsModule
    /// @param params Initialization parameters struct
    function initialize(IGardenAccount.InitParams calldata params) external initializer {
        // Note: Community token validation is performed by GardenToken before minting
        communityToken = params.communityToken;
        name = params.name;
        description = params.description;
        location = params.location;
        bannerImage = params.bannerImage;
        metadata = params.metadata;
        openJoining = params.openJoining;

        // Note: Role management (operators/gardeners) is handled by HatsModule
        // The gardeners and gardenOperators arrays in InitParams are processed by GardenToken
        // which calls HatsModule.createGardenHatTree() and HatsModule.grantRole()
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Metadata Management
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Updates the name of the garden
    function updateName(string memory _name) external onlyGardenOwner {
        name = _name;
        emit NameUpdated(_msgSender(), _name);
    }

    /// @notice Updates the description of the garden
    /// @dev Now requires garden owner (operators check via Hats would require hatsModule reference)
    function updateDescription(string memory _description) external onlyGardenOwner {
        description = _description;
        emit DescriptionUpdated(_msgSender(), _description);
    }

    /// @notice Updates the location of the garden
    function updateLocation(string memory _location) external onlyGardenOwner {
        location = _location;
        emit LocationUpdated(_msgSender(), _location);
    }

    /// @notice Updates the banner image of the garden
    function updateBannerImage(string memory _bannerImage) external onlyGardenOwner {
        bannerImage = _bannerImage;
        emit BannerImageUpdated(_msgSender(), _bannerImage);
    }

    /// @notice Updates the metadata of the garden
    function updateMetadata(string memory _metadata) external onlyGardenOwner {
        metadata = _metadata;
        emit MetadataUpdated(_msgSender(), _metadata);
    }

    /// @notice Updates the community token of the garden
    function updateCommunityToken(address _communityToken) external onlyGardenOwner {
        communityToken = _communityToken;
        emit CommunityTokenUpdated(_msgSender(), _communityToken);
    }

    /// @notice Enable or disable open joining for the garden
    /// @dev When enabled, anyone can call HatsModule.joinGarden(thisAddress) to become a gardener
    function setOpenJoining(bool _openJoining) external onlyGardenOwner {
        openJoining = _openJoining;
        emit OpenJoiningUpdated(_msgSender(), _openJoining);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Storage Gap
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Storage gap for upgradeable contract
    /// @dev Reserve slots for future upgrades
    /// Inherited storage (5 slots):
    ///   - Initializable: 1 slot (_initialized + _initializing packed)
    ///   - Lockable: 1 slot (lockedUntil)
    ///   - Overridable: 1 slot (overrides mapping)
    ///   - Permissioned: 1 slot (permissions mapping)
    ///   - ERC6551Account: 1 slot (_state)
    /// GardenAccount storage (7 slots):
    ///   - communityToken(1) + name(1) + description(1) + location(1)
    ///   - bannerImage(1) + metadata(1) + openJoining(1)
    /// Gap calculation: 50 - (5 + 7) = 38 slots
    uint256[38] private __gap;
}
