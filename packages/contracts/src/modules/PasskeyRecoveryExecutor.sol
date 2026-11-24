// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import { IPasskeyValidator, IRecoverableKernel } from "../interfaces/IKernelPasskey.sol";
import { IPasskeyRecoveryExecutor } from "../interfaces/IPasskeyRecoveryExecutor.sol";

/// @title PasskeyRecoveryExecutor
/// @notice Lets a wallet the member enrolled replace the passkey of their Kernel account, so the
/// member returns to the same address after losing the passkey.
/// @dev A Kernel executor module (ERC-7579 type 2) for accounts whose root validator is the pinned
/// WebAuthn validator. The only calls it ever makes from an account are that validator's
/// `onUninstall` and `onInstall`, in one batch: the account's root, implementation and every other
/// validation stay as they were.
///
/// Authority: the guardian chooses the replacement key, so it can take the account. The account
/// enrolls, replaces and removes the guardian, and cancels a pending request. Nobody else (this
/// contract's deployer included) has any authority.
///
/// "The account" is whoever can make it call this contract: its passkey, and any permission or
/// module the member gave an unrestricted call right. A grant that must not be able to name a
/// guardian must not be allowed to call this contract, as it must not be allowed to call the
/// account itself.
///
/// Replay: every enrollment, cancellation and recovery moves the account to a new generation, and
/// a guardian's approval names one generation, one chain and this contract.
contract PasskeyRecoveryExecutor is IPasskeyRecoveryExecutor {
    /// @dev Kernel's `Execution`, the element of a batch.
    struct Execution {
        address target;
        uint256 value;
        bytes callData;
    }

    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    /// @dev ERC-1271's answer for a signature a contract accepts.
    bytes4 private constant ERC1271_MAGIC = 0x1626ba7e;
    bytes32 private constant RECOVERY_TYPEHASH = keccak256(
        "RecoveryRequest(address account,uint256 pubKeyX,uint256 pubKeyY,"
        "bytes32 authenticatorIdHash,uint32 generation,uint256 deadline)"
    );
    /// @dev Kernel's batch call type with the default (revert on failure) execution type.
    bytes32 private constant BATCH_EXEC_MODE = bytes32(bytes1(0x01));
    uint256 private constant MODULE_TYPE_EXECUTOR = 2;
    /// @dev A longer wait would leave a member without their account for longer than a hold helps.
    uint48 public constant MAX_DELAY = 30 days;
    /// @notice How long a request stays usable once its delay has passed. A request nobody acted
    /// on must not replace a working passkey months later.
    uint48 public constant EXECUTION_WINDOW = 7 days;

    // The P-256 curve: y^2 = x^3 + ax + b (mod p).
    uint256 private constant P256_P = 0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF;
    uint256 private constant P256_A = 0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFC;
    uint256 private constant P256_B = 0x5AC635D8AA3A93E7B3EBBD55769886BC651D06B0CC53B0F63BCE3C3E27D2604B;

    /// @notice The WebAuthn validator whose key this executor replaces.
    IPasskeyValidator public immutable PASSKEY_VALIDATOR;
    /// @dev Kernel's validation ID of that validator as a root: type 0x01, then the address.
    bytes21 public immutable ROOT_VALIDATION_ID;

    mapping(address account => Enrollment enrollment) private enrollments;
    mapping(address account => PendingRecovery pending) private pendingRecoveries;
    /// @notice Signed approvals that have started a request. Each starts at most one, so one taken
    /// from a lapsed request's calldata cannot re-arm it.
    mapping(bytes32 digest => bool used) public approvalUsed;
    /// @notice How many times an account's passkey has been replaced through this executor.
    mapping(address account => uint64 count) public recoveryCount;

    constructor(address passkeyValidator) {
        if (passkeyValidator.code.length == 0) revert UnsupportedAccount();
        PASSKEY_VALIDATOR = IPasskeyValidator(passkeyValidator);
        ROOT_VALIDATION_ID = bytes21(abi.encodePacked(bytes1(0x01), passkeyValidator));
    }

    /// @notice Kernel calls this when the account installs the executor.
    /// @param data `abi.encode(address guardian, uint48 delay)`
    function onInstall(bytes calldata data) external payable {
        (address guardian, uint48 delay) = abi.decode(data, (address, uint48));
        _enroll(msg.sender, guardian, delay);
    }

    /// @notice Kernel calls this when the account uninstalls the executor.
    function onUninstall(bytes calldata) external payable {
        _removeGuardian(msg.sender);
    }

    /// @notice Enroll or replace the guardian, or change the delay.
    function setGuardian(address guardian, uint48 delay) external {
        _enroll(msg.sender, guardian, delay);
    }

    /// @notice Remove the guardian and any pending request without uninstalling the executor.
    function removeGuardian() external {
        _removeGuardian(msg.sender);
    }

    function isModuleType(uint256 moduleTypeId) external pure returns (bool) {
        return moduleTypeId == MODULE_TYPE_EXECUTOR;
    }

    function isInitialized(address account) external view returns (bool) {
        return enrollments[account].guardian != address(0);
    }

    /// @notice Start replacing an account's passkey. With no delay the key is replaced at once.
    /// @param signature The guardian's EIP-712 approval of exactly this account, key, generation
    /// and deadline. Empty when the guardian sends the transaction itself.
    function requestRecovery(
        address account,
        PasskeyKey calldata key,
        uint256 deadline,
        bytes calldata signature
    )
        external
    {
        Enrollment memory enrollment = enrollments[account];
        if (enrollment.guardian == address(0)) revert NotEnrolled();
        _requireValidKey(key);
        // A request nobody executed in its window no longer blocks a new one, so a relayed approval
        // can start over without the guardian paying for a cancel.
        PendingRecovery memory current = pendingRecoveries[account];
        if (current.generation == enrollment.generation && block.timestamp <= current.expiresAt) {
            revert RecoveryAlreadyPending();
        }
        _requireGuardianApproval(account, enrollment, key, deadline, signature);

        bytes32 keyHash = _keyHash(key);
        uint48 executeAfter = uint48(block.timestamp) + enrollment.delay;
        pendingRecoveries[account] = PendingRecovery({
            keyHash: keyHash,
            executeAfter: executeAfter,
            expiresAt: executeAfter + EXECUTION_WINDOW,
            generation: enrollment.generation
        });
        emit RecoveryRequested(
            account, enrollment.generation, keyHash, executeAfter, key.pubKeyX, key.pubKeyY, key.authenticatorIdHash
        );

        if (enrollment.delay == 0) _rotate(account, enrollment, key);
    }

    /// @notice Replace the passkey once the delay has passed. Anyone may send this: the request
    /// already fixed the key.
    function executeRecovery(address account, PasskeyKey calldata key) external {
        Enrollment memory enrollment = enrollments[account];
        PendingRecovery memory pending = pendingRecoveries[account];
        if (enrollment.guardian == address(0) || pending.generation != enrollment.generation) {
            revert NoPendingRecovery();
        }
        if (block.timestamp < pending.executeAfter) revert RecoveryNotReady(pending.executeAfter);
        if (block.timestamp > pending.expiresAt) revert RecoveryExpired(pending.expiresAt);
        if (_keyHash(key) != pending.keyHash) revert KeyMismatch();
        _rotate(account, enrollment, key);
    }

    /// @notice Cancel the pending request, if there is one, and void every approval the guardian
    /// has signed so far. The account calls this with its current passkey; the guardian may
    /// withdraw its own request or an approval it regrets before anyone submits it.
    function cancelRecovery(address account) external {
        Enrollment storage enrollment = enrollments[account];
        if (enrollment.guardian == address(0)) revert NotEnrolled();
        if (msg.sender != account && msg.sender != enrollment.guardian) revert NotGuardian();
        uint32 generation = enrollment.generation;
        delete pendingRecoveries[account];
        enrollment.generation = generation + 1;
        emit RecoveryCancelled(account, generation, msg.sender);
    }

    function enrollmentOf(address account) external view returns (Enrollment memory) {
        return enrollments[account];
    }

    /// @notice The pending request, or an empty one when none is waiting on the current generation
    /// or the last one lapsed unexecuted.
    function pendingRecoveryOf(address account) external view returns (PendingRecovery memory pending) {
        Enrollment memory enrollment = enrollments[account];
        pending = pendingRecoveries[account];
        if (
            enrollment.guardian == address(0) || pending.generation != enrollment.generation
                || block.timestamp > pending.expiresAt
        ) {
            delete pending;
        }
    }

    /// @notice The digest a guardian signs to approve one recovery.
    function recoveryDigest(
        address account,
        PasskeyKey calldata key,
        uint32 generation,
        uint256 deadline
    )
        public
        view
        returns (bytes32)
    {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH, keccak256("Green Goods Passkey Recovery"), keccak256("1"), block.chainid, address(this)
            )
        );
        return keccak256(
            abi.encodePacked(
                "\x19\x01",
                domainSeparator,
                keccak256(
                    abi.encode(
                        RECOVERY_TYPEHASH, account, key.pubKeyX, key.pubKeyY, key.authenticatorIdHash, generation, deadline
                    )
                )
            )
        );
    }

    function _enroll(address account, address guardian, uint48 delay) private {
        if (guardian == address(0) || guardian == account) revert InvalidGuardian();
        if (delay > MAX_DELAY) revert InvalidDelay();
        _requireSupportedAccount(account);
        // An enrollment the account's Kernel would not honour must not exist: it could come to
        // life later, unannounced, when the executor is installed.
        if (!IRecoverableKernel(account).isModuleInstalled(MODULE_TYPE_EXECUTOR, address(this), "")) {
            revert UnsupportedAccount();
        }
        Enrollment storage enrollment = enrollments[account];
        // Generations start at 1, so an account that never enrolled has no pending request.
        uint32 generation = enrollment.generation + 1;
        enrollment.guardian = guardian;
        enrollment.delay = delay;
        enrollment.generation = generation;
        delete pendingRecoveries[account];
        emit GuardianEnrolled(account, guardian, generation, delay);
    }

    function _removeGuardian(address account) private {
        Enrollment storage enrollment = enrollments[account];
        address guardian = enrollment.guardian;
        if (guardian == address(0)) return;
        uint32 generation = enrollment.generation + 1;
        enrollment.guardian = address(0);
        enrollment.delay = 0;
        enrollment.generation = generation;
        delete pendingRecoveries[account];
        emit GuardianRemoved(account, guardian, generation);
    }

    function _requireGuardianApproval(
        address account,
        Enrollment memory enrollment,
        PasskeyKey calldata key,
        uint256 deadline,
        bytes calldata signature
    )
        private
    {
        if (signature.length == 0) {
            if (msg.sender != enrollment.guardian) revert NotGuardian();
            return;
        }
        if (block.timestamp > deadline) revert ApprovalExpired();
        bytes32 digest = recoveryDigest(account, key, enrollment.generation, deadline);
        if (approvalUsed[digest]) revert ApprovalAlreadyUsed();
        if (!_guardianSigned(enrollment.guardian, digest, signature)) revert NotGuardian();
        approvalUsed[digest] = true;
    }

    /// @dev A plain wallet's signature, or a contract guardian's own answer (ERC-1271), as a Safe gives.
    function _guardianSigned(address guardian, bytes32 digest, bytes calldata signature) private view returns (bool) {
        (address signer, ECDSA.RecoverError recoverError) = ECDSA.tryRecover(digest, signature);
        if (recoverError == ECDSA.RecoverError.NoError && signer == guardian) return true;
        if (guardian.code.length == 0) return false;
        (bool ok, bytes memory answer) = guardian.staticcall(abi.encodeWithSelector(ERC1271_MAGIC, digest, signature));
        return ok && answer.length == 32 && abi.decode(answer, (bytes32)) == bytes32(ERC1271_MAGIC);
    }

    /// @dev State moves before the account is called. A failed rotation reverts everything, so the
    /// old key, the request and the enrollment all stay as they were.
    function _rotate(address account, Enrollment memory enrollment, PasskeyKey calldata key) private {
        _requireSupportedAccount(account);
        delete pendingRecoveries[account];
        enrollments[account].generation = enrollment.generation + 1;
        uint64 sequence = ++recoveryCount[account];

        // The validator refuses to remove a key that is not there, and an account whose key was
        // removed by mistake is the one that most needs this to work.
        bool hasKey = PASSKEY_VALIDATOR.isInitialized(account);
        Execution[] memory batch = new Execution[](hasKey ? 2 : 1);
        if (hasKey) {
            batch[0] = Execution({
                target: address(PASSKEY_VALIDATOR), value: 0, callData: abi.encodeCall(IPasskeyValidator.onUninstall, (""))
            });
        }
        batch[batch.length - 1] = Execution({
            target: address(PASSKEY_VALIDATOR),
            value: 0,
            callData: abi.encodeCall(
                IPasskeyValidator.onInstall, (abi.encode(key.pubKeyX, key.pubKeyY, key.authenticatorIdHash))
            )
        });
        IRecoverableKernel(account).executeFromExecutor(BATCH_EXEC_MODE, abi.encode(batch));
        // The event below is evidence only if the validator now holds exactly this key.
        (uint256 storedX, uint256 storedY) = PASSKEY_VALIDATOR.webAuthnValidatorStorage(account);
        if (storedX != key.pubKeyX || storedY != key.pubKeyY) revert RotationFailed();

        emit PasskeyRecovered(account, sequence, enrollment.guardian, key.pubKeyX, key.pubKeyY, key.authenticatorIdHash);
    }

    /// @dev Only an account whose root is the pinned validator: the executor replaces that
    /// validator's key and nothing else, so on any other account it would rotate a key that
    /// does not control the account.
    function _requireSupportedAccount(address account) private view {
        if (account.code.length == 0) revert UnsupportedAccount();
        try IRecoverableKernel(account).rootValidator() returns (bytes21 root) {
            if (root != ROOT_VALIDATION_ID) revert UnsupportedAccount();
        } catch {
            revert UnsupportedAccount();
        }
    }

    /// @dev The validator accepts any non-zero pair. A pair that is not a P-256 point could never
    /// sign, and would lock the member out for good.
    function _requireValidKey(PasskeyKey calldata key) private pure {
        uint256 x = key.pubKeyX;
        uint256 y = key.pubKeyY;
        if (x == 0 || y == 0 || x >= P256_P || y >= P256_P || key.authenticatorIdHash == bytes32(0)) {
            revert InvalidKey();
        }
        uint256 lhs = mulmod(y, y, P256_P);
        uint256 rhs =
            addmod(addmod(mulmod(mulmod(x, x, P256_P), x, P256_P), mulmod(P256_A, x, P256_P), P256_P), P256_B, P256_P);
        if (lhs != rhs) revert InvalidKey();
    }

    function _keyHash(PasskeyKey calldata key) private pure returns (bytes32) {
        return keccak256(abi.encode(key.pubKeyX, key.pubKeyY, key.authenticatorIdHash));
    }
}
