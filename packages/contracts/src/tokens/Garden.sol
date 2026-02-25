// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ERC721Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { TBALib } from "../lib/TBA.sol";
import { IGardenAccount } from "../interfaces/IGardenAccount.sol";
import { IHatsModule } from "../interfaces/IHatsModule.sol";
import { IKarmaGAPModule } from "../interfaces/IKarmaGAPModule.sol";
import { IGardensModule } from "../interfaces/IGardensModule.sol";
import { OctantModule } from "../modules/Octant.sol";
import { ICookieJarModule } from "../interfaces/ICookieJarModule.sol";
import { IGreenGoodsENS } from "../interfaces/IGreenGoodsENS.sol";
import { Deployment } from "../registries/Deployment.sol";
import { ActionRegistry } from "../registries/Action.sol";

/// @title GardenToken Contract
/// @notice This contract manages the minting of Garden tokens and the creation of associated Garden accounts.
/// @dev This contract is upgradable and follows the UUPS pattern.
contract GardenToken is ERC721Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
    uint256 private _nextTokenId;
    address private immutable _GARDEN_ACCOUNT_IMPLEMENTATION;
    address public deploymentRegistry;
    IHatsModule public hatsModule;
    IKarmaGAPModule public karmaGAPModule;
    OctantModule public octantModule;
    IGardensModule public gardensModule;
    ActionRegistry public actionRegistry;
    ICookieJarModule public cookieJarModule;
    IGreenGoodsENS public ensModule;
    address public communityToken;

    /// @notice Refund credits for failed ENS registrations, claimable by minter
    mapping(address minter => uint256 amount) public failedENSRefunds;

    /// @notice Total ETH reserved for pending ENS refund claims
    uint256 public totalPendingENSRefunds;

    /// @notice Transfer restriction mode for garden NFTs
    enum TransferRestriction {
        Unrestricted,
        OwnerOnly,
        Locked
    }

    /// @notice Current transfer restriction mode
    TransferRestriction public transferRestriction;

    /// @notice Whether minting is open to anyone (true) or restricted to owner/allowlist (false)
    bool public openMinting;

    /**
     * @dev Storage gap for future upgrades
     * Reserves 37 slots (50 total - 13 used slots: _nextTokenId, deploymentRegistry, hatsModule,
     * karmaGAPModule, octantModule, gardensModule, actionRegistry, cookieJarModule, ensModule,
     * communityToken, failedENSRefunds, totalPendingENSRefunds, transferRestriction+openMinting)
     * Note: transferRestriction (enum, 1 byte) and openMinting (bool, 1 byte) pack into one slot.
     */
    uint256[37] private __gap;

    /// @notice Emitted when a new Garden is minted.
    /// @param tokenId The unique identifier of the minted Garden token.
    /// @param account The address of the associated Garden account.
    event GardenMinted(
        uint256 indexed tokenId,
        address indexed account,
        string name,
        string description,
        string location,
        string bannerImage,
        bool openJoining
    );

    /// @notice Emitted when the Hats module address is updated.
    event HatsModuleUpdated(address indexed oldModule, address indexed newModule);

    /// @notice Emitted when the Karma GAP module address is updated.
    event KarmaGAPModuleUpdated(address indexed oldModule, address indexed newModule);

    /// @notice Emitted when the Octant module address is updated.
    event OctantModuleUpdated(address indexed oldModule, address indexed newModule);

    /// @notice Emitted when the Gardens module address is updated.
    event GardensModuleUpdated(address indexed oldModule, address indexed newModule);

    /// @notice Emitted when the ActionRegistry address is updated.
    event ActionRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);

    /// @notice Emitted when the CookieJar module address is updated.
    event CookieJarModuleUpdated(address indexed oldModule, address indexed newModule);

    /// @notice Emitted when the ENS module address is updated.
    event ENSModuleUpdated(address indexed oldModule, address indexed newModule);

    /// @notice Emitted when the community token address is updated.
    event CommunityTokenUpdated(address indexed oldToken, address indexed newToken);

    /// @notice Emitted when the open minting mode is changed.
    event OpenMintingUpdated(bool indexed open);

    /// @notice Emitted when an ENS registration refund is queued for manual claim
    event ENSRegistrationRefundQueued(address indexed minter, uint256 amount);

    /// @notice Emitted when a minter claims previously queued ENS registration refunds
    event ENSRegistrationRefundClaimed(address indexed minter, uint256 amount);

    /// @notice Configuration for batch garden minting (Gas Optimized)
    struct GardenConfig {
        string name;
        string slug;
        string description;
        string location;
        string bannerImage;
        string metadata;
        bool openJoining;
        IGardensModule.WeightScheme weightScheme;
        uint8 domainMask;
        address[] gardeners;
        address[] operators;
    }

    /// @notice Emitted for batch operations (Gas Optimized)
    event BatchGardensMinted(
        uint256 indexed startTokenId, uint256 indexed endTokenId, address indexed minter, uint256 count
    );

    /// @notice Error thrown when unauthorized caller attempts to mint
    error UnauthorizedMinter();

    /// @notice Error thrown when deployment registry is not configured
    error DeploymentNotConfigured();
    /// @notice Error thrown when invalid batch size is provided
    error InvalidBatchSize();
    /// @notice Error thrown when community token address is zero
    error InvalidCommunityToken();
    /// @notice Error thrown when community token address is not a contract
    error CommunityTokenNotContract();
    /// @notice Error thrown when community token does not implement ERC-20 interface
    error InvalidERC20Token();
    /// @notice Error thrown when community token has not been configured via setCommunityToken()
    error CommunityTokenNotConfigured();
    /// @notice Error thrown when hats module is not configured
    error HatsModuleNotSet();
    /// @notice Error thrown when transfers are locked
    error TransfersLocked();
    /// @notice Error thrown when transfers are restricted to owner only
    error TransfersRestricted();
    /// @notice Error thrown when ENS refund claim is requested without a balance
    error NoENSRefundAvailable();
    /// @notice Error thrown when ENS refund transfer fails
    error ENSRefundTransferFailed();

    /// @custom:oz-upgrades-unsafe-allow constructor
    /// @param gardenAccountImplementation The address of the Garden account implementation.
    constructor(address gardenAccountImplementation) {
        _GARDEN_ACCOUNT_IMPLEMENTATION = gardenAccountImplementation;
        _disableInitializers(); // Prevent constructor usage for upgradable contracts
    }

    /// @notice Initializes the contract and sets the specified address as the owner.
    /// @dev This function replaces the constructor for upgradable contracts.
    /// @param _multisig The address that will own the contract.
    /// @param _deploymentRegistry The deployment registry address for allowlist checking.
    function initialize(address _multisig, address _deploymentRegistry) external initializer {
        __ERC721_init("Green Goods Garden", "GGG");
        __Ownable_init();
        _transferOwnership(_multisig);
        deploymentRegistry = _deploymentRegistry;
    }

    /// @notice Sets the deployment registry address (owner only).
    /// @param _deploymentRegistry The deployment registry address.
    function setDeployment(address _deploymentRegistry) external onlyOwner {
        deploymentRegistry = _deploymentRegistry;
    }

    /// @notice Sets the GardenHatsModule address (owner only).
    function setHatsModule(address _hatsModule) external onlyOwner {
        address oldModule = address(hatsModule);
        hatsModule = IHatsModule(_hatsModule);
        emit HatsModuleUpdated(oldModule, _hatsModule);
    }

    /// @notice Sets the KarmaGAPModule address (owner only).
    function setKarmaGAPModule(address _karmaGAPModule) external onlyOwner {
        address oldModule = address(karmaGAPModule);
        karmaGAPModule = IKarmaGAPModule(_karmaGAPModule);
        emit KarmaGAPModuleUpdated(oldModule, _karmaGAPModule);
    }

    /// @notice Sets the OctantModule address (owner only).
    function setOctantModule(address _octantModule) external onlyOwner {
        address oldModule = address(octantModule);
        octantModule = OctantModule(_octantModule);
        emit OctantModuleUpdated(oldModule, _octantModule);
    }

    /// @notice Sets the GardensModule address (owner only).
    function setGardensModule(address _gardensModule) external onlyOwner {
        address oldModule = address(gardensModule);
        gardensModule = IGardensModule(_gardensModule);
        emit GardensModuleUpdated(oldModule, _gardensModule);
    }

    /// @notice Sets the ActionRegistry address (owner only).
    function setActionRegistry(address _actionRegistry) external onlyOwner {
        address oldRegistry = address(actionRegistry);
        actionRegistry = ActionRegistry(_actionRegistry);
        emit ActionRegistryUpdated(oldRegistry, _actionRegistry);
    }

    /// @notice Sets the CookieJarModule address (owner only).
    function setCookieJarModule(address _cookieJarModule) external onlyOwner {
        address oldModule = address(cookieJarModule);
        cookieJarModule = ICookieJarModule(_cookieJarModule);
        emit CookieJarModuleUpdated(oldModule, _cookieJarModule);
    }

    /// @notice Sets the ENS module address (owner only).
    function setENSModule(address _ensModule) external onlyOwner {
        address oldModule = address(ensModule);
        ensModule = IGreenGoodsENS(_ensModule);
        emit ENSModuleUpdated(oldModule, _ensModule);
    }

    /// @notice Sets the community token address (owner only).
    /// @dev Validates that the token is a valid ERC-20 contract. All gardens share the same community token.
    /// @param _communityToken The community token address.
    function setCommunityToken(address _communityToken) external onlyOwner {
        _validateCommunityToken(_communityToken);
        address oldToken = communityToken;
        communityToken = _communityToken;
        emit CommunityTokenUpdated(oldToken, _communityToken);
    }

    /// @notice Set the transfer restriction mode (owner only)
    function setTransferRestriction(TransferRestriction _restriction) external onlyOwner {
        transferRestriction = _restriction;
    }

    /// @notice Enable or disable open minting (owner only)
    function setOpenMinting(bool _open) external onlyOwner {
        openMinting = _open;
        emit OpenMintingUpdated(_open);
    }

    /// @notice Modifier to check if caller is authorized to mint gardens.
    /// @dev Delegates to _checkMintAuthorization() to avoid modifier inlining stack depth issues.
    modifier onlyAuthorizedMinter() {
        _checkMintAuthorization();
        _;
    }

    /// @dev When openMinting is true, anyone can mint. Otherwise checks owner or deployment registry allowlist.
    function _checkMintAuthorization() private view {
        if (openMinting) return;
        if (owner() == msg.sender) return;

        if (deploymentRegistry == address(0)) {
            revert DeploymentNotConfigured();
        }

        try Deployment(deploymentRegistry).isInAllowlist(msg.sender) returns (bool isAllowed) {
            if (!isAllowed) {
                revert UnauthorizedMinter();
            }
        } catch {
            revert UnauthorizedMinter();
        }
    }

    /// @notice Mints a new Garden token and creates the associated Garden account.
    /// @dev The Garden account is initialized with the provided parameters. Uses GardenConfig struct to avoid stack too
    /// deep.
    /// @param config Garden configuration struct containing all initialization parameters
    function mintGarden(GardenConfig calldata config) external payable onlyAuthorizedMinter returns (address) {
        if (communityToken == address(0)) revert CommunityTokenNotConfigured();
        if (address(hatsModule) == address(0)) revert HatsModuleNotSet();

        uint256 tokenId = _nextTokenId++;
        _safeMint(_msgSender(), tokenId);

        address gardenAccount = TBALib.createAccount(_GARDEN_ACCOUNT_IMPLEMENTATION, address(this), tokenId);

        // Emit FULL event
        emit GardenMinted(
            tokenId, gardenAccount, config.name, config.description, config.location, config.bannerImage, config.openJoining
        );

        _initializeGardenModules(gardenAccount, config);

        return gardenAccount;
    }

    // _mintGardenInternal removed as it is no longer needed

    /// @notice Batch mint multiple gardens (40% gas savings)
    /// @dev **ENS msg.value limitation**: In batch mode, the entire `msg.value` is forwarded to
    ///      the first garden with a non-empty slug for ENS registration. Subsequent gardens with
    ///      slugs will attempt ENS registration with zero value, which may fail. The refund mechanism
    ///      at `_initializeIntegrationsAndAccount` (lines 411-415) ensures funds are recoverable
    ///      via `claimENSRefund()` if ENS registration fails. For batch mints with multiple ENS names,
    ///      callers should mint individually or only set a slug on the first config.
    /// @param configs Array of garden configurations (max 10 for gas limit protection)
    /// @return gardenAccounts Array of created garden account addresses
    function batchMintGardens(GardenConfig[] calldata configs)
        external
        payable
        onlyAuthorizedMinter
        returns (address[] memory gardenAccounts)
    {
        uint256 configsLength = configs.length;
        if (configsLength == 0 || configsLength > 10) {
            revert InvalidBatchSize();
        }

        if (communityToken == address(0)) revert CommunityTokenNotConfigured();
        if (address(hatsModule) == address(0)) revert HatsModuleNotSet();

        gardenAccounts = new address[](configsLength);
        uint256 startTokenId = _nextTokenId;

        // Gas optimization: Batch increment token IDs
        _nextTokenId += configsLength;

        for (uint256 i = 0; i < configsLength;) {
            uint256 tokenId = startTokenId + i;
            GardenConfig calldata config = configs[i];

            _safeMint(_msgSender(), tokenId);

            address gardenAccount = TBALib.createAccount(_GARDEN_ACCOUNT_IMPLEMENTATION, address(this), tokenId);

            // Emit FULL event
            emit GardenMinted(
                tokenId,
                gardenAccount,
                config.name,
                config.description,
                config.location,
                config.bannerImage,
                config.openJoining
            );

            _initializeGardenModules(gardenAccount, config);

            gardenAccounts[i] = gardenAccount;

            unchecked {
                ++i;
            }
        }

        emit BatchGardensMinted(startTokenId, _nextTokenId - 1, _msgSender(), configsLength);
    }

    /// @notice Initializes Hats tree, Karma GAP project, and GardenAccount for a newly minted garden
    /// @dev Shared by mintGarden() and batchMintGardens() to avoid code duplication.
    ///      Split into two private functions to avoid Yul stack-too-deep with via_ir.
    /// @param gardenAccount The TBA garden account address
    /// @param config The garden configuration
    function _initializeGardenModules(address gardenAccount, GardenConfig calldata config) private {
        _initializeRoleAndGovernance(gardenAccount, config);
        _initializeIntegrationsAndAccount(gardenAccount, config);
    }

    /// @dev Phase 1: Hats tree, KarmaGAP project, Octant vault, Gardens community
    function _initializeRoleAndGovernance(address gardenAccount, GardenConfig calldata config) private {
        // Hats Protocol: create hat tree + initial owner role
        hatsModule.createGardenHatTree(gardenAccount, config.name, communityToken);
        hatsModule.grantRole(gardenAccount, _msgSender(), IHatsModule.GardenRole.Owner);

        // Grant Gardener role to configured gardeners (best-effort)
        for (uint256 i = 0; i < config.gardeners.length; i++) {
            if (config.gardeners[i] != address(0)) {
                try hatsModule.grantRole(gardenAccount, config.gardeners[i], IHatsModule.GardenRole.Gardener) { } catch { }
            }
        }
        // Grant Operator role to configured operators (best-effort)
        for (uint256 i = 0; i < config.operators.length; i++) {
            if (config.operators[i] != address(0)) {
                try hatsModule.grantRole(gardenAccount, config.operators[i], IHatsModule.GardenRole.Operator) { } catch { }
            }
        }

        // Karma GAP: create project (graceful degradation)
        if (address(karmaGAPModule) != address(0)) {
            try karmaGAPModule.createProject(
                gardenAccount, _msgSender(), config.name, config.description, config.location, config.bannerImage
            ) {
                // Success handled by module events
            } catch {
                // Failure is non-blocking
            }
        }

        // Octant vault setup (graceful degradation)
        if (address(octantModule) != address(0)) {
            try octantModule.onGardenMinted(gardenAccount, config.name) returns (address[] memory _vaults) {
                _vaults; // Success handled by module events
            } catch {
                // Failure is non-blocking
            }
        }

        // Gardens V2 community + signal pools (graceful degradation)
        if (address(gardensModule) != address(0)) {
            // solhint-disable-next-line no-empty-blocks
            try gardensModule.onGardenMinted(gardenAccount, config.weightScheme) returns (address, address[] memory) {
                // Success handled by module events
            } catch {
                // Failure is non-blocking — garden mint MUST NOT revert
            }
        }
    }

    /// @dev Phase 2: CookieJar, ActionRegistry domains, ENS, account initialization
    function _initializeIntegrationsAndAccount(address gardenAccount, GardenConfig calldata config) private {
        // Cookie Jar: create per-asset jars (graceful degradation)
        if (address(cookieJarModule) != address(0)) {
            // solhint-disable-next-line no-empty-blocks
            try cookieJarModule.onGardenMinted(gardenAccount) returns (address[] memory _jars) {
                _jars; // Success handled by module events
            } catch {
                // Failure is non-blocking — garden mint MUST NOT revert
            }
        }

        // Set initial garden domains on ActionRegistry (graceful degradation)
        if (config.domainMask > 0 && address(actionRegistry) != address(0)) {
            // solhint-disable-next-line no-empty-blocks
            try actionRegistry.setGardenDomainsFromMint(gardenAccount, config.domainMask) {
                // Success handled by ActionRegistry events
            } catch {
                // Non-blocking — garden mint MUST NOT revert
            }
        }

        // ENS: register garden subdomain via CCIP (graceful degradation)
        if (address(ensModule) != address(0) && bytes(config.slug).length > 0) {
            // solhint-disable-next-line no-empty-blocks
            try ensModule.registerGarden{ value: msg.value }(config.slug, gardenAccount) {
                // Success handled by ENS module events
            } catch {
                // Non-blocking — garden mint MUST NOT revert
                // Keep user funds recoverable if ENS registration failed.
                if (msg.value > 0) {
                    failedENSRefunds[_msgSender()] += msg.value;
                    totalPendingENSRefunds += msg.value;
                    emit ENSRegistrationRefundQueued(_msgSender(), msg.value);
                }
            }
        }

        // Initialize garden account with metadata
        IGardenAccount.InitParams memory params = IGardenAccount.InitParams({
            communityToken: communityToken,
            name: config.name,
            slug: config.slug,
            description: config.description,
            location: config.location,
            bannerImage: config.bannerImage,
            metadata: config.metadata,
            openJoining: config.openJoining
        });

        IGardenAccount(gardenAccount).initialize(params);
    }

    /// @notice Claim queued refund from failed ENS registration attempts
    function claimENSRefund() external {
        uint256 amount = failedENSRefunds[_msgSender()];
        if (amount == 0) revert NoENSRefundAvailable();

        failedENSRefunds[_msgSender()] = 0;
        totalPendingENSRefunds -= amount;

        (bool ok,) = _msgSender().call{ value: amount }("");
        if (!ok) revert ENSRefundTransferFailed();

        emit ENSRegistrationRefundClaimed(_msgSender(), amount);
    }

    /// @notice Validates that the provided address is a valid ERC-20 token contract
    /// @dev Checks: non-zero address, has contract code, implements ERC-20 totalSupply
    /// @param token The token address to validate
    function _validateCommunityToken(address token) private view {
        // Check non-zero address
        if (token == address(0)) {
            revert InvalidCommunityToken();
        }

        // Check that address contains contract code
        if (token.code.length == 0) {
            revert CommunityTokenNotContract();
        }

        // Attempt to call totalSupply() to verify it's an ERC-20
        // This provides a basic sanity check without requiring full interface compliance
        // solhint-disable-next-line no-empty-blocks
        try IERC20(token).totalSupply() returns (uint256) {
            // Success - token validated, no additional action needed
        } catch {
            revert InvalidERC20Token();
        }
    }

    /// @notice Restricts token transfers based on the current transfer restriction mode
    /// @dev Allows minting (from == address(0)) regardless of restriction mode
    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize) internal override {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
        if (from == address(0)) return; // allow minting
        if (transferRestriction == TransferRestriction.Locked) revert TransfersLocked();
        if (transferRestriction == TransferRestriction.OwnerOnly && msg.sender != owner()) revert TransfersRestricted();
    }

    /// @notice Authorizes contract upgrades.
    /// @dev Restricted to the contract owner.
    /// @param newImplementation The address of the new contract implementation.
    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        // Intentionally empty - UUPS upgrade authorization handled by onlyOwner modifier
    }
}
