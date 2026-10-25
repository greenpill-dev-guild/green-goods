// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule as Core } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ISettlementModule as Settlement } from "../../src/interfaces/ISettlementModule.sol";
import {
    ISettlementPersonalServicePurchases as Personal
} from "../../src/interfaces/ISettlementPersonalServicePurchases.sol";
import { PersonalServicePurchaseFixture } from "../helpers/PersonalServicePurchaseFixture.sol";

/// @notice Fault injection models missing upgrade bookkeeping; valid business flows never expose these writes.
contract PersonalServiceGuardsIntegrationTest is PersonalServicePurchaseFixture {
    bytes32 private constant FUNDING_NAMESPACE = 0x14790e171eb52cfebe9fb0c814ca455ea33a3bcc183d5784757d5df85dd1e400;

    function setUp() public {
        _setUpPersonalFixture();
    }

    function testIntegration_PersonalServiceGuards_allPlanAndPreparationPathsRejectMissingConsumption() public {
        (uint256 id, uint256 fundingId, uint256 planId, uint256 child) = _planned(keccak256("all-plan-guards"));
        bytes32 slot = _eraseConsumed(id, fundingId);
        bytes memory expected = abi.encodeWithSelector(Personal.PersonalServiceFundingRequired.selector, id);
        vm.startPrank(BUYER_STEWARD);
        vm.expectRevert(expected);
        settlement.setContributorPayouts(planId, 0, new Settlement.ContributorPayoutInput[](0), "cannot bypass funding");
        vm.expectRevert(expected);
        settlement.finalizeCommitmentPayoutPlan(planId);
        vm.expectRevert(expected);
        settlement.prepareContributorPayout(planId, CREATOR);
        vm.expectRevert(expected);
        settlement.prepareGardenBeneficiaryPayout(planId);
        uint256[] memory ids = new uint256[](1);
        ids[0] = child;
        vm.expectRevert(expected);
        settlement.createBatch(ids);
        vm.expectRevert(expected);
        settlement.dispatchDisbursement(child);
        vm.stopPrank();
        assertEq(uint256(settlement.getDisbursement(child).state), uint256(Settlement.DisbursementState.Queued));
        vm.store(address(settlement), slot, bytes32(fundingId));
    }

    function testIntegration_PersonalServiceGuards_singleRetryCannotBypassMissingConsumption() public {
        (uint256 id, uint256 fundingId,, uint256 child) = _planned(keccak256("single-retry-guard"));
        vm.prank(BUYER_STEWARD);
        settlement.dispatchDisbursement(child);
        bytes32 key = settlement.getDisbursement(child).executionKey;
        _eraseConsumed(id, fundingId);
        vm.expectRevert(abi.encodeWithSelector(Personal.PersonalServiceFundingRequired.selector, id));
        vm.prank(BUYER_STEWARD);
        settlement.retryCommand(child);
        vm.expectRevert(abi.encodeWithSelector(Personal.PersonalServiceUnsafeRecovery.selector, child));
        vm.prank(BUYER_STEWARD);
        settlement.cancelDisbursement(child, "missing bookkeeping is not refund authority");
        assertEq(settlement.getDisbursement(child).executionKey, key);
    }

    function testIntegration_PersonalServiceGuards_batchDispatchAndRetryBothRecheckConsumption() public {
        (uint256 id, uint256 fundingId,, uint256 child) = _planned(keccak256("batch-retry-guard"));
        uint256[] memory ids = new uint256[](1);
        ids[0] = child;
        vm.prank(BUYER_STEWARD);
        uint256 batchId = settlement.createBatch(ids);
        bytes32 slot = _eraseConsumed(id, fundingId);
        vm.expectRevert(abi.encodeWithSelector(Personal.PersonalServiceFundingRequired.selector, id));
        vm.prank(BUYER_STEWARD);
        settlement.dispatchBatch(batchId);
        vm.store(address(settlement), slot, bytes32(fundingId));
        vm.prank(BUYER_STEWARD);
        settlement.dispatchBatch(batchId);
        _eraseConsumed(id, fundingId);
        vm.expectRevert(abi.encodeWithSelector(Personal.PersonalServiceFundingRequired.selector, id));
        vm.prank(BUYER_STEWARD);
        settlement.retryBatchCommand(batchId);
        assertEq(uint256(settlement.getBatch(batchId).state), uint256(Settlement.DisbursementState.Dispatched));
    }

    function testIntegration_PersonalServiceGuards_mixedBatchCannotCancelOrReplaceUnknownPersonalValue() public {
        (uint256 id, uint256 fundingId,, uint256 personalChild) = _planned(keccak256("mixed-batch"));
        uint256 legacyChild = _legacyChild();
        uint256[] memory ids = new uint256[](2);
        ids[0] = legacyChild;
        ids[1] = personalChild;
        vm.prank(BUYER_STEWARD);
        uint256 batchId = settlement.createBatch(ids);
        vm.expectRevert(abi.encodeWithSelector(Personal.PersonalServiceUnsafeRecovery.selector, personalChild));
        vm.prank(BUYER_STEWARD);
        settlement.cancelBatch(batchId, "legacy first row must not hide personal authority");
        vm.prank(BUYER_STEWARD);
        settlement.dispatchBatch(batchId);
        settlement.setPaused(true);
        settlement.setCcipRoute(CELO_SELECTOR, address(0x8001), 1_000_000, 1, 1 days);
        settlement.setPaused(false);
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(abi.encodeWithSelector(Personal.PersonalServiceUnsafeRecovery.selector, personalChild));
        settlement.failStrandedSubject(true, batchId);
        vm.expectRevert(abi.encodeWithSelector(Personal.PersonalServiceUnsafeRecovery.selector, personalChild));
        vm.prank(BUYER_STEWARD);
        settlement.requeue(personalChild);
        assertEq(uint256(settlement.getBatch(batchId).state), uint256(Settlement.DisbursementState.Dispatched));
        assertEq(uint256(settlement.getCommitmentFunding(fundingId).state), uint256(Settlement.FundingState.Consumed));
        assertEq(module.getCommitment(id).payerGarden, BUYER_GARDEN);
    }

    function _planned(bytes32 key) private returns (uint256 id, uint256 fundingId, uint256 planId, uint256 child) {
        id = _personalOffer(key);
        fundingId = _funded(id, PRICE);
        _fulfill(id, false);
        (planId, child) = _prepare(id);
    }

    function _eraseConsumed(uint256 id, uint256 fundingId) private returns (bytes32 slot) {
        slot = keccak256(abi.encode(id, uint256(FUNDING_NAMESPACE) + 5));
        assertEq(vm.load(address(settlement), slot), bytes32(fundingId), "frozen namespace index changed");
        vm.store(address(settlement), slot, bytes32(0));
    }

    function _legacyChild() private returns (uint256 child) {
        (uint256 buyerPool,) = module.getPoolByGarden(BUYER_GARDEN);
        module.setProviderOpenCommitmentCap(buyerPool, 128);
        module.setPoolCharter(buyerPool, "fictional-legacy-charter");
        module.markPoolReady(buyerPool);
        module.openPool(buyerPool);
        address provider = address(0xBC01);
        address buyer = address(0xBC02);
        hats.setGardener(BUYER_GARDEN, provider, true);
        hats.setGardener(BUYER_GARDEN, buyer, true);
        Core.CreateCommitmentParams memory params = _baseParams(keccak256("unchanged-legacy-payout"));
        params.poolId = buyerPool;
        params.claimMode = Core.ClaimMode.ApprovalGated;
        params.consideration =
            Core.DeclaredConsideration(Core.ConsiderationRail.CeloSettlement, address(0), address(0), PRICE);
        vm.prank(provider);
        uint256 id = module.createCommitment(params);
        vm.prank(buyer);
        module.claimCommitment(id, Core.ClaimType.Individual, BUYER_GARDEN);
        vm.prank(BUYER_STEWARD);
        module.acceptClaim(id, buyer);
        address[] memory credited = new address[](1);
        credited[0] = provider;
        vm.prank(provider);
        module.attachEvidence(id, "fictional-legacy-evidence", credited);
        module.markReadyForConfirmation(id, "fictional-legacy-ready");
        vm.prank(buyer);
        module.confirmFulfillment(id);
        Settlement.RecognitionEntry[] memory entries = new Settlement.RecognitionEntry[](1);
        entries[0] = Settlement.RecognitionEntry(provider, 10_000);
        bytes32 hash = keccak256(abi.encode(block.chainid, id, entries));
        vm.startPrank(BUYER_STEWARD);
        uint256 planId = settlement.createCommitmentPayoutPlan(id, entries, hash);
        settlement.finalizeCommitmentPayoutPlan(planId);
        child = settlement.prepareContributorPayout(planId, provider);
        vm.stopPrank();
    }
}
