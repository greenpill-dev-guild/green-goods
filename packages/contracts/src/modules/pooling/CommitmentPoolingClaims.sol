// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS, Attestation } from "@eas/IEAS.sol";

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentRegistry } from "../../interfaces/ICommitmentRegistry.sol";
import { IHatsModule } from "../../interfaces/IHatsModule.sol";
import { ActionRegistry } from "../../registries/Action.sol";
import { CommitmentPoolingCreation, IWorkDecisionSequenceResolver } from "./CommitmentPoolingCreation.sol";

/// @title CommitmentPoolingClaims
/// @notice Claim, acceptance, and contributor roster entry.
abstract contract CommitmentPoolingClaims is CommitmentPoolingCreation {
    function claimCommitment(
        uint256 commitmentId,
        ICommitmentPoolingModule.ClaimType kind,
        address gardenContext
    )
        external
        whenOperational
        nonReentrant
    {
        ICommitmentPoolingModule.Commitment storage commitment = _requireCommitment(commitmentId);
        _requirePreAcceptanceState(commitmentId, commitment);
        if (kind != commitment.claimType) {
            revert ICommitmentPoolingModule.ClaimTypeMismatch(commitmentId, commitment.claimType, kind);
        }

        (address claimant, address requestedBy) = _resolveClaimant(commitment, kind, gardenContext);
        if (claimant == commitment.creator || requestedBy == commitment.creator) {
            revert ICommitmentPoolingModule.SelfCounterparty();
        }

        if (commitment.claimMode == ICommitmentPoolingModule.ClaimMode.Open) {
            _acceptCommitment(commitmentId, commitment, claimant, requestedBy, kind, gardenContext);
        } else {
            ICommitmentPoolingModule.PendingClaim storage claim = pendingClaim[commitmentId][claimant];
            claim.claimant = claimant;
            claim.requestedBy = requestedBy;
            claim.kind = kind;
            claim.gardenContext = gardenContext;
            claim.requestedAt = uint64(block.timestamp);
            claim.active = true;
            emit ICommitmentPoolingModule.ClaimRequested(
                commitmentId, claimant, requestedBy, kind, gardenContext, uint64(block.timestamp)
            );
        }
    }

    function acceptClaim(uint256 commitmentId, address claimant) external whenOperational nonReentrant {
        ICommitmentPoolingModule.Commitment storage commitment = _requireCommitment(commitmentId);
        _requirePreAcceptanceState(commitmentId, commitment);
        if (commitment.claimMode != ICommitmentPoolingModule.ClaimMode.ApprovalGated) {
            revert ICommitmentPoolingModule.ClaimModeMismatch(commitmentId);
        }
        ICommitmentPoolingModule.Pool storage pool = pools[commitment.poolId];
        _requirePoolSteward(commitment.poolId, pool);
        ICommitmentPoolingModule.PendingClaim storage claim = pendingClaim[commitmentId][claimant];
        if (!claim.active) revert ICommitmentPoolingModule.ClaimNotPending(commitmentId, claimant);
        if (claim.claimant == commitment.creator || claim.requestedBy == commitment.creator) {
            revert ICommitmentPoolingModule.SelfCounterparty();
        }
        ICommitmentPoolingModule.PendingClaim memory acceptedClaim = claim;
        delete pendingClaim[commitmentId][claimant];
        _acceptCommitment(
            commitmentId,
            commitment,
            acceptedClaim.claimant,
            acceptedClaim.requestedBy,
            acceptedClaim.kind,
            acceptedClaim.gardenContext
        );
    }

    function declineClaim(uint256 commitmentId, address claimant, string calldata reasonCID) external whenOperational {
        ICommitmentPoolingModule.Commitment storage commitment = _requireCommitment(commitmentId);
        ICommitmentPoolingModule.Pool storage pool = pools[commitment.poolId];
        _requirePoolSteward(commitment.poolId, pool);
        if (bytes(reasonCID).length == 0) revert ICommitmentPoolingModule.ReasonRequired();
        if (!pendingClaim[commitmentId][claimant].active) {
            revert ICommitmentPoolingModule.ClaimNotPending(commitmentId, claimant);
        }
        delete pendingClaim[commitmentId][claimant];
        emit ICommitmentPoolingModule.ClaimDeclined(commitmentId, claimant, reasonCID);
    }

    function addContributor(uint256 commitmentId, address contributor) external whenOperational {
        ICommitmentPoolingModule.Commitment storage commitment = _requireEditableRoster(commitmentId);
        if (commitment.contributorPolicy != ICommitmentPoolingModule.ContributorPolicy.LeadManaged) {
            revert ICommitmentPoolingModule.ContributorPolicyMismatch(commitmentId);
        }
        if (msg.sender != commitment.leadProvider && !_isPoolSteward(commitment.poolId, msg.sender)) {
            revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        }
        _addContributor(commitmentId, commitment, contributor, msg.sender);
    }

    function _resolveClaimant(
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
            if (gardenContext != pool.garden || !_isGardenMember(pool.garden, msg.sender)) {
                revert ICommitmentPoolingModule.NotEligibleClaimant(msg.sender);
            }
        } else if (kind == ICommitmentPoolingModule.ClaimType.Garden) {
            if (gardenPool[gardenContext] == 0 || !_isGardenSteward(gardenContext, msg.sender)) {
                revert ICommitmentPoolingModule.NotEligibleClaimant(msg.sender);
            }
        } else if (!_isGardenMember(gardenContext, msg.sender)) {
            revert ICommitmentPoolingModule.NotEligibleClaimant(msg.sender);
        }

        if (kind == ICommitmentPoolingModule.ClaimType.Garden) {
            claimant = gardenContext;
            requestedBy = msg.sender;
        } else {
            claimant = msg.sender;
            requestedBy = msg.sender;
        }
    }

    function _acceptCommitment(
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        address claimant,
        address requestedBy,
        ICommitmentPoolingModule.ClaimType kind,
        address gardenContext
    )
        internal
    {
        address leadProvider;
        address providerGarden;
        if (commitment.direction == ICommitmentPoolingModule.CommitmentDirection.Offer) {
            leadProvider = commitment.creator;
            providerGarden = pools[commitment.poolId].garden;
        } else {
            providerGarden = gardenContext;
            leadProvider = kind == ICommitmentPoolingModule.ClaimType.Garden ? requestedBy : claimant;
        }
        if (!_isGardenMember(providerGarden, leadProvider)) {
            revert ICommitmentPoolingModule.NotEligibleContributor(leadProvider);
        }
        if (commitment.contributorCount + 1 > MAX_CONTRIBUTORS_PER_COMMITMENT_VALUE) {
            revert ICommitmentPoolingModule.TooManyContributors(
                commitment.contributorCount + 1, MAX_CONTRIBUTORS_PER_COMMITMENT_VALUE
            );
        }

        _normalizeConfirmers(commitmentId, commitment, leadProvider);
        if (commitment.direction == ICommitmentPoolingModule.CommitmentDirection.Request) {
            commitmentRegistry.commitUnits(commitmentId, leadProvider, commitment.targetUnits);
        }

        commitment.counterparty = claimant;
        commitment.counterpartyKind = kind;
        commitment.leadProvider = leadProvider;
        commitment.providerGarden = providerGarden;
        commitment.state = ICommitmentPoolingModule.CommitmentState.Accepted;
        ICommitmentPoolingModule.ContributorRecord storage lead = contributors[commitmentId][leadProvider];
        lead.active = true;
        commitment.contributorCount = 1;

        emit ICommitmentPoolingModule.ContributorAdded(commitmentId, leadProvider, requestedBy);
        emit ICommitmentPoolingModule.CommitmentAccepted(
            commitmentId, claimant, claimant, kind, gardenContext, leadProvider, providerGarden
        );
    }

    function _normalizeConfirmers(
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

    function _addContributor(
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
        if (!_isGardenMember(commitment.providerGarden, contributor)) {
            revert ICommitmentPoolingModule.NotEligibleContributor(contributor);
        }
        uint256 supplied = commitment.contributorCount + 1;
        if (supplied > MAX_CONTRIBUTORS_PER_COMMITMENT_VALUE) {
            revert ICommitmentPoolingModule.TooManyContributors(supplied, MAX_CONTRIBUTORS_PER_COMMITMENT_VALUE);
        }
        // Activate first so reachability is evaluated against the roster this mutation would
        // actually produce; a revert unwinds the write. Checking only the named group here used
        // to let the direction-aware default confirmer — an Individual Offer counterparty or a
        // Request creator — join the roster and strand the commitment: once they hold evidence
        // credit they can no longer leave, and every Ready path reverts
        // ConfirmationThresholdUnreachable with units and live counts reserved indefinitely.
        contributors[commitmentId][contributor].active = true;
        commitment.contributorCount++;
        _assertConfirmationReachable(commitmentId, commitment);
        emit ICommitmentPoolingModule.ContributorAdded(commitmentId, contributor, addedBy);
    }
}
