// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";

import { CeloGardenAccountDeploymentCoordinator } from "../../src/accounts/CeloGardenAccountDeploymentCoordinator.sol";
import { CeloGardenAccountRelay } from "../../src/accounts/CeloGardenAccountRelay.sol";

interface IForkGuardian {
    function owner() external view returns (address);
    function isTrustedExecutor(address executor) external view returns (bool);
    function setTrustedExecutor(address executor, bool trusted) external;
}

interface IForkGardenAccount {
    function owner() external view returns (address);
    function token() external view returns (uint256 chainId, address tokenContract, uint256 tokenId);
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

interface IForkSafeFactory {
    function createProxyWithNonce(
        address singleton,
        bytes memory initializer,
        uint256 saltNonce
    )
        external
        returns (address proxy);
}

interface IForkSafe {
    function VERSION() external view returns (string memory);
    function getOwners() external view returns (address[] memory);
    function getThreshold() external view returns (uint256);
    function getModulesPaginated(
        address start,
        uint256 pageSize
    )
        external
        view
        returns (address[] memory modules, address next);
    function nonce() external view returns (uint256);
    function approveHash(bytes32 hashToApprove) external;
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

interface IForkCompatibilityHandler {
    function getMessageHashForSafe(address safe, bytes calldata message) external view returns (bytes32);
}

interface IVmForkSkip {
    function skip(bool skipTest) external;
}

contract CeloGardenAccountReleaseTarget {
    uint256 public calls;

    function record() external {
        calls++;
    }
}

/// @notice Acceptance proof for the exact same-address GardenAccount and final Celo Safe custody path.
/// @dev Every mutation is confined to pinned forks. No live deployment, Guardian grant, Safe transaction,
///      broadcast, or value movement is performed by this test.
contract CeloGardenAccountReleaseForkTest is Test {
    uint256 private constant CELO_BLOCK_GAS_LIMIT = 30_000_000;
    uint64 private constant SAFE_SALT_SOURCE_CHAIN_ID = 42_161;
    uint256 private constant ARBITRUM_BLOCK = 495_035_413;
    uint256 private constant CELO_BLOCK = 74_938_820;
    uint256 private constant SOURCE_CHAIN_ID = 42_161;
    uint256 private constant CELO_CHAIN_ID = 42_220;
    uint64 private constant ARBITRUM_SELECTOR = 4_949_039_107_694_359_620;
    uint64 private constant CELO_SELECTOR = 1_346_049_177_634_351_622;

    address private constant DEPLOYMENT_OPERATOR = 0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6;
    address private constant REGISTRY = 0x000000006551c19487814612e58FE06813775758;
    address private constant IMPLEMENTATION = 0xE31cAeAc029A60AD17A49278Fdd58032eF9Cf692;
    address private constant GARDEN_TOKEN = 0xe1Da335110b1ed48e7df63209f5D424d02276593;
    address private constant GUARDIAN = 0x05F486E3161F895Ad99f041065224F78bDf580a7;
    address private constant ROOT_GARDEN = 0xf401f34378384713222d1d21f63359cc4E8a858a;
    address private constant GREEN_GOODS_SAFE = 0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19;
    address private constant DEV_GUILD_SAFE = 0x49fa954B6C2Cd14B4b3604EF1Cc17cED20a9E42C;

    address private constant CELO_CCIP_ROUTER = 0xfB48f15480926A4ADf9116Dca468bDd2EE6C5F62;
    address private constant SAFE_SINGLETON = 0x29fcB43b46531BcA003ddC8FCB67FFE91900C762;
    address private constant SAFE_FACTORY = 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67;
    address private constant SAFE_HANDLER = 0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99;
    address private constant SAFE_SENTINEL = address(1);

    bytes32 private constant IMPLEMENTATION_CODE_HASH = 0xa9f4f87514a3328e44e18f11f312b4d9b1c358c94428d9718892734671aba07a;
    bytes32 private constant SAFE_SINGLETON_CODE_HASH = 0xb1f926978a0f44a2c0ec8fe822418ae969bd8c3f18d61e5103100339894f81ff;
    bytes32 private constant SAFE_FACTORY_CODE_HASH = 0x50c3cdc4074750a7a974204a716c999edd37482f907608d960b2b025ee0b3317;
    bytes32 private constant SAFE_HANDLER_CODE_HASH = 0x7c6007a5d711cea8dfd5d91f5940ec29c7f200fe511eb1fc1397b367af3c42f9;
    bytes32 private constant SAFE_GUARD_SLOT = 0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8;
    bytes32 private constant SAFE_HANDLER_SLOT = 0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5;

    uint256 private arbitrumFork;
    uint256 private celoFork;
    CeloGardenAccountRelay private relay;
    IForkSafe private gardenSafe;
    CeloGardenAccountReleaseTarget private target;

    function setUp() public {
        string memory arbitrumRpc = _rpc("ARBITRUM_RPC_URL");
        string memory celoRpc = _rpc("CELO_RPC_URL");
        if (bytes(arbitrumRpc).length == 0 || bytes(celoRpc).length == 0) {
            IVmForkSkip(address(vm)).skip(true);
            return;
        }
        arbitrumFork = vm.createFork(arbitrumRpc, ARBITRUM_BLOCK);
        celoFork = vm.createFork(celoRpc, CELO_BLOCK);
    }

    function testFork_exactDependenciesAllAccountsAndNestedSafeThresholds() public {
        vm.selectFork(arbitrumFork);
        assertEq(ROOT_GARDEN.codehash, _accountRuntimeHash(0), "root Garden account changed on Arbitrum");
        assertEq(IMPLEMENTATION.codehash, IMPLEMENTATION_CODE_HASH, "Arbitrum implementation changed");

        vm.selectFork(celoFork);
        _assertOfficialSafeCode();
        _assertRecoverySafe(GREEN_GOODS_SAFE, 1, 3);
        _assertRecoverySafe(DEV_GUILD_SAFE, 2, 1);

        CeloGardenAccountDeploymentCoordinator coordinator = new CeloGardenAccountDeploymentCoordinator();
        CeloGardenAccountDeploymentCoordinator.DependencyDeployment[] memory dependencies = _dependencies();
        CeloGardenAccountDeploymentCoordinator.AccountInitialization[] memory accounts = _accounts();
        vm.prank(DEPLOYMENT_OPERATOR);
        uint256 gasBefore = gasleft();
        coordinator.deployAndInitialize(dependencies, accounts);
        uint256 deploymentGas = gasBefore - gasleft();
        emit log_named_uint("Celo deployAndInitialize gas", deploymentGas);
        assertLt(deploymentGas, CELO_BLOCK_GAS_LIMIT, "atomic deployment exceeds the Celo block gas limit");
        assertTrue(coordinator.completed(), "atomic coordinator did not complete");
        assertEq(IMPLEMENTATION.codehash, IMPLEMENTATION_CODE_HASH, "Celo implementation runtime differs");

        for (uint256 tokenId; tokenId < 18; ++tokenId) {
            (address expected,, bytes32 runtimeHash) = coordinator.expectedAccount(tokenId);
            assertEq(expected.codehash, runtimeHash, "Celo account runtime differs");
            (uint256 chainId, address token, uint256 boundTokenId) = IForkGardenAccount(expected).token();
            assertEq(chainId, SOURCE_CHAIN_ID, "account bound local chain instead of Arbitrum");
            assertEq(token, GARDEN_TOKEN, "account bound wrong GardenToken");
            assertEq(boundTokenId, tokenId, "account bound wrong token ID");
            assertEq(IForkGardenAccount(expected).owner(), address(0), "foreign tuple exposed a local NFT owner");
        }

        address[] memory gardenAccounts = new address[](1);
        address[] memory destinationSafes = new address[](1);
        gardenAccounts[0] = ROOT_GARDEN;
        gardenSafe = IForkSafe(_deployGardenSafe(ROOT_GARDEN));
        destinationSafes[0] = address(gardenSafe);
        relay = new CeloGardenAccountRelay(
            CELO_CCIP_ROUTER,
            ARBITRUM_SELECTOR,
            CELO_SELECTOR,
            address(0xA11CE),
            REGISTRY,
            IMPLEMENTATION,
            GARDEN_TOKEN,
            GREEN_GOODS_SAFE,
            DEV_GUILD_SAFE,
            gardenAccounts,
            destinationSafes
        );

        IForkGuardian guardian = IForkGuardian(GUARDIAN);
        assertFalse(guardian.isTrustedExecutor(address(relay)), "relay unexpectedly trusted before release step");
        vm.prank(guardian.owner());
        guardian.setTrustedExecutor(address(relay), true);
        assertTrue(guardian.isTrustedExecutor(address(relay)), "reviewed relay trust did not take effect on fork");

        target = new CeloGardenAccountReleaseTarget();
        _executeWithGardenAndRecovery(GREEN_GOODS_SAFE);
        _executeWithGardenAndRecovery(DEV_GUILD_SAFE);
        _executeWithBothRecoveries();
        assertEq(target.calls(), 3, "nested EIP-1271 execution count changed");
        assertEq(gardenSafe.nonce(), 3, "Garden Safe nonce did not advance exactly once per action");
    }

    function _executeWithGardenAndRecovery(address recoverySafe) private {
        bytes memory action = abi.encodeCall(target.record, ());
        bytes memory safeData = _safeData(action);
        bytes memory inner = _approvedRecoverySignature(recoverySafe, safeData);
        bytes memory gardenSignature = _prevalidated(ROOT_GARDEN);
        bytes memory recoveryStatic = _contractStatic(recoverySafe, 130);
        bytes memory staticPart = ROOT_GARDEN < recoverySafe
            ? abi.encodePacked(gardenSignature, recoveryStatic)
            : abi.encodePacked(recoveryStatic, gardenSignature);
        bytes memory signatures = abi.encodePacked(staticPart, uint256(inner.length), inner);

        vm.prank(address(relay));
        IForkGardenAccount(ROOT_GARDEN).execute(address(gardenSafe), 0, _safeCall(action, signatures), 0);
    }

    function _executeWithBothRecoveries() private {
        bytes memory action = abi.encodeCall(target.record, ());
        bytes memory safeData = _safeData(action);
        address first = GREEN_GOODS_SAFE;
        address second = DEV_GUILD_SAFE;
        if (first > second) (first, second) = (second, first);
        bytes memory firstInner = _approvedRecoverySignature(first, safeData);
        bytes memory secondInner = _approvedRecoverySignature(second, safeData);
        uint256 firstOffset = 130;
        uint256 secondOffset = firstOffset + 32 + firstInner.length;
        bytes memory signatures = abi.encodePacked(
            _contractStatic(first, firstOffset),
            _contractStatic(second, secondOffset),
            uint256(firstInner.length),
            firstInner,
            uint256(secondInner.length),
            secondInner
        );
        assertTrue(
            gardenSafe.execTransaction(address(target), 0, action, 0, 0, 0, 0, address(0), payable(address(0)), signatures),
            "two recovery Safes failed nested EIP-1271"
        );
    }

    function _approvedRecoverySignature(
        address recoverySafe,
        bytes memory safeData
    )
        private
        returns (bytes memory signature)
    {
        bytes32 messageHash = IForkCompatibilityHandler(SAFE_HANDLER).getMessageHashForSafe(recoverySafe, safeData);
        address[] memory owners = IForkSafe(recoverySafe).getOwners();
        _sort(owners);
        uint256 threshold = IForkSafe(recoverySafe).getThreshold();
        for (uint256 i; i < threshold; ++i) {
            vm.prank(owners[i]);
            IForkSafe(recoverySafe).approveHash(messageHash);
            signature = abi.encodePacked(signature, _prevalidated(owners[i]));
        }
    }

    function _dependencies()
        private
        view
        returns (CeloGardenAccountDeploymentCoordinator.DependencyDeployment[] memory values)
    {
        string memory json = vm.readFile(_evidencePath("celo-dependency-init-code-2026-08-15.json"));
        values = new CeloGardenAccountDeploymentCoordinator.DependencyDeployment[](5);
        for (uint256 i; i < 5; ++i) {
            string memory root = string.concat(".dependencies[", vm.toString(i), "]");
            values[i] = CeloGardenAccountDeploymentCoordinator.DependencyDeployment({
                salt: _jsonBytes32(json, string.concat(root, ".salt")),
                initCode: _jsonBytes(json, string.concat(root, ".initCode"))
            });
        }
    }

    function _accounts()
        private
        view
        returns (CeloGardenAccountDeploymentCoordinator.AccountInitialization[] memory values)
    {
        string memory json =
            vm.readFile(string.concat(vm.projectRoot(), "/.generated/runtime/42220-celo-garden-accounts.json"));
        values = new CeloGardenAccountDeploymentCoordinator.AccountInitialization[](18);
        for (uint256 i; i < 18; ++i) {
            string memory root = string.concat(".accounts[", vm.toString(i), "]");
            values[i] = CeloGardenAccountDeploymentCoordinator.AccountInitialization({
                tokenId: _jsonUint(json, string.concat(root, ".tokenId")),
                initializerCalldata: _jsonBytes(json, string.concat(root, ".initializerCalldata"))
            });
        }
    }

    function _deployGardenSafe(address gardenAccount) private returns (address) {
        address[] memory owners = new address[](3);
        owners[0] = gardenAccount;
        owners[1] = GREEN_GOODS_SAFE;
        owners[2] = DEV_GUILD_SAFE;
        _sort(owners);
        bytes memory initializer = abi.encodeWithSignature(
            "setup(address[],uint256,address,bytes,address,address,uint256,address)",
            owners,
            2,
            address(0),
            bytes(""),
            SAFE_HANDLER,
            address(0),
            0,
            address(0)
        );
        address safe = IForkSafeFactory(SAFE_FACTORY)
            .createProxyWithNonce(
                SAFE_SINGLETON,
                initializer,
                uint256(keccak256(abi.encode("GG_COMMITMENT_POOL_SAFE_V1", SAFE_SALT_SOURCE_CHAIN_ID, gardenAccount)))
            );
        assertEq(IForkSafe(safe).getThreshold(), 2, "final Safe threshold changed");
        assertEq(IForkSafe(safe).nonce(), 0, "new final Safe nonce is not zero");
        return safe;
    }

    function _assertOfficialSafeCode() private {
        assertEq(SAFE_SINGLETON.codehash, SAFE_SINGLETON_CODE_HASH, "Safe singleton code drifted");
        assertEq(SAFE_FACTORY.codehash, SAFE_FACTORY_CODE_HASH, "Safe factory code drifted");
        assertEq(SAFE_HANDLER.codehash, SAFE_HANDLER_CODE_HASH, "Safe handler code drifted");
    }

    function _assertRecoverySafe(address safe, uint256 threshold, uint256 expectedNonce) private {
        assertEq(IForkSafe(safe).VERSION(), "1.4.1", "recovery Safe version drifted");
        address[] memory owners = IForkSafe(safe).getOwners();
        assertEq(owners.length, safe == GREEN_GOODS_SAFE ? 4 : 3, "owner count drifted");
        assertEq(IForkSafe(safe).getThreshold(), threshold, "recovery threshold drifted");
        assertEq(IForkSafe(safe).nonce(), expectedNonce, "recovery Safe nonce drifted");
        (address[] memory modules, address next) = IForkSafe(safe).getModulesPaginated(SAFE_SENTINEL, 10);
        assertEq(modules.length, 0, "recovery Safe has a module");
        assertEq(next, SAFE_SENTINEL, "recovery Safe module sentinel drifted");
        assertEq(vm.load(safe, SAFE_GUARD_SLOT), bytes32(0), "recovery Safe has a guard");
        assertEq(
            address(uint160(uint256(vm.load(safe, SAFE_HANDLER_SLOT)))),
            SAFE_HANDLER,
            "recovery Safe fallback handler drifted"
        );
    }

    function _safeData(bytes memory action) private view returns (bytes memory) {
        return gardenSafe.encodeTransactionData(
            address(target), 0, action, 0, 0, 0, 0, address(0), address(0), gardenSafe.nonce()
        );
    }

    function _safeCall(bytes memory action, bytes memory signatures) private view returns (bytes memory) {
        return abi.encodeCall(
            IForkSafe.execTransaction, (address(target), 0, action, 0, 0, 0, 0, address(0), payable(address(0)), signatures)
        );
    }

    function _prevalidated(address owner) private pure returns (bytes memory) {
        return abi.encodePacked(bytes32(uint256(uint160(owner))), bytes32(0), uint8(1));
    }

    function _contractStatic(address owner, uint256 offset) private pure returns (bytes memory) {
        return abi.encodePacked(bytes32(uint256(uint160(owner))), bytes32(offset), uint8(0));
    }

    function _accountRuntimeHash(uint256 tokenId) private view returns (bytes32) {
        string memory json = vm.readFile(_evidencePath("garden-account-initializers-42161-494723355.json"));
        return _jsonBytes32(json, string.concat(".entries[", vm.toString(tokenId), "].runtimeCodeHash"));
    }

    function _jsonBytes32(string memory json, string memory key) private pure returns (bytes32) {
        return abi.decode(vm.parseJson(json, key), (bytes32));
    }

    function _jsonBytes(string memory json, string memory key) private pure returns (bytes memory) {
        return abi.decode(vm.parseJson(json, key), (bytes));
    }

    function _jsonUint(string memory json, string memory key) private pure returns (uint256) {
        return abi.decode(vm.parseJson(json, key), (uint256));
    }

    function _evidencePath(string memory name) private view returns (string memory) {
        return string.concat(vm.projectRoot(), "/../../.plans/active/celo-garden-account-safe-ownership/evidence/", name);
    }

    function _sort(address[] memory values) private pure {
        for (uint256 i = 1; i < values.length; ++i) {
            address value = values[i];
            uint256 j = i;
            while (j > 0 && values[j - 1] > value) {
                values[j] = values[j - 1];
                --j;
            }
            values[j] = value;
        }
    }

    function _rpc(string memory key) private view returns (string memory value) {
        try vm.envString(key) returns (string memory rpc) {
            value = rpc;
        } catch {
            value = "";
        }
    }
}
