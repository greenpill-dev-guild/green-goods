// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS } from "@eas/IEAS.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentRegistry } from "../../interfaces/ICommitmentRegistry.sol";
import { IHatsModule } from "../../interfaces/IHatsModule.sol";
import { ActionRegistry } from "../../registries/Action.sol";

interface IWorkDecisionSequenceResolver {
    function latestDecisionSequence(bytes32 workUID) external view returns (uint64);
    function decisionSequenceByUID(bytes32 decisionUID) external view returns (uint64);
}

/// @title CommitmentPoolingStorage
/// @notice Sole storage declaration for the Commitment Pooling control plane.
/// @dev Every behavior contract in this directory inherits this base and declares NO storage of
///      its own, so the layout stays byte-identical regardless of how the behavior is split.
///      The three upgradeable bases below must keep this exact order — the frozen layout baseline
///      assigns their slots before this contract's own entries.
abstract contract CommitmentPoolingStorage is OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    // Frozen by the PRD-721 8/16/24/32/40 production-path benchmark on 2026-08-05.
    uint256 internal constant MAX_CONFIRMERS_VALUE = 40;
    uint256 internal constant MAX_REQUIREMENTS_VALUE = 40;
    uint256 internal constant MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT_VALUE = 40;
    uint256 internal constant MAX_CONTRIBUTORS_PER_COMMITMENT_VALUE = 40;
    uint256 internal constant MAX_LINKED_WORKS_PER_COMMITMENT_VALUE = 40;

    /// @dev Every allocation and recognition vector is denominated in these basis points, and the
    ///      cycle-less preset is the immutable protocol policy for a commitment with no cycle.
    uint256 internal constant TOTAL_ALLOCATION_BPS = 10_000;
    uint16 internal constant CYCLELESS_EQUAL_PARTICIPATION_BPS = 2000;
    uint16 internal constant CYCLELESS_VERIFIED_CONTRIBUTION_BPS = 8000;

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

    /// @dev `initialize` deliberately lives on the concrete CommitmentPoolingModule rather than
    ///      here, so `CommitmentPoolingModule.initialize.selector` keeps resolving for callers.
    function _initializePooling(address owner_, address rootGarden_) internal {
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
        emit ICommitmentPoolingModule.ModulePauseStatusChanged(false, true);
    }
}
