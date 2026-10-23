// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { VoucherServiceCodec as Codec } from "../../src/libraries/VoucherServiceCodec.sol";
import { VoucherRedemptionTransfers as Transfers } from "../../src/libraries/VoucherRedemptionTransfers.sol";
import { VoucherRedemptionReceiver } from "../../src/modules/VoucherRedemptionReceiver.sol";
import { VoucherEndpoint } from "../../src/modules/VoucherEndpoint.sol";
import { GnosisVoucherEscrow } from "../../src/modules/GnosisVoucherEscrow.sol";
import { VoucherServiceDestinationFixture } from "../helpers/VoucherServiceDestinationFixture.sol";

/// @notice Fictional local destination fixtures. Source/core guards and actual GiftableToken have separate proofs.
contract VoucherRedemptionTest is VoucherServiceDestinationFixture {
    function setUp() public {
        _setUpDestination();
    }

    function testGnosisVoucherEscrow_holderPresentmentMovesExactlyBoundVoucherInventory() public {
        _deposit();
        assertEq(token.balanceOf(address(escrow)), 100);
        assertEq(token.balanceOf(HOLDER), 0);
        assertEq(escrow.getSetupResult(id).depositedUnits, 100);
        assertEq(escrow.getSetupResult(id).depositReceiptHash, Codec.depositReceiptHash(_authorization()));
        assertEq(uint8(escrow.getSetupResult(id).phase), uint8(Codec.SetupPhase.Deposited));
        assertEq(escrow.getFinalAllocation(id).allocation.approvedDeliveredServiceUnits, 0);
        assertEq(escrow.unspentVoucherLiability(address(token)), 100);
    }

    function testVoucherRedemption_separatesServiceQuantityFromFinalVoucherAllocation() public {
        bytes32 decision = _partial();
        assertEq(token.balanceOf(address(escrow)), 100, "freezing cannot transfer vouchers");
        _executeBoth(decision, false);
        assertEq(escrow.getFinalAllocation(id).allocation.approvedDeliveredServiceUnits, 3);
        assertEq(token.balanceOf(ISSUER), 40);
        assertEq(token.balanceOf(HOLDER), 60);
        assertEq(token.totalSupply(), 100);
        assertTrue(escrow.isFinanciallyClosed(id));
        assertEq(escrow.unspentVoucherLiability(address(token)), 0);
    }

    function testGnosisVoucherEscrow_issuerAndAssetApprovalCannotBeReplacedByGardenAuthority() public {
        _deliver(Codec.encodeAuthorization(_authorization()));
        vm.expectRevert(GnosisVoucherEscrow.IssuerOnly.selector);
        vm.prank(COMMUNITY);
        escrow.approveSetupAuthorization(id, payloadHash);
        vm.expectRevert(VoucherRedemptionReceiver.IssuerApprovalRequired.selector);
        vm.prank(HOLDER);
        escrow.presentSetup(id, payloadHash);
        token.rotateOwnerFixture(COMMUNITY);
        vm.expectRevert(Transfers.WrongVoucherIssuer.selector);
        vm.prank(ISSUER);
        escrow.approveSetupAuthorization(id, payloadHash);
    }

    function testGnosisVoucherEscrow_ownerRotationBeforePresentmentRejectsAndAfterwardCannotStrandTokens() public {
        _open();
        token.rotateOwnerFixture(COMMUNITY);
        vm.prank(HOLDER);
        escrow.presentSetup(id, payloadHash);
        assertFalse(escrow.getSetupResult(id).actionSucceeded);
        assertEq(token.balanceOf(HOLDER), 100);
        token.rotateOwnerFixture(ISSUER);
        escrow.retrySetupAction(id);
        _activate();
        token.rotateOwnerFixture(COMMUNITY);
        _allowReturn(60);
        bytes32 decision = _freeze(3, 40, 60);
        _executeBoth(decision, true);
        assertEq(token.balanceOf(ISSUER), 40);
        assertEq(token.balanceOf(HOLDER), 60);
    }

    function testGnosisVoucherEscrow_sourceBuyerCannotSignForDistinctGnosisHolder() public {
        _open();
        vm.expectRevert(VoucherRedemptionReceiver.HolderOnly.selector);
        vm.prank(BUYER);
        escrow.presentSetup(id, payloadHash);
        vm.prank(HOLDER);
        escrow.presentSetup(id, payloadHash);
        _activate();
        vm.expectRevert(VoucherRedemptionReceiver.HolderOnly.selector);
        vm.prank(BUYER);
        escrow.finalizeAllocation(id, payloadHash, Codec.FinalAllocation(10, 100, 0));
        vm.expectRevert(VoucherRedemptionReceiver.WrongRedemptionPayload.selector);
        vm.prank(HOLDER);
        escrow.finalizeAllocation(id, bytes32(uint256(1)), Codec.FinalAllocation(10, 100, 0));
    }

    function testGnosisVoucherEscrow_mutualReturnPermissionDoesNotReserveOrForceUnits() public {
        _active();
        vm.expectRevert(GnosisVoucherEscrow.InvalidRedemptionQuantity.selector);
        _freeze(0, 0, 100);
        _allowReturn(100);
        assertEq(token.balanceOf(address(escrow)), 100);
        assertEq(escrow.getFinalAllocation(id).decisionId, bytes32(0));
        bytes32 decision = _freeze(3, 40, 60);
        _executeBoth(decision, false);
        assertEq(token.balanceOf(HOLDER), 60);
    }

    function testGnosisVoucherEscrow_timeoutNeverApprovesDeliveryOrReturnsDepositedVouchers() public {
        _deposit();
        vm.warp(block.timestamp + 365 days);
        assertEq(escrow.getSetupResult(id).setupRefundedUnits, 0);
        vm.expectRevert(GnosisVoucherEscrow.SetupNotActive.selector);
        _freeze(10, 100, 0);
        assertEq(token.balanceOf(address(escrow)), 100);
    }

    function testGnosisVoucherEscrow_failedAllowancePresentmentRepairsSameImmutableAction() public {
        _open();
        vm.prank(HOLDER);
        token.approve(address(escrow), 99);
        vm.prank(HOLDER);
        escrow.presentSetup(id, payloadHash);
        assertFalse(escrow.getSetupResult(id).actionSucceeded);
        vm.expectRevert(GnosisVoucherEscrow.PendingRedemptionAction.selector);
        vm.prank(HOLDER);
        escrow.presentSetup(id, payloadHash);
        vm.prank(HOLDER);
        token.approve(address(escrow), 100);
        escrow.retrySetupAction(id);
        assertEq(escrow.getSetupResult(id).authorizationHash, payloadHash);
        assertEq(token.allowance(HOLDER, address(escrow)), 0);
        vm.expectRevert(GnosisVoucherEscrow.NoRetryableAction.selector);
        escrow.retrySetupAction(id);
    }

    function testGnosisVoucherEscrow_unlimitedAllowanceIsStoredRecoverableFailure() public {
        _open();
        vm.prank(HOLDER);
        token.approve(address(escrow), type(uint256).max);
        vm.prank(HOLDER);
        escrow.presentSetup(id, payloadHash);
        assertEq(
            escrow.getSetupExecution(id).failureReason, abi.encodeWithSelector(Transfers.UnlimitedVoucherAllowance.selector)
        );
        vm.prank(HOLDER);
        token.approve(address(escrow), 100);
        vm.prank(COMMUNITY);
        escrow.retrySetupAction(id);
        assertEq(escrow.getSetupResult(id).depositedUnits, 100);
    }

    function testGnosisVoucherEscrow_inexactPresentmentRollsBackTokensAllowanceAndLiability() public {
        _open();
        token.configureFailure(address(0), 1, false);
        vm.prank(HOLDER);
        escrow.presentSetup(id, payloadHash);
        assertFalse(escrow.getSetupResult(id).actionSucceeded);
        assertEq(token.balanceOf(HOLDER), 100);
        assertEq(token.balanceOf(address(escrow)), 0);
        assertEq(token.allowance(HOLDER, address(escrow)), 100);
        assertEq(escrow.unspentVoucherLiability(address(token)), 0);
        token.configureFailure(address(0), 0, false);
        escrow.retrySetupAction(id);
        assertEq(escrow.unspentVoucherLiability(address(token)), 100);
    }

    function testGnosisVoucherEscrow_skippedFiniteAllowanceDebitCannotExpandCustodyAuthorization() public {
        _open();
        token.configureAllowanceDebit(true);
        vm.prank(HOLDER);
        escrow.presentSetup(id, payloadHash);
        assertFalse(escrow.getSetupResult(id).actionSucceeded);
        assertEq(token.balanceOf(HOLDER), 100);
        token.configureAllowanceDebit(false);
        escrow.retrySetupAction(id);
        assertEq(token.balanceOf(address(escrow)), 100);
    }

    function testGnosisVoucherEscrow_releaseFailureDoesNotBlockRefundOrChangeFrozenDecision() public {
        bytes32 decision = _partial();
        token.configureFailure(ISSUER, 0, false);
        escrow.executeFinalLeg(id, decision, Codec.FinalLeg.ReleaseToIssuer);
        assertEq(uint8(escrow.getFinalAllocation(id).release.state), uint8(Codec.LegState.Failed));
        escrow.executeFinalLeg(id, decision, Codec.FinalLeg.RefundToHolder);
        assertEq(token.balanceOf(HOLDER), 60);
        assertFalse(escrow.isFinanciallyClosed(id));
        token.configureFailure(address(0), 0, false);
        escrow.executeFinalLeg(id, decision, Codec.FinalLeg.ReleaseToIssuer);
        assertTrue(escrow.isFinanciallyClosed(id));
        assertEq(token.balanceOf(ISSUER), 40);
    }

    function testGnosisVoucherEscrow_refundFailureDoesNotUndoReleaseAndRetriesExactlyOnce() public {
        bytes32 decision = _partial();
        token.configureFailure(HOLDER, 0, false);
        _executeBoth(decision, false);
        assertEq(token.balanceOf(ISSUER), 40);
        assertEq(token.balanceOf(address(escrow)), 60);
        token.configureFailure(address(0), 0, false);
        escrow.executeFinalLeg(id, decision, Codec.FinalLeg.RefundToHolder);
        _executeBoth(decision, true);
        assertEq(token.balanceOf(HOLDER), 60);
        assertEq(token.balanceOf(ISSUER), 40);
        assertEq(escrow.getFinalAllocation(id).refund.attempts, 2);
        assertEq(escrow.getFinalAllocation(id).release.attempts, 1);
    }

    function testGnosisVoucherEscrow_partialTransferFailureRollsBackOnlyFailingLeg() public {
        bytes32 decision = _partial();
        escrow.executeFinalLeg(id, decision, Codec.FinalLeg.ReleaseToIssuer);
        token.configureFailure(address(0), 1, false);
        escrow.executeFinalLeg(id, decision, Codec.FinalLeg.RefundToHolder);
        assertEq(token.balanceOf(ISSUER), 40);
        assertEq(token.balanceOf(HOLDER), 0);
        assertEq(token.balanceOf(address(escrow)), 60);
        assertEq(escrow.unspentVoucherLiability(address(token)), 60);
        token.configureFailure(address(0), 0, false);
        escrow.executeFinalLeg(id, decision, Codec.FinalLeg.RefundToHolder);
        assertEq(token.balanceOf(HOLDER), 60);
    }

    function testGnosisVoucherEscrow_conflictingFinalDecisionAlwaysRejectsBeforeAndAfterLeg() public {
        bytes32 decision = _partial();
        vm.expectRevert(GnosisVoucherEscrow.ConflictingFinalAllocation.selector);
        _freeze(4, 40, 60);
        escrow.executeFinalLeg(id, decision, Codec.FinalLeg.RefundToHolder);
        vm.expectRevert(GnosisVoucherEscrow.ConflictingFinalAllocation.selector);
        _freeze(3, 50, 50);
        assertEq(escrow.getFinalAllocation(id).decisionId, decision);
    }

    function testGnosisVoucherEscrow_exactFreezeRepeatSurvivesLaterRemedyCeilingChange() public {
        bytes32 decision = _partial();
        uint64 sequence = escrow.getFinalResult(id).sequence;
        _allowReturn(100);
        assertEq(_freeze(3, 40, 60), decision);
        assertEq(escrow.getFinalAllocation(id).issuerReturnApprovalAtFreeze, 60);
        assertEq(escrow.getFinalResult(id).sequence, sequence);
        assertEq(token.balanceOf(address(escrow)), 100);
    }

    function testGnosisVoucherEscrow_rejectsBadConservationOverapprovalAndUnapprovedRelease() public {
        _active();
        _allowReturn(100);
        vm.expectRevert(GnosisVoucherEscrow.InvalidRedemptionQuantity.selector);
        _freeze(3, 40, 59);
        vm.expectRevert(GnosisVoucherEscrow.InvalidRedemptionQuantity.selector);
        _freeze(11, 40, 60);
        vm.expectRevert(GnosisVoucherEscrow.InvalidRedemptionQuantity.selector);
        _freeze(0, 40, 60);
        vm.expectRevert(GnosisVoucherEscrow.InvalidRedemptionQuantity.selector);
        _freeze(10, type(uint256).max, 0);
    }

    function testGnosisVoucherEscrow_fullReleaseZeroRefundRequiresNoRefundTransfer() public {
        _active();
        bytes32 decision = _freeze(10, 100, 0);
        _executeBoth(decision, true);
        assertEq(uint8(escrow.getFinalAllocation(id).refund.state), uint8(Codec.LegState.NotRequired));
        assertEq(escrow.getFinalAllocation(id).refund.attempts, 0);
        assertEq(token.balanceOf(ISSUER), 100);
    }

    function testGnosisVoucherEscrow_fullFinancialReturnDoesNotInventServiceNonDelivery() public {
        _active();
        _allowReturn(100);
        bytes32 decision = _freeze(0, 0, 100);
        _executeBoth(decision, false);
        assertEq(uint8(escrow.getFinalAllocation(id).release.state), uint8(Codec.LegState.NotRequired));
        assertEq(token.balanceOf(HOLDER), 100);
        assertEq(token.totalSupply(), 100);
        assertTrue(escrow.isFinanciallyClosed(id));
    }

    function testGnosisVoucherEscrow_duplicateTransportCannotRepeatCustodyOrSpendAckReserve() public {
        _deposit();
        uint256 sends = router.nonce();
        _deliver(Codec.encodeAuthorization(_authorization()));
        assertEq(router.nonce(), sends);
        assertEq(token.balanceOf(address(escrow)), 100);
        Codec.SetupAuthorization memory changed = _authorization();
        changed.voucherUnits = 99;
        vm.expectRevert(VoucherRedemptionReceiver.ConflictingRedemptionPayload.selector);
        _deliver(Codec.encodeAuthorization(changed));
    }

    function testGnosisVoucherEscrow_transportIdCannotBeReusedForDifferentSetup() public {
        bytes32 messageId = keccak256("fixed transport id");
        router.deliver(address(escrow), _message(Codec.encodeAuthorization(_authorization()), messageId));
        Codec.SetupAuthorization memory changed = _authorization();
        ++changed.commitmentId;
        vm.expectRevert(VoucherRedemptionReceiver.ConflictingRedemptionPayload.selector);
        router.deliver(address(escrow), _message(Codec.encodeAuthorization(changed), messageId));
    }

    function testGnosisVoucherEscrow_rejectsWrongPeerChainAttachedTokensAndTrailingBytes() public {
        Client.Any2EVMMessage memory m = _message(Codec.encodeAuthorization(_authorization()), keccak256("bad"));
        m.sender = abi.encode(COMMUNITY);
        vm.expectRevert(VoucherEndpoint.InvalidVoucherPeer.selector);
        router.deliver(address(escrow), m);
        m.sender = abi.encode(SOURCE);
        ++m.sourceChainSelector;
        vm.expectRevert(VoucherEndpoint.InvalidVoucherPeer.selector);
        router.deliver(address(escrow), m);
        m.sourceChainSelector = SOURCE_SELECTOR;
        m.destTokenAmounts = new Client.EVMTokenAmount[](1);
        m.destTokenAmounts[0] = Client.EVMTokenAmount(address(token), 1);
        vm.expectRevert(VoucherEndpoint.AttachedTokensForbidden.selector);
        router.deliver(address(escrow), m);
        m.destTokenAmounts = new Client.EVMTokenAmount[](0);
        m.data = bytes.concat(m.data, bytes32(uint256(1)));
        vm.expectRevert(Codec.UnsupportedVoucherServiceMessage.selector);
        router.deliver(address(escrow), m);
    }

    function testGnosisVoucherEscrow_rejectsWrongPayloadDestinationTokenAndRemedy() public {
        Codec.SetupAuthorization memory a = _authorization();
        a.destinationChainId = 42_220;
        _invalid(a);
        a = _authorization();
        a.destinationEscrow = COMMUNITY;
        _invalid(a);
        a = _authorization();
        a.token = COMMUNITY;
        _invalid(a);
        a = _authorization();
        a.remedyPolicy = 2;
        _invalid(a);
        a = _authorization();
        a.requestNonce = 0;
        _invalid(a);
    }

    function _invalid(Codec.SetupAuthorization memory a) private {
        vm.expectRevert(VoucherRedemptionReceiver.InvalidRedemptionAuthorization.selector);
        _deliver(Codec.encodeAuthorization(a));
    }

    function testGnosisVoucherEscrow_lostAcknowledgmentsNeverRepeatSuccessfulTransfers() public {
        router.configure(0, true, false);
        bytes32 decision = _partial();
        _executeBoth(decision, false);
        assertTrue(escrow.isFinanciallyClosed(id));
        assertTrue(escrow.getSetupExecution(id).finalAcknowledgment.failureHash != bytes32(0));
        uint64 sequence = escrow.getFinalResult(id).sequence;
        router.configure(5, false, false);
        vm.deal(address(this), 10);
        escrow.retryFinalAcknowledgment{ value: 5 }(id);
        _executeBoth(decision, true);
        assertEq(escrow.getFinalResult(id).sequence, sequence);
        assertEq(token.balanceOf(ISSUER), 40);
        assertEq(escrow.getSetupExecution(id).finalAcknowledgment.sequence, sequence);
    }

    function testGnosisVoucherEscrow_failedPaidAckRefundsFeeAndPreservesEconomicResult() public {
        bytes32 decision = _partial();
        _executeBoth(decision, false);
        router.configure(5, false, true);
        vm.deal(address(this), 10);
        vm.expectRevert();
        escrow.retryFinalAcknowledgment{ value: 5 }(id);
        assertEq(address(this).balance, 10);
        assertEq(address(escrow).balance, 0);
        assertTrue(escrow.isFinanciallyClosed(id));
        router.configure(5, false, false);
        escrow.retryFinalAcknowledgment{ value: 5 }(id);
        assertEq(address(this).balance, 5);
    }

    function testGnosisVoucherEscrow_setupAndFinalAckLanesRemainIndependent() public {
        bytes32 decision = _partial();
        escrow.executeFinalLeg(id, decision, Codec.FinalLeg.RefundToHolder);
        uint64 finalSequence = escrow.getFinalResult(id).sequence;
        escrow.retrySetupAcknowledgment(id);
        assertEq(uint8(Codec.decodeSetupResult(router.lastData()).phase), uint8(Codec.SetupPhase.Active));
        escrow.retryFinalAcknowledgment(id);
        assertEq(Codec.decodeFinalResult(router.lastData()).sequence, finalSequence);
        assertEq(token.balanceOf(HOLDER), 60);
    }

    function testGnosisVoucherEscrow_pauseStoresRecoverableActionGuardianCannotResumeOrExecute() public {
        _open();
        vm.prank(GUARDIAN);
        escrow.pause();
        vm.prank(HOLDER);
        escrow.presentSetup(id, payloadHash);
        assertFalse(escrow.getSetupResult(id).actionSucceeded);
        vm.expectRevert("Ownable: caller is not the owner");
        vm.prank(GUARDIAN);
        escrow.unpause();
        vm.expectRevert(VoucherRedemptionReceiver.SelfOnly.selector);
        escrow.executeSetupAction(id);
        vm.prank(COMMUNITY);
        escrow.unpause();
        escrow.retrySetupAction(id);
        assertEq(token.balanceOf(address(escrow)), 100);
    }

    function testGnosisVoucherEscrow_pauseBetweenLegsPreservesCompletedLegAndFixedRetry() public {
        bytes32 decision = _partial();
        escrow.executeFinalLeg(id, decision, Codec.FinalLeg.ReleaseToIssuer);
        vm.prank(GUARDIAN);
        escrow.pause();
        escrow.executeFinalLeg(id, decision, Codec.FinalLeg.RefundToHolder);
        assertEq(uint8(escrow.getFinalAllocation(id).refund.state), uint8(Codec.LegState.Failed));
        assertEq(token.balanceOf(ISSUER), 40);
        escrow.retryFinalAcknowledgment(id);
        vm.prank(COMMUNITY);
        escrow.unpause();
        escrow.executeFinalLeg(id, decision, Codec.FinalLeg.RefundToHolder);
        assertTrue(escrow.isFinanciallyClosed(id));
    }

    function testGnosisVoucherEscrow_reentrantTokenCannotAddApprovalsOrRepeatCustody() public {
        _open();
        token.configureReentry(address(escrow), abi.encodeCall(escrow.presentSetup, (id, payloadHash)));
        vm.prank(HOLDER);
        escrow.presentSetup(id, payloadHash);
        assertFalse(token.reentrySucceeded());
        assertEq(token.balanceOf(address(escrow)), 100);
    }

    function testGnosisVoucherEscrow_upgradeRequiresPausedOwnerWithoutWaitingAndPreservesV2Ledger() public {
        bytes32 decision = _partial();
        address next = address(new GnosisVoucherEscrow(address(router)));
        vm.prank(COMMUNITY);
        escrow.scheduleUpgrade(next);
        vm.expectRevert(VoucherEndpoint.UpgradeNotReady.selector);
        vm.prank(COMMUNITY);
        escrow.upgradeTo(next);
        vm.prank(GUARDIAN);
        escrow.pause();
        uint256 scheduledAt = block.timestamp;
        vm.prank(COMMUNITY);
        escrow.upgradeTo(next);
        assertEq(block.timestamp, scheduledAt);
        assertEq(escrow.UPGRADE_DELAY(), 0);
        assertEq(escrow.owner(), COMMUNITY);
        assertEq(escrow.guardian(), GUARDIAN);
        assertTrue(escrow.paused());
        assertEq(escrow.getFinalAllocation(id).decisionId, decision);
        assertEq(escrow.unspentVoucherLiability(address(token)), 100);
        vm.prank(COMMUNITY);
        escrow.unpause();
        _executeBoth(decision, false);
        assertTrue(escrow.isFinanciallyClosed(id));
    }

    function testGnosisVoucherEscrow_abortBeforeAuthorizationTombstonesLateMessages() public {
        _deliver(Codec.encodeDecision(_authorization(), _command(Codec.SetupDecision.Abort)));
        assertEq(uint8(escrow.getSetupResult(id).phase), uint8(Codec.SetupPhase.Aborted));
        _deliver(Codec.encodeAuthorization(_authorization()));
        vm.expectRevert(GnosisVoucherEscrow.SetupAlreadyDecided.selector);
        vm.prank(ISSUER);
        escrow.approveSetupAuthorization(id, payloadHash);
        assertEq(token.balanceOf(HOLDER), 100);
        assertEq(escrow.unspentVoucherLiability(address(token)), 0);
    }

    function testGnosisVoucherEscrow_lostDepositAckThenSourceAbortRefundsActualDeposit() public {
        router.configure(0, true, false);
        _deposit();
        assertEq(escrow.getSetupExecution(id).setupAcknowledgment.sequence, 0);
        _deliver(Codec.encodeDecision(_authorization(), _command(Codec.SetupDecision.Abort)));
        assertEq(token.balanceOf(HOLDER), 100);
        assertEq(escrow.getSetupResult(id).setupRefundedUnits, 100);
        assertEq(escrow.unspentVoucherLiability(address(token)), 0);
        router.configure(0, false, false);
        escrow.retrySetupAcknowledgment(id);
        assertEq(uint8(Codec.decodeSetupResult(router.lastData()).phase), uint8(Codec.SetupPhase.Aborted));
    }

    function testGnosisVoucherEscrow_abortRefundFailureRetriesWithoutAllowingActivation() public {
        _deposit();
        token.configureFailure(HOLDER, 0, false);
        _deliver(Codec.encodeDecision(_authorization(), _command(Codec.SetupDecision.Abort)));
        assertEq(uint8(escrow.getSetupResult(id).phase), uint8(Codec.SetupPhase.AbortRefundPending));
        vm.expectRevert(VoucherRedemptionReceiver.ConflictingSetupDecision.selector);
        _activate();
        token.configureFailure(address(0), 0, false);
        escrow.retrySetupAction(id);
        assertEq(token.balanceOf(HOLDER), 100);
        assertEq(escrow.getFinalAllocation(id).decisionId, bytes32(0));
    }

    function testGnosisVoucherEscrow_activationExcludesSetupAbortAndRequiresExactDeposit() public {
        _open();
        vm.expectRevert(VoucherRedemptionReceiver.InvalidSetupDecision.selector);
        _activate();
        vm.prank(HOLDER);
        escrow.presentSetup(id, payloadHash);
        _activate();
        vm.expectRevert(VoucherRedemptionReceiver.ConflictingSetupDecision.selector);
        _deliver(Codec.encodeDecision(_authorization(), _command(Codec.SetupDecision.Abort)));
        assertEq(token.balanceOf(address(escrow)), 100);
    }

    function testGnosisVoucherEscrow_holderAbortRequestIsNotARefundOrActivation() public {
        _deposit();
        vm.prank(HOLDER);
        escrow.requestSetupAbort(id, payloadHash);
        Codec.HolderAbortRequest memory request = Codec.decodeHolderAbortRequest(router.lastData());
        assertEq(request.holder, HOLDER);
        assertEq(request.authorizationHash, payloadHash);
        assertEq(token.balanceOf(address(escrow)), 100);
        assertEq(uint8(escrow.getSetupResult(id).phase), uint8(Codec.SetupPhase.Deposited));
    }

    function testGnosisVoucherEscrow_canonicalDecisionReplayIsIdempotentAndConflictRejected() public {
        _active();
        uint64 sequence = escrow.getSetupResult(id).resultSequence;
        _activate();
        assertEq(escrow.getSetupResult(id).resultSequence, sequence);
        Codec.SetupDecisionCommand memory c = _command(Codec.SetupDecision.Activate);
        c.coreAcceptanceHash = keccak256("conflict");
        vm.expectRevert(VoucherRedemptionReceiver.ConflictingSetupDecision.selector);
        _deliver(Codec.encodeDecision(_authorization(), c));
    }

    function testGnosisVoucherEscrow_twoSameTokenEscrowsCannotSubsidizeUnexpectedDeficit() public {
        bytes32 firstDecision = _partial();
        Codec.SetupAuthorization memory second = _authorization();
        ++second.requestNonce;
        second.claimHash = keccak256("fictional renewed claim");
        bytes32 secondId = Codec.setupId(second);
        bytes32 secondHash = Codec.hash(second);
        token.mintFixture(HOLDER, 100);
        vm.prank(HOLDER);
        token.approve(address(escrow), 100);
        _deliver(Codec.encodeAuthorization(second));
        vm.prank(ISSUER);
        escrow.approveSetupAuthorization(secondId, secondHash);
        vm.prank(HOLDER);
        escrow.presentSetup(secondId, secondHash);
        assertEq(escrow.unspentVoucherLiability(address(token)), 200);
        token.removeFixtureBalance(address(escrow), 1);
        _executeBoth(firstDecision, false);
        assertEq(token.balanceOf(ISSUER), 0);
        assertEq(token.balanceOf(HOLDER), 0);
        assertEq(escrow.unspentVoucherLiability(address(token)), 200);
        token.mintFixture(address(escrow), 1);
        _executeBoth(firstDecision, true);
        assertEq(token.balanceOf(address(escrow)), 100);
        assertEq(escrow.unspentVoucherLiability(address(token)), 100);
        Codec.SetupDecisionCommand memory abortSecond = Codec.SetupDecisionCommand(
            2, secondId, secondHash, Codec.SetupDecision.Abort, bytes32(0), bytes32(0), Codec.AbortReason.BuyerRequest
        );
        _deliver(Codec.encodeDecision(second, abortSecond));
        assertEq(token.balanceOf(HOLDER), 160);
        assertEq(escrow.unspentVoucherLiability(address(token)), 0);
    }

    function testGnosisVoucherEscrow_wrongSetupDecisionCannotSpendAnotherEscrow() public {
        bytes32 decision = _partial();
        vm.expectRevert(VoucherRedemptionReceiver.UnknownRedemption.selector);
        escrow.executeFinalLeg(keccak256("other setup"), decision, Codec.FinalLeg.RefundToHolder);
        vm.expectRevert(GnosisVoucherEscrow.WrongFinalDecision.selector);
        escrow.executeFinalLeg(id, keccak256("other decision"), Codec.FinalLeg.ReleaseToIssuer);
        vm.expectRevert(VoucherRedemptionReceiver.SelfOnly.selector);
        escrow.executeStoredFinalLeg(id, Codec.FinalLeg.ReleaseToIssuer);
        assertEq(token.balanceOf(address(escrow)), 100);
    }

    function testVoucherRedemption_fixedWireLengthsAndBoundedAuthorizationGas() public {
        bytes memory data = Codec.encodeAuthorization(_authorization());
        assertEq(data.length, 800);
        (bool success, uint256 gasUsed) =
            router.deliverBounded(address(escrow), _message(data, keccak256("bounded")), 2_000_000);
        assertTrue(success);
        assertLt(gasUsed, 2_000_000);
        assertEq(Codec.encodeDecision(_authorization(), _command(Codec.SetupDecision.Abort)).length, 1024);
        assertEq(Codec.encodeSetupResult(escrow.getSetupResult(id)).length, 448);
        vm.prank(ISSUER);
        escrow.approveSetupAuthorization(id, payloadHash);
        vm.prank(HOLDER);
        escrow.presentSetup(id, payloadHash);
        _activate();
        _freeze(10, 100, 0);
        assertEq(Codec.encodeFinalResult(escrow.getFinalResult(id)).length, 544);
    }

    function testFuzz_VoucherRedemption_finalPartialConservesServiceAndVoucherQuantities(
        uint96 releaseSeed,
        uint8 serviceSeed,
        bool refundFirst
    )
        public
    {
        _active();
        uint256 released = bound(uint256(releaseSeed), 0, 100);
        uint256 service = bound(uint256(serviceSeed), released == 0 ? 0 : 1, 10);
        _allowReturn(100 - released);
        bytes32 decision = _freeze(service, released, 100 - released);
        _executeBoth(decision, refundFirst);
        assertEq(token.balanceOf(ISSUER) + token.balanceOf(HOLDER), 100);
        assertEq(token.balanceOf(address(escrow)), 0);
        assertEq(escrow.getFinalAllocation(id).allocation.approvedDeliveredServiceUnits, service);
        assertTrue(escrow.isFinanciallyClosed(id));
        assertEq(escrow.unspentVoucherLiability(address(token)), 0);
    }

    function testVoucherRedemption_feeBearingSetupFailuresPreservePrefundedAckReserve() public {
        router.configure(5, false, false);
        vm.deal(address(escrow), 50);
        _open();
        vm.prank(HOLDER);
        token.approve(address(escrow), 0);
        vm.prank(HOLDER);
        escrow.presentSetup(id, payloadHash);
        escrow.retrySetupAction(id);
        escrow.retrySetupAction(id);
        assertFalse(escrow.getSetupResult(id).actionSucceeded);
        assertEq(address(escrow).balance, 50, "permissionless failed setup retries cannot consume prefunded ACK fees");
        assertEq(router.nonce(), 0);
        assertTrue(escrow.getSetupExecution(id).setupAcknowledgment.failureHash != bytes32(0));
        vm.deal(address(this), 10);
        vm.expectRevert(abi.encodeWithSelector(VoucherRedemptionReceiver.IncorrectAcknowledgmentFee.selector, 5, 0));
        escrow.retrySetupAcknowledgment(id);
        escrow.retrySetupAcknowledgment{ value: 5 }(id);
        assertEq(address(escrow).balance, 50);
        assertEq(router.nonce(), 1);
        assertEq(escrow.getSetupExecution(id).setupAcknowledgment.sequence, escrow.getSetupResult(id).resultSequence);
        assertEq(token.balanceOf(HOLDER), 100);
    }

    function testVoucherRedemption_feeBearingFinalLegFailuresPreservePrefundedAckReserve() public {
        bytes32 decision = _partial();
        uint256 sendsBefore = router.nonce();
        router.configure(5, false, false);
        vm.deal(address(escrow), 50);
        token.configureFailure(ISSUER, 0, false);
        escrow.executeFinalLeg(id, decision, Codec.FinalLeg.ReleaseToIssuer);
        escrow.executeFinalLeg(id, decision, Codec.FinalLeg.ReleaseToIssuer);
        assertEq(address(escrow).balance, 50, "permissionless failed leg retries cannot consume prefunded ACK fees");
        assertEq(router.nonce(), sendsBefore);
        assertEq(escrow.getFinalAllocation(id).release.attempts, 2);
        assertEq(token.balanceOf(ISSUER), 0);
        vm.deal(address(this), 5);
        escrow.retryFinalAcknowledgment{ value: 5 }(id);
        assertEq(address(escrow).balance, 50);
        assertEq(router.nonce(), sendsBefore + 1);
        assertEq(escrow.getSetupExecution(id).finalAcknowledgment.sequence, escrow.getFinalResult(id).sequence);
    }

    function testGnosisVoucherEscrow_legacyIncrementalSelectorsRejectEvenForAnActiveV2Setup() public {
        _active();
        vm.expectRevert(VoucherRedemptionReceiver.LegacyVoucherServiceDisabled.selector);
        vm.prank(HOLDER);
        escrow.approveDelivered(id, payloadHash, 2, 3, 40);
        vm.expectRevert(VoucherRedemptionReceiver.LegacyVoucherServiceDisabled.selector);
        vm.prank(HOLDER);
        escrow.returnUndelivered(id, payloadHash, 2, 100);
        assertEq(token.balanceOf(address(escrow)), 100);
    }

    function testGnosisVoucherEscrow_outgoingCreditWithoutDebitCannotConsumeEitherLeg() public {
        bytes32 decision = _partial();
        token.configureFailure(address(0), 0, true);
        escrow.executeFinalLeg(id, decision, Codec.FinalLeg.RefundToHolder);
        assertEq(uint8(escrow.getFinalAllocation(id).refund.state), uint8(Codec.LegState.Failed));
        assertEq(token.balanceOf(HOLDER), 0);
        assertEq(token.balanceOf(address(escrow)), 100);
        assertEq(escrow.unspentVoucherLiability(address(token)), 100);
        token.configureFailure(address(0), 0, false);
        _executeBoth(decision, true);
        assertEq(token.balanceOf(HOLDER), 60);
        assertEq(token.balanceOf(ISSUER), 40);
    }

    function testGnosisVoucherEscrow_pauseBlocksFreshFinalApprovalWithoutChangingEscrow() public {
        _active();
        vm.prank(GUARDIAN);
        escrow.pause();
        vm.expectRevert(GnosisVoucherEscrow.ExecutionPaused.selector);
        _freeze(10, 100, 0);
        assertEq(escrow.getFinalAllocation(id).decisionId, bytes32(0));
        assertEq(token.balanceOf(address(escrow)), 100);
    }
}
