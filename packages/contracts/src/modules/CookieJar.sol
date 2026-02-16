// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { ICookieJarModule } from "../interfaces/ICookieJarModule.sol";
import { ICookieJarFactory } from "../interfaces/ICookieJarFactory.sol";
import { IHatsModule } from "../interfaces/IHatsModule.sol";

/// @title CookieJarModule
/// @notice Creates per-asset Cookie Jar vaults for gardens during mint using the 1Hive CookieJarFactory
/// @dev UUPS upgradeable. Called by GardenToken during mintGarden() via try/catch.
///      Delegates jar deployment to the external CookieJarFactory and uses ERC1155 (Hats Protocol)
///      access gating so that garden members (gardeners, operators, owners) can withdraw from jars.
contract CookieJarModule is ICookieJarModule, OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    // ═══════════════════════════════════════════════════════════════════════════
    // Storage
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice HatsModule for resolving garden hat IDs
    IHatsModule public hatsModule;

    /// @notice The GardenToken contract (authorized caller for onGardenMinted)
    address public gardenToken;

    /// @notice The YieldResolver contract (for auto-registration)
    address public yieldSplitter;

    /// @notice The 1Hive CookieJarFactory used to deploy jars
    ICookieJarFactory public cookieJarFactory;

    /// @notice The Hats Protocol ERC1155 contract address used for access gating
    address public hatsProtocol;

    /// @notice Default max withdrawal amount per transaction (in wei)
    uint256 public defaultMaxWithdrawal;

    /// @notice Default withdrawal cooldown interval (in seconds)
    uint256 public defaultWithdrawalInterval;

    /// @notice Default strict purpose requirement for withdrawals
    bool public defaultStrictPurpose;

    /// @notice Supported assets (e.g., [DAI, WETH])
    address[] public supportedAssets;

    /// @notice garden => asset => jar address
    mapping(address => mapping(address => address)) public gardenJars;

    /// @notice garden => jar addresses array
    mapping(address => address[]) public gardenJarList;

    /// @notice Storage gap for future upgrades
    /// @dev 11 explicit vars + 1 ReentrancyGuard slot + 38 gap = 50 slots total
    uint256[38] private __gap;

    // ═══════════════════════════════════════════════════════════════════════════
    // Modifiers
    // ═══════════════════════════════════════════════════════════════════════════

    modifier onlyGardenToken() {
        if (msg.sender != gardenToken) revert UnauthorizedCaller(msg.sender);
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Constructor & Initializer
    // ═══════════════════════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the CookieJarModule
    /// @param _owner The owner address
    /// @param _hatsModule HatsModule address for resolving garden hat IDs
    /// @param _yieldSplitter YieldResolver address
    /// @param _cookieJarFactory The 1Hive CookieJarFactory address
    /// @param _hatsProtocol The Hats Protocol ERC1155 contract address
    /// @param _supportedAssets Array of supported ERC-20 asset addresses
    function initialize(
        address _owner,
        address _hatsModule,
        address _yieldSplitter,
        address _cookieJarFactory,
        address _hatsProtocol,
        address[] calldata _supportedAssets
    )
        external
        initializer
    {
        if (_owner == address(0)) revert ZeroAddress();

        __Ownable_init();
        __ReentrancyGuard_init();
        _transferOwnership(_owner);

        hatsModule = IHatsModule(_hatsModule);
        yieldSplitter = _yieldSplitter;
        cookieJarFactory = ICookieJarFactory(_cookieJarFactory);
        hatsProtocol = _hatsProtocol;

        defaultMaxWithdrawal = 0.01 ether;
        defaultWithdrawalInterval = 86_400;
        defaultStrictPurpose = false;

        for (uint256 i = 0; i < _supportedAssets.length; i++) {
            supportedAssets.push(_supportedAssets[i]);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Garden Mint Callback
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc ICookieJarModule
    /// @dev Called by GardenToken during mint. Creates one jar per supported asset
    ///      via the CookieJarFactory using ERC1155 (Hats) access gating on the
    ///      garden's gardener hat ID.
    function onGardenMinted(address garden)
        external
        override
        onlyGardenToken
        nonReentrant
        returns (address[] memory jars)
    {
        uint256 assetCount = supportedAssets.length;
        jars = new address[](assetCount);

        for (uint256 i = 0; i < assetCount; i++) {
            address asset = supportedAssets[i];

            // Skip if jar already exists (idempotent)
            if (gardenJars[garden][asset] != address(0)) {
                jars[i] = gardenJars[garden][asset];
                continue;
            }

            // Deploy jar via CookieJarFactory with ERC1155/Hats access gating
            address jar = _createJar(garden, asset);
            gardenJars[garden][asset] = jar;
            gardenJarList[garden].push(jar);
            jars[i] = jar;

            emit JarCreated(garden, asset, jar);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // View Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc ICookieJarModule
    function getGardenJars(address garden) external view override returns (address[] memory) {
        return gardenJarList[garden];
    }

    /// @inheritdoc ICookieJarModule
    function getGardenJar(address garden, address asset) external view override returns (address) {
        return gardenJars[garden][asset];
    }

    /// @notice Get the list of supported assets
    function getSupportedAssets() external view returns (address[] memory) {
        return supportedAssets;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Admin Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Set the GardenToken address
    function setGardenToken(address _gardenToken) external onlyOwner {
        if (_gardenToken == address(0)) revert ZeroAddress();
        gardenToken = _gardenToken;
    }

    /// @notice Set the YieldResolver address
    function setYieldSplitter(address _yieldSplitter) external onlyOwner {
        yieldSplitter = _yieldSplitter;
    }

    /// @notice Set the HatsModule address
    function setHatsModule(address _hatsModule) external onlyOwner {
        hatsModule = IHatsModule(_hatsModule);
    }

    /// @notice Set the CookieJarFactory address
    function setCookieJarFactory(address _cookieJarFactory) external onlyOwner {
        if (_cookieJarFactory == address(0)) revert ZeroAddress();
        cookieJarFactory = ICookieJarFactory(_cookieJarFactory);
    }

    /// @notice Add a supported asset
    function addSupportedAsset(address asset) external onlyOwner {
        if (asset == address(0)) revert ZeroAddress();
        supportedAssets.push(asset);
    }

    /// @notice Remove a supported asset using swap-and-pop
    function removeSupportedAsset(address asset) external onlyOwner {
        uint256 len = supportedAssets.length;
        for (uint256 i = 0; i < len; i++) {
            if (supportedAssets[i] == asset) {
                supportedAssets[i] = supportedAssets[len - 1];
                supportedAssets.pop();
                return;
            }
        }
        revert AssetNotFound(asset);
    }

    /// @notice Set the Hats Protocol ERC1155 contract address
    function setHatsProtocol(address _hatsProtocol) external onlyOwner {
        if (_hatsProtocol == address(0)) revert ZeroAddress();
        hatsProtocol = _hatsProtocol;
    }

    /// @notice Set the default max withdrawal amount per transaction
    function setDefaultMaxWithdrawal(uint256 _defaultMaxWithdrawal) external onlyOwner {
        defaultMaxWithdrawal = _defaultMaxWithdrawal;
    }

    /// @notice Set the default withdrawal cooldown interval (in seconds)
    function setDefaultWithdrawalInterval(uint256 _defaultWithdrawalInterval) external onlyOwner {
        defaultWithdrawalInterval = _defaultWithdrawalInterval;
    }

    /// @notice Set the default strict purpose requirement
    function setDefaultStrictPurpose(bool _defaultStrictPurpose) external onlyOwner {
        defaultStrictPurpose = _defaultStrictPurpose;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Deploy a CookieJar for a garden+asset pair via CookieJarFactory
    /// @dev Uses ERC1155 access type with the garden's gardener hat ID from Hats Protocol.
    ///      Hats are ERC1155 tokens, so CookieJar's built-in ERC1155 access gating gives us
    ///      Hats-based permissions without any custom authorization logic. Using the gardener
    ///      hat allows gardeners, operators, and owners to withdraw (Hats tree inheritance).
    function _createJar(address garden, address asset) internal returns (address jar) {
        // Resolve the gardener hat ID for this garden
        (,,, uint256 gardenerHatId,,,,) = hatsModule.getGardenHatIds(garden);

        // Use the configured Hats Protocol contract address (ERC1155)
        address hatsContract = hatsProtocol;

        // Build jar config: Variable withdrawal, no fee, garden as owner
        ICookieJarFactory.JarConfig memory jarConfig = ICookieJarFactory.JarConfig({
            jarOwner: garden,
            supportedCurrency: asset,
            feeCollector: garden, // fees go to garden itself (0% fee anyway)
            accessType: ICookieJarFactory.AccessType.ERC1155,
            withdrawalOption: ICookieJarFactory.WithdrawalTypeOptions.Variable,
            strictPurpose: defaultStrictPurpose,
            emergencyWithdrawalEnabled: true,
            oneTimeWithdrawal: false,
            fixedAmount: 0,
            maxWithdrawal: defaultMaxWithdrawal,
            withdrawalInterval: defaultWithdrawalInterval,
            minDeposit: 0,
            feePercentageOnDeposit: 0, // 0% fee for Green Goods jars
            maxWithdrawalPerPeriod: 0, // Unlimited
            metadata: "",
            multiTokenConfig: ICookieJarFactory.MultiTokenConfig({
                enabled: false,
                maxSlippagePercent: 0,
                minSwapAmount: 0,
                defaultFee: 0
            })
        });

        // Access config: ERC1155 gated by the garden's gardener hat
        ICookieJarFactory.AccessConfig memory accessConfig = ICookieJarFactory.AccessConfig({
            allowlist: new address[](0),
            nftRequirement: ICookieJarFactory.NftRequirement({
                nftContract: hatsContract,
                tokenId: gardenerHatId,
                minBalance: 1,
                isPoapEventGate: false
            })
        });

        // Multi-token config (disabled)
        ICookieJarFactory.MultiTokenConfig memory multiTokenConfig =
            ICookieJarFactory.MultiTokenConfig({ enabled: false, maxSlippagePercent: 0, minSwapAmount: 0, defaultFee: 0 });

        jar = cookieJarFactory.createCookieJar(jarConfig, accessConfig, multiTokenConfig);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UUPS Upgrade
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Authorizes an upgrade to a new implementation
    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner { }
}
