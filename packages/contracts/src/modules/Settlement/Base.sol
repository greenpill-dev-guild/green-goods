// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IHatsModule } from "../../interfaces/IHatsModule.sol";
import { SettlementLifecycleLib } from "../../lib/Settlement/LifecycleLib.sol";
import { SettlementModuleStorage } from "./Storage.sol";

/// @title SettlementBase
/// @notice Shared guards, lookups, and the single disbursement-queueing primitive.
abstract contract SettlementBase is SettlementModuleStorage {
    function _queueDisbursement(
        uint256 commitmentId,
        uint256 payoutPlanId,
        address contributor,
        address garden,
        address executorGarden,
        DisbursementKind kind,
        FundingRoute fundingRoute,
        address source,
        address recipient,
        address token,
        uint256 amount
    )
        internal
        returns (uint256 disbursementId)
    {
        if (amount == 0) revert AmountRequired();
        disbursementId = _nextDisbursementId++;
        _disbursements[disbursementId] = Disbursement({
            commitmentId: commitmentId,
            payoutPlanId: payoutPlanId,
            contributor: contributor,
            garden: garden,
            executorGarden: executorGarden,
            kind: kind,
            fundingRoute: fundingRoute,
            source: source,
            recipient: recipient,
            token: token,
            amount: amount,
            state: DisbursementState.Queued,
            batchId: 0,
            reasonCID: "",
            attempt: 0,
            executionKey: bytes32(0),
            commandMessageId: bytes32(0),
            dispatchedAt: 0,
            confirmedAt: 0,
            acknowledgmentMessageId: bytes32(0),
            failureCode: 0,
            cancelledFromState: DisbursementState.None
        });
        emit DisbursementQueued(
            disbursementId,
            commitmentId,
            garden,
            payoutPlanId,
            contributor,
            executorGarden,
            uint8(kind),
            uint8(fundingRoute),
            source,
            recipient,
            token,
            amount
        );
    }

    function _lifecycleConfig() internal view returns (SettlementLifecycleLib.RuntimeConfig memory) {
        return SettlementLifecycleLib.RuntimeConfig({
            router: CCIP_ROUTER,
            sourceChainSelector: SOURCE_CHAIN_SELECTOR,
            destinationEvmChainId: DESTINATION_EVM_CHAIN_ID,
            feeReserveMinimum: feeReserveMinimum,
            batchSizeLimit: batchSizeLimit,
            protocolGarden: protocolGarden,
            route: _ccipRoute
        });
    }

    function _requirePaused() internal view {
        if (!paused) revert SourceMustBePaused();
    }

    function _requireNotPaused() internal view {
        if (paused) revert SourceMustBePaused();
    }

    function _requireSteward(address garden) internal view {
        address module = hatsModule;
        if (module == address(0)) revert SourceNotReady();
        if (!IHatsModule(module).isStewardOf(garden, msg.sender) && !IHatsModule(module).isOwnerOf(garden, msg.sender)) {
            revert NotSettlementSteward(msg.sender, garden);
        }
    }

    function _requireAccountAdministrator(address garden) internal view {
        if (msg.sender == owner()) return;
        _requireSteward(garden);
    }

    function _requireDispatcherOrSteward(address garden) internal view {
        if (msg.sender == dispatcher && dispatcher != address(0)) return;
        _requireSteward(garden);
    }

    function _knownAccount(address garden) internal view returns (SettlementAccount storage account) {
        account = _settlementAccounts[garden];
        if (account.account == address(0)) revert UnknownSettlementAccount(garden);
    }

    function _activeAccount(address garden) internal view returns (SettlementAccount storage account) {
        account = _knownAccount(garden);
        if (!account.active) revert SettlementAccountInactive(garden);
    }

    function _activeAccountMatches(address garden, address expected) internal view {
        SettlementAccount storage account = _activeAccount(garden);
        if (account.account != expected) revert UnknownSettlementAccount(garden);
    }

    function _knownPlan(uint256 payoutPlanId) internal view returns (CommitmentPayoutPlan storage plan) {
        plan = _planState.payoutPlans[payoutPlanId];
        if (plan.commitmentId == 0) revert UnknownPayoutPlan(payoutPlanId);
    }

    function _knownDisbursement(uint256 disbursementId) internal view returns (Disbursement storage disbursement) {
        disbursement = _disbursements[disbursementId];
        if (disbursement.state == DisbursementState.None) revert UnknownDisbursement(disbursementId);
    }

    function _knownBatch(uint256 batchId) internal view returns (Batch storage batch) {
        batch = _batches[batchId];
        if (batch.state == DisbursementState.None) revert UnknownBatch(batchId);
    }
}
