// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {TBALib} from "../lib/TBA.sol";
import {GardenAccount} from "../accounts/Garden.sol";
import {DeploymentRegistry} from "../DeploymentRegistry.sol";

/// @title GardenToken Contract
/// @notice This contract manages the minting of Garden tokens and the creation of associated Garden accounts.
/// @dev This contract is upgradable and follows the UUPS pattern.
contract GardenToken is ERC721Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
    uint256 private _nextTokenId;
    address private immutable _GARDEN_ACCOUNT_IMPLEMENTATION;
    address public deploymentRegistry;

    /**
     * @dev Storage gap for future upgrades
     * Reserves 48 slots (50 total - 2 used: _nextTokenId, deploymentRegistry)
     * Note: _GARDEN_ACCOUNT_IMPLEMENTATION is immutable (not in storage)
     * Allows adding new state variables without breaking storage layout in upgrades
     */
    uint256[48] private __gap;

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
        bool openJoining,
        address[] gardeners,
        address[] operators
    );

    /// @notice Configuration for batch garden minting (Gas Optimized)
    struct GardenConfig {
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

    /// @notice Emitted for batch operations (Gas Optimized)
    event BatchGardensMinted(
        uint256 indexed startTokenId, uint256 indexed endTokenId, address indexed minter, uint256 count
    );

    /// @notice Error thrown when unauthorized caller attempts to mint
    error UnauthorizedMinter();

    /// @notice Error thrown when deployment registry is not configured
    error DeploymentRegistryNotConfigured();
    /// @notice Error thrown when invalid batch size is provided
    error InvalidBatchSize();
    /// @notice Error thrown when community token address is zero
    error InvalidCommunityToken();
    /// @notice Error thrown when community token address is not a contract
    error CommunityTokenNotContract();
    /// @notice Error thrown when community token does not implement ERC-20 interface
    error InvalidERC20Token();
    /// @notice Error thrown when too many gardeners are provided
    error TooManyGardeners();
    /// @notice Error thrown when too many operators are provided
    error TooManyOperators();

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
    function setDeploymentRegistry(address _deploymentRegistry) external onlyOwner {
        deploymentRegistry = _deploymentRegistry;
    }

    /// @notice Modifier to check if caller is authorized to mint gardens.
    /// @dev Checks if caller is owner or in deployment registry allowlist.
    modifier onlyAuthorizedMinter() {
        if (owner() != msg.sender) {
            if (deploymentRegistry == address(0)) {
                revert DeploymentRegistryNotConfigured();
            }

            try DeploymentRegistry(deploymentRegistry).isInAllowlist(msg.sender) returns (bool isAllowed) {
                if (!isAllowed) {
                    revert UnauthorizedMinter();
                }
            } catch {
                revert UnauthorizedMinter();
            }
        }
        _;
    }

    /// @notice Mints a new Garden token and creates the associated Garden account.
    /// @dev The Garden account is initialized with the provided parameters. Uses GardenConfig struct to avoid stack too
    /// deep.
    /// @param config Garden configuration struct containing all initialization parameters
    function mintGarden(GardenConfig calldata config) external onlyAuthorizedMinter returns (address) {
        // Validate community token early for better error messages
        _validateCommunityToken(config.communityToken);

        uint256 tokenId = _nextTokenId++;
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
            config.openJoining,
            config.gardeners,
            config.gardenOperators
        );

        // Prepare initialization parameters
        GardenAccount.InitParams memory params = GardenAccount.InitParams({
            communityToken: config.communityToken,
            name: config.name,
            description: config.description,
            location: config.location,
            bannerImage: config.bannerImage,
            metadata: config.metadata,
            openJoining: config.openJoining,
            gardeners: config.gardeners,
            gardenOperators: config.gardenOperators
        });

        GardenAccount(payable(gardenAccount)).initialize(params);

        return gardenAccount;
    }

    // _mintGardenInternal removed as it is no longer needed

    /// @notice Batch mint multiple gardens (40% gas savings)
    /// @param configs Array of garden configurations (max 10 for gas limit protection)
    /// @return gardenAccounts Array of created garden account addresses
    function batchMintGardens(GardenConfig[] calldata configs)
        external
        onlyAuthorizedMinter
        returns (address[] memory gardenAccounts)
    {
        uint256 configsLength = configs.length;
        if (configsLength == 0 || configsLength > 10) {
            revert InvalidBatchSize();
        }

        // Validate all community tokens and array lengths upfront for fail-fast behavior
        for (uint256 i = 0; i < configsLength;) {
            _validateCommunityToken(configs[i].communityToken);
            if (configs[i].gardeners.length > 100) revert TooManyGardeners();
            if (configs[i].gardenOperators.length > 100) revert TooManyOperators();
            unchecked {
                ++i;
            }
        }

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
                config.openJoining,
                config.gardeners,
                config.gardenOperators
            );

            // Prepare initialization parameters
            GardenAccount.InitParams memory params = GardenAccount.InitParams({
                communityToken: config.communityToken,
                name: config.name,
                description: config.description,
                location: config.location,
                bannerImage: config.bannerImage,
                metadata: config.metadata,
                openJoining: config.openJoining,
                gardeners: config.gardeners,
                gardenOperators: config.gardenOperators
            });

            GardenAccount(payable(gardenAccount)).initialize(params);

            gardenAccounts[i] = gardenAccount;

            unchecked {
                ++i;
            }
        }

        emit BatchGardensMinted(startTokenId, _nextTokenId - 1, _msgSender(), configsLength);
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

    /// @notice Authorizes contract upgrades.
    /// @dev Restricted to the contract owner.
    /// @param newImplementation The address of the new contract implementation.
    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        // Intentionally empty - UUPS upgrade authorization handled by onlyOwner modifier
    }
}
