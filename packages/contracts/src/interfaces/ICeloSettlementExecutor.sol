// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface ICeloSettlementExecutor {
    enum ResultStatus {
        None,
        Success,
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
        BalanceDeltaMismatch
    }

    enum AcknowledgmentDeferralCode {
        None,
        QuoteFailed,
        FeeReserveLow,
        SendFailed
    }

    struct SourcePeer {
        uint64 sourceChainSelector;
        address sourceSettlementModule;
        address previousSourceSettlementModule;
        uint64 previousPeerExpiresAt;
        uint8 protocolVersion;
    }

    struct GardenRoute {
        address safe;
        address rolesModifier;
        bytes32 roleKey;
        bytes32 allowanceKey;
        bytes32 permissionsConfigHash;
        bool active;
    }

    struct ExecutionResult {
        bytes32 commandMessageId;
        bytes32 acknowledgmentMessageId;
        address acknowledgmentReceiver;
        uint8 protocolVersion;
        ResultStatus status;
        FailureCode failureCode;
        AcknowledgmentDeferralCode acknowledgmentDeferralCode;
        bool acknowledgmentSent;
    }

    struct GardenPeriodSpend {
        uint64 periodStartedAt;
        uint256 amount;
    }

    /// @notice The implementation immutables, announced once so nothing off chain has to guess them.
    /// @dev The executor twin of `ISettlementModule.SettlementDeploymentPinned`, emitted from
    ///      `initialize` before any other fact. `remoteEvmChainId` is the source chain this executor
    ///      answers to, which is the field the indexer needs to key cross-chain rows and which no
    ///      other event carries (Decision Log #59).
    event ExecutorDeploymentPinned(
        address indexed ccipRouter, address indexed gDollarToken, uint64 indexed remoteChainSelector
    );
    event SourcePeerUpdated(
        uint64 indexed sourceChainSelector,
        address indexed sourceSettlementModule,
        address indexed previousSourceSettlementModule,
        uint64 previousPeerExpiresAt,
        uint8 protocolVersion
    );
    event GardenRouteConfigured(
        address indexed garden,
        address indexed safe,
        address indexed rolesModifier,
        bytes32 roleKey,
        bytes32 allowanceKey,
        bytes32 permissionsConfigHash
    );
    event GardenRouteStatusChanged(address indexed garden, bool active);
    event CapsUpdated(uint16 maxBatchSize, uint256 maxTransferAmount, uint256 maxBatchAmount);
    event FeePolicyUpdated(uint16 maxFeeBps, uint256 maxFeeAmount);
    event PeriodicCapUpdated(uint64 periodDuration, uint256 maxPeriodAmount);
    event AcknowledgmentFeeReserveMinimumUpdated(uint256 previousMinimum, uint256 minimum);
    event AcknowledgmentFeeReserveFunded(address indexed funder, uint256 amount);
    event ExcessAcknowledgmentFeesWithdrawn(address indexed recipient, uint256 amount);
    event PausedSet(bool paused);
    event SettlementExecutionStored(
        bytes32 indexed executionKey,
        bytes32 indexed commandMessageId,
        address indexed executorGarden,
        address acknowledgmentReceiver,
        uint8 protocolVersion,
        bool isBatch,
        uint256 settlementId,
        uint32 attempt,
        ResultStatus status,
        FailureCode failureCode
    );
    event DuplicateSettlementMessage(bytes32 indexed executionKey, bytes32 indexed commandMessageId);
    event AcknowledgmentSent(
        bytes32 indexed executionKey,
        bytes32 indexed commandMessageId,
        bytes32 indexed acknowledgmentMessageId,
        uint256 fee,
        bool reserveFunded
    );
    event AcknowledgmentDeferred(
        bytes32 indexed executionKey, bytes32 indexed commandMessageId, AcknowledgmentDeferralCode reasonCode
    );

    error InvalidCcipSource();
    error ZeroAddress();
    error InvalidCcipSender();
    error CcipTokensNotAllowed();
    error UnsupportedMessageVersion();
    error MalformedSettlementCommand();
    error UnknownExecutionKey(bytes32 executionKey);
    error GardenRouteAlreadyConfigured(address garden);
    error SafeAlreadyAssigned(address safe, address garden);
    error PolicyNotConfigured();
    error InvalidFeePolicy(uint16 maxFeeBps, uint256 maxFeeAmount);
    error IncorrectAcknowledgmentFee(uint256 quoted, uint256 supplied);
    error AcknowledgmentFeeReserveFloorViolated(uint256 requiredMinimum, uint256 remainingBalance);
    error ExecutorMustBePaused();
    error ExecutorNotReady();
    error ImmutableGdollarMismatch(address currentToken, address replacementToken);
    error ImmutableRouterMismatch(address currentRouter, address replacementRouter);

    function initialize(
        address owner_,
        uint64 sourceChainSelector_,
        address sourceSettlementModule_,
        uint8 protocolVersion_
    )
        external;
    function configureGardenRoute(
        address garden,
        address safe,
        address rolesModifier,
        bytes32 roleKey,
        bytes32 allowanceKey,
        bytes32 permissionsConfigHash
    )
        external;
    function setGardenRouteActive(address garden, bool active) external;
    function setSourcePeer(
        address sourceSettlementModule,
        uint8 protocolVersion,
        uint64 previousPeerGraceSeconds
    )
        external;
    function setCaps(uint16 maxBatchSize_, uint256 maxTransferAmount_, uint256 maxBatchAmount_) external;
    function setFeePolicy(uint16 maxFeeBps_, uint256 maxFeeAmount_) external;
    function setPeriodicCap(uint64 periodDuration_, uint256 maxPeriodAmount_) external;
    function setAcknowledgmentFeeReserveMinimum(uint256 minimum) external;
    function setPaused(bool paused_) external;
    function retryAcknowledgment(bytes32 executionKey) external payable returns (bytes32 messageId);
    function retryAcknowledgmentSponsored(bytes32 executionKey) external returns (bytes32 messageId);
    function quoteAcknowledgmentFee(bytes32 executionKey) external view returns (uint256);
    function fundAcknowledgmentFees() external payable;
    function withdrawExcessAcknowledgmentFees(address payable recipient, uint256 amount) external;
    function gardenRouteOf(address garden) external view returns (GardenRoute memory);
    function executionResultOf(bytes32 executionKey) external view returns (ExecutionResult memory);
    function sourcePeer() external view returns (SourcePeer memory);
    function gardenPeriodSpend(address garden) external view returns (GardenPeriodSpend memory);
    function acknowledgmentFeeReserveMinimum() external view returns (uint256);
    function nativeFeeBalance() external view returns (uint256);
    function isAcknowledgmentFeeReserveLow() external view returns (bool);
    function maxBatchSize() external view returns (uint16);
    function maxTransferAmount() external view returns (uint256);
    function maxBatchAmount() external view returns (uint256);
    function maxFeeBps() external view returns (uint16);
    function maxFeeAmount() external view returns (uint256);
    function periodDuration() external view returns (uint64);
    function maxPeriodAmount() external view returns (uint256);
    function paused() external view returns (bool);
    function HARD_MAX_BATCH_SIZE() external pure returns (uint256);
    function CCIP_ROUTER() external view returns (address);
    function G_DOLLAR_TOKEN() external view returns (address);
}
