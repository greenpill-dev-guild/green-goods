// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IPasskeyRecoveryExecutor
/// @notice The types, errors and events of the wallet-guardian recovery executor.
interface IPasskeyRecoveryExecutor {
    /// @notice The replacement passkey: its P-256 public key and the hash of its credential ID.
    struct PasskeyKey {
        uint256 pubKeyX;
        uint256 pubKeyY;
        bytes32 authenticatorIdHash;
    }

    struct Enrollment {
        address guardian;
        /// @dev Seconds between a request and the earliest moment it can replace the key.
        uint48 delay;
        uint32 generation;
    }

    struct PendingRecovery {
        bytes32 keyHash;
        uint48 executeAfter;
        /// @dev The request can no longer replace the key after this moment.
        uint48 expiresAt;
        uint32 generation;
    }

    error InvalidGuardian();
    error InvalidDelay();
    error InvalidKey();
    error UnsupportedAccount();
    error NotEnrolled();
    error NotGuardian();
    error ApprovalExpired();
    error ApprovalAlreadyUsed();
    error RecoveryAlreadyPending();
    error NoPendingRecovery();
    error RecoveryNotReady(uint48 executeAfter);
    error RecoveryExpired(uint48 expiresAt);
    error KeyMismatch();
    error RotationFailed();

    event GuardianEnrolled(address indexed account, address indexed guardian, uint32 indexed generation, uint48 delay);
    event GuardianRemoved(address indexed account, address indexed guardian, uint32 indexed generation);
    event RecoveryRequested(
        address indexed account,
        uint32 indexed generation,
        bytes32 indexed keyHash,
        uint48 executeAfter,
        uint256 pubKeyX,
        uint256 pubKeyY,
        bytes32 authenticatorIdHash
    );
    event RecoveryCancelled(address indexed account, uint32 indexed generation, address indexed cancelledBy);
    /// @notice The evidence a directory checks before it points a name at a recovered account.
    /// @param sequence How many times this account's passkey has been replaced here, this one included.
    event PasskeyRecovered(
        address indexed account,
        uint64 indexed sequence,
        address indexed guardian,
        uint256 pubKeyX,
        uint256 pubKeyY,
        bytes32 authenticatorIdHash
    );
}
