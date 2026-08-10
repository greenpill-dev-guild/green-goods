// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title ICreditRegistry
/// @notice Records and authorizes interest-free pool credit without holding or moving value.
interface ICreditRegistry {
    enum LoanState {
        None,
        Requested,
        Approved,
        Disbursed,
        Repaid,
        Defaulted,
        Cancelled
    }

    enum LoanRail {
        None,
        Jar,
        Treasury,
        GDollarSettlement
    }

    struct PoolCreditConfig {
        uint256 borrowerCap;
        bool enabled;
    }

    struct Loan {
        uint256 poolId;
        address borrower;
        address requestedBy;
        uint256 commitmentId;
        address token;
        uint256 principal;
        uint256 repaidAmount;
        uint256 feeAmount;
        LoanRail rail;
        uint256 disbursementId;
        LoanState state;
        uint64 dueDate;
        uint32 installmentsTotal;
        uint32 installmentsPaid;
        uint32 attempts;
        bytes32 executionRef;
        string termsCID;
        string reasonCID;
    }

    struct RequestLoanParams {
        uint256 poolId;
        uint256 commitmentId;
        address token;
        uint256 principal;
        uint64 dueDate;
        uint32 installmentsTotal;
        string termsCID;
        address onBehalfOf;
    }

    event CreditRegistryInitialized(
        address indexed owner, address indexed hatsModule, address indexed commitmentPoolingModule, address settlementModule
    );
    event PoolCreditConfigured(
        uint256 indexed poolId,
        uint256 previousBorrowerCap,
        uint256 borrowerCap,
        bool previouslyEnabled,
        bool enabled,
        address indexed configuredBy
    );
    event ExecutorUpdated(uint256 indexed poolId, address indexed executor, bool enabled, address indexed updatedBy);
    event LoanRequested(
        uint256 indexed loanId,
        uint256 indexed poolId,
        address indexed borrower,
        address requestedBy,
        uint256 commitmentId,
        address token,
        uint256 principal,
        uint64 dueDate,
        uint32 installmentsTotal,
        string termsCID
    );
    event LoanApproved(uint256 indexed loanId, address indexed approvedBy);
    event LoanDisbursed(
        uint256 indexed loanId,
        uint8 rail,
        address indexed token,
        uint256 amount,
        uint256 disbursementId,
        bytes32 indexed executionRef,
        address recordedBy
    );
    event RepaymentRecorded(
        uint256 indexed loanId,
        uint256 amount,
        uint256 repaidAmount,
        uint256 newOutstanding,
        uint32 installmentsPaid,
        bytes32 indexed executionRef,
        address indexed recordedBy
    );
    event LoanRepaid(uint256 indexed loanId, bool recoveredFromDefault, address indexed recordedBy);
    event LoanDefaulted(uint256 indexed loanId, string reasonCID, address indexed markedBy);
    event LoanCancelled(uint256 indexed loanId, string reasonCID, address indexed cancelledBy);
    event HatsModuleUpdated(address indexed previousModule, address indexed newModule);
    event CommitmentPoolingModuleUpdated(address indexed previousModule, address indexed newModule);
    event SettlementModuleUpdated(address indexed previousModule, address indexed newModule);
    event PausedSet(bool paused);

    error ZeroAddress();
    error ModulePaused();
    error ModuleMustBePaused();
    error ModuleNotReady();
    error UnknownPool(uint256 poolId);
    error PoolNotOpen(uint256 poolId);
    error PoolCreditDisabled(uint256 poolId);
    error NotPoolMember(address account, uint256 poolId);
    error NotPoolSteward(address account, uint256 poolId);
    error UnauthorizedRecorder(address account, uint256 poolId);
    error InvalidOnBehalfOf(address account);
    error UnknownLoan(uint256 loanId);
    error LoanNotInState(uint256 loanId, LoanState actual);
    error SelfApproval(uint256 loanId, address borrower);
    error BorrowerCapExceeded(uint256 poolId, address borrower, uint256 requested, uint256 available);
    error UnknownCommitment(uint256 commitmentId);
    error CommitmentPoolMismatch(uint256 commitmentId, uint256 expectedPoolId, uint256 actualPoolId);
    error CommitmentLoanExists(uint256 commitmentId, uint256 loanId);
    error TokenRequired();
    error PrincipalRequired();
    error InvalidDueDate(uint64 dueDate);
    error TermsRequired();
    error ReasonRequired();
    error InvalidRail(LoanRail rail);
    error ExecutionRefRequired();
    error ExecutionRefUsed(bytes32 executionRef, uint256 loanId);
    error RepaymentAmountRequired();
    error RepaymentExceedsBalance(uint256 amount, uint256 outstanding);
    error NotDue(uint256 loanId, uint64 dueDate);
    error CancellationNotAllowed(uint256 loanId, LoanState state);
    error SettlementRelationshipMissing(uint256 loanId);
    error SettlementDisbursementMismatch(uint256 loanId, uint256 disbursementId);
    error SettlementNotConfirmed(uint256 loanId, uint256 disbursementId);
    error GDollarRepaymentDisabled(uint256 loanId);

    function initialize(
        address owner_,
        address hatsModule_,
        address commitmentPoolingModule_,
        address settlementModule_
    )
        external;
    function configurePoolCredit(uint256 poolId, uint256 borrowerCap, bool enabled) external;
    function addExecutor(uint256 poolId, address executor) external;
    function removeExecutor(uint256 poolId, address executor) external;
    function requestLoan(RequestLoanParams calldata params) external returns (uint256 loanId);
    function approveLoan(uint256 loanId) external;
    function recordDisbursed(uint256 loanId, LoanRail rail, bytes32 executionRef) external;
    function recordRepayment(uint256 loanId, uint256 amount, bytes32 executionRef) external;
    function markDefaulted(uint256 loanId, string calldata reasonCID) external;
    function cancelLoan(uint256 loanId, string calldata reasonCID) external;
    function setHatsModule(address module) external;
    function setCommitmentPoolingModule(address module) external;
    function setSettlementModule(address module) external;
    function setPaused(bool paused_) external;

    function getLoan(uint256 loanId) external view returns (Loan memory);
    function poolCreditConfig(uint256 poolId) external view returns (PoolCreditConfig memory);
    function outstandingOf(uint256 poolId, address borrower) external view returns (uint256);
    function amountDue(uint256 loanId) external view returns (uint256);
    function loanOfCommitment(uint256 commitmentId) external view returns (uint256);
    function isExecutor(uint256 poolId, address executor) external view returns (bool);
    function loanOfExecutionRef(bytes32 executionRef) external view returns (uint256);
    function hatsModule() external view returns (address);
    function commitmentPoolingModule() external view returns (address);
    function settlementModule() external view returns (address);
    function nextLoanId() external view returns (uint256);
    function paused() external view returns (bool);
}
