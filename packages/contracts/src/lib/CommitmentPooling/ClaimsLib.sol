// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingAcceptanceLib } from "./AcceptanceLib.sol";
import { CommitmentPoolingCommonLib } from "./CommonLib.sol";
import { CommitmentPoolingGuardLib } from "./GuardLib.sol";

/// @title CommitmentPoolingClaimsLib
/// @notice Deployed behavior library: claim, acceptance, decline, and lead-managed roster entry.
/// @dev Runs via DELEGATECALL from `CommitmentPoolingModule`; `msg.sender`, events, and reverts
///      surface from the proxy unchanged. Semantics track the retired facet bodies exactly.
library CommitmentPoolingClaimsLib {
    function claimCommitment(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(address garden => uint256 poolId) storage gardenPool,
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        mapping(uint256 commitmentId => mapping(address claimant => ICommitmentPoolingModule.PendingClaim claim)) storage
            pendingClaim,
        mapping(uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record))
            storage contributors,
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        uint256 commitmentId,
        ICommitmentPoolingModule.ClaimType kind,
        address gardenContext
    )
        external
    {
        ICommitmentPoolingModule.Commitment storage commitment =
            CommitmentPoolingGuardLib.requireCommitment(commitments, commitmentId);
        CommitmentPoolingGuardLib.requirePoolState(
            commitment.poolId, pools[commitment.poolId], ICommitmentPoolingModule.PoolState.Open
        );
        CommitmentPoolingGuardLib.requirePreAcceptanceState(commitmentId, commitment);
        if (kind != commitment.claimType) {
            revert ICommitmentPoolingModule.ClaimTypeMismatch(commitmentId, commitment.claimType, kind);
        }

        (address claimant, address requestedBy) =
            CommitmentPoolingAcceptanceLib.resolveClaimant(env, pools, gardenPool, commitment, kind, gardenContext);
        if (claimant == commitment.creator || requestedBy == commitment.creator) {
            revert ICommitmentPoolingModule.SelfCounterparty();
        }

        if (commitment.claimMode == ICommitmentPoolingModule.ClaimMode.Open) {
            CommitmentPoolingAcceptanceLib.acceptCommitment(
                env,
                pools,
                contributors,
                commitmentConfirmers,
                commitmentId,
                commitment,
                claimant,
                requestedBy,
                kind,
                gardenContext,
                true
            );
        } else {
            ICommitmentPoolingModule.PendingClaim storage claim = pendingClaim[commitmentId][claimant];
            claim.claimant = claimant;
            claim.requestedBy = requestedBy;
            claim.kind = kind;
            claim.gardenContext = gardenContext;
            claim.requestedAt = uint64(block.timestamp);
            claim.active = true;
            emit ICommitmentPoolingModule.ClaimRequested(
                commitmentId, claimant, requestedBy, kind, gardenContext, uint64(block.timestamp)
            );
        }
    }

    function acceptClaim(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        mapping(uint256 commitmentId => mapping(address claimant => ICommitmentPoolingModule.PendingClaim claim)) storage
            pendingClaim,
        mapping(uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record))
            storage contributors,
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        uint256 commitmentId,
        address claimant
    )
        external
    {
        ICommitmentPoolingModule.Commitment storage commitment =
            CommitmentPoolingGuardLib.requireCommitment(commitments, commitmentId);
        CommitmentPoolingGuardLib.requirePoolState(
            commitment.poolId, pools[commitment.poolId], ICommitmentPoolingModule.PoolState.Open
        );
        CommitmentPoolingGuardLib.requirePreAcceptanceState(commitmentId, commitment);
        if (commitment.claimMode != ICommitmentPoolingModule.ClaimMode.ApprovalGated) {
            revert ICommitmentPoolingModule.ClaimModeMismatch(commitmentId);
        }
        CommitmentPoolingGuardLib.requirePoolSteward(env, commitment.poolId, pools[commitment.poolId]);
        ICommitmentPoolingModule.PendingClaim storage claim = pendingClaim[commitmentId][claimant];
        if (!claim.active) revert ICommitmentPoolingModule.ClaimNotPending(commitmentId, claimant);
        if (claim.claimant == commitment.creator || claim.requestedBy == commitment.creator) {
            revert ICommitmentPoolingModule.SelfCounterparty();
        }
        ICommitmentPoolingModule.PendingClaim memory acceptedClaim = claim;
        delete pendingClaim[commitmentId][claimant];
        CommitmentPoolingAcceptanceLib.acceptCommitment(
            env,
            pools,
            contributors,
            commitmentConfirmers,
            commitmentId,
            commitment,
            acceptedClaim.claimant,
            acceptedClaim.requestedBy,
            acceptedClaim.kind,
            acceptedClaim.gardenContext,
            true
        );
    }

    function declineClaim(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        mapping(uint256 commitmentId => mapping(address claimant => ICommitmentPoolingModule.PendingClaim claim)) storage
            pendingClaim,
        uint256 commitmentId,
        address claimant,
        string calldata reasonCID
    )
        external
    {
        ICommitmentPoolingModule.Commitment storage commitment =
            CommitmentPoolingGuardLib.requireCommitment(commitments, commitmentId);
        CommitmentPoolingGuardLib.requirePoolState(
            commitment.poolId, pools[commitment.poolId], ICommitmentPoolingModule.PoolState.Open
        );
        CommitmentPoolingGuardLib.requirePoolSteward(env, commitment.poolId, pools[commitment.poolId]);
        if (bytes(reasonCID).length == 0) revert ICommitmentPoolingModule.ReasonRequired();
        if (!pendingClaim[commitmentId][claimant].active) {
            revert ICommitmentPoolingModule.ClaimNotPending(commitmentId, claimant);
        }
        delete pendingClaim[commitmentId][claimant];
        emit ICommitmentPoolingModule.ClaimDeclined(commitmentId, claimant, reasonCID);
    }

    function addContributor(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        mapping(uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord record))
            storage contributors,
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        uint256 commitmentId,
        address contributor
    )
        external
    {
        ICommitmentPoolingModule.Commitment storage commitment =
            CommitmentPoolingGuardLib.requireAcceptedUnfrozen(commitments, commitmentId);
        if (commitment.contributorPolicy != ICommitmentPoolingModule.ContributorPolicy.LeadManaged) {
            revert ICommitmentPoolingModule.ContributorPolicyMismatch(commitmentId);
        }
        if (
            msg.sender != commitment.leadProvider
                && !CommitmentPoolingGuardLib.isPoolSteward(env, pools, commitment.poolId, msg.sender)
        ) {
            revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        }
        CommitmentPoolingAcceptanceLib.addContributor(
            env, commitmentConfirmers, contributors, commitmentId, commitment, contributor, msg.sender
        );
    }
}
