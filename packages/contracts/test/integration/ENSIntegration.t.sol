// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";

import { GreenGoodsENS } from "../../src/registries/ENS.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

/// @title MockCCIPRouter — Returns a mock messageId and fixed fee
contract MockCCIPRouter {
    uint256 private _nextMessageId = 1;
    uint256 public mockFee = 0.01 ether;

    function getFee(
        uint64,
        Client.EVM2AnyMessage memory
    ) external view returns (uint256) {
        return mockFee;
    }

    function ccipSend(
        uint64,
        Client.EVM2AnyMessage calldata
    ) external payable returns (bytes32 messageId) {
        messageId = bytes32(_nextMessageId++);
    }

    function setMockFee(uint256 _fee) external {
        mockFee = _fee;
    }
}

/// @title MockHatsForENS — Minimal Hats mock for hat membership checks
contract MockHatsForENS {
    mapping(address account => mapping(uint256 hatId => bool)) public wearers;

    function setWearer(address account, uint256 hatId, bool isWearer) external {
        wearers[account][hatId] = isWearer;
    }

    function isWearerOfHat(address _user, uint256 _hatId) external view returns (bool) {
        return wearers[_user][_hatId];
    }
}

/// @title ENSIntegrationTest
/// @notice Integration tests for GreenGoodsENS registration flows.
///         Verifies garden mint slug registration, empty slug skip, membership checks,
///         cooldown enforcement, and slug uniqueness.
/// @dev Uses mocks only — NO fork required.
contract ENSIntegrationTest is Test {
    // ═══════════════════════════════════════════════════════════════════════════
    // State
    // ═══════════════════════════════════════════════════════════════════════════

    GreenGoodsENS internal ens;
    MockCCIPRouter internal ccipRouter;
    MockHatsForENS internal hats;

    address internal constant OWNER = address(0xA1);
    address internal constant GARDEN_TOKEN = address(0xA2);
    address internal constant GARDEN_A = address(0xB1);
    address internal constant GARDEN_B = address(0xB2);
    address internal constant L1_RECEIVER = address(0xC1);
    address internal constant MEMBER = address(0xD1);
    address internal constant NON_MEMBER = address(0xD2);

    uint64 internal constant ETH_CHAIN_SELECTOR = 5009297550715157269;
    uint256 internal constant PROTOCOL_HAT_ID = 99;

    function setUp() public {
        ccipRouter = new MockCCIPRouter();
        hats = new MockHatsForENS();

        ens = new GreenGoodsENS(
            address(ccipRouter),
            ETH_CHAIN_SELECTOR,
            L1_RECEIVER,
            address(hats),
            PROTOCOL_HAT_ID,
            OWNER
        );

        // Authorize GardenToken as caller
        vm.prank(OWNER);
        ens.setAuthorizedCaller(GARDEN_TOKEN, true);

        // Fund the test contract for CCIP fees
        vm.deal(GARDEN_TOKEN, 10 ether);
        vm.deal(MEMBER, 10 ether);
        vm.deal(NON_MEMBER, 10 ether);
        vm.deal(OWNER, 10 ether);

        // Set MEMBER as protocol member
        hats.setWearer(MEMBER, PROTOCOL_HAT_ID, true);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Garden mint with slug calls ENS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice registerGarden with a valid slug caches the registration
    function test_gardenMintWithSlugCallsENS() public {
        vm.prank(GARDEN_TOKEN);
        ens.registerGarden{ value: 0.1 ether }("miyawaki-park", GARDEN_A);

        // Verify L2 cache
        bytes32 slugHash = keccak256(bytes("miyawaki-park"));
        assertEq(ens.slugOwner(slugHash), GARDEN_A, "Slug owner should be garden A");
        assertEq(
            keccak256(bytes(ens.ownerToSlug(GARDEN_A))),
            keccak256(bytes("miyawaki-park")),
            "Garden A should own the slug"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Garden mint with empty slug skips ENS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Empty slug should revert (InvalidSlug) since it fails MIN_SLUG_LENGTH
    function test_gardenMintEmptySlugSkipsENS() public {
        // Empty slug fails validation (length < 3)
        vm.prank(GARDEN_TOKEN);
        vm.expectRevert();
        ens.registerGarden{ value: 0.1 ether }("", GARDEN_A);

        // Verify no registration occurred
        assertEq(
            bytes(ens.ownerToSlug(GARDEN_A)).length,
            0,
            "Garden A should have no slug"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: claimName requires hat membership
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Non-member cannot claim a personal ENS name
    function test_claimNameRequiresHatMembership() public {
        // NON_MEMBER does not wear the protocol hat
        vm.prank(NON_MEMBER);
        vm.expectRevert(NotProtocolMember.selector);
        ens.claimName{ value: 0.1 ether }("non-member-name");

        // MEMBER should succeed
        vm.prank(MEMBER);
        ens.claimName{ value: 0.1 ether }("member-name");

        bytes32 slugHash = keccak256(bytes("member-name"));
        assertEq(ens.slugOwner(slugHash), MEMBER, "Member should own the slug");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Release name cooldown enforced
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice After releasing a name, it cannot be immediately re-claimed (cooldown)
    function test_releaseNameCooldownEnforced() public {
        // Member claims a name
        vm.prank(MEMBER);
        ens.claimName{ value: 0.1 ether }("cooldown-test");

        bytes32 slugHash = keccak256(bytes("cooldown-test"));
        assertEq(ens.slugOwner(slugHash), MEMBER, "Member should own slug before release");

        // Member releases the name
        vm.prank(MEMBER);
        ens.releaseName{ value: 0.1 ether }();

        // Slug should now be released on L2 cache
        assertEq(ens.slugOwner(slugHash), address(0), "Slug owner should be cleared after release");

        // Attempt to re-claim immediately → should revert with NameInCooldown
        vm.prank(MEMBER);
        vm.expectRevert(NameInCooldown.selector);
        ens.claimName{ value: 0.1 ether }("cooldown-test");

        // Fast-forward past the cooldown period (default 30 days)
        vm.warp(block.timestamp + 31 days);

        // Now re-claim should succeed
        vm.prank(MEMBER);
        ens.claimName{ value: 0.1 ether }("cooldown-test");

        assertEq(ens.slugOwner(slugHash), MEMBER, "Member should own slug after cooldown");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 5: Two gardens with different slugs
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Slug uniqueness is enforced across gardens
    function test_twoGardensDifferentSlugs() public {
        // Garden A registers slug "alpha-garden"
        vm.prank(GARDEN_TOKEN);
        ens.registerGarden{ value: 0.1 ether }("alpha-garden", GARDEN_A);

        // Garden B registers slug "beta-garden" (different slug — should succeed)
        vm.prank(GARDEN_TOKEN);
        ens.registerGarden{ value: 0.1 ether }("beta-garden", GARDEN_B);

        // Verify both cached correctly
        bytes32 hashA = keccak256(bytes("alpha-garden"));
        bytes32 hashB = keccak256(bytes("beta-garden"));

        assertEq(ens.slugOwner(hashA), GARDEN_A, "Alpha slug should belong to garden A");
        assertEq(ens.slugOwner(hashB), GARDEN_B, "Beta slug should belong to garden B");

        // Garden B trying to take garden A's slug → NameTaken
        vm.prank(GARDEN_TOKEN);
        vm.expectRevert(NameTaken.selector);
        ens.registerGarden{ value: 0.1 ether }("alpha-garden", GARDEN_B);
    }
}

// Import file-level errors from ENS.sol for selector references
import { NameTaken, NotProtocolMember, NameInCooldown } from "../../src/registries/ENS.sol";
