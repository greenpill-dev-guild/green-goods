// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";

import { IERC6551Registry } from "../../src/interfaces/IERC6551Registry.sol";
import { SALT, TOKENBOUND_REGISTRY } from "../../src/lib/TBA.sol";

interface IAccountGuardianView {
    function owner() external view returns (address);
    function isTrustedExecutor(address executor) external view returns (bool);
    function setTrustedExecutor(address executor, bool trusted) external;
}

interface IForeignGardenAccount {
    function owner() external view returns (address);
    function execute(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    )
        external
        payable
        returns (bytes memory);
}

interface ISafeProxyFactoryV141 {
    function createProxyWithNonce(
        address singleton,
        bytes memory initializer,
        uint256 saltNonce
    )
        external
        returns (address proxy);
}

interface ISafeV141 {
    function VERSION() external view returns (string memory);
    function getOwners() external view returns (address[] memory);
    function getThreshold() external view returns (uint256);
    function nonce() external view returns (uint256);

    function encodeTransactionData(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 safeNonce
    )
        external
        view
        returns (bytes memory);

    function getTransactionHash(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 safeNonce
    )
        external
        view
        returns (bytes32);

    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes calldata signatures
    )
        external
        payable
        returns (bool success);
}

interface ICompatibilityFallbackHandlerV141 {
    function getMessageHashForSafe(address safe, bytes calldata message) external view returns (bytes32);
}

contract GardenSafeOwnerTarget {
    uint256 public calls;

    function record() external {
        calls++;
    }
}

/// @title CrossChainGardenSafeOwnerForkTest
/// @notice Fork-only spike for an Arbitrum Garden ERC-6551 account occupying one owner slot in a
///         real Celo Safe v1.4.1 proxy. This proves mechanics, not production deployment or source
///         authentication. The exact production gates live in erc6551-garden-safe-owner-spike.md.
contract CrossChainGardenSafeOwnerForkTest is Test {
    uint256 private constant ARBITRUM_CHAIN_ID = 42_161;
    uint256 private constant CELO_CHAIN_ID = 42_220;
    uint256 private constant ROOT_GARDEN_TOKEN_ID = 0;
    uint256 private constant RECOVERY_ONE_KEY = 0xA11CE;
    uint256 private constant RECOVERY_TWO_KEY = 0xB0B;

    address private constant ARBITRUM_GARDEN_TOKEN = 0xe1Da335110b1ed48e7df63209f5D424d02276593;
    address private constant ARBITRUM_GARDEN_IMPLEMENTATION = 0xE31cAeAc029A60AD17A49278Fdd58032eF9Cf692;
    address private constant ARBITRUM_ROOT_GARDEN = 0xf401f34378384713222d1d21f63359cc4E8a858a;

    address private constant CELO_GARDEN_IMPLEMENTATION = 0x710cBFB9a29920B4577692eD495972fcd27286b4;
    address private constant CELO_ACCOUNT_GUARDIAN = 0xCE1Cf0e0c11500560C153778FA5428a6e1dBa8cC;
    address private constant SAFE_SINGLETON_V141 = 0x29fcB43b46531BcA003ddC8FCB67FFE91900C762;
    address private constant SAFE_FACTORY_V141 = 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67;
    address private constant SAFE_COMPATIBILITY_HANDLER_V141 = 0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99;

    uint256 private arbitrumFork;
    uint256 private celoFork;
    bool private forked;

    address private recoverySignerOne;
    address private recoverySignerTwo;
    ISafeV141 private recoverySafeOne;
    ISafeV141 private recoverySafeTwo;
    address private foreignGardenAccount;
    ISafeV141 private gardenSafe;
    GardenSafeOwnerTarget private target;

    function setUp() public {
        string memory arbitrumRpc = _rpcUrl("ARBITRUM_RPC_URL");
        string memory celoRpc = _rpcUrl("CELO_RPC_URL");
        if (bytes(arbitrumRpc).length == 0 || bytes(celoRpc).length == 0) return;

        arbitrumFork = _createPinnedFork(arbitrumRpc, "ARBITRUM_FORK_BLOCK_NUMBER");
        celoFork = _createPinnedFork(celoRpc, "CELO_FORK_BLOCK_NUMBER");
        forked = true;

        recoverySignerOne = vm.addr(RECOVERY_ONE_KEY);
        recoverySignerTwo = vm.addr(RECOVERY_TWO_KEY);

        vm.selectFork(celoFork);
        foreignGardenAccount = IERC6551Registry(TOKENBOUND_REGISTRY)
            .createAccount(CELO_GARDEN_IMPLEMENTATION, SALT, ARBITRUM_CHAIN_ID, ARBITRUM_GARDEN_TOKEN, ROOT_GARDEN_TOKEN_ID);

        IAccountGuardianView guardian = IAccountGuardianView(CELO_ACCOUNT_GUARDIAN);
        vm.prank(guardian.owner());
        guardian.setTrustedExecutor(address(this), true);

        recoverySafeOne = ISafeV141(_deployRecoverySafe(recoverySignerOne, 1));
        recoverySafeTwo = ISafeV141(_deployRecoverySafe(recoverySignerTwo, 2));
        gardenSafe = ISafeV141(_deployGardenSafe(foreignGardenAccount));
        target = new GardenSafeOwnerTarget();
    }

    function testExactSourceTuplePredictsOneAddressButCodeIsNotDeployedCrossChain() public {
        if (!forked) return;

        vm.selectFork(arbitrumFork);
        address arbitrumPrediction = _sourceAccount(ARBITRUM_GARDEN_IMPLEMENTATION, ROOT_GARDEN_TOKEN_ID);
        assertEq(arbitrumPrediction, ARBITRUM_ROOT_GARDEN, "Arbitrum deployment artifact drifted");
        assertGt(arbitrumPrediction.code.length, 0, "live Arbitrum Garden account has no code");

        vm.selectFork(celoFork);
        address celoPrediction = _sourceAccount(ARBITRUM_GARDEN_IMPLEMENTATION, ROOT_GARDEN_TOKEN_ID);
        assertEq(celoPrediction, arbitrumPrediction, "canonical ERC-6551 derivation changed across chains");
        assertEq(celoPrediction.code.length, 0, "exact Arbitrum Garden account is unexpectedly deployed on Celo");
        assertTrue(foreignGardenAccount != celoPrediction, "different implementations cannot prove same-address deployment");
    }

    function testForeignAccountHasNoLocalNftOwnerAndRejectsUntrustedExecution() public {
        if (!forked) return;
        vm.selectFork(celoFork);

        assertEq(IForeignGardenAccount(foreignGardenAccount).owner(), address(0), "foreign token exposed a local owner");

        IAccountGuardianView guardian = IAccountGuardianView(CELO_ACCOUNT_GUARDIAN);
        vm.prank(guardian.owner());
        guardian.setTrustedExecutor(address(this), false);

        (bool success,) = foreignGardenAccount.call(
            abi.encodeCall(IForeignGardenAccount.execute, (address(target), 0, abi.encodeCall(target.record, ()), 0))
        );
        assertFalse(success, "untrusted caller executed the foreign Garden account");
        assertEq(target.calls(), 0, "untrusted call reached its target");
    }

    function testSafeOwnerSetIsExactAndThresholdTwo() public {
        if (!forked) return;
        vm.selectFork(celoFork);

        assertEq(gardenSafe.VERSION(), "1.4.1", "unexpected Safe singleton release");
        assertEq(gardenSafe.getThreshold(), 2, "Garden Safe threshold drifted");

        address[] memory owners = gardenSafe.getOwners();
        assertEq(owners.length, 3, "Garden Safe owner count drifted");
        assertTrue(_contains(owners, foreignGardenAccount), "Garden account missing from owner set");
        assertTrue(_contains(owners, address(recoverySafeOne)), "first recovery Safe missing");
        assertTrue(_contains(owners, address(recoverySafeTwo)), "second recovery Safe missing");
    }

    function testGardenAccountPlusOneRecoveryOwnerExecutes() public {
        if (!forked) return;
        vm.selectFork(celoFork);

        bytes memory action = abi.encodeCall(target.record, ());
        bytes memory safeData = _safeData(address(target), action, gardenSafe.nonce());
        bytes memory signatures = _gardenAndRecoverySignatures(address(recoverySafeOne), RECOVERY_ONE_KEY, safeData);

        bytes memory safeCall = _safeCall(address(target), action, signatures);
        IForeignGardenAccount(foreignGardenAccount).execute(address(gardenSafe), 0, safeCall, 0);

        assertEq(target.calls(), 1, "Garden plus recovery threshold did not execute");
        assertEq(gardenSafe.nonce(), 1, "Safe nonce did not advance");
    }

    function testNeitherGardenNorOneRecoveryOwnerCanExecuteAlone() public {
        if (!forked) return;
        vm.selectFork(celoFork);

        bytes memory action = abi.encodeCall(target.record, ());
        bytes memory gardenOnlyCall = _safeCall(address(target), action, _prevalidatedSignature(foreignGardenAccount));
        (bool gardenOnly,) = foreignGardenAccount.call(
            abi.encodeCall(IForeignGardenAccount.execute, (address(gardenSafe), 0, gardenOnlyCall, 0))
        );
        assertFalse(gardenOnly, "Garden owner bypassed threshold 2");

        bytes memory safeData = _safeData(address(target), action, gardenSafe.nonce());
        bytes memory recoveryOnlyCall = _safeCall(
            address(target), action, _singleRecoverySignature(address(recoverySafeOne), RECOVERY_ONE_KEY, safeData)
        );
        (bool recoveryOnly,) = address(gardenSafe).call(recoveryOnlyCall);
        assertFalse(recoveryOnly, "one recovery owner bypassed threshold 2");
        assertEq(target.calls(), 0, "a single owner reached the target");
        assertEq(gardenSafe.nonce(), 0, "failed threshold checks changed the Safe nonce");
    }

    function testBothRecoveryOwnersCanExecuteWithoutGardenAccount() public {
        if (!forked) return;
        vm.selectFork(celoFork);

        bytes memory action = abi.encodeCall(target.record, ());
        bytes memory safeData = _safeData(address(target), action, gardenSafe.nonce());
        bytes memory signatures = _bothRecoverySignatures(safeData);

        bool success = gardenSafe.execTransaction(
            address(target), 0, action, 0, 0, 0, 0, address(0), payable(address(0)), signatures
        );
        assertTrue(success, "two-owner recovery transaction failed");
        assertEq(target.calls(), 1, "recovery transaction did not reach target");
    }

    function testDifferentGardenAccountCannotSubstituteForSafeOwner() public {
        if (!forked) return;
        vm.selectFork(celoFork);

        address otherGardenAccount = IERC6551Registry(TOKENBOUND_REGISTRY)
            .createAccount(CELO_GARDEN_IMPLEMENTATION, SALT, ARBITRUM_CHAIN_ID, ARBITRUM_GARDEN_TOKEN, 1);
        bytes memory action = abi.encodeCall(target.record, ());
        bytes memory safeData = _safeData(address(target), action, gardenSafe.nonce());
        bytes memory signatures =
            _gardenAndRecoverySignaturesFor(otherGardenAccount, address(recoverySafeOne), RECOVERY_ONE_KEY, safeData);
        bytes memory safeCall = _safeCall(address(target), action, signatures);

        (bool success,) =
            otherGardenAccount.call(abi.encodeCall(IForeignGardenAccount.execute, (address(gardenSafe), 0, safeCall, 0)));
        assertFalse(success, "another Garden account substituted for the Safe owner");
        assertEq(target.calls(), 0, "wrong Garden account reached the target");
    }

    function testExecutedSafeTransactionCannotReplay() public {
        if (!forked) return;
        vm.selectFork(celoFork);

        bytes memory action = abi.encodeCall(target.record, ());
        bytes memory safeData = _safeData(address(target), action, gardenSafe.nonce());
        bytes memory signatures = _gardenAndRecoverySignatures(address(recoverySafeOne), RECOVERY_ONE_KEY, safeData);
        bytes memory safeCall = _safeCall(address(target), action, signatures);

        IForeignGardenAccount(foreignGardenAccount).execute(address(gardenSafe), 0, safeCall, 0);
        (bool replayed,) = foreignGardenAccount.call(
            abi.encodeCall(IForeignGardenAccount.execute, (address(gardenSafe), 0, safeCall, 0))
        );

        assertFalse(replayed, "executed Safe transaction replayed");
        assertEq(target.calls(), 1, "replay reached target twice");
        assertEq(gardenSafe.nonce(), 1, "failed replay changed the Safe nonce");
    }

    function _deployGardenSafe(address gardenOwner) private returns (address safe) {
        address[] memory owners = new address[](3);
        owners[0] = gardenOwner;
        owners[1] = address(recoverySafeOne);
        owners[2] = address(recoverySafeTwo);
        _sort(owners);

        uint256 saltNonce = uint256(keccak256(abi.encode("GG_ERC6551_SAFE_OWNER_SPIKE", gardenOwner)));
        return _deploySafeProxy(owners, 2, saltNonce);
    }

    function _deployRecoverySafe(address recoverySigner, uint256 saltNonce) private returns (address) {
        address[] memory owners = new address[](1);
        owners[0] = recoverySigner;
        return _deploySafeProxy(owners, 1, saltNonce);
    }

    function _deploySafeProxy(address[] memory owners, uint256 threshold, uint256 saltNonce)
        private
        returns (address safe)
    {
        assertGt(SAFE_SINGLETON_V141.code.length, 0, "Safe v1.4.1 singleton is missing");
        assertGt(SAFE_FACTORY_V141.code.length, 0, "Safe v1.4.1 factory is missing");
        assertGt(SAFE_COMPATIBILITY_HANDLER_V141.code.length, 0, "Safe compatibility handler is missing");

        bytes memory initializer = abi.encodeWithSignature(
            "setup(address[],uint256,address,bytes,address,address,uint256,address)",
            owners,
            threshold,
            address(0),
            bytes(""),
            SAFE_COMPATIBILITY_HANDLER_V141,
            address(0),
            0,
            address(0)
        );
        safe = ISafeProxyFactoryV141(SAFE_FACTORY_V141).createProxyWithNonce(SAFE_SINGLETON_V141, initializer, saltNonce);
    }

    function _safeData(address to, bytes memory data, uint256 safeNonce) private view returns (bytes memory) {
        return gardenSafe.encodeTransactionData(to, 0, data, 0, 0, 0, 0, address(0), address(0), safeNonce);
    }

    function _safeCall(address to, bytes memory data, bytes memory signatures) private pure returns (bytes memory) {
        return
            abi.encodeCall(
                ISafeV141.execTransaction, (to, 0, data, 0, 0, 0, 0, address(0), payable(address(0)), signatures)
            );
    }

    function _prevalidatedSignature(address owner) private pure returns (bytes memory) {
        return abi.encodePacked(bytes32(uint256(uint160(owner))), bytes32(0), uint8(1));
    }

    function _ecdsaSignature(uint256 privateKey, bytes32 txHash) private pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, txHash);
        return abi.encodePacked(r, s, v);
    }

    function _gardenAndRecoverySignatures(
        address recoverySafe,
        uint256 recoveryKey,
        bytes memory safeData
    )
        private
        view
        returns (bytes memory)
    {
        return _gardenAndRecoverySignaturesFor(foreignGardenAccount, recoverySafe, recoveryKey, safeData);
    }

    function _gardenAndRecoverySignaturesFor(
        address gardenOwner,
        address recoverySafe,
        uint256 recoveryKey,
        bytes memory safeData
    )
        private
        view
        returns (bytes memory)
    {
        bytes memory gardenStatic = _prevalidatedSignature(gardenOwner);
        bytes memory recoveryInner = _recoveryInnerSignature(recoverySafe, recoveryKey, safeData);
        bytes memory recoveryStatic = _contractSignatureStatic(recoverySafe, 130);
        bytes memory staticSignatures = gardenOwner < recoverySafe
            ? abi.encodePacked(gardenStatic, recoveryStatic)
            : abi.encodePacked(recoveryStatic, gardenStatic);
        return abi.encodePacked(staticSignatures, uint256(recoveryInner.length), recoveryInner);
    }

    function _singleRecoverySignature(
        address recoverySafe,
        uint256 recoveryKey,
        bytes memory safeData
    )
        private
        view
        returns (bytes memory)
    {
        bytes memory recoveryInner = _recoveryInnerSignature(recoverySafe, recoveryKey, safeData);
        return abi.encodePacked(
            _contractSignatureStatic(recoverySafe, 130), new bytes(65), uint256(recoveryInner.length), recoveryInner
        );
    }

    function _bothRecoverySignatures(bytes memory safeData) private view returns (bytes memory) {
        address firstSafe = address(recoverySafeOne);
        address secondSafe = address(recoverySafeTwo);
        uint256 firstKey = RECOVERY_ONE_KEY;
        uint256 secondKey = RECOVERY_TWO_KEY;
        if (firstSafe > secondSafe) {
            (firstSafe, secondSafe) = (secondSafe, firstSafe);
            (firstKey, secondKey) = (secondKey, firstKey);
        }

        bytes memory firstInner = _recoveryInnerSignature(firstSafe, firstKey, safeData);
        bytes memory secondInner = _recoveryInnerSignature(secondSafe, secondKey, safeData);
        uint256 firstOffset = 130;
        uint256 secondOffset = firstOffset + 32 + firstInner.length;
        return abi.encodePacked(
            _contractSignatureStatic(firstSafe, firstOffset),
            _contractSignatureStatic(secondSafe, secondOffset),
            uint256(firstInner.length),
            firstInner,
            uint256(secondInner.length),
            secondInner
        );
    }

    function _recoveryInnerSignature(
        address recoverySafe,
        uint256 recoveryKey,
        bytes memory safeData
    )
        private
        view
        returns (bytes memory)
    {
        bytes32 messageHash = ICompatibilityFallbackHandlerV141(SAFE_COMPATIBILITY_HANDLER_V141)
            .getMessageHashForSafe(recoverySafe, safeData);
        return _ecdsaSignature(recoveryKey, messageHash);
    }

    function _contractSignatureStatic(address owner, uint256 dynamicOffset) private pure returns (bytes memory) {
        return abi.encodePacked(bytes32(uint256(uint160(owner))), bytes32(dynamicOffset), uint8(0));
    }

    function _sourceAccount(address implementation, uint256 tokenId) private view returns (address) {
        return IERC6551Registry(TOKENBOUND_REGISTRY)
            .account(implementation, SALT, ARBITRUM_CHAIN_ID, ARBITRUM_GARDEN_TOKEN, tokenId);
    }

    function _sort(address[] memory values) private pure {
        for (uint256 i = 1; i < values.length; i++) {
            address value = values[i];
            uint256 j = i;
            while (j > 0 && values[j - 1] > value) {
                values[j] = values[j - 1];
                j--;
            }
            values[j] = value;
        }
    }

    function _contains(address[] memory values, address candidate) private pure returns (bool) {
        for (uint256 i = 0; i < values.length; i++) {
            if (values[i] == candidate) return true;
        }
        return false;
    }

    function _rpcUrl(string memory key) private view returns (string memory url) {
        try vm.envString(key) returns (string memory value) {
            url = value;
        } catch {
            url = "";
        }
    }

    function _createPinnedFork(string memory rpc, string memory blockKey) private returns (uint256) {
        uint256 blockNumber = vm.envUint(blockKey);
        assertGt(blockNumber, 0, "fork block must be pinned");
        return vm.createFork(rpc, blockNumber);
    }
}
