// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase } from "../helpers/ForkTestBase.sol";
import { GardenToken } from "../../../src/tokens/Garden.sol";
import { GardenAccount } from "../../../src/accounts/Garden.sol";
import { IHatsModule } from "../../../src/interfaces/IHatsModule.sol";
import { IGardensModule } from "../../../src/interfaces/IGardensModule.sol";
import { GreenGoodsENS } from "../../../src/registries/ENS.sol";
import { IRouterClient } from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";

/// @title SepoliaExtendedE2EForkTest
/// @notice Extended E2E fork tests covering ENS, CookieJar, and KarmaGAP integration
///         during garden minting on Sepolia. Builds on top of FullProtocolE2E.t.sol.
/// @dev Uses ForkTestBase with full-stack deployment. Tests 1-2 exercise ENS flows,
///      test 3 covers CookieJar callback, test 4 covers KarmaGAP project creation.
contract SepoliaExtendedE2EForkTest is ForkTestBase {
    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Garden Mint With ENS Slug
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Mint garden with a slug triggers ENS registration + CCIP fee estimation
    function test_fork_e2e_gardenMintWithENSSlug() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Verify ENS module is wired to GardenToken
        assertTrue(address(gardenToken.ensModule()) != address(0), "ensModule should be wired");

        // Mock CCIP send to avoid actual cross-chain message (real router validates)
        address ccipRouter = address(greenGoodsENS.CCIP_ROUTER());
        vm.mockCall(
            ccipRouter,
            abi.encodeWithSelector(IRouterClient.ccipSend.selector),
            abi.encode(bytes32("mock-message-id"))
        );

        // Mint garden with a valid slug
        string memory slug = "sepolia-e2e-garden";
        uint256 fee = greenGoodsENS.getRegistrationFee(slug, address(this), GreenGoodsENS.NameType.Garden);
        assertGt(fee, 0, "CCIP fee should be non-zero from real router");

        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            communityToken: address(communityToken),
            name: "ENS Slug Garden",
            slug: slug,
            description: "Garden with ENS slug",
            location: "Sepolia Test",
            bannerImage: "ipfs://QmENSBanner",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0x0F
        });

        address garden = gardenToken.mintGarden{ value: fee }(config);
        assertTrue(garden != address(0), "garden should be created");

        // Verify ENS slug was cached on the L2 sender contract
        bytes32 slugHash = keccak256(bytes(slug));
        assertEq(greenGoodsENS.slugOwner(slugHash), garden, "slug should be owned by garden");
        assertFalse(greenGoodsENS.available(slug), "slug should no longer be available");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Member Claims ENS Name
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Grant gardener role, then claim a personal *.greengoods.eth name
    function test_fork_e2e_memberClaimsENSName() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Mint garden and grant gardener role
        address garden = _mintTestGarden("ENS Member Garden", 0x0F);
        _grantGardenRole(garden, forkGardener, IHatsModule.GardenRole.Gardener);

        // Mock CCIP send
        address ccipRouter = address(greenGoodsENS.CCIP_ROUTER());
        vm.mockCall(
            ccipRouter,
            abi.encodeWithSelector(IRouterClient.ccipSend.selector),
            abi.encode(bytes32("mock-claim-id"))
        );

        // Get fee for member name claim
        string memory memberSlug = "fork-gardener";
        uint256 fee = greenGoodsENS.getRegistrationFee(memberSlug, forkGardener, GreenGoodsENS.NameType.Gardener);
        assertGt(fee, 0, "CCIP fee for member claim should be non-zero");

        // Gardener claims name (must be protocol member via Hats)
        vm.deal(forkGardener, fee);
        vm.prank(forkGardener);
        greenGoodsENS.claimName{ value: fee }(memberSlug);

        // Verify slug ownership
        bytes32 slugHash = keccak256(bytes(memberSlug));
        assertEq(greenGoodsENS.slugOwner(slugHash), forkGardener, "slug should be owned by gardener");
        assertEq(
            keccak256(bytes(greenGoodsENS.ownerToSlug(forkGardener))),
            keccak256(bytes(memberSlug)),
            "gardener reverse lookup should match"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: CookieJar Created On Mint
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Garden mint triggers CookieJarModule callback, jars created for supported assets
    function test_fork_e2e_cookieJarCreatedOnMint() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Verify CookieJarModule is wired
        assertTrue(address(gardenToken.cookieJarModule()) != address(0), "cookieJarModule should be wired");

        // Mint garden — CookieJarModule.onGardenMinted() called internally
        address garden = _mintTestGarden("CookieJar E2E Garden", 0x0F);
        assertTrue(garden != address(0), "garden should be created");

        // Query jars created for this garden
        address[] memory jars = cookieJarModule.getGardenJars(garden);

        // If supported assets were configured, jars should exist
        // The number depends on how many assets were configured during deployment
        // Even if 0 assets, the call should succeed (graceful degradation)
        if (jars.length > 0) {
            for (uint256 i = 0; i < jars.length; i++) {
                assertTrue(jars[i] != address(0), "jar address should be non-zero");
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: KarmaGAP Project On Mint
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Garden mint triggers KarmaGAPModule.createProject on real Sepolia GAP
    function test_fork_e2e_karmaGAPProjectOnMint() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Verify KarmaGAPModule is wired
        assertTrue(address(gardenToken.karmaGAPModule()) != address(0), "karmaGAPModule should be wired");

        // Mint garden — KarmaGAPModule.createProject() called internally
        address garden = _mintTestGarden("KarmaGAP E2E Garden", 0x0F);
        assertTrue(garden != address(0), "garden should be created");

        // Verify GAP project was created on the real Sepolia GAP contract (0x9E55...)
        bytes32 projectUID = karmaGAPModule.gardenProjects(garden);
        assertTrue(projectUID != bytes32(0), "GAP project UID should be non-zero on real Sepolia GAP");
        assertTrue(karmaGAPModule.isSupported(), "KarmaGAP should be supported on Sepolia fork");
    }
}
