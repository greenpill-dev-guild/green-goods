// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule as Core } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentServiceOffers as Service } from "../../src/interfaces/ICommitmentServiceOffers.sol";
import { ISettlementModule as Settlement } from "../../src/interfaces/ISettlementModule.sol";
import {
    ISettlementPersonalServicePurchases as Personal
} from "../../src/interfaces/ISettlementPersonalServicePurchases.sol";
import { PersonalServicePurchaseFixture } from "../helpers/PersonalServicePurchaseFixture.sol";

contract PersonalServiceLegacyIntegrationTest is PersonalServicePurchaseFixture {
    function setUp() public {
        _setUpPersonalFixture();
        settlement.setPaused(true);
        _registerAccount(POOL_GARDEN, address(0xCE10), address(0xCE11));
        settlement.setPaused(false);
    }

    function testIntegration_PersonalServiceLegacy_opaqueAssertionCannotPoisonAnotherGardensTypedReceipt() public {
        uint256 id = _personalOffer(keccak256("victim-receipt"));
        _request(id, 1);
        uint256 personalId = _pledge(id);
        Personal.VerifiedCeloDeposit memory receipt = _receipt(personalId, PRICE);
        bytes32 derivedKey = keccak256(abi.encode(receipt.chainId, receipt.transactionHash, receipt.logIndex));
        (, uint256 legacyId) = _legacyFunding(keccak256("opaque-poison-attempt"));
        vm.prank(PROVIDER_STEWARD);
        settlement.recordFundingDeposit(legacyId, PRICE, derivedKey);
        vm.prank(BUYER_STEWARD);
        personal.recordPersonalServiceDeposit(personalId, receipt);
        assertEq(
            personal.personalServiceDepositFunding(receipt.chainId, receipt.transactionHash, receipt.logIndex), personalId
        );
        assertEq(settlement.getCommitmentFunding(legacyId).depositReference, derivedKey);
        assertEq(settlement.getCommitmentFunding(personalId).depositedAmount, PRICE);
        assertEq(settlement.getCommitmentFunding(personalId).garden, BUYER_GARDEN);
    }

    function testIntegration_PersonalServiceLegacy_preOptInMoneyCanWindDownButNeverConsumeServiceAuthority() public {
        (uint256 id, uint256 legacyId) = _legacyFunding(keccak256("historical-money"));
        services.setServiceOfferTerms(id, 0, _personalTerms(), PRICE);
        // Historical opaque attestations retain their original trust and refund semantics.
        vm.prank(PROVIDER_STEWARD);
        settlement.recordFundingDeposit(legacyId, PRICE, keccak256("explicit-legacy-post-optin-recording"));
        vm.prank(PROVIDER_STEWARD);
        module.declineClaim(id, CLAIMANT, "fictional-legacy-request-declined");
        _request(id, 1);
        uint256 canonical = _pledge(id);
        _recordDeposit(canonical, PRICE);
        _accept(id);
        vm.expectRevert(abi.encodeWithSelector(Personal.PersonalServiceModeRequired.selector, id));
        vm.prank(PROVIDER_STEWARD);
        settlement.consumeFunding(legacyId);
        _consume(canonical);
        vm.prank(PROVIDER_STEWARD);
        uint256 refund = settlement.queueFundingRefund(legacyId);
        assertEq(settlement.getDisbursement(refund).amount, PRICE);
        assertEq(settlement.getDisbursement(refund).source, address(0xCE10));
        assertEq(uint256(settlement.getCommitmentFunding(canonical).state), uint256(Settlement.FundingState.Consumed));
        assertEq(uint256(settlement.getCommitmentFunding(legacyId).state), uint256(Settlement.FundingState.RefundQueued));
    }

    function testIntegration_PersonalServiceLegacy_newLegacyPledgeCannotBypassOptedInTerms() public {
        uint256 id = _personalOffer(keccak256("legacy-pledge-bypass"));
        _request(id, 1);
        vm.expectRevert(abi.encodeWithSelector(Personal.PersonalServiceModeRequired.selector, id));
        vm.prank(PROVIDER_STEWARD);
        settlement.recordFunding(id, BUYER, REFUND_ACCOUNT);
    }

    function testIntegration_PersonalServiceLegacy_supersededAcceptedSameBuyerKeepsOldRefundRight() public {
        uint256 id = _personalOffer(keccak256("renewed-same-buyer"));
        bytes32 oldHash = _request(id, 1);
        uint256 oldFunding = _pledge(id);
        _recordDeposit(oldFunding, PRICE);
        vm.prank(BUYER);
        services.withdrawServiceClaim(id, oldHash);
        _request(id, 2);
        _accept(id);
        vm.expectRevert(abi.encodeWithSelector(Personal.PersonalServiceTermsChanged.selector, oldFunding));
        _consume(oldFunding);
        vm.prank(BUYER_STEWARD);
        uint256 refund = settlement.queueFundingRefund(oldFunding);
        assertEq(settlement.getDisbursement(refund).recipient, REFUND_ACCOUNT);
        assertEq(settlement.getDisbursement(refund).amount, PRICE);
    }

    function testIntegration_PersonalServiceLegacy_disputedBookingCannotChoosePayoutOrRefund() public {
        uint256 id = _personalOffer(keccak256("disputed-funding"));
        _request(id, 1);
        uint256 fundingId = _pledge(id);
        _recordDeposit(fundingId, PRICE);
        _accept(id);
        vm.prank(BUYER);
        module.raiseDispute(id, "fictional-delivery-dispute");
        vm.expectRevert(abi.encodeWithSelector(Personal.PersonalServiceTermsChanged.selector, fundingId));
        _consume(fundingId);
        vm.expectRevert(abi.encodeWithSelector(Settlement.FundingRefundNotEligible.selector, fundingId));
        vm.prank(BUYER_STEWARD);
        settlement.queueFundingRefund(fundingId);
        vm.prank(PROVIDER_STEWARD);
        module.resolveDispute(id, Core.DisputeResolution.Cancelled, "fictional-full-refund-resolution");
        vm.prank(BUYER_STEWARD);
        uint256 refund = settlement.queueFundingRefund(fundingId);
        assertEq(settlement.getDisbursement(refund).amount, PRICE);
    }

    function _legacyFunding(bytes32 key) private returns (uint256 id, uint256 fundingId) {
        Core.CreateCommitmentParams memory params = _baseParams(key);
        params.claimMode = Core.ClaimMode.ApprovalGated;
        params.consideration =
            Core.DeclaredConsideration(Core.ConsiderationRail.CeloSettlement, address(0), address(0), PRICE);
        vm.prank(CREATOR);
        id = module.createCommitment(params);
        vm.prank(CLAIMANT);
        module.claimCommitment(id, Core.ClaimType.Individual, POOL_GARDEN);
        vm.prank(PROVIDER_STEWARD);
        fundingId = settlement.recordFunding(id, CLAIMANT, address(0xCE12));
    }
}
