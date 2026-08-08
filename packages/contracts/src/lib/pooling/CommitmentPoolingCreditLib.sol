// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { IWorkDecisionSequenceResolver } from "../../interfaces/IWorkDecisionSequenceResolver.sol";
import { CommitmentPoolingCommonLib } from "./CommitmentPoolingCommonLib.sol";

/// @title CommitmentPoolingCreditLib
/// @notice Contribution credit, readiness freeze, and confirmer reachability — the shared engine
///         behind proof, sync, confirmation, terminal, roster, and claims behavior.
/// @dev Internal-only: inlined into each deployed behavior library, never deployed itself.
///      Semantics must stay byte-for-byte equivalent to the retired `CommitmentPoolingCredit`
///      facet; every doc comment that governed a decision rides along with its function.
library CommitmentPoolingCreditLib {
    /// @dev Recognition eligibility, defined once: a still-active contributor of a Fulfilled
    ///      commitment whose roster has frozen, holding at least one verified credit.
    function isEligibleContributor(
        mapping(uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record))
            storage contributors,
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        address contributor
    )
        internal
        view
        returns (bool)
    {
        ICommitmentPoolingModule.ContributorRecord storage record = contributors[commitmentId][contributor];
        return commitment.state == ICommitmentPoolingModule.CommitmentState.Fulfilled && commitment.contributorsFrozen
            && record.active && (record.approvedWorkCredits != 0 || record.evidenceCredits != 0);
    }

    function eligibleNamedConfirmerCount(
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        mapping(uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record))
            storage contributors,
        uint256 commitmentId,
        address prospectiveContributor
    )
        internal
        view
        returns (uint256 count)
    {
        address[] storage named = commitmentConfirmers[commitmentId];
        for (uint256 i = 0; i < named.length; i++) {
            address confirmer = named[i];
            if (confirmer != prospectiveContributor && !contributors[commitmentId][confirmer].active) count++;
        }
    }

    function freezeAndReady(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 cycleId => ICommitmentPoolingModule.Cycle cycle) storage cycles,
        mapping(uint256 commitmentId => bytes32[] activeWorkUIDs) storage commitmentWorkUIDs,
        mapping(bytes32 workUID => uint64 sequence) storage latestWorkDecisionSequence,
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        mapping(uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record))
            storage contributors,
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        bool overridden,
        string memory reason
    )
        internal
    {
        if (commitment.totalVerifiedCredits == 0) {
            revert ICommitmentPoolingModule.NoEligibleContributors(commitmentId);
        }
        if (commitment.cycleId != 0 && cycles[commitment.cycleId].state != ICommitmentPoolingModule.CycleState.Open) {
            revert ICommitmentPoolingModule.RecognitionPolicyUnavailable(commitment.cycleId);
        }
        assertWorkDecisionsFresh(env, commitmentWorkUIDs, latestWorkDecisionSequence, commitmentId);
        assertConfirmationReachable(env, commitmentConfirmers, contributors, commitmentId, commitment);
        commitment.contributorsFrozen = true;
        commitment.state = ICommitmentPoolingModule.CommitmentState.ReadyForConfirmation;
        emit ICommitmentPoolingModule.ContributorRosterFrozen(commitmentId, commitment.contributorCount);
        emit ICommitmentPoolingModule.CommitmentReadyForConfirmation(commitmentId, overridden, reason);
    }

    function assertWorkDecisionsFresh(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 commitmentId => bytes32[] activeWorkUIDs) storage commitmentWorkUIDs,
        mapping(bytes32 workUID => uint64 sequence) storage latestWorkDecisionSequence,
        uint256 commitmentId
    )
        internal
        view
    {
        bytes32[] storage workUIDs = commitmentWorkUIDs[commitmentId];
        for (uint256 i = 0; i < workUIDs.length; i++) {
            bytes32 workUID = workUIDs[i];
            uint64 expected = IWorkDecisionSequenceResolver(env.workApprovalResolver).latestDecisionSequence(workUID);
            uint64 supplied = latestWorkDecisionSequence[workUID];
            if (expected != supplied) {
                revert ICommitmentPoolingModule.IncompleteDecisionHistory(workUID, expected, supplied);
            }
        }
    }

    function requirementsComplete(ICommitmentPoolingModule.Commitment storage commitment) internal view returns (bool) {
        if (commitment.commitmentType == ICommitmentPoolingModule.CommitmentType.DomainImpact) {
            for (uint256 i = 0; i < commitment.requirements.length; i++) {
                if (commitment.requirements[i].approvedCount < commitment.requirements[i].requiredCount) return false;
            }
            return commitment.requirements.length != 0;
        }
        return commitment.evidenceCount != 0 && commitment.totalVerifiedCredits != 0;
    }

    function approvedUnits(ICommitmentPoolingModule.Commitment storage commitment) internal view returns (uint256) {
        uint256 approved;
        uint256 required;
        for (uint256 i = 0; i < commitment.requirements.length; i++) {
            ICommitmentPoolingModule.CommitmentRequirement storage requirement = commitment.requirements[i];
            required += requirement.requiredCount;
            approved += requirement.approvedCount < requirement.requiredCount
                ? requirement.approvedCount
                : requirement.requiredCount;
        }
        return required == 0 ? 0 : commitment.targetUnits * approved / required;
    }

    function isOrdinaryConfirmer(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        address account
    )
        internal
        view
        returns (bool)
    {
        address[] storage named = commitmentConfirmers[commitmentId];
        if (named.length != 0) {
            for (uint256 i = 0; i < named.length; i++) {
                if (named[i] == account) return true;
            }
            return false;
        }
        address defaultConfirmer = commitment.direction == ICommitmentPoolingModule.CommitmentDirection.Offer
            ? commitment.counterparty
            : commitment.creator;
        if (
            commitment.direction == ICommitmentPoolingModule.CommitmentDirection.Offer
                && commitment.counterpartyKind == ICommitmentPoolingModule.ClaimType.Garden
        ) {
            if (account == defaultConfirmer) return false;
            return env.hats.isStewardOf(defaultConfirmer, account) || env.hats.isOwnerOf(defaultConfirmer, account);
        }
        return account == defaultConfirmer;
    }

    function assertConfirmationReachable(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        mapping(uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record))
            storage contributors,
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment
    )
        internal
        view
    {
        if (commitment.protocolFallbackEnabled) {
            if (env.protocolPoolId == 0) revert ICommitmentPoolingModule.ModuleNotReady();
            return;
        }

        address[] storage named = commitmentConfirmers[commitmentId];
        if (named.length != 0) {
            if (
                eligibleNamedConfirmerCount(commitmentConfirmers, contributors, commitmentId, address(0))
                    < commitment.confirmationThreshold
            ) {
                revert ICommitmentPoolingModule.ConfirmationThresholdUnreachable(commitmentId);
            }
            return;
        }

        if (commitment.direction == ICommitmentPoolingModule.CommitmentDirection.Request) {
            if (contributors[commitmentId][commitment.creator].active) {
                revert ICommitmentPoolingModule.ConfirmationThresholdUnreachable(commitmentId);
            }
            return;
        }
        if (
            commitment.counterpartyKind == ICommitmentPoolingModule.ClaimType.Individual
                && contributors[commitmentId][commitment.counterparty].active
        ) revert ICommitmentPoolingModule.ConfirmationThresholdUnreachable(commitmentId);

        // Garden recipients are deliberately absent here. See ordinaryConfirmationReachable.
    }

    /// @notice Whether the ordinary named/default path can still produce a confirmation.
    /// @dev Named groups, Request creators, and Individual Offer counterparties are single
    ///      addresses checked against the frozen contributor set, so each is exactly decidable.
    ///      Garden recipients are NOT decidable and conservatively answer true — nothing on-chain
    ///      can enumerate current owner/steward Hat wearers, and a wearer count never falls on
    ///      revocation (HatsModule transfers to a burn address). The spec-owned recovery for a
    ///      stuck Garden Offer is the terminal machinery: raiseDispute and expireCommitment.
    function ordinaryConfirmationReachable(
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        mapping(uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record))
            storage contributors,
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment
    )
        internal
        view
        returns (bool)
    {
        address[] storage named = commitmentConfirmers[commitmentId];
        if (named.length != 0) {
            return eligibleNamedConfirmerCount(commitmentConfirmers, contributors, commitmentId, address(0))
                >= commitment.confirmationThreshold;
        }
        if (commitment.direction == ICommitmentPoolingModule.CommitmentDirection.Request) {
            return !contributors[commitmentId][commitment.creator].active;
        }
        if (commitment.counterpartyKind == ICommitmentPoolingModule.ClaimType.Garden) {
            return true;
        }
        return !contributors[commitmentId][commitment.counterparty].active;
    }

    function fulfillCommitment(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 cycleId => ICommitmentPoolingModule.Cycle cycle) storage cycles,
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        address confirmer,
        ICommitmentPoolingModule.ConfirmationPath path,
        string memory reason
    )
        internal
    {
        commitment.state = ICommitmentPoolingModule.CommitmentState.Fulfilled;
        pools[commitment.poolId].liveCommitmentCount--;
        if (commitment.cycleId != 0) cycles[commitment.cycleId].liveCommitmentCount--;
        env.registry.fulfillUnits(commitmentId, commitment.leadProvider, commitment.targetUnits);
        emit ICommitmentPoolingModule.CommitmentFulfilled(commitmentId, confirmer, path, reason);
    }
}
