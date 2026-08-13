// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { IHatsModule } from "../../interfaces/IHatsModule.sol";
import { ISettlementModule } from "../../interfaces/ISettlementModule.sol";
import { SettlementPlanLib } from "./PlanLib.sol";

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
        _requireSteward(config.hatsModule, pool.garden);
        ISettlementModule.SettlementAccount storage source =
            _activeAccount(accounts, pool.garden, config.destinationEvmChainId);
        if (refundAccount == source.account) revert ISettlementModule.InvalidPayoutVector();

        State storage state = _state();
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
        _requireSteward(config.hatsModule, funding.garden);
        _activeAccount(accounts, funding.garden, config.destinationEvmChainId);
        if (funding.state != ISettlementModule.FundingState.Pledged) {
            revert ISettlementModule.CommitmentFundingNotInState(fundingId, funding.state);
        }
        if (depositReference == bytes32(0)) revert ISettlementModule.FundingDepositReferenceRequired();
        State storage state = _state();
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
        _requireSteward(config.hatsModule, funding.garden);
        _activeAccount(accounts, funding.garden, config.destinationEvmChainId);
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
        State storage state = _state();
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
        mapping(uint256 disbursementId => ISettlementModule.Disbursement disbursement) storage disbursements,
        mapping(address garden => ISettlementModule.SettlementAccount account) storage accounts,
        RuntimeConfig memory config,
        uint256 nextDisbursementId,
        uint256 fundingId
    )
        public
        returns (uint256 disbursementId, bool created)
    {
        ISettlementModule.CommitmentFunding storage funding = _knownFunding(fundingId);
        _requireSteward(config.hatsModule, funding.garden);
        disbursementId = funding.refundDisbursementId;
        if (disbursementId != 0) {
            if (_state().fundingOfRefundDisbursement[disbursementId] != fundingId) {
                revert ISettlementModule.FundingRefundAlreadyLinked(fundingId, disbursementId);
            }
            return (disbursementId, false);
        }
        if (funding.state == ISettlementModule.FundingState.Pledged) {
            funding.state = ISettlementModule.FundingState.Withdrawn;
            funding.closedAt = uint64(block.timestamp);
            emit FundingWithdrawn(fundingId, funding.commitmentId, funding.funder, msg.sender);
            return (0, false);
        }
        if (funding.state == ISettlementModule.FundingState.Consumed) {
            ICommitmentPoolingModule.Commitment memory commitment =
                ICommitmentPoolingModule(config.poolingModule).getCommitment(funding.commitmentId);
            if (
                commitment.state != ICommitmentPoolingModule.CommitmentState.Cancelled
                    && commitment.state != ICommitmentPoolingModule.CommitmentState.Expired
            ) revert ISettlementModule.FundingRefundNotEligible(fundingId);
        } else if (funding.state != ISettlementModule.FundingState.DepositRecorded) {
            revert ISettlementModule.FundingRefundNotEligible(fundingId);
        }
        if (config.paused) revert ISettlementModule.SourceMustBePaused();
        ISettlementModule.SettlementAccount storage source =
            _activeAccount(accounts, funding.garden, config.destinationEvmChainId);

        disbursementId = nextDisbursementId;
        if (disbursementId == 0) revert ISettlementModule.FundingConfigurationIncomplete();
        funding.refundDisbursementId = disbursementId;
        funding.state = ISettlementModule.FundingState.RefundQueued;
        State storage state = _state();
        state.fundingOfRefundDisbursement[disbursementId] = fundingId;
        disbursements[disbursementId] = ISettlementModule.Disbursement({
            commitmentId: funding.commitmentId,
            payoutPlanId: 0,
            contributor: funding.funder,
            garden: funding.garden,
            executorGarden: funding.garden,
            kind: ISettlementModule.DisbursementKind.Refund,
            fundingRoute: ISettlementModule.FundingRoute.None,
            source: source.account,
            recipient: funding.refundAccount,
            token: config.gDollarToken,
            amount: funding.depositedAmount,
            state: ISettlementModule.DisbursementState.Queued,
            batchId: 0,
            reasonCID: "",
            attempt: 0,
            executionKey: bytes32(0),
            commandMessageId: bytes32(0),
            dispatchedAt: 0,
            confirmedAt: 0,
            acknowledgmentMessageId: bytes32(0),
            failureCode: 0,
            cancelledFromState: ISettlementModule.DisbursementState.None
        });
        _emitRefundQueued(disbursementId, funding, source.account, config.gDollarToken);
        created = true;
    }

    function recheckRefund(
        mapping(address garden => ISettlementModule.SettlementAccount account) storage accounts,
        uint64 destinationEvmChainId,
        address gDollarToken,
        uint256 disbursementId,
        ISettlementModule.Disbursement storage disbursement
    )
        internal
        view
    {
        State storage state = _state();
        uint256 fundingId = state.fundingOfRefundDisbursement[disbursementId];
        ISettlementModule.CommitmentFunding storage funding = state.fundings[fundingId];
        if (
            fundingId == 0 || funding.refundDisbursementId != disbursementId
                || funding.state != ISettlementModule.FundingState.RefundQueued
        ) revert ISettlementModule.FundingRefundAlreadyLinked(fundingId, disbursementId);
        ISettlementModule.SettlementAccount storage source = _activeAccount(accounts, funding.garden, destinationEvmChainId);
        if (
            disbursement.commitmentId != funding.commitmentId || disbursement.payoutPlanId != 0
                || disbursement.contributor != funding.funder || disbursement.garden != funding.garden
                || disbursement.executorGarden != funding.garden || disbursement.source != source.account
                || disbursement.recipient != funding.refundAccount || disbursement.token != gDollarToken
                || disbursement.amount != funding.depositedAmount
                || disbursement.kind != ISettlementModule.DisbursementKind.Refund
                || disbursement.fundingRoute != ISettlementModule.FundingRoute.None
        ) revert ISettlementModule.FundingRefundAlreadyLinked(fundingId, disbursementId);
    }

    function recordRefundOutcome(uint256 disbursementId, bool success) internal {
        if (!success) return;
        State storage state = _state();
        uint256 fundingId = state.fundingOfRefundDisbursement[disbursementId];
        if (fundingId == 0) return;
        ISettlementModule.CommitmentFunding storage funding = state.fundings[fundingId];
        if (funding.refundDisbursementId != disbursementId || funding.state != ISettlementModule.FundingState.RefundQueued)
        {
            revert ISettlementModule.FundingRefundAlreadyLinked(fundingId, disbursementId);
        }
        funding.state = ISettlementModule.FundingState.Refunded;
        funding.closedAt = uint64(block.timestamp);
    }

    function closeIfPlanComplete(SettlementPlanLib.State storage planState, uint256 payoutPlanId) public {
        if (
            payoutPlanId == 0
                || SettlementPlanLib.payoutPlanStatus(planState, payoutPlanId) != ISettlementModule.PayoutPlanStatus.Complete
        ) return;
        ISettlementModule.CommitmentPayoutPlan storage plan = planState.payoutPlans[payoutPlanId];
        State storage state = _state();
        uint256 fundingId = state.consumedFundingOfCommitment[plan.commitmentId];
        if (fundingId == 0) return;
        ISettlementModule.CommitmentFunding storage funding = state.fundings[fundingId];
        if (funding.commitmentId != plan.commitmentId) {
            revert ISettlementModule.FundingRecordConflict(plan.commitmentId, funding.funder, fundingId);
        }
        if (funding.state != ISettlementModule.FundingState.Consumed) return;
        funding.state = ISettlementModule.FundingState.Closed;
        funding.closedAt = uint64(block.timestamp);
    }

    function getCommitmentFunding(uint256 fundingId)
        public
        view
        returns (ISettlementModule.CommitmentFunding memory funding)
    {
        funding = _knownFunding(fundingId);
    }

    function fundingOfCommitmentFunder(uint256 commitmentId, address funder) public view returns (uint256) {
        return _state().fundingOfCommitmentFunder[commitmentId][funder];
    }

    function fundingRefundDisbursementOf(uint256 fundingId) public view returns (uint256) {
        return _knownFunding(fundingId).refundDisbursementId;
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

    function _emitRefundQueued(
        uint256 disbursementId,
        ISettlementModule.CommitmentFunding storage funding,
        address source,
        address token
    )
        private
    {
        emit DisbursementQueued(
            disbursementId,
            funding.commitmentId,
            funding.garden,
            0,
            funding.funder,
            funding.garden,
            uint8(ISettlementModule.DisbursementKind.Refund),
            uint8(ISettlementModule.FundingRoute.None),
            source,
            funding.refundAccount,
            token,
            funding.depositedAmount
        );
    }

    function _knownFunding(uint256 fundingId) private view returns (ISettlementModule.CommitmentFunding storage funding) {
        funding = _state().fundings[fundingId];
        if (funding.state == ISettlementModule.FundingState.None) {
            revert ISettlementModule.UnknownCommitmentFunding(fundingId);
        }
    }

    function _activeAccount(
        mapping(address garden => ISettlementModule.SettlementAccount account) storage accounts,
        address garden,
        uint64 destinationEvmChainId
    )
        private
        view
        returns (ISettlementModule.SettlementAccount storage account)
    {
        account = accounts[garden];
        if (account.account == address(0)) revert ISettlementModule.UnknownSettlementAccount(garden);
        if (!account.active) revert ISettlementModule.SettlementAccountInactive(garden);
        if (account.chainId != destinationEvmChainId) {
            revert ISettlementModule.InvalidSettlementChain(account.chainId);
        }
    }

    function _requireSteward(address hatsModule, address garden) private view {
        if (hatsModule == address(0)) revert ISettlementModule.FundingConfigurationIncomplete();
        if (
            !IHatsModule(hatsModule).isStewardOf(garden, msg.sender)
                && !IHatsModule(hatsModule).isOwnerOf(garden, msg.sender)
        ) {
            revert ISettlementModule.NotSettlementSteward(msg.sender, garden);
        }
    }

    function _requireConfiguration(RuntimeConfig memory config) private pure {
        if (
            config.hatsModule == address(0) || config.poolingModule == address(0) || config.gDollarToken == address(0)
                || config.destinationEvmChainId == 0
        ) revert ISettlementModule.FundingConfigurationIncomplete();
    }

    function _state() private pure returns (State storage state) {
        bytes32 slot = _STATE_SLOT;
        assembly ("memory-safe") {
            state.slot := slot
        }
    }
}
