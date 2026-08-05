// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS, Attestation } from "@eas/IEAS.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { ICommitmentPoolingModule } from "../interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentRegistry } from "../interfaces/ICommitmentRegistry.sol";
import { IHatsModule } from "../interfaces/IHatsModule.sol";
import { ActionRegistry } from "../registries/Action.sol";

interface IWorkDecisionSequenceResolver {
    function latestDecisionSequence(bytes32 workUID) external view returns (uint64);
    function decisionSequenceByUID(bytes32 decisionUID) external view returns (uint64);
}

/// @title CommitmentPoolingModule
/// @notice Commitment Pooling control plane for pool, commitment, contributor, and proof lifecycles.
contract CommitmentPoolingModule is OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    // Frozen by the PRD-721 8/16/24/32/40 production-path benchmark on 2026-08-05.
    uint256 private constant MAX_CONFIRMERS_VALUE = 40;
    uint256 private constant MAX_REQUIREMENTS_VALUE = 40;
    uint256 private constant MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT_VALUE = 40;
    uint256 private constant MAX_CONTRIBUTORS_PER_COMMITMENT_VALUE = 40;
    uint256 private constant MAX_LINKED_WORKS_PER_COMMITMENT_VALUE = 40;

    // ═════════════════════════════════ Storage ═════════════════════════════════

    IHatsModule public hatsModule;
    address public gardenToken;
    ICommitmentRegistry public commitmentRegistry;
    ActionRegistry public actionRegistry;
    address public workApprovalResolver;
    IEAS public eas;
    bytes32 public workSchemaUID;
    bytes32 public workApprovalSchemaUID;
    bytes32 public legacyAssessmentSchemaUID;
    bytes32 public assessmentV3SchemaUID;
    bool public paused;
    uint256 public nextPoolId;
    uint256 public nextCycleId;
    uint256 public nextCommitmentId;
    uint256 public nextCommitmentSeriesId;
    mapping(address garden => uint256 poolId) internal gardenPool;
    mapping(uint256 poolId => ICommitmentPoolingModule.Pool pool) internal pools;
    mapping(uint256 cycleId => ICommitmentPoolingModule.Cycle cycle) internal cycles;
    mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) internal commitments;
    mapping(uint256 seriesId => ICommitmentPoolingModule.CommitmentSeries series) internal commitmentSeries;
    mapping(address holder => mapping(bytes32 creationRequestKey => uint256 seriesId)) internal seriesIdByCreationRequest;
    mapping(uint256 commitmentId => address[] confirmers) internal commitmentConfirmers;
    mapping(uint256 commitmentId => mapping(address confirmer => bool confirmed)) internal hasConfirmed;
    mapping(bytes32 workUID => uint256 commitmentId) internal workCommitment;
    mapping(bytes32 approvalUID => bool counted) internal approvalCounted;
    mapping(uint256 commitmentId => mapping(address claimant => ICommitmentPoolingModule.PendingClaim claim)) internal
        pendingClaim;
    mapping(
        uint256 commitmentId => mapping(address contributor => ICommitmentPoolingModule.ContributorRecord contributorRecord)
    ) internal contributors;
    mapping(uint256 commitmentId => mapping(uint16 requirementIndex => mapping(address contributor => bool assigned)))
        internal requirementAssignments;
    mapping(uint256 commitmentId => mapping(bytes32 cidHash => bool attached)) internal evidenceAttached;
    mapping(bytes32 workUID => uint16 requirementIndexPlusOne) internal workRequirementIndexPlusOne;
    mapping(bytes32 workUID => bool active) internal workCreditActive;
    mapping(bytes32 workUID => uint64 sequence) internal latestWorkDecisionSequence;
    mapping(bytes32 workUID => bytes32 approvalUID) internal latestWorkDecisionUID;
    mapping(uint256 commitmentId => bytes32[] activeWorkUIDs) internal commitmentWorkUIDs;
    uint256 public protocolPoolId;
    address public rootGarden;
    mapping(address creator => mapping(bytes32 creationRequestKey => uint256 commitmentId)) internal
        commitmentIdByCreationRequest;
    mapping(address caller => mapping(bytes32 operationKey => bytes32 payloadHash)) internal workLinkPayloadHashByOperation;

    /// @dev Declares 38 named storage entries above and reserves 12 more here (50 total).
    ///      Inherited upgradeable contracts maintain their own layouts independently.
    uint256[12] private __gap;

    modifier whenOperational() {
        if (paused) revert ICommitmentPoolingModule.ModulePaused();
        _;
    }

    modifier onlyWhilePaused() {
        if (!paused) revert ICommitmentPoolingModule.ModuleMustBePaused();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_, address rootGarden_) external initializer {
        if (owner_ == address(0)) revert ICommitmentPoolingModule.ZeroAddress();
        if (rootGarden_ == address(0)) revert ICommitmentPoolingModule.RootGardenRequired();

        __Ownable_init();
        __ReentrancyGuard_init();
        _transferOwnership(owner_);

        paused = true;
        nextPoolId = 1;
        nextCycleId = 1;
        nextCommitmentId = 1;
        nextCommitmentSeriesId = 1;
        rootGarden = rootGarden_;
    }

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
        policy = ICommitmentPoolingModule.RecognitionPolicy({ equalParticipationBps: 2000, verifiedContributionBps: 8000 });
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

    // ═════════════════════════════ Configuration ═════════════════════════════

    function setGardenToken(address gardenToken_) external onlyOwner onlyWhilePaused {
        if (gardenToken_ == address(0)) revert ICommitmentPoolingModule.ZeroAddress();
        address previous = gardenToken;
        gardenToken = gardenToken_;
        emit ICommitmentPoolingModule.ModuleDependencyUpdated(
            ICommitmentPoolingModule.ModuleDependency.GardenToken, previous, gardenToken_
        );
    }

    function setHatsModule(address hatsModule_) external onlyOwner onlyWhilePaused {
        if (hatsModule_ == address(0)) revert ICommitmentPoolingModule.ZeroAddress();
        address previous = address(hatsModule);
        hatsModule = IHatsModule(hatsModule_);
        emit ICommitmentPoolingModule.ModuleDependencyUpdated(
            ICommitmentPoolingModule.ModuleDependency.HatsModule, previous, hatsModule_
        );
    }

    function setActionRegistry(address actionRegistry_) external onlyOwner onlyWhilePaused {
        if (actionRegistry_ == address(0)) revert ICommitmentPoolingModule.ZeroAddress();
        address previous = address(actionRegistry);
        actionRegistry = ActionRegistry(actionRegistry_);
        emit ICommitmentPoolingModule.ModuleDependencyUpdated(
            ICommitmentPoolingModule.ModuleDependency.ActionRegistry, previous, actionRegistry_
        );
    }

    function setCommitmentRegistry(address registry_) external onlyOwner onlyWhilePaused {
        if (registry_ == address(0)) revert ICommitmentPoolingModule.ZeroAddress();
        address previous = address(commitmentRegistry);
        commitmentRegistry = ICommitmentRegistry(registry_);
        emit ICommitmentPoolingModule.ModuleDependencyUpdated(
            ICommitmentPoolingModule.ModuleDependency.CommitmentRegistry, previous, registry_
        );
    }

    function setWorkApprovalResolver(address resolver_) external onlyOwner onlyWhilePaused {
        if (resolver_ == address(0)) revert ICommitmentPoolingModule.ZeroAddress();
        address previous = workApprovalResolver;
        workApprovalResolver = resolver_;
        emit ICommitmentPoolingModule.ModuleDependencyUpdated(
            ICommitmentPoolingModule.ModuleDependency.WorkApprovalResolver, previous, resolver_
        );
    }

    function setEAS(address eas_) external onlyOwner onlyWhilePaused {
        if (eas_ == address(0)) revert ICommitmentPoolingModule.ZeroAddress();
        address previous = address(eas);
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
        if (!paused_) _requireCompleteConfiguration();
        bool previous = paused;
        paused = paused_;
        emit ICommitmentPoolingModule.ModulePauseStatusChanged(previous, paused_);
    }

    // ═════════════════════════════ Pool lifecycle ═════════════════════════════

    function onGardenMinted(address garden) external whenOperational returns (uint256 poolId) {
        if (msg.sender != gardenToken) revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        poolId = gardenPool[garden];
        if (poolId != 0) return poolId;
        return _registerPool(garden, ICommitmentPoolingModule.PoolType.Garden);
    }

    function registerPool(
        address garden,
        ICommitmentPoolingModule.PoolType poolType
    )
        external
        whenOperational
        returns (uint256 poolId)
    {
        if (garden == address(0)) revert ICommitmentPoolingModule.ZeroAddress();
        if (poolType == ICommitmentPoolingModule.PoolType.Protocol) {
            if (garden != rootGarden) {
                revert ICommitmentPoolingModule.ProtocolGardenMismatch(rootGarden, garden);
            }
            if (msg.sender != owner()) revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
            if (protocolPoolId != 0) revert ICommitmentPoolingModule.PoolExists(rootGarden);
        } else if (msg.sender != owner() && !_isGardenSteward(garden, msg.sender)) {
            revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        }
        if (gardenPool[garden] != 0) revert ICommitmentPoolingModule.PoolExists(garden);
        poolId = _registerPool(garden, poolType);
        if (poolType == ICommitmentPoolingModule.PoolType.Protocol) protocolPoolId = poolId;
    }

    function setPoolCharter(uint256 poolId, string calldata charterCID) external whenOperational {
        ICommitmentPoolingModule.Pool storage pool = _requirePool(poolId);
        _requirePoolSteward(poolId, pool);
        pool.charterCID = charterCID;
        emit ICommitmentPoolingModule.PoolCharterUpdated(poolId, charterCID);
    }

    function markPoolReady(uint256 poolId) external whenOperational {
        ICommitmentPoolingModule.Pool storage pool = _requirePool(poolId);
        _requirePoolSteward(poolId, pool);
        _requirePoolState(poolId, pool, ICommitmentPoolingModule.PoolState.NotReady);
        if (bytes(pool.charterCID).length == 0) revert ICommitmentPoolingModule.CharterRequired(poolId);
        if (commitmentRegistry.providerOpenCommitmentCapOf(poolId) == 0) {
            revert ICommitmentPoolingModule.OpenCommitmentCapRequired(poolId);
        }
        pool.state = ICommitmentPoolingModule.PoolState.Ready;
        emit ICommitmentPoolingModule.PoolReady(poolId);
    }

    function openPool(uint256 poolId) external whenOperational {
        ICommitmentPoolingModule.Pool storage pool = _requirePool(poolId);
        _requirePoolSteward(poolId, pool);
        _requirePoolState(poolId, pool, ICommitmentPoolingModule.PoolState.Ready);
        pool.state = ICommitmentPoolingModule.PoolState.Open;
        emit ICommitmentPoolingModule.PoolOpened(poolId);
    }

    function pausePool(uint256 poolId, string calldata reasonCID) external {
        ICommitmentPoolingModule.Pool storage pool = _requirePool(poolId);
        _requirePoolSteward(poolId, pool);
        _requirePoolState(poolId, pool, ICommitmentPoolingModule.PoolState.Open);
        if (bytes(reasonCID).length == 0) revert ICommitmentPoolingModule.ReasonRequired();
        pool.state = ICommitmentPoolingModule.PoolState.Paused;
        emit ICommitmentPoolingModule.PoolPaused(poolId, reasonCID);
    }

    function resumePool(uint256 poolId) external whenOperational {
        ICommitmentPoolingModule.Pool storage pool = _requirePool(poolId);
        _requirePoolSteward(poolId, pool);
        _requirePoolState(poolId, pool, ICommitmentPoolingModule.PoolState.Paused);
        pool.state = ICommitmentPoolingModule.PoolState.Open;
        emit ICommitmentPoolingModule.PoolResumed(poolId);
    }

    function closePool(uint256 poolId) external {
        ICommitmentPoolingModule.Pool storage pool = _requirePool(poolId);
        _requirePoolSteward(poolId, pool);
        if (
            pool.state != ICommitmentPoolingModule.PoolState.Open && pool.state != ICommitmentPoolingModule.PoolState.Paused
        ) revert ICommitmentPoolingModule.PoolNotInState(poolId, pool.state);
        if (pool.liveCommitmentCount != 0) {
            revert ICommitmentPoolingModule.PoolHasLiveCommitments(poolId, pool.liveCommitmentCount);
        }
        if (pool.nonTerminalCycleCount != 0) {
            revert ICommitmentPoolingModule.PoolHasNonTerminalCycles(poolId, pool.nonTerminalCycleCount);
        }
        pool.state = ICommitmentPoolingModule.PoolState.Closed;
        emit ICommitmentPoolingModule.PoolClosed(poolId);
    }

    function compostPool(uint256 poolId) external {
        ICommitmentPoolingModule.Pool storage pool = _requirePool(poolId);
        _requirePoolSteward(poolId, pool);
        _requirePoolState(poolId, pool, ICommitmentPoolingModule.PoolState.Closed);
        pool.state = ICommitmentPoolingModule.PoolState.Composted;
        emit ICommitmentPoolingModule.PoolComposted(poolId);
    }

    function reopenPool(uint256 poolId, bool toOpen) external whenOperational {
        ICommitmentPoolingModule.Pool storage pool = _requirePool(poolId);
        _requirePoolSteward(poolId, pool);
        _requirePoolState(poolId, pool, ICommitmentPoolingModule.PoolState.Composted);
        pool.state = toOpen ? ICommitmentPoolingModule.PoolState.Open : ICommitmentPoolingModule.PoolState.Ready;
        emit ICommitmentPoolingModule.PoolReopened(poolId, toOpen);
    }

    function setProviderOpenCommitmentCap(uint256 poolId, uint256 cap) external whenOperational {
        ICommitmentPoolingModule.Pool storage pool = _requirePool(poolId);
        _requirePoolSteward(poolId, pool);
        if (cap == 0) revert ICommitmentPoolingModule.OpenCommitmentCapRequired(poolId);
        commitmentRegistry.setProviderOpenCommitmentCap(poolId, cap);
    }

    // ═════════════════════════════ Pool views ═════════════════════════════

    function getPool(uint256 poolId) external view returns (ICommitmentPoolingModule.Pool memory) {
        return _requirePool(poolId);
    }

    function getPoolByGarden(address garden)
        external
        view
        returns (uint256 poolId, ICommitmentPoolingModule.Pool memory pool)
    {
        poolId = gardenPool[garden];
        if (poolId != 0) pool = pools[poolId];
    }

    // ═════════════════════════════ Commitments ═════════════════════════════

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

    function claimCommitment(
        uint256 commitmentId,
        ICommitmentPoolingModule.ClaimType kind,
        address gardenContext
    )
        external
        whenOperational
        nonReentrant
    {
        ICommitmentPoolingModule.Commitment storage commitment = _requireCommitment(commitmentId);
        _requirePreAcceptanceState(commitmentId, commitment);
        if (kind != commitment.claimType) {
            revert ICommitmentPoolingModule.ClaimTypeMismatch(commitmentId, commitment.claimType, kind);
        }

        (address claimant, address requestedBy) = _resolveClaimant(commitment, kind, gardenContext);
        if (claimant == commitment.creator || requestedBy == commitment.creator) {
            revert ICommitmentPoolingModule.SelfCounterparty();
        }

        if (commitment.claimMode == ICommitmentPoolingModule.ClaimMode.Open) {
            _acceptCommitment(commitmentId, commitment, claimant, requestedBy, kind, gardenContext);
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

    function acceptClaim(uint256 commitmentId, address claimant) external whenOperational nonReentrant {
        ICommitmentPoolingModule.Commitment storage commitment = _requireCommitment(commitmentId);
        _requirePreAcceptanceState(commitmentId, commitment);
        if (commitment.claimMode != ICommitmentPoolingModule.ClaimMode.ApprovalGated) {
            revert ICommitmentPoolingModule.ClaimModeMismatch(commitmentId);
        }
        ICommitmentPoolingModule.Pool storage pool = pools[commitment.poolId];
        _requirePoolSteward(commitment.poolId, pool);
        ICommitmentPoolingModule.PendingClaim storage claim = pendingClaim[commitmentId][claimant];
        if (!claim.active) revert ICommitmentPoolingModule.ClaimNotPending(commitmentId, claimant);
        if (claim.claimant == commitment.creator || claim.requestedBy == commitment.creator) {
            revert ICommitmentPoolingModule.SelfCounterparty();
        }
        ICommitmentPoolingModule.PendingClaim memory acceptedClaim = claim;
        delete pendingClaim[commitmentId][claimant];
        _acceptCommitment(
            commitmentId,
            commitment,
            acceptedClaim.claimant,
            acceptedClaim.requestedBy,
            acceptedClaim.kind,
            acceptedClaim.gardenContext
        );
    }

    function declineClaim(uint256 commitmentId, address claimant, string calldata reasonCID) external whenOperational {
        ICommitmentPoolingModule.Commitment storage commitment = _requireCommitment(commitmentId);
        ICommitmentPoolingModule.Pool storage pool = pools[commitment.poolId];
        _requirePoolSteward(commitment.poolId, pool);
        if (bytes(reasonCID).length == 0) revert ICommitmentPoolingModule.ReasonRequired();
        if (!pendingClaim[commitmentId][claimant].active) {
            revert ICommitmentPoolingModule.ClaimNotPending(commitmentId, claimant);
        }
        delete pendingClaim[commitmentId][claimant];
        emit ICommitmentPoolingModule.ClaimDeclined(commitmentId, claimant, reasonCID);
    }

    function addContributor(uint256 commitmentId, address contributor) external whenOperational {
        ICommitmentPoolingModule.Commitment storage commitment = _requireEditableRoster(commitmentId);
        if (commitment.contributorPolicy != ICommitmentPoolingModule.ContributorPolicy.LeadManaged) {
            revert ICommitmentPoolingModule.ContributorPolicyMismatch(commitmentId);
        }
        if (msg.sender != commitment.leadProvider && !_isPoolSteward(commitment.poolId, msg.sender)) {
            revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        }
        _addContributor(commitmentId, commitment, contributor, msg.sender);
    }

    // solhint-disable-next-line code-complexity
    function attachEvidence(
        uint256 commitmentId,
        string calldata cid,
        address[] calldata creditedContributors
    )
        external
        whenOperational
    {
        ICommitmentPoolingModule.Commitment storage commitment = _requireAcceptedUnfrozen(commitmentId);
        if (!_canEditProof(commitmentId, commitment, msg.sender)) {
            revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        }
        if (bytes(cid).length == 0) revert ICommitmentPoolingModule.EvidenceCIDRequired();
        uint256 length = creditedContributors.length;
        if (length == 0) revert ICommitmentPoolingModule.EvidenceContributorsRequired();
        if (length > MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT_VALUE) {
            revert ICommitmentPoolingModule.TooManyEvidenceContributors(
                length, MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT_VALUE
            );
        }
        bytes32 cidHash = keccak256(bytes(cid));
        if (evidenceAttached[commitmentId][cidHash]) {
            revert ICommitmentPoolingModule.EvidenceAlreadyAttached(commitmentId, cidHash);
        }
        for (uint256 i = 0; i < length; i++) {
            address contributor = creditedContributors[i];
            if (!contributors[commitmentId][contributor].active) {
                revert ICommitmentPoolingModule.ContributorNotActive(contributor);
            }
            for (uint256 j = 0; j < i; j++) {
                if (creditedContributors[j] == contributor) {
                    revert ICommitmentPoolingModule.ContributorAlreadyActive(contributor);
                }
            }
        }

        evidenceAttached[commitmentId][cidHash] = true;
        commitment.evidenceCount++;
        for (uint256 i = 0; i < length; i++) {
            ICommitmentPoolingModule.ContributorRecord storage record = contributors[commitmentId][creditedContributors[i]];
            if (record.evidenceCredits == 0) {
                bool hadCredit = record.approvedWorkCredits != 0;
                record.evidenceCredits = 1;
                commitment.totalVerifiedCredits++;
                if (!hadCredit) commitment.eligibleContributorCount++;
            }
        }
        emit ICommitmentPoolingModule.EvidenceAttached(commitmentId, cid, msg.sender, creditedContributors);
    }

    function attachAssessment(uint256 commitmentId, bytes32 assessmentUID) external whenOperational {
        ICommitmentPoolingModule.Commitment storage commitment = _requireAcceptedUnfrozen(commitmentId);
        if (commitment.assessmentUID != bytes32(0)) {
            revert ICommitmentPoolingModule.AssessmentAlreadyAttached(commitmentId, commitment.assessmentUID);
        }
        ICommitmentPoolingModule.Pool storage pool = pools[commitment.poolId];
        if (!_isPoolSteward(commitment.poolId, msg.sender) && !hatsModule.isEvaluatorOf(pool.garden, msg.sender)) {
            revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        }
        Attestation memory attestation = eas.getAttestation(assessmentUID);
        if (
            attestation.uid != assessmentUID
                || (attestation.schema != legacyAssessmentSchemaUID && attestation.schema != assessmentV3SchemaUID)
                || attestation.recipient != commitment.providerGarden || attestation.revocationTime != 0
        ) revert ICommitmentPoolingModule.InvalidAssessmentAttestation(assessmentUID);
        commitment.assessmentUID = assessmentUID;
        emit ICommitmentPoolingModule.AssessmentAttached(commitmentId, assessmentUID, msg.sender);
        if (_requirementsComplete(commitment) && (!commitment.requiresAssessment || assessmentUID != bytes32(0))) {
            _freezeAndReady(commitmentId, commitment, false, "");
        }
    }

    // solhint-disable-next-line code-complexity
    function linkWork(
        uint256 commitmentId,
        bytes32 workUID,
        uint16 requirementIndex,
        bytes32 operationKey
    )
        external
        whenOperational
    {
        if (operationKey == bytes32(0)) revert ICommitmentPoolingModule.InvalidWorkLinkOperationKey();
        bytes32 payloadHash = keccak256(abi.encode(commitmentId, workUID, requirementIndex));
        bytes32 priorPayloadHash = workLinkPayloadHashByOperation[msg.sender][operationKey];
        if (priorPayloadHash != bytes32(0)) {
            if (priorPayloadHash != payloadHash) revert ICommitmentPoolingModule.WorkLinkOperationConflict(operationKey);
            return;
        }
        ICommitmentPoolingModule.Commitment storage commitment = _requireAcceptedUnfrozen(commitmentId);
        if (!_canEditProof(commitmentId, commitment, msg.sender)) {
            revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        }
        if (workCommitment[workUID] != 0) revert ICommitmentPoolingModule.WorkAlreadyLinked(workUID);
        uint256 nextLength = commitmentWorkUIDs[commitmentId].length + 1;
        if (nextLength > MAX_LINKED_WORKS_PER_COMMITMENT_VALUE) {
            revert ICommitmentPoolingModule.TooManyLinkedWorks(nextLength, MAX_LINKED_WORKS_PER_COMMITMENT_VALUE);
        }

        Attestation memory attestation = eas.getAttestation(workUID);
        if (
            attestation.uid != workUID || attestation.schema != workSchemaUID || attestation.revocationTime != 0
                || attestation.recipient != commitment.providerGarden
        ) revert ICommitmentPoolingModule.InvalidWorkAttestation(workUID);
        if (!contributors[commitmentId][attestation.attester].active) {
            revert ICommitmentPoolingModule.ContributorNotActive(attestation.attester);
        }
        if (!_isGardenMember(commitment.providerGarden, attestation.attester)) {
            revert ICommitmentPoolingModule.NotEligibleContributor(attestation.attester);
        }

        (uint256 actionUID,,,,) = abi.decode(attestation.data, (uint256, string, string, string, string[]));
        if (commitment.commitmentType == ICommitmentPoolingModule.CommitmentType.DomainImpact) {
            if (requirementIndex >= commitment.requirements.length) {
                revert ICommitmentPoolingModule.WorkActionMismatch(actionUID);
            }
            if (commitment.requirements[requirementIndex].actionUID != actionUID) {
                revert ICommitmentPoolingModule.WorkActionMismatch(actionUID);
            }
            workRequirementIndexPlusOne[workUID] = requirementIndex + 1;
        }

        workLinkPayloadHashByOperation[msg.sender][operationKey] = payloadHash;
        workCommitment[workUID] = commitmentId;
        commitmentWorkUIDs[commitmentId].push(workUID);
        contributors[commitmentId][attestation.attester].uncountedLinkedWorkCount++;
        emit ICommitmentPoolingModule.WorkLinked(
            commitmentId, workUID, attestation.attester, requirementIndex, msg.sender, operationKey
        );
    }

    // solhint-disable-next-line code-complexity
    function onWorkDecision(
        bytes32 workUID,
        bytes32 approvalUID,
        uint64 decisionSequence,
        address garden,
        bool approved
    )
        external
    {
        if (msg.sender != workApprovalResolver) revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        uint256 commitmentId = workCommitment[workUID];
        if (commitmentId == 0) return;
        ICommitmentPoolingModule.Commitment storage commitment = commitments[commitmentId];
        if (commitment.state != ICommitmentPoolingModule.CommitmentState.Accepted || commitment.contributorsFrozen) {
            return;
        }
        if (garden != commitment.providerGarden || decisionSequence <= latestWorkDecisionSequence[workUID]) return;
        if (IWorkDecisionSequenceResolver(workApprovalResolver).latestDecisionSequence(workUID) != decisionSequence) return;

        Attestation memory decision = eas.getAttestation(approvalUID);
        if (
            decision.uid != approvalUID || decision.schema != workApprovalSchemaUID || decision.revocationTime != 0
                || decision.recipient != garden
        ) return;
        (uint256 actionUID, bytes32 decodedWorkUID, bool decodedApproved,,,,) =
            abi.decode(decision.data, (uint256, bytes32, bool, string, uint8, uint8, string));
        if (decodedWorkUID != workUID || decodedApproved != approved) return;

        Attestation memory work = eas.getAttestation(workUID);
        if (work.uid != workUID || work.schema != workSchemaUID || work.recipient != garden) return;
        (uint256 workActionUID,,,,) = abi.decode(work.data, (uint256, string, string, string, string[]));
        if (workActionUID != actionUID) return;

        latestWorkDecisionSequence[workUID] = decisionSequence;
        latestWorkDecisionUID[workUID] = approvalUID;
        approvalCounted[approvalUID] = true;

        uint16 indexPlusOne = workRequirementIndexPlusOne[workUID];
        if (indexPlusOne == 0) return;
        uint16 requirementIndex = indexPlusOne - 1;
        ICommitmentPoolingModule.ContributorRecord storage record = contributors[commitmentId][work.attester];
        ICommitmentPoolingModule.CommitmentRequirement storage requirement = commitment.requirements[requirementIndex];
        uint256 unitsBefore = _approvedUnits(commitment);

        if (approved && !workCreditActive[workUID]) {
            bool hadCredit = record.approvedWorkCredits != 0 || record.evidenceCredits != 0;
            workCreditActive[workUID] = true;
            requirement.approvedCount++;
            record.approvedWorkCredits++;
            if (record.uncountedLinkedWorkCount != 0) record.uncountedLinkedWorkCount--;
            commitment.totalVerifiedCredits++;
            if (!hadCredit) commitment.eligibleContributorCount++;
            uint256 unitsAfter = _approvedUnits(commitment);
            emit ICommitmentPoolingModule.ApprovedWorkCounted(
                commitmentId,
                workUID,
                work.attester,
                approvalUID,
                decisionSequence,
                requirementIndex,
                requirement.approvedCount,
                unitsAfter,
                unitsAfter - unitsBefore
            );
        } else if (!approved && workCreditActive[workUID]) {
            workCreditActive[workUID] = false;
            requirement.approvedCount--;
            record.approvedWorkCredits--;
            record.uncountedLinkedWorkCount++;
            commitment.totalVerifiedCredits--;
            if (record.approvedWorkCredits == 0 && record.evidenceCredits == 0) {
                commitment.eligibleContributorCount--;
            }
            uint256 unitsAfter = _approvedUnits(commitment);
            emit ICommitmentPoolingModule.ApprovedWorkReversed(
                commitmentId,
                workUID,
                work.attester,
                approvalUID,
                decisionSequence,
                requirementIndex,
                requirement.approvedCount,
                unitsAfter,
                unitsBefore - unitsAfter
            );
        }

        if (_requirementsComplete(commitment) && (!commitment.requiresAssessment || commitment.assessmentUID != bytes32(0)))
        {
            _freezeAndReady(commitmentId, commitment, false, "");
        }
    }

    function submitForConfirmation(uint256 commitmentId) external whenOperational {
        ICommitmentPoolingModule.Commitment storage commitment = _requireAcceptedUnfrozen(commitmentId);
        if (
            msg.sender != commitment.counterparty && msg.sender != commitment.creator
                && msg.sender != commitment.leadProvider && !_isPoolSteward(commitment.poolId, msg.sender)
        ) revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
        if (commitment.commitmentType == ICommitmentPoolingModule.CommitmentType.DomainImpact) {
            revert ICommitmentPoolingModule.WorkApprovalRequired(commitmentId);
        }
        if (commitment.evidenceCount == 0 || commitment.totalVerifiedCredits == 0) {
            revert ICommitmentPoolingModule.EvidenceRequired(commitmentId);
        }
        if (commitment.requiresAssessment && commitment.assessmentUID == bytes32(0)) {
            revert ICommitmentPoolingModule.AssessmentRequired(commitmentId);
        }
        _freezeAndReady(commitmentId, commitment, false, "");
    }

    function markReadyForConfirmation(uint256 commitmentId, string calldata reason) external whenOperational {
        ICommitmentPoolingModule.Commitment storage commitment = _requireAcceptedUnfrozen(commitmentId);
        if (!_isPoolSteward(commitment.poolId, msg.sender)) {
            revert ICommitmentPoolingModule.NotPoolSteward(msg.sender, commitment.poolId);
        }
        if (bytes(reason).length == 0) revert ICommitmentPoolingModule.ReasonRequired();
        _freezeAndReady(commitmentId, commitment, true, reason);
    }

    function confirmFulfillment(uint256 commitmentId) external whenOperational nonReentrant {
        ICommitmentPoolingModule.Commitment storage commitment = _requireCommitment(commitmentId);
        if (commitment.state != ICommitmentPoolingModule.CommitmentState.ReadyForConfirmation) {
            revert ICommitmentPoolingModule.CommitmentNotInState(commitmentId, commitment.state);
        }
        if (contributors[commitmentId][msg.sender].active) revert ICommitmentPoolingModule.SelfConfirmation();
        if (!_isOrdinaryConfirmer(commitmentId, commitment, msg.sender)) {
            revert ICommitmentPoolingModule.NotConfirmer(msg.sender);
        }
        if (hasConfirmed[commitmentId][msg.sender]) revert ICommitmentPoolingModule.AlreadyConfirmed(msg.sender);
        hasConfirmed[commitmentId][msg.sender] = true;
        commitment.confirmationCount++;
        emit ICommitmentPoolingModule.ConfirmationRecorded(
            commitmentId, msg.sender, commitment.confirmationCount, commitment.confirmationThreshold
        );
        if (commitment.confirmationCount >= commitment.confirmationThreshold) {
            _fulfillCommitment(commitmentId, commitment, msg.sender, ICommitmentPoolingModule.ConfirmationPath.Ordinary, "");
        }
    }

    // ═════════════════════════════ Commitment views ═════════════════════════════

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

    // ═════════════════════════════ Internal validation ═════════════════════════════

    function _requireCompleteConfiguration() private view {
        if (
            gardenToken == address(0) || address(hatsModule) == address(0) || address(actionRegistry) == address(0)
                || address(commitmentRegistry) == address(0) || workApprovalResolver == address(0) || address(eas) == address(0)
                || workSchemaUID == bytes32(0) || workApprovalSchemaUID == bytes32(0) || legacyAssessmentSchemaUID == bytes32(0)
                || assessmentV3SchemaUID == bytes32(0)
        ) revert ICommitmentPoolingModule.ModuleNotReady();
    }

    function _requireSchemaUID(ICommitmentPoolingModule.ModuleSchemaKind kind, bytes32 uid) private pure {
        if (uid == bytes32(0)) revert ICommitmentPoolingModule.SchemaUIDRequired(kind);
    }

    function _setSchemaUID(ICommitmentPoolingModule.ModuleSchemaKind kind, bytes32 previous, bytes32 next) private {
        emit ICommitmentPoolingModule.ModuleSchemaUIDUpdated(kind, previous, next);
    }

    function _registerPool(address garden, ICommitmentPoolingModule.PoolType poolType) private returns (uint256 poolId) {
        if (garden == address(0)) revert ICommitmentPoolingModule.ZeroAddress();
        poolId = nextPoolId++;
        gardenPool[garden] = poolId;
        pools[poolId] = ICommitmentPoolingModule.Pool({
            garden: garden,
            poolType: poolType,
            state: ICommitmentPoolingModule.PoolState.NotReady,
            proofEnabled: true,
            settlementEnabled: false,
            charterCID: "",
            openSeasonCycleId: 0,
            settlementAdapter: address(0),
            liveCommitmentCount: 0,
            nonTerminalCycleCount: 0
        });
        emit ICommitmentPoolingModule.PoolRegistered(poolId, garden, poolType);
    }

    function _requirePool(uint256 poolId) private view returns (ICommitmentPoolingModule.Pool storage pool) {
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
        private
        view
    {
        if (pool.state != expected) revert ICommitmentPoolingModule.PoolNotInState(poolId, pool.state);
    }

    function _requirePoolSteward(uint256 poolId, ICommitmentPoolingModule.Pool storage pool) private view {
        if (msg.sender != owner() && !_isGardenSteward(pool.garden, msg.sender)) {
            revert ICommitmentPoolingModule.NotPoolSteward(msg.sender, poolId);
        }
    }

    function _isPoolSteward(uint256 poolId, address account) private view returns (bool) {
        ICommitmentPoolingModule.Pool storage pool = pools[poolId];
        return pool.state != ICommitmentPoolingModule.PoolState.None
            && (account == owner() || _isGardenSteward(pool.garden, account));
    }

    function _isGardenSteward(address garden, address account) private view returns (bool) {
        return hatsModule.isStewardOf(garden, account) || hatsModule.isOwnerOf(garden, account);
    }

    function _isGardenMember(address garden, address account) private view returns (bool) {
        return hatsModule.isGardenerOf(garden, account) || hatsModule.isEvaluatorOf(garden, account)
            || hatsModule.isStewardOf(garden, account) || hatsModule.isOwnerOf(garden, account)
            || hatsModule.isFunderOf(garden, account) || hatsModule.isCommunityOf(garden, account);
    }

    // solhint-disable-next-line code-complexity
    function _resolveCreator(
        ICommitmentPoolingModule.CreateCommitmentParams calldata params,
        ICommitmentPoolingModule.Pool storage pool
    )
        private
        view
        returns (address creator)
    {
        bool steward = msg.sender == owner() || _isGardenSteward(pool.garden, msg.sender);
        if (pool.poolType == ICommitmentPoolingModule.PoolType.Protocol && !steward) {
            revert ICommitmentPoolingModule.NotPoolSteward(msg.sender, params.poolId);
        }
        if (params.commitmentType == ICommitmentPoolingModule.CommitmentType.StewardCaptured) {
            if (!steward) revert ICommitmentPoolingModule.NotPoolSteward(msg.sender, params.poolId);
            if (params.onBehalfOf == address(0)) revert ICommitmentPoolingModule.ZeroAddress();
            creator = params.onBehalfOf;
            if (!_isGardenMember(pool.garden, creator)) {
                revert ICommitmentPoolingModule.NotEligibleContributor(creator);
            }
        } else {
            if (params.onBehalfOf != address(0)) revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
            creator = msg.sender;
            if (params.commitmentType == ICommitmentPoolingModule.CommitmentType.SeasonCampaign) {
                if (!steward) revert ICommitmentPoolingModule.NotPoolSteward(msg.sender, params.poolId);
            } else if (!_isGardenMember(pool.garden, creator)) {
                revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
            }
        }
    }

    function _validateCycleForCreation(
        uint256 poolId,
        uint256 cycleId,
        ICommitmentPoolingModule.CommitmentType
    )
        private
        view
    {
        if (cycleId == 0) return;
        ICommitmentPoolingModule.Cycle storage cycle = cycles[cycleId];
        if (cycle.state == ICommitmentPoolingModule.CycleState.None) {
            revert ICommitmentPoolingModule.UnknownCycle(cycleId);
        }
        if (cycle.poolId != poolId) {
            revert ICommitmentPoolingModule.CyclePoolMismatch(cycleId, poolId, cycle.poolId);
        }
        if (cycle.state != ICommitmentPoolingModule.CycleState.Open) {
            revert ICommitmentPoolingModule.CycleNotAcceptingCommitments(cycleId, cycle.state);
        }
    }

    function _validateSeriesForCreation(
        ICommitmentPoolingModule.CreateCommitmentParams calldata params,
        address creator
    )
        private
        view
    {
        if (params.commitmentSeriesId == 0) return;
        ICommitmentPoolingModule.CommitmentSeries storage series = commitmentSeries[params.commitmentSeriesId];
        if (series.state == ICommitmentPoolingModule.CommitmentSeriesState.None) {
            revert ICommitmentPoolingModule.UnknownCommitmentSeries(params.commitmentSeriesId);
        }
        if (series.poolId != params.poolId) {
            revert ICommitmentPoolingModule.CommitmentSeriesPoolMismatch(
                params.commitmentSeriesId, params.poolId, series.poolId
            );
        }
        if (series.state != ICommitmentPoolingModule.CommitmentSeriesState.Active) {
            revert ICommitmentPoolingModule.CommitmentSeriesNotActive(params.commitmentSeriesId);
        }
        if (series.currentHolder != creator) {
            revert ICommitmentPoolingModule.CommitmentSeriesHolderOnly(params.commitmentSeriesId, creator);
        }
        if (params.direction != ICommitmentPoolingModule.CommitmentDirection.Offer) {
            revert ICommitmentPoolingModule.CommitmentSeriesOfferOnly(params.commitmentSeriesId);
        }
        if (params.claimType != ICommitmentPoolingModule.ClaimType.Individual || params.onBehalfOf != address(0)) {
            revert ICommitmentPoolingModule.CommitmentSeriesIndividualOnly(params.commitmentSeriesId);
        }
    }

    // solhint-disable-next-line code-complexity
    function _validateCounterCommitment(
        ICommitmentPoolingModule.CreateCommitmentParams calldata params,
        address creator
    )
        private
        view
    {
        uint256 counterId = params.counterCommitmentId;
        if (counterId == 0) return;
        if (counterId == nextCommitmentId) revert ICommitmentPoolingModule.SelfCounterCommitment();
        ICommitmentPoolingModule.Commitment storage counter = commitments[counterId];
        if (counter.state == ICommitmentPoolingModule.CommitmentState.None) {
            revert ICommitmentPoolingModule.UnknownCounterCommitment(counterId);
        }
        if (counter.poolId != params.poolId) {
            revert ICommitmentPoolingModule.CounterCommitmentPoolMismatch(params.poolId, counterId);
        }
        if (params.direction == ICommitmentPoolingModule.CommitmentDirection.Offer) {
            if (
                params.claimType != ICommitmentPoolingModule.ClaimType.Individual
                    || params.commitmentType == ICommitmentPoolingModule.CommitmentType.StewardCaptured
                    || params.onBehalfOf != address(0)
            ) revert ICommitmentPoolingModule.ExchangeCreatorConsentRequired(counterId);
            if (
                counter.direction != ICommitmentPoolingModule.CommitmentDirection.Offer
                    || counter.state != ICommitmentPoolingModule.CommitmentState.Offered
            ) revert ICommitmentPoolingModule.ExchangeStateInvalid(counterId, counter.state);
            if (counter.claimType != ICommitmentPoolingModule.ClaimType.Individual) {
                revert ICommitmentPoolingModule.ExchangeClaimTypeUnsupported(counterId, counter.claimType);
            }
            if (counter.creator == creator) revert ICommitmentPoolingModule.SelfExchange(creator);
            if (commitmentRegistry.committedOf(counter.creator, counterId) != counter.targetUnits) {
                revert ICommitmentPoolingModule.ExchangeStateInvalid(counterId, counter.state);
            }
        }
    }

    // solhint-disable-next-line code-complexity
    function _validateAndBuildRequirements(ICommitmentPoolingModule.CreateCommitmentParams calldata params)
        private
        view
        returns (
            uint8[] memory domains,
            uint256[] memory actionUIDs,
            uint8[] memory requirementDomains,
            uint32[] memory requiredCounts
        )
    {
        uint256 length = params.requirements.length;
        if (params.commitmentType != ICommitmentPoolingModule.CommitmentType.DomainImpact) {
            if (length != 0) revert ICommitmentPoolingModule.InvalidDomains();
            domains = _validateSubmittedDomains(params.domainTags);
            actionUIDs = new uint256[](0);
            requirementDomains = new uint8[](0);
            requiredCounts = new uint32[](0);
            return (domains, actionUIDs, requirementDomains, requiredCounts);
        }
        if (length == 0) revert ICommitmentPoolingModule.InvalidRequirementCount(0);
        if (length > MAX_REQUIREMENTS_VALUE) {
            revert ICommitmentPoolingModule.TooManyRequirements(length, MAX_REQUIREMENTS_VALUE);
        }

        actionUIDs = new uint256[](length);
        requirementDomains = new uint8[](length);
        requiredCounts = new uint32[](length);
        bool[4] memory seenDomain;
        uint256 uniqueDomainCount;
        uint256 totalRequired;
        for (uint256 i = 0; i < length; i++) {
            ICommitmentPoolingModule.CommitmentRequirementInput calldata requirement = params.requirements[i];
            if (requirement.requiredCount == 0) {
                revert ICommitmentPoolingModule.InvalidRequirementCount(i);
            }
            if (actionRegistry.actionToOwner(requirement.actionUID) == address(0)) {
                revert ICommitmentPoolingModule.UnknownAction(requirement.actionUID);
            }
            uint8 domain = uint8(actionRegistry.getAction(requirement.actionUID).domain);
            if (!seenDomain[domain]) {
                seenDomain[domain] = true;
                uniqueDomainCount++;
            }
            actionUIDs[i] = requirement.actionUID;
            requirementDomains[i] = domain;
            requiredCounts[i] = requirement.requiredCount;
            totalRequired += requirement.requiredCount;
        }
        if (totalRequired > MAX_LINKED_WORKS_PER_COMMITMENT_VALUE) {
            revert ICommitmentPoolingModule.TooManyLinkedWorks(totalRequired, MAX_LINKED_WORKS_PER_COMMITMENT_VALUE);
        }
        domains = new uint8[](uniqueDomainCount);
        uint256 cursor;
        for (uint8 domain = 0; domain < 4; domain++) {
            if (seenDomain[domain]) domains[cursor++] = domain;
        }
    }

    function _validateSubmittedDomains(uint8[] calldata submitted) private pure returns (uint8[] memory domains) {
        domains = submitted;
        bool[4] memory seen;
        for (uint256 i = 0; i < submitted.length; i++) {
            uint8 domain = submitted[i];
            if (domain > 3 || seen[domain]) revert ICommitmentPoolingModule.InvalidDomains();
            seen[domain] = true;
        }
    }

    function _creationPayloadHash(
        ICommitmentPoolingModule.CreateCommitmentParams calldata params,
        uint32 effectiveConfirmationThreshold
    )
        private
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                params.poolId,
                params.cycleId,
                params.commitmentSeriesId,
                params.direction,
                params.commitmentType,
                params.claimType,
                params.claimMode,
                params.contributorPolicy,
                params.onBehalfOf,
                keccak256(abi.encodePacked(params.domainTags)),
                keccak256(abi.encode(params.requirements)),
                keccak256(bytes(params.unitLabel)),
                params.targetUnits,
                params.requiresAssessment,
                params.dueDate,
                keccak256(bytes(params.metadataCID)),
                params.needUID,
                params.counterCommitmentId,
                keccak256(abi.encodePacked(params.confirmers)),
                effectiveConfirmationThreshold,
                params.protocolFallbackEnabled,
                keccak256(abi.encode(params.reward)),
                params.declaredUnitValue,
                keccak256(bytes(params.declaredValueBasis))
            )
        );
    }

    function _validateReward(ICommitmentPoolingModule.DeclaredReward calldata reward) private pure {
        if (reward.amount == 0) {
            if (
                reward.rail != ICommitmentPoolingModule.RewardRail.None || reward.source != address(0)
                    || reward.token != address(0)
            ) revert ICommitmentPoolingModule.InvalidRewardConfiguration();
        } else if (reward.rail == ICommitmentPoolingModule.RewardRail.ArbitrumExternal) {
            if (reward.source == address(0) || reward.token == address(0)) {
                revert ICommitmentPoolingModule.InvalidRewardConfiguration();
            }
        } else if (reward.rail == ICommitmentPoolingModule.RewardRail.CeloSettlement) {
            if (reward.source != address(0) || reward.token != address(0)) {
                revert ICommitmentPoolingModule.InvalidRewardConfiguration();
            }
        } else {
            revert ICommitmentPoolingModule.InvalidRewardConfiguration();
        }
    }

    function _validateDeclaredValue(uint256 value, string calldata basis) private pure {
        if ((value == 0) != (bytes(basis).length == 0)) {
            revert ICommitmentPoolingModule.InvalidValueDeclaration();
        }
    }

    function _validateConfirmerRule(
        address[] calldata namedConfirmers,
        uint32 threshold,
        bool protocolFallbackEnabled
    )
        private
        view
    {
        uint256 length = namedConfirmers.length;
        if (length > MAX_CONFIRMERS_VALUE) {
            revert ICommitmentPoolingModule.TooManyConfirmers(length, MAX_CONFIRMERS_VALUE);
        }
        if (length != 0 && threshold == 0) revert ICommitmentPoolingModule.InvalidConfirmerRule();
        if (protocolFallbackEnabled && protocolPoolId == 0) revert ICommitmentPoolingModule.ModuleNotReady();
    }

    function _resolveClaimant(
        ICommitmentPoolingModule.Commitment storage commitment,
        ICommitmentPoolingModule.ClaimType kind,
        address gardenContext
    )
        private
        view
        returns (address claimant, address requestedBy)
    {
        ICommitmentPoolingModule.Pool storage pool = pools[commitment.poolId];
        if (pool.poolType == ICommitmentPoolingModule.PoolType.Garden) {
            if (gardenContext != pool.garden || !_isGardenMember(pool.garden, msg.sender)) {
                revert ICommitmentPoolingModule.NotEligibleClaimant(msg.sender);
            }
        } else if (kind == ICommitmentPoolingModule.ClaimType.Garden) {
            if (gardenPool[gardenContext] == 0 || !_isGardenSteward(gardenContext, msg.sender)) {
                revert ICommitmentPoolingModule.NotEligibleClaimant(msg.sender);
            }
        } else if (!_isGardenMember(gardenContext, msg.sender)) {
            revert ICommitmentPoolingModule.NotEligibleClaimant(msg.sender);
        }

        if (kind == ICommitmentPoolingModule.ClaimType.Garden) {
            claimant = gardenContext;
            requestedBy = msg.sender;
        } else {
            claimant = msg.sender;
            requestedBy = msg.sender;
        }
    }

    function _acceptCommitment(
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        address claimant,
        address requestedBy,
        ICommitmentPoolingModule.ClaimType kind,
        address gardenContext
    )
        private
    {
        address leadProvider;
        address providerGarden;
        if (commitment.direction == ICommitmentPoolingModule.CommitmentDirection.Offer) {
            leadProvider = commitment.creator;
            providerGarden = pools[commitment.poolId].garden;
        } else {
            providerGarden = gardenContext;
            leadProvider = kind == ICommitmentPoolingModule.ClaimType.Garden ? requestedBy : claimant;
        }
        if (!_isGardenMember(providerGarden, leadProvider)) {
            revert ICommitmentPoolingModule.NotEligibleContributor(leadProvider);
        }
        if (commitment.contributorCount + 1 > MAX_CONTRIBUTORS_PER_COMMITMENT_VALUE) {
            revert ICommitmentPoolingModule.TooManyContributors(
                commitment.contributorCount + 1, MAX_CONTRIBUTORS_PER_COMMITMENT_VALUE
            );
        }

        _normalizeConfirmers(commitmentId, commitment, leadProvider);
        if (commitment.direction == ICommitmentPoolingModule.CommitmentDirection.Request) {
            commitmentRegistry.commitUnits(commitmentId, leadProvider, commitment.targetUnits);
        }

        commitment.counterparty = claimant;
        commitment.counterpartyKind = kind;
        commitment.leadProvider = leadProvider;
        commitment.providerGarden = providerGarden;
        commitment.state = ICommitmentPoolingModule.CommitmentState.Accepted;
        ICommitmentPoolingModule.ContributorRecord storage lead = contributors[commitmentId][leadProvider];
        lead.active = true;
        commitment.contributorCount = 1;

        emit ICommitmentPoolingModule.ContributorAdded(commitmentId, leadProvider, requestedBy);
        emit ICommitmentPoolingModule.CommitmentAccepted(
            commitmentId, claimant, claimant, kind, gardenContext, leadProvider, providerGarden
        );
    }

    function _normalizeConfirmers(
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        address leadProvider
    )
        private
    {
        address[] storage submitted = commitmentConfirmers[commitmentId];
        if (submitted.length == 0) return;
        address[] memory normalized = new address[](submitted.length);
        uint256 normalizedLength;
        for (uint256 i = 0; i < submitted.length; i++) {
            address confirmer = submitted[i];
            if (confirmer == address(0) || confirmer == leadProvider) continue;
            bool duplicate;
            for (uint256 j = 0; j < normalizedLength; j++) {
                if (normalized[j] == confirmer) {
                    duplicate = true;
                    break;
                }
            }
            if (!duplicate) normalized[normalizedLength++] = confirmer;
        }
        if (normalizedLength < commitment.confirmationThreshold && !commitment.protocolFallbackEnabled) {
            revert ICommitmentPoolingModule.InvalidConfirmerRule();
        }
        delete commitmentConfirmers[commitmentId];
        for (uint256 i = 0; i < normalizedLength; i++) {
            commitmentConfirmers[commitmentId].push(normalized[i]);
        }
    }

    function _addContributor(
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        address contributor,
        address addedBy
    )
        private
    {
        if (contributor == address(0)) revert ICommitmentPoolingModule.ZeroAddress();
        if (contributors[commitmentId][contributor].active) {
            revert ICommitmentPoolingModule.ContributorAlreadyActive(contributor);
        }
        if (!_isGardenMember(commitment.providerGarden, contributor)) {
            revert ICommitmentPoolingModule.NotEligibleContributor(contributor);
        }
        uint256 supplied = commitment.contributorCount + 1;
        if (supplied > MAX_CONTRIBUTORS_PER_COMMITMENT_VALUE) {
            revert ICommitmentPoolingModule.TooManyContributors(supplied, MAX_CONTRIBUTORS_PER_COMMITMENT_VALUE);
        }
        if (
            commitmentConfirmers[commitmentId].length != 0
                && _eligibleNamedConfirmerCount(commitmentId, contributor) < commitment.confirmationThreshold
                && !commitment.protocolFallbackEnabled
        ) revert ICommitmentPoolingModule.ConfirmationThresholdUnreachable(commitmentId);

        contributors[commitmentId][contributor].active = true;
        commitment.contributorCount++;
        emit ICommitmentPoolingModule.ContributorAdded(commitmentId, contributor, addedBy);
    }

    function _eligibleNamedConfirmerCount(
        uint256 commitmentId,
        address prospectiveContributor
    )
        private
        view
        returns (uint256 count)
    {
        address[] storage named = commitmentConfirmers[commitmentId];
        for (uint256 i = 0; i < named.length; i++) {
            address confirmer = named[i];
            if (confirmer != prospectiveContributor && !contributors[commitmentId][confirmer].active) count++;
        }
    }

    function _requireCommitment(uint256 commitmentId)
        private
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
        private
        view
    {
        if (
            commitment.state != ICommitmentPoolingModule.CommitmentState.Offered
                && commitment.state != ICommitmentPoolingModule.CommitmentState.Requested
        ) revert ICommitmentPoolingModule.CommitmentNotInState(commitmentId, commitment.state);
    }

    function _requireAcceptedUnfrozen(uint256 commitmentId)
        private
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
        private
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
        private
        view
        returns (bool)
    {
        return contributors[commitmentId][account].active || account == commitment.leadProvider
            || _isPoolSteward(commitment.poolId, account);
    }

    function _freezeAndReady(
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        bool overridden,
        string memory reason
    )
        private
    {
        _assertWorkDecisionsFresh(commitmentId);
        commitment.contributorsFrozen = true;
        commitment.state = ICommitmentPoolingModule.CommitmentState.ReadyForConfirmation;
        emit ICommitmentPoolingModule.ContributorRosterFrozen(commitmentId, commitment.contributorCount);
        emit ICommitmentPoolingModule.CommitmentReadyForConfirmation(commitmentId, overridden, reason);
    }

    function _assertWorkDecisionsFresh(uint256 commitmentId) private view {
        bytes32[] storage workUIDs = commitmentWorkUIDs[commitmentId];
        for (uint256 i = 0; i < workUIDs.length; i++) {
            bytes32 workUID = workUIDs[i];
            uint64 expected = IWorkDecisionSequenceResolver(workApprovalResolver).latestDecisionSequence(workUID);
            uint64 supplied = latestWorkDecisionSequence[workUID];
            if (expected != supplied) {
                revert ICommitmentPoolingModule.IncompleteDecisionHistory(workUID, expected, supplied);
            }
        }
    }

    function _requirementsComplete(ICommitmentPoolingModule.Commitment storage commitment) private view returns (bool) {
        if (commitment.commitmentType == ICommitmentPoolingModule.CommitmentType.DomainImpact) {
            for (uint256 i = 0; i < commitment.requirements.length; i++) {
                if (commitment.requirements[i].approvedCount < commitment.requirements[i].requiredCount) return false;
            }
            return commitment.requirements.length != 0;
        }
        return commitment.evidenceCount != 0 && commitment.totalVerifiedCredits != 0;
    }

    function _approvedUnits(ICommitmentPoolingModule.Commitment storage commitment) private view returns (uint256) {
        uint256 approved;
        uint256 required;
        for (uint256 i = 0; i < commitment.requirements.length; i++) {
            ICommitmentPoolingModule.CommitmentRequirement storage requirement = commitment.requirements[i];
            required += requirement.requiredCount;
            approved += requirement.approvedCount < requirement.requiredCount
                ? requirement.approvedCount
                : requirement.requiredCount;
        }
        return required == 0 ? 0 : commitment.targetUnits * approved / required;
    }

    function _isOrdinaryConfirmer(
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        address account
    )
        private
        view
        returns (bool)
    {
        address[] storage named = commitmentConfirmers[commitmentId];
        if (named.length != 0) {
            for (uint256 i = 0; i < named.length; i++) {
                if (named[i] == account) return true;
            }
            return false;
        }
        address defaultConfirmer = commitment.direction == ICommitmentPoolingModule.CommitmentDirection.Offer
            ? commitment.counterparty
            : commitment.creator;
        if (commitment.counterpartyKind == ICommitmentPoolingModule.ClaimType.Garden) {
            if (account == defaultConfirmer) return false;
            return _isGardenSteward(commitment.providerGarden, account);
        }
        return account == defaultConfirmer;
    }

    function _fulfillCommitment(
        uint256 commitmentId,
        ICommitmentPoolingModule.Commitment storage commitment,
        address confirmer,
        ICommitmentPoolingModule.ConfirmationPath path,
        string memory reason
    )
        private
    {
        commitment.state = ICommitmentPoolingModule.CommitmentState.Fulfilled;
        pools[commitment.poolId].liveCommitmentCount--;
        if (commitment.cycleId != 0) cycles[commitment.cycleId].liveCommitmentCount--;
        commitmentRegistry.fulfillUnits(commitmentId, commitment.leadProvider, commitment.targetUnits);
        emit ICommitmentPoolingModule.CommitmentFulfilled(commitmentId, confirmer, path, reason);
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

    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address) internal override onlyOwner { }
}
