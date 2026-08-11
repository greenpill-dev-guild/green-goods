// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { SettlementPlanLib } from "../../lib/Settlement/PlanLib.sol";
import { SettlementAdmin } from "./Admin.sol";

/// @title SettlementPlans
/// @notice Commitment payout-plan lifecycle: create, edit, finalize, and prepare payouts.
abstract contract SettlementPlans is SettlementAdmin {
    function createCommitmentPayoutPlan(
        uint256 commitmentId,
        RecognitionEntry[] calldata recognitionEntries,
        bytes32 recognitionSnapshotHash
    )
        external
        override
        nonReentrant
        returns (uint256 payoutPlanId)
    {
        return SettlementPlanLib.createCommitmentPayoutPlan(
            _planState,
            _settlementAccounts,
            SettlementPlanLib.RuntimeConfig({
                hatsModule: hatsModule,
                poolingModule: commitmentPoolingModule,
                gDollarToken: gDollarToken,
                destinationEvmChainId: DESTINATION_EVM_CHAIN_ID
            }),
            commitmentId,
            recognitionEntries,
            recognitionSnapshotHash
        );
    }

    function setContributorPayouts(
        uint256 payoutPlanId,
        uint256 gardenRetainedAmount,
        ContributorPayoutInput[] calldata payouts,
        string calldata reasonCID
    )
        external
        override
        nonReentrant
    {
        SettlementPlanLib.setContributorPayouts(
            _planState,
            _settlementAccounts,
            hatsModule,
            DESTINATION_EVM_CHAIN_ID,
            payoutPlanId,
            gardenRetainedAmount,
            payouts,
            reasonCID
        );
    }

    function finalizeCommitmentPayoutPlan(uint256 payoutPlanId) external override nonReentrant {
        SettlementPlanLib.finalizeCommitmentPayoutPlan(
            _planState, _settlementAccounts, hatsModule, commitmentPoolingModule, DESTINATION_EVM_CHAIN_ID, payoutPlanId
        );
    }

    function prepareContributorPayout(
        uint256 payoutPlanId,
        address contributor
    )
        external
        override
        nonReentrant
        returns (uint256 disbursementId)
    {
        bool created;
        (disbursementId, created) = SettlementPlanLib.prepareContributorPayout(
            _planState,
            _disbursements,
            _settlementAccounts,
            _preparationConfig(),
            _nextDisbursementId,
            payoutPlanId,
            contributor
        );
        if (created) _nextDisbursementId = disbursementId + 1;
    }

    function prepareGardenBeneficiaryPayout(uint256 payoutPlanId)
        external
        override
        nonReentrant
        returns (uint256 disbursementId)
    {
        bool created;
        (disbursementId, created) = SettlementPlanLib.prepareGardenBeneficiaryPayout(
            _planState, _disbursements, _settlementAccounts, _preparationConfig(), _nextDisbursementId, payoutPlanId
        );
        if (created) _nextDisbursementId = disbursementId + 1;
    }

    function _preparationConfig() private view returns (SettlementPlanLib.PreparationConfig memory) {
        return SettlementPlanLib.PreparationConfig({
            hatsModule: hatsModule,
            destinationEvmChainId: DESTINATION_EVM_CHAIN_ID,
            paused: paused,
            gardenerDeliveryEnabled: gardenerDeliveryEnabled
        });
    }
}
