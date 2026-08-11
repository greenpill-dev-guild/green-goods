// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ISettlementModule } from "../../interfaces/ISettlementModule.sol";

/// @notice Paused-only route and settlement-account configuration behavior.
library SettlementConfigurationLib {
    uint64 private constant _MAX_PREVIOUS_PEER_GRACE = 30 days;

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

    function validateUpgrade(
        address newImplementation,
        bool paused,
        address ccipRouter,
        uint64 sourceChainSelector,
        uint64 destinationEvmChainId
    )
        public
        view
    {
        if (!paused) revert ISettlementModule.SourceMustBePaused();
        if (
            _replacementImmutable(newImplementation, ISettlementModule.CCIP_ROUTER.selector) != uint256(uint160(ccipRouter))
                || _replacementImmutable(newImplementation, ISettlementModule.SOURCE_CHAIN_SELECTOR.selector)
                    != sourceChainSelector
                || _replacementImmutable(newImplementation, ISettlementModule.DESTINATION_EVM_CHAIN_ID.selector)
                    != destinationEvmChainId
        ) revert ISettlementModule.ImmutableConfigurationMismatch();
    }

    /// @dev Keeps route replacement and grace-window derivation atomic and visibly ordered.
    // solhint-disable-next-line code-complexity
    function setCcipRoute(
        ISettlementModule.CcipRoute storage current,
        uint64 destinationChainSelector,
        address destinationExecutor,
        uint32 destinationGasLimit,
        uint8 protocolVersion,
        uint64 previousPeerGraceSeconds
    )
        public
    {
        if (
            destinationChainSelector == 0 || destinationExecutor == address(0) || destinationGasLimit == 0
                || protocolVersion != 1 || previousPeerGraceSeconds > _MAX_PREVIOUS_PEER_GRACE
        ) revert ISettlementModule.FundingConfigurationIncomplete();

        ISettlementModule.CcipRoute memory prior = current;
        bool unchangedActiveRoute = prior.destinationChainSelector == destinationChainSelector
            && prior.destinationExecutor == destinationExecutor && prior.protocolVersion == protocolVersion;
        if (
            !unchangedActiveRoute && prior.previousDestinationExecutor != address(0)
                && block.timestamp <= prior.previousPeerExpiresAt
        ) {
            revert ISettlementModule.PreviousPeerGraceActive(prior.previousDestinationExecutor, prior.previousPeerExpiresAt);
        }
        address previousExecutor;
        uint64 previousExpiresAt;
        if (prior.destinationExecutor != address(0)) {
            bool sameLane =
                prior.destinationChainSelector == destinationChainSelector && prior.protocolVersion == protocolVersion;
            bool sameExecutor = prior.destinationExecutor == destinationExecutor;
            if (!sameLane && previousPeerGraceSeconds != 0) {
                revert ISettlementModule.FundingConfigurationIncomplete();
            }
            if (sameLane && !sameExecutor) {
                if (previousPeerGraceSeconds == 0) revert ISettlementModule.FundingConfigurationIncomplete();
                previousExecutor = prior.destinationExecutor;
                previousExpiresAt = uint64(block.timestamp) + previousPeerGraceSeconds;
            } else if (sameLane && sameExecutor && prior.previousDestinationExecutor != address(0)) {
                previousExecutor = prior.previousDestinationExecutor;
                previousExpiresAt = prior.previousPeerExpiresAt;
                if (previousPeerGraceSeconds != 0) {
                    uint64 proposed = uint64(block.timestamp) + previousPeerGraceSeconds;
                    if (proposed < previousExpiresAt) {
                        revert ISettlementModule.FundingConfigurationIncomplete();
                    }
                    previousExpiresAt = proposed;
                }
            } else if (previousPeerGraceSeconds != 0) {
                revert ISettlementModule.FundingConfigurationIncomplete();
            }
        } else if (previousPeerGraceSeconds != 0) {
            revert ISettlementModule.FundingConfigurationIncomplete();
        }

        current.destinationChainSelector = destinationChainSelector;
        current.destinationExecutor = destinationExecutor;
        current.previousDestinationExecutor = previousExecutor;
        current.previousPeerExpiresAt = previousExpiresAt;
        current.destinationGasLimit = destinationGasLimit;
        current.protocolVersion = protocolVersion;
        emit CcipRouteUpdated(
            destinationChainSelector,
            destinationExecutor,
            previousExecutor,
            previousExpiresAt,
            destinationGasLimit,
            protocolVersion
        );
    }

    function registerSettlementAccount(
        mapping(address garden => ISettlementModule.SettlementAccount account) storage accounts,
        mapping(address account => address garden) storage accountGardens,
        uint64 destinationEvmChainId,
        address destinationExecutor,
        address garden,
        uint64 chainId,
        address account,
        address[3] calldata recoveryOwners,
        address rolesModifier,
        bytes32 roleKey,
        bytes32 allowanceKey,
        bytes32 permissionsConfigHash
    )
        public
    {
        if (garden == address(0) || account == address(0) || rolesModifier == address(0)) {
            revert ISettlementModule.ZeroAddress();
        }
        if (chainId != destinationEvmChainId) revert ISettlementModule.InvalidSettlementChain(chainId);
        if (roleKey == bytes32(0) || allowanceKey == bytes32(0) || permissionsConfigHash == bytes32(0)) {
            revert ISettlementModule.InvalidRecoveryConfiguration();
        }
        if (accounts[garden].account != address(0)) {
            revert ISettlementModule.InvalidRecoveryConfiguration();
        }
        address assignedGarden = accountGardens[account];
        if (assignedGarden != address(0)) {
            revert ISettlementModule.SettlementAccountAlreadyAssigned(account, assignedGarden);
        }
        _validateRecoveryOwners(recoveryOwners, destinationExecutor);
        bytes32 recoveryConfigHash = keccak256(abi.encode(chainId, account, recoveryOwners, uint8(2)));
        accounts[garden] = ISettlementModule.SettlementAccount({
            chainId: chainId,
            account: account,
            active: true,
            recoveryOwners: recoveryOwners,
            rolesModifier: rolesModifier,
            roleKey: roleKey,
            allowanceKey: allowanceKey,
            permissionsConfigHash: permissionsConfigHash,
            recoveryConfigHash: recoveryConfigHash,
            recoveryThreshold: 2
        });
        accountGardens[account] = garden;
        emit SettlementAccountRegistered(
            garden,
            chainId,
            account,
            recoveryOwners,
            rolesModifier,
            roleKey,
            allowanceKey,
            permissionsConfigHash,
            recoveryConfigHash,
            2
        );
    }

    function updateSettlementRecovery(
        mapping(address garden => ISettlementModule.SettlementAccount account) storage accounts,
        address destinationExecutor,
        address garden,
        address[3] calldata recoveryOwners
    )
        public
    {
        ISettlementModule.SettlementAccount storage account = accounts[garden];
        if (account.account == address(0)) revert ISettlementModule.UnknownSettlementAccount(garden);
        _validateRecoveryOwners(recoveryOwners, destinationExecutor);
        bytes32 recoveryConfigHash =
            keccak256(abi.encode(account.chainId, account.account, recoveryOwners, account.recoveryThreshold));
        account.recoveryOwners = recoveryOwners;
        account.recoveryConfigHash = recoveryConfigHash;
        emit SettlementRecoveryUpdated(garden, recoveryOwners, recoveryConfigHash);
    }

    function setAccountActive(
        mapping(address garden => ISettlementModule.SettlementAccount account) storage accounts,
        address garden,
        bool active
    )
        public
    {
        ISettlementModule.SettlementAccount storage account = accounts[garden];
        if (account.account == address(0)) revert ISettlementModule.UnknownSettlementAccount(garden);
        account.active = active;
        emit SettlementAccountStatusChanged(garden, active);
    }

    function _validateRecoveryOwners(address[3] calldata owners, address destinationExecutor) private pure {
        if (
            owners[0] == address(0) || owners[1] == address(0) || owners[2] == address(0) || owners[0] >= owners[1]
                || owners[1] >= owners[2]
        ) revert ISettlementModule.InvalidRecoveryConfiguration();
        if (
            destinationExecutor != address(0)
                && (owners[0] == destinationExecutor || owners[1] == destinationExecutor || owners[2] == destinationExecutor)
        ) revert ISettlementModule.InvalidRecoveryConfiguration();
    }

    function _replacementImmutable(address implementation, bytes4 selector) private view returns (uint256 value) {
        (bool success, bytes memory result) = implementation.staticcall(abi.encodeWithSelector(selector));
        if (!success || result.length != 32) revert ISettlementModule.ImmutableConfigurationMismatch();
        value = abi.decode(result, (uint256));
    }
}
