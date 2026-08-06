// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingCycles } from "./CommitmentPoolingCycles.sol";

/// @title CommitmentPoolingRoster
/// @notice Open-policy self-join and self-exit, managed removal, and requirement assignment.
/// @dev Every mutation here runs while the roster is still unfrozen and revalidates confirmer
///      reachability, so a roster edit can never strand a commitment without a confirmer.
abstract contract CommitmentPoolingRoster is CommitmentPoolingCycles {
    function joinCommitment(uint256 commitmentId) external whenOperational {
        ICommitmentPoolingModule.Commitment storage commitment = _requireEditableRoster(commitmentId);
        if (commitment.contributorPolicy != ICommitmentPoolingModule.ContributorPolicy.Open) {
            revert ICommitmentPoolingModule.ContributorPolicyMismatch(commitmentId);
        }
        // _addContributor applies the same providerGarden membership gate as a Work author.
        _addContributor(commitmentId, commitment, msg.sender, msg.sender);
    }

    function leaveCommitment(uint256 commitmentId) external whenOperational {
        ICommitmentPoolingModule.Commitment storage commitment = _requireEditableRoster(commitmentId);
        if (commitment.contributorPolicy != ICommitmentPoolingModule.ContributorPolicy.Open) {
            revert ICommitmentPoolingModule.ContributorPolicyMismatch(commitmentId);
        }
        if (msg.sender == commitment.leadProvider) {
            revert ICommitmentPoolingModule.LeadContributorCannotLeave(commitmentId);
        }
        _removeActiveContributor(commitmentId, commitment, msg.sender);
    }

    function removeContributor(uint256 commitmentId, address contributor) external whenOperational {
        ICommitmentPoolingModule.Commitment storage commitment = _requireEditableRoster(commitmentId);
        // Open rosters use self-join and self-leave and can never expel.
        if (commitment.contributorPolicy != ICommitmentPoolingModule.ContributorPolicy.LeadManaged) {
            revert ICommitmentPoolingModule.ContributorPolicyMismatch(commitmentId);
        }
        if (msg.sender != commitment.leadProvider && !_isPoolSteward(commitment.poolId, msg.sender)) {
            revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        }
        if (contributor == commitment.leadProvider) {
            revert ICommitmentPoolingModule.LeadContributorCannotLeave(commitmentId);
        }
        _removeActiveContributor(commitmentId, commitment, contributor);
    }

    /// @notice Optional planning signal; assignment is never recognition credit.
    function setContributorRequirement(
        uint256 commitmentId,
        address contributor,
        uint16 requirementIndex,
        bool assigned
    )
        external
        whenOperational
    {
        ICommitmentPoolingModule.Commitment storage commitment = _requireEditableRoster(commitmentId);
        if (msg.sender != commitment.leadProvider && !_isPoolSteward(commitment.poolId, msg.sender)) {
            revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        }
        if (requirementIndex >= commitment.requirements.length) {
            revert ICommitmentPoolingModule.InvalidRequirementCount(requirementIndex);
        }
        if (!contributors[commitmentId][contributor].active) {
            revert ICommitmentPoolingModule.ContributorNotActive(contributor);
        }

        if (requirementAssignments[commitmentId][requirementIndex][contributor] == assigned) return;
        requirementAssignments[commitmentId][requirementIndex][contributor] = assigned;
        emit ICommitmentPoolingModule.ContributorRequirementAssigned(commitmentId, contributor, requirementIndex, assigned);
    }

    // ═════════════════════════════ Internal ═════════════════════════════

    /// @dev A contributor carrying linked Work or any credit is part of the proof record and can
    ///      no longer be detached without rewriting that record.
    function _removeActiveContributor(
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        address contributor
    )
        private
    {
        ICommitmentPoolingModule.ContributorRecord storage record = contributors[commitmentId][contributor];
        if (!record.active) revert ICommitmentPoolingModule.ContributorNotActive(contributor);
        if (record.uncountedLinkedWorkCount != 0 || record.approvedWorkCredits != 0 || record.evidenceCredits != 0) {
            revert ICommitmentPoolingModule.ContributorHasCredit(contributor);
        }

        record.active = false;
        commitment.contributorCount--;
        emit ICommitmentPoolingModule.ContributorRemoved(commitmentId, contributor, msg.sender);

        // Leaving frees a named confirmer slot rather than consuming one, so reachability can
        // only improve; re-assert it anyway so every roster mutation proves the same invariant.
        _assertConfirmationReachable(commitmentId, commitment);
    }
}
