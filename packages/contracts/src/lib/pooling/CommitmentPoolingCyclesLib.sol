// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingCommonLib } from "./CommitmentPoolingCommonLib.sol";
import { CommitmentPoolingGuardLib } from "./CommitmentPoolingGuardLib.sol";

/// @title CommitmentPoolingCyclesLib
/// @notice Deployed behavior library: cycle seeding, opening, reconciliation, composting, and
///         cancellation.
/// @dev A pool may hold one open Season and any number of open Campaigns. `Pool.openSeasonCycleId`
///      is the bounded O(1) Season guard; no function here enumerates cycles. The cycle counter
///      arrives by value — the shell increments it exactly when a fresh id is returned.
///      Runs via DELEGATECALL from `CommitmentPoolingModule`.
library CommitmentPoolingCyclesLib {
    function seedCycle(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 cycleId => ICommitmentPoolingModule.Cycle cycle) storage cycles,
        uint256 nextCycleIdValue,
        uint256 poolId,
        ICommitmentPoolingModule.CycleType cycleType,
        uint64 startTime,
        uint64 endTime,
        string calldata metadataCID
    )
        external
        returns (uint256 cycleId)
    {
        ICommitmentPoolingModule.Pool storage pool = CommitmentPoolingGuardLib.requirePool(pools, poolId);
        if (pool.state != ICommitmentPoolingModule.PoolState.Ready && pool.state != ICommitmentPoolingModule.PoolState.Open)
        {
            revert ICommitmentPoolingModule.PoolNotInState(poolId, pool.state);
        }
        CommitmentPoolingGuardLib.requirePoolSteward(env, poolId, pool);
        if (endTime <= startTime) revert ICommitmentPoolingModule.InvalidTimeWindow(startTime, endTime);

        cycleId = nextCycleIdValue;
        ICommitmentPoolingModule.Cycle storage cycle = cycles[cycleId];
        cycle.poolId = poolId;
        cycle.cycleType = cycleType;
        cycle.state = ICommitmentPoolingModule.CycleState.Seeded;
        cycle.startTime = startTime;
        cycle.endTime = endTime;
        cycle.metadataCID = metadataCID;
        pool.nonTerminalCycleCount++;

        emit ICommitmentPoolingModule.CycleSeeded(cycleId, poolId, cycleType, startTime, endTime, metadataCID);
    }

    function openCycle(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 cycleId => ICommitmentPoolingModule.Cycle cycle) storage cycles,
        uint256 cycleId,
        ICommitmentPoolingModule.AllocationBps calldata allocation,
        ICommitmentPoolingModule.RecognitionPolicy calldata recognitionPolicy
    )
        external
    {
        ICommitmentPoolingModule.Cycle storage cycle =
            _requireCycleInState(cycles, cycleId, ICommitmentPoolingModule.CycleState.Seeded);
        ICommitmentPoolingModule.Pool storage pool = CommitmentPoolingGuardLib.requirePool(pools, cycle.poolId);
        CommitmentPoolingGuardLib.requirePoolState(cycle.poolId, pool, ICommitmentPoolingModule.PoolState.Open);
        CommitmentPoolingGuardLib.requirePoolSteward(env, cycle.poolId, pool);

        uint256 allocationSum = uint256(allocation.gardeners) + allocation.treasury + allocation.operator
            + allocation.evaluator + allocation.community + allocation.funder;
        if (allocationSum != CommitmentPoolingCommonLib.TOTAL_ALLOCATION_BPS) {
            revert ICommitmentPoolingModule.InvalidAllocation();
        }
        if (
            uint256(recognitionPolicy.equalParticipationBps) + recognitionPolicy.verifiedContributionBps
                != CommitmentPoolingCommonLib.TOTAL_ALLOCATION_BPS
        ) revert ICommitmentPoolingModule.InvalidAllocation();

        if (cycle.cycleType == ICommitmentPoolingModule.CycleType.Season) {
            if (pool.openSeasonCycleId != 0) {
                revert ICommitmentPoolingModule.SeasonAlreadyOpen(cycle.poolId, pool.openSeasonCycleId);
            }
            pool.openSeasonCycleId = cycleId;
        }

        // Both snapshots are immutable for the life of the cycle.
        cycle.allocation = allocation;
        cycle.recognitionPolicy = recognitionPolicy;
        cycle.state = ICommitmentPoolingModule.CycleState.Open;

        emit ICommitmentPoolingModule.CycleOpened(
            cycleId,
            cycle.poolId,
            allocation.gardeners,
            allocation.treasury,
            allocation.operator,
            allocation.evaluator,
            allocation.community,
            allocation.funder,
            recognitionPolicy.equalParticipationBps,
            recognitionPolicy.verifiedContributionBps
        );
    }

    /// @notice The reconcile act. Locks the fulfilled set before any certificate can mint.
    function closeCycle(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 cycleId => ICommitmentPoolingModule.Cycle cycle) storage cycles,
        uint256 cycleId
    )
        external
    {
        ICommitmentPoolingModule.Cycle storage cycle =
            _requireCycleInState(cycles, cycleId, ICommitmentPoolingModule.CycleState.Open);
        ICommitmentPoolingModule.Pool storage pool = CommitmentPoolingGuardLib.requirePool(pools, cycle.poolId);
        CommitmentPoolingGuardLib.requirePoolSteward(env, cycle.poolId, pool);
        if (cycle.liveCommitmentCount != 0) {
            revert ICommitmentPoolingModule.CycleHasLiveCommitments(cycleId, cycle.liveCommitmentCount);
        }

        cycle.state = ICommitmentPoolingModule.CycleState.Reconciled;
        _clearSeasonGuard(cycle, pool, cycleId);
        emit ICommitmentPoolingModule.CycleClosed(cycleId, cycle.poolId);
    }

    function compostCycle(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 cycleId => ICommitmentPoolingModule.Cycle cycle) storage cycles,
        uint256 cycleId
    )
        external
    {
        ICommitmentPoolingModule.Cycle storage cycle =
            _requireCycleInState(cycles, cycleId, ICommitmentPoolingModule.CycleState.Reconciled);
        ICommitmentPoolingModule.Pool storage pool = CommitmentPoolingGuardLib.requirePool(pools, cycle.poolId);
        CommitmentPoolingGuardLib.requirePoolSteward(env, cycle.poolId, pool);

        cycle.state = ICommitmentPoolingModule.CycleState.Composted;
        pool.nonTerminalCycleCount--;
        emit ICommitmentPoolingModule.CycleComposted(cycleId, cycle.poolId);
    }

    function cancelCycle(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 cycleId => ICommitmentPoolingModule.Cycle cycle) storage cycles,
        uint256 cycleId,
        string calldata reasonCID
    )
        external
    {
        ICommitmentPoolingModule.Cycle storage cycle = requireCycle(cycles, cycleId);
        if (
            cycle.state != ICommitmentPoolingModule.CycleState.Seeded
                && cycle.state != ICommitmentPoolingModule.CycleState.Open
        ) revert ICommitmentPoolingModule.CycleNotInState(cycleId, cycle.state);
        ICommitmentPoolingModule.Pool storage pool = CommitmentPoolingGuardLib.requirePool(pools, cycle.poolId);
        CommitmentPoolingGuardLib.requirePoolSteward(env, cycle.poolId, pool);
        if (bytes(reasonCID).length == 0) revert ICommitmentPoolingModule.ReasonRequired();
        if (cycle.liveCommitmentCount != 0) {
            revert ICommitmentPoolingModule.CycleHasLiveCommitments(cycleId, cycle.liveCommitmentCount);
        }

        cycle.state = ICommitmentPoolingModule.CycleState.Cancelled;
        pool.nonTerminalCycleCount--;
        _clearSeasonGuard(cycle, pool, cycleId);
        emit ICommitmentPoolingModule.CycleCancelled(cycleId, cycle.poolId, reasonCID);
    }

    function requireCycle(
        mapping(uint256 cycleId => ICommitmentPoolingModule.Cycle cycle) storage cycles,
        uint256 cycleId
    )
        internal
        view
        returns (ICommitmentPoolingModule.Cycle storage cycle)
    {
        cycle = cycles[cycleId];
        if (cycle.state == ICommitmentPoolingModule.CycleState.None) {
            revert ICommitmentPoolingModule.UnknownCycle(cycleId);
        }
    }

    // ═════════════════════════════ Internal ═════════════════════════════

    /// @dev Only a Season may own the one-open-Season guard. Campaign close and cancel never read
    ///      or write it, so stale or migrated state pointing the field at a Campaign can never be
    ///      cleared by closing that Campaign and admit a second concurrent Season.
    function _clearSeasonGuard(
        ICommitmentPoolingModule.Cycle storage cycle,
        ICommitmentPoolingModule.Pool storage pool,
        uint256 cycleId
    )
        private
    {
        if (cycle.cycleType != ICommitmentPoolingModule.CycleType.Season) return;
        if (pool.openSeasonCycleId == cycleId) pool.openSeasonCycleId = 0;
    }

    function _requireCycleInState(
        mapping(uint256 cycleId => ICommitmentPoolingModule.Cycle cycle) storage cycles,
        uint256 cycleId,
        ICommitmentPoolingModule.CycleState expected
    )
        private
        view
        returns (ICommitmentPoolingModule.Cycle storage cycle)
    {
        cycle = requireCycle(cycles, cycleId);
        if (cycle.state != expected) revert ICommitmentPoolingModule.CycleNotInState(cycleId, cycle.state);
    }
}
