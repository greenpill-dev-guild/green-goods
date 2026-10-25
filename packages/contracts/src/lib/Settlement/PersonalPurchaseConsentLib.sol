// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule as Core } from "../../interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentServiceOffers as Service } from "../../interfaces/ICommitmentServiceOffers.sol";
import { IHatsModule } from "../../interfaces/IHatsModule.sol";
import { ISettlementModule as Settlement } from "../../interfaces/ISettlementModule.sol";
import { ISettlementPersonalServicePurchases as Personal } from "../../interfaces/ISettlementPersonalServicePurchases.sol";
import { CommitmentPoolingGuardLib } from "../CommitmentPooling/GuardLib.sol";
import { SettlementFundingLib } from "./FundingLib.sol";
import { SettlementFundingGuardLib as Guard } from "./FundingGuardLib.sol";

/// @notice Immutable financial consent composed with the canonical service claim, never transport IDs.
library PersonalPurchaseConsentLib {
    function offer(address pooling, uint256 commitmentId) internal view returns (Service.ServiceOfferTerms memory terms) {
        if (Service(pooling).serviceOfferProtocolVersion() != 1) {
            revert Personal.PersonalServiceModeRequired(commitmentId);
        }
        return Service(pooling).getServiceOfferTerms(commitmentId);
    }

    function requireLegacy(address pooling, uint256 commitmentId) internal view {
        if (offer(pooling, commitmentId).terms.route != Service.ServicePaymentRoute.Legacy) {
            revert Personal.PersonalServiceModeRequired(commitmentId);
        }
    }

    function bind(
        mapping(address garden => Settlement.SettlementAccount account) storage accounts,
        SettlementFundingLib.RuntimeConfig memory config,
        Personal.PersonalPurchaseConsent calldata consent
    )
        internal
        view
        returns (Personal.PersonalPurchaseTerms memory terms)
    {
        Core.Commitment memory commitment = Core(config.poolingModule).getCommitment(consent.commitmentId);
        Service.ServiceOfferTerms memory current = offer(config.poolingModule, consent.commitmentId);
        Service.ServiceClaimConsent memory claim =
            Service(config.poolingModule).getServiceClaimConsent(consent.commitmentId, msg.sender);
        Core.PendingClaim memory pending = Core(config.poolingModule).getPendingClaim(consent.commitmentId, msg.sender);
        if (current.terms.route != Service.ServicePaymentRoute.PersonalGd) {
            revert Personal.PersonalServiceModeRequired(consent.commitmentId);
        }
        if (
            commitment.state != Core.CommitmentState.Offered || commitment.direction != Core.CommitmentDirection.Offer
                || commitment.claimType != Core.ClaimType.Individual || commitment.claimMode != Core.ClaimMode.ApprovalGated
                || !pending.active || pending.claimant != msg.sender || pending.requestedBy != msg.sender
                || pending.kind != Core.ClaimType.Individual || pending.gardenContext != consent.buyerGarden
                || claim.buyerGarden != consent.buyerGarden || claim.voucherHolder != address(0)
                || claim.termsRevision != current.revision || claim.termsHash != current.termsHash
                || claim.termsRevision != consent.expectedTermsRevision || claim.termsHash != consent.expectedTermsHash
                || claim.claimHash != consent.expectedClaimHash || claim.claimHash == bytes32(0)
                || claim.requestNonce != consent.expectedRequestNonce
                || !CommitmentPoolingGuardLib.isGardenMember(
                    IHatsModule(config.hatsModule), consent.buyerGarden, msg.sender
                )
        ) {
            revert Personal.PersonalServiceConsentMismatch(consent.commitmentId);
        }
        address safe = Guard.activeAccount(accounts, consent.buyerGarden, config.destinationEvmChainId).account;
        if (
            safe != consent.expectedCustodySafe || config.destinationEvmChainId != consent.expectedDestinationChainId
                || config.gDollarToken != consent.expectedToken || commitment.consideration.amount != consent.expectedPrice
                || commitment.consideration.rail != Core.ConsiderationRail.CeloSettlement
                || commitment.consideration.source != address(0) || commitment.consideration.token != address(0)
                || consent.expectedPrice == 0 || consent.authorizedDepositor == address(0)
                || consent.refundAccount == address(0) || consent.refundAccount == safe
                || consent.disclosedGrossAmount < consent.disclosedNetAmount
                || consent.disclosedNetAmount < consent.expectedPrice
        ) {
            revert Personal.PersonalServiceConsentMismatch(consent.commitmentId);
        }
        terms.version = 1;
        terms.sourceChainId = block.chainid;
        terms.sourceModule = address(this);
        terms.commitmentId = consent.commitmentId;
        terms.termsRevision = claim.termsRevision;
        terms.termsHash = claim.termsHash;
        terms.claimHash = claim.claimHash;
        terms.requestNonce = claim.requestNonce;
        terms.buyer = msg.sender;
        terms.recipient = msg.sender;
        terms.buyerGarden = consent.buyerGarden;
        terms.providerGarden = Core(config.poolingModule).getPool(commitment.poolId).garden;
        terms.destinationChainId = config.destinationEvmChainId;
        terms.token = config.gDollarToken;
        terms.price = commitment.consideration.amount;
        terms.custodySafe = safe;
        terms.authorizedDepositor = consent.authorizedDepositor;
        terms.refundAccount = consent.refundAccount;
        terms.disclosedGrossAmount = consent.disclosedGrossAmount;
        terms.disclosedNetAmount = consent.disclosedNetAmount;
        terms.purchaseId = identity(terms);
    }

    function requireAccepted(
        SettlementFundingLib.RuntimeConfig memory config,
        uint256 fundingId,
        Personal.PersonalPurchaseTerms storage terms
    )
        internal
        view
        returns (Core.Commitment memory commitment)
    {
        if (Service(config.poolingModule).serviceOfferProtocolVersion() != 1) {
            revert Personal.PersonalServiceModeRequired(terms.commitmentId);
        }
        commitment = Core(config.poolingModule).getCommitment(terms.commitmentId);
        Service.AcceptedServiceTerms memory accepted =
            Service(config.poolingModule).getAcceptedServiceTerms(terms.commitmentId);
        if (
            accepted.offer.terms.route != Service.ServicePaymentRoute.PersonalGd
                || accepted.offer.revision != terms.termsRevision || accepted.offer.termsHash != terms.termsHash
                || accepted.consent.claimHash != terms.claimHash || accepted.consent.requestNonce != terms.requestNonce
                || accepted.consent.buyerGarden != terms.buyerGarden || accepted.buyer != terms.buyer
                || accepted.serviceRecipient != terms.recipient || accepted.providerGarden != terms.providerGarden
                || accepted.gdPrice != terms.price || commitment.counterparty != terms.buyer
                || commitment.payerGarden != terms.buyerGarden || commitment.providerGarden != terms.providerGarden
                || commitment.consideration.rail != Core.ConsiderationRail.CeloSettlement
                || commitment.consideration.source != address(0) || commitment.consideration.token != address(0)
                || commitment.consideration.amount != terms.price || config.gDollarToken != terms.token
                || config.destinationEvmChainId != terms.destinationChainId || terms.sourceChainId != block.chainid
                || terms.sourceModule != address(this)
        ) {
            revert Personal.PersonalServiceTermsChanged(fundingId);
        }
    }

    function identity(Personal.PersonalPurchaseTerms memory terms) internal pure returns (bytes32) {
        // All preimage members are static ABI words; concatenating the two encodings is exactly
        // the selected flat abi.encode preimage while avoiding the non-IR stack limit.
        bytes memory source = abi.encode(
            keccak256("GREEN_GOODS_PERSONAL_SERVICE_PURCHASE_V1"),
            terms.sourceChainId,
            terms.sourceModule,
            terms.commitmentId,
            terms.termsRevision,
            terms.termsHash,
            terms.claimHash,
            terms.requestNonce,
            terms.buyer,
            terms.recipient
        );
        return keccak256(
            bytes.concat(
                source,
                abi.encode(
                    terms.buyerGarden,
                    terms.providerGarden,
                    terms.destinationChainId,
                    terms.token,
                    terms.price,
                    terms.custodySafe,
                    terms.authorizedDepositor,
                    terms.refundAccount,
                    terms.disclosedGrossAmount,
                    terms.disclosedNetAmount
                )
            )
        );
    }
}
