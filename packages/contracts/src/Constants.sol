// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

// GREEN GOODS
address constant GREEN_GOODS_SAFE = 0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19;
address constant ACTION_REGISTRY = 0x9AF3D5Bb1a6d057B99A4948420c5d24ff1e482Ce;
address constant WORK_RESOLVER = 0x4d394ec4dcDC93e451a27C9c9D915Baee9D43A78;
address constant WORK_APPROVAL_RESOLVER = 0xAD93d365C83784F245780d914460D60cBa11d1FA;
address constant COMMUNITY_TOKEN_ARBITRUM = 0x633d825006E4c659b061db7FB9378eDEe8bd95f3;
address constant COMMUNITY_TOKEN_SEPOLIA = 0x4cB67033da4FD849a552A4C5553E7F532B93E516;

address constant GARDEN_TOKEN = 0x9EF896a314B7aE98609eC0c0cA43724C768046B4;
address constant GARDEN_ACCOUNT_IMPLEMENTATION = 0x0E69cFBF71cc21490f25c0b61dc833d16BBd4634;
address constant ROOT_PLANET_GARDEN = 0xa9Cb249a3B651Ce82bf9E9cc48BCF41957647F48;

// TOKENBOUND (FUTURE PRIMTIVE)
bytes32 constant SALT = 0x6551655165516551655165516551655165516551655165516551655165516551;
address constant FACTORY = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
address constant TOKENBOUND_REGISTRY = 0x000000006551c19487814612e58FE06813775758; // Same address on all EVM chains
address constant TOKENBOUND_ACCOUNT = 0x41C8f39463A868d3A88af00cd0fe7102F30E44eC; // Same address on all EVM chains

// EAS (ETHEREUM ATTESTATION SERVICE)
address constant EAS_ARBITRUM = 0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458;
address constant EAS_SEPOLIA = 0xC2679fBD37d54388Ce493F1DB75320D236e1815e;

address constant EAS_SCHEMA_REGISTRY_ARBITRUM = 0xA310da9c5B885E7fb3fbA9D66E9Ba6Df512b78eB;
address constant EAS_SCHEMA_REGISTRY_SEPOLIA = 0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0;

// SAFE
address constant SAFE = 0x29fcB43b46531BcA003ddC8FCB67FFE91900C762;
address constant SAFE_FACTORY = 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67;
address constant SAFE_4337_MODULE = 0xa581c4A4DB7175302464fF3C06380BC3270b4037;

// ERROR MESSAGES
error NotGardenAccount();
error NotGardenerAccount();
error NotInActionRegistry();

// ENUMS
enum Capital {
    SOCIAL,
    MATERIAL,
    FINANCIAL,
    LIVING,
    INTELLECTUAL,
    EXPERIENTIAL,
    SPIRITUAL,
    CULTURAL
}
