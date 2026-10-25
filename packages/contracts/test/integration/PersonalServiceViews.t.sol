// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ISettlementModule as Settlement } from "../../src/interfaces/ISettlementModule.sol";
import {
    ISettlementPersonalServicePurchases as Personal
} from "../../src/interfaces/ISettlementPersonalServicePurchases.sol";
import { SettlementFundingLib } from "../../src/lib/Settlement/FundingLib.sol";
import {
    PersonalServicePurchaseFixture,
    PersonalServiceSettlementHarness
} from "../helpers/PersonalServicePurchaseFixture.sol";

contract PersonalServiceViewIntegrationTest is PersonalServicePurchaseFixture {
    function setUp() public {
        _setUpPersonalFixture();
    }

    function testIntegration_PersonalServiceViews_exactAbiForAllForwardedStructsAndDynamicFields() public {
        uint256 id = _personalOffer(keccak256("forwarded-view-tuples"));
        uint256 fundingId = _funded(id, PRICE + 10 ether);
        _fulfill(id, true);
        uint256 planId = _plan(id);
        Settlement.ContributorPayoutInput[] memory payouts = new Settlement.ContributorPayoutInput[](2);
        payouts[0] = Settlement.ContributorPayoutInput(CREATOR, PRICE / 2 + 1);
        payouts[1] = Settlement.ContributorPayoutInput(SECOND_PROVIDER, PRICE / 2);
        string memory reason = "fictional-long-reason-for-ABI-proof-across-storage-words-and-dynamic-return-offsets";
        vm.startPrank(BUYER_STEWARD);
        settlement.setContributorPayouts(planId, 0, payouts, reason);
        settlement.finalizeCommitmentPayoutPlan(planId);
        uint256 first = settlement.prepareContributorPayout(planId, CREATOR);
        uint256 second = settlement.prepareContributorPayout(planId, SECOND_PROVIDER);
        uint256[] memory children = new uint256[](2);
        children[0] = first;
        children[1] = second;
        uint256 batchId = settlement.createBatch(children);
        vm.stopPrank();
        PersonalServiceSettlementHarness harness = PersonalServiceSettlementHarness(payable(address(settlement)));
        harness.setViewReasonForTest(first, reason);
        _assertRawView(abi.encodeCall(Settlement.getPayoutPlan, (planId)), abi.encode(harness.referencePlanForTest(planId)));
        _assertRawView(
            abi.encodeCall(Settlement.getDisbursement, (first)), abi.encode(harness.referenceDisbursementForTest(first))
        );
        _assertRawView(abi.encodeCall(Settlement.getBatch, (batchId)), abi.encode(harness.referenceBatchForTest(batchId)));
        _assertRawView(
            abi.encodeCall(Personal.getPersonalServicePurchase, (fundingId)),
            abi.encode(harness.referencePurchaseForTest(fundingId))
        );
        assertEq(settlement.getPayoutPlan(planId).latestEditReasonCID, reason);
        assertEq(settlement.getPayoutPlan(planId).contributorOrder.length, 2);
        assertEq(settlement.getDisbursement(first).reasonCID, reason);
        assertEq(settlement.getBatch(batchId).disbursementIds[1], second);
        assertEq(personal.getPersonalServicePurchase(fundingId).deposit.receivedAmount, PRICE + 10 ether);
    }

    function testIntegration_PersonalServiceViews_unknownIdsForwardExactRevertData() public {
        uint256 id = 99_999;
        _assertRevertingView(
            abi.encodeCall(Settlement.getPayoutPlan, (id)),
            abi.encodeWithSelector(Settlement.UnknownPayoutPlan.selector, id)
        );
        _assertRevertingView(
            abi.encodeCall(Settlement.getDisbursement, (id)),
            abi.encodeWithSelector(Settlement.UnknownDisbursement.selector, id)
        );
        _assertRevertingView(
            abi.encodeCall(Settlement.getBatch, (id)), abi.encodeWithSelector(Settlement.UnknownBatch.selector, id)
        );
        _assertRevertingView(
            abi.encodeCall(Personal.getPersonalServicePurchase, (id)),
            abi.encodeWithSelector(Personal.UnknownPersonalServicePurchase.selector, id)
        );
    }

    function testIntegration_PersonalServiceViews_delegateIsSelfOnlyAndRejectsUnknownOrMutationSelectors() public {
        bytes memory callData = abi.encodeWithSignature("settlementViewDelegate(bytes)", bytes(""));
        vm.prank(BUYER);
        (bool ok, bytes memory result) = address(settlement).call(callData);
        assertFalse(ok);
        assertEq(result, abi.encodeWithSelector(Settlement.UnauthorizedCaller.selector, BUYER));
        _assertUnsupported(bytes(""));
        _assertUnsupported(hex"123456");
        _assertUnsupported(hex"12345678");
        _assertUnsupported(abi.encodeWithSelector(SettlementFundingLib.recordPersonalServiceDeposit.selector, 1));
        assertEq(personal.fundingOfPersonalServicePurchase(bytes32(uint256(1))), 0);
    }

    function _assertUnsupported(bytes memory data) private {
        vm.prank(address(settlement));
        (bool ok, bytes memory result) =
            address(settlement).call(abi.encodeWithSignature("settlementViewDelegate(bytes)", data));
        assertFalse(ok);
        assertEq(result, abi.encodeWithSignature("UnsupportedSettlementView()"));
    }

    function _assertRawView(bytes memory data, bytes memory expected) private {
        (bool ok, bytes memory result) = address(settlement).staticcall(data);
        assertTrue(ok);
        assertEq(result, expected);
    }

    function _assertRevertingView(bytes memory data, bytes memory expected) private {
        (bool ok, bytes memory result) = address(settlement).staticcall(data);
        assertFalse(ok);
        assertEq(result, expected);
    }
}
