// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS } from "@eas/IEAS.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { ICommitmentPoolingModule } from "../interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentRegistry } from "../interfaces/ICommitmentRegistry.sol";
import { IHatsModule } from "../interfaces/IHatsModule.sol";
import { ActionRegistry } from "../registries/Action.sol";

/// @title CommitmentPoolingModule
/// @notice Commitment Pooling control plane. This first measured increment freezes the ABI bounds,
///         initializer invariants, and exact 38-entry storage declaration order before bounded
///         lifecycle loops are added.
contract CommitmentPoolingModule is OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    uint256 private constant MAX_CONFIRMERS_VALUE = 32;
    uint256 private constant MAX_REQUIREMENTS_VALUE = 32;
    uint256 private constant MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT_VALUE = 32;
    uint256 private constant MAX_CONTRIBUTORS_PER_COMMITMENT_VALUE = 32;
    uint256 private constant MAX_LINKED_WORKS_PER_COMMITMENT_VALUE = 32;

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

    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address) internal override onlyOwner { }
}
