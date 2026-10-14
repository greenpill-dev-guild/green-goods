// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingCyclesLib } from "../../lib/CommitmentPooling/CyclesLib.sol";
import { CommitmentPoolingRosterLib } from "../../lib/CommitmentPooling/RosterLib.sol";
import { CommitmentPoolingSyncLib } from "../../lib/CommitmentPooling/SyncLib.sol";
import { CommitmentPoolingTerminalLib } from "../../lib/CommitmentPooling/TerminalLib.sol";
import { CommitmentPoolingTermsLib } from "../../lib/CommitmentPooling/TermsLib.sol";
import { CommitmentPoolingViewsLib } from "../../lib/CommitmentPooling/ViewsLib.sol";
import { CommitmentPoolingLifecycle } from "./Lifecycle.sol";

/// @title CommitmentPoolingOperations
/// @notice The operational machinery around live commitments: terminal outcomes (cancel, expire,
///         dispute), cycle lifecycle, roster mutations, pre-acceptance term edits, and the
///         steward catch-up for missed resolver decisions.
/// @dev Shells only: behavior lives in the deployed Terminal/Cycles/Roster/Terms/Sync libraries
///      and runs via DELEGATECALL in this contract's storage context. Module pause never blocks
///      cancel, expire, or resolve — those are the wind-down path a paused pool or module still
///      needs. The cycle shell owns the cycle counter increment. ABI, events, and reverts are
///      unchanged.
abstract contract CommitmentPoolingOperations is CommitmentPoolingLifecycle {
    // ═════════════════════════════ Terminal
    // ═════════════════════════════

    function cancelCommitment(uint256 commitmentId, string calldata reasonCID) external {
        CommitmentPoolingTerminalLib.cancelCommitment(_env(), pools, cycles, commitments, commitmentId, reasonCID);
    }

    function expireCommitment(uint256 commitmentId) external {
        CommitmentPoolingTerminalLib.expireCommitment(_env(), pools, cycles, commitments, commitmentId);
    }

    function raiseDispute(uint256 commitmentId, string calldata reasonCID) external whenOperational {
        CommitmentPoolingTerminalLib.raiseDispute(
            _env(), pools, cycles, commitments, commitmentConfirmers, commitmentId, reasonCID
        );
    }

    function resolveDispute(
        uint256 commitmentId,
        ICommitmentPoolingModule.DisputeResolution resolution,
        string calldata reasonCID
    )
        external
        nonReentrant
    {
        CommitmentPoolingTerminalLib.resolveDispute(
            _env(),
            pools,
            cycles,
            commitments,
            contributors,
            commitmentWorkUIDs,
            latestWorkDecisionSequence,
            commitmentId,
            resolution,
            reasonCID
        );
    }

    // ═════════════════════════════ Cycles
    // ═════════════════════════════

    function seedCycle(
        uint256 poolId,
        ICommitmentPoolingModule.CycleType cycleType,
        uint64 startTime,
        uint64 endTime,
        string calldata metadataCID
    )
        external
        whenOperational
        returns (uint256 cycleId)
    {
        cycleId = CommitmentPoolingCyclesLib.seedCycle(
            _env(), pools, cycles, nextCycleId, poolId, cycleType, startTime, endTime, metadataCID
        );
        if (cycleId == nextCycleId) nextCycleId = cycleId + 1;
    }

    function openCycle(
        uint256 cycleId,
        ICommitmentPoolingModule.AllocationBps calldata allocation,
        ICommitmentPoolingModule.RecognitionPolicy calldata recognitionPolicy
    )
        external
        whenOperational
    {
        CommitmentPoolingCyclesLib.openCycle(_env(), pools, cycles, cycleId, allocation, recognitionPolicy);
    }

    /// @notice The reconcile act. Locks the fulfilled set before any certificate can mint.
    function closeCycle(uint256 cycleId) external whenOperational {
        CommitmentPoolingCyclesLib.closeCycle(_env(), pools, cycles, cycleId);
    }

    function compostCycle(uint256 cycleId) external whenOperational {
        CommitmentPoolingCyclesLib.compostCycle(_env(), pools, cycles, cycleId);
    }

    function cancelCycle(uint256 cycleId, string calldata reasonCID) external whenOperational {
        CommitmentPoolingCyclesLib.cancelCycle(_env(), pools, cycles, cycleId, reasonCID);
    }

    function getCycle(uint256 cycleId) external view returns (ICommitmentPoolingModule.Cycle memory) {
        uint256 slot;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            slot := cycles.slot
        }
        _forwardView(abi.encodeWithSelector(CommitmentPoolingViewsLib.getCycle.selector, slot, cycleId));
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            revert(0, 0)
        } // unreachable
    }

    // ═════════════════════════════ Roster
    // ═════════════════════════════

    function joinCommitment(uint256 commitmentId) external whenOperational {
        CommitmentPoolingRosterLib.joinCommitment(_env(), commitments, contributors, commitmentConfirmers, commitmentId);
    }

    function leaveCommitment(uint256 commitmentId) external whenOperational {
        CommitmentPoolingRosterLib.leaveCommitment(_env(), commitments, contributors, commitmentConfirmers, commitmentId);
    }

    function removeContributor(uint256 commitmentId, address contributor) external whenOperational {
        CommitmentPoolingRosterLib.removeContributor(
            _env(), pools, commitments, contributors, commitmentConfirmers, commitmentId, contributor
        );
    }

    /// @notice Optional planning signal; assignment is never recognition credit.
    function setContributorRequirement(
        uint256 commitmentId,
        address contributor,
        uint16 requirementIndex,
        bool assigned
    )
        external
        whenOperational
    {
        CommitmentPoolingRosterLib.setContributorRequirement(
            _env(),
            pools,
            commitments,
            contributors,
            requirementAssignments,
            commitmentId,
            contributor,
            requirementIndex,
            assigned
        );
    }

    // ═════════════════════════════ Terms
    // ═════════════════════════════

    /// @notice Declared consideration is a reference to a payment made elsewhere, never custody.
    function setDeclaredConsideration(
        uint256 commitmentId,
        ICommitmentPoolingModule.DeclaredConsideration calldata consideration
    )
        external
        whenOperational
    {
        CommitmentPoolingTermsLib.setDeclaredConsideration(_env(), pools, commitments, commitmentId, consideration);
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
        CommitmentPoolingTermsLib.setDeclaredValue(
            _env(), pools, commitments, commitmentId, declaredUnitValue, declaredValueBasis
        );
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
        CommitmentPoolingTermsLib.setConfirmerRule(
            _env(),
            pools,
            commitments,
            contributors,
            commitmentConfirmers,
            commitmentId,
            confirmers,
            threshold,
            protocolFallbackEnabled
        );
    }

    /// @notice Records a payout already executed on the Arbitrum rail. Moves no value.
    function recordConsiderationPaid(uint256 commitmentId, bytes32 payoutRef) external whenOperational {
        CommitmentPoolingTermsLib.recordConsiderationPaid(_env(), pools, commitments, commitmentId, payoutRef);
    }

    // ═════════════════════════════ Sync
    // ═════════════════════════════

    function unlinkWork(bytes32 workUID) external whenOperational {
        CommitmentPoolingSyncLib.unlinkWork(
            _env(),
            pools,
            commitments,
            contributors,
            commitmentWorkUIDs,
            workCommitment,
            latestWorkDecisionUID,
            workCreditActive,
            workRequirementIndexPlusOne,
            workUID
        );
    }

    function syncWorkDecisions(uint256 commitmentId, bytes32[] calldata decisionUIDs) external whenOperational {
        CommitmentPoolingSyncLib.syncWorkDecisions(
            _env(),
            pools,
            commitments,
            cycles,
            contributors,
            commitmentWorkUIDs,
            commitmentConfirmers,
            workCommitment,
            latestWorkDecisionSequence,
            latestWorkDecisionUID,
            approvalCounted,
            workCreditActive,
            workRequirementIndexPlusOne,
            commitmentId,
            decisionUIDs
        );
    }
}
