// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS, Attestation } from "@eas/IEAS.sol";

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentRegistry } from "../../interfaces/ICommitmentRegistry.sol";
import { IHatsModule } from "../../interfaces/IHatsModule.sol";
import { ActionRegistry } from "../../registries/Action.sol";
import { CommitmentPoolingCredit, IWorkDecisionSequenceResolver } from "./CommitmentPoolingCredit.sol";

/// @title CommitmentPoolingConfig
/// @notice Frozen bounds, dependency wiring, schema UIDs, and pause control.
abstract contract CommitmentPoolingConfig is CommitmentPoolingCredit {
    function MAX_CONFIRMERS() external pure returns (uint256) {
        return MAX_CONFIRMERS_VALUE;
    }

    function MAX_REQUIREMENTS() external pure returns (uint256) {
        return MAX_REQUIREMENTS_VALUE;
    }

    function MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT() external pure returns (uint256) {
        return MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT_VALUE;
    }

    function MAX_CONTRIBUTORS_PER_COMMITMENT() external pure returns (uint256) {
        return MAX_CONTRIBUTORS_PER_COMMITMENT_VALUE;
    }

    function MAX_LINKED_WORKS_PER_COMMITMENT() external pure returns (uint256) {
        return MAX_LINKED_WORKS_PER_COMMITMENT_VALUE;
    }

    function cyclelessRecognitionPolicy()
        external
        pure
        returns (ICommitmentPoolingModule.RecognitionPolicy memory policy)
    {
        policy = ICommitmentPoolingModule.RecognitionPolicy({
            equalParticipationBps: CYCLELESS_EQUAL_PARTICIPATION_BPS,
            verifiedContributionBps: CYCLELESS_VERIFIED_CONTRIBUTION_BPS
        });
    }

    function getCommitmentIdByCreationRequest(
        address creator,
        bytes32 creationRequestKey
    )
        external
        view
        returns (uint256 commitmentId)
    {
        return commitmentIdByCreationRequest[creator][creationRequestKey];
    }

    function getWorkLinkOperationPayloadHash(
        address caller,
        bytes32 operationKey
    )
        external
        view
        returns (bytes32 payloadHash)
    {
        return workLinkPayloadHashByOperation[caller][operationKey];
    }

    function setGardenToken(address gardenToken_) external onlyOwner onlyWhilePaused {
        if (gardenToken_ == address(0)) revert ICommitmentPoolingModule.ZeroAddress();
        address previous = gardenToken;
        if (previous == gardenToken_) return;
        gardenToken = gardenToken_;
        emit ICommitmentPoolingModule.ModuleDependencyUpdated(
            ICommitmentPoolingModule.ModuleDependency.GardenToken, previous, gardenToken_
        );
    }

    function setHatsModule(address hatsModule_) external onlyOwner onlyWhilePaused {
        if (hatsModule_ == address(0)) revert ICommitmentPoolingModule.ZeroAddress();
        address previous = address(hatsModule);
        if (previous == hatsModule_) return;
        hatsModule = IHatsModule(hatsModule_);
        emit ICommitmentPoolingModule.ModuleDependencyUpdated(
            ICommitmentPoolingModule.ModuleDependency.HatsModule, previous, hatsModule_
        );
    }

    function setActionRegistry(address actionRegistry_) external onlyOwner onlyWhilePaused {
        if (actionRegistry_ == address(0)) revert ICommitmentPoolingModule.ZeroAddress();
        address previous = address(actionRegistry);
        if (previous == actionRegistry_) return;
        actionRegistry = ActionRegistry(actionRegistry_);
        emit ICommitmentPoolingModule.ModuleDependencyUpdated(
            ICommitmentPoolingModule.ModuleDependency.ActionRegistry, previous, actionRegistry_
        );
    }

    function setCommitmentRegistry(address registry_) external onlyOwner onlyWhilePaused {
        if (registry_ == address(0)) revert ICommitmentPoolingModule.ZeroAddress();
        address previous = address(commitmentRegistry);
        if (previous == registry_) return;
        commitmentRegistry = ICommitmentRegistry(registry_);
        emit ICommitmentPoolingModule.ModuleDependencyUpdated(
            ICommitmentPoolingModule.ModuleDependency.CommitmentRegistry, previous, registry_
        );
    }

    function setWorkApprovalResolver(address resolver_) external onlyOwner onlyWhilePaused {
        if (resolver_ == address(0)) revert ICommitmentPoolingModule.ZeroAddress();
        address previous = workApprovalResolver;
        if (previous == resolver_) return;
        workApprovalResolver = resolver_;
        emit ICommitmentPoolingModule.ModuleDependencyUpdated(
            ICommitmentPoolingModule.ModuleDependency.WorkApprovalResolver, previous, resolver_
        );
    }

    function setEAS(address eas_) external onlyOwner onlyWhilePaused {
        if (eas_ == address(0)) revert ICommitmentPoolingModule.ZeroAddress();
        address previous = address(eas);
        if (previous == eas_) return;
        eas = IEAS(eas_);
        emit ICommitmentPoolingModule.ModuleDependencyUpdated(ICommitmentPoolingModule.ModuleDependency.EAS, previous, eas_);
    }

    function setSchemaUIDs(
        bytes32 workUID,
        bytes32 workApprovalUID,
        bytes32 legacyAssessmentUID,
        bytes32 assessmentV3UID
    )
        external
        onlyOwner
        onlyWhilePaused
    {
        _requireSchemaUID(ICommitmentPoolingModule.ModuleSchemaKind.Work, workUID);
        _requireSchemaUID(ICommitmentPoolingModule.ModuleSchemaKind.WorkApproval, workApprovalUID);
        _requireSchemaUID(ICommitmentPoolingModule.ModuleSchemaKind.LegacyAssessment, legacyAssessmentUID);
        _requireSchemaUID(ICommitmentPoolingModule.ModuleSchemaKind.AssessmentV3, assessmentV3UID);
        if (
            workUID == workApprovalUID || workUID == legacyAssessmentUID || workUID == assessmentV3UID
                || workApprovalUID == legacyAssessmentUID || workApprovalUID == assessmentV3UID
                || legacyAssessmentUID == assessmentV3UID
        ) revert ICommitmentPoolingModule.SchemaUIDCollision(workUID);
        if (
            workSchemaUID == workUID && workApprovalSchemaUID == workApprovalUID
                && legacyAssessmentSchemaUID == legacyAssessmentUID && assessmentV3SchemaUID == assessmentV3UID
        ) return;

        _setSchemaUID(ICommitmentPoolingModule.ModuleSchemaKind.Work, workSchemaUID, workUID);
        _setSchemaUID(ICommitmentPoolingModule.ModuleSchemaKind.WorkApproval, workApprovalSchemaUID, workApprovalUID);
        _setSchemaUID(
            ICommitmentPoolingModule.ModuleSchemaKind.LegacyAssessment, legacyAssessmentSchemaUID, legacyAssessmentUID
        );
        _setSchemaUID(ICommitmentPoolingModule.ModuleSchemaKind.AssessmentV3, assessmentV3SchemaUID, assessmentV3UID);
        workSchemaUID = workUID;
        workApprovalSchemaUID = workApprovalUID;
        legacyAssessmentSchemaUID = legacyAssessmentUID;
        assessmentV3SchemaUID = assessmentV3UID;
    }

    function setPaused(bool paused_) external onlyOwner {
        if (paused == paused_) return;
        if (!paused_) _requireCompleteConfiguration();
        bool previous = paused;
        paused = paused_;
        emit ICommitmentPoolingModule.ModulePauseStatusChanged(previous, paused_);
    }
}
