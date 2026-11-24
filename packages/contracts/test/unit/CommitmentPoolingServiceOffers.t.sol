// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule as Core } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentServiceOffers as Service } from "../../src/interfaces/ICommitmentServiceOffers.sol";
import { ICommitmentVoucherAcceptance as Voucher } from "../../src/interfaces/ICommitmentVoucherAcceptance.sol";
import { VoucherServiceReadinessMock, EarnedVoucherAcceptanceMock } from "../helpers/VoucherAcceptancePeers.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { CommitmentPoolingFixture } from "../helpers/CommitmentPoolingFixture.sol";

/// @notice Fictional service terms and role stand-ins exercise the real pooling implementation.
contract CommitmentPoolingServiceOffersTest is CommitmentPoolingFixture {
    address private constant BUYER_GARDEN = address(0xBA01);
    address private constant BUYER = address(0xBA02);
    address private constant PROVIDER_STEWARD = address(0xBA03);
    address private constant HOLDER = address(0xBA04);
    address private constant ISSUER_RESERVE = address(0xBA05);
    address private constant VOUCHER = address(0xBA06);
    bytes32 private constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    Service private services;
    VoucherServiceReadinessMock private readiness;

    function setUp() public {
        _setUpProductionFixture();
        services = Service(address(module));
        readiness = new VoucherServiceReadinessMock(address(module));
        module.setPaused(true);
        Voucher(address(module)).pinVoucherServiceSetupModule(address(readiness));
        module.setPaused(false);
        module.registerPool(BUYER_GARDEN, Core.PoolType.Garden);
        hats.setGardener(BUYER_GARDEN, BUYER, true);
        hats.setOperator(POOL_GARDEN, PROVIDER_STEWARD, true);
    }

    function testCommitmentPoolingServiceOffers_legacyOfferStillUsesItsOriginalClaimPath() public {
        uint256 id = _createOffer(keccak256("legacy-control"));
        _acceptOffer(id);
        assertEq(module.getCommitment(id).counterparty, CLAIMANT);
    }

    function testCommitmentPoolingServiceOffers_externalBuyerAcceptsExactPersonalPurchaseTerms() public {
        uint256 id = _personalOffer(keccak256("external-buyer"));
        Service.ServiceOfferTerms memory terms = services.getServiceOfferTerms(id);
        vm.prank(BUYER);
        bytes32 claimHash = services.requestServiceClaim(id, _request(terms));
        assertEq(uint256(module.getCommitment(id).state), uint256(Core.CommitmentState.Offered));
        vm.prank(PROVIDER_STEWARD);
        services.acceptServiceClaim(id, BUYER, claimHash);
        Core.Commitment memory commitment = module.getCommitment(id);
        Service.AcceptedServiceTerms memory accepted = services.getAcceptedServiceTerms(id);
        assertEq(commitment.counterparty, BUYER);
        assertEq(commitment.payerGarden, BUYER_GARDEN);
        assertEq(commitment.providerGarden, POOL_GARDEN);
        assertEq(accepted.buyer, BUYER);
        assertEq(accepted.serviceRecipient, BUYER);
        assertEq(accepted.consent.claimHash, claimHash);
        assertEq(accepted.offer.termsHash, terms.termsHash);
        assertEq(accepted.gdPrice, 100 ether);
    }

    function testCommitmentPoolingServiceOffers_preacceptanceRevisionChangeRejectsOldConsent() public {
        uint256 id = _personalOffer(keccak256("terms-race"));
        Service.ServiceOfferTerms memory terms = services.getServiceOfferTerms(id);
        vm.prank(BUYER);
        bytes32 claimHash = services.requestServiceClaim(id, _request(terms));
        services.setServiceOfferTerms(id, 1, terms.terms, 200 ether);
        vm.expectRevert(abi.encodeWithSelector(Service.ServiceOfferRevisionMismatch.selector, uint64(1), uint64(2)));
        vm.prank(PROVIDER_STEWARD);
        services.acceptServiceClaim(id, BUYER, claimHash);
        assertTrue(module.getPendingClaim(id, BUYER).active);
        assertEq(uint256(module.getCommitment(id).state), uint256(Core.CommitmentState.Offered));
    }

    function testCommitmentPoolingServiceOffers_legacyViewsExplicitlyHaveNoServiceEntitlement() public {
        uint256 id = _createOffer(keccak256("legacy-view"));
        assertEq(services.serviceOfferProtocolVersion(), 1);
        assertEq(services.getServiceOfferTerms(id).revision, 0);
        assertEq(uint256(services.getServiceOfferTerms(id).terms.route), uint256(Service.ServicePaymentRoute.Legacy));
        assertEq(services.getAcceptedServiceTerms(id).buyer, address(0));
        vm.expectRevert(abi.encodeWithSelector(Core.UnknownCommitment.selector, uint256(99_999)));
        services.getServiceOfferTerms(99_999);
    }

    function testCommitmentPoolingServiceOffers_sameGardenServiceConsentKeepsActualPayer() public {
        uint256 id = _personalOffer(keccak256("same-garden-service"));
        Service.ServiceClaimRequest memory request = _request(services.getServiceOfferTerms(id));
        request.buyerGarden = POOL_GARDEN;
        vm.prank(CLAIMANT);
        bytes32 hash = services.requestServiceClaim(id, request);
        vm.prank(PROVIDER_STEWARD);
        services.acceptServiceClaim(id, CLAIMANT, hash);
        assertEq(module.getCommitment(id).payerGarden, POOL_GARDEN);
        assertEq(module.getCommitment(id).providerGarden, POOL_GARDEN);
    }

    function testCommitmentPoolingServiceOffers_protocolOfferAcceptsMemberOfAnotherGarden() public {
        uint256 protocolId = module.registerPool(ROOT_GARDEN, Core.PoolType.Protocol);
        module.setProviderOpenCommitmentCap(protocolId, 128);
        module.setPoolCharter(protocolId, "fictional-protocol-service-charter");
        module.markPoolReady(protocolId);
        module.openPool(protocolId);
        hats.setOperator(ROOT_GARDEN, CREATOR, true);
        hats.setOperator(ROOT_GARDEN, PROVIDER_STEWARD, true);
        Core.CreateCommitmentParams memory params = _baseParams(keccak256("protocol-service"));
        params.poolId = protocolId;
        params.claimMode = Core.ClaimMode.ApprovalGated;
        vm.prank(CREATOR);
        uint256 id = module.createCommitment(params);
        services.setServiceOfferTerms(id, 0, _personalTerms(), 100 ether);
        _acceptPersonal(id);
        assertEq(module.getCommitment(id).providerGarden, ROOT_GARDEN);
        assertEq(module.getCommitment(id).payerGarden, BUYER_GARDEN);
    }

    function testCommitmentPoolingServiceOffers_revertsWhenBuyerIsNotCurrentGardenMember() public {
        uint256 id = _personalOffer(keccak256("nonmember"));
        Service.ServiceClaimRequest memory request = _request(services.getServiceOfferTerms(id));
        hats.setGardener(BUYER_GARDEN, BUYER, false);
        vm.expectRevert(abi.encodeWithSelector(Core.NotEligibleClaimant.selector, BUYER));
        vm.prank(BUYER);
        services.requestServiceClaim(id, request);
    }

    function testCommitmentPoolingServiceOffers_revertsWhenSelectedGardenIsUnregistered() public {
        uint256 id = _personalOffer(keccak256("unregistered"));
        Service.ServiceClaimRequest memory request = _request(services.getServiceOfferTerms(id));
        request.buyerGarden = address(0xBAD);
        hats.setGardener(request.buyerGarden, BUYER, true);
        vm.expectRevert(abi.encodeWithSelector(Core.NotEligibleClaimant.selector, BUYER));
        vm.prank(BUYER);
        services.requestServiceClaim(id, request);
    }

    function testCommitmentPoolingServiceOffers_revertsWhenBuyerMembershipLapsesBeforeAcceptance() public {
        uint256 id = _personalOffer(keccak256("lost-membership"));
        bytes32 hash = _requestPersonal(id);
        hats.setGardener(BUYER_GARDEN, BUYER, false);
        vm.expectRevert(abi.encodeWithSelector(Core.NotEligibleClaimant.selector, BUYER));
        vm.prank(PROVIDER_STEWARD);
        services.acceptServiceClaim(id, BUYER, hash);
        assertTrue(module.getPendingClaim(id, BUYER).active);
        assertEq(services.getAcceptedServiceTerms(id).buyer, address(0));
    }

    function testCommitmentPoolingServiceOffers_preservesProviderMembershipAndAtomicFailure() public {
        uint256 id = _personalOffer(keccak256("lost-provider-membership"));
        bytes32 hash = _requestPersonal(id);
        hats.setGardener(POOL_GARDEN, CREATOR, false);
        vm.expectRevert(abi.encodeWithSelector(Core.NotEligibleContributor.selector, CREATOR));
        vm.prank(PROVIDER_STEWARD);
        services.acceptServiceClaim(id, BUYER, hash);
        assertTrue(module.getPendingClaim(id, BUYER).active);
        assertEq(services.getAcceptedServiceTerms(id).buyer, address(0));
        assertEq(module.getCommitment(id).counterparty, address(0));
    }

    function testCommitmentPoolingServiceOffers_revertsWhenBuyerGardenStewardApprovesProviderClaim() public {
        uint256 id = _personalOffer(keccak256("wrong-steward"));
        bytes32 hash = _requestPersonal(id);
        hats.setOperator(BUYER_GARDEN, BUYER, true);
        vm.expectRevert(abi.encodeWithSelector(Core.NotPoolSteward.selector, BUYER, poolId));
        vm.prank(BUYER);
        services.acceptServiceClaim(id, BUYER, hash);
    }

    function testCommitmentPoolingServiceOffers_revertsWhenBuyerEditsIssuerOfferTerms() public {
        uint256 id = _personalOffer(keccak256("terms-authority"));
        Service.ServiceOfferTermsInput memory terms = _personalTerms();
        vm.expectRevert(abi.encodeWithSelector(Core.NotPoolSteward.selector, BUYER, poolId));
        vm.prank(BUYER);
        services.setServiceOfferTerms(id, 1, terms, 1);
    }

    function testCommitmentPoolingServiceOffers_revertsWhenOfferIsOpenClaimMode() public {
        uint256 id = _createOffer(keccak256("open-ineligible"));
        Service.ServiceOfferTermsInput memory terms = _personalTerms();
        vm.expectRevert(abi.encodeWithSelector(Service.ServiceOfferNotEligible.selector, id));
        services.setServiceOfferTerms(id, 0, terms, 100 ether);
    }

    function testCommitmentPoolingServiceOffers_providerGardenStewardCanConfigureServiceTerms() public {
        uint256 id = _rawApprovalOffer(keccak256("provider-terms-authority"));
        Service.ServiceOfferTermsInput memory terms = _personalTerms();
        vm.prank(PROVIDER_STEWARD);
        services.setServiceOfferTerms(id, 0, terms, 100 ether);
        assertEq(services.getServiceOfferTerms(id).revision, 1);
    }

    function testCommitmentPoolingServiceOffers_revertsWhenCancelledOfferReceivesServiceTerms() public {
        uint256 id = _rawApprovalOffer(keccak256("cancelled-before-terms"));
        module.cancelCommitment(id, "fictional-cancelled-offer");
        Service.ServiceOfferTermsInput memory terms = _personalTerms();
        vm.expectRevert(abi.encodeWithSelector(Core.CommitmentNotInState.selector, id, Core.CommitmentState.Cancelled));
        services.setServiceOfferTerms(id, 0, terms, 100 ether);
    }

    function testCommitmentPoolingServiceOffers_revertsWhenExpiredOfferReceivesServiceTerms() public {
        Core.CreateCommitmentParams memory params = _baseParams(keccak256("expired-before-terms"));
        params.claimMode = Core.ClaimMode.ApprovalGated;
        params.dueDate = uint64(block.timestamp + 1);
        vm.prank(CREATOR);
        uint256 id = module.createCommitment(params);
        vm.warp(block.timestamp + 2);
        module.expireCommitment(id);
        Service.ServiceOfferTermsInput memory terms = _personalTerms();
        vm.expectRevert(abi.encodeWithSelector(Core.CommitmentNotInState.selector, id, Core.CommitmentState.Expired));
        services.setServiceOfferTerms(id, 0, terms, 100 ether);
    }

    function testCommitmentPoolingServiceOffers_revertsWhenAcceptanceUsesDifferentClaimHash() public {
        uint256 id = _personalOffer(keccak256("wrong-accept-hash"));
        _requestPersonal(id);
        vm.expectRevert(abi.encodeWithSelector(Service.ServiceClaimConsentMismatch.selector, id, BUYER));
        vm.prank(PROVIDER_STEWARD);
        services.acceptServiceClaim(id, BUYER, keccak256("wrong-claim"));
        assertTrue(module.getPendingClaim(id, BUYER).active);
        assertEq(services.getAcceptedServiceTerms(id).buyer, address(0));
    }

    function testCommitmentPoolingServiceOffers_competingBuyersCannotReplaceFirstAcceptedConsent() public {
        uint256 id = _personalOffer(keccak256("competing-service-buyers"));
        bytes32 hash = _requestPersonal(id);
        hats.setGardener(BUYER_GARDEN, CLAIMANT, true);
        Service.ServiceClaimRequest memory request = _request(services.getServiceOfferTerms(id));
        vm.prank(CLAIMANT);
        bytes32 losingHash = services.requestServiceClaim(id, request);
        assertTrue(losingHash != hash);
        vm.prank(PROVIDER_STEWARD);
        services.acceptServiceClaim(id, BUYER, hash);
        vm.expectRevert(abi.encodeWithSelector(Core.CommitmentNotInState.selector, id, Core.CommitmentState.Accepted));
        vm.prank(PROVIDER_STEWARD);
        services.acceptServiceClaim(id, CLAIMANT, losingHash);
        assertEq(services.getAcceptedServiceTerms(id).consent.claimHash, hash);
        assertEq(module.getCommitment(id).counterparty, BUYER);
    }

    function testCommitmentPoolingServiceOffers_revertsWhenLegacyClaimBypassesServiceConsent() public {
        uint256 id = _personalOffer(keccak256("legacy-claim-bypass"));
        vm.expectRevert(abi.encodeWithSelector(Service.ServiceClaimPathRequired.selector, id));
        vm.prank(CLAIMANT);
        module.claimCommitment(id, Core.ClaimType.Individual, POOL_GARDEN);
    }

    function testCommitmentPoolingServiceOffers_revertsWhenOldPendingClaimBypassesTermsConsent() public {
        uint256 id = _rawApprovalOffer(keccak256("old-pending-claim"));
        vm.prank(CLAIMANT);
        module.claimCommitment(id, Core.ClaimType.Individual, POOL_GARDEN);
        services.setServiceOfferTerms(id, 0, _personalTerms(), 100 ether);
        vm.expectRevert(abi.encodeWithSelector(Service.ServiceClaimPathRequired.selector, id));
        vm.prank(PROVIDER_STEWARD);
        module.acceptClaim(id, CLAIMANT);
        vm.expectRevert(abi.encodeWithSelector(Service.ServiceOfferRevisionMismatch.selector, uint64(0), uint64(1)));
        vm.prank(PROVIDER_STEWARD);
        services.acceptServiceClaim(id, CLAIMANT, keccak256("unconsented"));
    }

    function testCommitmentPoolingServiceOffers_revertsWhenLegacyTermsMutatorsBypassRevision() public {
        uint256 id = _personalOffer(keccak256("legacy-terms-bypass"));
        Core.DeclaredConsideration memory consideration;
        vm.expectRevert(abi.encodeWithSelector(Service.ServiceOfferTermsLocked.selector, id));
        module.setDeclaredConsideration(id, consideration);
        vm.expectRevert(abi.encodeWithSelector(Service.ServiceOfferTermsLocked.selector, id));
        module.setDeclaredValue(id, 1, "fictional");
        address[] memory confirmers = new address[](0);
        vm.expectRevert(abi.encodeWithSelector(Service.ServiceOfferTermsLocked.selector, id));
        module.setConfirmerRule(id, confirmers, 1, false);
        assertEq(module.getCommitment(id).consideration.amount, 100 ether);
    }

    function testCommitmentPoolingServiceOffers_revertsWhenRequestUsesStaleTerms() public {
        uint256 id = _personalOffer(keccak256("stale-request"));
        Service.ServiceOfferTerms memory oldTerms = services.getServiceOfferTerms(id);
        Service.ServiceClaimRequest memory request = _request(oldTerms);
        services.setServiceOfferTerms(id, 1, oldTerms.terms, 200 ether);
        vm.expectRevert(abi.encodeWithSelector(Service.ServiceOfferRevisionMismatch.selector, uint64(1), uint64(2)));
        vm.prank(BUYER);
        services.requestServiceClaim(id, request);
    }

    function testCommitmentPoolingServiceOffers_revertsWhenRequestHashIsNotExpectedTerms() public {
        uint256 id = _personalOffer(keccak256("wrong-request-hash"));
        Service.ServiceOfferTerms memory terms = services.getServiceOfferTerms(id);
        Service.ServiceClaimRequest memory request = _request(terms);
        request.expectedTermsHash = keccak256("wrong");
        vm.expectRevert(
            abi.encodeWithSelector(
                Service.ServiceOfferTermsHashMismatch.selector, request.expectedTermsHash, terms.termsHash
            )
        );
        vm.prank(BUYER);
        services.requestServiceClaim(id, request);
    }

    function testCommitmentPoolingServiceOffers_revertsWhenSetterLosesRevisionRace() public {
        uint256 id = _personalOffer(keccak256("setter-race"));
        Service.ServiceOfferTermsInput memory terms = _personalTerms();
        vm.expectRevert(abi.encodeWithSelector(Service.ServiceOfferRevisionMismatch.selector, uint64(0), uint64(1)));
        services.setServiceOfferTerms(id, 0, terms, 200 ether);
    }

    function testCommitmentPoolingServiceOffers_acceptedTermsCannotBeRepricedOrRetargeted() public {
        uint256 id = _personalOffer(keccak256("accepted-immutable"));
        _acceptPersonal(id);
        Service.ServiceOfferTermsInput memory terms = _personalTerms();
        vm.expectRevert(abi.encodeWithSelector(Core.CommitmentNotInState.selector, id, Core.CommitmentState.Accepted));
        services.setServiceOfferTerms(id, 1, terms, 200 ether);
    }

    function testCommitmentPoolingServiceOffers_exactActiveRequestRetryKeepsItsIdentity() public {
        uint256 id = _personalOffer(keccak256("request-retry"));
        bytes32 hash = _requestPersonal(id);
        vm.warp(block.timestamp + 1 days);
        assertEq(_requestPersonal(id), hash);
        assertEq(services.getServiceClaimConsent(id, BUYER).requestNonce, 1);
    }

    function testCommitmentPoolingServiceOffers_revertsWhenActiveRequestRetargetsBuyerGarden() public {
        uint256 id = _personalOffer(keccak256("active-retarget"));
        _requestPersonal(id);
        hats.setGardener(POOL_GARDEN, BUYER, true);
        Service.ServiceClaimRequest memory request = _request(services.getServiceOfferTerms(id));
        request.buyerGarden = POOL_GARDEN;
        vm.expectRevert(abi.encodeWithSelector(Service.ActiveServiceClaimExists.selector, id, BUYER));
        vm.prank(BUYER);
        services.requestServiceClaim(id, request);
    }

    function testCommitmentPoolingServiceOffers_buyerWithdrawsWhilePausedWithoutErasingConsent() public {
        uint256 id = _personalOffer(keccak256("paused-withdrawal"));
        bytes32 hash = _requestPersonal(id);
        module.setPaused(true);
        vm.prank(BUYER);
        services.withdrawServiceClaim(id, hash);
        assertFalse(module.getPendingClaim(id, BUYER).active);
        assertEq(services.getServiceClaimConsent(id, BUYER).claimHash, hash);
        assertEq(services.getServiceClaimConsent(id, BUYER).requestNonce, 1);
    }

    function testCommitmentPoolingServiceOffers_oldRetryCannotRecreateWithdrawnRequest() public {
        uint256 id = _personalOffer(keccak256("withdraw-replay"));
        bytes32 hash = _requestPersonal(id);
        vm.prank(BUYER);
        services.withdrawServiceClaim(id, hash);
        Service.ServiceClaimRequest memory request = _request(services.getServiceOfferTerms(id));
        vm.expectRevert(abi.encodeWithSelector(Service.ServiceClaimNonceMismatch.selector, uint64(1), uint64(2)));
        vm.prank(BUYER);
        services.requestServiceClaim(id, request);
        request.requestNonce = 2;
        vm.prank(BUYER);
        bytes32 secondHash = services.requestServiceClaim(id, request);
        assertTrue(secondHash != hash);
    }

    function testCommitmentPoolingServiceOffers_declinedRequestNeedsNewExplicitNonce() public {
        uint256 id = _personalOffer(keccak256("decline-new-request"));
        bytes32 oldHash = _requestPersonal(id);
        vm.prank(PROVIDER_STEWARD);
        module.declineClaim(id, BUYER, "fictional-decline");
        Service.ServiceClaimRequest memory request = _request(services.getServiceOfferTerms(id));
        request.requestNonce = 2;
        vm.prank(BUYER);
        bytes32 newHash = services.requestServiceClaim(id, request);
        assertTrue(newHash != oldHash);
        assertEq(services.getServiceClaimConsent(id, BUYER).requestNonce, 2);
    }

    function testCommitmentPoolingServiceOffers_revertsWhenAnotherAccountWithdrawsBuyerClaim() public {
        uint256 id = _personalOffer(keccak256("withdraw-authority"));
        bytes32 hash = _requestPersonal(id);
        vm.expectRevert(abi.encodeWithSelector(Core.ClaimNotPending.selector, id, CLAIMANT));
        vm.prank(CLAIMANT);
        services.withdrawServiceClaim(id, hash);
        assertTrue(module.getPendingClaim(id, BUYER).active);
    }

    function testCommitmentPoolingServiceOffers_voucherServiceHasExplicitHolderAndNoGdObligation() public {
        uint256 id = _rawApprovalOffer(keccak256("voucher-service"));
        services.setServiceOfferTerms(id, 0, _voucherTerms(), 0);
        Service.ServiceClaimRequest memory request = _request(services.getServiceOfferTerms(id));
        request.voucherHolder = HOLDER;
        vm.prank(BUYER);
        bytes32 hash = services.requestServiceClaim(id, request);
        vm.prank(PROVIDER_STEWARD);
        services.acceptServiceClaim(id, BUYER, hash);
        Service.AcceptedServiceTerms memory accepted = services.getAcceptedServiceTerms(id);
        assertEq(accepted.buyer, BUYER);
        assertEq(accepted.consent.voucherHolder, HOLDER);
        assertEq(accepted.offer.terms.voucherIssuer, ISSUER_RESERVE);
        assertEq(accepted.offer.terms.voucherToken, VOUCHER);
        assertEq(accepted.offer.terms.voucherChainId, 100);
        assertEq(accepted.offer.terms.voucherUnits, 1200);
        assertEq(accepted.gdPrice, 0);
        assertEq(uint256(module.getCommitment(id).consideration.rail), uint256(Core.ConsiderationRail.None));
    }

    function testCommitmentPoolingServiceOffers_unfundedVoucherAcceptancePreservesPendingConsent() public {
        uint256 id = _rawApprovalOffer(keccak256("unfunded-voucher"));
        services.setServiceOfferTerms(id, 0, _voucherTerms(), 0);
        Service.ServiceClaimRequest memory request = _request(services.getServiceOfferTerms(id));
        request.voucherHolder = HOLDER;
        vm.prank(BUYER);
        bytes32 hash = services.requestServiceClaim(id, request);
        readiness.setReady(false);
        vm.expectRevert(VoucherServiceReadinessMock.EscrowNotReady.selector);
        vm.prank(PROVIDER_STEWARD);
        services.acceptServiceClaim(id, BUYER, hash);
        assertTrue(module.getPendingClaim(id, BUYER).active);
        assertEq(services.getAcceptedServiceTerms(id).buyer, address(0));
        assertEq(Voucher(address(module)).getVoucherServiceAcceptance(id).setupId, bytes32(0));
        assertEq(uint256(module.getCommitment(id).state), uint256(Core.CommitmentState.Offered));
        readiness.setReady(true);
        vm.prank(PROVIDER_STEWARD);
        services.acceptServiceClaim(id, BUYER, hash);
        Voucher.VoucherServiceAcceptance memory accepted = Voucher(address(module)).getVoucherServiceAcceptance(id);
        assertEq(accepted.setupModule, address(readiness));
        assertEq(accepted.claimHash, hash);
        assertEq(accepted.termsRevision, 1);
        assertEq(accepted.requestNonce, 1);
        assertTrue(accepted.setupId != bytes32(0) && accepted.depositReceiptHash != bytes32(0));
        vm.prank(PROVIDER_STEWARD);
        module.cancelCommitment(id, "fictional accepted voucher cancellation");
        assertEq(
            keccak256(abi.encode(Voucher(address(module)).getVoucherServiceAcceptance(id))), keccak256(abi.encode(accepted))
        );
    }

    function testCommitmentPoolingServiceOffers_rejectsZeroReadinessReceiptAtomically() public {
        uint256 id = _rawApprovalOffer(keccak256("zero-voucher-receipt"));
        services.setServiceOfferTerms(id, 0, _voucherTerms(), 0);
        Service.ServiceClaimRequest memory request = _request(services.getServiceOfferTerms(id));
        request.voucherHolder = HOLDER;
        vm.prank(BUYER);
        bytes32 hash = services.requestServiceClaim(id, request);
        readiness.setZeroReceipt(true);
        vm.expectRevert(abi.encodeWithSelector(Voucher.InvalidVoucherServiceAcceptance.selector, id));
        vm.prank(PROVIDER_STEWARD);
        services.acceptServiceClaim(id, BUYER, hash);
        assertTrue(module.getPendingClaim(id, BUYER).active);
        assertEq(services.getAcceptedServiceTerms(id).buyer, address(0));
    }

    function testCommitmentPoolingServiceOffers_combinedVoucherOptInRequiresBothGuardsAndRecordsBothReceipts() public {
        EarnedVoucherAcceptanceMock earned = new EarnedVoucherAcceptanceMock(address(module), block.chainid, 1);
        Voucher voucher = Voucher(address(module));
        module.setPaused(true);
        voucher.pinEarnedVoucherModule(address(earned));
        module.setPaused(false);
        uint256 id = _rawApprovalOffer(keccak256("combined-voucher-acceptance"));
        services.setServiceOfferTerms(id, 0, _voucherTerms(), 0);
        bytes32 earnedTerms = keccak256("fictional earned voucher terms");
        earned.bind(id, 1, earnedTerms);
        Service.ServiceClaimRequest memory request = _request(services.getServiceOfferTerms(id));
        request.voucherHolder = HOLDER;
        vm.prank(BUYER);
        bytes32 claimHash = services.requestServiceClaim(id, request);

        earned.setReady(false);
        vm.expectRevert(EarnedVoucherAcceptanceMock.ConsentNotReady.selector);
        vm.prank(PROVIDER_STEWARD);
        services.acceptServiceClaim(id, BUYER, claimHash);
        earned.setReady(true);
        readiness.setReady(false);
        vm.expectRevert(VoucherServiceReadinessMock.EscrowNotReady.selector);
        vm.prank(PROVIDER_STEWARD);
        services.acceptServiceClaim(id, BUYER, claimHash);
        assertTrue(module.getPendingClaim(id, BUYER).active);
        assertEq(module.getCommitment(id).counterparty, address(0));
        assertEq(voucher.getEarnedVoucherBinding(id).acceptedRevision, 0);
        assertEq(voucher.getVoucherServiceAcceptance(id).setupId, bytes32(0));

        readiness.setReady(true);
        vm.prank(PROVIDER_STEWARD);
        services.acceptServiceClaim(id, BUYER, claimHash);
        Voucher.EarnedVoucherBinding memory binding = voucher.getEarnedVoucherBinding(id);
        Voucher.VoucherServiceAcceptance memory receipt = voucher.getVoucherServiceAcceptance(id);
        assertEq(binding.acceptedRevision, 1);
        assertEq(binding.acceptedTermsHash, earnedTerms);
        assertEq(binding.acceptedCounterparty, BUYER);
        assertEq(receipt.claimHash, claimHash);
        assertEq(receipt.setupModule, address(readiness));
        assertTrue(receipt.setupId != bytes32(0) && receipt.depositReceiptHash != bytes32(0));
    }

    function testCommitmentPoolingServiceOffers_legacyAndPersonalGdNeverCallVoucherPeer() public {
        readiness.setReady(false);
        uint256 legacy = _createOffer(keccak256("legacy-peer-independent"));
        _acceptOffer(legacy);
        uint256 personal = _personalOffer(keccak256("personal-peer-independent"));
        _acceptPersonal(personal);
        assertEq(module.getCommitment(legacy).counterparty, CLAIMANT);
        assertEq(module.getCommitment(personal).counterparty, BUYER);
        assertEq(Voucher(address(module)).getVoucherServiceAcceptance(personal).setupId, bytes32(0));
    }

    function testUpgrade_CommitmentPoolingServiceOffers_preservesFundedVoucherAcceptanceReceiptAndPin() public {
        uint256 id = _rawApprovalOffer(keccak256("upgrade-voucher-accepted"));
        services.setServiceOfferTerms(id, 0, _voucherTerms(), 0);
        Service.ServiceClaimRequest memory request = _request(services.getServiceOfferTerms(id));
        request.voucherHolder = HOLDER;
        vm.prank(BUYER);
        bytes32 hash = services.requestServiceClaim(id, request);
        vm.prank(PROVIDER_STEWARD);
        services.acceptServiceClaim(id, BUYER, hash);
        bytes32 beforeHash = keccak256(
            abi.encode(Voucher(address(module)).getVoucherServiceAcceptance(id), services.getAcceptedServiceTerms(id))
        );
        module.setPaused(true);
        address replacement = deployCode("CommitmentPooling.sol:CommitmentPoolingModule");
        UUPSUpgradeable(address(module)).upgradeTo(replacement);
        assertEq(Voucher(address(module)).voucherServiceSetupModule(), address(readiness));
        assertEq(
            keccak256(
                abi.encode(Voucher(address(module)).getVoucherServiceAcceptance(id), services.getAcceptedServiceTerms(id))
            ),
            beforeHash
        );
        vm.expectRevert(Voucher.VoucherAcceptancePeerAlreadyPinned.selector);
        Voucher(address(module)).pinVoucherServiceSetupModule(address(readiness));
    }

    function testCommitmentPoolingServiceOffers_revertsWhenVoucherTermsAlsoChargeGd() public {
        uint256 id = _rawApprovalOffer(keccak256("mixed-route"));
        Service.ServiceOfferTermsInput memory terms = _voucherTerms();
        vm.expectRevert(Service.InvalidServiceOfferTerms.selector);
        services.setServiceOfferTerms(id, 0, terms, 1);
    }

    function testCommitmentPoolingServiceOffers_revertsWhenVoucherAssetIsOnAnotherChain() public {
        uint256 id = _rawApprovalOffer(keccak256("wrong-voucher-chain"));
        Service.ServiceOfferTermsInput memory terms = _voucherTerms();
        terms.voucherChainId = 42_161;
        vm.expectRevert(Service.InvalidServiceOfferTerms.selector);
        services.setServiceOfferTerms(id, 0, terms, 0);
    }

    function testCommitmentPoolingServiceOffers_revertsWhenGdClaimIncludesVoucherHolder() public {
        uint256 id = _personalOffer(keccak256("gd-holder-mix"));
        Service.ServiceClaimRequest memory request = _request(services.getServiceOfferTerms(id));
        request.voucherHolder = HOLDER;
        vm.expectRevert(Service.InvalidServiceOfferTerms.selector);
        vm.prank(BUYER);
        services.requestServiceClaim(id, request);
    }

    function testCommitmentPoolingServiceOffers_revertsWhenVoucherClaimOmitsHolder() public {
        uint256 id = _rawApprovalOffer(keccak256("missing-holder"));
        services.setServiceOfferTerms(id, 0, _voucherTerms(), 0);
        Service.ServiceClaimRequest memory request = _request(services.getServiceOfferTerms(id));
        vm.expectRevert(Service.InvalidServiceOfferTerms.selector);
        vm.prank(BUYER);
        services.requestServiceClaim(id, request);
    }

    function testCommitmentPoolingServiceOffers_revertsWhenNewBilateralOfferTargetsServiceOffer() public {
        uint256 id = _rawApprovalOffer(keccak256("bilateral-target"));
        services.setServiceOfferTerms(id, 0, _voucherTerms(), 0);
        Core.CreateCommitmentParams memory params = _baseParams(keccak256("new-bilateral"));
        params.counterCommitmentId = id;
        vm.expectRevert(abi.encodeWithSelector(Service.ServiceExchangeUnsupported.selector, id));
        vm.prank(CLAIMANT);
        module.createCommitment(params);
    }

    function testCommitmentPoolingServiceOffers_revertsWhenPreexistingBilateralPairBypassesVoucherConsent() public {
        uint256 id = _rawApprovalOffer(keccak256("existing-pair-a"));
        Core.CreateCommitmentParams memory params = _baseParams(keccak256("existing-pair-b"));
        params.counterCommitmentId = id;
        vm.prank(CLAIMANT);
        uint256 counterpart = module.createCommitment(params);
        services.setServiceOfferTerms(id, 0, _voucherTerms(), 0);
        vm.expectRevert(abi.encodeWithSelector(Service.ServiceExchangeUnsupported.selector, id));
        vm.prank(CREATOR);
        module.acceptExchange(counterpart);
        assertEq(uint256(module.getCommitment(id).state), uint256(Core.CommitmentState.Offered));
        assertEq(uint256(module.getCommitment(counterpart).state), uint256(Core.CommitmentState.Offered));
    }

    function testCommitmentPoolingServiceOffers_terminalCoreStatePreservesOriginalAcceptedConsent() public {
        uint256 id = _personalOffer(keccak256("durable-accepted-record"));
        bytes32 hash = _acceptPersonal(id);
        vm.prank(PROVIDER_STEWARD);
        module.cancelCommitment(id, "fictional-service-cancelled");
        Service.AcceptedServiceTerms memory accepted = services.getAcceptedServiceTerms(id);
        assertEq(accepted.buyer, BUYER);
        assertEq(accepted.consent.claimHash, hash);
        assertEq(accepted.consent.buyerGarden, BUYER_GARDEN);
        assertEq(accepted.gdPrice, 100 ether);
    }

    function testFuzz_CommitmentPoolingServiceOffers_preservesExactAgreedPersonalGdPrice(uint96 amount) public {
        uint256 price = bound(uint256(amount), 1, type(uint96).max);
        uint256 id = _rawApprovalOffer(keccak256("exact-personal-price"));
        services.setServiceOfferTerms(id, 0, _personalTerms(), price);
        _acceptPersonal(id);
        assertEq(services.getAcceptedServiceTerms(id).gdPrice, price);
        assertEq(module.getCommitment(id).consideration.amount, price);
    }

    /// @dev Same compiled implementation artifact, newly deployed. Historical deployed-version
    ///      compatibility and production timelock ownership require their separate release proofs.
    function testUpgrade_CommitmentPoolingServiceOffers_sameArtifactUpgradePreservesLegacyAndServiceState() public {
        uint256 legacyId = _createOffer(keccak256("upgrade-legacy"));
        _acceptOffer(legacyId);
        uint256 pendingId = _personalOffer(keccak256("upgrade-pending"));
        bytes32 pendingHash = _requestPersonal(pendingId);
        uint256 acceptedId = _personalOffer(keccak256("upgrade-accepted"));
        _acceptPersonal(acceptedId);
        bytes32 stateBefore = _upgradeStateHash(legacyId, pendingId, acceptedId);
        module.setPaused(true);
        address previousImplementation = _implementation();
        address nextImplementation = deployCode("CommitmentPooling.sol:CommitmentPoolingModule");
        assertTrue(nextImplementation != previousImplementation);
        UUPSUpgradeable(address(module)).upgradeTo(nextImplementation);
        assertEq(_implementation(), nextImplementation);
        assertEq(module.owner(), address(this));
        assertTrue(module.paused());
        assertEq(_upgradeStateHash(legacyId, pendingId, acceptedId), stateBefore);
        module.setPaused(false);
        vm.prank(PROVIDER_STEWARD);
        services.acceptServiceClaim(pendingId, BUYER, pendingHash);
        assertEq(services.getAcceptedServiceTerms(pendingId).consent.claimHash, pendingHash);
        assertEq(module.getCommitment(legacyId).counterparty, CLAIMANT);
    }

    function testUpgrade_CommitmentPoolingServiceOffers_revertsWhenBuyerAttemptsImplementationUpgrade() public {
        uint256 id = _personalOffer(keccak256("unauthorized-upgrade"));
        bytes32 hash = _requestPersonal(id);
        module.setPaused(true);
        address implementationBefore = _implementation();
        address candidate = deployCode("CommitmentPooling.sol:CommitmentPoolingModule");
        vm.expectRevert("Ownable: caller is not the owner");
        vm.prank(BUYER);
        UUPSUpgradeable(address(module)).upgradeTo(candidate);
        assertEq(_implementation(), implementationBefore);
        assertEq(services.getServiceClaimConsent(id, BUYER).claimHash, hash);
        assertTrue(module.getPendingClaim(id, BUYER).active);
    }

    function _implementation() private view returns (address) {
        return address(uint160(uint256(vm.load(address(module), IMPLEMENTATION_SLOT))));
    }

    function _upgradeStateHash(uint256 legacyId, uint256 pendingId, uint256 acceptedId) private view returns (bytes32) {
        return keccak256(
            bytes.concat(
                abi.encode(module.getCommitment(legacyId), module.getCommitment(pendingId)),
                abi.encode(services.getServiceOfferTerms(pendingId), module.getPendingClaim(pendingId, BUYER)),
                abi.encode(services.getServiceClaimConsent(pendingId, BUYER), services.getAcceptedServiceTerms(acceptedId)),
                abi.encode(module.getCommitment(acceptedId))
            )
        );
    }

    function _personalOffer(bytes32 key) private returns (uint256 id) {
        id = _rawApprovalOffer(key);
        services.setServiceOfferTerms(id, 0, _personalTerms(), 100 ether);
    }

    function _rawApprovalOffer(bytes32 key) private returns (uint256 id) {
        Core.CreateCommitmentParams memory params = _baseParams(key);
        params.claimMode = Core.ClaimMode.ApprovalGated;
        vm.prank(CREATOR);
        id = module.createCommitment(params);
    }

    function _personalTerms() private pure returns (Service.ServiceOfferTermsInput memory terms) {
        terms.route = Service.ServicePaymentRoute.PersonalGd;
        terms.serviceTermsRef = keccak256("fictional AI access one period");
        terms.remedyTermsRef = keccak256("fictional full refund on agreed non-delivery");
    }

    function _voucherTerms() private pure returns (Service.ServiceOfferTermsInput memory terms) {
        terms.route = Service.ServicePaymentRoute.Voucher;
        terms.serviceTermsRef = keccak256("fictional twelve access periods");
        terms.remedyTermsRef = keccak256("fictional mutual-consent partial remedy");
        terms.voucherChainId = 100;
        terms.voucherIssuer = ISSUER_RESERVE;
        terms.voucherToken = VOUCHER;
        terms.voucherUnits = 1200;
    }

    function _requestPersonal(uint256 id) private returns (bytes32 hash) {
        Service.ServiceClaimRequest memory request = _request(services.getServiceOfferTerms(id));
        vm.prank(BUYER);
        return services.requestServiceClaim(id, request);
    }

    function _acceptPersonal(uint256 id) private returns (bytes32 hash) {
        hash = _requestPersonal(id);
        vm.prank(PROVIDER_STEWARD);
        services.acceptServiceClaim(id, BUYER, hash);
    }

    function _request(Service.ServiceOfferTerms memory terms) private pure returns (Service.ServiceClaimRequest memory) {
        return Service.ServiceClaimRequest({
            buyerGarden: BUYER_GARDEN,
            voucherHolder: address(0),
            expectedRevision: terms.revision,
            requestNonce: 1,
            expectedTermsHash: terms.termsHash
        });
    }
}
