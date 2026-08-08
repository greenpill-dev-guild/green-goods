// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Attestation } from "@eas/IEAS.sol";

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { IWorkDecisionSequenceResolver } from "../../interfaces/IWorkDecisionSequenceResolver.sol";
import { CommitmentPoolingCommonLib } from "./CommitmentPoolingCommonLib.sol";
import { CommitmentPoolingCreditLib } from "./CommitmentPoolingCreditLib.sol";
import { CommitmentPoolingGuardLib } from "./CommitmentPoolingGuardLib.sol";
import { CommitmentPoolingWorkCreditLib } from "./CommitmentPoolingWorkCreditLib.sol";

/// @title CommitmentPoolingSyncLib
/// @notice Deployed behavior library: Work unlinking and the steward catch-up for missed resolver
///         decisions.
/// @dev The resolver hook is deliberately non-blocking, so a dropped call leaves a Work behind at
///      a stale local sequence. This is the recovery path, and it is fail-closed where the hook is
///      forgiving: every supplied decision must verify on EAS, carry a resolver-owned sequence,
///      and belong to this commitment, and the caller cannot cherry-pick which linked Work to
///      refresh. Runs via DELEGATECALL from `CommitmentPoolingModule`.
library CommitmentPoolingSyncLib {
    /// @notice Detaches a Work whose credit is not currently active from its commitment.
    function unlinkWork(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        mapping(uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record))
            storage contributors,
        mapping(uint256 commitmentId => bytes32[] activeWorkUIDs) storage commitmentWorkUIDs,
        mapping(bytes32 workUID => uint256 commitmentId) storage workCommitment,
        mapping(bytes32 workUID => bytes32 approvalUID) storage latestWorkDecisionUID,
        mapping(bytes32 workUID => bool active) storage workCreditActive,
        mapping(bytes32 workUID => uint16 requirementIndexPlusOne) storage workRequirementIndexPlusOne,
        bytes32 workUID
    )
        external
    {
        uint256 commitmentId = workCommitment[workUID];
        if (commitmentId == 0) revert ICommitmentPoolingModule.WorkNotLinkedToCommitment(workUID, 0);
        ICommitmentPoolingModule.Commitment storage commitment =
            CommitmentPoolingGuardLib.requireAcceptedUnfrozen(commitments, commitmentId);
        CommitmentPoolingGuardLib.requirePoolSteward(env, commitment.poolId, pools[commitment.poolId]);
        // A historical approval superseded by a newer rejection leaves credit inactive, so the
        // Work becomes detachable again even though its old decision UID stays delivered.
        if (workCreditActive[workUID]) {
            revert ICommitmentPoolingModule.ApprovalAlreadyCounted(latestWorkDecisionUID[workUID]);
        }

        // The EAS attester is immutable, so the roster charge is released to exactly the record
        // linkWork charged. An underflow here would mean that invariant broke; failing closed is
        // the only honest outcome.
        address attester = env.eas.getAttestation(workUID).attester;
        contributors[commitmentId][attester].uncountedLinkedWorkCount--;

        delete workCommitment[workUID];
        delete workRequirementIndexPlusOne[workUID];
        _removeLinkedWorkUID(commitmentWorkUIDs, commitmentId, workUID);
        emit ICommitmentPoolingModule.WorkUnlinked(commitmentId, workUID, msg.sender);
    }

    /// @notice Re-applies decisions the resolver hook failed to deliver.
    // solhint-disable-next-line code-complexity
    function syncWorkDecisions(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        mapping(uint256 cycleId => ICommitmentPoolingModule.Cycle cycle) storage cycles,
        mapping(uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record))
            storage contributors,
        mapping(uint256 commitmentId => bytes32[] activeWorkUIDs) storage commitmentWorkUIDs,
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        mapping(bytes32 workUID => uint256 commitmentId) storage workCommitment,
        mapping(bytes32 workUID => uint64 sequence) storage latestWorkDecisionSequence,
        mapping(bytes32 workUID => bytes32 approvalUID) storage latestWorkDecisionUID,
        mapping(bytes32 approvalUID => bool counted) storage approvalCounted,
        mapping(bytes32 workUID => bool active) storage workCreditActive,
        mapping(bytes32 workUID => uint16 requirementIndexPlusOne) storage workRequirementIndexPlusOne,
        uint256 commitmentId,
        bytes32[] calldata decisionUIDs
    )
        external
    {
        ICommitmentPoolingModule.Commitment storage commitment =
            CommitmentPoolingGuardLib.requireAcceptedUnfrozen(commitments, commitmentId);
        CommitmentPoolingGuardLib.requirePoolSteward(env, commitment.poolId, pools[commitment.poolId]);
        if (decisionUIDs.length > CommitmentPoolingCommonLib.MAX_LINKED_WORKS_PER_COMMITMENT) {
            revert ICommitmentPoolingModule.TooManyLinkedWorks(
                decisionUIDs.length, CommitmentPoolingCommonLib.MAX_LINKED_WORKS_PER_COMMITMENT
            );
        }

        (bytes32[] memory workUIDs, uint256[] memory currentIndex, uint64[] memory currentSequence, uint256 distinct) =
            _proveSuppliedHistoryCurrent(env, workCommitment, commitmentId, commitment, decisionUIDs);

        bool counted;
        for (uint256 i = 0; i < distinct; i++) {
            bool applied = _applyCurrentDecision(
                ApplyDecisionInput({
                    env: env,
                    commitmentId: commitmentId,
                    workUID: workUIDs[i],
                    decisionUID: decisionUIDs[currentIndex[i]],
                    sequence: currentSequence[i]
                }),
                commitment,
                contributors,
                latestWorkDecisionSequence,
                latestWorkDecisionUID,
                approvalCounted,
                workCreditActive,
                workRequirementIndexPlusOne
            );
            counted = counted || applied;
        }

        // The complete active-link set — not just the supplied subset — must be current before any
        // freeze, so omitting a stale linked Work reverts the whole catch-up.
        CommitmentPoolingCreditLib.assertWorkDecisionsFresh(
            env, commitmentWorkUIDs, latestWorkDecisionSequence, commitmentId
        );
        if (counted) {
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

    /// @dev First pass. Verifies every supplied decision and proves that the greatest supplied
    ///      sequence per Work is the resolver's current one, before anything mutates.
    function _proveSuppliedHistoryCurrent(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(bytes32 workUID => uint256 commitmentId) storage workCommitment,
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
            (bytes32 workUID, uint64 sequence) =
                _readSuppliedDecision(env, workCommitment, commitmentId, commitment, decisionUIDs[i]);
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
                IWorkDecisionSequenceResolver(env.workApprovalResolver).latestDecisionSequence(workUIDs[i]);
            if (resolverSequence != currentSequence[i]) {
                revert ICommitmentPoolingModule.IncompleteDecisionHistory(workUIDs[i], resolverSequence, currentSequence[i]);
            }
        }
    }

    function _readSuppliedDecision(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(bytes32 workUID => uint256 commitmentId) storage workCommitment,
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        bytes32 decisionUID
    )
        private
        view
        returns (bytes32 workUID, uint64 sequence)
    {
        Attestation memory decision = env.eas.getAttestation(decisionUID);
        if (
            decision.uid != decisionUID || decision.schema != env.workApprovalSchemaUID || decision.revocationTime != 0
                || decision.recipient != commitment.providerGarden
        ) revert ICommitmentPoolingModule.InvalidApprovalAttestation(decisionUID);

        (, workUID,,,,,) = abi.decode(decision.data, (uint256, bytes32, bool, string, uint8, uint8, string));
        if (workCommitment[workUID] != commitmentId) {
            revert ICommitmentPoolingModule.WorkNotLinkedToCommitment(workUID, commitmentId);
        }

        // A decision attested before the resolver assigned sequences cannot be ordered against
        // its siblings, so the operator must re-attest the current decision instead.
        sequence = IWorkDecisionSequenceResolver(env.workApprovalResolver).decisionSequenceByUID(decisionUID);
        if (sequence == 0) {
            revert ICommitmentPoolingModule.IncompleteDecisionHistory(
                workUID, IWorkDecisionSequenceResolver(env.workApprovalResolver).latestDecisionSequence(workUID), 0
            );
        }
    }

    /// @dev Value-typed inputs of one catch-up application, grouped to stay within stack limits.
    struct ApplyDecisionInput {
        CommitmentPoolingCommonLib.Env env;
        uint256 commitmentId;
        bytes32 workUID;
        bytes32 decisionUID;
        uint64 sequence;
    }

    /// @dev Second pass. Applies exactly one decision per Work — the current one.
    function _applyCurrentDecision(
        ApplyDecisionInput memory input,
        ICommitmentPoolingModule.Commitment storage commitment,
        mapping(uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record))
            storage contributors,
        mapping(bytes32 workUID => uint64 sequence) storage latestWorkDecisionSequence,
        mapping(bytes32 workUID => bytes32 approvalUID) storage latestWorkDecisionUID,
        mapping(bytes32 approvalUID => bool counted) storage approvalCounted,
        mapping(bytes32 workUID => bool active) storage workCreditActive,
        mapping(bytes32 workUID => uint16 requirementIndexPlusOne) storage workRequirementIndexPlusOne
    )
        private
        returns (bool counted)
    {
        // The hook may already have delivered this exact decision; re-applying it changes nothing.
        if (input.sequence <= latestWorkDecisionSequence[input.workUID]) return false;

        Attestation memory decision = input.env.eas.getAttestation(input.decisionUID);
        (uint256 actionUID,, bool approved,,,,) =
            abi.decode(decision.data, (uint256, bytes32, bool, string, uint8, uint8, string));

        Attestation memory workAttestation = input.env.eas.getAttestation(input.workUID);
        if (
            workAttestation.uid != input.workUID || workAttestation.schema != input.env.workSchemaUID
                || workAttestation.recipient != commitment.providerGarden
        ) {
            revert ICommitmentPoolingModule.InvalidWorkAttestation(input.workUID);
        }
        (uint256 workActionUID,,,,) = abi.decode(workAttestation.data, (uint256, string, string, string, string[]));
        if (workActionUID != actionUID) revert ICommitmentPoolingModule.InvalidWorkAttestation(input.workUID);

        return CommitmentPoolingWorkCreditLib.creditWorkDecision(
            latestWorkDecisionSequence,
            latestWorkDecisionUID,
            approvalCounted,
            workCreditActive,
            workRequirementIndexPlusOne,
            contributors,
            input.commitmentId,
            commitment,
            input.workUID,
            input.decisionUID,
            input.sequence,
            approved,
            workAttestation.attester
        );
    }

    /// @dev Readiness enumerates this array, so a detached Work must leave it. Order carries no
    ///      meaning, so the last entry fills the hole.
    function _removeLinkedWorkUID(
        mapping(uint256 commitmentId => bytes32[] activeWorkUIDs) storage commitmentWorkUIDs,
        uint256 commitmentId,
        bytes32 workUID
    )
        private
    {
        bytes32[] storage linked = commitmentWorkUIDs[commitmentId];
        for (uint256 i = 0; i < linked.length; i++) {
            if (linked[i] != workUID) continue;
            linked[i] = linked[linked.length - 1];
            linked.pop();
            return;
        }
    }
}
