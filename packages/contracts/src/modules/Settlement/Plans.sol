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
        CommitmentPayoutPlan storage plan = _knownPlan(payoutPlanId);
        _requireSteward(plan.payerGarden);
        if (!plan.finalized) revert PayoutPlanNotFinalized(payoutPlanId);
        if (plan.payoutKind != DisbursementKind.ContributorConsideration) {
            revert PayoutKindMismatch(payoutPlanId, DisbursementKind.ContributorConsideration, plan.payoutKind);
        }
        ContributorPayout storage payout = _planState.contributorPayouts[payoutPlanId][contributor];
        if (payout.contributor == address(0) || payout.amount == 0) {
            revert IneligibleContributor(plan.commitmentId, contributor);
        }
        if (payout.disbursementId != 0) return payout.disbursementId;

        _requireNotPaused();
        _activeAccountMatches(plan.payerGarden, plan.source);
        if (!gardenerDeliveryEnabled) revert GardenerDeliveryDisabled();
        disbursementId = _queueDisbursement(
            plan.commitmentId,
            payoutPlanId,
            contributor,
            plan.providerGarden,
            plan.payerGarden,
            DisbursementKind.ContributorConsideration,
            FundingRoute.None,
            plan.source,
            payout.recipient,
            plan.token,
            payout.amount
        );
        payout.disbursementId = disbursementId;
        ++plan.preparedPayoutCount;
    }

    function prepareGardenBeneficiaryPayout(uint256 payoutPlanId)
        external
        override
        nonReentrant
        returns (uint256 disbursementId)
    {
        CommitmentPayoutPlan storage plan = _knownPlan(payoutPlanId);
        _requireSteward(plan.payerGarden);
        if (!plan.finalized) revert PayoutPlanNotFinalized(payoutPlanId);
        if (plan.payoutKind != DisbursementKind.GardenBeneficiary) {
            revert PayoutKindMismatch(payoutPlanId, DisbursementKind.GardenBeneficiary, plan.payoutKind);
        }
        if (plan.beneficiaryDisbursementId != 0) return plan.beneficiaryDisbursementId;

        _requireNotPaused();
        _activeAccountMatches(plan.payerGarden, plan.source);
        _activeAccountMatches(plan.beneficiaryGarden, plan.beneficiaryRecipient);
        disbursementId = _queueDisbursement(
            plan.commitmentId,
            payoutPlanId,
            address(0),
            plan.beneficiaryGarden,
            plan.payerGarden,
            DisbursementKind.GardenBeneficiary,
            FundingRoute.None,
            plan.source,
            plan.beneficiaryRecipient,
            plan.token,
            plan.beneficiaryAmount
        );
        plan.beneficiaryDisbursementId = disbursementId;
        ++plan.preparedPayoutCount;
    }
}
