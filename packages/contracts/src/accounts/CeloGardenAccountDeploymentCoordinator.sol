// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IERC6551Registry } from "../interfaces/IERC6551Registry.sol";
import { CeloGardenAccountLedger } from "../libraries/CeloGardenAccountLedger.sol";

interface IForeignGardenAccountIdentity {
    function token() external view returns (uint256 chainId, address tokenContract, uint256 tokenId);
    function owner() external view returns (address);
}

/// @title CeloGardenAccountDeploymentCoordinator
/// @notice One-shot coordinator that deploys the exact historical dependency closure and then
///         creates and initializes all 18 foreign-tuple GardenAccounts in the same transaction.
/// @dev Raw init code is supplied as calldata but is accepted only when it matches the frozen
///      length, hash, CREATE2 target, and runtime hash. This contract grants no ongoing authority.
contract CeloGardenAccountDeploymentCoordinator {
    error UnauthorizedOperator();
    error InvalidChain();
    error AlreadyExecuted();
    error ReentrantExecution();
    error InvalidInfrastructure();
    error InvalidDependencyCount();
    error InvalidDependency(uint256 index);
    error UnexpectedExistingImplementation();
    error DependencyDeploymentFailed(uint256 index);
    error InvalidAccountCount();
    error InvalidTokenId(uint256 index);
    error InvalidInitializer(uint256 tokenId);
    error UnexpectedExistingAccount(uint256 tokenId);
    error AccountPredictionMismatch(uint256 tokenId);
    error AccountCreationFailed(uint256 tokenId);
    error AccountInitializationFailed(uint256 tokenId);
    error AccountIdentityMismatch(uint256 tokenId);

    event DependencyReady(uint256 indexed index, address indexed target, bytes32 runtimeCodeHash, bool indexed deployed);
    event GardenAccountReady(uint256 indexed tokenId, address indexed account, bytes32 initializerHash);
    event AtomicDeploymentCompleted(bytes32 indexed ledgerHash);

    struct DependencyDeployment {
        bytes32 salt;
        bytes initCode;
    }

    struct AccountInitialization {
        uint256 tokenId;
        bytes initializerCalldata;
    }

    uint256 public constant CELO_CHAIN_ID = 42_220;
    uint256 public constant SOURCE_CHAIN_ID = 42_161;
    uint256 public constant GARDEN_COUNT = 18;
    address public constant DEPLOYMENT_OPERATOR = 0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6;
    address public constant NICK_CREATE2_FACTORY = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    address public constant ENTRY_POINT = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
    address public constant MULTICALL_FORWARDER = 0xcA11bde05977b3631167028862bE2a173976CA11;
    address public constant ERC6551_REGISTRY = 0x000000006551c19487814612e58FE06813775758;
    address public constant GARDEN_TOKEN = 0xe1Da335110b1ed48e7df63209f5D424d02276593;
    address public constant GARDEN_ACCOUNT_IMPLEMENTATION = 0xE31cAeAc029A60AD17A49278Fdd58032eF9Cf692;
    bytes32 public constant ACCOUNT_SALT = 0x6551655165516551655165516551655165516551655165516551655165516551;

    bytes32 private constant _NICK_FACTORY_CODE_HASH = 0x2fa86add0aed31f33a762c9d88e807c475bd51d0f52bd0955754b2608f7e4989;
    bytes32 private constant _ENTRY_POINT_CODE_HASH = 0xc93c806e738300b5357ecdc2e971d6438d34d8e4e17b99b758b1f9cac91c8e70;
    bytes32 private constant _MULTICALL_CODE_HASH = 0xd5c15df687b16f2ff992fc8d767b4216323184a2bbc6ee2f9c398c318e770891;
    bytes32 private constant _REGISTRY_CODE_HASH = 0xda1d5b06e579f9e42e59b00fbc22939896ecb38dc8830d40de0a2508fecd6735;

    bool public completed;
    bool private _executing;

    // The one-shot transaction intentionally evaluates every atomic boundary before completion.
    // solhint-disable-next-line code-complexity
    function deployAndInitialize(
        DependencyDeployment[] calldata dependencies,
        AccountInitialization[] calldata accounts
    )
        external
    {
        if (msg.sender != DEPLOYMENT_OPERATOR) revert UnauthorizedOperator();
        if (block.chainid != CELO_CHAIN_ID) revert InvalidChain();
        if (completed) revert AlreadyExecuted();
        if (_executing) revert ReentrantExecution();
        _executing = true;

        _requireInfrastructure();
        if (dependencies.length != 5) revert InvalidDependencyCount();
        if (GARDEN_ACCOUNT_IMPLEMENTATION.code.length != 0) revert UnexpectedExistingImplementation();

        for (uint256 i; i < dependencies.length; ++i) {
            _deployOrVerifyDependency(i, dependencies[i]);
        }

        if (accounts.length != GARDEN_COUNT) revert InvalidAccountCount();
        for (uint256 i; i < accounts.length; ++i) {
            if (accounts[i].tokenId != i) revert InvalidTokenId(i);
            _createAndInitializeAccount(accounts[i]);
        }

        completed = true;
        _executing = false;
        emit AtomicDeploymentCompleted(ledgerHash());
    }

    function ledgerHash() public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                CELO_CHAIN_ID,
                SOURCE_CHAIN_ID,
                NICK_CREATE2_FACTORY,
                ENTRY_POINT,
                MULTICALL_FORWARDER,
                ERC6551_REGISTRY,
                GARDEN_TOKEN,
                GARDEN_ACCOUNT_IMPLEMENTATION,
                ACCOUNT_SALT,
                GARDEN_COUNT
            )
        );
    }

    function expectedDependency(uint256 index)
        external
        pure
        returns (address target, bytes32 salt, bytes32 initCodeHash, uint256 initCodeBytes, bytes32 runtimeCodeHash)
    {
        return _expectedDependency(index);
    }

    function expectedAccount(uint256 tokenId)
        external
        pure
        returns (address account, bytes32 initializerHash, bytes32 runtimeCodeHash)
    {
        if (tokenId >= GARDEN_COUNT) revert InvalidTokenId(tokenId);
        return CeloGardenAccountLedger.expectedAccount(tokenId);
    }

    function _requireInfrastructure() private view {
        if (
            NICK_CREATE2_FACTORY.codehash != _NICK_FACTORY_CODE_HASH || ENTRY_POINT.codehash != _ENTRY_POINT_CODE_HASH
                || MULTICALL_FORWARDER.codehash != _MULTICALL_CODE_HASH || ERC6551_REGISTRY.codehash != _REGISTRY_CODE_HASH
        ) {
            revert InvalidInfrastructure();
        }
    }

    function _deployOrVerifyDependency(uint256 index, DependencyDeployment calldata deployment) private {
        (address target, bytes32 salt, bytes32 initCodeHash, uint256 initCodeBytes, bytes32 runtimeCodeHash) =
            _expectedDependency(index);
        if (
            deployment.salt != salt || deployment.initCode.length != initCodeBytes
                || keccak256(deployment.initCode) != initCodeHash
        ) {
            revert InvalidDependency(index);
        }

        bool deployed;
        if (target.code.length == 0) {
            (bool success,) = NICK_CREATE2_FACTORY.call(abi.encodePacked(deployment.salt, deployment.initCode));
            if (!success) revert DependencyDeploymentFailed(index);
            deployed = true;
        }
        if (target.codehash != runtimeCodeHash) revert InvalidDependency(index);
        emit DependencyReady(index, target, runtimeCodeHash, deployed);
    }

    function _createAndInitializeAccount(AccountInitialization calldata initialization) private {
        (address expected, bytes32 initializerHash, bytes32 runtimeCodeHash) =
            CeloGardenAccountLedger.expectedAccount(initialization.tokenId);
        if (keccak256(initialization.initializerCalldata) != initializerHash) {
            revert InvalidInitializer(initialization.tokenId);
        }
        if (expected.code.length != 0) revert UnexpectedExistingAccount(initialization.tokenId);

        address predicted = IERC6551Registry(ERC6551_REGISTRY)
            .account(GARDEN_ACCOUNT_IMPLEMENTATION, ACCOUNT_SALT, SOURCE_CHAIN_ID, GARDEN_TOKEN, initialization.tokenId);
        if (predicted != expected) revert AccountPredictionMismatch(initialization.tokenId);

        address account = IERC6551Registry(ERC6551_REGISTRY)
            .createAccount(
                GARDEN_ACCOUNT_IMPLEMENTATION, ACCOUNT_SALT, SOURCE_CHAIN_ID, GARDEN_TOKEN, initialization.tokenId
            );
        if (account != expected || account.codehash != runtimeCodeHash) {
            revert AccountCreationFailed(initialization.tokenId);
        }

        (bool initialized,) = account.call(initialization.initializerCalldata);
        if (!initialized) revert AccountInitializationFailed(initialization.tokenId);

        (uint256 chainId, address tokenContract, uint256 tokenId) = IForeignGardenAccountIdentity(account).token();
        if (
            chainId != SOURCE_CHAIN_ID || tokenContract != GARDEN_TOKEN || tokenId != initialization.tokenId
                || IForeignGardenAccountIdentity(account).owner() != address(0)
        ) {
            revert AccountIdentityMismatch(initialization.tokenId);
        }
        emit GardenAccountReady(initialization.tokenId, account, initializerHash);
    }

    function _expectedDependency(uint256 index)
        private
        pure
        returns (address target, bytes32 salt, bytes32 initCodeHash, uint256 initCodeBytes, bytes32 runtimeCodeHash)
    {
        if (index == 0) {
            return (
                0x74c96fCEa9ad0345D476f0e4feF3D8Ef29C157d9,
                0xb8e2b4839a4bcb20a701002667aff37c6970ddf6973f15640db4596fe770a85b,
                0x96fb6b8979f6cd563e9d88555b850957b3ae8e1e6fba2e650d38a7e724ed1296,
                3325,
                0x03622b20b48e0efea320094312132d347a44f882919ff2f3240dedef013b9128
            );
        }
        if (index == 1) {
            return (
                0x05F486E3161F895Ad99f041065224F78bDf580a7,
                0xd80ce91b7f038d4f7097354209f7a70ebd75f10f05468bae191e6d2594854741,
                0xf8dfa357377f7fa9605cf12e9a6d77c5ff70adfeb96b569c1863b39e43c0cac0,
                1371,
                0x80e4497dd6fb56aa1b4410693e541967c21e12688c5cab2da6dd979363c4a61a
            );
        }
        if (index == 2) {
            return (
                0x166732eD81Ab200A099215cF33F6A712309B69F7,
                0x080469a2df89af45a71882c2e2c8da445ba6b25c409b18d8420d9dfd66dfa2ca,
                0x8934c32aa8b4f8b160873ea9ce72aaa371be43d0d8134ef56374d29a5b48ff61,
                1077,
                0x60fd6321ecf59eb9beedf71da3689269f96cf3565fa30dc5dc84d89842516fe7
            );
        }
        if (index == 3) {
            return (
                0x0646B09bcf3993F02957651354dC267c450CFE58,
                0xf7f59a27ff12eaee7bf0324ac79182547ea079b89528ee84911b8a128edfd4f7,
                0x8934c32aa8b4f8b160873ea9ce72aaa371be43d0d8134ef56374d29a5b48ff61,
                1077,
                0x60fd6321ecf59eb9beedf71da3689269f96cf3565fa30dc5dc84d89842516fe7
            );
        }
        if (index == 4) {
            return (
                GARDEN_ACCOUNT_IMPLEMENTATION,
                0xd80ce91b7f038d4f7097354209f7a70ebd75f10f05468bae191e6d2594854741,
                0x3a708bd560aa01c10c0bdca56f9865aa66b32948bdb8325e877ed2d83ac46e98,
                20_463,
                0xa9f4f87514a3328e44e18f11f312b4d9b1c358c94428d9718892734671aba07a
            );
        }
        revert InvalidDependency(index);
    }
}
