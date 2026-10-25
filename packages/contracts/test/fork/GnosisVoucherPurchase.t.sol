// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Vm } from "forge-std/Vm.sol";
import { ICLCSwapPool } from "../../src/interfaces/ICLCSwapPool.sol";
import { ICLCERC1967Factory } from "../../src/interfaces/ICLCGiftableToken.sol";
import { CLCPurchaseFixture } from "../helpers/CLCPurchaseFixture.sol";
import { ICLCPurchasePool } from "../helpers/CLCPurchaseInterfaces.sol";

/// @notice Direct purchases against pinned CLC code and actual WXDAI, with fictional local terms.
/// @dev No CCIP, Arbitrum entitlement, service discharge or live fund movement is involved.
contract GnosisVoucherPurchaseForkTest is CLCPurchaseFixture {
    bytes32 private constant SWAP_SETTLEMENT_TOPIC =
        keccak256("SwapSettlement(address,address,address,uint256,uint256,uint256,uint256,uint256,uint256)");
    bytes32 private constant TRANSFER_TOPIC = keccak256("Transfer(address,address,uint256)");

    function setUp() public virtual {
        _selectGnosisForkAndCheckImplementations();
        _initializePurchaseFixture();
    }

    function testGnosisVoucherPurchase_sponsorPaysAndNamedLearnerReceivesBoundedPurchaseReceipt() public {
        _approvePurchase(_primary.pool, _payer, INPUT);
        PurchaseBalances memory beforeState = _balances(_primary.pool, _payer, _learner);
        assertEq(ICLCSwapPool.withdraw.selector, bytes4(0x909a6e32), "consumer must use bounded purchase selector");
        vm.expectCall(
            address(_primary.pool),
            abi.encodeCall(
                ICLCSwapPool.withdraw, (address(_voucher), address(_wxdai), INPUT, _learner, OUTPUT, block.timestamp)
            )
        );
        vm.recordLogs();
        uint256 received = _purchase(_primary.pool, _payer, _learner, INPUT, OUTPUT, block.timestamp);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        assertEq(received, OUTPUT);
        assertEq(_wxdai.balanceOf(_payer), beforeState.payerPayment - INPUT);
        assertEq(_wxdai.balanceOf(address(_primary.pool)), INPUT);
        assertEq(_voucher.balanceOf(_payer), 0, "sponsor is not the learner");
        assertEq(_voucher.balanceOf(_learner), OUTPUT);
        assertEq(_voucher.balanceOf(_protocolFeeRecipient), PROTOCOL_FEE);
        assertEq(_primary.pool.fees(address(_voucher)), POOL_FEE);
        assertEq(GROSS, OUTPUT + POOL_FEE + PROTOCOL_FEE);
        assertEq(_voucher.balanceOf(address(_primary.pool)) + OUTPUT + PROTOCOL_FEE, INVENTORY);
        assertEq(_voucher.totalSupply(), beforeState.voucherSupply);
        _assertReceipt(logs);
    }

    function testGnosisVoucherPurchase_callerCanBeTheNamedLearner() public {
        _fundBuyer(_learner, INPUT);
        _approvePurchase(_primary.pool, _learner, INPUT);
        assertEq(_purchase(_primary.pool, _learner, _learner, INPUT, OUTPUT, block.timestamp), OUTPUT);
        assertEq(_wxdai.balanceOf(_learner), 0);
        assertEq(_voucher.balanceOf(_learner), OUTPUT);
        assertEq(_wxdai.balanceOf(_payer), 100 ether, "another sponsor must not be charged");
    }

    function testGnosisVoucherPurchase_consumedFiniteAllowancePreventsAnotherSpendUntilPayerApproves() public {
        _approvePurchase(_primary.pool, _payer, INPUT);
        _purchase(_primary.pool, _payer, _learner, INPUT, OUTPUT, block.timestamp);
        assertEq(_wxdai.allowance(_payer, address(_primary.pool)), 0);
        PurchaseBalances memory afterFirst = _balances(_primary.pool, _payer, _learner);
        // WXDAI's transferFrom reverts with empty data when the allowance falls short.
        vm.expectRevert(bytes(""));
        _purchase(_primary.pool, _payer, _learner, INPUT, OUTPUT, block.timestamp);
        _assertUnchanged(afterFirst, _primary.pool, _payer, _learner);

        // A fresh approval authorizes a second purchase; this pool has no once-only purchase ID.
        _approvePurchase(_primary.pool, _payer, INPUT);
        _purchase(_primary.pool, _payer, _learner, INPUT, OUTPUT, block.timestamp);
        assertEq(_voucher.balanceOf(_learner), OUTPUT * 2);
    }

    function testGnosisVoucherPurchase_revokedAndInsufficientAllowancesRequirePayerRepair() public {
        _approvePurchase(_primary.pool, _payer, INPUT);
        _approvePurchase(_primary.pool, _payer, 0);
        PurchaseBalances memory revoked = _balances(_primary.pool, _payer, _learner);
        // WXDAI's transferFrom reverts with empty data for a revoked or short allowance.
        vm.expectRevert(bytes(""));
        _purchase(_primary.pool, _payer, _learner, INPUT, OUTPUT, block.timestamp);
        _assertUnchanged(revoked, _primary.pool, _payer, _learner);

        _approvePurchase(_primary.pool, _payer, INPUT - 1);
        PurchaseBalances memory insufficient = _balances(_primary.pool, _payer, _learner);
        vm.expectRevert(bytes(""));
        _purchase(_primary.pool, _payer, _learner, INPUT, OUTPUT, block.timestamp);
        _assertUnchanged(insufficient, _primary.pool, _payer, _learner);
        _approvePurchase(_primary.pool, _payer, INPUT);
        assertEq(_purchase(_primary.pool, _payer, _learner, INPUT, OUTPUT, block.timestamp), OUTPUT);
    }

    function testGnosisVoucherPurchase_exhaustedPaymentBalanceCanBeRepairedByLocalWrapping() public {
        vm.prank(_payer);
        _wxdai.transfer(_attacker, 100 ether);
        _approvePurchase(_primary.pool, _payer, INPUT);
        PurchaseBalances memory beforeState = _balances(_primary.pool, _payer, _learner);
        // WXDAI's transferFrom reverts with empty data when the balance falls short.
        vm.expectRevert(bytes(""));
        _purchase(_primary.pool, _payer, _learner, INPUT, OUTPUT, block.timestamp);
        _assertUnchanged(beforeState, _primary.pool, _payer, _learner);
        _fundBuyer(_payer, INPUT);
        assertEq(_purchase(_primary.pool, _payer, _learner, INPUT, OUTPUT, block.timestamp), OUTPUT);
    }

    function testGnosisVoucherPurchase_minimumOutputFailureRevertsAllTransfersAndFees() public {
        _approvePurchase(_primary.pool, _payer, INPUT);
        PurchaseBalances memory beforeState = _balances(_primary.pool, _payer, _learner);
        vm.expectRevert(ICLCSwapPool.InsufficientOutput.selector);
        _purchase(_primary.pool, _payer, _learner, INPUT, OUTPUT + 1, block.timestamp);
        _assertUnchanged(beforeState, _primary.pool, _payer, _learner);
    }

    function testGnosisVoucherPurchase_staleQuoteFailsThenExplicitCurrentMinimumAllowsRepair() public {
        uint256 staleQuote = _primary.pool.getAmountOut(address(_voucher), address(_wxdai), INPUT);
        assertEq(staleQuote, OUTPUT);
        vm.prank(_communitySafeStandIn);
        _primary.quoter.setPriceIndexValue(address(_voucher), 4_000_000);
        _approvePurchase(_primary.pool, _payer, INPUT);
        PurchaseBalances memory beforeState = _balances(_primary.pool, _payer, _learner);
        vm.expectRevert(ICLCSwapPool.InsufficientOutput.selector);
        _purchase(_primary.pool, _payer, _learner, INPUT, staleQuote, block.timestamp);
        _assertUnchanged(beforeState, _primary.pool, _payer, _learner);
        assertEq(_purchase(_primary.pool, _payer, _learner, INPUT, 2_445_000, block.timestamp), 2_445_000);
    }

    function testGnosisVoucherPurchase_changedFeeCannotDefeatThePayersMinimum() public {
        _approvePurchase(_primary.pool, _payer, INPUT);
        vm.prank(_communitySafeStandIn);
        _primary.feePolicy.setDefaultFee(100_000);
        PurchaseBalances memory beforeState = _balances(_primary.pool, _payer, _learner);
        vm.expectRevert(ICLCSwapPool.InsufficientOutput.selector);
        _purchase(_primary.pool, _payer, _learner, INPUT, OUTPUT, block.timestamp);
        _assertUnchanged(beforeState, _primary.pool, _payer, _learner);
        assertEq(_purchase(_primary.pool, _payer, _learner, INPUT, 4_450_000, block.timestamp), 4_450_000);
    }

    function testGnosisVoucherPurchase_atDeadlineSucceedsAndOneSecondAfterReverts() public {
        _approvePurchase(_primary.pool, _payer, INPUT * 2);
        // A fixed value avoids optimizer assumptions that block.timestamp is constant
        // within this test transaction despite the warp cheatcode.
        uint256 deadline = 1_900_000_000;
        vm.warp(deadline);
        assertEq(_purchase(_primary.pool, _payer, _learner, INPUT, OUTPUT, deadline), OUTPUT);
        vm.warp(deadline + 1);
        PurchaseBalances memory beforeState = _balances(_primary.pool, _payer, _learner);
        vm.expectRevert(ICLCSwapPool.Expired.selector);
        _purchase(_primary.pool, _payer, _learner, INPUT, OUTPUT, deadline);
        _assertUnchanged(beforeState, _primary.pool, _payer, _learner);
    }

    function testGnosisVoucherPurchase_zeroLearnerCannotConsumePayment() public {
        _approvePurchase(_primary.pool, _payer, INPUT);
        PurchaseBalances memory beforeState = _balances(_primary.pool, _payer, _learner);
        vm.expectRevert(ICLCSwapPool.InvalidRecipient.selector);
        _purchase(_primary.pool, _payer, address(0), INPUT, OUTPUT, block.timestamp);
        _assertUnchanged(beforeState, _primary.pool, _payer, _learner);
    }

    function testGnosisVoucherPurchase_sameInputAndOutputAssetIsRejected() public {
        _approvePurchase(_primary.pool, _payer, INPUT);
        PurchaseBalances memory beforeState = _balances(_primary.pool, _payer, _learner);
        vm.prank(_payer);
        vm.expectRevert(ICLCSwapPool.InvalidToken.selector);
        _primary.pool.withdraw(address(_wxdai), address(_wxdai), INPUT, _learner, 1, block.timestamp);
        _assertUnchanged(beforeState, _primary.pool, _payer, _learner);
    }

    function testGnosisVoucherPurchase_delistedInputRequiresCommunityRelisting() public {
        _assertDelistAndRepair(address(_wxdai));
    }

    function testGnosisVoucherPurchase_delistedOutputRequiresCommunityRelisting() public {
        _assertDelistAndRepair(address(_voucher));
    }

    function testGnosisVoucherPurchase_exactInputHoldingLimitSucceedsAndOneMoreUnitFails() public {
        vm.prank(_communitySafeStandIn);
        _primary.limiter.setLimitFor(address(_wxdai), address(_primary.pool), INPUT);
        _approvePurchase(_primary.pool, _payer, INPUT + 1);
        _purchase(_primary.pool, _payer, _learner, INPUT, OUTPUT, block.timestamp);
        assertEq(_wxdai.balanceOf(address(_primary.pool)), INPUT);
        PurchaseBalances memory beforeState = _balances(_primary.pool, _payer, _learner);
        vm.expectRevert(ICLCSwapPool.LimitExceeded.selector);
        _purchase(_primary.pool, _payer, _learner, 1, 0, block.timestamp);
        _assertUnchanged(beforeState, _primary.pool, _payer, _learner);
    }

    function testGnosisVoucherPurchase_zeroInputLimitBlocksThenCommunityRepairRestoresPurchase() public {
        vm.prank(_communitySafeStandIn);
        _primary.limiter.setLimitFor(address(_wxdai), address(_primary.pool), 0);
        _approvePurchase(_primary.pool, _payer, INPUT);
        PurchaseBalances memory beforeState = _balances(_primary.pool, _payer, _learner);
        vm.expectRevert(ICLCSwapPool.LimitExceeded.selector);
        _purchase(_primary.pool, _payer, _learner, INPUT, OUTPUT, block.timestamp);
        _assertUnchanged(beforeState, _primary.pool, _payer, _learner);
        vm.prank(_communitySafeStandIn);
        _primary.limiter.setLimitFor(address(_wxdai), address(_primary.pool), 1000 ether);
        assertEq(_purchase(_primary.pool, _payer, _learner, INPUT, OUTPUT, block.timestamp), OUTPUT);
    }

    function testGnosisVoucherPurchase_ownerWithdrawalDepletesInventoryAndIssuerDepositRepairsIt() public {
        vm.prank(_communitySafeStandIn);
        _primary.pool.withdrawLiquidity(address(_voucher), _issuerSafeStandIn, INVENTORY);
        _approvePurchase(_primary.pool, _payer, INPUT);
        PurchaseBalances memory beforeState = _balances(_primary.pool, _payer, _learner);
        vm.expectRevert(ICLCSwapPool.InsufficientBalance.selector);
        _purchase(_primary.pool, _payer, _learner, INPUT, OUTPUT, block.timestamp);
        _assertUnchanged(beforeState, _primary.pool, _payer, _learner);
        _depositInventory(_primary.pool, INVENTORY);
        assertEq(_purchase(_primary.pool, _payer, _learner, INPUT, OUTPUT, block.timestamp), OUTPUT);
        assertEq(_voucher.totalSupply(), INVENTORY, "replenishment reused inventory without minting");
    }

    function testGnosisVoucherPurchase_distinctIssuerAndCommunityAuthoritiesRetainSeparateTimelockedAdmins() public {
        assertEq(_voucher.owner(), _issuerSafeStandIn);
        assertEq(_primary.pool.owner(), _communitySafeStandIn);
        assertEq(_primary.index.owner(), _communitySafeStandIn);
        assertEq(_primary.limiter.owner(), _communitySafeStandIn);
        assertEq(_primary.quoter.owner(), _communitySafeStandIn);
        assertEq(_primary.feePolicy.owner(), _communitySafeStandIn);
        assertEq(_primary.protocolFee.owner(), _communitySafeStandIn);
        assertEq(_issuerUpgradeTimelock.getMinDelay(), 0);
        assertEq(_communityUpgradeTimelock.getMinDelay(), 0);
        assertTrue(address(_issuerUpgradeTimelock) != address(_communityUpgradeTimelock));
        assertEq(ICLCERC1967Factory(CLC_FACTORY).adminOf(address(_voucher)), address(_issuerUpgradeTimelock));
        address[6] memory communityInstances = [
            address(_primary.pool),
            address(_primary.index),
            address(_primary.limiter),
            address(_primary.quoter),
            address(_primary.feePolicy),
            address(_primary.protocolFee)
        ];
        for (uint256 i; i < communityInstances.length; ++i) {
            assertEq(ICLCERC1967Factory(CLC_FACTORY).adminOf(communityInstances[i]), address(_communityUpgradeTimelock));
        }
        assertFalse(_voucher.isWriter(_communitySafeStandIn));
        assertFalse(_primary.limiter.isWriter(_issuerSafeStandIn));
        vm.prank(_communitySafeStandIn);
        vm.expectRevert(bytes4(keccak256("Unauthorized()")));
        _voucher.mintTo(_attacker, 1);
        vm.prank(_attacker);
        vm.expectRevert(bytes4(keccak256("Unauthorized()")));
        _primary.quoter.setPriceIndexValue(address(_voucher), 1);
        vm.prank(_attacker);
        vm.expectRevert(bytes4(keccak256("Unauthorized()")));
        _primary.pool.withdrawLiquidity(address(_voucher), _attacker, 1);
        assertEq(_voucher.totalSupply(), INVENTORY);
    }

    function testGnosisVoucherPurchase_sealedQuoterPointerStillPermitsOwnedQuoterPriceChanges() public {
        assertTrue(_primary.pool.isSealed(31));
        assertEq(_primary.pool.quoter(), address(_primary.quoter));
        vm.prank(_communitySafeStandIn);
        vm.expectRevert(ICLCSwapPool.Sealed.selector);
        _primary.pool.setQuoter(_attacker);
        vm.prank(_communitySafeStandIn);
        _primary.quoter.setPriceIndexValue(address(_voucher), 4_000_000);
        assertEq(_primary.pool.quoter(), address(_primary.quoter));
        assertEq(_primary.pool.getAmountOut(address(_voucher), address(_wxdai), INPUT), 2_445_000);
    }

    function testGnosisVoucherPurchase_twoPoolsUseIndependentExplicitLocalPrices() public {
        PoolBundle memory second = _createPoolBundle("Other fictional community pool", "OTHERP", 4_000_000);
        assertTrue(address(second.index) != address(_primary.index));
        assertTrue(address(second.limiter) != address(_primary.limiter));
        assertTrue(address(second.quoter) != address(_primary.quoter));
        assertTrue(address(second.feePolicy) != address(_primary.feePolicy));
        assertEq(_primary.pool.getAmountOut(address(_voucher), address(_wxdai), INPUT), OUTPUT);
        assertEq(second.pool.getAmountOut(address(_voucher), address(_wxdai), INPUT), 2_445_000);
        _approvePurchase(_primary.pool, _payer, INPUT);
        _approvePurchase(second.pool, _payer, INPUT);
        _purchase(_primary.pool, _payer, _learner, INPUT, OUTPUT, block.timestamp);
        _purchase(second.pool, _payer, _learner, INPUT, 2_445_000, block.timestamp);
        assertEq(_voucher.balanceOf(_learner), OUTPUT + 2_445_000);
        assertEq(_wxdai.balanceOf(address(_primary.pool)), INPUT);
        assertEq(_wxdai.balanceOf(address(second.pool)), INPUT);
        assertEq(_voucher.totalSupply(), INVENTORY * 2, "only explicit fixture inventory minting changed supply");
    }

    function testGnosisVoucherPurchase_protocolFeeToggleChangesOnlyConfiguredFeeLeg() public {
        vm.prank(_communitySafeStandIn);
        _primary.protocolFee.setActive(false);
        _approvePurchase(_primary.pool, _payer, INPUT);
        assertEq(_purchase(_primary.pool, _payer, _learner, INPUT, GROSS - POOL_FEE, block.timestamp), GROSS - POOL_FEE);
        assertEq(_voucher.balanceOf(_protocolFeeRecipient), 0);
        assertEq(_primary.pool.fees(address(_voucher)), POOL_FEE);
    }

    function testGnosisVoucherPurchase_lateLearnerTransferFailureAlsoRollsBackActualProtocolFeeTransfer() public {
        _approvePurchase(_primary.pool, _payer, INPUT);
        PurchaseBalances memory beforeState = _balances(_primary.pool, _payer, _learner);
        // The actual protocol-fee transfer executes first; only the later learner call is controlled.
        vm.mockCall(
            address(_voucher), abi.encodeWithSelector(_voucher.transfer.selector, _learner, OUTPUT), abi.encode(false)
        );
        vm.expectRevert(ICLCSwapPool.TransferFailed.selector);
        _purchase(_primary.pool, _payer, _learner, INPUT, OUTPUT, block.timestamp);
        _assertUnchanged(beforeState, _primary.pool, _payer, _learner);
        vm.clearMockedCalls();
        assertEq(_purchase(_primary.pool, _payer, _learner, INPUT, OUTPUT, block.timestamp), OUTPUT);
    }

    function testFuzz_GnosisVoucherPurchase_conservesLocalQuoteAndFeesWithoutMinting(uint256 amount) public {
        amount = bound(amount, 1e15, 100 ether);
        uint256 gross = amount / 2e12;
        uint256 poolFee = gross * 20_000 / 1_000_000;
        uint256 protocolFee = poolFee * 100_000 / 1_000_000;
        uint256 expected = gross - poolFee - protocolFee;
        _approvePurchase(_primary.pool, _payer, amount);
        assertEq(_purchase(_primary.pool, _payer, _learner, amount, expected, block.timestamp), expected);
        assertEq(_voucher.balanceOf(_learner), expected);
        assertEq(_voucher.balanceOf(_protocolFeeRecipient), protocolFee);
        assertEq(_primary.pool.fees(address(_voucher)), poolFee);
        assertEq(gross, expected + poolFee + protocolFee);
        assertEq(_voucher.totalSupply(), INVENTORY);
    }

    function _assertDelistAndRepair(address token) private {
        _approvePurchase(_primary.pool, _payer, INPUT);
        vm.prank(_communitySafeStandIn);
        _primary.index.remove(token);
        PurchaseBalances memory beforeState = _balances(_primary.pool, _payer, _learner);
        vm.expectRevert(ICLCSwapPool.UnauthorizedToken.selector);
        _purchase(_primary.pool, _payer, _learner, INPUT, OUTPUT, block.timestamp);
        _assertUnchanged(beforeState, _primary.pool, _payer, _learner);
        vm.prank(_communitySafeStandIn);
        _primary.index.register(token);
        assertEq(_purchase(_primary.pool, _payer, _learner, INPUT, OUTPUT, block.timestamp), OUTPUT);
    }

    function _assertReceipt(Vm.Log[] memory logs) private {
        uint256 settlementCount;
        uint256 learnerTransferCount;
        for (uint256 i; i < logs.length; ++i) {
            Vm.Log memory entry = logs[i];
            if (
                entry.emitter == address(_primary.pool) && entry.topics.length != 0
                    && entry.topics[0] == SWAP_SETTLEMENT_TOPIC
            ) {
                ++settlementCount;
                assertEq(entry.topics.length, 4);
                assertEq(entry.topics[1], bytes32(uint256(uint160(_payer))));
                assertEq(entry.topics[2], bytes32(uint256(uint160(address(_wxdai)))));
                assertEq(entry.topics[3], bytes32(uint256(uint160(address(_voucher)))));
                assertEq(entry.data.length, 192);
                assertEq(keccak256(entry.data), keccak256(abi.encode(INPUT, GROSS, OUTPUT, OUTPUT, POOL_FEE, PROTOCOL_FEE)));
            }
            if (
                entry.emitter == address(_voucher) && entry.topics.length == 3 && entry.topics[0] == TRANSFER_TOPIC
                    && entry.topics[2] == bytes32(uint256(uint160(_learner)))
            ) {
                ++learnerTransferCount;
                assertEq(entry.topics[1], bytes32(uint256(uint160(address(_primary.pool)))));
                assertEq(abi.decode(entry.data, (uint256)), OUTPUT);
            }
        }
        assertEq(settlementCount, 1, "one pool receipt proves the purchase");
        assertEq(learnerTransferCount, 1, "the same receipt binds actual output to the named learner");
    }
}
