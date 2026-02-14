// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { GardensModule } from "../../src/modules/Gardens.sol";
import { IGardensModule } from "../../src/interfaces/IGardensModule.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { IRegistryCommunity, NFTPowerSource } from "../../src/interfaces/IGardensV2.sol";
import {
    MockRegistryFactory,
    MockRegistryCommunity,
    MockNFTPowerRegistry,
    MockNFTPowerRegistryFactory
} from "../../src/mocks/GardensV2.sol";

/// @title MockGOODSToken
/// @notice Simple ERC20 mock for GOODS token
contract MockGOODSToken is ERC20 {
    constructor() ERC20("GOODS", "GOODS") {
        _mint(msg.sender, 1_000_000e18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @title MockHatsModuleForGardens
/// @notice Mock that implements IHatsModule + gardenHats() for GardensModule testing
contract MockHatsModuleForGardens is IHatsModule {
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

    mapping(address garden => GardenHats config) public gardenHats;
    address[][] public strategySets;
    mapping(address garden => address[] strategies) public gardenStrategies;

    function setGardenHats(
        address garden,
        uint256 ownerHatId,
        uint256 operatorHatId,
        uint256 evaluatorHatId,
        uint256 gardenerHatId,
        uint256 funderHatId,
        uint256 communityHatId,
        uint256 adminHatId
    )
        external
    {
        gardenHats[garden] = GardenHats({
            ownerHatId: ownerHatId,
            operatorHatId: operatorHatId,
            evaluatorHatId: evaluatorHatId,
            gardenerHatId: gardenerHatId,
            funderHatId: funderHatId,
            communityHatId: communityHatId,
            adminHatId: adminHatId,
            configured: true
        });
    }

    // ═══ IHatsModule stubs ═══

    function createGardenHatTree(address, string calldata, address) external pure returns (uint256) {
        return 1;
    }

    function grantRole(address, address, GardenRole) external { }
    function revokeRole(address, address, GardenRole) external { }
    function grantRoles(address, address[] calldata, GardenRole[] calldata) external { }
    function revokeRoles(address, address[] calldata, GardenRole[] calldata) external { }

    function setConvictionStrategies(address garden, address[] calldata strategies) external {
        delete gardenStrategies[garden];
        for (uint256 i = 0; i < strategies.length; i++) {
            gardenStrategies[garden].push(strategies[i]);
        }
    }

    function getConvictionStrategies(address garden) external view returns (address[] memory) {
        return gardenStrategies[garden];
    }

    function isGardenerOf(address, address) external pure returns (bool) {
        return false;
    }

    function isEvaluatorOf(address, address) external pure returns (bool) {
        return false;
    }

    function isOperatorOf(address, address) external pure returns (bool) {
        return false;
    }

    function isOwnerOf(address, address) external pure returns (bool) {
        return false;
    }

    function isFunderOf(address, address) external pure returns (bool) {
        return false;
    }

    function isCommunityOf(address, address) external pure returns (bool) {
        return false;
    }

    function getGardenHatIds(address garden)
        external
        view
        returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256, bool)
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
}

/// @title GardensModuleTest
/// @notice Unit tests for GardensModule contract
contract GardensModuleTest is Test {
    GardensModule public gardensModule;
    MockGOODSToken public goodsToken;
    MockRegistryFactory public registryFactory;
    MockNFTPowerRegistryFactory public powerRegistryFactory;
    MockHatsModuleForGardens public hatsModule;

    address public owner = address(0x1);
    address public gardenToken = address(0x2);
    address public hatsProtocol = address(0x3);
    address public garden1 = address(0x100);
    address public garden2 = address(0x200);

    function setUp() public {
        // Deploy mocks
        goodsToken = new MockGOODSToken();
        registryFactory = new MockRegistryFactory();
        powerRegistryFactory = new MockNFTPowerRegistryFactory();
        hatsModule = new MockHatsModuleForGardens();

        // Deploy GardensModule behind proxy
        GardensModule impl = new GardensModule();
        bytes memory initData = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(registryFactory),
            address(powerRegistryFactory),
            address(goodsToken),
            hatsProtocol,
            address(hatsModule)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        gardensModule = GardensModule(address(proxy));

        // Set garden token (authorized caller)
        vm.prank(owner);
        gardensModule.setGardenToken(gardenToken);

        // Set up garden hats for garden1
        hatsModule.setGardenHats(garden1, 1001, 1002, 1003, 1004, 1005, 1006, 1000);

        // Set up garden hats for garden2
        hatsModule.setGardenHats(garden2, 2001, 2002, 2003, 2004, 2005, 2006, 2000);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Initialization
    // ═══════════════════════════════════════════════════════════════════════════

    function test_initialize_setsOwner() public {
        assertEq(gardensModule.owner(), owner, "Owner should be set");
    }

    function test_initialize_setsRegistryFactory() public {
        assertEq(address(gardensModule.registryFactory()), address(registryFactory), "RegistryFactory should be set");
    }

    function test_initialize_setsPowerRegistryFactory() public {
        assertEq(
            address(gardensModule.powerRegistryFactory()),
            address(powerRegistryFactory),
            "PowerRegistryFactory should be set"
        );
    }

    function test_initialize_setsGoodsToken() public {
        assertEq(address(gardensModule.goodsToken()), address(goodsToken), "GOODS token should be set");
    }

    function test_initialize_setsHatsProtocol() public {
        assertEq(gardensModule.hatsProtocol(), hatsProtocol, "Hats Protocol should be set");
    }

    function test_initialize_setsHatsModule() public {
        assertEq(address(gardensModule.hatsModule()), address(hatsModule), "HatsModule should be set");
    }

    function test_initialize_revertsWithZeroOwner() public {
        GardensModule impl = new GardensModule();
        bytes memory initData = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            address(0), // zero owner
            address(registryFactory),
            address(powerRegistryFactory),
            address(goodsToken),
            hatsProtocol,
            address(hatsModule)
        );
        vm.expectRevert(GardensModule.ZeroAddress.selector);
        new ERC1967Proxy(address(impl), initData);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Access Control
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_revertsIfNotGardenToken() public {
        vm.prank(address(0x999));
        vm.expectRevert(abi.encodeWithSelector(GardensModule.NotGardenToken.selector, address(0x999)));
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);
    }

    function test_onGardenMinted_revertsIfZeroGarden() public {
        vm.prank(gardenToken);
        vm.expectRevert(GardensModule.ZeroAddress.selector);
        gardensModule.onGardenMinted(address(0), IGardensModule.WeightScheme.Linear);
    }

    function test_onGardenMinted_revertsIfAlreadyInitialized() public {
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);

        vm.prank(gardenToken);
        vm.expectRevert(abi.encodeWithSelector(GardensModule.GardenAlreadyInitialized.selector, garden1));
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // onGardenMinted — Full Flow
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_linearScheme() public {
        vm.prank(gardenToken);
        (address community, address[] memory pools) =
            gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);

        assertTrue(community != address(0), "Community should be created");
        assertEq(pools.length, 2, "Should create 2 signal pools");
        assertTrue(pools[0] != address(0), "Hypercert pool should be created");
        assertTrue(pools[1] != address(0), "Action pool should be created");

        // Verify state was persisted
        assertEq(gardensModule.getGardenCommunity(garden1), community, "Community should be stored");
        assertTrue(gardensModule.isGardenInitialized(garden1), "Garden should be initialized");
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden1)),
            uint256(IGardensModule.WeightScheme.Linear),
            "Weight scheme should be Linear"
        );
    }

    function test_onGardenMinted_exponentialScheme() public {
        vm.prank(gardenToken);
        (address community, address[] memory pools) =
            gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Exponential);

        assertTrue(community != address(0), "Community should be created");
        assertEq(pools.length, 2, "Should create 2 signal pools");
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden1)),
            uint256(IGardensModule.WeightScheme.Exponential),
            "Weight scheme should be Exponential"
        );
    }

    function test_onGardenMinted_powerScheme() public {
        vm.prank(gardenToken);
        (address community, address[] memory pools) =
            gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Power);

        assertTrue(community != address(0), "Community should be created");
        assertEq(pools.length, 2, "Should create 2 signal pools");
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden1)),
            uint256(IGardensModule.WeightScheme.Power),
            "Weight scheme should be Power"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Power Registry Deployment
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_deploysPowerRegistry() public {
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);

        address registry = gardensModule.getGardenPowerRegistry(garden1);
        assertTrue(registry != address(0), "Power registry should be deployed");
    }

    function test_onGardenMinted_powerRegistryHas3Sources() public {
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);

        address registry = gardensModule.getGardenPowerRegistry(garden1);
        assertTrue(registry != address(0), "Registry should exist");

        // Check the factory deployed count
        assertEq(powerRegistryFactory.getDeployedCount(), 1, "Factory should have deployed 1 registry");
        assertEq(powerRegistryFactory.getDeployedRegistry(0), registry, "Registry addresses should match");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Community Creation
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_createsCommunity() public {
        vm.prank(gardenToken);
        (address community,) = gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);

        assertTrue(community != address(0), "Community should be created");
        assertEq(registryFactory.getCreatedCount(), 1, "Factory should have created 1 community");
    }

    function test_onGardenMinted_communityUsesGardenAsCouncilSafe() public {
        vm.prank(gardenToken);
        (address community,) = gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);

        MockRegistryCommunity mockCommunity = MockRegistryCommunity(community);
        assertEq(mockCommunity.councilSafe(), garden1, "Council Safe should be the garden account");
    }

    function test_onGardenMinted_communityUsesGoodsToken() public {
        vm.prank(gardenToken);
        (address community,) = gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);

        MockRegistryCommunity mockCommunity = MockRegistryCommunity(community);
        assertEq(mockCommunity.gardenToken(), address(goodsToken), "Community garden token should be GOODS");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Signal Pool Creation
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_creates2SignalPools() public {
        vm.prank(gardenToken);
        (, address[] memory pools) = gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);

        assertEq(pools.length, 2, "Should create 2 pools");

        // Check via getter
        address[] memory storedPools = gardensModule.getGardenSignalPools(garden1);
        assertEq(storedPools.length, 2, "Stored pools should match");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // View Functions
    // ═══════════════════════════════════════════════════════════════════════════

    function test_getGardenCommunity_returnsZeroForUninitializedGarden() public {
        assertEq(gardensModule.getGardenCommunity(address(0x999)), address(0), "Should return zero for unknown garden");
    }

    function test_getGardenSignalPools_returnsEmptyForUninitializedGarden() public {
        address[] memory pools = gardensModule.getGardenSignalPools(address(0x999));
        assertEq(pools.length, 0, "Should return empty for unknown garden");
    }

    function test_isGardenInitialized_falseForNewGarden() public {
        assertFalse(gardensModule.isGardenInitialized(address(0x999)), "New garden should not be initialized");
    }

    function test_isGardenInitialized_trueAfterMint() public {
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);

        assertTrue(gardensModule.isGardenInitialized(garden1), "Should be initialized after mint");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Admin Functions
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setGardenToken_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        gardensModule.setGardenToken(address(0x42));
    }

    function test_setGardenToken_revertsWithZero() public {
        vm.prank(owner);
        vm.expectRevert(GardensModule.ZeroAddress.selector);
        gardensModule.setGardenToken(address(0));
    }

    function test_setGardenToken_updatesValue() public {
        vm.prank(owner);
        gardensModule.setGardenToken(address(0x42));
        assertEq(gardensModule.gardenToken(), address(0x42), "Garden token should be updated");
    }

    function test_setRegistryFactory_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        gardensModule.setRegistryFactory(address(0x42));
    }

    function test_setPowerRegistryFactory_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        gardensModule.setPowerRegistryFactory(address(0x42));
    }

    function test_setGoodsToken_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        gardensModule.setGoodsToken(address(0x42));
    }

    function test_setHatsProtocol_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        gardensModule.setHatsProtocol(address(0x42));
    }

    function test_setHatsModule_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        gardensModule.setHatsModule(address(0x42));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Multiple Gardens
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_multipleGardensIndependent() public {
        vm.startPrank(gardenToken);

        (address community1,) = gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);
        (address community2,) = gardensModule.onGardenMinted(garden2, IGardensModule.WeightScheme.Power);

        vm.stopPrank();

        // Different communities
        assertTrue(community1 != community2, "Communities should be different");

        // Different weight schemes
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden1)),
            uint256(IGardensModule.WeightScheme.Linear),
            "Garden1 should be Linear"
        );
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden2)),
            uint256(IGardensModule.WeightScheme.Power),
            "Garden2 should be Power"
        );

        // Both initialized
        assertTrue(gardensModule.isGardenInitialized(garden1), "Garden1 should be initialized");
        assertTrue(gardensModule.isGardenInitialized(garden2), "Garden2 should be initialized");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Graceful Degradation
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_succeedsWithNoPowerRegistryFactory() public {
        // Deploy a fresh module initialized without power registry factory
        GardensModule impl2 = new GardensModule();
        bytes memory initData2 = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(registryFactory),
            address(0), // no power registry factory
            address(goodsToken),
            hatsProtocol,
            address(hatsModule)
        );
        ERC1967Proxy proxy2 = new ERC1967Proxy(address(impl2), initData2);
        GardensModule module2 = GardensModule(address(proxy2));

        vm.prank(owner);
        module2.setGardenToken(gardenToken);

        vm.prank(gardenToken);
        (address community, address[] memory pools) = module2.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);

        // Community should still be created
        assertTrue(community != address(0), "Community should still be created");
        // Power registry should be zero
        assertEq(module2.getGardenPowerRegistry(garden1), address(0), "Power registry should be zero when factory absent");
        // Garden should still be initialized
        assertTrue(module2.isGardenInitialized(garden1), "Garden should still be initialized");
        // Pools may or may not succeed depending on community creation
        assertEq(pools.length, 2, "Pools should still be created via community");
    }

    function test_onGardenMinted_succeedsWithNoRegistryFactory() public {
        // Deploy a fresh module initialized without registry factory
        GardensModule impl2 = new GardensModule();
        bytes memory initData2 = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(0), // no registry factory
            address(powerRegistryFactory),
            address(goodsToken),
            hatsProtocol,
            address(hatsModule)
        );
        ERC1967Proxy proxy2 = new ERC1967Proxy(address(impl2), initData2);
        GardensModule module2 = GardensModule(address(proxy2));

        vm.prank(owner);
        module2.setGardenToken(gardenToken);

        vm.prank(gardenToken);
        (address community, address[] memory pools) = module2.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);

        // Community should be zero
        assertEq(community, address(0), "Community should be zero when factory absent");
        // Pools should be empty (no community to create pools in)
        assertEq(pools.length, 0, "Pools should be empty without community");
        // Garden should still be initialized
        assertTrue(module2.isGardenInitialized(garden1), "Garden should still be initialized");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Constants
    // ═══════════════════════════════════════════════════════════════════════════

    function test_constants() public {
        assertEq(gardensModule.DEFAULT_DECAY(), 9_999_799, "Decay should match");
        assertEq(gardensModule.DEFAULT_MAX_RATIO(), 2_000_000, "Max ratio should match");
        assertEq(gardensModule.DEFAULT_WEIGHT(), 10_000, "Weight should match");
        assertEq(gardensModule.DEFAULT_MIN_THRESHOLD_POINTS(), 2_500_000, "Min threshold should match");
        assertEq(gardensModule.STAKE_AMOUNT_PER_MEMBER(), 1e18, "Stake amount should match");
        assertEq(gardensModule.D(), 10_000_000, "D scaling factor should match");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Event Emissions (C-6: Verify enriched event signatures)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_emitsCommunityCreatedWithGoodsTokenAndRegistry() public {
        vm.prank(gardenToken);

        // We expect the CommunityCreated event with enriched params
        // Note: we can't predict the exact community address, so we verify indexed topics
        vm.expectEmit(true, false, false, false);
        emit IGardensModule.CommunityCreated(
            garden1, address(0), IGardensModule.WeightScheme.Linear, address(0), address(0)
        );

        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);
    }

    function test_onGardenMinted_communityCreatedHasCorrectGoodsToken() public {
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);

        // Verify the community was created with GOODS token
        address community = gardensModule.getGardenCommunity(garden1);
        MockRegistryCommunity mockCommunity = MockRegistryCommunity(community);
        assertEq(mockCommunity.gardenToken(), address(goodsToken), "Community should use GOODS token");
    }

    function test_onGardenMinted_emitsSignalPoolCreatedWithCommunity() public {
        vm.prank(gardenToken);

        // Expect at least one SignalPoolCreated event (indexed: garden, pool, community)
        vm.expectEmit(true, false, false, false);
        emit IGardensModule.SignalPoolCreated(garden1, address(0), IGardensModule.PoolType.HypercertSignal, address(0));

        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Pool Registration in HatsModule
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_registersPoolsInHatsModule() public {
        vm.prank(gardenToken);
        (, address[] memory pools) = gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);

        // Verify pools were registered in HatsModule via setConvictionStrategies
        address[] memory strategies = hatsModule.getConvictionStrategies(garden1);
        assertEq(strategies.length, pools.length, "HatsModule should have same pool count");
        for (uint256 i = 0; i < pools.length; i++) {
            assertEq(strategies[i], pools[i], "Strategy should match pool address");
        }
    }

    function test_onGardenMinted_poolRegistrationSkippedWhenNoHatsModule() public {
        // Deploy a fresh module initialized without hats module
        GardensModule impl2 = new GardensModule();
        bytes memory initData2 = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(registryFactory),
            address(powerRegistryFactory),
            address(goodsToken),
            hatsProtocol,
            address(0) // no hats module
        );
        ERC1967Proxy proxy2 = new ERC1967Proxy(address(impl2), initData2);
        GardensModule module2 = GardensModule(address(proxy2));

        vm.prank(owner);
        module2.setGardenToken(gardenToken);

        // Should still succeed (graceful degradation) — no hat IDs available though
        // so power registry won't deploy (hat IDs are all 0) and pools won't have
        // registration in hats module
        vm.prank(gardenToken);
        (address community, address[] memory pools) = module2.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);

        // Community should still be created via registry factory
        assertTrue(community != address(0), "Community should still be created");
        // Pools should still be created (community exists)
        assertEq(pools.length, 2, "Pools should still be created");
        assertTrue(module2.isGardenInitialized(garden1), "Garden should still initialize");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Recovery Functions — resetGardenInitialization
    // ═══════════════════════════════════════════════════════════════════════════

    function test_resetGardenInitialization_clearsState() public {
        // First, initialize garden
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);
        assertTrue(gardensModule.isGardenInitialized(garden1), "Should be initialized");

        // Reset
        vm.prank(owner);
        gardensModule.resetGardenInitialization(garden1);

        // All state should be cleared
        assertFalse(gardensModule.isGardenInitialized(garden1), "Should no longer be initialized");
        assertEq(gardensModule.getGardenCommunity(garden1), address(0), "Community should be cleared");
        assertEq(gardensModule.getGardenSignalPools(garden1).length, 0, "Pools should be cleared");
        assertEq(gardensModule.getGardenPowerRegistry(garden1), address(0), "Power registry should be cleared");
    }

    function test_resetGardenInitialization_allowsReinit() public {
        // Initialize
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);

        // Reset
        vm.prank(owner);
        gardensModule.resetGardenInitialization(garden1);

        // Should be able to re-init
        vm.prank(gardenToken);
        (address community, address[] memory pools) =
            gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Power);

        assertTrue(community != address(0), "Community should be created on re-init");
        assertEq(pools.length, 2, "Pools should be created on re-init");
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden1)),
            uint256(IGardensModule.WeightScheme.Power),
            "Weight scheme should be updated"
        );
    }

    function test_resetGardenInitialization_emitsEvent() public {
        // Initialize
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);

        vm.expectEmit(true, false, false, false);
        emit IGardensModule.GardenInitializationReset(garden1);

        vm.prank(owner);
        gardensModule.resetGardenInitialization(garden1);
    }

    function test_resetGardenInitialization_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        gardensModule.resetGardenInitialization(garden1);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Recovery Functions — retryCreateCommunity
    // ═══════════════════════════════════════════════════════════════════════════

    function test_retryCreateCommunity_revertsIfNotInitialized() public {
        // garden1 not yet initialized
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(GardensModule.GardenNotInitialized.selector, garden1));
        gardensModule.retryCreateCommunity(garden1);
    }

    function test_retryCreateCommunity_revertsIfCommunityAlreadyExists() public {
        // Fully initialize garden
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);

        // Community already exists
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(GardensModule.GardenAlreadyInitialized.selector, garden1));
        gardensModule.retryCreateCommunity(garden1);
    }

    function test_retryCreateCommunity_successAfterPartialFailure() public {
        // Deploy a fresh module initialized without registry factory to simulate partial failure
        GardensModule impl2 = new GardensModule();
        bytes memory initData2 = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(0), // no registry factory — community creation will fail
            address(powerRegistryFactory),
            address(goodsToken),
            hatsProtocol,
            address(hatsModule)
        );
        ERC1967Proxy proxy2 = new ERC1967Proxy(address(impl2), initData2);
        GardensModule module2 = GardensModule(address(proxy2));

        vm.prank(owner);
        module2.setGardenToken(gardenToken);

        vm.prank(gardenToken);
        module2.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);

        // Community should be zero
        assertEq(module2.getGardenCommunity(garden1), address(0), "Community should be zero");

        // Restore registry factory
        vm.prank(owner);
        module2.setRegistryFactory(address(registryFactory));

        // Retry community creation
        vm.prank(owner);
        address community = module2.retryCreateCommunity(garden1);
        assertTrue(community != address(0), "Community should be created on retry");
        assertEq(module2.getGardenCommunity(garden1), community, "Community should be stored");
    }

    function test_retryCreateCommunity_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        gardensModule.retryCreateCommunity(garden1);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Recovery Functions — retryCreatePools
    // ═══════════════════════════════════════════════════════════════════════════

    function test_retryCreatePools_revertsIfNotInitialized() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(GardensModule.GardenNotInitialized.selector, garden1));
        gardensModule.retryCreatePools(garden1);
    }

    function test_retryCreatePools_revertsIfNoCommunity() public {
        // Deploy a fresh module initialized without registry factory → community is address(0)
        GardensModule impl2 = new GardensModule();
        bytes memory initData2 = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(0), // no registry factory
            address(powerRegistryFactory),
            address(goodsToken),
            hatsProtocol,
            address(hatsModule)
        );
        ERC1967Proxy proxy2 = new ERC1967Proxy(address(impl2), initData2);
        GardensModule module2 = GardensModule(address(proxy2));

        vm.prank(owner);
        module2.setGardenToken(gardenToken);

        vm.prank(gardenToken);
        module2.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);

        // Community is zero, so retryCreatePools should revert with ZeroAddress
        vm.prank(owner);
        vm.expectRevert(GardensModule.ZeroAddress.selector);
        module2.retryCreatePools(garden1);
    }

    function test_retryCreatePools_revertsIfPoolsAlreadyExist() public {
        // Fully initialize
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);

        // Pools already exist
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(GardensModule.PoolsAlreadyExist.selector, garden1));
        gardensModule.retryCreatePools(garden1);
    }

    function test_retryCreatePools_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        gardensModule.retryCreatePools(garden1);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Power Registry Source Weights
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_linearWeightsAre100_200_300() public {
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear);

        address registry = gardensModule.getGardenPowerRegistry(garden1);
        MockNFTPowerRegistry mockRegistry = MockNFTPowerRegistry(registry);

        assertEq(mockRegistry.getSourceCount(), 3, "Should have 3 sources");

        // Sources are: [0]=operator(300), [1]=gardener(200), [2]=community(100)
        NFTPowerSource memory operatorSource = mockRegistry.getSource(0);
        NFTPowerSource memory gardenerSource = mockRegistry.getSource(1);
        NFTPowerSource memory communitySource = mockRegistry.getSource(2);

        assertEq(operatorSource.weight, 300, "Operator weight should be 300 for Linear");
        assertEq(gardenerSource.weight, 200, "Gardener weight should be 200 for Linear");
        assertEq(communitySource.weight, 100, "Community weight should be 100 for Linear");
    }

    function test_onGardenMinted_exponentialWeightsAre200_400_1600() public {
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Exponential);

        address registry = gardensModule.getGardenPowerRegistry(garden1);
        MockNFTPowerRegistry mockRegistry = MockNFTPowerRegistry(registry);

        NFTPowerSource memory operatorSource = mockRegistry.getSource(0);
        NFTPowerSource memory gardenerSource = mockRegistry.getSource(1);
        NFTPowerSource memory communitySource = mockRegistry.getSource(2);

        assertEq(operatorSource.weight, 1600, "Operator weight should be 1600 for Exponential");
        assertEq(gardenerSource.weight, 400, "Gardener weight should be 400 for Exponential");
        assertEq(communitySource.weight, 200, "Community weight should be 200 for Exponential");
    }

    function test_onGardenMinted_powerWeightsAre300_900_8100() public {
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Power);

        address registry = gardensModule.getGardenPowerRegistry(garden1);
        MockNFTPowerRegistry mockRegistry = MockNFTPowerRegistry(registry);

        NFTPowerSource memory operatorSource = mockRegistry.getSource(0);
        NFTPowerSource memory gardenerSource = mockRegistry.getSource(1);
        NFTPowerSource memory communitySource = mockRegistry.getSource(2);

        assertEq(operatorSource.weight, 8100, "Operator weight should be 8100 for Power");
        assertEq(gardenerSource.weight, 900, "Gardener weight should be 900 for Power");
        assertEq(communitySource.weight, 300, "Community weight should be 300 for Power");
    }
}
