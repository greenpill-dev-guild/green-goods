// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingCommonLib } from "./CommonLib.sol";
import { CommitmentPoolingCreditLib } from "./CreditLib.sol";

/// @title CommitmentPoolingWorkCreditLib
/// @notice The Work decision credit effect and the Work-gated automatic-ready flip, shared by the
///         resolver hook (proof) and the steward catch-up (sync).
/// @dev Internal-only: inlined, never deployed. The two callers differ only in how they treat
///      invalid input — the resolver hook must never revert, catch-up must — so validation stays
///      with each caller and only the effect lives here.
library CommitmentPoolingWorkCreditLib {
    /// @notice Records one already-validated effective decision and applies its requirement credit.
    /// @return counted Whether the decision reached a requirement row and could therefore have
    ///         changed readiness. Non-DomainImpact links carry no row and never do.
    // solhint-disable-next-line code-complexity
    function creditWorkDecision(
        mapping(bytes32 workUID => uint64 sequence) storage latestWorkDecisionSequence,
        mapping(bytes32 workUID => bytes32 approvalUID) storage latestWorkDecisionUID,
        mapping(bytes32 approvalUID => bool counted) storage approvalCounted,
        mapping(bytes32 workUID => bool active) storage workCreditActive,
        mapping(bytes32 workUID => uint16 requirementIndexPlusOne) storage workRequirementIndexPlusOne,
        mapping(
            uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record)
        ) storage contributors,
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        bytes32 workUID,
        bytes32 decisionUID,
        uint64 decisionSequence,
        bool approved,
        address attester
    )
        internal
        returns (bool counted)
    {
        latestWorkDecisionSequence[workUID] = decisionSequence;
        latestWorkDecisionUID[workUID] = decisionUID;
        approvalCounted[decisionUID] = true;

        uint16 indexPlusOne = workRequirementIndexPlusOne[workUID];
        if (indexPlusOne == 0) return false;
        uint16 requirementIndex = indexPlusOne - 1;
        ICommitmentPoolingModule.ContributorRecord storage record = contributors[commitmentId][attester];
        ICommitmentPoolingModule.CommitmentRequirement storage requirement = commitment.requirements[requirementIndex];
        uint256 unitsBefore = CommitmentPoolingCreditLib.approvedUnits(commitment);

        if (approved && !workCreditActive[workUID]) {
            bool hadCredit = record.approvedWorkCredits != 0 || record.evidenceCredits != 0;
            workCreditActive[workUID] = true;
            requirement.approvedCount++;
            record.approvedWorkCredits++;
            if (record.uncountedLinkedWorkCount != 0) record.uncountedLinkedWorkCount--;
            commitment.totalVerifiedCredits++;
            if (!hadCredit) commitment.eligibleContributorCount++;
            uint256 unitsAfter = CommitmentPoolingCreditLib.approvedUnits(commitment);
            emit ICommitmentPoolingModule.ApprovedWorkCounted(
                commitmentId,
                workUID,
                attester,
                decisionUID,
                decisionSequence,
                requirementIndex,
                requirement.approvedCount,
                unitsAfter,
                unitsAfter - unitsBefore
            );
        } else if (!approved && workCreditActive[workUID]) {
            workCreditActive[workUID] = false;
            requirement.approvedCount--;
            record.approvedWorkCredits--;
            record.uncountedLinkedWorkCount++;
            commitment.totalVerifiedCredits--;
            if (record.approvedWorkCredits == 0 && record.evidenceCredits == 0) {
                commitment.eligibleContributorCount--;
            }
            uint256 unitsAfter = CommitmentPoolingCreditLib.approvedUnits(commitment);
            emit ICommitmentPoolingModule.ApprovedWorkReversed(
                commitmentId,
                workUID,
                attester,
                decisionUID,
                decisionSequence,
                requirementIndex,
                requirement.approvedCount,
                unitsAfter,
                unitsBefore - unitsAfter
            );
        }
        return true;
    }

    /// @dev The Work-gated auto-flip shared by assessment attachment, the resolver hook, and the
    ///      steward catch-up. `freezeAndReady` still owns every freeze precondition.
    function evaluateAutomaticReady(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 cycleId => ICommitmentPoolingModule.Cycle cycle) storage cycles,
        mapping(uint256 commitmentId => bytes32[] activeWorkUIDs) storage commitmentWorkUIDs,
        mapping(bytes32 workUID => uint64 sequence) storage latestWorkDecisionSequence,
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        mapping(
            uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record)
        ) storage contributors,
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment
    )
        internal
    {
        if (
            CommitmentPoolingCreditLib.requirementsComplete(commitment)
                && (!commitment.requiresAssessment || commitment.assessmentUID != bytes32(0))
        ) {
            CommitmentPoolingCreditLib.freezeAndReady(
                env,
                cycles,
                commitmentWorkUIDs,
                latestWorkDecisionSequence,
                commitmentConfirmers,
                contributors,
                commitmentId,
                commitment,
                false,
                ""
            );
        }
    }
}
