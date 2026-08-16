// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IERC6551Registry } from "../interfaces/IERC6551Registry.sol";

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
    bytes32 public constant ACCOUNT_SALT =
        0x6551655165516551655165516551655165516551655165516551655165516551;

    bytes32 private constant _NICK_FACTORY_CODE_HASH =
        0x2fa86add0aed31f33a762c9d88e807c475bd51d0f52bd0955754b2608f7e4989;
    bytes32 private constant _ENTRY_POINT_CODE_HASH =
        0xc93c806e738300b5357ecdc2e971d6438d34d8e4e17b99b758b1f9cac91c8e70;
    bytes32 private constant _MULTICALL_CODE_HASH =
        0xd5c15df687b16f2ff992fc8d767b4216323184a2bbc6ee2f9c398c318e770891;
    bytes32 private constant _REGISTRY_CODE_HASH =
        0xda1d5b06e579f9e42e59b00fbc22939896ecb38dc8830d40de0a2508fecd6735;

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
        return _expectedAccount(tokenId);
    }

    function _requireInfrastructure() private view {
        if (
            NICK_CREATE2_FACTORY.codehash != _NICK_FACTORY_CODE_HASH || ENTRY_POINT.codehash != _ENTRY_POINT_CODE_HASH
                || MULTICALL_FORWARDER.codehash != _MULTICALL_CODE_HASH
                || ERC6551_REGISTRY.codehash != _REGISTRY_CODE_HASH
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
        (address expected, bytes32 initializerHash, bytes32 runtimeCodeHash) = _expectedAccount(initialization.tokenId);
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
                3_325,
                0x03622b20b48e0efea320094312132d347a44f882919ff2f3240dedef013b9128
            );
        }
        if (index == 1) {
            return (
                0x05F486E3161F895Ad99f041065224F78bDf580a7,
                0xd80ce91b7f038d4f7097354209f7a70ebd75f10f05468bae191e6d2594854741,
                0xf8dfa357377f7fa9605cf12e9a6d77c5ff70adfeb96b569c1863b39e43c0cac0,
                1_371,
                0x80e4497dd6fb56aa1b4410693e541967c21e12688c5cab2da6dd979363c4a61a
            );
        }
        if (index == 2) {
            return (
                0x166732eD81Ab200A099215cF33F6A712309B69F7,
                0x080469a2df89af45a71882c2e2c8da445ba6b25c409b18d8420d9dfd66dfa2ca,
                0x8934c32aa8b4f8b160873ea9ce72aaa371be43d0d8134ef56374d29a5b48ff61,
                1_077,
                0x60fd6321ecf59eb9beedf71da3689269f96cf3565fa30dc5dc84d89842516fe7
            );
        }
        if (index == 3) {
            return (
                0x0646B09bcf3993F02957651354dC267c450CFE58,
                0xf7f59a27ff12eaee7bf0324ac79182547ea079b89528ee84911b8a128edfd4f7,
                0x8934c32aa8b4f8b160873ea9ce72aaa371be43d0d8134ef56374d29a5b48ff61,
                1_077,
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

    // A branch per frozen token is clearer and safer to audit than runtime-provided lookup data.
    // solhint-disable-next-line code-complexity
    function _expectedAccount(uint256 tokenId)
        private
        pure
        returns (address account, bytes32 initializerHash, bytes32 runtimeCodeHash)
    {
        if (tokenId == 0) {
            return (
                0xf401f34378384713222d1d21f63359cc4E8a858a,
                0xe6f82e595108509c769b3d069259400aa54afdab380ceee308f2c24a8e2f4269,
                0xd3048eedc80a76ebecd7f6e79522c6a22547fe3ff34d25ee51fb104f9272a6fa
            );
        }
        if (tokenId == 1) {
            return (
                0xF7b892886998DAe960D64a9db488336684F137A0,
                0xb2e9c76c2ef6abe20ef1a5c9116a3b5856c5eb2f205d1513538f1068fd4b57cb,
                0x642ab5f18a75370fe2602f1ff394ef4ba660bf4a5f9c575ff66f624b47cbf106
            );
        }
        if (tokenId == 2) {
            return (
                0xA2DF8Eb73444A3f3cf9b8E3749313C7471d7D5E3,
                0x07ec83818ae67d9b774f8f8ecc5add2401ffe622fbc31747afc633bab7985bbc,
                0x2adc1b2fd6b22076539ad0c7a265e57e2b49a60ac06f62395fb481391484b5e3
            );
        }
        if (tokenId == 3) {
            return (
                0x4055530dB392FB2B56037065A512c5b283D90A10,
                0xcac25dce8e2a0dd72439f3c27dfb7dbaceb4a8cf8e90904de0e60989c51695d5,
                0x1f3ed4e302beb6c193b9702c709837ee107269383d521322e71e3767df9fe6e8
            );
        }
        if (tokenId == 4) {
            return (
                0x51499A44BB7793647e67ed827bd17367d7e55314,
                0x65eda20ba341b13d9d0cb2611dfc02f3271b4f3e33663b913c661c1e129a4972,
                0x0ba0eae197970fd69cada5a65d2d781d5cfc7da788189491427f296844e67c35
            );
        }
        if (tokenId == 5) {
            return (
                0xbcCE994513615988690aBCA373B1368218E4957C,
                0x7cf179a6a007b0031696ff9a65ef241492cde5a9c16d82b005c4940005e6d8e7,
                0x286f5c63b1050b31adeb81a45166e5beb9b83709b018e1af72b2c8c904c61f90
            );
        }
        if (tokenId == 6) {
            return (
                0xFDa72CE1D75b735d6595E5814DDF23b97516caEf,
                0xe893b14c200fcb2dc1972624a638222054dcd7ae33264a7af278c403a8c2c4b6,
                0xeebbfa77c11a7955fc2853854d0cd856621b4330280af28e7805e3cb1a4e6316
            );
        }
        if (tokenId == 7) {
            return (
                0xD1F8e787a325F91F5d4Be2D30ea1E67B19e28b30,
                0x19d92170367af0ef6e4847cfed3e57e005ac96ec9086ce1544228bf6f2c6ea9a,
                0x20789f0f6e1fb0b65cb0f5a4cc1e321918f8808a72fab6c1f0b336499a5886c6
            );
        }
        if (tokenId == 8) {
            return (
                0x4f11FB4c255D3eDC7C44a461ab45fBC421Aacb09,
                0x5ca15282752e2f49fd6bba1cb12ab3d02e905f574ce79fb8a697ec62f8cde5bb,
                0x2f0535dbfea833820bd26cf4498acb8896f09fcb8690d353d0d062dd045b71c5
            );
        }
        if (tokenId == 9) {
            return (
                0x636962584b1F492B06151Fee87810281372879b6,
                0xa6875d7485404b35ab8a4ec1222495550454b6abf8e7ef5e5312cf8aff95bfca,
                0xb97f32c18e43c92fd4aa9771d237fa29474fbcd2f400560ee3e457a11fca8556
            );
        }
        if (tokenId == 10) {
            return (
                0x1121218D5e017B57c6DF3B5a001a991BDB910338,
                0xb47a467cb4d66b5c2b051ca56971579c071ffa0eb89c7a83efc9dcd658ef6539,
                0xb902117449da37c87fdd51c939e58bb189bf6cd4c487fda9c15e098932e138af
            );
        }
        if (tokenId == 11) {
            return (
                0x3f0f1551C7E08a2cf6800BD7D72aBfE23E3E32a0,
                0xa7bed7df92dfafdc1ac6db2725dc26af6630e632bedd944f25e41e3a3abfde7d,
                0xcbb18714eb7eb3ea71d986a3b9a83debfb19c62781299778dd9ac713748c5c9e
            );
        }
        if (tokenId == 12) {
            return (
                0x3F22568aE0deAA24dA7b8c669AfDcBD72A6A7fd8,
                0x0da151376195cc0d4e8fffe124f13e1317df394b1b1b7cb33f7f1263c8a64f26,
                0x3e4d76dea8f364d38d5e767194fb2c4faf3273aaf530f69ce1e2a61d97a482c8
            );
        }
        if (tokenId == 13) {
            return (
                0x26c32E54F23af9F9fcC757414c76E56e3fB176E2,
                0xd6ec68a992165814571de5d2880ff94cd533a67fafe55908195e9e96230e1240,
                0xc7e137d2a270b5f4e0f3eb8df951f3060c5e1bc5e9d91348136aac9d6fc83b9c
            );
        }
        if (tokenId == 14) {
            return (
                0x35077CaF6fBef1d5677d318a198C9c47C61bb976,
                0x7322d30ce9b0d79a151fff9c4deb85b8dba31dbdd04f3076480b96dc7b3fe470,
                0x8bc52d1cb55f270d8f90c5a0132d1b9102ba142ef4908e4f614624afefb2c342
            );
        }
        if (tokenId == 15) {
            return (
                0x7bE6eAeb2FB5842Da06A34Af4fAe418347427cd1,
                0x57697d6d052decb6ddabd31cdad5be03c6899d214891cc1a2f0084be0036f388,
                0x63612cdf0a2f19f7e25ec12ccf497a17eff78dd0fb8694a6b6e438399ce7dc9b
            );
        }
        if (tokenId == 16) {
            return (
                0x35722eEdf3F7566A23FA871f0a04267AEe78E0dB,
                0x0b3b701e09a9969589036bb1e7de102c254bc7a5f0e9766bec45a73e321788d3,
                0xf673e657539edbcfbc82c12bd488745773f4e15e4935051be5ecd9fe99344dd0
            );
        }
        if (tokenId == 17) {
            return (
                0x749F84CA070cD2F98d9353F49eCE77C1A3fED532,
                0xdd63b149db5130d61f196c6e6130128053bf0569afc0d70117a4c742d0cd71e2,
                0x5ba3ac5a471139f96c8105e6ec1fcd3d5db2d88ad4463fb66d1465df34d19362
            );
        }
        revert InvalidTokenId(tokenId);
    }
}
