// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { SettlementConfigurationLib } from "../../lib/Settlement/ConfigurationLib.sol";
import { SettlementLoanLib } from "../../lib/Settlement/LoanLib.sol";
import { ICreditRegistry } from "../../interfaces/ICreditRegistry.sol";
import { SettlementBase } from "./Base.sol";

/// @title SettlementAdmin
/// @notice Paused-first configuration surface: route, limits, modules, and account registry.
abstract contract SettlementAdmin is SettlementBase {
    function setCcipRoute(
        uint64 destinationChainSelector,
        address destinationExecutor,
        uint32 destinationGasLimit,
        uint8 protocolVersion,
        uint64 previousPeerGraceSeconds
    )
        external
        override
        onlyOwner
    {
        _requirePaused();
        SettlementConfigurationLib.setCcipRoute(
            _ccipRoute,
            destinationChainSelector,
            destinationExecutor,
            destinationGasLimit,
            protocolVersion,
            previousPeerGraceSeconds
        );
    }

    function setBatchSizeLimit(uint16 limit) external override onlyOwner {
        _requirePaused();
        if (limit > _HARD_MAX_BATCH_SIZE) revert BatchSizeOutOfBounds(limit, _HARD_MAX_BATCH_SIZE);
        uint16 previous = batchSizeLimit;
        batchSizeLimit = limit;
        emit BatchSizeLimitUpdated(previous, limit);
    }

    function setDispatcher(address dispatcher_) external override onlyOwner {
        _requirePaused();
        address previous = dispatcher;
        dispatcher = dispatcher_;
        emit DispatcherUpdated(previous, dispatcher_);
    }

    function setFeeReserveMinimum(uint256 minimum) external override onlyOwner {
        _requirePaused();
        uint256 previous = feeReserveMinimum;
        feeReserveMinimum = minimum;
        emit FeeReserveMinimumUpdated(previous, minimum);
    }

    function setHatsModule(address module) external override onlyOwner {
        _requirePaused();
        if (module == address(0)) revert ZeroAddress();
        address previous = hatsModule;
        if (previous == module) return;
        SettlementLoanLib.requireNoActiveReservations();
        hatsModule = module;
        emit HatsModuleUpdated(previous, module);
    }

    function setCommitmentPoolingModule(address module) external override onlyOwner {
        _requirePaused();
        if (module == address(0)) revert ZeroAddress();
        address previous = commitmentPoolingModule;
        if (previous == module) return;
        SettlementLoanLib.requireNoActiveReservations();
        if (_planState.nextPayoutPlanId > 1) revert CommitmentPoolingModuleLocked();
        address registry = SettlementLoanLib.configuredCreditRegistry();
        if (
            registry != address(0)
                && (ICreditRegistry(registry).poolingStateInitialized() || ICreditRegistry(registry).nextLoanId() != 1)
        ) revert CommitmentPoolingModuleLocked();
        commitmentPoolingModule = module;
        emit CommitmentPoolingModuleUpdated(previous, module);
    }

    function setCreditRegistry(address registry) external override onlyOwner {
        _requirePaused();
        SettlementLoanLib.setCreditRegistry(registry);
    }

    function setPaused(bool paused_) external override onlyOwner {
        if (!paused_) {
            CcipRoute memory route = _ccipRoute;
            if (
                hatsModule == address(0) || commitmentPoolingModule == address(0) || route.destinationChainSelector == 0
                    || route.destinationExecutor == address(0) || route.destinationGasLimit == 0
                    || route.protocolVersion != _PROTOCOL_VERSION || feeReserveMinimum == 0
            ) revert SourceNotReady();
            _activeAccount(protocolGarden);
        }
        paused = paused_;
        emit PausedSet(paused_);
    }

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
        external
        override
        onlyOwner
    {
        _requirePaused();
        SettlementConfigurationLib.registerSettlementAccount(
            _settlementAccounts,
            _settlementAccountGardens,
            DESTINATION_EVM_CHAIN_ID,
            _ccipRoute.destinationExecutor,
            garden,
            chainId,
            account,
            recoveryOwners,
            rolesModifier,
            roleKey,
            allowanceKey,
            permissionsConfigHash
        );
    }

    function updateSettlementRecovery(address garden, address[3] calldata recoveryOwners) external override {
        _requireAccountAdministrator(garden);
        SettlementConfigurationLib.updateSettlementRecovery(
            _settlementAccounts, _ccipRoute.destinationExecutor, garden, recoveryOwners
        );
    }

    function setAccountActive(address garden, bool active) external override {
        _requireAccountAdministrator(garden);
        SettlementConfigurationLib.setAccountActive(_settlementAccounts, garden, active);
    }

    function setGardenerDeliveryEnabled(bool enabled) external override onlyOwner {
        gardenerDeliveryEnabled = enabled;
        emit GardenerDeliveryStatusChanged(enabled);
    }
}
