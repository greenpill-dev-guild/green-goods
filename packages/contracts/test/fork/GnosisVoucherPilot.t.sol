// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Vm } from "forge-std/Vm.sol";
import { ICLCSwapPool } from "../../src/interfaces/ICLCSwapPool.sol";
import { ICLCGiftableToken, ICLCERC1967Factory } from "../../src/interfaces/ICLCGiftableToken.sol";
import { ICommitmentPoolingModule as Core } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { VoucherServiceCodec as Codec } from "../../src/libraries/VoucherServiceCodec.sol";
import { VoucherRedemptionModule } from "../../src/modules/VoucherRedemptionModule.sol";
import { GnosisVoucherAdapter } from "../../src/modules/GnosisVoucherAdapter.sol";
import { CLCMemberProjectFixture } from "../helpers/CLCMemberProjectFixture.sol";
import { GnosisVoucherEscrow } from "../../src/modules/GnosisVoucherEscrow.sol";
import { VoucherRedemptionReceiver } from "../../src/modules/VoucherRedemptionReceiver.sol";
import { VoucherEntitlementModule } from "../../src/modules/VoucherEntitlementModule.sol";
import { ICommitmentServiceOffers as Services } from "../../src/interfaces/ICommitmentServiceOffers.sol";
import { ICommitmentVoucherAcceptance as Acceptance } from "../../src/interfaces/ICommitmentVoucherAcceptance.sol";
import { CLCVoucherPilotFixture } from "../helpers/CLCVoucherPilotFixture.sol";
import { CLCVoucherJourneyFixture, IJourneySafe } from "../helpers/CLCVoucherJourneyFixture.sol";

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
            vm.expectRevert(bytes4(keccak256("InsufficientAllowance()")));
            _exchange(SERVICE_VOUCHERS, block.timestamp);
            _assertSameState(beforeState);
            if (i == 1) _approveExchange(EXCHANGE_INPUT); // subsequently revoked in the next iteration
        }
        _approveExchange(EXCHANGE_INPUT);
        assertEq(_exchange(SERVICE_VOUCHERS, block.timestamp), SERVICE_VOUCHERS);
    }

    function testGnosisVoucherPilot_sharedPoolOwnerCannotMintAnotherIssuersVoucher() public {
        vm.expectRevert(bytes4(keccak256("Unauthorized()")));
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
        vm.expectRevert(bytes4(keccak256("InsufficientBalance()")));
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
        vm.expectRevert(VoucherRedemptionReceiver.IssuerApprovalRequired.selector);
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
        vm.expectRevert(GnosisVoucherEscrow.ConflictingFinalAllocation.selector);
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

/// @notice Connected final-candidate economics on separate pinned Arbitrum and Gnosis forks.
/// @dev Published CLC/Hats/Safe runtimes are real; member, Safe signatures, eligibility policy,
///      gardens, evidence and service terms are synthetic. Cross-chain delivery is manually simulated.
contract GnosisVoucherJourneyForkTest is CLCVoucherJourneyFixture {
    function setUp() public {
        _setUpJourney();
    }

    function testGnosisVoucherJourney_verifiedRequestEarnsSwapsAndPartiallyClosesWithFixedRetries() public {
        _exerciseJourneyZeroDelayUpgrade();
        _prepareJourneyReward();
        assertEq(uint256(journeyCore.getCommitment(journeyRequestId).state), uint256(Core.CommitmentState.Fulfilled));
        _dispatchJourneyReward();
        assertFalse(journeyAdapter.getExecutionResult(journeyEntitlement).success);
        assertEq(journeyA.balanceOf(journeyMember), 0);
        assertEq(journeyA.balanceOf(journeyIssuerA), JOURNEY_INVENTORY);
        bytes32 rewardPayload = journeyAdapter.getExecutionResult(journeyEntitlement).payloadHash;
        _relayJourneyReward();
        assertEq(
            uint256(journeyEarned.getDistribution(journeyEntitlement).state),
            uint256(VoucherEntitlementModule.DeliveryState.Failed)
        );
        vm.selectFork(journeyGnosisFork);

        // A single synthetic signer cannot grant reserve spending through the actual 2-of-2 Safe.
        bytes memory grant =
            abi.encodeWithSignature("approve(address,uint256)", address(journeyAdapter), JOURNEY_ADAPTER_ALLOWANCE);
        uint256 safeNonce = IJourneySafe(journeyIssuerA).nonce();
        assertFalse(_safeCall(journeyIssuerA, address(journeyA), grant, true));
        assertEq(IJourneySafe(journeyIssuerA).nonce(), safeNonce);
        assertEq(journeyA.allowance(journeyIssuerA, address(journeyAdapter)), 0);
        _safeExec(journeyIssuerA, address(journeyA), grant);
        _safeExec(
            journeyIssuerA, address(journeyAdapter), abi.encodeWithSignature("safeRetry(bytes32)", journeyEntitlement)
        );
        assertTrue(journeyAdapter.getExecutionResult(journeyEntitlement).success);
        assertEq(journeyAdapter.getExecutionResult(journeyEntitlement).payloadHash, rewardPayload);
        assertEq(journeyA.balanceOf(journeyMember), JOURNEY_REWARD);
        assertEq(journeyA.allowance(journeyIssuerA, address(journeyAdapter)), JOURNEY_ADAPTER_ALLOWANCE - JOURNEY_REWARD);
        // Repair and transport are separate: a successful reserve retry does not silently spend
        // another acknowledgment fee. Explicitly resend its current result (mock fee is zero).
        journeyAdapter.retryAcknowledgment(journeyEntitlement);
        // New transport ID, identical economic authorization: the reserve must never be debited twice.
        _dispatchJourneyReward();
        assertEq(journeyA.balanceOf(journeyMember), JOURNEY_REWARD);
        assertEq(journeyA.balanceOf(journeyIssuerA), 9e6);
        assertEq(journeyA.allowance(journeyIssuerA, address(journeyAdapter)), 9e6);
        _relayJourneyReward();
        assertEq(
            uint256(journeyEarned.getDistribution(journeyEntitlement).state),
            uint256(VoucherEntitlementModule.DeliveryState.Delivered)
        );

        vm.selectFork(journeyGnosisFork);
        assertEq(journeyPool.pool.getAmountOut(address(journeyB), address(journeyA), JOURNEY_REWARD), JOURNEY_REWARD);
        vm.prank(journeyMember);
        journeyA.approve(address(journeyPool.pool), JOURNEY_REWARD);
        vm.prank(journeyMember);
        assertEq(
            journeyPool.pool
                .withdraw(
                    address(journeyB), address(journeyA), JOURNEY_REWARD, journeyMember, JOURNEY_REWARD, block.timestamp
                ),
            JOURNEY_REWARD
        );
        assertEq(journeyA.allowance(journeyMember, address(journeyPool.pool)), 0);
        assertEq(journeyA.balanceOf(address(journeyPool.pool)), 11e6);
        assertEq(journeyB.balanceOf(address(journeyPool.pool)), 9e6);
        assertEq(journeyB.balanceOf(journeyMember), JOURNEY_REWARD);

        _prepareJourneyService();
        vm.prank(journeyMember);
        journeyB.approve(address(journeyEscrow), JOURNEY_REWARD);
        vm.expectRevert(VoucherRedemptionReceiver.IssuerApprovalRequired.selector);
        vm.prank(journeyMember);
        journeyEscrow.presentSetup(journeySetupId, journeyAuthorizationHash);
        assertEq(journeyB.balanceOf(journeyMember), JOURNEY_REWARD);
        _safeExec(
            journeyIssuerB,
            address(journeyEscrow),
            abi.encodeCall(GnosisVoucherEscrow.approveSetupAuthorization, (journeySetupId, journeyAuthorizationHash))
        );
        journeyGnosisRouter.configure(0, true, false);
        vm.prank(journeyMember);
        journeyEscrow.presentSetup(journeySetupId, journeyAuthorizationHash);
        assertEq(journeyB.balanceOf(address(journeyEscrow)), JOURNEY_REWARD);
        assertEq(journeyB.allowance(journeyMember, address(journeyEscrow)), 0);
        vm.selectFork(journeyArbitrumFork);
        vm.expectRevert(VoucherRedemptionModule.VoucherSetupNotReady.selector);
        vm.prank(journeyCreator);
        journeyServices.acceptServiceClaim(journeyServiceId, journeyMember, journeyClaimHash);
        assertEq(uint256(journeyCore.getCommitment(journeyServiceId).state), uint256(Core.CommitmentState.Offered));
        vm.selectFork(journeyGnosisFork);
        journeyGnosisRouter.configure(0, false, false);
        journeyEscrow.retrySetupAcknowledgment(journeySetupId);
        _relayJourneySetup();
        vm.prank(journeyCreator);
        journeyServices.acceptServiceClaim(journeyServiceId, journeyMember, journeyClaimHash);
        Acceptance.VoucherServiceAcceptance memory accepted =
            Acceptance(address(journeyCore)).getVoucherServiceAcceptance(journeyServiceId);
        assertEq(accepted.setupId, journeySetupId);
        assertEq(accepted.authorizationHash, journeyAuthorizationHash);
        assertEq(accepted.depositReceiptHash, Codec.depositReceiptHash(journeySource.getSetupAuthorization(journeySetupId)));
        journeySource.finalizeActivation(journeySetupId, journeyAuthorizationHash);
        _dispatchJourneySetup(1);
        _relayJourneySetup();
        assertEq(uint256(journeySource.getSetupResult(journeySetupId).phase), uint256(Codec.SetupPhase.Active));

        vm.selectFork(journeyGnosisFork);
        _safeExec(
            journeyIssuerB,
            address(journeyEscrow),
            abi.encodeCall(
                GnosisVoucherEscrow.authorizeReturn, (journeySetupId, journeyAuthorizationHash, uint256(500_000))
            )
        );
        vm.prank(journeyMember);
        bytes32 decision = journeyEscrow.finalizeAllocation(
            journeySetupId, journeyAuthorizationHash, Codec.FinalAllocation(30, 500_000, 500_000)
        );
        journeyEscrow.executeFinalLeg(journeySetupId, decision, Codec.FinalLeg.RefundToHolder);
        vm.prank(journeyGuardian);
        journeyEscrow.pause();
        journeyEscrow.executeFinalLeg(journeySetupId, decision, Codec.FinalLeg.ReleaseToIssuer);
        assertEq(uint256(journeyEscrow.getFinalAllocation(journeySetupId).release.state), uint256(Codec.LegState.Failed));
        assertEq(journeyB.balanceOf(journeyMember), 500_000);
        assertEq(journeyB.balanceOf(journeyIssuerB), JOURNEY_INVENTORY);
        assertEq(journeyB.balanceOf(address(journeyEscrow)), 500_000);
        _safeExec(journeyCommunity, address(journeyEscrow), abi.encodeWithSignature("unpause()"));
        vm.expectRevert(GnosisVoucherEscrow.ConflictingFinalAllocation.selector);
        vm.prank(journeyMember);
        journeyEscrow.finalizeAllocation(
            journeySetupId, journeyAuthorizationHash, Codec.FinalAllocation(60, JOURNEY_REWARD, 0)
        );
        journeyEscrow.executeFinalLeg(journeySetupId, decision, Codec.FinalLeg.ReleaseToIssuer);
        journeyEscrow.executeFinalLeg(journeySetupId, decision, Codec.FinalLeg.RefundToHolder);
        journeyEscrow.executeFinalLeg(journeySetupId, decision, Codec.FinalLeg.ReleaseToIssuer);
        assertEq(journeyEscrow.getFinalAllocation(journeySetupId).decisionId, decision);
        assertEq(journeyEscrow.getFinalAllocation(journeySetupId).allocation.approvedDeliveredServiceUnits, 30);
        assertTrue(journeyEscrow.isFinanciallyClosed(journeySetupId));
        assertEq(journeyA.totalSupply(), JOURNEY_SUPPLY);
        assertEq(journeyB.totalSupply(), JOURNEY_SUPPLY);
        assertEq(journeyA.balanceOf(journeyIssuerA), 9e6);
        assertEq(journeyA.balanceOf(address(journeyPool.pool)), 11e6);
        assertEq(journeyA.balanceOf(journeyMember), 0);
        assertEq(journeyB.balanceOf(journeyIssuerB), 10_500_000);
        assertEq(journeyB.balanceOf(address(journeyPool.pool)), 9e6);
        assertEq(journeyB.balanceOf(journeyMember), 500_000);
        assertEq(journeyB.balanceOf(address(journeyEscrow)), 0);
        assertEq(journeyPool.pool.fees(address(journeyA)), 0);
        assertEq(journeyPool.pool.fees(address(journeyB)), 0);
        assertFalse(journeyA.isWriter(address(journeyAdapter)));
        assertFalse(journeyB.isWriter(address(journeyEscrow)));
        _relayJourneySetup();
        assertEq(uint256(journeySource.getFinalResult(journeySetupId).release.state), uint256(Codec.LegState.Succeeded));
        assertEq(uint256(journeySource.getFinalResult(journeySetupId).refund.state), uint256(Codec.LegState.Succeeded));
        assertEq(uint256(journeyCore.getCommitment(journeyServiceId).state), uint256(Core.CommitmentState.Accepted));
        assertEq(journeyServices.getAcceptedServiceTerms(journeyServiceId).gdPrice, 0);
        assertEq(
            journeyServices.getAcceptedServiceTerms(journeyServiceId).offer.terms.serviceTermsRef, JOURNEY_SERVICE_TERMS
        );
    }
}

/// @notice Three FICTIONAL EOA participants, four assets in one published-CLC pool, independent work.
/// @dev Synthetic senders/terms/capacity and manually relayed CCIP; no live member signature or delivery.
contract GnosisVoucherMemberProjectForkTest is CLCMemberProjectFixture {
    function setUp() public {
        _setUpMemberProject();
    }

    function testGnosisVoucherMemberProject_threeRequestsAndMemberExchangeCloseDistinctLessonOnce() public {
        _createProjectRequests();
        for (uint256 i; i < 3; ++i) {
            _acceptProjectRequest(i);
            assertEq(
                journeyCore.getCommitment(projectMilestones[i].commitmentId).counterparty, projectMilestones[i].participant
            );
            _fulfillProjectRequest(i);
            Core.Commitment memory project = journeyCore.getCommitment(projectMilestones[i].commitmentId);
            assertEq(uint256(project.state), uint256(Core.CommitmentState.Fulfilled));
            assertEq(project.evidenceCount, 1);
            assertEq(project.targetUnits, 1);
            assertEq(uint256(project.consideration.rail), uint256(Core.ConsiderationRail.None));
        }
        assertTrue(
            projectDesigner != projectAnalyst && projectAnalyst != projectEngineer && projectDesigner != projectEngineer
        );
        assertTrue(projectMilestones[0].commitmentId != projectMilestones[1].commitmentId);
        assertTrue(projectMilestones[1].commitmentId != projectMilestones[2].commitmentId);
        assertTrue(projectMilestones[0].entitlement != projectMilestones[1].entitlement);
        assertTrue(projectMilestones[1].entitlement != projectMilestones[2].entitlement);

        _dispatchProjectReward(0);
        bytes32 entitlement = projectMilestones[0].entitlement;
        assertEq(
            journeyAdapter.failureReason(entitlement),
            abi.encodeWithSelector(GnosisVoucherAdapter.InsufficientAllowance.selector)
        );
        assertEq(engineerHelp.balanceOf(projectDesigner), 0);
        assertEq(engineerHelp.balanceOf(projectEngineer), 4e6);
        vm.prank(projectEngineer);
        engineerHelp.approve(address(journeyAdapter), MEMBER_REWARD);
        vm.prank(projectEngineer);
        journeyAdapter.safeRetry(entitlement);
        assertTrue(journeyAdapter.getExecutionResult(entitlement).success);
        assertEq(engineerHelp.balanceOf(projectDesigner), MEMBER_REWARD);
        assertEq(engineerHelp.allowance(projectEngineer, address(journeyAdapter)), 0);
        journeyAdapter.retryAcknowledgment(entitlement);
        _dispatchProjectReward(0);
        assertEq(engineerHelp.balanceOf(projectDesigner), MEMBER_REWARD);
        assertEq(engineerHelp.balanceOf(projectEngineer), 3e6);
        _relayProjectReward();
        vm.expectRevert(VoucherEntitlementModule.VoucherAlreadyDelivered.selector);
        vm.prank(journeyCreator);
        journeyEarned.dispatch(entitlement);
        for (uint256 i = 1; i < 3; ++i) {
            _dispatchProjectReward(i);
            assertTrue(journeyAdapter.getExecutionResult(projectMilestones[i].entitlement).success);
            _relayProjectReward();
        }
        vm.selectFork(journeyGnosisFork);
        assertEq(journeyB.balanceOf(projectAnalyst), MEMBER_REWARD);
        assertEq(journeyA.balanceOf(projectEngineer), MEMBER_REWARD);

        // Analyst exchanges their own newly issued future promise, not their separately earned TAS reward.
        _swapAnalystPromise();
        _prepareMemberLesson();
        vm.prank(projectAnalyst);
        engineerHelp.approve(address(journeyEscrow), MEMBER_REWARD);
        vm.expectRevert(GnosisVoucherEscrow.IssuerOnly.selector);
        vm.prank(projectAnalyst);
        journeyEscrow.approveSetupAuthorization(journeySetupId, journeyAuthorizationHash);
        vm.prank(projectEngineer);
        journeyEscrow.approveSetupAuthorization(journeySetupId, journeyAuthorizationHash);
        journeyGnosisRouter.configure(0, true, false);
        vm.prank(projectAnalyst);
        journeyEscrow.presentSetup(journeySetupId, journeyAuthorizationHash);
        assertEq(engineerHelp.balanceOf(address(journeyEscrow)), MEMBER_REWARD);
        assertEq(engineerHelp.allowance(projectAnalyst, address(journeyEscrow)), 0);
        vm.selectFork(journeyArbitrumFork);
        vm.expectRevert(VoucherRedemptionModule.VoucherSetupNotReady.selector);
        vm.prank(journeyCreator);
        journeyServices.acceptServiceClaim(journeyServiceId, projectAnalyst, journeyClaimHash);
        vm.selectFork(journeyGnosisFork);
        journeyGnosisRouter.configure(0, false, false);
        journeyEscrow.retrySetupAcknowledgment(journeySetupId);
        _relayJourneySetup();
        vm.prank(journeyCreator);
        journeyServices.acceptServiceClaim(journeyServiceId, projectAnalyst, journeyClaimHash);
        assertEq(
            Acceptance(address(journeyCore)).getVoucherServiceAcceptance(journeyServiceId).authorizationHash,
            journeyAuthorizationHash
        );
        journeySource.finalizeActivation(journeySetupId, journeyAuthorizationHash);
        _dispatchJourneySetup(1);
        _relayJourneySetup();
        assertEq(uint256(journeySource.getSetupResult(journeySetupId).phase), uint256(Codec.SetupPhase.Active));
        address[] memory teacher = new address[](1);
        teacher[0] = projectEngineer;
        vm.prank(projectEngineer);
        journeyCore.attachEvidence(
            journeyServiceId, "FICTIONAL separate 30-minute standalone integration lesson evidence", teacher
        );
        assertEq(journeyCore.getCommitment(journeyServiceId).evidenceCount, 1);
        assertEq(journeyCore.getCommitment(journeyServiceId).leadProvider, projectEngineer);
        assertEq(journeyCore.getCommitment(journeyServiceId).targetUnits, 60);

        vm.selectFork(journeyGnosisFork);
        vm.prank(projectEngineer);
        journeyEscrow.authorizeReturn(journeySetupId, journeyAuthorizationHash, 500_000);
        vm.prank(projectAnalyst);
        bytes32 decision = journeyEscrow.finalizeAllocation(
            journeySetupId, journeyAuthorizationHash, Codec.FinalAllocation(30, 500_000, 500_000)
        );
        journeyEscrow.executeFinalLeg(journeySetupId, decision, Codec.FinalLeg.RefundToHolder);
        vm.prank(journeyGuardian);
        journeyEscrow.pause();
        journeyEscrow.executeFinalLeg(journeySetupId, decision, Codec.FinalLeg.ReleaseToIssuer);
        assertEq(uint256(journeyEscrow.getFinalAllocation(journeySetupId).release.state), uint256(Codec.LegState.Failed));
        assertEq(engineerHelp.balanceOf(projectAnalyst), 500_000);
        assertEq(engineerHelp.balanceOf(projectEngineer), 3e6);
        _safeExec(journeyCommunity, address(journeyEscrow), abi.encodeWithSignature("unpause()"));
        vm.expectRevert(GnosisVoucherEscrow.ConflictingFinalAllocation.selector);
        vm.prank(projectAnalyst);
        journeyEscrow.finalizeAllocation(
            journeySetupId, journeyAuthorizationHash, Codec.FinalAllocation(60, MEMBER_REWARD, 0)
        );
        journeyEscrow.executeFinalLeg(journeySetupId, decision, Codec.FinalLeg.ReleaseToIssuer);
        journeyEscrow.executeFinalLeg(journeySetupId, decision, Codec.FinalLeg.ReleaseToIssuer);
        journeyEscrow.executeFinalLeg(journeySetupId, decision, Codec.FinalLeg.RefundToHolder);
        Codec.FinalAllocationRecord memory result = journeyEscrow.getFinalAllocation(journeySetupId);
        assertEq(result.decisionId, decision);
        assertEq(result.allocation.approvedDeliveredServiceUnits, 30);
        assertEq(result.release.attempts, 2);
        assertEq(result.refund.attempts, 1);
        assertTrue(journeyEscrow.isFinanciallyClosed(journeySetupId));
        _assertMemberBalances();
        _relayJourneySetup();
        assertEq(uint256(journeySource.getFinalResult(journeySetupId).release.state), uint256(Codec.LegState.Succeeded));
        assertEq(uint256(journeySource.getFinalResult(journeySetupId).refund.state), uint256(Codec.LegState.Succeeded));
        assertEq(uint256(journeyCore.getCommitment(journeyServiceId).state), uint256(Core.CommitmentState.Accepted));
        assertEq(journeyServices.getAcceptedServiceTerms(journeyServiceId).gdPrice, 0);
        assertEq(journeyServices.getAcceptedServiceTerms(journeyServiceId).offer.terms.serviceTermsRef, ENGINEER_HELP_TERMS);
        for (uint256 i; i < 3; ++i) {
            assertEq(
                uint256(journeyCore.getCommitment(projectMilestones[i].commitmentId).state),
                uint256(Core.CommitmentState.Fulfilled)
            );
        }
        // Returning 500k vouchers is not new issuance or replenished service capacity. Only this
        // booking's holder-approved 30 minutes is recorded; no global capacity mechanism is claimed.
    }

    function testGnosisVoucherMemberProject_memberAuthorityCannotBeReplacedByStewardPoolOrOtherMember() public {
        _createProjectRequests();
        uint256 id = projectMilestones[0].commitmentId;
        vm.expectRevert(VoucherEntitlementModule.NotIssuerAuthority.selector);
        vm.prank(projectAnalyst);
        journeyEarned.approveTerms(id, 1);
        assertFalse(
            _safeCall(
                journeyCommunity,
                address(journeyEarned),
                abi.encodeCall(VoucherEntitlementModule.approveTerms, (id, uint64(1))),
                false
            )
        );
        vm.expectRevert(VoucherEntitlementModule.IssuerApprovalRequired.selector);
        vm.prank(journeyCreator);
        journeyEarned.consentTerms(id, 1);
        vm.prank(projectEngineer);
        journeyEarned.approveTerms(id, 1);
        bytes32 recognitionPolicy = journeyEarned.RECOGNITION_POLICY();
        vm.prank(journeyCreator);
        journeyEarned.registerTerms(
            id,
            VoucherEntitlementModule.TermsInput(
                projectEngineer,
                projectEngineer,
                address(engineerHelp),
                MEMBER_REWARD,
                recognitionPolicy,
                keccak256("FICTIONAL revised engineer lesson criteria"),
                0
            )
        );
        vm.expectRevert(VoucherEntitlementModule.WrongTermsRevision.selector);
        vm.prank(projectDesigner);
        journeyEarned.consentTerms(id, 1);
        vm.expectRevert(VoucherEntitlementModule.IssuerApprovalRequired.selector);
        vm.prank(journeyCreator);
        journeyEarned.consentTerms(id, 2);
        vm.prank(projectEngineer);
        journeyEarned.approveTerms(id, 2);
        vm.expectRevert(VoucherEntitlementModule.VoucherConsentMissing.selector);
        vm.prank(projectDesigner);
        journeyCore.claimCommitment(id, Core.ClaimType.Individual, journeyProviderGarden);
        vm.prank(journeyCreator);
        journeyEarned.consentTerms(id, 2);
        vm.prank(projectDesigner);
        journeyEarned.consentTerms(id, 2);
        vm.prank(projectDesigner);
        journeyCore.claimCommitment(id, Core.ClaimType.Individual, journeyProviderGarden);
        assertEq(journeyCore.getCommitment(id).counterparty, projectDesigner);
        _fulfillProjectRequest(0);
        vm.selectFork(journeyGnosisFork);
        assertFalse(
            _safeCall(
                journeyCommunity,
                address(engineerHelp),
                abi.encodeCall(ICLCGiftableToken.mintTo, (journeyCommunity, uint256(1))),
                false
            )
        );
        vm.expectRevert(bytes4(keccak256("Unauthorized()")));
        vm.prank(projectAnalyst);
        engineerHelp.mintTo(projectAnalyst, 1);
        vm.prank(projectEngineer);
        journeyAdapter.configureAsset(address(engineerHelp), projectEngineer, false);
        _safeExec(
            journeyCommunity,
            address(journeyAdapter),
            abi.encodeCall(GnosisVoucherAdapter.configureAsset, (address(engineerHelp), journeyCommunity, true))
        );
        (address authority, bool enabled) = journeyAdapter.assetAuthorizations(projectEngineer, address(engineerHelp));
        assertEq(authority, projectEngineer);
        assertFalse(enabled);
        assertEq(engineerHelp.totalSupply(), MEMBER_SUPPLY);
        assertEq(engineerHelp.allowance(projectEngineer, address(journeyAdapter)), 0);
        assertFalse(engineerHelp.isWriter(journeyCommunity));
        assertFalse(engineerHelp.isWriter(address(journeyAdapter)));
        assertFalse(engineerHelp.isWriter(address(journeyEscrow)));
        vm.prank(projectEngineer);
        engineerHelp.approve(address(journeyAdapter), MEMBER_REWARD);
        _dispatchProjectReward(0);
        bytes32 entitlement = projectMilestones[0].entitlement;
        assertEq(
            journeyAdapter.failureReason(entitlement),
            abi.encodeWithSelector(GnosisVoucherAdapter.AssetNotAuthorized.selector)
        );
        assertEq(engineerHelp.balanceOf(projectDesigner), 0);
        assertEq(engineerHelp.balanceOf(projectEngineer), 4e6);
        vm.prank(projectEngineer);
        journeyAdapter.configureAsset(address(engineerHelp), projectEngineer, true);
        vm.prank(projectEngineer);
        journeyAdapter.safeRetry(entitlement);
        assertEq(engineerHelp.balanceOf(projectDesigner), MEMBER_REWARD);
        assertEq(engineerHelp.balanceOf(projectEngineer), 3e6);
        _dispatchProjectReward(0);
        assertEq(engineerHelp.balanceOf(projectDesigner), MEMBER_REWARD);
        assertEq(engineerHelp.allowance(projectEngineer, address(journeyAdapter)), 0);
    }

    function testGnosisVoucherMemberProject_memberQuoteFailureIsAtomicBeforeExplicitRepair() public {
        vm.selectFork(journeyGnosisFork);
        vm.prank(projectAnalyst);
        analystHelp.approve(address(journeyPool.pool), 2e6);
        vm.expectRevert(ICLCSwapPool.InsufficientOutput.selector);
        vm.prank(projectAnalyst);
        journeyPool.pool
            .withdraw(address(engineerHelp), address(analystHelp), 2e6, projectAnalyst, MEMBER_REWARD + 1, block.timestamp);
        assertEq(analystHelp.balanceOf(projectAnalyst), 4e6);
        assertEq(analystHelp.balanceOf(address(journeyPool.pool)), 2e6);
        assertEq(engineerHelp.balanceOf(address(journeyPool.pool)), 2e6);
        assertEq(engineerHelp.balanceOf(projectAnalyst), 0);
        assertEq(analystHelp.allowance(projectAnalyst, address(journeyPool.pool)), 2e6);
        _swapAnalystPromise();
    }

    function testGnosisVoucherMemberProject_memberDirectProxyAdminUsesActualPublishedFactory() public {
        vm.selectFork(journeyGnosisFork);
        bytes memory upgrade =
            abi.encodeWithSignature("upgrade(address,address)", address(engineerHelp), GIFTABLE_IMPLEMENTATION);
        bytes memory sameAdmin =
            abi.encodeWithSignature("changeAdmin(address,address)", address(engineerHelp), projectEngineer);
        address[3] memory wrong = [projectAnalyst, journeyCreator, address(this)];
        for (uint256 i; i < wrong.length; ++i) {
            vm.prank(wrong[i]);
            (bool unauthorizedUpgrade,) = CLC_FACTORY.call(upgrade);
            assertFalse(unauthorizedUpgrade);
            vm.prank(wrong[i]);
            (bool unauthorizedChange,) = CLC_FACTORY.call(sameAdmin);
            assertFalse(unauthorizedChange);
        }
        assertFalse(_safeCall(journeyCommunity, CLC_FACTORY, upgrade, false));
        assertFalse(_safeCall(journeyCommunity, CLC_FACTORY, sameAdmin, false));
        uint256 timestamp = block.timestamp;
        vm.prank(projectEngineer);
        (bool changed,) = CLC_FACTORY.call(sameAdmin);
        assertTrue(changed);
        vm.prank(projectEngineer);
        (bool upgraded,) = CLC_FACTORY.call(upgrade);
        assertTrue(upgraded);
        assertEq(block.timestamp, timestamp);
        assertEq(ICLCERC1967Factory(CLC_FACTORY).adminOf(address(engineerHelp)), projectEngineer);
        assertEq(engineerHelp.owner(), projectEngineer);
        assertEq(engineerHelp.totalSupply(), MEMBER_SUPPLY);
        assertEq(engineerHelp.balanceOf(projectEngineer), 4e6);
        assertEq(engineerHelp.balanceOf(address(journeyPool.pool)), 2e6);
        assertFalse(engineerHelp.isWriter(address(this)));
        assertFalse(engineerHelp.isWriter(journeyCommunity));
    }

    function _swapAnalystPromise() private {
        assertEq(journeyPool.pool.getAmountOut(address(engineerHelp), address(analystHelp), 2e6), MEMBER_REWARD);
        vm.prank(projectAnalyst);
        analystHelp.approve(address(journeyPool.pool), 2e6);
        vm.prank(projectAnalyst);
        assertEq(
            journeyPool.pool
                .withdraw(address(engineerHelp), address(analystHelp), 2e6, projectAnalyst, MEMBER_REWARD, block.timestamp),
            MEMBER_REWARD
        );
        assertEq(analystHelp.allowance(projectAnalyst, address(journeyPool.pool)), 0);
        assertEq(analystHelp.balanceOf(projectAnalyst), 2e6);
        assertEq(analystHelp.balanceOf(address(journeyPool.pool)), 4e6);
        assertEq(engineerHelp.balanceOf(projectAnalyst), MEMBER_REWARD);
        assertEq(engineerHelp.balanceOf(address(journeyPool.pool)), MEMBER_REWARD);
    }

    function _assertMemberBalances() private {
        assertEq(analystHelp.totalSupply(), MEMBER_SUPPLY);
        assertEq(engineerHelp.totalSupply(), MEMBER_SUPPLY);
        assertEq(analystHelp.balanceOf(projectAnalyst), 2e6);
        assertEq(analystHelp.balanceOf(address(journeyPool.pool)), 4e6);
        assertEq(engineerHelp.balanceOf(projectEngineer), 3_500_000);
        assertEq(engineerHelp.balanceOf(address(journeyPool.pool)), 1e6);
        assertEq(engineerHelp.balanceOf(projectDesigner), 1e6);
        assertEq(engineerHelp.balanceOf(projectAnalyst), 500_000);
        assertEq(engineerHelp.balanceOf(address(journeyEscrow)), 0);
        assertEq(journeyB.balanceOf(projectAnalyst), MEMBER_REWARD);
        assertEq(journeyA.balanceOf(projectEngineer), MEMBER_REWARD);
        assertEq(journeyPool.pool.fees(address(analystHelp)), 0);
        assertEq(journeyPool.pool.fees(address(engineerHelp)), 0);
    }
}
