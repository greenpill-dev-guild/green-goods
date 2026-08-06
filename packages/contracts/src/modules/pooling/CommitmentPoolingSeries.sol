// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingRecognition } from "./CommitmentPoolingRecognition.sol";

/// @title CommitmentPoolingSeries
/// @notice Module-native, pool-scoped standing commitments.
/// @dev A series is the ongoing promise; each Commitment instance is one keeping of it. Resting or
///      retiring a series never touches an existing instance, and revising its metadata never
///      rewrites a prior instance's snapshot — instances own their own terms.
///
///      Series creation is direct-holder only in this version. `createdBy` and `currentHolder` are
///      both the caller and nothing here moves the holder, so a later two-step handover can define
///      its own consent events without redefining historical authorship.
abstract contract CommitmentPoolingSeries is CommitmentPoolingRecognition {
    function createCommitmentSeries(
        uint256 poolId,
        bytes32 creationRequestKey,
        string calldata metadataCID
    )
        external
        whenOperational
        returns (uint256 seriesId)
    {
        ICommitmentPoolingModule.Pool storage pool = _requirePool(poolId);
        if (pool.state != ICommitmentPoolingModule.PoolState.Ready && pool.state != ICommitmentPoolingModule.PoolState.Open)
        {
            revert ICommitmentPoolingModule.PoolNotInState(poolId, pool.state);
        }
        if (!_isGardenMember(pool.garden, msg.sender)) revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
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

        seriesId = nextCommitmentSeriesId++;
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

    function updateCommitmentSeriesMetadata(uint256 seriesId, string calldata metadataCID) external whenOperational {
        ICommitmentPoolingModule.CommitmentSeries storage series = _requireSeriesHolder(seriesId);
        if (series.state == ICommitmentPoolingModule.CommitmentSeriesState.Retired) {
            revert ICommitmentPoolingModule.InvalidCommitmentSeriesState(seriesId, series.state);
        }
        _requireMetadataCID(metadataCID);

        series.metadataCID = metadataCID;
        emit ICommitmentPoolingModule.CommitmentSeriesMetadataUpdated(seriesId, metadataCID);
    }

    function restCommitmentSeries(uint256 seriesId) external whenOperational {
        ICommitmentPoolingModule.CommitmentSeries storage series = _requireSeriesHolder(seriesId);
        _requireSeriesState(seriesId, series, ICommitmentPoolingModule.CommitmentSeriesState.Active);

        series.state = ICommitmentPoolingModule.CommitmentSeriesState.Resting;
        emit ICommitmentPoolingModule.CommitmentSeriesRested(seriesId);
    }

    function resumeCommitmentSeries(uint256 seriesId) external whenOperational {
        ICommitmentPoolingModule.CommitmentSeries storage series = _requireSeriesHolder(seriesId);
        _requireSeriesState(seriesId, series, ICommitmentPoolingModule.CommitmentSeriesState.Resting);

        series.state = ICommitmentPoolingModule.CommitmentSeriesState.Active;
        emit ICommitmentPoolingModule.CommitmentSeriesResumed(seriesId);
    }

    function retireCommitmentSeries(uint256 seriesId) external whenOperational {
        ICommitmentPoolingModule.CommitmentSeries storage series = _requireSeriesHolder(seriesId);
        if (series.state == ICommitmentPoolingModule.CommitmentSeriesState.Retired) {
            revert ICommitmentPoolingModule.InvalidCommitmentSeriesState(seriesId, series.state);
        }

        series.state = ICommitmentPoolingModule.CommitmentSeriesState.Retired;
        emit ICommitmentPoolingModule.CommitmentSeriesRetired(seriesId);
    }

    function getCommitmentSeries(uint256 seriesId)
        external
        view
        returns (ICommitmentPoolingModule.CommitmentSeries memory)
    {
        return _requireSeries(seriesId);
    }

    /// @notice Sender-safe read-through for an interrupted offline series send.
    function getCommitmentSeriesIdByCreationRequest(
        address holder,
        bytes32 creationRequestKey
    )
        external
        view
        returns (uint256 seriesId)
    {
        return seriesIdByCreationRequest[holder][creationRequestKey];
    }

    // ═════════════════════════════ Internal ═════════════════════════════

    function _requireSeries(uint256 seriesId)
        private
        view
        returns (ICommitmentPoolingModule.CommitmentSeries storage series)
    {
        series = commitmentSeries[seriesId];
        if (series.state == ICommitmentPoolingModule.CommitmentSeriesState.None) {
            revert ICommitmentPoolingModule.UnknownCommitmentSeries(seriesId);
        }
    }

    function _requireSeriesHolder(uint256 seriesId)
        private
        view
        returns (ICommitmentPoolingModule.CommitmentSeries storage series)
    {
        series = _requireSeries(seriesId);
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
