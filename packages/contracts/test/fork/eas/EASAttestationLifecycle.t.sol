// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase } from "../helpers/ForkTestBase.sol";
import { ISchemaRegistry } from "../../helpers/DeploymentBase.sol";
import { WorkSchema, WorkApprovalSchema, AssessmentSchema } from "../../../src/Schemas.sol";
import { IHatsModule } from "../../../src/interfaces/IHatsModule.sol";
import { NotGardenMember } from "../../../src/resolvers/Work.sol";
import { NotGardenOperator } from "../../../src/resolvers/WorkApproval.sol";
import { InvalidDomain } from "../../../src/resolvers/Assessment.sol";
import { AttestationRequest, AttestationRequestData, RevocationRequest, RevocationRequestData } from "@eas/IEAS.sol";

/// @notice Minimal EAS interface for fork tests (avoids IEAS naming conflict with DeploymentBase)
interface IEASFork {
    function attest(AttestationRequest calldata request) external payable returns (bytes32);
    function revoke(RevocationRequest calldata request) external payable;
}

/// @title EASAttestationLifecycleForkTest
/// @notice Fork tests validating the full EAS attestation lifecycle against real EAS contracts.
/// @dev Exercises schema registration, work/approval/assessment attestations, role-based access
/// control through resolver callbacks, and revocation enforcement. Gracefully skips when no
/// Sepolia RPC URL is available.
contract EASAttestationLifecycleForkTest is ForkTestBase {
    // ═══════════════════════════════════════════════════════════════════════════
    // Internal Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Get the EAS address for the current fork chain
    function _eas() internal view returns (address eas) {
        (eas,) = _getEASForChain(block.chainid);
    }

    /// @notice Get the EAS schema registry address for the current fork chain
    function _schemaRegistry() internal view returns (address registry) {
        (, registry) = _getEASForChain(block.chainid);
    }

    /// @notice Set up a garden with roles and a registered action
    /// @return gardenAccount The garden TBA address
    /// @return actionUID The registered action UID
    function _setupGardenWithAction() internal returns (address gardenAccount, uint256 actionUID) {
        // Mint a garden (domainMask 0x0F = all domains enabled)
        gardenAccount = _mintTestGarden("EAS Test Garden", 0x0F);

        // Grant roles
        _grantGardenRole(gardenAccount, forkOperator, IHatsModule.GardenRole.Operator);
        _grantGardenRole(gardenAccount, forkGardener, IHatsModule.GardenRole.Gardener);
        _grantGardenRole(gardenAccount, forkEvaluator, IHatsModule.GardenRole.Evaluator);

        // Register a test action
        actionUID = _registerTestAction();
    }

    /// @notice Submit a work attestation as a specific attester
    /// @return attestationUID The UID of the created attestation
    function _submitWork(
        address attester,
        address gardenAccount,
        uint256 actionUID
    )
        internal
        returns (bytes32 attestationUID)
    {
        string[] memory media = new string[](1);
        media[0] = "ipfs://QmForkTestPhoto";

        WorkSchema memory work = WorkSchema({
            actionUID: actionUID,
            title: "Fork Test Work",
            feedback: "Completed",
            metadata: "ipfs://QmForkLifecycleMeta",
            media: media
        });

        AttestationRequest memory request = AttestationRequest({
            schema: workSchemaUID,
            data: AttestationRequestData({
                recipient: gardenAccount,
                expirationTime: 0,
                revocable: false,
                refUID: bytes32(0),
                data: abi.encode(work),
                value: 0
            })
        });

        vm.prank(attester);
        attestationUID = IEASFork(_eas()).attest(request);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Schema Registration
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verify schemas are registered with the real EAS SchemaRegistry on fork
    function test_fork_schemaRegistration_registersWithRealSchemaRegistry() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }
        _deployFullStackOnFork();

        // All schema UIDs should be non-zero after deployment
        assertTrue(workSchemaUID != bytes32(0), "workSchemaUID should be non-zero");
        assertTrue(workApprovalSchemaUID != bytes32(0), "workApprovalSchemaUID should be non-zero");
        assertTrue(assessmentSchemaUID != bytes32(0), "assessmentSchemaUID should be non-zero");

        // Query the real SchemaRegistry to verify resolver addresses
        ISchemaRegistry registry = ISchemaRegistry(_schemaRegistry());

        (, address workResolver_,) = registry.getSchema(workSchemaUID);
        assertEq(workResolver_, address(workResolver), "Work schema resolver mismatch");

        (, address workApprovalResolver_,) = registry.getSchema(workApprovalSchemaUID);
        assertEq(workApprovalResolver_, address(workApprovalResolver), "WorkApproval schema resolver mismatch");

        (, address assessmentResolver_,) = registry.getSchema(assessmentSchemaUID);
        assertEq(assessmentResolver_, address(assessmentResolver), "Assessment schema resolver mismatch");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Work Attestation (Valid Gardener)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Work attestation succeeds when submitted by a valid gardener
    function test_fork_workAttestation_succeedsWithValidGardener() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }
        _deployFullStackOnFork();

        (address gardenAccount, uint256 actionUID) = _setupGardenWithAction();

        bytes32 attestationUID = _submitWork(forkGardener, gardenAccount, actionUID);
        assertTrue(attestationUID != bytes32(0), "Work attestation UID should be non-zero");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Work Attestation (Non-Member Reverts)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Work attestation reverts when submitted by a non-member
    function test_fork_workAttestation_revertsForNonMember() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }
        _deployFullStackOnFork();

        (address gardenAccount, uint256 actionUID) = _setupGardenWithAction();

        string[] memory media = new string[](0);
        WorkSchema memory work = WorkSchema({
            actionUID: actionUID,
            title: "Unauthorized Work",
            feedback: "",
            metadata: "ipfs://QmUnauthorizedWorkMeta",
            media: media
        });

        AttestationRequest memory request = AttestationRequest({
            schema: workSchemaUID,
            data: AttestationRequestData({
                recipient: gardenAccount,
                expirationTime: 0,
                revocable: false,
                refUID: bytes32(0),
                data: abi.encode(work),
                value: 0
            })
        });

        vm.prank(forkNonMember);
        vm.expectRevert(NotGardenMember.selector);
        IEASFork(_eas()).attest(request);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Work Approval (Valid Operator)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Work approval succeeds when submitted by a valid operator
    function test_fork_workApproval_succeedsWithValidOperator() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }
        _deployFullStackOnFork();

        (address gardenAccount, uint256 actionUID) = _setupGardenWithAction();

        // Step 1: Submit work as gardener
        bytes32 workAttUID = _submitWork(forkGardener, gardenAccount, actionUID);
        assertTrue(workAttUID != bytes32(0), "Work attestation should succeed");

        // Step 2: Approve work as operator
        WorkApprovalSchema memory approval = WorkApprovalSchema({
            actionUID: actionUID,
            workUID: workAttUID,
            approved: true,
            feedback: "Verified on-site",
            confidence: 2,
            verificationMethod: 1,
            reviewNotesCID: ""
        });

        AttestationRequest memory request = AttestationRequest({
            schema: workApprovalSchemaUID,
            data: AttestationRequestData({
                recipient: gardenAccount,
                expirationTime: 0,
                revocable: false,
                refUID: workAttUID,
                data: abi.encode(approval),
                value: 0
            })
        });

        vm.prank(forkOperator);
        bytes32 approvalUID = IEASFork(_eas()).attest(request);
        assertTrue(approvalUID != bytes32(0), "Work approval UID should be non-zero");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 5: Work Approval (Non-Operator Reverts)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Work approval reverts when submitted by a gardener (not operator/evaluator)
    function test_fork_workApproval_revertsForNonOperator() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }
        _deployFullStackOnFork();

        (address gardenAccount, uint256 actionUID) = _setupGardenWithAction();

        // Submit work as gardener
        bytes32 workAttUID = _submitWork(forkGardener, gardenAccount, actionUID);

        // Gardener tries to approve (should fail - not operator/evaluator)
        WorkApprovalSchema memory approval = WorkApprovalSchema({
            actionUID: actionUID,
            workUID: workAttUID,
            approved: true,
            feedback: "Self-approval attempt",
            confidence: 2,
            verificationMethod: 1,
            reviewNotesCID: ""
        });

        AttestationRequest memory request = AttestationRequest({
            schema: workApprovalSchemaUID,
            data: AttestationRequestData({
                recipient: gardenAccount,
                expirationTime: 0,
                revocable: false,
                refUID: workAttUID,
                data: abi.encode(approval),
                value: 0
            })
        });

        vm.prank(forkGardener);
        vm.expectRevert(NotGardenOperator.selector);
        IEASFork(_eas()).attest(request);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 6: Assessment (Valid Evaluator)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Assessment attestation succeeds when submitted by a valid evaluator
    function test_fork_assessment_succeedsWithValidEvaluator() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }
        _deployFullStackOnFork();

        // Mint garden and grant evaluator role
        address gardenAccount = _mintTestGarden("Assessment Garden", 0x0F);
        _grantGardenRole(gardenAccount, forkEvaluator, IHatsModule.GardenRole.Evaluator);

        AssessmentSchema memory assessment = AssessmentSchema({
            title: "Soil Quality Assessment",
            description: "Measuring soil health post-intervention",
            assessmentConfigCID: "QmTestConfig123",
            domain: 0, // SOLAR
            startDate: block.timestamp,
            endDate: block.timestamp + 30 days,
            location: "Fork Test Location"
        });

        AttestationRequest memory request = AttestationRequest({
            schema: assessmentSchemaUID,
            data: AttestationRequestData({
                recipient: gardenAccount,
                expirationTime: 0,
                revocable: false,
                refUID: bytes32(0),
                data: abi.encode(assessment),
                value: 0
            })
        });

        vm.prank(forkEvaluator);
        bytes32 assessmentUID = IEASFork(_eas()).attest(request);
        assertTrue(assessmentUID != bytes32(0), "Assessment UID should be non-zero");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 7: Assessment (Invalid Domain Reverts)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Assessment with invalid domain (> 3) reverts
    function test_fork_assessment_revertsForInvalidDomain() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }
        _deployFullStackOnFork();

        address gardenAccount = _mintTestGarden("Domain Test Garden", 0x0F);
        _grantGardenRole(gardenAccount, forkEvaluator, IHatsModule.GardenRole.Evaluator);

        AssessmentSchema memory assessment = AssessmentSchema({
            title: "Invalid Domain Assessment",
            description: "Testing domain boundary",
            assessmentConfigCID: "QmTestConfig",
            domain: 4, // Invalid: valid range is 0-3
            startDate: block.timestamp,
            endDate: block.timestamp + 30 days,
            location: "Test"
        });

        AttestationRequest memory request = AttestationRequest({
            schema: assessmentSchemaUID,
            data: AttestationRequestData({
                recipient: gardenAccount,
                expirationTime: 0,
                revocable: false,
                refUID: bytes32(0),
                data: abi.encode(assessment),
                value: 0
            })
        });

        vm.prank(forkEvaluator);
        vm.expectRevert(abi.encodeWithSelector(InvalidDomain.selector, uint8(4)));
        IEASFork(_eas()).attest(request);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 8: Work Revocation (Non-Revocable)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Work attestation cannot be revoked (WorkResolver.onRevoke returns false)
    function test_fork_workRevocation_workIsNonRevocable() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }
        _deployFullStackOnFork();

        (address gardenAccount, uint256 actionUID) = _setupGardenWithAction();

        // Submit work
        bytes32 workAttUID = _submitWork(forkGardener, gardenAccount, actionUID);
        assertTrue(workAttUID != bytes32(0), "Work attestation should succeed");

        // Attempt revocation - WorkResolver.onRevoke() returns false so EAS should revert
        RevocationRequest memory revRequest =
            RevocationRequest({ schema: workSchemaUID, data: RevocationRequestData({ uid: workAttUID, value: 0 }) });

        vm.prank(forkGardener);
        (bool revokeOk,) = _eas().call(abi.encodeWithSelector(IEASFork.revoke.selector, revRequest));
        assertFalse(revokeOk, "revocation should fail for non-revocable work schema");
    }
}
