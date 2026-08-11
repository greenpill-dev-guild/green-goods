// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../interfaces/ICommitmentPoolingModule.sol";
import { CreditRegistryBase } from "./CreditBase.sol";

/// @title CreditRegistry
/// @notice Pool-scoped, records-only control plane for interest-free advances and repayments.
/// @dev This contract never receives, approves, holds, or transfers funds.
contract CreditRegistry is CreditRegistryBase {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address owner_,
        address hatsModule_,
        address commitmentPoolingModule_,
        address settlementModule_
    )
        external
        override
        initializer
    {
        if (
            owner_ == address(0) || hatsModule_ == address(0) || commitmentPoolingModule_ == address(0)
                || settlementModule_ == address(0)
        ) revert ZeroAddress();
        __Ownable_init();
        __ReentrancyGuard_init();
        _transferOwnership(owner_);
        hatsModule = hatsModule_;
        commitmentPoolingModule = commitmentPoolingModule_;
        settlementModule = settlementModule_;
        _validateSettlementModule(settlementModule_, SettlementBindingRequirement.Any);
        nextLoanId = 1;
        paused = true;
        emit CreditRegistryInitialized(owner_, hatsModule_, commitmentPoolingModule_, settlementModule_);
        emit HatsModuleUpdated(address(0), hatsModule_);
        emit CommitmentPoolingModuleUpdated(address(0), commitmentPoolingModule_);
        emit SettlementModuleUpdated(address(0), settlementModule_);
        emit PausedSet(true);
    }

    function configurePoolCredit(
        uint256 poolId,
        address token,
        uint256 borrowerCap,
        bool enabled
    )
        external
        override
        whenOperational
        nonReentrant
    {
        if (token == address(0)) revert TokenRequired();
        ICommitmentPoolingModule.Pool memory pool = _requirePool(poolId);
        _requirePoolSteward(poolId, pool, msg.sender);
        PoolCreditConfig memory previous = _poolCreditConfig[poolId];
        if (previous.token != address(0) && previous.token != token) {
            revert PoolCreditTokenLocked(poolId, previous.token, token);
        }
        _poolCreditConfig[poolId] = PoolCreditConfig({ borrowerCap: borrowerCap, enabled: enabled, token: token });
        _lockPoolingIdentity();
        emit PoolCreditConfigured(poolId, token, previous.borrowerCap, borrowerCap, previous.enabled, enabled, msg.sender);
    }

    function addExecutor(uint256 poolId, address executor) external override whenOperational nonReentrant {
        if (executor == address(0)) revert ZeroAddress();
        ICommitmentPoolingModule.Pool memory pool = _requirePool(poolId);
        _requirePoolSteward(poolId, pool, msg.sender);
        _executors[poolId][executor] = true;
        _lockPoolingIdentity();
        emit ExecutorUpdated(poolId, executor, true, msg.sender);
    }

    function removeExecutor(uint256 poolId, address executor) external override whenOperational nonReentrant {
        if (executor == address(0)) revert ZeroAddress();
        ICommitmentPoolingModule.Pool memory pool = _requirePool(poolId);
        _requirePoolSteward(poolId, pool, msg.sender);
        _executors[poolId][executor] = false;
        emit ExecutorUpdated(poolId, executor, false, msg.sender);
    }

    function requestLoan(RequestLoanParams calldata params)
        external
        override
        whenOperational
        nonReentrant
        returns (uint256 loanId)
    {
        ICommitmentPoolingModule.Pool memory pool = _requireOpenEnabledPool(params.poolId);
        address borrower = _resolveBorrower(params.poolId, pool, params.onBehalfOf);
        _validateRequestFacts(params, borrower);
        _lockPoolingIdentity();

        loanId = nextLoanId++;
        _loans[loanId] = Loan({
            poolId: params.poolId,
            borrower: borrower,
            requestedBy: msg.sender,
            commitmentId: params.commitmentId,
            token: params.token,
            principal: params.principal,
            repaidAmount: 0,
            feeAmount: 0,
            rail: LoanRail.None,
            disbursementId: 0,
            state: LoanState.Requested,
            dueDate: params.dueDate,
            installmentsTotal: params.installmentsTotal,
            installmentsPaid: 0,
            attempts: 0,
            executionRef: bytes32(0),
            termsCID: params.termsCID,
            reasonCID: ""
        });
        if (params.commitmentId != 0) _commitmentLoan[params.commitmentId] = loanId;
        emit LoanRequested(
            loanId,
            params.poolId,
            borrower,
            msg.sender,
            params.commitmentId,
            params.token,
            params.principal,
            params.dueDate,
            params.installmentsTotal,
            params.termsCID
        );
    }

    function approveLoan(uint256 loanId) external override whenOperational nonReentrant {
        Loan storage loan = _requireLoan(loanId);
        if (loan.state != LoanState.Requested) revert LoanNotInState(loanId, loan.state);
        _requireFutureDueDate(loan);
        ICommitmentPoolingModule.Pool memory pool = _requireOpenEnabledPool(loan.poolId);
        _requirePoolSteward(loan.poolId, pool, msg.sender);
        if (msg.sender == loan.borrower) revert SelfApproval(loanId, loan.borrower);
        _requireRequestAuthorityStillValid(loan, pool);
        _requireBorrowerCap(loan.poolId, loan.borrower, loan.principal + loan.feeAmount);
        _reserveCap(loanId, loan);
        loan.state = LoanState.Approved;
        emit LoanApproved(loanId, msg.sender);
    }

    function recordDisbursed(
        uint256 loanId,
        LoanRail rail,
        bytes32 executionRef
    )
        external
        override
        whenOperational
        nonReentrant
    {
        Loan storage loan = _requireLoan(loanId);
        if (loan.state != LoanState.Approved) revert LoanNotInState(loanId, loan.state);
        if (rail == LoanRail.None) revert InvalidRail(rail);
        ICommitmentPoolingModule.Pool memory pool =
            rail == LoanRail.GDollarSettlement ? _requirePool(loan.poolId) : _requireOpenEnabledPool(loan.poolId);
        _requireRecorder(loan.poolId, pool, msg.sender);
        // A confirmed G$ child passed the due-date gate before dispatch; recording may legitimately
        // arrive after cross-chain transit, pool shutdown, or credit disablement and must not strand
        // value that already moved.
        if (rail != LoanRail.GDollarSettlement) _requireFutureDueDate(loan);
        _requireCapReservation(loanId);
        if (rail != LoanRail.GDollarSettlement) {
            _requireNoSettlementChild(loanId);
            _requireReservedExposureWithinCap(loan);
        }
        _requireFreshExecutionRef(executionRef);

        uint256 disbursementId;
        uint32 attempts;
        if (rail == LoanRail.GDollarSettlement) {
            (disbursementId, attempts) = _validateConfirmedSettlement(loanId, loan, pool, executionRef);
        }

        _executionRefLoan[executionRef] = loanId;
        loan.rail = rail;
        loan.disbursementId = disbursementId;
        loan.attempts = attempts;
        loan.executionRef = executionRef;
        loan.state = LoanState.Disbursed;
        _releaseCap(loanId, loan);
        _borrowerOutstanding[loan.poolId][loan.borrower] += loan.principal + loan.feeAmount;
        emit LoanDisbursed(loanId, uint8(rail), loan.token, loan.principal, disbursementId, executionRef, msg.sender);
    }

    function recordRepayment(
        uint256 loanId,
        uint256 amount,
        bytes32 executionRef
    )
        external
        override
        whenOperational
        nonReentrant
    {
        Loan storage loan = _requireLoan(loanId);
        if (loan.state != LoanState.Disbursed && loan.state != LoanState.Defaulted) {
            revert LoanNotInState(loanId, loan.state);
        }
        ICommitmentPoolingModule.Pool memory pool = _requirePool(loan.poolId);
        if (msg.sender == loan.borrower) revert BorrowerCannotRecordRepayment(loanId, loan.borrower);
        _requireRecorder(loan.poolId, pool, msg.sender);
        if (loan.rail == LoanRail.GDollarSettlement) revert GDollarRepaymentDisabled(loanId);
        if (amount == 0) revert RepaymentAmountRequired();
        _requireFreshExecutionRef(executionRef);
        uint256 due = loan.principal + loan.feeAmount - loan.repaidAmount;
        if (amount > due) revert RepaymentExceedsBalance(amount, due);

        bool recoveredFromDefault = loan.state == LoanState.Defaulted;
        _executionRefLoan[executionRef] = loanId;
        loan.repaidAmount += amount;
        ++loan.installmentsPaid;
        _borrowerOutstanding[loan.poolId][loan.borrower] -= amount;
        uint256 newOutstanding = due - amount;
        emit RepaymentRecorded(
            loanId, amount, loan.repaidAmount, newOutstanding, loan.installmentsPaid, executionRef, msg.sender
        );
        if (loan.repaidAmount == loan.principal + loan.feeAmount) {
            loan.state = LoanState.Repaid;
            _releaseCommitmentLink(loanId, loan);
            emit LoanRepaid(loanId, recoveredFromDefault, msg.sender);
        }
    }

    function markDefaulted(uint256 loanId, string calldata reasonCID) external override nonReentrant {
        Loan storage loan = _requireLoan(loanId);
        if (loan.state != LoanState.Disbursed) revert LoanNotInState(loanId, loan.state);
        ICommitmentPoolingModule.Pool memory pool = _requirePool(loan.poolId);
        _requirePoolSteward(loan.poolId, pool, msg.sender);
        if (block.timestamp <= loan.dueDate) revert NotDue(loanId, loan.dueDate);
        if (bytes(reasonCID).length == 0) revert ReasonRequired();
        loan.state = LoanState.Defaulted;
        loan.reasonCID = reasonCID;
        emit LoanDefaulted(loanId, reasonCID, msg.sender);
    }

    function cancelLoan(uint256 loanId, string calldata reasonCID) external override nonReentrant {
        Loan storage loan = _requireLoan(loanId);
        if (bytes(reasonCID).length == 0) revert ReasonRequired();
        ICommitmentPoolingModule.Pool memory pool = _requirePool(loan.poolId);
        bool borrowerRequested = msg.sender == loan.borrower && loan.state == LoanState.Requested;
        if (!borrowerRequested) {
            if (msg.sender == loan.borrower && !_hasPoolStewardAuthority(pool, msg.sender)) {
                revert CancellationNotAllowed(loanId, loan.state);
            }
            _requirePoolSteward(loan.poolId, pool, msg.sender);
            if (loan.state == LoanState.Approved) {
                _requireSettlementCancelled(loanId);
                _releaseCap(loanId, loan);
            } else if (loan.state != LoanState.Requested) {
                revert CancellationNotAllowed(loanId, loan.state);
            }
        }
        loan.state = LoanState.Cancelled;
        loan.reasonCID = reasonCID;
        _releaseCommitmentLink(loanId, loan);
        emit LoanCancelled(loanId, reasonCID, msg.sender);
    }

    function setHatsModule(address module) external override onlyOwner onlyWhilePaused {
        if (module == address(0)) revert ZeroAddress();
        _requireNoActiveReservations();
        address previous = hatsModule;
        hatsModule = module;
        emit HatsModuleUpdated(previous, module);
    }

    function setCommitmentPoolingModule(address module) external override onlyOwner onlyWhilePaused {
        if (module == address(0)) revert ZeroAddress();
        address previous = commitmentPoolingModule;
        if (previous == module) return;
        _requireNoActiveReservations();
        if (poolingStateInitialized || nextLoanId != 1) revert CommitmentPoolingModuleLocked();
        commitmentPoolingModule = module;
        emit CommitmentPoolingModuleUpdated(previous, module);
    }

    function setSettlementModule(address module) external override onlyOwner onlyWhilePaused {
        if (module == address(0)) revert ZeroAddress();
        _requireNoActiveReservations();
        address previous = settlementModule;
        if (previous == module) return;
        _validateSettlementModule(module, SettlementBindingRequirement.UnboundOrSelf);
        settlementModule = module;
        emit SettlementModuleUpdated(previous, module);
    }

    function setPaused(bool paused_) external override onlyOwner {
        if (!paused_) {
            if (hatsModule == address(0) || commitmentPoolingModule == address(0) || settlementModule == address(0)) {
                revert ModuleNotReady();
            }
            _validateSettlementModule(settlementModule, SettlementBindingRequirement.Self);
        }
        paused = paused_;
        emit PausedSet(paused_);
    }

    function getLoan(uint256 loanId) external view override returns (Loan memory) {
        Loan memory loan = _loans[loanId];
        if (loan.state == LoanState.None) revert UnknownLoan(loanId);
        return loan;
    }

    function poolCreditConfig(uint256 poolId) external view override returns (PoolCreditConfig memory) {
        return _poolCreditConfig[poolId];
    }

    function outstandingOf(uint256 poolId, address borrower) external view override returns (uint256) {
        return _borrowerOutstanding[poolId][borrower];
    }

    function reservedOutstandingOf(uint256 poolId, address borrower) external view override returns (uint256) {
        return _capReservationState().borrowerReserved[poolId][borrower];
    }

    function isCapReserved(uint256 loanId) external view override returns (bool) {
        return _capReservationState().loanReserved[loanId];
    }

    function activeReservationCount() external view override returns (uint256) {
        return _capReservationState().activeReservations;
    }

    function amountDue(uint256 loanId) external view override returns (uint256) {
        Loan memory loan = _loans[loanId];
        if (loan.state == LoanState.None) revert UnknownLoan(loanId);
        if (loan.state != LoanState.Disbursed && loan.state != LoanState.Defaulted) return 0;
        return loan.principal + loan.feeAmount - loan.repaidAmount;
    }

    function loanOfCommitment(uint256 commitmentId) external view override returns (uint256) {
        return _commitmentLoan[commitmentId];
    }

    function isExecutor(uint256 poolId, address executor) external view override returns (bool) {
        return _executors[poolId][executor];
    }

    function loanOfExecutionRef(bytes32 executionRef) external view override returns (uint256) {
        return _executionRefLoan[executionRef];
    }
}
