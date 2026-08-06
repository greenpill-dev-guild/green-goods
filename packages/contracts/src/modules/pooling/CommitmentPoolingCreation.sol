// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS, Attestation } from "@eas/IEAS.sol";

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentRegistry } from "../../interfaces/ICommitmentRegistry.sol";
import { IHatsModule } from "../../interfaces/IHatsModule.sol";
import { ActionRegistry } from "../../registries/Action.sol";
import {
    CommitmentPoolingCreationValidation, IWorkDecisionSequenceResolver
} from "./CommitmentPoolingCreationValidation.sol";

/// @title CommitmentPoolingCreation
/// @notice Commitment creation and its immutable creation event.
abstract contract CommitmentPoolingCreation is CommitmentPoolingCreationValidation {
    // solhint-disable-next-line code-complexity
    function createCommitment(ICommitmentPoolingModule.CreateCommitmentParams calldata params)
        external
        whenOperational
        nonReentrant
        returns (uint256 commitmentId)
    {
        ICommitmentPoolingModule.Pool storage pool = _requirePool(params.poolId);
        _requirePoolState(params.poolId, pool, ICommitmentPoolingModule.PoolState.Open);
        if (params.creationRequestKey == bytes32(0)) {
            revert ICommitmentPoolingModule.InvalidCommitmentCreationRequestKey();
        }
        if (bytes(params.unitLabel).length == 0) revert ICommitmentPoolingModule.UnitLabelRequired();
        if (params.targetUnits == 0) revert ICommitmentPoolingModule.TargetUnitsRequired();
        _validateReward(params.reward);
        _validateDeclaredValue(params.declaredUnitValue, params.declaredValueBasis);
        _validateConfirmerRule(params.confirmers, params.confirmationThreshold, params.protocolFallbackEnabled);

        address creator = _resolveCreator(params, pool);
        uint32 effectiveThreshold = params.confirmers.length == 0 ? 1 : params.confirmationThreshold;
        bytes32 creationPayloadHash = _creationPayloadHash(params, effectiveThreshold);
        uint256 existingId = commitmentIdByCreationRequest[creator][params.creationRequestKey];
        if (existingId != 0) {
            if (commitments[existingId].creationPayloadHash != creationPayloadHash) {
                revert ICommitmentPoolingModule.CommitmentCreationRequestConflict(params.creationRequestKey, existingId);
            }
            return existingId;
        }

        _validateCycleForCreation(params.poolId, params.cycleId, params.commitmentType);
        _validateSeriesForCreation(params, creator);
        _validateCounterCommitment(params, creator);

        (
            uint8[] memory domains,
            uint256[] memory requirementActionUIDs,
            uint8[] memory requirementDomains,
            uint32[] memory requirementRequiredCounts
        ) = _validateAndBuildRequirements(params);

        commitmentId = nextCommitmentId++;
        ICommitmentPoolingModule.Commitment storage commitment = commitments[commitmentId];
        commitment.poolId = params.poolId;
        commitment.cycleId = params.cycleId;
        commitment.commitmentSeriesId = params.commitmentSeriesId;
        commitment.creator = creator;
        commitment.creationRequestKey = params.creationRequestKey;
        commitment.creationPayloadHash = creationPayloadHash;
        commitment.direction = params.direction;
        commitment.commitmentType = params.commitmentType;
        commitment.state = params.direction == ICommitmentPoolingModule.CommitmentDirection.Offer
            ? ICommitmentPoolingModule.CommitmentState.Offered
            : ICommitmentPoolingModule.CommitmentState.Requested;
        commitment.claimType = params.claimType;
        commitment.claimMode = params.claimMode;
        commitment.contributorPolicy = params.contributorPolicy;
        commitment.domains = domains;
        commitment.dueDate = params.dueDate;
        commitment.unitLabel = params.unitLabel;
        commitment.targetUnits = params.targetUnits;
        commitment.confirmationThreshold = effectiveThreshold;
        commitment.protocolFallbackEnabled = params.protocolFallbackEnabled;
        commitment.requiresAssessment = params.requiresAssessment;
        commitment.needUID = params.needUID;
        commitment.counterCommitmentId = params.counterCommitmentId;
        commitment.metadataCID = params.metadataCID;
        commitment.reward = params.reward;
        commitment.declaredUnitValue = params.declaredUnitValue;
        commitment.declaredValueBasis = params.declaredValueBasis;
        commitment.providerGarden = pool.garden;

        for (uint256 i = 0; i < params.requirements.length; i++) {
            commitment.requirements.push(
                ICommitmentPoolingModule.CommitmentRequirement({
                    actionUID: requirementActionUIDs[i],
                    domain: requirementDomains[i],
                    requiredCount: requirementRequiredCounts[i],
                    approvedCount: 0
                })
            );
        }
        for (uint256 i = 0; i < params.confirmers.length; i++) {
            commitmentConfirmers[commitmentId].push(params.confirmers[i]);
        }

        commitmentIdByCreationRequest[creator][params.creationRequestKey] = commitmentId;
        pool.liveCommitmentCount++;
        if (params.cycleId != 0) cycles[params.cycleId].liveCommitmentCount++;

        commitmentRegistry.registerClass(commitmentId, params.poolId, params.cycleId, params.unitLabel, params.targetUnits);
        if (params.direction == ICommitmentPoolingModule.CommitmentDirection.Offer) {
            if (!_isGardenMember(pool.garden, creator)) {
                revert ICommitmentPoolingModule.NotEligibleContributor(creator);
            }
            commitmentRegistry.commitUnits(commitmentId, creator, params.targetUnits);
        }

        _emitCommitmentCreated(
            commitmentId,
            params,
            creator,
            creationPayloadHash,
            domains,
            requirementActionUIDs,
            requirementDomains,
            requirementRequiredCounts
        );
        if (params.reward.amount != 0) {
            emit ICommitmentPoolingModule.RewardDeclared(
                commitmentId, params.reward.rail, params.reward.source, params.reward.token, params.reward.amount
            );
        }
        if (params.declaredUnitValue != 0) {
            emit ICommitmentPoolingModule.ValueDeclared(commitmentId, params.declaredUnitValue, params.declaredValueBasis);
        }
        emit ICommitmentPoolingModule.ConfirmerRuleSet(
            commitmentId, params.confirmers, effectiveThreshold, params.protocolFallbackEnabled
        );
    }

    function _emitCommitmentCreated(
        uint256 commitmentId,
        ICommitmentPoolingModule.CreateCommitmentParams calldata params,
        address creator,
        bytes32 creationPayloadHash,
        uint8[] memory domains,
        uint256[] memory requirementActionUIDs,
        uint8[] memory requirementDomains,
        uint32[] memory requirementRequiredCounts
    )
        private
    {
        emit ICommitmentPoolingModule.CommitmentCreated(
            commitmentId,
            params.poolId,
            params.cycleId,
            params.commitmentSeriesId,
            params.creationRequestKey,
            creationPayloadHash,
            creator,
            msg.sender,
            params.direction,
            params.commitmentType,
            params.claimType,
            params.claimMode,
            params.contributorPolicy,
            domains,
            requirementActionUIDs,
            requirementDomains,
            requirementRequiredCounts,
            params.unitLabel,
            params.targetUnits,
            params.requiresAssessment,
            params.dueDate,
            params.metadataCID,
            params.needUID,
            params.counterCommitmentId,
            params.declaredUnitValue,
            params.declaredValueBasis
        );
    }
}
