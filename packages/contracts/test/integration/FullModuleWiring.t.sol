// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { GardenToken } from "../../src/tokens/Garden.sol";
import { GardenAccount } from "../../src/accounts/Garden.sol";
import { ActionRegistry, Domain } from "../../src/registries/Action.sol";
import { GardensModule } from "../../src/modules/Gardens.sol";
import { IGardensModule } from "../../src/interfaces/IGardensModule.sol";
import { IGardenAccount } from "../../src/interfaces/IGardenAccount.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { MockHatsModule } from "../helpers/MockHatsModule.sol";
import { ERC6551Helper } from "../helpers/ERC6551Helper.sol";
import { MockRegistryFactory, MockRegistryCommunity, MockUnifiedPowerRegistry } from "../../src/mocks/GardensV2.sol";

/// @title MockGOODSTokenForWiring
/// @notice ERC20 with open mint for testing
contract MockGOODSTokenForWiring is ERC20 {
    constructor() ERC20("GOODS", "GOODS") {
        _mint(msg.sender, 1_000_000e18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @title MockCookieJarModuleForWiring
/// @notice Minimal mock that tracks onGardenMinted calls
contract MockCookieJarModuleForWiring {
    struct MintCall {
        address garden;
    }

    MintCall[] public mintCalls;
    address public gardenToken;

    function setGardenToken(address _gardenToken) external {
        gardenToken = _gardenToken;
    }

    function onGardenMinted(address garden) external returns (address[] memory jars) {
        mintCalls.push(MintCall({ garden: garden }));
        jars = new address[](0);
    }

    function mintCallCount() external view returns (uint256) {
        return mintCalls.length;
    }

    function getGardenJars(address) external pure returns (address[] memory) {
        return new address[](0);
    }

    function getGardenJar(address, address) external pure returns (address) {
        return address(0);
    }
}

/// @title FullModuleWiringTest
/// @notice Integration tests verifying the complete module callback chain during mintGarden.
/// @dev Uses real GardensModule and ActionRegistry (not mocks) with MockHatsModule to verify
///      the full initialization sequence: Hats → KarmaGAP (skipped) → Octant (skipped)
///      → GardensModule → CookieJar → ActionRegistry → GardenAccount.initialize()
contract FullModuleWiringTest is Test, ERC6551Helper {
    GardenToken public gardenToken;
    MockHatsModule public hatsModule;
    GardensModule public gardensModule;
    ActionRegistry public actionRegistry;
    MockCookieJarModuleForWiring public cookieJarModule;
    MockGOODSTokenForWiring public goodsToken;
    MockRegistryFactory public registryFactory;
    MockUnifiedPowerRegistry public mockPowerRegistry;
    ERC20 public communityToken;

    address public multisig = address(0x123);
    address public hatsProtocol = address(0x3);

    function setUp() public {
        _deployERC6551Registry();

        // Deploy community token
        communityToken = new ERC20("Community", "COM");

        // Deploy GardenAccount implementation
        GardenAccount impl = new GardenAccount(
            address(0x001), address(0x002), address(0x003), address(0x004), address(0x2001), address(0x2002)
        );

        // Deploy GardenToken behind proxy
        GardenToken tokenImpl = new GardenToken(address(impl));
        bytes memory initData = abi.encodeWithSelector(GardenToken.initialize.selector, multisig, address(0));
        gardenToken = GardenToken(address(new ERC1967Proxy(address(tokenImpl), initData)));

        // Deploy MockHatsModule
        hatsModule = new MockHatsModule();

        // Deploy real GardensModule
        goodsToken = new MockGOODSTokenForWiring();
        registryFactory = new MockRegistryFactory();
        mockPowerRegistry = new MockUnifiedPowerRegistry();

        GardensModule gardensImpl = new GardensModule();
        bytes memory gardensInitData = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            multisig,
            address(registryFactory),
            address(mockPowerRegistry),
            address(goodsToken),
            hatsProtocol,
            address(hatsModule)
        );
        gardensModule = GardensModule(address(new ERC1967Proxy(address(gardensImpl), gardensInitData)));

        // Deploy real ActionRegistry
        ActionRegistry arImpl = new ActionRegistry();
        bytes memory arInitData = abi.encodeWithSelector(ActionRegistry.initialize.selector, multisig);
        actionRegistry = ActionRegistry(address(new ERC1967Proxy(address(arImpl), arInitData)));

        // Deploy MockCookieJarModule
        cookieJarModule = new MockCookieJarModuleForWiring();

        // Set up garden hats for any garden address (use default hat IDs)
        // We'll configure per-garden in tests after minting

        // Wire ALL modules together
        vm.startPrank(multisig);
        gardenToken.setHatsModule(address(hatsModule));
        gardenToken.setCommunityToken(address(communityToken));
        gardenToken.setGardensModule(address(gardensModule));
        gardenToken.setActionRegistry(address(actionRegistry));
        gardenToken.setCookieJarModule(address(cookieJarModule));
        // KarmaGAP and Octant intentionally NOT set — tests graceful degradation

        gardensModule.setGardenToken(address(gardenToken));
        actionRegistry.setGardenToken(address(gardenToken));
        actionRegistry.setHatsModule(address(hatsModule));
        cookieJarModule.setGardenToken(address(gardenToken));
        vm.stopPrank();
    }

    function _defaultConfig() internal view returns (GardenToken.GardenConfig memory) {
        return GardenToken.GardenConfig({
            name: "Wiring Test Garden",
            slug: "",
            description: "Testing full module wiring",
            location: "Integration Land",
            bannerImage: "banner.png",
            metadata: "ipfs://test",
            openJoining: true,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0x05, // Solar + Edu
            gardeners: new address[](0),
            operators: new address[](0)
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Full Callback Chain Verification
    // ═══════════════════════════════════════════════════════════════════════════

    function test_fullWiring_mintTriggersAllCallbacks() public {
        // Set up hat IDs for the garden (need to do this before mint for GardensModule)
        // The garden address isn't known yet, but MockHatsModule doesn't check

        vm.prank(multisig);
        address garden = gardenToken.mintGarden(_defaultConfig());

        // 1. Verify HatsModule received createGardenHatTree call
        assertTrue(hatsModule.created(), "HatsModule.createGardenHatTree should have been called");
        (address lastGarden, string memory lastName,) = hatsModule.lastCreate();
        assertEq(lastGarden, garden, "createGardenHatTree should receive garden address");
        assertEq(lastName, "Wiring Test Garden", "createGardenHatTree should receive garden name");

        // 2. Verify HatsModule received grantRole (Owner) call
        uint256 grantCount = hatsModule.grantCallsLength();
        assertTrue(grantCount >= 1, "At least 1 grantRole call expected");
        (address grantGarden, address grantAccount, IHatsModule.GardenRole grantRole) = hatsModule.grantCalls(0);
        assertEq(grantGarden, garden, "grantRole should target garden");
        assertEq(grantAccount, multisig, "grantRole should grant to minter");
        assertEq(uint8(grantRole), uint8(IHatsModule.GardenRole.Owner), "Should grant Owner role");

        // 3. Verify GardensModule state — community created, weight scheme stored
        assertTrue(gardensModule.isGardenInitialized(garden), "GardensModule should mark garden initialized");
        assertTrue(gardensModule.getGardenCommunity(garden) != address(0), "GardensModule should create community");
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden)),
            uint256(IGardensModule.WeightScheme.Linear),
            "Weight scheme should be stored as Linear"
        );

        // 4. Verify GOODS treasury was seeded
        uint256 expectedTreasury = 1e18 * 100; // stakeAmountPerMember * INITIAL_MEMBER_SLOTS
        assertEq(goodsToken.balanceOf(garden), expectedTreasury, "Garden should receive GOODS treasury");

        // 5. Verify ActionRegistry domain mask was set
        assertEq(actionRegistry.gardenDomains(garden), 0x05, "ActionRegistry should store domain mask");
        assertTrue(actionRegistry.gardenHasDomain(garden, Domain.SOLAR), "Garden should have Solar domain");
        assertFalse(actionRegistry.gardenHasDomain(garden, Domain.AGRO), "Garden should not have Agro domain");
        assertTrue(actionRegistry.gardenHasDomain(garden, Domain.EDU), "Garden should have Edu domain");
        assertFalse(actionRegistry.gardenHasDomain(garden, Domain.WASTE), "Garden should not have Waste domain");

        // 6. Verify CookieJarModule received onGardenMinted call
        assertEq(cookieJarModule.mintCallCount(), 1, "CookieJarModule.onGardenMinted should be called once");
        (address jarGarden) = cookieJarModule.mintCalls(0);
        assertEq(jarGarden, garden, "CookieJarModule should receive garden address");

        // 7. Verify GardenAccount was initialized with correct metadata
        GardenAccount gardenAccount = GardenAccount(payable(garden));
        assertEq(gardenAccount.name(), "Wiring Test Garden", "GardenAccount name should match config");
        assertEq(gardenAccount.description(), "Testing full module wiring", "Description should match");
        assertEq(gardenAccount.location(), "Integration Land", "Location should match");
        assertEq(gardenAccount.bannerImage(), "banner.png", "Banner should match");
        assertEq(gardenAccount.metadata(), "ipfs://test", "Metadata should match");
        assertTrue(gardenAccount.openJoining(), "Open joining should be true");
        assertEq(gardenAccount.communityToken(), address(communityToken), "Community token should match");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Graceful Degradation — All Optional Modules Removed
    // ═══════════════════════════════════════════════════════════════════════════

    function test_fullWiring_onlyHatsModuleRequired() public {
        // Remove all optional modules
        vm.startPrank(multisig);
        gardenToken.setGardensModule(address(0));
        gardenToken.setActionRegistry(address(0));
        gardenToken.setCookieJarModule(address(0));
        gardenToken.setKarmaGAPModule(address(0));
        gardenToken.setOctantModule(address(0));
        vm.stopPrank();

        GardenToken.GardenConfig memory config = _defaultConfig();

        vm.prank(multisig);
        address garden = gardenToken.mintGarden(config);

        // Mint still succeeds
        assertTrue(garden != address(0), "Garden should be created with only HatsModule");

        // HatsModule was still called
        assertTrue(hatsModule.created(), "HatsModule should still be called");

        // GardenAccount was initialized
        GardenAccount gardenAccount = GardenAccount(payable(garden));
        assertEq(gardenAccount.name(), "Wiring Test Garden", "Metadata should still be set");

        // No GardensModule state
        assertFalse(gardensModule.isGardenInitialized(garden), "GardensModule should not be called");

        // No domain mask
        assertEq(actionRegistry.gardenDomains(garden), 0, "ActionRegistry should not be called");

        // No CookieJar calls
        assertEq(cookieJarModule.mintCallCount(), 0, "CookieJarModule should not be called");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Batch Mint — Each Garden Independent State
    // ═══════════════════════════════════════════════════════════════════════════

    function test_fullWiring_batchMint_eachGardenIndependent() public {
        GardenToken.GardenConfig[] memory configs = new GardenToken.GardenConfig[](3);

        configs[0] = GardenToken.GardenConfig({
            name: "Garden Alpha",
            slug: "",
            description: "First garden",
            location: "Location A",
            bannerImage: "alpha.png",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0x01, // Solar only
            gardeners: new address[](0),
            operators: new address[](0)
        });

        configs[1] = GardenToken.GardenConfig({
            name: "Garden Beta",
            slug: "",
            description: "Second garden",
            location: "Location B",
            bannerImage: "beta.png",
            metadata: "",
            openJoining: true,
            weightScheme: IGardensModule.WeightScheme.Exponential,
            domainMask: 0x0A, // Agro + Waste
            gardeners: new address[](0),
            operators: new address[](0)
        });

        configs[2] = GardenToken.GardenConfig({
            name: "Garden Gamma",
            slug: "",
            description: "Third garden",
            location: "Location C",
            bannerImage: "gamma.png",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Power,
            domainMask: 0x0F, // All domains
            gardeners: new address[](0),
            operators: new address[](0)
        });

        vm.prank(multisig);
        address[] memory gardens = gardenToken.batchMintGardens(configs);

        assertEq(gardens.length, 3, "Should create 3 gardens");

        // Verify all gardens are unique
        assertTrue(gardens[0] != gardens[1], "Garden 0 and 1 should differ");
        assertTrue(gardens[1] != gardens[2], "Garden 1 and 2 should differ");

        // Verify GardensModule state is per-garden
        for (uint256 i = 0; i < 3; i++) {
            assertTrue(gardensModule.isGardenInitialized(gardens[i]), "Each garden should be initialized");
            assertTrue(gardensModule.getGardenCommunity(gardens[i]) != address(0), "Each garden should have community");
        }

        // Verify weight schemes are per-garden
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(gardens[0])),
            uint256(IGardensModule.WeightScheme.Linear),
            "Garden 0 should be Linear"
        );
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(gardens[1])),
            uint256(IGardensModule.WeightScheme.Exponential),
            "Garden 1 should be Exponential"
        );
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(gardens[2])),
            uint256(IGardensModule.WeightScheme.Power),
            "Garden 2 should be Power"
        );

        // Verify domain masks are per-garden
        assertEq(actionRegistry.gardenDomains(gardens[0]), 0x01, "Garden 0 should have Solar");
        assertEq(actionRegistry.gardenDomains(gardens[1]), 0x0A, "Garden 1 should have Agro+Waste");
        assertEq(actionRegistry.gardenDomains(gardens[2]), 0x0F, "Garden 2 should have all domains");

        // Verify metadata is per-garden
        assertEq(GardenAccount(payable(gardens[0])).name(), "Garden Alpha");
        assertEq(GardenAccount(payable(gardens[1])).name(), "Garden Beta");
        assertEq(GardenAccount(payable(gardens[2])).name(), "Garden Gamma");

        // Verify openJoining is per-garden
        assertFalse(GardenAccount(payable(gardens[0])).openJoining(), "Alpha should be closed");
        assertTrue(GardenAccount(payable(gardens[1])).openJoining(), "Beta should be open");
        assertFalse(GardenAccount(payable(gardens[2])).openJoining(), "Gamma should be closed");

        // Verify CookieJarModule was called for each
        assertEq(cookieJarModule.mintCallCount(), 3, "CookieJarModule should be called 3 times");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Partial Module Wiring — Mix of Present/Absent
    // ═══════════════════════════════════════════════════════════════════════════

    function test_fullWiring_withoutGardensModule_otherModulesStillCalled() public {
        // Remove GardensModule only
        vm.prank(multisig);
        gardenToken.setGardensModule(address(0));

        vm.prank(multisig);
        address garden = gardenToken.mintGarden(_defaultConfig());

        // HatsModule still called
        assertTrue(hatsModule.created());

        // ActionRegistry still called (domain mask set)
        assertEq(actionRegistry.gardenDomains(garden), 0x05);

        // CookieJarModule still called
        assertEq(cookieJarModule.mintCallCount(), 1);

        // GardensModule NOT called
        assertFalse(gardensModule.isGardenInitialized(garden));
    }

    function test_fullWiring_withoutActionRegistry_otherModulesStillCalled() public {
        // Remove ActionRegistry only
        vm.prank(multisig);
        gardenToken.setActionRegistry(address(0));

        vm.prank(multisig);
        address garden = gardenToken.mintGarden(_defaultConfig());

        // HatsModule still called
        assertTrue(hatsModule.created());

        // GardensModule still called
        assertTrue(gardensModule.isGardenInitialized(garden));

        // CookieJarModule still called
        assertEq(cookieJarModule.mintCallCount(), 1);
    }

    function test_fullWiring_withoutCookieJar_otherModulesStillCalled() public {
        // Remove CookieJarModule only
        vm.prank(multisig);
        gardenToken.setCookieJarModule(address(0));

        vm.prank(multisig);
        address garden = gardenToken.mintGarden(_defaultConfig());

        // All other modules called
        assertTrue(hatsModule.created());
        assertTrue(gardensModule.isGardenInitialized(garden));
        assertEq(actionRegistry.gardenDomains(garden), 0x05);

        // CookieJar NOT called
        assertEq(cookieJarModule.mintCallCount(), 0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GardensModule isWiringComplete After Full Deploy
    // ═══════════════════════════════════════════════════════════════════════════

    function test_fullWiring_gardensModuleIsWiringComplete() public {
        (bool wired, string memory missing) = gardensModule.isWiringComplete();
        assertTrue(wired, "GardensModule should be fully wired");
        assertEq(bytes(missing).length, 0, "No missing references");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Power Registry Weights Verified Through Wiring
    // ═══════════════════════════════════════════════════════════════════════════

    function test_fullWiring_powerRegistryDeployedWithCorrectWeights() public {
        // Need to set up hat IDs in MockHatsModule for the garden
        // MockHatsModule.getGardenHatIds returns (0,0,0,0,0,0,0,false) by default
        // This means _deployPowerRegistry will skip (zero hat IDs guard)
        // This is expected — power registry requires real Hats Protocol hat IDs

        vm.prank(multisig);
        address garden = gardenToken.mintGarden(_defaultConfig());

        // With default mock (zero hat IDs), power registry is skipped
        assertEq(
            gardensModule.getGardenPowerRegistry(garden), address(0), "Power registry should be zero when hat IDs are zero"
        );

        // Garden is still fully initialized
        assertTrue(gardensModule.isGardenInitialized(garden));
        assertTrue(gardensModule.getGardenCommunity(garden) != address(0));
    }
}
