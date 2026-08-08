// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingCommonLib } from "./CommonLib.sol";
import { CommitmentPoolingCreditLib } from "./CreditLib.sol";
import { CommitmentPoolingGuardLib } from "./GuardLib.sol";

/// @title CommitmentPoolingConfirmLib
/// @notice Deployed behavior library: readiness submission and ordinary or fallback confirmation.
/// @dev Runs via DELEGATECALL from `CommitmentPoolingModule`; `msg.sender`, events, and reverts
///      surface from the proxy unchanged. Semantics track the retired facet bodies exactly.
library CommitmentPoolingConfirmLib {
    function submitForConfirmation(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        mapping(uint256 cycleId => ICommitmentPoolingModule.Cycle cycle) storage cycles,
        mapping(uint256 commitmentId => bytes32[] activeWorkUIDs) storage commitmentWorkUIDs,
        mapping(bytes32 workUID => uint64 sequence) storage latestWorkDecisionSequence,
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        mapping(uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record))
            storage contributors,
        uint256 commitmentId
    )
        external
    {
        ICommitmentPoolingModule.Commitment storage commitment =
            CommitmentPoolingGuardLib.requireAcceptedUnfrozen(commitments, commitmentId);
        if (
            msg.sender != commitment.counterparty && msg.sender != commitment.creator
                && msg.sender != commitment.leadProvider
                && !CommitmentPoolingGuardLib.isPoolSteward(env, pools, commitment.poolId, msg.sender)
        ) revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        if (commitment.commitmentType == ICommitmentPoolingModule.CommitmentType.DomainImpact) {
            revert ICommitmentPoolingModule.WorkApprovalRequired(commitmentId);
        }
        if (commitment.evidenceCount == 0 || commitment.totalVerifiedCredits == 0) {
            revert ICommitmentPoolingModule.EvidenceRequired(commitmentId);
        }
        if (commitment.requiresAssessment && commitment.assessmentUID == bytes32(0)) {
            revert ICommitmentPoolingModule.AssessmentRequired(commitmentId);
        }
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

    function markReadyForConfirmation(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        mapping(uint256 cycleId => ICommitmentPoolingModule.Cycle cycle) storage cycles,
        mapping(uint256 commitmentId => bytes32[] activeWorkUIDs) storage commitmentWorkUIDs,
        mapping(bytes32 workUID => uint64 sequence) storage latestWorkDecisionSequence,
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        mapping(uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record))
            storage contributors,
        uint256 commitmentId,
        string calldata reason
    )
        external
    {
        ICommitmentPoolingModule.Commitment storage commitment =
            CommitmentPoolingGuardLib.requireAcceptedUnfrozen(commitments, commitmentId);
        if (!CommitmentPoolingGuardLib.isPoolSteward(env, pools, commitment.poolId, msg.sender)) {
            revert ICommitmentPoolingModule.NotPoolSteward(msg.sender, commitment.poolId);
        }
        if (bytes(reason).length == 0) revert ICommitmentPoolingModule.ReasonRequired();
        CommitmentPoolingCreditLib.freezeAndReady(
            env,
            cycles,
            commitmentWorkUIDs,
            latestWorkDecisionSequence,
            commitmentConfirmers,
            contributors,
            commitmentId,
            commitment,
            true,
            reason
        );
    }

    function confirmFulfillment(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 cycleId => ICommitmentPoolingModule.Cycle cycle) storage cycles,
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        mapping(uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record))
            storage contributors,
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        mapping(uint256 commitmentId => mapping(address confirmer => bool confirmed)) storage hasConfirmed,
        uint256 commitmentId
    )
        external
    {
        ICommitmentPoolingModule.Commitment storage commitment =
            CommitmentPoolingGuardLib.requireCommitment(commitments, commitmentId);
        if (commitment.state != ICommitmentPoolingModule.CommitmentState.ReadyForConfirmation) {
            revert ICommitmentPoolingModule.CommitmentNotInState(commitmentId, commitment.state);
        }
        if (contributors[commitmentId][msg.sender].active) revert ICommitmentPoolingModule.SelfConfirmation();
        if (
            !CommitmentPoolingCreditLib.isOrdinaryConfirmer(env, commitmentConfirmers, commitmentId, commitment, msg.sender)
        ) {
            revert ICommitmentPoolingModule.NotConfirmer(msg.sender);
        }
        if (hasConfirmed[commitmentId][msg.sender]) revert ICommitmentPoolingModule.AlreadyConfirmed(msg.sender);
        hasConfirmed[commitmentId][msg.sender] = true;
        commitment.confirmationCount++;
        emit ICommitmentPoolingModule.ConfirmationRecorded(
            commitmentId, msg.sender, commitment.confirmationCount, commitment.confirmationThreshold
        );
        if (commitment.confirmationCount >= commitment.confirmationThreshold) {
            CommitmentPoolingCreditLib.fulfillCommitment(
                env,
                pools,
                cycles,
                commitmentId,
                commitment,
                msg.sender,
                ICommitmentPoolingModule.ConfirmationPath.Ordinary,
                ""
            );
        }
    }

    function confirmFulfillmentAsFallback(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 cycleId => ICommitmentPoolingModule.Cycle cycle) storage cycles,
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        mapping(uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record))
            storage contributors,
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        uint256 commitmentId,
        string calldata reason
    )
        external
    {
        ICommitmentPoolingModule.Commitment storage commitment =
            CommitmentPoolingGuardLib.requireCommitment(commitments, commitmentId);
        if (commitment.state != ICommitmentPoolingModule.CommitmentState.ReadyForConfirmation) {
            revert ICommitmentPoolingModule.CommitmentNotInState(commitmentId, commitment.state);
        }
        if (
            CommitmentPoolingCreditLib.ordinaryConfirmationReachable(
                commitmentConfirmers, contributors, commitmentId, commitment
            )
        ) {
            revert ICommitmentPoolingModule.OrdinaryConfirmationStillReachable(commitmentId);
        }
        if (contributors[commitmentId][msg.sender].active) revert ICommitmentPoolingModule.SelfConfirmation();
        if (bytes(reason).length == 0) revert ICommitmentPoolingModule.ReasonRequired();

        // Local pool authority is classified first, so a dual-role caller records PoolFallback.
        // Module ownership alone is deliberately absent from both predicates.
        ICommitmentPoolingModule.ConfirmationPath path;
        if (CommitmentPoolingGuardLib.isGardenSteward(env.hats, pools[commitment.poolId].garden, msg.sender)) {
            path = ICommitmentPoolingModule.ConfirmationPath.PoolFallback;
        } else if (
            commitment.protocolFallbackEnabled && env.protocolPoolId != 0
                && CommitmentPoolingGuardLib.isGardenSteward(env.hats, pools[env.protocolPoolId].garden, msg.sender)
        ) {
            path = ICommitmentPoolingModule.ConfirmationPath.ProtocolFallback;
        } else {
            revert ICommitmentPoolingModule.NotConfirmer(msg.sender);
        }

        CommitmentPoolingCreditLib.fulfillCommitment(env, pools, cycles, commitmentId, commitment, msg.sender, path, reason);
    }
}
