// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule as Core } from "../../interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentServiceOffers as Service } from "../../interfaces/ICommitmentServiceOffers.sol";
import { ISettlementModule as Settlement } from "../../interfaces/ISettlementModule.sol";
import { ISettlementPersonalServicePurchases as Personal } from "../../interfaces/ISettlementPersonalServicePurchases.sol";
import { SettlementFundingLib } from "./FundingLib.sol";
import { SettlementFundingGuardLib as Guard } from "./FundingGuardLib.sol";
import { PersonalPurchaseStorageLib as Store } from "./PersonalPurchaseStorageLib.sol";
import { PersonalPurchaseConsentLib as Consent } from "./PersonalPurchaseConsentLib.sol";

/// @notice A personal booking chooses full settlement or full recorded-net refund exactly once.
library PersonalPurchaseOutcomeLib {
    function validatePayout(
        SettlementFundingLib.State storage state,
        mapping(address garden => Settlement.SettlementAccount account) storage accounts,
        SettlementFundingLib.RuntimeConfig memory config,
        uint256 commitmentId,
        uint256 payoutPlanId
    )
        internal
        view
    {
        Service.ServicePaymentRoute route = Consent.offer(config.poolingModule, commitmentId).terms.route;
        if (route == Service.ServicePaymentRoute.Legacy) return;
        if (route != Service.ServicePaymentRoute.PersonalGd) revert Personal.PersonalServiceModeRequired(commitmentId);
        uint256 fundingId = state.consumedFundingOfCommitment[commitmentId];
        Personal.PersonalServicePurchase storage purchase = Store.state().purchases[fundingId];
        Settlement.CommitmentFunding storage funding = state.fundings[fundingId];
        Personal.PersonalPurchaseTerms storage terms = purchase.terms;
        if (
            terms.version != 1 || funding.state != Settlement.FundingState.Consumed || terms.commitmentId != commitmentId
                || funding.funder != terms.buyer || funding.garden != terms.buyerGarden
                || funding.refundAccount != terms.refundAccount || funding.expectedAmount != terms.price
                || funding.depositedAmount != purchase.deposit.receivedAmount || funding.depositedAmount < terms.price
        ) {
            revert Personal.PersonalServiceFundingRequired(commitmentId);
        }
        if (
            Consent.requireAccepted(config, fundingId, terms).state != Core.CommitmentState.Fulfilled
                || Guard.activeAccount(accounts, terms.buyerGarden, terms.destinationChainId).account != terms.custodySafe
        ) {
            revert Personal.PersonalServiceTermsChanged(fundingId);
        }
        bool validOutcome = payoutPlanId == 0
            ? purchase.outcome == Personal.PersonalPurchaseOutcome.None
            : purchase.outcome == Personal.PersonalPurchaseOutcome.Payout && purchase.payoutPlanId == payoutPlanId;
        if (!validOutcome) revert Personal.PersonalServiceOutcomeConflict(terms.purchaseId, purchase.outcome);
    }

    function validatePlan(
        SettlementFundingLib.State storage state,
        mapping(address garden => Settlement.SettlementAccount account) storage accounts,
        SettlementFundingLib.RuntimeConfig memory config,
        uint256 payoutPlanId,
        Settlement.CommitmentPayoutPlan storage plan
    )
        internal
        view
    {
        validatePayout(state, accounts, config, plan.commitmentId, payoutPlanId);
        uint256 fundingId = state.consumedFundingOfCommitment[plan.commitmentId];
        Personal.PersonalPurchaseTerms storage terms = Store.state().purchases[fundingId].terms;
        if (terms.version == 0) return;
        if (
            plan.payerGarden != terms.buyerGarden || plan.providerGarden != terms.providerGarden
                || plan.source != terms.custodySafe || plan.token != terms.token || plan.declaredAmount != terms.price
                || plan.payoutKind != Settlement.DisbursementKind.ContributorConsideration
        ) {
            revert Personal.PersonalServiceTermsChanged(fundingId);
        }
    }

    function selectPayout(SettlementFundingLib.State storage state, uint256 commitmentId, uint256 payoutPlanId) internal {
        uint256 fundingId = state.consumedFundingOfCommitment[commitmentId];
        Personal.PersonalServicePurchase storage purchase = Store.state().purchases[fundingId];
        if (purchase.terms.version == 0) return;
        if (purchase.outcome != Personal.PersonalPurchaseOutcome.None) {
            revert Personal.PersonalServiceOutcomeConflict(purchase.terms.purchaseId, purchase.outcome);
        }
        purchase.outcome = Personal.PersonalPurchaseOutcome.Payout;
        purchase.payoutPlanId = payoutPlanId;
        emit Personal.PersonalServicePurchaseOutcomeSelected(
            purchase.terms.purchaseId, fundingId, purchase.outcome, payoutPlanId, 0
        );
    }

    function requireRefundEligible(
        SettlementFundingLib.RuntimeConfig memory config,
        uint256 fundingId,
        Settlement.CommitmentFunding storage funding
    )
        internal
        view
    {
        Personal.PersonalServicePurchase storage purchase = Store.state().purchases[fundingId];
        if (purchase.terms.version == 0) return;
        if (
            purchase.outcome == Personal.PersonalPurchaseOutcome.Refund
                || purchase.outcome == Personal.PersonalPurchaseOutcome.Refunded
        ) return;
        if (purchase.outcome != Personal.PersonalPurchaseOutcome.None) {
            revert Personal.PersonalServiceOutcomeConflict(purchase.terms.purchaseId, purchase.outcome);
        }
        Core.Commitment memory commitment = Core(config.poolingModule).getCommitment(funding.commitmentId);
        if (commitment.state == Core.CommitmentState.Cancelled || commitment.state == Core.CommitmentState.Expired) return;
        if (commitment.state == Core.CommitmentState.Disputed) {
            revert Settlement.FundingRefundNotEligible(fundingId);
        }
        if (commitment.counterparty == funding.funder) {
            bytes32 acceptedHash =
                Service(config.poolingModule).getAcceptedServiceTerms(funding.commitmentId).consent.claimHash;
            if (acceptedHash != bytes32(0) && acceptedHash != purchase.terms.claimHash) return;
            revert Settlement.FundingRefundNotEligible(fundingId);
        }
        if (commitment.counterparty != address(0)) return;
        _requireNoActiveBooking(config.poolingModule, fundingId, funding, purchase.terms);
    }

    function _requireNoActiveBooking(
        address poolingModule,
        uint256 fundingId,
        Settlement.CommitmentFunding storage funding,
        Personal.PersonalPurchaseTerms storage terms
    )
        private
        view
    {
        Core.PendingClaim memory pending = Core(poolingModule).getPendingClaim(funding.commitmentId, funding.funder);
        Service.ServiceClaimConsent memory claim =
            Service(poolingModule).getServiceClaimConsent(funding.commitmentId, funding.funder);
        Service.ServiceOfferTerms memory current = Consent.offer(poolingModule, funding.commitmentId);
        if (
            pending.active && claim.claimHash == terms.claimHash && current.revision == terms.termsRevision
                && current.termsHash == terms.termsHash
        ) {
            revert Settlement.FundingRefundNotEligible(fundingId);
        }
    }

    function selectRefund(uint256 fundingId, uint256 disbursementId) internal {
        Personal.PersonalServicePurchase storage purchase = Store.state().purchases[fundingId];
        if (purchase.terms.version == 0) return;
        if (
            purchase.outcome != Personal.PersonalPurchaseOutcome.None
                && purchase.outcome != Personal.PersonalPurchaseOutcome.Refund
        ) {
            revert Personal.PersonalServiceOutcomeConflict(purchase.terms.purchaseId, purchase.outcome);
        }
        purchase.outcome = Personal.PersonalPurchaseOutcome.Refund;
        emit Personal.PersonalServicePurchaseOutcomeSelected(
            purchase.terms.purchaseId, fundingId, purchase.outcome, 0, disbursementId
        );
    }

    function recheckRefund(uint256 fundingId, uint64 chainId, Settlement.Disbursement storage disbursement) internal view {
        Personal.PersonalServicePurchase storage purchase = Store.state().purchases[fundingId];
        if (purchase.terms.version == 0) return;
        if (
            purchase.outcome != Personal.PersonalPurchaseOutcome.Refund || disbursement.source != purchase.terms.custodySafe
                || disbursement.token != purchase.terms.token || chainId != purchase.terms.destinationChainId
        ) revert Personal.PersonalServiceReceiptMismatch(fundingId);
    }

    function complete(uint256 fundingId, uint256 payoutPlanId, bool refund) internal {
        Personal.PersonalServicePurchase storage purchase = Store.state().purchases[fundingId];
        if (purchase.terms.version == 0) return;
        Personal.PersonalPurchaseOutcome expected =
            refund ? Personal.PersonalPurchaseOutcome.Refund : Personal.PersonalPurchaseOutcome.Payout;
        if (purchase.outcome != expected || (!refund && purchase.payoutPlanId != payoutPlanId)) {
            revert Personal.PersonalServiceOutcomeConflict(purchase.terms.purchaseId, purchase.outcome);
        }
        purchase.outcome = refund ? Personal.PersonalPurchaseOutcome.Refunded : Personal.PersonalPurchaseOutcome.Settled;
        emit Personal.PersonalServicePurchaseOutcomeCompleted(purchase.terms.purchaseId, fundingId, purchase.outcome);
    }

    function isPersonal(
        SettlementFundingLib.State storage state,
        uint256 id,
        Settlement.Disbursement storage disbursement
    )
        internal
        view
        returns (bool)
    {
        if (disbursement.kind == Settlement.DisbursementKind.Refund) {
            return Store.state().purchases[state.fundingOfRefundDisbursement[id]].terms.version != 0;
        }
        if (
            disbursement.kind != Settlement.DisbursementKind.ContributorConsideration
                && disbursement.kind != Settlement.DisbursementKind.GardenBeneficiary
        ) return false;
        uint256 fundingId = state.consumedFundingOfCommitment[disbursement.commitmentId];
        if (Store.state().purchases[fundingId].terms.version != 0) return true;
        // Classification must not depend solely on the funding pointer being defended. An
        // opted-in payout stays ineligible for timeout replacement even if bookkeeping is absent.
        return Consent.offer(Settlement(address(this)).commitmentPoolingModule(), disbursement.commitmentId).terms.route
            != Service.ServicePaymentRoute.Legacy;
    }
}
