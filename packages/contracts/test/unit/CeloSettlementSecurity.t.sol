// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICeloSettlementExecutor } from "../../src/interfaces/ICeloSettlementExecutor.sol";
import { CeloSettlementExecutor } from "../../src/modules/CeloSettlementExecutor.sol";
import { CeloSettlementExecutorTest, ExecutorMockRouter } from "./CeloSettlementExecutor.t.sol";

interface ICeloUUPSUpgradeBoundary {
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
}

contract CeloSettlementSecurityTest is CeloSettlementExecutorTest {
    address internal constant REPLACEMENT_SOURCE = address(0xCAFE);

    function testPreviousPeerWorksDuringGraceAndFailsAfterExpiry() public {
        vm.startPrank(OWNER);
        executor.setPaused(true);
        executor.setSourcePeer(REPLACEMENT_SOURCE, 1, 1 days);
        executor.setPaused(false);
        vm.stopPrank();

        router.deliver(
            address(executor),
            keccak256("old-peer-in-grace"),
            SOURCE_SELECTOR,
            SOURCE_MODULE,
            _command(false, 11, 0, 0, _one(CONTRIBUTOR), _oneAmount(100 ether))
        );
        assertEq(token.balanceOf(CONTRIBUTOR), 100 ether);

        vm.warp(block.timestamp + 1 days + 1);
        vm.expectRevert(ICeloSettlementExecutor.InvalidCcipSender.selector);
        router.deliver(
            address(executor),
            keccak256("old-peer-expired"),
            SOURCE_SELECTOR,
            SOURCE_MODULE,
            _command(false, 12, 0, 0, _one(address(0x3001)), _oneAmount(100 ether))
        );

        router.deliver(
            address(executor),
            keccak256("new-peer-current"),
            SOURCE_SELECTOR,
            REPLACEMENT_SOURCE,
            _command(false, 13, 0, 0, _one(address(0x3001)), _oneAmount(100 ether))
        );
        assertEq(token.balanceOf(address(0x3001)), 100 ether);
    }

    function testPeerVersionRotationCannotCarryGrace() public {
        vm.prank(OWNER);
        executor.setPaused(true);

        vm.prank(OWNER);
        vm.expectRevert(ICeloSettlementExecutor.PolicyNotConfigured.selector);
        executor.setSourcePeer(REPLACEMENT_SOURCE, 2, 1 days);

        vm.prank(OWNER);
        executor.setSourcePeer(REPLACEMENT_SOURCE, 2, 0);
        ICeloSettlementExecutor.SourcePeer memory peer = executor.sourcePeer();
        assertEq(peer.sourceSettlementModule, REPLACEMENT_SOURCE);
        assertEq(peer.previousSourceSettlementModule, address(0));
        assertEq(peer.previousPeerExpiresAt, 0);
        assertEq(peer.protocolVersion, 2);
    }

    function testCallerFundedAcknowledgmentRetryDoesNotSpendReserve() public {
        router.setFee(1);
        bytes32 executionKey = _deliverWithDeferredAcknowledgment(14, "caller-funded");
        ICeloSettlementExecutor.ExecutionResult memory deferred = executor.executionResultOf(executionKey);
        assertFalse(deferred.acknowledgmentSent);
        assertEq(
            uint8(deferred.acknowledgmentDeferralCode),
            uint8(ICeloSettlementExecutor.AcknowledgmentDeferralCode.FeeReserveLow)
        );

        address caller = address(0xC411E2);
        vm.deal(caller, 1);
        vm.prank(caller);
        executor.retryAcknowledgment{ value: 1 }(executionKey);

        ICeloSettlementExecutor.ExecutionResult memory retried = executor.executionResultOf(executionKey);
        assertTrue(retried.acknowledgmentSent);
        assertEq(address(executor).balance, executor.acknowledgmentFeeReserveMinimum());
        assertEq(abi.decode(router.lastReceiver(), (address)), SOURCE_MODULE);
    }

    function testSponsoredAcknowledgmentRetrySpendsOnlyExcessReserve() public {
        router.setFee(1);
        bytes32 executionKey = _deliverWithDeferredAcknowledgment(15, "sponsored");
        vm.deal(OWNER, 1);
        vm.prank(OWNER);
        executor.fundAcknowledgmentFees{ value: 1 }();

        vm.prank(OWNER);
        executor.retryAcknowledgmentSponsored(executionKey);

        assertTrue(executor.executionResultOf(executionKey).acknowledgmentSent);
        assertEq(address(executor).balance, executor.acknowledgmentFeeReserveMinimum());
    }

    function testAcknowledgmentDeferralDistinguishesQuoteAndSendFailures() public {
        vm.deal(address(executor), 10);
        router.setFailures(true, false);
        router.deliver(
            address(executor),
            keccak256("quote-failure"),
            SOURCE_SELECTOR,
            SOURCE_MODULE,
            _command(false, 16, 0, 0, _one(CONTRIBUTOR), _oneAmount(10 ether))
        );
        bytes32 quoteKey = _executionKey(false, 16, 0);
        assertEq(
            uint8(executor.executionResultOf(quoteKey).acknowledgmentDeferralCode),
            uint8(ICeloSettlementExecutor.AcknowledgmentDeferralCode.QuoteFailed)
        );

        router.setFailures(false, true);
        router.deliver(
            address(executor),
            keccak256("send-failure"),
            SOURCE_SELECTOR,
            SOURCE_MODULE,
            _command(false, 17, 0, 0, _one(address(0x3001)), _oneAmount(10 ether))
        );
        bytes32 sendKey = _executionKey(false, 17, 0);
        assertEq(
            uint8(executor.executionResultOf(sendKey).acknowledgmentDeferralCode),
            uint8(ICeloSettlementExecutor.AcknowledgmentDeferralCode.SendFailed)
        );
    }

    function testAcknowledgmentFeeWithdrawalPreservesFloor() public {
        address payable recipient = payable(address(0xFEE));
        vm.deal(OWNER, 5);
        vm.prank(OWNER);
        executor.fundAcknowledgmentFees{ value: 5 }();

        vm.prank(OWNER);
        executor.withdrawExcessAcknowledgmentFees(recipient, 5);
        assertEq(address(executor).balance, executor.acknowledgmentFeeReserveMinimum());
        assertEq(recipient.balance, 5);

        vm.prank(OWNER);
        vm.expectRevert(
            abi.encodeWithSelector(
                ICeloSettlementExecutor.AcknowledgmentFeeReserveFloorViolated.selector, uint256(1), uint256(0)
            )
        );
        executor.withdrawExcessAcknowledgmentFees(recipient, 1);
    }

    function testTransferBatchAndFeeCapsAtBoundaries() public {
        router.deliver(
            address(executor),
            keccak256("max-transfer"),
            SOURCE_SELECTOR,
            SOURCE_MODULE,
            _command(false, 18, 0, 0, _one(CONTRIBUTOR), _oneAmount(1000 ether))
        );
        assertEq(
            uint8(executor.executionResultOf(_executionKey(false, 18, 0)).failureCode),
            uint8(ICeloSettlementExecutor.FailureCode.None)
        );

        router.deliver(
            address(executor),
            keccak256("over-transfer"),
            SOURCE_SELECTOR,
            SOURCE_MODULE,
            _command(false, 19, 0, 0, _one(address(0x3001)), _oneAmount(1000 ether + 1))
        );
        assertEq(
            uint8(executor.executionResultOf(_executionKey(false, 19, 0)).failureCode),
            uint8(ICeloSettlementExecutor.FailureCode.TransferAmountExceeded)
        );

        address[] memory fourRecipients = _recipients(4);
        uint256[] memory fourAmounts = _amounts(4, 1 ether);
        router.deliver(
            address(executor),
            keccak256("max-batch"),
            SOURCE_SELECTOR,
            SOURCE_MODULE,
            _command(true, 20, 0, 0, fourRecipients, fourAmounts)
        );
        assertEq(
            uint8(executor.executionResultOf(_executionKey(true, 20, 0)).failureCode),
            uint8(ICeloSettlementExecutor.FailureCode.None)
        );

        router.deliver(
            address(executor),
            keccak256("over-batch"),
            SOURCE_SELECTOR,
            SOURCE_MODULE,
            _command(true, 21, 0, 0, _recipients(5), _amounts(5, 1 ether))
        );
        assertEq(
            uint8(executor.executionResultOf(_executionKey(true, 21, 0)).failureCode),
            uint8(ICeloSettlementExecutor.FailureCode.BatchSizeExceeded)
        );

        token.setFee(10 ether, true);
        router.deliver(
            address(executor),
            keccak256("max-fee"),
            SOURCE_SELECTOR,
            SOURCE_MODULE,
            _command(false, 22, 0, 0, _one(address(0x3100)), _oneAmount(100 ether))
        );
        assertEq(
            uint8(executor.executionResultOf(_executionKey(false, 22, 0)).failureCode),
            uint8(ICeloSettlementExecutor.FailureCode.None)
        );

        token.setFee(10 ether + 1, true);
        router.deliver(
            address(executor),
            keccak256("over-fee"),
            SOURCE_SELECTOR,
            SOURCE_MODULE,
            _command(false, 23, 0, 0, _one(address(0x3101)), _oneAmount(100 ether))
        );
        assertEq(
            uint8(executor.executionResultOf(_executionKey(false, 23, 0)).failureCode),
            uint8(ICeloSettlementExecutor.FailureCode.FeeQuoteExceeded)
        );
    }

    function testPeriodicCapResetsOnlyAtBoundary() public {
        vm.startPrank(OWNER);
        executor.setPaused(true);
        executor.setPeriodicCap(1 days, 150 ether);
        executor.setPaused(false);
        vm.stopPrank();

        _deliver(24, CONTRIBUTOR, 100 ether);
        _deliver(25, address(0x3001), 50 ether);
        _deliver(26, address(0x3002), 1);
        assertEq(
            uint8(executor.executionResultOf(_executionKey(false, 26, 0)).failureCode),
            uint8(ICeloSettlementExecutor.FailureCode.PeriodCapExceeded)
        );

        ICeloSettlementExecutor.GardenPeriodSpend memory full = executor.gardenPeriodSpend(GARDEN);
        assertEq(full.amount, 150 ether);
        vm.warp(uint256(full.periodStartedAt) + 1 days);
        _deliver(27, address(0x3003), 1);
        assertEq(
            uint8(executor.executionResultOf(_executionKey(false, 27, 0)).failureCode),
            uint8(ICeloSettlementExecutor.FailureCode.None)
        );
        assertEq(executor.gardenPeriodSpend(GARDEN).amount, 1);
    }

    function testExecutorUpgradeRequiresOwnerPauseAndImmutableConfiguration() public {
        CeloSettlementExecutor replacement = new CeloSettlementExecutor(address(router), address(token));
        ICeloUUPSUpgradeBoundary proxy = ICeloUUPSUpgradeBoundary(address(executor));

        vm.prank(address(0xBAD));
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        proxy.upgradeToAndCall(address(replacement), bytes(""));

        vm.prank(OWNER);
        vm.expectRevert(ICeloSettlementExecutor.ExecutorMustBePaused.selector);
        proxy.upgradeToAndCall(address(replacement), bytes(""));

        vm.prank(OWNER);
        executor.setPaused(true);

        ExecutorMockRouter otherRouter = new ExecutorMockRouter();
        CeloSettlementExecutor wrongRouter = new CeloSettlementExecutor(address(otherRouter), address(token));
        vm.prank(OWNER);
        vm.expectRevert(
            abi.encodeWithSelector(
                ICeloSettlementExecutor.ImmutableRouterMismatch.selector, address(router), address(otherRouter)
            )
        );
        proxy.upgradeToAndCall(address(wrongRouter), bytes(""));

        CeloSettlementExecutor wrongToken = new CeloSettlementExecutor(address(router), address(0xBAD0));
        vm.prank(OWNER);
        vm.expectRevert(
            abi.encodeWithSelector(
                ICeloSettlementExecutor.ImmutableGdollarMismatch.selector, address(token), address(0xBAD0)
            )
        );
        proxy.upgradeToAndCall(address(wrongToken), bytes(""));
    }

    function testExecutorUpgradeAndRollbackPreserveState() public {
        CeloSettlementExecutor replacement = new CeloSettlementExecutor(address(router), address(token));
        CeloSettlementExecutor rollback = new CeloSettlementExecutor(address(router), address(token));
        ICeloUUPSUpgradeBoundary proxy = ICeloUUPSUpgradeBoundary(address(executor));

        vm.prank(OWNER);
        executor.setPaused(true);
        vm.prank(OWNER);
        proxy.upgradeToAndCall(address(replacement), bytes(""));
        vm.prank(OWNER);
        proxy.upgradeToAndCall(address(rollback), bytes(""));

        assertEq(executor.CCIP_ROUTER(), address(router));
        assertEq(executor.G_DOLLAR_TOKEN(), address(token));
        assertEq(executor.sourcePeer().sourceSettlementModule, SOURCE_MODULE);
        assertEq(executor.gardenRouteOf(GARDEN).safe, address(payerSafe));
        assertTrue(executor.paused());
    }

    function testSelfOnlyBatchExecutionRejectsExternalCaller() public {
        ICeloSettlementExecutor.GardenRoute memory route = executor.gardenRouteOf(GARDEN);
        vm.expectRevert(ICeloSettlementExecutor.InvalidCcipSender.selector);
        CeloSettlementExecutor(payable(address(executor))).executeGdollarSettlementBatch(
            route, _one(CONTRIBUTOR), _oneAmount(1 ether), _oneAmount(0), 10_000 ether, 1 ether
        );
    }

    function testFuzzTransferCapAllowsEveryPositiveBoundedAmount(uint96 rawAmount) public {
        uint256 amount = bound(uint256(rawAmount), 1, 1000 ether);
        router.deliver(
            address(executor),
            keccak256(abi.encode("bounded-transfer", amount)),
            SOURCE_SELECTOR,
            SOURCE_MODULE,
            _command(false, 28, 0, 0, _one(CONTRIBUTOR), _oneAmount(amount))
        );
        assertEq(
            uint8(executor.executionResultOf(_executionKey(false, 28, 0)).failureCode),
            uint8(ICeloSettlementExecutor.FailureCode.None)
        );
        assertEq(token.balanceOf(CONTRIBUTOR), amount);
    }

    function invariantPeriodSpendNeverExceedsConfiguredCap() public {
        assertLe(executor.gardenPeriodSpend(GARDEN).amount, executor.maxPeriodAmount());
    }

    function _deliverWithDeferredAcknowledgment(uint256 settlementId, string memory salt) internal returns (bytes32 key) {
        router.deliver(
            address(executor),
            keccak256(bytes(salt)),
            SOURCE_SELECTOR,
            SOURCE_MODULE,
            _command(false, settlementId, 0, 0, _one(CONTRIBUTOR), _oneAmount(10 ether))
        );
        key = _executionKey(false, settlementId, 0);
    }

    function _deliver(uint256 settlementId, address recipient, uint256 amount) internal {
        router.deliver(
            address(executor),
            keccak256(abi.encode(settlementId, recipient, amount)),
            SOURCE_SELECTOR,
            SOURCE_MODULE,
            _command(false, settlementId, 0, 0, _one(recipient), _oneAmount(amount))
        );
    }

    function _executionKey(bool isBatch, uint256 settlementId, uint32 attempt) internal pure returns (bytes32) {
        return keccak256(abi.encode(SOURCE_SELECTOR, SOURCE_MODULE, isBatch, settlementId, attempt));
    }

    function _recipients(uint256 count) internal pure returns (address[] memory values) {
        values = new address[](count);
        for (uint256 index; index < count; ++index) {
            values[index] = address(uint160(0x4000 + index));
        }
    }

    function _amounts(uint256 count, uint256 amount) internal pure returns (uint256[] memory values) {
        values = new uint256[](count);
        for (uint256 index; index < count; ++index) {
            values[index] = amount;
        }
    }
}
