// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";

import { NFTPowerRegistry } from "../../src/vendor/gardens/NFTPowerRegistry.sol";
import { NFTPowerRegistryFactory } from "../../src/vendor/gardens/NFTPowerRegistryFactory.sol";
import { NFTPowerSource, NFTType } from "../../src/interfaces/IGardensV2.sol";

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

/// @title MockHatsProtocol
/// @notice Minimal mock for testing NFTPowerRegistry's Hats Protocol integration
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
/// @notice Mintable ERC721 for testing NFTPowerRegistry with ERC721 sources
contract MockERC721 is ERC721 {
    uint256 private _nextTokenId;

    constructor() ERC721("MockBadge", "BADGE") { }

    function mint(address to) external returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _mint(to, tokenId);
    }
}

/// @title MockERC1155
/// @notice Mintable ERC1155 for testing NFTPowerRegistry with ERC1155 sources
contract MockERC1155 is ERC1155 {
    constructor() ERC1155("") { }

    function mint(address to, uint256 id, uint256 amount) external {
        _mint(to, id, amount, "");
    }
}

/// @title NFTPowerRegistryFactoryTest
/// @notice Tests for the production NFTPowerRegistryFactory
contract NFTPowerRegistryFactoryTest is Test {
    NFTPowerRegistryFactory public factory;
    MockHatsProtocol public hats;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    // Hat IDs (arbitrary non-zero values)
    uint256 public constant OPERATOR_HAT = 0x0001000100010001000000000000000000000000000000000000000000000000;
    uint256 public constant GARDENER_HAT = 0x0001000100010002000000000000000000000000000000000000000000000000;
    uint256 public constant COMMUNITY_HAT = 0x0001000100010003000000000000000000000000000000000000000000000000;

    // Weights (basis points — Green Goods Linear scheme)
    uint256 public constant OPERATOR_WEIGHT = 300;
    uint256 public constant GARDENER_WEIGHT = 200;
    uint256 public constant COMMUNITY_WEIGHT = 100;

    function setUp() public {
        factory = new NFTPowerRegistryFactory();
        hats = new MockHatsProtocol();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Factory deploys real registries
    // ═══════════════════════════════════════════════════════════════════════════

    function test_deploy_createsRegistry() public {
        NFTPowerSource[] memory sources = _buildSources();
        address registry = factory.deploy(sources);

        assertTrue(registry != address(0), "Registry should be deployed");
        assertTrue(registry.code.length > 0, "Registry should have code");
    }

    function test_deploy_setsCorrectSourceCount() public {
        NFTPowerSource[] memory sources = _buildSources();
        address registry = factory.deploy(sources);

        NFTPowerRegistry reg = NFTPowerRegistry(registry);
        assertEq(reg.powerSourceCount(), 3, "Should have 3 power sources");
    }

    function test_deploy_setsHatsProtocol() public {
        NFTPowerSource[] memory sources = _buildSources();
        address registry = factory.deploy(sources);

        NFTPowerRegistry reg = NFTPowerRegistry(registry);
        assertEq(reg.hatsProtocol(), address(hats), "hatsProtocol should match");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Struct pass-through: GG 5-field → vendor 5-field
    // ═══════════════════════════════════════════════════════════════════════════

    function test_deploy_bridgesStructCorrectly() public {
        NFTPowerSource[] memory sources = _buildSources();
        address registry = factory.deploy(sources);

        NFTPowerRegistry reg = NFTPowerRegistry(registry);

        // Verify each source was passed through correctly
        for (uint256 i = 0; i < 3; i++) {
            (address token, NFTPowerRegistry.NFTType nftType, uint256 weight, uint256 tokenId, uint256 hatId) =
                reg.powerSources(i);

            // token = hatsProtocol address (for HAT type, token is the hats contract)
            assertEq(token, address(hats), "token should be hatsProtocol");
            // nftType = HAT
            assertEq(uint256(nftType), uint256(NFTPowerRegistry.NFTType.HAT), "nftType should be HAT");
            // tokenId = 0 (unused for HAT)
            assertEq(tokenId, 0, "tokenId should be 0 for HAT");
            // hatId and weight match the source
            assertEq(hatId, sources[i].hatId, "hatId should match source");
            assertEq(weight, sources[i].weight, "weight should match source");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // isMember integration
    // ═══════════════════════════════════════════════════════════════════════════

    function test_isMember_returnsTrueForHatWearer() public {
        // Use weight >= 10000 so (1 * weight) / 10000 > 0 for isMember check
        NFTPowerSource[] memory sources = new NFTPowerSource[](1);
        sources[0] =
            NFTPowerSource({ token: address(hats), nftType: NFTType.HAT, weight: 10_000, tokenId: 0, hatId: COMMUNITY_HAT });

        address registry = factory.deploy(sources);

        // Alice wears the community hat
        hats.setWearer(alice, COMMUNITY_HAT, true);

        NFTPowerRegistry reg = NFTPowerRegistry(registry);
        assertTrue(reg.isMember(alice), "Hat wearer should be a member");
    }

    function test_isMember_returnsFalseForNonWearer() public {
        NFTPowerSource[] memory sources = _buildSources();
        address registry = factory.deploy(sources);

        NFTPowerRegistry reg = NFTPowerRegistry(registry);
        assertFalse(reg.isMember(bob), "Non-wearer should not be a member");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // getMemberPowerInStrategy (weighted power)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_getMemberPower_singleHat() public {
        NFTPowerSource[] memory sources = _buildSources();
        address registry = factory.deploy(sources);
        NFTPowerRegistry reg = NFTPowerRegistry(registry);

        // Alice wears only the gardener hat (weight=200)
        hats.setWearer(alice, GARDENER_HAT, true);

        // Power = (1 * 200) / 10000 = 0 (integer division, weight < 10000)
        uint256 power = reg.getMemberPowerInStrategy(alice, address(0));
        assertEq(power, 0, "Single hat with weight=200 gives 0 after /10000");
    }

    function test_getMemberPower_operatorWeightProducesNonZero() public {
        NFTPowerSource[] memory sources = new NFTPowerSource[](1);
        sources[0] =
            NFTPowerSource({ token: address(hats), nftType: NFTType.HAT, weight: 10_000, tokenId: 0, hatId: OPERATOR_HAT });

        address registry = factory.deploy(sources);
        NFTPowerRegistry reg = NFTPowerRegistry(registry);

        hats.setWearer(alice, OPERATOR_HAT, true);

        // Power = (1 * 10000) / 10000 = 1
        uint256 power = reg.getMemberPowerInStrategy(alice, address(0));
        assertEq(power, 1, "Weight=10000 with 1 hat should give power=1");
    }

    function test_getMemberPower_multipleHats() public {
        NFTPowerSource[] memory sources = new NFTPowerSource[](2);
        sources[0] =
            NFTPowerSource({ token: address(hats), nftType: NFTType.HAT, weight: 30_000, tokenId: 0, hatId: OPERATOR_HAT });
        sources[1] =
            NFTPowerSource({ token: address(hats), nftType: NFTType.HAT, weight: 20_000, tokenId: 0, hatId: GARDENER_HAT });

        address registry = factory.deploy(sources);
        NFTPowerRegistry reg = NFTPowerRegistry(registry);

        // Alice wears both hats
        hats.setWearer(alice, OPERATOR_HAT, true);
        hats.setWearer(alice, GARDENER_HAT, true);

        // Power = (1 * 30000 / 10000) + (1 * 20000 / 10000) = 3 + 2 = 5
        uint256 power = reg.getMemberPowerInStrategy(alice, address(0));
        assertEq(power, 5, "Multiple hats should sum weighted power");
    }

    function test_getMemberPower_noHatsReturnsZero() public {
        NFTPowerSource[] memory sources = _buildSources();
        address registry = factory.deploy(sources);
        NFTPowerRegistry reg = NFTPowerRegistry(registry);

        uint256 power = reg.getMemberPowerInStrategy(bob, address(0));
        assertEq(power, 0, "Non-wearer should have zero power");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Edge cases
    // ═══════════════════════════════════════════════════════════════════════════

    function test_deploy_singleSource() public {
        NFTPowerSource[] memory sources = new NFTPowerSource[](1);
        sources[0] =
            NFTPowerSource({ token: address(hats), nftType: NFTType.HAT, weight: 10_000, tokenId: 0, hatId: OPERATOR_HAT });

        address registry = factory.deploy(sources);
        NFTPowerRegistry reg = NFTPowerRegistry(registry);

        assertEq(reg.powerSourceCount(), 1, "Should have 1 source");
        assertEq(reg.hatsProtocol(), address(hats), "hatsProtocol should match");
    }

    function test_deploy_multipleRegistries_areIndependent() public {
        NFTPowerSource[] memory sources1 = new NFTPowerSource[](1);
        sources1[0] =
            NFTPowerSource({ token: address(hats), nftType: NFTType.HAT, weight: 10_000, tokenId: 0, hatId: OPERATOR_HAT });

        NFTPowerSource[] memory sources2 = new NFTPowerSource[](1);
        sources2[0] =
            NFTPowerSource({ token: address(hats), nftType: NFTType.HAT, weight: 20_000, tokenId: 0, hatId: GARDENER_HAT });

        address registry1 = factory.deploy(sources1);
        address registry2 = factory.deploy(sources2);

        assertTrue(registry1 != registry2, "Registries should be different addresses");

        // Verify independent configurations
        (,, uint256 w1,, uint256 h1) = NFTPowerRegistry(registry1).powerSources(0);
        (,, uint256 w2,, uint256 h2) = NFTPowerRegistry(registry2).powerSources(0);

        assertEq(w1, 10_000, "Registry 1 weight");
        assertEq(w2, 20_000, "Registry 2 weight");
        assertEq(h1, OPERATOR_HAT, "Registry 1 hatId");
        assertEq(h2, GARDENER_HAT, "Registry 2 hatId");
    }

    function test_ercAddress_returnsHatsProtocol() public {
        NFTPowerSource[] memory sources = _buildSources();
        address registry = factory.deploy(sources);

        // For HAT type, token = hatsProtocol, so ercAddress() returns hatsProtocol
        assertEq(NFTPowerRegistry(registry).ercAddress(), address(hats));
    }

    function test_getMemberStakedAmount_alwaysZero() public {
        NFTPowerSource[] memory sources = _buildSources();
        address registry = factory.deploy(sources);

        assertEq(NFTPowerRegistry(registry).getMemberStakedAmount(alice), 0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ERC721 sources
    // ═══════════════════════════════════════════════════════════════════════════

    function test_erc721_deploy() public {
        MockERC721 badge = new MockERC721();

        NFTPowerSource[] memory sources = new NFTPowerSource[](1);
        sources[0] =
            NFTPowerSource({ token: address(badge), nftType: NFTType.ERC721, weight: 10_000, tokenId: 0, hatId: 0 });

        address registry = factory.deploy(sources);
        NFTPowerRegistry reg = NFTPowerRegistry(registry);

        assertEq(reg.powerSourceCount(), 1, "Should have 1 source");
        // No HAT sources → hatsProtocol should be address(0)
        assertEq(reg.hatsProtocol(), address(0), "hatsProtocol should be zero with no HAT sources");
    }

    function test_erc721_powerScalesWithBalance() public {
        MockERC721 badge = new MockERC721();

        NFTPowerSource[] memory sources = new NFTPowerSource[](1);
        sources[0] =
            NFTPowerSource({ token: address(badge), nftType: NFTType.ERC721, weight: 10_000, tokenId: 0, hatId: 0 });

        address registry = factory.deploy(sources);
        NFTPowerRegistry reg = NFTPowerRegistry(registry);

        // Mint 3 badges to alice
        badge.mint(alice);
        badge.mint(alice);
        badge.mint(alice);

        // Power = (3 * 10000) / 10000 = 3
        uint256 power = reg.getMemberPowerInStrategy(alice, address(0));
        assertEq(power, 3, "ERC721 power should scale with balance");
    }

    function test_erc721_nonHolderReturnsZero() public {
        MockERC721 badge = new MockERC721();

        NFTPowerSource[] memory sources = new NFTPowerSource[](1);
        sources[0] =
            NFTPowerSource({ token: address(badge), nftType: NFTType.ERC721, weight: 10_000, tokenId: 0, hatId: 0 });

        address registry = factory.deploy(sources);
        NFTPowerRegistry reg = NFTPowerRegistry(registry);

        uint256 power = reg.getMemberPowerInStrategy(bob, address(0));
        assertEq(power, 0, "Non-holder should have zero power");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ERC1155 sources
    // ═══════════════════════════════════════════════════════════════════════════

    function test_erc1155_deploy() public {
        MockERC1155 multiToken = new MockERC1155();

        NFTPowerSource[] memory sources = new NFTPowerSource[](1);
        sources[0] =
            NFTPowerSource({ token: address(multiToken), nftType: NFTType.ERC1155, weight: 10_000, tokenId: 42, hatId: 0 });

        address registry = factory.deploy(sources);
        NFTPowerRegistry reg = NFTPowerRegistry(registry);

        assertEq(reg.powerSourceCount(), 1, "Should have 1 source");
        assertEq(reg.hatsProtocol(), address(0), "hatsProtocol should be zero with no HAT sources");
    }

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

        address registry = factory.deploy(sources);
        NFTPowerRegistry reg = NFTPowerRegistry(registry);

        // Mint 5 tokens (id=42) to alice
        multiToken.mint(alice, tokenId, 5);

        // Power = (5 * 10000) / 10000 = 5
        uint256 power = reg.getMemberPowerInStrategy(alice, address(0));
        assertEq(power, 5, "ERC1155 power should scale with balance");
    }

    function test_erc1155_wrongTokenIdReturnsZero() public {
        MockERC1155 multiToken = new MockERC1155();

        NFTPowerSource[] memory sources = new NFTPowerSource[](1);
        sources[0] =
            NFTPowerSource({ token: address(multiToken), nftType: NFTType.ERC1155, weight: 10_000, tokenId: 42, hatId: 0 });

        address registry = factory.deploy(sources);
        NFTPowerRegistry reg = NFTPowerRegistry(registry);

        // Mint tokens with a DIFFERENT id (99, not 42)
        multiToken.mint(alice, 99, 10);

        uint256 power = reg.getMemberPowerInStrategy(alice, address(0));
        assertEq(power, 0, "Wrong tokenId should give zero power");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Mixed sources (HAT + ERC721 + ERC1155)
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

        address registry = factory.deploy(sources);
        NFTPowerRegistry reg = NFTPowerRegistry(registry);

        // Give alice all three power sources
        hats.setWearer(alice, OPERATOR_HAT, true); // HAT balance = 1
        badge.mint(alice); // ERC721 balance = 1
        badge.mint(alice); // ERC721 balance = 2
        multiToken.mint(alice, erc1155TokenId, 3); // ERC1155 balance = 3

        // Power = (1 * 10000/10000) + (2 * 10000/10000) + (3 * 20000/10000)
        //       = 1 + 2 + 6 = 9
        uint256 power = reg.getMemberPowerInStrategy(alice, address(0));
        assertEq(power, 9, "Mixed sources should sum correctly");
    }

    function test_mixed_hatsProtocolExtractedFromHatSource() public {
        MockERC721 badge = new MockERC721();

        NFTPowerSource[] memory sources = new NFTPowerSource[](2);
        // ERC721 first (no HAT)
        sources[0] =
            NFTPowerSource({ token: address(badge), nftType: NFTType.ERC721, weight: 10_000, tokenId: 0, hatId: 0 });
        // HAT second
        sources[1] =
            NFTPowerSource({ token: address(hats), nftType: NFTType.HAT, weight: 10_000, tokenId: 0, hatId: OPERATOR_HAT });

        address registry = factory.deploy(sources);
        NFTPowerRegistry reg = NFTPowerRegistry(registry);

        // hatsProtocol should be derived from the HAT source (index 1)
        assertEq(reg.hatsProtocol(), address(hats), "hatsProtocol should be extracted from HAT source");
    }

    function test_mixed_partialOwnership() public {
        MockERC721 badge = new MockERC721();

        NFTPowerSource[] memory sources = new NFTPowerSource[](2);
        sources[0] =
            NFTPowerSource({ token: address(hats), nftType: NFTType.HAT, weight: 10_000, tokenId: 0, hatId: OPERATOR_HAT });
        sources[1] =
            NFTPowerSource({ token: address(badge), nftType: NFTType.ERC721, weight: 10_000, tokenId: 0, hatId: 0 });

        address registry = factory.deploy(sources);
        NFTPowerRegistry reg = NFTPowerRegistry(registry);

        // Alice has hat but no badge
        hats.setWearer(alice, OPERATOR_HAT, true);

        // Bob has badge but no hat
        badge.mint(bob);

        uint256 alicePower = reg.getMemberPowerInStrategy(alice, address(0));
        uint256 bobPower = reg.getMemberPowerInStrategy(bob, address(0));

        assertEq(alicePower, 1, "Alice should have power from HAT only");
        assertEq(bobPower, 1, "Bob should have power from ERC721 only");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Build 3-source array mimicking GardensModule._deployPowerRegistry() with Linear scheme
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
