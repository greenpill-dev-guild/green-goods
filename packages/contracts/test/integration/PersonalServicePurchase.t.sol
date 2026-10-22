// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule as Core } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentServiceOffers as Service } from "../../src/interfaces/ICommitmentServiceOffers.sol";
import { ISettlementModule as Settlement } from "../../src/interfaces/ISettlementModule.sol";
import {
    ISettlementPersonalServicePurchases as Personal
} from "../../src/interfaces/ISettlementPersonalServicePurchases.sol";
import {
    PersonalServicePurchaseFixture,
    PersonalServiceSettlementHarness
} from "../helpers/PersonalServicePurchaseFixture.sol";

contract PersonalServicePurchaseIntegrationTest is PersonalServicePurchaseFixture {
    function setUp() public {
        _setUpPersonalFixture();
    }

    function testIntegration_PersonalServicePurchase_revertsWhenFulfilledServiceHasNoConsumedFunding() public {
        uint256 id = _personalOffer(keccak256("unfunded"));
        _request(id, 1);
        _accept(id);
        _fulfill(id, false);
        assertEq(module.getCommitment(id).payerGarden, BUYER_GARDEN);
        assertEq(module.getCommitment(id).providerGarden, POOL_GARDEN);
        assertFalse(hats.isGardenerOf(POOL_GARDEN, BUYER));
        (Settlement.RecognitionEntry[] memory entries, bytes32 hash) = _recognition(id);
        vm.expectRevert(abi.encodeWithSelector(Personal.PersonalServiceFundingRequired.selector, id));
        vm.prank(BUYER_STEWARD);
        settlement.createCommitmentPayoutPlan(id, entries, hash);
    }

    function testIntegration_PersonalServicePurchase_bindsExactBuyerConsentAndRetryIdentity() public {
        uint256 id = _personalOffer(keccak256("bound"));
        _request(id, 1);
        uint256 fundingId = _pledge(id);
        assertEq(_pledge(id), fundingId);
        Personal.PersonalServicePurchase memory purchase = personal.getPersonalServicePurchase(fundingId);
        assertEq(purchase.terms.buyer, BUYER);
        assertEq(purchase.terms.recipient, BUYER);
        assertEq(purchase.terms.buyerGarden, BUYER_GARDEN);
        assertEq(purchase.terms.providerGarden, POOL_GARDEN);
        assertEq(purchase.terms.custodySafe, address(buyerSafe));
        assertEq(purchase.terms.token, address(token));
        assertEq(purchase.terms.sourceChainId, 42_161);
        assertEq(purchase.terms.sourceModule, address(settlement));
        assertEq(purchase.terms.destinationChainId, CELO_CHAIN_ID);
        assertEq(personal.fundingOfPersonalServicePurchase(purchase.terms.purchaseId), fundingId);
        assertEq(settlement.getCommitmentFunding(fundingId).garden, BUYER_GARDEN);
    }

    function testIntegration_PersonalServicePurchase_revertsWhenAnotherCallerPledgesBuyerConsent() public {
        uint256 id = _personalOffer(keccak256("pledge-authority"));
        _request(id, 1);
        Personal.PersonalPurchaseConsent memory consent = _consent(id);
        vm.expectRevert(abi.encodeWithSelector(Personal.PersonalServiceConsentMismatch.selector, id));
        vm.prank(BUYER_STEWARD);
        personal.pledgePersonalServicePurchase(consent);
    }

    function testIntegration_PersonalServicePurchase_revertsWhenSignedFinancialFactsDiffer() public {
        uint256 id = _personalOffer(keccak256("financial-race"));
        _request(id, 1);
        Personal.PersonalPurchaseConsent memory consent = _consent(id);
        for (uint256 i; i < 4; ++i) {
            Personal.PersonalPurchaseConsent memory bad = _consent(id);
            if (i == 0) bad.expectedCustodySafe = address(protocolSafe);
            if (i == 1) bad.expectedToken = address(0xBAD);
            if (i == 2) bad.expectedDestinationChainId = 100;
            if (i == 3) bad.expectedPrice += 1;
            vm.expectRevert(abi.encodeWithSelector(Personal.PersonalServiceConsentMismatch.selector, id));
            vm.prank(BUYER);
            personal.pledgePersonalServicePurchase(bad);
        }
        vm.prank(BUYER);
        personal.pledgePersonalServicePurchase(consent);
    }

    function testIntegration_PersonalServicePurchase_revertsWhenBuyerSafeIsMissingOrInactive() public {
        uint256 id = _personalOffer(keccak256("missing-safe"));
        _request(id, 1);
        Personal.PersonalPurchaseConsent memory consent = _consent(id);
        PersonalServiceSettlementHarness harness = PersonalServiceSettlementHarness(payable(address(settlement)));
        harness.replaceAccountForTest(BUYER_GARDEN, address(0));
        vm.expectRevert(abi.encodeWithSelector(Settlement.UnknownSettlementAccount.selector, BUYER_GARDEN));
        vm.prank(BUYER);
        personal.pledgePersonalServicePurchase(consent);
        harness.replaceAccountForTest(BUYER_GARDEN, address(buyerSafe));
        settlement.setAccountActive(BUYER_GARDEN, false);
        vm.expectRevert(abi.encodeWithSelector(Settlement.SettlementAccountInactive.selector, BUYER_GARDEN));
        vm.prank(BUYER);
        personal.pledgePersonalServicePurchase(consent);
        settlement.setAccountActive(BUYER_GARDEN, true);
        _pledge(id);
    }

    function testIntegration_PersonalServicePurchase_recordsOnlyBoundPrivilegedReceiptFacts() public {
        uint256 id = _personalOffer(keccak256("receipt-facts"));
        _request(id, 1);
        uint256 fundingId = _pledge(id);
        for (uint256 i; i < 9; ++i) {
            Personal.VerifiedCeloDeposit memory bad = _receipt(fundingId, PRICE);
            if (i == 0) bad.chainId = 100;
            if (i == 1) bad.token = address(0xBAD);
            if (i == 2) bad.depositingAccount = BUYER;
            if (i == 3) bad.custodySafe = address(protocolSafe);
            if (i == 4) bad.transactionHash = bytes32(0);
            if (i == 5) bad.blockHash = bytes32(0);
            if (i == 6) bad.blockNumber = 0;
            if (i == 7) bad.receivedAmount = 0;
            if (i == 8) bad.grossDebit = bad.receivedAmount - 1;
            vm.expectRevert(abi.encodeWithSelector(Personal.PersonalServiceReceiptMismatch.selector, fundingId));
            vm.prank(BUYER_STEWARD);
            personal.recordPersonalServiceDeposit(fundingId, bad);
        }
        Personal.VerifiedCeloDeposit memory receipt = _receipt(fundingId, PRICE);
        vm.expectRevert(abi.encodeWithSelector(Settlement.NotSettlementSteward.selector, PROVIDER_STEWARD, BUYER_GARDEN));
        vm.prank(PROVIDER_STEWARD);
        personal.recordPersonalServiceDeposit(fundingId, receipt);
        _recordDeposit(fundingId, PRICE);
        assertEq(token.balanceOf(address(buyerSafe)), 0, "bookkeeping cannot pull or manufacture G$");
        assertEq(
            personal.personalServiceDepositFunding(receipt.chainId, receipt.transactionHash, receipt.logIndex), fundingId
        );
        vm.expectRevert(abi.encodeWithSelector(Personal.PersonalServiceDepositProofRequired.selector, fundingId));
        vm.prank(BUYER_STEWARD);
        settlement.recordFundingDeposit(fundingId, PRICE, keccak256("opaque-bypass"));
    }

    function testIntegration_PersonalServicePurchase_sameReceiptCannotFundAnotherBooking() public {
        uint256 firstId = _personalOffer(keccak256("receipt-first"));
        _request(firstId, 1);
        uint256 first = _pledge(firstId);
        _recordDeposit(first, PRICE);
        uint256 secondId = _personalOffer(keccak256("receipt-second"));
        _request(secondId, 1);
        uint256 second = _pledge(secondId);
        Personal.VerifiedCeloDeposit memory receipt = _receipt(first, PRICE);
        bytes32 key = keccak256(abi.encode(receipt.chainId, receipt.transactionHash, receipt.logIndex));
        vm.expectRevert(abi.encodeWithSelector(Settlement.FundingDepositReferenceUsed.selector, key, first));
        vm.prank(BUYER_STEWARD);
        personal.recordPersonalServiceDeposit(second, receipt);
    }

    function testIntegration_PersonalServicePurchase_shortfallIsRecordedAndRefundsActualNet() public {
        uint256 id = _personalOffer(keccak256("net-shortfall"));
        bytes32 claimHash = _request(id, 1);
        uint256 fundingId = _pledge(id);
        _recordDeposit(fundingId, PRICE - 1);
        _accept(id);
        vm.expectRevert(abi.encodeWithSelector(Settlement.FundingDepositBelowPrice.selector, fundingId, PRICE, PRICE - 1));
        _consume(fundingId);
        vm.prank(PROVIDER_STEWARD);
        module.cancelCommitment(id, "fictional-net-shortfall-cancellation");
        vm.prank(BUYER_STEWARD);
        uint256 refund = settlement.queueFundingRefund(fundingId);
        assertEq(settlement.getDisbursement(refund).amount, PRICE - 1);
        assertTrue(claimHash != bytes32(0));
    }

    function testIntegration_PersonalServicePurchase_overageCannotBecomeUnconsentedTopUp() public {
        uint256 id = _personalOffer(keccak256("overage"));
        _request(id, 1);
        uint256 fundingId = _pledge(id);
        _recordDeposit(fundingId, PRICE + 26 ether);
        _accept(id);
        vm.expectRevert(abi.encodeWithSelector(Personal.PersonalServiceExcessNotConsented.selector, fundingId));
        _consume(fundingId);
    }

    function testIntegration_PersonalServicePurchase_staleConsentCannotSurviveTermsOrClaimRace() public {
        uint256 id = _personalOffer(keccak256("pledge-revision-race"));
        _request(id, 1);
        Personal.PersonalPurchaseConsent memory consent = _consent(id);
        for (uint256 i; i < 4; ++i) {
            Personal.PersonalPurchaseConsent memory bad = _consent(id);
            if (i == 0) bad.expectedTermsRevision += 1;
            if (i == 1) bad.expectedTermsHash = keccak256("wrong-terms");
            if (i == 2) bad.expectedClaimHash = keccak256("wrong-claim");
            if (i == 3) bad.expectedRequestNonce += 1;
            vm.expectRevert(abi.encodeWithSelector(Personal.PersonalServiceConsentMismatch.selector, id));
            vm.prank(BUYER);
            personal.pledgePersonalServicePurchase(bad);
        }
        services.setServiceOfferTerms(id, 1, _personalTerms(), PRICE + 1);
        vm.expectRevert(abi.encodeWithSelector(Personal.PersonalServiceConsentMismatch.selector, id));
        vm.prank(BUYER);
        personal.pledgePersonalServicePurchase(consent);
        assertEq(settlement.fundingOfCommitmentFunder(id, BUYER), 0);
    }

    function testIntegration_PersonalServicePurchase_changedTermsKeepOldReceiptRefundable() public {
        uint256 id = _personalOffer(keccak256("superseded"));
        _request(id, 1);
        uint256 fundingId = _pledge(id);
        services.setServiceOfferTerms(id, 1, _personalTerms(), PRICE + 1);
        _recordDeposit(fundingId, PRICE);
        vm.prank(BUYER_STEWARD);
        uint256 refund = settlement.queueFundingRefund(fundingId);
        assertEq(settlement.getDisbursement(refund).amount, PRICE);
        assertEq(settlement.getDisbursement(refund).recipient, REFUND_ACCOUNT);
    }

    function testIntegration_PersonalServicePurchase_acceptanceAloneCannotPayOrRefundExactBooking() public {
        uint256 id = _personalOffer(keccak256("accept-before-consume"));
        _request(id, 1);
        uint256 fundingId = _pledge(id);
        _recordDeposit(fundingId, PRICE);
        _accept(id);
        vm.expectRevert(abi.encodeWithSelector(Settlement.FundingRefundNotEligible.selector, fundingId));
        vm.prank(BUYER_STEWARD);
        settlement.queueFundingRefund(fundingId);
        _fulfill(id, false);
        (Settlement.RecognitionEntry[] memory entries, bytes32 hash) = _recognition(id);
        vm.expectRevert(abi.encodeWithSelector(Personal.PersonalServiceFundingRequired.selector, id));
        vm.prank(BUYER_STEWARD);
        settlement.createCommitmentPayoutPlan(id, entries, hash);
        _consume(fundingId);
        _plan(id);
    }

    function testIntegration_PersonalServicePurchase_delayedReadyConsumptionKeepsExactConsent() public {
        uint256 id = _personalOffer(keccak256("ready-before-consume"));
        _request(id, 1);
        uint256 fundingId = _pledge(id);
        _recordDeposit(fundingId, PRICE);
        _accept(id);
        _ready(id, false);
        _consume(fundingId);
        assertEq(uint256(settlement.getCommitmentFunding(fundingId).state), uint256(Settlement.FundingState.Consumed));
    }

    function testIntegration_PersonalServicePurchase_changedRefundRouteRollsBackAndRepairs() public {
        uint256 id = _personalOffer(keccak256("refund-route-race"));
        bytes32 claimHash = _request(id, 1);
        uint256 fundingId = _pledge(id);
        _recordDeposit(fundingId, PRICE);
        vm.prank(BUYER);
        services.withdrawServiceClaim(id, claimHash);
        PersonalServiceSettlementHarness harness = PersonalServiceSettlementHarness(payable(address(settlement)));
        for (uint256 i; i < 2; ++i) {
            if (i == 0) harness.replaceAccountForTest(BUYER_GARDEN, address(protocolSafe));
            else harness.replaceTokenForTest(address(0xBAD));
            vm.expectRevert(abi.encodeWithSelector(Personal.PersonalServiceReceiptMismatch.selector, fundingId));
            vm.prank(BUYER_STEWARD);
            settlement.queueFundingRefund(fundingId);
            assertEq(settlement.fundingRefundDisbursementOf(fundingId), 0);
            assertEq(
                uint256(personal.getPersonalServicePurchase(fundingId).outcome),
                uint256(Personal.PersonalPurchaseOutcome.None)
            );
            harness.replaceAccountForTest(BUYER_GARDEN, address(buyerSafe));
            harness.replaceTokenForTest(address(token));
        }
        vm.prank(BUYER_STEWARD);
        uint256 refund = settlement.queueFundingRefund(fundingId);
        assertEq(settlement.getDisbursement(refund).source, address(buyerSafe));
    }
}
