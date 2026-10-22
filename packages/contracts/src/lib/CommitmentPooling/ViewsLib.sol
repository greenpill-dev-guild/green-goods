// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentServiceOffers } from "../../interfaces/ICommitmentServiceOffers.sol";
import { CommitmentPoolingCyclesLib } from "./CyclesLib.sol";
import { CommitmentPoolingGuardLib } from "./GuardLib.sol";
import { CommitmentPoolingSeriesLib } from "./SeriesLib.sol";
import { CommitmentPoolingServiceOfferStorageLib } from "./ServiceOfferStorageLib.sol";

/// @title CommitmentPoolingViewsLib
/// @notice Deployed behavior library: the struct- and array-returning read views.
/// @dev These carry the largest ABI encoders in the module (the 40-field `Commitment` above all),
///      so they live here and the module shells forward the raw return data without re-encoding —
///      see `CommitmentPoolingAccess._forwardView`. Scalar views stay module-side where a plain
///      mapping read is already minimal. Runs via DELEGATECALL from `CommitmentPoolingModule`.
library CommitmentPoolingViewsLib {
    function getServiceOfferTerms(
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        uint256 commitmentId
    )
        external
        view
        returns (ICommitmentServiceOffers.ServiceOfferTerms memory)
    {
        CommitmentPoolingGuardLib.requireCommitment(commitments, commitmentId);
        return CommitmentPoolingServiceOfferStorageLib.state().terms[commitmentId];
    }

    function getServiceClaimConsent(
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        uint256 commitmentId,
        address buyer
    )
        external
        view
        returns (ICommitmentServiceOffers.ServiceClaimConsent memory)
    {
        CommitmentPoolingGuardLib.requireCommitment(commitments, commitmentId);
        return CommitmentPoolingServiceOfferStorageLib.state().claimConsent[commitmentId][buyer];
    }

    function getAcceptedServiceTerms(
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        uint256 commitmentId
    )
        external
        view
        returns (ICommitmentServiceOffers.AcceptedServiceTerms memory accepted)
    {
        ICommitmentPoolingModule.Commitment storage commitment =
            CommitmentPoolingGuardLib.requireCommitment(commitments, commitmentId);
        CommitmentPoolingServiceOfferStorageLib.State storage state = CommitmentPoolingServiceOfferStorageLib.state();
        if (state.acceptedConsent[commitmentId].termsRevision == 0) return accepted;
        accepted.offer = state.terms[commitmentId];
        accepted.consent = state.acceptedConsent[commitmentId];
        if (
            commitment.counterparty == address(0)
                || commitment.counterpartyKind != ICommitmentPoolingModule.ClaimType.Individual
                || commitment.payerGarden != accepted.consent.buyerGarden
                || accepted.offer.revision != accepted.consent.termsRevision
                || accepted.offer.termsHash != accepted.consent.termsHash
        ) {
            revert ICommitmentServiceOffers.ServiceClaimConsentMismatch(commitmentId, commitment.counterparty);
        }
        accepted.buyer = commitment.counterparty;
        accepted.serviceRecipient = commitment.counterparty;
        accepted.providerGarden = commitment.providerGarden;
        accepted.serviceUnits = commitment.targetUnits;
        accepted.unitLabelHash = keccak256(bytes(commitment.unitLabel));
        accepted.gdPrice = commitment.consideration.amount;
    }

    function getCommitment(
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        uint256 commitmentId
    )
        external
        view
        returns (ICommitmentPoolingModule.Commitment memory)
    {
        return CommitmentPoolingGuardLib.requireCommitment(commitments, commitmentId);
    }

    function getRequirement(
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        uint256 commitmentId,
        uint16 requirementIndex
    )
        external
        view
        returns (ICommitmentPoolingModule.CommitmentRequirement memory)
    {
        ICommitmentPoolingModule.Commitment storage commitment =
            CommitmentPoolingGuardLib.requireCommitment(commitments, commitmentId);
        if (requirementIndex >= commitment.requirements.length) {
            revert ICommitmentPoolingModule.InvalidRequirementCount(requirementIndex);
        }
        return commitment.requirements[requirementIndex];
    }

    function getContributor(
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        mapping(
            uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record)
        ) storage contributors,
        uint256 commitmentId,
        address contributor
    )
        external
        view
        returns (ICommitmentPoolingModule.ContributorRecord memory)
    {
        CommitmentPoolingGuardLib.requireCommitment(commitments, commitmentId);
        return contributors[commitmentId][contributor];
    }

    function getPendingClaim(
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        mapping(
            uint256 commitmentId => mapping(address claimant => ICommitmentPoolingModule.PendingClaim claim)
        ) storage pendingClaim,
        uint256 commitmentId,
        address claimant
    )
        external
        view
        returns (ICommitmentPoolingModule.PendingClaim memory)
    {
        CommitmentPoolingGuardLib.requireCommitment(commitments, commitmentId);
        return pendingClaim[commitmentId][claimant];
    }

    function getConfirmers(
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        uint256 commitmentId
    )
        external
        view
        returns (address[] memory)
    {
        CommitmentPoolingGuardLib.requireCommitment(commitments, commitmentId);
        return commitmentConfirmers[commitmentId];
    }

    function getLinkedWorkUIDs(
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        mapping(uint256 commitmentId => bytes32[] activeWorkUIDs) storage commitmentWorkUIDs,
        uint256 commitmentId
    )
        external
        view
        returns (bytes32[] memory)
    {
        CommitmentPoolingGuardLib.requireCommitment(commitments, commitmentId);
        return commitmentWorkUIDs[commitmentId];
    }

    function getPool(
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        uint256 poolId
    )
        external
        view
        returns (ICommitmentPoolingModule.Pool memory)
    {
        return CommitmentPoolingGuardLib.requirePool(pools, poolId);
    }

    function getPoolByGarden(
        mapping(address garden => uint256 poolId) storage gardenPool,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        address garden
    )
        external
        view
        returns (uint256 poolId, ICommitmentPoolingModule.Pool memory pool)
    {
        poolId = gardenPool[garden];
        if (poolId != 0) pool = pools[poolId];
    }

    function getCycle(
        mapping(uint256 cycleId => ICommitmentPoolingModule.Cycle cycle) storage cycles,
        uint256 cycleId
    )
        external
        view
        returns (ICommitmentPoolingModule.Cycle memory)
    {
        return CommitmentPoolingCyclesLib.requireCycle(cycles, cycleId);
    }

    function getCommitmentSeries(
        mapping(uint256 seriesId => ICommitmentPoolingModule.CommitmentSeries series) storage commitmentSeries,
        uint256 seriesId
    )
        external
        view
        returns (ICommitmentPoolingModule.CommitmentSeries memory)
    {
        return CommitmentPoolingSeriesLib.requireSeries(commitmentSeries, seriesId);
    }
}
