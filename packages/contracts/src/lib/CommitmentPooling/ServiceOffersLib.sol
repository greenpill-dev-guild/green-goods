// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule as Core } from "../../interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentServiceOffers as Service } from "../../interfaces/ICommitmentServiceOffers.sol";
import { CommitmentPoolingAcceptanceLib } from "./AcceptanceLib.sol";
import { CommitmentPoolingCommonLib } from "./CommonLib.sol";
import { CommitmentPoolingGuardLib } from "./GuardLib.sol";
import { CommitmentPoolingServiceOfferStorageLib as ServiceStorage } from "./ServiceOfferStorageLib.sol";

/// @notice Exact service-offer terms and buyer consent, composed through the existing behavior libraries.
/// @dev Internal-only: ClaimsLib/TermsLib retain the deployed entrypoints and link inventory.
library CommitmentPoolingServiceOffersLib {
    bytes32 private constant TERMS_DOMAIN = keccak256("GREEN_GOODS_SERVICE_OFFER_TERMS_V1");
    bytes32 private constant CLAIM_DOMAIN = keccak256("GREEN_GOODS_SERVICE_CLAIM_V1");

    function setTerms(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => Core.Pool pool) storage pools,
        mapping(uint256 commitmentId => Core.Commitment commitment) storage commitments,
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        uint256 commitmentId,
        uint64 expectedRevision,
        Service.ServiceOfferTermsInput calldata terms,
        uint256 gdPrice
    )
        internal
    {
        Core.Commitment storage commitment = _requireOffered(pools, commitments, commitmentId);
        CommitmentPoolingGuardLib.requirePoolSteward(env, commitment.poolId, pools[commitment.poolId]);
        if (
            commitment.direction != Core.CommitmentDirection.Offer || commitment.claimType != Core.ClaimType.Individual
                || commitment.claimMode != Core.ClaimMode.ApprovalGated || commitment.counterCommitmentId != 0
        ) revert Service.ServiceOfferNotEligible(commitmentId);
        Service.ServiceOfferTerms storage current = ServiceStorage.state().terms[commitmentId];
        _requireRevision(expectedRevision, current.revision);
        _validateTerms(terms, gdPrice);
        commitment.consideration = Core.DeclaredConsideration({
            rail: terms.route == Service.ServicePaymentRoute.PersonalGd
                ? Core.ConsiderationRail.CeloSettlement
                : Core.ConsiderationRail.None,
            source: address(0),
            token: address(0),
            amount: gdPrice
        });
        current.revision++;
        current.terms = terms;
        current.termsHash = _termsHash(
            commitmentId, current.revision, terms, _coreTermsHash(commitment, commitmentConfirmers[commitmentId])
        );
        emit Core.ConsiderationDeclared(commitmentId, commitment.consideration.rail, address(0), address(0), gdPrice);
        emit Service.ServiceOfferTermsSet(commitmentId, current.revision, current.termsHash, terms.route, gdPrice);
    }

    function requestClaim(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => Core.Pool pool) storage pools,
        mapping(address garden => uint256 poolId) storage gardenPool,
        mapping(uint256 commitmentId => Core.Commitment commitment) storage commitments,
        mapping(uint256 commitmentId => mapping(address claimant => Core.PendingClaim claim)) storage pendingClaim,
        uint256 commitmentId,
        Service.ServiceClaimRequest calldata request
    )
        internal
        returns (bytes32 claimHash)
    {
        Core.Commitment storage commitment = _requireOffered(pools, commitments, commitmentId);
        Service.ServiceOfferTerms storage terms = _requireServiceTerms(commitmentId);
        _requireRevision(request.expectedRevision, terms.revision);
        if (request.expectedTermsHash != terms.termsHash) {
            revert Service.ServiceOfferTermsHashMismatch(request.expectedTermsHash, terms.termsHash);
        }
        _requireBuyer(env, gardenPool, request.buyerGarden, msg.sender);
        if (msg.sender == commitment.creator) revert Core.SelfCounterparty();
        if ((terms.terms.route == Service.ServicePaymentRoute.Voucher) != (request.voucherHolder != address(0))) {
            revert Service.InvalidServiceOfferTerms();
        }
        claimHash = _claimHash(commitmentId, msg.sender, request);
        Service.ServiceClaimConsent storage consent = ServiceStorage.state().claimConsent[commitmentId][msg.sender];
        Core.PendingClaim storage pending = pendingClaim[commitmentId][msg.sender];
        if (pending.active) {
            if (consent.claimHash == claimHash) return claimHash;
            revert Service.ActiveServiceClaimExists(commitmentId, msg.sender);
        }
        uint64 nextNonce = consent.requestNonce + 1;
        if (request.requestNonce != nextNonce) {
            revert Service.ServiceClaimNonceMismatch(request.requestNonce, nextNonce);
        }
        consent.termsRevision = terms.revision;
        consent.requestNonce = request.requestNonce;
        consent.buyerGarden = request.buyerGarden;
        consent.voucherHolder = request.voucherHolder;
        consent.termsHash = terms.termsHash;
        consent.claimHash = claimHash;
        pending.claimant = msg.sender;
        pending.requestedBy = msg.sender;
        pending.kind = Core.ClaimType.Individual;
        pending.gardenContext = request.buyerGarden;
        pending.requestedAt = uint64(block.timestamp);
        pending.active = true;
        emit Core.ClaimRequested(
            commitmentId, msg.sender, msg.sender, Core.ClaimType.Individual, request.buyerGarden, uint64(block.timestamp)
        );
        emit Service.ServiceClaimConsentRequested(
            commitmentId,
            msg.sender,
            claimHash,
            terms.revision,
            request.requestNonce,
            request.buyerGarden,
            request.voucherHolder
        );
    }

    function acceptClaim(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => Core.Pool pool) storage pools,
        mapping(address garden => uint256 poolId) storage gardenPool,
        mapping(uint256 commitmentId => Core.Commitment commitment) storage commitments,
        mapping(uint256 commitmentId => mapping(address claimant => Core.PendingClaim claim)) storage pendingClaim,
        mapping(uint256 commitmentId => mapping(address contributor => Core.ContributorRecord record)) storage contributors,
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        uint256 commitmentId,
        address buyer,
        bytes32 expectedClaimHash
    )
        internal
    {
        Core.Commitment storage commitment = _requireOffered(pools, commitments, commitmentId);
        CommitmentPoolingGuardLib.requirePoolSteward(env, commitment.poolId, pools[commitment.poolId]);
        Service.ServiceOfferTerms storage terms = _requireServiceTerms(commitmentId);
        Core.PendingClaim storage pending = pendingClaim[commitmentId][buyer];
        if (!pending.active) revert Core.ClaimNotPending(commitmentId, buyer);
        Service.ServiceClaimConsent memory consent = ServiceStorage.state().claimConsent[commitmentId][buyer];
        _requireRevision(consent.termsRevision, terms.revision);
        if (
            expectedClaimHash == bytes32(0) || consent.claimHash != expectedClaimHash
                || consent.termsHash != terms.termsHash || pending.claimant != buyer || pending.requestedBy != buyer
                || pending.kind != Core.ClaimType.Individual || pending.gardenContext != consent.buyerGarden
        ) revert Service.ServiceClaimConsentMismatch(commitmentId, buyer);
        _requireBuyer(env, gardenPool, consent.buyerGarden, buyer);
        if (buyer == commitment.creator) revert Core.SelfCounterparty();
        ServiceStorage.state().acceptedConsent[commitmentId] = consent;
        delete pendingClaim[commitmentId][buyer];
        CommitmentPoolingAcceptanceLib.acceptCommitment(
            env,
            pools,
            contributors,
            commitmentConfirmers,
            commitmentId,
            commitment,
            buyer,
            buyer,
            Core.ClaimType.Individual,
            consent.buyerGarden,
            true
        );
        emit Service.ServiceClaimConsentAccepted(
            commitmentId, buyer, consent.claimHash, consent.termsRevision, consent.requestNonce
        );
    }

    function withdrawClaim(
        mapping(uint256 commitmentId => Core.Commitment commitment) storage commitments,
        mapping(uint256 commitmentId => mapping(address claimant => Core.PendingClaim claim)) storage pendingClaim,
        uint256 commitmentId,
        bytes32 expectedClaimHash
    )
        internal
    {
        Core.Commitment storage commitment = CommitmentPoolingGuardLib.requireCommitment(commitments, commitmentId);
        CommitmentPoolingGuardLib.requirePreAcceptanceState(commitmentId, commitment);
        _requireServiceTerms(commitmentId);
        if (!pendingClaim[commitmentId][msg.sender].active) revert Core.ClaimNotPending(commitmentId, msg.sender);
        if (ServiceStorage.state().claimConsent[commitmentId][msg.sender].claimHash != expectedClaimHash) {
            revert Service.ServiceClaimConsentMismatch(commitmentId, msg.sender);
        }
        delete pendingClaim[commitmentId][msg.sender];
        emit Service.ServiceClaimConsentWithdrawn(commitmentId, msg.sender, expectedClaimHash);
    }

    function _requireOffered(
        mapping(uint256 poolId => Core.Pool pool) storage pools,
        mapping(uint256 commitmentId => Core.Commitment commitment) storage commitments,
        uint256 commitmentId
    )
        private
        view
        returns (Core.Commitment storage commitment)
    {
        commitment = CommitmentPoolingGuardLib.requireCommitment(commitments, commitmentId);
        CommitmentPoolingGuardLib.requirePoolState(commitment.poolId, pools[commitment.poolId], Core.PoolState.Open);
        if (commitment.state != Core.CommitmentState.Offered) {
            revert Core.CommitmentNotInState(commitmentId, commitment.state);
        }
    }

    function _requireServiceTerms(uint256 commitmentId) private view returns (Service.ServiceOfferTerms storage terms) {
        terms = ServiceStorage.state().terms[commitmentId];
        if (terms.revision == 0) revert Service.ServiceOfferRequired(commitmentId);
    }

    function _requireRevision(uint64 expected, uint64 actual) private pure {
        if (expected != actual) revert Service.ServiceOfferRevisionMismatch(expected, actual);
    }

    function _requireBuyer(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(address garden => uint256 poolId) storage gardenPool,
        address garden,
        address buyer
    )
        private
        view
    {
        if (gardenPool[garden] == 0 || !CommitmentPoolingGuardLib.isGardenMember(env.hats, garden, buyer)) {
            revert Core.NotEligibleClaimant(buyer);
        }
    }

    function _validateTerms(Service.ServiceOfferTermsInput calldata terms, uint256 gdPrice) private pure {
        if (terms.serviceTermsRef == bytes32(0) || terms.remedyTermsRef == bytes32(0)) {
            revert Service.InvalidServiceOfferTerms();
        }
        if (terms.route == Service.ServicePaymentRoute.PersonalGd) {
            if (
                gdPrice == 0 || terms.voucherChainId != 0 || terms.voucherIssuer != address(0)
                    || terms.voucherToken != address(0) || terms.voucherUnits != 0
            ) revert Service.InvalidServiceOfferTerms();
        } else if (terms.route == Service.ServicePaymentRoute.Voucher) {
            if (
                gdPrice != 0 || terms.voucherChainId != 100 || terms.voucherIssuer == address(0)
                    || terms.voucherToken == address(0) || terms.voucherUnits == 0
            ) revert Service.InvalidServiceOfferTerms();
        } else {
            revert Service.InvalidServiceOfferTerms();
        }
    }

    function _coreTermsHash(
        Core.Commitment storage commitment,
        address[] storage confirmers
    )
        private
        view
        returns (bytes32)
    {
        return keccak256(
            bytes.concat(
                abi.encode(
                    commitment.creationPayloadHash,
                    commitment.targetUnits,
                    keccak256(bytes(commitment.unitLabel)),
                    commitment.consideration.rail,
                    commitment.consideration.source,
                    commitment.consideration.token,
                    commitment.consideration.amount
                ),
                abi.encode(
                    commitment.declaredUnitValue,
                    keccak256(bytes(commitment.declaredValueBasis)),
                    keccak256(abi.encode(confirmers)),
                    commitment.confirmationThreshold,
                    commitment.protocolFallbackEnabled
                )
            )
        );
    }

    function _termsHash(
        uint256 commitmentId,
        uint64 revision,
        Service.ServiceOfferTermsInput calldata terms,
        bytes32 coreTermsHash
    )
        private
        view
        returns (bytes32)
    {
        return keccak256(
            bytes.concat(
                abi.encode(TERMS_DOMAIN, block.chainid, address(this), commitmentId, revision),
                abi.encode(terms),
                abi.encode(uint8(terms.route == Service.ServicePaymentRoute.Voucher ? 1 : 0), coreTermsHash)
            )
        );
    }

    function _claimHash(
        uint256 commitmentId,
        address buyer,
        Service.ServiceClaimRequest calldata request
    )
        private
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                CLAIM_DOMAIN,
                block.chainid,
                address(this),
                commitmentId,
                request.expectedRevision,
                request.expectedTermsHash,
                buyer,
                request.buyerGarden,
                request.voucherHolder,
                request.requestNonce
            )
        );
    }
}
