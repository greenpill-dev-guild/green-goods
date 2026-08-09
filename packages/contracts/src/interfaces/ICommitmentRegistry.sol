// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title ICommitmentRegistry
/// @notice Non-transferable ERC-1155-style unit accounting for commitment
///         pooling. No transfer, no approval, no custody: balances move only
///         through the CommitmentPoolingModule. Grounded in the Grassroots
///         Economics register grammar (curation, limiting, valuing); valuing
///         is reserved for the transferable-voucher settlement layer.
interface ICommitmentRegistry {
    // ═════════════════════════════ Types ═════════════════════════════

    enum AccountingState {
        Registered,
        Committed,
        Released,
        Fulfilled
    }

    struct CommitmentClass {
        uint256 poolId;
        uint256 cycleId; // 0 = cycle-less; emitted so indexers never infer it
        string unitLabel;
        uint256 quota; // LIMITING: hard cap on committed units for this class
        uint256 totalCommitted; // live open exposure for this class
        uint256 totalFulfilled;
        AccountingState accountingState; // exact single-shot slot lifecycle
        bool exists;
    }

    // ═════════════════════════════ Events ════════════════════════════

    event ModuleUpdated(address indexed oldModule, address indexed newModule);
    event ClassRegistered(
        uint256 indexed classId, uint256 indexed poolId, uint256 cycleId, string unitLabel, uint256 quota
    );
    event ProviderOpenCommitmentCapUpdated(uint256 indexed poolId, uint256 cap);
    event UnitsCommitted(
        uint256 indexed classId,
        uint256 indexed poolId,
        address indexed account,
        uint256 cycleId,
        string unitLabel,
        uint256 units,
        uint256 totalCommitted
    );
    event UnitsReleased(
        uint256 indexed classId,
        uint256 indexed poolId,
        address indexed account,
        uint256 cycleId,
        string unitLabel,
        uint256 units,
        uint256 totalCommitted
    );
    event UnitsFulfilled(
        uint256 indexed classId,
        uint256 indexed poolId,
        address indexed account,
        uint256 cycleId,
        string unitLabel,
        uint256 units,
        uint256 totalFulfilled
    );

    // ═════════════════════════════ Errors ════════════════════════════

    error NotModule(address caller);
    error ModuleMustBePaused(address currentModule);
    error ZeroAddress();
    error UnitLabelRequired();
    error QuotaRequired();
    error OpenCommitmentCapRequired(uint256 poolId);
    error ClassAlreadyRegistered(uint256 classId);
    error UnknownClass(uint256 classId);
    error ClassAccountingStateMismatch(uint256 classId, AccountingState expected, AccountingState actual);
    error InvalidUnitAmount(uint256 classId, uint256 requested, uint256 expected);
    error QuotaExceeded(uint256 classId, uint256 requested, uint256 available);
    error OpenCommitmentCapExceeded(uint256 poolId, address account, uint256 requestedCount, uint256 availableCount);
    error InsufficientCommitted(uint256 classId, address account, uint256 requested, uint256 available);

    // ══════════════════════ Mutations (onlyModule) ═══════════════════

    function registerClass(
        uint256 classId,
        uint256 poolId,
        uint256 cycleId,
        string calldata unitLabel,
        uint256 quota
    )
        external;
    /// @notice Sets the non-zero concurrent commitment-count cap for a pool.
    ///         An authorized zero value reverts OpenCommitmentCapRequired(poolId)
    ///         before event emission or storage mutation.
    function setProviderOpenCommitmentCap(uint256 poolId, uint256 cap) external;

    /// @notice Provider-capacity reservation: from Registered only, records
    ///         the full non-zero class quota and consumes one provider
    ///         open-commitment slot. The module calls at Offer creation or
    ///         Request acceptance; this function does not imply claim state.
    function commitUnits(uint256 classId, address account, uint256 units) external;

    /// @notice Cancel/expire: from Committed only, releases the full non-zero
    ///         committed balance and one open slot, then becomes terminal.
    function releaseUnits(uint256 classId, address account, uint256 units) external;

    /// @notice Fulfillment: from Committed only, converts the full non-zero
    ///         committed balance and releases one open slot, then becomes terminal.
    function fulfillUnits(uint256 classId, address account, uint256 units) external;

    // ══════════════════════ Views ════════════════════════════════════

    function getClass(uint256 classId) external view returns (CommitmentClass memory);
    function committedOf(address account, uint256 classId) external view returns (uint256);
    function fulfilledOf(address account, uint256 classId) external view returns (uint256);
    function openCommitmentCountOf(uint256 poolId, address account) external view returns (uint256);
    function providerOpenCommitmentCapOf(uint256 poolId) external view returns (uint256);

    // ══════════════════════ Admin (owner) ════════════════════════════

    function setModule(address module) external;

    // Deliberately absent: transferFrom, safeTransferFrom, setApprovalForAll,
    // balanceOfBatch, any ERC-1155 receiver hooks. Non-transferable by
    // construction; adding a transfer surface is a spec violation.
}
