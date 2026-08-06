// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Vm } from "forge-std/Vm.sol";

import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingFixture } from "../helpers/CommitmentPoolingFixture.sol";

/// @title CommitmentPoolingRosterTest
/// @notice Contributor roster entry, exit, removal, and requirement assignment for PRD-721.
contract CommitmentPoolingRosterTest is CommitmentPoolingFixture {
    address private constant JOINER = address(0xC01);

    function setUp() public {
        _setUpProductionFixture();
        _setMember(JOINER);
    }

    // ─────────────────────────────── Join ───────────────────────────────

    function testOpenPolicySelfJoinAddsAnEligibleGardenMember() public {
        uint256 commitmentId = _openPolicyOffer(keccak256("roster-join"));

        vm.prank(JOINER);
        module.joinCommitment(commitmentId);

        assertTrue(module.isContributor(commitmentId, JOINER));
        assertEq(module.getCommitment(commitmentId).contributorCount, 2);
    }

    function testSelfJoinRejectsLeadManagedRostersAndNonMembers() public {
        uint256 leadManaged = _createOffer(keccak256("roster-join-lead-managed"));
        _acceptOffer(leadManaged);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.ContributorPolicyMismatch.selector, leadManaged));
        vm.prank(JOINER);
        module.joinCommitment(leadManaged);

        uint256 open = _openPolicyOffer(keccak256("roster-join-non-member"));
        address stranger = address(0xBAD);
        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.NotEligibleContributor.selector, stranger));
        vm.prank(stranger);
        module.joinCommitment(open);
    }

    // ─────────────────────────────── Leave ───────────────────────────────

    function testSelfExitIsBlockedForTheLeadAndForAnyCreditedContributor() public {
        uint256 commitmentId = _openPolicyOffer(keccak256("roster-leave"));
        vm.prank(JOINER);
        module.joinCommitment(commitmentId);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.LeadContributorCannotLeave.selector, commitmentId));
        vm.prank(CREATOR);
        module.leaveCommitment(commitmentId);

        address[] memory credited = new address[](1);
        credited[0] = JOINER;
        vm.prank(CREATOR);
        module.attachEvidence(commitmentId, "bafy-roster-credit", credited);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.ContributorHasCredit.selector, JOINER));
        vm.prank(JOINER);
        module.leaveCommitment(commitmentId);
    }

    function testUncreditedContributorLeavesAndFreesTheirSeat() public {
        uint256 commitmentId = _openPolicyOffer(keccak256("roster-leave-clean"));
        vm.prank(JOINER);
        module.joinCommitment(commitmentId);
        assertEq(module.getCommitment(commitmentId).contributorCount, 2);

        vm.prank(JOINER);
        module.leaveCommitment(commitmentId);

        assertFalse(module.isContributor(commitmentId, JOINER));
        assertEq(module.getCommitment(commitmentId).contributorCount, 1);
    }

    // ────────────────────────────── Removal ──────────────────────────────

    function testLeadManagedRemovalRejectsOpenRostersTheLeadAndCreditedMembers() public {
        uint256 open = _openPolicyOffer(keccak256("roster-remove-open"));
        vm.prank(JOINER);
        module.joinCommitment(open);

        // Open rosters can never expel.
        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.ContributorPolicyMismatch.selector, open));
        vm.prank(CREATOR);
        module.removeContributor(open, JOINER);

        uint256 managed = _createOffer(keccak256("roster-remove-managed"));
        _acceptOffer(managed);
        vm.prank(CREATOR);
        module.addContributor(managed, JOINER);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.LeadContributorCannotLeave.selector, managed));
        vm.prank(CREATOR);
        module.removeContributor(managed, CREATOR);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.UnauthorizedCaller.selector, address(0xBAD)));
        vm.prank(address(0xBAD));
        module.removeContributor(managed, JOINER);

        vm.prank(CREATOR);
        module.removeContributor(managed, JOINER);
        assertFalse(module.isContributor(managed, JOINER));
    }

    // ──────────────────────── Requirement assignment ────────────────────────

    function testRequirementAssignmentIsBoundedActiveAndIdempotent() public {
        uint256 commitmentId = _domainImpactOffer(keccak256("roster-requirement"));
        _acceptOffer(commitmentId);
        vm.prank(CREATOR);
        module.addContributor(commitmentId, JOINER);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.InvalidRequirementCount.selector, uint256(5)));
        vm.prank(CREATOR);
        module.setContributorRequirement(commitmentId, JOINER, 5, true);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.ContributorNotActive.selector, address(0xBAD)));
        vm.prank(CREATOR);
        module.setContributorRequirement(commitmentId, address(0xBAD), 0, true);

        vm.prank(CREATOR);
        module.setContributorRequirement(commitmentId, JOINER, 0, true);

        // Re-asserting the same assignment writes nothing and emits nothing.
        vm.recordLogs();
        vm.prank(CREATOR);
        module.setContributorRequirement(commitmentId, JOINER, 0, true);
        assertEq(vm.getRecordedLogs().length, 0);
    }

    // ───────────────────────────── Helpers ─────────────────────────────

    function _openPolicyOffer(bytes32 creationKey) private returns (uint256 commitmentId) {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(creationKey);
        params.contributorPolicy = ICommitmentPoolingModule.ContributorPolicy.Open;
        vm.prank(CREATOR);
        commitmentId = module.createCommitment(params);
        _acceptOffer(commitmentId);
    }

    function _domainImpactOffer(bytes32 creationKey) private returns (uint256 commitmentId) {
        _registerActions(1);
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(creationKey);
        params.commitmentType = ICommitmentPoolingModule.CommitmentType.DomainImpact;
        params.requirements = new ICommitmentPoolingModule.CommitmentRequirementInput[](1);
        params.requirements[0] = ICommitmentPoolingModule.CommitmentRequirementInput({ actionUID: 0, requiredCount: 1 });
        vm.prank(CREATOR);
        commitmentId = module.createCommitment(params);
    }
}
