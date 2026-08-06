// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingSync } from "./CommitmentPoolingSync.sol";

/// @title CommitmentPoolingExchange
/// @notice Atomic bilateral Offer x Offer acceptance.
/// @dev The only bilateral exception to the one-way `counterCommitmentId` reference. Consent is
///      two direct creator acts — B's creator consented by creating B, A's creator consents by
///      calling — which is stricter than either claim gate, so the ApprovalGated operator path is
///      never consulted and both claim modes are valid here. Lifecycle stays independent
///      afterwards: nothing in cancellation, expiry, dispute, or fulfilment reads the reference.
abstract contract CommitmentPoolingExchange is CommitmentPoolingSync {
    function acceptExchange(uint256 exchangeCommitmentId) external whenOperational nonReentrant {
        ICommitmentPoolingModule.Commitment storage offerB = _requireCommitment(exchangeCommitmentId);
        uint256 counterCommitmentId = offerB.counterCommitmentId;
        if (counterCommitmentId == 0) revert ICommitmentPoolingModule.ExchangeCounterpartMismatch(exchangeCommitmentId);
        ICommitmentPoolingModule.Commitment storage offerA = commitments[counterCommitmentId];
        if (offerA.state == ICommitmentPoolingModule.CommitmentState.None || offerA.poolId != offerB.poolId) {
            revert ICommitmentPoolingModule.ExchangeCounterpartMismatch(exchangeCommitmentId);
        }
        if (msg.sender != offerA.creator) revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);

        _requireExchangeEligible(counterCommitmentId, offerA, exchangeCommitmentId, offerB);

        // Each creator accepts the other's Offer and stays the lead provider of their own. Both
        // classes were reserved at Offer creation, so neither acceptance touches the registry.
        address gardenContext = pools[offerB.poolId].garden;
        address acceptorOfA = offerB.creator;
        _acceptCommitment(
            counterCommitmentId,
            offerA,
            acceptorOfA,
            acceptorOfA,
            ICommitmentPoolingModule.ClaimType.Individual,
            gardenContext
        );
        _acceptCommitment(
            exchangeCommitmentId,
            offerB,
            msg.sender,
            msg.sender,
            ICommitmentPoolingModule.ClaimType.Individual,
            gardenContext
        );
        emit ICommitmentPoolingModule.ExchangeAccepted(
            counterCommitmentId, exchangeCommitmentId, offerB.poolId, acceptorOfA, msg.sender
        );
    }

    // ═════════════════════════════ Internal ═════════════════════════════

    /// @dev Every named precondition runs before either side mutates, so a failure anywhere
    ///      leaves both Offers exactly as they were. Creation already proved the immutable half
    ///      of this for an Offer B, but the pair must still hold at acceptance time.
    function _requireExchangeEligible(
        uint256 commitmentIdA,
        ICommitmentPoolingModule.Commitment storage offerA,
        uint256 commitmentIdB,
        ICommitmentPoolingModule.Commitment storage offerB
    )
        private
        view
    {
        if (
            offerA.direction != ICommitmentPoolingModule.CommitmentDirection.Offer
                || offerB.direction != ICommitmentPoolingModule.CommitmentDirection.Offer
        ) {
            revert ICommitmentPoolingModule.ExchangeDirectionInvalid(
                commitmentIdA, commitmentIdB, offerA.direction, offerB.direction
            );
        }
        if (offerA.state != ICommitmentPoolingModule.CommitmentState.Offered) {
            revert ICommitmentPoolingModule.ExchangeStateInvalid(commitmentIdA, offerA.state);
        }
        if (offerB.state != ICommitmentPoolingModule.CommitmentState.Offered) {
            revert ICommitmentPoolingModule.ExchangeStateInvalid(commitmentIdB, offerB.state);
        }
        if (offerA.creator == offerB.creator) revert ICommitmentPoolingModule.SelfExchange(offerA.creator);
        if (offerA.claimType != ICommitmentPoolingModule.ClaimType.Individual) {
            revert ICommitmentPoolingModule.ExchangeClaimTypeUnsupported(commitmentIdA, offerA.claimType);
        }
        if (offerB.claimType != ICommitmentPoolingModule.ClaimType.Individual) {
            revert ICommitmentPoolingModule.ExchangeClaimTypeUnsupported(commitmentIdB, offerB.claimType);
        }
        // A steward cannot consent on behalf of B's represented gardener.
        if (offerB.commitmentType == ICommitmentPoolingModule.CommitmentType.StewardCaptured) {
            revert ICommitmentPoolingModule.ExchangeCreatorConsentRequired(commitmentIdB);
        }

        // The conditional Open-cycle rule is the same predicate creation applies, per side.
        _validateCycleForCreation(offerA.poolId, offerA.cycleId, offerA.commitmentType);
        _validateCycleForCreation(offerB.poolId, offerB.cycleId, offerB.commitmentType);

        _requireFullReservation(commitmentIdA, offerA);
        _requireFullReservation(commitmentIdB, offerB);
    }

    /// @dev An Offer whose exact full quota is no longer Committed to its creator is no longer the
    ///      obligation the counterpart agreed to.
    function _requireFullReservation(
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage offer
    )
        private
        view
    {
        if (commitmentRegistry.committedOf(offer.creator, commitmentId) != offer.targetUnits) {
            revert ICommitmentPoolingModule.ExchangeStateInvalid(commitmentId, offer.state);
        }
    }
}
