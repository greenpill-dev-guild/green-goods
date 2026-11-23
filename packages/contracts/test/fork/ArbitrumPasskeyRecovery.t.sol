// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";

import { PasskeyRecoveryExecutor } from "../../src/modules/PasskeyRecoveryExecutor.sol";
import { IPasskeyRecoveryExecutor } from "../../src/interfaces/IPasskeyRecoveryExecutor.sol";

struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    bytes32 accountGasLimits;
    uint256 preVerificationGas;
    bytes32 gasFees;
    bytes paymasterAndData;
    bytes signature;
}

interface IEntryPoint07 {
    function handleOps(PackedUserOperation[] calldata ops, address payable beneficiary) external;
    function getUserOpHash(PackedUserOperation calldata op) external view returns (bytes32);
    function getNonce(address sender, uint192 key) external view returns (uint256);
    function depositTo(address account) external payable;
}

interface IKernelMetaFactory {
    function deployWithFactory(address factory, bytes calldata createData, bytes32 salt) external payable returns (address);
}

interface IKernel033 {
    struct ValidationConfig {
        uint32 nonce;
        address hook;
    }

    function initialize(
        bytes21 rootValidator,
        address hook,
        bytes calldata validatorData,
        bytes calldata hookData,
        bytes[] calldata initConfig
    )
        external;
    function execute(bytes32 execMode, bytes calldata executionCalldata) external payable;
    function installModule(uint256 moduleType, address module, bytes calldata initData) external payable;
    function uninstallModule(uint256 moduleType, address module, bytes calldata deInitData) external payable;
    function installValidations(
        bytes21[] calldata vIds,
        ValidationConfig[] calldata configs,
        bytes[] calldata validationData,
        bytes[] calldata hookData
    )
        external
        payable;
    function uninstallValidation(bytes21 vId, bytes calldata deinitData, bytes calldata hookDeinitData) external payable;
    function grantAccess(bytes21 vId, bytes4 selector, bool allow) external payable;
    function invalidateNonce(uint32 nonce) external payable;
    function currentNonce() external view returns (uint32);
    function rootValidator() external view returns (bytes21);
    function isValidSignature(bytes32 hash, bytes calldata data) external view returns (bytes4);
    function isModuleInstalled(uint256 moduleType, address module, bytes calldata context) external view returns (bool);
    function accountId() external view returns (string memory);
}

/// @dev forge-std in this repository predates Foundry's P-256 cheatcodes.
interface IP256Cheats {
    function signP256(uint256 privateKey, bytes32 digest) external pure returns (bytes32 r, bytes32 s);
    function publicKeyP256(uint256 privateKey) external pure returns (uint256 x, uint256 y);
}

interface ISkipCheat {
    function skip(bool skipTest) external;
}

/// @dev Records that the account called it, so a test can tell an executed operation from a refused one.
contract CallTarget {
    mapping(address caller => uint256 count) public calls;

    function ping() external {
        calls[msg.sender]++;
    }
}

/// @title ArbitrumPasskeyRecoveryForkTest
/// @notice Wallet-guardian passkey recovery against the Kernel 0.3.3 account, WebAuthn validator,
/// permission signer and EntryPoint 0.7 that are deployed on Arbitrum One.
/// @dev The passkeys are P-256 keys this test holds. They sign the WebAuthn assertion a device
/// would produce (relying party hash, "user present and verified", client data naming the
/// challenge), and the deployed validator checks it through its fallback P-256 verifier.
/// Nothing here proves a browser ceremony, the directory binding, or sponsorship.
contract ArbitrumPasskeyRecoveryForkTest is Test {
    // The 0.3.3 account recipe pinned in packages/shared/src/modules/auth/account-profile.ts.
    address internal constant PASSKEY_VALIDATOR = 0x7ab16Ff354AcB328452F1D445b3Ddee9a91e9e69;
    address internal constant KERNEL_FACTORY = 0x2577507b78c2008Ff367261CB6285d44ba5eF2E9;
    address internal constant META_FACTORY = 0xd703aaE79538628d27099B8c4f621bE4CCd142d5;
    IEntryPoint07 internal constant ENTRY_POINT = IEntryPoint07(0x0000000071727De22E5E9d8BAf0edAc6f37da032);
    // The signer and policy contracts a Kernel permission is built from. Reporting grants use
    // this signer (VERIFIED_PERMISSION_MODULES in packages/shared/src/modules/agent-reporting/grants.ts).
    address internal constant ECDSA_SIGNER = 0x6A6F069E2a08c2468e7724Ab3250CdBFBA14D4FF;
    address internal constant SUDO_POLICY = 0x67b436caD8a6D025DF6C82C5BB43fbF11fC5B9B7;

    IP256Cheats internal constant P256 = IP256Cheats(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 internal constant P256_N = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551;
    bytes4 internal constant ERC1271_MAGIC = 0x1626ba7e;
    bytes4 internal constant EXECUTE_SELECTOR = bytes4(keccak256("execute(bytes32,bytes)"));
    string internal constant RP_ID = "greengoods.app";
    uint48 internal constant DELAY = 2 days;

    uint256 internal constant ORIGINAL_PASSKEY = uint256(keccak256("green goods fork: original passkey"));
    uint256 internal constant REPLACEMENT_PASSKEY = uint256(keccak256("green goods fork: replacement passkey"));
    bytes32 internal constant ORIGINAL_CREDENTIAL = keccak256("original credential id");
    bytes32 internal constant REPLACEMENT_CREDENTIAL = keccak256("replacement credential id");

    PasskeyRecoveryExecutor internal executor;
    IKernel033 internal account;
    CallTarget internal target;
    uint256 internal guardianKey = 0xA11CE;
    address internal guardian;
    address payable internal bundler = payable(makeAddr("bundler"));
    bool internal forked;

    function setUp() public {
        forked = _tryFork();
        if (!forked) return;
        guardian = vm.addr(guardianKey);
        executor = new PasskeyRecoveryExecutor(PASSKEY_VALIDATOR);
        target = new CallTarget();
        account = _deployAccount(ORIGINAL_PASSKEY, ORIGINAL_CREDENTIAL);
        vm.deal(address(this), 10 ether);
        ENTRY_POINT.depositTo{ value: 1 ether }(address(account));

        // Enrollment: the member's working passkey installs the executor with their wallet as guardian.
        _sendAsOwner(
            ORIGINAL_PASSKEY,
            abi.encodeCall(
                IKernel033.installModule,
                (2, address(executor), abi.encodePacked(address(0), abi.encode(abi.encode(guardian, DELAY), bytes(""))))
            )
        );
    }

    modifier onFork() {
        // Without a fork nothing below can run, and a pass would claim proof that was never taken.
        if (!forked) ISkipCheat(address(vm)).skip(true);
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Enrollment
    // ═══════════════════════════════════════════════════════════════════════════

    function testEnrollment_isOwnerSignedAndVisibleOnChain() public onFork {
        assertEq(account.accountId(), "kernel.advanced.v0.3.3");
        assertEq(account.rootValidator(), executor.ROOT_VALIDATION_ID());
        assertTrue(account.isModuleInstalled(2, address(executor), ""));
        IPasskeyRecoveryExecutor.Enrollment memory enrollment = executor.enrollmentOf(address(account));
        assertEq(enrollment.guardian, guardian);
        assertEq(enrollment.delay, DELAY);
        assertEq(enrollment.generation, 1);
    }

    function testEnrollment_needsTheExecutorInstalledOnTheAccount() public onFork {
        // A real Kernel that never installed the executor cannot hold an enrollment, so none can
        // come to life later without the member's passkey installing the module.
        IKernel033 other = _deployAccount(REPLACEMENT_PASSKEY, REPLACEMENT_CREDENTIAL);
        vm.prank(address(other));
        vm.expectRevert(IPasskeyRecoveryExecutor.UnsupportedAccount.selector);
        executor.setGuardian(makeAddr("some wallet"), DELAY);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Recovery at the same address
    // ═══════════════════════════════════════════════════════════════════════════

    function testRecovery_replacesThePasskeyAtTheSameAddressAfterTheDelay() public onFork {
        bytes32 codeHashBefore = address(account).codehash;
        _assertOwnerCanAct(ORIGINAL_PASSKEY, "the original passkey works before recovery");

        IPasskeyRecoveryExecutor.PasskeyKey memory key = _key(REPLACEMENT_PASSKEY, REPLACEMENT_CREDENTIAL);
        uint256 deadline = block.timestamp + 1 hours;
        // A relayer carries the guardian wallet's approval; the wallet itself holds no ETH here.
        assertEq(guardian.balance, 0);
        vm.prank(bundler);
        executor.requestRecovery(address(account), key, deadline, _approval(key, 1, deadline));

        // Before the delay the old passkey is still the owner and the request cannot run.
        uint48 executeAfter = executor.pendingRecoveryOf(address(account)).executeAfter;
        vm.warp(executeAfter - 1);
        vm.expectRevert(abi.encodeWithSelector(IPasskeyRecoveryExecutor.RecoveryNotReady.selector, executeAfter));
        executor.executeRecovery(address(account), key);
        _assertOwnerCanAct(ORIGINAL_PASSKEY, "the original passkey works while a request waits");

        vm.warp(executeAfter);
        vm.prank(bundler);
        executor.executeRecovery(address(account), key);

        // Same account: address, proxy code and root validator are unchanged.
        assertEq(address(account).codehash, codeHashBefore);
        assertEq(account.rootValidator(), executor.ROOT_VALIDATION_ID());
        assertEq(executor.recoveryCount(address(account)), 1);

        // The replacement passkey signs operations and messages at the original address.
        _assertOwnerCanAct(REPLACEMENT_PASSKEY, "the replacement passkey works after recovery");
        bytes32 message = keccak256("sign in to Green Goods");
        assertEq(
            account.isValidSignature(message, _messageSignature(REPLACEMENT_PASSKEY, message)),
            ERC1271_MAGIC,
            "the replacement passkey must sign messages for the original address"
        );

        // The lost passkey is refused by EntryPoint and for messages.
        PackedUserOperation memory stale = _ownerOperation(ORIGINAL_PASSKEY, _pingCall());
        vm.expectRevert(abi.encodeWithSignature("FailedOp(uint256,string)", 0, "AA24 signature error"));
        _handle(stale);
        assertTrue(
            account.isValidSignature(message, _messageSignature(ORIGINAL_PASSKEY, message)) != ERC1271_MAGIC,
            "the lost passkey must not sign messages"
        );

        // On its own the replacement credential derives another address, which is why sign-in
        // needs a record that points it at the original account.
        assertTrue(address(_deployAccount(REPLACEMENT_PASSKEY, REPLACEMENT_CREDENTIAL)) != address(account));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Cancellation and replay
    // ═══════════════════════════════════════════════════════════════════════════

    function testCancellation_byTheCurrentPasskeyHoldsAfterTheDelay() public onFork {
        IPasskeyRecoveryExecutor.PasskeyKey memory key = _key(REPLACEMENT_PASSKEY, REPLACEMENT_CREDENTIAL);
        uint256 deadline = block.timestamp + 10 days;
        bytes memory approval = _approval(key, 1, deadline);
        executor.requestRecovery(address(account), key, deadline, approval);

        // The member still has their passkey and cancels from the account.
        _sendAsOwner(
            ORIGINAL_PASSKEY,
            _execute(address(executor), abi.encodeCall(PasskeyRecoveryExecutor.cancelRecovery, (address(account))))
        );

        vm.warp(block.timestamp + DELAY + 1);
        vm.expectRevert(IPasskeyRecoveryExecutor.NoPendingRecovery.selector);
        executor.executeRecovery(address(account), key);
        // The cancelled approval cannot start another request, even though its deadline is ahead.
        vm.expectRevert(IPasskeyRecoveryExecutor.NotGuardian.selector);
        executor.requestRecovery(address(account), key, deadline, approval);
        _assertOwnerCanAct(ORIGINAL_PASSKEY, "the original passkey still owns the account after cancelling");
        assertEq(executor.recoveryCount(address(account)), 0);
    }

    function testReplay_aSpentApprovalCannotRotateAgain() public onFork {
        IPasskeyRecoveryExecutor.PasskeyKey memory key = _key(REPLACEMENT_PASSKEY, REPLACEMENT_CREDENTIAL);
        uint256 deadline = block.timestamp + 10 days;
        bytes memory approval = _approval(key, 1, deadline);
        executor.requestRecovery(address(account), key, deadline, approval);
        vm.expectRevert(IPasskeyRecoveryExecutor.RecoveryAlreadyPending.selector);
        executor.requestRecovery(address(account), key, deadline, approval);

        vm.warp(block.timestamp + DELAY);
        executor.executeRecovery(address(account), key);

        vm.expectRevert(IPasskeyRecoveryExecutor.NoPendingRecovery.selector);
        executor.executeRecovery(address(account), key);
        vm.expectRevert(IPasskeyRecoveryExecutor.NotGuardian.selector);
        executor.requestRecovery(address(account), key, deadline, approval);

        // An approval signed for another chain's copy of this contract is a different digest.
        vm.chainId(100);
        bytes memory otherChain = _approval(key, 2, deadline);
        vm.chainId(42_161);
        vm.expectRevert(IPasskeyRecoveryExecutor.NotGuardian.selector);
        executor.requestRecovery(address(account), key, deadline, otherChain);
    }

    function testRemoval_theOwnerCanTakeTheGuardianAway() public onFork {
        _sendAsOwner(ORIGINAL_PASSKEY, abi.encodeCall(IKernel033.uninstallModule, (2, address(executor), "")));
        assertFalse(account.isModuleInstalled(2, address(executor), ""));
        assertFalse(executor.isInitialized(address(account)));
        IPasskeyRecoveryExecutor.PasskeyKey memory key = _key(REPLACEMENT_PASSKEY, REPLACEMENT_CREDENTIAL);
        vm.prank(guardian);
        vm.expectRevert(IPasskeyRecoveryExecutor.NotEnrolled.selector);
        executor.requestRecovery(address(account), key, 0, "");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Existing agent access
    // ═══════════════════════════════════════════════════════════════════════════

    function testAgentAccess_survivesRecoveryUntilTheRecoveredOwnerRemovesIt() public onFork {
        (uint256 agentKey, bytes4 permissionId) = _grantPermission("reporting agent");
        (uint256 otherKey, bytes4 otherPermission) = _grantPermission("second agent");
        _handle(_permissionOperation(agentKey, permissionId));
        _handle(_permissionOperation(otherKey, otherPermission));
        assertEq(target.calls(address(account)), 2, "both grants work before recovery");

        _recoverNow();

        // Replacing the passkey leaves both grants exactly as they were.
        _handle(_permissionOperation(agentKey, permissionId));
        _handle(_permissionOperation(otherKey, otherPermission));
        assertEq(target.calls(address(account)), 4, "both grants still work after recovery");

        // The recovered owner removes one grant by its ID.
        bytes[] memory disable = new bytes[](2);
        _sendAsOwner(
            REPLACEMENT_PASSKEY,
            abi.encodeCall(IKernel033.uninstallValidation, (_permissionValidation(permissionId), abi.encode(disable), ""))
        );
        PackedUserOperation memory refused = _permissionOperation(agentKey, permissionId);
        // The account's validation of the removed grant reverts, with no data of its own.
        vm.expectRevert(abi.encodeWithSignature("FailedOpWithRevert(uint256,string,bytes)", 0, "AA23 reverted", ""));
        _handle(refused);
        assertEq(target.calls(address(account)), 4, "the removed grant can no longer act");

        // The other grant and the owner's own signing are untouched.
        _handle(_permissionOperation(otherKey, otherPermission));
        assertEq(target.calls(address(account)), 5, "the grant that was kept still works");
        _assertOwnerCanAct(REPLACEMENT_PASSKEY, "the recovered owner still sends operations");
        bytes32 message = keccak256("after targeted removal");
        assertEq(account.isValidSignature(message, _messageSignature(REPLACEMENT_PASSKEY, message)), ERC1271_MAGIC);
    }

    function testAgentAccess_aNonceSweepAlsoBreaksTheOwnersMessageSigning() public onFork {
        (uint256 agentKey, bytes4 permissionId) = _grantPermission("reporting agent");
        _recoverNow();

        // Revoking everything at once by raising the account's validation nonce.
        _sendAsOwner(REPLACEMENT_PASSKEY, abi.encodeCall(IKernel033.invalidateNonce, (account.currentNonce() + 1)));
        PackedUserOperation memory refused = _permissionOperation(agentKey, permissionId);
        vm.expectRevert(
            abi.encodeWithSignature(
                "FailedOpWithRevert(uint256,string,bytes)", 0, "AA23 reverted", abi.encodeWithSignature("InvalidNonce()")
            )
        );
        _handle(refused);

        _assertOwnerCanAct(REPLACEMENT_PASSKEY, "the owner still sends operations after a sweep");
        bytes32 message = keccak256("after a nonce sweep");
        bytes memory signature = _messageSignature(REPLACEMENT_PASSKEY, message);
        vm.expectRevert(abi.encodeWithSignature("InvalidNonce()"));
        account.isValidSignature(message, signature);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Fork, account and recovery helpers
    // ═══════════════════════════════════════════════════════════════════════════

    function _tryFork() internal returns (bool) {
        // A fork shard already runs this process on its pinned Arbitrum fork.
        if (block.chainid == 42_161) return true;
        string memory rpc;
        try vm.envString("ARBITRUM_FORK_RPC_URL") returns (string memory value) {
            rpc = value;
        } catch {
            try vm.envString("ARBITRUM_RPC_URL") returns (string memory value) {
                rpc = value;
            } catch {
                return false;
            }
        }
        if (bytes(rpc).length == 0) return false;
        uint256 forkBlock;
        try vm.envUint("ARBITRUM_FORK_BLOCK_NUMBER") returns (uint256 value) {
            forkBlock = value;
        } catch { }
        if (forkBlock == 0) vm.createSelectFork(rpc);
        else vm.createSelectFork(rpc, forkBlock);
        return true;
    }

    function _key(uint256 passkey, bytes32 credential) internal pure returns (IPasskeyRecoveryExecutor.PasskeyKey memory) {
        (uint256 x, uint256 y) = P256.publicKeyP256(passkey);
        return IPasskeyRecoveryExecutor.PasskeyKey({ pubKeyX: x, pubKeyY: y, authenticatorIdHash: credential });
    }

    /// @dev The account the app builds: the meta factory deploys a Kernel 0.3.3 proxy whose root is
    /// the WebAuthn validator holding this passkey.
    function _deployAccount(uint256 passkey, bytes32 credential) internal returns (IKernel033) {
        (uint256 x, uint256 y) = P256.publicKeyP256(passkey);
        bytes memory createData = abi.encodeCall(
            IKernel033.initialize,
            (
                bytes21(abi.encodePacked(bytes1(0x01), PASSKEY_VALIDATOR)),
                address(0),
                abi.encode(x, y, credential),
                "",
                new bytes[](0)
            )
        );
        return IKernel033(IKernelMetaFactory(META_FACTORY).deployWithFactory(KERNEL_FACTORY, createData, bytes32(0)));
    }

    function _approval(
        IPasskeyRecoveryExecutor.PasskeyKey memory key,
        uint32 generation,
        uint256 deadline
    )
        internal
        view
        returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(guardianKey, executor.recoveryDigest(address(account), key, generation, deadline));
        return abi.encodePacked(r, s, v);
    }

    function _recoverNow() internal {
        IPasskeyRecoveryExecutor.PasskeyKey memory key = _key(REPLACEMENT_PASSKEY, REPLACEMENT_CREDENTIAL);
        uint32 generation = executor.enrollmentOf(address(account)).generation;
        uint256 deadline = block.timestamp + 1 hours;
        executor.requestRecovery(address(account), key, deadline, _approval(key, generation, deadline));
        vm.warp(block.timestamp + DELAY);
        executor.executeRecovery(address(account), key);
    }

    function _assertOwnerCanAct(uint256 passkey, string memory what) internal {
        uint256 before = target.calls(address(account));
        _sendAsOwner(passkey, _pingCall());
        assertEq(target.calls(address(account)), before + 1, what);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Operations
    // ═══════════════════════════════════════════════════════════════════════════

    function _pingCall() internal view returns (bytes memory) {
        return _execute(address(target), abi.encodeCall(CallTarget.ping, ()));
    }

    /// @dev Kernel's single-call execution.
    function _execute(address to, bytes memory data) internal pure returns (bytes memory) {
        return abi.encodeCall(IKernel033.execute, (bytes32(0), abi.encodePacked(to, uint256(0), data)));
    }

    function _operation(uint192 nonceKey, bytes memory callData) internal view returns (PackedUserOperation memory op) {
        op.sender = address(account);
        op.nonce = ENTRY_POINT.getNonce(address(account), nonceKey);
        op.callData = callData;
        // Verification covers the validator's fallback P-256 verifier; the account pays from its deposit.
        op.accountGasLimits = bytes32((uint256(3_000_000) << 128) | uint256(1_500_000));
        op.preVerificationGas = 100_000;
        op.gasFees = bytes32((uint256(0) << 128) | uint256(100_000_000));
    }

    function _handle(PackedUserOperation memory op) internal {
        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;
        vm.prank(bundler, bundler);
        ENTRY_POINT.handleOps(ops, bundler);
    }

    /// @dev An operation the root passkey signs: Kernel's default mode with the root validator.
    function _ownerOperation(uint256 passkey, bytes memory callData) internal view returns (PackedUserOperation memory op) {
        op = _operation(uint192(bytes24(abi.encodePacked(bytes2(0), PASSKEY_VALIDATOR, bytes2(0)))), callData);
        op.signature = _assertion(passkey, ENTRY_POINT.getUserOpHash(op));
    }

    function _sendAsOwner(uint256 passkey, bytes memory callData) internal {
        _handle(_ownerOperation(passkey, callData));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Permissions (the shape of an agent grant)
    // ═══════════════════════════════════════════════════════════════════════════

    function _permissionValidation(bytes4 permissionId) internal pure returns (bytes21) {
        return bytes21(abi.encodePacked(bytes1(0x02), permissionId, bytes16(0)));
    }

    /// @dev The owner installs a permission (a policy and an ECDSA signer for the agent's key) and
    /// allows it to call `execute`, as the passkey does when it approves a reporting grant.
    function _grantPermission(string memory label) internal returns (uint256 agentKey, bytes4 permissionId) {
        agentKey = uint256(keccak256(bytes(label)));
        permissionId = bytes4(keccak256(bytes(label)));
        bytes21[] memory ids = new bytes21[](1);
        ids[0] = _permissionValidation(permissionId);
        IKernel033.ValidationConfig[] memory configs = new IKernel033.ValidationConfig[](1);
        configs[0] = IKernel033.ValidationConfig({ nonce: account.currentNonce(), hook: address(0) });
        bytes[] memory policyAndSigner = new bytes[](2);
        policyAndSigner[0] = abi.encodePacked(bytes2(0), SUDO_POLICY);
        policyAndSigner[1] = abi.encodePacked(bytes2(0), ECDSA_SIGNER, vm.addr(agentKey));
        bytes[] memory data = new bytes[](1);
        data[0] = abi.encode(policyAndSigner);
        bytes[] memory hookData = new bytes[](1);
        _sendAsOwner(ORIGINAL_PASSKEY, abi.encodeCall(IKernel033.installValidations, (ids, configs, data, hookData)));
        _sendAsOwner(ORIGINAL_PASSKEY, abi.encodeCall(IKernel033.grantAccess, (ids[0], EXECUTE_SELECTOR, true)));
    }

    function _permissionOperation(
        uint256 agentKey,
        bytes4 permissionId
    )
        internal
        view
        returns (PackedUserOperation memory op)
    {
        op = _operation(
            uint192(bytes24(abi.encodePacked(bytes1(0), bytes1(0x02), permissionId, bytes16(0), bytes2(0)))), _pingCall()
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", ENTRY_POINT.getUserOpHash(op)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(agentKey, digest);
        op.signature = abi.encodePacked(bytes1(0xff), r, s, v);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // WebAuthn assertions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev What a device returns when asked to sign `challenge`, in the encoding the validator reads.
    function _assertion(uint256 passkey, bytes32 challenge) internal pure returns (bytes memory) {
        bytes memory authenticatorData = abi.encodePacked(sha256(bytes(RP_ID)), bytes1(0x05), bytes4(0));
        string memory clientDataJSON = string.concat(
            '{"type":"webauthn.get","challenge":"',
            _base64Url(challenge),
            '","origin":"https://greengoods.app","crossOrigin":false}'
        );
        (bytes32 r, bytes32 s) =
            P256.signP256(passkey, sha256(abi.encodePacked(authenticatorData, sha256(bytes(clientDataJSON)))));
        // The verifier refuses the high half of the curve order.
        if (uint256(s) > P256_N / 2) s = bytes32(P256_N - uint256(s));
        return abi.encode(authenticatorData, clientDataJSON, uint256(1), uint256(r), uint256(s), false);
    }

    /// @dev An ERC-1271 signature as the app sends it: Kernel wraps the hash in its own typed data
    /// before the validator sees it, and the signature names the validator it is for.
    function _messageSignature(uint256 passkey, bytes32 hash) internal view returns (bytes memory) {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("Kernel"),
                keccak256("0.3.3"),
                block.chainid,
                address(account)
            )
        );
        bytes32 wrapped = keccak256(
            abi.encodePacked("\x19\x01", domainSeparator, keccak256(abi.encode(keccak256("Kernel(bytes32 hash)"), hash)))
        );
        return abi.encodePacked(bytes1(0x01), PASSKEY_VALIDATOR, _assertion(passkey, wrapped));
    }

    function _base64Url(bytes32 value) internal pure returns (string memory) {
        bytes memory alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
        bytes memory input = abi.encodePacked(value);
        // 32 bytes encode to 43 characters without padding.
        bytes memory out = new bytes(43);
        uint256 o;
        for (uint256 i; i < 30; i += 3) {
            uint256 chunk = (uint256(uint8(input[i])) << 16) | (uint256(uint8(input[i + 1])) << 8) | uint8(input[i + 2]);
            out[o++] = alphabet[(chunk >> 18) & 63];
            out[o++] = alphabet[(chunk >> 12) & 63];
            out[o++] = alphabet[(chunk >> 6) & 63];
            out[o++] = alphabet[chunk & 63];
        }
        uint256 tail = (uint256(uint8(input[30])) << 16) | (uint256(uint8(input[31])) << 8);
        out[o++] = alphabet[(tail >> 18) & 63];
        out[o++] = alphabet[(tail >> 12) & 63];
        out[o++] = alphabet[(tail >> 6) & 63];
        return string(out);
    }
}
