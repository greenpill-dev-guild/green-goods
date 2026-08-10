// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface ISettlementModule {
    enum DisbursementState {
        None,
        Queued,
        Dispatched,
        Confirmed,
        Failed,
        Cancelled
    }

    enum DisbursementKind {
        ContributorConsideration,
        Funding,
        LoanPrincipal,
        GardenBeneficiary
    }

    enum FundingRoute {
        None,
        ProtocolToGarden
    }

    enum PayoutPlanStatus {
        Draft,
        Pending,
        Partial,
        Complete,
        Failed
    }

    enum FailureCode {
        None,
        GardenRouteUnavailable,
        InvalidRecipient,
        BatchSizeExceeded,
        TransferAmountExceeded,
        BatchAmountExceeded,
        PeriodCapExceeded,
        RouteRejected,
        RouteReverted,
        UnsupportedReceiverPaysFee,
        FeeQuoteExceeded,
        BalanceDeltaMismatch,
        /// @dev Source-side disposition, never sent by an executor. Appended last so ordinals 0-11
        ///      stay identical to `ICeloSettlementExecutor.FailureCode`, and the acknowledgment
        ///      bound still rejects anything above `BalanceDeltaMismatch` arriving over CCIP.
        ///      Written only by `failStrandedSubject` (Decision Log #60).
        SourceStranded
    }

    struct SettlementAccount {
        uint64 chainId;
        address account;
        bool active;
        address[3] recoveryOwners;
        address rolesModifier;
        bytes32 roleKey;
        bytes32 allowanceKey;
        bytes32 permissionsConfigHash;
        bytes32 recoveryConfigHash;
        uint8 recoveryThreshold;
    }

    struct CcipRoute {
        uint64 destinationChainSelector;
        address destinationExecutor;
        address previousDestinationExecutor;
        uint64 previousPeerExpiresAt;
        uint32 destinationGasLimit;
        uint8 protocolVersion;
    }

    struct Disbursement {
        uint256 commitmentId;
        uint256 payoutPlanId;
        address contributor;
        address garden;
        address executorGarden;
        DisbursementKind kind;
        FundingRoute fundingRoute;
        address source;
        address recipient;
        address token;
        uint256 amount;
        DisbursementState state;
        uint256 batchId;
        string reasonCID;
        uint32 attempt;
        bytes32 executionKey;
        bytes32 commandMessageId;
        uint64 dispatchedAt;
        uint64 confirmedAt;
        bytes32 acknowledgmentMessageId;
        uint8 failureCode;
        DisbursementState cancelledFromState;
    }

    struct LoanPrincipalRelationship {
        address creditRegistry;
        uint256 loanId;
    }

    struct CommitmentPayoutPlan {
        uint256 commitmentId;
        address providerGarden;
        address payerGarden;
        address source;
        address token;
        DisbursementKind payoutKind;
        uint256 declaredAmount;
        uint256 gardenRetainedAmount;
        uint256 contributorPayoutTotal;
        address beneficiaryGarden;
        address beneficiaryRecipient;
        uint256 beneficiaryAmount;
        uint256 beneficiaryDisbursementId;
        uint32 recognitionContributorCount;
        uint32 payablePayoutCount;
        uint32 preparedPayoutCount;
        uint32 confirmedPayoutCount;
        uint32 failedPayoutCount;
        uint32 cancelledPayoutCount;
        uint32 paymentSnapshotVersion;
        bytes32 recognitionSnapshotHash;
        bytes32 paymentSnapshotHash;
        address[] contributorOrder;
        string latestEditReasonCID;
        bool finalized;
        uint64 createdAt;
        uint64 finalizedAt;
    }

    struct RecognitionEntry {
        address contributor;
        uint16 recognitionWeightBps;
    }

    struct ContributorPayoutInput {
        address contributor;
        uint256 amount;
    }

    struct PaymentSnapshotEntry {
        address contributor;
        address recipient;
        uint16 recognitionWeightBps;
        uint16 paymentWeightBps;
        uint256 amount;
    }

    struct ContributorPayout {
        address contributor;
        uint16 recognitionWeightBps;
        uint16 paymentWeightBps;
        uint256 amount;
        address recipient;
        uint256 disbursementId;
    }

    struct Batch {
        address executorGarden;
        address source;
        address token;
        DisbursementKind kind;
        FundingRoute fundingRoute;
        uint256[] disbursementIds;
        DisbursementState state;
        uint32 attempt;
        bytes32 executionKey;
        bytes32 commandMessageId;
        uint64 dispatchedAt;
        uint64 confirmedAt;
        bytes32 acknowledgmentMessageId;
        uint8 failureCode;
    }

    struct CommandRecord {
        bool isBatch;
        uint256 subjectId;
        uint32 attempt;
        uint64 destinationChainSelector;
        address destinationExecutor;
        uint32 destinationGasLimit;
        uint8 protocolVersion;
        bytes32 commandPayloadHash;
        bytes32 latestCommandMessageId;
        bool acknowledged;
    }

    event FundingConfigurationLocked(address indexed protocolGarden, address indexed gDollarToken);
    event SettlementAccountRegistered(
        address indexed garden,
        uint64 chainId,
        address indexed account,
        address[3] recoveryOwners,
        address rolesModifier,
        bytes32 roleKey,
        bytes32 allowanceKey,
        bytes32 permissionsConfigHash,
        bytes32 recoveryConfigHash,
        uint8 recoveryThreshold
    );
    /// @notice The implementation immutables, announced once so nothing off chain has to guess them.
    /// @dev Emitted from `initialize` before any other settlement fact. The router, the local chain
    ///      selector, and the destination EVM chain ID are constructor immutables, so without this
    ///      the only way to learn them is an RPC read against a known address — which the indexer
    ///      cannot do, and which a fresh consumer cannot bootstrap from at all. Gating projection on
    ///      configuration that no event carries is what left four indexed entity types permanently
    ///      uncreated (pre-merge review 2026-08-09, Decision Log #59).
    event SettlementDeploymentPinned(
        address indexed ccipRouter, uint64 indexed localChainSelector, uint64 indexed remoteEvmChainId
    );
    event SettlementRecoveryUpdated(address indexed garden, address[3] recoveryOwners, bytes32 recoveryConfigHash);
    event SettlementAccountStatusChanged(address indexed garden, bool active);
    event CcipRouteUpdated(
        uint64 indexed destinationChainSelector,
        address indexed destinationExecutor,
        address indexed previousDestinationExecutor,
        uint64 previousPeerExpiresAt,
        uint32 destinationGasLimit,
        uint8 protocolVersion
    );
    event GardenerDeliveryStatusChanged(bool enabled);
    event BatchSizeLimitUpdated(uint16 previousLimit, uint16 limit);
    event DispatcherUpdated(address indexed previousDispatcher, address indexed dispatcher);
    event FeeReserveMinimumUpdated(uint256 previousMinimum, uint256 minimum);
    event HatsModuleUpdated(address indexed previousModule, address indexed newModule);
    event CommitmentPoolingModuleUpdated(address indexed previousModule, address indexed newModule);
    event CreditRegistryUpdated(address indexed previousRegistry, address indexed newRegistry);
    event PausedSet(bool paused);
    event CommitmentPayoutPlanCreated(
        uint256 indexed payoutPlanId,
        uint256 indexed commitmentId,
        address indexed providerGarden,
        address payerGarden,
        address source,
        address token,
        uint8 payoutKind,
        uint256 declaredAmount,
        uint256 gardenRetainedAmount,
        address beneficiaryGarden,
        address beneficiaryRecipient,
        uint256 beneficiaryAmount,
        bytes32 recognitionSnapshotHash,
        address createdBy
    );
    event ContributorPayoutSet(
        uint256 indexed payoutPlanId,
        uint32 indexed paymentSnapshotVersion,
        address indexed contributor,
        address recipient,
        uint16 recognitionWeightBps,
        uint16 paymentWeightBps,
        uint256 amount,
        string reasonCID,
        address editedBy
    );
    event CommitmentPayoutSnapshotCommitted(
        uint256 indexed payoutPlanId,
        uint32 indexed paymentSnapshotVersion,
        uint32 rowCount,
        uint256 gardenRetainedAmount,
        uint256 contributorPayoutTotal,
        bytes32 paymentSnapshotHash,
        string reasonCID,
        address editedBy
    );
    event CommitmentPayoutPlanFinalized(
        uint256 indexed payoutPlanId,
        uint8 payoutKind,
        uint32 payablePayoutCount,
        uint256 contributorPayoutTotal,
        uint256 beneficiaryAmount,
        uint256 gardenRetainedAmount,
        bytes32 recognitionSnapshotHash,
        bytes32 paymentSnapshotHash,
        bool completedWithoutDispatch,
        uint64 finalizedAt
    );
    event DisbursementQueued(
        uint256 indexed disbursementId,
        uint256 indexed commitmentId,
        address indexed garden,
        uint256 payoutPlanId,
        address contributor,
        address executorGarden,
        uint8 kind,
        uint8 fundingRoute,
        address source,
        address recipient,
        address token,
        uint256 amount
    );
    event LoanPrincipalQueued(uint256 indexed disbursementId, address indexed creditRegistry, uint256 indexed loanId);
    event BatchCreated(
        uint256 indexed batchId,
        address indexed executorGarden,
        address indexed source,
        address token,
        uint8 kind,
        uint8 fundingRoute,
        uint256[] disbursementIds
    );
    event SettlementCommandDispatched(
        bytes32 indexed executionKey,
        bytes32 indexed commandMessageId,
        bool indexed isBatch,
        uint256 subjectId,
        uint32 attempt,
        uint64 destinationChainSelector,
        address destinationExecutor,
        uint32 destinationGasLimit,
        uint8 protocolVersion,
        bytes32 commandPayloadHash,
        uint256 fee
    );
    event SettlementCommandRetried(
        bytes32 indexed executionKey,
        bytes32 indexed commandMessageId,
        bool indexed isBatch,
        uint256 subjectId,
        uint32 attempt,
        uint64 destinationChainSelector,
        address destinationExecutor,
        uint32 destinationGasLimit,
        uint8 protocolVersion,
        bytes32 commandPayloadHash,
        uint256 fee
    );
    event SettlementAcknowledged(
        bytes32 indexed executionKey,
        bytes32 indexed acknowledgmentMessageId,
        bytes32 indexed originatingCommandMessageId,
        bool isBatch,
        uint256 subjectId,
        bool success,
        uint8 failureCode
    );
    event DuplicateAcknowledgmentIgnored(bytes32 indexed executionKey, bytes32 indexed acknowledgmentMessageId);
    event StaleAcknowledgmentIgnored(bytes32 indexed executionKey, bytes32 indexed acknowledgmentMessageId);
    event StrandedSubjectFailed(
        bytes32 indexed executionKey, bool isBatch, uint256 indexed subjectId, address indexed retiredExecutor
    );
    event DisbursementRequeued(uint256 indexed disbursementId, uint32 attempt);
    event DisbursementCancelled(
        uint256 indexed disbursementId, address indexed actor, uint8 cancelledFromState, string reasonCID
    );
    event BatchCancelled(uint256 indexed batchId, address indexed actor, string reasonCID);
    event FeeReserveFunded(address indexed funder, uint256 amount);
    event ExcessFeesWithdrawn(address indexed recipient, uint256 amount);

    error FundingConfigurationIncomplete();
    error ZeroAddress();
    error UnauthorizedCaller(address caller);
    error NotSettlementSteward(address caller, address garden);
    error UnknownSettlementAccount(address garden);
    error SettlementAccountInactive(address garden);
    error InvalidSettlementChain(uint64 chainId);
    error InvalidRecoveryConfiguration();
    error UnknownDisbursement(uint256 disbursementId);
    error UnknownBatch(uint256 batchId);
    error DisbursementNotInState(uint256 disbursementId, DisbursementState actual);
    error BatchNotInState(uint256 batchId, DisbursementState actual);
    error AmountRequired();
    error ConsiderationNotDeclared(uint256 commitmentId);
    error InvalidPayerGarden(uint256 commitmentId);
    error CommitmentPayoutPlanExists(uint256 commitmentId, uint256 payoutPlanId);
    error UnknownPayoutPlan(uint256 payoutPlanId);
    error PayoutPlanFinalized(uint256 payoutPlanId);
    error PayoutPlanNotFinalized(uint256 payoutPlanId);
    error PayoutKindMismatch(uint256 payoutPlanId, DisbursementKind expected, DisbursementKind actual);
    error IneligibleContributor(uint256 commitmentId, address contributor);
    error InvalidRecognitionVector();
    error RecognitionSnapshotMismatch(bytes32 expected, bytes32 actual);
    error InvalidPayoutVector();
    error TooManyPayoutContributors(uint256 supplied, uint256 maximum);
    error RecognitionPaymentDivergenceRequiresReason();
    error PayoutPlanInvariantMismatch(
        uint256 declaredAmount, uint256 retainedAmount, uint256 contributorTotal, uint256 beneficiaryAmount
    );
    error BatchSizeOutOfBounds(uint256 supplied, uint256 maximum);
    error DuplicateBatchEntry(uint256 disbursementId);
    error DuplicateBatchRecipient(address recipient);
    error BatchEntryMismatch(uint256 disbursementId);
    error InvalidCcipSource();
    error InvalidCcipSender();
    error CcipTokensNotAllowed();
    error UnsupportedMessageVersion();
    error InvalidExecutionKey();
    error InsufficientNativeFee();
    error FeeReserveFloorViolated(uint256 requiredMinimum, uint256 remainingBalance);
    error DispatchedSettlementCannotBeCancelled();
    error BatchedDisbursementCannotBeCancelled(uint256 disbursementId, uint256 batchId);
    error GardenerDeliveryDisabled();
    error SourceMustBePaused();
    error SourceNotReady();
    error ImmutableConfigurationMismatch();
    /// @notice An acknowledgment arrived from an executor we no longer trust (Decision Log #60).
    error RetiredPeerAcknowledgment(address sender);
    /// @notice The subject's executor can still acknowledge, so there is nothing to close out.
    error SubjectNotStranded(bool isBatch, uint256 subjectId);
    error CreditRegistryRequired();
    error LoanPrincipalNotApproved(uint256 loanId, uint8 state);
    error LoanPrincipalMismatch(uint256 loanId, uint256 disbursementId);
    error LoanPrincipalCapExceeded(uint256 loanId, uint256 requested, uint256 available);

    function initialize(
        address owner_,
        address hatsModule_,
        address commitmentPoolingModule_,
        address protocolGarden_,
        address gDollarToken_
    )
        external;
    function setCcipRoute(
        uint64 destinationChainSelector,
        address destinationExecutor,
        uint32 destinationGasLimit,
        uint8 protocolVersion,
        uint64 previousPeerGraceSeconds
    )
        external;
    function setBatchSizeLimit(uint16 limit) external;
    function setDispatcher(address dispatcher_) external;
    function setFeeReserveMinimum(uint256 minimum) external;
    function registerSettlementAccount(
        address garden,
        uint64 chainId,
        address account,
        address[3] calldata recoveryOwners,
        address rolesModifier,
        bytes32 roleKey,
        bytes32 allowanceKey,
        bytes32 permissionsConfigHash
    )
        external;
    function updateSettlementRecovery(address garden, address[3] calldata recoveryOwners) external;
    function setAccountActive(address garden, bool active) external;
    function setGardenerDeliveryEnabled(bool enabled) external;
    function createCommitmentPayoutPlan(
        uint256 commitmentId,
        RecognitionEntry[] calldata recognitionEntries,
        bytes32 recognitionSnapshotHash
    )
        external
        returns (uint256 payoutPlanId);
    function setContributorPayouts(
        uint256 payoutPlanId,
        uint256 gardenRetainedAmount,
        ContributorPayoutInput[] calldata payouts,
        string calldata reasonCID
    )
        external;
    function finalizeCommitmentPayoutPlan(uint256 payoutPlanId) external;
    function prepareContributorPayout(
        uint256 payoutPlanId,
        address contributor
    )
        external
        returns (uint256 disbursementId);
    function prepareGardenBeneficiaryPayout(uint256 payoutPlanId) external returns (uint256 disbursementId);
    function queueFunding(address garden, uint256 amount) external returns (uint256 disbursementId);
    function queueLoanPrincipal(uint256 loanId) external returns (uint256 disbursementId);
    function createBatch(uint256[] calldata disbursementIds) external returns (uint256 batchId);
    function dispatchDisbursement(uint256 disbursementId) external returns (bytes32 messageId);
    function dispatchBatch(uint256 batchId) external returns (bytes32 messageId);
    function retryCommand(uint256 disbursementId) external returns (bytes32 messageId);
    function retryBatchCommand(uint256 batchId) external returns (bytes32 messageId);
    function requeue(uint256 disbursementId) external;
    /// @notice Owner-only close-out for a Dispatched subject whose executor can no longer acknowledge.
    /// @dev Refuses while the snapshotted executor is still the active or unexpired previous peer.
    ///      Confirm on Celo whether the payment actually landed before requeuing (Decision Log #60).
    function failStrandedSubject(bool isBatch, uint256 subjectId) external;
    function cancelDisbursement(uint256 disbursementId, string calldata reasonCID) external;
    function cancelBatch(uint256 batchId, string calldata reasonCID) external;
    function getDisbursement(uint256 disbursementId) external view returns (Disbursement memory);
    function getBatch(uint256 batchId) external view returns (Batch memory);
    function settlementAccountOf(address garden) external view returns (SettlementAccount memory);
    function getPayoutPlan(uint256 payoutPlanId) external view returns (CommitmentPayoutPlan memory);
    function contributorPayoutOf(
        uint256 payoutPlanId,
        address contributor
    )
        external
        view
        returns (ContributorPayout memory);
    function payoutContributors(uint256 payoutPlanId) external view returns (address[] memory);
    function payoutPlanOfCommitment(uint256 commitmentId) external view returns (uint256);
    function loanPrincipalDisbursementOf(address registry, uint256 loanId) external view returns (uint256);
    function loanPrincipalRelationshipOf(uint256 disbursementId) external view returns (LoanPrincipalRelationship memory);
    function payoutPlanStatus(uint256 payoutPlanId) external view returns (PayoutPlanStatus);
    function MAX_PAYOUT_CONTRIBUTORS() external pure returns (uint256);
    function isAcknowledgmentPending(bool isBatch, uint256 subjectId) external view returns (bool);
    function commandRecord(bytes32 executionKey) external view returns (CommandRecord memory);
    function gardenerDeliveryEnabled() external view returns (bool);
    function ccipRoute() external view returns (CcipRoute memory);
    function quoteCommandFee(bool isBatch, uint256 subjectId) external view returns (uint256);
    function HARD_MAX_BATCH_SIZE() external pure returns (uint256);
    function batchSizeLimit() external view returns (uint16);
    function dispatcher() external view returns (address);
    function feeReserveMinimum() external view returns (uint256);
    function nativeFeeBalance() external view returns (uint256);
    function isFeeReserveLow() external view returns (bool);
    function protocolGarden() external view returns (address);
    function gDollarToken() external view returns (address);
    function hatsModule() external view returns (address);
    function commitmentPoolingModule() external view returns (address);
    function creditRegistry() external view returns (address);
    function paused() external view returns (bool);
    function CCIP_ROUTER() external view returns (address);
    function SOURCE_CHAIN_SELECTOR() external view returns (uint64);
    function DESTINATION_EVM_CHAIN_ID() external view returns (uint64);
    function fundFees() external payable;
    function withdrawExcessFees(address payable recipient, uint256 amount) external;
    function setHatsModule(address module) external;
    function setCommitmentPoolingModule(address module) external;
    function setCreditRegistry(address registry) external;
    function setPaused(bool paused_) external;
}
