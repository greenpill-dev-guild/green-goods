// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingAcceptanceLib } from "./CommitmentPoolingAcceptanceLib.sol";
import { CommitmentPoolingCommonLib } from "./CommitmentPoolingCommonLib.sol";
import { CommitmentPoolingGuardLib } from "./CommitmentPoolingGuardLib.sol";

/// @title CommitmentPoolingRosterLib
/// @notice Deployed behavior library: open-policy self-join and self-exit, managed removal, and
///         requirement assignment.
/// @dev Every mutation here runs while the roster is still unfrozen and revalidates confirmer
///      reachability, so a roster edit can never strand a commitment without a confirmer.
///      Runs via DELEGATECALL from `CommitmentPoolingModule`.
library CommitmentPoolingRosterLib {
    function joinCommitment(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        mapping(uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record))
            storage contributors,
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        uint256 commitmentId
    )
        external
    {
        ICommitmentPoolingModule.Commitment storage commitment =
            CommitmentPoolingGuardLib.requireAcceptedUnfrozen(commitments, commitmentId);
        if (commitment.contributorPolicy != ICommitmentPoolingModule.ContributorPolicy.Open) {
            revert ICommitmentPoolingModule.ContributorPolicyMismatch(commitmentId);
        }
        // addContributor applies the same providerGarden membership gate as a Work author.
        CommitmentPoolingAcceptanceLib.addContributor(
            env, commitmentConfirmers, contributors, commitmentId, commitment, msg.sender, msg.sender
        );
    }

    function leaveCommitment(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        mapping(uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record))
            storage contributors,
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        uint256 commitmentId
    )
        external
    {
        ICommitmentPoolingModule.Commitment storage commitment =
            CommitmentPoolingGuardLib.requireAcceptedUnfrozen(commitments, commitmentId);
        if (commitment.contributorPolicy != ICommitmentPoolingModule.ContributorPolicy.Open) {
            revert ICommitmentPoolingModule.ContributorPolicyMismatch(commitmentId);
        }
        if (msg.sender == commitment.leadProvider) {
            revert ICommitmentPoolingModule.LeadContributorCannotLeave(commitmentId);
        }
        CommitmentPoolingAcceptanceLib.removeActiveContributor(
            env, commitmentConfirmers, contributors, commitmentId, commitment, msg.sender
        );
    }

    function removeContributor(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        mapping(uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record))
            storage contributors,
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        uint256 commitmentId,
        address contributor
    )
        external
    {
        ICommitmentPoolingModule.Commitment storage commitment =
            CommitmentPoolingGuardLib.requireAcceptedUnfrozen(commitments, commitmentId);
        // Open rosters use self-join and self-leave and can never expel.
        if (commitment.contributorPolicy != ICommitmentPoolingModule.ContributorPolicy.LeadManaged) {
            revert ICommitmentPoolingModule.ContributorPolicyMismatch(commitmentId);
        }
        if (
            msg.sender != commitment.leadProvider
                && !CommitmentPoolingGuardLib.isPoolSteward(env, pools, commitment.poolId, msg.sender)
        ) {
            revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        }
        if (contributor == commitment.leadProvider) {
            revert ICommitmentPoolingModule.LeadContributorCannotLeave(commitmentId);
        }
        CommitmentPoolingAcceptanceLib.removeActiveContributor(
            env, commitmentConfirmers, contributors, commitmentId, commitment, contributor
        );
    }

    /// @notice Optional planning signal; assignment is never recognition credit.
    function setContributorRequirement(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        mapping(uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record))
            storage contributors,
        mapping(uint256 commitmentId => mapping(uint16 requirementIndex => mapping(address contributor => bool assigned)))
            storage requirementAssignments,
        uint256 commitmentId,
        address contributor,
        uint16 requirementIndex,
        bool assigned
    )
        external
    {
        ICommitmentPoolingModule.Commitment storage commitment =
            CommitmentPoolingGuardLib.requireAcceptedUnfrozen(commitments, commitmentId);
        if (
            msg.sender != commitment.leadProvider
                && !CommitmentPoolingGuardLib.isPoolSteward(env, pools, commitment.poolId, msg.sender)
        ) {
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
}
