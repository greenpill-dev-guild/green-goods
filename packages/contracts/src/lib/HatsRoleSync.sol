// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
import { IHatsModule } from "../interfaces/IHatsModule.sol";
import { IStewardRoleObserver } from "../interfaces/IStewardRoleObserver.sol";
import { IKarmaGAPModule } from "../interfaces/IKarmaGAPModule.sol";
import { IKarmaSyncObserver } from "../interfaces/IKarmaSyncObserver.sol";
import { ICVSyncPowerFacet } from "../interfaces/ICVSyncPowerFacet.sol";

/// @notice Downstream failures never restore a revoked Hat; callers must fund the bounded hooks.
library HatsRoleSync {
    uint256 internal constant SYNC_POWER_GAS_STIPEND = 1_000_000;
    uint256 private constant SYNC_CALL_OVERHEAD = 25_000;
    uint256 private constant POST_SYNC_GAS_RESERVE = 100_000;
    uint256 private constant MAX_SYNC_FAILURE_BYTES = 324;

    error InsufficientConvictionSyncGas(uint256 available, uint256 required);

    function projectAdmin(IKarmaGAPModule module, address garden, address account, bool add) internal {
        if (address(module) == address(0)) {
            emit IKarmaSyncObserver.KarmaHookFailed(
                garden, account, IKarmaGAPModule.KarmaSyncOperation.Access, "module_unavailable"
            );
            return;
        }
        if (add) {
            try module.addProjectAdmin(garden, account) { }
            catch {
                emit IKarmaSyncObserver.KarmaHookFailed(
                    garden, account, IKarmaGAPModule.KarmaSyncOperation.Access, "module_call_reverted"
                );
            }
        } else {
            try module.removeProjectAdmin(garden, account) { }
            catch {
                emit IKarmaSyncObserver.KarmaHookFailed(
                    garden, account, IKarmaGAPModule.KarmaSyncOperation.Access, "module_call_reverted"
                );
            }
        }
    }

    function convictionPower(address[] storage strategies, address garden, address account) internal {
        uint256 len = strategies.length;
        if (len == 0) return;

        // A caught out-of-gas hook otherwise lets estimation accept an underfunded role write.
        // Reject that caller budget atomically; genuine downstream reverts remain best-effort.
        // Include CALL/EIP-150 overhead and enough gas to finish the role operation afterwards.
        uint256 required = len * (SYNC_POWER_GAS_STIPEND + SYNC_CALL_OVERHEAD) + POST_SYNC_GAS_RESERVE;
        uint256 available = gasleft();
        if (available < required) revert InsufficientConvictionSyncGas(available, required);

        for (uint256 i = 0; i < len; i++) {
            address strategy = strategies[i];
            (bool success, bytes memory failure, bool oversized) = _callSyncPower(strategy, account);
            if (success) {
                emit IHatsModule.ConvictionSyncTriggered(garden, account, strategy);
            } else {
                emit IHatsModule.ConvictionSyncFailed(
                    garden, account, strategy, oversized ? "revert_data_too_large" : _syncFailureReason(failure)
                );
            }
        }
    }

    /// @dev The stipend bounds the callee; the return-data cap separately bounds caller work.
    function _callSyncPower(
        address strategy,
        address account
    )
        private
        returns (bool success, bytes memory failure, bool oversized)
    {
        bytes memory input = abi.encodeCall(ICVSyncPowerFacet.syncPower, (account));
        failure = new bytes(0);
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            success := call(SYNC_POWER_GAS_STIPEND, strategy, 0, add(input, 32), mload(input), 0, 0)
            if iszero(success) {
                let size := returndatasize()
                oversized := gt(size, MAX_SYNC_FAILURE_BYTES)
                if oversized { size := MAX_SYNC_FAILURE_BYTES }
                failure := mload(0x40)
                mstore(failure, size)
                mstore(0x40, and(add(add(failure, 63), size), not(31)))
                returndatacopy(add(failure, 32), 0, size)
            }
        }
    }

    /// @dev Preserve short Error(string) diagnostics without decoding untrusted dynamic offsets.
    function _syncFailureReason(bytes memory failure) private pure returns (string memory) {
        if (failure.length < 68) return "";
        bytes4 selector;
        uint256 offset;
        uint256 length;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            selector := mload(add(failure, 32))
            offset := mload(add(failure, 36))
            length := mload(add(failure, 68))
        }
        if (selector != bytes4(keccak256("Error(string)")) || offset != 32 || length > failure.length - 68) {
            return "";
        }
        bytes memory reason = new bytes(length);
        // At most 256 bytes, copied in words; malformed offsets never reach this loop.
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            for { let i := 0 } lt(i, length) { i := add(i, 32) } {
                mstore(add(add(reason, 32), i), mload(add(add(failure, 100), i)))
            }
        }
        return string(reason);
    }

    function notifyStewardObserver(address observer, address account) internal returns (bool) {
        if (observer == address(0)) return true;
        try IStewardRoleObserver(observer).syncSteward{ gas: 800_000 }(account) {
            return true;
        } catch {
            return false;
        }
    }
}
