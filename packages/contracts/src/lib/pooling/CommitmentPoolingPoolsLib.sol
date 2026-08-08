// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingCommonLib } from "./CommitmentPoolingCommonLib.sol";
import { CommitmentPoolingGuardLib } from "./CommitmentPoolingGuardLib.sol";

/// @title CommitmentPoolingPoolsLib
/// @notice Deployed behavior library: pool registration and pool state lifecycle.
/// @dev Runs via DELEGATECALL from `CommitmentPoolingModule`; `msg.sender`, events, and reverts
///      surface from the proxy unchanged. The pool counter arrives by value and the shell owns
///      the increment and the protocol-pool scalar write, mirroring the creation shell contract.
library CommitmentPoolingPoolsLib {
    function onGardenMinted(
        mapping(address garden => uint256 poolId) storage gardenPool,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        uint256 nextPoolIdValue,
        address gardenToken,
        address garden
    )
        external
        returns (uint256 poolId)
    {
        if (msg.sender != gardenToken) revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        poolId = gardenPool[garden];
        if (poolId != 0) return poolId;
        return _registerPool(gardenPool, pools, nextPoolIdValue, garden, ICommitmentPoolingModule.PoolType.Garden);
    }

    function registerPool(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(address garden => uint256 poolId) storage gardenPool,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        uint256 nextPoolIdValue,
        address rootGarden,
        address garden,
        ICommitmentPoolingModule.PoolType poolType
    )
        external
        returns (uint256 poolId)
    {
        if (garden == address(0)) revert ICommitmentPoolingModule.ZeroAddress();
        if (poolType == ICommitmentPoolingModule.PoolType.Protocol) {
            if (garden != rootGarden) {
                revert ICommitmentPoolingModule.ProtocolGardenMismatch(rootGarden, garden);
            }
            if (msg.sender != env.owner) revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
            if (env.protocolPoolId != 0) revert ICommitmentPoolingModule.PoolExists(rootGarden);
        } else if (msg.sender != env.owner && !CommitmentPoolingGuardLib.isGardenSteward(env.hats, garden, msg.sender)) {
            revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        }
        if (gardenPool[garden] != 0) revert ICommitmentPoolingModule.PoolExists(garden);
        poolId = _registerPool(gardenPool, pools, nextPoolIdValue, garden, poolType);
    }

    function setPoolCharter(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        uint256 poolId,
        string calldata charterCID
    )
        external
    {
        ICommitmentPoolingModule.Pool storage pool = CommitmentPoolingGuardLib.requirePool(pools, poolId);
        CommitmentPoolingGuardLib.requirePoolSteward(env, poolId, pool);
        pool.charterCID = charterCID;
        emit ICommitmentPoolingModule.PoolCharterUpdated(poolId, charterCID);
    }

    function markPoolReady(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        uint256 poolId
    )
        external
    {
        ICommitmentPoolingModule.Pool storage pool = CommitmentPoolingGuardLib.requirePool(pools, poolId);
        CommitmentPoolingGuardLib.requirePoolSteward(env, poolId, pool);
        CommitmentPoolingGuardLib.requirePoolState(poolId, pool, ICommitmentPoolingModule.PoolState.NotReady);
        if (bytes(pool.charterCID).length == 0) revert ICommitmentPoolingModule.CharterRequired(poolId);
        if (env.registry.providerOpenCommitmentCapOf(poolId) == 0) {
            revert ICommitmentPoolingModule.OpenCommitmentCapRequired(poolId);
        }
        pool.state = ICommitmentPoolingModule.PoolState.Ready;
        emit ICommitmentPoolingModule.PoolReady(poolId);
    }

    function openPool(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        uint256 poolId
    )
        external
    {
        ICommitmentPoolingModule.Pool storage pool = CommitmentPoolingGuardLib.requirePool(pools, poolId);
        CommitmentPoolingGuardLib.requirePoolSteward(env, poolId, pool);
        CommitmentPoolingGuardLib.requirePoolState(poolId, pool, ICommitmentPoolingModule.PoolState.Ready);
        pool.state = ICommitmentPoolingModule.PoolState.Open;
        emit ICommitmentPoolingModule.PoolOpened(poolId);
    }

    function pausePool(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        uint256 poolId,
        string calldata reasonCID
    )
        external
    {
        ICommitmentPoolingModule.Pool storage pool = CommitmentPoolingGuardLib.requirePool(pools, poolId);
        CommitmentPoolingGuardLib.requirePoolSteward(env, poolId, pool);
        CommitmentPoolingGuardLib.requirePoolState(poolId, pool, ICommitmentPoolingModule.PoolState.Open);
        if (bytes(reasonCID).length == 0) revert ICommitmentPoolingModule.ReasonRequired();
        pool.state = ICommitmentPoolingModule.PoolState.Paused;
        emit ICommitmentPoolingModule.PoolPaused(poolId, reasonCID);
    }

    function resumePool(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        uint256 poolId
    )
        external
    {
        ICommitmentPoolingModule.Pool storage pool = CommitmentPoolingGuardLib.requirePool(pools, poolId);
        CommitmentPoolingGuardLib.requirePoolSteward(env, poolId, pool);
        CommitmentPoolingGuardLib.requirePoolState(poolId, pool, ICommitmentPoolingModule.PoolState.Paused);
        pool.state = ICommitmentPoolingModule.PoolState.Open;
        emit ICommitmentPoolingModule.PoolResumed(poolId);
    }

    function closePool(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        uint256 poolId
    )
        external
    {
        ICommitmentPoolingModule.Pool storage pool = CommitmentPoolingGuardLib.requirePool(pools, poolId);
        CommitmentPoolingGuardLib.requirePoolSteward(env, poolId, pool);
        if (
            pool.state != ICommitmentPoolingModule.PoolState.Open && pool.state != ICommitmentPoolingModule.PoolState.Paused
        ) revert ICommitmentPoolingModule.PoolNotInState(poolId, pool.state);
        if (pool.liveCommitmentCount != 0) {
            revert ICommitmentPoolingModule.PoolHasLiveCommitments(poolId, pool.liveCommitmentCount);
        }
        if (pool.nonTerminalCycleCount != 0) {
            revert ICommitmentPoolingModule.PoolHasNonTerminalCycles(poolId, pool.nonTerminalCycleCount);
        }
        pool.state = ICommitmentPoolingModule.PoolState.Closed;
        emit ICommitmentPoolingModule.PoolClosed(poolId);
    }

    function compostPool(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        uint256 poolId
    )
        external
    {
        ICommitmentPoolingModule.Pool storage pool = CommitmentPoolingGuardLib.requirePool(pools, poolId);
        CommitmentPoolingGuardLib.requirePoolSteward(env, poolId, pool);
        CommitmentPoolingGuardLib.requirePoolState(poolId, pool, ICommitmentPoolingModule.PoolState.Closed);
        pool.state = ICommitmentPoolingModule.PoolState.Composted;
        emit ICommitmentPoolingModule.PoolComposted(poolId);
    }

    function reopenPool(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        uint256 poolId,
        bool toOpen
    )
        external
    {
        ICommitmentPoolingModule.Pool storage pool = CommitmentPoolingGuardLib.requirePool(pools, poolId);
        CommitmentPoolingGuardLib.requirePoolSteward(env, poolId, pool);
        CommitmentPoolingGuardLib.requirePoolState(poolId, pool, ICommitmentPoolingModule.PoolState.Composted);
        pool.state = toOpen ? ICommitmentPoolingModule.PoolState.Open : ICommitmentPoolingModule.PoolState.Ready;
        emit ICommitmentPoolingModule.PoolReopened(poolId, toOpen);
    }

    function setProviderOpenCommitmentCap(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        uint256 poolId,
        uint256 cap
    )
        external
    {
        ICommitmentPoolingModule.Pool storage pool = CommitmentPoolingGuardLib.requirePool(pools, poolId);
        CommitmentPoolingGuardLib.requirePoolSteward(env, poolId, pool);
        if (cap == 0) revert ICommitmentPoolingModule.OpenCommitmentCapRequired(poolId);
        env.registry.setProviderOpenCommitmentCap(poolId, cap);
    }

    function _registerPool(
        mapping(address garden => uint256 poolId) storage gardenPool,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        uint256 nextPoolIdValue,
        address garden,
        ICommitmentPoolingModule.PoolType poolType
    )
        private
        returns (uint256 poolId)
    {
        if (garden == address(0)) revert ICommitmentPoolingModule.ZeroAddress();
        poolId = nextPoolIdValue;
        gardenPool[garden] = poolId;
        pools[poolId] = ICommitmentPoolingModule.Pool({
            garden: garden,
            poolType: poolType,
            state: ICommitmentPoolingModule.PoolState.NotReady,
            proofEnabled: true,
            settlementEnabled: false,
            charterCID: "",
            openSeasonCycleId: 0,
            settlementAdapter: address(0),
            liveCommitmentCount: 0,
            nonTerminalCycleCount: 0
        });
        emit ICommitmentPoolingModule.PoolRegistered(poolId, garden, poolType);
    }
}
