// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { ISettlementModule } from "../../interfaces/ISettlementModule.sol";
import { ISettlementPersonalServicePurchases as Personal } from "../../interfaces/ISettlementPersonalServicePurchases.sol";
import { SettlementPlanLib } from "./PlanLib.sol";
import { PersonalPurchaseStorageLib as Store } from "./PersonalPurchaseStorageLib.sol";
import { PersonalPurchaseConsentLib as Consent } from "./PersonalPurchaseConsentLib.sol";
import { PersonalFundingLib } from "./PersonalFundingLib.sol";
import { PersonalPurchaseOutcomeLib as Outcome } from "./PersonalPurchaseOutcomeLib.sol";
import { SettlementFundingGuardLib as Guard } from "./FundingGuardLib.sol";
import { SettlementFundingRefundLib } from "./FundingRefundLib.sol";

/// @notice Member funding records and their single persistent refund authority.
/// @dev Uses a dedicated ERC-7201 namespace so the frozen SettlementModule layout is unchanged.
library SettlementFundingLib {
    /// @custom:storage-location erc7201:green.goods.settlement.commitment-funding
    struct State {
        uint256 nextFundingId;
        mapping(uint256 fundingId => ISettlementModule.CommitmentFunding funding) fundings;
        mapping(uint256 commitmentId => mapping(address funder => uint256 fundingId)) fundingOfCommitmentFunder;
        mapping(bytes32 depositReference => uint256 fundingId) fundingByDepositReference;
        mapping(uint256 disbursementId => uint256 fundingId) fundingOfRefundDisbursement;
        mapping(uint256 commitmentId => uint256 fundingId) consumedFundingOfCommitment;
    }

    /// @dev ERC-7201: keccak256(abi.encode(uint256(keccak256(namespace)) - 1)) & ~0xff.
    bytes32 private constant _STATE_SLOT = 0x14790e171eb52cfebe9fb0c814ca455ea33a3bcc183d5784757d5df85dd1e400;

    struct RuntimeConfig {
        address hatsModule;
        address poolingModule;
        address gDollarToken;
        uint64 destinationEvmChainId;
        bool paused;
    }

    event FundingPledged(
        uint256 indexed fundingId,
        uint256 indexed commitmentId,
        address indexed funder,
        address garden,
        address refundAccount,
        uint256 expectedAmount,
        address recordedBy
    );
    event FundingDepositRecorded(
        uint256 indexed fundingId, bytes32 indexed depositReference, uint256 amount, address indexed recordedBy
    );
    event FundingConsumed(
        uint256 indexed fundingId,
        uint256 indexed commitmentId,
        address indexed funder,
        uint256 depositedAmount,
        address consumedBy
    );
    event FundingWithdrawn(
        uint256 indexed fundingId, uint256 indexed commitmentId, address indexed funder, address withdrawnBy
    );
    event DisbursementQueued(
        uint256 indexed disbursementId,
        uint256 indexed commitmentId,
        address indexed garden,
        uint256 payoutPlanId,
        address contributor,
        address executorGarden,
        uint8 kind,
        uint8 fundingRoute,
        address source,
        address recipient,
        address token,
        uint256 amount
    );

    function recordFunding(
        mapping(address garden => ISettlementModule.SettlementAccount account) storage accounts,
        RuntimeConfig memory config,
        uint256 commitmentId,
        address funder,
        address refundAccount
    )
        public
        returns (uint256 fundingId)
    {
        _requireConfiguration(config);
        if (funder == address(0) || refundAccount == address(0)) revert ISettlementModule.ZeroAddress();

        ICommitmentPoolingModule.Commitment memory commitment =
            ICommitmentPoolingModule(config.poolingModule).getCommitment(commitmentId);
        ICommitmentPoolingModule.Pool memory pool =
            ICommitmentPoolingModule(config.poolingModule).getPool(commitment.poolId);
        if (commitment.state == ICommitmentPoolingModule.CommitmentState.None || pool.garden == address(0)) {
            revert ISettlementModule.ConsiderationNotDeclared(commitmentId);
        }
        Consent.requireLegacy(config.poolingModule, commitmentId);
        Guard.requireSteward(config.hatsModule, pool.garden);
        ISettlementModule.SettlementAccount storage source =
            Guard.activeAccount(accounts, pool.garden, config.destinationEvmChainId);
        if (refundAccount == source.account) revert ISettlementModule.InvalidPayoutVector();

        State storage state = fundingState();
        fundingId = state.fundingOfCommitmentFunder[commitmentId][funder];
        if (fundingId != 0) {
            ISettlementModule.CommitmentFunding storage existing = state.fundings[fundingId];
            if (
                existing.commitmentId != commitmentId || existing.funder != funder || existing.garden != pool.garden
                    || existing.refundAccount != refundAccount || existing.expectedAmount != commitment.consideration.amount
            ) revert ISettlementModule.FundingRecordConflict(commitmentId, funder, fundingId);
            return fundingId;
        }

        _validatePledge(config.poolingModule, commitmentId, funder, pool.garden, commitment);
        fundingId = state.nextFundingId;
        if (fundingId == 0) fundingId = 1;
        state.nextFundingId = fundingId + 1;
        state.fundingOfCommitmentFunder[commitmentId][funder] = fundingId;
        state.fundings[fundingId] = ISettlementModule.CommitmentFunding({
            commitmentId: commitmentId,
            funder: funder,
            garden: pool.garden,
            refundAccount: refundAccount,
            expectedAmount: commitment.consideration.amount,
            depositedAmount: 0,
            depositReference: bytes32(0),
            state: ISettlementModule.FundingState.Pledged,
            refundDisbursementId: 0,
            pledgedAt: uint64(block.timestamp),
            depositRecordedAt: 0,
            consumedAt: 0,
            closedAt: 0
        });
        emit FundingPledged(
            fundingId, commitmentId, funder, pool.garden, refundAccount, commitment.consideration.amount, msg.sender
        );
    }

    function recordFundingDeposit(
        mapping(address garden => ISettlementModule.SettlementAccount account) storage accounts,
        RuntimeConfig memory config,
        uint256 fundingId,
        uint256 amount,
        bytes32 depositReference
    )
        public
    {
        ISettlementModule.CommitmentFunding storage funding = _knownFunding(fundingId);
        if (Store.state().purchases[fundingId].terms.version != 0) {
            revert Personal.PersonalServiceDepositProofRequired(fundingId);
        }
        Guard.requireSteward(config.hatsModule, funding.garden);
        Guard.activeAccount(accounts, funding.garden, config.destinationEvmChainId);
        if (funding.state != ISettlementModule.FundingState.Pledged) {
            revert ISettlementModule.CommitmentFundingNotInState(fundingId, funding.state);
        }
        if (depositReference == bytes32(0)) revert ISettlementModule.FundingDepositReferenceRequired();
        State storage state = fundingState();
        uint256 existingFundingId = state.fundingByDepositReference[depositReference];
        if (existingFundingId != 0) {
            revert ISettlementModule.FundingDepositReferenceUsed(depositReference, existingFundingId);
        }
        if (amount < funding.expectedAmount) {
            revert ISettlementModule.FundingDepositBelowPrice(fundingId, funding.expectedAmount, amount);
        }

        state.fundingByDepositReference[depositReference] = fundingId;
        funding.depositedAmount = amount;
        funding.depositReference = depositReference;
        funding.state = ISettlementModule.FundingState.DepositRecorded;
        funding.depositRecordedAt = uint64(block.timestamp);
        emit FundingDepositRecorded(fundingId, depositReference, amount, msg.sender);
    }

    function consumeFunding(
        mapping(address garden => ISettlementModule.SettlementAccount account) storage accounts,
        RuntimeConfig memory config,
        uint256 fundingId
    )
        public
    {
        ISettlementModule.CommitmentFunding storage funding = _knownFunding(fundingId);
        if (Store.state().purchases[fundingId].terms.version != 0) {
            PersonalFundingLib.consume(fundingState(), accounts, config, fundingId);
            return;
        }
        // Historical pledges/deposits may wind down after opt-in, but cannot claim the
        // permanent consumed pointer of a newly opted-in service promise.
        Consent.requireLegacy(config.poolingModule, funding.commitmentId);
        Guard.requireSteward(config.hatsModule, funding.garden);
        Guard.activeAccount(accounts, funding.garden, config.destinationEvmChainId);
        if (funding.state != ISettlementModule.FundingState.DepositRecorded) {
            revert ISettlementModule.CommitmentFundingNotInState(fundingId, funding.state);
        }

        ICommitmentPoolingModule.Commitment memory commitment =
            ICommitmentPoolingModule(config.poolingModule).getCommitment(funding.commitmentId);
        if (
            commitment.state != ICommitmentPoolingModule.CommitmentState.Accepted
                || commitment.counterparty != funding.funder || commitment.payerGarden != funding.garden
        ) {
            revert ISettlementModule.FundingClaimantMismatch(fundingId, funding.funder, commitment.counterparty);
        }
        State storage state = fundingState();
        uint256 existingFundingId = state.consumedFundingOfCommitment[funding.commitmentId];
        if (existingFundingId != 0 && existingFundingId != fundingId) {
            revert ISettlementModule.FundingRecordConflict(funding.commitmentId, funding.funder, existingFundingId);
        }
        state.consumedFundingOfCommitment[funding.commitmentId] = fundingId;
        funding.state = ISettlementModule.FundingState.Consumed;
        funding.consumedAt = uint64(block.timestamp);
        emit FundingConsumed(fundingId, funding.commitmentId, funding.funder, funding.depositedAmount, msg.sender);
    }

    function queueFundingRefund(
        mapping(uint256 => ISettlementModule.Disbursement) storage disbursements,
        mapping(address => ISettlementModule.SettlementAccount) storage accounts,
        RuntimeConfig memory config,
        uint256 nextDisbursementId,
        uint256 fundingId
    )
        public
        returns (uint256 disbursementId, bool created)
    {
        return
            SettlementFundingRefundLib.queue(fundingState(), disbursements, accounts, config, nextDisbursementId, fundingId);
    }

    function recheckRefund(
        mapping(address => ISettlementModule.SettlementAccount) storage accounts,
        uint64 destinationEvmChainId,
        address gDollarToken,
        uint256 disbursementId,
        ISettlementModule.Disbursement storage disbursement
    )
        internal
        view
    {
        SettlementFundingRefundLib.recheck(
            fundingState(), accounts, destinationEvmChainId, gDollarToken, disbursementId, disbursement
        );
    }

    function recordRefundOutcome(uint256 disbursementId, bool success) internal {
        SettlementFundingRefundLib.recordOutcome(fundingState(), disbursementId, success);
    }

    function closeIfPlanComplete(SettlementPlanLib.State storage planState, uint256 payoutPlanId) public {
        if (
            payoutPlanId == 0
                || SettlementPlanLib.payoutPlanStatus(planState, payoutPlanId)
                    != ISettlementModule.PayoutPlanStatus.Complete
        ) return;
        ISettlementModule.CommitmentPayoutPlan storage plan = planState.payoutPlans[payoutPlanId];
        State storage state = fundingState();
        uint256 fundingId = state.consumedFundingOfCommitment[plan.commitmentId];
        if (fundingId == 0) return;
        ISettlementModule.CommitmentFunding storage funding = state.fundings[fundingId];
        if (funding.commitmentId != plan.commitmentId) {
            revert ISettlementModule.FundingRecordConflict(plan.commitmentId, funding.funder, fundingId);
        }
        if (funding.state != ISettlementModule.FundingState.Consumed) return;
        funding.state = ISettlementModule.FundingState.Closed;
        funding.closedAt = uint64(block.timestamp);
        Outcome.complete(fundingId, payoutPlanId, false);
    }

    function getCommitmentFunding(uint256 fundingId)
        public
        view
        returns (ISettlementModule.CommitmentFunding memory funding)
    {
        funding = _knownFunding(fundingId);
    }

    function fundingOfCommitmentFunder(uint256 commitmentId, address funder) public view returns (uint256) {
        return fundingState().fundingOfCommitmentFunder[commitmentId][funder];
    }

    function fundingRefundDisbursementOf(uint256 fundingId) public view returns (uint256) {
        return _knownFunding(fundingId).refundDisbursementId;
    }

    function pledgePersonalServicePurchase(
        mapping(address => ISettlementModule.SettlementAccount) storage accounts,
        RuntimeConfig memory config,
        Personal.PersonalPurchaseConsent calldata consent
    )
        public
        returns (uint256 fundingId, bytes32 purchaseId)
    {
        _requireConfiguration(config);
        return PersonalFundingLib.pledge(fundingState(), accounts, config, consent);
    }

    function recordPersonalServiceDeposit(
        RuntimeConfig memory config,
        uint256 fundingId,
        Personal.VerifiedCeloDeposit calldata deposit
    )
        public
    {
        PersonalFundingLib.recordDeposit(fundingState(), config, fundingId, deposit);
    }

    function getPersonalServicePurchase(uint256 fundingId)
        public
        view
        returns (Personal.PersonalServicePurchase memory purchase)
    {
        purchase = Store.state().purchases[fundingId];
        if (purchase.terms.version != 1) revert Personal.UnknownPersonalServicePurchase(fundingId);
    }

    function fundingOfPersonalServicePurchase(bytes32 purchaseId) public view returns (uint256) {
        return Store.state().fundingOfPurchase[purchaseId];
    }

    function personalServiceDepositFunding(
        uint64 chainId,
        bytes32 transactionHash,
        uint32 logIndex
    )
        public
        view
        returns (uint256)
    {
        return Store.state().fundingOfVerifiedReceipt[Store.receiptKey(chainId, transactionHash, logIndex)];
    }

    function requireServicePayout(
        mapping(address => ISettlementModule.SettlementAccount) storage accounts,
        RuntimeConfig memory config,
        uint256 commitmentId,
        uint256 payoutPlanId
    )
        internal
        view
    {
        Outcome.validatePayout(fundingState(), accounts, config, commitmentId, payoutPlanId);
    }

    function requireServicePlan(
        mapping(address => ISettlementModule.SettlementAccount) storage accounts,
        RuntimeConfig memory config,
        SettlementPlanLib.State storage plans,
        uint256 payoutPlanId
    )
        internal
        view
    {
        Outcome.validatePlan(fundingState(), accounts, config, payoutPlanId, plans.payoutPlans[payoutPlanId]);
    }

    function selectPersonalPayout(uint256 commitmentId, uint256 payoutPlanId) internal {
        Outcome.selectPayout(fundingState(), commitmentId, payoutPlanId);
    }

    function recheckPersonalDisbursement(
        mapping(address => ISettlementModule.SettlementAccount) storage accounts,
        RuntimeConfig memory config,
        SettlementPlanLib.State storage plans,
        uint256 disbursementId,
        ISettlementModule.Disbursement storage entry
    )
        internal
        view
    {
        if (
            entry.kind == ISettlementModule.DisbursementKind.ContributorConsideration
                || entry.kind == ISettlementModule.DisbursementKind.GardenBeneficiary
        ) {
            Outcome.validatePlan(
                fundingState(), accounts, config, entry.payoutPlanId, plans.payoutPlans[entry.payoutPlanId]
            );
        } else if (
            entry.kind == ISettlementModule.DisbursementKind.Refund
                && Outcome.isPersonal(fundingState(), disbursementId, entry)
        ) {
            recheckRefund(accounts, config.destinationEvmChainId, config.gDollarToken, disbursementId, entry);
        }
    }

    function rejectPersonalTerminalRecovery(
        uint256 disbursementId,
        ISettlementModule.Disbursement storage entry
    )
        internal
        view
    {
        if (Outcome.isPersonal(fundingState(), disbursementId, entry)) {
            revert Personal.PersonalServiceUnsafeRecovery(disbursementId);
        }
    }

    function requirePersonalRequeue(
        uint256 disbursementId,
        ISettlementModule.Disbursement storage entry,
        bool authenticatedFailure
    )
        internal
        view
    {
        if (
            Outcome.isPersonal(fundingState(), disbursementId, entry)
                && (!authenticatedFailure || entry.failureCode == uint8(ISettlementModule.FailureCode.SourceStranded))
        ) {
            revert Personal.PersonalServiceUnsafeRecovery(disbursementId);
        }
    }

    function _validatePledge(
        address poolingModule,
        uint256 commitmentId,
        address funder,
        address garden,
        ICommitmentPoolingModule.Commitment memory commitment
    )
        private
        view
    {
        if (
            commitment.state != ICommitmentPoolingModule.CommitmentState.Offered
                || commitment.direction != ICommitmentPoolingModule.CommitmentDirection.Offer
                || commitment.claimType != ICommitmentPoolingModule.ClaimType.Individual
                || commitment.claimMode != ICommitmentPoolingModule.ClaimMode.ApprovalGated
                || commitment.consideration.rail != ICommitmentPoolingModule.ConsiderationRail.CeloSettlement
                || commitment.consideration.source != address(0) || commitment.consideration.token != address(0)
                || commitment.consideration.amount == 0
        ) revert ISettlementModule.ConsiderationNotDeclared(commitmentId);
        ICommitmentPoolingModule.PendingClaim memory claim =
            ICommitmentPoolingModule(poolingModule).getPendingClaim(commitmentId, funder);
        if (
            !claim.active || claim.claimant != funder || claim.requestedBy != funder
                || claim.kind != ICommitmentPoolingModule.ClaimType.Individual || claim.gardenContext != garden
        ) revert ISettlementModule.FundingClaimantMismatch(commitmentId, funder, claim.claimant);
    }

    function _knownFunding(uint256 fundingId) private view returns (ISettlementModule.CommitmentFunding storage funding) {
        funding = fundingState().fundings[fundingId];
        if (funding.state == ISettlementModule.FundingState.None) {
            revert ISettlementModule.UnknownCommitmentFunding(fundingId);
        }
    }

    function _requireConfiguration(RuntimeConfig memory config) private pure {
        if (
            config.hatsModule == address(0) || config.poolingModule == address(0) || config.gDollarToken == address(0)
                || config.destinationEvmChainId == 0
        ) revert ISettlementModule.FundingConfigurationIncomplete();
    }

    function fundingState() internal pure returns (State storage state) {
        bytes32 slot = _STATE_SLOT;
        assembly ("memory-safe") {
            state.slot := slot
        }
    }
}
