// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS } from "@eas/IEAS.sol";

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentRegistry } from "../../interfaces/ICommitmentRegistry.sol";
import { IHatsModule } from "../../interfaces/IHatsModule.sol";
import { CommitmentPoolingPoolsLib } from "../../lib/CommitmentPooling/PoolsLib.sol";
import { CommitmentPoolingViewsLib } from "../../lib/CommitmentPooling/ViewsLib.sol";
import { ActionRegistry } from "../../registries/Action.sol";
import { CommitmentPoolingBase } from "./Base.sol";

/// @title CommitmentPoolingAdmin
/// @notice The administrative surface: frozen bounds, dependency wiring, schema UIDs, pause
///         control, and the pool registration/state lifecycle.
/// @dev Config setters are deliberately NOT library-extracted: they are value-typed state writes
///      libraries cannot perform, and measurement showed the boundary codecs cost more bytecode
///      than the tiny validation bodies save (+160 bytes net). Pool behavior lives in the
///      deployed `CommitmentPoolingPoolsLib`; the shells own the pool counter increment and the
///      protocol-pool scalar write. ABI, events, and reverts are unchanged.
abstract contract CommitmentPoolingAdmin is CommitmentPoolingBase {
    // ═════════════════════════════ Config ═════════════════════════════

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

    // ═════════════════════════════ Pools ═════════════════════════════

    function onGardenMinted(address garden) external whenOperational returns (uint256 poolId) {
        poolId = CommitmentPoolingPoolsLib.onGardenMinted(gardenPool, pools, nextPoolId, gardenToken, garden);
        if (poolId == nextPoolId) nextPoolId = poolId + 1;
    }

    function registerPool(address garden, ICommitmentPoolingModule.PoolType poolType) external returns (uint256 poolId) {
        poolId = CommitmentPoolingPoolsLib.registerPool(_env(), gardenPool, pools, nextPoolId, rootGarden, garden, poolType);
        if (poolId == nextPoolId) nextPoolId = poolId + 1;
        if (poolType == ICommitmentPoolingModule.PoolType.Protocol) protocolPoolId = poolId;
    }

    function setPoolCharter(uint256 poolId, string calldata charterCID) external whenOperational {
        CommitmentPoolingPoolsLib.setPoolCharter(_env(), pools, poolId, charterCID);
    }

    function markPoolReady(uint256 poolId) external whenOperational {
        CommitmentPoolingPoolsLib.markPoolReady(_env(), pools, poolId);
    }

    function openPool(uint256 poolId) external whenOperational {
        CommitmentPoolingPoolsLib.openPool(_env(), pools, poolId);
    }

    function pausePool(uint256 poolId, string calldata reasonCID) external {
        CommitmentPoolingPoolsLib.pausePool(_env(), pools, poolId, reasonCID);
    }

    function resumePool(uint256 poolId) external whenOperational {
        CommitmentPoolingPoolsLib.resumePool(_env(), pools, poolId);
    }

    function closePool(uint256 poolId) external {
        CommitmentPoolingPoolsLib.closePool(_env(), pools, poolId);
    }

    function compostPool(uint256 poolId) external {
        CommitmentPoolingPoolsLib.compostPool(_env(), pools, poolId);
    }

    function reopenPool(uint256 poolId, bool toOpen) external whenOperational {
        CommitmentPoolingPoolsLib.reopenPool(_env(), pools, poolId, toOpen);
    }

    function setProviderOpenCommitmentCap(uint256 poolId, uint256 cap) external whenOperational {
        CommitmentPoolingPoolsLib.setProviderOpenCommitmentCap(_env(), pools, poolId, cap);
    }

    function getPool(uint256 poolId) external view returns (ICommitmentPoolingModule.Pool memory) {
        uint256 slot;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            slot := pools.slot
        }
        _forwardView(abi.encodeWithSelector(CommitmentPoolingViewsLib.getPool.selector, slot, poolId));
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            revert(0, 0)
        } // unreachable
    }

    function getPoolByGarden(address garden)
        external
        view
        returns (uint256 poolId, ICommitmentPoolingModule.Pool memory pool)
    {
        uint256 gardenPoolSlot;
        uint256 poolsSlot;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            gardenPoolSlot := gardenPool.slot
            poolsSlot := pools.slot
        }
        _forwardView(
            abi.encodeWithSelector(CommitmentPoolingViewsLib.getPoolByGarden.selector, gardenPoolSlot, poolsSlot, garden)
        );
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            revert(0, 0)
        } // unreachable
    }
}
