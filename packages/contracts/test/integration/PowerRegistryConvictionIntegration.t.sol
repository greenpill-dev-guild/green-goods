// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

import { UnifiedPowerRegistry } from "../../src/registries/Power.sol";
import { NFTPowerSource, NFTType } from "../../src/interfaces/IGardensV2.sol";

/// @title MockERC721 — Mintable ERC721 for power source tests
contract MockPowerERC721 is ERC721 {
    uint256 private _nextId = 1;

    constructor() ERC721("Power NFT", "PNFT") { }

    function mint(address to) external returns (uint256 tokenId) {
        tokenId = _nextId++;
        _mint(to, tokenId);
    }
}

/// @title MockERC1155 — Mintable ERC1155 for power source tests
contract MockPowerERC1155 is ERC1155 {
    constructor() ERC1155("") { }

    function mint(address to, uint256 id, uint256 amount) external {
        _mint(to, id, amount, "");
    }
}

/// @title MockHatsForPower — Minimal Hats mock for HAT power source type
contract MockHatsForPower {
    mapping(address account => mapping(uint256 hatId => bool)) public wearers;

    function setWearer(address account, uint256 hatId, bool isWearer) external {
        wearers[account][hatId] = isWearer;
    }

    function isWearerOfHat(address _user, uint256 _hatId) external view returns (bool) {
        return wearers[_user][_hatId];
    }
}

/// @title PowerRegistryConvictionIntegrationTest
/// @notice Integration tests for UnifiedPowerRegistry + CVStrategy power queries.
///         Verifies strategy→registry power resolution, role grant/revoke effects,
///         multi-garden isolation, and weight scheme differences.
/// @dev Uses mocks only — NO fork required.
contract PowerRegistryConvictionIntegrationTest is Test {
    // ═══════════════════════════════════════════════════════════════════════════
    // State
    // ═══════════════════════════════════════════════════════════════════════════

    UnifiedPowerRegistry internal registry;
    MockPowerERC721 internal nft721;
    MockPowerERC1155 internal nft1155;
    MockHatsForPower internal hats;

    address internal constant OWNER = address(0xA1);
    address internal constant GARDENS_MODULE = address(0xA2);
    address internal constant GARDEN_A = address(0xB1);
    address internal constant GARDEN_B = address(0xB2);
    address internal constant POOL_A = address(0xC1);
    address internal constant POOL_B = address(0xC2);
    address internal constant USER_1 = address(0xD1);
    address internal constant USER_2 = address(0xD2);

    uint256 internal constant HAT_ID_GARDENER = 42;
    uint256 internal constant ERC1155_TOKEN_ID = 7;

    function setUp() public {
        // Deploy mock NFTs and Hats
        nft721 = new MockPowerERC721();
        nft1155 = new MockPowerERC1155();
        hats = new MockHatsForPower();

        // Deploy UnifiedPowerRegistry via proxy
        UnifiedPowerRegistry impl = new UnifiedPowerRegistry();
        bytes memory initData = abi.encodeWithSelector(
            UnifiedPowerRegistry.initialize.selector,
            OWNER,
            address(hats),
            GARDENS_MODULE
        );
        registry = UnifiedPowerRegistry(address(new ERC1967Proxy(address(impl), initData)));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Helper: Register garden with ERC721 + HAT sources
    // ═══════════════════════════════════════════════════════════════════════════

    function _registerGardenA() internal {
        NFTPowerSource[] memory sources = new NFTPowerSource[](2);

        // Source 1: ERC721 NFT with 1x weight (10000 bps)
        sources[0] = NFTPowerSource({
            token: address(nft721),
            nftType: NFTType.ERC721,
            weight: 10_000,
            tokenId: 0,
            hatId: 0
        });

        // Source 2: HAT with 2x weight (20000 bps)
        sources[1] = NFTPowerSource({
            token: address(hats),
            nftType: NFTType.HAT,
            weight: 20_000,
            tokenId: 0,
            hatId: HAT_ID_GARDENER
        });

        vm.prank(GARDENS_MODULE);
        registry.registerGarden(GARDEN_A, sources);

        vm.prank(GARDENS_MODULE);
        registry.registerPool(POOL_A, GARDEN_A);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Strategy queries power from registry
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice CVStrategy power query returns weighted sum of all sources
    function test_strategyQueriesPowerFromRegistry() public {
        _registerGardenA();

        // Give USER_1: 2 ERC721 NFTs + gardener hat
        nft721.mint(USER_1);
        nft721.mint(USER_1);
        hats.setWearer(USER_1, HAT_ID_GARDENER, true);

        // Power = (2 NFTs * 10000 / 10000) + (1 hat * 20000 / 10000) = 2 + 2 = 4
        uint256 power = registry.getMemberPowerInStrategy(USER_1, POOL_A);
        assertEq(power, 4, "Power should be 2 (ERC721) + 2 (HAT)");

        // USER_2 has no NFTs or hat
        uint256 power2 = registry.getMemberPowerInStrategy(USER_2, POOL_A);
        assertEq(power2, 0, "Power should be 0 for user with no tokens");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Role grant updates power weight
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Granting a hat increases the member's power
    function test_roleGrantUpdatesPowerWeight() public {
        _registerGardenA();

        // Before: USER_1 has no hat
        uint256 powerBefore = registry.getMemberPowerInStrategy(USER_1, POOL_A);
        assertEq(powerBefore, 0, "Power should be 0 before hat grant");

        // Grant hat
        hats.setWearer(USER_1, HAT_ID_GARDENER, true);

        // After: HAT contributes weight 20000 → power = 1 * 20000 / 10000 = 2
        uint256 powerAfter = registry.getMemberPowerInStrategy(USER_1, POOL_A);
        assertEq(powerAfter, 2, "Power should be 2 after hat grant (20000 bps weight)");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Role revoke removes power
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Revoking a hat zeroes the HAT-sourced power contribution
    function test_roleRevokeRemovesPower() public {
        _registerGardenA();

        // Grant hat and an NFT
        hats.setWearer(USER_1, HAT_ID_GARDENER, true);
        nft721.mint(USER_1);

        // Before revoke: power = 1 (ERC721) + 2 (HAT) = 3
        uint256 powerBefore = registry.getMemberPowerInStrategy(USER_1, POOL_A);
        assertEq(powerBefore, 3, "Power before revoke should be 3");

        // Revoke hat
        hats.setWearer(USER_1, HAT_ID_GARDENER, false);

        // After revoke: power = 1 (ERC721 remains) + 0 (HAT revoked) = 1
        uint256 powerAfter = registry.getMemberPowerInStrategy(USER_1, POOL_A);
        assertEq(powerAfter, 1, "Power after hat revoke should be 1");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Multi-garden power isolation
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Garden A power does not affect garden B
    function test_multiGardenPowerIsolation() public {
        _registerGardenA();

        // Register garden B with ERC1155 only
        NFTPowerSource[] memory sourcesB = new NFTPowerSource[](1);
        sourcesB[0] = NFTPowerSource({
            token: address(nft1155),
            nftType: NFTType.ERC1155,
            weight: 5_000,
            tokenId: ERC1155_TOKEN_ID,
            hatId: 0
        });

        vm.prank(GARDENS_MODULE);
        registry.registerGarden(GARDEN_B, sourcesB);

        vm.prank(GARDENS_MODULE);
        registry.registerPool(POOL_B, GARDEN_B);

        // Give USER_1 ERC721 (garden A source) and ERC1155 (garden B source)
        nft721.mint(USER_1);
        nft1155.mint(USER_1, ERC1155_TOKEN_ID, 10);

        // Garden A power: 1 ERC721 * 10000/10000 = 1 (ERC1155 not in garden A sources)
        uint256 powerA = registry.getMemberPowerInStrategy(USER_1, POOL_A);
        assertEq(powerA, 1, "Garden A power should be 1 (ERC721 only)");

        // Garden B power: 10 ERC1155 * 5000/10000 = 5 (ERC721 not in garden B sources)
        uint256 powerB = registry.getMemberPowerInStrategy(USER_1, POOL_B);
        assertEq(powerB, 5, "Garden B power should be 5 (ERC1155 only)");

        // Unknown pool returns 0
        uint256 powerUnknown = registry.getMemberPowerInStrategy(USER_1, address(0xDEAD));
        assertEq(powerUnknown, 0, "Unknown pool should return 0");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 5: Weight scheme affects power calculation
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Different weight values (Linear vs Exponential vs Power) produce different powers
    /// @dev We simulate "weight schemes" by registering gardens with different basis-point weights.
    ///      Linear=10000 (1x), Exponential=30000 (3x), Power=50000 (5x).
    function test_weightSchemeAffectsPowerCalculation() public {
        // Register 3 gardens with different weights on the same ERC721 source
        address gardenLinear = address(0xE1);
        address gardenExpo = address(0xE2);
        address gardenPower = address(0xE3);
        address poolLinear = address(0xF1);
        address poolExpo = address(0xF2);
        address poolPower = address(0xF3);

        // Linear: 1x weight
        NFTPowerSource[] memory linearSources = new NFTPowerSource[](1);
        linearSources[0] = NFTPowerSource({
            token: address(nft721),
            nftType: NFTType.ERC721,
            weight: 10_000,
            tokenId: 0,
            hatId: 0
        });

        // Exponential: 3x weight
        NFTPowerSource[] memory expoSources = new NFTPowerSource[](1);
        expoSources[0] = NFTPowerSource({
            token: address(nft721),
            nftType: NFTType.ERC721,
            weight: 30_000,
            tokenId: 0,
            hatId: 0
        });

        // Power: 5x weight
        NFTPowerSource[] memory powerSources = new NFTPowerSource[](1);
        powerSources[0] = NFTPowerSource({
            token: address(nft721),
            nftType: NFTType.ERC721,
            weight: 50_000,
            tokenId: 0,
            hatId: 0
        });

        vm.startPrank(GARDENS_MODULE);
        registry.registerGarden(gardenLinear, linearSources);
        registry.registerPool(poolLinear, gardenLinear);
        registry.registerGarden(gardenExpo, expoSources);
        registry.registerPool(poolExpo, gardenExpo);
        registry.registerGarden(gardenPower, powerSources);
        registry.registerPool(poolPower, gardenPower);
        vm.stopPrank();

        // Give USER_1 exactly 2 NFTs
        nft721.mint(USER_1);
        nft721.mint(USER_1);

        // Linear: 2 * 10000/10000 = 2
        assertEq(registry.getMemberPowerInStrategy(USER_1, poolLinear), 2, "Linear: 2 NFTs * 1x = 2");

        // Exponential: 2 * 30000/10000 = 6
        assertEq(registry.getMemberPowerInStrategy(USER_1, poolExpo), 6, "Expo: 2 NFTs * 3x = 6");

        // Power: 2 * 50000/10000 = 10
        assertEq(registry.getMemberPowerInStrategy(USER_1, poolPower), 10, "Power: 2 NFTs * 5x = 10");
    }
}
