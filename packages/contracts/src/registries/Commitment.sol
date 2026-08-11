// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { ICommitmentPoolingModule } from "../interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentRegistry } from "../interfaces/ICommitmentRegistry.sol";

/// @title CommitmentRegistry
/// @notice Non-transferable commitment-unit and provider-capacity accounting.
contract CommitmentRegistry is ICommitmentRegistry, OwnableUpgradeable, UUPSUpgradeable {
    address public module;
    mapping(uint256 classId => CommitmentClass class_) private classes;
    mapping(address account => mapping(uint256 classId => uint256 balance)) private committedBalance;
    mapping(address account => mapping(uint256 classId => uint256 balance)) private fulfilledBalance;
    mapping(uint256 poolId => uint256 cap) private providerOpenCommitmentCap;
    mapping(uint256 poolId => mapping(address account => uint256 count)) private providerOpenCommitmentCount;

    /// @dev Declares six named storage entries above and reserves 44 more here (50 total).
    uint256[44] private __gap;

    modifier onlyModule() {
        if (msg.sender != module) revert NotModule(msg.sender);
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_, address module_) external initializer {
        if (owner_ == address(0)) revert ZeroAddress();
        __Ownable_init();
        _transferOwnership(owner_);
        module = module_;
    }

    function registerClass(
        uint256 classId,
        uint256 poolId,
        uint256 cycleId,
        string calldata unitLabel,
        uint256 quota
    )
        external
        onlyModule
    {
        if (bytes(unitLabel).length == 0) revert UnitLabelRequired();
        if (quota == 0) revert QuotaRequired();
        if (classes[classId].exists) revert ClassAlreadyRegistered(classId);

        classes[classId] = CommitmentClass({
            poolId: poolId,
            cycleId: cycleId,
            unitLabel: unitLabel,
            quota: quota,
            totalCommitted: 0,
            totalFulfilled: 0,
            accountingState: AccountingState.Registered,
            exists: true
        });
        emit ClassRegistered(classId, poolId, cycleId, unitLabel, quota);
    }

    function setProviderOpenCommitmentCap(uint256 poolId, uint256 cap) external onlyModule {
        if (cap == 0) revert OpenCommitmentCapRequired(poolId);
        providerOpenCommitmentCap[poolId] = cap;
        emit ProviderOpenCommitmentCapUpdated(poolId, cap);
    }

    function commitUnits(uint256 classId, address account, uint256 units) external onlyModule {
        CommitmentClass storage class_ = _requireClass(classId);
        _requireAccountingState(classId, class_, AccountingState.Registered);
        _requireExactUnits(classId, units, class_.quota);

        uint256 cap = providerOpenCommitmentCap[class_.poolId];
        if (cap == 0) revert OpenCommitmentCapRequired(class_.poolId);
        uint256 currentCount = providerOpenCommitmentCount[class_.poolId][account];
        if (currentCount >= cap) {
            revert OpenCommitmentCapExceeded(class_.poolId, account, 1, 0);
        }

        committedBalance[account][classId] = units;
        class_.totalCommitted = units;
        class_.accountingState = AccountingState.Committed;
        providerOpenCommitmentCount[class_.poolId][account] = currentCount + 1;

        emit UnitsCommitted(classId, class_.poolId, account, class_.cycleId, class_.unitLabel, units, class_.totalCommitted);
    }

    function releaseUnits(uint256 classId, address account, uint256 units) external onlyModule {
        CommitmentClass storage class_ = _requireClass(classId);
        _requireAccountingState(classId, class_, AccountingState.Committed);
        uint256 committed = committedBalance[account][classId];
        _requireExactUnits(classId, units, committed);

        committedBalance[account][classId] = 0;
        class_.totalCommitted -= units;
        class_.accountingState = AccountingState.Released;
        providerOpenCommitmentCount[class_.poolId][account] -= 1;

        emit UnitsReleased(classId, class_.poolId, account, class_.cycleId, class_.unitLabel, units, class_.totalCommitted);
    }

    function fulfillUnits(uint256 classId, address account, uint256 units) external onlyModule {
        CommitmentClass storage class_ = _requireClass(classId);
        _requireAccountingState(classId, class_, AccountingState.Committed);
        uint256 committed = committedBalance[account][classId];
        _requireExactUnits(classId, units, committed);

        committedBalance[account][classId] = 0;
        fulfilledBalance[account][classId] = units;
        class_.totalCommitted -= units;
        class_.totalFulfilled = units;
        class_.accountingState = AccountingState.Fulfilled;
        providerOpenCommitmentCount[class_.poolId][account] -= 1;

        emit UnitsFulfilled(classId, class_.poolId, account, class_.cycleId, class_.unitLabel, units, class_.totalFulfilled);
    }

    function getClass(uint256 classId) external view returns (CommitmentClass memory) {
        CommitmentClass storage class_ = _requireClass(classId);
        return class_;
    }

    function committedOf(address account, uint256 classId) external view returns (uint256) {
        return committedBalance[account][classId];
    }

    function fulfilledOf(address account, uint256 classId) external view returns (uint256) {
        return fulfilledBalance[account][classId];
    }

    function openCommitmentCountOf(uint256 poolId, address account) external view returns (uint256) {
        return providerOpenCommitmentCount[poolId][account];
    }

    function providerOpenCommitmentCapOf(uint256 poolId) external view returns (uint256) {
        return providerOpenCommitmentCap[poolId];
    }

    function setModule(address module_) external onlyOwner {
        if (module_ == address(0)) revert ZeroAddress();
        address currentModule = module;
        if (currentModule != address(0) && !ICommitmentPoolingModule(currentModule).paused()) {
            revert ModuleMustBePaused(currentModule);
        }

        module = module_;
        emit ModuleUpdated(currentModule, module_);
    }

    function _requireClass(uint256 classId) private view returns (CommitmentClass storage class_) {
        class_ = classes[classId];
        if (!class_.exists) revert UnknownClass(classId);
    }

    function _requireAccountingState(
        uint256 classId,
        CommitmentClass storage class_,
        AccountingState expected
    )
        private
        view
    {
        if (class_.accountingState != expected) {
            revert ClassAccountingStateMismatch(classId, expected, class_.accountingState);
        }
    }

    function _requireExactUnits(uint256 classId, uint256 requested, uint256 expected) private pure {
        if (requested == 0 || requested != expected) revert InvalidUnitAmount(classId, requested, expected);
    }

    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address) internal override onlyOwner { }
}
