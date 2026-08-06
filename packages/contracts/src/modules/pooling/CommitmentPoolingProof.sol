// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS, Attestation } from "@eas/IEAS.sol";

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentRegistry } from "../../interfaces/ICommitmentRegistry.sol";
import { IHatsModule } from "../../interfaces/IHatsModule.sol";
import { ActionRegistry } from "../../registries/Action.sol";
import { CommitmentPoolingConfirmation, IWorkDecisionSequenceResolver } from "./CommitmentPoolingConfirmation.sol";

/// @title CommitmentPoolingProof
/// @notice Evidence, assessment, and Work decision credit.
abstract contract CommitmentPoolingProof is CommitmentPoolingConfirmation {
    // solhint-disable-next-line code-complexity
    function attachEvidence(
        uint256 commitmentId,
        string calldata cid,
        address[] calldata creditedContributors
    )
        external
        whenOperational
    {
        ICommitmentPoolingModule.Commitment storage commitment = _requireAcceptedUnfrozen(commitmentId);
        if (!_canEditProof(commitmentId, commitment, msg.sender)) {
            revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        }
        if (bytes(cid).length == 0) revert ICommitmentPoolingModule.EvidenceCIDRequired();
        uint256 length = creditedContributors.length;
        if (length == 0) revert ICommitmentPoolingModule.EvidenceContributorsRequired();
        if (length > MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT_VALUE) {
            revert ICommitmentPoolingModule.TooManyEvidenceContributors(
                length, MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT_VALUE
            );
        }
        bytes32 cidHash = keccak256(bytes(cid));
        if (evidenceAttached[commitmentId][cidHash]) {
            revert ICommitmentPoolingModule.EvidenceAlreadyAttached(commitmentId, cidHash);
        }
        for (uint256 i = 0; i < length; i++) {
            address contributor = creditedContributors[i];
            if (!contributors[commitmentId][contributor].active) {
                revert ICommitmentPoolingModule.ContributorNotActive(contributor);
            }
            for (uint256 j = 0; j < i; j++) {
                if (creditedContributors[j] == contributor) {
                    revert ICommitmentPoolingModule.ContributorAlreadyActive(contributor);
                }
            }
        }

        evidenceAttached[commitmentId][cidHash] = true;
        commitment.evidenceCount++;
        for (uint256 i = 0; i < length; i++) {
            ICommitmentPoolingModule.ContributorRecord storage record = contributors[commitmentId][creditedContributors[i]];
            if (record.evidenceCredits == 0) {
                bool hadCredit = record.approvedWorkCredits != 0;
                record.evidenceCredits = 1;
                commitment.totalVerifiedCredits++;
                if (!hadCredit) commitment.eligibleContributorCount++;
            }
        }
        emit ICommitmentPoolingModule.EvidenceAttached(commitmentId, cid, msg.sender, creditedContributors);
    }

    function attachAssessment(uint256 commitmentId, bytes32 assessmentUID) external whenOperational {
        ICommitmentPoolingModule.Commitment storage commitment = _requireAcceptedUnfrozen(commitmentId);
        if (commitment.assessmentUID != bytes32(0)) {
            revert ICommitmentPoolingModule.AssessmentAlreadyAttached(commitmentId, commitment.assessmentUID);
        }
        ICommitmentPoolingModule.Pool storage pool = pools[commitment.poolId];
        if (!_isPoolSteward(commitment.poolId, msg.sender) && !hatsModule.isEvaluatorOf(pool.garden, msg.sender)) {
            revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        }
        Attestation memory attestation = eas.getAttestation(assessmentUID);
        if (
            attestation.uid != assessmentUID
                || (attestation.schema != legacyAssessmentSchemaUID && attestation.schema != assessmentV3SchemaUID)
                || attestation.recipient != commitment.providerGarden || attestation.revocationTime != 0
        ) revert ICommitmentPoolingModule.InvalidAssessmentAttestation(assessmentUID);
        commitment.assessmentUID = assessmentUID;
        emit ICommitmentPoolingModule.AssessmentAttached(commitmentId, assessmentUID, msg.sender);
        _evaluateAutomaticReady(commitmentId, commitment);
    }

    // solhint-disable-next-line code-complexity
    function linkWork(
        uint256 commitmentId,
        bytes32 workUID,
        uint16 requirementIndex,
        bytes32 operationKey
    )
        external
        whenOperational
    {
        if (operationKey == bytes32(0)) revert ICommitmentPoolingModule.InvalidWorkLinkOperationKey();
        bytes32 payloadHash = keccak256(abi.encode(commitmentId, workUID, requirementIndex));
        bytes32 priorPayloadHash = workLinkPayloadHashByOperation[msg.sender][operationKey];
        if (priorPayloadHash != bytes32(0)) {
            if (priorPayloadHash != payloadHash) revert ICommitmentPoolingModule.WorkLinkOperationConflict(operationKey);
            return;
        }
        ICommitmentPoolingModule.Commitment storage commitment = _requireAcceptedUnfrozen(commitmentId);
        if (!_canEditProof(commitmentId, commitment, msg.sender)) {
            revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        }
        if (workCommitment[workUID] != 0) revert ICommitmentPoolingModule.WorkAlreadyLinked(workUID);
        uint256 nextLength = commitmentWorkUIDs[commitmentId].length + 1;
        if (nextLength > MAX_LINKED_WORKS_PER_COMMITMENT_VALUE) {
            revert ICommitmentPoolingModule.TooManyLinkedWorks(nextLength, MAX_LINKED_WORKS_PER_COMMITMENT_VALUE);
        }

        Attestation memory attestation = eas.getAttestation(workUID);
        if (
            attestation.uid != workUID || attestation.schema != workSchemaUID || attestation.revocationTime != 0
                || attestation.recipient != commitment.providerGarden
        ) revert ICommitmentPoolingModule.InvalidWorkAttestation(workUID);
        if (!contributors[commitmentId][attestation.attester].active) {
            revert ICommitmentPoolingModule.ContributorNotActive(attestation.attester);
        }
        if (!_isGardenMember(commitment.providerGarden, attestation.attester)) {
            revert ICommitmentPoolingModule.NotEligibleContributor(attestation.attester);
        }

        (uint256 actionUID,,,,) = abi.decode(attestation.data, (uint256, string, string, string, string[]));
        if (commitment.commitmentType == ICommitmentPoolingModule.CommitmentType.DomainImpact) {
            if (requirementIndex >= commitment.requirements.length) {
                revert ICommitmentPoolingModule.WorkActionMismatch(actionUID);
            }
            if (commitment.requirements[requirementIndex].actionUID != actionUID) {
                revert ICommitmentPoolingModule.WorkActionMismatch(actionUID);
            }
            workRequirementIndexPlusOne[workUID] = requirementIndex + 1;
        }

        workLinkPayloadHashByOperation[msg.sender][operationKey] = payloadHash;
        workCommitment[workUID] = commitmentId;
        commitmentWorkUIDs[commitmentId].push(workUID);
        contributors[commitmentId][attestation.attester].uncountedLinkedWorkCount++;
        emit ICommitmentPoolingModule.WorkLinked(
            commitmentId, workUID, attestation.attester, requirementIndex, msg.sender, operationKey
        );
    }

    // solhint-disable-next-line code-complexity
    function onWorkDecision(
        bytes32 workUID,
        bytes32 approvalUID,
        uint64 decisionSequence,
        address garden,
        bool approved
    )
        external
    {
        if (msg.sender != workApprovalResolver) revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        uint256 commitmentId = workCommitment[workUID];
        if (commitmentId == 0) return;
        ICommitmentPoolingModule.Commitment storage commitment = commitments[commitmentId];
        if (commitment.state != ICommitmentPoolingModule.CommitmentState.Accepted || commitment.contributorsFrozen) {
            return;
        }
        if (garden != commitment.providerGarden || decisionSequence <= latestWorkDecisionSequence[workUID]) return;
        if (IWorkDecisionSequenceResolver(workApprovalResolver).latestDecisionSequence(workUID) != decisionSequence) return;

        Attestation memory decision = eas.getAttestation(approvalUID);
        if (
            decision.uid != approvalUID || decision.schema != workApprovalSchemaUID || decision.revocationTime != 0
                || decision.recipient != garden
        ) return;
        (uint256 actionUID, bytes32 decodedWorkUID, bool decodedApproved,,,,) =
            abi.decode(decision.data, (uint256, bytes32, bool, string, uint8, uint8, string));
        if (decodedWorkUID != workUID || decodedApproved != approved) return;

        Attestation memory work = eas.getAttestation(workUID);
        if (work.uid != workUID || work.schema != workSchemaUID || work.recipient != garden) return;
        (uint256 workActionUID,,,,) = abi.decode(work.data, (uint256, string, string, string, string[]));
        if (workActionUID != actionUID) return;

        if (!_creditWorkDecision(commitmentId, commitment, workUID, approvalUID, decisionSequence, approved, work.attester))
        {
            return;
        }
        _evaluateAutomaticReady(commitmentId, commitment);
    }

    // ═════════════════════════════ Internal ═════════════════════════════

    /// @notice Records one already-validated effective decision and applies its requirement credit.
    /// @dev Shared with the steward catch-up in CommitmentPoolingSync. The two callers differ only
    ///      in how they treat invalid input — the resolver hook must never revert, catch-up must —
    ///      so validation stays with each caller and only the effect lives here.
    /// @return counted Whether the decision reached a requirement row and could therefore have
    ///         changed readiness. Non-DomainImpact links carry no row and never do.
    // solhint-disable-next-line code-complexity
    function _creditWorkDecision(
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
        uint256 unitsBefore = _approvedUnits(commitment);

        if (approved && !workCreditActive[workUID]) {
            bool hadCredit = record.approvedWorkCredits != 0 || record.evidenceCredits != 0;
            workCreditActive[workUID] = true;
            requirement.approvedCount++;
            record.approvedWorkCredits++;
            if (record.uncountedLinkedWorkCount != 0) record.uncountedLinkedWorkCount--;
            commitment.totalVerifiedCredits++;
            if (!hadCredit) commitment.eligibleContributorCount++;
            uint256 unitsAfter = _approvedUnits(commitment);
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
            uint256 unitsAfter = _approvedUnits(commitment);
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
    ///      steward catch-up. `_freezeAndReady` still owns every freeze precondition.
    function _evaluateAutomaticReady(
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment
    )
        internal
    {
        if (_requirementsComplete(commitment) && (!commitment.requiresAssessment || commitment.assessmentUID != bytes32(0)))
        {
            _freezeAndReady(commitmentId, commitment, false, "");
        }
    }
}
