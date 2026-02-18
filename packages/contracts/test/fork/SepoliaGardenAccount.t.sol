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

/// @title SepoliaGardenAccountForkTest
/// @notice Fork tests for GardenAccount (TBA) against Sepolia testnet.
/// @dev Ports key scenarios from ArbitrumGardenAccountForkTest to validate the TBA
/// works correctly against Sepolia's EAS and Hats Protocol deployments.
contract SepoliaGardenAccountForkTest is ForkTestBase {
    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Owner Can Execute External Contract Call
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Garden owner (NFT holder) can call execute() on the TBA to interact with external contracts.
    function test_fork_sepolia_execute_ownerCanCallExternalContract() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        address garden = _mintTestGarden("Sepolia Execute Test Garden", 0x0F);

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
    function test_fork_sepolia_execute_nonOwnerReverts() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        address garden = _mintTestGarden("Sepolia Non-Owner Execute Garden", 0x0F);

        GardenAccount gardenAcct = GardenAccount(payable(garden));

        // forkNonMember does not own the NFT — execute should revert
        vm.prank(forkNonMember);
        vm.expectRevert();
        gardenAcct.execute(address(0xDEAD), 0, "", 0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Operator Can Update Metadata
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Operator role allows updating garden metadata via the account's setter functions.
    function test_fork_sepolia_execute_operatorCanCallAllowed() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        (address garden,) = _setupGardenWithRolesAndAction("Sepolia Operator Exec Garden");
        GardenAccount gardenAcct = GardenAccount(payable(garden));

        // Operator can update description (onlyOperator)
        vm.prank(forkOperator);
        gardenAcct.updateDescription("Updated by operator on Sepolia");
        assertEq(
            keccak256(bytes(gardenAcct.description())),
            keccak256(bytes("Updated by operator on Sepolia")),
            "operator should update description"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Metadata Setters — Owner Updates All Fields
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Owner can update all metadata fields: name, description, location, bannerImage.
    function test_fork_sepolia_metadataSetters_ownerUpdates() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        (address garden,) = _setupGardenWithRolesAndAction("Sepolia Metadata Test Garden");
        GardenAccount gardenAcct = GardenAccount(payable(garden));

        // Owner updates name (onlyGardenOwner)
        gardenAcct.updateName("Sepolia Renamed Garden");
        assertEq(keccak256(bytes(gardenAcct.name())), keccak256(bytes("Sepolia Renamed Garden")), "name not updated");

        // Owner updates description (onlyOperator — owner qualifies via hierarchy)
        gardenAcct.updateDescription("Sepolia new description");
        assertEq(
            keccak256(bytes(gardenAcct.description())),
            keccak256(bytes("Sepolia new description")),
            "description not updated"
        );

        // Owner updates location (onlyOperator)
        gardenAcct.updateLocation("Sepolia Location");
        assertEq(keccak256(bytes(gardenAcct.location())), keccak256(bytes("Sepolia Location")), "location not updated");

        // Owner updates banner (onlyOperator)
        gardenAcct.updateBannerImage("ipfs://QmSepoliaBanner");
        assertEq(
            keccak256(bytes(gardenAcct.bannerImage())), keccak256(bytes("ipfs://QmSepoliaBanner")), "banner not updated"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 5: Metadata Setters — Non-Owner Reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Non-owner/non-operator cannot call metadata setters.
    function test_fork_sepolia_metadataSetters_nonOwnerReverts() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        (address garden,) = _setupGardenWithRolesAndAction("Sepolia Access Control Garden");
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
    // Test 6: Garden Full — Capacity Enforced
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice After maxGardeners is reached, joinGarden reverts with GardenFull.
    function test_fork_sepolia_gardenFull_reverts() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Mint an open-joining garden
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            name: "Sepolia Capacity Test Garden",
            slug: "",
            description: "Tests max capacity on Sepolia",
            location: "Sepolia Fork",
            bannerImage: "",
            metadata: "",
            openJoining: true,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0x01
        });

        address garden = gardenToken.mintGarden(config);
        GardenAccount gardenAcct = GardenAccount(payable(garden));

        // Set max gardeners to 1
        gardenAcct.setMaxGardeners(1);
        assertEq(gardenAcct.maxGardeners(), 1, "max should be set to 1");

        // First join should succeed
        vm.prank(forkGardener);
        gardenAcct.joinGarden();
        assertTrue(gardenAcct.isGardener(forkGardener), "first joiner should be gardener");

        // Second join should revert with GardenFull
        address extraUser = makeAddr("sepoliaExtraUser");
        vm.prank(extraUser);
        vm.expectRevert(GardenFull.selector);
        gardenAcct.joinGarden();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 7: Invalid Invite — Closed Garden Rejects Joiners
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice joinGarden() reverts with InvalidInvite when openJoining is false.
    function test_fork_sepolia_invalidInvite_reverts() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Mint a closed garden (openJoining: false is the default from _mintTestGarden)
        address garden = _mintTestGarden("Sepolia Closed Garden", 0x01);
        GardenAccount gardenAcct = GardenAccount(payable(garden));

        assertFalse(gardenAcct.openJoining(), "garden should not allow open joining");

        vm.prank(forkNonMember);
        vm.expectRevert(InvalidInvite.selector);
        gardenAcct.joinGarden();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 8: Already Gardener — Double Join Reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice joinGarden() reverts with AlreadyGardener when caller already has a role.
    function test_fork_sepolia_alreadyGardener_reverts() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            name: "Sepolia Double Join Garden",
            slug: "",
            description: "Tests double join prevention on Sepolia",
            location: "Sepolia Fork",
            bannerImage: "",
            metadata: "",
            openJoining: true,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0x01
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
    // Test 9: Role Check Delegates to Real HatsModule
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice isOperator/isGardener/isEvaluator on GardenAccount delegate to real HatsModule.
    function test_fork_sepolia_roleCheck_delegatesToHatsModule() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        (address garden,) = _setupGardenWithRolesAndAction("Sepolia Role Delegation Garden");
        GardenAccount gardenAcct = GardenAccount(payable(garden));

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
