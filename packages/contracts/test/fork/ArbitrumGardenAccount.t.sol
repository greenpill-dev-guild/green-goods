// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase } from "./helpers/ForkTestBase.sol";
import { GardenToken } from "../../src/tokens/Garden.sol";
import {
    GardenAccount,
    NotGardenOwner,
    NotGardenOperator,
    InvalidInvite,
    AlreadyGardener,
    GardenFull
} from "../../src/accounts/Garden.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { IGardensModule } from "../../src/interfaces/IGardensModule.sol";
import { MockERC20 } from "../../src/mocks/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title ArbitrumGardenAccountForkTest
/// @notice Fork tests for GardenAccount (TBA) against Arbitrum mainnet.
/// @dev Tests execute(), metadata setters, community token, garden capacity,
/// invite validation, double-join prevention, and role delegation to HatsModule.
contract ArbitrumGardenAccountForkTest is ForkTestBase {
    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Owner Can Execute External Contract Call
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Garden owner (NFT holder) can call execute() on the TBA to interact with external contracts.
    function testForkArbitrum_execute_ownerCanCallExternalContract() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        address garden = _mintTestGarden("Execute Test Garden", 0x0F);

        // Deploy a mock ERC20 and fund the garden TBA
        MockERC20 token = new MockERC20();
        token.transfer(garden, 100e18);

        // Owner (address(this)) calls execute() on the TBA to transfer tokens out
        bytes memory transferCall = abi.encodeWithSelector(IERC20.transfer.selector, forkOperator, 50e18);

        GardenAccount gardenAcct = GardenAccount(payable(garden));
        gardenAcct.execute(address(token), 0, transferCall, 0);

        assertEq(token.balanceOf(forkOperator), 50e18, "operator should receive 50 tokens");
        assertEq(token.balanceOf(garden), 50e18, "garden should have 50 tokens remaining");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Non-Owner Execute Reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Non-owner of the NFT cannot call execute() on the TBA.
    function testForkArbitrum_execute_nonOwnerReverts() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        address garden = _mintTestGarden("Non-Owner Execute Garden", 0x0F);

        GardenAccount gardenAcct = GardenAccount(payable(garden));

        // forkNonMember does not own the NFT — execute should revert
        vm.prank(forkNonMember);
        vm.expectRevert(bytes4(keccak256("NotAuthorized()")));
        gardenAcct.execute(address(0xDEAD), 0, "", 0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Operator Can Execute Permitted Call
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Operator role allows updating garden metadata via the account's setter functions.
    /// @dev Operators use the setter functions directly (not execute()), which check onlyOperator.
    function testForkArbitrum_execute_operatorCanCallAllowed() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        (address garden,) = _setupGardenWithRolesAndAction("Operator Exec Garden");
        GardenAccount gardenAcct = GardenAccount(payable(garden));

        // Operator can update description (onlyOperator)
        vm.prank(forkOperator);
        gardenAcct.updateDescription("Updated by operator");
        assertEq(
            keccak256(bytes(gardenAcct.description())),
            keccak256(bytes("Updated by operator")),
            "operator should update description"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Metadata Setters — Owner Updates
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Owner can update all metadata fields: name, description, location, bannerImage.
    function testForkArbitrum_metadataSetters_ownerUpdates() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        // Setup garden — forkOwner (address(this)) is the owner via HatsModule
        (address garden,) = _setupGardenWithRolesAndAction("Metadata Test Garden");
        GardenAccount gardenAcct = GardenAccount(payable(garden));

        // Owner updates name (onlyGardenOwner)
        gardenAcct.updateName("Renamed Garden");
        assertEq(keccak256(bytes(gardenAcct.name())), keccak256(bytes("Renamed Garden")), "name not updated");

        // Owner updates description (onlyOperator — owner qualifies via hierarchy)
        gardenAcct.updateDescription("New description");
        assertEq(keccak256(bytes(gardenAcct.description())), keccak256(bytes("New description")), "description not updated");

        // Owner updates location (onlyOperator)
        gardenAcct.updateLocation("New Location");
        assertEq(keccak256(bytes(gardenAcct.location())), keccak256(bytes("New Location")), "location not updated");

        // Owner updates banner (onlyOperator)
        gardenAcct.updateBannerImage("ipfs://QmNewBanner");
        assertEq(keccak256(bytes(gardenAcct.bannerImage())), keccak256(bytes("ipfs://QmNewBanner")), "banner not updated");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 5: Metadata Setters — Non-Owner Reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Non-owner/non-operator cannot call metadata setters.
    function testForkArbitrum_metadataSetters_nonOwnerReverts() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        (address garden,) = _setupGardenWithRolesAndAction("Access Control Garden");
        GardenAccount gardenAcct = GardenAccount(payable(garden));

        // forkNonMember has no role — all setters should revert
        vm.startPrank(forkNonMember);

        vm.expectRevert(NotGardenOwner.selector);
        gardenAcct.updateName("Unauthorized");

        vm.expectRevert(NotGardenOperator.selector);
        gardenAcct.updateDescription("Unauthorized");

        vm.expectRevert(NotGardenOperator.selector);
        gardenAcct.updateLocation("Unauthorized");

        vm.expectRevert(NotGardenOperator.selector);
        gardenAcct.updateBannerImage("Unauthorized");

        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 6: Community Token Update
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Owner can update the community token on GardenToken (global setting).
    /// @dev setCommunityToken is on GardenToken, not GardenAccount. Validates ERC-20 compliance.
    function testForkArbitrum_communityTokenUpdate() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        // Deploy a new mock token
        MockERC20 newToken = new MockERC20();

        // Store old token address
        address oldToken = gardenToken.communityToken();
        assertTrue(oldToken != address(0), "old token should be set");

        // Owner updates community token (on GardenToken)
        gardenToken.setCommunityToken(address(newToken));
        assertEq(gardenToken.communityToken(), address(newToken), "community token should be updated");

        // Verify minting works with new token
        address garden = _mintTestGarden("New Token Garden", 0x01);
        assertTrue(garden != address(0), "mint should succeed with new community token");

        // Verify the garden account has the new community token
        GardenAccount gardenAcct = GardenAccount(payable(garden));
        assertEq(gardenAcct.communityToken(), address(newToken), "garden should use new community token");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 7: Garden Full — Capacity Enforced
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice After maxGardeners is reached, joinGarden reverts with GardenFull.
    function testForkArbitrum_gardenFull_reverts() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        // Mint an open-joining garden
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            name: "Capacity Test Garden",
            slug: "",
            description: "Tests max capacity",
            location: "Arbitrum Fork",
            bannerImage: "",
            metadata: "",
            openJoining: true,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0x01,
            gardeners: new address[](0),
            operators: new address[](0)
        });

        address garden = gardenToken.mintGarden(config);
        GardenAccount gardenAcct = GardenAccount(payable(garden));

        // Set max gardeners to 1 (operator action — owner qualifies)
        gardenAcct.setMaxGardeners(1);
        assertEq(gardenAcct.maxGardeners(), 1, "max should be set to 1");

        // First join should succeed
        vm.prank(forkGardener);
        gardenAcct.joinGarden();
        assertTrue(gardenAcct.isGardener(forkGardener), "first joiner should be gardener");

        // Second join should revert with GardenFull
        address extraUser = makeAddr("extraUser");
        vm.prank(extraUser);
        vm.expectRevert(GardenFull.selector);
        gardenAcct.joinGarden();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 8: Invalid Invite — Closed Garden Rejects Joiners
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice joinGarden() reverts with InvalidInvite when openJoining is false.
    function testForkArbitrum_invalidInvite_reverts() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        // Mint a closed garden (openJoining: false is the default from _mintTestGarden)
        address garden = _mintTestGarden("Closed Garden", 0x01);
        GardenAccount gardenAcct = GardenAccount(payable(garden));

        assertFalse(gardenAcct.openJoining(), "garden should not allow open joining");

        // Attempt to join — should revert
        vm.prank(forkNonMember);
        vm.expectRevert(InvalidInvite.selector);
        gardenAcct.joinGarden();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 9: Already Gardener — Double Join Reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice joinGarden() reverts with AlreadyGardener when caller already has a role.
    function testForkArbitrum_alreadyGardener_reverts() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        // Mint an open garden and grant gardener role
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            name: "Double Join Garden",
            slug: "",
            description: "Tests double join prevention",
            location: "Arbitrum Fork",
            bannerImage: "",
            metadata: "",
            openJoining: true,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0x01,
            gardeners: new address[](0),
            operators: new address[](0)
        });

        address garden = gardenToken.mintGarden(config);
        GardenAccount gardenAcct = GardenAccount(payable(garden));

        // First join succeeds
        vm.prank(forkGardener);
        gardenAcct.joinGarden();
        assertTrue(gardenAcct.isGardener(forkGardener), "should be gardener after first join");

        // Second join should revert
        vm.prank(forkGardener);
        vm.expectRevert(AlreadyGardener.selector);
        gardenAcct.joinGarden();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 10: Role Check Delegates to Real HatsModule
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice isOperator/isGardener/isEvaluator on GardenAccount delegate to real HatsModule.
    function testForkArbitrum_roleCheck_delegatesToHatsModule() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        (address garden,) = _setupGardenWithRolesAndAction("Role Delegation Garden");
        GardenAccount gardenAcct = GardenAccount(payable(garden));

        // Verify role checks match HatsModule state
        // forkOwner (address(this)) should be owner
        assertTrue(gardenAcct.isOwner(address(this)), "test contract should be owner");

        // forkOperator should be operator (and implicitly gardener/evaluator)
        assertTrue(gardenAcct.isOperator(forkOperator), "forkOperator should be operator");
        assertTrue(gardenAcct.isGardener(forkOperator), "operator should implicitly be gardener");
        assertTrue(gardenAcct.isEvaluator(forkOperator), "operator should implicitly be evaluator");

        // forkGardener should be gardener only
        assertTrue(gardenAcct.isGardener(forkGardener), "forkGardener should be gardener");
        assertFalse(hatsModule.isOperatorOf(garden, forkGardener), "gardener should NOT be operator in HatsModule");

        // forkEvaluator should be evaluator
        assertTrue(gardenAcct.isEvaluator(forkEvaluator), "forkEvaluator should be evaluator");

        // forkNonMember has no roles
        assertFalse(gardenAcct.isGardener(forkNonMember), "nonMember should NOT be gardener");
        assertFalse(gardenAcct.isOperator(forkNonMember), "nonMember should NOT be operator");
        assertFalse(gardenAcct.isEvaluator(forkNonMember), "nonMember should NOT be evaluator");
        assertFalse(gardenAcct.isOwner(forkNonMember), "nonMember should NOT be owner");
    }
}
