// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { IGardenAccessControl } from "../interfaces/IGardenAccessControl.sol";
import { IOctantFactory, IOctantStrategy, IOctantVault } from "../interfaces/IOctantFactory.sol";

interface IGardenMetadata {
    function name() external view returns (string memory);
}

/// @title OctantModule
/// @notice Garden vault registry + admin layer for Octant-based ERC-4626 vaults
/// @dev Users deposit/redeem directly on vaults; this module manages creation + ops
contract OctantModule is OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    // ═══════════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════════

    event VaultCreated(address indexed garden, address indexed vault, address indexed asset);
    event FactoryUpdated(address indexed oldFactory, address indexed newFactory);
    event GardenTokenUpdated(address indexed oldGardenToken, address indexed newGardenToken);
    event HarvestTriggered(address indexed garden, address indexed asset, address indexed caller);
    event EmergencyPaused(address indexed garden, address indexed asset, address indexed caller);
    event DonationAddressUpdated(address indexed garden, address indexed oldAddress, address indexed newAddress);
    event SupportedAssetUpdated(address indexed asset, address indexed strategy);
    event DefaultProfitUnlockTimeUpdated(uint256 oldUnlockTime, uint256 newUnlockTime);
    event StrategyShutdownFailed(address indexed garden, address indexed asset, address indexed strategy);

    // ═══════════════════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════════════════

    error UnauthorizedCaller(address caller);
    error ZeroAddress();
    error FactoryNotConfigured();
    error UnsupportedAsset(address asset);
    error AssetDeactivated(address asset);
    error NoDonationAddress(address garden);
    error NoVaultForAsset(address garden, address asset);
    error VaultAlreadyExists(address garden, address asset);

    // ═══════════════════════════════════════════════════════════════════════════
    // Storage
    // ═══════════════════════════════════════════════════════════════════════════

    IOctantFactory public octantFactory;
    uint256 public defaultProfitUnlockTime;

    mapping(address garden => address donationAddress) public gardenDonationAddresses;
    mapping(address garden => mapping(address asset => address vault)) public gardenAssetVaults;
    mapping(address asset => address strategy) public supportedAssets;
    address[] public supportedAssetList;
    uint256 public supportedAssetCount;

    address public gardenToken;

    uint256[41] private __gap;

    // ═══════════════════════════════════════════════════════════════════════════
    // Modifiers
    // ═══════════════════════════════════════════════════════════════════════════

    modifier onlyGardenToken() {
        if (msg.sender != gardenToken) revert UnauthorizedCaller(msg.sender);
        _;
    }

    modifier onlyGardenOperatorOrOwner(address garden) {
        if (msg.sender == owner()) {
            _;
            return;
        }

        bool isOperator = false;
        bool isGardenOwner = false;

        // Access checks are isolated to keep this module non-opinionated about role backend.
        try IGardenAccessControl(garden).isOperator(msg.sender) returns (bool result) {
            isOperator = result;
        } catch { }

        try IGardenAccessControl(garden).isOwner(msg.sender) returns (bool result) {
            isGardenOwner = result;
        } catch { }

        if (!isOperator && !isGardenOwner) {
            revert UnauthorizedCaller(msg.sender);
        }
        _;
    }

    modifier onlyGardenOwner(address garden) {
        if (msg.sender == owner()) {
            _;
            return;
        }

        bool isGardenOwner = false;
        try IGardenAccessControl(garden).isOwner(msg.sender) returns (bool result) {
            isGardenOwner = result;
        } catch { }

        if (!isGardenOwner) {
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

    function initialize(address _owner, address _octantFactory, uint256 _profitUnlockTime) external initializer {
        if (_owner == address(0)) revert ZeroAddress();

        __Ownable_init();
        __ReentrancyGuard_init();
        _transferOwnership(_owner);

        octantFactory = IOctantFactory(_octantFactory);
        defaultProfitUnlockTime = _profitUnlockTime;

        if (_octantFactory != address(0)) {
            emit FactoryUpdated(address(0), _octantFactory);
        }
        emit DefaultProfitUnlockTimeUpdated(0, _profitUnlockTime);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Mint Callback
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Creates vaults for all active supported assets when a garden is minted
    function onGardenMinted(
        address garden,
        string calldata gardenName
    )
        external
        onlyGardenToken
        returns (address[] memory vaults)
    {
        uint256 assetCount = supportedAssetList.length;
        vaults = new address[](assetCount);

        for (uint256 i = 0; i < assetCount; i++) {
            address asset = supportedAssetList[i];
            address strategy = supportedAssets[asset];

            // Deactivated assets stay in the list for historical vault operations.
            if (strategy == address(0)) continue;

            address existingVault = gardenAssetVaults[garden][asset];
            if (existingVault != address(0)) {
                vaults[i] = existingVault;
                continue;
            }

            vaults[i] = _createVaultForGardenAsset(garden, gardenName, asset, strategy);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Admin Operations (No User Deposits/Withdrawals)
    // ═══════════════════════════════════════════════════════════════════════════

    function harvest(address garden, address asset) external nonReentrant onlyGardenOperatorOrOwner(garden) {
        if (gardenDonationAddresses[garden] == address(0)) revert NoDonationAddress(garden);

        address vault = gardenAssetVaults[garden][asset];
        if (vault == address(0)) revert NoVaultForAsset(garden, asset);

        address strategy = _resolveStrategy(vault, asset);
        if (strategy == address(0)) revert UnsupportedAsset(asset);

        IOctantStrategy(strategy).report();
        emit HarvestTriggered(garden, asset, msg.sender);
    }

    function emergencyPause(address garden, address asset) external nonReentrant onlyGardenOwner(garden) {
        address vault = gardenAssetVaults[garden][asset];
        if (vault == address(0)) revert NoVaultForAsset(garden, asset);

        address strategy = _resolveStrategy(vault, asset);
        if (strategy != address(0)) {
            try IOctantStrategy(strategy).shutdown() { }
            catch {
                emit StrategyShutdownFailed(garden, asset, strategy);
            }
        }

        emit EmergencyPaused(garden, asset, msg.sender);
    }

    function setDonationAddress(
        address garden,
        address donationAddress
    )
        external
        nonReentrant
        onlyGardenOperatorOrOwner(garden)
    {
        if (donationAddress == address(0)) revert ZeroAddress();

        address oldAddress = gardenDonationAddresses[garden];
        gardenDonationAddresses[garden] = donationAddress;

        // Propagate donation updates to all existing vault strategies on this garden.
        uint256 assetCount = supportedAssetList.length;
        for (uint256 i = 0; i < assetCount; i++) {
            address asset = supportedAssetList[i];
            address vault = gardenAssetVaults[garden][asset];
            if (vault == address(0)) continue;

            address strategy = _resolveStrategy(vault, asset);
            if (strategy == address(0)) continue;

            try IOctantStrategy(strategy).setDonationAddress(donationAddress) { } catch { }
        }

        emit DonationAddressUpdated(garden, oldAddress, donationAddress);
    }

    function createVaultForAsset(
        address garden,
        address asset
    )
        external
        onlyGardenOperatorOrOwner(garden)
        returns (address vault)
    {
        if (gardenAssetVaults[garden][asset] != address(0)) {
            revert VaultAlreadyExists(garden, asset);
        }

        address strategy = supportedAssets[asset];
        if (strategy == address(0)) {
            if (_supportedAssetExists(asset)) revert AssetDeactivated(asset);
            revert UnsupportedAsset(asset);
        }

        vault = _createVaultForGardenAsset(garden, _getGardenName(garden), asset, strategy);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Owner Functions
    // ═══════════════════════════════════════════════════════════════════════════

    function setOctantFactory(address _factory) external onlyOwner {
        address oldFactory = address(octantFactory);
        octantFactory = IOctantFactory(_factory);
        emit FactoryUpdated(oldFactory, _factory);
    }

    function setDefaultProfitUnlockTime(uint256 _profitUnlockTime) external onlyOwner {
        uint256 oldValue = defaultProfitUnlockTime;
        defaultProfitUnlockTime = _profitUnlockTime;
        emit DefaultProfitUnlockTimeUpdated(oldValue, _profitUnlockTime);
    }

    function setGardenToken(address _gardenToken) external onlyOwner {
        if (_gardenToken == address(0)) revert ZeroAddress();
        address oldGardenToken = gardenToken;
        gardenToken = _gardenToken;
        emit GardenTokenUpdated(oldGardenToken, _gardenToken);
    }

    function setSupportedAsset(address asset, address strategy) external onlyOwner {
        if (asset == address(0)) revert ZeroAddress();

        if (!_supportedAssetExists(asset)) {
            supportedAssetList.push(asset);
        }

        address previousStrategy = supportedAssets[asset];
        if (previousStrategy == address(0) && strategy != address(0)) {
            unchecked {
                supportedAssetCount += 1;
            }
        } else if (previousStrategy != address(0) && strategy == address(0)) {
            unchecked {
                supportedAssetCount -= 1;
            }
        }

        supportedAssets[asset] = strategy;
        emit SupportedAssetUpdated(asset, strategy);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // View Functions
    // ═══════════════════════════════════════════════════════════════════════════

    function getVaultForAsset(address garden, address asset) external view returns (address) {
        return gardenAssetVaults[garden][asset];
    }

    function getSupportedAssets() external view returns (address[] memory) {
        return supportedAssetList;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    function _createVaultForGardenAsset(
        address garden,
        string memory gardenName,
        address asset,
        address strategy
    )
        private
        returns (address vault)
    {
        if (address(octantFactory) == address(0)) revert FactoryNotConfigured();
        if (gardenAssetVaults[garden][asset] != address(0)) revert VaultAlreadyExists(garden, asset);

        (string memory vaultName, string memory vaultSymbol) = _buildVaultMetadata(gardenName, asset);

        vault = octantFactory.deployNewVault(asset, vaultName, vaultSymbol, address(this), defaultProfitUnlockTime);
        gardenAssetVaults[garden][asset] = vault;

        // Strategy attachment is best-effort to keep mint path non-fragile.
        try IOctantVault(vault).addStrategy(strategy) { } catch { }

        address donationAddress = gardenDonationAddresses[garden];
        if (donationAddress != address(0)) {
            address attachedStrategy = _resolveStrategy(vault, asset);
            if (attachedStrategy != address(0)) {
                try IOctantStrategy(attachedStrategy).setDonationAddress(donationAddress) { } catch { }
            }
        }

        emit VaultCreated(garden, vault, asset);
    }

    function _resolveStrategy(address vault, address asset) private view returns (address) {
        try IOctantVault(vault).strategy() returns (address strategy) {
            if (strategy != address(0)) return strategy;
        } catch { }

        return supportedAssets[asset];
    }

    function _buildVaultMetadata(
        string memory gardenName,
        address asset
    )
        private
        view
        returns (string memory vaultName, string memory vaultSymbol)
    {
        string memory assetSymbol = _getAssetSymbol(asset);
        string memory truncatedGardenName = _truncate(gardenName, 8);
        string memory truncatedAssetSymbol = _truncate(assetSymbol, 6);

        vaultName = string(abi.encodePacked("Green Goods - ", gardenName, " ", assetSymbol, " Vault"));
        vaultSymbol = string(abi.encodePacked("gg", truncatedAssetSymbol, "-", truncatedGardenName));
    }

    function _getAssetSymbol(address asset) private view returns (string memory) {
        if (asset.code.length == 0) {
            return "ASSET";
        }

        try IERC20Metadata(asset).symbol() returns (string memory symbol) {
            if (bytes(symbol).length > 0) {
                return symbol;
            }
        } catch { }
        return "ASSET";
    }

    function _getGardenName(address garden) private view returns (string memory) {
        try IGardenMetadata(garden).name() returns (string memory gardenName) {
            if (bytes(gardenName).length > 0) {
                return gardenName;
            }
        } catch { }
        return "Garden";
    }

    function _supportedAssetExists(address asset) private view returns (bool) {
        uint256 assetCount = supportedAssetList.length;
        for (uint256 i = 0; i < assetCount; i++) {
            if (supportedAssetList[i] == asset) {
                return true;
            }
        }
        return false;
    }

    function _truncate(string memory str, uint256 maxLen) private pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        if (strBytes.length <= maxLen) return str;

        bytes memory truncated = new bytes(maxLen);
        for (uint256 i = 0; i < maxLen; i++) {
            truncated[i] = strBytes[i];
        }
        return string(truncated);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UUPS Upgrade
    // ═══════════════════════════════════════════════════════════════════════════

    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner { }
}
