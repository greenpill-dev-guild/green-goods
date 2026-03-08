// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase, IEASBase } from "./fork/helpers/ForkTestBase.sol";
import { GardenToken } from "../src/tokens/Garden.sol";
import { GardenAccount } from "../src/accounts/Garden.sol";
import { ActionRegistry, Capital, Domain } from "../src/registries/Action.sol";
import { IHatsModule } from "../src/interfaces/IHatsModule.sol";
import { IGardensModule } from "../src/interfaces/IGardensModule.sol";
import { WorkSchema, WorkApprovalSchema, AssessmentSchema } from "../src/Schemas.sol";
import { AssessmentResolver } from "../src/resolvers/Assessment.sol";
import { AttestationRequest, AttestationRequestData } from "@eas/IEAS.sol";

/// @title RevertingKarmaGAPModule
/// @notice Fault-injection mock that always reverts on createMilestone()
/// @dev Used to test the try-catch in AssessmentResolver._createGAPProjectMilestone()
contract RevertingKarmaGAPModule {
    function createMilestone(
        address,
        string calldata,
        string calldata,
        uint256,
        uint256,
        uint8,
        string calldata,
        string calldata
    )
        external
        pure
        returns (bytes32)
    {
        revert("KarmaGAP: milestone creation failed");
    }
}

/// @title E2EWorkflowForkTest
/// @notice End-to-end integration tests for full protocol workflows on a Sepolia fork.
/// @dev Extends ForkTestBase to deploy against real EAS, Hats Protocol, and the full
/// production deployment stack. All attestations go through real resolver callbacks.
contract E2EWorkflowForkTest is ForkTestBase {
    bytes4 private constant NOT_GARDEN_OPERATOR_SELECTOR = bytes4(keccak256("NotGardenOperator()"));
    bytes4 private constant NOT_AUTHORIZED_ATTESTER_SELECTOR = bytes4(keccak256("NotAuthorizedAttester()"));
    bytes4 private constant INVALID_DOMAIN_SELECTOR = bytes4(keccak256("InvalidDomain(uint8)"));

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Mint a test garden with configurable open joining
    function _mintGarden(bool openJoining) internal returns (address garden) {
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            name: "E2E Test Garden",
            slug: "",
            description: "A complete workflow test garden",
            location: "Test City",
            bannerImage: "ipfs://QmBanner",
            metadata: "",
            openJoining: openJoining,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0x0F,
            gardeners: new address[](0),
            operators: new address[](0)
        });
        return gardenToken.mintGarden(config);
    }

    /// @notice Grant operator/gardener/evaluator roles using real HatsModule
    function _grantRoles(address garden) internal {
        _grantGardenRole(garden, forkOperator, IHatsModule.GardenRole.Operator);
        _grantGardenRole(garden, forkGardener, IHatsModule.GardenRole.Gardener);
        _grantGardenRole(garden, forkEvaluator, IHatsModule.GardenRole.Evaluator);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Complete protocol flow via real EAS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Full lifecycle: Mint -> Roles -> Register -> Submit work -> Approve work (all via real EAS)
    function test_fork_completeProtocolWorkflow() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        address garden = _mintGarden(false);
        GardenAccount gardenAccount = GardenAccount(payable(garden));
        _grantRoles(garden);

        assertEq(gardenAccount.name(), "E2E Test Garden");
        assertTrue(gardenAccount.isOperator(forkOperator));
        assertTrue(gardenAccount.isGardener(forkGardener));

        // Register action
        uint256 actionUID = _registerTestAction();

        // Submit work via real EAS -> WorkResolver callback
        bytes32 workAttUID = _submitWorkAttestation(forkGardener, garden, actionUID);
        assertTrue(workAttUID != bytes32(0), "work attestation UID should be non-zero");

        // Approve work via real EAS -> WorkApprovalResolver callback
        bytes32 approvalUID = _submitWorkApproval(forkOperator, garden, actionUID, workAttUID);
        assertTrue(approvalUID != bytes32(0), "work approval UID should be non-zero");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Access control with real Hats roles
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Non-member revert -> operator granted -> authorized update
    function test_fork_accessControlEnforcement() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        address garden = _mintGarden(false);
        GardenAccount gardenAccount = GardenAccount(payable(garden));
        string memory initialDescription = gardenAccount.description();

        // Non-member cannot update description
        vm.prank(forkNonMember);
        vm.expectRevert(NOT_GARDEN_OPERATOR_SELECTOR);
        gardenAccount.updateDescription("Unauthorized update");
        assertEq(
            gardenAccount.description(), initialDescription, "Description must remain unchanged after unauthorized update"
        );

        // Grant operator role via real HatsModule
        _grantGardenRole(garden, forkOperator, IHatsModule.GardenRole.Operator);

        // Operator can update
        vm.prank(forkOperator);
        gardenAccount.updateDescription("Authorized update");
        assertEq(gardenAccount.description(), "Authorized update");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Open joining via real HatsModule
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Open joining grants gardener hat via real HatsModule
    function test_fork_joinGardenOpenJoining() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        address garden = _mintGarden(true);
        GardenAccount gardenAccount = GardenAccount(payable(garden));

        // Non-member joins open garden
        vm.prank(forkGardener);
        gardenAccount.joinGarden();

        assertTrue(gardenAccount.isGardener(forkGardener));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Phase 5: Assessment Attestation Tests (via real EAS)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Assessment via evaluator succeeds through real EAS -> AssessmentResolver
    function test_fork_assessmentAttestation_validEvaluator_succeeds() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        address garden = _mintGarden(false);
        _grantRoles(garden);

        bytes32 assessmentUID = _submitAssessment(forkEvaluator, garden, 1); // AGRO domain
        assertTrue(assessmentUID != bytes32(0), "Assessment attestation should succeed for evaluator");
    }

    /// @notice Assessment via operator succeeds (operators have assessment rights)
    function test_fork_assessmentAttestation_validOperator_succeeds() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        address garden = _mintGarden(false);
        _grantRoles(garden);

        bytes32 assessmentUID = _submitAssessment(forkOperator, garden, 1); // AGRO domain
        assertTrue(assessmentUID != bytes32(0), "Assessment attestation should succeed for operator");
    }

    /// @notice Non-member cannot create assessment (reverts in real AssessmentResolver callback)
    function test_fork_assessmentAttestation_nonMember_reverts() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        address garden = _mintGarden(false);
        _grantRoles(garden);

        // Non-member assessment should revert in real AssessmentResolver
        vm.expectRevert(NOT_AUTHORIZED_ATTESTER_SELECTOR);
        _submitAssessment(forkNonMember, garden, 1);
    }

    /// @notice FAULT INJECTION: KarmaGAPModule reverts on createMilestone, assessment still succeeds
    /// @dev Tests the try-catch in AssessmentResolver._createGAPProjectMilestone()
    function test_fork_assessmentAttestation_karmaGAPModuleFails_assessmentStillSucceeds() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        address garden = _mintGarden(false);
        _grantRoles(garden);

        // Wire a reverting KarmaGAPModule to the resolver
        RevertingKarmaGAPModule revertingModule = new RevertingKarmaGAPModule();
        assessmentResolver.setKarmaGAPModule(address(revertingModule));

        // Assessment MUST succeed even though KarmaGAP integration fails
        bytes32 assessmentUID = _submitAssessment(forkEvaluator, garden, 1);
        assertTrue(assessmentUID != bytes32(0), "Assessment should succeed despite KarmaGAP milestone failure");
    }

    /// @notice Assessment with invalid domain (>3) reverts in real AssessmentResolver
    function test_fork_assessmentAttestation_invalidDomain_reverts() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        address garden = _mintGarden(false);
        _grantRoles(garden);

        // Domain 4 is invalid (must be 0-3) — real AssessmentResolver will revert
        vm.expectRevert(abi.encodeWithSelector(INVALID_DOMAIN_SELECTOR, uint8(4)));
        _submitAssessment(forkEvaluator, garden, 4);
    }
}
