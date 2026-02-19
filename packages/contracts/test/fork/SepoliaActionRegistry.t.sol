// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase, IEASBase } from "./helpers/ForkTestBase.sol";
import { ActionRegistry, Capital, Domain, NotActionOwner, EndTimeBeforeStartTime } from "../../src/registries/Action.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { WorkSchema } from "../../src/Schemas.sol";
import { NotActiveAction } from "../../src/resolvers/Work.sol";
import { AttestationRequest, AttestationRequestData } from "@eas/IEAS.sol";

/// @title SepoliaActionRegistryForkTest
/// @notice Fork tests for ActionRegistry against real EAS on Sepolia testnet.
/// @dev Subset of ArbitrumActionRegistry tests targeting Sepolia (11155111).
/// Uses `test_fork_` prefix for Sepolia test naming convention.
contract SepoliaActionRegistryForkTest is ForkTestBase {
    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Full CRUD Lifecycle
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Register → read → update → disable → re-enable on Sepolia
    function test_fork_registerAction_fullLifecycle() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Register an action
        Capital[] memory capitals = new Capital[](2);
        capitals[0] = Capital.LIVING;
        capitals[1] = Capital.SOCIAL;

        uint256 startTime = block.timestamp;
        uint256 endTime = block.timestamp + 60 days;

        actionRegistry.registerAction(
            startTime,
            endTime,
            "Sepolia Tree Planting",
            "agro.sepolia_planting",
            "ipfs://QmSepoliaInstructions",
            capitals,
            new string[](0),
            Domain.AGRO
        );

        // Read and verify
        ActionRegistry.Action memory action = actionRegistry.getAction(0);
        assertEq(action.startTime, startTime, "startTime mismatch");
        assertEq(action.endTime, endTime, "endTime mismatch");
        assertEq(action.title, "Sepolia Tree Planting", "title mismatch");
        assertEq(action.slug, "agro.sepolia_planting", "slug mismatch");
        assertEq(action.capitals.length, 2, "should have 2 capitals");
        assertEq(uint256(action.domain), uint256(Domain.AGRO), "domain should be AGRO");

        // Update title
        actionRegistry.updateActionTitle(0, "Updated Sepolia Planting");
        ActionRegistry.Action memory updated = actionRegistry.getAction(0);
        assertEq(updated.title, "Updated Sepolia Planting", "title should be updated");

        // Disable by setting endTime to past
        actionRegistry.updateActionEndTime(0, startTime + 1);
        ActionRegistry.Action memory disabled = actionRegistry.getAction(0);
        assertTrue(disabled.endTime < block.timestamp, "action should be disabled (past endTime)");

        // Re-enable
        actionRegistry.updateActionEndTime(0, block.timestamp + 365 days);
        ActionRegistry.Action memory reenabled = actionRegistry.getAction(0);
        assertTrue(reenabled.endTime > block.timestamp, "action should be re-enabled");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Disabled Action Blocks Work Attestation via Real Sepolia EAS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Work attestation targeting a past (disabled) action is rejected by WorkResolver
    /// on the real Sepolia EAS deployment.
    function test_fork_disabledAction_blocksWorkAttestation() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Set up garden with roles and an active action
        (address garden, uint256 actionUID) = _setupGardenWithRolesAndAction("Sepolia Disabled Action Garden");

        // Disable the action by setting endTime to just after startTime
        ActionRegistry.Action memory action = actionRegistry.getAction(actionUID);
        actionRegistry.updateActionEndTime(actionUID, action.startTime + 1);

        // Attempt work attestation via real Sepolia EAS — should revert
        string[] memory media = new string[](1);
        media[0] = "ipfs://QmSepoliaDisabledWork";

        WorkSchema memory work = WorkSchema({
            actionUID: actionUID,
            title: "Work on Disabled Action",
            feedback: "Should fail on Sepolia",
            metadata: "ipfs://QmDisabledActionMeta",
            media: media
        });

        (address eas,) = _getEASForChain(block.chainid);

        AttestationRequest memory request = AttestationRequest({
            schema: workSchemaUID,
            data: AttestationRequestData({
                recipient: garden,
                expirationTime: 0,
                revocable: false,
                refUID: bytes32(0),
                data: abi.encode(work),
                value: 0
            })
        });

        vm.prank(forkGardener);
        vm.expectRevert(NotActiveAction.selector);
        IEASBase(eas).attest(request);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Unauthorized Registration Reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Non-owner cannot register actions on Sepolia
    function test_fork_registerAction_unauthorizedReverts() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.SOCIAL;

        vm.prank(forkNonMember);
        vm.expectRevert(
            abi.encodeWithSelector(bytes4(keccak256("OwnableUnauthorizedAccount(address)")), forkNonMember)
        );
        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 30 days,
            "Unauthorized Sepolia Action",
            "test.unauthorized_sepolia",
            "ipfs://QmUnauthorizedSepolia",
            capitals,
            new string[](0),
            Domain.SOLAR
        );
    }
}
