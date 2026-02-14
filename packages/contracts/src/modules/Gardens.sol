// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IGardensModule } from "../interfaces/IGardensModule.sol";
import { IHatsModule } from "../interfaces/IHatsModule.sol";
import {
    IRegistryFactory,
    IRegistryCommunity,
    INFTPowerRegistry,
    INFTPowerRegistryFactory,
    NFTPowerSource
} from "../interfaces/IGardensV2.sol";

/// @title GardensModule
/// @notice Orchestrates Gardens V2 community + signal pool creation on garden mint
/// @dev Implements IGardensModule. UUPS upgradeable with Hats-gated admin.
///
/// **Architecture:**
/// - Called by GardenToken during mintGarden() via try/catch (failure MUST NOT revert mint)
/// - Deploys one NFTPowerRegistry per garden with role-weighted voting power
/// - Creates one RegistryCommunity per garden using shared GOODS token
/// - Creates two signal pools: HypercertSignalPool + ActionSignalPool
/// - Registers pools in HatsModule for conviction sync on role revocation
contract GardensModule is IGardensModule, OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════════════════

    error ZeroAddress();
    error NotGardenToken(address caller);
    error GardenAlreadyInitialized(address garden);
    error GardenNotInitialized(address garden);
    error PoolsAlreadyExist(address garden);
    error InvalidWeightScheme();

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

    /// @notice GOODS amount per member for community staking (1 GOODS)
    uint256 public constant STAKE_AMOUNT_PER_MEMBER = 1e18;

    // ═══════════════════════════════════════════════════════════════════════════
    // Storage
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice The GardenToken contract (authorized caller for onGardenMinted)
    address public gardenToken;

    /// @notice The Gardens V2 RegistryFactory
    IRegistryFactory public registryFactory;

    /// @notice The NFTPowerRegistry factory
    INFTPowerRegistryFactory public powerRegistryFactory;

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

    /// @notice NFTPowerRegistry per garden
    mapping(address garden => address registry) public gardenPowerRegistries;

    /// @notice Whether a garden has been initialized
    mapping(address garden => bool initialized) public gardenInitialized;

    /// @notice Storage gap for future upgrades
    /// @dev 11 storage vars + 39 gap = 50 slots total
    uint256[39] private __gap;

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
    /// @param _powerRegistryFactory NFTPowerRegistry factory address (address(0) allowed for testnet)
    /// @param _goodsToken GOODS token address (address(0) allowed for testnet, set later via setGoodsToken)
    /// @param _hatsProtocol Hats Protocol address
    /// @param _hatsModule HatsModule address
    function initialize(
        address _owner,
        address _registryFactory,
        address _powerRegistryFactory,
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
        powerRegistryFactory = INFTPowerRegistryFactory(_powerRegistryFactory);
        goodsToken = IERC20(_goodsToken);
        hatsProtocol = _hatsProtocol;
        hatsModule = IHatsModule(_hatsModule);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Garden Mint Callback
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IGardensModule
    /// @dev Called by GardenToken during mint. All external calls wrapped in try/catch.
    function onGardenMinted(
        address garden,
        WeightScheme scheme
    )
        external
        override
        nonReentrant
        returns (address community, address[] memory pools)
    {
        if (msg.sender != gardenToken) revert NotGardenToken(msg.sender);
        if (garden == address(0)) revert ZeroAddress();
        if (gardenInitialized[garden]) revert GardenAlreadyInitialized(garden);

        // Store weight scheme immediately (even if later steps fail)
        gardenWeightSchemes[garden] = scheme;
        gardenInitialized[garden] = true;

        // Step 1: Deploy NFTPowerRegistry with role weights
        address registry = _deployPowerRegistry(garden, scheme);
        if (registry != address(0)) {
            gardenPowerRegistries[garden] = registry;
        }

        // Step 2: Create RegistryCommunity via factory
        community = _createCommunity(garden);
        if (community != address(0)) {
            gardenCommunities[garden] = community;
        }

        // Step 3: Create signal pools
        pools = _createSignalPools(garden, community, registry);
        if (pools.length > 0) {
            for (uint256 i = 0; i < pools.length; i++) {
                gardenSignalPools[garden].push(pools[i]);
            }
        }

        // Step 4: Register pools in HatsModule for conviction sync
        _registerPoolsInHatsModule(garden, pools);

        // Emit partial initialization warning if community or pools creation failed
        if (community == address(0) || pools.length < 2) {
            emit GardenPartiallyInitialized(garden, community != address(0), pools.length >= 2);
        }

        return (community, pools);
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
    function getGardenPowerRegistry(address garden) external view override returns (address) {
        return gardenPowerRegistries[garden];
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
        if (address(powerRegistryFactory) == address(0)) return (false, "powerRegistryFactory not set");
        if (address(goodsToken) == address(0)) return (false, "goodsToken not set");
        if (hatsProtocol == address(0)) return (false, "hatsProtocol not set");
        if (address(hatsModule) == address(0)) return (false, "hatsModule not set");
        return (true, "");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Admin Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Set the GardenToken address authorized to call onGardenMinted
    function setGardenToken(address _gardenToken) external onlyOwner {
        if (_gardenToken == address(0)) revert ZeroAddress();
        gardenToken = _gardenToken;
    }

    /// @notice Set the RegistryFactory address
    function setRegistryFactory(address _registryFactory) external onlyOwner {
        if (_registryFactory == address(0)) revert ZeroAddress();
        registryFactory = IRegistryFactory(_registryFactory);
    }

    /// @notice Set the NFTPowerRegistry factory address
    function setPowerRegistryFactory(address _powerRegistryFactory) external onlyOwner {
        if (_powerRegistryFactory == address(0)) revert ZeroAddress();
        powerRegistryFactory = INFTPowerRegistryFactory(_powerRegistryFactory);
    }

    /// @notice Set the GOODS token address
    function setGoodsToken(address _goodsToken) external onlyOwner {
        if (_goodsToken == address(0)) revert ZeroAddress();
        goodsToken = IERC20(_goodsToken);
    }

    /// @notice Set the Hats Protocol address
    function setHatsProtocol(address _hatsProtocol) external onlyOwner {
        if (_hatsProtocol == address(0)) revert ZeroAddress();
        hatsProtocol = _hatsProtocol;
    }

    /// @notice Set the HatsModule address
    function setHatsModule(address _hatsModule) external onlyOwner {
        if (_hatsModule == address(0)) revert ZeroAddress();
        hatsModule = IHatsModule(_hatsModule);
    }

    /// @notice Reset garden initialization to allow re-running onGardenMinted
    /// @dev Use when partial failure leaves garden in half-configured state
    function resetGardenInitialization(address garden) external onlyOwner {
        gardenInitialized[garden] = false;
        delete gardenCommunities[garden];
        delete gardenSignalPools[garden];
        delete gardenPowerRegistries[garden];
        delete gardenWeightSchemes[garden];
        emit GardenInitializationReset(garden);
    }

    /// @notice Retry community creation for a garden that had a partial failure
    /// @dev Garden must be initialized but have no community set
    function retryCreateCommunity(address garden) external onlyOwner returns (address community) {
        if (!gardenInitialized[garden]) revert GardenNotInitialized(garden);
        if (gardenCommunities[garden] != address(0)) revert GardenAlreadyInitialized(garden);
        community = _createCommunity(garden);
        if (community != address(0)) {
            gardenCommunities[garden] = community;
        }
    }

    /// @notice Retry signal pool creation for a garden that had a partial failure
    /// @dev Garden must have a community but no pools
    function retryCreatePools(address garden) external onlyOwner returns (address[] memory pools) {
        if (!gardenInitialized[garden]) revert GardenNotInitialized(garden);
        address community = gardenCommunities[garden];
        if (community == address(0)) revert ZeroAddress();
        if (gardenSignalPools[garden].length > 0) revert PoolsAlreadyExist(garden);
        address registry = gardenPowerRegistries[garden];

        pools = _createSignalPools(garden, community, registry);
        if (pools.length > 0) {
            for (uint256 i = 0; i < pools.length; i++) {
                gardenSignalPools[garden].push(pools[i]);
            }
            _registerPoolsInHatsModule(garden, pools);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal — Weight Schemes
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Resolve weight scheme to (community, gardener, operator) weights in basis points
    /// @dev Linear(100,200,300), Exponential(200,400,1600), Power(300,900,8100)
    function _getWeights(WeightScheme scheme)
        internal
        pure
        returns (uint256 communityW, uint256 gardenerW, uint256 operatorW)
    {
        if (scheme == WeightScheme.Linear) return (100, 200, 300);
        if (scheme == WeightScheme.Exponential) return (200, 400, 1600);
        if (scheme == WeightScheme.Power) return (300, 900, 8100);
        revert InvalidWeightScheme();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal — Deploy Power Registry
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Deploy NFTPowerRegistry with role-weighted sources
    /// @dev Returns address(0) gracefully if powerRegistryFactory or hatsProtocol is not set.
    ///      This is expected on testnets where Gardens V2 infra is not yet deployed — the zero
    ///      check allows onGardenMinted to proceed with partial initialization (power registry
    ///      skipped, pools may still be created if registryFactory is set).
    function _deployPowerRegistry(address garden, WeightScheme scheme) internal returns (address registry) {
        if (address(powerRegistryFactory) == address(0)) return address(0);
        if (hatsProtocol == address(0)) return address(0);

        (uint256 communityW, uint256 gardenerW, uint256 operatorW) = _getWeights(scheme);

        // Get hat IDs from HatsModule — we need operator, gardener, community hats
        // These are available after createGardenHatTree() which runs before onGardenMinted
        (, uint256 operatorHatId,, uint256 gardenerHatId,, uint256 communityHatId,,) = _getGardenHats(garden);

        // Guard: hat IDs must be non-zero to avoid deploying a registry with top-hat defaults
        if (operatorHatId == 0 || gardenerHatId == 0 || communityHatId == 0) {
            emit CommunityCreationFailed(garden, "Hat IDs not available");
            return address(0);
        }

        NFTPowerSource[] memory sources = new NFTPowerSource[](3);
        sources[0] = NFTPowerSource({ hatsProtocol: hatsProtocol, hatId: operatorHatId, weight: operatorW });
        sources[1] = NFTPowerSource({ hatsProtocol: hatsProtocol, hatId: gardenerHatId, weight: gardenerW });
        sources[2] = NFTPowerSource({ hatsProtocol: hatsProtocol, hatId: communityHatId, weight: communityW });

        // solhint-disable-next-line no-empty-blocks
        try powerRegistryFactory.deploy(sources) returns (address deployed) {
            registry = deployed;
            emit PowerRegistryDeployed(garden, registry, scheme);
        } catch Error(string memory reason) {
            emit CommunityCreationFailed(garden, reason);
        } catch {
            emit CommunityCreationFailed(garden, "PowerRegistry deploy failed");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal — Create Community
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Create a RegistryCommunity for the garden
    /// @dev Returns address(0) gracefully if registryFactory is not set (testnet deployment
    ///      where Gardens V2 RegistryFactory is unavailable). Callers handle the zero return
    ///      via partial initialization flow.
    function _createCommunity(address garden) internal returns (address community) {
        if (address(registryFactory) == address(0)) return address(0);

        IRegistryFactory.CreateCommunityParams memory params = IRegistryFactory.CreateCommunityParams({
            gardenToken: address(goodsToken),
            registerStakeAmount: STAKE_AMOUNT_PER_MEMBER,
            communityFee: 0,
            feeReceiver: address(0),
            councilSafe: garden, // Garden account (TBA) acts as council Safe
            communityName: "Green Goods Community",
            isKickEnabled: false,
            covenantIpfsHash: ""
        });

        // solhint-disable-next-line no-empty-blocks
        try registryFactory.createRegistryCommunity(params) returns (address created) {
            community = created;
            emit CommunityCreated(
                garden, community, gardenWeightSchemes[garden], address(goodsToken), gardenPowerRegistries[garden]
            );
        } catch Error(string memory reason) {
            emit CommunityCreationFailed(garden, reason);
        } catch {
            emit CommunityCreationFailed(garden, "Community creation failed");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal — Create Signal Pools
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Create HypercertSignalPool and ActionSignalPool
    function _createSignalPools(
        address garden,
        address community,
        address registry
    )
        internal
        returns (address[] memory pools)
    {
        if (community == address(0)) return new address[](0);

        pools = new address[](2);
        uint256 created = 0;

        // Pool 1: HypercertSignalPool
        IRegistryCommunity.CVParams memory cvParams = IRegistryCommunity.CVParams({
            maxRatio: DEFAULT_MAX_RATIO,
            weight: DEFAULT_WEIGHT,
            decay: DEFAULT_DECAY,
            minThresholdPoints: DEFAULT_MIN_THRESHOLD_POINTS
        });

        address hypercertPool =
            _createPool(community, IRegistryCommunity.PointSystem.Custom, cvParams, registry, "Hypercert Signal Pool");
        if (hypercertPool != address(0)) {
            pools[created++] = hypercertPool;
            emit SignalPoolCreated(garden, hypercertPool, PoolType.HypercertSignal, community);
        }

        // Pool 2: ActionSignalPool
        address actionPool =
            _createPool(community, IRegistryCommunity.PointSystem.Custom, cvParams, registry, "Action Signal Pool");
        if (actionPool != address(0)) {
            pools[created++] = actionPool;
            emit SignalPoolCreated(garden, actionPool, PoolType.ActionSignal, community);
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

    /// @notice Create a single conviction pool
    function _createPool(
        address community,
        IRegistryCommunity.PointSystem pointSystem,
        IRegistryCommunity.CVParams memory cvParams,
        address registry,
        string memory metadata
    )
        internal
        returns (address strategy)
    {
        IRegistryCommunity.CreatePoolParams memory params = IRegistryCommunity.CreatePoolParams({
            pointSystem: pointSystem,
            cvParams: cvParams,
            votingPowerRegistry: registry,
            initialMembers: new address[](0),
            metadata: metadata
        });

        // solhint-disable-next-line no-empty-blocks
        try IRegistryCommunity(community).createPool(params) returns (uint256, address _strategy) {
            strategy = _strategy;
        } catch {
            emit PoolCreationFailed(community, community, metadata);
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
            // Registration failed — non-blocking
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
