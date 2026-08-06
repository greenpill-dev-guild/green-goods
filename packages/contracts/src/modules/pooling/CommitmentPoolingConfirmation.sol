// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS, Attestation } from "@eas/IEAS.sol";

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentRegistry } from "../../interfaces/ICommitmentRegistry.sol";
import { IHatsModule } from "../../interfaces/IHatsModule.sol";
import { ActionRegistry } from "../../registries/Action.sol";
import { CommitmentPoolingClaims, IWorkDecisionSequenceResolver } from "./CommitmentPoolingClaims.sol";

/// @title CommitmentPoolingConfirmation
/// @notice Readiness submission and ordinary or fallback confirmation.
abstract contract CommitmentPoolingConfirmation is CommitmentPoolingClaims {
    function submitForConfirmation(uint256 commitmentId) external whenOperational {
        ICommitmentPoolingModule.Commitment storage commitment = _requireAcceptedUnfrozen(commitmentId);
        if (
            msg.sender != commitment.counterparty && msg.sender != commitment.creator
                && msg.sender != commitment.leadProvider && !_isPoolSteward(commitment.poolId, msg.sender)
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
        _freezeAndReady(commitmentId, commitment, false, "");
    }

    function markReadyForConfirmation(uint256 commitmentId, string calldata reason) external whenOperational {
        ICommitmentPoolingModule.Commitment storage commitment = _requireAcceptedUnfrozen(commitmentId);
        if (!_isPoolSteward(commitment.poolId, msg.sender)) {
            revert ICommitmentPoolingModule.NotPoolSteward(msg.sender, commitment.poolId);
        }
        if (bytes(reason).length == 0) revert ICommitmentPoolingModule.ReasonRequired();
        _freezeAndReady(commitmentId, commitment, true, reason);
    }

    function confirmFulfillment(uint256 commitmentId) external whenOperational nonReentrant {
        ICommitmentPoolingModule.Commitment storage commitment = _requireCommitment(commitmentId);
        if (commitment.state != ICommitmentPoolingModule.CommitmentState.ReadyForConfirmation) {
            revert ICommitmentPoolingModule.CommitmentNotInState(commitmentId, commitment.state);
        }
        if (contributors[commitmentId][msg.sender].active) revert ICommitmentPoolingModule.SelfConfirmation();
        if (!_isOrdinaryConfirmer(commitmentId, commitment, msg.sender)) {
            revert ICommitmentPoolingModule.NotConfirmer(msg.sender);
        }
        if (hasConfirmed[commitmentId][msg.sender]) revert ICommitmentPoolingModule.AlreadyConfirmed(msg.sender);
        hasConfirmed[commitmentId][msg.sender] = true;
        commitment.confirmationCount++;
        emit ICommitmentPoolingModule.ConfirmationRecorded(
            commitmentId, msg.sender, commitment.confirmationCount, commitment.confirmationThreshold
        );
        if (commitment.confirmationCount >= commitment.confirmationThreshold) {
            _fulfillCommitment(commitmentId, commitment, msg.sender, ICommitmentPoolingModule.ConfirmationPath.Ordinary, "");
        }
    }

    function confirmFulfillmentAsFallback(
        uint256 commitmentId,
        string calldata reason
    )
        external
        whenOperational
        nonReentrant
    {
        ICommitmentPoolingModule.Commitment storage commitment = _requireCommitment(commitmentId);
        if (commitment.state != ICommitmentPoolingModule.CommitmentState.ReadyForConfirmation) {
            revert ICommitmentPoolingModule.CommitmentNotInState(commitmentId, commitment.state);
        }
        if (_ordinaryConfirmationReachable(commitmentId, commitment)) {
            revert ICommitmentPoolingModule.OrdinaryConfirmationStillReachable(commitmentId);
        }
        if (contributors[commitmentId][msg.sender].active) revert ICommitmentPoolingModule.SelfConfirmation();
        if (bytes(reason).length == 0) revert ICommitmentPoolingModule.ReasonRequired();

        // Local pool authority is classified first, so a dual-role caller records PoolFallback.
        // Module ownership alone is deliberately absent from both predicates.
        ICommitmentPoolingModule.ConfirmationPath path;
        if (_isGardenSteward(pools[commitment.poolId].garden, msg.sender)) {
            path = ICommitmentPoolingModule.ConfirmationPath.PoolFallback;
        } else if (
            commitment.protocolFallbackEnabled && protocolPoolId != 0
                && _isGardenSteward(pools[protocolPoolId].garden, msg.sender)
        ) {
            path = ICommitmentPoolingModule.ConfirmationPath.ProtocolFallback;
        } else {
            revert ICommitmentPoolingModule.NotConfirmer(msg.sender);
        }

        _fulfillCommitment(commitmentId, commitment, msg.sender, path, reason);
    }
}
