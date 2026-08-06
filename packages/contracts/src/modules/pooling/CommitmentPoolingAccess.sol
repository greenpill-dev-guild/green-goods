// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS, Attestation } from "@eas/IEAS.sol";

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentRegistry } from "../../interfaces/ICommitmentRegistry.sol";
import { IHatsModule } from "../../interfaces/IHatsModule.sol";
import { ActionRegistry } from "../../registries/Action.sol";
import { CommitmentPoolingStorage, IWorkDecisionSequenceResolver } from "./CommitmentPoolingStorage.sol";

/// @title CommitmentPoolingAccess
/// @notice Shared guards, role predicates, and state assertions.
abstract contract CommitmentPoolingAccess is CommitmentPoolingStorage {
    function _requireCompleteConfiguration() internal view {
        if (
            gardenToken == address(0) || address(hatsModule) == address(0) || address(actionRegistry) == address(0)
                || address(commitmentRegistry) == address(0) || workApprovalResolver == address(0) || address(eas) == address(0)
                || workSchemaUID == bytes32(0) || workApprovalSchemaUID == bytes32(0) || legacyAssessmentSchemaUID == bytes32(0)
                || assessmentV3SchemaUID == bytes32(0)
        ) revert ICommitmentPoolingModule.ModuleNotReady();
    }

    function _requireSchemaUID(ICommitmentPoolingModule.ModuleSchemaKind kind, bytes32 uid) internal pure {
        if (uid == bytes32(0)) revert ICommitmentPoolingModule.SchemaUIDRequired(kind);
    }

    function _setSchemaUID(ICommitmentPoolingModule.ModuleSchemaKind kind, bytes32 previous, bytes32 next) internal {
        if (previous == next) return;
        emit ICommitmentPoolingModule.ModuleSchemaUIDUpdated(kind, previous, next);
    }

    function _requirePool(uint256 poolId) internal view returns (ICommitmentPoolingModule.Pool storage pool) {
        pool = pools[poolId];
        if (pool.state == ICommitmentPoolingModule.PoolState.None) {
            revert ICommitmentPoolingModule.UnknownPool(poolId);
        }
    }

    function _requirePoolState(
        uint256 poolId,
        ICommitmentPoolingModule.Pool storage pool,
        ICommitmentPoolingModule.PoolState expected
    )
        internal
        view
    {
        if (pool.state != expected) revert ICommitmentPoolingModule.PoolNotInState(poolId, pool.state);
    }

    function _requirePoolSteward(uint256 poolId, ICommitmentPoolingModule.Pool storage pool) internal view {
        if (msg.sender != owner() && !_isGardenSteward(pool.garden, msg.sender)) {
            revert ICommitmentPoolingModule.NotPoolSteward(msg.sender, poolId);
        }
    }

    function _isPoolSteward(uint256 poolId, address account) internal view returns (bool) {
        ICommitmentPoolingModule.Pool storage pool = pools[poolId];
        return pool.state != ICommitmentPoolingModule.PoolState.None
            && (account == owner() || _isGardenSteward(pool.garden, account));
    }

    function _isGardenSteward(address garden, address account) internal view returns (bool) {
        return hatsModule.isStewardOf(garden, account) || hatsModule.isOwnerOf(garden, account);
    }

    function _isGardenMember(address garden, address account) internal view returns (bool) {
        return hatsModule.isGardenerOf(garden, account) || hatsModule.isEvaluatorOf(garden, account)
            || hatsModule.isStewardOf(garden, account) || hatsModule.isOwnerOf(garden, account)
            || hatsModule.isFunderOf(garden, account) || hatsModule.isCommunityOf(garden, account);
    }

    function _requireCommitment(uint256 commitmentId)
        internal
        view
        returns (ICommitmentPoolingModule.Commitment storage commitment)
    {
        commitment = commitments[commitmentId];
        if (commitment.state == ICommitmentPoolingModule.CommitmentState.None) {
            revert ICommitmentPoolingModule.UnknownCommitment(commitmentId);
        }
    }

    function _requirePreAcceptanceState(
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment
    )
        internal
        view
    {
        if (
            commitment.state != ICommitmentPoolingModule.CommitmentState.Offered
                && commitment.state != ICommitmentPoolingModule.CommitmentState.Requested
        ) revert ICommitmentPoolingModule.CommitmentNotInState(commitmentId, commitment.state);
    }

    function _requireAcceptedUnfrozen(uint256 commitmentId)
        internal
        view
        returns (ICommitmentPoolingModule.Commitment storage commitment)
    {
        commitment = _requireCommitment(commitmentId);
        if (commitment.state != ICommitmentPoolingModule.CommitmentState.Accepted) {
            revert ICommitmentPoolingModule.CommitmentNotInState(commitmentId, commitment.state);
        }
        if (commitment.contributorsFrozen) revert ICommitmentPoolingModule.RosterAlreadyFrozen(commitmentId);
    }

    function _requireEditableRoster(uint256 commitmentId)
        internal
        view
        returns (ICommitmentPoolingModule.Commitment storage commitment)
    {
        return _requireAcceptedUnfrozen(commitmentId);
    }

    function _canEditProof(
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        address account
    )
        internal
        view
        returns (bool)
    {
        return contributors[commitmentId][account].active || account == commitment.leadProvider
            || _isPoolSteward(commitment.poolId, account);
    }
}
