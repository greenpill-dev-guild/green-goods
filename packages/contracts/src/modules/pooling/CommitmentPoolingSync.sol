// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Attestation } from "@eas/IEAS.sol";

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { IWorkDecisionSequenceResolver } from "./CommitmentPoolingStorage.sol";
import { CommitmentPoolingTerms } from "./CommitmentPoolingTerms.sol";

/// @title CommitmentPoolingSync
/// @notice Work unlinking and the steward catch-up for missed resolver decisions.
/// @dev The resolver hook is deliberately non-blocking, so a dropped call leaves a Work behind at
///      a stale local sequence. This is the recovery path, and it is fail-closed where the hook is
///      forgiving: every supplied decision must verify on EAS, carry a resolver-owned sequence,
///      and belong to this commitment, and the caller cannot cherry-pick which linked Work to
///      refresh.
abstract contract CommitmentPoolingSync is CommitmentPoolingTerms {
    /// @notice Detaches a Work whose credit is not currently active from its commitment.
    function unlinkWork(bytes32 workUID) external whenOperational {
        uint256 commitmentId = workCommitment[workUID];
        if (commitmentId == 0) revert ICommitmentPoolingModule.WorkNotLinkedToCommitment(workUID, 0);
        ICommitmentPoolingModule.Commitment storage commitment = _requireAcceptedUnfrozen(commitmentId);
        _requirePoolSteward(commitment.poolId, pools[commitment.poolId]);
        // A historical approval superseded by a newer rejection leaves credit inactive, so the
        // Work becomes detachable again even though its old decision UID stays delivered.
        if (workCreditActive[workUID]) {
            revert ICommitmentPoolingModule.ApprovalAlreadyCounted(latestWorkDecisionUID[workUID]);
        }

        // The EAS attester is immutable, so the roster charge is released to exactly the record
        // linkWork charged. An underflow here would mean that invariant broke; failing closed is
        // the only honest outcome.
        address attester = eas.getAttestation(workUID).attester;
        contributors[commitmentId][attester].uncountedLinkedWorkCount--;

        delete workCommitment[workUID];
        delete workRequirementIndexPlusOne[workUID];
        _removeLinkedWorkUID(commitmentId, workUID);
        emit ICommitmentPoolingModule.WorkUnlinked(commitmentId, workUID, msg.sender);
    }

    /// @notice Re-applies decisions the resolver hook failed to deliver.
    function syncWorkDecisions(uint256 commitmentId, bytes32[] calldata decisionUIDs) external whenOperational {
        ICommitmentPoolingModule.Commitment storage commitment = _requireAcceptedUnfrozen(commitmentId);
        _requirePoolSteward(commitment.poolId, pools[commitment.poolId]);
        if (decisionUIDs.length > MAX_LINKED_WORKS_PER_COMMITMENT_VALUE) {
            revert ICommitmentPoolingModule.TooManyLinkedWorks(decisionUIDs.length, MAX_LINKED_WORKS_PER_COMMITMENT_VALUE);
        }

        (bytes32[] memory workUIDs, uint256[] memory currentIndex, uint64[] memory currentSequence, uint256 distinct) =
            _proveSuppliedHistoryCurrent(commitmentId, commitment, decisionUIDs);

        bool counted;
        for (uint256 i = 0; i < distinct; i++) {
            bool applied = _applyCurrentDecision(
                commitmentId, commitment, workUIDs[i], decisionUIDs[currentIndex[i]], currentSequence[i]
            );
            counted = counted || applied;
        }

        // The complete active-link set — not just the supplied subset — must be current before any
        // freeze, so omitting a stale linked Work reverts the whole catch-up.
        _assertWorkDecisionsFresh(commitmentId);
        if (counted) _evaluateAutomaticReady(commitmentId, commitment);
    }

    // ═════════════════════════════ Internal ═════════════════════════════

    /// @dev First pass. Verifies every supplied decision and proves that the greatest supplied
    ///      sequence per Work is the resolver's current one, before anything mutates.
    /// @return workUIDs Distinct Works covered by the batch, in first-seen order.
    /// @return currentIndex Position in `decisionUIDs` of each Work's greatest-sequence decision.
    /// @return currentSequence That decision's resolver-assigned sequence.
    /// @return distinct How many leading entries of the three arrays are populated.
    function _proveSuppliedHistoryCurrent(
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        bytes32[] calldata decisionUIDs
    )
        private
        view
        returns (
            bytes32[] memory workUIDs,
            uint256[] memory currentIndex,
            uint64[] memory currentSequence,
            uint256 distinct
        )
    {
        workUIDs = new bytes32[](decisionUIDs.length);
        currentIndex = new uint256[](decisionUIDs.length);
        currentSequence = new uint64[](decisionUIDs.length);

        for (uint256 i = 0; i < decisionUIDs.length; i++) {
            (bytes32 workUID, uint64 sequence) = _readSuppliedDecision(commitmentId, commitment, decisionUIDs[i]);
            uint256 slot = distinct;
            for (uint256 j = 0; j < distinct; j++) {
                if (workUIDs[j] == workUID) {
                    slot = j;
                    break;
                }
            }
            if (slot == distinct) {
                workUIDs[slot] = workUID;
                distinct++;
            }
            if (sequence > currentSequence[slot]) {
                currentSequence[slot] = sequence;
                currentIndex[slot] = i;
            }
        }

        for (uint256 i = 0; i < distinct; i++) {
            uint64 resolverSequence =
                IWorkDecisionSequenceResolver(workApprovalResolver).latestDecisionSequence(workUIDs[i]);
            if (resolverSequence != currentSequence[i]) {
                revert ICommitmentPoolingModule.IncompleteDecisionHistory(workUIDs[i], resolverSequence, currentSequence[i]);
            }
        }
    }

    function _readSuppliedDecision(
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        bytes32 decisionUID
    )
        private
        view
        returns (bytes32 workUID, uint64 sequence)
    {
        Attestation memory decision = eas.getAttestation(decisionUID);
        if (
            decision.uid != decisionUID || decision.schema != workApprovalSchemaUID || decision.revocationTime != 0
                || decision.recipient != commitment.providerGarden
        ) revert ICommitmentPoolingModule.InvalidApprovalAttestation(decisionUID);

        (, workUID,,,,,) = abi.decode(decision.data, (uint256, bytes32, bool, string, uint8, uint8, string));
        if (workCommitment[workUID] != commitmentId) {
            revert ICommitmentPoolingModule.WorkNotLinkedToCommitment(workUID, commitmentId);
        }

        // A decision attested before the resolver assigned sequences cannot be ordered against
        // its siblings, so the operator must re-attest the current decision instead.
        sequence = IWorkDecisionSequenceResolver(workApprovalResolver).decisionSequenceByUID(decisionUID);
        if (sequence == 0) {
            revert ICommitmentPoolingModule.IncompleteDecisionHistory(
                workUID, IWorkDecisionSequenceResolver(workApprovalResolver).latestDecisionSequence(workUID), 0
            );
        }
    }

    /// @dev Second pass. Applies exactly one decision per Work — the current one.
    function _applyCurrentDecision(
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        bytes32 workUID,
        bytes32 decisionUID,
        uint64 sequence
    )
        private
        returns (bool counted)
    {
        // The hook may already have delivered this exact decision; re-applying it changes nothing.
        if (sequence <= latestWorkDecisionSequence[workUID]) return false;

        Attestation memory decision = eas.getAttestation(decisionUID);
        (uint256 actionUID,, bool approved,,,,) =
            abi.decode(decision.data, (uint256, bytes32, bool, string, uint8, uint8, string));

        Attestation memory work = eas.getAttestation(workUID);
        if (work.uid != workUID || work.schema != workSchemaUID || work.recipient != commitment.providerGarden) {
            revert ICommitmentPoolingModule.InvalidWorkAttestation(workUID);
        }
        (uint256 workActionUID,,,,) = abi.decode(work.data, (uint256, string, string, string, string[]));
        if (workActionUID != actionUID) revert ICommitmentPoolingModule.InvalidWorkAttestation(workUID);

        return _creditWorkDecision(commitmentId, commitment, workUID, decisionUID, sequence, approved, work.attester);
    }

    /// @dev Readiness enumerates this array, so a detached Work must leave it. Order carries no
    ///      meaning, so the last entry fills the hole.
    function _removeLinkedWorkUID(uint256 commitmentId, bytes32 workUID) private {
        bytes32[] storage linked = commitmentWorkUIDs[commitmentId];
        for (uint256 i = 0; i < linked.length; i++) {
            if (linked[i] != workUID) continue;
            linked[i] = linked[linked.length - 1];
            linked.pop();
            return;
        }
    }
}
