// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ISettlementModule } from "../../src/interfaces/ISettlementModule.sol";
import { SettlementMessageCodec } from "../../src/libraries/SettlementMessageCodec.sol";
import { SettlementModule } from "../../src/modules/SettlementModule.sol";
import { SettlementPayerMockRouter, SettlementPayerTest } from "./SettlementPayer.t.sol";

interface IUUPSUpgradeBoundary {
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
}

interface ICommandExecutionKeyView {
    function commandExecutionKeys(bytes32 messageId) external view returns (bytes32);
}

contract SettlementSecurityTest is SettlementPayerTest {
    address internal constant DISPATCHER = address(0xD15A);
    address internal constant SECOND_GARDEN = address(0x2100);
    address internal constant SECOND_SAFE = address(0x4100);

    function testCommitmentPoolingIdentityLocksAfterPayoutPlanCreation() public {
        vm.startPrank(OWNER);
        settlement.setPaused(true);
        settlement.setCommitmentPoolingModule(address(0xB0B));
        assertEq(settlement.commitmentPoolingModule(), address(0xB0B));
        settlement.setCommitmentPoolingModule(address(pooling));
        settlement.setPaused(false);
        vm.stopPrank();

        pooling.setCommitment(1, _gardenRequest(PROTOCOL_GARDEN, PROVIDER_GARDEN));
        vm.prank(OWNER);
        settlement.createCommitmentPayoutPlan(1, new ISettlementModule.RecognitionEntry[](0), bytes32(0));

        vm.startPrank(OWNER);
        settlement.setPaused(true);
        vm.expectRevert(ISettlementModule.CommitmentPoolingModuleLocked.selector);
        settlement.setCommitmentPoolingModule(address(0xB0B));
        vm.stopPrank();
    }

    function testRecoveryOwnerRotationUpdatesFrozenHash() public {
        address[3] memory replacementOwners = _owners(0x30);

        vm.prank(OWNER);
        settlement.updateSettlementRecovery(PROVIDER_GARDEN, replacementOwners);

        ISettlementModule.SettlementAccount memory account = settlement.settlementAccountOf(PROVIDER_GARDEN);
        for (uint256 index; index < replacementOwners.length; ++index) {
            assertEq(account.recoveryOwners[index], replacementOwners[index]);
        }
        assertEq(
            account.recoveryConfigHash, keccak256(abi.encode(CELO_CHAIN_ID, BENEFICIARY_SAFE, replacementOwners, uint8(2)))
        );
        assertEq(account.recoveryThreshold, 2);
    }

    function testRecoveryOwnerRotationRejectsExecutorOwner() public {
        address[3] memory invalidOwners = [address(0x10), address(0x20), address(0x8000)];

        vm.prank(OWNER);
        vm.expectRevert(ISettlementModule.InvalidRecoveryConfiguration.selector);
        settlement.updateSettlementRecovery(PROVIDER_GARDEN, invalidOwners);
    }

    function testPausedConfigurationRejectsInvalidRoutesAndAccounts() public {
        vm.prank(OWNER);
        settlement.setPaused(true);

        vm.startPrank(OWNER);
        vm.expectRevert(ISettlementModule.FundingConfigurationIncomplete.selector);
        settlement.setCcipRoute(0, address(0x8000), 500_000, 1, 0);
        vm.expectRevert(ISettlementModule.FundingConfigurationIncomplete.selector);
        settlement.setCcipRoute(2, address(0x8100), 500_000, 1, 1 days);
        vm.expectRevert(ISettlementModule.FundingConfigurationIncomplete.selector);
        settlement.setCcipRoute(1, address(0x8100), 500_000, 1, 0);

        settlement.setCcipRoute(1, address(0x8100), 500_000, 1, 2 days);
        vm.expectRevert(ISettlementModule.FundingConfigurationIncomplete.selector);
        settlement.setCcipRoute(1, address(0x8100), 500_000, 1, 1 days);

        vm.expectRevert(ISettlementModule.ZeroAddress.selector);
        settlement.registerSettlementAccount(
            address(0),
            CELO_CHAIN_ID,
            address(0x4200),
            _owners(0x50),
            address(0x7200),
            bytes32(uint256(10)),
            bytes32(uint256(11)),
            bytes32(uint256(12))
        );

        vm.expectRevert(abi.encodeWithSelector(ISettlementModule.InvalidSettlementChain.selector, CELO_CHAIN_ID + 1));
        settlement.registerSettlementAccount(
            SECOND_GARDEN,
            CELO_CHAIN_ID + 1,
            SECOND_SAFE,
            _owners(0x50),
            address(0x7200),
            bytes32(uint256(10)),
            bytes32(uint256(11)),
            bytes32(uint256(12))
        );

        vm.expectRevert(ISettlementModule.InvalidRecoveryConfiguration.selector);
        settlement.registerSettlementAccount(
            SECOND_GARDEN,
            CELO_CHAIN_ID,
            SECOND_SAFE,
            _owners(0x50),
            address(0x7200),
            bytes32(0),
            bytes32(uint256(11)),
            bytes32(uint256(12))
        );

        vm.expectRevert(ISettlementModule.InvalidRecoveryConfiguration.selector);
        settlement.registerSettlementAccount(
            PROVIDER_GARDEN,
            CELO_CHAIN_ID,
            SECOND_SAFE,
            _owners(0x50),
            address(0x7200),
            bytes32(uint256(10)),
            bytes32(uint256(11)),
            bytes32(uint256(12))
        );

        address[3] memory unorderedOwners = [address(0x53), address(0x52), address(0x51)];
        vm.expectRevert(ISettlementModule.InvalidRecoveryConfiguration.selector);
        settlement.registerSettlementAccount(
            SECOND_GARDEN,
            CELO_CHAIN_ID,
            SECOND_SAFE,
            unorderedOwners,
            address(0x7200),
            bytes32(uint256(10)),
            bytes32(uint256(11)),
            bytes32(uint256(12))
        );

        vm.expectRevert(abi.encodeWithSelector(ISettlementModule.UnknownSettlementAccount.selector, SECOND_GARDEN));
        settlement.updateSettlementRecovery(SECOND_GARDEN, _owners(0x50));
        vm.expectRevert(abi.encodeWithSelector(ISettlementModule.UnknownSettlementAccount.selector, SECOND_GARDEN));
        settlement.setAccountActive(SECOND_GARDEN, false);
        vm.stopPrank();
    }

    function testSettlementModule_settlementAccountRegistrationRequiresOwner() public {
        hats.setSteward(SECOND_GARDEN, DISPATCHER, true);

        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        vm.prank(DISPATCHER);
        settlement.registerSettlementAccount(
            SECOND_GARDEN,
            CELO_CHAIN_ID,
            SECOND_SAFE,
            _owners(0x50),
            address(0x7200),
            bytes32(uint256(10)),
            bytes32(uint256(11)),
            bytes32(uint256(12))
        );
    }

    function testSettlementModule_settlementAccountRegistrationRequiresPause() public {
        vm.expectRevert(ISettlementModule.SourceMustBePaused.selector);
        vm.prank(OWNER);
        settlement.registerSettlementAccount(
            SECOND_GARDEN,
            CELO_CHAIN_ID,
            SECOND_SAFE,
            _owners(0x50),
            address(0x7200),
            bytes32(uint256(10)),
            bytes32(uint256(11)),
            bytes32(uint256(12))
        );
    }

    function testSettlementModule_settlementAccountRegistrationRejectsAnAssignedSafe() public {
        vm.prank(OWNER);
        settlement.setPaused(true);

        vm.expectRevert(
            abi.encodeWithSelector(ISettlementModule.SettlementAccountAlreadyAssigned.selector, PAYER_SAFE, PROTOCOL_GARDEN)
        );
        vm.prank(OWNER);
        settlement.registerSettlementAccount(
            SECOND_GARDEN,
            CELO_CHAIN_ID,
            PAYER_SAFE,
            _owners(0x50),
            address(0x7200),
            bytes32(uint256(10)),
            bytes32(uint256(11)),
            bytes32(uint256(12))
        );
        assertEq(settlement.settlementGardenOf(PAYER_SAFE), PROTOCOL_GARDEN);
    }

    function testDispatcherCanDispatchButCannotCancel() public {
        vm.startPrank(OWNER);
        settlement.setPaused(true);
        settlement.setDispatcher(DISPATCHER);
        settlement.setPaused(false);
        uint256 first = settlement.queueFunding(PROVIDER_GARDEN, 10 ether);
        uint256 second = settlement.queueFunding(PROVIDER_GARDEN, 11 ether);
        vm.stopPrank();

        vm.prank(DISPATCHER);
        settlement.dispatchDisbursement(first);
        assertEq(uint8(settlement.getDisbursement(first).state), uint8(ISettlementModule.DisbursementState.Dispatched));

        vm.prank(DISPATCHER);
        vm.expectRevert(
            abi.encodeWithSelector(ISettlementModule.NotSettlementSteward.selector, DISPATCHER, PROTOCOL_GARDEN)
        );
        settlement.cancelDisbursement(second, "ipfs://dispatcher-cannot-cancel");
    }

    function testCommandRetryUsesOriginalRouteSnapshotAfterPeerRotation() public {
        vm.prank(OWNER);
        uint256 childId = settlement.queueFunding(PROVIDER_GARDEN, 10 ether);
        vm.prank(OWNER);
        bytes32 initialMessageId = settlement.dispatchDisbursement(childId);
        ISettlementModule.Disbursement memory dispatched = settlement.getDisbursement(childId);
        ISettlementModule.CommandRecord memory initial = settlement.commandRecord(dispatched.executionKey);

        address replacementExecutor = address(0x8100);
        vm.startPrank(OWNER);
        settlement.setPaused(true);
        settlement.setCcipRoute(1, replacementExecutor, 700_000, 1, 1 days);
        settlement.setPaused(false);
        bytes32 retryMessageId = settlement.retryCommand(childId);
        vm.stopPrank();

        ISettlementModule.CommandRecord memory retried = settlement.commandRecord(dispatched.executionKey);
        assertTrue(retryMessageId != initialMessageId);
        assertEq(retried.destinationExecutor, initial.destinationExecutor);
        assertEq(retried.destinationGasLimit, initial.destinationGasLimit);
        assertEq(retried.commandPayloadHash, initial.commandPayloadHash);
        assertEq(
            ICommandExecutionKeyView(address(settlement)).commandExecutionKeys(retryMessageId), dispatched.executionKey
        );
        assertEq(abi.decode(router.lastReceiver(), (address)), initial.destinationExecutor);

        bytes memory acknowledgment = SettlementMessageCodec.encodeAcknowledgment(
            1, dispatched.executionKey, retryMessageId, true, uint8(ISettlementModule.FailureCode.None)
        );
        vm.expectRevert(ISettlementModule.InvalidCcipSender.selector);
        router.deliver(address(settlement), keccak256("wrong-peer-ack"), 1, replacementExecutor, acknowledgment);
        router.deliver(
            address(settlement), keccak256("snapshotted-peer-ack"), 1, initial.destinationExecutor, acknowledgment
        );
        assertEq(uint8(settlement.getDisbursement(childId).state), uint8(ISettlementModule.DisbursementState.Confirmed));
    }

    function testPeerRotationGraceIsBoundedAndExtensionCannotShorten() public {
        vm.startPrank(OWNER);
        settlement.setPaused(true);
        settlement.setCcipRoute(1, address(0x8100), 700_000, 1, 1 days);
        ISettlementModule.CcipRoute memory rotated = settlement.ccipRoute();
        settlement.setCcipRoute(1, address(0x8100), 700_000, 1, 2 days);
        ISettlementModule.CcipRoute memory extended = settlement.ccipRoute();
        assertEq(rotated.previousDestinationExecutor, address(0x8000));
        assertGt(extended.previousPeerExpiresAt, rotated.previousPeerExpiresAt);

        vm.expectRevert(ISettlementModule.FundingConfigurationIncomplete.selector);
        settlement.setCcipRoute(1, address(0x8100), 700_000, 1, 31 days);
        vm.stopPrank();
    }

    function testQueuedBatchCancellationIsAtomic() public {
        hats.setSteward(SECOND_GARDEN, OWNER, true);
        vm.startPrank(OWNER);
        settlement.setPaused(true);
        settlement.registerSettlementAccount(
            SECOND_GARDEN,
            CELO_CHAIN_ID,
            SECOND_SAFE,
            _owners(0x40),
            address(0x7100),
            bytes32(uint256(7)),
            bytes32(uint256(8)),
            bytes32(uint256(9))
        );
        settlement.setBatchSizeLimit(2);
        settlement.setPaused(false);
        uint256 first = settlement.queueFunding(PROVIDER_GARDEN, 10 ether);
        uint256 second = settlement.queueFunding(SECOND_GARDEN, 11 ether);
        uint256[] memory ids = new uint256[](2);
        ids[0] = first;
        ids[1] = second;
        uint256 batchId = settlement.createBatch(ids);
        settlement.cancelBatch(batchId, "ipfs://batch-cancelled");
        vm.stopPrank();

        assertEq(uint8(settlement.getBatch(batchId).state), uint8(ISettlementModule.DisbursementState.Cancelled));
        assertEq(uint8(settlement.getDisbursement(first).state), uint8(ISettlementModule.DisbursementState.Cancelled));
        assertEq(uint8(settlement.getDisbursement(second).state), uint8(ISettlementModule.DisbursementState.Cancelled));
        assertEq(
            uint8(settlement.getDisbursement(first).cancelledFromState), uint8(ISettlementModule.DisbursementState.Queued)
        );
        assertEq(settlement.getDisbursement(second).reasonCID, "ipfs://batch-cancelled");
    }

    function testSourceFeeWithdrawalPreservesFloor() public {
        address payable recipient = payable(address(0xFEE));
        vm.deal(OWNER, 6);
        vm.prank(OWNER);
        settlement.fundFees{ value: 5 }();

        vm.prank(OWNER);
        settlement.withdrawExcessFees(recipient, 5);
        assertEq(address(settlement).balance, settlement.feeReserveMinimum());
        assertEq(recipient.balance, 5);

        vm.prank(OWNER);
        vm.expectRevert(abi.encodeWithSelector(ISettlementModule.FeeReserveFloorViolated.selector, uint256(1), uint256(0)));
        settlement.withdrawExcessFees(recipient, 1);
    }

    function testSourceUpgradeRequiresOwnerAndPause() public {
        SettlementModule replacement = new SettlementModule(address(router), ARBITRUM_SELECTOR, CELO_CHAIN_ID);
        IUUPSUpgradeBoundary proxy = IUUPSUpgradeBoundary(address(settlement));

        vm.prank(address(0xBAD));
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        proxy.upgradeToAndCall(address(replacement), bytes(""));

        vm.prank(OWNER);
        vm.expectRevert(ISettlementModule.SourceMustBePaused.selector);
        proxy.upgradeToAndCall(address(replacement), bytes(""));
    }

    function testSourceUpgradeRejectsImmutableRouterAndChainChanges() public {
        SettlementPayerMockRouter otherRouter = new SettlementPayerMockRouter();
        SettlementModule wrongRouter = new SettlementModule(address(otherRouter), ARBITRUM_SELECTOR, CELO_CHAIN_ID);
        SettlementModule wrongChains = new SettlementModule(address(router), ARBITRUM_SELECTOR + 1, CELO_CHAIN_ID + 1);
        IUUPSUpgradeBoundary proxy = IUUPSUpgradeBoundary(address(settlement));

        vm.prank(OWNER);
        settlement.setPaused(true);
        vm.prank(OWNER);
        vm.expectRevert(ISettlementModule.ImmutableConfigurationMismatch.selector);
        proxy.upgradeToAndCall(address(wrongRouter), bytes(""));

        vm.prank(OWNER);
        vm.expectRevert(ISettlementModule.ImmutableConfigurationMismatch.selector);
        proxy.upgradeToAndCall(address(wrongChains), bytes(""));
    }

    function testSourceUpgradeAndRollbackPreserveState() public {
        SettlementModule replacement = new SettlementModule(address(router), ARBITRUM_SELECTOR, CELO_CHAIN_ID);
        SettlementModule rollback = new SettlementModule(address(router), ARBITRUM_SELECTOR, CELO_CHAIN_ID);
        IUUPSUpgradeBoundary proxy = IUUPSUpgradeBoundary(address(settlement));

        vm.prank(OWNER);
        settlement.setPaused(true);
        vm.prank(OWNER);
        proxy.upgradeToAndCall(address(replacement), bytes(""));
        vm.prank(OWNER);
        proxy.upgradeToAndCall(address(rollback), bytes(""));

        assertEq(settlement.protocolGarden(), PROTOCOL_GARDEN);
        assertEq(settlement.gDollarToken(), GDOLLAR);
        assertEq(settlement.CCIP_ROUTER(), address(router));
        assertEq(settlement.SOURCE_CHAIN_SELECTOR(), ARBITRUM_SELECTOR);
        assertEq(settlement.DESTINATION_EVM_CHAIN_ID(), CELO_CHAIN_ID);
        assertTrue(settlement.paused());
    }

    function testFuzzBatchLimitRejectsValuesAboveHardMaximum(uint16 supplied) public {
        supplied = uint16(bound(supplied, settlement.HARD_MAX_BATCH_SIZE() + 1, type(uint16).max));
        vm.startPrank(OWNER);
        settlement.setPaused(true);
        vm.expectRevert(
            abi.encodeWithSelector(
                ISettlementModule.BatchSizeOutOfBounds.selector, uint256(supplied), settlement.HARD_MAX_BATCH_SIZE()
            )
        );
        settlement.setBatchSizeLimit(supplied);
        vm.stopPrank();
    }

    function invariantSourceFeeFloorRemainsFunded() public {
        assertGe(address(settlement).balance, settlement.feeReserveMinimum());
    }
}
