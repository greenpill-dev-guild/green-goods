// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IGardenAccount } from "../interfaces/IGardenAccount.sol";
import { IGardensModule } from "../interfaces/IGardensModule.sol";
import { IHatsModule } from "../interfaces/IHatsModule.sol";
import {
    IRegistryFactory,
    IRegistryCommunity,
    IUnifiedPowerRegistry,
    RegistryCommunityInitializeParamsV2,
    CVStrategyInitializeParamsV0_3,
    CVParams,
    PointSystem,
    ProposalType,
    PointSystemConfig,
    ArbitrableConfig,
    Metadata,
    NFTPowerSource,
    NFTType
} from "../interfaces/IGardensV2.sol";

/// @notice Minimal interface for GOODS token minting
interface IGoodsToken {
    function mint(address to, uint256 amount) external;
}

/// @title GardensModule
/// @notice Orchestrates Gardens V2 community + signal pool creation on garden mint
/// @dev Implements IGardensModule. UUPS upgradeable with Hats-gated admin.
///
/// **Architecture:**
/// - Called by GardenToken during mintGarden() via try/catch (failure MUST NOT revert mint)
/// - Registers per-garden voting power sources in a unified power registry
/// - Creates one RegistryCommunity per garden using shared GOODS token
/// - Creates two signal pools: ActionSignalPool + HypercertSignalPool
/// - Registers pools in HatsModule for conviction sync on role revocation
contract GardensModule is IGardensModule, OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════════════════

    error ZeroAddress();
    error NotGardenToken(address caller);
    error NotGardenOperator();
    error GardenAlreadyInitialized(address garden);
    error GardenNotInitialized(address garden);
    error PoolsAlreadyExist(address garden);
    error InvalidWeightScheme();
    error FactoriesNotConfigured(string missing);
    error OnlySelfCall();

    // ═══════════════════════════════════════════════════════════════════════════
    // Constants
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Default conviction voting parameters (Gardens V2 defaults)
    /// @dev decay=0.9999799 (D=10^7 scale), maxRatio=0.2, weight=0.001, minThresholdPoints=0.25
    uint256 public constant DEFAULT_DECAY = 9_999_799;
    uint256 public constant DEFAULT_MAX_RATIO = 2_000_000;
    uint256 public constant DEFAULT_WEIGHT = 10_000;
    uint256 public constant DEFAULT_MIN_THRESHOLD_POINTS = 2_500_000;
    uint256 public constant D = 10_000_000; // Scaling factor for CV params

    /// @notice Initial member slots for treasury seeding (mint enough GOODS for ~100 members)
    uint256 public constant INITIAL_MEMBER_SLOTS = 100;
    /// @notice Shared metadata pointers used for all Action and Hypercert signaling pools.
    string internal constant ACTION_SIGNAL_POOL_METADATA = "Green Goods Action Focus Signaling Pool";
    string internal constant HYPERCERT_SIGNAL_POOL_METADATA = "Green Goods Hypercert Signaling Pool";

    // ═══════════════════════════════════════════════════════════════════════════
    // Storage
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice The GardenToken contract (authorized caller for onGardenMinted)
    address public gardenToken;

    /// @notice The Gardens V2 RegistryFactory
    IRegistryFactory public registryFactory;

    /// @notice The unified power registry (single instance for all gardens)
    IUnifiedPowerRegistry public powerRegistry;

    /// @notice GOODS protocol token for community staking
    IERC20 public goodsToken;

    /// @notice Hats Protocol address
    address public hatsProtocol;

    /// @notice HatsModule for hat queries and strategy registration
    IHatsModule public hatsModule;

    /// @notice Community address per garden
    mapping(address garden => address community) public gardenCommunities;

    /// @notice Signal pool addresses per garden
    mapping(address garden => address[] pools) internal gardenSignalPools;

    /// @notice Weight scheme per garden
    mapping(address garden => WeightScheme scheme) public gardenWeightSchemes;

    /// @notice Whether a garden has been initialized
    mapping(address garden => bool initialized) public gardenInitialized;

    /// @notice GOODS amount per member for community staking (configurable, default 1 GOODS)
    uint256 public stakeAmountPerMember;

    /// @notice When true, onGardenMinted reverts if registryFactory or powerRegistry is missing
    /// @dev Enable for production deployments to prevent partial initialization
    bool public requireFullSetup;

    /// @notice Allo Protocol address (required for createRegistry params)
    address public alloAddress;

    /// @notice Council safe used for all newly created Green Goods communities
    /// @dev Defaults to owner at initialization; can be set to protocol multisig.
    address public communityCouncilSafe;

    /// @notice Storage gap for future upgrades
    /// @dev 14 storage vars + 36 gap = 50 slots total
    uint256[36] private __gap;

    // ═══════════════════════════════════════════════════════════════════════════
    // Constructor & Initializer
    // ═══════════════════════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the GardensModule
    /// @param _owner The owner address
    /// @param _registryFactory Gardens V2 RegistryFactory address (address(0) allowed for testnet)
    /// @param _powerRegistry UnifiedPowerRegistry address (address(0) allowed for testnet)
    /// @param _goodsToken GOODS token address (address(0) allowed for testnet, set later via setGoodsToken)
    /// @param _hatsProtocol Hats Protocol address
    /// @param _hatsModule HatsModule address
    function initialize(
        address _owner,
        address _registryFactory,
        address _powerRegistry,
        address _goodsToken,
        address _hatsProtocol,
        address _hatsModule
    )
        external
        initializer
    {
        if (_owner == address(0)) revert ZeroAddress();

        __Ownable_init();
        __ReentrancyGuard_init();
        _transferOwnership(_owner);

        registryFactory = IRegistryFactory(_registryFactory);
        powerRegistry = IUnifiedPowerRegistry(_powerRegistry);
        goodsToken = IERC20(_goodsToken);
        hatsProtocol = _hatsProtocol;
        hatsModule = IHatsModule(_hatsModule);
        stakeAmountPerMember = 1e18; // Default: 1 GOODS per member
        communityCouncilSafe = _owner;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Garden Mint Callback
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IGardensModule
    /// @dev Called by GardenToken during mint. All external calls wrapped in try/catch.
    ///      Community is created FIRST (independent), then power registry, then pools.
    ///      If pool creation fails, garden still initializes — operators can call createGardenPools() later.
    // solhint-disable-next-line code-complexity
    function onGardenMinted(
        address garden,
        WeightScheme scheme,
        string calldata gardenName
    )
        external
        override
        nonReentrant
        returns (address community, address[] memory pools)
    {
        if (msg.sender != gardenToken) revert NotGardenToken(msg.sender);
        if (garden == address(0)) revert ZeroAddress();
        if (gardenInitialized[garden]) revert GardenAlreadyInitialized(garden);

        // Fail fast in production mode if factories are not configured
        if (requireFullSetup) {
            if (address(registryFactory) == address(0)) revert FactoriesNotConfigured("registryFactory");
            if (address(powerRegistry) == address(0)) revert FactoriesNotConfigured("powerRegistry");
        }

        // Store weight scheme immediately (even if later steps fail)
        gardenWeightSchemes[garden] = scheme;
        gardenInitialized[garden] = true;

        // Step 1: Create community (independent, no deps on registry/pools)
        // gardenName is passed explicitly because the GardenAccount is not yet initialized
        // when this is called during mintGarden().
        community = _createCommunity(garden, gardenName);
        if (community != address(0)) {
            gardenCommunities[garden] = community;
        }

        // Step 2: Register power sources in unified registry (needs hats, NOT community)
        _registerGardenPower(garden, scheme);

        // Step 3: Seed GOODS treasury for member staking
        _seedGardenTreasury(garden, community);

        // Step 4: Attempt pool creation (separate try/catch from community creation)
        // Uses self-call pattern to enable try/catch on internal logic.
        // If this fails, garden still initializes — operators can call createGardenPools() later.
        if (community != address(0)) {
            // solhint-disable-next-line no-empty-blocks
            try this.attemptPoolCreation(garden, community, address(powerRegistry)) returns (address[] memory createdPools)
            {
                pools = createdPools;
                // Inner try/catch in _createPool may catch reverts gracefully (returning empty array)
                if (pools.length == 0) {
                    emit GardenPartiallyInitialized(garden, true, false);
                }
            } catch {
                pools = new address[](0);
                emit GardenPartiallyInitialized(garden, true, false);
            }
        } else {
            pools = new address[](0);
            emit GardenPartiallyInitialized(garden, false, false);
        }

        return (community, pools);
    }

    /// @notice Create and register signal pools — external for try/catch isolation
    /// @dev Only callable by this contract itself (self-call pattern). Enables try/catch
    ///      on pool creation logic within onGardenMinted. Does NOT use nonReentrant because
    ///      the parent call (onGardenMinted) already holds the reentrancy lock.
    function attemptPoolCreation(
        address garden,
        address community,
        address registry
    )
        external
        returns (address[] memory pools)
    {
        if (msg.sender != address(this)) revert OnlySelfCall();

        pools = _createSignalPools(garden, community, registry);
        if (pools.length > 0) {
            for (uint256 i = 0; i < pools.length; i++) {
                gardenSignalPools[garden].push(pools[i]);
            }
            _registerPoolsInPowerRegistry(garden, pools);
            _registerPoolsInHatsModule(garden, pools);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // View Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IGardensModule
    function getGardenCommunity(address garden) external view override returns (address) {
        return gardenCommunities[garden];
    }

    /// @inheritdoc IGardensModule
    function getGardenSignalPools(address garden) external view override returns (address[] memory) {
        return gardenSignalPools[garden];
    }

    /// @inheritdoc IGardensModule
    function getGardenWeightScheme(address garden) external view override returns (WeightScheme) {
        return gardenWeightSchemes[garden];
    }

    /// @inheritdoc IGardensModule
    /// @dev Returns the unified power registry if garden is registered, address(0) otherwise
    function getGardenPowerRegistry(address garden) external view override returns (address) {
        if (address(powerRegistry) != address(0) && powerRegistry.isGardenRegistered(garden)) {
            return address(powerRegistry);
        }
        return address(0);
    }

    /// @inheritdoc IGardensModule
    function isGardenInitialized(address garden) external view override returns (bool) {
        return gardenInitialized[garden];
    }

    /// @notice Check if all cross-module references are properly configured
    /// @dev Returns false if any required wiring is missing. Call after deployment to verify.
    /// @return wired True if all references are set
    /// @return missing Human-readable description of missing references
    function isWiringComplete() external view returns (bool wired, string memory missing) {
        if (gardenToken == address(0)) return (false, "gardenToken not set");
        if (address(registryFactory) == address(0)) return (false, "registryFactory not set");
        if (address(powerRegistry) == address(0)) return (false, "powerRegistry not set");
        if (address(goodsToken) == address(0)) return (false, "goodsToken not set");
        if (hatsProtocol == address(0)) return (false, "hatsProtocol not set");
        if (address(hatsModule) == address(0)) return (false, "hatsModule not set");
        return (true, "");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Pool Management
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IGardensModule
    /// @dev Garden must have a community. Callable by garden operators or protocol owner.
    function createGardenPools(address garden) external override nonReentrant returns (address[] memory pools) {
        // Access control: garden operator or owner
        if (msg.sender != owner()) {
            if (address(hatsModule) == address(0)) revert ZeroAddress();
            if (!hatsModule.isOperatorOf(garden, msg.sender)) revert NotGardenOperator();
        }

        return _executeCreatePools(garden);
    }

    /// @notice Internal pool creation logic shared by createGardenPools and retryCreatePools
    function _executeCreatePools(address garden) internal returns (address[] memory pools) {
        if (!gardenInitialized[garden]) revert GardenNotInitialized(garden);
        address community = gardenCommunities[garden];
        if (community == address(0)) revert ZeroAddress();
        if (gardenSignalPools[garden].length > 0) revert PoolsAlreadyExist(garden);

        pools = _createSignalPools(garden, community, address(powerRegistry));
        if (pools.length > 0) {
            for (uint256 i = 0; i < pools.length; i++) {
                gardenSignalPools[garden].push(pools[i]);
            }
            _registerPoolsInPowerRegistry(garden, pools);
            _registerPoolsInHatsModule(garden, pools);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Admin Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Set the GardenToken address authorized to call onGardenMinted
    function setGardenToken(address _gardenToken) external onlyOwner {
        if (_gardenToken == address(0)) revert ZeroAddress();
        emit ConfigUpdated("gardenToken", gardenToken, _gardenToken);
        gardenToken = _gardenToken;
    }

    /// @notice Set the RegistryFactory address
    function setRegistryFactory(address _registryFactory) external onlyOwner {
        if (_registryFactory == address(0)) revert ZeroAddress();
        emit ConfigUpdated("registryFactory", address(registryFactory), _registryFactory);
        registryFactory = IRegistryFactory(_registryFactory);
    }

    /// @notice Set the unified power registry address
    function setPowerRegistry(address _powerRegistry) external onlyOwner {
        if (_powerRegistry == address(0)) revert ZeroAddress();
        emit ConfigUpdated("powerRegistry", address(powerRegistry), _powerRegistry);
        powerRegistry = IUnifiedPowerRegistry(_powerRegistry);
    }

    /// @notice Set the GOODS token address
    function setGoodsToken(address _goodsToken) external onlyOwner {
        if (_goodsToken == address(0)) revert ZeroAddress();
        emit ConfigUpdated("goodsToken", address(goodsToken), _goodsToken);
        goodsToken = IERC20(_goodsToken);
    }

    /// @notice Set the Hats Protocol address
    function setHatsProtocol(address _hatsProtocol) external onlyOwner {
        if (_hatsProtocol == address(0)) revert ZeroAddress();
        emit ConfigUpdated("hatsProtocol", hatsProtocol, _hatsProtocol);
        hatsProtocol = _hatsProtocol;
    }

    /// @notice Set the HatsModule address
    function setHatsModule(address _hatsModule) external onlyOwner {
        if (_hatsModule == address(0)) revert ZeroAddress();
        emit ConfigUpdated("hatsModule", address(hatsModule), _hatsModule);
        hatsModule = IHatsModule(_hatsModule);
    }

    /// @notice Set the GOODS stake amount per community member
    function setStakeAmountPerMember(uint256 amount) external onlyOwner {
        emit StakeAmountUpdated(stakeAmountPerMember, amount);
        stakeAmountPerMember = amount;
    }

    /// @notice Enable or disable fail-fast validation for missing factories
    /// @dev Enable for production deployments to prevent partial initialization
    function setRequireFullSetup(bool _requireFullSetup) external onlyOwner {
        emit RequireFullSetupUpdated(_requireFullSetup);
        requireFullSetup = _requireFullSetup;
    }

    /// @notice Set the Allo Protocol address (required for createRegistry params)
    function setAlloAddress(address _alloAddress) external onlyOwner {
        if (_alloAddress == address(0)) revert ZeroAddress();
        emit ConfigUpdated("alloAddress", alloAddress, _alloAddress);
        alloAddress = _alloAddress;
    }

    /// @notice Set protocol council safe used for all new community creation
    function setCommunityCouncilSafe(address _communityCouncilSafe) external onlyOwner {
        if (_communityCouncilSafe == address(0)) revert ZeroAddress();
        emit ConfigUpdated("communityCouncilSafe", communityCouncilSafe, _communityCouncilSafe);
        communityCouncilSafe = _communityCouncilSafe;
    }

    /// @notice Reset garden initialization to allow re-running onGardenMinted
    /// @dev Use when partial failure leaves garden in half-configured state.
    ///      Also cleans up the UnifiedPowerRegistry so re-initialization can register fresh sources.
    function resetGardenInitialization(address garden) external onlyOwner {
        // Clean up power registry (sources + pool mappings) before clearing local state
        if (address(powerRegistry) != address(0)) {
            address[] memory pools = gardenSignalPools[garden];
            // solhint-disable-next-line no-empty-blocks
            try powerRegistry.deregisterGarden(garden, pools) {
                // Success — garden can be re-registered with fresh sources
            } catch {
                // Non-blocking — registry may not have this garden registered
            }
        }

        gardenInitialized[garden] = false;
        delete gardenCommunities[garden];
        delete gardenSignalPools[garden];
        delete gardenWeightSchemes[garden];
        emit GardenInitializationReset(garden);
    }

    /// @notice Retry community creation for a garden that had a partial failure
    /// @dev Garden must be initialized but have no community set.
    ///      Reads garden name from the (already initialized) GardenAccount.
    function retryCreateCommunity(address garden) external onlyOwner returns (address community) {
        if (!gardenInitialized[garden]) revert GardenNotInitialized(garden);
        if (gardenCommunities[garden] != address(0)) revert GardenAlreadyInitialized(garden);
        string memory gardenName;
        try IGardenAccount(garden).name() returns (string memory n) {
            gardenName = n;
        } catch { }
        community = _createCommunity(garden, gardenName);
        if (community != address(0)) {
            gardenCommunities[garden] = community;
            _seedGardenTreasury(garden, community);
        }
    }

    /// @notice Retry signal pool creation — owner-only entry point
    /// @dev Uses internal _executeCreatePools to avoid msg.sender change from external self-call
    function retryCreatePools(address garden) external onlyOwner returns (address[] memory pools) {
        return _executeCreatePools(garden);
    }

    /// @notice Seed GOODS treasury for an already-initialized garden.
    /// @dev Recovery helper used when community creation succeeds after initial mint flow.
    function seedGardenTreasury(address garden) external onlyOwner {
        if (!gardenInitialized[garden]) revert GardenNotInitialized(garden);
        address community = gardenCommunities[garden];
        if (community == address(0)) revert ZeroAddress();
        _seedGardenTreasury(garden, community);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal — Weight Schemes
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Resolve weight scheme to (community, gardener, operator) weights in basis points
    /// @dev Weights must be >= 10_000 so that HAT sources (balance=1) produce non-zero power
    ///      after integer division: (1 * weight) / 10_000 > 0.
    ///      Linear(10_000,20_000,30_000), Exponential(20_000,40_000,160_000), Power(30_000,90_000,810_000)
    function _getWeights(WeightScheme scheme)
        internal
        pure
        returns (uint256 communityW, uint256 gardenerW, uint256 operatorW)
    {
        if (scheme == WeightScheme.Linear) return (10_000, 20_000, 30_000);
        if (scheme == WeightScheme.Exponential) return (20_000, 40_000, 160_000);
        if (scheme == WeightScheme.Power) return (30_000, 90_000, 810_000);
        revert InvalidWeightScheme();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal — Register Garden Power
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Register power sources in the unified registry for a garden
    /// @dev Returns false gracefully if powerRegistry or hatsProtocol is not set.
    ///      This is expected on testnets where Gardens V2 infra is not yet deployed — the false
    ///      return allows onGardenMinted to proceed with partial initialization.
    function _registerGardenPower(address garden, WeightScheme scheme) internal returns (bool registered) {
        if (address(powerRegistry) == address(0)) return false;
        if (hatsProtocol == address(0)) return false;

        (uint256 communityW, uint256 gardenerW, uint256 operatorW) = _getWeights(scheme);

        // Get hat IDs from HatsModule — we need operator, gardener, community hats
        // These are available after createGardenHatTree() which runs before onGardenMinted
        (, uint256 operatorHatId,, uint256 gardenerHatId,, uint256 communityHatId,,) = _getGardenHats(garden);

        // Guard: hat IDs must be non-zero to avoid registering with top-hat defaults
        if (operatorHatId == 0 || gardenerHatId == 0 || communityHatId == 0) {
            emit CommunityCreationFailed(garden, "Hat IDs not available");
            return false;
        }

        NFTPowerSource[] memory sources = new NFTPowerSource[](3);
        sources[0] = NFTPowerSource({
            token: hatsProtocol,
            nftType: NFTType.HAT,
            weight: operatorW,
            tokenId: 0,
            hatId: operatorHatId
        });
        sources[1] = NFTPowerSource({
            token: hatsProtocol,
            nftType: NFTType.HAT,
            weight: gardenerW,
            tokenId: 0,
            hatId: gardenerHatId
        });
        sources[2] = NFTPowerSource({
            token: hatsProtocol,
            nftType: NFTType.HAT,
            weight: communityW,
            tokenId: 0,
            hatId: communityHatId
        });

        // solhint-disable-next-line no-empty-blocks
        try powerRegistry.registerGarden(garden, sources) {
            registered = true;
            emit GardenPowerRegistered(garden, scheme, sources.length);
        } catch Error(string memory reason) {
            emit CommunityCreationFailed(garden, reason);
        } catch {
            emit CommunityCreationFailed(garden, "PowerRegistry registration failed");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal — Create Community
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Create a RegistryCommunity for the garden
    /// @dev Returns address(0) gracefully if registryFactory is not set (testnet deployment
    ///      where Gardens V2 RegistryFactory is unavailable). Callers handle the zero return
    ///      via partial initialization flow.
    ///      Uses createRegistry() with RegistryCommunityInitializeParamsV2 matching the real
    ///      Gardens V2 RegistryFactory signature. _nonce and _registryFactory are set by the factory.
    function _createCommunity(address garden, string memory gardenName) internal returns (address community) {
        if (address(registryFactory) == address(0)) return address(0);
        address councilSafe = communityCouncilSafe == address(0) ? garden : communityCouncilSafe;

        RegistryCommunityInitializeParamsV2 memory params = RegistryCommunityInitializeParamsV2({
            _allo: alloAddress,
            _gardenToken: address(goodsToken),
            _registerStakeAmount: stakeAmountPerMember,
            _communityFee: 0,
            _nonce: 0, // Set by factory
            _registryFactory: address(0), // Set by factory
            _feeReceiver: address(0),
            _metadata: Metadata({ protocol: 1, pointer: "" }),
            _councilSafe: payable(councilSafe),
            _communityName: _resolveCommunityName(gardenName),
            _isKickEnabled: false,
            covenantIpfsHash: ""
        });

        // solhint-disable-next-line no-empty-blocks
        try registryFactory.createRegistry(params) returns (address created) {
            community = created;
            emit CommunityCreated(garden, community, gardenWeightSchemes[garden], address(goodsToken));
        } catch Error(string memory reason) {
            emit CommunityCreationFailed(garden, reason);
        } catch {
            emit CommunityCreationFailed(garden, "Community creation failed");
        }
    }

    /// @notice Seed a garden treasury with GOODS to cover initial member staking slots.
    /// @dev Non-blocking by design; duplicate attempts are ignored once funded.
    function _seedGardenTreasury(address garden, address community) internal {
        if (community == address(0)) return;
        if (address(goodsToken) == address(0)) return;

        uint256 treasuryAmount = stakeAmountPerMember * INITIAL_MEMBER_SLOTS;
        if (treasuryAmount == 0) return;
        if (goodsToken.balanceOf(garden) >= treasuryAmount) return;

        // solhint-disable-next-line no-empty-blocks
        try IGoodsToken(address(goodsToken)).mint(garden, treasuryAmount) {
            emit GardenTreasurySeeded(garden, treasuryAmount);
        } catch {
            // Non-blocking — garden can still initialize and be funded later.
        }
    }

    /// @notice Derive community name from garden name
    /// @dev Falls back to "Green Goods Community" if name is empty
    function _resolveCommunityName(string memory gardenName) internal pure returns (string memory) {
        if (bytes(gardenName).length > 0) {
            return string.concat(gardenName, " Community");
        }
        return "Green Goods Community";
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal — Create Signal Pools
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Create ActionSignalPool and HypercertSignalPool
    function _createSignalPools(
        address garden,
        address community,
        address registry
    )
        internal
        returns (address[] memory pools)
    {
        if (community == address(0)) return new address[](0);

        _attemptSignalPoolMembershipJoin(community, garden);

        pools = new address[](2);
        uint256 created = 0;

        CVParams memory cvParams = CVParams({
            maxRatio: DEFAULT_MAX_RATIO,
            weight: DEFAULT_WEIGHT,
            decay: DEFAULT_DECAY,
            minThresholdPoints: DEFAULT_MIN_THRESHOLD_POINTS
        });

        // Pool 1 (index 0): ActionSignalPool
        address actionPool =
            _createPool(garden, community, PointSystem.Custom, cvParams, registry, ACTION_SIGNAL_POOL_METADATA);
        if (actionPool != address(0)) {
            pools[created++] = actionPool;
            emit SignalPoolCreated(garden, actionPool, PoolType.ActionSignal, community);
        }

        // Pool 2 (index 1): HypercertSignalPool
        address hypercertPool =
            _createPool(garden, community, PointSystem.Custom, cvParams, registry, HYPERCERT_SIGNAL_POOL_METADATA);
        if (hypercertPool != address(0)) {
            pools[created++] = hypercertPool;
            emit SignalPoolCreated(garden, hypercertPool, PoolType.HypercertSignal, community);
        }

        // Trim array to actual count
        if (created < 2) {
            address[] memory trimmed = new address[](created);
            for (uint256 i = 0; i < created; i++) {
                trimmed[i] = pools[i];
            }
            return trimmed;
        }

        return pools;
    }

    /// @notice Best-effort member registration before pool creation for compatibility with stricter community setups.
    /// @dev Supports both known signatures:
    ///      - stakeAndRegisterMember(address)  (legacy/mock interface)
    ///      - stakeAndRegisterMember(string)   (newer gardens-v2 CommunityMemberFacet)
    ///      Failures are intentionally ignored to keep pool creation non-blocking.
    function _attemptSignalPoolMembershipJoin(address community, address garden) internal {
        // Legacy/address-based member registration path.
        // solhint-disable-next-line no-empty-blocks
        try IRegistryCommunity(community).stakeAndRegisterMember(garden) { } catch { }

        // Newer string-based covenant signature path.
        (bool ok,) = community.call(abi.encodeWithSelector(bytes4(0x9a1f46e2), ""));
        ok; // silence compiler warning for ignored result
    }

    /// @notice Create a single conviction pool via the 3-arg createPool signature
    /// @dev Matches gardens-v2 CommunityPoolFacet.createPool(address, CVStrategyInitializeParamsV0_3, Metadata).
    ///      Constructs the full V0_3 params with signaling defaults (no arbitration, no sybil, no streaming).
    function _createPool(
        address garden,
        address community,
        PointSystem pointSystem,
        CVParams memory cvParams,
        address registry,
        string memory metadataPointer
    )
        internal
        returns (address strategy)
    {
        CVStrategyInitializeParamsV0_3 memory strategyParams = CVStrategyInitializeParamsV0_3({
            cvParams: cvParams,
            proposalType: ProposalType.Signaling,
            pointSystem: pointSystem,
            pointConfig: PointSystemConfig({ maxAmount: 0 }),
            arbitrableConfig: ArbitrableConfig({
                arbitrator: address(0),
                tribunalSafe: address(0),
                submitterCollateralAmount: 0,
                challengerCollateralAmount: 0,
                defaultRuling: 0,
                defaultRulingTimeout: 0
            }),
            registryCommunity: community,
            votingPowerRegistry: registry,
            sybilScorer: address(0),
            sybilScorerThreshold: 0,
            initialAllowlist: new address[](0),
            superfluidToken: address(0),
            streamingRatePerSecond: 0
        });

        Metadata memory poolMetadata = Metadata({ protocol: 1, pointer: metadataPointer });

        // solhint-disable-next-line no-empty-blocks
        try IRegistryCommunity(community).createPool(address(0), strategyParams, poolMetadata) returns (
            uint256, address _strategy
        ) {
            strategy = _strategy;
        } catch {
            emit PoolCreationFailed(garden, community, metadataPointer);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal — Register Pools in Power Registry
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Register pool → garden mapping in the unified power registry
    function _registerPoolsInPowerRegistry(address garden, address[] memory pools) internal {
        if (address(powerRegistry) == address(0)) return;

        for (uint256 i = 0; i < pools.length; i++) {
            if (pools[i] != address(0)) {
                // solhint-disable-next-line no-empty-blocks
                try powerRegistry.registerPool(pools[i], garden) {
                    // Success
                } catch {
                    emit PoolRegistrationFailed(garden, pools[i], "PowerRegistry registration failed");
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal — Register Pools in HatsModule
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Register created pools in HatsModule for conviction sync
    function _registerPoolsInHatsModule(address garden, address[] memory pools) internal {
        if (pools.length == 0) return;
        if (address(hatsModule) == address(0)) return;

        // Filter out zero addresses
        uint256 validCount = 0;
        for (uint256 i = 0; i < pools.length; i++) {
            if (pools[i] != address(0)) validCount++;
        }
        if (validCount == 0) return;

        address[] memory validPools = new address[](validCount);
        uint256 j = 0;
        for (uint256 i = 0; i < pools.length; i++) {
            if (pools[i] != address(0)) {
                validPools[j++] = pools[i];
            }
        }

        // solhint-disable-next-line no-empty-blocks
        try hatsModule.setConvictionStrategies(garden, validPools) {
            // Success
        } catch {
            emit PoolRegistrationFailed(garden, address(hatsModule), "HatsModule strategy registration failed");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal — Get Hat IDs
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Get the hat configuration for a garden from HatsModule
    /// @dev Uses the type-safe IHatsModule.getGardenHatIds() interface function.
    ///      Previously used a raw staticcall to the gardenHats(address) mapping getter,
    ///      which was fragile across GardenHats struct layout changes (silent ABI decode
    ///      corruption). The interface function provides compile-time safety.
    function _getGardenHats(address garden)
        internal
        view
        returns (
            uint256 ownerHatId,
            uint256 operatorHatId,
            uint256 evaluatorHatId,
            uint256 gardenerHatId,
            uint256 funderHatId,
            uint256 communityHatId,
            uint256 adminHatId,
            bool configured
        )
    {
        if (address(hatsModule) == address(0)) return (0, 0, 0, 0, 0, 0, 0, false);
        return hatsModule.getGardenHatIds(garden);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UUPS Upgrade
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Authorizes an upgrade to a new implementation
    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner { }
}
