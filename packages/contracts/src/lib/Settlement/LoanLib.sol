// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { ICreditRegistry } from "../../interfaces/ICreditRegistry.sol";
import { IHatsModule } from "../../interfaces/IHatsModule.sol";
import { ISettlementModule } from "../../interfaces/ISettlementModule.sol";

/// @notice Loan-principal queue and dispatch-time validation for the settlement source.
/// @dev Public queue behavior executes by DELEGATECALL so rows stay in SettlementModule storage.
library SettlementLoanLib {
    /// @custom:storage-location erc7201:green.goods.settlement.loan
    struct State {
        address creditRegistry;
        mapping(bytes32 loanKey => uint256 disbursementId) disbursements;
        mapping(uint256 disbursementId => ISettlementModule.LoanPrincipalRelationship relationship) relationships;
    }

    bytes32 private constant _STATE_SLOT = 0x2aef4a87d3aface1caef72fa48982eb32bb7507678ff5765bb7bf02a13c0f400;

    struct RuntimeConfig {
        address hatsModule;
        address poolingModule;
        address creditRegistry;
        address gDollarToken;
        uint64 destinationEvmChainId;
    }

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
    event CreditRegistryUpdated(address indexed previousRegistry, address indexed newRegistry);

    function setCreditRegistry(address registry) public {
        if (registry == address(0)) revert ISettlementModule.ZeroAddress();
        State storage state = _state();
        address previous = state.creditRegistry;
        if (previous == registry) return;
        state.creditRegistry = registry;
        emit CreditRegistryUpdated(previous, registry);
    }

    function queueLoanPrincipal(
        mapping(uint256 disbursementId => ISettlementModule.Disbursement disbursement) storage disbursements,
        uint256 nextDisbursementId,
        uint256 loanId
    )
        public
        returns (uint256 disbursementId, bool created)
    {
        State storage state = _state();
        RuntimeConfig memory config = _runtimeConfig();
        if (config.creditRegistry == address(0)) revert ISettlementModule.CreditRegistryRequired();
        ICreditRegistry registry = ICreditRegistry(config.creditRegistry);
        ICreditRegistry.Loan memory loan = registry.getLoan(loanId);
        ICommitmentPoolingModule.Pool memory pool = _pool(config.poolingModule, loan.poolId);
        if (!_isSteward(config.hatsModule, pool.garden, msg.sender)) {
            revert ISettlementModule.NotSettlementSteward(msg.sender, pool.garden);
        }

        bytes32 key = loanKey(config.creditRegistry, loanId);
        disbursementId = state.disbursements[key];
        if (disbursementId != 0) return (disbursementId, false);
        if (ISettlementModule(address(this)).paused()) revert ISettlementModule.SourceMustBePaused();

        ISettlementModule.SettlementAccount memory sourceAccount = _validateLoan(config, loanId, loan, pool);
        disbursementId = nextDisbursementId;
        disbursements[disbursementId] = ISettlementModule.Disbursement({
            commitmentId: 0,
            payoutPlanId: 0,
            contributor: address(0),
            garden: pool.garden,
            executorGarden: pool.garden,
            kind: ISettlementModule.DisbursementKind.LoanPrincipal,
            fundingRoute: ISettlementModule.FundingRoute.None,
            source: sourceAccount.account,
            recipient: loan.borrower,
            token: config.gDollarToken,
            amount: loan.principal,
            state: ISettlementModule.DisbursementState.Queued,
            batchId: 0,
            reasonCID: "",
            attempt: 0,
            executionKey: bytes32(0),
            commandMessageId: bytes32(0),
            dispatchedAt: 0,
            confirmedAt: 0,
            acknowledgmentMessageId: bytes32(0),
            failureCode: 0,
            cancelledFromState: ISettlementModule.DisbursementState.None
        });
        state.disbursements[key] = disbursementId;
        state.relationships[disbursementId] =
            ISettlementModule.LoanPrincipalRelationship({ creditRegistry: config.creditRegistry, loanId: loanId });
        _emitQueued(disbursementId, disbursements[disbursementId]);
        emit LoanPrincipalQueued(disbursementId, config.creditRegistry, loanId);
        created = true;
    }

    function recheckLoanPrincipal(
        ISettlementModule.Disbursement storage disbursement,
        uint256 disbursementId
    )
        internal
        view
    {
        RuntimeConfig memory config = _runtimeConfig();
        State storage state = _state();
        ISettlementModule.LoanPrincipalRelationship memory relationship = state.relationships[disbursementId];
        if (relationship.creditRegistry != config.creditRegistry || config.creditRegistry == address(0)) {
            revert ISettlementModule.LoanPrincipalMismatch(relationship.loanId, disbursementId);
        }
        if (state.disbursements[loanKey(relationship.creditRegistry, relationship.loanId)] != disbursementId) {
            revert ISettlementModule.LoanPrincipalMismatch(relationship.loanId, disbursementId);
        }
        ICreditRegistry.Loan memory loan = ICreditRegistry(relationship.creditRegistry).getLoan(relationship.loanId);
        ICommitmentPoolingModule.Pool memory pool = _pool(config.poolingModule, loan.poolId);
        ISettlementModule.SettlementAccount memory sourceAccount = _validateLoan(config, relationship.loanId, loan, pool);
        if (
            disbursement.commitmentId != 0 || disbursement.payoutPlanId != 0 || disbursement.contributor != address(0)
                || disbursement.garden != pool.garden || disbursement.executorGarden != pool.garden
                || disbursement.source != sourceAccount.account || disbursement.recipient != loan.borrower
                || disbursement.token != config.gDollarToken || disbursement.amount != loan.principal
                || disbursement.fundingRoute != ISettlementModule.FundingRoute.None
        ) revert ISettlementModule.LoanPrincipalMismatch(relationship.loanId, disbursementId);
    }

    function loanKey(address registry, uint256 loanId) internal pure returns (bytes32) {
        return keccak256(abi.encode(registry, loanId));
    }

    function configuredCreditRegistry() internal view returns (address) {
        return _state().creditRegistry;
    }

    function loanPrincipalDisbursementOf(address registry, uint256 loanId) internal view returns (uint256) {
        return _state().disbursements[loanKey(registry, loanId)];
    }

    function loanPrincipalRelationshipOf(uint256 disbursementId)
        internal
        view
        returns (ISettlementModule.LoanPrincipalRelationship memory)
    {
        return _state().relationships[disbursementId];
    }

    function _state() private pure returns (State storage state) {
        bytes32 slot = _STATE_SLOT;
        assembly ("memory-safe") {
            state.slot := slot
        }
    }

    function _runtimeConfig() private view returns (RuntimeConfig memory config) {
        ISettlementModule module = ISettlementModule(address(this));
        config.hatsModule = module.hatsModule();
        config.poolingModule = module.commitmentPoolingModule();
        config.creditRegistry = _state().creditRegistry;
        config.gDollarToken = module.gDollarToken();
        config.destinationEvmChainId = module.DESTINATION_EVM_CHAIN_ID();
    }

    function _emitQueued(uint256 disbursementId, ISettlementModule.Disbursement storage disbursement) private {
        emit DisbursementQueued(
            disbursementId,
            disbursement.commitmentId,
            disbursement.garden,
            disbursement.payoutPlanId,
            disbursement.contributor,
            disbursement.executorGarden,
            uint8(disbursement.kind),
            uint8(disbursement.fundingRoute),
            disbursement.source,
            disbursement.recipient,
            disbursement.token,
            disbursement.amount
        );
    }

    function _validateLoan(
        RuntimeConfig memory config,
        uint256 loanId,
        ICreditRegistry.Loan memory loan,
        ICommitmentPoolingModule.Pool memory pool
    )
        private
        view
        returns (ISettlementModule.SettlementAccount memory account)
    {
        ICreditRegistry registry = ICreditRegistry(config.creditRegistry);
        _validateRegistryIdentity(config, loanId, registry);
        _validateLoanRecord(config, loanId, loan, pool, registry);
        _validateBorrowerCap(loanId, loan, registry);
        account = _validatedSourceAccount(config, pool.garden, loan.borrower);
    }

    function _validateRegistryIdentity(
        RuntimeConfig memory config,
        uint256 loanId,
        ICreditRegistry registry
    )
        private
        view
    {
        if (
            registry.settlementModule() != address(this) || registry.commitmentPoolingModule() != config.poolingModule
                || registry.hatsModule() != config.hatsModule
        ) revert ISettlementModule.LoanPrincipalMismatch(loanId, 0);
    }

    function _validateLoanRecord(
        RuntimeConfig memory config,
        uint256 loanId,
        ICreditRegistry.Loan memory loan,
        ICommitmentPoolingModule.Pool memory pool,
        ICreditRegistry registry
    )
        private
        view
    {
        if (loan.state != ICreditRegistry.LoanState.Approved) {
            revert ISettlementModule.LoanPrincipalNotApproved(loanId, uint8(loan.state));
        }
        if (
            loan.borrower == address(0) || loan.token != config.gDollarToken || loan.principal == 0 || loan.feeAmount != 0
                || loan.rail != ICreditRegistry.LoanRail.None || loan.disbursementId != 0
        ) revert ISettlementModule.LoanPrincipalMismatch(loanId, 0);
        if (pool.state != ICommitmentPoolingModule.PoolState.Open) {
            revert ISettlementModule.LoanPrincipalNotApproved(loanId, uint8(loan.state));
        }
        ICreditRegistry.PoolCreditConfig memory creditConfig = registry.poolCreditConfig(loan.poolId);
        if (!creditConfig.enabled) revert ISettlementModule.LoanPrincipalNotApproved(loanId, uint8(loan.state));
    }

    function _validateBorrowerCap(
        uint256 loanId,
        ICreditRegistry.Loan memory loan,
        ICreditRegistry registry
    )
        private
        view
    {
        ICreditRegistry.PoolCreditConfig memory creditConfig = registry.poolCreditConfig(loan.poolId);
        if (!registry.isCapReserved(loanId)) revert ISettlementModule.LoanPrincipalMismatch(loanId, 0);
        if (creditConfig.borrowerCap != 0) {
            uint256 outstanding = registry.outstandingOf(loan.poolId, loan.borrower);
            uint256 reserved = registry.reservedOutstandingOf(loan.poolId, loan.borrower);
            uint256 committed = outstanding + reserved;
            uint256 available = committed >= creditConfig.borrowerCap ? 0 : creditConfig.borrowerCap - committed;
            if (committed > creditConfig.borrowerCap) {
                revert ISettlementModule.LoanPrincipalCapExceeded(loanId, loan.principal, available);
            }
        }
    }

    function _validatedSourceAccount(
        RuntimeConfig memory config,
        address garden,
        address borrower
    )
        private
        view
        returns (ISettlementModule.SettlementAccount memory account)
    {
        account = ISettlementModule(address(this)).settlementAccountOf(garden);
        if (account.account == address(0)) revert ISettlementModule.UnknownSettlementAccount(garden);
        if (!account.active) revert ISettlementModule.SettlementAccountInactive(garden);
        if (account.chainId != config.destinationEvmChainId) {
            revert ISettlementModule.InvalidSettlementChain(account.chainId);
        }
        if (borrower == account.account) revert ISettlementModule.InvalidPayoutVector();
    }

    function _pool(
        address poolingModule,
        uint256 poolId
    )
        private
        view
        returns (ICommitmentPoolingModule.Pool memory pool)
    {
        pool = ICommitmentPoolingModule(poolingModule).getPool(poolId);
        if (pool.state == ICommitmentPoolingModule.PoolState.None) {
            revert ISettlementModule.LoanPrincipalMismatch(0, 0);
        }
    }

    function _isSteward(address hatsModule, address garden, address account) private view returns (bool) {
        return IHatsModule(hatsModule).isStewardOf(garden, account) || IHatsModule(hatsModule).isOwnerOf(garden, account);
    }
}
