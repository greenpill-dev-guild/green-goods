// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule as Core } from "../../interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentServiceOffers as Services } from "../../interfaces/ICommitmentServiceOffers.sol";
import { ICommitmentVoucherAcceptance as Acceptance } from "../../interfaces/ICommitmentVoucherAcceptance.sol";
import { VoucherServiceCodec as Codec } from "../../libraries/VoucherServiceCodec.sol";

/// @notice Current pending consent authorizes setup; durable exact core receipt orders activation.
library VoucherServiceConsentLib {
    function authorization(
        address core,
        address buyer,
        uint256 commitmentId,
        uint64 deadline,
        uint256 localChain,
        uint256 remoteChain,
        address remotePeer
    )
        public
        view
        returns (Codec.SetupAuthorization memory a)
    {
        Services.ServiceOfferTerms memory terms = Services(core).getServiceOfferTerms(commitmentId);
        Services.ServiceClaimConsent memory consent = Services(core).getServiceClaimConsent(commitmentId, buyer);
        Core.Commitment memory commitment = Core(core).getCommitment(commitmentId);
        a.version = Codec.VERSION;
        a.sourceChainId = localChain;
        a.sourceModule = address(this);
        a.coreModule = core;
        a.commitmentId = commitmentId;
        a.termsRevision = terms.revision;
        a.termsHash = terms.termsHash;
        a.claimHash = consent.claimHash;
        a.requestNonce = consent.requestNonce;
        a.buyer = buyer;
        a.holder = consent.voucherHolder;
        a.buyerGarden = consent.buyerGarden;
        a.providerGarden = commitment.providerGarden;
        a.destinationChainId = remoteChain;
        a.destinationEscrow = remotePeer;
        a.issuer = terms.terms.voucherIssuer;
        a.token = terms.terms.voucherToken;
        a.voucherUnits = terms.terms.voucherUnits;
        a.serviceUnits = commitment.targetUnits;
        a.unitLabelHash = keccak256(bytes(commitment.unitLabel));
        a.serviceTermsRef = terms.terms.serviceTermsRef;
        a.remedyTermsRef = terms.terms.remedyTermsRef;
        a.acceptanceDeadline = deadline;
        a.remedyPolicy = Codec.MUTUAL_CONSENT;
    }

    function matchesPending(Codec.SetupAuthorization memory a) public view returns (bool) {
        Core.Commitment memory c = Core(a.coreModule).getCommitment(a.commitmentId);
        Services.ServiceOfferTerms memory t = Services(a.coreModule).getServiceOfferTerms(a.commitmentId);
        Services.ServiceClaimConsent memory s = Services(a.coreModule).getServiceClaimConsent(a.commitmentId, a.buyer);
        Core.PendingClaim memory p = Core(a.coreModule).getPendingClaim(a.commitmentId, a.buyer);
        return _eligible(c, t) && p.active && p.claimant == a.buyer && p.requestedBy == a.buyer
            && p.kind == Core.ClaimType.Individual && p.gardenContext == a.buyerGarden && s.termsRevision == a.termsRevision
            && s.termsHash == a.termsHash && s.claimHash == a.claimHash && s.requestNonce == a.requestNonce
            && s.buyerGarden == a.buyerGarden && s.voucherHolder == a.holder && t.revision == a.termsRevision
            && t.termsHash == a.termsHash && t.terms.voucherChainId == a.destinationChainId
            && t.terms.voucherIssuer == a.issuer && t.terms.voucherToken == a.token
            && t.terms.voucherUnits == a.voucherUnits && t.terms.serviceTermsRef == a.serviceTermsRef
            && t.terms.remedyTermsRef == a.remedyTermsRef && c.providerGarden == a.providerGarden
            && c.targetUnits == a.serviceUnits && keccak256(bytes(c.unitLabel)) == a.unitLabelHash;
    }

    function _eligible(Core.Commitment memory c, Services.ServiceOfferTerms memory t) private pure returns (bool) {
        return c.state == Core.CommitmentState.Offered && c.counterparty == address(0)
            && c.direction == Core.CommitmentDirection.Offer && c.claimType == Core.ClaimType.Individual
            && c.claimMode == Core.ClaimMode.ApprovalGated && c.providerGarden != address(0) && c.targetUnits != 0
            && c.consideration.rail == Core.ConsiderationRail.None && c.consideration.amount == 0
            && c.consideration.token == address(0) && c.consideration.source == address(0)
            && t.terms.route == Services.ServicePaymentRoute.Voucher && t.revision != 0 && t.termsHash != bytes32(0);
    }

    function acceptedReceipt(Codec.SetupAuthorization memory a)
        public
        view
        returns (Acceptance.VoucherServiceAcceptance memory receipt, bool exact)
    {
        receipt = Acceptance(a.coreModule).getVoucherServiceAcceptance(a.commitmentId);
        exact = receipt.setupModule == address(this) && receipt.claimHash == a.claimHash
            && receipt.termsRevision == a.termsRevision && receipt.requestNonce == a.requestNonce
            && receipt.setupId == Codec.setupId(a) && receipt.authorizationHash == Codec.hash(a)
            && receipt.depositReceiptHash == Codec.depositReceiptHash(a);
    }

    function validateIdentity(Codec.SetupAuthorization memory a) internal pure {
        if (
            a.buyer == address(0) || a.holder == address(0) || a.buyerGarden == address(0) || a.providerGarden == address(0)
                || a.issuer == address(0) || a.token == address(0) || a.claimHash == bytes32(0) || a.requestNonce == 0
                || a.voucherUnits == 0 || a.voucherUnits == type(uint256).max || a.serviceUnits == 0
                || a.serviceTermsRef == bytes32(0) || a.remedyTermsRef == bytes32(0)
                || a.remedyPolicy != Codec.MUTUAL_CONSENT
        ) {
            revert Codec.InvalidVoucherServiceAuthorization();
        }
    }
}
