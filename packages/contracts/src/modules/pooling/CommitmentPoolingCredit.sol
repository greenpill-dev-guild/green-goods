// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS, Attestation } from "@eas/IEAS.sol";

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentRegistry } from "../../interfaces/ICommitmentRegistry.sol";
import { IHatsModule } from "../../interfaces/IHatsModule.sol";
import { ActionRegistry } from "../../registries/Action.sol";
import { CommitmentPoolingAccess, IWorkDecisionSequenceResolver } from "./CommitmentPoolingAccess.sol";

/// @title CommitmentPoolingCredit
/// @notice Contribution credit, readiness freeze, and confirmer reachability.
abstract contract CommitmentPoolingCredit is CommitmentPoolingAccess {
    /// @dev Recognition eligibility, defined once: a still-active contributor of a Fulfilled
    ///      commitment whose roster has frozen, holding at least one verified credit.
    function _isEligibleContributor(
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

    function _eligibleNamedConfirmerCount(
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

    function _freezeAndReady(
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
        _assertWorkDecisionsFresh(commitmentId);
        _assertConfirmationReachable(commitmentId, commitment);
        commitment.contributorsFrozen = true;
        commitment.state = ICommitmentPoolingModule.CommitmentState.ReadyForConfirmation;
        emit ICommitmentPoolingModule.ContributorRosterFrozen(commitmentId, commitment.contributorCount);
        emit ICommitmentPoolingModule.CommitmentReadyForConfirmation(commitmentId, overridden, reason);
    }

    function _assertWorkDecisionsFresh(uint256 commitmentId) internal view {
        bytes32[] storage workUIDs = commitmentWorkUIDs[commitmentId];
        for (uint256 i = 0; i < workUIDs.length; i++) {
            bytes32 workUID = workUIDs[i];
            uint64 expected = IWorkDecisionSequenceResolver(workApprovalResolver).latestDecisionSequence(workUID);
            uint64 supplied = latestWorkDecisionSequence[workUID];
            if (expected != supplied) {
                revert ICommitmentPoolingModule.IncompleteDecisionHistory(workUID, expected, supplied);
            }
        }
    }

    function _requirementsComplete(ICommitmentPoolingModule.Commitment storage commitment) internal view returns (bool) {
        if (commitment.commitmentType == ICommitmentPoolingModule.CommitmentType.DomainImpact) {
            for (uint256 i = 0; i < commitment.requirements.length; i++) {
                if (commitment.requirements[i].approvedCount < commitment.requirements[i].requiredCount) return false;
            }
            return commitment.requirements.length != 0;
        }
        return commitment.evidenceCount != 0 && commitment.totalVerifiedCredits != 0;
    }

    function _approvedUnits(ICommitmentPoolingModule.Commitment storage commitment) internal view returns (uint256) {
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

    function _isOrdinaryConfirmer(
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
            return _isGardenSteward(defaultConfirmer, account);
        }
        return account == defaultConfirmer;
    }

    function _assertConfirmationReachable(
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment
    )
        internal
        view
    {
        if (commitment.protocolFallbackEnabled) {
            if (protocolPoolId == 0) revert ICommitmentPoolingModule.ModuleNotReady();
            return;
        }

        address[] storage named = commitmentConfirmers[commitmentId];
        if (named.length != 0) {
            if (_eligibleNamedConfirmerCount(commitmentId, address(0)) < commitment.confirmationThreshold) {
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

        // Garden recipients are deliberately absent here. See _ordinaryConfirmationReachable.
    }

    /// @notice Whether the ordinary named/default path can still produce a confirmation.
    /// @dev Named groups, Request creators, and Individual Offer counterparties are single
    ///      addresses checked against the frozen contributor set, so each is exactly decidable.
    ///
    ///      Garden recipients are NOT decidable and conservatively answer true. The default
    ///      confirmer is a set of current owner/steward Hat wearers, and nothing on-chain can
    ///      enumerate that set: IHatsModule exposes only per-account predicates, and
    ///      IHats.viewHat returns a count that never falls on revocation, because
    ///      HatsModule._revokeRole transfers the Hat to a burn address instead of burning it
    ///      (Hats.sol:716). A wearer count therefore cannot show that a garden went dark, nor
    ///      exclude wearers who are frozen contributors. Answering false on that unknown would
    ///      let pool or protocol authority override a still-live ordinary confirmer, so this
    ///      refuses fallback rather than leaking authority.
    ///
    ///      A Garden Offer whose confirmers all become ineligible after the freeze is therefore
    ///      stuck on the confirmation path, and this predicate is deliberately not where that is
    ///      fixed. The spec-owned recovery is the terminal machinery (contract-spec.md 223-224):
    ///      raiseDispute is available to a steward from ReadyForConfirmation with no time gate and
    ///      resolves to Fulfilled, which also covers cycle-less commitments whose dueDate is 0;
    ///      expireCommitment additionally offers a permissionless past-due exit. Both are frozen in
    ///      ICommitmentPoolingModule and remain unimplemented in this checkpoint, so the gap is
    ///      open and characterized by tests rather than silently patched here.
    function _ordinaryConfirmationReachable(
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment
    )
        internal
        view
        returns (bool)
    {
        address[] storage named = commitmentConfirmers[commitmentId];
        if (named.length != 0) {
            return _eligibleNamedConfirmerCount(commitmentId, address(0)) >= commitment.confirmationThreshold;
        }
        if (commitment.direction == ICommitmentPoolingModule.CommitmentDirection.Request) {
            return !contributors[commitmentId][commitment.creator].active;
        }
        if (commitment.counterpartyKind == ICommitmentPoolingModule.ClaimType.Garden) {
            return true;
        }
        return !contributors[commitmentId][commitment.counterparty].active;
    }

    function _fulfillCommitment(
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
        commitmentRegistry.fulfillUnits(commitmentId, commitment.leadProvider, commitment.targetUnits);
        emit ICommitmentPoolingModule.CommitmentFulfilled(commitmentId, confirmer, path, reason);
    }
}
