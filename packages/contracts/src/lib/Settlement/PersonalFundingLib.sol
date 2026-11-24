// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule as Core } from "../../interfaces/ICommitmentPoolingModule.sol";
import { ISettlementModule as Settlement } from "../../interfaces/ISettlementModule.sol";
import { ISettlementPersonalServicePurchases as Personal } from "../../interfaces/ISettlementPersonalServicePurchases.sol";
import { SettlementFundingLib } from "./FundingLib.sol";
import { SettlementFundingGuardLib as Guard } from "./FundingGuardLib.sol";
import { PersonalPurchaseStorageLib as Store } from "./PersonalPurchaseStorageLib.sol";
import { PersonalPurchaseConsentLib as Consent } from "./PersonalPurchaseConsentLib.sol";

/// @notice Funding bookkeeping for one exact buyer-approved service booking and one verified deposit.
library PersonalFundingLib {
    function pledge(
        SettlementFundingLib.State storage state,
        mapping(address garden => Settlement.SettlementAccount account) storage accounts,
        SettlementFundingLib.RuntimeConfig memory config,
        Personal.PersonalPurchaseConsent calldata consent
    )
        internal
        returns (uint256 fundingId, bytes32 purchaseId)
    {
        Personal.PersonalPurchaseTerms memory terms = Consent.bind(accounts, config, consent);
        Store.State storage personal = Store.state();
        purchaseId = terms.purchaseId;
        fundingId = personal.fundingOfPurchase[purchaseId];
        if (fundingId != 0) {
            Settlement.FundingState status = state.fundings[fundingId].state;
            if (status != Settlement.FundingState.Pledged && status != Settlement.FundingState.DepositRecorded) {
                revert Settlement.FundingRecordConflict(terms.commitmentId, terms.buyer, fundingId);
            }
            return (fundingId, purchaseId);
        }
        uint256 priorId = state.fundingOfCommitmentFunder[terms.commitmentId][terms.buyer];
        if (priorId != 0) {
            Settlement.FundingState previous = state.fundings[priorId].state;
            if (
                (previous != Settlement.FundingState.Withdrawn && previous != Settlement.FundingState.Refunded)
                    || personal.purchases[priorId].terms.requestNonce >= terms.requestNonce
            ) {
                revert Settlement.FundingRecordConflict(terms.commitmentId, terms.buyer, priorId);
            }
        }
        if (state.consumedFundingOfCommitment[terms.commitmentId] != 0) {
            revert Personal.PersonalServiceFundingRequired(terms.commitmentId);
        }
        fundingId = state.nextFundingId;
        if (fundingId == 0) fundingId = 1;
        state.nextFundingId = fundingId + 1;
        state.fundingOfCommitmentFunder[terms.commitmentId][terms.buyer] = fundingId;
        state.fundings[fundingId] = Settlement.CommitmentFunding({
            commitmentId: terms.commitmentId,
            funder: terms.buyer,
            garden: terms.buyerGarden,
            refundAccount: terms.refundAccount,
            expectedAmount: terms.price,
            depositedAmount: 0,
            depositReference: bytes32(0),
            state: Settlement.FundingState.Pledged,
            refundDisbursementId: 0,
            pledgedAt: uint64(block.timestamp),
            depositRecordedAt: 0,
            consumedAt: 0,
            closedAt: 0
        });
        personal.purchases[fundingId].terms = terms;
        personal.fundingOfPurchase[purchaseId] = fundingId;
        emit Settlement.FundingPledged(
            fundingId, terms.commitmentId, terms.buyer, terms.buyerGarden, terms.refundAccount, terms.price, msg.sender
        );
        emit Personal.PersonalServicePurchasePledged(purchaseId, fundingId, terms.commitmentId, terms);
    }

    function recordDeposit(
        SettlementFundingLib.State storage state,
        SettlementFundingLib.RuntimeConfig memory config,
        uint256 fundingId,
        Personal.VerifiedCeloDeposit calldata deposit
    )
        internal
    {
        Store.State storage personal = Store.state();
        Personal.PersonalServicePurchase storage purchase = personal.purchases[fundingId];
        Personal.PersonalPurchaseTerms storage terms = purchase.terms;
        if (terms.version != 1) revert Personal.UnknownPersonalServicePurchase(fundingId);
        Guard.requireSteward(config.hatsModule, terms.buyerGarden);
        Settlement.CommitmentFunding storage funding = state.fundings[fundingId];
        bool late = funding.state == Settlement.FundingState.Withdrawn;
        if (funding.state != Settlement.FundingState.Pledged && !late) {
            revert Settlement.CommitmentFundingNotInState(fundingId, funding.state);
        }
        if (
            purchase.outcome != Personal.PersonalPurchaseOutcome.None || funding.depositReference != bytes32(0)
                || funding.depositedAmount != 0 || funding.refundDisbursementId != 0
        ) {
            revert Personal.PersonalServiceReceiptMismatch(fundingId);
        }
        // These are privileged, offchain-verified receipt facts. No supplied hash or Safe balance
        // cryptographically proves a Celo transfer on the source chain.
        if (
            deposit.chainId != terms.destinationChainId || deposit.token != terms.token
                || deposit.depositingAccount != terms.authorizedDepositor || deposit.custodySafe != terms.custodySafe
                || deposit.transactionHash == bytes32(0) || deposit.blockHash == bytes32(0) || deposit.blockNumber == 0
                || deposit.receivedAmount == 0 || deposit.receivedAmount > deposit.grossDebit
        ) {
            revert Personal.PersonalServiceReceiptMismatch(fundingId);
        }
        bytes32 key = Store.receiptKey(deposit.chainId, deposit.transactionHash, deposit.logIndex);
        uint256 existing = personal.fundingOfVerifiedReceipt[key];
        if (existing != 0) revert Settlement.FundingDepositReferenceUsed(key, existing);
        personal.fundingOfVerifiedReceipt[key] = fundingId;
        purchase.deposit = deposit;
        funding.depositReference = key;
        funding.depositedAmount = deposit.receivedAmount;
        funding.depositRecordedAt = uint64(block.timestamp);
        funding.state = Settlement.FundingState.DepositRecorded;
        funding.closedAt = 0;
        emit Settlement.FundingDepositRecorded(fundingId, key, deposit.receivedAmount, msg.sender);
        emit Personal.PersonalServiceDepositVerified(key, fundingId, terms.purchaseId, deposit, msg.sender);
        if (late) {
            // Revoked financial consent is never revived by money arriving late. Reopen only
            // the exact refund obligation; a newer booking's pointer and consent remain untouched.
            purchase.outcome = Personal.PersonalPurchaseOutcome.Refund;
            emit Personal.PersonalServicePurchaseOutcomeSelected(terms.purchaseId, fundingId, purchase.outcome, 0, 0);
        }
    }

    function consume(
        SettlementFundingLib.State storage state,
        mapping(address garden => Settlement.SettlementAccount account) storage accounts,
        SettlementFundingLib.RuntimeConfig memory config,
        uint256 fundingId
    )
        internal
    {
        Personal.PersonalServicePurchase storage purchase = Store.state().purchases[fundingId];
        Personal.PersonalPurchaseTerms storage terms = purchase.terms;
        Settlement.CommitmentFunding storage funding = state.fundings[fundingId];
        Guard.requireSteward(config.hatsModule, terms.buyerGarden);
        if (funding.state != Settlement.FundingState.DepositRecorded) {
            revert Settlement.CommitmentFundingNotInState(fundingId, funding.state);
        }
        if (purchase.outcome != Personal.PersonalPurchaseOutcome.None) {
            revert Personal.PersonalServiceOutcomeConflict(terms.purchaseId, purchase.outcome);
        }
        Core.Commitment memory commitment = Consent.requireAccepted(config, fundingId, terms);
        if (
            commitment.state != Core.CommitmentState.Accepted
                && commitment.state != Core.CommitmentState.ReadyForConfirmation
                && commitment.state != Core.CommitmentState.Fulfilled
        ) {
            revert Personal.PersonalServiceTermsChanged(fundingId);
        }
        if (Guard.activeAccount(accounts, terms.buyerGarden, terms.destinationChainId).account != terms.custodySafe) {
            revert Personal.PersonalServiceTermsChanged(fundingId);
        }
        if (funding.depositedAmount < terms.price) {
            revert Settlement.FundingDepositBelowPrice(fundingId, terms.price, funding.depositedAmount);
        }
        if (
            purchase.deposit.receivedAmount > terms.disclosedNetAmount
                || purchase.deposit.grossDebit > terms.disclosedGrossAmount
        ) {
            revert Personal.PersonalServiceExcessNotConsented(fundingId);
        }
        uint256 previous = state.consumedFundingOfCommitment[terms.commitmentId];
        if (previous != 0) revert Settlement.FundingRecordConflict(terms.commitmentId, terms.buyer, previous);
        state.consumedFundingOfCommitment[terms.commitmentId] = fundingId;
        funding.state = Settlement.FundingState.Consumed;
        funding.consumedAt = uint64(block.timestamp);
        emit Settlement.FundingConsumed(fundingId, terms.commitmentId, terms.buyer, funding.depositedAmount, msg.sender);
    }
}
