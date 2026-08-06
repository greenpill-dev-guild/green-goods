// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingRoster } from "./CommitmentPoolingRoster.sol";

/// @title CommitmentPoolingTerms
/// @notice Pre-acceptance term edits and the Arbitrum-rail reward record.
/// @dev Terms are steward-editable only while nobody has accepted them; once a counterparty is
///      bound, reward, valuation, and confirmer terms are the agreement and stop moving.
abstract contract CommitmentPoolingTerms is CommitmentPoolingRoster {
    /// @notice Declared reward is a reference to a payment made elsewhere, never custody.
    function setDeclaredReward(
        uint256 commitmentId,
        ICommitmentPoolingModule.DeclaredReward calldata reward
    )
        external
        whenOperational
    {
        ICommitmentPoolingModule.Commitment storage commitment = _requireEditableTerms(commitmentId);
        _validateReward(reward);

        commitment.reward = reward;
        // Unlike creation, an explicit steward edit always emits: clearing a declared reward is
        // itself a record the indexer and the counterparty need to see.
        emit ICommitmentPoolingModule.RewardDeclared(commitmentId, reward.rail, reward.source, reward.token, reward.amount);
    }

    /// @notice Records-only valuation term; no protocol arithmetic consumes it.
    function setDeclaredValue(
        uint256 commitmentId,
        uint256 declaredUnitValue,
        string calldata declaredValueBasis
    )
        external
        whenOperational
    {
        ICommitmentPoolingModule.Commitment storage commitment = _requireEditableTerms(commitmentId);
        _validateDeclaredValue(declaredUnitValue, declaredValueBasis);

        commitment.declaredUnitValue = declaredUnitValue;
        commitment.declaredValueBasis = declaredValueBasis;
        emit ICommitmentPoolingModule.ValueDeclared(commitmentId, declaredUnitValue, declaredValueBasis);
    }

    /// @notice Replaces the whole confirmer rule: named group, threshold, and fallback selection.
    function setConfirmerRule(
        uint256 commitmentId,
        address[] calldata confirmers,
        uint32 threshold,
        bool protocolFallbackEnabled
    )
        external
        whenOperational
    {
        ICommitmentPoolingModule.Commitment storage commitment = _requireEditableTerms(commitmentId);
        _validateConfirmerRule(confirmers, threshold, protocolFallbackEnabled);

        // An empty group means the direction-aware default confirmer, who is exactly one address.
        uint32 effectiveThreshold = confirmers.length == 0 ? 1 : threshold;
        delete commitmentConfirmers[commitmentId];
        for (uint256 i = 0; i < confirmers.length; i++) {
            commitmentConfirmers[commitmentId].push(confirmers[i]);
        }
        commitment.confirmationThreshold = effectiveThreshold;
        commitment.protocolFallbackEnabled = protocolFallbackEnabled;

        // Same order as every roster mutation: write first, then prove the rule this write would
        // actually produce can still confirm. A revert unwinds the rewrite entirely.
        _assertConfirmationReachable(commitmentId, commitment);
        emit ICommitmentPoolingModule.ConfirmerRuleSet(
            commitmentId, confirmers, effectiveThreshold, protocolFallbackEnabled
        );
    }

    /// @notice Records a payout already executed on the Arbitrum rail. Moves no value.
    /// @dev Source, recipient, token, and amount are read from the commitment, never from the
    ///      caller, so the record cannot describe a payment the declared terms never promised.
    function recordRewardPaid(uint256 commitmentId, bytes32 payoutRef) external whenOperational {
        ICommitmentPoolingModule.Commitment storage commitment = _requireCommitment(commitmentId);
        if (commitment.state != ICommitmentPoolingModule.CommitmentState.Fulfilled) {
            revert ICommitmentPoolingModule.CommitmentNotInState(commitmentId, commitment.state);
        }
        _requirePoolSteward(commitment.poolId, pools[commitment.poolId]);
        if (commitment.rewardPaid) revert ICommitmentPoolingModule.RewardAlreadyRecorded(commitmentId);

        // `_validateReward` gates both writes to this struct, so a zero amount is exactly the
        // None rail and a non-zero ArbitrumExternal amount always carries a source and a token.
        ICommitmentPoolingModule.DeclaredReward storage reward = commitment.reward;
        if (reward.amount == 0) revert ICommitmentPoolingModule.RewardNotDeclared(commitmentId);
        // CeloSettlement payouts are owned end to end by SettlementModule's conserved plan.
        if (reward.rail != ICommitmentPoolingModule.RewardRail.ArbitrumExternal) {
            revert ICommitmentPoolingModule.RewardRailMismatch(
                commitmentId, ICommitmentPoolingModule.RewardRail.ArbitrumExternal, reward.rail
            );
        }

        commitment.rewardPaid = true;
        emit ICommitmentPoolingModule.RewardPaid(
            commitmentId, reward.source, commitment.leadProvider, reward.token, reward.amount, payoutRef, msg.sender
        );
    }

    // ═════════════════════════════ Internal ═════════════════════════════

    function _requireEditableTerms(uint256 commitmentId)
        private
        view
        returns (ICommitmentPoolingModule.Commitment storage commitment)
    {
        commitment = _requireCommitment(commitmentId);
        _requirePreAcceptanceState(commitmentId, commitment);
        _requirePoolSteward(commitment.poolId, pools[commitment.poolId]);
    }
}
