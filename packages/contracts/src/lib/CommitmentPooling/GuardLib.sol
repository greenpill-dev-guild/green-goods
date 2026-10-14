// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { IHatsModule } from "../../interfaces/IHatsModule.sol";
import { CommitmentPoolingCommonLib } from "./CommonLib.sol";

/// @title CommitmentPoolingGuardLib
/// @notice The shared guards and role predicates of `CommitmentPoolingAccess`, parameterized so
///         the deployed behavior libraries can apply the exact same rules.
/// @dev Internal-only: inlined into each consuming library, never deployed. Semantics must stay
///      byte-for-byte equivalent to the module-side originals in `CommitmentPoolingAccess`.
library CommitmentPoolingGuardLib {
    function requirePool(
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        uint256 poolId
    )
        internal
        view
        returns (ICommitmentPoolingModule.Pool storage pool)
    {
        pool = pools[poolId];
        if (pool.state == ICommitmentPoolingModule.PoolState.None) {
            revert ICommitmentPoolingModule.UnknownPool(poolId);
        }
    }

    function requirePoolState(
        uint256 poolId,
        ICommitmentPoolingModule.Pool storage pool,
        ICommitmentPoolingModule.PoolState expected
    )
        internal
        view
    {
        if (pool.state != expected) revert ICommitmentPoolingModule.PoolNotInState(poolId, pool.state);
    }

    function requirePoolSteward(
        CommitmentPoolingCommonLib.Env memory env,
        uint256 poolId,
        ICommitmentPoolingModule.Pool storage pool
    )
        internal
        view
    {
        if (msg.sender != env.owner && !isGardenSteward(env.hats, pool.garden, msg.sender)) {
            revert ICommitmentPoolingModule.NotPoolSteward(msg.sender, poolId);
        }
    }

    function isPoolSteward(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        uint256 poolId,
        address account
    )
        internal
        view
        returns (bool)
    {
        ICommitmentPoolingModule.Pool storage pool = pools[poolId];
        return pool.state != ICommitmentPoolingModule.PoolState.None
            && (account == env.owner || isGardenSteward(env.hats, pool.garden, account));
    }

    function isGardenSteward(IHatsModule hats, address garden, address account) internal view returns (bool) {
        return hats.isStewardOf(garden, account) || hats.isOwnerOf(garden, account);
    }

    function isGardenMember(IHatsModule hats, address garden, address account) internal view returns (bool) {
        return hats.isGardenerOf(garden, account) || hats.isEvaluatorOf(garden, account)
            || hats.isStewardOf(garden, account) || hats.isOwnerOf(garden, account) || hats.isFunderOf(garden, account)
            || hats.isCommunityOf(garden, account);
    }

    function requireCommitment(
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        uint256 commitmentId
    )
        internal
        view
        returns (ICommitmentPoolingModule.Commitment storage commitment)
    {
        commitment = commitments[commitmentId];
        if (commitment.state == ICommitmentPoolingModule.CommitmentState.None) {
            revert ICommitmentPoolingModule.UnknownCommitment(commitmentId);
        }
    }

    function requirePreAcceptanceState(
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

    function requireAcceptedUnfrozen(
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        uint256 commitmentId
    )
        internal
        view
        returns (ICommitmentPoolingModule.Commitment storage commitment)
    {
        commitment = requireCommitment(commitments, commitmentId);
        if (commitment.state != ICommitmentPoolingModule.CommitmentState.Accepted) {
            revert ICommitmentPoolingModule.CommitmentNotInState(commitmentId, commitment.state);
        }
        if (commitment.contributorsFrozen) revert ICommitmentPoolingModule.RosterAlreadyFrozen(commitmentId);
    }

    function canEditProof(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(
            uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record)
        ) storage contributors,
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        address account
    )
        internal
        view
        returns (bool)
    {
        return contributors[commitmentId][account].active || account == commitment.leadProvider
            || isPoolSteward(env, pools, commitment.poolId, account);
    }
}
