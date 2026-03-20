// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase } from "../helpers/ForkTestBase.sol";
import { ISchemaRegistry } from "../../helpers/DeploymentBase.sol";
import { WorkSchema, WorkApprovalSchema, AssessmentSchema } from "../../../src/Schemas.sol";
import { IHatsModule } from "../../../src/interfaces/IHatsModule.sol";
import { NotGardenMember } from "../../../src/resolvers/Work.sol";
import { NotGardenOperator } from "../../../src/resolvers/WorkApproval.sol";
import { NotAuthorizedAttester, InvalidDomain } from "../../../src/resolvers/Assessment.sol";
import { AttestationRequest, AttestationRequestData, RevocationRequest, RevocationRequestData } from "@eas/IEAS.sol";

/// @notice Minimal EAS interface for fork tests (avoids IEAS naming conflict with DeploymentBase)
interface IEASForkArb {
    function attest(AttestationRequest calldata request) external payable returns (bytes32);
    function revoke(RevocationRequest calldata request) external payable;
}

/// @title ArbitrumEASAttestationLifecycleForkTest
/// @notice Fork tests validating the full EAS attestation lifecycle against real EAS on Arbitrum (42161).
/// @dev Mirrors EASAttestationLifecycle.t.sol structure. Uses `testForkArbitrum_` prefix for the
/// `test:e2e:arbitrum` script. Tests 1-8 mirror Sepolia suite; tests 9-10 are new error paths.
contract ArbitrumEASAttestationLifecycleForkTest is ForkTestBase {
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

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Schema Registration
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verify schemas are registered with the real Arbitrum SchemaRegistry (0xA310d...)
    function testForkArbitrum_schemaRegistration_registersWithRealSchemaRegistry() public {
        if (!_tryChainFork("arbitrum")) {
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

    /// @notice Work attestation succeeds when submitted by a valid gardener on Arbitrum
    function testForkArbitrum_workAttestation_succeedsWithValidGardener() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }
        _deployFullStackOnFork();

        (address gardenAccount, uint256 actionUID) = _setupGardenWithRolesAndAction("Arb Work Garden");

        bytes32 attestationUID = _submitWorkAttestation(forkGardener, gardenAccount, actionUID);
        assertTrue(attestationUID != bytes32(0), "Work attestation UID should be non-zero");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Work Attestation (Non-Member Reverts)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Work attestation reverts when submitted by a non-member on Arbitrum
    function testForkArbitrum_workAttestation_revertsForNonMember() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }
        _deployFullStackOnFork();

        (address gardenAccount, uint256 actionUID) = _setupGardenWithRolesAndAction("Arb NonMember Garden");

        WorkSchema memory work = WorkSchema({
            actionUID: actionUID,
            title: "Unauthorized Work",
            feedback: "",
            metadata: "ipfs://QmUnauthorizedWorkMeta",
            media: new string[](0)
        });

        AttestationRequest memory request = AttestationRequest({
            schema: workSchemaUID,
            data: AttestationRequestData({
                recipient: gardenAccount,
                expirationTime: 0,
                revocable: false,
                refUID: bytes32(0),
                data: abi.encode(work.actionUID, work.title, work.feedback, work.metadata, work.media),
                value: 0
            })
        });

        vm.prank(forkNonMember);
        vm.expectRevert(NotGardenMember.selector);
        IEASForkArb(_eas()).attest(request);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Work Approval (Valid Operator)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Work approval succeeds when submitted by a valid operator on Arbitrum
    function testForkArbitrum_workApproval_succeedsWithValidOperator() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }
        _deployFullStackOnFork();

        (address gardenAccount, uint256 actionUID) = _setupGardenWithRolesAndAction("Arb Approval Garden");

        bytes32 workAttUID = _submitWorkAttestation(forkGardener, gardenAccount, actionUID);
        assertTrue(workAttUID != bytes32(0), "Work attestation should succeed");

        bytes32 approvalUID = _submitWorkApproval(forkOperator, gardenAccount, actionUID, workAttUID);
        assertTrue(approvalUID != bytes32(0), "Work approval UID should be non-zero");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 5: Work Approval (Non-Operator Reverts)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Work approval reverts when submitted by a gardener (not operator) on Arbitrum
    function testForkArbitrum_workApproval_revertsForNonOperator() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }
        _deployFullStackOnFork();

        (address gardenAccount, uint256 actionUID) = _setupGardenWithRolesAndAction("Arb SelfApproval Garden");

        bytes32 workAttUID = _submitWorkAttestation(forkGardener, gardenAccount, actionUID);

        // Gardener tries to approve their own work (should fail)
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
                data: abi.encode(
                    approval.actionUID,
                    approval.workUID,
                    approval.approved,
                    approval.feedback,
                    approval.confidence,
                    approval.verificationMethod,
                    approval.reviewNotesCID
                ),
                value: 0
            })
        });

        vm.prank(forkGardener);
        vm.expectRevert(NotGardenOperator.selector);
        IEASForkArb(_eas()).attest(request);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 6: Assessment (Valid Evaluator)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Assessment attestation succeeds when submitted by a valid evaluator on Arbitrum
    function testForkArbitrum_assessment_succeedsWithValidEvaluator() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }
        _deployFullStackOnFork();

        address gardenAccount = _mintTestGarden("Arb Assessment Garden", 0x0F);
        _grantGardenRole(gardenAccount, forkEvaluator, IHatsModule.GardenRole.Evaluator);

        bytes32 assessmentUID = _submitAssessment(forkEvaluator, gardenAccount, 0); // SOLAR domain
        assertTrue(assessmentUID != bytes32(0), "Assessment UID should be non-zero");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 7: Assessment (Invalid Domain Reverts)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Assessment with invalid domain (> 3) reverts on Arbitrum
    function testForkArbitrum_assessment_revertsForInvalidDomain() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }
        _deployFullStackOnFork();

        address gardenAccount = _mintTestGarden("Arb Domain Garden", 0x0F);
        _grantGardenRole(gardenAccount, forkEvaluator, IHatsModule.GardenRole.Evaluator);

        AssessmentSchema memory assessment = AssessmentSchema({
            title: "Invalid Domain",
            description: "Testing domain boundary on Arbitrum",
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
                data: abi.encode(
                    assessment.title,
                    assessment.description,
                    assessment.assessmentConfigCID,
                    assessment.domain,
                    assessment.startDate,
                    assessment.endDate,
                    assessment.location
                ),
                value: 0
            })
        });

        vm.prank(forkEvaluator);
        vm.expectRevert(abi.encodeWithSelector(InvalidDomain.selector, uint8(4)));
        IEASForkArb(_eas()).attest(request);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 8: Work Revocation (Non-Revocable)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Work attestation cannot be revoked on Arbitrum
    function testForkArbitrum_workRevocation_workIsNonRevocable() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }
        _deployFullStackOnFork();

        (address gardenAccount, uint256 actionUID) = _setupGardenWithRolesAndAction("Arb Revoke Garden");

        bytes32 workAttUID = _submitWorkAttestation(forkGardener, gardenAccount, actionUID);
        assertTrue(workAttUID != bytes32(0), "Work attestation should succeed");

        // Attempt revocation — WorkResolver.onRevoke() returns false so EAS should revert
        RevocationRequest memory revRequest =
            RevocationRequest({ schema: workSchemaUID, data: RevocationRequestData({ uid: workAttUID, value: 0 }) });

        vm.prank(forkGardener);
        (bool revokeOk,) = _eas().call(abi.encodeWithSelector(IEASForkArb.revoke.selector, revRequest));
        assertFalse(revokeOk, "revocation should fail for non-revocable work schema");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 9: Assessment Reverts for Non-Evaluator (NEW Error Path)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Non-member submitting assessment reverts on Arbitrum
    function testForkArbitrum_assessment_revertsForNonEvaluator() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }
        _deployFullStackOnFork();

        (address gardenAccount,) = _setupGardenWithRolesAndAction("Arb NonEval Garden");

        // forkNonMember has no evaluator privileges in this garden
        AssessmentSchema memory assessment = AssessmentSchema({
            title: "Unauthorized Assessment",
            description: "Non-member attempting evaluator action",
            assessmentConfigCID: "QmTestConfig",
            domain: 1, // AGRO
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
                data: abi.encode(
                    assessment.title,
                    assessment.description,
                    assessment.assessmentConfigCID,
                    assessment.domain,
                    assessment.startDate,
                    assessment.endDate,
                    assessment.location
                ),
                value: 0
            })
        });

        vm.prank(forkNonMember);
        vm.expectRevert(NotAuthorizedAttester.selector);
        IEASForkArb(_eas()).attest(request);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 10: Work Attestation for Wrong Garden (NEW Error Path)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Gardener of garden A submitting work to garden B reverts on Arbitrum
    function testForkArbitrum_workAttestation_revertsForWrongGarden() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }
        _deployFullStackOnFork();

        // Garden A: forkGardener is a member
        (, uint256 actionUID) = _setupGardenWithRolesAndAction("Arb Garden A");

        // Garden B: forkGardener has NO role here
        address gardenB = _mintTestGarden("Arb Garden B", 0x0F);

        // forkGardener (garden A member) tries to submit work to garden B → should revert
        WorkSchema memory work = WorkSchema({
            actionUID: actionUID,
            title: "Wrong Garden Work",
            feedback: "",
            metadata: "ipfs://QmWrongGardenMeta",
            media: new string[](0)
        });

        AttestationRequest memory request = AttestationRequest({
            schema: workSchemaUID,
            data: AttestationRequestData({
                recipient: gardenB, // targeting garden B, not garden A
                expirationTime: 0,
                revocable: false,
                refUID: bytes32(0),
                data: abi.encode(work.actionUID, work.title, work.feedback, work.metadata, work.media),
                value: 0
            })
        });

        vm.prank(forkGardener); // member of garden A, not garden B
        vm.expectRevert(NotGardenMember.selector);
        IEASForkArb(_eas()).attest(request);
    }
}
