// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { IGardenAccessControl } from "../interfaces/IGardenAccessControl.sol";
import { IHatsModule } from "../interfaces/IHatsModule.sol";
import { ICVSyncPowerFacet } from "../interfaces/ICVSyncPowerFacet.sol";
import { IHats } from "../interfaces/IHats.sol";
import { IHatsModuleFactory } from "../interfaces/IHatsModuleFactory.sol";
import { IKarmaGAPModule } from "../interfaces/IKarmaGAPModule.sol";
import { HatsLib } from "../lib/Hats.sol";

/// @title HatsModule
/// @notice Adapts Hats Protocol for Green Goods access control
/// @dev Implements IGardenAccessControl + IHatsModule
///
/// **Architecture:**
/// - Each garden configures six hat IDs: owner, operator, evaluator, gardener, funder, community
/// - Hat tree creation and role management are centralized here
/// - Resolvers and UI call into this module for Hats-based permissions
contract HatsModule is
    IGardenAccessControl,
    IHatsModule,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    // ═══════════════════════════════════════════════════════════════════════════
    // Types
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Hat configuration for a garden
    struct GardenHats {
        uint256 ownerHatId;
        uint256 operatorHatId;
        uint256 evaluatorHatId;
        uint256 gardenerHatId;
        uint256 funderHatId;
        uint256 communityHatId;
        uint256 adminHatId;
        bool configured;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Emitted when a garden's hat configuration is set
    event GardenConfigured(
        address indexed garden,
        uint256 ownerHatId,
        uint256 operatorHatId,
        uint256 evaluatorHatId,
        uint256 gardenerHatId,
        uint256 funderHatId,
        uint256 communityHatId
    );

    /// @notice Emitted when a garden's hat configuration is removed
    event GardenDeconfigured(address indexed garden);

    /// @notice Emitted when the Hats contract address is updated
    event HatsContractUpdated(address indexed oldHats, address indexed newHats);

    /// @notice Emitted when the GardenToken address is updated
    event GardenTokenUpdated(address indexed oldGardenToken, address indexed newGardenToken);

    /// @notice Emitted when the KarmaGAPModule address is updated
    event KarmaGAPModuleUpdated(address indexed oldModule, address indexed newModule);

    /// @notice Emitted when eligibility module addresses are updated
    event EligibilityModulesUpdated(address indexed funderModule, address indexed communityModule);

    /// @notice Emitted when the HatsModuleFactory address is updated
    event EligibilityModuleFactoryUpdated(address indexed oldFactory, address indexed newFactory);

    /// @notice Emitted when the community min balance is updated
    event CommunityMinBalanceUpdated(uint256 oldMinBalance, uint256 newMinBalance);

    /// @notice Emitted when protocol hat IDs are updated
    event ProtocolHatIdsUpdated(uint256 communityHatId, uint256 gardensHatId, uint256 protocolGardenersHatId);

    // ═══════════════════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════════════════

    error ZeroAddress();
    error GardenNotConfigured(address garden);
    error InvalidHatId();
    error NotGardenAdmin(address caller, address garden);
    error NotGardenToken(address caller);
    error HatsNotConfigured();
    error NotHatAdmin(address caller, uint256 hatId);
    error ArrayLengthMismatch();
    error GardenAlreadyConfigured(address garden);
    error TooManyStrategies(uint256 count, uint256 max);
    error InvalidStrategyAddress(address strategy);
    error DuplicateStrategy(address strategy);

    // ═══════════════════════════════════════════════════════════════════════════
    // Constants
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Maximum number of conviction strategies per garden (bounds gas in _syncConvictionPower)
    uint256 public constant MAX_CONVICTION_STRATEGIES = 10;

    /// @notice Gas stipend for each syncPower external call to prevent gas griefing
    /// @dev A malicious strategy could consume all remaining gas, starving subsequent strategies.
    ///      100k gas accommodates strategies with cold SSTORE operations (20k each) while
    ///      preventing griefing. Worst case: 10 strategies * 100k = 1M gas for sync.
    uint256 internal constant SYNC_POWER_GAS_STIPEND = 100_000;

    // ═══════════════════════════════════════════════════════════════════════════
    // Storage
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice The Hats Protocol contract
    IHats public hats;

    /// @notice GardenToken contract address (authorized to create hat trees)
    address public gardenToken;

    /// @notice KarmaGAPModule for syncing project admins
    IKarmaGAPModule public karmaGAPModule;

    /// @notice HatsModuleFactory for eligibility module clones
    IHatsModuleFactory public hatsModuleFactory;

    /// @notice Eligibility module for funder hats (AllowlistEligibility clone)
    address public funderEligibilityModule;

    /// @notice Eligibility module for community hats (ERC20Eligibility clone)
    address public communityEligibilityModule;

    /// @notice Minimum ERC20 balance required for community hats
    uint256 public communityMinBalance;

    /// @notice Protocol top hat ID (community governance)
    uint256 public communityHatId;

    /// @notice Gardens hat ID (parent for per-garden admin hats)
    uint256 public gardensHatId;

    /// @notice Protocol gardeners hat ID (optional protocol-wide gardener role)
    uint256 public protocolGardenersHatId;

    /// @notice Hat configuration per garden
    mapping(address garden => GardenHats config) public gardenHats;

    /// @notice GardensModule authorized to register conviction strategies
    address public gardensModule;

    /// @notice Addresses authorized to configure gardens (e.g., migration scripts)
    mapping(address => bool) public configAuthority;

    /// @notice Conviction voting strategies per garden for power sync on role revocation
    mapping(address garden => address[] strategies) internal gardenConvictionStrategies;

    /// @notice Monotonic counter for generating unique burn addresses during hat revocation.
    /// @dev Each revocation transfers the hat to a unique address derived from this nonce,
    ///      preventing AlreadyWearingHat reverts when the same hat type is revoked from
    ///      multiple users (or the same user after re-grant). See _revokeRole().
    uint256 private _revokeNonce;

    /// @notice Storage gap for future upgrades
    /// @dev Verified storage layout (forge inspect src/modules/Hats.sol:HatsModule storage-layout):
    ///
    ///      Inherited (OZ upgradeable bases):
    ///        Slot 0       : Initializable (_initialized, _initializing)
    ///        Slots 1-50   : Initializable __gap[50]
    ///        Slot 51      : OwnableUpgradeable (_owner)
    ///        Slots 52-100 : OwnableUpgradeable __gap[49]
    ///        Slot 101     : ReentrancyGuardUpgradeable (_status)
    ///        Slots 102-150: ReentrancyGuardUpgradeable __gap[49]
    ///
    ///      HatsModule own storage (15 vars, slots 151-165):
    ///        Slot 151: hats (IHats)
    ///        Slot 152: gardenToken (address)
    ///        Slot 153: karmaGAPModule (IKarmaGAPModule)
    ///        Slot 154: hatsModuleFactory (IHatsModuleFactory)
    ///        Slot 155: funderEligibilityModule (address)
    ///        Slot 156: communityEligibilityModule (address)
    ///        Slot 157: communityMinBalance (uint256)
    ///        Slot 158: communityHatId (uint256)
    ///        Slot 159: gardensHatId (uint256)
    ///        Slot 160: protocolGardenersHatId (uint256)
    ///        Slot 161: gardensModule (address)
    ///        Slot 162: gardenHats (mapping)
    ///        Slot 163: configAuthority (mapping)
    ///        Slot 164: gardenConvictionStrategies (mapping)
    ///        Slot 165: _revokeNonce (uint256)
    ///
    ///      Gap (slots 166-200): 15 vars + 35 gap = 50 slots total for HatsModule.
    ///      When adding new storage variables, decrease __gap size by the same number of slots.
    uint256[35] private __gap;

    // ═══════════════════════════════════════════════════════════════════════════
    // Constructor & Initializer
    // ═══════════════════════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the adapter
    /// @param _owner The owner address
    /// @param _hats The Hats Protocol contract address
    function initialize(address _owner, address _hats) external initializer {
        if (_owner == address(0)) revert ZeroAddress();
        if (_hats == address(0)) revert ZeroAddress();

        __Ownable_init();
        __ReentrancyGuard_init();
        _transferOwnership(_owner);

        hats = IHats(_hats);
        emit HatsContractUpdated(address(0), _hats);

        // Default eligibility modules for this chain (may be zero)
        funderEligibilityModule = HatsLib.getAllowlistEligibilityModule();
        communityEligibilityModule = HatsLib.getERC20EligibilityModule();
        communityMinBalance = 1;

        // Default protocol hat IDs for supported chains (may be zero)
        if (HatsLib.isSupported()) {
            communityHatId = HatsLib.getCommunityHatId();
            gardensHatId = HatsLib.getGardensHatId();
            protocolGardenersHatId = HatsLib.getProtocolGardenersHatId();
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // IGardenAccessControl Implementation (called by garden)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IGardenAccessControl
    /// @dev Checks if account wears the gardener hat for msg.sender (the garden)
    function isGardener(address account) external view override returns (bool) {
        return _checkRole(msg.sender, account, GardenRole.Gardener);
    }

    /// @inheritdoc IGardenAccessControl
    /// @dev Checks if account wears the operator hat for msg.sender (the garden)
    function isOperator(address account) external view override returns (bool) {
        return _checkRole(msg.sender, account, GardenRole.Operator);
    }

    /// @inheritdoc IGardenAccessControl
    /// @dev Checks if account wears the evaluator hat for msg.sender (the garden)
    function isEvaluator(address account) external view override returns (bool) {
        return _checkRole(msg.sender, account, GardenRole.Evaluator);
    }

    /// @inheritdoc IGardenAccessControl
    /// @dev Checks if account wears the owner hat for msg.sender (the garden)
    function isOwner(address account) external view override returns (bool) {
        return _checkRole(msg.sender, account, GardenRole.Owner);
    }

    /// @inheritdoc IGardenAccessControl
    /// @dev Checks if account wears the funder hat for msg.sender (the garden)
    function isFunder(address account) external view override returns (bool) {
        return _checkRole(msg.sender, account, GardenRole.Funder);
    }

    /// @inheritdoc IGardenAccessControl
    /// @dev Checks if account wears the community hat for msg.sender (the garden)
    function isCommunity(address account) external view override returns (bool) {
        return _checkRole(msg.sender, account, GardenRole.Community);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Garden-Specific Queries (for external use)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Strict hat check — returns true only if the account wears the gardener hat.
    /// @dev Unlike GardenAccount.isGardener(), this does NOT include operator/owner hierarchy.
    ///      GardenAccount applies inclusive hierarchy (owner→operator→evaluator→gardener),
    ///      while these functions check the exact hat. Callers should prefer GardenAccount
    ///      for permission checks and these functions for exact hat membership queries.
    ///      Reverts with GardenNotConfigured if the garden has no hat tree. Use isConfigured()
    ///      to check first when calling directly (not through GardenAccount).
    function isGardenerOf(address garden, address account) public view override returns (bool) {
        return _checkRole(garden, account, GardenRole.Gardener);
    }

    function isEvaluatorOf(address garden, address account) public view override returns (bool) {
        return _checkRole(garden, account, GardenRole.Evaluator);
    }

    function isOperatorOf(address garden, address account) public view override returns (bool) {
        return _checkRole(garden, account, GardenRole.Operator);
    }

    function isOwnerOf(address garden, address account) public view override returns (bool) {
        return _checkRole(garden, account, GardenRole.Owner);
    }

    function isFunderOf(address garden, address account) public view override returns (bool) {
        return _checkRole(garden, account, GardenRole.Funder);
    }

    function isCommunityOf(address garden, address account) public view override returns (bool) {
        return _checkRole(garden, account, GardenRole.Community);
    }

    /// @notice Check if a garden is configured with Hats
    /// @param garden The garden address
    /// @return True if garden has hat configuration
    function isConfigured(address garden) external view returns (bool) {
        return gardenHats[garden].configured;
    }

    /// @inheritdoc IHatsModule
    function getGardenHatIds(address garden)
        external
        view
        override
        returns (
            uint256, // ownerHatId
            uint256, // operatorHatId
            uint256, // evaluatorHatId
            uint256, // gardenerHatId
            uint256, // funderHatId
            uint256, // communityHatId
            uint256, // adminHatId
            bool // configured
        )
    {
        GardenHats storage config = gardenHats[garden];
        return (
            config.ownerHatId,
            config.operatorHatId,
            config.evaluatorHatId,
            config.gardenerHatId,
            config.funderHatId,
            config.communityHatId,
            config.adminHatId,
            config.configured
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Garden Hat Tree Lifecycle
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IHatsModule
    function createGardenHatTree(
        address garden,
        string calldata name,
        address communityToken
    )
        external
        override
        returns (uint256 adminHatId)
    {
        if (msg.sender != gardenToken) revert NotGardenToken(msg.sender);
        if (garden == address(0)) revert ZeroAddress();
        if (gardenHats[garden].configured) revert GardenAlreadyConfigured(garden);

        uint256 gardensHat = gardensHatId;
        if (gardensHat == 0) revert HatsNotConfigured();
        if (!hats.isAdminOfHat(address(this), gardensHat)) {
            revert NotHatAdmin(address(this), gardensHat);
        }

        // Create garden admin hat under Gardens hat.
        // Use address(this) as default eligibility/toggle module — the real Hats Protocol
        // rejects address(0). Since HatsModule doesn't implement IHatsEligibility/IHatsToggle,
        // the Hats Protocol falls back to defaults (hat is active, all wearers are eligible).
        // _configureEligibilityModules() overrides eligibility for specific roles afterwards.
        address defaultModule = address(this);
        adminHatId = hats.createHat(
            gardensHat, _buildDetails(name, "Admin"), type(uint32).max, defaultModule, defaultModule, true, ""
        );

        // Mint admin hat to garden account + module (for role administration)
        hats.mintHat(adminHatId, garden);
        hats.mintHat(adminHatId, address(this));

        // Create role hats under admin hat
        uint256 ownerHatId = hats.createHat(
            adminHatId, _buildDetails(name, "Owner"), type(uint32).max, defaultModule, defaultModule, true, ""
        );
        uint256 operatorHatId = hats.createHat(
            adminHatId, _buildDetails(name, "Operator"), type(uint32).max, defaultModule, defaultModule, true, ""
        );
        uint256 evaluatorHatId = hats.createHat(
            adminHatId, _buildDetails(name, "Evaluator"), type(uint32).max, defaultModule, defaultModule, true, ""
        );
        uint256 gardenerHatId = hats.createHat(
            adminHatId, _buildDetails(name, "Gardener"), type(uint32).max, defaultModule, defaultModule, true, ""
        );
        uint256 funderHatId = hats.createHat(
            adminHatId, _buildDetails(name, "Funder"), type(uint32).max, defaultModule, defaultModule, true, ""
        );
        uint256 communityHatIdLocal = hats.createHat(
            adminHatId, _buildDetails(name, "Community"), type(uint32).max, defaultModule, defaultModule, true, ""
        );

        _configureEligibilityModules(funderHatId, communityHatIdLocal, operatorHatId, communityToken);

        gardenHats[garden] = GardenHats({
            ownerHatId: ownerHatId,
            operatorHatId: operatorHatId,
            evaluatorHatId: evaluatorHatId,
            gardenerHatId: gardenerHatId,
            funderHatId: funderHatId,
            communityHatId: communityHatIdLocal,
            adminHatId: adminHatId,
            configured: true
        });

        emit GardenHatTreeCreated(garden, adminHatId);
        emit GardenConfigured(
            garden, ownerHatId, operatorHatId, evaluatorHatId, gardenerHatId, funderHatId, communityHatIdLocal
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Role Management
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IHatsModule
    function grantRole(address garden, address account, GardenRole role) external override {
        _requireOwnerOrOperator(garden);
        _grantRole(garden, account, role);
    }

    /// @inheritdoc IHatsModule
    function revokeRole(address garden, address account, GardenRole role) external override nonReentrant {
        _requireOwnerOrOperator(garden);
        _revokeRole(garden, account, role);
    }

    /// @inheritdoc IHatsModule
    function grantRoles(address garden, address[] calldata accounts, GardenRole[] calldata roles) external override {
        _requireOwnerOrOperator(garden);
        if (accounts.length != roles.length) revert ArrayLengthMismatch();

        for (uint256 i = 0; i < accounts.length; i++) {
            _grantRole(garden, accounts[i], roles[i]);
        }
    }

    /// @inheritdoc IHatsModule
    function revokeRoles(
        address garden,
        address[] calldata accounts,
        GardenRole[] calldata roles
    )
        external
        override
        nonReentrant
    {
        _requireOwnerOrOperator(garden);
        if (accounts.length != roles.length) revert ArrayLengthMismatch();

        for (uint256 i = 0; i < accounts.length; i++) {
            _revokeRole(garden, accounts[i], roles[i]);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Manual Configuration (migration / admin)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Configure hat IDs for a garden (manual override)
    /// @dev Can be called by owner, config authority, or garden itself.
    ///      Sets adminHatId to 0 because manual configuration does not create a hat tree —
    ///      the admin hat is only tracked for gardens created via createGardenHatTree().
    ///      External consumers should check adminHatId != 0 to distinguish tree-created vs manual gardens.
    function configureGarden(
        address garden,
        uint256 ownerHatId,
        uint256 operatorHatId,
        uint256 evaluatorHatId,
        uint256 gardenerHatId,
        uint256 funderHatId,
        uint256 communityHatIdParam
    )
        external
    {
        if (msg.sender != owner() && !configAuthority[msg.sender] && msg.sender != garden) {
            revert NotGardenAdmin(msg.sender, garden);
        }

        if (garden == address(0)) revert ZeroAddress();
        if (
            ownerHatId == 0 || operatorHatId == 0 || evaluatorHatId == 0 || gardenerHatId == 0 || funderHatId == 0
                || communityHatIdParam == 0
        ) {
            revert InvalidHatId();
        }

        gardenHats[garden] = GardenHats({
            ownerHatId: ownerHatId,
            operatorHatId: operatorHatId,
            evaluatorHatId: evaluatorHatId,
            gardenerHatId: gardenerHatId,
            funderHatId: funderHatId,
            communityHatId: communityHatIdParam,
            adminHatId: 0,
            configured: true
        });

        emit GardenConfigured(
            garden, ownerHatId, operatorHatId, evaluatorHatId, gardenerHatId, funderHatId, communityHatIdParam
        );
    }

    /// @notice Remove hat configuration for a garden
    /// @dev Reverts garden to native access control
    function deconfigureGarden(address garden) external {
        if (msg.sender != owner() && !configAuthority[msg.sender] && msg.sender != garden) {
            revert NotGardenAdmin(msg.sender, garden);
        }

        delete gardenHats[garden];
        delete gardenConvictionStrategies[garden];
        emit GardenDeconfigured(garden);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Admin Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Update the Hats Protocol contract address
    function setHatsContract(address _hats) external onlyOwner {
        if (_hats == address(0)) revert ZeroAddress();
        address oldHats = address(hats);
        hats = IHats(_hats);
        emit HatsContractUpdated(oldHats, _hats);
    }

    /// @notice Set the GardenToken address authorized to create hat trees
    function setGardenToken(address _gardenToken) external onlyOwner {
        if (_gardenToken == address(0)) revert ZeroAddress();
        address oldGardenToken = gardenToken;
        gardenToken = _gardenToken;
        emit GardenTokenUpdated(oldGardenToken, _gardenToken);
    }

    /// @notice Set the KarmaGAPModule address for syncing project admins
    function setKarmaGAPModule(address _karmaGAPModule) external onlyOwner {
        if (_karmaGAPModule == address(0)) revert ZeroAddress();
        address oldModule = address(karmaGAPModule);
        karmaGAPModule = IKarmaGAPModule(_karmaGAPModule);
        emit KarmaGAPModuleUpdated(oldModule, _karmaGAPModule);
    }

    /// @notice Update eligibility modules used for funder/community hats
    /// @dev These should be module implementation addresses for cloning (AllowlistEligibility / ERC20Eligibility)
    function setEligibilityModules(address _funderModule, address _communityModule) external onlyOwner {
        funderEligibilityModule = _funderModule;
        communityEligibilityModule = _communityModule;
        emit EligibilityModulesUpdated(_funderModule, _communityModule);
    }

    /// @notice Set the HatsModuleFactory used for eligibility module clones
    function setEligibilityModuleFactory(address _factory) external onlyOwner {
        address oldFactory = address(hatsModuleFactory);
        hatsModuleFactory = IHatsModuleFactory(_factory);
        emit EligibilityModuleFactoryUpdated(oldFactory, _factory);
    }

    /// @notice Set the minimum ERC20 balance required for community hats
    function setCommunityMinBalance(uint256 _minBalance) external onlyOwner {
        uint256 oldBalance = communityMinBalance;
        communityMinBalance = _minBalance;
        emit CommunityMinBalanceUpdated(oldBalance, _minBalance);
    }

    /// @inheritdoc IHatsModule
    function setConvictionStrategies(address garden, address[] calldata strategies) external override {
        _requireOwnerOrOperator(garden);
        if (strategies.length > MAX_CONVICTION_STRATEGIES) {
            revert TooManyStrategies(strategies.length, MAX_CONVICTION_STRATEGIES);
        }
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i] == address(0) || strategies[i].code.length == 0) {
                revert InvalidStrategyAddress(strategies[i]);
            }
            for (uint256 j = 0; j < i; j++) {
                if (strategies[j] == strategies[i]) {
                    revert DuplicateStrategy(strategies[i]);
                }
            }
        }
        gardenConvictionStrategies[garden] = strategies;
        emit ConvictionStrategiesUpdated(garden, strategies);
    }

    /// @inheritdoc IHatsModule
    function getConvictionStrategies(address garden) external view override returns (address[] memory) {
        return gardenConvictionStrategies[garden];
    }

    /// @notice Set the GardensModule address authorized to register strategies
    function setGardensModule(address _gardensModule) external onlyOwner {
        if (_gardensModule == address(0)) revert ZeroAddress();
        gardensModule = _gardensModule;
    }

    /// @notice Add or remove a config authority
    function setConfigAuthority(address authority, bool authorized) external onlyOwner {
        if (authority == address(0)) revert ZeroAddress();
        configAuthority[authority] = authorized;
    }

    /// @notice Set protocol hat IDs for this chain
    /// @dev Allows configuring hats after creating the tree via Hats UI or scripts
    function setProtocolHatIds(
        uint256 _communityHatId,
        uint256 _gardensHatId,
        uint256 _protocolGardenersHatId
    )
        external
        onlyOwner
    {
        communityHatId = _communityHatId;
        gardensHatId = _gardensHatId;
        protocolGardenersHatId = _protocolGardenersHatId;
        emit ProtocolHatIdsUpdated(_communityHatId, _gardensHatId, _protocolGardenersHatId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    function _requireOwnerOrOperator(address garden) internal view {
        if (!gardenHats[garden].configured) revert GardenNotConfigured(garden);
        if (msg.sender == gardenToken) return;
        if (msg.sender == garden) return;
        if (msg.sender == gardensModule) return;
        if (!isOwnerOf(garden, msg.sender) && !isOperatorOf(garden, msg.sender)) {
            revert NotGardenAdmin(msg.sender, garden);
        }
    }

    function _grantRole(address garden, address account, GardenRole role) internal {
        if (account == address(0)) revert ZeroAddress();
        if (!gardenHats[garden].configured) revert GardenNotConfigured(garden);

        uint256 hatId = _getHatId(garden, role);
        hats.mintHat(hatId, account);

        // Auto-mint protocol-wide gardener hat (enables ENS name claims)
        // Best-effort: skip silently if already wearing or hat doesn't exist
        if (protocolGardenersHatId != 0) {
            if (!hats.isWearerOfHat(account, protocolGardenersHatId)) {
                try hats.mintHat(protocolGardenersHatId, account) { } catch { }
            }
        }

        emit RoleGranted(garden, account, role);

        if (role == GardenRole.Operator) {
            _syncProjectAdmin(garden, account, true);
            _grantSubRole(garden, account, GardenRole.Evaluator, "evaluator");
            _grantSubRole(garden, account, GardenRole.Gardener, "gardener");
        } else if (role == GardenRole.Owner) {
            // Only grant Operator as sub-role; Operator's own sub-grants
            // (Evaluator + Gardener) are handled recursively by _grantSubRole
            _grantSubRole(garden, account, GardenRole.Operator, "operator");
        }

        // Best-effort conviction power sync on role grant
        // Sync fires post-mint so strategies see updated hat state
        _syncConvictionPower(garden, account);
    }

    function _grantSubRole(address garden, address account, GardenRole role, string memory label) internal {
        uint256 hatId = _getHatId(garden, role);
        try hats.mintHat(hatId, account) {
            emit RoleGranted(garden, account, role);
            // Recursively grant sub-roles for Operator (Evaluator + Gardener + GAP sync)
            if (role == GardenRole.Operator) {
                _syncProjectAdmin(garden, account, true);
                _grantSubRole(garden, account, GardenRole.Gardener, "gardener");
            }
        } catch Error(string memory errorMsg) {
            emit PartialGrantFailed(garden, account, role, errorMsg);
        } catch {
            emit PartialGrantFailed(garden, account, role, label);
        }
    }

    function _revokeRole(address garden, address account, GardenRole role) internal {
        if (account == address(0)) revert ZeroAddress();
        if (!gardenHats[garden].configured) revert GardenNotConfigured(garden);

        uint256 hatId = _getHatId(garden, role);
        // Only transfer if the account currently wears the hat.
        // Hats Protocol reverts with AlreadyWearingHat if the recipient address already
        // wears the hat (e.g., 0xdead from a previous revocation of the same hat type).
        // We use a monotonic nonce to generate a unique burn address per revocation,
        // ensuring each transfer targets a fresh address that never wears the hat.
        if (hats.isWearerOfHat(account, hatId)) {
            address burnAddr = address(uint160(uint256(keccak256(abi.encodePacked("burn", _revokeNonce++)))));
            hats.transferHat(hatId, account, burnAddr);
        }
        emit RoleRevoked(garden, account, role);
        if (role == GardenRole.Operator) {
            _syncProjectAdmin(garden, account, false);
        }
        // Best-effort conviction power sync -- sync failure MUST NOT revert role revocation.
        // Sync fires post-transfer intentionally: strategies must see the updated hat state
        // (i.e., the account no longer wears the hat). This is correct even for double-revocation
        // or when the account still holds other garden roles -- strategies need the sync signal
        // to re-evaluate the member's total power across all roles they still hold.
        _syncConvictionPower(garden, account);
    }

    function _syncProjectAdmin(address garden, address account, bool add) internal {
        if (address(karmaGAPModule) == address(0)) return;
        if (add) {
            // solhint-disable-next-line no-empty-blocks
            try karmaGAPModule.addProjectAdmin(garden, account) { } catch { }
        } else {
            // solhint-disable-next-line no-empty-blocks
            try karmaGAPModule.removeProjectAdmin(garden, account) { } catch { }
        }
    }

    /// @notice Best-effort conviction power sync on role revocation
    /// @dev Iterates configured strategies and calls syncPower via ICVSyncPowerFacet.
    ///      Failures emit events but do NOT revert.
    ///
    ///      Architecture note: ICVSyncPowerFacet targets Gardens V2 diamond facets that
    ///      maintain per-member voting power. HypercertSignalPool does NOT implement this
    ///      interface — it uses lazy eligibility evaluation (isEligibleVoter checks Hats
    ///      at read time). The sync infrastructure is built for future Gardens V2 integration
    ///      where power registries require explicit sync on role changes.
    function _syncConvictionPower(address garden, address account) internal {
        address[] storage strategies = gardenConvictionStrategies[garden];
        uint256 len = strategies.length;
        if (len == 0) return;

        for (uint256 i = 0; i < len; i++) {
            address strategy = strategies[i];
            // solhint-disable-next-line no-empty-blocks
            try ICVSyncPowerFacet(strategy).syncPower{ gas: SYNC_POWER_GAS_STIPEND }(account) {
                emit ConvictionSyncTriggered(garden, account, strategy);
            } catch Error(string memory reason) {
                emit ConvictionSyncFailed(garden, account, strategy, reason);
            } catch {
                emit ConvictionSyncFailed(garden, account, strategy, "");
            }
        }
    }

    function _checkRole(address garden, address account, GardenRole role) internal view returns (bool) {
        GardenHats storage config = gardenHats[garden];
        if (!config.configured) revert GardenNotConfigured(garden);

        uint256 hatId = _getHatId(garden, role);
        return hats.isWearerOfHat(account, hatId);
    }

    function _getHatId(address garden, GardenRole role) internal view returns (uint256) {
        GardenHats storage config = gardenHats[garden];
        if (role == GardenRole.Owner) return config.ownerHatId;
        if (role == GardenRole.Operator) return config.operatorHatId;
        if (role == GardenRole.Evaluator) return config.evaluatorHatId;
        if (role == GardenRole.Gardener) return config.gardenerHatId;
        if (role == GardenRole.Funder) return config.funderHatId;
        return config.communityHatId;
    }

    function _buildDetails(string calldata name, string memory role) private pure returns (string memory) {
        if (bytes(name).length == 0) return role;
        return string(abi.encodePacked(name, " ", role));
    }

    function _configureEligibilityModules(
        uint256 funderHatId,
        uint256 communityHatIdParam,
        uint256 operatorHatId,
        address communityToken
    )
        internal
    {
        if (funderEligibilityModule != address(0)) {
            address funderModule = funderEligibilityModule;
            if (address(hatsModuleFactory) != address(0)) {
                bytes memory initData = abi.encode(operatorHatId, operatorHatId);
                try hatsModuleFactory.createHatsModule(funderEligibilityModule, funderHatId, "", initData, 0) returns (
                    address createdModule
                ) {
                    funderModule = createdModule;
                } catch {
                    emit EligibilityModuleCreationFailed(funderHatId, "funder");
                    funderModule = address(0);
                }
            }
            if (funderModule != address(0)) {
                try hats.changeHatEligibility(funderHatId, funderModule) { }
                catch {
                    emit EligibilityModuleCreationFailed(funderHatId, "funder");
                }
            }
        }

        if (communityEligibilityModule != address(0)) {
            address communityModule = communityEligibilityModule;
            if (address(hatsModuleFactory) != address(0)) {
                if (communityToken == address(0)) revert ZeroAddress();
                bytes memory otherArgs = abi.encodePacked(communityToken, communityMinBalance);
                try hatsModuleFactory.createHatsModule(communityEligibilityModule, communityHatIdParam, otherArgs, "", 0)
                returns (address createdModule) {
                    communityModule = createdModule;
                } catch {
                    emit EligibilityModuleCreationFailed(communityHatIdParam, "community");
                    communityModule = address(0);
                }
            }
            if (communityModule != address(0)) {
                try hats.changeHatEligibility(communityHatIdParam, communityModule) { }
                catch {
                    emit EligibilityModuleCreationFailed(communityHatIdParam, "community");
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UUPS Upgrade
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Authorizes an upgrade to a new implementation
    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner { }
}
