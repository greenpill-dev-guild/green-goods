// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingAcceptanceLib } from "./AcceptanceLib.sol";
import { CommitmentPoolingCommonLib } from "./CommonLib.sol";
import { CommitmentPoolingCreationChecksLib } from "./CreationChecksLib.sol";
import { CommitmentPoolingGuardLib } from "./GuardLib.sol";

/// @title CommitmentPoolingExchangeLib
/// @notice Deployed behavior library: atomic bilateral Offer x Offer acceptance.
/// @dev The only bilateral exception to the one-way `counterCommitmentId` reference. Consent is
///      two direct creator acts — B's creator consented by creating B, A's creator consents by
///      calling — which is stricter than either claim gate, so the ApprovalGated operator path is
///      never consulted and both claim modes are valid here. Lifecycle stays independent
///      afterwards: nothing in cancellation, expiry, dispute, or fulfilment reads the reference.
///      Runs via DELEGATECALL from `CommitmentPoolingModule`.
library CommitmentPoolingExchangeLib {
    function acceptExchange(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 cycleId => ICommitmentPoolingModule.Cycle cycle) storage cycles,
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        mapping(uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record))
            storage contributors,
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        uint256 exchangeCommitmentId
    )
        external
    {
        ICommitmentPoolingModule.Commitment storage offerB =
            CommitmentPoolingGuardLib.requireCommitment(commitments, exchangeCommitmentId);
        uint256 counterCommitmentId = offerB.counterCommitmentId;
        if (counterCommitmentId == 0) revert ICommitmentPoolingModule.ExchangeCounterpartMismatch(exchangeCommitmentId);
        ICommitmentPoolingModule.Commitment storage offerA = commitments[counterCommitmentId];
        if (offerA.state == ICommitmentPoolingModule.CommitmentState.None || offerA.poolId != offerB.poolId) {
            revert ICommitmentPoolingModule.ExchangeCounterpartMismatch(exchangeCommitmentId);
        }
        CommitmentPoolingGuardLib.requirePoolState(
            offerB.poolId, pools[offerB.poolId], ICommitmentPoolingModule.PoolState.Open
        );
        if (msg.sender != offerA.creator) revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);

        _requireExchangeEligible(env, cycles, counterCommitmentId, offerA, exchangeCommitmentId, offerB);

        // Each creator accepts the other's Offer and stays the lead provider of their own. Both
        // classes were reserved at Offer creation, so neither acceptance touches the registry.
        address gardenContext = pools[offerB.poolId].garden;
        address acceptorOfA = offerB.creator;
        CommitmentPoolingAcceptanceLib.acceptCommitment(
            env,
            pools,
            contributors,
            commitmentConfirmers,
            counterCommitmentId,
            offerA,
            acceptorOfA,
            acceptorOfA,
            ICommitmentPoolingModule.ClaimType.Individual,
            gardenContext,
            false
        );
        CommitmentPoolingAcceptanceLib.acceptCommitment(
            env,
            pools,
            contributors,
            commitmentConfirmers,
            exchangeCommitmentId,
            offerB,
            msg.sender,
            msg.sender,
            ICommitmentPoolingModule.ClaimType.Individual,
            gardenContext,
            false
        );
        emit ICommitmentPoolingModule.ExchangeAccepted(
            counterCommitmentId, exchangeCommitmentId, offerB.poolId, acceptorOfA, msg.sender
        );
    }

    /// @dev Every named precondition runs before either side mutates, so a failure anywhere
    ///      leaves both Offers exactly as they were. Creation already proved the immutable half
    ///      of this for an Offer B, but the pair must still hold at acceptance time.
    // solhint-disable-next-line code-complexity
    function _requireExchangeEligible(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 cycleId => ICommitmentPoolingModule.Cycle cycle) storage cycles,
        uint256 commitmentIdA,
        ICommitmentPoolingModule.Commitment storage offerA,
        uint256 commitmentIdB,
        ICommitmentPoolingModule.Commitment storage offerB
    )
        private
        view
    {
        // Paired acceptance is barter, and the contract cannot express anything else: one
        // `gardenContext` is derived from the pool and passed to both acceptances, so a priced
        // side would store that single garden as payer for a trade between two individuals — in
        // the protocol pool that would silently bill the protocol Safe for both halves. A person
        // may belong to several gardens, so the current ABI cannot authenticate a per-side payer.
        // Free-only is therefore the honest rule until an explicit payer context exists.
        if (offerA.consideration.amount != 0) {
            revert ICommitmentPoolingModule.ExchangeConsiderationUnsupported(commitmentIdA, offerA.consideration.amount);
        }
        if (offerB.consideration.amount != 0) {
            revert ICommitmentPoolingModule.ExchangeConsiderationUnsupported(commitmentIdB, offerB.consideration.amount);
        }
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
        CommitmentPoolingCreationChecksLib.validateCycleForCreation(cycles, offerA.poolId, offerA.cycleId);
        CommitmentPoolingCreationChecksLib.validateCycleForCreation(cycles, offerB.poolId, offerB.cycleId);

        _requireFullReservation(env, commitmentIdA, offerA);
        _requireFullReservation(env, commitmentIdB, offerB);
    }

    /// @dev An Offer whose exact full quota is no longer Committed to its creator is no longer the
    ///      obligation the counterpart agreed to.
    function _requireFullReservation(
        CommitmentPoolingCommonLib.Env memory env,
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage offer
    )
        private
        view
    {
        if (env.registry.committedOf(offer.creator, commitmentId) != offer.targetUnits) {
            revert ICommitmentPoolingModule.ExchangeStateInvalid(commitmentId, offer.state);
        }
    }
}
