// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title CeloGardenAccountLedger
/// @notice Frozen address, initializer, and runtime hashes for the 18 GardenAccounts.
library CeloGardenAccountLedger {
    error InvalidTokenId(uint256 tokenId);

    // A branch per frozen token is clearer and safer to audit than runtime-provided lookup data.
    // solhint-disable-next-line code-complexity
    function expectedAccount(uint256 tokenId)
        internal
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
