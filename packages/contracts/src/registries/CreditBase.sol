// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { ICommitmentPoolingModule } from "../interfaces/ICommitmentPoolingModule.sol";
import { ICreditRegistry } from "../interfaces/ICreditRegistry.sol";
import { IHatsModule } from "../interfaces/IHatsModule.sol";
import { ISettlementModule } from "../interfaces/ISettlementModule.sol";

/// @notice Frozen storage and shared validation for the records-only credit registry.
abstract contract CreditRegistryBase is ICreditRegistry, OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    /// @custom:storage-location erc7201:green.goods.credit.cap-reservation
    struct CapReservationState {
        mapping(uint256 poolId => mapping(address borrower => uint256 amount)) borrowerReserved;
        mapping(uint256 loanId => bool reserved) loanReserved;
        uint256 activeReservations;
    }

    /// @dev ERC-7201: keccak256(abi.encode(uint256(keccak256("green.goods.credit.cap-reservation")) - 1)) & ~0xff.
    bytes32 private constant _CAP_RESERVATION_SLOT = 0x23b460fdce5e0dec5ddb0329bbb3aa6365c3b9ea9e5fe3b44684a4371c4a6400;

    address public override hatsModule;
    address public override commitmentPoolingModule;
    address public override settlementModule;
    uint256 public override nextLoanId;
    mapping(uint256 loanId => Loan loan) internal _loans;
    mapping(uint256 poolId => PoolCreditConfig config) internal _poolCreditConfig;
    mapping(uint256 poolId => mapping(address borrower => uint256 amount)) internal _borrowerOutstanding;
    mapping(uint256 commitmentId => uint256 loanId) internal _commitmentLoan;
    mapping(uint256 poolId => mapping(address executor => bool enabled)) internal _executors;
    mapping(bytes32 executionRef => uint256 loanId) internal _executionRefLoan;
    bool public override paused;
    bool public override poolingStateInitialized;

    /// @dev Twelve named storage entries above plus this 39-slot gap preserve the 50-slot allocation;
    ///      the two trailing booleans share one slot.
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

    function _resolveBorrower(
        uint256 poolId,
        ICommitmentPoolingModule.Pool memory pool,
        address onBehalfOf
    )
        internal
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

    function _validateRequestFacts(RequestLoanParams calldata params, address borrower) internal view {
        if (params.token == address(0)) revert TokenRequired();
        if (params.principal == 0) revert PrincipalRequired();
        if (params.dueDate <= block.timestamp) revert InvalidDueDate(params.dueDate);
        if (bytes(params.termsCID).length == 0) revert TermsRequired();
        _requireBorrowerCap(params.poolId, borrower, params.principal);
        _validateCommitment(params.poolId, params.commitmentId);
    }

    function _requireLoan(uint256 loanId) internal view returns (Loan storage loan) {
        loan = _loans[loanId];
        if (loan.state == LoanState.None) revert UnknownLoan(loanId);
    }

    function _requireFutureDueDate(Loan storage loan) internal view {
        if (loan.dueDate <= block.timestamp) revert InvalidDueDate(loan.dueDate);
    }

    function _requireNoActiveReservations() internal view {
        uint256 activeReservations = _capReservationState().activeReservations;
        if (activeReservations != 0) revert ActiveLoanReservations(activeReservations);
    }

    function _lockPoolingIdentity() internal {
        poolingStateInitialized = true;
    }

    function _requirePool(uint256 poolId) internal view returns (ICommitmentPoolingModule.Pool memory pool) {
        pool = ICommitmentPoolingModule(commitmentPoolingModule).getPool(poolId);
        if (pool.state == ICommitmentPoolingModule.PoolState.None) revert UnknownPool(poolId);
    }

    function _requireOpenEnabledPool(uint256 poolId) internal view returns (ICommitmentPoolingModule.Pool memory pool) {
        pool = _requirePool(poolId);
        if (pool.state != ICommitmentPoolingModule.PoolState.Open) revert PoolNotOpen(poolId);
        if (!_poolCreditConfig[poolId].enabled) revert PoolCreditDisabled(poolId);
    }

    function _requirePoolSteward(
        uint256 poolId,
        ICommitmentPoolingModule.Pool memory pool,
        address account
    )
        internal
        view
    {
        if (!_hasPoolStewardAuthority(pool, account)) revert NotPoolSteward(account, poolId);
    }

    function _hasPoolStewardAuthority(
        ICommitmentPoolingModule.Pool memory pool,
        address account
    )
        internal
        view
        returns (bool)
    {
        return account == owner() || _isGardenSteward(pool.garden, account);
    }

    function _requireRecorder(uint256 poolId, ICommitmentPoolingModule.Pool memory pool, address account) internal view {
        if (account != owner() && !_isGardenSteward(pool.garden, account) && !_executors[poolId][account]) {
            revert UnauthorizedRecorder(account, poolId);
        }
    }

    function _isGardenSteward(address garden, address account) internal view returns (bool) {
        return IHatsModule(hatsModule).isStewardOf(garden, account) || IHatsModule(hatsModule).isOwnerOf(garden, account);
    }

    function _isPoolMember(address garden, address account) internal view returns (bool) {
        IHatsModule hats = IHatsModule(hatsModule);
        return hats.isGardenerOf(garden, account) || hats.isEvaluatorOf(garden, account)
            || hats.isStewardOf(garden, account) || hats.isOwnerOf(garden, account) || hats.isFunderOf(garden, account)
            || hats.isCommunityOf(garden, account);
    }

    function _requireBorrowerCap(uint256 poolId, address borrower, uint256 requested) internal view {
        uint256 cap = _poolCreditConfig[poolId].borrowerCap;
        if (cap == 0) return;
        uint256 committed =
            _borrowerOutstanding[poolId][borrower] + _capReservationState().borrowerReserved[poolId][borrower];
        uint256 available = committed >= cap ? 0 : cap - committed;
        if (requested > available) revert BorrowerCapExceeded(poolId, borrower, requested, available);
    }

    function _requireReservedExposureWithinCap(Loan storage loan) internal view {
        uint256 cap = _poolCreditConfig[loan.poolId].borrowerCap;
        if (cap == 0) return;
        uint256 committed = _borrowerOutstanding[loan.poolId][loan.borrower]
            + _capReservationState().borrowerReserved[loan.poolId][loan.borrower];
        if (committed > cap) {
            revert BorrowerCapExceeded(loan.poolId, loan.borrower, loan.principal + loan.feeAmount, 0);
        }
    }

    function _reserveCap(uint256 loanId, Loan storage loan) internal {
        CapReservationState storage reservations = _capReservationState();
        reservations.loanReserved[loanId] = true;
        reservations.borrowerReserved[loan.poolId][loan.borrower] += loan.principal + loan.feeAmount;
        ++reservations.activeReservations;
    }

    function _releaseCap(uint256 loanId, Loan storage loan) internal {
        CapReservationState storage reservations = _capReservationState();
        if (!reservations.loanReserved[loanId]) revert CapReservationMissing(loanId);
        reservations.loanReserved[loanId] = false;
        reservations.borrowerReserved[loan.poolId][loan.borrower] -= loan.principal + loan.feeAmount;
        --reservations.activeReservations;
    }

    function _requireCapReservation(uint256 loanId) internal view {
        if (!_capReservationState().loanReserved[loanId]) revert CapReservationMissing(loanId);
    }

    function _capReservationState() internal pure returns (CapReservationState storage state) {
        bytes32 slot = _CAP_RESERVATION_SLOT;
        assembly ("memory-safe") {
            state.slot := slot
        }
    }

    function _requireRequestAuthorityStillValid(
        Loan storage loan,
        ICommitmentPoolingModule.Pool memory pool
    )
        internal
        view
    {
        if (!_isPoolMember(pool.garden, loan.borrower)) revert NotPoolMember(loan.borrower, loan.poolId);
        if (loan.requestedBy != loan.borrower) {
            _requirePoolSteward(loan.poolId, pool, loan.requestedBy);
        }
    }

    function _validateCommitment(uint256 poolId, uint256 commitmentId) internal view {
        if (commitmentId == 0) return;
        uint256 existing = _commitmentLoan[commitmentId];
        if (existing != 0) revert CommitmentLoanExists(commitmentId, existing);
        ICommitmentPoolingModule.Commitment memory commitment =
            ICommitmentPoolingModule(commitmentPoolingModule).getCommitment(commitmentId);
        if (commitment.state == ICommitmentPoolingModule.CommitmentState.None) revert UnknownCommitment(commitmentId);
        if (commitment.poolId != poolId) revert CommitmentPoolMismatch(commitmentId, poolId, commitment.poolId);
    }

    function _requireFreshExecutionRef(bytes32 executionRef) internal view {
        if (executionRef == bytes32(0)) revert ExecutionRefRequired();
        uint256 existing = _executionRefLoan[executionRef];
        if (existing != 0) revert ExecutionRefUsed(executionRef, existing);
    }

    function _requireSettlementCancelled(uint256 loanId) internal view {
        ISettlementModule settlement = ISettlementModule(settlementModule);
        uint256 disbursementId = settlement.loanPrincipalDisbursementOf(address(this), loanId);
        if (disbursementId == 0) return;
        ISettlementModule.DisbursementState state = settlement.getDisbursement(disbursementId).state;
        if (state != ISettlementModule.DisbursementState.Cancelled) {
            revert SettlementCancellationRequired(loanId, disbursementId, uint8(state));
        }
    }

    function _requireNoSettlementChild(uint256 loanId) internal view {
        ISettlementModule settlement = ISettlementModule(settlementModule);
        uint256 disbursementId = settlement.loanPrincipalDisbursementOf(address(this), loanId);
        if (disbursementId == 0) return;
        ISettlementModule.DisbursementState state = settlement.getDisbursement(disbursementId).state;
        revert SettlementChildExists(loanId, disbursementId, uint8(state));
    }

    function _validateConfirmedSettlement(
        uint256 loanId,
        Loan storage loan,
        ICommitmentPoolingModule.Pool memory pool,
        bytes32 executionRef
    )
        internal
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
