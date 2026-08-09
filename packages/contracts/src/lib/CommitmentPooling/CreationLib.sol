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
    /// @dev Mirrors the non-indexed `CommitmentCreated` fields in their frozen ABI order.
    ///      Encoding one tuple keeps coverage's minimum-IR compiler from materializing all
    ///      24 event values on the Yul stack at once. `_emitCommitmentCreated` removes the
    ///      tuple's leading ABI offset before emitting, so the resulting log data is byte-for-byte
    ///      identical to a Solidity `emit CommitmentCreated(...)` statement.
    struct CommitmentCreatedData {
        uint256 commitmentSeriesId;
        bytes32 creationRequestKey;
        bytes32 creationPayloadHash;
        address creator;
        address recordedBy;
        ICommitmentPoolingModule.CommitmentDirection direction;
        ICommitmentPoolingModule.CommitmentType commitmentType;
        ICommitmentPoolingModule.ClaimType claimType;
        ICommitmentPoolingModule.ClaimMode claimMode;
        ICommitmentPoolingModule.ContributorPolicy contributorPolicy;
        uint8[] domains;
        uint256[] requirementActionUIDs;
        uint8[] requirementDomains;
        uint32[] requirementRequiredCounts;
        string unitLabel;
        uint256 targetUnits;
        bool requiresAssessment;
        uint64 dueDate;
        string metadataCID;
        bytes32 needUID;
        uint256 counterCommitmentId;
        uint256 declaredUnitValue;
        string declaredValueBasis;
        address payerGarden;
    }

    bytes32 private constant COMMITMENT_CREATED_TOPIC = keccak256(
        // solhint-disable-next-line max-line-length
        "CommitmentCreated(uint256,uint256,uint256,uint256,bytes32,bytes32,address,address,uint8,uint8,uint8,uint8,uint8,uint8[],uint256[],uint8[],uint32[],string,uint256,bool,uint64,string,bytes32,uint256,uint256,string,address)"
    );

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
        CommitmentCreatedData memory data;
        data.commitmentSeriesId = params.commitmentSeriesId;
        data.creationRequestKey = params.creationRequestKey;
        data.creationPayloadHash = creationPayloadHash;
        data.creator = creator;
        data.recordedBy = msg.sender;
        data.direction = params.direction;
        data.commitmentType = params.commitmentType;
        data.claimType = params.claimType;
        data.claimMode = params.claimMode;
        data.contributorPolicy = params.contributorPolicy;
        data.domains = domains;
        data.requirementActionUIDs = requirementActionUIDs;
        data.requirementDomains = requirementDomains;
        data.requirementRequiredCounts = requirementRequiredCounts;
        data.unitLabel = params.unitLabel;
        data.targetUnits = params.targetUnits;
        data.requiresAssessment = params.requiresAssessment;
        data.dueDate = params.dueDate;
        data.metadataCID = params.metadataCID;
        data.needUID = params.needUID;
        data.counterCommitmentId = params.counterCommitmentId;
        data.declaredUnitValue = params.declaredUnitValue;
        data.declaredValueBasis = params.declaredValueBasis;
        data.payerGarden = payerGarden;

        bytes memory encoded = abi.encode(data);
        bytes32 topic = COMMITMENT_CREATED_TOPIC;
        uint256 poolId = params.poolId;
        uint256 cycleId = params.cycleId;
        assembly ("memory-safe") {
            // `abi.encode(data)` is an encoding of one dynamic tuple: a leading 32-byte
            // offset followed by the tuple body. Event data is that tuple body itself.
            log4(add(encoded, 0x40), sub(mload(encoded), 0x20), topic, commitmentId, poolId, cycleId)
        }
    }
}
