// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";

import { PasskeyRecoveryExecutor } from "../../src/modules/PasskeyRecoveryExecutor.sol";
import { IPasskeyRecoveryExecutor } from "../../src/interfaces/IPasskeyRecoveryExecutor.sol";

/// @dev Stores one key per caller, as Kernel's WebAuthn validator does.
contract MockPasskeyValidator {
    error AlreadyInitialized();
    error NotInitialized();

    mapping(address account => uint256[2] key) public keys;
    bool public refuseInstall;

    function setRefuseInstall(bool refuse) external {
        refuseInstall = refuse;
    }

    function onInstall(bytes calldata data) external payable {
        if (refuseInstall || keys[msg.sender][0] != 0) revert AlreadyInitialized();
        (uint256 x, uint256 y,) = abi.decode(data, (uint256, uint256, bytes32));
        keys[msg.sender] = [x, y];
    }

    function onUninstall(bytes calldata) external payable {
        if (keys[msg.sender][0] == 0) revert NotInitialized();
        delete keys[msg.sender];
    }

    function isInitialized(address account) external view returns (bool) {
        return keys[account][0] != 0;
    }

    function webAuthnValidatorStorage(address account) external view returns (uint256, uint256) {
        return (keys[account][0], keys[account][1]);
    }
}

/// @dev The two Kernel behaviours the executor relies on: a root validator it can read, and
/// batches that only an installed executor may run from the account.
contract MockKernel {
    error InvalidExecutor();

    struct Execution {
        address target;
        uint256 value;
        bytes callData;
    }

    bytes21 public rootValidator;
    mapping(address executor => bool installed) public executors;

    constructor(address validator) {
        rootValidator = bytes21(abi.encodePacked(bytes1(0x01), validator));
    }

    function setRootValidator(bytes21 root) external {
        rootValidator = root;
    }

    function install(address executor, bytes calldata data) external {
        executors[executor] = true;
        PasskeyRecoveryExecutor(executor).onInstall(data);
    }

    function uninstall(address executor) external {
        executors[executor] = false;
        PasskeyRecoveryExecutor(executor).onUninstall("");
    }

    function call(address target, bytes calldata data) external {
        (bool ok, bytes memory result) = target.call(data);
        if (!ok) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    function isModuleInstalled(uint256 moduleType, address module, bytes calldata) external view returns (bool) {
        return moduleType == 2 && executors[module];
    }

    function executeFromExecutor(bytes32 mode, bytes calldata executionCalldata) external payable returns (bytes[] memory) {
        if (!executors[msg.sender]) revert InvalidExecutor();
        require(mode == bytes32(bytes1(0x01)), "batch only");
        Execution[] memory batch = abi.decode(executionCalldata, (Execution[]));
        bytes[] memory results = new bytes[](batch.length);
        for (uint256 i; i < batch.length; ++i) {
            (bool ok, bytes memory result) = batch[i].target.call{ value: batch[i].value }(batch[i].callData);
            if (!ok) {
                assembly {
                    revert(add(result, 32), mload(result))
                }
            }
            results[i] = result;
        }
        return results;
    }
}

/// @dev A guardian that is a contract (a Safe, say): it accepts its one signer's signature.
contract ContractGuardian {
    address internal immutable signer;

    constructor(address signer_) {
        signer = signer_;
    }

    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
        (bytes32 r, bytes32 s) = abi.decode(signature[0:64], (bytes32, bytes32));
        return ecrecover(hash, uint8(signature[64]), r, s) == signer ? bytes4(0x1626ba7e) : bytes4(0xffffffff);
    }
}

contract PasskeyRecoveryExecutorTest is Test {
    // Two points on P-256: the generator and its double.
    uint256 internal constant GX = 0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296;
    uint256 internal constant GY = 0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5;
    uint256 internal constant G2X = 0x7CF27B188D034F7E8A52380304B51AC3C08969E277F21B35A60B48FC47669978;
    uint256 internal constant G2Y = 0x07775510DB8ED040293D9AC69F7430DBBA7DADE63CE982299E04B79D227873D1;

    uint48 internal constant DELAY = 2 days;

    MockPasskeyValidator internal validator;
    MockKernel internal account;
    PasskeyRecoveryExecutor internal executor;

    uint256 internal guardianKey = 0xA11CE;
    address internal guardian;
    address internal stranger = makeAddr("stranger");

    event PasskeyRecovered(
        address indexed account,
        uint64 indexed sequence,
        address indexed guardian,
        uint256 pubKeyX,
        uint256 pubKeyY,
        bytes32 authenticatorIdHash
    );

    function setUp() public {
        vm.warp(1_800_000_000);
        guardian = vm.addr(guardianKey);
        validator = new MockPasskeyValidator();
        executor = new PasskeyRecoveryExecutor(address(validator));
        account = new MockKernel(address(validator));
        // The account's first passkey.
        vm.prank(address(account));
        validator.onInstall(abi.encode(GX, GY, keccak256("first credential")));
        account.install(address(executor), abi.encode(guardian, DELAY));
    }

    function _replacement() internal pure returns (IPasskeyRecoveryExecutor.PasskeyKey memory) {
        return IPasskeyRecoveryExecutor.PasskeyKey({
            pubKeyX: G2X, pubKeyY: G2Y, authenticatorIdHash: keccak256("replacement credential")
        });
    }

    function _approval(
        IPasskeyRecoveryExecutor.PasskeyKey memory key,
        uint32 generation,
        uint256 deadline,
        uint256 signerKey
    )
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = executor.recoveryDigest(address(account), key, generation, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _currentKeyX() internal view returns (uint256) {
        return validator.keys(address(account), 0);
    }

    // ───────────── Enrollment ─────────────

    function testInstall_enrollsTheGuardianAtGenerationOne() public {
        IPasskeyRecoveryExecutor.Enrollment memory enrollment = executor.enrollmentOf(address(account));
        assertEq(enrollment.guardian, guardian);
        assertEq(enrollment.delay, DELAY);
        assertEq(enrollment.generation, 1);
        assertTrue(executor.isInitialized(address(account)));
        assertTrue(executor.isModuleType(2));
        assertFalse(executor.isModuleType(1));
    }

    function testEnroll_refusesAnAccountOnAnotherRootValidator() public {
        MockKernel other = new MockKernel(makeAddr("another validator"));
        vm.expectRevert(IPasskeyRecoveryExecutor.UnsupportedAccount.selector);
        other.install(address(executor), abi.encode(guardian, DELAY));
    }

    function testEnroll_refusesAnAddressWithNoCode() public {
        vm.prank(stranger);
        vm.expectRevert(IPasskeyRecoveryExecutor.UnsupportedAccount.selector);
        executor.setGuardian(guardian, DELAY);
    }

    function testEnroll_refusesAnAccountThatHasNotInstalledTheExecutor() public {
        // An enrollment the Kernel would not honour could come to life later, unannounced.
        MockKernel other = new MockKernel(address(validator));
        vm.prank(address(other));
        vm.expectRevert(IPasskeyRecoveryExecutor.UnsupportedAccount.selector);
        executor.setGuardian(guardian, DELAY);
    }

    function testRequest_acceptsAContractGuardianThroughERC1271() public {
        ContractGuardian safe = new ContractGuardian(guardian);
        vm.prank(address(account));
        executor.setGuardian(address(safe), DELAY);
        IPasskeyRecoveryExecutor.PasskeyKey memory key = _replacement();
        uint256 deadline = block.timestamp + 1 hours;
        // Generation 2: the guardian was just replaced.
        executor.requestRecovery(address(account), key, deadline, _approval(key, 2, deadline, guardianKey));
        assertEq(executor.pendingRecoveryOf(address(account)).generation, 2);
    }

    function testEnroll_refusesItselfTheZeroAddressAndAnOverlongDelay() public {
        vm.startPrank(address(account));
        vm.expectRevert(IPasskeyRecoveryExecutor.InvalidGuardian.selector);
        executor.setGuardian(address(0), DELAY);
        vm.expectRevert(IPasskeyRecoveryExecutor.InvalidGuardian.selector);
        executor.setGuardian(address(account), DELAY);
        vm.expectRevert(IPasskeyRecoveryExecutor.InvalidDelay.selector);
        executor.setGuardian(guardian, 30 days + 1);
        vm.stopPrank();
    }

    // ───────────── Request and delay ─────────────

    function testRequest_refusesAnyoneButTheGuardian() public {
        IPasskeyRecoveryExecutor.PasskeyKey memory key = _replacement();
        vm.prank(stranger);
        vm.expectRevert(IPasskeyRecoveryExecutor.NotGuardian.selector);
        executor.requestRecovery(address(account), key, 0, "");

        bytes memory forged = _approval(key, 1, block.timestamp + 1 hours, 0xBAD);
        vm.prank(stranger);
        vm.expectRevert(IPasskeyRecoveryExecutor.NotGuardian.selector);
        executor.requestRecovery(address(account), key, block.timestamp + 1 hours, forged);
    }

    function testRequest_refusesAnApprovalForAnotherAccountKeyOrDeadline() public {
        IPasskeyRecoveryExecutor.PasskeyKey memory key = _replacement();
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory approval = _approval(key, 1, deadline, guardianKey);

        // A different key under the same approval.
        IPasskeyRecoveryExecutor.PasskeyKey memory otherKey = key;
        otherKey.authenticatorIdHash = keccak256("another credential");
        vm.expectRevert(IPasskeyRecoveryExecutor.NotGuardian.selector);
        executor.requestRecovery(address(account), otherKey, deadline, approval);

        // A later deadline than the one signed.
        vm.expectRevert(IPasskeyRecoveryExecutor.NotGuardian.selector);
        executor.requestRecovery(address(account), key, deadline + 1, approval);

        // The same guardian's approval, presented for another account it also guards.
        MockKernel second = new MockKernel(address(validator));
        vm.prank(address(second));
        validator.onInstall(abi.encode(GX, GY, keccak256("second account")));
        second.install(address(executor), abi.encode(guardian, DELAY));
        vm.expectRevert(IPasskeyRecoveryExecutor.NotGuardian.selector);
        executor.requestRecovery(address(second), key, deadline, approval);
    }

    function testRequest_refusesAnExpiredApproval() public {
        IPasskeyRecoveryExecutor.PasskeyKey memory key = _replacement();
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory approval = _approval(key, 1, deadline, guardianKey);
        vm.warp(deadline + 1);
        vm.expectRevert(IPasskeyRecoveryExecutor.ApprovalExpired.selector);
        executor.requestRecovery(address(account), key, deadline, approval);
    }

    function testRequest_refusesAKeyThatIsNotOnTheCurve() public {
        IPasskeyRecoveryExecutor.PasskeyKey memory key = _replacement();
        key.pubKeyY = G2Y + 1;
        vm.prank(guardian);
        vm.expectRevert(IPasskeyRecoveryExecutor.InvalidKey.selector);
        executor.requestRecovery(address(account), key, 0, "");

        key = _replacement();
        key.authenticatorIdHash = bytes32(0);
        vm.prank(guardian);
        vm.expectRevert(IPasskeyRecoveryExecutor.InvalidKey.selector);
        executor.requestRecovery(address(account), key, 0, "");

        // A coordinate at or above the field prime, and a zero coordinate.
        key = _replacement();
        key.pubKeyX = 0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF;
        vm.prank(guardian);
        vm.expectRevert(IPasskeyRecoveryExecutor.InvalidKey.selector);
        executor.requestRecovery(address(account), key, 0, "");
        key.pubKeyX = 0;
        vm.prank(guardian);
        vm.expectRevert(IPasskeyRecoveryExecutor.InvalidKey.selector);
        executor.requestRecovery(address(account), key, 0, "");
    }

    function testExecute_waitsForTheDelayThenReplacesTheKeyOnce() public {
        IPasskeyRecoveryExecutor.PasskeyKey memory key = _replacement();
        uint256 deadline = block.timestamp + 1 hours;
        // A relayer carries the guardian's approval: the guardian needs no gas.
        vm.prank(stranger);
        executor.requestRecovery(address(account), key, deadline, _approval(key, 1, deadline, guardianKey));
        uint48 executeAfter = executor.pendingRecoveryOf(address(account)).executeAfter;
        assertEq(executeAfter, block.timestamp + DELAY);
        assertEq(_currentKeyX(), GX, "the key must not move before the delay");

        vm.warp(executeAfter - 1);
        vm.expectRevert(abi.encodeWithSelector(IPasskeyRecoveryExecutor.RecoveryNotReady.selector, executeAfter));
        executor.executeRecovery(address(account), key);

        vm.warp(executeAfter);
        IPasskeyRecoveryExecutor.PasskeyKey memory otherKey = IPasskeyRecoveryExecutor.PasskeyKey(GX, GY, keccak256("x"));
        vm.expectRevert(IPasskeyRecoveryExecutor.KeyMismatch.selector);
        executor.executeRecovery(address(account), otherKey);

        vm.expectEmit(true, true, true, true, address(executor));
        emit PasskeyRecovered(address(account), 1, guardian, G2X, G2Y, key.authenticatorIdHash);
        vm.prank(stranger);
        executor.executeRecovery(address(account), key);

        assertEq(_currentKeyX(), G2X);
        assertEq(executor.recoveryCount(address(account)), 1);
        // The guardian stays enrolled at a new generation, so a second loss is still recoverable.
        IPasskeyRecoveryExecutor.Enrollment memory enrollment = executor.enrollmentOf(address(account));
        assertEq(enrollment.guardian, guardian);
        assertEq(enrollment.generation, 2);

        vm.expectRevert(IPasskeyRecoveryExecutor.NoPendingRecovery.selector);
        executor.executeRecovery(address(account), key);
    }

    function testRequest_withNoDelayReplacesTheKeyAtOnce() public {
        vm.prank(address(account));
        executor.setGuardian(guardian, 0);
        IPasskeyRecoveryExecutor.PasskeyKey memory key = _replacement();
        vm.prank(guardian);
        executor.requestRecovery(address(account), key, 0, "");
        assertEq(_currentKeyX(), G2X);
        assertEq(executor.pendingRecoveryOf(address(account)).keyHash, bytes32(0));
    }

    // ───────────── Replay ─────────────

    function testReplay_aUsedApprovalCannotStartOrFinishAnotherRecovery() public {
        IPasskeyRecoveryExecutor.PasskeyKey memory key = _replacement();
        uint256 deadline = block.timestamp + 10 days;
        bytes memory approval = _approval(key, 1, deadline, guardianKey);
        executor.requestRecovery(address(account), key, deadline, approval);

        // While it waits, the same approval cannot restart the clock.
        vm.expectRevert(IPasskeyRecoveryExecutor.RecoveryAlreadyPending.selector);
        executor.requestRecovery(address(account), key, deadline, approval);

        vm.warp(block.timestamp + DELAY);
        executor.executeRecovery(address(account), key);

        // After it ran, the approval names a generation that is over.
        vm.expectRevert(IPasskeyRecoveryExecutor.NotGuardian.selector);
        executor.requestRecovery(address(account), key, deadline, approval);
    }

    // ───────────── Cancellation ─────────────

    function testCancel_byTheAccountHoldsAfterTheDelayAndKillsTheApproval() public {
        IPasskeyRecoveryExecutor.PasskeyKey memory key = _replacement();
        uint256 deadline = block.timestamp + 10 days;
        bytes memory approval = _approval(key, 1, deadline, guardianKey);
        executor.requestRecovery(address(account), key, deadline, approval);

        vm.prank(stranger);
        vm.expectRevert(IPasskeyRecoveryExecutor.NotGuardian.selector);
        executor.cancelRecovery(address(account));

        account.call(address(executor), abi.encodeCall(PasskeyRecoveryExecutor.cancelRecovery, (address(account))));

        vm.warp(block.timestamp + DELAY + 1);
        vm.expectRevert(IPasskeyRecoveryExecutor.NoPendingRecovery.selector);
        executor.executeRecovery(address(account), key);
        vm.expectRevert(IPasskeyRecoveryExecutor.NotGuardian.selector);
        executor.requestRecovery(address(account), key, deadline, approval);
        assertEq(_currentKeyX(), GX);

        // The guardian is still enrolled and can approve again at the new generation.
        executor.requestRecovery(address(account), key, deadline, _approval(key, 2, deadline, guardianKey));
        assertEq(executor.pendingRecoveryOf(address(account)).generation, 2);
    }

    function testCancel_withNothingPendingVoidsAnApprovalNobodySubmittedYet() public {
        // The guardian signed for a key it now regrets, and withdraws before anyone uses it.
        IPasskeyRecoveryExecutor.PasskeyKey memory key = _replacement();
        uint256 deadline = block.timestamp + 10 days;
        bytes memory approval = _approval(key, 1, deadline, guardianKey);
        vm.prank(guardian);
        executor.cancelRecovery(address(account));

        vm.expectRevert(IPasskeyRecoveryExecutor.NotGuardian.selector);
        executor.requestRecovery(address(account), key, deadline, approval);
        assertEq(executor.enrollmentOf(address(account)).generation, 2);
    }

    function testCancel_byTheGuardianWithdrawsItsOwnRequest() public {
        IPasskeyRecoveryExecutor.PasskeyKey memory key = _replacement();
        vm.startPrank(guardian);
        executor.requestRecovery(address(account), key, 0, "");
        executor.cancelRecovery(address(account));
        vm.stopPrank();
        vm.warp(block.timestamp + DELAY);
        vm.expectRevert(IPasskeyRecoveryExecutor.NoPendingRecovery.selector);
        executor.executeRecovery(address(account), key);
    }

    function testRemoveGuardian_dropsTheGuardianAndTheRequestInOneCall() public {
        IPasskeyRecoveryExecutor.PasskeyKey memory key = _replacement();
        vm.prank(guardian);
        executor.requestRecovery(address(account), key, 0, "");
        vm.prank(address(account));
        executor.removeGuardian();
        assertFalse(executor.isInitialized(address(account)));
        vm.prank(guardian);
        vm.expectRevert(IPasskeyRecoveryExecutor.NotEnrolled.selector);
        executor.cancelRecovery(address(account));
    }

    // ───────────── Expiry ─────────────

    function testExecute_refusesARequestNobodyActedOnInTime() public {
        IPasskeyRecoveryExecutor.PasskeyKey memory key = _replacement();
        uint256 deadline = block.timestamp + 60 days;
        bytes memory approval = _approval(key, 1, deadline, guardianKey);
        executor.requestRecovery(address(account), key, deadline, approval);
        uint48 expiresAt = executor.pendingRecoveryOf(address(account)).expiresAt;
        assertEq(expiresAt, block.timestamp + DELAY + 7 days);

        // The member found their device and kept using it; a stranger tries the old request later.
        vm.warp(uint256(expiresAt) + 1);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IPasskeyRecoveryExecutor.RecoveryExpired.selector, expiresAt));
        executor.executeRecovery(address(account), key);
        assertEq(_currentKeyX(), GX);

        // The lapsed approval cannot start over; the guardian has to clear it and approve again.
        vm.expectRevert(IPasskeyRecoveryExecutor.RecoveryAlreadyPending.selector);
        executor.requestRecovery(address(account), key, deadline, approval);
        vm.prank(guardian);
        executor.cancelRecovery(address(account));
        executor.requestRecovery(address(account), key, deadline, _approval(key, 2, deadline, guardianKey));
    }

    function testGuardian_replacingOrRemovingItDropsThePendingRequest() public {
        IPasskeyRecoveryExecutor.PasskeyKey memory key = _replacement();
        vm.prank(guardian);
        executor.requestRecovery(address(account), key, 0, "");

        address next = makeAddr("next guardian");
        vm.prank(address(account));
        executor.setGuardian(next, DELAY);
        vm.warp(block.timestamp + DELAY);
        vm.expectRevert(IPasskeyRecoveryExecutor.NoPendingRecovery.selector);
        executor.executeRecovery(address(account), key);
        // The replaced guardian has no authority left.
        vm.prank(guardian);
        vm.expectRevert(IPasskeyRecoveryExecutor.NotGuardian.selector);
        executor.requestRecovery(address(account), key, 0, "");

        vm.prank(next);
        executor.requestRecovery(address(account), key, 0, "");
        account.uninstall(address(executor));
        assertFalse(executor.isInitialized(address(account)));
        vm.warp(block.timestamp + DELAY);
        vm.expectRevert(IPasskeyRecoveryExecutor.NoPendingRecovery.selector);
        executor.executeRecovery(address(account), key);
        vm.prank(next);
        vm.expectRevert(IPasskeyRecoveryExecutor.NotEnrolled.selector);
        executor.requestRecovery(address(account), key, 0, "");
    }

    // ───────────── Failure keeps everything ─────────────

    function testExecute_aFailedRotationKeepsTheOldKeyTheRequestAndTheGuardian() public {
        IPasskeyRecoveryExecutor.PasskeyKey memory key = _replacement();
        vm.prank(guardian);
        executor.requestRecovery(address(account), key, 0, "");
        vm.warp(block.timestamp + DELAY);

        validator.setRefuseInstall(true);
        vm.expectRevert(MockPasskeyValidator.AlreadyInitialized.selector);
        executor.executeRecovery(address(account), key);
        assertEq(_currentKeyX(), GX);
        assertEq(executor.recoveryCount(address(account)), 0);
        assertEq(executor.enrollmentOf(address(account)).generation, 1);

        validator.setRefuseInstall(false);
        executor.executeRecovery(address(account), key);
        assertEq(_currentKeyX(), G2X);
    }

    function testExecute_restoresAnAccountWhoseKeyWasRemoved() public {
        // The key slot is empty: the account is unusable, and recovery is its only way back.
        vm.prank(address(account));
        validator.onUninstall("");
        IPasskeyRecoveryExecutor.PasskeyKey memory key = _replacement();
        vm.prank(guardian);
        executor.requestRecovery(address(account), key, 0, "");
        vm.warp(block.timestamp + DELAY);
        executor.executeRecovery(address(account), key);
        assertEq(_currentKeyX(), G2X);
    }

    function testExecute_refusesAnAccountThatChangedItsRootValidator() public {
        IPasskeyRecoveryExecutor.PasskeyKey memory key = _replacement();
        vm.prank(guardian);
        executor.requestRecovery(address(account), key, 0, "");
        vm.warp(block.timestamp + DELAY);
        account.setRootValidator(bytes21(abi.encodePacked(bytes1(0x01), makeAddr("new root"))));
        vm.expectRevert(IPasskeyRecoveryExecutor.UnsupportedAccount.selector);
        executor.executeRecovery(address(account), key);
    }

    function testExecute_refusesAnAccountThatUninstalledTheExecutorInKernelOnly() public {
        // The Kernel no longer lists the executor, but this contract was never told.
        IPasskeyRecoveryExecutor.PasskeyKey memory key = _replacement();
        vm.prank(guardian);
        executor.requestRecovery(address(account), key, 0, "");
        vm.warp(block.timestamp + DELAY);
        vm.store(address(account), keccak256(abi.encode(address(executor), uint256(1))), bytes32(0));
        vm.expectRevert(MockKernel.InvalidExecutor.selector);
        executor.executeRecovery(address(account), key);
        assertEq(_currentKeyX(), GX);
    }
}
