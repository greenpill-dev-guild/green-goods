// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ICreditRegistry } from "../../src/interfaces/ICreditRegistry.sol";
import { ISettlementModule } from "../../src/interfaces/ISettlementModule.sol";
import { SettlementMessageCodec } from "../../src/libraries/SettlementMessageCodec.sol";
import { SettlementModule } from "../../src/modules/SettlementModule.sol";
import { CreditRegistry } from "../../src/registries/Credit.sol";
import { SettlementPayerTest } from "./SettlementPayer.t.sol";

interface ICreditSettlementUpgrade {
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
}

contract CreditSettlementTest is SettlementPayerTest {
    uint256 internal constant CREDIT_POOL_ID = 1;
    address internal constant BORROWER = address(0xC0FFEE);
    address internal constant SECOND_BORROWER = address(0xC0FFEF);
    address internal constant REPLACEMENT_EXECUTOR = address(0x8001);

    CreditRegistry internal credit;

    function setUp() public override {
        super.setUp();
        _setCreditPoolState(ICommitmentPoolingModule.PoolState.Open);
        hats.setMember(PROTOCOL_GARDEN, BORROWER, true);
        hats.setMember(PROTOCOL_GARDEN, SECOND_BORROWER, true);

        CreditRegistry implementation = new CreditRegistry();
        credit = CreditRegistry(
            address(
                new ERC1967Proxy(
                    address(implementation),
                    abi.encodeCall(CreditRegistry.initialize, (OWNER, address(hats), address(pooling), address(settlement)))
                )
            )
        );

        vm.startPrank(OWNER);
        credit.setPaused(false);
        credit.configurePoolCredit(CREDIT_POOL_ID, 100 ether, true);
        settlement.setPaused(true);
        settlement.setCreditRegistry(address(credit));
        settlement.setPaused(false);
        vm.stopPrank();
    }

    function testCreditSettlement_loanPrincipalQueueDerivesAndPersistsTheFrozenRelationship() public {
        uint256 loanId = _approvedLoan(BORROWER, 40 ether);

        vm.prank(OWNER);
        uint256 disbursementId = settlement.queueLoanPrincipal(loanId);
        ISettlementModule.Disbursement memory child = settlement.getDisbursement(disbursementId);

        assertEq(uint8(child.kind), uint8(ISettlementModule.DisbursementKind.LoanPrincipal));
        assertEq(uint8(child.fundingRoute), uint8(ISettlementModule.FundingRoute.None));
        assertEq(child.commitmentId, 0);
        assertEq(child.payoutPlanId, 0);
        assertEq(child.contributor, address(0));
        assertEq(child.garden, PROTOCOL_GARDEN);
        assertEq(child.executorGarden, PROTOCOL_GARDEN);
        assertEq(child.source, PAYER_SAFE);
        assertEq(child.recipient, BORROWER);
        assertEq(child.token, GDOLLAR);
        assertEq(child.amount, 40 ether);
        ISettlementModule.LoanPrincipalRelationship memory relationship =
            settlement.loanPrincipalRelationshipOf(disbursementId);
        assertEq(relationship.creditRegistry, address(credit));
        assertEq(relationship.loanId, loanId);
        assertEq(settlement.loanPrincipalDisbursementOf(address(credit), loanId), disbursementId);

        vm.prank(OWNER);
        assertEq(settlement.queueLoanPrincipal(loanId), disbursementId, "queue must be idempotent");
    }

    function testCreditSettlement_frozenSettlementOrdinalsRemainExact() public {
        assertEq(uint8(ISettlementModule.DisbursementKind.ContributorConsideration), 0);
        assertEq(uint8(ISettlementModule.DisbursementKind.Funding), 1);
        assertEq(uint8(ISettlementModule.DisbursementKind.LoanPrincipal), 2);
        assertEq(uint8(ISettlementModule.DisbursementKind.GardenBeneficiary), 3);
        assertEq(uint8(ISettlementModule.FailureCode.SourceStranded), 12);
    }

    function testCreditSettlement_confirmedLoanPrincipalCanBeRecordedExactlyOnce() public {
        uint256 loanId = _approvedLoan(BORROWER, 40 ether);
        vm.startPrank(OWNER);
        uint256 disbursementId = settlement.queueLoanPrincipal(loanId);
        bytes32 messageId = settlement.dispatchDisbursement(disbursementId);
        vm.stopPrank();

        ISettlementModule.Disbursement memory dispatched = settlement.getDisbursement(disbursementId);
        router.deliver(
            address(settlement),
            keccak256("loan-success"),
            1,
            address(0x8000),
            SettlementMessageCodec.encodeAcknowledgment(
                1, dispatched.executionKey, messageId, true, uint8(ISettlementModule.FailureCode.None)
            )
        );

        bytes32 executionRef = keccak256(abi.encode(dispatched.executionKey, disbursementId));
        vm.prank(OWNER);
        credit.recordDisbursed(loanId, ICreditRegistry.LoanRail.GDollarSettlement, executionRef);

        ICreditRegistry.Loan memory loan = credit.getLoan(loanId);
        assertEq(uint8(loan.state), uint8(ICreditRegistry.LoanState.Disbursed));
        assertEq(loan.disbursementId, disbursementId);
        assertEq(loan.executionRef, executionRef);
        assertEq(credit.outstandingOf(CREDIT_POOL_ID, BORROWER), 40 ether);

        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.LoanNotInState.selector, loanId, loan.state));
        vm.prank(OWNER);
        credit.recordDisbursed(loanId, ICreditRegistry.LoanRail.GDollarSettlement, executionRef);

        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.GDollarRepaymentDisabled.selector, loanId));
        vm.prank(OWNER);
        credit.recordRepayment(loanId, 1 ether, keccak256("human-entered-gdollar-hash"));
    }

    function testCreditSettlement_nonGdollarRecordingRejectsQueuedAndBatchedPrincipalChildren() public {
        uint256 queuedLoanId = _approvedLoan(BORROWER, 30 ether);
        uint256 batchedLoanId = _approvedLoan(SECOND_BORROWER, 20 ether);
        uint256[] memory ids = new uint256[](2);

        vm.startPrank(OWNER);
        ids[0] = settlement.queueLoanPrincipal(queuedLoanId);
        ids[1] = settlement.queueLoanPrincipal(batchedLoanId);
        vm.stopPrank();

        _expectNonGdollarRecordingBlocked(queuedLoanId, ICreditRegistry.LoanRail.Jar, "queued-cross-rail");

        vm.startPrank(OWNER);
        settlement.setPaused(true);
        settlement.setBatchSizeLimit(2);
        settlement.setPaused(false);
        settlement.createBatch(ids);
        vm.stopPrank();

        _expectNonGdollarRecordingBlocked(batchedLoanId, ICreditRegistry.LoanRail.Treasury, "batched-cross-rail");
    }

    function testCreditSettlement_nonGdollarRecordingRejectsDispatchedAndConfirmedPrincipalChild() public {
        uint256 loanId = _approvedLoan(BORROWER, 40 ether);
        vm.startPrank(OWNER);
        uint256 disbursementId = settlement.queueLoanPrincipal(loanId);
        bytes32 messageId = settlement.dispatchDisbursement(disbursementId);
        vm.stopPrank();

        _expectNonGdollarRecordingBlocked(loanId, ICreditRegistry.LoanRail.Jar, "dispatched-cross-rail");

        ISettlementModule.Disbursement memory dispatched = settlement.getDisbursement(disbursementId);
        router.deliver(
            address(settlement),
            keccak256("cross-rail-confirmed"),
            1,
            address(0x8000),
            SettlementMessageCodec.encodeAcknowledgment(
                1, dispatched.executionKey, messageId, true, uint8(ISettlementModule.FailureCode.None)
            )
        );

        _expectNonGdollarRecordingBlocked(loanId, ICreditRegistry.LoanRail.Treasury, "confirmed-cross-rail");
    }

    function testCreditSettlement_nonGdollarRecordingRejectsFailedAndRetriedPrincipalChild() public {
        uint256 loanId = _approvedLoan(BORROWER, 40 ether);
        vm.startPrank(OWNER);
        uint256 disbursementId = settlement.queueLoanPrincipal(loanId);
        bytes32 messageId = settlement.dispatchDisbursement(disbursementId);
        vm.stopPrank();

        ISettlementModule.Disbursement memory dispatched = settlement.getDisbursement(disbursementId);
        router.deliver(
            address(settlement),
            keccak256("cross-rail-failed"),
            1,
            address(0x8000),
            SettlementMessageCodec.encodeAcknowledgment(
                1, dispatched.executionKey, messageId, false, uint8(ISettlementModule.FailureCode.RouteRejected)
            )
        );
        _expectNonGdollarRecordingBlocked(loanId, ICreditRegistry.LoanRail.Jar, "failed-cross-rail");

        vm.startPrank(OWNER);
        settlement.requeue(disbursementId);
        settlement.dispatchDisbursement(disbursementId);
        vm.stopPrank();
        assertEq(settlement.getDisbursement(disbursementId).attempt, 1);

        _expectNonGdollarRecordingBlocked(loanId, ICreditRegistry.LoanRail.Treasury, "retried-cross-rail");
    }

    function testCreditSettlement_strandedLoanFailureDoesNotRecordDisbursementAndRequeueIsIsolated() public {
        uint256 loanId = _approvedLoan(BORROWER, 40 ether);
        vm.startPrank(OWNER);
        uint256 disbursementId = settlement.queueLoanPrincipal(loanId);
        settlement.dispatchDisbursement(disbursementId);
        settlement.setPaused(true);
        settlement.setCcipRoute(1, REPLACEMENT_EXECUTOR, 500_000, 1, 1 days);
        settlement.setPaused(false);
        vm.stopPrank();
        vm.warp(block.timestamp + 2 days);

        vm.prank(OWNER);
        settlement.failStrandedSubject(false, disbursementId);
        ISettlementModule.Disbursement memory failed = settlement.getDisbursement(disbursementId);
        assertEq(uint8(failed.state), uint8(ISettlementModule.DisbursementState.Failed));
        assertEq(failed.failureCode, uint8(ISettlementModule.FailureCode.SourceStranded));
        assertEq(uint8(credit.getLoan(loanId).state), uint8(ICreditRegistry.LoanState.Approved));
        assertEq(credit.outstandingOf(CREDIT_POOL_ID, BORROWER), 0);

        vm.expectRevert(abi.encodeWithSelector(ICreditRegistry.SettlementNotConfirmed.selector, loanId, disbursementId));
        vm.prank(OWNER);
        credit.recordDisbursed(loanId, ICreditRegistry.LoanRail.GDollarSettlement, keccak256("stranded"));

        bytes32 failedKey = failed.executionKey;
        vm.startPrank(OWNER);
        settlement.requeue(disbursementId);
        bytes32 replacementMessageId = settlement.dispatchDisbursement(disbursementId);
        vm.stopPrank();
        ISettlementModule.Disbursement memory retried = settlement.getDisbursement(disbursementId);
        assertEq(retried.attempt, 1);
        assertTrue(retried.executionKey != failedKey, "attempt must isolate the replacement command");
        ISettlementModule.LoanPrincipalRelationship memory relationship =
            settlement.loanPrincipalRelationshipOf(disbursementId);
        assertEq(relationship.creditRegistry, address(credit));
        assertEq(relationship.loanId, loanId);
        assertEq(credit.outstandingOf(CREDIT_POOL_ID, BORROWER), 0, "source retry cannot count principal");

        router.deliver(
            address(settlement),
            keccak256("loan-retry-success"),
            1,
            REPLACEMENT_EXECUTOR,
            SettlementMessageCodec.encodeAcknowledgment(
                1, retried.executionKey, replacementMessageId, true, uint8(ISettlementModule.FailureCode.None)
            )
        );
        bytes32 executionRef = keccak256(abi.encode(retried.executionKey, disbursementId));
        vm.prank(OWNER);
        credit.recordDisbursed(loanId, ICreditRegistry.LoanRail.GDollarSettlement, executionRef);
        assertEq(credit.outstandingOf(CREDIT_POOL_ID, BORROWER), 40 ether);
        assertEq(credit.getLoan(loanId).attempts, 1);
    }

    function testCreditSettlement_creditCancellationRequiresTheQueuedSettlementChildToBeCancelledFirst() public {
        uint256 loanId = _approvedLoan(BORROWER, 40 ether);
        vm.prank(OWNER);
        uint256 disbursementId = settlement.queueLoanPrincipal(loanId);

        vm.expectRevert(
            abi.encodeWithSelector(
                ICreditRegistry.SettlementCancellationRequired.selector,
                loanId,
                disbursementId,
                uint8(ISettlementModule.DisbursementState.Queued)
            )
        );
        vm.prank(OWNER);
        credit.cancelLoan(loanId, "bafy-credit-cancel-too-early");

        vm.prank(OWNER);
        settlement.cancelDisbursement(disbursementId, "bafy-settlement-cancelled");
        vm.prank(OWNER);
        credit.cancelLoan(loanId, "bafy-credit-cancelled");

        assertEq(uint8(credit.getLoan(loanId).state), uint8(ICreditRegistry.LoanState.Cancelled));
        assertEq(credit.reservedOutstandingOf(CREDIT_POOL_ID, BORROWER), 0);
        assertFalse(credit.isCapReserved(loanId));
        ISettlementModule.LoanPrincipalRelationship memory relationship =
            settlement.loanPrincipalRelationshipOf(disbursementId);
        assertEq(relationship.creditRegistry, address(credit));
        assertEq(relationship.loanId, loanId);
    }

    function testCreditSettlement_dispatchedLoanCannotBeCancelledAndRelationshipSurvivesRetryAndAcknowledgment() public {
        uint256 loanId = _approvedLoan(BORROWER, 40 ether);
        vm.startPrank(OWNER);
        uint256 disbursementId = settlement.queueLoanPrincipal(loanId);
        settlement.dispatchDisbursement(disbursementId);
        bytes32 retryMessageId = settlement.retryCommand(disbursementId);
        vm.stopPrank();

        vm.expectRevert(
            abi.encodeWithSelector(
                ICreditRegistry.SettlementCancellationRequired.selector,
                loanId,
                disbursementId,
                uint8(ISettlementModule.DisbursementState.Dispatched)
            )
        );
        vm.prank(OWNER);
        credit.cancelLoan(loanId, "bafy-dispatched-cancel");

        ISettlementModule.Disbursement memory dispatched = settlement.getDisbursement(disbursementId);
        ISettlementModule.LoanPrincipalRelationship memory relationship =
            settlement.loanPrincipalRelationshipOf(disbursementId);
        assertEq(relationship.creditRegistry, address(credit));
        assertEq(relationship.loanId, loanId);

        router.deliver(
            address(settlement),
            keccak256("loan-retry-acknowledgment"),
            1,
            address(0x8000),
            SettlementMessageCodec.encodeAcknowledgment(
                1, dispatched.executionKey, retryMessageId, true, uint8(ISettlementModule.FailureCode.None)
            )
        );
        vm.expectRevert(
            abi.encodeWithSelector(
                ICreditRegistry.SettlementCancellationRequired.selector,
                loanId,
                disbursementId,
                uint8(ISettlementModule.DisbursementState.Confirmed)
            )
        );
        vm.prank(OWNER);
        credit.cancelLoan(loanId, "bafy-confirmed-cancel");
    }

    function testCreditSettlement_dependencyRotationWaitsUntilConfirmedPrincipalIsRecorded() public {
        uint256 loanId = _approvedLoan(BORROWER, 40 ether);
        vm.prank(OWNER);
        uint256 disbursementId = settlement.queueLoanPrincipal(loanId);

        vm.startPrank(OWNER);
        settlement.setPaused(true);
        vm.expectRevert(
            abi.encodeWithSelector(
                ISettlementModule.CreditRegistryHasActiveReservations.selector, address(credit), uint256(1)
            )
        );
        settlement.setCreditRegistry(address(0xBADC0DE));
        vm.expectRevert(
            abi.encodeWithSelector(
                ISettlementModule.CreditRegistryHasActiveReservations.selector, address(credit), uint256(1)
            )
        );
        settlement.setHatsModule(address(0xA11CE));
        vm.expectRevert(
            abi.encodeWithSelector(
                ISettlementModule.CreditRegistryHasActiveReservations.selector, address(credit), uint256(1)
            )
        );
        settlement.setCommitmentPoolingModule(address(0xB0B));
        settlement.setPaused(false);
        bytes32 messageId = settlement.dispatchDisbursement(disbursementId);
        vm.stopPrank();

        ISettlementModule.Disbursement memory dispatched = settlement.getDisbursement(disbursementId);
        router.deliver(
            address(settlement),
            keccak256("rotation-guard-confirmed"),
            1,
            address(0x8000),
            SettlementMessageCodec.encodeAcknowledgment(
                1, dispatched.executionKey, messageId, true, uint8(ISettlementModule.FailureCode.None)
            )
        );

        vm.startPrank(OWNER);
        settlement.setPaused(true);
        vm.expectRevert(
            abi.encodeWithSelector(
                ISettlementModule.CreditRegistryHasActiveReservations.selector, address(credit), uint256(1)
            )
        );
        settlement.setCreditRegistry(address(0xBADC0DE));
        vm.stopPrank();

        bytes32 executionRef = keccak256(abi.encode(dispatched.executionKey, disbursementId));
        vm.prank(OWNER);
        credit.recordDisbursed(loanId, ICreditRegistry.LoanRail.GDollarSettlement, executionRef);
        assertEq(credit.activeReservationCount(), 0);

        vm.prank(OWNER);
        settlement.setCreditRegistry(address(0xBADC0DE));
        assertEq(settlement.creditRegistry(), address(0xBADC0DE));
    }

    function testCreditSettlement_revertsWhenExpiredPrincipalQueuesOrDispatches() public {
        vm.warp(1);
        uint64 queueDueDate = uint64(block.timestamp + 1 days);
        uint256 expiredBeforeQueueId = _approvedLoanWithDueDate(BORROWER, 20 ether, queueDueDate);
        vm.warp(uint256(queueDueDate) + 1);
        vm.expectRevert(
            abi.encodeWithSelector(ISettlementModule.LoanPrincipalExpired.selector, expiredBeforeQueueId, queueDueDate)
        );
        vm.prank(OWNER);
        settlement.queueLoanPrincipal(expiredBeforeQueueId);

        uint64 dispatchDueDate = queueDueDate + 1 days + 1;
        uint256 expiredBeforeDispatchId = _approvedLoanWithDueDate(SECOND_BORROWER, 20 ether, dispatchDueDate);
        vm.prank(OWNER);
        uint256 disbursementId = settlement.queueLoanPrincipal(expiredBeforeDispatchId);
        vm.warp(uint256(dispatchDueDate) + 1);
        vm.expectRevert(
            abi.encodeWithSelector(
                ISettlementModule.LoanPrincipalExpired.selector, expiredBeforeDispatchId, dispatchDueDate
            )
        );
        vm.prank(OWNER);
        settlement.dispatchDisbursement(disbursementId);
        assertEq(uint8(settlement.getDisbursement(disbursementId).state), uint8(ISettlementModule.DisbursementState.Queued));
    }

    function testCreditSettlement_revertsWhenExpiredPrincipalDispatchesARequeuedAttempt() public {
        uint64 dueDate = uint64(block.timestamp + 1 days);
        uint256 loanId = _approvedLoanWithDueDate(BORROWER, 20 ether, dueDate);
        vm.startPrank(OWNER);
        uint256 disbursementId = settlement.queueLoanPrincipal(loanId);
        bytes32 messageId = settlement.dispatchDisbursement(disbursementId);
        vm.stopPrank();

        ISettlementModule.Disbursement memory dispatched = settlement.getDisbursement(disbursementId);
        router.deliver(
            address(settlement),
            keccak256("expired-requeue-failure"),
            1,
            address(0x8000),
            SettlementMessageCodec.encodeAcknowledgment(
                1, dispatched.executionKey, messageId, false, uint8(ISettlementModule.FailureCode.RouteRejected)
            )
        );
        vm.warp(uint256(dueDate) + 1);

        vm.startPrank(OWNER);
        settlement.requeue(disbursementId);
        vm.expectRevert(abi.encodeWithSelector(ISettlementModule.LoanPrincipalExpired.selector, loanId, dueDate));
        settlement.dispatchDisbursement(disbursementId);
        vm.stopPrank();
    }

    function testCreditSettlement_confirmedPrincipalRemainsRecordableAfterDueDate() public {
        uint64 dueDate = uint64(block.timestamp + 1 days);
        uint256 loanId = _approvedLoanWithDueDate(BORROWER, 20 ether, dueDate);
        vm.startPrank(OWNER);
        uint256 disbursementId = settlement.queueLoanPrincipal(loanId);
        bytes32 messageId = settlement.dispatchDisbursement(disbursementId);
        vm.stopPrank();

        ISettlementModule.Disbursement memory dispatched = settlement.getDisbursement(disbursementId);
        vm.warp(uint256(dueDate) + 1);
        router.deliver(
            address(settlement),
            keccak256("confirmed-after-due-date"),
            1,
            address(0x8000),
            SettlementMessageCodec.encodeAcknowledgment(
                1, dispatched.executionKey, messageId, true, uint8(ISettlementModule.FailureCode.None)
            )
        );

        vm.prank(OWNER);
        credit.recordDisbursed(
            loanId,
            ICreditRegistry.LoanRail.GDollarSettlement,
            keccak256(abi.encode(dispatched.executionKey, disbursementId))
        );
        assertEq(uint8(credit.getLoan(loanId).state), uint8(ICreditRegistry.LoanState.Disbursed));
    }

    function testCreditSettlement_dispatchRechecksPoolCreditAndRegistryPause() public {
        uint256 loanId = _approvedLoan(BORROWER, 40 ether);
        vm.prank(OWNER);
        uint256 disbursementId = settlement.queueLoanPrincipal(loanId);

        _setCreditPoolState(ICommitmentPoolingModule.PoolState.Paused);
        vm.expectRevert(
            abi.encodeWithSelector(
                ISettlementModule.LoanPrincipalPoolNotOpen.selector,
                loanId,
                CREDIT_POOL_ID,
                uint8(ICommitmentPoolingModule.PoolState.Paused)
            )
        );
        vm.prank(OWNER);
        settlement.dispatchDisbursement(disbursementId);

        _setCreditPoolState(ICommitmentPoolingModule.PoolState.Open);
        vm.prank(OWNER);
        credit.configurePoolCredit(CREDIT_POOL_ID, 100 ether, false);
        vm.expectRevert(
            abi.encodeWithSelector(ISettlementModule.LoanPrincipalCreditDisabled.selector, loanId, CREDIT_POOL_ID)
        );
        vm.prank(OWNER);
        settlement.dispatchDisbursement(disbursementId);

        vm.startPrank(OWNER);
        credit.configurePoolCredit(CREDIT_POOL_ID, 100 ether, true);
        credit.setPaused(true);
        vm.stopPrank();
        vm.expectRevert(abi.encodeWithSelector(ISettlementModule.CreditRegistryPaused.selector, address(credit)));
        vm.prank(OWNER);
        settlement.dispatchDisbursement(disbursementId);

        assertEq(uint8(settlement.getDisbursement(disbursementId).state), uint8(ISettlementModule.DisbursementState.Queued));
    }

    function testCreditSettlement_dispatchRechecksReservedExposureBeforeValueCanMove() public {
        uint256 loanId = _approvedLoan(BORROWER, 40 ether);
        vm.prank(OWNER);
        uint256 disbursementId = settlement.queueLoanPrincipal(loanId);
        vm.prank(OWNER);
        credit.configurePoolCredit(CREDIT_POOL_ID, 30 ether, true);

        vm.expectRevert(
            abi.encodeWithSelector(ISettlementModule.LoanPrincipalCapExceeded.selector, loanId, 40 ether, uint256(0))
        );
        vm.prank(OWNER);
        settlement.dispatchDisbursement(disbursementId);
        assertEq(uint8(settlement.getDisbursement(disbursementId).state), uint8(ISettlementModule.DisbursementState.Queued));
    }

    function testCreditSettlement_confirmedPrincipalStillRecordsAfterAPostDispatchCapReduction() public {
        uint256 loanId = _approvedLoan(BORROWER, 40 ether);
        vm.startPrank(OWNER);
        uint256 disbursementId = settlement.queueLoanPrincipal(loanId);
        bytes32 messageId = settlement.dispatchDisbursement(disbursementId);
        credit.configurePoolCredit(CREDIT_POOL_ID, 30 ether, true);
        vm.stopPrank();

        ISettlementModule.Disbursement memory dispatched = settlement.getDisbursement(disbursementId);
        router.deliver(
            address(settlement),
            keccak256("post-dispatch-cap-reduction"),
            1,
            address(0x8000),
            SettlementMessageCodec.encodeAcknowledgment(
                1, dispatched.executionKey, messageId, true, uint8(ISettlementModule.FailureCode.None)
            )
        );
        bytes32 executionRef = keccak256(abi.encode(dispatched.executionKey, disbursementId));
        vm.prank(OWNER);
        credit.recordDisbursed(loanId, ICreditRegistry.LoanRail.GDollarSettlement, executionRef);

        assertEq(credit.outstandingOf(CREDIT_POOL_ID, BORROWER), 40 ether);
        assertEq(credit.reservedOutstandingOf(CREDIT_POOL_ID, BORROWER), 0);
    }

    function testCreditSettlement_batchKeepsPerLoanRelationshipAndDomainSeparatedReceipt() public {
        uint256 firstLoanId = _approvedLoan(BORROWER, 30 ether);
        uint256 secondLoanId = _approvedLoan(SECOND_BORROWER, 20 ether);
        uint256[] memory ids = new uint256[](2);

        vm.startPrank(OWNER);
        settlement.setPaused(true);
        settlement.setBatchSizeLimit(2);
        settlement.setPaused(false);
        ids[0] = settlement.queueLoanPrincipal(firstLoanId);
        ids[1] = settlement.queueLoanPrincipal(secondLoanId);
        uint256 batchId = settlement.createBatch(ids);
        bytes32 messageId = settlement.dispatchBatch(batchId);
        vm.stopPrank();

        ISettlementModule.Batch memory batch = settlement.getBatch(batchId);
        router.deliver(
            address(settlement),
            keccak256("loan-batch-success"),
            1,
            address(0x8000),
            SettlementMessageCodec.encodeAcknowledgment(
                1, batch.executionKey, messageId, true, uint8(ISettlementModule.FailureCode.None)
            )
        );

        bytes32 firstRef = keccak256(abi.encode(batch.executionKey, ids[0]));
        bytes32 secondRef = keccak256(abi.encode(batch.executionKey, ids[1]));
        assertTrue(firstRef != secondRef);
        vm.startPrank(OWNER);
        credit.recordDisbursed(firstLoanId, ICreditRegistry.LoanRail.GDollarSettlement, firstRef);
        credit.recordDisbursed(secondLoanId, ICreditRegistry.LoanRail.GDollarSettlement, secondRef);
        vm.stopPrank();
        assertEq(credit.outstandingOf(CREDIT_POOL_ID, BORROWER), 30 ether);
        assertEq(credit.outstandingOf(CREDIT_POOL_ID, SECOND_BORROWER), 20 ether);
    }

    function testCreditSettlement_settlementUpgradePreservesNamespacedLoanRelationship() public {
        uint256 loanId = _approvedLoan(BORROWER, 40 ether);
        vm.startPrank(OWNER);
        uint256 disbursementId = settlement.queueLoanPrincipal(loanId);
        settlement.setPaused(true);
        SettlementModule replacement = new SettlementModule(address(router), ARBITRUM_SELECTOR, CELO_CHAIN_ID);
        ICreditSettlementUpgrade(address(settlement)).upgradeToAndCall(address(replacement), bytes(""));

        assertEq(settlement.creditRegistry(), address(credit));
        assertEq(settlement.loanPrincipalDisbursementOf(address(credit), loanId), disbursementId);
        ISettlementModule.LoanPrincipalRelationship memory relationship =
            settlement.loanPrincipalRelationshipOf(disbursementId);
        assertEq(relationship.creditRegistry, address(credit));
        assertEq(relationship.loanId, loanId);

        settlement.setPaused(false);
        settlement.dispatchDisbursement(disbursementId);
        vm.stopPrank();
        assertEq(
            uint8(settlement.getDisbursement(disbursementId).state), uint8(ISettlementModule.DisbursementState.Dispatched)
        );
    }

    function _approvedLoan(address borrower, uint256 principal) private returns (uint256 loanId) {
        return _approvedLoanWithDueDate(borrower, principal, uint64(block.timestamp + 30 days));
    }

    function _approvedLoanWithDueDate(
        address borrower,
        uint256 principal,
        uint64 dueDate
    )
        private
        returns (uint256 loanId)
    {
        ICreditRegistry.RequestLoanParams memory params = ICreditRegistry.RequestLoanParams({
            poolId: CREDIT_POOL_ID,
            commitmentId: 0,
            token: GDOLLAR,
            principal: principal,
            dueDate: dueDate,
            installmentsTotal: 1,
            termsCID: "bafy-gdollar-credit",
            onBehalfOf: address(0)
        });
        vm.prank(borrower);
        loanId = credit.requestLoan(params);
        vm.prank(OWNER);
        credit.approveLoan(loanId);
    }

    function _setCreditPoolState(ICommitmentPoolingModule.PoolState state) private {
        pooling.setPool(
            CREDIT_POOL_ID,
            ICommitmentPoolingModule.Pool({
                garden: PROTOCOL_GARDEN,
                poolType: ICommitmentPoolingModule.PoolType.Garden,
                state: state,
                proofEnabled: true,
                settlementEnabled: false,
                charterCID: "bafy-credit-pool",
                openSeasonCycleId: 0,
                settlementAdapter: address(0),
                liveCommitmentCount: 0,
                nonTerminalCycleCount: 0
            })
        );
    }

    function _expectNonGdollarRecordingBlocked(
        uint256 loanId,
        ICreditRegistry.LoanRail rail,
        string memory refLabel
    )
        private
    {
        uint256 disbursementId = settlement.loanPrincipalDisbursementOf(address(credit), loanId);
        ISettlementModule.DisbursementState state = settlement.getDisbursement(disbursementId).state;
        vm.expectRevert(
            abi.encodeWithSelector(ICreditRegistry.SettlementChildExists.selector, loanId, disbursementId, uint8(state))
        );
        vm.prank(OWNER);
        credit.recordDisbursed(loanId, rail, keccak256(bytes(refLabel)));
        assertEq(uint8(credit.getLoan(loanId).state), uint8(ICreditRegistry.LoanState.Approved));
        assertTrue(credit.isCapReserved(loanId));
    }
}
