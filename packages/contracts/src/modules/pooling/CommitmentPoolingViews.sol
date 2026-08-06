// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS, Attestation } from "@eas/IEAS.sol";

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentRegistry } from "../../interfaces/ICommitmentRegistry.sol";
import { IHatsModule } from "../../interfaces/IHatsModule.sol";
import { ActionRegistry } from "../../registries/Action.sol";
import { CommitmentPoolingCycles } from "./CommitmentPoolingCycles.sol";

/// @title CommitmentPoolingViews
/// @notice Read-only commitment, contributor, claim, and proof views.
abstract contract CommitmentPoolingViews is CommitmentPoolingCycles {
    function getCommitment(uint256 commitmentId) external view returns (ICommitmentPoolingModule.Commitment memory) {
        return _requireCommitment(commitmentId);
    }

    function getRequirement(
        uint256 commitmentId,
        uint16 requirementIndex
    )
        external
        view
        returns (ICommitmentPoolingModule.CommitmentRequirement memory)
    {
        ICommitmentPoolingModule.Commitment storage commitment = _requireCommitment(commitmentId);
        if (requirementIndex >= commitment.requirements.length) {
            revert ICommitmentPoolingModule.InvalidRequirementCount(requirementIndex);
        }
        return commitment.requirements[requirementIndex];
    }

    function getContributor(
        uint256 commitmentId,
        address contributor
    )
        external
        view
        returns (ICommitmentPoolingModule.ContributorRecord memory)
    {
        _requireCommitment(commitmentId);
        return contributors[commitmentId][contributor];
    }

    function isContributor(uint256 commitmentId, address contributor) external view returns (bool) {
        _requireCommitment(commitmentId);
        return contributors[commitmentId][contributor].active;
    }

    function isEligibleContributor(uint256 commitmentId, address contributor) external view returns (bool) {
        ICommitmentPoolingModule.Commitment storage commitment = _requireCommitment(commitmentId);
        ICommitmentPoolingModule.ContributorRecord storage record = contributors[commitmentId][contributor];
        return commitment.state == ICommitmentPoolingModule.CommitmentState.Fulfilled && commitment.contributorsFrozen
            && record.active && (record.approvedWorkCredits != 0 || record.evidenceCredits != 0);
    }

    function getPendingClaim(
        uint256 commitmentId,
        address claimant
    )
        external
        view
        returns (ICommitmentPoolingModule.PendingClaim memory)
    {
        _requireCommitment(commitmentId);
        return pendingClaim[commitmentId][claimant];
    }

    function getConfirmers(uint256 commitmentId) external view returns (address[] memory) {
        _requireCommitment(commitmentId);
        return commitmentConfirmers[commitmentId];
    }

    function workCommitmentOf(bytes32 workUID) external view returns (uint256 commitmentId) {
        return workCommitment[workUID];
    }

    function getLinkedWorkUIDs(uint256 commitmentId) external view returns (bytes32[] memory) {
        _requireCommitment(commitmentId);
        return commitmentWorkUIDs[commitmentId];
    }

    function isApprovalCounted(bytes32 approvalUID) external view returns (bool) {
        return approvalCounted[approvalUID];
    }

    function isEvidenceAttached(uint256 commitmentId, bytes32 cidHash) external view returns (bool) {
        _requireCommitment(commitmentId);
        return evidenceAttached[commitmentId][cidHash];
    }
}
