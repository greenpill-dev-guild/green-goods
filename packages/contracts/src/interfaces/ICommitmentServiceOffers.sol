// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface ICommitmentServiceOffers {
    enum ServicePaymentRoute {
        Legacy,
        PersonalGd,
        Voucher
    }

    struct ServiceOfferTermsInput {
        ServicePaymentRoute route;
        bytes32 serviceTermsRef;
        bytes32 remedyTermsRef;
        uint256 voucherChainId;
        address voucherIssuer;
        address voucherToken;
        uint256 voucherUnits;
    }

    struct ServiceOfferTerms {
        uint64 revision;
        bytes32 termsHash;
        ServiceOfferTermsInput terms;
    }

    struct ServiceClaimRequest {
        address buyerGarden;
        address voucherHolder;
        uint64 expectedRevision;
        uint64 requestNonce;
        bytes32 expectedTermsHash;
    }

    struct ServiceClaimConsent {
        uint64 termsRevision;
        uint64 requestNonce;
        address buyerGarden;
        address voucherHolder;
        bytes32 termsHash;
        bytes32 claimHash;
    }

    struct AcceptedServiceTerms {
        ServiceOfferTerms offer;
        ServiceClaimConsent consent;
        address buyer;
        address serviceRecipient;
        address providerGarden;
        uint256 serviceUnits;
        bytes32 unitLabelHash;
        uint256 gdPrice;
    }

    error ServiceOfferRequired(uint256 commitmentId);
    error ServiceOfferNotEligible(uint256 commitmentId);
    error ServiceOfferTermsLocked(uint256 commitmentId);
    error ServiceOfferRevisionMismatch(uint64 expected, uint64 actual);
    error ServiceOfferTermsHashMismatch(bytes32 expected, bytes32 actual);
    error InvalidServiceOfferTerms();
    error ServiceClaimPathRequired(uint256 commitmentId);
    error ServiceClaimConsentMismatch(uint256 commitmentId, address buyer);
    error ServiceClaimNonceMismatch(uint64 expected, uint64 actual);
    error ActiveServiceClaimExists(uint256 commitmentId, address buyer);
    error ServiceExchangeUnsupported(uint256 commitmentId);

    event ServiceOfferTermsSet(
        uint256 indexed commitmentId,
        uint64 indexed revision,
        bytes32 indexed termsHash,
        ServicePaymentRoute route,
        uint256 gdPrice
    );
    event ServiceClaimConsentRequested(
        uint256 indexed commitmentId,
        address indexed buyer,
        bytes32 indexed claimHash,
        uint64 revision,
        uint64 requestNonce,
        address buyerGarden,
        address voucherHolder
    );
    event ServiceClaimConsentAccepted(
        uint256 indexed commitmentId, address indexed buyer, bytes32 indexed claimHash, uint64 revision, uint64 requestNonce
    );
    event ServiceClaimConsentWithdrawn(uint256 indexed commitmentId, address indexed buyer, bytes32 indexed claimHash);

    function serviceOfferProtocolVersion() external pure returns (uint16);
    function setServiceOfferTerms(
        uint256 commitmentId,
        uint64 expectedRevision,
        ServiceOfferTermsInput calldata terms,
        uint256 gdPrice
    )
        external;
    function requestServiceClaim(
        uint256 commitmentId,
        ServiceClaimRequest calldata request
    )
        external
        returns (bytes32 claimHash);
    function acceptServiceClaim(uint256 commitmentId, address buyer, bytes32 expectedClaimHash) external;
    function withdrawServiceClaim(uint256 commitmentId, bytes32 expectedClaimHash) external;
    function getServiceOfferTerms(uint256 commitmentId) external view returns (ServiceOfferTerms memory);
    function getServiceClaimConsent(uint256 commitmentId, address buyer) external view returns (ServiceClaimConsent memory);
    function getAcceptedServiceTerms(uint256 commitmentId) external view returns (AcceptedServiceTerms memory);
}
