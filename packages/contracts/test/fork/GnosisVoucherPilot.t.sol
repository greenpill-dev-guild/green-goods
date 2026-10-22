// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Vm } from "forge-std/Vm.sol";
import { ICLCSwapPool } from "../../src/interfaces/ICLCSwapPool.sol";
import { ICLCERC1967Factory } from "../../src/interfaces/ICLCGiftableToken.sol";
import { ICommitmentPoolingModule as Core } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { VoucherServiceCodec as Codec } from "../../src/libraries/VoucherServiceCodec.sol";
import { VoucherRedemptionModule } from "../../src/modules/VoucherRedemptionModule.sol";
import { GnosisVoucherEscrow } from "../../src/modules/GnosisVoucherEscrow.sol";
import { CLCVoucherPilotFixture } from "../helpers/CLCVoucherPilotFixture.sol";

/// @notice Local pilot against pinned CLC code. Both issuers, terms, prices, service delivery,
///         Safes and transport are fictional. A successful swap/activation is not service proof.
contract GnosisVoucherPilotForkTest is CLCVoucherPilotFixture {
    bytes32 private constant SETTLEMENT_TOPIC =
        keccak256("SwapSettlement(address,address,address,uint256,uint256,uint256,uint256,uint256,uint256)");

    function setUp() public {
        _setUpPilot();
    }

    function testGnosisVoucherPilot_exactTwoVoucherQuoteAndSettlementConserveOneSharedPoolsInventory() public {
        assertTrue(issuerA != _issuerSafeStandIn);
        assertEq(voucherA.owner(), issuerA);
        assertEq(_voucher.owner(), _issuerSafeStandIn);
        assertEq(voucherA.decimals(), 6);
        assertEq(_voucher.decimals(), 6);
        assertEq(_primary.pool.getAmountOut(address(_voucher), address(voucherA), EXCHANGE_INPUT), SERVICE_VOUCHERS);
        _approveExchange(EXCHANGE_INPUT);
        EconomicState memory beforeState = _state();
        vm.recordLogs();
        assertEq(_exchange(SERVICE_VOUCHERS, block.timestamp), SERVICE_VOUCHERS);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 settlements;
        for (uint256 i; i < logs.length; ++i) {
            if (
                logs[i].emitter == address(_primary.pool) && logs[i].topics.length == 4
                    && logs[i].topics[0] == SETTLEMENT_TOPIC
            ) {
                settlements++;
                assertEq(address(uint160(uint256(logs[i].topics[1]))), _learner);
                assertEq(address(uint160(uint256(logs[i].topics[2]))), address(voucherA));
                assertEq(address(uint160(uint256(logs[i].topics[3]))), address(_voucher));
                assertEq(
                    logs[i].data,
                    abi.encode(
                        EXCHANGE_INPUT,
                        EXCHANGE_GROSS,
                        SERVICE_VOUCHERS,
                        SERVICE_VOUCHERS,
                        EXCHANGE_POOL_FEE,
                        EXCHANGE_PROTOCOL_FEE
                    )
                );
            }
        }
        assertEq(settlements, 1);
        assertEq(voucherA.balanceOf(_learner), 0);
        assertEq(voucherA.balanceOf(address(_primary.pool)), beforeState.poolA + EXCHANGE_INPUT);
        assertEq(_voucher.balanceOf(_learner), SERVICE_VOUCHERS);
        assertEq(_voucher.balanceOf(address(_primary.pool)), beforeState.poolB - SERVICE_VOUCHERS - EXCHANGE_PROTOCOL_FEE);
        assertEq(_voucher.balanceOf(_protocolFeeRecipient), EXCHANGE_PROTOCOL_FEE);
        assertEq(_primary.pool.fees(address(_voucher)), EXCHANGE_POOL_FEE);
        assertEq(voucherA.allowance(_learner, address(_primary.pool)), 0);
        assertEq(voucherA.totalSupply(), beforeState.supplyA);
        assertEq(_voucher.totalSupply(), beforeState.supplyB);
    }

    function testGnosisVoucherPilot_existingCorrectVoucherRedeemsDirectlyWithoutPoolSpendOrExchange() public {
        _heldCorrectVoucher();
        EconomicState memory beforeState = _state();
        _prepareService();
        _approveAndDeposit();
        _acceptAndActivate();
        _assertNotExternalDelivery();
        bytes32 decision = _finalize(SERVICE_MINUTES, SERVICE_VOUCHERS, 0);
        escrow.executeFinalLeg(setupId, decision, Codec.FinalLeg.ReleaseToIssuer);
        escrow.executeFinalLeg(setupId, decision, Codec.FinalLeg.RefundToHolder);
        assertEq(voucherA.balanceOf(_learner), beforeState.holderA);
        assertEq(voucherA.balanceOf(address(_primary.pool)), beforeState.poolA);
        assertEq(_voucher.balanceOf(address(_primary.pool)), beforeState.poolB);
        assertEq(voucherA.allowance(_learner, address(_primary.pool)), 0);
        assertEq(_voucher.allowance(_learner, address(_primary.pool)), 0);
        assertEq(_voucher.balanceOf(_issuerSafeStandIn), SERVICE_VOUCHERS);
        assertTrue(escrow.isFinanciallyClosed(setupId));
        assertEq(_voucher.totalSupply(), beforeState.supplyB);
        _assertNotExternalDelivery();
    }

    function testGnosisVoucherPilot_individualRequestEarnsActualVoucherThenRedeemsItsExactWholeService() public {
        uint256 supply = _voucher.totalSupply();
        assertEq(_voucher.balanceOf(_learner), 0);
        bytes32 entitlement = _earnCorrectVoucher();
        assertTrue(entitlement != bytes32(0));
        assertEq(_voucher.balanceOf(_learner), SERVICE_VOUCHERS);
        assertEq(_voucher.balanceOf(_issuerSafeStandIn), 0);
        EconomicState memory afterReward = _state();
        _prepareService();
        _approveAndDeposit();
        _acceptAndActivate();
        _assertNotExternalDelivery();
        bytes32 decision = _finalize(SERVICE_MINUTES, SERVICE_VOUCHERS, 0);
        escrow.executeFinalLeg(setupId, decision, Codec.FinalLeg.ReleaseToIssuer);
        escrow.executeFinalLeg(setupId, decision, Codec.FinalLeg.RefundToHolder);
        assertEq(_voucher.balanceOf(_issuerSafeStandIn), SERVICE_VOUCHERS);
        assertEq(_voucher.balanceOf(_learner), 0);
        assertEq(_voucher.balanceOf(address(escrow)), 0);
        assertEq(_voucher.balanceOf(address(_primary.pool)), afterReward.poolB, "direct redemption needs no exchange");
        assertEq(voucherA.balanceOf(_learner), afterReward.holderA);
        assertEq(voucherA.balanceOf(address(_primary.pool)), afterReward.poolA);
        assertEq(_voucher.totalSupply(), supply);
        assertTrue(escrow.isFinanciallyClosed(setupId));
        _assertNotExternalDelivery();
    }

    function testGnosisVoucherPilot_actualExchangeOutputFundsRealConsentEscrowAcceptanceAndActivation() public {
        _approveExchange(EXCHANGE_INPUT);
        uint256 supplyA = voucherA.totalSupply();
        uint256 supplyB = _voucher.totalSupply();
        _exchange(SERVICE_VOUCHERS, block.timestamp);
        assertEq(_voucher.balanceOf(_learner), SERVICE_VOUCHERS);
        _prepareService();
        vm.chainId(42_161);
        vm.expectRevert(VoucherRedemptionModule.VoucherSetupNotReady.selector);
        vm.prank(CREATOR);
        services.acceptServiceClaim(serviceId, _learner, claimHash);
        assertEq(uint256(module.getCommitment(serviceId).state), uint256(Core.CommitmentState.Offered));
        _approveAndDeposit();
        assertEq(_voucher.balanceOf(_learner), 0);
        assertEq(_voucher.allowance(_learner, address(escrow)), 0);
        _acceptAndActivate();
        _assertNotExternalDelivery();
        assertFalse(_voucher.isWriter(address(source)));
        assertFalse(_voucher.isWriter(address(escrow)));
        bytes32 decision = _finalize(SERVICE_MINUTES, SERVICE_VOUCHERS, 0);
        escrow.executeFinalLeg(setupId, decision, Codec.FinalLeg.ReleaseToIssuer);
        escrow.executeFinalLeg(setupId, decision, Codec.FinalLeg.RefundToHolder);
        assertEq(_voucher.balanceOf(_issuerSafeStandIn), SERVICE_VOUCHERS);
        assertEq(_voucher.balanceOf(address(escrow)), 0);
        assertEq(voucherA.totalSupply(), supplyA);
        assertEq(_voucher.totalSupply(), supplyB);
        _relayResult();
        assertEq(uint256(source.getFinalResult(setupId).release.state), uint256(Codec.LegState.Succeeded));
    }

    function testGnosisVoucherPilot_minimumFailsAtomicallyThenExplicitRepairUsesSamePair() public {
        _approveExchange(EXCHANGE_INPUT);
        EconomicState memory beforeState = _state();
        vm.expectRevert(ICLCSwapPool.InsufficientOutput.selector);
        _exchange(SERVICE_VOUCHERS + 1, block.timestamp);
        _assertSameState(beforeState);
        assertEq(_exchange(SERVICE_VOUCHERS, block.timestamp), SERVICE_VOUCHERS);
    }

    function testGnosisVoucherPilot_expiredDeadlineCannotConsumeEitherVoucher() public {
        _approveExchange(EXCHANGE_INPUT);
        uint256 deadline = 1_900_000_000;
        vm.warp(deadline + 1);
        EconomicState memory beforeState = _state();
        vm.expectRevert(ICLCSwapPool.Expired.selector);
        _exchange(SERVICE_VOUCHERS, deadline);
        _assertSameState(beforeState);
        assertEq(_exchange(SERVICE_VOUCHERS, deadline + 1), SERVICE_VOUCHERS);
    }

    function testGnosisVoucherPilot_feeChangeRequiresExplicitNewMinimumRatherThanSilentRepricing() public {
        _approveExchange(EXCHANGE_INPUT);
        vm.prank(_communitySafeStandIn);
        _primary.feePolicy.setDefaultFee(100_000);
        EconomicState memory beforeState = _state();
        vm.expectRevert(ICLCSwapPool.InsufficientOutput.selector);
        _exchange(SERVICE_VOUCHERS, block.timestamp);
        _assertSameState(beforeState);
        uint256 newMinimum = _primary.pool.getAmountOut(address(_voucher), address(voucherA), EXCHANGE_INPUT);
        assertLt(newMinimum, SERVICE_VOUCHERS);
        assertEq(_exchange(newMinimum, block.timestamp), newMinimum);
        assertLt(_voucher.balanceOf(_learner), SERVICE_VOUCHERS, "discounted output is not full service access");
    }

    function testGnosisVoucherPilot_delistedInputFailsUntilCommunityRelists() public {
        _assertDelisting(address(voucherA));
    }

    function testGnosisVoucherPilot_delistedOutputFailsUntilCommunityRelists() public {
        _assertDelisting(address(_voucher));
    }

    function testGnosisVoucherPilot_poolHoldingLimitIsNotSupplyOrServiceCapacity() public {
        _approveExchange(EXCHANGE_INPUT);
        vm.prank(_communitySafeStandIn);
        _primary.limiter.setLimitFor(address(voucherA), address(_primary.pool), EXCHANGE_INPUT - 1);
        EconomicState memory beforeState = _state();
        vm.expectRevert(ICLCSwapPool.LimitExceeded.selector);
        _exchange(SERVICE_VOUCHERS, block.timestamp);
        _assertSameState(beforeState);
        vm.prank(_communitySafeStandIn);
        _primary.limiter.setLimitFor(address(voucherA), address(_primary.pool), EXCHANGE_INPUT);
        assertEq(_exchange(SERVICE_VOUCHERS, block.timestamp), SERVICE_VOUCHERS);
    }

    function testGnosisVoucherPilot_inventoryWithdrawalFailsAndIssuerReplenishmentRepairsWithoutMinting() public {
        vm.prank(_communitySafeStandIn);
        _primary.pool.withdrawLiquidity(address(_voucher), _issuerSafeStandIn, INVENTORY);
        _approveExchange(EXCHANGE_INPUT);
        EconomicState memory beforeState = _state();
        vm.expectRevert(ICLCSwapPool.InsufficientBalance.selector);
        _exchange(SERVICE_VOUCHERS, block.timestamp);
        _assertSameState(beforeState);
        _depositInventory(_primary.pool, INVENTORY);
        assertEq(_exchange(SERVICE_VOUCHERS, block.timestamp), SERVICE_VOUCHERS);
        assertEq(_voucher.totalSupply(), beforeState.supplyB);
    }

    function testGnosisVoucherPilot_missingInsufficientAndRevokedInputAllowanceNeedHolderRepair() public {
        for (uint256 i; i < 3; ++i) {
            _approveExchange(i == 1 ? EXCHANGE_INPUT - 1 : 0);
            EconomicState memory beforeState = _state();
            vm.expectRevert();
            _exchange(SERVICE_VOUCHERS, block.timestamp);
            _assertSameState(beforeState);
            if (i == 1) _approveExchange(EXCHANGE_INPUT); // subsequently revoked in the next iteration
        }
        _approveExchange(EXCHANGE_INPUT);
        assertEq(_exchange(SERVICE_VOUCHERS, block.timestamp), SERVICE_VOUCHERS);
    }

    function testGnosisVoucherPilot_sharedPoolOwnerCannotMintAnotherIssuersVoucher() public {
        vm.expectRevert();
        vm.prank(_communitySafeStandIn);
        voucherA.mintTo(_learner, 1);
        assertFalse(voucherA.isWriter(address(_primary.pool)));
        assertFalse(_voucher.isWriter(address(_primary.pool)));
        assertEq(_primary.pool.owner(), _communitySafeStandIn);
        assertEq(ICLCERC1967Factory(CLC_FACTORY).adminOf(address(_primary.pool)), address(_communityUpgradeTimelock));
    }

    function testGnosisVoucherPilot_holderInputBalanceShortageIsAtomicAndRequiresExplicitIssuerReturn() public {
        _approveExchange(EXCHANGE_INPUT);
        vm.prank(_learner);
        voucherA.transfer(issuerA, 1);
        EconomicState memory beforeState = _state();
        vm.expectRevert();
        _exchange(SERVICE_VOUCHERS, block.timestamp);
        _assertSameState(beforeState);
        vm.prank(issuerA);
        voucherA.transfer(_learner, 1);
        assertEq(_exchange(SERVICE_VOUCHERS, block.timestamp), SERVICE_VOUCHERS);
        assertEq(voucherA.totalSupply(), beforeState.supplyA);
    }

    function testGnosisVoucherPilot_issuerApprovalAndLostDepositAckCannotBeReplacedByActivationOrTimeout() public {
        _heldCorrectVoucher();
        _prepareService();
        vm.prank(_learner);
        _voucher.approve(address(escrow), SERVICE_VOUCHERS);
        vm.expectRevert();
        vm.prank(_learner);
        escrow.presentSetup(setupId, authorizationHash);
        assertEq(_voucher.balanceOf(_learner), SERVICE_VOUCHERS);
        vm.prank(_issuerSafeStandIn);
        escrow.approveSetupAuthorization(setupId, authorizationHash);
        destinationRouter.configure(0, true, false);
        vm.prank(_learner);
        escrow.presentSetup(setupId, authorizationHash);
        assertEq(_voucher.balanceOf(address(escrow)), SERVICE_VOUCHERS);
        vm.chainId(42_161);
        vm.expectRevert(VoucherRedemptionModule.VoucherSetupNotReady.selector);
        vm.prank(CREATOR);
        services.acceptServiceClaim(serviceId, _learner, claimHash);
        vm.chainId(100);
        vm.expectRevert(GnosisVoucherEscrow.SetupNotActive.selector);
        vm.prank(_learner);
        escrow.finalizeAllocation(setupId, authorizationHash, Codec.FinalAllocation(SERVICE_MINUTES, SERVICE_VOUCHERS, 0));
        destinationRouter.configure(0, false, false);
        escrow.retrySetupAcknowledgment(setupId);
        _relayResult();
        _acceptAndActivate();
        vm.warp(block.timestamp + 31 days);
        assertEq(_voucher.balanceOf(address(escrow)), SERVICE_VOUCHERS);
        assertEq(escrow.getFinalAllocation(setupId).decisionId, bytes32(0));
        _assertNotExternalDelivery();
    }

    function testGnosisVoucherPilot_immutablePartialAllocationRetainsCompletedRefundWhileReleaseRepairs() public {
        _heldCorrectVoucher();
        _prepareService();
        _approveAndDeposit();
        _acceptAndActivate();
        bytes32 decision = _finalize(30, 500_000, 500_000);
        escrow.executeFinalLeg(setupId, decision, Codec.FinalLeg.RefundToHolder);
        assertEq(_voucher.balanceOf(_learner), 500_000);
        vm.prank(guardian);
        escrow.pause();
        escrow.executeFinalLeg(setupId, decision, Codec.FinalLeg.ReleaseToIssuer);
        assertEq(uint256(escrow.getFinalAllocation(setupId).release.state), uint256(Codec.LegState.Failed));
        assertEq(_voucher.balanceOf(_issuerSafeStandIn), 0);
        vm.expectRevert();
        vm.prank(_learner);
        escrow.finalizeAllocation(setupId, authorizationHash, Codec.FinalAllocation(60, SERVICE_VOUCHERS, 0));
        vm.prank(_communitySafeStandIn);
        escrow.unpause();
        escrow.executeFinalLeg(setupId, decision, Codec.FinalLeg.ReleaseToIssuer);
        escrow.executeFinalLeg(setupId, decision, Codec.FinalLeg.RefundToHolder);
        assertEq(_voucher.balanceOf(_learner), 500_000);
        assertEq(_voucher.balanceOf(_issuerSafeStandIn), 500_000);
        assertEq(_voucher.balanceOf(address(escrow)), 0);
        assertEq(escrow.getFinalAllocation(setupId).decisionId, decision);
        assertEq(escrow.getFinalAllocation(setupId).allocation.approvedDeliveredServiceUnits, 30);
        assertTrue(escrow.isFinanciallyClosed(setupId));
        _assertNotExternalDelivery();
    }

    function _assertDelisting(address token) private {
        _approveExchange(EXCHANGE_INPUT);
        vm.prank(_communitySafeStandIn);
        _primary.index.remove(token);
        EconomicState memory beforeState = _state();
        vm.expectRevert(ICLCSwapPool.UnauthorizedToken.selector);
        _exchange(SERVICE_VOUCHERS, block.timestamp);
        _assertSameState(beforeState);
        vm.prank(_communitySafeStandIn);
        _primary.index.register(token);
        assertEq(_exchange(SERVICE_VOUCHERS, block.timestamp), SERVICE_VOUCHERS);
    }
}
