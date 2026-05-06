// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase } from "./helpers/ForkTestBase.sol";
import { GardenToken } from "../../src/tokens/Garden.sol";
import { GardenAccount } from "../../src/accounts/Garden.sol";
import { IGardensModule } from "../../src/interfaces/IGardensModule.sol";

/// @title SepoliaGardenTokenForkTest
/// @notice Fork tests for GardenToken against Sepolia testnet.
/// @dev Verifies the production deployment path against Sepolia EAS and Hats Protocol.
contract SepoliaGardenTokenForkTest is ForkTestBase {
    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Mint Garden — Module Callback Ordering
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verifies module callbacks fire during mintGarden on Sepolia fork.
    function test_fork_mintGarden_callbackOrdering() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();

        // Verify modules are wired
        assertTrue(address(gardenToken.hatsModule()) != address(0), "hatsModule should be wired");
        assertTrue(address(gardenToken.actionRegistry()) != address(0), "actionRegistry should be wired");

        // Mint a garden with all domains enabled
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            name: "Sepolia Callback Garden",
            slug: "",
            description: "Tests callback ordering on Sepolia",
            location: "Sepolia Fork",
            bannerImage: "ipfs://QmSepoliaCallback",
            metadata: "ipfs://QmMeta",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0x0F,
            gardeners: new address[](0),
            operators: new address[](0)
        });

        address garden = gardenToken.mintGarden(config);
        assertTrue(garden != address(0), "garden TBA should be created");

        // Verify HatsModule callback: hat tree was created + owner role granted
        (,,,,,,, bool configured) = hatsModule.getGardenHatIds(garden);
        assertTrue(configured, "hat tree should be configured (hatsModule callback fired)");
        assertTrue(hatsModule.isOwnerOf(garden, address(this)), "minter should have owner role");

        // Verify GardenAccount was initialized (last callback in the chain)
        GardenAccount gardenAcct = GardenAccount(payable(garden));
        assertEq(keccak256(bytes(gardenAcct.name())), keccak256(bytes("Sepolia Callback Garden")), "name not set");

        // Verify domain mask was set on ActionRegistry
        uint8 domains = actionRegistry.gardenDomains(garden);
        assertEq(domains, 0x0F, "domain mask should be set on ActionRegistry");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Mint Garden Increments Token ID — Sequential Mints, Unique TBAs
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Sequential mints on Sepolia produce incrementing token IDs and unique TBAs.
    function test_fork_mintGarden_incrementsTokenId() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();

        // Mint 3 gardens sequentially
        address garden0 = _mintTestGarden("Sepolia Garden Zero", 0x01);
        address garden1 = _mintTestGarden("Sepolia Garden One", 0x02);
        address garden2 = _mintTestGarden("Sepolia Garden Two", 0x04);

        // Verify unique TBA addresses
        assertTrue(garden0 != garden1, "gardens 0 and 1 should have different TBAs");
        assertTrue(garden1 != garden2, "gardens 1 and 2 should have different TBAs");
        assertTrue(garden0 != garden2, "gardens 0 and 2 should have different TBAs");

        // Verify sequential ownership (token IDs 0, 1, 2)
        assertEq(gardenToken.ownerOf(0), address(this), "token 0 should belong to minter");
        assertEq(gardenToken.ownerOf(1), address(this), "token 1 should belong to minter");
        assertEq(gardenToken.ownerOf(2), address(this), "token 2 should belong to minter");

        // Verify each garden has distinct metadata
        assertEq(
            keccak256(bytes(GardenAccount(payable(garden0)).name())),
            keccak256(bytes("Sepolia Garden Zero")),
            "garden 0 name mismatch"
        );
        assertEq(
            keccak256(bytes(GardenAccount(payable(garden1)).name())),
            keccak256(bytes("Sepolia Garden One")),
            "garden 1 name mismatch"
        );
        assertEq(
            keccak256(bytes(GardenAccount(payable(garden2)).name())),
            keccak256(bytes("Sepolia Garden Two")),
            "garden 2 name mismatch"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: ENS Slug Registration Uses Real Sepolia Relay
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Minting with a slug uses the Sepolia local relay path without stubbing ccipSend.
    function test_fork_mintGarden_withSlugCachesEnsOwnership() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();

        string memory slug = "sepolia-garden-token";
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            name: "Sepolia ENS Garden",
            slug: slug,
            description: "Tests ENS sender cache on Sepolia",
            location: "Sepolia Fork",
            bannerImage: "",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0x01,
            gardeners: new address[](0),
            operators: new address[](0)
        });

        address garden = gardenToken.mintGarden(config);
        bytes32 slugHash = keccak256(bytes(slug));

        assertTrue(garden != address(0), "garden should be created");
        assertEq(greenGoodsENS.slugOwner(slugHash), garden, "slug should be cached to garden");
        assertFalse(greenGoodsENS.available(slug), "slug should no longer be available");
    }
}
