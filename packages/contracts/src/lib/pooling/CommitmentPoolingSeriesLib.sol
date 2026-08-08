// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingCommonLib } from "./CommitmentPoolingCommonLib.sol";
import { CommitmentPoolingGuardLib } from "./CommitmentPoolingGuardLib.sol";

/// @title CommitmentPoolingSeriesLib
/// @notice Deployed behavior library: module-native, pool-scoped standing commitments.
/// @dev A series is the ongoing promise; each Commitment instance is one keeping of it. Resting or
///      retiring a series never touches an existing instance, and revising its metadata never
///      rewrites a prior instance's snapshot — instances own their own terms. Series creation is
///      direct-holder only in this version. The series counter arrives by value — the shell
///      increments it exactly when a fresh id is returned.
///      Runs via DELEGATECALL from `CommitmentPoolingModule`.
library CommitmentPoolingSeriesLib {
    function createCommitmentSeries(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 seriesId => ICommitmentPoolingModule.CommitmentSeries series) storage commitmentSeries,
        mapping(address holder => mapping(bytes32 creationRequestKey => uint256 seriesId)) storage seriesIdByCreationRequest,
        uint256 nextCommitmentSeriesIdValue,
        uint256 poolId,
        bytes32 creationRequestKey,
        string calldata metadataCID
    )
        external
        returns (uint256 seriesId)
    {
        ICommitmentPoolingModule.Pool storage pool = CommitmentPoolingGuardLib.requirePool(pools, poolId);
        if (pool.state != ICommitmentPoolingModule.PoolState.Ready && pool.state != ICommitmentPoolingModule.PoolState.Open)
        {
            revert ICommitmentPoolingModule.PoolNotInState(poolId, pool.state);
        }
        if (!CommitmentPoolingGuardLib.isGardenMember(env.hats, pool.garden, msg.sender)) {
            revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        }
        if (creationRequestKey == bytes32(0)) revert ICommitmentPoolingModule.InvalidSeriesCreationRequestKey();
        _requireMetadataCID(metadataCID);

        // The wallet, embedded, and passkey senders expose a transaction hash only after
        // submission, so this holder-scoped key is the replay boundary. It binds the immutable
        // creation payload only: the mutable current metadata is deliberately not part of it.
        bytes32 creationPayloadHash = keccak256(abi.encode(poolId, keccak256(bytes(metadataCID))));
        uint256 existingId = seriesIdByCreationRequest[msg.sender][creationRequestKey];
        if (existingId != 0) {
            if (commitmentSeries[existingId].creationPayloadHash != creationPayloadHash) {
                revert ICommitmentPoolingModule.SeriesCreationRequestConflict(creationRequestKey, existingId);
            }
            return existingId;
        }

        seriesId = nextCommitmentSeriesIdValue;
        ICommitmentPoolingModule.CommitmentSeries storage series = commitmentSeries[seriesId];
        series.poolId = poolId;
        series.createdBy = msg.sender;
        series.currentHolder = msg.sender;
        series.state = ICommitmentPoolingModule.CommitmentSeriesState.Active;
        series.metadataCID = metadataCID;
        series.creationPayloadHash = creationPayloadHash;
        seriesIdByCreationRequest[msg.sender][creationRequestKey] = seriesId;

        emit ICommitmentPoolingModule.CommitmentSeriesCreated(seriesId, poolId, msg.sender, metadataCID);
    }

    function updateCommitmentSeriesMetadata(
        mapping(uint256 seriesId => ICommitmentPoolingModule.CommitmentSeries series) storage commitmentSeries,
        uint256 seriesId,
        string calldata metadataCID
    )
        external
    {
        ICommitmentPoolingModule.CommitmentSeries storage series = _requireSeriesHolder(commitmentSeries, seriesId);
        if (series.state == ICommitmentPoolingModule.CommitmentSeriesState.Retired) {
            revert ICommitmentPoolingModule.InvalidCommitmentSeriesState(seriesId, series.state);
        }
        _requireMetadataCID(metadataCID);

        series.metadataCID = metadataCID;
        emit ICommitmentPoolingModule.CommitmentSeriesMetadataUpdated(seriesId, metadataCID);
    }

    function restCommitmentSeries(
        mapping(uint256 seriesId => ICommitmentPoolingModule.CommitmentSeries series) storage commitmentSeries,
        uint256 seriesId
    )
        external
    {
        ICommitmentPoolingModule.CommitmentSeries storage series = _requireSeriesHolder(commitmentSeries, seriesId);
        _requireSeriesState(seriesId, series, ICommitmentPoolingModule.CommitmentSeriesState.Active);

        series.state = ICommitmentPoolingModule.CommitmentSeriesState.Resting;
        emit ICommitmentPoolingModule.CommitmentSeriesRested(seriesId);
    }

    function resumeCommitmentSeries(
        mapping(uint256 seriesId => ICommitmentPoolingModule.CommitmentSeries series) storage commitmentSeries,
        uint256 seriesId
    )
        external
    {
        ICommitmentPoolingModule.CommitmentSeries storage series = _requireSeriesHolder(commitmentSeries, seriesId);
        _requireSeriesState(seriesId, series, ICommitmentPoolingModule.CommitmentSeriesState.Resting);

        series.state = ICommitmentPoolingModule.CommitmentSeriesState.Active;
        emit ICommitmentPoolingModule.CommitmentSeriesResumed(seriesId);
    }

    function retireCommitmentSeries(
        mapping(uint256 seriesId => ICommitmentPoolingModule.CommitmentSeries series) storage commitmentSeries,
        uint256 seriesId
    )
        external
    {
        ICommitmentPoolingModule.CommitmentSeries storage series = _requireSeriesHolder(commitmentSeries, seriesId);
        if (series.state == ICommitmentPoolingModule.CommitmentSeriesState.Retired) {
            revert ICommitmentPoolingModule.InvalidCommitmentSeriesState(seriesId, series.state);
        }

        series.state = ICommitmentPoolingModule.CommitmentSeriesState.Retired;
        emit ICommitmentPoolingModule.CommitmentSeriesRetired(seriesId);
    }

    function requireSeries(
        mapping(uint256 seriesId => ICommitmentPoolingModule.CommitmentSeries series) storage commitmentSeries,
        uint256 seriesId
    )
        internal
        view
        returns (ICommitmentPoolingModule.CommitmentSeries storage series)
    {
        series = commitmentSeries[seriesId];
        if (series.state == ICommitmentPoolingModule.CommitmentSeriesState.None) {
            revert ICommitmentPoolingModule.UnknownCommitmentSeries(seriesId);
        }
    }

    // ═════════════════════════════ Internal ═════════════════════════════

    function _requireSeriesHolder(
        mapping(uint256 seriesId => ICommitmentPoolingModule.CommitmentSeries series) storage commitmentSeries,
        uint256 seriesId
    )
        private
        view
        returns (ICommitmentPoolingModule.CommitmentSeries storage series)
    {
        series = requireSeries(commitmentSeries, seriesId);
        if (msg.sender != series.currentHolder) {
            revert ICommitmentPoolingModule.CommitmentSeriesHolderOnly(seriesId, msg.sender);
        }
    }

    function _requireSeriesState(
        uint256 seriesId,
        ICommitmentPoolingModule.CommitmentSeries storage series,
        ICommitmentPoolingModule.CommitmentSeriesState expected
    )
        private
        view
    {
        if (series.state != expected) {
            revert ICommitmentPoolingModule.InvalidCommitmentSeriesState(seriesId, series.state);
        }
    }

    /// @dev A series is nothing without its terms. The frozen error set carries no dedicated
    ///      metadata-required error, so the module's general empty-payload error stands in.
    function _requireMetadataCID(string calldata metadataCID) private pure {
        if (bytes(metadataCID).length == 0) revert ICommitmentPoolingModule.ReasonRequired();
    }
}
