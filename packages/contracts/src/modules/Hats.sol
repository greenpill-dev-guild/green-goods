// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { IGardenAccessControl } from "../interfaces/IGardenAccessControl.sol";
import { IHatsModule } from "../interfaces/IHatsModule.sol";
import { HatsRoleSync } from "../lib/HatsRoleSync.sol";
import { HatsEligibilitySetup } from "../lib/HatsEligibilitySetup.sol";
import { IHats } from "../interfaces/IHats.sol";
import { IHatsModuleFactory } from "../interfaces/IHatsModuleFactory.sol";
import { IKarmaGAPModule } from "../interfaces/IKarmaGAPModule.sol";
import { IKarmaSyncObserver } from "../interfaces/IKarmaSyncObserver.sol";
import { HatsLib } from "../lib/Hats.sol";
import { ZeroAddress, ArrayLengthMismatch } from "../CommonErrors.sol";

/// @title HatsModule
/// @notice Adapts Hats Protocol for Green Goods access control
contract HatsModule is
    IGardenAccessControl,
    IHatsModule,
    IKarmaSyncObserver,
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

    error GardenNotConfigured(address garden);
    error InvalidHatId();
    error NotGardenAdmin(address caller, address garden);
    error NotGardenToken(address caller);
    error HatsNotConfigured();
    error NotHatAdmin(address caller, uint256 hatId);
    error GardenAlreadyConfigured(address garden);
    error TooManyStrategies(uint256 count, uint256 max);
    error InvalidStrategyAddress(address strategy);
    error DuplicateStrategy(address strategy);
    error NotGardenMember();
    error OwnerCannotLeave(address garden);

    /// @notice Maximum number of conviction strategies per garden (bounds gas in _syncConvictionPower)
    uint256 public constant MAX_CONVICTION_STRATEGIES = 10;

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

    /// @dev Retired: revocation burns hats now. The slot stays for the storage layout.
    uint256 private _revokeNonce;

    /// @notice Optional per-garden canonical steward change observer. Delivery remains permissionless.
    mapping(address garden => address observer) public stewardObserver;
    event StewardObserverSet(address indexed garden, address indexed observer);
    event StewardObserverDeferred(address indexed garden, address indexed account);

    struct ProtocolRoles {
        uint256 team;
        uint256 productLead;
        uint256 agents;
        uint256 deployer;
    }

    /// @notice Protocol roles are independent; only Team delegates garden Steward administration.
    ProtocolRoles public protocolRoleHats;
    event ProtocolRoleHatsUpdated(uint256 team, uint256 productLead, uint256 agents, uint256 deployer);
    event GardensToggleControllerUpdated(uint256 indexed gardensHat, address indexed controller);
    event RoleManaged(
        address indexed garden, address indexed actor, address indexed account, GardenRole role, bool granted
    );

    /// @notice Storage gap for future upgrades.
    /// @dev Slot layout: storage-layouts/HatsModule.json.
    ///      State and gap occupy 50 slots; consume gap slots when adding storage.
    uint256[30] private __gap;

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
    function isGardener(address account) external view override returns (bool) {
        return _checkRole(msg.sender, account, GardenRole.Gardener);
    }

    /// @inheritdoc IGardenAccessControl
    function isOperator(address account) external view override returns (bool) {
        return _checkRole(msg.sender, account, GardenRole.Steward);
    }

    /// @inheritdoc IGardenAccessControl
    function isEvaluator(address account) external view override returns (bool) {
        return _checkRole(msg.sender, account, GardenRole.Evaluator);
    }

    /// @inheritdoc IGardenAccessControl
    function isOwner(address account) external view override returns (bool) {
        return _checkRole(msg.sender, account, GardenRole.Owner);
    }

    /// @inheritdoc IGardenAccessControl
    function isFunder(address account) external view override returns (bool) {
        return _checkRole(msg.sender, account, GardenRole.Funder);
    }

    /// @inheritdoc IGardenAccessControl
    function isCommunity(address account) external view override returns (bool) {
        return _checkRole(msg.sender, account, GardenRole.Community);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Garden-Specific Queries (for external use)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Strict hat check; unlike GardenAccount, these queries do not include role hierarchy.
    /// @dev Prefer GardenAccount for permissions and these functions for exact hat membership.
    ///      Reverts with GardenNotConfigured; direct callers can check isConfigured() first.
    function isGardenerOf(address garden, address account) public view override returns (bool) {
        return _checkRole(garden, account, GardenRole.Gardener);
    }

    function isEvaluatorOf(address garden, address account) public view override returns (bool) {
        return _checkRole(garden, account, GardenRole.Evaluator);
    }

    function isStewardOf(address garden, address account) public view override returns (bool) {
        return _checkRole(garden, account, GardenRole.Steward);
    }

    function isOperatorOf(address garden, address account) public view override returns (bool) {
        return isStewardOf(garden, account);
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

        // The module administers role hats; garden accounts do not receive raw Hats administration.
        hats.mintHat(adminHatId, address(this));

        GardenHats memory config;
        // Create role hats under admin hat
        config.ownerHatId = hats.createHat(
            adminHatId, _buildDetails(name, "Owner"), type(uint32).max, defaultModule, defaultModule, true, ""
        );
        config.operatorHatId = hats.createHat(
            adminHatId, _buildDetails(name, "Steward"), type(uint32).max, defaultModule, defaultModule, true, ""
        );
        config.evaluatorHatId = hats.createHat(
            adminHatId, _buildDetails(name, "Evaluator"), type(uint32).max, defaultModule, defaultModule, true, ""
        );
        config.gardenerHatId = hats.createHat(
            adminHatId, _buildDetails(name, "Gardener"), type(uint32).max, defaultModule, defaultModule, true, ""
        );
        config.funderHatId = hats.createHat(
            adminHatId, _buildDetails(name, "Funder"), type(uint32).max, defaultModule, defaultModule, true, ""
        );
        config.communityHatId = hats.createHat(
            adminHatId, _buildDetails(name, "Community"), type(uint32).max, defaultModule, defaultModule, true, ""
        );

        _configureEligibilityModules(config.funderHatId, config.communityHatId, config.operatorHatId, communityToken);

        config.adminHatId = adminHatId;
        config.configured = true;
        gardenHats[garden] = config;

        emit GardenHatTreeCreated(garden, adminHatId);
        emit GardenConfigured(
            garden,
            config.ownerHatId,
            config.operatorHatId,
            config.evaluatorHatId,
            config.gardenerHatId,
            config.funderHatId,
            config.communityHatId
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Role Management
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IHatsModule
    function grantRole(address garden, address account, GardenRole role) external override nonReentrant {
        // Preserve open joining without letting a garden account bypass role-specific authorization.
        if (msg.sender != garden || role != GardenRole.Gardener) _requireRoleManager(garden, account, role, false);
        _grantRole(garden, account, role);
        emit RoleManaged(garden, msg.sender, account, role, true);
    }

    /// @inheritdoc IHatsModule
    function revokeRole(address garden, address account, GardenRole role) external override nonReentrant {
        _requireRoleManager(garden, account, role, true);
        _revokeRole(garden, account, role);
        emit RoleManaged(garden, msg.sender, account, role, false);
    }

    /// @inheritdoc IHatsModule
    function grantRoles(
        address garden,
        address[] calldata accounts,
        GardenRole[] calldata roles
    )
        external
        override
        nonReentrant
    {
        if (accounts.length != roles.length) revert ArrayLengthMismatch();

        for (uint256 i = 0; i < accounts.length; i++) {
            _requireRoleManager(garden, accounts[i], roles[i], false);
            _grantRole(garden, accounts[i], roles[i]);
            emit RoleManaged(garden, msg.sender, accounts[i], roles[i], true);
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
        if (accounts.length != roles.length) revert ArrayLengthMismatch();

        for (uint256 i = 0; i < accounts.length; i++) {
            _requireRoleManager(garden, accounts[i], roles[i], true);
            _revokeRole(garden, accounts[i], roles[i]);
            emit RoleManaged(garden, msg.sender, accounts[i], roles[i], false);
        }
    }

    /// @inheritdoc IHatsModule
    function leaveGarden(address garden) external override nonReentrant {
        if (isOwnerOf(garden, msg.sender)) revert OwnerCannotLeave(garden);
        bool wasMember;
        for (uint256 i = 0; i <= uint256(type(GardenRole).max); i++) {
            if (!_checkRole(garden, msg.sender, GardenRole(i))) continue;
            _revokeRole(garden, msg.sender, GardenRole(i));
            wasMember = true;
        }
        if (!wasMember) revert NotGardenMember();
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
        if (msg.sender != owner() && !configAuthority[msg.sender]) {
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
        if (msg.sender != owner() && !configAuthority[msg.sender]) {
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

    /// @notice Configure the observer without giving it authority to change source roles.
    /// @dev Setting zero disables notification. Public refresh still reads canonical state directly.
    function setStewardObserver(address garden, address observer) external nonReentrant {
        // Preserve the deployed one-time bootstrap capability without allowing observer replacement.
        if (msg.sender != owner() && (!configAuthority[msg.sender] || stewardObserver[garden] != address(0))) {
            revert NotGardenAdmin(msg.sender, garden);
        }
        if (!gardenHats[garden].configured) revert GardenNotConfigured(garden);
        if (observer != address(0) && observer.code.length == 0) revert ZeroAddress();
        stewardObserver[garden] = observer;
        emit StewardObserverSet(garden, observer);
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

    /// @notice Set independent protocol role IDs. Zero disables that role's module integration.
    /// @dev Governance retains membership, eligibility and toggle administration in Hats itself.
    function setProtocolRoleHats(uint256 team, uint256 productLead, uint256 agents, uint256 deployer) external onlyOwner {
        _setProtocolRoleHats(team, productLead, agents, deployer);
    }

    /// @notice Configure delegation and move the Gardens toggle to the existing governance controller.
    /// @dev The owner controls Hats.setHatStatus through its normal governance execution route.
    ///      Require the handoff to preserve the current effective status; other role toggles are untouched.
    function configureProtocolAdministration(
        uint256 team,
        uint256 productLead,
        uint256 agents,
        uint256 deployer
    )
        external
        onlyOwner
        nonReentrant
    {
        _setProtocolRoleHats(team, productLead, agents, deployer);
        bool beforeStatus = hats.isActive(gardensHatId);
        hats.changeHatToggle(gardensHatId, owner());
        bool afterStatus = hats.isActive(gardensHatId);
        if (afterStatus != beforeStatus) revert InvalidHatId();
        emit GardensToggleControllerUpdated(gardensHatId, owner());
    }

    function _setProtocolRoleHats(uint256 team, uint256 productLead, uint256 agents, uint256 deployer) private {
        uint256[4] memory ids = [team, productLead, agents, deployer];
        if (!HatsLib.areProtocolRolesValid(hats, gardensHatId, ids)) revert InvalidHatId();
        protocolRoleHats = ProtocolRoles(team, productLead, agents, deployer);
        emit ProtocolRoleHatsUpdated(team, productLead, agents, deployer);
    }

    /// @notice Live Team membership, including the Hat's eligibility and active state.
    function isProtocolTeam(address account) public view returns (bool) {
        uint256 team = protocolRoleHats.team;
        return team != 0 && hats.isWearerOfHat(account, team);
    }

    /// @notice Release C compatibility: remove obsolete raw administration from garden accounts.
    function revokeAccountAdminHats(address[] calldata gardens) external onlyOwner {
        for (uint256 i = 0; i < gardens.length; i++) {
            uint256 adminHatId = gardenHats[gardens[i]].adminHatId;
            if (adminHatId != 0) hats.setHatWearerStatus(adminHatId, gardens[i], false, false);
        }
    }

    function _requireRoleManager(address garden, address account, GardenRole role, bool revoke) internal view {
        if (!gardenHats[garden].configured) revert GardenNotConfigured(garden);
        if (msg.sender == owner() || msg.sender == gardenToken || msg.sender == gardensModule) return;
        if (isOwnerOf(garden, msg.sender)) return;
        if (role == GardenRole.Steward && isProtocolTeam(msg.sender)) return;
        // A local Steward cannot promote an Owner or strip an Owner's subordinate roles.
        if (role == GardenRole.Owner || (revoke && isOwnerOf(garden, account)) || !isOperatorOf(garden, msg.sender)) {
            revert NotGardenAdmin(msg.sender, garden);
        }
    }

    function _requireOwnerOrOperator(address garden) internal view {
        if (!gardenHats[garden].configured) revert GardenNotConfigured(garden);
        if (msg.sender == owner()) return;
        if (msg.sender == gardenToken) return;
        if (msg.sender == gardensModule) return;
        if (!isOwnerOf(garden, msg.sender) && !isOperatorOf(garden, msg.sender)) {
            revert NotGardenAdmin(msg.sender, garden);
        }
    }

    function _grantRole(address garden, address account, GardenRole role) internal {
        if (account == address(0)) revert ZeroAddress();
        if (!gardenHats[garden].configured) revert GardenNotConfigured(garden);

        uint256 hatId = _getHatId(garden, role);
        bool alreadyWearingRole = hats.isWearerOfHat(account, hatId);
        if (!alreadyWearingRole) {
            hats.mintHat(hatId, account);
            emit RoleGranted(garden, account, role);
        }

        // Auto-mint protocol-wide gardener hat (enables ENS name claims)
        // Best-effort: skip silently if already wearing or hat doesn't exist
        if (protocolGardenersHatId != 0) {
            if (!hats.isWearerOfHat(account, protocolGardenersHatId)) {
                try hats.mintHat(protocolGardenersHatId, account) { } catch { }
            }
        }

        if (role == GardenRole.Steward) {
            _grantSubRole(garden, account, GardenRole.Evaluator, "evaluator");
            _grantSubRole(garden, account, GardenRole.Gardener, "gardener");
        } else if (role == GardenRole.Owner) {
            // Only grant Operator as sub-role; Operator's own sub-grants
            // (Evaluator + Gardener) are handled recursively by _grantSubRole
            _grantSubRole(garden, account, GardenRole.Steward, "operator");
        }
        if (role == GardenRole.Owner || role == GardenRole.Steward) _syncProjectAdmin(garden, account, true);

        // Best-effort conviction power sync on role grant
        // Sync fires post-mint so strategies see updated hat state
        _syncConvictionPower(garden, account);
        _notifyStewardObserver(garden, account, role);
    }

    function _grantSubRole(address garden, address account, GardenRole role, string memory label) internal {
        uint256 hatId = _getHatId(garden, role);
        if (hats.isWearerOfHat(account, hatId)) {
            return;
        }

        try hats.mintHat(hatId, account) {
            emit RoleGranted(garden, account, role);
            if (role == GardenRole.Steward) {
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
        if (hats.isWearerOfHat(account, hatId)) {
            // Burned as the hat's eligibility module, not moved: a burn address would keep wearing it and read
            // as a member. Good standing lets the same account be granted the hat again.
            hats.setHatWearerStatus(hatId, account, false, true);
        }
        emit RoleRevoked(garden, account, role);
        _notifyStewardObserver(garden, account, role);
        if (role == GardenRole.Owner || role == GardenRole.Steward) {
            _syncProjectAdmin(garden, account, isOwnerOf(garden, account) || isStewardOf(garden, account));
        }
        // Best-effort conviction power sync -- sync failure MUST NOT revert role revocation.
        // Sync fires post-transfer intentionally: strategies must see the updated hat state
        // (i.e., the account no longer wears the hat). This is correct even for double-revocation
        // or when the account still holds other garden roles -- strategies need the sync signal
        // to re-evaluate the member's total power across all roles they still hold.
        _syncConvictionPower(garden, account);
    }

    function _syncProjectAdmin(address garden, address account, bool add) internal {
        HatsRoleSync.projectAdmin(karmaGAPModule, garden, account, add);
    }

    function _syncConvictionPower(address garden, address account) internal {
        HatsRoleSync.convictionPower(gardenConvictionStrategies[garden], garden, account);
    }

    function _notifyStewardObserver(address garden, address account, GardenRole role) private {
        if (
            (role == GardenRole.Owner || role == GardenRole.Steward)
                && !HatsRoleSync.notifyStewardObserver(stewardObserver[garden], account)
        ) emit StewardObserverDeferred(garden, account);
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
        if (role == GardenRole.Steward) return config.operatorHatId;
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
        uint256 communityHatIdLocal,
        uint256 operatorHatId,
        address communityToken
    )
        internal
    {
        HatsEligibilitySetup.configure(
            HatsEligibilitySetup.Config(
                hats, hatsModuleFactory, funderEligibilityModule, communityEligibilityModule, communityMinBalance
            ),
            funderHatId,
            communityHatIdLocal,
            operatorHatId,
            communityToken
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UUPS Upgrade
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Authorizes an upgrade to a new implementation
    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner { }
}
