// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { Vm } from "forge-std/Vm.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { GardensModule } from "../../src/modules/Gardens.sol";
import { GoodsToken } from "../../src/tokens/Goods.sol";
import { IGardensModule } from "../../src/interfaces/IGardensModule.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { IRegistryCommunity, IUnifiedPowerRegistry, PointSystem, NFTPowerSource } from "../../src/interfaces/IGardensV2.sol";
import { MockRegistryFactory, MockRegistryCommunity, MockUnifiedPowerRegistry } from "../../src/mocks/GardensV2.sol";

/// @title MockGOODSToken
/// @notice Simple ERC20 mock for GOODS token with mint
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

    // Operator tracking for createGardenPools access control testing
    mapping(address garden => mapping(address account => bool isOp)) public operators;

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

    function setOperator(address garden, address account, bool isOp) external {
        operators[garden][account] = isOp;
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

    function isOperatorOf(address garden, address account) external view returns (bool) {
        return operators[garden][account];
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

/// @title RevertingPowerRegistryForReset
/// @notice Power registry that reverts on deregisterGarden (for reset fault-injection)
/// @dev Tests the try-catch at Gardens.sol:418-422
contract RevertingPowerRegistryForReset is IUnifiedPowerRegistry {
    function deregisterGarden(address, address[] calldata) external pure override {
        revert("RevertingPowerRegistry: deregisterGarden failed");
    }

    // Stubs — not exercised by the reset path
    function registerGarden(address, NFTPowerSource[] calldata) external override { }
    function registerPool(address, address) external override { }

    function getGardenSources(address) external pure override returns (NFTPowerSource[] memory) {
        return new NFTPowerSource[](0);
    }

    function getGardenSourceCount(address) external pure override returns (uint256) {
        return 0;
    }

    function getPoolGarden(address) external pure override returns (address) {
        return address(0);
    }

    function isGardenRegistered(address) external pure override returns (bool) {
        return false;
    }
}

/// @title RegisterPoolRevertPowerRegistry
/// @notice Power registry that always reverts on registerPool
/// @dev Tests the try-catch loop at Gardens.sol:676-680
contract RegisterPoolRevertPowerRegistry is IUnifiedPowerRegistry {
    function registerPool(address, address) external pure override {
        revert("RegisterPoolRevertPowerRegistry: registerPool failed");
    }

    function registerGarden(address, NFTPowerSource[] calldata) external override { }
    function deregisterGarden(address, address[] calldata) external override { }

    function getGardenSources(address) external pure override returns (NFTPowerSource[] memory) {
        return new NFTPowerSource[](0);
    }

    function getGardenSourceCount(address) external pure override returns (uint256) {
        return 0;
    }

    function getPoolGarden(address) external pure override returns (address) {
        return address(0);
    }

    function isGardenRegistered(address) external pure override returns (bool) {
        return false;
    }
}

/// @title MockGardenMembershipJoiner
/// @notice Minimal garden-account stand-in that can join a string-only community when GardensModule asks.
contract MockGardenMembershipJoiner {
    address public community;

    function setCommunity(address _community) external {
        community = _community;
    }

    function attemptCommunityMembership() external {
        IRegistryCommunity(community).stakeAndRegisterMember("");
    }
}

/// @title GardensModuleTest
/// @notice Unit tests for GardensModule contract (v14 — community-first, separate pools)
contract GardensModuleTest is Test {
    GardensModule public gardensModule;
    MockGOODSToken public goodsToken;
    MockRegistryFactory public registryFactory;
    MockUnifiedPowerRegistry public mockPowerRegistry;
    MockHatsModuleForGardens public hatsModule;

    address public owner = address(0x1);
    address public gardenToken = address(0x2);
    address public hatsProtocol = address(0x3);
    address public operator1 = address(0x4);
    address public garden1 = address(0x100);
    address public garden2 = address(0x200);

    function setUp() public {
        // Deploy mocks
        goodsToken = new MockGOODSToken();
        registryFactory = new MockRegistryFactory();
        mockPowerRegistry = new MockUnifiedPowerRegistry();
        hatsModule = new MockHatsModuleForGardens();

        // Deploy GardensModule behind proxy
        GardensModule impl = new GardensModule();
        bytes memory initData = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(registryFactory),
            address(mockPowerRegistry),
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

        // Set operator1 as operator for garden1
        hatsModule.setOperator(garden1, operator1, true);
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

    function test_initialize_setsPowerRegistry() public {
        assertEq(address(gardensModule.powerRegistry()), address(mockPowerRegistry), "PowerRegistry should be set");
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

    function test_initialize_setsStakeAmountPerMember() public {
        assertEq(gardensModule.stakeAmountPerMember(), 1e18, "stakeAmountPerMember should default to 1e18");
    }

    function test_initialize_revertsWithZeroOwner() public {
        GardensModule impl = new GardensModule();
        bytes memory initData = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            address(0), // zero owner
            address(registryFactory),
            address(mockPowerRegistry),
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
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");
    }

    function test_onGardenMinted_revertsIfZeroGarden() public {
        vm.prank(gardenToken);
        vm.expectRevert(GardensModule.ZeroAddress.selector);
        gardensModule.onGardenMinted(address(0), IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");
    }

    function test_onGardenMinted_revertsIfAlreadyInitialized() public {
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        vm.prank(gardenToken);
        vm.expectRevert(abi.encodeWithSelector(GardensModule.GardenAlreadyInitialized.selector, garden1));
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // onGardenMinted — Community + Auto Pool Creation
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_createsCommunityAndPools() public {
        vm.prank(gardenToken);
        (address community, address[] memory pools) =
            gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        assertTrue(community != address(0), "Community should be created");
        assertEq(pools.length, 2, "Both signal pools should be auto-created during mint");

        // Verify state was persisted
        assertEq(gardensModule.getGardenCommunity(garden1), community, "Community should be stored");
        assertTrue(gardensModule.isGardenInitialized(garden1), "Garden should be initialized");
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden1)),
            uint256(IGardensModule.WeightScheme.Linear),
            "Weight scheme should be Linear"
        );

        // Pools are stored
        address[] memory storedPools = gardensModule.getGardenSignalPools(garden1);
        assertEq(storedPools.length, 2, "Both pools should be stored after mint");
        assertEq(storedPools[0], pools[0], "Action pool should match");
        assertEq(storedPools[1], pools[1], "Hypercert pool should match");
    }

    function test_onGardenMinted_exponentialScheme() public {
        vm.prank(gardenToken);
        (address community, address[] memory pools) = gardensModule.onGardenMinted(
            garden1, IGardensModule.WeightScheme.Exponential, "Test Garden", "Test Description"
        );

        assertTrue(community != address(0), "Community should be created");
        assertEq(pools.length, 2, "Both pools should be auto-created");
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden1)),
            uint256(IGardensModule.WeightScheme.Exponential),
            "Weight scheme should be Exponential"
        );
    }

    function test_onGardenMinted_powerScheme() public {
        vm.prank(gardenToken);
        (address community, address[] memory pools) =
            gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Power, "Test Garden", "Test Description");

        assertTrue(community != address(0), "Community should be created");
        assertEq(pools.length, 2, "Both pools should be auto-created");
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden1)),
            uint256(IGardensModule.WeightScheme.Power),
            "Weight scheme should be Power"
        );
    }

    function test_onGardenMinted_poolsRegisteredInHatsModule() public {
        vm.prank(gardenToken);
        (, address[] memory pools) =
            gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        // Pools should be auto-registered in HatsModule during mint
        address[] memory strategies = hatsModule.getConvictionStrategies(garden1);
        assertEq(strategies.length, pools.length, "HatsModule should have same pool count");
        for (uint256 i = 0; i < pools.length; i++) {
            assertEq(strategies[i], pools[i], "Strategy should match pool address");
        }
    }

    function test_onGardenMinted_poolCreationFailureIsNonBlocking() public {
        // Configure factory to create communities that fail on pool creation
        registryFactory.setCreateFailingCommunities(true);

        vm.prank(gardenToken);
        (address community, address[] memory pools) =
            gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        // Community created successfully, but pools failed
        assertTrue(community != address(0), "Community should still be created");
        assertEq(pools.length, 0, "No pools when pool creation fails");

        // Garden is still initialized
        assertTrue(gardensModule.isGardenInitialized(garden1), "Garden should still be initialized");
        assertEq(gardensModule.getGardenSignalPools(garden1).length, 0, "No stored pools");
    }

    function test_onGardenMinted_emitsPartiallyInitialized_whenPoolsFail() public {
        registryFactory.setCreateFailingCommunities(true);

        vm.expectEmit(true, false, false, true);
        emit IGardensModule.GardenPartiallyInitialized(garden1, true, false);

        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Treasury Seeding
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_seedsGoodsTreasury() public {
        uint256 expectedAmount = 1e18 * 100; // stakeAmountPerMember * INITIAL_MEMBER_SLOTS
        uint256 balanceBefore = goodsToken.balanceOf(garden1);

        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        uint256 balanceAfter = goodsToken.balanceOf(garden1);
        assertEq(balanceAfter - balanceBefore, expectedAmount, "Garden should receive GOODS treasury");
    }

    function test_onGardenMinted_emitsGardenTreasurySeeded() public {
        uint256 expectedAmount = 1e18 * 100;

        vm.expectEmit(true, false, false, true);
        emit IGardensModule.GardenTreasurySeeded(garden1, expectedAmount);

        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");
    }

    function test_onGardenMinted_treasurySeedingUsesConfigurableStake() public {
        // Change stake amount
        vm.prank(owner);
        gardensModule.setStakeAmountPerMember(2e18);

        uint256 expectedAmount = 2e18 * 100; // new stake * INITIAL_MEMBER_SLOTS

        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        assertEq(goodsToken.balanceOf(garden1), expectedAmount, "Should use configured stake amount");
    }

    function test_onGardenMinted_treasurySeedingSkippedWhenNoCommunity() public {
        // Deploy without registry factory — community creation will fail
        GardensModule impl2 = new GardensModule();
        bytes memory initData2 = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(0), // no registry factory
            address(mockPowerRegistry),
            address(goodsToken),
            hatsProtocol,
            address(hatsModule)
        );
        ERC1967Proxy proxy2 = new ERC1967Proxy(address(impl2), initData2);
        GardensModule module2 = GardensModule(address(proxy2));

        vm.prank(owner);
        module2.setGardenToken(gardenToken);

        vm.prank(gardenToken);
        module2.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        // No GOODS should be minted (no community = no treasury seeding)
        assertEq(goodsToken.balanceOf(garden1), 0, "No GOODS when no community");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // createGardenPools — Manual Fallback (when auto-creation failed)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_createGardenPools_operatorCanCreatePoolsAfterAutoFail() public {
        // Auto pool creation fails during mint
        registryFactory.setCreateFailingCommunities(true);
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");
        assertEq(gardensModule.getGardenSignalPools(garden1).length, 0, "No pools after failed auto-creation");

        // Fix the community so pool creation works
        MockRegistryCommunity(gardensModule.getGardenCommunity(garden1)).setShouldRevertPoolCreation(false);

        // Operator creates pools manually
        vm.prank(operator1);
        address[] memory pools = gardensModule.createGardenPools(garden1);

        assertEq(pools.length, 2, "Should create 2 pools");
        assertTrue(pools[0] != address(0), "Action pool should exist");
        assertTrue(pools[1] != address(0), "Hypercert pool should exist");

        // Verify stored
        address[] memory storedPools = gardensModule.getGardenSignalPools(garden1);
        assertEq(storedPools.length, 2, "Stored pools should be 2");
    }

    function test_createGardenPools_ownerCanCreatePoolsAfterAutoFail() public {
        registryFactory.setCreateFailingCommunities(true);
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        MockRegistryCommunity(gardensModule.getGardenCommunity(garden1)).setShouldRevertPoolCreation(false);

        vm.prank(owner);
        address[] memory pools = gardensModule.createGardenPools(garden1);

        assertEq(pools.length, 2, "Owner should be able to create pools");
    }

    function test_createGardenPools_revertsForNonOperator() public {
        registryFactory.setCreateFailingCommunities(true);
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        vm.prank(address(0x999)); // not an operator
        vm.expectRevert(GardensModule.NotGardenOperator.selector);
        gardensModule.createGardenPools(garden1);
    }

    function test_createGardenPools_revertsIfNotInitialized() public {
        vm.prank(operator1);
        vm.expectRevert(abi.encodeWithSelector(GardensModule.GardenNotInitialized.selector, garden1));
        gardensModule.createGardenPools(garden1);
    }

    function test_createGardenPools_revertsIfNoCommunity() public {
        // Deploy without registry factory → community is address(0)
        GardensModule impl2 = new GardensModule();
        bytes memory initData2 = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(0), // no registry factory
            address(mockPowerRegistry),
            address(goodsToken),
            hatsProtocol,
            address(hatsModule)
        );
        ERC1967Proxy proxy2 = new ERC1967Proxy(address(impl2), initData2);
        GardensModule module2 = GardensModule(address(proxy2));

        vm.prank(owner);
        module2.setGardenToken(gardenToken);

        vm.prank(gardenToken);
        module2.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        vm.prank(owner);
        vm.expectRevert(GardensModule.ZeroAddress.selector);
        module2.createGardenPools(garden1);
    }

    function test_createGardenPools_revertsIfPoolsAlreadyExist() public {
        // Pools auto-created during mint
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");
        assertEq(gardensModule.getGardenSignalPools(garden1).length, 2, "Pools should be auto-created");

        // Manual call should revert since pools already exist
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(GardensModule.PoolsAlreadyExist.selector, garden1));
        gardensModule.createGardenPools(garden1);
    }

    function test_createGardenPools_registersPoolsInHatsModule() public {
        // Auto pool creation fails
        registryFactory.setCreateFailingCommunities(true);
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        // Fix and manually create
        MockRegistryCommunity(gardensModule.getGardenCommunity(garden1)).setShouldRevertPoolCreation(false);

        vm.prank(owner);
        address[] memory pools = gardensModule.createGardenPools(garden1);

        // Verify pools were registered in HatsModule
        address[] memory strategies = hatsModule.getConvictionStrategies(garden1);
        assertEq(strategies.length, pools.length, "HatsModule should have same pool count");
        for (uint256 i = 0; i < pools.length; i++) {
            assertEq(strategies[i], pools[i], "Strategy should match pool address");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Power Registry Deployment
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_deploysPowerRegistry() public {
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        address registry = gardensModule.getGardenPowerRegistry(garden1);
        assertTrue(registry != address(0), "Power registry should be deployed");
    }

    function test_onGardenMinted_powerRegistryHas3Sources() public {
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        assertTrue(mockPowerRegistry.isGardenRegistered(garden1), "Garden should be registered in power registry");
        assertEq(mockPowerRegistry.getGardenSourceCount(garden1), 3, "Power registry should have 3 sources for garden");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Community Creation
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_createsCommunity() public {
        vm.prank(gardenToken);
        (address community,) =
            gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        assertTrue(community != address(0), "Community should be created");
        assertEq(registryFactory.getCreatedCount(), 1, "Factory should have created 1 community");
    }

    function test_onGardenMinted_communityUsesOwnerAsDefaultCouncilSafe() public {
        vm.prank(gardenToken);
        (address community,) =
            gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        MockRegistryCommunity mockCommunity = MockRegistryCommunity(community);
        assertEq(mockCommunity.councilSafe(), owner, "Council Safe should default to protocol owner");
    }

    function test_onGardenMinted_communityUsesGoodsToken() public {
        vm.prank(gardenToken);
        (address community,) =
            gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        MockRegistryCommunity mockCommunity = MockRegistryCommunity(community);
        assertEq(mockCommunity.gardenToken(), address(goodsToken), "Community garden token should be GOODS");
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
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

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

    function test_setPowerRegistry_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        gardensModule.setPowerRegistry(address(0x42));
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

    function test_setStakeAmountPerMember_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        gardensModule.setStakeAmountPerMember(2e18);
    }

    function test_setStakeAmountPerMember_updatesValue() public {
        vm.prank(owner);
        gardensModule.setStakeAmountPerMember(5e18);
        assertEq(gardensModule.stakeAmountPerMember(), 5e18, "Stake amount should be updated");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Multiple Gardens
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_multipleGardensIndependent() public {
        vm.startPrank(gardenToken);

        (address community1, address[] memory pools1) =
            gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");
        (address community2, address[] memory pools2) =
            gardensModule.onGardenMinted(garden2, IGardensModule.WeightScheme.Power, "Test Garden 2", "Test Description 2");

        vm.stopPrank();

        // Different communities
        assertTrue(community1 != community2, "Communities should be different");

        // Both have pools
        assertEq(pools1.length, 2, "Garden1 should have 2 pools");
        assertEq(pools2.length, 2, "Garden2 should have 2 pools");

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

    function test_onGardenMinted_succeedsWithNoPowerRegistry() public {
        GardensModule impl2 = new GardensModule();
        bytes memory initData2 = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(registryFactory),
            address(0), // no power registry
            address(goodsToken),
            hatsProtocol,
            address(hatsModule)
        );
        ERC1967Proxy proxy2 = new ERC1967Proxy(address(impl2), initData2);
        GardensModule module2 = GardensModule(address(proxy2));

        vm.prank(owner);
        module2.setGardenToken(gardenToken);

        vm.prank(gardenToken);
        (address community, address[] memory pools) =
            module2.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        // Community should still be created
        assertTrue(community != address(0), "Community should still be created");
        // Power registry should be zero
        assertEq(module2.getGardenPowerRegistry(garden1), address(0), "Power registry should be zero when absent");
        // Pools should still be auto-created (pool creation doesn't require power registry to succeed)
        assertEq(pools.length, 2, "Pools should be created even without power registry");
        // Garden should still be initialized
        assertTrue(module2.isGardenInitialized(garden1), "Garden should still be initialized");
    }

    function test_onGardenMinted_succeedsWithNoRegistryFactory() public {
        GardensModule impl2 = new GardensModule();
        bytes memory initData2 = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(0), // no registry factory
            address(mockPowerRegistry),
            address(goodsToken),
            hatsProtocol,
            address(hatsModule)
        );
        ERC1967Proxy proxy2 = new ERC1967Proxy(address(impl2), initData2);
        GardensModule module2 = GardensModule(address(proxy2));

        vm.prank(owner);
        module2.setGardenToken(gardenToken);

        vm.prank(gardenToken);
        (address community, address[] memory pools) =
            module2.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        // Community should be zero
        assertEq(community, address(0), "Community should be zero when factory absent");
        // No pools
        assertEq(pools.length, 0, "No pools without community");
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
        assertEq(gardensModule.INITIAL_MEMBER_SLOTS(), 100, "Initial member slots should be 100");
        assertEq(gardensModule.D(), 10_000_000, "D scaling factor should match");
    }

    /// @notice Verify PointSystem enum ordinals match Gardens V2 ICVStrategy.PointSystem exactly.
    /// @dev If this test fails, ABI-encoded pool creation calls send the wrong enum value on-chain.
    ///      Reference: gardens-v2/pkg/contracts/src/CVStrategy/ICVStrategy.sol
    function test_pointSystemEnum_ordinalsMatchGardensV2() public {
        assertEq(uint256(PointSystem.Fixed), 0, "Fixed must be 0");
        assertEq(uint256(PointSystem.Capped), 1, "Capped must be 1");
        assertEq(uint256(PointSystem.Unlimited), 2, "Unlimited must be 2");
        assertEq(uint256(PointSystem.Quadratic), 3, "Quadratic must be 3");
        assertEq(uint256(PointSystem.Custom), 4, "Custom must be 4");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Event Emissions
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_emitsCommunityCreatedWithGoodsTokenAndRegistry() public {
        vm.prank(gardenToken);

        vm.expectEmit(true, false, false, false);
        emit IGardensModule.CommunityCreated(garden1, address(0), IGardensModule.WeightScheme.Linear, address(0));

        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");
    }

    function test_onGardenMinted_communityCreatedHasCorrectGoodsToken() public {
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        address community = gardensModule.getGardenCommunity(garden1);
        MockRegistryCommunity mockCommunity = MockRegistryCommunity(community);
        assertEq(mockCommunity.gardenToken(), address(goodsToken), "Community should use GOODS token");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Recovery Functions — resetGardenInitialization
    // ═══════════════════════════════════════════════════════════════════════════

    function test_resetGardenInitialization_clearsState() public {
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");
        assertTrue(gardensModule.isGardenInitialized(garden1), "Should be initialized");

        vm.prank(owner);
        gardensModule.resetGardenInitialization(garden1);

        assertFalse(gardensModule.isGardenInitialized(garden1), "Should no longer be initialized");
        assertEq(gardensModule.getGardenCommunity(garden1), address(0), "Community should be cleared");
        assertEq(gardensModule.getGardenSignalPools(garden1).length, 0, "Pools should be cleared");
        // Unified registry is a singleton — getGardenPowerRegistry returns address(0) only when
        // the garden is not registered in the unified registry (reset doesn't affect the registry itself)
    }

    function test_resetGardenInitialization_allowsReinit() public {
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        vm.prank(owner);
        gardensModule.resetGardenInitialization(garden1);

        vm.prank(gardenToken);
        (address community, address[] memory pools) =
            gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Power, "Test Garden", "Test Description");

        assertTrue(community != address(0), "Community should be created on re-init");
        assertEq(pools.length, 2, "Pools should be auto-created on re-init");
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden1)),
            uint256(IGardensModule.WeightScheme.Power),
            "Weight scheme should be updated"
        );
    }

    function test_resetGardenInitialization_emitsEvent() public {
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

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
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(GardensModule.GardenNotInitialized.selector, garden1));
        gardensModule.retryCreateCommunity(garden1);
    }

    function test_retryCreateCommunity_revertsIfCommunityAlreadyExists() public {
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(GardensModule.GardenAlreadyInitialized.selector, garden1));
        gardensModule.retryCreateCommunity(garden1);
    }

    function test_retryCreateCommunity_successAfterPartialFailure() public {
        GardensModule impl2 = new GardensModule();
        bytes memory initData2 = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(0), // no registry factory
            address(mockPowerRegistry), // power registry
            address(goodsToken),
            hatsProtocol,
            address(hatsModule)
        );
        ERC1967Proxy proxy2 = new ERC1967Proxy(address(impl2), initData2);
        GardensModule module2 = GardensModule(address(proxy2));

        vm.prank(owner);
        module2.setGardenToken(gardenToken);

        vm.prank(gardenToken);
        module2.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        assertEq(module2.getGardenCommunity(garden1), address(0), "Community should be zero");

        vm.prank(owner);
        module2.setRegistryFactory(address(registryFactory));

        // retryCreateCommunity reads name/description from the garden account on-chain,
        // so we need a contract at garden1 that implements IGardenAccountMetadata
        vm.etch(garden1, hex"00");
        vm.mockCall(garden1, abi.encodeWithSignature("name()"), abi.encode("Test Garden"));
        vm.mockCall(garden1, abi.encodeWithSignature("description()"), abi.encode("Test Description"));

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
    // Power Registry Source Weights
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_linearWeightsAre10000_20000_30000() public {
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        assertTrue(mockPowerRegistry.isGardenRegistered(garden1), "Garden should be registered");
        NFTPowerSource[] memory sources = mockPowerRegistry.getGardenSources(garden1);
        assertEq(sources.length, 3, "Should have 3 sources");

        assertEq(sources[0].weight, 30_000, "Operator weight should be 30000 for Linear");
        assertEq(sources[1].weight, 20_000, "Gardener weight should be 20000 for Linear");
        assertEq(sources[2].weight, 10_000, "Community weight should be 10000 for Linear");
    }

    function test_onGardenMinted_exponentialWeightsAre20000_40000_160000() public {
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Exponential, "Test Garden", "Test Description");

        NFTPowerSource[] memory sources = mockPowerRegistry.getGardenSources(garden1);

        assertEq(sources[0].weight, 160_000, "Operator weight should be 160000 for Exponential");
        assertEq(sources[1].weight, 40_000, "Gardener weight should be 40000 for Exponential");
        assertEq(sources[2].weight, 20_000, "Community weight should be 20000 for Exponential");
    }

    function test_onGardenMinted_powerWeightsAre30000_90000_810000() public {
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Power, "Test Garden", "Test Description");

        NFTPowerSource[] memory sources = mockPowerRegistry.getGardenSources(garden1);

        assertEq(sources[0].weight, 810_000, "Operator weight should be 810000 for Power");
        assertEq(sources[1].weight, 90_000, "Gardener weight should be 90000 for Power");
        assertEq(sources[2].weight, 30_000, "Community weight should be 30000 for Power");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // isWiringComplete — Diagnostic Function Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_isWiringComplete_returnsTrueWhenFullyWired() public {
        (bool wired, string memory missing) = gardensModule.isWiringComplete();
        assertTrue(wired, "Should be fully wired");
        assertEq(bytes(missing).length, 0, "Missing should be empty string");
    }

    function test_isWiringComplete_detectsMissingGardenToken() public {
        // Deploy a fresh module without gardenToken set
        GardensModule impl2 = new GardensModule();
        bytes memory initData2 = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(registryFactory),
            address(mockPowerRegistry),
            address(goodsToken),
            hatsProtocol,
            address(hatsModule)
        );
        ERC1967Proxy proxy2 = new ERC1967Proxy(address(impl2), initData2);
        GardensModule module2 = GardensModule(address(proxy2));
        // gardenToken not set

        (bool wired, string memory missing) = module2.isWiringComplete();
        assertFalse(wired, "Should not be wired without gardenToken");
        assertEq(missing, "gardenToken not set", "Should report gardenToken missing");
    }

    function test_isWiringComplete_detectsMissingRegistryFactory() public {
        GardensModule impl2 = new GardensModule();
        bytes memory initData2 = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(0), // no registry factory
            address(mockPowerRegistry),
            address(goodsToken),
            hatsProtocol,
            address(hatsModule)
        );
        ERC1967Proxy proxy2 = new ERC1967Proxy(address(impl2), initData2);
        GardensModule module2 = GardensModule(address(proxy2));

        vm.prank(owner);
        module2.setGardenToken(gardenToken);

        (bool wired, string memory missing) = module2.isWiringComplete();
        assertFalse(wired, "Should not be wired without registryFactory");
        assertEq(missing, "registryFactory not set");
    }

    function test_isWiringComplete_detectsMissingPowerRegistry() public {
        GardensModule impl2 = new GardensModule();
        bytes memory initData2 = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(registryFactory),
            address(0), // no power registry
            address(goodsToken),
            hatsProtocol,
            address(hatsModule)
        );
        ERC1967Proxy proxy2 = new ERC1967Proxy(address(impl2), initData2);
        GardensModule module2 = GardensModule(address(proxy2));

        vm.prank(owner);
        module2.setGardenToken(gardenToken);

        (bool wired, string memory missing) = module2.isWiringComplete();
        assertFalse(wired, "Should not be wired without powerRegistry");
        assertEq(missing, "powerRegistry not set");
    }

    function test_isWiringComplete_detectsMissingGoodsToken() public {
        GardensModule impl2 = new GardensModule();
        bytes memory initData2 = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(registryFactory),
            address(mockPowerRegistry),
            address(0), // no goods token
            hatsProtocol,
            address(hatsModule)
        );
        ERC1967Proxy proxy2 = new ERC1967Proxy(address(impl2), initData2);
        GardensModule module2 = GardensModule(address(proxy2));

        vm.prank(owner);
        module2.setGardenToken(gardenToken);

        (bool wired, string memory missing) = module2.isWiringComplete();
        assertFalse(wired, "Should not be wired without goodsToken");
        assertEq(missing, "goodsToken not set");
    }

    function test_isWiringComplete_detectsMissingHatsProtocol() public {
        GardensModule impl2 = new GardensModule();
        bytes memory initData2 = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(registryFactory),
            address(mockPowerRegistry),
            address(goodsToken),
            address(0), // no hats protocol
            address(hatsModule)
        );
        ERC1967Proxy proxy2 = new ERC1967Proxy(address(impl2), initData2);
        GardensModule module2 = GardensModule(address(proxy2));

        vm.prank(owner);
        module2.setGardenToken(gardenToken);

        (bool wired, string memory missing) = module2.isWiringComplete();
        assertFalse(wired, "Should not be wired without hatsProtocol");
        assertEq(missing, "hatsProtocol not set");
    }

    function test_isWiringComplete_detectsMissingHatsModule() public {
        GardensModule impl2 = new GardensModule();
        bytes memory initData2 = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(registryFactory),
            address(mockPowerRegistry),
            address(goodsToken),
            hatsProtocol,
            address(0) // no hats module
        );
        ERC1967Proxy proxy2 = new ERC1967Proxy(address(impl2), initData2);
        GardensModule module2 = GardensModule(address(proxy2));

        vm.prank(owner);
        module2.setGardenToken(gardenToken);

        (bool wired, string memory missing) = module2.isWiringComplete();
        assertFalse(wired, "Should not be wired without hatsModule");
        assertEq(missing, "hatsModule not set");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Error Recovery Regression — Full State Cleanup
    // ═══════════════════════════════════════════════════════════════════════════

    function test_resetGardenInitialization_clearsWeightScheme() public {
        // Initialize with Power scheme
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Power, "Test Garden", "Test Description");

        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden1)),
            uint256(IGardensModule.WeightScheme.Power),
            "Should be Power before reset"
        );

        // Reset clears weight scheme (mapping delete resets to default 0 = Linear)
        vm.prank(owner);
        gardensModule.resetGardenInitialization(garden1);

        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden1)),
            uint256(IGardensModule.WeightScheme.Linear),
            "Weight scheme should be reset to default (Linear = 0)"
        );
    }

    function test_resetAndReinit_differentScheme_createsNewCommunityAndPools() public {
        // Init with Linear
        vm.prank(gardenToken);
        (address community1, address[] memory pools1) =
            gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");
        address registry1 = gardensModule.getGardenPowerRegistry(garden1);
        assertEq(pools1.length, 2, "Should have pools after first mint");

        // Reset
        vm.prank(owner);
        gardensModule.resetGardenInitialization(garden1);

        // Re-init with Exponential
        vm.prank(gardenToken);
        (address community2, address[] memory pools2) = gardensModule.onGardenMinted(
            garden1, IGardensModule.WeightScheme.Exponential, "Test Garden", "Test Description"
        );
        address registry2 = gardensModule.getGardenPowerRegistry(garden1);

        // Should have new community and pools; registry is the same singleton
        assertTrue(community2 != address(0), "New community should be created");
        assertTrue(registry2 != address(0), "Registry should still be set");
        assertTrue(community1 != community2, "New community should differ from original");
        // Unified registry is a singleton — both return the same address
        assertEq(registry1, registry2, "Registry should be the same singleton");
        assertEq(pools2.length, 2, "New pools should be created");

        // Verify new weight scheme
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden1)),
            uint256(IGardensModule.WeightScheme.Exponential),
            "Should be Exponential after re-init"
        );
    }

    function test_resetGardenInitialization_clearsPools() public {
        // Init (pools auto-created)
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");
        assertEq(gardensModule.getGardenSignalPools(garden1).length, 2, "Should have 2 pools before reset");

        // Reset
        vm.prank(owner);
        gardensModule.resetGardenInitialization(garden1);
        assertEq(gardensModule.getGardenSignalPools(garden1).length, 0, "Pools should be cleared after reset");
    }

    function test_resetAndReinit_createsNewPools() public {
        // Full lifecycle: init (auto-pools) → reset → re-init (new auto-pools)
        vm.prank(gardenToken);
        (, address[] memory oldPools) =
            gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");
        assertEq(oldPools.length, 2, "Should have auto-pools");

        vm.prank(owner);
        gardensModule.resetGardenInitialization(garden1);

        vm.prank(gardenToken);
        (, address[] memory newPools) =
            gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Power, "Test Garden", "Test Description");

        assertEq(newPools.length, 2, "Should create 2 new pools after re-init");
        assertEq(gardensModule.getGardenSignalPools(garden1).length, 2, "Stored pools should be 2");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Zero Stake Amount Edge Case
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_zeroStakeAmount_noTreasurySeeding() public {
        vm.prank(owner);
        gardensModule.setStakeAmountPerMember(0);

        uint256 balanceBefore = goodsToken.balanceOf(garden1);

        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        // stakeAmountPerMember=0 → treasuryAmount = 0*100 = 0, no mint attempted
        assertEq(goodsToken.balanceOf(garden1), balanceBefore, "No GOODS should be minted when stake=0");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Sequential Garden Mints — State Isolation
    // ═══════════════════════════════════════════════════════════════════════════

    function test_sequentialMints_stateIsIsolated() public {
        vm.startPrank(gardenToken);

        (address com1, address[] memory pools1) =
            gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");
        (address com2, address[] memory pools2) = gardensModule.onGardenMinted(
            garden2, IGardensModule.WeightScheme.Exponential, "Test Garden 2", "Test Description 2"
        );

        vm.stopPrank();

        // Each garden has independent state (except unified registry)
        assertTrue(com1 != com2, "Communities should be distinct");
        assertEq(pools1.length, 2, "Garden1 should have 2 pools");
        assertEq(pools2.length, 2, "Garden2 should have 2 pools");
        // Unified registry is a singleton — both gardens use the same registry
        assertEq(
            gardensModule.getGardenPowerRegistry(garden1),
            gardensModule.getGardenPowerRegistry(garden2),
            "Both gardens should share the unified registry"
        );

        // Modifying garden1 doesn't affect garden2
        vm.prank(owner);
        gardensModule.resetGardenInitialization(garden1);

        assertFalse(gardensModule.isGardenInitialized(garden1), "Garden1 should be reset");
        assertTrue(gardensModule.isGardenInitialized(garden2), "Garden2 should be unaffected");
        assertEq(gardensModule.getGardenSignalPools(garden2).length, 2, "Garden2 pools should be untouched");
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden2)),
            uint256(IGardensModule.WeightScheme.Exponential),
            "Garden2 scheme should be untouched"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Admin Setter Zero Address Validation
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setRegistryFactory_revertsWithZero() public {
        vm.prank(owner);
        vm.expectRevert(GardensModule.ZeroAddress.selector);
        gardensModule.setRegistryFactory(address(0));
    }

    function test_setPowerRegistry_revertsWithZero() public {
        vm.prank(owner);
        vm.expectRevert(GardensModule.ZeroAddress.selector);
        gardensModule.setPowerRegistry(address(0));
    }

    function test_setGoodsToken_revertsWithZero() public {
        vm.prank(owner);
        vm.expectRevert(GardensModule.ZeroAddress.selector);
        gardensModule.setGoodsToken(address(0));
    }

    function test_setHatsProtocol_revertsWithZero() public {
        vm.prank(owner);
        vm.expectRevert(GardensModule.ZeroAddress.selector);
        gardensModule.setHatsProtocol(address(0));
    }

    function test_setHatsModule_revertsWithZero() public {
        vm.prank(owner);
        vm.expectRevert(GardensModule.ZeroAddress.selector);
        gardensModule.setHatsModule(address(0));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // retryCreatePools — Delegation Test
    // ═══════════════════════════════════════════════════════════════════════════

    function test_retryCreatePools_worksAfterAutoPoolFailure() public {
        // Auto pool creation fails during mint
        registryFactory.setCreateFailingCommunities(true);
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");
        assertEq(gardensModule.getGardenSignalPools(garden1).length, 0, "No pools after failed auto-creation");

        // Fix the community
        MockRegistryCommunity(gardensModule.getGardenCommunity(garden1)).setShouldRevertPoolCreation(false);

        // retryCreatePools uses _executeCreatePools (internal), avoiding msg.sender issues
        vm.prank(owner);
        address[] memory pools = gardensModule.retryCreatePools(garden1);

        assertEq(pools.length, 2, "retryCreatePools should create 2 pools");
        assertEq(gardensModule.getGardenSignalPools(garden1).length, 2, "Pools should be stored");
    }

    function test_retryCreatePools_joinsGardenForStringOnlyMembershipCommunities() public {
        MockGardenMembershipJoiner gardenJoiner = new MockGardenMembershipJoiner();
        address garden = address(gardenJoiner);

        hatsModule.setGardenHats(garden, 3001, 3002, 3003, 3004, 3005, 3006, 3000);

        registryFactory.setCreateFailingCommunities(true);
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden, IGardensModule.WeightScheme.Linear, "Join Garden", "Join Description");

        MockRegistryCommunity community = MockRegistryCommunity(gardensModule.getGardenCommunity(garden));
        gardenJoiner.setCommunity(address(community));

        community.setShouldRevertPoolCreation(false);
        community.setDisableAddressMembership(true);
        community.setRequiredPoolMember(garden);

        vm.prank(owner);
        address[] memory pools = gardensModule.retryCreatePools(garden);

        assertEq(pools.length, 2, "retryCreatePools should succeed after garden self-joins");
        assertTrue(community.isRegisteredMember(garden), "garden should self-register via string membership path");
    }

    function test_retryCreatePools_onlyOwner() public {
        vm.prank(gardenToken);
        gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        gardensModule.retryCreatePools(garden1);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // attemptPoolCreation — Self-Call Restriction
    // ═══════════════════════════════════════════════════════════════════════════

    function test_attemptPoolCreation_revertsIfCalledExternally() public {
        vm.prank(owner);
        vm.expectRevert(GardensModule.OnlySelfCall.selector);
        gardensModule.attemptPoolCreation(garden1, address(0x42), address(0x43));
    }

    function test_attemptPoolCreation_revertsForAnyExternalCaller() public {
        vm.prank(gardenToken);
        vm.expectRevert(GardensModule.OnlySelfCall.selector);
        gardensModule.attemptPoolCreation(garden1, address(0x42), address(0x43));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Partial Initialization Event
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_emitsPartiallyInitialized_whenNoCommunity() public {
        GardensModule impl2 = new GardensModule();
        bytes memory initData2 = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(0), // no registry factory => no community
            address(mockPowerRegistry), // power registry
            address(goodsToken),
            hatsProtocol,
            address(hatsModule)
        );
        ERC1967Proxy proxy2 = new ERC1967Proxy(address(impl2), initData2);
        GardensModule module2 = GardensModule(address(proxy2));

        vm.prank(owner);
        module2.setGardenToken(gardenToken);

        vm.expectEmit(true, false, false, true);
        emit IGardensModule.GardenPartiallyInitialized(garden1, false, false);

        vm.prank(gardenToken);
        module2.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Fail-Fast Validation (requireFullSetup)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_requireFullSetup_defaultIsFalse() public {
        assertFalse(gardensModule.requireFullSetup(), "Default should be false");
    }

    function test_setRequireFullSetup_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        gardensModule.setRequireFullSetup(true);
    }

    function test_setRequireFullSetup_updatesValue() public {
        vm.prank(owner);
        gardensModule.setRequireFullSetup(true);
        assertTrue(gardensModule.requireFullSetup(), "Should be true after setting");
    }

    function test_requireFullSetup_revertsWhenRegistryFactoryMissing() public {
        // Deploy module without registry factory
        GardensModule impl2 = new GardensModule();
        bytes memory initData2 = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(0), // no registry factory
            address(mockPowerRegistry),
            address(goodsToken),
            hatsProtocol,
            address(hatsModule)
        );
        ERC1967Proxy proxy2 = new ERC1967Proxy(address(impl2), initData2);
        GardensModule module2 = GardensModule(address(proxy2));

        vm.startPrank(owner);
        module2.setGardenToken(gardenToken);
        module2.setRequireFullSetup(true);
        vm.stopPrank();

        vm.prank(gardenToken);
        vm.expectRevert(abi.encodeWithSelector(GardensModule.FactoriesNotConfigured.selector, "registryFactory"));
        module2.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");
    }

    function test_requireFullSetup_revertsWhenPowerRegistryMissing() public {
        // Deploy module without power registry
        GardensModule impl2 = new GardensModule();
        bytes memory initData2 = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(registryFactory),
            address(0), // no power registry
            address(goodsToken),
            hatsProtocol,
            address(hatsModule)
        );
        ERC1967Proxy proxy2 = new ERC1967Proxy(address(impl2), initData2);
        GardensModule module2 = GardensModule(address(proxy2));

        vm.startPrank(owner);
        module2.setGardenToken(gardenToken);
        module2.setRequireFullSetup(true);
        vm.stopPrank();

        vm.prank(gardenToken);
        vm.expectRevert(abi.encodeWithSelector(GardensModule.FactoriesNotConfigured.selector, "powerRegistry"));
        module2.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");
    }

    function test_requireFullSetup_allowsMintWhenFullyConfigured() public {
        // Full setup module — both factories present
        vm.prank(owner);
        gardensModule.setRequireFullSetup(true);

        vm.prank(gardenToken);
        (address community, address[] memory pools) =
            gardensModule.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        assertTrue(community != address(0), "Community should be created");
        assertEq(pools.length, 2, "Pools should be auto-created during mint");
        assertTrue(gardensModule.isGardenInitialized(garden1), "Garden should be initialized");
    }

    function test_requireFullSetup_gracefulDegradationWhenDisabled() public {
        // With requireFullSetup=false (default), missing factories are allowed
        GardensModule impl2 = new GardensModule();
        bytes memory initData2 = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(0), // no registry factory
            address(0), // no power registry factory
            address(goodsToken),
            hatsProtocol,
            address(hatsModule)
        );
        ERC1967Proxy proxy2 = new ERC1967Proxy(address(impl2), initData2);
        GardensModule module2 = GardensModule(address(proxy2));

        vm.prank(owner);
        module2.setGardenToken(gardenToken);
        // requireFullSetup is false by default

        vm.prank(gardenToken);
        (address community, address[] memory pools) =
            module2.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        // Should succeed with partial initialization (graceful degradation)
        assertEq(community, address(0), "Community should be zero when factory absent");
        assertEq(pools.length, 0, "No pools");
        assertTrue(module2.isGardenInitialized(garden1), "Garden should still be initialized");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Real GoodsToken — Minter Role Wiring (Task #6 / M3)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verifies that GardensModule can mint real GoodsToken after ownership transfer.
    ///         This mirrors the production deployment wiring in DeploymentBase:
    ///         1. Deploy GoodsToken with deployer as owner
    ///         2. gardensModule.setGoodsToken(address(goodsToken))
    ///         3. goodsToken.transferOwnership(address(gardensModule))
    ///         After wiring, onGardenMinted Step 3 (treasury seeding) succeeds.
    function test_gardensModule_canMintGoodsToken() public {
        // 1. Deploy real GoodsToken (onlyOwner mint, not MockGOODSToken)
        GoodsToken realGoods = new GoodsToken("Green Goods", "GOODS", address(this), 0, 10_000_000e18);

        // 2. Deploy a fresh GardensModule wired to real GoodsToken
        GardensModule impl2 = new GardensModule();
        bytes memory initData2 = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(registryFactory),
            address(mockPowerRegistry),
            address(realGoods), // real GoodsToken
            hatsProtocol,
            address(hatsModule)
        );
        ERC1967Proxy proxy2 = new ERC1967Proxy(address(impl2), initData2);
        GardensModule module2 = GardensModule(address(proxy2));

        // 3. Wire: set gardenToken + transfer GoodsToken ownership to module
        vm.prank(owner);
        module2.setGardenToken(gardenToken);
        realGoods.transferOwnership(address(module2));

        // 4. Mint garden — should seed treasury via goodsToken.mint()
        uint256 expectedAmount = 1e18 * 100; // stakeAmountPerMember(1e18) * INITIAL_MEMBER_SLOTS(100)

        vm.prank(gardenToken);
        module2.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        assertEq(realGoods.balanceOf(garden1), expectedAmount, "Garden should receive GOODS from real token");
        assertEq(realGoods.totalSupply(), expectedAmount, "Total supply should match minted amount");
    }

    /// @notice Verifies treasury seeding silently fails when GoodsToken ownership NOT transferred.
    ///         This documents the pre-fix behavior: onGardenMinted does NOT revert, it catches.
    function test_gardensModule_mintFailsGracefullyWithoutOwnership() public {
        // Deploy real GoodsToken but do NOT transfer ownership
        GoodsToken realGoods = new GoodsToken("Green Goods", "GOODS", address(this), 0, 10_000_000e18);

        GardensModule impl2 = new GardensModule();
        bytes memory initData2 = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(registryFactory),
            address(mockPowerRegistry),
            address(realGoods),
            hatsProtocol,
            address(hatsModule)
        );
        ERC1967Proxy proxy2 = new ERC1967Proxy(address(impl2), initData2);
        GardensModule module2 = GardensModule(address(proxy2));

        vm.prank(owner);
        module2.setGardenToken(gardenToken);
        // NOTE: NOT calling realGoods.transferOwnership(address(module2))

        // Mint should succeed (try/catch in onGardenMinted catches the mint failure)
        vm.prank(gardenToken);
        module2.onGardenMinted(garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description");

        // But treasury is NOT seeded
        assertEq(realGoods.balanceOf(garden1), 0, "No GOODS minted without ownership");
        assertTrue(module2.isGardenInitialized(garden1), "Garden still initialized despite mint failure");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Fault Injection — Power Registry Failures
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Tests the try-catch at Gardens.sol:418-422 — deregisterGarden reverts
    ///         but resetGardenInitialization still completes and clears local state
    function test_resetGardenInitialization_powerRegistryFails_handlesGracefully() public {
        // Deploy a GardensModule with a reverting power registry
        RevertingPowerRegistryForReset revertingRegistry = new RevertingPowerRegistryForReset();
        GardensModule impl = new GardensModule();
        bytes memory initData = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(registryFactory),
            address(revertingRegistry),
            address(goodsToken),
            hatsProtocol,
            address(hatsModule)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        GardensModule moduleWithRevertingRegistry = GardensModule(address(proxy));

        vm.prank(owner);
        moduleWithRevertingRegistry.setGardenToken(gardenToken);

        // Initialize the garden (onGardenMinted will attempt pool registration,
        // which may fail on the reverting registry but that's a separate path)
        vm.prank(gardenToken);
        moduleWithRevertingRegistry.onGardenMinted(
            garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description"
        );
        assertTrue(moduleWithRevertingRegistry.isGardenInitialized(garden1), "Garden should be initialized");

        // Reset should complete despite deregisterGarden reverting
        vm.expectEmit(true, false, false, false);
        emit IGardensModule.GardenInitializationReset(garden1);

        vm.prank(owner);
        moduleWithRevertingRegistry.resetGardenInitialization(garden1);

        // Local state should be cleared even though registry deregistration failed
        assertFalse(moduleWithRevertingRegistry.isGardenInitialized(garden1), "Should no longer be initialized");
        assertEq(moduleWithRevertingRegistry.getGardenCommunity(garden1), address(0), "Community should be cleared");
        assertEq(moduleWithRevertingRegistry.getGardenSignalPools(garden1).length, 0, "Pools should be cleared");
    }

    /// @notice Tests the try-catch loop at Gardens.sol:676-680 — registerPool reverts
    ///         for each pool, emitting PoolRegistrationFailed per pool, but garden
    ///         initialization still completes and pools are stored in local state
    function test_registerPoolsInPowerRegistry_poolRegistrationFails_emitsEvents() public {
        // Deploy a GardensModule with a power registry that always reverts on registerPool.
        // This tests that each per-pool try-catch at line 676 independently catches and
        // emits PoolRegistrationFailed, and that garden initialization is not blocked.
        // NOTE: We can't selectively fail one pool because EVM state rollback resets
        // counter-based approaches inside reverted calls.
        RegisterPoolRevertPowerRegistry revertPoolRegistry = new RegisterPoolRevertPowerRegistry();
        GardensModule impl = new GardensModule();
        bytes memory initData = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(registryFactory),
            address(revertPoolRegistry),
            address(goodsToken),
            hatsProtocol,
            address(hatsModule)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        GardensModule moduleWithRevertPool = GardensModule(address(proxy));

        vm.prank(owner);
        moduleWithRevertPool.setGardenToken(gardenToken);

        // Record logs to capture PoolRegistrationFailed events
        vm.recordLogs();

        vm.prank(gardenToken);
        (, address[] memory pools) = moduleWithRevertPool.onGardenMinted(
            garden1, IGardensModule.WeightScheme.Linear, "Test Garden", "Test Description"
        );

        assertTrue(pools.length >= 2, "Should create 2 signal pools");

        // Count PoolRegistrationFailed events — should have one per pool
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 failEventCount = 0;
        bytes32 poolRegFailedSig = keccak256("PoolRegistrationFailed(address,address,string)");
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics.length > 0 && logs[i].topics[0] == poolRegFailedSig) {
                failEventCount++;
            }
        }
        assertEq(failEventCount, pools.length, "PoolRegistrationFailed should be emitted once per pool");

        // Pools should still be stored in local state (gardenSignalPools)
        address[] memory storedPools = moduleWithRevertPool.getGardenSignalPools(garden1);
        assertEq(storedPools.length, pools.length, "Pools should be stored despite registration failure");

        // Garden should still be fully initialized
        assertTrue(
            moduleWithRevertPool.isGardenInitialized(garden1),
            "Garden should be initialized despite pool registration failure"
        );
    }
}
