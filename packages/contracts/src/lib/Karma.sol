// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS, AttestationRequest, AttestationRequestData } from "@eas/IEAS.sol";
import { IKarmaGap, IProjectResolver } from "../interfaces/IKarmaGap.sol";

error KarmaGAPNotSupported();

/// @title KarmaLib
/// @notice Library for Karma GAP protocol integration across Arbitrum, Celo, Base Sepolia
/// @dev All Karma GAP constants and helper functions centralized here
/// @dev Source: karma-gap-sdk/core/consts/index.ts
library KarmaLib {
    // ============================================================================
    // KARMA GAP CONTRACT ADDRESSES (8 Networks)
    // Source: karma-gap-sdk/core/consts/index.ts
    // ============================================================================

    // Mainnet Networks
    address internal constant KARMA_GAP_CONTRACT_OPTIMISM = 0x6dC1D6b864e8BEf815806f9e4677123496e12026;
    address internal constant KARMA_GAP_CONTRACT_ARBITRUM = 0x6dC1D6b864e8BEf815806f9e4677123496e12026;
    address internal constant KARMA_GAP_CONTRACT_CELO = 0x6dC1D6b864e8BEf815806f9e4677123496e12026;
    address internal constant KARMA_GAP_CONTRACT_SEI = 0xB80D85690747C3E2ceCc0f8529594C6602b642D5;

    // Testnet Networks
    address internal constant KARMA_GAP_CONTRACT_OPTIMISM_SEPOLIA = 0xC891F8eBA218f5034bf3a472528408BE19E1130E;
    address internal constant KARMA_GAP_CONTRACT_SEPOLIA = 0xec8d7BFe344790FD860920C41B46B259c005727A;
    address internal constant KARMA_GAP_CONTRACT_BASE_SEPOLIA = 0x4Ca7230fB6b78875bdd1B1e4F665B7B7f1891239;
    address internal constant KARMA_GAP_CONTRACT_SEI_TESTNET = 0x0bB232f1b137fB55CB6af92c218A1cD63445a2E9;

    // ============================================================================
    // PROJECT RESOLVER ADDRESSES (8 Networks)
    // ============================================================================

    // Mainnet Networks
    address internal constant GAP_PROJECT_RESOLVER_OPTIMISM = 0x7177AdC0f924b695C0294A40C4C5FEFf5EE1E141;
    address internal constant GAP_PROJECT_RESOLVER_ARBITRUM = 0x28BE0b0515be8BB8822aF1467A6613795E74717b;
    address internal constant GAP_PROJECT_RESOLVER_CELO = 0x6dC1D6b864e8BEf815806f9e4677123496e12026;
    address internal constant GAP_PROJECT_RESOLVER_SEI = 0x96f36F25C6bD648d9bdBbd8C3E029CfB2394754d;

    // Testnet Networks
    address internal constant GAP_PROJECT_RESOLVER_OPTIMISM_SEPOLIA = 0x832931F23ea4e3c70957DA71a7eB50F5B7efA93D;
    address internal constant GAP_PROJECT_RESOLVER_SEPOLIA = 0x099787D5a5aC92779A519CfD925ACB0Dc7E8bd23;
    address internal constant GAP_PROJECT_RESOLVER_BASE_SEPOLIA = 0xC891F8eBA218f5034bf3a472528408BE19E1130E;
    address internal constant GAP_PROJECT_RESOLVER_SEI_TESTNET = 0xdA2c62101851365EEdC5A1f7087d92Ffde7345B4;

    // ============================================================================
    // SCHEMA UIDs - OPTIMISM (Chain ID: 10)
    // ============================================================================
    bytes32 internal constant GAP_PROJECT_SCHEMA_OPTIMISM =
        0x5b873b6e7a16207b526dde366e8164e95bcda2f009272306519667c5e94d2191;
    bytes32 internal constant GAP_DETAILS_SCHEMA_OPTIMISM =
        0x70a3f615f738fc6a4f56100692ada93d947c028b840940d97af7e7d6f0fa0577;
    bytes32 internal constant GAP_MILESTONE_SCHEMA_OPTIMISM =
        0xdc3f4d0938b1d029d825c01b3c53ad955e0ef3eabc1f57c1ebde90de2bf527ae;
    bytes32 internal constant GAP_PROJECT_UPDATE_SCHEMA_OPTIMISM =
        0xdc3f4d0938b1d029d825c01b3c53ad955e0ef3eabc1f57c1ebde90de2bf527ae;

    // ============================================================================
    // SCHEMA UIDs - OPTIMISM SEPOLIA (Chain ID: 11155420)
    // ============================================================================
    bytes32 internal constant GAP_PROJECT_SCHEMA_OPTIMISM_SEPOLIA =
        0xf9bbd118dd100459a7d093403af21c6e7f847fd7f331b7a4e6bfb94a1366bd76;
    bytes32 internal constant GAP_DETAILS_SCHEMA_OPTIMISM_SEPOLIA =
        0xd193e75f420a69910f98fa79cacdfd9d0dcbf5933edce8f8bde9a10bd204d996;
    bytes32 internal constant GAP_MILESTONE_SCHEMA_OPTIMISM_SEPOLIA =
        0x6f8e6a1394bdc398f8d93a99b0ecca326d04470a4f0ee5c379bb85a458a322e4;
    bytes32 internal constant GAP_PROJECT_UPDATE_SCHEMA_OPTIMISM_SEPOLIA =
        0x6f8e6a1394bdc398f8d93a99b0ecca326d04470a4f0ee5c379bb85a458a322e4;

    // ============================================================================
    // SCHEMA UIDs - ARBITRUM (Chain ID: 42161)
    // ============================================================================
    bytes32 internal constant GAP_PROJECT_SCHEMA_ARBITRUM =
        0xac2a06e955a7e25e6729efe1a6532237e3435b21ccd3dc827ae3c94e624d25b3;
    bytes32 internal constant GAP_DETAILS_SCHEMA_ARBITRUM =
        0x16bfe4783b7a9c743c401222c56a07ecb77ed42afc84b61ff1f62f5936c0b9d7;
    bytes32 internal constant GAP_MILESTONE_SCHEMA_ARBITRUM =
        0x93391c496898c63995f23797835c8e0468be338f0dbc2df62edfd70856cde1d4;
    bytes32 internal constant GAP_PROJECT_UPDATE_SCHEMA_ARBITRUM =
        0x93391c496898c63995f23797835c8e0468be338f0dbc2df62edfd70856cde1d4;

    // ============================================================================
    // SCHEMA UIDs - SEPOLIA (Chain ID: 11155111)
    // ============================================================================
    bytes32 internal constant GAP_PROJECT_SCHEMA_SEPOLIA =
        0xec77990a252b54b17673955c774b9712766de5eecb22ca5aa2c440e0e93257fb;
    bytes32 internal constant GAP_DETAILS_SCHEMA_SEPOLIA =
        0x2c270e35bfcdc4d611f0e9d3d2ab6924ec6c673505abc22a1dd07e19b67211af;
    bytes32 internal constant GAP_MILESTONE_SCHEMA_SEPOLIA =
        0xcdef0e492d2e7ad25d0b0fdb868f6dcd1f5e5c30e42fd5fa0debdc12f7618322;
    bytes32 internal constant GAP_PROJECT_UPDATE_SCHEMA_SEPOLIA =
        0xcdef0e492d2e7ad25d0b0fdb868f6dcd1f5e5c30e42fd5fa0debdc12f7618322;

    // ============================================================================
    // SCHEMA UIDs - BASE SEPOLIA (Chain ID: 84532)
    // ============================================================================
    bytes32 internal constant GAP_PROJECT_SCHEMA_BASE_SEPOLIA =
        0x5ddd6b7a11406771308431ca9bd146cc717848b74b52993a532dc1aad0ccc83f;
    bytes32 internal constant GAP_DETAILS_SCHEMA_BASE_SEPOLIA =
        0x9b06f811608d135f913c18295486693fe626f35e213a7d132be87b1f952e508c;
    bytes32 internal constant GAP_MILESTONE_SCHEMA_BASE_SEPOLIA =
        0xe9cce07bd9295aafc78faa7afdd88a6fad6fd61834a048fb8c3dbc86cb471f81;
    bytes32 internal constant GAP_PROJECT_UPDATE_SCHEMA_BASE_SEPOLIA =
        0xe9cce07bd9295aafc78faa7afdd88a6fad6fd61834a048fb8c3dbc86cb471f81;

    // ============================================================================
    // SCHEMA UIDs - CELO (Chain ID: 42220)
    // ============================================================================
    bytes32 internal constant GAP_PROJECT_SCHEMA_CELO = 0xf3f753b41e04d1052b5a5ec7624d1dfdb6c2da288a985120e477ddbcac071022;
    bytes32 internal constant GAP_DETAILS_SCHEMA_CELO = 0x9895e82115987d8e3e02b35ced92e6a0509293890333f58f50ec291b34853dac;
    bytes32 internal constant GAP_MILESTONE_SCHEMA_CELO = 0x80f0701853e862d920f87e8ae5b359a1625ad417a9523af2ed12bc3504b04088;
    bytes32 internal constant GAP_PROJECT_UPDATE_SCHEMA_CELO =
        0x80f0701853e862d920f87e8ae5b359a1625ad417a9523af2ed12bc3504b04088;

    // ============================================================================
    // SCHEMA UIDs - SEI (Chain ID: 1329)
    // ============================================================================
    bytes32 internal constant GAP_PROJECT_SCHEMA_SEI = 0xf6b89107f8096220051240b89a48abb66e0a23e529c914953b80f5a2bc5ea44c;
    bytes32 internal constant GAP_DETAILS_SCHEMA_SEI = 0x1b4365b92aa47de3f67cdfb53127518381c1e66e0d9e0f8a15bbfa7250950967;
    bytes32 internal constant GAP_MILESTONE_SCHEMA_SEI = 0xc3b9bee0be3a6ea92f76fa459922a088824e29798becdc82d81f6b2309442563;
    bytes32 internal constant GAP_PROJECT_UPDATE_SCHEMA_SEI =
        0xc3b9bee0be3a6ea92f76fa459922a088824e29798becdc82d81f6b2309442563;

    // ============================================================================
    // SCHEMA UIDs - SEI TESTNET (Chain ID: 1328)
    // ============================================================================
    bytes32 internal constant GAP_PROJECT_SCHEMA_SEI_TESTNET =
        0x9de9294fbb62391b393332a33bfc28b4e0e728dd094aee4bda3955df62f8401a;
    bytes32 internal constant GAP_DETAILS_SCHEMA_SEI_TESTNET =
        0x76f38d22f88a0df52a8ff0763e1c0af912b0822e758be2e0c9cded91aef71d22;
    bytes32 internal constant GAP_MILESTONE_SCHEMA_SEI_TESTNET =
        0xb25551d21dc886be83a07c241c46de318704cb6f485191fdedcf80f4b8b28188;
    bytes32 internal constant GAP_PROJECT_UPDATE_SCHEMA_SEI_TESTNET =
        0xb25551d21dc886be83a07c241c46de318704cb6f485191fdedcf80f4b8b28188;

    // ============================================================================
    // HELPER FUNCTIONS
    // ============================================================================

    /// @notice Returns Karma GAP contract address for current chain
    /// @dev Supports 8 networks: Optimism, Optimism Sepolia, Arbitrum, Sepolia, Base Sepolia, Celo, Sei, Sei Testnet
    /// @return Karma GAP contract address
    function getGapContract() internal view returns (address) {
        uint256 chainId = block.chainid;

        // Mainnet Networks
        if (chainId == 10) return KARMA_GAP_CONTRACT_OPTIMISM;
        if (chainId == 42_161) return KARMA_GAP_CONTRACT_ARBITRUM;
        if (chainId == 42_220) return KARMA_GAP_CONTRACT_CELO;
        if (chainId == 1329) return KARMA_GAP_CONTRACT_SEI;

        // Testnet Networks
        if (chainId == 11_155_420) return KARMA_GAP_CONTRACT_OPTIMISM_SEPOLIA;
        if (chainId == 11_155_111) return KARMA_GAP_CONTRACT_SEPOLIA;
        if (chainId == 84_532) return KARMA_GAP_CONTRACT_BASE_SEPOLIA;
        if (chainId == 1328) return KARMA_GAP_CONTRACT_SEI_TESTNET;

        revert KarmaGAPNotSupported();
    }

    /// @notice Returns Project Resolver contract address for current chain
    /// @return Project Resolver contract address
    function getProjectResolver() internal view returns (address) {
        uint256 chainId = block.chainid;

        // Mainnet Networks
        if (chainId == 10) return GAP_PROJECT_RESOLVER_OPTIMISM;
        if (chainId == 42_161) return GAP_PROJECT_RESOLVER_ARBITRUM;
        if (chainId == 42_220) return GAP_PROJECT_RESOLVER_CELO;
        if (chainId == 1329) return GAP_PROJECT_RESOLVER_SEI;

        // Testnet Networks
        if (chainId == 11_155_420) return GAP_PROJECT_RESOLVER_OPTIMISM_SEPOLIA;
        if (chainId == 11_155_111) return GAP_PROJECT_RESOLVER_SEPOLIA;
        if (chainId == 84_532) return GAP_PROJECT_RESOLVER_BASE_SEPOLIA;
        if (chainId == 1328) return GAP_PROJECT_RESOLVER_SEI_TESTNET;

        revert KarmaGAPNotSupported();
    }

    /// @notice Returns GAP project schema UID for current chain
    /// @return Project schema UID
    function getProjectSchemaUID() internal view returns (bytes32) {
        uint256 chainId = block.chainid;

        if (chainId == 10) return GAP_PROJECT_SCHEMA_OPTIMISM;
        if (chainId == 11_155_420) return GAP_PROJECT_SCHEMA_OPTIMISM_SEPOLIA;
        if (chainId == 42_161) return GAP_PROJECT_SCHEMA_ARBITRUM;
        if (chainId == 11_155_111) return GAP_PROJECT_SCHEMA_SEPOLIA;
        if (chainId == 84_532) return GAP_PROJECT_SCHEMA_BASE_SEPOLIA;
        if (chainId == 42_220) return GAP_PROJECT_SCHEMA_CELO;
        if (chainId == 1329) return GAP_PROJECT_SCHEMA_SEI;
        if (chainId == 1328) return GAP_PROJECT_SCHEMA_SEI_TESTNET;

        revert KarmaGAPNotSupported();
    }

    /// @notice Returns GAP details schema UID for current chain
    /// @return Details schema UID
    function getDetailsSchemaUID() internal view returns (bytes32) {
        uint256 chainId = block.chainid;

        if (chainId == 10) return GAP_DETAILS_SCHEMA_OPTIMISM;
        if (chainId == 11_155_420) return GAP_DETAILS_SCHEMA_OPTIMISM_SEPOLIA;
        if (chainId == 42_161) return GAP_DETAILS_SCHEMA_ARBITRUM;
        if (chainId == 11_155_111) return GAP_DETAILS_SCHEMA_SEPOLIA;
        if (chainId == 84_532) return GAP_DETAILS_SCHEMA_BASE_SEPOLIA;
        if (chainId == 42_220) return GAP_DETAILS_SCHEMA_CELO;
        if (chainId == 1329) return GAP_DETAILS_SCHEMA_SEI;
        if (chainId == 1328) return GAP_DETAILS_SCHEMA_SEI_TESTNET;

        revert KarmaGAPNotSupported();
    }

    /// @notice Returns GAP milestone schema UID for current chain
    /// @dev Used for project milestone attestations (assessments)
    /// @return Milestone schema UID
    function getMilestoneSchemaUID() internal view returns (bytes32) {
        uint256 chainId = block.chainid;

        if (chainId == 10) return GAP_MILESTONE_SCHEMA_OPTIMISM;
        if (chainId == 11_155_420) return GAP_MILESTONE_SCHEMA_OPTIMISM_SEPOLIA;
        if (chainId == 42_161) return GAP_MILESTONE_SCHEMA_ARBITRUM;
        if (chainId == 11_155_111) return GAP_MILESTONE_SCHEMA_SEPOLIA;
        if (chainId == 84_532) return GAP_MILESTONE_SCHEMA_BASE_SEPOLIA;
        if (chainId == 42_220) return GAP_MILESTONE_SCHEMA_CELO;
        if (chainId == 1329) return GAP_MILESTONE_SCHEMA_SEI;
        if (chainId == 1328) return GAP_MILESTONE_SCHEMA_SEI_TESTNET;

        revert KarmaGAPNotSupported();
    }

    /// @notice Returns GAP project update schema UID for current chain
    /// @dev Used for project impact attestations
    /// @return Project update schema UID
    function getProjectUpdateSchemaUID() internal view returns (bytes32) {
        uint256 chainId = block.chainid;

        if (chainId == 10) return GAP_PROJECT_UPDATE_SCHEMA_OPTIMISM;
        if (chainId == 11_155_420) return GAP_PROJECT_UPDATE_SCHEMA_OPTIMISM_SEPOLIA;
        if (chainId == 42_161) return GAP_PROJECT_UPDATE_SCHEMA_ARBITRUM;
        if (chainId == 11_155_111) return GAP_PROJECT_UPDATE_SCHEMA_SEPOLIA;
        if (chainId == 84_532) return GAP_PROJECT_UPDATE_SCHEMA_BASE_SEPOLIA;
        if (chainId == 42_220) return GAP_PROJECT_UPDATE_SCHEMA_CELO;
        if (chainId == 1329) return GAP_PROJECT_UPDATE_SCHEMA_SEI;
        if (chainId == 1328) return GAP_PROJECT_UPDATE_SCHEMA_SEI_TESTNET;

        revert KarmaGAPNotSupported();
    }

    /// @notice Checks if Karma GAP is supported on current chain
    /// @dev Localhost (31337) is NOT supported for unit tests - use fork tests instead
    /// @return True if supported (8 production networks only)
    function isSupported() internal view returns (bool) {
        uint256 chainId = block.chainid;
        return chainId == 10 || chainId == 11_155_420 || chainId == 42_161 || chainId == 11_155_111 || chainId == 84_532
            || chainId == 42_220 || chainId == 1329 || chainId == 1328;
    }
}
