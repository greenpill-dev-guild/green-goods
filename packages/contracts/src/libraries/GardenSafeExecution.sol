// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ISafeV141 } from "../interfaces/IGardenAccountRelayDependencies.sol";
import { GardenSafeActionCodec } from "./GardenSafeActionCodec.sol";

/// @title GardenSafeExecution
/// @notice Stateless helpers for hashing and encoding the final Safe execution.
library GardenSafeExecution {
    error InvalidRecoveryOwner();

    function transactionHash(
        ISafeV141 destinationSafe,
        GardenSafeActionCodec.SafeTransaction memory safeTransaction
    )
        internal
        view
        returns (bytes32)
    {
        return destinationSafe.getTransactionHash(
            safeTransaction.to,
            safeTransaction.value,
            safeTransaction.data,
            safeTransaction.operation,
            safeTransaction.safeTxGas,
            safeTransaction.baseGas,
            safeTransaction.gasPrice,
            safeTransaction.gasToken,
            safeTransaction.refundReceiver,
            safeTransaction.nonce
        );
    }

    function buildSignatures(
        address gardenAccount,
        address recoverySafe,
        bytes memory recoverySignature
    )
        internal
        pure
        returns (bytes memory)
    {
        if (gardenAccount == address(0) || recoverySafe == address(0) || gardenAccount == recoverySafe) {
            revert InvalidRecoveryOwner();
        }

        bytes memory gardenHeader = abi.encodePacked(bytes32(uint256(uint160(gardenAccount))), bytes32(0), uint8(1));
        bytes memory recoveryHeader =
            abi.encodePacked(bytes32(uint256(uint160(recoverySafe))), bytes32(uint256(130)), uint8(0));
        uint256 paddingLength = (32 - (recoverySignature.length % 32)) % 32;
        bytes memory dynamicSignature =
            abi.encodePacked(uint256(recoverySignature.length), recoverySignature, new bytes(paddingLength));

        if (gardenAccount < recoverySafe) {
            return abi.encodePacked(gardenHeader, recoveryHeader, dynamicSignature);
        }
        return abi.encodePacked(recoveryHeader, gardenHeader, dynamicSignature);
    }
}
