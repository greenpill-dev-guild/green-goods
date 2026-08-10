// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { ICommitmentPoolingModule } from "../interfaces/ICommitmentPoolingModule.sol";
import { ICreditRegistry } from "../interfaces/ICreditRegistry.sol";
import { IHatsModule } from "../interfaces/IHatsModule.sol";
import { ISettlementModule } from "../interfaces/ISettlementModule.sol";

/// @title CreditRegistry
/// @notice Pool-scoped, records-only control plane for interest-free advances and repayments.
/// @dev This contract never receives, approves, holds, or transfers funds.
contract CreditRegistry is ICreditRegistry, OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    address public override hatsModule;
    address public override commitmentPoolingModule;
    address public override settlementModule;
    uint256 public override nextLoanId;
    mapping(uint256 loanId => Loan loan) private _loans;
    mapping(uint256 poolId => PoolCreditConfig config) private _poolCreditConfig;
    mapping(uint256 poolId => mapping(address borrower => uint256 amount)) private _borrowerOutstanding;
    mapping(uint256 commitmentId => uint256 loanId) private _commitmentLoan;
    mapping(uint256 poolId => mapping(address executor => bool enabled)) private _executors;
    mapping(bytes32 executionRef => uint256 loanId) private _executionRefLoan;
    bool public override paused;

    /// @dev Eleven named storage entries above plus this 39-slot gap equals 50 custom entries.
    ///      Inherited upgradeable contracts maintain their own layouts independently.
    uint256[39] private __gap;

    modifier whenOperational() {
        if (paused) revert ModulePaused();
        _;
    }

    modifier onlyWhilePaused() {
        if (!paused) revert ModuleMustBePaused();
        _;
    }

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
        uint256 borrowerCap,
        bool enabled
    )
        external
        override
        whenOperational
        nonReentrant
    {
        ICommitmentPoolingModule.Pool memory pool = _requirePool(poolId);
        _requirePoolSteward(poolId, pool, msg.sender);
        PoolCreditConfig memory previous = _poolCreditConfig[poolId];
        _poolCreditConfig[poolId] = PoolCreditConfig({ borrowerCap: borrowerCap, enabled: enabled });
        emit PoolCreditConfigured(poolId, previous.borrowerCap, borrowerCap, previous.enabled, enabled, msg.sender);
    }

    function addExecutor(uint256 poolId, address executor) external override whenOperational nonReentrant {
        if (executor == address(0)) revert ZeroAddress();
        ICommitmentPoolingModule.Pool memory pool = _requirePool(poolId);
        _requirePoolSteward(poolId, pool, msg.sender);
        _executors[poolId][executor] = true;
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

    function _resolveBorrower(
        uint256 poolId,
        ICommitmentPoolingModule.Pool memory pool,
        address onBehalfOf
    )
        private
        view
        returns (address borrower)
    {
        borrower = onBehalfOf == address(0) ? msg.sender : onBehalfOf;
        if (borrower == address(0)) revert ZeroAddress();
        if (onBehalfOf != address(0)) {
            if (onBehalfOf == msg.sender) revert InvalidOnBehalfOf(msg.sender);
            _requirePoolSteward(poolId, pool, msg.sender);
        }
        if (!_isPoolMember(pool.garden, borrower)) revert NotPoolMember(borrower, poolId);
    }

    function _validateRequestFacts(RequestLoanParams calldata params, address borrower) private view {
        if (params.token == address(0)) revert TokenRequired();
        if (params.principal == 0) revert PrincipalRequired();
        if (params.dueDate <= block.timestamp) revert InvalidDueDate(params.dueDate);
        if (bytes(params.termsCID).length == 0) revert TermsRequired();
        _requireBorrowerCap(params.poolId, borrower, params.principal);
        _validateCommitment(params.poolId, params.commitmentId);
    }

    function approveLoan(uint256 loanId) external override whenOperational nonReentrant {
        Loan storage loan = _requireLoan(loanId);
        if (loan.state != LoanState.Requested) revert LoanNotInState(loanId, loan.state);
        ICommitmentPoolingModule.Pool memory pool = _requireOpenEnabledPool(loan.poolId);
        _requirePoolSteward(loan.poolId, pool, msg.sender);
        if (msg.sender == loan.borrower) revert SelfApproval(loanId, loan.borrower);
        _requireBorrowerCap(loan.poolId, loan.borrower, loan.principal + loan.feeAmount);
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
        ICommitmentPoolingModule.Pool memory pool = _requireOpenEnabledPool(loan.poolId);
        _requireRecorder(loan.poolId, pool, msg.sender);
        _requireBorrowerCap(loan.poolId, loan.borrower, loan.principal + loan.feeAmount);
        if (rail == LoanRail.None) revert InvalidRail(rail);
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
        uint256 newOutstanding = _borrowerOutstanding[loan.poolId][loan.borrower];
        emit RepaymentRecorded(
            loanId, amount, loan.repaidAmount, newOutstanding, loan.installmentsPaid, executionRef, msg.sender
        );
        if (loan.repaidAmount == loan.principal + loan.feeAmount) {
            loan.state = LoanState.Repaid;
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
        if (msg.sender == loan.borrower) {
            if (loan.state != LoanState.Requested) revert CancellationNotAllowed(loanId, loan.state);
        } else {
            _requirePoolSteward(loan.poolId, pool, msg.sender);
            if (loan.state != LoanState.Requested && loan.state != LoanState.Approved) {
                revert CancellationNotAllowed(loanId, loan.state);
            }
        }
        loan.state = LoanState.Cancelled;
        loan.reasonCID = reasonCID;
        if (loan.commitmentId != 0 && _commitmentLoan[loan.commitmentId] == loanId) {
            delete _commitmentLoan[loan.commitmentId];
        }
        emit LoanCancelled(loanId, reasonCID, msg.sender);
    }

    function setHatsModule(address module) external override onlyOwner onlyWhilePaused {
        if (module == address(0)) revert ZeroAddress();
        address previous = hatsModule;
        hatsModule = module;
        emit HatsModuleUpdated(previous, module);
    }

    function setCommitmentPoolingModule(address module) external override onlyOwner onlyWhilePaused {
        if (module == address(0)) revert ZeroAddress();
        address previous = commitmentPoolingModule;
        commitmentPoolingModule = module;
        emit CommitmentPoolingModuleUpdated(previous, module);
    }

    function setSettlementModule(address module) external override onlyOwner onlyWhilePaused {
        if (module == address(0)) revert ZeroAddress();
        address previous = settlementModule;
        settlementModule = module;
        emit SettlementModuleUpdated(previous, module);
    }

    function setPaused(bool paused_) external override onlyOwner {
        if (!paused_) {
            if (hatsModule == address(0) || commitmentPoolingModule == address(0) || settlementModule == address(0)) {
                revert ModuleNotReady();
            }
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

    function amountDue(uint256 loanId) external view override returns (uint256) {
        Loan memory loan = _loans[loanId];
        if (loan.state == LoanState.None) revert UnknownLoan(loanId);
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

    function _requireLoan(uint256 loanId) private view returns (Loan storage loan) {
        loan = _loans[loanId];
        if (loan.state == LoanState.None) revert UnknownLoan(loanId);
    }

    function _requirePool(uint256 poolId) private view returns (ICommitmentPoolingModule.Pool memory pool) {
        pool = ICommitmentPoolingModule(commitmentPoolingModule).getPool(poolId);
        if (pool.state == ICommitmentPoolingModule.PoolState.None) revert UnknownPool(poolId);
    }

    function _requireOpenEnabledPool(uint256 poolId) private view returns (ICommitmentPoolingModule.Pool memory pool) {
        pool = _requirePool(poolId);
        if (pool.state != ICommitmentPoolingModule.PoolState.Open) revert PoolNotOpen(poolId);
        if (!_poolCreditConfig[poolId].enabled) revert PoolCreditDisabled(poolId);
    }

    function _requirePoolSteward(uint256 poolId, ICommitmentPoolingModule.Pool memory pool, address account) private view {
        if (account != owner() && !_isGardenSteward(pool.garden, account)) revert NotPoolSteward(account, poolId);
    }

    function _requireRecorder(uint256 poolId, ICommitmentPoolingModule.Pool memory pool, address account) private view {
        if (account != owner() && !_isGardenSteward(pool.garden, account) && !_executors[poolId][account]) {
            revert UnauthorizedRecorder(account, poolId);
        }
    }

    function _isGardenSteward(address garden, address account) private view returns (bool) {
        return IHatsModule(hatsModule).isStewardOf(garden, account) || IHatsModule(hatsModule).isOwnerOf(garden, account);
    }

    function _isPoolMember(address garden, address account) private view returns (bool) {
        IHatsModule hats = IHatsModule(hatsModule);
        return hats.isGardenerOf(garden, account) || hats.isEvaluatorOf(garden, account)
            || hats.isStewardOf(garden, account) || hats.isOwnerOf(garden, account) || hats.isFunderOf(garden, account)
            || hats.isCommunityOf(garden, account);
    }

    function _requireBorrowerCap(uint256 poolId, address borrower, uint256 requested) private view {
        uint256 cap = _poolCreditConfig[poolId].borrowerCap;
        if (cap == 0) return;
        uint256 outstanding = _borrowerOutstanding[poolId][borrower];
        uint256 available = outstanding >= cap ? 0 : cap - outstanding;
        if (requested > available) revert BorrowerCapExceeded(poolId, borrower, requested, available);
    }

    function _validateCommitment(uint256 poolId, uint256 commitmentId) private view {
        if (commitmentId == 0) return;
        uint256 existing = _commitmentLoan[commitmentId];
        if (existing != 0) revert CommitmentLoanExists(commitmentId, existing);
        ICommitmentPoolingModule.Commitment memory commitment =
            ICommitmentPoolingModule(commitmentPoolingModule).getCommitment(commitmentId);
        if (commitment.state == ICommitmentPoolingModule.CommitmentState.None) revert UnknownCommitment(commitmentId);
        if (commitment.poolId != poolId) revert CommitmentPoolMismatch(commitmentId, poolId, commitment.poolId);
    }

    function _requireFreshExecutionRef(bytes32 executionRef) private view {
        if (executionRef == bytes32(0)) revert ExecutionRefRequired();
        uint256 existing = _executionRefLoan[executionRef];
        if (existing != 0) revert ExecutionRefUsed(executionRef, existing);
    }

    function _validateConfirmedSettlement(
        uint256 loanId,
        Loan storage loan,
        ICommitmentPoolingModule.Pool memory pool,
        bytes32 executionRef
    )
        private
        view
        returns (uint256 disbursementId, uint32 attempts)
    {
        ISettlementModule settlement = ISettlementModule(settlementModule);
        if (
            settlement.creditRegistry() != address(this) || settlement.commitmentPoolingModule() != commitmentPoolingModule
                || settlement.gDollarToken() != loan.token
        ) revert SettlementRelationshipMissing(loanId);
        disbursementId = settlement.loanPrincipalDisbursementOf(address(this), loanId);
        if (disbursementId == 0) revert SettlementRelationshipMissing(loanId);
        ISettlementModule.Disbursement memory disbursement = settlement.getDisbursement(disbursementId);
        ISettlementModule.LoanPrincipalRelationship memory relationship =
            settlement.loanPrincipalRelationshipOf(disbursementId);
        if (disbursement.state != ISettlementModule.DisbursementState.Confirmed) {
            revert SettlementNotConfirmed(loanId, disbursementId);
        }
        if (
            relationship.creditRegistry != address(this) || relationship.loanId != loanId
                || disbursement.kind != ISettlementModule.DisbursementKind.LoanPrincipal
                || disbursement.fundingRoute != ISettlementModule.FundingRoute.None || disbursement.commitmentId != 0
                || disbursement.payoutPlanId != 0 || disbursement.contributor != address(0)
                || disbursement.garden != pool.garden || disbursement.executorGarden != pool.garden
                || disbursement.recipient != loan.borrower || disbursement.token != loan.token
                || disbursement.amount != loan.principal
        ) revert SettlementDisbursementMismatch(loanId, disbursementId);
        bytes32 expectedRef = keccak256(abi.encode(disbursement.executionKey, disbursementId));
        if (executionRef != expectedRef) revert SettlementDisbursementMismatch(loanId, disbursementId);
        attempts = disbursement.attempt;
    }

    function _authorizeUpgrade(address) internal view override onlyOwner {
        if (!paused) revert ModuleMustBePaused();
    }
}
