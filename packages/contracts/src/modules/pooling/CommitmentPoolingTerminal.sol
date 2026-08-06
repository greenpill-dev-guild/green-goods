// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingProof } from "./CommitmentPoolingProof.sol";

/// @title CommitmentPoolingTerminal
/// @notice Cancellation, expiry, dispute, and dispute resolution.
/// @dev Module pause never blocks cancel, expire, or resolve — those are the wind-down path a
///      paused pool or module still needs. `raiseDispute` is an ordinary operational mutation.
abstract contract CommitmentPoolingTerminal is CommitmentPoolingProof {
    function cancelCommitment(uint256 commitmentId, string calldata reasonCID) external {
        ICommitmentPoolingModule.Commitment storage commitment = _requireCommitment(commitmentId);
        ICommitmentPoolingModule.CommitmentState state = commitment.state;

        // ReadyForConfirmation is reachable only through dispute resolution.
        bool preAcceptance = state == ICommitmentPoolingModule.CommitmentState.Offered
            || state == ICommitmentPoolingModule.CommitmentState.Requested;
        if (!preAcceptance && state != ICommitmentPoolingModule.CommitmentState.Accepted) {
            revert ICommitmentPoolingModule.CommitmentNotInState(commitmentId, state);
        }

        // Creators may withdraw their own unclaimed commitment; everything else is steward
        // authority and carries a mandatory reason.
        bool asCreator = preAcceptance && msg.sender == commitment.creator;
        if (!asCreator) {
            if (!_isPoolSteward(commitment.poolId, msg.sender)) {
                revert ICommitmentPoolingModule.NotPoolSteward(msg.sender, commitment.poolId);
            }
            if (bytes(reasonCID).length == 0) revert ICommitmentPoolingModule.ReasonRequired();
        }

        _releaseCommittedUnits(commitmentId, commitment);
        _decrementLiveCounts(commitment);
        commitment.state = ICommitmentPoolingModule.CommitmentState.Cancelled;
        emit ICommitmentPoolingModule.CommitmentCancelled(commitmentId, msg.sender, reasonCID);
    }

    function expireCommitment(uint256 commitmentId) external {
        ICommitmentPoolingModule.Commitment storage commitment = _requireCommitment(commitmentId);
        ICommitmentPoolingModule.CommitmentState state = commitment.state;
        if (
            state != ICommitmentPoolingModule.CommitmentState.Offered
                && state != ICommitmentPoolingModule.CommitmentState.Requested
                && state != ICommitmentPoolingModule.CommitmentState.Accepted
                && state != ICommitmentPoolingModule.CommitmentState.ReadyForConfirmation
        ) revert ICommitmentPoolingModule.CommitmentNotInState(commitmentId, state);

        uint64 due = _effectiveDueDate(commitment);
        if (due == 0 || block.timestamp <= due) revert ICommitmentPoolingModule.NotDue(commitmentId);

        _releaseCommittedUnits(commitmentId, commitment);
        _decrementLiveCounts(commitment);
        commitment.state = ICommitmentPoolingModule.CommitmentState.Expired;
        emit ICommitmentPoolingModule.CommitmentExpired(commitmentId, msg.sender);
    }

    function raiseDispute(uint256 commitmentId, string calldata reasonCID) external whenOperational {
        ICommitmentPoolingModule.Commitment storage commitment = _requireCommitment(commitmentId);
        ICommitmentPoolingModule.CommitmentState previous = commitment.state;
        if (
            previous != ICommitmentPoolingModule.CommitmentState.Accepted
                && previous != ICommitmentPoolingModule.CommitmentState.ReadyForConfirmation
                && previous != ICommitmentPoolingModule.CommitmentState.Expired
        ) revert ICommitmentPoolingModule.CommitmentNotInState(commitmentId, previous);
        if (bytes(reasonCID).length == 0) revert ICommitmentPoolingModule.ReasonRequired();

        bool eligible = msg.sender == commitment.creator || msg.sender == commitment.counterparty
            || _isNamedConfirmer(commitmentId, msg.sender) || _isPoolSteward(commitment.poolId, msg.sender);
        if (!eligible) revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);

        // An already-Expired record was decremented on expiry. Re-increment so a Disputed
        // commitment always holds its cycle open, and let the resolution decrement exactly once.
        if (previous == ICommitmentPoolingModule.CommitmentState.Expired) {
            pools[commitment.poolId].liveCommitmentCount++;
            if (commitment.cycleId != 0) cycles[commitment.cycleId].liveCommitmentCount++;
        }

        commitment.preDisputeState = previous;
        commitment.state = ICommitmentPoolingModule.CommitmentState.Disputed;
        emit ICommitmentPoolingModule.CommitmentDisputed(commitmentId, msg.sender, previous, reasonCID);
    }

    function resolveDispute(
        uint256 commitmentId,
        ICommitmentPoolingModule.DisputeResolution resolution,
        string calldata reasonCID
    )
        external
        nonReentrant
    {
        ICommitmentPoolingModule.Commitment storage commitment = _requireCommitment(commitmentId);
        if (commitment.state != ICommitmentPoolingModule.CommitmentState.Disputed) {
            revert ICommitmentPoolingModule.CommitmentNotInState(commitmentId, commitment.state);
        }
        if (!_isPoolSteward(commitment.poolId, msg.sender)) {
            revert ICommitmentPoolingModule.NotPoolSteward(msg.sender, commitment.poolId);
        }
        if (bytes(reasonCID).length == 0) revert ICommitmentPoolingModule.ReasonRequired();

        ICommitmentPoolingModule.CommitmentState previous = commitment.preDisputeState;
        bool wasExpired = previous == ICommitmentPoolingModule.CommitmentState.Expired;

        // Expiry already released the units and settled the outcome; it can never become success.
        if (wasExpired && resolution == ICommitmentPoolingModule.DisputeResolution.Fulfilled) {
            revert ICommitmentPoolingModule.InvalidDisputeResolution(commitmentId, resolution);
        }

        ICommitmentPoolingModule.CommitmentState finalState =
            _applyDisputeResolution(commitmentId, commitment, resolution, previous, wasExpired);

        emit ICommitmentPoolingModule.DisputeResolved(commitmentId, resolution, finalState, reasonCID);
    }

    // ═════════════════════════════ Internal ═════════════════════════════

    // solhint-disable-next-line code-complexity
    function _applyDisputeResolution(
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        ICommitmentPoolingModule.DisputeResolution resolution,
        ICommitmentPoolingModule.CommitmentState previous,
        bool wasExpired
    )
        private
        returns (ICommitmentPoolingModule.CommitmentState finalState)
    {
        if (resolution == ICommitmentPoolingModule.DisputeResolution.RestorePrevious) {
            commitment.state = previous;
            // Restoring a live state keeps the raise-time count; restoring Expired settles it.
            if (wasExpired) _decrementLiveCounts(commitment);
            return previous;
        }

        if (resolution == ICommitmentPoolingModule.DisputeResolution.Fulfilled) {
            _resolveDisputeFulfilled(commitmentId, commitment, previous);
            return ICommitmentPoolingModule.CommitmentState.Fulfilled;
        }

        // Cancelled or Expired: release whatever expiry has not already released.
        if (!wasExpired) _releaseCommittedUnits(commitmentId, commitment);
        _decrementLiveCounts(commitment);
        finalState = resolution == ICommitmentPoolingModule.DisputeResolution.Cancelled
            ? ICommitmentPoolingModule.CommitmentState.Cancelled
            : ICommitmentPoolingModule.CommitmentState.Expired;
        commitment.state = finalState;
    }

    function _resolveDisputeFulfilled(
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        ICommitmentPoolingModule.CommitmentState previous
    )
        private
    {
        // Same anti-farming rule as every other confirmation path.
        if (contributors[commitmentId][msg.sender].active) revert ICommitmentPoolingModule.SelfConfirmation();
        if (commitment.totalVerifiedCredits == 0) {
            revert ICommitmentPoolingModule.NoEligibleContributors(commitmentId);
        }
        if (commitment.cycleId != 0 && cycles[commitment.cycleId].state != ICommitmentPoolingModule.CycleState.Open) {
            revert ICommitmentPoolingModule.RecognitionPolicyUnavailable(commitment.cycleId);
        }
        _assertWorkDecisionsFresh(commitmentId);

        // A pre-dispute state that never froze must freeze here before units convert.
        if (previous != ICommitmentPoolingModule.CommitmentState.ReadyForConfirmation) {
            commitment.contributorsFrozen = true;
            emit ICommitmentPoolingModule.ContributorRosterFrozen(commitmentId, commitment.contributorCount);
        }

        _decrementLiveCounts(commitment);
        commitment.state = ICommitmentPoolingModule.CommitmentState.Fulfilled;
        commitmentRegistry.fulfillUnits(commitmentId, commitment.leadProvider, commitment.targetUnits);
    }

    /// @dev Offers commit their units at creation and Requests at acceptance, so the holder is the
    ///      creator for an Offer and the lead provider for an accepted Request. An unaccepted
    ///      Request has no committed units and releases nothing.
    function _releaseCommittedUnits(uint256 commitmentId, ICommitmentPoolingModule.Commitment storage commitment) private {
        address holder = commitment.direction == ICommitmentPoolingModule.CommitmentDirection.Offer
            ? commitment.creator
            : commitment.leadProvider;
        if (holder == address(0)) return;
        commitmentRegistry.releaseUnits(commitmentId, holder, commitment.targetUnits);
    }

    function _decrementLiveCounts(ICommitmentPoolingModule.Commitment storage commitment) private {
        pools[commitment.poolId].liveCommitmentCount--;
        if (commitment.cycleId != 0) cycles[commitment.cycleId].liveCommitmentCount--;
    }

    /// @dev The commitment's own dueDate governs; a cycle-scoped commitment falls back to the
    ///      cycle end time. Zero means no deadline exists and the commitment cannot expire.
    function _effectiveDueDate(ICommitmentPoolingModule.Commitment storage commitment) private view returns (uint64) {
        if (commitment.dueDate != 0) return commitment.dueDate;
        if (commitment.cycleId != 0) return cycles[commitment.cycleId].endTime;
        return 0;
    }

    function _isNamedConfirmer(uint256 commitmentId, address account) private view returns (bool) {
        address[] storage named = commitmentConfirmers[commitmentId];
        for (uint256 i = 0; i < named.length; i++) {
            if (named[i] == account) return true;
        }
        return false;
    }
}
