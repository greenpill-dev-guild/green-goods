// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingCommonLib } from "./CommonLib.sol";
import { CommitmentPoolingCreationChecksLib } from "./CreationChecksLib.sol";
import { CommitmentPoolingCreditLib } from "./CreditLib.sol";
import { CommitmentPoolingGuardLib } from "./GuardLib.sol";

/// @title CommitmentPoolingTermsLib
/// @notice Deployed behavior library: pre-acceptance term edits and the Arbitrum-rail consideration
///         record.
/// @dev Terms are steward-editable only while nobody has accepted them; once a counterparty is
///      bound, consideration, valuation, and confirmer terms are the agreement and stop moving.
///      Runs via DELEGATECALL from `CommitmentPoolingModule`.
library CommitmentPoolingTermsLib {
    /// @notice Declared consideration is a reference to a payment made elsewhere, never custody.
    function setDeclaredConsideration(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        uint256 commitmentId,
        ICommitmentPoolingModule.DeclaredConsideration calldata consideration
    )
        external
    {
        ICommitmentPoolingModule.Commitment storage commitment =
            _requireEditableTerms(env, pools, commitments, commitmentId);
        CommitmentPoolingCreationChecksLib.validateConsideration(consideration);

        commitment.consideration = consideration;
        // Unlike creation, an explicit steward edit always emits: clearing a declared consideration is
        // itself a record the indexer and the counterparty need to see.
        emit ICommitmentPoolingModule.ConsiderationDeclared(
            commitmentId, consideration.rail, consideration.source, consideration.token, consideration.amount
        );
    }

    /// @notice Records-only valuation term; no protocol arithmetic consumes it.
    function setDeclaredValue(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        uint256 commitmentId,
        uint256 declaredUnitValue,
        string calldata declaredValueBasis
    )
        external
    {
        ICommitmentPoolingModule.Commitment storage commitment =
            _requireEditableTerms(env, pools, commitments, commitmentId);
        CommitmentPoolingCreationChecksLib.validateDeclaredValue(declaredUnitValue, declaredValueBasis);

        commitment.declaredUnitValue = declaredUnitValue;
        commitment.declaredValueBasis = declaredValueBasis;
        emit ICommitmentPoolingModule.ValueDeclared(commitmentId, declaredUnitValue, declaredValueBasis);
    }

    /// @notice Replaces the whole confirmer rule: named group, threshold, and fallback selection.
    function setConfirmerRule(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        mapping(
            uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record)
        ) storage contributors,
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        uint256 commitmentId,
        address[] calldata confirmers,
        uint32 threshold,
        bool protocolFallbackEnabled
    )
        external
    {
        ICommitmentPoolingModule.Commitment storage commitment =
            _requireEditableTerms(env, pools, commitments, commitmentId);
        CommitmentPoolingCreationChecksLib.validateConfirmerRule(env, confirmers, threshold, protocolFallbackEnabled);

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
        CommitmentPoolingCreditLib.assertConfirmationReachable(
            env, commitmentConfirmers, contributors, commitmentId, commitment
        );
        emit ICommitmentPoolingModule.ConfirmerRuleSet(
            commitmentId, confirmers, effectiveThreshold, protocolFallbackEnabled
        );
    }

    /// @notice Records a payout already executed on the Arbitrum rail. Moves no value.
    /// @dev Source, recipient, token, and amount are read from the commitment, never from the
    ///      caller, so the record cannot describe a payment the declared terms never promised.
    function recordConsiderationPaid(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        uint256 commitmentId,
        bytes32 payoutRef
    )
        external
    {
        ICommitmentPoolingModule.Commitment storage commitment =
            CommitmentPoolingGuardLib.requireCommitment(commitments, commitmentId);
        if (commitment.state != ICommitmentPoolingModule.CommitmentState.Fulfilled) {
            revert ICommitmentPoolingModule.CommitmentNotInState(commitmentId, commitment.state);
        }
        CommitmentPoolingGuardLib.requirePoolSteward(env, commitment.poolId, pools[commitment.poolId]);
        if (commitment.considerationPaid) revert ICommitmentPoolingModule.ConsiderationAlreadyRecorded(commitmentId);

        // `validateConsideration` gates both writes to this struct, so a zero amount is exactly the
        // None rail and a non-zero ArbitrumExternal amount always carries a source and a token.
        ICommitmentPoolingModule.DeclaredConsideration storage consideration = commitment.consideration;
        if (consideration.amount == 0) revert ICommitmentPoolingModule.ConsiderationNotDeclared(commitmentId);
        // CeloSettlement payouts are owned end to end by SettlementModule's conserved plan.
        if (consideration.rail != ICommitmentPoolingModule.ConsiderationRail.ArbitrumExternal) {
            revert ICommitmentPoolingModule.ConsiderationRailMismatch(
                commitmentId, ICommitmentPoolingModule.ConsiderationRail.ArbitrumExternal, consideration.rail
            );
        }

        commitment.considerationPaid = true;
        // The recorded beneficiary follows the same rule the Celo rail uses (register #91): a
        // Request claimed by a garden was taken on by that garden as an institution, and its
        // `leadProvider` is only the steward who claimed on its behalf. Naming the person here
        // would record an individual as paid for institutional work on the one rail that is a
        // durable public record. Every other shape keeps the lead provider.
        address beneficiary = commitment.direction == ICommitmentPoolingModule.CommitmentDirection.Request
            && commitment.counterpartyKind == ICommitmentPoolingModule.ClaimType.Garden
            ? commitment.providerGarden
            : commitment.leadProvider;
        emit ICommitmentPoolingModule.ConsiderationPaid(
            commitmentId,
            consideration.source,
            beneficiary,
            consideration.token,
            consideration.amount,
            payoutRef,
            msg.sender
        );
    }

    // ═════════════════════════════ Internal
    // ═════════════════════════════

    function _requireEditableTerms(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        uint256 commitmentId
    )
        private
        view
        returns (ICommitmentPoolingModule.Commitment storage commitment)
    {
        commitment = CommitmentPoolingGuardLib.requireCommitment(commitments, commitmentId);
        CommitmentPoolingGuardLib.requirePreAcceptanceState(commitmentId, commitment);
        CommitmentPoolingGuardLib.requirePoolSteward(env, commitment.poolId, pools[commitment.poolId]);
    }
}
