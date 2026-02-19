// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { UnifiedPowerRegistry } from "../../src/registries/Power.sol";
import { NFTPowerSource, NFTType } from "../../src/interfaces/IGardensV2.sol";

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

/// @title MockHatsProtocol
/// @notice Minimal mock for testing UnifiedPowerRegistry's Hats Protocol integration
contract MockHatsProtocol {
    mapping(address user => mapping(uint256 hatId => bool wearing)) public wearers;

    function setWearer(address user, uint256 hatId, bool isWearer) external {
        wearers[user][hatId] = isWearer;
    }

    function isWearerOfHat(address user, uint256 hatId) external view returns (bool) {
        return wearers[user][hatId];
    }
}

/// @title MockERC721
/// @notice Mintable ERC721 for testing UnifiedPowerRegistry with ERC721 sources
contract MockERC721 is ERC721 {
    uint256 private _nextTokenId;

    constructor() ERC721("MockBadge", "BADGE") { }

    function mint(address to) external returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _mint(to, tokenId);
    }
}

/// @title MockERC1155
/// @notice Mintable ERC1155 for testing UnifiedPowerRegistry with ERC1155 sources
contract MockERC1155 is ERC1155 {
    constructor() ERC1155("") { }

    function mint(address to, uint256 id, uint256 amount) external {
        _mint(to, id, amount, "");
    }
}

/// @title UnifiedPowerRegistryTest
/// @notice Tests for the UnifiedPowerRegistry (UUPS upgradeable, single-instance per protocol)
contract UnifiedPowerRegistryTest is Test {
    UnifiedPowerRegistry public registry;
    MockHatsProtocol public hats;

    address public owner = makeAddr("owner");
    address public gardensModule = makeAddr("gardensModule");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public unauthorized = makeAddr("unauthorized");

    // Hat IDs (arbitrary non-zero values)
    uint256 public constant OPERATOR_HAT = 0x0001000100010001000000000000000000000000000000000000000000000000;
    uint256 public constant GARDENER_HAT = 0x0001000100010002000000000000000000000000000000000000000000000000;
    uint256 public constant COMMUNITY_HAT = 0x0001000100010003000000000000000000000000000000000000000000000000;

    // Weights (basis points -- Green Goods Linear scheme, 10000 = 1x)
    uint256 public constant OPERATOR_WEIGHT = 30_000;
    uint256 public constant GARDENER_WEIGHT = 20_000;
    uint256 public constant COMMUNITY_WEIGHT = 10_000;

    // Garden and pool addresses
    address public garden1 = address(0x100);
    address public garden2 = address(0x200);
    address public pool1 = address(0x301);
    address public pool2 = address(0x302);

    function setUp() public {
        hats = new MockHatsProtocol();

        // Deploy UnifiedPowerRegistry behind UUPS proxy
        UnifiedPowerRegistry impl = new UnifiedPowerRegistry();
        bytes memory initData =
            abi.encodeWithSelector(UnifiedPowerRegistry.initialize.selector, owner, address(hats), gardensModule);
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        registry = UnifiedPowerRegistry(address(proxy));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Initialization
    // ═══════════════════════════════════════════════════════════════════════════

    function test_initialize_setsOwner() public {
        assertEq(registry.owner(), owner, "Owner should be set");
    }

    function test_initialize_setsHatsProtocol() public {
        assertEq(registry.hatsProtocol(), address(hats), "hatsProtocol should be set");
    }

    function test_initialize_setsGardensModule() public {
        assertEq(registry.gardensModule(), gardensModule, "gardensModule should be set");
    }

    function test_initialize_revertsWithZeroOwner() public {
        UnifiedPowerRegistry impl = new UnifiedPowerRegistry();
        bytes memory initData = abi.encodeWithSelector(
            UnifiedPowerRegistry.initialize.selector,
            address(0), // zero owner
            address(hats),
            gardensModule
        );
        vm.expectRevert(UnifiedPowerRegistry.ZeroAddress.selector);
        new ERC1967Proxy(address(impl), initData);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // registerGarden — Stores Sources
    // ═══════════════════════════════════════════════════════════════════════════

    function test_registerGarden_storesSources() public {
        NFTPowerSource[] memory sources = _buildSources();

        vm.prank(gardensModule);
        registry.registerGarden(garden1, sources);

        assertTrue(registry.isGardenRegistered(garden1), "Garden should be registered");
        assertEq(registry.getGardenSourceCount(garden1), 3, "Should have 3 sources");

        NFTPowerSource[] memory stored = registry.getGardenSources(garden1);
        assertEq(stored.length, 3, "Stored sources length should be 3");
        assertEq(stored[0].weight, OPERATOR_WEIGHT, "Operator weight should match");
        assertEq(stored[1].weight, GARDENER_WEIGHT, "Gardener weight should match");
        assertEq(stored[2].weight, COMMUNITY_WEIGHT, "Community weight should match");
        assertEq(stored[0].hatId, OPERATOR_HAT, "Operator hatId should match");
        assertEq(stored[1].hatId, GARDENER_HAT, "Gardener hatId should match");
        assertEq(stored[2].hatId, COMMUNITY_HAT, "Community hatId should match");
    }

    function test_registerGarden_singleSource() public {
        NFTPowerSource[] memory sources = new NFTPowerSource[](1);
        sources[0] =
            NFTPowerSource({ token: address(hats), nftType: NFTType.HAT, weight: 10_000, tokenId: 0, hatId: OPERATOR_HAT });

        vm.prank(gardensModule);
        registry.registerGarden(garden1, sources);

        assertEq(registry.getGardenSourceCount(garden1), 1, "Should have 1 source");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // registerPool — Maps Pool to Garden
    // ═══════════════════════════════════════════════════════════════════════════

    function test_registerPool_mapsPoolToGarden() public {
        vm.startPrank(gardensModule);
        registry.registerGarden(garden1, _buildSources());
        registry.registerPool(pool1, garden1);
        vm.stopPrank();

        assertEq(registry.getPoolGarden(pool1), garden1, "Pool should map to garden");
        assertEq(registry.poolGarden(pool1), garden1, "poolGarden mapping should match");
    }

    function test_registerPool_multiplePoolsSameGarden() public {
        vm.startPrank(gardensModule);
        registry.registerGarden(garden1, _buildSources());
        registry.registerPool(pool1, garden1);
        registry.registerPool(pool2, garden1);
        vm.stopPrank();

        assertEq(registry.getPoolGarden(pool1), garden1, "Pool1 should map to garden1");
        assertEq(registry.getPoolGarden(pool2), garden1, "Pool2 should map to garden1");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // getMemberPowerInStrategy — Weighted Power Calculation
    // ═══════════════════════════════════════════════════════════════════════════

    function test_getMemberPower_singleHatViaPool() public {
        vm.startPrank(gardensModule);
        registry.registerGarden(garden1, _buildSources());
        registry.registerPool(pool1, garden1);
        vm.stopPrank();

        // Alice wears the operator hat (weight=30000, power = 1*30000/10000 = 3)
        hats.setWearer(alice, OPERATOR_HAT, true);

        uint256 power = registry.getMemberPowerInStrategy(alice, pool1);
        assertEq(power, 3, "Operator hat with weight=30000 gives 3 after /10000");
    }

    function test_getMemberPower_highWeightProducesNonZero() public {
        NFTPowerSource[] memory sources = new NFTPowerSource[](1);
        sources[0] =
            NFTPowerSource({ token: address(hats), nftType: NFTType.HAT, weight: 10_000, tokenId: 0, hatId: OPERATOR_HAT });

        vm.startPrank(gardensModule);
        registry.registerGarden(garden1, sources);
        registry.registerPool(pool1, garden1);
        vm.stopPrank();

        hats.setWearer(alice, OPERATOR_HAT, true);

        // Power = (1 * 10000) / 10000 = 1
        uint256 power = registry.getMemberPowerInStrategy(alice, pool1);
        assertEq(power, 1, "Weight=10000 with 1 hat should give power=1");
    }

    function test_getMemberPower_multipleHats() public {
        NFTPowerSource[] memory sources = new NFTPowerSource[](2);
        sources[0] =
            NFTPowerSource({ token: address(hats), nftType: NFTType.HAT, weight: 30_000, tokenId: 0, hatId: OPERATOR_HAT });
        sources[1] =
            NFTPowerSource({ token: address(hats), nftType: NFTType.HAT, weight: 20_000, tokenId: 0, hatId: GARDENER_HAT });

        vm.startPrank(gardensModule);
        registry.registerGarden(garden1, sources);
        registry.registerPool(pool1, garden1);
        vm.stopPrank();

        hats.setWearer(alice, OPERATOR_HAT, true);
        hats.setWearer(alice, GARDENER_HAT, true);

        // Power = (1 * 30000 / 10000) + (1 * 20000 / 10000) = 3 + 2 = 5
        uint256 power = registry.getMemberPowerInStrategy(alice, pool1);
        assertEq(power, 5, "Multiple hats should sum weighted power");
    }

    function test_getMemberPower_noHatsReturnsZero() public {
        vm.startPrank(gardensModule);
        registry.registerGarden(garden1, _buildSources());
        registry.registerPool(pool1, garden1);
        vm.stopPrank();

        uint256 power = registry.getMemberPowerInStrategy(bob, pool1);
        assertEq(power, 0, "Non-wearer should have zero power");
    }

    function test_getMemberPower_unknownPoolReturnsZero() public {
        // No pool registered, should return 0 without revert
        uint256 power = registry.getMemberPowerInStrategy(alice, address(0xDEAD));
        assertEq(power, 0, "Unknown pool should return zero power");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Regression: Production Weight Schemes Must Produce Non-Zero Power
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Regression test: all production weight schemes must give hat wearers non-zero power.
    ///         Previously, weights < 10_000 caused (1 * weight) / 10_000 = 0 due to integer division,
    ///         rendering conviction voting non-functional for all HAT-based roles.
    function test_productionWeights_allSchemesProduceNonZeroPower() public {
        // Linear scheme weights: community=10_000, gardener=20_000, operator=30_000
        uint256[3] memory linearW = [uint256(10_000), 20_000, 30_000];
        // Exponential scheme weights: community=20_000, gardener=40_000, operator=160_000
        uint256[3] memory exponentialW = [uint256(20_000), 40_000, 160_000];
        // Power scheme weights: community=30_000, gardener=90_000, operator=810_000
        uint256[3] memory powerW = [uint256(30_000), 90_000, 810_000];

        uint256[3][3] memory allSchemes = [linearW, exponentialW, powerW];
        string[3] memory schemeNames = ["Linear", "Exponential", "Power"];

        for (uint256 s = 0; s < 3; s++) {
            address garden = address(uint160(0x1000 + s));
            address pool = address(uint160(0x2000 + s));

            NFTPowerSource[] memory sources = new NFTPowerSource[](3);
            for (uint256 r = 0; r < 3; r++) {
                uint256[3] memory hatIds = [OPERATOR_HAT, GARDENER_HAT, COMMUNITY_HAT];
                sources[r] = NFTPowerSource({
                    token: address(hats),
                    nftType: NFTType.HAT,
                    weight: allSchemes[s][r],
                    tokenId: 0,
                    hatId: hatIds[r]
                });
            }

            vm.startPrank(gardensModule);
            registry.registerGarden(garden, sources);
            registry.registerPool(pool, garden);
            vm.stopPrank();

            // Test each role produces non-zero power
            uint256[3] memory hatIdsCheck = [OPERATOR_HAT, GARDENER_HAT, COMMUNITY_HAT];
            string[3] memory roleNames = ["operator", "gardener", "community"];

            for (uint256 r = 0; r < 3; r++) {
                address member = address(uint160(0x3000 + s * 10 + r));
                hats.setWearer(member, hatIdsCheck[r], true);

                uint256 power = registry.getMemberPowerInStrategy(member, pool);
                assertTrue(power > 0, string.concat(schemeNames[s], " scheme: ", roleNames[r], " must have non-zero power"));

                // Verify exact expected value: weight / 10_000
                uint256 expectedPower = allSchemes[s][r] / 10_000;
                assertEq(power, expectedPower, string.concat(schemeNames[s], " scheme: ", roleNames[r], " power mismatch"));
            }
        }
    }

    /// @notice Verify the relative ratios between roles are preserved after weight scaling
    function test_productionWeights_linearRatiosPreserved() public {
        vm.startPrank(gardensModule);
        registry.registerGarden(garden1, _buildSources());
        registry.registerPool(pool1, garden1);
        vm.stopPrank();

        hats.setWearer(alice, OPERATOR_HAT, true);
        hats.setWearer(bob, GARDENER_HAT, true);
        address carol = makeAddr("carol");
        hats.setWearer(carol, COMMUNITY_HAT, true);

        uint256 operatorPower = registry.getMemberPowerInStrategy(alice, pool1);
        uint256 gardenerPower = registry.getMemberPowerInStrategy(bob, pool1);
        uint256 communityPower = registry.getMemberPowerInStrategy(carol, pool1);

        // Linear scheme: operator:gardener:community = 3:2:1
        assertEq(operatorPower, 3, "Operator should have power=3");
        assertEq(gardenerPower, 2, "Gardener should have power=2");
        assertEq(communityPower, 1, "Community should have power=1");

        // Verify ratios
        assertEq(operatorPower * 1, communityPower * 3, "Operator:Community should be 3:1");
        assertEq(gardenerPower * 1, communityPower * 2, "Gardener:Community should be 2:1");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Access Control — onlyGardensModule
    // ═══════════════════════════════════════════════════════════════════════════

    function test_registerGarden_revertsForNonGardensModule() public {
        NFTPowerSource[] memory sources = _buildSources();

        vm.prank(unauthorized);
        vm.expectRevert(abi.encodeWithSelector(UnifiedPowerRegistry.NotGardensModule.selector, unauthorized));
        registry.registerGarden(garden1, sources);
    }

    function test_registerPool_revertsForNonGardensModule() public {
        vm.prank(unauthorized);
        vm.expectRevert(abi.encodeWithSelector(UnifiedPowerRegistry.NotGardensModule.selector, unauthorized));
        registry.registerPool(pool1, garden1);
    }

    function test_registerGarden_revertsForOwner() public {
        NFTPowerSource[] memory sources = _buildSources();

        // Owner is NOT gardensModule -- should revert
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(UnifiedPowerRegistry.NotGardensModule.selector, owner));
        registry.registerGarden(garden1, sources);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Duplicate Registration Reverts
    // ═══════════════════════════════════════════════════════════════════════════

    function test_registerGarden_revertsOnDuplicate() public {
        NFTPowerSource[] memory sources = _buildSources();

        vm.startPrank(gardensModule);
        registry.registerGarden(garden1, sources);

        vm.expectRevert(abi.encodeWithSelector(UnifiedPowerRegistry.GardenAlreadyRegistered.selector, garden1));
        registry.registerGarden(garden1, sources);
        vm.stopPrank();
    }

    function test_registerPool_revertsOnDuplicate() public {
        vm.startPrank(gardensModule);
        registry.registerGarden(garden1, _buildSources());
        registry.registerPool(pool1, garden1);

        vm.expectRevert(abi.encodeWithSelector(UnifiedPowerRegistry.PoolAlreadyRegistered.selector, pool1));
        registry.registerPool(pool1, garden1);
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Input Validation
    // ═══════════════════════════════════════════════════════════════════════════

    function test_registerGarden_revertsWithZeroGarden() public {
        NFTPowerSource[] memory sources = _buildSources();

        vm.prank(gardensModule);
        vm.expectRevert(UnifiedPowerRegistry.ZeroAddress.selector);
        registry.registerGarden(address(0), sources);
    }

    function test_registerGarden_revertsWithEmptySources() public {
        NFTPowerSource[] memory sources = new NFTPowerSource[](0);

        vm.prank(gardensModule);
        vm.expectRevert(UnifiedPowerRegistry.NoPowerSources.selector);
        registry.registerGarden(garden1, sources);
    }

    function test_registerPool_revertsWithZeroPool() public {
        vm.prank(gardensModule);
        vm.expectRevert(UnifiedPowerRegistry.ZeroAddress.selector);
        registry.registerPool(address(0), garden1);
    }

    function test_registerPool_revertsWithZeroGarden() public {
        vm.prank(gardensModule);
        vm.expectRevert(UnifiedPowerRegistry.ZeroAddress.selector);
        registry.registerPool(pool1, address(0));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Multiple Gardens — State Isolation
    // ═══════════════════════════════════════════════════════════════════════════

    function test_multipleGardens_independentSources() public {
        NFTPowerSource[] memory sources1 = new NFTPowerSource[](1);
        sources1[0] =
            NFTPowerSource({ token: address(hats), nftType: NFTType.HAT, weight: 10_000, tokenId: 0, hatId: OPERATOR_HAT });

        NFTPowerSource[] memory sources2 = new NFTPowerSource[](1);
        sources2[0] =
            NFTPowerSource({ token: address(hats), nftType: NFTType.HAT, weight: 20_000, tokenId: 0, hatId: GARDENER_HAT });

        vm.startPrank(gardensModule);
        registry.registerGarden(garden1, sources1);
        registry.registerGarden(garden2, sources2);
        registry.registerPool(pool1, garden1);
        registry.registerPool(pool2, garden2);
        vm.stopPrank();

        // Verify independent configurations
        NFTPowerSource[] memory g1Sources = registry.getGardenSources(garden1);
        NFTPowerSource[] memory g2Sources = registry.getGardenSources(garden2);

        assertEq(g1Sources[0].weight, 10_000, "Garden1 weight");
        assertEq(g2Sources[0].weight, 20_000, "Garden2 weight");
        assertEq(g1Sources[0].hatId, OPERATOR_HAT, "Garden1 hatId");
        assertEq(g2Sources[0].hatId, GARDENER_HAT, "Garden2 hatId");

        // Verify power queries route correctly per pool
        hats.setWearer(alice, OPERATOR_HAT, true);
        hats.setWearer(alice, GARDENER_HAT, true);

        uint256 p1 = registry.getMemberPowerInStrategy(alice, pool1);
        uint256 p2 = registry.getMemberPowerInStrategy(alice, pool2);

        assertEq(p1, 1, "Alice power in garden1 pool (10000/10000=1)");
        assertEq(p2, 2, "Alice power in garden2 pool (20000/10000=2)");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ERC721 Sources
    // ═══════════════════════════════════════════════════════════════════════════

    function test_erc721_powerScalesWithBalance() public {
        MockERC721 badge = new MockERC721();

        NFTPowerSource[] memory sources = new NFTPowerSource[](1);
        sources[0] =
            NFTPowerSource({ token: address(badge), nftType: NFTType.ERC721, weight: 10_000, tokenId: 0, hatId: 0 });

        vm.startPrank(gardensModule);
        registry.registerGarden(garden1, sources);
        registry.registerPool(pool1, garden1);
        vm.stopPrank();

        // Mint 3 badges to alice
        badge.mint(alice);
        badge.mint(alice);
        badge.mint(alice);

        // Power = (3 * 10000) / 10000 = 3
        uint256 power = registry.getMemberPowerInStrategy(alice, pool1);
        assertEq(power, 3, "ERC721 power should scale with balance");
    }

    function test_erc721_nonHolderReturnsZero() public {
        MockERC721 badge = new MockERC721();

        NFTPowerSource[] memory sources = new NFTPowerSource[](1);
        sources[0] =
            NFTPowerSource({ token: address(badge), nftType: NFTType.ERC721, weight: 10_000, tokenId: 0, hatId: 0 });

        vm.startPrank(gardensModule);
        registry.registerGarden(garden1, sources);
        registry.registerPool(pool1, garden1);
        vm.stopPrank();

        uint256 power = registry.getMemberPowerInStrategy(bob, pool1);
        assertEq(power, 0, "Non-holder should have zero power");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ERC1155 Sources
    // ═══════════════════════════════════════════════════════════════════════════

    function test_erc1155_powerScalesWithBalance() public {
        MockERC1155 multiToken = new MockERC1155();
        uint256 tokenId = 42;

        NFTPowerSource[] memory sources = new NFTPowerSource[](1);
        sources[0] = NFTPowerSource({
            token: address(multiToken),
            nftType: NFTType.ERC1155,
            weight: 10_000,
            tokenId: tokenId,
            hatId: 0
        });

        vm.startPrank(gardensModule);
        registry.registerGarden(garden1, sources);
        registry.registerPool(pool1, garden1);
        vm.stopPrank();

        // Mint 5 tokens (id=42) to alice
        multiToken.mint(alice, tokenId, 5);

        // Power = (5 * 10000) / 10000 = 5
        uint256 power = registry.getMemberPowerInStrategy(alice, pool1);
        assertEq(power, 5, "ERC1155 power should scale with balance");
    }

    function test_erc1155_wrongTokenIdReturnsZero() public {
        MockERC1155 multiToken = new MockERC1155();

        NFTPowerSource[] memory sources = new NFTPowerSource[](1);
        sources[0] =
            NFTPowerSource({ token: address(multiToken), nftType: NFTType.ERC1155, weight: 10_000, tokenId: 42, hatId: 0 });

        vm.startPrank(gardensModule);
        registry.registerGarden(garden1, sources);
        registry.registerPool(pool1, garden1);
        vm.stopPrank();

        // Mint tokens with a DIFFERENT id (99, not 42)
        multiToken.mint(alice, 99, 10);

        uint256 power = registry.getMemberPowerInStrategy(alice, pool1);
        assertEq(power, 0, "Wrong tokenId should give zero power");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Mixed Sources (HAT + ERC721 + ERC1155)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_mixed_powerSumsCorrectly() public {
        MockERC721 badge = new MockERC721();
        MockERC1155 multiToken = new MockERC1155();
        uint256 erc1155TokenId = 7;

        NFTPowerSource[] memory sources = new NFTPowerSource[](3);
        // HAT source: weight 10000
        sources[0] =
            NFTPowerSource({ token: address(hats), nftType: NFTType.HAT, weight: 10_000, tokenId: 0, hatId: OPERATOR_HAT });
        // ERC721 source: weight 10000
        sources[1] =
            NFTPowerSource({ token: address(badge), nftType: NFTType.ERC721, weight: 10_000, tokenId: 0, hatId: 0 });
        // ERC1155 source: weight 20000
        sources[2] = NFTPowerSource({
            token: address(multiToken),
            nftType: NFTType.ERC1155,
            weight: 20_000,
            tokenId: erc1155TokenId,
            hatId: 0
        });

        vm.startPrank(gardensModule);
        registry.registerGarden(garden1, sources);
        registry.registerPool(pool1, garden1);
        vm.stopPrank();

        // Give alice all three power sources
        hats.setWearer(alice, OPERATOR_HAT, true); // HAT balance = 1
        badge.mint(alice); // ERC721 balance = 1
        badge.mint(alice); // ERC721 balance = 2
        multiToken.mint(alice, erc1155TokenId, 3); // ERC1155 balance = 3

        // Power = (1 * 10000/10000) + (2 * 10000/10000) + (3 * 20000/10000)
        //       = 1 + 2 + 6 = 9
        uint256 power = registry.getMemberPowerInStrategy(alice, pool1);
        assertEq(power, 9, "Mixed sources should sum correctly");
    }

    function test_mixed_partialOwnership() public {
        MockERC721 badge = new MockERC721();

        NFTPowerSource[] memory sources = new NFTPowerSource[](2);
        sources[0] =
            NFTPowerSource({ token: address(hats), nftType: NFTType.HAT, weight: 10_000, tokenId: 0, hatId: OPERATOR_HAT });
        sources[1] =
            NFTPowerSource({ token: address(badge), nftType: NFTType.ERC721, weight: 10_000, tokenId: 0, hatId: 0 });

        vm.startPrank(gardensModule);
        registry.registerGarden(garden1, sources);
        registry.registerPool(pool1, garden1);
        vm.stopPrank();

        // Alice has hat but no badge
        hats.setWearer(alice, OPERATOR_HAT, true);

        // Bob has badge but no hat
        badge.mint(bob);

        uint256 alicePower = registry.getMemberPowerInStrategy(alice, pool1);
        uint256 bobPower = registry.getMemberPowerInStrategy(bob, pool1);

        assertEq(alicePower, 1, "Alice should have power from HAT only");
        assertEq(bobPower, 1, "Bob should have power from ERC721 only");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // IVotingPowerRegistry Compatibility
    // ═══════════════════════════════════════════════════════════════════════════

    function test_ercAddress_returnsHatsProtocol() public {
        assertEq(registry.ercAddress(), address(hats), "ercAddress should return hatsProtocol");
    }

    function test_getMemberStakedAmount_alwaysZero() public {
        assertEq(registry.getMemberStakedAmount(alice), 0, "Staked amount should always be 0");
    }

    function test_isMember_returnsFalseWithoutPool() public {
        // isMember uses msg.sender as strategy; this test contract has no pool mapping
        assertFalse(registry.isMember(alice), "isMember should be false when caller has no pool mapping");
    }

    /// @notice isMember returns true when called by a registered pool and member has power
    function test_isMember_returnsTrueWhenCalledByRegisteredPool() public {
        vm.startPrank(gardensModule);
        registry.registerGarden(garden1, _buildSources());
        registry.registerPool(pool1, garden1);
        vm.stopPrank();

        // Alice wears the operator hat
        hats.setWearer(alice, OPERATOR_HAT, true);

        // Call isMember FROM pool1 (simulating CVStrategy calling the registry)
        vm.prank(pool1);
        assertTrue(registry.isMember(alice), "isMember should return true when pool calls for hat wearer");
    }

    /// @notice isMember returns false when called by a registered pool but member has no power
    function test_isMember_returnsFalseWhenMemberHasNoPower() public {
        vm.startPrank(gardensModule);
        registry.registerGarden(garden1, _buildSources());
        registry.registerPool(pool1, garden1);
        vm.stopPrank();

        // Bob wears no hats -- zero power
        vm.prank(pool1);
        assertFalse(registry.isMember(bob), "isMember should return false for non-wearer");
    }

    /// @notice isMember routes correctly per pool -- different gardens yield different results
    function test_isMember_routesCorrectlyPerPool() public {
        // Garden1: only OPERATOR_HAT source
        NFTPowerSource[] memory sources1 = new NFTPowerSource[](1);
        sources1[0] =
            NFTPowerSource({ token: address(hats), nftType: NFTType.HAT, weight: 10_000, tokenId: 0, hatId: OPERATOR_HAT });

        // Garden2: only GARDENER_HAT source
        NFTPowerSource[] memory sources2 = new NFTPowerSource[](1);
        sources2[0] =
            NFTPowerSource({ token: address(hats), nftType: NFTType.HAT, weight: 10_000, tokenId: 0, hatId: GARDENER_HAT });

        vm.startPrank(gardensModule);
        registry.registerGarden(garden1, sources1);
        registry.registerGarden(garden2, sources2);
        registry.registerPool(pool1, garden1);
        registry.registerPool(pool2, garden2);
        vm.stopPrank();

        // Alice only wears OPERATOR_HAT
        hats.setWearer(alice, OPERATOR_HAT, true);

        // pool1 (garden1 / operator hat) => true
        vm.prank(pool1);
        assertTrue(registry.isMember(alice), "Alice should be member via pool1 (operator hat)");

        // pool2 (garden2 / gardener hat) => false (Alice doesn't wear gardener hat)
        vm.prank(pool2);
        assertFalse(registry.isMember(alice), "Alice should NOT be member via pool2 (no gardener hat)");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // isMember — msg.sender Routing (C1 regression)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verifies isMember uses msg.sender (the calling pool) as the strategy for lookup.
    ///         CVStrategy calls registry.isMember(member), so msg.sender = pool address.
    ///         The pool address resolves to a garden via poolGarden mapping.
    function test_isMember_usesCallerAsStrategy() public {
        // Setup: two gardens with different hat requirements
        NFTPowerSource[] memory sources1 = new NFTPowerSource[](1);
        sources1[0] =
            NFTPowerSource({ token: address(hats), nftType: NFTType.HAT, weight: 10_000, tokenId: 0, hatId: OPERATOR_HAT });

        NFTPowerSource[] memory sources2 = new NFTPowerSource[](1);
        sources2[0] =
            NFTPowerSource({ token: address(hats), nftType: NFTType.HAT, weight: 10_000, tokenId: 0, hatId: GARDENER_HAT });

        vm.startPrank(gardensModule);
        registry.registerGarden(garden1, sources1);
        registry.registerGarden(garden2, sources2);
        registry.registerPool(pool1, garden1);
        registry.registerPool(pool2, garden2);
        vm.stopPrank();

        // Alice wears OPERATOR_HAT only
        hats.setWearer(alice, OPERATOR_HAT, true);

        // When pool1 (garden1/operator) calls, msg.sender=pool1 routes to garden1 => true
        vm.prank(pool1);
        bool fromPool1 = registry.isMember(alice);
        assertTrue(fromPool1, "msg.sender=pool1 should route to garden1 (operator hat) => true");

        // When pool2 (garden2/gardener) calls, msg.sender=pool2 routes to garden2 => false
        vm.prank(pool2);
        bool fromPool2 = registry.isMember(alice);
        assertFalse(fromPool2, "msg.sender=pool2 should route to garden2 (gardener hat) => false");

        // Direct call from test contract (no pool mapping) => false
        bool fromTest = registry.isMember(alice);
        assertFalse(fromTest, "msg.sender=test (no pool mapping) => false");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Admin Functions
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setGardensModule_onlyOwner() public {
        vm.prank(unauthorized);
        vm.expectRevert("Ownable: caller is not the owner");
        registry.setGardensModule(address(0x42));
    }

    function test_setGardensModule_updatesValue() public {
        address newModule = address(0x42);
        vm.prank(owner);
        registry.setGardensModule(newModule);
        assertEq(registry.gardensModule(), newModule, "gardensModule should be updated");
    }

    function test_setGardensModule_revertsWithZero() public {
        vm.prank(owner);
        vm.expectRevert(UnifiedPowerRegistry.ZeroAddress.selector);
        registry.setGardensModule(address(0));
    }

    function test_setHatsProtocol_onlyOwner() public {
        vm.prank(unauthorized);
        vm.expectRevert("Ownable: caller is not the owner");
        registry.setHatsProtocol(address(0x42));
    }

    function test_setHatsProtocol_updatesValue() public {
        address newHats = address(0x42);
        vm.prank(owner);
        registry.setHatsProtocol(newHats);
        assertEq(registry.hatsProtocol(), newHats, "hatsProtocol should be updated");
    }

    function test_setHatsProtocol_revertsWithZero() public {
        vm.prank(owner);
        vm.expectRevert(UnifiedPowerRegistry.ZeroAddress.selector);
        registry.setHatsProtocol(address(0));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UUPS Upgrade Authorization
    // ═══════════════════════════════════════════════════════════════════════════

    function test_upgrade_onlyOwner() public {
        UnifiedPowerRegistry newImpl = new UnifiedPowerRegistry();

        vm.prank(unauthorized);
        vm.expectRevert("Ownable: caller is not the owner");
        registry.upgradeTo(address(newImpl));
    }

    function test_upgrade_succeeds() public {
        // Register a garden before upgrade
        vm.prank(gardensModule);
        registry.registerGarden(garden1, _buildSources());

        // Upgrade
        UnifiedPowerRegistry newImpl = new UnifiedPowerRegistry();
        vm.prank(owner);
        registry.upgradeTo(address(newImpl));

        // Verify state preserved after upgrade
        assertTrue(registry.isGardenRegistered(garden1), "Garden should still be registered after upgrade");
        assertEq(registry.getGardenSourceCount(garden1), 3, "Sources should be preserved after upgrade");
        assertEq(registry.owner(), owner, "Owner should be preserved after upgrade");
        assertEq(registry.gardensModule(), gardensModule, "gardensModule should be preserved after upgrade");
        assertEq(registry.hatsProtocol(), address(hats), "hatsProtocol should be preserved after upgrade");
    }

    function test_upgrade_cannotReinitialize() public {
        UnifiedPowerRegistry newImpl = new UnifiedPowerRegistry();
        vm.prank(owner);
        registry.upgradeTo(address(newImpl));

        vm.prank(owner);
        vm.expectRevert("Initializable: contract is already initialized");
        registry.initialize(address(0x789), address(0), address(0));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // isGardenRegistered
    // ═══════════════════════════════════════════════════════════════════════════

    function test_isGardenRegistered_falseForUnregistered() public {
        assertFalse(registry.isGardenRegistered(address(0x999)), "Unregistered garden should return false");
    }

    function test_isGardenRegistered_trueAfterRegistration() public {
        vm.prank(gardensModule);
        registry.registerGarden(garden1, _buildSources());

        assertTrue(registry.isGardenRegistered(garden1), "Registered garden should return true");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Build 3-source array mimicking GardensModule._registerGardenPower() with Linear scheme
    function _buildSources() internal view returns (NFTPowerSource[] memory sources) {
        sources = new NFTPowerSource[](3);
        sources[0] = NFTPowerSource({
            token: address(hats),
            nftType: NFTType.HAT,
            weight: OPERATOR_WEIGHT,
            tokenId: 0,
            hatId: OPERATOR_HAT
        });
        sources[1] = NFTPowerSource({
            token: address(hats),
            nftType: NFTType.HAT,
            weight: GARDENER_WEIGHT,
            tokenId: 0,
            hatId: GARDENER_HAT
        });
        sources[2] = NFTPowerSource({
            token: address(hats),
            nftType: NFTType.HAT,
            weight: COMMUNITY_WEIGHT,
            tokenId: 0,
            hatId: COMMUNITY_HAT
        });
    }
}
