// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Attestation } from "@eas/IEAS.sol";

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { IWorkDecisionSequenceResolver } from "../../interfaces/IWorkDecisionSequenceResolver.sol";
import { CommitmentPoolingCommonLib } from "./CommonLib.sol";
import { CommitmentPoolingGuardLib } from "./GuardLib.sol";
import { CommitmentPoolingWorkCreditLib } from "./WorkCreditLib.sol";

/// @title CommitmentPoolingProofLib
/// @notice Deployed behavior library: evidence, assessment, and Work decision credit.
/// @dev Runs via DELEGATECALL from `CommitmentPoolingModule`; `msg.sender`, events, and reverts
///      surface from the proxy unchanged. Semantics track the retired facet bodies exactly.
library CommitmentPoolingProofLib {
    // solhint-disable-next-line code-complexity
    function attachEvidence(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        mapping(
            uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record)
        ) storage contributors,
        mapping(uint256 commitmentId => mapping(bytes32 cidHash => bool attached)) storage evidenceAttached,
        uint256 commitmentId,
        string calldata cid,
        address[] calldata creditedContributors
    )
        external
    {
        ICommitmentPoolingModule.Commitment storage commitment =
            CommitmentPoolingGuardLib.requireAcceptedUnfrozen(commitments, commitmentId);
        if (!CommitmentPoolingGuardLib.canEditProof(env, pools, contributors, commitmentId, commitment, msg.sender)) {
            revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        }
        if (bytes(cid).length == 0) revert ICommitmentPoolingModule.EvidenceCIDRequired();
        uint256 length = creditedContributors.length;
        if (length == 0) revert ICommitmentPoolingModule.EvidenceContributorsRequired();
        if (length > CommitmentPoolingCommonLib.MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT) {
            revert ICommitmentPoolingModule.TooManyEvidenceContributors(
                length, CommitmentPoolingCommonLib.MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT
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

    function attachAssessment(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        mapping(uint256 cycleId => ICommitmentPoolingModule.Cycle cycle) storage cycles,
        mapping(uint256 commitmentId => bytes32[] activeWorkUIDs) storage commitmentWorkUIDs,
        mapping(bytes32 workUID => uint64 sequence) storage latestWorkDecisionSequence,
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        mapping(
            uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record)
        ) storage contributors,
        uint256 commitmentId,
        bytes32 assessmentUID
    )
        external
    {
        ICommitmentPoolingModule.Commitment storage commitment =
            CommitmentPoolingGuardLib.requireAcceptedUnfrozen(commitments, commitmentId);
        if (commitment.assessmentUID != bytes32(0)) {
            revert ICommitmentPoolingModule.AssessmentAlreadyAttached(commitmentId, commitment.assessmentUID);
        }
        ICommitmentPoolingModule.Pool storage pool = pools[commitment.poolId];
        if (
            !CommitmentPoolingGuardLib.isPoolSteward(env, pools, commitment.poolId, msg.sender)
                && !env.hats.isEvaluatorOf(pool.garden, msg.sender)
        ) {
            revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        }
        Attestation memory attestation = env.eas.getAttestation(assessmentUID);
        if (
            attestation.uid != assessmentUID
                || (attestation.schema != env.legacyAssessmentSchemaUID && attestation.schema != env.assessmentV3SchemaUID)
                || attestation.recipient != commitment.providerGarden || attestation.revocationTime != 0
        ) revert ICommitmentPoolingModule.InvalidAssessmentAttestation(assessmentUID);
        commitment.assessmentUID = assessmentUID;
        emit ICommitmentPoolingModule.AssessmentAttached(commitmentId, assessmentUID, msg.sender);
        CommitmentPoolingWorkCreditLib.evaluateAutomaticReady(
            env,
            cycles,
            commitmentWorkUIDs,
            latestWorkDecisionSequence,
            commitmentConfirmers,
            contributors,
            commitmentId,
            commitment
        );
    }

    // solhint-disable-next-line code-complexity
    function linkWork(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        mapping(
            uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record)
        ) storage contributors,
        mapping(bytes32 workUID => uint256 commitmentId) storage workCommitment,
        mapping(uint256 commitmentId => bytes32[] activeWorkUIDs) storage commitmentWorkUIDs,
        mapping(bytes32 workUID => uint16 requirementIndexPlusOne) storage workRequirementIndexPlusOne,
        mapping(
            address caller => mapping(bytes32 operationKey => bytes32 payloadHash)
        ) storage workLinkPayloadHashByOperation,
        uint256 commitmentId,
        bytes32 workUID,
        uint16 requirementIndex,
        bytes32 operationKey
    )
        external
    {
        if (operationKey == bytes32(0)) revert ICommitmentPoolingModule.InvalidWorkLinkOperationKey();
        bytes32 payloadHash = keccak256(abi.encode(commitmentId, workUID, requirementIndex));
        bytes32 priorPayloadHash = workLinkPayloadHashByOperation[msg.sender][operationKey];
        if (priorPayloadHash != bytes32(0)) {
            if (priorPayloadHash != payloadHash) revert ICommitmentPoolingModule.WorkLinkOperationConflict(operationKey);
            return;
        }
        ICommitmentPoolingModule.Commitment storage commitment =
            CommitmentPoolingGuardLib.requireAcceptedUnfrozen(commitments, commitmentId);
        if (!CommitmentPoolingGuardLib.canEditProof(env, pools, contributors, commitmentId, commitment, msg.sender)) {
            revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        }
        if (workCommitment[workUID] != 0) revert ICommitmentPoolingModule.WorkAlreadyLinked(workUID);
        uint256 nextLength = commitmentWorkUIDs[commitmentId].length + 1;
        if (nextLength > CommitmentPoolingCommonLib.MAX_LINKED_WORKS_PER_COMMITMENT) {
            revert ICommitmentPoolingModule.TooManyLinkedWorks(
                nextLength, CommitmentPoolingCommonLib.MAX_LINKED_WORKS_PER_COMMITMENT
            );
        }

        Attestation memory attestation = env.eas.getAttestation(workUID);
        if (
            attestation.uid != workUID || attestation.schema != env.workSchemaUID || attestation.revocationTime != 0
                || attestation.recipient != commitment.providerGarden
        ) revert ICommitmentPoolingModule.InvalidWorkAttestation(workUID);
        if (!contributors[commitmentId][attestation.attester].active) {
            revert ICommitmentPoolingModule.ContributorNotActive(attestation.attester);
        }
        if (!CommitmentPoolingGuardLib.isGardenMember(env.hats, commitment.providerGarden, attestation.attester)) {
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
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        mapping(
            uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record)
        ) storage contributors,
        mapping(uint256 cycleId => ICommitmentPoolingModule.Cycle cycle) storage cycles,
        mapping(uint256 commitmentId => bytes32[] activeWorkUIDs) storage commitmentWorkUIDs,
        mapping(bytes32 workUID => uint256 commitmentId) storage workCommitment,
        mapping(bytes32 workUID => uint64 sequence) storage latestWorkDecisionSequence,
        mapping(bytes32 workUID => bytes32 approvalUID) storage latestWorkDecisionUID,
        mapping(bytes32 approvalUID => bool counted) storage approvalCounted,
        mapping(bytes32 workUID => bool active) storage workCreditActive,
        mapping(bytes32 workUID => uint16 requirementIndexPlusOne) storage workRequirementIndexPlusOne,
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        bytes calldata encodedDecision
    )
        external
    {
        (bytes32 workUID, bytes32 approvalUID, uint64 decisionSequence, address garden, bool approved) =
            abi.decode(encodedDecision, (bytes32, bytes32, uint64, address, bool));
        if (msg.sender != env.workApprovalResolver) revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        uint256 commitmentId = workCommitment[workUID];
        if (commitmentId == 0) return;
        ICommitmentPoolingModule.Commitment storage commitment = commitments[commitmentId];
        if (commitment.state != ICommitmentPoolingModule.CommitmentState.Accepted || commitment.contributorsFrozen) {
            return;
        }
        if (garden != commitment.providerGarden || decisionSequence <= latestWorkDecisionSequence[workUID]) return;
        if (IWorkDecisionSequenceResolver(env.workApprovalResolver).latestDecisionSequence(workUID) != decisionSequence) {
            return;
        }

        Attestation memory decision = env.eas.getAttestation(approvalUID);
        if (
            decision.uid != approvalUID || decision.schema != env.workApprovalSchemaUID || decision.revocationTime != 0
                || decision.recipient != garden
        ) return;
        (uint256 actionUID, bytes32 decodedWorkUID, bool decodedApproved,,,,) =
            abi.decode(decision.data, (uint256, bytes32, bool, string, uint8, uint8, string));
        if (decodedWorkUID != workUID || decodedApproved != approved) return;

        Attestation memory work = env.eas.getAttestation(workUID);
        if (work.uid != workUID || work.schema != env.workSchemaUID || work.recipient != garden) return;
        (uint256 workActionUID,,,,) = abi.decode(work.data, (uint256, string, string, string, string[]));
        if (workActionUID != actionUID) return;

        if (!CommitmentPoolingWorkCreditLib.creditWorkDecision(
                latestWorkDecisionSequence,
                latestWorkDecisionUID,
                approvalCounted,
                workCreditActive,
                workRequirementIndexPlusOne,
                contributors,
                commitmentId,
                commitment,
                workUID,
                approvalUID,
                decisionSequence,
                approved,
                work.attester
            )) {
            return;
        }
        CommitmentPoolingWorkCreditLib.evaluateAutomaticReady(
            env,
            cycles,
            commitmentWorkUIDs,
            latestWorkDecisionSequence,
            commitmentConfirmers,
            contributors,
            commitmentId,
            commitment
        );
    }
}
