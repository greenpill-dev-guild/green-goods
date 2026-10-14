// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingCommonLib } from "./CommonLib.sol";
import { CommitmentPoolingCreditLib } from "./CreditLib.sol";
import { CommitmentPoolingGuardLib } from "./GuardLib.sol";

/// @title CommitmentPoolingAcceptanceLib
/// @notice Claimant resolution, acceptance, confirmer normalization, and roster entry/exit —
///         shared by claims, roster, and bilateral exchange behavior.
/// @dev Internal-only: inlined into each deployed behavior library, never deployed itself.
library CommitmentPoolingAcceptanceLib {
    /// @dev A priced Offer needs the distinct request -> steward decision boundary. ApprovalGated
    ///      claims stop at a pending request and bind neither the garden nor the provider; Open
    ///      mode cannot supply that boundary and therefore rejects every caller, including a
    ///      steward.
    function requirePricedOfferClaimAuthority(
        ICommitmentPoolingModule.Commitment storage commitment,
        ICommitmentPoolingModule.ClaimType kind,
        address gardenContext,
        address claimant
    )
        internal
        view
    {
        bool priced = kind == ICommitmentPoolingModule.ClaimType.Individual && gardenContext != address(0)
            && commitment.direction == ICommitmentPoolingModule.CommitmentDirection.Offer
            && commitment.consideration.amount != 0;
        if (!priced || commitment.claimMode == ICommitmentPoolingModule.ClaimMode.ApprovalGated) return;
        revert ICommitmentPoolingModule.PricedOfferClaimRequiresSteward(gardenContext, claimant);
    }

    /// @dev Approval can arrive long after the request. Re-establish current membership before a
    ///      steward binds the payer. Garden claims remain institutional acts by `requestedBy`.
    function requireOfferClaimAuthorityAtAcceptance(
        CommitmentPoolingCommonLib.Env memory env,
        ICommitmentPoolingModule.Commitment storage commitment,
        ICommitmentPoolingModule.ClaimType kind,
        address gardenContext,
        address claimant,
        address requestedBy
    )
        internal
        view
    {
        if (commitment.direction != ICommitmentPoolingModule.CommitmentDirection.Offer || gardenContext == address(0)) {
            return;
        }
        if (kind == ICommitmentPoolingModule.ClaimType.Garden) {
            if (!CommitmentPoolingGuardLib.isGardenSteward(env.hats, gardenContext, requestedBy)) {
                revert ICommitmentPoolingModule.NotEligibleClaimant(requestedBy);
            }
            return;
        }
        if (!CommitmentPoolingGuardLib.isGardenMember(env.hats, gardenContext, claimant)) {
            revert ICommitmentPoolingModule.NotEligibleClaimant(claimant);
        }
        requirePricedOfferClaimAuthority(commitment, kind, gardenContext, claimant);
    }

    function resolveClaimant(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(address garden => uint256 poolId) storage gardenPool,
        ICommitmentPoolingModule.Commitment storage commitment,
        ICommitmentPoolingModule.ClaimType kind,
        address gardenContext
    )
        internal
        view
        returns (address claimant, address requestedBy)
    {
        ICommitmentPoolingModule.Pool storage pool = pools[commitment.poolId];
        if (pool.poolType == ICommitmentPoolingModule.PoolType.Garden) {
            // Creation already refuses a garden-pool Garden claim; this keeps the invariant local
            // to the branch that would otherwise resolve the claimant to the pool's own garden.
            if (kind == ICommitmentPoolingModule.ClaimType.Garden) {
                revert ICommitmentPoolingModule.GardenClaimRequiresProtocolPool(commitment.poolId);
            }
            if (
                gardenContext != pool.garden || !CommitmentPoolingGuardLib.isGardenMember(env.hats, pool.garden, msg.sender)
            ) {
                revert ICommitmentPoolingModule.NotEligibleClaimant(msg.sender);
            }
        } else if (kind == ICommitmentPoolingModule.ClaimType.Garden) {
            if (gardenContext == pool.garden) {
                revert ICommitmentPoolingModule.GardenClaimMustBeExternal(commitment.poolId, gardenContext);
            }
            if (
                gardenPool[gardenContext] == 0
                    || !CommitmentPoolingGuardLib.isGardenSteward(env.hats, gardenContext, msg.sender)
            ) {
                revert ICommitmentPoolingModule.NotEligibleClaimant(msg.sender);
            }
        } else if (!CommitmentPoolingGuardLib.isGardenMember(env.hats, gardenContext, msg.sender)) {
            revert ICommitmentPoolingModule.NotEligibleClaimant(msg.sender);
        } else {
            requirePricedOfferClaimAuthority(commitment, kind, gardenContext, msg.sender);
        }

        if (kind == ICommitmentPoolingModule.ClaimType.Garden) {
            claimant = gardenContext;
            requestedBy = msg.sender;
        } else {
            claimant = msg.sender;
            requestedBy = msg.sender;
        }
    }

    function acceptCommitment(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(
            uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record)
        ) storage contributors,
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        address claimant,
        address requestedBy,
        ICommitmentPoolingModule.ClaimType kind,
        address gardenContext,
        bool enforceClaimAuthority
    )
        internal
    {
        ICommitmentPoolingModule.Pool storage pool = pools[commitment.poolId];
        // Keep the recipient invariant at the final acceptance mutation, too. This closes the
        // approval path for any pre-upgrade/backfilled pending claim that did not pass today's
        // creation or claim-request checks.
        if (kind == ICommitmentPoolingModule.ClaimType.Garden && pool.poolType == ICommitmentPoolingModule.PoolType.Garden)
        {
            revert ICommitmentPoolingModule.GardenClaimRequiresProtocolPool(commitment.poolId);
        }
        if (kind == ICommitmentPoolingModule.ClaimType.Garden && gardenContext == pool.garden) {
            revert ICommitmentPoolingModule.GardenClaimMustBeExternal(commitment.poolId, gardenContext);
        }
        address leadProvider;
        address providerGarden;
        if (commitment.direction == ICommitmentPoolingModule.CommitmentDirection.Offer) {
            leadProvider = commitment.creator;
            providerGarden = pool.garden;
        } else {
            providerGarden = gardenContext;
            leadProvider = kind == ICommitmentPoolingModule.ClaimType.Garden ? requestedBy : claimant;
        }
        if (!CommitmentPoolingGuardLib.isGardenMember(env.hats, providerGarden, leadProvider)) {
            revert ICommitmentPoolingModule.NotEligibleContributor(leadProvider);
        }
        // Re-checked here, not just at claim time: for an Offer the roster check above covers the
        // creator, never the claimant, so nothing else here would notice a claimant who lost
        // membership while an approval-gated claim sat pending. Ordered after that check so the
        // provider-side error stays the specific one where both apply.
        // Bilateral exchange passes false because its preflight rechecks both creators as current
        // providers and does not consume a pending claim. Ordinary Open and ApprovalGated claims
        // pass true; only the latter can have stale authority between request and acceptance.
        if (enforceClaimAuthority) {
            requireOfferClaimAuthorityAtAcceptance(env, commitment, kind, gardenContext, claimant, requestedBy);
        }
        if (commitment.contributorCount + 1 > CommitmentPoolingCommonLib.MAX_CONTRIBUTORS_PER_COMMITMENT) {
            revert ICommitmentPoolingModule.TooManyContributors(
                commitment.contributorCount + 1, CommitmentPoolingCommonLib.MAX_CONTRIBUTORS_PER_COMMITMENT
            );
        }

        normalizeConfirmers(commitmentConfirmers, commitmentId, commitment, leadProvider);
        if (commitment.direction == ICommitmentPoolingModule.CommitmentDirection.Request) {
            env.registry.commitUnits(commitmentId, leadProvider, commitment.targetUnits);
        }

        commitment.counterparty = claimant;
        commitment.counterpartyKind = kind;
        commitment.leadProvider = leadProvider;
        commitment.providerGarden = providerGarden;
        // An Offer's payer is the side receiving it, which only exists once someone claims. A
        // Request already stored its payer at creation, so acceptance must not overwrite it —
        // the claimant of a Request is the provider, never the payer (register #90).
        if (commitment.direction == ICommitmentPoolingModule.CommitmentDirection.Offer) {
            commitment.payerGarden = gardenContext;
        }
        commitment.state = ICommitmentPoolingModule.CommitmentState.Accepted;
        ICommitmentPoolingModule.ContributorRecord storage lead = contributors[commitmentId][leadProvider];
        lead.active = true;
        commitment.contributorCount = 1;

        emit ICommitmentPoolingModule.ContributorAdded(commitmentId, leadProvider, requestedBy);
        emit ICommitmentPoolingModule.CommitmentAccepted(
            commitmentId, claimant, claimant, kind, gardenContext, leadProvider, providerGarden, commitment.payerGarden
        );
    }

    function normalizeConfirmers(
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        address leadProvider
    )
        internal
    {
        address[] storage submitted = commitmentConfirmers[commitmentId];
        if (submitted.length == 0) return;
        address[] memory normalized = new address[](submitted.length);
        uint256 normalizedLength;
        for (uint256 i = 0; i < submitted.length; i++) {
            address confirmer = submitted[i];
            if (confirmer == address(0) || confirmer == leadProvider) continue;
            bool duplicate;
            for (uint256 j = 0; j < normalizedLength; j++) {
                if (normalized[j] == confirmer) {
                    duplicate = true;
                    break;
                }
            }
            if (!duplicate) normalized[normalizedLength++] = confirmer;
        }
        if (normalizedLength < commitment.confirmationThreshold && !commitment.protocolFallbackEnabled) {
            revert ICommitmentPoolingModule.InvalidConfirmerRule();
        }
        delete commitmentConfirmers[commitmentId];
        for (uint256 i = 0; i < normalizedLength; i++) {
            commitmentConfirmers[commitmentId].push(normalized[i]);
        }
    }

    function addContributor(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        mapping(
            uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record)
        ) storage contributors,
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        address contributor,
        address addedBy
    )
        internal
    {
        if (contributor == address(0)) revert ICommitmentPoolingModule.ZeroAddress();
        if (contributors[commitmentId][contributor].active) {
            revert ICommitmentPoolingModule.ContributorAlreadyActive(contributor);
        }
        if (!CommitmentPoolingGuardLib.isGardenMember(env.hats, commitment.providerGarden, contributor)) {
            revert ICommitmentPoolingModule.NotEligibleContributor(contributor);
        }
        uint256 supplied = commitment.contributorCount + 1;
        if (supplied > CommitmentPoolingCommonLib.MAX_CONTRIBUTORS_PER_COMMITMENT) {
            revert ICommitmentPoolingModule.TooManyContributors(
                supplied, CommitmentPoolingCommonLib.MAX_CONTRIBUTORS_PER_COMMITMENT
            );
        }
        // Activate first so reachability is evaluated against the roster this mutation would
        // actually produce; a revert unwinds the write. Checking only the named group here used
        // to let the direction-aware default confirmer — an Individual Offer counterparty or a
        // Request creator — join the roster and strand the commitment: once they hold evidence
        // credit they can no longer leave, and every Ready path reverts
        // ConfirmationThresholdUnreachable with units and live counts reserved indefinitely.
        contributors[commitmentId][contributor].active = true;
        commitment.contributorCount++;
        CommitmentPoolingCreditLib.assertConfirmationReachable(
            env, commitmentConfirmers, contributors, commitmentId, commitment
        );
        emit ICommitmentPoolingModule.ContributorAdded(commitmentId, contributor, addedBy);
    }

    /// @dev A contributor carrying linked Work or any credit is part of the proof record and can
    ///      no longer be detached without rewriting that record.
    function removeActiveContributor(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        mapping(
            uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record)
        ) storage contributors,
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        address contributor
    )
        internal
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
        CommitmentPoolingCreditLib.assertConfirmationReachable(
            env, commitmentConfirmers, contributors, commitmentId, commitment
        );
    }
}
