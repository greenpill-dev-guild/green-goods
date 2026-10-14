// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICeloSettlementExecutor } from "../../src/interfaces/ICeloSettlementExecutor.sol";
import { SettlementMessageCodec } from "../../src/libraries/SettlementMessageCodec.sol";
import { CeloSettlementExecutor } from "../../src/modules/CeloSettlementExecutor.sol";
import {
    CeloSettlementExecutorTest,
    ExecutorMockGoodDollar,
    ExecutorMockRoles,
    ExecutorMockRouter,
    ExecutorMockSafe
} from "./CeloSettlementExecutor.t.sol";

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

    function testCeloSettlementExecutor_secondRotationCannotDiscardLivePreviousPeer() public {
        address secondReplacement = address(0xD00D);
        vm.startPrank(OWNER);
        executor.setPaused(true);
        executor.setSourcePeer(REPLACEMENT_SOURCE, 1, 1 days);
        ICeloSettlementExecutor.SourcePeer memory rotated = executor.sourcePeer();
        vm.expectRevert(
            abi.encodeWithSelector(
                ICeloSettlementExecutor.PreviousPeerGraceActive.selector, SOURCE_MODULE, rotated.previousPeerExpiresAt
            )
        );
        executor.setSourcePeer(secondReplacement, 1, 1 days);
        executor.setPaused(false);
        vm.stopPrank();

        router.deliver(
            address(executor),
            keccak256("first-source-still-graced"),
            SOURCE_SELECTOR,
            SOURCE_MODULE,
            _command(false, 14, 0, 0, _one(CONTRIBUTOR), _oneAmount(100 ether))
        );
        assertEq(token.balanceOf(CONTRIBUTOR), 100 ether);

        vm.warp(rotated.previousPeerExpiresAt + 1);
        vm.startPrank(OWNER);
        executor.setPaused(true);
        executor.setSourcePeer(secondReplacement, 1, 1 days);
        vm.stopPrank();
        assertEq(executor.sourcePeer().previousSourceSettlementModule, REPLACEMENT_SOURCE);
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

    function testAdminConfigurationRejectsEveryUnsafeShape() public {
        vm.prank(OWNER);
        executor.setPaused(true);

        vm.startPrank(OWNER);
        vm.expectRevert(ICeloSettlementExecutor.ZeroAddress.selector);
        executor.configureGardenRoute(
            address(0), address(payerSafe), address(payerRoles), ROLE_KEY, ALLOWANCE_KEY, keccak256("zero-garden")
        );

        vm.expectRevert(abi.encodeWithSelector(ICeloSettlementExecutor.GardenRouteAlreadyConfigured.selector, GARDEN));
        executor.configureGardenRoute(
            GARDEN, address(payerSafe), address(payerRoles), ROLE_KEY, ALLOWANCE_KEY, keccak256("duplicate-garden")
        );

        address anotherGarden = address(0x1001);
        vm.expectRevert(
            abi.encodeWithSelector(ICeloSettlementExecutor.SafeAlreadyAssigned.selector, address(payerSafe), GARDEN)
        );
        executor.configureGardenRoute(
            anotherGarden, address(payerSafe), address(payerRoles), ROLE_KEY, ALLOWANCE_KEY, keccak256("duplicate-safe")
        );

        vm.expectRevert(ICeloSettlementExecutor.PolicyNotConfigured.selector);
        executor.configureGardenRoute(
            anotherGarden, address(0x1111), address(0x2222), ROLE_KEY, ALLOWANCE_KEY, keccak256("missing-code")
        );

        ExecutorMockSafe unconfiguredSafe = new ExecutorMockSafe();
        ExecutorMockGoodDollar otherToken = new ExecutorMockGoodDollar();
        ExecutorMockRoles unconfiguredRoles = new ExecutorMockRoles(address(unconfiguredSafe), otherToken);
        vm.expectRevert(ICeloSettlementExecutor.PolicyNotConfigured.selector);
        executor.configureGardenRoute(
            anotherGarden,
            address(unconfiguredSafe),
            address(unconfiguredRoles),
            ROLE_KEY,
            ALLOWANCE_KEY,
            keccak256("disabled-role")
        );

        vm.expectRevert(ICeloSettlementExecutor.PolicyNotConfigured.selector);
        executor.setGardenRouteActive(address(0x9999), false);

        vm.expectRevert(ICeloSettlementExecutor.ZeroAddress.selector);
        executor.setSourcePeer(address(0), 1, 0);
        vm.expectRevert(ICeloSettlementExecutor.UnsupportedMessageVersion.selector);
        executor.setSourcePeer(SOURCE_MODULE, 0, 0);
        vm.expectRevert(ICeloSettlementExecutor.PolicyNotConfigured.selector);
        executor.setSourcePeer(SOURCE_MODULE, 1, 31 days);
        vm.expectRevert(ICeloSettlementExecutor.PolicyNotConfigured.selector);
        executor.setSourcePeer(SOURCE_MODULE, 1, 1 days);

        executor.setSourcePeer(REPLACEMENT_SOURCE, 1, 2 days);
        vm.expectRevert(ICeloSettlementExecutor.PolicyNotConfigured.selector);
        executor.setSourcePeer(REPLACEMENT_SOURCE, 1, 1 days);

        uint16 overHardBatchSize = uint16(executor.HARD_MAX_BATCH_SIZE() + 1);
        vm.expectRevert(ICeloSettlementExecutor.PolicyNotConfigured.selector);
        executor.setCaps(overHardBatchSize, 1000 ether, 4000 ether);
        vm.expectRevert(ICeloSettlementExecutor.PolicyNotConfigured.selector);
        executor.setCaps(4, 2 ether, 1 ether);
        vm.expectRevert(abi.encodeWithSelector(ICeloSettlementExecutor.InvalidFeePolicy.selector, uint16(10_001), 1));
        executor.setFeePolicy(10_001, 1);

        executor.setCaps(4, 0, 4000 ether);
        vm.expectRevert(ICeloSettlementExecutor.ExecutorNotReady.selector);
        executor.setPaused(false);
        vm.stopPrank();
    }

    function testAuthenticationAndCommandEnvelopeFailClosed() public {
        bytes memory valid = _command(false, 40, 0, 0, _one(CONTRIBUTOR), _oneAmount(1 ether));

        vm.prank(OWNER);
        executor.setPaused(true);
        vm.expectRevert(ICeloSettlementExecutor.ExecutorMustBePaused.selector);
        router.deliver(address(executor), keccak256("paused"), SOURCE_SELECTOR, SOURCE_MODULE, valid);
        vm.prank(OWNER);
        executor.setPaused(false);

        vm.expectRevert(ICeloSettlementExecutor.InvalidCcipSource.selector);
        router.deliver(address(executor), keccak256("wrong-source"), SOURCE_SELECTOR + 1, SOURCE_MODULE, valid);

        vm.expectRevert(ICeloSettlementExecutor.CcipTokensNotAllowed.selector);
        router.deliverWithToken(address(executor), keccak256("tokens"), SOURCE_SELECTOR, SOURCE_MODULE, valid);

        bytes memory wrongVersion =
            SettlementMessageCodec.encodeCommand(2, 41, false, 0, GARDEN, 0, _one(CONTRIBUTOR), _oneAmount(1 ether));
        vm.expectRevert(ICeloSettlementExecutor.UnsupportedMessageVersion.selector);
        router.deliver(address(executor), keccak256("wrong-version"), SOURCE_SELECTOR, SOURCE_MODULE, wrongVersion);

        bytes memory unknownKind =
            SettlementMessageCodec.encodeCommand(1, 42, false, 0, GARDEN, 5, _one(CONTRIBUTOR), _oneAmount(1 ether));
        vm.expectRevert(ICeloSettlementExecutor.MalformedSettlementCommand.selector);
        router.deliver(address(executor), keccak256("unknown-kind"), SOURCE_SELECTOR, SOURCE_MODULE, unknownKind);
    }

    function testPreflightAndExecutionFailuresAreStoredWithoutValueLeakage() public {
        address[] memory emptyRecipients = new address[](0);
        uint256[] memory emptyAmounts = new uint256[](0);
        _deliverAndAssertFailure(
            50, false, _one(CONTRIBUTOR), emptyAmounts, ICeloSettlementExecutor.FailureCode.BatchSizeExceeded
        );
        _deliverAndAssertFailure(
            51, false, emptyRecipients, emptyAmounts, ICeloSettlementExecutor.FailureCode.BatchSizeExceeded
        );
        _deliverAndAssertFailure(
            52, false, _recipients(2), _amounts(2, 1 ether), ICeloSettlementExecutor.FailureCode.BatchSizeExceeded
        );
        _deliverAndAssertFailure(
            53, false, _one(address(0)), _oneAmount(1 ether), ICeloSettlementExecutor.FailureCode.InvalidRecipient
        );
        _deliverAndAssertFailure(
            54, false, _one(address(payerSafe)), _oneAmount(1 ether), ICeloSettlementExecutor.FailureCode.InvalidRecipient
        );

        address[] memory duplicates = new address[](2);
        duplicates[0] = CONTRIBUTOR;
        duplicates[1] = CONTRIBUTOR;
        _deliverAndAssertFailure(
            55, true, duplicates, _amounts(2, 1 ether), ICeloSettlementExecutor.FailureCode.InvalidRecipient
        );
        _deliverAndAssertFailure(
            56, false, _one(address(0x3056)), _oneAmount(0), ICeloSettlementExecutor.FailureCode.TransferAmountExceeded
        );

        vm.startPrank(OWNER);
        executor.setPaused(true);
        executor.setCaps(4, 50 ether, 50 ether);
        executor.setPaused(false);
        vm.stopPrank();
        _deliverAndAssertFailure(
            57, true, _recipients(2), _amounts(2, 30 ether), ICeloSettlementExecutor.FailureCode.BatchAmountExceeded
        );

        address unreadableRecipient = address(0x3058);
        token.setBalanceReadFailure(unreadableRecipient, true);
        _deliverAndAssertFailure(
            58, false, _one(unreadableRecipient), _oneAmount(1 ether), ICeloSettlementExecutor.FailureCode.RouteReverted
        );
        token.setBalanceReadFailure(unreadableRecipient, false);

        payerRoles.setExecutionBehavior(true, false);
        _deliverAndAssertFailure(
            59, false, _one(address(0x3059)), _oneAmount(1 ether), ICeloSettlementExecutor.FailureCode.RouteRejected
        );

        payerRoles.setExecutionBehavior(false, true);
        _deliverAndAssertFailure(
            60, false, _one(address(0x3060)), _oneAmount(1 ether), ICeloSettlementExecutor.FailureCode.BalanceDeltaMismatch
        );

        payerRoles.setExecutionBehavior(false, false);
        token.setSkipDebit(true);
        _deliverAndAssertFailure(
            61, false, _one(address(0x3061)), _oneAmount(1 ether), ICeloSettlementExecutor.FailureCode.BalanceDeltaMismatch
        );
    }

    function testDuplicateRetriesPreviouslyDeferredAcknowledgment() public {
        router.setFee(1);
        bytes memory payload = _command(false, 62, 0, 0, _one(CONTRIBUTOR), _oneAmount(1 ether));
        router.deliver(address(executor), keccak256("deferred-first"), SOURCE_SELECTOR, SOURCE_MODULE, payload);
        bytes32 key = _executionKey(false, 62, 0);
        assertFalse(executor.executionResultOf(key).acknowledgmentSent);

        router.deliver(address(executor), keccak256("deferred-duplicate"), SOURCE_SELECTOR, SOURCE_MODULE, payload);
        assertFalse(executor.executionResultOf(key).acknowledgmentSent);
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
        CeloSettlementExecutor replacement =
            new CeloSettlementExecutor(address(router), address(token), CELO_SELECTOR, SOURCE_EVM_CHAIN_ID);
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
        CeloSettlementExecutor wrongRouter =
            new CeloSettlementExecutor(address(otherRouter), address(token), CELO_SELECTOR, SOURCE_EVM_CHAIN_ID);
        vm.prank(OWNER);
        vm.expectRevert(
            abi.encodeWithSelector(
                ICeloSettlementExecutor.ImmutableRouterMismatch.selector, address(router), address(otherRouter)
            )
        );
        proxy.upgradeToAndCall(address(wrongRouter), bytes(""));

        CeloSettlementExecutor wrongToken =
            new CeloSettlementExecutor(address(router), address(0xBAD0), CELO_SELECTOR, SOURCE_EVM_CHAIN_ID);
        vm.prank(OWNER);
        vm.expectRevert(
            abi.encodeWithSelector(
                ICeloSettlementExecutor.ImmutableGdollarMismatch.selector, address(token), address(0xBAD0)
            )
        );
        proxy.upgradeToAndCall(address(wrongToken), bytes(""));

        CeloSettlementExecutor wrongLocalSelector =
            new CeloSettlementExecutor(address(router), address(token), CELO_SELECTOR + 1, SOURCE_EVM_CHAIN_ID);
        vm.prank(OWNER);
        vm.expectRevert(
            abi.encodeWithSelector(
                ICeloSettlementExecutor.ImmutableLocalChainSelectorMismatch.selector, CELO_SELECTOR, CELO_SELECTOR + 1
            )
        );
        proxy.upgradeToAndCall(address(wrongLocalSelector), bytes(""));

        CeloSettlementExecutor wrongSourceChain =
            new CeloSettlementExecutor(address(router), address(token), CELO_SELECTOR, SOURCE_EVM_CHAIN_ID + 1);
        vm.prank(OWNER);
        vm.expectRevert(
            abi.encodeWithSelector(
                ICeloSettlementExecutor.ImmutableSourceEvmChainIdMismatch.selector,
                SOURCE_EVM_CHAIN_ID,
                SOURCE_EVM_CHAIN_ID + 1
            )
        );
        proxy.upgradeToAndCall(address(wrongSourceChain), bytes(""));
    }

    function testExecutorUpgradeAndRollbackPreserveState() public {
        CeloSettlementExecutor replacement =
            new CeloSettlementExecutor(address(router), address(token), CELO_SELECTOR, SOURCE_EVM_CHAIN_ID);
        CeloSettlementExecutor rollback =
            new CeloSettlementExecutor(address(router), address(token), CELO_SELECTOR, SOURCE_EVM_CHAIN_ID);
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
        CeloSettlementExecutor(payable(address(executor)))
            .executeGdollarSettlementBatch(
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

    function _deliverAndAssertFailure(
        uint256 settlementId,
        bool isBatch,
        address[] memory recipients,
        uint256[] memory amounts,
        ICeloSettlementExecutor.FailureCode expected
    )
        internal
    {
        router.deliver(
            address(executor),
            keccak256(abi.encode("failure", settlementId)),
            SOURCE_SELECTOR,
            SOURCE_MODULE,
            _command(isBatch, settlementId, 0, 0, recipients, amounts)
        );
        assertEq(uint8(executor.executionResultOf(_executionKey(isBatch, settlementId, 0)).failureCode), uint8(expected));
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
