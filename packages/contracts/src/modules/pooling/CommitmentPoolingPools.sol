// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS, Attestation } from "@eas/IEAS.sol";

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentRegistry } from "../../interfaces/ICommitmentRegistry.sol";
import { IHatsModule } from "../../interfaces/IHatsModule.sol";
import { ActionRegistry } from "../../registries/Action.sol";
import { CommitmentPoolingConfig, IWorkDecisionSequenceResolver } from "./CommitmentPoolingConfig.sol";

/// @title CommitmentPoolingPools
/// @notice Pool registration and pool state lifecycle.
abstract contract CommitmentPoolingPools is CommitmentPoolingConfig {
    function onGardenMinted(address garden) external whenOperational returns (uint256 poolId) {
        if (msg.sender != gardenToken) revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        poolId = gardenPool[garden];
        if (poolId != 0) return poolId;
        return _registerPool(garden, ICommitmentPoolingModule.PoolType.Garden);
    }

    function registerPool(
        address garden,
        ICommitmentPoolingModule.PoolType poolType
    )
        external
        whenOperational
        returns (uint256 poolId)
    {
        if (garden == address(0)) revert ICommitmentPoolingModule.ZeroAddress();
        if (poolType == ICommitmentPoolingModule.PoolType.Protocol) {
            if (garden != rootGarden) {
                revert ICommitmentPoolingModule.ProtocolGardenMismatch(rootGarden, garden);
            }
            if (msg.sender != owner()) revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
            if (protocolPoolId != 0) revert ICommitmentPoolingModule.PoolExists(rootGarden);
        } else if (msg.sender != owner() && !_isGardenSteward(garden, msg.sender)) {
            revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        }
        if (gardenPool[garden] != 0) revert ICommitmentPoolingModule.PoolExists(garden);
        poolId = _registerPool(garden, poolType);
        if (poolType == ICommitmentPoolingModule.PoolType.Protocol) protocolPoolId = poolId;
    }

    function setPoolCharter(uint256 poolId, string calldata charterCID) external whenOperational {
        ICommitmentPoolingModule.Pool storage pool = _requirePool(poolId);
        _requirePoolSteward(poolId, pool);
        pool.charterCID = charterCID;
        emit ICommitmentPoolingModule.PoolCharterUpdated(poolId, charterCID);
    }

    function markPoolReady(uint256 poolId) external whenOperational {
        ICommitmentPoolingModule.Pool storage pool = _requirePool(poolId);
        _requirePoolSteward(poolId, pool);
        _requirePoolState(poolId, pool, ICommitmentPoolingModule.PoolState.NotReady);
        if (bytes(pool.charterCID).length == 0) revert ICommitmentPoolingModule.CharterRequired(poolId);
        if (commitmentRegistry.providerOpenCommitmentCapOf(poolId) == 0) {
            revert ICommitmentPoolingModule.OpenCommitmentCapRequired(poolId);
        }
        pool.state = ICommitmentPoolingModule.PoolState.Ready;
        emit ICommitmentPoolingModule.PoolReady(poolId);
    }

    function openPool(uint256 poolId) external whenOperational {
        ICommitmentPoolingModule.Pool storage pool = _requirePool(poolId);
        _requirePoolSteward(poolId, pool);
        _requirePoolState(poolId, pool, ICommitmentPoolingModule.PoolState.Ready);
        pool.state = ICommitmentPoolingModule.PoolState.Open;
        emit ICommitmentPoolingModule.PoolOpened(poolId);
    }

    function pausePool(uint256 poolId, string calldata reasonCID) external {
        ICommitmentPoolingModule.Pool storage pool = _requirePool(poolId);
        _requirePoolSteward(poolId, pool);
        _requirePoolState(poolId, pool, ICommitmentPoolingModule.PoolState.Open);
        if (bytes(reasonCID).length == 0) revert ICommitmentPoolingModule.ReasonRequired();
        pool.state = ICommitmentPoolingModule.PoolState.Paused;
        emit ICommitmentPoolingModule.PoolPaused(poolId, reasonCID);
    }

    function resumePool(uint256 poolId) external whenOperational {
        ICommitmentPoolingModule.Pool storage pool = _requirePool(poolId);
        _requirePoolSteward(poolId, pool);
        _requirePoolState(poolId, pool, ICommitmentPoolingModule.PoolState.Paused);
        pool.state = ICommitmentPoolingModule.PoolState.Open;
        emit ICommitmentPoolingModule.PoolResumed(poolId);
    }

    function closePool(uint256 poolId) external {
        ICommitmentPoolingModule.Pool storage pool = _requirePool(poolId);
        _requirePoolSteward(poolId, pool);
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

    function compostPool(uint256 poolId) external {
        ICommitmentPoolingModule.Pool storage pool = _requirePool(poolId);
        _requirePoolSteward(poolId, pool);
        _requirePoolState(poolId, pool, ICommitmentPoolingModule.PoolState.Closed);
        pool.state = ICommitmentPoolingModule.PoolState.Composted;
        emit ICommitmentPoolingModule.PoolComposted(poolId);
    }

    function reopenPool(uint256 poolId, bool toOpen) external whenOperational {
        ICommitmentPoolingModule.Pool storage pool = _requirePool(poolId);
        _requirePoolSteward(poolId, pool);
        _requirePoolState(poolId, pool, ICommitmentPoolingModule.PoolState.Composted);
        pool.state = toOpen ? ICommitmentPoolingModule.PoolState.Open : ICommitmentPoolingModule.PoolState.Ready;
        emit ICommitmentPoolingModule.PoolReopened(poolId, toOpen);
    }

    function setProviderOpenCommitmentCap(uint256 poolId, uint256 cap) external whenOperational {
        ICommitmentPoolingModule.Pool storage pool = _requirePool(poolId);
        _requirePoolSteward(poolId, pool);
        if (cap == 0) revert ICommitmentPoolingModule.OpenCommitmentCapRequired(poolId);
        commitmentRegistry.setProviderOpenCommitmentCap(poolId, cap);
    }

    function getPool(uint256 poolId) external view returns (ICommitmentPoolingModule.Pool memory) {
        return _requirePool(poolId);
    }

    function getPoolByGarden(address garden)
        external
        view
        returns (uint256 poolId, ICommitmentPoolingModule.Pool memory pool)
    {
        poolId = gardenPool[garden];
        if (poolId != 0) pool = pools[poolId];
    }

    function _registerPool(address garden, ICommitmentPoolingModule.PoolType poolType) private returns (uint256 poolId) {
        if (garden == address(0)) revert ICommitmentPoolingModule.ZeroAddress();
        poolId = nextPoolId++;
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
