// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingClaimsLib } from "../../lib/CommitmentPooling/ClaimsLib.sol";
import { CommitmentPoolingConfirmLib } from "../../lib/CommitmentPooling/ConfirmLib.sol";
import { CommitmentPoolingCreationLib } from "../../lib/CommitmentPooling/CreationLib.sol";
import { CommitmentPoolingProofLib } from "../../lib/CommitmentPooling/ProofLib.sol";
import { CommitmentPoolingAdmin } from "./Admin.sol";

/// @title CommitmentPoolingLifecycle
/// @notice The commitment lifecycle from creation to fulfillment: creation, claims and
///         acceptance, readiness and confirmation, and proof (evidence, assessment, Work credit).
/// @dev Shells only: behavior lives in the deployed Creation/Claims/Confirm/Proof libraries and
///      runs via DELEGATECALL in this contract's storage context. ABI, events, and reverts are
///      unchanged. The creation shell owns the commitment counter increment.
abstract contract CommitmentPoolingLifecycle is CommitmentPoolingAdmin {
    // ═════════════════════════════ Creation ═════════════════════════════

    function createCommitment(ICommitmentPoolingModule.CreateCommitmentParams calldata params)
        external
        whenOperational
        nonReentrant
        returns (uint256 commitmentId)
    {
        commitmentId = CommitmentPoolingCreationLib.createCommitment(
            _env(),
            params,
            pools,
            cycles,
            commitments,
            commitmentSeries,
            commitmentConfirmers,
            commitmentIdByCreationRequest,
            nextCommitmentId
        );
        // The library returns either the fresh id (== nextCommitmentId) or an existing id from
        // the idempotent replay path. Only the fresh id consumes the counter.
        if (commitmentId == nextCommitmentId) nextCommitmentId = commitmentId + 1;
    }

    // ═════════════════════════════ Claims ═════════════════════════════

    function claimCommitment(
        uint256 commitmentId,
        ICommitmentPoolingModule.ClaimType kind,
        address gardenContext
    )
        external
        whenOperational
        nonReentrant
    {
        CommitmentPoolingClaimsLib.claimCommitment(
            _env(),
            pools,
            gardenPool,
            commitments,
            pendingClaim,
            contributors,
            commitmentConfirmers,
            commitmentId,
            kind,
            gardenContext
        );
    }

    function acceptClaim(uint256 commitmentId, address claimant) external whenOperational nonReentrant {
        CommitmentPoolingClaimsLib.acceptClaim(
            _env(), pools, commitments, pendingClaim, contributors, commitmentConfirmers, commitmentId, claimant
        );
    }

    function declineClaim(uint256 commitmentId, address claimant, string calldata reasonCID) external whenOperational {
        CommitmentPoolingClaimsLib.declineClaim(_env(), pools, commitments, pendingClaim, commitmentId, claimant, reasonCID);
    }

    function addContributor(uint256 commitmentId, address contributor) external whenOperational {
        CommitmentPoolingClaimsLib.addContributor(
            _env(), pools, commitments, contributors, commitmentConfirmers, commitmentId, contributor
        );
    }

    // ═════════════════════════════ Confirmation ═════════════════════════════

    function submitForConfirmation(uint256 commitmentId) external whenOperational {
        CommitmentPoolingConfirmLib.submitForConfirmation(
            _env(),
            pools,
            commitments,
            cycles,
            commitmentWorkUIDs,
            latestWorkDecisionSequence,
            commitmentConfirmers,
            contributors,
            commitmentId
        );
    }

    function markReadyForConfirmation(uint256 commitmentId, string calldata reason) external whenOperational {
        CommitmentPoolingConfirmLib.markReadyForConfirmation(
            _env(),
            pools,
            commitments,
            cycles,
            commitmentWorkUIDs,
            latestWorkDecisionSequence,
            commitmentConfirmers,
            contributors,
            commitmentId,
            reason
        );
    }

    function confirmFulfillment(uint256 commitmentId) external whenOperational nonReentrant {
        CommitmentPoolingConfirmLib.confirmFulfillment(
            _env(), pools, cycles, commitments, contributors, commitmentConfirmers, hasConfirmed, commitmentId
        );
    }

    function confirmFulfillmentAsFallback(
        uint256 commitmentId,
        string calldata reason
    )
        external
        whenOperational
        nonReentrant
    {
        CommitmentPoolingConfirmLib.confirmFulfillmentAsFallback(
            _env(), pools, cycles, commitments, contributors, commitmentConfirmers, commitmentId, reason
        );
    }

    // ═════════════════════════════ Proof ═════════════════════════════

    function attachEvidence(
        uint256 commitmentId,
        string calldata cid,
        address[] calldata creditedContributors
    )
        external
        whenOperational
    {
        CommitmentPoolingProofLib.attachEvidence(
            _env(), pools, commitments, contributors, evidenceAttached, commitmentId, cid, creditedContributors
        );
    }

    function attachAssessment(uint256 commitmentId, bytes32 assessmentUID) external whenOperational {
        CommitmentPoolingProofLib.attachAssessment(
            _env(),
            pools,
            commitments,
            cycles,
            commitmentWorkUIDs,
            latestWorkDecisionSequence,
            commitmentConfirmers,
            contributors,
            commitmentId,
            assessmentUID
        );
    }

    function linkWork(
        uint256 commitmentId,
        bytes32 workUID,
        uint16 requirementIndex,
        bytes32 operationKey
    )
        external
        whenOperational
    {
        CommitmentPoolingProofLib.linkWork(
            _env(),
            pools,
            commitments,
            contributors,
            workCommitment,
            commitmentWorkUIDs,
            workRequirementIndexPlusOne,
            workLinkPayloadHashByOperation,
            commitmentId,
            workUID,
            requirementIndex,
            operationKey
        );
    }

    /// @dev No pause gate: the resolver hook must stay non-blocking for Work approval flows.
    function onWorkDecision(
        bytes32 workUID,
        bytes32 approvalUID,
        uint64 decisionSequence,
        address garden,
        bool approved
    )
        external
    {
        CommitmentPoolingProofLib.onWorkDecision(
            _env(),
            commitments,
            contributors,
            cycles,
            commitmentWorkUIDs,
            workCommitment,
            latestWorkDecisionSequence,
            latestWorkDecisionUID,
            approvalCounted,
            workCreditActive,
            workRequirementIndexPlusOne,
            commitmentConfirmers,
            abi.encode(workUID, approvalUID, decisionSequence, garden, approved)
        );
    }
}
