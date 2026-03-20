// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase, IEASBase } from "./helpers/ForkTestBase.sol";
import { GardenToken } from "../../src/tokens/Garden.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { IGardensModule } from "../../src/interfaces/IGardensModule.sol";
import { WorkSchema, WorkApprovalSchema, AssessmentSchema } from "../../src/Schemas.sol";
import { ActionRegistry, Capital, Domain } from "../../src/registries/Action.sol";
import { NotActiveAction } from "../../src/resolvers/Work.sol";
import { NotInWorkRegistry } from "../../src/resolvers/WorkApproval.sol";
import { NotAuthorizedAttester, InvalidDomain } from "../../src/resolvers/Assessment.sol";
import { AttestationRequest, AttestationRequestData } from "@eas/IEAS.sol";

/// @title SepoliaNegativePathsForkTest
/// @notice Fork tests exercising error paths on Sepolia (11155111). Each test deploys the full
///         protocol stack against real EAS and verifies that invalid operations revert cleanly.
/// @dev Uses `test_fork_` prefix for Sepolia fork tests. All tests gracefully skip
///      when SEPOLIA_RPC_URL is not configured.
contract SepoliaNegativePathsForkTest is ForkTestBase {
    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: EAS — Work submission with disabled action reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Work attestation reverts when action endTime has passed
    function test_fork_eas_workWithDisabledAction_reverts() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();

        (address garden, uint256 actionUID) = _setupGardenWithRolesAndAction("Sepolia Disabled Action");

        // Fast-forward past the action's endTime (90 days from registration)
        vm.warp(block.timestamp + 91 days);

        // Work submission after action expired should revert through the WorkResolver
        string[] memory media = new string[](1);
        media[0] = "ipfs://QmExpiredTest";

        WorkSchema memory work = WorkSchema({
            actionUID: actionUID,
            title: "Expired Action Work",
            feedback: "Should fail",
            metadata: "ipfs://QmExpiredActionMeta",
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
                data: abi.encode(work.actionUID, work.title, work.feedback, work.metadata, work.media),
                value: 0
            })
        });

        vm.prank(forkGardener);
        vm.expectRevert(NotActiveAction.selector);
        IEASBase(eas).attest(request);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: EAS — Approval without prior work attestation reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Work approval referencing a non-existent work UID reverts
    function test_fork_eas_approvalWithoutPriorWork_reverts() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();

        (address garden, uint256 actionUID) = _setupGardenWithRolesAndAction("Sepolia No Work");

        // Fabricate a non-existent work UID
        bytes32 fakeWorkUID = bytes32(uint256(0xDEAD));

        WorkApprovalSchema memory approval = WorkApprovalSchema({
            actionUID: actionUID,
            workUID: fakeWorkUID,
            approved: true,
            feedback: "Approving nonexistent work",
            confidence: 2,
            verificationMethod: 1,
            reviewNotesCID: ""
        });

        (address eas,) = _getEASForChain(block.chainid);

        AttestationRequest memory request = AttestationRequest({
            schema: workApprovalSchemaUID,
            data: AttestationRequestData({
                recipient: garden,
                expirationTime: 0,
                revocable: false,
                refUID: fakeWorkUID,
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

        vm.prank(forkOperator);
        vm.expectRevert(NotInWorkRegistry.selector);
        IEASBase(eas).attest(request);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: EAS — Assessment with invalid domain (>3) reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Assessment attestation with domain > 3 reverts
    function test_fork_eas_assessmentWithInvalidDomain_reverts() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();

        (address garden,) = _setupGardenWithRolesAndAction("Sepolia Invalid Domain");

        // Domain 4 is out of range (valid: 0=SOLAR, 1=AGRO, 2=EDU, 3=WASTE)
        AssessmentSchema memory assessment = AssessmentSchema({
            title: "Bad Domain Assessment",
            description: "Domain out of range",
            assessmentConfigCID: "ipfs://QmBadDomain",
            domain: 4,
            startDate: block.timestamp,
            endDate: block.timestamp + 30 days,
            location: "Test Site"
        });

        (address eas,) = _getEASForChain(block.chainid);

        AttestationRequest memory request = AttestationRequest({
            schema: assessmentSchemaUID,
            data: AttestationRequestData({
                recipient: garden,
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
        IEASBase(eas).attest(request);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: EAS — Assessment by gardener (wrong role) reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Gardener cannot submit assessments (evaluator role required)
    function test_fork_eas_assessmentByGardener_reverts() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();

        (address garden,) = _setupGardenWithRolesAndAction("Sepolia Wrong Role");

        AssessmentSchema memory assessment = AssessmentSchema({
            title: "Gardener Assessment",
            description: "Should be rejected",
            assessmentConfigCID: "ipfs://QmWrongRole",
            domain: 1,
            startDate: block.timestamp,
            endDate: block.timestamp + 30 days,
            location: "Test Site"
        });

        (address eas,) = _getEASForChain(block.chainid);

        AttestationRequest memory request = AttestationRequest({
            schema: assessmentSchemaUID,
            data: AttestationRequestData({
                recipient: garden,
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

        // forkGardener has Gardener role, not Evaluator — assessment should revert
        vm.prank(forkGardener);
        vm.expectRevert(NotAuthorizedAttester.selector);
        IEASBase(eas).attest(request);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 5: ENS — Duplicate garden slug reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Registering the same slug twice reverts with NameTaken
    function test_fork_ens_duplicateGardenSlug_reverts() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();

        // Skip if ENS module was not deployed (zero address on some chains)
        if (address(greenGoodsENS) == address(0)) {
            return;
        }

        // First registration should succeed (via authorized caller)
        address mockGarden1 = makeAddr("garden1");
        greenGoodsENS.registerGarden{ value: 1 ether }("test-garden-slug", mockGarden1);

        // Second registration with the same slug should revert with NameTaken
        address mockGarden2 = makeAddr("garden2");
        vm.expectRevert(NameTaken.selector);
        greenGoodsENS.registerGarden{ value: 1 ether }("test-garden-slug", mockGarden2);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 6: ENS — Non-member claimName reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Non-protocol member cannot claim an ENS name
    function test_fork_ens_nonMemberClaimName_reverts() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();

        // Skip if ENS module was not deployed
        if (address(greenGoodsENS) == address(0)) {
            return;
        }

        // forkNonMember does not wear the protocol hat — should revert
        vm.prank(forkNonMember);
        vm.expectRevert(NotProtocolMember.selector);
        greenGoodsENS.claimName{ value: 1 ether }("non-member-slug");
    }
}

// Re-declare file-level errors from ENS.sol so test can reference selectors
import { NameTaken, NotProtocolMember } from "../../src/registries/ENS.sol";
