// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingCommonLib } from "./CommonLib.sol";
import { CommitmentPoolingCreationChecksLib } from "./CreationChecksLib.sol";
import { CommitmentPoolingGuardLib } from "./GuardLib.sol";

/// @title CommitmentPoolingCreationLib
/// @notice Deployed behavior library: commitment creation and its immutable creation event.
/// @dev Runs via DELEGATECALL from `CommitmentPoolingModule`, so `msg.sender` is the module
///      caller and every event and revert surfaces from the proxy address unchanged. State
///      arrives as explicit storage references; the module's frozen layout is never assumed here.
///      The commitment counter arrives by value — the shell increments it exactly when the
///      returned id is the fresh one, so the idempotent replay return never burns an id.
library CommitmentPoolingCreationLib {
    // solhint-disable-next-line code-complexity
    function createCommitment(
        CommitmentPoolingCommonLib.Env memory env,
        ICommitmentPoolingModule.CreateCommitmentParams calldata params,
        mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) storage pools,
        mapping(uint256 cycleId => ICommitmentPoolingModule.Cycle cycle) storage cycles,
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        mapping(uint256 seriesId => ICommitmentPoolingModule.CommitmentSeries series) storage commitmentSeries,
        mapping(uint256 commitmentId => address[] confirmers) storage commitmentConfirmers,
        mapping(address creator => mapping(bytes32 creationRequestKey => uint256 commitmentId)) storage
            commitmentIdByCreationRequest,
        uint256 nextCommitmentIdValue
    )
        external
        returns (uint256 commitmentId)
    {
        ICommitmentPoolingModule.Pool storage pool = CommitmentPoolingGuardLib.requirePool(pools, params.poolId);
        CommitmentPoolingGuardLib.requirePoolState(params.poolId, pool, ICommitmentPoolingModule.PoolState.Open);
        if (params.creationRequestKey == bytes32(0)) {
            revert ICommitmentPoolingModule.InvalidCommitmentCreationRequestKey();
        }
        if (bytes(params.unitLabel).length == 0) revert ICommitmentPoolingModule.UnitLabelRequired();
        if (params.targetUnits == 0) revert ICommitmentPoolingModule.TargetUnitsRequired();
        CommitmentPoolingCreationChecksLib.validateConsideration(params.consideration);
        CommitmentPoolingCreationChecksLib.validateDeclaredValue(params.declaredUnitValue, params.declaredValueBasis);
        CommitmentPoolingCreationChecksLib.validateConfirmerRule(
            env, params.confirmers, params.confirmationThreshold, params.protocolFallbackEnabled
        );

        address creator = CommitmentPoolingCreationChecksLib.resolveCreator(env, params, pool);
        uint32 effectiveThreshold = params.confirmers.length == 0 ? 1 : params.confirmationThreshold;
        bytes32 creationPayloadHash = CommitmentPoolingCreationChecksLib.creationPayloadHash(params, effectiveThreshold);
        uint256 existingId = commitmentIdByCreationRequest[creator][params.creationRequestKey];
        if (existingId != 0) {
            if (commitments[existingId].creationPayloadHash != creationPayloadHash) {
                revert ICommitmentPoolingModule.CommitmentCreationRequestConflict(params.creationRequestKey, existingId);
            }
            return existingId;
        }

        CommitmentPoolingCreationChecksLib.validateCycleForCreation(cycles, params.poolId, params.cycleId);
        CommitmentPoolingCreationChecksLib.validateSeriesForCreation(commitmentSeries, params, creator);
        CommitmentPoolingCreationChecksLib.validateCounterCommitment(
            env, commitments, params, creator, nextCommitmentIdValue
        );

        (
            uint8[] memory domains,
            uint256[] memory requirementActionUIDs,
            uint8[] memory requirementDomains,
            uint32[] memory requirementRequiredCounts
        ) = CommitmentPoolingCreationChecksLib.validateAndBuildRequirements(env, params);

        commitmentId = nextCommitmentIdValue;
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
        commitment.consideration = params.consideration;
        commitment.declaredUnitValue = params.declaredUnitValue;
        commitment.declaredValueBasis = params.declaredValueBasis;
        commitment.providerGarden = pool.garden;
        // The payer is the asking side (register #90). A Request's asker is the pool itself, so it
        // is known now and never moves. An Offer's payer is whoever claims it, so it stays zero
        // until acceptance resolves the claiming garden.
        if (params.direction == ICommitmentPoolingModule.CommitmentDirection.Request) {
            commitment.payerGarden = pool.garden;
        }

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

        env.registry.registerClass(commitmentId, params.poolId, params.cycleId, params.unitLabel, params.targetUnits);
        if (params.direction == ICommitmentPoolingModule.CommitmentDirection.Offer) {
            if (!CommitmentPoolingGuardLib.isGardenMember(env.hats, pool.garden, creator)) {
                revert ICommitmentPoolingModule.NotEligibleContributor(creator);
            }
            env.registry.commitUnits(commitmentId, creator, params.targetUnits);
        }

        _emitCommitmentCreated(
            commitmentId,
            params,
            creator,
            creationPayloadHash,
            domains,
            requirementActionUIDs,
            requirementDomains,
            requirementRequiredCounts,
            commitment.payerGarden
        );
        if (params.consideration.amount != 0) {
            emit ICommitmentPoolingModule.ConsiderationDeclared(
                commitmentId,
                params.consideration.rail,
                params.consideration.source,
                params.consideration.token,
                params.consideration.amount
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
        uint32[] memory requirementRequiredCounts,
        address payerGarden
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
            params.declaredValueBasis,
            payerGarden
        );
    }
}
