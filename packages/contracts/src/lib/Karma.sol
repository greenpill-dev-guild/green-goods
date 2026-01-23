// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IProjectResolver } from "../interfaces/IKarma.sol";

error KarmaGAPNotSupported();

/// @title KarmaLib
/// @notice Library for Karma GAP protocol integration across Arbitrum, Celo, Base Sepolia
/// @dev All Karma GAP constants and helper functions centralized here
/// @dev Source: karma-gap-sdk/core/consts/index.ts
library KarmaLib {
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
    // GAP CONTRACT ADDRESSES (Main Contract)
    // ============================================================================
    address internal constant GAP_CONTRACT_ARBITRUM = 0x6dC1D6b864e8BEf815806f9e4677123496e12026;
    address internal constant GAP_CONTRACT_CELO = 0x8791Ac8c099314bB1D1514D76de13a1E80275950;
    address internal constant GAP_CONTRACT_BASE_SEPOLIA = 0x4Ca7230fB6b78875bdd1B1e4F665B7B7f1891239;

    // ============================================================================
    // SCHEMA UIDs - OPTIMISM (Chain ID: 10)
    // ============================================================================
    bytes32 internal constant GAP_PROJECT_SCHEMA_OPTIMISM =
        0x5b873b6e7a16207b526dde366e8164e95bcda2f009272306519667c5e94d2191;
    bytes32 internal constant GAP_DETAILS_SCHEMA_OPTIMISM =
        0x70a3f615f738fc6a4f56100692ada93d947c028b840940d97af7e7d6f0fa0577;
    bytes32 internal constant GAP_MEMBEROF_SCHEMA_OPTIMISM =
        0x7fbb8a65924d8ad2ae12356e04b1418043e8361ba3b1b6c917de2e23df3ec81c;

    // ============================================================================
    // SCHEMA UIDs - OPTIMISM SEPOLIA (Chain ID: 11155420)
    // ============================================================================
    bytes32 internal constant GAP_PROJECT_SCHEMA_OPTIMISM_SEPOLIA =
        0xf9bbd118dd100459a7d093403af21c6e7f847fd7f331b7a4e6bfb94a1366bd76;
    bytes32 internal constant GAP_DETAILS_SCHEMA_OPTIMISM_SEPOLIA =
        0xd193e75f420a69910f98fa79cacdfd9d0dcbf5933edce8f8bde9a10bd204d996;
    bytes32 internal constant GAP_MEMBEROF_SCHEMA_OPTIMISM_SEPOLIA =
        0x611f9655188f372e27dce116a803fa9081ca3e2907986368d54fcad538ca3853;

    // ============================================================================
    // SCHEMA UIDs - ARBITRUM (Chain ID: 42161)
    // ============================================================================
    bytes32 internal constant GAP_PROJECT_SCHEMA_ARBITRUM =
        0xac2a06e955a7e25e6729efe1a6532237e3435b21ccd3dc827ae3c94e624d25b3;
    bytes32 internal constant GAP_DETAILS_SCHEMA_ARBITRUM =
        0x16bfe4783b7a9c743c401222c56a07ecb77ed42afc84b61ff1f62f5936c0b9d7;
    bytes32 internal constant GAP_MEMBEROF_SCHEMA_ARBITRUM =
        0x5f430aec9d04f0dcb3729775c5dfe10752e436469a7607f8c64ae44ef996e477;

    // ============================================================================
    // SCHEMA UIDs - SEPOLIA (Chain ID: 11155111)
    // ============================================================================
    bytes32 internal constant GAP_PROJECT_SCHEMA_SEPOLIA =
        0xec77990a252b54b17673955c774b9712766de5eecb22ca5aa2c440e0e93257fb;
    bytes32 internal constant GAP_DETAILS_SCHEMA_SEPOLIA =
        0x2c270e35bfcdc4d611f0e9d3d2ab6924ec6c673505abc22a1dd07e19b67211af;
    bytes32 internal constant GAP_MEMBEROF_SCHEMA_SEPOLIA =
        0xdd87b3500457931252424f4439365534ba72a367503a8805ff3482353fb90301;

    // ============================================================================
    // SCHEMA UIDs - BASE SEPOLIA (Chain ID: 84532)
    // ============================================================================
    bytes32 internal constant GAP_PROJECT_SCHEMA_BASE_SEPOLIA =
        0x5ddd6b7a11406771308431ca9bd146cc717848b74b52993a532dc1aad0ccc83f;
    bytes32 internal constant GAP_DETAILS_SCHEMA_BASE_SEPOLIA =
        0x9b06f811608d135f913c18295486693fe626f35e213a7d132be87b1f952e508c;
    bytes32 internal constant GAP_MEMBEROF_SCHEMA_BASE_SEPOLIA =
        0x857398d86e2d31bec5af882b950ee7b00d1fefefba2432737ab28b68ee041eb8;

    // ============================================================================
    // SCHEMA UIDs - CELO (Chain ID: 42220)
    // ============================================================================
    bytes32 internal constant GAP_PROJECT_SCHEMA_CELO = 0xf3f753b41e04d1052b5a5ec7624d1dfdb6c2da288a985120e477ddbcac071022;
    bytes32 internal constant GAP_DETAILS_SCHEMA_CELO = 0x9895e82115987d8e3e02b35ced92e6a0509293890333f58f50ec291b34853dac;
    bytes32 internal constant GAP_MEMBEROF_SCHEMA_CELO = 0xb4186a2401f40a4c78768941ef9140e1fbe5fe595053a65d44f31d6df180b712;

    // ============================================================================
    // SCHEMA UIDs - SEI (Chain ID: 1329)
    // ============================================================================
    bytes32 internal constant GAP_PROJECT_SCHEMA_SEI = 0xf6b89107f8096220051240b89a48abb66e0a23e529c914953b80f5a2bc5ea44c;
    bytes32 internal constant GAP_DETAILS_SCHEMA_SEI = 0x1b4365b92aa47de3f67cdfb53127518381c1e66e0d9e0f8a15bbfa7250950967;
    bytes32 internal constant GAP_MEMBEROF_SCHEMA_SEI = 0xb7278b94cea2b9f1a8fdd1c4bb52ed66906516a0ff9d59d0f80daffcf147ea5d; // Note:
        // SEI mainnet schema not yet deployed

    // ============================================================================
    // SCHEMA UIDs - SEI TESTNET (Chain ID: 1328)
    // ============================================================================
    bytes32 internal constant GAP_PROJECT_SCHEMA_SEI_TESTNET =
        0x9de9294fbb62391b393332a33bfc28b4e0e728dd094aee4bda3955df62f8401a;
    bytes32 internal constant GAP_DETAILS_SCHEMA_SEI_TESTNET =
        0x76f38d22f88a0df52a8ff0763e1c0af912b0822e758be2e0c9cded91aef71d22;
    bytes32 internal constant GAP_MEMBEROF_SCHEMA_SEI_TESTNET =
        0x222fa508c0cdb5954905dd30611a940f6402da2b3c49ce0c88d33e22f72121e7;

    // ============================================================================
    // HELPER FUNCTIONS
    // ============================================================================

    /// @notice Returns EAS contract address for current chain
    /// @dev Required for direct attestations to Karma GAP schemas
    /// @return EAS contract address
    function getEAS() internal view returns (address) {
        uint256 chainId = block.chainid;
        // Mainnet chains
        if (chainId == 10) return 0x4200000000000000000000000000000000000021; // Optimism
        if (chainId == 42_161) return 0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458; // Arbitrum
        if (chainId == 42_220) return 0x72E1d8ccf5299fb36fEfD8CC4394B8ef7e98Af92; // Celo
        if (chainId == 1329) return 0x6c3970F4e8a23B3849F1C2e155aEe1fb3d44eb48; // Sei

        // Testnet chains
        if (chainId == 11_155_420) return 0x4200000000000000000000000000000000000021; // Optimism Sepolia
        if (chainId == 11_155_111) return 0xC2679fBD37d54388Ce493F1DB75320D236e1815e; // Sepolia
        if (chainId == 84_532) return 0x4200000000000000000000000000000000000021; // Base Sepolia
        if (chainId == 1328) return 0x98222b52Cc47D9e97FC54583F1DBB4Eb3E3Dfa38; // Sei Testnet

        _revertUnsupported();
    }

    /// @notice Returns Project Resolver contract address for current chain
    /// @return Project Resolver contract address
    function getProjectResolver() internal view returns (address) {
        uint256 chainId = block.chainid;
        if (chainId == 10) return GAP_PROJECT_RESOLVER_OPTIMISM;
        if (chainId == 42_161) return GAP_PROJECT_RESOLVER_ARBITRUM;
        if (chainId == 42_220) return GAP_PROJECT_RESOLVER_CELO;
        if (chainId == 1329) return GAP_PROJECT_RESOLVER_SEI;
        if (chainId == 11_155_420) return GAP_PROJECT_RESOLVER_OPTIMISM_SEPOLIA;
        if (chainId == 11_155_111) return GAP_PROJECT_RESOLVER_SEPOLIA;
        if (chainId == 84_532) return GAP_PROJECT_RESOLVER_BASE_SEPOLIA;
        if (chainId == 1328) return GAP_PROJECT_RESOLVER_SEI_TESTNET;
        _revertUnsupported();
    }

    /// @notice Returns GAP main contract address for current chain
    /// @return GAP contract address
    function getGapContract() internal view returns (address) {
        uint256 chainId = block.chainid;
        if (chainId == 42_161) return GAP_CONTRACT_ARBITRUM;
        if (chainId == 42_220) return GAP_CONTRACT_CELO;
        if (chainId == 84_532) return GAP_CONTRACT_BASE_SEPOLIA;
        _revertUnsupported();
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
        _revertUnsupported();
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
        _revertUnsupported();
    }

    /// @notice Returns GAP memberOf schema UID for current chain
    /// @dev Used for project membership attestations
    /// @return MemberOf schema UID
    function getMemberOfSchemaUID() internal view returns (bytes32) {
        uint256 chainId = block.chainid;
        if (chainId == 10) return GAP_MEMBEROF_SCHEMA_OPTIMISM;
        if (chainId == 11_155_420) return GAP_MEMBEROF_SCHEMA_OPTIMISM_SEPOLIA;
        if (chainId == 42_161) return GAP_MEMBEROF_SCHEMA_ARBITRUM;
        if (chainId == 11_155_111) return GAP_MEMBEROF_SCHEMA_SEPOLIA;
        if (chainId == 84_532) return GAP_MEMBEROF_SCHEMA_BASE_SEPOLIA;
        if (chainId == 42_220) return GAP_MEMBEROF_SCHEMA_CELO;
        if (chainId == 1329) return GAP_MEMBEROF_SCHEMA_SEI;
        if (chainId == 1328) return GAP_MEMBEROF_SCHEMA_SEI_TESTNET;
        _revertUnsupported();
    }

    /// @notice Internal helper to revert with KarmaGAPNotSupported error
    /// @dev Extracted to reduce cyclomatic complexity of chain lookup functions
    function _revertUnsupported() private pure {
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

    // ============================================================================
    // GAP PROJECT QUERY HELPERS
    // ============================================================================

    /// @notice Check if address is GAP project admin or owner
    /// @dev Queries GAP contract for admin status (checks both owner and admin)
    /// @param projectUID The GAP project attestation UID
    /// @param account The address to check
    /// @return True if account is a project admin or owner
    function isAdmin(bytes32 projectUID, address account) internal view returns (bool) {
        if (projectUID == bytes32(0)) return false;
        IProjectResolver resolver = IProjectResolver(getProjectResolver());
        return resolver.isAdmin(projectUID, account);
    }
}
